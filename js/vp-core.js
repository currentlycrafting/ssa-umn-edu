/* vp.html — core UI functions */

// ── DATA ──────────────────────────────────────────────────────────────────
const isInternal = VP_CONFIG.type === 'internal';
const divLabel = isInternal ? 'Internal' : 'External';

const MEMBERS = { internal: [], external: [] };

const myMembers = isInternal ? MEMBERS.internal : MEMBERS.external;

const ALL_TASKS = [];
const MY_TASKS = [];
let divTasks = [];

const NOTIFS = [];

// ── INIT ──────────────────────────────────────────────────────────────────
function init() {
  // Apply config
  document.getElementById('vp-greeting').textContent = `Hey ${VP_CONFIG.name.split(' ')[0]},`;
  document.getElementById('vp-role').textContent = VP_CONFIG.role_title;
  document.getElementById('vp-div').textContent = VP_CONFIG.division + ' · Division Admin';
  document.getElementById('div-badge').textContent = (isInternal ? '▲' : '◯') + ' ' + VP_CONFIG.division;
  document.getElementById('div-nav-label').textContent = 'My Division';
  document.getElementById('bc-div').textContent = VP_CONFIG.division;
  if (document.getElementById('div-tasks-bc')) document.getElementById('div-tasks-bc').innerHTML = `<span>${VP_CONFIG.division}</span> / Tasks`;
  if (document.getElementById('members-bc')) document.getElementById('members-bc').innerHTML = `<span>${VP_CONFIG.division}</span> / Members`;

  renderStats();
  renderOverview();
  renderMyTasks();
  renderDivTasks();
  renderFullApprovals();
  renderFullOverdue();
  renderMembers();
  renderEvents();
  renderDependency();
  renderCalendar();
}

// ── STATS ─────────────────────────────────────────────────────────────────
function renderStats() {
  const active = divTasks.filter(t => t.status === 'current' || t.status === 'pending').length;
  const overdue = divTasks.filter(t => t.status === 'overdue').length;
  const pending = divTasks.filter(t => t.status === 'pending').length;
  const done = divTasks.filter(t => t.status === 'done').length;
  document.getElementById('overview-stats').innerHTML = `
    <div class="stat-card"><div class="stat-num">${active}</div><div class="stat-label">Active Tasks</div></div>
    <div class="stat-card"><div class="stat-num red">${overdue}</div><div class="stat-label">Overdue</div></div>
    <div class="stat-card"><div class="stat-num" style="color:var(--blue)">${pending}</div><div class="stat-label">Pending Review</div></div>
    <div class="stat-card"><div class="stat-num green">${done}</div><div class="stat-label">Completed</div></div>`;
}

// ── OVERVIEW ──────────────────────────────────────────────────────────────
function renderOverview() {
  const pendingTasks = divTasks.filter(t => t.status === 'pending');
  document.getElementById('overview-approvals').innerHTML = pendingTasks.length
    ? pendingTasks.map(t => approvalHtml(t)).join('')
    : '<div style="font-size:13px;color:var(--silver);padding:16px">No pending submissions.</div>';

  const overdueTasks = divTasks.filter(t => t.status === 'overdue');
  document.getElementById('overview-alerts').innerHTML = overdueTasks.map(t => `
    <div class="overdue-alert">
      <div class="alert-icon">⚠</div>
      <div class="alert-body">
        <div class="alert-title">${t.title}</div>
        <div class="alert-sub">${t.assigned} · Due ${t.due}</div>
        <div class="alert-actions">
          <button class="btn btn-outline" style="font-size:9px;padding:4px 10px">Extend</button>
          <button class="btn btn-red" style="font-size:9px;padding:4px 10px" onclick="openRedoModal(${t.id})">Redo</button>
        </div>
      </div>
    </div>`).join('') || '<div style="font-size:13px;color:var(--silver);padding:8px">No overdue tasks.</div>';

  document.getElementById('overview-events').innerHTML = '<div style="font-size:13px;color:var(--silver);padding:8px">Loading live events...</div>';

  document.getElementById('member-snapshot').innerHTML = myMembers.map(m => {
    const p = Math.min((m.tasks / m.max) * 100, 100);
    const c = m.tasks >= m.max ? 'wl-over' : m.tasks >= m.max - 1 ? 'wl-warn' : 'wl-ok';
    return `<div class="card-sm">
      <div style="font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:4px">${m.dept}</div>
      <div style="font-size:15px;font-family:var(--font-display);color:var(--white)">${m.name.split(' ')[0]}</div>
      <div style="font-size:10px;color:var(--silver);margin-bottom:8px">${m.tasks}/${m.max} tasks</div>
      <div class="wl-bar"><div class="wl-fill ${c}" style="width:${p}%"></div></div>
    </div>`;
  }).join('');
}

