<?php

declare(strict_types=1);

namespace App\Config;

class Env
{
    private static bool $loaded = false;
    private static array $vars = [];

    public static function load(?string $path = null): void
    {
        if (self::$loaded) {
            return;
        }

        $path = $path ?? dirname(__DIR__, 2) . '/.env';
        if (file_exists($path)) {
            $lines = @file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if ($lines !== false) {
                foreach ($lines as $line) {
                    $line = trim($line);
                    if ($line === '' || str_starts_with($line, '#')) {
                        continue;
                    }

                    $parts = explode('=', $line, 2);
                    if (count($parts) === 2) {
                        $key = trim($parts[0]);
                        $val = trim($parts[1]);
                        // Strip surrounding quotes
                        if ((str_starts_with($val, '"') && str_ends_with($val, '"')) ||
                            (str_starts_with($val, "'") && str_ends_with($val, "'"))) {
                            $val = substr($val, 1, -1);
                        }
                        self::$vars[$key] = $val;
                        $_ENV[$key] = $val;
                        $_SERVER[$key] = $val;
                        putenv("{$key}={$val}");
                    }
                }
            }
        }
        self::$loaded = true;
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        self::load();
        $val = self::$vars[$key] ?? $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);
        if ($val === false || $val === null || $val === '') {
            return $default;
        }
        return match (strtolower((string)$val)) {
            'true', '(true)' => true,
            'false', '(false)' => false,
            'empty', '(empty)' => '',
            'null', '(null)' => null,
            default => $val,
        };
    }
}
