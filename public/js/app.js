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
  features: {},
  leaderboardTab: 'Overall',
  notifications: JSON.parse(localStorage.getItem('econsim-notifications') || 'null') || [
    {
      id: 'notif_init_1',
      title: 'Executive Boardroom Challenge Ready',
      message: 'The Runway Crisis dilemma is active. Step into the arena and formulate your liquidity plan.',
      target_page: 'boardroom',
      target_id: 'ch_1',
      category: 'boardroom',
      time: '12m ago',
      read: false,
    },
    {
      id: 'notif_init_2',
      title: 'Economic Catalyst Contract Alert',
      message: 'MPC Interest Rate Communique decision contract is approaching resolution. Inspect your position.',
      target_page: 'predictor',
      target_id: 'mkt_1',
      category: 'market',
      time: '45m ago',
      read: false,
    },
    {
      id: 'notif_init_3',
      title: 'Virtual Educational Capital Credited',
      message: '₦500,000 demonstration capital is available on your virtual ledger account.',
      target_page: 'wallet',
      target_id: null,
      category: 'wallet',
      time: '2h ago',
      read: true,
    },
  ],
  isNotifOpen: false,
  lab: {
    selectedIndustry: 'monetary',
    industries: [],
    scenarios: [],
    selectedScenarioId: 'mon_1',
    selectedScenario: null,
    definitions: {},
    params: {
      mpr: 27.25,
      inflation: 32.5,
      fx_rate: 1650,
      fuel_price: 1050,
      crr: 45.0,
      spend_impulse: 14.0,
    },
    results: null,
    aiBriefing: null,
    isBriefingLoading: false,
    openPrimers: {},
  },
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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

  // Close notifications dropdown on outside click
  document.addEventListener('click', (e) => {
    const isInsideNotif = e.target.closest('.notif-container');
    if (state.isNotifOpen && !isInsideNotif) {
      state.isNotifOpen = false;
      document.querySelectorAll('.notif-dropdown').forEach(dd => dd.classList.remove('active'));
    }
  });

  // Load platform engine features and active gateway immediately
  try {
    const featRes = await api.get('/features');
    if (featRes?.data) {
      if (featRes.data.features) state.features = featRes.data.features;
    }
  } catch (e) {}

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
// Shimmer & Skeleton Screen Helpers
// -------------------------------------------------------------
function renderMarketSkeletonGrid(count = 3) {
  return `
    <div class="market-grid">
      ${Array(count).fill(0).map(() => `
        <div class="skeleton-card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="skeleton-shimmer skeleton-line pill" style="width: 85px;"></div>
            <div class="skeleton-shimmer skeleton-line" style="width: 55px; height: 12px;"></div>
          </div>
          <div class="skeleton-shimmer skeleton-line title" style="margin-top: 4px;"></div>
          <div class="skeleton-shimmer skeleton-line subtitle"></div>
          <div class="skeleton-shimmer skeleton-line" style="width: 90%;"></div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 10px; border-top: 1px solid var(--line);">
            <div class="skeleton-shimmer skeleton-line" style="width: 90px; height: 14px;"></div>
            <div class="skeleton-shimmer skeleton-line pill" style="width: 75px; height: 26px;"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderBoardroomSkeleton(count = 2) {
  return `
    <div class="market-grid">
      ${Array(count).fill(0).map(() => `
        <div class="skeleton-card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div class="skeleton-shimmer skeleton-line pill" style="width: 90px;"></div>
            <div class="skeleton-shimmer skeleton-line pill" style="width: 65px;"></div>
          </div>
          <div class="skeleton-shimmer skeleton-line title" style="margin: 6px 0; width: 75%;"></div>
          <div class="skeleton-shimmer skeleton-line subtitle"></div>
          <div class="skeleton-shimmer skeleton-line" style="width: 80%;"></div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--line);">
            <div class="skeleton-shimmer skeleton-line short" style="height: 14px;"></div>
            <div class="skeleton-shimmer skeleton-line pill" style="width: 100px; height: 30px;"></div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderTableSkeleton(rows = 4, cols = 4) {
  return `
    <table style="width: 100%; border-collapse: collapse;">
      <tbody>
        ${Array(rows).fill(0).map(() => `
          <tr style="border-bottom: 1px solid var(--line);">
            ${Array(cols).fill(0).map((_, i) => `
              <td style="padding: 14px 10px;">
                <div class="skeleton-shimmer skeleton-line" style="width: ${i === 0 ? '45%' : (i === 1 ? '75%' : '55%')}; height: 14px;"></div>
              </td>
            `).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderLeaderboardSkeleton(rows = 6) {
  return Array(rows).fill(0).map(() => `
    <tr style="border-bottom: 1px solid var(--line);">
      <td style="padding: 12px 8px;"><div class="skeleton-shimmer skeleton-line pill" style="width: 40px; height: 18px;"></div></td>
      <td style="padding: 12px 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="skeleton-shimmer skeleton-avatar" style="width: 26px; height: 26px;"></div>
          <div class="skeleton-shimmer skeleton-line title" style="width: 130px; height: 14px;"></div>
        </div>
      </td>
      <td style="padding: 12px 8px;"><div class="skeleton-shimmer skeleton-line" style="width: 90px; height: 14px;"></div></td>
      <td style="padding: 12px 8px; text-align: right;"><div class="skeleton-shimmer skeleton-line" style="width: 60px; height: 14px; margin-left: auto;"></div></td>
    </tr>
  `).join('');
}

function renderScenarioSkeleton(count = 2) {
  return Array(count).fill(0).map(() => `
    <div class="skeleton-card" style="margin-bottom: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div class="skeleton-shimmer skeleton-line title" style="width: 60%; height: 16px;"></div>
        <div class="skeleton-shimmer skeleton-line pill" style="width: 50px; height: 18px;"></div>
      </div>
      <div class="skeleton-shimmer skeleton-line subtitle"></div>
      <div class="skeleton-shimmer skeleton-line" style="width: 85%;"></div>
      <div class="skeleton-shimmer skeleton-line" style="height: 24px; border-radius: 6px; margin-top: 4px;"></div>
    </div>
  `).join('');
}

function renderInlineLoader(text = 'Loading data...') {
  return `
    <div class="page-loader-box">
      <div class="page-loader-spinner"></div>
      <span style="font-size: 13px; font-weight: 600;">${text}</span>
    </div>
  `;
}

// -------------------------------------------------------------
// In-App Notifications & Deep Linking Engine
// -------------------------------------------------------------
function saveNotificationsToStorage() {
  try {
    localStorage.setItem('econsim-notifications', JSON.stringify(state.notifications || []));
  } catch (e) {}
}

function updateNotifBadges() {
  const unreadCount = (state.notifications || []).filter(n => !n.read).length;
  const badgeDesktop = document.getElementById('notif-badge-count');
  if (badgeDesktop) {
    badgeDesktop.textContent = unreadCount;
    badgeDesktop.style.display = unreadCount > 0 ? 'flex' : 'none';
  }
  const badgeMobile = document.getElementById('notif-badge-mobile');
  if (badgeMobile) {
    badgeMobile.textContent = unreadCount;
    badgeMobile.style.display = unreadCount > 0 ? 'flex' : 'none';
  }
}

function toggleNotifDropdown(e) {
  if (e) e.stopPropagation();
  state.isNotifOpen = !state.isNotifOpen;
  document.querySelectorAll('.notif-dropdown').forEach(dropdown => {
    if (state.isNotifOpen) {
      dropdown.innerHTML = renderNotifDropdownContent();
      dropdown.classList.add('active');
    } else {
      dropdown.classList.remove('active');
    }
  });
}

function markAllNotificationsRead(e) {
  if (e) e.stopPropagation();
  (state.notifications || []).forEach(n => { n.read = true; });
  saveNotificationsToStorage();
  updateNotifBadges();
  document.querySelectorAll('.notif-dropdown').forEach(dropdown => {
    dropdown.innerHTML = renderNotifDropdownContent();
  });
}

function handleNotificationClick(notifId) {
  const notif = (state.notifications || []).find(n => n.id === notifId);
  if (!notif) return;

  notif.read = true;
  saveNotificationsToStorage();
  state.isNotifOpen = false;
  document.querySelectorAll('.notif-dropdown').forEach(dropdown => {
    dropdown.classList.remove('active');
  });
  updateNotifBadges();

  api.toast(`Navigating to ${notif.title}...`, 'info');

  if (notif.target_page === 'live_challenge' && notif.target_id) {
    navigate('live_challenge', { challengeId: notif.target_id });
  } else if (notif.target_page === 'waiting_room' && notif.target_id) {
    navigate('waiting_room', { challengeId: notif.target_id });
  } else if (notif.target_page === 'challenge_report' && notif.target_id) {
    navigate('challenge_report', { challengeId: notif.target_id });
  } else if (notif.target_page === 'boardroom') {
    navigate('boardroom');
  } else if (notif.target_page === 'predictor') {
    navigate('predictor');
  } else if (notif.target_page === 'wallet') {
    navigate('wallet');
  } else if (notif.target_page) {
    navigate(notif.target_page);
  }
}

async function requestPushPermission() {
  if (!('Notification' in window)) {
    api.toast('Browser Web Push is not supported in this browser environment.', 'warning');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      api.toast('Push alerts enabled! You will receive live alerts for boardroom matches.', 'success');
      sendSystemNotification(
        'Push Notifications Active',
        'Real-time alerts are now enabled for boardroom match starts and catalyst resolutions.',
        'dashboard',
        null,
        'boardroom'
      );
    } else {
      api.toast('Push permission was declined or dismissed in browser settings.', 'warning');
    }
  } catch (err) {
    api.toast('Could not request notification permission.', 'error');
  }
}

function sendSystemNotification(title, message, target_page = 'dashboard', target_id = null, category = 'boardroom') {
  const newNotif = {
    id: 'notif_' + Date.now(),
    title,
    message,
    target_page,
    target_id,
    category,
    time: 'Just now',
    read: false,
  };

  if (!state.notifications) state.notifications = [];
  state.notifications.unshift(newNotif);
  saveNotificationsToStorage();
  updateNotifBadges();

  // In-App Toast
  api.toast(`🔔 ${title}: ${message}`, 'info');

  // Native Web Push Notification
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const n = new Notification(title, {
        body: message,
        icon: '/favicon.ico',
      });
      n.onclick = () => {
        window.focus();
        handleNotificationClick(newNotif.id);
      };
    } catch (e) {}
  }
}

function triggerSampleBoardroomNotif(e) {
  if (e) e.stopPropagation();
  sendSystemNotification(
    'Executive Boardroom Dilemma Live',
    'The Liquidity Squeeze challenge has started. Click here to enter the arena and submit your memo.',
    'boardroom',
    'ch_live_demo',
    'boardroom'
  );
}

function clearAllNotifications(e) {
  if (e) e.stopPropagation();
  state.notifications = [];
  saveNotificationsToStorage();
  updateNotifBadges();
  document.querySelectorAll('.notif-dropdown').forEach(dd => {
    dd.innerHTML = renderNotifDropdownContent();
  });
  api.toast('Notification center cleared.', 'info');
  if (state.page === 'settings') {
    navigate('settings');
  }
}

