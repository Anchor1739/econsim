-- EconSim Seed Data: Curated Nigerian & African Economic Markets & Scenarios

-- 1. External Sources
INSERT IGNORE INTO external_sources (id, name, publisher, origin_url, published_at, retrieved_at) VALUES
('00000000-0000-4000-a000-000000000001', 'CBN Monetary Policy Committee Communiqué', 'Central Bank of Nigeria', 'https://www.cbn.gov.ng', '2026-09-24', NOW(3)),
('00000000-0000-4000-a000-000000000002', 'National Bureau of Statistics CPI Report', 'NBS Nigeria', 'https://nigerianstat.gov.ng', '2026-10-15', NOW(3)),
('00000000-0000-4000-a000-000000000003', 'Nigerian Exchange Equities Daily Report', 'NGX Group', 'https://ngxgroup.com', '2026-10-20', NOW(3)),
('00000000-0000-4000-a000-000000000004', 'US Federal Reserve FOMC Statement', 'Federal Reserve Board', 'https://federalreserve.gov', '2026-09-18', NOW(3)),
('00000000-0000-4000-a000-000000000005', 'OPEC Monthly Oil Market Report', 'OPEC', 'https://opec.org', '2026-10-12', NOW(3));

-- 2. Market Events
INSERT IGNORE INTO market_events 
(id, slug, industry_id, title, outcome_definition, resolution_source, resolves_at, closes_at, state)
SELECT 
 '10000000-0000-4000-8000-000000000001', 'cbn-mpr-hike', id,
 'Will the CBN increase the monetary policy rate at its next meeting?',
 'Resolves YES if the official communiqué published after the next CBN Monetary Policy Committee (MPC) meeting increases the Monetary Policy Rate (MPR) by at least 25 basis points above the prevailing benchmark.',
 'Official CBN MPC Communiqué published on www.cbn.gov.ng',
 '2026-11-24 15:00:00', '2026-11-23 23:59:59', 'open'
FROM industries WHERE slug = 'fintech' LIMIT 1;

INSERT IGNORE INTO market_events 
(id, slug, industry_id, title, outcome_definition, resolution_source, resolves_at, closes_at, state)
SELECT 
 '10000000-0000-4000-8000-000000000002', 'dangote-cement-q4', id,
 'Will Dangote Cement shares rise 15% by the end of Q4 2026?',
 'Resolves YES if the official closing share price of Dangote Cement Plc (DANGCEM) on the Nigerian Exchange (NGX) on the final trading day of Q4 2026 is at least 15.0% higher than the baseline close at the beginning of the quarter.',
 'NGX Official Price List and Daily Official Summary',
 '2026-12-31 16:00:00', '2026-12-30 23:59:59', 'open'
FROM industries WHERE slug = 'fmcg' LIMIT 1;

INSERT IGNORE INTO market_events 
(id, slug, industry_id, title, outcome_definition, resolution_source, resolves_at, closes_at, state)
SELECT 
 '10000000-0000-4000-8000-000000000003', 'us-fed-rate-cut', id,
 'Will the US Federal Reserve cut interest rates before year-end?',
 'Resolves YES if the Federal Open Market Committee (FOMC) lowers the upper bound of the target federal funds rate range before or on December 31, 2026.',
 'Federal Reserve Board FOMC press release',
 '2026-12-31 20:00:00', '2026-12-30 23:59:59', 'open'
FROM industries WHERE slug = 'fintech' LIMIT 1;

INSERT IGNORE INTO market_events 
(id, slug, industry_id, title, outcome_definition, resolution_source, resolves_at, closes_at, state)
SELECT 
 '10000000-0000-4000-8000-000000000004', 'brent-crude-dec', id,
 'Will Brent crude average above $90 per barrel in December 2026?',
 'Resolves YES if the monthly average settlement price for front-month Brent Crude Oil futures exceeds $90.00 per barrel for December 2026.',
 'Intercontinental Exchange (ICE) Brent Crude official settlements',
 '2026-12-31 22:00:00', '2026-12-30 23:59:59', 'open'
FROM industries WHERE slug = 'energy' LIMIT 1;

INSERT IGNORE INTO market_events 
(id, slug, industry_id, title, outcome_definition, resolution_source, resolves_at, closes_at, state)
SELECT 
 '10000000-0000-4000-8000-000000000005', 'nigerian-food-inflation', id,
 'Will Nigerian food inflation fall for two consecutive reporting months?',
 'Resolves YES if the National Bureau of Statistics (NBS) Consumer Price Index reports two consecutive month-on-month declines in the food sub-index.',
 'National Bureau of Statistics (NBS) CPI statistical bulletin',
 '2027-01-31 12:00:00', '2027-01-30 23:59:59', 'open'
FROM industries WHERE slug = 'agriculture' LIMIT 1;

