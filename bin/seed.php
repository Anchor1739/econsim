<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/vendor/autoload.php';

use App\Config\Database;
use App\Config\Env;

Env::load();

echo "========================================================\n";
echo " EconSim Seed Runner\n";
echo "========================================================\n";

try {
    $pdo = Database::getConnection();
    echo "✓ Connected to database.\n";

    $seedFile = dirname(__DIR__) . '/database/seed_demo_data.sql';
    if (!file_exists($seedFile)) {
        throw new RuntimeException("Seed file not found at: {$seedFile}");
    }

    $seedSql = file_get_contents($seedFile);
    $seedStatements = array_filter(
        array_map('trim', explode(';', $seedSql)),
        fn($s) => !empty($s) && !str_starts_with($s, '--')
    );

    $count = 0;
    foreach ($seedStatements as $stmt) {
        $pdo->exec($stmt);
        $count++;
    }

    echo "✓ Executed {$count} seed operations successfully.\n";
} catch (\Throwable $e) {
    echo "\n❌ Seed Failed: " . $e->getMessage() . "\n";
    exit(1);
}

