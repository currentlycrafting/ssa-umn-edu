(function () {
  const api = window.ssaFetch?.json;
  if (!api || document.getElementById('outreachModal')) return;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop outreach-modal';
  modal.id = 'outreachModal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="whats-new-frame outreach-frame">
      <div class="modal-sheet modal-card modal-card-wide outreach-card" role="dialog" aria-modal="true" aria-labelledby="outreachTitle">
        <div id="outreachChooser">
          <span class="eyebrow">Connect with SSA</span>
          <h2 id="outreachTitle">What would you like to share?</h2>
          <p>Choose a path and we will send it to the right place.</p>
          <div class="outreach-options">
            <button type="button" data-outreach-kind="event"><span>Programs</span><strong>Suggest an event</strong><small>Campus and community event ideas.</small></button>
            <button type="button" data-outreach-kind="community"><span>Community</span><strong>Collaborate with SSA</strong><small>Partnerships, sponsorships, and community work.</small></button>
            <button type="button" data-outreach-kind="message"><span>Messages</span><strong>Send a message</strong><small>Questions, feedback, and everything else.</small></button>
          </div>
        </div>
        <div id="outreachFormView" hidden>
          <button class="outreach-back" type="button" data-outreach-back>← All options</button>
          <span class="eyebrow" id="outreachEyebrow">Programs</span>
          <h2 id="outreachFormTitle">Suggest an event</h2>
          <p id="outreachLead"></p>
          <form id="outreachForm" class="connect-modal-form"></form>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const chooser = modal.querySelector('#outreachChooser');
  const formView = modal.querySelector('#outreachFormView');
  const form = modal.querySelector('#outreachForm');
  const eyebrow = modal.querySelector('#outreachEyebrow');
  const formTitle = modal.querySelector('#outreachFormTitle');
  const lead = modal.querySelector('#outreachLead');
  let kind = '';

  function open() {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function close() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  function showChooser() {
    kind = '';
    chooser.hidden = false;
    formView.hidden = true;
    open();
  }

  function showForm(nextKind) {
    kind = nextKind;
    chooser.hidden = true;
    formView.hidden = false;
    if (kind === 'community') {
      eyebrow.textContent = 'Community';
      formTitle.textContent = 'Collaborate with SSA';
      lead.textContent = 'Tell us how your organization or community would like to work with SSA.';
      form.innerHTML = `
        <input type="text" name="name" placeholder="Your name" required />
        <input type="email" name="email" placeholder="Email" required />
        <textarea name="details" rows="5" placeholder="How would you like to work together?" required></textarea>
        <button class="button button-dark" type="submit">Send collaboration</button><output></output>`;
    } else {
      eyebrow.textContent = 'Messages';
      formTitle.textContent = 'Send SSA a message';
      lead.textContent = 'Questions, feedback, or something the board should know.';
      form.innerHTML = `
        <input type="text" name="name" placeholder="Your name" required />
        <input type="email" name="email" placeholder="Email" required />
        <textarea name="message" rows="5" placeholder="Your message" required></textarea>
        <button class="button button-dark" type="submit">Send message</button><output></output>`;
    }
    open();
    window.setTimeout(() => form.querySelector('input, textarea')?.focus(), 60);
  }

  function value(name) {
    return String(new FormData(form).get(name) || '').trim();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector('button[type="submit"]');
    const output = form.querySelector('output');
    button.disabled = true;
    try {
      if (kind === 'community') {
        await api('/api/connect', { method: 'POST', body: {
          reason: 'collaborations',
          name: value('name'),
          email: value('email'),
          details: value('details')
        } });
      } else {
        await api('/api/messages', { method: 'POST', body: {
          name: value('name'), email: value('email'), message: value('message')
        } });
      }
      output.textContent = 'Sent — thank you for reaching out.';
      window.setTimeout(close, 1100);
    } catch (error) {
      output.textContent = error.message || 'Could not send this yet.';
    } finally {
      button.disabled = false;
    }
  });

  modal.querySelectorAll('[data-outreach-kind]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextKind = button.dataset.outreachKind;
      if (nextKind === 'event') {
        close();
        window.location.href = '/suggest';
        return;
      }
      showForm(nextKind);
    });
  });
  modal.querySelector('[data-outreach-back]').addEventListener('click', showChooser);
  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.classList.contains('outreach-frame')) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('open')) close();
  });

  document.querySelectorAll('[data-open-outreach]').forEach((button) => button.addEventListener('click', showChooser));
  document.querySelectorAll('[data-suggest-event]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const type = button.dataset.suggestType || 'campus';
      window.location.href = `/suggest?type=${encodeURIComponent(type)}`;
    });
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const type = button.dataset.suggestType || 'campus';
        window.location.href = `/suggest?type=${encodeURIComponent(type)}`;
      }
    });
  });

  window.openOutreachModal = showChooser;
  window.openSuggestModal = (type) => {
    window.location.href = `/suggest?type=${encodeURIComponent(type || 'campus')}`;
  };
  window.openConnectModal = () => showForm('community');

  const params = new URLSearchParams(window.location.search);
  if (params.has('connect')) window.setTimeout(() => showForm('community'), 350);
  else if (params.has('suggest')) {
    window.setTimeout(() => {
      window.location.href = `/suggest?type=${encodeURIComponent(params.get('suggest') || 'campus')}`;
    }, 100);
  }
})();
