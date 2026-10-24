<?php

declare(strict_types=1);

namespace App\Services;

use App\Config\Database;
use App\Utils\Security;
use PDO;
use RuntimeException;

class BoardroomService
{
    public static function getLobbyChallenges(?string $industrySlug = null): array
    {
        $pdo = Database::getConnection();

        $sql = "
            SELECT c.id, c.mode, c.commitment_minor, c.scheduled_at, c.duration_minutes,
                   c.state, i.name AS industry_name, i.slug AS industry_slug,
                   u.display_name AS host_name
            FROM boardroom_challenges c
            JOIN industries i ON c.industry_id = i.id
            JOIN users u ON c.host_id = u.id
            WHERE c.state IN ('open', 'matched')
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

        return array_map(function ($r) {
            return [
                'id' => $r['id'],
                'industry' => $r['industry_name'],
                'industry_slug' => $r['industry_slug'],
                'host' => $r['host_name'],
                'commitment' => (int)($r['commitment_minor'] / 100),
                'scheduled_at' => $r['scheduled_at'],
                'duration' => (int)$r['duration_minutes'],
                'mode' => $r['mode'] ?? 'demo',
                'state' => $r['state'],
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
                    (id, host_id, industry_id, scenario_id, mode, commitment_minor, scheduled_at, duration_minutes, state, created_at)
                 VALUES 
                    (:id, :uid, :ind, :sc, :mode, :amt, :sched, :dur, 'open', NOW(3))"
            );
            $stmt->execute([
                ':id' => $challengeId,
                ':uid' => $userId,
                ':ind' => $industryId,
                ':sc' => $scenarioId,
                ':mode' => $normalizedMode,
                ':amt' => $commitmentMinor,
                ':sched' => $scheduledAt,
                ':dur' => $durationMinutes,
            ]);

            // Add participant
            $part = $pdo->prepare(
                "INSERT INTO boardroom_participants (challenge_id, user_id, joined_at, commitment_held_at)
                 VALUES (:cid, :uid, NOW(3), NOW(3))"
            );
            $part->execute([':cid' => $challengeId, ':uid' => $userId]);

            $pdo->commit();

            return [
                'challenge_id' => $challengeId,
                'state' => 'open',
                'mode' => $normalizedMode,
                'commitment' => $commitmentAmount,
                'duration' => $durationMinutes,
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
            if ($challenge['state'] !== 'open') {
                throw new RuntimeException("This challenge is no longer open for opponents.");
            }
            if ($challenge['host_id'] === $userId) {
                throw new RuntimeException("You cannot join your own challenge as an opponent.");
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

            // Match and start with strict conditional check
            $up = $pdo->prepare(
                "UPDATE boardroom_challenges 
                 SET opponent_id = :uid, state = 'live', start_at = NOW(3), 
                     deadline_at = DATE_ADD(NOW(3), INTERVAL :dur MINUTE)
                 WHERE id = :cid AND state = 'open'"
            );
            $up->execute([
                ':uid' => $userId,
                ':dur' => $duration,
                ':cid' => $challengeId,
            ]);

            if ($up->rowCount() !== 1) {
                throw new RuntimeException("Challenge was already accepted by another executive.");
            }

            $part = $pdo->prepare(
                "INSERT INTO boardroom_participants (challenge_id, user_id, joined_at, commitment_held_at)
                 VALUES (:cid, :uid, NOW(3), NOW(3))"
            );
            $part->execute([':cid' => $challengeId, ':uid' => $userId]);

            $pdo->commit();

            return [
                'challenge_id' => $challengeId,
                'state' => 'live',
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
            }

            if ($opponentId) {
                $isWinner = ($opponentId === $winnerUserId);
                $returnMinor = $isWinner ? ($heldMinor * 2) : 0;
                LedgerService::settleCommitment($opponentId, $heldMinor, $returnMinor, 'boardroom_resolution', $challengeId, "br_settle_opp_{$challengeId}", $mode);
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
                 deadline_at = DATE_ADD(NOW(3), INTERVAL duration_minutes MINUTE)
             WHERE id = ? AND host_id = ?"
        );
        $up->execute([$challengeId, $userId]);

        return ['challenge_id' => $challengeId, 'state' => 'live'];
    }

    public static function getChallengeDetails(string $userId, string $challengeId): array
    {
        $pdo = Database::getConnection();

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

        // Scenario confidentiality: Only reveal scenario when challenge is 'live', 'evaluating', or 'settled'
        $isLiveOrCompleted = in_array($c['state'], ['live', 'evaluating', 'settled', 'disputed'], true);

        // Fetch user submission if already submitted
        $subStmt = $pdo->prepare("SELECT * FROM boardroom_submissions WHERE challenge_id = ? AND user_id = ?");
        $subStmt->execute([$challengeId, $userId]);
        $userSub = $subStmt->fetch();

        return [
            'id' => $c['id'],
            'state' => $c['state'],
            'industry' => $c['industry_name'],
            'host_name' => $c['host_name'],
            'opponent_name' => $c['opponent_name'] ?? 'Demo Opponent',
            'commitment' => (int)($c['commitment_minor'] / 100),
            'start_at' => $c['start_at'],
            'deadline_at' => $c['deadline_at'],
            'duration_minutes' => (int)$c['duration_minutes'],
            'is_host' => $isHost,
            'has_submitted' => (bool)$userSub,
            'user_submission' => $userSub ? $userSub['answer_text'] : null,
            'scenario' => $isLiveOrCompleted ? [
                'title' => $c['scenario_title'],
                'body' => $c['confidential_body'],
                'reference_case' => !empty($c['reference_case']) ? json_decode((string)$c['reference_case'], true) : null,
            ] : null,
        ];
    }

    public static function submitMemo(string $userId, string $challengeId, string $answerText): array
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
        if ($c['state'] !== 'live') {
            throw new RuntimeException("Challenge is not currently accepting submissions.");
        }

        $subId = Security::uuid();

        $pdo->beginTransaction();
        try {
            $insSub = $pdo->prepare(
                "INSERT INTO boardroom_submissions (id, challenge_id, user_id, answer_text, submitted_at)
                 VALUES (:id, :cid, :uid, :ans, NOW(3))
                 ON DUPLICATE KEY UPDATE answer_text = VALUES(answer_text), submitted_at = NOW(3)"
            );
            $insSub->execute([
                ':id' => $subId,
                ':cid' => $challengeId,
                ':uid' => $userId,
                ':ans' => $answerText,
            ]);

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

            // Update challenge state to evaluating
            $upC = $pdo->prepare("UPDATE boardroom_challenges SET state = 'evaluating' WHERE id = ?");
            $upC->execute([$challengeId]);

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
}

