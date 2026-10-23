<?php

declare(strict_types=1);

namespace App\Services;

use App\Config\Database;
use PDO;
use RuntimeException;

class FeatureService
{
    private static ?array $cachedFeatures = null;

    /**
     * Check if a feature is enabled in platform_features.
     */
    public static function isEnabled(string $code): bool
    {
        $features = self::getAllFeatures();

        // Handle aliasing between real_boardroom and boardroom_real_commitments
        if ($code === 'real_boardroom' || $code === 'boardroom_real_commitments') {
            return ($features['real_boardroom'] ?? false) || ($features['boardroom_real_commitments'] ?? false);
        }

        return $features[$code] ?? false;
    }

    /**
     * Retrieve all platform features as a key-value boolean map.
     */
    public static function getAllFeatures(bool $forceRefresh = false): array
    {
        if (self::$cachedFeatures !== null && !$forceRefresh) {
            return self::$cachedFeatures;
        }

        $pdo = Database::getConnection();
        $stmt = $pdo->query("SELECT code, enabled FROM platform_features");
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $map = [
            'demo_mode' => true,
            'real_mode' => false,
            'real_funding' => false,
            'real_payouts' => false,
            'real_boardroom' => false,
            'boardroom_real_commitments' => false,
            'academy' => false,
            'university_leagues' => false,
        ];

        foreach ($rows as $r) {
            $map[$r['code']] = (bool)(int)$r['enabled'];
        }

        // Keep aliases synchronized
        if (isset($map['real_boardroom']) && $map['real_boardroom']) {
            $map['boardroom_real_commitments'] = true;
        } elseif (isset($map['boardroom_real_commitments']) && $map['boardroom_real_commitments']) {
            $map['real_boardroom'] = true;
        }

        self::$cachedFeatures = $map;
        return $map;
    }

    /**
     * Get the active payment provider (Flutterwave vs Korapay) configured by admin.
     */
    public static function getActiveProvider(): array
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->query(
            "SELECT slug, display_name, status FROM funding_providers 
             WHERE status IN ('enabled', 'sandbox') 
             ORDER BY CASE WHEN status = 'enabled' THEN 1 ELSE 2 END 
             LIMIT 1"
        );
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            return [
                'slug' => 'flutterwave',
                'display_name' => 'Flutterwave (Standard Gateway)',
                'status' => 'enabled'
            ];
        }

        return [
            'slug' => (string)$row['slug'],
            'display_name' => (string)$row['display_name'],
            'status' => (string)$row['status']
        ];
    }

    /**
     * Get active primary NVIDIA NIM AI model configured by admin.
     */
    public static function getActiveAiModel(): string
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->query("SELECT `value` FROM platform_settings WHERE `key` = 'active_ai_model' LIMIT 1");
        $val = $stmt->fetchColumn();

        return !empty($val) ? (string)$val : 'meta/llama-3.1-70b-instruct';
    }

    /**
     * Enforce that a specific platform feature is enabled, throwing exception if disabled.
     */
    public static function assertEnabled(string $code, ?string $message = null): void
    {
        if (!self::isEnabled($code)) {
            $msg = $message ?? match ($code) {
                'real_mode' => 'Real money platform mode is currently disabled by administrator.',
                'real_funding' => 'Live gateway deposits are currently disabled by administrator.',
                'real_payouts' => 'Real ledger settlements and withdrawals are currently disabled by administrator.',
                'real_boardroom', 'boardroom_real_commitments' => 'Real-money boardroom challenges are currently disabled by administrator.',
                default => "Platform feature '{$code}' is currently inactive.",
            };
            throw new RuntimeException($msg);
        }
    }
}

