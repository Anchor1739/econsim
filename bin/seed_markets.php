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
    [
        'ind' => 'energy',
        'title' => 'Will Geregu Power (GEREGU) sustain over 700MW daily generation availability despite gas pipeline pressure curtailments and national grid trips?',
        'slug' => 'geregu-power-grid-generation',
        'def' => 'Resolves YES if Nigerian Electricity Regulatory Commission (NERC) quarterly reports confirm Geregu Power Plc sustained average daily operational capacity exceeding 700MW across 2 consecutive quarters.',
        'src' => 'Nigerian Electricity Regulatory Commission (NERC) & NGX Operational Updates',
        'prob' => 65,
        'days' => 90,
        'metrics' => [
            ['Gas Supply Delivery Pressure (ELPS)', 'Pipeline uptime along Escravos-Lagos Pipeline System feeding gas turbines.'],
            ['Band-A Cost-Reflective Tariff Recovery', 'DisCos collection efficiency remitting cash to bulk electricity trader (NBET).'],
            ['National Grid Blackout Frequency', 'Transmission Company of Nigeria (TCN) system collapses forcing island-mode shutdowns.'],
            ['Industrial Captive Power Off-Take', 'Direct power purchase agreements with manufacturing clusters bypassing distribution bottlenecks.'],
        ],
    ],
    [
        'ind' => 'fmcg',
        'title' => 'Will BUA Foods (BUAFOODS) maintain operating profit margin above 28% despite Apapa port raw sugar vessel demurrage and customs FX benchmark adjustments?',
        'slug' => 'bua-foods-port-demurrage-margin',
        'def' => 'Resolves YES if audited financial results published on the NGX confirm BUA Foods Plc operating profit margin (EBIT margin) equal to or exceeding 28.0%.',
        'src' => 'Nigerian Exchange Group (NGX) Company Results & Shippers Council Port Reports',
        'prob' => 72,
        'days' => 100,
        'metrics' => [
            ['Port Container & Vessel Dwell Time', 'Apapa and Tin Can Island berth clearance delays causing shipping demurrage fees.'],
            ['Customs Duty FX Benchmark', 'Exchange rate benchmark applied to bulk raw sugar and wheat import duties.'],
            ['Interstate Bulk Haulage Diesel Cost', 'Freight expense to transport flour and pasta to northern commercial hubs.'],
            ['Backward Integration Sugar Estates', 'Lafiagi Integrated Sugar Project yield replacing imported raw sugar.'],
        ],
    ],
    [
        'ind' => 'capital-markets',
        'title' => 'Will Zenith Bank (ZENITHBANK) conclude its capital raise exceeding ₦500 Billion while keeping Capital Adequacy Ratio (CAR) above 20%?',
        'slug' => 'zenith-bank-500b-recapitalization',
        'def' => 'Resolves YES if CBN banking supervision approvals verify Zenith Bank Plc paid-up capital exceeds ₦500 Billion with audited regulatory Capital Adequacy Ratio (CAR) at or above 20.0%.',
        'src' => 'Central Bank of Nigeria (CBN) Banking Supervision & NGX Filings',
        'prob' => 84,
        'days' => 130,
        'metrics' => [
            ['Rights Issue & Public Offer Uptake', 'Subscription volume by Nigerian institutional PFAs and international funds.'],
            ['Cash Reserve Ratio (CRR) Sterilization', 'Impact of CBN mandatory cash debits on interest-earning liquid assets.'],
            ['Net Interest Margin (NIM) Compression', 'Rising deposit acquisition costs competing with 1-year Treasury bills.'],
            ['Non-Performing Loan (NPL) Ratio', 'Asset quality preservation amidst high corporate borrowing rates.'],
        ],
    ],
    [
        'ind' => 'manufacturing',
        'title' => 'Will BUA Cement (BUACEMENT) complete its 70MW captive LNG power plant in Kalambaina to achieve 100% off-grid energy self-sufficiency?',
        'slug' => 'bua-cement-captive-lng-power',
        'def' => 'Resolves YES if BUA Cement quarterly operational filings on NGX verify commercial commissioning of the 70MW captive dual-fuel LNG power plant with over 90% fuel cost self-sufficiency.',
        'src' => 'NGX Corporate Announcements & BUA Cement Investor Relations',
        'prob' => 78,
        'days' => 110,
        'metrics' => [
            ['Captive Power Generation Uptime', 'Insulating clinker kilns from national grid collapse and diesel generator volatility.'],
            ['LNG Virtual Pipeline Haulage', 'Specialized cryogenic tanker supply reliability from Niger Delta to Sokoto.'],
            ['Interstate Cement Freight Cost', 'Dual-fuel truck fleet conversion lowering transportation expense per bag.'],
            ['Regional Export Revenue (Niger & Mali)', 'Cross-border clinker and cement trade generating foreign exchange.'],
        ],
    ],
    [
        'ind' => 'energy',
        'title' => 'Will Transcorp Power (TRANSPOWER) achieve peak grid power generation exceeding 750MW following Afam gas turbine rehabilitation?',
        'slug' => 'transcorp-power-afam-generation',
        'def' => 'Resolves YES if daily grid generation logs published by the National Control Centre (NCC) Osogbo verify Transcorp Power / Afam generating over 750MW into the national grid for 30 consecutive days.',
        'src' => 'National Control Centre (NCC) Generation Statistics & NGX Filings',
        'prob' => 70,
        'days' => 80,
        'metrics' => [
            ['Domestic Gas Supply Agreements (GSA)', 'Firm gas delivery volumes from Niger Delta fields to Ughelli & Afam turbines.'],
            ['NERC Multi-Year Tariff Order (MYTO)', 'Cost-reflective tariff adjustments providing revenue certainty for GenCos.'],
            ['Eligible Customer Direct Sales', 'Supplying power directly to heavy industrial estates bypassing weak DisCo networks.'],
            ['Foreign Exchange Maintenance Capex', 'Procurement of specialized turbine replacement blades and control systems.'],
        ],
    ],
    [
        'ind' => 'fmcg',
        'title' => 'Will Nigerian Breweries (NB) achieve positive operating profit by lifting domestic sorghum sourcing to 75% of raw grain input?',
        'slug' => 'nigerian-breweries-sorghum-75pct',
        'def' => 'Resolves YES if Nigerian Breweries Plc full-year financial disclosures confirm positive operating profit (EBIT) alongside verified local grain sourcing of 75.0% or greater.',
        'src' => 'NGX Financial Disclosures & MAN Raw Material Sourcing Review',
        'prob' => 66,
        'days' => 120,
        'metrics' => [
            ['Local Sorghum & Malted Barley Substitution', 'Reducing foreign currency import bills for brewing grains.'],
            ['Glass Bottle Returnable Packaging Float', 'Managing returnable glass inventory to counteract local packaging inflation.'],
            ['Interstate Distribution Haulage Costs', 'Fuel cost pass-through across regional warehousing and depot networks.'],
            ['Consumer Price Elasticity in Premium Beers', 'Volume retention following price increases in alcoholic and malt beverages.'],
        ],
    ],
    [
        'ind' => 'manufacturing',
        'title' => 'Will Lafarge Africa (WAPCO) reach 50% thermal energy substitution with alternative biomass fuels across its Ewekoro and Sagamu kilns?',
        'slug' => 'lafarge-africa-alternative-fuel-50',
        'def' => 'Resolves YES if Lafarge Africa Plc annual sustainability and financial disclosures report alternative fuel thermal substitution equal to or exceeding 50.0%.',
        'src' => 'Lafarge Africa Published Annual Report & NGX Filings',
        'prob' => 69,
        'days' => 90,
        'metrics' => [
            ['Agricultural Biomass & Industrial Waste Sourcing', 'Replacing expensive coal, LPFO, and unstable gas supplies.'],
            ['Kiln Thermal Energy Efficiency', 'Reduction in heat consumption per metric ton of clinker produced.'],
            ['Captive Solar Hybrid Integration', 'On-site solar generation offsetting peak tariff grid power consumption.'],
            ['Domestic Public Infrastructure Demand', 'Supply contracts for concrete pavement highways and deep seaport breakwaters.'],
        ],
    ],
    [
        'ind' => 'energy',
        'title' => 'Will Aradel Holdings (ARADEL) expand modular refinery output past 11,000 bpd while supplying domestic commercial fuel off-takers?',
        'slug' => 'aradel-holdings-refinery-throughput',
        'def' => 'Resolves YES if Aradel Holdings Plc audited operational disclosures verify average refined petroleum output (AGO, DPK, ATK) exceeding 11,000 barrels per day.',
        'src' => 'Nigerian Upstream Petroleum Regulatory Commission (NUPRC) & NGX Announcements',
        'prob' => 81,
        'days' => 85,
        'metrics' => [
            ['Ogbele Modular Refinery Utilization', 'Refining throughput across crude distillation units (CDU).'],
            ['Crude Oil Evacuation Barging vs Trunkline', 'Alternative evacuation avoiding Trans-Niger Pipeline security downtime.'],
            ['Domestic Industrial Diesel Direct Sales', 'Bypassing import parity delays by supplying manufacturing and telco towers directly.'],
            ['Domestic Gas Commercialization (GSA)', 'Gas supply contracts to rural electrification and commercial power plants.'],
        ],
    ],
    [
        'ind' => 'healthcare',
        'title' => 'Will Fidson Healthcare (FIDSON) achieve 20% operating revenue growth after clearing Active Pharmaceutical Ingredient (API) customs bottlenecks?',
        'slug' => 'fidson-healthcare-api-revenue-20',
        'def' => 'Resolves YES if Fidson Healthcare Plc audited financial statements show year-on-year revenue growth equal to or exceeding 20.0%.',
        'src' => 'NGX Financial Statements & National Agency for Food and Drug Administration and Control (NAFDAC)',
        'prob' => 64,
        'days' => 100,
        'metrics' => [
            ['Port Clearance Lead Time on Imported APIs', 'Customs inspection and NAFDAC laboratory clearance velocity at Lagos ports.'],
            ['Domestic Formulation Capacity Utilization', 'Output of sterile injectables, oral liquids, and essential antibiotics.'],
            ['Currency Devaluation Pass-Through', 'Price elasticity of prescription pharmaceuticals versus consumer OTC medicines.'],
            ['Local Excipient & Packaging Sourcing', 'Sourcing blister pack aluminum and packaging cartons from domestic suppliers.'],
        ],
    ],
    [
        'ind' => 'telecoms',
        'title' => 'Will Airtel Africa (AIRTELAFRI) reduce base station diesel opex by 35% through solar-hybrid battery conversions across 14 African markets?',
        'slug' => 'airtel-africa-solar-tower-35',
        'def' => 'Resolves YES if Airtel Africa Plc annual report confirms network diesel operating expense contraction equal to or greater than 35.0% on a constant currency basis.',
        'src' => 'Airtel Africa Plc Published Annual Financials & London Stock Exchange Filings',
        'prob' => 77,
        'days' => 110,
        'metrics' => [
            ['Solar-Battery Hybrid Deployment Rate', 'De-risking remote off-grid cell sites from road haulage diesel supplies.'],
            ['Pan-African Foreign Currency Translation', 'Mitigating devaluation impacts across Nigeria, Kenya, Zambia, and Francophone West Africa.'],
            ['SmartCash PSB & Mobile Money Penetration', 'Growing high-margin fintech transactional fee revenue.'],
            ['Towerco Lease Renegotiations', 'Shifting USD-pegged tower leases to local currency rate cards.'],
        ],
    ],
    [
        'ind' => 'agriculture',
        'title' => 'Will Okomu Oil Palm (OKOMUOIL) achieve operating EBITDA margin above 55% supported by domestic crude palm oil deficit pricing?',
        'slug' => 'okomu-oil-cpo-ebitda-55',
        'def' => 'Resolves YES if audited full-year financial statements of Okomu Oil Palm Company Plc show operating EBITDA margin equal to or exceeding 55.0%.',
        'src' => 'NGX Audited Financials & Nigerian Palm Oil Development Association',
        'prob' => 83,
        'days' => 95,
        'metrics' => [
            ['Crude Palm Oil (CPO) Farmgate Realized Price', 'Premium domestic pricing insulating margins from global benchmark drops.'],
            ['Fresh Fruit Bunch (FFB) Milling Efficiency', 'Oil extraction rate (OER) per metric ton of harvested fruit.'],
            ['Interstate Road Freight & Diesel Haulage', 'Transport cost inflation moving refined oil from Edo State to consumer hubs.'],
            ['Industrial Offtake Contracts', 'Forward volume off-take commitments from food manufacturing conglomerates.'],
        ],
    ],
    [
        'ind' => 'capital-markets',
        'title' => 'Will Safaricom (NSE: SCOM) expand M-Pesa regional transaction velocity by 25% despite East African currency depreciations?',
        'slug' => 'safaricom-mpesa-regional-growth-25',
        'def' => 'Resolves YES if Safaricom Plc financial year results published on the Nairobi Securities Exchange (NSE) confirm M-Pesa transaction value growth equal to or exceeding 25.0%.',
        'src' => 'Nairobi Securities Exchange (NSE) Disclosures & Central Bank of Kenya',
        'prob' => 75,
        'days' => 105,
        'metrics' => [
            ['Ethiopia M-Pesa Rollout Velocity', 'Subscriber acquisition and agent banking liquidity in newly deregulated Ethiopian market.'],
            ['Cross-Border Remittance Corridor Growth', 'Diaspora and intra-African trade remittance flows via mobile money.'],
            ['Network Power & Fuel Resilience', 'Captive solar microgrids powering rural East African telecom towers.'],
            ['Kenya Shilling Exchange Rate Pass-Through', 'Mitigating imported network equipment costs amidst FX rate volatility.'],
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

