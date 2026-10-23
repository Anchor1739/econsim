<?php

declare(strict_types=1);

namespace App\Services;

use App\Config\Database;
use App\Utils\Security;
use PDO;
use RuntimeException;

class PredictorService
{
    public static function getMarkets(?string $industrySlug = null): array
    {
        $pdo = Database::getConnection();

        $sql = "
            SELECT e.id, e.slug, e.title, e.outcome_definition, e.resolution_source,
                   e.resolves_at, e.closes_at, e.state, i.name AS industry_name, i.slug AS industry_slug,
                   c.summary AS study_summary, c.metrics, c.historical_cases
            FROM market_events e
            JOIN industries i ON e.industry_id = i.id
            LEFT JOIN study_context_versions c ON e.id = c.event_id AND c.version = 1
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

        return array_map(function ($ev) use ($pdo) {
            // Compute simulated or weighted probability
            $ev['metrics'] = !empty($ev['metrics']) ? json_decode((string)$ev['metrics'], true) : [];
            $ev['historical_cases'] = !empty($ev['historical_cases']) ? json_decode((string)$ev['historical_cases'], true) : [];
            
            // Baseline illustrative probabilities for Nigerian macroeconomic contracts
            $ev['probability_yes'] = match ($ev['slug']) {
                'cbn-mpr-hike' => 64,
                'dangote-cement-q4' => 42,
                'us-fed-rate-cut' => 58,
                'brent-crude-dec' => 36,
                'nigerian-food-inflation' => 47,
                default => 50,
            };

            return $ev;
        }, $events);
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
        
        $market['probability_yes'] = match ($market['slug']) {
            'cbn-mpr-hike' => 64,
            'dangote-cement-q4' => 42,
            'us-fed-rate-cut' => 58,
            'brent-crude-dec' => 36,
            'nigerian-food-inflation' => 47,
            default => 50,
        };

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
        int $stakeVngn,
        ?string $journalThesis = null,
        ?int $confidencePct = null
    ): array {
        if ($stakeVngn < 100) {
            throw new RuntimeException("Minimum virtual stake is ₦100.");
        }

        $market = self::getMarket($eventId);
        if (!$market) {
            throw new RuntimeException("Market event not found.");
        }
        if ($market['state'] !== 'open') {
            throw new RuntimeException("This market is currently {$market['state']} and not accepting forecasts.");
        }

        $stakeMinor = $stakeVngn * 100;
        $prob = $outcome ? ($market['probability_yes'] / 100) : ((100 - $market['probability_yes']) / 100);
        $prob = max(0.01, min(0.99, $prob));

        $positionId = Security::uuid();
        $idempotencyKey = "forecast_{$userId}_{$positionId}";

        // Step 1: Atomic hold on virtual capital
        LedgerService::holdCommitment(
            $userId,
            $stakeMinor,
            'forecast_stake',
            $positionId,
            $idempotencyKey,
            LedgerService::MODE_DEMO
        );

        $pdo = Database::getConnection();
        $pdo->beginTransaction();
        try {
            // Step 2: Record position
            $posStmt = $pdo->prepare(
                "INSERT INTO forecast_positions 
                    (id, event_id, user_id, mode, selected_outcome, stake_minor, quote_probability, quote_version, status, created_at)
                 VALUES 
                    (:id, :eid, :uid, 'demo', :outcome, :stake, :prob, 'quote_v1', 'open', NOW(3))"
            );
            $posStmt->execute([
                ':id' => $positionId,
                ':eid' => $market['id'],
                ':uid' => $userId,
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

            return [
                'position_id' => $positionId,
                'market_title' => $market['title'],
                'outcome' => $outcome ? 'Yes' : 'No',
                'stake' => $stakeVngn,
                'quote_probability' => round($prob * 100, 1),
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
            "SELECT p.id, p.event_id, p.selected_outcome, p.stake_minor, p.quote_probability,
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
            return [
                'id' => $r['id'],
                'title' => $r['title'],
                'industry' => $r['industry_name'],
                'outcome' => $r['selected_outcome'] ? 'Yes' : 'No',
                'stake' => $stake,
                'quote_probability' => round((float)$r['quote_probability'] * 100),
                'status' => $r['status'],
                'created_at' => $r['created_at'],
            ];
        }, $rows);
    }
}

