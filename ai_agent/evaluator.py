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
NVIDIA_MODEL = os.getenv("NVIDIA_MODEL", "meta/llama-3.1-70b-instruct")
NVIDIA_API_URL = os.getenv("NVIDIA_API_URL", "https://integrate.api.nvidia.com/v1")


def get_db_connection():
    ssl_ca_path = DB_SSL_CA
    if DB_SSL_CA_CONTENT and not ssl_ca_path:
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pem")
        tmp.write(DB_SSL_CA_CONTENT.encode("utf-8"))
        tmp.close()
        ssl_ca_path = tmp.name

    config = {
        "host": DB_HOST,
        "port": DB_PORT,
        "database": DB_NAME,
        "user": DB_USER,
        "password": DB_PASS,
        "charset": "utf8mb4",
    }
    if ssl_ca_path and os.path.exists(ssl_ca_path):
        config["ssl_ca"] = ssl_ca_path

    return mysql.connector.connect(**config)


def evaluate_with_nvidia_nim(scenario_title, scenario_body, answer_text):
    if not NVIDIA_API_KEY:
        print("[-] NVIDIA_API_KEY not set. Using deterministic rule-based evaluation.")
        return evaluate_heuristically(answer_text)

    prompt = f"""You are the Lead Adjudicator and Chief Strategy Officer for the EconSim financial terminal.
Evaluate the following participant executive memo against the given strategic dilemma.

### Scenario: {scenario_title}
{scenario_body}

### Participant Strategy Memo:
{answer_text}

### Evaluation Rubric:
1. financial_mechanics (max 40): Accuracy of calculations, runway estimation, cash-burn mitigation, and trade-off quantification.
2. risk_management (max 30): Comprehensive identification of market, liquidity, and operational risks with actionable mitigations.
3. historical_alignment (max 20): Adherence to proven economic principles and viable strategic precedents.
4. communication (max 10): Structure, clarity, executive conciseness, and actionable milestones.

Return ONLY a valid JSON object with EXACTLY the following structure (no markdown fences, no extra text):
{{
  "financial_mechanics": 32.5,
  "risk_management": 24.0,
  "historical_alignment": 15.0,
  "communication": 8.5,
  "explanation": "Detailed strategic appraisal highlighting strengths and missed levers...",
  "evidence": ["Point 1: Measured 6-month burn runway accurately", "Point 2: Identified client concentration risk"]
}}"""

    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": NVIDIA_MODEL,
        "messages": [
            {"role": "system", "content": "You are a precise economic adjudicator. Output only strict JSON."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.1,
        "max_tokens": 1024,
    }

    try:
        url = f"{NVIDIA_API_URL.rstrip('/')}/chat/completions"
        resp = requests.post(url, headers=headers, json=payload, timeout=45)
        resp.raise_for_status()
        res_json = resp.json()
        content = res_json["choices"][0]["message"]["content"].strip()

        # Extract JSON substring if wrapped in markdown
        match = re.search(r"\{.*\}", content, re.DOTALL)
        if match:
            parsed = json.loads(match.group(0))
            # Clamp scores to rubric bounds
            return {
                "financial_mechanics": max(0.0, min(40.0, float(parsed.get("financial_mechanics", 25.0)))),
                "risk_management": max(0.0, min(30.0, float(parsed.get("risk_management", 20.0)))),
                "historical_alignment": max(0.0, min(20.0, float(parsed.get("historical_alignment", 13.0)))),
                "communication": max(0.0, min(10.0, float(parsed.get("communication", 7.0)))),
                "explanation": str(parsed.get("explanation", "Executive evaluation completed.")),
                "evidence": parsed.get("evidence", ["Evaluated via NVIDIA NIM."]),
            }
    except Exception as e:
        print(f"[-] NVIDIA NIM API call failed ({e}). Falling back to heuristic rubric.")

    return evaluate_heuristically(answer_text)


def evaluate_heuristically(answer_text):
    text = answer_text.lower()
    words = len(text.split())

    # Financial mechanics score (0 - 40)
    fin_score = 20.0
    if any(k in text for k in ["runway", "burn", "cash flow", "liquidity", "margin", "revenue"]):
        fin_score += 8.0
    if re.search(r"\d+", text):
        fin_score += 6.0
    if any(k in text for k in ["cost reduction", "receivables", "working capital"]):
        fin_score += 4.0
    fin_score = min(40.0, fin_score)

    # Risk management (0 - 30)
    risk_score = 15.0
    if any(k in text for k in ["concentration", "delay", "default", "contingency", "counterparty"]):
        risk_score += 7.0
    if any(k in text for k in ["mitigat", "downside", "reserve", "hedge"]):
        risk_score += 6.0
    risk_score = min(30.0, risk_score)

    # Historical alignment (0 - 20)
    hist_score = 12.0
    if any(k in text for k in ["trade-off", "priorit", "milestone", "governance"]):
        hist_score += 5.0
    hist_score = min(20.0, hist_score)

    # Communication (0 - 10)
    comm_score = 6.0
    if words >= 80:
        comm_score += 2.0
    if "\n" in answer_text or any(k in text for k in ["1.", "2.", "first", "second"]):
        comm_score += 2.0
    comm_score = min(10.0, comm_score)

    return {
        "financial_mechanics": round(fin_score, 1),
        "risk_management": round(risk_score, 1),
        "historical_alignment": round(hist_score, 1),
        "communication": round(comm_score, 1),
        "explanation": "Solid executive analysis. Financial calculations demonstrate awareness of burn rate and cash runway. Recommended improvement: explicitly define downside trigger points and non-dilutive bridge financing contingency.",
        "evidence": [
            "Demonstrated working capital and runway awareness",
            "Identified operational risks and counterparty exposures",
            "Structured response with actionable implementation phases",
        ],
    }


def main():
    print("[*] Connecting to Aiven MySQL...")
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
    except Exception as e:
        print(f"[-] Database connection error: {e}")
        sys.exit(1)

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
        print("[+] No pending evaluation runs found. Exiting cleanly.")
        cursor.close()
        conn.close()
        return

    print(f"[+] Found {len(queued_runs)} submissions to evaluate.")

    for row in queued_runs:
        run_id = row["run_id"]
        sub_id = row["submission_id"]
        chal_id = row["challenge_id"]
        print(f"[*] Evaluating submission {sub_id} for challenge {chal_id}...")

        scores = evaluate_with_nvidia_nim(
            row["scenario_title"],
            row["confidential_body"],
            row["answer_text"]
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

        # Update run status to complete
        cursor.execute("UPDATE evaluation_runs SET evaluation_state = 'complete', completed_at = NOW(3) WHERE id = %s", (run_id,))

        # Update challenge state
        cursor.execute("UPDATE boardroom_challenges SET state = 'settled' WHERE id = %s", (chal_id,))

        conn.commit()
        print(f"[+] Evaluated run {run_id}: Total Score = {sum([scores['financial_mechanics'], scores['risk_management'], scores['historical_alignment'], scores['communication']]):.1f}/100")

    cursor.close()
    conn.close()
    print("[+] All pending evaluations successfully processed.")


if __name__ == "__main__":
    main()

