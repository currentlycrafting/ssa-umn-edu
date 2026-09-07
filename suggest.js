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
      if (next === 'idea') {
        if (nameInput.value.trim().length < 2) {
          nameInput.focus();
          return;
        }
        reveal('idea');
        return;
      }
      if (next === 'fun') {
        if (ideaInput.value.trim().length < 4) {
          ideaInput.focus();
          return;
        }
        reveal('fun');
      }
    });
  });

  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      form.querySelector('[data-continue="idea"]')?.click();
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

  window.setTimeout(() => nameInput.focus(), 200);
})();
