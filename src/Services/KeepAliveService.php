<?php

declare(strict_types=1);

namespace App\Services;

use App\Config\Database;
use App\Config\Env;
use PDO;
use Throwable;

class KeepAliveService
{
    /**
     * Executes targeted queries on the database (specifically user records, markets, and features)
     * to generate continuous active query transactions and prevent Aiven/cloud database auto-hibernation.
     */
    public static function pingDatabase(): array
    {
        $startTime = microtime(true);
        $pdo = Database::getConnection();

        $targetEmail = trim((string)(Env::get('KEEP_ALIVE_EMAIL') ?: Env::get('ADMIN_EMAIL') ?: ''));
        $matchedUser = null;

        // 1. SELECT query targeting specific user email if provided
        if (!empty($targetEmail)) {
            try {
                $stmt = $pdo->prepare("
                    SELECT id, email, display_name, status, updated_at 
                    FROM users 
                    WHERE email = :email 
                    LIMIT 1
                ");
                $stmt->execute(['email' => strtolower($targetEmail)]);
                $userRow = $stmt->fetch();
                if ($userRow) {
                    $matchedUser = [
                        'id' => $userRow['id'],
                        'email' => $userRow['email'],
                        'display_name' => $userRow['display_name'] ?? null,
                        'status' => $userRow['status'] ?? 'active',
                    ];
                }
            } catch (Throwable $e) {
                // Non-fatal, continue to fallback queries
            }
        }

        // 2. Query registered users (provides database traffic even if targetEmail is not in .env)
        $sampleUsers = [];
        try {
            $fallbackStmt = $pdo->query("
                SELECT id, email, display_name, status, created_at, updated_at 
                FROM users 
                ORDER BY created_at ASC 
                LIMIT 3
            ");
            $rows = $fallbackStmt->fetchAll();
            foreach ($rows as $r) {
                $sampleUsers[] = [
                    'id' => $r['id'],
                    'email' => $r['email'],
                    'status' => $r['status'] ?? 'active',
                ];
                if (!$matchedUser) {
                    $matchedUser = [
                        'id' => $r['id'],
                        'email' => $r['email'],
                        'display_name' => $r['display_name'] ?? null,
                        'status' => $r['status'] ?? 'active',
                    ];
                }
            }
        } catch (Throwable $e) {
            // Non-fatal
        }

        // 3. Aggregate user count query
        $totalUsers = 0;
        try {
            $countStmt = $pdo->query("SELECT COUNT(*) AS total_users FROM users");
            $totalUsers = (int)($countStmt->fetch()['total_users'] ?? 0);
        } catch (Throwable $e) {
            // Non-fatal
        }

        // 4. Open markets activity query
        $openMarkets = 0;
        try {
            $marketsStmt = $pdo->query("SELECT COUNT(*) AS open_markets FROM market_events WHERE state = 'open'");
            $openMarkets = (int)($marketsStmt->fetch()['open_markets'] ?? 0);
        } catch (Throwable $e) {
            // Non-fatal
        }

        // 5. Heartbeat touch: update demo_mode feature timestamp to generate a real write transaction
        // (Aiven evaluates both read query transactions and committed updates for idle detection)
        try {
            $touchStmt = $pdo->prepare("
                UPDATE platform_features 
                SET updated_at = NOW(3) 
                WHERE code = 'demo_mode' 
                LIMIT 1
            ");
            $touchStmt->execute();
        } catch (Throwable $e) {
            // Non-fatal
        }

        $elapsedMs = round((microtime(true) - $startTime) * 1000, 2);

        return [
            'status' => 'alive',
            'target_email' => !empty($targetEmail) ? $targetEmail : ($matchedUser['email'] ?? 'auto_detected'),
            'user_found' => $matchedUser !== null,
            'user' => $matchedUser,
            'sample_users' => $sampleUsers,
            'total_registered_users' => $totalUsers,
            'open_markets' => $openMarkets,
            'latency_ms' => $elapsedMs,
            'db_timestamp' => date('Y-m-d H:i:s T'),
        ];
    }
}

