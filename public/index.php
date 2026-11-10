<?php

declare(strict_types=1);

date_default_timezone_set('UTC');

require_once dirname(__DIR__) . '/vendor/autoload.php';

use App\Config\Env;
use App\Router;
use App\Controllers\AuthController;
use App\Controllers\WalletController;
use App\Controllers\MarketController;
use App\Controllers\BoardroomController;
use App\Controllers\ProfileController;
use App\Controllers\AdminController;
use App\Controllers\PaymentController;
use App\Controllers\FeedbackController;
use App\Controllers\ExpertScenarioController;

Env::load();

$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH) ?: '/';

// Route obfuscated Operations Terminal exclusively to /a
if ($path === '/a' || $path === '/a/') {
    require_once __DIR__ . '/a.html';
    exit;
}

// Strictly block and drop any /admin or direct html scan attempts with 404
if (
    $path === '/admin' || 
    $path === '/admin/' || 
    $path === '/admin.html' || 
    $path === '/a.html' || 
    str_starts_with($path, '/admin/')
) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo "404 Not Found";
    exit;
}

// Serve static assets directly if requested (excluding admin/operations templates)
$publicDir = __DIR__;
$filePath = realpath($publicDir . $path);
if (
    $filePath && 
    is_file($filePath) && 
    str_starts_with($filePath, $publicDir) && 
    $path !== '/index.php' && 
    $path !== '/a.html' && 
    $path !== '/admin.html' && 
    !str_starts_with($path, '/api/')
) {
    $ext = pathinfo($filePath, PATHINFO_EXTENSION);
    $mimes = [
        'css' => 'text/css',
        'js' => 'application/javascript',
        'json' => 'application/json',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon',
        'woff2' => 'font/woff2',
    ];
    header('Content-Type: ' . ($mimes[$ext] ?? 'application/octet-stream'));
    readfile($filePath);
    exit;
}

