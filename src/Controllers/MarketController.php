<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\AuthService;
use App\Services\BoardroomService;
use App\Services\KeepAliveService;
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
        $mode = $body['mode'] ?? 'demo';

        try {
            $res = PredictorService::placeForecast($user['id'], $id, $outcome, $stake, $thesis, $confidence, $mode);
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

    public function runCron(): void
    {
        try {
            $keepAlive = KeepAliveService::pingDatabase();
            $predictor = PredictorService::runRealtimeMaintenance();
            $boardroomNotifs = BoardroomService::checkAndDispatchScheduledNotifications();
            $boardroom = BoardroomService::processQueuedEvaluations(5);

            $payload = [
                'server_time' => date('Y-m-d H:i:s T'),
                'render_status' => 'warm_active',
                'aiven_keep_alive' => $keepAlive,
                'predictor' => $predictor,
                'boardroom_notifications' => $boardroomNotifs,
                'boardroom' => $boardroom,
            ];

            Response::success($payload, 'Platform background worker and Aiven keep-alive query completed successfully.');
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function keepAlive(): void
    {
        try {
            $keepAlive = KeepAliveService::pingDatabase();
            Response::success($keepAlive, 'Aiven database keep-alive ping and user select query executed successfully.');
        } catch (Throwable $e) {
            Response::error('Keep-alive execution failed: ' . $e->getMessage(), 500);
        }
    }

    public function healthCheck(): void
    {
        try {
            $keepAlive = KeepAliveService::pingDatabase();
            Response::success([
                'status' => 'healthy',
                'database' => 'connected',
                'keep_alive' => $keepAlive,
            ], 'System is healthy and database is active.');
        } catch (Throwable $e) {
            Response::error('Health check failed: ' . $e->getMessage(), 503);
        }
    }
}

