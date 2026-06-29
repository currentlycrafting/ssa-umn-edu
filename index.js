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
  document.querySelectorAll('[data-open-signup]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      signupMenu.classList.add('open');
      signupToggle.setAttribute('aria-expanded', 'true');
      signupToggle.focus();
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
const rsvpClose = document.getElementById('rsvpClose');
const rsvpForm = document.getElementById('rsvpForm');
const rsvpTitle = document.getElementById('rsvpTitle');
const rsvpMeta = document.getElementById('rsvpMeta');
const rsvpResult = document.getElementById('rsvpResult');
let rsvpLocked = false;

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
  if (rsvpResult) { rsvpResult.hidden = true; rsvpResult.innerHTML = ''; }
  rsvpModal.classList.add('open');
  rsvpModal.setAttribute('aria-hidden', 'false');

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
  rsvpModal.classList.remove('open');
  rsvpModal.setAttribute('aria-hidden', 'true');
  rsvpLocked = false;
}

document.querySelectorAll('.rsvp-button').forEach((button) => {
  button.addEventListener('click', () => {
    openRsvpModal(button.dataset.event || 'SSA Event', button.dataset.date || 'Date TBD');
  });
});
rsvpClose && rsvpClose.addEventListener('click', closeRsvpModal);
rsvpModal && rsvpModal.addEventListener('click', (event) => {
  if (event.target === rsvpModal && !rsvpLocked) closeRsvpModal();
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !rsvpLocked) closeRsvpModal();
});
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
const newsletterClose = document.getElementById('newsletterClose');
const newsletterSkip = document.getElementById('newsletterSkip');
const contactSection = document.getElementById('contact');

function newsletterSubscribed() {
  return localStorage.getItem('ssaNewsletterSubscribed') === '1';
}
function openNewsletterModal() {
  if (!newsletterModal || newsletterSubscribed()) return;
  if (sessionStorage.getItem('ssaNlDismissed') === '1') return;
  if (newsletterModal.classList.contains('open')) return;
  newsletterModal.classList.add('open');
  newsletterModal.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => newsletterModalForm && newsletterModalForm.email.focus(), 80);
}
function closeNewsletterModal(dismiss) {
  if (!newsletterModal) return;
  newsletterModal.classList.remove('open');
  newsletterModal.setAttribute('aria-hidden', 'true');
  if (dismiss) sessionStorage.setItem('ssaNlDismissed', '1');
}

if (contactSection && newsletterModal) {
  const nlObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) openNewsletterModal(); });
  }, { threshold: 0.45 });
  nlObserver.observe(contactSection);
}
newsletterClose && newsletterClose.addEventListener('click', () => closeNewsletterModal(true));
newsletterSkip && newsletterSkip.addEventListener('click', () => closeNewsletterModal(true));
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
const kofiClose = document.getElementById('kofiClose');
const kofiFrame = document.getElementById('kofiframe');
const KOFI_SRC = 'https://ko-fi.com/somalistudentassociation/?hidefeed=true&widget=true&embed=true&preview=true';

function openKofiModal() {
  if (!kofiModal) return;
  if (kofiFrame && !kofiFrame.src) kofiFrame.src = KOFI_SRC;
  kofiModal.classList.add('open');
  kofiModal.setAttribute('aria-hidden', 'false');
}
function closeKofiModal() {
  if (!kofiModal) return;
  kofiModal.classList.remove('open');
  kofiModal.setAttribute('aria-hidden', 'true');
}
kofiOpen && kofiOpen.addEventListener('click', openKofiModal);
kofiClose && kofiClose.addEventListener('click', closeKofiModal);
kofiModal && kofiModal.addEventListener('click', (event) => {
  if (event.target === kofiModal) closeKofiModal();
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeKofiModal();
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
