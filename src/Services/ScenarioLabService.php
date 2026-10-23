<?php

declare(strict_types=1);

namespace App\Services;

use App\Config\Database;
use App\Config\Env;
use App\Utils\Security;
use PDO;
use RuntimeException;
use Throwable;

class ScenarioLabService
{
    /**
     * Complete suite of 10 Macroeconomic & Industry Sectors.
     */
    public static function getIndustries(): array
    {
        return [
            [
                'slug' => 'monetary',
                'name' => 'Monetary Policy & Banking',
                'icon' => '🏦',
                'tagline' => 'Liquidity transmission, benchmark yield corridors, and CRR sterilization.',
                'primary_levers' => ['mpr', 'inflation', 'crr', 'fx_rate'],
            ],
            [
                'slug' => 'energy',
                'name' => 'Energy & Petroleum',
                'icon' => '⚡',
                'tagline' => 'Crude oil market pricing, domestic pump deregulation, and power gas tariffs.',
                'primary_levers' => ['fuel_price', 'fx_rate', 'crude_oil', 'inflation'],
            ],
            [
                'slug' => 'agriculture',
                'name' => 'Agriculture & Commodities',
                'icon' => '🌾',
                'tagline' => 'Farmgate logistics, fertilizer import costs, and household food basket pricing.',
                'primary_levers' => ['fuel_price', 'inflation', 'mpr', 'fx_rate'],
            ],
            [
                'slug' => 'manufacturing',
                'name' => 'Manufacturing & Real Sector',
                'icon' => '🏭',
                'tagline' => 'Industrial working capital borrowing, raw material FX sourcing, and CapEx.',
                'primary_levers' => ['mpr', 'fx_rate', 'fuel_price', 'inflation'],
            ],
            [
                'slug' => 'fintech',
                'name' => 'Fintech & Digital Payments',
                'icon' => '💻',
                'tagline' => 'Interchange margins, high-yield deposit flight to T-Bills, and float management.',
                'primary_levers' => ['mpr', 'inflation', 'spend_impulse', 'fx_rate'],
            ],
            [
                'slug' => 'telecoms',
                'name' => 'Telecoms & Infrastructure',
                'icon' => '📱',
                'tagline' => 'Tower diesel opex, foreign spectrum debt, and subscriber ARPU elasticity.',
                'primary_levers' => ['fuel_price', 'fx_rate', 'inflation', 'mpr'],
            ],
            [
                'slug' => 'fmcg',
                'name' => 'FMCG & Consumer Goods',
                'icon' => '🛒',
                'tagline' => 'Real wage erosion, household basket elasticity, and packaging import costs.',
                'primary_levers' => ['inflation', 'fx_rate', 'fuel_price', 'mpr'],
            ],
            [
                'slug' => 'real-estate',
                'name' => 'Real Estate & Construction',
                'icon' => '🏢',
                'tagline' => 'Cement & steel inputs, commercial mortgage rates, and rental yields.',
                'primary_levers' => ['mpr', 'inflation', 'fx_rate', 'spend_impulse'],
            ],
            [
                'slug' => 'logistics',
                'name' => 'Aviation, Marine & Logistics',
                'icon' => '✈️',
                'tagline' => 'Jet A1 fuel prices, foreign airline ticket remittances, and port freight.',
                'primary_levers' => ['fuel_price', 'fx_rate', 'inflation', 'mpr'],
            ],
            [
                'slug' => 'healthcare',
                'name' => 'Healthcare & Pharmaceuticals',
                'icon' => '🏥',
                'tagline' => 'Active pharmaceutical ingredient (API) import costs and healthcare access.',
                'primary_levers' => ['fx_rate', 'inflation', 'spend_impulse', 'mpr'],
            ],
        ];
    }

