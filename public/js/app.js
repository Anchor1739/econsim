// EconSim Main Application Controller
function getStoredNotifications() {
  const now = Date.now();
  try {
    const raw = localStorage.getItem('econsim-notifications');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((n, i) => {
          if (!n.timestamp) {
            n.timestamp = now - (i + 1) * 8 * 60 * 1000;
          }
          return n;
        });
      }
    }
  } catch (e) {}

  return [
    {
      id: 'notif_init_1',
      title: 'Executive Boardroom Dilemma Active',
      message: 'The Runway Crisis challenge is available. Step into the arena and formulate your capital strategy.',
      target_page: 'boardroom',
      target_id: 'ch_1',
      category: 'boardroom',
      timestamp: now - 3 * 60 * 1000,
      read: false,
    },
    {
      id: 'notif_init_2',
      title: 'Macroeconomic Catalyst Contract Open',
      message: 'CBN MPR Interest Rate Communique contract is live. Evaluate consensus odds and forecast.',
      target_page: 'predictor',
      target_id: 'mkt_1',
      category: 'market',
      timestamp: now - 18 * 60 * 1000,
      read: false,
    },
    {
      id: 'notif_init_3',
      title: 'Virtual Demonstration Capital Credited',
      message: '₦500,000 educational virtual capital is active on your double-entry ledger.',
      target_page: 'wallet',
      target_id: null,
      category: 'wallet',
      timestamp: now - 50 * 60 * 1000,
      read: true,
    },
  ];
}

function formatNotifTime(timestamp) {
  if (!timestamp) return 'Just now';
  const now = Date.now();
  const diffMs = now - Number(timestamp);
  if (isNaN(diffMs) || diffMs < 0) return 'Just now';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;

  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  const d = parseUtcDate(timestamp);
  return d ? d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) : '–';
}

function parseUtcDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return dateStr;
  let s = String(dateStr).trim();
  if (!s.endsWith('Z') && !s.includes('+') && !s.includes('T')) {
    s = s.replace(' ', 'T') + 'Z';
  } else if (!s.endsWith('Z') && !s.includes('+') && s.includes('T')) {
    s = s + 'Z';
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date(dateStr) : d;
}

function getUserTimezoneLabel() {
  try {
    const shortTz = new Date().toLocaleTimeString('en-us', { timeZoneName: 'short' }).split(' ')[2] || '';
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (shortTz && tz) {
      return `${shortTz} · ${tz.replace('_', ' ')}`;
    }
    return shortTz || (tz ? tz.replace('_', ' ') : 'Local Time');
  } catch(e) {
    return 'Local Time';
  }
}

function formatLocalTime(isoOrDateStr, options = { hour: '2-digit', minute: '2-digit' }) {
  const d = parseUtcDate(isoOrDateStr);
  if (!d || isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], options);
}

function formatNotifExactTime(timestamp) {
  if (!timestamp) return '';
  try {
    const d = parseUtcDate(timestamp);
    return d ? d.toLocaleString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short'
    }) : '';
  } catch (e) {
    return '';
  }
}

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
  leaderboardTab: 'All',
  notifications: getStoredNotifications(),
  isNotifOpen: false,
  seenTours: {},
  lab: {
    selectedIndustry: 'monetary',
    industries: [],
    scenarios: [],
    selectedScenarioId: null,
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
    isAiBoxOpen: false,
    radarFilterQuery: '',
  },
  radar: {
    companies: [],
    selectedSector: 'all',
    searchQuery: '',
    macroBaseline: null,
    isLoading: false,
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
    document.documentElement.classList.add('theme-dark');
  } else {
    document.body.classList.remove('theme-dark');
    document.documentElement.classList.remove('theme-dark');
  }
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', t === 'dark' ? '#09121f' : '#f5f7fa');
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


// ==========================================
// PWA Installation & Device Detection Engine
// ==========================================
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  window.deferredInstallPrompt = e;
  updatePwaInstallButtons();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  window.deferredInstallPrompt = null;
  if (typeof api !== 'undefined' && api.toast) {
    api.toast('EconSim App installed successfully! Launch it anytime from your home screen.', 'success');
  }
  updatePwaInstallButtons();
});

function detectUserDevice() {
  const ua = navigator.userAgent || navigator.vendor || window.opera || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || /Mobi|Tablet/i.test(ua);
  const isMac = /Macintosh|Mac OS X/i.test(ua) && !isIOS;
  const isWindows = /Windows/i.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  let os = 'desktop';
  if (isIOS) os = 'ios';
  else if (isAndroid) os = 'android';

  return {
    os,
    isIOS,
    isAndroid,
    isMobile,
    isDesktop: !isMobile,
    isMac,
    isWindows,
    isStandalone
  };
}

function updatePwaInstallButtons() {
  const dev = detectUserDevice();
  const installBtns = document.querySelectorAll('.pwa-install-trigger');
  installBtns.forEach(btn => {
    if (dev.isStandalone) {
      btn.style.display = 'none';
    } else {
      btn.style.display = 'inline-flex';
    }
  });
}

function triggerPwaInstall() {
  const dev = detectUserDevice();
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        if (typeof api !== 'undefined' && api.toast) api.toast('Installing EconSim Institutional App...', 'success');
      }
      deferredInstallPrompt = null;
    });
    return;
  }
  openPwaInstallModal(dev.os);
}

