/* president.html — core UI functions */

// ── DATA ──────────────────────────────────────────────────────────────────
const BOARD = [];
const TASKS = [];
const NOTIFICATIONS = [];

// ── STATE ──────────────────────────────────────────────────────────────────
let currentStep = 1;
let totalSteps = 5;
let isGeneratingTasks = false;

// ── INIT ──────────────────────────────────────────────────────────────────
function init() {
  renderRoleDeliverableInputs();
  renderWorkloadGrid();
  renderAllTasks();
  renderApprovals();
  renderOverdue();
  renderEvents();
  renderDependencyGraph();
  renderCalendar();
  renderDivisions();
  renderTemplates();
  startPolling();
}

// ── NAVIGATION ────────────────────────────────────────────────────────────
function showPage(id, param) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + id);
  if (el) el.classList.add('active');
  document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
  if (param) {
    document.getElementById('event-panel-name').textContent = param;
    renderEventPanel(param);
  }
  const titles = {
    'overview':'Command Center','tasks-all':'All Tasks','approvals':'Approval Queue',
    'overdue':'Overdue & Alerts','events':'Events','event-panel':'Event Control Panel',
    'dependency':'Dependency Graph','calendar':'Calendar',
    'internal-div':'Internal Division','external-div':'External Division','exec-div':'Executive Division',
    'templates':'Event Templates','reports':'Reports','newsletter':'Newsletter','site-content':'Index & Board','seed-users':'Seed users',
  };
  document.getElementById('page-title').textContent = titles[id] || id;
  if (id === 'seed-users') loadSeedPage();
  if (id === 'site-content') loadSiteContentPage();
  if (id === 'newsletter') loadNewsletterPage();
}

// ── RENDER WORKLOAD GRID ──────────────────────────────────────────────────
function renderWorkloadGrid() {
  const divs = ['internal','external'];
  const container = document.getElementById('workload-grid');
  container.innerHTML = '';
  divs.forEach(div => {
    const members = BOARD.filter(b => b.div === div);
    members.forEach(m => {
      const pct = (m.tasks / m.max) * 100;
      const cls = m.tasks >= m.max ? 'wl-over' : m.tasks >= m.max - 1 ? 'wl-warn' : 'wl-ok';
      container.innerHTML += `
        <div class="dept-block">
          <div class="dept-name">${m.dept}</div>
          <div class="dept-member">
            <span>${m.name.split(' ')[0]}</span>
            <span style="color:${m.tasks>=m.max?'var(--red)':m.tasks>=m.max-1?'var(--amber)':'var(--green)'}">${m.tasks}/${m.max}</span>
          </div>
          <div class="workload-bar"><div class="workload-fill ${cls}" style="width:${Math.min(pct,100)}%"></div></div>
        </div>`;
    });
  });
}

// ── RENDER ALL TASKS ──────────────────────────────────────────────────────
function renderAllTasks(filter = 'all') {
  const list = document.getElementById('all-tasks-list');
  let tasks = TASKS;
  if (filter === "urgent") {
    const soonMs = 1000 * 60 * 60 * 24 * 3;
    tasks = tasks.filter((t) => {
      const due = t.due_at ? new Date(t.due_at).getTime() : NaN;
      const dueSoon = Number.isFinite(due) && due > Date.now() && due - Date.now() <= soonMs;
      return String(t.priority || "").toLowerCase() === "critical" || dueSoon || t.status === "overdue";
    });
  } else if (filter !== 'all') {
    tasks = tasks.filter(t => t.status === filter);
  }
  list.innerHTML = tasks.map(t => taskCard(t, true)).join('');
}

function taskCard(t, isAdmin=false) {
  const statusMap = {done:'sb-done',current:'sb-current',locked:'sb-locked',overdue:'sb-urgent',pending:'sb-pending',redo:'sb-redo'};
  const stripeMap = {done:'done',current:'current',locked:'locked',overdue:'urgent',pending:'current',redo:'redo'};
  const statusLabel = {done:'Completed',current:'In Progress',locked:'Locked',overdue:'Overdue',pending:'Pending Review',redo:'Redo'};
  return `
    <div class="task-item" onclick="inspectTask(${t.id})">
      <div class="task-stripe ${stripeMap[t.status] || 'locked'}"></div>
      <div>
        <div class="task-title">${t.title}</div>
        <div class="task-meta">
          <span>${t.assigned}</span>
          <span>${t.dept}</span>
          <span>Due ${t.due}</span>
          ${t.event ? `<span style="color:var(--gold)">${t.event}</span>` : ''}
        </div>
      </div>
      <div class="task-actions">
        <span class="status-badge ${statusMap[t.status] || 'sb-locked'}">${statusLabel[t.status] || t.status}</span>
        <button class="btn btn-outline" style="font-size:9px;padding:4px 10px" onclick="event.stopPropagation();inspectTask(${t.id})">Click to Review</button>
        ${isAdmin && t.status === 'pending' ? `<button class="btn btn-green" style="font-size:9px;padding:4px 10px" onclick="event.stopPropagation();approveTaskById(${t.id})">Approve</button>` : ''}
        ${isAdmin && t.status === 'overdue' ? `<button class="btn btn-outline" style="font-size:9px;padding:4px 10px" onclick="event.stopPropagation();extendTaskDeadline(${t.id})">Extend</button>` : ''}
      </div>
    </div>`;
}

