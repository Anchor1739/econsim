<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\AuthService;
use App\Services\FeedbackService;
use App\Utils\Response;
use Throwable;

class FeedbackController
{
    /**
     * Submit feedback (user or guest)
     */
    public function submit(): void
    {
        $user = AuthService::getCurrentUser();
        $body = json_decode(file_get_contents('php://input'), true) ?? [];

        if (empty($body['user_agent']) && !empty($_SERVER['HTTP_USER_AGENT'])) {
            $body['user_agent'] = $_SERVER['HTTP_USER_AGENT'];
        }

        try {
            $res = FeedbackService::submitFeedback($user['id'] ?? null, $body);
            Response::success($res, 'Thank you! Your feedback has been recorded.', 201);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }
}
