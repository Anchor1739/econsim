<?php

declare(strict_types=1);

namespace App\Services;

use App\Config\Database;
use App\Utils\Security;
use PDO;

class NotificationService
{
    public static function dispatch(
        string $userId,
        string $title,
        string $message,
        string $targetPage = 'dashboard',
        ?string $targetId = null,
        string $category = 'boardroom'
    ): string {
        $pdo = Database::getConnection();
        $notifId = Security::uuid();

        $stmt = $pdo->prepare(
            "INSERT INTO user_notifications (id, user_id, title, message, target_page, target_id, category, is_read, created_at)
             VALUES (:id, :uid, :title, :msg, :page, :tid, :cat, 0, NOW(3))"
        );
        $stmt->execute([
            ':id' => $notifId,
            ':uid' => $userId,
            ':title' => $title,
            ':msg' => $message,
            ':page' => $targetPage,
            ':tid' => $targetId,
            ':cat' => $category,
        ]);

        return $notifId;
    }

    public static function getUserNotifications(string $userId, int $limit = 30): array
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            "SELECT id, title, message, target_page, target_id, category, is_read, created_at
             FROM user_notifications
             WHERE user_id = :uid
             ORDER BY created_at DESC
             LIMIT :lim"
        );
        $stmt->bindValue(':uid', $userId, PDO::PARAM_STR);
        $stmt->bindValue(':lim', $limit, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function markAsRead(string $userId, ?string $notificationId = null): void
    {
        $pdo = Database::getConnection();
        if ($notificationId) {
            $stmt = $pdo->prepare("UPDATE user_notifications SET is_read = 1 WHERE id = :id AND user_id = :uid");
            $stmt->execute([':id' => $notificationId, ':uid' => $userId]);
        } else {
            $stmt = $pdo->prepare("UPDATE user_notifications SET is_read = 1 WHERE user_id = :uid");
            $stmt->execute([':uid' => $userId]);
        }
    }

    public static function getUnreadCount(string $userId): int
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM user_notifications WHERE user_id = :uid AND is_read = 0");
        $stmt->execute([':uid' => $userId]);
        return (int)$stmt->fetchColumn();
    }
}

