function setupScrollAndReveal() {
  var progressBar = document.getElementById('scroll-progress');
  window.addEventListener('scroll', function() {
    var scrollTop = window.scrollY;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (progressBar) {
      progressBar.style.width = (scrollTop / docHeight) * 100 + '%';
    }
    var nav = document.getElementById('navbar');
    nav?.classList.toggle('scrolled', scrollTop > 80);
  });

  var reveals = document.querySelectorAll('.reveal');
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  reveals.forEach(function(el) { observer.observe(el); });
}

function setupFullGalleryModal() {
  var openBtn = document.getElementById('open-full-gallery');
  var modal = document.getElementById('full-gallery-modal');
  var closeBtn = document.getElementById('close-full-gallery');
  var backdrop = document.querySelector('[data-close-full-gallery]');

  var openModal = function() {
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gallery-open');
  };
  var closeModal = function() {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gallery-open');
  };

  openBtn?.addEventListener('click', function(e) {
    e.preventDefault();
    openModal();
  });
  closeBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);
  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal?.classList.contains('open')) closeModal();
  });
}

function setupFullCalendarModal() {
  var openBtn = document.getElementById('open-full-calendar');
  var modal = document.getElementById('full-calendar-modal');
  var closeBtn = document.getElementById('close-full-calendar');
  var backdrop = document.querySelector('[data-close-full-calendar]');

  var openModal = function() {
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gallery-open');
  };
  var closeModal = function() {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gallery-open');
  };

  openBtn?.addEventListener('click', function(e) {
    e.preventDefault();
    openModal();
  });
  closeBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);
  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal?.classList.contains('open')) closeModal();
  });
}

function setupGalleryLightbox() {
  var lightbox = document.getElementById('gallery-lightbox');
  var lightboxImg = document.getElementById('gallery-lightbox-img');
  var closeBtn = document.getElementById('close-gallery-lightbox');
  var backdrop = document.querySelector('[data-close-lightbox]');

  var openLightbox = function(src, alt) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxImg.alt = alt || 'Gallery image';
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gallery-open');
  };
  window.openImageLightbox = openLightbox;
  var closeLightbox = function() {
    if (!lightbox) return;
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gallery-open');
  };

  document.addEventListener('click', function(e) {
    var item = e.target.closest('.gallery-item');
    if (!item) return;
    var img = item.querySelector('img');
    if (!img) return;
    e.preventDefault();
    openLightbox(img.src, img.alt);
  });
  closeBtn?.addEventListener('click', closeLightbox);
  backdrop?.addEventListener('click', closeLightbox);
  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && lightbox?.classList.contains('open')) closeLightbox();
  });
}

function setupCursorGlow() {
  var glow = document.getElementById('cursor-glow');
  if (!glow) return;
  var canUse = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  if (!canUse) return;
  var raf = 0;
  var x = -9999, y = -9999;
  var onMove = function(e) {
    x = e.clientX;
    y = e.clientY;
    glow.style.opacity = '1';
    if (raf) return;
    raf = window.requestAnimationFrame(function() {
      glow.style.left = x + 'px';
      glow.style.top = y + 'px';
      raf = 0;
    });
  };
  window.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('mouseleave', function() { glow.style.opacity = '0'; });
}

function setupVoicesCarousel() {
  var track = document.getElementById('voices-track');
  var prev = document.getElementById('voices-prev');
  var next = document.getElementById('voices-next');
  if (!track) return;
  var cards = Array.from(track.children).filter(function(el) { return el instanceof HTMLElement; });
  if (cards.length <= 1) return;
  var index = 0;

  var cardGap = 14;
  var apply = function() {
    var card = cards[index];
    var w = card?.getBoundingClientRect().width || 0;
    track.style.transform = 'translateX(' + (-index * (w + cardGap)) + 'px)';
  };
  var go = function(dir) {
    index = (index + dir + cards.length) % cards.length;
    apply();
  };

  prev?.addEventListener('click', function() { go(-1); });
  next?.addEventListener('click', function() { go(1); });
  window.addEventListener('resize', apply, { passive: true });

  var timer = window.setInterval(function() { go(1); }, 6500);
  track.addEventListener('mouseenter', function() { if (timer) window.clearInterval(timer); timer = 0; });
  track.addEventListener('mouseleave', function() { if (!timer) timer = window.setInterval(function() { go(1); }, 6500); });
  apply();
}