function filterTasks(filter, el) {
  document.querySelectorAll('.div-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderAllTasks(filter);
}

// ── APPROVALS ─────────────────────────────────────────────────────────────
function renderApprovals() {
  const pending = TASKS.filter(t => t.status === 'pending');
  const cont = document.getElementById('full-approval-list');
  cont.innerHTML = pending.map(t => `
    <div class="approval-item">
      <div class="approval-header">
        <div>
          <div class="approval-task">${t.title}</div>
          <div class="approval-by">${t.assigned} · ${t.dept} · ${t.event}</div>
          ${t.summary ? `<div style="font-size:11px;color:var(--silver);margin-top:6px">${t.summary}</div>` : ''}
        </div>
        <div class="approval-actions">
          <button class="btn btn-green" style="font-size:9px;padding:5px 12px" onclick="approveTaskById(${t.id})">Approve</button>
          <button class="btn btn-red" style="font-size:9px;padding:5px 12px" onclick="openRedoModal()">Redo</button>
        </div>
      </div>
    </div>`).join('') || '<div style="color:var(--silver);font-size:13px;padding:16px">No pending submissions.</div>';
}

function approveTask(btn) {
  btn.closest('.approval-item').style.opacity = '.4';
  btn.textContent = '✓ Approved';
  btn.disabled = true;
  updateBadge('approval-badge', -1);
}
function approveTaskById(id) {
  const t = TASKS.find(x => x.id === id);
  if (t) t.status = 'done';
  renderApprovals(); renderAllTasks();
  updateBadge('approval-badge', -1);
}

// ── OVERDUE ───────────────────────────────────────────────────────────────
function renderOverdue() {
  const overdue = TASKS.filter(t => t.status === 'overdue');
  const cont = document.getElementById('overdue-list');
  cont.innerHTML = overdue.map(t => `
    <div class="overdue-alert">
      <div class="alert-icon">⚠</div>
      <div class="alert-body">
        <div class="alert-title">${t.title}</div>
        <div class="alert-sub">${t.assigned} · ${t.dept} · Due ${t.due} · ${t.event}</div>
        <div class="alert-actions">
          <button class="btn btn-outline" style="font-size:9px;padding:5px 12px" onclick="extendTaskDeadline(${t.id})">Extend Deadline</button>
          <button class="btn btn-outline" style="font-size:9px;padding:5px 12px" onclick="reassignOverdueTask(${t.id})">Reassign</button>
          <button class="btn btn-outline" style="font-size:9px;padding:5px 12px" onclick="markTaskOverdue(${t.id})">Mark Overdue</button>
          <button class="btn btn-red" style="font-size:9px;padding:5px 12px" onclick="openRedoModal()">Mark Redo</button>
        </div>
      </div>
    </div>`).join('');
}

// ── EVENTS ────────────────────────────────────────────────────────────────
const EVENTS_DATA = [];
function renderEvents() {
  const grid = document.getElementById('events-grid');
  const current = EVENTS_DATA.filter((e) => !e.isPast);
  const past = EVENTS_DATA.filter((e) => e.isPast);
  const renderEventCard = (e, sectionLabel) => `
    <div class="event-card" onclick="openPresidentEventDetail(${Number(e.id || 0)})" style="cursor:pointer">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start">
        <div>
          <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--silver);margin-bottom:6px">${(e.date || "").toUpperCase()} · ${(e.venue || e.location || "TBD Location").toUpperCase()}</div>
          <div class="event-name">${e.name}</div>
          <div class="event-meta">
            <span class="event-meta-tag">${e.type || "Event"}</span>
            <span class="event-meta-tag">${sectionLabel}</span>
          </div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:8px">
          <div style="text-align:right">
            <div style="font-family:var(--font-display);font-size:34px;color:var(--white);line-height:1">${Math.max(0, Number(e.progress || 0))}%</div>
            <div style="font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--silver)">Complete</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <button class="btn btn-outline" style="font-size:9px;padding:4px 10px" onclick="event.stopPropagation();editEventLive(${Number(e.id || 0)}, '${String(e.name || "").replaceAll("'", "\\'")}')">Edit</button>
            <button class="btn btn-red" style="font-size:9px;padding:4px 10px" onclick="event.stopPropagation();deleteEventLive(${Number(e.id || 0)})">Delete</button>
          </div>
        </div>
      </div>
      <div style="height:1px;background:rgba(184,154,92,.45);margin:10px 0"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="padding:10px;background:rgba(122,152,212,.08);border:1px solid rgba(123,163,212,.22)">
          <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--silver)">Your Tasks</div>
          <div style="font-family:var(--font-display);font-size:22px;color:var(--white)">${Number(e.tasks || 0)}</div>
        </div>
        <div style="padding:10px;background:rgba(76,175,125,.08);border:1px solid rgba(76,175,125,.22)">
          <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--silver)">Done</div>
          <div style="font-family:var(--font-display);font-size:22px;color:var(--green)">${Number(e.done || 0)}</div>
        </div>
      </div>
    </div>`;
  grid.innerHTML = `
    <div class="card">
      <div class="section-label">Current</div>
      <div class="card-title" style="margin-bottom:10px">Current Events</div>
      ${current.length ? current.map((e) => renderEventCard(e, "Current")).join("") : '<div style="font-size:12px;color:var(--silver)">No current events.</div>'}
    </div>
    <div class="card">
      <div class="section-label">Past</div>
      <div class="card-title" style="margin-bottom:10px">Past Events</div>
      ${past.length ? past.map((e) => renderEventCard(e, "Past")).join("") : '<div style="font-size:12px;color:var(--silver)">No past events.</div>'}
    </div>`;
}

function renderEventPanel(name) {
  const ev = EVENTS_DATA.find(e => e.name === name) || EVENTS_DATA[0];
  if (!ev) {
    document.getElementById('event-stats').innerHTML = '<div style="color:var(--silver);font-size:12px">No event selected.</div>';
    document.getElementById('dept-progress').innerHTML = '';
    document.getElementById('event-tasks-list').innerHTML = '';
    return;
  }
  document.getElementById('event-stats').innerHTML = `
    <div class="stat-card"><div class="stat-num">${ev.tasks}</div><div class="stat-label">Total Tasks</div></div>
    <div class="stat-card"><div class="stat-num green">${ev.done}</div><div class="stat-label">Completed</div></div>
    <div class="stat-card"><div class="stat-num amber">${ev.tasks - ev.done - ev.overdue}</div><div class="stat-label">In Progress</div></div>
    <div class="stat-card"><div class="stat-num red">${ev.overdue}</div><div class="stat-label">Overdue</div></div>
    <div class="stat-card"><div class="stat-num">${ev.progress}%</div><div class="stat-label">Complete</div></div>`;
  const depts = {};
  TASKS.filter((t) => t.event === name).forEach((t) => {
    const k = t.dept || "Other";
    if (!depts[k]) depts[k] = { total: 0, done: 0 };
    depts[k].total += 1;
    if (t.status === "done") depts[k].done += 1;
  });
  document.getElementById('dept-progress').innerHTML = Object.keys(depts).map((d) => {
    const pct = Math.round((depts[d].done / Math.max(1, depts[d].total)) * 100);
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--silver);margin-bottom:3px"><span>${d}</span><span>${pct}%</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('') || '<div style="color:var(--silver);font-size:12px">No department progress yet.</div>';
  const evTasks = TASKS.filter(t => t.event === name);
  document.getElementById('event-tasks-list').innerHTML = evTasks.map(t => taskCard(t, true)).join('');
}

function openPresidentEventDetail(eventId) {
  const cache = window.__presidentDashboardCache || {};
  const event = (cache.events || []).find((e) => Number(e.id) === Number(eventId))
    || EVENTS_DATA.find((e) => Number(e.id) === Number(eventId));
  if (!event) return;
  const tasks = (cache.tasks || []).filter((t) => Number(t.event_id) === Number(event.id));
  const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const kv = (label, value) => `<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)"><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);margin-bottom:4px">${label}</div><div style="font-size:12px;color:var(--off-white)">${value || "—"}</div></div>`;
  const body = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
      <span class="event-meta-tag">${(event.isPast || Number(event.progress || 0) >= 100 || String(event.status || "").toLowerCase() === "completed" || (Number.isFinite(new Date(event.event_date).getTime()) && new Date(event.event_date).getTime() < Date.now())) ? "Past" : "Current"}</span>
      <span class="event-meta-tag">${esc(event.type || event.event_type || "Event")}</span>
      <span class="event-meta-tag">${Number(event.progress || 0)}% Complete</span>
    </div>
    ${kv("Date", esc(event.date || (event.event_date ? new Date(event.event_date).toLocaleDateString() : "")))}
    ${kv("Venue", esc(event.venue || ""))}
    ${kv("Location", esc(event.location || ""))}
    ${kv("Scope", esc(event.scope || ""))}
    ${kv("Budget", event.budget_limit != null && event.budget_limit !== "" ? `$${Number(event.budget_limit).toLocaleString()}` : "—")}
    ${kv("Planning Notes", esc(event.planning_notes || ""))}
    ${kv("Timeline Assumptions", esc(event.timeline_assumptions || ""))}
    ${kv("Roles", esc(Array.isArray(event.roles_json) ? event.roles_json.join(", ") : Array.isArray(event.roles) ? event.roles.join(", ") : ""))}
    ${kv("Divisions", esc(Array.isArray(event.divisions_json) ? event.divisions_json.join(", ") : Array.isArray(event.divisions) ? event.divisions.join(", ") : ""))}
    <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)"><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);margin-bottom:4px">Deliverables</div><pre style="white-space:pre-wrap;margin:0;font-size:12px;color:var(--off-white)">${esc(JSON.stringify(event.deliverables_json || event.deliverables || {}, null, 2))}</pre></div>
    <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)"><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);margin-bottom:4px">Constraints</div><pre style="white-space:pre-wrap;margin:0;font-size:12px;color:var(--off-white)">${esc(JSON.stringify(event.constraints_json || event.constraints || {}, null, 2))}</pre></div>
    <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--silver);margin:12px 0 8px">All Tasks for This Event</div>
    <div class="task-list">${tasks.length ? tasks.map((t) => `
      <div class="task-item" onclick="inspectTask(${Number(t.id)})">
        <div class="task-stripe ${t.status === "completed" ? "done" : t.status === "overdue" ? "urgent" : t.status === "redo" ? "redo" : "current"}"></div>
        <div>
          <div class="task-title">${esc(t.title)}</div>
          <div class="task-meta"><span>${esc(t.owner_name)}</span><span>${esc(t.department)}</span><span>Due ${new Date(t.due_at).toLocaleDateString()}</span></div>
        </div>
        <div class="task-actions"><span class="status-badge ${t.status === "completed" ? "sb-done" : t.status === "pending_review" ? "sb-pending" : t.status === "overdue" ? "sb-urgent" : t.status === "redo" ? "sb-redo" : "sb-current"}">${typeof statusDisplayLabel === "function" ? statusDisplayLabel(t.status) : String(t.status || "").replaceAll("_", " ")}</span></div>
      </div>`).join("") : '<div style="font-size:12px;color:var(--silver)">No tasks linked to this event yet.</div>'}</div>
  `;
  const titleEl = document.getElementById("event-detail-title");
  const bodyEl = document.getElementById("event-detail-body");
  if (titleEl) titleEl.textContent = event.name || "Event Detail";
  if (bodyEl) bodyEl.innerHTML = body;
  openModal("eventDetailModal");
}

// ── WORKLOAD DETAIL ───────────────────────────────────────────────────────
function renderWorkloadDetail() {
  const cont = document.getElementById('workload-detail');
  cont.innerHTML = BOARD.filter(b => b.div !== 'exec').map(m => {
    const pct = (m.tasks / m.max) * 100;
    const cls = m.tasks >= m.max ? 'wl-over' : m.tasks >= m.max - 1 ? 'wl-warn' : 'wl-ok';
    const warn = m.tasks >= m.max ? `<span style="color:var(--red);font-size:10px;margin-left:8px">⚠ Overloaded</span>` : m.tasks >= m.max - 1 ? `<span style="color:var(--amber);font-size:10px;margin-left:8px">⚡ Near limit</span>` : '';
    return `<div style="background:var(--navy-light);padding:14px;border:1px solid rgba(255,255,255,.05)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div><span style="font-size:13px;color:var(--white)">${m.name}</span><span style="font-size:10px;color:var(--silver);margin-left:10px">${m.role}</span>${warn}</div>
        <span style="font-size:13px;color:${m.tasks>=m.max?'var(--red)':m.tasks>=m.max-1?'var(--amber)':'var(--green)'}">${m.tasks}/${m.max} tasks</span>
      </div>
      <div class="workload-bar"><div class="workload-fill ${cls}" style="width:${Math.min(pct,100)}%"></div></div>
    </div>`;
  }).join('');
}

var DEP_NODE_TITLE_MAX = 36;
function truncateDepTitle(s) {
  if (!s || typeof s !== "string") return "";
  return s.length <= DEP_NODE_TITLE_MAX ? s : s.slice(0, DEP_NODE_TITLE_MAX - 1) + "…";
}
function statusDisplayLabel(status) {
  var s = String(status || "").toLowerCase().replace(/_/g, " ");
  var map = { overdue: "Overdue", current: "Current", completed: "Completed", done: "Completed", locked: "Locked", pending: "Pending", pending_review: "Pending Review", redo: "Redo" };
  return map[s] || (s ? s.charAt(0).toUpperCase() + s.slice(1) : status);
}
// ── DEPENDENCY GRAPH ──────────────────────────────────────────────────────
window.setPresDepEvent = function setPresDepEvent(eventIdVal) {
  const dash = window.PRESIDENT_DASHBOARD;
  if (!dash || !dash.tasks) return;
  const eventId = eventIdVal ? Number(eventIdVal) : null;
  const sel = document.getElementById("pres-dep-event-select");
  const nameEl = document.getElementById("pres-dep-event-name");
  if (sel) sel.value = eventId != null ? String(eventId) : "";
  const events = dash.events || [];
  const ev = eventId ? events.find((e) => Number(e.id) === eventId) : null;
  if (nameEl) nameEl.textContent = ev ? ev.name : "All events";
  const tasks = eventId ? dash.tasks.filter((t) => Number(t.event_id) === eventId) : dash.tasks;
  const taskIds = new Set(tasks.map((t) => t.id));
  const deps = (dash.dependencies || []).filter((d) => taskIds.has(d.task_id) && taskIds.has(d.depends_on_task_id));
  const g = document.getElementById("dep-graph-content");
  if (g && typeof renderDependencyGraph === "function") renderDependencyGraph(g, tasks, deps);
};
window.togglePresDepEventDropdown = function() {
  const wrap = document.getElementById("pres-dep-picker-wrap");
  if (wrap) wrap.classList.toggle("open");
};
window.pickPresDepEvent = function(value) {
  const wrap = document.getElementById("pres-dep-picker-wrap");
  if (wrap) wrap.classList.remove("open");
  setPresDepEvent(value || null);
};
function renderDependencyGraph(_root, tasksOverride) {
  const g = document.getElementById('dep-graph-content');
  if (!g) return;
  const srcTasks = Array.isArray(tasksOverride) ? tasksOverride : TASKS;
  const tasks = srcTasks.map((t) => ({
    title: t.title,
    dept: t.dept || t.department || "",
    status: t.status,
    dep: Array.isArray(t.dep) ? t.dep : []
  }));
  if (!tasks.length) {
    g.innerHTML = '<div style="color:var(--silver);font-size:12px">No dependency data yet.</div>';
    return;
  }
  const rows = tasks.slice(0, 6).map((t) => [
    { title: truncateDepTitle(t.title), dept: t.dept, status: t.status },
    { arrow: true },
    { title: t.dep?.length ? "Depends on " + t.dep.length + " task(s)" : "Ready", dept: t.dept, status: t.dep?.length ? "locked" : "current" }
  ]);
  g.innerHTML = rows
    .map(
      (seq) =>
        `<div class="dep-row">${seq
          .map((n) => {
            if (n.arrow) return `<div class="dep-arrow">→</div>`;
            const cls = n.status === "done" ? "done-node" : n.status === "current" || n.status === "pending" ? "active-node" : "locked-node";
            return `<div class="dep-node ${cls}"><div class="dep-dept">${n.dept}</div>${truncateDepTitle(n.title)}</div>`;
          })
          .join("")}</div>`
    )
    .join("");
}

// ── CALENDAR ──────────────────────────────────────────────────────────────
function renderCalendar() {
  const root = document.getElementById('cal-content');
  if (!root) return;
  if (!TASKS.length && !EVENTS_DATA.length) {
    root.innerHTML = '<div style="color:var(--silver);font-size:12px">No calendar items yet.</div>';
    return;
  }
  const lines = [
    ...EVENTS_DATA.slice(0, 8).map((e) => `Event: ${e.name} (${e.date})`),
    ...TASKS.slice(0, 12).map((t) => `Task due: ${t.title} (${t.due})`)
  ];
  root.innerHTML = lines.map((l) => `<div class="cal-task-line" style="padding:4px 0">${l}</div>`).join('');
}

// ── DIVISIONS ─────────────────────────────────────────────────────────────
function renderDivisions() {
  const mk = (members, taskKey, cardId) => {
    const cont = document.getElementById(cardId);
    if (!cont) return;
    cont.innerHTML = members.map(m => {
      const t = TASKS.filter(tk => tk.assigned === m.name);
      const pct = (m.tasks / m.max) * 100;
      return `<div class="card-sm">
        <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:6px">${m.dept}</div>
        <div style="font-size:15px;font-family:var(--font-display);color:var(--white);margin-bottom:2px">${m.name}</div>
        <div style="font-size:11px;color:var(--silver);margin-bottom:10px">${m.role}</div>
        <div class="workload-bar"><div class="workload-fill ${m.tasks>=m.max?'wl-over':m.tasks>=m.max-1?'wl-warn':'wl-ok'}" style="width:${Math.min(pct,100)}%"></div></div>
        <div style="font-size:10px;color:var(--silver);margin-top:4px">${m.tasks} active tasks</div>
      </div>`;
    }).join('');
  };
  mk(BOARD.filter(b => b.div === 'exec'), '', 'exec-member-cards');
  mk(BOARD.filter(b => b.div === 'internal'), '', 'internal-member-cards');
  mk(BOARD.filter(b => b.div === 'external'), '', 'external-member-cards');

  document.getElementById('internal-tasks-list').innerHTML = TASKS.filter(t => BOARD.find(b => b.name === t.assigned && b.div === 'internal')).map(t => taskCard(t, true)).join('');
  document.getElementById('external-tasks-list').innerHTML = TASKS.filter(t => BOARD.find(b => b.name === t.assigned && b.div === 'external')).map(t => taskCard(t, true)).join('');
}

// ── PERFORMANCE ──────────────────────────────────────────────────────────
function renderPerformance() {
  const byDept = {};
  TASKS.forEach((t) => {
    const key = t.dept || "Other";
    if (!byDept[key]) byDept[key] = { total: 0, done: 0 };
    byDept[key].total += 1;
    if (t.status === "done") byDept[key].done += 1;
  });
  const depts = Object.keys(byDept);
  const vals = depts.map((d) => Math.round((byDept[d].done / Math.max(1, byDept[d].total)) * 100));
  const chart = document.getElementById('perf-chart');
  chart.innerHTML = depts.length ? depts.map((d,i) => `
    <div class="perf-bar-wrap">
      <div class="perf-val">${vals[i]}%</div>
      <div class="perf-bar" style="height:${vals[i]}px"></div>
      <div class="perf-label">${d}</div>
    </div>`).join('') : '<div style="color:var(--silver);font-size:12px">No performance data yet.</div>';

  const stats = document.getElementById('member-stats');
  stats.innerHTML = BOARD.filter(b => b.div !== 'exec').map(m => {
    const mine = TASKS.filter((t) => t.assigned === m.name);
    const done = mine.filter((t) => t.status === "done").length;
    const rate = Math.round((done / Math.max(1, mine.length)) * 100);
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04)">
      <div><div style="font-size:12px;color:var(--white)">${m.name.split(' ')[0]}</div><div style="font-size:10px;color:var(--silver)">${m.role.substring(0,32)}...</div></div>
      <div style="text-align:right"><div style="font-size:13px;color:${rate>=85?'var(--green)':rate>=70?'var(--amber)':'var(--red)'}">${rate}%</div><div style="font-size:9px;color:var(--silver)">completion</div></div>
    </div>`;
  }).join('') || '<div style="color:var(--silver);font-size:12px">No member metrics yet.</div>';

  document.getElementById('redo-list').innerHTML = TASKS.filter(t => t.status === 'redo').slice(0,3).map(t => taskCard(t)).join('') || '<div style="color:var(--silver);font-size:13px;padding:8px">No recent redo requests.</div>';
}

