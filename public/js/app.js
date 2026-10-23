// EconSim Main Application Controller
let state = {
  user: null,
  page: 'dashboard',
  theme: localStorage.getItem('econsim-theme') || 'light',
  mode: localStorage.getItem('econsim-mode') || 'demo',
  markets: [],
  selectedMarketId: null,
  marketFilter: 'All',
  boardroomLobby: [],
  currentChallengeId: null,
  activeChallenge: null,
  mentorHistory: [],
  wallet: { available: 500000, held: 0, total: 500000 },
  realWallet: { available: 0, held: 0, total: 0 },
  activeProvider: { slug: 'flutterwave', display_name: 'Flutterwave', status: 'sandbox' },
  features: {},
  leaderboardTab: 'Overall',
  lab: { rate: 20, inflation: 24, spend: 12 },
};

function formatMoney(n) {
  return '₦' + Math.round(Number(n) || 0).toLocaleString('en-NG');
}

function applyTheme(t) {
  state.theme = t;
  localStorage.setItem('econsim-theme', t);
  if (t === 'dark') {
    document.body.classList.add('theme-dark');
  } else {
    document.body.classList.remove('theme-dark');
  }
}

async function initApp() {
  applyTheme(state.theme);

  // Check URL query parameters for payment return verification
  const urlParams = new URLSearchParams(window.location.search);
  const ref = urlParams.get('ref') || urlParams.get('tx_ref');
  if (ref) {
    try {
      const v = await api.get(`/funding/verify/${encodeURIComponent(ref)}`);
      api.toast(v.message || 'Deposit verified and credited successfully!', 'success');
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) {}
  }

  try {
    const res = await api.get('/auth/me');
    if (res?.data) {
      state.user = res.data;
      if (res.data.wallet) {
        state.wallet = res.data.wallet;
      }
      if (res.data.theme) {
        applyTheme(res.data.theme);
      }
      navigate('dashboard');
      return;
    }
  } catch (e) {
    // Unauthenticated -> welcome screen
  }

  navigate('welcome');
}

function navigate(page, params = {}) {
  state.page = page;
  if (params.marketId) state.selectedMarketId = params.marketId;
  if (params.challengeId) state.currentChallengeId = params.challengeId;

  window.scrollTo({ top: 0, behavior: 'smooth' });
  render();
}

function render() {
  const root = document.getElementById('app');
  if (!root) return;

  if (['welcome', 'login', 'signup', 'verify', 'forgot', 'reset'].includes(state.page)) {
    root.innerHTML = renderAuthPage(state.page);
    return;
  }

  if (state.page === 'onboarding') {
    root.innerHTML = renderOnboardingPage();
    return;
  }

  // Authenticated Shell Pages
  let content = '';
  switch (state.page) {
    case 'dashboard': content = renderDashboard(); break;
    case 'predictor': content = renderPredictor(); break;
    case 'market': content = renderMarketDetail(); break;
    case 'boardroom': content = renderBoardroom(); break;
    case 'create_challenge': content = renderCreateChallenge(); break;
    case 'waiting_room': content = renderWaitingRoom(); break;
    case 'live_challenge': content = renderLiveChallenge(); break;
    case 'challenge_report': content = renderChallengeReport(); break;
    case 'wallet': content = renderWalletPage(); break;
    case 'leaderboard': content = renderLeaderboardPage(); break;
    case 'mentor': content = renderMentorPage(); break;
    case 'lab': content = renderScenarioLab(); break;
    case 'admin': content = renderAdminPage(); break;
    case 'profile': content = renderProfilePage(); break;
    case 'settings': content = renderSettingsPage(); break;
    default: content = renderDashboard(); break;
  }

  root.innerHTML = renderAppShell(content);
  attachViewEvents();
}

// -------------------------------------------------------------
// App Shell Layout
// -------------------------------------------------------------
function renderAppShell(innerHtml) {
  const navItems = [
    { id: 'dashboard', icon: '⌂', label: 'Dashboard' },
    { id: 'predictor', icon: '◈', label: 'The Predictor' },
    { id: 'boardroom', icon: '▦', label: 'The Boardroom' },
    { id: 'wallet', icon: '▣', label: 'Ledger Wallet' },
    { id: 'leaderboard', icon: '♛', label: 'Leaderboard' },
    { id: 'mentor', icon: '✧', label: 'AI Mentor' },
    { id: 'lab', icon: '⚗', label: 'Scenario Lab' },
    { id: 'admin', icon: '⚡', label: 'Admin Console' },
    { id: 'profile', icon: '◉', label: 'Profile' },
    { id: 'settings', icon: '⚙', label: 'Settings' },
  ];

  const userInitial = (state.user?.display_name || 'A')[0].toUpperCase();
  const xp = 1240; // baseline

  return `
    <div class="app-container">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-icon">↗</div>
          <span>econsim<b>.</b></span>
        </div>
        <div class="sidebar-label">WORKSPACE</div>
        ${navItems.slice(0, 8).map(item => `
          <button class="nav-item ${state.page === item.id ? 'active' : ''}" onclick="navigate('${item.id}')">
            <span>${item.icon}</span>
            <span class="text">${item.label}</span>
          </button>
        `).join('')}

        <div class="sidebar-label">ACCOUNT</div>
        ${navItems.slice(8).map(item => `
          <button class="nav-item ${state.page === item.id ? 'active' : ''}" onclick="navigate('${item.id}')">
            <span>${item.icon}</span>
            <span class="text">${item.label}</span>
          </button>
        `).join('')}

        <div class="sidebar-footer">
          <div class="level-card">
            <b>Strategic Analyst</b>
            <small>LEVEL 03 · ${xp} XP</small>
            <div class="progress-bar"><i style="width: 62%;"></i></div>
          </div>
          <button class="nav-item" onclick="handleLogout()">
            <span>↪</span>
            <span class="text">Sign out</span>
          </button>
        </div>
      </aside>

      <div class="main-wrapper">
        <header class="topbar">
          <div class="breadcrumb">
            ECONSIM <span>/</span> ${state.page.replace('_', ' ').toUpperCase()}
          </div>
          <div class="top-actions">
            <div class="mode-toggle">
              <button class="mode-btn ${state.mode === 'Demo' ? 'active' : ''}" onclick="switchMode('Demo')">Demo</button>
              <button class="mode-btn ${state.mode === 'Real' ? 'active' : ''}" onclick="switchMode('Real')">Real</button>
            </div>
            <span class="sim-tag">● SIMULATION MODE</span>
            <div class="wallet-badge" onclick="navigate('wallet')" style="cursor: pointer;">
              <span>◈</span> ${formatMoney(state.wallet.available)}
            </div>
            <button class="avatar-btn" onclick="navigate('profile')">${userInitial}</button>
          </div>
        </header>

        <main class="content-body">
          ${state.mode === 'Real' ? `
            <div class="panel" style="border-left: 4px solid var(--gold); background: var(--gold-light); color: var(--gold); margin-bottom: 24px;">
              <b>Real Mode Preview</b>: Real-money funding, cash-equivalent points, and paid challenges are currently inactive pending regulatory approvals.
              <button class="btn btn-secondary" style="margin-left: 12px; padding: 4px 10px; font-size: 12px;" onclick="switchMode('Demo')">Return to Demo</button>
            </div>
          ` : ''}
          ${innerHtml}
        </main>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// Dashboard View
// -------------------------------------------------------------
function renderDashboard() {
  const name = state.user?.display_name || 'Strategist';

  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">FINANCIAL INTELLIGENCE TERMINAL</div>
        <h1>Good to see you, ${name.split(' ')[0]}.</h1>
        <p>Every good financial decision begins with a sharper question.</p>
      </div>
      <button class="btn btn-primary" onclick="navigate('predictor')">Explore Markets ↗</button>
    </div>

    <div class="metrics-row">
      <div class="metric-card">
        <span>Available Virtual Capital</span>
        <strong>${formatMoney(state.wallet.available)}</strong>
        <small>Educational funds only</small>
      </div>
      <div class="metric-card">
        <span>Financial Literacy XP</span>
        <strong>1,240 XP</strong>
        <small>Level 03: Strategic Analyst</small>
      </div>
      <div class="metric-card">
        <span>Active Forecasts</span>
        <strong>2 Open</strong>
        <small>Ledger held commitments</small>
      </div>
      <div class="metric-card">
        <span>Boardroom Sessions</span>
        <strong>3 Completed</strong>
        <small>Executive strategy exercises</small>
      </div>
    </div>

    <div class="two-col">
      <div class="panel">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h2>Macroeconomic Catalysts</h2>
          <button class="btn btn-secondary" style="font-size: 12px; padding: 6px 12px;" onclick="navigate('predictor')">View All ↗</button>
        </div>
        <div id="dashboard-markets-preview">
          <p class="muted">Loading market events...</p>
        </div>
      </div>

      <div>
        <div class="panel" style="background: linear-gradient(145deg, #102640, #0b1a2d); color: #fff; border: none;">
          <div class="eyebrow" style="color: #38bdf8;">STRATEGY ARENA</div>
          <h2 style="color: #fff; margin: 8px 0;">The Boardroom</h2>
          <p style="color: #cbd5e1; font-size: 13.5px; margin-bottom: 18px;">
            Face sealed business dilemmas under timed conditions. Evaluated against the four-pillar rubric via NVIDIA NIM AI.
          </p>
          <button class="btn btn-primary" onclick="navigate('boardroom')">Enter Strategy Lobby ↗</button>
        </div>

        <div class="panel">
          <h2>Quick Learning Desk</h2>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button class="btn btn-secondary btn-full" style="justify-content: flex-start;" onclick="navigate('mentor')">
              <span>✧</span> <b>Ask AI Mentor</b>: Monetary policy & runway
            </button>
            <button class="btn btn-secondary btn-full" style="justify-content: flex-start;" onclick="navigate('lab')">
              <span>⚗</span> <b>Scenario Lab</b>: Test interest rate shocks
            </button>
            <button class="btn btn-secondary btn-full" style="justify-content: flex-start;" onclick="navigate('leaderboard')">
              <span>♛</span> <b>Leaderboard</b>: Check learning rankings
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// Predictor View
// -------------------------------------------------------------
function renderPredictor() {
  const industries = [
    'All',
    'Monetary Policy',
    'Equities',
    'Energy',
    'Agriculture',
    'FX & Reserves',
    'Fintech',
    'Manufacturing',
    'Telecoms & Digital',
    'Real Estate & Infra',
    'FMCG & Retail',
    'Aviation & Logistics'
  ];

  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">THE PREDICTOR</div>
        <h1>Macroeconomic & Market Forecasts</h1>
        <p>Explore economic contracts across 11 key industries, analyze fundamentals, and test your thesis.</p>
      </div>
      <button class="btn btn-secondary" onclick="loadPredictorData()">Refresh Markets ↺</button>
    </div>

    <div style="display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;">
      ${industries.map(f => `
        <button class="btn ${state.marketFilter.toLowerCase() === f.toLowerCase() ? 'btn-primary' : 'btn-secondary'}" 
                style="padding: 6px 14px; font-size: 12px; border-radius: 20px;" 
                onclick="setMarketFilter('${f}')">${f}</button>
      `).join('')}
    </div>

    <div class="market-grid" id="markets-container">
      <p class="muted">Loading market contracts...</p>
    </div>
  `;
}

