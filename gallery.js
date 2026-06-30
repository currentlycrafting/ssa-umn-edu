(function () {
  const figures = Array.from(document.querySelectorAll('.gallery-book .polaroid'));
  if (!figures.length) return;

  const ARROW_LEFT =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M10 3L5 8l5 5"/></svg>';
  const ARROW_RIGHT =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M6 3l5 5-5 5"/></svg>';
  const CLOSE_ICON =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M4 4l8 8M12 4l-8 8"/></svg>';

  const items = figures.map((fig) => {
    const img = fig.querySelector('img');
    return {
      src: img?.currentSrc || img?.src || '',
      alt: img?.alt || '',
      caption: fig.querySelector('figcaption')?.textContent?.trim() || ''
    };
  }).filter((item) => item.src);

  const lightbox = document.createElement('div');
  lightbox.className = 'gallery-lightbox';
  lightbox.id = 'galleryLightbox';
  lightbox.setAttribute('aria-hidden', 'true');
  lightbox.innerHTML =
    '<div class="gallery-lightbox-bg" data-close aria-label="Close gallery"></div>' +
    '<div class="gallery-lightbox-panel" role="dialog" aria-modal="true" aria-labelledby="galleryLightboxCaption">' +
      '<button type="button" class="gallery-lightbox-nav gallery-lightbox-prev" aria-label="Previous photo">' + ARROW_LEFT + '</button>' +
      '<button type="button" class="gallery-lightbox-nav gallery-lightbox-next" aria-label="Next photo">' + ARROW_RIGHT + '</button>' +
      '<div class="gallery-lightbox-card" tabindex="0" aria-label="Photo viewer">' +
        '<button type="button" class="gallery-lightbox-close" aria-label="Close">' + CLOSE_ICON + '</button>' +
        '<div class="gallery-lightbox-viewport" id="galleryLightboxViewport">' +
          '<img id="galleryLightboxImg" alt="" />' +
        '</div>' +
        '<p class="gallery-lightbox-hint gallery-lightbox-hint-desktop">Click image to zoom · click outside photo to close</p>' +
        '<p class="gallery-lightbox-hint gallery-lightbox-hint-mobile">Tap image to zoom · use arrows to browse</p>' +
        '<figcaption id="galleryLightboxCaption" class="gallery-lightbox-caption"></figcaption>' +
      '</div>' +
    '</div>';
  document.body.appendChild(lightbox);

  const card = lightbox.querySelector('.gallery-lightbox-card');
  const viewport = document.getElementById('galleryLightboxViewport');
  const img = document.getElementById('galleryLightboxImg');
  const caption = document.getElementById('galleryLightboxCaption');
  const prevBtn = lightbox.querySelector('.gallery-lightbox-prev');
  const nextBtn = lightbox.querySelector('.gallery-lightbox-next');
  const closeBtn = lightbox.querySelector('.gallery-lightbox-close');

  let index = 0;
  let zoomed = false;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setZoom(on) {
    zoomed = on;
    img.classList.toggle('zoomed', zoomed);
    viewport.classList.toggle('zoomed', zoomed);
    if (!zoomed) viewport.scrollTo(0, 0);
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
    prevBtn.disabled = index <= 0;
    nextBtn.disabled = index >= items.length - 1;
  }

  function open(at) {
    index = at;
    render();
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gallery-lightbox-open');
    closeBtn.focus();
  }

  function close() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gallery-lightbox-open');
    setZoom(false);
  }

  function step(delta) {
    const next = index + delta;
    if (next < 0 || next >= items.length) return;
    index = next;
    render();
  }

  figures.forEach((fig, i) => {
    const imgEl = fig.querySelector('img');
    if (!imgEl) return;
    fig.classList.add('polaroid-clickable');
    fig.setAttribute('tabindex', '0');
    fig.setAttribute('role', 'button');
    fig.setAttribute('aria-label', 'View larger: ' + (imgEl.alt || 'SSA photo'));
    fig.addEventListener('click', () => open(i));
    fig.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open(i);
      }
    });
  });

  viewport.addEventListener('click', (event) => {
    if (event.target === img) {
      event.stopPropagation();
      setZoom(!zoomed);
    }
  });

  closeBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    close();
  });

  lightbox.querySelector('[data-close].gallery-lightbox-bg').addEventListener('click', close);
  prevBtn.addEventListener('click', (event) => { event.stopPropagation(); step(-1); });
  nextBtn.addEventListener('click', (event) => { event.stopPropagation(); step(1); });

  window.addEventListener('keydown', (event) => {
    if (!lightbox.classList.contains('open')) return;
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft') step(-1);
    if (event.key === 'ArrowRight') step(1);
  });
})();