function openPwaInstallModal(defaultTab = null) {
  const dev = detectUserDevice();
  const activeTab = defaultTab || dev.os;
  
  let existing = document.getElementById('pwa-install-modal');
  if (existing) existing.remove();

  const modalHtml = `
    <div id="pwa-install-modal" onclick="if(event.target === this) closePwaInstallModal()" style="position: fixed; inset: 0; background: rgba(5, 8, 15, 0.88); backdrop-filter: blur(8px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 16px;">
      <div style="background: var(--card-bg, #0f1e33); border: 1px solid var(--line, #1c314f); border-radius: 16px; max-width: 520px; width: 100%; max-height: calc(100vh - 32px); display: flex; flex-direction: column; box-shadow: 0 24px 48px rgba(0,0,0,0.6); overflow: hidden; animation: fadeIn 0.2s ease;">
        <div style="padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 38px; height: 38px; border-radius: 8px; background: linear-gradient(135deg, var(--jade), #10b981); display: flex; align-items: center; justify-content: center; font-size: 20px;">📲</div>
            <div>
              <h3 style="font-size: 16px; font-weight: 800; color: var(--text); margin: 0;">Install EconSim App</h3>
              <p style="font-size: 12px; color: var(--muted); margin: 2px 0 0;">Native performance · Zero app store download</p>
            </div>
          </div>
          <button type="button" class="btn-link" onclick="closePwaInstallModal()" style="font-size: 20px; color: var(--muted); cursor: pointer; padding: 4px;">✕</button>
        </div>

        <!-- OS Selector Tabs -->
        <div style="display: flex; border-bottom: 1px solid var(--border); background: rgba(0,0,0,0.15);">
          <button type="button" id="tab-btn-android" onclick="switchPwaTab('android')" style="flex: 1; padding: 12px 8px; font-size: 13px; font-weight: 600; border: none; background: ${activeTab === 'android' ? 'var(--surface)' : 'transparent'}; color: ${activeTab === 'android' ? 'var(--jade)' : 'var(--muted)'}; border-bottom: 2px solid ${activeTab === 'android' ? 'var(--jade)' : 'transparent'}; cursor: pointer;">
            🤖 Android
          </button>
          <button type="button" id="tab-btn-ios" onclick="switchPwaTab('ios')" style="flex: 1; padding: 12px 8px; font-size: 13px; font-weight: 600; border: none; background: ${activeTab === 'ios' ? 'var(--surface)' : 'transparent'}; color: ${activeTab === 'ios' ? 'var(--jade)' : 'var(--muted)'}; border-bottom: 2px solid ${activeTab === 'ios' ? 'var(--jade)' : 'transparent'}; cursor: pointer;">
            🍎 iPhone / iPad
          </button>
          <button type="button" id="tab-btn-desktop" onclick="switchPwaTab('desktop')" style="flex: 1; padding: 12px 8px; font-size: 13px; font-weight: 600; border: none; background: ${activeTab === 'desktop' ? 'var(--surface)' : 'transparent'}; color: ${activeTab === 'desktop' ? 'var(--jade)' : 'var(--muted)'}; border-bottom: 2px solid ${activeTab === 'desktop' ? 'var(--jade)' : 'transparent'}; cursor: pointer;">
            💻 PC / Mac
          </button>
        </div>

        <!-- Tab Contents -->
        <div style="padding: 24px; overflow-y: auto; flex: 1; -webkit-overflow-scrolling: touch;">
          <!-- Android Tab -->
          <div id="pwa-content-android" style="display: ${activeTab === 'android' ? 'block' : 'none'};">
            ${deferredInstallPrompt ? `
              <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 10px; padding: 16px; text-align: center; margin-bottom: 18px;">
                <p style="font-size: 13px; color: var(--text); margin-bottom: 12px;">One-tap installation is ready for your Android device:</p>
                <button type="button" class="btn btn-primary btn-full" onclick="triggerNativePwaPrompt()" style="padding: 12px; font-weight: 700; font-size: 14px;">
                  📲 Tap to Install EconSim App Now
                </button>
              </div>
            ` : ''}
            <div style="font-size: 13px; line-height: 1.7; color: var(--text);">
              <b style="color: var(--jade); display: block; margin-bottom: 8px;">How to install on Android Chrome / Samsung Internet:</b>
              <ol style="margin-left: 20px; display: flex; flex-direction: column; gap: 8px;">
                <li>Tap the <b>three dots menu (⋮)</b> in the top right corner of Chrome.</li>
                <li>Tap <b>"Install app"</b> or <b>"Add to Home screen"</b>.</li>
                <li>Tap <b>"Install"</b> on the confirmation popup.</li>
                <li>EconSim will appear on your phone home screen like a native app with push notifications!</li>
              </ol>
            </div>
          </div>

          <!-- iOS Tab -->
          <div id="pwa-content-ios" style="display: ${activeTab === 'ios' ? 'block' : 'none'};">
            <div style="font-size: 13px; line-height: 1.7; color: var(--text);">
              <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; font-size: 12.5px;">
                Apple requires Safari to install Web Apps on iPhone and iPad.
              </div>
              <b style="color: var(--jade); display: block; margin-bottom: 8px;">Follow these 3 quick steps in Safari:</b>
              <ol style="margin-left: 20px; display: flex; flex-direction: column; gap: 10px;">
                <li>Tap the <b>Share button</b> <span style="display: inline-block; padding: 2px 6px; background: rgba(255,255,255,0.1); border-radius: 4px; font-size: 13px;">⎋</span> at the bottom of Safari.</li>
                <li>Scroll down and tap <b>"Add to Home Screen"</b> <span style="display: inline-block; padding: 2px 6px; background: rgba(255,255,255,0.1); border-radius: 4px; font-size: 13px;">⊞</span>.</li>
                <li>Tap <b>"Add"</b> in the top right corner.</li>
              </ol>
              <p style="margin-top: 14px; font-size: 12px; color: var(--muted);">Done! EconSim will now run fullscreen with native speed on your iPhone.</p>
            </div>
          </div>

          <!-- Desktop Tab -->
          <div id="pwa-content-desktop" style="display: ${activeTab === 'desktop' ? 'block' : 'none'};">
            <div style="font-size: 13px; line-height: 1.7; color: var(--text);">
              <b style="color: var(--jade); display: block; margin-bottom: 8px;">How to install on Chrome, Edge, or Brave:</b>
              <ol style="margin-left: 20px; display: flex; flex-direction: column; gap: 8px;">
                <li>Look at the right side of the address bar at the top of your browser.</li>
                <li>Click the <b>Install App icon</b> <span style="display: inline-block; padding: 2px 6px; background: rgba(255,255,255,0.1); border-radius: 4px; font-size: 13px;">⤓</span> (or computer monitor icon).</li>
                <li>Click <b>"Install"</b> to run EconSim as a dedicated desktop workstation window.</li>
              </ol>
              <div style="margin-top: 12px; font-size: 12px; color: var(--muted);">Alternatively, click browser <b>Menu (⋮)</b> &rarr; <b>"Save and share"</b> &rarr; <b>"Install EconSim..."</b>.</div>
            </div>
          </div>
        </div>

        <div style="padding: 16px 24px; background: rgba(0,0,0,0.2); border-top: 1px solid var(--border); display: flex; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" onclick="closePwaInstallModal()">Close</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function switchPwaTab(tabName) {
  ['android', 'ios', 'desktop'].forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const content = document.getElementById(`pwa-content-${t}`);
    if (btn) {
      const active = t === tabName;
      btn.style.background = active ? 'var(--surface)' : 'transparent';
      btn.style.color = active ? 'var(--jade)' : 'var(--muted)';
      btn.style.borderBottom = `2px solid ${active ? 'var(--jade)' : 'transparent'}`;
    }
    if (content) {
      content.style.display = t === tabName ? 'block' : 'none';
    }
  });
}

function triggerNativePwaPrompt() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(() => {
      deferredInstallPrompt = null;
      closePwaInstallModal();
    });
  }
}

function closePwaInstallModal() {
  const el = document.getElementById('pwa-install-modal');
  if (el) el.remove();
}

async function initApp() {
  applyTheme(state.theme);
  updatePwaInstallButtons();

  // Register service worker for background sync and real-time push notifications
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

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

      // Synchronize database seen_tours and local storage cache
      state.seenTours = {};
      if (res.data.seen_tours && typeof res.data.seen_tours === 'object') {
        Object.assign(state.seenTours, res.data.seen_tours);
      }
      // Merge any existing local storage flags into state & sync back
      ['dashboard', 'scenario_lab', 'lab', 'predictor', 'boardroom', 'wallet', 'leaderboard', 'mentor', 'profile'].forEach(pg => {
        if (localStorage.getItem('econsim-tour-seen-' + pg)) {
          state.seenTours[pg] = true;
        }
        if (state.seenTours[pg]) {
          localStorage.setItem('econsim-tour-seen-' + pg, 'true');
        }
      });

      syncServerNotifications();
      if (!window.serverNotifInterval) {
        window.serverNotifInterval = setInterval(() => {
          if (!document.hidden) syncServerNotifications();
        }, 15000);
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden && state.user) syncServerNotifications();
        });
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
  // Guard Scenario Lab when disabled by admin
  if (page === 'lab' && !state.features?.scenario_lab) {
    api.toast('Scenario Lab is temporarily offline for maintenance.', 'info');
    if (state.page !== 'dashboard') {
      navigate('dashboard');
    }
    return;
  }

  // ── Clean up boardroom copy/contextmenu/screenshot guards on navigation ──────
  if (window._boardroomGuards && window._boardroomGuards.length) {
    window._boardroomGuards.forEach(g => {
      if (g.copy) document.removeEventListener('copy', g.copy);
      if (g.cut) document.removeEventListener('cut', g.cut);
      if (g.blur) window.removeEventListener('blur', g.blur);
      if (g.focus) window.removeEventListener('focus', g.focus);
      if (g.visibility) document.removeEventListener('visibilitychange', g.visibility);
      if (g.keydown) window.removeEventListener('keydown', g.keydown, true);
      if (g.keyup) window.removeEventListener('keyup', g.keyup, true);
    });
    window._boardroomGuards = [];
    document.body.classList.remove('boardroom-active', 'app-blurred');
    // Restore right-click context menu when leaving boardroom
    if (window._boardroomContextGuard) {
      document.removeEventListener('contextmenu', window._boardroomContextGuard);
      window._boardroomContextGuard = null;
    }
  }

  if (window.VoiceEngine && window.VoiceEngine.isRecording) {
    window.VoiceEngine.stop();
  }

  if (window.waitingCountdownInterval) clearInterval(window.waitingCountdownInterval);
  if (window.waitingRoomPollInterval) clearInterval(window.waitingRoomPollInterval);
  if (window.liveDeadlineInterval) clearInterval(window.liveDeadlineInterval);
  if (window.oppWaitingInterval) clearInterval(window.oppWaitingInterval);
  if (window.oppReportPoll) clearInterval(window.oppReportPoll);
  if (window.liveMatchHeartbeat) clearInterval(window.liveMatchHeartbeat);
  if (window._waitingWakeHandler) {
    document.removeEventListener('visibilitychange', window._waitingWakeHandler);
    window.removeEventListener('focus', window._waitingWakeHandler);
    window._waitingWakeHandler = null;
  }
  if (window._liveWakeHandler) {
    document.removeEventListener('visibilitychange', window._liveWakeHandler);
    window.removeEventListener('focus', window._liveWakeHandler);
    window._liveWakeHandler = null;
  }
  if (window._oppWakeHandler) {
    document.removeEventListener('visibilitychange', window._oppWakeHandler);
    window.removeEventListener('focus', window._oppWakeHandler);
    window._oppWakeHandler = null;
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
  checkAutoTourForPage(page);
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

async function syncServerNotifications() {
  if (!state.user || document.hidden) return;
  try {
    const res = await api.get('/notifications');
    if (res?.data?.notifications) {
      const serverNotifs = res.data.notifications;
      const localNotifs = state.notifications || [];
      const localIds = new Set(localNotifs.map(n => n.id));

      let hasNew = false;
      for (const s of serverNotifs) {
        if (!localIds.has(s.id)) {
          hasNew = true;
          localNotifs.unshift({
            id: s.id,
            title: s.title,
            message: s.message,
            target_page: s.target_page,
            target_id: s.target_id,
            category: s.category,
            read: Boolean(s.is_read),
            created_at: s.created_at,
          });

          // Proactive native Web Push pop-up
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification(s.title, {
                body: s.message,
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                data: { target_page: s.target_page, target_id: s.target_id }
              });
            } catch (err) {}
          }
        }
      }

      if (hasNew) {
        state.notifications = localNotifs.slice(0, 50);
        saveNotificationsToStorage();
        updateNotifBadges();
      }
    }
  } catch (err) {}
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
  api.post('/notifications/read', {}).catch(() => {});
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
  api.post('/notifications/read', { notification_id: notifId }).catch(() => {});

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
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      } catch (e) {
        try {
          await navigator.serviceWorker.register('/sw.js');
        } catch (_) {}
      }
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      api.toast('Push alerts enabled! You will receive live native notifications.', 'success');
      localStorage.setItem('econsim-push-enabled', 'true');
      
      const banner = document.getElementById('push-prompt-banner');
      if (banner) banner.remove();

      // Retrieve and register Firebase Cloud Messaging token
      if (typeof window.requestFcmToken === 'function') {
        window.requestFcmToken().catch(() => {});
      }

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

function renderPushPromptBanner() {
  if (typeof Notification === 'undefined') return '';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') return '';
  if (sessionStorage.getItem('econsim-push-dismissed')) return '';

  return `
    <div class="push-prompt-banner" id="push-prompt-banner">
      <div class="push-prompt-text">
        <b style="color: var(--navy); display: flex; align-items: center; gap: 6px;">
          <span>🔔</span> Enable Real-Time Browser Push Alerts
        </b>
        <span style="font-size: 12px; color: var(--muted); display: block; margin-top: 2px;">
          Get instant notifications when live Boardroom match dilemmas unlock and Predictor contracts settle.
        </span>
      </div>
      <div class="push-prompt-actions">
        <button class="btn btn-primary btn-sm" onclick="handleEnablePushBanner()">Enable Push Alerts 🔔</button>
        <button class="btn btn-secondary btn-sm" onclick="dismissPushBanner()">Later ✕</button>
      </div>
    </div>
  `;
}

async function handleEnablePushBanner() {
  await requestPushPermission();
  const banner = document.getElementById('push-prompt-banner');
  if (banner) banner.remove();
}

function dismissPushBanner() {
  sessionStorage.setItem('econsim-push-dismissed', 'true');
  const banner = document.getElementById('push-prompt-banner');
  if (banner) banner.remove();
}

function sendSystemNotification(title, message, target_page = 'dashboard', target_id = null, category = 'boardroom') {
  const timestamp = Date.now();
  const newNotif = {
    id: 'notif_' + timestamp + '_' + Math.random().toString(36).substring(2, 6),
    title,
    message,
    target_page,
    target_id,
    category,
    timestamp,
    read: false,
  };

  if (!state.notifications) state.notifications = [];
  state.notifications.unshift(newNotif);
  if (state.notifications.length > 50) {
    state.notifications = state.notifications.slice(0, 50);
  }
  saveNotificationsToStorage();
  updateNotifBadges();

  // In-App Toast
  api.toast(`🔔 ${title}: ${message}`, 'info');

  // Native Web Push Notification (via Service Worker or Native Notification API)
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notifUrl = target_page === 'boardroom' && target_id 
        ? `/?page=live_challenge&challengeId=${target_id}` 
        : `/?page=${target_page}`;

      const iconSvg = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23059669"/><text y=".75em" x="20" font-size="70" fill="white">↗</text></svg>';

      let displayed = false;
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body: message,
            icon: iconSvg,
            badge: iconSvg,
            tag: 'econsim-' + Date.now(),
            renotify: true,
            vibrate: [150, 75, 150],
            data: { url: notifUrl }
          }).then(() => {
            displayed = true;
          }).catch(() => {
            if (!displayed) showNativeNotificationFallback(title, message, notifUrl, newNotif.id);
          });
        }).catch(() => {
          if (!displayed) showNativeNotificationFallback(title, message, notifUrl, newNotif.id);
        });
      } else {
        showNativeNotificationFallback(title, message, notifUrl, newNotif.id);
      }
    } catch (e) {
      console.warn('Native push error:', e);
      showNativeNotificationFallback(title, message, '/', newNotif.id);
    }
  }
}
window.sendSystemNotification = sendSystemNotification;

function showNativeNotificationFallback(title, message, url, notifId) {
  try {
    const iconSvg = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%23059669"/><text y=".75em" x="20" font-size="70" fill="white">↗</text></svg>';
    const n = new Notification(title, {
      body: message,
      icon: iconSvg
    });
    n.onclick = () => {
      window.focus();
      handleNotificationClick(notifId);
    };
  } catch (err) {}
}

// -------------------------------------------------------------
// Plain-English Economic Term Explanations & Glossary (?)
// -------------------------------------------------------------
const ECONOMIC_TERM_GLOSSARY = {
  credit_impulse: {
    title: 'Credit Impulse Index',
    short: 'How easily commercial banks are lending new money to real businesses.',
    definition: 'Credit Impulse measures the acceleration of new bank lending to the private sector. It is the lifeblood of economic growth in emerging markets.',
    businessMeaning: 'When Credit Impulse is low (< 40), commercial banks are hoarding liquidity in safe Central Bank treasury bills rather than lending to businesses. As a CEO or business owner, this means higher overdraft rates, strict collateral demands, and severe cash flow crunches.',
    scale: [
      { range: '0 - 35', label: 'Severe Credit Freeze', desc: 'Banks rationing loans; working capital dried up.' },
      { range: '36 - 60', label: 'Restricted Lending', desc: 'Selective lending; only blue-chips with prime collateral get loans.' },
      { range: '61 - 100', label: 'Expansionary Credit Flow', desc: 'Loanable funds widely available for CapEx and business expansion.' }
    ]
  },
  projected_inflation: {
    title: 'Projected 12M Inflation Trajectory',
    short: 'The expected annual rise in everyday prices over the next 12 months.',
    definition: 'The annual percentage change in the Consumer Price Index (CPI), projecting how fast the purchasing value of the local currency is eroding under current currency and fuel prices.',
    businessMeaning: 'High inflation squeezes consumer disposable income and rapidly increases factory replacement costs. If inflation is above 30%, product price increases must be frequent or operating margins will collapse.',
    scale: [
      { range: '0% - 15%', label: 'Single-Digit Stability', desc: 'Predictable pricing and healthy consumer savings.' },
      { range: '16% - 30%', label: 'Structural Inflation', desc: 'Cost-push pressures active; wage demands rising.' },
      { range: '31%+', label: 'Critical Inflationary Shock', desc: 'Severe purchasing power erosion; inventory replacement challenges.' }
    ]
  },
  investment_index: {
    title: 'Private Investment & CapEx Sentiment',
    short: 'Whether companies are willing to build new factories, hire, and invest for the future.',
    definition: 'An aggregate confidence indicator tracking corporate willingness to commit multi-year capital expenditure (CapEx) under current interest rates and economic uncertainty.',
    businessMeaning: 'When interest rates are high (e.g. MPR > 25%), borrowing to build factories or buy machinery becomes economically unviable because financing costs exceed return on invested capital.',
    scale: [
      { range: '0 - 35', label: 'CapEx Freeze', desc: 'Companies pause capital projects and hold defensive cash.' },
      { range: '36 - 60', label: 'Cautious Maintenance', desc: 'Companies only fund essential repairs, avoiding greenfield expansion.' },
      { range: '61 - 100', label: 'Aggressive Capital Expansion', desc: 'High business confidence and cheap long-term financing.' }
    ]
  },
  purchasing_power: {
    title: 'Consumer Purchasing Power Index',
    short: 'How much food, transport, and goods an average worker\'s salary can actually buy.',
    definition: 'The real purchasing capacity of household disposable income after factoring in food inflation, fuel price hikes, and transportation costs.',
    businessMeaning: 'When purchasing power falls below 40, households cut discretionary spending and trade down to cheaper generic alternatives. FMCG and retail companies experience volume drops.',
    scale: [
      { range: '0 - 35', label: 'Acute Income Squeeze', desc: 'Consumers prioritize bare survival; luxury and non-essentials plunge.' },
      { range: '36 - 60', label: 'Belt-Tightening', desc: 'Households switch to smaller pack sizes and local substitutes.' },
      { range: '61 - 100', label: 'Healthy Household Demand', desc: 'Strong consumer demand absorbing modest price changes.' }
    ]
  },
  debt_service_burden: {
    title: 'Sovereign Debt Service-to-Revenue',
    short: 'The percentage of government tax revenue spent just paying interest on debt.',
    definition: 'The ratio of sovereign debt servicing obligations to total retained federal revenues.',
    businessMeaning: 'When the government spends over 70% of its revenue servicing debt, it has little left for roads, electricity, or hospitals. To pay bills, the government borrows more domestically, pushing interest rates up and crowding out private business borrowing.',
    scale: [
      { range: '0% - 40%', label: 'Sustainable Corridor', desc: 'Ample fiscal room for public infrastructure and business support.' },
      { range: '41% - 65%', label: 'Fiscal Vulnerability', desc: 'Rising debt payments crowding out capital projects.' },
      { range: '66%+', label: 'Critical Debt Trap', desc: 'High yields locked into treasury bills; sovereign crowding-out.' }
    ]
  },
  margin_stress: {
    title: 'Sector Gross Margin Delta',
    short: 'How much profit margins expand or shrink after factoring in currency and power costs.',
    definition: 'The percentage-point change in operating gross profit margins for firms in the selected industry sector.',
    businessMeaning: 'A negative number (e.g. -12%) means costs (imported raw materials, diesel for generators) rose faster than the company can raise retail prices, resulting in net operating losses.',
    scale: [
      { range: 'Negative (< 0%)', label: 'Unit Margin Squeeze', desc: 'Companies selling at or near loss unless prices rise immediately.' },
      { range: '0% - 10%', label: 'Margin Protection', desc: 'Passing cost inflation to customers without severe volume loss.' },
      { range: '10%+', label: 'Pricing Power Expansion', desc: 'Commodity exporters or dominant monopolies expanding margins.' }
    ]
  },
  supply_chain_stress: {
    title: 'Supply Chain & Logistics Disruption Strain',
    short: 'Transport delays and expenses from port congestion, customs clearance, and diesel haulage.',
    definition: 'An empirical stress index evaluating physical freight movement, port dwell times, demurrage fees, and interstate diesel haulage costs.',
    businessMeaning: 'In import-dependent emerging economies like Nigeria, high diesel and port clearance delays severely slow down inventory velocity and inflate working capital requirements.',
    scale: [
      { range: '0 - 45', label: 'Smooth Logistics Corridor', desc: 'Fast port clearance and stable trucking haulage rates.' },
      { range: '46 - 65', label: 'Moderate Freight Headwinds', desc: 'Periodic demurrage fees and regional transport friction.' },
      { range: '66 - 100', label: 'Critical Logistics Bottleneck', desc: 'Severe port gridlock, high diesel haulage costs, inventory stockouts.' }
    ]
  },
  corporate_health: {
    title: 'Listed Corporate Solvency & Earnings Index',
    short: 'The financial health and debt-paying ability of major public companies on the NGX.',
    definition: 'A composite solvency metric evaluating 20 prominent Nigerian Exchange (NGX) and African blue-chips under current borrowing rates and foreign exchange obligations.',
    businessMeaning: 'Companies with unhedged dollar loans (like telcos and manufacturers) suffer paper revaluation losses when FX depreciates, and loan servicing strains when the Central Bank raises interest rates above 25%.',
    scale: [
      { range: '0 - 45', label: 'Elevated Corporate Solvency Risk', desc: 'Heavy FX translation losses and debt service distress.' },
      { range: '46 - 65', label: 'Defensive Restructuring', desc: 'Companies cutting costs, reducing debt, and localizing supply chains.' },
      { range: '66 - 100', label: 'Robust Solvency & Free Cash Flow', desc: 'Strong balance sheets with high pricing power and export dollar earnings.' }
    ]
  },
  fx_pressure: {
    title: 'Sovereign FX Reserve Pressure Rating',
    short: 'How safe or endangered the Central Bank\'s foreign exchange reserves are.',
    definition: 'A stress indicator measuring the vulnerability of the national currency to speculative capital flight and import demand surges.',
    businessMeaning: 'If FX Pressure is at "Critical Alert", dollar liquidity in the interbank market dries up, making it hard for businesses to open letters of credit or remit dividends.',
    scale: [
      { range: 'Managed Corridor', label: 'Healthy FX Buffer', desc: 'Sufficient import cover to support foreign exchange market stability.' },
      { range: 'Elevated Strain', label: 'Rationed Dollar Liquidity', desc: 'Delays in official foreign exchange market allotments.' },
      { range: 'Critical Alert', label: 'Currency Devaluation Risk', desc: 'Severe parallel market divergence; emergency currency adjustments likely.' }
    ]
  },
  mpr: {
    title: 'Monetary Policy Rate (MPR)',
    short: 'The benchmark interest rate set by the Central Bank.',
    definition: 'The anchor interest rate that influences all commercial bank lending and deposit rates across the entire economy.',
    businessMeaning: 'When the Central Bank hikes the MPR (e.g. to 27.25%), commercial banks raise their loan rates to 30%+ to cool inflation. For businesses, this makes borrowing expensive; for savers, it pays higher returns on treasury bills.'
  },
  inflation: {
    title: 'Headline Inflation (CPI)',
    short: 'The overall speed at which prices are rising across the country.',
    definition: 'A macroeconomic measure tracking the weighted basket of consumer goods and services across food, transport, and utilities.',
    businessMeaning: 'High inflation reduces the real purchasing power of worker wages and escalates replacement costs for commercial inventory.'
  },
  fx_rate: {
    title: 'Exchange Rate (USD/NGN)',
    short: 'The price in local naira to purchase 1 US Dollar.',
    definition: 'The commercial rate of foreign currency exchange. In Nigeria, the official NAFEM window determines the clearing price.',
    businessMeaning: 'A higher exchange rate (e.g. ₦1,650/$) means imported goods, factory spare parts, and raw materials cost more naira. Companies with US dollar loans must record large paper revaluation losses.'
  },
  fuel_price: {
    title: 'Industrial Fuel & Pump Price',
    short: 'The price per litre of petrol (PMS) and industrial diesel (AGO).',
    definition: 'The market clearing price of refined petroleum products following deregulation and subsidy reforms.',
    businessMeaning: 'Because factories run on diesel generators to bridge electrical grid outages and trucks haul 90% of Nigerian freight, fuel price hikes directly cause cost-push inflation across every industry.'
  },
  crr: {
    title: 'Cash Reserve Requirement (CRR)',
    short: 'The percentage of customer deposits that banks must freeze at the Central Bank.',
    definition: 'A mandatory regulatory ratio requiring commercial banks to keep a fixed portion of customer deposits frozen at the Central Bank with 0% interest.',
    businessMeaning: 'A high CRR (e.g. 45% or 50%) sterilizes loanable funds. Banks have less money to lend out to businesses, which drives up borrowing interest rates.'
  },
  spend_impulse: {
    title: 'Fiscal Spending / Deficit Impulse',
    short: 'How much money the government is injecting into the economy via budget spending.',
    definition: 'The net fiscal stimulus or deficit spending of the government expressed as a percentage of GDP.',
    businessMeaning: 'When the government spends heavily on infrastructure, contracts, or subsidies, it injects demand into the economy. If production can\'t keep up, excessive fiscal spending fuels inflation.'
  }
};

function showTermExplanation(key) {
  const t = ECONOMIC_TERM_GLOSSARY[key];
  if (!t) return;

  const modalHtml = `
    <div class="econsim-modal-backdrop" id="term-modal-backdrop" onclick="closeTermModal(event)">
      <div class="econsim-modal" onclick="event.stopPropagation()">
        <div class="econsim-modal-header">
          <h3>
            <span style="font-size: 18px;">💡</span>
            <span>${t.title}</span>
          </h3>
          <button class="econsim-modal-close" onclick="closeTermModal()">✕</button>
        </div>
        <div class="econsim-modal-body">
          <div style="background: rgba(36,121,101,0.08); border-left: 4px solid var(--jade); padding: 12px 14px; border-radius: 6px; margin-bottom: 14px;">
            <b style="color: var(--jade); font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">In Plain English:</b>
            <div style="font-size: 13.5px; font-weight: 600; color: var(--navy);">${t.short}</div>
          </div>

          <div style="margin-bottom: 14px;">
            <b style="color: var(--text); font-size: 12.5px; display: block; margin-bottom: 4px;">Economic Definition:</b>
            <p style="color: var(--muted); margin: 0; line-height: 1.6;">${t.definition}</p>
          </div>

          <div style="margin-bottom: 14px;">
            <b style="color: var(--navy); font-size: 12.5px; display: block; margin-bottom: 4px;">What This Means for Leadership & Businesses:</b>
            <p style="color: var(--text); margin: 0; line-height: 1.6; background: var(--bg); padding: 10px 12px; border-radius: 6px; border: 1px solid var(--line);">${t.businessMeaning}</p>
          </div>

          ${t.scale ? `
            <div>
              <b style="color: var(--text); font-size: 12.5px; display: block; margin-bottom: 6px;">How to Interpret the Index:</b>
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${t.scale.map(s => `
                  <div style="display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; padding: 6px 10px; background: var(--bg); border-radius: 6px; border: 1px solid var(--line);">
                    <b style="color: var(--navy); min-width: 100px;">${s.range}</b>
                    <span style="color: var(--jade); font-weight: 600; margin-right: 8px;">${s.label}:</span>
                    <span style="color: var(--muted); flex: 1; text-align: right;">${s.desc}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
        <div class="econsim-modal-footer">
          <button class="btn btn-primary btn-sm" onclick="closeTermModal()">Understood ✓</button>
        </div>
      </div>
    </div>
  `;

  const existing = document.getElementById('term-modal-backdrop');
  if (existing) existing.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeTermModal(e) {
  if (e && e.target && e.target.id !== 'term-modal-backdrop' && !e.target.classList.contains('econsim-modal-close') && e.target.tagName !== 'BUTTON') {
    return;
  }
  const modal = document.getElementById('term-modal-backdrop');
  if (modal) modal.remove();
}

// -------------------------------------------------------------
// Interactive Onboarding Walkthrough & Guided Tours
// -------------------------------------------------------------
const PAGE_TOURS = {
  dashboard: {
    title: 'Platform Overview Walkthrough',
    badge: 'Terminal Guide',
    steps: [
      {
        title: 'Welcome to Developing Market',
        icon: '🌐',
        desc: 'Developing Market is an educational financial simulation and economic intelligence terminal built for African emerging markets, stacking specifically for Nigerian monetary, corporate, and supply chain dynamics.'
      },
      {
        title: 'Virtual Demonstration vs Live Capital',
        icon: '⛁',
        desc: 'Every account begins with ₦500,000 in virtual demonstration capital (VNGN) strictly for educational analysis, risk-free forecasting, and leaderboard competition. Live real money mode is isolated and governed by administrative feature gates.'
      },
      {
        title: 'Macroeconomic Catalyst Predictor',
        icon: '📈',
        desc: 'Forecast real macroeconomic catalysts (such as Central Bank MPR rate decisions, inflation releases, and corporate earnings). Trade YES/NO contracts against verified institutional benchmarks.'
      },
      {
        title: 'Executive Boardroom Matches',
        icon: '🏛️',
        desc: 'Enter live, timed business case matches. Step into the shoes of a CEO or CFO confronting real-world corporate dilemmas, submit strategic decision memos, and receive authoritative performance scores.'
      },
      {
        title: 'Multivariate Scenario Lab',
        icon: '🔬',
        desc: 'Simulate policy shocks (like currency devaluation or fuel subsidy deregulation) and watch real-time transmission across 20 Nigerian public companies (NGX blue-chips).'
      }
    ]
  },
  lab: {
    title: 'Scenario Lab Guided Walkthrough',
    badge: 'Macro Flight Simulator',
    steps: [
      {
        title: 'What is Scenario Lab?',
        icon: '🔬',
        desc: 'Think of Scenario Lab as a flight simulator for the economy. You can test what happens to Nigerian companies and households if fuel prices rise or currency depreciates, without any financial risk.'
      },
      {
        title: '1. Select an Industry Sector',
        icon: '📊',
        desc: 'Use the top industry pills (Monetary, Energy, FMCG, Manufacturing, Telecoms, Agriculture, Banking) to focus your simulation on a specific sector of the African economy.'
      },
      {
        title: '2. Pick a Crisis or Policy Preset',
        icon: '⚡',
        desc: 'Scenarios (like "Currency Floating Shock" or "Aggressive MPR Tightening") establish the baseline dilemma. Calibrating levers tests how policies and shocks transmit through that specific scenario.'
      },
      {
        title: '3. Calibrate Levers (Policy Controls)',
        icon: '⚙️',
        desc: 'The dials of the economy. Adjust Interest Rates (MPR), Exchange Rates (USD/NGN), Fuel Pump Prices, and Bank Reserve Requirements (CRR) to stress-test outcomes. Look for the ⚡ Scenario Driver badge to see the key shock parameters!'
      },
      {
        title: '4. Equilibrium Transmission Gauges',
        icon: '📊',
        desc: 'Observe real-time economic responses: Projected Inflation, Bank Credit Impulse, Business CapEx Sentiment, Consumer Purchasing Power, and Logistics Disruption. Click any (?) icon to see a plain-English explanation!'
      },
      {
        title: '5. Public Corporate Radar (20 Tickers)',
        icon: '📡',
        desc: 'Real-time sensitivity radar evaluating 20 listed African blue-chips on the Nigerian Exchange (Dangote Cement, MTN, Nestle, GTCO, Seplat, BUA Foods, etc.) to see earnings and supply chain impacts.'
      },
      {
        title: '6. Executive Policy Briefing',
        icon: '📋',
        desc: 'Click "Generate Executive Masterclass Briefing" to synthesize a complete C-suite policy memorandum covering monetary transmission, working capital risks, and leadership playbooks.'
      }
    ]
  },
  boardroom: {
    title: 'Executive Boardroom Walkthrough',
    badge: 'Competitive Arena',
    steps: [
      {
        title: 'What is the Executive Boardroom?',
        icon: '🏛️',
        desc: 'A high-stakes strategy arena where analysts, students, and executives face sealed business dilemmas under timed conditions. You take the role of a corporate leader solving a pressing operational crisis.'
      },
      {
        title: 'Sealed Business Dilemmas',
        icon: '🔒',
        desc: 'To preserve competitive integrity, case parameters remain sealed until match countdown starts. Once live, you have limited time to formulate a strategic capital plan.'
      },
      {
        title: 'Submitting Your Strategy Memo',
        icon: '✍️',
        desc: 'Submit your strategic decision memo answering key balance sheet, pricing, and operational questions. Focus on practical cash flow insulation and downside protection.'
      },
      {
        title: 'Authoritative Executive Evaluation',
        icon: '🏆',
        desc: 'Your submission is adjudicated against an executive rubric covering Financial Mechanics, Downside Risk Insulation, Historical Precedent, and Executive Clarity. High scores award XP on the global leaderboard!'
      }
    ]
  },
  predictor: {
    title: 'Macroeconomic Predictor Tour',
    badge: 'Forecasting Contracts',
    steps: [
      {
        title: 'Trade Verified Economic Catalysts',
        icon: '📈',
        desc: 'Evaluate real-world African economic contracts—such as Central Bank MPR hikes, quarterly GDP releases, NIBSS instant payment volumes, and Brent crude corridors.'
      },
      {
        title: 'YES / NO Probability Contracts',
        icon: '⚖️',
        desc: 'Contracts are priced between ₦1 and ₦99, reflecting the market probability. Review institutional research dossiers and allocate virtual or live capital.'
      },
      {
        title: 'Empirical Settlement & XP',
        icon: '🎯',
        desc: 'When the catalyst occurs, contracts resolve strictly against empirical official data (CBN, NBS, NIBSS, SEC). Winning positions pay out ₦100 per contract plus competitive XP!'
      }
    ]
  },
  wallet: {
    title: 'Ledger Wallet & Security Walkthrough',
    badge: 'Double-Entry Capital',
    steps: [
      {
        title: 'Double-Entry Ledger Segregation',
        icon: '💳',
        desc: 'Your capital is governed by an immutable double-entry ledger. Educational virtual funds (VNGN) and live funds (NGN) are strictly isolated across separate accounts with zero cross-contamination.'
      },
      {
        title: 'Demo Virtual Grant (₦500,000)',
        icon: '⛁',
        desc: 'Explore the platform freely with ₦500,000 in virtual demonstration capital. Click "Claim / Verify Demo Grant" if you ever need to replenish demo funds.'
      },
      {
        title: 'Escrow Reserves & Audit Trail',
        icon: '📜',
        desc: 'When you enter a boardroom match or place a forecast, funds are safely held in escrow until resolution. All transactions are logged with date, event type, and balance delta in the scrollable ledger journal below.'
      }
    ]
  },
  leaderboard: {
    title: 'Competitive Leaderboard Tour',
    badge: 'Strategist Rankings',
    steps: [
      {
        title: 'Competitive Intelligence Rankings',
        icon: '🏆',
        desc: 'Recognizing verified predictive accuracy, disciplined risk management, and strategic reasoning among emerging market executives and analysts.'
      },
      {
        title: 'Filter by Discipline',
        icon: '🌐',
        desc: 'Toggle between "🌐 All" for overall rankings, "📈 Predictor" for macroeconomic forecasting accuracy, and "🏛️ Boardroom" for strategic leadership dilemma performance.'
      }
    ]
  },
  mentor: {
    title: 'AI Mentor Guided Tour',
    badge: 'Financial Reasoning Desk',
    steps: [
      {
        title: 'Your Senior Macroeconomic Economist',
        icon: '✧',
        desc: 'The AI Mentor is your dedicated financial reasoning assistant. Ask complex questions on monetary transmission, working capital modeling, exchange rate elasticity, or valuation multiples.'
      },
      {
        title: 'First-Principles Explanations',
        icon: '📐',
        desc: 'Every explanation is delivered in depth with economic first principles, Nigerian real-world dynamics, mathematical formulation, and C-suite executive trade-offs.'
      }
    ]
  }
};

// -------------------------------------------------------------
// Driver.js Element-Specific Interactive Walkthroughs
// -------------------------------------------------------------
const PAGE_DRIVER_STEPS = {
  dashboard: [
    {
      element: '#dash-metrics-cards',
      popover: {
        title: '📊 Capital & Literacy Telemetry',
        description: 'Track your available simulation capital (VNGN), real capital, accumulated Financial Literacy XP, and active forecast commitments in real time.',
        side: 'bottom',
        align: 'center'
      }
    },
    {
      element: '#dash-markets-panel',
      popover: {
        title: '📈 Macroeconomic Catalyst Radar',
        description: 'Explore live macroeconomic contracts (CBN interest rate decisions, inflation releases, and corporate earnings). Trade YES/NO contracts against verified benchmarks.',
        side: 'top',
        align: 'start'
      }
    },
    {
      element: '#dash-boardroom-panel',
      popover: {
        title: '🏛️ The Executive Boardroom',
        description: 'Enter timed business case dilemmas. Step into the shoes of a corporate executive, formulate capital strategies, and receive authoritative performance scores.',
        side: 'left',
        align: 'start'
      }
    },
    {
      element: '#dash-learning-desk',
      popover: {
        title: '✧ Quick Learning Desk',
        description: 'Direct shortcuts to consult your AI Mentor on financial mechanics, test policy shocks in Scenario Lab, or inspect your global ranking.',
        side: 'top',
        align: 'start'
      }
    },
    {
      element: '.top-actions',
      popover: {
        title: '🔄 Terminal Controls & Account',
        description: 'Toggle between Virtual Demo (educational) and Real Capital mode, review notifications, access your Ledger Wallet, and configure strategist settings.',
        side: 'bottom',
        align: 'end'
      }
    }
  ],

  lab: [
    {
      element: '#lab-industry-pills-bar',
      popover: {
        title: '1. Select Industry Sector',
        description: 'Select the economic sector you want to stress-test: Monetary, Energy, FMCG, Manufacturing, Telecoms, Agriculture, or Banking.',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '#lab-scenario-presets-bar',
      popover: {
        title: '2. Crisis & Policy Scenarios',
        description: 'Select a dilemma preset—such as Currency Floating Shock, Aggressive MPR Tightening, or Fuel Subsidy Deregulation—to anchor the simulation.',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '#lab-levers-panel',
      popover: {
        title: '3. Calibrate Levers (Controls)',
        description: 'Move the dials of the economy: MPR Interest Rate, USD/NGN FX Rate, Fuel Pump Prices, and Bank Reserve Ratio. Look for the ⚡ Scenario Driver badge to spot key shock factors.',
        side: 'right',
        align: 'start'
      }
    },
    {
      element: '#lab-live-telemetry-hud',
      popover: {
        title: '4. Real-Time Telemetry HUD',
        description: 'Watch projected 12M Inflation, Credit Impulse, Logistics Strain, and Listed Solvency respond dynamically as you slide policy levers.',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '#lab-gauges-panel',
      popover: {
        title: '5. Transmission Gauges',
        description: 'Deep equilibrium gauges for Credit Impulse, CapEx Sentiment, Consumer Purchasing Power, and Supply Chains. Click any (?) button for plain-English economic definitions.',
        side: 'left',
        align: 'start'
      }
    },
    {
      element: '#lab-corporate-radar-panel',
      popover: {
        title: '6. Public Corporate Radar (20 Tickers)',
        description: 'Live sensitivity analysis across 20 African blue-chips on the Nigerian Exchange (Dangote Cement, MTN, Nestle, GTCO, Seplat). Search by ticker or industry.',
        side: 'top',
        align: 'start'
      }
    },
    {
      element: '#lab-briefing-panel',
      popover: {
        title: '7. Executive Masterclass Briefing',
        description: 'Click "Generate Executive Masterclass Briefing" to synthesize a complete C-suite memorandum with balance sheet transmission mechanics and leadership tactics.',
        side: 'top',
        align: 'start'
      }
    }
  ],

  predictor: [
    {
      element: '#predictor-filter-bar',
      popover: {
        title: '1. Filter Catalysts by Sector',
        description: 'Filter macroeconomic probability contracts by Monetary Policy, Equities, Energy, Agriculture, FX, Fintech, or FMCG.',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '#markets-container',
      popover: {
        title: '2. Probability Contracts',
        description: 'Trade YES / NO contracts on verified African macroeconomic outcomes. Prices range between ₦1 and ₦99 based on market consensus probabilities.',
        side: 'top',
        align: 'start'
      }
    },
    {
      element: '.market-card',
      popover: {
        title: '3. Contract Card & Research Dossier',
        description: 'Click any contract to open its research dossier, evaluate official benchmark data sources, and allocate demo or live capital.',
        side: 'bottom',
        align: 'start'
      }
    }
  ],

  boardroom: [
    {
      element: '#boardroom-lobby-container',
      popover: {
        title: '🏛️ Strategy Dilemmas Lobby',
        description: 'Review active and upcoming boardroom business cases. Parameters are sealed until the timer starts to maintain competitive integrity.',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '.boardroom-challenge-card',
      popover: {
        title: '✍️ Submit Strategic Decisions',
        description: 'Enter the session, analyze financial constraints, formulate your capital allocation memo, and receive authoritative performance scores.',
        side: 'top',
        align: 'start'
      }
    }
  ],

  wallet: [
    {
      element: '#wallet-metrics-summary',
      popover: {
        title: '💳 Double-Entry Segregated Capital',
        description: 'Strict ledger separation between Virtual Demo Capital (VNGN) and Live Capital (NGN) with zero cross-contamination.',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '#wallet-actions-panel',
      popover: {
        title: '⚡ Capital Operations',
        description: 'Claim your ₦500,000 educational virtual grant anytime, or deposit/withdraw funds in live mode.',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '#wallet-transactions-table',
      popover: {
        title: '📜 Immutable Ledger Journal',
        description: 'Audited log of every entry, escrow hold, settlement, and payout with precise timestamps and transaction IDs.',
        side: 'top',
        align: 'start'
      }
    }
  ],

  leaderboard: [
    {
      element: '#leaderboard-tabs-bar',
      popover: {
        title: '🏆 Filter by Discipline',
        description: 'Toggle between Overall Strategist rankings, Macro Predictor accuracy, and Executive Boardroom scores.',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '#leaderboard-table-body',
      popover: {
        title: '📈 Institutional Standings',
        description: 'Track your XP level, accuracy rates, and competitive rank among emerging market analysts and executives.',
        side: 'top',
        align: 'start'
      }
    }
  ],

  mentor: [
    {
      element: '#mentor-quick-prompts',
      popover: {
        title: '✧ Macro Reasoning Starters',
        description: 'Select executive prompts covering CBN monetary transmission, cash runway formulas, FX devaluation pass-through, and risk matrices.',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '#mentor-chat-thread',
      popover: {
        title: '📐 First-Principles Analysis',
        description: 'Your AI Mentor responds with rigorous macroeconomic formulas, real-world Nigerian context, and C-suite strategic trade-offs.',
        side: 'top',
        align: 'start'
      }
    },
    {
      element: '#mentor-input',
      popover: {
        title: '✍️ Ask Any Strategic Question',
        description: 'Type any financial or economic scenario here for deep econometric reasoning and strategic guidance.',
        side: 'top',
        align: 'start'
      }
    }
  ]
};

let activeDriverInstance = null;
let currentTourStep = 0;
let currentTourPage = 'dashboard';

function startInteractiveDriverTour(page = null) {
  const p = page || state.page || 'dashboard';
  currentTourPage = p;

  const driverConstructor = window.driver?.js?.driver || window.driver?.driver;
  if (!driverConstructor) {
    startPageTourModal(p);
    return;
  }

  // Destroy previous tour instance if any
  if (activeDriverInstance) {
    try { activeDriverInstance.destroy(); } catch (_) {}
    activeDriverInstance = null;
  }

  const rawSteps = PAGE_DRIVER_STEPS[p] || PAGE_DRIVER_STEPS.dashboard;
  // Filter steps to elements that currently exist in DOM (or modal steps without element)
  const validSteps = rawSteps.filter(s => {
    if (!s.element) return true;
    return !!document.querySelector(s.element);
  });

  if (validSteps.length === 0) {
    startPageTourModal(p);
    return;
  }

  const isDark = state.theme !== 'light';

  // Format steps for Driver.js
  const formattedSteps = validSteps.map((step, idx) => {
    return {
      element: step.element,
      popover: {
        title: step.popover.title,
        description: `
          <div>${step.popover.description}</div>
          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--line); display: flex; justify-content: space-between; align-items: center;">
            <a href="javascript:void(0)" onclick="openTourOverviewModal('${p}')" style="color: #38bdf8; font-size: 11px; text-decoration: underline; font-weight: 600;">📖 Terminal Overview Guide</a>
            <span style="font-size: 10.5px; color: var(--muted);">${idx + 1} of ${validSteps.length}</span>
          </div>
        `,
        side: step.popover.side || 'bottom',
        align: step.popover.align || 'start'
      }
    };
  });

  activeDriverInstance = driverConstructor({
    showProgress: true,
    animate: true,
    allowClose: true,
    popoverClass: 'econsim-tour-popover',
    overlayColor: isDark ? 'rgba(5, 12, 22, 0.82)' : 'rgba(15, 23, 42, 0.5)',
    nextBtnText: 'Next →',
    prevBtnText: '← Back',
    doneBtnText: 'Finish Tour ✓',
    steps: formattedSteps,
    onDestroyStarted: () => {
      markTourSeen(p);
      if (activeDriverInstance) {
        activeDriverInstance.destroy();
        activeDriverInstance = null;
      }
    }
  });

  activeDriverInstance.drive();
}

function openTourOverviewModal(page = null) {
  if (activeDriverInstance) {
    try { activeDriverInstance.destroy(); } catch (_) {}
    activeDriverInstance = null;
  }
  startPageTourModal(page || currentTourPage);
}

function startPageTourModal(page = null) {
  const p = page || state.page || 'dashboard';
  currentTourPage = p;
  currentTourStep = 0;
  renderTourModal();
}

function startPageTour(page = null) {
  const p = page || state.page || 'dashboard';
  markTourSeen(p);
  startInteractiveDriverTour(p);
}

function renderTourModal() {
  const tour = PAGE_TOURS[currentTourPage] || PAGE_TOURS.dashboard;
  const step = tour.steps[currentTourStep];
  const total = tour.steps.length;

  const modalHtml = `
    <div class="econsim-modal-backdrop" id="tour-modal-backdrop" onclick="closeTourModal(event)">
      <div class="econsim-modal" style="max-width: 520px;" onclick="event.stopPropagation()">
        <div class="econsim-modal-header">
          <div>
            <span class="tour-step-counter">STEP ${currentTourStep + 1} OF ${total} · ${tour.badge}</span>
            <h3 style="margin-top: 2px;">
              <span style="font-size: 20px;">${step.icon || '💡'}</span>
              <span>${step.title}</span>
            </h3>
          </div>
          <button class="econsim-modal-close" onclick="closeTourModal()">✕</button>
        </div>
        <div class="econsim-modal-body" style="padding: 24px;">
          <p style="font-size: 14px; line-height: 1.7; color: var(--text); margin: 0 0 16px;">
            ${step.desc}
          </p>
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
            <div class="tour-dots">
              ${tour.steps.map((_, i) => `<span class="tour-dot ${i === currentTourStep ? 'active' : ''}"></span>`).join('')}
            </div>
            <label style="font-size: 11.5px; color: var(--muted); cursor: pointer; display: flex; align-items: center; gap: 4px;">
              <input type="checkbox" id="tour-dont-show-checkbox" onchange="toggleTourAutoShow(this.checked)"> Don't show automatically
            </label>
          </div>
        </div>
        <div class="econsim-modal-footer" style="justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <button class="btn btn-secondary btn-sm" onclick="prevTourStep()" ${currentTourStep === 0 ? 'disabled style="opacity: 0.4;"' : ''}>
            ← Back
          </button>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button class="btn btn-secondary btn-sm" onclick="closeTourModal(); startInteractiveDriverTour('${currentTourPage}');" title="Highlight actual elements on this page" style="display: inline-flex; align-items: center; gap: 4px;">
              <span>🎯</span> Interactive UI Tour
            </button>
            <button class="btn btn-primary btn-sm" onclick="nextTourStep()">
              ${currentTourStep < total - 1 ? 'Next →' : 'Finish Tour ✓'}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const existing = document.getElementById('tour-modal-backdrop');
  if (existing) existing.remove();

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function nextTourStep() {
  const tour = PAGE_TOURS[currentTourPage] || PAGE_TOURS.dashboard;
  if (currentTourStep < tour.steps.length - 1) {
    currentTourStep++;
    renderTourModal();
  } else {
    markTourSeen(currentTourPage);
    closeTourModal();
    api.toast('Tour complete! Click "💡 Guided Tour" in the top bar to review anytime.', 'success');
  }
}

function prevTourStep() {
  if (currentTourStep > 0) {
    currentTourStep--;
    renderTourModal();
  }
}

function closeTourModal(e) {
  if (e && e.target && e.target.id !== 'tour-modal-backdrop' && !e.target.classList.contains('econsim-modal-close') && e.target.tagName !== 'BUTTON') {
    return;
  }
  markTourSeen(currentTourPage);
  const modal = document.getElementById('tour-modal-backdrop');
  if (modal) modal.remove();
}

function toggleTourAutoShow(checked) {
  if (checked) {
    markTourSeen(currentTourPage);
  } else {
    delete state.seenTours[currentTourPage];
    localStorage.removeItem('econsim-tour-seen-' + currentTourPage);
  }
}

function markTourSeen(page) {
  if (!page) return;
  state.seenTours[page] = true;
  localStorage.setItem('econsim-tour-seen-' + page, 'true');

  // Persist to database for authenticated user so tour state syncs across all devices & sessions
  if (state.user) {
    api.post('/profile/tour-seen', { page }).catch(() => {});
  }
}

function checkAutoTourForPage(page) {
  if (!page || ['login', 'signup', 'verify', 'forgot', 'reset', 'welcome', 'onboarding'].includes(page)) return;

  // Check if user has already opened or seen this page's tour in DB state or localStorage
  const hasSeenState = !!state.seenTours[page];
  const hasSeenStorage = !!localStorage.getItem('econsim-tour-seen-' + page);

  if (hasSeenState || hasSeenStorage) {
    // User has already opened/seen this page before - no need to pop up automatically!
    return;
  }

  // First time opening this page: record in DB and trigger the tour once
  setTimeout(() => {
    if (state.page === page && !state.seenTours[page] && !localStorage.getItem('econsim-tour-seen-' + page)) {
      markTourSeen(page);
      startPageTour(page);
    }
  }, 700);
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
      ` : notifs.map(n => {
        const timeStr = formatNotifTime(n.timestamp || n.created_at);
        const exactTime = formatNotifExactTime(n.timestamp || n.created_at);
        return `
        <div class="notif-item ${!n.read ? 'unread' : ''}" onclick="handleNotificationClick('${n.id}')">
          <div class="notif-icon-box">
            ${n.category === 'boardroom' ? '🏛️' : (n.category === 'market' ? '📈' : (n.category === 'wallet' ? '💳' : '🔔'))}
          </div>
          <div class="notif-content">
            <div class="notif-title">
              <span>${n.title}</span>
              <span class="notif-unread-dot"></span>
            </div>
            <div class="notif-desc">${n.message}</div>
            <div class="notif-meta">
              <span title="${exactTime}">⏱ ${timeStr}</span>
              <span style="color: var(--jade); font-weight: 600;">Open &rarr;</span>
            </div>
          </div>
        </div>
      `;
      }).join('')}
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
  const isLabEnabled = Boolean(state.features?.scenario_lab);
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
    ...(isLabEnabled ? [{ 
      id: 'lab', 
      label: 'Scenario Lab', 
      icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.31L4.2 19.37A2 2 0 0 0 5.92 22h12.16a2 2 0 0 0 1.72-2.63L14 9.31V2"/></svg>` 
    }] : []),
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
          <button class="nav-item" onclick="openFeedbackModal()" style="margin-bottom: 2px;">
            <span class="nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </span>
            <span class="text">Send Feedback</span>
          </button>
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

            <!-- Mobile Guided Tour Button -->
            <button class="btn btn-secondary btn-sm" onclick="startPageTour()" title="Page Walkthrough" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 14px;">
              💡
            </button>

            <!-- Mobile PWA Install Button -->
            <button class="btn btn-secondary btn-sm pwa-install-trigger" onclick="triggerPwaInstall()" title="Install EconSim App" style="width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; border-color: rgba(16, 185, 129, 0.4); color: var(--jade);">
              📲
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

            <!-- Desktop Guided Tour Button -->
            <button class="btn btn-secondary btn-sm" onclick="startPageTour()" title="Guided Walkthrough for this Page" style="font-size: 11.5px; padding: 5px 10px; display: inline-flex; align-items: center; gap: 4px; font-weight: 600;">
              <span>💡</span> Guided Tour
            </button>

            <!-- Desktop PWA Install Button -->
            <button class="btn btn-secondary btn-sm pwa-install-trigger" onclick="triggerPwaInstall()" title="Install EconSim Workstation App" style="font-size: 11.5px; padding: 5px 10px; display: inline-flex; align-items: center; gap: 4px; font-weight: 600; border-color: rgba(16, 185, 129, 0.4); color: var(--jade);">
              <span>📲</span> Install App
            </button>

            <!-- Desktop Feedback Button -->
            <button class="btn btn-secondary btn-sm" onclick="openFeedbackModal()" title="Share Feedback or Suggestions" style="font-size: 11.5px; padding: 5px 10px; display: inline-flex; align-items: center; gap: 4px; font-weight: 600;">
              <span>💬</span> Feedback
            </button>

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
                <b style="color: var(--text); font-size: 13.5px; display: block;">${state.user?.display_name || 'Strategist'}</b>
                <small style="color: var(--muted); font-size: 11px;">${state.user?.email || ''}</small>
              </div>
            </div>
            <button class="drawer-close-btn" onclick="closeMobileDrawer()">✕</button>
          </div>

          <div class="mobile-drawer-content">
            <!-- Dedicated Capital & Balance Card -->
            <div class="mobile-drawer-balance-card" onclick="navigate('wallet'); closeMobileDrawer();" title="Manage Ledger Capital">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); font-weight: 700;">Account Balance</span>
                <span class="mode-status-pill ${isReal ? 'real' : 'demo'}" style="font-size: 9.5px; padding: 2px 7px;">
                  <span class="mode-dot"></span> ${isReal ? 'Live Capital' : 'Virtual Demo'}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: baseline;">
                <div style="font-size: 21px; font-weight: 800; color: var(--jade); font-family: monospace;">
                  ${formatMoney(activeBal.available || 0)} <small style="font-size: 11px; color: var(--muted); font-weight: 500;">${currLabel}</small>
                </div>
                <span style="font-size: 12px; color: #38bdf8; font-weight: 600;">Ledger ↗</span>
              </div>
              <div style="font-size: 11px; color: var(--muted); margin-top: 6px; display: flex; justify-content: space-between; border-top: 1px dashed var(--line); padding-top: 6px;">
                <span>Total Ledger Reserves:</span>
                <b>${formatMoney(activeBal.total || 0)} ${currLabel}</b>
              </div>
            </div>

            <!-- Drawer PWA Install Trigger -->
            <button type="button" class="btn btn-secondary btn-full pwa-install-trigger" onclick="triggerPwaInstall(); closeMobileDrawer();" style="margin-bottom: 14px; font-size: 12.5px; padding: 9px; font-weight: 700; border-color: rgba(16, 185, 129, 0.4); color: var(--jade); display: inline-flex; align-items: center; justify-content: center; gap: 6px;">
              <span>📲</span> Install App on this Device
            </button>

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
            ${isLabEnabled ? `
            <button class="nav-item ${state.page === 'lab' ? 'active' : ''}" onclick="navigate('lab'); closeMobileDrawer();">
              <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 2v7.31L4.2 19.37A2 2 0 0 0 5.92 22h12.16a2 2 0 0 0 1.72-2.63L14 9.31V2"/></svg></span>
              <span class="text">Scenario Lab</span>
            </button>
            ` : ''}
            <button class="nav-item ${state.page === 'leaderboard' ? 'active' : ''}" onclick="navigate('leaderboard'); closeMobileDrawer();">
              <span class="nav-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34c3.48-1.07 6-4.28 6-8.66V3H4v3c0 4.38 2.52 7.59 6 8.66z"/></svg></span>
              <span class="text">Leaderboard</span>
            </button>
            <button class="nav-item" onclick="closeMobileDrawer(); startPageTour();" title="Launch guided tour walkthrough for this page">
              <span class="nav-icon" style="font-size: 16px;">💡</span>
              <span class="text">Page Guided Tour</span>
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

            <div class="sidebar-label" style="margin-top: 18px;">COMMUNITY &amp; FEEDBACK</div>
            <button class="nav-item" onclick="openExpertScenarioSubmissionModal(); closeMobileDrawer();">
              <span class="nav-icon" style="font-size: 16px;">🎓</span>
              <span class="text">Submit Real-World Scenario</span>
            </button>
            <button class="nav-item" onclick="openFeedbackModal(); closeMobileDrawer();">
              <span class="nav-icon" style="font-size: 16px;">💬</span>
              <span class="text">Send Feedback &amp; Ideas</span>
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
  const isLabEnabled = Boolean(state.features?.scenario_lab);
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

    ${renderPushPromptBanner()}

    <div class="metrics-row" id="dash-metrics-cards">
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
      <div class="panel" id="dash-markets-panel">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h2>Macroeconomic Catalysts</h2>
          <button class="btn btn-secondary" style="font-size: 12px; padding: 6px 12px;" onclick="navigate('predictor')">View All ↗</button>
        </div>
        <div id="dashboard-markets-preview">
          ${renderMarketSkeletonGrid(2)}
        </div>
      </div>

      <div>
        <div class="panel" id="dash-boardroom-panel" style="background: linear-gradient(145deg, #102640, #0b1a2d); color: #fff; border: none;">
          <div class="eyebrow" style="color: #38bdf8;">STRATEGY ARENA</div>
          <h2 style="color: #fff; margin: 8px 0;">The Boardroom</h2>
          <p style="color: #cbd5e1; font-size: 13.5px; margin-bottom: 18px;">
            Face sealed executive dilemmas under timed conditions with comprehensive strategy adjudication.
          </p>
          <button class="btn btn-primary" onclick="navigate('boardroom')">Enter Strategy Lobby ↗</button>
        </div>

        <div class="panel" id="dash-learning-desk">
          <h2>Quick Learning Desk</h2>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button class="btn btn-secondary btn-full" style="justify-content: flex-start;" onclick="navigate('mentor')">
              <span>✧</span> <b>Ask AI Mentor</b>: Monetary policy & runway
            </button>
            ${isLabEnabled ? `
            <button class="btn btn-secondary btn-full" style="justify-content: flex-start;" onclick="navigate('lab')">
              <span>⚗</span> <b>Scenario Lab</b>: Test interest rate shocks
            </button>
            ` : ''}
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

    <div id="predictor-filter-bar" style="display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;">
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
        <p>Compete on real-world business dilemmas, submit executive strategy memos, and receive authoritative executive evaluations.</p>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-secondary" onclick="openExpertScenarioSubmissionModal()" style="font-size: 13px; font-weight: 600;">+ Contribute Case 🎓</button>
        <button class="btn btn-primary" onclick="navigate('create_challenge')">+ Create Challenge ↗</button>
      </div>
    </div>

    ${renderPushPromptBanner()}

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
              ${renderCreateIndustryOptions()}
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
              <option value="45">45 Minutes</option>
              <option value="60">60 Minutes</option>
            </select>
          </div>
          <div class="form-group" style="margin-top: 12px;">
            <label>Scheduled Match Start Time</label>
            <select class="select" id="create-scheduled-offset" onchange="toggleCustomScheduleInput(this.value)">
              <option value="10">In 10 Minutes (Recommended)</option>
              <option value="15">In 15 Minutes</option>
              <option value="30">In 30 Minutes</option>
              <option value="60">In 1 Hour</option>
              <option value="custom">Custom Date & Time...</option>
            </select>
            <div id="custom-schedule-wrap" style="display: none; margin-top: 8px;">
              <input type="datetime-local" class="input" id="create-scheduled-custom">
            </div>
            <small style="color: var(--muted);">Fixed start time. The confidential dilemma unlocks simultaneously for both participants when this timer hits zero.</small>
          </div>
          <button type="submit" id="btn-publish-challenge" class="btn btn-primary btn-full" style="margin-top: 14px;">Publish Challenge to Lobby ↗</button>
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

    <div class="metrics-row" id="wallet-metrics-summary">
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
      <div class="two-col" id="wallet-actions-panel" style="margin-bottom: 24px;">
        
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
                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; color: var(--text); font-weight: 500;">
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
      <div class="two-col" id="wallet-actions-panel" style="margin-bottom: 24px;">
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
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; margin-bottom: 14px;">
        <div>
          <div class="eyebrow" style="color: var(--jade);">DOUBLE-ENTRY AUDIT TRAIL</div>
          <h2 style="margin: 2px 0 4px;">Account Activity &amp; Transaction History (${currLabel})</h2>
          <p style="color: var(--muted); font-size: 13px; margin: 0;">Audited record of all grants, match commitments, escrow allocations, and contract payouts.</p>
        </div>
      </div>
      <div id="wallet-transactions-table" class="table-responsive">
        ${renderTableSkeleton(4, 4)}
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// Leaderboard View
// -------------------------------------------------------------
function renderLeaderboardTabsHtml() {
  const tabs = [
    { id: 'All', label: 'All' },
    { id: 'Predictor', label: 'Predictor' },
    { id: 'Boardroom', label: 'Boardroom' }
  ];
  const activeTab = (state.leaderboardTab || 'All').toLowerCase();

  return tabs.map(t => {
    const isActive = activeTab === t.id.toLowerCase();
    return `
      <button type="button" 
              class="btn ${isActive ? 'btn-primary' : 'btn-secondary'}" 
              id="tab-btn-${t.id.toLowerCase()}"
              style="padding: 7px 18px; font-size: 13px; font-weight: 600; border-radius: 20px; cursor: pointer; transition: all 0.2s ease; ${isActive ? 'box-shadow: 0 2px 8px rgba(36,121,101,0.25); border-color: var(--jade);' : ''}" 
              onclick="loadLeaderboardData('${t.id}')">
        ${t.id === 'All' ? '🌐 All' : (t.id === 'Predictor' ? '📈 Predictor' : '🏛️ Boardroom')}
      </button>
    `;
  }).join('');
}

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

    <div id="leaderboard-tabs-bar" style="display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;">
      ${renderLeaderboardTabsHtml()}
    </div>

    <div class="panel">
      <div class="table-responsive">
        <table style="width: 100%; min-width: 460px; border-collapse: collapse; text-align: left; font-size: 14px; white-space: nowrap;">
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
          <button type="button" class="btn btn-secondary" onclick="toggleMentorVoice()" id="btn-mentor-voice" style="padding: 0 12px; font-size: 15px;" title="Speak question in Nigerian English">🎙️</button>
          <button type="submit" class="btn btn-primary" style="white-space: nowrap;">Ask Mentor ↗</button>
        </form>
      </div>

      <div class="panel" id="mentor-quick-prompts">
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
  const supplyColor = (res.supply_chain_stress || 65) > 70 ? 'var(--red)' : ((res.supply_chain_stress || 65) > 50 ? 'var(--orange)' : 'var(--jade)');
  const corpColor = (res.corporate_health || 55) < 45 ? 'var(--red)' : ((res.corporate_health || 55) < 65 ? 'var(--orange)' : 'var(--jade)');

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

  // Ensure an active scenario is resolved if presets are loaded
  let selectedSc = (lab.scenarios || []).find(s => s.id === lab.selectedScenarioId) || null;
  if (!selectedSc && lab.scenarios && lab.scenarios.length > 0) {
    selectedSc = lab.scenarios[0];
    lab.selectedScenarioId = selectedSc.id;
    lab.selectedScenario = selectedSc;
    if (selectedSc.default_params && (!lab.params || Object.keys(lab.params).length === 0)) {
      lab.params = { ...selectedSc.default_params };
    }
  }
  const hasScenario = !!selectedSc;

  // Derive primary shock drivers for the active scenario
  const scTitle = (selectedSc?.title || '').toLowerCase();
  const scDesc = (selectedSc?.description || '').toLowerCase();
  const driverKeys = new Set();
  if (scTitle.includes('mpr') || scTitle.includes('tighten') || scTitle.includes('interest')) {
    driverKeys.add('mpr'); driverKeys.add('crr');
  }
  if (scTitle.includes('currency') || scTitle.includes('float') || scTitle.includes('fx') || scTitle.includes('devaluation') || scDesc.includes('fx')) {
    driverKeys.add('fx_rate'); driverKeys.add('inflation');
  }
  if (scTitle.includes('petrol') || scTitle.includes('fuel') || scTitle.includes('subsidy') || scTitle.includes('tariff') || scTitle.includes('diesel') || scDesc.includes('fuel')) {
    driverKeys.add('fuel_price'); driverKeys.add('inflation');
  }
  if (scTitle.includes('debt') || scTitle.includes('yield') || scTitle.includes('fiscal') || scTitle.includes('issuance') || scDesc.includes('debt')) {
    driverKeys.add('spend_impulse'); driverKeys.add('mpr');
  }
  if (driverKeys.size === 0) {
    driverKeys.add('mpr'); driverKeys.add('fx_rate');
  }

  return `
    <div class="page-head" style="margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
        <div>
          <div class="eyebrow">MULTIVARIATE ECONOMIC & INDUSTRY SIMULATION LAB</div>
          <h1 style="margin: 2px 0 6px;">Scenario Lab</h1>
          <p style="margin: 0; font-size: 13.5px; color: var(--muted); max-width: 800px;">
            Calibrate empirical policy levers, test supply & demand shocks, and observe real-time equilibrium transmission across sectors.
          </p>
        </div>
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="openExpertScenarioSubmissionModal()" style="font-size: 11.5px; padding: 5px 11px; font-weight: 600;">
            <span>🎓</span> + Contribute Scenario
          </button>
          <span class="badge" style="font-size: 11px; padding: 6px 12px; background: rgba(36,121,101,0.12); color: var(--jade); font-weight: 700; border: 1px solid rgba(36,121,101,0.25);">
            ⚡ Live Empirical Engine Active
          </span>
        </div>
      </div>
    </div>

    <!-- Industry Selector Pills -->
    <div class="lab-industry-pills" id="lab-industry-pills-bar" style="margin-bottom: 14px;">
      ${indList.map(ind => `
        <button type="button" class="lab-industry-pill ${lab.selectedIndustry === ind.slug ? 'active' : ''}" onclick="selectLabIndustry('${ind.slug}')">
          <span>${ind.icon || '📊'}</span>
          <span>${ind.name}</span>
        </button>
      `).join('')}
    </div>

    <!-- Crisis & Policy Scenarios Compact Selector Ribbon -->
    <div id="lab-scenario-presets-bar" style="background: var(--card-bg); border: 1px solid var(--line); border-radius: 10px; padding: 12px 16px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="eyebrow" style="color: var(--navy); margin: 0;">CRISIS & POLICY SCENARIO PRESETS</span>
          <span style="font-size: 11px; color: var(--muted);">${(lab.scenarios || []).length} available in ${currentInd.name}</span>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-toggle-ai-box" style="font-size: 11px; padding: 4px 10px;" onclick="toggleLabAiBox()">
          <span>${lab.isAiBoxOpen ? '✕ Close Scenario Generator' : '✨ Custom Dilemma Shock'}</span>
        </button>
      </div>

      <div class="lab-scenarios-compact">
        ${(lab.scenarios && lab.scenarios.length > 0) ? lab.scenarios.map(sc => `
          <button type="button" class="lab-scenario-chip ${lab.selectedScenarioId === sc.id ? 'active' : ''}" onclick="selectLabScenario('${sc.id}')">
            <span>⚡</span>
            <span>${sc.title}</span>
            ${lab.selectedScenarioId === sc.id ? '<span class="badge badge-enabled" style="font-size: 9px; padding: 1px 5px; margin-left: 4px;">ACTIVE</span>' : ''}
          </button>
        `).join('') : '<div class="muted" style="font-size: 12px; padding: 4px 0;"><span class="spinner" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-right: 6px;"></span>Loading sector presets...</div>'}
      </div>

      <!-- Collapsible Custom Scenario Prompt Box -->
      <div id="lab-ai-box" style="display: ${lab.isAiBoxOpen ? 'block' : 'none'}; margin-top: 12px; padding-top: 10px; border-top: 1px dashed var(--line);">
        <form onsubmit="handleGenerateAiScenario(event)">
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <input class="input" id="lab-ai-prompt" placeholder="E.g., Crude drops to $50, FX hits ₦2,200, fuel surges 30%..." style="font-size: 12.5px; flex: 1; min-width: 0; width: 100%;" required>
            <button type="submit" class="btn btn-secondary" style="white-space: nowrap;" id="btn-gen-ai-scenario">
              ${lab.isAiGenLoading ? 'Generating...' : 'Synthesize Custom Shock'}
            </button>
          </div>
          <small style="color: var(--muted); font-size: 11px; display: block; margin-top: 4px;">Synthesizes a calibrated macroeconomic scenario on demand.</small>
        </form>
      </div>
    </div>

    <!-- Main Multivariate Simulation Grid -->
    <div class="two-col" style="align-items: flex-start; gap: 24px;">
      
      <!-- Left Column: Levers & Direct Real-Time Telemetry HUD -->
      <div style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Macroeconomic Levers (Anchored to Selected Scenario) -->
        <div class="panel" id="lab-levers-panel">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
            <div>
              <div class="eyebrow" style="color: var(--jade);">CALIBRATE LEVERS</div>
              <h2 style="font-size: 16px; margin: 2px 0 0;">Macroeconomic & Industry Policy Controls</h2>
            </div>
            ${hasScenario ? `
              <button class="btn btn-secondary btn-sm" style="font-size: 11.5px; padding: 4px 10px;" onclick="resetLabParameters()" title="Reset levers to scenario baseline">↺ Reset Scenario Levers</button>
            ` : ''}
          </div>

          ${hasScenario ? `
            <!-- Active Scenario Specification Header Card (Anchors Levers directly to the Scenario) -->
            <div style="background: rgba(36, 121, 101, 0.08); border: 1.5px solid rgba(36, 121, 101, 0.25); border-radius: 8px; padding: 12px 14px; margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="badge badge-enabled" style="font-size: 10px; font-weight: 800; letter-spacing: 0.5px;">ACTIVE BASELINE SCENARIO</span>
                  <b style="font-size: 14px; color: var(--navy);">${selectedSc.title}</b>
                </div>
                <span class="badge" style="font-size: 10px; text-transform: uppercase;">${currentInd.name}</span>
              </div>
              <div style="font-size: 12.5px; color: var(--muted); line-height: 1.45;">
                ${selectedSc.description || ''}
              </div>
              ${selectedSc.core_dilemma ? `
                <div style="font-size: 12px; color: var(--navy); margin-top: 8px; padding-top: 6px; border-top: 1px dashed rgba(36,121,101,0.2); font-weight: 600;">
                  <span style="color: var(--jade); font-weight: 700;">Executive Dilemma:</span> ${selectedSc.core_dilemma}
                </div>
              ` : ''}

              <!-- Primary Scenario Drivers & Macro Levers Explainer -->
              <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed rgba(36,121,101,0.25); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                <div style="font-size: 11.5px; color: var(--navy); display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                  <b>Primary Shock Drivers:</b>
                  ${Array.from(driverKeys).map(k => {
                    const labelMap = { mpr: 'MPR Interest', inflation: 'Inflation (CPI)', fx_rate: 'FX Rate', fuel_price: 'Fuel Price', crr: 'CRR Cash Reserve', spend_impulse: 'Fiscal Spend' };
                    return `<span class="scenario-driver-badge">⚡ ${labelMap[k] || k.toUpperCase()}</span>`;
                  }).join('')}
                </div>
                <div style="font-size: 11px; color: var(--muted);">
                  💡 All 6 dials connect the macroeconomy; drivers indicate primary shock origin.
                </div>
              </div>
            </div>
          ` : `
            <!-- Scenario Selection Required Banner -->
            <div style="background: rgba(220, 38, 38, 0.06); border: 1.5px dashed rgba(220, 38, 38, 0.35); border-radius: 8px; padding: 14px 16px; margin-bottom: 14px; text-align: center;">
              <div style="font-size: 13.5px; font-weight: 700; color: var(--navy); margin-bottom: 4px;">
                🔒 Scenario Selection Required to Unlock Levers
              </div>
              <p style="font-size: 12px; color: var(--muted); margin: 0 auto; max-width: 480px; line-height: 1.5;">
                Please select a crisis or policy scenario preset above. Calibrating levers tests empirical transmission channels against that specific baseline scenario.
              </p>
            </div>
          `}

          <!-- Synchronized Live Telemetry HUD Strip (Changes in real-time as sliders drag) -->
          <div class="lab-live-hud-strip" id="lab-live-telemetry-hud">
            <div class="lab-hud-metric">
              <span class="lab-hud-metric-label">12M Inflation <button type="button" class="term-help-btn" onclick="showTermExplanation('projected_inflation')" title="What is 12M Inflation?">?</button></span>
              <span class="lab-hud-metric-value" id="hud-val-inf" style="color: ${hasScenario ? infColor : 'var(--muted)'};">${hasScenario ? `${res.projected_inflation}%` : '--'}</span>
            </div>
            <div class="lab-hud-metric">
              <span class="lab-hud-metric-label">Credit Impulse <button type="button" class="term-help-btn" onclick="showTermExplanation('credit_impulse')" title="What is Credit Impulse?">?</button></span>
              <span class="lab-hud-metric-value" id="hud-val-credit" style="color: ${hasScenario ? creditColor : 'var(--muted)'};">${hasScenario ? `${res.credit_impulse} / 100` : '--'}</span>
            </div>
            <div class="lab-hud-metric">
              <span class="lab-hud-metric-label">Logistics Strain <button type="button" class="term-help-btn" onclick="showTermExplanation('supply_chain_stress')" title="What is Logistics Strain?">?</button></span>
              <span class="lab-hud-metric-value" id="hud-val-supply" style="color: ${hasScenario ? supplyColor : 'var(--muted)'};">${hasScenario ? `${res.supply_chain_stress || 65} / 100` : '--'}</span>
            </div>
            <div class="lab-hud-metric">
              <span class="lab-hud-metric-label">Listed Solvency <button type="button" class="term-help-btn" onclick="showTermExplanation('corporate_health')" title="What is Listed Solvency?">?</button></span>
              <span class="lab-hud-metric-value" id="hud-val-corp" style="color: ${hasScenario ? corpColor : 'var(--muted)'};">${hasScenario ? `${res.corporate_health || 55} / 100` : '--'}</span>
            </div>
            <div class="lab-hud-metric">
              <span class="lab-hud-metric-label">Gross Margin <button type="button" class="term-help-btn" onclick="showTermExplanation('margin_stress')" title="What is Gross Margin Delta?">?</button></span>
              <span class="lab-hud-metric-value" id="hud-val-margin" style="color: ${hasScenario ? marginColor : 'var(--muted)'};">${hasScenario ? `${res.margin_stress > 0 ? '+' : ''}${res.margin_stress}%` : '--'}</span>
            </div>
          </div>

          <!-- Lever 1: MPR -->
          ${renderLeverBox('mpr', 'Monetary Policy Rate (MPR)', p.mpr ?? 27.25, 5, 35, 0.25, '%', '5% Accommodative', '35% Restrictive', defs.mpr, !hasScenario, selectedSc && selectedSc.default_params ? selectedSc.default_params.mpr : null, driverKeys.has('mpr'))}

          <!-- Lever 2: Inflation -->
          ${renderLeverBox('inflation', 'Headline Inflation (CPI)', p.inflation ?? 32.5, 2, 50, 0.5, '%', '2% Single Digit', '50% Hyperinflationary', defs.inflation, !hasScenario, selectedSc && selectedSc.default_params ? selectedSc.default_params.inflation : null, driverKeys.has('inflation'))}

          <!-- Lever 3: FX Rate -->
          ${renderLeverBox('fx_rate', 'Exchange Rate (USD/NGN)', p.fx_rate ?? 1650, 700, 2500, 25, '₦/$', '₦700 Overvalued', '₦2,500 Devaluation', defs.fx_rate, !hasScenario, selectedSc && selectedSc.default_params ? selectedSc.default_params.fx_rate : null, driverKeys.has('fx_rate'))}

          <!-- Lever 4: Fuel Price -->
          ${renderLeverBox('fuel_price', 'Industrial Fuel & Pump Price', p.fuel_price ?? 1050, 500, 2000, 25, '₦/L', '₦500 Subsidized', '₦2,000 Deregulated', defs.fuel_price, !hasScenario, selectedSc && selectedSc.default_params ? selectedSc.default_params.fuel_price : null, driverKeys.has('fuel_price'))}

          <!-- Lever 5: CRR -->
          ${renderLeverBox('crr', 'Cash Reserve Requirement (CRR)', p.crr ?? 45.0, 10, 60, 1.0, '%', '10% High Liquidity', '60% Ultra Tight', defs.crr, !hasScenario, selectedSc && selectedSc.default_params ? selectedSc.default_params.crr : null, driverKeys.has('crr'))}

          <!-- Lever 6: Spend Impulse -->
          ${renderLeverBox('spend_impulse', 'Fiscal Spending / Deficit Impulse', p.spend_impulse ?? 14.0, 1, 25, 0.5, '% GDP', '1% Austerity', '25% Expansionary', defs.spend_impulse, !hasScenario, selectedSc && selectedSc.default_params ? selectedSc.default_params.spend_impulse : null, driverKeys.has('spend_impulse'))}

        </div>

      </div>

      <!-- Right Column: Equilibrium Gauges, Corporate Radar & Executive Briefing (Sticky Desktop Viewport) -->
      <div class="lab-sticky-right" style="display: flex; flex-direction: column; gap: 20px;">
        
        <!-- Live Gauges Panel -->
        <div class="panel" id="lab-gauges-panel">
          <div class="eyebrow" style="color: var(--jade);">LIVE EQUILIBRIUM PROJECTIONS</div>
          <h2 style="font-size: 16px; margin: 4px 0 16px;">Transmission Gauges & Stress Indices</h2>

          <!-- Gauge 1: Projected Inflation -->
          <div class="lab-gauge-card">
            <div class="lab-gauge-header">
              <span style="font-size: 13px; font-weight: 600;">Projected 12M Inflation Trajectory <button type="button" class="term-help-btn" onclick="showTermExplanation('projected_inflation')" title="What is Projected Inflation?">?</button></span>
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
              <span style="font-size: 13px; font-weight: 600;">Real Sector Credit Impulse Index <button type="button" class="term-help-btn" onclick="showTermExplanation('credit_impulse')" title="What is Credit Impulse?">?</button></span>
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
              <span style="font-size: 13px; font-weight: 600;">Private Investment & CapEx Sentiment <button type="button" class="term-help-btn" onclick="showTermExplanation('investment_index')" title="What is Investment Sentiment?">?</button></span>
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
              <span style="font-size: 13px; font-weight: 600;">Consumer Purchasing Power Index <button type="button" class="term-help-btn" onclick="showTermExplanation('purchasing_power')" title="What is Purchasing Power?">?</button></span>
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
              <span style="font-size: 13px; font-weight: 600;">Sovereign Debt Service-to-Revenue <button type="button" class="term-help-btn" onclick="showTermExplanation('debt_service_burden')" title="What is Debt Service Burden?">?</button></span>
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
              <span style="font-size: 13px; font-weight: 600;">Sector Gross Margin Delta <button type="button" class="term-help-btn" onclick="showTermExplanation('margin_stress')" title="What is Sector Gross Margin Delta?">?</button></span>
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
              <span style="font-size: 13px; font-weight: 600;">Supply Chain & Logistics Disruption Strain <button type="button" class="term-help-btn" onclick="showTermExplanation('supply_chain_stress')" title="What is Logistics Strain?">?</button></span>
              <span class="lab-val-badge" id="gauge-val-supply" style="color: ${supplyColor}; font-size: 16px;">${res.supply_chain_stress || 65} / 100</span>
            </div>
            <div class="lab-gauge-bar">
              <div class="lab-gauge-fill" id="gauge-bar-supply" style="width: ${res.supply_chain_stress || 65}%; background: ${supplyColor};"></div>
            </div>
            <small id="gauge-sub-supply" style="font-size: 11.5px; color: var(--muted);">
              ${(res.supply_chain_stress || 65) > 70 ? 'Port congestion, demurrage fees, and diesel haulage costs severely squeezing inventory velocity' : 'Manageable transport corridors and warehouse turnover'}
            </small>
          </div>

          <!-- Gauge 8: NGX Listed Corporate Health & Solvency -->
          <div class="lab-gauge-card">
            <div class="lab-gauge-header">
              <span style="font-size: 13px; font-weight: 600;">NGX Listed Corporate Solvency & Earnings Index <button type="button" class="term-help-btn" onclick="showTermExplanation('corporate_health')" title="What is Corporate Solvency Index?">?</button></span>
              <span class="lab-val-badge" id="gauge-val-corp" style="color: ${corpColor}; font-size: 16px;">${res.corporate_health || 55} / 100</span>
            </div>
            <div class="lab-gauge-bar">
              <div class="lab-gauge-fill" id="gauge-bar-corp" style="width: ${res.corporate_health || 55}%; background: ${corpColor};"></div>
            </div>
            <small id="gauge-sub-corp" style="font-size: 11.5px; color: var(--muted);">
              ${(res.corporate_health || 55) < 45 ? 'Elevated unhedged FX balance sheet losses and 30%+ commercial loan servicing strains' : 'Stable debt service coverage ratios and pricing power across listed public firms'}
            </small>
          </div>

          <!-- Gauge 9: Sovereign FX Reserve Pressure -->
          <div style="background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <span style="font-size: 13px; font-weight: 600;">Sovereign FX Buffer Status: <button type="button" class="term-help-btn" onclick="showTermExplanation('fx_pressure')" title="What is Sovereign FX Pressure?">?</button></span>
            <span id="gauge-val-fxp" class="badge ${res.fx_pressure === 'Critical Alert' ? 'badge-sandbox' : 'badge-enabled'}" style="${res.fx_pressure === 'Critical Alert' ? 'background: #f87171; color: #fff;' : ''}">${res.fx_pressure}</span>
          </div>
        </div>

        <!-- Public Listed Equities Transmission Radar (NGX & African Bourses) -->
        <div class="panel" id="lab-corporate-radar-panel">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
            <div>
              <div class="eyebrow" style="color: var(--jade);">PUBLIC CORPORATE RADAR</div>
              <h2 style="font-size: 16px; margin: 2px 0 0;">Public Equities & Supply Chain Transmission</h2>
            </div>
            <span class="badge" style="font-size: 10.5px; font-weight: 700; background: rgba(36,121,101,0.12); color: var(--jade); border: 1px solid rgba(36,121,101,0.25);">
              NGX & African Bourses (20 Blue-Chips)
            </span>
          </div>
          <p style="font-size: 12px; color: var(--muted); margin-bottom: 12px;">
            Real-time sensitivity radar evaluating how currently dialed policy rates, diesel fuel, and currency levels permeate listed corporate earnings and supply chains.
          </p>

          <div style="display: flex; gap: 8px; margin-bottom: 12px; align-items: center;">
            <input type="text" id="lab-radar-search" class="input" placeholder="🔍 Search tickers (e.g. DANGCEM, MTNN, SEPLAT)..." style="font-size: 12px; padding: 6px 10px; flex: 1;" oninput="filterLabRadarList(this.value)" value="${state.lab.radarFilterQuery || ''}">
            ${state.lab.radarFilterQuery ? `<button class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 5px 8px;" onclick="clearLabRadarFilter()">✕ Clear</button>` : ''}
          </div>

          <div id="lab-corporate-radar-container" style="display: flex; flex-direction: column; gap: 10px; max-height: 520px; overflow-y: auto; padding-right: 4px;">
            ${renderCorporateRadarList(res.listed_corporate_radar, state.lab.radarFilterQuery || '')}
          </div>
        </div>

        <!-- Executive Masterclass Policy Briefing Panel -->
        <div class="panel">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div class="eyebrow" style="color: var(--navy);">STRATEGIC POLICY EVALUATION</div>
            <span class="badge" style="background: rgba(36,121,101,0.12); color: var(--jade);">Executive Adjudication</span>
          </div>
          <h2 style="font-size: 16px; margin: 0 0 8px;">Executive Masterclass Policy Briefing</h2>
          <p style="font-size: 12.5px; color: var(--muted); margin-bottom: 16px;">
            Dispatch current macroeconomic equilibrium parameters to the econometric stress engine to produce a comprehensive 5-part executive strategy dossier.
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

    <!-- Mobile Floating Telemetry HUD (Always visible on mobile without scrolling) -->
    <div class="lab-mobile-floating-hud" id="lab-mobile-hud">
      <div style="font-size: 11px; display: flex; flex-direction: column; align-items: center;">
        <span style="opacity: 0.7; font-size: 9px; text-transform: uppercase;">Inflation</span>
        <b id="mob-hud-inf" style="color: ${infColor}; font-size: 13px;">${res.projected_inflation}%</b>
      </div>
      <div style="font-size: 11px; display: flex; flex-direction: column; align-items: center;">
        <span style="opacity: 0.7; font-size: 9px; text-transform: uppercase;">Credit</span>
        <b id="mob-hud-credit" style="color: ${creditColor}; font-size: 13px;">${res.credit_impulse}</b>
      </div>
      <div style="font-size: 11px; display: flex; flex-direction: column; align-items: center;">
        <span style="opacity: 0.7; font-size: 9px; text-transform: uppercase;">Logistics</span>
        <b id="mob-hud-supply" style="color: ${supplyColor}; font-size: 13px;">${res.supply_chain_stress || 65}</b>
      </div>
      <div style="font-size: 11px; display: flex; flex-direction: column; align-items: center;">
        <span style="opacity: 0.7; font-size: 9px; text-transform: uppercase;">Margin</span>
        <b id="mob-hud-margin" style="color: ${marginColor}; font-size: 13px;">${res.margin_stress > 0 ? '+' : ''}${res.margin_stress}%</b>
      </div>
    </div>
  `;
}

function renderLeverBox(key, name, value, min, max, step, unit, minLabel, maxLabel, def, disabled = false, baselineVal = null, isDriver = false) {
  const isOpen = !!(state.lab && state.lab.openPrimers && state.lab.openPrimers[key]);
  const formattedVal = formatLabParamVal(key, value);
  const formattedBaseline = baselineVal !== null && baselineVal !== undefined ? formatLabParamVal(key, baselineVal) : null;

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
    <div class="lab-lever-box" style="${disabled ? 'opacity: 0.55;' : ''}">
      <div class="lab-lever-header">
        <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
          <label for="lab-slider-${key}" style="font-weight: 600; font-size: 13.5px; margin: 0; ${disabled ? 'cursor: not-allowed;' : 'cursor: pointer;'}">
            ${name} ${disabled ? '<span style="font-size: 11px; color: var(--muted); font-weight: normal;">(Locked)</span>' : ''}
          </label>
          <button type="button" class="term-help-btn" onclick="showTermExplanation('${key}')" title="What does ${name} mean in plain English?">?</button>
          ${isDriver ? '<span class="scenario-driver-badge" title="This lever is the primary shock driver for the active scenario">⚡ Scenario Driver</span>' : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          ${formattedBaseline && !disabled ? `<span style="font-size: 11px; color: var(--muted);" title="Scenario baseline starting value">Base: ${formattedBaseline}</span>` : ''}
          <span class="lab-val-badge" id="lab-val-${key}">${disabled ? '--' : formattedVal}</span>
        </div>
      </div>
      <input type="range" class="input" id="lab-slider-${key}" min="${min}" max="${max}" step="${step}" value="${value}" oninput="updateLabSlider('${key}', this.value)" style="width: 100%; ${disabled ? 'cursor: not-allowed;' : 'cursor: pointer;'}" ${disabled ? 'disabled' : ''}>
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
        Adjust the levers to configure your macroeconomic stress scenario, then click <b>Generate Executive Masterclass Briefing</b> to receive an authoritative executive policy evaluation.
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
    const storedEmail = sessionStorage.getItem('verify_email') || '';
    const storedCode = sessionStorage.getItem('verify_code_preview') || '';

    fieldsHtml = `
      ${storedCode ? `
        <div id="verify-preview-badge" style="background: rgba(36,121,101,0.08); border: 1.5px dashed var(--jade); border-radius: 8px; padding: 12px 14px; text-align: center; margin-bottom: 16px; cursor: pointer;" onclick="autoFillVerifyCode('${storedCode}')" title="Click to auto-fill code">
          <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--jade); display: block; margin-bottom: 4px; letter-spacing: 0.5px;">Account Verification Code</span>
          <div style="font-family: var(--font-mono, monospace); font-size: 28px; font-weight: 800; letter-spacing: 6px; color: var(--text);">${storedCode}</div>
          <small style="display: block; font-size: 11px; color: var(--muted); margin-top: 4px;">Click here to auto-fill this code into the box below</small>
        </div>
      ` : ''}
      <div class="form-group">
        <label>Email address</label>
        <input class="input" type="email" id="auth-email" value="${escapeHtml(storedEmail)}" placeholder="you@example.com" required>
      </div>
      <div class="form-group">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
          <label style="margin: 0;">6-Digit Verification Code</label>
          <button type="button" id="btn-resend-code" class="btn-link" style="font-size: 11.5px; color: var(--jade); background: none; border: none; cursor: pointer; padding: 0; font-weight: 600;" onclick="handleResendCode()">
            Resend Code
          </button>
        </div>
        <input class="input" id="auth-code" maxlength="6" value="${storedCode || ''}" placeholder="123456" style="letter-spacing: 4px; font-size: 18px; text-align: center; font-family: var(--font-mono, monospace);" required>
      </div>
      <button type="submit" class="btn btn-primary btn-full" style="margin-top: 10px;">Verify & Continue ↗</button>
      <div style="text-align: center; margin-top: 12px;">
        <span style="font-size: 11.5px; color: var(--muted);">Didn't receive email? Check spam folder or click <b>Resend Code</b> above.</span>
      </div>
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
          Forecast economic contracts, solve business dilemmas in the Boardroom, and sharpen your strategic thinking with executive adjudication.
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
  updatePwaInstallButtons();
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
  } else if (state.page === 'create_challenge') {
    loadCreateChallengeData();
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
  // Stale-While-Revalidate: render cached markets immediately for instant UI response
  if (state.markets && state.markets.length > 0) {
    renderMarketsFiltered();
  } else if (el) {
    el.innerHTML = renderMarketSkeletonGrid(4);
  }

  try {
    const res = await api.get('/markets');
    if (res?.data) {
      state.markets = res.data;
      renderMarketsFiltered();
    }
  } catch (e) {}
}