function renderMarketCard(m) {
  const prob = m.probability_yes || 50;
  return `
    <div class="market-card" onclick="navigate('market', { marketId: '${m.id}' })">
      <div class="market-top">
        <span class="market-tag">${m.industry_name || 'Macro'}</span>
        <span style="font-size: 11px; color: var(--muted);">${m.closes_at ? m.closes_at.substring(0, 10) : 'Open'}</span>
      </div>
      <h3>${m.title}</h3>
      <div class="prob-split">
        <span class="yes">Yes ${prob}%</span>
        <span class="no">No ${100 - prob}%</span>
      </div>
      <div class="prob-bar"><i style="width: ${prob}%;"></i></div>
      <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid var(--line);">
        <small style="color: var(--muted);">Study Context available</small>
        <span style="color: var(--jade); font-weight: bold; font-size: 13px;">Analyze ↗</span>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// Market Detail View
// -------------------------------------------------------------
function renderMarketDetail() {
  return `
    <div style="margin-bottom: 16px;">
      <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="navigate('predictor')">← Back to Predictor</button>
    </div>
    <div id="market-detail-container">
      <p class="muted">Loading market intelligence...</p>
    </div>
  `;
}

// -------------------------------------------------------------
// Boardroom Views
// -------------------------------------------------------------
function renderBoardroom() {
  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">THE BOARDROOM</div>
        <h1>Prove Your Thinking. Not Your Luck.</h1>
        <p>Compete on real-world business dilemmas, submit executive strategy memos, and receive AI evaluations.</p>
      </div>
      <button class="btn btn-primary" onclick="navigate('create_challenge')">+ Create Challenge ↗</button>
    </div>

    <div class="panel" style="background: linear-gradient(135deg, #102640, #142841); color: #fff; border: none; margin-bottom: 24px;">
      <div class="eyebrow" style="color: #38bdf8;">CONFIDENTIALITY PROTOCOL</div>
      <h3 style="color: #fff; margin: 6px 0 10px;">The business case remains strictly sealed until match start.</h3>
      <p style="color: #cbd5e1; font-size: 13.5px; max-width: 780px;">
        To ensure fair competition, scenario descriptions, historical parallels, and grading rubrics are excluded from all lobby APIs and SSR bundles. They are released only to verified participants upon live entry.
      </p>
    </div>

    <h2>Open Lobby Challenges</h2>
    <div class="market-grid" id="boardroom-lobby-container">
      <p class="muted">Loading open boardroom challenges...</p>
    </div>
  `;
}

function renderCreateChallenge() {
  return `
    <div style="margin-bottom: 16px;">
      <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;" onclick="navigate('boardroom')">← Back to Lobby</button>
    </div>
    <div class="page-head">
      <div>
        <div class="eyebrow">CREATE BOARDROOM CHALLENGE</div>
        <h1>Configure Your Strategy Arena</h1>
        <p>Choose an industry and commitment. The specific business dilemma will be assigned confidentially server-side.</p>
      </div>
    </div>

    <div class="two-col">
      <div class="panel">
        <form onsubmit="handleCreateChallenge(event)">
          <div class="form-group">
            <label>Industry</label>
            <select class="select" id="create-industry">
              <option value="1">Monetary Policy</option>
              <option value="2">Equities</option>
              <option value="3">Energy</option>
              <option value="4">Agriculture</option>
              <option value="5">FX & Reserves</option>
              <option value="6">Fintech</option>
              <option value="7">Manufacturing</option>
              <option value="8">Telecoms & Digital</option>
              <option value="9">Real Estate & Infra</option>
              <option value="10">FMCG & Retail</option>
              <option value="11">Aviation & Logistics</option>
            </select>
          </div>
          <div class="form-group">
            <label>Virtual Commitment (₦)</label>
            <input class="input" type="number" id="create-stake" min="1000" step="1000" value="10000" required>
            <small style="color: var(--muted);">Held in escrow from your available virtual capital.</small>
          </div>
          <div class="form-group">
            <label>Response Window</label>
            <select class="select" id="create-duration">
              <option value="15">15 Minutes</option>
              <option value="20">20 Minutes</option>
              <option value="30">30 Minutes</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary btn-full" style="margin-top: 14px;">Publish Challenge to Lobby ↗</button>
        </form>
      </div>

      <div class="panel">
        <h2>Challenge Mechanics</h2>
        <ul style="padding-left: 18px; color: var(--muted); font-size: 13.5px; line-height: 1.8;">
          <li><b>Escrow Hold</b>: Commitments are locked atomically via the double-entry ledger.</li>
          <li><b>Grace Period</b>: 10-minute arrival window before forfeit.</li>
          <li><b>Typed Response</b>: Minimum 40 characters; no multiple choice.</li>
          <li><b>Four-Pillar Rubric</b>: Financial Mechanics 40%, Risk Management 30%, Historical Alignment 20%, Communication 10%.</li>
        </ul>
      </div>
    </div>
  `;
}

function renderWaitingRoom() {
  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">BOARDROOM / WAITING ROOM</div>
        <h1>The Scenario is Sealed</h1>
        <p>Waiting for match countdown. Dilemma content will unlock when live.</p>
      </div>
    </div>
    <div id="waiting-room-content"><p class="muted">Loading challenge details...</p></div>
  `;
}

function renderLiveChallenge() {
  return `
    <div id="live-challenge-content"><p class="muted">Initializing confidential case...</p></div>
  `;
}

function renderChallengeReport() {
  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">POST-MATCH LEARNING REVIEW</div>
        <h1>AI Evaluation & Learning Breakdown</h1>
        <p>Adjudicated by NVIDIA NIM against the strategic rubric.</p>
      </div>
      <button class="btn btn-secondary" onclick="navigate('boardroom')">Back to Lobby ↗</button>
    </div>
    <div id="challenge-report-content"><p class="muted">Loading assessment report...</p></div>
  `;
}

