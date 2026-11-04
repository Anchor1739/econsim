<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/vendor/autoload.php';

use App\Config\Database;
use App\Config\Env;
use App\Utils\Security;

Env::load();

echo "========================================================\n";
echo " EconSim - Sharp Single-Dilemma Boardroom Scenarios Seed\n";
echo "========================================================\n";

$scenarios = [
    // 1. FINTECH - 72-Hour Runway Defense
    [
        'slug' => 'fintech',
        'title' => 'Fintech Runway Crisis: Immediate 72-Hour Liquidity Action',
        'body' => "You are the CFO of an established Nigerian fintech. Monthly gross revenue is ₦24m, operating costs are ₦31m (monthly net cash burn of ₦7m), and liquid cash reserves stand at ₦42m (6 months runway). Your lead Series-B investor has just announced a 90-day delay in their ₦400m funding disbursement due to offshore LP capital call delays.\n\nExecutive Directive:\nWhat 2 immediate operational actions will you execute within the next 72 hours to extend your cash runway without disrupting customer payment processing and cloud security infrastructure?",
        'reference' => ['company' => 'Emerging Payments Ltd', 'precedent' => 'Late 2022 fintech funding slowdown where prompt OpEx renegotiations protected core product reliability.'],
        'difficulty' => 'intermediate',
    ],
    // 2. FINTECH - Key Merchant Retention
    [
        'slug' => 'fintech',
        'title' => 'Enterprise Merchant Renegotiation: 40% Fee Discount Demand',
        'body' => "Your largest corporate retail merchant, representing 25% of your total payment volume and ₦6m of monthly revenue, demands an immediate 40% transaction fee cut. They threaten to switch entirely to an aggressive offshore aggregator by month-end if you refuse.\n\nExecutive Directive:\nDo you grant the fee cut, counter-offer with volume tiers and value-added software tools, or let them churn? Provide your quantitative margin rationale and client retention structure.",
        'reference' => ['company' => 'MerchantPay Nigeria', 'precedent' => 'Fintech pricing wars on card acquiring vs software lock-in margins.'],
        'difficulty' => 'intermediate',
    ],
    // 3. FINTECH - Bridge Capital Structuring
    [
        'slug' => 'fintech',
        'title' => 'Bridge Financing Dilemma: Venture Debt vs Insider SAFE Note',
        'body' => "Your fintech has 60 days of cash left. You receive two competing term sheets for ₦50m bridge funding: \nOption A: Venture debt facility at 32% annual interest with 5% warrant coverage payable in 12 months.\nOption B: Insider SAFE note from existing angel investors at a 25% valuation cap discount.\n\nExecutive Directive:\nWhich financing structure do you recommend to the Board of Directors, and what specific risk trigger determines your choice?",
        'reference' => ['company' => 'PaySwitch Africa', 'precedent' => 'Bridge round governance tradeoffs in restrictive monetary environments.'],
        'difficulty' => 'advanced',
    ],
    // 4. AGRICULTURE - Fuel Subsidy Transport Shock
    [
        'slug' => 'agriculture',
        'title' => 'Agro-Logistics Shock: 38% Transport Spike & Cash Conversion',
        'body' => "You are the Chief Operating Officer of a grain distribution enterprise. Commercial diesel and interstate haulage tariffs surged 38% overnight, driving post-harvest spoilage to 12% and expanding your cash conversion cycle from 32 to 51 days. Liquid reserves cover only 5 weeks of outflows.\n\nExecutive Directive:\nState the 2 exact operational levers you will pull to accelerate cash collection from retail buyers and restructure regional distribution hubs within 30 days.",
        'reference' => ['company' => 'Savannah Grains Network', 'precedent' => '2023-2024 transport tariff spikes following fuel subsidy deregulation in Nigeria.'],
        'difficulty' => 'intermediate',
    ],
    // 5. AGRICULTURE - Extended Buyer Payment Terms
    [
        'slug' => 'agriculture',
        'title' => 'Wholesale Off-Taker Liquidity Delay: 30 to 60 Days Payables Stretch',
        'body' => "Three major supermarket chains that buy 60% of your packaged food products unilaterally stretched their payment cycle from 30 days to 60 days, leaving your agro-processing firm with a ₦35m working capital deficit to pay local farmers upon harvest delivery.\n\nExecutive Directive:\nDo you take a 26% warehouse receipt discounting loan, suspend shipments to delinquent supermarkets, or enforce cash-on-delivery discounts? Justify your decision.",
        'reference' => ['company' => 'Northern Food Processors', 'precedent' => 'Invoice factoring vs farmer vendor retention in Nigerian food supply chains.'],
        'difficulty' => 'intermediate',
    ],
    // 6. FMCG - Port Demurrage & FX Allocation Crunch
    [
        'slug' => 'fmcg',
        'title' => 'Apapa Port Demurrage Crisis: FX Bottleneck & Raw Material Hold',
        'body' => "Four container loads of essential packaging resin are detained at Apapa Port, accumulating $1,200 per day in demurrage and shipping penalties. The central bank foreign exchange allocation window has delayed your $85,000 import letter of credit for 3 weeks.\n\nExecutive Directive:\nDo you procure parallel market FX at a 15% price premium to clear the port immediately, or halt manufacturing lines and source lower-grade domestic substitutes? Outline your trade-off analysis.",
        'reference' => ['company' => 'Sunlight Consumer Goods', 'precedent' => 'Lagos port congestion and FX liquidity crunches impacting listed FMCG margins.'],
        'difficulty' => 'advanced',
    ],
    // 7. FMCG - Inflationary Price Pass-Through vs Volume Drop
    [
        'slug' => 'fmcg',
        'title' => 'Retail Price Pass-Through: 32% Input Surge vs 28% Volume Drop',
        'body' => "Your packaged goods company faces a 32% surge in raw ingredient costs. Historical market data shows that raising shelf prices by 30% will trigger an immediate 28% drop in retail unit sales to informal, unbranded street substitutes.\n\nExecutive Directive:\nPresent your packaging and pricing strategy (e.g. shrinkflation, economy sachets, or selective margin absorption) to preserve cash contribution without destroying brand market share.",
        'reference' => ['company' => 'Prime Foods PLC', 'precedent' => 'Sachetization and pack redesign by major NGX consumer goods manufacturers.'],
        'difficulty' => 'beginner',
    ],
    // 8. MANUFACTURING - Band-A Power Tariff Hike
    [
        'slug' => 'manufacturing',
        'title' => 'Band-A Industrial Electricity Hike: 240% Tariff Surge Response',
        'body' => "Your steel and plastics fabrication plant was reclassified into DisCo Band-A, increasing your monthly electricity bill from ₦18m to ₦61m (a 240% surge). At current selling prices, your plant operates at an EBITDA loss of -8%.\n\nExecutive Directive:\nDo you shut down day operations to run exclusively on off-peak night shifts, invest ₦80m in a captive gas generator facility, or renegotiate contracts with industrial buyers? Provide your strategic decision.",
        'reference' => ['company' => 'Apex Industrial Fabrication', 'precedent' => 'April 2024 electricity tariff restructuring by NERC for Band-A commercial feeders.'],
        'difficulty' => 'intermediate',
    ],
    // 9. MANUFACTURING - Inter-State Haulage Tolls & Regional Warehousing
    [
        'slug' => 'manufacturing',
        'title' => 'Supply Chain Redesign: Inter-State Road Levies & Buffer Depots',
        'body' => "Multiple state transport revenue task forces and rising transit haulage fees have increased distribution costs between your Lagos manufacturing hub and Kano distribution center by 45%. Transit times have stretched from 3 days to 7 days due to road delays.\n\nExecutive Directive:\nFormulate an executive memo detailing whether to establish a regional buffer assembly plant in Abuja or outsource last-mile logistics to third-party freight consolidators.",
        'reference' => ['company' => 'West Africa Polymers', 'precedent' => 'Regional warehousing strategies by Nigerian manufacturers avoiding transit chokepoints.'],
        'difficulty' => 'intermediate',
    ],
    // 10. ENERGY - Upstream Gas Feed Pipeline Outage
    [
        'slug' => 'energy',
        'title' => 'Gas Pipeline Outage: Force Majeure vs Expensive LPFO Fuel Switch',
        'body' => "Upstream pipeline vandalism has cut natural gas supply to your 40MW industrial power turbine by 65%. You can switch to backup Low Pour Fuel Oil (LPFO) at 3.2x the cost per kilowatt-hour, or declare operational force majeure on your commercial off-take agreements.\n\nExecutive Directive:\nState your executive choice between absorbing the ₦45m monthly LPFO cost premium or declaring force majeure, detailing your contractual liability mitigation plan.",
        'reference' => ['company' => 'Niger Delta Power & Industrial', 'precedent' => 'Gas transmission disruptions on the Escravos-Lagos Pipeline System (ELPS).'],
        'difficulty' => 'advanced',
    ],
    // 11. ENERGY - Fuel Depot Price Volatility Hedge
    [
        'slug' => 'energy',
        'title' => 'Deregulated Fuel Inventory: Guarding Against Sudden Depot Reversals',
        'body' => "Your retail fuel downstream business operates 18 filling stations. Wholesale depot prices fluctuate by up to ₦60/litre weekly following deregulation. Purchasing 5 million litres of stock before a sudden price drop risks ₦150m in inventory paper losses.\n\nExecutive Directive:\nWhat inventory replenishment and pricing mechanism will you implement to insulate working capital while maintaining retail pump market share?",
        'reference' => ['company' => 'Apex Petroleum Distribution', 'precedent' => 'Downstream oil deregulation and inventory price swings following PMS subsidy removal.'],
        'difficulty' => 'intermediate',
    ],
    // 12. CAPITAL MARKETS - ₦500bn Bank Recapitalization Strategy
    [
        'slug' => 'capital-markets',
        'title' => 'Bank Recapitalization: Rights Issue Discount vs Foreign Dilution',
        'body' => "The Central Bank of Nigeria has set a ₦500 billion minimum capital threshold for international commercial banking licenses. Your bank has ₦280 billion in qualifying capital and 14 months remaining to raise ₦220 billion. Existing majority domestic shareholders strongly oppose foreign private equity dilution.\n\nExecutive Directive:\nDo you recommend a discounted rights issue to domestic shareholders, a public offer on the NGX, or an M&A merger with a tier-2 merchant bank? Defend your capital market thesis.",
        'reference' => ['company' => 'Continental Bank of Nigeria', 'precedent' => '2024-2026 CBN banking recapitalization exercise across Tier-1 and Tier-2 lenders.'],
        'difficulty' => 'advanced',
    ],
    // 13. CAPITAL MARKETS - Commercial Paper Maturity in Restrictive Policy
    [
        'slug' => 'capital-markets',
        'title' => 'Commercial Paper Rollover Shock: Interbank Rate Spike of 350 bps',
        'body' => "Your corporate treasury has ₦10 billion in 180-day commercial paper maturing in 14 days. The Monetary Policy Committee just hiked the MPR, pushing commercial paper discount rates from 18.5% to 22.0% (a 350 bps cost increase).\n\nExecutive Directive:\nDo you roll over the full ₦10bn commercial paper at the punitive 22% rate, draw down existing commercial bank overdraft lines at prime + 4%, or liquidate liquid treasury assets? Outline your debt servicing plan.",
        'reference' => ['company' => 'National Conglomerate Treasury', 'precedent' => 'Corporate debt issuances in elevated yield environments on the FMDQ exchange.'],
        'difficulty' => 'advanced',
    ],
    // 14. TELECOMS - USD-Denominated Tower Lease Depreciation
    [
        'slug' => 'telecoms',
        'title' => 'Telecom Tower Lease Shock: Dollar Indexing vs Naira Airtime Revenue',
        'body' => "Your mobile telecoms network generates 100% of revenue in Nigerian Naira, but 60% of cell tower master lease fees are dollar-indexed. Following currency depreciation, tower operating lease costs rose from 24% to 46% of total revenue, triggering heavy quarterly operating losses.\n\nExecutive Directive:\nHow will you negotiate lease re-denomination with tower companies, adjust consumer data tariffs, or decommission redundant co-located cell towers?",
        'reference' => ['company' => 'Broadband Wireless Nigeria', 'precedent' => 'Telecoms operating losses and renegotiated tower contracts following 2023-2024 FX float.'],
        'difficulty' => 'advanced',
    ],
    // 15. TELECOMS - Rural Cell Site Solar Microgrid CapEx
    [
        'slug' => 'telecoms',
        'title' => 'Off-Grid Cell Tower Power: ₦1.2bn Solar Transition vs Diesel Burn',
        'body' => "Diesel expenses to power 320 off-grid rural base stations reached ₦190m per month. You can deploy solar hybrid battery microgrids across all 320 sites for ₦1.2bn CapEx, cutting monthly fuel OPEX by 70%, but commercial bank borrowing rates stand at 28%.\n\nExecutive Directive:\nWhat financing vehicle (e.g. Energy-as-a-Service vendor lease, green bond, or Capex phased self-funding) do you present to the Board?",
        'reference' => ['company' => 'TowerTech Infrastructure', 'precedent' => 'ESCO and captive solar conversions for telecom infrastructure across West Africa.'],
        'difficulty' => 'intermediate',
    ],
    // 16. HEALTHCARE - Active Pharmaceutical Ingredient (API) Import Cost
    [
        'slug' => 'healthcare',
        'title' => 'Essential Drug Supply: 70% API Devaluation Spike & Hospital Receivables',
        'body' => "Imported active pharmaceutical ingredients (APIs) for essential antibiotics surged 70% due to FX movements. Government teaching hospitals, which account for 50% of your drug distribution volume, have unpaid invoices averaging 120 days overdue.\n\nExecutive Directive:\nDo you halt antibiotic deliveries to delinquent state hospitals, institute strict credit limits, or shift manufacturing capacity to private retail pharmacy chains? Outline your clinical ethics and cash flow plan.",
        'reference' => ['company' => 'Apex Pharmaceuticals', 'precedent' => 'Pharmaceutical pricing shocks and institutional receivables challenges in Nigeria.'],
        'difficulty' => 'intermediate',
    ],
    // 17. REAL ESTATE - Fixed-Price Off-Plan Contract Overrun
    [
        'slug' => 'real-estate',
        'title' => 'Commercial Construction Overrun: 55% Material Inflation on Pre-Sold Units',
        'body' => "Your property development company pre-sold 40 residential apartments off-plan at fixed contractual prices. Due to currency depreciation and cement/steel price inflation, remaining construction costs have surged 55%, leaving an estimated ₦380m project deficit to reach completion.\n\nExecutive Directive:\nDo you invoke hardship/escalation clauses to demand buyer surcharges, take expensive mezzanine construction debt, or downscale finishing specifications? Justify your choice.",
        'reference' => ['company' => 'Lekki Peninsula Properties', 'precedent' => 'Off-plan real estate developer defaults and contract renegotiations during inflation.'],
        'difficulty' => 'intermediate',
    ],
    // 18. MONETARY - Non-Oil Export Proceeds Repatriation Mandate
    [
        'slug' => 'monetary-policy',
        'title' => 'Export Dollar Repatriation Mandate: 90-Day Window & Penalties',
        'body' => "Your agribusiness export firm shipped $2.5m in processed cashew nuts to Europe. The Central Bank of Nigeria mandates 100% repatriation of export proceeds within 90 days, or blacklists your enterprise from domestic banking. However, your European buyer requests a 30-day payment extension due to customs clearance delays in Rotterdam.\n\nExecutive Directive:\nHow do you prevent CBN regulatory blacklisting while preserving the European trade relationship? Propose your trade finance and compliance solution.",
        'reference' => ['company' => 'AfriCommodities Export', 'precedent' => 'CBN non-oil export proceeds repatriation guidelines (RT200 / P-F-I regulatory window).'],
        'difficulty' => 'advanced',
    ],
];

