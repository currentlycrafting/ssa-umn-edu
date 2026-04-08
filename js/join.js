/* join.html — all page JavaScript */

// ── Scroll progress, navbar, side-nav tracking ──
(function () {
  var bar = document.getElementById('scroll-progress');
  var sectionIds = ['hero','board','interns','committee','events','applications','suggestion'];
  var dots = document.querySelectorAll('.side-dot');

  window.addEventListener('scroll', function () {
    var top = window.scrollY;
    var height = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (top / height * 100) + '%';

    document.getElementById('navbar').classList.toggle('scrolled', top > 80);

    var current = 0;
    sectionIds.forEach(function (id, i) {
      var el = document.getElementById(id);
      if (el && window.scrollY >= el.offsetTop - 200) current = i;
    });
    dots.forEach(function (d, i) { d.classList.toggle('active', i === current); });
  });
})();

// ── Smooth scroll helper (used by inline onclick on side-dots) ──
function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

// ── Reveal on scroll ──
(function () {
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(function (el) { observer.observe(el); });
})();

// ── Board role modal ──
(function () {
  var roleModal = document.getElementById('role-modal');
  var roleModalContent = document.getElementById('role-modal-content');
  var roleModalClose = document.getElementById('role-modal-close');

  document.querySelectorAll('.role-card').forEach(function (card) {
    card.addEventListener('click', function () {
      var number = (card.querySelector('.role-number')?.textContent || '').trim();
      var title = (card.querySelector('.role-title')?.textContent || '').trim();
      var tagline = (card.querySelector('.role-tagline')?.textContent || '').trim();
      var desc = (card.querySelector('.role-desc')?.textContent || '').trim();
      var metaHtml = Array.from(card.querySelectorAll('.role-meta-item')).map(function (item) {
        var key = (item.querySelector('.role-meta-label')?.textContent || '').trim();
        var val = (item.querySelector('.role-meta-val')?.textContent || '').trim();
        return '<div><div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:4px;">' + key + '</div><p style="font-size:13px;line-height:1.75;color:var(--silver);">' + val + '</p></div>';
      }).join('');

      roleModalContent.innerHTML =
        '<div style="font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold);margin-bottom:10px;">' + number + '</div>' +
        '<h3 style="font-family:var(--font-display);font-size:38px;line-height:1.08;margin-bottom:10px;color:var(--white);">' + title + '</h3>' +
        '<p style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold-light);margin-bottom:18px;">' + tagline + '</p>' +
        '<p style="font-size:14px;line-height:1.9;color:var(--silver);margin-bottom:20px;">' + desc + '</p>' +
        '<div class="role-modal-meta">' + metaHtml + '</div>';

      roleModal.classList.add('open');
      roleModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    });
  });

  function closeRoleModal() {
    roleModal.classList.remove('open');
    roleModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  roleModalClose?.addEventListener('click', closeRoleModal);
  roleModal?.addEventListener('click', function (e) { if (e.target === roleModal) closeRoleModal(); });
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && roleModal?.classList.contains('open')) closeRoleModal(); });
})();

// ── Apply disclaimer modal ──
var applyDisclaimerModal = document.getElementById('apply-disclaimer-modal');
var applyDisclaimerClose = document.getElementById('apply-disclaimer-close');

function showApplyDisclaimer(e) {
  if (e) e.preventDefault();
  if (applyDisclaimerModal) {
    applyDisclaimerModal.classList.add('open');
    applyDisclaimerModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
}
function closeApplyDisclaimer() {
  if (applyDisclaimerModal) {
    applyDisclaimerModal.classList.remove('open');
    applyDisclaimerModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
}
applyDisclaimerClose?.addEventListener('click', closeApplyDisclaimer);
applyDisclaimerModal?.addEventListener('click', function (e) { if (e.target === applyDisclaimerModal) closeApplyDisclaimer(); });
window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && applyDisclaimerModal?.classList.contains('open')) closeApplyDisclaimer(); });
document.querySelectorAll('.apply-cta').forEach(function (el) {
  // Kept for backwards compatibility if any apply-cta remains.
  // Join now links directly to the Google Form.
  el.addEventListener('click', showApplyDisclaimer);
});

// ── Cursor-follow glow (desktop only) ──
(function () {
  var glow = document.getElementById('cursor-glow');
  if (!glow) return;
  var canUse = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  if (!canUse) return;
  var raf = 0, x = -9999, y = -9999;
  var onMove = function (e) {
    x = e.clientX;
    y = e.clientY;
    glow.style.opacity = '1';
    if (raf) return;
    raf = window.requestAnimationFrame(function () {
      glow.style.left = x + 'px';
      glow.style.top = y + 'px';
      raf = 0;
    });
  };
  window.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('mouseleave', function () { glow.style.opacity = '0'; });
})();

