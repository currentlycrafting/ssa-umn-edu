(function () {
  const CHECKLIST_TOTAL = 12;
  const progressMessages = [
    'Pick a step. Each one opens that part of SSA with a quick tip.',
    'Nice start. Keep exploring.',
    'You are getting the full picture of SSA.',
    'Keep going — events, gallery, and more.',
    'Halfway there — keep going.',
    'Try the bulletin board and timeline next.',
    'You have seen most of what SSA offers.',
    'Almost done. A few more stops.',
    'Keep going — meet the board next.',
    'Almost there. Explore how to support SSA.',
    'One more stop before you finish.',
    'Last step: subscribe to the newsletter.',
    'All done. Any questions for us?'
  ];
  const MODAL_EXIT = '<svg viewBox="0 0 44 44" aria-hidden="true"><path class="modal-exit-path" d="M22 6 C33 5 38 15 38 22 C38 33 29 38 22 38 C11 38 6 29 6 22 C6 11 14 6 22 6 Z"/><path class="modal-exit-x" d="M16.5 16.5 L27.5 27.5 M27.5 16.5 L16.5 27.5"/></svg>';

  const CHECKLIST_HTML = `
  <button class="checklist-trigger" id="checklistTrigger" type="button" aria-expanded="false">
    <span class="ring" id="checklistRing" aria-hidden="true"><span id="checklistRingText">0</span></span>
    <span id="checklistLabel">Start</span>
  </button>
  <aside class="checklist-panel modal-backdrop whats-new-modal" id="checklistPanel" aria-hidden="true">
    <div class="whats-new-frame bulletin-flow-frame-solo checklist-frame">
      <div class="modal-sheet modal-card whats-new-sheet checklist-modal-card" role="dialog" aria-modal="true" aria-labelledby="checklistTitle">
        <article class="whats-new-card bulletin-flow-page is-active checklist-sheet-body">
          <header class="checklist-sheet-head">
            <div>
              <span class="eyebrow">Checklist</span>
              <h2 id="checklistTitle">Explore SSA</h2>
              <p><span id="checklistCount">0</span> of 12 complete</p>
            </div>
          </header>
          <div class="checklist-progress"><span id="checklistProgress"></span></div>
          <div class="checklist-pop" id="checklistPop" role="status"></div>
          <div class="checklist-steps" id="checklistSteps">
            <button type="button" data-step="about" data-href="index.html#hero" data-note="SSA is the cultural and community home base for Somali students at the U of M. Start here to learn who we are.">Learn about SSA</button>
            <button type="button" data-step="events" data-href="/events" data-note="Events are the fastest way to meet people. RSVP to the next mixer, culture night, or social.">Explore events</button>
            <button type="button" data-step="programs" data-href="/suggest" data-note="Suggest the next campus or community event. Share the vibe, a name, and optional inspiration.">Suggest an event</button>
            <button type="button" data-step="gallery" data-href="gallery.html" data-note="The gallery is SSA memories as polaroids. Scroll to the bottom to complete this step.">Visit the gallery</button>
            <button type="button" data-step="game" data-href="connections.html" data-note="Play the SSA game, then submit your score to complete this step.">Play a game</button>
            <button type="button" data-step="timeline" data-href="/timeline" data-note="The timeline is a scrapbook of SSA moments. Scroll to the bottom to finish this stop.">Browse the timeline</button>
            <button type="button" data-step="bulletin" data-href="/bulletin" data-note="Post or browse the community bulletin for roommates, study groups, and campus plans.">Visit the bulletin</button>
            <button type="button" data-step="schedule" data-href="/schedule" data-note="Create or unlock a board meeting schedule — useful for planning with leadership.">Try board scheduling</button>
            <button type="button" data-step="board" data-href="/board" data-note="Meet the students leading SSA, seated around the board table.">Meet the board</button>
            <button type="button" data-step="aux" data-href="/aux" data-note="Want the Aux lets anyone request a song while the host keeps the queue live.">Visit Want the Aux</button>
            <button type="button" data-step="donate" data-href="/donate" data-note="See how donations support SSA programming, culture nights, and community events.">Support SSA</button>
            <button type="button" data-step="newsletter" data-action="newsletter" data-note="The final step: subscribe so you never miss SSA news and events.">Subscribe to newsletter</button>
          </div>
          <div class="checklist-complete" id="checklistComplete">
            <span class="spark" aria-hidden="true">✓</span>
            <h3>Ready for SSA.</h3>
            <p>You explored everything SSA has to offer.</p>
            <button type="button" class="button button-dark" id="checklistConnectBtn">Any questions for us? <span class="icon-arrow" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h9M9 5l3 3-3 3"/></svg></span></button>
          </div>
          <button class="button button-line checklist-reset-btn" id="checklistReset" type="button">Reset checklist</button>
        </article>
      </div>
      <button class="modal-exit" id="checklistClose" type="button" aria-label="Close">${MODAL_EXIT}</button>
    </div>
  </aside>`;

  if (!document.getElementById('checklistTrigger')) {
    document.body.insertAdjacentHTML('beforeend', CHECKLIST_HTML);
  }

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
  let lastMarkedStep = '';

  function pageFile() {
    const path = window.location.pathname;
    const file = path.split('/').pop();
    return file || 'index.html';
  }

  function samePage(href) {
    const dest = new URL(href, window.location.href);
    const destFile = dest.pathname.split('/').pop() || 'index.html';
    const current = pageFile();
    return destFile === current || (destFile === 'index.html' && (current === '' || current === 'index.html'));
  }

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
    if (animate) {
      pulseRing();
      window.ssaPulse?.(checklistRing);
      const justDone = checklistSteps.querySelector(`[data-step="${lastMarkedStep}"]`);
      if (justDone) {
        justDone.classList.add('just-done');
        window.setTimeout(() => justDone.classList.remove('just-done'), 500);
      }
    }
    localStorage.setItem('ssaChecklist', JSON.stringify(completedSteps));
  }

  function setProgressMessage() {
    if (checklistPop) {
      checklistPop.textContent = progressMessages[Math.min(completedSteps.length, CHECKLIST_TOTAL)];
    }
  }

  function markChecklistStep(step, note) {
    if (!checklistSteps) return;
    const button = checklistSteps.querySelector(`[data-step="${step}"]`);
    if (!button) return;
    const key = stepKey(button);
    const wasDone = completedSteps.includes(key);
    if (!wasDone) {
      completedSteps.push(key);
      lastMarkedStep = step;
    }
    if (checklistPop && note) checklistPop.textContent = note;
    updateChecklist(!wasDone);
    setProgressMessage();
  }

  function openChecklist(open) {
    checklistPanel.classList.toggle('open', open);
    checklistPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
    checklistTrigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('checklist-modal-open', open);
    document.body.classList.toggle('modal-open', open);
    if (!open && window.ssaWhatsNewAfterChecklist) {
      window.ssaWhatsNewAfterChecklist = false;
      document.dispatchEvent(new CustomEvent('ssa:checklist-intro-closed'));
    }
  }

  function followHref(href) {
    const url = new URL(href, window.location.href);
    if (samePage(href)) {
      if (url.hash) {
        const target = document.getElementById(url.hash.slice(1));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const file = url.pathname.split('/').pop() || url.pathname;
    window.location.href = file + url.hash;
  }

  function showTourTip(step, title, note) {
    document.getElementById('checklistTourTip')?.remove();
    const tip = document.createElement('div');
    tip.className = 'checklist-tour-tip';
    tip.id = 'checklistTourTip';
    const steps = Array.from(checklistSteps.querySelectorAll('button'));
    const currentIndex = steps.findIndex((button) => button.dataset.step === step);
    const nextButton = steps.slice(currentIndex + 1).find((button) => !completedSteps.includes(stepKey(button)))
      || steps.find((button) => !completedSteps.includes(stepKey(button)) && button.dataset.step !== step);
    tip.innerHTML = `
      <div class="checklist-tour-card" role="dialog" aria-label="Checklist tip">
        <span class="eyebrow">Checklist tip</span>
        <h3>${title}</h3>
        <p>${note}</p>
        <div class="checklist-tour-actions">
          ${nextButton
            ? '<button type="button" class="button button-dark" data-tour-continue>Continue</button><button type="button" class="button button-line" data-tour-got-it>Got it</button>'
            : '<button type="button" class="button button-dark" data-tour-got-it>Got it</button>'}
        </div>
      </div>`;
    document.body.appendChild(tip);
    requestAnimationFrame(() => tip.classList.add('open'));
    const closeTip = () => {
      tip.classList.remove('open');
      window.setTimeout(() => tip.remove(), 220);
    };
    tip.querySelector('[data-tour-got-it]')?.addEventListener('click', closeTip);
    tip.querySelector('[data-tour-continue]')?.addEventListener('click', () => {
      tip.remove();
      sessionStorage.removeItem('ssaChecklistTour');
      if (nextButton) launchStep(nextButton);
    });
    sessionStorage.removeItem('ssaChecklistTour');
  }

  function launchStep(button) {
    const step = button.dataset.step;
    const href = button.dataset.href;
    const action = button.dataset.action;
    const note = button.dataset.note || '';
    const title = button.textContent.trim();

    if (action === 'newsletter') {
      openChecklist(false);
      markChecklistStep('newsletter', note);
      showTourTip('newsletter', title, note);
      if (typeof window.openNewsletterModal === 'function') {
        sessionStorage.removeItem('ssaNlDismissed');
        window.setTimeout(() => window.openNewsletterModal(), 280);
      } else {
        sessionStorage.setItem('ssaOpenNewsletter', '1');
        sessionStorage.setItem('ssaChecklistTour', JSON.stringify({ step, title, note }));
        window.location.href = 'index.html';
      }
      return;
    }

    if (!href) return;
    openChecklist(false);
    const visitSteps = ['about', 'events', 'programs', 'board', 'aux', 'donate', 'bulletin', 'schedule'];
    if (visitSteps.includes(step)) markChecklistStep(step, note);

    if (samePage(href)) {
      followHref(href);
      window.setTimeout(() => showTourTip(step, title, note), 360);
      return;
    }

    sessionStorage.setItem('ssaChecklistTour', JSON.stringify({ step, title, note }));
    followHref(href);
  }

  function syncFromFlags() {
    if (localStorage.getItem('ssaGalleryVisited') === '1') {
      localStorage.setItem('ssaGalleryComplete', '1');
      localStorage.removeItem('ssaGalleryVisited');
    }
    if (localStorage.getItem('ssaTimelineVisited') === '1') {
      localStorage.setItem('ssaTimelineComplete', '1');
      localStorage.removeItem('ssaTimelineVisited');
    }
    if (localStorage.getItem('ssaGamePlayed') === '1') {
      localStorage.setItem('ssaGameSubmitted', '1');
      localStorage.removeItem('ssaGamePlayed');
    }
    if (localStorage.getItem('ssaGalleryComplete') === '1') markChecklistStep('gallery');
    if (localStorage.getItem('ssaTimelineComplete') === '1') markChecklistStep('timeline');
    if (localStorage.getItem('ssaGameSubmitted') === '1') markChecklistStep('game');
    if (localStorage.getItem('ssaNewsletterSubscribed') === '1') markChecklistStep('newsletter');
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    if (path === '/suggest' || path.endsWith('/suggest.html')) markChecklistStep('programs');
  }

  function trackScrollComplete(storageKey, step, note) {
    if (localStorage.getItem(storageKey) === '1') return;

    function atBottom() {
      return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 72;
    }

    function complete() {
      localStorage.setItem(storageKey, '1');
      markChecklistStep(step, note);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    }

    function onScroll() {
      if (atBottom()) complete();
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    window.setTimeout(onScroll, 300);
  }

  window.markChecklistStep = markChecklistStep;

  checklistTrigger.addEventListener('click', () => openChecklist(!checklistPanel.classList.contains('open')));
  checklistClose.addEventListener('click', () => openChecklist(false));
  checklistPanel.addEventListener('click', (event) => {
    if (event.target === checklistPanel) openChecklist(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && checklistPanel.classList.contains('open')) openChecklist(false);
  });

  checklistSteps.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => launchStep(button));
  });

  const checklistConnectBtn = document.getElementById('checklistConnectBtn');
  checklistConnectBtn && checklistConnectBtn.addEventListener('click', () => {
    openChecklist(false);
    if (typeof window.openConnectModal === 'function') {
      window.openConnectModal();
    } else {
      window.location.href = '/board';
    }
  });

  checklistReset.addEventListener('click', () => {
    completedSteps = [];
    ['ssaGalleryComplete', 'ssaTimelineComplete', 'ssaGameSubmitted', 'ssaNewsletterSubscribed'].forEach((key) => {
      localStorage.removeItem(key);
    });
    checklistPop.textContent = 'Checklist reset. Pick a step to explore interactively.';
    updateChecklist(true);
    setProgressMessage();
  });

  if (document.body.classList.contains('gallery-page')) {
    trackScrollComplete('ssaGalleryComplete', 'gallery', 'Gallery complete — you reached the end.');
  }
  if (document.body.classList.contains('timeline-page')) {
    trackScrollComplete('ssaTimelineComplete', 'timeline', 'Timeline complete — you reached the end.');
  }

  if (sessionStorage.getItem('ssaOpenNewsletter') === '1' && typeof window.openNewsletterModal === 'function') {
    sessionStorage.removeItem('ssaOpenNewsletter');
    window.setTimeout(() => window.openNewsletterModal(), 500);
  }

  try {
    const pendingTour = JSON.parse(sessionStorage.getItem('ssaChecklistTour') || 'null');
    if (pendingTour?.note) {
      window.setTimeout(() => showTourTip(pendingTour.step, pendingTour.title || 'Checklist tip', pendingTour.note), 700);
    }
  } catch (_) { /* ignore */ }

  setProgressMessage();
  syncFromFlags();
  updateChecklist();

  function initChecklistIntro() {
    if (!document.getElementById('hero')) return;
    if (localStorage.getItem('ssaChecklistIntroSeen') === '1') return;

    const intro = document.createElement('div');
    intro.className = 'modal-backdrop whats-new-modal checklist-intro-modal';
    intro.id = 'checklistIntro';
    intro.setAttribute('aria-hidden', 'true');
    intro.innerHTML = `
      <div class="whats-new-frame bulletin-flow-frame-solo">
        <div class="modal-sheet modal-card whats-new-sheet studio-password-sheet" role="dialog" aria-modal="true" aria-labelledby="checklistIntroTitle">
          <article class="whats-new-card bulletin-flow-page is-active">
            <span class="eyebrow">Welcome</span>
            <h2 id="checklistIntroTitle">Would you like to go through the website checklist?</h2>
            <p>A short interactive tour of SSA — events, gallery, bulletin, newsletter, and more. You can always open it later from the button in the corner.</p>
            <div class="checklist-intro-actions">
              <button type="button" class="button button-dark" id="checklistIntroStart">Yes, show me</button>
              <button type="button" class="button button-line" id="checklistIntroLater">No thanks</button>
            </div>
          </article>
        </div>
        <button class="modal-exit" type="button" aria-label="Close" data-intro-dismiss>${MODAL_EXIT}</button>
      </div>`;
    document.body.appendChild(intro);

    function dismiss(openPanel) {
      localStorage.setItem('ssaChecklistIntroSeen', '1');
      localStorage.setItem('ssaWhatsNewNever', '1');
      intro.classList.remove('open');
      intro.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
      if (openPanel) {
        window.setTimeout(() => openChecklist(true), 280);
      }
      window.setTimeout(() => intro.remove(), 320);
    }

    intro.querySelector('#checklistIntroStart').addEventListener('click', () => dismiss(true));
    intro.querySelector('#checklistIntroLater').addEventListener('click', () => dismiss(false));
    intro.querySelector('[data-intro-dismiss]').addEventListener('click', () => dismiss(false));
    intro.addEventListener('click', (event) => { if (event.target === intro) dismiss(false); });

    window.setTimeout(() => {
      intro.classList.add('open');
      intro.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
      intro.querySelector('#checklistIntroStart').focus();
    }, 900);
  }

  initChecklistIntro();
})();
