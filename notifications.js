(function () {
  const api = window.ssaFetch?.json;
  if (!api || !('Notification' in window)) return;

  const STORAGE_KEY = 'ssaFeaturedNotifyId';
  const OPT_IN_KEY = 'ssaNotifyOptIn';

  function guestToken() {
    let token = localStorage.getItem('ssaRsvpGuestId') || '';
    if (token.length < 16) {
      token = window.crypto?.randomUUID?.() || `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('ssaRsvpGuestId', token);
    }
    return token;
  }

  async function ensurePermission() {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    if (localStorage.getItem(OPT_IN_KEY) === 'no') return false;
    try {
      const result = await Notification.requestPermission();
      localStorage.setItem(OPT_IN_KEY, result === 'granted' ? 'yes' : 'no');
      return result === 'granted';
    } catch (_) {
      return false;
    }
  }

  function showFeaturedNotice(event) {
    const title = event.title || 'New SSA event';
    const body = event.dateLabel || 'A new featured event just dropped.';
    const url = '/events';
    try {
      const note = new Notification(title, {
        body,
        icon: '/assets/brand/ssa-logo.png',
        tag: `ssa-featured-${event.id}`,
        renotify: true
      });
      note.onclick = () => {
        window.focus();
        window.location.href = url;
        note.close();
      };
    } catch (_) {}
  }

  async function checkFeatured() {
    try {
      const data = await api('/api/events/featured');
      const featured = data.featured;
      if (!featured?.id) return;
      const prev = localStorage.getItem(STORAGE_KEY);
      const id = String(featured.id);
      if (prev && prev !== id) {
        const allowed = await ensurePermission();
        if (allowed) showFeaturedNotice(featured);
      }
      localStorage.setItem(STORAGE_KEY, id);
    } catch (_) {}
  }

  function mountPrompt() {
    if (localStorage.getItem(OPT_IN_KEY) || Notification.permission !== 'default') return;
    if (document.getElementById('ssaNotifyPrompt')) return;
    const bar = document.createElement('div');
    bar.id = 'ssaNotifyPrompt';
    bar.className = 'notify-prompt';
    bar.innerHTML = `
      <p>Get a ping when a new featured event drops.</p>
      <div>
        <button type="button" class="button button-dark" data-notify-yes>Notify me</button>
        <button type="button" class="button button-line" data-notify-no>Not now</button>
      </div>`;
    document.body.appendChild(bar);
    bar.querySelector('[data-notify-yes]')?.addEventListener('click', async () => {
      localStorage.setItem(OPT_IN_KEY, 'pending');
      await ensurePermission();
      bar.remove();
      checkFeatured();
    });
    bar.querySelector('[data-notify-no]')?.addEventListener('click', () => {
      localStorage.setItem(OPT_IN_KEY, 'no');
      bar.remove();
    });
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  guestToken();
  window.setTimeout(mountPrompt, 4000);
  checkFeatured();
  window.setInterval(checkFeatured, 120000);
})();
