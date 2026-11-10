<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\AuthService;
use App\Services\BoardroomService;
use App\Utils\Response;
use Throwable;

class BoardroomController
{
    public function getLobby(): void
    {
        $sector = $_GET['industry'] ?? null;
        $user = AuthService::getCurrentUser();
        try {
            $challenges = BoardroomService::getLobbyChallenges($sector, $user['id'] ?? null);
            Response::success($challenges);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 500);
        }
    }

    public function create(): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $industryId = (int)($body['industry_id'] ?? 1);
        $stake = (int)($body['stake'] ?? 10000);
        $scheduledAt = $body['scheduled_at'] ?? date('Y-m-d H:i:s');
        $duration = (int)($body['duration'] ?? 15);
        $mode = $body['mode'] ?? 'demo';

        try {
            $res = BoardroomService::createChallenge(
                $user['id'],
                $industryId,
                $stake,
                $scheduledAt,
                $duration,
                $mode
            );
            Response::success($res, 'Boardroom challenge published to lobby.', 201);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function join(string $id): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        try {
            $res = BoardroomService::joinChallenge($user['id'], $id);
            Response::success($res, 'Challenge accepted. Matching locked and scenario revealed.');
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function startDemoMatch(string $id): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        try {
            $res = BoardroomService::startSoloDemoMatch($user['id'], $id);
            Response::success($res, 'Demo round started.');
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function getDetails(string $id): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        try {
            $details = BoardroomService::getChallengeDetails($user['id'], $id);
            Response::success($details);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function submit(string $id): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $answer = $body['answer'] ?? '';
        $dictationUsed = !empty($body['dictation_used']);
        $inputMethod = $body['input_method'] ?? ($dictationUsed ? 'voice_en-NG' : 'typed');

        try {
            $res = BoardroomService::submitMemo($user['id'], $id, $answer, $dictationUsed, $inputMethod);
            Response::success($res, 'Strategy memo received and queued for executive adjudication.');
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function getReport(string $id): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }

        try {
            $report = BoardroomService::getReport($user['id'], $id);
            Response::success($report);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }
}

