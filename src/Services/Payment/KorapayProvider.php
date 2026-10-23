<?php

declare(strict_types=1);

namespace App\Services\Payment;

use App\Config\Env;
use RuntimeException;

class KorapayProvider implements PaymentProviderInterface
{
    private string $secretKey;

    public function __construct()
    {
        $this->secretKey = (string)Env::get('KORAPAY_SECRET_KEY', '');
    }

    public function getSlug(): string
    {
        return 'korapay';
    }

    public function initializePayment(
        string $reference,
        int $amountMinor,
        string $currency,
        string $email,
        string $name,
        string $redirectUrl
    ): array {
        if (empty($this->secretKey)) {
            // Mock sandbox fallback
            return [
                'status' => 'success',
                'checkout_url' => "{$redirectUrl}?status=success&reference={$reference}",
                'reference' => $reference,
                'provider' => 'korapay',
                'mode' => 'sandbox_preview',
            ];
        }

        $amountNgn = $amountMinor / 100;
        $payload = [
            'reference' => $reference,
            'amount' => $amountNgn,
            'currency' => $currency,
            'redirect_url' => $redirectUrl,
            'customer' => [
                'name' => $name,
                'email' => $email,
            ],
            'narration' => 'Developing Market Real Account Deposit',
        ];

        $ch = curl_init('https://api.korapay.com/merchant/api/v1/charges/initialize');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->secretKey,
                'Content-Type: application/json',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 20,
        ]);

        $res = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $data = json_decode((string)$res, true) ?? [];

        if ($httpCode >= 200 && $httpCode < 300 && ($data['status'] ?? false)) {
            return [
                'status' => 'success',
                'checkout_url' => $data['data']['checkout_url'],
                'reference' => $reference,
                'provider' => 'korapay',
            ];
        }

        throw new RuntimeException("Korapay initialization failed: " . ($data['message'] ?? 'Unknown gateway error'));
    }

    public function verifyPayment(string $reference): array
    {
        if (empty($this->secretKey)) {
            return [
                'status' => 'succeeded',
                'amount_minor' => 1000000,
                'currency' => 'NGN',
                'reference' => $reference,
            ];
        }

        $url = 'https://api.korapay.com/merchant/api/v1/charges/' . urlencode($reference);
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->secretKey,
                'Content-Type: application/json',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 20,
        ]);

        $res = curl_exec($ch);
        curl_close($ch);
        $data = json_decode((string)$res, true) ?? [];

        if (($data['status'] ?? false) && ($data['data']['status'] ?? '') === 'success') {
            return [
                'status' => 'succeeded',
                'amount_minor' => (int)round(((float)$data['data']['amount']) * 100),
                'currency' => $data['data']['currency'],
                'reference' => $reference,
                'provider_transaction_id' => (string)($data['data']['transaction_reference'] ?? ''),
            ];
        }

        return [
            'status' => 'failed',
            'reference' => $reference,
            'message' => $data['message'] ?? 'Korapay transaction not successful',
        ];
    }

    public function verifyWebhook(string $rawPayload, array $headers): bool
    {
        if (empty($this->secretKey)) {
            return true;
        }

        $signature = $headers['x-korapay-signature'] ?? $headers['X-Korapay-Signature'] ?? $_SERVER['HTTP_X_KORAPAY_SIGNATURE'] ?? '';
        $expected = hash_hmac('sha256', $rawPayload, $this->secretKey);
        return hash_equals($expected, $signature);
    }
}

