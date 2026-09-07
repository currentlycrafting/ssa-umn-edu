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

  function setHidden(element, hidden) {
    if (!element) return;
    element.hidden = hidden;
  }

  function upcomingEvents(events) {
    const now = Date.now();
    return (events || [])
      .filter((event) => event.startsAt && new Date(event.startsAt).getTime() > now)
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
      .map((event, index) => ({ ...event, featured: index === 0, showCountdown: true }));
  }

  function featuredMarkup(event) {
    const image = event.imageUrl || '';
    const art = image
      ? `<div class="featured-event-art"><img src="${esc(image)}" alt="" /></div>`
      : '';
    return `
      <span class="home-event-ribbon" aria-hidden="true">Next up</span>
      ${art}
      <div class="featured-event-body">
        <span class="eyebrow">Featured Event</span>
        <h3>${esc(event.title)}</h3>
        <p class="featured-location">${esc(displayDate(event))}</p>
        <p class="featured-copy">${esc(event.description)}</p>
        ${event.startsAt ? `<div class="featured-countdown" id="cmsFeaturedCountdown" data-start="${esc(event.startsAt)}" aria-label="Countdown"><div class="fc-cell"><b data-fc="days">—</b><span>days</span></div><div class="fc-cell"><b data-fc="hours">—</b><span>hrs</span></div><div class="fc-cell"><b data-fc="mins">—</b><span>min</span></div><div class="fc-cell"><b data-fc="secs">—</b><span>sec</span></div></div>` : ''}
        <p class="event-going"><span class="event-going-num" data-event-count="${esc(event.rsvpKey)}">—</span> coming</p>
        <button class="button button-dark handdrawn rsvp-button" type="button" data-event="${esc(event.rsvpKey)}" data-date="${esc(displayDate(event))}" data-attendance-mode="${esc(event.attendanceMode || 'rsvp')}" data-default-label="${event.attendanceMode === 'quick' ? 'Are you coming?' : 'Reserve Your Spot'}"><span class="rsvp-btn-label">${event.attendanceMode === 'quick' ? 'Are you coming?' : 'Reserve Your Spot'}</span></button>
      </div>`;
  }

  function eventCard(event) {
    const short = displayShort(event);
    const time = event.startsAt
      ? new Date(event.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : displayTime(event.startTime);
    return `<article class="event-card"><span class="event-date">${esc(short)}${time ? ` · ${esc(time)}` : ''}</span><h3>${esc(event.title)}</h3><p>${esc(event.description)}</p><button class="micro-button rsvp-button" type="button" data-event="${esc(event.rsvpKey)}" data-date="${esc(displayDate(event))}" data-attendance-mode="${esc(event.attendanceMode || 'rsvp')}" data-default-label="${event.attendanceMode === 'quick' ? 'Are you coming?' : 'RSVP'}"><span class="rsvp-btn-label">${event.attendanceMode === 'quick' ? 'Are you coming?' : 'RSVP'}</span></button></article>`;
  }

  let countdownTimer = null;
  let sourceEvents = [];

  function renderFeatured(target, event) {
    if (!target) return;
    if (!event) {
      target.innerHTML = '';
      setHidden(target, true);
      return;
    }
    target.innerHTML = featuredMarkup(event);
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
      setHidden(homeFeatured, false);
    }
    if (homeRegular) {
      homeRegular.innerHTML = '';
      setHidden(homeRegular, true);
    }
    if (eventsGrid) eventsGrid.innerHTML = '';
  }

  function paint(events) {
    const upcoming = upcomingEvents(events);
    const featured = upcoming[0] || null;
    const regular = upcoming.slice(1);
    const homeFeatured = document.getElementById('featuredEvent');
    const homeHead = document.getElementById('featuredSectionHead');
    const homeRegular = document.getElementById('homeEvents');
    const eventsFeatured = document.getElementById('eventsFeatured');
    const eventsGrid = document.getElementById('eventsGrid');
    const condensedHome = Boolean(document.querySelector('.home-upcoming'));

    if (featured) {
      renderFeatured(homeFeatured, featured);
    } else if (condensedHome && homeFeatured) {
      homeFeatured.innerHTML = `
        <div class="featured-event-body home-upcoming-empty-event">
          <span class="eyebrow">Featured Event</span>
          <h3>No upcoming event yet</h3>
          <p class="featured-copy">New events will land here soon. Suggest one while you wait.</p>
          <a class="button button-dark handdrawn" href="/suggest">Suggest an Event</a>
        </div>`;
      homeFeatured.classList.add('featured-event--no-art');
      setHidden(homeFeatured, false);
    } else {
      renderFeatured(homeFeatured, null);
    }
    renderFeatured(eventsFeatured, featured);

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
      eventsGrid.innerHTML = regular.map(eventCard).join('')
        || (featured ? '' : '<p class="admin-empty" style="grid-column:1/-1">No upcoming events yet. Suggest one!</p>');
    }

    startCountdown(featured);
    document.dispatchEvent(new CustomEvent('ssa:events-rendered'));
  }

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
