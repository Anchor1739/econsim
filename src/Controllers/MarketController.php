<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\AuthService;
use App\Services\PredictorService;
use App\Utils\Response;
use Throwable;

class MarketController
{
    public function getMarkets(): void
    {
        $sector = $_GET['sector'] ?? null;
        try {
            $markets = PredictorService::getMarkets($sector);
            Response::success($markets);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function getMarket(string $id): void
    {
        try {
            $market = PredictorService::getMarket($id);
            if (!$market) {
                Response::error('Market event not found', 404);
            }
            Response::success($market);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function placeForecast(string $id): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $outcome = isset($body['outcome']) ? (bool)$body['outcome'] : true;
        $stake = (int)($body['amount'] ?? 5000);
        $thesis = $body['thesis'] ?? null;
        $confidence = isset($body['confidence']) ? (int)$body['confidence'] : null;

        try {
            $res = PredictorService::placeForecast($user['id'], $id, $outcome, $stake, $thesis, $confidence);
            Response::success($res, 'Forecast placed successfully and recorded on the ledger.');
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function getMyForecasts(): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        try {
            $positions = PredictorService::getUserPositions($user['id']);
            Response::success($positions);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}

