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
    // --- Public Companies & Supply Chain Catalysts (NGX & African Bourses) ---
    [
        'ind' => 'fmcg',
        'title' => 'Will Nestle Nigeria (NESTLE) achieve positive full-year operating profit following local grain & packaging substitution above 70%?',
        'slug' => 'nestle-nigeria-operating-profit-recovery',
        'def' => 'Resolves YES if audited full-year financial statements of Nestle Nigeria Plc published on the NGX confirm positive operating profit (EBIT) exceeding ₦30 Billion.',
        'src' => 'Nigerian Exchange Group (NGX) Audited Financial Disclosures (ngxgroup.com)',
        'prob' => 55,
        'days' => 120,
        'metrics' => [
            ['Local Sourcing Ratio (Sorghum, Maize, Starch)', 'Reducing dollar import bill for intermediate confectionery and cereal grains.'],
            ['Packaging Glass & Aluminum Supply Chain Lead Times', 'Domestic supplier contracts versus imported packaging materials.'],
            ['Unhedged Parent Intercompany USD Debt', 'Mitigating foreign exchange net financing charges on the balance sheet.'],
            ['Price Elasticity Across Nutrition & Food Staples', 'Consumer retention rates following product repackaging and resizing.'],
        ],
    ],
    [
        'ind' => 'telecoms',
        'title' => 'Will MTN Nigeria (MTNN) restore positive shareholder equity within 4 reporting quarters following tower lease renegotiations?',
        'slug' => 'mtn-nigeria-equity-restoration',
        'def' => 'Resolves YES if quarterly financial statements filed by MTN Nigeria Communications Plc on the NGX confirm positive total equity attributable to shareholders.',
        'src' => 'NGX Company Announcements & MTN Group Financial Reports',
        'prob' => 62,
        'days' => 90,
        'metrics' => [
            ['Tower Company Contract Indexation (IHS & ATC)', 'Transition from dollar-indexed lease contracts to local currency pricing structures.'],
            ['NCC Tariff Review Approvals for Voice and Data', 'Regulatory permission for telecom operators to adjust consumer tariffs for inflation.'],
            ['Base Station Diesel Fuel Operating Cost', 'Solar hybrid battery retrofits reducing generator fuel costs across 20,000+ cell sites.'],
            ['Fintech Mobile Money (MoMo PSB) Revenue Growth', 'Expanding high-margin digital payment and merchant merchant fee transactions.'],
        ],
    ],
    [
        'ind' => 'manufacturing',
        'title' => 'Will Dangote Cement (DANGCEM) achieve quarterly sales volume exceeding 7.5 Million Metric Tons despite interstate haulage costs and gas pipeline downtime?',
        'slug' => 'dangote-cement-7m-volume-sales',
        'def' => 'Resolves YES if Dangote Cement Plc quarterly earnings report confirms combined Pan-African and Nigerian cement & clinker sales volume exceeding 7.50 million metric tons.',
        'src' => 'Dangote Cement Plc Published Financial Disclosures & NGX Filings',
        'prob' => 58,
        'days' => 75,
        'metrics' => [
            ['Captive Gas Pipeline Availability & Pressure', 'Mitigating expensive low-pour fuel oil (LPFO) and coal substitution in cement kilns.'],
            ['Dual-Fuel CNG Haulage Fleet Conversion Rate', 'Lowering distribution logistics and diesel expenses across 10,000+ delivery trucks.'],
            ['Export Terminal Clinker Shipments from Apapa & Onne', 'Seaborne export volumes to West African coastal countries generating hard currency.'],
            ['Public Infrastructure Budget Spending & Concrete Paving', 'Federal Ministry of Works concrete road construction contracts.'],
        ],
    ],
    [
        'ind' => 'capital-markets',
        'title' => 'Will at least 4 of Nigeria\'s Tier-1 international banking groups (FUGAZ) complete their CBN ₦500 Billion minimum recapitalization before the regulatory deadline?',
        'slug' => 'tier1-banks-recapitalization-500b',
        'def' => 'Resolves YES if CBN banking supervision updates confirm at least 4 of the 5 Tier-1 international banking groups (Access, FBNH, GTCO, UBA, Zenith) have achieved the required ₦500 Billion paid-up capital and share premium.',
        'src' => 'Central Bank of Nigeria (CBN) Banking Supervision Department & NGX Corporate Actions',
        'prob' => 82,
        'days' => 150,
        'metrics' => [
            ['Rights Issues & Public Offer Subscription Rates', 'Domestic retail and institutional absorption of equity offerings on the NGX.'],
            ['Foreign Institutional Placement Allocation', 'Offshore investor participation and international bookbuilding demand.'],
            ['Cross-Listing Receipts (London LSE & Johannesburg JSE)', 'Depositary receipt issuances supporting global capital raises.'],
            ['Private Sector Loan Rationing vs High-Yield Treasury Bills', 'Banks deploying capital into risk-free government securities over risky corporate loans.'],
        ],
    ],
    [
        'ind' => 'agriculture',
        'title' => 'Will Presco Plc (PRESCO) declare an annual gross revenue exceeding ₦130 Billion driven by domestic crude palm oil deficits and port import tariffs?',
        'slug' => 'presco-cpo-revenue-130b',
        'def' => 'Resolves YES if audited annual reports of Presco Plc published on the NGX confirm gross revenue equal to or exceeding ₦130,000,000,000.',
        'src' => 'NGX Annual Financial Disclosures & Presco Investor Relations',
        'prob' => 68,
        'days' => 110,
        'metrics' => [
            ['Crude Palm Oil (CPO) Farmgate Realized Price', 'Domestic pricing commanding a premium over global Bursa Malaysia benchmarks.'],
            ['Fresh Fruit Bunches (FFB) Plantation Yields', 'Oil extraction rate (OER) efficiency across Edo and Delta state processing estates.'],
            ['Port Customs Clearing Tariffs on Competing Edible Oils', 'Tariff protections and FX restrictions on vegetable oil and olein imports.'],
            ['Food Processing Industrial Off-Take Demand', 'Industrial buying contracts from FMCG soap, biscuit, and instant noodle manufacturers.'],
        ],
    ],
    [
        'ind' => 'energy',
        'title' => 'Will Seplat Energy (SEPLAT) average working interest crude and gas production above 65,000 boepd following the Mobil Producing asset integration?',
        'slug' => 'seplat-energy-production-65k-boepd',
        'def' => 'Resolves YES if official operations updates of Seplat Energy Plc published on the NGX and London Stock Exchange (LSE) confirm average net working interest production exceeding 65,000 boepd.',
        'src' => 'Seplat Energy Operations Reports & Nigerian Upstream Petroleum Regulatory Commission (NUPRC)',
        'prob' => 74,
        'days' => 85,
        'metrics' => [
            ['Trans-Niger Pipeline (TNP) & Amukpe-Escravos Pipeline Uptime', 'Alternative crude evacuation routes avoiding vandalism and barge theft.'],
            ['Commercial Gas Offtake by National Grid Power Plants', 'Sapele and ANOH gas processing facilities feeding domestic commercial power producers.'],
            ['Crude Oil Theft Mitigation in Niger Delta Corridors', 'Joint Task Force surveillance and automated pressure monitoring along trunk lines.'],
            ['NUPRC Regulatory Clearance Approvals', 'Ministerial consent and operational integration for offshore shallow-water joint ventures.'],
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

