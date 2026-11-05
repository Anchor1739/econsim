<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/vendor/autoload.php';

use App\Config\Database;
use App\Config\Env;

Env::load();
$pdo = Database::getConnection();

$stmt = $pdo->query("
    SELECT i.name as sector, i.slug as sector_slug, me.state, COUNT(*) as cnt 
    FROM market_events me
    LEFT JOIN industries i ON me.industry_id = i.id
    GROUP BY i.name, i.slug, me.state 
    ORDER BY i.name, me.state
");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "========================================================\n";
echo " EconSim - Prediction Market Distribution Across Sectors\n";
echo "========================================================\n";
$catTotals = [];
$totalOpen = 0;
foreach ($rows as $r) {
    $sector = $r['sector'] ?? 'Unassigned';
    echo sprintf("%-28s [%-8s] : %d\n", $sector, $r['state'], $r['cnt']);
    if ($r['state'] === 'open') {
        $catTotals[$sector] = ($catTotals[$sector] ?? 0) + (int)$r['cnt'];
        $totalOpen += (int)$r['cnt'];
    }
}

echo "--------------------------------------------------------\n";
echo "TOTAL ACTIVE OPEN MARKETS: $totalOpen\n\n";

echo "--- OPEN MARKETS PER SECTOR ---\n";
foreach ($catTotals as $cat => $cnt) {
    echo sprintf("%-28s : %d open markets\n", $cat, $cnt);
}

$boardroomCnt = $pdo->query("SELECT COUNT(*) FROM boardroom_scenarios")->fetchColumn();
echo "\nTOTAL BOARDROOM SCENARIOS: $boardroomCnt\n";

$scenarios = $pdo->query("SELECT title, industry_id FROM boardroom_scenarios LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
foreach ($scenarios as $s) {
    echo " - " . $s['title'] . "\n";
}