function renderNotifDropdownContent() {
  const notifs = state.notifications || [];
  const unreadCount = notifs.filter(n => !n.read).length;

  return `
    <div class="notif-header">
      <div>
        <b style="font-size: 13.5px; color: var(--text);">Strategic Notifications</b>
        <small style="display: block; color: var(--muted); font-size: 11px;">${unreadCount} unread alert${unreadCount === 1 ? '' : 's'}</small>
      </div>
      <div style="display: flex; gap: 6px;">
        ${unreadCount > 0 ? `
          <button type="button" class="btn-link" style="font-size: 11.5px; color: var(--jade); background: none; border: none; cursor: pointer; font-weight: 700;" onclick="markAllNotificationsRead(event)">Mark all read</button>
        ` : ''}
      </div>
    </div>

    <div class="notif-list">
      ${notifs.length === 0 ? `
        <div style="padding: 28px 16px; text-align: center; color: var(--muted); font-size: 12.5px;">
          No notifications yet. You will receive live alerts for boardroom matches and market events.
        </div>
      ` : notifs.map(n => `
        <div class="notif-item ${!n.read ? 'unread' : ''}" onclick="handleNotificationClick('${n.id}')">
          <div class="notif-icon-box">
            ${n.category === 'boardroom' ? '🏦' : (n.category === 'market' ? '📈' : (n.category === 'wallet' ? '💳' : '✦'))}
          </div>
          <div class="notif-content">
            <div class="notif-title">
              <span>${n.title}</span>
              <span class="notif-unread-dot"></span>
            </div>
            <div class="notif-desc">${n.message}</div>
            <div class="notif-meta">
              <span>${n.time}</span>
              <span style="color: var(--jade); font-weight: 600;">Open &rarr;</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="notif-footer">
      <button type="button" class="btn-link" style="font-size: 11.5px; color: var(--muted); background: none; border: none; cursor: pointer;" onclick="requestPushPermission()">
        🔔 Browser Push Alerts
      </button>
      <button type="button" class="btn-link" style="font-size: 11.5px; color: var(--jade); background: none; border: none; cursor: pointer; font-weight: 600;" onclick="triggerSampleBoardroomNotif(event)">
        + Test Match Alert
      </button>
    </div>
  `;
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
  const unreadNotifsCount = (state.notifications || []).filter(n => !n.read).length;
  const isReal = state.mode?.toLowerCase() === 'real';
  const activeBal = isReal ? state.realWallet : state.wallet;
  const currLabel = isReal ? 'NGN' : 'VNGN';

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
          </div>
          <div class="mobile-topbar-actions">
            <!-- Mobile Mode Switcher -->
            <button class="mobile-mode-pill ${isReal ? 'real' : 'demo'}" onclick="switchMode('${isReal ? 'demo' : 'real'}')" title="Switch Mode">
              <span class="mode-dot"></span> ${isReal ? 'Real' : 'Demo'}
            </button>

            <!-- Mobile Notification Bell -->
            <div class="notif-container" id="notif-container-mobile">
              <button class="notif-btn" style="width: 32px; height: 32px;" onclick="toggleNotifDropdown(event)" aria-label="Notifications" title="Notifications">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <span class="notif-badge" id="notif-badge-mobile" style="display: ${unreadNotifsCount > 0 ? 'flex' : 'none'}; width: 15px; height: 15px; font-size: 9px; top: -2px; right: -2px;">${unreadNotifsCount}</span>
              </button>
              <div class="notif-dropdown ${state.isNotifOpen ? 'active' : ''}" id="notif-dropdown-mobile" style="right: -60px; width: 320px; max-width: calc(100vw - 32px);">
                ${renderNotifDropdownContent()}
              </div>
            </div>

            <div class="wallet-badge" onclick="navigate('wallet')" style="padding: 4px 10px; font-size: 12px; cursor: pointer;">
              ${formatMoney(activeBal.available || 0)}
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
              <button class="mode-btn ${!isReal ? 'active-demo' : ''}" onclick="switchMode('demo')" title="Virtual Educational Simulation Mode">
                <span class="mode-dot"></span> Virtual Demo
              </button>
              <button class="mode-btn ${isReal ? 'active-real' : ''}" onclick="switchMode('real')" title="${!state.features?.real_mode ? 'Real mode is disabled by admin' : 'Live real money mode'}">
                <span class="mode-dot" style="${!state.features?.real_mode ? 'opacity: 0.4;' : ''}"></span> Real Capital ${!state.features?.real_mode ? '🔒' : ''}
              </button>
            </div>

            <span class="mode-status-pill ${isReal ? 'real' : 'demo'}">
              <span class="mode-dot"></span> ${isReal ? 'Live Capital' : 'Virtual Mode'}
            </span>

            <!-- Notifications Dropdown Container -->
            <div class="notif-container" id="notif-container">
              <button class="notif-btn" onclick="toggleNotifDropdown(event)" aria-label="Notifications" title="Notifications & Deep Links">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <span class="notif-badge" id="notif-badge-count" style="display: ${unreadNotifsCount > 0 ? 'flex' : 'none'};">${unreadNotifsCount}</span>
              </button>
              <div class="notif-dropdown ${state.isNotifOpen ? 'active' : ''}" id="notif-dropdown">
                ${renderNotifDropdownContent()}
              </div>
            </div>

            <div class="wallet-badge" onclick="navigate('wallet')" style="cursor: pointer;" title="Open Ledger Wallet">
              <span>${isReal ? '💳' : '⛁'}</span> ${formatMoney(activeBal.available || 0)} <small style="font-size: 10px; margin-left: 2px;">${currLabel}</small>
            </div>
            <button class="avatar-btn" onclick="navigate('profile')" title="Strategist Profile">${userInitial}</button>
          </div>
        </header>

        <!-- Content Body -->
        <main class="content-body">
          ${state.mode?.toLowerCase() === 'real' ? `
            ${!state.features?.real_mode ? `
              <div class="panel" style="border-left: 4px solid var(--red); background: var(--red-light); color: var(--red); margin-bottom: 24px;">
                <b>Real Money Mode Disabled</b>: Real-money platform mode is currently disabled by administrator. Live transactions cannot be processed.
                <button class="btn btn-secondary" style="margin-left: 12px; padding: 4px 10px; font-size: 12px;" onclick="switchMode('demo')">Switch to Demo</button>
              </div>
            ` : `
              <div class="panel" style="border-left: 4px solid var(--jade); background: var(--jade-light); color: var(--jade); margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                <div>
                  <b>🟢 Live Capital Engine Active</b>: Real-money double-entry ledger is active. Positions, funding, and settlements directly affect your verified NGN account.
                </div>
                <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 12px;" onclick="switchMode('demo')">Switch to Virtual Demo</button>
              </div>
            `}
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
          ${renderMarketSkeletonGrid(2)}
        </div>
      </div>

      <div>
        <div class="panel" style="background: linear-gradient(145deg, #102640, #0b1a2d); color: #fff; border: none;">
          <div class="eyebrow" style="color: #38bdf8;">STRATEGY ARENA</div>
          <h2 style="color: #fff; margin: 8px 0;">The Boardroom</h2>
          <p style="color: #cbd5e1; font-size: 13.5px; margin-bottom: 18px;">
            Face sealed executive dilemmas under timed conditions with comprehensive strategy adjudication.
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
      ${renderMarketSkeletonGrid(4)}
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
      <div class="two-col">
        <div>
          <div class="skeleton-card" style="margin-bottom: 20px;">
            <div class="skeleton-shimmer skeleton-line pill" style="width: 80px;"></div>
            <div class="skeleton-shimmer skeleton-line title" style="width: 85%; height: 26px; margin: 12px 0;"></div>
            <div class="skeleton-shimmer skeleton-line subtitle"></div>
            <div class="skeleton-shimmer skeleton-line" style="width: 100%; height: 16px; margin: 14px 0;"></div>
          </div>
          <div class="skeleton-card">
            <div class="skeleton-shimmer skeleton-line title" style="width: 60%;"></div>
            <div class="skeleton-shimmer skeleton-line" style="width: 95%;"></div>
            <div class="skeleton-shimmer skeleton-line" style="width: 90%;"></div>
            <div class="skeleton-shimmer skeleton-line" style="width: 85%;"></div>
          </div>
        </div>
        <div>
          <div class="skeleton-card">
            <div class="skeleton-shimmer skeleton-line title" style="width: 50%;"></div>
            <div class="skeleton-shimmer skeleton-line subtitle"></div>
            <div class="skeleton-shimmer skeleton-line" style="width: 100%; height: 42px; margin: 16px 0;"></div>
            <div class="skeleton-shimmer skeleton-line" style="width: 100%; height: 42px;"></div>
          </div>
        </div>
      </div>
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
        To ensure competitive integrity, scenario parameters and historical parallels remain strictly confidential until the live strategy session commences.
      </p>
    </div>

    <h2>Open Lobby Challenges</h2>
    <div class="market-grid" id="boardroom-lobby-container">
      ${renderBoardroomSkeleton(3)}
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
            <label>Challenge Mode</label>
            <select class="select" id="create-mode">
              <option value="demo">Virtual Simulation (VNGN)</option>
              <option value="real" ${!state.features?.real_boardroom ? 'disabled' : ''}>
                Real Cash Stakes (NGN) ${!state.features?.real_boardroom ? '🔒 [Disabled by Admin]' : ''}
              </option>
            </select>
            <small style="color: var(--muted);">Select virtual educational simulation or live escrow stakes.</small>
          </div>
          <div class="form-group" style="margin-top: 12px;">
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
          <li><b>Executive Response</b>: Structured written memorandum; minimum 40 characters.</li>
          <li><b>Evaluation Standards</b>: Evaluated across financial reasoning, downside risk insulation, strategic precedent, and executive clarity.</li>
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
    <div id="waiting-room-content">${renderInlineLoader('Synchronizing confidential match parameters...')}</div>
  `;
}

function renderLiveChallenge() {
  return `
    <div id="live-challenge-content">${renderInlineLoader('Decrypting confidential boardroom scenario...')}</div>
  `;
}

function renderChallengeReport() {
  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">POST-MATCH LEARNING REVIEW</div>
        <h1>Strategic Evaluation & Performance Breakdown</h1>
        <p>Evaluated and adjudicated by the Strategic Intelligence Council.</p>
      </div>
      <button class="btn btn-secondary" onclick="navigate('boardroom')">Back to Lobby ↗</button>
    </div>
    <div id="challenge-report-content">${renderInlineLoader('Compiling strategic evaluation breakdown and performance scorecard...')}</div>
  `;
}