// Route API endpoints
if (str_starts_with($path, '/api/')) {
    $router = new Router();

    // Auth Routes
    $router->post('/api/auth/register', [AuthController::class, 'register']);
    $router->post('/api/auth/verify-email', [AuthController::class, 'verifyEmail']);
    $router->post('/api/auth/resend-code', [AuthController::class, 'resendVerificationCode']);
    $router->post('/api/auth/login', [AuthController::class, 'login']);
    $router->get('/api/auth/me', [AuthController::class, 'me']);
    $router->post('/api/auth/logout', [AuthController::class, 'logout']);
    $router->post('/api/auth/forgot-password', [AuthController::class, 'forgotPassword']);
    $router->post('/api/auth/reset-password', [AuthController::class, 'resetPassword']);

    // Wallet & Double-Entry Ledger Routes
    $router->get('/api/wallet', [WalletController::class, 'getWallet']);
    $router->post('/api/wallet/claim-grant', [WalletController::class, 'claimDemoGrant']);
    $router->post('/api/wallet/withdraw', [WalletController::class, 'withdraw']);
    $router->get('/api/features', [WalletController::class, 'getFeatures']);

    // Predictor & Market Intelligence Routes
    $router->get('/api/markets', [MarketController::class, 'getMarkets']);
    $router->get('/api/markets/{id}', [MarketController::class, 'getMarket']);
    $router->post('/api/markets/{id}/forecast', [MarketController::class, 'placeForecast']);
    $router->get('/api/forecasts/me', [MarketController::class, 'getMyForecasts']);
    $router->get('/api/cron/update-predictor', [MarketController::class, 'runCron']);
    $router->post('/api/cron/update-predictor', [MarketController::class, 'runCron']);
    $router->get('/api/cron/worker', [MarketController::class, 'runCron']);
    $router->post('/api/cron/worker', [MarketController::class, 'runCron']);
    $router->get('/api/cron/keep-alive', [MarketController::class, 'keepAlive']);
    $router->post('/api/cron/keep-alive', [MarketController::class, 'keepAlive']);
    $router->get('/api/health', [MarketController::class, 'healthCheck']);

    // Boardroom Strategy Challenge Routes
    $router->get('/api/boardroom/lobby', [BoardroomController::class, 'getLobby']);
    $router->get('/api/boardroom/industries', [BoardroomController::class, 'getIndustries']);
    $router->post('/api/boardroom/create', [BoardroomController::class, 'create']);
    $router->post('/api/boardroom/join/{id}', [BoardroomController::class, 'join']);
    $router->post('/api/boardroom/start-demo/{id}', [BoardroomController::class, 'startDemoMatch']);
    $router->get('/api/boardroom/challenge/{id}', [BoardroomController::class, 'getDetails']);
    $router->post('/api/boardroom/submit/{id}', [BoardroomController::class, 'submit']);
    $router->get('/api/boardroom/report/{id}', [BoardroomController::class, 'getReport']);

    // Profile, Settings, Leaderboard, Lab, Mentor
    $router->get('/api/profile', [ProfileController::class, 'getProfile']);
    $router->patch('/api/profile', [ProfileController::class, 'updateProfile']);
    $router->get('/api/profile/tour-seen', [ProfileController::class, 'getSeenTours']);
    $router->post('/api/profile/tour-seen', [ProfileController::class, 'markTourSeen']);
    $router->get('/api/profile/fcm-token', [ProfileController::class, 'saveFcmToken']);
    $router->post('/api/profile/fcm-token', [ProfileController::class, 'saveFcmToken']);
    $router->get('/api/notifications', [ProfileController::class, 'getNotifications']);
    $router->post('/api/notifications/read', [ProfileController::class, 'markNotificationsRead']);
    $router->get('/api/leaderboard', [ProfileController::class, 'getLeaderboard']);
    $router->post('/api/mentor/ask', [ProfileController::class, 'askMentor']);
    $router->get('/api/lab/meta', [ProfileController::class, 'getScenarioLabMeta']);
    $router->post('/api/lab/simulate', [ProfileController::class, 'simulateLab']);
    $router->post('/api/lab/generate', [ProfileController::class, 'generateAiScenario']);
    $router->post('/api/lab/briefing', [ProfileController::class, 'runScenarioLabBriefing']);
    $router->post('/api/lab/run', [ProfileController::class, 'runScenarioLab']);
    $router->get('/api/radar', [ProfileController::class, 'getCorporateRadar']);

    // Real Mode Funding & Payment Gateways (Flutterwave & Korapay)
    $router->post('/api/funding/initialize', [PaymentController::class, 'initialize']);
    $router->get('/api/funding/verify/{ref}', [PaymentController::class, 'verify']);
    $router->post('/api/webhooks/flutterwave', [PaymentController::class, 'flutterwaveWebhook']);
    $router->post('/api/webhooks/korapay', [PaymentController::class, 'korapayWebhook']);

    // User Feedback & Expert Scenario Contribution Routes
    $router->post('/api/feedback', [FeedbackController::class, 'submit']);
    $router->post('/api/expert/scenarios', [ExpertScenarioController::class, 'submit']);
    $router->get('/api/expert/my-submissions', [ExpertScenarioController::class, 'mySubmissions']);

    // Obfuscated Engine Operations API (/api/a/...)
    $router->get('/api/a/auth/verify', [AdminController::class, 'verifyAuth']);
    $router->post('/api/a/auth/verify', [AdminController::class, 'verifyAuth']);
    $router->get('/api/a/features', [AdminController::class, 'getFeatures']);
    $router->post('/api/a/features/toggle', [AdminController::class, 'toggleFeature']);
    $router->post('/api/a/providers/switch', [AdminController::class, 'updateProvider']);
    $router->get('/api/a/funding/stream', [AdminController::class, 'getFundingStream']);
    $router->get('/api/a/stats', [AdminController::class, 'getStats']);
    $router->post('/api/a/markets/create', [AdminController::class, 'createMarket']);
    $router->post('/api/a/markets/ai-assist', [AdminController::class, 'aiAssistMarket']);
    $router->post('/api/a/markets/resolve', [AdminController::class, 'resolveMarket']);
    $router->post('/api/a/markets/ai-evaluate', [AdminController::class, 'aiEvaluateMarket']);
    $router->get('/api/a/scenarios', [AdminController::class, 'getScenarios']);
    $router->post('/api/a/scenarios/create', [AdminController::class, 'createScenario']);
    $router->post('/api/a/scenarios/ai-assist', [AdminController::class, 'aiAssistScenario']);
    $router->get('/api/a/ai/model', [AdminController::class, 'getAiConfig']);
    $router->post('/api/a/ai/model', [AdminController::class, 'updateAiModel']);
    $router->get('/api/a/boardroom/grading-desk', [AdminController::class, 'getBoardroomGradingDesk']);
    $router->post('/api/a/boardroom/grading-mode', [AdminController::class, 'setBoardroomGradingMode']);
    $router->post('/api/a/boardroom/adjudicate', [AdminController::class, 'adjudicateBoardroomSubmission']);
    $router->get('/api/a/feedback', [AdminController::class, 'getFeedbacks']);
    $router->patch('/api/a/feedback/{id}', [AdminController::class, 'updateFeedback']);
    $router->post('/api/a/feedback/{id}', [AdminController::class, 'updateFeedback']);
    $router->get('/api/a/expert/scenarios', [AdminController::class, 'getExpertScenarios']);
    $router->get('/api/a/expert/scenarios/{id}', [AdminController::class, 'getExpertScenarioDetails']);
    $router->post('/api/a/expert/scenarios/{id}/approve', [AdminController::class, 'approveExpertScenario']);
    $router->post('/api/a/expert/scenarios/{id}/reject', [AdminController::class, 'rejectExpertScenario']);
    $router->get('/api/a/users/escrow-audit', [AdminController::class, 'auditUserEscrow']);
    $router->get('/api/a/users/escrow-refund', [AdminController::class, 'refundUserEscrow']);
    $router->post('/api/a/users/escrow-refund', [AdminController::class, 'refundUserEscrow']);

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $router->dispatch($method, $uri);
    exit;
}

// Serve main single-page application
require_once __DIR__ . '/index.html';

