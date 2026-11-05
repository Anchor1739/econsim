#!/usr/bin/env python3
"""
EconSim Boardroom AI Evaluation Agent
Uses NVIDIA NIM (e.g. meta/llama-3.1-70b-instruct) to adjudicate executive memos
against the versioned 40/30/20/10 strategic rubric.
"""

import os
import sys
import json
import re
import tempfile
import requests
import mysql.connector
from dotenv import load_dotenv

# Load environment
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


# Candidate NVIDIA NIM models for automatic on-demand failover
FALLBACK_MODELS = [
    "meta/llama-3.1-70b-instruct",
    "meta/llama-3.3-70b-instruct",
    "mistralai/mixtral-8x22b-instruct-v0.1",
    "meta/llama-3.1-8b-instruct",
    "mistralai/mistral-large-2-instruct",
]


def get_db_connection():
    ssl_ca_path = DB_SSL_CA
    if DB_SSL_CA_CONTENT and not ssl_ca_path:
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


def get_active_model_preference(conn):
    """Retrieve admin-configured model from platform_settings table if present."""
    if not conn:
        return NVIDIA_MODEL
    try:
        cur = conn.cursor()
        cur.execute("SELECT value FROM platform_settings WHERE `key` = 'active_ai_model' LIMIT 1")
        row = cur.fetchone()
        cur.close()
        if row and row[0]:
            return row[0].strip()
    except Exception:
        pass
    return NVIDIA_MODEL


def check_nonsense_or_irrelevant(answer_text):
    clean = answer_text.strip()
    words = clean.split()
    word_count = len(words)
    lower = clean.lower()

    # 1. Less than 10 words fails minimum strategy threshold
    if len(clean) < 30 or word_count < 10:
        return {
            "financial_mechanics": 0.0,
            "risk_management": 0.0,
            "historical_alignment": 0.0,
            "communication": 0.0,
            "explanation": "Evaluation Score: 0/100. Submission rejected: The response contains fewer than 10 words and fails to provide substantive strategic or financial reasoning for this executive dilemma.",
            "evidence": [
                "Failed minimum length threshold (minimum 10 words required)",
                "No quantitative or working capital calculations provided",
                "Zero points awarded across all criteria"
            ],
        }

    # 2. Repeated characters / keyboard mash
    if re.search(r"(.)\1{4,}", clean) or re.search(r"^(asdf|qwerty|zxcv|1234|test)+", lower):
        return {
            "financial_mechanics": 0.0,
            "risk_management": 0.0,
            "historical_alignment": 0.0,
            "communication": 0.0,
            "explanation": "Evaluation Score: 0/100. Submission rejected: Incoherent text pattern or keyboard smash detected without valid executive analysis.",
            "evidence": [
                "Incoherent text pattern detected",
                "Fails executive communication integrity standards",
                "Zero points awarded across all criteria"
            ],
        }

    # 3. Domain relevance check
    business_terms = [
        "runway", "burn", "cash", "liquidity", "margin", "revenue", "cost", "opex", "capex",
        "debt", "equity", "bridge", "loan", "safe", "invest", "capital", "customer", "client",
        "merchant", "offtaker", "supplier", "vendor", "contract", "discount", "price", "tariff",
        "power", "diesel", "fuel", "transport", "haulage", "port", "demurrage", "fx", "dollar",
        "naira", "devaluation", "hedge", "reserve", "inventory", "working capital", "receivable",
        "payable", "bank", "interest", "mpr", "crr", "mitigat", "risk", "contingency", "buffer",
        "milestone", "strategy", "plan", "action", "cut"
    ]
    matched = sum(1 for t in business_terms if t in lower)
    if matched < 2:
        return {
            "financial_mechanics": 0.0,
            "risk_management": 0.0,
            "historical_alignment": 0.0,
            "communication": 0.0,
            "explanation": "Evaluation Score: 0/100. Submission rejected: Off-topic or non-economic content. The response does not address the financial dilemma or corporate mechanics presented in this scenario.",
            "evidence": [
                "Response lacks relevant financial or strategic business terminology",
                "Failed to engage with the quantitative dilemma constraints",
                "Zero points awarded across all criteria"
            ],
        }

    return None


