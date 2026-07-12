(function () {
  if (!document.getElementById('hero')) return;

  const slides = [
    { eyebrow: 'Live music', title: 'Want the Aux?', copy: 'Anyone at an SSA event can request a song. One host connects Spotify while the shared queue stays in sync and moves forward as songs play.', href: '/aux', action: 'Open the queue' },
    { eyebrow: 'Photo album', title: 'A gallery built by the community.', copy: 'Gallery photos now live in the SSA database. Add a memory, watch its polaroid develop, and browse every photo in the new viewer.', href: '/gallery', action: 'View the gallery' },
    { eyebrow: 'Events', title: 'One calendar for every SSA moment.', copy: 'See featured and upcoming events, respond with a full RSVP or a quick Yes or No, and check who is coming.', href: '/events', action: 'See events' },
    { eyebrow: 'Newsletter', title: 'Read SSA news like an edition.', copy: 'The newsletter now features full stories, announcements, and captioned polaroids created in the Newsletter Studio.', href: '/newsletter', action: 'Read the newsletter' },
    { eyebrow: 'Admin workspace', title: 'Publishing is faster for the board.', copy: 'Authorized board members can manage events, gallery memories, newsletters, RSVPs, music, and community submissions in one workspace.', href: '/admin', action: 'Open admin' },
    { eyebrow: 'Connect', title: 'Ideas have one clear home.', copy: 'Send SSA a message, propose a collaboration, or suggest a campus or community event through one guided form.', action: 'Share something', outreach: true }
  ];

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop whats-new-modal';
  modal.id = 'whatsNewModal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="whats-new-frame">
      <button class="button button-line whats-new-side whats-new-side-prev" type="button" data-whats-prev aria-label="Previous update">←</button>
      <div class="modal-sheet modal-card modal-card-wide whats-new-sheet" role="dialog" aria-modal="true" aria-labelledby="whatsNewTitle">
        <div class="whats-new-progress"><span id="whatsNewIndex">1</span> / ${slides.length}</div>
        <div class="whats-new-stage" id="whatsNewStage"></div>
        <div class="whats-new-nav">
          <div class="whats-new-dots" aria-hidden="true"></div>
        </div>
      </div>
      <button class="button button-dark whats-new-side whats-new-side-next" type="button" data-whats-next>Next →</button>
      <button class="modal-exit" type="button" aria-label="Close"><svg viewBox="0 0 44 44" aria-hidden="true"><path class="modal-exit-path" d="M22 6 C33 5 38 15 38 22 C38 33 29 38 22 38 C11 38 6 29 6 22 C6 11 14 6 22 6 Z"/><path class="modal-exit-x" d="M16.5 16.5 L27.5 27.5 M27.5 16.5 L16.5 27.5"/></svg></button>
    </div>`;
  document.body.appendChild(modal);

  const stage = modal.querySelector('#whatsNewStage');
  const indexLabel = modal.querySelector('#whatsNewIndex');
  const prev = modal.querySelector('[data-whats-prev]');
  const next = modal.querySelector('[data-whats-next]');
  const dots = modal.querySelector('.whats-new-dots');
  let index = 0;
  let opened = false;

  function render() {
    const slide = slides[index];
    indexLabel.textContent = String(index + 1);
    stage.innerHTML = `
      <article class="whats-new-card">
        <span class="eyebrow">${slide.eyebrow}</span>
        <h2 id="whatsNewTitle">${slide.title}</h2>
        <p>${slide.copy}</p>
        ${slide.outreach ? '<button class="button button-line" type="button" data-whats-outreach>Share something</button>' : `<a class="button button-line" href="${slide.href}">${slide.action}</a>`}
      </article>`;
    dots.innerHTML = slides.map((_, dot) => `<i class="${dot === index ? 'active' : ''}"></i>`).join('');
    prev.disabled = index === 0;
    next.textContent = index === slides.length - 1 ? 'Done' : 'Next →';
    stage.querySelector('[data-whats-outreach]')?.addEventListener('click', () => {
      close();
      window.setTimeout(() => window.openOutreachModal?.(), 220);
    });
  }

  function open() {
    if (opened || modal.classList.contains('open')) return;
    opened = true;
    index = 0;
    render();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    next.focus();
  }

  function close() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  prev.addEventListener('click', () => { if (index > 0) { index -= 1; render(); } });
  next.addEventListener('click', () => {
    if (index < slides.length - 1) { index += 1; render(); }
    else close();
  });
  modal.querySelector('.modal-exit').addEventListener('click', close);
  modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
  document.addEventListener('keydown', (event) => {
    if (!modal.classList.contains('open')) return;
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft' && index > 0) { index -= 1; render(); }
    if (event.key === 'ArrowRight' && index < slides.length - 1) { index += 1; render(); }
  });
  document.addEventListener('ssa:checklist-intro-closed', () => window.setTimeout(open, 250), { once: true });

  if (localStorage.getItem('ssaChecklistIntroSeen') === '1') {
    window.setTimeout(open, 850);
  }
})();
