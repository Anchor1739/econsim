<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/vendor/autoload.php';

use App\Config\Database;
use App\Config\Env;

Env::load();

echo "========================================================\n";
echo " EconSim Aiven MySQL Migration Runner\n";
echo "========================================================\n";

$host = Env::get('DB_HOST', '127.0.0.1');
$port = Env::get('DB_PORT', 3306);
$name = Env::get('DB_NAME', 'econsim');
echo "Connecting to MySQL server at {$host}:{$port} [DB: {$name}]...\n";

try {
    $pdo = Database::getConnection();
    echo "✓ Connected successfully via PDO with TLS/SSL.\n\n";

    $schemaFile = dirname(__DIR__) . '/database/001_schema_mysql.sql';
    if (!file_exists($schemaFile)) {
        throw new RuntimeException("Schema file not found at: {$schemaFile}");
    }

    echo "Reading schema DDL from {$schemaFile}...\n";
    $sql = file_get_contents($schemaFile);

    // Strip single-line and multi-line SQL comments before splitting by semicolon
    $cleanSql = preg_replace('/--.*$/m', '', $sql);
    $cleanSql = preg_replace('#/\*.*?\*/#s', '', (string)$cleanSql);

    // Remove CREATE DATABASE and USE statements if connected directly to target database
    $statements = array_filter(
        array_map('trim', explode(';', (string)$cleanSql)),
        fn($stmt) => !empty($stmt) &&
                     !str_starts_with(strtoupper($stmt), 'CREATE DATABASE') &&
                     !str_starts_with(strtoupper($stmt), 'USE ')
    );

    echo "Executing " . count($statements) . " schema statements...\n";
    $count = 0;
    foreach ($statements as $stmt) {
        $pdo->exec($stmt);
        $count++;
    }

    echo "✓ Successfully applied {$count} migration statements.\n";

    // Auto-run seed
    $seedFile = dirname(__DIR__) . '/database/seed_demo_data.sql';
    if (file_exists($seedFile)) {
        echo "\nExecuting default seed data from {$seedFile}...\n";
        $seedSql = file_get_contents($seedFile);
        $cleanSeed = preg_replace('/--.*$/m', '', $seedSql);
        $cleanSeed = preg_replace('#/\*.*?\*/#s', '', (string)$cleanSeed);
        $seedStatements = array_filter(
            array_map('trim', explode(';', (string)$cleanSeed)),
            fn($s) => !empty($s)
        );
        $seedCount = 0;
        foreach ($seedStatements as $stmt) {
            $pdo->exec($stmt);
            $seedCount++;
        }
        echo "✓ Successfully applied {$seedCount} seed statements.\n";
    }

    echo "\n========================================================\n";
    echo " Migration & Seed Completed Successfully!\n";
    echo "========================================================\n";
} catch (\Throwable $e) {
    echo "\n❌ Migration Failed: " . $e->getMessage() . "\n";
    exit(1);
}

