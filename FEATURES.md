# EconSim — Master Feature Specification & System Architecture

Welcome to the definitive architectural and feature reference for **EconSim**. This document details every platform subsystem, economic mechanic, administrative workflow, and technical safeguard implemented across the application.

---

## Table of Contents
1. [Platform Vision & Core Philosophy](#1-platform-vision--core-philosophy)
2. [Dual Financial Modes: Virtual (VNGN) & Real Capital (NGN)](#2-dual-financial-modes-virtual-vngn--real-capital-ngn)
3. [Double-Entry Accounting & Escrow Engine](#3-double-entry-accounting--escrow-engine)
4. [The Predictor — Macroeconomic Prediction Markets](#4-the-predictor--macroeconomic-prediction-markets)
5. [The Boardroom Arena — Executive Strategy Matchmaking](#5-the-boardroom-arena--executive-strategy-matchmaking)
6. [Institutional AI Benchmark Duel Mode](#6-institutional-ai-benchmark-duel-mode)
7. [African & Multi-Dialect Voice Dictation Engine](#7-african--multi-dialect-voice-dictation-engine)
8. [Anti-Cheat & Boardroom Integrity Shield](#8-anti-cheat--boardroom-integrity-shield)
9. [Strategic Adjudication Engine (AI Rubric & Review)](#9-strategic-adjudication-engine-ai-rubric--review)
10. [Scenario Lab & Real-World Expert Ingestion Pipeline](#10-scenario-lab--real-world-expert-ingestion-pipeline)
11. [User Feedback & Voice Desk](#11-user-feedback--voice-desk)
12. [XP, Meritocracy & Global Leaderboards](#12-xp-meritocracy--global-leaderboards)
13. [Institutional Administrative Portal (`/a`)](#13-institutional-administrative-portal-a)
14. [Notification Engine (Push & In-App)](#14-notification-engine-push--in-app)
15. [Mobile-First PWA Design & UI Framework](#15-mobile-first-pwa-design--ui-framework)

---

## 1. Platform Vision & Core Philosophy

EconSim is an institutional-grade financial intelligence and strategy platform engineered specifically for African and emerging-market founders, economists, executives, and finance students.

Traditional business education relies on retrospective, static case studies that do not simulate real-time capital pressure or emerging-market volatility (such as FX devaluations, central bank interest rate hikes, fuel subsidy removals, and power grid shocks). EconSim bridges this divide through:
- **Quantified Macroeconomic Forecasting:** Real-world economic contracts settled against official empirical metrics (NBS, CBN, NUPRC).
- **Executive Strategy Tournaments:** Time-pressured corporate dilemma simulations judged against a rigorous institutional rubric.
- **Strict Financial Integrity:** Bank-grade double-entry ledger mechanics governing all capital flows.

---

## 2. Dual Financial Modes: Virtual (VNGN) & Real Capital (NGN)

EconSim operates two completely isolated economic tracks:

### A. Virtual Simulation Mode (VNGN)
- **Currency:** Virtual Nigerian Naira (`VNGN`).
- **Initial Grant:** Every new registrant receives an initial grant of **₦50,000 VNGN** upon registration.
- **Purpose:** Risk-free environment to stress-test macroeconomic theses, build executive track records, and earn XP.
- **Replenishment:** Virtual capital can be replenished through platform achievements and scenario completions.

### B. Real Capital Mode (NGN)
- **Currency:** Real Nigerian Naira (`NGN`).
- **Payment Processing:** Integrated with Paystack API for secure debit card, bank transfer, and USSD deposits.
- **Regulatory Safeguards:**
  - Governed by master administrative kill switches (`real_mode`, `real_boardroom`, `real_predictor`).
  - Requires email verification and multi-factor session checks.
  - Withdrawal compliance desk: Requests undergo administrative compliance verification before ledger dispatch.

---

## 3. Double-Entry Accounting & Escrow Engine

EconSim does **not** rely on simple numeric balance columns on the `users` table. All balances are derived dynamically from an append-only double-entry ledger implemented in `src/Services/LedgerService.php`.

### Ledger Mechanics
- **Account Chart:**
  - `user_available_vngn` / `user_available_ngn`: Capital available for new positions or challenge creation.
  - `user_escrow_vngn` / `user_escrow_ngn`: Capital committed to active prediction positions or open boardroom lounges.
  - `system_clearing_vngn` / `system_clearing_ngn`: System contra-accounts guaranteeing zero-sum equilibrium.
- **Mathematical Invariant:** Every journal entry consists of equal debit and credit movements:
  $$\sum \text{Debits} - \sum \text{Credits} = 0$$
- **Concurrency & Atomicity:** Operations utilize database-level row locks (`SELECT ... FOR UPDATE`) within MySQL transactions.
- **Idempotency:** Every financial operation requires a unique deterministic idempotency key (e.g. `boardroom_escrow_hold_{userId}_{challengeId}`), preventing double-spending or duplicate charges on re-submission.

---

## 4. The Predictor — Macroeconomic Prediction Markets

The Predictor allows users to allocate capital on future macroeconomic catalysts across major sectors of the African economy.

### Key Capabilities
- **Sector Catalogue:**
  - **FX & Currency:** Naira floating rates, NAFEM convergence, FX turnover.
  - **Energy & Resources:** Dangote Refinery PMS output, Brent crude benchmark, national grid stability.
  - **Agriculture & Food:** Headline food inflation, fertilizer subsidies, grain reserve releases.
  - **Fintech & Banking:** Monetary Policy Rate (MPR), cash reserve ratio (CRR), mobile money transaction volume.
  - **Aviation & Logistics:** Jet-A1 fuel costs, port clearance turnaround, freight tariffs.
  - **FMCG & Retail:** Consumer price index, manufacturing capacity utilization.
- **Self-Healing Seeding:** `PredictorService::ensureAllSectorsSeeded()` dynamically verifies and provisions active contracts for every sector so no sector view is ever empty.
- **Study Contexts:** Every contract provides historical central bank data, macroeconomic background, and analytical frameworks to inform the forecast.
- **Automated Settlement:** On the expiration date, empirical verification data is ingested, positions are settled atomically via the double-entry ledger, and winners receive their pro-rata payout pool.

---

## 5. The Boardroom Arena — Executive Strategy Matchmaking

The Boardroom is a real-time competitive simulation arena where strategists navigate high-stakes corporate crises.

### Match Lifecycle
1. **Challenge Creation:**
   - Host chooses sector, commitment stake (min ₦1,000), response duration (15–60 min), and scheduled start time.
   - Stake is atomically held in escrow via the double-entry ledger.
2. **Fixed-Time Match Scheduling:**
   - Matches can be scheduled for "In 10 Minutes", "In 15 Minutes", "In 30 Minutes", "In 1 Hour", or custom date/time.
   - Timestamps are stored in UTC on the backend and dynamically converted to the strategist's **local device timezone** (e.g. WAT, GMT+1) on the client with explicit timezone labels.
3. **Confidential Scenario Sealing:**
   - The confidential strategy dilemma is sealed server-side (`confidential_body` is hidden from the API payload).
   - Neither host nor opponent can read the dilemma until the wall-clock countdown reaches `00:00`.
4. **Direct Duel Invites:**
   - Generates a shareable match invite URL (`/?page=live_challenge&challengeId=...`) with one-click copying.
   - Creator re-entry protection allows hosts to leave the lounge and re-enter without triggering duplicate joins.
5. **Simultaneous Unsealing & Live Response:**
   - At 00:00, the scenario unseals simultaneously for both participants.
   - The countdown timer transitions to the Memo Response Window.

---

## 6. Institutional AI Benchmark Duel Mode

Strategists waiting in the lobby for an opponent can instantly unseal their challenge in **Solo Benchmark Duel Mode**:

### Benchmark Mechanics
- **Zero Waiting:** Immediately unseals the confidential dilemma without needing a human challenger.
- **The Case:** Strategist navigates the exact same confidential corporate dilemma.
- **The Passing Bar (70/100):** The Institutional Benchmark AI model sets a strict **70/100 threshold** across the 4-pillar evaluation rubric.
- **The Stakes:**
  - **Score $\ge 70$:** Strategist conquers the benchmark, wins the match, claims the capital payout pool, and earns a **+250 XP Conqueror Bonus**.
  - **Score $< 70$:** The benchmark prevails and the strategist forfeits the committed stake.

---

## 7. African & Multi-Dialect Voice Dictation Engine

To eliminate typing friction and accommodate executive speech, the Boardroom features built-in voice-to-text dictation with tailored dialect modeling:

### Dialect Support
- **🇳🇬 Nigerian English (`en-NG`):** Optimized for Nigerian phonetics, local corporate terminology, and cadence.
- **🌍 West African Pidgin / Dialect (`en-GH` / `pcm`):** Fallback recognition tuned for West African spoken business cadences.
- **🇺🇸 Global English (`en-US`):** Standard international business English.

### Audio Pipeline
- Integrates with the browser's native Web Speech Recognition API.
- Continuous dictation with interim recognition and real-time visual sound wave animation.
- Automatic text formatting: Capitalizes sentence starters, standardizes spacing, and appends to the strategy memorandum seamlessly.

---

## 8. Anti-Cheat & Boardroom Integrity Shield

To guarantee authentic executive reasoning and prevent outsourcing to external LLMs or unauthorized content sharing, the Boardroom arena enforces a comprehensive client security shield:

### Integrity Controls
1. **Paste & Drag-and-Drop Prevention:**
   - The strategic memorandum textarea disables the `paste` and `drop` events.
   - Strategists must formulate their response directly inside the arena.
2. **Copy & Cut Prevention:**
   - `copy` and `cut` events are blocked across the entire document during live challenges.
   - Right-click context menu is strictly disabled.
3. **Multi-Layer Windows Screenshot & Screen Print Lockdown:**
   - **Active Clipboard Purging:** The instant `PrintScreen` (PrtScn), `Alt + PrtScn`, or Windows Snipping Tool shortcuts (`Win + Shift + S`) are pressed or released, the browser purges the system clipboard (`navigator.clipboard.writeText('')`), preventing captured images from being pasted anywhere.
   - **Fullscreen Privacy Shield:** When the browser window loses focus (e.g. Snipping Tool overlay, Alt-Tab, screen recording selector), a solid 98% blackout privacy shield immediately conceals the viewport:
     > *🔒 Confidential Boardroom Strategy Session Protected — Window Defocused or Capture Detected*
   - Concurrently, all dilemma panels are zeroed out (`opacity: 0 !important; visibility: hidden !important; filter: blur(30px) !important`).
4. **Print Media Concealment:**
   - `@media print` rules completely hide the document (`display: none !important`), preventing browser PDF prints.

---

## 9. Strategic Adjudication Engine (AI Rubric & Review)

All executive memoranda are evaluated using a four-pillar institutional scoring standard:

### The 4-Pillar Evaluation Rubric
1. **Financial Mechanics (40%):** Concrete quantitative reasoning, working capital calculations, liquidity preservation, runway analysis, and unit economics.
2. **Downside Risk Insulation (30%):** Contingency planning, counterparty default mitigations, currency hedging, and operational buffers.
3. **Macro Precedent Alignment (20%):** Recognition of macro precedent, regulatory directives, and historical emerging-market context.
4. **Executive Clarity & Communication (10%):** Actionable, board-level communication structure without fluff or generic filler.

### Anti-Gibberish & Strict Relevance Filtering
- Responses with fewer than 10 words, keyboard mashing, character loops, or off-topic non-economic text automatically receive a strict **0/100 score**.

### Dual Adjudication Modes
- **Autonomous AI Mode:** Powered by the **NVIDIA NIM API** (`integrate.api.nvidia.com/v1`) with instant evaluation fallback, score breakdown, explanation, and automated settlement.
- **Admin Review Mode:** Memos can be routed into the Administrative Adjudication Desk for manual verification, score adjustments, and model fine-tuning before final payout release.

---

## 10. Scenario Lab & Real-World Expert Ingestion Pipeline

### Scenario Lab
An interactive single-player case library where strategists explore multi-stage corporate dilemmas, select strategic options, and receive immediate post-mortem analysis on their decisions.

### Real-World Expert Scenario Ingestion Pipeline
Industry leaders, CFOs, and macroeconomists can submit real-world corporate dilemmas they navigated:
1. **Submission Portal:** Accessible via header triggers (`+ Contribute Case 🎓` in Boardroom, `+ Contribute Scenario 🎓` in Scenario Lab).
2. **Submission Data:** Sector, company context, dilemma narrative, quantitative stakes, strategic options, actual decision taken, and historical outcome.
3. **Automated Boardroom Packaging:** System automatically structures submissions into standardized single-objective dilemmas.
4. **Administrative Verification Desk:** Institutional administrators review, inspect, edit, and approve submissions on `/a` before publication.
5. **Expert Reward:** Approved contributors receive **+500 XP** and institutional public recognition.

---

## 11. User Feedback & Voice Desk

A dedicated feedback channel connecting users directly with platform administrators:
- **Submission Modal:** Strategists can rate their experience (1–5 stars), choose a category (*Bug Report*, *Feature Request*, *Market & Scenario Content*, *UI/UX & Mobile*, *General Feedback*), and submit detailed feedback with optional contact email.
- **Admin Feedback Console:** Administrators on `/a` can inspect incoming feedback, filter by status (*Pending*, *In Review*, *Resolved*, *Archived*), and execute one-click resolution actions.
- **High-Visibility Toasts:** Notifications render at `z-index: 100000 !important` above all modals to confirm successful submissions.

---

## 12. XP, Meritocracy & Global Leaderboards

User reputation is quantified through an Experience Points (XP) meritocracy:
- **XP Accrual:**
  - Submitting a Boardroom strategy memo: **+100 XP**
  - Conquering the Institutional AI Benchmark: **+250 XP**
  - Winning a peer-to-peer Boardroom match: **+200 XP**
  - Successful prediction market position: **+50 XP**
  - Verified Expert Scenario Contribution: **+500 XP**
- **Levels & Badges:** Users advance from *Level 1 Strategist* through *Level 10 Institutional Fellow*.
- **Global Leaderboard:** Ranks strategists by accumulated XP, win rate, and prediction accuracy.

---

## 13. Institutional Administrative Portal (`/a`)

Accessible to designated administrator accounts at `/a` or `admin.html`:
- **Platform Health & Metrics:** Real-time user counts, active boardroom matches, total liquidity volume, and ledger balance verification.
- **Instant Kill Switches:** Platform-wide toggles for `real_mode`, `real_boardroom`, `real_predictor`, and `boardroom_grading_mode`.
- **Adjudication Desk:** Review pending strategy memos, inspect AI rubric breakdowns, override scores, and trigger instant settlements.
- **Expert Scenario Ingestion Desk:** Inspect, test, approve, or reject incoming real-world scenarios.
- **Feedback Management:** Track user sentiment, bug reports, and resolution states.
- **Double-Entry Ledger Audit:** Inspect raw journal entries and verify that total debits match total credits across all clearing accounts.

---

## 14. Notification Engine (Push & In-App)

- **Scheduled Match Warnings:** Dispatches automated in-app alerts at 5 minutes prior to match start.
- **Zero-Hour Match Start Notification:** Alerts participants the moment the match timer arrives and scenario unseals.
- **Resolution & Victory Alerts:** Notifies strategists of adjudication decisions, score breakdowns, and capital payouts.
- **Native Web Push Integration:** Fires browser desktop/mobile push notifications when permissions are granted.

---

## 15. Mobile-First PWA Design & UI Framework

- **Typography & Aesthetics:** Styled in Space Grotesk and DM Sans with high-contrast institutional dark and light palettes.
- **Sticky Bottom Navigation:** Fixed bottom navigation bar with safe-area padding for mobile Chrome and iOS Safari.
- **Responsive Layout:** Adaptive two-column panels that collapse into vertical executive feeds on mobile devices.
- **Micro-Interactions:** Loading spinners on all action buttons, double-click prevention, and live waveform feedback during voice dictation.

---

*EconSim is designed and maintained for institutional macroeconomic strategy and financial modeling.*

