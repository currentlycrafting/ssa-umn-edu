function assignDirectEditableElements() {
  var selectors = [
    '#hero .hero-eyebrow',
    '#hero .hero-title',
    '#hero .hero-sub',
    '#mission .mission-year',
    '#mission .mission-stat',
    '#mission .mission-stat-label',
    '#mission .mission-right h2',
    '#mission .mission-right p',
    '#signature-event .event-tag',
    '#signature-event .event-content-side h2',
    '#signature-event .event-content-side > .reveal > p',
    '#about .section-label',
    '#about h2',
    '#about p',
    '#cta .section-label',
    '#cta h2',
    '#cta p',
    '.footer-left span',
    '.footer-center'
  ];
  var nodes = document.querySelectorAll(selectors.join(', '));
  nodes.forEach(function(node, idx) {
    node.setAttribute('data-admin-direct-edit', 'true');
    if (!node.dataset.directEditId) node.dataset.directEditId = 'text-' + idx;
  });
}

function applyDirectText() {
  Object.entries(siteData.directText).forEach(function(entry) {
    var key = entry[0], value = entry[1];
    var el = document.querySelector('[data-direct-edit-id="' + key + '"]');
    if (el) el.innerHTML = value;
  });
}

function applyEditableAssets() {
  document.querySelectorAll('[data-link-key]').forEach(function(link) {
    var key = link.dataset.linkKey;
    var saved = siteData.editableLinks[key];
    if (!saved) return;
    if (saved.href) link.href = saved.href;
    if (saved.text) link.textContent = saved.text;
  });

  document.querySelectorAll('[data-image-key]').forEach(function(image) {
    var key = image.dataset.imageKey;
    var saved = siteData.editableImages[key];
    if (saved?.src) image.src = saved.src;
  });
}

function setDirectEditEnabled(enabled) {
  directEditEnabled = enabled;
  document.body.classList.toggle('admin-direct-edit', enabled);
  document.querySelectorAll('[data-admin-direct-edit="true"]').forEach(function(el) {
    el.contentEditable = enabled ? 'true' : 'false';
    el.spellcheck = enabled;
  });
}

function wireDirectEditInteractions() {
  document.addEventListener('click', function(event) {
    if (!directEditEnabled) return;

    var image = event.target.closest('.admin-editable-image');
    if (image) {
      event.preventDefault();
      var nextSrc = prompt('Image URL', image.getAttribute('src') || '');
      if (nextSrc) image.setAttribute('src', nextSrc.trim());
      return;
    }

    var link = event.target.closest('.admin-editable-link');
    if (link) {
      event.preventDefault();
      var nextHref = prompt('Button/link URL', link.getAttribute('href') || '');
      if (nextHref) link.setAttribute('href', nextHref.trim());
      var nextText = prompt('Button/link text', link.textContent || '');
      if (nextText) link.textContent = nextText.trim();
    }
  });
}

function captureDirectEdits() {
  siteData.directText = {};
  document.querySelectorAll('[data-admin-direct-edit="true"]').forEach(function(el) {
    siteData.directText[el.dataset.directEditId] = el.innerHTML;
  });

  siteData.editableLinks = {};
  document.querySelectorAll('[data-link-key]').forEach(function(link) {
    siteData.editableLinks[link.dataset.linkKey] = {
      href: link.getAttribute('href') || '',
      text: link.textContent?.trim() || ''
    };
  });

  siteData.editableImages = {};
  document.querySelectorAll('[data-image-key]').forEach(function(img) {
    siteData.editableImages[img.dataset.imageKey] = {
      src: img.getAttribute('src') || ''
    };
  });
}

