(function () {
  const api = window.ssaFetch?.json;
  if (!api) return;

  function openModal(modal) {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeModal(modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.modal-backdrop.open')) {
      document.body.classList.remove('modal-open');
    }
  }

  function bindModal(modal) {
    if (!modal) return;
    modal.querySelector('.modal-exit')?.addEventListener('click', () => closeModal(modal));
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal(modal);
    });
  }

  const rsvpModal = document.getElementById('eventsRsvpModal');
  const rsvpForm = document.getElementById('eventsRsvpForm');
  bindModal(rsvpModal);
  document.querySelectorAll('.rsvp-button').forEach((button) => {
    button.addEventListener('click', () => {
      rsvpForm.reset();
      rsvpForm.event.value = button.dataset.event;
      rsvpForm.date.value = button.dataset.date;
      document.getElementById('eventsRsvpTitle').textContent = button.dataset.event;
      document.getElementById('eventsRsvpMeta').textContent = button.dataset.date;
      rsvpForm.querySelector('output').textContent = '';
      openModal(rsvpModal);
      window.setTimeout(() => rsvpForm.name.focus(), 60);
    });
  });
  rsvpForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = rsvpForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const data = await api('/api/rsvp', {
        method: 'POST',
        body: {
          event: rsvpForm.event.value,
          date: rsvpForm.date.value,
          name: rsvpForm.name.value.trim(),
          email: rsvpForm.email.value.trim()
        }
      });
      document.querySelectorAll('[data-event-count]').forEach((el) => {
        if (el.dataset.eventCount === rsvpForm.event.value) el.textContent = data.count ?? 0;
      });
      rsvpForm.querySelector('output').textContent = 'RSVP saved.';
      window.setTimeout(() => closeModal(rsvpModal), 900);
    } catch (error) {
      rsvpForm.querySelector('output').textContent = error.message || 'Could not save RSVP.';
    } finally {
      submit.disabled = false;
    }
  });

  const suggestModal = document.getElementById('eventsSuggestModal');
  const suggestForm = document.getElementById('eventsSuggestForm');
  bindModal(suggestModal);
  document.querySelectorAll('[data-suggest-event]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      suggestForm.reset();
      suggestForm.querySelector('output').textContent = '';
      openModal(suggestModal);
      window.setTimeout(() => suggestForm.name.focus(), 60);
    });
  });
  suggestForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = suggestForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      await api('/api/event-suggestions', {
        method: 'POST',
        body: {
          type: suggestForm.type.value,
          name: suggestForm.name.value.trim(),
          description: suggestForm.description.value.trim(),
          audience: suggestForm.audience.value.trim(),
          budget: suggestForm.budget.value.trim(),
          preferredDate: suggestForm.preferredDate.value.trim(),
          notes: suggestForm.notes.value.trim()
        }
      });
      suggestForm.querySelector('output').textContent = 'Thanks — the board will review your idea.';
      window.setTimeout(() => closeModal(suggestModal), 1100);
    } catch (error) {
      suggestForm.querySelector('output').textContent = error.message || 'Could not submit this idea.';
    } finally {
      submit.disabled = false;
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.modal-backdrop.open').forEach(closeModal);
  });

  api('/api/rsvp/summary')
    .then((data) => {
      document.querySelectorAll('[data-event-count]').forEach((el) => {
        el.textContent = data.events?.[el.dataset.eventCount] ?? 0;
      });
    })
    .catch(() => {});
})();