function approvalHtml(t) {
  return `<div class="approval-item">
    <div class="approval-header">
      <div><div class="approval-task">${t.title}</div><div class="approval-by">${t.assigned} · ${t.event}</div></div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-green" style="font-size:9px;padding:4px 10px" onclick="approveTask(${t.id})">Approve</button>
        <button class="btn btn-red" style="font-size:9px;padding:4px 10px" onclick="openRedoModal(${t.id})">Redo</button>
      </div>
    </div>
    ${t.summary ? `<div style="font-size:11px;color:var(--silver)">${t.summary}</div>` : ''}
  </div>`;
}

// ── TASKS ─────────────────────────────────────────────────────────────────
function taskHtml(t, canApprove=false) {
  const sMap = {done:'sb-done',current:'sb-current',locked:'sb-locked',overdue:'sb-urgent',pending:'sb-pending',redo:'sb-redo',urgent:'sb-urgent'};
  const stMap = {done:'done',current:'current',locked:'locked',overdue:'urgent',pending:'current',redo:'redo',urgent:'urgent'};
  const lMap = {done:'Completed',current:'In Progress',locked:'Locked',overdue:'Overdue',pending:'Review',redo:'Redo',urgent:'Urgent'};
  const meetingLine = t.meeting_date || t.meeting_location
    ? `<span>Meeting ${t.meeting_date || ""} ${t.meeting_time || ""} ${t.meeting_location || ""}</span>`
    : "<span>Meeting N/A</span>";
  return `<div class="task-item" onclick="inspectTask(${t.id})">
    <div class="task-stripe ${stMap[t.status]||'locked'}"></div>
    <div>
      <div class="task-title">${t.title}</div>
      <div class="task-meta">
        <span>${t.assigned}</span>
        <span>${t.dept}</span>
        <span>Priority ${t.priority || "Standard"}</span>
        <span>Due ${t.due}</span>
        <span>Event ${t.event || "N/A"}</span>
        ${meetingLine}
      </div>
      ${t.description ? `<div style="font-size:11px;color:var(--silver);margin-top:6px">${t.description}</div>` : ""}
    </div>
    <div class="task-actions">
      <span class="status-badge ${sMap[t.status]||'sb-locked'}">${lMap[t.status]||t.status}</span>
      <button class="btn btn-outline" style="font-size:9px;padding:3px 8px" onclick="event.stopPropagation();inspectTask(${t.id})">Click to Review</button>
      ${canApprove && t.status==='pending' ? `<button class="btn btn-green" style="font-size:9px;padding:3px 8px" onclick="event.stopPropagation();approveTask(${t.id})">✓</button>` : ''}
    </div>
  </div>`;
}

function renderMyTasks(filter='all') {
  let tasks = MY_TASKS;
  if (filter === "urgent") {
    const soonMs = 1000 * 60 * 60 * 24 * 3;
    tasks = MY_TASKS.filter((t) => {
      const due = t.due_at ? new Date(t.due_at).getTime() : NaN;
      const dueSoon = Number.isFinite(due) && due > Date.now() && due - Date.now() <= soonMs;
      return String(t.priority || "").toLowerCase() === "critical" || dueSoon || t.status === "overdue" || t.status === "redo";
    });
  } else if (filter === 'current') {
    tasks = MY_TASKS.filter((t) => t.status === 'current' || t.status === 'redo');
  } else if (filter === 'redo') {
    tasks = MY_TASKS.filter((t) => t.status === 'redo');
  } else if (filter !== 'all') {
    tasks = MY_TASKS.filter(t => t.status===filter);
  }
  document.getElementById('my-task-list').innerHTML = tasks.map(t => taskHtml(t)).join('') || '<div style="color:var(--silver);font-size:13px;padding:16px">No tasks.</div>';
}

function renderDivTasks(filter='all') {
  let tasks = divTasks;
  if (filter !== 'all') tasks = divTasks.filter((t) => t.status === filter);
  const listEl = document.getElementById('div-task-list');
  if (listEl) listEl.innerHTML = tasks.map((t) => taskHtml(t, true)).join('') || '<div style="color:var(--silver);font-size:13px;padding:16px">No tasks match this filter.</div>';
}

