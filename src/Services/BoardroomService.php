<?php

declare(strict_types=1);

namespace App\Services;

use App\Config\Database;
use App\Config\Env;
use App\Services\NotificationService;
use App\Utils\Security;
use PDO;
use RuntimeException;

class BoardroomService
{
    private static int $lastNotificationDispatchTime = 0;

    public static function getLobbyChallenges(?string $industrySlug = null, ?string $currentUserId = null): array
    {
        $pdo = Database::getConnection();

        // Run proactive scheduled match alerts
        try {
            self::checkAndDispatchScheduledNotifications();
        } catch (\Throwable $e) {
            // Non-blocking notification dispatch
        }

        $sql = "
            SELECT c.id, c.mode, c.commitment_minor, c.scheduled_at, c.duration_minutes,
                   c.state, c.host_id, c.opponent_id, i.name AS industry_name, i.slug AS industry_slug,
                   u.display_name AS host_name
            FROM boardroom_challenges c
            JOIN industries i ON c.industry_id = i.id
            JOIN users u ON c.host_id = u.id
            WHERE c.state IN ('open', 'matched', 'scheduled')
        ";

        $params = [];
        if ($industrySlug && $industrySlug !== 'All') {
            $sql .= " AND (i.slug = :slug OR i.name = :slug)";
            $params[':slug'] = $industrySlug;
        }

        $sql .= " ORDER BY c.created_at DESC LIMIT 50";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        return array_map(function ($r) use ($currentUserId) {
            $scheduledTs = !empty($r['scheduled_at']) ? strtotime((string)$r['scheduled_at']) : time();
            $secUntil = max(0, $scheduledTs - time());

            return [
                'id' => $r['id'],
                'industry' => $r['industry_name'],
                'industry_slug' => $r['industry_slug'],
                'host' => $r['host_name'],
                'host_id' => $r['host_id'],
                'opponent_id' => $r['opponent_id'],
                'is_host' => ($currentUserId && $r['host_id'] === $currentUserId),
                'is_opponent' => ($currentUserId && $r['opponent_id'] === $currentUserId),
                'commitment' => (int)($r['commitment_minor'] / 100),
                'scheduled_at' => $r['scheduled_at'],
                'scheduled_at_iso' => !empty($r['scheduled_at']) ? gmdate('Y-m-d\TH:i:s\Z', $scheduledTs) : null,
                'seconds_until_start' => $secUntil,
                'is_scheduled' => ($secUntil > 0),
                'duration' => (int)$r['duration_minutes'],
                'mode' => $r['mode'] ?? 'demo',
                'state' => $r['state'],
                'has_opponent' => !empty($r['opponent_id']),
                'sealed' => true, // Scenario and rubric strictly excluded
            ];
        }, $rows);
    }

