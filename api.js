(function () {
  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  async function fetchJson(url, options) {
    const opts = options || {};
    const method = opts.method || 'GET';
    const timeout = opts.timeout != null ? opts.timeout : 18000;
    const retries = opts.retries != null ? opts.retries : (method === 'GET' ? 3 : 1);
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeout);
      try {
        const init = {
          method,
          headers: { Accept: 'application/json' },
          signal: controller.signal
        };
        if (opts.body != null) {
          init.headers['Content-Type'] = 'application/json';
          init.body = JSON.stringify(opts.body);
        }
        const response = await fetch(url, init);
        window.clearTimeout(timer);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || 'Request failed');
        }
        return data;
      } catch (error) {
        window.clearTimeout(timer);
        lastError = error;
        if (attempt < retries) {
          await sleep(900 * (attempt + 1));
        }
      }
    }
    throw lastError;
  }

  function warmServer() {
    fetch('/api/health', { priority: 'high' }).catch(() => {});
  }

  window.ssaFetch = {
    json: fetchJson,
    warm: warmServer,
    sleep
  };

  warmServer();
})();
