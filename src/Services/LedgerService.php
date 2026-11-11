<?php

declare(strict_types=1);

namespace App\Services;

use App\Config\Database;
use App\Utils\Security;
use PDO;
use RuntimeException;

class LedgerService
{
    public const CURRENCY_DEMO = 'VNGN';
    public const CURRENCY_REAL = 'NGN';
    public const MODE_DEMO = 'demo';
    public const MODE_REAL = 'real';

    public const KIND_AVAILABLE = 'user_available';
    public const KIND_HELD = 'user_held';
    public const KIND_ISSUANCE = 'platform_issuance';
    public const KIND_CLEARING = 'platform_clearing';

    /**
     * Get or create a specific ledger account for a user or system.
     */
    public static function getOrCreateAccount(
        ?string $userId,
        string $kind,
        string $mode = self::MODE_DEMO,
        string $currency = self::CURRENCY_DEMO,
        ?PDO $pdo = null
    ): string {
        $pdo = $pdo ?? Database::getConnection();

        if ($userId === null) {
            $stmt = $pdo->prepare(
                "SELECT id FROM ledger_accounts 
                 WHERE user_id IS NULL AND mode = :mode AND currency = :curr AND kind = :kind LIMIT 1"
            );
            $stmt->execute([
                ':mode' => $mode,
                ':curr' => $currency,
                ':kind' => $kind,
            ]);
        } else {
            $stmt = $pdo->prepare(
                "SELECT id FROM ledger_accounts 
                 WHERE user_id = :uid AND mode = :mode AND currency = :curr AND kind = :kind LIMIT 1"
            );
            $stmt->execute([
                ':uid' => $userId,
                ':mode' => $mode,
                ':curr' => $currency,
                ':kind' => $kind,
            ]);
        }
        $row = $stmt->fetch();
        if ($row) {
            return (string)$row['id'];
        }

        $id = Security::uuid();
        $ins = $pdo->prepare(
            "INSERT INTO ledger_accounts (id, user_id, mode, currency, kind)
             VALUES (:id, :uid, :mode, :curr, :kind)"
        );
        $ins->execute([
            ':id' => $id,
            ':uid' => $userId,
            ':mode' => $mode,
            ':curr' => $currency,
            ':kind' => $kind,
        ]);

        return $id;
    }

