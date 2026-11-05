<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/vendor/autoload.php';

use App\Config\Env;
use App\Services\KeepAliveService;
use App\Services\PredictorService;
use App\Services\BoardroomService;

Env::load();

echo "========================================================\n";
echo " EconSim Real-Time 1-Minute Autonomous Background Daemon\n";
echo "========================================================\n";
echo "[*] Daemon active. Running 60-second cycle for:\n";
echo "    - 5-Minute Pre-Release Predictor Auto-Lock\n";
echo "    - Real-Time Outcome Verification & Payout Distribution\n";
echo "    - Boardroom 5-Minute Warning & Match Start Alerts\n";
echo "    - Queued Executive Memo Adjudication\n";
echo "    - Aiven MySQL Keep-Alive\n";
echo "--------------------------------------------------------\n";

$cycle = 0;
while (true) {
    $cycle++;
    $time = date('Y-m-d H:i:s');
    echo "[{$time}] Cycle #{$cycle} executing...\n";

    try {
        // 1. Keep Aiven database active
        KeepAliveService::pingDatabase();

        // 2. Real-time predictor maintenance: lock within 5 mins, settle due markets, distribute payouts
        $pred = PredictorService::runRealtimeMaintenance();
        if ($pred['auto_locked_5min_markets'] > 0 || $pred['auto_resolved_markets'] > 0) {
            echo " [+] Predictor: Locked {$pred['auto_locked_5min_markets']} market(s), resolved {$pred['auto_resolved_markets']} market(s), settled {$pred['settled_positions_count']} position(s).\n";
        }

        // 3. Continuous Boardroom Scenario Ingestion
        $scenarios = BoardroomService::continuousScenarioIngestion(1);
        if (!empty($scenarios)) {
            echo " [+] Boardroom: Ingested " . count($scenarios) . " new scenario(s) from live news.\n";
        }

        // 4. Boardroom scheduled notifications (5-min alerts + match started)
        $notifs = BoardroomService::checkAndDispatchScheduledNotifications();
        if ($notifs['5min_warnings'] > 0 || $notifs['started_alerts'] > 0) {
            echo " [+] Boardroom: Dispatched {$notifs['5min_warnings']} 5-min warning(s), {$notifs['started_alerts']} start alert(s).\n";
        }

        // 5. Queued memo evaluation
        $br = BoardroomService::processQueuedEvaluations(3);
        if ($br['evaluated_memos_count'] > 0) {
            echo " [+] Evaluated {$br['evaluated_memos_count']} queued memo(s).\n";
        }
    } catch (\Throwable $e) {
        echo " [!] Daemon error in cycle #{$cycle}: " . $e->getMessage() . "\n";
    }

    sleep(60);
}

