(function () {
  const blocks = [
    { type: 'heading', text: '', required: true },
    { type: 'paragraph', text: '', required: true },
    { type: 'announcement', text: '', required: true }
  ];
  const polaroids = Array.from({ length: 2 }, () => ({ file: null, data: '', caption: '', src: '' }));
  let editingId = null;
  const form = document.getElementById('studioForm');
  const container = document.getElementById('studioBlocks');
  const passwordModal = document.getElementById('studioPasswordModal');
  const passwordClose = document.getElementById('studioPasswordClose');
  const passwordForm = document.getElementById('studioPasswordForm');
  const studioOut = document.getElementById('studioOut');
  const heroTitle = document.querySelector('.studio-main .page-hero h1');
  const heroCopy = document.querySelector('.studio-main .page-hero p');
  const saveButton = form?.querySelector('button[type="submit"]');
  const passwordTitle = document.getElementById('studioPasswordTitle');

  document.querySelectorAll('[data-add-block]').forEach((button) => {
    button.addEventListener('click', () => addBlock(button.dataset.addBlock));
  });

  function addBlock(type) {
    const block = { type };
    if (['heading', 'paragraph', 'announcement'].includes(type)) block.text = '';
    if (type === 'image') { block.src = ''; block.caption = ''; block.pendingFile = null; block.pendingData = ''; }
    blocks.push(block);
    render();
  }

  function render() {
    const labels = { heading: 'Heading', paragraph: 'Story paragraph', announcement: 'Announcement', image: 'Article image' };
    container.innerHTML = blocks.map((block, index) => {
      const required = block.required ? '<span class="studio-required">Required</span>' : `<button type="button" data-rm="${index}">Remove</button>`;
      let fields = '';
      if (['heading', 'paragraph', 'announcement'].includes(block.type)) {
        fields = `<textarea rows="${block.type === 'paragraph' ? 6 : 3}" data-i="${index}" data-f="text" placeholder="Write the ${labels[block.type].toLowerCase()} here…">${escapeHtml(block.text || '')}</textarea>`;
      } else if (block.type === 'image') {
        fields = `<label class="studio-inline-drop"><input type="file" accept="image/png,image/jpeg,image/webp" data-upload="${index}" />Drop or choose an image</label><input data-i="${index}" data-f="caption" placeholder="Photo caption" value="${escapeHtml(block.caption || '')}" />${block.pendingData || block.src ? `<img src="${block.pendingData || block.src}" alt="" />` : ''}`;
      }
      return `<section class="studio-block studio-block-${block.type}"><header><strong>${labels[block.type]}</strong>${required}</header>${fields}</section>`;
    }).join('');

    container.querySelectorAll('[data-rm]').forEach((button) => {
      button.addEventListener('click', () => { blocks.splice(Number(button.dataset.rm), 1); render(); });
    });
    container.querySelectorAll('[data-i]').forEach((field) => {
      field.addEventListener('input', () => {
        const block = blocks[Number(field.dataset.i)];
        block[field.dataset.f] = field.value;
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

  function paintPolaroids() {
    document.querySelectorAll('[data-polaroid]').forEach((slot) => {
      const index = Number(slot.dataset.polaroid);
      const polaroid = polaroids[index];
      const captionInput = slot.querySelector('[data-polaroid-caption]');
      const img = slot.querySelector('img');
      captionInput.value = polaroid.caption || '';
      if (polaroid.data || polaroid.src) {
        img.src = polaroid.data || polaroid.src;
        slot.classList.add('filled');
      } else {
        img.removeAttribute('src');
        slot.classList.remove('filled');
      }
    });
  }

  document.querySelectorAll('[data-polaroid]').forEach((slot) => {
    const index = Number(slot.dataset.polaroid);
    const input = slot.querySelector('[data-polaroid-input]');
    const captionInput = slot.querySelector('[data-polaroid-caption]');
    const setFile = async (file) => {
      if (!file) return;
      polaroids[index] = {
        file,
        data: await readFile(file),
        caption: captionInput.value.trim(),
        src: polaroids[index].src || ''
      };
      slot.querySelector('img').src = polaroids[index].data;
      slot.classList.add('filled');
    };
    captionInput.addEventListener('input', () => {
      polaroids[index].caption = captionInput.value;
    });
    input.addEventListener('change', () => setFile(input.files[0]));
    slot.addEventListener('dragover', (event) => { event.preventDefault(); slot.classList.add('dragging'); });
    slot.addEventListener('dragleave', () => slot.classList.remove('dragging'));
    slot.addEventListener('drop', (event) => {
      event.preventDefault();
      slot.classList.remove('dragging');
      setFile(event.dataTransfer.files[0]);
    });
  });

  function setEditingMode(on) {
    if (heroTitle) heroTitle.textContent = on ? 'Edit newsletter' : 'Newsletter Studio';
    if (heroCopy) {
      heroCopy.textContent = on
        ? 'Update this edition, then save to republish it.'
        : 'Fill in the newsletter exactly as readers will see it.';
    }
    if (saveButton) saveButton.textContent = on ? 'Save changes' : 'Save newsletter';
    if (passwordTitle) passwordTitle.textContent = on ? 'Save changes' : 'Save newsletter';
  }

  function takeBlock(pool, type) {
    const index = pool.findIndex((block) => block.type === type);
    if (index >= 0) return pool.splice(index, 1)[0];
    return { type, text: '' };
  }

  function applyEdition(newsletter) {
    editingId = newsletter.id;
    document.getElementById('studioTitle').value = newsletter.title || '';
    const allBlocks = Array.isArray(newsletter.blocks) ? newsletter.blocks.slice() : [];
    let polaroidBlocks = [];
    let contentBlocks = allBlocks;
    if (
      allBlocks.length >= 2
      && allBlocks[allBlocks.length - 1]?.type === 'image'
      && allBlocks[allBlocks.length - 2]?.type === 'image'
    ) {
      polaroidBlocks = allBlocks.slice(-2);
      contentBlocks = allBlocks.slice(0, -2);
    }

    const pool = contentBlocks.map((block) => ({ ...block }));
    blocks.length = 0;
    const heading = takeBlock(pool, 'heading');
    const paragraph = takeBlock(pool, 'paragraph');
    const announcement = takeBlock(pool, 'announcement');
    blocks.push({ type: 'heading', text: heading.text || '', required: true });
    blocks.push({ type: 'paragraph', text: paragraph.text || '', required: true });
    blocks.push({ type: 'announcement', text: announcement.text || '', required: true });
    pool.forEach((block) => {
      if (block.type === 'image') {
        blocks.push({
          type: 'image',
          src: block.src || '',
          caption: block.caption || '',
          pendingFile: null,
          pendingData: ''
        });
      } else if (['heading', 'paragraph', 'announcement'].includes(block.type)) {
        blocks.push({ type: block.type, text: block.text || '' });
      }
    });

    polaroidBlocks.forEach((block, index) => {
      if (index > 1) return;
      polaroids[index] = {
        file: null,
        data: '',
        caption: block.caption || '',
        src: block.src || ''
      };
    });
    for (let index = polaroidBlocks.length; index < 2; index += 1) {
      polaroids[index] = { file: null, data: '', caption: '', src: '' };
    }

    setEditingMode(true);
    render();
    paintPolaroids();
    studioOut.textContent = 'Editing existing edition. Replace photos only if you want to change them.';
  }

  async function loadEdition(id) {
    studioOut.textContent = 'Loading edition…';
    try {
      const response = await window.ssaFetch.json(`/api/newsletters/${id}`);
      applyEdition(response.newsletter || response);
    } catch (error) {
      studioOut.textContent = error.message || 'Could not load that edition.';
      setEditingMode(false);
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (polaroids.some((polaroid) => !polaroid.file && !polaroid.src)) {
      studioOut.textContent = 'Add both polaroid photos before saving.';
      document.querySelector('[data-polaroid]:not(.filled)')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (polaroids.some((polaroid) => !String(polaroid.caption || '').trim())) {
      studioOut.textContent = 'Write a caption for both newsletter photos.';
      document.querySelector('[data-polaroid-caption]:invalid')?.focus();
      return;
    }
    const requiredEmpty = blocks.some((block) => block.required && !String(block.text || '').trim());
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
        let src = polaroid.src || '';
        if (polaroid.file) {
          src = await upload(polaroid.file, polaroid.data, password);
        }
        if (!src) continue;
        imageBlocks.push({ type: 'image', src, caption: String(polaroid.caption || '').trim() });
      }
      for (const block of blocks) {
        if (block.type === 'image' && block.pendingFile) {
          block.src = await upload(block.pendingFile, block.pendingData, password);
        }
      }
      const cleanBlocks = [...blocks, ...imageBlocks].map(({ required, pendingFile, pendingData, ...block }) => block);
      const body = {
        password,
        title: document.getElementById('studioTitle').value.trim(),
        blocks: cleanBlocks,
        published: true
      };
      if (editingId) body.id = editingId;
      const saved = await window.ssaFetch.json('/api/newsletters', {
        method: 'POST',
        body,
        timeout: 30000
      });
      studioOut.textContent = editingId ? 'Newsletter updated.' : 'Newsletter published.';
      passwordForm.reset();
      closePasswordModal();
      window.location.href = `/newsletter?edition=${saved.id}`;
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
  const editionId = Number(new URLSearchParams(window.location.search).get('edition') || 0);
  if (editionId) loadEdition(editionId);
})();
