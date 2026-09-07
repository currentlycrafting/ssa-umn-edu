(function () {
  const api = window.ssaFetch?.json;
  if (!api) return;

  const CATEGORIES = {
    roommates: 'Roommates',
    study: 'Study Groups',
    friends: 'Friends & Activities'
  };

  const STEP_IDS = [
    'bulletinStepCategory',
    'bulletinStepDetails',
    'bulletinStepContact',
    'bulletinStepPin'
  ];

  const surface = document.getElementById('bulletinSurface');
  const empty = document.getElementById('bulletinEmpty');
  const completeModal = document.getElementById('bulletinCompleteModal');
  const pinSubmit = document.getElementById('bulletinPinSubmit');
  const passwordOutput = document.getElementById('bulletinPasswordOutput');
  const completeSubmit = document.getElementById('bulletinCompleteSubmit');
  const completeOutput = document.getElementById('bulletinCompleteOutput');
  const anonToggle = document.getElementById('bulletinAnonymous');
  const nameInput = document.getElementById('bulletinName');

  let posts = [];
  let completePostId = null;
  let createStep = 0;
  const draft = {
    category: '',
    title: '',
    description: '',
    name: '',
    anonymous: false,
    email: ''
  };
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
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    if (!document.querySelector('.modal-backdrop.open')) {
      document.body.classList.remove('modal-open');
    }
  }

  function closeAllCreateSteps() {
    STEP_IDS.forEach((id) => closeModal(document.getElementById(id)));
  }

  function showCreateStep(step) {
    createStep = step;
    STEP_IDS.forEach((id, index) => {
      const modal = document.getElementById(id);
      if (!modal) return;
      if (index === step) openModal(modal);
      else closeModal(modal);
    });
    if (step === 3) {
      pins.create = '';
      setReveal('create', false);
      if (passwordOutput) passwordOutput.textContent = '';
      syncPinUI('create');
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
    if (target === 'create' && pinSubmit) pinSubmit.disabled = value.length !== 4;
    if (target === 'complete' && completeSubmit) completeSubmit.disabled = value.length !== 4;
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

  function setStepError(id, message) {
    const el = document.getElementById(id);
    if (!el) return false;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      return false;
    }
    el.hidden = false;
    el.textContent = message;
    return false;
  }

  function readStepIntoDraft(step) {
    if (step === 0) {
      const selected = document.querySelector('input[name="bulletinCategory"]:checked');
      if (!selected) return setStepError('bulletinCategoryError', 'Pick a category to continue.');
      setStepError('bulletinCategoryError', '');
      draft.category = selected.value;
      return true;
    }
    if (step === 1) {
      const title = document.getElementById('bulletinTitle')?.value.trim() || '';
      const description = document.getElementById('bulletinDescription')?.value.trim() || '';
      if (!title || !description) return setStepError('bulletinDetailsError', 'Add a title and description.');
      setStepError('bulletinDetailsError', '');
      draft.title = title;
      draft.description = description;
      return true;
    }
    if (step === 2) {
      const anonymous = Boolean(anonToggle?.checked);
      const name = nameInput?.value.trim() || '';
      const emailInput = document.getElementById('bulletinEmail');
      const email = emailInput?.value.trim() || '';
      if (!anonymous && !name) return setStepError('bulletinContactError', 'Add your name, or post anonymously.');
      if (!email || (emailInput && !emailInput.checkValidity())) {
        return setStepError('bulletinContactError', 'Add a valid public email.');
      }
      setStepError('bulletinContactError', '');
      draft.anonymous = anonymous;
      draft.name = anonymous ? '' : name;
      draft.email = email;
      return true;
    }
    return true;
  }

  function resetCreateFlow() {
    draft.category = '';
    draft.title = '';
    draft.description = '';
    draft.name = '';
    draft.anonymous = false;
    draft.email = '';
    document.querySelectorAll('input[name="bulletinCategory"]').forEach((input) => { input.checked = false; });
    const title = document.getElementById('bulletinTitle');
    const description = document.getElementById('bulletinDescription');
    const email = document.getElementById('bulletinEmail');
    if (title) title.value = '';
    if (description) description.value = '';
    if (nameInput) {
      nameInput.value = '';
      nameInput.disabled = false;
    }
    if (anonToggle) anonToggle.checked = false;
    if (email) email.value = '';
    pins.create = '';
    setReveal('create', false);
    syncPinUI('create');
    if (passwordOutput) passwordOutput.textContent = '';
    setStepError('bulletinCategoryError', '');
    setStepError('bulletinDetailsError', '');
    setStepError('bulletinContactError', '');
    createStep = 0;
  }

  async function publishDraft() {
    if (pins.create.length !== 4) return;
    pinSubmit.disabled = true;
    passwordOutput.textContent = 'Pinning…';
    try {
      const result = await api('/api/bulletin', {
        method: 'POST',
        body: { ...draft, password: pins.create }
      });
      posts.unshift(result.post);
      render();
      closeAllCreateSteps();
      resetCreateFlow();
    } catch (error) {
      passwordOutput.textContent = error.message || 'Could not post.';
      pinSubmit.disabled = pins.create.length !== 4;
    }
  }

  async function loadPosts() {
    const data = await api('/api/bulletin');
    posts = data.posts || [];
    render();
  }

  document.getElementById('bulletinPostOpen')?.addEventListener('click', () => {
    resetCreateFlow();
    showCreateStep(0);
  });

  document.querySelectorAll('[data-close-bulletin-flow]').forEach((button) => {
    button.addEventListener('click', () => {
      closeAllCreateSteps();
      resetCreateFlow();
    });
  });

  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', () => {
      const modal = document.getElementById(button.dataset.closeModal);
      closeModal(modal);
    });
  });

  STEP_IDS.forEach((id) => {
    const modal = document.getElementById(id);
    modal?.addEventListener('click', (event) => {
      if (event.target !== modal) return;
      closeAllCreateSteps();
      resetCreateFlow();
    });
  });

  completeModal?.addEventListener('click', (event) => {
    if (event.target === completeModal) closeModal(completeModal);
  });

  document.querySelectorAll('[data-bulletin-next]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!readStepIntoDraft(createStep)) return;
      if (createStep < STEP_IDS.length - 1) showCreateStep(createStep + 1);
    });
  });

  document.querySelectorAll('[data-bulletin-prev]').forEach((button) => {
    button.addEventListener('click', () => {
      if (createStep <= 0) return;
      showCreateStep(createStep - 1);
    });
  });

  anonToggle?.addEventListener('change', () => {
    const anon = anonToggle.checked;
    if (!nameInput) return;
    nameInput.disabled = anon;
    if (anon) nameInput.value = '';
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