function renderAdminForms() {
  var root = document.getElementById('admin-dynamic-forms');
  if (!root || !adminUnlocked) return;

  var imageFieldKeys = new Set(['image', 'src']);
  var buildUploadUi = function(section, idx, fieldKey) {
    return '\
    <div class="admin-upload-wrap">\
      <div class="admin-upload-zone" data-upload-zone data-section="' + section + '" data-index="' + idx + '" data-field="' + fieldKey + '">\
        <strong>Drag and drop image here</strong>\
        or click to choose from your device\
      </div>\
      <input class="admin-file-input" type="file" accept="image/*" data-upload-file data-section="' + section + '" data-index="' + idx + '" data-field="' + fieldKey + '" />\
      <div class="admin-upload-note">Tip: Uploading will auto-fill this field with the image data URL.</div>\
    </div>';
  };

  var makeFields = function(fields, section, idx) {
    return fields
      .map(function(f) {
        var fieldHtml =
          f.type === 'textarea'
            ? '<textarea data-section="' + section + '" data-index="' + idx + '" data-field="' + f.key + '">' + escapeHtml(f.value) + '</textarea>'
            : '<input data-section="' + section + '" data-index="' + idx + '" data-field="' + f.key + '" value="' + escapeHtml(f.value) + '" />';
        var uploadHtml = imageFieldKeys.has(f.key) ? buildUploadUi(section, idx, f.key) : '';
        return '<label>' + f.label + '</label>' + fieldHtml + uploadHtml;
      })
      .join('');
  };

  var eventForms = siteData.events
    .map(function(e, idx) {
      return '\
    <div class="admin-section-form">\
      <h4>Event ' + (idx + 1) + '</h4>\
      ' + makeFields(
        [
          { key: 'day', label: 'Day', value: e.day },
          { key: 'month', label: 'Month', value: e.month },
          { key: 'title', label: 'Title', value: e.title },
          { key: 'description', label: 'Description', value: e.description, type: 'textarea' },
          { key: 'tag', label: 'Tag', value: e.tag },
          { key: 'buttonText', label: 'Button Text', value: e.buttonText || '' },
          { key: 'link', label: 'Button Link', value: e.link || '' }
        ],
        'events',
        idx
      ) + '\
      <div class="admin-inline-actions">\
        <button type="button" class="btn-ghost" data-action="delete" data-section="events" data-index="' + idx + '">Delete</button>\
      </div>\
    </div>';
    })
    .join('');

  var boardForms = siteData.boardMembers
    .map(function(m, idx) {
      return '\
    <div class="admin-section-form">\
      <h4>Board Member ' + (idx + 1) + '</h4>\
      ' + makeFields(
        [
          { key: 'name', label: 'Name', value: m.name },
          { key: 'role', label: 'Role', value: m.role },
          { key: 'bio', label: 'Bio', value: m.bio, type: 'textarea' },
          { key: 'image', label: 'Image URL', value: m.image }
        ],
        'boardMembers',
        idx
      ) + '\
      <div class="admin-inline-actions">\
        <button type="button" class="btn-ghost" data-action="delete" data-section="boardMembers" data-index="' + idx + '">Delete</button>\
      </div>\
    </div>';
    })
    .join('');

  var galleryForms = siteData.galleryImages
    .map(function(g, idx) {
      return '\
    <div class="admin-section-form">\
      <h4>Gallery Image ' + (idx + 1) + '</h4>\
      ' + makeFields(
        [
          { key: 'src', label: 'Image URL', value: g.src },
          { key: 'alt', label: 'Alt Text', value: g.alt }
        ],
        'galleryImages',
        idx
      ) + '\
      <div class="admin-inline-actions">\
        <button type="button" class="btn-ghost" data-action="delete" data-section="galleryImages" data-index="' + idx + '">Delete</button>\
      </div>\
    </div>';
    })
    .join('');

  var tabs = [
    { id: 'events', label: 'Events' },
    { id: 'boardMembers', label: 'Board Members' },
    { id: 'galleryImages', label: 'Gallery Photos' }
  ];

  var tabButtons = tabs
    .map(function(tab) {
      return '<button type="button" class="admin-tab-btn ' + (adminActiveTab === tab.id ? 'active' : '') + '" data-admin-tab="' + tab.id + '">' + tab.label + '</button>';
    })
    .join('');

  var groupSection = function(id, title, addLabel, forms) {
    return '\
    <section class="admin-group ' + (adminActiveTab === id ? 'active' : '') + '" data-admin-group="' + id + '">\
      <div class="admin-group-header">\
        <h4>' + title + '</h4>\
        <button type="button" class="btn-primary admin-toolbar-btn" data-action="add" data-section="' + id + '">' + addLabel + '</button>\
      </div>\
      ' + forms + '\
    </section>';
  };

  root.innerHTML =
    '<p class="admin-direct-hint">Select a tab, then edit values. Drag-and-drop image uploads are supported in image fields.</p>' +
    '<div class="admin-top-tabs">' + tabButtons + '</div>' +
    groupSection('events', 'Events', 'Add Event', eventForms) +
    groupSection('boardMembers', 'Board Members', 'Add Member', boardForms) +
    groupSection('galleryImages', 'Gallery Images', 'Add Gallery Image', galleryForms);
}

