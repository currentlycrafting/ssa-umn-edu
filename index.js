const fadeEls = document.querySelectorAll('.section, .stat-card, .event-card, .program-card, .focus-card, .board-card, .president-card, .form-card, .mission-item, .donation-card, .carousel-section');
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });
fadeEls.forEach((el) => {
  el.classList.add('fade-up');
  observer.observe(el);
});

// Stagger children inside grids so cards cascade in instead of all at once
document.querySelectorAll('.stat-grid, .event-grid, .focus-grid, .board-grid, .mission-list, .donation-grid').forEach((grid) => {
  Array.from(grid.children).forEach((child, i) => {
    child.style.setProperty('--stagger', `${Math.min(i * 70, 420)}ms`);
  });
});

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
    const back = window.setInterval(() => {
      year -= 1;
      flipTo(year);
      if (year <= START_YEAR) {
        window.clearInterval(back);
        window.setTimeout(() => {
          ymYear.classList.remove('flip');
          ymYear.classList.add('done');
          ymYear.textContent = `Since ${START_YEAR}`;
        }, 220);
      }
    }, 45);
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

const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('ssaTheme', next);
  });
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
    // Progressive disclosure: reveal the section name only after the user clicks.
    sideLinks.forEach((other) => other.classList.remove('revealed'));
    link.classList.add('revealed');
    window.clearTimeout(sideRevealTimer);
    sideRevealTimer = window.setTimeout(() => link.classList.remove('revealed'), 1600);
  });
});

const signupMenu = document.querySelector('.signup-menu');
const signupToggle = document.getElementById('signupToggle');
if (signupMenu && signupToggle) {
  signupToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = signupMenu.classList.toggle('open');
    signupToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.querySelectorAll('[data-open-connect]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      openConnectModal();
    });
  });
  document.addEventListener('click', (event) => {
    if (!signupMenu.contains(event.target)) {
      signupMenu.classList.remove('open');
      signupToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

document.querySelectorAll('.micro-button:not(.rsvp-button)').forEach((button) => {
  button.addEventListener('click', () => {
    button.classList.toggle('done');
    button.textContent = button.classList.contains('done') ? 'Saved' : button.dataset.original || button.textContent;
  }, { once: false });
  button.dataset.original = button.textContent;
});

const carousel = document.getElementById('storyCarousel');
if (carousel) {
  const slides = Array.from(carousel.querySelectorAll('.carousel-slide'));
  const dotsRoot = document.getElementById('carouselDots');
  let index = 0;
  let timer = 0;
  const intervalMs = 5000;

  dotsRoot.innerHTML = slides.map((_, i) => `<button class="carousel-dot ${i === 0 ? 'active' : ''}" type="button" aria-label="Go to story ${i + 1}"><span></span></button>`).join('');
  const dots = Array.from(dotsRoot.querySelectorAll('.carousel-dot'));

  function showSlide(next, userInitiated = false) {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, i) => slide.classList.toggle('active', i === index));
    dots.forEach((dot, i) => {
      dot.classList.remove('active');
      void dot.offsetWidth;
      dot.classList.toggle('active', i === index);
    });
    if (userInitiated) restartCarousel();
  }

  function restartCarousel() {
    window.clearInterval(timer);
    timer = window.setInterval(() => showSlide(index + 1), intervalMs);
  }

  carousel.querySelector('[data-carousel-prev]').addEventListener('click', () => showSlide(index - 1, true));
  carousel.querySelector('[data-carousel-next]').addEventListener('click', () => showSlide(index + 1, true));
  dots.forEach((dot, i) => dot.addEventListener('click', () => showSlide(i, true)));

  // Card swipe: drag/swipe the track to move between slides
  const track = carousel.querySelector('.carousel-track');
  let dragStartX = null;
  if (track) {
    track.addEventListener('pointerdown', (event) => {
      dragStartX = event.clientX;
      track.classList.add('dragging');
      track.setPointerCapture(event.pointerId);
    });
    track.addEventListener('pointermove', (event) => {
      if (dragStartX === null) return;
      const dx = event.clientX - dragStartX;
      const active = slides[index];
      if (active) active.style.transform = `translateX(${dx * 0.4}px) scale(1)`;
    });
    const endDrag = (event) => {
      if (dragStartX === null) return;
      const dx = event.clientX - dragStartX;
      const active = slides[index];
      if (active) active.style.transform = '';
      track.classList.remove('dragging');
      dragStartX = null;
      if (Math.abs(dx) > 60) showSlide(index + (dx < 0 ? 1 : -1), true);
    };
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
  }

  restartCarousel();
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function getJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function attachModalClose(backdrop, closeFn, canClose = () => true) {
  if (!backdrop || backdrop.querySelector('.modal-exit')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'modal-exit';
  btn.setAttribute('aria-label', 'Close');
  btn.innerHTML =
    '<svg viewBox="0 0 44 44" aria-hidden="true">' +
    '<path class="modal-exit-path" d="M22 6 C33 5 38 15 38 22 C38 33 29 38 22 38 C11 38 6 29 6 22 C6 11 14 6 22 6 Z"/>' +
    '</svg>';
  btn.addEventListener('click', () => {
    if (canClose()) closeFn();
  });
  backdrop.appendChild(btn);
  return btn;
}

function openModal(backdrop) {
  if (!backdrop) return;
  backdrop.classList.add('open');
  backdrop.setAttribute('aria-hidden', 'false');
}
function closeModal(backdrop) {
  if (!backdrop) return;
  backdrop.classList.remove('open');
  backdrop.setAttribute('aria-hidden', 'true');
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
      markChecklistStep('newsletter', 'Newsletter saved. That checklist step is now complete.');
      newsletterForm.reset();
      setOutput(newsletterForm, 'Subscribed and saved.');
      button.textContent = 'Subscribed';
      button.classList.add('micro-button', 'done');
    } catch (error) {
      setOutput(newsletterForm, 'Run python3 server.py to save subscriptions.', false);
    } finally {
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = 'Subscribe';
        button.classList.remove('done');
      }, 1800);
    }
  });
}

