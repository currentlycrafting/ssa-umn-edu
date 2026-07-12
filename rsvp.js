(function () {
  const api = window.ssaFetch?.json;
  const modal = document.getElementById('rsvpModal');
  const form = document.getElementById('rsvpForm');
  const quickForm = document.getElementById('quickRsvpForm');
  const title = document.getElementById('rsvpTitle');
  const meta = document.getElementById('rsvpMeta');
  const modalCount = document.getElementById('rsvpModalCount');
  const result = document.getElementById('rsvpResult');
  if (!api || !modal || !form || !quickForm || !result) return;
  const eyebrow = modal.querySelector('.rsvp-modal > .eyebrow');

  const counts = {};

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function rsvpedEvents() {
    try {
      return JSON.parse(localStorage.getItem('ssaRsvpedEvents') || '[]');
    } catch (_) {
      return [];
    }
  }

  function saveRsvp(eventName) {
    const events = rsvpedEvents();
    if (!events.includes(eventName)) {
      events.push(eventName);
      localStorage.setItem('ssaRsvpedEvents', JSON.stringify(events));
    }
  }

  function guestToken() {
    let token = localStorage.getItem('ssaRsvpGuestId') || '';
    if (token.length < 16) {
      token = window.crypto?.randomUUID?.() || `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('ssaRsvpGuestId', token);
    }
    return token;
  }

  function updateButtons() {
    const saved = rsvpedEvents();
    document.querySelectorAll('.rsvp-button').forEach((button) => {
      let label = button.querySelector('.rsvp-btn-label');
      if (!label) {
        label = document.createElement('span');
        label.className = 'rsvp-btn-label';
        label.textContent = button.textContent.trim() || 'RSVP';
        button.replaceChildren(label);
      }
      if (!button.dataset.defaultLabel) button.dataset.defaultLabel = label.textContent;
      const didRsvp = saved.includes(button.dataset.event);
      button.dataset.rsvped = didRsvp ? 'true' : 'false';
      label.textContent = didRsvp
        ? (button.dataset.attendanceMode === 'quick' ? "You're coming" : "See who RSVP'ed")
        : button.dataset.defaultLabel;
      button.classList.toggle('going', didRsvp);
    });
  }

  function setCount(eventName, count) {
    counts[eventName] = Number(count) || 0;
    document.querySelectorAll('[data-event-count]').forEach((element) => {
      if (element.dataset.eventCount === eventName) element.textContent = String(counts[eventName]);
    });
  }

  async function loadCounts() {
    try {
      const data = await api('/api/rsvp/summary');
      Object.entries(data.events || {}).forEach(([eventName, count]) => setCount(eventName, count));
    } catch (_) {}
  }

  function openModal() {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function syncEligibility() {
    const isStudent = form.elements.isStudent.value;
    const ageQuestion = form.querySelector('.rsvp-age-question');
    ageQuestion.hidden = isStudent !== 'no';
    ageQuestion.querySelectorAll('input').forEach((input) => {
      input.required = isStudent === 'no' && input.value === 'yes';
      if (isStudent !== 'no') input.checked = false;
    });
  }

  function renderAttendees(data) {
    const attendees = data?.attendees || [];
    const count = Number(data?.count) || 0;
    const quick = data?.mode === 'quick';
    const names = attendees.length
      ? attendees.map((attendee) =>
          `<li class="rsvp-attendee"><span class="rsvp-name">${escapeHtml(attendee.name || attendee)}</span></li>`
        ).join('')
      : '<li class="rsvp-attendee rsvp-attendee-empty">No names yet — you might be the first.</li>';
    result.innerHTML = quick
      ? `<h3 class="rsvp-whos-coming">You&apos;re coming!</h3><p class="rsvp-count">${count} ${count === 1 ? 'person is' : 'people are'} coming</p>`
      : '<h3 class="rsvp-whos-coming">Who&apos;s coming</h3>' +
        `<p class="rsvp-count">${count} ${count === 1 ? 'person' : 'people'} total</p>` +
        `<ul class="rsvp-list">${names}</ul>`;
    form.hidden = true;
    quickForm.hidden = true;
    eyebrow.hidden = true;
    title.hidden = true;
    meta.hidden = true;
    modalCount.hidden = true;
    result.hidden = false;
  }

  async function showAttendees(eventName, initialData) {
    result.hidden = false;
    result.innerHTML = '<p>Loading who&apos;s coming…</p>';
    form.hidden = true;
    quickForm.hidden = true;
    eyebrow.hidden = true;
    title.hidden = true;
    meta.hidden = true;
    modalCount.hidden = true;
    try {
      const data = initialData?.attendees
        ? initialData
        : await api('/api/rsvp?event=' + encodeURIComponent(eventName));
      renderAttendees(data);
    } catch (_) {
      result.innerHTML = '<p>Could not load the RSVP list right now.</p>';
    }
  }

  function openFor(button) {
    const eventName = button.dataset.event || 'SSA Event';
    const eventDate = button.dataset.date || 'Date TBD';
    const attendanceMode = button.dataset.attendanceMode || 'rsvp';
    form.reset();
    quickForm.reset();
    syncEligibility();
    form.event.value = eventName;
    form.date.value = eventDate;
    quickForm.event.value = eventName;
    quickForm.date.value = eventDate;
    form.querySelector('output').textContent = '';
    title.textContent = eventName;
    meta.textContent = eventDate;
    eyebrow.hidden = false;
    title.hidden = false;
    meta.hidden = false;
    result.hidden = true;
    result.innerHTML = '';
    modalCount.hidden = false;
    const count = counts[eventName] || 0;
    modalCount.textContent = `${count} ${count === 1 ? 'person' : 'people'} coming so far`;
    form.hidden = false;
    quickForm.hidden = true;
    openModal();
    if (attendanceMode === 'quick') {
      form.hidden = true;
      quickForm.hidden = false;
      eyebrow.textContent = 'Quick response';
      if (button.dataset.rsvped === 'true' || rsvpedEvents().includes(eventName)) {
        showAttendees(eventName);
      }
      return;
    }
    eyebrow.textContent = 'RSVP';
    if (button.dataset.rsvped === 'true' || rsvpedEvents().includes(eventName)) {
      showAttendees(eventName);
    } else {
      window.setTimeout(() => form.name.focus(), 50);
    }
  }

  Array.from(form.elements.isStudent).forEach((input) => {
    input.addEventListener('change', syncEligibility);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (rsvpedEvents().includes(form.event.value)) {
      showAttendees(form.event.value);
      return;
    }
    const isStudent = form.elements.isStudent.value === 'yes';
    const isOver18 = form.elements.isOver18.value === 'yes';
    const output = form.querySelector('output');
    if (!isStudent && !isOver18) {
      output.textContent = 'You must be a U of MN student or at least 18 years old to RSVP.';
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const eventName = form.event.value;
      const data = await api('/api/rsvp', {
        method: 'POST',
        body: {
          event: eventName,
          date: form.date.value,
          name: form.name.value.trim(),
          isStudent,
          isOver18
        }
      });
      saveRsvp(eventName);
      setCount(eventName, data.count || 0);
      updateButtons();
      window.markChecklistStep?.('events', 'RSVP saved. Events step complete.');
      renderAttendees(data);
    } catch (error) {
      output.textContent = error.message || 'Could not save RSVP.';
    } finally {
      submit.disabled = false;
    }
  });

  quickForm.querySelectorAll('[data-quick-coming]').forEach((button) => {
    button.addEventListener('click', async () => {
      const coming = button.dataset.quickComing === 'yes';
      if (!coming) {
        closeModal();
        return;
      }
      quickForm.querySelectorAll('button').forEach((item) => { item.disabled = true; });
      try {
        const eventName = quickForm.event.value;
        const data = await api('/api/rsvp', {
          method: 'POST',
          body: {
            event: eventName,
            date: quickForm.date.value,
            coming: true,
            guestToken: guestToken()
          }
        });
        saveRsvp(eventName);
        setCount(eventName, data.count || 0);
        updateButtons();
        window.markChecklistStep?.('events', 'Event response saved. Events step complete.');
        renderAttendees(data);
      } catch (error) {
        quickForm.querySelector('output').textContent = error.message || 'Could not save your response.';
      } finally {
        quickForm.querySelectorAll('button').forEach((item) => { item.disabled = false; });
      }
    });
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('.rsvp-button');
    if (button) openFor(button);
  });
  modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  modal.querySelector('.modal-exit')?.addEventListener('click', closeModal);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });
  document.addEventListener('ssa:events-rendered', () => {
    updateButtons();
    loadCounts();
  });

  updateButtons();
  loadCounts();
  window.setInterval(loadCounts, 60000);
})();
