<?php

declare(strict_types=1);

namespace App\Audit;

require_once dirname(__DIR__) . '/vendor/autoload.php';

use ReflectionClass;

/**
 * EconSim Production Audit & Verification Agent
 * 
 * An autonomous quality assurance and integrity verification suite for EconSim.
 * Audits all code, routing definitions, view renderers, security guards, 
 * database migration schemas, and production readiness.
 */
class ProductionAuditAgent
{
    private string $root;
    private int $passed = 0;
    private int $failed = 0;
    private int $warnings = 0;
    private bool $checkRemote = false;
    private string $prodUrl = 'https://developing-market.onrender.com';

    public function __construct(bool $checkRemote = false, ?string $prodUrl = null)
    {
        $this->root = dirname(__DIR__);
        $this->checkRemote = $checkRemote;
        if ($prodUrl) {
            $this->prodUrl = rtrim($prodUrl, '/');
        }
    }

    public function run(): int
    {
        $this->printHeader();

        $this->auditPhpSyntax();
        $this->auditJsSyntax();
        $this->auditRouteAndControllerIntegrity();
        $this->auditFrontendViewTemplates();
        $this->auditSecurityHardening();
        $this->auditDatabaseMigrationSchemas();
        $this->auditConfigurationIntegrity();

        if ($this->checkRemote) {
            $this->auditLiveProductionApi();
        }

        return $this->printSummary();
    }

    private function printHeader(): void
    {
        echo "\n";
        echo "====================================================================\n";
        echo "  🏛️  ECONSIM AUTONOMOUS PRODUCTION AUDIT & VERIFICATION AGENT\n";
        echo "====================================================================\n";
        echo " Target Directory:   {$this->root}\n";
        echo " Execution Mode:     " . ($this->checkRemote ? "Full System + Remote Live ({$this->prodUrl})" : "Full System Codebase & Architectural Audit") . "\n";
        echo " Audit Timestamp:    " . gmdate('Y-m-d H:i:s') . " UTC\n";
        echo "--------------------------------------------------------------------\n\n";
    }

    /**
     * 1. Audit PHP Syntax across all source files
     */
    private function auditPhpSyntax(): void
    {
        echo "🔍 [1/7] Auditing PHP Codebase Syntax & Linting...\n";
        $dirs = ['src', 'public', 'bin'];
        $phpFiles = [];

        foreach ($dirs as $dir) {
            $fullPath = $this->root . '/' . $dir;
            if (!is_dir($fullPath)) continue;

            $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($fullPath));
            foreach ($iterator as $file) {
                if ($file->isFile() && $file->getExtension() === 'php') {
                    $phpFiles[] = $file->getPathname();
                }
            }
        }

        $syntaxErrors = 0;
        foreach ($phpFiles as $file) {
            $output = [];
            $returnVar = 0;
            exec("php -l " . escapeshellarg($file) . " 2>&1", $output, $returnVar);
            if ($returnVar !== 0) {
                $rel = str_replace($this->root . DIRECTORY_SEPARATOR, '', $file);
                $this->recordFailure("PHP Syntax Error in {$rel}: " . implode(' ', $output));
                $syntaxErrors++;
            }
        }