function getUploadZone(section, index, field) {
  var root = document.getElementById('admin-dynamic-forms');
  if (!root) return null;
  return root.querySelector(
    '[data-upload-zone][data-section="' + section + '"][data-index="' + index + '"][data-field="' + field + '"]'
  );
}

function setUploadState(zone, state, text) {
  if (!zone || !zone.classList) return;
  zone.classList.remove('upload-loading', 'upload-done', 'upload-warning', 'upload-error');
  if (state) zone.classList.add('upload-' + state);
  if (text !== undefined && zone.querySelector) {
    var strong = zone.querySelector('strong');
    if (strong) strong.textContent = text;
  }
}

function processImageUpload(file, section, index, field) {
  var zone = getUploadZone(section, index, field);
  if (!file || !file.type.startsWith('image/')) {
    if (zone) setUploadState(zone, 'none', 'Drag and drop image here');
    return;
  }
  setUploadState(zone, 'loading', 'Uploading…');
  var reader = new FileReader();
  reader.onload = function() {
    if (!siteData[section]?.[index]) return;
    siteData[section][index][field] = String(reader.result || '');
    setUploadState(zone, 'done', file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)');
    renderAllDynamicSections();
    renderAdminForms();
  };
  reader.onerror = function() {
    setUploadState(zone, 'error', 'Upload failed, try again');
  };
  reader.readAsDataURL(file);
}

function bindAdminForms() {
  var root = document.getElementById('admin-dynamic-forms');
  if (!root) return;

  root.addEventListener('input', function(event) {
    var target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    var section = target.dataset.section;
    var index = Number(target.dataset.index);
    var field = target.dataset.field;
    if (!section || Number.isNaN(index) || !field || !siteData[section]?.[index]) return;
    siteData[section][index][field] = target.value;
    renderAllDynamicSections();
  });

  root.addEventListener('change', function(event) {
    var target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.matches('[data-upload-file]')) return;
    var section = target.dataset.section;
    var index = Number(target.dataset.index);
    var field = target.dataset.field;
    var file = target.files?.[0];
    if (!section || Number.isNaN(index) || !field) return;
    processImageUpload(file, section, index, field);
  });

  root.addEventListener('click', function(event) {
    var tabBtn = event.target.closest('button[data-admin-tab]');
    if (tabBtn) {
      adminActiveTab = tabBtn.dataset.adminTab || 'newsletters';
      renderAdminForms();
      return;
    }

    var uploadZone = event.target.closest('[data-upload-zone]');
    if (uploadZone) {
      var section = uploadZone.dataset.section;
      var index = uploadZone.dataset.index;
      var field = uploadZone.dataset.field;
      var fileInput = root.querySelector(
        '[data-upload-file][data-section="' + section + '"][data-index="' + index + '"][data-field="' + field + '"]'
      );
      fileInput?.click();
      return;
    }

    var btn = event.target.closest('button[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;
    var section = btn.dataset.section;
    var index = Number(btn.dataset.index);
    if (!section || !Array.isArray(siteData[section])) return;

    if (action === 'delete' && !Number.isNaN(index)) {
      siteData[section].splice(index, 1);
    }
    if (action === 'add') {
      if (section === 'events') {
        siteData.events.push({
          id: crypto.randomUUID(),
          day: '01',
          month: 'Jan',
          title: 'New Event',
          description: 'Event description.',
          tag: 'Event',
          buttonText: '',
          link: ''
        });
      }
      if (section === 'boardMembers') {
        siteData.boardMembers.push({
          id: crypto.randomUUID(),
          name: 'New Member',
          role: 'Role',
          bio: 'Executive Board Member',
          image: ''
        });
      }
      if (section === 'galleryImages') {
        siteData.galleryImages.push({
          id: crypto.randomUUID(),
          src: '',
          alt: 'SSA gallery image'
        });
      }
    }

    renderAllDynamicSections();
    renderAdminForms();
  });

  root.addEventListener('dragover', function(event) {
    var zone = event.target.closest('[data-upload-zone]');
    if (!zone) return;
    event.preventDefault();
    zone.classList.add('dragover');
  });

  root.addEventListener('dragleave', function(event) {
    var zone = event.target.closest('[data-upload-zone]');
    if (!zone) return;
    zone.classList.remove('dragover');
  });

  root.addEventListener('drop', function(event) {
    var zone = event.target.closest('[data-upload-zone]');
    if (!zone) return;
    event.preventDefault();
    zone.classList.remove('dragover');
    var file = event.dataTransfer?.files?.[0];
    var section = zone.dataset.section;
    var index = Number(zone.dataset.index);
    var field = zone.dataset.field;
    if (!section || Number.isNaN(index) || !field) return;
    processImageUpload(file, section, index, field);
  });
}

