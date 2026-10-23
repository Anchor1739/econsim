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
  stats: {
    xp: 0,
    level: { level: 1, name: 'Novice Analyst', progress_pct: 0 },
    active_forecasts: 0,
    completed_boardroom: 0,
  },
  activeProvider: { slug: 'flutterwave', display_name: 'Flutterwave', status: 'sandbox' },
  features: {},
  leaderboardTab: 'Overall',
  lab: { rate: 20, inflation: 24, spend: 12 },
};

function toggleMobileDrawer() {
  const drawer = document.getElementById('mobile-drawer');
  const backdrop = document.getElementById('mobile-drawer-backdrop');
  if (drawer && backdrop) {
    const isActive = drawer.classList.contains('active');
    if (isActive) {
      drawer.classList.remove('active');
      backdrop.classList.remove('active');
    } else {
      drawer.classList.add('active');
      backdrop.classList.add('active');
    }
  }
}

function closeMobileDrawer() {
  const drawer = document.getElementById('mobile-drawer');
  const backdrop = document.getElementById('mobile-drawer-backdrop');
  if (drawer && backdrop) {
    drawer.classList.remove('active');
    backdrop.classList.remove('active');
  }
}

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

function renderMarkdown(md) {
  if (!md) return '';
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\$\$(.+?)\$\$/g, '<div class="math-display" style="background: rgba(0,0,0,0.04); padding: 8px 12px; border-radius: 6px; margin: 10px 0; font-family: monospace; overflow-x: auto;"><code>$1</code></div>')
    .replace(/\$(.+?)\$/g, '<code style="background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>')
    .replace(/^### (.*$)/gim, '<h3 style="margin: 18px 0 8px; color: var(--navy); font-size: 15.5px; font-weight: 700;">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 style="margin: 22px 0 10px; font-size: 17px; font-weight: 700;">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 style="margin: 24px 0 12px; font-size: 19px; font-weight: 700;">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>')
    .replace(/^\- (.*$)/gim, '<li style="margin-left: 18px; margin-bottom: 5px;">$1</li>')
    .replace(/^\d+\.\s+(.*$)/gim, '<li style="margin-left: 18px; margin-bottom: 5px;">$1</li>')
    .replace(/\n\n+/g, '</p><p style="margin-bottom: 12px; line-height: 1.75;">')
    .replace(/\n/g, '<br>');

  return `<p style="margin-bottom: 12px; line-height: 1.75;">${html}</p>`;
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

  // Determine target page from query param, path, or hash
  let targetPage = urlParams.get('page');
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
  if (!targetPage && path && path !== 'index.html' && path !== 'index.php') {
    targetPage = path;
  }
  if (!targetPage && window.location.hash) {
    targetPage = window.location.hash.replace(/^#\/?/, '');
  }

  // Standalone Admin Portal redirect
  if (targetPage === 'admin') {
    window.location.href = '/admin';
    return;
  }

  const targetMarketId = urlParams.get('marketId');
  const targetChallengeId = urlParams.get('challengeId');

  try {
    const res = await api.get('/auth/me');
    if (res?.data) {
      state.user = res.data;
      if (res.data.wallet) {
        state.wallet = res.data.wallet;
      }
      if (res.data.stats) {
        state.stats = res.data.stats;
      }
      if (res.data.theme) {
        applyTheme(res.data.theme);
      }
      navigate(targetPage || 'dashboard', { marketId: targetMarketId, challengeId: targetChallengeId });
      return;
    }
  } catch (e) {
    // Unauthenticated -> welcome screen or target auth screen
  }

  if (targetPage && ['welcome', 'login', 'signup', 'verify', 'forgot', 'reset'].includes(targetPage)) {
    navigate(targetPage);
  } else {
    navigate('welcome');
  }
}

function navigate(page, params = {}) {
  // Standalone Admin Portal is decoupled from user workspace
  if (page === 'admin') {
    window.location.href = '/admin';
    return;
  }

  state.page = page;
  if (params.marketId) state.selectedMarketId = params.marketId;
  if (params.challengeId) state.currentChallengeId = params.challengeId;

  // Keep browser address bar in sync with active page
  try {
    const url = new URL(window.location.href);
    if (['dashboard', 'welcome'].includes(page)) {
      url.pathname = '/';
      url.searchParams.delete('page');
    } else {
      url.searchParams.set('page', page);
    }
    if (params.marketId) url.searchParams.set('marketId', params.marketId);
    else url.searchParams.delete('marketId');
    if (params.challengeId) url.searchParams.set('challengeId', params.challengeId);
    else url.searchParams.delete('challengeId');
    window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
  } catch (err) {}

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
  const navWorkspace = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>` 
    },
    { 
      id: 'predictor', 
      label: 'The Predictor', 
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>` 
    },
    { 
      id: 'boardroom', 
      label: 'The Boardroom', 
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>` 
    },
    { 
      id: 'wallet', 
      label: 'Ledger Wallet', 
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>` 
    },
    { 
      id: 'mentor', 
      label: 'AI Mentor', 
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 5.6L20 10l-4.4 4 1.4 6-5-3.2-5 3.2 1.4-6L4 10l5.6-2.4L12 2z"/></svg>` 
    },
    { 
      id: 'lab', 
      label: 'Scenario Lab', 
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.31L4.2 19.37A2 2 0 0 0 5.92 22h12.16a2 2 0 0 0 1.72-2.63L14 9.31V2"/></svg>` 
    },
    { 
      id: 'leaderboard', 
      label: 'Leaderboard', 
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34c3.48-1.07 6-4.28 6-8.66V3H4v3c0 4.38 2.52 7.59 6 8.66z"/></svg>` 
    },
  ];

  const navAccount = [
    { 
      id: 'profile', 
      label: 'Profile', 
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>` 
    },
    { 
      id: 'settings', 
      label: 'Settings', 
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0-.33-1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>` 
    },
  ];

  const userInitial = (state.user?.display_name || 'A')[0].toUpperCase();
  const userXp = state.stats?.xp ?? (state.user?.stats?.xp ?? 0);
  const userLevel = state.stats?.level ?? (state.user?.stats?.level ?? { level: 1, name: 'Novice Analyst', progress_pct: 0 });
  const levelNumStr = String(userLevel.level || 1).padStart(2, '0');
  const levelPct = Math.max(5, Math.min(100, userLevel.progress_pct || 0));

  return `
    <div class="app-container">
      <!-- Desktop Sidebar -->
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-icon">↗</div>
          <span>econsim<b>.</b></span>
          <span class="live-pill">SIMULATOR</span>
        </div>
        <div class="sidebar-label">WORKSPACE</div>
        ${navWorkspace.map(item => `
          <button class="nav-item ${state.page === item.id ? 'active' : ''}" onclick="navigate('${item.id}')">
            <span class="nav-icon">${item.icon}</span>
            <span class="text">${item.label}</span>
          </button>
        `).join('')}

        <div class="sidebar-label">ACCOUNT</div>
        ${navAccount.map(item => `
          <button class="nav-item ${state.page === item.id ? 'active' : ''}" onclick="navigate('${item.id}')">
            <span class="nav-icon">${item.icon}</span>
            <span class="text">${item.label}</span>
          </button>
        `).join('')}

        <div class="sidebar-footer">
          <div class="level-card">
            <b>${userLevel.name}</b>
            <small>LEVEL ${levelNumStr} · ${userXp.toLocaleString()} XP</small>
            <div class="progress-bar"><i style="width: ${levelPct}%;"></i></div>
          </div>
          <button class="nav-item" onclick="handleLogout()">
            <span class="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </span>
            <span class="text">Sign out</span>
          </button>
        </div>
      </aside>

      <!-- Main Wrapper -->
      <div class="main-wrapper">
        <!-- Mobile Topbar -->
        <header class="mobile-topbar">
          <div class="mobile-topbar-brand" onclick="navigate('dashboard')">
            <div class="brand-icon" style="width: 28px; height: 28px; font-size: 13px;">↗</div>
            <span class="brand-text">econsim<b>.</b></span>
            <span class="live-pill">LIVE</span>
          </div>
          <div class="mobile-topbar-actions">
            <div class="wallet-badge" onclick="navigate('wallet')">
              ${formatMoney(state.wallet.available)}
            </div>
            <button class="mobile-hamburger-btn" onclick="toggleMobileDrawer()" aria-label="Open Navigation">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
          </div>
        </header>

        <!-- Desktop Topbar -->
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

        <!-- Content Body -->
        <main class="content-body">
          ${state.mode === 'Real' ? `
            <div class="panel" style="border-left: 4px solid var(--gold); background: var(--gold-light); color: var(--gold); margin-bottom: 24px;">
              <b>Real Mode Preview</b>: Real-money funding, cash-equivalent points, and paid challenges are currently inactive pending regulatory approvals.
              <button class="btn btn-secondary" style="margin-left: 12px; padding: 4px 10px; font-size: 12px;" onclick="switchMode('Demo')">Return to Demo</button>
            </div>
          ` : ''}
          ${innerHtml}
        </main>

        <!-- Mobile Bottom Navigation Bar -->
        <nav class="mobile-bottom-bar" aria-label="Mobile Navigation">
          <button class="mobile-nav-btn ${state.page === 'dashboard' ? 'active' : ''}" onclick="navigate('dashboard')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span>Home</span>
          </button>
          <button class="mobile-nav-btn ${['predictor', 'market'].includes(state.page) ? 'active' : ''}" onclick="navigate('predictor')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
            <span>Markets</span>
          </button>
          <button class="mobile-nav-btn ${['boardroom', 'create_challenge', 'waiting_room', 'live_challenge', 'challenge_report'].includes(state.page) ? 'active' : ''}" onclick="navigate('boardroom')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
            <span>Boardroom</span>
          </button>
          <button class="mobile-nav-btn ${state.page === 'wallet' ? 'active' : ''}" onclick="navigate('wallet')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            <span>Wallet</span>
          </button>
          <button class="mobile-nav-btn" onclick="toggleMobileDrawer()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
            <span>Menu</span>
          </button>
        </nav>

        <!-- Mobile Drawer & Backdrop -->
        <div class="drawer-backdrop" id="mobile-drawer-backdrop" onclick="closeMobileDrawer()"></div>
        <aside class="mobile-drawer" id="mobile-drawer">
          <div class="mobile-drawer-header">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div class="avatar-btn" style="width: 38px; height: 38px; font-size: 15px;">${userInitial}</div>
              <div>
                <b style="color: white; font-size: 13.5px; display: block;">${state.user?.display_name || 'Strategist'}</b>
                <small style="color: var(--muted); font-size: 11px;">${state.user?.email || ''}</small>
              </div>
            </div>
            <button class="drawer-close-btn" onclick="closeMobileDrawer()">✕</button>
          </div>

          <div class="mobile-drawer-content">
            <div class="level-card" style="margin-bottom: 18px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <b>${userLevel.name}</b>
                <span style="font-size: 11px; font-weight: 700; color: #38bdf8;">LVL ${levelNumStr}</span>
              </div>
              <small>${userXp.toLocaleString()} XP Accumulated</small>
              <div class="progress-bar" style="margin-top: 8px;"><i style="width: ${levelPct}%;"></i></div>
            </div>

            <div class="sidebar-label">WORKSPACE</div>
            <button class="nav-item ${state.page === 'mentor' ? 'active' : ''}" onclick="navigate('mentor'); closeMobileDrawer();">
              <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.4 5.6L20 10l-4.4 4 1.4 6-5-3.2-5 3.2 1.4-6L4 10l5.6-2.4L12 2z"/></svg></span>
              <span class="text">AI Mentor Masterclass</span>
            </button>
            <button class="nav-item ${state.page === 'lab' ? 'active' : ''}" onclick="navigate('lab'); closeMobileDrawer();">
              <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 2v7.31L4.2 19.37A2 2 0 0 0 5.92 22h12.16a2 2 0 0 0 1.72-2.63L14 9.31V2"/></svg></span>
              <span class="text">Scenario Lab</span>
            </button>
            <button class="nav-item ${state.page === 'leaderboard' ? 'active' : ''}" onclick="navigate('leaderboard'); closeMobileDrawer();">
              <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34c3.48-1.07 6-4.28 6-8.66V3H4v3c0 4.38 2.52 7.59 6 8.66z"/></svg></span>
              <span class="text">Leaderboard</span>
            </button>

            <div class="sidebar-label" style="margin-top: 18px;">ACCOUNT</div>
            <button class="nav-item ${state.page === 'profile' ? 'active' : ''}" onclick="navigate('profile'); closeMobileDrawer();">
              <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
              <span class="text">Strategist Profile</span>
            </button>
            <button class="nav-item ${state.page === 'settings' ? 'active' : ''}" onclick="navigate('settings'); closeMobileDrawer();">
              <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0-.33-1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></span>
              <span class="text">Platform Settings</span>
            </button>

            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; flex-direction: column; gap: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 13px; color: var(--muted);">Interface Mode</span>
                <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="applyTheme(state.theme === 'dark' ? 'light' : 'dark')">
                  ${state.theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
                </button>
              </div>
              <button class="btn btn-secondary" style="width: 100%; justify-content: center; margin-top: 10px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" onclick="handleLogout()">
                Sign Out ↪
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// Dashboard View
// -------------------------------------------------------------
function renderDashboard() {
  const name = state.user?.display_name || 'Strategist';
  const userXp = state.stats?.xp ?? (state.user?.stats?.xp ?? 0);
  const userLevel = state.stats?.level ?? (state.user?.stats?.level ?? { level: 1, name: 'Novice Analyst', progress_pct: 0 });
  const levelNumStr = String(userLevel.level || 1).padStart(2, '0');
  const openForecasts = state.stats?.active_forecasts ?? (state.user?.stats?.active_forecasts ?? 0);
  const boardroomCount = state.stats?.completed_boardroom ?? (state.user?.stats?.completed_boardroom ?? 0);

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
        <strong id="dash-xp">${userXp.toLocaleString()} XP</strong>
        <small id="dash-level">Level ${levelNumStr}: ${userLevel.name}</small>
      </div>
      <div class="metric-card">
        <span>Active Forecasts</span>
        <strong id="dash-forecasts">${openForecasts} Open</strong>
        <small>Ledger held commitments</small>
      </div>
      <div class="metric-card">
        <span>Boardroom Sessions</span>
        <strong id="dash-boardroom">${boardroomCount} Completed</strong>
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
  const oddsYes = m.odds_yes || (prob > 0 ? (100 / prob).toFixed(2) : '2.00');
  const oddsNo = m.odds_no || ((100 - prob) > 0 ? (100 / (100 - prob)).toFixed(2) : '2.00');
  const volStr = m.total_volume_vngn ? ` · ₦${m.total_volume_vngn.toLocaleString()} Pool` : '';

  return `
    <div class="market-card" onclick="navigate('market', { marketId: '${m.id}' })">
      <div class="market-top">
        <span class="market-tag">${m.industry_name || 'Macro'}</span>
        <span style="font-size: 11px; color: var(--muted);">${m.closes_at ? m.closes_at.substring(0, 10) : 'Open'}</span>
      </div>
      <h3>${m.title}</h3>
      <div class="prob-split">
        <span class="yes">Yes ${prob}% <small style="font-size: 11px; font-weight: normal; opacity: 0.85;">(${oddsYes}×)</small></span>
        <span class="no">No ${100 - prob}% <small style="font-size: 11px; font-weight: normal; opacity: 0.85;">(${oddsNo}×)</small></span>
      </div>
      <div class="prob-bar"><i style="width: ${prob}%;"></i></div>
      <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid var(--line);">
        <small style="color: var(--muted);">Dynamic AMM Odds${volStr}</small>
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
      <div class="panel" style="display: flex; flex-direction: column; min-height: 520px;">
        <div id="mentor-chat-thread" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; margin-bottom: 16px;">
          <div style="background: var(--bg); padding: 16px; border-radius: 8px; border: 1px solid var(--line);">
            <b style="color: var(--jade);">✧ Developing Market Senior Economist</b>
            <p style="margin-top: 6px; font-size: 13.5px; color: var(--text);">
              Welcome to the Financial Reasoning Desk. Ask about monetary policy transmission, working capital modeling, exchange rate elasticity, or risk architecture. Every explanation is delivered in-depth with first principles, Nigerian real-world dynamics, mathematical formulation, and executive trade-offs.
            </p>
          </div>
          ${state.mentorHistory.map(m => `
            <div style="align-self: flex-end; background: var(--navy); color: #fff; padding: 12px 18px; border-radius: 12px; max-width: 85%; font-size: 14px;">
              <b>Q:</b> ${m.q}
            </div>
            <div style="background: var(--bg); border: 1px solid var(--line); padding: 18px 20px; border-radius: 12px; max-width: 95%;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--line); padding-bottom: 8px;">
                <b style="color: var(--jade); font-size: 14px;">✧ Developing Market Senior Economist</b>
                <span class="sim-tag" style="font-size: 10px;">IN-DEPTH ANALYSIS</span>
              </div>
              <div class="mentor-markdown" style="font-size: 14px; line-height: 1.75; color: var(--text);">
                ${renderMarkdown(m.a)}
              </div>
              <div style="margin-top: 14px; padding-top: 8px; border-top: 1px dashed var(--line); display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); flex-wrap: wrap; gap: 4px;">
                <span>Authoritative Benchmark: <b>${m.source || 'Macroeconomic Reasoning Framework'}</b></span>
                <span>Pedagogical Adjudication</span>
              </div>
            </div>
          `).join('')}
        </div>

        <form onsubmit="handleAskMentor(event)" style="display: flex; gap: 8px;">
          <input class="input" id="mentor-input" placeholder="Ask about CBN monetary transmission, cash runway formulas, FX pass-through..." required>
          <button type="submit" class="btn btn-primary" style="white-space: nowrap;">Ask Mentor ↗</button>
        </form>
      </div>

      <div class="panel">
        <div class="eyebrow">CURRICULUM DEEP DIVES</div>
        <h2 style="margin: 6px 0 14px;">Macroeconomic & Corporate Explorations</h2>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${[
            "What drives headline and food inflation in Nigeria?",
            "How does a CBN rate hike transmit through the banking system?",
            "How to calculate and stress-test cash runway during 30%+ inflation?",
            "How does NAFEM currency devaluation affect corporate balance sheets?",
            "How should a CFO structure a risk management decision matrix?",
            "What is the impact of fiscal deficit monetization on money supply?",
          ].map(q => `
            <button class="btn btn-secondary btn-full" style="justify-content: flex-start; text-align: left; font-size: 12.5px; padding: 10px 12px; line-height: 1.4;" onclick="triggerQuickMentor('${q}')">
              <span>↗</span> ${q}
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

        <div class="panel" style="margin-top: 16px;">
          <div class="eyebrow" style="color: var(--jade);">TRANSMISSION MECHANISM</div>
          <h3 style="margin: 6px 0 10px; font-size: 15px;">Pedagogical Feedback & Policy Trade-offs</h3>
          <div style="font-size: 13px; line-height: 1.7; color: var(--text);">
            ${r >= 22 ? `
              <p><b>1. Price Stability & Monetary Transmission:</b> At an MPR of ${r}%, the central bank enforces restrictive liquidity conditions. High benchmark yields sterilize commercial bank loanable funds, restraining credit-fueled consumption and dampening headline demand-pull inflation toward ${modeledInf}%.</p>
              <p style="margin-top: 8px;"><b>2. Real Economy Trade-offs:</b> The Credit Impulse Index contracts to ${creditIdx}/100 as prime lending rates rise toward ${r + 6}%–${r + 9}%. Manufacturing, retail, and agro-processors face acute debt servicing costs, moderating private sector CapEx (Investment Index at ${investIdx}/100).</p>
              <p style="margin-top: 8px;"><b>3. Fiscal Implications:</b> Elevated domestic yields increase sovereign debt servicing costs, narrowing fiscal room for infrastructure disbursements.</p>
            ` : `
              <p><b>1. Liquidity & Capital Formation:</b> With an accommodative MPR of ${r}%, borrowing costs decline across the interbank curve, encouraging private commercial borrowing (Credit Index at ${creditIdx}/100) and stimulating corporate capital investments (Investment Index at ${investIdx}/100).</p>
              <p style="margin-top: 8px;"><b>2. Inflationary & Currency Risks:</b> With fiscal impulse at ${sp}%, excess liquidity expands broad money supply (M2/M3). In an import-dependent economy, real negative interest rates risk capital outflows, pushing projected inflation toward ${modeledInf}%.</p>
              <p style="margin-top: 8px;"><b>3. Strategic Imperative:</b> Monetary easing must be matched with targeted sector development facilities to expand domestic productive capacity rather than speculative asset bubbles.</p>
            `}
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
    window.location.href = '/admin';
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
    const [marketsRes, profileRes] = await Promise.all([
      api.get('/markets'),
      api.get('/profile').catch(() => null),
    ]);

    if (profileRes?.data) {
      if (profileRes.data.xp !== undefined) state.stats.xp = profileRes.data.xp;
      if (profileRes.data.level) state.stats.level = profileRes.data.level;
      if (profileRes.data.active_forecasts !== undefined) state.stats.active_forecasts = profileRes.data.active_forecasts;
      if (profileRes.data.completed_boardroom !== undefined) state.stats.completed_boardroom = profileRes.data.completed_boardroom;
      if (profileRes.data.wallet) state.wallet = profileRes.data.wallet;

      // Update dashboard metrics DOM dynamically
      const xpEl = document.getElementById('dash-xp');
      const lvlEl = document.getElementById('dash-level');
      const fcEl = document.getElementById('dash-forecasts');
      const brEl = document.getElementById('dash-boardroom');
      const levelNum = String(state.stats.level?.level || 1).padStart(2, '0');

      if (xpEl) xpEl.innerText = `${(state.stats.xp || 0).toLocaleString()} XP`;
      if (lvlEl) lvlEl.innerText = `Level ${levelNum}: ${state.stats.level?.name || 'Novice Analyst'}`;
      if (fcEl) fcEl.innerText = `${state.stats.active_forecasts || 0} Open`;
      if (brEl) brEl.innerText = `${state.stats.completed_boardroom || 0} Completed`;

      // Update sidebar level card
      const sideName = document.querySelector('.sidebar .level-card b');
      const sideSmall = document.querySelector('.sidebar .level-card small');
      const sideBar = document.querySelector('.sidebar .level-card .progress-bar i');
      if (sideName) sideName.innerText = state.stats.level?.name || 'Novice Analyst';
      if (sideSmall) sideSmall.innerText = `LEVEL ${levelNum} · ${(state.stats.xp || 0).toLocaleString()} XP`;
      if (sideBar) sideBar.style.width = `${Math.max(5, Math.min(100, state.stats.level?.progress_pct || 0))}%`;
    }

    if (marketsRes?.data) {
      state.markets = marketsRes.data;
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
    const oddsYes = m.odds_yes || (prob > 0 ? (100 / prob).toFixed(2) : '2.00');
    const oddsNo = m.odds_no || ((100 - prob) > 0 ? (100 / (100 - prob)).toFixed(2) : '2.00');

    el.innerHTML = `
      <div class="two-col">
        <div>
          <!-- Market Contract Card -->
          <div class="panel">
            <div class="market-top">
              <span class="market-tag">${m.industry_name}</span>
              <span style="color: var(--muted); font-size: 12px;">Closes: ${m.closes_at ? m.closes_at.substring(0, 10) : 'Open'}</span>
            </div>
            <h1 style="font-size: 24px; margin: 8px 0 16px;">${m.title}</h1>
            <div class="prob-split">
              <span class="yes" style="font-size: 16px; font-weight: bold;">YES ${prob}%</span>
              <span class="no" style="font-size: 16px; font-weight: bold;">NO ${100 - prob}%</span>
            </div>
            <div class="prob-bar" style="height: 10px; margin: 10px 0;"><i style="width: ${prob}%;"></i></div>
            <p style="font-size: 13px; color: var(--muted); margin-top: 8px;">
              <b>Resolution Benchmark Protocol:</b> ${m.outcome_definition || m.title}
            </p>
          </div>

          <!-- Research Desk Comprehensive Intelligence Briefing -->
          <div class="panel">
            <div class="eyebrow" style="color: var(--jade);">RESEARCH DESK · DEEP FUNDAMENTALS</div>
            <h2 style="margin: 8px 0 12px;">Macroeconomic Transmission & Catalyst Analysis</h2>
            <p style="font-size: 14px; line-height: 1.7; color: var(--text); margin-bottom: 20px;">
              ${m.study_summary || 'Comprehensive empirical analysis examining the primary transmission mechanisms, regulatory precedents, and liquidity vectors influencing this contract.'}
            </p>

            <h3 style="font-size: 15px; margin-bottom: 12px; color: var(--navy);">Four Critical Transmission Levers</h3>
            <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
              ${(m.metrics && m.metrics.length ? m.metrics : [
                ['Monetary & Yield Curve Dynamics', 'Benchmark interest rate corridor and interbank liquidity transmission.'],
                ['Exchange Rate Elasticity', 'NAFEM turnover volume, autonomous inflows, and currency pass-through.'],
                ['Real Sector Credit Impulse', 'Commercial bank loan-to-deposit ratios and private sector investment.'],
                ['Sovereign Debt Sustainability', 'Domestic debt service to revenue ratios and fiscal financing.'],
              ]).map((metric, i) => `
                <div style="background: var(--bg); padding: 14px; border-radius: 8px; border: 1px solid var(--line);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <b style="font-size: 13.5px; color: var(--text);">0${i+1}. ${metric[0]}</b>
                    <span class="sim-tag" style="font-size: 10px;">KEY LEVER</span>
                  </div>
                  <p style="font-size: 13px; color: var(--muted); line-height: 1.6;">${metric[1]}</p>
                </div>
              `).join('')}
            </div>

            <!-- Historical Case Studies & Precedents -->
            <h3 style="font-size: 15px; margin-bottom: 12px; color: var(--navy);">Historical Precedents & Empirical Cycles</h3>
            <div style="background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              ${(m.historical_cases && m.historical_cases.length ? m.historical_cases : [
                {
                  period: '2024 Macroeconomic Restructuring Cycle',
                  action: 'Aggressive MPC tightening (750+ bps) narrowed negative real yields and stimulated FPI inflows into OMO bills, while domestic manufacturing experienced compressed margins.'
                }
              ]).map(c => `
                <div>
                  <b style="color: var(--jade); font-size: 13.5px;">${c.period || 'Historical Cycle'}:</b>
                  <p style="font-size: 13px; color: var(--text); margin-top: 4px; line-height: 1.6;">${c.action || 'Empirical policy precedents and market adjustments.'}</p>
                </div>
              `).join('')}
            </div>

            <!-- Two-Sided Analytical Theses -->
            <h3 style="font-size: 15px; margin-bottom: 12px; color: var(--navy);">Two-Sided Analytical Theses</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px;">
              <div style="background: var(--jade-light); padding: 14px; border-radius: 8px; border: 1px solid rgba(36, 121, 101, 0.2);">
                <b style="color: var(--jade); font-size: 13.5px;">The Affirmative (YES) Thesis:</b>
                <p style="font-size: 12.5px; color: var(--text); margin-top: 6px; line-height: 1.6;">
                  Persistent inflation pressure, sustained currency pass-through from global energy/freight costs, and central bank resolve to maintain positive real interest yields to anchor capital accounts.
                </p>
              </div>
              <div style="background: var(--red-light); padding: 14px; border-radius: 8px; border: 1px solid rgba(220, 38, 38, 0.2);">
                <b style="color: var(--red); font-size: 13.5px;">The Countervailing (NO) Thesis:</b>
                <p style="font-size: 12.5px; color: var(--text); margin-top: 6px; line-height: 1.6;">
                  Concerns over industrial debt servicing stress, rising non-performing loan (NPL) ratios in banking, and fiscal warnings that elevated borrowing costs stifle domestic employment growth.
                </p>
              </div>
            </div>

            <!-- Authoritative Verification Benchmark -->
            <div style="padding-top: 14px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; font-size: 12.5px;">
              <span>Resolution Benchmark: <b>${m.resolution_source || 'Official regulatory announcement'}</b></span>
              <span class="sim-tag">VERIFIED SOURCE</span>
            </div>
          </div>
        </div>

        <div>
          <!-- Forecast Ticket Form -->
          <div class="panel">
            <div class="eyebrow">FORECAST TICKET</div>
            <h2>Make Your Call</h2>
            <p style="font-size: 13px; color: var(--muted); margin-bottom: 16px;">
              Commit educational virtual capital based on fundamental research and record your thesis in the Decision Journal.
            </p>

            <form onsubmit="handlePlaceForecast(event, '${m.id}')">
              <div class="form-group">
                <label>Select Outcome & Entry Odds</label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                  <button type="button" id="outcome-yes" class="btn btn-primary btn-full" onclick="selectOutcome(true)">
                    YES ${prob}% (${oddsYes}×)
                  </button>
                  <button type="button" id="outcome-no" class="btn btn-secondary btn-full" onclick="selectOutcome(false)">
                    NO ${100 - prob}% (${oddsNo}×)
                  </button>
                </div>
                <small style="color: var(--muted); font-size: 11px; display: block; margin-top: 5px;">
                  ⚡ <b>Locked Entry Multiplier:</b> Your payout is locked at your entry odds at commitment time. Subsequent market shifts will not diminish your locked payout ratio.
                </small>
              </div>

              <div class="form-group" style="margin-top: 14px;">
                <label>Virtual Capital Stake (₦)</label>
                <input class="input" type="number" id="forecast-amount" value="5000" min="100" max="${state.wallet.available}" required>
                <div style="display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap;">
                  ${[1000, 5000, 10000, 25000, 50000].map(a => `
                    <button type="button" class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px;" onclick="document.getElementById('forecast-amount').value = ${a}; updatePayoutEstimate();">₦${a.toLocaleString()}</button>
                  `).join('')}
                </div>
              </div>

              <div class="form-group" style="margin-top: 14px;">
                <label>Decision Journal Thesis (Builds Strategic Record & XP)</label>
                <textarea class="textarea" id="forecast-thesis" rows="4" placeholder="Document your quantitative rationale: 1) What leading indicator gives you high conviction? 2) What downside trigger would invalidate this forecast? 3) What is your expected horizon?"></textarea>
                <small style="color: var(--muted); font-size: 11.5px; display: block; margin-top: 4px;">
                  Documenting your decision thesis awards +25 Financial Literacy XP and records your verified reasoning.
                </small>
              </div>

              <div style="background: var(--bg); padding: 14px; border-radius: 8px; margin: 16px 0; font-size: 13px; border: 1px solid var(--line);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                  <span>Available Balance:</span>
                  <b style="color: var(--jade);">${formatMoney(state.wallet.available)}</b>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>Locked Potential Payout:</span>
                  <b id="payout-estimate" style="color: var(--gold); font-size: 14px;">
                    ${formatMoney(Math.round(5000 * parseFloat(oddsYes)))} <small style="font-size: 11px; font-weight: normal; color: var(--muted);">(${oddsYes}× entry odd)</small>
                  </b>
                </div>
              </div>

              <button type="submit" class="btn btn-primary btn-full">Confirm Virtual Commitment ↗</button>
            </form>
          </div>
        </div>
      </div>
    `;

    // Initialize global market probs for realtime updates
    currentMarketOdds = {
      probYes: prob,
      probNo: 100 - prob,
      oddsYes: oddsYes,
      oddsNo: oddsNo
    };

    const amtInput = document.getElementById('forecast-amount');
    if (amtInput) {
      amtInput.addEventListener('input', updatePayoutEstimate);
    }
  } catch (e) {}
}

let chosenOutcome = true;
let currentMarketOdds = { probYes: 50, probNo: 50, oddsYes: '2.00', oddsNo: '2.00' };

function updatePayoutEstimate() {
  const amtInput = document.getElementById('forecast-amount');
  const val = amtInput ? (parseInt(amtInput.value, 10) || 0) : 5000;
  const mult = chosenOutcome ? parseFloat(currentMarketOdds.oddsYes) : parseFloat(currentMarketOdds.oddsNo);
  const est = Math.round(val * mult);
  const outEl = document.getElementById('payout-estimate');
  if (outEl) {
    outEl.innerHTML = `${formatMoney(est)} <small style="font-size: 11px; font-weight: normal; color: var(--muted);">(${mult.toFixed(2)}× entry odd)</small>`;
  }
}

function selectOutcome(val) {
  chosenOutcome = val;
  const yesBtn = document.getElementById('outcome-yes');
  const noBtn = document.getElementById('outcome-no');
  if (yesBtn && noBtn) {
    if (val) {
      yesBtn.className = 'btn btn-primary btn-full';
      noBtn.className = 'btn btn-secondary btn-full';
    } else {
      yesBtn.className = 'btn btn-secondary btn-full';
      noBtn.className = 'btn btn-primary btn-full';
    }
  }
  updatePayoutEstimate();
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
// Standalone Admin Portal Redirection
// -------------------------------------------------------------
function renderAdminPage() {
  window.location.href = '/admin';
  return `
    <div style="padding: 60px 20px; text-align: center; color: var(--muted);">
      <div style="font-size: 18px; font-weight: 700; color: var(--text); margin-bottom: 8px;">EconSim Standalone Operations Terminal</div>
      <p>Redirecting to dedicated Admin Console at <a href="/admin" style="color: var(--jade);">/admin</a>...</p>
    </div>
  `;
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