// ── DIGEST ────────────────────────────────────────────────────────────────
function renderDigest() {
  const done = TASKS.filter((t) => t.status === "done");
  const overdue = TASKS.filter((t) => t.status === "overdue");
  const current = TASKS.filter((t) => t.status === "current");
  document.getElementById('digest-content').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div><div class="section-label">Completions</div>${done.slice(0,5).map((t)=>`<div style="font-size:12px;color:var(--green);padding:8px;background:var(--green-dim)">✓ ${t.title} (${t.assigned})</div>`).join('') || '<div style="font-size:12px;color:var(--silver);padding:8px;background:var(--navy-light)">No completed tasks this period.</div>'}</div>
      <div><div class="section-label">Overdue</div>${overdue.slice(0,5).map((t)=>`<div style="font-size:12px;color:var(--red);padding:8px;background:var(--red-dim)">⚠ ${t.title} (${t.assigned})</div>`).join('') || '<div style="font-size:12px;color:var(--silver);padding:8px;background:var(--navy-light)">No overdue tasks.</div>'}</div>
      <div><div class="section-label">In Progress</div>${current.slice(0,5).map((t)=>`<div style="font-size:12px;color:var(--silver);padding:8px;background:var(--navy-light)">${t.title} (${t.assigned})</div>`).join('') || '<div style="font-size:12px;color:var(--silver);padding:8px;background:var(--navy-light)">No in-progress tasks.</div>'}</div>
      <div><div class="section-label">Event Risk</div><div style="padding:12px;background:var(--amber-dim);border:1px solid rgba(212,145,74,.3);font-size:11px;color:var(--silver)">Risks are generated from live overdue and pending-review task counts.</div></div>
    </div>`;
}

// ── TEMPLATES ─────────────────────────────────────────────────────────────
function renderTemplates() {
  document.getElementById('templates-grid').innerHTML = `
    <div class="card-sm" style="grid-column:1 / -1">
      <div style="font-size:12px;color:var(--silver)">Templates are now generated from event inputs and Gemini output. Use <b>Create Event</b> to generate a live workflow.</div>
    </div>
  `;
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────
function renderNotifications() {
  const list = document.getElementById('notifList');
  list.innerHTML = NOTIFICATIONS.map(n => `
    <div class="notif-item">
      <div class="notif-row">
        <div class="notif-dot"></div>
        <div>
          <div class="notif-item-title">${n.title}</div>
          <div class="notif-item-sub">${n.sub}</div>
          <div class="notif-item-time">${n.time}</div>
        </div>
      </div>
    </div>`).join('');
}

// ── MODALS ────────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
  if (id === 'eventCreateModal') {
    const today = new Date();
    const twoWeeks = new Date(today);
    twoWeeks.setDate(twoWeeks.getDate() + 14);
    const sevenDays = new Date(today);
    sevenDays.setDate(sevenDays.getDate() + 7);
    const evDate = document.getElementById('ev-date');
    const evHard = document.getElementById('ev-hard-deadline');
    if (evDate) evDate.value = twoWeeks.toISOString().slice(0, 10);
    if (evHard) evHard.value = sevenDays.toISOString().slice(0, 10);
    goToCreateStep(1);
    if (typeof attachVenueAutocomplete === 'function') attachVenueAutocomplete();
  }
}
function initVenuePlaces() { window.__googlePlacesReady = true; if (typeof attachVenueAutocomplete === 'function') attachVenueAutocomplete(); }
function attachVenueAutocomplete() {
  if (!window.google || !window.google.maps || !window.google.maps.places) return;
  const input = document.getElementById('ev-venue');
  if (!input || input.getAttribute('data-places-bound')) return;
  input.setAttribute('data-places-bound', '1');
  var umnBounds = new google.maps.LatLngBounds(
    new google.maps.LatLng(44.96, -93.26),
    new google.maps.LatLng(44.99, -93.20)
  );
  var autocomplete = new google.maps.places.Autocomplete(input, {
    types: ['establishment', 'geocode'],
    fields: ['formatted_address', 'name', 'place_id'],
    bounds: umnBounds
  });
  autocomplete.addListener('place_changed', function() {
    var place = autocomplete.getPlace();
    if (place && place.formatted_address) input.value = place.formatted_address;
  });
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function openRedoModal() { openModal('redoModal'); }
function submitRedo() { closeModal('redoModal'); showToast('Redo request sent'); }

function inspectTask(id) {
  window.__presidentInspectTaskId = id;
  const t = TASKS.find(x => x.id === id);
  if (!t) return;
  document.getElementById('inspect-title').textContent = t.title;
  document.getElementById('inspect-body').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="redo-section"><div class="redo-label">Assigned To</div><div class="redo-val">${t.assigned} · ${t.owner_role || t.dept}</div></div>
      <div class="redo-section"><div class="redo-label">Event</div><div class="redo-val">${t.event || 'Standalone'}</div></div>
      <div class="redo-section"><div class="redo-label">Due Date</div><div class="redo-val">${t.due}</div></div>
      <div class="redo-section"><div class="redo-label">Stage</div><div class="redo-val">${t.phase || "Planning"}</div></div>
      <div class="redo-section"><div class="redo-label">Dependencies</div><div class="redo-val">${t.dep.length ? t.dep.map(d => TASKS.find(x=>x.id===d)?.title).join(', ') : 'None'}</div></div>
      ${t.description ? `<div class="redo-section"><div class="redo-label">Description</div><div class="redo-val">${t.description}</div></div>` : ''}
      ${t.notes ? `<div class="redo-section"><div class="redo-label">Notes</div><div class="redo-val">${t.notes}</div></div>` : ''}
      ${t.meeting_location || t.meeting_date ? `<div class="redo-section"><div class="redo-label">Meeting</div><div class="redo-val">${t.meeting_date || ''} ${t.meeting_time || ''} ${t.meeting_location || ''}</div></div>` : ''}
      ${t.meeting_link ? `<div class="redo-section"><div class="redo-label">Meeting Link</div><div class="redo-val"><a href="${t.meeting_link}" target="_blank" rel="noopener noreferrer" style="color:var(--gold-light)">${t.meeting_link}</a></div></div>` : ''}
      ${t.attachments_json && t.attachments_json !== "[]" ? `<div class="redo-section"><div class="redo-label">Attachments</div><div class="redo-val">${t.attachments_json}</div></div>` : ''}
      ${t.summary ? `<div class="redo-section"><div class="redo-label">Completion Summary</div><div class="redo-val">${t.summary}</div></div>` : ''}
    </div>`;
  openModal('taskInspectModal');
}

