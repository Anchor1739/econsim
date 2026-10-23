<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Database;
use App\Services\AuthService;
use App\Services\FeatureService;
use App\Services\LedgerService;
use App\Utils\Response;
use App\Utils\Security;
use Throwable;
use RuntimeException;

class WalletController
{
    public function getWallet(): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        $rawMode = strtolower($_GET['mode'] ?? ($user['preferred_mode'] ?? 'demo'));
        $mode = ($rawMode === 'real') ? 'real' : 'demo';

        $balances = LedgerService::getUserBalances($user['id'], $mode);
        $demoBalances = LedgerService::getUserBalances($user['id'], 'demo');
        $realBalances = LedgerService::getUserBalances($user['id'], 'real');
        $transactions = LedgerService::getUserTransactions($user['id'], $mode);

        $provider = FeatureService::getActiveProvider();
        $features = FeatureService::getAllFeatures();

        Response::success([
            'balance' => $balances,
            'demo_balance' => $demoBalances,
            'real_balance' => $realBalances,
            'transactions' => $transactions,
            'active_provider' => $provider,
            'features' => $features,
        ]);
    }

    public function getFeatures(): void
    {
        $features = FeatureService::getAllFeatures();
        $provider = FeatureService::getActiveProvider();
        $aiModel = FeatureService::getActiveAiModel();

        Response::success([
            'features' => $features,
            'active_provider' => $provider,
            'active_ai_model' => $aiModel,
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

    public function withdraw(): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $amount = (int)($body['amount'] ?? 0);
        $bankName = trim((string)($body['bank_name'] ?? ''));
        $accountNumber = trim((string)($body['account_number'] ?? ''));
        $accountName = trim((string)($body['account_name'] ?? ''));

        if ($amount < 1000) {
            Response::error('Minimum settlement withdrawal is ₦1,000.', 400);
            return;
        }

        if (empty($bankName) || strlen($accountNumber) !== 10 || empty($accountName)) {
            Response::error('Please provide valid bank name, 10-digit NUBAN account number, and account holder name.', 400);
            return;
        }

        try {
            // Strictly enforce engine toggles
            FeatureService::assertEnabled('real_mode');
            FeatureService::assertEnabled('real_payouts');

            $amountMinor = $amount * 100;
            $pdo = Database::getConnection();
            $pdo->beginTransaction();

            try {
                $userRealAccount = LedgerService::getOrCreateAccount($user['id'], LedgerService::KIND_AVAILABLE, LedgerService::MODE_REAL, LedgerService::CURRENCY_REAL, $pdo);
                $payoutClearingAccount = LedgerService::getOrCreateAccount(null, 'payment_clearing', LedgerService::MODE_REAL, LedgerService::CURRENCY_REAL, $pdo);

                // Concurrency-safe row-level balance lock
                $balStmt = $pdo->prepare(
                    "SELECT COALESCE(SUM(amount_minor), 0) AS balance_minor 
                     FROM ledger_entries 
                     WHERE account_id = :aid FOR UPDATE"
                );
                $balStmt->execute([':aid' => $userRealAccount]);
                $availMinor = (int)$balStmt->fetchColumn();

                if ($availMinor < $amountMinor) {
                    throw new RuntimeException("Insufficient live balance for withdrawal. Available: ₦" . number_format($availMinor / 100));
                }

                $withdrawalRef = 'DM_WD_' . strtoupper(substr(bin2hex(random_bytes(6)), 0, 10));
                $journalId = Security::uuid();
                $idempotencyKey = "wd_{$user['id']}_{$withdrawalRef}";

                $jStmt = $pdo->prepare(
                    "INSERT INTO ledger_journals (id, idempotency_key, mode, currency, event_type, reference_id, state, posted_at)
                     VALUES (:id, :key, 'real', 'NGN', 'real_payout_settlement', :ref, 'posted', NOW(3))"
                );
                $jStmt->execute([
                    ':id' => $journalId,
                    ':key' => $idempotencyKey,
                    ':ref' => $withdrawalRef,
                ]);

                // Leg 1: Debit user real available account
                $e1 = $pdo->prepare("INSERT INTO ledger_entries (id, journal_id, account_id, amount_minor) VALUES (:id, :jid, :aid, :amt)");
                $e1->execute([
                    ':id' => Security::uuid(),
                    ':jid' => $journalId,
                    ':aid' => $userRealAccount,
                    ':amt' => -$amountMinor,
                ]);

                // Leg 2: Credit payment clearing account
                $e2 = $pdo->prepare("INSERT INTO ledger_entries (id, journal_id, account_id, amount_minor) VALUES (:id, :jid, :aid, :amt)");
                $e2->execute([
                    ':id' => Security::uuid(),
                    ':jid' => $journalId,
                    ':aid' => $payoutClearingAccount,
                    ':amt' => $amountMinor,
                ]);

                $pdo->commit();

                $newBalances = LedgerService::getUserBalances($user['id'], LedgerService::MODE_REAL);

                Response::success([
                    'withdrawal_reference' => $withdrawalRef,
                    'amount' => $amount,
                    'bank_name' => $bankName,
                    'account_number' => $accountNumber,
                    'account_name' => $accountName,
                    'real_balance' => $newBalances,
                ], "Settlement withdrawal of ₦" . number_format($amount) . " queued for NIBSS transfer to {$bankName} ({$accountNumber}).");
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }
}
