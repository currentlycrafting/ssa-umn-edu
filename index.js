// Scroll reveals + stagger handled by micro.js

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

// Stat-card progress bars animate when scrolled into view
const statObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('bar-in');
      statObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.3 });
document.querySelectorAll('.stat-card').forEach((card) => statObserver.observe(card));

// Stat info: click the "i" to toggle its tooltip (hovering shows the help cursor)
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

const signupMenu = document.querySelector('.signup-menu');
const signupToggle = document.getElementById('signupToggle');
if (signupMenu && signupToggle) {
  signupToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = signupMenu.classList.toggle('open');
    signupToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', (event) => {
    if (!signupMenu.contains(event.target)) {
      signupMenu.classList.remove('open');
      signupToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

function updateOptionsMenu() {
  const newsletterOption = document.getElementById('newsletterOption');
  if (newsletterOption) {
    newsletterOption.hidden = localStorage.getItem('ssaNewsletterSubscribed') === '1';
  }
}
updateOptionsMenu();

document.querySelectorAll('.micro-button:not(.rsvp-button)').forEach((button) => {
  button.addEventListener('click', () => {
    button.classList.toggle('done');
    button.textContent = button.classList.contains('done') ? 'Saved' : button.dataset.original || button.textContent;
  }, { once: false });
  button.dataset.original = button.textContent;
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

function setButtonLoading(button, loading) {
  if (!button) return;
  button.classList.toggle('is-loading', loading);
  button.disabled = !!loading;
}

function modalExitSvg() {
  return (
    '<svg viewBox="0 0 44 44" aria-hidden="true">' +
    '<path class="modal-exit-path" d="M22 6 C33 5 38 15 38 22 C38 33 29 38 22 38 C11 38 6 29 6 22 C6 11 14 6 22 6 Z"/>' +
    '<path class="modal-exit-x" d="M16.5 16.5 L27.5 27.5 M27.5 16.5 L16.5 27.5"/>' +
    '</svg>'
  );
}

function attachModalClose(backdrop, closeFn, canClose = () => true) {
  if (!backdrop || backdrop.dataset.modalBound === 'true') return;
  backdrop.dataset.modalBound = 'true';
  let btn = backdrop.querySelector('.modal-exit');
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'modal-exit';
    btn.setAttribute('aria-label', 'Close');
    btn.innerHTML = modalExitSvg();
    backdrop.appendChild(btn);
  }
  btn.addEventListener('click', () => {
    if (canClose()) closeFn();
  });
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop && canClose()) closeFn();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && backdrop.classList.contains('open') && canClose()) closeFn();
  });
  return btn;
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

function formatAdminDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${date}<br>${time}`;
}

function adminRow(mainHtml, iso) {
  return (
    `<article class="admin-row">` +
    `<div class="admin-row-main">${mainHtml}</div>` +
    `<time class="admin-row-date">${formatAdminDate(iso)}</time>` +
    `</article>`
  );
}

function setOutput(form, message, ok = true) {
  const out = form.querySelector('output');
  if (!out) return;
  out.textContent = message;
  out.style.color = ok ? 'oklch(50% 0.1 150)' : 'oklch(50% 0.12 25)';
}

const newsletterForm = document.getElementById('newsletterForm');
if (newsletterForm) {
  newsletterForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = newsletterForm.email.value.trim();
    const button = newsletterForm.querySelector('button');
    button.disabled = true;
    try {
      await postJson('/api/newsletter', { email });
      localStorage.setItem('ssaNewsletterSubscribed', '1');
      updateOptionsMenu();
      window.ssaNewsletter?.refreshCounts?.();
      window.markChecklistStep?.('newsletter', 'Newsletter saved. That checklist step is now complete.');
      newsletterForm.reset();
      setOutput(newsletterForm, 'Subscribed and saved.');
      button.textContent = 'Subscribed';
      button.classList.add('micro-button', 'done');
    } catch (error) {
      setOutput(newsletterForm, 'Could not save yet — the server may still be waking up. Try again.', false);
    } finally {
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = 'Subscribe';
        button.classList.remove('done');
      }, 1800);
    }
  });
}


if (false) {
const rsvpModal = document.getElementById('rsvpModal');
const rsvpForm = document.getElementById('rsvpForm');
const rsvpTitle = document.getElementById('rsvpTitle');
const rsvpMeta = document.getElementById('rsvpMeta');
const rsvpModalCount = document.getElementById('rsvpModalCount');
const rsvpResult = document.getElementById('rsvpResult');
const rsvpCounts = {};
let rsvpShowGoing = false;

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getRsvpedEvents() {
  return JSON.parse(localStorage.getItem('ssaRsvpedEvents') || '[]');
}

function addRsvpedEvent(name) {
  const list = getRsvpedEvents();
  if (!list.includes(name)) {
    list.push(name);
    localStorage.setItem('ssaRsvpedEvents', JSON.stringify(list));
  }
}

function goingLabel(count) {
  const n = count || 0;
  const word = n === 1 ? 'person' : 'people';
  return `Going · ${n} ${word}`;
}

function syncRsvpButtonLabel(btn) {
  const label = btn.querySelector('.rsvp-btn-label');
  if (!label) return;
  const count = parseInt(btn.dataset.count || '0', 10);
  label.textContent = rsvpShowGoing ? goingLabel(count) : 'RSVP';
  btn.classList.toggle('rsvp-show-going', rsvpShowGoing);
}

function setRsvpCount(eventName, count) {
  rsvpCounts[eventName] = count;
  document.querySelectorAll(`[data-event-count="${eventName}"]`).forEach((el) => {
    el.textContent = String(count);
  });
  document.querySelectorAll('.rsvp-button').forEach((btn) => {
    if (btn.dataset.event !== eventName) return;
    btn.dataset.count = String(count);
    if (getRsvpedEvents().includes(eventName)) btn.classList.add('going');
    syncRsvpButtonLabel(btn);
  });
}

async function loadRsvpSummary() {
  try {
    const data = await getJson('/api/rsvp/summary');
    const events = data.events || {};
    document.querySelectorAll('.rsvp-button').forEach((btn) => {
      setRsvpCount(btn.dataset.event, events[btn.dataset.event] || 0);
    });
  } catch (error) {
    document.querySelectorAll('.rsvp-button').forEach((btn) => {
      if (btn.dataset.count == null) setRsvpCount(btn.dataset.event, 0);
    });
  }
}

window.setInterval(() => {
  rsvpShowGoing = !rsvpShowGoing;
  document.querySelectorAll('.rsvp-button').forEach(syncRsvpButtonLabel);
}, 2800);

window.setInterval(loadRsvpSummary, 60000);
loadRsvpSummary();

function renderRsvpResult(data, already) {
  if (!rsvpResult) return;
  const count = data.count || 0;
  const attendees = (data.attendees || []).map((a) => typeof a === 'string' ? { name: a } : a);
  const headline = already ? 'You\u2019re already on this list.' : 'You\u2019re on the list.';
  const items = attendees.length
    ? attendees
        .map(
          (a) =>
            `<li class="rsvp-attendee"><span class="rsvp-name">${escapeHtml(a.name)}</span></li>`
        )
        .join('')
    : '<li class="rsvp-attendee rsvp-attendee-empty">No names yet — you might be the first.</li>';
  rsvpResult.innerHTML =
    `<p class="rsvp-note">${headline}</p>` +
    `<h3 class="rsvp-whos-coming">Who&apos;s coming</h3>` +
    `<p class="rsvp-count">${count} ${count === 1 ? 'person' : 'people'} total</p>` +
    `<ul class="rsvp-list">${items}</ul>`;
  if (rsvpModalCount) {
    rsvpModalCount.textContent = `${count} ${count === 1 ? 'person' : 'people'} coming so far`;
  }
  rsvpForm.hidden = true;
  rsvpResult.hidden = false;
}

async function showRsvpAttendees(eventName, data, already) {
  let payload = data;
  if (!payload?.attendees?.length) {
    try {
      payload = await getJson('/api/rsvp?event=' + encodeURIComponent(eventName));
    } catch (_) {}
  }
  renderRsvpResult(payload, already ?? payload?.already ?? false);
}

function syncRsvpEligibility(form) {
  const isStudent = form.elements.isStudent?.value;
  const ageQuestion = form.querySelector('.rsvp-age-question');
  ageQuestion.hidden = isStudent !== 'no';
  ageQuestion.querySelectorAll('input').forEach((input) => {
    input.required = isStudent === 'no' && input.value === 'yes';
    if (isStudent !== 'no') input.checked = false;
  });
}

function openRsvpModal(eventName, eventDate) {
  if (!rsvpModal || !rsvpForm) return;
  rsvpForm.reset();
  rsvpTitle.textContent = eventName;
  rsvpMeta.textContent = eventDate;
  rsvpForm.event.value = eventName;
  rsvpForm.date.value = eventDate;
  rsvpForm.querySelector('output').textContent = '';
  syncRsvpEligibility(rsvpForm);
  rsvpForm.hidden = false;
  if (rsvpResult) { rsvpResult.hidden = true; rsvpResult.innerHTML = ''; }
  const count = rsvpCounts[eventName] ?? 0;
  if (rsvpModalCount) {
    rsvpModalCount.textContent = `${count} ${count === 1 ? 'person' : 'people'} coming so far`;
  }
  openModal(rsvpModal);
  if (getRsvpedEvents().includes(eventName)) {
    rsvpForm.hidden = true;
    if (rsvpResult) {
      rsvpResult.hidden = false;
      rsvpResult.innerHTML = '<p class="rsvp-note">Loading who\'s coming…</p>';
    }
    getJson('/api/rsvp?event=' + encodeURIComponent(eventName))
      .then((data) => renderRsvpResult(data, true))
      .catch(() => {
        rsvpForm.hidden = false;
        if (rsvpResult) rsvpResult.hidden = true;
        setOutput(rsvpForm, 'Could not load RSVP list yet — you can still submit.', false);
        window.setTimeout(() => rsvpForm.name.focus(), 50);
      });
    return;
  }
  window.setTimeout(() => rsvpForm.name.focus(), 50);
}

function closeRsvpModal() {
  if (!rsvpModal) return;
  closeModal(rsvpModal);
}

document.querySelectorAll('.rsvp-button').forEach((button) => {
  button.addEventListener('click', () => {
    openRsvpModal(button.dataset.event || 'SSA Event', button.dataset.date || 'Date TBD');
  });
});
attachModalClose(rsvpModal, closeRsvpModal);
if (rsvpForm) {
  Array.from(rsvpForm.elements.isStudent).forEach((input) => {
    input.addEventListener('change', () => syncRsvpEligibility(rsvpForm));
  });
  rsvpForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const eventName = rsvpForm.event.value;
    const isStudent = rsvpForm.elements.isStudent.value === 'yes';
    const isOver18 = rsvpForm.elements.isOver18.value === 'yes';
    if (!isStudent && !isOver18) {
      setOutput(rsvpForm, 'You must be a U of MN student or at least 18 years old to RSVP.', false);
      return;
    }
    const payload = {
      event: eventName,
      date: rsvpForm.date.value,
      name: rsvpForm.name.value.trim(),
      isStudent,
      isOver18
    };
    const button = rsvpForm.querySelector('button');
    setButtonLoading(button, true);
    try {
      const data = await postJson('/api/rsvp', payload);
      window.markChecklistStep?.('events', 'RSVP saved. Events step complete.');
      addRsvpedEvent(eventName);
      setRsvpCount(eventName, data.count || 0);
      document.querySelectorAll('.rsvp-button').forEach((btn) => {
        if (btn.dataset.event === eventName) {
          btn.classList.add('going', 'saved-pop');
          window.setTimeout(() => btn.classList.remove('saved-pop'), 600);
        }
      });
      if (rsvpResult) {
        rsvpForm.hidden = true;
        rsvpResult.hidden = false;
        rsvpResult.innerHTML = '<p class="rsvp-note">Loading who&apos;s coming…</p>';
      }
      await showRsvpAttendees(eventName, data, data.already);
      rsvpForm.reset();
    } catch (error) {
      setOutput(rsvpForm, error.message || 'Could not save RSVP yet — try again in a moment.', false);
      setButtonLoading(button, false);
    }
  });
}
}

// Full-screen newsletter takeover — opened from Options menu, nav, or checklist
const newsletterModal = document.getElementById('newsletterModal');
const newsletterModalForm = document.getElementById('newsletterModalForm');
const newsletterSkip = document.getElementById('newsletterSkip');
const newsletterSubscribedMsg = document.getElementById('newsletterSubscribedMsg');
const nlLead = document.getElementById('nlLead');

async function loadNewsletterPolaroids() {
  const host = document.getElementById('newsletterPolaroids');
  if (!host) return;
  try {
    const data = await getJson('/api/gallery');
    host.innerHTML = (data.items || []).slice(0, 2).map((item, index) =>
      `<figure class="polaroid visible" style="--rot:${index ? '3deg' : '-3deg'}"><img src="${escapeHtml(item.src)}" alt="" /><figcaption>${escapeHtml(item.caption || 'SSA memory')}</figcaption></figure>`
    ).join('');
  } catch (_) {
    host.replaceChildren();
  }
}
loadNewsletterPolaroids();

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
      updateOptionsMenu();
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

// Ko-fi donation modal — iframe loads only when opened, so it stays out of the way
const kofiModal = document.getElementById('kofiModal');
const kofiOpen = document.getElementById('kofiOpen');
const kofiFrame = document.getElementById('kofiframe');
const KOFI_SRC = 'https://ko-fi.com/somalistudentassociation/?hidefeed=true&widget=true&embed=true&preview=true';

function openKofiModal() {
  if (!kofiModal) return;
  if (kofiFrame && !kofiFrame.src) kofiFrame.src = KOFI_SRC;
  openModal(kofiModal);
}
function closeKofiModal() {
  closeModal(kofiModal);
}
kofiOpen && kofiOpen.addEventListener('click', openKofiModal);
attachModalClose(kofiModal, closeKofiModal);

document.querySelectorAll('[data-open-newsletter]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    openNewsletterModal(true);
  });
});

if (sessionStorage.getItem('ssaOpenNewsletter') === '1') {
  sessionStorage.removeItem('ssaOpenNewsletter');
  window.setTimeout(() => openNewsletterModal(true), 300);
}

// Event suggestion modal
const suggestModal = document.getElementById('suggestModal');
const suggestForm = document.getElementById('suggestForm');
const suggestTitle = document.getElementById('suggestTitle');
const suggestLead = document.getElementById('suggestLead');
const suggestTypeInput = document.getElementById('suggestType');

const SUGGEST_COPY = {
  campus: {
    title: 'Suggest a campus event',
    lead: 'Large, social, attendance-driven ideas that grow SSA on campus.'
  },
  community: {
    title: 'Suggest a community event',
    lead: 'Intentional programming focused on depth, service, and connection.'
  }
};

function openSuggestModal(type = 'campus') {
  if (!suggestModal || !suggestForm) return;
  const copy = SUGGEST_COPY[type] || SUGGEST_COPY.campus;
  if (suggestTypeInput) suggestTypeInput.value = type;
  if (suggestTitle) suggestTitle.textContent = copy.title;
  if (suggestLead) suggestLead.textContent = copy.lead;
  suggestForm.reset();
  if (suggestTypeInput) suggestTypeInput.value = type;
  const out = suggestForm.querySelector('output');
  if (out) out.textContent = '';
  openModal(suggestModal);
}
window.openSuggestModal = openSuggestModal;

document.querySelectorAll('[data-suggest-event]').forEach((el) => {
  // Keyboard support for focusable program cards (click handled by nav.js)
  if (el.tagName === 'ARTICLE') {
    el.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openSuggestModal(el.dataset.suggestType || 'campus');
      }
    });
  }
});

if (suggestForm) {
  suggestForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = suggestForm.querySelector('button[type="submit"]');
    const payload = {
      type: suggestForm.type.value,
      name: suggestForm.name.value.trim(),
      description: suggestForm.description.value.trim(),
      audience: suggestForm.audience.value.trim(),
      budget: suggestForm.budget.value.trim(),
      preferredDate: suggestForm.preferredDate.value.trim(),
      notes: suggestForm.notes.value.trim()
    };
    submitBtn.disabled = true;
    submitBtn.classList.add('is-loading');
    try {
      await postJson('/api/event-suggestions', payload);
      setOutput(suggestForm, 'Thanks — the board will review your idea.');
      window.setTimeout(() => closeModal(suggestModal), 1400);
    } catch (error) {
      setOutput(suggestForm, error.message || 'Could not submit — try again.', false);
    } finally {
      window.setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.classList.remove('is-loading');
      }, 1200);
    }
  });
}

attachModalClose(suggestModal, () => closeModal(suggestModal));

const suggestParam = new URLSearchParams(window.location.search).get('suggest');
if (suggestParam) {
  window.setTimeout(() => openSuggestModal(suggestParam === 'community' ? 'community' : 'campus'), 400);
}

// Side nav scroll spy + connect button
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

// Admin panel — password-protected view of all submissions
const adminModal = document.getElementById('adminModal');
const adminToggle = document.getElementById('adminToggle');
const adminLogin = document.getElementById('adminLogin');
const adminPanel = document.getElementById('adminPanel');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminPassword = document.getElementById('adminPassword');
const adminBody = document.getElementById('adminBody');
const adminRefresh = document.getElementById('adminRefresh');
let adminPasswordMem = '';
let adminData = null;
let adminTab = 'newsletters';

function formatGameTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function attachAdminAuxClear() {
  const button = document.getElementById('adminAuxClear');
  if (!button) return;
  button.addEventListener('click', async () => {
    if (!window.confirm('Clear every song from the request queue?')) return;
    button.disabled = true;
    button.textContent = 'Clearing…';
    try {
      await postJson('/api/admin/aux/clear', { password: adminPasswordMem });
      await loadAdminData();
    } catch (error) {
      button.textContent = error.message || 'Try again';
      button.disabled = false;
    }
  });
}

function renderAdminTab(tab) {
  if (!adminBody || !adminData) return;
  adminTab = tab;
  document.querySelectorAll('.admin-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  const rows = adminData[tab] || [];
  if (!rows.length) {
    adminBody.innerHTML = tab === 'aux'
      ? '<div class="gallery-review-actions"><button class="micro-button" id="adminAuxClear" type="button">Clear request queue</button></div><p class="admin-empty">The request queue is empty.</p>'
      : '<p class="admin-empty">No submissions yet.</p>';
    attachAdminAuxClear();
    return;
  }
  const auxToolbar = tab === 'aux'
    ? '<div class="gallery-review-actions"><button class="micro-button" id="adminAuxClear" type="button">Clear request queue</button></div>'
    : '';
  adminBody.innerHTML = auxToolbar + '<div class="admin-body-fade">' + rows.map((row) => {
    if (tab === 'newsletters') {
      return adminRow(`<strong>${escapeHtml(row.email)}</strong>`, row.created_at);
    }
    if (tab === 'messages') {
      return adminRow(
        `<strong>${escapeHtml(row.name)}</strong>` +
        `<span class="admin-row-meta">${escapeHtml(row.email)}</span>` +
        `<span class="admin-row-detail">${escapeHtml(row.message)}</span>`,
        row.created_at
      );
    }
    if (tab === 'rsvp') {
      return adminRow(
        `<strong>${escapeHtml(row.name)}</strong>` +
        `<span class="admin-row-meta">${escapeHtml(row.event_name)} · ${escapeHtml(row.event_date)}</span>` +
        `<span class="admin-row-detail">${row.is_student ? 'U of MN student' : 'Community guest · 18+'}</span>`,
        row.created_at
      );
    }
    if (tab === 'scores') {
      const status = row.solved ? 'Solved' : 'Not solved';
      return adminRow(
        `<strong>${escapeHtml(row.name)}</strong>` +
        `<span class="admin-row-meta">${formatGameTime(row.seconds)} · ${row.mistakes} mistake${row.mistakes === 1 ? '' : 's'} · ${status}</span>`,
        row.created_at
      );
    }
    if (tab === 'event_suggestions') {
      return adminRow(
        `<strong>${escapeHtml(row.name)} · ${escapeHtml(row.type)}</strong>` +
        `<span class="admin-row-meta">${escapeHtml(row.audience || '—')}${row.preferred_date ? ` · ${escapeHtml(row.preferred_date)}` : ''}</span>` +
        `<span class="admin-row-detail">${escapeHtml(row.description)}</span>`,
        row.created_at
      );
    }
    if (tab === 'aux') {
      return adminRow(
        `<span style="display:flex;align-items:center;gap:12px">` +
        `<img src="${escapeHtml(row.albumImage || '/assets/brand/ssa-logo.png')}" alt="" style="width:52px;height:52px;border-radius:10px;object-fit:cover" />` +
        `<span style="display:grid;flex:1;min-width:0"><strong>${escapeHtml(row.songName)}</strong>` +
        `<span class="admin-row-meta">${escapeHtml(row.artist)} · requested by ${escapeHtml(row.requestedBy)}</span></span>` +
        `<button class="micro-button" type="button" data-aux-play="${row.id}">Play next</button></span>`,
        row.created_at
      );
    }
    const reason = row.reason.replace(/^\w/, (c) => c.toUpperCase());
    return adminRow(
      `<strong>${escapeHtml(row.name)} · ${escapeHtml(reason)}</strong>` +
      `<span class="admin-row-meta">${escapeHtml(row.email)}${row.organization ? ` · ${escapeHtml(row.organization)}` : ''}</span>` +
      `<span class="admin-row-detail">${escapeHtml(row.details)}</span>`,
      row.created_at
    );
  }).join('') + '</div>';
  adminBody.querySelectorAll('[data-aux-play]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Starting…';
      try {
        await postJson(`/api/admin/aux/${button.dataset.auxPlay}/play`, {
          password: adminPasswordMem
        });
        await loadAdminData();
      } catch (error) {
        button.textContent = error.message || 'Try again';
        button.disabled = false;
      }
    });
  });
  attachAdminAuxClear();
}

async function loadAdminData() {
  if (adminBody) adminBody.innerHTML = '<p class="admin-empty">Loading submissions…</p>';
  const data = await postJson('/api/admin', { password: adminPasswordMem });
  adminData = data;
  if (adminLogin) adminLogin.hidden = true;
  if (adminPanel) adminPanel.hidden = false;
  renderAdminTab(adminTab);
}

function openAdminModal() {
  if (!adminModal) return;
  openModal(adminModal);
  if (adminPasswordMem) {
    loadAdminData().catch(() => {
      adminPasswordMem = '';
      if (adminLogin) adminLogin.hidden = false;
      if (adminPanel) adminPanel.hidden = true;
    });
  } else {
    if (adminLogin) adminLogin.hidden = false;
    if (adminPanel) adminPanel.hidden = true;
    window.setTimeout(() => adminPassword && adminPassword.focus(), 60);
  }
}

adminToggle && adminToggle.addEventListener('click', openAdminModal);
attachModalClose(adminModal, () => closeModal(adminModal));

const adminPasswordToggle = document.getElementById('adminPasswordToggle');
if (adminPasswordToggle && adminPassword) {
  adminPasswordToggle.addEventListener('click', () => {
    const willShow = adminPassword.type === 'password';
    adminPassword.type = willShow ? 'text' : 'password';
    adminPasswordToggle.setAttribute('aria-pressed', willShow ? 'true' : 'false');
    adminPasswordToggle.setAttribute('aria-label', willShow ? 'Hide password' : 'Show password');
  });
}

if (adminLoginForm) {
  adminLoginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    adminPasswordMem = adminPassword.value;
    const button = adminLoginForm.querySelector('button');
    button.disabled = true;
    try {
      await loadAdminData();
      setOutput(adminLoginForm, 'Authenticated.');
    } catch (error) {
      adminPasswordMem = '';
      setOutput(adminLoginForm, 'Wrong password.', false);
    } finally {
      button.disabled = false;
    }
  });
}

document.querySelectorAll('.admin-tab').forEach((button) => {
  button.addEventListener('click', () => renderAdminTab(button.dataset.tab));
});

adminRefresh && adminRefresh.addEventListener('click', () => {
  if (!adminPasswordMem) return;
  loadAdminData().catch(() => setOutput(adminLoginForm, 'Could not refresh.', false));
});
