/* board.html — application logic */

/* ─────────────────────────────────────
  DATA
───────────────────────────────────── */
let USER = {
  first: "Member",
  full: "Board Member",
  role: "Board Member",
  dept: "Board Operations",
  div: "Board Division",
  email: "",
  permission: "board"
};
let TASKS = [];
let EVENTS = [];
let DEP_CHAINS = [];
let CAL_EVENTS = {};
let DASHBOARD = { tasks: [], events: [], dependencies: [] };
let STAGED_FILES = {};
let ACTIVE_DEP_EVENT_ID = null;
let SUBMIT_EVENT_FILTER = null;

/* ─────────────────────────────────────
   INDEX GALLERY (board can add/remove/reorder; president pushes)
───────────────────────────────────── */
var boardGalleryImagesCurrent = [];
function boardGalleryFilename(img) { return (img.src || '').split('/').pop() || ''; }
function boardGalleryItemHtml(img, i, total) {
  var src = (img.src && img.src.startsWith('/')) ? (window.location.origin + img.src) : (img.src || '');
  var fn = (boardGalleryFilename(img) || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  var moveUp = i > 0 ? '<button type="button" class="site-gallery-move" onclick="boardMoveGalleryPhoto(' + i + ', -1)" title="Move up" aria-label="Move up">↺</button>' : '';
  var moveDown = i < total - 1 ? '<button type="button" class="site-gallery-move" onclick="boardMoveGalleryPhoto(' + i + ', 1)" title="Move down" aria-label="Move down">↻</button>' : '';
  return '<div class="site-gallery-row">' +
    '<div class="site-gallery-order-btns">' + moveUp + moveDown + '</div>' +
    '<div class="site-gallery-item"><img src="' + src + '" alt="" /><button type="button" class="site-gallery-remove" data-filename="' + fn + '" onclick="boardRemoveGalleryPhoto(this.getAttribute(\'data-filename\'))" aria-label="Remove">×</button></div>' +
    '</div>';
}
window.boardLoadSiteGalleryPage = async function boardLoadSiteGalleryPage() {
  try {
    const r = await fetch('/api/public/site-content');
    const data = r.ok ? await r.json() : {};
    const list = document.getElementById('board-gallery-list');
    if (!list) return;
    const images = data.galleryImages || [];
    boardGalleryImagesCurrent = images;
    if (images.length === 0) {
      list.innerHTML = '<span style="font-size:12px;color:var(--silver)">No photos yet. Add one above.</span>';
      return;
    }
    list.innerHTML = images.map(function (img, i) { return boardGalleryItemHtml(img, i, images.length); }).join('');
  } catch (_e) {
    const list = document.getElementById('board-gallery-list');
    if (list) list.innerHTML = '<span style="font-size:12px;color:var(--silver)">Could not load gallery.</span>';
  }
};
window.boardMoveGalleryPhoto = async function boardMoveGalleryPhoto(index, delta) {
  var arr = boardGalleryImagesCurrent.slice();
  var next = index + delta;
  if (next < 0 || next >= arr.length) return;
  var t = arr[index]; arr[index] = arr[next]; arr[next] = t;
  var order = arr.map(function (img) { return img.src || ''; }).filter(Boolean);
  var token = typeof getSessionToken === 'function' ? getSessionToken() : '';
  if (!token) { if (typeof showToast === 'function') showToast('You must be logged in.'); return; }
  try {
    var res = await fetch('/api/site/gallery-order', { method: 'PUT', headers: { 'x-session-token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ galleryOrder: order }) });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Reorder failed');
    if (typeof showToast === 'function') showToast('Order saved.');
    boardLoadSiteGalleryPage();
  } catch (e) { if (typeof showToast === 'function') showToast(e.message || 'Reorder failed'); }
};
window.boardGalleryDragOver = function boardGalleryDragOver(e) { e.preventDefault(); e.stopPropagation(); var z = document.getElementById('board-gallery-drop'); if (z) z.classList.add('drag-over'); };
window.boardGalleryDragLeave = function boardGalleryDragLeave(e) { e.preventDefault(); var z = document.getElementById('board-gallery-drop'); if (z) z.classList.remove('drag-over'); };
window.boardGalleryDrop = function boardGalleryDrop(e) {
  e.preventDefault(); e.stopPropagation();
  var z = document.getElementById('board-gallery-drop'); if (z) z.classList.remove('drag-over');
  var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f && f.type && f.type.indexOf('image/') === 0) boardUploadGalleryFile(f);
};
window.boardGalleryFileChosen = function boardGalleryFileChosen(input) {
  var f = input && input.files && input.files[0];
  if (f) boardUploadGalleryFile(f);
  input.value = '';
};
window.boardUploadGalleryFile = async function boardUploadGalleryFile(file) {
  var token = typeof getSessionToken === 'function' ? getSessionToken() : '';
  if (!token) { if (typeof showToast === 'function') showToast('You must be logged in.'); return; }
  var fd = new FormData(); fd.append('photo', file); fd.append('alt', 'SSA event');
  var dz = document.getElementById('board-gallery-dz-text');
  if (dz) dz.textContent = 'Uploading…';
  try {
    var res = await fetch('/api/site/gallery', { method: 'POST', headers: { 'x-session-token': token }, body: fd });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    if (typeof showToast === 'function') showToast('Photo added.');
    boardLoadSiteGalleryPage();
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message || 'Upload failed');
  }
  if (dz) { dz.innerHTML = '<strong>Click to upload</strong> or drag and drop'; }
};
window.boardRemoveGalleryPhoto = async function boardRemoveGalleryPhoto(filename) {
  if (!filename) return;
  var token = typeof getSessionToken === 'function' ? getSessionToken() : '';
  if (!token) { if (typeof showToast === 'function') showToast('You must be logged in.'); return; }
  try {
    var res = await fetch('/api/site/gallery/file/' + encodeURIComponent(filename), { method: 'DELETE', headers: { 'x-session-token': token } });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Remove failed');
    if (typeof showToast === 'function') showToast('Photo removed.');
    boardLoadSiteGalleryPage();
  } catch (e) { if (typeof showToast === 'function') showToast(e.message || 'Remove failed'); }
};
window.boardPushGalleryToGitHub = async function boardPushGalleryToGitHub() {
  var token = typeof getSessionToken === 'function' ? getSessionToken() : '';
  if (!token) { if (typeof showToast === 'function') showToast('You must be logged in.'); return; }
  var el = document.getElementById('board-push-gallery-status');
  if (el) el.textContent = 'Pushing…';
  try {
    var res = await fetch('/api/site/push-gallery', { method: 'POST', headers: { 'x-session-token': token } });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Push failed');
    if (el) el.textContent = data.message || 'Pushed.';
  } catch (e) {
    if (el) el.textContent = '';
    if (typeof showToast === 'function') showToast(e.message || 'Push failed');
  }
};

/* ─────────────────────────────────────
   CALENDAR STATE
───────────────────────────────────── */
let calYear  = 2026;
let calMonth = 0; // 0-indexed: Jan = 0

/* ─────────────────────────────────────
   INIT
───────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initBoardLive();
});

/* ─────────────────────────────────────
   USER
───────────────────────────────────── */
function applyUser() {
  document.getElementById('sb-greeting').textContent = `Hey ${USER.first},`;
  document.getElementById('sb-role').textContent      = USER.role;
  document.getElementById('sb-div').textContent       = USER.div;
  const crumb = document.getElementById("crumb-role");
  if (crumb) crumb.textContent = USER.role || USER.dept || "Board";
  const isDirectorOfOps = (USER.role || '').trim().toLowerCase() === 'director of operations';
  const nlSection = document.getElementById('board-newsletter-section-label');
  const nlItem = document.getElementById('sb-item-newsletter');
  if (nlSection) nlSection.style.display = isDirectorOfOps ? '' : 'none';
  if (nlItem) nlItem.style.display = isDirectorOfOps ? 'flex' : 'none';
}

function toUiStatus(status) {
  if (status === "completed") return "done";
  if (status === "pending_review") return "pending";
  if (status === "redo") return "redo";
  if (status === "overdue") return "overdue";
  if (status === "locked") return "locked";
  return "current";
}

function getBlockingPrereq(task) {
  if (!task) return null;
  // Redo requests should not be blocked by prerequisite tasks.
  if (task.status === "redo" || task.redo_notes || task.redo_requested_at) return null;
  const deps = Array.isArray(task.dep) ? task.dep : [];
  return deps.find((d) => d.status !== "done") || null;
}

function formatBlockingNote(blockedBy) {
  if (!blockedBy) return "";
  const owner = blockedBy.owner || "Unassigned";
  return `${blockedBy.title} (assigned to ${owner})`;
}

function normalizePriority(priority) {
  const p = String(priority || "standard").toLowerCase();
  if (p === "critical") return "urgent";
  if (["urgent", "high", "medium", "low"].includes(p)) return p;
  if (p === "standard") return "medium";
  return "low";
}

function formatShortDate(iso) {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "N/A";
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

function ensureBoardAccess(me) {
  if (me.user.view_type === "president") {
    window.location.href = "president.html";
    return false;
  }
  if (me.user.view_type === "vp") {
    const division = me.user.vp_type === "external" ? "external" : "internal";
    window.location.href = `vp.html?division=${division}`;
    return false;
  }
  return true;
}

const PHASE_ORDER = ["Planning", "Pre-Event", "Execution", "Wrap-Up"];
function normalizePhaseName(phase) {
  const p = String(phase || "").trim().toLowerCase();
  if (p === "planning") return "Planning";
  if (p === "pre-event" || p === "pre event") return "Pre-Event";
  if (p === "execution") return "Execution";
  if (p === "wrap-up" || p === "wrap up" || p === "wrapup") return "Wrap-Up";
  return "Planning";
}
function buildPhaseChains(tasks, dependencies, eventId) {
  const eventTasks = (tasks || []).filter((t) => Number(t.event_id) === Number(eventId));
  if (!eventTasks.length) return [];
  const eventTaskIds = new Set(eventTasks.map((t) => Number(t.id)));
  const depByTask = new Map();
  (dependencies || []).forEach((d) => {
    if (!eventTaskIds.has(Number(d.task_id)) || !eventTaskIds.has(Number(d.depends_on_task_id))) return;
    const arr = depByTask.get(Number(d.task_id)) || [];
    arr.push(Number(d.depends_on_task_id));
    depByTask.set(Number(d.task_id), arr);
  });
  const taskById = new Map(eventTasks.map((t) => [Number(t.id), t]));
  return PHASE_ORDER.map((phase) => {
    const nodes = eventTasks
      .filter((t) => normalizePhaseName(t.phase) === phase)
      .map((t) => {
        const depIds = depByTask.get(Number(t.id)) || [];
        const prereqTasks = depIds
          .map((depId) => taskById.get(depId))
          .filter(Boolean)
          .map((dep) => ({
            id: Number(dep.id),
            title: dep.title,
            owner: dep.owner_name || "Unassigned",
            status: toUiStatus(dep.status)
          }));
        const blockedBy = t.status === "redo" ? null : prereqTasks.find((dep) => dep.status !== "done") || null;
        const prereqTitles = prereqTasks.map((dep) => dep.title);
        return {
          id: Number(t.id),
          title: t.title,
          div: t.department,
          owner: t.owner_name,
          status: toUiStatus(t.status),
          mine: t.owner_email === USER.email,
          blockedBy,
          prereqText: blockedBy
            ? `Locked by: ${formatBlockingNote(blockedBy)}`
            : (prereqTitles.length ? `Prerequisite: ${prereqTitles.join(", ")}` : "No prerequisite")
        };
      });
    return { phase, nodes };
  }).filter((p) => p.nodes.length > 0);
}

function buildCalendarEvents(events, tasks) {
  CAL_EVENTS = {};
  const put = (iso, label, cls) => {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!CAL_EVENTS[key]) CAL_EVENTS[key] = {};
    const day = d.getDate();
    if (!CAL_EVENTS[key][day]) CAL_EVENTS[key][day] = [];
    CAL_EVENTS[key][day].push({ label, cls });
  };
  events.forEach((e) => put(e.event_date, e.name, "ev-normal"));
  tasks.forEach((t) => {
    const status = toUiStatus(t.status);
    const cls = status === "done" ? "ev-done" : status === "overdue" ? "ev-overdue" : "ev-deadline";
    put(t.due_at, `Task: ${t.title}`, cls);
  });
}

async function hydrateBoardData() {
  const me = await apiGet("/api/me");
  if (!ensureBoardAccess(me)) return false;
  const data = await apiGet("/api/dashboard");
  DASHBOARD = data;
  USER = {
    first: (me.user.full_name || "Member").split(" ")[0],
    full: me.user.full_name || "Board Member",
    role: me.user.role_title || "Board Member",
    dept: me.user.department || "Board Operations",
    div: me.user.department || "Board Division",
    email: me.user.email,
    permission: me.user.permission_level || "board"
  };
  EVENTS = (data.events || []).map((e) => {
    const mine = (data.tasks || []).filter((t) => t.event_id === e.id && t.owner_email === USER.email);
    const eventDateTs = new Date(e.event_date).getTime();
    const isCompleted = Number(e.progress || 0) >= 100 || String(e.status || "").toLowerCase() === "completed";
    return {
      id: e.id,
      name: e.name,
      event_date: e.event_date,
      date: formatShortDate(e.event_date),
      venue: e.venue || e.location || e.scope || "TBD Location",
      location: e.location || "",
      type: e.event_type || "Event",
      scope: e.scope || "",
      progress: e.progress || 0,
      status: e.status || "",
      budget_limit: e.budget_limit,
      planning_notes: e.planning_notes || "",
      timeline_assumptions: e.timeline_assumptions || "",
      hard_deadline: e.hard_deadline || "",
      workflow: Array.isArray(e.workflow_json) ? e.workflow_json : [],
      divisions: Array.isArray(e.divisions_json) ? e.divisions_json : [],
      roles: Array.isArray(e.roles_json) ? e.roles_json : [],
      deliverables: e.deliverables_json || {},
      constraints: e.constraints_json || {},
      yourTasks: mine.length,
      yourDone: mine.filter((t) => t.status === "completed").length,
      overdue: mine.filter((t) => t.status === "overdue").length,
      tags: [e.event_type || "Event"],
      isPast: isCompleted || (Number.isFinite(eventDateTs) && eventDateTs < Date.now())
    };
  });
  const depEventName = document.getElementById("dep-event-name");
  const depEventMeta = document.getElementById("dep-event-meta");
  const depEventSelect = document.getElementById("dep-event-select");
  const depEventDropdown = document.getElementById("dep-event-dropdown");
  if (depEventName && depEventMeta) {
    const focusEvent = EVENTS[0];
    ACTIVE_DEP_EVENT_ID = focusEvent ? Number(focusEvent.id) : null;
    depEventName.textContent = focusEvent ? focusEvent.name : "Active Workflow";
    depEventMeta.textContent = focusEvent ? `${focusEvent.date} · ${focusEvent.venue}` : "By event and stage";
  }
  if (depEventSelect) depEventSelect.value = ACTIVE_DEP_EVENT_ID != null ? String(ACTIVE_DEP_EVENT_ID) : "";
  if (depEventDropdown) {
    depEventDropdown.innerHTML = "<div class=\"dep-event-opt\" data-value=\"\" onclick=\"pickDepEvent('')\">All events</div>" +
      (EVENTS || []).map((e) => `<div class="dep-event-opt" data-value="${e.id}" onclick="pickDepEvent('${e.id}')">${(e.name || '').replace(/"/g, '&quot;')}</div>`).join("");
  }
  const depByTask = new Map();
  (data.dependencies || []).forEach((d) => {
    const arr = depByTask.get(d.task_id) || [];
    arr.push(d.depends_on_task_id);
    depByTask.set(d.task_id, arr);
  });
  const taskById = new Map((data.tasks || []).map((t) => [t.id, t]));
  TASKS = (data.tasks || []).map((t) => {
    const deps = (depByTask.get(t.id) || []).map((depId) => {
      const depTask = taskById.get(depId);
      return depTask
        ? {
            id: Number(depTask.id),
            title: depTask.title,
            owner: depTask.owner_name,
            owner_email: depTask.owner_email,
            status: toUiStatus(depTask.status)
          }
        : null;
    }).filter(Boolean);
    const eventName = ((data.events || []).find((e) => e.id === t.event_id) || {}).name || null;
    return {
      id: t.id,
      event_id: t.event_id,
      title: t.title,
      dept: t.department,
      division: t.vp_scope === "external" ? "External" : t.vp_scope === "internal" ? "Internal" : "Board",
      assigned: t.owner_name,
      assigned_email: t.owner_email,
      priority: normalizePriority(t.priority),
      status: toUiStatus(t.status),
      raw_status: t.status,
      redo_notes: t.redo_notes || '',
      redo_requested_at: t.redo_requested_at || '',
      event: eventName,
      due: formatShortDate(t.due_at),
      due_at: t.due_at,
      unlock_at: t.unlock_at,
      phase: normalizePhaseName(t.phase),
      meeting: t.meeting_date || t.meeting_location ? {
        time: `${t.meeting_date || ""} ${t.meeting_time || ""}`.trim(),
        location: t.meeting_location || "TBD"
      } : null,
      meeting_link: t.meeting_link || "",
      dep: deps,
      blocked_by: toUiStatus(t.status) === "redo" ? null : (deps.find((d) => d.status !== "done") || null),
      description: t.description || "",
      summary: t.previous_summary || "",
      downstream: [],
      prereq_task_ids: (depByTask.get(t.id) || []).slice()
    };
  });
  (data.dependencies || []).forEach((d) => {
    const depTask = TASKS.find((t) => t.id === d.depends_on_task_id);
    if (depTask) depTask.downstream.push(d.task_id);
  });
  DEP_CHAINS = buildPhaseChains(data.tasks || [], data.dependencies || [], ACTIVE_DEP_EVENT_ID);
  buildCalendarEvents(data.events || [], data.tasks || []);
  return true;
}

async function initBoardLive() {
  const token = getSessionToken();
  if (!token) {
    window.location.href = "ops-login.html";
    return;
  }
  try {
    const ok = await hydrateBoardData();
    if (!ok) return;
    applyUser();
    renderKPIs();
    renderAllTaskLists();
    renderDepGraph('dep-graph-full', false);
    renderSubmissionForm('submit-form-card');
    renderMyDeadlines();
    renderEventsDeadlines();
    renderEventsPage();
    renderCalendar();
    renderDownstream();
    renderReportsLive();
    startPolling(async () => {
      const hydrated = await hydrateBoardData();
      if (!hydrated) return;
      applyUser();
      renderKPIs();
      renderAllTaskLists();
      renderDepGraph('dep-graph-full', false);
      renderSubmissionForm('submit-form-card');
      renderMyDeadlines();
      renderEventsDeadlines();
      renderEventsPage();
      renderCalendar();
      renderDownstream();
      renderReportsLive();
    });
  } catch (_e) {
    clearSession();
    window.location.href = "ops-login.html";
  }
}

async function apiPostMultipart(url, formData) {
  const token = getSessionToken();
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-session-token": token },
    body: formData
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiDelete(url) {
  const token = getSessionToken();
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "x-session-token": token }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function quickCompleteTask() {
  const mineCurrent = TASKS.find((t) => t.assigned_email === USER.email && ["current", "overdue", "redo"].includes(t.status));
  if (!mineCurrent) {
    showToast("No active task available to complete.");
    return;
  }
  openCompletionForm(mineCurrent.id);
}

function goLoginPage() {
  clearSession();
  window.location.href = "ops-login.html";
}

async function removeTask(id) {
  if (USER.permission === 'board') return;
  try {
    await apiDelete(`/api/tasks/${id}`);
    showToast("Task deleted");
    await hydrateBoardData();
    renderKPIs();
    renderAllTaskLists();
    renderDepGraph('dep-graph-full', false);
    renderSubmissionForm('submit-form-card');
    renderMyDeadlines();
    renderEventsDeadlines();
    renderEventsPage();
    renderCalendar();
    renderDownstream();
  } catch (err) {
    showToast(err?.message || "Unable to delete task");
  }
}

async function removeEvent(id) {
  if (USER.permission === 'board') return;
  try {
    await apiDelete(`/api/events/${id}`);
    showToast("Event deleted");
    await hydrateBoardData();
    renderKPIs();
    renderAllTaskLists();
    renderDepGraph('dep-graph-full', false);
    renderSubmissionForm('submit-form-card');
    renderMyDeadlines();
    renderEventsDeadlines();
    renderEventsPage();
    renderCalendar();
    renderDownstream();
  } catch (err) {
    showToast(err?.message || "Unable to delete event");
  }
}

/* ─────────────────────────────────────
   NAVIGATION
───────────────────────────────────── */
const PAGE_TITLES = {
  tasks: 'My Tasks',
  current: 'Current',
  upcoming: 'Upcoming',
  redo: 'Redo',
  past: 'Past',
  dependency: 'Dependency Graph',
  calendar: 'Calendar',
  events: 'Events',
  reports: 'Reports',
  'report-to-vp': 'Report to VP',
  newsletter: 'Edit Newsletter',
  submit: 'Submit Work',
  'site-gallery': 'Index'
};

function navigate(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + pageId);
  if (el) el.classList.add('active');

  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[pageId] || pageId;

  document.querySelectorAll('.sb-item').forEach(n => n.classList.remove('active'));
  const navItem = document.querySelector(`[data-page="${pageId}"]`);
  if (navItem) navItem.classList.add('active');

  // close sidebar on mobile
  if (window.innerWidth <= 820) {
    document.getElementById('sidebar').classList.remove('mobile-open');
  }
  if (pageId === 'site-gallery' && typeof boardLoadSiteGalleryPage === 'function') boardLoadSiteGalleryPage();
  if (pageId === 'report-to-vp') {
    if (typeof populateBoardReportSelectors === 'function') populateBoardReportSelectors();
    if (typeof boardEscInitSev === 'function') boardEscInitSev();
  }
  if (pageId === 'newsletter' && typeof loadNewsletterPage === 'function') loadNewsletterPage();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('mobile-open');
}

/* ─────────────────────────────────────
   KPI CARDS
───────────────────────────────────── */
function renderKPIs() {
  const mine = TASKS.filter(t => t.assigned_email === USER.email);
  const counts = {
    current:  mine.filter(t => t.status === 'current' || t.status === 'overdue').length,
    upcoming: mine.filter(t => (t.status === 'current' || t.status === 'overdue') && Number.isFinite(new Date(t.due_at).getTime()) && new Date(t.due_at).getTime() > Date.now()).length,
    redo:     mine.filter(t => t.status === 'redo').length,
    past:     mine.filter(t => t.status === 'done').length
  };

  const defs = [
    { key: 'current',  label: 'Current',  num: counts.current,  numCls: 'num-gold',   cardCls: '',           page: 'current' },
    { key: 'upcoming', label: 'Upcoming', num: counts.upcoming, numCls: 'num-silver', cardCls: '',           page: 'upcoming' },
    { key: 'redo',     label: 'Redo',     num: counts.redo,     numCls: 'num-amber',  cardCls: '',           page: 'redo' },
    { key: 'past',     label: 'Past',     num: counts.past,     numCls: 'num-green',  cardCls: '',           page: 'past' },
  ];

  document.getElementById('kpi-row').innerHTML = defs.map(d => `
    <div class="kpi-card ${d.cardCls}" onclick="navigate('${d.page}')" tabindex="0" role="button">
      <div class="kpi-num ${d.numCls}">${d.num}</div>
      <div class="kpi-label">${d.label}</div>
    </div>`).join('');
}

/* ─────────────────────────────────────
   TASK LISTS
───────────────────────────────────── */
function renderAllTaskLists() {
  const urgencyRank = (t) => {
    const statusWeight = t.status === "overdue" ? 400 : t.status === "redo" ? 300 : t.status === "current" ? 200 : t.status === "done" ? -100 : 0;
    const priorityWeight = t.priority === "urgent" ? 80 : t.priority === "high" ? 55 : t.priority === "medium" ? 30 : 10;
    const dueTs = Number.isFinite(new Date(t.due_at).getTime()) ? new Date(t.due_at).getTime() : Number.MAX_SAFE_INTEGER;
    const dueWeight = Number.isFinite(dueTs) ? Math.max(0, (Date.now() - dueTs) / 86400000) : 0;
    return statusWeight + priorityWeight + dueWeight;
  };
  const sortByUrgency = (arr) => arr.slice().sort((a, b) => {
    const aBlocked = Boolean(getBlockingPrereq(a));
    const bBlocked = Boolean(getBlockingPrereq(b));
    if (aBlocked !== bBlocked) return aBlocked ? 1 : -1;
    const rankDiff = urgencyRank(b) - urgencyRank(a);
    if (rankDiff !== 0) return rankDiff;
    const aDue = Number.isFinite(new Date(a.due_at).getTime()) ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER;
    const bDue = Number.isFinite(new Date(b.due_at).getTime()) ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  });
  const mine    = TASKS.filter(t => t.assigned_email === USER.email);
  const isRedoRequested = (t) => Boolean(t.redo_notes || t.redo_requested_at);
  const current = sortByUrgency(mine.filter(t => (t.status === 'current' || t.status === 'overdue') && !isRedoRequested(t)));
  const upcoming = sortByUrgency(
    mine.filter((t) => (t.status === "current" || t.status === "overdue") && !isRedoRequested(t) && Number.isFinite(new Date(t.due_at).getTime()) && new Date(t.due_at).getTime() > Date.now())
  );
  const redo = sortByUrgency(mine.filter((t) => t.status === 'redo' || isRedoRequested(t)));
  const done = mine.filter(t => t.status === 'done').sort((a, b) => new Date(b.updated_at || b.due_at || 0) - new Date(a.updated_at || a.due_at || 0));
  const mainCombined = [...current, ...upcoming, ...redo];
  const mainIds = new Set();
  const mainTasks = mainCombined.filter(t => {
    if (mainIds.has(t.id)) return false;
    mainIds.add(t.id);
    return true;
  });
  renderTaskList('main-task-list',  mainTasks);
  renderTaskList('current-list',    current);
  renderTaskList('upcoming-list',   upcoming);
  renderTaskList('redo-list',       redo);
  renderTaskList('past-list',       done);
}

function renderTaskList(containerId, tasks, showEmpty = false) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!tasks.length) {
    el.innerHTML = showEmpty
      ? `<div class="empty-state">No tasks in this category.</div>`
      : `<div class="empty-state">Nothing here — you're clear.</div>`;
    return;
  }
  el.innerHTML = tasks.map(t => buildTaskCard(t)).join('');
}

