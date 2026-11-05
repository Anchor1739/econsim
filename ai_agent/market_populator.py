#!/usr/bin/env python3
"""
EconSim Behind-the-Hood Market Research & Populator Model
Automatically analyzes macroeconomic trends, searches economic catalysts,
and populates verified contracts, Study Contexts, metrics, and primary sources in MySQL.
Factors in all NGX public companies, power disruptions (Band-A tariffs, gas pipeline pressure,
grid collapses), supply chain frictions (port dwell times, demurrage, customs FX, haulage),
and margin compression across Nigerian and African bourses.
"""

import os
import sys
import json
import uuid
import tempfile
import requests
import mysql.connector
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

# Ensure safe UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("DB_PORT", "3306"))
DB_NAME = os.getenv("DB_NAME", "econsim")
DB_USER = os.getenv("DB_USER", "root")
DB_PASS = os.getenv("DB_PASSWORD", "")
DB_SSL_CA = os.getenv("DB_SSL_CA", "")
DB_SSL_CA_CONTENT = os.getenv("DB_SSL_CA_CONTENT", "")

NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL") or "meta/llama-3.1-70b-instruct"
NVIDIA_API_URL = os.getenv("NVIDIA_API_URL", "https://integrate.api.nvidia.com/v1")

# Full list of professional industries
CORE_INDUSTRIES = [
    ("monetary-policy", "Monetary Policy & CBN"),
    ("capital-markets", "Equities & Capital Markets"),
    ("fx-reserves", "FX & External Reserves"),
    ("fintech", "Fintech & Digital Payments"),
    ("energy", "Oil, Gas & Energy"),
    ("agriculture", "Agriculture & Food Security"),
    ("manufacturing", "Manufacturing & Industry"),
    ("fmcg", "FMCG & Retail"),
    ("real-estate", "Real Estate & Infrastructure"),
    ("telecoms", "Telecoms & Tech Infrastructure"),
    ("healthcare", "Healthcare & Pharma"),
]

