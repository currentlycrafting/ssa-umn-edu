// Hero year montage: flip up 1998 -> 2026, then rewind fast back to 1998
const ymYear = document.getElementById('ymYear');
const ymCaption = document.getElementById('ymCaption');
if (ymYear) {
  const START_YEAR = 1998;
  const END_YEAR = 2026;
  let year = START_YEAR;
  ymYear.textContent = String(year);
  if (ymCaption) ymCaption.textContent = '';

  function flipTo(value) {
    ymYear.classList.remove('flip');
    void ymYear.offsetWidth;
    ymYear.classList.add('flip');
    ymYear.textContent = String(value);
  }

  function rewind() {
    ymYear.classList.add('rewinding');
    let delay = 32;

    function tick() {
      year -= 1;
      flipTo(year);
      if (year <= START_YEAR) {
        window.setTimeout(finishMontage, delay + 80);
        return;
      }
      if (year <= START_YEAR + 10) delay = Math.min(delay + 10, 140);
      window.setTimeout(tick, delay);
    }

    window.setTimeout(tick, 160);
  }

  function finishMontage() {
    year = START_YEAR;
    ymYear.classList.remove('flip', 'rewinding');
    ymYear.classList.add('rewind-end');
    ymYear.textContent = String(START_YEAR);
    window.setTimeout(() => {
      ymYear.classList.remove('rewind-end');
      ymYear.classList.add('finale');
      ymYear.textContent = `Since ${START_YEAR}`;
      if (ymCaption) ymCaption.textContent = '';
    }, 420);
  }

  const forward = window.setInterval(() => {
    year += 1;
    flipTo(year);
    if (year >= END_YEAR) {
      window.clearInterval(forward);
      window.setTimeout(rewind, 500);
    }
  }, 300);
}

// Stat-card progress bars + info tips
const statObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('bar-in');
      statObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.3 });
document.querySelectorAll('.stat-card').forEach((card) => statObserver.observe(card));

document.querySelectorAll('.stat-card .info-button').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const card = button.closest('.stat-card');
    const open = card.classList.contains('tip-open');
    document.querySelectorAll('.stat-card.tip-open').forEach((c) => c.classList.remove('tip-open'));
    if (!open) card.classList.add('tip-open');
  });
});
document.addEventListener('click', () => {
  document.querySelectorAll('.stat-card.tip-open').forEach((c) => c.classList.remove('tip-open'));
});

async function postJson(url, payload) {
  return window.ssaFetch.json(url, {
    method: 'POST',
    body: payload,
    timeout: 20000,
    retries: 2
  });
}

async function getJson(url) {
  return window.ssaFetch.json(url, {
    timeout: 20000,
    retries: 3
  });
}

function attachModalClose(backdrop, closeFn, canClose = () => true) {
  if (!backdrop || backdrop.dataset.modalBound === 'true') return;
  backdrop.dataset.modalBound = 'true';
  const btn = backdrop.querySelector('.modal-exit');
  if (btn) {
    btn.addEventListener('click', () => {
      if (canClose()) closeFn();
    });
  }
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop && canClose()) closeFn();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && backdrop.classList.contains('open') && canClose()) closeFn();
  });
}

