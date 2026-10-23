<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\AuthService;
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
        $tab = $_GET['tab'] ?? 'Overall';
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
}

