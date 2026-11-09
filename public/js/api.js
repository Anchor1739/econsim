// EconSim API Client
const api = {
  baseUrl: '/api',
  activeRequests: 0,

  showLoader() {
    this.activeRequests++;
    const loader = document.getElementById('global-loader');
    if (loader) loader.style.display = 'block';
  },

  hideLoader() {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    if (this.activeRequests === 0) {
      const loader = document.getElementById('global-loader');
      if (loader) loader.style.display = 'none';
    }
  },

  async request(endpoint, options = {}) {
    this.showLoader();
    const url = endpoint.startsWith('/') ? `${this.baseUrl}${endpoint}` : `${this.baseUrl}/${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    };

    const config = {
      ...options,
      headers,
      credentials: 'same-origin',
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = data?.message || `Request failed with status ${response.status}`;
        throw new Error(errorMsg);
      }

      return data;
    } catch (err) {
      this.toast(err.message, 'error');
      throw err;
    } finally {
      this.hideLoader();
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  },

  post(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  patch(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  toast(message, type = 'info') {
    const toastEl = document.getElementById('toast');
    if (!toastEl) return;
    toastEl.innerText = message;
    toastEl.style.display = 'block';
    toastEl.style.backgroundColor = type === 'error' ? '#991b1b' : type === 'success' ? '#065f46' : '#0b1828';

    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      toastEl.style.display = 'none';
    }, 3200);
  },

  setButtonLoading(btn, loadingText = 'Loading...') {
    if (!btn) return () => {};
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.innerHTML = `<span class="spinner"></span> ${loadingText}`;
    return () => {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      btn.innerHTML = originalText;
    };
  }
};

