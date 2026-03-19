function renderEvents() {
  var eventsList = document.getElementById('events-list');
  if (!eventsList) return;

  var events =
    Array.isArray(serverSiteContent.events) && serverSiteContent.events.length > 0
      ? serverSiteContent.events
      : siteData.events;

  var visible = events.slice(0, 3);
  eventsList.innerHTML = visible
    .map(function(event) {
      var actionHtml = event.link
        ? '<div class="event-row-actions"><a href="' + escapeHtml(event.link) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(event.buttonText || 'Learn More') + '</a></div>'
        : '';

      return '\
      <div class="event-row">\
        <div class="event-date">\
          <div class="event-date-day">' + escapeHtml(event.day) + '</div>\
          <div class="event-date-month">' + escapeHtml(event.month) + '</div>\
        </div>\
        <div class="event-details">\
          <h3>' + escapeHtml(event.title) + '</h3>\
          <p>' + escapeHtml(event.description) + '</p>\
          ' + actionHtml + '\
        </div>\
        <div class="event-row-tag">' + escapeHtml(event.tag || 'Event') + '</div>\
      </div>';
    })
    .join('');

  var fullList = document.getElementById('full-calendar-list');
  if (fullList) {
    fullList.innerHTML = events
      .map(function(event) {
        var actionHtml = event.link
          ? '<div class="event-row-actions"><a href="' + escapeHtml(event.link) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(event.buttonText || 'Learn More') + '</a></div>'
          : '';
        return '\
        <div class="event-row">\
          <div class="event-date">\
            <div class="event-date-day">' + escapeHtml(event.day) + '</div>\
            <div class="event-date-month">' + escapeHtml(event.month) + '</div>\
          </div>\
          <div class="event-details">\
            <h3>' + escapeHtml(event.title) + '</h3>\
            <p>' + escapeHtml(event.description) + '</p>\
            ' + actionHtml + '\
          </div>\
          <div class="event-row-tag">' + escapeHtml(event.tag || 'Event') + '</div>\
        </div>';
      })
      .join('');
  }
}

function renderNewsletters() {
  var list = document.getElementById('newsletter-list');
  if (!list) return;

  var newsletters = Array.isArray(serverSiteContent.newsletters) && serverSiteContent.newsletters.length > 0
    ? serverSiteContent.newsletters
    : siteData.newsletters;

  list.innerHTML = newsletters
    .map(function(item, idx) {
      var imageHtml = item.image
        ? '<div class="newsletter-media-col"><button type="button" class="newsletter-card-media-wrap" aria-label="View full size" onclick="var i=this.querySelector(\'img\');if(i&&window.openImageLightbox)window.openImageLightbox(i.src,i.alt)"><img src="' + escapeHtml(item.image) + '" alt="' + escapeHtml(item.title) + '" class="newsletter-card-media" loading="lazy" /></button></div>'
        : '';
      var primaryUrl = toInstagramEmbedUrl(item.link);
      var secondaryRaw = item.secondaryLink || (idx === 0 ? 'https://www.instagram.com/p/DVsD4UoDmTX/' : '');
      var secondaryUrl = toInstagramEmbedUrl(secondaryRaw);
      var linkHtml = item.link
        ? '<a class="btn-ghost newsletter-read-more admin-editable-link" data-link-key="newsletter-' + escapeHtml(item.id) + '" href="' + escapeHtml(item.link) + '" target="_blank" rel="noopener noreferrer">Read More</a>'
        : '';
      var topRow =
        '<div class="newsletter-top-row">' +
          (imageHtml || '<div class="newsletter-media-col newsletter-media-placeholder"></div>') +
          '<div class="newsletter-content-col"><p>' + linkifyText(item.description) + '</p></div>' +
        '</div>';
      var bottomRow = '';
      var embedUrls = [primaryUrl, secondaryUrl].filter(Boolean);
      if (embedUrls.length) {
        var embedsHtml = embedUrls
          .map(function(url) {
            return '<div class="newsletter-embed-wrap"><iframe class="newsletter-embed-frame" src="' + escapeHtml(url) + '" loading="lazy" allowfullscreen title="Instagram video"></iframe></div>';
          })
          .join('');
        bottomRow =
          '<div class="newsletter-bottom-row"><div class="newsletter-embed-row">' + embedsHtml + '</div>' + linkHtml + '</div>';
      } else if (linkHtml) {
        bottomRow = '<div class="newsletter-bottom-row"><div class="newsletter-embed-wrap">' + linkHtml + '</div></div>';
      }
      return '\
      <article class="newsletter-card">\
        <div class="newsletter-card-head">\
          <h3>' + escapeHtml(item.title) + '</h3>\
          <span class="newsletter-card-date">' + escapeHtml(item.date) + '</span>\
        </div>\
        <div class="newsletter-card-body">' + topRow + bottomRow + '</div>\
      </article>';
    })
    .join('');
}

function renderBoard() {
  var boardGrid = document.getElementById('leadership-grid');
  if (!boardGrid) return;
  var members = getBoardMembers();
  boardGrid.innerHTML = members
    .map(function(member) {
      var mobileClasses = [];
      var lowerName = member.name.toLowerCase();
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
      var imageSrc = member.image ? member.image.replace(/^\//, '') : '';
      return '\
      <div class="leader-card">\
        <div class="leader-card-image">\
          <img src="' + escapeHtml(imageSrc) + '" alt="' + escapeHtml(member.name) + '" class="' + mobileClasses.join(' ') + '" loading="lazy" />\
          <div class="leader-card-overlay">\
            <div class="leader-name">' + escapeHtml(member.name) + '</div>\
            <div class="leader-role">' + escapeHtml(member.role || 'Executive Board Member') + '</div>\
          </div>\
        </div>\
        <div class="leader-card-info">\
          <p>' + escapeHtml(member.major || member.bio || 'Executive Board Member') + '</p>\
        </div>\
      </div>';
    })
    .join('');
}

function renderGallery() {
  var homeGrid = document.getElementById('gallery-grid');
  var fullGrid = document.getElementById('full-gallery-grid');
  if (!homeGrid || !fullGrid) return;

  var renderItems = function(items) {
    return items
      .map(function(img) {
        return '<div class="gallery-item"><img src="' + escapeHtml(img.src) + '" alt="' + escapeHtml(img.alt || '') + '" /></div>';
      })
      .join('');
  };

  var images = getGalleryImages();
  homeGrid.innerHTML = renderItems(images.slice(0, 3));
  fullGrid.innerHTML = renderItems(images);
}

function renderAllDynamicSections() {
  renderGallery();
  renderEvents();
  renderBoard();
}

function loadSiteContentFromServer() {
  fetch('/api/public/site-content')
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      if (data) {
        if (Array.isArray(data.galleryImages)) serverSiteContent.galleryImages = data.galleryImages;
        if (Array.isArray(data.boardMembers)) serverSiteContent.boardMembers = data.boardMembers;
        if (Array.isArray(data.newsletters)) serverSiteContent.newsletters = data.newsletters;
        if (Array.isArray(data.events)) {
          serverSiteContent.events = data.events;
          siteData.events = data.events.map(function(e) {
            return {
              id: e.id || crypto.randomUUID(),
              day: e.day,
              month: e.month,
              title: e.title,
              description: e.description,
              tag: e.tag,
              buttonText: e.buttonText,
              link: e.link
            };
          });
          saveSiteData();
        }
        renderBoard();
        renderGallery();
        renderNewsletters();
        renderEvents();
      }
    })
    .catch(function() {
      renderBoard();
      renderGallery();
    });
}
