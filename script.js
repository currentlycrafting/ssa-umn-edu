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
      image: 'images/february-newsletter.png',
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
    { id: crypto.randomUUID(), name: 'Dahir Munye', role: 'President', bio: 'Executive Board Member', image: 'images/dahir-munye-president.png' },
    { id: crypto.randomUUID(), name: 'Aisha Dakol', role: 'Vice President', bio: 'Executive Board Member', image: 'images/aisha-dakol-vice-president.png' },
    { id: crypto.randomUUID(), name: 'Ifrah Ali', role: 'Treasurer', bio: 'Executive Board Member', image: 'images/ifrah-ali-treasurer.png' },
    { id: crypto.randomUUID(), name: 'Salma Tawane', role: 'Secretary', bio: 'Executive Board Member', image: 'images/salma-tawane-secretary.png' },
    { id: crypto.randomUUID(), name: 'Ahmed Abdul', role: 'Co-Event Coordinator', bio: 'Executive Board Member', image: 'images/ahmed-abdul-co-event-coordinator.png' },
    { id: crypto.randomUUID(), name: 'Layla Salad', role: 'Co-Event Coordinator', bio: 'Executive Board Member', image: 'images/layla-salad-co-event-coordinator.png' },
    { id: crypto.randomUUID(), name: 'Ashaar Ali', role: 'Co-Public Relations', bio: 'Executive Board Member', image: 'images/ashaar-ali-co-public-relations.png' },
    { id: crypto.randomUUID(), name: 'Maida Ahmed', role: 'Co-Public Relations', bio: 'Executive Board Member', image: 'images/maida-ahmed-co-public-relations.png' },
    { id: crypto.randomUUID(), name: 'Ikhlas Abdi', role: 'Outreach Coordinator', bio: 'Executive Board Member', image: 'images/ikhlas-abdi-outreach-coordinator.png' },
    { id: crypto.randomUUID(), name: 'Ruweyda Warsame', role: 'Co-Committee Chair', bio: 'Executive Board Member', image: 'images/ruweyda-warsame-co-committee-chair.png' },
    { id: crypto.randomUUID(), name: 'Salman Said', role: 'Co-Committee Chair', bio: 'Executive Board Member', image: 'images/salman-said-updated.png' }
  ],
  galleryImages: [
    { id: crypto.randomUUID(), src: 'images/100_0590-a7715620-22f8-45cc-9d10-6c90a634de5f.png', alt: 'SSA community' },
    { id: crypto.randomUUID(), src: 'images/100_0556-5d957b7a-d29f-4dbf-8090-2d1fecbb695a.png', alt: 'SSA community' },
    { id: crypto.randomUUID(), src: 'images/100_1179-b7bd434a-fa9a-4b92-b115-dc695ee82e60.png', alt: 'SSA group photo' },
    { id: crypto.randomUUID(), src: 'images/100_1756-6dd33dfc-a3d1-48dd-8da6-aa48cbf2bd6d.png', alt: 'SSA event' },
    { id: crypto.randomUUID(), src: 'images/100_0591-57b947a7-32e2-438b-8312-a561a871c9db.png', alt: 'SSA community' },
    { id: crypto.randomUUID(), src: 'images/100_1725-a9e13e0a-ed12-4f1a-b6b6-3613f75056df.png', alt: 'SSA stage' },
    { id: crypto.randomUUID(), src: 'images/100_0748-d66cb08f-b82f-4421-85e6-a7c04c19e243.png', alt: 'SSA event' },
    { id: crypto.randomUUID(), src: 'images/100_1920-7cba73e9-f11f-45db-a69e-a400955d7432.png', alt: 'SSA gathering' },
    { id: crypto.randomUUID(), src: 'images/100_1726-8ead709b-0b37-43d9-91a3-2410f0fc9e1b.png', alt: 'SSA community' },
    { id: crypto.randomUUID(), src: 'images/100_1737-3a4d4bc6-b18b-4703-8fc6-f83244c3664c.png', alt: 'SSA event' },
    { id: crypto.randomUUID(), src: 'images/100_0736-a1198205-08bf-43b3-b961-3919d842379d.png', alt: 'SSA members' },
    { id: crypto.randomUUID(), src: 'images/100_0626-e774bf69-7387-47a2-975c-e4ffb9c4ac80.png', alt: 'SSA community' },
    { id: crypto.randomUUID(), src: 'images/100_1727-4ca31c50-3130-4821-bec9-bb49ac0ddb1e.png', alt: 'SSA event' },
    { id: crypto.randomUUID(), src: 'images/100_1753-f253cb3c-cd86-4f31-8efc-6a2a97fbfe89.png', alt: 'SSA cultural event' },
    { id: crypto.randomUUID(), src: 'images/IMG_3252-da12d712-770e-4f2c-9917-06a22fca8739.png', alt: 'SSA members' },
    { id: crypto.randomUUID(), src: 'images/100_0628-dce7edc1-e2da-4068-af8d-b446fd4107a9.png', alt: 'SSA community' },
    { id: crypto.randomUUID(), src: 'images/100_1757-8f2a737d-0eed-4416-b7ba-573d60044558.png', alt: 'SSA event' },
    { id: crypto.randomUUID(), src: 'images/IMG_3267-9ac91dc2-23a9-4b4f-8b46-908f56fbe45e.png', alt: 'SSA gathering' },
    { id: crypto.randomUUID(), src: 'images/100_1724-79fac5d9-c824-40e6-b78e-240b41a5edcf.png', alt: 'SSA community' },
    { id: crypto.randomUUID(), src: 'images/100_1751-183423a3-6338-4ecf-82fe-faf357943ea8.png', alt: 'SSA event' },
    { id: crypto.randomUUID(), src: 'images/IMG_3253-9aa7fb1b-d417-4558-9a16-18b43870cf47.png', alt: 'SSA members' },
    { id: crypto.randomUUID(), src: 'images/IMG_6106-0ea29d18-bd68-4dbd-a6cd-6614a0458ea6.png', alt: 'SSA event' },
    { id: crypto.randomUUID(), src: 'images/IMG_2978-db443af7-655d-42cf-9f25-3e23a63374de.png', alt: 'SSA community' },
    { id: crypto.randomUUID(), src: 'images/IMG_5097-b2a0fa62-f94c-43c8-aed7-62d438bf9089.png', alt: 'SSA Nationals' },
    { id: crypto.randomUUID(), src: 'images/IMG_6147-f682ea2a-6b0d-41ca-9fff-49fce6c4599b.png', alt: 'SSA gathering' },
    { id: crypto.randomUUID(), src: 'images/IMG_5082-60e70f2b-288e-4974-966c-c9efa0156cf9.png', alt: 'SSA community' },
    { id: crypto.randomUUID(), src: 'images/IMG_0776-6da79056-3273-4df1-8f50-b73606120877.png', alt: 'SSA members' },
    { id: crypto.randomUUID(), src: 'images/IMG_3565-003f4feb-e0d2-45bc-befa-518f013e50e1.png', alt: 'SSA gathering' },
    { id: crypto.randomUUID(), src: 'images/IMG_6105-769ac347-fb9b-4e42-931f-b92b18456f13.png', alt: 'SSA event' },
    { id: crypto.randomUUID(), src: 'images/IMG_6108-ecd59a4d-acac-4a7f-ade8-cde636eaf361.png', alt: 'SSA event' },
    { id: crypto.randomUUID(), src: 'images/IMG_9187-0c719813-8fa1-4633-9864-439f284ab0ff.png', alt: 'SSA event' }
  ],
  directText: {},
  editableLinks: {},
  editableImages: {}
};

