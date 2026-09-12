(function () {
  const blocks = [
    { type: 'heading', text: '', required: true },
    emptyParagraph(true),
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

  function emptyParagraph(required) {
    return {
      type: 'paragraph',
      text: '',
      html: '',
      sideLeft: null,
      sideRight: null,
      pendingSide: null,
      required: Boolean(required)
    };
  }

  function emptySide() {
    return { file: null, data: '', src: '', caption: '' };
  }

  document.querySelectorAll('[data-add-block]').forEach((button) => {
    button.addEventListener('click', () => addBlock(button.dataset.addBlock));
  });

  function addBlock(type) {
    if (type === 'paragraph') blocks.push(emptyParagraph(false));
    else if (['heading', 'announcement'].includes(type)) blocks.push({ type, text: '' });
    else if (type === 'image') blocks.push({ type: 'image', src: '', caption: '', pendingFile: null, pendingData: '' });
    render();
  }

  function sideSlotMarkup(block, index, side) {
    const slot = block[side];
    const filled = Boolean(slot && (slot.data || slot.src));
    const waiting = Boolean(block.pendingSide);
    const label = side === 'sideLeft' ? 'Drop left' : 'Drop right';
    if (filled) {
      return `
        <div class="studio-side-drop filled" data-side-drop="${index}" data-side="${side}">
          <img src="${escapeHtml(slot.data || slot.src)}" alt="" />
          <button type="button" class="studio-side-clear" data-side-clear="${index}" data-side="${side}">Remove</button>
        </div>`;
    }
    if (waiting) {
      return `
        <div class="studio-side-drop is-target" data-side-drop="${index}" data-side="${side}">
          <span>${label}</span>
          <small>Drag the photo here</small>
        </div>`;
    }
    if (block.sideLeft || block.sideRight) {
      return `<div class="studio-side-slot is-spacer" aria-hidden="true"></div>`;
    }
    return `<div class="studio-side-slot is-empty" aria-hidden="true"></div>`;
  }

  function paragraphFields(block, index) {
    const pending = block.pendingSide;
    return `
      <div class="studio-story-tools">
        <div class="studio-format-bar" data-format-bar="${index}" role="toolbar" aria-label="Text formatting">
          <button type="button" data-cmd="bold" title="Bold"><b>B</b></button>
          <button type="button" data-cmd="italic" title="Italic"><i>I</i></button>
          <button type="button" data-cmd="underline" title="Underline"><u>U</u></button>
          <button type="button" data-cmd="insertUnorderedList" title="Bullet list">• List</button>
        </div>
        <div class="studio-image-stage" data-image-stage="${index}">
          <label class="studio-add-image-btn">
            <input type="file" accept="image/png,image/jpeg,image/webp" data-stage-upload="${index}" hidden />
            <span>+ Add image</span>
          </label>
          ${pending ? `
            <div class="studio-pending-photo" draggable="true" data-pending-drag="${index}" title="Drag to left or right">
              <img src="${escapeHtml(pending.data)}" alt="" />
              <span>Drag me left or right</span>
              <button type="button" data-pending-cancel="${index}" aria-label="Cancel image">×</button>
            </div>` : '<p class="studio-image-hint">Add a photo, then drag it to the left or right of the story.</p>'}
        </div>
      </div>
      <div class="studio-story-layout ${pending ? 'is-placing' : ''} ${block.sideLeft || block.sideRight ? 'has-sides' : ''}">
        ${sideSlotMarkup(block, index, 'sideLeft')}
        <div
          class="studio-rich-editor"
          contenteditable="true"
          role="textbox"
          data-rich="${index}"
          data-placeholder="Write the story paragraph here…"
        >${block.html || escapeHtml(block.text || '').replace(/\n/g, '<br>')}</div>
        ${sideSlotMarkup(block, index, 'sideRight')}
      </div>`;
  }

  function render() {
    const labels = { heading: 'Heading', paragraph: 'Story paragraph', announcement: 'Announcement', image: 'Article image' };
    container.innerHTML = blocks.map((block, index) => {
      const required = block.required ? '<span class="studio-required">Required</span>' : `<button type="button" data-rm="${index}">Remove</button>`;
      let fields = '';
      if (block.type === 'paragraph') fields = paragraphFields(block, index);
      else if (['heading', 'announcement'].includes(block.type)) {
        fields = `<textarea rows="3" data-i="${index}" data-f="text" placeholder="Write the ${labels[block.type].toLowerCase()} here…">${escapeHtml(block.text || '')}</textarea>`;
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
    container.querySelectorAll('[data-rich]').forEach((editor) => {
      const index = Number(editor.dataset.rich);
      const sync = () => {
        blocks[index].html = editor.innerHTML;
        blocks[index].text = editor.innerText;
      };
      editor.addEventListener('input', sync);
      editor.addEventListener('blur', sync);
    });
    container.querySelectorAll('[data-format-bar]').forEach((bar) => {
      const index = Number(bar.dataset.formatBar);
      const editor = container.querySelector(`[data-rich="${index}"]`);
      bar.querySelectorAll('[data-cmd]').forEach((button) => {
        button.addEventListener('mousedown', (event) => event.preventDefault());
        button.addEventListener('click', () => {
          editor?.focus();
          document.execCommand(button.dataset.cmd, false, null);
          button.classList.toggle('is-active', document.queryCommandState(button.dataset.cmd));
          blocks[index].html = editor.innerHTML;
          blocks[index].text = editor.innerText;
        });
      });
    });
    container.querySelectorAll('[data-stage-upload]').forEach((input) => {
      input.addEventListener('change', () => stagePendingSide(Number(input.dataset.stageUpload), input.files[0]));
    });
    container.querySelectorAll('[data-pending-cancel]').forEach((button) => {
      button.addEventListener('click', () => {
        blocks[Number(button.dataset.pendingCancel)].pendingSide = null;
        render();
      });
    });
    container.querySelectorAll('[data-pending-drag]').forEach((chip) => {
      const index = Number(chip.dataset.pendingDrag);
      chip.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/ssa-side', String(index));
        event.dataTransfer.effectAllowed = 'move';
        chip.classList.add('is-dragging');
        container.querySelector(`.studio-story-layout`)?.classList.add('is-placing');
      });
      chip.addEventListener('dragend', () => {
        chip.classList.remove('is-dragging');
      });
    });
    container.querySelectorAll('[data-side-drop]').forEach((slot) => {
      slot.addEventListener('dragover', (event) => {
        event.preventDefault();
        slot.classList.add('dragging');
      });
      slot.addEventListener('dragleave', () => slot.classList.remove('dragging'));
      slot.addEventListener('drop', (event) => {
        event.preventDefault();
        slot.classList.remove('dragging');
        const index = Number(slot.dataset.sideDrop);
        const fromChip = event.dataTransfer.getData('text/ssa-side');
        if (fromChip !== '') {
          placePendingSide(index, slot.dataset.side);
          return;
        }
        if (event.dataTransfer.files?.[0]) {
          stageSideImage(index, slot.dataset.side, event.dataTransfer.files[0]);
        }
      });
    });
    container.querySelectorAll('[data-side-clear]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        blocks[Number(button.dataset.sideClear)][button.dataset.side] = null;
        render();
      });
    });
  }

  async function stageBlockImage(index, file) {
    if (!file) return;
    const data = await readFile(file);
    blocks[index].pendingFile = file;
    blocks[index].pendingData = data;
    render();
  }

  async function stagePendingSide(index, file) {
    if (!file || !blocks[index] || blocks[index].type !== 'paragraph') return;
    blocks[index].pendingSide = {
      file,
      data: await readFile(file),
      src: '',
      caption: ''
    };
    render();
  }

  function placePendingSide(index, side) {
    const block = blocks[index];
    if (!block?.pendingSide) return;
    block[side] = block.pendingSide;
    block.pendingSide = null;
    render();
  }

  async function stageSideImage(index, side, file) {
    if (!file || !blocks[index] || blocks[index].type !== 'paragraph') return;
    const data = await readFile(file);
    blocks[index][side] = {
      file,
      data,
      src: blocks[index][side]?.src || '',
      caption: blocks[index][side]?.caption || ''
    };
    blocks[index].pendingSide = null;
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
    return type === 'paragraph' ? emptyParagraph(false) : { type, text: '' };
  }

  function normalizeParagraph(source, required) {
    const block = emptyParagraph(required);
    block.text = source.text || '';
    block.html = source.html || '';
    if (source.sideLeft?.src) block.sideLeft = { file: null, data: '', src: source.sideLeft.src, caption: source.sideLeft.caption || '' };
    if (source.sideRight?.src) block.sideRight = { file: null, data: '', src: source.sideRight.src, caption: source.sideRight.caption || '' };
    return block;
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
    blocks.push(normalizeParagraph(paragraph, true));
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
      } else if (block.type === 'paragraph') {
        blocks.push(normalizeParagraph(block, false));
      } else if (['heading', 'announcement'].includes(block.type)) {
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

  function paragraphIsEmpty(block) {
    const text = String(block.text || '').replace(/\u00a0/g, ' ').trim();
    const html = String(block.html || '').replace(/<br\s*\/?>/gi, '').replace(/&nbsp;/gi, '').replace(/<[^>]+>/g, '').trim();
    return !text && !html;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    container.querySelectorAll('[data-rich]').forEach((editor) => {
      const index = Number(editor.dataset.rich);
      blocks[index].html = editor.innerHTML;
      blocks[index].text = editor.innerText;
    });
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
    if (blocks.some((block) => block.type === 'paragraph' && block.pendingSide)) {
      studioOut.textContent = 'Drag each staged story photo to the left or right before saving.';
      return;
    }
    const requiredEmpty = blocks.some((block) => {
      if (!block.required) return false;
      if (block.type === 'paragraph') return paragraphIsEmpty(block);
      return !String(block.text || '').trim();
    });
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

  async function resolveSide(side, password) {
    if (!side) return null;
    let src = side.src || '';
    if (side.file) src = await upload(side.file, side.data, password);
    if (!src) return null;
    return { src, caption: String(side.caption || '').trim() };
  }

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
      const prepared = [];
      for (const block of blocks) {
        if (block.type === 'image' && block.pendingFile) {
          block.src = await upload(block.pendingFile, block.pendingData, password);
        }
        if (block.type === 'paragraph') {
          const sideLeft = await resolveSide(block.sideLeft, password);
          const sideRight = await resolveSide(block.sideRight, password);
          prepared.push({
            type: 'paragraph',
            text: String(block.text || '').trim(),
            html: String(block.html || ''),
            sideLeft,
            sideRight
          });
          continue;
        }
        const { required, pendingFile, pendingData, sideLeft, sideRight, pendingSide, ...clean } = block;
        prepared.push(clean);
      }
      const body = {
        password,
        title: document.getElementById('studioTitle').value.trim(),
        blocks: [...prepared, ...imageBlocks],
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
