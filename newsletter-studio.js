(function () {
  const blocks = [
    { type: 'heading', text: '', required: true },
    { type: 'paragraph', text: '', required: true },
    { type: 'announcement', text: '', required: true },
    { type: 'timeline', month: '', rows: [{ date: '', label: '' }], required: true }
  ];
  const polaroids = Array.from({ length: 3 }, () => ({ file: null, data: '', caption: '' }));
  const form = document.getElementById('studioForm');
  const container = document.getElementById('studioBlocks');
  const passwordModal = document.getElementById('studioPasswordModal');
  const passwordClose = document.getElementById('studioPasswordClose');
  const passwordForm = document.getElementById('studioPasswordForm');
  const studioOut = document.getElementById('studioOut');

  document.querySelectorAll('[data-add-block]').forEach((button) => {
    button.addEventListener('click', () => addBlock(button.dataset.addBlock));
  });

  function addBlock(type) {
    const block = { type };
    if (['heading', 'paragraph', 'announcement'].includes(type)) block.text = '';
    if (type === 'image') { block.src = ''; block.caption = ''; block.pendingFile = null; block.pendingData = ''; }
    if (type === 'timeline') { block.month = ''; block.rows = [{ date: '', label: '' }]; }
    if (type === 'game') { block.title = ''; block.text = ''; block.link = '/games'; }
    blocks.push(block);
    render();
  }

  function render() {
    const labels = { heading: 'Heading', paragraph: 'Story paragraph', announcement: 'Announcement', image: 'Article image', timeline: 'Timeline', game: 'Interactive game' };
    container.innerHTML = blocks.map((block, index) => {
      const required = block.required ? '<span class="studio-required">Required</span>' : `<button type="button" data-rm="${index}">Remove</button>`;
      let fields = '';
      if (['heading', 'paragraph', 'announcement'].includes(block.type)) {
        fields = `<textarea rows="${block.type === 'paragraph' ? 6 : 3}" data-i="${index}" data-f="text" placeholder="Write the ${labels[block.type].toLowerCase()} here…">${escapeHtml(block.text || '')}</textarea>`;
      } else if (block.type === 'image') {
        fields = `<label class="studio-inline-drop"><input type="file" accept="image/png,image/jpeg,image/webp" data-upload="${index}" />Drop or choose an image</label><input data-i="${index}" data-f="caption" placeholder="Photo caption" value="${escapeHtml(block.caption || '')}" />${block.pendingData || block.src ? `<img src="${block.pendingData || block.src}" alt="" />` : ''}`;
      } else if (block.type === 'timeline') {
        fields = `<input data-i="${index}" data-f="month" value="${escapeHtml(block.month || '')}" placeholder="Month or section title" /><textarea rows="4" data-i="${index}" data-f="rows" placeholder="date|event — one per line">${escapeHtml((block.rows || []).map((row) => `${row.date}|${row.label}`).join('\n'))}</textarea>`;
      } else if (block.type === 'game') {
        fields = `<input data-i="${index}" data-f="title" placeholder="Game title" value="${escapeHtml(block.title || '')}" /><textarea data-i="${index}" data-f="text" rows="3" placeholder="Game description">${escapeHtml(block.text || '')}</textarea><input data-i="${index}" data-f="link" placeholder="/games" value="${escapeHtml(block.link || '')}" />`;
      }
      return `<section class="studio-block studio-block-${block.type}"><header><strong>${labels[block.type]}</strong>${required}</header>${fields}</section>`;
    }).join('');

    container.querySelectorAll('[data-rm]').forEach((button) => {
      button.addEventListener('click', () => { blocks.splice(Number(button.dataset.rm), 1); render(); });
    });
    container.querySelectorAll('[data-i]').forEach((field) => {
      field.addEventListener('input', () => {
        const block = blocks[Number(field.dataset.i)];
        if (field.dataset.f === 'rows') {
          block.rows = field.value.split('\n').filter(Boolean).map((line) => {
            const [date, ...label] = line.split('|');
            return { date: date.trim(), label: label.join('|').trim() };
          });
        } else block[field.dataset.f] = field.value;
      });
    });
    container.querySelectorAll('[data-upload]').forEach((input) => {
      input.addEventListener('change', () => stageBlockImage(Number(input.dataset.upload), input.files[0]));
    });
  }

  async function stageBlockImage(index, file) {
    if (!file) return;
    const data = await readFile(file);
    blocks[index].pendingFile = file;
    blocks[index].pendingData = data;
    render();
  }

  document.querySelectorAll('[data-polaroid]').forEach((slot) => {
    const index = Number(slot.dataset.polaroid);
    const input = slot.querySelector('input');
    const setFile = async (file) => {
      if (!file) return;
      polaroids[index] = { file, data: await readFile(file), caption: `Newsletter photo ${index + 1}` };
      slot.querySelector('img').src = polaroids[index].data;
      slot.classList.add('filled');
    };
    input.addEventListener('change', () => setFile(input.files[0]));
    slot.addEventListener('dragover', (event) => { event.preventDefault(); slot.classList.add('dragging'); });
    slot.addEventListener('dragleave', () => slot.classList.remove('dragging'));
    slot.addEventListener('drop', (event) => {
      event.preventDefault();
      slot.classList.remove('dragging');
      setFile(event.dataTransfer.files[0]);
    });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (polaroids.some((polaroid) => !polaroid.file)) {
      studioOut.textContent = 'Add all three polaroid photos before saving.';
      document.querySelector('[data-polaroid]:not(.filled)')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const requiredEmpty = blocks.some((block) => block.required && (
      (block.type === 'timeline' && (!block.month || !block.rows.some((row) => row.date && row.label))) ||
      (block.type !== 'timeline' && !String(block.text || '').trim())
    ));
    if (requiredEmpty) {
      studioOut.textContent = 'Complete each required newsletter section before saving.';
      return;
    }
    passwordModal.classList.add('open');
    passwordModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    document.getElementById('studioPass').focus();
  });

  passwordModal.addEventListener('click', (event) => {
    if (event.target === passwordModal) closePasswordModal();
  });
  passwordClose?.addEventListener('click', closePasswordModal);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && passwordModal.classList.contains('open')) closePasswordModal();
  });

  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = document.getElementById('studioPass').value;
    const button = event.submitter;
    button.disabled = true;
    passwordForm.querySelector('output').textContent = 'Uploading and saving…';
    try {
      const imageBlocks = [];
      for (const polaroid of polaroids) {
        if (!polaroid.file) continue;
        imageBlocks.push({ type: 'image', src: await upload(polaroid.file, polaroid.data, password), caption: polaroid.caption });
      }
      for (const block of blocks) {
        if (block.type === 'image' && block.pendingFile) {
          block.src = await upload(block.pendingFile, block.pendingData, password);
        }
      }
      const cleanBlocks = [...imageBlocks, ...blocks].map(({ required, pendingFile, pendingData, ...block }) => block);
      await window.ssaFetch.json('/api/newsletters', {
        method: 'POST',
        body: {
          password,
          title: document.getElementById('studioTitle').value.trim(),
          blocks: cleanBlocks,
          published: document.getElementById('studioPublished').checked
        },
        timeout: 30000
      });
      studioOut.textContent = 'Newsletter saved.';
      passwordForm.reset();
      closePasswordModal();
    } catch (error) {
      passwordForm.querySelector('output').textContent = error.message || 'Could not save newsletter.';
    } finally {
      button.disabled = false;
    }
  });

  async function upload(file, data, password) {
    const response = await window.ssaFetch.json('/api/uploads', {
      method: 'POST',
      body: { password, filename: file.name, data },
      timeout: 30000
    });
    return response.url;
  }

  function closePasswordModal() {
    passwordModal.classList.remove('open');
    passwordModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  render();
})();
