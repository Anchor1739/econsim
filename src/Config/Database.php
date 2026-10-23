<?php

declare(strict_types=1);

namespace App\Config;

use PDO;
use PDOException;
use RuntimeException;

class Database
{
    private static ?PDO $connection = null;

    public static function getConnection(): PDO
    {
        if (self::$connection !== null) {
            return self::$connection;
        }

        $host = Env::get('DB_HOST', '127.0.0.1');
        $port = Env::get('DB_PORT', 3306);
        $dbname = Env::get('DB_NAME', 'econsim');
        $username = Env::get('DB_USER', 'root');
        $password = Env::get('DB_PASSWORD', '');

        $dsn = "mysql:host={$host};port={$port};dbname={$dbname};charset=utf8mb4";

        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci, time_zone = '+00:00'",
        ];

        // SSL Configuration for Aiven Cloud MySQL
        $sslCa = Env::get('DB_SSL_CA');
        $sslCaContent = Env::get('DB_SSL_CA_CONTENT');

        // Only treat as certificate content if it actually contains PEM certificate header
        if (!empty($sslCaContent) && str_contains((string)$sslCaContent, 'BEGIN CERTIFICATE') && empty($sslCa)) {
            $tempCaPath = sys_get_temp_dir() . '/aiven-mysql-ca.pem';
            if (!file_exists($tempCaPath) || file_get_contents($tempCaPath) !== $sslCaContent) {
                file_put_contents($tempCaPath, $sslCaContent);
            }
            $sslCa = $tempCaPath;
        }

        if (!empty($sslCa) && file_exists($sslCa)) {
            $options[PDO::MYSQL_ATTR_SSL_CA] = $sslCa;
        }

        $verify = Env::get('DB_SSL_VERIFY', false);
        if (defined('PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT')) {
            $options[PDO::MYSQL_ATTR_SSL_VERIFY_SERVER_CERT] = (bool)$verify;
        }

        try {
            self::$connection = new PDO($dsn, $username, $password, $options);
            return self::$connection;
        } catch (PDOException $e) {
            throw new RuntimeException("Database connection failed: " . $e->getMessage(), (int)$e->getCode(), $e);
        }
    }

    public static function setConnection(?PDO $pdo): void
    {
        self::$connection = $pdo;
    }
}