def evaluate_with_nvidia_nim(scenario_title, scenario_body, answer_text, conn=None):
    # 1. Zero tolerance check for nonsense / spam / off-topic
    invalid = check_nonsense_or_irrelevant(answer_text)
    if invalid is not None:
        return invalid, "standards_guard"

    if not NVIDIA_API_KEY:
        print("[-] NVIDIA_API_KEY not set. Using deterministic rule-based evaluation.")
        return evaluate_heuristically(answer_text), "heuristic_v1"

    active_model = get_active_model_preference(conn)
    model_pool = [active_model]
    for m in FALLBACK_MODELS:
        if m not in model_pool:
            model_pool.append(m)

    prompt = f"""You are the Senior Lead Strategic Adjudicator for the EconSim executive financial terminal.
Evaluate the following participant executive memo against the given strategic dilemma.

### Scenario: {scenario_title}
### Dilemma Case:
{scenario_body}

### Participant Strategy Memo:
{answer_text}

CRITICAL MANDATORY INSTRUCTIONS:
1. Strict Merit Grading: Do NOT award free participation points. All points must be earned from 0 upwards based on concrete strategic merit.
2. Zero-Tolerance for Nonsense or Off-Topic: If the response is spam, trivial, a joke, generic filler, or fails to directly address the specific financial dilemma, YOU MUST ASSIGN 0.0 TO ALL CRITERIA (Total: 0/100).
3. Evaluate against this 4-part executive rubric:
   - financial_mechanics (0 to 40 points): Precise calculations, working capital, debt/equity trade-offs, runway.
   - risk_management (0 to 30 points): Downside buffers, counterparty risks, operational mitigations, contingency triggers.
   - historical_alignment (0 to 20 points): Real-world African/Nigerian emerging market realities (FX float, fuel deregulation, CRR debits).
   - communication (0 to 10 points): Clarity, structured actionable recommendations, board-level executive tone.

Respond ONLY with valid JSON in this exact structure:
{{
  "financial_mechanics": 28.5,
  "risk_management": 21.0,
  "historical_alignment": 14.5,
  "communication": 7.5,
  "explanation": "Executive evaluation summary explaining strengths, vulnerabilities, and leadership recommendations.",
  "evidence": ["Key strength finding", "Key risk mitigation finding", "Recommended strategic action"]
}}"""

    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type": "application/json",
    }

    url = f"{NVIDIA_API_URL.rstrip('/')}/chat/completions"
    last_error = None

    # Iterate candidate models on demand when limits or errors occur
    for model_name in model_pool:
        print(f"[*] Calling NVIDIA NIM with model '{model_name}'...")
        payload = {
            "model": model_name,
            "messages": [
                {"role": "system", "content": "You are a precise economic adjudicator. Output only strict JSON."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 1024,
        }

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=40)

            # Check for Rate Limit (429) or transient server errors (502, 503, 504)
            if resp.status_code in (429, 502, 503, 504):
                print(f"[!] Model '{model_name}' reached quota/rate limit (HTTP {resp.status_code}). Switching on demand to next candidate model...")
                last_error = f"HTTP {resp.status_code}"
                continue

            resp.raise_for_status()
            res_json = resp.json()
            content = res_json["choices"][0]["message"]["content"].strip()

            # Extract JSON substring if wrapped in markdown
            match = re.search(r"\{.*\}", content, re.DOTALL)
            if match:
                parsed = json.loads(match.group(0))
                print(f"[+] Evaluation successfully completed using '{model_name}'.")
                return {
                    "financial_mechanics": max(0.0, min(40.0, float(parsed.get("financial_mechanics", 0.0)))),
                    "risk_management": max(0.0, min(30.0, float(parsed.get("risk_management", 0.0)))),
                    "historical_alignment": max(0.0, min(20.0, float(parsed.get("historical_alignment", 0.0)))),
                    "communication": max(0.0, min(10.0, float(parsed.get("communication", 0.0)))),
                    "explanation": str(parsed.get("explanation", "Executive evaluation completed.")),
                    "evidence": parsed.get("evidence", [f"Evaluated via NVIDIA NIM ({model_name})."]),
                }, model_name
        except Exception as e:
            print(f"[-] Model '{model_name}' failed: {e}. Switching on demand...")
            last_error = str(e)
            continue

    print(f"[-] All models exhausted ({last_error}). Falling back to heuristic rubric.")
    return evaluate_heuristically(answer_text), "heuristic_v1"


def evaluate_heuristically(answer_text):
    # 1. Zero tolerance check for nonsense / spam / off-topic
    invalid = check_nonsense_or_irrelevant(answer_text)
    if invalid is not None:
        return invalid

    text = answer_text.lower()
    words = len(text.split())

    # Points earned strictly from 0.0 upwards
    fin_score = 0.0
    risk_score = 0.0
    hist_score = 0.0
    comm_score = 0.0

    # 1. Financial Mechanics (0 - 40)
    if re.search(r"(₦|\$|%|\b\d+(\.\d+)?\s*(m|b|million|billion|k|bps|percent)\b)", answer_text, re.I):
        fin_score += 8.0
    if len(re.findall(r"\d+", answer_text)) >= 3:
        fin_score += 5.0
    cash_hits = sum(1 for k in ["runway", "burn", "cash flow", "liquidity", "working capital", "payables", "receivables"] if k in text)
    fin_score += min(12.0, cash_hits * 3.5)
    cost_hits = sum(1 for k in ["opex", "capex", "margin", "revenue", "cost reduction", "overhead", "renegotiat", "pricing"] if k in text)
    fin_score += min(10.0, cost_hits * 3.0)
    if any(k in text for k in ["debt", "equity", "bridge", "safe", "warrant", "overdraft", "factoring"]):
        fin_score += 5.0
    fin_score = min(40.0, fin_score)

    # 2. Risk Management (0 - 30)
    risk_hits = sum(1 for k in ["counterparty", "default", "churn", "delay", "outage", "bottleneck", "concentration"] if k in text)
    risk_score += min(12.0, risk_hits * 4.0)
    mit_hits = sum(1 for k in ["mitigat", "contingency", "buffer", "hedge", "reserve", "substitute", "covenant", "force majeure"] if k in text)
    risk_score += min(12.0, mit_hits * 4.0)
    if any(k in text for k in ["worst-case", "scenario", "governance", "compliance"]):
        risk_score += 6.0
    risk_score = min(30.0, risk_score)

    # 3. Historical Precedent Alignment (0 - 20)
    macro_hits = sum(1 for k in ["fx", "dollar", "naira", "devaluation", "inflation", "subsidy", "tariff", "band-a", "cbn", "mpr"] if k in text)
    hist_score += min(10.0, macro_hits * 3.5)
    if any(k in text for k in ["trade-off", "priorit", "milestone", "phase", "first"]):
        hist_score += 10.0
    hist_score = min(20.0, hist_score)

    # 4. Executive Communication (0 - 10)
    if words >= 50: comm_score += 2.0
    if words >= 90: comm_score += 2.5
    if words >= 140: comm_score += 1.5
    if "\n" in answer_text or any(k in text for k in ["1.", "2.", "first", "second", "- "]):
        comm_score += 2.5
    if any(k in text for k in ["recommend", "executive", "board", "direct"]):
        comm_score += 1.5
    comm_score = min(10.0, comm_score)

    total = round(fin_score + risk_score + hist_score + comm_score, 1)

    return {
        "financial_mechanics": round(fin_score, 1),
        "risk_management": round(risk_score, 1),
        "historical_alignment": round(hist_score, 1),
        "communication": round(comm_score, 1),
        "explanation": (
            "Thorough executive analysis. Demonstrates sound understanding of working capital, cash constraints, and actionable operational sequencing."
            if total >= 60.0
            else (
                "Developing strategic proposal. Tensions identified, but requires deeper quantitative grounding and risk hedges."
                if total >= 30.0
                else "Partial submission. High-level thoughts offered, but lacks detailed financial calculations and actionable risk mitigation mechanisms."
            )
        ),
        "evidence": [
            "Quantitative working capital and cash impact evaluation",
            "Identification of operational downside vulnerabilities and counterparty risks",
            "Strategic execution milestones structured under emerging market macro constraints",
        ],
    }


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
    print("[*] Connecting to Aiven MySQL...")
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
    except Exception as e:
        print(f"[-] Database connection error: {e}")
        sys.exit(1)

    # Execute keep-alive query on each invocation
    execute_keep_alive_query(conn)

    print("[*] Polling queued evaluation runs...")
    query = """
        SELECT r.id AS run_id, r.challenge_id,
               s.id AS submission_id, s.user_id, s.answer_text,
               scn.title AS scenario_title, scn.confidential_body
        FROM evaluation_runs r
        JOIN boardroom_challenges c ON r.challenge_id = c.id
        JOIN boardroom_submissions s ON c.id = s.challenge_id
        JOIN boardroom_scenarios scn ON c.scenario_id = scn.id
        WHERE r.evaluation_state = 'queued'
    """
    cursor.execute(query)
    queued_runs = cursor.fetchall()

    if not queued_runs:
        print("[+] No pending evaluation runs found. Fast exit (0 sec).")
        cursor.close()
        conn.close()
        sys.exit(0)

    print(f"[+] Found {len(queued_runs)} submissions to evaluate.")

    for row in queued_runs:
        run_id = row["run_id"]
        sub_id = row["submission_id"]
        chal_id = row["challenge_id"]
        print(f"[*] Evaluating submission {sub_id} for challenge {chal_id}...")

        scores, model_used = evaluate_with_nvidia_nim(
            row["scenario_title"],
            row["confidential_body"],
            row["answer_text"],
            conn=conn,
        )

        # Insert evaluation score
        ins_score = """
            INSERT INTO evaluation_scores 
                (run_id, submission_id, financial_mechanics, risk_management, historical_alignment, communication, explanation, evidence)
            VALUES 
                (%s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                financial_mechanics = VALUES(financial_mechanics),
                risk_management = VALUES(risk_management),
                historical_alignment = VALUES(historical_alignment),
                communication = VALUES(communication),
                explanation = VALUES(explanation),
                evidence = VALUES(evidence)
        """
        cursor.execute(ins_score, (
            run_id,
            sub_id,
            scores["financial_mechanics"],
            scores["risk_management"],
            scores["historical_alignment"],
            scores["communication"],
            scores["explanation"],
            json.dumps(scores["evidence"]),
        ))

        # Check platform boardroom grading mode
        cursor.execute("SELECT value FROM platform_settings WHERE `key` = 'boardroom_grading_mode' LIMIT 1")
        gmode_row = cursor.fetchone()
        grading_mode = gmode_row['value'].strip() if (gmode_row and gmode_row.get('value')) else 'ai'

        if grading_mode == 'admin_review':
            cursor.execute(
                "UPDATE evaluation_runs SET evaluation_state = 'pending_review', model_id = %s WHERE id = %s",
                (model_used, run_id)
            )
            cursor.execute("UPDATE boardroom_challenges SET state = 'evaluating' WHERE id = %s", (chal_id,))
            conn.commit()
            print(f"[+] Evaluated run {run_id}: Held in 'pending_review' for Admin Grading Desk approval.")
        else:
            cursor.execute(
                "UPDATE evaluation_runs SET evaluation_state = 'complete', model_id = %s, completed_at = NOW(3) WHERE id = %s",
                (model_used, run_id)
            )
            cursor.execute("UPDATE boardroom_challenges SET state = 'settled' WHERE id = %s", (chal_id,))
            conn.commit()
            print(f"[+] Evaluated run {run_id}: Total Score = {sum([scores['financial_mechanics'], scores['risk_management'], scores['historical_alignment'], scores['communication']]):.1f}/100")

    cursor.close()
    conn.close()
    print("[+] All pending evaluations successfully processed.")


if __name__ == "__main__":
    main()

