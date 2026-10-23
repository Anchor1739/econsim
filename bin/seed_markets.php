<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/vendor/autoload.php';

use App\Config\Database;
use App\Config\Env;
use App\Utils\Security;

Env::load();

echo "========================================================\n";
echo " EconSim Market & Industry Expander\n";
echo "========================================================\n";

$pdo = Database::getConnection();

$industries = [
    ['monetary-policy', 'Monetary Policy & CBN'],
    ['capital-markets', 'Equities & Capital Markets'],
    ['fx-reserves', 'FX & External Reserves'],
    ['fintech', 'Fintech & Digital Payments'],
    ['energy', 'Oil, Gas & Energy'],
    ['agriculture', 'Agriculture & Food Security'],
    ['manufacturing', 'Manufacturing & Industry'],
    ['fmcg', 'FMCG & Retail'],
    ['real-estate', 'Real Estate & Infrastructure'],
    ['telecoms', 'Telecoms & Tech Infrastructure'],
    ['healthcare', 'Healthcare & Pharma'],
];

echo "1. Ensuring all 11 core industries exist in Aiven MySQL...\n";
foreach ($industries as [$slug, $name]) {
    $stmt = $pdo->prepare("INSERT IGNORE INTO industries (slug, name) VALUES (?, ?)");
    $stmt->execute([$slug, $name]);
}
echo "✓ Industries verified.\n";

$catalysts = [
    [
        'ind' => 'monetary-policy',
        'title' => 'Will the Central Bank of Nigeria raise the MPR by at least 50 bps at the upcoming MPC meeting?',
        'slug' => 'cbn-mpr-hike-50bps',
        'def' => 'Resolves YES if the published CBN Monetary Policy Committee communiqué officially raises the Monetary Policy Rate (MPR) by 50 basis points or higher above the preceding benchmark.',
        'src' => 'Central Bank of Nigeria (CBN) Official MPC Communiqué (cbn.gov.ng)',
        'prob' => 64,
        'days' => 45,
        'metrics' => [
            ['Headline vs Core CPI Spread', 'Measures food and energy volatility relative to structural underlying inflation.'],
            ['Currency Stabilization Pressure', 'Naira exchange rate volatility increases pressure for restrictive policy.'],
            ['Banking System Liquidity', 'CRR debits and interbank lending rates reflect actual policy transmission.'],
            ['Real Interest Rate Gap', 'Targeting positive real yields to attract Foreign Portfolio Investment (FPI).'],
        ],
    ],
    [
        'ind' => 'fx-reserves',
        'title' => 'Will Nigeria\'s official gross foreign exchange reserves exceed $40 Billion before year-end 2026?',
        'slug' => 'nigeria-fx-reserves-40b',
        'def' => 'Resolves YES if the CBN official 30-day moving average gross external reserves data published on the CBN website reaches or exceeds USD 40,000,000,000 on or before December 31, 2026.',
        'src' => 'CBN Official External Reserves Daily Statistics',
        'prob' => 58,
        'days' => 70,
        'metrics' => [
            ['Crude Oil Output & Lifting', 'NNPC joint venture production, condensate output, and prompt dollar repatriation.'],
            ['Diaspora Remittance Inflows', 'Growth of formal autonomous remittances through IMTO corridors.'],
            ['Eurobond & Multilateral Inflows', 'Disbursements from World Bank, AfDB, and commercial debt offerings.'],
            ['CBN FX Market Interventions', 'Net sales versus net purchases in the Nigerian Autonomous Foreign Exchange Market (NAFEM).'],
        ],
    ],
    [
        'ind' => 'capital-markets',
        'title' => 'Will the NGX All-Share Index (ASI) cross the 120,000-point milestone before Q1 2027?',
        'slug' => 'ngx-asi-120k-milestone',
        'def' => 'Resolves YES if the official Nigerian Exchange All-Share Index (NGX ASI) closes at or above 120,000.00 points on any regular trading day before March 31, 2027.',
        'src' => 'Nigerian Exchange Group (NGX) Daily Official Market Summary (ngxgroup.com)',
        'prob' => 52,
        'days' => 90,
        'metrics' => [
            ['Corporate Earnings Growth', 'Financial performance of Tier-1 banks, telcos, and industrial heavyweights.'],
            ['Domestic Institutional Liquidity', 'Pension Fund Administrators (PFA) asset allocation towards equity securities.'],
            ['Foreign Portfolio Participation', 'Offshore investor sentiment and FX repatriation liquidity.'],
            ['Yield Curve Dynamics', 'Treasury bill yields competing with stock market dividend yields.'],
        ],
    ],
    [
        'ind' => 'fintech',
        'title' => 'Will Nigeria\'s NIBSS instant payment transaction volume expand by over 30% year-on-year?',
        'slug' => 'nibss-instant-payments-growth',
        'def' => 'Resolves YES if the annual electronic payment data published by the Nigeria Inter-Bank Settlement System (NIBSS) shows total NIP volume growth equal to or exceeding 30.0% compared to the prior year.',
        'src' => 'NIBSS Official Electronic Payments Statistical Factsheet',
        'prob' => 71,
        'days' => 60,
        'metrics' => [
            ['Agency Banking Distribution', 'Expansion of POS agent networks in peri-urban and rural trade hubs.'],
            ['Mobile App & USSD Penetration', 'Smartphone adoption and transaction uptime among digital banks.'],
            ['Payment Service Banks (PSB)', 'Telco-led mobile money adoption and cross-border wallet interoperability.'],
            ['Cash Circulation Ratios', 'Currency outside banks versus total money supply (M3).'],
        ],
    ],
    [
        'ind' => 'energy',
        'title' => 'Will Dangote Petroleum Refinery achieve sustained export volume of refined diesel to West African ports?',
        'slug' => 'dangote-refinery-regional-exports',
        'def' => 'Resolves YES if official maritime tracking and customs shipment disclosures confirm at least 500,000 metric tons of refined Euro-V diesel exported across ECOWAS destinations in a single quarter.',
        'src' => 'Nigerian Midstream and Downstream Petroleum Regulatory Authority (NMDPRA)',
        'prob' => 65,
        'days' => 80,
        'metrics' => [
            ['Domestic Crude Supply Agreements', 'Naira-for-crude supply framework execution with NNPC Limited.'],
            ['Secondary Refining Unit Efficiency', 'RFCC and hydrocracker operating throughput rates.'],
            ['Regional Port Logistics', 'Coastal charter vessel availability and maritime off-taking terms in Ghana, Togo, and Benin.'],
            ['Arbitrage Spreads', 'Import parity pricing comparisons versus European and Asian refined product imports.'],
        ],
    ],
    [
        'ind' => 'manufacturing',
        'title' => 'Will local manufacturing capacity utilization improve above 60% according to the MAN survey?',
        'slug' => 'manufacturers-association-utilization-60',
        'def' => 'Resolves YES if the bi-annual Economic Review of the Manufacturers Association of Nigeria (MAN) records average industrial capacity utilization equal to or higher than 60.0%.',
        'src' => 'Manufacturers Association of Nigeria (MAN) Executive Economic Review',
        'prob' => 45,
        'days' => 100,
        'metrics' => [
            ['Industrial Power Reliability', 'Band-A electricity tariff impacts and captive gas power plant operations.'],
            ['Local Raw Material Sourcing', 'Backward integration programs in agro-allied, packaging, and chemical inputs.'],
            ['Import Port Clearance Times', 'Customs modernization and port corridor demurrage costs in Apapa and Lekki.'],
            ['Financing Costs', 'Prime lending rates and Bank of Industry (BOI) single-digit concessionary facilities.'],
        ],
    ],
    [
        'ind' => 'telecoms',
        'title' => 'Will 5G network coverage reach at least 25% of urban population centres in Nigeria?',
        'slug' => 'telecom-5g-coverage-25pct',
        'def' => 'Resolves YES if official Nigerian Communications Commission (NCC) broadband performance data verifies 5G active coverage spanning at least 25% of state capitals and tier-1 commercial cities.',
        'src' => 'Nigerian Communications Commission (NCC) Broadband Monitoring Portal',
        'prob' => 48,
        'days' => 120,
        'metrics' => [
            ['Fiber-to-the-Tower Deployments', 'Metropolitan fiber optic buildout and right-of-way (RoW) harmonization.'],
            ['Capex Investment in 3.5GHz Base Stations', 'Foreign exchange allocation for radio access network equipment.'],
            ['5G Smartphone Affordability', 'Availability of sub-$100 5G smartphones in consumer electronics retail.'],
            ['Enterprise Use Cases', 'Private 5G networks in fintech data centers, manufacturing hubs, and deep seaport logistics.'],
        ],
    ],
];