    /**
     * Pre-stored empirical and structural scenarios per industry.
     */
    public static function getIndustryScenarios(string $industrySlug): array
    {
        $all = [
            'monetary' => [
                [
                    'id' => 'mon_1',
                    'title' => '2024–2026 Aggressive MPC Tightening Cycle (750+ bps)',
                    'description' => 'The Central Bank of Nigeria raises the benchmark Monetary Policy Rate aggressively to curb multi-decade high inflation, narrow negative real yields, and incentivize foreign portfolio investor (FPI) capital flows into Treasury & OMO Bills.',
                    'default_params' => ['mpr' => 27.25, 'inflation' => 32.5, 'crr' => 45.0, 'fx_rate' => 1650, 'spend_impulse' => 14],
                    'core_dilemma' => 'Will aggressive liquidity contraction successfully arrest headline inflation before triggering a credit crunch and spike in banking non-performing loans (NPLs)?',
                ],
                [
                    'id' => 'mon_2',
                    'title' => 'Sovereign Debt Issuance & Yield Inversion',
                    'description' => 'Massive domestic borrowing by the Federal Government to finance fiscal deficit leads to sovereign debt service absorbing over 70% of revenues, crowding out private commercial borrowing.',
                    'default_params' => ['mpr' => 24.0, 'inflation' => 28.0, 'crr' => 35.0, 'fx_rate' => 1550, 'spend_impulse' => 22],
                    'core_dilemma' => 'How can commercial banks manage liquidity when risk-free sovereign paper yields 22%+ while private sector loans carry acute default risk?',
                ],
                [
                    'id' => 'mon_3',
                    'title' => 'Currency Float & Foreign Currency Asset Stress Test',
                    'description' => 'A sudden 35% depreciation of the official exchange rate causes severe foreign currency debt revaluation on bank balance sheets and compresses corporate capital adequacy.',
                    'default_params' => ['mpr' => 22.5, 'inflation' => 34.0, 'crr' => 32.5, 'fx_rate' => 1850, 'spend_impulse' => 12],
                    'core_dilemma' => 'Should commercial banks aggressively provision for FX loan defaults or restructure obligations over extended repayment horizons?',
                ],
            ],
            'energy' => [
                [
                    'id' => 'ene_1',
                    'title' => 'Complete Retail Petroleum Deregulation & Market Pricing',
                    'description' => 'Removal of direct petroleum subsidies and transition to fully deregulated ex-depot and retail pump pricing, passing global freight and crude costs to domestic consumers.',
                    'default_params' => ['fuel_price' => 1050, 'fx_rate' => 1650, 'crude_oil' => 78, 'inflation' => 31.0, 'mpr' => 26.0],
                    'core_dilemma' => 'How do domestic industrial distributors and logistics operators maintain operating runway when transport energy costs jump over 150% in a single quarter?',
                ],
                [
                    'id' => 'ene_2',
                    'title' => 'Cost-Reflective Electricity Band-A Tariff Overhaul',
                    'description' => 'Nigerian Electricity Regulatory Commission (NERC) eliminates electricity subsidies for urban commercial and industrial consumers, raising Band-A tariffs by over 200%.',
                    'default_params' => ['fuel_price' => 950, 'fx_rate' => 1600, 'crude_oil' => 82, 'inflation' => 29.5, 'mpr' => 25.0],
                    'core_dilemma' => 'Does higher grid electricity pricing reduce dependence on expensive diesel generators or lead to widespread factory output contraction?',
                ],
            ],
            'manufacturing' => [
                [
                    'id' => 'mfg_1',
                    'title' => 'Raw Material Import FX Squeeze & Working Capital Freeze',
                    'description' => 'Industrial manufacturers face severe foreign exchange illiquidity to open letters of credit for intermediate input materials, combined with commercial bank lending rates above 33%.',
                    'default_params' => ['mpr' => 28.0, 'fx_rate' => 1720, 'fuel_price' => 1100, 'inflation' => 33.0, 'spend_impulse' => 10],
                    'core_dilemma' => 'Can domestic manufacturers successfully substitute imported inputs with local materials before depleted cash runways force factory shutdowns?',
                ],
                [
                    'id' => 'mfg_2',
                    'title' => 'Industrial Diesel Tariff Surge & Warehouse Glut',
                    'description' => 'Factory power generation costs escalate dramatically as automotive gas oil (AGO) prices surge, while finished consumer goods pile up in warehouses due to collapsed consumer purchasing power.',
                    'default_params' => ['mpr' => 26.5, 'fx_rate' => 1600, 'fuel_price' => 1250, 'inflation' => 34.5, 'spend_impulse' => 12],
                    'core_dilemma' => 'How can industrial CFOs manage cash flow when unit gross margins turn negative across core product lines?',
                ],
            ],
            'agriculture' => [
                [
                    'id' => 'agr_1',
                    'title' => 'Food Logistics Multiplier & Farmgate Price Escalation',
                    'description' => 'Interstate food haulage costs escalate rapidly due to diesel fuel increases and localized security friction, creating a wide divergence between farmgate earnings and urban retail market prices.',
                    'default_params' => ['fuel_price' => 1150, 'inflation' => 37.5, 'fx_rate' => 1650, 'mpr' => 26.75, 'spend_impulse' => 15],
                    'core_dilemma' => 'What interventions can stabilize urban food basket inflation without bankrupting smallholder rural farmers?',
                ],
            ],
            'fintech' => [
                [
                    'id' => 'fin_1',
                    'title' => 'Treasury Yield Magnet & Digital Deposit Disintermediation',
                    'description' => 'With 1-year Treasury bills yielding 22%+ and commercial banks offering high-yield fixed deposits, consumer savings flee digital neo-bank wallets, squeezing low-cost float balances.',
                    'default_params' => ['mpr' => 27.25, 'inflation' => 32.0, 'spend_impulse' => 14, 'fx_rate' => 1650, 'crr' => 45.0],
                    'core_dilemma' => 'How can fintech apps pivot from zero-cost transaction float to sustainable credit underwriting and institutional wealth monetization?',
                ],
            ],
        ];

        return $all[$industrySlug] ?? $all['monetary'];
    }