function normalizeSectorName(name) {
  if (!name) return '';
  const s = name.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
  if (s.includes('monetary') || s.includes('cbn') || s.includes('interest')) return 'monetary-policy';
  if (s.includes('equit') || s.includes('capitalmarket') || s.includes('stock') || s.includes('ngx')) return 'equities';
  if (s.includes('energy') || s.includes('oil') || s.includes('gas') || s.includes('power') || s.includes('crude')) return 'energy';
  if (s.includes('agri') || s.includes('farm') || s.includes('food')) return 'agriculture';
  if (s.includes('fx') || s.includes('reserve') || s.includes('forex') || s.includes('currency') || s.includes('dollar')) return 'fx-reserves';
  if (s.includes('fintech') || s.includes('bank') || s.includes('payment')) return 'fintech';
  if (s.includes('manuf') || s.includes('industrial') || s.includes('cement')) return 'manufacturing';
  if (s.includes('telecom') || s.includes('digital') || s.includes('tech')) return 'telecoms';
  if (s.includes('realestate') || s.includes('infra') || s.includes('property')) return 'real-estate';
  if (s.includes('fmcg') || s.includes('retail') || s.includes('consumer')) return 'fmcg';
  if (s.includes('aviat') || s.includes('logist') || s.includes('freight') || s.includes('transport')) return 'aviation-logistics';
  return s;
}