    public static function createChallenge(
        string $userId,
        int $industryId,
        int $commitmentAmount,
        string $scheduledAt,
        int $durationMinutes = 15,
        string $mode = 'demo'
    ): array {
        $normalizedMode = (strtolower($mode) === LedgerService::MODE_REAL) ? LedgerService::MODE_REAL : LedgerService::MODE_DEMO;

        if ($normalizedMode === LedgerService::MODE_REAL) {
            FeatureService::assertEnabled('real_mode');
            FeatureService::assertEnabled('real_boardroom');
        }

        if ($commitmentAmount < 1000) {
            throw new RuntimeException("Minimum Boardroom commitment is ₦1,000.");
        }
        if ($durationMinutes < 5 || $durationMinutes > 120) {
            throw new RuntimeException("Duration must be between 5 and 120 minutes.");
        }

        // Parse and validate scheduled match time (ensure valid future datetime)
        $scheduledTs = !empty($scheduledAt) ? strtotime($scheduledAt) : (time() + 600);
        if (!$scheduledTs || $scheduledTs < time()) {
            $scheduledTs = time() + 600; // Default 10 minutes into the future
        }
        $formattedScheduledAt = date('Y-m-d H:i:s', $scheduledTs);

        $pdo = Database::getConnection();

        // Assign a pre-approved scenario confidential server-side
        $scStmt = $pdo->prepare(
            "SELECT id FROM boardroom_scenarios 
             WHERE industry_id = :ind OR industry_id IS NULL 
             ORDER BY RAND() LIMIT 1"
        );
        $scStmt->execute([':ind' => $industryId]);
        $scenarioId = $scStmt->fetchColumn();

        if (!$scenarioId) {
            // Pick any scenario
            $scenarioId = $pdo->query("SELECT id FROM boardroom_scenarios LIMIT 1")->fetchColumn();
        }

        $challengeId = Security::uuid();
        $commitmentMinor = $commitmentAmount * 100;
        $idempotencyKey = "boardroom_host_{$userId}_{$challengeId}";

        // Step 1: Hold host's commitment
        LedgerService::holdCommitment(
            $userId,
            $commitmentMinor,
            'boardroom_escrow_hold',
            $challengeId,
            $idempotencyKey,
            $normalizedMode
        );

        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare(
                "INSERT INTO boardroom_challenges 
                    (id, host_id, industry_id, scenario_id, mode, commitment_minor, scheduled_at, duration_minutes, state, notified_5min, notified_started, created_at)
                 VALUES 
                    (:id, :uid, :ind, :sc, :mode, :amt, :sched, :dur, 'open', 0, 0, NOW(3))"
            );
            $stmt->execute([
                ':id' => $challengeId,
                ':uid' => $userId,
                ':ind' => $industryId,
                ':sc' => $scenarioId,
                ':mode' => $normalizedMode,
                ':amt' => $commitmentMinor,
                ':sched' => $formattedScheduledAt,
                ':dur' => $durationMinutes,
            ]);

            // Add participant
            $part = $pdo->prepare(
                "INSERT INTO boardroom_participants (challenge_id, user_id, joined_at, commitment_held_at)
                 VALUES (:cid, :uid, NOW(3), NOW(3))"
            );
            $part->execute([':cid' => $challengeId, ':uid' => $userId]);

            $pdo->commit();

            // Notify host of successful scheduling
            $startTimeFormatted = date('H:i', $scheduledTs);
            NotificationService::dispatch(
                $userId,
                '🏛️ Boardroom Challenge Created',
                "Match scheduled for {$startTimeFormatted}. Waiting for opponent in lobby. Scenario is securely sealed.",
                'boardroom_waiting_room',
                $challengeId
            );

            return [
                'challenge_id' => $challengeId,
                'state' => 'open',
                'mode' => $normalizedMode,
                'commitment' => $commitmentAmount,
                'duration' => $durationMinutes,
                'scheduled_at' => $formattedScheduledAt,
                'scheduled_at_iso' => gmdate('Y-m-d\TH:i:s\Z', $scheduledTs),
                'seconds_until_start' => max(0, $scheduledTs - time()),
                'message' => 'Challenge created and published to lobby. Scenario is sealed.',
            ];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public static function joinChallenge(string $userId, string $challengeId): array
    {
        $pdo = Database::getConnection();
        $pdo->beginTransaction();

        try {
            $stmt = $pdo->prepare("SELECT * FROM boardroom_challenges WHERE id = ? FOR UPDATE");
            $stmt->execute([$challengeId]);
            $challenge = $stmt->fetch();

            if (!$challenge) {
                throw new RuntimeException("Challenge not found.");
            }

            // Creator or Opponent re-entering their own room
            if ($challenge['host_id'] === $userId) {
                $pdo->rollBack();
                $scheduledTs = !empty($challenge['scheduled_at']) ? strtotime((string)$challenge['scheduled_at']) : time();
                $secondsUntil = max(0, $scheduledTs - time());
                return [
                    'challenge_id' => $challengeId,
                    'state' => $challenge['state'],
                    'reentered_as' => 'host',
                    'seconds_until_start' => $secondsUntil,
                    'message' => 'Returning to your executive boardroom lounge.',
                ];
            }
            if (!empty($challenge['opponent_id']) && $challenge['opponent_id'] === $userId) {
                $pdo->rollBack();
                $scheduledTs = !empty($challenge['scheduled_at']) ? strtotime((string)$challenge['scheduled_at']) : time();
                $secondsUntil = max(0, $scheduledTs - time());
                return [
                    'challenge_id' => $challengeId,
                    'state' => $challenge['state'],
                    'reentered_as' => 'opponent',
                    'seconds_until_start' => $secondsUntil,
                    'message' => 'Returning to your executive boardroom match.',
                ];
            }

            if (!in_array($challenge['state'], ['open', 'matched'], true)) {
                throw new RuntimeException("This challenge is no longer open for opponents.");
            }

            $challengeMode = strtolower((string)($challenge['mode'] ?? 'demo'));
            if ($challengeMode === 'real') {
                FeatureService::assertEnabled('real_mode');
                FeatureService::assertEnabled('real_boardroom');
            }

            $commitmentMinor = (int)$challenge['commitment_minor'];
            $idempotencyKey = "boardroom_join_{$userId}_{$challengeId}";

            // Step 1: Hold opponent's commitment
            LedgerService::holdCommitment(
                $userId,
                $commitmentMinor,
                'boardroom_escrow_hold',
                $challengeId,
                $idempotencyKey,
                $challengeMode
            );

            $duration = (int)$challenge['duration_minutes'];
            $scheduledTs = !empty($challenge['scheduled_at']) ? strtotime((string)$challenge['scheduled_at']) : time();
            $isPastOrNow = ($scheduledTs <= time());

            if ($isPastOrNow) {
                // Scheduled time has arrived: match is immediately live
                $up = $pdo->prepare(
                    "UPDATE boardroom_challenges 
                     SET opponent_id = :uid, state = 'live', start_at = NOW(3), 
                         deadline_at = DATE_ADD(NOW(3), INTERVAL :dur MINUTE),
                         notified_started = 1
                     WHERE id = :cid AND state IN ('open', 'matched')"
                );
                $up->execute([
                    ':uid' => $userId,
                    ':dur' => $duration,
                    ':cid' => $challengeId,
                ]);

                if ($up->rowCount() !== 1) {
                    throw new RuntimeException("Challenge was already accepted by another executive.");
                }

                $newState = 'live';
            } else {
                // Scheduled time is in the future: lock match into 'scheduled' state
                $up = $pdo->prepare(
                    "UPDATE boardroom_challenges 
                     SET opponent_id = :uid, state = 'scheduled'
                     WHERE id = :cid AND state IN ('open', 'matched')"
                );
                $up->execute([
                    ':uid' => $userId,
                    ':cid' => $challengeId,
                ]);

                if ($up->rowCount() !== 1) {
                    throw new RuntimeException("Challenge was already accepted by another executive.");
                }

                $newState = 'scheduled';
            }

            $part = $pdo->prepare(
                "INSERT INTO boardroom_participants (challenge_id, user_id, joined_at, commitment_held_at)
                 VALUES (:cid, :uid, NOW(3), NOW(3))
                 ON DUPLICATE KEY UPDATE joined_at = NOW(3)"
            );
            $part->execute([':cid' => $challengeId, ':uid' => $userId]);

            $pdo->commit();

            // Dispatch smart notifications
            $startTimeFormatted = date('H:i', $scheduledTs);
            $minsRemaining = max(1, ceil(($scheduledTs - time()) / 60));

            if ($newState === 'live') {
                NotificationService::dispatch(
                    $challenge['host_id'],
                    '🏛️ Boardroom Match Started! Dilemma Unsealed',
                    'An executive opponent accepted! The boardroom duel is live and the scenario is unsealed.',
                    'live_challenge',
                    $challengeId
                );
                NotificationService::dispatch(
                    $userId,
                    '🏛️ Boardroom Match Started! Dilemma Unsealed',
                    'You entered the boardroom duel. The confidential scenario has unsealed. Good luck!',
                    'live_challenge',
                    $challengeId
                );
            } else {
                NotificationService::dispatch(
                    $challenge['host_id'],
                    '⚔️ Opponent Accepted Match!',
                    "An executive joined your challenge! Match starts at {$startTimeFormatted} (in {$minsRemaining} mins). Enter the waiting lounge.",
                    'boardroom_waiting_room',
                    $challengeId
                );
                NotificationService::dispatch(
                    $userId,
                    '⚔️ Challenge Accepted & Locked!',
                    "You joined the match starting at {$startTimeFormatted} (in {$minsRemaining} mins). Enter the waiting lounge.",
                    'boardroom_waiting_room',
                    $challengeId
                );
            }

            return [
                'challenge_id' => $challengeId,
                'state' => $newState,
                'scheduled_at' => $challenge['scheduled_at'],
                'seconds_until_start' => max(0, $scheduledTs - time()),
                'deadline_minutes' => $duration,
            ];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public static function settleChallenge(string $challengeId, string $winnerUserId, ?string $rationale = null): array
    {
        $pdo = Database::getConnection();
        $pdo->beginTransaction();
        try {
            $stmt = $pdo->prepare("SELECT * FROM boardroom_challenges WHERE id = ? FOR UPDATE");
            $stmt->execute([$challengeId]);
            $c = $stmt->fetch();
            if (!$c) {
                throw new RuntimeException("Challenge not found.");
            }
            if ($c['state'] === 'settled') {
                return ['status' => 'already_settled'];
            }

            $heldMinor = (int)$c['commitment_minor'];
            $mode = $c['mode'] ?? 'demo';
            $hostId = $c['host_id'];
            $opponentId = $c['opponent_id'];

            // Winner gets full pot (host hold + opponent hold = 2 * heldMinor)
            // Loser gets 0
            if ($hostId) {
                $isWinner = ($hostId === $winnerUserId);
                $returnMinor = $isWinner ? ($heldMinor * 2) : 0;
                LedgerService::settleCommitment($hostId, $heldMinor, $returnMinor, 'boardroom_resolution', $challengeId, "br_settle_host_{$challengeId}", $mode);

                // Notify host
                $title = $isWinner ? '🏆 Boardroom Victory!' : '🏛️ Boardroom Match Settled';
                $msg = $isWinner
                    ? "Congratulations! Your executive memorandum scored high enough to claim victory. Payout has settled."
                    : ($winnerUserId === 'benchmark_ai'
                        ? "Match concluded. Your memo scored below the 70-point Institutional Benchmark standard."
                        : "Match concluded. Your opponent's executive memorandum claimed victory in this round.");
                try {
                    NotificationService::dispatch($hostId, $title, $msg, 'live_challenge', $challengeId, 'boardroom');
                } catch (\Throwable $e) {}
            }

            if ($opponentId) {
                $isWinner = ($opponentId === $winnerUserId);
                $returnMinor = $isWinner ? ($heldMinor * 2) : 0;
                LedgerService::settleCommitment($opponentId, $heldMinor, $returnMinor, 'boardroom_resolution', $challengeId, "br_settle_opp_{$challengeId}", $mode);

                // Notify opponent
                $title = $isWinner ? '🏆 Boardroom Victory!' : '🏛️ Boardroom Match Settled';
                $msg = $isWinner
                    ? "Congratulations! Your executive memorandum scored high enough to claim victory. Payout has settled."
                    : "Match concluded. Your opponent's executive memorandum claimed victory in this round.";
                try {
                    NotificationService::dispatch($opponentId, $title, $msg, 'live_challenge', $challengeId, 'boardroom');
                } catch (\Throwable $e) {}
            }

            $up = $pdo->prepare("UPDATE boardroom_challenges SET state = 'settled' WHERE id = ?");
            $up->execute([$challengeId]);

            $pdo->commit();
            return [
                'status' => 'settled',
                'challenge_id' => $challengeId,
                'winner_id' => $winnerUserId,
                'pot_minor' => $heldMinor * 2,
            ];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public static function startSoloDemoMatch(string $userId, string $challengeId): array
    {
        $pdo = Database::getConnection();
        $up = $pdo->prepare(
            "UPDATE boardroom_challenges 
             SET state = 'live', start_at = NOW(3), 
                 scheduled_at = NOW(3),
                 deadline_at = DATE_ADD(NOW(3), INTERVAL duration_minutes MINUTE)
             WHERE id = ? AND host_id = ?"
        );
        $up->execute([$challengeId, $userId]);

        return ['challenge_id' => $challengeId, 'state' => 'live'];
    }

    public static function getChallengeDetails(string $userId, string $challengeId): array
    {
        $pdo = Database::getConnection();

        // Run notification dispatcher
        try {
            self::checkAndDispatchScheduledNotifications();
        } catch (\Throwable $e) {
            // Non-blocking
        }

        $stmt = $pdo->prepare(
            "SELECT c.*, i.name AS industry_name,
                    h.display_name AS host_name, o.display_name AS opponent_name,
                    s.title AS scenario_title, s.confidential_body, s.reference_case
             FROM boardroom_challenges c
             JOIN industries i ON c.industry_id = i.id
             JOIN users h ON c.host_id = h.id
             LEFT JOIN users o ON c.opponent_id = o.id
             LEFT JOIN boardroom_scenarios s ON c.scenario_id = s.id
             WHERE c.id = ?"
        );
        $stmt->execute([$challengeId]);
        $c = $stmt->fetch();

        if (!$c) {
            throw new RuntimeException("Challenge not found.");
        }

        $isHost = $c['host_id'] === $userId;
        $isOpponent = $c['opponent_id'] === $userId;

        if (!$isHost && !$isOpponent) {
            throw new RuntimeException("Unauthorized: you are not a participant in this challenge.");
        }

        // Automatic start on schedule arrival if opponent is present
        $now = time();
        $scheduledTs = !empty($c['scheduled_at']) ? strtotime((string)$c['scheduled_at']) : $now;

        if (($c['state'] === 'scheduled' || ($c['state'] === 'open' && !empty($c['opponent_id']))) && $scheduledTs <= $now) {
            $up = $pdo->prepare(
                "UPDATE boardroom_challenges 
                 SET state = 'live', start_at = NOW(3), 
                     deadline_at = DATE_ADD(NOW(3), INTERVAL duration_minutes MINUTE),
                     notified_started = 1
                 WHERE id = ? AND state IN ('open', 'matched', 'scheduled')"
            );
            $up->execute([$challengeId]);
            $c['state'] = 'live';
            $c['start_at'] = date('Y-m-d H:i:s');
            $c['deadline_at'] = date('Y-m-d H:i:s', $now + ((int)$c['duration_minutes'] * 60));
        }

        $secondsUntilStart = max(0, $scheduledTs - $now);
        $isLiveOrCompleted = in_array($c['state'], ['live', 'evaluating', 'settled', 'disputed'], true) && ($secondsUntilStart === 0);

        // Fetch user submission if already submitted
        $subStmt = $pdo->prepare("SELECT * FROM boardroom_submissions WHERE challenge_id = ? AND user_id = ?");
        $subStmt->execute([$challengeId, $userId]);
        $userSub = $subStmt->fetch();

        // Fetch all submissions for opponent presence & status
        $allSubsStmt = $pdo->prepare("SELECT user_id FROM boardroom_submissions WHERE challenge_id = ?");
        $allSubsStmt->execute([$challengeId]);
        $submittedUserIds = $allSubsStmt->fetchAll(\PDO::FETCH_COLUMN) ?: [];

        $hostSubmitted = in_array($c['host_id'], $submittedUserIds, true);
        $opponentSubmitted = !empty($c['opponent_id']) && in_array($c['opponent_id'], $submittedUserIds, true);

        $deadlineTs = !empty($c['deadline_at']) ? strtotime((string)$c['deadline_at']) : 0;
        $secondsRemaining = max(0, $deadlineTs - $now);

        // If time has expired and challenge is still 'live', transition to 'evaluating'
        if ($c['state'] === 'live' && $deadlineTs > 0 && $now >= $deadlineTs) {
            $up = $pdo->prepare("UPDATE boardroom_challenges SET state = 'evaluating' WHERE id = ? AND state = 'live'");
            $up->execute([$challengeId]);
            $c['state'] = 'evaluating';
        }

        return [
            'id' => $c['id'],
            'state' => $c['state'],
            'industry' => $c['industry_name'],
            'host_name' => $c['host_name'],
            'host_id' => $c['host_id'],
            'opponent_name' => $c['opponent_name'] ?? null,
            'opponent_id' => $c['opponent_id'] ?? null,
            'has_opponent' => !empty($c['opponent_id']),
            'opponent_ready' => !empty($c['opponent_id']),
            'commitment' => (int)($c['commitment_minor'] / 100),
            'scheduled_at' => $c['scheduled_at'],
            'scheduled_at_iso' => !empty($c['scheduled_at']) ? gmdate('Y-m-d\TH:i:s\Z', $scheduledTs) : null,
            'seconds_until_start' => $secondsUntilStart,
            'is_scheduled_waiting' => ($secondsUntilStart > 0 && !in_array($c['state'], ['evaluating', 'settled', 'disputed'], true)),
            'start_at' => $c['start_at'],
            'deadline_at' => $c['deadline_at'],
            'deadline_at_iso' => $deadlineTs > 0 ? gmdate('Y-m-d\TH:i:s\Z', $deadlineTs) : null,
            'seconds_remaining' => $secondsRemaining,
            'duration_minutes' => (int)$c['duration_minutes'],
            'is_host' => $isHost,
            'is_opponent' => $isOpponent,
            'has_submitted' => (bool)$userSub,
            'host_submitted' => $hostSubmitted,
            'opponent_submitted' => $opponentSubmitted,
            'total_submissions' => count($submittedUserIds),
            'user_submission' => $userSub ? $userSub['answer_text'] : null,
            'scenario' => $isLiveOrCompleted ? [
                'title' => $c['scenario_title'],
                'body' => $c['confidential_body'],
                'reference_case' => !empty($c['reference_case']) ? json_decode((string)$c['reference_case'], true) : null,
            ] : null,
        ];
    }

    public static function submitMemo(
        string $userId,
        string $challengeId,
        string $answerText,
        bool $dictationUsed = false,
        string $inputMethod = 'typed'
    ): array
    {
        $answerText = trim($answerText);
        $len = mb_strlen($answerText);

        if ($len < 40) {
            throw new RuntimeException("Executive strategy memo must be at least 40 characters long.");
        }
        if ($len > 20000) {
            throw new RuntimeException("Memo exceeds the 20,000 character maximum limit.");
        }

        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("SELECT * FROM boardroom_challenges WHERE id = ? FOR UPDATE");
        $stmt->execute([$challengeId]);
        $c = $stmt->fetch();

        if (!$c) {
            throw new RuntimeException("Challenge not found.");
        }

        $now = time();
        $scheduledTs = !empty($c['scheduled_at']) ? strtotime((string)$c['scheduled_at']) : $now;

        if ($c['state'] === 'scheduled' || $scheduledTs > $now) {
            $startTimeFormatted = date('H:i', $scheduledTs);
            throw new RuntimeException("Match has not started yet. The confidential dilemma unseals at {$startTimeFormatted}.");
        }

        if ($c['state'] !== 'live') {
            throw new RuntimeException("Challenge is not currently accepting submissions.");
        }

        if (!empty($c['deadline_at']) && strtotime((string)$c['deadline_at']) < ($now - 30)) {
            throw new RuntimeException("Submission deadline has expired for this boardroom match.");
        }

        $subId = Security::uuid();

        // ── AI-generated response detector ──────────────────────────────
        $aiSuspected = 0;
        $aiFlagReason = null;
        $typingSeconds = null;

        if (!empty($c['start_at'])) {
            $startTs  = strtotime((string)$c['start_at']);
            $typingSeconds = max(1, $now - $startTs);
        }

        $wordCount  = str_word_count($answerText);
        $charCount  = mb_strlen($answerText);
        $wpm        = $typingSeconds > 0 ? ($wordCount / ($typingSeconds / 60)) : 0;

        // Signal 1: Typing / speaking speed anomaly
        // Normal human typing is ~40-75 WPM. Spoken oral dictation is ~120-165 WPM.
        $speedThreshold = $dictationUsed ? 185 : 90;
        if ($wpm > $speedThreshold && $wordCount > 80) {
            $aiSuspected = 1;
            $aiFlagReason = "Speed anomaly: {$wpm} WPM for {$wordCount} words in {$typingSeconds}s (" . ($dictationUsed ? 'voice input' : 'typing') . ")";
        }

        // Signal 2: Markdown structure markers (AI formatting tells)
        $markdownHits = 0;
        if (preg_match('/^#{1,3}\s/m', $answerText))         $markdownHits++; // ## Headers
        if (preg_match('/\*\*[^*]{3,}\*\*/', $answerText))   $markdownHits++; // **Bold**
        if (preg_match('/^\d+\.\s.{30,}/m', $answerText))    $markdownHits++; // Numbered lists with long items
        if (preg_match('/^[-•]\s.{20,}/m', $answerText))     $markdownHits++; // Bullet lists
        if (preg_match('/:\s*\n[-•\d]/m', $answerText))      $markdownHits++; // Colon-then-list pattern

        if ($markdownHits >= 3 && $wordCount > 120) {
            $aiSuspected = 1;
            $aiFlagReason = ($aiFlagReason ? $aiFlagReason . '; ' : '') . "AI formatting: {$markdownHits} markdown signals, {$wordCount} words";
        }

        // Signal 3: Long response in very short time (> 400 words in < 3 mins)
        if ($wordCount > 400 && $typingSeconds !== null && $typingSeconds < 180) {
            $aiSuspected = 1;
            $aiFlagReason = ($aiFlagReason ? $aiFlagReason . '; ' : '') . "Volume anomaly: {$wordCount} words in {$typingSeconds}s";
        }

        // Signal 4: Perfectly structured executive memo sections (AI typical output)
        $sectionKeywords = ['immediate', 'liquidity', 'runway', 'mitigation', 'contingency', 'strategic', 'operational', 'milestone', 'downside', 'financing'];
        $sectionHits = 0;
        foreach ($sectionKeywords as $kw) {
            if (stripos($answerText, $kw) !== false) $sectionHits++;
        }
        if ($sectionHits >= 7 && $wordCount > 200 && ($typingSeconds !== null && $typingSeconds < 240)) {
            $aiSuspected = 1;
            $aiFlagReason = ($aiFlagReason ? $aiFlagReason . '; ' : '') . "Keyword density: {$sectionHits}/10 executive terms in {$typingSeconds}s";
        }
        // ── End AI detector ─────────────────────────────────────────────

        // Ensure columns exist on boardroom_submissions (self-healing migration)
        static $colsChecked = false;
        if (!$colsChecked) {
            try {
                $check = $pdo->query("SHOW COLUMNS FROM boardroom_submissions LIKE 'ai_suspected'")->fetch();
                if (!$check) {
                    $pdo->exec("ALTER TABLE boardroom_submissions 
                        ADD COLUMN ai_suspected TINYINT(1) NOT NULL DEFAULT 0,
                        ADD COLUMN typing_duration_seconds INT DEFAULT NULL,
                        ADD COLUMN ai_flag_reason VARCHAR(500) DEFAULT NULL,
                        ADD COLUMN input_method VARCHAR(50) DEFAULT 'typed'");
                } else {
                    $checkMethod = $pdo->query("SHOW COLUMNS FROM boardroom_submissions LIKE 'input_method'")->fetch();
                    if (!$checkMethod) {
                        $pdo->exec("ALTER TABLE boardroom_submissions ADD COLUMN input_method VARCHAR(50) DEFAULT 'typed'");
                    }
                }
                $colsChecked = true;
            } catch (\Throwable $e) {}
        }

        $pdo->beginTransaction();
        try {
            try {
                $insSub = $pdo->prepare(
                    "INSERT INTO boardroom_submissions (id, challenge_id, user_id, answer_text, submitted_at, ai_suspected, typing_duration_seconds, ai_flag_reason, input_method)
                     VALUES (:id, :cid, :uid, :ans, NOW(3), :ai_suspected, :typing_sec, :ai_reason, :input_method)
                     ON DUPLICATE KEY UPDATE answer_text = VALUES(answer_text), submitted_at = NOW(3),
                       ai_suspected = VALUES(ai_suspected), typing_duration_seconds = VALUES(typing_duration_seconds),
                       ai_flag_reason = VALUES(ai_flag_reason), input_method = VALUES(input_method)"
                );
                $insSub->execute([
                    ':id'          => $subId,
                    ':cid'         => $challengeId,
                    ':uid'         => $userId,
                    ':ans'         => $answerText,
                    ':ai_suspected'=> $aiSuspected,
                    ':typing_sec'  => $typingSeconds,
                    ':ai_reason'   => $aiFlagReason,
                    ':input_method'=> $inputMethod,
                ]);
            } catch (\Throwable $e) {
                // Graceful fallback to basic insert if column not yet present
                $insSub = $pdo->prepare(
                    "INSERT INTO boardroom_submissions (id, challenge_id, user_id, answer_text, submitted_at)
                     VALUES (:id, :cid, :uid, :ans, NOW(3))
                     ON DUPLICATE KEY UPDATE answer_text = VALUES(answer_text), submitted_at = NOW(3)"
                );
                $insSub->execute([
                    ':id'  => $subId,
                    ':cid' => $challengeId,
                    ':uid' => $userId,
                    ':ans' => $answerText,
                ]);
            }

            // Queue evaluation run for the Python NVIDIA NIM agent
            $runId = Security::uuid();
            $rubricSnapshot = json_encode([
                'financial_mechanics' => 40,
                'risk_management' => 30,
                'historical_alignment' => 20,
                'communication' => 10,
            ]);

            $activeModel = FeatureService::getActiveAiModel();
            $insRun = $pdo->prepare(
                "INSERT INTO evaluation_runs (id, challenge_id, model_id, rubric_version, rubric_snapshot, evaluation_state, created_at)
                 VALUES (:id, :cid, :model, 'v1_40_30_20_10', :rubric, 'queued', NOW(3))"
            );
            $insRun->execute([
                ':id' => $runId,
                ':cid' => $challengeId,
                ':model' => $activeModel,
                ':rubric' => $rubricSnapshot,
            ]);

            // Check how many participants exist in this challenge
            $totalParticipants = !empty($c['opponent_id']) ? 2 : 1;

            // Count how many unique submissions have been recorded for this challenge
            $subCountStmt = $pdo->prepare("SELECT COUNT(DISTINCT user_id) FROM boardroom_submissions WHERE challenge_id = ?");
            $subCountStmt->execute([$challengeId]);
            $subsRecorded = (int)$subCountStmt->fetchColumn();

            // If solo match against AI benchmark, or if BOTH human participants have submitted:
            if ($totalParticipants === 1 || $subsRecorded >= $totalParticipants) {
                $upC = $pdo->prepare("UPDATE boardroom_challenges SET state = 'evaluating' WHERE id = ?");
                $upC->execute([$challengeId]);
            } else {
                // Keep challenge live so opponent can submit before deadline expires!
            }

            // Award XP
            $xpId = Security::uuid();
            $xp = $pdo->prepare(
                "INSERT INTO xp_events (id, user_id, xp, reason, source_key, created_at)
                 VALUES (:id, :uid, 100, 'Boardroom strategy memo submitted', :skey, NOW(3))"
            );
            $xp->execute([
                ':id' => $xpId,
                ':uid' => $userId,
                ':skey' => "xp_boardroom_{$challengeId}_{$userId}",
            ]);

            $pdo->commit();

            return [
                'submission_id' => $subId,
                'run_id' => $runId,
                'status' => 'queued',
                'message' => 'Executive memo submitted successfully. Queued for executive evaluation.',
                'xp_awarded' => 100,
            ];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public static function getReport(string $userId, string $challengeId): array
    {
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare(
            "SELECT r.id AS run_id, r.evaluation_state, r.completed_at,
                    s.id AS submission_id, s.user_id, s.answer_text,
                    sc.financial_mechanics, sc.risk_management, sc.historical_alignment, sc.communication,
                    sc.explanation, sc.evidence,
                    c.commitment_minor, i.name AS industry_name, scn.title AS scenario_title
             FROM evaluation_runs r
             JOIN boardroom_challenges c ON r.challenge_id = c.id
             JOIN industries i ON c.industry_id = i.id
             JOIN boardroom_scenarios scn ON c.scenario_id = scn.id
             JOIN boardroom_submissions s ON c.id = s.challenge_id AND s.user_id = :uid
             LEFT JOIN evaluation_scores sc ON r.id = sc.run_id AND s.id = sc.submission_id
             WHERE c.id = :cid
             ORDER BY r.created_at DESC LIMIT 1"
        );
        $stmt->execute([':uid' => $userId, ':cid' => $challengeId]);
        $row = $stmt->fetch();

        if (!$row) {
            return [
                'status' => 'pending',
                'message' => 'Evaluation in progress. The Strategic Adjudication Council is assessing your memo.',
            ];
        }

        // Check if this is a 2-player match and the opponent has not yet submitted
        $cStmt = $pdo->prepare("SELECT host_id, opponent_id, deadline_at, state, duration_minutes FROM boardroom_challenges WHERE id = ?");
        $cStmt->execute([$challengeId]);
        $chg = $cStmt->fetch();

        $hasOpponent = !empty($chg['opponent_id']);
        if ($hasOpponent && $chg['state'] === 'live') {
            $subCount = (int)$pdo->query("SELECT COUNT(DISTINCT user_id) FROM boardroom_submissions WHERE challenge_id = '{$challengeId}'")->fetchColumn();
            $now = time();
            $deadlineTs = !empty($chg['deadline_at']) ? strtotime((string)$chg['deadline_at']) : 0;
            $secondsRemaining = max(0, $deadlineTs - $now);

            // If opponent hasn't submitted and deadline hasn't expired
            if ($subCount < 2 && $secondsRemaining > 0) {
                return [
                    'status' => 'waiting_for_opponent',
                    'challenge_id' => $challengeId,
                    'scenario_title' => $row['scenario_title'] ?? 'Strategic Memorandum',
                    'industry' => $row['industry_name'] ?? 'Economics',
                    'seconds_remaining' => $secondsRemaining,
                    'deadline_at' => $chg['deadline_at'],
                    'deadline_at_iso' => $deadlineTs > 0 ? gmdate('Y-m-d\TH:i:s\Z', $deadlineTs) : null,
                    'message' => 'Your memorandum is securely submitted. Awaiting opponent submission or response window deadline.',
                ];
            }
        }

        // Auto-adjudicate instantly on demand if still queued (zero-delay user experience)
        if ($row['evaluation_state'] === 'queued') {
            try {
                if (self::evaluateSingleRun($row['run_id'])) {
                    $stmt->execute([':uid' => $userId, ':cid' => $challengeId]);
                    $row = $stmt->fetch() ?: $row;
                }
            } catch (\Throwable $e) {}
        }

        $isComplete = $row['evaluation_state'] === 'complete' && $row['financial_mechanics'] !== null;
        $totalScore = $isComplete
            ? (float)$row['financial_mechanics'] + (float)$row['risk_management'] + (float)$row['historical_alignment'] + (float)$row['communication']
            : null;

        return [
            'status' => $row['evaluation_state'],
            'scenario_title' => $row['scenario_title'],
            'industry' => $row['industry_name'],
            'completed_at' => $row['completed_at'],
            'scores' => $isComplete ? [
                'financial_mechanics' => (float)$row['financial_mechanics'],
                'risk_management' => (float)$row['risk_management'],
                'historical_alignment' => (float)$row['historical_alignment'],
                'communication' => (float)$row['communication'],
                'total' => round($totalScore, 1),
            ] : null,
            'explanation' => $row['explanation'],
            'evidence' => !empty($row['evidence']) ? json_decode((string)$row['evidence'], true) : null,
        ];
    }

    public static function processQueuedEvaluations(int $limit = 5): array
    {
        $pdo = Database::getConnection();
        $query = "
            SELECT r.id AS run_id, r.challenge_id,
                   s.id AS submission_id, s.user_id, s.answer_text,
                   scn.title AS scenario_title, scn.confidential_body
            FROM evaluation_runs r
            JOIN boardroom_challenges c ON r.challenge_id = c.id
            JOIN boardroom_submissions s ON c.id = s.challenge_id
            JOIN boardroom_scenarios scn ON c.scenario_id = scn.id
            WHERE r.evaluation_state = 'queued'
            ORDER BY r.created_at ASC
            LIMIT {$limit}
        ";
        $stmt = $pdo->query($query);
        $queued = $stmt->fetchAll();

        $processed = 0;
        foreach ($queued as $row) {
            if (self::evaluateSingleRun($row['run_id'])) {
                $processed++;
            }
        }

        return ['evaluated_memos_count' => $processed];
    }

    public static function evaluateSingleRun(string $runId): bool
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("
            SELECT r.id AS run_id, r.challenge_id, r.model_id,
                   s.id AS submission_id, s.user_id, s.answer_text,
                   scn.title AS scenario_title, scn.confidential_body
            FROM evaluation_runs r
            JOIN boardroom_challenges c ON r.challenge_id = c.id
            JOIN boardroom_submissions s ON c.id = s.challenge_id
            JOIN boardroom_scenarios scn ON c.scenario_id = scn.id
            WHERE r.id = ? AND r.evaluation_state = 'queued'
            LIMIT 1
        ");
        $stmt->execute([$runId]);
        $row = $stmt->fetch();
        if (!$row) {
            return false;
        }

        $scores = self::evaluateWithNvidiaNim(
            $row['scenario_title'],
            $row['confidential_body'],
            $row['answer_text']
        );

        $insScore = $pdo->prepare("
            INSERT INTO evaluation_scores 
                (run_id, submission_id, financial_mechanics, risk_management, historical_alignment, communication, explanation, evidence)
            VALUES 
                (:rid, :sid, :fm, :rm, :ha, :cm, :exp, :ev)
            ON DUPLICATE KEY UPDATE
                financial_mechanics = VALUES(financial_mechanics),
                risk_management = VALUES(risk_management),
                historical_alignment = VALUES(historical_alignment),
                communication = VALUES(communication),
                explanation = VALUES(explanation),
                evidence = VALUES(evidence)
        ");
        $insScore->execute([
            ':rid' => $row['run_id'],
            ':sid' => $row['submission_id'],
            ':fm' => $scores['financial_mechanics'],
            ':rm' => $scores['risk_management'],
            ':ha' => $scores['historical_alignment'],
            ':cm' => $scores['communication'],
            ':exp' => $scores['explanation'],
            ':ev' => json_encode($scores['evidence']),
        ]);

        // Check if admin review mode is enabled
        $gradingMode = 'ai';
        try {
            $modeSetting = $pdo->query("SELECT value FROM platform_settings WHERE `key` = 'boardroom_grading_mode' LIMIT 1")->fetchColumn();
            if ($modeSetting) $gradingMode = trim($modeSetting);
        } catch (\Throwable $e) {}

        if ($gradingMode === 'admin_review') {
            // Hold run in pending_review so admin can inspect, correct, and train AI
            $upRun = $pdo->prepare("UPDATE evaluation_runs SET evaluation_state = 'pending_review', model_id = :model WHERE id = :rid");
            $upRun->execute([':model' => $scores['model_used'] ?? 'NVIDIA NIM', ':rid' => $row['run_id']]);

            $upC = $pdo->prepare("UPDATE boardroom_challenges SET state = 'evaluating' WHERE id = ?");
            $upC->execute([$row['challenge_id']]);
            return true;
        }

        // Autonomous AI mode: complete immediately and settle challenge
        $upRun = $pdo->prepare("UPDATE evaluation_runs SET evaluation_state = 'complete', model_id = :model, completed_at = NOW(3) WHERE id = :rid");
        $upRun->execute([':model' => $scores['model_used'] ?? 'NVIDIA NIM', ':rid' => $row['run_id']]);

        // Settle challenge and distribute escrowed pot
        self::settleChallengeWithScores($row['challenge_id']);

        return true;
    }

    public static function checkNonsenseOrIrrelevant(string $answer, string $title = '', string $body = ''): ?array
    {
        $clean = trim($answer);
        $len = mb_strlen($clean);
        $words = preg_split('/\s+/', $clean);
        $wordCount = count($words);
        $lower = strtolower($clean);

        // 1. Minimum length & word threshold: less than 15 words cannot form an executive strategy
        if ($len < 30 || $wordCount < 10) {
            return [
                'financial_mechanics' => 0.0,
                'risk_management' => 0.0,
                'historical_alignment' => 0.0,
                'communication' => 0.0,
                'is_invalid' => true,
                'explanation' => 'Evaluation Score: 0/100. Submission rejected: The response contains fewer than 10 words and fails to provide substantive strategic or financial reasoning for this executive dilemma.',
                'evidence' => [
                    'Failed minimum response length threshold (minimum 10 words required)',
                    'No quantitative or working capital calculations provided',
                    'Zero points awarded across all criteria'
                ],
                'model_used' => 'Executive Strategic Standards Guard',
            ];
        }

        // 2. Character repetition / keyboard smash (e.g. "aaaaaa", "asdfasdf", "zzzzzz")
        if (preg_match('/(.)\1{4,}/i', $clean) || preg_match('/^(asdf|qwerty|zxcv|1234|test)+/i', $clean)) {
            return [
                'financial_mechanics' => 0.0,
                'risk_management' => 0.0,
                'historical_alignment' => 0.0,
                'communication' => 0.0,
                'is_invalid' => true,
                'explanation' => 'Evaluation Score: 0/100. Submission rejected: Coherent analysis was not detected. The text contains repeated characters, keyboard mashing, or artificial fill patterns.',
                'evidence' => [
                    'Incoherent text pattern detected',
                    'Fails executive communication integrity standards',
                    'Zero points awarded across all criteria'
                ],
                'model_used' => 'Executive Strategic Standards Guard',
            ];
        }

        // 3. Repeated word flood (e.g. "money money money money money")
        $wordCounts = array_count_values(array_map('strtolower', $words));
        if (!empty($wordCounts)) {
            $maxOccur = max($wordCounts);
            if ($maxOccur / $wordCount > 0.40 && $wordCount > 15) {
                return [
                    'financial_mechanics' => 0.0,
                    'risk_management' => 0.0,
                    'historical_alignment' => 0.0,
                    'communication' => 0.0,
                    'is_invalid' => true,
                    'explanation' => 'Evaluation Score: 0/100. Submission rejected: Repetitive word looping detected without substantive analytical structure.',
                    'evidence' => [
                        'Repetitive word density exceeds acceptable threshold',
                        'No differentiated corporate strategy provided',
                        'Zero points awarded across all criteria'
                    ],
                    'model_used' => 'Executive Strategic Standards Guard',
                ];
            }
        }

        // 4. Domain relevance check: must contain at least 2 relevant business / economic terms
        $businessTerms = [
            'runway', 'burn', 'cash', 'liquidity', 'margin', 'revenue', 'cost', 'opex', 'capex',
            'debt', 'equity', 'bridge', 'loan', 'safe', 'invest', 'investor', 'stake', 'capital',
            'customer', 'client', 'merchant', 'offtaker', 'supplier', 'vendor', 'contract',
            'discount', 'price', 'pricing', 'tariff', 'power', 'diesel', 'fuel', 'transport', 'haulage',
            'port', 'demurrage', 'customs', 'fx', 'dollar', 'naira', 'devaluation', 'hedg', 'reserve',
            'inventory', 'working capital', 'receivable', 'payable', 'bank', 'interest', 'mpr', 'crr',
            'mitigat', 'risk', 'contingency', 'buffer', 'milestone', 'strategy', 'plan', 'action', 'cut'
        ];

        $matchedTerms = 0;
        foreach ($businessTerms as $term) {
            if (str_contains($lower, $term)) {
                $matchedTerms++;
            }
        }

        if ($matchedTerms < 2) {
            return [
                'financial_mechanics' => 0.0,
                'risk_management' => 0.0,
                'historical_alignment' => 0.0,
                'communication' => 0.0,
                'is_invalid' => true,
                'explanation' => 'Evaluation Score: 0/100. Submission rejected: Off-topic or non-economic content. The response does not address the financial dilemma, corporate mechanics, or operational variables presented in this boardroom scenario.',
                'evidence' => [
                    'Response lacks relevant financial or strategic business terminology',
                    'Failed to engage with the quantitative dilemma constraints',
                    'Zero points awarded across all criteria'
                ],
                'model_used' => 'Executive Strategic Standards Guard',
            ];
        }

        return null; // Valid submission to be graded
    }

    public static function evaluateWithNvidiaNim(string $title, string $body, string $answer): array
    {
        // 1. First run strict zero-tolerance nonsense / relevance filter
        $invalidResult = self::checkNonsenseOrIrrelevant($answer, $title, $body);
        if ($invalidResult !== null) {
            return $invalidResult;
        }

        $apiKey = (string)Env::get('NVIDIA_API_KEY', '');
        if (!empty($apiKey)) {
            $pdo = Database::getConnection();
            $model = 'meta/llama-3.1-70b-instruct';
            try {
                $s = $pdo->query("SELECT value FROM platform_settings WHERE `key` = 'active_ai_model' LIMIT 1")->fetchColumn();
                if ($s) $model = trim($s);
            } catch (\Throwable $e) {}

            $prompt = "You are the Senior Lead Strategic Adjudicator for the EconSim executive financial terminal.
Evaluate the following participant strategy memo against the strategic boardroom dilemma.

### Scenario: {$title}
### Confidential Dilemma Details:
{$body}

### Participant Strategy Memo:
{$answer}

CRITICAL ADJUDICATION RULES:
1. Strict Grading Standard: Do NOT award free participation points. Scores must be earned from 0 upwards based on concrete strategic merit.
2. Zero-Tolerance for Nonsense or Off-Topic: If the response is spam, trivial, a joke, generic filler, or fails to directly address the specific financial dilemma, YOU MUST ASSIGN 0.0 TO ALL CRITERIA (Total: 0/100).
3. Evaluate against this 4-part executive rubric:
   - Financial Mechanics (0-40 points): Precise cash calculations, unit economics, working capital, debt servicing, runway numbers.
   - Downside Risk Management (0-30 points): Specific vulnerability identification, downside hedging, operational contingencies, cash buffers.
   - Historical Precedent Alignment (0-20 points): Nigerian / emerging market macroeconomic reality (FX volatility, fuel deregulation, inflation pass-through, CRR impacts).
   - Executive Communication (0-10 points): Clarity, structured actionable recommendations, board-level executive tone.

Respond ONLY with valid JSON in this exact structure:
{
  \"financial_mechanics\": 28.5,
  \"risk_management\": 21.0,
  \"historical_alignment\": 14.5,
  \"communication\": 7.5,
  \"explanation\": \"Concise board-level assessment detailing strengths, quantitative trade-offs, and operational vulnerabilities.\",
  \"evidence\": [\"Key financial mechanics point\", \"Key risk mitigation finding\", \"Recommended strategic milestone\"]
}";

            $url = (string)Env::get('NVIDIA_NIM_BASE_URL', 'https://integrate.api.nvidia.com/v1') . '/chat/completions';
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => json_encode([
                    'model' => $model,
                    'messages' => [
                        ['role' => 'system', 'content' => 'You are an elite, rigorous corporate strategy adjudicator. Output valid JSON only.'],
                        ['role' => 'user', 'content' => $prompt]
                    ],
                    'temperature' => 0.1,
                    'max_tokens' => 1024,
                ]),
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    "Authorization: Bearer {$apiKey}"
                ],
                CURLOPT_TIMEOUT => 20,
                CURLOPT_SSL_VERIFYPEER => false,
            ]);
            $resRaw = curl_exec($ch);
            $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($status >= 200 && $status < 300 && !empty($resRaw)) {
                $decoded = json_decode($resRaw, true);
                $content = $decoded['choices'][0]['message']['content'] ?? '';
                if (preg_match('/\{[\s\S]*\}/', $content, $m)) {
                    $parsed = json_decode($m[0], true);
                    if ($parsed && isset($parsed['financial_mechanics'])) {
                        return [
                            'financial_mechanics' => max(0.0, min(40.0, (float)$parsed['financial_mechanics'])),
                            'risk_management' => max(0.0, min(30.0, (float)($parsed['risk_management'] ?? 0.0))),
                            'historical_alignment' => max(0.0, min(20.0, (float)($parsed['historical_alignment'] ?? 0.0))),
                            'communication' => max(0.0, min(10.0, (float)($parsed['communication'] ?? 0.0))),
                            'explanation' => (string)($parsed['explanation'] ?? 'Executive evaluation completed.'),
                            'evidence' => is_array($parsed['evidence'] ?? null) ? $parsed['evidence'] : ['Evaluated via Executive Strategy Rubric.'],
                            'model_used' => $model,
                        ];
                    }
                }
            }
        }

        // Fallback to strict deterministic heuristic rubric
        return self::evaluateHeuristically($answer, $title, $body);
    }

    public static function evaluateHeuristically(string $answer, string $title = '', string $body = ''): array
    {
        // 1. Strict zero-tolerance check
        $invalid = self::checkNonsenseOrIrrelevant($answer, $title, $body);
        if ($invalid !== null) {
            return $invalid;
        }

        $text = strtolower($answer);
        $words = str_word_count($answer);

        // All scores start strictly at ZERO and must be earned from actual substance!
        $finScore = 0.0;
        $riskScore = 0.0;
        $histScore = 0.0;
        $commScore = 0.0;

        // 1. Financial Mechanics (0 - 40)
        // A. Specific numerical analysis or currency metrics (up to +12)
        if (preg_match('/(₦|\$|%|\b\d+(\.\d+)?\s*(m|b|million|billion|k|bps|percent)\b)/i', $answer)) {
            $finScore += 7.0;
        }
        if (preg_match_all('/\d+/', $answer) >= 3) {
            $finScore += 5.0;
        }
        // B. Cash flow, runway, burn rate, liquidity analysis (up to +12)
        $cashHits = 0;
        foreach (['runway', 'burn', 'cash flow', 'liquidity', 'working capital', 'payables', 'receivables', 'deficit'] as $k) {
            if (str_contains($text, $k)) $cashHits++;
        }
        $finScore += min(12.0, $cashHits * 3.5);
        // C. Cost restructuring, CapEx/OpEx, pricing or unit margin (up to +10)
        $costHits = 0;
        foreach (['opex', 'capex', 'margin', 'revenue', 'cost reduction', 'overhead', 'renegotiat', 'pricing', 'surcharge'] as $k) {
            if (str_contains($text, $k)) $costHits++;
        }
        $finScore += min(10.0, $costHits * 3.0);
        // D. Capital structuring / bridge financing (up to +6)
        foreach (['debt', 'equity', 'bridge', 'safe', 'warrant', 'interest rate', 'factoring', 'overdraft'] as $k) {
            if (str_contains($text, $k)) { $finScore += 6.0; break; }
        }
        $finScore = min(40.0, $finScore);

        // 2. Downside Risk Management (0 - 30)
        // A. Identification of key risks (up to +12)
        $riskHits = 0;
        foreach (['counterparty', 'default', 'churn', 'delay', 'outage', 'bottleneck', 'concentration', 'volatilit'] as $k) {
            if (str_contains($text, $k)) $riskHits++;
        }
        $riskScore += min(12.0, $riskHits * 4.0);
        // B. Mitigation triggers, buffers, substitutes, hedges (up to +12)
        $mitHits = 0;
        foreach (['mitigat', 'contingency', 'buffer', 'hedge', 'reserve', 'substitute', 'covenant', 'trigger', 'force majeure'] as $k) {
            if (str_contains($text, $k)) $mitHits++;
        }
        $riskScore += min(12.0, $mitHits * 4.0);
        // C. Governance / worst-case preservation (+6)
        if (str_contains($text, 'worst-case') || str_contains($text, 'scenario') || str_contains($text, 'governance') || str_contains($text, 'compliance')) {
            $riskScore += 6.0;
        }
        $riskScore = min(30.0, $riskScore);

        // 3. Historical Precedent Alignment (0 - 20)
        // A. Nigerian / African macroeconomic realities (+10)
        $macroHits = 0;
        foreach (['fx', 'dollar', 'naira', 'devaluation', 'inflation', 'subsidy', 'tariff', 'band-a', 'cbn', 'mpr', 'deregulat', 'import'] as $k) {
            if (str_contains($text, $k)) $macroHits++;
        }
        $histScore += min(10.0, $macroHits * 3.5);
        // B. Strategic trade-offs & phased priorities (+10)
        if (str_contains($text, 'trade-off') || str_contains($text, 'priorit') || str_contains($text, 'first') || str_contains($text, 'phase') || str_contains($text, 'milestone')) {
            $histScore += 10.0;
        }
        $histScore = min(20.0, $histScore);

        // 4. Executive Communication (0 - 10)
        if ($words >= 50) $commScore += 2.0;
        if ($words >= 90) $commScore += 2.5;
        if ($words >= 140) $commScore += 1.5;
        if (str_contains($answer, "\n") || str_contains($text, '1.') || str_contains($text, '- ') || str_contains($text, '•')) {
            $commScore += 2.5;
        }
        if (str_contains($text, 'recommend') || str_contains($text, 'executive') || str_contains($text, 'board') || str_contains($text, 'direct')) {
            $commScore += 1.5;
        }
        $commScore = min(10.0, $commScore);

        $total = round($finScore + $riskScore + $histScore + $commScore, 1);

        return [
            'financial_mechanics' => round($finScore, 1),
            'risk_management' => round($riskScore, 1),
            'historical_alignment' => round($histScore, 1),
            'communication' => round($commScore, 1),
            'explanation' => $total >= 60.0
                ? "Thorough executive analysis. Memo demonstrates sound understanding of cash constraints, downside risks, and actionable operational sequencing."
                : ($total >= 30.0
                    ? "Developing strategic proposal. Identified primary dilemma tensions, but requires deeper quantitative grounding and more robust downside hedging."
                    : "Partial submission. High-level thoughts offered, but lacks detailed financial calculations and actionable risk mitigation mechanisms."),
            'evidence' => [
                'Quantitative working capital and cash impact evaluation',
                'Identification of operational downside vulnerabilities and counterparty risks',
                'Strategic execution milestones structured under emerging market macro constraints'
            ],
            'model_used' => 'EconSim Strategic Adjudication Engine v2',
        ];
    }

    public static function settleChallengeWithScores(string $challengeId): void
    {
        $pdo = Database::getConnection();
        $scores = $pdo->prepare("
            SELECT s.user_id, (sc.financial_mechanics + sc.risk_management + sc.historical_alignment + sc.communication) as total_score
            FROM boardroom_submissions s
            JOIN evaluation_scores sc ON s.id = sc.submission_id
            WHERE s.challenge_id = ?
            ORDER BY total_score DESC
        ");
        $scores->execute([$challengeId]);
        $rows = $scores->fetchAll();

        if (empty($rows)) {
            $pdo->prepare("UPDATE boardroom_challenges SET state = 'settled' WHERE id = ?")->execute([$challengeId]);
            return;
        }

        // Check if this was a solo match against Institutional AI Benchmark (no human opponent)
        $chgStmt = $pdo->prepare("SELECT host_id, opponent_id FROM boardroom_challenges WHERE id = ?");
        $chgStmt->execute([$challengeId]);
        $chg = $chgStmt->fetch();
        $isSoloBenchmark = empty($chg['opponent_id']);

        if ($isSoloBenchmark) {
            $userScore = (float)$rows[0]['total_score'];
            // 70/100 passing bar
            if ($userScore >= 70.0) {
                // Award Conqueror XP bonus
                try {
                    $xp = $pdo->prepare(
                        "INSERT IGNORE INTO xp_events (id, user_id, xp, reason, source_key, created_at)
                         VALUES (:id, :uid, 250, 'Conquered Institutional AI Benchmark (Score >= 70)', :skey, NOW(3))"
                    );
                    $xp->execute([
                        ':id' => Security::uuid(),
                        ':uid' => $rows[0]['user_id'],
                        ':skey' => "xp_benchmark_win_{$challengeId}",
                    ]);
                } catch (\Throwable $e) {}

                self::settleChallenge($challengeId, $rows[0]['user_id'], "Surpassed Institutional AI Benchmark (Scored {$userScore}/100)");
            } else {
                self::settleChallenge($challengeId, 'benchmark_ai', "Fell short of Institutional Benchmark standard (Scored {$userScore}/100, needed 70)");
            }
            return;
        }

        $winnerId = $rows[0]['user_id'];
        self::settleChallenge($challengeId, $winnerId, "Scored {$rows[0]['total_score']}/100");
    }

    public static function checkAndDispatchScheduledNotifications(bool $force = false): array
    {
        $now = time();
        if (!$force && ($now - self::$lastNotificationDispatchTime < 20)) {
            return [
                '5min_warnings' => 0,
                'started_alerts' => 0,
            ];
        }
        self::$lastNotificationDispatchTime = $now;

        $pdo = Database::getConnection();
        $dispatched = [
            '5min_warnings' => 0,
            'started_alerts' => 0,
        ];

        // 1. Proactive 5-Minute Warning: Match starts in <= 5 minutes and > 0 minutes
        $stmt5 = $pdo->query(
            "SELECT c.id, c.host_id, c.opponent_id, c.scheduled_at, c.duration_minutes, i.name AS industry_name
             FROM boardroom_challenges c
             JOIN industries i ON c.industry_id = i.id
             WHERE c.state IN ('open', 'matched', 'scheduled')
               AND c.notified_5min = 0
               AND c.scheduled_at > NOW()
               AND c.scheduled_at <= DATE_ADD(NOW(), INTERVAL 5 MINUTE)"
        );
        $warnChallenges = $stmt5->fetchAll(PDO::FETCH_ASSOC);

        foreach ($warnChallenges as $row) {
            $mins = max(1, (int)ceil((strtotime((string)$row['scheduled_at']) - time()) / 60));
            $title = "🏛️ Boardroom Match in {$mins} Minutes!";
            $msg = "Your {$row['industry_name']} boardroom match begins in {$mins} minutes. Step into the waiting lounge to prepare.";

            NotificationService::dispatch($row['host_id'], $title, $msg, 'boardroom_waiting_room', $row['id']);
            if (!empty($row['opponent_id'])) {
                NotificationService::dispatch($row['opponent_id'], $title, $msg, 'boardroom_waiting_room', $row['id']);
            }

            $up = $pdo->prepare("UPDATE boardroom_challenges SET notified_5min = 1 WHERE id = ?");
            $up->execute([$row['id']]);
            $dispatched['5min_warnings']++;
        }

        // 2. Proactive Match Start Alert: Match time has arrived (scheduled_at <= NOW())
        $stmtStart = $pdo->query(
            "SELECT c.id, c.host_id, c.opponent_id, c.scheduled_at, c.duration_minutes, i.name AS industry_name
             FROM boardroom_challenges c
             JOIN industries i ON c.industry_id = i.id
             WHERE c.state IN ('open', 'matched', 'scheduled')
               AND c.scheduled_at <= NOW()
               AND c.notified_started = 0"
        );
        $startChallenges = $stmtStart->fetchAll(PDO::FETCH_ASSOC);

        foreach ($startChallenges as $row) {
            $duration = (int)$row['duration_minutes'];

            if (!empty($row['opponent_id'])) {
                // Opponent is locked in: start match immediately!
                $upLive = $pdo->prepare(
                    "UPDATE boardroom_challenges 
                     SET state = 'live', start_at = NOW(3), 
                         deadline_at = DATE_ADD(NOW(3), INTERVAL :dur MINUTE),
                         notified_started = 1
                     WHERE id = :cid AND state IN ('open', 'matched', 'scheduled')"
                );
                $upLive->execute([':dur' => $duration, ':cid' => $row['id']]);

                $title = "🏛️ Boardroom Match Started! Dilemma Unsealed";
                $msg = "The {$row['industry_name']} dilemma is unsealed! You have {$duration} minutes to submit your executive strategy memo.";

                NotificationService::dispatch($row['host_id'], $title, $msg, 'live_challenge', $row['id']);
                NotificationService::dispatch($row['opponent_id'], $title, $msg, 'live_challenge', $row['id']);
            } else {
                // Still waiting for an opponent: inform host that scheduled time has arrived
                $upOpen = $pdo->prepare("UPDATE boardroom_challenges SET notified_started = 1 WHERE id = ?");
                $upOpen->execute([$row['id']]);

                $title = "🏛️ Match Scheduled Time Arrived";
                $msg = "Your {$row['industry_name']} match time has arrived! Awaiting an opponent in the lobby.";
                NotificationService::dispatch($row['host_id'], $title, $msg, 'boardroom_lobby', $row['id']);
            }

            $dispatched['started_alerts']++;
        }

        return $dispatched;
    }

    public static function continuousScenarioIngestion(int $maxPerCycle = 1): array
    {
        $pdo = Database::getConnection();
        $ingested = [];

        try {
            $apiKey = (string)Env::get('NVIDIA_API_KEY', '');
            if (empty($apiKey)) {
                return $ingested;
            }

            // 1. Fetch live breaking headlines
            $liveHeadlines = PredictorService::fetchLiveMacroHeadlines(3);
            if (empty($liveHeadlines)) {
                return $ingested;
            }

            $industries = $pdo->query("
                SELECT i.id, i.slug, i.name, COUNT(bs.id) as scenario_cnt
                FROM industries i
                LEFT JOIN boardroom_scenarios bs ON i.id = bs.industry_id
                GROUP BY i.id, i.slug, i.name
                ORDER BY scenario_cnt ASC
            ")->fetchAll(PDO::FETCH_ASSOC);

            $added = 0;
            foreach ($liveHeadlines as $headline) {
                if ($added >= $maxPerCycle) {
                    break;
                }

                // Check if a scenario based on this headline already exists
                $chk = $pdo->prepare("SELECT id FROM boardroom_scenarios WHERE confidential_body LIKE ? LIMIT 1");
                $chk->execute(['%' . substr($headline, 0, 40) . '%']);
                if ($chk->fetch()) {
                    continue;
                }

                $lowestSlug = $industries[0]['slug'] ?? 'fintech';
                $slugsList = implode(', ', array_column($industries, 'slug'));

                $prompt = "You are the Lead Executive Strategy Case Designer for EconSim.
Based on this real-world macroeconomic headline: \"{$headline}\",
formulate 1 SHARP, BITE-SIZED, SINGLE-OBJECTIVE boardroom dilemma for a corporate executive (CFO/COO/CEO).
Available industry slugs: [{$slugsList}]. Target industry: '{$lowestSlug}'.

CRITICAL SPECIFICATIONS:
1. SINGLE FOCUSED PROBLEM: Do NOT create 3 or 4 complex sub-tasks. Focus on ONE concrete crisis or trade-off (e.g. 72-hour cash burn, FX contract rollover, tariff hike, raw material port hold, power cost surge).
2. CONCRETE NUMBERS: Include explicit figures (e.g. ₦X million burn, Y% cost surge, Z days deadline).
3. PUNCHY DIRECTIVE: Conclude with 1 clear Executive Directive presenting 2 distinct strategic alternatives (Option A vs Option B).

Respond ONLY with valid JSON:
{
  \"industry_slug\": \"{$lowestSlug}\",
  \"title\": \"Punchy 6-12 word dilemma title\",
  \"body\": \"1 short backstory paragraph with figures + Executive Directive with Option A and Option B\",
  \"reference\": {
    \"company\": \"Relevant enterprise name or sector cluster\",
    \"precedent\": \"Historical emerging market or Nigerian business case\"
  },
  \"difficulty\": \"intermediate\"
}";

                $postData = [
                    'model' => 'meta/llama-3.1-70b-instruct',
                    'messages' => [
                        ['role' => 'system', 'content' => 'You design sharp, single-objective executive business dilemmas. Return valid JSON only.'],
                        ['role' => 'user', 'content' => $prompt],
                    ],
                    'temperature' => 0.25,
                    'max_tokens' => 896,
                ];

                $ch = curl_init("https://integrate.api.nvidia.com/v1/chat/completions");
                curl_setopt_array($ch, [
                    CURLOPT_POST => true,
                    CURLOPT_POSTFIELDS => json_encode($postData),
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_HTTPHEADER => [
                        'Content-Type: application/json',
                        "Authorization: Bearer {$apiKey}",
                    ],
                    CURLOPT_TIMEOUT => 15,
                    CURLOPT_SSL_VERIFYPEER => false,
                ]);
                $res = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);

                if ($httpCode === 200 && $res) {
                    $data = json_decode($res, true);
                    $content = $data['choices'][0]['message']['content'] ?? '';
                    if (preg_match('/\{.*\}/s', $content, $m)) {
                        $parsed = json_decode($m[0], true);
                        if (!empty($parsed['title']) && !empty($parsed['body'])) {
                            // Find target industry ID
                            $targetSlug = $parsed['industry_slug'] ?? $lowestSlug;
                            $targetIndId = (int)($industries[0]['id'] ?? 1);
                            foreach ($industries as $ind) {
                                if ($ind['slug'] === $targetSlug) {
                                    $targetIndId = (int)$ind['id'];
                                    break;
                                }
                            }

                            $scId = Security::uuid();
                            $rubricJson = json_encode(['financial_mechanics' => 40, 'risk_management' => 30, 'historical_alignment' => 20, 'communication' => 10]);
                            $refJson = json_encode($parsed['reference'] ?? ['company' => 'Corporate Enterprise', 'precedent' => 'Live market macroeconomic disruption.']);

                            $ins = $pdo->prepare("
                                INSERT INTO boardroom_scenarios 
                                    (id, industry_id, title, confidential_body, reference_case, rubric, difficulty, created_at)
                                VALUES 
                                    (:id, :ind, :title, :body, :ref, :rubric, :diff, NOW(3))
                            ");
                            $ins->execute([
                                ':id' => $scId,
                                ':ind' => $targetIndId,
                                ':title' => $parsed['title'],
                                ':body' => $parsed['body'],
                                ':ref' => $refJson,
                                ':rubric' => $rubricJson,
                                ':diff' => $parsed['difficulty'] ?? 'intermediate',
                            ]);

                            $added++;
                            $ingested[] = [
                                'industry' => $targetSlug,
                                'title' => $parsed['title'],
                                'origin' => 'live_news_scanner',
                            ];
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
            // Non-blocking
        }

        return $ingested;
    }
}

