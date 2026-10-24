<?php

declare(strict_types=1);

namespace App\Services;

use App\Config\Database;
use App\Utils\Security;
use PDO;
use RuntimeException;

class PredictorService
{
    private static array $marketCache = [];
    private static array $cacheTimestamps = [];
    private const CACHE_TTL_SECONDS = 15;

    public static function clearMarketCache(): void
    {
        self::$marketCache = [];
        self::$cacheTimestamps = [];
    }

    public static function getMarkets(?string $industrySlug = null): array
    {
        $cacheKey = $industrySlug ?: 'all';
        $now = microtime(true);

        if (
            isset(self::$marketCache[$cacheKey], self::$cacheTimestamps[$cacheKey]) &&
            ($now - self::$cacheTimestamps[$cacheKey]) < self::CACHE_TTL_SECONDS
        ) {
            return self::$marketCache[$cacheKey];
        }

        $pdo = Database::getConnection();

        // Optimized single-query retrieval with aggregated open position volume (eliminates N+1 query latency)
        $sql = "
            SELECT e.id, e.slug, e.title, e.outcome_definition, e.resolution_source,
                   e.resolves_at, e.closes_at, e.state, i.name AS industry_name, i.slug AS industry_slug,
                   c.summary AS study_summary, c.metrics, c.historical_cases,
                   COALESCE(fp.yes_volume_minor, 0) AS yes_volume_minor,
                   COALESCE(fp.no_volume_minor, 0) AS no_volume_minor,
                   COALESCE(fp.position_count, 0) AS position_count
            FROM market_events e
            JOIN industries i ON e.industry_id = i.id
            LEFT JOIN study_context_versions c ON e.id = c.event_id AND c.version = 1
            LEFT JOIN (
                SELECT event_id,
                       SUM(CASE WHEN selected_outcome = 1 THEN stake_minor ELSE 0 END) AS yes_volume_minor,
                       SUM(CASE WHEN selected_outcome = 0 THEN stake_minor ELSE 0 END) AS no_volume_minor,
                       COUNT(*) AS position_count
                FROM forecast_positions
                WHERE status = 'open'
                GROUP BY event_id
            ) fp ON e.id = fp.event_id
            WHERE e.state IN ('open', 'closed', 'resolved')
        ";

        $params = [];
        if ($industrySlug && $industrySlug !== 'All') {
            $sql .= " AND (i.slug = :slug OR i.name = :slug)";
            $params[':slug'] = $industrySlug;
        }

        $sql .= " ORDER BY e.closes_at ASC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $events = $stmt->fetchAll();

        $result = array_map(function ($ev) {
            $ev['metrics'] = !empty($ev['metrics']) ? json_decode((string)$ev['metrics'], true) : [];
            $ev['historical_cases'] = !empty($ev['historical_cases']) ? json_decode((string)$ev['historical_cases'], true) : [];
            
            // In-memory Bayesian AMM percentage probability & odds calculation (0ms extra query time)
            $dyn = self::calculateAmmMetrics(
                $ev['slug'],
                (int)$ev['yes_volume_minor'],
                (int)$ev['no_volume_minor'],
                (int)$ev['position_count']
            );
            $ev['probability_yes'] = $dyn['probability_yes'];
            $ev['probability_no'] = $dyn['probability_no'];
            $ev['odds_yes'] = $dyn['odds_yes'];
            $ev['odds_no'] = $dyn['odds_no'];
            $ev['total_volume_vngn'] = $dyn['total_volume_vngn'];
            $ev['yes_volume_vngn'] = $dyn['yes_volume_vngn'];
            $ev['no_volume_vngn'] = $dyn['no_volume_vngn'];
            $ev['position_count'] = $dyn['position_count'];

            unset($ev['yes_volume_minor'], $ev['no_volume_minor']);
            return $ev;
        }, $events);

        self::$marketCache[$cacheKey] = $result;
        self::$cacheTimestamps[$cacheKey] = $now;

        return $result;
    }