# Comprehensive macroeconomic, corporate & disruption catalysts
ECONOMIC_CATALYSTS = [
    {
        "industry": "monetary-policy",
        "title": "Will the Central Bank of Nigeria raise the MPR by at least 50 bps at the upcoming MPC meeting?",
        "slug": "cbn-mpr-hike-50bps",
        "definition": "Resolves YES if the published CBN Monetary Policy Committee communiqué officially raises the Monetary Policy Rate (MPR) by 50 basis points or higher above the preceding benchmark.",
        "source": "Central Bank of Nigeria (CBN) Official MPC Communiqué (cbn.gov.ng)",
        "days": 45,
        "metrics": [
            ["Headline vs Core CPI Spread", "Measures food and energy volatility relative to structural underlying inflation."],
            ["Currency Stabilization Pressure", "Naira exchange rate volatility increases pressure for restrictive policy."],
            ["Banking System Liquidity", "CRR debits and interbank lending rates reflect actual policy transmission."],
            ["Real Interest Rate Gap", "Targeting positive real yields to attract Foreign Portfolio Investment (FPI)."]
        ],
        "history": "In 2024, the MPC increased the policy rate past 26% to curb inflation and narrow the negative real interest rate corridor.",
    },
    {
        "industry": "fx-reserves",
        "title": "Will Nigeria's official gross foreign exchange reserves exceed $40 Billion before year-end 2026?",
        "slug": "nigeria-fx-reserves-40b",
        "definition": "Resolves YES if the CBN official 30-day moving average gross external reserves data published on the CBN website reaches or exceeds USD 40,000,000,000 on or before December 31, 2026.",
        "source": "CBN Official External Reserves Daily Statistics",
        "days": 70,
        "metrics": [
            ["Crude Oil Output & Lifting", "NNPC joint venture production, condensate output, and prompt dollar repatriation."],
            ["Diaspora Remittance Inflows", "Growth of formal autonomous remittances through IMTO corridors."],
            ["Eurobond & Multilateral Inflows", "Disbursements from World Bank, AfDB, and commercial debt offerings."],
            ["CBN FX Market Interventions", "Net sales versus net purchases in the Nigerian Autonomous Foreign Exchange Market (NAFEM)."]
        ],
        "history": "Reserves hit a multi-year high in late 2024 following crude recovery and cleared forward backlog obligations.",
    },
    {
        "industry": "capital-markets",
        "title": "Will the NGX All-Share Index (ASI) cross the 120,000-point milestone before Q1 2027?",
        "slug": "ngx-asi-120k-milestone",
        "definition": "Resolves YES if the official Nigerian Exchange All-Share Index (NGX ASI) closes at or above 120,000.00 points on any regular trading day before March 31, 2027.",
        "source": "Nigerian Exchange Group (NGX) Daily Official Market Summary (ngxgroup.com)",
        "days": 90,
        "metrics": [
            ["Corporate Earnings Growth", "Financial performance of Tier-1 banks, telcos, and industrial heavyweights."],
            ["Domestic Institutional Liquidity", "Pension Fund Administrators (PFA) asset allocation towards equity securities."],
            ["Foreign Portfolio Participation", "Offshore investor sentiment and FX repatriation liquidity."],
            ["Yield Curve Dynamics", "Treasury bill yields competing with stock market dividend yields."]
        ],
        "history": "The NGX crossed 100,000 points in early 2024 driven by bank recapitalization expectations and strong consumer goods performance.",
    },
    {
        "industry": "fintech",
        "title": "Will Nigeria's NIBSS instant payment transaction volume expand by over 30% year-on-year?",
        "slug": "nibss-instant-payments-growth",
        "definition": "Resolves YES if the annual electronic payment data published by the Nigeria Inter-Bank Settlement System (NIBSS) shows total NIP volume growth equal to or exceeding 30.0% compared to the prior year.",
        "source": "NIBSS Official Electronic Payments Statistical Factsheet",
        "days": 60,
        "metrics": [
            ["Agency Banking Distribution", "Expansion of POS agent networks in peri-urban and rural trade hubs."],
            ["Mobile App & USSD Penetration", "Smartphone adoption and transaction uptime among digital banks."],
            ["Payment Service Banks (PSB)", "Telco-led mobile money adoption and cross-border wallet interoperability."],
            ["Cash Circulation Ratios", "Currency outside banks versus total money supply (M3)."]
        ],
        "history": "Digital payments surged rapidly during cash-scarcity periods, permanently shifting consumer payment habits to electronic rails.",
    },
    {
        "industry": "energy",
        "title": "Will Dangote Petroleum Refinery achieve sustained export volume of refined diesel to West African ports?",
        "slug": "dangote-refinery-regional-exports",
        "definition": "Resolves YES if official maritime tracking and customs shipment disclosures confirm at least 500,000 metric tons of refined Euro-V diesel exported across ECOWAS destinations in a single quarter.",
        "source": "Nigerian Midstream and Downstream Petroleum Regulatory Authority (NMDPRA) & S&P Global Commodities",
        "days": 80,
        "metrics": [
            ["Domestic Crude Supply Agreements", "Naira-for-crude supply framework execution with NNPC Limited."],
            ["Secondary Refining Unit Efficiency", "RFCC and hydrocracker operating throughput rates."],
            ["Regional Port Logistics", "Coastal charter vessel availability and maritime off-taking terms in Ghana, Togo, and Benin."],
            ["Arbitrage Spreads", "Import parity pricing comparisons versus European and Asian refined product imports."]
        ],
        "history": "Refinery commissioning in 2024 marked a structural transition for Nigerian energy trade from net refined importer to regional supplier.",
    },
    {
        "industry": "manufacturing",
        "title": "Will local manufacturing capacity utilization improve above 60% according to the MAN survey?",
        "slug": "manufacturers-association-utilization-60",
        "definition": "Resolves YES if the bi-annual Economic Review of the Manufacturers Association of Nigeria (MAN) records average industrial capacity utilization equal to or higher than 60.0%.",
        "source": "Manufacturers Association of Nigeria (MAN) Executive Economic Review",
        "days": 100,
        "metrics": [
            ["Industrial Power Reliability", "Band-A electricity tariff impacts and captive gas power plant operations."],
            ["Local Raw Material Sourcing", "Backward integration programs in agro-allied, packaging, and chemical inputs."],
            ["Import Port Clearance Times", "Customs modernization and port corridor demurrage costs in Apapa and Lekki."],
            ["Financing Costs", "Prime lending rates and Bank of Industry (BOI) single-digit concessionary facilities."]
        ],
        "history": "Manufacturing utilization faced severe headwinds from FX depreciation in 2023-2024, prompting widespread push for domestic raw material substitution.",
    },
    {
        "industry": "telecoms",
        "title": "Will 5G network coverage reach at least 25% of urban population centres in Nigeria?",
        "slug": "telecom-5g-coverage-25pct",
        "definition": "Resolves YES if official Nigerian Communications Commission (NCC) broadband performance data verifies 5G active coverage spanning at least 25% of state capitals and tier-1 commercial cities.",
        "source": "Nigerian Communications Commission (NCC) Broadband Monitoring Portal",
        "days": 120,
        "metrics": [
            ["Fiber-to-the-Tower Deployments", "Metropolitan fiber optic buildout and right-of-way (RoW) harmonization."],
            ["Capex Investment in 3.5GHz Base Stations", "Foreign exchange allocation for radio access network equipment."],
            ["5G Smartphone Affordability", "Availability of sub-$100 5G smartphones in consumer electronics retail."],
            ["Enterprise Use Cases", "Private 5G networks in fintech data centers, manufacturing hubs, and deep seaport logistics."]
        ],
        "history": "Commercial 5G launched in 2022-2023 by MTN and Airtel, focusing initially on metropolitan business districts.",
    },
    {
        "industry": "fmcg",
        "title": "Will Nestle Nigeria (NESTLE) achieve positive full-year operating profit following local grain & packaging substitution above 70%?",
        "slug": "nestle-nigeria-operating-profit-recovery",
        "definition": "Resolves YES if audited full-year financial statements of Nestle Nigeria Plc published on the NGX confirm positive operating profit (EBIT) exceeding ₦30 Billion.",
        "source": "Nigerian Exchange Group (NGX) Audited Financial Disclosures (ngxgroup.com)",
        "days": 120,
        "metrics": [
            ["Local Sourcing Ratio (Sorghum, Maize, Starch)", "Reducing dollar import bill for intermediate confectionery and cereal grains."],
            ["Packaging Glass & Aluminum Supply Chain Lead Times", "Domestic supplier contracts versus imported packaging materials."],
            ["Unhedged Parent Intercompany USD Debt", "Mitigating foreign exchange net financing charges on the balance sheet."],
            ["Price Elasticity Across Nutrition & Food Staples", "Consumer retention rates following product repackaging and resizing."]
        ],
        "history": "Multinational consumer goods manufacturers on the NGX faced severe currency translation shocks before aggressively prioritizing local agro-allied substitution.",
    },
    {
        "industry": "telecoms",
        "title": "Will MTN Nigeria (MTNN) restore positive shareholder equity within 4 reporting quarters following tower lease renegotiations?",
        "slug": "mtn-nigeria-equity-restoration",
        "definition": "Resolves YES if quarterly financial statements filed by MTN Nigeria Communications Plc on the NGX confirm positive total equity attributable to shareholders.",
        "source": "NGX Company Announcements & MTN Group Financial Reports",
        "days": 90,
        "metrics": [
            ["Tower Company Contract Indexation (IHS & ATC)", "Transition from dollar-indexed lease contracts to local currency pricing structures."],
            ["NCC Tariff Review Approvals for Voice and Data", "Regulatory permission for telecom operators to adjust consumer tariffs for inflation."],
            ["Base Station Diesel Fuel Operating Cost", "Solar hybrid battery retrofits reducing generator fuel costs across 20,000+ cell sites."],
            ["Fintech Mobile Money (MoMo PSB) Revenue Growth", "Expanding high-margin digital payment and merchant merchant fee transactions."]
        ],
        "history": "Unhedged USD lease obligations triggered negative accounting equity for telcos in 2023-2024, prompting structural contract overhauls.",
    },
    {
        "industry": "manufacturing",
        "title": "Will Dangote Cement (DANGCEM) achieve quarterly sales volume exceeding 7.5 Million Metric Tons despite interstate haulage costs and gas pipeline downtime?",
        "slug": "dangote-cement-7m-volume-sales",
        "definition": "Resolves YES if Dangote Cement Plc quarterly earnings report confirms combined Pan-African and Nigerian cement & clinker sales volume exceeding 7.50 million metric tons.",
        "source": "Dangote Cement Plc Published Financial Disclosures & NGX Filings",
        "days": 75,
        "metrics": [
            ["Captive Gas Pipeline Availability & Pressure", "Mitigating expensive low-pour fuel oil (LPFO) and coal substitution in cement kilns."],
            ["Dual-Fuel CNG Haulage Fleet Conversion Rate", "Lowering distribution logistics and diesel expenses across 10,000+ delivery trucks."],
            ["Export Terminal Clinker Shipments from Apapa & Onne", "Seaborne export volumes to West African coastal countries generating hard currency."],
            ["Public Infrastructure Budget Spending & Concrete Paving", "Federal Ministry of Works concrete road construction contracts."]
        ],
        "history": "Cement industrial capacity in Nigeria exceeds 50 million tons, but logistics haulage costs determine regional market profitability.",
    },
    {
        "industry": "capital-markets",
        "title": "Will at least 4 of Nigeria's Tier-1 international banking groups (FUGAZ) complete their CBN ₦500 Billion minimum recapitalization before the regulatory deadline?",
        "slug": "tier1-banks-recapitalization-500b",
        "definition": "Resolves YES if CBN banking supervision updates confirm at least 4 of the 5 Tier-1 international banking groups (Access, FBNH, GTCO, UBA, Zenith) have achieved the required ₦500 Billion paid-up capital and share premium.",
        "source": "Central Bank of Nigeria (CBN) Banking Supervision Department & NGX Corporate Actions",
        "days": 150,
        "metrics": [
            ["Rights Issues & Public Offer Subscription Rates", "Domestic retail and institutional absorption of equity offerings on the NGX."],
            ["Foreign Institutional Placement Allocation", "Offshore investor participation and international bookbuilding demand."],
            ["Cross-Listing Receipts (London LSE & Johannesburg JSE)", "Depositary receipt issuances supporting global capital raises."],
            ["Private Sector Loan Rationing vs High-Yield Treasury Bills", "Banks deploying capital into risk-free government securities over risky corporate loans."]
        ],
        "history": "The CBN issued a landmark recapitalization directive in 2024 to create a $1 Trillion economy banking foundation.",
    },
    {
        "industry": "agriculture",
        "title": "Will Presco Plc (PRESCO) declare an annual gross revenue exceeding ₦130 Billion driven by domestic crude palm oil deficits and port import tariffs?",
        "slug": "presco-cpo-revenue-130b",
        "definition": "Resolves YES if audited annual reports of Presco Plc published on the NGX confirm gross revenue equal to or exceeding ₦130,000,000,000.",
        "source": "NGX Annual Financial Disclosures & Presco Investor Relations",
        "days": 110,
        "metrics": [
            ["Crude Palm Oil (CPO) Farmgate Realized Price", "Domestic pricing commanding a premium over global Bursa Malaysia benchmarks."],
            ["Fresh Fruit Bunches (FFB) Plantation Yields", "Oil extraction rate (OER) efficiency across Edo and Delta state processing estates."],
            ["Port Customs Clearing Tariffs on Competing Edible Oils", "Tariff protections and FX restrictions on vegetable oil and olein imports."],
            ["Food Processing Industrial Off-Take Demand", "Industrial buying contracts from FMCG soap, biscuit, and instant noodle manufacturers."]
        ],
        "history": "Nigeria's domestic palm oil deficit exceeds 1 million metric tons annually, granting local plantation operators strong pricing power.",
    },
    {
        "industry": "energy",
        "title": "Will Seplat Energy (SEPLAT) average working interest crude and gas production above 65,000 boepd following the Mobil Producing asset integration?",
        "slug": "seplat-energy-production-65k-boepd",
        "definition": "Resolves YES if official operations updates of Seplat Energy Plc published on the NGX and London Stock Exchange (LSE) confirm average net working interest production exceeding 65,000 boepd.",
        "source": "Seplat Energy Operations Reports & Nigerian Upstream Petroleum Regulatory Commission (NUPRC)",
        "days": 85,
        "metrics": [
            ["Trans-Niger Pipeline (TNP) & Amukpe-Escravos Pipeline Uptime", "Alternative crude evacuation routes avoiding vandalism and barge theft."],
            ["Commercial Gas Offtake by National Grid Power Plants", "Sapele and ANOH gas processing facilities feeding domestic commercial power producers."],
            ["Crude Oil Theft Mitigation in Niger Delta Corridors", "Joint Task Force surveillance and automated pressure monitoring along trunk lines."],
            ["NUPRC Regulatory Clearance Approvals", "Ministerial consent and operational integration for offshore shallow-water joint ventures."]
        ],
        "history": "Indigenous exploration and production firms have acquired multi-billion-dollar divestment assets from international oil majors in the Niger Delta.",
    },
    # === NEW PUBLIC EQUITIES & DISRUPTION ENGINE CATALYSTS ===
    {
        "industry": "energy",
        "title": "Will Geregu Power (GEREGU) sustain over 700MW daily generation availability despite gas pipeline pressure curtailments and national grid trips?",
        "slug": "geregu-power-grid-generation",
        "definition": "Resolves YES if Nigerian Electricity Regulatory Commission (NERC) quarterly reports confirm Geregu Power Plc sustained average daily operational capacity exceeding 700MW across 2 consecutive quarters.",
        "source": "Nigerian Electricity Regulatory Commission (NERC) & NGX Operational Updates",
        "days": 90,
        "metrics": [
            ["Gas Supply Delivery Pressure (ELPS)", "Pipeline uptime along Escravos-Lagos Pipeline System feeding gas turbines."],
            ["Band-A Cost-Reflective Tariff Recovery", "DisCos collection efficiency remitting cash to bulk electricity trader (NBET)."],
            ["National Grid Blackout Frequency", "Transmission Company of Nigeria (TCN) system collapses forcing island-mode shutdowns."],
            ["Industrial Captive Power Off-Take", "Direct power purchase agreements with manufacturing clusters bypassing distribution bottlenecks."]
        ],
        "history": "Geregu Power was the first power generation company listed on the NGX main board, serving as the benchmark for privatized utility economics.",
    },
    {
        "industry": "fmcg",
        "title": "Will BUA Foods (BUAFOODS) maintain operating profit margin above 28% despite Apapa port raw sugar vessel demurrage and customs FX benchmark adjustments?",
        "slug": "bua-foods-port-demurrage-margin",
        "definition": "Resolves YES if audited financial results published on the NGX confirm BUA Foods Plc operating profit margin (EBIT margin) equal to or exceeding 28.0%.",
        "source": "Nigerian Exchange Group (NGX) Company Results & Shippers Council Port Reports",
        "days": 100,
        "metrics": [
            ["Port Container & Vessel Dwell Time", "Apapa and Tin Can Island berth clearance delays causing shipping demurrage fees."],
            ["Customs Duty FX Benchmark", "Exchange rate benchmark applied to bulk raw sugar and wheat import duties."],
            ["Interstate Bulk Haulage Diesel Cost", "Freight expense to transport flour and pasta to northern commercial hubs."],
            ["Backward Integration Sugar Estates", "Lafiagi Integrated Sugar Project yield replacing imported raw sugar."]
        ],
        "history": "BUA Foods is Nigeria's largest listed food producer by market capitalization, with integrated sugar, flour, and pasta milling complexes.",
    },
    {
        "industry": "capital-markets",
        "title": "Will Zenith Bank (ZENITHBANK) conclude its capital raise exceeding ₦500 Billion while keeping Capital Adequacy Ratio (CAR) above 20%?",
        "slug": "zenith-bank-500b-recapitalization",
        "definition": "Resolves YES if CBN banking supervision approvals verify Zenith Bank Plc paid-up capital exceeds ₦500 Billion with audited regulatory Capital Adequacy Ratio (CAR) at or above 20.0%.",
        "source": "Central Bank of Nigeria (CBN) Banking Supervision & NGX Filings",
        "days": 130,
        "metrics": [
            ["Rights Issue & Public Offer Uptake", "Subscription volume by Nigerian institutional PFAs and international funds."],
            ["Cash Reserve Ratio (CRR) Sterilization", "Impact of CBN mandatory cash debits on interest-earning liquid assets."],
            ["Net Interest Margin (NIM) Compression", "Rising deposit acquisition costs competing with 1-year Treasury bills."],
            ["Non-Performing Loan (NPL) Ratio", "Asset quality preservation amidst high corporate borrowing rates."]
        ],
        "history": "Zenith Bank is one of West Africa's tier-1 systemic banking groups, historically maintaining industry-leading returns on equity and capital buffers.",
    },
    {
        "industry": "manufacturing",
        "title": "Will BUA Cement (BUACEMENT) complete its 70MW captive LNG power plant in Kalambaina to achieve 100% off-grid energy self-sufficiency?",
        "slug": "bua-cement-captive-lng-power",
        "definition": "Resolves YES if BUA Cement quarterly operational filings on NGX verify commercial commissioning of the 70MW captive dual-fuel LNG power plant with over 90% fuel cost self-sufficiency.",
        "source": "NGX Corporate Announcements & BUA Cement Investor Relations",
        "days": 110,
        "metrics": [
            ["Captive Power Generation Uptime", "Insulating clinker kilns from national grid collapse and diesel generator volatility."],
            ["LNG Virtual Pipeline Haulage", "Specialized cryogenic tanker supply reliability from Niger Delta to Sokoto."],
            ["Interstate Cement Freight Cost", "Dual-fuel truck fleet conversion lowering transportation expense per bag."],
            ["Regional Export Revenue (Niger & Mali)", "Cross-border clinker and cement trade generating foreign exchange."]
        ],
        "history": "Operating in northern Nigeria requires full captive energy autonomy due to distance from primary natural gas trunk lines.",
    },
    {
        "industry": "energy",
        "title": "Will Transcorp Power (TRANSPOWER) achieve peak grid power generation exceeding 750MW following Afam gas turbine rehabilitation?",
        "slug": "transcorp-power-afam-generation",
        "definition": "Resolves YES if daily grid generation logs published by the National Control Centre (NCC) Osogbo verify Transcorp Power / Afam generating over 750MW into the national grid for 30 consecutive days.",
        "source": "National Control Centre (NCC) Generation Statistics & NGX Filings",
        "days": 80,
        "metrics": [
            ["Domestic Gas Supply Agreements (GSA)", "Firm gas delivery volumes from Niger Delta fields to Ughelli & Afam turbines."],
            ["NERC Multi-Year Tariff Order (MYTO)", "Cost-reflective tariff adjustments providing revenue certainty for GenCos."],
            ["Eligible Customer Direct Sales", "Supplying power directly to heavy industrial estates bypassing weak DisCo networks."],
            ["Foreign Exchange Maintenance Capex", "Procurement of specialized turbine replacement blades and control systems."]
        ],
        "history": "Transcorp Power listed on the NGX in 2024, representing approximately 12% of Nigeria's total installed electricity generation capacity.",
    },
    {
        "industry": "fmcg",
        "title": "Will Nigerian Breweries (NB) achieve positive operating profit by lifting domestic sorghum sourcing to 75% of raw grain input?",
        "slug": "nigerian-breweries-sorghum-75pct",
        "definition": "Resolves YES if Nigerian Breweries Plc full-year financial disclosures confirm positive operating profit (EBIT) alongside verified local grain sourcing of 75.0% or greater.",
        "source": "NGX Financial Disclosures & MAN Raw Material Sourcing Review",
        "days": 120,
        "metrics": [
            ["Local Sorghum & Malted Barley Substitution", "Reducing foreign currency import bills for brewing grains."],
            ["Glass Bottle Returnable Packaging Float", "Managing returnable glass inventory to counteract local packaging inflation."],
            ["Interstate Distribution Haulage Costs", "Fuel cost pass-through across regional warehousing and depot networks."],
            ["Consumer Price Elasticity in Premium Beers", "Volume retention following price increases in alcoholic and malt beverages."]
        ],
        "history": "Pioneering commercial agriculture partnerships have allowed Nigerian brewers to replace expensive imported European malt with local sorghum.",
    },
    {
        "industry": "manufacturing",
        "title": "Will Lafarge Africa (WAPCO) reach 50% thermal energy substitution with alternative biomass fuels across its Ewekoro and Sagamu kilns?",
        "slug": "lafarge-africa-alternative-fuel-50",
        "definition": "Resolves YES if Lafarge Africa Plc annual sustainability and financial disclosures report alternative fuel thermal substitution equal to or exceeding 50.0%.",
        "source": "Lafarge Africa Published Annual Report & NGX Filings",
        "days": 90,
        "metrics": [
            ["Agricultural Biomass & Industrial Waste Sourcing", "Replacing expensive coal, LPFO, and unstable gas supplies."],
            ["Kiln Thermal Energy Efficiency", "Reduction in heat consumption per metric ton of clinker produced."],
            ["Captive Solar Hybrid Integration", "On-site solar generation offsetting peak tariff grid power consumption."],
            ["Domestic Public Infrastructure Demand", "Supply contracts for concrete pavement highways and deep seaport breakwaters."]
        ],
        "history": "Lafarge Africa is a member of the Holcim Group and one of the oldest industrial building solutions providers in Nigeria.",
    },
    {
        "industry": "energy",
        "title": "Will Aradel Holdings (ARADEL) expand modular refinery output past 11,000 bpd while supplying domestic commercial fuel off-takers?",
        "slug": "aradel-holdings-refinery-throughput",
        "definition": "Resolves YES if Aradel Holdings Plc audited operational disclosures verify average refined petroleum output (AGO, DPK, ATK) exceeding 11,000 barrels per day.",
        "source": "Nigerian Upstream Petroleum Regulatory Commission (NUPRC) & NGX Announcements",
        "days": 85,
        "metrics": [
            ["Ogbele Modular Refinery Utilization", "Refining throughput across crude distillation units (CDU)."],
            ["Crude Oil Evacuation Barging vs Trunkline", "Alternative evacuation avoiding Trans-Niger Pipeline security downtime."],
            ["Domestic Industrial Diesel Direct Sales", "Bypassing import parity delays by supplying manufacturing and telco towers directly."],
            ["Domestic Gas Commercialization (GSA)", "Gas supply contracts to rural electrification and commercial power plants."]
        ],
        "history": "Aradel Holdings operates the Ogbele marginal field and pioneer modular refinery in the Niger Delta, listing on the NGX in 2024.",
    },
    {
        "industry": "healthcare",
        "title": "Will Fidson Healthcare (FIDSON) achieve 20% operating revenue growth after clearing Active Pharmaceutical Ingredient (API) customs bottlenecks?",
        "slug": "fidson-healthcare-api-revenue-20",
        "definition": "Resolves YES if Fidson Healthcare Plc audited financial statements show year-on-year revenue growth equal to or exceeding 20.0%.",
        "source": "NGX Financial Statements & National Agency for Food and Drug Administration and Control (NAFDAC)",
        "days": 100,
        "metrics": [
            ["Port Clearance Lead Time on Imported APIs", "Customs inspection and NAFDAC laboratory clearance velocity at Lagos ports."],
            ["Domestic Formulation Capacity Utilization", "Output of sterile injectables, oral liquids, and essential antibiotics."],
            ["Currency Devaluation Pass-Through", "Price elasticity of prescription pharmaceuticals versus consumer OTC medicines."],
            ["Local Excipient & Packaging Sourcing", "Sourcing blister pack aluminum and packaging cartons from domestic suppliers."]
        ],
        "history": "Fidson is one of Nigeria's premier pharmaceutical manufacturers, maintaining WHO-compliant formulation plants in Ogun State.",
    },
    {
        "industry": "telecoms",
        "title": "Will Airtel Africa (AIRTELAFRI) reduce base station diesel opex by 35% through solar-hybrid battery conversions across 14 African markets?",
        "slug": "airtel-africa-solar-tower-35",
        "definition": "Resolves YES if Airtel Africa Plc annual report confirms network diesel operating expense contraction equal to or greater than 35.0% on a constant currency basis.",
        "source": "Airtel Africa Plc Published Annual Financials & London Stock Exchange Filings",
        "days": 110,
        "metrics": [
            ["Solar-Battery Hybrid Deployment Rate", "De-risking remote off-grid cell sites from road haulage diesel supplies."],
            ["Pan-African Foreign Currency Translation", "Mitigating devaluation impacts across Nigeria, Kenya, Zambia, and Francophone West Africa."],
            ["SmartCash PSB & Mobile Money Penetration", "Growing high-margin fintech transactional fee revenue."],
            ["Towerco Lease Renegotiations", "Shifting USD-pegged tower leases to local currency rate cards."]
        ],
        "history": "Airtel Africa is dually listed on the Nigerian Exchange and London Stock Exchange, providing mobile voice and data services across Africa.",
    },
    {
        "industry": "agriculture",
        "title": "Will Okomu Oil Palm (OKOMUOIL) achieve operating EBITDA margin above 55% supported by domestic crude palm oil deficit pricing?",
        "slug": "okomu-oil-cpo-ebitda-55",
        "definition": "Resolves YES if audited full-year financial statements of Okomu Oil Palm Company Plc show operating EBITDA margin equal to or exceeding 55.0%.",
        "source": "NGX Audited Financials & Nigerian Palm Oil Development Association",
        "days": 95,
        "metrics": [
            ["Crude Palm Oil (CPO) Farmgate Realized Price", "Premium domestic pricing insulating margins from global benchmark drops."],
            ["Fresh Fruit Bunch (FFB) Milling Efficiency", "Oil extraction rate (OER) per metric ton of harvested fruit."],
            ["Interstate Road Freight & Diesel Haulage", "Transport cost inflation moving refined oil from Edo State to consumer hubs."],
            ["Industrial Offtake Contracts", "Forward volume off-take commitments from food manufacturing conglomerates."]
        ],
        "history": "Okomu Oil Palm operates over 33,000 hectares of oil palm and rubber plantations in Edo State, benefiting from high domestic agro-industrial demand.",
    },
    {
        "industry": "capital-markets",
        "title": "Will Safaricom (NSE: SCOM) expand M-Pesa regional transaction velocity by 25% despite East African currency depreciations?",
        "slug": "safaricom-mpesa-regional-growth-25",
        "definition": "Resolves YES if Safaricom Plc financial year results published on the Nairobi Securities Exchange (NSE) confirm M-Pesa transaction value growth equal to or exceeding 25.0%.",
        "source": "Nairobi Securities Exchange (NSE) Disclosures & Central Bank of Kenya",
        "days": 105,
        "metrics": [
            ["Ethiopia M-Pesa Rollout Velocity", "Subscriber acquisition and agent banking liquidity in newly deregulated Ethiopian market."],
            ["Cross-Border Remittance Corridor Growth", "Diaspora and intra-African trade remittance flows via mobile money."],
            ["Network Power & Fuel Resilience", "Captive solar microgrids powering rural East African telecom towers."],
            ["Kenya Shilling Exchange Rate Pass-Through", "Mitigating imported network equipment costs amidst FX rate volatility."]
        ],
        "history": "Safaricom is East Africa's most profitable enterprise, leading global mobile money innovation with M-Pesa on the Nairobi Securities Exchange.",
    },
]


