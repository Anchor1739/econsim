# EconSim — Financial Intelligence & Strategy Platform

EconSim is an educational financial intelligence terminal designed for African and emerging-market students, founders, and strategists. Users study macroeconomic catalysts, forecast economic contracts with virtual capital (VNGN), and compete in the Boardroom on confidential corporate dilemmas with explainable AI evaluation.

---

## 🏛 System Architecture

- **Database**: Aiven MySQL 8.0.16+ (InnoDB, `utf8mb4_0900_ai_ci`, strict mode, TLS/SSL connection with CA certificate verification).
- **Backend**: Lightweight PHP 8.2+ REST API (`public/index.php`), zero framework bloat, PDO MySQL with prepared statements, modular services.
- **Double-Entry Ledger**: Append-only double-entry engine (`ledger_accounts`, `ledger_journals`, `ledger_entries`) with row-level locks (`SELECT ... FOR UPDATE`), idempotency keys, and zero-sum balance guarantees ($\sum \Delta = 0$).
- **Frontend**: Clean, responsive modern HTML5 / CSS / Vanilla JS financial terminal (Space Grotesk & DM Sans typography, Light & Dark themes, real REST API integration).
- **AI Agent Modeling**: Python 3.11+ evaluation runner (`ai_agent/evaluator.py`) using **NVIDIA NIM API** (`integrate.api.nvidia.com/v1`) with the 40/30/20/10 rubric.
- **Orchestration**: Scheduled GitHub Actions cron (`.github/workflows/ai_evaluation.yml`) running every 10 minutes to poll and evaluate pending Boardroom strategy memos in Aiven MySQL.
- **Transactional Mail**: Direct cURL API (Resend / SendGrid) with local debug logging fallback.
- **Hosting**: Render (`render.yaml`).

---

## 📁 Repository Structure

```text
econsim/
├── .github/
│   └── workflows/
│       └── ai_evaluation.yml       # Scheduled GitHub Actions cron for AI evaluation
├── ai_agent/
│   ├── evaluator.py                # Python batch evaluator using NVIDIA NIM
│   └── requirements.txt            # Python dependencies (mysql-connector, requests)
├── bin/
│   ├── migrate.php                 # CLI migration tool for Aiven MySQL
│   └── seed.php                    # CLI seed data generator
├── database/
│   ├── 001_schema_mysql.sql        # Authoritative MySQL 8.0 DDL
│   └── seed_demo_data.sql          # Curated Nigerian economic markets & scenarios
├── public/
│   ├── index.html                  # Main terminal SPA HTML5 shell
│   ├── index.php                   # Front-controller for PHP REST API & static router
│   ├── css/
│   │   └── app.css                 # Financial terminal styling (Dark & Light)
│   └── js/
│       ├── api.js                  # Typed API fetch client & session handler
│       └── app.js                  # Frontend SPA controller
├── src/
│   ├── Config/
│   │   ├── Database.php            # Aiven MySQL PDO connection with SSL CA
│   │   └── Env.php                 # Lightweight .env configuration loader
│   ├── Controllers/
│   │   ├── AuthController.php      # Register, login, verify email, forgot/reset password
│   │   ├── WalletController.php    # Double-entry balance, ledger history
│   │   ├── MarketController.php    # Markets, Study Contexts, forecast commitments
│   │   ├── BoardroomController.php # Challenge creation, matching, submissions
│   │   └── ProfileController.php   # User profile, preferences, leaderboard, mentor
│   ├── Services/
│   │   ├── AuthService.php         # Password hashing, token management, sessions
│   │   ├── LedgerService.php       # Double-entry ledger with atomic row locks
│   │   ├── MailerService.php       # Resend / SendGrid transactional email client
│   │   ├── PredictorService.php    # Probability quotes, position recording
│   │   ├── BoardroomService.php    # Confidential case gatekeeping, submission queue
│   │   └── ProfileService.php      # Leaderboard, AI mentor, Scenario Lab simulation
│   ├── Utils/
│   │   ├── Response.php            # Standard JSON response formatter
│   │   └── Security.php            # UUIDv4, token hashing, input sanitization
│   └── Router.php                  # Lightweight REST route dispatcher
├── .env.example                    # Configuration template (names only)
├── render.yaml                     # Render Web Service deployment blueprint
├── composer.json                   # PHP package definition (PSR-4 autoloading)
└── README.md                       # Platform documentation
```