function buildTaskCard(t, opts) {
  opts = opts || {};
  const hideDatesForBoard = opts.forBoardEvents === true && USER.permission === 'board';
  const isRedoRequested = Boolean(t.redo_notes || t.redo_requested_at);
  const uiStatus = isRedoRequested ? 'redo' : t.status;
  const blockedBy = getBlockingPrereq(t);
  const isBlocked = Boolean(blockedBy);
  const statusCls = {
    overdue: 'tc-overdue', current: '', redo: 'tc-overdue', locked: 'tc-locked',
    done: 'tc-done',
  }[uiStatus] || (isBlocked ? 'tc-locked' : '');

  const badgeCls = {
    overdue: 'badge-overdue', current: 'badge-current', redo: 'badge-pending',
    locked: 'badge-pending',
    done: 'badge-done',
  }[uiStatus] || (isBlocked ? 'badge-pending' : 'badge-current');

  const badgeLabel = {
    overdue: 'Overdue', current: 'Current', redo: 'Redo',
    locked: 'Locked',
    done: 'Completed',
  }[uiStatus] || (isBlocked ? 'Locked' : uiStatus);

  const prioCls = {
    urgent: 'prio-urgent', high: 'prio-high',
    medium: 'prio-medium', low: 'prio-low',
  }[t.priority] || 'prio-low';

  const canComplete = ["current", "overdue", "redo"].includes(uiStatus) && t.assigned_email === USER.email && !isBlocked;

  let depHtml = '';
  if (!isRedoRequested && t.dep && t.dep.length) {
    depHtml = `<div class="tc-dep-banner">
      <div class="tc-dep-label">${isBlocked ? "Locked by prerequisite" : "Prerequisite chain"}</div>
      <div class="tc-dep-chain">
        ${t.dep.map(d => `
          <div class="dep-chip ${d.status}">${d.title}
            <span style="font-size:9px;color:var(--silver);margin-left:4px">— ${d.owner}</span>
          </div>
          <span class="dep-arrow">→</span>`).join('')}
        <div class="dep-chip active">Your task</div>
      </div>
      ${isBlocked ? `<div style="font-size:11px;color:var(--stone);margin-top:8px">Complete <strong style="color:var(--off-white)">${blockedBy.title}</strong> first. Assigned to <strong style="color:var(--off-white)">${blockedBy.owner || "Unassigned"}</strong>.</div>` : ''}
    </div>`;
  }

  const meetingHtml = t.meeting ? `
    <div class="tc-meeting">
      <span>Meeting</span><span>${t.meeting.time}</span>
      <span style="opacity:.45">·</span>
      <span>${t.meeting.location}</span>
    </div>` : '';

  const actionBtn = canComplete
    ? `<button class="btn btn-gold btn-sm" onclick="event.stopPropagation(); openCompletionForm(${t.id})">${uiStatus === 'redo' ? 'Resubmit' : 'Submit Complete'}</button>`
    : isBlocked
      ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openTaskModal(${t.id})">Locked by dependency</button>`
      : `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openTaskModal(${t.id})">Click to Review</button>`;

  const redoNoteHtml = (uiStatus === 'redo' && (t.redo_notes || t.redo_requested_at))
    ? `<div class="tc-dep-banner" style="border-left-color:var(--amber);background:rgba(212,145,74,0.10);margin-top:12px">
        <div class="tc-dep-label" style="color:var(--amber);">Redo requested</div>
        <div style="font-size:12px;color:var(--silver);line-height:1.65;margin-top:6px">
          ${t.redo_notes ? String(t.redo_notes).replace(/</g,'&lt;') : 'Please review the redo request and resubmit.'}
        </div>
      </div>`
    : '';

  const showBadge = !hideDatesForBoard;
  const showDueUnlocks = !hideDatesForBoard;
  const metaDue = showDueUnlocks ? `<div class="tc-meta-item"><span class="tc-meta-label">Due</span><span class="tc-meta-val">${t.due}</span></div>` : '';
  const metaPrereq = showDueUnlocks
    ? `<div class="tc-meta-item"><span class="tc-meta-label">Prereq</span><span class="tc-meta-val">${isBlocked ? `LOCKED: ${formatBlockingNote(blockedBy)}` : (t.dep && t.dep.length ? t.dep.map((d) => d.title).join(", ") : "None")}</span></div>`
    : '';

  return `
    <article class="task-card ${statusCls}" onclick="openTaskModal(${t.id})">
      <div class="tc-inner">
        <div class="tc-top">
          <div>
            <div class="tc-title">${t.title}</div>
            <div class="tc-event">${t.event || 'Standalone Task'}</div>
          </div>
          <div class="tc-right">
            ${showBadge ? `<span class="badge ${badgeCls}">${badgeLabel}</span>` : ''}
            <span class="prio ${prioCls}">${t.priority}</span>
          </div>
        </div>
        <div class="tc-meta">
          <div class="tc-meta-item">
            <span class="tc-meta-label">Dept</span>
            <span class="tc-meta-val">${t.dept}</span>
          </div>
          ${metaDue}
          ${metaPrereq}
          ${t.assigned_email !== USER.email ? `<div class="tc-meta-item"><span class="tc-meta-label">Owner</span><span class="tc-meta-val">${t.assigned}</span></div>` : ''}
        </div>
        <div class="tc-footer">
          ${meetingHtml}
          <div style="margin-left:auto;display:flex;gap:6px">
            ${actionBtn}
          </div>
        </div>
      </div>
      ${redoNoteHtml}
      ${depHtml}
    </article>`;
}