const messageForm = document.getElementById('messageForm');
if (messageForm) {
  messageForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = {
      name: messageForm.name.value.trim(),
      email: messageForm.email.value.trim(),
      message: messageForm.message.value.trim()
    };
    const button = messageForm.querySelector('button');
    button.disabled = true;
    try {
      await postJson('/api/messages', payload);
      messageForm.reset();
      setOutput(messageForm, 'Message saved.');
      button.textContent = 'Sent';
    } catch (error) {
      setOutput(messageForm, 'Run python3 server.py to save messages.', false);
    } finally {
      window.setTimeout(() => {
        button.disabled = false;
        button.textContent = 'Send Message';
      }, 1800);
    }
  });
}

const rsvpModal = document.getElementById('rsvpModal');
const rsvpForm = document.getElementById('rsvpForm');
const rsvpTitle = document.getElementById('rsvpTitle');
const rsvpMeta = document.getElementById('rsvpMeta');
const rsvpResult = document.getElementById('rsvpResult');
let rsvpLocked = false;
let rsvpExitBtn = null;

function syncRsvpExitButton() {
  if (!rsvpExitBtn) return;
  rsvpExitBtn.disabled = rsvpLocked;
}

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
function updateRsvpCard(eventName, count) {
  document.querySelectorAll('.rsvp-button').forEach((btn) => {
    if (btn.dataset.event === eventName) {
      btn.classList.add('going');
      btn.textContent = count ? `Going · ${count} coming` : 'Going · see who';
    }
  });
}

function renderRsvpResult(data, already) {
  if (!rsvpResult) return;
  const count = data.count || 0;
  const attendees = (data.attendees || []).map((a) =>
    typeof a === 'string' ? { name: a, email: '' } : a
  );
  const headline = already ? 'You\u2019re already on this list.' : 'You\u2019re on the list.';
  const items = attendees
    .map(
      (a) =>
        `<li class="rsvp-attendee" tabindex="0">` +
        `<span class="rsvp-name">${escapeHtml(a.name)}</span>` +
        (a.email
          ? `<span class="rsvp-email">${escapeHtml(a.email)}</span>`
          : '') +
        `</li>`
    )
    .join('');
  rsvpResult.innerHTML =
    `<p class="rsvp-count">${count} ${count === 1 ? 'person' : 'people'} coming</p>` +
    `<p class="rsvp-note">${headline} Tap a name to see their email.</p>` +
    `<ul class="rsvp-list">${items}</ul>`;
  rsvpResult.querySelectorAll('.rsvp-attendee').forEach((li) => {
    li.addEventListener('click', () => li.classList.toggle('show-email'));
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        li.classList.toggle('show-email');
      }
    });
  });
  rsvpForm.hidden = true;
  rsvpResult.hidden = false;
  rsvpLocked = true;
  syncRsvpExitButton();
}

