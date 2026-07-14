(function () {
  const api = window.ssaFetch?.json;
  const openButton = document.getElementById('boardScheduleOpen');
  const workspace = document.getElementById('boardScheduleWorkspace');
  const scheduleList = document.getElementById('scheduleList');
  const scheduleCount = document.getElementById('scheduleLibraryCount');
  const toolbar = document.getElementById('scheduleToolbar');
  const toolbarMeta = document.getElementById('scheduleToolbarMeta');
  const copyLinkButton = document.getElementById('scheduleCopyLink');
  const newPollButton = document.getElementById('scheduleNewPoll');
  if (!api || !openButton || !workspace || !scheduleList || !toolbar) return;

  let boardMembers = [];
  let schedules = [];
  const params = new URLSearchParams(window.location.search);
  let pollSlug = params.get('poll') || '';
  let pollState = null;
  let selectedMember = localStorage.getItem('ssaScheduleMember') || '';
  let selectedSlots = new Set();
  let viewMode = 'availability';
  let saving = false;
  let dragging = false;
  let availabilityDirty = false;
  let pollingTimer = 0;
  const MEMBER_KEY = 'ssaScheduleMember';

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  function localDateValue(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function datesBetween(start, end) {
    const dates = [];
    const current = new Date(`${start}T12:00:00`);
    const last = new Date(`${end}T12:00:00`);
    while (current <= last && dates.length < 366) {
      dates.push(localDateValue(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  function timeLabel(totalMinutes) {
    const hour24 = Math.floor(totalMinutes / 60);
    const suffix = hour24 >= 12 ? 'PM' : 'AM';
    const minute = totalMinutes % 60;
    if (!minute) return `${hour24 % 12 || 12} ${suffix}`;
    return `${hour24 % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`;
  }

  function dayLabel(value, short = false) {
    const date = new Date(`${value}T12:00:00`);
    return date.toLocaleDateString([], short
      ? { weekday: 'short', month: 'short', day: 'numeric' }
      : { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function slotParts(slot) {
    return {
      date: slot.slice(0, 10),
      minutes: Number(slot.slice(11, 13)) * 60 + Number(slot.slice(14, 16))
    };
  }

  const tokenKey = (member) => `ssaScheduleToken:${pollSlug}:${member}`;
  const tokenFor = (member) => localStorage.getItem(tokenKey(member)) || '';
  const scheduleUrl = (slug = pollSlug) =>
    `${window.location.origin}/schedule?poll=${encodeURIComponent(slug)}`;

  function exitButton() {
    return '<button class="modal-exit" type="button" aria-label="Close">' +
      '<svg viewBox="0 0 44 44" aria-hidden="true">' +
      '<path class="modal-exit-path" d="M22 6 C33 5 38 15 38 22 C38 33 29 38 22 38 C11 38 6 29 6 22 C6 11 14 6 22 6 Z"/>' +
      '<path class="modal-exit-x" d="M16.5 16.5 L27.5 27.5 M27.5 16.5 L16.5 27.5"/></svg></button>';
  }

  function buildGrid(grid, options) {
    const { dates, allowed = new Set(), selected = new Set(), aggregate = {}, mode } = options;
    const maxCount = Math.max(1, pollState?.responseCount || 1);
    grid.style.setProperty('--schedule-days', dates.length);
    let html = '<div class="schedule-grid-corner">Time</div>';
    html += dates.map((date) =>
      `<div class="schedule-day-head">${esc(dayLabel(date, true))}</div>`
    ).join('');
    const rowMinutes = Array.from({ length: 16 }, (_, index) => (8 + index) * 60);
    rowMinutes.forEach((minutes, row) => {
      html += `<div class="schedule-time-label">${timeLabel(minutes)}</div>`;
      dates.forEach((date, col) => {
        const hour = String(Math.floor(minutes / 60)).padStart(2, '0');
        const minute = String(minutes % 60).padStart(2, '0');
        const slot = `${date}:${hour}:${minute}`;
        const isAllowed = mode === 'creator' || allowed.has(slot);
        const isSelected = selected.has(slot);
        const result = aggregate[slot] || { count: 0, names: [] };
        const heat = result.count ? Math.max(.24, result.count / maxCount) : 0;
        const classes = [
          'schedule-slot',
          isAllowed ? 'is-allowed' : 'is-blocked',
          isSelected ? 'is-selected' : '',
          mode === 'results' ? 'is-result' : '',
          result.count ? 'has-people' : ''
        ].filter(Boolean).join(' ');
        const label = `${dayLabel(date)} ${timeLabel(minutes)}`;
        html += `<button class="${classes}" type="button" data-slot="${slot}" data-col="${col}" data-row="${row}" ` +
          `style="--schedule-heat:${heat}" ${isAllowed ? '' : 'disabled'} ` +
          `aria-label="${esc(label)}" aria-pressed="${isSelected}">` +
          `${mode === 'results' && result.count ? `<span>${result.count}</span>` : ''}</button>`;
      });
    });
    grid.innerHTML = html;
  }

  function bindPaint(grid, selected, onCommit) {
    let paintValue = true;
    const apply = (cell) => {
      if (!cell || cell.disabled || !cell.dataset.slot || !grid.contains(cell)) return;
      if (paintValue) selected.add(cell.dataset.slot);
      else selected.delete(cell.dataset.slot);
      cell.classList.toggle('is-selected', paintValue);
      cell.setAttribute('aria-pressed', String(paintValue));
    };
    grid.onpointerdown = (event) => {
      const cell = event.target.closest('.schedule-slot');
      if (!cell || cell.disabled) return;
      event.preventDefault();
      try { grid.setPointerCapture(event.pointerId); } catch (_) {}
      dragging = true;
      grid.classList.add('is-painting');
      paintValue = !selected.has(cell.dataset.slot);
      apply(cell);
    };
    grid.onpointerover = (event) => {
      if (dragging) apply(event.target.closest('.schedule-slot'));
    };
    grid.onpointermove = (event) => {
      if (!dragging) return;
      apply(document.elementFromPoint(event.clientX, event.clientY)?.closest('.schedule-slot'));
    };
    grid.onclick = (event) => {
      const cell = event.target.closest('.schedule-slot');
      if (!cell || cell.disabled || event.detail !== 0) return;
      paintValue = !selected.has(cell.dataset.slot);
      apply(cell);
      onCommit();
    };
    const finish = (event) => {
      if (!dragging) return;
      dragging = false;
      grid.classList.remove('is-painting');
      try {
        if (event?.pointerId != null) grid.releasePointerCapture(event.pointerId);
      } catch (_) {}
      onCommit();
    };
    grid.onpointerup = finish;
    grid.onpointercancel = finish;
    document.addEventListener('pointerup', finish);
    document.addEventListener('pointercancel', finish);
  }

  const createModal = document.createElement('div');
  createModal.className = 'modal-backdrop schedule-create-modal';
  createModal.setAttribute('aria-hidden', 'true');
  createModal.innerHTML = `
    <div class="modal-sheet modal-card schedule-create-sheet" role="dialog" aria-modal="true" aria-labelledby="scheduleCreateTitle">
      ${exitButton()}
      <header class="schedule-create-hero">
        <span class="eyebrow">Board scheduling</span>
        <h2 id="scheduleCreateTitle">New schedule</h2>
        <p id="scheduleCreateCopy">Pick the exact dates first, then choose one-hour windows.</p>
      </header>
      <div class="schedule-create-steps" aria-hidden="true">
        <span data-create-step-dot="1" class="active">1</span>
        <i></i>
        <span data-create-step-dot="2">2</span>
      </div>
      <form id="scheduleCreateForm">
        <label class="schedule-create-title">Meeting name<input name="title" value="SSA Board Meeting" maxlength="120" required /></label>
        <section class="schedule-create-panel" data-create-panel="1">
          <div class="schedule-calendar">
            <div class="schedule-calendar-nav">
              <button type="button" data-cal-prev aria-label="Previous month">‹</button>
              <strong id="scheduleCalendarLabel"></strong>
              <button type="button" data-cal-next aria-label="Next month">›</button>
            </div>
            <div class="schedule-calendar-weekdays">
              <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
            </div>
            <div class="schedule-calendar-grid" id="scheduleCalendarGrid"></div>
          </div>
          <p class="schedule-grid-help" id="scheduleDateSummary">Tap any date to include it. Selected days do not need to be consecutive.</p>
        </section>
        <section class="schedule-create-panel" data-create-panel="2" hidden>
          <div class="schedule-grid-wrap schedule-create-grid-wrap">
            <div class="schedule-grid" id="scheduleCreatorGrid" aria-label="Possible meeting times"></div>
          </div>
          <p class="schedule-grid-help">Click or drag across hours. Scroll the table if you need more room.</p>
        </section>
        <div class="schedule-create-actions">
          <button class="button button-line" type="button" id="scheduleCreateBack" hidden>Back</button>
          <button class="button button-dark" type="button" id="scheduleCreateNext">Next</button>
          <button class="button button-dark" type="submit" hidden>Create Schedule</button>
          <output></output>
        </div>
      </form>
    </div>`;
  document.body.appendChild(createModal);

  const createForm = createModal.querySelector('#scheduleCreateForm');
  const creatorGrid = createModal.querySelector('#scheduleCreatorGrid');
  const calendarGrid = createModal.querySelector('#scheduleCalendarGrid');
  const calendarLabel = createModal.querySelector('#scheduleCalendarLabel');
  const createCopy = createModal.querySelector('#scheduleCreateCopy');
  const createBack = createModal.querySelector('#scheduleCreateBack');
  const createNext = createModal.querySelector('#scheduleCreateNext');
  const createSubmit = createModal.querySelector('button[type="submit"]');
  const dateSummary = createModal.querySelector('#scheduleDateSummary');
  const creatorSlots = new Set();
  const selectedDates = new Set();
  let createStep = 1;
  let calendarCursor = new Date(`${localDateValue()}T12:00:00`);
  calendarCursor.setDate(1);

  const deleteModal = document.createElement('div');
  deleteModal.className = 'modal-backdrop schedule-delete-modal';
  deleteModal.setAttribute('aria-hidden', 'true');
  deleteModal.innerHTML = `
    <div class="modal-sheet modal-card schedule-delete-sheet" role="dialog" aria-modal="true" aria-labelledby="scheduleDeleteTitle">
      ${exitButton()}
      <span class="eyebrow">Remove schedule</span>
      <h2 id="scheduleDeleteTitle">Delete this schedule?</h2>
      <p id="scheduleDeleteCopy">Its responses and group results will be permanently removed.</p>
      <form id="scheduleDeleteForm">
        <label>Admin password<input type="password" name="password" autocomplete="current-password" required /></label>
        <div class="schedule-delete-actions">
          <button class="button button-line" type="button" data-delete-cancel>Keep it</button>
          <button class="button button-dark" type="submit">Delete Schedule</button>
        </div>
        <output></output>
      </form>
    </div>`;
  document.body.appendChild(deleteModal);
  const deleteForm = deleteModal.querySelector('#scheduleDeleteForm');
  let deleteSlug = '';

  function sortedSelectedDates() {
    return Array.from(selectedDates).sort();
  }

  function pollDates(poll) {
    if (Array.isArray(poll.dates) && poll.dates.length) return poll.dates;
    const fromSlots = [...new Set((poll.allowedSlots || []).map((slot) => slot.slice(0, 10)))].sort();
    if (fromSlots.length) return fromSlots;
    return datesBetween(poll.dateStart, poll.dateEnd);
  }

  function monthLabel(date) {
    return date.toLocaleDateString([], { month: 'long', year: 'numeric' });
  }

  function shiftMonth(delta) {
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + delta, 1);
    renderCalendar();
  }

  function renderCalendar() {
    const year = calendarCursor.getFullYear();
    const month = calendarCursor.getMonth();
    calendarLabel.textContent = monthLabel(calendarCursor);
    const first = new Date(year, month, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = localDateValue();
    const cells = [];
    for (let i = 0; i < startPad; i += 1) cells.push('<span class="schedule-cal-empty"></span>');
    for (let day = 1; day <= daysInMonth; day += 1) {
      const value = localDateValue(new Date(year, month, day));
      const selected = selectedDates.has(value);
      const isToday = value === today;
      cells.push(
        `<button type="button" class="schedule-cal-day${selected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}" data-cal-day="${value}">` +
        `<span>${day}</span></button>`
      );
    }
    calendarGrid.innerHTML = cells.join('');
    bindCalendarPaint();
    updateDateSummary();
  }

  function updateDateSummary() {
    const count = selectedDates.size;
    dateSummary.textContent = count
      ? `${count} date${count === 1 ? '' : 's'} selected · click or drag to paint more`
      : 'Click or drag across dates. Selected days do not need to be consecutive.';
  }

  function applyCreateDate(value, shouldSelect) {
    if (!value) return;
    if (shouldSelect) {
      if (selectedDates.has(value)) return;
      if (selectedDates.size >= 366) {
        createForm.querySelector('output').textContent = 'You can select up to 366 dates.';
        return;
      }
      selectedDates.add(value);
    } else if (selectedDates.has(value)) {
      selectedDates.delete(value);
      for (const slot of Array.from(creatorSlots)) {
        if (slot.startsWith(value)) creatorSlots.delete(slot);
      }
    } else {
      return;
    }
    const cell = calendarGrid.querySelector(`[data-cal-day="${value}"]`);
    cell?.classList.toggle('is-selected', shouldSelect);
    createForm.querySelector('output').textContent = '';
    updateDateSummary();
  }

  function bindCalendarPaint() {
    let painting = false;
    let paintValue = true;
    let moved = false;

    const dayAtPoint = (x, y) =>
      document.elementFromPoint(x, y)?.closest('[data-cal-day]');

    const applyDay = (button) => {
      if (!button?.dataset.calDay) return;
      applyCreateDate(button.dataset.calDay, paintValue);
    };

    calendarGrid.onpointerdown = (event) => {
      const button = event.target.closest('[data-cal-day]');
      if (!button) return;
      event.preventDefault();
      try { calendarGrid.setPointerCapture(event.pointerId); } catch (_) {}
      painting = true;
      moved = false;
      calendarGrid.classList.add('is-painting');
      paintValue = !selectedDates.has(button.dataset.calDay);
      applyDay(button);
    };
    calendarGrid.onpointermove = (event) => {
      if (!painting) return;
      moved = true;
      event.preventDefault();
      applyDay(dayAtPoint(event.clientX, event.clientY));
    };
    calendarGrid.onpointerover = (event) => {
      if (!painting) return;
      moved = true;
      applyDay(event.target.closest('[data-cal-day]'));
    };
    const finish = (event) => {
      if (!painting) return;
      painting = false;
      calendarGrid.classList.remove('is-painting');
      try {
        if (event?.pointerId != null) calendarGrid.releasePointerCapture(event.pointerId);
      } catch (_) {}
    };
    calendarGrid.onpointerup = finish;
    calendarGrid.onpointercancel = finish;
    calendarGrid.onclick = (event) => {
      if (moved) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
  }

  function toggleCreateDate(value) {
    applyCreateDate(value, !selectedDates.has(value));
  }

  function renderCreatorGrid() {
    const dates = sortedSelectedDates();
    if (!dates.length || !creatorGrid) return;
    buildGrid(creatorGrid, { dates, selected: creatorSlots, mode: 'creator' });
    bindPaint(creatorGrid, creatorSlots, () => {});
  }

  function setCreateStep(step) {
    createStep = step;
    createModal.querySelectorAll('[data-create-panel]').forEach((panel) => {
      panel.hidden = Number(panel.dataset.createPanel) !== step;
    });
    createModal.querySelectorAll('[data-create-step-dot]').forEach((dot) => {
      dot.classList.toggle('active', Number(dot.dataset.createStepDot) <= step);
      dot.classList.toggle('current', Number(dot.dataset.createStepDot) === step);
    });
    createBack.hidden = step === 1;
    createNext.hidden = step !== 1;
    createSubmit.hidden = step !== 2;
    createCopy.textContent = step === 1
      ? 'Pick the exact dates you want. Skip days that will not work.'
      : 'Now paint one-hour windows for those dates.';
    createForm.querySelector('output').textContent = '';
    if (step === 2) renderCreatorGrid();
  }

  function openCreate() {
    createForm.reset();
    createForm.title.value = 'SSA Board Meeting';
    creatorSlots.clear();
    selectedDates.clear();
    selectedDates.add(localDateValue());
    calendarCursor = new Date(`${localDateValue()}T12:00:00`);
    calendarCursor.setDate(1);
    createForm.querySelector('output').textContent = '';
    setCreateStep(1);
    renderCalendar();
    createModal.classList.add('open');
    createModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    window.setTimeout(() => createForm.title.focus(), 60);
  }

  function closeCreate() {
    createModal.classList.remove('open');
    createModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  const tooltip = document.createElement('div');
  tooltip.className = 'schedule-tooltip';
  tooltip.hidden = true;
  tooltip.setAttribute('role', 'tooltip');
  document.body.appendChild(tooltip);

  function setWorkspaceMessage(message, error = false) {
    const output = workspace.querySelector('#scheduleOutput');
    if (!output) return;
    output.textContent = message;
    output.classList.toggle('is-error', error);
  }

  function showSavedToast(message = 'Saved to group results') {
    const toast = document.createElement('div');
    toast.className = 'schedule-toast';
    toast.innerHTML = `<i aria-hidden="true">✓</i><span>${esc(message)}</span>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    window.setTimeout(() => {
      toast.classList.remove('show');
      window.setTimeout(() => toast.remove(), 300);
    }, 2400);
  }

  function showTooltip(cell) {
    const slot = cell.dataset.slot;
    const result = pollState?.aggregate?.[slot] || { count: 0, names: [] };
    const parts = slotParts(slot);
    const names = result.names.length
      ? `<ul>${result.names.map((name) => `<li>${esc(name)}</li>`).join('')}</ul>`
      : '<p>No one is available yet.</p>';
    tooltip.innerHTML = `<strong>${esc(dayLabel(parts.date))} · ${esc(timeLabel(parts.minutes))}</strong>` +
      '<span>Available:</span>' + names +
      `<b>${result.count} ${result.count === 1 ? 'person' : 'people'} available</b>`;
    tooltip.hidden = false;
    const rect = cell.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 24);
    tooltip.style.width = `${width}px`;
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    const above = rect.top > 230;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = above
      ? `${Math.max(12, rect.top - tooltip.offsetHeight - 10)}px`
      : `${Math.min(window.innerHeight - tooltip.offsetHeight - 12, rect.bottom + 10)}px`;
  }

  function bindResultTooltips(grid) {
    grid.querySelectorAll('.schedule-slot.is-result.is-allowed').forEach((cell) => {
      cell.addEventListener('mouseenter', () => showTooltip(cell));
      cell.addEventListener('mousemove', () => showTooltip(cell));
      cell.addEventListener('mouseleave', () => { tooltip.hidden = true; });
      cell.addEventListener('focus', () => showTooltip(cell));
      cell.addEventListener('blur', () => { tooltip.hidden = true; });
      cell.addEventListener('click', () => showTooltip(cell));
    });
  }

  function canUseMember(name) {
    if (!name || !boardMembers.includes(name)) return false;
    const taken = new Set(pollState?.takenNames || []);
    return !taken.has(name) || Boolean(tokenFor(name));
  }

  function rememberMember(name) {
    selectedMember = name;
    if (name) localStorage.setItem(MEMBER_KEY, name);
  }

  function hydrateMemberSelection() {
    const remembered = selectedMember || localStorage.getItem(MEMBER_KEY) || '';
    if (!canUseMember(remembered)) {
      selectedMember = '';
      selectedSlots = new Set();
      return false;
    }
    rememberMember(remembered);
    const response = (pollState.responses || []).find((item) => item.memberName === remembered);
    selectedSlots = new Set(tokenFor(remembered) && response ? response.slots : []);
    return true;
  }

  function updateToolbar(meta = '') {
    const active = Boolean(pollState?.poll);
    toolbar.hidden = !active;
    toolbarMeta.textContent = meta;
    openButton.hidden = active;
  }

  function memberPickerMarkup() {
    const taken = new Set(pollState.takenNames || []);
    return `<div class="schedule-member-picker">
      <button class="schedule-member-trigger" id="scheduleMemberTrigger" type="button" aria-expanded="false">
        <span>${selectedMember ? esc(selectedMember) : 'Choose your name'}</span><i aria-hidden="true">⌄</i>
      </button>
      <div class="schedule-member-menu" id="scheduleMemberMenu" hidden>
        ${boardMembers.map((name) => {
          const responded = taken.has(name);
          const editable = Boolean(tokenFor(name));
          return `<button type="button" data-schedule-member="${esc(name)}" ` +
            `${responded && !editable ? 'disabled' : ''}>` +
            `<span>${esc(name)}</span><small>${responded ? (editable ? 'Edit' : 'Taken') : 'Ready'}</small>` +
            '</button>';
        }).join('')}
      </div>
    </div>`;
  }

  function renderWorkspace() {
    if (!pollState?.poll) {
      updateToolbar();
      return;
    }
    const poll = pollState.poll;
    const dates = pollDates(poll);
    const allowed = new Set(poll.allowedSlots || []);
    const dateCopy = dates.length === 1
      ? dayLabel(dates[0])
      : dates.length <= 3
        ? dates.map((date) => dayLabel(date, true)).join(' · ')
        : `${dates.length} dates · ${dayLabel(dates[0], true)} – ${dayLabel(dates[dates.length - 1], true)}`;
    workspace.hidden = false;
    updateToolbar(`${poll.title} · ${dateCopy}`);
    const hasSavedResponse = Boolean(selectedMember) &&
      (pollState.responses || []).some((item) => item.memberName === selectedMember);
    workspace.innerHTML = `
      <div class="schedule-response-card">
        <div class="schedule-response-intro">
          <div class="schedule-response-lead">
            <h2>${esc(poll.title)}</h2>
          </div>
          ${memberPickerMarkup()}
        </div>
        <div class="schedule-view-tabs">
          <button type="button" data-schedule-view="availability" class="${viewMode === 'availability' ? 'active' : ''}" ${selectedMember ? '' : 'disabled'}>${hasSavedResponse ? 'Edit time' : 'My times'}</button>
          <button type="button" data-schedule-view="results" class="${viewMode === 'results' ? 'active' : ''}">Results · ${pollState.responseCount}</button>
        </div>
        ${selectedMember || viewMode === 'results' ? `
          <div class="schedule-grid-wrap"><div class="schedule-grid" id="scheduleResponseGrid"></div></div>
          <div class="schedule-legend" ${viewMode === 'results' ? '' : 'hidden'}>
            <span>Fewer</span><i></i><i></i><i></i><i></i><span>More overlap</span>
          </div>
          ${viewMode === 'availability' ? `
            <div class="schedule-save-bar">
              <span>${availabilityDirty ? 'Unsaved changes' : 'Paint blue blocks, then save'}</span>
              <button class="button button-dark" id="scheduleSaveAvailability" type="button">
                <span>Save</span>
              </button>
            </div>` : `<p class="schedule-grid-help">Hover a green block to see who is free.</p>`}
        ` : `<div class="schedule-pick-first"><p>Choose your name to mark availability.</p></div>`}
        <output id="scheduleOutput"></output>
      </div>`;

    const memberTrigger = workspace.querySelector('#scheduleMemberTrigger');
    const memberMenu = workspace.querySelector('#scheduleMemberMenu');
    memberTrigger.addEventListener('click', () => {
      const open = memberMenu.hidden;
      memberMenu.hidden = !open;
      memberTrigger.setAttribute('aria-expanded', String(open));
    });
    memberMenu.querySelectorAll('[data-schedule-member]').forEach((button) => {
      button.addEventListener('click', () => chooseMember(button.dataset.scheduleMember));
    });
    if (!selectedMember) {
      memberMenu.hidden = false;
      memberTrigger.setAttribute('aria-expanded', 'true');
    }
    workspace.querySelectorAll('[data-schedule-view]').forEach((button) => {
      button.addEventListener('click', () => {
        viewMode = button.dataset.scheduleView;
        renderWorkspace();
      });
    });

    const grid = workspace.querySelector('#scheduleResponseGrid');
    if (!grid) return;
    if (viewMode === 'availability') {
      buildGrid(grid, { dates, allowed, selected: selectedSlots, mode: 'respond' });
      bindPaint(grid, selectedSlots, markAvailabilityDirty);
      workspace.querySelector('#scheduleSaveAvailability')?.addEventListener('click', saveAvailability);
    } else {
      buildGrid(grid, { dates, allowed, aggregate: pollState.aggregate, mode: 'results' });
      bindResultTooltips(grid);
    }
  }

  function chooseMember(member) {
    rememberMember(member);
    const response = (pollState.responses || []).find((item) => item.memberName === member);
    selectedSlots = new Set(tokenFor(member) && response ? response.slots : []);
    availabilityDirty = false;
    viewMode = 'availability';
    renderWorkspace();
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(scheduleUrl());
      showSavedToast('Link copied');
    } catch (_) {
      window.prompt('Copy this scheduling link:', scheduleUrl());
    }
  }

  function markAvailabilityDirty() {
    availabilityDirty = true;
    const bar = workspace.querySelector('.schedule-save-bar span');
    if (bar) bar.textContent = 'Unsaved changes';
    setWorkspaceMessage('');
  }

  async function saveAvailability() {
    if (!selectedMember || saving) return;
    saving = true;
    const button = workspace.querySelector('#scheduleSaveAvailability');
    if (button) {
      button.disabled = true;
      button.classList.add('is-saving');
      button.querySelector('span').textContent = 'Saving…';
    }
    try {
      const data = await api(`/api/schedule/${encodeURIComponent(pollSlug)}/availability`, {
        method: 'POST',
        body: {
          memberName: selectedMember,
          slots: Array.from(selectedSlots),
          responseToken: tokenFor(selectedMember)
        }
      });
      localStorage.setItem(tokenKey(selectedMember), data.responseToken);
      pollState = data.state;
      availabilityDirty = false;
      viewMode = 'results';
      renderWorkspace();
      showSavedToast();
      listSchedules({ selectNewest: false });
    } catch (error) {
      setWorkspaceMessage(error.message || 'Could not save availability.', true);
      if (button) {
        button.disabled = false;
        button.classList.remove('is-saving');
        button.querySelector('span').textContent = 'Save';
      }
    } finally {
      saving = false;
    }
  }

  function renderScheduleList() {
    scheduleCount.textContent = String(schedules.length);
    if (!schedules.length) {
      scheduleList.innerHTML = '<div class="schedule-list-empty"><strong>No saved schedules</strong><span>Create one to get started.</span></div>';
      return;
    }
    scheduleList.innerHTML = schedules.map((item, index) => {
      const range = item.dateStart === item.dateEnd
        ? dayLabel(item.dateStart, true)
        : `${dayLabel(item.dateStart, true)} – ${dayLabel(item.dateEnd, true)}`;
      return `<article class="schedule-list-item ${item.slug === pollSlug ? 'active' : ''}">
        <button class="schedule-list-select" type="button" data-select-schedule="${esc(item.slug)}">
          <span class="schedule-list-kicker">${index === 0 ? 'Newest · Featured' : `${item.responseCount} response${item.responseCount === 1 ? '' : 's'}`}</span>
          <strong>${esc(item.title)}</strong><small>${esc(range)}</small>
        </button>
        <button class="schedule-list-delete" type="button" data-delete-schedule="${esc(item.slug)}" aria-label="Delete ${esc(item.title)}">×</button>
      </article>`;
    }).join('');
    scheduleList.querySelectorAll('[data-select-schedule]').forEach((button) => {
      button.addEventListener('click', () => selectSchedule(button.dataset.selectSchedule));
    });
    scheduleList.querySelectorAll('[data-delete-schedule]').forEach((button) => {
      button.addEventListener('click', () => openDelete(button.dataset.deleteSchedule));
    });
  }

  async function listSchedules({ selectNewest = true } = {}) {
    try {
      const data = await api('/api/schedules');
      schedules = data.schedules || [];
      boardMembers = data.boardMembers || [];
      renderScheduleList();
    } catch (error) {
      scheduleList.innerHTML = `<div class="schedule-list-empty"><strong>Could not load schedules</strong><span>${esc(error.message || 'Try again shortly.')}</span></div>`;
      return;
    }
    if (selectNewest && !pollSlug && schedules[0]) {
      try {
        await selectSchedule(schedules[0].slug, false);
      } catch (error) {
        console.error(error);
      }
    }
  }

  async function selectSchedule(slug, updateUrl = true) {
    if (!slug || slug === pollSlug && pollState) return;
    if (availabilityDirty && !window.confirm('Switch schedules without saving these changes?')) return;
    pollSlug = slug;
    pollState = null;
    selectedSlots = new Set();
    availabilityDirty = false;
    selectedMember = localStorage.getItem(MEMBER_KEY) || '';
    viewMode = 'results';
    if (updateUrl) history.replaceState(null, '', `/schedule?poll=${encodeURIComponent(slug)}`);
    renderScheduleList();
    workspace.innerHTML = '<div class="schedule-loading"><i></i><p>Opening schedule…</p></div>';
    updateToolbar('');
    await loadPoll(undefined, { render: false });
    if (!pollState) return;
    viewMode = selectedMember ? 'availability' : 'results';
    renderWorkspace();
    startPolling();
  }

  function openDelete(slug) {
    const item = schedules.find((schedule) => schedule.slug === slug);
    deleteSlug = slug;
    deleteForm.reset();
    deleteForm.querySelector('output').textContent = '';
    deleteModal.querySelector('#scheduleDeleteCopy').textContent =
      `"${item?.title || 'This schedule'}" and all of its responses will be permanently removed.`;
    deleteModal.classList.add('open');
    deleteModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    window.setTimeout(() => deleteForm.password.focus(), 60);
  }

  function closeDelete() {
    deleteModal.classList.remove('open');
    deleteModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    deleteSlug = '';
  }

  async function loadPoll(since, { render = true } = {}) {
    const suffix = since ? `?since=${encodeURIComponent(since)}` : '';
    try {
      const data = await api(`/api/schedule/${encodeURIComponent(pollSlug)}${suffix}`);
      if (data.changed === false) return;
      pollState = data;
      const listed = schedules.find((item) => item.slug === pollSlug);
      if (listed) {
        listed.responseCount = data.responseCount;
        renderScheduleList();
      }
      if (!since) hydrateMemberSelection();
      if (selectedMember) {
        const response = (data.responses || []).find((item) => item.memberName === selectedMember);
        if (response && tokenFor(selectedMember) && viewMode === 'results' && !availabilityDirty) {
          selectedSlots = new Set(response.slots);
        }
      }
      if (render) renderWorkspace();
    } catch (error) {
      updateToolbar();
      workspace.hidden = false;
      workspace.innerHTML = `<div class="schedule-load-error"><h2>Scheduling link unavailable</h2><p>${esc(error.message || 'Try again later.')}</p><button class="button button-dark" id="scheduleRetry" type="button">Try again</button></div>`;
      workspace.querySelector('#scheduleRetry')?.addEventListener('click', () => loadPoll());
    }
  }

  function startPolling() {
    window.clearInterval(pollingTimer);
    pollingTimer = window.setInterval(() => {
      if (pollState && !saving && !dragging) loadPoll(pollState.version);
    }, 5000);
  }

  createModal.querySelector('[data-cal-prev]').addEventListener('click', () => shiftMonth(-1));
  createModal.querySelector('[data-cal-next]').addEventListener('click', () => shiftMonth(1));
  createBack.addEventListener('click', () => setCreateStep(1));
  createNext.addEventListener('click', () => {
    if (!selectedDates.size) {
      createForm.querySelector('output').textContent = 'Pick at least one date first.';
      return;
    }
    setCreateStep(2);
  });
  createForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (createStep !== 2) {
      createNext.click();
      return;
    }
    const dates = sortedSelectedDates();
    if (!dates.length) {
      createForm.querySelector('output').textContent = 'Pick at least one date first.';
      setCreateStep(1);
      return;
    }
    if (!creatorSlots.size) {
      createForm.querySelector('output').textContent = 'Paint at least one hour that could work.';
      return;
    }
    const button = createSubmit;
    const output = createForm.querySelector('output');
    if (button.disabled) return;
    button.disabled = true;
    output.textContent = 'Creating…';
    try {
      const data = await api('/api/schedule', {
        method: 'POST',
        body: {
          title: createForm.title.value.trim() || 'SSA Board Meeting',
          dates,
          dateStart: dates[0],
          dateEnd: dates[dates.length - 1],
          allowedSlots: Array.from(creatorSlots)
        }
      });
      const poll = data.state?.poll || {};
      pollSlug = data.slug;
      pollState = data.state;
      selectedSlots = new Set();
      availabilityDirty = false;
      selectedMember = localStorage.getItem(MEMBER_KEY) || '';
      hydrateMemberSelection();
      viewMode = selectedMember ? 'availability' : 'results';
      history.replaceState(null, '', `/schedule?poll=${encodeURIComponent(pollSlug)}`);

      // Show in Saved immediately on Create — do not wait for availability Save.
      schedules = [{
        slug: data.slug,
        title: poll.title || createForm.title.value.trim() || 'SSA Board Meeting',
        dateStart: poll.dateStart || dates[0],
        dateEnd: poll.dateEnd || dates[dates.length - 1],
        createdAt: poll.createdAt || new Date().toISOString(),
        responseCount: 0
      }, ...schedules.filter((item) => item.slug !== data.slug)];
      renderScheduleList();

      closeCreate();
      try {
        renderWorkspace();
        startPolling();
      } catch (_) { /* list already updated */ }
      listSchedules({ selectNewest: false }).catch(() => {});
      try {
        await navigator.clipboard.writeText(scheduleUrl());
        showSavedToast('Schedule created · link copied');
      } catch (_) {
        showSavedToast('Schedule created');
      }
      workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      output.textContent = error.message || 'Could not create this schedule.';
    } finally {
      button.disabled = false;
    }
  });
  createSubmit.addEventListener('click', (event) => {
    if (createStep !== 2) return;
    event.preventDefault();
    createForm.requestSubmit();
  });

  deleteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = deleteForm.querySelector('button[type="submit"]');
    const output = deleteForm.querySelector('output');
    button.disabled = true;
    button.textContent = 'Deleting…';
    try {
      const removedSlug = deleteSlug;
      await api(`/api/schedule/${encodeURIComponent(removedSlug)}/delete`, {
        method: 'POST',
        body: { password: deleteForm.password.value }
      });
      closeDelete();
      schedules = schedules.filter((item) => item.slug !== removedSlug);
      if (pollSlug === removedSlug) {
        pollSlug = '';
        pollState = null;
        selectedMember = '';
        selectedSlots = new Set();
        history.replaceState(null, '', '/schedule');
        if (schedules[0]) await selectSchedule(schedules[0].slug);
        else {
          updateToolbar();
          workspace.innerHTML = '<div class="schedule-pick-first"><h2>No schedule yet</h2><p>Create the first schedule to start finding a meeting time.</p></div>';
        }
      }
      renderScheduleList();
      showSavedToast('Schedule deleted');
    } catch (error) {
      output.textContent = error.message || 'Could not delete this schedule.';
    } finally {
      button.disabled = false;
      button.textContent = 'Delete Schedule';
    }
  });

  openButton.addEventListener('click', openCreate);
  copyLinkButton?.addEventListener('click', copyLink);
  newPollButton?.addEventListener('click', openCreate);
  createModal.querySelector('.modal-exit').addEventListener('click', closeCreate);
  createModal.addEventListener('click', (event) => {
    if (event.target === createModal) closeCreate();
  });
  deleteModal.querySelector('.modal-exit').addEventListener('click', closeDelete);
  deleteModal.querySelector('[data-delete-cancel]').addEventListener('click', closeDelete);
  deleteModal.addEventListener('click', (event) => {
    if (event.target === deleteModal) closeDelete();
  });
  document.addEventListener('pointerdown', (event) => {
    const picker = workspace.querySelector('.schedule-member-picker');
    if (!picker || picker.contains(event.target)) return;
    const menu = workspace.querySelector('#scheduleMemberMenu');
    const trigger = workspace.querySelector('#scheduleMemberTrigger');
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    trigger?.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      tooltip.hidden = true;
      const menu = workspace.querySelector('#scheduleMemberMenu');
      const trigger = workspace.querySelector('#scheduleMemberTrigger');
      if (menu && !menu.hidden) {
        menu.hidden = true;
        trigger?.setAttribute('aria-expanded', 'false');
      }
      if (createModal.classList.contains('open')) closeCreate();
      if (deleteModal.classList.contains('open')) closeDelete();
    }
  });

  listSchedules({ selectNewest: !pollSlug }).then(() => {
    if (pollSlug) selectSchedule(pollSlug, false);
  });
})();