try {
    $pdo = Database::getConnection();
    
    // Check if approved_by user exists, if not use null
    $adminId = $pdo->query("SELECT id FROM users LIMIT 1")->fetchColumn() ?: null;

    $stmt = $pdo->prepare("
        INSERT INTO boardroom_scenarios 
            (id, industry_id, title, confidential_body, reference_case, rubric, difficulty, approved_by, created_at)
        VALUES 
            (:id, :ind, :title, :body, :ref, :rubric, :diff, :adm, NOW(3))
        ON DUPLICATE KEY UPDATE
            title = VALUES(title),
            confidential_body = VALUES(confidential_body),
            reference_case = VALUES(reference_case),
            rubric = VALUES(rubric),
            difficulty = VALUES(difficulty)
    ");

    $count = 0;
    foreach ($scenarios as $s) {
        // Find industry ID
        $indStmt = $pdo->prepare("SELECT id FROM industries WHERE slug = ? LIMIT 1");
        $indStmt->execute([$s['slug']]);
        $indId = $indStmt->fetchColumn();

        if (!$indId) {
            // Pick fallback
            $indId = 1;
        }

        $id = Security::uuid();
        $stmt->execute([
            ':id' => $id,
            ':ind' => $indId,
            ':title' => $s['title'],
            ':body' => $s['body'],
            ':ref' => json_encode($s['reference']),
            ':rubric' => json_encode(['financial_mechanics' => 40, 'risk_management' => 30, 'historical_alignment' => 20, 'communication' => 10]),
            ':diff' => $s['difficulty'],
            ':adm' => $adminId,
        ]);
        $count++;
        echo " [+] Seeded sharp dilemma: [{$s['slug']}] {$s['title']}\n";
    }

    echo "\n[✓] Successfully populated {$count} sharp, single-issue boardroom scenarios!\n";
    exit(0);
} catch (\Throwable $e) {
    echo "[-] Error seeding scenarios: " . $e->getMessage() . "\n";
    exit(1);
}

