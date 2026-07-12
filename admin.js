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
  let data = { admin: {}, events: [], gallery: [], editions: [] };

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
    const [eventsResult, galleryResult, editionsResult] = await Promise.allSettled([
      post('/api/events/list-all'),
      post('/api/gallery/list-all'),
      post('/api/newsletters/list-all')
    ]);
    if (eventsResult.status === 'fulfilled') data.events = eventsResult.value.events || [];
    if (galleryResult.status === 'fulfilled') data.gallery = galleryResult.value.items || [];
    if (editionsResult.status === 'fulfilled') data.editions = editionsResult.value.newsletters || [];
    render();
  }

  function stat(label, value, note) {
    return `<article class="admin-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`;
  }

  function renderOverview() {
    const admin = data.admin;
    content.innerHTML = `
      <div class="admin-stat-grid">
        ${stat('Published events', data.events.filter((event) => event.published).length, 'Manage the public calendar')}
        ${stat('Gallery photos', data.gallery.length, 'PostgreSQL uploads')}
        ${stat('RSVPs', (admin.rsvp || []).length, 'Across all events')}
        ${stat('Subscribers', (admin.newsletters || []).length, 'Newsletter audience')}
        ${stat('Event ideas', (admin.event_suggestions || []).length, 'Community suggestions')}
        ${stat('Aux requests', (admin.aux || []).length, 'Waiting in queue')}
      </div>
      <div class="admin-quick-grid">
        <button data-go="events"><strong>Create an event</strong><span>Publish featured or regular events.</span></button>
        <button data-go="gallery"><strong>Manage gallery</strong><span>Add or remove community photos.</span></button>
        <a href="/newsletter/studio"><strong>Newsletter Studio</strong><span>Publish the next edition.</span></a>
        <a href="/events"><strong>Preview events</strong><span>See the public experience.</span></a>
      </div>`;
  }

  function eventForm(event = {}) {
    const startTime = event.startTime || (event.startsAt?.includes('T') ? event.startsAt.slice(11, 16) : '');
    const previewImage = event.imageUrl || '/assets/events/afton-state-park.png';
    return `<form class="admin-editor" id="adminEventForm">
      <input type="hidden" name="id" value="${esc(event.id || '')}" />
      <input type="hidden" name="rsvpKey" value="${esc(event.rsvpKey || '')}" />
      <input type="hidden" name="shortDate" value="${esc(event.shortDate || '')}" />
      <input type="hidden" name="location" value="${esc(event.location || '')}" />
      <input type="hidden" name="startsAt" value="${esc(event.startsAt || '')}" />
      <input type="hidden" name="sortOrder" value="${esc(event.sortOrder ?? data.events.length * 10)}" />
      <input type="hidden" name="imageUrl" value="${esc(event.imageUrl || '')}" />
      <div class="admin-editor-head"><div><span class="eyebrow">${event.id ? 'Edit event' : 'New event'}</span><h3>${event.id ? esc(event.title) : 'Add to the calendar'}</h3></div>${event.id ? '<button type="button" class="button button-line" data-new-event>New event</button>' : ''}</div>
      <div class="admin-form-grid">
        <label>Public title<input name="title" value="${esc(event.title || '')}" required /></label>
        <label>Full date label<input name="dateLabel" value="${esc(event.dateLabel || '')}" placeholder="October 8 — Location" required /></label>
        <label>Start time<input type="time" name="startTime" value="${esc(startTime)}" /></label>
        <label>Featured image<input type="file" name="image" accept="image/png,image/jpeg,image/webp" /></label>
      </div>
      <label>Description<textarea name="description" rows="4" required>${esc(event.description || '')}</textarea></label>
      <fieldset class="admin-feature-choice"><legend>Where should this event appear?</legend><div><label><input type="radio" name="featured" value="no" ${event.featured ? '' : 'checked'} /><span>Regular event</span></label><label><input type="radio" name="featured" value="yes" ${event.featured ? 'checked' : ''} /><span>Featured event</span></label></div><small>Choosing Featured replaces the current featured event.</small></fieldset>
      <div class="admin-event-preview" id="adminEventPreview" data-image="${esc(previewImage)}"></div>
      <div class="admin-editor-actions"><button class="button button-dark" type="submit">${event.id ? 'Save changes' : 'Publish event'}</button><output></output></div>
    </form>`;
  }

  function renderEvents(editId) {
    const editing = data.events.find((event) => event.id === Number(editId));
    content.innerHTML = eventForm(editing) + `<div class="admin-list-head"><h3>Calendar</h3><span>${data.events.length} events</span></div><div class="admin-event-list">${data.events.map((event) => `
      <article class="admin-event-item ${event.published ? '' : 'is-draft'}">
        <div class="admin-event-date">${esc(event.shortDate)}</div>
        <div><span class="eyebrow">${event.featured ? 'Featured' : event.published ? 'Regular event' : 'Hidden'}</span><h3>${esc(event.title)}</h3><p>${esc(event.dateLabel)}</p></div>
        <div class="admin-item-actions"><button class="button button-line" data-edit-event="${event.id}">Edit</button><button class="button button-line" data-delete-event="${event.id}">Remove</button></div>
      </article>`).join('')}</div>`;
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
    let previewImage = preview?.dataset.image || '/assets/events/afton-state-park.png';
    function readableTime(value) {
      if (!value) return '';
      const [hours, minutes] = value.split(':').map(Number);
      return `${hours % 12 || 12}:${String(minutes || 0).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
    }
    function updatePreview() {
      if (!preview) return;
      const featured = form.featured.value === 'yes';
      const eventTitle = form.title.value.trim() || 'Event title';
      const date = form.dateLabel.value.trim() || 'Date and location';
      const time = readableTime(form.startTime.value);
      const description = form.description.value.trim() || 'Your event description will appear here.';
      preview.innerHTML = featured
        ? `<span class="admin-preview-label">Featured preview</span><article class="featured-event"><div class="featured-event-art"><img src="${esc(previewImage)}" alt="" /></div><div class="featured-event-body"><span class="eyebrow">Featured Event</span><h3>${esc(eventTitle)}</h3><p class="featured-location">${esc(date)}${time ? ` · ${esc(time)}` : ''}</p><p class="featured-copy">${esc(description)}</p><button class="button button-dark" type="button">Reserve Your Spot</button></div></article>`
        : `<span class="admin-preview-label">Regular event preview</span><article class="event-card"><span class="event-date">${esc(date)}${time ? ` · ${esc(time)}` : ''}</span><h3>${esc(eventTitle)}</h3><p>${esc(description)}</p><button class="micro-button" type="button">RSVP</button></article>`;
    }
    form?.querySelectorAll('input, textarea').forEach((field) => {
      if (field.type !== 'file') field.addEventListener('input', updatePreview);
    });
    form?.image.addEventListener('change', async () => {
      if (!form.image.files[0]) return;
      previewImage = await readFile(form.image.files[0]);
      updatePreview();
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
        if (form.image.files[0]) {
          const file = form.image.files[0];
          const upload = await post('/api/uploads', { filename: file.name, data: await readFile(file) });
          imageUrl = upload.url;
        }
        await post('/api/events', {
          id: form.id.value || undefined,
          rsvpKey: form.rsvpKey.value.trim(),
          title: form.title.value.trim(),
          shortDate: form.shortDate.value.trim(),
          dateLabel: form.dateLabel.value.trim(),
          location: form.location.value.trim(),
          startsAt: form.startsAt.value || '',
          startTime: form.startTime.value || '',
          sortOrder: Number(form.sortOrder.value || 0),
          description: form.description.value.trim(),
          imageUrl,
          featured: form.featured.value === 'yes',
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

  function row(primary, meta, detail, date, actions = '') {
    return `<article class="admin-data-row"><div><strong>${primary}</strong>${meta ? `<span>${meta}</span>` : ''}${detail ? `<p>${detail}</p>` : ''}</div><div><time>${fmt(date)}</time>${actions}</div></article>`;
  }

  function renderDataSection() {
    const rows = section === 'newsletters' ? data.admin.newsletters || [] : data.admin[section] || [];
    if (!rows.length) {
      content.innerHTML = '<div class="admin-empty"><h3>Nothing here yet</h3><p>New activity will appear automatically.</p></div>';
      return;
    }
    content.innerHTML = `<div class="admin-data-list">${rows.map((item) => {
      if (section === 'rsvp') return row(esc(item.name), `${esc(item.event_name)} · ${esc(item.event_date)}`, item.is_student ? 'U of MN student' : 'Community guest · 18+', item.created_at);
      if (section === 'messages') return row(esc(item.name), esc(item.email), esc(item.message), item.created_at);
      if (section === 'connect') return row(`${esc(item.name)} · ${esc(item.reason)}`, esc(item.email), esc(item.details), item.created_at);
      if (section === 'event_suggestions') return row(`${esc(item.name)} · ${esc(item.type)}`, esc(item.preferred_date || item.audience || ''), esc(item.description), item.created_at);
      if (section === 'scores') return row(esc(item.name), `${item.mistakes} mistakes · ${item.seconds}s`, item.solved ? 'Solved' : 'Not solved', item.created_at);
      if (section === 'aux') return row(esc(item.songName), esc(item.artist), `Requested by ${esc(item.requestedBy)}`, item.created_at, `<button class="button button-line" data-play-aux="${item.id}">Play next</button>`);
      return row(esc(item.email), '', '', item.created_at);
    }).join('')}</div>${section === 'aux' ? '<button class="button button-line admin-danger" data-clear-aux>Clear request queue</button>' : ''}`;
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
        row(esc(edition.title), edition.published ? 'Published' : 'Draft', '', edition.createdAt, `<button class="button button-line" data-delete-edition="${edition.id}">Delete</button>`)
      ).join('') || '<p class="admin-empty">No editions yet.</p>'}</div>
      <div class="admin-list-head"><h3>Subscribers</h3><span>${subscribers.length}</span></div>
      <div class="admin-data-list">${subscribers.map((item) => row(esc(item.email), '', '', item.created_at)).join('') || '<p class="admin-empty">No subscribers yet.</p>'}</div>`;
  }

  function render() {
    const labels = { overview: 'Overview', events: 'Events', gallery: 'Gallery', rsvp: 'RSVPs', event_suggestions: 'Event ideas', messages: 'Messages', connect: 'Community', newsletters: 'Newsletter subscribers', aux: 'Aux queue', scores: 'Arcade scores' };
    title.textContent = labels[section] || 'Admin';
    document.querySelectorAll('#adminSections [data-section]').forEach((button) => button.classList.toggle('active', button.dataset.section === section));
    if (section === 'overview') renderOverview();
    else if (section === 'events') renderEvents();
    else if (section === 'gallery') renderGallery();
    else if (section === 'newsletters') renderNewsletter();
    else renderDataSection();
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
      return;
    }
    const play = event.target.closest('[data-play-aux]');
    if (play) {
      play.disabled = true;
      await post(`/api/admin/aux/${play.dataset.playAux}/play`);
      await loadAll(); section = 'aux'; render();
      return;
    }
    if (event.target.closest('[data-clear-aux]') && confirm('Clear the entire request queue?')) {
      await post('/api/admin/aux/clear');
      await loadAll(); section = 'aux'; render();
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