/* ─────────────────────────────────────
   DEP GRAPH
───────────────────────────────────── */
function renderDepGraph(containerId, compact) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const chains = DEP_CHAINS;

  const truncateTitle = (s, max) => { if (!s || typeof s !== 'string') return ''; return s.length <= max ? s : s.slice(0, max - 2) + '..'; };
  const TITLE_MAX = 28;
  el.innerHTML = chains.map(phase => `
    <div class="dep-phase dep-stage-box" style="border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px;margin-bottom:14px;background:rgba(255,255,255,.02)">
      <div class="dep-phase-label">${phase.phase}</div>
      <div class="dep-phase-row">
        ${phase.nodes.map((n, i) => `
          <div class="dep-node ${nodeClass(n)}" onclick="openNodeInspect(${Number(n.id)})">
            <div class="dep-node-div">${(n.div || '').length > 20 ? (n.div || '').slice(0,18) + '..' : (n.div || '')}</div>
            <div class="dep-node-title">${truncateTitle(n.title, TITLE_MAX)}</div>
            <div class="dep-node-owner">${n.blockedBy ? `LOCKED: ${truncateTitle(n.blockedBy.title, 14)} · ${truncateTitle(n.blockedBy.owner || "Unassigned", 12)}` : truncateTitle(n.owner || '', 18)}</div>
          </div>
          ${compact ? "" : (i < phase.nodes.length - 1 ? '<span class="dep-arrow-icon">·</span>' : '')}`).join('')}
      </div>
    </div>`).join('') + `
    <div class="dep-legend">
      <div class="dep-legend-item"><div class="dep-legend-dot" style="background:rgba(76,175,125,.6)"></div>Done</div>
      <div class="dep-legend-item"><div class="dep-legend-dot" style="background:var(--gold)"></div>Active / Yours</div>
      <div class="dep-legend-item"><div class="dep-legend-dot" style="background:rgba(255,255,255,.45)"></div>Locked by prerequisite</div>
      <div class="dep-legend-item"><div class="dep-legend-dot" style="background:rgba(255,255,255,.15)"></div>Independent unless prerequisite exists</div>
      <div class="dep-legend-item"><div class="dep-legend-dot" style="background:var(--red)"></div>Overdue</div>
    </div>`;
}

function nodeClass(n) {
  let cls = '';
  if (n.status === 'done')    cls = 'done-node';
  else if (n.blockedBy) cls = 'locked-node';
  else if (n.status === 'overdue') cls = 'active-node overdue-node';
  else cls = 'active-node';
  if (n.mine) cls += ' mine-node';
  return cls;
}

