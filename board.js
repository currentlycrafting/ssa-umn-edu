/* Meet the Board — wheel pause + gallery-style lightbox. */
(function () {
  const stage = document.getElementById('boardWheelStage');
  const wheel = document.getElementById('boardWheel');
  if (!stage || !wheel) return;

  const cards = [...wheel.querySelectorAll('.board-wheel-card')];
  const mobileMq = window.matchMedia('(max-width: 720px)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let paused = false;
  let lightboxOpen = false;

  function setPaused(on) {
    paused = on || lightboxOpen;
    stage.classList.toggle('is-paused', paused);
    if (!reduced) {
      wheel.style.animationPlayState = paused ? 'paused' : 'running';
    }
  }

  cards.forEach((card) => {
    card.addEventListener('mouseenter', () => setPaused(true));
    card.addEventListener('mouseleave', () => {
      if (!lightboxOpen && !stage.matches(':hover') && !wheel.querySelector('.board-wheel-card:focus-within')) {
        setPaused(false);
      }
    });
    card.addEventListener('focusin', () => setPaused(true));
    card.addEventListener('focusout', () => {
      window.setTimeout(() => {
        if (!lightboxOpen && !wheel.querySelector('.board-wheel-card:focus-within') && !stage.matches(':hover')) {
          setPaused(false);
        }
      }, 0);
    });
  });

  stage.addEventListener('mouseleave', () => {
    if (!lightboxOpen && !wheel.querySelector('.board-wheel-card:focus-within')) setPaused(false);
  });

  if (reduced) {
    setPaused(true);
    wheel.style.animation = 'none';
  }

  const items = cards.map((card) => {
    const img = card.querySelector('img');
    const name = card.querySelector('.board-wheel-meta strong')?.textContent?.trim() || '';
    return {
      src: img?.currentSrc || img?.src || '',
      alt: name,
      caption: name
    };
  }).filter((item) => item.src);

  if (!items.length) return;

  const CLOSE_ICON =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M4 4l8 8M12 4l-8 8"/></svg>';

  const lightbox = document.createElement('div');
  lightbox.className = 'gallery-lightbox';
  lightbox.id = 'boardLightbox';
  lightbox.setAttribute('aria-hidden', 'true');
  lightbox.innerHTML =
    '<div class="gallery-lightbox-bg" data-close aria-label="Close board photo"></div>' +
    '<div class="gallery-lightbox-panel" role="dialog" aria-modal="true" aria-labelledby="boardLightboxCaption">' +
      '<button type="button" class="gallery-lightbox-close" aria-label="Close">' + CLOSE_ICON + '</button>' +
      '<button type="button" class="gallery-lightbox-zone gallery-lightbox-zone-prev" aria-label="Previous person"><span aria-hidden="true">←</span></button>' +
      '<div class="gallery-lightbox-card" tabindex="0" aria-label="Board photo viewer">' +
        '<div class="gallery-lightbox-viewport" id="boardLightboxViewport">' +
          '<img id="boardLightboxImg" alt="" />' +
        '</div>' +
        '<figcaption id="boardLightboxCaption" class="gallery-lightbox-caption"></figcaption>' +
      '</div>' +
      '<button type="button" class="gallery-lightbox-zone gallery-lightbox-zone-next" aria-label="Next person"><span aria-hidden="true">→</span></button>' +
    '</div>';
  document.body.appendChild(lightbox);

  const viewport = document.getElementById('boardLightboxViewport');
  const img = document.getElementById('boardLightboxImg');
  const caption = document.getElementById('boardLightboxCaption');
  const prevZone = lightbox.querySelector('.gallery-lightbox-zone-prev');
  const nextZone = lightbox.querySelector('.gallery-lightbox-zone-next');
  const closeBtn = lightbox.querySelector('.gallery-lightbox-close');

  let index = 0;
  let zoomed = false;

  function isMobile() {
    return mobileMq.matches;
  }

  function setZoom(on) {
    if (isMobile()) {
      zoomed = false;
      img.classList.remove('zoomed');
      viewport.classList.remove('zoomed');
      return;
    }
    zoomed = on;
    img.classList.toggle('zoomed', zoomed);
    viewport.classList.toggle('zoomed', zoomed);
    if (!zoomed) viewport.scrollTo(0, 0);
  }

  function updateZones() {
    prevZone.disabled = index <= 0;
    nextZone.disabled = index >= items.length - 1;
  }

  function render() {
    const item = items[index];
    img.classList.add('is-changing');
    window.setTimeout(() => {
      img.src = item.src;
      img.alt = item.alt;
      caption.textContent = item.caption;
      img.classList.remove('is-changing');
    }, reduced ? 0 : 160);
    setZoom(false);
    updateZones();
  }

  function open(at) {
    index = at;
    render();
    lightboxOpen = true;
    setPaused(true);
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gallery-lightbox-open');
    closeBtn.focus();
  }

  function close() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gallery-lightbox-open');
    lightboxOpen = false;
    setZoom(false);
    if (!stage.matches(':hover') && !wheel.querySelector('.board-wheel-card:focus-within')) {
      setPaused(false);
    }
  }

  function step(delta) {
    const next = index + delta;
    if (next < 0 || next >= items.length) return;
    index = next;
    render();
  }

  cards.forEach((card, i) => {
    card.setAttribute('role', 'button');
    card.addEventListener('click', () => open(i));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(i);
      }
    });
  });

  img.addEventListener('click', (event) => {
    event.stopPropagation();
    if (isMobile()) return;
    setZoom(!zoomed);
  });

  prevZone.addEventListener('click', (event) => {
    event.stopPropagation();
    step(-1);
  });
  nextZone.addEventListener('click', (event) => {
    event.stopPropagation();
    step(1);
  });

  closeBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    close();
  });

  lightbox.querySelector('[data-close].gallery-lightbox-bg').addEventListener('click', close);

  mobileMq.addEventListener('change', () => setZoom(false));

  window.addEventListener('keydown', (event) => {
    if (!lightbox.classList.contains('open')) return;
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft') step(-1);
    if (event.key === 'ArrowRight') step(1);
  });
})();