def get_db():
    ssl_ca_path = DB_SSL_CA
    if DB_SSL_CA_CONTENT and not ssl_ca_path and "BEGIN CERTIFICATE" in DB_SSL_CA_CONTENT:
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pem")
        tmp.write(DB_SSL_CA_CONTENT.encode("utf-8"))
        tmp.close()
        ssl_ca_path = tmp.name

    # Dynamic host resolution (supports DB_HOST_IP override or dynamic DNS resolution)
    host = os.getenv("DB_HOST_IP") or DB_HOST
    if not os.getenv("DB_HOST_IP") and sys.platform.startswith("win"):
        try:
            import socket
            resolved = socket.gethostbyname(DB_HOST)
            if resolved:
                host = resolved
        except Exception:
            pass

    config = {
        "host": host,
        "port": DB_PORT,
        "database": DB_NAME,
        "user": DB_USER,
        "password": DB_PASS,
        "charset": "utf8mb4",
    }
    if ssl_ca_path and os.path.exists(ssl_ca_path):
        config["ssl_ca"] = ssl_ca_path

    return mysql.connector.connect(**config)


def ensure_industries(cursor, conn):
    print("[*] Verifying all 11 core industries in database...")
    for slug, name in CORE_INDUSTRIES:
        cursor.execute("INSERT IGNORE INTO industries (slug, name) VALUES (%s, %s)", (slug, name))
    conn.commit()


