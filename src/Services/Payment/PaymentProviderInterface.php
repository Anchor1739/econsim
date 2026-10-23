<?php

declare(strict_types=1);

namespace App\Services\Payment;

interface PaymentProviderInterface
{
    public function getSlug(): string;

    public function initializePayment(
        string $reference,
        int $amountMinor,
        string $currency,
        string $email,
        string $name,
        string $redirectUrl
    ): array;

    public function verifyPayment(string $reference): array;

    public function verifyWebhook(string $rawPayload, array $headers): bool;
}

