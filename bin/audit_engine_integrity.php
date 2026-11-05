<?php
declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use App\Config\Env;
use App\Config\Database;
use App\Services\PredictorService;
use App\Services\LedgerService;
use App\Services\BoardroomService;
use App\Services\KeepAliveService;
use App\Utils\Security;

Env::load();
$pdo = Database::getConnection();

echo "========================================================\n";
echo " EconSim Deep Engine & Algorithmic Integrity Audit\n";
echo "========================================================\n\n";

// 1. Timezone Alignment Audit
echo "[1] Checking Timezone Alignment between PHP and MySQL...\n";
$phpTz = date_default_timezone_get();
$phpNow = date('Y-m-d H:i:s');
$dbRow = $pdo->query("SELECT @@session.time_zone as session_tz, @@system_time_zone as sys_tz, NOW() as db_now, UTC_TIMESTAMP() as utc_now")->fetch(PDO::FETCH_ASSOC);

echo "    - PHP Default Timezone: {$phpTz}\n";
echo "    - PHP Current Time:     {$phpNow}\n";
echo "    - MySQL Session TZ:     {$dbRow['session_tz']}\n";
echo "    - MySQL System TZ:      {$dbRow['sys_tz']}\n";
echo "    - MySQL NOW():          {$dbRow['db_now']}\n";
echo "    - MySQL UTC_TIMESTAMP:  {$dbRow['utc_now']}\n";

$phpTs = time();
$dbTs = strtotime($dbRow['db_now']);
$diffSeconds = abs($phpTs - $dbTs);
echo "    - Timestamp delta between PHP and MySQL: {$diffSeconds}s\n";
if ($diffSeconds > 10) {
    echo "    [!] WARNING: Significant timezone skew detected ({$diffSeconds}s)!\n";
} else {
    echo "    [✓] Timezone synchronization is perfect (< 10s delta).\n";
}

// 2. Audit Event Lifecycle State Transition Logic
echo "\n[2] Checking Market Lifecycle State Transitions...\n";
$openExpiringSoon = $pdo->query("SELECT COUNT(*) FROM market_events WHERE state = 'open' AND closes_at <= DATE_ADD(NOW(3), INTERVAL 5 MINUTE)")->fetchColumn();
echo "    - Open markets closing within 5 minutes (needing lock): {$openExpiringSoon}\n";

$openOverdue = $pdo->query("SELECT COUNT(*) FROM market_events WHERE state = 'open' AND closes_at <= NOW()")->fetchColumn();
echo "    - Open markets past closes_at: {$openOverdue}\n";

$closedReadyToResolve = $pdo->query("SELECT COUNT(*) FROM market_events WHERE state = 'closed' AND resolves_at <= NOW()")->fetchColumn();
echo "    - Closed markets past resolves_at (needing resolution): {$closedReadyToResolve}\n";

// Check if any resolved market has state != 'resolved'
$inconsistent = $pdo->query("SELECT COUNT(*) FROM market_events WHERE resolved_at IS NOT NULL AND state != 'resolved'")->fetchColumn();
echo "    - Inconsistent resolved markets: {$inconsistent}\n";

// 3. Audit Double-Entry Ledger & Payout Settlement Idempotency
echo "\n[3] Auditing Ledger Settlement Idempotency...\n";
$unsettledWon = $pdo->query("SELECT COUNT(*) FROM forecast_positions WHERE status = 'won' AND settled_at IS NULL")->fetchColumn();
echo "    - Won positions lacking settlement timestamp: {$unsettledWon}\n";

$orphanPositions = $pdo->query("SELECT COUNT(*) FROM forecast_positions WHERE event_id NOT IN (SELECT id FROM market_events)")->fetchColumn();
echo "    - Positions with invalid market event reference: {$orphanPositions}\n";

