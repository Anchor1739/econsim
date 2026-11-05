<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/vendor/autoload.php';

use App\Config\Database;
use App\Config\Env;
use App\Utils\Security;

Env::load();

$pdo = Database::getConnection();

echo "========================================================\n";
echo " EconSim - Multi-Sector Lively Prediction Market Expansion\n";
echo "========================================================\n";

$catalysts = [
    // 1. Monetary Policy & CBN
    [
        'ind_slug' => 'monetary-policy',
        'title' => 'Will the Central Bank of Nigeria reduce the benchmark Cash Reserve Ratio (CRR) below 40% before Q4 2027?',
        'slug' => 'cbn-crr-cut-sub-40',
        'definition' => 'Resolves YES if the published CBN Monetary Policy Committee communique officially reduces the commercial bank Cash Reserve Ratio (CRR) below 40.0% to stimulate private sector credit growth.',
        'source' => 'Central Bank of Nigeria (CBN) Official MPC Communique (cbn.gov.ng)',
        'days' => 120,
        'metrics' => [
            ['Commercial Banking Liquidity Ratio', 'Mandatory reserves versus liquid asset deployment in treasury bills.'],
            ['Private Sector Credit Expansion', 'Credit growth to manufacturing and real sector commercial borrowers.'],
            ['Interbank Call Lending Rates', 'Overnight borrowing costs reflecting liquidity abundance or tightening.'],
            ['Headline Inflation Moderation', 'Sustained disinflation creating policy space for reserve easing.']
        ],
        'history' => 'The CBN increased the CRR past 45% in 2024 to sterilize excess system liquidity driving currency speculation.'
    ],
    [
        'ind_slug' => 'monetary-policy',
        'title' => 'Will M3 broad money supply growth decelerate below 18% YoY in the quarterly CBN statistical bulletin?',
        'slug' => 'nigeria-m3-money-supply-growth-18',
        'definition' => 'Resolves YES if the Money and Credit Statistics bulletin published by the Central Bank of Nigeria records year-on-year growth of M3 broad money supply strictly below 18.0%.',
        'source' => 'CBN Money and Credit Statistics Monthly Release',
        'days' => 90,
        'metrics' => [
            ['Net Domestic Credit to Government', 'Ways and Means advances and sovereign treasury debt issuance.'],
            ['Currency Outside Banks Ratio', 'Cash circulation velocity versus formal electronic bank deposits.'],
            ['Foreign Asset Revaluation Effects', 'Impact of exchange rate depreciation on the Naira value of foreign assets.'],
            ['Open Market Operation (OMO) Sales', 'CBN bill issuances sterilizing liquidity from institutional investors.']
        ],
        'history' => 'M3 money supply surged following currency float adjustments and deficit financing before restrictive OMO sales cooled expansion.'
    ],

    // 2. Fintech & Digital Payments
    [
        'ind_slug' => 'fintech',
        'title' => 'Will Moniepoint or OPay surpass ₦15 Trillion in quarterly transaction processing volume?',
        'slug' => 'agency-banking-15t-quarterly-volume',
        'definition' => 'Resolves YES if audited or verified industry performance reports from NIBSS, company investor presentations, or regulatory filings confirm either Moniepoint or OPay processed ₦15,000,000,000,000 or greater in gross transactions in a single quarter.',
        'source' => 'NIBSS Electronic Payments Report & Fintech Corporate Releases',
        'days' => 85,
        'metrics' => [
            ['POS Terminal Active Deployment', 'Growth in micro-merchant and retail point-of-sale terminal footprint.'],
            ['Consumer Digital Wallet Retention', 'Daily active users performing P2P transfers and bill payments.'],
            ['Merchant Working Capital Credit', 'Short-term inventory financing disbursed based on merchant transaction history.'],
            ['Inter-Bank Settlement Uptime', 'NIP switch throughput and dispute resolution turnaround times.']
        ],
        'history' => 'Agency banking giants scaled rapidly across commercial retail corridors, processing tens of millions of daily transactions.'
    ],
    [
        'ind_slug' => 'fintech',
        'title' => 'Will Flutterwave officially file an initial registration prospectus for an international or NGX public listing?',
        'slug' => 'flutterwave-ipo-prospectus-filing',
        'definition' => 'Resolves YES if Flutterwave Inc. formally submits an S-1 or F-1 registration statement with the US SEC or a public listing prospectus with the Nigerian Securities and Exchange Commission (SEC).',
        'source' => 'US SEC EDGAR System & Nigerian Securities and Exchange Commission Public Register',
        'days' => 140,
        'metrics' => [
            ['Enterprise Merchant Gross Merchandise Volume (GMV)', 'Cross-border B2B settlement flows across Africa, Europe, and Asia.'],
            ['Corporate Governance & Audit Cleansing', 'Completion of tier-1 institutional audits and board independence appointments.'],
            ['Global Tech IPO Market Conditions', 'Valuation multiples for emerging market fintechs on Western bourses.'],
            ['African Cross-Border Remittance Licenses', 'Expansion of international payment rails in the UK, US, and EU corridors.']
        ],
        'history' => 'Africa\'s highest-valued unicorn has prepared balance sheet structures for a landmark dual listing.'
    ],
    [
        'ind_slug' => 'fintech',
        'title' => 'Will active digital wallet accounts licensed under the CBN regulatory sandbox surpass 60 Million users?',
        'slug' => 'cbn-digital-wallet-accounts-60m',
        'definition' => 'Resolves YES if official NIBSS electronic payment statistics verify the total number of active mobile money and Tier-1 digital wallet accounts in Nigeria exceeds 60,000,000.',
        'source' => 'NIBSS Industry Statistics Portal & CBN Financial Inclusion Secretariat',
        'days' => 100,
        'metrics' => [
            ['Tier-1 Biometric Onboarding (BVN/NIN)', 'Simplified digital verification compliance for unbanked demographics.'],
            ['Telco Mobile Money PSB Adoption', 'MoMo and SmartCash merchant acceptance in peri-urban markets.'],
            ['Cardless Cash Withdrawal Infrastructure', 'ATM and agency banking QR code cash disbursements.'],
            ['Cross-Border Diaspora Inflow Corridors', 'Direct remittance receipt into mobile consumer wallets.']
        ],
        'history' => 'Financial inclusion targets set by the CBN aimed to bring formal payment services to 95% of adult citizens.'
    ],

    // 3. Equities & Capital Markets
    [
        'ind_slug' => 'capital-markets',
        'title' => 'Will the total market capitalization of the Nigerian Exchange (NGX) cross ₦80 Trillion before year-end 2026?',
        'slug' => 'ngx-market-cap-80t-milestone',
        'definition' => 'Resolves YES if the total market capitalization of listed equities published on the official daily NGX market summary reaches or exceeds ₦80,000,000,000,000 on or before December 31, 2026.',
        'source' => 'Nigerian Exchange Group (NGX) Daily Official Market Summary (ngxgroup.com)',
        'days' => 110,
        'metrics' => [
            ['Tier-1 Bank Recapitalization Listings', 'New rights issue and public offer equity admissions on the exchange.'],
            ['Dangote Refinery / Major Industrial IPOs', 'Anticipated mega-cap listings expanding market depth and liquidity.'],
            ['Domestic Institutional Asset Allocation', 'Pension funds seeking dividend-yielding corporate shares.'],
            ['Foreign Portfolio Investor Repatriation', 'FX liquidity improvements encouraging offshore market participation.']
        ],
        'history' => 'The NGX market capitalization doubled over 2023-2024 as listed corporates revalued balance sheets post-float.'
    ],
    [
        'ind_slug' => 'capital-markets',
        'title' => 'Will Guaranty Trust Holding Company (GTCO) achieve full-year Profit Before Tax exceeding ₦650 Billion?',
        'slug' => 'gtco-full-year-pbt-650b',
        'definition' => 'Resolves YES if audited full-year financial statements of Guaranty Trust Holding Company Plc filed on the NGX confirm consolidated Profit Before Tax (PBT) equal to or exceeding ₦650,000,000,000.',
        'source' => 'NGX Audited Financial Disclosures & GTCO Investor Relations',
        'days' => 130,
        'metrics' => [
            ['Net Interest Margin (NIM) Optimization', 'Yields on prime commercial lending and investment securities.'],
            ['Fee and Digital Banking Commission Income', 'Retail transaction throughput across HabariPay and corporate portals.'],
            ['FX Translation & Derivative Revaluation', 'Net gains from foreign currency liquidity buffers and asset hedges.'],
            ['Credit Loss Impairment Cost-of-Risk', 'Macro-economic provisioning on private sector corporate loans.']
        ],
        'history' => 'GTCO historically commands the highest return on equity and lowest cost-to-income ratio among West African lenders.'
    ],
    [
        'ind_slug' => 'capital-markets',
        'title' => 'Will Nigerian Pension Fund Administrators (PFAs) increase domestic equity asset allocation above 12% of total assets?',
        'slug' => 'pencom-pfa-equity-allocation-12pct',
        'definition' => 'Resolves YES if official monthly summary reports published by the National Pension Commission (PENCOM) show PFA investment in domestic ordinary shares exceeding 12.0% of total pension assets under management.',
        'source' => 'National Pension Commission (PENCOM) Monthly Industry Summary',
        'days' => 105,
        'metrics' => [
            ['FMDQ Bond vs NGX Equity Yield Spreads', 'Real dividend yields competing with benchmark sovereign debt coupons.'],
            ['Multi-Fund Structure Risk Appetite (Fund I & II)', 'Younger demographics allowing higher risk exposure in active retirement accounts.'],
            ['Infrastructure and Private Equity Approvals', 'Alternative asset allocations permitted under updated PENCOM regulations.'],
            ['Corporate Governance and Sustainability Mandates', 'Institutional stewardship driving active voting and equity selection.']
        ],
        'history' => 'PFAs traditionally maintained conservative allocations in Federal Government bonds before equity rallies prompted reallocation.'
    ],

    // 4. FX & External Reserves
    [
        'ind_slug' => 'fx-reserves',
        'title' => 'Will the Central Bank achieve 100% electronic order matching on the Bloomberg BMatch FX terminal for 90 consecutive days?',
        'slug' => 'cbn-bmatch-electronic-fx-matching',
        'definition' => 'Resolves YES if official CBN financial markets notices confirm that all authorized dealer transactions in the Nigerian Autonomous Foreign Exchange Market (NAFEM) operated exclusively on transparent electronic order matching without bilateral off-market quotes for 90 consecutive trading days.',
        'source' => 'FMDQ Securities Exchange & Central Bank of Nigeria Financial Markets Department Notices',
        'days' => 95,
        'metrics' => [
            ['Two-Way Market Maker Quotation Depth', 'Commercial bank bid-ask spreads and live order book volume.'],
            ['Offshore Capital Repatriation Guarantees', 'Clearance of dividend and portfolio capital through formal banking corridors.'],
            ['Exporter FX Sales Compliance', 'Prompt liquidation of oil and non-oil export proceeds into the transparent pool.'],
            ['Arbitrage Compression vs Parallel Markets', 'Narrowing of spreads eliminating round-tripping incentives.']
        ],
        'history' => 'The CBN mandated automated order-driven electronic FX trading to eliminate opaque pricing and restore market credibility.'
    ],
    [
        'ind_slug' => 'fx-reserves',
        'title' => 'Will Nigeria issue a new sovereign diaspora dollar bond with subscription demand exceeding 150%?',
        'slug' => 'nigeria-diaspora-bond-oversubscription-150',
        'definition' => 'Resolves YES if the Debt Management Office (DMO) official allotment press release confirms total bids for the Federal Government of Nigeria diaspora dollar bond exceeded 150.0% of the initial targeted offer size.',
        'source' => 'Debt Management Office (DMO) Official Allotment Results (dmo.gov.ng)',
        'days' => 100,
        'metrics' => [
            ['Retail Diaspora Dollar Appetite', 'Participation by Nigerian professionals in North America, Europe, and the Middle East.'],
            ['Benchmark Coupon Pricing vs US Treasuries', 'Attractive sovereign yield spread over comparable US risk-free yields.'],
            ['Digital Platform Direct Onboarding', 'Subscription through approved primary dealer mobile banking interfaces.'],
            ['Credit Rating Agency Sovereign Outlook', 'Ratings affirmation by S&P, Fitch, and Moody\'s supporting debt sustainability.']
        ],
        'history' => 'The DMO launched targeted diaspora bond instruments to harness hard currency savings of citizens living abroad.'
    ],

    // 5. Oil, Gas & Energy
    [
        'ind_slug' => 'energy',
        'title' => 'Will Nigeria\'s official crude oil production (excluding condensates) sustain above 1.6 Million bpd for 3 consecutive months?',
        'slug' => 'nigeria-crude-production-1-6m-bpd',
        'definition' => 'Resolves YES if monthly oil production reports published by the Nigerian Upstream Petroleum Regulatory Commission (NUPRC) confirm average daily crude output exceeding 1,600,000 barrels per day across 3 consecutive calendar months.',
        'source' => 'Nigerian Upstream Petroleum Regulatory Commission (NUPRC) Official Oil Production Status Report',
        'days' => 110,
        'metrics' => [
            ['Trunk Line Surveillance and Pressure Telemetry', 'Mitigating illegal tapping along Trans-Niger and Nembe Creek corridors.'],
            ['Deepwater Production Efficiency (Bonga, Egina, Akpo)', 'FPSO maintenance turnaround and infill drilling campaigns.'],
            ['Joint Venture Cash Call Funding Discipline', 'Timely government counterpart capital disbursements to operating partners.'],
            ['Rig Count and Drilling Activity Growth', 'Active exploratory and development drilling rigs in the Niger Delta basin.']
        ],
        'history' => 'Security campaigns and automated surveillance helped crude production recover from historic lows recorded in 2022.'
    ],
    [
        'ind_slug' => 'energy',
        'title' => 'Will the Ajaokuta-Kaduna-Kano (AKK) gas pipeline project achieve operational mechanical completion before year-end 2026?',
        'slug' => 'akk-gas-pipeline-completion-2026',
        'definition' => 'Resolves YES if official NNPC Limited and Ministry of Petroleum Resources commissioning reports verify full line-pipe welding and gas introduction along the 614km AKK gas pipeline route.',
        'source' => 'NNPC Limited Corporate Communications & Ministry of Petroleum Resources Operational Disclosures',
        'days' => 135,
        'metrics' => [
            ['Pipeline River Crossing & Trenching Progress', 'Engineering milestones across Kaduna and Kano terminal stations.'],
            ['Downstream Industrial Off-Take Agreements', 'Power plant and industrial gas purchase contracts in northern industrial parks.'],
            ['Contractor Financing Counterpart Releases', 'Capital mobilization by consortium EPC contractors.'],
            ['Security Escort and Right-of-Way Protection', 'Securing northern transmission corridors from infrastructure disruption.']
        ],
        'history' => 'The AKK pipeline is Nigeria\'s flagship domestic gas project, designed to connect southern gas reserves to northern industry.'
    ],
    [
        'ind_slug' => 'energy',
        'title' => 'Will Oando Plc (OANDO) increase net operating cash flow by over 40% following the ENI/NAOC asset takeover?',
        'slug' => 'oando-naoc-cash-flow-growth-40',
        'definition' => 'Resolves YES if audited annual reports of Oando Plc published on the NGX and JSE confirm consolidated net cash generated from operating activities grew by 40.0% or greater following the acquisition of Nigerian Agip Oil Company.',
        'source' => 'Oando Plc Audited Financial Statements & NGX Corporate Disclosures',
        'days' => 125,
        'metrics' => [
            ['Onshore Oil Mining Lease (OML) Production Rates', 'Daily output from 40 discovered oil and gas fields across Rivers, Delta, and Bayelsa.'],
            ['Brass River Crude Export Terminal Operations', 'Terminal uptime and export tanker lifting reliability.'],
            ['Debt Deleveraging and Amortization Schedule', 'Repayment of senior syndicated acquisition debt facilities.'],
            ['Host Community GMoU Governance', 'Peaceful operating environment and stakeholder dividend distribution.']
        ],
        'history' => 'The landmark $783m acquisition elevated Oando to one of Africa\'s largest indigenous upstream energy producers.'
    ],

    // 6. Agriculture & Food Security
    [
        'ind_slug' => 'agriculture',
        'title' => 'Will national annual paddy rice production exceed 6.5 Million metric tons according to the Federal Ministry of Agriculture?',
        'slug' => 'national-paddy-rice-production-6-5m',
        'definition' => 'Resolves YES if the annual Agricultural Performance Survey published by the Federal Ministry of Agriculture and Food Security (FMAFS) records national paddy rice harvest equal to or exceeding 6,500,000 metric tons.',
        'source' => 'Federal Ministry of Agriculture and Food Security & National Agricultural Extension Services (NAERLS)',
        'days' => 115,
        'metrics' => [
            ['Dry Season Irrigation Farming Acreage', 'Expansion of river basin authority flood-recession and canal farming.'],
            ['Certified High-Yield Hybrid Seed Distribution', 'Adoption of drought-tolerant and pest-resistant seed varieties.'],
            ['Commercial Integrated Mill Utilization', 'Processing capacity throughput across major automated rice mills.'],
            ['Fertilizer and Mechanization Availability', 'Tractor leasing programs and localized NPK blending delivery.']
        ],
        'history' => 'Government intervention programs prioritized domestic rice self-sufficiency to reduce billion-dollar import expenditures.'
    ],
    [
        'ind_slug' => 'agriculture',
        'title' => 'Will Okomu Oil Palm (OKOMUOIL) declare an annual dividend distribution exceeding ₦30 per share on the NGX?',
        'slug' => 'okomu-oil-dividend-30-per-share',
        'definition' => 'Resolves YES if the Board of Directors of Okomu Oil Palm Company Plc recommends and the AGM approves total annual dividend per ordinary share equal to or exceeding ₦30.00.',
        'source' => 'Nigerian Exchange Group (NGX) Corporate Action Announcements & Okomu Annual Report',
        'days' => 120,
        'metrics' => [
            ['Crude Palm Oil (CPO) Farmgate Price Margins', 'Domestic price realization supported by import tariffs and global benchmarks.'],
            ['Natural Rubber Export Revenues', 'Hard currency export proceeds from processed cup-lump rubber shipments.'],
            ['Fresh Fruit Bunch (FFB) Milling Yields', 'Extraction efficiency in Ovia North East plantation estates.'],
            ['Biological Asset Fair Value Adjustments', 'Asset valuation gains from maturing oil palm tree acreage.']
        ],
        'history' => 'Okomu Oil Palm consistently maintains among the highest return on equity and dividend payouts in the agricultural sector.'
    ],

    // 7. Manufacturing & Industry
    [
        'ind_slug' => 'manufacturing',
        'title' => 'Will the Nigerian industrial Purchasing Managers\' Index (PMI) remain expansionary (> 50.0) for 4 consecutive months?',
        'slug' => 'nigerian-industrial-pmi-expansion-4m',
        'definition' => 'Resolves YES if the monthly Purchasing Managers\' Index (PMI) report published by Stanbic IBTC Bank / S&P Global records composite PMI strictly above 50.0 for 4 consecutive reporting months.',
        'source' => 'Stanbic IBTC Bank Nigeria PMI / S&P Global Market Intelligence',
        'days' => 110,
        'metrics' => [
            ['Manufacturing Output and New Orders Index', 'Customer demand resilience following price pass-through adjustments.'],
            ['Input Cost and Factory Gate Inflation', 'Moderation of raw material price pressures and freight costs.'],
            ['Supplier Delivery Times and Port Dwell', 'Clearance velocity of imported capital goods through seaports.'],
            ['Industrial Employment and Staffing Levels', 'Hiring trends in FMCG, automotive, and construction materials manufacturing.']
        ],
        'history' => 'The PMI measures economic direction; readings above 50 signal expansion in private sector business conditions.'
    ],
    [
        'ind_slug' => 'manufacturing',
        'title' => 'Will local automotive assembly plants deliver over 15,000 CNG-converted commercial mass transit buses?',
        'slug' => 'cng-commercial-buses-production-15k',
        'definition' => 'Resolves YES if official Presidential CNG Initiative (P-CNGi) delivery reports confirm at least 15,000 commercial mass transit buses and tricycles assembled or converted with dual-fuel CNG systems.',
        'source' => 'Presidential CNG Initiative (PCNGI) Operations Dashboard & Ministry of Industry, Trade and Investment',
        'days' => 95,
        'metrics' => [
            ['CNG Mother-Daughter Refueling Station Density', 'Availability of high-pressure natural gas dispensers along interstate corridors.'],
            ['Domestic Assembly Plant Capacity (Innoson, Jet Motors, Nord)', 'Production throughput and local component integration.'],
            ['Commercial Driver Conversion Subsidy Uptake', 'Government vouchers reducing conversion kit costs for transport unions.'],
            ['Operating Fuel Cost Savings per Kilometre', 'Economic viability comparing natural gas prices against commercial automotive diesel.']
        ],
        'history' => 'Nigeria launched a nationwide CNG vehicle transition following fuel subsidy removal to slash transport costs.'
    ],

    // 8. FMCG & Retail
    [
        'ind_slug' => 'fmcg',
        'title' => 'Will Unilever Nigeria (UNILEVER) maintain positive gross margin expansion above 35% following portfolio restructuring?',
        'slug' => 'unilever-nigeria-gross-margin-35',
        'definition' => 'Resolves YES if audited annual reports of Unilever Nigeria Plc published on the NGX confirm gross profit margin equal to or exceeding 35.0%.',
        'source' => 'Unilever Nigeria Plc Published Financial Disclosures & NGX Filings',
        'days' => 120,
        'metrics' => [
            ['Exit from Home and Skin Cleansing Divisions', 'Focus on high-margin beauty, food nutrition, and oral care categories.'],
            ['Local Material Sourcing and Sachet Packaging', 'Re-engineering product sizes to protect retail shelf affordability.'],
            ['Zero Foreign Currency Loan Exposure', 'Eliminating balance sheet foreign exchange translation losses.'],
            ['Distributor Working Capital Financing Lines', 'Partnering with commercial banks to support trade channel liquidity.']
        ],
        'history' => 'Unilever celebrated 100 years of operations in Nigeria by restructuring its product portfolio towards higher-margin essentials.'
    ],
    [
        'ind_slug' => 'fmcg',
        'title' => 'Will Cadbury Nigeria (CADBURY) return to positive shareholder equity following parent debt-to-equity conversion?',
        'slug' => 'cadbury-nigeria-equity-restoration',
        'definition' => 'Resolves YES if quarterly financial statements of Cadbury Nigeria Plc published on the NGX show positive total equity attributable to equity holders of the parent.',
        'source' => 'Cadbury Nigeria Plc Unaudited Financial Statements & NGX Filings',
        'days' => 90,
        'metrics' => [
            ['Mondelez Intercompany Loan Conversion', 'Converting dollar shareholder loans into ordinary equity shares.'],
            ['Cocoa Processing and Beverage Powder Export Volume', 'Generating hard currency through regional cocoa butter and powder sales.'],
            ['Domestic Sourcing of Sugar and Packaging Materials', 'Reducing vulnerability to port import duties and foreign exchange volatility.'],
            ['Bournvita and Candy Market Share Resilience', 'Consumer brand loyalty amidst competition from lower-priced alternatives.']
        ],
        'history' => 'Multinational consumer brands restructured intercompany debts after currency devaluations impacted accounting equity.'
    ],

    // 9. Healthcare & Pharma
    [
        'ind_slug' => 'healthcare',
        'title' => 'Will May & Baker Nigeria (MAYBAKER) complete regulatory certification of its Biovaccines local production venture?',
        'slug' => 'may-baker-biovaccines-certification',
        'definition' => 'Resolves YES if NAFDAC and the Federal Ministry of Health issue final regulatory facility manufacturing approval for the Biovaccines Nigeria Limited joint-venture production facility.',
        'source' => 'National Agency for Food and Drug Administration and Control (NAFDAC) & May & Baker NGX Filings',
        'days' => 125,
        'metrics' => [
            ['WHO Pre-Qualification Audit Readiness', 'Cleanroom standards, cold-chain integrity, and batch stability testing.'],
            ['Federal Government Counterpart Capital Releases', 'Equity contributions supporting technology transfer from international partners.'],
            ['Routine Childhood Immunization Off-Take Contracts', 'National Primary Health Care Development Agency procurement agreements.'],
            ['Regional Vaccine Supply to West African Corridors', 'Positioning Nigeria as a regional biomanufacturing export hub.']
        ],
        'history' => 'Biovaccines Nigeria Limited is a public-private partnership aimed at reviving local human vaccine production.'
    ],
    [
        'ind_slug' => 'healthcare',
        'title' => 'Will private health sector capital expenditure into diagnostic imaging and cancer centres exceed $50 Million?',
        'slug' => 'nigeria-private-healthcare-capex-50m',
        'definition' => 'Resolves YES if industry data published by the Healthcare Federation of Nigeria (HFN) or Nigeria Sovereign Investment Authority (NSIA) confirms verified private and commercial healthcare CapEx exceeding USD 50,000,000.',
        'source' => 'Healthcare Federation of Nigeria (HFN) Annual Healthcare Review & NSIA Healthcare Reports',
        'days' => 130,
        'metrics' => [
            ['NSIA Advanced Medical Centres Expansion', 'Operational oncology and diagnostic centres in Lagos, Kano, and Umuahia.'],
            ['Private Equity Hospital Group Consolidations', 'Investments into multi-specialist private hospital networks.'],
            ['Medical Equipment Leasing Facilities', 'Importation of advanced MRI, CT scanners, and linear accelerators on vendor financing.'],
            ['Reverse Medical Tourism Initiatives', 'Retaining high-net-worth patients locally through complex surgery capabilities.']
        ],
        'history' => 'Medical tourism outflows historically drained over $1B annually, incentivizing modern private healthcare investments.'
    ],

    // 10. Real Estate & Infrastructure
    [
        'ind_slug' => 'real-estate',
        'title' => 'Will the Lagos-Calabar Coastal Highway project complete commercial surfacing on its first 50-kilometre corridor?',
        'slug' => 'lagos-calabar-coastal-highway-50km',
        'definition' => 'Resolves YES if the Federal Ministry of Works and Hitech Construction Company officially verify completion of continuous concrete paving across Section 1 (first 47.4 kilometres from Ahmadu Bello Way).',
        'source' => 'Federal Ministry of Works Official Project Inspection Reports & Presidential Project Delivery Unit',
        'days' => 140,
        'metrics' => [
            ['Continuously Reinforced Concrete Pavement (CRCP) Surfacing', 'Deployment of specialized slipform concrete paving machinery.'],
            ['Right-of-Way Land Clearing and Compensation', 'Resolving commercial property and shoreline setback compensations.'],
            ['Federal Infrastructure Bond Allocation', 'Direct funding releases from the Renewed Hope Infrastructure Development Fund.'],
            ['Coastal Real Estate Value Appreciation', 'Surge in commercial property and leisure development along the corridor.']
        ],
        'history' => 'The 700km highway is Nigeria\'s largest coastal infrastructure project connecting major economic ports.'
    ],
    [
        'ind_slug' => 'real-estate',
        'title' => 'Will Lekki Deep Sea Port handle annual container throughput exceeding 400,000 TEUs in commercial operations?',
        'slug' => 'lekki-deep-sea-port-throughput-400k',
        'definition' => 'Resolves YES if Nigerian Ports Authority (NPA) quarterly operational statistics verify Lekki Deep Sea Port processed total container volume equal to or exceeding 400,000 Twenty-Foot Equivalent Units (TEUs).',
        'source' => 'Nigerian Ports Authority (NPA) Quarterly Performance Statistics & Lekki Port LFTZ Enterprise',
        'days' => 110,
        'metrics' => [
            ['Post-Panamax Container Vessel Calls', 'Berthing of 14,000+ TEU mega-container ships taking advantage of 16.5m draught.'],
            ['Automated Ship-to-Shore (STS) Crane Productivity', 'Container moves per hour exceeding traditional Lagos port terminals.'],
            ['Lekki-Epe Expressway Evacuation Logistics', 'Road haulage efficiency and barge coastal transshipment to secondary depots.'],
            ['Transshipment Hub Cargo to West African Ports', 'Handling transit cargo destined for Cameroon, Togo, and Ghana.']
        ],
        'history' => 'Commissioned in 2023, Lekki Port is Nigeria\'s first fully automated deep-water container terminal.'
    ],

    // 11. Telecoms & Tech Infrastructure
    [
        'ind_slug' => 'telecoms',
        'title' => 'Will Airtel Africa (AIRTELAFRI) execute a minority strategic equity sale or IPO of Airtel Money valuing it above $3 Billion?',
        'slug' => 'airtel-money-ipo-valuation-3b',
        'definition' => 'Resolves YES if official regulatory announcements by Airtel Africa Plc on the London Stock Exchange (LSE) and NGX confirm a public listing or strategic minority sale of Airtel Money at a valuation of $3,000,000,000 or greater.',
        'source' => 'London Stock Exchange (LSE) & NGX Company Announcements',
        'days' => 135,
        'metrics' => [
            ['Mobile Money Monthly Active User Base', 'Growth across East, Central, and West African operating subsidiaries.'],
            ['Annualized Transaction Value Growth', 'Expansion of merchant payments, cross-border remittances, and micro-loans.'],
            ['EBITDA Margin in Fintech Division', 'High-margin cash generation compared to traditional voice infrastructure.'],
            ['Global Private Equity Appetite', 'Follow-on investments from institutional funds like TPG, Mastercard, and Rise Fund.']
        ],
        'history' => 'Airtel Africa planned a dedicated public listing for its high-growth fintech division to unlock standalone valuation.'
    ],
    [
        'ind_slug' => 'telecoms',
        'title' => 'Will total active broadband internet subscriptions in Nigeria cross the 110 Million mark in official NCC data?',
        'slug' => 'ncc-active-broadband-subscriptions-110m',
        'definition' => 'Resolves YES if monthly telecommunications subscriber statistics published by the Nigerian Communications Commission (NCC) verify active broadband subscriptions exceeding 110,000,000.',
        'source' => 'Nigerian Communications Commission (NCC) Telecommunications Industry Statistics (ncc.gov.ng)',
        'days' => 105,
        'metrics' => [
            ['4G LTE and 5G Network Rollout Depth', 'Base station upgrades by MTN, Airtel, Globacom, and 9mobile.'],
            ['Affordable Smartphone Penetration', 'Availability of entry-level 4G smartphones in semi-urban retail markets.'],
            ['National Broadband Plan RoW Harmonization', 'State government agreements reducing fiber optic installation fees.'],
            ['Subsea Cable Landing Capacities', 'Data bandwidth availability from Equiano, 2Africa, and MainOne cables.']
        ],
        'history' => 'Nigeria\'s National Broadband Plan targeted 70% broadband penetration to power the digital knowledge economy.'
    ],
    [
        'ind_slug' => 'telecoms',
        'title' => 'Will Tier-4 certified commercial data centre capacity in Lagos and Abuja surpass 100 Megawatts of IT load?',
        'slug' => 'nigeria-tier4-datacentre-capacity-100mw',
        'definition' => 'Resolves YES if industry disclosures from major colocation operators (MainOne/Equinix, Rack Centre, ADC, Medallion, Kasi) confirm total operational IT power capacity exceeding 100MW.',
        'source' => 'Data Centre Dynamics Africa & Association of Telecommunications Companies of Nigeria (ATCON)',
        'days' => 120,
        'metrics' => [
            ['Hyperscale Cloud Ingress (AWS, Microsoft, Google)', 'Local edge caching and cloud availability zone infrastructure.'],
            ['Independent Power Producer (IPP) Gas Supplies', 'Dedicated on-site power generation ensuring 99.995% facility uptime.'],
            ['Subsea Cable Cross-Connect Interconnects', 'Carrier-neutral peering traffic through the Internet Exchange Point of Nigeria.'],
            ['Financial Sector Data Sovereignty Compliance', 'CBN and NDPC regulations mandating local storage of sensitive consumer data.']
        ],
        'history' => 'Nigeria emerged as West Africa\'s digital hub, attracting hundreds of millions of dollars in hyperscale data centre investments.'
    ],
];

