<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\AuthService;
use App\Utils\Response;
use Throwable;

class AuthController
{
    public function register(): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $email = $body['email'] ?? '';
        $password = $body['password'] ?? '';
        $displayName = $body['display_name'] ?? '';
        $countryCode = $body['country_code'] ?? 'NG';

        try {
            $result = AuthService::register($email, $password, $displayName, $countryCode);
            Response::success($result, 'Registration successful. Please verify your email with the verification code.', 201);
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function verifyEmail(): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $email = $body['email'] ?? '';
        $code = $body['code'] ?? '';

        try {
            $result = AuthService::verifyEmail($email, $code);
            Response::success($result, 'Email verified! 500,000 VNGN demo capital granted.');
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function resendVerificationCode(): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $email = $body['email'] ?? '';

        if (empty($email)) {
            Response::error('Email address is required.', 400);
            return;
        }

        try {
            $result = AuthService::resendVerificationCode($email);
            Response::success($result, 'A fresh 6-digit verification code has been dispatched.');
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function login(): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $email = $body['email'] ?? '';
        $password = $body['password'] ?? '';

        try {
            $result = AuthService::login($email, $password);
            Response::success($result, 'Login successful.');
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 401);
        }
    }

    public function me(): void
    {
        $user = AuthService::getCurrentUser();
        if (!$user) {
            Response::error('Unauthenticated', 401);
        }
        Response::success($user);
    }

    public function logout(): void
    {
        AuthService::logout();
        Response::success(null, 'Signed out successfully.');
    }

    public function forgotPassword(): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $email = $body['email'] ?? '';

        try {
            AuthService::forgotPassword($email);
            Response::success(null, 'If an account exists, a password reset link has been dispatched.');
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }

    public function resetPassword(): void
    {
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $token = $body['token'] ?? '';
        $newPassword = $body['password'] ?? '';

        try {
            AuthService::resetPassword($token, $newPassword);
            Response::success(null, 'Password has been reset successfully. Please sign in with your new credentials.');
        } catch (Throwable $e) {
            Response::error($e->getMessage(), 400);
        }
    }
}