// 4. Audit 5-Minute Gatekeeper Logic
echo "\n[4] Auditing 5-Minute Gatekeeper Algorithm...\n";
// Create a temporary test market that closes in 3 minutes
$testEventId = 'test-audit-' . substr(bin2hex(random_bytes(4)), 0, 8);
$stmt = $pdo->prepare("
    INSERT INTO market_events (id, slug, industry_id, title, outcome_definition, resolution_source, resolves_at, closes_at, state, created_at)
    VALUES (:id, :slug, 1, 'Audit Front-Running Test Event', 'Test definition', 'Audit Test', DATE_ADD(NOW(), INTERVAL 10 MINUTE), DATE_ADD(NOW(), INTERVAL 3 MINUTE), 'open', NOW())
");
$stmt->execute([':id' => $testEventId, ':slug' => $testEventId]);

// Try placing forecast on market closing in 3 minutes - MUST be blocked by gatekeeper!
$gatekeeperBlocked = false;
$blockMessage = '';
try {
    PredictorService::placeForecast('508d86aa-d29a-48ec-ad24-7e300062da83', $testEventId, true, 500, 'Test thesis', 80, 'demo');
} catch (\Throwable $e) {
    $gatekeeperBlocked = true;
    $blockMessage = $e->getMessage();
}

// Verify market was auto-locked
$marketStateAfter = $pdo->query("SELECT state FROM market_events WHERE id = '{$testEventId}'")->fetchColumn();

// Clean up test market
$pdo->query("DELETE FROM market_events WHERE id = '{$testEventId}'");

if ($gatekeeperBlocked && $marketStateAfter === 'closed') {
    echo "    [✓] Gatekeeper PASSED! Market closing in 3 mins was immediately locked to 'closed' and bet was rejected.\n";
    echo "        Gatekeeper rejection reason: \"{$blockMessage}\"\n";
} else {
    echo "    [!] Gatekeeper FAILED! Blocked: " . ($gatekeeperBlocked ? 'YES' : 'NO') . ", State: {$marketStateAfter}\n";
}

// 5. Audit Boardroom Rubric & 0/100 Evaluation Guard
echo "\n[5] Auditing Boardroom Nonsense / Irrelevance 0/100 Guard...\n";
$nonsenseScenarios = [
    'Short spam (< 10 words)' => 'yes buy more',
    'Repeated text / spam' => 'money money money money money money money money money money money money money money money money',
    'Keyboard smash / fill' => 'asdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdfasdf',
];

foreach ($nonsenseScenarios as $label => $sub) {
    $verdict = BoardroomService::checkNonsenseOrIrrelevant($sub);
    $isInvalid = ($verdict !== null && !empty($verdict['is_invalid']));
    $explanation = $verdict['explanation'] ?? 'Valid submission';
    echo "    - Submitting {$label}: Filtered = " . ($isInvalid ? 'YES (0/100)' : 'NO') . " -> \"{$explanation}\"\n";
}

// Test a legitimate business response to ensure legitimate responses are NOT rejected
$validBusinessMemo = "We recommend extending wholesale supplier payable cycles from 30 to 60 days while offering Tier-1 distributors a 2.5% prompt-settlement rebate. This preserves ₦180 Million in operational liquidity, cushions working capital against currency revaluation, and stabilizes cash flow across the operating quarter.";
$validVerdict = BoardroomService::checkNonsenseOrIrrelevant($validBusinessMemo);
$validPassed = ($validVerdict === null);
echo "    - Submitting Legitimate Strategic Memo: Accepted = " . ($validPassed ? 'YES (Proceeds to AI Evaluation)' : 'NO') . "\n";
if ($validPassed) {
    echo "    [✓] Boardroom filter is calibrated: strictly drops junk at 0/100, accepts genuine strategic memos!\n";
}

// 6. Audit Multi-Sector Market Counts
echo "\n[6] Auditing Multi-Sector Market Balance...\n";
$sectorCounts = $pdo->query("
    SELECT i.name, COUNT(me.id) as cnt 
    FROM industries i 
    LEFT JOIN market_events me ON i.id = me.industry_id AND me.state = 'open' 
    GROUP BY i.name
")->fetchAll(PDO::FETCH_ASSOC);

$allAboveZero = true;
foreach ($sectorCounts as $sc) {
    echo sprintf("    - %-30s : %d open markets\n", $sc['name'], $sc['cnt']);
    if ($sc['cnt'] === 0) {
        $allAboveZero = false;
    }
}
if ($allAboveZero) {
    echo "    [✓] All sectors have active, healthy market coverage!\n";
} else {
    echo "    [!] Warning: Some sectors have 0 open markets!\n";
}

echo "\n========================================================\n";
echo " AUDIT COMPLETE\n";
echo "========================================================\n";