function escHtml(s) { return String(s == null ? "" : s).replace(/'/g, "\\'"); }

function openNodeInspect(taskId) {
  const t = TASKS.find((x) => Number(x.id) === Number(taskId));
  if (!t) return;
  // Use the full task modal so assigned members can submit directly from dependency view.
  openTaskModal(t.id);
}

function setDependencyEvent(eventId) {
  ACTIVE_DEP_EVENT_ID = eventId ? Number(eventId) : null;
  const sel = document.getElementById("dep-event-select");
  if (sel) sel.value = ACTIVE_DEP_EVENT_ID != null ? String(ACTIVE_DEP_EVENT_ID) : "";
  DEP_CHAINS = buildPhaseChains(DASHBOARD.tasks || [], DASHBOARD.dependencies || [], ACTIVE_DEP_EVENT_ID);
  const event = (EVENTS || []).find((e) => Number(e.id) === Number(ACTIVE_DEP_EVENT_ID));
  const depEventName = document.getElementById("dep-event-name");
  const depEventMeta = document.getElementById("dep-event-meta");
  if (depEventName) depEventName.textContent = event ? event.name : "Active Workflow";
  if (depEventMeta) depEventMeta.textContent = event ? `${event.date} · ${event.venue}` : "By event and stage";
  renderDepGraph("dep-graph-full", false);
}

function toggleDepEventDropdown() {
  const wrap = document.getElementById("dep-event-picker")?.closest(".dep-event-picker-wrap");
  if (wrap) wrap.classList.toggle("open");
}

function pickDepEvent(value) {
  const wrap = document.getElementById("dep-event-picker")?.closest(".dep-event-picker-wrap");
  if (wrap) wrap.classList.remove("open");
  setDependencyEvent(value || null);
}

/* ─────────────────────────────────────
   SUBMISSION FORM
───────────────────────────────────── */
function getActiveTasksForSubmit() {
  const isRedoRequested = (t) => Boolean(t && (t.redo_notes || t.redo_requested_at));
  let tasks = TASKS.filter((t) => {
    if (!t || t.assigned_email !== USER.email) return false;
    // Redo tasks must always be available for resubmission, even if their status would otherwise be excluded.
    if (isRedoRequested(t)) return true;
    return !["done", "pending", "pending_review"].includes(t.status);
  });
  if (SUBMIT_EVENT_FILTER != null) {
    tasks = tasks.filter((t) => Number(t.event_id) === Number(SUBMIT_EVENT_FILTER));
  }
  return tasks;
}

function renderSubmitEventToggle(prefix) {
  const root = document.getElementById(prefix + '-event-toggle');
  if (!root) return;
  const isRedoRequested = (t) => Boolean(t && (t.redo_notes || t.redo_requested_at));
  const mine = TASKS.filter((t) => t.assigned_email === USER.email && (isRedoRequested(t) || !["done", "pending", "pending_review"].includes(t.status)));
  const evIds = Array.from(new Set(mine.map((t) => Number(t.event_id)).filter((id) => Number.isFinite(id))));
  const evs = EVENTS.filter((e) => evIds.includes(Number(e.id)));
  root.innerHTML = `<button type="button" class="submit-event-chip ${SUBMIT_EVENT_FILTER == null ? 'active' : ''}" onclick="setSubmitEventFilter('${prefix}','')">All events</button>` +
    evs.map((e) => `<button type="button" class="submit-event-chip ${Number(SUBMIT_EVENT_FILTER) === Number(e.id) ? 'active' : ''}" onclick="setSubmitEventFilter('${prefix}','${e.id}')">${(e.name || 'Event').replace(/</g, '&lt;')}</button>`).join('');
}

function setSubmitEventFilter(prefix, eventId) {
  SUBMIT_EVENT_FILTER = eventId ? Number(eventId) : null;
  const sel = document.getElementById(prefix + '-task-sel');
  const tasks = getActiveTasksForSubmit();
  if (sel) sel.value = tasks.length ? String(tasks[0].id) : '';
  renderSubmitEventToggle(prefix);
  updateCompletionTaskCard(prefix);
  updateCompSteps(prefix);
}

function renderSubmitEventChecklist(prefix) {
  const root = document.getElementById(prefix + '-event-checklist');
  const sel = document.getElementById(prefix + '-task-sel');
  if (!root || !sel) return;
  const selectedTask = TASKS.find((t) => Number(t.id) === Number(sel.value));
  if (!selectedTask || !selectedTask.event_id) {
    root.innerHTML = '<div class="comp-ds-meta" style="opacity:.75">Pick a task to see event completion progress.</div>';
    return;
  }
  const evTasks = TASKS.filter((t) => Number(t.event_id) === Number(selectedTask.event_id) && t.assigned_email === USER.email);
  if (!evTasks.length) {
    root.innerHTML = '<div class="comp-ds-meta" style="opacity:.75">No personal tasks found for this event.</div>';
    return;
  }
  root.innerHTML = evTasks.map((t) => {
    const done = t.status === 'done' || t.status === 'pending' || t.status === 'pending_review';
    const mark = done ? 'done' : '';
    const blockedBy = getBlockingPrereq(t);
    const isRedoRequested = Boolean(t.redo_notes || t.redo_requested_at);
    const status = done
      ? 'completed'
      : blockedBy
        ? `locked by ${blockedBy.title} • ${blockedBy.owner || "Unassigned"}`
        : (isRedoRequested ? 'redo' : t.status === 'overdue' ? 'overdue' : 'active');
    return `<div class="comp-event-check-row">
      <div class="comp-event-check-left">
        <span class="comp-event-check-mark ${mark}">${done ? '✓' : blockedBy ? '!' : ''}</span>
        <span class="comp-event-check-title">${(t.title || '').replace(/</g, '&lt;')}</span>
      </div>
      <span class="comp-event-check-meta">${status}</span>
    </div>`;
  }).join('');
}

function renderSubmissionForm(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const currentTasks = getActiveTasksForSubmit();
  const firstTask = currentTasks[0] || null;
  el.innerHTML = `
    <div class="comp-steps">
      <div class="comp-step active"><div class="comp-step-num">1</div><div class="comp-step-label">Task & Summary</div></div>
      <div class="comp-step"><div class="comp-step-num">2</div><div class="comp-step-label">Links & Files</div></div>
      <div class="comp-step"><div class="comp-step-num">3</div><div class="comp-step-label">Handoff Notes</div></div>
      <div class="comp-step"><div class="comp-step-num">4</div><div class="comp-step-label">Review & Submit</div></div>
    </div>
    <div class="comp-side-card" style="margin-bottom:18px">
      <div class="comp-sl">Good Submission</div>
      <div class="comp-side-card-sub">What makes your submission useful to reviewers and the next person.</div>
      <div class="comp-checklist">
        <div class="comp-cl-item"><span class="comp-cl-icon done">✓</span><span>Be specific about <em>what</em> you did, not just that you did it</span></div>
        <div class="comp-cl-item"><span class="comp-cl-icon todo">○</span><span>Include at least one link or file as proof</span></div>
        <div class="comp-cl-item"><span class="comp-cl-icon todo">○</span><span>Name any blockers or open issues</span></div>
        <div class="comp-cl-item"><span class="comp-cl-icon todo">○</span><span>Write the handoff note for the next person</span></div>
      </div>
    </div>
    <div class="submit-status-card" id="${containerId}-submit-status">
      <div class="submit-status-title">Submission status</div>
      <div class="submit-status-sub">Select a task, submit evidence, and it will be shipped to VP review. Completed tasks are automatically removed from this list.</div>
    </div>
    <div class="submit-event-toggle" id="${containerId}-event-toggle"></div>
    <input type="hidden" id="${containerId}-task-sel" value="${firstTask ? firstTask.id : ''}" />
    <div class="task-sel-card" id="${containerId}-task-card" onclick="openTaskSelectModal('${containerId}')" style="cursor:pointer">
      <div class="tsc-left">
        <div class="tsc-event" id="${containerId}-tsc-event">${firstTask ? (firstTask.event || 'Task') : '—'}</div>
        <div class="tsc-title" id="${containerId}-tsc-title">${firstTask ? firstTask.title : 'Select a task'}</div>
        <div class="tsc-meta">
          <div class="tsc-meta-item"><span class="tsc-ml">Due</span><span class="tsc-mv" id="${containerId}-tsc-due">${firstTask ? firstTask.due : '—'}</span></div>
          <div class="tsc-meta-item"><span class="tsc-ml">Priority</span><span class="tsc-mv" id="${containerId}-tsc-prio">${firstTask ? (firstTask.priority || 'Medium') : '—'}</span></div>
          <div class="tsc-meta-item"><span class="tsc-ml">Owner</span><span class="tsc-mv" id="${containerId}-tsc-owner">${firstTask ? firstTask.assigned : USER.full}</span></div>
        </div>
      </div>
      <div class="tsc-right">
        <span class="badge-comp ${firstTask && firstTask.status === 'overdue' ? 'b-over' : 'b-cur'}" id="${containerId}-tsc-badge">${firstTask && firstTask.status === 'overdue' ? 'Overdue' : 'In Progress'}</span>
        <button type="button" class="tsc-change" onclick="event.preventDefault();event.stopPropagation();openTaskSelectModal('${containerId}')">${firstTask ? 'Change Task' : 'Select Task'}</button>
      </div>
    </div>
    <div class="comp-lock-note" id="${containerId}-lock-note" style="display:none">
      <div class="comp-lock-note-title">Locked by prerequisite</div>
      <div class="comp-lock-note-sub" id="${containerId}-lock-note-sub"></div>
    </div>
    <div class="comp-redo-note" id="${containerId}-redo-note" style="display:none">
      <div class="comp-redo-note-title">Redo requested</div>
      <div class="comp-redo-note-sub" id="${containerId}-redo-note-sub"></div>
    </div>
    <div class="comp-form-stack">
      <div class="comp-form-main" style="max-width:100%">
        <div class="comp-sl">Summary</div>
        <div class="comp-fg">
          <label class="comp-fl">What did you do?</label>
          <div class="comp-fl-sub">Describe specifically what was completed. Write for the next person in the chain.</div>
          <textarea class="comp-fi comp-fta" id="${containerId}-summary" oninput="updateCompCharCount('${containerId}','summary','summary-count');updateCompSteps('${containerId}')" placeholder="e.g. Built the full 8-week rehearsal schedule. Room bookings confirmed. Google Sheet distributed to all dancers."></textarea>
          <div class="comp-char-note" id="${containerId}-summary-count">0 / 400 recommended</div>
        </div>
        <div class="comp-sl">Completion Quality</div>
        <div class="comp-quality-row">
          <button type="button" class="comp-q-btn" data-q="smooth" onclick="setCompQuality('${containerId}',this)"><div class="comp-q-icon">✓</div><div class="comp-q-label">Smooth</div></button>
          <button type="button" class="comp-q-btn" data-q="rough" onclick="setCompQuality('${containerId}',this)"><div class="comp-q-icon">△</div><div class="comp-q-label">Rough but done</div></button>
          <button type="button" class="comp-q-btn" data-q="blocker" onclick="setCompQuality('${containerId}',this)"><div class="comp-q-icon">⚠</div><div class="comp-q-label">Had blockers</div></button>
        </div>
        <div class="comp-dv"></div>
        <div class="comp-sl">Proof Links</div>
        <div class="comp-fl-sub" style="margin-bottom:10px">Add Google Drive links, Docs, or any direct URL as proof.</div>
        <textarea class="comp-fi comp-fta-sm" id="${containerId}-links" oninput="updateCompSteps('${containerId}')" placeholder="https://drive.google.com/...&#10;https://docs.google.com/..."></textarea>
        <div class="comp-dv"></div>
        <div class="comp-sl">Blockers / Open Issues</div>
        <textarea class="comp-fi comp-fta-sm" id="${containerId}-blockers" oninput="updateCompSteps('${containerId}')" placeholder="Anything that slowed you down or needs follow-up?"></textarea>
        <div class="comp-dv"></div>
        <div class="comp-sl">File Attachments</div>
        <div class="comp-drop-zone" id="${containerId}-drop" ondragover="dragOver(event,'${containerId}-drop')" ondragleave="dragLeave('${containerId}-drop')" ondrop="dropFile(event,'${containerId}-drop');updateCompSteps('${containerId}')" onclick="document.getElementById('${containerId}-file').click()">
          <div class="comp-dz-text"><strong>Click to upload</strong> or drag and drop</div>
          <div class="comp-dz-sub">PDF, PNG, JPG, DOCX · Max 50 MB per file</div>
          <input type="file" id="${containerId}-file" multiple style="display:none" onchange="handleFileInput(this,'${containerId}-drop');updateCompSteps('${containerId}')" />
        </div>
        <div class="comp-form-footer">
          <div class="comp-ff-note"><strong>Ready to submit?</strong> Your VP will be notified immediately. If returned for redo, you'll get revision notes.</div>
          <div class="comp-ff-btns">
            <button type="button" class="btn btn-ghost" onclick="navigate('tasks')">Cancel</button>
            <button type="button" class="btn btn-gold" id="${containerId}-submit-btn" onclick="submitWork('${containerId}')">Submit for VP Review</button>
          </div>
        </div>
      </div>
    </div>
    <div class="comp-side-card" style="margin-top:14px">
      <div class="comp-sl">Your Event Task Progress</div>
      <div class="comp-side-card-sub" style="margin-bottom:10px">Track your tasks for this event with completion checkmarks.</div>
      <div class="comp-event-checklist" id="${containerId}-event-checklist"></div>
    </div>`;
  renderSubmitEventToggle(containerId);
  updateCompletionTaskCard(containerId);
  renderSubmitEventChecklist(containerId);
  updateCompSteps(containerId);
}

function openTaskSelectModal(prefix) {
  const listEl = document.getElementById('task-select-list');
  if (!listEl) return;
  const currentTasks = getActiveTasksForSubmit();
  listEl.innerHTML = currentTasks.length
    ? currentTasks.map(t => `
        <div class="task-select-opt ${getBlockingPrereq(t) ? 'locked-opt' : ''}" onclick="pickTaskForCompletion('${prefix}',${t.id});closeModal('task-select-modal')" style="padding:14px 18px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .2s">
          <div style="font-weight:500;color:var(--white)">${t.title}</div>
          <div style="font-size:11px;color:var(--silver);margin-top:4px">${t.event || 'Task'} · ${t.assigned || ''}</div>
          ${getBlockingPrereq(t) ? `<div class="task-lock-note"><strong>LOCKED:</strong> ${getBlockingPrereq(t).title} must be completed first by ${getBlockingPrereq(t).owner || 'Unassigned'}.</div>` : ''}
        </div>`).join('')
    : '<div style="padding:20px;color:var(--silver);text-align:center">No tasks available to complete.</div>';
  openModal('task-select-modal');
}

function pickTaskForCompletion(prefix, taskId) {
  const hid = document.getElementById(prefix + '-task-sel');
  const picked = TASKS.find((t) => Number(t.id) === Number(taskId));
  if (picked && picked.event_id) SUBMIT_EVENT_FILTER = Number(picked.event_id);
  if (hid) hid.value = String(taskId);
  renderSubmitEventToggle(prefix);
  updateCompletionTaskCard(prefix);
  renderSubmitEventChecklist(prefix);
  updateCompSteps(prefix);
  const btn = document.querySelector(`#${prefix}-task-card .tsc-change`);
  if (btn) btn.textContent = 'Change Task';
}

function updateCompSteps(prefix) {
  const steps = document.querySelectorAll('.comp-step');
  if (!steps.length) return;
  const taskSel = document.getElementById(prefix + '-task-sel');
  const taskId = taskSel ? Number(taskSel.value) : 0;
  const summary = (document.getElementById(prefix + '-summary') || {}).value || '';
  const links = (document.getElementById(prefix + '-links') || {}).value || '';
  const fileInput = document.getElementById(prefix + '-file');
  const hasFiles = fileInput && fileInput.files && fileInput.files.length > 0;
  const blockers = (document.getElementById(prefix + '-blockers') || {}).value || '';
  let active = 0;
  if (!taskId) active = 0;
  else if (!summary.trim()) active = 1;
  else if (!links.trim() && !hasFiles) active = 2;
  else active = 3;
  steps.forEach((s, i) => {
    s.classList.toggle('active', i === active);
    s.classList.toggle('done', i < active);
  });
}

function updateCompCharCount(prefix, field, countId) {
  const ta = document.getElementById(prefix + '-' + field);
  const cnt = document.getElementById(prefix + '-' + countId);
  if (!ta || !cnt) return;
  const n = ta.value.length;
  cnt.textContent = n + ' / 400 recommended';
  cnt.className = 'comp-char-note' + (n > 400 ? ' warn' : '');
}

function setCompQuality(prefix, btn) {
  const row = btn.closest('.comp-quality-row');
  if (!row) return;
  const cls = 'on-' + (btn.dataset.q || '');
  if (btn.classList.contains(cls)) {
    btn.classList.remove(cls);
    return;
  }
  row.querySelectorAll('.comp-q-btn').forEach(b => b.classList.remove('on-smooth', 'on-rough', 'on-blocker'));
  btn.classList.add(cls);
}

function updateCompletionTaskCard(prefix) {
  const sel = document.getElementById(prefix + '-task-sel');
  if (!sel) return;
  const available = getActiveTasksForSubmit();
  const id = Number(sel.value);
  let t = TASKS.find(x => x.id === id);
  if ((!t || !available.some((x) => Number(x.id) === Number(t.id))) && available.length) {
    sel.value = String(available[0].id);
    t = available[0];
  }
  if (!available.length) {
    sel.value = "";
    t = null;
  }
  const card = document.getElementById(prefix + '-task-card');
  if (!card) return;
  const set = (suffix, text) => { const el = document.getElementById(prefix + suffix); if (el) el.textContent = text || '—'; };
  const btn = card.querySelector('.tsc-change');
  const submitBtn = document.getElementById(prefix + '-submit-btn');
  const lockNote = document.getElementById(prefix + '-lock-note');
  const lockNoteSub = document.getElementById(prefix + '-lock-note-sub');
  const redoNote = document.getElementById(prefix + '-redo-note');
  const redoNoteSub = document.getElementById(prefix + '-redo-note-sub');
  if (t) {
    const blockedBy = getBlockingPrereq(t);
    const isRedoRequested = Boolean(t.redo_notes || t.redo_requested_at);
    const uiStatus = isRedoRequested ? 'redo' : t.status;
    set('-tsc-event', t.event || 'Task');
    set('-tsc-title', t.title);
    set('-tsc-due', t.due || '—');
    set('-tsc-prio', (t.priority || 'Medium'));
    set('-tsc-owner', t.assigned || USER.full);
    const badge = document.getElementById(prefix + '-tsc-badge');
    if (badge) {
      if (blockedBy) {
        badge.textContent = 'Locked';
        badge.className = 'badge-comp b-lock';
      } else {
        if (uiStatus === 'redo') {
          badge.textContent = 'Redo';
          badge.className = 'badge-comp b-redo';
        } else {
          badge.textContent = t.status === 'overdue' ? 'Overdue' : 'In Progress';
          badge.className = 'badge-comp ' + (t.status === 'overdue' ? 'b-over' : 'b-cur');
        }
      }
    }
    if (lockNote && lockNoteSub) {
      if (blockedBy) {
        lockNote.style.display = '';
        lockNoteSub.textContent = `${blockedBy.title} must be completed first by ${blockedBy.owner || "Unassigned"}.`;
      } else {
        lockNote.style.display = 'none';
        lockNoteSub.textContent = '';
      }
    }
    if (redoNote && redoNoteSub) {
      if (uiStatus === 'redo') {
        redoNote.style.display = '';
        const notes = t.redo_notes ? String(t.redo_notes) : 'Please review the redo request and resubmit.';
        const requested = t.redo_requested_at ? `\nRequested: ${new Date(t.redo_requested_at).toLocaleDateString()}` : '';
        redoNoteSub.textContent = notes + requested;
      } else {
        redoNote.style.display = 'none';
        redoNoteSub.textContent = '';
      }
    }
    if (submitBtn) {
      const locked = Boolean(blockedBy);
      submitBtn.disabled = locked;
      submitBtn.style.opacity = locked ? '.5' : '';
      submitBtn.style.cursor = locked ? 'not-allowed' : '';
      submitBtn.textContent = locked ? 'Locked by dependency' : (uiStatus === 'redo' ? 'Resubmit for VP Review' : 'Submit for VP Review');
    }
    if (btn) btn.textContent = 'Change Task';
  } else {
    set('-tsc-event', '—');
    set('-tsc-title', 'Select a task');
    set('-tsc-due', '—');
    set('-tsc-prio', '—');
    set('-tsc-owner', USER.full);
    const badge = document.getElementById(prefix + '-tsc-badge');
    if (badge) { badge.textContent = 'In Progress'; badge.className = 'badge-comp b-cur'; }
    if (lockNote && lockNoteSub) {
      lockNote.style.display = 'none';
      lockNoteSub.textContent = '';
    }
    if (redoNote && redoNoteSub) {
      redoNote.style.display = 'none';
      redoNoteSub.textContent = '';
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.style.opacity = '.5';
      submitBtn.style.cursor = 'not-allowed';
      submitBtn.textContent = 'Select task first';
    }
    if (btn) btn.textContent = 'Select Task';
  }
  renderSubmitEventChecklist(prefix);
}

function renderReportsLive() {
  const root = document.getElementById('reports-list');
  if (!root) return;
  const reports = (typeof DASHBOARD !== 'undefined' && DASHBOARD && DASHBOARD.reports) ? DASHBOARD.reports : [];
  root.innerHTML = reports.length
    ? reports.map((r) => {
        const meta = `${r.event_name || 'No event'}${r.task_title ? ' · ' + r.task_title : ''} · ${r.created_at ? new Date(r.created_at).toLocaleString() : ''}`;
        const actions = USER.permission === 'president'
          ? `<div class="approval-actions">
              <button class="btn btn-outline" style="font-size:9px;padding:5px 10px" onclick="updateReportStatus(${r.id}, 'reviewed')">Mark Reviewed</button>
              <button class="btn btn-outline" style="font-size:9px;padding:5px 10px" onclick="updateReportStatus(${r.id}, 'needs_clarification')">Clarify</button>
              <button class="btn btn-red" style="font-size:9px;padding:5px 10px" onclick="updateReportStatus(${r.id}, 'archived')">Archive</button>
            </div>`
          : '';
        const clarification = r.clarification_notes
          ? `<details style="margin-top:10px;border-left:2px solid var(--amber);background:var(--amber-dim);padding:8px 10px;">
              <summary style="cursor:pointer;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--amber);">Clarification requested</summary>
              <div style="font-size:11px;color:var(--silver);margin-top:6px;line-height:1.6">${(r.clarification_notes || '').replace(/</g, '&lt;')}</div>
            </details>`
          : '';
        return `<div class="approval-item">
          <div class="approval-header">
            <div>
              <div class="approval-task">${(r.reason || '').replace(/</g, '&lt;')}</div>
              <div class="approval-by">${(r.submitted_by_name || '').replace(/</g, '&lt;')} · ${(r.submitted_by_role || '').replace(/</g, '&lt;')} · ${(r.division || '').replace(/</g, '&lt;')}</div>
              <div style="font-size:11px;color:var(--silver);margin-top:6px">${(r.notes || '').replace(/</g, '&lt;')}</div>
              ${clarification}
              <div style="font-size:10px;color:var(--gold);margin-top:6px">${meta.replace(/</g, '&lt;')}</div>
            </div>
            ${actions}
          </div>
        </div>`;
      }).join('')
    : '<div style="font-size:13px;color:var(--silver);padding:12px">No reports sent yet.</div>';
}

function updateReportStatus(reportId, status) {
  if (USER.permission !== 'president') return;
  apiPatch('/api/reports/' + reportId, { status }).then(() => {
    showToast('Report updated.');
    hydrateBoardData().then(() => { renderReportsLive(); });
  }).catch(() => showToast('Unable to update report.'));
}

/* ─── Board: Report to VP (same logic as VP escalate) ─── */
function populateBoardReportSelectors() {
  const eventRoot = document.getElementById('board-report-event');
  const taskRoot = document.getElementById('board-report-task');
  const events = (typeof DASHBOARD !== 'undefined' && DASHBOARD && DASHBOARD.events) ? DASHBOARD.events : [];
  const tasks = (typeof DASHBOARD !== 'undefined' && DASHBOARD && DASHBOARD.tasks) ? DASHBOARD.tasks : [];
  if (eventRoot) eventRoot.innerHTML = '<option value="">No linked event</option>' + events.map((e) => '<option value="' + e.id + '">' + (e.name || '').replace(/</g, '&lt;') + '</option>').join('');
  if (taskRoot) taskRoot.innerHTML = '<option value="">No linked task</option>' + tasks.map((t) => '<option value="' + t.id + '">' + (t.title || '').replace(/</g, '&lt;') + '</option>').join('');
}

const BOARD_ESC_SEV = {
  critical: { btnCls: 'active-crit', bannerColor: 'var(--red)', bannerBg: 'var(--red-dim)', icon: '⚠', text: 'Critical — your VP will be alerted immediately.', footerNote: '<strong>Critical</strong> — Your Division VP is notified immediately.', btnCls2: 'crit', btnLabel: 'Send Critical Report' },
  high: { btnCls: 'active-high', bannerColor: 'var(--amber)', bannerBg: 'var(--amber-dim)', icon: '◑', text: 'High — time-sensitive. Your VP will review soon.', footerNote: '<strong>High severity</strong> — Your Division VP will be notified. Reports are visible only to you and your VP.', btnCls2: '', btnLabel: 'Send Report to VP' },
  standard: { btnCls: 'active-std', bannerColor: 'var(--gold)', bannerBg: 'rgba(184,154,92,.07)', icon: '◈', text: 'Standard — your VP will review when available.', footerNote: '<strong>Standard</strong> — Your VP will review at their next availability.', btnCls2: '', btnLabel: 'Send Report to VP' }
};
let boardEscCurSev = 'high';

function boardEscSetSev(el) {
  if (!el) return;
  document.querySelectorAll('#page-report-to-vp .sev-btn').forEach((b) => b.className = 'sev-btn');
  const sev = el.getAttribute('data-sev') || 'high';
  boardEscCurSev = sev;
  const cfg = BOARD_ESC_SEV[sev] || BOARD_ESC_SEV.high;
  el.classList.add(cfg.btnCls);
  const banner = document.getElementById('board-sev-banner');
  if (banner) { banner.style.borderLeftColor = cfg.bannerColor; banner.style.background = cfg.bannerBg; banner.style.color = cfg.bannerColor; banner.classList.add('show'); }
  const iconEl = document.getElementById('board-sev-icon'); if (iconEl) iconEl.textContent = cfg.icon;
  const textEl = document.getElementById('board-sev-text'); if (textEl) textEl.textContent = cfg.text;
  const noteEl = document.getElementById('board-esc-footer-note'); if (noteEl) noteEl.innerHTML = cfg.footerNote;
  const btn = document.getElementById('board-esc-send-btn'); if (btn) { btn.className = 'esc-btn-send ' + cfg.btnCls2; btn.textContent = cfg.btnLabel; }
}

function boardEscTogType(el) {
  if (!el) return;
  document.querySelectorAll('#page-report-to-vp .type-chip').forEach((c) => c.classList.remove('on'));
  el.classList.add('on');
  const hid = document.getElementById('board-report-reason');
  if (hid) hid.value = el.getAttribute('data-reason') || '';
}

function boardEscCountChars(taId, hintId) {
  const ta = document.getElementById(taId);
  const hint = document.getElementById(hintId);
  if (!ta || !hint) return;
  const max = taId === 'board-report-notes' ? 800 : 200;
  const n = (ta.value || '').length;
  hint.textContent = n + ' / ' + max + ' recommended';
  hint.className = 'esc-char-hint' + (n > max ? ' warn' : '');
}

function boardEscInitSev() {
  const highBtn = document.querySelector('#page-report-to-vp .sev-btn[data-sev="high"]');
  if (highBtn && typeof boardEscSetSev === 'function') boardEscSetSev(highBtn);
}

async function sendReportToVP() {
  const reason = (document.getElementById('board-report-reason') && document.getElementById('board-report-reason').value) || '';
  const notesEl = document.getElementById('board-report-notes');
  const notesRaw = notesEl ? notesEl.value : '';
  if (!reason.trim() || !notesRaw.trim()) {
    showToast('Please select an issue type and provide report details.');
    return;
  }
  const severityPrefix = '[Severity: ' + (boardEscCurSev.charAt(0).toUpperCase() + boardEscCurSev.slice(1)) + '] ';
  const notes = severityPrefix + notesRaw.trim();
  try {
    await apiPost('/api/reports', {
      reason: reason.trim(),
      event_id: (document.getElementById('board-report-event') && document.getElementById('board-report-event').value) || null,
      task_id: (document.getElementById('board-report-task') && document.getElementById('board-report-task').value) || null,
      notes,
      recommended_action: (document.getElementById('board-report-action') && document.getElementById('board-report-action').value) || ''
    });
    if (notesEl) notesEl.value = '';
    const actionEl = document.getElementById('board-report-action');
    if (actionEl) actionEl.value = '';
    const h1 = document.getElementById('board-report-notes-hint'); if (h1) h1.textContent = '0 / 800 recommended';
    const h2 = document.getElementById('board-report-action-hint'); if (h2) h2.textContent = '0 / 200 recommended';
    showToast('Report sent to your Division VP.');
    navigate('reports');
    await hydrateBoardData();
    renderReportsLive();
  } catch (_e) {
    showToast('Unable to send report.');
  }
}

/* ─── Newsletter editor (Director of Operations only; same API as president/VP) ─── */
var presidentNewsletters = [];
var newsletterImageInput = null;
window.loadNewsletterPage = async function loadNewsletterPage() {
  var listEl = document.getElementById('newsletter-editor-list');
  if (!listEl) return;
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
    var imgSrc = n.image ? (n.image.startsWith('/') ? window.location.origin + n.image : baseUrl + n.image) : '';
    if (imgSrc && n._ts) imgSrc += '?t=' + n._ts;
    var desc = (n.description || '').slice(0, 280);
    if ((n.description || '').length > 280) desc += '…';
    desc = desc.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;').replace(/\n/g, '<br />');
    var title = (n.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    var date = (n.date || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return '<div style="background:var(--navy);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px;display:grid;grid-template-columns:min(180px,100%) 1fr;gap:20px;align-items:start">' +
      (imgSrc ? '<div style="aspect-ratio:4/5;border-radius:8px;overflow:hidden;background:var(--navy-light)"><img src="' + imgSrc + '" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.display=\'none\'" /></div>' : '<div style="aspect-ratio:4/5;border-radius:8px;background:var(--navy-light);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--silver)">No image</div>') +
      '<div><div style="font-family:var(--fd);font-size:20px;color:var(--white);margin-bottom:4px">' + title + '</div>' +
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
    openModal('newsletter-full-modal');
    return;
  }
  var baseUrl = window.location.origin + (window.location.pathname.replace(/\/[^/]*$/, '') || '') + '/';
  body.innerHTML = presidentNewsletters.map(function (n) {
    var imgSrc = n.image ? (n.image.startsWith('/') ? window.location.origin + n.image : baseUrl + n.image) : '';
    var desc = (n.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;').replace(/\n/g, '<br />');
    var title = (n.title || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    var date = (n.date || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return '<div style="background:var(--navy);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:24px;margin-bottom:20px">' +
      '<div style="font-family:var(--fd);font-size:22px;color:var(--white);margin-bottom:6px">' + title + '</div>' +
      '<div style="font-size:11px;color:var(--gold-light);letter-spacing:.08em;margin-bottom:16px">' + date + '</div>' +
      (imgSrc ? '<div style="margin-bottom:16px;border-radius:8px;overflow:hidden;max-width:100%"><img src="' + imgSrc + '" alt="" style="width:100%;max-width:400px;height:auto;display:block" onerror="this.parentElement.style.display=\'none\'" /></div>' : '') +
      '<div style="font-size:14px;color:var(--stone);line-height:1.7">' + desc + '</div></div>';
  }).join('');
  openModal('newsletter-full-modal');
};
function renderNewsletterEditorList() {
  var listEl = document.getElementById('newsletter-editor-list');
  if (!listEl) return;
  if (presidentNewsletters.length === 0) {
    listEl.innerHTML = '<p style="font-size:12px;color:var(--silver)">No newsletter entries yet. Click "Add newsletter entry" to create one.</p>';
    return;
  }
  var baseUrl = window.location.origin + (window.location.pathname.replace(/\/[^/]*$/, '') || '') + '/';
  var html = presidentNewsletters.map(function (n, i) {
    var title = (n.title || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    var date = (n.date || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    var desc = n.description || '';
    var descAttr = desc.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    var image = (n.image || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    var link = (n.link || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    var sec = (n.secondaryLink || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    var imgSrc = image ? (image.startsWith('/') ? window.location.origin + image : baseUrl + image) : '';
    if (imgSrc && n._ts) imgSrc += '?t=' + n._ts;
    return '<div class="newsletter-editor-card" data-index="' + i + '" style="background:var(--navy-light);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">' +
      '<span style="font-size:11px;letter-spacing:.1em;color:var(--gold)">Entry ' + (i + 1) + '</span>' +
      '<button type="button" class="btn btn-outline" style="padding:4px 10px;font-size:10px" onclick="newsletterRemoveEntry(' + i + ')">Remove</button></div>' +
      '<div class="fg" style="margin-bottom:10px"><label>Title</label><input type="text" data-nl-field="title" value="' + title + '" placeholder="e.g. February Newsletter" style="background:var(--navy);border:1px solid rgba(255,255,255,.12);padding:10px 12px;border-radius:8px;color:var(--white);font-size:13px;width:100%" /></div>' +
      '<div class="fg" style="margin-bottom:10px"><label>Date</label><input type="text" data-nl-field="date" value="' + date + '" placeholder="e.g. February 2026" style="background:var(--navy);border:1px solid rgba(255,255,255,.12);padding:10px 12px;border-radius:8px;color:var(--white);font-size:13px;width:100%" /></div>' +
      '<div class="fg" style="margin-bottom:10px"><label>Description</label><textarea data-nl-field="description" data-value="' + descAttr + '" rows="4" placeholder="Newsletter body text..." style="background:var(--navy);border:1px solid rgba(255,255,255,.12);padding:10px 12px;border-radius:8px;color:var(--white);font-size:13px;width:100%;resize:vertical"></textarea></div>' +
      (imgSrc ? '<div style="margin-bottom:10px"><img src="' + imgSrc + '" alt="" style="max-width:200px;max-height:120px;object-fit:contain;border-radius:8px" onerror="this.style.display=\'none\'" /></div>' : '') +
      '<div style="margin-bottom:10px"><button type="button" class="btn btn-outline" style="padding:6px 12px;font-size:11px" onclick="newsletterUploadImage(' + i + ')">Upload new image</button></div>' +
      '<div class="fg" style="margin-bottom:10px"><label>Primary link (e.g. Instagram)</label><input type="url" data-nl-field="link" value="' + link + '" placeholder="https://..." style="background:var(--navy);border:1px solid rgba(255,255,255,.12);padding:10px 12px;border-radius:8px;color:var(--white);font-size:13px;width:100%" /></div>' +
      '<div class="fg" style="margin-bottom:0"><label>Secondary link (optional)</label><input type="url" data-nl-field="secondaryLink" value="' + sec + '" placeholder="https://..." style="background:var(--navy);border:1px solid rgba(255,255,255,.12);padding:10px 12px;border-radius:8px;color:var(--white);font-size:13px;width:100%" /></div></div>';
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
    var token = getSessionToken();
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
    title: '', date: '', description: '', image: '', link: '', secondaryLink: ''
  });
  renderNewsletterEditorList();
};
window.newsletterRemoveEntry = function newsletterRemoveEntry(index) {
  presidentNewsletters.splice(index, 1);
  renderNewsletterEditorList();
};
window.newsletterSave = async function newsletterSave() {
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
  var token = getSessionToken();
  if (!token) { showToast('You must be logged in.'); return; }
  try {
    var res = await fetch('/api/site/newsletters', {
      method: 'PUT',
      headers: { 'x-session-token': token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ newsletters: payload })
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Save failed');
    presidentNewsletters = Array.isArray(data.newsletters) ? data.newsletters : payload;
    renderNewsletterPreview();
    showToast('Newsletters saved.');
  } catch (e) {
    showToast(e.message || 'Save failed');
  }
};
window.newsletterPushToGitHub = async function newsletterPushToGitHub() {
  var token = getSessionToken();
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

function setDiff(prefix, val) {
  const starsEl = document.getElementById(prefix + '-stars');
  if (!starsEl) return;
  const isComp = starsEl.querySelector('.comp-dstar');
  if (isComp) {
    starsEl.querySelectorAll('.comp-dstar').forEach(s => {
      s.classList.toggle('on', parseInt(s.dataset.v) <= val);
    });
    const labels = ['', 'Smooth', 'Easy', 'Moderate', 'Challenging', 'Very Hard'];
    const lbl = document.getElementById(prefix + '-diff-label');
    if (lbl) lbl.textContent = labels[val] || 'Not rated';
  } else {
    starsEl.querySelectorAll('.diff-star').forEach(s => {
      s.classList.toggle('active', parseInt(s.dataset.val) <= val);
    });
  }
}

function dragOver(e, id) {
  e.preventDefault();
  document.getElementById(id).classList.add('drag-over');
}
function dragLeave(id) {
  document.getElementById(id).classList.remove('drag-over');
}
function dropFile(e, id) {
  e.preventDefault();
  dragLeave(id);
  const files = Array.from(e.dataTransfer.files || []);
  const prefix = id.replace(/-drop$/, "");
  STAGED_FILES[prefix] = files;
  const zone = document.getElementById(id);
  const input = document.getElementById(prefix + '-file');
  if (input) {
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    input.files = dt.files;
  }
  if (zone) {
    zone.classList.remove('upload-loading','upload-warning','upload-error');
    const text = zone.querySelector('.drop-text') || zone.querySelector('.comp-dz-text');
    if (files.length) {
      zone.classList.add('upload-done');
      if (text) text.textContent = files.map(f => f.name).join(', ');
    } else {
      if (text) {
        if (zone.classList.contains('comp-drop-zone')) {
          text.innerHTML = '<strong>Click to upload</strong> or drag and drop';
        } else {
          text.innerHTML = 'Drag files here or <span style="color:var(--gold);cursor:pointer" onclick="document.getElementById(\'' + prefix + '-file\').click()">click to upload</span>';
        }
      }
    }
  }
  if (files.length) showToast(`Files staged: ${files.length} file(s)`);
}
function handleFileInput(input, dropId) {
  const zone = document.getElementById(dropId);
  const files = Array.from(input.files || []);
  const prefix = dropId.replace(/-drop$/, "");
  STAGED_FILES[prefix] = files;
  if (zone) {
    zone.classList.remove('upload-loading','upload-done','upload-warning','upload-error');
    const text = zone.querySelector('.drop-text') || zone.querySelector('.comp-dz-text');
    if (files.length) {
      zone.classList.add('upload-done');
      if (text) text.textContent = files.map(f => f.name).join(', ');
    } else {
      if (text) {
        if (zone.classList.contains('comp-drop-zone')) {
          text.innerHTML = '<strong>Click to upload</strong> or drag and drop';
        } else {
          text.innerHTML = 'Drag files here or <span style="color:var(--gold);cursor:pointer" onclick="document.getElementById(\'' + prefix + '-file\').click()">click to upload</span>';
        }
      }
    }
  }
  if (files.length) showToast(`Files staged: ${files.length} file(s)`);
}

function submitWork(prefix) {
  const taskEl = document.getElementById(prefix + '-task-sel');
  const task = taskEl ? Number(taskEl.value) : 0;
  const summaryEl = document.getElementById(prefix + '-summary');
  const summary = summaryEl ? summaryEl.value.trim() : '';
  const linksEl = document.getElementById(prefix + '-links');
  const links = linksEl ? linksEl.value.trim() : '';
  const blockersEl = document.getElementById(prefix + '-blockers');
  const blockers = blockersEl ? blockersEl.value.trim() : '';
  const qBtn = document.querySelector(`#${prefix} .comp-q-btn.on-smooth, #${prefix} .comp-q-btn.on-rough, #${prefix} .comp-q-btn.on-blocker`);
  const quality = qBtn ? (qBtn.getAttribute('data-q') || '') : '';
  const pickedTask = TASKS.find((t) => Number(t.id) === Number(task));
  const blockedBy = getBlockingPrereq(pickedTask);
  if (!task)    { showToast('Select a task first'); return; }
  if (blockedBy) { showToast(`Locked: complete ${blockedBy.title} (assigned to ${blockedBy.owner || "Unassigned"}) first.`); return; }
  if (!summary) { showToast('Summary cannot be empty'); return; }
  openConfirmModal(
    'Submit for Review?',
    'Your VP will be notified immediately. You can\'t edit the submission after sending.',
    'Submit',
    async () => {
      const confirmBtn = document.getElementById('confirm-action-btn');
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.classList.add('submit-loading');
        confirmBtn.innerHTML = '<span>Submitting…</span>';
      }
      try {
        await new Promise((r) => setTimeout(r, 3000));
        const liveTask = TASKS.find((t) => Number(t.id) === Number(task));
        if (!liveTask || ["done", "pending", "pending_review"].includes(liveTask.status)) {
          showToast('This task is already completed/submitted.');
          return;
        }
        const liveBlockedBy = getBlockingPrereq(liveTask);
        if (liveBlockedBy) {
          showToast(`Locked: complete ${liveBlockedBy.title} (assigned to ${liveBlockedBy.owner || "Unassigned"}) first.`);
          return;
        }
        const form = new FormData();
        form.append("summary", summary);
        form.append("proofLinks", links);
        form.append("comments", blockers);
        form.append("difficulty", quality || "");
        (STAGED_FILES[prefix] || []).forEach((f) => form.append("attachments", f));
        const fileInput = document.getElementById(prefix + '-file');
        if (fileInput && fileInput.files && fileInput.files.length) {
          for (let i = 0; i < fileInput.files.length; i++) form.append("attachments", fileInput.files[i]);
        }
        await apiPostMultipart(`/api/tasks/${task}/submit-form`, form);
        STAGED_FILES[prefix] = [];
        const submittedTitle = (TASKS.find((t) => Number(t.id) === Number(task)) || {}).title || "Task";
        if (summaryEl) summaryEl.value = "";
        if (linksEl) linksEl.value = "";
        if (blockersEl) blockersEl.value = "";
        const input = document.getElementById(prefix + '-file');
        if (input) input.value = "";
        const successSub = document.getElementById('submit-success-sub');
        if (successSub) successSub.textContent = `"${submittedTitle}" has been completed and shipped to VP review.`;
        await hydrateBoardData();
        renderKPIs();
        renderAllTaskLists();
        renderDepGraph('dep-graph-full', false);
        renderSubmissionForm('submit-form-card');
        renderMyDeadlines();
        renderEventsDeadlines();
        renderEventsPage();
        renderCalendar();
        renderDownstream();
        renderSubmitEventToggle(prefix);
        openModal('submit-success-modal');
        showToast('Submitted and sent for VP review');
      } catch (err) {
        showToast(err?.message || 'Submission failed');
      } finally {
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.classList.remove('submit-loading');
          confirmBtn.innerHTML = 'Submit';
        }
      }
    }
  );
}

/* ─────────────────────────────────────
   EVENTS + DEADLINES COL
───────────────────────────────────── */
function renderEventsDeadlines() {
  const el = document.getElementById('events-deadlines-col');
  if (!el) return;

  const evHtml = EVENTS.map(e => `
    <div class="event-item clickable ${e.overdue ? 'ev-urgent' : ''}" onclick="openEventModal(${Number(e.id)})">
      <div class="ev-date">${e.date} · ${e.venue}</div>
      <div class="ev-name">${e.name}</div>
      <div class="ev-meta">
        <span class="ev-tag">${e.type}</span>
        <span class="ev-tag">${e.yourTasks} your tasks</span>
        <span class="ev-tag">${e.yourDone || 0} completed</span>
        ${e.overdue ? `<span class="ev-tag ev-tag-red">${e.overdue} overdue</span>` : ''}
      </div>
      <div class="progress-wrap">
        <div class="progress-row-label"><span>Overall</span><span>${e.progress}%</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${e.progress}%"></div></div>
      </div>
    </div>`).join('');
  el.innerHTML = evHtml || '<div class="empty-state">No upcoming events.</div>';
}

function renderMyDeadlines() {
  const el = document.getElementById('my-deadlines-col');
  if (!el) return;
  const deadlines = TASKS
    .filter((t) => t.assigned_email === USER.email && t.due_at && !["done", "pending"].includes(t.status))
    .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
    .slice(0, 6)
    .map((t) => {
      const due = new Date(t.due_at);
      return {
        day: String(due.getDate()).padStart(2, "0"),
        month: due.toLocaleDateString(undefined, { month: "short" }),
        title: t.title,
        sub: `${t.event || "Standalone Task"} · ${t.status === "redo" ? "Redo" : t.status === "overdue" ? "Overdue" : "Current"}`,
        status: t.status
      };
    });
  el.innerHTML = deadlines.length ? deadlines.map(d => `
      <div class="deadline-row">
        <div>
          <div class="dl-date">${d.day}</div>
          <div class="dl-month">${d.month}</div>
        </div>
        <div class="dl-body">
          <div class="dl-title">${d.title}</div>
          <div class="dl-sub">${d.sub}</div>
        </div>
        <div class="dl-right">
          <span class="badge badge-${d.status === 'overdue' ? 'overdue' : d.status === 'redo' ? 'pending' : 'current'}">
            ${d.status === 'overdue' ? 'Overdue' : d.status === 'redo' ? 'Redo' : 'Current'}
          </span>
        </div>
      </div>`).join('')
    : '<div class="empty-state">No upcoming deadlines.</div>';
}

/* ─────────────────────────────────────
   EVENTS FULL PAGE
───────────────────────────────────── */
function renderEventsPage() {
  const el = document.getElementById('events-full-list');
  if (!el) return;
  const isBoard = USER.permission === 'board';
  const current = EVENTS.filter((e) => !e.isPast).sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
  const past = EVENTS.filter((e) => e.isPast).sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
  const renderEventCard = (e, section) => `
    <div class="card" style="margin-bottom:12px;cursor:pointer" onclick="openEventModal(${Number(e.id)})">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px">
        <div>
          <div style="font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:4px">${e.date} · ${e.venue}</div>
          <div style="font-family:var(--fd);font-size:24px;color:var(--white);margin-bottom:6px">${e.name}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${e.tags.map(tag => `<span class="ev-tag">${tag}</span>`).join('')}
            ${section === 'past' ? `<span class="ev-tag">Past</span>` : `<span class="ev-tag">Current</span>`}
            ${!isBoard && e.overdue ? `<span class="ev-tag ev-tag-red">${e.overdue} Overdue</span>` : ''}
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-family:var(--fd);font-size:34px;color:var(--white);line-height:1">${e.progress}%</div>
          <div style="font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--silver)">Complete</div>
        </div>
      </div>
      <div class="progress-bar" style="margin:12px 0 10px"><div class="progress-fill" style="width:${e.progress}%"></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr${isBoard ? '' : ' 1fr'};gap:8px;font-size:12px">
        <div class="card-sm"><div style="font-size:9px;text-transform:uppercase;letter-spacing:.15em;color:var(--gold);margin-bottom:4px">Your Tasks</div><span style="font-size:20px;font-family:var(--fd)">${e.yourTasks}</span></div>
        <div class="card-sm"><div style="font-size:9px;text-transform:uppercase;letter-spacing:.15em;color:var(--green);margin-bottom:4px">Done</div><span style="font-size:20px;font-family:var(--fd);color:var(--green)">${e.yourDone}</span></div>
        ${!isBoard ? `<div class="card-sm"><div style="font-size:9px;text-transform:uppercase;letter-spacing:.15em;color:${e.overdue ? 'var(--red)' : 'var(--silver)'};margin-bottom:4px">Overdue</div><span style="font-size:20px;font-family:var(--fd);color:${e.overdue ? 'var(--red)' : 'var(--silver)'}">${e.overdue}</span></div>` : ''}
      </div>
      ${(USER.permission === "president" || USER.permission === "vp")
        ? `<div style="margin-top:10px"><button class="btn btn-red btn-sm" onclick="event.stopPropagation();openConfirmModal('Delete this event?','Linked tasks will also be impacted.', 'Delete', () => removeEvent(${e.id}))">Delete Event</button></div>`
        : ""}
    </div>`;
  el.innerHTML = `
    <div class="section-eyebrow">Current</div>
    <div class="section-title" style="font-size:24px;margin-bottom:10px">Current Events</div>
    ${current.length ? current.map((e) => renderEventCard(e, 'current')).join('') : '<div class="empty-state" style="margin-bottom:18px">No current events.</div>'}
    <div class="section-eyebrow" style="margin-top:6px">Past</div>
    <div class="section-title" style="font-size:24px;margin-bottom:10px">Past Events</div>
    ${past.length ? past.map((e) => renderEventCard(e, 'past')).join('') : '<div class="empty-state">No past events.</div>'}
  `;
}

function openEventModal(eventId) {
  const event = EVENTS.find((e) => Number(e.id) === Number(eventId));
  if (!event) return;
  const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const taskCards = TASKS.filter((t) => Number(t.event_id) === Number(event.id))
    .map((t) => buildTaskCard(t, { forBoardEvents: true }))
    .join('') || '<div class="empty-state">No tasks for this event.</div>';
  const kv = (label, value) => `<div class="detail-row"><div class="detail-label">${label}</div><div class="detail-val">${value || '—'}</div></div>`;
  const body = `
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <span class="ev-tag">${esc(event.type || "Event")}</span>
      <span class="ev-tag">${event.isPast ? "Past" : "Current"}</span>
      <span class="ev-tag">${Number(event.progress || 0)}% Complete</span>
    </div>
    ${kv("Date", esc(event.date))}
    ${kv("Venue", esc(event.venue))}
    ${kv("Location", esc(event.location))}
    ${kv("Scope", esc(event.scope))}
    ${kv("Budget", event.budget_limit != null && event.budget_limit !== "" ? `$${Number(event.budget_limit).toLocaleString()}` : "—")}
    ${kv("Hard Deadline", esc(event.hard_deadline ? formatShortDate(event.hard_deadline) : ""))}
    ${kv("Timeline Assumptions", esc(event.timeline_assumptions))}
    ${kv("Planning Notes", esc(event.planning_notes))}
    ${kv("Roles", (event.roles || []).map(esc).join(", "))}
    ${kv("Divisions", (event.divisions || []).map(esc).join(", "))}
    <div class="detail-row"><div class="detail-label">Deliverables</div><div class="detail-val"><pre style="white-space:pre-wrap;margin:0">${esc(JSON.stringify(event.deliverables || {}, null, 2))}</pre></div></div>
    <div class="detail-row"><div class="detail-label">Constraints</div><div class="detail-val"><pre style="white-space:pre-wrap;margin:0">${esc(JSON.stringify(event.constraints || {}, null, 2))}</pre></div></div>
    <div style="font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--silver);margin:14px 0 8px">All Tasks for This Event</div>
    <div class="task-list">${taskCards}</div>
  `;
  const titleEl = document.getElementById("event-modal-title");
  const bodyEl = document.getElementById("event-modal-body");
  if (titleEl) titleEl.textContent = event.name || "Event Detail";
  if (bodyEl) bodyEl.innerHTML = body;
  openModal("event-modal");
}

/* ─────────────────────────────────────
   CALENDAR
───────────────────────────────────── */
function renderCalendar() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const label  = `${months[calMonth]} ${calYear}`;
  document.getElementById('cal-month-label').textContent = label;
  document.getElementById('cal-title') && (document.getElementById('cal-title').textContent = label);

  const key = `${calYear}-${String(calMonth + 1).padStart(2,'0')}`;
  const evMap = CAL_EVENTS[key] || {};

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysIn   = new Date(calYear, calMonth + 1, 0).getDate();
  const today    = new Date();
  const isToday  = (d) => today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === d;

  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let html = days.map(d => `<div class="cal-hdr">${d}</div>`).join('');

  // blank cells before month start
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-cell other"><div class="cal-day-num">${new Date(calYear, calMonth, -firstDay + i + 1).getDate()}</div></div>`;
  }

  for (let d = 1; d <= daysIn; d++) {
    const evs = evMap[d] || [];
    const hasEv = evs.length > 0;
    const todayCls = isToday(d) ? ' today' : '';
    const hasCls   = hasEv ? ' has-event' : '';
    const max = 2;
    const shown = evs.slice(0, max);
    const extra = evs.length - max;

    html += `<div class="cal-cell${todayCls}${hasCls}" onclick="calDayClick(${d})">
      <div class="cal-day-num${isToday(d) ? ' today-num' : ''}">${d}</div>
      ${shown.map(e => `<div class="cal-line ${e.cls}" title="${e.label}">${e.label}</div>`).join('')}
      ${extra > 0 ? `<div class="cal-more">+${extra} more</div>` : ''}
    </div>`;
  }

  // trailing cells
  const total = firstDay + daysIn;
  const trailing = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 1; i <= trailing; i++) {
    html += `<div class="cal-cell other"><div class="cal-day-num">${i}</div></div>`;
  }

  document.getElementById('cal-grid').innerHTML = html;
}

function changeMonth(dir) {
  calMonth += dir;
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0;  calYear++; }
  renderCalendar();
}

function calDayClick(day) {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  showToast(`${months[calMonth]} ${day} — ${calYear}`);
}

/* ─────────────────────────────────────
   DOWNSTREAM TASKS
───────────────────────────────────── */
function renderDownstream() {
  const el = document.getElementById('downstream-tasks');
  if (!el) return;
  const downstreamIds = new Set();
  TASKS.filter((t) => t.assigned_email === USER.email).forEach((t) => {
    (t.downstream || []).forEach((id) => downstreamIds.add(id));
  });
  const downstream = TASKS.filter((t) => downstreamIds.has(t.id)).slice(0, 4);
  el.innerHTML = downstream.map(t => buildTaskCard(t)).join('');
}

/* ─────────────────────────────────────
   TASK DETAIL MODAL
───────────────────────────────────── */
function openTaskModal(id) {
  if (document.getElementById("event-modal")?.classList.contains("open")) closeModal("event-modal");
  const t = TASKS.find(x => x.id === id);
  if (!t) return;
  const blockedBy = getBlockingPrereq(t);
  const isRedoRequested = Boolean(t.redo_notes || t.redo_requested_at);
  const uiStatus = isRedoRequested ? 'redo' : t.status;

  const badgeCls = {
    overdue:'badge-overdue',current:'badge-current',redo:'badge-pending',done:'badge-done'
  }[uiStatus] || 'badge-current';
  const label = { overdue:'Overdue',current:'Current',redo:'Redo',done:'Completed' }[uiStatus] || uiStatus;

  const depHtml = !isRedoRequested && t.dep && t.dep.length ? `
    <div class="detail-row">
      <div class="detail-label">Prerequisite</div>
      <div class="detail-val">
        <div class="tc-dep-chain" style="margin-top:4px">
          ${t.dep.map(d => `<div class="dep-chip ${d.status}">${d.title} — ${d.owner}</div><span class="dep-arrow">→</span>`).join('')}
          <div class="dep-chip active">This task</div>
        </div>
      </div>
    </div>` : '';
  const lockHtml = blockedBy ? `
    <div class="detail-row">
      <div class="detail-label">Dependency Lock</div>
      <div class="detail-val">Complete <strong style="color:var(--off-white)">${blockedBy.title}</strong> first. Assigned to <strong style="color:var(--off-white)">${blockedBy.owner || "Unassigned"}</strong>.</div>
    </div>` : '';

  const summaryHtml = t.summary ? `
    <div class="detail-row">
      <div class="detail-label">Completion Summary</div>
      <div class="detail-val">${t.summary}</div>
    </div>` : '';

  const meetHtml = t.meeting ? `
    <div class="detail-row">
      <div class="detail-label">Meeting</div>
      <div class="detail-val">${t.meeting.time} · ${t.meeting.location}</div>
    </div>` : '';
  const meetingLinkHtml = t.meeting_link ? `
    <div class="detail-row">
      <div class="detail-label">Meeting Link</div>
      <div class="detail-val"><a href="${t.meeting_link}" target="_blank" rel="noopener noreferrer" style="color:var(--gold-light)">${t.meeting_link}</a></div>
    </div>` : '';

  const redoInfoHtml = uiStatus === 'redo' ? `
    <div class="detail-row" style="border-left:3px solid rgba(212,145,74,.6);background:rgba(212,145,74,0.06)">
      <div class="detail-label" style="color:var(--amber)">Redo requested</div>
      <div class="detail-val" style="white-space:pre-wrap">${t.redo_notes ? String(t.redo_notes).replace(/</g,'&lt;') : 'Please review the redo request and resubmit.'}</div>
      ${t.redo_requested_at ? `<div style="font-size:11px;color:var(--silver);margin-top:8px">Requested: ${new Date(t.redo_requested_at).toLocaleDateString()}</div>` : ''}
    </div>` : '';

  document.getElementById('task-modal-title').textContent = t.title;
  document.getElementById('task-modal-body').innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <span class="badge ${badgeCls}">${label}</span>
      <span class="prio prio-${t.priority}">${t.priority}</span>
    </div>
    <div class="detail-row"><div class="detail-label">Description</div><div class="detail-val">${t.description}</div></div>
    <div class="detail-row"><div class="detail-label">Event</div><div class="detail-val">${t.event || 'Standalone'}</div></div>
    <div class="detail-row"><div class="detail-label">Department</div><div class="detail-val">${t.dept} · ${t.division} Division</div></div>
    <div class="detail-row"><div class="detail-label">Assigned To</div><div class="detail-val">${t.assigned}</div></div>
    <div class="detail-row"><div class="detail-label">Due Date</div><div class="detail-val">${t.due}</div></div>
    ${meetHtml}${meetingLinkHtml}${redoInfoHtml}${lockHtml}${depHtml}${summaryHtml}`;

  const canComplete = ["current", "overdue", "redo"].includes(uiStatus) && t.assigned_email === USER.email && !blockedBy;
  /* Board: complete only. President/VP: can delete. */
  const canManage = USER.permission === "president" || USER.permission === "vp";
  const actionBtn = document.getElementById('task-modal-action');
  if (canManage) {
    actionBtn.textContent = 'Delete Task';
    actionBtn.className = 'btn btn-red btn-sm';
    actionBtn.onclick = () => openConfirmModal(
      "Delete this task?",
      "This removes it from dashboards, calendar, and dependency views.",
      "Delete",
      async () => {
        closeModal('task-modal');
        await removeTask(t.id);
      }
    );
  } else {
    actionBtn.textContent = canComplete ? (uiStatus === 'redo' ? 'Resubmit' : 'Submit Completion') : (blockedBy ? 'Locked by dependency' : 'Close');
    actionBtn.className   = canComplete ? 'btn btn-gold btn-sm' : 'btn btn-ghost btn-sm';
    actionBtn.onclick     = canComplete
      ? () => { closeModal('task-modal'); openCompletionForm(t.id); }
      : () => closeModal('task-modal');
  }

  openModal('task-modal');
}

function openCompletionForm(id) {
  const t = TASKS.find(x => x.id === id);
  if (!t) return;
  const blockedBy = getBlockingPrereq(t);
  if (blockedBy) {
    showToast(`Locked: complete ${blockedBy.title} (assigned to ${blockedBy.owner || "Unassigned"}) first.`);
    return;
  }
  const isRedoRequested = Boolean(t.redo_notes || t.redo_requested_at);
  const uiStatus = isRedoRequested ? 'redo' : t.status;
  ["task-modal", "event-modal", "task-select-modal"].forEach((modalId) => {
    const modal = document.getElementById(modalId);
    if (modal && modal.classList.contains("open")) closeModal(modalId);
  });
  SUBMIT_EVENT_FILTER = t.event_id ? Number(t.event_id) : null;
  navigate('submit');
  const sel = document.getElementById('submit-form-card-task-sel');
  if (sel) sel.value = String(id);
  renderSubmitEventToggle('submit-form-card');
  updateCompletionTaskCard('submit-form-card');
  renderSubmitEventChecklist('submit-form-card');
  updateCompSteps('submit-form-card');
  showToast(`${uiStatus === 'redo' ? 'Ready to resubmit' : 'Ready to submit'}: ${t.title}`);
}

/* ─────────────────────────────────────
   MODALS
───────────────────────────────────── */
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function openConfirmModal(title, sub, actionLabel, callback) {
  document.getElementById('confirm-modal-title').textContent = title || 'Confirm Action';
  document.getElementById('confirm-msg').textContent   = title || 'Are you sure?';
  document.getElementById('confirm-sub').textContent   = sub   || 'This action cannot be undone.';
  const btn = document.getElementById('confirm-action-btn');
  btn.textContent = actionLabel || 'Confirm';
  btn.classList.remove('submit-loading');
  btn.disabled = false;
  btn.onclick = async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      if (typeof callback === 'function') {
        const shouldClose = await callback();
        if (shouldClose !== false) closeModal('confirm-modal');
      } else {
        closeModal('confirm-modal');
        showToast('Action confirmed');
      }
    } finally {
      btn.disabled = false;
      if (!btn.classList.contains('submit-loading')) btn.textContent = actionLabel || 'Confirm';
    }
  };
  openModal('confirm-modal');
}

// close on backdrop click
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) backdrop.classList.remove('open');
  });
});

// close dep event dropdown when clicking outside
document.addEventListener('click', function(e) {
  const wrap = document.querySelector('.dep-event-picker-wrap.open');
  if (wrap && !wrap.contains(e.target)) wrap.classList.remove('open');
});

/* ─────────────────────────────────────
   TOAST
───────────────────────────────────── */
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

/* live polling is handled in initBoardLive via startPolling */