def populate_markets(cursor, conn):
    print("[*] Populating comprehensive macroeconomic & listed corporate disruption contracts...")
    count = 0

    for cat in ECONOMIC_CATALYSTS:
        # Check if already exists
        cursor.execute("SELECT id FROM market_events WHERE slug = %s", (cat["slug"],))
        if cursor.fetchone():
            continue

        # Get industry ID
        cursor.execute("SELECT id FROM industries WHERE slug = %s LIMIT 1", (cat["industry"],))
        ind_row = cursor.fetchone()
        ind_id = ind_row[0] if ind_row else 1

        event_id = str(uuid.uuid4())
        closes_at = datetime.now(timezone.utc) + timedelta(days=cat["days"])
        resolves_at = closes_at + timedelta(days=1)

        # 1. Insert Event
        ins_event = """
            INSERT INTO market_events 
                (id, slug, industry_id, title, outcome_definition, resolution_source, resolves_at, closes_at, state, created_at)
            VALUES 
                (%s, %s, %s, %s, %s, %s, %s, %s, 'open', NOW(3))
        """
        cursor.execute(ins_event, (
            event_id,
            cat["slug"],
            ind_id,
            cat["title"],
            cat["definition"],
            cat["source"],
            resolves_at,
            closes_at,
        ))

        # 2. Insert Study Context
        context_id = str(uuid.uuid4())
        metrics_json = json.dumps(cat["metrics"])
        history_json = json.dumps([{"period": "Historical Context", "action": cat["history"]}])

        ins_context = """
            INSERT INTO study_context_versions
                (id, event_id, version, summary, metrics, historical_cases, ai_generated, published_at)
            VALUES
                (%s, %s, 1, %s, %s, %s, 1, NOW(3))
        """
        cursor.execute(ins_context, (
            context_id,
            event_id,
            f"Comprehensive Study Context for {cat['title']}. Analysis of primary macroeconomic and supply chain transmission levers.",
            metrics_json,
            history_json,
        ))

        # 3. Insert External Source
        source_id = str(uuid.uuid4())
        ins_src = """
            INSERT INTO external_sources (id, name, publisher, origin_url, published_at, retrieved_at)
            VALUES (%s, %s, %s, %s, NOW(3), NOW(3))
        """
        cursor.execute(ins_src, (
            source_id,
            cat["source"],
            "Regulatory Authority / Financial Exchange",
            "https://ngxgroup.com",
        ))

        # Link Context and Source
        cursor.execute("INSERT INTO study_context_sources (context_id, source_id) VALUES (%s, %s)", (context_id, source_id))

        count += 1
        print(f"  [+] Added market: {cat['title']}")

    conn.commit()
    print(f"[+] Successfully populated {count} fresh economic contracts.")


