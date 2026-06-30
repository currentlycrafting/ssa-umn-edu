(function () {
  let latestCount = null;

  function formatCount(value) {
    if (value == null || Number.isNaN(value)) return '—';
    return Number(value).toLocaleString('en-US');
  }

  function applyCount(count) {
    latestCount = count;
    const formatted = formatCount(count);
    document.querySelectorAll('[data-newsletter-count]').forEach((el) => {
      el.textContent = formatted;
      el.classList.remove('is-loading');
    });
    document.querySelectorAll('.nav-newsletter').forEach((btn) => {
      btn.dataset.count = String(count ?? '');
    });
  }

  async function refreshCounts() {
    document.querySelectorAll('[data-newsletter-count]').forEach((el) => {
      el.classList.add('is-loading');
    });
    try {
      const data = await window.ssaFetch.json('/api/newsletter/count', { timeout: 15000, retries: 2 });
      applyCount(data.count ?? 0);
      return data.count ?? 0;
    } catch (error) {
      document.querySelectorAll('[data-newsletter-count]').forEach((el) => {
        el.classList.remove('is-loading');
        if (el.textContent === '—' || !el.textContent.trim()) el.textContent = '…';
      });
      return latestCount;
    }
  }

  function openFromNav() {
    if (typeof window.openNewsletterModal === 'function') {
      window.openNewsletterModal(true);
      return;
    }
    sessionStorage.setItem('ssaOpenNewsletter', '1');
    window.location.href = 'index.html';
  }

  function initNavButton() {
    document.querySelectorAll('.nav-newsletter').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        openFromNav();
      });
    });
  }

  window.ssaNewsletter = {
    refreshCounts,
    formatCount,
    open: openFromNav
  };

  initNavButton();
  refreshCounts();
  window.setInterval(refreshCounts, 90000);
})();