// ── Utility: minimal HTML escape ──
function escapeHtml(v) {
  return String(v || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// ── Info modal + clickable card popup system ──
(function () {
  var infoModal = document.getElementById('info-modal');
  var infoModalClose = document.getElementById('info-modal-close');
  var infoEyebrow = document.getElementById('info-modal-eyebrow');
  var infoTitle = document.getElementById('info-modal-title');
  var infoBody = document.getElementById('info-modal-body');

  function openInfoModal(payload) {
    if (!infoModal || !infoTitle || !infoBody) return;
    var eyebrow = (payload && payload.eyebrow) ? String(payload.eyebrow).trim() : '';
    var title = (payload && payload.title) ? String(payload.title).trim() : '';
    var bodyHtml = (payload && payload.bodyHtml) ? String(payload.bodyHtml) : '';
    if (infoEyebrow) {
      infoEyebrow.textContent = eyebrow;
      infoEyebrow.style.display = eyebrow ? 'block' : 'none';
    }
    infoTitle.textContent = title;
    infoBody.innerHTML = bodyHtml;
    infoModal.classList.add('open');
    infoModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeInfoModal() {
    if (!infoModal) return;
    infoModal.classList.remove('open');
    infoModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function makeCardPopupPayload(card) {
    if (!card) return null;
    if (card.classList.contains('collab-card')) {
      var ey = card.querySelector('.collab-from')?.textContent?.trim() || 'Cross-Functional Collaboration';
      var t = card.querySelector('.collab-role')?.textContent?.trim() || 'Details';
      var partners = card.querySelector('.collab-partners');
      var bh = partners ? partners.innerHTML : '<p>' + escapeHtml(card.textContent || '') + '</p>';
      return { eyebrow: ey, title: t, bodyHtml: bh };
    }
    if (card.classList.contains('ops-enhanced-card')) {
      var t2 = card.querySelector('h4')?.textContent?.trim() || 'Details';
      var p2 = card.querySelector('p')?.textContent?.trim() || '';
      return { eyebrow: 'How SSA Works', title: t2, bodyHtml: p2 ? '<p>' + escapeHtml(p2) + '</p>' : '' };
    }
    if (card.classList.contains('intern-card')) {
      var ey3 = card.querySelector('.intern-for')?.textContent?.trim() || 'Intern Program';
      var t3 = card.querySelector('.intern-title')?.textContent?.trim() || 'Intern Role';
      var p3 = card.querySelector('.intern-desc')?.textContent?.trim() || '';
      return { eyebrow: ey3, title: t3, bodyHtml: p3 ? '<p>' + escapeHtml(p3) + '</p>' : '' };
    }
    if (card.classList.contains('event-roster-item')) {
      var ey4 = card.querySelector('.event-roster-label')?.textContent?.trim() || 'SSA Traditions';
      var t4 = card.querySelector('.event-roster-name')?.textContent?.trim() || 'Signature Event';
      var p4 = card.querySelector('.event-roster-desc')?.textContent?.trim() || '';
      return { eyebrow: ey4, title: t4, bodyHtml: p4 ? '<p>' + escapeHtml(p4) + '</p>' : '' };
    }
    if (card.classList.contains('conduct-item')) {
      var t5 = card.querySelector('h4')?.textContent?.trim() || 'Code of Conduct';
      var p5 = card.querySelector('p')?.textContent?.trim() || '';
      return { eyebrow: 'Code of Conduct', title: t5, bodyHtml: p5 ? '<p>' + escapeHtml(p5) + '</p>' : '' };
    }
    if (card.classList.contains('funding-card')) {
      var abbr = card.querySelector('.funding-abbr')?.textContent?.trim() || '';
      var t6 = card.querySelector('.funding-name')?.textContent?.trim() || 'Funding Resource';
      var p6 = card.querySelector('.funding-desc')?.textContent?.trim() || '';
      var href = card.querySelector('a.funding-link')?.getAttribute('href') || '';
      var linkText = card.querySelector('a.funding-link')?.textContent?.trim() || 'Learn more';
      var linkHtml = href && href !== '#'
        ? '<p style="margin-top:16px;"><a class="funding-link" href="' + escapeHtml(href) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(linkText) + '</a></p>'
        : '';
      return { eyebrow: abbr || 'Funding', title: t6, bodyHtml: (p6 ? '<p>' + escapeHtml(p6) + '</p>' : '') + linkHtml };
    }
    if (card.classList.contains('sn-item')) {
      var t7 = card.querySelector('h4')?.textContent?.trim() || 'Somali Night';
      var bh7 = card.querySelector('p') ? card.querySelector('p').innerHTML : '<p>' + escapeHtml(card.textContent || '') + '</p>';
      return { eyebrow: "Deep Dive \u00b7 Somali Night", title: t7, bodyHtml: bh7 };
    }
    if (card.classList.contains('work-pillar')) {
      var num = card.querySelector('.work-pillar-num')?.textContent?.trim() || '';
      var t8 = card.querySelector('h3')?.textContent?.trim() || 'How SSA Works';
      var p8 = card.querySelector('p')?.textContent?.trim() || '';
      return { eyebrow: (num ? num + ' \u00b7 ' : '') + 'Chain of Command', title: t8, bodyHtml: p8 ? '<p>' + escapeHtml(p8) + '</p>' : '' };
    }
    if (card.classList.contains('event-type')) {
      var ey9 = card.querySelector('.event-type-badge')?.textContent?.trim() || 'Events & Programming';
      var t9 = card.querySelector('h3')?.textContent?.trim() || 'Event Type';
      var pHtml9 = card.querySelector('p') ? '<p>' + escapeHtml(card.querySelector('p').textContent || '') + '</p>' : '';
      var list9 = card.querySelector('ul');
      var listHtml9 = list9 ? list9.outerHTML : '';
      return { eyebrow: 'Events & Programming', title: ey9 + ' \u2014 ' + t9, bodyHtml: pHtml9 + listHtml9 };
    }
    if (card.classList.contains('org-node')) {
      var t10 = card.querySelector('.node-title')?.textContent?.trim() || card.textContent?.trim() || 'Role';
      var div10 = card.querySelector('.node-div')?.textContent?.trim() || '';
      var colLabel = card.closest('.chain-column')?.querySelector('.chain-column-label')?.textContent?.trim() || '';
      return { eyebrow: colLabel || 'Chain of Command', title: t10, bodyHtml: div10 ? '<p>' + escapeHtml(div10) + '</p>' : '' };
    }
    return null;
  }

  var popupCards = document.querySelectorAll('.collab-card, .ops-enhanced-card, .intern-card, .event-roster-item, .conduct-item, .funding-card, .sn-item, .work-pillar, .event-type, .org-node');
  popupCards.forEach(function (card) {
    card.classList.add('click-popup');
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.addEventListener('click', function (e) {
      if (e && e.target && e.target.closest && e.target.closest('a')) return;
      var payload = makeCardPopupPayload(card);
      if (payload) openInfoModal(payload);
    });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var payload = makeCardPopupPayload(card);
        if (payload) openInfoModal(payload);
      }
    });
  });

  infoModalClose?.addEventListener('click', closeInfoModal);
  infoModal?.addEventListener('click', function (e) { if (e.target === infoModal) closeInfoModal(); });
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && infoModal?.classList.contains('open')) closeInfoModal(); });
})();