-- 3. Study Contexts
INSERT IGNORE INTO study_context_versions
(id, event_id, version, summary, metrics, historical_cases, ai_generated, published_at)
VALUES
('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 1,
 'Monetary policy is shaped by headline inflation, foreign exchange volatility, money supply growth, and private-sector credit conditions.',
 '[
   ["Headline & Core Inflation", "Persistent core price pressures increase the probability of restrictive policy stance."],
   ["Exchange Rate Pass-Through", "Currency depreciation elevates imported food and energy costs."],
   ["Liquidity & Lending", "Banking sector credit expansion and money supply aggregates reveal transmission effectiveness."],
   ["Economic Growth Trade-off", "Elevated borrowing rates dampen manufacturing capital investments."]
 ]',
 '[
   {"period": "2024 MPC Meetings", "action": "Aggressive benchmark tightening of over 750 bps to anchor inflation expectations and stabilize foreign portfolio inflows."}
 ]',
 0, NOW(3)),

('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 1,
 'Industrial equities performance in Nigeria balances domestic infrastructure demand with energy, logistics, and FX-denominated capital expenditure.',
 '[
   ["Revenue & Volume Growth", "Examine domestic cement dispatch volumes and export corridor execution."],
   ["Energy & Logistics Costs", "Gas supply contract pricing and transportation freight costs affect gross margin."],
   ["Foreign Exchange Exposure", "Unhedged FX debt and dollar obligations affect non-operating finance expenses."],
   ["Valuation Multiples", "Compare trailing P/E and EV/EBITDA multiples with regional peers."]
 ]',
 '[
   {"period": "Q1 2024", "action": "FX devaluation triggered substantial paper losses on foreign debt, followed by price adjustments that restored operating cash flow."}
 ]',
 0, NOW(3));

-- 4. Boardroom Scenarios (Confidential Scenarios)
INSERT IGNORE INTO boardroom_scenarios
(id, industry_id, title, confidential_body, reference_case, rubric, difficulty)
SELECT 
 '30000000-0000-4000-8000-000000000001', id,
 'The Runway Crisis: 90-Day Liquidity & Survival Plan',
 'You are the CFO of an established Nigerian fintech processing ₦2.4 billion in monthly payments. Current monthly operating revenue is ₦24 million, operating costs are ₦31 million (monthly net cash burn of ₦7 million), and total unrestricted cash reserve is ₦42 million. A lead Series-B investor has just communicated a 90-day delay in funding disbursement due to global LP approvals. Furthermore, your largest enterprise merchant, accounting for 25% of gross revenue, has signaled intention to review vendor terms.\n\nDevelop an executive strategy memo addressing:\n1. Exact cash runway analysis under current vs. stress-tested scenarios.\n2. Immediate 72-hour liquidity protection measures without crippling core infrastructure.\n3. Merchant retention strategy and alternative non-dilutive financing options.\n4. Measurable 30/60/90-day operational milestones and downside risk contingencies.',
 '{"company": "African Payments Co", "historical_parallel": "Late 2022 fintech funding slowdown where bridge facilities and renegotiated vendor terms avoided predatory down-rounds."}',
 '{"financial_mechanics": 40, "risk_management": 30, "historical_alignment": 20, "communication": 10}',
 'intermediate'
FROM industries WHERE slug = 'fintech' LIMIT 1;

INSERT IGNORE INTO boardroom_scenarios
(id, industry_id, title, confidential_body, reference_case, rubric, difficulty)
SELECT 
 '30000000-0000-4000-8000-000000000002', id,
 'The Working Capital Shock: Agrotech Logistics Disruption',
 'You are the Chief Strategy Officer of a grain aggregation and distribution enterprise in Northern Nigeria. Transport costs have surged 38% following fuel subsidy removal, interstate transport bottlenecks have elevated post-harvest losses to 12%, and key retail off-takers have stretched payment terms from 30 to 60 days. Liquid reserves cover only 6 weeks of operational outflows.\n\nDraft an executive memo detailing:\n1. Working capital optimization and cash-conversion-cycle acceleration.\n2. Transport contract restructuring and regional micro-warehousing strategy.\n3. Vendor payment sequencing and receivable discounting or warehouse receipt financing.\n4. Risk triggers and clear governance controls for supply chain continuity.',
 '{"company": "Midwestern Grain Hub", "historical_parallel": "Agricultural commodity distribution during logistics supply shocks."}',
 '{"financial_mechanics": 40, "risk_management": 30, "historical_alignment": 20, "communication": 10}',
 'advanced'
FROM industries WHERE slug = 'agriculture' LIMIT 1;

-- 5. Skill Badges
INSERT IGNORE INTO badges (id, code, title, requirement) VALUES
('40000000-0000-4000-8000-000000000001', 'first_forecast', 'First Forecast', '{"type": "forecasts_count", "threshold": 1}'),
('40000000-0000-4000-8000-000000000002', 'market_explorer', 'Market Explorer', '{"type": "forecasts_count", "threshold": 3}'),
('40000000-0000-4000-8000-000000000003', 'boardroom_strategist', 'Boardroom Strategist', '{"type": "boardroom_attempts", "threshold": 1}'),
('40000000-0000-4000-8000-000000000004', 'research_mindset', 'Research Mindset', '{"type": "forecasts_count", "threshold": 5}'),
('40000000-0000-4000-8000-000000000005', 'risk_architect', 'Risk Architect', '{"type": "boardroom_score", "threshold": 80}'),
('40000000-0000-4000-8000-000000000006', 'senior_analyst', 'Senior Analyst', '{"type": "xp_total", "threshold": 2000}');

