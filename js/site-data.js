var STORAGE_KEY = 'ssaSiteContentV1';
var ADMIN_SESSION_KEY = 'ssaAdminUnlocked';
var ADMIN_PASSWORD = 'ssa2026';

var defaultData = {
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
  boardMembers: [],
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

var siteData = loadSiteData();
var serverSiteContent = { galleryImages: null, boardMembers: null, newsletters: null, events: null };
var adminUnlocked = sessionStorage.getItem(ADMIN_SESSION_KEY) === '1';
var directEditEnabled = false;
var adminActiveTab = 'events';

function loadSiteData() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultData);
    var parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultData),
      ...parsed,
      newsletters: parsed.newsletters?.length ? parsed.newsletters : structuredClone(defaultData.newsletters),
      events: parsed.events?.length ? parsed.events : structuredClone(defaultData.events),
      boardMembers: Array.isArray(parsed.boardMembers) ? parsed.boardMembers : structuredClone(defaultData.boardMembers),
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
  var escaped = escapeHtml(text);
  var withLinks = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  return withLinks.replaceAll('\n', '<br />');
}

function toInstagramEmbedUrl(link) {
  if (!link || !/instagram\.com\/p\//.test(link)) return '';
  var normalized = link.endsWith('/') ? link : link + '/';
  return normalized + 'embed';
}

function getBoardMembers() {
  var fromServer = serverSiteContent.boardMembers;
  if (fromServer !== null && fromServer !== undefined && Array.isArray(fromServer)) {
    return fromServer.filter(function(m) { return String(m.image || '').replace(/^\/+/, '').startsWith('board-images/'); });
  }
  var fromLocal = siteData.boardMembers;
  var members =
    fromLocal && fromLocal.length
      ? fromLocal
      : structuredClone(defaultData.boardMembers);
  return (members || []).filter(function(m) { return String(m.image || '').replace(/^\/+/, '').startsWith('board-images/'); });
}

function getGalleryImages() {
  var fromServer = serverSiteContent.galleryImages;
  var fromLocal = siteData.galleryImages;
  var images =
    fromServer && fromServer.length
      ? fromServer
      : fromLocal && fromLocal.length
        ? fromLocal
        : structuredClone(defaultData.galleryImages);
  return (images || []).filter(function(img) { return String(img.src || '').replace(/^\/+/, '').startsWith('gallery/'); });
}
