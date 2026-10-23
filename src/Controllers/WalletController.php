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
        $transactions = LedgerService::getUserTransactions($user['id'], $mode);

        Response::success([
            'balance' => $balances,
            'transactions' => $transactions,
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

