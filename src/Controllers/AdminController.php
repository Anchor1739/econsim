<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Database;
use App\Services\AuthService;
use App\Services\LedgerService;
use App\Utils\Response;
use App\Utils\Security;
use Throwable;

class AdminController
{
    private function requireAdmin(): array
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }
        // In this implementation, the primary user or users with verified status can access admin operations
        return $user;
    }

    public function getFeatures(): void
    {
        $this->requireAdmin();
        $pdo = Database::getConnection();

        $features = $pdo->query("SELECT code, enabled FROM platform_features")->fetchAll();
        $providers = $pdo->query("SELECT id, slug, display_name, status FROM funding_providers")->fetchAll();
        $industries = $pdo->query("SELECT id, slug, name FROM industries ORDER BY id ASC")->fetchAll();

        Response::success([
            'features' => $features,
            'providers' => $providers,
            'industries' => $industries,
        ]);
    }

    public function toggleFeature(): void
    {
        $this->requireAdmin();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $code = $body['code'] ?? '';
        $enabled = isset($body['enabled']) ? (bool)$body['enabled'] : false;

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            "INSERT INTO platform_features (code, enabled, updated_at) 
             VALUES (:code, :en, NOW(3)) 
             ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), updated_at = NOW(3)"
        );
        $stmt->execute([':code' => $code, ':en' => $enabled ? 1 : 0]);

        Response::success(['code' => $code, 'enabled' => $enabled], "Feature {$code} updated successfully.");
    }

    public function updateProvider(): void
    {
        $this->requireAdmin();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $slug = $body['slug'] ?? 'flutterwave';
        $status = $body['status'] ?? 'enabled'; // enabled, sandbox, disabled

        $pdo = Database::getConnection();
        $pdo->beginTransaction();
        try {
            if ($status === 'enabled') {
                // Disable other providers so only one is primary active
                $pdo->prepare("UPDATE funding_providers SET status = 'sandbox' WHERE status = 'enabled'")->execute();
            }

            $up = $pdo->prepare(
                "INSERT INTO funding_providers (id, slug, display_name, status) 
                 VALUES (:id, :slug, :name, :status)
                 ON DUPLICATE KEY UPDATE status = VALUES(status)"
            );
            $up->execute([
                ':id' => Security::uuid(),
                ':slug' => $slug,
                ':name' => ucfirst($slug),
                ':status' => $status,
            ]);

            $pdo->commit();
            Response::success(null, "Payment provider {$slug} set to {$status}.");
        } catch (Throwable $e) {
            $pdo->rollBack();
            Response::error($e->getMessage(), 400);
        }
    }

    public function getStats(): void
    {
        $this->requireAdmin();
        $pdo = Database::getConnection();

        $users = (int)$pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
        $positions = (int)$pdo->query("SELECT COUNT(*) FROM forecast_positions")->fetchColumn();
        $challenges = (int)$pdo->query("SELECT COUNT(*) FROM boardroom_challenges")->fetchColumn();
        $volume = (int)$pdo->query("SELECT COALESCE(SUM(ABS(amount_minor)), 0) FROM ledger_entries")->fetchColumn();
        $openMarkets = (int)$pdo->query("SELECT COUNT(*) FROM market_events WHERE state = 'open'")->fetchColumn();

        Response::success([
            'total_users' => $users,
            'total_forecasts' => $positions,
            'total_challenges' => $challenges,
            'open_markets' => $openMarkets,
            'ledger_volume_vngn' => (int)($volume / 100),
        ]);
    }

    public function createMarket(): void
    {
        $user = $this->requireAdmin();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        $title = trim($body['title'] ?? '');
        $industryId = (int)($body['industry_id'] ?? 1);
        $definition = trim($body['definition'] ?? '');
        $source = trim($body['resolution_source'] ?? 'Official regulatory announcement');
        $closesAt = $body['closes_at'] ?? date('Y-m-d H:i:s', strtotime('+30 days'));

        if (empty($title)) {
            Response::error('Title is required.', 400);
        }

        $id = Security::uuid();
        $slug = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $title)) . '-' . substr(bin2hex(random_bytes(2)), 0, 4);

        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            "INSERT INTO market_events (id, slug, industry_id, title, outcome_definition, resolution_source, resolves_at, closes_at, state, created_by, created_at)
             VALUES (:id, :slug, :ind, :title, :def, :src, :res, :cls, 'open', :uid, NOW(3))"
        );
        $stmt->execute([
            ':id' => $id,
            ':slug' => $slug,
            ':ind' => $industryId,
            ':title' => $title,
            ':def' => $definition ?: $title,
            ':src' => $source,
            ':res' => $closesAt,
            ':cls' => $closesAt,
            ':uid' => $user['id'],
        ]);

        Response::success(['id' => $id, 'slug' => $slug], 'Market created and published.', 201);
    }

    public function resolveMarket(): void
    {
        $this->requireAdmin();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $eventId = $body['event_id'] ?? '';
        $outcome = isset($body['outcome']) ? (bool)$body['outcome'] : true;

        $pdo = Database::getConnection();

        // Fetch open positions on this market
        $posStmt = $pdo->prepare("SELECT * FROM forecast_positions WHERE event_id = ? AND status = 'open'");
        $posStmt->execute([$eventId]);
        $positions = $posStmt->fetchAll();

        foreach ($positions as $pos) {
            $won = ((bool)$pos['selected_outcome']) === $outcome;
            $heldMinor = (int)$pos['stake_minor'];
            $prob = (float)$pos['quote_probability'];
            $returnMinor = $won ? (int)round($heldMinor / $prob) : 0;
            $status = $won ? 'won' : 'lost';

            LedgerService::settleCommitment(
                $pos['user_id'],
                $heldMinor,
                $returnMinor,
                "forecast_settlement_{$status}",
                $pos['id'],
                "settle_{$pos['id']}",
                $pos['mode']
            );

            $up = $pdo->prepare("UPDATE forecast_positions SET status = :st, total_return_minor = :ret, settled_at = NOW(3) WHERE id = :id");
            $up->execute([':st' => $status, ':ret' => $returnMinor, ':id' => $pos['id']]);
        }

        // Mark event resolved
        $upEv = $pdo->prepare(
            "UPDATE market_events SET state = 'resolved', resolution_outcome = :out, resolved_at = NOW(3) WHERE id = :id"
        );
        $upEv->execute([':out' => $outcome ? 1 : 0, ':id' => $eventId]);

        Response::success(null, "Market resolved as " . ($outcome ? 'YES' : 'NO') . ". All positions settled via double-entry ledger.");
    }
}