function renderMarketsFiltered() {
  const el = document.getElementById('markets-container');
  if (!el) return;

  const rawFilter = state.marketFilter || 'All';
  const normFilter = normalizeSectorName(rawFilter);

  const filtered = (rawFilter.toLowerCase() === 'all' || !normFilter)
    ? state.markets
    : state.markets.filter(m => {
        const mNorm = normalizeSectorName(m.industry_name) || normalizeSectorName(m.industry_slug);
        return mNorm === normFilter;
      });

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
            <div class="theses-grid">
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
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                  <label style="margin-bottom: 0;">Decision Journal Thesis (Builds Strategic Record &amp; XP)</label>
                  <button type="button" class="btn btn-secondary" onclick="toggleThesisVoice()" id="btn-thesis-voice" style="padding: 2px 8px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px;" title="Speak thesis in Nigerian English">
                    <span>🎙️</span> <span>Voice</span>
                  </button>
                </div>
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

  const btn = e.submitter || e.target?.querySelector('button[type="submit"]');
  const origText = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Placing...'; }

  try {
    const res = await api.post(`/markets/${eventId}/forecast`, {
      outcome: chosenOutcome,
      amount: amt,
      thesis,
      mode: currentMode,
    });
    api.toast(res.message || 'Forecast recorded successfully!', 'success');
    sendSystemNotification(
      'Forecast Position Placed',
      `Allocated ₦${amt.toLocaleString()} on ${chosenOutcome.toUpperCase()} in ${currentMode.toUpperCase()} mode.`,
      'predictor',
      eventId,
      'market'
    );
    await loadWalletData();
    navigate('predictor');
  } catch (err) {
    if (btn) { btn.disabled = false; btn.innerHTML = origText; }
  }
}