function openModal(backdrop) {
  if (!backdrop) return;
  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeModal(backdrop) {
  if (!backdrop) return;
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
  if (!document.querySelector('.modal-backdrop.open')) {
    document.body.classList.remove('modal-open');
  }
}

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

const newsletterModal = document.getElementById('newsletterModal');
const newsletterModalForm = document.getElementById('newsletterModalForm');
const newsletterSkip = document.getElementById('newsletterSkip');
const newsletterSubscribedMsg = document.getElementById('newsletterSubscribedMsg');
const nlLead = document.getElementById('nlLead');

async function loadNewsletterPolaroids() {
  const host = document.getElementById('newsletterPolaroids');
  if (!host) return;
  try {
    const data = await getJson('/api/gallery?limit=2');
    host.innerHTML = (data.items || []).map((item, index) =>
      `<figure class="polaroid visible" style="--rot:${index ? '3deg' : '-3deg'}"><img src="${escapeHtml(item.src)}" alt="" /><figcaption>${escapeHtml(item.caption || 'SSA memory')}</figcaption></figure>`
    ).join('');
  } catch (_) {
    host.replaceChildren();
  }
}
loadNewsletterPolaroids();

async function loadHomeAlbumPreview() {
  const host = document.getElementById('homeAlbumPreview');
  if (!host) return;
  try {
    const data = await getJson('/api/gallery?limit=2');
    const items = (data.items || []).slice(0, 2);
    if (!items.length) {
      host.innerHTML = '<p class="home-album-empty">Photos coming soon — open the album to explore.</p>';
      return;
    }
    host.innerHTML = items.map((item, index) =>
      `<figure class="polaroid visible" style="--rot:${index ? '3deg' : '-3deg'}"><img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt || item.caption || 'SSA memory')}" loading="lazy" /><figcaption>${escapeHtml(item.caption || 'SSA memory')}</figcaption></figure>`
    ).join('');
  } catch (_) {
    host.innerHTML = '<p class="home-album-empty">Could not load preview — try the full album.</p>';
  }
}
loadHomeAlbumPreview();

async function loadHomeSuggestions() {
  const host = document.getElementById('homeSuggestFeed');
  if (!host) return;
  try {
    const data = await getJson('/api/event-suggestions');
    const items = (data.items || []).slice(0, 2);
    if (!items.length) {
      host.innerHTML = '<p class="home-suggest-empty">No ideas yet — be the first to suggest an event.</p>';
      return;
    }
    host.innerHTML = items.map((item) => {
      const typeLabel = item.type === 'community' ? 'Community' : 'Campus';
      const metaBits = [item.preferred_date, item.audience].filter(Boolean);
      return `<article class="home-suggest-card">
        <span class="eyebrow">${escapeHtml(typeLabel)}</span>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description)}</p>
        ${metaBits.length ? `<div class="home-suggest-meta">${escapeHtml(metaBits.join(' · '))}</div>` : ''}
      </article>`;
    }).join('');
  } catch (_) {
    host.innerHTML = '<p class="home-suggest-empty">Ideas will show here once they load.</p>';
  }
}
loadHomeSuggestions();

async function loadHomeBulletinHot() {
  const host = document.getElementById('homeBulletinHot');
  if (!host) return;
  const head = host.querySelector('.home-upcoming-cell-head')?.outerHTML
    || `<div class="home-upcoming-cell-head"><span class="eyebrow">Bulletin board</span><a href="/bulletin">Board →</a></div>`;
  try {
    const data = await getJson('/api/bulletin?status=active');
    const posts = (data.posts || [])
      .filter((post) => post.status !== 'complete')
      .sort((a, b) => (Number(b.interactionCount) || 0) - (Number(a.interactionCount) || 0));
    const top = posts[0];
    if (!top) {
      host.innerHTML = `${head}<p class="home-bulletin-empty">Nothing pinned yet — be the first to post.</p>`;
      return;
    }
    const interest = Number(top.interactionCount) || 0;
    host.innerHTML = `${head}
      <div class="home-bulletin-hot">
        <span class="bulletin-badge bulletin-badge--${escapeHtml(top.category)}">${escapeHtml(top.categoryLabel || top.category)}</span>
        <h3>${escapeHtml(top.title)}</h3>
        <p>${escapeHtml(top.description)}</p>
        <div class="home-bulletin-hot-meta">
          <span>${escapeHtml(top.name || 'Anonymous')}</span>
          <span>${interest} interested</span>
        </div>
        <a class="button button-line handdrawn" href="/bulletin">Open the board</a>
      </div>`;
  } catch (_) {
    host.innerHTML = `${head}<p class="home-bulletin-empty">Could not load the bulletin right now.</p>`;
  }
}
loadHomeBulletinHot();

function newsletterSubscribed() {
  return localStorage.getItem('ssaNewsletterSubscribed') === '1';
}

function syncNewsletterModalState() {
  const subscribed = newsletterSubscribed();
  if (newsletterModalForm) newsletterModalForm.hidden = subscribed;
  if (newsletterSubscribedMsg) newsletterSubscribedMsg.hidden = !subscribed;
  if (newsletterSkip) newsletterSkip.hidden = subscribed;
  if (nlLead) nlLead.hidden = subscribed;
}

function openNewsletterModal(force) {
  if (!newsletterModal) {
    sessionStorage.setItem('ssaOpenNewsletter', '1');
    window.location.href = 'index.html';
    return;
  }
  window.ssaNewsletter?.refreshCounts?.();
  syncNewsletterModalState();
  if (!force && newsletterSubscribed()) return;
  if (!force && sessionStorage.getItem('ssaNlDismissed') === '1') return;
  if (newsletterModal.classList.contains('open')) return;
  openModal(newsletterModal);
  if (!newsletterSubscribed()) {
    window.setTimeout(() => newsletterModalForm && newsletterModalForm.email.focus(), 80);
  }
}
window.openNewsletterModal = openNewsletterModal;

function closeNewsletterModal(dismiss) {
  if (!newsletterModal) return;
  closeModal(newsletterModal);
  if (dismiss) sessionStorage.setItem('ssaNlDismissed', '1');
}

newsletterSkip && newsletterSkip.addEventListener('click', () => closeNewsletterModal(true));
attachModalClose(newsletterModal, () => closeNewsletterModal(true));
if (newsletterModalForm) {
  newsletterModalForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = newsletterModalForm.email.value.trim();
    const button = newsletterModalForm.querySelector('button');
    const out = newsletterModalForm.querySelector('output');
    button.disabled = true;
    try {
      await postJson('/api/newsletter', { email });
      localStorage.setItem('ssaNewsletterSubscribed', '1');
      syncNewsletterModalState();
      window.ssaNewsletter?.refreshCounts?.();
      window.markChecklistStep?.('newsletter', 'Newsletter saved. Checklist complete.');
      if (out) out.textContent = 'You are in. Welcome to SSA.';
      window.setTimeout(() => closeNewsletterModal(false), 1100);
    } catch (error) {
      if (out) out.textContent = 'Could not save yet — try again in a moment.';
    } finally {
      window.setTimeout(() => { button.disabled = false; }, 1200);
    }
  });
}