    /**
     * Deep educational economic definitions for every lever.
     */
    public static function getMetricDefinitions(): array
    {
        return [
            'mpr' => [
                'name' => 'Monetary Policy Rate (MPR)',
                'unit' => '%',
                'min' => 5,
                'max' => 35,
                'step' => 0.25,
                'definition' => 'The benchmark anchor interest rate set by the Central Bank of Nigeria Monetary Policy Committee (MPC). It sets the baseline cost of funds across the entire financial system.',
                'emerging_market_context' => 'In Nigeria, the CBN deploys an Asymmetric Corridor around the MPR (e.g. +100/-300 bps) for Standing Lending (SLF) and Standing Deposit (SDF) facilities. When MPR rises, commercial banks immediately reprice corporate credit lines upward.',
                'transmission_channels' => [
                    '1st Order (Direct)' => 'Interbank lending rates (NIBOR) and short-term Treasury bill yields spike immediately.',
                    '2nd Order (Commercial)' => 'Bank prime lending rates rise toward 30%–36%, increasing debt servicing costs for corporate borrowers.',
                    '3rd Order (Macro)' => 'Private sector credit demand contracts; economic growth slows while demand-pull inflation is restrained.',
                ],
                'executive_implications' => 'Corporate treasurers must lock in long-term fixed-rate debt, pay down floating overdraft facilities, and allocate surplus treasury liquidity into high-yield sovereign paper.',
            ],
            'inflation' => [
                'name' => 'Headline Inflation (CPI)',
                'unit' => '%',
                'min' => 2,
                'max' => 50,
                'step' => 0.5,
                'definition' => 'The year-on-year rate of change in the National Bureau of Statistics (NBS) Consumer Price Index, measuring price movements across the national basket of goods and services.',
                'emerging_market_context' => 'In Nigeria, Food Inflation accounts for over 50% of the CPI weighting. Structural logistics bottlenecks, currency devaluation, and energy costs mean inflation in Nigeria is largely supply-push and cost-push rather than purely demand-pull.',
                'transmission_channels' => [
                    '1st Order' => 'Household disposable real income collapses; consumers cut discretionary spending and trade down to basic staples.',
                    '2nd Order' => 'Corporate operating margins compress as businesses cannot pass 100% of input cost increases to price-sensitive customers.',
                    '3rd Order' => 'Negative real returns on domestic currency incentivize capital flight into foreign currency (USD) and hard assets.',
                ],
                'executive_implications' => 'CFOs must implement dynamic shrinkflation, streamline product packaging, and shorten vendor payment terms to protect working capital velocity.',
            ],
            'fx_rate' => [
                'name' => 'Exchange Rate (USD/NGN)',
                'unit' => '₦/$',
                'min' => 700,
                'max' => 2500,
                'step' => 25,
                'definition' => 'The price of one US Dollar in Nigerian Naira on the Nigerian Autonomous Foreign Exchange Market (NAFEM).',
                'emerging_market_context' => 'Because Nigeria imports significant industrial machinery, vehicle parts, wheat, and petrochemical derivatives, currency pass-through into domestic consumer prices is rapid (typically 60–90 days).',
                'transmission_channels' => [
                    '1st Order' => 'Immediate repricing of import clearing customs duty benchmark and landed cost of imported raw materials.',
                    '2nd Order' => 'Unhedged foreign currency loans on corporate balance sheets trigger massive paper and cash foreign exchange revaluation losses.',
                    '3rd Order' => 'Export competitiveness improves for agricultural commodities (cocoa, sesame, cashew), incentivizing non-oil export inflows.',
                ],
                'executive_implications' => 'Businesses must implement FX hedging strategies, maintain natural hedges by generating USD export revenues, and renegotiate FX-denominated supplier contracts.',
            ],
            'fuel_price' => [
                'name' => 'Industrial Fuel & Pump Price',
                'unit' => '₦/Litre',
                'min' => 500,
                'max' => 2000,
                'step' => 25,
                'definition' => 'The market retail price per litre of Premium Motor Spirit (PMS) and Automotive Gas Oil (AGO / Diesel).',
                'emerging_market_context' => 'Due to electrical grid unreliability, Nigerian commercial enterprises rely heavily on diesel and petrol generators for primary or backup factory power. Fuel price changes act as an immediate universal economic tax.',
                'transmission_channels' => [
                    '1st Order' => 'Interstate transport freight rates and urban logistics delivery fees rise instantaneously.',
                    '2nd Order' => 'Commercial and industrial distributed power costs increase, driving up factory unit production costs.',
                    '3rd Order' => 'Farmgate food prices spike in urban retail markets despite stable harvest yields.',
                ],
                'executive_implications' => 'Companies must accelerate investments in solar-hybrid industrial microgrids, optimize delivery fleet routing, and consolidate logistics distribution hubs.',
            ],
            'crr' => [
                'name' => 'Cash Reserve Requirement (CRR)',
                'unit' => '%',
                'min' => 10,
                'max' => 60,
                'step' => 1.0,
                'definition' => 'The statutory percentage of commercial bank customer deposits that must be sterilized at the Central Bank of Nigeria, earning zero interest.',
                'emerging_market_context' => 'The CBN frequently uses discretionary Cash Reserve debits as a blunt quantitative tightening tool to drain system liquidity. Effective CRR in Nigeria has historically reached over 50% for commercial banks.',
                'transmission_channels' => [
                    '1st Order' => 'Commercial banks experience sudden interbank liquidity shortages and are forced to borrow from the CBN SLF window at premium rates.',
                    '2nd Order' => 'Banks increase their loan-to-deposit margin spreads, making commercial loans significantly more expensive.',
                    '3rd Order' => 'Lending to real sector SMEs dries up as banks restrict credit exclusively to blue-chip multinational corporates.',
                ],
                'executive_implications' => 'Corporate treasurers must maintain backup lines of credit across multiple financial institutions to protect against sudden credit line freezes during CRR debit cycles.',
            ],
            'spend_impulse' => [
                'name' => 'Fiscal Deficit Impulse',
                'unit' => '% of GDP',
                'min' => 1,
                'max' => 25,
                'step' => 1.0,
                'definition' => 'The net expansionary contribution of government fiscal spending and domestic borrowing relative to national gross domestic product.',
                'emerging_market_context' => 'When fiscal deficits expand in an economy with structural tax collection limitations, the government issues massive Treasury bonds or accesses central bank overdraft financing (Ways and Means), inflating broad money supply.',
                'transmission_channels' => [
                    '1st Order' => 'Government debt service obligations increase, consuming a higher percentage of annual budgetary revenues.',
                    '2nd Order' => 'High sovereign debt issuance crowds out private commercial paper and corporate bonds in the domestic capital market.',
                    '3rd Order' => 'Excess money supply expansion undermines monetary tightening, sustaining chronic double-digit inflation.',
                ],
                'executive_implications' => 'Analysts must monitor the DMO bond auction calendar and fiscal deficit numbers to anticipate future tax policy changes and domestic interest rate hikes.',
            ],
        ];
    }

