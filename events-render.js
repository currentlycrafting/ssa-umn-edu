(function () {
  const api = window.ssaFetch?.json;
  if (!api) return;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function displayTime(startTime) {
    if (!startTime) return '';
    const [hours, minutes] = startTime.split(':').map(Number);
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const hour = hours % 12 || 12;
    return `${hour}:${String(minutes || 0).padStart(2, '0')} ${suffix}`;
  }

  function formatFromStartsAt(event, style) {
    if (!event.startsAt) return '';
    const date = new Date(event.startsAt);
    if (Number.isNaN(date.getTime())) return '';
    if (style === 'short') {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
    const when = date.toLocaleString([], { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    return event.location ? `${when} · ${event.location}` : when;
  }

  function displayDate(event) {
    if (event.startsAt) return formatFromStartsAt(event, 'full');
    if (event.dateLabel) return event.dateLabel;
    const time = displayTime(event.startTime);
    return time || '';
  }

  function displayShort(event) {
    if (event.startsAt) return formatFromStartsAt(event, 'short');
    return event.shortDate || '';
  }

  function eventWhen(event) {
    if (event.startsAt) {
      const date = new Date(event.startsAt);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleString([], { weekday: 'short', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      }
    }
    if (event.dateLabel) {
      const time = displayTime(event.startTime);
      return time ? `${event.dateLabel} · ${time}` : event.dateLabel;
    }
    return displayTime(event.startTime) || 'Date TBD';
  }

  function eventWhere(event) {
    return event.location || '';
  }

  function attendingLabel(event) {
    const raw = document.querySelector(`[data-event-count="${CSS.escape(event.rsvpKey || '')}"]`)?.textContent;
    const count = raw && raw !== '—' ? Number(raw) : null;
    if (count == null || Number.isNaN(count)) return 'RSVPs coming in';
    return `${count} ${count === 1 ? 'person' : 'people'} coming`;
  }

  function eventKey(event) {
    return String(event.rsvpKey || event.id || event.title || '');
  }

  function findEvent(key) {
    return (sourceEvents || []).find((event) => eventKey(event) === String(key));
  }

  function setHidden(element, hidden) {
    if (!element) return;
    element.hidden = hidden;
  }

  function isPast(event) {
    if (event.past) return true;
    if (!event.startsAt) return false;
    return new Date(event.startsAt).getTime() <= Date.now();
  }

  function upcomingEvents(events) {
    const now = Date.now();
    return (events || [])
      .filter((event) => event.startsAt && new Date(event.startsAt).getTime() > now)
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
      .map((event, index) => ({ ...event, featured: index === 0, showCountdown: true, past: false }));
  }

  function pastEvents(events) {
    const now = Date.now();
    return (events || [])
      .filter((event) => event.startsAt && new Date(event.startsAt).getTime() <= now)
      .sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt))
      .map((event) => ({ ...event, featured: false, past: true }));
  }

  function googleCalendarUrl(event) {
    if (!event.startsAt) return '';
    const start = new Date(event.startsAt);
    if (Number.isNaN(start.getTime())) return '';
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const stamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: event.title || 'SSA Event',
      dates: `${stamp(start)}/${stamp(end)}`,
      details: event.description || '',
      location: event.location || ''
    });
    return `https://calendar.google.com/calendar/render?${params}`;
  }

  function calendarButton(event, options = {}) {
    if (isPast(event) || !event.startsAt) return '';
    const googleCal = googleCalendarUrl(event);
    if (!googleCal) return '';
    const featured = options.featured;
    const classes = featured
      ? 'button button-dark handdrawn calendar-button'
      : 'micro-button calendar-button';
    return `<a class="${classes}" href="${esc(googleCal)}" target="_blank" rel="noopener">Add to calendar</a>`;
  }

  function featuredMarkup(event, options = {}) {
    const image = event.imageUrl || '';
    const art = image
      ? `<div class="featured-event-art"><img src="${esc(image)}" alt="${esc(event.title)} poster" /></div>`
      : '';
    const ribbon = options.ribbon
      ? '<span class="home-event-ribbon" aria-hidden="true">Next up</span>'
      : '';
    const rsvpLabel = event.attendanceMode === 'quick' ? 'RSVP' : 'Reserve Your Spot';
    return `
      ${ribbon}
      ${art}
      <div class="featured-event-body">
        <div class="featured-event-copy">
          <span class="eyebrow">Featured Event</span>
          <h3>${esc(event.title)}</h3>
          <p class="featured-location">${esc(displayDate(event))}</p>
          ${event.startsAt ? `<div class="featured-countdown" id="cmsFeaturedCountdown" data-start="${esc(event.startsAt)}" aria-label="Countdown"><div class="fc-cell"><b data-fc="days">—</b><span>days</span></div><div class="fc-cell"><b data-fc="hours">—</b><span>hrs</span></div><div class="fc-cell"><b data-fc="mins">—</b><span>min</span></div><div class="fc-cell"><b data-fc="secs">—</b><span>sec</span></div></div>` : ''}
          <p class="event-going"><span class="event-going-num" data-event-count="${esc(event.rsvpKey)}">—</span> coming</p>
          <div class="event-copy-stack">
            <p class="featured-copy event-card-copy is-clamped" data-full-copy>${esc(event.description)}</p>
            <button class="event-read-more" type="button" hidden>Read more</button>
          </div>
        </div>
        <div class="featured-event-actions">
          <button class="button button-dark handdrawn rsvp-button" type="button" data-event="${esc(event.rsvpKey)}" data-date="${esc(displayDate(event))}" data-attendance-mode="${esc(event.attendanceMode || 'rsvp')}" data-default-label="${rsvpLabel}"><span class="rsvp-btn-label">${rsvpLabel}</span></button>
          ${calendarButton(event, { featured: true })}
        </div>
      </div>`;
  }

  function eventCard(event) {
    const past = isPast(event);
    const short = displayShort(event);
    const time = event.startsAt
      ? new Date(event.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : displayTime(event.startTime);
    const rsvpLabel = 'RSVP';
    const poster = event.imageUrl
      ? `<div class="event-card-poster"><img src="${esc(event.imageUrl)}" alt="${esc(event.title)} poster" loading="lazy" /></div>`
      : '';
    const actions = past
      ? `<button class="micro-button feedback-button" type="button" data-event="${esc(event.rsvpKey)}" data-event-title="${esc(event.title)}">How was it?</button>`
      : `<button class="micro-button rsvp-button" type="button" data-event="${esc(event.rsvpKey)}" data-date="${esc(displayDate(event))}" data-attendance-mode="${esc(event.attendanceMode || 'rsvp')}" data-default-label="${rsvpLabel}"><span class="rsvp-btn-label">${rsvpLabel}</span></button>${calendarButton(event)}`;
    return `<article class="event-card${past ? ' event-card--past' : ''}" data-event-id="${esc(event.id || '')}" data-event-key="${esc(eventKey(event))}" ${past ? 'data-past="true"' : ''}>
      ${poster}
      <div class="event-card-body">
        ${past ? '<span class="event-finished">Finished</span>' : ''}
        <span class="event-date">${esc(short)}${time ? ` · ${esc(time)}` : ''}</span>
        <h3>${esc(event.title)}</h3>
        ${past ? '' : `<p class="event-going"><span class="event-going-num" data-event-count="${esc(event.rsvpKey)}">—</span> coming</p>`}
        <div class="event-copy-stack">
          <p class="event-card-copy is-clamped" data-full-copy>${esc(event.description)}</p>
          <button class="event-read-more" type="button" hidden>Read more</button>
        </div>
      </div>
      <div class="event-card-actions">
        ${actions}
      </div>
    </article>`;
  }

  let countdownTimer = null;
  let sourceEvents = [];
  let stickyFeatured = null;

  function renderFeatured(target, event, options = {}) {
    if (!target) return;
    if (!event) {
      target.innerHTML = '';
      delete target.dataset.eventKey;
      setHidden(target, true);
      return;
    }
    target.innerHTML = featuredMarkup(event, options);
    target.dataset.eventKey = eventKey(event);
    target.classList.toggle('featured-event--no-art', !event.imageUrl);
    setHidden(target, false);
  }

  function clearPlaceholders() {
    const homeFeatured = document.getElementById('featuredEvent');
    const homeRegular = document.getElementById('homeEvents');
    const eventsFeatured = document.getElementById('eventsFeatured');
    const eventsGrid = document.getElementById('eventsGrid');
    renderFeatured(homeFeatured, null);
    renderFeatured(eventsFeatured, null);
    if (homeFeatured && document.querySelector('.home-upcoming')) {
      homeFeatured.innerHTML = `
        <div class="featured-event-body home-upcoming-empty-event">
          <span class="eyebrow">Featured Event</span>
          <h3>No upcoming event yet</h3>
          <p class="featured-copy">New events will land here soon. Suggest one while you wait.</p>
          <a class="button button-dark handdrawn" href="/suggest">Suggest an Event</a>
        </div>`;
      homeFeatured.classList.add('featured-event--no-art');
      delete homeFeatured.dataset.eventKey;
      setHidden(homeFeatured, false);
    }
    if (homeRegular) {
      homeRegular.innerHTML = '';
      setHidden(homeRegular, true);
    }
    if (eventsGrid) eventsGrid.innerHTML = '';
    updateStickyBar(null);
  }

  function updateStickyBar(featured) {
    stickyFeatured = featured;
    let bar = document.getElementById('eventStickyRsvp');
    if (!document.body.classList.contains('events-page')) {
      bar?.remove();
      return;
    }
    if (!featured) {
      bar?.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'eventStickyRsvp';
      bar.className = 'event-sticky-rsvp';
      document.body.appendChild(bar);
    }
    const rsvpLabel = 'RSVP';
    bar.innerHTML = `
      <div class="event-sticky-rsvp-inner">
        <div>
          <strong>${esc(featured.title)}</strong>
          <span>${esc(displayShort(featured))}</span>
        </div>
        <button class="button button-dark rsvp-button" type="button" data-event="${esc(featured.rsvpKey)}" data-date="${esc(displayDate(featured))}" data-attendance-mode="${esc(featured.attendanceMode || 'rsvp')}" data-default-label="${rsvpLabel}"><span class="rsvp-btn-label">${rsvpLabel}</span></button>
      </div>`;
  }

  function paint(events) {
    const upcoming = upcomingEvents(events);
    const past = pastEvents(events);
    const featured = upcoming[0] || null;
    const regular = upcoming.slice(1);
    const homeFeatured = document.getElementById('featuredEvent');
    const homeHead = document.getElementById('featuredSectionHead');
    const homeRegular = document.getElementById('homeEvents');
    const eventsFeatured = document.getElementById('eventsFeatured');
    const eventsGrid = document.getElementById('eventsGrid');
    const condensedHome = Boolean(document.querySelector('.home-upcoming'));

    if (featured) {
      renderFeatured(homeFeatured, featured, { ribbon: condensedHome });
    } else if (condensedHome && homeFeatured) {
      homeFeatured.innerHTML = `
        <div class="featured-event-body home-upcoming-empty-event">
          <span class="eyebrow">Featured Event</span>
          <h3>No upcoming event yet</h3>
          <p class="featured-copy">New events will land here soon. Suggest one while you wait.</p>
          <a class="button button-dark handdrawn" href="/suggest">Suggest an Event</a>
        </div>`;
      homeFeatured.classList.add('featured-event--no-art');
      delete homeFeatured.dataset.eventKey;
      setHidden(homeFeatured, false);
    } else {
      renderFeatured(homeFeatured, null);
    }
    renderFeatured(eventsFeatured, featured);
    updateStickyBar(featured);

    if (homeHead && !condensedHome) {
      if (featured) {
        homeHead.innerHTML = '<span class="eyebrow">Upcoming</span><h2>What&apos;s happening next</h2><p>RSVP, show up, and bring a friend.</p>';
      } else {
        homeHead.innerHTML = '<span class="eyebrow">Upcoming</span><h2>What&apos;s happening next</h2><p>New events will land here soon. Suggest one while you wait.</p>';
      }
      setHidden(homeHead, false);
    }

    if (homeRegular) {
      const homeCards = upcoming.slice(1, 4).map(eventCard).join('');
      homeRegular.innerHTML = homeCards;
      setHidden(homeRegular, !homeCards);
      homeRegular.classList.toggle('event-grid', Boolean(homeCards));
      homeRegular.classList.toggle('home-events', true);
    }

    if (eventsGrid) {
      const pastBlock = past.length
        ? `<div class="event-past-head" style="grid-column:1/-1"><span class="eyebrow">Past</span><h2>Recently finished</h2></div>${past.map(eventCard).join('')}`
        : '';
      eventsGrid.innerHTML = regular.map(eventCard).join('')
        + pastBlock
        || (featured ? pastBlock : '<p class="admin-empty" style="grid-column:1/-1">No upcoming events yet. Suggest one!</p>');
    }

    startCountdown(featured);
    enhanceEventCopy();
    document.dispatchEvent(new CustomEvent('ssa:events-rendered'));
  }

  function enhanceEventCopy() {
    const apply = () => {
      document.querySelectorAll('.event-copy-stack').forEach((stack) => {
        const copy = stack.querySelector('.event-card-copy');
        const button = stack.querySelector(':scope > .event-read-more');
        if (!copy || !button || copy.dataset.readMoreBound === '1') return;
        const overflows = copy.scrollHeight > copy.clientHeight + 1;
        button.hidden = !overflows;
        if (!overflows) return;
        copy.dataset.readMoreBound = '1';
        button.textContent = 'Read more';
        button.onclick = () => {
          const expanded = copy.classList.toggle('is-expanded');
          copy.classList.toggle('is-clamped', !expanded);
          button.textContent = expanded ? 'Show less' : 'Read more';
        };
      });
    };
    apply();
    requestAnimationFrame(apply);
  }

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image'));
      img.src = src;
    });
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function wrapLines(ctx, text, maxWidth, maxLines) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    words.forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth) {
        line = next;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    });
    if (line) lines.push(line);
    if (lines.length > maxLines) {
      const clipped = lines.slice(0, maxLines);
      let last = clipped[maxLines - 1];
      while (last.length && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      clipped[maxLines - 1] = `${last}…`;
      return clipped;
    }
    return lines;
  }

  function drawCover(ctx, img, x, y, w, h) {
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  async function downloadEventGraphic(event) {
    const W = 1080;
    const H = 1350;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const paper = cssVar('--paper', '#f6f8fb');
    const ink = cssVar('--ink', '#16181d');
    const muted = cssVar('--muted', '#6b7280');
    const accent = cssVar('--accent', '#3d6d8c');
    const blue = cssVar('--blue', '#9ec9e3');
    const surface = cssVar('--surface', '#ffffff');
    try { await document.fonts.ready; } catch (_) {}

    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = blue;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(980, -40, 280, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-80, 1280, 260, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    let logo = null;
    try { logo = await loadImage('/assets/brand/ssa-logo.png'); } catch (_) {}
    if (logo) ctx.drawImage(logo, 72, 64, 86, 86);
    ctx.fillStyle = ink;
    ctx.font = '800 28px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('SSA', logo ? 176 : 72, 98);
    ctx.fillStyle = muted;
    ctx.font = '700 18px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.letterSpacing = '0.16em';
    ctx.fillText('UNIVERSITY OF MINNESOTA', logo ? 176 : 72, 128);
    ctx.letterSpacing = '0';

    const mediaX = 72;
    const mediaY = 180;
    const mediaW = W - 144;
    const mediaH = 560;
    roundRectPath(ctx, mediaX, mediaY, mediaW, mediaH, 36);
    ctx.save();
    ctx.clip();
    let poster = null;
    if (event.imageUrl) {
      try { poster = await loadImage(event.imageUrl); } catch (_) { poster = null; }
    }
    if (poster) {
      drawCover(ctx, poster, mediaX, mediaY, mediaW, mediaH);
    } else {
      ctx.fillStyle = surface;
      ctx.fillRect(mediaX, mediaY, mediaW, mediaH);
      if (logo) ctx.drawImage(logo, mediaX + mediaW / 2 - 90, mediaY + mediaH / 2 - 90, 180, 180);
    }
    ctx.restore();
    ctx.strokeStyle = cssVar('--line', '#e4e7ee');
    ctx.lineWidth = 4;
    roundRectPath(ctx, mediaX, mediaY, mediaW, mediaH, 36);
    ctx.stroke();

    let y = mediaY + mediaH + 56;
    ctx.fillStyle = accent;
    ctx.font = '800 20px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('SSA EVENT', 72, y);
    y += 58;
    ctx.fillStyle = ink;
    ctx.font = '800 58px "Plus Jakarta Sans", system-ui, sans-serif';
    wrapLines(ctx, event.title || 'SSA Event', mediaW, 3).forEach((line) => {
      ctx.fillText(line, 72, y);
      y += 64;
    });
    y += 8;
    ctx.fillStyle = accent;
    ctx.font = '750 28px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(eventWhen(event), 72, y);
    y += 40;
    if (eventWhere(event)) {
      ctx.fillStyle = ink;
      ctx.font = '700 26px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(eventWhere(event), 72, y);
      y += 40;
    }
    if (event.description) {
      y += 8;
      ctx.fillStyle = muted;
      ctx.font = '600 24px "Plus Jakarta Sans", system-ui, sans-serif';
      wrapLines(ctx, event.description, mediaW, 3).forEach((line) => {
        ctx.fillText(line, 72, y);
        y += 34;
      });
    }

    const pillText = attendingLabel(event);
    ctx.font = '800 22px "Plus Jakarta Sans", system-ui, sans-serif';
    const pillW = Math.min(mediaW, ctx.measureText(pillText).width + 48);
    const pillY = H - 148;
    roundRectPath(ctx, 72, pillY, pillW, 56, 28);
    ctx.fillStyle = cssVar('--ink', '#16181d');
    ctx.fill();
    ctx.fillStyle = cssVar('--paper', '#ffffff');
    ctx.fillText(pillText, 96, pillY + 37);

    ctx.fillStyle = muted;
    ctx.font = '700 20px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('@ssa.umn', W - 72 - ctx.measureText('@ssa.umn').width, H - 64);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      const slug = String(event.title || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event';
      link.href = URL.createObjectURL(blob);
      link.download = `ssa-${slug}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1500);
    }, 'image/png');
  }

  function ensureEventDetail() {
    let modal = document.getElementById('eventDetailModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'modal-backdrop event-detail-modal';
    modal.id = 'eventDetailModal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="event-detail-sheet modal-sheet modal-card" role="dialog" aria-modal="true" aria-labelledby="eventDetailTitle">
        <div class="event-detail-art" id="eventDetailArt" hidden></div>
        <span class="eyebrow">SSA Event</span>
        <h2 id="eventDetailTitle"></h2>
        <p class="event-detail-when" id="eventDetailWhen"></p>
        <p class="event-detail-where" id="eventDetailWhere" hidden></p>
        <p class="event-going"><span class="event-going-num" id="eventDetailCount">—</span> coming</p>
        <p class="event-detail-copy" id="eventDetailCopy"></p>
        <div class="event-detail-actions" id="eventDetailActions"></div>
      </div>
      <button class="modal-exit" type="button" aria-label="Close"><svg viewBox="0 0 44 44" aria-hidden="true"><path class="modal-exit-path" d="M22 6 C33 5 38 15 38 22 C38 33 29 38 22 38 C11 38 6 29 6 22 C6 11 14 6 22 6 Z"/><path class="modal-exit-x" d="M16.5 16.5 L27.5 27.5 M27.5 16.5 L16.5 27.5"/></svg></button>`;
    document.body.appendChild(modal);

    function close() {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
    }
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    });
    modal.querySelector('.modal-exit')?.addEventListener('click', close);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.classList.contains('open')) close();
    });
    modal._close = close;
    return modal;
  }

  function openEventDetail(key) {
    const event = findEvent(key);
    if (!event) return;
    const modal = ensureEventDetail();
    const art = modal.querySelector('#eventDetailArt');
    const where = modal.querySelector('#eventDetailWhere');
    const actions = modal.querySelector('#eventDetailActions');
    modal.querySelector('#eventDetailTitle').textContent = event.title || 'SSA Event';
    modal.querySelector('#eventDetailWhen').textContent = eventWhen(event);
    if (eventWhere(event)) {
      where.hidden = false;
      where.textContent = eventWhere(event);
    } else {
      where.hidden = true;
    }
    modal.querySelector('#eventDetailCopy').textContent = event.description || '';
    const countEl = modal.querySelector('#eventDetailCount');
    const liveCount = document.querySelector(`[data-event-count="${CSS.escape(event.rsvpKey || '')}"]`);
    countEl.textContent = liveCount?.textContent || '—';
    countEl.dataset.eventCount = event.rsvpKey || '';
    if (event.imageUrl) {
      art.hidden = false;
      art.innerHTML = `<button type="button" class="event-poster-zoom" data-event-poster="${esc(event.imageUrl)}" data-event-caption="${esc(event.title)}" aria-label="View poster larger"><img src="${esc(event.imageUrl)}" alt="${esc(event.title)} poster" /></button>`;
    } else {
      art.hidden = true;
      art.innerHTML = '';
    }
    const past = isPast(event);
    const rsvpLabel = event.attendanceMode === 'quick' ? 'RSVP' : 'Reserve Your Spot';
    const rsvp = past
      ? `<button class="button button-line feedback-button" type="button" data-event="${esc(event.rsvpKey)}" data-event-title="${esc(event.title)}">How was it?</button>`
      : `<button class="button button-dark handdrawn rsvp-button" type="button" data-event="${esc(event.rsvpKey)}" data-date="${esc(displayDate(event))}" data-attendance-mode="${esc(event.attendanceMode || 'rsvp')}" data-default-label="${rsvpLabel}"><span class="rsvp-btn-label">${rsvpLabel}</span></button>${calendarButton(event, { featured: true })}`;
    actions.innerHTML = `${rsvp}<button class="button button-line event-detail-download" type="button">Download Event Card</button>`;
    actions.querySelector('.event-detail-download')?.addEventListener('click', () => downloadEventGraphic(event));
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    document.dispatchEvent(new CustomEvent('ssa:events-rendered'));
  }

  function ensurePosterLightbox() {
    if (document.getElementById('eventPosterLightbox')) return document.getElementById('eventPosterLightbox');
    const lightbox = document.createElement('div');
    lightbox.className = 'gallery-lightbox';
    lightbox.id = 'eventPosterLightbox';
    lightbox.setAttribute('aria-hidden', 'true');
    lightbox.innerHTML = `
      <div class="gallery-lightbox-bg" data-close aria-label="Close poster"></div>
      <div class="gallery-lightbox-panel" role="dialog" aria-modal="true" aria-labelledby="eventPosterCaption">
        <button type="button" class="gallery-lightbox-close" aria-label="Close" data-close>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8"/></svg>
        </button>
        <div class="gallery-lightbox-card" tabindex="0" aria-label="Event poster viewer">
          <div class="gallery-lightbox-viewport" id="eventPosterViewport">
            <img id="eventPosterImg" alt="" />
          </div>
          <figcaption id="eventPosterCaption" class="gallery-lightbox-caption"></figcaption>
        </div>
      </div>`;
    document.body.appendChild(lightbox);

    const img = lightbox.querySelector('#eventPosterImg');
    const caption = lightbox.querySelector('#eventPosterCaption');
    const viewport = lightbox.querySelector('#eventPosterViewport');
    const mobileMq = window.matchMedia('(max-width: 720px)');
    let zoomed = false;

    function setZoom(on) {
      if (mobileMq.matches) {
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

    function close() {
      lightbox.classList.remove('open');
      lightbox.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('gallery-lightbox-open');
      setZoom(false);
    }

    lightbox.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) close();
    });
    img.addEventListener('click', (event) => {
      event.stopPropagation();
      if (mobileMq.matches) return;
      setZoom(!zoomed);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && lightbox.classList.contains('open')) close();
    });

    lightbox._openPoster = (src, title) => {
      img.src = src;
      img.alt = title || 'Event poster';
      caption.textContent = title || '';
      setZoom(false);
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.classList.add('gallery-lightbox-open');
    };
    return lightbox;
  }

  document.addEventListener('click', (event) => {
    const poster = event.target.closest('#eventDetailModal [data-event-poster]');
    if (poster) {
      event.preventDefault();
      const lightbox = ensurePosterLightbox();
      lightbox._openPoster(poster.dataset.eventPoster, poster.dataset.eventCaption || '');
      return;
    }
    if (event.target.closest('.rsvp-button, .calendar-button, .feedback-button, .event-read-more, .event-detail-download, a, button, input, label')) return;
    const card = event.target.closest('.event-card[data-event-key], .featured-event[data-event-key]');
    if (!card) return;
    event.preventDefault();
    openEventDetail(card.dataset.eventKey);
  });

  function startCountdown(featured) {
    if (countdownTimer) {
      window.clearInterval(countdownTimer);
      countdownTimer = null;
    }
    const countdown = document.getElementById('cmsFeaturedCountdown');
    if (!countdown || !featured?.startsAt) return;
    const start = new Date(featured.startsAt).getTime();
    const update = () => {
      const remaining = start - Date.now();
      if (remaining <= 0) {
        paint(sourceEvents);
        return;
      }
      const values = {
        days: Math.floor(remaining / 86400000),
        hours: Math.floor((remaining / 3600000) % 24),
        mins: Math.floor((remaining / 60000) % 60),
        secs: Math.floor((remaining / 1000) % 60)
      };
      Object.entries(values).forEach(([key, value]) => {
        const element = countdown.querySelector(`[data-fc="${key}"]`);
        if (element) element.textContent = String(value).padStart(2, '0');
      });
    };
    update();
    countdownTimer = window.setInterval(update, 1000);
  }

  api('/api/events').then((data) => {
    sourceEvents = data.events || [];
    paint(sourceEvents);
  }).catch(() => {
    clearPlaceholders();
    document.dispatchEvent(new CustomEvent('ssa:events-rendered'));
  });
})();
