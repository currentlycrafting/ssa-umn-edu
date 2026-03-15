const STORAGE_KEY = 'ssaSiteContentV1';
const ADMIN_SESSION_KEY = 'ssaAdminUnlocked';
const ADMIN_PASSWORD = 'ssa2026';

const defaultData = {
  newsletters: [
    {
      id: crypto.randomUUID(),
      title: 'February Newsletter',
      date: 'February 2026',
      description:
        'On February 23rd, we hosted our annual Ramadan dinner for the Somali student boards in collaboration with SIBAT, SAPHS, SIS, SSC, and SPDA. We were honored to have Sheikh Hamad as our guest speaker. He gave a meaningful lecture on Islam, youth, and how to balance faith and school life. It was a beautiful evening of community, reflection, and connection during Ramadan.\n\nOn February 24th, we were honored to speak at the BSU annual Unity Dinner. Their event was dedicated to celebrating community and being together.\n\nOn February 26th, we hosted our Muslim Ramadan Dinner in collaboration with MPMA, AMC, MAS, and MBA. The evening was a meaningful opportunity to reflect and come together as a community during this blessed month. We were especially honored to welcome Ahmed Billo as our guest speaker.\n\nOn February 20th, we held Melting Points: ICE Out in collaboration with Mi Gente and the Black Student Union. We discussed how the presence of ICE on campus is impacting our respective communities and the student body as a whole. Students came together to vent, discuss, and find community.',
      image: 'newsletter-images/newsletter.png',
      link: 'https://www.instagram.com/p/DVmjjfGDhtk/',
      secondaryLink: 'https://www.instagram.com/p/DVsD4UoDmTX/'
    }
  ],
  events: [
    {
      id: crypto.randomUUID(),
      day: '03',
      month: 'Apr',
      title: 'Somali Night 2025',
      description: 'Northrop Auditorium - Annual Flagship Cultural Production',
      tag: 'Flagship',
      buttonText: '',
      link: ''
    },
    {
      id: crypto.randomUUID(),
      day: '20',
      month: 'Apr',
      title: 'Senior Night Gala',
      description: 'TBA',
      tag: 'Members',
      buttonText: 'RSVP Form',
      link: 'https://docs.google.com/forms/d/e/1FAIpQLScq-2fmzfquFErTorYbyMY7rWBGcTAWJrTDQiOu_WGB3a6Jgw/viewform'
    }
  ],
  boardMembers: [
    { id: crypto.randomUUID(), name: 'Aisha Dakol', role: 'Vice President', major: '', image: 'board-images/Aisha Dakol - Vice President.png' },
    { id: crypto.randomUUID(), name: 'Dahir Munye', role: 'President', major: '', image: 'board-images/Dahir Munye - President.png' },
    { id: crypto.randomUUID(), name: 'Salman Said', role: 'Co-Committee Chair', major: '', image: 'board-images/Salman Said - Co-Committee Chair.png' },
    { id: crypto.randomUUID(), name: 'Ruweyda Warsame', role: 'Co-Committee Chair', major: '', image: 'board-images/Ruweyda Warsame - Co-Committee Chair.png' },
    { id: crypto.randomUUID(), name: 'Ikhlas Abdi', role: 'Outreach Coordinator', major: '', image: 'board-images/Ikhlas Abdi - Outreach Coordinator.png' },
    { id: crypto.randomUUID(), name: 'Ifrah Ali', role: 'Treasurer', major: '', image: 'board-images/Ifrah Ali - Treasurer.png' },
    { id: crypto.randomUUID(), name: 'Layla Salad', role: 'Co-Event Coordinator', major: '', image: 'board-images/Layla Salad - Co-Event Coordinator.png' },
    { id: crypto.randomUUID(), name: 'Ahlam Abdul', role: 'Co-Event Coordinator', major: '', image: 'board-images/Ahlam Abdul - Co-Event Coordinator.png' },
    { id: crypto.randomUUID(), name: 'Salma Tawane', role: 'Secretary', major: '', image: 'board-images/Salma Tawane - Secretary.png' },
    { id: crypto.randomUUID(), name: 'Maida Ahmed', role: 'Co-Public Relations', major: '', image: 'board-images/Maida Ahmed - Co-Public Relations.png' },
    { id: crypto.randomUUID(), name: 'Ashaar Ali', role: 'Co-Public Relations', major: '', image: 'board-images/Ashaar Ali - Co-Public Relations.png' }
  ],
  galleryImages: [
    { id: crypto.randomUUID(), src: 'gallery/100_0556.JPG', alt: 'SSA community' },
    { id: crypto.randomUUID(), src: 'gallery/100_0591.JPG', alt: 'SSA community' },
    { id: crypto.randomUUID(), src: 'gallery/100_0626.JPG', alt: 'SSA community' },
    { id: crypto.randomUUID(), src: 'gallery/100_0628.JPG', alt: 'SSA community' },
    { id: crypto.randomUUID(), src: 'gallery/100_0913.JPEG', alt: 'SSA group photo' },
    { id: crypto.randomUUID(), src: 'gallery/100_1012.JPG', alt: 'SSA event' },
    { id: crypto.randomUUID(), src: 'gallery/100_1179.JPG', alt: 'SSA event' },
    { id: crypto.randomUUID(), src: 'gallery/100_1734.JPG', alt: 'SSA event' },
    { id: crypto.randomUUID(), src: 'gallery/100_1759.JPG', alt: 'SSA event' },
    { id: crypto.randomUUID(), src: 'gallery/100_1763.JPG', alt: 'SSA event' },
    { id: crypto.randomUUID(), src: 'gallery/IMG_3253.JPG', alt: 'SSA members' },
    { id: crypto.randomUUID(), src: 'gallery/IMG_3565.jpeg', alt: 'SSA gathering' },
    { id: crypto.randomUUID(), src: 'gallery/IMG_6147.JPG', alt: 'SSA gathering' },
    { id: crypto.randomUUID(), src: 'gallery/guys02.JPG', alt: 'SSA community' },
    { id: crypto.randomUUID(), src: 'gallery/khalid-hanan.JPG', alt: 'SSA members' },
    { id: crypto.randomUUID(), src: 'gallery/team01.JPG', alt: 'SSA event' }
  ],
  directText: {},
  editableLinks: {},
  editableImages: {}
};