function filterMyTasks(f, el) {
  const tabs = document.getElementById('my-task-tabs');
  if (tabs) {
    tabs.querySelectorAll('.division-badge').forEach((b) => {
      b.style.opacity = b === el ? '1' : '0.5';
    });
  }
  renderMyTasks(f);
}
function filterDivTasks(f, el) {
  const container = document.getElementById('div-task-filters');
  if (container) {
    container.querySelectorAll('.div-filter-badge').forEach((b) => {
      b.classList.remove('active');
      b.style.opacity = b.dataset.filter === f ? '1' : '0.5';
    });
    if (el) { el.classList.add('active'); el.style.opacity = '1'; }
  }
  renderDivTasks(f);
}

function renderFullApprovals() {
  const pending = divTasks.filter(t => t.status === 'pending');
  document.getElementById('full-approvals').innerHTML = pending.map(t => approvalHtml(t)).join('') || '<div style="color:var(--silver);font-size:13px;padding:16px">No pending submissions.</div>';
}

function renderFullOverdue() {
  const over = divTasks.filter(t => t.status === 'overdue');
  document.getElementById('full-overdue').innerHTML = over.map(t => `
    <div class="overdue-alert" style="margin-bottom:8px">
      <div class="alert-icon">⚠</div>
      <div class="alert-body">
        <div class="alert-title">${t.title}</div>
        <div class="alert-sub">${t.assigned} · ${t.dept} · Due ${t.due} · ${t.event}</div>
        <div class="alert-actions">
          <button class="btn btn-outline" style="font-size:9px;padding:4px 10px">Extend</button>
          <button class="btn btn-outline" style="font-size:9px;padding:4px 10px">Reassign</button>
          <button class="btn btn-red" style="font-size:9px;padding:4px 10px" onclick="openRedoModal(${t.id})">Redo</button>
        </div>
      </div>
    </div>`).join('') || '<div style="color:var(--silver);font-size:13px;padding:16px">No overdue tasks.</div>';
}

// ── MEMBERS ───────────────────────────────────────────────────────────────
function renderMembers() {
  const mTasks = (name) => ALL_TASKS.filter(t => t.assigned === name);
  document.getElementById('member-cards').innerHTML = myMembers.map(m => {
    const mt = mTasks(m.name);
    const active = mt.filter(t => t.status === 'current' || t.status === 'pending').length;
    const done = mt.filter(t => t.status === 'done').length;
    const p = Math.min((m.tasks/m.max)*100,100);
    const c = m.tasks>=m.max?'wl-over':m.tasks>=m.max-1?'wl-warn':'wl-ok';
    return `<div class="member-card">
      <div class="member-role">${m.dept}</div>
      <div class="member-name">${m.name}</div>
      <div style="font-size:11px;color:var(--silver);margin-bottom:12px">${m.role}</div>
      <div class="member-stats">
        <div class="member-stat"><div class="member-stat-num">${active}</div><div class="member-stat-label">Active</div></div>
        <div class="member-stat"><div class="member-stat-num">${done}</div><div class="member-stat-label">Done</div></div>
        <div class="member-stat"><div class="member-stat-num">${m.rate}%</div><div class="member-stat-label">Rate</div></div>
      </div>
      <div class="wl-bar"><div class="wl-fill ${c}" style="width:${p}%"></div></div>
      <div style="font-size:10px;color:var(--silver);margin-top:4px">${m.tasks}/${m.max} tasks</div>
    </div>`;
  }).join('');
}

// ── WORKLOAD ──────────────────────────────────────────────────────────────
function renderWorkload() {
  document.getElementById('workload-bars').innerHTML = myMembers.map(m => {
    const p = Math.min((m.tasks/m.max)*100,100);
    const c = m.tasks>=m.max?'wl-over':m.tasks>=m.max-1?'wl-warn':'wl-ok';
    const warn = m.tasks>=m.max?'<span style="color:var(--red);font-size:10px;margin-left:8px">⚠ Overloaded</span>':m.tasks>=m.max-1?'<span style="color:var(--amber);font-size:10px;margin-left:8px">⚡ Near limit</span>':'';
    return `<div style="background:var(--navy-light);padding:14px;border:1px solid rgba(255,255,255,.05);margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div><span style="font-size:13px;color:var(--white)">${m.name}</span>${warn}</div>
        <span style="color:${m.tasks>=m.max?'var(--red)':m.tasks>=m.max-1?'var(--amber)':'var(--green)'}">${m.tasks}/${m.max}</span>
      </div>
      <div class="wl-bar"><div class="wl-fill ${c}" style="width:${p}%"></div></div>
    </div>`;
  }).join('');
}

