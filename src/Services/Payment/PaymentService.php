<?php

declare(strict_types=1);

namespace App\Services\Payment;

use App\Config\Database;
use App\Config\Env;
use App\Services\FeatureService;
use App\Services\LedgerService;
use App\Utils\Security;
use PDO;
use RuntimeException;

class PaymentService
{
    public static function getActiveProvider(): PaymentProviderInterface
    {
        $pdo = Database::getConnection();
        $stmt = $pdo->query(
            "SELECT slug FROM funding_providers 
             WHERE status IN ('enabled', 'sandbox') 
             ORDER BY CASE WHEN status = 'enabled' THEN 1 ELSE 2 END 
             LIMIT 1"
        );
        $slug = $stmt->fetchColumn() ?: 'flutterwave';

        return match ($slug) {
            'korapay' => new KorapayProvider(),
            default => new FlutterwaveProvider(),
        };
    }

    public static function createDepositIntent(string $userId, int $amountNgn): array
    {
        // Enforce engine toggles
        FeatureService::assertEnabled('real_mode');
        FeatureService::assertEnabled('real_funding');

        if ($amountNgn < 1000) {
            throw new RuntimeException("Minimum real account deposit is ₦1,000.");
        }

        $pdo = Database::getConnection();

        // Fetch user
        $uStmt = $pdo->prepare("SELECT email, display_name FROM users WHERE id = ?");
        $uStmt->execute([$userId]);
        $user = $uStmt->fetch();

        if (!$user) {
            throw new RuntimeException("User not found.");
        }

        $provider = self::getActiveProvider();
        $providerSlug = $provider->getSlug();

        // Get provider ID from DB
        $pStmt = $pdo->prepare("SELECT id FROM funding_providers WHERE slug = ? LIMIT 1");
        $pStmt->execute([$providerSlug]);
        $providerId = $pStmt->fetchColumn();

        if (!$providerId) {
            $providerId = Security::uuid();
            $pdo->prepare(
                "INSERT INTO funding_providers (id, slug, display_name, status) 
                 VALUES (?, ?, ?, 'sandbox')"
            )->execute([$providerId, $providerSlug, ucfirst($providerSlug)]);
        }

        $intentId = Security::uuid();
        $reference = 'DM_REAL_' . strtoupper(substr(bin2hex(random_bytes(6)), 0, 10));
        $amountMinor = $amountNgn * 100;
        $appUrl = rtrim((string)Env::get('APP_URL', 'http://localhost:8000'), '/');
        $redirectUrl = "{$appUrl}/?page=wallet&mode=real&ref={$reference}";

        // Initialize with gateway
        $gatewayResult = $provider->initializePayment(
            $reference,
            $amountMinor,
            'NGN',
            $user['email'],
            $user['display_name'],
            $redirectUrl
        );

        // Store intent
        $ins = $pdo->prepare(
            "INSERT INTO funding_intents 
                (id, user_id, provider_id, provider_reference, idempotency_key, amount_minor, currency, mode, state, provider_payload, created_at)
             VALUES 
                (:id, :uid, :pid, :ref, :idem, :amt, 'NGN', 'real', 'created', :payload, NOW(3))"
        );
        $ins->execute([
            ':id' => $intentId,
            ':uid' => $userId,
            ':pid' => $providerId,
            ':ref' => $reference,
            ':idem' => "intent_{$reference}",
            ':amt' => $amountMinor,
            ':payload' => json_encode($gatewayResult),
        ]);

        return [
            'intent_id' => $intentId,
            'reference' => $reference,
            'checkout_url' => $gatewayResult['checkout_url'],
            'provider' => $providerSlug,
            'amount_ngn' => $amountNgn,
            'real_mode_active' => FeatureService::isEnabled('real_mode'),
        ];
    }

    public static function confirmDeposit(string $reference): array
    {
        $pdo = Database::getConnection();

        $stmt = $pdo->prepare("SELECT * FROM funding_intents WHERE provider_reference = ? LIMIT 1");
        $stmt->execute([$reference]);
        $intent = $stmt->fetch();

        if (!$intent) {
            throw new RuntimeException("Funding intent not found.");
        }

        if ($intent['state'] === 'succeeded') {
            return [
                'status' => 'succeeded',
                'amount_ngn' => (int)($intent['amount_minor'] / 100),
                'already_credited' => true,
            ];
        }

        $provider = self::getActiveProvider();
        $ver = $provider->verifyPayment($reference);

        if (($ver['status'] ?? '') === 'succeeded') {
            $amountMinor = (int)$intent['amount_minor'];
            $userId = $intent['user_id'];
            $idempotencyKey = "funding_credit_{$reference}";

            $pdo->beginTransaction();
            try {
                // Update intent
                $up = $pdo->prepare("UPDATE funding_intents SET state = 'succeeded', confirmed_at = NOW(3) WHERE id = ?");
                $up->execute([$intent['id']]);

                // Credit REAL Ledger Account
                $userAvailableReal = LedgerService::getOrCreateAccount($userId, LedgerService::KIND_AVAILABLE, LedgerService::MODE_REAL, LedgerService::CURRENCY_REAL, $pdo);
                $paymentClearing = LedgerService::getOrCreateAccount(null, 'payment_clearing', LedgerService::MODE_REAL, LedgerService::CURRENCY_REAL, $pdo);

                $journalId = Security::uuid();
                $jStmt = $pdo->prepare(
                    "INSERT INTO ledger_journals (id, idempotency_key, mode, currency, event_type, reference_id, state, posted_at)
                     VALUES (:id, :key, 'real', 'NGN', 'real_funding_deposit', :ref, 'posted', NOW(3))"
                );
                $jStmt->execute([
                    ':id' => $journalId,
                    ':key' => $idempotencyKey,
                    ':ref' => $intent['id'],
                ]);

                // Leg 1: Debit payment clearing
                $e1 = $pdo->prepare("INSERT INTO ledger_entries (id, journal_id, account_id, amount_minor) VALUES (:id, :jid, :aid, :amt)");
                $e1->execute([
                    ':id' => Security::uuid(),
                    ':jid' => $journalId,
                    ':aid' => $paymentClearing,
                    ':amt' => -$amountMinor,
                ]);

                // Leg 2: Credit user real available
                $e2 = $pdo->prepare("INSERT INTO ledger_entries (id, journal_id, account_id, amount_minor) VALUES (:id, :jid, :aid, :amt)");
                $e2->execute([
                    ':id' => Security::uuid(),
                    ':jid' => $journalId,
                    ':aid' => $userAvailableReal,
                    ':amt' => $amountMinor,
                ]);

                $pdo->commit();

                return [
                    'status' => 'succeeded',
                    'amount_ngn' => (int)($amountMinor / 100),
                    'message' => 'Real funds credited to your live ledger wallet.',
                ];
            } catch (\Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
        }

        return [
            'status' => $ver['status'] ?? 'pending',
            'message' => $ver['message'] ?? 'Payment verification pending.',
        ];
    }
}