async function openRsvpModal(eventName, eventDate) {
  if (!rsvpModal || !rsvpForm) return;
  rsvpTitle.textContent = eventName;
  rsvpMeta.textContent = eventDate;
  rsvpForm.event.value = eventName;
  rsvpForm.date.value = eventDate;
  rsvpForm.querySelector('output').textContent = '';
  rsvpForm.hidden = false;
  rsvpLocked = false;
  syncRsvpExitButton();
  if (rsvpResult) { rsvpResult.hidden = true; rsvpResult.innerHTML = ''; }
  openModal(rsvpModal);
  if (getRsvpedEvents().includes(eventName)) {
    try {
      const data = await getJson('/api/rsvp?event=' + encodeURIComponent(eventName));
      renderRsvpResult(data, true);
      return;
    } catch (error) {
      /* server offline — fall back to the form */
    }
  }
  window.setTimeout(() => rsvpForm.name.focus(), 50);
}

function closeRsvpModal() {
  if (!rsvpModal) return;
  closeModal(rsvpModal);
  rsvpLocked = false;
  syncRsvpExitButton();
}

document.querySelectorAll('.rsvp-button').forEach((button) => {
  button.addEventListener('click', () => {
    openRsvpModal(button.dataset.event || 'SSA Event', button.dataset.date || 'Date TBD');
  });
});
rsvpExitBtn = attachModalClose(rsvpModal, closeRsvpModal, () => !rsvpLocked);
if (rsvpForm) {
  rsvpForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const eventName = rsvpForm.event.value;
    const payload = {
      event: eventName,
      date: rsvpForm.date.value,
      name: rsvpForm.name.value.trim(),
      email: rsvpForm.email.value.trim()
    };
    const button = rsvpForm.querySelector('button');
    button.disabled = true;
    try {
      const data = await postJson('/api/rsvp', payload);
      markChecklistStep('events', 'RSVP interest saved. Events step complete.');
      addRsvpedEvent(eventName);
      updateRsvpCard(eventName, data.count || 0);
      renderRsvpResult(data, data.already);
      rsvpForm.reset();
    } catch (error) {
      setOutput(rsvpForm, 'Run python3 server.py to save RSVP interest.', false);
      button.disabled = false;
    }
  });
}

// On load, mark events the user already RSVP'd to and refresh their counts
getRsvpedEvents().forEach((name) => {
  getJson('/api/rsvp?event=' + encodeURIComponent(name))
    .then((data) => updateRsvpCard(name, data.count || 0))
    .catch(() => updateRsvpCard(name, 0));
});

// Full-screen newsletter takeover — appears when the user reaches the contact section
const newsletterModal = document.getElementById('newsletterModal');
const newsletterModalForm = document.getElementById('newsletterModalForm');
const newsletterSkip = document.getElementById('newsletterSkip');
const contactSection = document.getElementById('contact');

function newsletterSubscribed() {
  return localStorage.getItem('ssaNewsletterSubscribed') === '1';
}
function openNewsletterModal() {
  if (!newsletterModal || newsletterSubscribed()) return;
  if (sessionStorage.getItem('ssaNlDismissed') === '1') return;
  if (newsletterModal.classList.contains('open')) return;
  openModal(newsletterModal);
  window.setTimeout(() => newsletterModalForm && newsletterModalForm.email.focus(), 80);
}
function closeNewsletterModal(dismiss) {
  if (!newsletterModal) return;
  closeModal(newsletterModal);
  if (dismiss) sessionStorage.setItem('ssaNlDismissed', '1');
}

if (contactSection && newsletterModal) {
  const nlObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) openNewsletterModal(); });
  }, { threshold: 0.45 });
  nlObserver.observe(contactSection);
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
      markChecklistStep('newsletter', 'Newsletter saved. Checklist complete.');
      if (out) out.textContent = 'You are in. Welcome to SSA.';
      window.setTimeout(() => closeNewsletterModal(false), 1100);
    } catch (error) {
      if (out) out.textContent = 'Run python3 server.py to save your subscription.';
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
    openNewsletterModal();
  });
});

