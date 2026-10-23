// EconSim API Client
const api = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
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
  }
};

