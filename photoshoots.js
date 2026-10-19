(function () {
  const list = document.getElementById('photoshootList');
  if (!list || !window.ssaFetch) return;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  let shoots = [];
  let openIndex = -1;
  let frame = 0;
  let pointerStart = null;

  const modal = document.createElement('div');
  modal.className = 'ig-post-modal';
  modal.hidden = true;
  modal.innerHTML = `
    <button class="ig-post-backdrop" type="button" data-close aria-label="Close photoshoot"></button>
    <article class="ig-post" role="dialog" aria-modal="true" aria-labelledby="igPostTitle">
      <header class="ig-post-head">
        <img src="/assets/brand/ssa-logo.png" alt="" />
        <div>
          <strong id="igPostTitle"></strong>
          <span id="igPostDetail"></span>
        </div>
        <button class="ig-post-close" type="button" data-close aria-label="Close">×</button>
      </header>
      <div class="ig-post-stage" id="igPostStage">
        <button class="ig-post-arrow ig-post-prev" type="button" aria-label="Previous photo">‹</button>
        <img id="igPostImage" alt="" />
        <button class="ig-post-arrow ig-post-next" type="button" aria-label="Next photo">›</button>
      </div>
      <div class="ig-post-dots" id="igPostDots"></div>
      <p class="ig-post-caption" id="igPostCaption"></p>
    </article>`;
  document.body.appendChild(modal);

  const titleEl = modal.querySelector('#igPostTitle');
  const detailEl = modal.querySelector('#igPostDetail');
  const imageEl = modal.querySelector('#igPostImage');
  const dotsEl = modal.querySelector('#igPostDots');
  const captionEl = modal.querySelector('#igPostCaption');
  const stage = modal.querySelector('#igPostStage');
  const prevBtn = modal.querySelector('.ig-post-prev');
  const nextBtn = modal.querySelector('.ig-post-next');

  function currentShoot() {
    return shoots[openIndex] || null;
  }

  function paintFrame() {
    const shoot = currentShoot();
    const photos = shoot?.photos || [];
    const photo = photos[frame];
    titleEl.textContent = shoot?.title || 'Photoshoot';
    detailEl.textContent = shoot?.description || '';
    detailEl.hidden = !shoot?.description;
    if (!photo) {
      imageEl.removeAttribute('src');
      imageEl.alt = '';
      captionEl.textContent = photos.length ? '' : 'Photos for this shoot are on the way.';
      dotsEl.innerHTML = '';
      prevBtn.hidden = true;
      nextBtn.hidden = true;
      return;
    }
    imageEl.src = photo.src;
    imageEl.alt = photo.caption || shoot.title;
    captionEl.textContent = photo.caption || '';
    prevBtn.hidden = photos.length < 2;
    nextBtn.hidden = photos.length < 2;
    dotsEl.innerHTML = photos.map((_, index) =>
      `<button type="button" class="ig-post-dot${index === frame ? ' is-on' : ''}" data-frame="${index}" aria-label="Photo ${index + 1} of ${photos.length}"${index === frame ? ' aria-current="true"' : ''}></button>`
    ).join('');
  }

  function step(delta) {
    const photos = currentShoot()?.photos || [];
    if (photos.length < 2) return;
    frame = (frame + delta + photos.length) % photos.length;
    paintFrame();
  }

  function openShoot(index) {
    openIndex = index;
    frame = 0;
    paintFrame();
    modal.hidden = false;
    document.body.classList.add('modal-open');
    stage.focus();
  }

  function closeShoot() {
    modal.hidden = true;
    openIndex = -1;
    document.body.classList.remove('modal-open');
  }

  function cardMarkup(shoot, index) {
    const cover = shoot.photos?.[0];
    return `<button class="shoot-open" type="button" data-open-shoot="${index}">
      ${cover ? `<img src="${esc(cover.src)}" alt="" />` : '<span class="shoot-open-mark" aria-hidden="true"></span>'}
      <span class="shoot-open-copy">
        <strong>${esc(shoot.title)}</strong>
        ${shoot.description ? `<span>${esc(shoot.description)}</span>` : ''}
      </span>
    </button>`;
  }

  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-shoot]');
    if (!button) return;
    openShoot(Number(button.dataset.openShoot));
  });
  modal.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) closeShoot();
    const dot = event.target.closest('[data-frame]');
    if (dot) {
      frame = Number(dot.dataset.frame);
      paintFrame();
    }
  });
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));
  stage.tabIndex = 0;
  stage.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    pointerStart = event.clientX;
  });
  stage.addEventListener('pointerup', (event) => {
    if (pointerStart == null || event.target.closest('button')) {
      pointerStart = null;
      return;
    }
    const delta = event.clientX - pointerStart;
    pointerStart = null;
    if (delta <= -36) step(1);
    else if (delta >= 36) step(-1);
  });
  stage.addEventListener('pointercancel', () => { pointerStart = null; });
  document.addEventListener('keydown', (event) => {
    if (modal.hidden) return;
    if (event.key === 'Escape') closeShoot();
    else if (event.key === 'ArrowRight') step(1);
    else if (event.key === 'ArrowLeft') step(-1);
  });

  window.ssaFetch.json('/api/photoshoots?fresh=' + Date.now()).then((data) => {
    shoots = data.photoshoots || [];
    if (!shoots.length) {
      list.innerHTML = '<p class="shoot-waiting">Photoshoots will show up here once they are published.</p>';
      return;
    }
    list.innerHTML = `<div class="shoot-list">${shoots.map(cardMarkup).join('')}</div>`;
  }).catch(() => {
    list.innerHTML = '<p class="shoot-waiting">Photoshoots could not load right now.</p>';
  });
})();