    /**
     * Issues the one-time 500,000 VNGN demo grant to a newly onboarded user.
     * Prevents repeat grants using a unique idempotency key.
     */
    public static function grantDemoWelcomeBalance(string $userId, int $amountVngn = 500000): bool
    {
        $pdo = Database::getConnection();
        $idempotencyKey = "onboarding_grant_{$userId}";

        // Amount in minor units (e.g. 500,000 VNGN = 50,000,000 kobo/minor units)
        $amountMinor = $amountVngn * 100;
        $ownsTransaction = false;

        try {
            if (!$pdo->inTransaction()) {
                $pdo->beginTransaction();
                $ownsTransaction = true;
            }

            // Check if already claimed
            $check = $pdo->prepare("SELECT id FROM ledger_journals WHERE idempotency_key = ? LIMIT 1");
            $check->execute([$idempotencyKey]);
            if ($check->fetch()) {
                if ($ownsTransaction && $pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                return false; // Already claimed
            }

            $userAvailableId = self::getOrCreateAccount($userId, self::KIND_AVAILABLE, self::MODE_DEMO, self::CURRENCY_DEMO, $pdo);
            $platformIssuanceId = self::getOrCreateAccount(null, self::KIND_ISSUANCE, self::MODE_DEMO, self::CURRENCY_DEMO, $pdo);

            $journalId = Security::uuid();
            $jStmt = $pdo->prepare(
                "INSERT INTO ledger_journals (id, idempotency_key, mode, currency, event_type, reference_id, state, posted_at)
                 VALUES (:id, :key, :mode, :curr, 'demo_onboarding_grant', :ref, 'posted', NOW(3))"
            );
            $jStmt->execute([
                ':id' => $journalId,
                ':key' => $idempotencyKey,
                ':mode' => self::MODE_DEMO,
                ':curr' => self::CURRENCY_DEMO,
                ':ref' => $userId,
            ]);

            // Leg 1: Debit platform issuance
            $e1 = $pdo->prepare("INSERT INTO ledger_entries (id, journal_id, account_id, amount_minor) VALUES (:id, :jid, :aid, :amt)");
            $e1->execute([
                ':id' => Security::uuid(),
                ':jid' => $journalId,
                ':aid' => $platformIssuanceId,
                ':amt' => -$amountMinor,
            ]);

            // Leg 2: Credit user available
            $e2 = $pdo->prepare("INSERT INTO ledger_entries (id, journal_id, account_id, amount_minor) VALUES (:id, :jid, :aid, :amt)");
            $e2->execute([
                ':id' => Security::uuid(),
                ':jid' => $journalId,
                ':aid' => $userAvailableId,
                ':amt' => $amountMinor,
            ]);

            if ($ownsTransaction && $pdo->inTransaction()) {
                $pdo->commit();
            }
            return true;
        } catch (\Throwable $e) {
            if ($ownsTransaction && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw new RuntimeException("Failed to grant demo balance: " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Reserving funds (e.g. placing a prediction stake or accepting a boardroom challenge).
     * Moves funds from user_available to user_held atomically.
     */
    public static function holdCommitment(
        string $userId,
        int $amountMinor,
        string $eventType,
        string $referenceId,
        string $idempotencyKey,
        string $mode = self::MODE_DEMO
    ): bool {
        if ($amountMinor <= 0) {
            throw new RuntimeException("Hold amount must be strictly positive.");
        }

        $currency = $mode === self::MODE_DEMO ? self::CURRENCY_DEMO : self::CURRENCY_REAL;
        $pdo = Database::getConnection();
        $ownsTransaction = false;

        try {
            if (!$pdo->inTransaction()) {
                $pdo->beginTransaction();
                $ownsTransaction = true;
            }

            $userAvailableId = self::getOrCreateAccount($userId, self::KIND_AVAILABLE, $mode, $currency, $pdo);
            $userHeldId = self::getOrCreateAccount($userId, self::KIND_HELD, $mode, $currency, $pdo);

            // Row-level lock and verify available balance
            $balStmt = $pdo->prepare(
                "SELECT COALESCE(SUM(amount_minor), 0) AS balance 
                 FROM ledger_entries WHERE account_id = :aid FOR UPDATE"
            );
            $balStmt->execute([':aid' => $userAvailableId]);
            $currentAvailable = (int)$balStmt->fetchColumn();

            if ($currentAvailable < $amountMinor) {
                if ($ownsTransaction && $pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw new RuntimeException("Insufficient available funds for this commitment.");
            }

            $journalId = Security::uuid();
            $jStmt = $pdo->prepare(
                "INSERT INTO ledger_journals (id, idempotency_key, mode, currency, event_type, reference_id, state, posted_at)
                 VALUES (:id, :key, :mode, :curr, :event, :ref, 'posted', NOW(3))"
            );
            $jStmt->execute([
                ':id' => $journalId,
                ':key' => $idempotencyKey,
                ':mode' => $mode,
                ':curr' => $currency,
                ':event' => $eventType,
                ':ref' => $referenceId,
            ]);

            // Leg 1: Deduct from available
            $e1 = $pdo->prepare("INSERT INTO ledger_entries (id, journal_id, account_id, amount_minor) VALUES (:id, :jid, :aid, :amt)");
            $e1->execute([
                ':id' => Security::uuid(),
                ':jid' => $journalId,
                ':aid' => $userAvailableId,
                ':amt' => -$amountMinor,
            ]);

            // Leg 2: Add to held
            $e2 = $pdo->prepare("INSERT INTO ledger_entries (id, journal_id, account_id, amount_minor) VALUES (:id, :jid, :aid, :amt)");
            $e2->execute([
                ':id' => Security::uuid(),
                ':jid' => $journalId,
                ':aid' => $userHeldId,
                ':amt' => $amountMinor,
            ]);

            if ($ownsTransaction && $pdo->inTransaction()) {
                $pdo->commit();
            }
            return true;
        } catch (\Throwable $e) {
            if ($ownsTransaction && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Settles held commitment (e.g. market resolved won/lost/void).
     */
    public static function settleCommitment(
        string $userId,
        int $heldMinor,
        int $returnMinor,
        string $eventType,
        string $referenceId,
        string $idempotencyKey,
        string $mode = self::MODE_DEMO
    ): bool {
        $currency = $mode === self::MODE_DEMO ? self::CURRENCY_DEMO : self::CURRENCY_REAL;
        $pdo = Database::getConnection();
        $ownsTransaction = false;

        try {
            if (!$pdo->inTransaction()) {
                $pdo->beginTransaction();
                $ownsTransaction = true;
            }

            $userAvailableId = self::getOrCreateAccount($userId, self::KIND_AVAILABLE, $mode, $currency, $pdo);
            $userHeldId = self::getOrCreateAccount($userId, self::KIND_HELD, $mode, $currency, $pdo);
            $platformClearingId = self::getOrCreateAccount(null, self::KIND_CLEARING, $mode, $currency, $pdo);

            $journalId = Security::uuid();
            $jStmt = $pdo->prepare(
                "INSERT INTO ledger_journals (id, idempotency_key, mode, currency, event_type, reference_id, state, posted_at)
                 VALUES (:id, :key, :mode, :curr, :event, :ref, 'posted', NOW(3))"
            );
            $jStmt->execute([
                ':id' => $journalId,
                ':key' => $idempotencyKey,
                ':mode' => $mode,
                ':curr' => $currency,
                ':event' => $eventType,
                ':ref' => $referenceId,
            ]);

            // Release from held
            $eHeld = $pdo->prepare("INSERT INTO ledger_entries (id, journal_id, account_id, amount_minor) VALUES (:id, :jid, :aid, :amt)");
            $eHeld->execute([
                ':id' => Security::uuid(),
                ':jid' => $journalId,
                ':aid' => $userHeldId,
                ':amt' => -$heldMinor,
            ]);

            // Credit user with return
            if ($returnMinor > 0) {
                $eRet = $pdo->prepare("INSERT INTO ledger_entries (id, journal_id, account_id, amount_minor) VALUES (:id, :jid, :aid, :amt)");
                $eRet->execute([
                    ':id' => Security::uuid(),
                    ':jid' => $journalId,
                    ':aid' => $userAvailableId,
                    ':amt' => $returnMinor,
                ]);
            }

            // Clearing balance delta (heldMinor - returnMinor)
            $clearingDelta = $heldMinor - $returnMinor;
            if ($clearingDelta !== 0) {
                $eClr = $pdo->prepare("INSERT INTO ledger_entries (id, journal_id, account_id, amount_minor) VALUES (:id, :jid, :aid, :amt)");
                $eClr->execute([
                    ':id' => Security::uuid(),
                    ':jid' => $journalId,
                    ':aid' => $platformClearingId,
                    ':amt' => $clearingDelta,
                ]);
            }

            if ($ownsTransaction && $pdo->inTransaction()) {
                $pdo->commit();
            }
            return true;
        } catch (\Throwable $e) {
            if ($ownsTransaction && $pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Compute authoritative projected balance for a user.
     */
    public static function getUserBalances(string $userId, string $mode = self::MODE_DEMO): array
    {
        $currency = $mode === self::MODE_DEMO ? self::CURRENCY_DEMO : self::CURRENCY_REAL;
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare(
            "SELECT a.kind, COALESCE(SUM(e.amount_minor), 0) AS total_minor
             FROM ledger_accounts a
             LEFT JOIN ledger_entries e ON a.id = e.account_id
             WHERE a.user_id = :uid AND a.mode = :mode AND a.currency = :curr
             GROUP BY a.kind"
        );
        $stmt->execute([
            ':uid' => $userId,
            ':mode' => $mode,
            ':curr' => $currency,
        ]);
        $rows = $stmt->fetchAll();

        $availableMinor = 0;
        $heldMinor = 0;

        foreach ($rows as $row) {
            if ($row['kind'] === self::KIND_AVAILABLE) {
                $availableMinor = (int)$row['total_minor'];
            } elseif ($row['kind'] === self::KIND_HELD) {
                $heldMinor = (int)$row['total_minor'];
            }
        }

        return [
            'mode' => $mode,
            'currency' => $currency,
            'available_minor' => $availableMinor,
            'available' => (int)($availableMinor / 100),
            'held_minor' => $heldMinor,
            'held' => (int)($heldMinor / 100),
            'total_minor' => $availableMinor + $heldMinor,
            'total' => (int)(($availableMinor + $heldMinor) / 100),
        ];
    }

    /**
     * Retrieve user transaction history from the ledger.
     */
    public static function getUserTransactions(string $userId, string $mode = self::MODE_DEMO, int $limit = 50): array
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            "SELECT j.id, j.event_type, j.created_at, e.amount_minor, a.kind, j.reference_id
             FROM ledger_entries e
             JOIN ledger_journals j ON e.journal_id = j.id
             JOIN ledger_accounts a ON e.account_id = a.id
             WHERE a.user_id = :uid AND j.mode = :mode
             ORDER BY e.created_at DESC
             LIMIT :limit"
        );
        $stmt->bindValue(':uid', $userId);
        $stmt->bindValue(':mode', $mode);
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $eventDescriptions = [
            'educational_grant' => 'Educational Simulation Grant',
            'grant_disbursement' => 'Grant Capital Credited',
            'boardroom_escrow_hold' => 'Boardroom Match Commitment',
            'boardroom_resolution' => 'Boardroom Challenge Settlement',
            'boardroom_refund' => 'Boardroom Match Refund',
            'market_buy' => 'Predictor Forecast Position',
            'market_resolve_yes' => 'Predictor Settlement (YES)',
            'market_resolve_no' => 'Predictor Settlement (NO)',
            'forecast_stake' => 'Predictor Forecast Position',
            'forecast_settlement_won' => 'Predictor Payout (Won)',
            'forecast_settlement_lost' => 'Predictor Settlement (Closed)',
            'deposit' => 'Wallet Capital Deposit',
            'withdrawal' => 'Capital Withdrawal',
        ];

        $accountLabels = [
            'user_available' => 'Available Balance',
            'user_held' => 'Escrow Hold',
            'platform_issuance' => 'Platform Treasury',
            'platform_clearing' => 'Clearing House',
            'platform_revenue' => 'Platform Reserve',
            'payment_clearing' => 'Gateway Transit',
        ];

        return array_map(function ($r) use ($eventDescriptions, $accountLabels) {
            $amount = (int)($r['amount_minor'] / 100);
            $event = $r['event_type'] ?? '';
            $kind = $r['kind'] ?? '';
            $utcTs = !empty($r['created_at']) ? strtotime($r['created_at'] . ' UTC') : null;
            return [
                'id' => $r['id'],
                'event_type' => $event,
                'description' => $eventDescriptions[$event] ?? ucwords(str_replace('_', ' ', (string)$event)),
                'account_label' => $accountLabels[$kind] ?? ucwords(str_replace('_', ' ', (string)$kind)),
                'amount_minor' => (int)$r['amount_minor'],
                'amount' => $amount,
                'kind' => $kind,
                'reference_id' => $r['reference_id'],
                'created_at' => $r['created_at'],
                'created_at_iso' => $utcTs ? gmdate('Y-m-d\TH:i:s\Z', $utcTs) : null,
                'formatted' => ($amount >= 0 ? '+' : '') . '₦' . number_format(abs($amount)),
            ];
        }, $rows);
    }
}

