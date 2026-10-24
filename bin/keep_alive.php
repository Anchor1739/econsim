<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/vendor/autoload.php';

use App\Config\Env;
use App\Services\KeepAliveService;
use App\Services\PredictorService;
use App\Services\BoardroomService;

Env::load();

echo "========================================================\n";
echo " EconSim / Developing Market - Aiven Database Keep-Alive\n";
echo " Time: " . date('Y-m-d H:i:s T') . "\n";
echo "========================================================\n";

try {
    echo "[*] Executing database keep-alive ping and user select queries...\n";
    $ping = KeepAliveService::pingDatabase();
    
    echo "[+] Status: {$ping['status']}\n";
    echo "[+] Target Email: {$ping['target_email']}\n";
    if (!empty($ping['user'])) {
        echo "[+] User Match: [{$ping['user']['id']}] {$ping['user']['email']} (Status: {$ping['user']['status']})\n";
    }
    echo "[+] Total Users in DB: {$ping['total_registered_users']}\n";
    echo "[+] Open Markets: {$ping['open_markets']}\n";
    echo "[+] Query Latency: {$ping['latency_ms']} ms\n";

    echo "[*] Running background predictor and evaluation maintenance...\n";
    $predictor = PredictorService::runRealtimeMaintenance();
    echo "[+] Closed Expired Markets: {$predictor['closed_markets_count']}\n";

    $boardroom = BoardroomService::processQueuedEvaluations(5);
    echo "[+] Evaluated Memos: {$boardroom['evaluated_memos_count']}\n";

    echo "[✓] Database keep-alive cycle completed successfully.\n";
    exit(0);
} catch (\Throwable $e) {
    echo "[-] Keep-alive execution failed: " . $e->getMessage() . "\n";
    exit(1);
}