const checklistTrigger = document.getElementById('checklistTrigger');
const checklistPanel = document.getElementById('checklistPanel');
const checklistClose = document.getElementById('checklistClose');
const checklistSteps = document.getElementById('checklistSteps');
const checklistProgress = document.getElementById('checklistProgress');
const checklistCount = document.getElementById('checklistCount');
const checklistLabel = document.getElementById('checklistLabel');
const checklistPop = document.getElementById('checklistPop');
const checklistReset = document.getElementById('checklistReset');
const checklistRing = document.getElementById('checklistRing');
const checklistRingText = document.getElementById('checklistRingText');
let completedSteps = JSON.parse(localStorage.getItem('ssaChecklist') || '[]');

const CHECKLIST_TOTAL = 4;
const progressMessages = [
  'Pick a step. Each one explains the page and moves you to the right section.',
  'Nice start. Keep going to learn how SSA works.',
  'You are getting the full picture of SSA.',
  'Almost there. One last step: the newsletter.',
  'All done. You are ready for SSA.'
];

function stepKey(button) {
  return button.dataset.step || button.dataset.target + button.textContent;
}

function pulseRing() {
  if (!checklistRing) return;
  checklistRing.classList.remove('pulse');
  void checklistRing.offsetWidth;
  checklistRing.classList.add('pulse');
}

function updateChecklist(animate) {
  const total = CHECKLIST_TOTAL;
  const count = Math.min(completedSteps.length, total);
  const pct = Math.round((count / total) * 100);
  checklistProgress.style.width = `${pct}%`;
  checklistCount.textContent = String(count);
  if (checklistRingText) checklistRingText.textContent = count === total ? '✓' : String(count);
  checklistLabel.textContent = count ? (count === total ? 'Done' : `${count} of ${total}`) : 'Start';
  checklistTrigger.style.setProperty('--progress', `${pct}%`);
  checklistPanel.classList.toggle('complete', count === total);
  checklistSteps.querySelectorAll('button').forEach((button) => {
    button.classList.toggle('done', completedSteps.includes(stepKey(button)));
  });
  if (animate) pulseRing();
  localStorage.setItem('ssaChecklist', JSON.stringify(completedSteps));
}

function setProgressMessage() {
  if (checklistPop) checklistPop.textContent = progressMessages[Math.min(completedSteps.length, CHECKLIST_TOTAL)];
}

function markChecklistStep(step, note) {
  if (!checklistSteps) return;
  const button = checklistSteps.querySelector(`[data-step="${step}"]`);
  if (!button) return;
  const key = stepKey(button);
  const wasDone = completedSteps.includes(key);
  if (!wasDone) completedSteps.push(key);
  if (checklistPop && note) checklistPop.textContent = note;
  updateChecklist(!wasDone);
}

function openChecklist(open) {
  checklistPanel.classList.toggle('open', open);
  checklistPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
  checklistTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
}

if (checklistTrigger && checklistPanel) {
  checklistTrigger.addEventListener('click', () => openChecklist(!checklistPanel.classList.contains('open')));
  checklistClose.addEventListener('click', () => openChecklist(false));
  checklistSteps.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => {
      const id = stepKey(button);
      const target = document.getElementById(button.dataset.target);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (button.dataset.step === 'newsletter' && localStorage.getItem('ssaNewsletterSubscribed') !== '1') {
        checklistPop.textContent = 'Subscribe in the popup to complete this step.';
        sessionStorage.removeItem('ssaNlDismissed');
        openNewsletterModal();
        updateChecklist();
        return;
      }
      const wasDone = completedSteps.includes(id);
      if (!wasDone) completedSteps.push(id);
      else completedSteps = completedSteps.filter((step) => step !== id);
      checklistPop.textContent = button.dataset.note || '';
      updateChecklist(!wasDone);
    });
  });
  checklistReset.addEventListener('click', () => {
    completedSteps = [];
    checklistPop.textContent = 'Checklist reset. Pick a step to learn what it does.';
    updateChecklist(true);
  });
  setProgressMessage();
  if (localStorage.getItem('ssaNewsletterSubscribed') === '1') markChecklistStep('newsletter');
  updateChecklist();
}

// Connect with SSA modal — reason picker then tailored form
const connectModal = document.getElementById('connectModal');
const connectStepReason = document.getElementById('connectStepReason');
const connectStepForm = document.getElementById('connectStepForm');
const connectForm = document.getElementById('connectForm');
const connectBack = document.getElementById('connectBack');
const connectFormTitle = document.getElementById('connectFormTitle');
const connectFormLead = document.getElementById('connectFormLead');
const connectReasonLabel = document.getElementById('connectReasonLabel');
const connectOrgField = document.getElementById('connectOrgField');

