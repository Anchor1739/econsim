<?php
declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use App\Config\Env;
use App\Config\Database;

Env::load();
$pdo = Database::getConnection();

$stmt = $pdo->query("
    SELECT i.name as sector, i.slug as sector_slug, COUNT(bs.id) as cnt
    FROM industries i
    LEFT JOIN boardroom_scenarios bs ON i.id = bs.industry_id
    GROUP BY i.name, i.slug
    ORDER BY cnt DESC
");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "========================================================\n";
echo " Boardroom Scenarios Distribution Across All 11 Sectors\n";
echo "========================================================\n";
$total = 0;
foreach ($rows as $r) {
    echo sprintf("%-30s : %d scenario(s)\n", $r['sector'], $r['cnt']);
    $total += (int)$r['cnt'];
}
echo "--------------------------------------------------------\n";
echo "TOTAL BOARDROOM SCENARIOS: {$total}\n";

