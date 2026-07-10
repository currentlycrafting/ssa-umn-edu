/* Want The Aux — guest song requests and admin Spotify control. */
(function () {
  const $ = (id) => document.getElementById(id);
  const fetchJson = window.ssaFetch?.json || (async (url, opts) => {
    const r = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: opts?.body ? JSON.stringify(opts.body) : undefined });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Request failed');
    return d;
  });

  function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // DJ key from OAuth redirect ?dj=...
  const params = new URLSearchParams(window.location.search);
  const djFromUrl = params.get('dj');
  if (djFromUrl) {
    localStorage.setItem('ssaDjKey', djFromUrl);
    window.history.replaceState({}, '', '/aux');
  }
  let djKey = localStorage.getItem('ssaDjKey') || '';
  let guestId = localStorage.getItem('ssaAuxGuestId') || '';
  if (guestId.length < 16) {
    guestId = window.crypto?.randomUUID?.() || `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('ssaAuxGuestId', guestId);
  }
  let version = null;
  let searchTimer = null;

  const queueEl = $('auxQueue');
  const emptyEl = $('auxEmpty');
  const nowEl = $('auxNowPlaying');
  const djBar = $('auxDjBar');
  const searchInput = $('auxSearch');
  const searchResults = $('auxSearchResults');
  const spotifyQueueEl = $('auxSpotifyQueue');
  const spotifyEmptyEl = $('auxSpotifyEmpty');
  const toastEl = $('auxToast');

  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  async function verifyDj() {
    if (!djKey) return false;
    try {
      const d = await fetchJson('/api/aux/verify', { method: 'POST', body: { djKey } });
      if (!d.isDj) { localStorage.removeItem('ssaDjKey'); djKey = ''; }
      return d.isDj;
    } catch (_) { return false; }
  }

  function renderNowPlaying(np, connected) {
    if (!nowEl) return;
    nowEl.hidden = !connected;
    if (!connected) return;
    if (!np) {
      $('auxNpImg').hidden = true;
      $('auxNpSong').textContent = 'Please start playing a song first';
      $('auxNpArtist').textContent = 'Open Spotify on the connected account and start any song.';
      return;
    }
    $('auxNpImg').hidden = false;
    $('auxNpImg').src = np.albumImage || '/assets/brand/ssa-logo.png';
    $('auxNpSong').textContent = np.songName;
    $('auxNpArtist').textContent = np.artist;
  }

  function renderQueue(queue) {
    if (!queueEl) return;
    emptyEl.hidden = queue.length > 0;
    queueEl.innerHTML = queue.map((q, i) => `
      <div class="aux-item" data-id="${q.id}">
        <span style="font-weight:900;color:var(--muted);min-width:20px">${i + 1}</span>
        <img src="${escapeHtml(q.albumImage || '/assets/brand/ssa-logo.png')}" alt="" loading="lazy" />
        <div class="aux-item-main">
          <div class="aux-item-song">${escapeHtml(q.songName)}</div>
          <div class="aux-item-meta">${escapeHtml(q.artist)} · requested by ${escapeHtml(q.requestedBy)}</div>
        </div>
        ${q.canDelete ? `<button type="button" class="button button-line aux-remove-own" data-remove-own="${q.id}">Remove</button>` : ''}
      </div>`).join('');
    queueEl.querySelectorAll('[data-remove-own]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await fetchJson(`/api/aux/request/${button.dataset.removeOwn}/remove-own`, {
            method: 'POST',
            body: { guestId }
          });
          showToast('Your song was removed from the request queue.');
          refresh(true);
        } catch (error) {
          showToast(error.message);
          button.disabled = false;
        }
      });
    });
  }

  function renderSpotifyQueue(queue) {
    if (!spotifyQueueEl || !spotifyEmptyEl) return;
    spotifyEmptyEl.hidden = queue.length > 0;
    spotifyQueueEl.innerHTML = queue.map((song, i) => `
      <div class="aux-spotify-item">
        <span class="aux-queue-number">${i + 1}</span>
        <img src="${escapeHtml(song.albumImage || '/assets/brand/ssa-logo.png')}" alt="" />
        <div><strong>${escapeHtml(song.songName)}</strong><span>${escapeHtml(song.artist)}</span></div>
      </div>`).join('');
  }

  async function refresh(force) {
    try {
      const stateParams = new URLSearchParams({ guest: guestId });
      if (version != null && !force) stateParams.set('since', version);
      const url = `/api/aux/state?${stateParams}`;
      const data = await fetchJson(url);
      if (!data.changed) return;
      version = data.version;
      renderNowPlaying(data.nowPlaying, data.djConnected);
      renderQueue(data.queue);
      renderSpotifyQueue(data.spotifyQueue || []);
      if (djBar) {
        djBar.hidden = !data.djConnected;
      }
      if ($('auxConnectWrap')) {
        $('auxConnectWrap').hidden = !!djKey || data.djConnected;
      }
    } catch (_) { /* retry on next poll */ }
  }

  // Search
  searchInput?.addEventListener('input', () => {
    window.clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (!q) { searchResults.innerHTML = ''; return; }
    searchTimer = window.setTimeout(async () => {
      try {
        const data = await fetchJson('/api/aux/search?q=' + encodeURIComponent(q));
        searchResults.innerHTML = data.results.map((t) => `
          <div class="aux-result-row">
            <img src="${escapeHtml(t.albumImage || '/assets/brand/ssa-logo.png')}" alt="" width="44" height="44" style="border-radius:8px;object-fit:cover" />
            <div style="flex:1;min-width:0">
              <div style="font-weight:850;font-size:14px">${escapeHtml(t.songName)}</div>
              <div style="color:var(--muted);font-size:12px">${escapeHtml(t.artist)}</div>
            </div>
            <button type="button" class="button button-dark" style="min-height:36px;padding:0 14px;font-size:12px"
              data-add='${JSON.stringify(t).replace(/'/g, "&#39;")}'>Choose song</button>
          </div>`).join('') || '<p class="aux-empty">No results</p>';
        searchResults.querySelectorAll('[data-add]').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const t = JSON.parse(btn.dataset.add);
            btn.disabled = true;
            try {
              const added = await fetchJson('/api/aux/request', {
                method: 'POST',
                body: {
                  name: 'Guest',
                  guestId,
                  trackId: t.trackId,
                  songName: t.songName,
                  artist: t.artist,
                  albumImage: t.albumImage
                }
              });
              btn.textContent = 'Added';
              searchInput.value = '';
              searchResults.innerHTML = '';
              showToast(added.queued
                ? `${t.songName} was added to both queues.`
                : `${t.songName} was added to the request queue.`);
              refresh(true);
            } catch (e) {
              btn.textContent = e.message.includes('already') ? 'In queue' : 'Failed';
              showToast(e.message);
            }
          });
        });
      } catch (e) {
        searchResults.innerHTML = '<p class="aux-empty">' + escapeHtml(e.message) + '</p>';
      }
    }, 350);
  });

  // SVG background animation
  window.ssaMotion?.ready(({ animate, stagger, svg, enabled }) => {
    if (!enabled) return;
    const shapes = document.querySelectorAll('.aux-bg path, .aux-bg circle');
    if (!shapes.length) return;
    try {
      animate(svg.createDrawable(shapes), {
        draw: ['0 0', '0 1'],
        duration: 2200,
        delay: stagger(200),
        ease: 'inOutSine',
        loop: true,
        alternate: true
      });
    } catch (_) {}
    animate('.aux-bg circle', {
      translateX: () => (Math.random() - 0.5) * 60,
      translateY: () => (Math.random() - 0.5) * 40,
      duration: 4000,
      delay: stagger(300),
      ease: 'inOutSine',
      loop: true,
      alternate: true
    });
  });

  verifyDj().then((ok) => {
    if (ok && djBar) djBar.hidden = false;
    refresh(true);
    window.setInterval(() => refresh(false), 3500);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(true); });
  });
})();
