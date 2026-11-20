(function () {
  const api = window.ssaFetch?.json;
  if (!api) return;

  const MENTION_RE = /@\[([^\]]+)\]\((https?:\/\/(?:www\.)?instagram\.com\/[^\s)]+)\)/gi;
  const ROTS = ['-1.4deg', '1.2deg', '-0.8deg', '1.1deg', '-1deg', '0.7deg', '-1.2deg'];

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function copyHtml(text) {
    const raw = String(text || '');
    let html = '';
    let last = 0;
    const re = new RegExp(MENTION_RE.source, 'gi');
    let match;
    while ((match = re.exec(raw))) {
      html += esc(raw.slice(last, match.index));
      html += `<a class="event-ig-tag" href="${esc(match[2])}" target="_blank" rel="noopener noreferrer">${esc(match[1])}</a>`;
      last = match.index + match[0].length;
    }
    html += esc(raw.slice(last));
    return html.replace(/\n/g, '<br>');
  }

  function cardHtml(event, index) {
    const rot = ROTS[index % ROTS.length];
    const link = event.linkUrl
      ? `<a class="button button-dark" href="${esc(event.linkUrl)}" target="_blank" rel="noopener noreferrer">${esc(event.linkLabel || 'View the fun')}</a>`
      : '';
    const photo = event.imageUrl
      ? `<figure class="tl-photo"><img src="${esc(event.imageUrl)}" alt="" loading="lazy" /></figure>`
      : '';
    return `<article class="tl-item" style="--rot:${rot}; --stagger:${index * 70}ms">
      <div class="tl-sticky">
        <div class="tl-sticky-top">
          <time class="tl-date" datetime="${esc(event.eventDate)}">${esc(event.dateLabel)}</time>
          <span class="pill">${esc(event.pill)}</span>
        </div>
        <h2>${esc(event.title)}</h2>
        ${event.heldAt ? `<p class="held-at">${esc(event.heldAt)}</p>` : ''}
        ${photo}
        ${event.copy ? `<p class="tl-copy">${copyHtml(event.copy)}</p>` : ''}
        ${link}
      </div>
    </article>`;
  }

  function previewHtml(event) {
    return `<a class="home-tl-snap" href="#timeline">
      <span class="eyebrow">${esc(event.pill || 'Update')}</span>
      <strong>${esc(event.title)}</strong>
      <span>${esc(event.dateLabel || '')}</span>
    </a>`;
  }

  function observeCards(root) {
    const items = [...(root || document).querySelectorAll('.tl-item')];
    if (!items.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items.forEach((item) => item.classList.add('is-in'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.style.transitionDelay = el.style.getPropertyValue('--stagger') || '0ms';
        el.classList.add('is-in');
        observer.unobserve(el);
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -8% 0px' });
    items.forEach((item) => observer.observe(item));
  }

  async function load() {
    const list = document.getElementById('timelineBoardList');
    const homeBoard = document.getElementById('homeTimelineBoard');
    const homePreview = document.getElementById('homeTimelinePreview');
    if (!list && !homeBoard && !homePreview) return;

    try {
      const data = await api('/api/timeline?newest=1');
      const events = data.events || [];
      if (homePreview) {
        homePreview.innerHTML = events[0]
          ? previewHtml(events[0])
          : '<p class="home-newsletter-empty">Timeline updates will land here.</p>';
      }
      if (homeBoard) {
        if (!events.length) {
          homeBoard.innerHTML = '<p class="tl-empty">Timeline moments will appear here soon.</p>';
        } else {
          homeBoard.innerHTML = events.slice(0, 4).map(cardHtml).join('');
          // Condensed home section: show notes immediately in the sticky-note layout.
          homeBoard.querySelectorAll('.tl-item').forEach((item) => item.classList.add('is-in'));
        }
      }
      if (list) {
        if (!events.length) {
          list.innerHTML = '<p class="tl-empty">Timeline moments will appear here soon.</p>';
        } else {
          // Dedicated timeline page keeps chronological order.
          const chrono = [...events].reverse();
          list.innerHTML = chrono.map(cardHtml).join('');
          requestAnimationFrame(() => observeCards(list));
        }
      }
    } catch (error) {
      const message = `<p class="tl-empty">${esc(error.message || 'Could not load the timeline.')}</p>`;
      if (list) list.innerHTML = message;
      if (homeBoard) homeBoard.innerHTML = message;
      if (homePreview) homePreview.innerHTML = '<p class="home-newsletter-empty">Could not load timeline.</p>';
    }
  }

  load();
})();