echo "[*] Populating 30+ diverse, high-impact prediction contracts across all 11 sectors...\n";
$count = 0;

foreach ($catalysts as $cat) {
    // Check if exists
    $chk = $pdo->prepare("SELECT id FROM market_events WHERE slug = ?");
    $chk->execute([$cat['slug']]);
    if ($chk->fetch()) {
        continue;
    }

    $indStmt = $pdo->prepare("SELECT id FROM industries WHERE slug = ? LIMIT 1");
    $indStmt->execute([$cat['ind_slug']]);
    $indId = $indStmt->fetchColumn();
    if (!$indId) {
        $indId = 1;
    }

    $eventId = Security::uuid();
    $closesAt = date('Y-m-d H:i:s', time() + ($cat['days'] * 86400));
    $resolvesAt = date('Y-m-d H:i:s', time() + (($cat['days'] + 1) * 86400));

    $insEvent = $pdo->prepare("
        INSERT INTO market_events 
            (id, slug, industry_id, title, outcome_definition, resolution_source, resolves_at, closes_at, state, created_at)
        VALUES 
            (:id, :slug, :ind, :title, :def, :src, :res, :cls, 'open', NOW(3))
    ");
    $insEvent->execute([
        ':id' => $eventId,
        ':slug' => $cat['slug'],
        ':ind' => $indId,
        ':title' => $cat['title'],
        ':def' => $cat['definition'],
        ':src' => $cat['source'],
        ':res' => $resolvesAt,
        ':cls' => $closesAt,
    ]);

    $contextId = Security::uuid();
    $metricsJson = json_encode($cat['metrics']);
    $historyJson = json_encode([['period' => 'Empirical Precedent', 'action' => $cat['history']]]);

    $insCtx = $pdo->prepare("
        INSERT INTO study_context_versions 
            (id, event_id, version, summary, metrics, historical_cases, ai_generated, published_at)
        VALUES 
            (:id, :eid, 1, :summary, :metrics, :history, 1, NOW(3))
    ");
    $insCtx->execute([
        ':id' => $contextId,
        ':eid' => $eventId,
        ':summary' => "Empirical Research & Study Context for {$cat['title']}.",
        ':metrics' => $metricsJson,
        ':history' => $historyJson,
    ]);

    $sourceId = Security::uuid();
    $insSrc = $pdo->prepare("
        INSERT INTO external_sources (id, name, publisher, origin_url, published_at, retrieved_at)
        VALUES (:id, :name, 'EconSim Institutional Radar', 'https://ngxgroup.com', NOW(3), NOW(3))
    ");
    $insSrc->execute([
        ':id' => $sourceId,
        ':name' => $cat['source'],
    ]);

    $pdo->prepare("INSERT INTO study_context_sources (context_id, source_id) VALUES (?, ?)")->execute([$contextId, $sourceId]);
    $count++;
    echo " [+] Added [{$cat['ind_slug']}]: {$cat['title']}\n";
}

echo "\n[✓] Successfully added {$count} new high-stakes prediction markets!\n";

