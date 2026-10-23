<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\AuthService;
use App\Services\LedgerService;
use App\Utils\Response;
use Throwable;

class WalletController
{
    public function getWallet(): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        $mode = $_GET['mode'] ?? ($user['preferred_mode'] ?? 'demo');
        $balances = LedgerService::getUserBalances($user['id'], $mode);
        $demoBalances = LedgerService::getUserBalances($user['id'], 'demo');
        $realBalances = LedgerService::getUserBalances($user['id'], 'real');
        $transactions = LedgerService::getUserTransactions($user['id'], $mode);

        $pdo = \App\Config\Database::getConnection();
        $provider = $pdo->query(
            "SELECT slug, display_name, status FROM funding_providers 
             WHERE status IN ('enabled', 'sandbox') 
             ORDER BY CASE WHEN status = 'enabled' THEN 1 ELSE 2 END 
             LIMIT 1"
        )->fetch() ?: ['slug' => 'flutterwave', 'display_name' => 'Flutterwave', 'status' => 'sandbox'];

        $features = $pdo->query("SELECT code, enabled FROM platform_features")->fetchAll();
        $featMap = [];
        foreach ($features as $f) {
            $featMap[$f['code']] = (bool)$f['enabled'];
        }

        Response::success([
            'balance' => $balances,
            'demo_balance' => $demoBalances,
            'real_balance' => $realBalances,
            'transactions' => $transactions,
            'active_provider' => $provider,
            'features' => $featMap,
        ]);
    }

    public function claimDemoGrant(): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        try {
            $granted = LedgerService::grantDemoWelcomeBalance($user['id'], 500000);
            if (!$granted) {
                Response::error('Demo grant has already been credited to this account.', 409);
            }
            $balances = LedgerService::getUserBalances($user['id'], 'demo');
            Response::success($balances, '₦500,000 demo capital credited to your virtual wallet.');
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }
}

