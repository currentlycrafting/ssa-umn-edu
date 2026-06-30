(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) document.documentElement.classList.add('reduce-motion');

  window.ssaMotion = { reduced, pulse: pulse };

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  onReady(() => {
    document.body.classList.add('page-ready');

    initScrollReveals();
    initStaggerGrids();
    initTimelineMotion();
    initNavRipple();
    initLinkHovers();
    initPageHeroMotion();
    initNavScroll();
    initHeroWordStagger();
    initStatCountUp();
    initSideNavPulse();
    initModalMotion();
    initThemeToggleSpin();
    initFormOutputWatch();
    initAnchorFlash();
    initConnectOptionRipple();
    initMobileNav();
  });

  function pulse(el, className = 'ui-pulse') {
    if (!el || reduced) return;
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
    window.setTimeout(() => el.classList.remove(className), 650);
  }

  function initScrollReveals() {
    const targets = document.querySelectorAll(
      '.section, .stat-card, .event-card, .program-card, .focus-card, .board-card, ' +
      '.president-card, .form-card, .mission-item, .donation-card, .carousel-section, ' +
      '.timeline-card, .timeline-hero, .gallery-hero, .gallery-end, .game-wrap, ' +
      '.footer-card, .connect-inline, .donate-hero, .hero-center, .polaroid, .section-head, .pill'
    );
    if (!targets.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });

    targets.forEach((el) => {
      el.classList.add('fade-up');
      observer.observe(el);
    });
  }

  function initStaggerGrids() {
    const grids = '.stat-grid, .event-grid, .focus-grid, .board-grid, .mission-list, ' +
      '.donation-grid, .timeline-section, .gallery-book, .social-row, .checklist-steps, ' +
      '.hero-actions, .connect-options, .trust-row';
    document.querySelectorAll(grids).forEach((grid) => {
      Array.from(grid.children).forEach((child, i) => {
        child.style.setProperty('--stagger', `${Math.min(i * 65, 480)}ms`);
      });
    });
  }

  function initTimelineMotion() {
    const section = document.querySelector('.timeline-section');
    const line = document.querySelector('.timeline-line');
    if (!section || !line) return;

    let fill = line.querySelector('.timeline-line-fill');
    if (!fill) {
      fill = document.createElement('span');
      fill.className = 'timeline-line-fill';
      fill.setAttribute('aria-hidden', 'true');
      line.appendChild(fill);
    }

    const cards = Array.from(section.querySelectorAll('.timeline-card'));
    cards.forEach((card, i) => {
      card.style.setProperty('--stagger', `${i * 90}ms`);
    });

    function updateLine() {
      if (reduced) {
        fill.style.height = '100%';
        return;
      }
      const rect = section.getBoundingClientRect();
      const viewMid = window.innerHeight * 0.55;
      const sectionTop = rect.top + window.scrollY;
      const progress = Math.min(1, Math.max(0, (window.scrollY + viewMid - sectionTop) / Math.max(rect.height, 1)));
      fill.style.height = `${progress * 100}%`;
      line.style.setProperty('--line-glow', `${0.4 + progress * 0.6}`);
    }

    window.addEventListener('scroll', updateLine, { passive: true });
    window.addEventListener('resize', updateLine, { passive: true });
    updateLine();
  }

  function initNavRipple() {
    const rippleTargets = '.nav-links a, .button, .micro-button, .connect-option, .checklist-steps button, ' +
      '.carousel-dot, .carousel-arrow, .gallery-lightbox-nav, .tile, .donation-grid-mini a, .admin-tab';
    document.querySelectorAll(rippleTargets).forEach((el) => {
      el.addEventListener('pointerdown', (event) => {
        if (reduced || event.button !== 0) return;
        spawnRipple(el, event.clientX, event.clientY);
      });
    });
  }

  function spawnRipple(el, clientX, clientY) {
    const rect = el.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ui-ripple';
    const size = Math.max(rect.width, rect.height) * 1.6;
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${clientX - rect.left - size / 2}px`;
    ripple.style.top = `${clientY - rect.top - size / 2}px`;
    el.classList.add('has-ripple');
    el.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  }

  function initLinkHovers() {
    document.querySelectorAll('.footer-card nav a, .social-row a, .nav-links a, .timeline-content .button').forEach((link) => {
      link.classList.add('link-slide');
    });
  }

  function initPageHeroMotion() {
    document.querySelectorAll('.gallery-hero, .game-wrap > .eyebrow, .timeline-hero h1, .timeline-hero p').forEach((el, i) => {
      el.style.setProperty('--hero-delay', `${i * 90}ms`);
      el.classList.add('hero-reveal');
    });
  }

  function initNavScroll() {
    const nav = document.querySelector('.nav');
    if (!nav) return;
    function update() {
      nav.classList.toggle('is-scrolled', window.scrollY > 24);
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  function initHeroWordStagger() {
    document.querySelectorAll('.hero h1 .word, .hero h1 .blue-word, .hero h1 .scribble').forEach((word, i) => {
      word.classList.add('hero-word');
      word.style.setProperty('--word-delay', `${200 + i * 110}ms`);
    });
  }

  function parseStat(text) {
    const raw = text.trim();
    if (raw.startsWith('#')) return null;
    if (raw.includes('K')) {
      const n = parseFloat(raw);
      return { end: n * 1000, format: (v) => `${Math.round(v / 1000)}K` };
    }
    if (raw.includes('+')) {
      const n = parseInt(raw, 10);
      return { end: n, format: (v) => `${Math.round(v)}+` };
    }
    if (raw.includes('%')) {
      return { end: 100, format: (v) => `${Math.round(v)}%` };
    }
    const n = parseInt(raw.replace(/[^\d]/g, ''), 10);
    if (!Number.isFinite(n)) return null;
    return { end: n, format: (v) => String(Math.round(v)) };
  }

  function initStatCountUp() {
    if (reduced) return;
    const cards = document.querySelectorAll('.stat-card');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const card = entry.target;
        const strong = card.querySelector('strong');
        if (!strong || strong.dataset.counted === '1') return;
        const spec = parseStat(strong.textContent);
        if (!spec) return;
        strong.dataset.counted = '1';
        const start = performance.now();
        const from = Math.max(0, spec.end * 0.55);
        const duration = 900;
        function tick(now) {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          const val = from + (spec.end - from) * eased;
          strong.textContent = spec.format(val);
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        observer.unobserve(card);
      });
    }, { threshold: 0.5 });
    cards.forEach((card) => observer.observe(card));
  }

  function initSideNavPulse() {
    const nav = document.getElementById('sideNav');
    if (!nav) return;
    let lastActive = nav.querySelector('a.active');
    const check = () => {
      const active = nav.querySelector('a.active');
      if (active && active !== lastActive) {
        pulse(active.querySelector('.dot') || active, 'dot-pulse');
        lastActive = active;
      }
    };
    window.addEventListener('scroll', check, { passive: true });
    setInterval(check, 400);
  }

  function initModalMotion() {
    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      const observer = new MutationObserver(() => {
        if (!backdrop.classList.contains('open')) return;
        backdrop.querySelectorAll('.connect-option, .rsvp-modal input, .newsletter-sheet input').forEach((el, i) => {
          el.style.setProperty('--modal-stagger', `${i * 55}ms`);
          el.classList.add('modal-pop');
        });
      });
      observer.observe(backdrop, { attributes: true, attributeFilter: ['class'] });
    });
  }

  function initThemeToggleSpin() {
    document.querySelectorAll('.theme-toggle').forEach((btn) => {
      btn.addEventListener('click', () => {
        btn.classList.remove('theme-spin');
        void btn.offsetWidth;
        btn.classList.add('theme-spin');
      });
    });
  }

  function initFormOutputWatch() {
    document.querySelectorAll('form output').forEach((out) => {
      const observer = new MutationObserver(() => {
        if (!out.textContent.trim()) return;
        out.classList.remove('output-pop');
        void out.offsetWidth;
        out.classList.add('output-pop');
      });
      observer.observe(out, { childList: true, characterData: true, subtree: true });
    });
  }

  function initAnchorFlash() {
    if (window.location.hash) flashTarget(window.location.hash);
    window.addEventListener('hashchange', () => flashTarget(window.location.hash));
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', () => {
        const hash = link.getAttribute('href');
        if (hash && hash.length > 1) window.setTimeout(() => flashTarget(hash), 450);
      });
    });
  }

  function flashTarget(hash) {
    const el = document.querySelector(hash);
    if (!el) return;
    el.classList.remove('section-flash');
    void el.offsetWidth;
    el.classList.add('section-flash');
    window.setTimeout(() => el.classList.remove('section-flash'), 1200);
  }

  function initConnectOptionRipple() {
    document.querySelectorAll('.connect-option').forEach((btn) => {
      btn.addEventListener('click', () => pulse(btn, 'option-pop'));
    });
  }

  function initMobileNav() {
    const nav = document.querySelector('.nav');
    const toggle = document.getElementById('navMenuToggle');
    const links = document.getElementById('navLinks');
    if (!nav || !toggle || !links) return;

    const close = () => {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
    };

    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });

    links.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', close);
    });

    document.addEventListener('click', (event) => {
      if (!nav.classList.contains('is-open')) return;
      if (!nav.contains(event.target)) close();
    });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') close();
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) close();
    });
  }

  window.ssaReveal = function (el) {
    if (el) el.classList.add('visible');
  };

  window.ssaPulse = pulse;
})();