    /**
     * Compute real-time macroeconomic & industry stress sensitivity metrics.
     */
    public static function simulate(string $industrySlug, array $params): array
    {
        $mpr = (float)($params['mpr'] ?? 26.25);
        $inflation = (float)($params['inflation'] ?? 32.0);
        $fxRate = (float)($params['fx_rate'] ?? 1650);
        $fuelPrice = (float)($params['fuel_price'] ?? 1050);
        $crr = (float)($params['crr'] ?? 45.0);
        $spend = (float)($params['spend_impulse'] ?? 12.0);

        // Core sensitivity formulations
        // 1. Projected 12M Inflation
        // Tightening MPR dampens demand CPI, but high fuel & FX depreciation drive cost-push CPI
        $fxDeprecFactor = max(0, ($fxRate - 1000) / 1000) * 8.5;
        $fuelShockFactor = max(0, ($fuelPrice - 700) / 500) * 6.2;
        $mprDamping = ($mpr - 20) * 0.45;
        $crrDamping = ($crr - 32.5) * 0.12;
        $fiscalPush = ($spend - 10) * 0.35;

        $projectedInflation = round(max(5.0, min(65.0, $inflation + $fxDeprecFactor + $fuelShockFactor + $fiscalPush - $mprDamping - $crrDamping)), 1);

        // 2. Real Sector Credit Impulse (0-100)
        // High MPR and high CRR severely restrict credit creation
        $creditImpulse = round(max(5, min(95, 68 - ($mpr - 15) * 1.8 - ($crr - 25) * 0.65 + ($spend - 10) * 0.4)));

        // 3. Corporate Investment & CapEx Index (0-100)
        $investmentIndex = round(max(5, min(95, 72 - ($mpr - 15) * 1.5 - ($projectedInflation - 20) * 0.8 + ($spend - 10) * 0.3)));

        // 4. Consumer Purchasing Power Index (0-100)
        $purchasingPower = round(max(10, min(90, 75 - ($projectedInflation - 15) * 1.3 - ($fuelPrice - 600) * 0.025)));

        // 5. Sovereign Debt Service-to-Revenue Burden (%)
        $debtServiceBurden = round(max(30, min(98, 48 + ($mpr - 15) * 1.6 + ($spend - 8) * 0.9)));

        // 6. Industry Specific Gross Margin Stress (%)
        $marginStress = match ($industrySlug) {
            'manufacturing' => round(max(-35, min(15, 12 - ($fxRate - 1200) * 0.02 - ($fuelPrice - 700) * 0.015 - ($mpr - 18) * 0.8)), 1),
            'fmcg' => round(max(-30, min(18, 14 - ($purchasingPower < 50 ? (50 - $purchasingPower) * 0.4 : 0) - ($fxRate - 1200) * 0.012)), 1),
            'energy' => round(max(-20, min(30, 8 + ($fuelPrice - 800) * 0.025 - ($fxRate - 1200) * 0.01)), 1),
            'banking' => round(max(-15, min(35, 10 + ($mpr - 18) * 1.1 - ($creditImpulse < 40 ? (40 - $creditImpulse) * 0.5 : 0))), 1),
            default => round(max(-25, min(20, 10 - ($mpr - 20) * 0.6 - ($projectedInflation - 25) * 0.4)), 1),
        };

        // 7. Sovereign FX Reserve Pressure Rating
        $fxPressure = ($fxRate > 1800 || $projectedInflation > 38) ? 'Critical Alert' : (($fxRate > 1550) ? 'Elevated Strain' : 'Managed Corridor');

        return [
            'industry' => $industrySlug,
            'parameters' => [
                'mpr' => $mpr,
                'inflation' => $inflation,
                'fx_rate' => $fxRate,
                'fuel_price' => $fuelPrice,
                'crr' => $crr,
                'spend_impulse' => $spend,
            ],
            'metrics' => [
                'projected_inflation' => $projectedInflation,
                'credit_impulse' => $creditImpulse,
                'investment_index' => $investmentIndex,
                'purchasing_power' => $purchasingPower,
                'debt_service_burden' => $debtServiceBurden,
                'margin_stress' => $marginStress,
                'fx_pressure' => $fxPressure,
            ],
            'status' => 'simulated',
        ];
    }

