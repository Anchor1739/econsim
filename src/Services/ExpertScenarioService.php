<?php

declare(strict_types=1);

namespace App\Services;

use App\Config\Database;
use App\Utils\Security;
use InvalidArgumentException;
use PDO;
use RuntimeException;

class ExpertScenarioService
{
    public const VALID_STATUSES = ['pending_review', 'approved', 'rejected'];
    public const VALID_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

    /**
     * Submit and automatically process a real-world expert scenario into standard Boardroom format
     */
    public static function submitScenario(?string $userId, array $data): array
    {
        $contributorName = trim((string)($data['contributor_name'] ?? ''));
        $contributorRole = trim((string)($data['contributor_role'] ?? ''));
        $contributorEmail = trim((string)($data['contributor_email'] ?? ''));
        $organization = trim((string)($data['organization'] ?? ''));
        $industryId = (int)($data['industry_id'] ?? 0);
        $title = trim((string)($data['title'] ?? ''));
        $scenarioDilemma = trim((string)($data['scenario_dilemma'] ?? ''));
        $decisionOptions = trim((string)($data['decision_options'] ?? ''));
        $actualDecisionMade = trim((string)($data['actual_decision_made'] ?? ''));
        $actualOutcomeResult = trim((string)($data['actual_outcome_result'] ?? ''));
        $lessonsLearned = trim((string)($data['lessons_learned'] ?? ''));
        $difficulty = strtolower(trim((string)($data['difficulty'] ?? 'intermediate')));

        if (mb_strlen($contributorName) < 2) {
            throw new InvalidArgumentException("Contributor name is required.");
        }
        if (mb_strlen($contributorRole) < 2) {
            throw new InvalidArgumentException("Contributor executive role is required (e.g., Former CFO, Treasury Lead, Founder).");
        }
        if (!filter_var($contributorEmail, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException("A valid email address is required for submission verification.");
        }
        if ($industryId <= 0) {
            throw new InvalidArgumentException("Please select an industry sector.");
        }
        if (mb_strlen($title) < 10) {
            throw new InvalidArgumentException("Title must be at least 10 characters describing the real-world dilemma.");
        }
        if (mb_strlen($scenarioDilemma) < 60) {
            throw new InvalidArgumentException("Scenario dilemma must provide adequate corporate and macroeconomic background (min 60 characters).");
        }
        if (mb_strlen($decisionOptions) < 20) {
            throw new InvalidArgumentException("Please outline at least 2 distinct decision pathways that were considered.");
        }
        if (mb_strlen($actualDecisionMade) < 15) {
            throw new InvalidArgumentException("Please detail the actual executive decision that was implemented.");
        }
        if (mb_strlen($actualOutcomeResult) < 25) {
            throw new InvalidArgumentException("Please explain the real-world outcome and consequences of this decision.");
        }
        if (!in_array($difficulty, self::VALID_DIFFICULTIES, true)) {
            $difficulty = 'intermediate';
        }

        // Process Key Metrics
        $keyMetrics = [];
        if (!empty($data['key_metrics'])) {
            if (is_array($data['key_metrics'])) {
                $keyMetrics = $data['key_metrics'];
            } elseif (is_string($data['key_metrics'])) {
                $decoded = json_decode($data['key_metrics'], true);
                if (is_array($decoded)) {
                    $keyMetrics = $decoded;
                }
            }
        }

        $pdo = Database::getConnection();
        self::ensureTableExists($pdo);

        // Verify industry exists
        $indStmt = $pdo->prepare("SELECT id, name FROM industries WHERE id = ?");
        $indStmt->execute([$industryId]);
        $industry = $indStmt->fetch(PDO::FETCH_ASSOC);
        if (!$industry) {
            throw new InvalidArgumentException("Invalid industry sector selected.");
        }

        $submissionId = Security::uuid();

        $stmt = $pdo->prepare(
            "INSERT INTO expert_scenario_submissions
                (id, contributor_id, contributor_name, contributor_role, contributor_email,
                 organization, industry_id, title, scenario_dilemma, key_metrics,
                 decision_options, actual_decision_made, actual_outcome_result, lessons_learned,
                 difficulty, status, created_at)
             VALUES
                (:id, :uid, :name, :role, :email,
                 :org, :ind, :title, :dilemma, :metrics,
                 :opts, :act_dec, :act_out, :lessons,
                 :diff, 'pending_review', NOW(3))"
        );

        $stmt->execute([
            ':id' => $submissionId,
            ':uid' => $userId ?: null,
            ':name' => $contributorName,
            ':role' => $contributorRole,
            ':email' => $contributorEmail,
            ':org' => $organization ?: null,
            ':ind' => $industryId,
            ':title' => $title,
            ':dilemma' => $scenarioDilemma,
            ':metrics' => !empty($keyMetrics) ? json_encode($keyMetrics, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) : null,
            ':opts' => $decisionOptions,
            ':act_dec' => $actualDecisionMade,
            ':act_out' => $actualOutcomeResult,
            ':lessons' => $lessonsLearned ?: null,
            ':diff' => $difficulty,
        ]);

        if (!empty($userId)) {
            NotificationService::dispatch(
                $userId,
                '🎓 Real-World Scenario Submitted',
                "Your scenario '{$title}' has been processed and formatted into standard Boardroom structure. It is currently under Institutional Administrator verification.",
                'boardroom',
                $submissionId
            );
        }

        return [
            'id' => $submissionId,
            'title' => $title,
            'status' => 'pending_review',
            'industry' => $industry['name'],
            'packaged_preview' => self::packageScenarioPayload([
                'title' => $title,
                'contributor_name' => $contributorName,
                'contributor_role' => $contributorRole,
                'organization' => $organization,
                'industry_name' => $industry['name'],
                'scenario_dilemma' => $scenarioDilemma,
                'key_metrics' => $keyMetrics,
                'decision_options' => $decisionOptions,
                'actual_decision_made' => $actualDecisionMade,
                'actual_outcome_result' => $actualOutcomeResult,
                'lessons_learned' => $lessonsLearned,
                'difficulty' => $difficulty,
            ]),
            'message' => 'Scenario successfully ingested. Pending review and verification by Institutional Administrator before going live.',
        ];
    }

    /**
     * Synthesize and format raw expert submission into standard Boardroom Scenario structure
     */
    public static function packageScenarioPayload(array $s): array
    {
        $metricsSection = '';
        if (!empty($s['key_metrics']) && is_array($s['key_metrics'])) {
            $metricLines = [];
            foreach ($s['key_metrics'] as $key => $val) {
                $label = ucwords(str_replace(['_', '-'], ' ', (string)$key));
                $metricLines[] = "- **{$label}:** {$val}";
            }
            if (!empty($metricLines)) {
                $metricsSection = "\n### Key Quantitative Financial & Macro Indicators:\n" . implode("\n", $metricLines) . "\n";
            }
        }

        $orgInfo = !empty($s['organization']) ? " ({$s['organization']})" : '';
        $contributorBadge = "Real-World Strategic Case contributed by {$s['contributor_name']}, {$s['contributor_role']}{$orgInfo}.";

        $confidentialBody = "## Confidential Executive Briefing: {$s['title']}\n"
            . "**Sector:** {$s['industry_name']}\n"
            . "_{$contributorBadge}_\n\n"
            . "### Operational & Macro Situation:\n"
            . "{$s['scenario_dilemma']}\n"
            . $metricsSection . "\n"
            . "### Decision Pathways Under Board Consideration:\n"
            . "{$s['decision_options']}\n\n"
            . "### Executive Directive:\n"
            . "Draft an executive strategic memorandum outlining your prioritized decision path. You must explicitly address:\n"
            . "1. Financial mechanics and capital runway preservation.\n"
            . "2. Downside risk controls and protective hedging.\n"
            . "3. Macroeconomic and regulatory precedent in emerging markets.\n"
            . "4. Clear operational execution plan.";

        $referenceCase = [
            'case_title' => $s['title'],
            'sector' => $s['industry_name'],
            'historical_case' => $s['scenario_dilemma'],
            'actual_decision' => $s['actual_decision_made'],
            'actual_outcome' => $s['actual_outcome_result'],
            'lessons_learned' => $s['lessons_learned'] ?? '',
            'contributor' => [
                'name' => $s['contributor_name'],
                'role' => $s['contributor_role'],
                'organization' => $s['organization'] ?? '',
            ],
            'key_metrics' => $s['key_metrics'] ?? [],
        ];

        $rubric = [
            'financial_mechanics' => 40,
            'risk_management' => 30,
            'historical_precedent' => 20,
            'communication' => 10,
        ];

        return [
            'title' => $s['title'],
            'confidential_body' => $confidentialBody,
            'reference_case' => $referenceCase,
            'rubric' => $rubric,
            'difficulty' => $s['difficulty'] ?? 'intermediate',
        ];
    }

    /**
     * List submissions for admin inspection
     */
    public static function getSubmissions(?string $status = null, int $limit = 50, int $offset = 0): array
    {
        $pdo = Database::getConnection();
        self::ensureTableExists($pdo);

        $where = [];
        $params = [];

        if (!empty($status) && in_array($status, self::VALID_STATUSES, true)) {
            $where[] = "s.status = :status";
            $params[':status'] = $status;
        }

        $whereSql = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        $sql = "SELECT s.*, i.name AS industry_name, u.display_name AS contributor_user_name,
                       adm.display_name AS reviewer_name,
                       sc.title AS published_scenario_title
                FROM expert_scenario_submissions s
                JOIN industries i ON i.id = s.industry_id
                LEFT JOIN users u ON u.id = s.contributor_id
                LEFT JOIN users adm ON adm.id = s.reviewed_by
                LEFT JOIN boardroom_scenarios sc ON sc.id = s.approved_scenario_id
                {$whereSql}
                ORDER BY s.created_at DESC
                LIMIT " . (int)$limit . " OFFSET " . (int)$offset;

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Decode key_metrics for display
        foreach ($items as &$item) {
            if (!empty($item['key_metrics']) && is_string($item['key_metrics'])) {
                $item['key_metrics'] = json_decode($item['key_metrics'], true);
            }
        }

        $countSql = "SELECT COUNT(*) FROM expert_scenario_submissions s {$whereSql}";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        return [
            'items' => $items,
            'total' => $total,
            'stats' => self::getStats(),
        ];
    }

    /**
     * Get single submission details with packaged boardroom preview
     */
    public static function getSubmissionById(string $id): ?array
    {
        $pdo = Database::getConnection();
        self::ensureTableExists($pdo);

        $stmt = $pdo->prepare(
            "SELECT s.*, i.name AS industry_name, u.display_name AS contributor_user_name,
                    adm.display_name AS reviewer_name,
                    sc.id AS live_scenario_id, sc.title AS live_scenario_title
             FROM expert_scenario_submissions s
             JOIN industries i ON i.id = s.industry_id
             LEFT JOIN users u ON u.id = s.contributor_id
             LEFT JOIN users adm ON adm.id = s.reviewed_by
             LEFT JOIN boardroom_scenarios sc ON sc.id = s.approved_scenario_id
             WHERE s.id = ?"
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }

        if (!empty($row['key_metrics']) && is_string($row['key_metrics'])) {
            $row['key_metrics'] = json_decode($row['key_metrics'], true);
        }

        $row['packaged_preview'] = self::packageScenarioPayload($row);
        return $row;
    }

    /**
     * Institutional Administrator Approval: Atomically verify and promote to live boardroom_scenarios
     */
    public static function approveAndPublish(string $submissionId, string $adminId, ?array $overrides = null): array
    {
        $pdo = Database::getConnection();
        self::ensureTableExists($pdo);

        $submission = self::getSubmissionById($submissionId);
        if (!$submission) {
            throw new RuntimeException("Expert scenario submission not found.");
        }

        if ($submission['status'] === 'approved' && !empty($submission['approved_scenario_id'])) {
            return [
                'success' => true,
                'scenario_id' => $submission['approved_scenario_id'],
                'message' => 'Scenario is already approved and live.',
            ];
        }

        $packaged = self::packageScenarioPayload($submission);

        // Allow admin to override final packaged title or body if needed
        $title = !empty($overrides['title']) ? trim((string)$overrides['title']) : $packaged['title'];
        $confidentialBody = !empty($overrides['confidential_body']) ? trim((string)$overrides['confidential_body']) : $packaged['confidential_body'];
        $difficulty = !empty($overrides['difficulty']) ? trim((string)$overrides['difficulty']) : $packaged['difficulty'];
        $adminNotes = !empty($overrides['admin_notes']) ? trim((string)$overrides['admin_notes']) : 'Verified and approved by Institutional Administrator.';

        $newScenarioId = Security::uuid();

        $pdo->beginTransaction();
        try {
            // 1. Insert into live boardroom_scenarios
            $ins = $pdo->prepare(
                "INSERT INTO boardroom_scenarios 
                    (id, industry_id, title, confidential_body, reference_case, rubric, difficulty, approved_by, created_at)
                 VALUES 
                    (:id, :ind, :title, :body, :ref, :rubric, :diff, :adm, NOW(3))"
            );
            $ins->execute([
                ':id' => $newScenarioId,
                ':ind' => $submission['industry_id'],
                ':title' => $title,
                ':body' => $confidentialBody,
                ':ref' => json_encode($packaged['reference_case'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                ':rubric' => json_encode($packaged['rubric']),
                ':diff' => $difficulty,
                ':adm' => $adminId,
            ]);

            // 2. Mark submission as approved
            $up = $pdo->prepare(
                "UPDATE expert_scenario_submissions
                 SET status = 'approved',
                     approved_scenario_id = :sc_id,
                     reviewed_by = :adm,
                     admin_review_notes = :notes,
                     reviewed_at = NOW(3)
                 WHERE id = :sub_id"
            );
            $up->execute([
                ':sc_id' => $newScenarioId,
                ':adm' => $adminId,
                ':notes' => $adminNotes,
                ':sub_id' => $submissionId,
            ]);

            // 3. Reward contributor with 500 XP and notification if linked to a user account
            if (!empty($submission['contributor_id'])) {
                try {
                    $xpIns = $pdo->prepare(
                        "INSERT INTO xp_events (id, user_id, amount, source_type, source_id, created_at)
                         VALUES (:id, :uid, 500, 'expert_scenario_published', :src, NOW(3))"
                    );
                    $xpIns->execute([
                        ':id' => Security::uuid(),
                        ':uid' => $submission['contributor_id'],
                        ':src' => $newScenarioId,
                    ]);
                } catch (\Throwable $e) {}

                NotificationService::dispatch(
                    $submission['contributor_id'],
                    '🎉 Real-World Scenario Published!',
                    "Your scenario '{$title}' has been verified by the administrator and is now live in the Boardroom arena. +500 XP awarded!",
                    'boardroom',
                    $newScenarioId
                );
            }

            $pdo->commit();

            return [
                'success' => true,
                'submission_id' => $submissionId,
                'scenario_id' => $newScenarioId,
                'title' => $title,
                'message' => 'Scenario successfully verified, packaged, and published live to the Boardroom arena.',
            ];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw new RuntimeException("Failed to approve scenario: " . $e->getMessage());
        }
    }

    /**
     * Institutional Administrator Rejection
     */
    public static function rejectSubmission(string $submissionId, string $adminId, string $notes): array
    {
        $pdo = Database::getConnection();
        self::ensureTableExists($pdo);

        $stmt = $pdo->prepare(
            "UPDATE expert_scenario_submissions
             SET status = 'rejected',
                 reviewed_by = :adm,
                 admin_review_notes = :notes,
                 reviewed_at = NOW(3)
             WHERE id = :id"
        );
        $stmt->execute([
            ':adm' => $adminId,
            ':notes' => trim($notes),
            ':id' => $submissionId,
        ]);

        $sub = self::getSubmissionById($submissionId);
        if ($sub && !empty($sub['contributor_id'])) {
            NotificationService::dispatch(
                $sub['contributor_id'],
                'Strategic Scenario Update',
                "Your submission '{$sub['title']}' was reviewed. Reason: " . mb_substr($notes, 0, 100),
                'boardroom',
                $submissionId
            );
        }

        return ['success' => true, 'submission_id' => $submissionId, 'status' => 'rejected'];
    }

    /**
     * Aggregated statistics for admin desk
     */
    public static function getStats(): array
    {
        $pdo = Database::getConnection();
        self::ensureTableExists($pdo);

        try {
            $stmt = $pdo->query(
                "SELECT 
                    COUNT(*) AS total,
                    SUM(CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END) AS pending_count,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected_count
                 FROM expert_scenario_submissions"
            );
            $res = $stmt->fetch(PDO::FETCH_ASSOC);
            return [
                'total' => (int)($res['total'] ?? 0),
                'pending' => (int)($res['pending_count'] ?? 0),
                'approved' => (int)($res['approved_count'] ?? 0),
                'rejected' => (int)($res['rejected_count'] ?? 0),
            ];
        } catch (\Throwable $e) {
            return ['total' => 0, 'pending' => 0, 'approved' => 0, 'rejected' => 0];
        }
    }

    /**
     * Self-healing table check
     */
    private static function ensureTableExists(PDO $pdo): void
    {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS expert_scenario_submissions (
                id CHAR(36) PRIMARY KEY,
                contributor_id CHAR(36) NULL,
                contributor_name VARCHAR(200) NOT NULL,
                contributor_role VARCHAR(200) NOT NULL,
                contributor_email VARCHAR(255) NOT NULL,
                organization VARCHAR(255) NULL,
                industry_id BIGINT UNSIGNED NOT NULL,
                title VARCHAR(300) NOT NULL,
                scenario_dilemma LONGTEXT NOT NULL,
                key_metrics JSON NULL,
                decision_options TEXT NOT NULL,
                actual_decision_made TEXT NOT NULL,
                actual_outcome_result LONGTEXT NOT NULL,
                lessons_learned TEXT NULL,
                difficulty ENUM('beginner', 'intermediate', 'advanced') NOT NULL DEFAULT 'intermediate',
                status ENUM('pending_review', 'approved', 'rejected') NOT NULL DEFAULT 'pending_review',
                admin_review_notes TEXT NULL,
                approved_scenario_id CHAR(36) NULL,
                reviewed_by CHAR(36) NULL,
                created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
                reviewed_at DATETIME(3) NULL,
                INDEX idx_expert_sub_status (status, created_at),
                INDEX idx_expert_sub_contributor (contributor_id)
            ) ENGINE=InnoDB
        ");
    }
}

