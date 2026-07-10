(async function () {
  const book = document.querySelector('.gallery-book');
  const communityAnchor = document.getElementById('communityGalleryItems');
  if (book && communityAnchor && window.ssaFetch) {
    try {
      const data = await window.ssaFetch.json('/api/gallery');
      (data.items || []).forEach((item, index) => {
        const figure = document.createElement('figure');
        figure.className = `polaroid ${index % 2 ? 'right' : 'left'}`;
        figure.style.setProperty('--rot', `${index % 2 ? 2.5 : -2.5}deg`);
        const image = document.createElement('img');
        image.src = item.src;
        image.alt = item.alt;
        image.loading = 'lazy';
        const caption = document.createElement('figcaption');
        caption.textContent = item.caption;
        figure.append(image, caption);
        book.insertBefore(figure, communityAnchor);
      });
    } catch (_) {
      // Existing gallery remains usable if community additions cannot load.
    }
  }

  const submitModal = document.getElementById('gallerySubmitModal');
  const submitOpen = document.getElementById('gallerySubmitOpen');
  const submitClose = document.getElementById('gallerySubmitClose');
  const submitForm = document.getElementById('gallerySubmitForm');
  const preview = document.getElementById('galleryPreview');
  let selectedData = '';

  function closeSubmit() {
    submitModal?.classList.remove('open');
    submitModal?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }
  submitOpen?.addEventListener('click', () => {
    submitModal.classList.add('open');
    submitModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  });
  submitClose?.addEventListener('click', closeSubmit);
  submitModal?.addEventListener('click', (event) => {
    if (event.target === submitModal) closeSubmit();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && submitModal?.classList.contains('open')) closeSubmit();
  });
  submitForm?.photo.addEventListener('change', () => {
    const file = submitForm.photo.files[0];
    selectedData = '';
    preview.classList.remove('visible');
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      submitForm.querySelector('output').textContent = 'Photo must be under 5 MB.';
      submitForm.photo.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      selectedData = String(reader.result || '');
      preview.src = selectedData;
      preview.classList.add('visible');
    };
    reader.readAsDataURL(file);
  });
  submitForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const out = submitForm.querySelector('output');
    const button = submitForm.querySelector('button[type="submit"]');
    const file = submitForm.photo.files[0];
    if (!file || !selectedData) {
      out.textContent = 'Choose a photo first.';
      return;
    }
    button.disabled = true;
    try {
      await window.ssaFetch.json('/api/gallery', {
        method: 'POST',
        body: {
          submitter: submitForm.submitter.value.trim(),
          email: submitForm.email.value.trim(),
          filename: file.name,
          data: selectedData,
          caption: submitForm.caption.value.trim(),
          alt: submitForm.alt.value.trim()
        },
        timeout: 30000
      });
      out.textContent = 'Submitted. The board will review your photo.';
      submitForm.reset();
      selectedData = '';
      preview.classList.remove('visible');
      window.setTimeout(closeSubmit, 1800);
    } catch (error) {
      out.textContent = error.message || 'Could not submit this photo.';
    } finally {
      button.disabled = false;
    }
  });

  const figures = Array.from(document.querySelectorAll('.gallery-book .polaroid'));
  if (!figures.length) return;

  const CLOSE_ICON =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M4 4l8 8M12 4l-8 8"/></svg>';

  const mobileMq = window.matchMedia('(max-width: 720px)');

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
      '<div class="gallery-lightbox-card" tabindex="0" aria-label="Photo viewer">' +
        '<button type="button" class="gallery-lightbox-close" aria-label="Close">' + CLOSE_ICON + '</button>' +
        '<div class="gallery-lightbox-viewport" id="galleryLightboxViewport">' +
          '<button type="button" class="gallery-lightbox-zone gallery-lightbox-zone-prev" aria-label="Previous photo"></button>' +
          '<img id="galleryLightboxImg" alt="" />' +
          '<button type="button" class="gallery-lightbox-zone gallery-lightbox-zone-next" aria-label="Next photo"></button>' +
        '</div>' +
        '<p class="gallery-lightbox-hint gallery-lightbox-hint-desktop">Click center to zoom · click left or right side for prev/next</p>' +
        '<p class="gallery-lightbox-hint gallery-lightbox-hint-mobile">Tap left or right side of the photo to browse</p>' +
        '<figcaption id="galleryLightboxCaption" class="gallery-lightbox-caption"></figcaption>' +
      '</div>' +
    '</div>';
  document.body.appendChild(lightbox);

  const viewport = document.getElementById('galleryLightboxViewport');
  const img = document.getElementById('galleryLightboxImg');
  const caption = document.getElementById('galleryLightboxCaption');
  const prevZone = lightbox.querySelector('.gallery-lightbox-zone-prev');
  const nextZone = lightbox.querySelector('.gallery-lightbox-zone-next');
  const closeBtn = lightbox.querySelector('.gallery-lightbox-close');

  let index = 0;
  let zoomed = false;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