let siteData = loadSiteData();
let serverSiteContent = { galleryImages: null, boardMembers: null, newsletters: null };
let adminUnlocked = sessionStorage.getItem(ADMIN_SESSION_KEY) === '1';
let directEditEnabled = false;
let adminActiveTab = 'newsletters';

function loadSiteData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultData);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultData),
      ...parsed,
      newsletters: parsed.newsletters?.length ? parsed.newsletters : structuredClone(defaultData.newsletters),
      events: parsed.events?.length ? parsed.events : structuredClone(defaultData.events),
      boardMembers: parsed.boardMembers?.length ? parsed.boardMembers : structuredClone(defaultData.boardMembers),
      galleryImages: parsed.galleryImages?.length ? parsed.galleryImages : structuredClone(defaultData.galleryImages),
      directText: parsed.directText || {},
      editableLinks: parsed.editableLinks || {},
      editableImages: parsed.editableImages || {}
    };
  } catch (_e) {
    return structuredClone(defaultData);
  }
}

function saveSiteData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(siteData));
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function linkifyText(text) {
  const escaped = escapeHtml(text);
  const withLinks = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return withLinks.replaceAll('\n', '<br />');
}

function toInstagramEmbedUrl(link) {
  if (!link || !/instagram\.com\/p\//.test(link)) return '';
  const normalized = link.endsWith('/') ? link : `${link}/`;
  return `${normalized}embed`;
}

function renderEvents() {
  const eventsList = document.getElementById('events-list');
  if (!eventsList) return;

  eventsList.innerHTML = siteData.events
    .map((event) => {
      const actionHtml = event.link
        ? `<div class="event-row-actions"><a href="${escapeHtml(event.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(event.buttonText || 'Learn More')}</a></div>`
        : '';

      return `
      <div class="event-row">
        <div class="event-date">
          <div class="event-date-day">${escapeHtml(event.day)}</div>
          <div class="event-date-month">${escapeHtml(event.month)}</div>
        </div>
        <div class="event-details">
          <h3>${escapeHtml(event.title)}</h3>
          <p>${escapeHtml(event.description)}</p>
          ${actionHtml}
        </div>
        <div class="event-row-tag">${escapeHtml(event.tag || 'Event')}</div>
      </div>`;
    })
    .join('');
}

function renderNewsletters() {
  const list = document.getElementById('newsletter-list');
  if (!list) return;

  const newsletters = Array.isArray(serverSiteContent.newsletters) && serverSiteContent.newsletters.length > 0
    ? serverSiteContent.newsletters
    : siteData.newsletters;

  list.innerHTML = newsletters
    .map((item, idx) => {
      const imageHtml = item.image
        ? `<div class="newsletter-media-col"><button type="button" class="newsletter-card-media-wrap" aria-label="View full size" onclick="var i=this.querySelector('img');if(i&&window.openImageLightbox)window.openImageLightbox(i.src,i.alt)"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" class="newsletter-card-media" loading="lazy" /></button></div>`
        : '';
      const primaryUrl = toInstagramEmbedUrl(item.link);
      const secondaryRaw = item.secondaryLink || (idx === 0 ? 'https://www.instagram.com/p/DVsD4UoDmTX/' : '');
      const secondaryUrl = toInstagramEmbedUrl(secondaryRaw);
      const linkHtml = item.link
        ? `<a class="btn-ghost newsletter-read-more admin-editable-link" data-link-key="newsletter-${escapeHtml(item.id)}" href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">Read More</a>`
        : '';
      const topRow = `
        <div class="newsletter-top-row">
          ${imageHtml || '<div class="newsletter-media-col newsletter-media-placeholder"></div>'}
          <div class="newsletter-content-col">
            <p>${linkifyText(item.description)}</p>
          </div>
        </div>`;
      let bottomRow = '';
      const embedUrls = [primaryUrl, secondaryUrl].filter(Boolean);
      if (embedUrls.length) {
        const embedsHtml = embedUrls
          .map(
            (url) => `
            <div class="newsletter-embed-wrap">
              <iframe class="newsletter-embed-frame" src="${escapeHtml(url)}" loading="lazy" allowfullscreen title="Instagram video"></iframe>
            </div>`
          )
          .join('');
        bottomRow = `
          <div class="newsletter-bottom-row">
            <div class="newsletter-embed-row">
              ${embedsHtml}
            </div>
            ${linkHtml}
          </div>`;
      } else if (linkHtml) {
        bottomRow = `
          <div class="newsletter-bottom-row">
            <div class="newsletter-embed-wrap">
              ${linkHtml}
            </div>
          </div>`;
      }
      return `
      <article class="newsletter-card">
        <div class="newsletter-card-head">
          <h3>${escapeHtml(item.title)}</h3>
          <span class="newsletter-card-date">${escapeHtml(item.date)}</span>
        </div>
        <div class="newsletter-card-body">
          ${topRow}
          ${bottomRow}
        </div>
      </article>`;
    })
    .join('');
}

function getBoardMembers() {
  const fromServer = serverSiteContent.boardMembers;
  const fromLocal = siteData.boardMembers;
  const members =
    fromServer && fromServer.length
      ? fromServer
      : fromLocal && fromLocal.length
        ? fromLocal
        : structuredClone(defaultData.boardMembers);
  return (members || []).filter((m) => String(m.image || '').replace(/^\/+/, '').startsWith('board-images/'));
}
function getGalleryImages() {
  const fromServer = serverSiteContent.galleryImages;
  const fromLocal = siteData.galleryImages;
  const images =
    fromServer && fromServer.length
      ? fromServer
      : fromLocal && fromLocal.length
        ? fromLocal
        : structuredClone(defaultData.galleryImages);
  return (images || []).filter((img) => String(img.src || '').replace(/^\/+/, '').startsWith('gallery/'));
}

function renderBoard() {
  const boardGrid = document.getElementById('leadership-grid');
  if (!boardGrid) return;
  const members = getBoardMembers();
  boardGrid.innerHTML = members
    .map((member) => {
      const mobileClasses = [];
      const lowerName = member.name.toLowerCase();
      if (lowerName.includes('ifrah')) mobileClasses.push('leader-photo-ifrah');
      if (lowerName.includes('layla')) mobileClasses.push('leader-photo-layla');
      if (
        lowerName.includes('ruweyda') ||
        lowerName.includes('salman') ||
        lowerName.includes('ikhlas') ||
        lowerName.includes('maida') ||
        lowerName.includes('ashaar') ||
        lowerName.includes('salma') ||
        lowerName.includes('aisha') ||
        lowerName.includes('dahir') ||
        lowerName.includes('ahlam')
      ) {
        mobileClasses.push('leader-photo-mobile-higher');
      }
      const imageSrc = member.image ? member.image.replace(/^\//, '') : '';
      return `
      <div class="leader-card">
        <div class="leader-card-image">
          <img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(member.name)}" class="${mobileClasses.join(' ')}" loading="lazy" />
          <div class="leader-card-overlay">
            <div class="leader-name">${escapeHtml(member.name)}</div>
            <div class="leader-role">${escapeHtml(member.role || 'Executive Board Member')}</div>
          </div>
        </div>
        <div class="leader-card-info">
          <p>${escapeHtml(member.major || member.bio || 'Executive Board Member')}</p>
        </div>
      </div>`;
    })
    .join('');
}

function renderGallery() {
  const homeGrid = document.getElementById('gallery-grid');
  const fullGrid = document.getElementById('full-gallery-grid');
  if (!homeGrid || !fullGrid) return;

  const renderItems = (items) =>
    items
      .map(
        (img) => `
      <div class="gallery-item">
        <img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt || '')}" />
      </div>`
      )
      .join('');

  const images = getGalleryImages();
  homeGrid.innerHTML = renderItems(images.slice(0, 3));
  fullGrid.innerHTML = renderItems(images);
}

function assignDirectEditableElements() {
  const selectors = [
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
  const nodes = document.querySelectorAll(selectors.join(', '));
  nodes.forEach((node, idx) => {
    node.setAttribute('data-admin-direct-edit', 'true');
    if (!node.dataset.directEditId) node.dataset.directEditId = `text-${idx}`;
  });
}

function applyDirectText() {
  Object.entries(siteData.directText).forEach(([key, value]) => {
    const el = document.querySelector(`[data-direct-edit-id="${key}"]`);
    if (el) el.innerHTML = value;
  });
}

function applyEditableAssets() {
  document.querySelectorAll('[data-link-key]').forEach((link) => {
    const key = link.dataset.linkKey;
    const saved = siteData.editableLinks[key];
    if (!saved) return;
    if (saved.href) link.href = saved.href;
    if (saved.text) link.textContent = saved.text;
  });

  document.querySelectorAll('[data-image-key]').forEach((image) => {
    const key = image.dataset.imageKey;
    const saved = siteData.editableImages[key];
    if (saved?.src) image.src = saved.src;
  });
}

function setDirectEditEnabled(enabled) {
  directEditEnabled = enabled;
  document.body.classList.toggle('admin-direct-edit', enabled);
  document.querySelectorAll('[data-admin-direct-edit="true"]').forEach((el) => {
    el.contentEditable = enabled ? 'true' : 'false';
    el.spellcheck = enabled;
  });
}

function wireDirectEditInteractions() {
  document.addEventListener('click', (event) => {
    if (!directEditEnabled) return;

    const image = event.target.closest('.admin-editable-image');
    if (image) {
      event.preventDefault();
      const nextSrc = prompt('Image URL', image.getAttribute('src') || '');
      if (nextSrc) image.setAttribute('src', nextSrc.trim());
      return;
    }

    const link = event.target.closest('.admin-editable-link');
    if (link) {
      event.preventDefault();
      const nextHref = prompt('Button/link URL', link.getAttribute('href') || '');
      if (nextHref) link.setAttribute('href', nextHref.trim());
      const nextText = prompt('Button/link text', link.textContent || '');
      if (nextText) link.textContent = nextText.trim();
    }
  });
}

function captureDirectEdits() {
  siteData.directText = {};
  document.querySelectorAll('[data-admin-direct-edit="true"]').forEach((el) => {
    siteData.directText[el.dataset.directEditId] = el.innerHTML;
  });

  siteData.editableLinks = {};
  document.querySelectorAll('[data-link-key]').forEach((link) => {
    siteData.editableLinks[link.dataset.linkKey] = {
      href: link.getAttribute('href') || '',
      text: link.textContent?.trim() || ''
    };
  });

  siteData.editableImages = {};
  document.querySelectorAll('[data-image-key]').forEach((img) => {
    siteData.editableImages[img.dataset.imageKey] = {
      src: img.getAttribute('src') || ''
    };
  });
}

function renderAdminForms() {
  const root = document.getElementById('admin-dynamic-forms');
  if (!root || !adminUnlocked) return;

  const imageFieldKeys = new Set(['image', 'src']);
  const buildUploadUi = (section, idx, fieldKey) => `
    <div class="admin-upload-wrap">
      <div class="admin-upload-zone" data-upload-zone data-section="${section}" data-index="${idx}" data-field="${fieldKey}">
        <strong>Drag and drop image here</strong>
        or click to choose from your device
      </div>
      <input class="admin-file-input" type="file" accept="image/*" data-upload-file data-section="${section}" data-index="${idx}" data-field="${fieldKey}" />
      <div class="admin-upload-note">Tip: Uploading will auto-fill this field with the image data URL.</div>
    </div>
  `;

  const makeFields = (fields, section, idx) =>
    fields
      .map((f) => {
        const fieldHtml =
          f.type === 'textarea'
            ? `<textarea data-section="${section}" data-index="${idx}" data-field="${f.key}">${escapeHtml(f.value)}</textarea>`
            : `<input data-section="${section}" data-index="${idx}" data-field="${f.key}" value="${escapeHtml(f.value)}" />`;
        const uploadHtml = imageFieldKeys.has(f.key) ? buildUploadUi(section, idx, f.key) : '';
        return `
      <label>${f.label}</label>
      ${fieldHtml}
      ${uploadHtml}`;
      })
      .join('');

  const newsletterForms = siteData.newsletters
    .map(
      (n, idx) => `
    <div class="admin-section-form">
      <h4>Newsletter ${idx + 1}</h4>
      ${makeFields(
        [
          { key: 'title', label: 'Title', value: n.title },
          { key: 'date', label: 'Date', value: n.date },
          { key: 'description', label: 'Description', value: n.description, type: 'textarea' },
          { key: 'image', label: 'Image URL', value: n.image },
          { key: 'link', label: 'Primary Link URL', value: n.link },
          { key: 'secondaryLink', label: 'Secondary Instagram Link URL', value: n.secondaryLink || '' }
        ],
        'newsletters',
        idx
      )}
      <div class="admin-inline-actions">
        <button type="button" class="btn-ghost" data-action="delete" data-section="newsletters" data-index="${idx}">Delete</button>
      </div>
    </div>`
    )
    .join('');

  const eventForms = siteData.events
    .map(
      (e, idx) => `
    <div class="admin-section-form">
      <h4>Event ${idx + 1}</h4>
      ${makeFields(
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
      )}
      <div class="admin-inline-actions">
        <button type="button" class="btn-ghost" data-action="delete" data-section="events" data-index="${idx}">Delete</button>
      </div>
    </div>`
    )
    .join('');

  const boardForms = siteData.boardMembers
    .map(
      (m, idx) => `
    <div class="admin-section-form">
      <h4>Board Member ${idx + 1}</h4>
      ${makeFields(
        [
          { key: 'name', label: 'Name', value: m.name },
          { key: 'role', label: 'Role', value: m.role },
          { key: 'bio', label: 'Bio', value: m.bio, type: 'textarea' },
          { key: 'image', label: 'Image URL', value: m.image }
        ],
        'boardMembers',
        idx
      )}
      <div class="admin-inline-actions">
        <button type="button" class="btn-ghost" data-action="delete" data-section="boardMembers" data-index="${idx}">Delete</button>
      </div>
    </div>`
    )
    .join('');

  const galleryForms = siteData.galleryImages
    .map(
      (g, idx) => `
    <div class="admin-section-form">
      <h4>Gallery Image ${idx + 1}</h4>
      ${makeFields(
        [
          { key: 'src', label: 'Image URL', value: g.src },
          { key: 'alt', label: 'Alt Text', value: g.alt }
        ],
        'galleryImages',
        idx
      )}
      <div class="admin-inline-actions">
        <button type="button" class="btn-ghost" data-action="delete" data-section="galleryImages" data-index="${idx}">Delete</button>
      </div>
    </div>`
    )
    .join('');

  const tabs = [
    { id: 'newsletters', label: 'Newsletters' },
    { id: 'events', label: 'Events' },
    { id: 'boardMembers', label: 'Board Members' },
    { id: 'galleryImages', label: 'Gallery Photos' }
  ];

  const tabButtons = tabs
    .map(
      (tab) =>
        `<button type="button" class="admin-tab-btn ${adminActiveTab === tab.id ? 'active' : ''}" data-admin-tab="${tab.id}">${tab.label}</button>`
    )
    .join('');

  const groupSection = (id, title, addLabel, forms) => `
    <section class="admin-group ${adminActiveTab === id ? 'active' : ''}" data-admin-group="${id}">
      <div class="admin-group-header">
        <h4>${title}</h4>
        <button type="button" class="btn-primary admin-toolbar-btn" data-action="add" data-section="${id}">${addLabel}</button>
      </div>
      ${forms}
    </section>
  `;

  root.innerHTML = `
    <p class="admin-direct-hint">Select a tab, then edit values. Drag-and-drop image uploads are supported in image fields.</p>
    <div class="admin-top-tabs">
      ${tabButtons}
    </div>
    ${groupSection('newsletters', 'Newsletters', 'Add Newsletter', newsletterForms)}
    ${groupSection('events', 'Events', 'Add Event', eventForms)}
    ${groupSection('boardMembers', 'Board Members', 'Add Member', boardForms)}
    ${groupSection('galleryImages', 'Gallery Images', 'Add Gallery Image', galleryForms)}
  `;
}

function getUploadZone(section, index, field) {
  const root = document.getElementById('admin-dynamic-forms');
  if (!root) return null;
  return root.querySelector(
    `[data-upload-zone][data-section="${section}"][data-index="${index}"][data-field="${field}"]`
  );
}

function setUploadState(zone, state, text) {
  if (!zone || !zone.classList) return;
  zone.classList.remove('upload-loading', 'upload-done', 'upload-warning', 'upload-error');
  if (state) zone.classList.add('upload-' + state);
  if (text !== undefined && zone.querySelector) {
    const strong = zone.querySelector('strong');
    if (strong) strong.textContent = text;
  }
}

function processImageUpload(file, section, index, field) {
  const zone = getUploadZone(section, index, field);
  if (!file || !file.type.startsWith('image/')) {
    if (zone) setUploadState(zone, 'none', 'Drag and drop image here');
    return;
  }
  setUploadState(zone, 'loading', 'Uploading…');
  const reader = new FileReader();
  reader.onload = () => {
    if (!siteData[section]?.[index]) return;
    siteData[section][index][field] = String(reader.result || '');
    setUploadState(zone, 'done', file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)');
    renderAllDynamicSections();
    renderAdminForms();
  };
  reader.onerror = () => {
    setUploadState(zone, 'error', 'Upload failed, try again');
  };
  reader.readAsDataURL(file);
}

function bindAdminForms() {
  const root = document.getElementById('admin-dynamic-forms');
  if (!root) return;

  root.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    const section = target.dataset.section;
    const index = Number(target.dataset.index);
    const field = target.dataset.field;
    if (!section || Number.isNaN(index) || !field || !siteData[section]?.[index]) return;
    siteData[section][index][field] = target.value;
    renderAllDynamicSections();
  });

  root.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.matches('[data-upload-file]')) return;
    const section = target.dataset.section;
    const index = Number(target.dataset.index);
    const field = target.dataset.field;
    const file = target.files?.[0];
    if (!section || Number.isNaN(index) || !field) return;
    processImageUpload(file, section, index, field);
  });

  root.addEventListener('click', (event) => {
    const tabBtn = event.target.closest('button[data-admin-tab]');
    if (tabBtn) {
      adminActiveTab = tabBtn.dataset.adminTab || 'newsletters';
      renderAdminForms();
      return;
    }

    const uploadZone = event.target.closest('[data-upload-zone]');
    if (uploadZone) {
      const section = uploadZone.dataset.section;
      const index = uploadZone.dataset.index;
      const field = uploadZone.dataset.field;
      const fileInput = root.querySelector(
        `[data-upload-file][data-section="${section}"][data-index="${index}"][data-field="${field}"]`
      );
      fileInput?.click();
      return;
    }

    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const section = btn.dataset.section;
    const index = Number(btn.dataset.index);
    if (!section || !Array.isArray(siteData[section])) return;

    if (action === 'delete' && !Number.isNaN(index)) {
      siteData[section].splice(index, 1);
    }
    if (action === 'add') {
      if (section === 'newsletters') {
        siteData.newsletters.push({
          id: crypto.randomUUID(),
          title: 'New Newsletter',
          date: 'Month Year',
          description: 'Write your newsletter update here.',
          image: '',
          link: '',
          secondaryLink: ''
        });
      }
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

  root.addEventListener('dragover', (event) => {
    const zone = event.target.closest('[data-upload-zone]');
    if (!zone) return;
    event.preventDefault();
    zone.classList.add('dragover');
  });

  root.addEventListener('dragleave', (event) => {
    const zone = event.target.closest('[data-upload-zone]');
    if (!zone) return;
    zone.classList.remove('dragover');
  });

  root.addEventListener('drop', (event) => {
    const zone = event.target.closest('[data-upload-zone]');
    if (!zone) return;
    event.preventDefault();
    zone.classList.remove('dragover');
    const file = event.dataTransfer?.files?.[0];
    const section = zone.dataset.section;
    const index = Number(zone.dataset.index);
    const field = zone.dataset.field;
    if (!section || Number.isNaN(index) || !field) return;
    processImageUpload(file, section, index, field);
  });
}

function renderAllDynamicSections() {
  renderGallery();
  renderEvents();
  renderNewsletters();
  renderBoard();
}

function loadSiteContentFromServer() {
  fetch('/api/public/site-content')
    .then((r) => r.ok ? r.json() : null)
    .then((data) => {
      if (data) {
        if (Array.isArray(data.galleryImages)) serverSiteContent.galleryImages = data.galleryImages;
        if (Array.isArray(data.boardMembers)) serverSiteContent.boardMembers = data.boardMembers;
        if (Array.isArray(data.newsletters)) serverSiteContent.newsletters = data.newsletters;
        renderBoard();
        renderGallery();
        renderNewsletters();
      }
    })
    .catch(() => {
      renderBoard();
      renderGallery();
    });
}

function setupAdminPanel() {
  const panel = document.getElementById('admin-panel');
  const entry = document.getElementById('admin-entry');
  const closeBtn = document.getElementById('admin-close');
  const unlockBtn = document.getElementById('admin-unlock');
  const loginWrap = document.getElementById('admin-login');
  const toolsWrap = document.getElementById('admin-tools');
  const passwordInput = document.getElementById('admin-password');
  const loginMessage = document.getElementById('admin-login-message');
  const saveAllBtn = document.getElementById('admin-save-all');
  const logoutBtn = document.getElementById('admin-logout');
  const toggleDirectEditBtn = document.getElementById('admin-toggle-direct-edit');

  if (!panel || !entry) return;

  const syncAdminUi = () => {
    loginWrap.hidden = adminUnlocked;
    toolsWrap.hidden = !adminUnlocked;
    if (adminUnlocked) renderAdminForms();
  };

  entry.addEventListener('click', (e) => {
    const href = entry.getAttribute('href') || '';
    if (href && href !== '#') return;
    e.preventDefault();
    panel.classList.add('open');
    panel.setAttribute('aria-hidden', 'false');
    syncAdminUi();
  });

  closeBtn?.addEventListener('click', () => {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  });

  panel.querySelector('.admin-backdrop')?.addEventListener('click', () => {
    panel.classList.remove('open');
    panel.setAttribute('aria-hidden', 'true');
  });

  unlockBtn?.addEventListener('click', () => {
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

  saveAllBtn?.addEventListener('click', () => {
    captureDirectEdits();
    saveSiteData();
    renderAllDynamicSections();
    alert('Saved. Your updates persist in this browser.');
  });

  logoutBtn?.addEventListener('click', () => {
    adminUnlocked = false;
    directEditEnabled = false;
    setDirectEditEnabled(false);
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    syncAdminUi();
  });

  toggleDirectEditBtn?.addEventListener('click', () => {
    directEditEnabled = !directEditEnabled;
    setDirectEditEnabled(directEditEnabled);
    toggleDirectEditBtn.textContent = directEditEnabled ? 'Disable Direct Text Edit' : 'Enable Direct Text Edit';
  });

  syncAdminUi();
}

function setupScrollAndReveal() {
  const progressBar = document.getElementById('scroll-progress');
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (progressBar) {
      progressBar.style.width = `${(scrollTop / docHeight) * 100}%`;
    }
    const nav = document.getElementById('navbar');
    nav?.classList.toggle('scrolled', scrollTop > 80);
  });

  const reveals = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  reveals.forEach((el) => observer.observe(el));
}

function setupFullGalleryModal() {
  const openBtn = document.getElementById('open-full-gallery');
  const modal = document.getElementById('full-gallery-modal');
  const closeBtn = document.getElementById('close-full-gallery');
  const backdrop = document.querySelector('[data-close-full-gallery]');

  const openModal = () => {
    if (!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gallery-open');
  };
  const closeModal = () => {
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gallery-open');
  };

  openBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    openModal();
  });
  closeBtn?.addEventListener('click', closeModal);
  backdrop?.addEventListener('click', closeModal);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('open')) closeModal();
  });
}

