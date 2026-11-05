<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\AuthService;
use App\Services\NotificationService;
use App\Services\ProfileService;
use App\Utils\Response;
use Throwable;

class ProfileController
{
    public function getProfile(): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        try {
            $profile = ProfileService::getProfile($user['id']);
            Response::success($profile);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function updateProfile(): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        try {
            ProfileService::updateProfile($user['id'], $body);
            $profile = ProfileService::getProfile($user['id']);
            Response::success($profile, 'Profile updated successfully.');
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function getLeaderboard(): void
    {
        $tab = $_GET['tab'] ?? 'All';
        try {
            $data = ProfileService::getLeaderboard($tab);
            Response::success($data);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function askMentor(): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $query = $body['query'] ?? '';

        try {
            $reply = ProfileService::askMentor($user['id'], $query);
            Response::success($reply);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function getScenarioLabMeta(): void
    {
        $industry = $_GET['industry'] ?? 'monetary';
        try {
            $industries = \App\Services\ScenarioLabService::getIndustries();
            $scenarios = \App\Services\ScenarioLabService::getIndustryScenarios($industry);
            $definitions = \App\Services\ScenarioLabService::getMetricDefinitions();

            Response::success([
                'industries' => $industries,
                'scenarios' => $scenarios,
                'definitions' => $definitions,
            ]);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function simulateLab(): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $industry = $body['industry'] ?? 'monetary';
        $params = $body['parameters'] ?? [];

        try {
            $results = \App\Services\ScenarioLabService::simulate($industry, $params);
            Response::success($results);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function generateAiScenario(): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $industry = $body['industry'] ?? 'monetary';
        $prompt = trim($body['prompt'] ?? '');

        if (empty($prompt)) {
            Response::error('Please provide a prompt describing the macroeconomic dilemma.', 400);
            return;
        }

        try {
            $scenario = \App\Services\ScenarioLabService::generateAiScenario($industry, $prompt);
            Response::success($scenario);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function runScenarioLabBriefing(): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $industry = $body['industry'] ?? 'monetary';
        $title = $body['scenario_title'] ?? 'Macro Stress Test';
        $params = $body['parameters'] ?? [];
        $results = $body['results'] ?? [];

        try {
            $briefing = \App\Services\ScenarioLabService::runAiBriefing($industry, $title, $params, $results);
            Response::success($briefing);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function runScenarioLab(): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $rate = (int)($body['rate'] ?? 20);
        $inflation = (int)($body['inflation'] ?? 24);
        $spend = (int)($body['spend'] ?? 12);

        try {
            $res = ProfileService::runScenarioLab($user['id'], $rate, $inflation, $spend);
            Response::success($res);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function getCorporateRadar(): void
    {
        $sector = $_GET['sector'] ?? 'all';
        try {
            // Baseline simulation across all public corporate tickers
            $sim = \App\Services\ScenarioLabService::simulate('monetary', []);
            $radar = $sim['listed_corporate_radar'] ?? [];
            if ($sector !== 'all') {
                $radar = array_filter($radar, fn($c) => ($c['industry'] ?? '') === $sector);
            }
            Response::success([
                'companies' => array_values($radar),
                'macro_baseline' => $sim['parameters'] ?? [],
                'sector' => $sector,
            ]);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function markTourSeen(): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $page = trim((string)($body['page'] ?? ''));

        if (empty($page)) {
            Response::error('Page parameter is required', 400);
        }

        try {
            $seenTours = ProfileService::markTourSeen($user['id'], $page);
            Response::success([
                'page' => $page,
                'seen_tours' => $seenTours,
            ], 'Tour state successfully saved to database.');
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function getSeenTours(): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        try {
            $seenTours = ProfileService::getSeenTours($user['id']);
            Response::success([
                'seen_tours' => $seenTours,
            ]);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function saveFcmToken(): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $token = trim((string)($body['fcm_token'] ?? ''));

        if (empty($token)) {
            Response::error('FCM Token is required', 400);
        }

        try {
            ProfileService::saveFcmToken($user['id'], $token);
            Response::success(['token_saved' => true], 'Device registered for Firebase push notifications.');
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function getNotifications(): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        try {
            $notifs = NotificationService::getUserNotifications($user['id'], 50);
            $unreadCount = NotificationService::getUnreadCount($user['id']);
            Response::success([
                'notifications' => $notifs,
                'unread_count' => $unreadCount,
            ]);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function markNotificationsRead(): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $notifId = !empty($body['notification_id']) ? (string)$body['notification_id'] : null;

        try {
            NotificationService::markAsRead($user['id'], $notifId);
            Response::success(['status' => 'marked_read']);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }
}

