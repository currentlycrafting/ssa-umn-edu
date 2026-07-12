/* Shared SSA navigation — compact links, options menu, theme, modal triggers. */
(function () {
  const THEMES = ['light', 'dark'];

  function applyTheme(name) {
    if (!THEMES.includes(name)) name = 'light';
    document.documentElement.setAttribute('data-theme', name);
    localStorage.setItem('ssaTheme', name);
    document.querySelectorAll('.theme-toggle').forEach((el) => {
      el.setAttribute('aria-label', name === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }

  const stored = localStorage.getItem('ssaTheme');
  applyTheme(THEMES.includes(stored) ? stored : 'light');

  // Normalize the copied page navigation into one compact shared structure.
  const nav = document.querySelector('.nav');
  const links = document.getElementById('navLinks');
  if (nav && links) {
    links.innerHTML = `
      <a href="/index.html">Home</a>
      <a href="/events">Events</a>
      <a href="/newsletter">Newsletter</a>
      <a href="/aux">Want The Aux</a>
      <a href="/gallery">Gallery</a>
      <div class="nav-options">
        <button class="nav-options-toggle" type="button" aria-label="Options" aria-expanded="false" aria-controls="navOptionsMenu">
          <span class="nav-options-icon" aria-hidden="true"></span>
        </button>
        <div class="nav-options-menu" id="navOptionsMenu">
          <a href="/games">Arcade</a>
          <a href="/donate">Donate</a>
          <a href="/board">Board</a>
        </div>
      </div>`;
    nav.querySelectorAll('.nav-newsletter, .signup-menu, .nav-action.connect').forEach((el) => el.remove());
    nav.querySelectorAll('.theme-label').forEach((el) => el.remove());
  }

  const themeToggle = document.getElementById('themeToggle');
  themeToggle && themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const idx = THEMES.indexOf(current);
    applyTheme(THEMES[(idx + 1) % THEMES.length]);
  });

  // Mobile nav
  const toggle = document.getElementById('navMenuToggle');
  if (nav && toggle && links) {
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
    links.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('is-open') && !nav.contains(e.target)) close();
    });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    window.addEventListener('resize', () => { if (window.innerWidth > 900) close(); });
  }

  // Collapsible Options menu.
  const options = document.querySelector('.nav-options');
  const optionsToggle = document.querySelector('.nav-options-toggle');
  const closeOptions = () => {
    options?.classList.remove('open');
    optionsToggle?.setAttribute('aria-expanded', 'false');
  };
  optionsToggle?.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = options.classList.toggle('open');
    optionsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', (event) => {
    if (options?.classList.contains('open') && !options.contains(event.target)) closeOptions();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeOptions();
  });

  document.querySelectorAll('[data-suggest-event]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const type = btn.dataset.suggestType || 'campus';
      if (typeof window.openSuggestModal === 'function') {
        event.preventDefault();
        window.openSuggestModal(type);
      }
    });
  });

  // Mark active nav link
  const path = window.location.pathname.replace(/\/$/, '') || '/index.html';
  document.querySelectorAll('.nav-links a').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    const normalized = href.replace(/\/$/, '');
    if (path === normalized || (path.endsWith('index.html') && normalized === '/index.html')) {
      a.classList.add('active');
    }
  });
  if (path === '/daily' || path === '/connections') {
    document.querySelector('.nav-options-menu a[href="/games"]')?.classList.add('active');
  }
  if (options?.querySelector('a.active')) optionsToggle?.classList.add('active');

  const footerHtml = `
    <footer class="footer">
      <div class="footer-card">
        <a class="footer-brand" href="/index.html"><img src="/assets/brand/ssa-logo.png" alt="" />SSA</a>
        <nav aria-label="Footer">
          <a href="/events">Events</a>
          <a href="/games">Arcade</a>
          <a href="/newsletter">Newsletter</a>
          <a href="/donate">Donate</a>
          <a href="/aux">Want The Aux</a>
          <a href="/board">Board</a>
        </nav>
        <div class="social-row">
          <a href="mailto:ssa@umn.edu">Email</a>
          <a href="https://www.instagram.com/ssa.umn/" target="_blank" rel="noopener noreferrer">Instagram</a>
          <a href="https://www.tiktok.com/@ssaumn" target="_blank" rel="noopener noreferrer">TikTok</a>
          <a href="https://www.linkedin.com/in/somali-student-association-at-the-university-of-minnesota-b435362a2" target="_blank" rel="noopener noreferrer">LinkedIn</a>
        </div>
        <small>© 2026 Somali Student Association — University of Minnesota</small>
      </div>
    </footer>`;
  const footer = document.querySelector('.footer');
  if (footer) footer.outerHTML = footerHtml;
  else document.body.insertAdjacentHTML('beforeend', footerHtml);
})();