    public static function calculateAmmMetrics(string $slug, int $yesVolMinor, int $noVolMinor, int $positionCount): array
    {
        $baseline = match ($slug) {
            'cbn-mpr-hike', 'cbn-mpr-hike-50bps' => 64,
            'dangote-cement-q4', 'dangote-cement-7m-volume-sales' => 42,
            'us-fed-rate-cut' => 58,
            'brent-crude-dec' => 36,
            'nigerian-food-inflation' => 47,
            'nigeria-fx-reserves-40b' => 54,
            'ngx-asi-120k-milestone' => 61,
            'nibss-instant-payments-growth' => 72,
            'mtn-nigeria-equity-restoration' => 55,
            'nestle-nigeria-operating-profit-recovery' => 52,
            'tier1-banks-recapitalization-500b' => 78,
            'presco-cpo-revenue-130b' => 65,
            'seplat-energy-production-65k-boepd' => 59,
            default => 50,
        };

        $totalVolMinor = $yesVolMinor + $noVolMinor;

        // Bayesian AMM liquidity weighting (constant depth ₦100,000 = 10,000,000 kobo)
        $virtualDepth = 10000000;
        $priorYesMinor = (int)round($virtualDepth * ($baseline / 100));

        $probYesFloat = ($priorYesMinor + $yesVolMinor) / ($virtualDepth + $totalVolMinor);
        $probYesPct = max(5, min(95, (int)round($probYesFloat * 100)));
        $probNoPct = 100 - $probYesPct;

        $probYesDec = max(0.05, min(0.95, $probYesPct / 100));
        $probNoDec = max(0.05, min(0.95, $probNoPct / 100));

        $oddsYes = round(1.0 / $probYesDec, 2);
        $oddsNo = round(1.0 / $probNoDec, 2);

        return [
            'probability_yes' => $probYesPct,
            'probability_no' => $probNoPct,
            'odds_yes' => $oddsYes,
            'odds_no' => $oddsNo,
            'yes_volume_vngn' => (int)round($yesVolMinor / 100),
            'no_volume_vngn' => (int)round($noVolMinor / 100),
            'total_volume_vngn' => (int)round($totalVolMinor / 100),
            'position_count' => $positionCount,
        ];
    }

    public static function computeDynamicMarketMetrics(PDO $pdo, string $eventId, string $slug): array
    {
        // Query active participant forecast volume
        $volStmt = $pdo->prepare(
            "SELECT 
                COALESCE(SUM(CASE WHEN selected_outcome = 1 THEN stake_minor ELSE 0 END), 0) AS yes_volume_minor,
                COALESCE(SUM(CASE WHEN selected_outcome = 0 THEN stake_minor ELSE 0 END), 0) AS no_volume_minor,
                COUNT(*) as position_count
             FROM forecast_positions 
             WHERE event_id = ? AND status = 'open'"
        );
        $volStmt->execute([$eventId]);
        $vol = $volStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $yesVolMinor = (int)($vol['yes_volume_minor'] ?? 0);
        $noVolMinor = (int)($vol['no_volume_minor'] ?? 0);
        $positionCount = (int)($vol['position_count'] ?? 0);

        return self::calculateAmmMetrics($slug, $yesVolMinor, $noVolMinor, $positionCount);
    }