// -------------------------------------------------------------
// Double-Entry Ledger Wallet View
// -------------------------------------------------------------
function renderWalletPage() {
  const isReal = state.mode === 'real';
  const activeBal = isReal ? state.realWallet : state.wallet;
  const currLabel = isReal ? 'NGN' : 'VNGN';
  const providerName = state.activeProvider?.display_name || 'Flutterwave';
  const providerStatus = state.activeProvider?.status || 'sandbox';

  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">DOUBLE-ENTRY LEDGER WALLET</div>
        <h1>Capital & Activity Ledger</h1>
        <p>Immutable append-only ledger entries for virtual educational capital and verified real funds.</p>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn ${!isReal ? 'btn-primary' : 'btn-secondary'}" onclick="switchWalletMode('demo')">Virtual (VNGN)</button>
        <button class="btn ${isReal ? 'btn-primary' : 'btn-secondary'}" onclick="switchWalletMode('real')">Live Real (NGN)</button>
        <button class="btn btn-secondary" onclick="loadWalletData()">Refresh ↺</button>
      </div>
    </div>

    <div class="metrics-row">
      <div class="metric-card">
        <span>Available Balance</span>
        <strong style="color: var(--jade);">${formatMoney(activeBal.available || 0)}</strong>
        <small>${currLabel} available for allocations</small>
      </div>
      <div class="metric-card">
        <span>Reserved in Escrow</span>
        <strong>${formatMoney(activeBal.held || 0)}</strong>
        <small>Active forecast & boardroom holds</small>
      </div>
      <div class="metric-card">
        <span>Total Ledger Balance</span>
        <strong>${formatMoney(activeBal.total || 0)}</strong>
        <small>Sum of available and held accounts</small>
      </div>
      <div class="metric-card">
        <span>Active Payment Gateway</span>
        <strong>${providerName}</strong>
        <small><span class="badge-${providerStatus}">${providerStatus.toUpperCase()}</span> gateway ready</small>
      </div>
    </div>

    <div class="two-col" style="margin-bottom: 24px;">
      <div class="panel">
        <div class="eyebrow" style="color: var(--jade);">INSTANT DEPOSIT & FUNDING</div>
        <h2 style="margin: 8px 0 12px;">Fund Real Trading Wallet</h2>
        <p style="color: var(--muted); font-size: 13.5px; margin-bottom: 16px;">
          Direct bank transfer, card, and USSD deposits processed via <b>${providerName}</b> into your atomic double-entry ledger account.
        </p>

        <form onsubmit="handleDepositSubmit(event)">
          <div class="form-group">
            <label>Deposit Amount (₦)</label>
            <input class="input" type="number" id="deposit-amount" min="1000" step="1000" value="5000" required>
            <div style="display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap;">
              ${[1000, 5000, 10000, 25000, 50000].map(amt => `
                <button type="button" class="btn btn-secondary" style="padding: 4px 10px; font-size: 11.5px;" onclick="document.getElementById('deposit-amount').value = ${amt}">₦${amt.toLocaleString()}</button>
              `).join('')}
            </div>
          </div>
          <button type="submit" class="btn btn-primary btn-full" style="margin-top: 16px;">
            Deposit via ${providerName} ↗
          </button>
        </form>
      </div>

      <div class="panel">
        <h2>Ledger Security & Segregation</h2>
        <ul style="padding-left: 18px; color: var(--muted); font-size: 13.5px; line-height: 1.8;">
          <li><b>Zero Cross-Contamination</b>: Virtual demo capital (VNGN) and live funds (NGN) are strictly isolated across separate ledger accounts.</li>
          <li><b>Idempotent Transactions</b>: Every deposit, hold, and settlement carries a unique UUID idempotency key to prevent double credits.</li>
          <li><b>Regulatory Mode Switching</b>: Real money mode can be enabled or paused at any time from the backend Admin console.</li>
        </ul>
      </div>
    </div>

    <div class="panel">
      <h2>Ledger Journal Transactions (${currLabel})</h2>
      <div id="wallet-transactions-table">
        <p class="muted">Loading ledger entries...</p>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// Leaderboard View
// -------------------------------------------------------------
function renderLeaderboardPage() {
  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">COMPETITIVE INTELLIGENCE</div>
        <h1>Leaderboard</h1>
        <p>Recognizing verified accuracy, disciplined risk management, and strategic reasoning.</p>
      </div>
      <button class="btn btn-secondary" onclick="loadLeaderboardData(state.leaderboardTab)">Refresh ↺</button>
    </div>

    <div style="display: flex; gap: 8px; margin-bottom: 20px;">
      ${['Overall', 'Predictor', 'Boardroom'].map(tab => `
        <button class="btn ${state.leaderboardTab === tab ? 'btn-primary' : 'btn-secondary'}" 
                style="padding: 6px 14px; font-size: 12.5px; border-radius: 20px;" 
                onclick="loadLeaderboardData('${tab}')">${tab}</button>
      `).join('')}
    </div>

    <div class="panel">
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
        <thead>
          <tr style="border-bottom: 2px solid var(--line); color: var(--muted);">
            <th style="padding: 12px 8px;">Rank</th>
            <th style="padding: 12px 8px;">Strategist</th>
            <th style="padding: 12px 8px;">Literacy Level</th>
            <th style="padding: 12px 8px; text-align: right;">Total XP</th>
          </tr>
        </thead>
        <tbody id="leaderboard-table-body">
          <tr><td colspan="4" style="padding: 24px; text-align: center;" class="muted">Loading leaderboard data...</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

// -------------------------------------------------------------
// AI Mentor View
// -------------------------------------------------------------
function renderMentorPage() {
  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">FINANCIAL REASONING ASSISTANT</div>
        <h1>AI Mentor</h1>
        <p>Ask economic, valuation, and financial management questions with structured guidance.</p>
      </div>
    </div>

    <div class="two-col">
      <div class="panel" style="display: flex; flex-direction: column; min-height: 480px;">
        <div id="mentor-chat-thread" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; margin-bottom: 16px;">
          <div style="background: var(--bg); padding: 14px; border-radius: 8px;">
            <b>✧ EconSim Mentor</b>: What economic catalyst or corporate dilemma would you like to examine today?
          </div>
          ${state.mentorHistory.map(m => `
            <div style="align-self: flex-end; background: var(--navy); color: #fff; padding: 12px 16px; border-radius: 12px; max-width: 80%;">
              ${m.q}
            </div>
            <div style="background: var(--bg); border: 1px solid var(--line); padding: 14px 16px; border-radius: 12px; max-width: 90%;">
              <b style="color: var(--jade);">✧ EconSim Mentor</b>
              <p style="margin-top: 6px;">${m.a}</p>
              <small style="color: var(--muted); display: block; margin-top: 8px;">Source: ${m.source || 'Macro Framework'}</small>
            </div>
          `).join('')}
        </div>

        <form onsubmit="handleAskMentor(event)" style="display: flex; gap: 8px;">
          <input class="input" id="mentor-input" placeholder="Ask about CBN rates, cash runway, inflation drivers..." required>
          <button type="submit" class="btn btn-primary">Ask ↗</button>
        </form>
      </div>

      <div class="panel">
        <h2>Quick Prompt Explorations</h2>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${[
            "What drives inflation in Nigeria?",
            "How does a CBN rate hike affect lending?",
            "Calculate cash runway for a startup",
            "How should a CFO identify risk?",
          ].map(q => `
            <button class="btn btn-secondary btn-full" style="justify-content: flex-start; text-align: left; font-size: 13px;" onclick="triggerQuickMentor('${q}')">
              ${q} ↗
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// Scenario Lab View
// -------------------------------------------------------------
function renderScenarioLab() {
  const r = state.lab.rate;
  const inf = state.lab.inflation;
  const sp = state.lab.spend;

  const modeledInf = (inf - 0.3 * (r - 20) + 0.14 * (sp - 12)).toFixed(1);
  const creditIdx = Math.max(10, Math.min(90, Math.round(55 - (r - 20) * 1.65)));
  const investIdx = Math.max(10, Math.min(95, Math.round(64 - (r - 20) * 1.2 + (sp - 12) * 0.6)));

  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">MACROECONOMIC SIMULATOR</div>
        <h1>Scenario Lab</h1>
        <p>Adjust policy variables and inspect modeled macroeconomic consequences.</p>
      </div>
    </div>

    <div class="two-col">
      <div class="panel">
        <h2>Central Bank Controls</h2>
        <div class="form-group" style="margin-top: 18px;">
          <label style="display: flex; justify-content: space-between;">
            <span>Monetary Policy Rate (MPR)</span>
            <b style="color: var(--jade);">${r}%</b>
          </label>
          <input type="range" min="5" max="35" value="${r}" oninput="updateLabParam('rate', this.value)" style="width: 100%;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--muted);"><span>5% Accommodative</span><span>35% Restrictive</span></div>
        </div>

        <div class="form-group" style="margin-top: 18px;">
          <label style="display: flex; justify-content: space-between;">
            <span>Initial Headline Inflation</span>
            <b>${inf}%</b>
          </label>
          <input type="range" min="2" max="40" value="${inf}" oninput="updateLabParam('inflation', this.value)" style="width: 100%;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--muted);"><span>2%</span><span>40%</span></div>
        </div>

        <div class="form-group" style="margin-top: 18px;">
          <label style="display: flex; justify-content: space-between;">
            <span>Fiscal Spending Impulse</span>
            <b>${sp}%</b>
          </label>
          <input type="range" min="0" max="30" value="${sp}" oninput="updateLabParam('spend', this.value)" style="width: 100%;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--muted);"><span>Fiscal Austerity</span><span>Expansionary</span></div>
        </div>

        <button class="btn btn-secondary" style="margin-top: 16px;" onclick="resetLab()">Reset Experiment ↺</button>
      </div>

      <div>
        <div class="metrics-row" style="grid-template-columns: 1fr;">
          <div class="metric-card">
            <span>Modelled Inflation Trajectory</span>
            <strong style="color: ${modeledInf > 20 ? 'var(--red)' : 'var(--jade)'};">${modeledInf}%</strong>
            <small>${r > 20 ? 'Tightening pressure dampening demand CPI' : 'Accommodative stance'}</small>
          </div>
          <div class="metric-card">
            <span>Credit Conditions Index</span>
            <strong>${creditIdx} / 100</strong>
            <small>Higher index reflects looser banking liquidity</small>
          </div>
          <div class="metric-card">
            <span>Private Investment Index</span>
            <strong>${investIdx} / 100</strong>
            <small>Estimated capital expenditure sentiment</small>
          </div>
        </div>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// Profile & Settings
// -------------------------------------------------------------
function renderProfilePage() {
  const user = state.user || {};
  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">ACCOUNT PROFILE</div>
        <h1>Strategist Profile</h1>
        <p>Manage your learner identity and industry concentrations.</p>
      </div>
    </div>

    <div class="two-col">
      <div class="panel">
        <form onsubmit="handleUpdateProfile(event)">
          <div class="form-group">
            <label>Display Name</label>
            <input class="input" id="profile-name" value="${user.display_name || ''}" required>
          </div>
          <div class="form-group">
            <label>Email Address</label>
            <input class="input" value="${user.email || ''}" disabled style="opacity: 0.7;">
          </div>
          <div class="form-group">
            <label>Country / Region</label>
            <select class="select" id="profile-country">
              <option value="NG" ${user.country_code === 'NG' ? 'selected' : ''}>Nigeria</option>
              <option value="GH" ${user.country_code === 'GH' ? 'selected' : ''}>Ghana</option>
              <option value="KE" ${user.country_code === 'KE' ? 'selected' : ''}>Kenya</option>
              <option value="ZA" ${user.country_code === 'ZA' ? 'selected' : ''}>South Africa</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary">Save Profile Changes ↗</button>
        </form>
      </div>

      <div class="panel">
        <h2>Competencies & Achievements</h2>
        <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 14px;">
          <div style="display: flex; gap: 12px; align-items: center;">
            <span style="font-size: 24px;">✦</span>
            <div><b>First Forecast</b><br><small style="color: var(--muted);">Completed initial prediction</small></div>
          </div>
          <div style="display: flex; gap: 12px; align-items: center;">
            <span style="font-size: 24px;">▦</span>
            <div><b>Boardroom Strategist</b><br><small style="color: var(--muted);">Executed executive strategy memo</small></div>
          </div>
          <div style="display: flex; gap: 12px; align-items: center;">
            <span style="font-size: 24px;">♛</span>
            <div><b>Risk Architect</b><br><small style="color: var(--muted);">Demonstrated quantitative downside mitigation</small></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSettingsPage() {
  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">PREFERENCES</div>
        <h1>Workspace Settings</h1>
      </div>
    </div>

    <div class="panel" style="max-width: 600px;">
      <h2>Appearance Theme</h2>
      <div style="display: flex; gap: 10px; margin: 14px 0 24px;">
        <button class="btn ${state.theme === 'light' ? 'btn-primary' : 'btn-secondary'}" onclick="setAppTheme('light')">☼ Light Terminal</button>
        <button class="btn ${state.theme === 'dark' ? 'btn-primary' : 'btn-secondary'}" onclick="setAppTheme('dark')">◑ Dark Mode</button>
      </div>

      <h2>Notifications & Reminders</h2>
      <div style="display: flex; justify-content: space-between; align-items: center; margin: 16px 0;">
        <div>
          <b>Challenge Notifications</b><br>
          <small style="color: var(--muted);">Receive alerts on challenge acceptances</small>
        </div>
        <button class="btn btn-secondary" onclick="api.toast('Notification preferences saved.')">Enabled ✓</button>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// Auth Pages
// -------------------------------------------------------------
function renderAuthPage(type) {
  let title = 'Sign in to EconSim';
  let subtitle = 'Continue your financial intelligence journey.';
  let fieldsHtml = '';
  let footerHtml = '';

  if (type === 'welcome' || type === 'login') {
    fieldsHtml = `
      <div class="form-group">
        <label>Email address</label>
        <input class="input" type="email" id="auth-email" placeholder="you@example.com" required>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input class="input" type="password" id="auth-password" placeholder="••••••••" required>
      </div>
      <button type="submit" class="btn btn-primary btn-full" style="margin-top: 10px;">Sign in ↗</button>
    `;
    footerHtml = `
      <p style="margin-top: 16px; font-size: 13.5px; color: var(--muted);">
        Don't have an account? <button type="button" class="btn-link" style="color: var(--jade); background: none; border: none; font-weight: bold; cursor: pointer;" onclick="navigate('signup')">Sign up</button>
        · <button type="button" class="btn-link" style="color: var(--muted); background: none; border: none; cursor: pointer;" onclick="navigate('forgot')">Forgot password?</button>
      </p>
    `;
  } else if (type === 'signup') {
    title = 'Create your account';
    subtitle = 'Join the educational financial intelligence platform.';
    fieldsHtml = `
      <div class="form-group">
        <label>Full display name</label>
        <input class="input" id="auth-name" placeholder="Alex Morgan" required>
      </div>
      <div class="form-group">
        <label>Email address</label>
        <input class="input" type="email" id="auth-email" placeholder="you@example.com" required>
      </div>
      <div class="form-group">
        <label>Password</label>
        <input class="input" type="password" id="auth-password" placeholder="Min. 8 characters" minlength="8" required>
      </div>
      <button type="submit" class="btn btn-primary btn-full" style="margin-top: 10px;">Create account ↗</button>
    `;
    footerHtml = `
      <p style="margin-top: 16px; font-size: 13.5px; color: var(--muted);">
        Already have an account? <button type="button" class="btn-link" style="color: var(--jade); background: none; border: none; font-weight: bold; cursor: pointer;" onclick="navigate('login')">Sign in</button>
      </p>
    `;
  } else if (type === 'verify') {
    title = 'Verify your email';
    subtitle = 'Enter the 6-digit code dispatched to your email address.';
    fieldsHtml = `
      <div class="form-group">
        <label>Email address</label>
        <input class="input" type="email" id="auth-email" value="${sessionStorage.getItem('verify_email') || ''}" required>
      </div>
      <div class="form-group">
        <label>6-Digit Verification Code</label>
        <input class="input" id="auth-code" maxlength="6" placeholder="123456" style="letter-spacing: 4px; font-size: 18px; text-align: center;" required>
      </div>
      <button type="submit" class="btn btn-primary btn-full" style="margin-top: 10px;">Verify & Continue ↗</button>
    `;
    footerHtml = `
      <p style="margin-top: 16px; font-size: 13.5px; color: var(--muted);">
        Back to <button type="button" class="btn-link" style="color: var(--jade); background: none; border: none; cursor: pointer;" onclick="navigate('login')">Sign in</button>
      </p>
    `;
  } else if (type === 'forgot') {
    title = 'Reset your password';
    subtitle = 'Enter your email to receive a password reset token.';
    fieldsHtml = `
      <div class="form-group">
        <label>Email address</label>
        <input class="input" type="email" id="auth-email" placeholder="you@example.com" required>
      </div>
      <button type="submit" class="btn btn-primary btn-full" style="margin-top: 10px;">Send reset link ↗</button>
    `;
    footerHtml = `
      <p style="margin-top: 16px; font-size: 13.5px; color: var(--muted);">
        Back to <button type="button" class="btn-link" style="color: var(--jade); background: none; border: none; cursor: pointer;" onclick="navigate('login')">Sign in</button>
      </p>
    `;
  }

  return `
    <div class="auth-wrap">
      <div class="auth-hero">
        <div class="brand" style="margin-bottom: 40px;">
          <div class="brand-icon">↗</div>
          <span style="font-size: 24px;">econsim<b>.</b></span>
        </div>
        <div class="eyebrow" style="color: #38bdf8;">FINANCIAL INTELLIGENCE TERMINAL</div>
        <h1>Learn the market.<br>Lead the decision.</h1>
        <p style="color: #cbd5e1; font-size: 16px; max-width: 480px;">
          Forecast economic contracts, solve business dilemmas in the Boardroom, and sharpen your strategic thinking with AI adjudication.
        </p>
      </div>

      <div class="auth-form-wrap">
        <div class="auth-card">
          <div class="eyebrow" style="color: var(--jade);">WELCOME</div>
          <h2 style="font-size: 26px; margin: 4px 0 8px;">${title}</h2>
          <p style="color: var(--muted); margin-bottom: 24px; font-size: 14px;">${subtitle}</p>

          <form onsubmit="handleAuthSubmit(event, '${type}')">
            ${fieldsHtml}
          </form>
          ${footerHtml}
        </div>
      </div>
    </div>
  `;
}

function renderOnboardingPage() {
  return `
    <div class="auth-wrap" style="grid-template-columns: 1fr;">
      <div class="auth-form-wrap">
        <div class="auth-card" style="max-width: 580px;">
          <div class="eyebrow" style="color: var(--jade);">STEP 2 OF 2</div>
          <h2 style="font-size: 28px; margin: 6px 0;">Personalize Your Intelligence Feed</h2>
          <p style="color: var(--muted); margin-bottom: 24px;">
            Choose your primary industries of interest to customize your financial workspace and cases.
          </p>

          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px;">
            ${['Monetary Policy', 'Equities', 'Energy', 'Agriculture', 'FX & Reserves', 'Fintech', 'Manufacturing', 'Telecoms', 'Real Estate', 'FMCG', 'Aviation'].map(ind => `
              <button class="btn btn-secondary" style="border-radius: 20px; font-size: 13px;" onclick="this.classList.toggle('btn-primary'); this.classList.toggle('btn-secondary');">
                ${ind}
              </button>
            `).join('')}
          </div>

          <button class="btn btn-primary btn-full" onclick="navigate('dashboard')">Enter Developing Market Terminal ↗</button>
        </div>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// View Lifecycle & Event Handlers
// -------------------------------------------------------------
function attachViewEvents() {
  if (state.page === 'dashboard') {
    loadDashboardData();
  } else if (state.page === 'predictor') {
    loadPredictorData();
  } else if (state.page === 'market' && state.selectedMarketId) {
    loadMarketDetailData(state.selectedMarketId);
  } else if (state.page === 'boardroom') {
    loadBoardroomLobby();
  } else if (state.page === 'wallet') {
    loadWalletData();
  } else if (state.page === 'leaderboard') {
    loadLeaderboardData(state.leaderboardTab);
  } else if (state.page === 'admin') {
    loadAdminData();
  } else if (state.page === 'waiting_room' && state.currentChallengeId) {
    loadWaitingRoomData(state.currentChallengeId);
  } else if (state.page === 'live_challenge' && state.currentChallengeId) {
    loadLiveChallengeData(state.currentChallengeId);
  } else if (state.page === 'challenge_report' && state.currentChallengeId) {
    loadChallengeReportData(state.currentChallengeId);
  }
}

async function loadDashboardData() {
  try {
    const res = await api.get('/markets');
    if (res?.data) {
      state.markets = res.data;
      const el = document.getElementById('dashboard-markets-preview');
      if (el) {
        el.innerHTML = state.markets.slice(0, 3).map(m => renderMarketCard(m)).join('');
      }
    }
  } catch (e) {}
}

async function loadPredictorData() {
  try {
    const res = await api.get('/markets');
    if (res?.data) {
      state.markets = res.data;
      renderMarketsFiltered();
    }
  } catch (e) {}
}

function renderMarketsFiltered() {
  const el = document.getElementById('markets-container');
  if (!el) return;

  const filter = (state.marketFilter || 'All').toLowerCase();
  const filtered = filter === 'all'
    ? state.markets
    : state.markets.filter(m => 
        (m.industry_name && m.industry_name.toLowerCase() === filter) || 
        (m.industry_slug && m.industry_slug.toLowerCase() === filter)
      );

  if (!filtered.length) {
    el.innerHTML = `
      <div class="panel" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
        <p class="muted">No active contracts found for "${state.marketFilter}".</p>
        <button class="btn btn-secondary" style="margin-top: 12px;" onclick="setMarketFilter('All')">View All Contracts ↗</button>
      </div>
    `;
    return;
  }

  el.innerHTML = filtered.map(m => renderMarketCard(m)).join('');
}

function setMarketFilter(f) {
  state.marketFilter = f;
  navigate('predictor');
}

async function loadMarketDetailData(id) {
  try {
    const res = await api.get(`/markets/${id}`);
    const m = res.data;
    const el = document.getElementById('market-detail-container');
    if (!el) return;

    const prob = m.probability_yes || 50;

    el.innerHTML = `
      <div class="two-col">
        <div>
          <div class="panel">
            <div class="market-top">
              <span class="market-tag">${m.industry_name}</span>
              <span style="color: var(--muted); font-size: 12px;">Closes: ${m.closes_at ? m.closes_at.substring(0, 10) : 'Open'}</span>
            </div>
            <h1 style="font-size: 24px; margin: 8px 0 16px;">${m.title}</h1>
            <div class="prob-split">
              <span class="yes" style="font-size: 16px;">YES ${prob}%</span>
              <span class="no" style="font-size: 16px;">NO ${100 - prob}%</span>
            </div>
            <div class="prob-bar" style="height: 10px;"><i style="width: ${prob}%;"></i></div>
          </div>

          <div class="panel">
            <div class="eyebrow">RESEARCH DESK</div>
            <h2>Study Context & Fundamentals</h2>
            <p style="color: var(--muted); margin-bottom: 16px;">${m.study_summary || 'Evidence and fundamental drivers behind this outcome.'}</p>

            <div style="display: flex; flex-direction: column; gap: 12px;">
              ${(m.metrics || []).map((metric, i) => `
                <div style="background: var(--bg); padding: 12px; border-radius: 8px; border: 1px solid var(--line);">
                  <b>0${i+1}. ${metric[0]}</b>
                  <p style="font-size: 13px; color: var(--muted); margin-top: 4px;">${metric[1]}</p>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div>
          <div class="panel">
            <div class="eyebrow">FORECAST TICKET</div>
            <h2>Make Your Call</h2>

            <form onsubmit="handlePlaceForecast(event, '${m.id}')">
              <div class="form-group">
                <label>Select Outcome</label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                  <button type="button" id="outcome-yes" class="btn btn-primary btn-full" onclick="selectOutcome(true)">YES ${prob}%</button>
                  <button type="button" id="outcome-no" class="btn btn-secondary btn-full" onclick="selectOutcome(false)">NO ${100 - prob}%</button>
                </div>
              </div>

              <div class="form-group" style="margin-top: 14px;">
                <label>Virtual Capital Stake (₦)</label>
                <input class="input" type="number" id="forecast-amount" value="5000" min="100" max="${state.wallet.available}" required>
                <div style="display: flex; gap: 6px; margin-top: 6px;">
                  ${[1000, 5000, 10000].map(a => `
                    <button type="button" class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="document.getElementById('forecast-amount').value = ${a}">₦${a.toLocaleString()}</button>
                  `).join('')}
                </div>
              </div>

              <div class="form-group" style="margin-top: 14px;">
                <label>Optional Decision Journal Thesis</label>
                <textarea class="textarea" id="forecast-thesis" rows="3" placeholder="Document what evidence supports your expectation..."></textarea>
              </div>

              <div style="background: var(--bg); padding: 12px; border-radius: 8px; margin: 16px 0; font-size: 13px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span>Available Balance</span>
                  <b>${formatMoney(state.wallet.available)}</b>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span>Payout Multiplier</span>
                  <b id="payout-estimate">Illustrative demo return</b>
                </div>
              </div>

              <button type="submit" class="btn btn-primary btn-full">Confirm Virtual Commitment ↗</button>
            </form>
          </div>
        </div>
      </div>
    `;
  } catch (e) {}
}

let chosenOutcome = true;
function selectOutcome(val) {
  chosenOutcome = val;
  const yesBtn = document.getElementById('outcome-yes');
  const noBtn = document.getElementById('outcome-no');
  if (val) {
    yesBtn.className = 'btn btn-primary btn-full';
    noBtn.className = 'btn btn-secondary btn-full';
  } else {
    yesBtn.className = 'btn btn-secondary btn-full';
    noBtn.className = 'btn btn-primary btn-full';
  }
}

async function handlePlaceForecast(e, eventId) {
  e.preventDefault();
  const amt = parseInt(document.getElementById('forecast-amount').value, 10);
  const thesis = document.getElementById('forecast-thesis').value;

  try {
    const res = await api.post(`/markets/${eventId}/forecast`, {
      outcome: chosenOutcome,
      amount: amt,
      thesis,
    });
    api.toast(res.message || 'Forecast recorded successfully!', 'success');
    await loadWalletData();
    navigate('predictor');
  } catch (err) {}
}

async function loadBoardroomLobby() {
  try {
    const res = await api.get('/boardroom/lobby');
    const el = document.getElementById('boardroom-lobby-container');
    if (!el) return;

    if (!res?.data?.length) {
      el.innerHTML = `
        <div class="panel" style="grid-column: span 3; text-align: center;">
          <p class="muted">No open challenges in the lobby right now.</p>
          <button class="btn btn-primary" style="margin-top: 12px;" onclick="navigate('create_challenge')">Create Challenge ↗</button>
        </div>
      `;
      return;
    }

    el.innerHTML = res.data.map(c => `
      <div class="panel" style="display: flex; flex-direction: column;">
        <div class="market-top">
          <span class="market-tag">${c.industry}</span>
          <span class="sim-tag">SEALED</span>
        </div>
        <div class="sealed-box">
          <div class="lock">🔒</div>
          <b>Scenario Sealed</b>
          <p style="font-size: 11.5px; color: var(--muted); margin-top: 4px;">Released simultaneously upon match start</p>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 13px;">
          <span>Host: <b>${c.host}</b></span>
          <span>Commitment: <b>${formatMoney(c.commitment)}</b></span>
        </div>
        <button class="btn btn-primary btn-full" style="margin-top: auto;" onclick="handleJoinChallenge('${c.id}')">Accept Challenge ↗</button>
      </div>
    `).join('');
  } catch (e) {}
}

async function handleCreateChallenge(e) {
  e.preventDefault();
  const industryId = parseInt(document.getElementById('create-industry').value, 10);
  const stake = parseInt(document.getElementById('create-stake').value, 10);
  const duration = parseInt(document.getElementById('create-duration').value, 10);

  try {
    const res = await api.post('/boardroom/create', {
      industry_id: industryId,
      stake,
      duration,
    });
    api.toast(res.message, 'success');
    navigate('waiting_room', { challengeId: res.data.challenge_id });
  } catch (err) {}
}

async function handleJoinChallenge(challengeId) {
  try {
    const res = await api.post(`/boardroom/join/${challengeId}`);
    api.toast('Challenge accepted! Scenario revealed.', 'success');
    navigate('live_challenge', { challengeId });
  } catch (err) {}
}

async function loadWaitingRoomData(challengeId) {
  try {
    const res = await api.get(`/boardroom/challenge/${challengeId}`);
    const c = res.data;
    const el = document.getElementById('waiting-room-content');
    if (!el) return;

    el.innerHTML = `
      <div class="two-col">
        <div class="panel">
          <div class="sealed-box">
            <div class="lock">🔒</div>
            <h2>Confidential Business Scenario</h2>
            <p style="color: var(--muted); max-width: 450px; margin: 8px auto;">
              Both participants receive the identical dilemma simultaneously. No advance previews.
            </p>
          </div>
          <button class="btn btn-primary btn-full" onclick="handleStartDemoMatch('${c.id}')">Start Demo Round ↗</button>
        </div>

        <div class="panel">
          <h2>Challenge Logistics</h2>
          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 14px; font-size: 14px;">
            <div>Industry: <b>${c.industry}</b></div>
            <div>Commitment: <b>${formatMoney(c.commitment)}</b></div>
            <div>Duration: <b>${c.duration_minutes} minutes</b></div>
            <div>Participant: <b>${c.host_name}</b> (Ready)</div>
          </div>
        </div>
      </div>
    `;
  } catch (e) {}
}

async function handleStartDemoMatch(challengeId) {
  try {
    await api.post(`/boardroom/start-demo/${challengeId}`);
    navigate('live_challenge', { challengeId });
  } catch (e) {}
}

async function loadLiveChallengeData(challengeId) {
  try {
    const res = await api.get(`/boardroom/challenge/${challengeId}`);
    const c = res.data;
    const el = document.getElementById('live-challenge-content');
    if (!el) return;

    const s = c.scenario || {
      title: 'The Runway Crisis',
      body: 'You are the CFO of an established Nigerian fintech. Monthly revenue is ₦24m, operating costs are ₦31m, cash available is ₦42m. Your lead investor has delayed funding for 90 days. Formulate a 90-day liquidity and operational plan.',
    };

    el.innerHTML = `
      <div class="page-head">
        <div>
          <div class="eyebrow" style="color: var(--red);">● LIVE STRATEGY ARENA</div>
          <h1>${s.title}</h1>
          <p>Respond in writing with your strategic recommendations.</p>
        </div>
      </div>

      <div class="two-col">
        <div class="panel">
          <div class="eyebrow">CONFIDENTIAL CASE DETAILS</div>
          <div style="font-size: 14.5px; line-height: 1.7; white-space: pre-line; margin-top: 10px;">
            ${s.body}
          </div>
        </div>

        <div class="panel">
          <div class="eyebrow">EXECUTIVE STRATEGY MEMO</div>
          <h2>What is your decision?</h2>

          <form onsubmit="handleSubmitMemo(event, '${c.id}')">
            <div class="form-group">
              <textarea class="textarea" id="memo-answer" rows="12" placeholder="My immediate 72-hour priority is...\n\nFinancial assessment...\n\nRisk controls...\n\n30-day execution plan..." required></textarea>
              <div style="display: flex; justify-content: space-between; font-size: 11.5px; color: var(--muted); margin-top: 4px;">
                <span>Min. 40 characters</span>
                <span id="char-counter">0 chars</span>
              </div>
            </div>

            <div style="background: var(--bg); padding: 10px; border-radius: 8px; font-size: 12px; color: var(--muted); margin-bottom: 14px;">
              Marking Weights: Financial Mechanics 40% · Risk Management 30% · Historical Alignment 20% · Communication 10%
            </div>

            <button type="submit" class="btn btn-primary btn-full">Submit Executive Memo ↗</button>
          </form>
        </div>
      </div>
    `;

    const tx = document.getElementById('memo-answer');
    if (tx) {
      tx.addEventListener('input', () => {
        document.getElementById('char-counter').innerText = `${tx.value.length} chars`;
      });
    }
  } catch (e) {}
}

async function handleSubmitMemo(e, challengeId) {
  e.preventDefault();
  const answer = document.getElementById('memo-answer').value;

  try {
    const res = await api.post(`/boardroom/submit/${challengeId}`, { answer });
    api.toast(res.message, 'success');
    navigate('challenge_report', { challengeId });
  } catch (err) {}
}

async function loadChallengeReportData(challengeId) {
  try {
    const res = await api.get(`/boardroom/report/${challengeId}`);
    const r = res.data;
    const el = document.getElementById('challenge-report-content');
    if (!el) return;

    if (r.status === 'queued' || r.status === 'pending' || !r.scores) {
      el.innerHTML = `
        <div class="panel" style="text-align: center; padding: 48px 24px;">
          <div style="font-size: 36px; margin-bottom: 12px;">⏳</div>
          <h2>Memo Queued for AI Evaluation</h2>
          <p style="color: var(--muted); max-width: 520px; margin: 8px auto 20px;">
            Your executive memo has been recorded and queued. The Python evaluation agent running via GitHub Actions evaluates pending memos against the 40/30/20/10 rubric using NVIDIA NIM.
          </p>
          <button class="btn btn-primary" onclick="loadChallengeReportData('${challengeId}')">Check for Score ↺</button>
        </div>
      `;
      return;
    }

    const sc = r.scores;
    el.innerHTML = `
      <div class="metrics-row">
        <div class="metric-card">
          <span>Financial Mechanics</span>
          <strong style="color: var(--jade);">${sc.financial_mechanics} / 40</strong>
          <small>Working capital & calculations</small>
        </div>
        <div class="metric-card">
          <span>Risk Management</span>
          <strong style="color: var(--jade);">${sc.risk_management} / 30</strong>
          <small>Downside & mitigation triggers</small>
        </div>
        <div class="metric-card">
          <span>Historical Alignment</span>
          <strong style="color: var(--jade);">${sc.historical_alignment} / 20</strong>
          <small>Strategic precedents & trade-offs</small>
        </div>
        <div class="metric-card">
          <span>Executive Communication</span>
          <strong style="color: var(--jade);">${sc.communication} / 10</strong>
          <small>Clarity & structure</small>
        </div>
      </div>

      <div class="panel">
        <div class="eyebrow" style="color: var(--jade);">COMPOSITE ADJUDICATION: ${sc.total} / 100</div>
        <h2 style="margin: 8px 0 12px;">Strategic Assessment Feedback</h2>
        <p style="line-height: 1.7; font-size: 14.5px;">${r.explanation || 'Executive evaluation complete.'}</p>
      </div>
    `;
  } catch (e) {}
}

async function loadWalletData() {
  try {
    const res = await api.get(`/wallet?mode=${state.mode}`);
    if (res?.data) {
      if (res.data.demo_balance) state.wallet = res.data.demo_balance;
      if (res.data.real_balance) state.realWallet = res.data.real_balance;
      if (res.data.active_provider) state.activeProvider = res.data.active_provider;
      if (res.data.features) state.features = res.data.features;

      const el = document.getElementById('wallet-transactions-table');
      if (el) {
        if (!res.data.transactions?.length) {
          el.innerHTML = '<p class="muted">No transactions on this ledger mode yet.</p>';
        } else {
          el.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13.5px;">
              <thead>
                <tr style="border-bottom: 2px solid var(--line); color: var(--muted);">
                  <th style="padding: 10px 8px;">Date</th>
                  <th style="padding: 10px 8px;">Event Type</th>
                  <th style="padding: 10px 8px;">Account</th>
                  <th style="padding: 10px 8px; text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${res.data.transactions.map(t => `
                  <tr style="border-bottom: 1px solid var(--line);">
                    <td style="padding: 10px 8px; color: var(--muted);">${t.created_at ? t.created_at.substring(0, 16) : ''}</td>
                    <td style="padding: 10px 8px; font-weight: 600;">${t.event_type}</td>
                    <td style="padding: 10px 8px;"><span class="market-tag">${t.kind}</span></td>
                    <td style="padding: 10px 8px; text-align: right; font-weight: bold; color: ${t.amount >= 0 ? 'var(--jade)' : 'var(--text)'};">${t.formatted}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `;
        }
      }
    }
  } catch (e) {}
}

function switchWalletMode(m) {
  state.mode = m;
  localStorage.setItem('econsim-mode', m);
  navigate('wallet');
}

async function handleDepositSubmit(e) {
  e.preventDefault();
  const amt = parseInt(document.getElementById('deposit-amount').value, 10);
  if (!amt || amt < 1000) {
    api.toast('Minimum real deposit is ₦1,000.', 'error');
    return;
  }

  try {
    const res = await api.post('/funding/initialize', { amount: amt });
    if (res?.data?.checkout_url) {
      api.toast('Opening secure payment checkout...', 'info');
      setTimeout(() => {
        window.location.href = res.data.checkout_url;
      }, 700);
    }
  } catch (e) {}
}

async function loadLeaderboardData(tab = 'Overall') {
  state.leaderboardTab = tab;
  try {
    const res = await api.get(`/leaderboard?tab=${tab}`);
    const tbody = document.getElementById('leaderboard-table-body');
    if (!tbody || !res?.data) return;

    tbody.innerHTML = res.data.map(u => {
      const isYou = state.user && state.user.display_name === u.name;
      const rankBadge = u.rank === 1 ? '🥇 #1' : u.rank === 2 ? '🥈 #2' : u.rank === 3 ? '🥉 #3' : `#${u.rank}`;
      return `
        <tr style="border-bottom: 1px solid var(--line); ${isYou ? 'background: var(--jade-light);' : ''}">
          <td style="padding: 12px 8px; font-weight: bold; color: ${u.rank <= 3 ? 'var(--gold)' : 'inherit'};">${rankBadge}</td>
          <td style="padding: 12px 8px; font-weight: 600; color: ${isYou ? 'var(--jade)' : 'inherit'};">${u.name} ${isYou ? '(You)' : ''}</td>
          <td style="padding: 12px 8px; color: ${isYou ? 'var(--jade)' : 'var(--muted)'};">${u.level}</td>
          <td style="padding: 12px 8px; text-align: right; font-weight: bold; color: ${isYou ? 'var(--jade)' : 'inherit'};">${u.score.toLocaleString()} XP</td>
        </tr>
      `;
    }).join('');
  } catch (e) {}
}

// -------------------------------------------------------------
// Admin Terminal & Engine Controls View
// -------------------------------------------------------------
function renderAdminPage() {
  return `
    <div class="page-head">
      <div>
        <div class="eyebrow" style="color: var(--gold);">EXECUTIVE CONTROL TERMINAL</div>
        <h1>System Administration & Engine Controls</h1>
        <p>Manage real-mode activation, gateway providers (Flutterwave vs Korapay), and macroeconomic market settlement.</p>
      </div>
      <button class="btn btn-secondary" onclick="loadAdminData()">Refresh Engine ↺</button>
    </div>

    <!-- Stats Overview -->
    <div class="metrics-row" id="admin-stats-container">
      <div class="metric-card">
        <span>Registered Strategists</span>
        <strong id="stat-users">--</strong>
        <small>Active user accounts</small>
      </div>
      <div class="metric-card">
        <span>Active Forecasts</span>
        <strong id="stat-forecasts">--</strong>
        <small>Submitted commitments</small>
      </div>
      <div class="metric-card">
        <span>Boardroom Matches</span>
        <strong id="stat-challenges">--</strong>
        <small>Arena strategy cases</small>
      </div>
      <div class="metric-card">
        <span>Virtual Ledger Volume</span>
        <strong id="stat-volume" style="color: var(--jade);">--</strong>
        <small>Total VNGN transacted</small>
      </div>
    </div>

    <!-- Feature Switches & Payment Gateways -->
    <div class="two-col" style="margin-bottom: 24px;">
      <!-- Feature Toggles -->
      <div class="panel">
        <div class="eyebrow">PLATFORM ENGINE TOGGLES</div>
        <h2 style="margin: 8px 0 16px;">Core System Modes</h2>
        <div style="display: flex; flex-direction: column; gap: 14px;" id="admin-features-container">
          <p class="muted">Loading feature flags...</p>
        </div>
      </div>

      <!-- Payment Gateway Selector -->
      <div class="panel">
        <div class="eyebrow">FUNDING ARCHITECTURE</div>
        <h2 style="margin: 8px 0 16px;">Payment Gateways (Flutterwave & Korapay)</h2>
        <p style="font-size: 13px; color: var(--muted); margin-bottom: 16px;">
          Choose which provider handles live deposits. Switch anytime between Flutterwave and Korapay depending on verification status.
        </p>
        <div style="display: flex; flex-direction: column; gap: 12px;" id="admin-providers-container">
          <p class="muted">Loading providers...</p>
        </div>

        <div style="margin-top: 18px; background: var(--bg); padding: 12px; border-radius: 8px; font-size: 12px; border: 1px solid var(--line);">
          <b>Webhooks Endpoints:</b><br>
          • <code>/api/webhooks/flutterwave</code><br>
          • <code>/api/webhooks/korapay</code>
        </div>
      </div>
    </div>

    <!-- Market Creation & Market Resolution -->
    <div class="two-col">
      <!-- Create Market -->
      <div class="panel">
        <div class="eyebrow">MARKET DESK</div>
        <h2 style="margin: 8px 0 16px;">Publish Macroeconomic Contract</h2>
        <form onsubmit="handleCreateAdminMarket(event)">
          <div class="form-group">
            <label>Contract Title / Question</label>
            <input class="input" id="admin-m-title" placeholder="e.g. CBN to adjust MPR at next MPC meeting?" required>
          </div>
          <div class="form-group" style="margin-top: 12px;">
            <label>Industry</label>
            <select class="select" id="admin-m-industry">
              <option value="1">Monetary Policy</option>
              <option value="2">Equities</option>
              <option value="3">Energy</option>
              <option value="4">Agriculture</option>
              <option value="5">FX & Reserves</option>
              <option value="6">Fintech</option>
              <option value="7">Manufacturing</option>
              <option value="8">Telecoms & Digital</option>
              <option value="9">Real Estate & Infra</option>
              <option value="10">FMCG & Retail</option>
              <option value="11">Aviation & Logistics</option>
            </select>
          </div>
          <div class="form-group" style="margin-top: 12px;">
            <label>Resolution Source / Benchmark</label>
            <input class="input" id="admin-m-source" value="CBN Official Communiqué / NBS Bulletin" required>
          </div>
          <div class="form-group" style="margin-top: 12px;">
            <label>Closes At Date</label>
            <input class="input" type="date" id="admin-m-date" required>
          </div>
          <div class="form-group" style="margin-top: 12px;">
            <label>Study Context / Evidence Summary</label>
            <textarea class="textarea" id="admin-m-def" rows="3" placeholder="Contextual macroeconomic drivers..."></textarea>
          </div>
          <button type="submit" class="btn btn-primary btn-full" style="margin-top: 16px;">
            Publish Contract to The Predictor ↗
          </button>
        </form>
      </div>

      <!-- Resolve Market -->
      <div class="panel">
        <div class="eyebrow">DOUBLE-ENTRY SETTLEMENT DESK</div>
        <h2 style="margin: 8px 0 16px;">Resolve Open Contracts</h2>
        <p style="font-size: 13px; color: var(--muted); margin-bottom: 14px;">
          Settling an event evaluates all participants' forecast positions and atomically distributes payouts to winners.
        </p>
        <div id="admin-open-markets-list">
          <p class="muted">Loading open contracts...</p>
        </div>
      </div>
    </div>
  `;
}

async function loadAdminData() {
  try {
    const [statsRes, featsRes, marketsRes] = await Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/features'),
      api.get('/markets'),
    ]);

    // Update stats
    if (statsRes?.data) {
      const s = statsRes.data;
      const uEl = document.getElementById('stat-users');
      const fEl = document.getElementById('stat-forecasts');
      const cEl = document.getElementById('stat-challenges');
      const vEl = document.getElementById('stat-volume');
      if (uEl) uEl.innerText = s.total_users;
      if (fEl) fEl.innerText = s.total_forecasts;
      if (cEl) cEl.innerText = s.total_challenges;
      if (vEl) vEl.innerText = '₦' + (s.ledger_volume_vngn || 0).toLocaleString();
    }

    // Update features
    if (featsRes?.data) {
      const fEl = document.getElementById('admin-features-container');
      if (fEl) {
        const featureLabels = {
          real_mode: { name: 'Real Money Engine', desc: 'Master switch enabling real capital operations' },
          real_funding: { name: 'Payment Ingestion', desc: 'Allows deposits via Flutterwave and Korapay' },
          real_payouts: { name: 'Real Payouts', desc: 'Automated bank account withdrawals' },
          real_boardroom: { name: 'Live Boardroom', desc: 'Permits real-money stakes in strategy arenas' },
        };

        fEl.innerHTML = (featsRes.data.features || []).map(f => {
          const meta = featureLabels[f.code] || { name: f.code, desc: 'Feature toggle' };
          const checked = Boolean(parseInt(f.enabled, 10));
          return `
            <div class="admin-card">
              <div>
                <b>${meta.name}</b>
                <p style="font-size: 12px; color: var(--muted); margin-top: 2px;">${meta.desc}</p>
              </div>
              <label class="switch">
                <input type="checkbox" ${checked ? 'checked' : ''} onchange="handleToggleFeature('${f.code}', this.checked)">
                <span class="slider"></span>
              </label>
            </div>
          `;
        }).join('');
      }

      // Update providers
      const pEl = document.getElementById('admin-providers-container');
      if (pEl) {
        pEl.innerHTML = (featsRes.data.providers || []).map(p => {
          const isEnabled = p.status === 'enabled';
          const isSandbox = p.status === 'sandbox';
          return `
            <div class="admin-card">
              <div>
                <b style="font-size: 15px;">${p.display_name}</b>
                <span class="badge-${p.status}" style="margin-left: 8px;">${p.status.toUpperCase()}</span>
                <p style="font-size: 12px; color: var(--muted); margin-top: 4px;">Gateway Slug: <code>${p.slug}</code></p>
              </div>
              <div style="display: flex; gap: 6px;">
                <button class="btn ${isEnabled ? 'btn-primary' : 'btn-secondary'}" style="padding: 4px 10px; font-size: 12px;" onclick="handleSwitchProvider('${p.slug}', 'enabled')">
                  ${isEnabled ? 'Active ✓' : 'Set Active'}
                </button>
                <button class="btn ${isSandbox ? 'btn-primary' : 'btn-secondary'}" style="padding: 4px 10px; font-size: 12px;" onclick="handleSwitchProvider('${p.slug}', 'sandbox')">
                  Sandbox
                </button>
              </div>
            </div>
          `;
        }).join('');
      }

      // Update industries in creator dropdown if returned
      if (featsRes.data.industries?.length) {
        const indSelect = document.getElementById('admin-m-industry');
        if (indSelect) {
          indSelect.innerHTML = featsRes.data.industries.map(i => `
            <option value="${i.id}">${i.name}</option>
          `).join('');
        }
      }
    }

    // Update open markets for resolution
    if (marketsRes?.data) {
      const openMarkets = marketsRes.data.filter(m => m.state === 'open');
      const mEl = document.getElementById('admin-open-markets-list');
      if (mEl) {
        if (!openMarkets.length) {
          mEl.innerHTML = '<p class="muted">No open markets waiting for resolution.</p>';
        } else {
          mEl.innerHTML = openMarkets.map(m => `
            <div style="background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span class="market-tag">${m.industry_name}</span>
                <small style="color: var(--muted);">${m.closes_at ? m.closes_at.substring(0, 10) : 'Open'}</small>
              </div>
              <b style="font-size: 13.5px; display: block; margin-bottom: 8px;">${m.title}</b>
              <div style="display: flex; gap: 8px;">
                <button class="btn btn-primary" style="flex: 1; padding: 6px;" onclick="handleResolveMarket('${m.id}', true)">
                  Resolve YES ✓
                </button>
                <button class="btn btn-secondary" style="flex: 1; padding: 6px;" onclick="handleResolveMarket('${m.id}', false)">
                  Resolve NO ✗
                </button>
              </div>
            </div>
          `).join('');
        }
      }
    }
  } catch (e) {}
}

async function handleToggleFeature(code, isChecked) {
  try {
    await api.post('/admin/features/toggle', { code, enabled: isChecked });
    api.toast(`Feature ${code} set to ${isChecked ? 'ON' : 'OFF'}`, 'success');
  } catch (e) {
    loadAdminData();
  }
}

async function handleSwitchProvider(slug, status) {
  try {
    await api.post('/admin/providers/switch', { slug, status });
    api.toast(`Provider ${slug} set to ${status}`, 'success');
    loadAdminData();
  } catch (e) {}
}

async function handleCreateAdminMarket(e) {
  e.preventDefault();
  const title = document.getElementById('admin-m-title').value;
  const industryId = parseInt(document.getElementById('admin-m-industry').value, 10);
  const source = document.getElementById('admin-m-source').value;
  const dateVal = document.getElementById('admin-m-date').value;
  const def = document.getElementById('admin-m-def').value;

  try {
    await api.post('/admin/markets/create', {
      title,
      industry_id: industryId,
      resolution_source: source,
      closes_at: dateVal ? `${dateVal} 23:59:59` : undefined,
      definition: def,
    });
    api.toast('Contract published successfully!', 'success');
    loadAdminData();
  } catch (e) {}
}

async function handleResolveMarket(eventId, outcome) {
  if (!confirm(`Are you sure you want to resolve this contract as ${outcome ? 'YES' : 'NO'} and distribute payouts?`)) {
    return;
  }
  try {
    const res = await api.post('/admin/markets/resolve', {
      event_id: eventId,
      outcome,
    });
    api.toast(res.message || 'Market resolved and settled!', 'success');
    loadAdminData();
  } catch (e) {}
}

// -------------------------------------------------------------
// AI Mentor
// -------------------------------------------------------------
async function handleAskMentor(e) {
  e.preventDefault();
  const input = document.getElementById('mentor-input');
  const q = input.value.trim();
  if (!q) return;

  input.value = '';
  try {
    const res = await api.post('/mentor/ask', { query: q });
    state.mentorHistory.push({ q, a: res.data.answer, source: res.data.source });
    navigate('mentor');
  } catch (e) {}
}

function triggerQuickMentor(q) {
  document.getElementById('mentor-input').value = q;
  handleAskMentor(new Event('submit'));
}

// -------------------------------------------------------------
// Scenario Lab Controls
// -------------------------------------------------------------
function updateLabParam(key, val) {
  state.lab[key] = parseInt(val, 10);
  navigate('lab');
}

function resetLab() {
  state.lab = { rate: 20, inflation: 24, spend: 12 };
  navigate('lab');
}

// -------------------------------------------------------------
// Settings & Theme
// -------------------------------------------------------------
function setAppTheme(t) {
  applyTheme(t);
  api.patch('/profile', { theme: t }).catch(() => {});
  navigate('settings');
}

function switchMode(m) {
  state.mode = m;
  navigate(state.page);
}

// -------------------------------------------------------------
// Auth & Profile Submissions
// -------------------------------------------------------------
async function handleAuthSubmit(e, type) {
  e.preventDefault();
  const emailEl = document.getElementById('auth-email');
  const passEl = document.getElementById('auth-password');
  const nameEl = document.getElementById('auth-name');
  const codeEl = document.getElementById('auth-code');

  try {
    if (type === 'login' || type === 'welcome') {
      const res = await api.post('/auth/login', {
        email: emailEl.value,
        password: passEl.value,
      });
      api.toast('Signed in successfully!', 'success');
      state.user = res.data;
      navigate('dashboard');
    } else if (type === 'signup') {
      const res = await api.post('/auth/register', {
        email: emailEl.value,
        password: passEl.value,
        display_name: nameEl.value,
      });
      sessionStorage.setItem('verify_email', emailEl.value);
      api.toast(`Verification code: ${res.data.verification_preview}`, 'info');
      navigate('verify');
    } else if (type === 'verify') {
      const res = await api.post('/auth/verify-email', {
        email: emailEl.value,
        code: codeEl.value,
      });
      api.toast(res.message, 'success');
      state.user = res.data;
      navigate('onboarding');
    } else if (type === 'forgot') {
      await api.post('/auth/forgot-password', { email: emailEl.value });
      api.toast('Password reset token dispatched.', 'info');
      navigate('login');
    }
  } catch (err) {}
}

async function handleUpdateProfile(e) {
  e.preventDefault();
  const name = document.getElementById('profile-name').value;
  const cc = document.getElementById('profile-country').value;

  try {
    const res = await api.patch('/profile', { display_name: name, country_code: cc });
    state.user = res.data.user;
    api.toast('Profile saved successfully.', 'success');
  } catch (e) {}
}

async function handleLogout() {
  try {
    await api.post('/auth/logout');
  } catch (e) {}
  state.user = null;
  navigate('welcome');
}

// Startup
window.addEventListener('DOMContentLoaded', initApp);