function renderCreateIndustryOptions() {
  if (state.boardroomIndustries && state.boardroomIndustries.length > 0) {
    return state.boardroomIndustries.map(i => `<option value="${i.id}">${escapeHtml(i.name)}</option>`).join('');
  }
  return `
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
  `;
}

function toggleCustomScheduleInput(val) {
  const wrap = document.getElementById('custom-schedule-wrap');
  const input = document.getElementById('create-scheduled-custom');
  if (wrap) {
    wrap.style.display = (val === 'custom') ? 'block' : 'none';
  }
  if (input && val === 'custom') {
    const futureDate = new Date(Date.now() + 15 * 60 * 1000);
    const yr = futureDate.getFullYear();
    const mo = String(futureDate.getMonth() + 1).padStart(2, '0');
    const da = String(futureDate.getDate()).padStart(2, '0');
    const hr = String(futureDate.getHours()).padStart(2, '0');
    const mi = String(futureDate.getMinutes()).padStart(2, '0');
    const isoLocal = `${yr}-${mo}-${da}T${hr}:${mi}`;
    if (!input.value) {
      input.value = isoLocal;
    }
    input.min = isoLocal;
  }
}
window.toggleCustomScheduleInput = toggleCustomScheduleInput;

async function loadCreateChallengeData() {
  try {
    const res = await api.get('/boardroom/industries');
    if (res?.data && res.data.length > 0) {
      state.boardroomIndustries = res.data;
      const selectEl = document.getElementById('create-industry');
      if (selectEl) {
        const curVal = selectEl.value;
        selectEl.innerHTML = res.data.map(i => `<option value="${i.id}">${escapeHtml(i.name)}</option>`).join('');
        if (curVal && selectEl.querySelector(`option[value="${curVal}"]`)) {
          selectEl.value = curVal;
        }
      }
    }
  } catch (e) {}
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

    el.innerHTML = res.data.map(c => {
      const isScheduledFuture = (c.seconds_until_start || 0) > 0;
      const minsLeft = Math.ceil((c.seconds_until_start || 0) / 60);

      // Timezone-accurate local scheduled time display
      const scheduledIso = c.scheduled_at_iso || (c.scheduled_at ? c.scheduled_at.replace(' ', 'T') + 'Z' : null);
      const scheduledDate = parseUtcDate(scheduledIso || c.scheduled_at);
      const localTimeStr = scheduledDate ? scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Soon';
      const userTz = getUserTimezoneLabel();

      // Detect if current user created this challenge or is already participant
      const isCurrentUserHost = Boolean(c.is_host || (state.user && (state.user.id === c.host_id || state.user.display_name === c.host)));
      const isCurrentUserOpponent = Boolean(c.is_opponent || (state.user && state.user.id === c.opponent_id));
      const isUserParticipant = isCurrentUserHost || isCurrentUserOpponent;

      let actionBtn = '';
      if (isUserParticipant) {
        const targetPage = (c.state === 'live') ? 'live_challenge' : 'waiting_room';
        const label = isCurrentUserHost 
          ? (c.state === 'live' ? 'Resume Strategy Match ↗' : 'Enter Your Lounge 🏛️')
          : (c.state === 'live' ? 'Resume Strategy Match ↗' : 'Re-enter Lounge ⏳');
        actionBtn = `
          <button class="btn btn-primary btn-full" style="margin-top: auto; background: var(--jade); border-color: var(--jade); color: #fff; font-weight: 700;" onclick="navigate('${targetPage}', { challengeId: '${c.id}' })">
            ${label}
          </button>
        `;
      } else if (c.has_opponent) {
        actionBtn = `<button class="btn btn-secondary btn-full" style="margin-top: auto; opacity: 0.85;" disabled>Match Locked (Full) 🔒</button>`;
      } else {
        actionBtn = `<button class="btn btn-primary btn-full" style="margin-top: auto;" data-join-id="${c.id}" onclick="handleJoinChallenge('${c.id}', this)">Accept Challenge ↗</button>`;
      }

      return `
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
            <p style="font-size: 11.5px; color: var(--muted); margin-top: 4px;">Unlocks strictly at scheduled match time</p>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 8px 0; font-size: 13px;">
            <span>Host: <b>${c.host}</b> ${isCurrentUserHost ? '<span style="font-size: 10px; color: var(--jade); font-weight: 700;">(You)</span>' : ''}</span>
            <span>Commitment: <b>${formatMoney(c.commitment)} ${c.mode === 'real' ? 'NGN' : 'VNGN'}</b></span>
          </div>
          <div style="font-size: 12px; color: var(--muted); margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; background: var(--bg); padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border);">
            <span>⏰ Match Time:</span>
            <b style="color: ${isScheduledFuture ? 'var(--jade)' : '#fbbf24'};">
              ${localTimeStr} <small style="font-size: 10px; color: var(--muted); font-weight: normal;">(${userTz})</small> (${isScheduledFuture ? `in ${minsLeft}m` : 'Starting Now'})
            </b>
          </div>
          ${actionBtn}
        </div>
      `;
    }).join('');
  } catch (e) {}
}

async function handleCreateChallenge(e) {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }
  const indEl = document.getElementById('create-industry');
  const industryId = indEl ? parseInt(indEl.value, 10) : 1;
  const industryName = indEl?.selectedOptions?.[0]?.textContent?.trim() || '';
  const stake = parseInt(document.getElementById('create-stake')?.value, 10) || 10000;
  const duration = parseInt(document.getElementById('create-duration')?.value, 10) || 15;
  const mode = document.getElementById('create-mode')?.value || 'demo';

  if (stake < 1000) {
    api.toast('Minimum Boardroom commitment is ₦1,000.', 'warning');
    return;
  }

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

  // Calculate scheduled time
  const scheduleOffset = document.getElementById('create-scheduled-offset')?.value || '10';
  let scheduledAt;
  if (scheduleOffset === 'custom') {
    const customVal = document.getElementById('create-scheduled-custom')?.value;
    if (!customVal) {
      api.toast('Please select a custom scheduled date and time.', 'warning');
      return;
    }
    const parsedDate = new Date(customVal);
    if (isNaN(parsedDate.getTime())) {
      api.toast('Invalid date format for custom schedule.', 'warning');
      return;
    }
    if (parsedDate.getTime() < Date.now() + 60 * 1000) {
      api.toast('Scheduled time must be at least 2 minutes in the future.', 'warning');
      return;
    }
    scheduledAt = parsedDate.toISOString();
  } else {
    const offsetMins = parseInt(scheduleOffset, 10) || 10;
    const targetDate = new Date(Date.now() + offsetMins * 60 * 1000);
    scheduledAt = targetDate.toISOString();
  }

  const createBtn = document.getElementById('btn-publish-challenge') || e?.submitter || e?.target?.querySelector('button[type="submit"]') || e?.target;
  const createBtnOrig = createBtn ? createBtn.innerHTML : '';
  if (createBtn) { createBtn.disabled = true; createBtn.innerHTML = '<span class="spinner"></span> Creating...'; }

  try {
    const res = await api.post('/boardroom/create', {
      industry_id: industryId,
      industry_name: industryName,
      stake,
      duration,
      mode,
      scheduled_at: scheduledAt,
    });
    api.toast(res.message || 'Challenge published to lobby!', 'success');
    sendSystemNotification(
      '🏛️ Boardroom Challenge Created',
      `Challenge #${res.data?.challenge_id || ''} scheduled for ${formatLocalTime(scheduledAt)} (${getUserTimezoneLabel()}). Waiting for challenger.`,
      'waiting_room',
      res.data?.challenge_id,
      'boardroom'
    );
    navigate('waiting_room', { challengeId: res.data.challenge_id });
  } catch (err) {
    console.error('Challenge creation error:', err);
    api.toast(err.message || 'Failed to publish challenge. Please try again.', 'error');
    if (createBtn) { createBtn.disabled = false; createBtn.innerHTML = createBtnOrig; }
  }
}
window.handleCreateChallenge = handleCreateChallenge;

async function handleJoinChallenge(challengeId, btnEl) {
  // Spinner + disable — works whether called with a btn ref or via onclick attr
  const btn = btnEl || document.querySelector(`[data-join-id="${challengeId}"]`);
  const origText = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Accepting...'; }

  try {
    const res = await api.post(`/boardroom/join/${challengeId}`);
    if (res.data?.reentered_as === 'host' || res.data?.reentered_as === 'opponent') {
      api.toast(res.data.message || 'Returning to your challenge lounge.', 'info');
      navigate(res.data.state === 'live' ? 'live_challenge' : 'waiting_room', { challengeId });
      return;
    }
    if (res.data?.state === 'scheduled' || (res.data?.seconds_until_start || 0) > 0) {
      api.toast('Challenge accepted & locked in! Scenario unseals at scheduled match time.', 'success');
      sendSystemNotification(
        '⚔️ Challenge Accepted & Locked!',
        'You joined the boardroom match. Waiting in the executive lounge.',
        'waiting_room',
        challengeId,
        'boardroom'
      );
      navigate('waiting_room', { challengeId });
    } else {
      api.toast('Challenge accepted! Scenario revealed.', 'success');
      sendSystemNotification(
        '🏛️ Boardroom Match Live!',
        'You joined a live boardroom challenge. Scenario is now unlocked.',
        'live_challenge',
        challengeId,
        'boardroom'
      );
      navigate('live_challenge', { challengeId });
    }
  } catch (err) {
    if (btn) { btn.disabled = false; btn.innerHTML = origText; }
  }
}