// ── SMART ASSIGNMENT ──────────────────────────────────────────────────────
function updateSuggestions() {
  const role = document.getElementById("assign-role")?.value || "";
  const root = document.getElementById("assign-suggestions");
  if (!root) return;
  if (!role) {
    root.innerHTML =
      '<div style="font-size:13px;color:var(--silver);text-align:center;padding:32px 0;opacity:.5">Select a role to see suggestions</div>';
    return;
  }
  root.innerHTML =
    '<div style="font-size:13px;color:var(--silver);padding:8px 0">Loading smart suggestions...</div>';
}

function selectAssignee(name) { showToast(`${name} selected`); }
function assignTask() { showToast("Preparing assignment..."); }

// ── EVENTS ────────────────────────────────────────────────────────────────
function renderEvents() {
  document.getElementById('events-list').innerHTML = '<div style="color:var(--silver);font-size:13px;padding:16px">Loading live events...</div>';
}

// ── DEPENDENCY ────────────────────────────────────────────────────────────
function renderDependency() {
  document.getElementById('dep-graph').innerHTML = '<div style="color:var(--silver);font-size:13px">Dependency graph loads from live tasks.</div>';
}

// ── CALENDAR ──────────────────────────────────────────────────────────────
function renderCalendar() {
  document.getElementById('cal-content').innerHTML = '<div style="color:var(--silver);font-size:13px;padding:8px 0">Calendar populates from live tasks and events.</div>';
}

// ── PERFORMANCE ──────────────────────────────────────────────────────────
function renderPerformance() {
  document.getElementById('perf-members').innerHTML = '<div style="color:var(--silver);font-size:13px">Live member performance appears after sync.</div>';
  document.getElementById('perf-redo').innerHTML = '<div style="color:var(--silver);font-size:13px">Live redo history appears after sync.</div>';
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────
function renderNotifications() {
  document.getElementById('notifList').innerHTML = NOTIFS.map(n => `
    <div style="padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer">
      <div style="font-size:12px;color:var(--white);margin-bottom:2px">${n.title}</div>
      <div style="font-size:11px;color:var(--silver)">${n.sub}</div>
      <div style="font-size:10px;color:var(--gold);margin-top:2px">${n.time}</div>
    </div>`).join('');
}

// ── MODALS ────────────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function openRedoModal(taskIdOrName) {
  const nameEl = document.getElementById('redo-task-name');
  const idEl = document.getElementById('redo-task-id');
  const notesEl = document.getElementById('redo-notes');
  const dueEl = document.getElementById('redo-due');
  const prEl = document.getElementById('redo-priority');
  const hintEl = document.getElementById('redo-notes-hint');
  const sendBtn = document.getElementById('redo-send-btn');

  let taskId = null;
  let taskName = '';
  if (typeof taskIdOrName === 'number') {
    taskId = taskIdOrName;
    const t = [...ALL_TASKS, ...MY_TASKS].find((x) => x.id === taskId);
    taskName = t ? t.title : '';
  } else if (typeof taskIdOrName === 'string') {
    taskName = taskIdOrName;
  }

  if (nameEl) nameEl.textContent = taskName || '—';
  if (idEl) idEl.value = taskId != null ? String(taskId) : '';
  if (notesEl) notesEl.value = '';
  if (dueEl) dueEl.value = '';
  if (prEl) prEl.value = 'Standard';
  if (hintEl) hintEl.textContent = '0 / 600 recommended';
  if (sendBtn) sendBtn.disabled = true;
  openModal('redoModal');
}

function submitRedo() {
  const idRaw = document.getElementById('redo-task-id')?.value || '';
  const notes = (document.getElementById('redo-notes')?.value || '').trim();
  const updatedDueAt = document.getElementById('redo-due')?.value || '';
  if (!idRaw) { showToast('Pick a task first.'); return; }
  if (!notes) { showToast('Redo notes are required.'); return; }
  const taskId = Number(idRaw);
  apiPost(`/api/tasks/${taskId}/redo`, { notes, updatedDueAt: updatedDueAt || null })
    .then(async () => {
      closeModal('redoModal');
      showToast('Redo request sent.');
      if (typeof hydrate === 'function') await hydrate();
    })
    .catch((e) => showToast(e?.message || 'Redo request failed'));
}