const CONNECT_VIEWS = {
  sponsorship: {
    label: 'Sponsorship',
    title: 'Sponsor SSA',
    lead: 'Tell us about your organization and what kind of sponsorship you have in mind.',
    orgPlaceholder: 'Company or organization',
    showOrg: true,
    detailsPlaceholder: 'What would sponsorship look like? Goals, timeline, or budget range…'
  },
  collaborations: {
    label: 'Collaborations',
    title: 'Collaborate with SSA',
    lead: 'Share what you are building and how SSA could collaborate.',
    orgPlaceholder: 'Team, org, or project name',
    showOrg: true,
    detailsPlaceholder: 'Describe the collaboration you have in mind…'
  },
  partnerships: {
    label: 'Partnerships',
    title: 'Partnership inquiry',
    lead: 'Let us know what partnership would look like for your org and SSA.',
    orgPlaceholder: 'Organization name',
    showOrg: true,
    detailsPlaceholder: 'What kind of partnership are you proposing?'
  },
  board: {
    label: 'Board interest',
    title: 'Join the board',
    lead: 'Share why you want to serve and what you would bring to SSA leadership.',
    orgPlaceholder: 'Year at UMN (optional)',
    showOrg: true,
    detailsPlaceholder: 'Why do you want to join the board? Relevant experience and goals…'
  },
  ideas: {
    label: 'Idea pitch',
    title: 'Pitch your idea',
    lead: 'Have something SSA should do? We want to hear it.',
    orgPlaceholder: 'Idea title (optional)',
    showOrg: true,
    detailsPlaceholder: 'Describe your idea and how SSA could help make it happen.'
  }
};

function resetConnectModal() {
  if (!connectStepReason || !connectStepForm || !connectForm) return;
  connectStepReason.hidden = false;
  connectStepForm.hidden = true;
  connectForm.reset();
  const out = connectForm.querySelector('output');
  if (out) out.textContent = '';
}

function openConnectModal() {
  if (!connectModal) return;
  resetConnectModal();
  openModal(connectModal);
}

function showConnectForm(reason) {
  const view = CONNECT_VIEWS[reason];
  if (!view || !connectForm) return;
  connectForm.reason.value = reason;
  if (connectReasonLabel) connectReasonLabel.textContent = view.label;
  if (connectFormTitle) connectFormTitle.textContent = view.title;
  if (connectFormLead) connectFormLead.textContent = view.lead;
  if (connectOrgField) {
    connectOrgField.placeholder = view.orgPlaceholder;
    connectOrgField.hidden = !view.showOrg;
    connectOrgField.required = false;
  }
  const details = connectForm.details;
  if (details) details.placeholder = view.detailsPlaceholder;
  connectStepReason.hidden = true;
  connectStepForm.hidden = false;
  window.setTimeout(() => connectForm.name.focus(), 60);
}

document.querySelectorAll('.connect-option').forEach((button) => {
  button.addEventListener('click', () => showConnectForm(button.dataset.reason));
});
connectBack && connectBack.addEventListener('click', resetConnectModal);

if (connectForm) {
  connectForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = connectForm.querySelector('button[type="submit"]');
    const payload = {
      reason: connectForm.reason.value,
      name: connectForm.name.value.trim(),
      email: connectForm.email.value.trim(),
      organization: connectForm.organization.value.trim(),
      details: connectForm.details.value.trim()
    };
    submitBtn.disabled = true;
    try {
      await postJson('/api/connect', payload);
      setOutput(connectForm, 'Sent. SSA will follow up soon.');
      window.setTimeout(() => closeModal(connectModal), 1200);
    } catch (error) {
      setOutput(connectForm, 'Run python3 server.py to save your request.', false);
    } finally {
      window.setTimeout(() => { submitBtn.disabled = false; }, 1200);
    }
  });
}
attachModalClose(connectModal, () => closeModal(connectModal));

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

function renderAdminTab(tab) {
  if (!adminBody || !adminData) return;
  adminTab = tab;
  document.querySelectorAll('.admin-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  const rows = adminData[tab] || [];
  if (!rows.length) {
    adminBody.innerHTML = '<p class="admin-empty">No submissions yet.</p>';
    return;
  }
  adminBody.innerHTML = rows.map((row) => {
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
        `<span class="admin-row-detail">${escapeHtml(row.email)}</span>`,
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
  }).join('');
}

async function loadAdminData() {
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