async function loadWaitingRoomData(challengeId) {
  try {
    const res = await api.get(`/boardroom/challenge/${challengeId}`);
    const c = res.data;
    const el = document.getElementById('waiting-room-content');
    if (!el) return;

    if (c.state === 'live' && !c.is_scheduled_waiting) {
      navigate('live_challenge', { challengeId: c.id });
      return;
    }

    const inviteUrl = window.location.origin + '/?page=live_challenge&challengeId=' + c.id;

    // Timezone-accurate local target time and wall-clock calculation
    const targetDate = parseUtcDate(c.scheduled_at_iso || c.scheduled_at) 
      || new Date(Date.now() + (parseInt(c.seconds_until_start, 10) || 0) * 1000);
    const targetEndMs = targetDate.getTime();
    const scheduledTimeFormatted = targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userTzLabel = getUserTimezoneLabel();

    function getSecondsRemaining() {
      return Math.max(0, Math.floor((targetEndMs - Date.now()) / 1000));
    }

    function formatCountdown(sec) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    el.innerHTML = `
      <div class="two-col">
        <div class="panel">
          <div class="sealed-box" style="padding: 24px 16px;">
            <div class="lock" style="font-size: 36px; margin-bottom: 6px;">🔒</div>
            <h2 style="font-size: 18px; margin-bottom: 4px;">Confidential Strategy Scenario Sealed</h2>
            <p style="color: var(--muted); max-width: 450px; margin: 0 auto 14px; font-size: 12.5px;">
              Both executive strategists receive the identical case dilemma simultaneously. Content unseals strictly when the match countdown arrives.
            </p>

            <!-- Fixed Match Scheduled Countdown -->
            <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 12px; padding: 16px; margin-bottom: 14px; text-align: center;">
              <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--jade); letter-spacing: 0.05em; margin-bottom: 4px;">
                MATCH SCHEDULED START COUNTDOWN
              </div>
              <div id="scheduled-countdown-timer" style="font-size: 38px; font-weight: 900; font-family: monospace; color: var(--text); letter-spacing: 2px;">
                ${formatCountdown(getSecondsRemaining())}
              </div>
              <div style="font-size: 11.5px; color: var(--muted); margin-top: 4px;">
                Scheduled for <b>${scheduledTimeFormatted}</b> (${userTzLabel}). Scenario auto-unlocks at 00:00.
              </div>
            </div>

            <!-- Participant Presence Badges -->
            <div style="display: flex; gap: 10px; margin-bottom: 14px;">
              <div style="flex: 1; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 10px; text-align: center;">
                <div style="font-size: 11px; color: var(--muted); text-transform: uppercase;">Host Strategist</div>
                <div style="font-weight: 700; color: var(--text); font-size: 13px; margin-top: 2px;">${c.host_name}</div>
                <div style="font-size: 11px; color: var(--jade); font-weight: 700; margin-top: 2px;">● Ready in Lounge</div>
              </div>
              <div style="flex: 1; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 10px; text-align: center;">
                <div style="font-size: 11px; color: var(--muted); text-transform: uppercase;">Opponent Strategist</div>
                <div style="font-weight: 700; color: var(--text); font-size: 13px; margin-top: 2px;">
                  ${c.has_opponent ? c.opponent_name : 'Waiting for Opponent'}
                </div>
                <div style="font-size: 11px; color: ${c.has_opponent ? 'var(--jade)' : '#fbbf24'}; font-weight: 700; margin-top: 2px;">
                  ${c.has_opponent ? '● Locked In & Ready' : '⏳ Lobby Matchmaking'}
                </div>
              </div>
            </div>

            <!-- Direct Match Invite Link -->
            <div style="background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 10px; margin-bottom: 14px; text-align: left;">
              <div style="font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; margin-bottom: 5px;">Direct Duel Invite Link</div>
              <div style="display: flex; gap: 6px;">
                <input type="text" class="input" style="font-size: 11px; font-family: monospace; padding: 6px 8px; flex: 1; min-width: 0;" readonly value="${inviteUrl}" id="waiting-invite-url">
                <button type="button" class="btn btn-secondary" style="font-size: 11px; padding: 6px 10px; white-space: nowrap;" onclick="copyWaitingInviteUrl()">Copy 📋</button>
              </div>
            </div>

            <!-- Institutional AI Benchmark Duel Explanatory Card -->
            ${!c.has_opponent ? `
              <div style="background: rgba(16, 185, 129, 0.05); border: 1px dashed rgba(16, 185, 129, 0.35); border-radius: 12px; padding: 16px; margin-top: 14px; text-align: left;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 22px;">🤖</span>
                    <div>
                      <b style="font-size: 13.5px; color: #fff;">Solo Benchmark Duel Mode</b>
                      <div style="font-size: 11px; color: var(--muted);">Play immediately vs Institutional Model</div>
                    </div>
                  </div>
                  <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.3);">NO WAITING</span>
                </div>
                <p style="font-size: 12px; color: var(--text); line-height: 1.5; margin: 0 0 10px;">
                  Waiting for an opponent in the lobby? You can unseal the confidential strategy case right now and test your executive prowess directly against the Institutional Benchmark standard.
                </p>
                <div style="background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; font-size: 11.5px; line-height: 1.6; color: var(--text-muted);">
                  <div style="font-weight: 700; color: #34d399; margin-bottom: 5px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">📋 How Benchmark Duels Work:</div>
                  <div style="margin-bottom: 4px;">• <b>The Dilemma:</b> You receive the identical confidential <b>${c.industry}</b> scenario assigned to this room.</div>
                  <div style="margin-bottom: 4px;">• <b>The Standard:</b> Evaluated across Financial Mechanics (40%), Downside Risk Controls (30%), Macro Precedent (20%), and Executive Communication (10%).</div>
                  <div style="margin-bottom: 4px;">• <b>The Passing Bar (70/100):</b> The Institutional Model benchmarks at <b>70/100</b>. Score 70 or above to conquer the benchmark and win the challenge.</div>
                  <div>• <b>The Stakes:</b> Beat the benchmark to claim your capital payout and XP reward. If your executive memo scores below 70, the benchmark model prevails.</div>
                </div>
                <button class="btn btn-primary btn-full" onclick="handleStartBenchmarkDuel('${c.id}', this)" style="padding: 12px; font-weight: 700; font-size: 13px; background: linear-gradient(135deg, #059669, #0284c7); border: none; box-shadow: 0 2px 8px rgba(5, 150, 105, 0.3);">
                  Unseal Scenario &amp; Duel Benchmark 🤖
                </button>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="panel">
          <h2>Challenge Parameters</h2>
          <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 14px; font-size: 13px;">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--line); padding-bottom: 8px;">
              <span style="color: var(--muted);">Industry Sector:</span>
              <b>${c.industry}</b>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--line); padding-bottom: 8px;">
              <span style="color: var(--muted);">Capital Commitment:</span>
              <b style="color: var(--jade);">${formatMoney(c.commitment)} ${c.mode === 'real' ? 'NGN' : 'VNGN'}</b>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--line); padding-bottom: 8px;">
              <span style="color: var(--muted);">Memo Duration:</span>
              <b>${c.duration_minutes} minutes</b>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--line); padding-bottom: 8px;">
              <span style="color: var(--muted);">Scheduled Match Time:</span>
              <b>${scheduledTimeFormatted} <small style="color: var(--muted); font-size: 11px; font-weight: normal;">(${userTzLabel})</small></b>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: var(--muted);">Match Status:</span>
              <b style="color: ${c.has_opponent ? 'var(--jade)' : '#fbbf24'};">${c.has_opponent ? 'Matched & Scheduled' : 'Awaiting Match in Lobby...'}</b>
            </div>
          </div>
        </div>
      </div>
    `;

    // True wall-clock ticking countdown timer
    if (window.waitingCountdownInterval) clearInterval(window.waitingCountdownInterval);
    if (window._waitingWakeHandler) {
      document.removeEventListener('visibilitychange', window._waitingWakeHandler);
      window.removeEventListener('focus', window._waitingWakeHandler);
    }
    let notified5mLocal = false;

    const tickCountdown = () => {
      const remaining = getSecondsRemaining();
      const timerEl = document.getElementById('scheduled-countdown-timer');
      if (timerEl) {
        timerEl.textContent = formatCountdown(remaining);
      }

      // Proactive 5-minute warning notification
      if (remaining <= 300 && remaining > 290 && !notified5mLocal) {
        notified5mLocal = true;
        sendSystemNotification(
          '🏛️ Boardroom Match in 5 Minutes!',
          `Your ${c.industry} executive match starts in 5 minutes! Be ready at your terminal.`,
          'waiting_room',
          c.id,
          'boardroom'
        );
      }

      // When countdown hits 00:00
      if (remaining <= 0) {
        clearInterval(window.waitingCountdownInterval);
        if (window._waitingWakeHandler) {
          document.removeEventListener('visibilitychange', window._waitingWakeHandler);
          window.removeEventListener('focus', window._waitingWakeHandler);
        }
        sendSystemNotification(
          '🏛️ Boardroom Match Started! Dilemma Unsealed',
          `The ${c.industry} dilemma has unsealed! Enter the arena and submit your executive memo.`,
          'live_challenge',
          c.id,
          'boardroom'
        );
        api.toast('Scheduled time arrived! Unsealing scenario...', 'success');
        navigate('live_challenge', { challengeId: c.id });
      }
    };

    tickCountdown();
    window.waitingCountdownInterval = setInterval(tickCountdown, 1000);

    // Sync immediately on wake/visibilitychange so browser sleep never freezes the countdown!
    window._waitingWakeHandler = () => {
      if (!document.hidden) tickCountdown();
    };
    document.addEventListener('visibilitychange', window._waitingWakeHandler);
    window.addEventListener('focus', window._waitingWakeHandler);

    // Heartbeat poll every 3s to detect opponent join or match start
    if (window.waitingRoomPollInterval) clearInterval(window.waitingRoomPollInterval);
    window.waitingRoomPollInterval = setInterval(async () => {
      if (document.hidden) return;
      if (state.page !== 'waiting_room' || state.currentChallengeId !== challengeId) {
        clearInterval(window.waitingRoomPollInterval);
        if (window.waitingCountdownInterval) clearInterval(window.waitingCountdownInterval);
        return;
      }
      try {
        const pollRes = await api.get(`/boardroom/challenge/${challengeId}`);
        const pollC = pollRes?.data;
        if (pollC?.state === 'live' && !pollC?.is_scheduled_waiting) {
          clearInterval(window.waitingRoomPollInterval);
          if (window.waitingCountdownInterval) clearInterval(window.waitingCountdownInterval);
          sendSystemNotification(
            '🏛️ Boardroom Match Live! Dilemma Unsealed',
            `The ${pollC.industry} strategic memo scenario is unsealed!`,
            'live_challenge',
            challengeId,
            'boardroom'
          );
          api.toast('Match is live! Scenario unsealed.', 'success');
          navigate('live_challenge', { challengeId });
        } else if (pollC?.has_opponent && !c.has_opponent) {
          // Opponent joined! Re-render waiting room with opponent information
          loadWaitingRoomData(challengeId);
        }
      } catch (err) {}
    }, 3000);

  } catch (e) {}
}

function copyWaitingInviteUrl() {
  const input = document.getElementById('waiting-invite-url');
  if (input) {
    navigator.clipboard.writeText(input.value).then(() => {
      api.toast('Direct invite link copied! Send to an executive peer to duel.', 'success');
    }).catch(() => {
      api.toast('Copied: ' + input.value, 'info');
    });
  }
}

async function handleStartBenchmarkDuel(challengeId, btnEl) {
  const btn = btnEl || document.activeElement;
  const origText = btn ? btn.innerHTML : '';
  if (btn && btn.tagName === 'BUTTON') {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Starting Duel...';
  }
  if (window.waitingRoomPollInterval) clearInterval(window.waitingRoomPollInterval);
  try {
    await api.post(`/boardroom/start-demo/${challengeId}`);
    sendSystemNotification(
      'Boardroom Match Live 🏛️',
      'The dilemma scenario has unsealed against the AI Benchmark Strategist. Draft your executive memo.',
      'live_challenge',
      challengeId,
      'boardroom'
    );
    navigate('live_challenge', { challengeId });
  } catch (e) {
    if (btn && btn.tagName === 'BUTTON') {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
    api.toast(e.message || 'Could not start duel', 'error');
  }
}

async function loadLiveChallengeData(challengeId) {
  try {
    const res = await api.get(`/boardroom/challenge/${challengeId}`);
    const c = res.data;
    const el = document.getElementById('live-challenge-content');
    if (!el) return;

    if (c.has_submitted) {
      navigate('challenge_report', { challengeId: c.id });
      return;
    }

    if (c.is_scheduled_waiting || !c.scenario) {
      api.toast('Confidential dilemma is sealed until the scheduled match time arrives.', 'info');
      navigate('waiting_room', { challengeId: c.id });
      return;
    }

    const s = c.scenario;

    // Response Window Deadline Wall-Clock Calculation
    const deadlineIso = c.deadline_at_iso || (c.deadline_at ? c.deadline_at.replace(' ', 'T') + 'Z' : null);
    const deadlineDate = parseUtcDate(deadlineIso || c.deadline_at) 
      || new Date(Date.now() + (parseInt(c.seconds_remaining, 10) || (c.duration_minutes * 60)) * 1000);
    const deadlineEndMs = deadlineDate.getTime();

    function getSecondsRemaining() {
      return Math.max(0, Math.floor((deadlineEndMs - Date.now()) / 1000));
    }

    function formatCountdown(sec) {
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    el.innerHTML = `
      <div class="page-head">
        <div>
          <div class="eyebrow" style="color: var(--red); display: flex; align-items: center; gap: 6px;">
            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--red); animation:pulse 1.5s infinite;"></span>
            LIVE STRATEGIC ARENA · ${(c.industry || 'MACROECONOMICS').toUpperCase()}
          </div>
          <h1>${s.title}</h1>
          <p>Read the executive dilemma carefully and submit your structured strategy memo.</p>
        </div>
      </div>

      <!-- Prominent Response Window Deadline Bar -->
      <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 12px; padding: 12px 18px; margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 26px;">⏱️</span>
          <div>
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--jade); letter-spacing: 0.5px;">
              RESPONSE WINDOW COUNTDOWN
            </div>
            <div style="font-size: 12px; color: var(--muted);">
              Auto-submits your draft when timer reaches 00:00
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 16px;">
          <div id="live-deadline-timer" style="font-size: 28px; font-weight: 900; font-family: monospace; color: var(--text); letter-spacing: 2px; background: var(--bg); padding: 5px 16px; border-radius: 8px; border: 1px solid var(--border); min-width: 110px; text-align: center;">
            ${formatCountdown(getSecondsRemaining())}
          </div>
          ${c.has_opponent ? `
            <div style="background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 6px 12px; font-size: 12px;">
              <span style="color: var(--muted);">Opponent Status: </span>
              <b style="color: ${c.opponent_submitted ? 'var(--jade)' : '#fbbf24'};">
                ${c.opponent_submitted ? '● Submitted Memo ✓' : '⏳ Drafting Strategy...'}
              </b>
            </div>
          ` : `
            <div style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 8px; padding: 6px 12px; font-size: 12px; color: #38bdf8; font-weight: 700;">
              🤖 Solo Benchmark Duel
            </div>
          `}
        </div>
      </div>

      <div class="two-col">
        <div class="panel boardroom-no-select">
          <div class="eyebrow">CONFIDENTIAL CASE DILEMMA</div>
          <div style="font-size: 14.5px; line-height: 1.75; white-space: pre-line; margin-top: 10px; color: var(--text);">
            ${s.body}
          </div>

          ${s.reference_case ? `
            <div style="margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--line);">
              <div class="eyebrow" style="color: var(--jade);">MACRO REFERENCE CONTEXT</div>
              <div style="font-size: 13px; color: var(--muted); margin-top: 6px; line-height: 1.6;">
                ${(() => {
                  let ref = s.reference_case;
                  if (typeof ref === 'string') {
                    try { ref = JSON.parse(ref); } catch (e) { return escapeHtml(ref); }
                  }
                  if (ref && typeof ref === 'object') {
                    if (ref.company || ref.precedent) {
                      return `
                        <div style="margin-bottom: 4px;"><strong style="color: var(--text);">Entity / Sector:</strong> ${escapeHtml(ref.company || '')}</div>
                        <div><strong style="color: var(--text);">Historical Precedent:</strong> ${escapeHtml(ref.precedent || '')}</div>
                      `;
                    }
                    if (ref.historical_case || ref.notes) {
                      return escapeHtml(ref.historical_case || ref.notes);
                    }
                    return Object.entries(ref).map(([k, v]) => `<div><strong style="color: var(--text);">${escapeHtml(k)}:</strong> ${escapeHtml(typeof v === 'object' ? JSON.stringify(v) : String(v))}</div>`).join('');
                  }
                  return escapeHtml(String(ref || ''));
                })()}
              </div>
            </div>
          ` : ''}
        </div>

        <div class="panel">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 8px;">
            <div class="eyebrow" style="margin-bottom: 0;">EXECUTIVE STRATEGY MEMO</div>
            
            <!-- Voice Dictation Accent Selector & Mic Trigger -->
            <div style="display: flex; align-items: center; gap: 6px;">
              <select id="voice-accent-selector" onchange="if(window.VoiceEngine) window.VoiceEngine.setLanguage(this.value)" style="background: rgba(255,255,255,0.06); color: var(--text); border: 1px solid var(--line); border-radius: 6px; padding: 4px 8px; font-size: 11.5px; cursor: pointer;" title="Select Speech Accent">
                <option value="en-NG" selected>🇳🇬 Nigerian English</option>
                <option value="en-GH">🇬🇭 Ghanaian English</option>
                <option value="en-KE">🇰🇪 East African</option>
                <option value="en-ZA">🇿🇦 South African</option>
                <option value="en-GB">🇬🇧 British English</option>
                <option value="en-US">🇺🇸 Global English</option>
              </select>

              <button type="button" id="btn-toggle-voice" class="btn btn-secondary" onclick="toggleBoardroomVoiceDictation()" style="font-size: 12px; padding: 4px 10px; display: inline-flex; align-items: center; gap: 6px; border-radius: 20px;">
                <span id="voice-mic-icon">🎙️</span> <span id="voice-btn-text">Voice Dictate</span>
              </button>
            </div>
          </div>
          <h2 style="font-size: 17px; margin-bottom: 12px;">What is your strategic decision?</h2>

          <!-- Live Voice Dictation Feedback Bar -->
          <div id="voice-live-bar" style="display: none; background: rgba(16, 185, 129, 0.08); border: 1px dashed rgba(16, 185, 129, 0.35); border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; font-size: 12px; color: #34d399; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="voice-wave-container">
                <span class="voice-wave-bar"></span>
                <span class="voice-wave-bar"></span>
                <span class="voice-wave-bar"></span>
                <span class="voice-wave-bar"></span>
              </span>
              <span id="voice-live-status">Listening in Nigerian English (en-NG)... Speak naturally.</span>
            </div>
            <button type="button" class="btn btn-secondary" onclick="toggleBoardroomVoiceDictation()" style="padding: 2px 8px; font-size: 11px;">Stop ⏹</button>
          </div>

          <form onsubmit="handleSubmitMemo(event, '${c.id}')">
            <div class="form-group">
              <textarea class="textarea" id="memo-answer" rows="11" placeholder="1. Immediate Operational Action (First 72 Hours):\n- Concrete burn reduction or working capital measures...\n\n2. Financial & Liquidity Mechanics:\n- Specific figures, runway extensions, revenue or cost calculations...\n\n3. Downside Risk Controls:\n- Mitigating default, counterparty, churn, or FX exposure..." required style="line-height: 1.6; font-size: 13.5px;"></textarea>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; color: var(--muted); margin-top: 6px;">
                <span>Min: 40 chars</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <button type="button" id="btn-format-memo" class="btn btn-secondary" style="font-size: 10.5px; padding: 2px 8px; display: none;" onclick="autoFormatSpokenMemo(this)">✨ Format Spoken Memo</button>
                  <span id="char-counter">0 words · 0 chars</span>
                </div>
              </div>
            </div>

            <button type="submit" class="btn btn-primary btn-full" style="padding: 12px; font-weight: 700; font-size: 14px;">Submit Executive Memo ↗</button>
          </form>
        </div>
      </div>
    `;

    const tx = document.getElementById('memo-answer');
    if (tx) {
      tx.addEventListener('input', () => {
        const chars = tx.value.length;
        const words = tx.value.trim() ? tx.value.trim().split(/\s+/).length : 0;
        const counterEl = document.getElementById('char-counter');
        if (counterEl) {
          counterEl.innerHTML = `<b>${words}</b> words · ${chars} chars ${words >= 40 ? '✓' : '(aim for 80+)'}`;
          counterEl.style.color = words >= 40 ? 'var(--jade)' : 'var(--muted)';
        }
      });

      // ── Boardroom integrity: prevent paste into answer textarea ──────
      tx.addEventListener('paste', (ev) => {
        ev.preventDefault();
        api.toast('Paste is disabled in the boardroom. Please type your answer.', 'warning');
      });
      // ── Prevent drag-drop of text into textarea ─────────────────────
      tx.addEventListener('drop', (ev) => { ev.preventDefault(); });
    }

    // ── Boardroom integrity: prevent copy of scenario content ────────
    const scenarioBox = document.querySelector('.boardroom-scenario-box, .sealed-scenario-panel, [data-boardroom-scenario]');
    if (scenarioBox) {
      scenarioBox.style.userSelect = 'none';
      scenarioBox.style.webkitUserSelect = 'none';
    }

    // Block copy/cut on the whole page while in live challenge
    const _boardroomCopyGuard = (ev) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      // Only block if selection is NOT inside the memo textarea
      const anchorEl = sel.anchorNode?.parentElement;
      if (anchorEl && tx && tx.contains(anchorEl)) return;
      ev.preventDefault();
    };
    document.addEventListener('copy', _boardroomCopyGuard);
    document.addEventListener('cut', _boardroomCopyGuard);
    // Named contextmenu guard so it can be properly removed on navigate
    if (!window._boardroomContextGuard) {
      window._boardroomContextGuard = (ev) => { ev.preventDefault(); };
    }
    document.removeEventListener('contextmenu', window._boardroomContextGuard);
    document.addEventListener('contextmenu', window._boardroomContextGuard);

    // Anti-screenshot, defocus concealment & clipboard purge
    document.body.classList.add('boardroom-active');
    const onWindowBlur = () => { 
      document.body.classList.add('app-blurred'); 
    };
    const onWindowFocus = () => { 
      document.body.classList.remove('app-blurred'); 
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        document.body.classList.add('app-blurred');
      } else if (document.hasFocus()) {
        document.body.classList.remove('app-blurred');
      }
    };
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Function to trigger screenshot blackout and immediately purge clipboard
    const triggerScreenshotShield = () => {
      document.body.classList.add('app-blurred');
      // Instantly overwrite clipboard so Windows/macOS cannot hold the captured screenshot
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try { navigator.clipboard.writeText('').catch(() => {}); } catch(e) {}
      }
      api.toast('Screen capture of confidential boardroom dilemma is strictly prohibited.', 'warning');
      setTimeout(() => {
        if (document.hasFocus() && !document.hidden) {
          document.body.classList.remove('app-blurred');
        }
      }, 2000);
    };

    // Prevent screenshot / print key shortcuts (PrintScreen, Ctrl+P, Ctrl+S, Win+Shift+S)
    const onKeyDownGuard = (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && (ev.key === 'p' || ev.key === 'P' || ev.key === 's' || ev.key === 'S')) {
        ev.preventDefault();
        api.toast('Saving or printing confidential boardroom dilemma is restricted.', 'warning');
      }
      if (ev.key === 'PrintScreen' || ev.keyCode === 44 || ev.code === 'PrintScreen' ||
          (ev.shiftKey && (ev.metaKey || ev.ctrlKey) && (ev.key === 's' || ev.key === 'S'))) {
        ev.preventDefault();
        triggerScreenshotShield();
      }
    };

    // PrintScreen keyup — on Windows, PrtScn fires keyup when released; purge clipboard instantly
    const onKeyUpGuard = (ev) => {
      if (ev.key === 'PrintScreen' || ev.keyCode === 44 || ev.code === 'PrintScreen') {
        ev.preventDefault();
        triggerScreenshotShield();
      }
    };

    window.addEventListener('keydown', onKeyDownGuard, true);
    window.addEventListener('keyup', onKeyUpGuard, true);

    // Store guard ref for cleanup when navigating away
    if (!window._boardroomGuards) window._boardroomGuards = [];
    window._boardroomGuards.push({
      copy: _boardroomCopyGuard,
      cut: _boardroomCopyGuard,
      blur: onWindowBlur,
      focus: onWindowFocus,
      visibility: onVisibilityChange,
      keydown: onKeyDownGuard,
      keyup: onKeyUpGuard,
    });
    // ── End boardroom integrity ──────────────────────────────────────

    // Live ticking countdown for response window
    if (window.liveDeadlineInterval) clearInterval(window.liveDeadlineInterval);
    if (window._liveWakeHandler) {
      document.removeEventListener('visibilitychange', window._liveWakeHandler);
      window.removeEventListener('focus', window._liveWakeHandler);
    }
    let notified2m = false;
    let notified1m = false;

    const tickLiveTimer = () => {
      const sec = getSecondsRemaining();
      const timerEl = document.getElementById('live-deadline-timer');
      if (timerEl) {
        timerEl.textContent = formatCountdown(sec);

        if (sec <= 120 && sec > 60) {
          timerEl.style.borderColor = '#fbbf24';
          timerEl.style.color = '#fbbf24';
          if (!notified2m) {
            notified2m = true;
            api.toast('2 minutes remaining in response window!', 'warning');
          }
        } else if (sec <= 60 && sec > 0) {
          timerEl.style.borderColor = '#ef4444';
          timerEl.style.color = '#ef4444';
          if (!notified1m) {
            notified1m = true;
            api.toast('Final 60 seconds! Wrap up your strategy memorandum.', 'warning');
          }
        }
      }

      // Zero-hour expiry: auto-submit!
      if (sec <= 0) {
        clearInterval(window.liveDeadlineInterval);
        if (window._liveWakeHandler) {
          document.removeEventListener('visibilitychange', window._liveWakeHandler);
          window.removeEventListener('focus', window._liveWakeHandler);
        }
        api.toast('Response window expired! Auto-submitting your strategic memorandum...', 'info');
        const form = document.querySelector('#live-challenge-content form');
        const answerBox = document.getElementById('memo-answer');
        if (form && answerBox) {
          if (answerBox.value.trim().length < 40 && answerBox.value.trim().length > 0) {
            answerBox.value = answerBox.value.trim() + " - Concluded at response window deadline.";
          } else if (answerBox.value.trim().length === 0) {
            answerBox.value = "Zero-hour deadline reached without strategy memorandum.";
          }
          form.requestSubmit();
        }
      }
    };

    tickLiveTimer();
    window.liveDeadlineInterval = setInterval(tickLiveTimer, 1000);

    window._liveWakeHandler = () => {
      if (!document.hidden) tickLiveTimer();
    };
    document.addEventListener('visibilitychange', window._liveWakeHandler);
    window.addEventListener('focus', window._liveWakeHandler);

    // Heartbeat poll every 5s in 2-player match to detect opponent submission
    if (c.has_opponent) {
      if (window.liveMatchHeartbeat) clearInterval(window.liveMatchHeartbeat);
      window.liveMatchHeartbeat = setInterval(async () => {
        if (document.hidden) return;
        if (state.page !== 'live_challenge' || state.currentChallengeId !== challengeId) {
          clearInterval(window.liveMatchHeartbeat);
          return;
        }
        try {
          const pollRes = await api.get(`/boardroom/challenge/${challengeId}`);
          if (pollRes?.data?.opponent_submitted) {
            const oppStatusEl = document.querySelector('#live-challenge-content b');
            if (oppStatusEl && !oppStatusEl.textContent.includes('Submitted')) {
              oppStatusEl.textContent = '● Submitted Memo ✓';
              oppStatusEl.style.color = 'var(--jade)';
              api.toast('Your opponent has locked in their executive memorandum!', 'info');
            }
          }
        } catch(e) {}
      }, 5000);
    }
  } catch (e) {}
}

function toggleBoardroomVoiceDictation() {
  if (!window.VoiceEngine || !window.VoiceEngine.isSupported()) {
    api.toast('Voice-to-Text requires Chrome, Safari, Edge, or an Android browser with microphone access.', 'warning');
    return;
  }

  const tx = document.getElementById('memo-answer');
  if (!tx) return;

  const btn = document.getElementById('btn-toggle-voice');
  const liveBar = document.getElementById('voice-live-bar');
  const liveStatus = document.getElementById('voice-live-status');
  const formatBtn = document.getElementById('btn-format-memo');
  const micIcon = document.getElementById('voice-mic-icon');
  const btnText = document.getElementById('voice-btn-text');

  if (window.VoiceEngine.isRecording) {
    window.VoiceEngine.stop();
    if (btn) {
      btn.classList.remove('btn-voice-recording');
      if (micIcon) micIcon.innerText = '🎙️';
      if (btnText) btnText.innerText = 'Voice Dictate';
    }
    if (liveBar) liveBar.style.display = 'none';
    if (formatBtn && tx.value.trim().length > 40) formatBtn.style.display = 'inline-block';
    api.toast('Voice dictation paused. You can edit or submit your memo.', 'info');
  } else {
    const sel = document.getElementById('voice-accent-selector');
    if (sel) window.VoiceEngine.setLanguage(sel.value);

    // Subscribe to engine events for real-time live bar updates
    if (!window._voiceSubscribed) {
      window.VoiceEngine.subscribe((event, data) => {
        const barStatus = document.getElementById('voice-live-status');
        if (event === 'interimResult' && barStatus) {
          barStatus.innerText = `Speaking: "${data.text.slice(-50)}"`;
        } else if (event === 'finalResult') {
          const fBtn = document.getElementById('btn-format-memo');
          if (fBtn) fBtn.style.display = 'inline-block';
          if (barStatus) {
            barStatus.innerText = `Recorded ${data.totalSpoken} words. Keep speaking or tap Stop.`;
          }
        } else if (event === 'error') {
          api.toast(data.message || 'Microphone error', 'error');
          const vBtn = document.getElementById('btn-toggle-voice');
          if (vBtn) vBtn.classList.remove('btn-voice-recording');
          const vBar = document.getElementById('voice-live-bar');
          if (vBar) vBar.style.display = 'none';
        }
      });
      window._voiceSubscribed = true;
    }

    const started = window.VoiceEngine.start('memo-answer');
    if (started) {
      if (btn) {
        btn.classList.add('btn-voice-recording');
        if (micIcon) micIcon.innerText = '🔴';
        if (btnText) btnText.innerText = 'Listening...';
      }
      if (liveBar) {
        liveBar.style.display = 'flex';
        const langLabel = sel ? sel.options[sel.selectedIndex].text : 'Nigerian English';
        if (liveStatus) liveStatus.innerText = `Listening in ${langLabel}... Speak your recommendations.`;
      }
      api.toast('Microphone active! Speak naturally in your accent.', 'success');
    }
  }
}
window.toggleBoardroomVoiceDictation = toggleBoardroomVoiceDictation;

async function autoFormatSpokenMemo(btnEl) {
  const btn = btnEl || document.getElementById('btn-format-memo');
  const tx = document.getElementById('memo-answer');
  if (!tx || !tx.value.trim()) {
    api.toast('Please dictate or type strategy notes first before formatting.', 'info');
    return;
  }

  const origHtml = btn ? btn.innerHTML : '✨ Format Spoken Memo';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width: 10px; height: 10px; margin-right: 4px;"></span> Formatting...';
  }

  // Provide smooth spinner feedback
  await new Promise(r => setTimeout(r, 400));

  try {
    if (window.VoiceEngine) {
      tx.value = window.VoiceEngine.formatAsExecutiveMemo(tx.value);
      tx.dispatchEvent(new Event('input', { bubbles: true }));
      api.toast('Memo structured into executive numbered points.', 'success');
    }
  } catch (err) {
    api.toast('Formatting failed: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
}
window.autoFormatSpokenMemo = autoFormatSpokenMemo;

async function handleSubmitMemo(e, challengeId) {
  e.preventDefault();
  const answer = document.getElementById('memo-answer').value;

  // Clear live deadline interval and wake listeners when submitted
  if (window.liveDeadlineInterval) clearInterval(window.liveDeadlineInterval);
  if (window.liveMatchHeartbeat) clearInterval(window.liveMatchHeartbeat);
  if (window._liveWakeHandler) {
    document.removeEventListener('visibilitychange', window._liveWakeHandler);
    window.removeEventListener('focus', window._liveWakeHandler);
    window._liveWakeHandler = null;
  }

  // Stop voice dictation if running
  if (window.VoiceEngine && window.VoiceEngine.isRecording) {
    window.VoiceEngine.stop();
  }
  const dictStats = window.VoiceEngine ? window.VoiceEngine.getStats() : { used: false, language: 'en-NG' };

  const btn = e.submitter || e.target?.querySelector('button[type="submit"]');
  const origText = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Submitting...'; }

  try {
    const res = await api.post(`/boardroom/submit/${challengeId}`, {
      answer,
      dictation_used: dictStats.used,
      input_method: dictStats.used ? `voice_${dictStats.language}` : 'typed'
    });
    api.toast(res.message, 'success');
    sendSystemNotification(
      'Executive Strategy Memo Submitted',
      'Your memo has been queued for strategic evaluation by the Adjudication Council.',
      'challenge_report',
      challengeId,
      'boardroom'
    );
    navigate('challenge_report', { challengeId });
  } catch (err) {
    if (btn) { btn.disabled = false; btn.innerHTML = origText; }
  }
}

async function loadChallengeReportData(challengeId) {
  try {
    const res = await api.get(`/boardroom/report/${challengeId}`);
    const r = res.data;
    const el = document.getElementById('challenge-report-content');
    if (!el) return;

    if (r.status === 'waiting_for_opponent') {
      const deadlineIso = r.deadline_at_iso || (r.deadline_at ? r.deadline_at.replace(' ', 'T') + 'Z' : null);
      const deadlineDate = parseUtcDate(deadlineIso || r.deadline_at) || new Date(Date.now() + (r.seconds_remaining || 300) * 1000);
      const deadlineEndMs = deadlineDate.getTime();

      function getOppSecondsRemaining() {
        return Math.max(0, Math.floor((deadlineEndMs - Date.now()) / 1000));
      }

      function formatCountdown(sec) {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }

      el.innerHTML = `
        <div class="panel" style="text-align: center; padding: 48px 24px;">
          <div style="font-size: 40px; margin-bottom: 12px;">⏳</div>
          <h2>Memorandum Locked &amp; Submitted ✓</h2>
          <p style="color: var(--muted); max-width: 520px; margin: 8px auto 18px; font-size: 13.5px; line-height: 1.6;">
            Your executive strategy has been recorded into the secure vault. Waiting for your opponent to complete their submission or the response window to expire.
          </p>
          <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 12px; padding: 18px; max-width: 360px; margin: 0 auto 20px;">
            <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--jade); letter-spacing: 0.5px; margin-bottom: 4px;">
              RESPONSE WINDOW REMAINING
            </div>
            <div id="opp-countdown-timer" style="font-size: 34px; font-weight: 900; font-family: monospace; color: var(--text); letter-spacing: 2px;">
              ${formatCountdown(getOppSecondsRemaining())}
            </div>
            <div style="font-size: 11px; color: var(--muted); margin-top: 6px;">
              Evaluation and scoring begin automatically the instant both participants submit, or when time hits 00:00.
            </div>
          </div>
          <button class="btn btn-secondary" onclick="loadChallengeReportData('${challengeId}')">Refresh Adjudication Status ↺</button>
        </div>
      `;

      if (window.oppWaitingInterval) clearInterval(window.oppWaitingInterval);
      if (window._oppWakeHandler) {
        document.removeEventListener('visibilitychange', window._oppWakeHandler);
        window.removeEventListener('focus', window._oppWakeHandler);
      }

      const tickOppTimer = () => {
        const sec = getOppSecondsRemaining();
        const timerEl = document.getElementById('opp-countdown-timer');
        if (timerEl) {
          timerEl.textContent = formatCountdown(sec);
        }
        if (sec <= 0) {
          clearInterval(window.oppWaitingInterval);
          if (window._oppWakeHandler) {
            document.removeEventListener('visibilitychange', window._oppWakeHandler);
            window.removeEventListener('focus', window._oppWakeHandler);
          }
          loadChallengeReportData(challengeId);
        }
      };

      tickOppTimer();
      window.oppWaitingInterval = setInterval(tickOppTimer, 1000);

      window._oppWakeHandler = () => {
        if (!document.hidden) tickOppTimer();
      };
      document.addEventListener('visibilitychange', window._oppWakeHandler);
      window.addEventListener('focus', window._oppWakeHandler);

      // Heartbeat poll every 4s to detect opponent submission
      if (window.oppReportPoll) clearInterval(window.oppReportPoll);
      window.oppReportPoll = setInterval(async () => {
        if (document.hidden) return;
        if (state.page !== 'challenge_report' || state.currentChallengeId !== challengeId) {
          clearInterval(window.oppReportPoll);
          if (window.oppWaitingInterval) clearInterval(window.oppWaitingInterval);
          return;
        }
        try {
          const checkRes = await api.get(`/boardroom/report/${challengeId}`);
          if (checkRes?.data?.status !== 'waiting_for_opponent') {
            clearInterval(window.oppReportPoll);
            if (window.oppWaitingInterval) clearInterval(window.oppWaitingInterval);
            loadChallengeReportData(challengeId);
          }
        } catch(e) {}
      }, 4000);

      return;
    }

    if (r.status === 'pending_review') {
      el.innerHTML = `
        <div class="panel" style="text-align: center; padding: 48px 24px;">
          <div style="font-size: 38px; margin-bottom: 12px;">⚖️</div>
          <h2>Under Executive Review &amp; Sign-off</h2>
          <p style="color: var(--muted); max-width: 520px; margin: 8px auto 20px; font-size: 13.5px; line-height: 1.6;">
            Your executive memo has been received and is currently undergoing quality review and sign-off by the Institutional Adjudication Administrator. Final scores and payout will unlock immediately upon verification.
          </p>
          <button class="btn btn-primary" onclick="handleRefreshReport(this, '${challengeId}')">Refresh Adjudication Status ↺</button>
        </div>
      `;
      return;
    }

    if (r.status === 'queued' || r.status === 'pending' || !r.scores) {
      el.innerHTML = `
        <div class="panel" style="text-align: center; padding: 48px 24px;">
          <div style="font-size: 36px; margin-bottom: 12px;">⏳</div>
          <h2>Memo Queued for Strategic Adjudication</h2>
          <p style="color: var(--muted); max-width: 520px; margin: 8px auto 20px;">
            Your executive memo has been recorded and submitted. The Strategic Adjudication Council is assessing your decision rationale and quantitative thesis.
          </p>
          <button class="btn btn-primary" onclick="handleRefreshReport(this, '${challengeId}')">Check for Score ↺</button>
        </div>
      `;
      return;
    }

    const sc = r.scores;
    el.innerHTML = `
      <div class="metrics-row" id="wallet-metrics-summary">
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

async function handleRefreshReport(btnEl, challengeId) {
  const origText = btnEl ? btnEl.innerHTML : '';
  if (btnEl) { btnEl.disabled = true; btnEl.innerHTML = '<span class="spinner"></span> Checking...'; }
  await loadChallengeReportData(challengeId);
  // The report container re-renders with new content, so button is replaced — no restore needed
}
window.handleRefreshReport = handleRefreshReport;

