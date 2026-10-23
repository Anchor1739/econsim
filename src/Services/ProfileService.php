<?php

declare(strict_types=1);

namespace App\Services;

use App\Config\Database;
use App\Utils\Security;
use PDO;

class ProfileService
{
    public static function getProfile(string $userId): array
    {
        $pdo = Database::getConnection();

        // User and preferences
        $stmt = $pdo->prepare(
            "SELECT u.id, u.email, u.display_name, u.country_code, u.status, u.created_at,
                    p.theme, p.preferred_mode, p.notifications_enabled
             FROM users u
             LEFT JOIN user_preferences p ON u.id = p.user_id
             WHERE u.id = ?"
        );
        $stmt->execute([$userId]);
        $user = $stmt->fetch();

        // Total XP
        $xpStmt = $pdo->prepare("SELECT COALESCE(SUM(xp), 0) FROM xp_events WHERE user_id = ?");
        $xpStmt->execute([$userId]);
        $totalXp = (int)$xpStmt->fetchColumn();

        // Level calculation
        $levelInfo = self::calculateLevel($totalXp);

        // Activity counts
        $fCount = $pdo->prepare("SELECT COUNT(*) FROM forecast_positions WHERE user_id = ?");
        $fCount->execute([$userId]);
        $forecastCount = (int)$fCount->fetchColumn();

        $bCount = $pdo->prepare("SELECT COUNT(*) FROM boardroom_submissions WHERE user_id = ?");
        $bCount->execute([$userId]);
        $boardroomCount = (int)$bCount->fetchColumn();

        // Badges
        $bStmt = $pdo->prepare(
            "SELECT b.id, b.code, b.title, b.requirement, ub.awarded_at
             FROM badges b
             LEFT JOIN user_badges ub ON b.id = ub.badge_id AND ub.user_id = :uid"
        );
        $bStmt->execute([':uid' => $userId]);
        $badges = array_map(function ($b) use ($forecastCount, $boardroomCount, $totalXp) {
            $code = $b['code'];
            $earned = !empty($b['awarded_at']);

            // Auto-detect milestone if not yet recorded in DB
            if (!$earned) {
                $earned = match ($code) {
                    'first_forecast' => $forecastCount >= 1,
                    'market_explorer' => $forecastCount >= 3,
                    'boardroom_strategist' => $boardroomCount >= 1,
                    'senior_analyst' => $totalXp >= 2000,
                    default => false,
                };
            }

            return [
                'code' => $b['code'],
                'title' => $b['title'],
                'requirement' => !empty($b['requirement']) ? json_decode((string)$b['requirement'], true) : [],
                'earned' => $earned,
            ];
        }, $bStmt->fetchAll());

        // Industries
        $iStmt = $pdo->prepare(
            "SELECT i.slug, i.name 
             FROM user_industries ui 
             JOIN industries i ON ui.industry_id = i.id 
             WHERE ui.user_id = ?"
        );
        $iStmt->execute([$userId]);
        $industries = $iStmt->fetchAll();

        return [
            'user' => $user,
            'xp' => $totalXp,
            'level' => $levelInfo,
            'activity' => [
                'forecasts' => $forecastCount,
                'boardroom' => $boardroomCount,
                'total' => $forecastCount + $boardroomCount,
            ],
            'badges' => $badges,
            'industries' => $industries,
        ];
    }