// ── EVENT CREATE FLOW ─────────────────────────────────────────────────────
function createStep(dir) {
  if (isGeneratingTasks) return;
  const steps = document.querySelectorAll('#create-steps .step');
  if (currentStep === 4 && dir === 1) { generateTasks(); return; }
  currentStep = Math.max(1, Math.min(totalSteps, currentStep + dir));
  document.querySelectorAll('.step-section').forEach(p => p.classList.remove('active'));
  const next = document.getElementById('create-step-' + currentStep);
  if (next) next.classList.add('active');
  steps.forEach((s, i) => {
    s.className = 'step step-tab' + (i + 1 < currentStep ? ' done' : i + 1 === currentStep ? ' active' : '');
  });
  document.getElementById('create-back-btn').style.display = currentStep > 1 ? '' : 'none';
  const nextBtn = document.getElementById('create-next-btn');
  nextBtn.textContent = currentStep === totalSteps ? 'Publish Event' : currentStep === 4 ? 'Generate' : 'Continue →';
  nextBtn.onclick = currentStep === totalSteps ? publishEvent : () => createStep(1);
  const prog = document.getElementById('create-prog-fill');
  if (prog) prog.style.width = (currentStep / totalSteps * 100) + '%';
  const mfTxt = document.getElementById('mf-step-txt');
  if (mfTxt) mfTxt.textContent = 'Step ' + currentStep + ' of ' + totalSteps;
}

function goToCreateStep(stepNumber) {
  const target = Math.max(1, Math.min(totalSteps, Number(stepNumber || 1)));
  currentStep = target;
  const steps = document.querySelectorAll('#create-steps .step');
  document.querySelectorAll('.step-section').forEach(p => p.classList.remove('active'));
  const pane = document.getElementById('create-step-' + currentStep);
  if (pane) pane.classList.add('active');
  steps.forEach((s, i) => {
    s.className = 'step step-tab' + (i + 1 < currentStep ? ' done' : i + 1 === currentStep ? ' active' : '');
  });
  document.getElementById('create-back-btn').style.display = currentStep > 1 ? '' : 'none';
  const nextBtn = document.getElementById('create-next-btn');
  nextBtn.textContent = currentStep === totalSteps ? 'Publish Event' : currentStep === 4 ? 'Generate' : 'Continue →';
  nextBtn.onclick = currentStep === totalSteps ? publishEvent : () => createStep(1);
  const prog = document.getElementById('create-prog-fill');
  if (prog) prog.style.width = (currentStep / totalSteps * 100) + '%';
  const mfTxt = document.getElementById('mf-step-txt');
  if (mfTxt) mfTxt.textContent = 'Step ' + currentStep + ' of ' + totalSteps;
}

function setEvType(el) {
  document.querySelectorAll('#ev-type-grid .type-card').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  const sel = document.getElementById('ev-type');
  if (sel) sel.value = el.getAttribute('data-value') || '';
}
function toggleEvYesNo(fieldId, toggleEl) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  const next = field.value === 'yes' ? 'no' : 'yes';
  field.value = next;
  toggleEl.classList.toggle('on', next === 'yes');
}
function validateBudgetLimit() {
  const input = document.getElementById('ev-budget-limit');
  const hint = document.getElementById('ev-budget-hint');
  if (!input || !hint) return true;
  const raw = (input.value || '').trim();
  if (raw === '') { hint.style.display = 'none'; hint.textContent = ''; return true; }
  const num = Number(raw);
  if (!Number.isFinite(num)) { hint.style.display = 'block'; hint.textContent = 'Enter a valid number.'; return false; }
  if (num < 0) { hint.style.display = 'block'; hint.textContent = 'Budget cannot be below 0.'; return false; }
  if (num > 150000) { hint.style.display = 'block'; hint.textContent = 'Budget cannot exceed 150,000.'; return false; }
  hint.style.display = 'none'; hint.textContent = ''; return true;
}

let genTasks = [];
function generateTasks() {
  const gs = document.getElementById('gen-status');
  if (gs) gs.textContent = 'Preparing Gemini request...';
}

function renderGenTasks() {
  const list = document.getElementById('generated-tasks-list');
  if (!list) return;
  list.innerHTML = genTasks.map((t, i) => {
    const div = t.dept || t.department || "";
    const person = t.ownerSuggestion || t.assigned || "—";
    const role = t.role || "";
    const title = (t.title || "").replace(/</g, "&lt;").replace(/&/g, "&amp;");
    return `<div class="gen-task-card" id="gt-${(t.id || "g"+i)}">
      <div class="gen-task-card-header">
        <div class="gen-task-card-meta">
          <div class="gen-task-card-person">${(person || "—").replace(/</g, "&lt;")}</div>
          <div class="gen-task-card-role">${(role || "").replace(/</g, "&lt;")}</div>
        </div>
        <button type="button" class="btn-icon red" title="Remove" onclick="removeGenTask('${(t.id || "g"+i).toString().replace(/'/g, "\\'")}')">✕</button>
      </div>
      <div class="gen-task-card-title-wrap"><label class="at-fl">Task</label><div class="gen-task-title" style="font-size:13px;color:var(--white)">${title || "—"}</div></div>
      ${t.description ? `<div class="gen-task-card-row"><label class="at-fl">Description</label><div style="font-size:12px;color:var(--silver);line-height:1.5">${(t.description||"").replace(/</g, "&lt;").replace(/&/g, "&amp;")}</div></div>` : ""}
      ${t.phase ? `<div class="gen-task-card-row"><label class="at-fl">Phase</label><div style="font-size:11px;color:var(--silver)">${(t.phase||"").replace(/</g, "&lt;")}</div></div>` : ""}
      ${t.goals ? `<div class="gen-task-card-row"><label class="at-fl">Goals</label><div style="font-size:11px;color:var(--silver)">${(t.goals||"").replace(/</g, "&lt;")}</div></div>` : ""}
      ${t.successCriteria ? `<div class="gen-task-card-row"><label class="at-fl">Success looks like</label><div style="font-size:11px;color:var(--silver)">${(t.successCriteria||"").replace(/</g, "&lt;")}</div></div>` : ""}
      ${t.whatWeDontWant ? `<div class="gen-task-card-row"><label class="at-fl">What we don't want</label><div style="font-size:11px;color:var(--silver)">${(t.whatWeDontWant||"").replace(/</g, "&lt;")}</div></div>` : ""}
    </div>`;
  }).join('');
}

function removeGenTask(id) {
  genTasks = genTasks.filter(t => t.id !== id);
  renderGenTasks();
}

function addGenTask() {
  genTasks.push({
    id: 'g' + (genTasks.length + 10),
    title: 'New Task',
    dept: 'Internal Division',
    department: 'Internal Division',
    role: '',
    ownerSuggestion: '',
    description: '',
    phase: 'Planning',
    goals: '',
    successCriteria: '',
    whatWeDontWant: '',
    priority: 'medium',
    dependsOnTitles: []
  });
  renderGenTasks();
}

function publishEvent() {
  closeModal('eventCreateModal');
  showToast('Event workflow published to the board');
  currentStep = 1;
}

function renderRoleDeliverableInputs() {
  const root = document.getElementById("role-deliverables-container");
  if (!root) return;
  var saved = {};
  root.querySelectorAll("[data-role-deliverable]").forEach(function (el) {
    var key = el.getAttribute("data-role-deliverable");
    if (key) saved[key] = el.value || "";
  });
  const ROLE_PLACEHOLDERS = {
    "Director of Operations": "e.g. Venue contract signed; run-of-show and backstage plan finalized; logistics checklist complete by [date].",
    "Director of Finance & Development - Finance": "e.g. Event budget approved; cost tracking sheet updated; final reconciliation due by [date].",
    "Director of Finance & Development - Development": "e.g. Sponsorship targets confirmed; grant narrative drafted; funding checklist by [date].",
    "Director of Events & Experiences": "e.g. Event day timeline locked; volunteer assignments and run-of-show shared with ops by [date].",
    "Executive Producer, Somali Night — Production": "e.g. Rehearsal schedule and run-of-show finalized; technical and backstage coordination confirmed by [date].",
    "Director of Brand & Marketing": "e.g. Campaign assets and social calendar approved; promo materials ready for review by [date].",
    "Director of Strategic Relations & Advancement": "e.g. Sponsor commitments and outreach log updated; partnership deliverables by [date].",
    "Director of Editorial & Communications": "e.g. Announcements, captions, and event copy finalized; newsletter blurb by [date].",
    "Director of Campus Activation": "e.g. Campus outreach plan and tabling schedule confirmed; activation checklist by [date].",
    "Executive Producer, Somali Night — Creative": "e.g. Creative direction and content milestones approved; creative handoff to production by [date].",
    "Executive President": "e.g. Executive sign-off on scope and timeline; key decisions documented by [date].",
    "Vice President, Chief of Internal Affairs": "e.g. Internal division alignment and resource check; internal sign-off by [date].",
    "Vice President, Chief of External Affairs": "e.g. External division alignment and partner check; external sign-off by [date]."
  };
  const roles = [...document.querySelectorAll("#dept-checkboxes .cb-item.checked")]
    .map((el) => el.getAttribute("data-role") || el.textContent.trim())
    .filter(Boolean);
  root.innerHTML = roles.length
    ? roles
        .map(
          (role) => {
            var key = role.replaceAll('"', "&quot;");
            var val = saved[key] != null ? saved[key] : "";
            var placeholder = ROLE_PLACEHOLDERS[role] || "e.g. Finalize key deliverables by [date]; share with relevant teams for sign-off.";
            return `<div class="ce-fg"><label class="ce-fl">${role.replace(/</g, "&lt;")}</label><textarea class="ce-fi" data-role-deliverable="${key}" placeholder="${placeholder.replace(/"/g, "&quot;")}" style="min-height:60px">${(val || "").replace(/</g, "&lt;").replace(/&/g, "&amp;")}</textarea></div>`;
          }
        )
        .join("")
    : '<div style="font-size:12px;color:var(--silver)">Select roles above to define deliverables.</div>';
}