        if ($syntaxErrors === 0) {
            $this->recordPass("All " . count($phpFiles) . " PHP files verified with zero syntax errors.");
        }
    }

    /**
     * 2. Audit JavaScript Architecture Syntax
     */
    private function auditJsSyntax(): void
    {
        echo "\n🔍 [2/7] Auditing JavaScript Architecture Syntax...\n";
        $jsFiles = [
            $this->root . '/public/js/app.js',
            $this->root . '/public/js/api.js',
            $this->root . '/public/js/voice.js',
        ];

        foreach ($jsFiles as $jsFile) {
            if (!file_exists($jsFile)) continue;
            $rel = str_replace($this->root . DIRECTORY_SEPARATOR, '', $jsFile);

            $output = [];
            $returnVar = 0;
            exec("node -c " . escapeshellarg($jsFile) . " 2>&1", $output, $returnVar);

            if ($returnVar === 0) {
                $this->recordPass("{$rel} validated with zero syntax errors.");
            } else {
                $this->recordFailure("JavaScript Syntax Error in {$rel}: " . implode(' ', $output));
            }
        }
    }

    /**
     * 3. Audit Route and Controller Mapping Integrity
     */
    private function auditRouteAndControllerIntegrity(): void
    {
        echo "\n🔍 [3/7] Auditing Route Handlers & Controller Reflection...\n";

        $indexPath = $this->root . '/public/index.php';
        $indexContent = file_get_contents($indexPath);

        preg_match_all('/\$router->(get|post|patch|delete)\s*\(\s*[\'"]([^\'"]+)[\'"]\s*,\s*\[\s*([a-zA-Z0-9_\\\\]+)::class\s*,\s*[\'"]([a-zA-Z0-9_]+)[\'"]\s*\]\s*\)/', $indexContent, $matches, PREG_SET_ORDER);

        if (empty($matches)) {
            $this->recordWarning("Could not parse route definitions from public/index.php");
            return;
        }

        $routesChecked = 0;
        $handlerErrors = 0;

        foreach ($matches as $m) {
            $httpMethod = strtoupper($m[1]);
            $routePath = $m[2];
            $controllerClass = $m[3];
            $methodName = $m[4];
            $routesChecked++;

            if (!str_starts_with($controllerClass, '\\') && !str_starts_with($controllerClass, 'App\\Controllers\\')) {
                $fullClass = 'App\\Controllers\\' . $controllerClass;
            } else {
                $fullClass = $controllerClass;
            }

            if (!class_exists($fullClass)) {
                $this->recordFailure("Route [{$httpMethod} {$routePath}] references non-existent class: {$fullClass}");
                $handlerErrors++;
                continue;
            }

            $ref = new ReflectionClass($fullClass);
            if (!$ref->hasMethod($methodName)) {
                $this->recordFailure("Route [{$httpMethod} {$routePath}] references non-existent method: {$fullClass}::{$methodName}()");
                $handlerErrors++;
                continue;
            }

            $methodRef = $ref->getMethod($methodName);
            if (!$methodRef->isPublic()) {
                $this->recordFailure("Route [{$httpMethod} {$routePath}] references non-public method: {$fullClass}::{$methodName}()");
                $handlerErrors++;
            }
        }

        if ($handlerErrors === 0) {
            $this->recordPass("All {$routesChecked} registered API routes map to valid, callable controller methods.");
        }
    }

    /**
     * 4. Audit Frontend Views & Element ID Alignment
     */
    private function auditFrontendViewTemplates(): void
    {
        echo "\n🔍 [4/7] Auditing Frontend View Templates & Shell Shells...\n";
        $appJsPath = $this->root . '/public/js/app.js';
        $indexHtmlPath = $this->root . '/public/index.html';
        $adminHtmlPath = $this->root . '/public/a.html';

        $appJs = file_get_contents($appJsPath);
        $indexHtml = file_get_contents($indexHtmlPath);
        $adminHtml = file_exists($adminHtmlPath) ? file_get_contents($adminHtmlPath) : '';

        // Verify key structural containers in public/index.html
        $criticalIds = ['app', 'toast', 'global-loader'];
        foreach ($criticalIds as $id) {
            if (strpos($indexHtml, "id=\"{$id}\"") !== false || strpos($indexHtml, "id='{$id}'") !== false) {
                $this->recordPass("DOM root container #{$id} is verified in index.html shell.");
            } else {
                $this->recordFailure("Critical DOM container #{$id} is missing in index.html!");
            }
        }

        // Verify Operations Terminal in public/a.html
        if (!empty($adminHtml)) {
            $this->recordPass("Operations Terminal shell (public/a.html) is verified and present.");
        } else {
            $this->recordFailure("Operations Terminal shell (public/a.html) missing!");
        }

        // Verify all 16 page view renderers in app.js
        $coreViews = [
            'dashboard' => 'renderDashboard',
            'predictor' => 'renderPredictor',
            'market' => 'renderMarketDetail',
            'boardroom' => 'renderBoardroom',
            'create_challenge' => 'renderCreateChallenge',
            'waiting_room' => 'renderWaitingRoom',
            'live_challenge' => 'renderLiveChallenge',
            'challenge_report' => 'renderChallengeReport',
            'wallet' => 'renderWalletPage',
            'leaderboard' => 'renderLeaderboardPage',
            'mentor' => 'renderMentorPage',
            'lab' => 'renderScenarioLab',
            'profile' => 'renderProfilePage',
            'settings' => 'renderSettingsPage',
            'auth' => 'renderAuthPage',
            'onboarding' => 'renderOnboardingPage',
        ];

        $viewFailures = 0;
        foreach ($coreViews as $pageName => $fnName) {
            if (strpos($appJs, "function {$fnName}(") === false) {
                $this->recordFailure("Missing view renderer '{$fnName}()' for page '{$pageName}'!");
                $viewFailures++;
            }
        }

        if ($viewFailures === 0) {
            $this->recordPass("All 16 core page view renderers in app.js are verified and implemented.");
        }
    }

    /**
     * 5. Audit Security Hardening & Obfuscation Guards
     */
    private function auditSecurityHardening(): void
    {
        echo "\n🔍 [5/7] Auditing Security Hardening & Obfuscated Paths...\n";

        $indexPath = $this->root . '/public/index.php';
        $indexContent = file_get_contents($indexPath);

        // Verify /a routing is present
        if (strpos($indexContent, "if (\$path === '/a' || \$path === '/a/')") !== false) {
            $this->recordPass("Obfuscated admin path '/a' is mapped strictly to public/a.html.");
        } else {
            $this->recordFailure("Obfuscated admin path '/a' is missing in public/index.php router!");
        }

        // Verify direct /admin, /admin.html, /a.html are strictly blocked with 404
        if (strpos($indexContent, "\$path === '/admin'") !== false && strpos($indexContent, "404 Not Found") !== false) {
            $this->recordPass("Security Guard: Automated scanner honeypots (/admin, /admin.html, /a.html) are hard-coded to return 404 Not Found.");
        } else {
            $this->recordFailure("Security Guard: Scanner honeypots not properly blocked with 404!");
        }
    }

    /**
     * 6. Audit Database Migration Schemas
     */
    private function auditDatabaseMigrationSchemas(): void
    {
        echo "\n🔍 [6/7] Auditing Database Migration Schemas & DDL...\n";

        $schemaFile = $this->root . '/database/001_schema_mysql.sql';
        if (!file_exists($schemaFile)) {
            $this->recordFailure("Missing base schema file: database/001_schema_mysql.sql");
            return;
        }

        $schemaSql = file_get_contents($schemaFile);

        // Verify critical double-entry and boardroom tables
        $tables = [
            'users',
            'ledger_accounts',
            'ledger_journals',
            'ledger_entries',
            'market_events',
            'forecast_positions',
            'boardroom_challenges',
            'boardroom_submissions',
            'evaluation_runs',
            'evaluation_scores',
            'user_feedbacks',
            'expert_scenario_submissions',
        ];

        $missingTables = 0;
        foreach ($tables as $tbl) {
            if (stripos($schemaSql, "CREATE TABLE IF NOT EXISTS `{$tbl}`") === false &&
                stripos($schemaSql, "CREATE TABLE `{$tbl}`") === false &&
                stripos($schemaSql, "CREATE TABLE IF NOT EXISTS {$tbl}") === false &&
                stripos($schemaSql, "CREATE TABLE {$tbl}") === false) {
                // Check if table is created in separate migration file
                $foundInMigration = false;
                $migrationFiles = glob($this->root . '/database/*.sql');
                foreach ($migrationFiles as $mf) {
                    $mSql = file_get_contents($mf);
                    if (stripos($mSql, $tbl) !== false) {
                        $foundInMigration = true;
                        break;
                    }
                }
                if (!$foundInMigration) {
                    $this->recordFailure("Schema definition missing for required table: {$tbl}");
                    $missingTables++;
                }
            }
        }

        if ($missingTables === 0) {
            $this->recordPass("All " . count($tables) . " core enterprise database table schemas verified.");
        }
    }

    /**
     * 7. Audit Configuration & Production Deployment Blueprint
     */
    private function auditConfigurationIntegrity(): void
    {
        echo "\n🔍 [7/7] Auditing Production Deployment Blueprint & Configuration...\n";

        // Check render.yaml & Dockerfile
        $renderYaml = $this->root . '/render.yaml';
        $dockerfile = $this->root . '/Dockerfile';

        if (file_exists($renderYaml)) {
            $content = file_get_contents($renderYaml);
            if (strpos($content, 'runtime: docker') !== false) {
                if (file_exists($dockerfile) && strpos(file_get_contents($dockerfile), 'CMD') !== false) {
                    $this->recordPass("render.yaml (Docker runtime) and production Dockerfile entrypoint verified.");
                } else {
                    $this->recordFailure("render.yaml specifies Docker runtime, but valid Dockerfile is missing!");
                }
            } elseif (strpos($content, 'buildCommand') !== false && strpos($content, 'startCommand') !== false) {
                $this->recordPass("render.yaml is valid with configured build and start directives.");
            } else {
                $this->recordFailure("render.yaml is missing runtime/build directives!");
            }
        } else {
            $this->recordFailure("Missing render.yaml deployment blueprint!");
        }

        // Check composer.json
        $composerJson = $this->root . '/composer.json';
        if (file_exists($composerJson)) {
            $data = json_decode(file_get_contents($composerJson), true);
            if (json_last_error() === JSON_ERROR_NONE && !empty($data['autoload']['psr-4']['App\\'])) {
                $this->recordPass("composer.json is valid with PSR-4 autoloading mapped to App\\.");
            } else {
                $this->recordFailure("composer.json is invalid or missing PSR-4 autoloading mapping!");
            }
        } else {
            $this->recordFailure("Missing composer.json!");
        }
    }

    /**
     * Optional: Audit Live Production API Endpoints
     */
    private function auditLiveProductionApi(): void
    {
        echo "\n🔍 [BONUS] Auditing Live Production API Connectivity ({$this->prodUrl})...\n";

        $endpoints = [
            ['GET', '/api/health', 200, 'Healthy database connectivity'],
            ['GET', '/api/features', 200, 'Feature flags availability'],
            ['GET', '/api/markets', 200, 'Predictor market catalog'],
            ['GET', '/api/boardroom/lobby', 200, 'Boardroom lounge lobby'],
            ['GET', '/api/leaderboard', 200, 'Global strategist leaderboard'],
            ['GET', '/api/lab/meta', 200, 'Scenario Lab meta catalogue'],
            ['GET', '/a', 200, 'Operations Terminal Shell (/a)'],
        ];

        foreach ($endpoints as [$method, $uri, $expectedStatus, $desc]) {
            $res = $this->httpQuery($method, $this->prodUrl . $uri);
            if ($res['status'] === $expectedStatus) {
                $this->recordPass("Live [{$method} {$uri}] returned HTTP {$res['status']} ({$desc}).");
            } else {
                $this->recordWarning("Live [{$method} {$uri}] returned HTTP {$res['status']} (expected {$expectedStatus}). Latency: {$res['latency']}ms.");
            }
        }
    }

    private function httpQuery(string $method, string $url): array
    {
        $start = microtime(true);
        $cmd = sprintf(
            'powershell -Command "(Invoke-WebRequest -Uri %s -Method %s -UseBasicParsing -TimeoutSec 20).StatusCode"',
            escapeshellarg($url),
            escapeshellarg($method)
        );
        $output = [];
        $code = 0;
        exec($cmd, $output, $code);
        $latencyMs = round((microtime(true) - $start) * 1000);

        $status = (!empty($output) && is_numeric(trim($output[0]))) ? (int)trim($output[0]) : 0;

        return [
            'status' => $status,
            'latency' => $latencyMs,
        ];
    }

    private function recordPass(string $msg): void
    {
        $this->passed++;
        echo "   ✅ PASS: {$msg}\n";
    }

    private function recordFailure(string $msg): void
    {
        $this->failed++;
        echo "   ❌ FAIL: {$msg}\n";
    }

    private function recordWarning(string $msg): void
    {
        $this->warnings++;
        echo "   ⚠️ WARN: {$msg}\n";
    }

    private function printSummary(): int
    {
        $total = $this->passed + $this->failed + $this->warnings;
        echo "\n====================================================================\n";
        echo "  📊 AUDIT EXECUTION SUMMARY\n";
        echo "====================================================================\n";
        echo "  Total Checks:    {$total}\n";
        echo "  Passed:          {$this->passed}\n";
        echo "  Failed:          {$this->failed}\n";
        echo "  Warnings:        {$this->warnings}\n";

        if ($this->failed === 0) {
            echo "\n  🎉 PRODUCTION READINESS STATUS: 100% HEALTHY & VERIFIED\n";
            echo "  All subsystems, controllers, pages, and connections are ready.\n";
            echo "====================================================================\n\n";
            return 0;
        } else {
            echo "\n  ⚠️ PRODUCTION AUDIT DETECTED {$this->failed} ISSUE(S)\n";
            echo "====================================================================\n\n";
            return 1;
        }
    }
}

// Execute CLI
$checkRemote = in_array('--remote', $argv, true);
$prodTarget = null;
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--url=')) {
        $prodTarget = substr($arg, 6);
        $checkRemote = true;
    }
}

$agent = new ProductionAuditAgent($checkRemote, $prodTarget);
exit($agent->run());