if (sessionStorage.getItem('ssaOpenNewsletter') === '1') {
  sessionStorage.removeItem('ssaOpenNewsletter');
  window.setTimeout(() => openNewsletterModal(true), 300);
}

const sideNav = document.getElementById('sideNav');
const sideLinks = sideNav ? Array.from(sideNav.querySelectorAll('a[href^="#"]')) : [];
const sideSections = sideLinks
  .map((link) => ({ link, section: document.getElementById(link.getAttribute('href').slice(1)) }))
  .filter((item) => item.section);
const heroSection = document.getElementById('hero');

function updateActiveNav() {
  const y = window.scrollY + window.innerHeight * 0.35;
  let active = sideSections[0];
  sideSections.forEach((item) => {
    if (item.section.offsetTop <= y) active = item;
  });
  sideLinks.forEach((link) => link.classList.remove('active'));
  if (active) active.link.classList.add('active');

  if (sideNav && heroSection) {
    const pastHero = window.scrollY > heroSection.offsetHeight * 0.6;
    sideNav.classList.toggle('visible', pastHero);
  }
}
window.addEventListener('scroll', updateActiveNav, { passive: true });
window.addEventListener('resize', updateActiveNav);
updateActiveNav();

let sideRevealTimer = 0;
sideLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    const target = document.getElementById(link.getAttribute('href').slice(1));
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    sideLinks.forEach((other) => other.classList.remove('revealed'));
    link.classList.add('revealed');
    window.clearTimeout(sideRevealTimer);
    sideRevealTimer = window.setTimeout(() => link.classList.remove('revealed'), 1600);
  });
});