    /**
     * Generate custom scenario using NVIDIA NIM AI Model on demand.
     */
    public static function generateAiScenario(string $industrySlug, string $promptText): array
    {
        $activeModel = FeatureService::getActiveAiModel();
        $apiKey = (string)Env::get('NVIDIA_NIM_API_KEY', '');
        $url = (string)Env::get('NVIDIA_NIM_BASE_URL', 'https://integrate.api.nvidia.com/v1') . '/chat/completions';

        if (empty($apiKey)) {
            // High quality algorithmic fallback
            return [
                'id' => 'ai_custom_' . substr(bin2hex(random_bytes(4)), 0, 8),
                'title' => "Macro Strategic Stress Scenario: " . substr($promptText, 0, 60),
                'description' => "Empirical stress testing custom shock conditions across the {$industrySlug} sector: {$promptText}",
                'core_dilemma' => "How should executive leadership navigate simultaneous cost-push input shocks and constrained capital access?",
                'default_params' => ['mpr' => 27.5, 'inflation' => 33.0, 'fx_rate' => 1700, 'fuel_price' => 1100, 'crr' => 45.0, 'spend_impulse' => 14],
                'model_used' => 'Strategic Scenario Engine',
            ];
        }

        $systemPrompt = "You are an elite Macroeconomist and Corporate Strategy Professor specializing in emerging markets and Nigerian macro-finance.
Your task is to take a user's prompt and convert it into a structured business dilemma and macroeconomic stress scenario for the industry: '{$industrySlug}'.
Respond with strictly valid JSON matching this schema:
{
  \"title\": \"Short compelling scenario headline (max 80 chars)\",
  \"description\": \"In-depth context of the economic shock (2-3 sentences)\",
  \"core_dilemma\": \"The strategic dilemma question facing the CEO/CFO\",
  \"recommended_params\": {
    \"mpr\": 26.5,
    \"inflation\": 31.0,
    \"fx_rate\": 1650,
    \"fuel_price\": 1050,
    \"crr\": 45.0,
    \"spend_impulse\": 12
  }
}
Keep numbers realistic for emerging markets / Nigeria.";

