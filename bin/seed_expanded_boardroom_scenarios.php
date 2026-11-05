<?php
declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

use App\Config\Env;
use App\Config\Database;
use App\Utils\Security;

Env::load();
$pdo = Database::getConnection();

echo "========================================================\n";
echo " EconSim - Multi-Sector Boardroom Scenario Expansion\n";
echo "========================================================\n";

$scenarios = [
    // 1. Agriculture & Food Security
    [
        'ind_slug' => 'agriculture',
        'title' => 'Cold-Chain Tomato Post-Harvest Loss: ₦65m Spoilage vs Solar Cold-Hub Capex',
        'body' => "You are the Operations Director of a commercial food logistics network moving 120 tonnes of fresh tomatoes weekly from Kano to Mile 12 Market, Lagos. Unrefrigerated transit delays and interstate checkpoints cause a 38% spoil rate, destroying ₦65 million in farm-gate inventory monthly. A clean-tech provider offers to deploy 3 containerized solar cold-storage hubs along the corridor for ₦95 million upfront or ₦12 million monthly lease.\n\nEXECUTIVE DIRECTIVE: Deliver an operational decision memo addressing:\nOption A: Commit to the ₦12m monthly equipment lease, absorbing higher operating overhead to cut tomato spoilage below 8%.\nOption B: Partner with a Northern tomato processing paste factory for immediate farm-gate off-taking, eliminating transit spoilage but taking a 22% haircut on gross sales value.",
        'reference' => ['company' => 'Tomato Jos & Mile 12 Fresh Produce Hubs', 'precedent' => 'Sub-Saharan agricultural post-harvest cold chain logistics and perishables trade.'],
        'difficulty' => 'intermediate',
    ],
    [
        'ind_slug' => 'agriculture',
        'title' => 'Fertilizer Import Tariff Spike: ₦210m Pre-Planting Working Capital Gap',
        'body' => "You are the Managing Director of an agribusiness cooperative managing 18,000 hectares of commercial maize and rice acreage. A sudden adjustment in customs FX valuation benchmark raises imported urea and NPK fertilizer costs by 55%, leaving your cooperative with a ₦210 million cash deficit 30 days before the wet planting season. Commercial bank overdrafts are quoted at 31% annual interest.\n\nEXECUTIVE DIRECTIVE: Formulate a 72-hour financing directive deciding between:\nOption A: Secure a Bank of Industry (BOI) single-digit concessionary loan at 12%, risking a 3-week disbursement delay that could miss the first rain window.\nOption B: Immediately blend 60% local organic poultry manure and lime with 40% inorganic fertilizer, cutting the cash gap to ₦45 million while accepting a potential 12% crop yield variance.",
        'reference' => ['company' => 'National Agricultural Cooperative Federation', 'precedent' => 'Input financing and organic blending substitution during currency devaluation cycles.'],
        'difficulty' => 'intermediate',
    ],
    [
        'ind_slug' => 'agriculture',
        'title' => 'Grain Silo Inventory Arbitrage: Spot Sale vs 4-Month Warehouse Receipt Hold',
        'body' => "You are the Chief Commercial Officer of an integrated grain milling firm holding 12,000 metric tons of commercial grain in Kaduna silos. Spot market maize trades at ₦620,000/ton, generating ₦7.44 billion in immediate liquidity. Econometric commodity models predict spot prices will surge to ₦780,000/ton (+25.8%) in 4 months during the lean season, but storage insurance, shrinkage, and fumigation cost ₦18 million monthly.\n\nEXECUTIVE DIRECTIVE: Present your inventory risk mandate selecting:\nOption A: Liquidate 50% of grain stock on the AFEX spot market today to settle ₦3.2 billion in short-term commercial paper, holding the remaining 50% for seasonal upside.\nOption B: Lock all 12,000 tons into a regulated Warehouse Receipt Financing facility, borrowing 70% loan-to-value at 24% interest to fund working capital while speculating on peak grain prices.",
        'reference' => ['company' => 'AFEX Commodities Exchange & Northern Grain Aggregators', 'precedent' => 'Commodity warehouse receipt financing and seasonal grain storage arbitrage.'],
        'difficulty' => 'intermediate',
    ],

    // 2. Equities & Capital Markets
    [
        'ind_slug' => 'capital-markets',
        'title' => 'PFA Equity Ceiling Allocation: Blue-Chip Volatility vs Infrastructure Sukuk',
        'body' => "You are the Chief Investment Officer of a Tier-1 Pension Fund Administrator managing ₦180 billion in retirement savings accounts. Updated PENCOM guidelines allow domestic equity asset allocation to expand from 10% to 15% (permitting ₦9 billion in new stock purchases), but the NGX 30 index has demonstrated 18% annualized quarterly volatility amid foreign investor FX backlog concerns.\n\nEXECUTIVE DIRECTIVE: Decide your strategic asset allocation plan:\nOption A: Deploy ₦6 billion into high-dividend Tier-1 banking and industrial stocks to capture a 14% dividend yield and long-term capital appreciation.\nOption B: Shelter the capital in AAA-rated 10-year Federal Sovereign Infrastructure Sukuk yielding a risk-free 19.5% semi-annual coupon, bypassing stock market turbulence entirely.",
        'reference' => ['company' => 'PENCOM Regulated Pension Fund Administrators', 'precedent' => 'Institutional portfolio asset allocation shifts between sovereign debt and high-yield equities.'],
        'difficulty' => 'intermediate',
    ],
    [
        'ind_slug' => 'capital-markets',
        'title' => 'Dual-Listed Stock Arbitrage: 14% London-Lagos Spread vs FX Repatriation Lead Time',
        'body' => "You are the Head of Institutional Trading at a pan-African securities house. Shares of a dual-listed telecom conglomerate trade at ₦850 on the Nigerian Exchange (NGX) and £0.38 on the London Stock Exchange (LSE). At current NAFEM exchange rates, buying in Lagos and selling in London yields an attractive 14.2% gross arbitrage spread, but offshore dividend/capital repatriation takes up to 45 business days.\n\nEXECUTIVE DIRECTIVE: Outline your execution directive deciding between:\nOption A: Execute a ₦1.5 billion cross-border institutional block arbitrage, securing an offshore currency forward contract at ₦1,720/$ to hedge FX translation risk over the 45-day clearance window.\nOption B: Advise the corporate issuer to initiate a domestic share buyback program on the NGX to eliminate the valuation discount locally without offshore FX exposure.",
        'reference' => ['company' => 'Dual-Listed Telecom Conglomerates (NGX/LSE)', 'precedent' => 'Cross-border depository receipt arbitrage and capital repatriation liquidity spreads.'],
        'difficulty' => 'intermediate',
    ],
    [
        'ind_slug' => 'capital-markets',
        'title' => 'Tier-2 Subordinated Debt Call: 22% Coupon Step-Up vs Liquidity Paydown',
        'body' => "You are the Group Treasurer of a mid-tier commercial bank. A ₦25 billion 10-year subordinated Tier-2 debt instrument has reached its 5-year call date. Under contractual terms, if not redeemed today, the annual coupon rate automatically steps up from 14.5% to 22.0% (costing an additional ₦1.87 billion in annual financing charges). Your current capital adequacy ratio (CAR) is 14.8% against the 10.0% regulatory minimum.\n\nEXECUTIVE DIRECTIVE: Submit your capital structure decision:\nOption A: Exercise the call option and redeem the ₦25 billion principal using internal liquid reserves, saving ₦1.87bn in annual interest but dropping your CAR to 11.9%.\nOption B: Leave the bond uncalled and accept the 22% step-up interest rate, preserving balance sheet capital buffer while seeking refinancing through a commercial paper issuance.",
        'reference' => ['company' => 'Mid-Tier Listed Commercial Banks', 'precedent' => 'Subordinated Tier-2 debt redemption vs capital adequacy ratio preservation.'],
        'difficulty' => 'intermediate',
    ],

    // 3. Fintech & Digital Payments
    [
        'ind_slug' => 'fintech',
        'title' => 'Virtual Dollar Card Processor Freeze: $450k Float & 35k Stranded Users',
        'body' => "You are the Chief Product Officer of a digital bank with 600,000 customers. Your primary offshore banking-as-a-service partner has frozen your $450,000 operational card float due to an international compliance audit. 35,000 active Nigerian users attempting to pay cloud subscriptions, software licenses, and e-commerce bills are experiencing immediate transaction declines.\n\nEXECUTIVE DIRECTIVE: Determine the immediate 24-hour response strategy:\nOption A: Fast-track integration with a backup local card provider at an increased processing fee of 4.2% per swipe, absorbing ₦16 million in transaction costs to restore service within 6 hours.\nOption B: Proactively disable virtual USD cards in-app, issue automated Naira wallet refunds to affected users, and offer a ₦1,000 service fee rebate while legal teams unfreeze the main float.",
        'reference' => ['company' => 'Nigerian Digital Neobanks & Card Issuers', 'precedent' => 'Global BaaS provider freezes and international dollar card card-rail transitions.'],
        'difficulty' => 'intermediate',
    ],
    [
        'ind_slug' => 'fintech',
        'title' => 'Interbank Switching Latency: 11.4% Failure Rate vs ₦12m Route Balancing Fee',
        'body' => "You are the Chief Technology Officer of a licensed Mobile Money Operator processing 1.8 million daily POS transactions. Over the month-end payday weekend, transaction failure rates on your default primary payment switch spike from 0.8% to 11.4% due to central switch gateway overload, generating 12,000 customer complaints and social media backlash.\n\nEXECUTIVE DIRECTIVE: Choose your technical and operational directive:\nOption A: Force-route 100% of outgoing payment traffic to a premium secondary private card switch, paying an extra ₦12 million in expedited interchange fees to immediately drop failure rates below 1%.\nOption B: Implement an intelligent local transaction queueing system with automatic 45-second retries and instant SMS status notifications, avoiding extra fees but risking merchant terminal timeouts.",
        'reference' => ['company' => 'Licensed Mobile Money Operators (MMO) & POS Networks', 'precedent' => 'Peak holiday payment traffic bottlenecks and dynamic multi-switch routing.'],
        'difficulty' => 'intermediate',
    ],

    // 4. FMCG & Retail
    [
        'ind_slug' => 'fmcg',
        'title' => 'Shrinkflation Strategy: 380g Downsizing vs ₦650 Single-Use Sachet Launch',
        'body' => "You are the Category Director for household cleaning brands at a multinational FMCG. Your flagship 500g detergent sells for ₦1,200. Surfactant and imported sodium sulphate costs have surged 35%, slashing gross margin from 28% to 8%. Market surveys show that raising retail prices above ₦1,200 will cause 40% of consumers to defect to local unbranded alternatives.\n\nEXECUTIVE DIRECTIVE: Deliver an executive pricing memo choosing:\nOption A: Execute shrinkflation: downsize the pack from 500g to 380g while preserving the ₦1,200 retail price point, protecting gross margin with minimal packaging tooling costs.\nOption B: Keep the 500g pack at ₦1,200 as a loss leader, but invest ₦45 million in high-speed form-fill-seal packaging to launch an ultra-affordable 120g single-use sachet for ₦350 targeted at mass consumers.",
        'reference' => ['company' => 'Multinational Consumer Goods Manufacturers', 'precedent' => 'SKU resizing, shrinkflation, and packaging tiering during inflation cycles.'],
        'difficulty' => 'intermediate',
    ],
    [
        'ind_slug' => 'fmcg',
        'title' => 'Distributor Trade Credit Insolvency: ₦340m Overdue Debt vs Cash-and-Carry Transition',
        'body' => "You are the Chief Financial Officer of a beverage and snack manufacturer. Your 8 largest regional distributors in Onitsha, Kano, and Aba hold ₦340 million in 60-day overdue receivables. Due to commercial bank lending rates hitting 32%, distributors cannot obtain bank overdrafts to pay down their balances without facing bankruptcy.\n\nEXECUTIVE DIRECTIVE: Present your credit recovery directive:\nOption A: Offer an aggressive 5% cash-settlement discount to distributors who clear their backlog within 14 days, transitioning all future orders to strict cash-and-carry terms.\nOption B: Convert ₦180 million of the overdue debt into preference equity in the distributors' regional warehousing hubs, granting board oversight and direct custody of inventory until sales clear.",
        'reference' => ['company' => 'National Beverage & Snack Manufacturers', 'precedent' => 'Wholesale distributor credit default cycles and working capital restructuring.'],
        'difficulty' => 'intermediate',
    ],
    [
        'ind_slug' => 'fmcg',
        'title' => 'Cassava Starch Sourcing Substitution: ₦85m FX Savings vs 20% Shelf-Life Variance',
        'body' => "You are the Supply Chain Vice President of a listed food seasonings company. Replacing imported corn starch with locally refined cassava starch from Oyo State will eliminate $180,000 in monthly FX imports (saving ₦85 million quarterly). However, microbiological testing shows that local cassava starch creates a 20% variance in product shelf-life and moisture resistance.\n\nEXECUTIVE DIRECTIVE: Decide your procurement strategy:\nOption A: Fully transition to 100% domestic cassava starch, spending ₦35 million on specialized moisture-barrier laminate packaging to maintain official 18-month product expiry dates.\nOption B: Adopt a hybrid 50/50 blend of imported and local starch, reducing FX expenditure by half while ensuring existing packaging specifications remain compliant without capex.",
        'reference' => ['company' => 'Packaged Food & Seasoning Manufacturers', 'precedent' => 'Backward integration and industrial agro-processing raw material substitution.'],
        'difficulty' => 'intermediate',
    ],

    // 5. FX & External Reserves
    [
        'ind_slug' => 'fx-reserves',
        'title' => 'Letters of Credit Refinancing: Treasury Bill Liquidation vs 8% Extension Penalty',
        'body' => "You are the Head of Corporate Treasury for an industrial importer. A confirmed commercial Letter of Credit (LC) for $1.2 million expires in 10 business days. Your correspondent offshore bank refuses to roll over the facility without 100% upfront cash collateral. The official NAFEM market is experiencing a temporary 7-day liquidity clearance backlog.\n\nEXECUTIVE DIRECTIVE: Formulate a treasury liquidity plan choosing between:\nOption A: Prematurely liquidate ₦2.1 billion of 364-day Treasury Bills from your held-for-trading portfolio at a ₦95 million capital loss to buy immediate spot FX in the autonomous market.\nOption B: Request a 60-day LC maturity extension from the offshore bank, accepting a punitive 8% penalty interest spread ($96,000) while waiting for formal CBN window allocation.",
        'reference' => ['company' => 'Industrial Importers & Corporate Treasuries', 'precedent' => 'Letter of Credit cash collateralization and secondary bond portfolio liquidation.'],
        'difficulty' => 'intermediate',
    ],
    [
        'ind_slug' => 'fx-reserves',
        'title' => 'Diaspora Remittance Fee War: Slashed Commissions vs Premium Savings Yield',
        'body' => "You are the Managing Director of an international Money Transfer Operator (IMTO) licensed by the CBN. A well-funded global fintech rival has cut UK-to-Nigeria remittance fees to 0.2% with a ₦15/USD cashback incentive, causing your outbound transaction volume to drop 24% over 3 weeks.\n\nEXECUTIVE DIRECTIVE: Present your competitive strategy directive:\nOption A: Match the competitor fee cut and offer a ₦12/USD incentive, protecting market share but burning ₦42 million in operating margins over the next quarter.\nOption B: Partner with a Tier-1 Nigerian commercial bank to launch a high-yield USD Diaspora Fixed Deposit paying 9.5% annual interest, pivoting your value proposition from cheap transfers to wealth accumulation.",
        'reference' => ['company' => 'Licensed International Money Transfer Operators (IMTO)', 'precedent' => 'Cross-border remittance pricing battles and high-yield diaspora deposit acquisition.'],
        'difficulty' => 'intermediate',
    ],
    [
        'ind_slug' => 'fx-reserves',
        'title' => 'Non-Oil Export Rebate Claim Delay: ₦75m Cash Gap vs 18% Factoring Discount',
        'body' => "You are the Finance Director of an agricultural export company shipping processed cashew nuts to Vietnam. You have accumulated ₦75 million in verified CBN Non-Oil Export Expansion Scheme rebate claims, but administrative verification delays have held up disbursement for 5 months. Your local processing plant needs ₦50 million by Friday to pay raw nut suppliers.\n\nEXECUTIVE DIRECTIVE: Determine the receivables financing directive:\nOption A: Factor the ₦75 million sovereign rebate claim to a specialized trade finance bank at an 18% discount, receiving ₦61.5 million in immediate cash to keep processing operations running.\nOption B: Refuse the factoring discount and take a 30-day commercial overdraft at 29% interest, maintaining full claim entitlement while lobbying for regulatory release.",
        'reference' => ['company' => 'Non-Oil Agricultural Export Enterprises', 'precedent' => 'Export Expansion Grant (EEG) receivables factoring and supply chain working capital.'],
        'difficulty' => 'intermediate',
    ],

    // 6. Healthcare & Pharma
    [
        'ind_slug' => 'healthcare',
        'title' => 'Cold-Chain Vaccine Power Grid Tripping: Emergency Transfer vs Lithium-Ion UPS',
        'body' => "You are the Chief Operating Officer of a national pharmaceutical distribution centre storing ₦140 million of temperature-sensitive pediatric vaccines and oncology treatments. Due to recurring industrial substation grid trips, your primary 250kVA diesel backup generator has suffered alternator failure twice in 48 hours, causing cold room temperatures to climb near the 8°C critical safety threshold.\n\nEXECUTIVE DIRECTIVE: Execute an immediate risk directive deciding between:\nOption A: Order emergency refrigerated truck transfer to a third-party cGMP warehouse in Ikeja at ₦6.5 million transport and handling cost, risking potential temperature excursion during loading.\nOption B: Dispatch an emergency procurement team to purchase and commission a containerized 100kWh industrial lithium-ion UPS battery bank for ₦38 million within 12 hours.",
        'reference' => ['company' => 'National Vaccine Distribution Hubs & Pharma Distributors', 'precedent' => 'Cold-chain integrity management and backup power resilience in healthcare storage.'],
        'difficulty' => 'intermediate',
    ],
    [
        'ind_slug' => 'healthcare',
        'title' => 'State Health Insurance Tariff Squeeze: ₦65k Reimbursement vs ₦110k Actual Cost',
        'body' => "You are the Chief Medical Director of a 120-bed private tertiary hospital in Ibadan. The State Social Health Insurance Agency reimburses standard surgical procedures at a flat statutory rate of ₦65,000. However, inflation in imported surgical suture, anaesthetics, and Band-A power tariffs has pushed actual procedure costs to ₦110,000. Public insurance enrollees account for 45% of your total patient intake.\n\nEXECUTIVE DIRECTIVE: Formulate a financial and ethical directive selecting:\nOption A: Introduce a formal statutory co-payment policy charging patients ₦35,000 for supplementary consumables, risking state agency sanctions but preserving hospital operating viability.\nOption B: Maintain strict compliance with state tariffs, but cap public insurance admissions at 15% of bed capacity and cross-subsidize losses by raising rates on private corporate HMO clients.",
        'reference' => ['company' => 'Private Tertiary Hospitals & Health Insurance Operators', 'precedent' => 'Universal healthcare reimbursement deficits and hospital cost cross-subsidization.'],
        'difficulty' => 'intermediate',
    ],
    [
        'ind_slug' => 'healthcare',
        'title' => 'NAFDAC Chemical Testing Mandate: ₦25m Batch Inspection vs Quality Consortium',
        'body' => "You are the Quality Assurance Director of an indigenous pharmaceutical manufacturer producing generic antimalarials. A new NAFDAC regulatory mandate requires independent batch chemical spectrum testing for all imported Active Pharmaceutical Ingredients (APIs), costing ₦25 million per quarterly shipment and adding 14 days to manufacturing lead times.\n\nEXECUTIVE DIRECTIVE: Submit an executive regulatory strategy:\nOption A: Form a quality testing consortium with three other local pharma manufacturers to co-fund an accredited in-country testing laboratory, reducing testing overhead by 60% over 2 years.\nOption B: Pass the full ₦25 million testing cost into the wholesale price of finished antimalarial packs (+₦120 per pack), risking consumer market share against imported Indian generics.",
        'reference' => ['company' => 'Indigenous Pharmaceutical Manufacturers Association', 'precedent' => 'Regulatory compliance overhead, laboratory syndication, and retail medicine pricing.'],
        'difficulty' => 'intermediate',
    ],

    // 7. Manufacturing & Industry
    [
        'ind_slug' => 'manufacturing',
        'title' => 'Industrial Gas Pressure Curtailment: ₦2.4m Daily Diesel Burn vs Line B Shutdown',
        'body' => "You are the Plant General Manager of a ceramic tile factory in Ogun State producing 22,000 square meters daily. The regional gas pipeline operator has declared a 50% pressure curtailment due to upstream maintenance for 14 days. Tile firing kilns cannot drop below 1,150°C without permanent ceramic fracture and kiln refractory lining damage.\n\nEXECUTIVE DIRECTIVE: Issue an operational crisis mandate choosing between:\nOption A: Fire auxiliary dual-fuel diesel burners at an additional expense of ₦2.4 million daily (₦33.6m total), keeping 100% of manufacturing capacity operational.\nOption B: Completely shut down Production Line B, concentrating available gas on Line A to run at 60% capacity while placing Line B workers on 50% paid maintenance leave.",
        'reference' => ['company' => 'Ceramic & Building Materials Manufacturing Plants', 'precedent' => 'Industrial natural gas supply disruptions and high-cost dual-fuel diesel substitution.'],
        'difficulty' => 'intermediate',
    ],
    [
        'ind_slug' => 'manufacturing',
        'title' => 'Apapa Port Spare Parts Demurrage: ₦15m Facilitation Fee vs Ministerial Escalation',
        'body' => "You are the Head of Procurement for an automotive assembly plant in Kaduna. Fourteen shipping containers holding specialized robotic welding components and gearboxes have been delayed at Tin Can Island Port for 19 days due to customs server software migration. Shipping line demurrage and terminal storage fees are accruing at $1,400 daily (over ₦2.3m/day).\n\nEXECUTIVE DIRECTIVE: Decide your customs clearance strategy:\nOption A: Pay an accredited clearing agent a ₦15 million fast-track corridor facilitation fee to immediately release and dispatch the containers within 36 hours.\nOption B: File an emergency petition through the Manufacturers Association of Nigeria (MAN) to the Federal Ministry of Marine and Blue Economy requesting a statutory waiver of demurrage, accepting a 10-day delay.",
        'reference' => ['company' => 'Automotive & Heavy Equipment Assembly Plants', 'precedent' => 'Seaport container demurrage traps and institutional manufacturing intervention.'],
        'difficulty' => 'intermediate',
    ],
    [
        'ind_slug' => 'manufacturing',
        'title' => 'Cement Kiln Biomass Retrofit: ₦850m Green Bond vs 18-Month Phased Cash Outlay',
        'body' => "You are the Chief Sustainability Officer of an industrial cement producer. Your factory consumes ₦480 million monthly in imported low-pour fuel oil (LPFO) to fire its cement kilns. Retrofitting both kilns to co-fire with local agricultural biomass (rice husks and palm kernel shells) will slash thermal fuel expenditure by 42% but requires ₦850 million in capital equipment.\n\nEXECUTIVE DIRECTIVE: Choose your financing and execution strategy:\nOption A: Issue a ₦850 million 3-year Green Infrastructure Bond on FMDQ at 16.5% interest, completing the full engineering retrofit in 4 months.\nOption B: Fund the retrofit gradually using monthly operating cash flow across 18 months, converting Kiln 1 first and delaying Kiln 2 until organic savings materialize.",
        'reference' => ['company' => 'Heavy Industrial Cement & Clinker Manufacturers', 'precedent' => 'Alternative fuel thermal conversion (biomass/coal) and green bond capital financing.'],
        'difficulty' => 'intermediate',
    ],

    // 8. Monetary Policy & CBN
    [
        'ind_slug' => 'monetary-policy',
        'title' => 'Merchant Bank CRR Debit Shock: ₦4.5bn Interbank Deficit vs 34% SLF Rate',
        'body' => "You are the Chief Risk Officer of an investment and merchant bank. The Central Bank of Nigeria has executed an unannounced Cash Reserve Ratio (CRR) debit of ₦18 billion against your liquid reserves to enforce monetary tightening, leaving your clearing account with an end-of-day deficit of ₦4.5 billion. Overnight interbank lending rates have surged to 34%.\n\nEXECUTIVE DIRECTIVE: Issue a treasury liquidity directive selecting:\nOption A: Access the CBN Standing Lending Facility (SLF) window at MPR + 500 bps (31.75%), providing sovereign bonds as repo collateral to bridge the overnight deficit.\nOption B: Sell ₦5 billion in 180-day Treasury Bills from your held-for-trading book into the secondary market at a 40 bps discount, eliminating debt borrowing costs but taking an immediate ₦28 million mark-to-market loss.",
        'reference' => ['company' => 'Licensed Merchant Banks & Primary Dealers', 'precedent' => 'Central Bank CRR debit sweeps and liquidity management at the discount window.'],
        'difficulty' => 'intermediate',
    ],
    [
        'ind_slug' => 'monetary-policy',
        'title' => 'Bureau De Change ₦2bn Recapitalization: Regional Merger vs PE Buyout',
        'body' => "You are the Chairman and Principal Shareholder of a licensed Bureau De Change (BDC) in Lagos. A new Central Bank regulatory circular mandates all Tier-1 BDC operators to increase paid-up capital from ₦35 million to ₦2 billion within 90 days. Your current shareholder equity stands at ₦650 million, leaving a ₦1.35 billion shortfall.\n\nEXECUTIVE DIRECTIVE: Submit your recapitalization resolution:\nOption A: Merge with two prominent regional BDC operators in Abuja and Port Harcourt to pool capital and reach ₦2.1 billion, diluting your equity ownership to 31% while retaining a co-chairman seat.\nOption B: Sell a 60% controlling interest to an offshore private equity fintech syndicate for ₦1.4 billion, surrendering operational control in exchange for modern algorithmic FX trading rails.",
        'reference' => ['company' => 'Licensed Bureau De Change (BDC) Operators', 'precedent' => 'Central bank capital recapitalization thresholds and consolidation waves.'],
        'difficulty' => 'intermediate',
    ],
    [
        'ind_slug' => 'monetary-policy',
        'title' => 'CBN E-Invoicing Benchmark Discrepancy: 15% Price Cap vs Port Supply Hold',
        'body' => "You are the Corporate Affairs and Treasury Director for a heavy equipment distributor. The CBN automated Electronic Invoicing portal has flagged and rejected your $850,000 spare parts import invoice, alleging that the foreign OEM price is 15% higher than international median benchmarks. 8 critical mining excavators are stuck at the port awaiting custom duty clearance.\n\nEXECUTIVE DIRECTIVE: Formulate your regulatory resolution plan:\nOption A: Demand an urgent administrative review with the CBN Trade and Exchange Department, submitting verified OEM engineering certification and third-party valuation appraisals (7-day turnaround).\nOption B: Request the overseas manufacturer to restructure the invoice to match the CBN benchmark ceiling, reallocating the remaining 15% into a post-delivery technical maintenance contract.",
        'reference' => ['company' => 'Heavy Machinery & Mining Equipment Importers', 'precedent' => 'CBN e-invoicing benchmark price compliance and global supplier contract restructuring.'],
        'difficulty' => 'intermediate',
    ],

    // 9. Oil, Gas & Energy
    [
        'ind_slug' => 'energy',
        'title' => 'Naira-for-Crude Supply Allocation Shortfall: 65% Capacity vs Spot Dollar Import',
        'body' => "You are the Chief Strategy Officer of a 60,000 bpd private modular refinery in the Niger Delta. Under the Federal Government's Naira-for-Crude framework, your monthly allocation is 1.8 million barrels, but due to upstream pipeline vandalism, the state oil company delivers only 1.1 million barrels. Your refinery runs at only 61% utilization, raising unit refining costs.\n\nEXECUTIVE DIRECTIVE: Present your crude optimization plan:\nOption A: Procure the remaining 700,000 barrels from international maritime tankers at global Brent spot rates in US Dollars, raising operating throughput to 100% while taking on currency exposure.\nOption B: Maintain operations at 61% capacity on domestic crude only, prioritizing high-margin diesel and aviation fuel while temporarily suspending production of low-margin naphtha.",
        'reference' => ['company' => 'Domestic Modular Refineries & Upstream Crude Suppliers', 'precedent' => 'Naira-for-crude allocation logistics and refining yield optimization.'],
        'difficulty' => 'intermediate',
    ],
    [
        'ind_slug' => 'energy',
        'title' => 'Depot Petroleum Trucking Logjam: ₦35m Demurrage vs Marine Barge Routing',
        'body' => "You are the Head of Downstream Logistics for a retail fuel marketing company managing 210 filling stations. A severe road corridor logjam outside the Apapa depot complex has stranded 380 tanker trucks for 5 days, accumulating ₦35 million in truck detention fees and threatening retail station stockouts across the Southwest.\n\nEXECUTIVE DIRECTIVE: Execute your downstream supply directive:\nOption A: Charter 2 coastal petroleum barges to transport 10 million liters of fuel from Apapa to secondary storage depots in Ikorodu and Warri at an incremental cost of ₦4.20 per liter.\nOption B: Partner with state traffic management authorities to introduce a 24-hour electronic depot time-slot scheduling system, clearing the truck bottleneck over 72 hours without marine freight overhead.",
        'reference' => ['company' => 'Major Oil Marketers Association of Nigeria (MOMAN)', 'precedent' => 'Downstream petroleum depot logistics, coastal barging, and road congestion mitigation.'],
        'difficulty' => 'intermediate',
    ],
    [
        'ind_slug' => 'energy',
        'title' => 'Marginal Field Community Flow Station Blockade: PIA Trust Fund vs Escort Security',
        'body' => "You are the Operations Director of an indigenous upstream oil operator producing 5,500 barrels per day. Protesting youth from the host community have erected a blockade at your primary manifold flow station, demanding an immediate disbursement of ₦120 million for community projects. Every day of shut-in costs $385,000 in lost gross revenue.\n\nEXECUTIVE DIRECTIVE: Deliver a crisis resolution strategy choosing between:\nOption A: Accelerate the establishment and initial funding of the Host Community Development Trust (HCDT) under the Petroleum Industry Act (PIA), placing ₦60 million in escrow to safely resume output.\nOption B: Request the Federal Joint Task Force to clear the manifold perimeter under statutory critical national infrastructure provisions, restoring operations immediately while risking long-term community relations.",
        'reference' => ['company' => 'Indigenous Upstream Exploration & Production Operators', 'precedent' => 'Host Community Development Trust (HCDT) governance under the Petroleum Industry Act.'],
        'difficulty' => 'intermediate',
    ],

    // 10. Real Estate & Infrastructure
    [
        'ind_slug' => 'real-estate',
        'title' => 'Pre-Sale Escrow Milestone Lock: ₦1.8bn Capital Hold vs 28% Mezzanine Loan',
        'body' => "You are the Managing Director of a commercial real estate development firm building a 14-story mixed-use tower in Ikoyi. You have secured ₦1.8 billion in pre-sale deposits, but under bank escrow regulations, funds cannot be released until the independent quantity surveyor certifies 40% structural completion. Current physical completion is at 33% and operating working capital is exhausted.\n\nEXECUTIVE DIRECTIVE: Decide your project financing directive:\nOption A: Take a ₦350 million 90-day mezzanine bridge loan from a private debt fund at 28% annualized interest to finish the remaining 7% construction and unlock the ₦1.8 billion escrow.\nOption B: Offer off-plan buyers a 6% cash discount if they sign an addendum waiving the escrow lock for early milestone disbursements, preserving equity without taking on expensive debt.",
        'reference' => ['company' => 'Commercial High-Rise Real Estate Developers', 'precedent' => 'Escrow milestone compliance and mezzanine debt bridge financing in prime property.'],
        'difficulty' => 'intermediate',
    ],
    [
        'ind_slug' => 'real-estate',
        'title' => 'Coastal Highway Right-of-Way Buffer: Injunction vs Statutory Negotiation',
        'body' => "You are the Chief Investment Officer of a real estate investment trust (REIT) owning a newly commissioned ₦4.2 billion beachfront retail and entertainment promenade. The Ministry of Works issues a 21-day notice indicating that the expanded right-of-way alignment for the Lagos-Calabar Coastal Highway requires demolishing your 45-vehicle front car park and seaside boardwalk.\n\nEXECUTIVE DIRECTIVE: Select your corporate legal and asset preservation strategy:\nOption A: File an urgent judicial review seeking an ex-parte interlocutory injunction to halt acquisition and propose a 10-meter road realignment, protecting footfall but risking hostile regulatory relations.\nOption B: Immediately enter structured statutory negotiations with the Federal Land Compensation Board, seeking ₦650 million in fair market value restitution and expedited planning approval for a multi-level rear parking deck.",
        'reference' => ['company' => 'Institutional Real Estate Investment Trusts (REITs)', 'precedent' => 'Eminent domain right-of-way acquisitions and statutory property compensation negotiation.'],
        'difficulty' => 'intermediate',
    ],
    [
        'ind_slug' => 'real-estate',
        'title' => 'Mortgage Bank Fixed vs Floating Squeeze: ₦12bn Loan Book vs Rate Revision Clause',
        'body' => "You are the Managing Director of a licensed Primary Mortgage Bank (PMB). Your asset book holds ₦12 billion in 15-year residential mortgages yielding an average fixed interest rate of 16.5%. Due to aggressive monetary policy rate hikes, your commercial bank borrowing costs have climbed to 21.0%, resulting in a negative net interest margin of -4.5%.\n\nEXECUTIVE DIRECTIVE: Submit your balance sheet preservation strategy:\nOption A: Securitize and package ₦6 billion of performing mortgages into Residential Mortgage-Backed Securities (RMBS) for sale to institutional pension funds on FMDQ, raising liquid cash to retire expensive commercial debt.\nOption B: Invoke the contractual Variable Interest Rate Adjustment clause on your retail borrowers, raising mortgage rates from 16.5% to 22.0% across the board while anticipating a potential 12% rise in default rates.",
        'reference' => ['company' => 'Licensed Primary Mortgage Banks (PMB) & Mortgage Refinance Companies', 'precedent' => 'Mortgage asset-liability mismatch, securitization, and variable interest rate adjustments.'],
        'difficulty' => 'intermediate',
    ],

    // 11. Telecoms & Tech Infrastructure
    [
        'ind_slug' => 'telecoms',
        'title' => 'Right-of-Way State Infrastructure Tariff: ₦220m Back-Tax vs Microwave Failover',
        'body' => "You are the Chief Regulatory Officer of a national telecommunications infrastructure operator. A state government infrastructure agency has served a 48-hour enforcement warrant demanding ₦220 million in disputed Right-of-Way (RoW) retrospective levies, threatening to physically disconnect your metropolitan fiber optic backbone carrying 40Gbps of corporate traffic.\n\nEXECUTIVE DIRECTIVE: Choose your regulatory and technical response:\nOption A: Pay a 30% good-faith statutory deposit (₦66 million) under protest and petition the Nigerian Communications Commission (NCC) and Federal Ministry of Communications for emergency intervention.\nOption B: Fail over critical data traffic to a secondary high-capacity wireless microwave mesh network, bypassing state fiber corridors while accepting a 25ms latency increase for corporate clients.",
        'reference' => ['company' => 'National Fiber Optic Infrastructure Carriers', 'precedent' => 'Sub-national Right-of-Way (RoW) tax disputes and redundant microwave transmission failover.'],
        'difficulty' => 'intermediate',
    ],
    [
        'ind_slug' => 'telecoms',
        'title' => 'Tier-4 Data Center Diesel Depletion: Critical Cooling Load Shedding vs Emergency Dispatch',
        'body' => "You are the Chief Facilities Engineer of an uptime-certified Tier-4 commercial data centre in Victoria Island housing cloud nodes for 14 major commercial banks. A 72-hour continuous grid blackout has drained your 50,000-liter diesel storage tanks to 11% capacity. Heavy rainstorm traffic has delayed your contracted fuel resupply tanker by 6 hours.\n\nEXECUTIVE DIRECTIVE: Issue an immediate operational crisis directive:\nOption A: Shed non-critical facility air-conditioning in secondary offices and switch bank enterprise testing servers to standby mode, extending remaining generator run-time by 4 hours without violating production SLAs.\nOption B: Authorize an emergency police-escorted tanker dispatch from an alternative bonded terminal in Ikeja at a ₦14 million emergency spot premium, maintaining full facility cooling redundancy.",
        'reference' => ['company' => 'Colocation Tier-4 Commercial Data Centres', 'precedent' => 'Critical infrastructure power resilience, diesel supply chains, and server load shedding.'],
        'difficulty' => 'intermediate',
    ],
    [
        'ind_slug' => 'telecoms',
        'title' => 'Telecom SIM-NIN Automated Barring Wave: 1.4m Disconnected Lines & 18% Revenue Drop',
        'body' => "You are the Consumer Business Director of a mobile network operator with 42 million subscribers. A strict regulatory compliance deadline requires immediate barring of 1.4 million outgoing lines lacking verified National Identification Numbers (NIN). Financial modeling indicates that barring these subscribers will cause an immediate 18% drop in monthly voice and airtime recharge revenue.\n\nEXECUTIVE DIRECTIVE: Deliver a customer retention and compliance strategy:\nOption A: Deploy 250 mobile biometric registration field teams equipped with satellite kits to high-density commercial markets and rural clusters, targeting the re-activation of 600,000 lines within 14 days.\nOption B: Launch a lightweight WhatsApp and USSD self-service NIN verification channel offering an instant ₦500 airtime bonus upon automated verification, using digital channels to recapture active subscribers without field capex.",
        'reference' => ['company' => 'Mobile Network Operators (MNOs)', 'precedent' => 'SIM registration compliance, customer verification mandates, and automated biometric recapture.'],
        'difficulty' => 'intermediate',
    ],
];

