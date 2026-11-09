<?php

declare(strict_types=1);

namespace App\Services;

use App\Config\Database;
use App\Security\Security;
use InvalidArgumentException;
use PDO;

class FeedbackService
{
    public const VALID_CATEGORIES = [
        'general',
        'bug',
        'feature',
        'boardroom',
        'markets',
        'wallet',
        'ui_ux',
    ];

    public const VALID_STATUSES = [
        'new',
        'reviewed',
        'resolved',
        'archived',
    ];

    /**
     * Submit user feedback or bug report
     */
    public static function submitFeedback(?string $userId, array $data): array
    {
        $message = trim((string)($data['message'] ?? ''));
        if (mb_strlen($message) < 5) {
            throw new InvalidArgumentException("Feedback message must be at least 5 characters.");
        }

        $category = strtolower(trim((string)($data['category'] ?? 'general')));
        if (!in_array($category, self::VALID_CATEGORIES, true)) {
            $category = 'general';
        }

        $rating = isset($data['rating']) ? (int)$data['rating'] : null;
        if ($rating !== null && ($rating < 1 || $rating > 5)) {
            $rating = null;
        }

        $contactEmail = trim((string)($data['contact_email'] ?? ''));
        $pageUrl = trim((string)($data['page_url'] ?? ''));
        $userAgent = trim((string)($data['user_agent'] ?? ''));

        $pdo = Database::getConnection();

        // Self-heal table if not yet created on runtime
        self::ensureTableExists($pdo);

        // If email not provided and user logged in, get user's email
        if (empty($contactEmail) && !empty($userId)) {
            $uStmt = $pdo->prepare("SELECT email FROM users WHERE id = ?");
            $uStmt->execute([$userId]);
            $contactEmail = (string)$uStmt->fetchColumn();
        }

        $feedbackId = Security::uuid();

        $stmt = $pdo->prepare(
            "INSERT INTO user_feedbacks 
                (id, user_id, category, rating, message, contact_email, page_url, user_agent, status, created_at)
             VALUES 
                (:id, :uid, :cat, :rat, :msg, :email, :url, :ua, 'new', NOW(3))"
        );

        $stmt->execute([
            ':id' => $feedbackId,
            ':uid' => $userId ?: null,
            ':cat' => $category,
            ':rat' => $rating,
            ':msg' => $message,
            ':email' => $contactEmail ?: null,
            ':url' => mb_substr($pageUrl, 0, 255) ?: null,
            ':ua' => mb_substr($userAgent, 0, 500) ?: null,
        ]);

        if (!empty($userId)) {
            NotificationService::dispatch(
                $userId,
                '🙏 Feedback Received',
                'Thank you for helping improve EconSim! Our product and engineering desk has received your submission.',
                'general',
                $feedbackId
            );
        }

        return [
            'id' => $feedbackId,
            'category' => $category,
            'rating' => $rating,
            'status' => 'new',
            'message' => 'Thank you! Your feedback has been successfully submitted to the team.',
        ];
    }

    /**
     * List user feedbacks for admin desk
     */
    public static function getFeedbacks(?string $status = null, ?string $category = null, int $limit = 50, int $offset = 0): array
    {
        $pdo = Database::getConnection();
        self::ensureTableExists($pdo);

        $where = [];
        $params = [];

        if (!empty($status) && in_array($status, self::VALID_STATUSES, true)) {
            $where[] = "f.status = :status";
            $params[':status'] = $status;
        }

        if (!empty($category) && in_array($category, self::VALID_CATEGORIES, true)) {
            $where[] = "f.category = :category";
            $params[':category'] = $category;
        }

        $whereSql = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';

        $sql = "SELECT f.*, u.display_name AS user_name, u.email AS user_email,
                       adm.display_name AS reviewer_name
                FROM user_feedbacks f
                LEFT JOIN users u ON u.id = f.user_id
                LEFT JOIN users adm ON adm.id = f.reviewed_by
                {$whereSql}
                ORDER BY f.created_at DESC
                LIMIT " . (int)$limit . " OFFSET " . (int)$offset;

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Total count
        $countSql = "SELECT COUNT(*) FROM user_feedbacks f {$whereSql}";
        $countStmt = $pdo->prepare($countSql);
        $countStmt->execute($params);
        $total = (int)$countStmt->fetchColumn();

        return [
            'items' => $items,
            'total' => $total,
            'stats' => self::getFeedbackStats(),
        ];
    }

    /**
     * Update feedback status & notes (Admin only)
     */
    public static function updateStatus(string $feedbackId, string $status, ?string $adminId = null, ?string $adminNotes = null): array
    {
        if (!in_array($status, self::VALID_STATUSES, true)) {
            throw new InvalidArgumentException("Invalid status: {$status}");
        }

        $pdo = Database::getConnection();
        self::ensureTableExists($pdo);

        $stmt = $pdo->prepare(
            "UPDATE user_feedbacks 
             SET status = :status, 
                 admin_notes = COALESCE(:notes, admin_notes),
                 reviewed_by = :admin_id,
                 reviewed_at = NOW(3)
             WHERE id = :id"
        );

        $stmt->execute([
            ':status' => $status,
            ':notes' => $adminNotes !== null ? trim($adminNotes) : null,
            ':admin_id' => $adminId,
            ':id' => $feedbackId,
        ]);

        return ['success' => true, 'id' => $feedbackId, 'status' => $status];
    }

    /**
     * Get aggregate feedback stats
     */
    public static function getFeedbackStats(): array
    {
        $pdo = Database::getConnection();
        self::ensureTableExists($pdo);

        try {
            $stmt = $pdo->query(
                "SELECT 
                    COUNT(*) AS total,
                    SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new_count,
                    SUM(CASE WHEN status = 'reviewed' THEN 1 ELSE 0 END) AS reviewed_count,
                    SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_count,
                    AVG(rating) AS average_rating
                 FROM user_feedbacks"
            );
            $res = $stmt->fetch(PDO::FETCH_ASSOC);
            return [
                'total' => (int)($res['total'] ?? 0),
                'new' => (int)($res['new_count'] ?? 0),
                'reviewed' => (int)($res['reviewed_count'] ?? 0),
                'resolved' => (int)($res['resolved_count'] ?? 0),
                'average_rating' => $res['average_rating'] !== null ? round((float)$res['average_rating'], 1) : null,
            ];
        } catch (\Throwable $e) {
            return ['total' => 0, 'new' => 0, 'reviewed' => 0, 'resolved' => 0, 'average_rating' => null];
        }
    }

    /**
     * Self-healing table check
     */
    private static function ensureTableExists(PDO $pdo): void
    {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS user_feedbacks (
                id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NULL,
                category VARCHAR(80) NOT NULL DEFAULT 'general',
                rating TINYINT UNSIGNED NULL,
                message TEXT NOT NULL,
                contact_email VARCHAR(255) NULL,
                page_url VARCHAR(255) NULL,
                user_agent VARCHAR(500) NULL,
                status ENUM('new', 'reviewed', 'resolved', 'archived') NOT NULL DEFAULT 'new',
                admin_notes TEXT NULL,
                reviewed_by CHAR(36) NULL,
                created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
                reviewed_at DATETIME(3) NULL,
                INDEX idx_feedback_status (status, created_at),
                INDEX idx_feedback_user (user_id)
            ) ENGINE=InnoDB
        ");
    }
}

