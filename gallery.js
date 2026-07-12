(async function () {
  const book = document.querySelector('.gallery-book');
  const communityAnchor = document.getElementById('communityGalleryItems');
  let items = [];
  function createGalleryFigure(item, index) {
    const figure = document.createElement('figure');
    figure.className = `polaroid visible ${index % 2 ? 'right' : 'left'}`;
    figure.style.setProperty('--rot', `${index % 2 ? 2.5 : -2.5}deg`);
    const image = document.createElement('img');
    image.src = item.src;
    image.alt = item.alt || item.caption;
    image.loading = 'lazy';
    const caption = document.createElement('figcaption');
    caption.textContent = item.caption;
    figure.append(image, caption);
    return figure;
  }
  if (book && communityAnchor && window.ssaFetch) {
    try {
      const data = await window.ssaFetch.json('/api/gallery');
      (data.items || []).forEach((item, index) => {
        book.insertBefore(createGalleryFigure(item, index), communityAnchor);
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
  const drop = document.getElementById('galleryDrop');
  let selectedData = '';
  let selectedFile = null;

  function closeSubmit() {
    submitModal?.classList.remove('open');
    submitModal?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }
  function animatePolaroidAdd(figure, dataUrl, caption) {
    const developer = document.createElement('div');
    developer.className = 'gallery-developing';
    developer.innerHTML = `<div class="gallery-developing-flash"></div><figure><img src="${dataUrl}" alt="" /><figcaption>${caption.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))}</figcaption><span>developing…</span></figure>`;
    document.body.appendChild(developer);
    window.requestAnimationFrame(() => developer.classList.add('active'));
    window.setTimeout(() => developer.classList.add('developed'), 650);
    window.setTimeout(() => {
      developer.classList.add('leaving');
      figure.classList.add('polaroid-added');
      figure.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 1450);
    window.setTimeout(() => {
      developer.remove();
      figure.classList.remove('polaroid-added');
    }, 2050);
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
  function stagePhoto(file) {
    selectedData = '';
    selectedFile = null;
    preview.classList.remove('visible');
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      submitForm.querySelector('output').textContent = 'Photo must be under 5 MB.';
      submitForm.photo.value = '';
      return;
    }
    selectedFile = file;
    drop.querySelector('strong').textContent = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      selectedData = String(reader.result || '');
      preview.src = selectedData;
      preview.classList.add('visible');
    };
    reader.readAsDataURL(file);
  }
  submitForm?.photo.addEventListener('change', () => {
    stagePhoto(submitForm.photo.files[0]);
  });
  drop?.addEventListener('dragover', (event) => {
    event.preventDefault();
    drop.classList.add('dragging');
  });
  drop?.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop?.addEventListener('drop', (event) => {
    event.preventDefault();
    drop.classList.remove('dragging');
    stagePhoto(event.dataTransfer.files[0]);
  });
  submitForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const out = submitForm.querySelector('output');
    const button = submitForm.querySelector('button[type="submit"]');
    const file = selectedFile;
    if (!file || !selectedData) {
      out.textContent = 'Choose a photo first.';
      return;
    }
    button.disabled = true;
    try {
      const response = await window.ssaFetch.json('/api/gallery', {
        method: 'POST',
        body: {
          password: submitForm.password.value,
          filename: file.name,
          data: selectedData,
          caption: submitForm.caption.value.trim()
        },
        timeout: 30000
      });
      const item = {
        src: `/api/gallery/${response.id}/image`,
        alt: submitForm.caption.value.trim(),
        caption: submitForm.caption.value.trim()
      };
      const figure = createGalleryFigure(item, items.length);
      book?.insertBefore(figure, communityAnchor);
      items.push(item);
      figure.addEventListener('click', () => open(items.length - 1));
      animatePolaroidAdd(figure, selectedData, item.caption);
      out.textContent = 'Added to the gallery.';
      submitForm.reset();
      selectedData = '';
      selectedFile = null;
      drop.querySelector('strong').textContent = 'Drop a photo here';
      preview.classList.remove('visible');
      window.setTimeout(closeSubmit, 180);
    } catch (error) {
      out.textContent = error.message || 'Could not submit this photo.';
    } finally {
      button.disabled = false;
    }
  });

  const figures = Array.from(document.querySelectorAll('.gallery-book .polaroid'));
  figures.forEach((figure) => figure.classList.add('visible'));

  const CLOSE_ICON =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M4 4l8 8M12 4l-8 8"/></svg>';

  const mobileMq = window.matchMedia('(max-width: 720px)');

  items = figures.map((fig) => {
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
      '<button type="button" class="gallery-lightbox-close" aria-label="Close">' + CLOSE_ICON + '</button>' +
      '<button type="button" class="gallery-lightbox-zone gallery-lightbox-zone-prev" aria-label="Previous photo"><span aria-hidden="true">←</span></button>' +
      '<div class="gallery-lightbox-card" tabindex="0" aria-label="Photo viewer">' +
        '<div class="gallery-lightbox-viewport" id="galleryLightboxViewport">' +
          '<img id="galleryLightboxImg" alt="" />' +
        '</div>' +
        '<figcaption id="galleryLightboxCaption" class="gallery-lightbox-caption"></figcaption>' +
      '</div>' +
      '<button type="button" class="gallery-lightbox-zone gallery-lightbox-zone-next" aria-label="Next photo"><span aria-hidden="true">→</span></button>' +
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
