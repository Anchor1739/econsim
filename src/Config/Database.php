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

        // Dynamic IP resolution for Aiven Cloud MySQL
        $dbHostIp = Env::get('DB_HOST_IP');
        if (!empty($dbHostIp)) {
            $host = $dbHostIp;
        } elseif (PHP_OS_FAMILY === 'Windows' && !filter_var($host, FILTER_VALIDATE_IP)) {
            $resolved = @gethostbyname($host);
            if (!empty($resolved) && $resolved !== $host && filter_var($resolved, FILTER_VALIDATE_IP)) {
                $host = $resolved;
            } else {
                // Windows DNS fallback via Google DNS over HTTPS for Aiven cloud domains
                try {
                    $ctx = stream_context_create(['http' => ['timeout' => 2]]);
                    $doh = @file_get_contents("https://dns.google/resolve?name=" . urlencode($host) . "&type=A", false, $ctx);
                    if ($doh) {
                        $json = json_decode($doh, true);
                        if (!empty($json['Answer'])) {
                            foreach ($json['Answer'] as $ans) {
                                if (($ans['type'] ?? 0) === 1 && !empty($ans['data']) && filter_var($ans['data'], FILTER_VALIDATE_IP)) {
                                    $host = $ans['data'];
                                    break;
                                }
                            }
                        }
                    }
                } catch (\Throwable $e) {}
            }
        }

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