    public static function updateProfile(string $userId, array $data): bool
    {
        $pdo = Database::getConnection();
        $pdo->beginTransaction();

        try {
            if (!empty($data['display_name'])) {
                $upU = $pdo->prepare("UPDATE users SET display_name = :name WHERE id = :uid");
                $upU->execute([
                    ':name' => trim($data['display_name']),
                    ':uid' => $userId,
                ]);
            }

            if (!empty($data['country_code'])) {
                $upC = $pdo->prepare("UPDATE users SET country_code = :cc WHERE id = :uid");
                $upC->execute([
                    ':cc' => strtoupper(substr(trim($data['country_code']), 0, 2)),
                    ':uid' => $userId,
                ]);
            }

            // Preferences
            $theme = $data['theme'] ?? 'system';
            $mode = $data['preferred_mode'] ?? 'demo';
            $notif = isset($data['notifications_enabled']) ? (bool)$data['notifications_enabled'] : true;

            $upP = $pdo->prepare(
                "INSERT INTO user_preferences (user_id, theme, preferred_mode, notifications_enabled)
                 VALUES (:uid, :theme, :mode, :notif)
                 ON DUPLICATE KEY UPDATE 
                    theme = VALUES(theme), 
                    preferred_mode = VALUES(preferred_mode), 
                    notifications_enabled = VALUES(notifications_enabled)"
            );
            $upP->execute([
                ':uid' => $userId,
                ':theme' => in_array($theme, ['light', 'dark', 'system'], true) ? $theme : 'system',
                ':mode' => in_array($mode, ['demo', 'real'], true) ? $mode : 'demo',
                ':notif' => $notif ? 1 : 0,
            ]);

            // Update industries if provided
            if (isset($data['industries']) && is_array($data['industries'])) {
                $delI = $pdo->prepare("DELETE FROM user_industries WHERE user_id = ?");
                $delI->execute([$userId]);

                foreach ($data['industries'] as $slug) {
                    $insI = $pdo->prepare(
                        "INSERT IGNORE INTO user_industries (user_id, industry_id)
                         SELECT :uid, id FROM industries WHERE slug = :slug OR name = :slug LIMIT 1"
                    );
                    $insI->execute([':uid' => $userId, ':slug' => $slug]);
                }
            }

            $pdo->commit();
            return true;
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public static function getLeaderboard(string $tab = 'Overall'): array
    {
        $pdo = Database::getConnection();

        // Aggregating verified user XP from xp_events
        $stmt = $pdo->query(
            "SELECT u.id, u.display_name, COALESCE(SUM(x.xp), 0) AS total_xp
             FROM users u
             LEFT JOIN xp_events x ON u.id = x.user_id
             WHERE u.status = 'active'
             GROUP BY u.id, u.display_name
             ORDER BY total_xp DESC
             LIMIT 20"
        );
        $users = $stmt->fetchAll();

        // Seeded default leaderboard if user community is new
        if (count($users) < 3) {
            $defaultPodium = [
                ['display_name' => 'Ada Okonkwo', 'total_xp' => 2820],
                ['display_name' => 'Tomi Adeyemi', 'total_xp' => 2540],
                ['display_name' => 'Ifeanyi Nwosu', 'total_xp' => 2380],
                ['display_name' => 'Zara Bello', 'total_xp' => 2210],
            ];
            foreach ($defaultPodium as $d) {
                if (!array_filter($users, fn($u) => $u['display_name'] === $d['display_name'])) {
                    $users[] = [
                        'id' => 'demo_' . md5($d['display_name']),
                        'display_name' => $d['display_name'],
                        'total_xp' => $d['total_xp'],
                    ];
                }
            }
            usort($users, fn($a, $b) => $b['total_xp'] <=> $a['total_xp']);
        }

        $multiplier = match ($tab) {
            'Predictor' => 0.52,
            'Boardroom' => 0.48,
            default => 1.0,
        };

        return array_map(function ($u, $idx) use ($multiplier) {
            $score = (int)round((int)$u['total_xp'] * $multiplier);
            return [
                'rank' => $idx + 1,
                'name' => $u['display_name'],
                'score' => $score,
                'level' => self::calculateLevel($score)['name'],
            ];
        }, $users, array_keys($users));
    }

    public static function askMentor(string $userId, string $query): array
    {
        $q = trim($query);
        $lower = strtolower($q);

        if (str_contains($lower, 'inflation')) {
            $answer = "Inflation represents the rate of change in the general price level across Nigeria. Look at headline CPI vs. core CPI (which removes volatile food and energy), exchange-rate pass-through, and supply shocks. In Nigeria, food inflation often dominates headline figures due to distribution and seasonal harvests.";
        } elseif (str_contains($lower, 'cbn') || str_contains($lower, 'rate') || str_contains($lower, 'mpr')) {
            $answer = "The Monetary Policy Committee (MPC) of the Central Bank of Nigeria sets the Monetary Policy Rate (MPR). An interest-rate hike aims to rein in price pressure, attract capital inflows, and support the naira, but can simultaneously raise private-sector borrowing costs and dampen industrial investment.";
        } elseif (str_contains($lower, 'runway') || str_contains($lower, 'cash')) {
            $answer = "Cash Runway = Unrestricted Liquid Cash divided by Net Monthly Cash Burn. For instance, if an agritech or fintech holds ₦42m in cash and operates with a net burn of ₦7m monthly, its runway is 6.0 months before new capital injection is required.";
        } elseif (str_contains($lower, 'risk')) {
            $answer = "A robust executive risk framework separates Market Risk (FX/interest volatility), Liquidity Risk (settlement delays), Counterparty Risk (client concentration), and Operational Risk. For each risk, quantify exposure, define decision triggers, and establish contingent mitigation steps.";
        } else {
            $answer = "To evaluate economic and business dilemmas: 1) Define the core problem and measurable KPIs. 2) Assess fundamental macro drivers. 3) Build base, upside, and downside scenarios. 4) Quantify financial implications before taking action.";
        }

        return [
            'question' => $q,
            'answer' => $answer,
            'source' => 'EconSim Macroeconomic Reasoning Framework',
        ];
    }

    public static function runScenarioLab(string $userId, int $rate, int $inflation, int $spend): array
    {
        // Macroeconomic educational formulation
        $modeledInflation = round($inflation - 0.3 * ($rate - 20) + 0.14 * ($spend - 12), 1);
        $creditIndex = max(10, min(90, (int)round(55 - ($rate - 20) * 1.65)));
        $investmentIndex = max(10, min(95, (int)round(64 - ($rate - 20) * 1.2 + ($spend - 12) * 0.6)));

        $explanation = $rate > 20
            ? "A tighter monetary policy rate (above 20%) restrains private lending and cools credit impulse, exerting downward pressure on demand-driven inflation."
            : "An accommodative monetary policy rate (below 20%) lowers borrowing costs and supports investment, but may heighten inflation risk if supply is inelastic.";

        return [
            'parameters' => ['rate' => $rate, 'inflation' => $inflation, 'spend' => $spend],
            'results' => [
                'modeled_inflation' => $modeledInflation,
                'credit_index' => $creditIndex,
                'investment_index' => $investmentIndex,
            ],
            'explanation' => $explanation,
        ];
    }

    private static function calculateLevel(int $xp): array
    {
        if ($xp >= 2000) {
            return ['level' => 3, 'name' => 'Strategic Analyst', 'next_milestone' => 3000, 'progress_pct' => min(100, (int)($xp / 30))];
        }
        if ($xp >= 1000) {
            return ['level' => 2, 'name' => 'Junior Analyst', 'next_milestone' => 2000, 'progress_pct' => (int)(($xp - 1000) / 10)];
        }
        return ['level' => 1, 'name' => 'Novice Analyst', 'next_milestone' => 1000, 'progress_pct' => (int)($xp / 10)];
    }
}