echo "2. Populating new economic contracts in Aiven MySQL...\n";
$added = 0;
foreach ($catalysts as $cat) {
    // Check if exists
    $ch = $pdo->prepare("SELECT id FROM market_events WHERE slug = ?");
    $ch->execute([$cat['slug']]);
    if ($ch->fetch()) {
        continue;
    }

    $iStmt = $pdo->prepare("SELECT id FROM industries WHERE slug = ? LIMIT 1");
    $iStmt->execute([$cat['ind']]);
    $indId = $iStmt->fetchColumn() ?: 1;

    $eventId = Security::uuid();
    $closesAt = date('Y-m-d H:i:s', strtotime("+{$cat['days']} days"));
    $resolvesAt = date('Y-m-d H:i:s', strtotime("+{$cat['days']} days +1 day"));

    $ins = $pdo->prepare(
        "INSERT INTO market_events (id, slug, industry_id, title, outcome_definition, resolution_source, resolves_at, closes_at, state, created_at)
         VALUES (:id, :slug, :ind, :title, :def, :src, :res, :cls, 'open', NOW(3))"
    );
    $ins->execute([
        ':id' => $eventId,
        ':slug' => $cat['slug'],
        ':ind' => $indId,
        ':title' => $cat['title'],
        ':def' => $cat['def'],
        ':src' => $cat['src'],
        ':res' => $resolvesAt,
        ':cls' => $closesAt,
    ]);

    // Study context
    $contextId = Security::uuid();
    $insC = $pdo->prepare(
        "INSERT INTO study_context_versions (id, event_id, version, summary, metrics, historical_cases, ai_generated, published_at)
         VALUES (:id, :eid, 1, :sum, :met, :hist, 1, NOW(3))"
    );
    $insC->execute([
        ':id' => $contextId,
        ':eid' => $eventId,
        ':sum' => "Research briefing for {$cat['title']}.",
        ':met' => json_encode($cat['metrics']),
        ':hist' => json_encode([['period' => 'Recent Historical Cycle', 'action' => 'Structural macro shifts and policy responses.']]),
    ]);

    $added++;
    echo "  ✓ Added: {$cat['title']}\n";
}

echo "✓ Successfully added {$added} fresh macroeconomic contracts.\n";
echo "========================================================\n";

