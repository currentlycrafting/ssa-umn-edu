(function () {
  const form = document.getElementById('nlSubscribe');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = form.querySelector('output');
    try {
      await window.ssaFetch.json('/api/newsletter', { method: 'POST', body: { email: form.email.value.trim() } });
      out.textContent = "You're on the list.";
      form.reset();
    } catch (_) { out.textContent = 'Could not subscribe — try again.'; }
  });

  const archive = document.getElementById('nlArchive');
  const reader = document.getElementById('nlReader');

  function renderBlocks(blocks) {
    const all = blocks || [];
    const hasPhotoPair = all.length >= 2 && all.slice(-2).every((block) => block.type === 'image');
    const content = hasPhotoPair ? all.slice(0, -2) : all;
    const renderBlock = (b) => {
      if (b.type === 'heading') return `<section class="nl-block nl-heading"><h2>${escape(b.text)}</h2></section>`;
      if (b.type === 'paragraph') return `<section class="nl-block nl-paragraph"><p>${escape(b.text)}</p></section>`;
      if (b.type === 'announcement') return `<aside class="nl-block nl-announcement"><span class="eyebrow">Announcement</span><p>${escape(b.text)}</p></aside>`;
      if (b.type === 'image') return `<figure class="nl-block polaroid visible nl-photo" style="--rot:-1.5deg"><img src="${escape(b.src)}" alt="${escape(b.caption || 'Newsletter photo')}" /><figcaption>${escape(b.caption || '')}</figcaption></figure>`;
      if (b.type === 'timeline') {
        const rows = (b.rows || []).map((r) => `<div class="nl-timeline-row"><time>${escape(r.date)}</time><span>${escape(r.label)}</span></div>`).join('');
        return `<div class="nl-block"><h3>${escape(b.month || '')}</h3>${rows}</div>`;
      }
      if (b.type === 'game') return `<div class="nl-block"><h3>${escape(b.title)}</h3><p>${escape(b.text)}</p>${b.link ? `<a href="${escape(b.link)}">Play →</a>` : ''}</div>`;
      return '';
    };
    const contentHtml = content.map(renderBlock).join('');
    if (!hasPhotoPair) return contentHtml;
    const photos = all.slice(-2).map((b, index) =>
      `<figure class="nl-block polaroid visible nl-photo" style="--rot:${index ? 3 : -3}deg"><img src="${escape(b.src)}" alt="${escape(b.caption || 'Newsletter photo')}" /><figcaption>${escape(b.caption || '')}</figcaption></figure>`
    ).join('');
    return contentHtml + `<div class="nl-photo-pair">${photos}</div>`;
  }

  function escape(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function openEdition(id, latest = false) {
    const data = await window.ssaFetch.json('/api/newsletters/' + id);
    const edition = data.newsletter;
    reader.innerHTML = `
      <header class="nl-article-header">
        <span class="eyebrow">${latest ? 'Current edition' : 'From the archive'}</span>
        <h1>${escape(edition.title)}</h1>
        <p>Published ${escape(edition.createdAt.slice(0, 10))}</p>
      </header>
      <div class="nl-article-body">${renderBlocks(edition.blocks)}</div>`;
    archive.querySelectorAll('[data-id]').forEach((card) => {
      card.classList.toggle('is-active', card.dataset.id === String(id));
    });
  }

  async function load() {
    try {
      const data = await window.ssaFetch.json('/api/newsletters');
      if (!data.newsletters.length) {
        archive.innerHTML = '<p class="aux-empty">No published newsletters yet.</p>';
        reader.innerHTML = '<div class="aux-empty"><h2>The first edition is being written.</h2><p>Check back soon for SSA news, events, and community updates.</p></div>';
        return;
      }
      archive.innerHTML = data.newsletters.map((edition, index) =>
        `<a class="nl-card" href="?edition=${edition.id}" data-id="${edition.id}">
          <figure class="nl-edition-polaroid" style="--rot:${index % 2 ? 2 : -2}deg">${edition.cover ? `<img src="${escape(edition.cover)}" alt="" />` : '<span class="nl-edition-placeholder" aria-hidden="true">SSA</span>'}</figure>
          <span><small>Edition ${String(index + 1).padStart(2, '0')}</small><strong>${escape(edition.title)}</strong><time>${edition.createdAt.slice(0, 10)}</time></span>
        </a>`
      ).join('');
      archive.querySelectorAll('[data-id]').forEach((a) => {
        a.addEventListener('click', async (e) => {
          e.preventDefault();
          await openEdition(a.dataset.id, false);
          history.replaceState(null, '', `?edition=${a.dataset.id}`);
          reader.scrollIntoView({ behavior: 'smooth' });
        });
      });
      const requested = new URLSearchParams(location.search).get('edition');
      const selected = data.newsletters.find((edition) => String(edition.id) === requested) || data.newsletters[0];
      await openEdition(selected.id, selected.id === data.newsletters[0].id);
    } catch (_) {
      archive.innerHTML = '<p class="aux-empty">Newsletter archive unavailable.</p>';
    }
  }
  load();
})();