$count = 0;
$rubricJson = json_encode(['financial_mechanics' => 40, 'risk_management' => 30, 'historical_alignment' => 20, 'communication' => 10]);

foreach ($scenarios as $sc) {
    // Check if title already exists
    $chk = $pdo->prepare("SELECT id FROM boardroom_scenarios WHERE title = ? LIMIT 1");
    $chk->execute([$sc['title']]);
    if ($chk->fetch()) {
        continue;
    }

    $indStmt = $pdo->prepare("SELECT id FROM industries WHERE slug = ? LIMIT 1");
    $indStmt->execute([$sc['ind_slug']]);
    $indId = $indStmt->fetchColumn();
    if (!$indId) {
        $indId = 1;
    }

    $scId = Security::uuid();
    $refJson = json_encode($sc['reference']);

    $ins = $pdo->prepare("
        INSERT INTO boardroom_scenarios 
            (id, industry_id, title, confidential_body, reference_case, rubric, difficulty, created_at)
        VALUES 
            (:id, :ind, :title, :body, :ref, :rubric, :diff, NOW(3))
    ");
    $ins->execute([
        ':id' => $scId,
        ':ind' => $indId,
        ':title' => $sc['title'],
        ':body' => $sc['body'],
        ':ref' => $refJson,
        ':rubric' => $rubricJson,
        ':diff' => $sc['difficulty'],
    ]);

    $count++;
    echo " [+] Added [{$sc['ind_slug']}]: {$sc['title']}\n";
}

echo "\n[✓] Successfully added {$count} new sharp boardroom scenarios!\n";

