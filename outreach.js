(function () {
  const api = window.ssaFetch?.json;
  if (!api || document.getElementById('outreachModal')) return;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop outreach-modal';
  modal.id = 'outreachModal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
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
    <button class="modal-exit" type="button" aria-label="Close"><svg viewBox="0 0 44 44" aria-hidden="true"><path class="modal-exit-path" d="M22 6 C33 5 38 15 38 22 C38 33 29 38 22 38 C11 38 6 29 6 22 C6 11 14 6 22 6 Z"/><path class="modal-exit-x" d="M16.5 16.5 L27.5 27.5 M27.5 16.5 L16.5 27.5"/></svg></button>`;
  document.body.appendChild(modal);

  const chooser = modal.querySelector('#outreachChooser');
  const formView = modal.querySelector('#outreachFormView');
  const form = modal.querySelector('#outreachForm');
  const eyebrow = modal.querySelector('#outreachEyebrow');
  const formTitle = modal.querySelector('#outreachFormTitle');
  const lead = modal.querySelector('#outreachLead');
  let kind = '';

  const eventCopy = {
    campus: ['Suggest a campus event', 'Large, social ideas that grow SSA presence and student engagement.'],
    community: ['Suggest a community event', 'Intentional programming focused on depth, service, and connection.']
  };

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

  function eventFields(type) {
    const selected = type === 'campus' ? 'campus' : 'community';
    const copy = eventCopy[selected];
    eyebrow.textContent = 'Programs';
    formTitle.textContent = copy[0];
    lead.textContent = copy[1];
    return `
      <label>Event style<select name="type"><option value="community" ${selected === 'community' ? 'selected' : ''}>Community-focused</option><option value="campus" ${selected === 'campus' ? 'selected' : ''}>Campus-focused</option></select></label>
      <input type="text" name="name" placeholder="Event name" required />
      <textarea name="description" rows="3" placeholder="What would this event look like?" required></textarea>
      <input type="text" name="audience" placeholder="Who is it for?" />
      <input type="text" name="budget" placeholder="Estimated budget (optional)" />
      <input type="text" name="preferredDate" placeholder="Preferred date or season" />
      <textarea name="notes" rows="2" placeholder="Notes for the board (optional)"></textarea>
      <button class="button button-dark" type="submit">Submit event idea</button><output></output>`;
  }

  function showForm(nextKind, subtype) {
    kind = nextKind;
    chooser.hidden = true;
    formView.hidden = false;
    if (kind === 'event') {
      form.innerHTML = eventFields(subtype || 'community');
      form.type.addEventListener('change', () => {
        const copy = eventCopy[form.type.value];
        formTitle.textContent = copy[0];
        lead.textContent = copy[1];
      });
    } else if (kind === 'community') {
      eyebrow.textContent = 'Community';
      formTitle.textContent = 'Collaborate with SSA';
      lead.textContent = 'Tell us how your organization or community would like to work with SSA.';
      form.innerHTML = `
        <input type="text" name="name" placeholder="Your name" required />
        <input type="email" name="email" placeholder="Email" required />
        <input type="text" name="organization" placeholder="Organization (optional)" />
        <select name="reason"><option value="collaborations">Collaboration</option><option value="partnerships">Partnership</option><option value="sponsorship">Sponsorship</option><option value="ideas">Community idea</option></select>
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
    window.setTimeout(() => form.querySelector('input, select, textarea')?.focus(), 60);
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
      if (kind === 'event') {
        await api('/api/event-suggestions', { method: 'POST', body: {
          type: value('type'), name: value('name'), description: value('description'),
          audience: value('audience'), budget: value('budget'),
          preferredDate: value('preferredDate'), notes: value('notes')
        } });
      } else if (kind === 'community') {
        await api('/api/connect', { method: 'POST', body: {
          reason: value('reason'), name: value('name'), email: value('email'),
          organization: value('organization'), details: value('details')
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
    button.addEventListener('click', () => showForm(button.dataset.outreachKind));
  });
  modal.querySelector('[data-outreach-back]').addEventListener('click', showChooser);
  modal.querySelector('.modal-exit').addEventListener('click', close);
  modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('open')) close();
  });

  document.querySelectorAll('[data-open-outreach]').forEach((button) => button.addEventListener('click', showChooser));
  document.querySelectorAll('[data-suggest-event]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      showForm('event', button.dataset.suggestType || 'community');
    });
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showForm('event', button.dataset.suggestType || 'community');
      }
    });
  });

  window.openOutreachModal = showChooser;
  window.openSuggestModal = (type) => showForm('event', type || 'community');
  window.openConnectModal = () => showForm('community');

  const params = new URLSearchParams(window.location.search);
  if (params.has('connect')) window.setTimeout(() => showForm('community'), 350);
  else if (params.has('suggest')) window.setTimeout(() => showForm('event', params.get('suggest')), 350);
})();