function formatLedgerActivity(eventType, kind, amount, serverDesc, serverAccount) {
  const isAvailable = (kind === 'user_available');
  const isHeld = (kind === 'user_held');

  let title = serverDesc || 'Platform Activity';
  let desc = isAvailable ? 'Available wallet capital' : 'Escrow allocation';
  let icon = '⚡';
  let badgeLabel = serverAccount || (isAvailable ? 'Available Balance' : (isHeld ? 'Escrow Hold' : 'Account'));
  let badgeStyle = isAvailable 
    ? 'background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3);' 
    : 'background: rgba(251, 191, 36, 0.12); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.3);';

  switch (eventType) {
    case 'educational_grant':
    case 'grant_disbursement':
      title = 'Simulation Grant (Welcome Capital)';
      desc = 'Initial educational funding credited to your wallet';
      icon = '🎁';
      break;
    case 'boardroom_escrow_hold':
      if (amount < 0) {
        title = 'Boardroom Match Commitment';
        desc = 'Capital allocated and locked in match escrow';
        icon = '🏛️';
      } else {
        title = 'Boardroom Escrow Hold';
        desc = 'Funds secured in confidential match escrow';
        icon = '🔒';
      }
      break;
    case 'boardroom_resolution':
      title = amount > 0 ? 'Boardroom Victory Payout 🏆' : 'Boardroom Challenge Settlement';
      desc = amount > 0 ? 'Pot earnings credited to available balance' : 'Session closed and settled';
      icon = amount > 0 ? '🏆' : '⚖️';
      break;
    case 'boardroom_refund':
      title = 'Boardroom Match Refund';
      desc = 'Match cancelled; commitment returned to balance';
      icon = '↩️';
      break;
    case 'forecast_stake':
    case 'market_buy':
      title = 'Macro Predictor Forecast Position';
      desc = 'Contract shares purchased and held until resolution';
      icon = '📈';
      break;
    case 'forecast_settlement_won':
    case 'market_resolve_yes':
    case 'market_resolve_no':
      title = 'Macro Predictor Contract Payout';
      desc = 'Forecast verified; earnings credited to available balance';
      icon = '⚡';
      break;
    case 'forecast_settlement_lost':
      title = 'Macro Predictor Position Closed';
      desc = 'Outcome resolved against forecast position';
      icon = '📉';
      break;
    case 'deposit':
      title = 'Capital Deposit';
      desc = 'Funds credited via payment gateway';
      icon = '💳';
      break;
    case 'withdrawal':
      title = 'Capital Withdrawal';
      desc = 'Payout transferred to destination bank account';
      icon = '🏦';
      break;
    default:
      if (!serverDesc) {
        title = (eventType || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }
  }

  return { title, desc, icon, badgeLabel, badgeStyle };
}

function formatTransactionDateTime(timestamp) {
  if (!timestamp) return '<span style="color: var(--muted); font-size: 12px; font-family: monospace;">Just now</span>';
  const d = parseUtcDate(timestamp);
  if (!d || isNaN(d.getTime())) {
    return `<span style="color: var(--muted); font-size: 12px; font-family: monospace;">${escapeHtml(String(timestamp))}</span>`;
  }
  
  const dateStr = d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  
  const timeStr = d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  return `
    <div style="font-family: var(--font-mono, monospace); font-size: 12px; line-height: 1.45;" title="Recorded: ${d.toISOString()} (Device Time)">
      <div style="color: var(--text); font-weight: 600;">${dateStr}</div>
      <div style="color: var(--muted); font-size: 11px;">${timeStr}</div>
    </div>
  `;
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
            <div class="table-responsive">
              <table style="width: 100%; min-width: 520px; border-collapse: collapse; text-align: left; font-size: 13.5px; white-space: nowrap;">
                <thead>
                  <tr style="border-bottom: 2px solid var(--line); color: var(--muted); font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.5px;">
                    <th style="padding: 12px 10px;">Date &amp; Time <span style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: var(--jade); background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.25); padding: 1px 5px; border-radius: 4px; margin-left: 4px; letter-spacing: 0.3px;">Device Time</span></th>
                    <th style="padding: 12px 10px;">Activity &amp; Purpose</th>
                    <th style="padding: 12px 10px;">Ledger Bucket</th>
                    <th style="padding: 12px 10px; text-align: right;">Capital Change</th>
                  </tr>
                </thead>
                <tbody>
                  ${res.data.transactions.map(t => {
                    const act = formatLedgerActivity(t.event_type, t.kind, t.amount, t.description, t.account_label);
                    const isPositive = t.amount > 0;
                    const isNegative = t.amount < 0;
                    const amountColor = isPositive ? 'var(--jade)' : (isNegative ? '#f87171' : 'var(--text)');
                    const sign = isPositive ? '+' : '';
                    const displayAmt = `${sign}₦${Math.abs(t.amount).toLocaleString()}`;

                    return `
                      <tr style="border-bottom: 1px solid var(--line);">
                        <td style="padding: 12px 10px;">
                          ${formatTransactionDateTime(t.created_at_iso || t.created_at)}
                        </td>
                        <td style="padding: 12px 10px;">
                          <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 16px;">${act.icon}</span>
                            <div>
                              <div style="font-weight: 700; color: var(--text);">${act.title}</div>
                              <div style="font-size: 11.5px; color: var(--muted);">${act.desc}</div>
                            </div>
                          </div>
                        </td>
                        <td style="padding: 12px 10px;">
                          <span style="display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; ${act.badgeStyle}">
                            ${act.badgeLabel}
                          </span>
                        </td>
                        <td style="padding: 12px 10px; text-align: right; font-weight: 800; font-family: monospace; font-size: 14px; color: ${amountColor};">
                          ${displayAmt}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `;
        }
      }
    }
  } catch (e) {}
}