function setupGalleryLightbox() {
  const lightbox = document.getElementById('gallery-lightbox');
  const lightboxImg = document.getElementById('gallery-lightbox-img');
  const closeBtn = document.getElementById('close-gallery-lightbox');
  const backdrop = document.querySelector('[data-close-lightbox]');

  const openLightbox = (src, alt) => {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxImg.alt = alt || 'Gallery image';
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gallery-open');
  };
  window.openImageLightbox = openLightbox;
  const closeLightbox = () => {
    if (!lightbox) return;
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gallery-open');
  };

  document.addEventListener('click', (e) => {
    const item = e.target.closest('.gallery-item');
    if (!item) return;
    const img = item.querySelector('img');
    if (!img) return;
    e.preventDefault();
    openLightbox(img.src, img.alt);
  });
  closeBtn?.addEventListener('click', closeLightbox);
  backdrop?.addEventListener('click', closeLightbox);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox?.classList.contains('open')) closeLightbox();
  });
}

function init() {
  renderAllDynamicSections();
  loadSiteContentFromServer();
  assignDirectEditableElements();
  applyDirectText();
  applyEditableAssets();
  bindAdminForms();
  wireDirectEditInteractions();
  setupAdminPanel();
  setupScrollAndReveal();
  setupFullGalleryModal();
  setupGalleryLightbox();
}

init();
