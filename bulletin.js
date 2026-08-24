(function () {
  const api = window.ssaFetch?.json;
  if (!api) return;

  const CATEGORIES = {
    roommates: 'Roommates',
    study: 'Study Groups',
    friends: 'Friends & Activities'
  };

  const surface = document.getElementById('bulletinSurface');
  const empty = document.getElementById('bulletinEmpty');
  const createModal = document.getElementById('bulletinCreateModal');
  const passwordModal = document.getElementById('bulletinPasswordModal');
  const completeModal = document.getElementById('bulletinCompleteModal');
  const createForm = document.getElementById('bulletinCreateForm');
  const pinSubmit = document.getElementById('bulletinPinSubmit');
  const passwordOutput = document.getElementById('bulletinPasswordOutput');
  const completeSubmit = document.getElementById('bulletinCompleteSubmit');
  const completeOutput = document.getElementById('bulletinCompleteOutput');

  let posts = [];
  let completePostId = null;
  let draft = null;
  const pins = { create: '', complete: '' };
  const reveal = { create: false, complete: false };

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function guestToken() {
    const key = 'ssaBulletinGuest';
    let token = localStorage.getItem(key);
    if (!token || token.length < 16) {
      token = `bb_${crypto.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
      localStorage.setItem(key, token);
    }
    return token;
  }

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

  function rotationFor(id) {
    const n = Number(id) || 0;
    const options = [-2.6, -1.5, -0.7, 0.8, 1.5, 2.4, -1.9, 1.2];
    return options[n % options.length];
  }

  function interestLabel(count) {
    const n = Number(count) || 0;
    return `${n} ${n === 1 ? 'person' : 'people'} interested`;
  }

  function cardMarkup(post) {
    const label = CATEGORIES[post.category] || post.categoryLabel || post.category;
    const complete = post.status === 'complete';
    return `
      <article class="bulletin-card ${complete ? 'is-complete' : ''}" style="--rot:${rotationFor(post.id)}deg" data-id="${post.id}">
        ${complete ? '<div class="bulletin-complete-cover" aria-hidden="true"><span class="bulletin-complete-banner">COMPLETED</span></div>' : ''}
        <div class="bulletin-card-body">
          <div class="bulletin-card-top">
            <span class="bulletin-badge bulletin-badge--${esc(post.category)}">${esc(label)}</span>
            <span class="bulletin-status ${complete ? 'is-complete' : 'is-active'}">${complete ? 'Complete' : 'Active'}</span>
          </div>
          <h3>${esc(post.title)}</h3>
          <p class="bulletin-copy">${esc(post.description)}</p>
          <div class="bulletin-meta">
            <span>${esc(post.name || 'Anonymous')}</span>
            ${complete
              ? '<span class="bulletin-done-note">No longer looking</span>'
              : `<a class="bulletin-email" href="mailto:${esc(post.email)}">${esc(post.email)}</a>`}
          </div>
          <p class="bulletin-interest" data-interest="${post.id}">${interestLabel(post.interactionCount)}</p>
          <div class="bulletin-actions">
            ${complete ? '' : `<button class="button button-dark" type="button" data-interest-btn="${post.id}">I'm Interested</button>`}
            ${complete ? '' : `<button class="button button-line" type="button" data-complete-btn="${post.id}">Mark as Complete</button>`}
          </div>
        </div>
      </article>`;
  }

  function render() {
    surface.innerHTML = posts.map(cardMarkup).join('');
    empty.hidden = posts.length > 0;
  }

  function syncPinUI(target) {
    const value = pins[target] || '';
    const slots = document.getElementById(`${target}PinSlots`);
    const show = reveal[target];
    slots?.querySelectorAll('span').forEach((slot, index) => {
      const filled = index < value.length;
      slot.classList.toggle('filled', filled);
      slot.classList.toggle('active', index === value.length && value.length < 4);
      slot.textContent = filled ? (show ? value[index] : '*') : '';
    });
    if (target === 'create') pinSubmit.disabled = value.length !== 4;
    if (target === 'complete') completeSubmit.disabled = value.length !== 4;
  }

  function setReveal(target, on) {
    reveal[target] = on;
    const eye = document.getElementById(`${target}PinEye`);
    eye?.classList.toggle('is-revealed', on);
    eye?.setAttribute('aria-pressed', on ? 'true' : 'false');
    eye?.setAttribute('aria-label', on ? 'Hide password' : 'Show password');
    syncPinUI(target);
  }

  function buildKeypad(container) {
    if (!container) return;
    const target = container.dataset.pinTarget;
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', 'back']
    ];
    container.innerHTML = keys.flat().map((key) => {
      if (key === '') return '<span class="bulletin-keypad-spacer" aria-hidden="true"></span>';
      const label = key === 'back' ? 'Backspace' : key;
      const text = key === 'back' ? '⌫' : key;
      return `<button type="button" class="bulletin-key" data-key="${key}" aria-label="${label}">${text}</button>`;
    }).join('');
    container.addEventListener('click', (event) => {
      const button = event.target.closest('[data-key]');
      if (!button) return;
      const key = button.dataset.key;
      let next = pins[target] || '';
      if (key === 'back') next = next.slice(0, -1);
      else if (/^\d$/.test(key) && next.length < 4) next += key;
      pins[target] = next;
      syncPinUI(target);
    });
  }

  async function loadPosts() {
    const data = await api('/api/bulletin');
    posts = data.posts || [];
    render();
  }

  async function publishDraft() {
    if (!draft || pins.create.length !== 4) return;
    pinSubmit.disabled = true;
    passwordOutput.textContent = 'Pinning…';
    try {
      const result = await api('/api/bulletin', {
        method: 'POST',
        body: { ...draft, password: pins.create }
      });
      posts.unshift(result.post);
      render();
      closeModal(passwordModal);
      draft = null;
      pins.create = '';
      setReveal('create', false);
      syncPinUI('create');
      passwordOutput.textContent = '';
    } catch (error) {
      passwordOutput.textContent = error.message || 'Could not post.';
      pinSubmit.disabled = pins.create.length !== 4;
    }
  }

  document.getElementById('bulletinPostOpen')?.addEventListener('click', () => {
    createForm.reset();
    createForm.name.disabled = false;
    createForm.name.required = true;
    createForm.querySelector('output').textContent = '';
    draft = null;
    openModal(createModal);
  });

  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => {
      const modal = document.getElementById(button.dataset.closeModal);
      closeModal(modal);
      if (modal === passwordModal) {
        draft = null;
        pins.create = '';
        setReveal('create', false);
      }
    });
  });

  [createModal, passwordModal, completeModal].forEach((modal) => {
    modal?.addEventListener('click', (event) => {
      if (event.target !== modal) return;
      closeModal(modal);
      if (modal === passwordModal) {
        draft = null;
        pins.create = '';
        setReveal('create', false);
      }
    });
  });

  createForm?.anonymous.addEventListener('change', () => {
    const anon = createForm.anonymous.checked;
    createForm.name.disabled = anon;
    createForm.name.required = !anon;
    if (anon) createForm.name.value = '';
  });

  createForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    createForm.querySelector('output').textContent = '';
    if (!createForm.reportValidity()) return;
    draft = {
      category: createForm.category.value,
      title: createForm.title.value.trim(),
      description: createForm.description.value.trim(),
      name: createForm.name.value.trim(),
      anonymous: createForm.anonymous.checked,
      email: createForm.email.value.trim()
    };
    pins.create = '';
    setReveal('create', false);
    syncPinUI('create');
    passwordOutput.textContent = '';
    closeModal(createModal);
    openModal(passwordModal);
  });

  pinSubmit?.addEventListener('click', publishDraft);
  document.getElementById('createPinEye')?.addEventListener('click', () => setReveal('create', !reveal.create));
  document.getElementById('completePinEye')?.addEventListener('click', () => setReveal('complete', !reveal.complete));

  surface?.addEventListener('click', async (event) => {
    const interestBtn = event.target.closest('[data-interest-btn]');
    if (interestBtn) {
      const id = interestBtn.dataset.interestBtn;
      interestBtn.disabled = true;
      try {
        const result = await api(`/api/bulletin/${id}/interest`, {
          method: 'POST',
          body: { guestToken: guestToken() }
        });
        const post = posts.find((item) => String(item.id) === String(id));
        if (post) post.interactionCount = result.interactionCount;
        const label = surface.querySelector(`[data-interest="${id}"]`);
        if (label) label.textContent = interestLabel(result.interactionCount);
      } catch (error) {
        window.alert(error.message || 'Could not record interest.');
      } finally {
        interestBtn.disabled = false;
      }
      return;
    }

    const completeBtn = event.target.closest('[data-complete-btn]');
    if (completeBtn) {
      completePostId = completeBtn.dataset.completeBtn;
      pins.complete = '';
      setReveal('complete', false);
      syncPinUI('complete');
      completeOutput.textContent = '';
      openModal(completeModal);
    }
  });

  completeSubmit?.addEventListener('click', async () => {
    if (!completePostId || pins.complete.length !== 4) return;
    completeSubmit.disabled = true;
    completeOutput.textContent = 'Checking…';
    try {
      const result = await api(`/api/bulletin/${completePostId}/complete`, {
        method: 'POST',
        body: { password: pins.complete }
      });
      const index = posts.findIndex((item) => String(item.id) === String(completePostId));
      if (index >= 0) posts[index] = result.post;
      render();
      closeModal(completeModal);
      pins.complete = '';
      setReveal('complete', false);
      syncPinUI('complete');
    } catch (error) {
      completeOutput.textContent = error.message || 'Incorrect password. Please try again.';
      pins.complete = '';
      syncPinUI('complete');
    } finally {
      completeSubmit.disabled = pins.complete.length !== 4;
    }
  });

  buildKeypad(document.getElementById('createKeypad'));
  buildKeypad(document.getElementById('completeKeypad'));
  syncPinUI('create');
  syncPinUI('complete');
  loadPosts().catch(() => {
    empty.hidden = false;
    empty.textContent = 'Could not load the bulletin board right now.';
  });
})();