---

## 🚀 Local Development Setup

### 1. Prerequisites
- **PHP 8.2+** with extensions `pdo_mysql`, `curl`, `json`, `mbstring`, `openssl`.
- **Composer**.
- **Python 3.11+**.
- An **Aiven MySQL** database instance (or local MySQL 8.0).

### 2. Install PHP Dependencies
```bash
composer dump-autoload
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your database and API credentials in `.env`:
```ini
DB_HOST=mysql-xxxx-xxxx.aivencloud.com
DB_PORT=25060
DB_NAME=econsim
DB_USER=avnadmin
DB_PASSWORD=your_aiven_password
DB_SSL_CA_CONTENT="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
DB_SSL_VERIFY=true

NVIDIA_API_KEY=nvapi-your-key-here
NVIDIA_MODEL=meta/llama-3.1-70b-instruct

MAILER_PROVIDER=resend
MAILER_API_KEY=re_your_api_key
MAILER_FROM_EMAIL=onboarding@resend.dev
```

### 4. Run Migrations & Seed Data
Execute the migration script to apply `database/001_schema_mysql.sql` and `database/seed_demo_data.sql`:
```bash
php bin/migrate.php
```

### 5. Start the Local Server
```bash
php -S 0.0.0.0:8000 -t public
```
Visit `http://localhost:8000` in your browser.

---

## 🤖 Python AI Agent & GitHub Actions (NVIDIA NIM)

The Python evaluation agent runs in `ai_agent/evaluator.py`. It polls Aiven MySQL for queued executive memos submitted in the Boardroom, calls NVIDIA NIM with a strict 40/30/20/10 rubric, and stores scores.

### Local Test Run:
```bash
cd ai_agent
pip install -r requirements.txt
python evaluator.py
```

### GitHub Actions Setup:
In your GitHub repository, navigate to **Settings > Secrets and variables > Actions** and add the following repository secrets:
1. `DB_HOST`: Your Aiven MySQL hostname.
2. `DB_PORT`: `25060` (or your Aiven port).
3. `DB_NAME`: `econsim`
4. `DB_USER`: `avnadmin`
5. `DB_PASSWORD`: Your Aiven MySQL password.
6. `DB_SSL_CA_CONTENT`: The text of your Aiven CA certificate (`ca.pem`).
7. `NVIDIA_API_KEY`: Your NVIDIA NIM API key (`nvapi-...`).

The workflow `.github/workflows/ai_evaluation.yml` will automatically poll and score every 10 minutes.

---

## 🌐 Deploying to Render

1. Connect your GitHub repository to **Render** (`https://render.com`).
2. Create a new **Web Service**.
3. In the **Language / Runtime** selection, choose **Docker** (Render does not have a native PHP runtime, so PHP runs via Docker).
4. Render will automatically detect the [Dockerfile](file:///c:/Users/user/Documents/econsim/Dockerfile) in the root.
5. In Render's **Environment Variables** tab, add:
   - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
   - `DB_SSL_CA_CONTENT`: Paste the raw text of your Aiven MySQL CA certificate.
   - `MAILER_API_KEY`: (Optional) Your Resend or SendGrid API key.
6. Click **Deploy Web Service**! Render will build the container and serve the EconSim terminal.

---

## ⚖️ Financial Rules & Safety

1. **Virtual Currency Only**: All balances are in `VNGN` (Virtual Nigerian Naira) for educational financial literacy. They have zero monetary value, cannot be deposited, and cannot be withdrawn or exchanged for cash.
2. **Double-Entry Ledger**: Authoritative balances are calculated exclusively from `ledger_entries`. Direct balance edits are prohibited.
3. **Boardroom Confidentiality**: Scenarios, rubrics, and opponent answers remain strictly sealed server-side until verified conditions are satisfied.
4. **Real Mode**: Clearly labeled preview mode that is strictly disabled until regulatory signoff and licensed payment processor integration are completed.

