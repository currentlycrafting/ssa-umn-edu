(function () {
  const api = window.ssaFetch?.json;
  const list = document.getElementById('timelineBoardList');
  if (!api || !list) return;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const ROTS = ['-1.4deg', '1.2deg', '-0.8deg', '1.1deg', '-1deg', '0.7deg', '-1.2deg'];

  function cardHtml(event, index) {
    const rot = ROTS[index % ROTS.length];
    const link = event.linkUrl
      ? `<a class="button button-dark" href="${esc(event.linkUrl)}" target="_blank" rel="noopener noreferrer">${esc(event.linkLabel || 'View the fun')}</a>`
      : '';
    return `<article class="tl-item" style="--rot:${rot}; --stagger:${index * 70}ms">
      <div class="tl-sticky">
        <div class="tl-sticky-top">
          <time class="tl-date" datetime="${esc(event.eventDate)}">${esc(event.dateLabel)}</time>
          <span class="pill">${esc(event.pill)}</span>
        </div>
        <h2>${esc(event.title)}</h2>
        ${event.heldAt ? `<p class="held-at">${esc(event.heldAt)}</p>` : ''}
        ${event.copy ? `<p class="tl-copy">${esc(event.copy)}</p>` : ''}
        ${link}
      </div>
    </article>`;
  }

  function observeCards() {
    const items = [...list.querySelectorAll('.tl-item')];
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
    try {
      const data = await api('/api/timeline');
      const events = data.events || [];
      if (!events.length) {
        list.innerHTML = '<p class="tl-empty">Timeline moments will appear here soon.</p>';
        return;
      }
      list.innerHTML = events.map(cardHtml).join('');
      requestAnimationFrame(observeCards);
    } catch (error) {
      list.innerHTML = `<p class="tl-empty">${esc(error.message || 'Could not load the timeline.')}</p>`;
    }
  }

  load();
})();
