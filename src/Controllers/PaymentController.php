<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\AuthService;
use App\Services\Payment\PaymentService;
use App\Utils\Response;
use Throwable;

class PaymentController
{
    public function initialize(): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $amount = (int)($body['amount'] ?? 5000);

        try {
            $intent = PaymentService::createDepositIntent($user['id'], $amount);
            Response::success($intent, 'Payment checkout session created.');
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function verify(string $reference): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        try {
            $res = PaymentService::confirmDeposit($reference);
            Response::success($res, 'Payment verified.');
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function flutterwaveWebhook(): void
    {
        $raw = file_get_contents('php://input');
        $headers = getallheaders() ?: [];

        $provider = new \App\Services\Payment\FlutterwaveProvider();
        if (!$provider->verifyWebhook($raw, $headers)) {
            Response::error('Invalid webhook signature', 401);
        }

        $data = json_decode($raw, true) ?? [];
        $ref = $data['data']['tx_ref'] ?? null;

        if ($ref) {
            PaymentService::confirmDeposit($ref);
        }

        Response::success(null, 'Webhook processed.');
    }

    public function korapayWebhook(): void
    {
        $raw = file_get_contents('php://input');
        $headers = getallheaders() ?: [];

        $provider = new \App\Services\Payment\KorapayProvider();
        if (!$provider->verifyWebhook($raw, $headers)) {
            Response::error('Invalid webhook signature', 401);
        }

        $data = json_decode($raw, true) ?? [];
        $ref = $data['data']['reference'] ?? null;

        if ($ref) {
            PaymentService::confirmDeposit($ref);
        }

        Response::success(null, 'Webhook processed.');
    }
}

