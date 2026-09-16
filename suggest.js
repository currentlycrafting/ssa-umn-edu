(function () {
  const api = window.ssaFetch?.json;
  const form = document.getElementById('suggestForm');
  if (!api || !form) return;

  const params = new URLSearchParams(window.location.search);
  const eventType = params.get('type') === 'community' ? 'community' : 'campus';
  const nameInput = document.getElementById('suggestName');
  const ideaInput = document.getElementById('suggestIdea');
  const funInput = document.getElementById('suggestFun');
  const linksInput = document.getElementById('suggestLinks');
  const filesInput = document.getElementById('suggestFiles');
  const fileList = document.getElementById('suggestFileList');
  const drop = document.getElementById('suggestDrop');
  const output = document.getElementById('suggestOut');
  const submitBtn = document.getElementById('suggestSubmit');
  let selectedFiles = [];

  function step(name) {
    return form.querySelector(`[data-step="${name}"]`);
  }

  function reveal(name) {
    const section = step(name);
    if (!section || !section.hidden) return;
    section.hidden = false;
    requestAnimationFrame(() => {
      section.classList.add('is-active');
      section.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const focusable = section.querySelector('input:not([type="hidden"]), textarea, button.suggest-choice, button.suggest-continue');
      focusable?.focus();
    });
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderFiles() {
    if (!selectedFiles.length) {
      fileList.hidden = true;
      fileList.innerHTML = '';
      return;
    }
    fileList.hidden = false;
    fileList.innerHTML = selectedFiles.map((file, index) => (
      `<li><span>${file.name}</span><button type="button" data-remove-file="${index}" aria-label="Remove ${file.name}">Remove</button></li>`
    )).join('');
  }

  function addFiles(fileListLike) {
    const incoming = Array.from(fileListLike || []).filter((file) => /^image\/(png|jpeg|webp)$/i.test(file.type));
    selectedFiles = [...selectedFiles, ...incoming].slice(0, 3);
    renderFiles();
  }

  form.querySelectorAll('[data-continue]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.continue;
      if (next === 'name') {
        if (ideaInput.value.trim().length < 4) {
          ideaInput.focus();
          return;
        }
        reveal('name');
        return;
      }
      if (next === 'fun') {
        if (nameInput.value.trim().length < 2) {
          nameInput.focus();
          return;
        }
        reveal('fun');
      }
    });
  });

  ideaInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      form.querySelector('[data-continue="name"]')?.click();
    }
  });

  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      form.querySelector('[data-continue="fun"]')?.click();
    }
  });

  form.querySelectorAll('[data-fun]').forEach((button) => {
    button.addEventListener('click', () => {
      const value = button.dataset.fun;
      funInput.value = value;
      form.querySelectorAll('[data-fun]').forEach((other) => {
        other.classList.toggle('is-selected', other === button);
        other.setAttribute('aria-pressed', other === button ? 'true' : 'false');
      });
      reveal('inspire');
    });
  });

  filesInput.addEventListener('change', () => addFiles(filesInput.files));
  ['dragenter', 'dragover'].forEach((type) => {
    drop.addEventListener(type, (event) => {
      event.preventDefault();
      drop.classList.add('dragging');
    });
  });
  ['dragleave', 'drop'].forEach((type) => {
    drop.addEventListener(type, (event) => {
      event.preventDefault();
      drop.classList.remove('dragging');
    });
  });
  drop.addEventListener('drop', (event) => addFiles(event.dataTransfer?.files));

  fileList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-file]');
    if (!button) return;
    selectedFiles.splice(Number(button.dataset.removeFile), 1);
    renderFiles();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!nameInput.value.trim() || ideaInput.value.trim().length < 4) {
      output.textContent = 'Add a name and a short idea first.';
      return;
    }
    if (!funInput.value) {
      reveal('fun');
      output.textContent = 'Pick Yes or No — it helps us feel the energy.';
      return;
    }
    submitBtn.disabled = true;
    output.textContent = 'Sending…';
    try {
      const inspirationImages = [];
      for (const file of selectedFiles) {
        inspirationImages.push({ filename: file.name, data: await readFile(file) });
      }
      await api('/api/event-suggestions', {
        method: 'POST',
        body: {
          type: eventType,
          name: nameInput.value.trim(),
          description: ideaInput.value.trim(),
          funAnswer: funInput.value,
          inspirationLinks: linksInput.value.trim(),
          inspirationImages
        }
      });
      output.textContent = 'Sent — thank you. The board will see it.';
      form.querySelectorAll('.suggest-step').forEach((section) => {
        section.querySelectorAll('input, textarea, button').forEach((el) => {
          if (el.type === 'submit') return;
          el.disabled = true;
        });
      });
      window.setTimeout(() => {
        window.location.href = '/events';
      }, 1400);
    } catch (error) {
      output.textContent = error.message || 'Could not send this yet.';
      submitBtn.disabled = false;
    }
  });

  window.setTimeout(() => ideaInput.focus(), 200);

  function voterToken() {
    let token = localStorage.getItem('ssaSuggestVoterId') || '';
    if (token.length < 16) {
      token = window.crypto?.randomUUID?.() || `voter-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('ssaSuggestVoterId', token);
    }
    return token;
  }

  function votedSet() {
    try {
      return new Set(JSON.parse(localStorage.getItem('ssaSuggestVotes') || '[]'));
    } catch (_) {
      return new Set();
    }
  }

  function markVoted(id) {
    const set = votedSet();
    set.add(String(id));
    localStorage.setItem('ssaSuggestVotes', JSON.stringify([...set]));
  }

  async function loadVotes() {
    const list = document.getElementById('suggestVoteList');
    if (!list) return;
    try {
      const data = await api('/api/event-suggestions');
      const items = data.items || [];
      if (!items.length) {
        list.innerHTML = '<p class="admin-empty">No ideas yet — yours could be first.</p>';
        return;
      }
      const voted = votedSet();
      list.innerHTML = items.slice(0, 12).map((item) => `
        <article class="suggest-vote-card">
          <div>
            <span class="eyebrow">${item.type === 'community' ? 'Community' : 'Campus'}</span>
            <h3>${escapeHtml(item.name)}</h3>
            <p>${escapeHtml(item.description)}</p>
          </div>
          <button type="button" class="button button-line suggest-vote-btn" data-vote-id="${item.id}" ${voted.has(String(item.id)) ? 'disabled' : ''}>
            <strong data-vote-count="${item.id}">${item.votes || 0}</strong>
            <span>${voted.has(String(item.id)) ? 'Voted' : 'Vote'}</span>
          </button>
        </article>`).join('');
    } catch (_) {
      list.innerHTML = '<p class="admin-empty">Ideas will show here once they load.</p>';
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  document.getElementById('suggestVoteList')?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-vote-id]');
    if (!button || button.disabled) return;
    button.disabled = true;
    try {
      const data = await api(`/api/event-suggestions/${button.dataset.voteId}/vote`, {
        method: 'POST',
        body: { guestToken: voterToken() }
      });
      markVoted(button.dataset.voteId);
      const count = button.querySelector('[data-vote-count]');
      if (count) count.textContent = String(data.votes ?? 0);
      const label = button.querySelector('span');
      if (label) label.textContent = 'Voted';
    } catch (_) {
      button.disabled = false;
    }
  });

  loadVotes();
})();
