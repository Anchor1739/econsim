<?php

declare(strict_types=1);

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

Env::load();

$uri = $_SERVER['REQUEST_URI'] ?? '/';
$path = parse_url($uri, PHP_URL_PATH) ?: '/';

// Route dedicated Admin portal directly to admin.html
if ($path === '/admin' || $path === '/admin/' || $path === '/admin.html') {
    require_once __DIR__ . '/admin.html';
    exit;
}

// Serve static assets directly if requested
$publicDir = __DIR__;
$filePath = realpath($publicDir . $path);
if ($filePath && is_file($filePath) && str_starts_with($filePath, $publicDir) && $path !== '/index.php' && !str_starts_with($path, '/api/')) {
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
    $router->post('/api/auth/login', [AuthController::class, 'login']);
    $router->get('/api/auth/me', [AuthController::class, 'me']);
    $router->post('/api/auth/logout', [AuthController::class, 'logout']);
    $router->post('/api/auth/forgot-password', [AuthController::class, 'forgotPassword']);
    $router->post('/api/auth/reset-password', [AuthController::class, 'resetPassword']);

    // Wallet & Double-Entry Ledger Routes
    $router->get('/api/wallet', [WalletController::class, 'getWallet']);
    $router->post('/api/wallet/claim-grant', [WalletController::class, 'claimDemoGrant']);

    // Predictor & Market Intelligence Routes
    $router->get('/api/markets', [MarketController::class, 'getMarkets']);
    $router->get('/api/markets/{id}', [MarketController::class, 'getMarket']);
    $router->post('/api/markets/{id}/forecast', [MarketController::class, 'placeForecast']);
    $router->get('/api/forecasts/me', [MarketController::class, 'getMyForecasts']);

    // Boardroom Strategy Challenge Routes
    $router->get('/api/boardroom/lobby', [BoardroomController::class, 'getLobby']);
    $router->post('/api/boardroom/create', [BoardroomController::class, 'create']);
    $router->post('/api/boardroom/join/{id}', [BoardroomController::class, 'join']);
    $router->post('/api/boardroom/start-demo/{id}', [BoardroomController::class, 'startDemoMatch']);
    $router->get('/api/boardroom/challenge/{id}', [BoardroomController::class, 'getDetails']);
    $router->post('/api/boardroom/submit/{id}', [BoardroomController::class, 'submit']);
    $router->get('/api/boardroom/report/{id}', [BoardroomController::class, 'getReport']);

    // Profile, Settings, Leaderboard, Lab, Mentor
    $router->get('/api/profile', [ProfileController::class, 'getProfile']);
    $router->patch('/api/profile', [ProfileController::class, 'updateProfile']);
    $router->get('/api/leaderboard', [ProfileController::class, 'getLeaderboard']);
    $router->post('/api/mentor/ask', [ProfileController::class, 'askMentor']);
    $router->post('/api/lab/run', [ProfileController::class, 'runScenarioLab']);

    // Real Mode Funding & Payment Gateways (Flutterwave & Korapay)
    $router->post('/api/funding/initialize', [PaymentController::class, 'initialize']);
    $router->get('/api/funding/verify/{ref}', [PaymentController::class, 'verify']);
    $router->post('/api/webhooks/flutterwave', [PaymentController::class, 'flutterwaveWebhook']);
    $router->post('/api/webhooks/korapay', [PaymentController::class, 'korapayWebhook']);

    // Admin Controls & Real Mode Engine
    $router->get('/api/admin/auth/verify', [AdminController::class, 'verifyAuth']);
    $router->post('/api/admin/auth/verify', [AdminController::class, 'verifyAuth']);
    $router->get('/api/admin/features', [AdminController::class, 'getFeatures']);
    $router->post('/api/admin/features/toggle', [AdminController::class, 'toggleFeature']);
    $router->post('/api/admin/providers/switch', [AdminController::class, 'updateProvider']);
    $router->get('/api/admin/stats', [AdminController::class, 'getStats']);
    $router->post('/api/admin/markets/create', [AdminController::class, 'createMarket']);
    $router->post('/api/admin/markets/resolve', [AdminController::class, 'resolveMarket']);
    $router->post('/api/admin/markets/ai-evaluate', [AdminController::class, 'aiEvaluateMarket']);
    $router->get('/api/admin/ai/model', [AdminController::class, 'getAiConfig']);
    $router->post('/api/admin/ai/model', [AdminController::class, 'updateAiModel']);

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    $router->dispatch($method, $uri);
    exit;
}

// Serve main single-page application
require_once __DIR__ . '/index.html';