        $postData = [
            'model' => $activeModel,
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => "Generate a rigorous scenario for industry '{$industrySlug}' based on: " . $promptText],
            ],
            'temperature' => 0.2,
            'max_tokens' => 800,
        ];

        try {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => json_encode($postData),
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $apiKey,
                ],
                CURLOPT_TIMEOUT => 25,
            ]);

            $response = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($code === 200 && $response) {
                $decoded = json_decode($response, true);
                $content = $decoded['choices'][0]['message']['content'] ?? '';
                $clean = preg_replace('/```json\s*|\s*```/', '', trim($content));
                $parsed = json_decode((string)$clean, true);

                if ($parsed && isset($parsed['title'])) {
                    return [
                        'id' => 'ai_custom_' . substr(bin2hex(random_bytes(4)), 0, 8),
                        'title' => (string)$parsed['title'],
                        'description' => (string)$parsed['description'],
                        'core_dilemma' => (string)$parsed['core_dilemma'],
                        'default_params' => $parsed['recommended_params'] ?? ['mpr' => 26.0, 'inflation' => 30.0, 'fx_rate' => 1600, 'fuel_price' => 1000, 'crr' => 45.0, 'spend_impulse' => 12],
                        'model_used' => 'Strategic Scenario Engine',
                    ];
                }
            }
        } catch (Throwable $e) {}

        return [
            'id' => 'ai_custom_' . substr(bin2hex(random_bytes(4)), 0, 8),
            'title' => "Empirical Stress Shock: " . substr($promptText, 0, 50),
            'description' => "Detailed macroeconomic simulation testing resilience against: {$promptText}",
            'core_dilemma' => "How should corporate treasurers structure risk hedging when input volatility surges?",
            'default_params' => ['mpr' => 27.0, 'inflation' => 32.0, 'fx_rate' => 1680, 'fuel_price' => 1100, 'crr' => 45.0, 'spend_impulse' => 14],
            'model_used' => 'Strategic Scenario Engine',
        ];
    }

    /**
     * Run full AI Masterclass Policy Adjudication Memo via NVIDIA NIM.
     */
    public static function runAiBriefing(string $industrySlug, string $scenarioTitle, array $params, array $results): array
    {
        $activeModel = FeatureService::getActiveAiModel();
        $apiKey = (string)Env::get('NVIDIA_NIM_API_KEY', '');
        $url = (string)Env::get('NVIDIA_NIM_BASE_URL', 'https://integrate.api.nvidia.com/v1') . '/chat/completions';

        $summary = "Scenario: {$scenarioTitle} | Industry: {$industrySlug}\n" .
                   "Inputs: MPR={$params['mpr']}%, Inflation={$params['inflation']}%, FX Rate=₦{$params['fx_rate']}/$, Fuel=₦{$params['fuel_price']}/L, CRR={$params['crr']}%, Fiscal Impulse={$params['spend_impulse']}%\n" .
                   "Modeled Results: Projected Inflation={$results['projected_inflation']}%, Credit Impulse={$results['credit_impulse']}/100, CapEx Index={$results['investment_index']}/100, Purchasing Power={$results['purchasing_power']}/100, Debt Service Burden={$results['debt_service_burden']}%, Industry Margin Stress={$results['margin_stress']}%, FX Pressure={$results['fx_pressure']}";

        $systemPrompt = "You are the Senior Financial Economist and Dean of Financial Intelligence at Developing Market (EconSim).
Produce a masterclass executive macroeconomic assessment briefing on this scenario simulation.
NEVER truncate or give superficial advice. Structure into these 5 exact sections:
### 1. First Principles & Macroeconomic Equilibrium
### 2. Transmission Channels & Cross-Sector Contagion ({$industrySlug})
### 3. Quantitative Formulation & Balance Sheet Stress Analysis
### 4. Executive Decision Matrix & Strategic Hedging Actions
### 5. Benchmark Citations & Regulatory References (CBN, NBS, DMO, NAFEM)";

        $postData = [
            'model' => $activeModel,
            'messages' => [
                ['role' => 'system', 'content' => $systemPrompt],
                ['role' => 'user', 'content' => "Provide the executive briefing for:\n" . $summary],
            ],
            'temperature' => 0.15,
            'max_tokens' => 2048,
        ];

        try {
            if (!empty($apiKey)) {
                $ch = curl_init($url);
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_POST => true,
                    CURLOPT_POSTFIELDS => json_encode($postData),
                    CURLOPT_HTTPHEADER => [
                        'Content-Type: application/json',
                        'Authorization: Bearer ' . $apiKey,
                    ],
                    CURLOPT_TIMEOUT => 30,
                ]);

                $response = curl_exec($ch);
                $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);

                if ($code === 200 && $response) {
                    $decoded = json_decode($response, true);
                    $text = $decoded['choices'][0]['message']['content'] ?? '';
                    if (!empty($text)) {
                        return [
                            'briefing_text' => $text,
                            'briefing' => $text,
                            'model' => 'Executive Intelligence Desk',
                            'model_used' => 'Executive Intelligence Desk',
                            'scenario' => $scenarioTitle,
                        ];
                    }
                }
            }
        } catch (Throwable $e) {}

        // High quality empirical briefing fallback
        $fallback = "### 1. First Principles & Macroeconomic Equilibrium\n" .
                    "Under current modeled parameters (MPR at {$params['mpr']}%, FX at ₦{$params['fx_rate']}/$), the economy experiences acute cost-push inflationary pressure intersecting with aggressive central bank liquidity sterilization. When the Monetary Policy Rate reaches {$params['mpr']}%, prime lending rates elevate to " . ($params['mpr'] + 7) . "%, raising hurdle rates for commercial investment and suppressing broad demand.\n\n" .
                    "### 2. Transmission Channels & Cross-Sector Contagion ({$industrySlug})\n" .
                    "The primary transmission channel operates through the **Cost of Capital & Energy Logistics nexus**. With fuel prices at ₦{$params['fuel_price']}/Litre and cash reserve requirements at {$params['crr']}%, commercial bank loanable funds are sterilized at the central bank. Real sector operators in {$industrySlug} face simultaneous margin compression and debt-servicing friction.\n\n" .
                    "### 3. Quantitative Formulation & Balance Sheet Stress Analysis\n" .
                    "• **Projected Inflation**: Modeled at **{$results['projected_inflation']}%** reflecting currency pass-through elasticity.\n" .
                    "• **Credit Impulse**: Reduced to **{$results['credit_impulse']}/100** indicating commercial bank risk-off positioning.\n" .
                    "• **Operating Margin Sensitivity**: Modeled at **{$results['margin_stress']}%**, necessitating immediate price-elasticity adjustments.\n\n" .
                    "### 4. Executive Decision Matrix & Strategic Hedging Actions\n" .
                    "1. **Treasury Management**: Pay down floating-rate commercial bank debt; transition short-term liabilities to fixed-rate commercial paper.\n" .
                    "2. **Working Capital**: Reduce Days Sales Outstanding (DSO) and enforce upfront settlement terms with distribution channels.\n" .
                    "3. **Alternative Energy**: Accelerate investments in distributed solar-gas microgrids to decouple from volatile diesel pump costs.\n\n" .
                    "### 5. Benchmark Citations & Regulatory References\n" .
                    "• **Central Bank of Nigeria (CBN)**: Monetary Policy Committee Communique & Monetary Stability Corridor.\n" .
                    "• **National Bureau of Statistics (NBS)**: CPI & Inflation Headline Bulletins.\n" .
                    "• **Debt Management Office (DMO)**: Sovereign Debt Sustainability Matrix.";

        return [
            'briefing_text' => $fallback,
            'briefing' => $fallback,
            'model' => 'Executive Intelligence Desk',
            'model_used' => 'Executive Intelligence Desk',
            'scenario' => $scenarioTitle,
        ];
    }
}
