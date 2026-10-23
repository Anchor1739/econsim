<?php

declare(strict_types=1);

namespace App\Services;

use App\Config\Database;
use App\Utils\Security;
use PDO;
use RuntimeException;

class AuthService
{
    public static function register(string $email, string $password, string $displayName, string $countryCode = 'NG'): array
    {
        $email = Security::normalizeEmail($email);
        $displayName = trim($displayName);

        if (strlen($displayName) < 2 || strlen($displayName) > 120) {
            throw new RuntimeException("Display name must be between 2 and 120 characters.");
        }
        if (strlen($password) < 8) {
            throw new RuntimeException("Password must be at least 8 characters long.");
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException("Please provide a valid email address.");
        }

        $pdo = Database::getConnection();

        // Check for existing user
        $stmt = $pdo->prepare("SELECT id, status FROM users WHERE email = ? LIMIT 1");
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            throw new RuntimeException("An account with this email already exists.");
        }

        $userId = Security::uuid();
        $passwordHash = Security::hashPassword($password);

        $pdo->beginTransaction();
        try {
            $insert = $pdo->prepare(
                "INSERT INTO users (id, email, password_hash, display_name, country_code, status, created_at, updated_at)
                 VALUES (:id, :email, :hash, :name, :country, 'pending', NOW(3), NOW(3))"
            );
            $insert->execute([
                ':id' => $userId,
                ':email' => $email,
                ':hash' => $passwordHash,
                ':name' => $displayName,
                ':country' => strtoupper(substr($countryCode, 0, 2)),
            ]);

            // Create initial user preferences
            $pref = $pdo->prepare(
                "INSERT INTO user_preferences (user_id, theme, preferred_mode, notifications_enabled)
                 VALUES (:uid, 'system', 'demo', 1)"
            );
            $pref->execute([':uid' => $userId]);

            // Generate 6-digit verification code
            $rawCode = (string)random_int(100000, 999999);
            $tokenHash = Security::hashToken($rawCode);
            $tokenId = Security::uuid();

            $tokStmt = $pdo->prepare(
                "INSERT INTO auth_one_time_tokens (id, user_id, purpose, token_hash, expires_at)
                 VALUES (:id, :uid, 'verify_email', :hash, DATE_ADD(NOW(3), INTERVAL 24 HOUR))"
            );
            $tokStmt->execute([
                ':id' => $tokenId,
                ':uid' => $userId,
                ':hash' => $tokenHash,
            ]);

            $pdo->commit();

            // Send transactional email
            MailerService::sendVerificationEmail($email, $displayName, $rawCode);

            return [
                'user_id' => $userId,
                'email' => $email,
                'display_name' => $displayName,
                'status' => 'pending',
                'verification_preview' => $rawCode, // Provided for smooth local demo testing
            ];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public static function verifyEmail(string $email, string $code): array
    {
        $email = Security::normalizeEmail($email);
        $code = trim($code);
        $tokenHash = Security::hashToken($code);

        $pdo = Database::getConnection();

        $stmt = $pdo->prepare(
            "SELECT u.id, u.display_name, u.email, t.id AS token_id
             FROM auth_one_time_tokens t
             JOIN users u ON t.user_id = u.id
             WHERE u.email = :email AND t.purpose = 'verify_email'
               AND t.token_hash = :hash AND t.consumed_at IS NULL
               AND t.expires_at > NOW(3)
             LIMIT 1"
        );
        $stmt->execute([
            ':email' => $email,
            ':hash' => $tokenHash,
        ]);
        $res = $stmt->fetch();

        if (!$res) {
            throw new RuntimeException("Invalid or expired verification code.");
        }

        $userId = $res['id'];
        $tokenId = $res['token_id'];

        $pdo->beginTransaction();
        try {
            // Consume token
            $upTok = $pdo->prepare("UPDATE auth_one_time_tokens SET consumed_at = NOW(3) WHERE id = ?");
            $upTok->execute([$tokenId]);

            // Activate user
            $upUser = $pdo->prepare("UPDATE users SET status = 'active', email_verified_at = NOW(3) WHERE id = ?");
            $upUser->execute([$userId]);

            // One-time 500,000 VNGN demo grant
            LedgerService::grantDemoWelcomeBalance($userId, 500000);

            $pdo->commit();

            // Auto-login session
            $session = self::createSession($userId);

            return [
                'user_id' => $userId,
                'email' => $email,
                'display_name' => $res['display_name'],
                'session' => $session,
                'grant_awarded' => 500000,
            ];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public static function login(string $email, string $password): array
    {
        $email = Security::normalizeEmail($email);
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("SELECT id, email, password_hash, display_name, status FROM users WHERE email = ? LIMIT 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user || !Security::verifyPassword($password, (string)$user['password_hash'])) {
            throw new RuntimeException("Invalid email address or password.");
        }

        if ($user['status'] === 'suspended' || $user['status'] === 'closed') {
            throw new RuntimeException("Your account is {$user['status']}. Please contact support.");
        }

        $session = self::createSession($user['id']);

        return [
            'user_id' => $user['id'],
            'email' => $user['email'],
            'display_name' => $user['display_name'],
            'status' => $user['status'],
            'session' => $session,
        ];
    }

    public static function createSession(string $userId): array
    {
        $pdo = Database::getConnection();
        $rawToken = Security::generateToken(32);
        $tokenHash = Security::hashToken($rawToken);
        $sessionId = Security::uuid();

        $expiresAt = time() + (30 * 86400); // 30 days
        $device = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown browser';
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';

        $stmt = $pdo->prepare(
            "INSERT INTO auth_sessions (id, user_id, token_hash, expires_at, device_label, ip_address, created_at)
             VALUES (:id, :uid, :hash, FROM_UNIXTIME(:exp), :dev, :ip, NOW(3))"
        );
        $stmt->execute([
            ':id' => $sessionId,
            ':uid' => $userId,
            ':hash' => $tokenHash,
            ':exp' => $expiresAt,
            ':dev' => substr($device, 0, 255),
            ':ip' => substr($ip, 0, 45),
        ]);

        Security::setSessionCookie($rawToken, $expiresAt);

        return [
            'token' => $rawToken,
            'expires_at' => date('c', $expiresAt),
        ];
    }

    public static function getCurrentUser(?string $rawToken = null): ?array
    {
        $rawToken = $rawToken ?: ($_COOKIE['econsim_session'] ?? null);

        if (!$rawToken) {
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
            if (str_starts_with($authHeader, 'Bearer ')) {
                $rawToken = substr($authHeader, 7);
            }
        }

        if (!$rawToken) {
            return null;
        }

        $tokenHash = Security::hashToken($rawToken);
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare(
            "SELECT u.id, u.email, u.display_name, u.country_code, u.status, u.email_verified_at,
                    p.theme, p.preferred_mode, p.notifications_enabled
             FROM auth_sessions s
             JOIN users u ON s.user_id = u.id
             LEFT JOIN user_preferences p ON u.id = p.user_id
             WHERE s.token_hash = :hash AND s.revoked_at IS NULL AND s.expires_at > NOW(3)
             LIMIT 1"
        );
        $stmt->execute([':hash' => $tokenHash]);
        $user = $stmt->fetch();

        if (!$user) {
            return null;
        }

        // Fetch user industries
        $indStmt = $pdo->prepare(
            "SELECT i.slug, i.name 
             FROM user_industries ui 
             JOIN industries i ON ui.industry_id = i.id 
             WHERE ui.user_id = ?"
        );
        $indStmt->execute([$user['id']]);
        $user['industries'] = $indStmt->fetchAll();

        // Attach double-entry balances
        $user['wallet'] = LedgerService::getUserBalances($user['id'], $user['preferred_mode'] ?? 'demo');

        // Fetch actual user activity counts and stats
        $xpStmt = $pdo->prepare("SELECT COALESCE(SUM(xp), 0) FROM xp_events WHERE user_id = ?");
        $xpStmt->execute([$user['id']]);
        $totalXp = (int)$xpStmt->fetchColumn();

        $level = ProfileService::calculateLevel($totalXp);

        $fOpen = $pdo->prepare("SELECT COUNT(*) FROM forecast_positions WHERE user_id = ? AND status = 'open'");
        $fOpen->execute([$user['id']]);
        $openForecasts = (int)$fOpen->fetchColumn();

        $bCount = $pdo->prepare("SELECT COUNT(*) FROM boardroom_submissions WHERE user_id = ?");
        $bCount->execute([$user['id']]);
        $boardroomCount = (int)$bCount->fetchColumn();

        $user['stats'] = [
            'xp' => $totalXp,
            'level' => $level,
            'active_forecasts' => $openForecasts,
            'completed_boardroom' => $boardroomCount,
        ];

        return $user;
    }

    public static function logout(?string $rawToken = null): void
    {
        $rawToken = $rawToken ?: ($_COOKIE['econsim_session'] ?? null);
        if ($rawToken) {
            $tokenHash = Security::hashToken($rawToken);
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("UPDATE auth_sessions SET revoked_at = NOW(3) WHERE token_hash = ?");
            $stmt->execute([$tokenHash]);
        }
        Security::clearSessionCookie();
    }

    public static function forgotPassword(string $email): bool
    {
        $email = Security::normalizeEmail($email);
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("SELECT id, display_name FROM users WHERE email = ? LIMIT 1");
        $stmt->execute([$email]);
        $user = $stmt->fetch();

        if (!$user) {
            // Generic success return to prevent email enumeration
            return true;
        }

        $resetToken = Security::generateToken(16);
        $tokenHash = Security::hashToken($resetToken);
        $tokenId = Security::uuid();

        $tokStmt = $pdo->prepare(
            "INSERT INTO auth_one_time_tokens (id, user_id, purpose, token_hash, expires_at)
             VALUES (:id, :uid, 'reset_password', :hash, DATE_ADD(NOW(3), INTERVAL 1 HOUR))"
        );
        $tokStmt->execute([
            ':id' => $tokenId,
            ':uid' => $user['id'],
            ':hash' => $tokenHash,
        ]);

        MailerService::sendPasswordResetEmail($email, $user['display_name'], $resetToken);
        return true;
    }

    public static function resetPassword(string $resetToken, string $newPassword): bool
    {
        if (strlen($newPassword) < 8) {
            throw new RuntimeException("New password must be at least 8 characters long.");
        }

        $tokenHash = Security::hashToken($resetToken);
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare(
            "SELECT id, user_id FROM auth_one_time_tokens
             WHERE purpose = 'reset_password' AND token_hash = :hash
               AND consumed_at IS NULL AND expires_at > NOW(3)
             LIMIT 1"
        );
        $stmt->execute([':hash' => $tokenHash]);
        $tok = $stmt->fetch();

        if (!$tok) {
            throw new RuntimeException("Invalid or expired password reset link.");
        }

        $pdo->beginTransaction();
        try {
            $consume = $pdo->prepare("UPDATE auth_one_time_tokens SET consumed_at = NOW(3) WHERE id = ?");
            $consume->execute([$tok['id']]);

            $upPass = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
            $upPass->execute([Security::hashPassword($newPassword), $tok['user_id']]);

            // Revoke all sessions on password change
            $revAll = $pdo->prepare("UPDATE auth_sessions SET revoked_at = NOW(3) WHERE user_id = ?");
            $revAll->execute([$tok['user_id']]);

            $pdo->commit();
            return true;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }
}