let siteData = loadSiteData();
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

  list.innerHTML = siteData.newsletters
    .map((item, idx) => {
      const imageHtml = item.image
        ? `<div class="newsletter-media-col"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" class="newsletter-card-media" loading="lazy" /></div>`
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

function renderBoard() {
  const boardGrid = document.getElementById('leadership-grid');
  if (!boardGrid) return;

  boardGrid.innerHTML = siteData.boardMembers
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
        lowerName.includes('dahir')
      ) {
        mobileClasses.push('leader-photo-mobile-higher');
      }
      return `
      <div class="leader-card">
        <div class="leader-card-image">
          <img src="${escapeHtml(member.image)}" alt="${escapeHtml(member.name)}" class="${mobileClasses.join(' ')}" loading="lazy" />
          <div class="leader-card-overlay">
            <div class="leader-name">${escapeHtml(member.name)}</div>
            <div class="leader-role">${escapeHtml(member.role)}</div>
          </div>
        </div>
        <div class="leader-card-info">
          <p>${escapeHtml(member.bio)}</p>
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
        <img src="${escapeHtml(img.src)}" alt="${escapeHtml(img.alt || 'SSA gallery image')}" loading="lazy" />
      </div>`
      )
      .join('');

  homeGrid.innerHTML = renderItems(siteData.galleryImages.slice(0, 6));
  fullGrid.innerHTML = renderItems(siteData.galleryImages);
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

function processImageUpload(file, section, index, field) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => {
    if (!siteData[section]?.[index]) return;
    siteData[section][index][field] = String(reader.result || '');
    renderAllDynamicSections();
    renderAdminForms();
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