function setupAdminPanel() {
  var panel = document.getElementById('admin-panel');
  var entry = document.getElementById('admin-entry');
  var closeBtn = document.getElementById('admin-close');
  var unlockBtn = document.getElementById('admin-unlock');
  var loginWrap = document.getElementById('admin-login');
  var toolsWrap = document.getElementById('admin-tools');
  var passwordInput = document.getElementById('admin-password');
  var loginMessage = document.getElementById('admin-login-message');
  var saveAllBtn = document.getElementById('admin-save-all');
  var logoutBtn = document.getElementById('admin-logout');
  var toggleDirectEditBtn = document.getElementById('admin-toggle-direct-edit');

  if (!panel || !entry) return;

  var syncAdminUi = function() {
    loginWrap.hidden = adminUnlocked;
    toolsWrap.hidden = !adminUnlocked;
    if (adminUnlocked) renderAdminForms();
  };

  entry.addEventListener('click', function(e) {
    var href = entry.getAttribute('href') || '';
    if (href && href !== '#') return;
    e.preventDefault();
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    syncAdminUi();
  });

  closeBtn?.addEventListener('click', function() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  });

  panel.querySelector('.admin-backdrop')?.addEventListener('click', function() {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  });

  unlockBtn?.addEventListener('click', function() {
    if ((passwordInput?.value || '') === ADMIN_PASSWORD) {
      adminUnlocked = true;
      sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
      loginMessage.textContent = 'Admin mode unlocked.';
      passwordInput.value = '';
      syncAdminUi();
    } else {
      loginMessage.textContent = 'Incorrect password.';
    }
  });

  saveAllBtn?.addEventListener('click', function() {
    captureDirectEdits();
    saveSiteData();
    renderAllDynamicSections();
    alert('Saved. Your updates persist in this browser.');
  });

  logoutBtn?.addEventListener('click', function() {
    adminUnlocked = false;
    directEditEnabled = false;
    setDirectEditEnabled(false);
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    syncAdminUi();
  });

  toggleDirectEditBtn?.addEventListener('click', function() {
    directEditEnabled = !directEditEnabled;
    setDirectEditEnabled(directEditEnabled);
    toggleDirectEditBtn.textContent = directEditEnabled ? 'Disable Direct Text Edit' : 'Enable Direct Text Edit';
  });

  syncAdminUi();
}
