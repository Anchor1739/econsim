<?php

declare(strict_types=1);

namespace App\Services;

use App\Config\Env;

class MailerService
{
    public static function sendVerificationEmail(string $toEmail, string $displayName, string $codeOrLink): bool
    {
        $subject = "Verify your EconSim Intelligence Account";
        $html = "
            <div style='font-family: Inter, sans-serif; max-width: 600px; margin: auto; padding: 20px; background: #f5f7fa; color: #142841;'>
                <h2 style='color: #247965;'>Welcome to EconSim, {$displayName}!</h2>
                <p>You are one step away from exploring our financial simulation terminal with <b>₦500,000</b> in educational virtual capital.</p>
                <div style='background: #fff; padding: 20px; border-radius: 8px; border: 1px solid #e1e7f1; text-align: center; margin: 20px 0;'>
                    <span style='font-size: 14px; color: #68768e; text-transform: uppercase; letter-spacing: 1px;'>Your Verification Code</span>
                    <h1 style='font-size: 36px; letter-spacing: 6px; margin: 10px 0; color: #142841;'>{$codeOrLink}</h1>
                </div>
                <p style='font-size: 13px; color: #68768e;'>This code expires in 24 hours. If you did not create an account, you can safely ignore this email.</p>
            </div>
        ";

        return self::send($toEmail, $displayName, $subject, $html);
    }

    public static function sendPasswordResetEmail(string $toEmail, string $displayName, string $resetToken): bool
    {
        $appUrl = rtrim((string)Env::get('APP_URL', 'http://localhost:8000'), '/');
        $resetUrl = "{$appUrl}/?page=reset&token={$resetToken}";
        $subject = "Reset your EconSim Password";
        $html = "
            <div style='font-family: Inter, sans-serif; max-width: 600px; margin: auto; padding: 20px; background: #f5f7fa; color: #142841;'>
                <h2 style='color: #142841;'>Password Reset Request</h2>
                <p>Hello {$displayName},</p>
                <p>We received a request to reset your password. Use the link below or enter this reset token to choose a new password:</p>
                <div style='background: #fff; padding: 15px; border-radius: 8px; border: 1px solid #e1e7f1; margin: 15px 0;'>
                    <code>{$resetToken}</code>
                </div>
                <p><a href='{$resetUrl}' style='display: inline-block; background: #247965; color: #fff; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: bold;'>Reset Password</a></p>
                <p style='font-size: 13px; color: #68768e;'>This token is single-use and expires in 1 hour. If you didn't request this, your account remains secure.</p>
            </div>
        ";

        return self::send($toEmail, $displayName, $subject, $html);
    }

    private static function send(string $toEmail, string $toName, string $subject, string $htmlContent): bool
    {
        $apiKey = Env::get('MAILER_API_KEY');
        $fromEmail = Env::get('MAILER_FROM_EMAIL', 'noreply@econsim.app');
        $fromName = Env::get('MAILER_FROM_NAME', 'EconSim');

        if (empty($apiKey)) {
            // Local / Development logging fallback
            error_log("[EconSim Mailer] Simulated email to {$toEmail}: {$subject}");
            return true;
        }

        $provider = strtolower((string)Env::get('MAILER_PROVIDER', 'resend'));

        if ($provider === 'sendgrid') {
            return self::sendViaSendGrid($apiKey, $fromEmail, $fromName, $toEmail, $toName, $subject, $htmlContent);
        }

        return self::sendViaResend($apiKey, $fromEmail, $fromName, $toEmail, $subject, $htmlContent);
    }

    private static function sendViaResend(string $apiKey, string $fromEmail, string $fromName, string $toEmail, string $subject, string $htmlContent): bool
    {
        $payload = [
            'from' => "{$fromName} <{$fromEmail}>",
            'to' => [$toEmail],
            'subject' => $subject,
            'html' => $htmlContent,
        ];

        $ch = curl_init('https://api.resend.com/emails');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $apiKey,
                'Content-Type: application/json',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return $httpCode >= 200 && $httpCode < 300;
    }

    private static function sendViaSendGrid(string $apiKey, string $fromEmail, string $fromName, string $toEmail, string $toName, string $subject, string $htmlContent): bool
    {
        $payload = [
            'personalizations' => [
                ['to' => [['email' => $toEmail, 'name' => $toName]]],
            ],
            'from' => ['email' => $fromEmail, 'name' => $fromName],
            'subject' => $subject,
            'content' => [['type' => 'text/html', 'value' => $htmlContent]],
        ];

        $ch = curl_init('https://api.sendgrid.com/v3/mail/send');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $apiKey,
                'Content-Type: application/json',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        return $httpCode >= 200 && $httpCode < 300;
    }
}