function toggleCb(el) {
  el.classList.toggle('checked');
  renderRoleDeliverableInputs();
}

// ── POLLING ───────────────────────────────────────────────────────────────
function startPolling() {
  // Polling is handled by the live API integration layer.
}

// ── BADGE ─────────────────────────────────────────────────────────────────
function updateBadge(id, delta) {
  const el = document.getElementById(id);
  if (!el) return;
  const val = Math.max(0, parseInt(el.textContent) + delta);
  el.textContent = val;
  if (val === 0) el.style.display = 'none';
}

// ── TOAST ─────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:var(--gold);color:var(--navy);padding:12px 24px;font-size:12px;font-weight:500;letter-spacing:.08em;z-index:9999;animation:fadeUp .3s ease';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── SEED USERS (sqlite.js) ──────────────────────────────────────────────────
window.loadSeedPage = async function loadSeedPage() {
  const ta = document.getElementById('seed-users-snippet');
  const status = document.getElementById('seed-status');
  const githubLink = document.getElementById('seed-open-github');
  if (status) status.textContent = 'Loading…';
  try {
    const token = typeof getSessionToken === 'function' ? getSessionToken() : '';
    const [snippetRes, repoRes] = await Promise.all([
      fetch('/api/admin/seed-users-snippet', { headers: { 'x-session-token': token } }),
      fetch('/api/admin/github-repo', { headers: { 'x-session-token': token } })
    ]);
    if (snippetRes.ok) {
      const data = await snippetRes.json();
      if (ta) ta.value = data.content || '';
    }
    if (status) status.textContent = '';
    if (githubLink && repoRes.ok) {
      const repo = await repoRes.json().catch(() => ({}));
      const url = repo.url;
      const branch = repo.branch || 'main';
      if (url) {
        const base = url.replace(/\/$/, '');
        githubLink.href = base + '/blob/' + encodeURIComponent(branch) + '/sqlite.js';
        githubLink.style.display = '';
      } else {
        githubLink.style.display = 'none';
      }
    } else {
      if (githubLink) githubLink.style.display = 'none';
    }
  } catch (_e) {
    if (status) status.textContent = '';
    if (githubLink) githubLink.style.display = 'none';
  }
};
window.pushSeedToGitHub = async function pushSeedToGitHub() {
  const ta = document.getElementById('seed-users-snippet');
  const status = document.getElementById('seed-status');
    if (!ta || !ta.value.trim()) { showToast('Paste or edit the seedUsers() function first.'); return; }
  if (status) status.textContent = 'Pushing to GitHub…';
  try {
    const token = typeof getSessionToken === 'function' ? getSessionToken() : '';
    const res = await fetch('/api/admin/seed-users-push', {
      method: 'POST',
      headers: { 'x-session-token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: ta.value })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Push failed');
    if (status) status.textContent = 'Pushed to GitHub successfully.';
  } catch (e) {
    if (status) status.textContent = 'Error: ' + (e.message || 'Push failed');
    showToast(e.message || 'Push failed');
  }
};

// ── INDEX & BOARD (site content) ───────────────────────────────────────────
let siteContentGallery = [];
let siteContentBoard = [];
let siteContentEvents = [];
window.loadSiteContentPage = async function loadSiteContentPage() {
  try {
    const pubRes = await fetch('/api/public/site-content');
    const pub = pubRes.ok ? await pubRes.json() : {};
    siteContentGallery = pub.galleryImages || [];
    siteContentBoard = pub.boardMembers || [];
    siteContentEvents = Array.isArray(pub.events) ? pub.events : [];
    renderSiteGalleryList();
    renderSiteBoardList();
    renderSiteEventsList();
  } catch (_e) {
    siteContentGallery = [];
    siteContentBoard = [];
    siteContentEvents = [];
    renderSiteGalleryList();
    renderSiteBoardList();
    renderSiteEventsList();
  }
};
window.openViewBoard = async function openViewBoard() {
  try {
    const res = await fetch('/api/public/site-content');
    const data = await res.json().catch(function () { return {}; });
    if (res.ok && Array.isArray(data.boardMembers)) {
      siteContentBoard = data.boardMembers;
      renderSiteBoardList();
      openModal('site-board-modal');
    } else {
      siteContentBoard = [];
      renderSiteBoardList();
      openModal('site-board-modal');
    }
  } catch (e) {
    showToast(e.message || 'Could not load board.');
  }
};
function renderSiteGalleryList() {
  var filename = function (img) { return (img.src || '').split('/').pop() || ''; };
  function itemHtml(img, i) {
    var src = img.src && img.src.startsWith('/') ? (window.location.origin + img.src) : (img.src || '');
    var fn = (filename(img) || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    var moveUp = i > 0 ? '<button type="button" class="site-gallery-move" onclick="siteMoveGalleryPhoto(' + i + ', -1)" title="Move up" aria-label="Move up">↺</button>' : '';
    var moveDown = i < siteContentGallery.length - 1 ? '<button type="button" class="site-gallery-move" onclick="siteMoveGalleryPhoto(' + i + ', 1)" title="Move down" aria-label="Move down">↻</button>' : '';
    return '<div class="site-gallery-row">' +
      '<div class="site-gallery-order-btns">' + moveUp + moveDown + '</div>' +
      '<div class="site-gallery-item"><img src="' + (src || '') + '" alt="" /><button type="button" class="site-gallery-remove" data-filename="' + fn + '" onclick="siteRemoveGalleryPhoto(this.getAttribute(\'data-filename\'))" aria-label="Remove">×</button></div>' +
      '</div>';
  }
  var html = siteContentGallery.length === 0
    ? '<span style="font-size:12px;color:var(--silver)">No photos yet. Add above or in View Gallery.</span>'
    : siteContentGallery.map(function (img, i) { return itemHtml(img, i); }).join('');
  var el = document.getElementById('site-gallery-list');
  if (el) el.innerHTML = html;
  var modalList = document.getElementById('site-gallery-modal-list');
  if (modalList) modalList.innerHTML = siteContentGallery.length === 0 ? '<span style="font-size:12px;color:var(--silver)">No photos. Click or drag to add.</span>' : siteContentGallery.map(function (img, i) { return itemHtml(img, i); }).join('');
}

function renderSiteEventsList() {
  var root = document.getElementById('site-events-list');
  if (!root) return;
  if (!Array.isArray(siteContentEvents) || siteContentEvents.length === 0) {
    root.innerHTML = '<div style="font-size:12px;color:var(--silver)">No events yet. Click “Add event” to create one.</div>';
    return;
  }
  var html = siteContentEvents.map(function (e, idx) {
    var ev = e || {};
    return '<div class="site-events-card">' +
      '<div class="site-events-main">' +
        '<div class="site-events-col">' +
          '<div>' +
            '<div class="site-events-label">Day / Month</div>' +
            '<div class="site-events-row">' +
              '<input type="text" maxlength="2" class="site-events-input" style="width:56px;text-align:center" value="' + (ev.day || '') + '" onchange="siteUpdateEventField(' + idx + ',\'day\',this.value)" />' +
              '<input type="text" maxlength="3" class="site-events-input" style="width:72px;text-transform:uppercase;text-align:center" value="' + (ev.month || '') + '" onchange="siteUpdateEventField(' + idx + ',\'month\',this.value)" />' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<div class="site-events-label">Tag</div>' +
            '<input type="text" class="site-events-input" value="' + (ev.tag || '') + '" onchange="siteUpdateEventField(' + idx + ',\'tag\',this.value)" />' +
          '</div>' +
        '</div>' +
        '<div class="site-events-col">' +
          '<div>' +
            '<div class="site-events-label">Title</div>' +
            '<input type="text" class="site-events-input" style="width:100%" value="' + (ev.title || '') + '" onchange="siteUpdateEventField(' + idx + ',\'title\',this.value)" />' +
          '</div>' +
          '<div>' +
            '<div class="site-events-label">Description</div>' +
            '<textarea class="site-events-textarea" style="width:100%" onchange="siteUpdateEventField(' + idx + ',\'description\',this.value)">' + (ev.description || '') + '</textarea>' +
          '</div>' +
          '<div class="site-events-bottom">' +
            '<div>' +
              '<div class="site-events-label">Button text</div>' +
              '<input type="text" class="site-events-input" placeholder="RSVP FORM" value="' + (ev.buttonText || '') + '" onchange="siteUpdateEventField(' + idx + ',\'buttonText\',this.value)" />' +
            '</div>' +
            '<div>' +
              '<div class="site-events-label">Button link</div>' +
              '<input type="text" class="site-events-input" placeholder="https://…" value="' + (ev.link || '') + '" onchange="siteUpdateEventField(' + idx + ',\'link\',this.value)" />' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="site-board-order-btns" style="margin-left:8px;margin-top:4px">' +
        '<button type="button" class="site-board-move" onclick="siteMoveEvent(' + idx + ', -1)" title="Move up" aria-label="Move up">↺</button>' +
        '<button type="button" class="site-board-move" onclick="siteMoveEvent(' + idx + ', 1)" title="Move down" aria-label="Move down">↻</button>' +
        '<button type="button" class="site-board-move" onclick="siteDeleteEvent(' + idx + ')" title="Delete" aria-label="Delete">✕</button>' +
      '</div>' +
    '</div>';
  }).join('');
  root.innerHTML = html;
}

window.siteAddEvent = function siteAddEvent() {
  if (!Array.isArray(siteContentEvents)) siteContentEvents = [];
  siteContentEvents.push({
    id: 'ev-' + Date.now(),
    day: '01',
    month: 'Jan',
    title: 'New Event',
    description: 'Event description.',
    tag: 'Event',
    buttonText: '',
    link: ''
  });
  renderSiteEventsList();
};

window.siteUpdateEventField = function siteUpdateEventField(index, field, value) {
  if (!siteContentEvents[index]) return;
  siteContentEvents[index][field] = value;
  // live preview not wired to public site; just update in-memory list
};

window.siteMoveEvent = function siteMoveEvent(index, delta) {
  var next = index + delta;
  if (next < 0 || next >= siteContentEvents.length) return;
  var arr = siteContentEvents.slice();
  var t = arr[index];
  arr[index] = arr[next];
  arr[next] = t;
  siteContentEvents = arr;
  renderSiteEventsList();
};

window.siteDeleteEvent = function siteDeleteEvent(index) {
  if (!siteContentEvents[index]) return;
  siteContentEvents.splice(index, 1);
  renderSiteEventsList();
};
window.siteMoveGalleryPhoto = function siteMoveGalleryPhoto(index, delta) {
  var next = index + delta;
  if (next < 0 || next >= siteContentGallery.length) return;
  var arr = siteContentGallery.slice();
  var t = arr[index];
  arr[index] = arr[next];
  arr[next] = t;
  siteContentGallery = arr;
  renderSiteGalleryList();
  var order = siteContentGallery.map(function (img) { return img.src || ''; }).filter(Boolean);
  if (order.length === 0) return;
  var token = typeof getSessionToken === 'function' ? getSessionToken() : '';
  if (!token) return;
  fetch('/api/site/gallery-order', {
    method: 'PUT',
    headers: { 'x-session-token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ galleryOrder: order })
  }).then(function (r) { return r.json(); }).then(function (data) {
    if (data.galleryImages) { siteContentGallery = data.galleryImages; renderSiteGalleryList(); showToast('Order saved.'); }
  }).catch(function () {});
};
function siteGalleryDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}
function siteGalleryDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}
function siteGalleryDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  var file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file && file.type.indexOf('image/') === 0) {
    siteAddGalleryPhotoFromFile(file).then(function () {
      var zone = document.getElementById('site-gallery-drop');
      var text = document.getElementById('site-gallery-dz-text');
      if (zone) zone.classList.remove('upload-done');
      if (text) text.innerHTML = '<strong>Click to upload</strong> or drag and drop';
      showToast('Photo added.');
    }).catch(function (err) { showToast(err.message || 'Upload failed'); });
  }
}
function siteGalleryFileChosen(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  input.value = '';
  siteAddGalleryPhotoFromFile(file).then(function () {
    var zone = document.getElementById('site-gallery-drop');
    var text = document.getElementById('site-gallery-dz-text');
    if (zone) zone.classList.remove('upload-done');
    if (text) text.innerHTML = '<strong>Click to upload</strong> or drag and drop';
    showToast('Photo added.');
  }).catch(function (err) { showToast(err.message || 'Upload failed'); });
}
window.siteRemoveGalleryPhoto = function siteRemoveGalleryPhoto(filename) {
  if (!filename) return;
  var token = typeof getSessionToken === 'function' ? getSessionToken() : '';
  if (!token) { showToast('You must be logged in.'); return; }
  fetch('/api/site/gallery/file/' + encodeURIComponent(filename), { method: 'DELETE', headers: { 'x-session-token': token } })
    .then(function (r) { return r.json().catch(function () { return {}; }); })
    .then(function (data) {
      if (data.galleryImages) { siteContentGallery = data.galleryImages; renderSiteGalleryList(); showToast('Photo removed.'); }
      else { showToast('Remove failed.'); }
    })
    .catch(function () { showToast('Remove failed.'); });
};
function renderSiteBoardList() {
  const boardHtml = siteContentBoard.map(function (m, i) {
    const imgSrc = (m.image && m.image.startsWith('/')) ? (window.location.origin + m.image) : (m.image || '');
    const name = (m.name || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const role = (m.role || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const major = (m.major || m.bio || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    var moveUp = i > 0 ? '<button type="button" class="site-board-move" onclick="siteMoveBoardMember(' + i + ', -1)" title="Move up" aria-label="Move up">↺</button>' : '';
    var moveDown = i < siteContentBoard.length - 1 ? '<button type="button" class="site-board-move" onclick="siteMoveBoardMember(' + i + ', 1)" title="Move down" aria-label="Move down">↻</button>' : '';
    return '<div class="site-board-card">' +
      '<div class="site-board-order-btns">' + moveUp + moveDown + '</div>' +
      '<div class="site-board-photo-wrap">' +
      '<img src="' + (imgSrc || '') + '" alt="" onerror="this.style.display=\'none\'" />' +
      '<div class="site-board-upload" onclick="siteBoardPhotoClick(' + i + ')">Change photo</div>' +
      '</div>' +
      '<div class="site-board-fields">' +
      '<input type="text" data-board-index="' + i + '" data-board-field="name" value="' + name + '" placeholder="Name" />' +
      '<input type="text" data-board-index="' + i + '" data-board-field="role" value="' + role + '" placeholder="Role" />' +
      '<input type="text" data-board-index="' + i + '" data-board-field="major" value="' + major + '" placeholder="Major" />' +
      '</div>' +
      '<button type="button" class="btn btn-outline" style="padding:6px 12px;font-size:10px" onclick="siteRemoveBoardMember(' + i + ')">Remove</button>' +
      '</div>';
  }).join('');
  const el = document.getElementById('site-board-list');
  if (el) el.innerHTML = boardHtml;
  const modalEl = document.getElementById('site-board-modal-list');
  if (modalEl) modalEl.innerHTML = boardHtml;
  document.querySelectorAll('#site-board-list input[data-board-index], #site-board-modal-list input[data-board-index]').forEach(function (input) {
    input.addEventListener('input', function () {
      const idx = parseInt(input.dataset.boardIndex, 10);
      const field = input.dataset.boardField;
      if (siteContentBoard[idx]) siteContentBoard[idx][field] = input.value;
    });
  });
}
var siteBoardPhotoInput = null;
function siteBoardPhotoInputEl() {
  if (!siteBoardPhotoInput) {
    siteBoardPhotoInput = document.createElement('input');
    siteBoardPhotoInput.type = 'file';
    siteBoardPhotoInput.accept = 'image/*';
    siteBoardPhotoInput.style.display = 'none';
    siteBoardPhotoInput.onchange = function () {
      var idx = siteBoardPhotoInput.getAttribute('data-board-index');
      if (idx === null || idx === '') return;
      idx = parseInt(idx, 10);
      var file = siteBoardPhotoInput.files && siteBoardPhotoInput.files[0];
      siteBoardPhotoInput.value = '';
      siteBoardPhotoInput.removeAttribute('data-board-index');
      if (!file || !siteContentBoard[idx]) return;
      var fd = new FormData();
      fd.append('photo', file);
      fd.append('name', siteContentBoard[idx].name || '');
      fd.append('role', siteContentBoard[idx].role || '');
      var token = typeof getSessionToken === 'function' ? getSessionToken() : '';
      fetch('/api/site/board/upload', { method: 'POST', headers: { 'x-session-token': token }, body: fd })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.path) {
            fetch('/api/public/site-content').then(function (r) { return r.json(); }).then(function (content) {
              if (content.boardMembers) { siteContentBoard = content.boardMembers; renderSiteBoardList(); showToast('Photo saved to folder.'); }
            });
          }
        })
        .catch(function () {});
    };
    document.body.appendChild(siteBoardPhotoInput);
  }
  return siteBoardPhotoInput;
}
window.siteBoardPhotoClick = function siteBoardPhotoClick(index) {
  var input = siteBoardPhotoInputEl();
  input.setAttribute('data-board-index', String(index));
  input.click();
};
function siteAddGalleryPhotoFromFile(file) {
  if (!file || !(file.type || '').match(/^image\//)) return Promise.reject(new Error('Choose an image.'));
  var token = typeof getSessionToken === 'function' ? getSessionToken() : '';
  if (!token) return Promise.reject(new Error('You must be logged in.'));
  var fd = new FormData();
  fd.append('photo', file);
  return fetch('/api/site/gallery', { method: 'POST', headers: { 'x-session-token': token }, body: fd })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.path || (data.galleryImages && data.galleryImages.length)) {
        if (data.galleryImages) siteContentGallery = data.galleryImages;
        else siteContentGallery.push({ id: 'gallery-' + (file.name || ''), src: data.path, alt: '' });
        renderSiteGalleryList();
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    });
}
window.siteAddGalleryPhoto = async function siteAddGalleryPhoto() {
  var fileInput = document.getElementById('site-gallery-file');
  var altInput = document.getElementById('site-gallery-alt');
  var file = fileInput && fileInput.files && fileInput.files[0];
  if (!file) { showToast('Choose a photo first.'); return; }
  var altText = (altInput && altInput.value) ? altInput.value : 'SSA event';
  try {
    await siteAddGalleryPhotoFromFile(file, altText);
    if (fileInput) fileInput.value = '';
    if (altInput) altInput.value = '';
    var zone = document.getElementById('site-gallery-drop');
    var text = document.getElementById('site-gallery-dz-text');
    if (zone) zone.classList.remove('upload-done');
    if (text) text.innerHTML = '<strong>Click to upload</strong> or drag and drop';
    showToast('Photo added to temporary gallery.');
  } catch (e) {
    showToast(e.message || 'Upload failed');
  }
};
function siteGalleryModalDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  var file = e.dataTransfer.files && e.dataTransfer.files[0];
  if (file && file.type.indexOf('image/') === 0) {
    siteAddGalleryPhotoFromFile(file, 'SSA event').then(function () {
      var zone = document.getElementById('site-gallery-modal-drop');
      var text = document.getElementById('site-gallery-modal-dz-text');
      if (zone) zone.classList.remove('upload-done');
      if (text) text.innerHTML = '<strong>Click to upload</strong> or drag and drop a photo';
    }).catch(function (err) { showToast(err.message || 'Upload failed'); });
  }
}
function siteGalleryModalFileChosen(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  siteAddGalleryPhotoFromFile(file).then(function () {
    input.value = '';
    var zone = document.getElementById('site-gallery-modal-drop');
    var text = document.getElementById('site-gallery-modal-dz-text');
    if (zone) zone.classList.remove('upload-done');
    if (text) text.innerHTML = '<strong>Click to upload</strong> or drag and drop a photo';
    showToast('Photo added.');
  }).catch(function (err) { showToast(err.message || 'Upload failed'); });
}
window.siteSaveGallery = async function siteSaveGallery() {
  loadSiteContentPage();
  closeModal('site-gallery-modal');
  showToast('Gallery refreshed.');
};
window.sitePushGalleryToGitHub = async function sitePushGalleryToGitHub() {
  const statusEl = document.getElementById('site-push-gallery-status');
  if (statusEl) statusEl.textContent = 'Pushing…';
  const token = typeof getSessionToken === 'function' ? getSessionToken() : '';
  try {
    const res = await fetch('/api/site/push-gallery', { method: 'POST', headers: { 'x-session-token': token } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Push failed');
    if (statusEl) statusEl.textContent = 'Pushed.';
    showToast('Gallery content pushed to GitHub.');
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Error: ' + (e.message || '');
    showToast(e.message || 'Push failed');
  }
};
window.sitePushEventsToGitHub = async function sitePushEventsToGitHub() {
  const statusEl = document.getElementById('site-push-events-status');
  if (statusEl) statusEl.textContent = 'Pushing…';
  const token = typeof getSessionToken === 'function' ? getSessionToken() : '';
  try {
    const res = await fetch('/api/site/push-events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': token
      },
      body: JSON.stringify({ events: siteContentEvents || [] })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Push failed');
    if (statusEl) statusEl.textContent = 'Pushed.';
    showToast(data.message || 'Events pushed to GitHub.');
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Error: ' + (e.message || '');
    showToast(e.message || 'Push failed');
  }
};
window.sitePushBoardToGitHub = async function sitePushBoardToGitHub() {
  const statusEl = document.getElementById('site-push-board-status');
  if (statusEl) statusEl.textContent = 'Pushing…';
  const token = typeof getSessionToken === 'function' ? getSessionToken() : '';
  try {
    const res = await fetch('/api/site/push-board', { method: 'POST', headers: { 'x-session-token': token } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Push failed');
    if (statusEl) statusEl.textContent = 'Pushed.';
    showToast('Member content pushed to GitHub.');
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Error: ' + (e.message || '');
    showToast(e.message || 'Push failed');
  }
};
window.siteSaveBoard = async function siteSaveBoard() {
  try {
    const res = await fetch('/api/public/site-content');
    const data = await res.json().catch(() => ({}));
    if (res.ok && Array.isArray(data.boardMembers)) {
      siteContentBoard = data.boardMembers;
      renderSiteBoardList();
      showToast('Board refreshed from folder.');
    }
  } catch (e) {
    showToast(e.message || 'Refresh failed');
  }
};
window.siteAddBoardMember = function siteAddBoardMember() {
  siteContentBoard.push({
    id: 'new-' + Date.now(),
    name: '',
    role: 'Executive Board Member',
    major: '',
    image: ''
  });
  renderSiteBoardList();
};
window.siteMoveBoardMember = function siteMoveBoardMember(index, delta) {
  var next = index + delta;
  if (next < 0 || next >= siteContentBoard.length) return;
  var arr = siteContentBoard.slice();
  var t = arr[index];
  arr[index] = arr[next];
  arr[next] = t;
  siteContentBoard = arr;
  renderSiteBoardList();
  var order = siteContentBoard.map(function (m) { return m.image || ''; }).filter(Boolean);
  if (order.length === 0) return;
  var token = typeof getSessionToken === 'function' ? getSessionToken() : '';
  if (!token) return;
  fetch('/api/site/board-order', {
    method: 'PUT',
    headers: { 'x-session-token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ boardOrder: order })
  }).then(function (r) { return r.json(); }).then(function (data) {
    if (data.boardMembers) { siteContentBoard = data.boardMembers; renderSiteBoardList(); showToast('Order saved.'); }
  }).catch(function () {});
};
window.siteRemoveBoardMember = function siteRemoveBoardMember(index) {
  var member = siteContentBoard[index];
  if (!member) return;
  var filename = (member.image || '').split('/').pop();
  if (!filename) {
    siteContentBoard.splice(index, 1);
    renderSiteBoardList();
    return;
  }
  var token = typeof getSessionToken === 'function' ? getSessionToken() : '';
  if (!token) { showToast('You must be logged in.'); return; }
  fetch('/api/site/board/file/' + encodeURIComponent(filename), { method: 'DELETE', headers: { 'x-session-token': token } })
    .then(function (r) { return r.json().catch(function () { return {}; }); })
    .then(function (data) {
      if (data.boardMembers) {
        siteContentBoard = data.boardMembers;
        renderSiteBoardList();
        showToast('Member removed from folder.');
      } else {
        showToast('Remove failed.');
      }
    })
    .catch(function () { showToast('Remove failed.'); });
};

// ── NEWSLETTER EDITOR ─────────────────────────────────────────────────────
var presidentNewsletters = [];
var newsletterImageInput = null;

window.loadNewsletterPage = async function loadNewsletterPage() {
  var listEl = document.getElementById('newsletter-editor-list');
  var statusEl = document.getElementById('newsletter-save-status');
  if (statusEl) statusEl.textContent = '';
  try {
    var res = await fetch('/api/public/site-content');
    var data = res.ok ? await res.json() : {};
    presidentNewsletters = Array.isArray(data.newsletters) ? data.newsletters.slice() : [];
  } catch (_e) {
    presidentNewsletters = [];
  }
  renderNewsletterEditorList();
  renderNewsletterPreview();
};

function renderNewsletterPreview() {
  var wrap = document.getElementById('newsletter-preview-wrap');
  if (!wrap) return;
  if (presidentNewsletters.length === 0) {
    wrap.innerHTML = '<p style="font-size:12px;color:var(--silver)">No newsletter entries yet. Add entries below to see the preview.</p>';
    return;
  }
  var baseUrl = window.location.origin + (window.location.pathname.replace(/\/[^/]*$/, '') || '') + '/';
  wrap.innerHTML = presidentNewsletters.map(function (n) {
    var imgSrc = n.image ? (n.image.startsWith('/') ? (window.location.origin + n.image) : (baseUrl + n.image)) : '';
    if (imgSrc && n._ts) imgSrc += '?t=' + n._ts;
    var desc = (n.description || '').slice(0, 280);
    if ((n.description || '').length > 280) desc += '…';
    desc = desc.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;').replace(/\n/g, '<br />');
    var title = (n.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    var date = (n.date || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return '<div style="background:var(--navy);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px;display:grid;grid-template-columns:min(180px,100%) 1fr;gap:20px;align-items:start">' +
      (imgSrc ? '<div style="aspect-ratio:4/5;border-radius:8px;overflow:hidden;background:var(--navy-light)"><img src="' + imgSrc + '" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.display=\'none\'" /></div>' : '<div style="aspect-ratio:4/5;border-radius:8px;background:var(--navy-light);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--silver)">No image</div>') +
      '<div><div style="font-family:var(--font-display);font-size:20px;color:var(--white);margin-bottom:4px">' + title + '</div>' +
      '<div style="font-size:11px;color:var(--gold-light);letter-spacing:.08em;margin-bottom:10px">' + date + '</div>' +
      '<p style="font-size:13px;color:var(--stone);line-height:1.6;margin-bottom:0">' + desc + '</p></div></div>';
  }).join('');
}

window.openNewsletterFullView = function openNewsletterFullView() {
  var body = document.getElementById('newsletter-full-modal-body');
  var modal = document.getElementById('newsletter-full-modal');
  if (!body || !modal) return;
  if (presidentNewsletters.length === 0) {
    body.innerHTML = '<p style="font-size:13px;color:var(--silver)">No newsletter entries to show.</p>';
    modal.classList.add('open');
    return;
  }
  var baseUrl = window.location.origin + (window.location.pathname.replace(/\/[^/]*$/, '') || '') + '/';
  body.innerHTML = presidentNewsletters.map(function (n) {
    var imgSrc = n.image ? (n.image.startsWith('/') ? (window.location.origin + n.image) : (baseUrl + n.image)) : '';
    var desc = (n.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;').replace(/\n/g, '<br />');
    var title = (n.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    var date = (n.date || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return '<div style="background:var(--navy);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:24px;margin-bottom:20px">' +
      '<div style="font-family:var(--font-display);font-size:22px;color:var(--white);margin-bottom:6px">' + title + '</div>' +
      '<div style="font-size:11px;color:var(--gold-light);letter-spacing:.08em;margin-bottom:16px">' + date + '</div>' +
      (imgSrc ? '<div style="margin-bottom:16px;border-radius:8px;overflow:hidden;max-width:100%"><img src="' + imgSrc + '" alt="" style="width:100%;max-width:400px;height:auto;display:block" onerror="this.parentElement.style.display=\'none\'" /></div>' : '') +
      '<div style="font-size:14px;color:var(--stone);line-height:1.7">' + desc + '</div></div>';
  }).join('');
  modal.classList.add('open');
};

function renderNewsletterEditorList() {
  var listEl = document.getElementById('newsletter-editor-list');
  if (!listEl) return;
  if (presidentNewsletters.length === 0) {
    listEl.innerHTML = '<p style="font-size:12px;color:var(--silver)">No newsletter entries yet. Click “Add newsletter entry” to create one.</p>';
    return;
  }
  var baseUrl = window.location.origin + (window.location.pathname.replace(/\/[^/]*$/, '') || '') + '/';
  var html = presidentNewsletters.map(function (n, i) {
    var id = (n.id || '').replace(/"/g, '&quot;');
    var title = (n.title || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    var date = (n.date || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    var desc = n.description || '';
    var descAttr = desc.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var image = (n.image || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    var link = (n.link || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    var sec = (n.secondaryLink || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    var imgSrc = image ? (image.startsWith('/') ? (window.location.origin + image) : (baseUrl + image)) : '';
    if (imgSrc && n._ts) imgSrc += '?t=' + n._ts;
    return '<div class="newsletter-editor-card" data-index="' + i + '" style="background:var(--navy-light);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
      '<span style="font-size:11px;letter-spacing:.1em;color:var(--gold);">Entry ' + (i + 1) + '</span>' +
      '<button type="button" class="btn btn-outline" style="padding:4px 10px;font-size:10px" onclick="newsletterRemoveEntry(' + i + ')">Remove</button>' +
      '</div>' +
      '<div class="fg" style="margin-bottom:10px"><label>Title</label><input type="text" data-nl-field="title" value="' + title + '" placeholder="e.g. February Newsletter" style="background:var(--navy);border:1px solid rgba(255,255,255,.12);padding:10px 12px;border-radius:8px;color:var(--white);font-size:13px;width:100%" /></div>' +
      '<div class="fg" style="margin-bottom:10px"><label>Date</label><input type="text" data-nl-field="date" value="' + date + '" placeholder="e.g. February 2026" style="background:var(--navy);border:1px solid rgba(255,255,255,.12);padding:10px 12px;border-radius:8px;color:var(--white);font-size:13px;width:100%" /></div>' +
      '<div class="fg" style="margin-bottom:10px"><label>Description</label><textarea data-nl-field="description" data-value="' + descAttr + '" rows="4" placeholder="Newsletter body text..." style="background:var(--navy);border:1px solid rgba(255,255,255,.12);padding:10px 12px;border-radius:8px;color:var(--white);font-size:13px;width:100%;resize:vertical"></textarea></div>' +
      (imgSrc ? '<div style="margin-bottom:10px"><img src="' + imgSrc + '" alt="" style="max-width:200px;max-height:120px;object-fit:contain;border-radius:8px" onerror="this.style.display=\'none\'" /></div>' : '') +
      '<div style="margin-bottom:10px"><button type="button" class="btn btn-outline" style="padding:6px 12px;font-size:11px" onclick="newsletterUploadImage(' + i + ')">Upload new image</button></div>' +
      '<div class="fg" style="margin-bottom:10px"><label>Primary link (e.g. Instagram)</label><input type="url" data-nl-field="link" value="' + link + '" placeholder="https://..." style="background:var(--navy);border:1px solid rgba(255,255,255,.12);padding:10px 12px;border-radius:8px;color:var(--white);font-size:13px;width:100%" /></div>' +
      '<div class="fg" style="margin-bottom:0"><label>Secondary link (optional)</label><input type="url" data-nl-field="secondaryLink" value="' + sec + '" placeholder="https://..." style="background:var(--navy);border:1px solid rgba(255,255,255,.12);padding:10px 12px;border-radius:8px;color:var(--white);font-size:13px;width:100%" /></div>' +
      '</div>';
  }).join('');
  listEl.innerHTML = html;
  listEl.querySelectorAll('textarea[data-nl-field="description"]').forEach(function (ta) {
    ta.value = ta.getAttribute('data-value') || '';
    ta.removeAttribute('data-value');
  });
}

window.newsletterUploadImage = function newsletterUploadImage(index) {
  newsletterImageInput = newsletterImageInput || document.createElement('input');
  newsletterImageInput.type = 'file';
  newsletterImageInput.accept = 'image/*';
  newsletterImageInput.setAttribute('data-nl-upload-index', String(index));
  newsletterImageInput.onchange = function () {
    var file = newsletterImageInput.files && newsletterImageInput.files[0];
    if (!file) return;
    var idx = parseInt(newsletterImageInput.getAttribute('data-nl-upload-index'), 10);
    var token = typeof getSessionToken === 'function' ? getSessionToken() : '';
    if (!token) { showToast('You must be logged in.'); return; }
    var fd = new FormData();
    fd.append('photo', file);
    fetch('/api/site/newsletter-image', { method: 'POST', headers: { 'x-session-token': token }, body: fd })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (data) {
        if (data.path && presidentNewsletters[idx]) {
          presidentNewsletters[idx].image = data.path;
          presidentNewsletters[idx]._ts = Date.now();
          renderNewsletterEditorList();
          renderNewsletterPreview();
          showToast('Image uploaded.');
        } else { showToast(data.error || 'Upload failed'); }
      })
      .catch(function () { showToast('Upload failed'); });
    newsletterImageInput.value = '';
  };
  newsletterImageInput.click();
};

window.newsletterAddEntry = function newsletterAddEntry() {
  presidentNewsletters.push({
    id: 'nl-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9),
    title: '',
    date: '',
    description: '',
    image: '',
    link: '',
    secondaryLink: ''
  });
  renderNewsletterEditorList();
};

window.newsletterRemoveEntry = function newsletterRemoveEntry(index) {
  presidentNewsletters.splice(index, 1);
  renderNewsletterEditorList();
};

window.newsletterSave = async function newsletterSave() {
  var listEl = document.getElementById('newsletter-editor-list');
  var statusEl = document.getElementById('newsletter-save-status');
  if (!listEl) return;
  var cards = listEl.querySelectorAll('.newsletter-editor-card');
  var payload = [];
  cards.forEach(function (card) {
    var i = card.getAttribute('data-index');
    var entry = presidentNewsletters[parseInt(i, 10)];
    if (!entry) return;
    var titleIn = card.querySelector('[data-nl-field="title"]');
    var dateIn = card.querySelector('[data-nl-field="date"]');
    var descIn = card.querySelector('[data-nl-field="description"]');
    var linkIn = card.querySelector('[data-nl-field="link"]');
    var secIn = card.querySelector('[data-nl-field="secondaryLink"]');
    payload.push({
      id: entry.id,
      title: titleIn ? titleIn.value.trim() : '',
      date: dateIn ? dateIn.value.trim() : '',
      description: descIn ? descIn.value.trim() : '',
      image: entry.image || 'newsletter-images/newsletter.png',
      link: linkIn ? linkIn.value.trim() : '',
      secondaryLink: secIn ? secIn.value.trim() : ''
    });
  });
  var token = typeof getSessionToken === 'function' ? getSessionToken() : '';
  if (!token) { showToast('You must be logged in.'); return; }
  if (statusEl) statusEl.textContent = 'Saving…';
  try {
    var res = await fetch('/api/site/newsletters', {
      method: 'PUT',
      headers: { 'x-session-token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ newsletters: payload })
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Save failed');
    presidentNewsletters = Array.isArray(data.newsletters) ? data.newsletters : payload;
    if (statusEl) statusEl.textContent = 'Saved.';
    renderNewsletterPreview();
    showToast('Newsletters saved.');
  } catch (e) {
    if (statusEl) statusEl.textContent = '';
    showToast(e.message || 'Save failed');
  }
};

window.newsletterPushToGitHub = async function newsletterPushToGitHub() {
  var token = typeof getSessionToken === 'function' ? getSessionToken() : '';
  if (!token) { showToast('You must be logged in.'); return; }
  var listEl = document.getElementById('newsletter-editor-list');
  if (!listEl) return;
  var cards = listEl.querySelectorAll('.newsletter-editor-card');
  var payload = [];
  cards.forEach(function (card) {
    var i = card.getAttribute('data-index');
    var entry = presidentNewsletters[parseInt(i, 10)];
    if (!entry) return;
    var titleIn = card.querySelector('[data-nl-field="title"]');
    var dateIn = card.querySelector('[data-nl-field="date"]');
    var descIn = card.querySelector('[data-nl-field="description"]');
    var linkIn = card.querySelector('[data-nl-field="link"]');
    var secIn = card.querySelector('[data-nl-field="secondaryLink"]');
    payload.push({
      id: entry.id,
      title: titleIn ? titleIn.value.trim() : '',
      date: dateIn ? dateIn.value.trim() : '',
      description: descIn ? descIn.value.trim() : '',
      image: entry.image || 'newsletter-images/newsletter.png',
      link: linkIn ? linkIn.value.trim() : '',
      secondaryLink: secIn ? secIn.value.trim() : ''
    });
  });
  var statusEl = document.getElementById('newsletter-push-status');
  if (statusEl) statusEl.textContent = 'Pushing…';
  try {
    var res = await fetch('/api/site/push-newsletter', {
      method: 'POST',
      headers: { 'x-session-token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ newsletters: payload })
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Push failed');
    if (statusEl) statusEl.textContent = data.message || 'Pushed to GitHub.';
    showToast(data.message || 'Newsletter pushed to GitHub.');
  } catch (e) {
    if (statusEl) statusEl.textContent = '';
    showToast(e.message || 'Push failed');
  }
};

// ── CLICK OUTSIDE MODAL ───────────────────────────────────────────────────
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
});

init();