    public static function getMarket(string $id): ?array
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            "SELECT e.*, i.name AS industry_name, i.slug AS industry_slug,
                    c.summary AS study_summary, c.metrics, c.historical_cases
             FROM market_events e
             JOIN industries i ON e.industry_id = i.id
             LEFT JOIN study_context_versions c ON e.id = c.event_id AND c.version = 1
             WHERE e.id = ? OR e.slug = ? LIMIT 1"
        );
        $stmt->execute([$id, $id]);
        $market = $stmt->fetch();

        if (!$market) {
            return null;
        }

        $market['metrics'] = !empty($market['metrics']) ? json_decode((string)$market['metrics'], true) : [];
        $market['historical_cases'] = !empty($market['historical_cases']) ? json_decode((string)$market['historical_cases'], true) : [];
        
        $dyn = self::computeDynamicMarketMetrics($pdo, $market['id'], $market['slug']);
        $market['probability_yes'] = $dyn['probability_yes'];
        $market['probability_no'] = $dyn['probability_no'];
        $market['odds_yes'] = $dyn['odds_yes'];
        $market['odds_no'] = $dyn['odds_no'];
        $market['total_volume_vngn'] = $dyn['total_volume_vngn'];
        $market['yes_volume_vngn'] = $dyn['yes_volume_vngn'];
        $market['no_volume_vngn'] = $dyn['no_volume_vngn'];
        $market['position_count'] = $dyn['position_count'];

        // Fetch sources
        $sStmt = $pdo->prepare(
            "SELECT s.name, s.publisher, s.origin_url, s.published_at
             FROM study_context_versions c
             JOIN study_context_sources cs ON c.id = cs.context_id
             JOIN external_sources s ON cs.source_id = s.id
             WHERE c.event_id = ?"
        );
        $sStmt->execute([$market['id']]);
        $market['sources'] = $sStmt->fetchAll();

        return $market;
    }

    public static function placeForecast(
        string $userId,
        string $eventId,
        bool $outcome,
        int $stakeAmount,
        ?string $journalThesis = null,
        ?int $confidencePct = null,
        string $mode = LedgerService::MODE_DEMO
    ): array {
        $normalizedMode = (strtolower($mode) === LedgerService::MODE_REAL) ? LedgerService::MODE_REAL : LedgerService::MODE_DEMO;

        if ($normalizedMode === LedgerService::MODE_REAL) {
            FeatureService::assertEnabled('real_mode');
        }

        if ($stakeAmount < 100) {
            $currencyLabel = ($normalizedMode === LedgerService::MODE_REAL) ? '₦' : '₦';
            throw new RuntimeException("Minimum stake is {$currencyLabel}100.");
        }

        $market = self::getMarket($eventId);
        if (!$market) {
            throw new RuntimeException("Market event not found.");
        }
        if ($market['state'] !== 'open') {
            throw new RuntimeException("This market is currently {$market['state']} and not accepting forecasts.");
        }

        $stakeMinor = $stakeAmount * 100;
        $probPct = $outcome ? $market['probability_yes'] : $market['probability_no'];
        $prob = max(0.05, min(0.95, $probPct / 100));
        $entryOdds = round(1.0 / $prob, 2);
        $potentialPayout = (int)round($stakeAmount * $entryOdds);

        $positionId = Security::uuid();
        $idempotencyKey = "forecast_{$userId}_{$positionId}";

        // Step 1: Atomic hold on capital (virtual or live real)
        LedgerService::holdCommitment(
            $userId,
            $stakeMinor,
            'forecast_stake',
            $positionId,
            $idempotencyKey,
            $normalizedMode
        );

        $pdo = Database::getConnection();
        $pdo->beginTransaction();
        try {
            // Step 2: Record position with exact point-in-time entry odds
            $posStmt = $pdo->prepare(
                "INSERT INTO forecast_positions 
                    (id, event_id, user_id, mode, selected_outcome, stake_minor, quote_probability, quote_version, status, created_at)
                 VALUES 
                    (:id, :eid, :uid, :mode, :outcome, :stake, :prob, 'quote_v1', 'open', NOW(3))"
            );
            $posStmt->execute([
                ':id' => $positionId,
                ':eid' => $market['id'],
                ':uid' => $userId,
                ':mode' => $normalizedMode,
                ':outcome' => $outcome ? 1 : 0,
                ':stake' => $stakeMinor,
                ':prob' => $prob,
            ]);

            // Step 3: Record journal if thesis provided
            if (!empty($journalThesis)) {
                $jId = Security::uuid();
                $jStmt = $pdo->prepare(
                    "INSERT INTO decision_journal (id, user_id, event_id, position_id, thesis, confidence_pct, created_at, updated_at)
                     VALUES (:id, :uid, :eid, :pid, :thesis, :conf, NOW(3), NOW(3))"
                );
                $jStmt->execute([
                    ':id' => $jId,
                    ':uid' => $userId,
                    ':eid' => $market['id'],
                    ':pid' => $positionId,
                    ':thesis' => trim($journalThesis),
                    ':conf' => $confidencePct !== null ? max(0, min(100, $confidencePct)) : null,
                ]);
            }

            // Step 4: Award literacy XP
            $xpId = Security::uuid();
            $xpStmt = $pdo->prepare(
                "INSERT INTO xp_events (id, user_id, xp, reason, source_key, created_at)
                 VALUES (:id, :uid, 25, 'Placed market forecast', :skey, NOW(3))"
            );
            $xpStmt->execute([
                ':id' => $xpId,
                ':uid' => $userId,
                ':skey' => "xp_forecast_{$positionId}",
            ]);

            $pdo->commit();
            self::clearMarketCache();

            return [
                'position_id' => $positionId,
                'market_title' => $market['title'],
                'outcome' => $outcome ? 'Yes' : 'No',
                'stake' => $stakeAmount,
                'quote_probability' => round($prob * 100, 1),
                'entry_odds' => $entryOdds,
                'potential_payout' => $potentialPayout,
                'mode' => $normalizedMode,
                'currency' => ($normalizedMode === LedgerService::MODE_REAL ? 'NGN' : 'VNGN'),
                'xp_awarded' => 25,
            ];
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    public static function getUserPositions(string $userId): array
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            "SELECT p.id, p.event_id, p.mode, p.selected_outcome, p.stake_minor, p.quote_probability,
                    p.status, p.total_return_minor, p.created_at, e.title, e.slug, i.name AS industry_name
             FROM forecast_positions p
             JOIN market_events e ON p.event_id = e.id
             JOIN industries i ON e.industry_id = i.id
             WHERE p.user_id = ?
             ORDER BY p.created_at DESC"
        );
        $stmt->execute([$userId]);
        $rows = $stmt->fetchAll();

        return array_map(function ($r) {
            $stake = (int)($r['stake_minor'] / 100);
            $prob = (float)$r['quote_probability'];
            $probPct = round($prob * 100, 1);
            $entryOdds = $prob > 0 ? round(1.0 / $prob, 2) : 2.0;
            $potentialPayout = (int)round($stake * $entryOdds);
            $totalReturn = $r['total_return_minor'] !== null ? (int)round($r['total_return_minor'] / 100) : null;
            $posMode = $r['mode'] ?? 'demo';

            return [
                'id' => $r['id'],
                'event_id' => $r['event_id'],
                'title' => $r['title'],
                'slug' => $r['slug'],
                'industry' => $r['industry_name'],
                'outcome' => $r['selected_outcome'] ? 'Yes' : 'No',
                'stake' => $stake,
                'quote_probability' => $probPct,
                'entry_odds' => $entryOdds,
                'potential_payout' => $potentialPayout,
                'total_return' => $totalReturn,
                'mode' => $posMode,
                'currency' => ($posMode === 'real' ? 'NGN' : 'VNGN'),
                'status' => $r['status'],
                'created_at' => $r['created_at'],
            ];
        }, $rows);
    }

    public static function runRealtimeMaintenance(): array
    {
        $pdo = Database::getConnection();
        $updates = [
            'closed_markets_count' => 0,
            'timestamp' => date('Y-m-d H:i:s'),
        ];

        // Automatically close open markets where closes_at has passed
        $closeStmt = $pdo->prepare("
            UPDATE market_events 
            SET state = 'closed' 
            WHERE state = 'open' AND closes_at <= NOW()
        ");
        $closeStmt->execute();
        $updates['closed_markets_count'] = $closeStmt->rowCount();

        if ($updates['closed_markets_count'] > 0) {
            self::clearMarketCache();
        }

        return $updates;
    }
}

