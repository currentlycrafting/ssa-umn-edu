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

  function displayDate(event) {
    const time = displayTime(event.startTime);
    return time ? `${event.dateLabel} · ${time}` : event.dateLabel;
  }

  function setHidden(element, hidden) {
    if (!element) return;
    element.hidden = hidden;
  }

  function featuredMarkup(event, includeCountdown) {
    const image = event.imageUrl || '';
    const art = image
      ? `<div class="featured-event-art"><img src="${esc(image)}" alt="" /></div>`
      : '';
    return `
      ${art}
      <div class="featured-event-body">
        <span class="eyebrow">Featured Event</span>
        <h3>${esc(event.title)}</h3>
        <p class="featured-location">${esc(displayDate(event))}</p>
        <p class="featured-copy">${esc(event.description)}</p>
        ${includeCountdown && event.showCountdown && event.startsAt ? `<div class="featured-countdown" id="cmsFeaturedCountdown" data-start="${esc(event.startsAt)}" aria-label="Countdown"><div class="fc-cell"><b data-fc="days">—</b><span>days</span></div><div class="fc-cell"><b data-fc="hours">—</b><span>hrs</span></div><div class="fc-cell"><b data-fc="mins">—</b><span>min</span></div><div class="fc-cell"><b data-fc="secs">—</b><span>sec</span></div></div>` : ''}
        <p class="event-going"><span class="event-going-num" data-event-count="${esc(event.rsvpKey)}">—</span> coming</p>
        <button class="button button-dark handdrawn rsvp-button" type="button" data-event="${esc(event.rsvpKey)}" data-date="${esc(displayDate(event))}" data-attendance-mode="${esc(event.attendanceMode || 'rsvp')}" data-default-label="${event.attendanceMode === 'quick' ? 'Are you coming?' : 'Reserve Your Spot'}"><span class="rsvp-btn-label">${event.attendanceMode === 'quick' ? 'Are you coming?' : 'Reserve Your Spot'}</span></button>
      </div>`;
  }

  function homeCard(event) {
    return `<article class="event-promo">
      <div class="event-promo-stat"><strong data-event-count="${esc(event.rsvpKey)}">—</strong><span>people coming</span></div>
      <div class="event-promo-copy">
        <span class="eyebrow handwritten">${esc(event.shortDate)}</span>
        <h3>${esc(event.title)}</h3>
        <p>${esc(event.description)}</p>
        <div class="event-promo-actions"><button class="button button-dark rsvp-button" type="button" data-event="${esc(event.rsvpKey)}" data-date="${esc(displayDate(event))}" data-attendance-mode="${esc(event.attendanceMode || 'rsvp')}" data-default-label="${event.attendanceMode === 'quick' ? 'Are you coming?' : 'RSVP'}"><span class="rsvp-btn-label">${event.attendanceMode === 'quick' ? 'Are you coming?' : 'RSVP'}</span></button><span>Going · <b data-event-count="${esc(event.rsvpKey)}">—</b> people</span></div>
      </div>
    </article>`;
  }

  function eventCard(event) {
    return `<article class="event-card"><span class="event-date">${esc(event.shortDate)}${event.startTime ? ` · ${esc(displayTime(event.startTime))}` : ''}</span><h3>${esc(event.title)}</h3><p>${esc(event.description)}</p><button class="micro-button rsvp-button" type="button" data-event="${esc(event.rsvpKey)}" data-date="${esc(displayDate(event))}" data-attendance-mode="${esc(event.attendanceMode || 'rsvp')}" data-default-label="${event.attendanceMode === 'quick' ? 'Are you coming?' : 'RSVP'}"><span class="rsvp-btn-label">${event.attendanceMode === 'quick' ? 'Are you coming?' : 'RSVP'}</span></button></article>`;
  }

  function startCountdown() {
    const countdown = document.getElementById('cmsFeaturedCountdown');
    if (!countdown) return;
    const start = new Date(countdown.dataset.start).getTime();
    const update = () => {
      const remaining = Math.max(0, start - Date.now());
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
    window.setInterval(update, 1000);
  }

  function renderFeatured(target, event) {
    if (!target) return;
    if (!event) {
      target.innerHTML = '';
      setHidden(target, true);
      return;
    }
    target.innerHTML = featuredMarkup(event, true);
    target.classList.toggle('featured-event--no-art', !event.imageUrl);
    setHidden(target, false);
  }

  function clearPlaceholders() {
    const homeFeatured = document.getElementById('featuredEvent');
    const homeSection = document.getElementById('events');
    const homeHead = document.getElementById('featuredSectionHead');
    const homeRegular = document.getElementById('homeEvents');
    const eventsFeatured = document.getElementById('eventsFeatured');
    const eventsGrid = document.getElementById('eventsGrid');
    renderFeatured(homeFeatured, null);
    renderFeatured(eventsFeatured, null);
    setHidden(homeSection, true);
    setHidden(homeHead, true);
    if (homeRegular) {
      homeRegular.innerHTML = '';
      setHidden(homeRegular, true);
    }
    if (eventsGrid) eventsGrid.innerHTML = '';
  }

  api('/api/events').then((data) => {
    const events = data.events || [];
    const featured = events.find((event) => event.featured);
    const regular = events.filter((event) => !event.featured);
    const homeFeatured = document.getElementById('featuredEvent');
    const homeSection = document.getElementById('events');
    const homeHead = document.getElementById('featuredSectionHead');
    const homeRegular = document.getElementById('homeEvents');
    const eventsFeatured = document.getElementById('eventsFeatured');
    const eventsGrid = document.getElementById('eventsGrid');

    renderFeatured(homeFeatured, featured || null);
    renderFeatured(eventsFeatured, featured || null);

    if (homeHead) {
      if (featured) {
        homeHead.innerHTML = '<span class="eyebrow">Featured</span><h2>Don&apos;t miss this one</h2>';
        setHidden(homeHead, false);
      } else if (regular.length) {
        homeHead.innerHTML = '<span class="eyebrow">Calendar</span><h2>Upcoming events</h2>';
        setHidden(homeHead, false);
      } else {
        setHidden(homeHead, true);
      }
    }

    if (homeRegular) {
      homeRegular.innerHTML = regular.map(homeCard).join('');
      setHidden(homeRegular, !regular.length);
    }

    if (homeSection) {
      setHidden(homeSection, !(featured || regular.length));
    }

    if (eventsGrid) {
      eventsGrid.innerHTML = regular.map(eventCard).join('');
    }

    startCountdown();
    document.dispatchEvent(new CustomEvent('ssa:events-rendered'));
  }).catch(() => {
    clearPlaceholders();
    document.dispatchEvent(new CustomEvent('ssa:events-rendered'));
  });
})();