def fetch_latest_macro_news(limit=10):
    """
    Scans live macroeconomic and business news RSS feeds across Nigeria and Africa.
    Returns a clean list of top real-world headlines to ground AI generation in current reality.
    """
    url = "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-NG&gl=NG&ceid=NG:en"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) EconSim/2.0 MarketScanner"}
    headlines = []
    try:
        resp = requests.get(url, headers=headers, timeout=12)
        if resp.status_code == 200:
            import xml.etree.ElementTree as ET
            root = ET.fromstring(resp.content)
            items = root.findall(".//item")
            for item in items[:limit]:
                t = item.find("title")
                if t is not None and t.text:
                    clean_t = t.text.strip()
                    if clean_t and clean_t not in headlines:
                        headlines.append(clean_t)
            print(f"[+] Live Web Scanner ingested {len(headlines)} current African business headlines.")
    except Exception as e:
        print(f"[!] Live news feed scanner notice: {e}")
    return headlines


def update_active_market_states(cursor, conn):
    """
    Scans existing open market contracts and closes those whose closing timestamp has arrived.
    """
    try:
        cursor.execute("UPDATE market_events SET state = 'closed' WHERE state = 'open' AND closes_at <= NOW()")
        closed_count = cursor.rowcount
        conn.commit()
        if closed_count > 0:
            print(f"[+] Market Lifecycle Engine: Closed {closed_count} expired contract(s).")
    except Exception as e:
        print(f"[!] Market state update notice: {e}")