// live enable/disable
document.getElementById('redo-notes')?.addEventListener('input', (e) => {
  const v = (e.target.value || '');
  const hint = document.getElementById('redo-notes-hint');
  const send = document.getElementById('redo-send-btn');
  if (hint) hint.textContent = `${v.length} / 600 recommended`;
  if (send) send.disabled = v.trim().length === 0;
});

function approveTask(id) { showToast('Task approved'); updateBadge('appr-badge', -1); renderFullApprovals(); renderOverview(); }
function approveFromInspect() { closeModal('inspectModal'); showToast('Task approved'); }

let inspectId = null;
function inspectTask(id) {
  const t = [...ALL_TASKS,...MY_TASKS].find(x => x.id === id);
  if (!t) return;
  inspectId = id;
  document.getElementById('inspect-title').textContent = t.title;
  document.getElementById('inspect-body').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="info-block"><div class="info-label">Assigned</div><div class="info-val">${t.assigned} · ${t.owner_role || t.dept}</div></div>
      <div class="info-block"><div class="info-label">Event</div><div class="info-val">${t.event || 'Standalone'}</div></div>
      <div class="info-block"><div class="info-label">Due</div><div class="info-val">${t.due}</div></div>
      <div class="info-block"><div class="info-label">Stage</div><div class="info-val">${t.phase || 'Planning'}</div></div>
      <div class="info-block"><div class="info-label">Status</div><div class="info-val">${t.status}</div></div>
      ${(t.redo_notes || t.redo_requested_at) ? `
        <div class="info-block">
          <div class="info-label">Redo Requested</div>
          <div class="info-val" style="white-space:pre-wrap">${String(t.redo_notes || '').replace(/</g, '&lt;') || 'Please review the redo request and resubmit.'}</div>
        </div>
        ${t.redo_requested_at ? `<div style="font-size:11px;color:var(--silver);margin-top:-6px">Requested: ${new Date(t.redo_requested_at).toLocaleDateString()}</div>` : ''}
      ` : ''}
      ${t.description ? `<div class="info-block"><div class="info-label">Description</div><div class="info-val">${t.description}</div></div>` : ''}
      ${t.notes ? `<div class="info-block"><div class="info-label">Notes</div><div class="info-val">${t.notes}</div></div>` : ''}
      ${t.meeting_link ? `<div class="info-block"><div class="info-label">Meeting Link</div><div class="info-val"><a href="${t.meeting_link}" target="_blank" rel="noopener noreferrer" style="color:var(--gold-light)">${t.meeting_link}</a></div></div>` : ''}
      ${t.summary ? `<div class="info-block"><div class="info-label">Completion Summary</div><div class="info-val">${t.summary}</div></div>` : ''}
    </div>`;
  const approveBtn = document.getElementById('inspect-approve-btn');
  const redoBtn = document.getElementById('inspect-redo-btn');
  approveBtn.style.display = (t.status === 'pending' || t.status === 'pending_review') ? '' : 'none';
  // Redo requests should only be available once a task is completed.
  const isCompleted = t.status === 'done' || t.status === 'completed';
  redoBtn.style.display = isCompleted ? '' : 'none';
  openModal('inspectModal');
}

// ── NAV ───────────────────────────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + id);
  if (el) el.classList.add('active');
  const titles = {
    'overview':'Division Hub','my-tasks':'My Tasks','approvals':'Review Queue',
    'overdue':'Overdue Tasks','members':'Division Members','div-tasks':'Division Tasks',
    'assign':'Smart Assignment','events':'Events',
    'dependency':'Dependency Graph','calendar':'Calendar',
    'suggestions':'Suggestion Box',
    'reports':'Report Box',
    'escalate':'Escalate to President',
    'newsletter':'Edit Newsletter',
    'site-gallery':'Index',
  };
  document.getElementById('page-title').textContent = titles[id] || id;
  document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
  const navItem = document.querySelector(".sb-item[onclick*=\"showPage('" + id + "')\"]");
  if (navItem) navItem.classList.add('active');
  if (id === 'site-gallery' && typeof vpLoadSiteGalleryPage === 'function') vpLoadSiteGalleryPage();
}

function updateBadge(id, delta) {
  const el = document.getElementById(id);
  if (!el) return;
  const v = Math.max(0, parseInt(el.textContent) + delta);
  el.textContent = v;
  if (v === 0) el.style.display = 'none';
}

async function sendEscalation() { showToast('Submitting report...'); }

function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:var(--gold);color:var(--navy);padding:12px 24px;font-size:12px;font-weight:500;letter-spacing:.08em;z-index:9999;animation:fadeUp .3s';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', e => { if(e.target===o) o.classList.remove('open'); }));
init();