// ── Hi-five Easter egg (used by inline onclick) ──
function doHiFive() {
  var btn = document.getElementById('hifive-btn');
  var msg = document.getElementById('hifive-msg');
  btn.classList.add('slapped');
  msg.classList.add('visible');

  var canvas = document.getElementById('hifive-confetti');
  var ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  var colors = ['#b89a5c','#d4b87a','#f8f6f2','#9a9fad','#1e2540'];
  var pieces = [];
  var btnRect = btn.getBoundingClientRect();
  var cx = btnRect.left + btnRect.width / 2;
  var cy = btnRect.top;

  for (var i = 0; i < 60; i++) {
    pieces.push({
      x: cx, y: cy,
      vx: (Math.random() - 0.5) * 8,
      vy: -Math.random() * 10 - 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 4,
      rot: Math.random() * 360,
      vr: (Math.random() - 0.5) * 12,
      alpha: 1
    });
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var alive = false;
    pieces.forEach(function (p) {
      if (p.alpha <= 0) return;
      p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.rot += p.vr; p.alpha -= 0.018;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
      if (p.alpha > 0) alive = true;
    });
    if (alive) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  animate();

  setTimeout(function () { btn.classList.remove('slapped'); }, 600);
}

// ── Suggestion form handler (used by inline onsubmit) ──
async function handleSuggestion(e) {
  e.preventDefault();
  var nameEl = document.getElementById('sug-name');
  var typeEl = document.getElementById('sug-type');
  var ideaEl = document.getElementById('sug-idea');
  var audienceEl = document.getElementById('sug-audience');
  var ideaText = (ideaEl && ideaEl.value || '').trim();
  var suggestionType = (typeEl && typeEl.value || '').trim();
  if (!ideaText) { alert('Please describe your idea or suggestion.'); return; }
  if (!suggestionType) { alert('Please select a suggestion type.'); return; }
  var form = e.target;
  var submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  try {
    var res = await fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submitter_name: nameEl ? nameEl.value.trim() : '',
        suggestion_type: suggestionType,
        idea_text: ideaText,
        audience: audienceEl ? audienceEl.value.trim() : ''
      })
    });
    var data = res.ok ? await res.json() : {};
    if (!res.ok) {
      alert(data.error || 'Could not submit. Please try again.');
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
    document.getElementById('sug-confirm').style.display = 'block';
    form.style.display = 'none';
  } catch (err) {
    alert('Could not send suggestion. Please check your connection and try again.');
    if (submitBtn) submitBtn.disabled = false;
  }
}