def synthesize_ai_disruption_catalysts(cursor, conn, live_headlines=None):
    """
    Autonomous NVIDIA NIM Research Agent:
    Dynamically scans power disruptions, port logjams, sovereign debt, and corporate margins
    grounded in live macroeconomic headlines to ensure active contracts exist across all sectors.
    """
    if not NVIDIA_API_KEY:
        print("[*] No NVIDIA_API_KEY provided; dynamic AI synthesis skipped. Static catalog active.")
        return

    print("[*] Running Autonomous NVIDIA NIM Disruption Scanner...")
    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type": "application/json",
    }

    # Format live news context if available
    news_context = ""
    if live_headlines:
        news_bullets = "\n".join([f"- {h}" for h in live_headlines[:6]])
        news_context = f"\nRecent Real-World Economic Headlines:\n{news_bullets}\n"

    # Prompt AI to evaluate latest corporate & supply chain shifts
    prompt = (
        "You are an Elite African Equities Strategist & Industrial Economist. "
        f"{news_context}"
        "Formulate 1 high-stakes verifiable economic or corporate forecasting contract for a public company on the Nigerian Exchange (NGX) "
        "or African regional bourses (e.g. BUA Foods, Geregu Power, Transcorp, Zenith Bank, Oando, Lafarge, Safaricom). "
        "Focus on critical real-economy disruptions: Band-A electricity tariffs, port demurrage at Apapa, gas pipeline pressure, or CBN recapitalization. "
        "Respond strictly with valid JSON with fields: 'industry' (slug matching monetary-policy, capital-markets, energy, manufacturing, fmcg, telecoms, or agriculture), "
        "'title', 'slug', 'definition', 'source', 'days' (integer 60-120), 'metrics' (array of 4 [name, description] pairs), 'history'."
    )

    try:
        resp = requests.post(
            f"{NVIDIA_API_URL}/chat/completions",
            headers=headers,
            json={
                "model": NVIDIA_MODEL,
                "messages": [
                    {"role": "system", "content": "You are a professional financial market research engine. Output valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.2,
                "max_tokens": 1024,
            },
            timeout=25,
        )
        if resp.status_code == 200:
            data = resp.json()
            raw_content = data["choices"][0]["message"]["content"]
            clean_json = raw_content.replace("```json", "").replace("```", "").strip()
            cat = json.loads(clean_json)

            # Validate slug and insert if new
            cursor.execute("SELECT id FROM market_events WHERE slug = %s", (cat["slug"],))
            if not cursor.fetchone():
                cursor.execute("SELECT id FROM industries WHERE slug = %s LIMIT 1", (cat.get("industry", "capital-markets"),))
                ind_row = cursor.fetchone()
                ind_id = ind_row[0] if ind_row else 2

                event_id = str(uuid.uuid4())
                closes_at = datetime.now(timezone.utc) + timedelta(days=int(cat.get("days", 90)))
                resolves_at = closes_at + timedelta(days=1)

                ins_event = """
                    INSERT INTO market_events 
                        (id, slug, industry_id, title, outcome_definition, resolution_source, resolves_at, closes_at, state, created_at)
                    VALUES 
                        (%s, %s, %s, %s, %s, %s, %s, %s, 'open', NOW(3))
                """
                cursor.execute(ins_event, (
                    event_id,
                    cat["slug"],
                    ind_id,
                    cat["title"],
                    cat["definition"],
                    cat["source"],
                    resolves_at,
                    closes_at,
                ))

                context_id = str(uuid.uuid4())
                metrics_json = json.dumps(cat.get("metrics", []))
                history_json = json.dumps([{"period": "Empirical Precedent", "action": cat.get("history", "")}])

                ins_context = """
                    INSERT INTO study_context_versions
                        (id, event_id, version, summary, metrics, historical_cases, ai_generated, published_at)
                    VALUES
                        (%s, %s, 1, %s, %s, %s, 1, NOW(3))
                """
                cursor.execute(ins_context, (
                    context_id,
                    event_id,
                    f"Autonomous Research Study Context for {cat['title']}.",
                    metrics_json,
                    history_json,
                ))

                source_id = str(uuid.uuid4())
                cursor.execute(
                    "INSERT INTO external_sources (id, name, publisher, origin_url, published_at, retrieved_at) VALUES (%s, %s, %s, %s, NOW(3), NOW(3))",
                    (source_id, cat["source"], "Autonomous Disruption Radar", "https://ngxgroup.com")
                )
                cursor.execute("INSERT INTO study_context_sources (context_id, source_id) VALUES (%s, %s)", (context_id, source_id))
                conn.commit()
                print(f"[+] Autonomous AI Scanner synthesized new catalyst: {cat['title']}")
    except Exception as e:
        print(f"[!] Autonomous AI Scanner note: {e}")


def synthesize_ai_boardroom_scenarios(cursor, conn, live_headlines=None):
    """
    Autonomous Boardroom Dilemma Generator:
    Generates sharp, bite-sized, single-objective boardroom scenarios based on real-world events.
    Enforces that dilemmas contain concrete financial numbers and a focused directive.
    """
    if not NVIDIA_API_KEY:
        return

    print("[*] Checking Boardroom Scenario Coverage across industries...")
    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type": "application/json",
    }

    news_context = ""
    if live_headlines:
        news_bullets = "\n".join([f"- {h}" for h in live_headlines[:5]])
        news_context = f"Current Economic Intelligence:\n{news_bullets}\n"

    prompt = (
        "You are the Lead Executive Strategy Designer for EconSim. "
        f"{news_context}"
        "Formulate 1 SHARP, BITE-SIZED, SINGLE-OBJECTIVE boardroom challenge for an executive (CFO/COO/CEO). "
        "CRITICAL RULES:\n"
        "1. SINGLE FOCUSED PROBLEM: Do NOT create 3 or 4 huge essay tasks. Pick ONE concrete dilemma (e.g. 72-hour burn reduction, key client renegotiation, invoice factoring bridge, power tariff surge).\n"
        "2. CONCRETE NUMBERS: Include specific numbers (monthly revenue, cash burn, cash reserves, percentage transport or electricity hike).\n"
        "3. PUNCHY DIRECTIVE: End with 1 clear Executive Directive with 2 distinct strategic options (Option A vs Option B) or an immediate actionable operational plan.\n"
        "Output strictly valid JSON with keys: "
        "'industry_slug' (one of: fintech, energy, agriculture, fmcg, healthcare, real-estate, monetary-policy, capital-markets, fx-reserves, manufacturing, telecoms), "
        "'title' (punchy 6-10 word title), "
        "'body' (1 short backstory paragraph + Executive Directive), "
        "'reference' ({'company': 'Name', 'precedent': 'Historical emerging market precedent'}), "
        "'difficulty' ('intermediate')."
    )

    try:
        resp = requests.post(
            f"{NVIDIA_API_URL}/chat/completions",
            headers=headers,
            json={
                "model": NVIDIA_MODEL,
                "messages": [
                    {"role": "system", "content": "You design rigorous, realistic business simulation cases. Output valid JSON only."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.25,
                "max_tokens": 1024,
            },
            timeout=25,
        )
        if resp.status_code == 200:
            data = resp.json()
            raw_content = data["choices"][0]["message"]["content"]
            clean_json = raw_content.replace("```json", "").replace("```", "").strip()
            sc = json.loads(clean_json)

            # Check if title already exists
            cursor.execute("SELECT id FROM boardroom_scenarios WHERE title = %s LIMIT 1", (sc["title"],))
            if not cursor.fetchone():
                cursor.execute("SELECT id FROM industries WHERE slug = %s LIMIT 1", (sc.get("industry_slug", "fintech"),))
                ind_row = cursor.fetchone()
                ind_id = ind_row[0] if ind_row else 1

                sc_id = str(uuid.uuid4())
                rubric_json = json.dumps({'financial_mechanics': 40, 'risk_management': 30, 'historical_alignment': 20, 'communication': 10})
                ref_json = json.dumps(sc.get("reference", {}))

                ins_sc = """
                    INSERT INTO boardroom_scenarios
                        (id, industry_id, title, confidential_body, reference_case, rubric, difficulty, created_at)
                    VALUES
                        (%s, %s, %s, %s, %s, %s, %s, NOW(3))
                """
                cursor.execute(ins_sc, (
                    sc_id,
                    ind_id,
                    sc["title"],
                    sc["body"],
                    ref_json,
                    rubric_json,
                    sc.get("difficulty", "intermediate"),
                ))
                conn.commit()
                print(f"[+] Autonomous Boardroom Engine generated new sharp dilemma: [{sc.get('industry_slug')}] {sc['title']}")
    except Exception as e:
        print(f"[!] Boardroom scenario generator notice: {e}")


def execute_keep_alive_query(conn):
    """Executes a user select query to keep Aiven free-tier database alive and active."""
    try:
        cur = conn.cursor(dictionary=True)
        target_email = os.getenv("KEEP_ALIVE_EMAIL") or os.getenv("ADMIN_EMAIL")
        if target_email:
            cur.execute("SELECT id, email, display_name, status, updated_at FROM users WHERE email = %s LIMIT 1", (target_email,))
            row = cur.fetchone()
            if row:
                print(f"[+] Keep-alive user match: {row['email']} (id: {row['id']})")
        cur.execute("SELECT id, email, status FROM users ORDER BY created_at ASC LIMIT 3")
        _ = cur.fetchall()
        cur.execute("SELECT COUNT(*) AS total_users FROM users")
        total = cur.fetchone()
        cur.execute("UPDATE platform_features SET updated_at = NOW(3) WHERE code = 'demo_mode' LIMIT 1")
        conn.commit()
        cur.close()
        print(f"[+] Aiven Keep-Alive DB query completed successfully ({total['total_users'] if total else 0} total users).")
    except Exception as e:
        print(f"[-] Keep-alive query notice: {e}")


def main():
    print("========================================================")
    print(" EconSim Macro & Listed Equities Disruption Populator")
    print("========================================================")
    conn = get_db()
    cursor = conn.cursor()

    # Execute keep-alive query on each invocation
    execute_keep_alive_query(conn)

    # Ingest live macroeconomic headlines via web scanner
    live_headlines = fetch_latest_macro_news(limit=10)

    # Lifecycle update: close expired contracts
    update_active_market_states(cursor, conn)

    # Core catalog and AI synthesis
    ensure_industries(cursor, conn)
    populate_markets(cursor, conn)
    synthesize_ai_disruption_catalysts(cursor, conn, live_headlines)
    synthesize_ai_boardroom_scenarios(cursor, conn, live_headlines)

    cursor.execute("SELECT COUNT(*) FROM market_events WHERE state = 'open'")
    total_open = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM boardroom_scenarios")
    total_scenarios = cursor.fetchone()[0]
    print(f"[+] Active open market contracts verified in database: {total_open}")
    print(f"[+] Active sharp boardroom dilemmas verified in database: {total_scenarios}")

    cursor.close()
    conn.close()
    print("[+] Market populator & real-time scanner execution completed successfully.")


if __name__ == "__main__":
    main()
