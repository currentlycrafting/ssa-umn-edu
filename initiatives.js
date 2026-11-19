(function () {
  const api = window.ssaFetch?.json;
  const list = document.getElementById('initiativesList');
  const asked = document.getElementById('askedList');
  const reviewModal = document.getElementById('initiativeReviewModal');
  const reviewForm = document.getElementById('initiativeReviewForm');
  if (!api || !list) return;

  const MENTION_RE = /@\[([^\]]+)\]\((https?:\/\/(?:www\.)?instagram\.com\/[^\s)]+)\)/gi;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function descriptionHtml(text) {
    const safe = esc(text || '');
    return safe.replace(MENTION_RE, (_, label, href) =>
      `<a class="event-ig-tag" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`
    ).replace(/\n/g, '<br>');
  }

  function guestToken() {
    let token = localStorage.getItem('ssaRsvpGuestId') || '';
    if (token.length < 16) {
      token = window.crypto?.randomUUID?.() || `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('ssaRsvpGuestId', token);
    }
    return token;
  }

  function collaboratorHtml(item) {
    const ig = item.igUrl
      ? `<a class="initiative-ig" href="${esc(item.igUrl)}" target="_blank" rel="noopener noreferrer">@${esc(item.igHandle || 'instagram')}</a>`
      : '';
    const avatar = item.avatarUrl
      ? `<img class="initiative-collab-avatar" src="${esc(item.avatarUrl)}" alt="" />`
      : `<span class="initiative-collab-fallback">@</span>`;
    return `<article class="initiative-collab">
      <div class="initiative-collab-head">
        ${avatar}
        <div>
          <span class="eyebrow">${esc(item.kind === 'org' ? 'Organization' : 'Collaborator')}</span>
          <strong>${esc(item.name)}</strong>
          ${ig}
        </div>
      </div>
      ${item.description ? `<p>${descriptionHtml(item.description)}</p>` : ''}
    </article>`;
  }

  function initiativeCard(item) {
    const photos = (item.photos || []).map((photo) =>
      `<figure><img src="${esc(photo.src)}" alt="${esc(photo.caption || item.title)}" loading="lazy" /><figcaption>${esc(photo.caption || '')}</figcaption></figure>`
    ).join('');
    const link = item.linkUrl
      ? `<a class="button button-line handdrawn" href="${esc(item.linkUrl)}" target="_blank" rel="noopener noreferrer">${esc(item.linkLabel || 'Learn more')}</a>`
      : '';
    return `<article class="initiative-card" id="initiative-${item.id}">
      ${item.imageUrl ? `<div class="initiative-card-media"><img src="${esc(item.imageUrl)}" alt="" loading="lazy" /></div>` : ''}
      <div class="initiative-card-body">
        <span class="eyebrow">Initiative</span>
        <h2>${esc(item.title)}</h2>
        ${item.description ? `<div class="initiative-desc">${descriptionHtml(item.description)}</div>` : ''}
        ${item.paragraph ? `<p class="initiative-paragraph">${descriptionHtml(item.paragraph)}</p>` : ''}
        ${(item.collaborators || []).length ? `<div class="initiative-collab-grid">${item.collaborators.map(collaboratorHtml).join('')}</div>` : ''}
        ${photos ? `<div class="initiative-photo-grid">${photos}</div>` : ''}
        <div class="initiative-card-actions">
          ${link}
          <button class="button button-dark handdrawn" type="button" data-review-initiative="${item.id}" data-title="${esc(item.title)}">Would you want us to do this again?</button>
        </div>
      </div>
    </article>`;
  }

  function openReview(id, title) {
    if (!reviewModal || !reviewForm) return;
    reviewForm.elements.initiativeId.value = id;
    document.getElementById('initiativeReviewMeta').textContent = title || '';
    reviewForm.querySelector('output').textContent = '';
    reviewModal.classList.add('open');
    reviewModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeReview() {
    reviewModal?.classList.remove('open');
    reviewModal?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  async function loadInitiatives() {
    try {
      const data = await api('/api/initiatives');
      const items = data.initiatives || [];
      if (!items.length) {
        list.innerHTML = '<p class="home-album-empty">Initiatives will show up here once the board publishes them.</p>';
        return;
      }
      list.innerHTML = items.map(initiativeCard).join('');
    } catch (_) {
      list.innerHTML = '<p class="home-album-empty">Initiatives could not load right now.</p>';
    }
  }

  async function loadAsked() {
    if (!asked) return;
    try {
      const data = await api('/api/suggestions/answered');
      const items = data.items || [];
      if (!items.length) {
        asked.innerHTML = '<p class="home-album-empty">When the board answers a suggested idea, it will appear here.</p>';
        return;
      }
      asked.innerHTML = `<div class="asked-grid">${items.map((item) => `
        <article class="asked-card">
          <span class="eyebrow">You asked</span>
          <h3>${esc(item.name)}</h3>
          <p class="asked-q">${esc(item.description)}</p>
          <span class="eyebrow">We listened</span>
          ${item.initiativeId
            ? `<p class="asked-a">Answered with initiative: <a href="#initiative-${esc(item.initiativeId)}">${esc(item.initiativeTitle || 'View initiative')}</a></p>`
            : `<p class="asked-a">${esc(item.answer)}</p>`}
        </article>`).join('')}</div>`;
    } catch (_) {
      asked.innerHTML = '<p class="home-album-empty">Answers could not load right now.</p>';
    }
  }

  list.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-review-initiative]');
    if (!btn) return;
    openReview(btn.dataset.reviewInitiative, btn.dataset.title);
  });

  document.getElementById('initiativeReviewClose')?.addEventListener('click', closeReview);
  reviewModal?.addEventListener('click', (event) => {
    if (event.target === reviewModal) closeReview();
  });

  reviewForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const out = reviewForm.querySelector('output');
    const button = reviewForm.querySelector('button[type="submit"]');
    button.disabled = true;
    out.textContent = 'Sending…';
    try {
      await api('/api/initiative-feedback', {
        method: 'POST',
        body: {
          initiativeId: Number(reviewForm.elements.initiativeId.value),
          rating: Number(reviewForm.elements.rating.value),
          comment: reviewForm.elements.comment.value.trim(),
          guestToken: guestToken()
        }
      });
      out.textContent = 'Thanks — this helps us decide what to run again.';
      reviewForm.reset();
      window.setTimeout(closeReview, 900);
    } catch (error) {
      out.textContent = error.message || 'Could not send review.';
    } finally {
      button.disabled = false;
    }
  });

  loadInitiatives();
  loadAsked();
})();