async function handleClaimGrant(btnEl) {
  const btn = btnEl || document.querySelector('[onclick*="handleClaimGrant"]') || document.activeElement;
  const origText = btn ? btn.innerHTML : '';
  if (btn && btn.tagName === 'BUTTON') {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Claiming...';
  }
  try {
    const res = await api.post('/wallet/claim-grant', {});
    api.toast(res.message || '₦500,000 demo capital credited!', 'success');
    sendSystemNotification(
      'Demo Capital Credited',
      '₦500,000 virtual demonstration funds have been verified and added to your ledger.',
      'wallet',
      null,
      'wallet'
    );
    await loadWalletData();
    if (state.page === 'wallet') {
      renderWalletPage();
    }
  } catch (err) {
    if (btn && btn.tagName === 'BUTTON') {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
    api.toast(err.message || 'Unable to claim demo grant at this time.', 'info');
  }
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

  const btn = e.submitter || e.target?.querySelector('button[type="submit"]');
  const origText = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Initializing...'; }

  try {
    const res = await api.post('/funding/initialize', { amount: amt });
    if (res?.data?.checkout_url) {
      sendSystemNotification(
        'Deposit Checkout Initialized',
        `A secure deposit of ₦${amt.toLocaleString()} has been generated. Redirecting to payment processor...`,
        'wallet',
        null,
        'wallet'
      );
      api.toast('Opening secure payment checkout...', 'info');
      setTimeout(() => {
        window.location.href = res.data.checkout_url;
      }, 700);
    }
  } catch (e) {
    if (btn) { btn.disabled = false; btn.innerHTML = origText; }
  }
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

  const btn = e.submitter || e.target?.querySelector('button[type="submit"]');
  const origText = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Queuing...'; }

  try {
    const res = await api.post('/wallet/withdraw', {
      bank_name: bankName,
      account_number: accNum,
      account_name: accName,
      amount: amt,
    });
    api.toast(res.message || 'Settlement withdrawal queued successfully!', 'success');
    sendSystemNotification(
      'Settlement Withdrawal Queued',
      `Withdrawal request for ₦${amt.toLocaleString()} submitted for compliance audit.`,
      'wallet',
      null,
      'wallet'
    );
    await loadWalletData();
    navigate('wallet');
  } catch (err) {
    if (btn) { btn.disabled = false; btn.innerHTML = origText; }
  }
}

async function loadLeaderboardData(tab = 'All') {
  state.leaderboardTab = tab;

  // Real-time active highlight update for tab toggle buttons
  const tabsBar = document.getElementById('leaderboard-tabs-bar');
  if (tabsBar) {
    tabsBar.innerHTML = renderLeaderboardTabsHtml();
  }

  const tbody = document.getElementById('leaderboard-table-body');
  if (tbody) tbody.innerHTML = renderLeaderboardSkeleton(6);

  try {
    const res = await api.get(`/leaderboard?tab=${encodeURIComponent(tab)}`);
    if (!tbody || !res?.data) return;

    if (res.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; padding: 28px; color: var(--muted); font-size: 13px;">
            No strategist activity recorded yet in this category.
          </td>
        </tr>
      `;
      return;
    }

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
  } catch (e) {
    console.error('Failed to load leaderboard data:', e);
  }
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

  if (window.VoiceEngine && window.VoiceEngine.isRecording) {
    window.VoiceEngine.stop();
    const vBtn = document.getElementById('btn-mentor-voice');
    if (vBtn) { vBtn.classList.remove('btn-voice-recording'); vBtn.innerText = '🎙️'; }
  }

  const btn = e.submitter || e.target?.querySelector('button[type="submit"]');
  const origText = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Consulting...'; }

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
    if (btn) { btn.disabled = false; btn.innerHTML = origText; }
    if (tempLoaderEl) {
      tempLoaderEl.innerHTML = `<span style="color: var(--red); font-size: 13px;">Unable to fetch mentor response. Please try again.</span>`;
    }
  }
}

function triggerQuickMentor(q) {
  document.getElementById('mentor-input').value = q;
  handleAskMentor(new Event('submit'));
}

function toggleMentorVoice() {
  if (!window.VoiceEngine || !window.VoiceEngine.isSupported()) {
    api.toast('Voice dictation requires Chrome, Safari, Edge, or an Android browser.', 'warning');
    return;
  }
  const btn = document.getElementById('btn-mentor-voice');
  if (window.VoiceEngine.isRecording) {
    window.VoiceEngine.stop();
    if (btn) {
      btn.classList.remove('btn-voice-recording');
      btn.innerText = '🎙️';
    }
    api.toast('Voice recording paused.', 'info');
  } else {
    window.VoiceEngine.setLanguage('en-NG');
    const started = window.VoiceEngine.start('mentor-input');
    if (started && btn) {
      btn.classList.add('btn-voice-recording');
      btn.innerText = '🔴';
      api.toast('Listening in Nigerian English (en-NG)... Speak your question.', 'success');
    }
  }
}
window.toggleMentorVoice = toggleMentorVoice;

function toggleThesisVoice() {
  if (!window.VoiceEngine || !window.VoiceEngine.isSupported()) {
    api.toast('Voice dictation requires Chrome, Safari, Edge, or an Android browser.', 'warning');
    return;
  }
  const btn = document.getElementById('btn-thesis-voice');
  if (window.VoiceEngine.isRecording) {
    window.VoiceEngine.stop();
    if (btn) {
      btn.classList.remove('btn-voice-recording');
      btn.innerHTML = '<span>🎙️</span> <span>Voice</span>';
    }
    api.toast('Voice thesis paused.', 'info');
  } else {
    window.VoiceEngine.setLanguage('en-NG');
    const started = window.VoiceEngine.start('forecast-thesis');
    if (started && btn) {
      btn.classList.add('btn-voice-recording');
      btn.innerHTML = '<span>🔴</span> <span>Listening...</span>';
      api.toast('Listening in Nigerian English... Dictate your forecast thesis.', 'success');
    }
  }
}
window.toggleThesisVoice = toggleThesisVoice;

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

  const allListedCompanies = {
    'NESTLE': {
      ticker: 'NESTLE.NG',
      company: 'Nestle Nigeria Plc',
      sector: 'Consumer Goods & FMCG',
      industry: 'fmcg',
      impact: fxRate > 1600 ? 'High FX Finance Cost Strain' : 'Resilient Cash Flow',
      status: fxRate > 1650 ? 'Negative Net Profit Margin' : 'Stabilizing Operating Earnings',
      risk_factor: 'Imported raw material dependency (sorghum & packaging substitution active)',
    },
    'BUAFOODS': {
      ticker: 'BUAFOODS.NG',
      company: 'BUA Foods Plc',
      sector: 'Food & Agriculture Products',
      industry: 'fmcg',
      impact: (fuelPrice > 1050 || fxRate > 1650) ? 'Port Demurrage & Freight Headwind' : 'Leading Volume Growth',
      status: 'Robust Operating Profit Margin (>28%)',
      risk_factor: 'Apapa berth dwell times, raw sugar import FX, and interstate haulage diesel costs',
    },
    'NB': {
      ticker: 'NB.NG',
      company: 'Nigerian Breweries Plc',
      sector: 'Consumer Goods & Beverages',
      industry: 'fmcg',
      impact: fxRate > 1600 ? 'Imported Malt & Packaging Margin Squeeze' : 'Cash Flow Stabilization',
      status: 'Local Sorghum Sourcing Expanding to 75%',
      risk_factor: 'Consumer purchasing power contraction, packaging bottle inflation, and interstate freight',
    },
    'UNILEVER': {
      ticker: 'UNILEVER.NG',
      company: 'Unilever Nigeria Plc',
      sector: 'Home & Personal Care',
      industry: 'fmcg',
      impact: projectedInflation > 32 ? 'Category Downsizing & Shrinkflation' : 'Portfolio Rationalization Gain',
      status: 'Exited Low-Margin Home Care to Defend Operating ROIC',
      risk_factor: 'Chemical raw material port clearance turnaround times and currency pass-through',
    },
    'MTNN': {
      ticker: 'MTNN.NG',
      company: 'MTN Nigeria Communications',
      sector: 'Telecommunications & Digital',
      industry: 'telecoms',
      impact: (fuelPrice > 1000 || fxRate > 1600) ? 'Operating Margin Headwind' : 'Expanding Data EBITDA',
      status: fxRate > 1700 ? 'Shareholder Equity Retrenchment' : 'Data Traffic Volume Expansion',
      risk_factor: 'Tower company dollar-indexed lease contracts and cell site diesel generators',
    },
    'AIRTELAFRI': {
      ticker: 'AIRTELAFRI.NG',
      company: 'Airtel Africa Plc',
      sector: 'Telecommunications & Mobile Money',
      industry: 'telecoms',
      impact: fuelPrice > 1050 ? 'Base Station Diesel Escalation' : 'SmartCash Mobile Money Velocity',
      status: 'Transitioning 14 African Markets to Solar Hybrid Towers',
      risk_factor: 'Sub-Saharan currency devaluations and cross-border equipment capex',
    },
    'DANGCEM': {
      ticker: 'DANGCEM.NG',
      company: 'Dangote Cement Plc',
      sector: 'Industrial Goods & Cement',
      industry: 'manufacturing',
      impact: fuelPrice > 1000 ? 'Haulage Freight Escalation' : 'High Domestic Pricing Power',
      status: fuelPrice > 1150 ? 'Compressed Inter-state Net Margins' : 'Robust Regional Clinker Export Flows',
      risk_factor: 'Gas pipeline supply pressure to kilns & dual-fuel CNG fleet transition',
    },
    'BUACEMENT': {
      ticker: 'BUACEMENT.NG',
      company: 'BUA Cement Plc',
      sector: 'Industrial Goods & Cement',
      industry: 'manufacturing',
      impact: fuelPrice > 1050 ? 'Captive LNG Power Margin Insulation' : 'Regional Market Expansion',
      status: 'Commissioning 70MW Off-Grid Power in Kalambaina',
      risk_factor: 'Cryogenic LNG tanker logistics from Niger Delta to northern kilns',
    },
    'WAPCO': {
      ticker: 'WAPCO.NG',
      company: 'Lafarge Africa Plc',
      sector: 'Industrial Goods & Building Materials',
      industry: 'manufacturing',
      impact: projectedInflation > 32 ? 'Alternative Biomass Fuel Buffer' : 'Green Building Market Share',
      status: '50% Kiln Thermal Energy Sourced from Biomass',
      risk_factor: 'National grid collapse exposure at Sagamu & Ewekoro plants',
    },
    'GTCO': {
      ticker: 'GTCO.NG',
      company: 'Guaranty Trust Holding Co',
      sector: 'Banking & Financial Services',
      industry: 'capital-markets',
      impact: mpr > 24 ? 'Net Interest Margin Expansion' : 'Moderate Credit Growth',
      status: 'CBN ₦500B Recapitalization Well Positioned',
      risk_factor: 'Corporate borrower debt servicing defaults and high cash reserve debits (CRR)',
    },
    'ZENITHBANK': {
      ticker: 'ZENITHBANK.NG',
      company: 'Zenith Bank Plc',
      sector: 'Banking & Financial Services',
      industry: 'capital-markets',
      impact: mpr > 25 ? 'High Sovereign Paper & Treasury Yield Capture' : 'Credit Portfolio Expansion',
      status: 'Rights Offer Concluding to Surpass ₦500B Capital Floor',
      risk_factor: 'Mandatory cash sterilization (CRR) dampening domestic loan origination',
    },
    'ACCESSCORP': {
      ticker: 'ACCESSCORP.NG',
      company: 'Access Holdings Plc',
      sector: 'Banking & Financial Services',
      industry: 'capital-markets',
      impact: fxRate > 1650 ? 'Pan-African FX Translation Uplift' : 'Interbank Trade Finance Volume',
      status: 'Global Rights Offer Underway across London & Lagos',
      risk_factor: 'Integration costs across sub-Saharan banking acquisitions',
    },
    'SEPLAT': {
      ticker: 'SEPLAT.NG',
      company: 'Seplat Energy Plc',
      sector: 'Oil & Gas Upstream',
      industry: 'energy',
      impact: fxRate > 1500 ? 'Hard-Currency Dollar Earning Advantage' : 'Stable Production Free Cash Flow',
      status: 'Mobil Asset Integration Accelerating Production Past 65k boepd',
      risk_factor: 'Trans-Niger Pipeline security and domestic gas commercial offtake tariffs',
    },
    'GEREGU': {
      ticker: 'GEREGU.NG',
      company: 'Geregu Power Plc',
      sector: 'Electric Utilities & Generation',
      industry: 'energy',
      impact: fuelPrice > 1000 ? 'Band-A Cost-Reflective Tariff Advantage' : 'Grid Dispatch Reliability',
      status: 'Targeting 735MW Generation Uptime Despite Gas Pressure Drops',
      risk_factor: 'Escravos-Lagos Pipeline gas supply curtailments and NBET payment cycles',
    },
    'TRANSPOWER': {
      ticker: 'TRANSPOWER.NG',
      company: 'Transcorp Power Plc',
      sector: 'Electric Utilities & Generation',
      industry: 'energy',
      impact: mpr > 24 ? 'Industrial Direct Power Purchase Expansion' : 'Base Load Dispatch Growth',
      status: 'Afam Gas Turbine Rehabilitation Adding 240MW to Grid',
      risk_factor: 'TCN transmission infrastructure collapse forcing generator trippings',
    },
    'ARADEL': {
      ticker: 'ARADEL.NG',
      company: 'Aradel Holdings Plc',
      sector: 'Integrated Oil, Gas & Refining',
      industry: 'energy',
      impact: fuelPrice > 1000 ? 'Modular Refinery Diesel Margin Surge' : 'Crude Evacuation Barging',
      status: 'Ogbele Refinery Supplying 11,000 bpd to Local Commercial Market',
      risk_factor: 'Upstream crude feed allocation and pipeline vandalization',
    },
    'PRESCO': {
      ticker: 'PRESCO.NG',
      company: 'Presco Plc',
      sector: 'Agriculture & Agro-Allied',
      industry: 'agriculture',
      impact: fxRate > 1600 ? 'Domestic Crude Palm Oil Deficit Pricing Power' : 'Steady Plantation Yield',
      status: 'Revenue Crossing ₦130B Supported by Import Tariffs',
      risk_factor: 'Port customs tariffs on imported olein and plantation diesel haulage',
    },
    'OKOMUOIL': {
      ticker: 'OKOMUOIL.NG',
      company: 'Okomu Oil Palm Plc',
      sector: 'Agriculture & Plantation Commodities',
      industry: 'agriculture',
      impact: fxRate > 1650 ? 'Hard-Currency Rubber Export Inflow' : 'Domestic Industrial CPO Sales',
      status: 'EBITDA Margins Sustained Above 55%',
      risk_factor: 'Fertilizer replacement costs and interstate road distribution security',
    },
    'FIDSON': {
      ticker: 'FIDSON.NG',
      company: 'Fidson Healthcare Plc',
      sector: 'Healthcare & Pharmaceuticals',
      industry: 'healthcare',
      impact: fxRate > 1650 ? 'Imported Active Pharmaceutical Ingredient (API) Cost Strain' : 'Local Formulation Demand',
      status: 'Expanding Sterile Injectables & Infusions Manufacturing',
      risk_factor: 'Port customs clearance dwell times for pharmaceutical active raw materials',
    },
    'SAFARICOM': {
      ticker: 'SAFARICOM.NR',
      company: 'Safaricom Plc (NSE Kenya)',
      sector: 'Pan-African Telecoms & Mobile Money',
      industry: 'capital-markets',
      impact: fxRate > 1600 ? 'Regional Mobile Money Velocity' : 'EAC Cross-Border Trade Flow',
      status: 'M-Pesa Transaction Volumes Expanding Across East Africa',
      risk_factor: 'Foreign exchange pass-through on imported network radio hardware',
    },
  };

  // Prioritize active industry
  const priorityKeys = [];
  const otherKeys = [];
  for (const [k, c] of Object.entries(allListedCompanies)) {
    if (c.industry === ind || (ind === 'monetary' && c.industry === 'capital-markets')) {
      priorityKeys.push(k);
    } else {
      otherKeys.push(k);
    }
  }
  const listedRadar = {};
  for (const k of [...priorityKeys, ...otherKeys]) {
    listedRadar[k] = allListedCompanies[k];
  }

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
  if (!state.lab.selectedScenarioId) {
    if (typeof api !== 'undefined' && api.toast) {
      api.toast('Please select an active scenario first to calibrate levers.', 'warning');
    }
    return;
  }
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
  const supplyColor = (res.supply_chain_stress || 65) > 70 ? 'var(--red)' : ((res.supply_chain_stress || 65) > 50 ? 'var(--orange)' : 'var(--jade)');
  const corpColor = (res.corporate_health || 55) < 45 ? 'var(--red)' : ((res.corporate_health || 55) < 65 ? 'var(--orange)' : 'var(--jade)');

  // 1. LIVE TELEMETRY HUD STRIP (Right atop Levers Panel)
  const hudInf = document.getElementById('hud-val-inf');
  if (hudInf) { hudInf.textContent = res.projected_inflation + '%'; hudInf.style.color = infColor; }
  const hudCredit = document.getElementById('hud-val-credit');
  if (hudCredit) { hudCredit.textContent = res.credit_impulse + ' / 100'; hudCredit.style.color = creditColor; }
  const hudSupply = document.getElementById('hud-val-supply');
  if (hudSupply) { hudSupply.textContent = (res.supply_chain_stress || 65) + ' / 100'; hudSupply.style.color = supplyColor; }
  const hudCorp = document.getElementById('hud-val-corp');
  if (hudCorp) { hudCorp.textContent = (res.corporate_health || 55) + ' / 100'; hudCorp.style.color = corpColor; }
  const hudMargin = document.getElementById('hud-val-margin');
  if (hudMargin) { hudMargin.textContent = (res.margin_stress > 0 ? '+' : '') + res.margin_stress + '%'; hudMargin.style.color = marginColor; }

  // 2. MOBILE FLOATING HUD (Pinned to bottom of viewport)
  const mobInf = document.getElementById('mob-hud-inf');
  if (mobInf) { mobInf.textContent = res.projected_inflation + '%'; mobInf.style.color = infColor; }
  const mobCredit = document.getElementById('mob-hud-credit');
  if (mobCredit) { mobCredit.textContent = res.credit_impulse; mobCredit.style.color = creditColor; }
  const mobSupply = document.getElementById('mob-hud-supply');
  if (mobSupply) { mobSupply.textContent = (res.supply_chain_stress || 65); mobSupply.style.color = supplyColor; }
  const mobMargin = document.getElementById('mob-hud-margin');
  if (mobMargin) { mobMargin.textContent = (res.margin_stress > 0 ? '+' : '') + res.margin_stress + '%'; mobMargin.style.color = marginColor; }

  // 3. FULL GAUGES
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
  const gValSupply = document.getElementById('gauge-val-supply');
  const gBarSupply = document.getElementById('gauge-bar-supply');
  const gSubSupply = document.getElementById('gauge-sub-supply');
  if (gValSupply) { gValSupply.textContent = (res.supply_chain_stress || 65) + ' / 100'; gValSupply.style.color = supplyColor; }
  if (gBarSupply) { gBarSupply.style.width = (res.supply_chain_stress || 65) + '%'; gBarSupply.style.background = supplyColor; }
  if (gSubSupply) {
    gSubSupply.textContent = (res.supply_chain_stress || 65) > 70 ? 'Port congestion, demurrage fees, and diesel haulage costs severely squeezing inventory velocity' : 'Manageable transport corridors and warehouse turnover';
  }

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
    radarEl.innerHTML = renderCorporateRadarList(res.listed_corporate_radar, state.lab.radarFilterQuery || '');
  }
}

function renderCorporateRadarList(radar, filterQuery = '') {
  if (!radar) return '<div class="muted" style="font-size: 12px; padding: 12px; text-align: center;">Select a scenario above to evaluate public corporate sensitivity.</div>';
  let entries = Object.values(radar);
  if (filterQuery && filterQuery.trim()) {
    const q = filterQuery.toLowerCase().trim();
    entries = entries.filter(c => 
      (c.company && c.company.toLowerCase().includes(q)) || 
      (c.ticker && c.ticker.toLowerCase().includes(q)) ||
      (c.sector && c.sector.toLowerCase().includes(q)) ||
      (c.risk_factor && c.risk_factor.toLowerCase().includes(q))
    );
  }
  if (entries.length === 0) {
    return '<div class="muted" style="font-size: 12px; padding: 16px; text-align: center;">No matching corporate tickers found for "' + filterQuery + '".</div>';
  }
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
      <div style="display: flex; justify-content: flex-end; margin-top: 8px;">
        <button class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 3px 10px;" onclick="handleRadarToPredictor('${c.ticker}')">
          <span>Trade Forecast Contract ↗</span>
        </button>
      </div>
    </div>
  `).join('');
}

function filterLabRadarList(query) {
  state.lab.radarFilterQuery = query;
  const radarEl = document.getElementById('lab-corporate-radar-container');
  if (radarEl && state.lab.results && state.lab.results.listed_corporate_radar) {
    radarEl.innerHTML = renderCorporateRadarList(state.lab.results.listed_corporate_radar, query);
  }
}

function clearLabRadarFilter() {
  state.lab.radarFilterQuery = '';
  const searchInput = document.getElementById('lab-radar-search');
  if (searchInput) searchInput.value = '';
  const radarEl = document.getElementById('lab-corporate-radar-container');
  if (radarEl && state.lab.results && state.lab.results.listed_corporate_radar) {
    radarEl.innerHTML = renderCorporateRadarList(state.lab.results.listed_corporate_radar, '');
  }
}

function toggleLabPrimer(key) {
  if (!state.lab.openPrimers) state.lab.openPrimers = {};
  state.lab.openPrimers[key] = !state.lab.openPrimers[key];
  const el = document.getElementById('lab-primer-' + key);
  if (el) {
    el.style.display = state.lab.openPrimers[key] ? 'block' : 'none';
  }
}

function toggleLabAiBox() {
  if (!state.lab) state.lab = {};
  state.lab.isAiBoxOpen = !state.lab.isAiBoxOpen;
  const box = document.getElementById('lab-ai-box');
  const btn = document.getElementById('btn-toggle-ai-box');
  if (box) {
    box.style.display = state.lab.isAiBoxOpen ? 'block' : 'none';
  }
  if (btn) {
    btn.innerHTML = `<span>${state.lab.isAiBoxOpen ? '✕ Close Scenario Generator' : '✨ Custom Dilemma Shock'}</span>`;
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
  render();
}

function selectLabIndustry(slug) {
  state.lab.selectedIndustry = slug;
  state.lab.selectedScenarioId = null;
  state.lab.selectedScenario = null;
  state.lab.aiBriefing = null;
  render();
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
  render();
}

function handleRadarToPredictor(ticker) {
  const tickerMap = {
    'DANGCEM.NG': 'dangote-cement-q4',
    'NESTLE.NG': 'cbn-mpr-hike',
    'MTNN.NG': 'nibss-instant-payments-growth',
    'SEPLAT.NG': 'brent-crude-dec',
    'GEREGU.NG': 'brent-crude-dec',
    'BUAFOODS.NG': 'nigerian-food-inflation',
    'GTCO.NG': 'cbn-mpr-hike',
    'ZENITHBANK.NG': 'cbn-mpr-hike',
    'ACCESSCORP.NG': 'cbn-mpr-hike',
    'BUACEMENT.NG': 'dangote-cement-q4',
    'WAPCO.NG': 'dangote-cement-q4',
    'NB.NG': 'nigerian-food-inflation',
    'UNILEVER.NG': 'nigerian-food-inflation',
    'AIRTELAFRI.NG': 'nibss-instant-payments-growth',
    'TRANSPOWER.NG': 'brent-crude-dec',
    'ARADEL.NG': 'brent-crude-dec',
    'PRESCO.NG': 'nigerian-food-inflation',
    'OKOMUOIL.NG': 'nigerian-food-inflation',
    'FIDSON.NG': 'nigerian-food-inflation',
    'SAFARICOM.NR': 'nibss-instant-payments-growth',
  };

  const marketSlug = tickerMap[ticker];
  if (marketSlug && state.markets && state.markets.length > 0) {
    const market = state.markets.find(m => m.slug === marketSlug);
    if (market) {
      navigate('market', { marketId: market.id });
      return;
    }
  }

  // Fallback: navigate to predictor
  navigate('predictor');
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
        render();
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
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Generating...'; }

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
      api.toast('Custom scenario generated successfully!', 'success');
      navigate('lab');
    }
  } catch (err) {
    api.toast('Failed to generate scenario: ' + (err.message || 'Error occurred'), 'error');
  } finally {
    state.lab.isAiGenLoading = false;
    if (btn) { btn.disabled = false; btn.innerHTML = 'Synthesize Custom Shock'; }
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

  const btn = e.submitter || e.target?.querySelector('button[type="submit"]');
  const origText = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Authenticating...'; }

  try {
    if (type === 'login' || type === 'welcome') {
      const res = await api.post('/auth/login', {
        email: emailEl.value,
        password: passEl.value,
      });
      api.toast('Signed in successfully!', 'success');
      state.user = res.data;
      if (res.data?.seen_tours && typeof res.data.seen_tours === 'object') {
        state.seenTours = Object.assign({}, res.data.seen_tours);
        Object.keys(state.seenTours).forEach(pg => {
          if (state.seenTours[pg]) localStorage.setItem('econsim-tour-seen-' + pg, 'true');
        });
      }
      navigate('dashboard');
    } else if (type === 'signup') {
      const res = await api.post('/auth/register', {
        email: emailEl.value,
        password: passEl.value,
        display_name: nameEl.value,
      });
      sessionStorage.setItem('verify_email', emailEl.value);
      if (res.data && res.data.verification_preview) {
        sessionStorage.setItem('verify_code_preview', res.data.verification_preview);
      }
      api.toast(`Verification code: ${res.data.verification_preview}`, 'info');
      navigate('verify');
    } else if (type === 'verify') {
      const res = await api.post('/auth/verify-email', {
        email: emailEl.value,
        code: codeEl.value,
      });
      sessionStorage.removeItem('verify_code_preview');
      sessionStorage.removeItem('verify_email');
      api.toast(res.message, 'success');
      state.user = res.data;
      navigate('onboarding');
    } else if (type === 'forgot') {
      await api.post('/auth/forgot-password', { email: emailEl.value });
      api.toast('Password reset token dispatched.', 'info');
      navigate('login');
    }
  } catch (err) {
    if (btn) { btn.disabled = false; btn.innerHTML = origText; }
  }
}

function autoFillVerifyCode(code) {
  const codeEl = document.getElementById('auth-code');
  if (codeEl) {
    codeEl.value = code;
    codeEl.focus();
    api.toast('Verification code auto-filled!', 'info');
  }
}

let resendCooldownTimer = null;
async function handleResendCode() {
  const emailEl = document.getElementById('auth-email');
  const email = emailEl ? emailEl.value.trim() : (sessionStorage.getItem('verify_email') || '');
  if (!email) {
    api.toast('Please enter your email address to resend code.', 'error');
    return;
  }

  const btn = document.getElementById('btn-resend-code');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Sending...';
  }

  try {
    const res = await api.post('/auth/resend-code', { email });
    const freshCode = res.data ? res.data.verification_preview : null;
    if (freshCode) {
      sessionStorage.setItem('verify_code_preview', freshCode);
      sessionStorage.setItem('verify_email', email);
      autoFillVerifyCode(freshCode);
      const badge = document.getElementById('verify-preview-badge');
      if (badge) {
        badge.outerHTML = `
          <div id="verify-preview-badge" style="background: rgba(36,121,101,0.08); border: 1.5px dashed var(--jade); border-radius: 8px; padding: 12px 14px; text-align: center; margin-bottom: 16px; cursor: pointer;" onclick="autoFillVerifyCode('${freshCode}')" title="Click to auto-fill code">
            <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--jade); display: block; margin-bottom: 4px; letter-spacing: 0.5px;">Fresh Verification Code Dispatched</span>
            <div style="font-family: var(--font-mono, monospace); font-size: 28px; font-weight: 800; letter-spacing: 6px; color: var(--text);">${freshCode}</div>
            <small style="display: block; font-size: 11px; color: var(--muted); margin-top: 4px;">Click here to auto-fill this code into the box below</small>
          </div>
        `;
      }
    }
    api.toast(res.message || 'Fresh verification code dispatched!', 'success');

    // 30-second cooldown
    let cooldown = 30;
    if (btn) {
      btn.textContent = `Resend in ${cooldown}s`;
      clearInterval(resendCooldownTimer);
      resendCooldownTimer = setInterval(() => {
        cooldown--;
        if (cooldown <= 0) {
          clearInterval(resendCooldownTimer);
          if (btn) {
            btn.disabled = false;
            btn.textContent = 'Resend Code';
          }
        } else if (btn) {
          btn.textContent = `Resend in ${cooldown}s`;
        }
      }, 1000);
    }
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Resend Code';
    }
  }
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

// =============================================================
// USER FEEDBACK & SUGGESTIONS MODAL
// =============================================================
let currentFeedbackRating = 5;

function openFeedbackModal() {
  let existing = document.getElementById('user-feedback-modal');
  if (existing) existing.remove();

  currentFeedbackRating = 5;
  const userEmail = state.user?.email || '';

  const modalHtml = `
    <div id="user-feedback-modal" onclick="if(event.target === this) closeFeedbackModal()" style="position: fixed; inset: 0; background: rgba(5, 8, 15, 0.88); backdrop-filter: blur(8px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 16px;">
      <div style="background: var(--card-bg, #0f1e33); border: 1px solid var(--line, #1c314f); border-radius: 16px; max-width: 520px; width: 100%; max-height: calc(100vh - 32px); display: flex; flex-direction: column; box-shadow: 0 24px 48px rgba(0,0,0,0.6); overflow: hidden; animation: fadeIn 0.2s ease;">
        <div style="padding: 18px 22px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, var(--jade), #10b981); display: flex; align-items: center; justify-content: center; font-size: 18px;">💬</div>
            <div>
              <h3 style="font-size: 16px; font-weight: 800; color: var(--text); margin: 0;">Share Feedback &amp; Ideas</h3>
              <p style="font-size: 12px; color: var(--muted); margin: 2px 0 0;">Help shape EconSim's intelligence and simulation experience</p>
            </div>
          </div>
          <button type="button" class="btn-link" onclick="closeFeedbackModal()" style="font-size: 20px; color: var(--muted); cursor: pointer; padding: 4px;">✕</button>
        </div>

        <form onsubmit="handleSubmitFeedback(event)" style="padding: 20px 22px; overflow-y: auto;">
          <!-- Star Rating -->
          <div style="margin-bottom: 16px; text-align: center;">
            <label style="display: block; font-size: 12px; font-weight: 700; color: var(--muted); text-transform: uppercase; margin-bottom: 6px;">How is your experience with EconSim?</label>
            <div class="star-rating-group" style="justify-content: center;">
              <button type="button" class="star-rating-btn active" data-rating="1" onclick="setFeedbackRating(1)">★</button>
              <button type="button" class="star-rating-btn active" data-rating="2" onclick="setFeedbackRating(2)">★</button>
              <button type="button" class="star-rating-btn active" data-rating="3" onclick="setFeedbackRating(3)">★</button>
              <button type="button" class="star-rating-btn active" data-rating="4" onclick="setFeedbackRating(4)">★</button>
              <button type="button" class="star-rating-btn active" data-rating="5" onclick="setFeedbackRating(5)">★</button>
            </div>
            <div id="feedback-rating-label" style="font-size: 11px; color: #fbbf24; font-weight: 700; margin-top: 4px;">5 / 5 · Excellent</div>
          </div>

          <!-- Category Selector -->
          <div class="form-group" style="margin-bottom: 14px;">
            <label style="font-size: 12px; font-weight: 700; color: var(--text);">Category</label>
            <select class="select" id="feedback-category" style="width: 100%;">
              <option value="general">💡 General Feedback / Idea</option>
              <option value="bug">🐞 Bug Report / Glitch</option>
              <option value="feature">⚡ Feature Request</option>
              <option value="boardroom">🏛️ Boardroom Arena Dilemma</option>
              <option value="markets">📈 Predictor Market Contracts</option>
              <option value="wallet">💳 Wallet / Deposits / Payouts</option>
              <option value="ui_ux">📱 UI / Mobile Experience</option>
            </select>
          </div>

          <!-- Message Textarea -->
          <div class="form-group" style="margin-bottom: 14px;">
            <label style="font-size: 12px; font-weight: 700; color: var(--text);">Your Message / Findings</label>
            <textarea class="input" id="feedback-message" rows="4" style="width: 100%; line-height: 1.5; resize: vertical;" placeholder="Tell us what worked well, what was confusing, or what you would love to see improved..." required minlength="5"></textarea>
          </div>

          <!-- Optional Email -->
          <div class="form-group" style="margin-bottom: 18px;">
            <label style="font-size: 12px; font-weight: 700; color: var(--text);">Contact Email <small style="color: var(--muted); font-weight: normal;">(optional, for follow-up)</small></label>
            <input class="input" type="email" id="feedback-email" value="${userEmail}" placeholder="you@example.com">
          </div>

          <button type="submit" class="btn btn-primary btn-full" id="btn-submit-feedback" style="padding: 12px; font-weight: 700;">
            Submit Feedback 🚀
          </button>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeFeedbackModal() {
  const el = document.getElementById('user-feedback-modal');
  if (el) el.remove();
}

function setFeedbackRating(n) {
  currentFeedbackRating = n;
  const labels = {
    1: '1 / 5 · Poor',
    2: '2 / 5 · Fair',
    3: '3 / 5 · Good',
    4: '4 / 5 · Very Good',
    5: '5 / 5 · Excellent'
  };
  const labelEl = document.getElementById('feedback-rating-label');
  if (labelEl) labelEl.textContent = labels[n] || `${n} / 5`;

  const btns = document.querySelectorAll('.star-rating-btn');
  btns.forEach(btn => {
    const val = parseInt(btn.getAttribute('data-rating'), 10);
    if (val <= n) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

async function handleSubmitFeedback(e) {
  e.preventDefault();
  const category = document.getElementById('feedback-category')?.value || 'general';
  const message = document.getElementById('feedback-message')?.value?.trim();
  const email = document.getElementById('feedback-email')?.value?.trim();

  if (!message || message.length < 5) {
    api.toast('Please enter at least 5 characters of feedback.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-submit-feedback');
  const origText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Submitting...';
  }

  try {
    const res = await api.post('/feedback', {
      category,
      rating: currentFeedbackRating,
      message,
      contact_email: email || undefined,
      page_url: window.location.href,
      user_agent: navigator.userAgent
    });
    closeFeedbackModal();
    api.toast(res.message || 'Thank you! Your feedback has been received.', 'success');
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }
}

// =============================================================
// REAL-WORLD EXPERT SCENARIO SUBMISSION MODAL
// =============================================================
function openExpertScenarioSubmissionModal() {
  let existing = document.getElementById('expert-scenario-modal-user');
  if (existing) existing.remove();

  const defaultName = state.user?.display_name || '';
  const defaultEmail = state.user?.email || '';

  const modalHtml = `
    <div id="expert-scenario-modal-user" onclick="if(event.target === this) closeExpertScenarioSubmissionModal()" style="position: fixed; inset: 0; background: rgba(5, 8, 15, 0.92); backdrop-filter: blur(10px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 16px;">
      <div style="background: var(--card-bg, #0f1e33); border: 1px solid var(--line, #1c314f); border-radius: 16px; max-width: 680px; width: 100%; max-height: calc(100vh - 32px); display: flex; flex-direction: column; box-shadow: 0 24px 48px rgba(0,0,0,0.7); overflow: hidden; animation: fadeIn 0.2s ease;">
        <div style="padding: 18px 22px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, #10b981, #0284c7); display: flex; align-items: center; justify-content: center; font-size: 18px;">🎓</div>
            <div>
              <h3 style="font-size: 16px; font-weight: 800; color: var(--text); margin: 0;">Contribute Real-World Scenario &amp; Casebook</h3>
              <p style="font-size: 12px; color: var(--muted); margin: 2px 0 0;">Synthesized into Scenario Lab empirical simulations and Boardroom arena challenges</p>
            </div>
          </div>
          <button type="button" class="btn-link" onclick="closeExpertScenarioSubmissionModal()" style="font-size: 20px; color: var(--muted); cursor: pointer; padding: 4px;">✕</button>
        </div>

        <form onsubmit="handleSubmitExpertScenario(event)" style="padding: 20px 22px; overflow-y: auto;">
          <!-- Trust & Verification Notice -->
          <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; font-size: 12px; line-height: 1.5; color: var(--text);">
            <b style="color: var(--jade);">🛡️ Administrator Verification:</b> Your real-world dilemma will be synthesized and packaged into standard EconSim scenarios across both <b>The Boardroom</b> and <b>Scenario Lab</b>. An Institutional Administrator must inspect and verify the quantitative case before it goes live into the platform rotation. Approved contributors receive attribution and <b>+500 XP</b>.
          </div>

          <!-- Section 1: Executive Credentials -->
          <div style="font-size: 11.5px; font-weight: 800; text-transform: uppercase; color: var(--jade); letter-spacing: 0.05em; margin-bottom: 10px;">
            1. Executive Contributor Credentials
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
            <div class="form-group">
              <label style="font-size: 11.5px;">Your Name / Public Byline</label>
              <input class="input" type="text" id="exp-sub-name" value="${defaultName}" placeholder="e.g. Dr. Ngozi Balogun" required>
            </div>
            <div class="form-group">
              <label style="font-size: 11.5px;">Executive Role / Experience</label>
              <input class="input" type="text" id="exp-sub-role" placeholder="e.g. Former CFO / Head of Risk / Founder" required>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
            <div class="form-group">
              <label style="font-size: 11.5px;">Organization / Firm <small style="color:var(--muted);">(optional)</small></label>
              <input class="input" type="text" id="exp-sub-org" placeholder="e.g. Tier-1 Commercial Bank / Fintech">
            </div>
            <div class="form-group">
              <label style="font-size: 11.5px;">Verification Email</label>
              <input class="input" type="email" id="exp-sub-email" value="${defaultEmail}" placeholder="you@organization.com" required>
            </div>
          </div>

          <!-- Section 2: Dilemma & Numbers -->
          <div style="font-size: 11.5px; font-weight: 800; text-transform: uppercase; color: var(--jade); letter-spacing: 0.05em; margin-bottom: 10px;">
            2. The Strategic Dilemma &amp; Quantitative Figures
          </div>
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin-bottom: 12px;">
            <div class="form-group">
              <label style="font-size: 11.5px;">Case Title</label>
              <input class="input" type="text" id="exp-sub-title" placeholder="e.g. Managing ₦40B FX Exposure During Sudden CBN Float" required minlength="10">
            </div>
            <div class="form-group">
              <label style="font-size: 11.5px;">Industry Sector</label>
              <select class="select" id="exp-sub-industry" required>
                <option value="1">Monetary Policy</option>
                <option value="2">Equities</option>
                <option value="3">Energy</option>
                <option value="4">Agriculture</option>
                <option value="5" selected>FX &amp; Reserves</option>
                <option value="6">Fintech</option>
                <option value="7">Manufacturing</option>
                <option value="8">Telecoms &amp; Digital</option>
                <option value="9">Real Estate &amp; Infra</option>
                <option value="10">FMCG &amp; Retail</option>
                <option value="11">Aviation &amp; Logistics</option>
              </select>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 12px;">
            <label style="font-size: 11.5px;">The Situation / Dilemma Background</label>
            <textarea class="input" id="exp-sub-dilemma" rows="3" placeholder="Describe the operational crisis or crossroad. What macro shock or commercial constraint precipitated the decision?" required minlength="60"></textarea>
          </div>

          <div class="form-group" style="margin-bottom: 12px;">
            <label style="font-size: 11.5px;">Key Quantitative Figures / Balance Sheet Metrics</label>
            <input class="input" type="text" id="exp-sub-metrics" placeholder="e.g. Monthly Burn: ₦15M, FX Obligations: $450k, Cash Runway: 5 months">
            <small style="color: var(--muted); font-size: 10.5px;">Provide concrete numbers that strategists must balance in their calculations.</small>
          </div>

          <div class="form-group" style="margin-bottom: 16px;">
            <label style="font-size: 11.5px;">Decision Pathways Considered</label>
            <textarea class="input" id="exp-sub-options" rows="2" placeholder="e.g. Option A: Liquidate treasury reserves immediately; Option B: Negotiate 90-day supplier forbearance at 15% interest penalty." required minlength="20"></textarea>
          </div>

          <!-- Section 3: Decision & Historical Outcome -->
          <div style="font-size: 11.5px; font-weight: 800; text-transform: uppercase; color: var(--jade); letter-spacing: 0.05em; margin-bottom: 10px;">
            3. Actual Decision &amp; Real-World Historical Outcome
          </div>
          <div class="form-group" style="margin-bottom: 12px;">
            <label style="font-size: 11.5px;">What Decision Did You / The Board Actually Make?</label>
            <textarea class="input" id="exp-sub-actual-decision" rows="2" placeholder="Detail the concrete decision and execution pathway chosen." required minlength="15"></textarea>
          </div>

          <div class="form-group" style="margin-bottom: 12px;">
            <label style="font-size: 11.5px;">Real-World Outcome (30 to 180 Days Later)</label>
            <textarea class="input" id="exp-sub-actual-outcome" rows="3" placeholder="What actually transpired in the real world? Financial impact, EBITDA swing, liquidity survival, or lessons." required minlength="25"></textarea>
          </div>

          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px; margin-bottom: 18px;">
            <div class="form-group">
              <label style="font-size: 11.5px;">Key Strategic Lesson Learned <small style="color:var(--muted);">(optional)</small></label>
              <input class="input" type="text" id="exp-sub-lessons" placeholder="The single most crucial executive takeaway">
            </div>
            <div class="form-group">
              <label style="font-size: 11.5px;">Difficulty Rating</label>
              <select class="select" id="exp-sub-difficulty">
                <option value="beginner">Beginner</option>
                <option value="intermediate" selected>Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          <button type="submit" class="btn btn-primary btn-full" id="btn-submit-expert-scenario" style="padding: 12px; font-weight: 700; background: var(--jade); border-color: var(--jade);">
            Submit for Administrator Verification 🚀
          </button>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeExpertScenarioSubmissionModal() {
  const el = document.getElementById('expert-scenario-modal-user');
  if (el) el.remove();
}

async function handleSubmitExpertScenario(e) {
  e.preventDefault();

  const name = document.getElementById('exp-sub-name')?.value?.trim();
  const role = document.getElementById('exp-sub-role')?.value?.trim();
  const org = document.getElementById('exp-sub-org')?.value?.trim();
  const email = document.getElementById('exp-sub-email')?.value?.trim();
  const title = document.getElementById('exp-sub-title')?.value?.trim();
  const industryId = parseInt(document.getElementById('exp-sub-industry')?.value, 10) || 5;
  const dilemma = document.getElementById('exp-sub-dilemma')?.value?.trim();
  const rawMetrics = document.getElementById('exp-sub-metrics')?.value?.trim();
  const options = document.getElementById('exp-sub-options')?.value?.trim();
  const decision = document.getElementById('exp-sub-actual-decision')?.value?.trim();
  const outcome = document.getElementById('exp-sub-actual-outcome')?.value?.trim();
  const lessons = document.getElementById('exp-sub-lessons')?.value?.trim();
  const difficulty = document.getElementById('exp-sub-difficulty')?.value || 'intermediate';

  // Parse metrics string into key-value map if formatted with commas/colons
  let metricsMap = {};
  if (rawMetrics) {
    const parts = rawMetrics.split(/[,|;]/);
    parts.forEach(part => {
      const kv = part.split(':');
      if (kv.length === 2) {
        metricsMap[kv[0].trim()] = kv[1].trim();
      } else if (part.trim()) {
        metricsMap[`metric_${Object.keys(metricsMap).length + 1}`] = part.trim();
      }
    });
  }

  const btn = document.getElementById('btn-submit-expert-scenario');
  const origText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Synthesizing & Ingesting...';
  }

  try {
    const res = await api.post('/expert/scenarios', {
      contributor_name: name,
      contributor_role: role,
      organization: org || undefined,
      contributor_email: email,
      industry_id: industryId,
      title: title,
      scenario_dilemma: dilemma,
      key_metrics: Object.keys(metricsMap).length ? metricsMap : undefined,
      decision_options: options,
      actual_decision_made: decision,
      actual_outcome_result: outcome,
      lessons_learned: lessons || undefined,
      difficulty: difficulty
    });

    closeExpertScenarioSubmissionModal();
    api.toast(res.message || 'Real-world scenario uploaded! Awaiting administrator verification.', 'success');
    sendSystemNotification(
      '🎓 Real-World Scenario Ingested',
      `"${title}" has been packaged and submitted to institutional administrators for verification.`,
      'boardroom'
    );
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }
}

window.openFeedbackModal = openFeedbackModal;
window.closeFeedbackModal = closeFeedbackModal;
window.setFeedbackRating = setFeedbackRating;
window.handleSubmitFeedback = handleSubmitFeedback;
window.openExpertScenarioSubmissionModal = openExpertScenarioSubmissionModal;
window.closeExpertScenarioSubmissionModal = closeExpertScenarioSubmissionModal;
window.handleSubmitExpertScenario = handleSubmitExpertScenario;

// Startup
window.addEventListener('DOMContentLoaded', initApp);

