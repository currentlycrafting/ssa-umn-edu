(function () {
  const api = window.ssaFetch?.json;
  if (!api) return;

  const gate = document.getElementById('adminGate');
  const gateForm = document.getElementById('adminGateForm');
  const workspace = document.getElementById('adminWorkspace');
  const content = document.getElementById('adminContent');
  const title = document.getElementById('adminSectionTitle');
  let password = sessionStorage.getItem('ssaAdminPassword') || '';
  let section = 'overview';
  let data = { admin: {}, events: [], gallery: [], editions: [], timeline: [] };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function fmt(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  }

  async function post(url, body = {}) {
    return api(url, { method: 'POST', body: { password, ...body }, timeout: 30000 });
  }

  async function loadAll() {
    const admin = await post('/api/admin');
    gate.hidden = true;
    workspace.hidden = false;
    data.admin = admin;
    render();
    const [eventsResult, galleryResult, editionsResult, timelineResult] = await Promise.allSettled([
      post('/api/events/list-all'),
      post('/api/gallery/list-all'),
      post('/api/newsletters/list-all'),
      post('/api/timeline/list-all')
    ]);
    if (eventsResult.status === 'fulfilled') data.events = eventsResult.value.events || [];
    if (galleryResult.status === 'fulfilled') data.gallery = galleryResult.value.items || [];
    if (editionsResult.status === 'fulfilled') data.editions = editionsResult.value.newsletters || [];
    if (timelineResult.status === 'fulfilled') data.timeline = timelineResult.value.events || [];
    render();
  }

  function stat(label, value, note) {
    return `<article class="admin-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`;
  }

  function inboxCount() {
    const admin = data.admin;
    return (admin.messages || []).length
      + (admin.connect || []).length
      + (admin.event_suggestions || []).length;
  }

  function renderOverview() {
    const admin = data.admin;
    content.innerHTML = `
      <div class="admin-stat-grid">
        ${stat('Published events', data.events.filter((event) => event.published).length, 'Public calendar')}
        ${stat('Gallery photos', data.gallery.length, 'Community album')}
        ${stat('RSVPs', (admin.rsvp || []).length, 'Across all events')}
        ${stat('Subscribers', (admin.newsletters || []).length, 'Newsletter audience')}
        ${stat('Messages', inboxCount(), 'Community, contact, and ideas')}
      </div>
      <div class="admin-quick-grid">
        <button data-go="events"><strong>Create an event</strong><span>Add the next event to the calendar.</span></button>
        <button data-go="gallery"><strong>Manage gallery</strong><span>Add or remove community photos.</span></button>
        <button data-go="timeline"><strong>Timeline cards</strong><span>Add sticky-note moments to the timeline.</span></button>
        <a href="/newsletter/studio"><strong>Newsletter Studio</strong><span>Publish the next edition.</span></a>
        <button data-go="messages"><strong>Open messages</strong><span>Review community inbox.</span></button>
      </div>`;
  }

  function toDatetimeLocal(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function fromDatetimeLocal(value) {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }

  function eventStatus(event) {
    if (!event.startsAt) return 'Needs date';
    const start = new Date(event.startsAt).getTime();
    if (Number.isNaN(start)) return 'Needs date';
    if (start <= Date.now()) return 'Past';
    if (event.featured) return 'Next · Featured';
    return 'Upcoming';
  }

  function eventForm(event = {}) {
    const previewImage = event.imageUrl || '';
    const startsAt = toDatetimeLocal(event.startsAt);
    const hasImage = Boolean(previewImage);
    return `<form class="admin-editor" id="adminEventForm">
      <input type="hidden" name="id" value="${esc(event.id || '')}" />
      <input type="hidden" name="rsvpKey" value="${esc(event.rsvpKey || '')}" />
      <input type="hidden" name="sortOrder" value="${esc(event.sortOrder ?? data.events.length * 10)}" />
      <input type="hidden" name="imageUrl" value="${esc(event.imageUrl || '')}" />
      <div class="admin-editor-head"><div><span class="eyebrow">${event.id ? 'Edit event' : 'New event'}</span><h3>${event.id ? esc(event.title) : 'Add to the calendar'}</h3></div>${event.id ? '<button type="button" class="button button-line" data-new-event>New event</button>' : ''}</div>
      <div class="admin-form-grid admin-form-grid-simple">
        <label>Title<input name="title" value="${esc(event.title || '')}" required /></label>
        <label>Date &amp; start time<input type="datetime-local" name="startsAt" value="${esc(startsAt)}" required /></label>
      </div>
      <label class="admin-field-label">Event image</label>
      <label class="gallery-drop admin-event-drop ${hasImage ? 'has-preview' : ''}" id="adminEventDrop">
        <input type="file" name="image" accept="image/png,image/jpeg,image/webp" />
        <span class="admin-event-drop-prompt">
          <svg class="admin-upload-icon" viewBox="0 0 48 48" aria-hidden="true">
            <path d="M24 6v24M16 14l8-8 8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 30v8a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4v-8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
          </svg>
          <strong>Drop an image here</strong>
          <small>or click to browse · PNG, JPG, or WEBP</small>
        </span>
        <img class="admin-event-drop-preview" id="adminEventDropPreview" src="${esc(previewImage)}" alt="" ${hasImage ? '' : 'hidden'} />
      </label>
      <label>Description<textarea name="description" rows="4" required>${esc(event.description || '')}</textarea></label>
      <fieldset class="admin-feature-choice"><legend>How should guests respond?</legend><div><label><input type="radio" name="attendanceMode" value="rsvp" ${event.attendanceMode === 'quick' ? '' : 'checked'} /><span>Full RSVP form</span></label><label><input type="radio" name="attendanceMode" value="quick" ${event.attendanceMode === 'quick' ? 'checked' : ''} /><span>Quick Yes / No</span></label></div><small>The next upcoming event is featured automatically with a countdown.</small></fieldset>
      <div class="admin-event-preview" id="adminEventPreview" data-image="${esc(previewImage)}"></div>
      <div class="admin-editor-actions"><button class="button button-dark" type="submit">${event.id ? 'Save changes' : 'Publish event'}</button><output></output></div>
    </form>`;
  }

  function renderEvents(editId) {
    const editing = data.events.find((event) => event.id === Number(editId));
    content.innerHTML = eventForm(editing) + `<div class="admin-list-head"><h3>Calendar</h3><span>${data.events.length} events</span></div><div class="admin-event-list">${data.events.map((event) => `
      <article class="admin-event-item ${event.published ? '' : 'is-draft'}">
        <div class="admin-event-date">${esc(event.shortDate || '—')}</div>
        <div><span class="eyebrow">${esc(eventStatus(event))}</span><h3>${esc(event.title)}</h3><p>${esc(event.dateLabel || fmt(event.startsAt))}</p></div>
        <div class="admin-item-actions"><button class="button button-line" data-edit-event="${event.id}">Edit</button><button class="button button-line" data-delete-event="${event.id}">Remove</button></div>
      </article>`).join('') || '<p class="admin-empty">No events yet.</p>'}</div>`;
    bindEventForm();
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function bindEventForm() {
    const form = document.getElementById('adminEventForm');
    const preview = document.getElementById('adminEventPreview');
    const drop = document.getElementById('adminEventDrop');
    const dropPreview = document.getElementById('adminEventDropPreview');
    let previewImage = preview?.dataset.image || '';
    let selectedFile = null;

    async function applyImageFile(file) {
      if (!file || !/^image\/(png|jpeg|webp)$/i.test(file.type)) return;
      selectedFile = file;
      previewImage = await readFile(file);
      if (dropPreview) {
        dropPreview.src = previewImage;
        dropPreview.hidden = false;
      }
      drop?.classList.add('has-preview');
      updatePreview();
    }

    function updatePreview() {
      if (!preview) return;
      const responseLabel = form.attendanceMode.value === 'quick' ? 'Are you coming? · Yes / No' : 'Full RSVP form';
      const eventTitle = form.title.value.trim() || 'Event title';
      const startsAt = form.startsAt.value;
      const when = startsAt
        ? new Date(startsAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
        : 'Date & start time';
      const description = form.description.value.trim() || 'Your event description will appear here.';
      const art = previewImage
        ? `<div class="featured-event-art"><img src="${esc(previewImage)}" alt="" /></div>`
        : '';
      preview.innerHTML = `<span class="admin-preview-label">Preview · ${esc(responseLabel)} · Countdown on</span><article class="featured-event${!previewImage ? ' featured-event--no-art' : ''}">${art}<div class="featured-event-body"><span class="eyebrow">Featured Event</span><h3>${esc(eventTitle)}</h3><p class="featured-location">${esc(when)}</p><p class="featured-copy">${esc(description)}</p><div class="featured-countdown" aria-label="Countdown preview"><div class="fc-cell"><b>00</b><span>days</span></div><div class="fc-cell"><b>00</b><span>hrs</span></div><div class="fc-cell"><b>00</b><span>min</span></div><div class="fc-cell"><b>00</b><span>sec</span></div></div><button class="button button-dark" type="button">${form.attendanceMode.value === 'quick' ? 'Are you coming?' : 'Reserve Your Spot'}</button></div></article>`;
    }

    form?.querySelectorAll('input, textarea').forEach((field) => {
      if (field.type !== 'file') field.addEventListener('input', updatePreview);
      if (field.type === 'radio') field.addEventListener('change', updatePreview);
    });
    form?.image.addEventListener('change', async () => {
      await applyImageFile(form.image.files[0]);
    });
    ['dragenter', 'dragover'].forEach((type) => {
      drop?.addEventListener(type, (event) => {
        event.preventDefault();
        drop.classList.add('dragging');
      });
    });
    ['dragleave', 'drop'].forEach((type) => {
      drop?.addEventListener(type, (event) => {
        event.preventDefault();
        drop.classList.remove('dragging');
      });
    });
    drop?.addEventListener('drop', async (event) => {
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      const transfer = new DataTransfer();
      transfer.items.add(file);
      form.image.files = transfer.files;
      await applyImageFile(file);
    });
    updatePreview();
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const output = form.querySelector('output');
      button.disabled = true;
      output.textContent = 'Saving…';
      try {
        let imageUrl = form.imageUrl.value;
        const file = selectedFile || form.image.files[0];
        if (file) {
          const upload = await post('/api/uploads', { filename: file.name, data: await readFile(file) });
          imageUrl = upload.url;
        }
        const startsAt = fromDatetimeLocal(form.startsAt.value);
        if (!startsAt) throw new Error('Set a date and start time.');
        await post('/api/events', {
          id: form.id.value || undefined,
          rsvpKey: form.rsvpKey.value.trim(),
          title: form.title.value.trim(),
          startsAt,
          sortOrder: Number(form.sortOrder.value || 0),
          description: form.description.value.trim(),
          imageUrl,
          attendanceMode: form.attendanceMode.value,
          published: true
        });
        await loadAll();
        section = 'events';
        renderEvents();
      } catch (error) {
        output.textContent = error.message || 'Could not save event.';
      } finally {
        button.disabled = false;
      }
    });
  }

  function renderGallery() {
    content.innerHTML = `
      <form class="admin-editor admin-gallery-add" id="adminGalleryForm">
        <div class="admin-editor-head"><div><span class="eyebrow">New photo</span><h3>Add to the public gallery</h3></div></div>
        <label class="gallery-drop admin-gallery-drop" id="adminGalleryDrop">
          <input type="file" name="photo" accept="image/png,image/jpeg,image/webp" required />
          <span class="admin-gallery-prompt"><strong>Choose a photo</strong><small>PNG, JPG, or WEBP · 5 MB max</small></span>
          <figure class="admin-gallery-live-polaroid"><img id="adminGalleryPreviewImage" alt="" /><figcaption id="adminGalleryPreviewCaption">Your caption</figcaption></figure>
        </label>
        <input name="caption" id="adminGalleryCaption" placeholder="Short caption" maxlength="300" required />
        <div class="admin-editor-actions"><button class="button button-dark" type="submit">Add photo</button><output></output></div>
      </form>
      <div class="admin-list-head"><h3>Database photos</h3><span>${data.gallery.length} photos</span></div>
      <div class="admin-gallery-grid">${data.gallery.map((item) => `
        <article class="admin-gallery-item"><img src="${esc(item.src)}" alt="${esc(item.alt || item.caption)}" /><div><strong>${esc(item.caption)}</strong><small>${fmt(item.created_at)}</small><button class="button button-line" data-delete-photo="${item.id}">Remove</button></div></article>`).join('') || '<p class="admin-empty">No uploaded photos yet.</p>'}</div>`;
    const galleryForm = document.getElementById('adminGalleryForm');
    const galleryDrop = document.getElementById('adminGalleryDrop');
    const galleryPreviewImage = document.getElementById('adminGalleryPreviewImage');
    const galleryPreviewCaption = document.getElementById('adminGalleryPreviewCaption');
    galleryForm?.photo.addEventListener('change', async () => {
      const file = galleryForm.photo.files[0];
      if (!file) return;
      galleryPreviewImage.src = await readFile(file);
      galleryDrop.classList.add('has-preview');
    });
    galleryForm?.caption.addEventListener('input', () => {
      galleryPreviewCaption.textContent = galleryForm.caption.value || 'Your caption';
    });
    galleryForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const file = form.photo.files[0];
      const button = form.querySelector('button');
      button.disabled = true;
      try {
        await post('/api/gallery', { filename: file.name, data: await readFile(file), caption: form.caption.value.trim() });
        await loadAll();
        section = 'gallery';
        renderGallery();
      } catch (error) {
        form.querySelector('output').textContent = error.message || 'Could not add photo.';
      } finally {
        button.disabled = false;
      }
    });
  }

  function row(primary, meta, detail, date) {
    return `<article class="admin-data-row"><div><strong>${primary}</strong>${meta ? `<span>${meta}</span>` : ''}${detail ? `<p>${detail}</p>` : ''}</div><div><time>${fmt(date)}</time></div></article>`;
  }

  function renderMessages() {
    const admin = data.admin;
    const items = [
      ...(admin.messages || []).map((item) => ({
        kind: 'Contact',
        primary: item.name,
        meta: item.email,
        detail: item.message,
        date: item.created_at
      })),
      ...(admin.connect || []).map((item) => ({
        kind: 'Community',
        primary: `${item.name} · ${item.reason || 'Connect'}`,
        meta: item.email,
        detail: item.details,
        date: item.created_at
      })),
      ...(admin.event_suggestions || []).map((item) => ({
        kind: 'Event idea',
        primary: `${item.name} · ${item.type || 'Suggestion'}`,
        meta: item.preferred_date || item.audience || '',
        detail: item.description,
        date: item.created_at
      }))
    ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    if (!items.length) {
      content.innerHTML = '<div class="admin-empty"><h3>No messages yet</h3><p>Contact notes, community connects, and event ideas will show up here.</p></div>';
      return;
    }

    content.innerHTML = `<div class="admin-list-head"><h3>Inbox</h3><span>${items.length}</span></div><div class="admin-data-list">${items.map((item) =>
      row(`${esc(item.kind)} · ${esc(item.primary)}`, esc(item.meta), esc(item.detail), item.date)
    ).join('')}</div>`;
  }

  function renderRsvps() {
    const rows = data.admin.rsvp || [];
    if (!rows.length) {
      content.innerHTML = '<div class="admin-empty"><h3>Nothing here yet</h3><p>New RSVPs will appear automatically.</p></div>';
      return;
    }
    content.innerHTML = `<div class="admin-data-list">${rows.map((item) =>
      row(esc(item.name), `${esc(item.event_name)} · ${esc(item.event_date)}`, item.is_student ? 'U of MN student' : 'Community guest · 18+', item.created_at)
    ).join('')}</div>`;
  }

  function renderNewsletter() {
    const subscribers = data.admin.newsletters || [];
    content.innerHTML = `
      <div class="admin-quick-grid">
        <a href="/newsletter/studio"><strong>Open Newsletter Studio</strong><span>Create and publish an edition.</span></a>
        <a href="/newsletter"><strong>Preview newsletter</strong><span>Review the public reader.</span></a>
      </div>
      <div class="admin-list-head"><h3>Editions</h3><span>${data.editions.length}</span></div>
      <div class="admin-data-list">${data.editions.map((edition) =>
        `<article class="admin-data-row"><div><strong>${esc(edition.title)}</strong><span>${edition.published ? 'Published' : 'Draft'}</span></div><div><time>${fmt(edition.createdAt)}</time><button class="button button-line" data-delete-edition="${edition.id}">Delete</button></div></article>`
      ).join('') || '<p class="admin-empty">No editions yet.</p>'}</div>
      <div class="admin-list-head"><h3>Subscribers</h3><span>${subscribers.length}</span></div>
      <div class="admin-data-list">${subscribers.map((item) => row(esc(item.email), '', '', item.created_at)).join('') || '<p class="admin-empty">No subscribers yet.</p>'}</div>`;
  }

  function formatTimelineDateLabel(value) {
    if (!value) return '';
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString([], { month: 'long', day: 'numeric' });
  }

  function timelineForm(event = {}) {
    return `<form class="admin-editor" id="adminTimelineForm">
      <input type="hidden" name="id" value="${esc(event.id || '')}" />
      <div class="admin-editor-head"><div><span class="eyebrow">${event.id ? 'Edit card' : 'New card'}</span><h3>${event.id ? esc(event.title) : 'Add a timeline moment'}</h3></div>${event.id ? '<button type="button" class="button button-line" data-new-timeline>New card</button>' : ''}</div>
      <div class="admin-form-grid admin-form-grid-simple">
        <label>Date<input type="date" name="eventDate" value="${esc(event.eventDate || '')}" required /></label>
        <label>Pill label<input name="pill" value="${esc(event.pill || '')}" placeholder="Board Event" maxlength="48" required /></label>
      </div>
      <label>Title<input name="title" value="${esc(event.title || '')}" required maxlength="160" /></label>
      <label>Held at<input name="heldAt" value="${esc(event.heldAt || '')}" maxlength="160" /></label>
      <label>Description<textarea name="copy" rows="4" required>${esc(event.copy || '')}</textarea></label>
      <label>Link<input name="linkUrl" value="${esc(event.linkUrl || '')}" placeholder="https://" /></label>
      <div class="admin-editor-actions"><button class="button button-dark" type="submit">${event.id ? 'Save changes' : 'Publish card'}</button><output></output></div>
    </form>`;
  }

  function bindTimelineForm() {
    const form = document.getElementById('adminTimelineForm');
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const output = form.querySelector('output');
      button.disabled = true;
      output.textContent = 'Saving…';
      try {
        const eventDate = form.eventDate.value;
        await post('/api/timeline', {
          id: form.id.value || undefined,
          eventDate,
          dateLabel: formatTimelineDateLabel(eventDate),
          pill: form.pill.value.trim(),
          title: form.title.value.trim(),
          heldAt: form.heldAt.value.trim(),
          copy: form.copy.value.trim(),
          linkUrl: form.linkUrl.value.trim(),
          linkLabel: 'View the fun',
          deco: 'none',
          sortOrder: 0,
          published: true
        });
        await loadAll();
        section = 'timeline';
        renderTimeline();
      } catch (error) {
        output.textContent = error.message || 'Could not save timeline card.';
      } finally {
        button.disabled = false;
      }
    });
  }

  function renderTimeline(editId) {
    const editing = data.timeline.find((event) => event.id === Number(editId));
    content.innerHTML = timelineForm(editing) + `<div class="admin-list-head"><h3>Timeline cards</h3><span>${data.timeline.length}</span></div><div class="admin-event-list">${data.timeline.map((event) => `
      <article class="admin-event-item">
        <div class="admin-event-date">${esc(event.dateLabel || '—')}</div>
        <div><span class="eyebrow">${esc(event.pill || 'Moment')}</span><h3>${esc(event.title)}</h3><p>${esc(event.heldAt || event.copy || '')}</p></div>
        <div class="admin-item-actions"><button class="button button-line" data-edit-timeline="${event.id}">Edit</button><button class="button button-line" data-delete-timeline="${event.id}">Remove</button></div>
      </article>`).join('') || '<p class="admin-empty">No timeline cards yet.</p>'}</div>`;
    bindTimelineForm();
  }

  function render() {
    const labels = {
      overview: 'Overview',
      events: 'Events',
      gallery: 'Gallery',
      timeline: 'Timeline',
      rsvp: 'RSVPs',
      messages: 'Messages',
      newsletters: 'Newsletter'
    };
    title.textContent = labels[section] || 'Admin';
    document.querySelectorAll('#adminSections [data-section]').forEach((button) => {
      button.classList.toggle('active', button.dataset.section === section);
    });
    if (section === 'overview') renderOverview();
    else if (section === 'events') renderEvents();
    else if (section === 'gallery') renderGallery();
    else if (section === 'timeline') renderTimeline();
    else if (section === 'newsletters') renderNewsletter();
    else if (section === 'messages') renderMessages();
    else if (section === 'rsvp') renderRsvps();
    else renderOverview();
  }

  gateForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    password = document.getElementById('adminPass').value;
    gateForm.querySelector('output').textContent = 'Opening…';
    try {
      await loadAll();
      sessionStorage.setItem('ssaAdminPassword', password);
    } catch (error) {
      gateForm.querySelector('output').textContent = error.message || 'Could not open admin.';
    }
  });

  document.getElementById('adminSections').addEventListener('click', (event) => {
    const button = event.target.closest('[data-section]');
    if (!button) return;
    section = button.dataset.section;
    render();
  });
  content.addEventListener('click', async (event) => {
    const go = event.target.closest('[data-go]');
    if (go) { section = go.dataset.go; render(); return; }
    const edit = event.target.closest('[data-edit-event]');
    if (edit) { renderEvents(edit.dataset.editEvent); return; }
    if (event.target.closest('[data-new-event]')) { renderEvents(); return; }
    const editTl = event.target.closest('[data-edit-timeline]');
    if (editTl) { renderTimeline(editTl.dataset.editTimeline); return; }
    if (event.target.closest('[data-new-timeline]')) { renderTimeline(); return; }
    const deleteTl = event.target.closest('[data-delete-timeline]');
    if (deleteTl && confirm('Remove this timeline card?')) {
      await post(`/api/timeline/${deleteTl.dataset.deleteTimeline}/delete`);
      await loadAll(); section = 'timeline'; render();
      return;
    }
    const deleteEvent = event.target.closest('[data-delete-event]');
    if (deleteEvent && confirm('Remove this event from the public calendar?')) {
      await post(`/api/events/${deleteEvent.dataset.deleteEvent}/delete`);
      await loadAll(); section = 'events'; render();
      return;
    }
    const deletePhoto = event.target.closest('[data-delete-photo]');
    if (deletePhoto && confirm('Permanently remove this photo?')) {
      await post(`/api/gallery/${deletePhoto.dataset.deletePhoto}/delete`);
      await loadAll(); section = 'gallery'; render();
      return;
    }
    const deleteEdition = event.target.closest('[data-delete-edition]');
    if (deleteEdition && confirm('Permanently delete this newsletter edition?')) {
      await post(`/api/newsletters/${deleteEdition.dataset.deleteEdition}/delete`);
      await loadAll(); section = 'newsletters'; render();
    }
  });
  document.getElementById('adminRefresh').addEventListener('click', loadAll);
  document.getElementById('adminSignOut').addEventListener('click', () => {
    sessionStorage.removeItem('ssaAdminPassword');
    location.reload();
  });

  if (password) loadAll().catch(() => {
    sessionStorage.removeItem('ssaAdminPassword');
    password = '';
  });
})();
