(async function () {
  const book = document.querySelector('.gallery-book');
  const communityAnchor = document.getElementById('communityGalleryItems');
  let items = [];
  let lightboxItems = [];

  function createGalleryFigure(item, index) {
    const figure = document.createElement('figure');
    figure.className = `polaroid visible ${index % 2 ? 'right' : 'left'}`;
    figure.style.setProperty('--rot', `${index % 2 ? 2.5 : -2.5}deg`);
    if (item.dumpCount > 1) figure.classList.add('is-dump');
    const image = document.createElement('img');
    image.src = item.src;
    image.alt = item.alt || item.caption;
    image.loading = 'lazy';
    const caption = document.createElement('figcaption');
    caption.textContent = item.dumpCount > 1
      ? `${item.caption} · ${item.dumpCount} photos`
      : item.caption;
    figure.append(image, caption);
    if (item.dumpCount > 1) {
      const badge = document.createElement('span');
      badge.className = 'gallery-dump-badge';
      badge.textContent = `${item.dumpCount}`;
      figure.append(badge);
    }
    figure.dataset.itemIndex = String(index);
    return figure;
  }

  function groupKey(caption) {
    const text = String(caption || 'SSA moment').trim();
    const split = text.split(/\s+[—\-–:|]\s+/);
    return (split[0] || text).slice(0, 80) || 'SSA moment';
  }

  function renderRecaps(sourceItems) {
    const host = document.getElementById('galleryRecapGroups');
    if (!host) return;
    const flat = [];
    sourceItems.forEach((item) => {
      if (item.dumpPhotos?.length) flat.push(...item.dumpPhotos);
      else flat.push(item);
    });
    if (!flat.length) {
      host.innerHTML = '<p class="home-album-empty">Recap photos will appear here once published in the gallery.</p>';
      return;
    }
    const groups = new Map();
    flat.forEach((item) => {
      const key = groupKey(item.caption);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    host.innerHTML = [...groups.entries()].map(([title, photos]) => `
      <section class="gallery-recap-group">
        <h2>${title.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))}</h2>
        <p class="gallery-recap-meta">${photos.length} photo${photos.length === 1 ? '' : 's'}</p>
        <div class="gallery-recap-photos">
          ${photos.map((photo) => `<img src="${String(photo.src || '').replace(/"/g, '&quot;')}" alt="${String(photo.caption || title).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))}" loading="lazy" />`).join('')}
        </div>
      </section>`).join('');
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  if (book && communityAnchor && window.ssaFetch) {
    try {
      const data = await window.ssaFetch.json('/api/gallery');
      items = data.items || [];
      renderRecaps(items);
      items.forEach((item, index) => {
        book.insertBefore(createGalleryFigure(item, index), communityAnchor);
      });
    } catch (_) {
      renderRecaps([]);
    }
  }

  const submitModal = document.getElementById('gallerySubmitModal');
  const submitOpen = document.getElementById('gallerySubmitOpen');
  const submitClose = document.getElementById('gallerySubmitClose');
  const submitForm = document.getElementById('gallerySubmitForm');
  const preview = document.getElementById('galleryPreview');
  const previewList = document.getElementById('galleryPreviewList');
  const drop = document.getElementById('galleryDrop');
  let selectedFiles = [];

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

  async function stagePhotos(fileList) {
    selectedFiles = [];
    preview?.classList.remove('visible');
    if (previewList) {
      previewList.hidden = true;
      previewList.innerHTML = '';
    }
    const files = [...(fileList || [])].filter((file) => /^image\/(png|jpeg|webp)$/i.test(file.type)).slice(0, 24);
    if (!files.length) return;
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        submitForm.querySelector('output').textContent = 'Each photo must be under 5 MB.';
        return;
      }
      selectedFiles.push({ file, data: await readFile(file) });
    }
    drop.querySelector('strong').textContent = selectedFiles.length === 1
      ? selectedFiles[0].file.name
      : `${selectedFiles.length} photos selected`;
    if (selectedFiles.length === 1 && preview) {
      preview.src = selectedFiles[0].data;
      preview.hidden = false;
      preview.classList.add('visible');
    } else if (previewList) {
      previewList.hidden = false;
      previewList.innerHTML = selectedFiles.map((item) =>
        `<img src="${item.data}" alt="" />`
      ).join('');
      if (preview) preview.hidden = true;
    }
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

  submitForm?.photo.addEventListener('change', () => stagePhotos(submitForm.photo.files));
  drop?.addEventListener('dragover', (event) => {
    event.preventDefault();
    drop.classList.add('dragging');
  });
  drop?.addEventListener('dragleave', () => drop.classList.remove('dragging'));
  drop?.addEventListener('drop', (event) => {
    event.preventDefault();
    drop.classList.remove('dragging');
    stagePhotos(event.dataTransfer.files);
  });

  submitForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const out = submitForm.querySelector('output');
    const button = submitForm.querySelector('button[type="submit"]');
    if (!selectedFiles.length) {
      out.textContent = 'Choose at least one photo.';
      return;
    }
    button.disabled = true;
    try {
      const caption = submitForm.caption.value.trim();
      let response;
      if (selectedFiles.length === 1) {
        response = await window.ssaFetch.json('/api/gallery', {
          method: 'POST',
          body: {
            password: submitForm.password.value,
            filename: selectedFiles[0].file.name,
            data: selectedFiles[0].data,
            caption
          },
          timeout: 30000
        });
        const item = {
          id: response.id,
          src: `/api/gallery/${response.id}/image`,
          alt: caption,
          caption,
          dumpCount: 1
        };
        const figure = createGalleryFigure(item, items.length);
        book?.insertBefore(figure, communityAnchor);
        items.push(item);
        figure.addEventListener('click', () => open(items.length - 1));
        animatePolaroidAdd(figure, selectedFiles[0].data, caption);
      } else {
        response = await window.ssaFetch.json('/api/gallery/dump', {
          method: 'POST',
          body: {
            password: submitForm.password.value,
            caption,
            photos: selectedFiles.map((item) => ({
              filename: item.file.name,
              data: item.data,
              caption
            }))
          },
          timeout: 120000
        });
        const dumpPhotos = (response.ids || []).map((id, index) => ({
          id,
          src: `/api/gallery/${id}/image`,
          alt: caption,
          caption,
          dumpOrder: index
        }));
        const item = {
          id: dumpPhotos[0]?.id,
          src: dumpPhotos[0]?.src,
          alt: caption,
          caption,
          dumpGroup: response.dumpGroup,
          dumpCount: dumpPhotos.length,
          dumpPhotos
        };
        const figure = createGalleryFigure(item, items.length);
        book?.insertBefore(figure, communityAnchor);
        items.push(item);
        figure.addEventListener('click', () => open(items.length - 1));
        animatePolaroidAdd(figure, selectedFiles[0].data, caption);
      }
      out.textContent = response.message || 'Added to the gallery.';
      submitForm.reset();
      selectedFiles = [];
      drop.querySelector('strong').textContent = 'Drop photos here';
      preview?.classList.remove('visible');
      if (previewList) {
        previewList.hidden = true;
        previewList.innerHTML = '';
      }
      window.setTimeout(closeSubmit, 180);
    } catch (error) {
      out.textContent = error.message || 'Could not submit this photo.';
    } finally {
      button.disabled = false;
    }
  });

  const CLOSE_ICON =
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
    '<path d="M4 4l8 8M12 4l-8 8"/></svg>';

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

  const imgEl = document.getElementById('galleryLightboxImg');
  const captionEl = document.getElementById('galleryLightboxCaption');
  let current = 0;

  function show(index) {
    if (!lightboxItems.length) return;
    current = (index + lightboxItems.length) % lightboxItems.length;
    const item = lightboxItems[current];
    imgEl.src = item.src;
    imgEl.alt = item.alt || item.caption || '';
    captionEl.textContent = lightboxItems.length > 1
      ? `${item.caption || ''} (${current + 1}/${lightboxItems.length})`.trim()
      : (item.caption || '');
  }

  function open(index) {
    const cover = items[index];
    lightboxItems = cover?.dumpPhotos?.length ? cover.dumpPhotos : [cover].filter(Boolean);
    if (!lightboxItems.length) return;
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    show(0);
  }

  function close() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  book?.addEventListener('click', (event) => {
    const figure = event.target.closest('.polaroid');
    if (!figure || !book.contains(figure)) return;
    const index = Number(figure.dataset.itemIndex);
    if (Number.isFinite(index)) open(index);
  });

  lightbox.querySelector('[data-close]')?.addEventListener('click', close);
  lightbox.querySelector('.gallery-lightbox-close')?.addEventListener('click', close);
  lightbox.querySelector('.gallery-lightbox-zone-prev')?.addEventListener('click', () => show(current - 1));
  lightbox.querySelector('.gallery-lightbox-zone-next')?.addEventListener('click', () => show(current + 1));
  document.addEventListener('keydown', (event) => {
    if (!lightbox.classList.contains('open')) return;
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft') show(current - 1);
    if (event.key === 'ArrowRight') show(current + 1);
  });
})();