function setupIndexInfoPopup() {
  var infoModal = document.getElementById('info-modal');
  var infoModalClose = document.getElementById('info-modal-close');
  var infoEyebrow = document.getElementById('info-modal-eyebrow');
  var infoTitle = document.getElementById('info-modal-title');
  var infoBody = document.getElementById('info-modal-body');
  if (!infoModal || !infoTitle || !infoBody) return;

  var openInfoModal = function(payload) {
    var eyebrow = payload?.eyebrow ? String(payload.eyebrow).trim() : '';
    var title = payload?.title ? String(payload.title).trim() : '';
    var bodyHtml = payload?.bodyHtml ? String(payload.bodyHtml) : '';
    if (infoEyebrow) {
      infoEyebrow.textContent = eyebrow;
      infoEyebrow.style.display = eyebrow ? 'block' : 'none';
    }
    infoTitle.textContent = title;
    infoBody.innerHTML = bodyHtml;
    infoModal.classList.add('open');
    infoModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gallery-open');
  };
  var closeInfoModal = function() {
    infoModal.classList.remove('open');
    infoModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gallery-open');
  };

  var makePayload = function(el) {
    if (!el) return null;

    if (el.classList.contains('event-image-side')) {
      var title = el.closest('#signature-event')?.querySelector('h2')?.textContent?.trim() || 'Somali Night';
      var desc = el.closest('#signature-event')?.querySelector('.event-content-side p')?.textContent?.trim() || '';
      var bodyHtml = desc ? '<p>' + escapeHtml(desc) + '</p>' : '';
      return { eyebrow: 'Signature Event', title: title, bodyHtml: bodyHtml };
    }

    if (el.classList.contains('pillar')) {
      var title = el.querySelector('.pillar-title')?.textContent?.trim() || 'SSA';
      var p = el.querySelector('p')?.textContent?.trim() || '';
      return { eyebrow: 'About SSA', title: title, bodyHtml: p ? '<p>' + escapeHtml(p) + '</p>' : '' };
    }

    if (el.classList.contains('leader-card')) {
      var name = el.querySelector('.leader-name')?.textContent?.trim() || 'Board Member';
      var role = el.querySelector('.leader-role')?.textContent?.trim() || '';
      var bio = el.querySelector('.leader-card-info p')?.textContent?.trim() || '';
      var body = [
        role && '<p style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold-light);margin:0 0 14px 0;">' + escapeHtml(role) + '</p>',
        bio && '<p>' + escapeHtml(bio) + '</p>'
      ]
        .filter(Boolean)
        .join('');
      return { eyebrow: 'Executive Board', title: name, bodyHtml: body || '<p>SSA leadership team member.</p>' };
    }

    if (el.classList.contains('event-row')) {
      var title = el.querySelector('.event-details h3')?.textContent?.trim() || 'Event';
      var desc = el.querySelector('.event-details p')?.textContent?.trim() || '';
      var tag = el.querySelector('.event-row-tag')?.textContent?.trim() || '';
      var action = el.querySelector('.event-row-actions a');
      var linkHref = action?.getAttribute('href') || '';
      var linkText = action?.textContent || 'Learn More';
      var linkHtml = action && linkHref
        ? '<p style="margin-top:16px;"><a href="' + escapeHtml(linkHref) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(linkText) + '</a></p>'
        : '';
      return { eyebrow: tag || 'Upcoming Events', title: title, bodyHtml: (desc ? '<p>' + escapeHtml(desc) + '</p>' : '') + linkHtml };
    }

    if (el.classList.contains('voice-card')) {
      var quote = el.querySelector('.voice-quote')?.textContent?.trim() || 'Voice';
      var body = el.querySelector('.voice-body')?.textContent?.trim() || '';
      var name = el.querySelector('.voice-name')?.textContent?.trim() || '';
      var tag = el.querySelector('.voice-tag')?.textContent?.trim() || '';
      var footer = (name || tag)
        ? '<p style="margin-top:16px;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold-light);">' + escapeHtml([name, tag].filter(Boolean).join(' · ')) + '</p>'
        : '';
      return { eyebrow: 'Voices', title: quote.replace(/^"|"$/g, ''), bodyHtml: (body ? '<p>' + escapeHtml(body) + '</p>' : '') + footer };
    }

    if (el.classList.contains('alumni-card')) {
      var title = el.querySelector('h3')?.textContent?.trim() || 'Alumni';
      var role = el.querySelector('.role')?.textContent?.trim() || '';
      var bodyHtml = role ? '<p style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold-light);margin:0;">' + escapeHtml(role) + '</p>' : '';
      return { eyebrow: 'Board Alumni', title: title, bodyHtml: bodyHtml };
    }

    return null;
  };

  var makeClickable = function(selector) {
    document.querySelectorAll(selector).forEach(function(node) {
      node.classList.add('click-popup');
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
    });
  };
  makeClickable('.event-image-side, .pillar, .voice-card, .alumni-card');

  document.addEventListener('click', function(e) {
    var t = e.target;
    var target =
      t.closest('.event-image-side') ||
      t.closest('.pillar') ||
      t.closest('.leader-card') ||
      t.closest('.event-row') ||
      t.closest('.voice-card') ||
      t.closest('.alumni-card');
    if (!target) return;
    if (t.closest('a, button')) return;
    var payload = makePayload(target);
    if (!payload) return;
    e.preventDefault();
    openInfoModal(payload);
  });

  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = e.target;
    var target =
      t.closest('.event-image-side') ||
      t.closest('.pillar') ||
      t.closest('.leader-card') ||
      t.closest('.event-row') ||
      t.closest('.voice-card') ||
      t.closest('.alumni-card');
    if (!target) return;
    if (!target.classList.contains('click-popup')) return;
    e.preventDefault();
    var payload = makePayload(target);
    if (payload) openInfoModal(payload);
  });

  infoModalClose?.addEventListener('click', closeInfoModal);
  infoModal?.addEventListener('click', function(e) { if (e.target === infoModal) closeInfoModal(); });
  window.addEventListener('keydown', function(e) { if (e.key === 'Escape' && infoModal?.classList.contains('open')) closeInfoModal(); });
}