// -------------------------------------------------------------
// Double-Entry Ledger Wallet View
// -------------------------------------------------------------
function renderWalletPage() {
  const isReal = state.mode?.toLowerCase() === 'real';
  const activeBal = isReal ? state.realWallet : state.wallet;
  const currLabel = isReal ? 'NGN' : 'VNGN';
  const isRealModeEnabled = Boolean(state.features?.real_mode);
  const isFundingEnabled = Boolean(state.features?.real_funding);
  const isPayoutsEnabled = Boolean(state.features?.real_payouts);

  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">DOUBLE-ENTRY LEDGER WALLET</div>
        <h1>Capital & Activity Ledger</h1>
        <p>Immutable append-only ledger entries for virtual educational capital and verified real funds.</p>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn ${!isReal ? 'btn-primary' : 'btn-secondary'}" onclick="switchWalletMode('demo')">Virtual (VNGN)</button>
        <button class="btn ${isReal ? 'btn-primary' : 'btn-secondary'}" onclick="switchWalletMode('real')" title="${!isRealModeEnabled ? 'Real mode is disabled by admin' : 'Live real money mode'}">
          Live Real (NGN) ${!isRealModeEnabled ? '🔒' : ''}
        </button>
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
        <span>Settlement Rails</span>
        <strong style="color: var(--navy);">NIBSS Instant Pay</strong>
        <small><span class="badge-enabled">ACTIVE</span> Card, Bank Transfer & USSD</small>
      </div>
    </div>

    ${isReal ? `
      <!-- Real Mode Actions: Funding & Settlements -->
      <div class="two-col" style="margin-bottom: 24px;">
        
        <!-- Card 1: Live Gateway Deposits (real_funding) -->
        <div class="panel">
          <div class="eyebrow" style="color: var(--jade);">INSTANT DEPOSIT & LIVE FUNDING</div>
          <h2 style="margin: 8px 0 12px;">Fund Real Trading Wallet</h2>
          <p style="color: var(--muted); font-size: 13px; margin-bottom: 16px;">
            Securely deposit live funds using direct bank transfer, debit/credit cards (Mastercard, Visa, Verve), or USSD into your segregated double-entry ledger account.
          </p>

          ${!isFundingEnabled ? `
            <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 8px; padding: 14px; margin-bottom: 16px;">
              <b style="color: var(--red);">🔒 Live Deposits Paused</b>
              <p style="font-size: 12.5px; color: var(--text); margin-top: 4px;">
                Electronic deposits are currently paused by platform administration.
              </p>
            </div>
            <button class="btn btn-secondary btn-full" disabled style="opacity: 0.6; cursor: not-allowed;">
              Deposits Inactive 🔒
            </button>
          ` : `
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
              <div style="margin-top: 14px; padding: 12px; background: var(--bg); border: 1px solid var(--line); border-radius: 8px; font-size: 12px; color: var(--muted);">
                <b>Supported Channels:</b>
                <div style="display: flex; gap: 12px; margin-top: 6px; color: var(--text); font-weight: 500;">
                  <span>💳 Debit/Credit Card</span>
                  <span>🏦 Direct Bank Transfer</span>
                  <span>⚡ USSD</span>
                </div>
              </div>
              <button type="submit" class="btn btn-primary btn-full" style="margin-top: 16px;">
                Proceed to Secure Deposit (₦) ↗
              </button>
            </form>
          `}
        </div>

        <!-- Card 2: Settlement Withdrawals (real_payouts) -->
        <div class="panel">
          <div class="eyebrow" style="color: var(--jade);">SETTLEMENT & WITHDRAWAL</div>
          <h2 style="margin: 8px 0 12px;">Request Bank Withdrawal</h2>
          <p style="color: var(--muted); font-size: 13px; margin-bottom: 16px;">
            Direct electronic NIBSS bank settlement to any verified commercial bank account in Nigeria.
          </p>

          ${!isPayoutsEnabled ? `
            <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 8px; padding: 14px; margin-bottom: 16px;">
              <b style="color: var(--gold);">🔒 Real Settlements Paused</b>
              <p style="font-size: 12.5px; color: var(--text); margin-top: 4px;">
                Bank settlement transfers are currently disabled by platform administration.
              </p>
            </div>
            <button class="btn btn-secondary btn-full" disabled style="opacity: 0.6; cursor: not-allowed;">
              Withdrawals Inactive 🔒
            </button>
          ` : `
            <form onsubmit="handleWithdrawSubmit(event)">
              <div class="form-group">
                <label>Commercial Bank Name</label>
                <input class="input" type="text" id="withdraw-bank" placeholder="e.g. Access Bank, GTBank, Zenith Bank" required>
              </div>
              <div class="form-group" style="margin-top: 10px;">
                <label>10-Digit NUBAN Account Number</label>
                <input class="input" type="text" id="withdraw-account-number" maxlength="10" placeholder="0123456789" required>
              </div>
              <div class="form-group" style="margin-top: 10px;">
                <label>Account Holder Name</label>
                <input class="input" type="text" id="withdraw-account-name" placeholder="Full name registered on bank account" required>
              </div>
              <div class="form-group" style="margin-top: 10px;">
                <label>Withdrawal Amount (₦)</label>
                <input class="input" type="number" id="withdraw-amount" min="1000" step="500" value="5000" max="${activeBal.available || 0}" required>
              </div>
              <button type="submit" class="btn btn-primary btn-full" style="margin-top: 16px;">
                Request Settlement Transfer 🏦
              </button>
            </form>
          `}
        </div>

      </div>
    ` : `
      <!-- Virtual Demo Mode Actions -->
      <div class="two-col" style="margin-bottom: 24px;">
        <div class="panel">
          <div class="eyebrow" style="color: var(--jade);">SIMULATION CAPITAL</div>
          <h2 style="margin: 8px 0 12px;">Educational Virtual Balance</h2>
          <p style="color: var(--muted); font-size: 13.5px; margin-bottom: 16px;">
            Your account receives ₦500,000 in virtual funds (VNGN) strictly for educational analysis, scenario testing, and leaderboard competition.
          </p>
          <button class="btn btn-secondary" onclick="handleClaimGrant()">Claim / Verify Demo Grant (₦500,000) ↻</button>
        </div>

        <div class="panel">
          <h2>Ledger Security & Segregation</h2>
          <ul style="padding-left: 18px; color: var(--muted); font-size: 13.5px; line-height: 1.8;">
            <li><b>Zero Cross-Contamination</b>: Virtual demo capital (VNGN) and live funds (NGN) are strictly isolated across separate ledger accounts.</li>
            <li><b>Transaction Safeguards</b>: Every allocation, hold, and settlement is cryptographically audited to guarantee exact ledger balance.</li>
            <li><b>Institutional Compliance</b>: Capital flows and market positions adhere to strict capital protection standards.</li>
          </ul>
        </div>
      </div>
    `}

    <div class="panel">
      <h2>Ledger Journal Transactions (${currLabel})</h2>
      <div id="wallet-transactions-table">
        ${renderTableSkeleton(4, 4)}
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
          ${renderLeaderboardSkeleton(6)}
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
  const lab = state.lab;
  const currentInd = (lab.industries || []).find(i => i.slug === lab.selectedIndustry) || {
    slug: 'monetary',
    name: 'Monetary Policy & Banking',
    icon: '🏦',
    tagline: 'Liquidity transmission, benchmark yield corridors, and CRR sterilization.',
  };

  const p = lab.params || {};
  const res = lab.results || runLocalLabSimulation();

  const infColor = res.projected_inflation > 32 ? 'var(--red)' : (res.projected_inflation > 20 ? 'var(--orange)' : 'var(--jade)');
  const creditColor = res.credit_impulse < 35 ? 'var(--red)' : (res.credit_impulse < 60 ? 'var(--orange)' : 'var(--jade)');
  const investColor = res.investment_index < 35 ? 'var(--red)' : (res.investment_index < 60 ? 'var(--orange)' : 'var(--jade)');
  const pwrColor = res.purchasing_power < 35 ? 'var(--red)' : (res.purchasing_power < 55 ? 'var(--orange)' : 'var(--jade)');
  const debtColor = res.debt_service_burden > 70 ? 'var(--red)' : (res.debt_service_burden > 55 ? 'var(--orange)' : 'var(--jade)');
  const marginColor = res.margin_stress < 0 ? 'var(--red)' : (res.margin_stress < 8 ? 'var(--orange)' : 'var(--jade)');

  const defs = lab.definitions || {};

  const indList = (lab.industries && lab.industries.length > 0) ? lab.industries : [
    { slug: 'monetary', name: 'Monetary Policy', icon: '🏦' },
    { slug: 'energy', name: 'Energy & Oil', icon: '⚡' },
    { slug: 'agriculture', name: 'Agriculture', icon: '🌾' },
    { slug: 'manufacturing', name: 'Manufacturing', icon: '🏭' },
    { slug: 'fintech', name: 'Fintech', icon: '💻' },
    { slug: 'telecoms', name: 'Telecoms', icon: '📱' },
    { slug: 'fmcg', name: 'FMCG & Retail', icon: '🛒' },
    { slug: 'real-estate', name: 'Real Estate', icon: '🏢' },
    { slug: 'logistics', name: 'Aviation & Logistics', icon: '✈️' },
    { slug: 'healthcare', name: 'Healthcare & Pharma', icon: '🏥' },
  ];

  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">MULTIVARIATE ECONOMIC & INDUSTRY SIMULATION LAB</div>
        <h1>Scenario Lab</h1>
        <p>Calibrate empirical policy levers, test supply & demand shocks, and observe real-time equilibrium transmission across sectors.</p>
      </div>
    </div>

    <!-- Industry Selector Pills -->
    <div class="lab-industry-pills">
      ${indList.map(ind => `
        <button type="button" class="lab-industry-pill ${lab.selectedIndustry === ind.slug ? 'active' : ''}" onclick="selectLabIndustry('${ind.slug}')">
          <span>${ind.icon || '📊'}</span>
          <span>${ind.name}</span>
        </button>
      `).join('')}
    </div>

    <div class="two-col" style="align-items: flex-start; gap: 24px;">
      <!-- Left Column: Scenarios & Policy Levers -->
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Active Sector Header -->
        <div class="panel" style="border-left: 4px solid var(--jade);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div class="eyebrow" style="color: var(--jade);">${currentInd.name.toUpperCase()} SECTOR</div>
            <span class="badge badge-enabled">Empirical Model Active</span>
          </div>
          <h2 style="margin: 0 0 6px; font-size: 18px; display: flex; align-items: center; gap: 8px;">
            <span>${currentInd.icon || '🏦'}</span>
            <span>${currentInd.name}</span>
          </h2>
          <p style="font-size: 13px; color: var(--muted); margin: 0;">${currentInd.tagline || ''}</p>
        </div>

        <!-- Scenarios Selection -->
        <div class="panel">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
            <div class="eyebrow">CRISIS & POLICY SCENARIOS</div>
            <span style="font-size: 12px; color: var(--muted);">${(lab.scenarios || []).length} Presets Available</span>
          </div>
          <div id="lab-scenarios-container">
            ${(lab.scenarios && lab.scenarios.length > 0) ? lab.scenarios.map(sc => `
              <div class="lab-scenario-card ${lab.selectedScenarioId === sc.id ? 'active' : ''}" onclick="selectLabScenario('${sc.id}')">
                <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
                  <strong style="font-size: 14px; color: var(--text);">${sc.title}</strong>
                  ${lab.selectedScenarioId === sc.id ? '<span class="badge badge-enabled" style="font-size: 10px;">ACTIVE</span>' : ''}
                </div>
                <p style="font-size: 12.5px; color: var(--muted); margin: 4px 0 8px; line-height: 1.5;">${sc.description}</p>
                <div style="font-size: 11.5px; color: var(--navy); background: rgba(36,121,101,0.06); padding: 6px 10px; border-radius: 6px; border: 1px solid rgba(36,121,101,0.15);">
                  <b>Core Dilemma:</b> ${sc.core_dilemma || 'Evaluate transmission channels and strategic counter-measures.'}
                </div>
              </div>
            `).join('') : renderScenarioSkeleton(2)}
          </div>

          <!-- Custom AI Scenario Prompt Box -->
          <div style="margin-top: 18px; border-top: 1px dashed var(--line); padding-top: 16px;">
            <div class="eyebrow" style="margin-bottom: 8px; color: var(--navy);">✨ GENERATE CUSTOM AI DILEMMA</div>
            <form onsubmit="handleGenerateAiScenario(event)">
              <div style="display: flex; gap: 8px;">
                <input class="input" id="lab-ai-prompt" placeholder="E.g., Crude drops to $50, FX hits ₦2,200, fuel surges 30%..." style="font-size: 12.5px;" required>
                <button type="submit" class="btn btn-secondary" style="white-space: nowrap;" id="btn-gen-ai-scenario">
                  ${lab.isAiGenLoading ? 'Generating...' : 'Synthesize AI'}
                </button>
              </div>
              <small style="color: var(--muted); font-size: 11px; display: block; margin-top: 4px;">Synthesizes a calibrated macroeconomic scenario on demand.</small>
            </form>
          </div>
        </div>

        <!-- Macroeconomic Levers -->
        <div class="panel">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div>
              <div class="eyebrow">CALIBRATE LEVERS</div>
              <h2 style="font-size: 16px; margin: 4px 0 0;">Macroeconomic & Industry Policy Controls</h2>
            </div>
            <button class="btn btn-secondary" style="font-size: 11.5px; padding: 4px 10px;" onclick="resetLabParameters()">↺ Reset Baseline</button>
          </div>

          <!-- Lever 1: MPR -->
          ${renderLeverBox('mpr', 'Monetary Policy Rate (MPR)', p.mpr ?? 27.25, 5, 35, 0.25, '%', '5% Accommodative', '35% Restrictive', defs.mpr)}

          <!-- Lever 2: Inflation -->
          ${renderLeverBox('inflation', 'Headline Inflation (CPI)', p.inflation ?? 32.5, 2, 50, 0.5, '%', '2% Single Digit', '50% Hyperinflationary', defs.inflation)}

          <!-- Lever 3: FX Rate -->
          ${renderLeverBox('fx_rate', 'Exchange Rate (USD/NGN)', p.fx_rate ?? 1650, 700, 2500, 25, '₦/$', '₦700 Overvalued', '₦2,500 Devaluation', defs.fx_rate)}

          <!-- Lever 4: Fuel Price -->
          ${renderLeverBox('fuel_price', 'Industrial Fuel & Pump Price', p.fuel_price ?? 1050, 500, 2000, 25, '₦/L', '₦500 Subsidized', '₦2,000 Deregulated', defs.fuel_price)}

          <!-- Lever 5: CRR -->
          ${renderLeverBox('crr', 'Cash Reserve Requirement (CRR)', p.crr ?? 45.0, 10, 60, 1.0, '%', '10% High Liquidity', '60% Ultra Tight', defs.crr)}

          <!-- Lever 6: Spend Impulse -->
          ${renderLeverBox('spend_impulse', 'Fiscal Spending / Deficit Impulse', p.spend_impulse ?? 14.0, 1, 25, 0.5, '% GDP', '1% Austerity', '25% Expansionary', defs.spend_impulse)}

        </div>
      </div>

      <!-- Right Column: Equilibrium Gauges & AI Briefing -->
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Live Gauges Panel -->
        <div class="panel">
          <div class="eyebrow" style="color: var(--jade);">LIVE EQUILIBRIUM PROJECTIONS</div>
          <h2 style="font-size: 16px; margin: 4px 0 16px;">Transmission Gauges & Stress Indices</h2>

          <!-- Gauge 1: Projected Inflation -->
          <div class="lab-gauge-card">
            <div class="lab-gauge-header">
              <span style="font-size: 13px; font-weight: 600;">Projected 12M Inflation Trajectory</span>
              <span class="lab-val-badge" id="gauge-val-inf" style="color: ${infColor}; font-size: 16px;">${res.projected_inflation}%</span>
            </div>
            <div class="lab-gauge-bar">
              <div class="lab-gauge-fill" id="gauge-bar-inf" style="width: ${Math.min(100, (res.projected_inflation / 60) * 100)}%; background: ${infColor};"></div>
            </div>
            <small id="gauge-sub-inf" style="font-size: 11.5px; color: var(--muted);">
              ${res.projected_inflation > 32 ? 'Critical cost-push & currency pass-through pressure' : (res.projected_inflation > 20 ? 'Elevated structural inflation corridor' : 'Contained baseline price dynamics')}
            </small>
          </div>

          <!-- Gauge 2: Credit Impulse -->
          <div class="lab-gauge-card">
            <div class="lab-gauge-header">
              <span style="font-size: 13px; font-weight: 600;">Real Sector Credit Impulse Index</span>
              <span class="lab-val-badge" id="gauge-val-credit" style="color: ${creditColor}; font-size: 16px;">${res.credit_impulse} / 100</span>
            </div>
            <div class="lab-gauge-bar">
              <div class="lab-gauge-fill" id="gauge-bar-credit" style="width: ${res.credit_impulse}%; background: ${creditColor};"></div>
            </div>
            <small id="gauge-sub-credit" style="font-size: 11.5px; color: var(--muted);">
              ${res.credit_impulse < 40 ? 'Severe liquidity sterilization; commercial banks rationing credit' : 'Moderate loanable funds available to private enterprise'}
            </small>
          </div>

          <!-- Gauge 3: CapEx / Private Investment -->
          <div class="lab-gauge-card">
            <div class="lab-gauge-header">
              <span style="font-size: 13px; font-weight: 600;">Private Investment & CapEx Sentiment</span>
              <span class="lab-val-badge" id="gauge-val-invest" style="color: ${investColor}; font-size: 16px;">${res.investment_index} / 100</span>
            </div>
            <div class="lab-gauge-bar">
              <div class="lab-gauge-fill" id="gauge-bar-invest" style="width: ${res.investment_index}%; background: ${investColor};"></div>
            </div>
            <small id="gauge-sub-invest" style="font-size: 11.5px; color: var(--muted);">
              ${res.investment_index < 40 ? 'Corporate capital investments paused; balance sheet defensive mode' : 'Supportive climate for multi-year expansion investments'}
            </small>
          </div>

          <!-- Gauge 4: Consumer Purchasing Power -->
          <div class="lab-gauge-card">
            <div class="lab-gauge-header">
              <span style="font-size: 13px; font-weight: 600;">Consumer Purchasing Power Index</span>
              <span class="lab-val-badge" id="gauge-val-pwr" style="color: ${pwrColor}; font-size: 16px;">${res.purchasing_power} / 100</span>
            </div>
            <div class="lab-gauge-bar">
              <div class="lab-gauge-fill" id="gauge-bar-pwr" style="width: ${res.purchasing_power}%; background: ${pwrColor};"></div>
            </div>
            <small id="gauge-sub-pwr" style="font-size: 11.5px; color: var(--muted);">
              ${res.purchasing_power < 40 ? 'Acute disposable income squeeze; volume drop across consumer staples' : 'Resilient household demand absorbing modest price increases'}
            </small>
          </div>

          <!-- Gauge 5: Sovereign Debt Service Burden -->
          <div class="lab-gauge-card">
            <div class="lab-gauge-header">
              <span style="font-size: 13px; font-weight: 600;">Sovereign Debt Service-to-Revenue</span>
              <span class="lab-val-badge" id="gauge-val-debt" style="color: ${debtColor}; font-size: 16px;">${res.debt_service_burden}%</span>
            </div>
            <div class="lab-gauge-bar">
              <div class="lab-gauge-fill" id="gauge-bar-debt" style="width: ${Math.min(100, (res.debt_service_burden / 100) * 100)}%; background: ${debtColor};"></div>
            </div>
            <small id="gauge-sub-debt" style="font-size: 11.5px; color: var(--muted);">
              ${res.debt_service_burden > 70 ? 'High crowding-out risk; domestic yields locked into sovereign paper' : 'Sustainable debt sustainability corridor'}
            </small>
          </div>

          <!-- Gauge 6: Industry Gross Margin Stress -->
          <div class="lab-gauge-card">
            <div class="lab-gauge-header">
              <span style="font-size: 13px; font-weight: 600;">Sector Gross Margin Delta</span>
              <span class="lab-val-badge" id="gauge-val-margin" style="color: ${marginColor}; font-size: 16px;">${res.margin_stress > 0 ? '+' : ''}${res.margin_stress}%</span>
            </div>
            <div class="lab-gauge-bar">
              <div class="lab-gauge-fill" id="gauge-bar-margin" style="width: ${Math.max(10, Math.min(100, 50 + res.margin_stress * 2))}%; background: ${marginColor};"></div>
            </div>
            <small id="gauge-sub-margin" style="font-size: 11.5px; color: var(--muted);">
              ${res.margin_stress < 0 ? 'Severe unit margin contraction under import FX & power cost shocks' : 'Stable or expanding sectoral gross margins'}
            </small>
          </div>

          <!-- Gauge 7: Supply Chain & Freight Logistics Stress -->
          <div class="lab-gauge-card">
            <div class="lab-gauge-header">
              <span style="font-size: 13px; font-weight: 600;">Supply Chain & Logistics Disruption Strain</span>
              <span class="lab-val-badge" id="gauge-val-supply" style="color: ${(res.supply_chain_stress || 65) > 70 ? 'var(--red)' : ((res.supply_chain_stress || 65) > 50 ? 'var(--orange)' : 'var(--jade)')}; font-size: 16px;">${res.supply_chain_stress || 65} / 100</span>
            </div>
            <div class="lab-gauge-bar">
              <div class="lab-gauge-fill" id="gauge-bar-supply" style="width: ${res.supply_chain_stress || 65}%; background: ${(res.supply_chain_stress || 65) > 70 ? 'var(--red)' : ((res.supply_chain_stress || 65) > 50 ? 'var(--orange)' : 'var(--jade)')};"></div>
            </div>
            <small id="gauge-sub-supply" style="font-size: 11.5px; color: var(--muted);">
              ${(res.supply_chain_stress || 65) > 70 ? 'Port congestion, demurrage fees, and diesel haulage costs severely squeezing inventory velocity' : 'Manageable transport corridors and warehouse turnover'}
            </small>
          </div>

          <!-- Gauge 8: NGX Listed Corporate Health & Solvency -->
          <div class="lab-gauge-card">
            <div class="lab-gauge-header">
              <span style="font-size: 13px; font-weight: 600;">NGX Listed Corporate Solvency & Earnings Index</span>
              <span class="lab-val-badge" id="gauge-val-corp" style="color: ${(res.corporate_health || 55) < 45 ? 'var(--red)' : ((res.corporate_health || 55) < 65 ? 'var(--orange)' : 'var(--jade)')}; font-size: 16px;">${res.corporate_health || 55} / 100</span>
            </div>
            <div class="lab-gauge-bar">
              <div class="lab-gauge-fill" id="gauge-bar-corp" style="width: ${res.corporate_health || 55}%; background: ${(res.corporate_health || 55) < 45 ? 'var(--red)' : ((res.corporate_health || 55) < 65 ? 'var(--orange)' : 'var(--jade)')};"></div>
            </div>
            <small id="gauge-sub-corp" style="font-size: 11.5px; color: var(--muted);">
              ${(res.corporate_health || 55) < 45 ? 'Elevated unhedged FX balance sheet losses and 30%+ commercial loan servicing strains' : 'Stable debt service coverage ratios and pricing power across listed public firms'}
            </small>
          </div>

          <!-- Gauge 9: Sovereign FX Reserve Pressure -->
          <div style="background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <span style="font-size: 13px; font-weight: 600;">Sovereign FX Buffer Status:</span>
            <span id="gauge-val-fxp" class="badge ${res.fx_pressure === 'Critical Alert' ? 'badge-sandbox' : 'badge-enabled'}" style="${res.fx_pressure === 'Critical Alert' ? 'background: #f87171; color: #fff;' : ''}">${res.fx_pressure}</span>
          </div>
        </div>

        <!-- Public Listed Equities Transmission Radar (NGX & African Bourses) -->
        <div class="panel">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div class="eyebrow" style="color: var(--jade);">PUBLIC CORPORATE RADAR</div>
            <span class="badge" style="background: rgba(36,121,101,0.12); color: var(--jade); font-size: 11px;">NGX & African Exchanges</span>
          </div>
          <h2 style="font-size: 16px; margin: 0 0 6px;">Public Equities & Supply Chain Transmission</h2>
          <p style="font-size: 12.5px; color: var(--muted); margin-bottom: 14px;">
            Real-time sensitivity radar evaluating how currently dialed policy rates, diesel fuel, and currency levels permeate listed corporate earnings and supply chains.
          </p>

          <div id="lab-corporate-radar-container" style="display: flex; flex-direction: column; gap: 10px;">
            ${renderCorporateRadarList(res.listed_corporate_radar)}
          </div>
        </div>

        <!-- AI Masterclass Policy Briefing Panel -->
        <div class="panel">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div class="eyebrow" style="color: var(--navy);">STRATEGIC POLICY EVALUATION</div>
            <span class="badge" style="background: rgba(36,121,101,0.12); color: var(--jade);">Executive Adjudication</span>
          </div>
          <h2 style="font-size: 16px; margin: 0 0 8px;">Executive Masterclass Policy Briefing</h2>
          <p style="font-size: 12.5px; color: var(--muted); margin-bottom: 16px;">
            Dispatch current macroeconomic equilibrium parameters to the neural model to produce a comprehensive 5-part executive strategy dossier.
          </p>

          <button class="btn btn-primary btn-full" id="btn-run-briefing" onclick="handleRunAiBriefing()" ${lab.isBriefingLoading ? 'disabled' : ''}>
            ${lab.isBriefingLoading ? '<span class="spinner" style="width: 14px; height: 14px; border-width: 2px; display: inline-block; margin-right: 8px;"></span> Synthesizing Executive Briefing...' : 'Generate Executive Masterclass Briefing ⚡'}
          </button>

          <!-- Briefing Results Container -->
          <div id="lab-briefing-panel" style="margin-top: 16px;">
            ${renderLabBriefingOutput()}
          </div>
        </div>

      </div>
    </div>
  `;
}

function renderLeverBox(key, name, value, min, max, step, unit, minLabel, maxLabel, def) {
  const isOpen = !!(state.lab && state.lab.openPrimers && state.lab.openPrimers[key]);
  const formattedVal = formatLabParamVal(key, value);

  let primerHtml = '';
  if (def) {
    primerHtml = `
      <div id="lab-primer-${key}" class="lab-primer-drawer" style="display: ${isOpen ? 'block' : 'none'};">
        <div style="margin-bottom: 8px;">
          <b style="color: var(--navy); display: block; font-size: 12px; margin-bottom: 2px;">Core Economic Definition:</b>
          <span>${def.definition || ''}</span>
        </div>
        <div style="margin-bottom: 8px;">
          <b style="color: var(--jade); display: block; font-size: 12px; margin-bottom: 2px;">Emerging Market / Nigeria Context:</b>
          <span>${def.emerging_market_context || ''}</span>
        </div>
        <div style="margin-bottom: 8px;">
          <b style="color: var(--text); display: block; font-size: 12px; margin-bottom: 2px;">Transmission Channels:</b>
          <ul style="margin: 4px 0 0 16px; padding: 0; font-size: 12px;">
            ${Object.entries(def.transmission_channels || {}).map(([ord, desc]) => `
              <li style="margin-bottom: 4px;"><b>${ord}:</b> ${desc}</li>
            `).join('')}
          </ul>
        </div>
        <div>
          <b style="color: var(--navy); display: block; font-size: 12px; margin-bottom: 2px;">Executive Leadership Playbook:</b>
          <span>${def.executive_implications || ''}</span>
        </div>
      </div>
    `;
  }

  return `
    <div class="lab-lever-box">
      <div class="lab-lever-header">
        <label for="lab-slider-${key}" style="font-weight: 600; font-size: 13.5px; margin: 0; cursor: pointer;">${name}</label>
        <span class="lab-val-badge" id="lab-val-${key}">${formattedVal}</span>
      </div>
      <input type="range" class="input" id="lab-slider-${key}" min="${min}" max="${max}" step="${step}" value="${value}" oninput="updateLabSlider('${key}', this.value)" style="width: 100%; cursor: pointer;">
      <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); margin-top: 4px;">
        <span>${minLabel}</span>
        <span>${maxLabel}</span>
      </div>
      ${def ? `
        <button type="button" class="lab-primer-toggle" onclick="toggleLabPrimer('${key}')">
          <span>ℹ️ What does this mean & how does it transmit? ${isOpen ? '▲' : '▼'}</span>
        </button>
        ${primerHtml}
      ` : ''}
    </div>
  `;
}

function renderLabBriefingOutput() {
  const b = state.lab ? state.lab.aiBriefing : null;
  if (!b) {
    return `
      <div style="text-align: center; padding: 24px; color: var(--muted); background: var(--bg); border: 1px dashed var(--line); border-radius: 8px; font-size: 13px;">
        Adjust the levers to configure your macroeconomic stress scenario, then click <b>Generate Executive Masterclass Briefing</b> to receive an AI-adjudicated policy evaluation.
      </div>
    `;
  }

  // Handle unified markdown string or object with sections
  let contentHtml = '';
  if (typeof b === 'string') {
    contentHtml = renderMarkdown(b);
  } else if (b.briefing_text) {
    contentHtml = renderMarkdown(b.briefing_text);
  } else {
    contentHtml = `
      ${b.executive_summary ? `<div style="margin-bottom: 14px;"><h4 style="margin: 0 0 4px; color: var(--navy); font-size: 13.5px;">1. Executive Summary & Macro Stance</h4><div>${renderMarkdown(b.executive_summary)}</div></div>` : ''}
      ${b.transmission_mechanisms ? `<div style="margin-bottom: 14px;"><h4 style="margin: 0 0 4px; color: var(--navy); font-size: 13.5px;">2. Transmission Channels & Financial Conditions</h4><div>${renderMarkdown(b.transmission_mechanisms)}</div></div>` : ''}
      ${b.sector_impacts ? `<div style="margin-bottom: 14px;"><h4 style="margin: 0 0 4px; color: var(--navy); font-size: 13.5px;">3. Sectoral Margin Stress & Working Capital</h4><div>${renderMarkdown(b.sector_impacts)}</div></div>` : ''}
      ${b.corporate_playbook ? `<div style="margin-bottom: 14px;"><h4 style="margin: 0 0 4px; color: var(--navy); font-size: 13.5px;">4. Corporate Leadership Playbook (C-Suite Tactics)</h4><div>${renderMarkdown(b.corporate_playbook)}</div></div>` : ''}
      ${b.risks_and_tail_events ? `<div><h4 style="margin: 0 0 4px; color: var(--red); font-size: 13.5px;">5. Tail Risks & Black Swan Scenarios</h4><div>${renderMarkdown(b.risks_and_tail_events)}</div></div>` : ''}
    `;
  }

  return `
    <div style="background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 18px; font-size: 13px; line-height: 1.7;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--line); padding-bottom: 8px; margin-bottom: 14px;">
        <b style="color: var(--jade); font-size: 14px;">MEMORANDUM TO THE BOARD & EXECUTIVE COMMITTEE</b>
        <small style="color: var(--muted); font-size: 11px;">Executive Intelligence Desk</small>
      </div>
      <div style="color: var(--text);">${contentHtml}</div>
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
  const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
  const permLabel = perm === 'granted' ? 'Active ✓' : (perm === 'denied' ? 'Blocked ✕' : 'Not Granted 🔔');
  const permColor = perm === 'granted' ? 'var(--jade)' : (perm === 'denied' ? 'var(--red)' : 'var(--gold)');

  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">PREFERENCES</div>
        <h1>Workspace Settings</h1>
        <p>Configure interface styling, live push notifications, and account options.</p>
      </div>
    </div>

    <div class="panel" style="max-width: 650px; margin-bottom: 24px;">
      <h2>Appearance Theme</h2>
      <p style="color: var(--muted); font-size: 13px; margin: 4px 0 16px;">Select your preferred visual mode for high-contrast analytics.</p>
      <div style="display: flex; gap: 10px;">
        <button class="btn ${state.theme === 'light' ? 'btn-primary' : 'btn-secondary'}" onclick="setAppTheme('light')">☼ Light Terminal</button>
        <button class="btn ${state.theme === 'dark' ? 'btn-primary' : 'btn-secondary'}" onclick="setAppTheme('dark')">◑ Dark Mode</button>
      </div>
    </div>

    <div class="panel" style="max-width: 650px;">
      <h2>Notifications & Deep-Link Alerts</h2>
      <p style="color: var(--muted); font-size: 13px; margin: 4px 0 16px;">
        Receive real-time push notifications when boardroom challenges are ready or catalyst contracts resolve.
      </p>

      <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px solid var(--line);">
        <div>
          <b>Browser Web Push Permission</b><br>
          <small style="color: var(--muted);">Status: <span style="font-weight: bold; color: ${permColor};">${permLabel}</span></small>
        </div>
        <button class="btn btn-secondary" onclick="requestPushPermission()">
          ${perm === 'granted' ? 'Push Enabled 🔔' : 'Enable Push Alerts 🔔'}
        </button>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px solid var(--line);">
        <div>
          <b>Simulate Boardroom Challenge Alert</b><br>
          <small style="color: var(--muted);">Dispatches a test notification with deep linking directly to the dilemma</small>
        </div>
        <button class="btn btn-primary" style="padding: 6px 14px; font-size: 12.5px;" onclick="triggerSampleBoardroomNotif()">
          Dispatch Test Alert ↗
        </button>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 0;">
        <div>
          <b>Notification History</b><br>
          <small style="color: var(--muted);">${state.notifications.length} stored notification(s)</small>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary" style="font-size: 12px; padding: 6px 12px;" onclick="markAllNotificationsRead(event)">Mark Read ✓</button>
          <button class="btn btn-secondary" style="font-size: 12px; padding: 6px 12px; color: var(--red);" onclick="clearAllNotifications(event)">Clear All</button>
        </div>
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
  } else if (state.page === 'waiting_room' && state.currentChallengeId) {
    loadWaitingRoomData(state.currentChallengeId);
  } else if (state.page === 'live_challenge' && state.currentChallengeId) {
    loadLiveChallengeData(state.currentChallengeId);
  } else if (state.page === 'challenge_report' && state.currentChallengeId) {
    loadChallengeReportData(state.currentChallengeId);
  } else if (state.page === 'lab') {
    loadScenarioLabData(state.lab.selectedIndustry);
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
  const el = document.getElementById('markets-container');
  if (el) el.innerHTML = renderMarketSkeletonGrid(4);
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
    const isReal = state.mode?.toLowerCase() === 'real';
    const activeBal = isReal ? state.realWallet : state.wallet;
    const currLabel = isReal ? 'NGN' : 'VNGN';

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
            <div class="eyebrow">FORECAST TICKET (${currLabel})</div>
            <h2>Make Your Call</h2>
            <p style="font-size: 13px; color: var(--muted); margin-bottom: 16px;">
              Commit ${isReal ? 'live real capital' : 'educational virtual capital'} based on fundamental research and record your thesis in the Decision Journal.
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
                <label>${isReal ? 'Live Capital Stake (₦ NGN)' : 'Virtual Capital Stake (₦ VNGN)'}</label>
                <input class="input" type="number" id="forecast-amount" value="5000" min="100" max="${activeBal.available || 0}" required>
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
                  <b style="color: var(--jade);">${formatMoney(activeBal.available || 0)} ${currLabel}</b>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span>Locked Potential Payout:</span>
                  <b id="payout-estimate" style="color: var(--gold); font-size: 14px;">
                    ${formatMoney(Math.round(5000 * parseFloat(oddsYes)))} <small style="font-size: 11px; font-weight: normal; color: var(--muted);">(${oddsYes}× entry odd)</small>
                  </b>
                </div>
              </div>

              <button type="submit" class="btn btn-primary btn-full">
                Confirm ${isReal ? 'Live Commitment (₦ NGN)' : 'Virtual Commitment (₦ VNGN)'} ↗
              </button>
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
  const currentMode = (state.mode || 'demo').toLowerCase();

  if (currentMode === 'real' && !state.features?.real_mode) {
    api.toast('Real Money Mode is currently disabled by administrator.', 'warning');
    return;
  }

  try {
    const res = await api.post(`/markets/${eventId}/forecast`, {
      outcome: chosenOutcome,
      amount: amt,
      thesis,
      mode: currentMode,
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
          <span class="sim-tag" style="${c.mode === 'real' ? 'background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);' : ''}">
            ${c.mode === 'real' ? 'REAL STAKE (NGN)' : 'VIRTUAL (VNGN)'}
          </span>
        </div>
        <div class="sealed-box">
          <div class="lock">🔒</div>
          <b>Scenario Sealed</b>
          <p style="font-size: 11.5px; color: var(--muted); margin-top: 4px;">Released simultaneously upon match start</p>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 13px;">
          <span>Host: <b>${c.host}</b></span>
          <span>Commitment: <b>${formatMoney(c.commitment)} ${c.mode === 'real' ? 'NGN' : 'VNGN'}</b></span>
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
  const mode = document.getElementById('create-mode')?.value || 'demo';

  if (mode === 'real') {
    if (!state.features?.real_mode) {
      api.toast('Real Money Mode is currently disabled by administrator.', 'warning');
      return;
    }
    if (!state.features?.real_boardroom) {
      api.toast('Real-money boardroom challenges are currently disabled by administrator.', 'warning');
      return;
    }
  }

  try {
    const res = await api.post('/boardroom/create', {
      industry_id: industryId,
      stake,
      duration,
      mode,
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
              Core Evaluation Focus: Financial Mechanics · Downside Risk Insulation · Historical Precedent · Executive Clarity
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
          <h2>Memo Queued for Strategic Adjudication</h2>
          <p style="color: var(--muted); max-width: 520px; margin: 8px auto 20px;">
            Your executive memo has been recorded and submitted. The Strategic Adjudication Council is assessing your decision rationale and quantitative thesis.
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
  const el = document.getElementById('wallet-transactions-table');
  if (el && state.page === 'wallet' && el.querySelector('table')) {
    el.innerHTML = renderTableSkeleton(4, 4);
  }
  try {
    const res = await api.get(`/wallet?mode=${state.mode}`);
    if (res?.data) {
      if (res.data.demo_balance) state.wallet = res.data.demo_balance;
      if (res.data.real_balance) state.realWallet = res.data.real_balance;
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
  const norm = (m || 'demo').toLowerCase();
  if (norm === 'real' && !state.features?.real_mode) {
    api.toast('Real Money Mode is currently disabled by administrator.', 'warning');
    return;
  }
  state.mode = norm;
  localStorage.setItem('econsim-mode', norm);
  navigate('wallet');
}

async function handleDepositSubmit(e) {
  e.preventDefault();
  if (!state.features?.real_mode) {
    api.toast('Real Money Mode is currently disabled by administrator.', 'warning');
    return;
  }
  if (!state.features?.real_funding) {
    api.toast('Live gateway deposits are currently disabled by administrator.', 'warning');
    return;
  }

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

async function handleWithdrawSubmit(e) {
  e.preventDefault();
  if (!state.features?.real_mode) {
    api.toast('Real Money Mode is currently disabled by administrator.', 'warning');
    return;
  }
  if (!state.features?.real_payouts) {
    api.toast('Settlement withdrawals are currently disabled by administrator.', 'warning');
    return;
  }

  const bankName = document.getElementById('withdraw-bank')?.value.trim();
  const accNum = document.getElementById('withdraw-account-number')?.value.trim();
  const accName = document.getElementById('withdraw-account-name')?.value.trim();
  const amt = parseInt(document.getElementById('withdraw-amount')?.value, 10);

  if (!bankName || !accNum || accNum.length !== 10 || !accName || !amt || amt < 1000) {
    api.toast('Please provide valid bank name, 10-digit NUBAN account number, account holder name, and amount (min ₦1,000).', 'error');
    return;
  }

  try {
    const res = await api.post('/wallet/withdraw', {
      bank_name: bankName,
      account_number: accNum,
      account_name: accName,
      amount: amt,
    });
    api.toast(res.message || 'Settlement withdrawal queued successfully!', 'success');
    await loadWalletData();
    navigate('wallet');
  } catch (err) {}
}

async function loadLeaderboardData(tab = 'Overall') {
  state.leaderboardTab = tab;
  const tbody = document.getElementById('leaderboard-table-body');
  if (tbody) tbody.innerHTML = renderLeaderboardSkeleton(6);

  try {
    const res = await api.get(`/leaderboard?tab=${tab}`);
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









// -------------------------------------------------------------
// AI Mentor
// -------------------------------------------------------------
async function handleAskMentor(e) {
  e.preventDefault();
  const input = document.getElementById('mentor-input');
  const q = input.value.trim();
  if (!q) return;

  input.value = '';

  const thread = document.getElementById('mentor-chat-thread');
  let tempQEl = null;
  let tempLoaderEl = null;
  if (thread) {
    tempQEl = document.createElement('div');
    tempQEl.style.cssText = 'align-self: flex-end; background: var(--navy); color: #fff; padding: 12px 18px; border-radius: 12px; max-width: 85%; font-size: 14px;';
    tempQEl.innerHTML = `<b>Q:</b> ${escapeHtml(q)}`;
    thread.appendChild(tempQEl);

    tempLoaderEl = document.createElement('div');
    tempLoaderEl.id = 'mentor-thinking-indicator';
    tempLoaderEl.style.cssText = 'background: var(--bg); border: 1px solid var(--line); padding: 16px 20px; border-radius: 12px; max-width: 95%; display: flex; align-items: center; gap: 12px;';
    tempLoaderEl.innerHTML = `
      <div class="inline-spinner" style="width: 18px; height: 18px; border-width: 2px;"></div>
      <span style="font-size: 13.5px; color: var(--muted);">AI Mentor is synthesizing macroeconomic transmission channels and executive analysis...</span>
    `;
    thread.appendChild(tempLoaderEl);
    thread.scrollTop = thread.scrollHeight;
  }

  try {
    const res = await api.post('/mentor/ask', { query: q });
    state.mentorHistory.push({ q, a: res.data.answer, source: res.data.source });
    navigate('mentor');
  } catch (err) {
    if (tempLoaderEl) {
      tempLoaderEl.innerHTML = `<span style="color: var(--red); font-size: 13px;">Unable to fetch mentor response. Please try again.</span>`;
    }
  }
}

function triggerQuickMentor(q) {
  document.getElementById('mentor-input').value = q;
  handleAskMentor(new Event('submit'));
}

// -------------------------------------------------------------
// Interactive Scenario Lab Controls & Simulation Engine
// -------------------------------------------------------------
function formatLabParamVal(key, val) {
  const n = parseFloat(val);
  switch (key) {
    case 'mpr':
    case 'inflation':
    case 'crr':
      return `${n.toFixed(2)}%`;
    case 'fx_rate':
      return `₦${Math.round(n).toLocaleString('en-NG')} / $`;
    case 'fuel_price':
      return `₦${Math.round(n).toLocaleString('en-NG')} / L`;
    case 'spend_impulse':
      return `${n.toFixed(1)}% GDP`;
    default:
      return `${n}`;
  }
}

function runLocalLabSimulation() {
  if (!state.lab.params) {
    state.lab.params = {
      mpr: 27.25,
      inflation: 32.5,
      fx_rate: 1650,
      fuel_price: 1050,
      crr: 45.0,
      spend_impulse: 14.0,
    };
  }

  const p = state.lab.params;
  const ind = state.lab.selectedIndustry || 'monetary';

  const mpr = parseFloat(p.mpr ?? 26.25);
  const inflation = parseFloat(p.inflation ?? 32.0);
  const fxRate = parseFloat(p.fx_rate ?? 1650);
  const fuelPrice = parseFloat(p.fuel_price ?? 1050);
  const crr = parseFloat(p.crr ?? 45.0);
  const spend = parseFloat(p.spend_impulse ?? 12.0);

  // Exact matching formulas with ScenarioLabService::simulate
  const fxDeprecFactor = Math.max(0, (fxRate - 1000) / 1000) * 8.5;
  const fuelShockFactor = Math.max(0, (fuelPrice - 700) / 500) * 6.2;
  const mprDamping = (mpr - 20) * 0.45;
  const crrDamping = (crr - 32.5) * 0.12;
  const fiscalPush = (spend - 10) * 0.35;

  const rawInf = inflation + fxDeprecFactor + fuelShockFactor + fiscalPush - mprDamping - crrDamping;
  const projectedInflation = Math.round(Math.max(5.0, Math.min(65.0, rawInf)) * 10) / 10;

  const rawCredit = 68 - (mpr - 15) * 1.8 - (crr - 25) * 0.65 + (spend - 10) * 0.4;
  const creditImpulse = Math.round(Math.max(5, Math.min(95, rawCredit)));

  const rawInvest = 72 - (mpr - 15) * 1.5 - (projectedInflation - 20) * 0.8 + (spend - 10) * 0.3;
  const investmentIndex = Math.round(Math.max(5, Math.min(95, rawInvest)));

  const rawPwr = 75 - (projectedInflation - 15) * 1.3 - (fuelPrice - 600) * 0.025;
  const purchasingPower = Math.round(Math.max(10, Math.min(90, rawPwr)));

  const rawDebt = 48 + (mpr - 15) * 1.6 + (spend - 8) * 0.9;
  const debtServiceBurden = Math.round(Math.max(30, Math.min(98, rawDebt)));

  let marginStress = 0;
  if (ind === 'manufacturing') {
    marginStress = 12 - (fxRate - 1200) * 0.02 - (fuelPrice - 700) * 0.015 - (mpr - 18) * 0.8;
  } else if (ind === 'fmcg') {
    marginStress = 14 - (purchasingPower < 50 ? (50 - purchasingPower) * 0.4 : 0) - (fxRate - 1200) * 0.012;
  } else if (ind === 'energy') {
    marginStress = 8 + (fuelPrice - 800) * 0.025 - (fxRate - 1200) * 0.01;
  } else if (ind === 'banking' || ind === 'monetary') {
    marginStress = 10 + (mpr - 18) * 1.1 - (creditImpulse < 40 ? (40 - creditImpulse) * 0.5 : 0);
  } else {
    marginStress = 10 - (mpr - 20) * 0.6 - (projectedInflation - 25) * 0.4;
  }
  marginStress = Math.round(Math.max(-35, Math.min(35, marginStress)) * 10) / 10;

  // 7. Supply Chain & Freight Logistics Stress Index (0-100)
  const rawSupplyChain = 35 + ((fuelPrice - 700) / 700) * 35 + ((fxRate - 1200) / 800) * 30;
  const supplyChainStress = Math.round(Math.max(10, Math.min(98, rawSupplyChain)));

  // 8. NGX Listed Corporate Solvency & Earnings Index (0-100)
  const rawCorpHealth = 85 - (mpr - 15) * 1.5 - ((fxRate - 1200) / 1000) * 25 - (supplyChainStress > 60 ? (supplyChainStress - 60) * 0.4 : 0);
  const corporateHealth = Math.round(Math.max(15, Math.min(95, rawCorpHealth)));

  const fxPressure = (fxRate > 1800 || projectedInflation > 38) ? 'Critical Alert' : ((fxRate > 1550) ? 'Elevated Strain' : 'Managed Corridor');

  const listedRadar = {
    'NESTLE': {
      ticker: 'NESTLE.NG',
      company: 'Nestle Nigeria Plc',
      sector: 'Consumer Goods & FMCG',
      impact: fxRate > 1600 ? 'High FX Finance Cost Strain' : 'Resilient Cash Flow',
      status: fxRate > 1650 ? 'Negative Net Profit Margin' : 'Stabilizing Operating Earnings',
      risk_factor: 'Imported raw material dependency (sorghum & packaging substitution active)',
    },
    'MTNN': {
      ticker: 'MTNN.NG',
      company: 'MTN Nigeria Communications',
      sector: 'Telecommunications & Digital',
      impact: (fuelPrice > 1000 || fxRate > 1600) ? 'Operating Margin Headwind' : 'Expanding Data EBITDA',
      status: fxRate > 1700 ? 'Shareholder Equity Retrenchment' : 'Data Traffic Volume Expansion',
      risk_factor: 'Tower company dollar-indexed lease contracts and cell site diesel generators',
    },
    'DANGCEM': {
      ticker: 'DANGCEM.NG',
      company: 'Dangote Cement Plc',
      sector: 'Industrial Goods',
      impact: fuelPrice > 1000 ? 'Haulage Freight Escalation' : 'High Domestic Pricing Power',
      status: fuelPrice > 1150 ? 'Compressed Inter-state Net Margins' : 'Robust Regional Clinker Export Flows',
      risk_factor: 'Gas pipeline supply pressure to kilns & dual-fuel CNG fleet transition',
    },
    'GTCO': {
      ticker: 'GTCO.NG',
      company: 'Guaranty Trust Holding Co',
      sector: 'Banking & Financial Services',
      impact: mpr > 24 ? 'Net Interest Margin Expansion' : 'Moderate Credit Growth',
      status: 'CBN ₦500B Recapitalization Well Positioned',
      risk_factor: 'Corporate borrower debt servicing defaults and high cash reserve debits (CRR)',
    },
    'SEPLAT': {
      ticker: 'SEPLAT.NG',
      company: 'Seplat Energy Plc',
      sector: 'Oil & Gas Upstream',
      impact: fxRate > 1500 ? 'Hard-Currency Dollar Earning Advantage' : 'Stable Production Free Cash Flow',
      status: 'Mobil Asset Integration Accelerating Production',
      risk_factor: 'Trans-Niger Pipeline security and domestic gas commercial offtake tariffs',
    },
  };

  const results = {
    projected_inflation: projectedInflation,
    credit_impulse: creditImpulse,
    investment_index: investmentIndex,
    purchasing_power: purchasingPower,
    debt_service_burden: debtServiceBurden,
    margin_stress: marginStress,
    supply_chain_stress: supplyChainStress,
    corporate_health: corporateHealth,
    fx_pressure: fxPressure,
    listed_corporate_radar: listedRadar,
  };

  state.lab.results = results;
  return results;
}

function updateLabSlider(key, val) {
  if (!state.lab.params) state.lab.params = {};
  state.lab.params[key] = parseFloat(val);

  // Update value badge in real-time
  const badge = document.getElementById('lab-val-' + key);
  if (badge) badge.textContent = formatLabParamVal(key, val);

  // In-place real-time re-simulation
  const res = runLocalLabSimulation();

  const infColor = res.projected_inflation > 32 ? 'var(--red)' : (res.projected_inflation > 20 ? 'var(--orange)' : 'var(--jade)');
  const creditColor = res.credit_impulse < 35 ? 'var(--red)' : (res.credit_impulse < 60 ? 'var(--orange)' : 'var(--jade)');
  const investColor = res.investment_index < 35 ? 'var(--red)' : (res.investment_index < 60 ? 'var(--orange)' : 'var(--jade)');
  const pwrColor = res.purchasing_power < 35 ? 'var(--red)' : (res.purchasing_power < 55 ? 'var(--orange)' : 'var(--jade)');
  const debtColor = res.debt_service_burden > 70 ? 'var(--red)' : (res.debt_service_burden > 55 ? 'var(--orange)' : 'var(--jade)');
  const marginColor = res.margin_stress < 0 ? 'var(--red)' : (res.margin_stress < 8 ? 'var(--orange)' : 'var(--jade)');

  const gValInf = document.getElementById('gauge-val-inf');
  const gBarInf = document.getElementById('gauge-bar-inf');
  const gSubInf = document.getElementById('gauge-sub-inf');
  if (gValInf) { gValInf.textContent = res.projected_inflation + '%'; gValInf.style.color = infColor; }
  if (gBarInf) { gBarInf.style.width = Math.min(100, (res.projected_inflation / 60) * 100) + '%'; gBarInf.style.background = infColor; }
  if (gSubInf) {
    gSubInf.textContent = res.projected_inflation > 32 ? 'Critical cost-push & currency pass-through pressure' : (res.projected_inflation > 20 ? 'Elevated structural inflation corridor' : 'Contained baseline price dynamics');
  }

  const gValCredit = document.getElementById('gauge-val-credit');
  const gBarCredit = document.getElementById('gauge-bar-credit');
  const gSubCredit = document.getElementById('gauge-sub-credit');
  if (gValCredit) { gValCredit.textContent = res.credit_impulse + ' / 100'; gValCredit.style.color = creditColor; }
  if (gBarCredit) { gBarCredit.style.width = res.credit_impulse + '%'; gBarCredit.style.background = creditColor; }
  if (gSubCredit) {
    gSubCredit.textContent = res.credit_impulse < 40 ? 'Severe liquidity sterilization; commercial banks rationing credit' : 'Moderate loanable funds available to private enterprise';
  }

  const gValInvest = document.getElementById('gauge-val-invest');
  const gBarInvest = document.getElementById('gauge-bar-invest');
  const gSubInvest = document.getElementById('gauge-sub-invest');
  if (gValInvest) { gValInvest.textContent = res.investment_index + ' / 100'; gValInvest.style.color = investColor; }
  if (gBarInvest) { gBarInvest.style.width = res.investment_index + '%'; gBarInvest.style.background = investColor; }
  if (gSubInvest) {
    gSubInvest.textContent = res.investment_index < 40 ? 'Corporate capital investments paused; balance sheet defensive mode' : 'Supportive climate for multi-year expansion investments';
  }

  const gValPwr = document.getElementById('gauge-val-pwr');
  const gBarPwr = document.getElementById('gauge-bar-pwr');
  const gSubPwr = document.getElementById('gauge-sub-pwr');
  if (gValPwr) { gValPwr.textContent = res.purchasing_power + ' / 100'; gValPwr.style.color = pwrColor; }
  if (gBarPwr) { gBarPwr.style.width = res.purchasing_power + '%'; gBarPwr.style.background = pwrColor; }
  if (gSubPwr) {
    gSubPwr.textContent = res.purchasing_power < 40 ? 'Acute disposable income squeeze; volume drop across consumer staples' : 'Resilient household demand absorbing modest price increases';
  }

  const gValDebt = document.getElementById('gauge-val-debt');
  const gBarDebt = document.getElementById('gauge-bar-debt');
  const gSubDebt = document.getElementById('gauge-sub-debt');
  if (gValDebt) { gValDebt.textContent = res.debt_service_burden + '%'; gValDebt.style.color = debtColor; }
  if (gBarDebt) { gBarDebt.style.width = Math.min(100, (res.debt_service_burden / 100) * 100) + '%'; gBarDebt.style.background = debtColor; }
  if (gSubDebt) {
    gSubDebt.textContent = res.debt_service_burden > 70 ? 'High crowding-out risk; domestic yields locked into sovereign paper' : 'Sustainable debt sustainability corridor';
  }

  const gValMargin = document.getElementById('gauge-val-margin');
  const gBarMargin = document.getElementById('gauge-bar-margin');
  const gSubMargin = document.getElementById('gauge-sub-margin');
  if (gValMargin) { gValMargin.textContent = (res.margin_stress > 0 ? '+' : '') + res.margin_stress + '%'; gValMargin.style.color = marginColor; }
  if (gBarMargin) { gBarMargin.style.width = Math.max(10, Math.min(100, 50 + res.margin_stress * 2)) + '%'; gBarMargin.style.background = marginColor; }
  if (gSubMargin) {
    gSubMargin.textContent = res.margin_stress < 0 ? 'Severe unit margin contraction under import FX & power cost shocks' : 'Stable or expanding sectoral gross margins';
  }

  const gValFxp = document.getElementById('gauge-val-fxp');
  if (gValFxp) {
    gValFxp.textContent = res.fx_pressure;
    gValFxp.className = `badge ${res.fx_pressure === 'Critical Alert' ? 'badge-sandbox' : 'badge-enabled'}`;
    gValFxp.style.background = res.fx_pressure === 'Critical Alert' ? '#f87171' : '';
    gValFxp.style.color = res.fx_pressure === 'Critical Alert' ? '#fff' : '';
  }

  // Live updates for Supply Chain & Listed Corporate Health
  const supplyColor = (res.supply_chain_stress || 65) > 70 ? 'var(--red)' : ((res.supply_chain_stress || 65) > 50 ? 'var(--orange)' : 'var(--jade)');
  const gValSupply = document.getElementById('gauge-val-supply');
  const gBarSupply = document.getElementById('gauge-bar-supply');
  const gSubSupply = document.getElementById('gauge-sub-supply');
  if (gValSupply) { gValSupply.textContent = (res.supply_chain_stress || 65) + ' / 100'; gValSupply.style.color = supplyColor; }
  if (gBarSupply) { gBarSupply.style.width = (res.supply_chain_stress || 65) + '%'; gBarSupply.style.background = supplyColor; }
  if (gSubSupply) {
    gSubSupply.textContent = (res.supply_chain_stress || 65) > 70 ? 'Port congestion, demurrage fees, and diesel haulage costs severely squeezing inventory velocity' : 'Manageable transport corridors and warehouse turnover';
  }

  const corpColor = (res.corporate_health || 55) < 45 ? 'var(--red)' : ((res.corporate_health || 55) < 65 ? 'var(--orange)' : 'var(--jade)');
  const gValCorp = document.getElementById('gauge-val-corp');
  const gBarCorp = document.getElementById('gauge-bar-corp');
  const gSubCorp = document.getElementById('gauge-sub-corp');
  if (gValCorp) { gValCorp.textContent = (res.corporate_health || 55) + ' / 100'; gValCorp.style.color = corpColor; }
  if (gBarCorp) { gBarCorp.style.width = (res.corporate_health || 55) + '%'; gBarCorp.style.background = corpColor; }
  if (gSubCorp) {
    gSubCorp.textContent = (res.corporate_health || 55) < 45 ? 'Elevated unhedged FX balance sheet losses and 30%+ commercial loan servicing strains' : 'Stable debt service coverage ratios and pricing power across listed public firms';
  }

  const radarEl = document.getElementById('lab-corporate-radar-container');
  if (radarEl && res.listed_corporate_radar) {
    radarEl.innerHTML = renderCorporateRadarList(res.listed_corporate_radar);
  }
}

function renderCorporateRadarList(radar) {
  if (!radar) return '<div class="muted" style="font-size: 12px; padding: 12px;">Calibrate levers to evaluate public corporate sensitivity.</div>';
  const entries = Object.values(radar);
  return entries.map(c => `
    <div style="background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-wrap: wrap; gap: 4px;">
        <div>
          <b style="font-size: 13.5px; color: var(--text);">${c.company}</b>
          <span class="market-tag" style="margin-left: 6px; font-size: 10.5px; font-weight: 700;">${c.ticker}</span>
        </div>
        <span class="badge" style="font-size: 11px; background: rgba(36,121,101,0.08); color: var(--jade); font-weight: 700;">${c.sector}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 12px; margin: 6px 0;">
        <span style="color: var(--muted);">Sensitivity Stance:</span>
        <b style="color: var(--text);">${c.impact}</b>
      </div>
      ${c.status ? `
      <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px;">
        <span style="color: var(--muted);">Operational Catalyst:</span>
        <b style="color: var(--navy); font-size: 11.5px;">${c.status}</b>
      </div>` : ''}
      <div style="font-size: 11.5px; color: var(--muted); line-height: 1.45; border-top: 1px dashed var(--line); padding-top: 6px; margin-top: 6px;">
        <b style="color: var(--navy);">Supply Chain / Power / Capital Factor:</b> ${c.risk_factor || c.risk || ''}
      </div>
    </div>
  `).join('');
}

function toggleLabPrimer(key) {
  if (!state.lab.openPrimers) state.lab.openPrimers = {};
  state.lab.openPrimers[key] = !state.lab.openPrimers[key];
  const el = document.getElementById('lab-primer-' + key);
  if (el) {
    el.style.display = state.lab.openPrimers[key] ? 'block' : 'none';
  }
}

function resetLabParameters() {
  const s = state.lab.selectedScenario;
  if (s && s.default_params) {
    state.lab.params = { ...s.default_params };
  } else {
    state.lab.params = {
      mpr: 27.25,
      inflation: 32.5,
      fx_rate: 1650,
      fuel_price: 1050,
      crr: 45.0,
      spend_impulse: 14.0,
    };
  }
  runLocalLabSimulation();
  navigate('lab');
}

function selectLabIndustry(slug) {
  state.lab.selectedIndustry = slug;
  state.lab.selectedScenarioId = null;
  state.lab.selectedScenario = null;
  state.lab.aiBriefing = null;
  loadScenarioLabData(slug, true);
}

function selectLabScenario(id) {
  const s = (state.lab.scenarios || []).find(item => item.id === id);
  if (!s) return;
  state.lab.selectedScenarioId = id;
  state.lab.selectedScenario = s;
  state.lab.aiBriefing = null;
  if (s.default_params) {
    state.lab.params = { ...s.default_params };
  }
  runLocalLabSimulation();
  navigate('lab');
}

async function loadScenarioLabData(industrySlug = 'monetary', force = false) {
  if (state.lab.isLoadingMeta) return;
  if (!force && state.lab.loadedIndustry === industrySlug && state.lab.industries && state.lab.industries.length > 0) {
    return;
  }

  state.lab.isLoadingMeta = true;
  try {
    const res = await api.get(`/lab/meta?industry=${encodeURIComponent(industrySlug)}`);
    if (res && res.data) {
      state.lab.industries = res.data.industries || [];
      state.lab.scenarios = res.data.scenarios || [];
      state.lab.definitions = res.data.definitions || {};
      state.lab.selectedIndustry = industrySlug;
      state.lab.loadedIndustry = industrySlug;

      const cur = state.lab.scenarios.find(s => s.id === state.lab.selectedScenarioId);
      if (!cur && state.lab.scenarios.length > 0) {
        state.lab.selectedScenarioId = state.lab.scenarios[0].id;
        state.lab.selectedScenario = state.lab.scenarios[0];
        if (state.lab.scenarios[0].default_params) {
          state.lab.params = { ...state.lab.scenarios[0].default_params };
        }
      } else if (cur) {
        state.lab.selectedScenario = cur;
      }

      runLocalLabSimulation();

      if (state.page === 'lab') {
        const root = document.getElementById('app-root');
        if (root) {
          const content = renderScenarioLab();
          root.innerHTML = renderAppShell(content);
          attachViewEvents();
        }
      }
    }
  } catch (err) {
    console.error('Failed to load Scenario Lab meta:', err);
  } finally {
    state.lab.isLoadingMeta = false;
  }
}

async function handleGenerateAiScenario(e) {
  e.preventDefault();
  const promptEl = document.getElementById('lab-ai-prompt');
  if (!promptEl || !promptEl.value.trim()) return;

  const promptText = promptEl.value.trim();
  state.lab.isAiGenLoading = true;
  const btn = document.getElementById('btn-gen-ai-scenario');
  if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }

  try {
    const res = await api.post('/lab/generate', {
      industry: state.lab.selectedIndustry || 'monetary',
      prompt: promptText,
    });

    if (res && res.data) {
      const newScenario = res.data;
      if (!state.lab.scenarios) state.lab.scenarios = [];
      state.lab.scenarios.unshift(newScenario);
      state.lab.selectedScenarioId = newScenario.id;
      state.lab.selectedScenario = newScenario;
      if (newScenario.default_params) {
        state.lab.params = { ...newScenario.default_params };
      }
      state.lab.aiBriefing = null;
      runLocalLabSimulation();
      api.toast('Custom AI Scenario generated successfully!', 'success');
      navigate('lab');
    }
  } catch (err) {
    api.toast('Failed to generate scenario: ' + (err.message || 'Error occurred'), 'error');
  } finally {
    state.lab.isAiGenLoading = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Synthesize AI'; }
  }
}

async function handleRunAiBriefing() {
  state.lab.isBriefingLoading = true;
  const panel = document.getElementById('lab-briefing-panel');
  const btn = document.getElementById('btn-run-briefing');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width: 14px; height: 14px; border-width: 2px; display: inline-block; margin-right: 8px;"></span> Synthesizing Executive Briefing...';
  }

  try {
    const res = await api.post('/lab/briefing', {
      industry: state.lab.selectedIndustry || 'monetary',
      scenario_title: state.lab.selectedScenario?.title || 'Macro Stress Test',
      parameters: state.lab.params,
      results: state.lab.results || runLocalLabSimulation(),
    });

    if (res && res.data) {
      state.lab.aiBriefing = res.data.briefing_text || res.data.briefing;
      state.lab.briefingModel = 'Executive Strategy Intelligence';
      if (panel) {
        panel.innerHTML = renderLabBriefingOutput();
      }
      api.toast('Executive Masterclass Briefing synthesized.', 'success');
    }
  } catch (err) {
    api.toast('Failed to synthesize briefing: ' + (err.message || 'API error'), 'error');
  } finally {
    state.lab.isBriefingLoading = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Generate Executive Masterclass Briefing ⚡';
    }
  }
}

// Backwards-compatibility aliases
function updateLabParam(key, val) {
  updateLabSlider(key, val);
}

function resetLab() {
  resetLabParameters();
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
  const norm = (m || 'demo').toLowerCase();
  if (norm === 'real' && !state.features?.real_mode) {
    api.toast('Real Money Mode is currently disabled by administrator. Platform remains in Simulation Mode.', 'warning');
    return;
  }
  state.mode = norm;
  localStorage.setItem('econsim-mode', norm);
  api.patch('/profile', { preferred_mode: norm }).catch(() => {});
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

