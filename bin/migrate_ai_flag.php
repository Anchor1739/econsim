<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/vendor/autoload.php';

use App\Config\Database;
use App\Config\Env;

Env::load();
$pdo = Database::getConnection();
$sqls = [
    "ALTER TABLE boardroom_submissions ADD COLUMN IF NOT EXISTS ai_suspected TINYINT(1) NOT NULL DEFAULT 0",
    "ALTER TABLE boardroom_submissions ADD COLUMN IF NOT EXISTS typing_duration_seconds INT DEFAULT NULL",
    "ALTER TABLE boardroom_submissions ADD COLUMN IF NOT EXISTS ai_flag_reason VARCHAR(500) DEFAULT NULL",
];
foreach ($sqls as $sql) {
    try { $pdo->exec($sql); echo "OK: $sql\n"; } catch (Exception $e) { echo "SKIP: " . $e->getMessage() . "\n"; }
}
echo "Migration complete.\n";
