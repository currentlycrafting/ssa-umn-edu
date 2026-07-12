(function () {
  const CHECKLIST_TOTAL = 10;
  const progressMessages = [
    'Pick a step. Each one explains SSA and where to go next.',
    'Nice start. Keep exploring.',
    'You are getting the full picture of SSA.',
    'Halfway there — keep going.',
    'Almost done. A few more stops.',
    'You have seen most of what SSA offers.',
    'Keep going — meet the board next.',
    'Almost there. Explore how to support SSA.',
    'One more stop before you finish.',
    'Last step: subscribe to the newsletter.',
    'All done. Any questions for us?'
  ];

  const CHECKLIST_HTML = `
  <button class="checklist-trigger" id="checklistTrigger" type="button" aria-expanded="false">
    <span class="ring" id="checklistRing" aria-hidden="true"><span id="checklistRingText">0</span></span>
    <span id="checklistLabel">Start</span>
  </button>
  <aside class="checklist-panel" id="checklistPanel" aria-hidden="true">
    <div class="checklist-modal-card" role="dialog" aria-modal="true" aria-labelledby="checklistTitle">
    <header>
      <div>
        <span class="eyebrow">Checklist</span>
        <h2 id="checklistTitle">Explore SSA</h2>
        <p><span id="checklistCount">0</span> of 10 complete</p>
      </div>
      <button id="checklistClose" type="button" aria-label="Close">×</button>
    </header>
    <div class="checklist-progress"><span id="checklistProgress"></span></div>
    <div class="checklist-pop" id="checklistPop" role="status"></div>
    <div class="checklist-steps" id="checklistSteps">
      <button type="button" data-step="about" data-href="index.html#demo" data-note="SSA is the cultural and community home base.">Learn about SSA</button>
      <button type="button" data-step="events" data-href="index.html#events" data-note="Events are the fastest way to meet people.">Explore events</button>
      <button type="button" data-step="programs" data-href="index.html#programs" data-note="Programs show how SSA supports students year-round.">Discover programs</button>
      <button type="button" data-step="gallery" data-href="gallery.html" data-note="Scroll to the bottom of the gallery to complete this step.">Visit the gallery</button>
      <button type="button" data-step="game" data-href="connections.html" data-note="Submit your score after playing to complete this step.">Play a game</button>
      <button type="button" data-step="timeline" data-href="timeline.html" data-note="Scroll to the bottom of the timeline to complete this step.">Browse the timeline</button>
      <button type="button" data-step="board" data-href="/board" data-note="Meet the students leading SSA.">Meet the board</button>
      <button type="button" data-step="aux" data-href="/aux" data-note="See how the community builds the live music queue.">Visit Want the Aux</button>
      <button type="button" data-step="donate" data-href="/donate" data-note="Learn how donations support SSA programming.">Support SSA</button>
      <button type="button" data-step="newsletter" data-action="newsletter" data-note="The final step: subscribe to the SSA newsletter.">Subscribe to newsletter</button>
    </div>
    <div class="checklist-complete" id="checklistComplete">
      <span class="spark" aria-hidden="true">✓</span>
      <h3>Ready for SSA.</h3>
      <p>You explored everything SSA has to offer.</p>
      <button type="button" class="button button-dark" id="checklistConnectBtn">Any questions for us? <span class="icon-arrow" aria-hidden="true"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h9M9 5l3 3-3 3"/></svg></span></button>
    </div>
    <button class="reset" id="checklistReset" type="button">Reset checklist</button>
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
    return destFile === current || (destFile === 'index.html' && current === '');
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
    window.location.href = url.pathname.split('/').pop() + url.hash;
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
    button.addEventListener('click', () => {
      const id = stepKey(button);
      const href = button.dataset.href;
      const action = button.dataset.action;

      if (action === 'newsletter') {
        checklistPop.textContent = button.dataset.note || '';
        if (typeof window.openNewsletterModal === 'function') {
          sessionStorage.removeItem('ssaNlDismissed');
          window.openNewsletterModal();
        } else {
          sessionStorage.setItem('ssaOpenNewsletter', '1');
          window.location.href = 'index.html';
        }
        return;
      }

      if (href) {
        checklistPop.textContent = button.dataset.note || '';
        const autoSteps = ['gallery', 'game', 'timeline'];
        const visitSteps = ['board', 'aux', 'donate'];
        if (visitSteps.includes(button.dataset.step)) {
          markChecklistStep(button.dataset.step, button.dataset.note);
        }
        if (autoSteps.includes(button.dataset.step) && samePage(href)) {
          return;
        }
        if (['about', 'events', 'programs'].includes(button.dataset.step) && samePage(href)) {
          followHref(href);
          const wasDone = completedSteps.includes(id);
          if (!wasDone) completedSteps.push(id);
          else completedSteps = completedSteps.filter((step) => step !== id);
          updateChecklist(!wasDone);
          return;
        }
        followHref(href);
        return;
      }

      const wasDone = completedSteps.includes(id);
      if (!wasDone) completedSteps.push(id);
      else completedSteps = completedSteps.filter((step) => step !== id);
      checklistPop.textContent = button.dataset.note || '';
      updateChecklist(!wasDone);
    });
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
    checklistPop.textContent = 'Checklist reset. Pick a step to learn what it does.';
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

  setProgressMessage();
  syncFromFlags();
  updateChecklist();

  function initChecklistIntro() {
    if (!document.getElementById('hero')) return;
    if (localStorage.getItem('ssaChecklistIntroSeen') === '1') return;

    const intro = document.createElement('div');
    intro.className = 'checklist-intro';
    intro.id = 'checklistIntro';
    intro.setAttribute('aria-hidden', 'true');
    intro.innerHTML =
      '<div class="checklist-intro-backdrop" data-intro-dismiss></div>' +
      '<div class="checklist-intro-card" role="dialog" aria-modal="true" aria-labelledby="checklistIntroTitle">' +
        '<div class="checklist-intro-art" aria-hidden="true">' +
          '<img src="assets/brand/ssa-logo.png" alt="" class="checklist-intro-logo" />' +
          '<svg class="checklist-intro-mock" viewBox="0 0 280 200" aria-hidden="true">' +
            '<rect x="8" y="8" width="264" height="184" rx="16" fill="var(--surface)" stroke="var(--line-strong)" stroke-width="2"/>' +
            '<circle cx="42" cy="42" r="22" fill="none" stroke="var(--accent)" stroke-width="5" stroke-dasharray="80 140"/>' +
            '<text x="42" y="48" text-anchor="middle" font-size="14" font-weight="800" fill="var(--accent)">3</text>' +
            '<text x="78" y="36" font-size="13" font-weight="800" fill="var(--muted)">CHECKLIST</text>' +
            '<text x="78" y="54" font-size="11" font-weight="700" fill="var(--muted)">Explore SSA</text>' +
            '<rect x="24" y="78" width="232" height="22" rx="8" fill="var(--blue-2)"/>' +
            '<rect x="24" y="108" width="232" height="22" rx="8" fill="var(--surface-2)" stroke="var(--line)"/>' +
            '<rect x="24" y="138" width="232" height="22" rx="8" fill="var(--surface-2)" stroke="var(--line)"/>' +
            '<circle cx="36" cy="89" r="6" fill="var(--green)"/>' +
            '<circle cx="36" cy="119" r="6" fill="var(--green)"/>' +
            '<circle cx="36" cy="149" r="6" fill="var(--line-strong)"/>' +
          '</svg>' +
        '</div>' +
        '<span class="eyebrow">New here?</span>' +
        '<h2 id="checklistIntroTitle">Take the SSA checklist tour</h2>' +
        '<p>Work through ten quick steps — events, gallery, the board, music, and more. Your progress saves as you go.</p>' +
        '<div class="checklist-intro-actions">' +
          '<button type="button" class="button button-dark" id="checklistIntroStart">Open checklist</button>' +
          '<button type="button" class="button button-line" id="checklistIntroLater">Maybe later</button>' +
        '</div>' +
        '<span class="checklist-intro-pointer" aria-hidden="true"></span>' +
      '</div>';
    document.body.appendChild(intro);

    function dismiss(openPanel) {
      localStorage.setItem('ssaChecklistIntroSeen', '1');
      intro.classList.remove('open');
      intro.setAttribute('aria-hidden', 'true');
      if (openPanel) {
        window.ssaWhatsNewAfterChecklist = true;
        openChecklist(true);
      } else {
        window.setTimeout(() => document.dispatchEvent(new CustomEvent('ssa:checklist-intro-closed')), 360);
      }
      window.setTimeout(() => intro.remove(), 320);
    }

    intro.querySelector('#checklistIntroStart').addEventListener('click', () => dismiss(true));
    intro.querySelector('#checklistIntroLater').addEventListener('click', () => dismiss(false));
    intro.querySelector('[data-intro-dismiss]').addEventListener('click', () => dismiss(false));

    window.setTimeout(() => {
      intro.classList.add('open');
      intro.setAttribute('aria-hidden', 'false');
      intro.querySelector('#checklistIntroStart').focus();
    }, 1000);
  }

  initChecklistIntro();
})();
