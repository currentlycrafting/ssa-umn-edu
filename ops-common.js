const POLL_INTERVAL_MS = 30000;

function getSessionToken() {
  return localStorage.getItem("ssa_ops_token") || "";
}

function setSession(session) {
  localStorage.setItem("ssa_ops_token", session.token);
  localStorage.setItem("ssa_ops_user", JSON.stringify(session.user));
}

function clearSession() {
  localStorage.removeItem("ssa_ops_token");
  localStorage.removeItem("ssa_ops_user");
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("ssa_ops_user") || "null");
  } catch (_e) {
    return null;
  }
}

function badgeClass(status) {
  const map = {
    current: "b-current",
    locked: "b-locked",
    overdue: "b-overdue",
    completed: "b-completed",
    pending_review: "b-pending_review",
    redo: "b-pending_review",
    upcoming: "b-locked"
  };
  return map[status] || "b-locked";
}

function formatDate(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}

async function apiGet(url) {
  const token = getSessionToken();
  const res = await fetch(url, {
    headers: { "x-session-token": token }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPost(url, body) {
  const token = getSessionToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-session-token": token
    },
    body: JSON.stringify(body || {})
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPatch(url, body) {
  const token = getSessionToken();
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-session-token": token
    },
    body: JSON.stringify(body || {})
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function requireSession() {
  const token = getSessionToken();
  if (!token) {
    window.location.href = "ops-login.html";
    return null;
  }

  try {
    const { user } = await apiGet("/api/me");
    return user;
  } catch (_e) {
    clearSession();
    window.location.href = "ops-login.html";
    return null;
  }
}

function startPolling(onUpdate) {
  const run = async () => {
    try {
      const data = await apiGet("/api/poll");
      onUpdate(data);
    } catch (_e) {
      // ignore polling errors in UI
    }
  };
  run();
  return setInterval(run, POLL_INTERVAL_MS);
}

function renderTaskList(root, tasks) {
  root.innerHTML = tasks
    .map(
      (t) => `
      <div class="task">
        <div>
          <div class="name">${t.title}</div>
          <div class="meta">${t.department} · ${t.owner_name} · Due ${formatDate(t.due_at)}</div>
        </div>
        <span class="badge ${badgeClass(t.status)}">${t.status.replaceAll("_", " ")}</span>
      </div>
    `
    )
    .join("");
}

function renderDependencyGraph(root, tasks, dependencies) {
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const outgoing = new Map();
  const incomingCount = new Map(tasks.map((t) => [t.id, 0]));
  dependencies.forEach((d) => {
    const arr = outgoing.get(d.depends_on_task_id) || [];
    arr.push(d.task_id);
    outgoing.set(d.depends_on_task_id, arr);
    incomingCount.set(d.task_id, (incomingCount.get(d.task_id) || 0) + 1);
  });
  const queue = tasks.filter((t) => (incomingCount.get(t.id) || 0) === 0).map((t) => t.id);
  const levels = new Map();
  queue.forEach((id) => levels.set(id, 0));
  while (queue.length) {
    const current = queue.shift();
    const nextLevel = (levels.get(current) || 0) + 1;
    (outgoing.get(current) || []).forEach((nextId) => {
      incomingCount.set(nextId, (incomingCount.get(nextId) || 1) - 1);
      levels.set(nextId, Math.max(levels.get(nextId) || 0, nextLevel));
      if ((incomingCount.get(nextId) || 0) === 0) queue.push(nextId);
    });
  }
  const grouped = new Map();
  tasks.forEach((t) => {
    const level = levels.get(t.id) || 0;
    const arr = grouped.get(level) || [];
    arr.push(t);
    grouped.set(level, arr);
  });
  const orderedLevels = [...grouped.keys()].sort((a, b) => a - b);
  root.innerHTML = orderedLevels.length
    ? orderedLevels
        .map((level, idx) => {
          const nodes = (grouped.get(level) || [])
            .map((t) => {
              const cls =
                t.status === "completed"
                  ? "done-node"
                  : t.status === "current" || t.status === "pending_review"
                  ? "active-node"
                  : t.status === "overdue"
                  ? "active-node"
                  : "locked-node";
              return `<div class="dep-node ${cls}" onclick="inspectTask(${t.id})">
                <div class="dep-dept">${t.department}</div>
                <div style="font-size:13px;color:var(--white);margin-bottom:6px">${t.title}</div>
                <div style="font-size:10px;color:var(--silver)">${t.owner_name || ""}</div>
                <div style="font-size:10px;color:${t.status === "overdue" ? "var(--red)" : "var(--gold)"};margin-top:6px">${String(t.status || "").replaceAll("_", " ")}</div>
              </div>`;
            })
            .join("");
          return `<div class="dep-row">${nodes}</div>${
            idx < orderedLevels.length - 1 ? '<div class="dep-arrow">↓</div>' : ""
          }`;
        })
        .join("")
    : "<div class='muted'>No dependency links yet.</div>";
}

function renderOperationalCalendar(root, events, tasks) {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const firstWeekday = monthStart.getDay();
  const itemsByDay = new Map();
  const pushItem = (iso, item) => {
    if (!iso) return;
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return;
    if (d.getMonth() !== today.getMonth() || d.getFullYear() !== today.getFullYear()) return;
    const key = d.getDate();
    const arr = itemsByDay.get(key) || [];
    arr.push(item);
    itemsByDay.set(key, arr);
  };
  events.forEach((e) =>
    pushItem(e.event_date, {
      kind: "event",
      label: e.name,
      tone: "gold"
    })
  );
  tasks.forEach((t) => {
    pushItem(t.due_at, {
      kind: "task",
      label: t.title,
      tone: t.status === "overdue" ? "red" : t.status === "completed" ? "green" : t.priority === "urgent" ? "red" : "stone"
    });
    pushItem(t.unlock_at, {
      kind: "unlock",
      label: `Unlock: ${t.title}`,
      tone: "blue"
    });
  });
  const headers = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    .map(
      (d) =>
        `<div style="padding:10px 12px;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--silver)">${d}</div>`
    )
    .join("");
  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(`<div style="min-height:118px;border:1px solid rgba(255,255,255,.04);background:rgba(255,255,255,.01)"></div>`);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const isToday = day === today.getDate();
    const items = (itemsByDay.get(day) || []).slice(0, 4);
    cells.push(`
      <div style="min-height:118px;border:1px solid rgba(255,255,255,.06);background:${isToday ? "rgba(184,154,92,.08)" : "rgba(255,255,255,.02)"};padding:10px;display:flex;flex-direction:column;gap:6px;transition:background .2s">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;color:${isToday ? "var(--gold)" : "var(--white)"};font-weight:${isToday ? "700" : "500"}">${day}</span>
          ${isToday ? '<span style="font-size:9px;letter-spacing:.18em;color:var(--gold);text-transform:uppercase">Today</span>' : ""}
        </div>
        ${items
          .map(
            (item) => `<div title="${item.label}" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:4px 6px;border-left:3px solid ${
              item.tone === "red"
                ? "var(--red)"
                : item.tone === "green"
                ? "var(--green)"
                : item.tone === "gold"
                ? "var(--gold)"
                : item.tone === "blue"
                ? "var(--blue)"
                : "rgba(255,255,255,.25)"
            };background:rgba(10,16,28,.7);font-size:10px;color:var(--off-white)">${item.label}</div>`
          )
          .join("")}
        ${(itemsByDay.get(day) || []).length > 4 ? `<div style="font-size:10px;color:var(--silver)">+ ${(itemsByDay.get(day) || []).length - 4} more</div>` : ""}
      </div>
    `);
  }
  root.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px">${headers}</div>
    <div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px">${cells.join("")}</div>
  `;
}
