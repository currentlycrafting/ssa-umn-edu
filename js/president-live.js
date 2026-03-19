/* president.html — live API integration layer */

// Live API integration layer for the existing President UI.
(async function wirePresidentLive() {
  const token = getSessionToken();
  if (!token) {
    window.location.href = "ops-login.html";
    return;
  }

  let dashboardCache = null;
  let selectedPresidentAssignee = "";
  let pendingConfirmAction = null;
  let hydrateDashboardBusy = false;
  window.__showArchivedReports = false;
  let confirmHoldTimer = null;
  let confirmHoldElapsed = 0;

  function toLegacyStatus(status) {
    if (status === "completed") return "done";
    if (status === "pending_review") return "pending";
    return status;
  }

  function renderOverviewLive(data) {
    const page = document.getElementById("page-overview");
    if (!page) return;
    const activeCount = data.tasks.filter((t) => ["current", "redo", "pending_review"].includes(t.status)).length;
    const overdueCount = data.tasks.filter((t) => t.status === "overdue").length;
    const pendingCount = data.tasks.filter((t) => t.status === "pending_review").length;
    const completedCount = data.tasks.filter((t) => t.status === "completed").length;
    const eventCount = data.events.length;
    const topEvents = data.events.slice(0, 3);
    const recentTasks = [...data.tasks]
      .sort((a, b) => new Date(b.updated_at || b.due_at || 0).getTime() - new Date(a.updated_at || a.due_at || 0).getTime())
      .slice(0, 4);
    page.innerHTML = `
      <div class="breadcrumb"><span>Executive President</span> / Command Center</div>
      <div class="stat-row">
        <div class="stat-card"><div class="stat-num">${activeCount}</div><div class="stat-label">Active Tasks</div></div>
        <div class="stat-card"><div class="stat-num amber">${overdueCount}</div><div class="stat-label">Overdue</div></div>
        <div class="stat-card"><div class="stat-num">${pendingCount}</div><div class="stat-label">Pending Review</div></div>
        <div class="stat-card"><div class="stat-num green">${completedCount}</div><div class="stat-label">Completed</div></div>
        <div class="stat-card"><div class="stat-num">${eventCount}</div><div class="stat-label">Events</div></div>
      </div>
      <div class="two-col">
        <div class="card">
          <div class="section-label">Events</div>
          <div class="card-title">Event Control Panels</div>
          <div class="card-sub">Live data from your board workflow</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${
              topEvents.length
                ? topEvents
                    .map(
                      (e) => `
              <div class="event-card" onclick="openPresidentEventDetail(${Number(e.id || 0)})">
                <div style="display:flex;justify-content:flex-end;gap:6px;margin-bottom:6px">
                  <button class="btn btn-outline" style="font-size:9px;padding:4px 10px" onclick="event.stopPropagation();editEventLive(${Number(e.id || 0)}, '${String(e.name || "").replaceAll("'", "\\'")}')">Edit</button>
                  <button class="btn btn-red" style="font-size:9px;padding:4px 10px" onclick="event.stopPropagation();deleteEventLive(${Number(e.id || 0)})">Delete</button>
                </div>
                <div class="event-name">${e.name}</div>
                <div class="event-date">${new Date(e.event_date).toLocaleDateString()} · ${e.venue || e.location || "TBD Location"}</div>
                <div class="progress-bar-wrap">
                  <div class="progress-label"><span>Overall Progress</span><span>${e.progress}%</span></div>
                  <div class="progress-bar"><div class="progress-fill" style="width:${e.progress}%"></div></div>
                </div>
              </div>`
                    )
                    .join("")
                : '<div style="font-size:12px;color:var(--silver);padding:10px 0">No events created yet.</div>'
            }
          </div>
        </div>
        <div class="card">
          <div class="section-label">Tasks</div>
          <div class="card-title">Recent Task Activity</div>
          <div class="card-sub">Latest tasks across departments</div>
          <div class="task-list">
            ${
              recentTasks.length
                ? recentTasks
                    .map(
                      (t) => `
              <div class="task-item">
                <div class="task-stripe ${t.status === "completed" ? "done" : t.status === "overdue" ? "urgent" : t.status === "redo" ? "redo" : t.status === "current" ? "current" : "locked"}"></div>
                <div>
                  <div class="task-title">${t.title}</div>
                  <div class="task-meta"><span>${t.owner_name}</span><span>${t.department}</span><span>Due ${new Date(t.due_at).toLocaleDateString()}</span></div>
                </div>
                <div class="task-actions"><span class="status-badge ${t.status === "completed" ? "sb-done" : t.status === "pending_review" ? "sb-pending" : t.status === "overdue" ? "sb-urgent" : t.status === "redo" ? "sb-redo" : t.status === "current" ? "sb-current" : "sb-locked"}">${typeof statusDisplayLabel === "function" ? statusDisplayLabel(t.status) : t.status.replaceAll("_", " ")}</span></div>
              </div>`
                    )
                    .join("")
                : '<div style="font-size:12px;color:var(--silver);padding:10px 0">No tasks yet.</div>'
            }
          </div>
        </div>
      </div>
    `;
  }

  function asTaskCard(t) {
    const statusClass =
      t.status === "completed"
        ? "sb-done"
        : t.status === "current"
        ? "sb-current"
        : t.status === "pending_review"
        ? "sb-pending"
        : t.status === "overdue"
        ? "sb-urgent"
        : t.status === "redo"
        ? "sb-redo"
        : "sb-locked";
    const stripe =
      t.status === "completed"
        ? "done"
        : t.status === "current"
        ? "current"
        : t.status === "overdue"
        ? "urgent"
        : t.status === "redo"
        ? "redo"
        : "locked";
    return `
      <div class="task-item" onclick="inspectTask(${t.id})">
        <div class="task-stripe ${stripe}"></div>
        <div>
          <div class="task-title">${t.title}</div>
          <div class="task-meta">
            <span>${t.owner_name}</span>
            <span>${t.department}</span>
            <span>Due ${new Date(t.due_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div class="task-actions">
          <span class="status-badge ${statusClass}">${typeof statusDisplayLabel === "function" ? statusDisplayLabel(t.status) : t.status.replaceAll("_", " ")}</span>
          <button class="btn btn-outline" style="font-size:9px;padding:4px 10px" onclick="event.stopPropagation();inspectTask(${t.id})">Click to Review</button>
        </div>
      </div>
    `;
  }

  function clearConfirmHoldState(btn) {
    if (confirmHoldTimer) {
      clearInterval(confirmHoldTimer);
      confirmHoldTimer = null;
    }
    confirmHoldElapsed = 0;
    if (btn) btn.style.setProperty("--hold-pct", "0%");
  }

  window.cancelStyledConfirm = function cancelStyledConfirm() {
    const btn = document.getElementById("confirm-action-btn");
    clearConfirmHoldState(btn);
    pendingConfirmAction = null;
    closeModal("confirmActionModal");
  };

  function openStyledConfirm(message, onConfirm, options) {
    const msgEl = document.getElementById("confirm-action-message");
    const btn = document.getElementById("confirm-action-btn");
    const hintEl = document.getElementById("confirm-hold-hint");
    const holdMs = Number(options && options.holdMs ? options.holdMs : 0);
    if (msgEl) msgEl.textContent = message;
    pendingConfirmAction = onConfirm;
    if (btn) {
      clearConfirmHoldState(btn);
      btn.onmousedown = null;
      btn.onmouseup = null;
      btn.onmouseleave = null;
      btn.ontouchstart = null;
      btn.ontouchend = null;
      btn.onclick = null;
      if (holdMs > 0) {
        if (hintEl) hintEl.textContent = `Press and hold delete for ${Math.round(holdMs / 1000)} seconds to unlock confirm.`;
        const startHold = () => {
          clearConfirmHoldState(btn);
          confirmHoldTimer = setInterval(async () => {
            confirmHoldElapsed += 100;
            const pct = Math.min(100, Math.round((confirmHoldElapsed / holdMs) * 100));
            btn.style.setProperty("--hold-pct", `${pct}%`);
            if (confirmHoldElapsed >= holdMs) {
              clearConfirmHoldState(btn);
              const action = pendingConfirmAction;
              pendingConfirmAction = null;
              closeModal("confirmActionModal");
              if (typeof action === "function") await action();
            }
          }, 100);
        };
        const endHold = () => clearConfirmHoldState(btn);
        btn.onmousedown = startHold;
        btn.onmouseup = endHold;
        btn.onmouseleave = endHold;
        btn.ontouchstart = startHold;
        btn.ontouchend = endHold;
      } else {
        if (hintEl) hintEl.textContent = "Confirm this action.";
        btn.onclick = async () => {
          const action = pendingConfirmAction;
          pendingConfirmAction = null;
          closeModal("confirmActionModal");
          if (typeof action === "function") await action();
        };
      }
    }
    openModal("confirmActionModal");
  }

  function parseListInput(text) {
    const raw = String(text || "").trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
    } catch (_e) {}
    return raw
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function parseKeyValueInput(text) {
    const raw = String(text || "").trim();
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch (_e) {}
    const out = {};
    raw.split("\n").forEach((line) => {
      const parts = line.split(":");
      if (parts.length < 2) return;
      const key = parts.shift().trim();
      const value = parts.join(":").trim();
      if (key) out[key] = value;
    });
    return out;
  }

  const EDIT_EVENT_ROLES = [
    "Director of Operations",
    "Director of Finance & Development - Finance",
    "Director of Finance & Development - Development",
    "Director of Events & Experiences",
    "Executive Producer, Somali Night — Production",
    "Director of Brand & Marketing",
    "Director of Strategic Relations & Advancement",
    "Director of Editorial & Communications",
    "Director of Campus Activation",
    "Executive Producer, Somali Night — Creative",
    "Executive President",
    "Vice President, Chief of Internal Affairs",
    "Vice President, Chief of External Affairs"
  ];

  function syncEditEventDeliverablesFromFields() {
    const root = document.getElementById("edit-event-deliverables-fields");
    const out = {};
    if (root) {
      root.querySelectorAll("[data-edit-role-deliverable]").forEach((el) => {
        const key = el.getAttribute("data-edit-role-deliverable");
        if (!key) return;
        out[key] = String(el.value || "").trim();
      });
    }
    const hidden = document.getElementById("edit-event-deliverables");
    if (hidden) hidden.value = Object.keys(out).map((k) => `${k}: ${out[k]}`).join("\n");
    return out;
  }

  function renderEditEventDeliverables() {
    const roles = parseListInput(document.getElementById("edit-event-roles")?.value || "");
    const existing = parseKeyValueInput(document.getElementById("edit-event-deliverables")?.value || "");
    const root = document.getElementById("edit-event-deliverables-fields");
    if (!root) return;
    if (!roles.length) {
      root.innerHTML = '<div style="font-size:12px;color:var(--silver)">Select roles above to define deliverables.</div>';
      return;
    }
    root.innerHTML = roles
      .map((role) => `<div class="fg"><label>${role.replace(/</g, "&lt;")}</label><textarea class="ce-fi" data-edit-role-deliverable="${role.replace(/"/g, "&quot;")}" style="min-height:56px">${String(existing[role] || "").replace(/</g, "&lt;")}</textarea></div>`)
      .join("");
  }

  function syncEditEventRoleListFromButtons() {
    const selected = [...document.querySelectorAll("#edit-event-role-grid .edit-chip.sel")]
      .map((el) => el.getAttribute("data-value"))
      .filter(Boolean);
    const input = document.getElementById("edit-event-roles");
    if (input) input.value = selected.join("\n");
    renderEditEventDeliverables();
  }

  function syncEditEventDivisionListFromButtons() {
    const selected = [...document.querySelectorAll("#edit-event-division-grid .edit-chip.sel")]
      .map((el) => el.getAttribute("data-value"))
      .filter(Boolean);
    const input = document.getElementById("edit-event-divisions");
    if (input) input.value = selected.join("\n");
  }

  function syncEditEventWorkflowFromButtons() {
    const selected = [...document.querySelectorAll("#edit-event-stage-grid .edit-chip.sel")]
      .map((el) => el.getAttribute("data-value"))
      .filter(Boolean);
    const input = document.getElementById("edit-event-workflow");
    if (input) input.value = selected.join("\n");
  }

  window.setEditEventType = function setEditEventType(btn) {
    const val = btn.getAttribute("data-value") || "";
    document.getElementById("edit-event-type").value = val;
    document.querySelectorAll("#edit-event-type-grid .edit-chip").forEach((el) => el.classList.toggle("sel", el === btn));
  };

  window.setEditEventScope = function setEditEventScope(btn) {
    const val = btn.getAttribute("data-value") || "";
    document.getElementById("edit-event-scope").value = val;
    document.querySelectorAll("#edit-event-scope-grid .edit-chip").forEach((el) => el.classList.toggle("sel", el === btn));
  };

  window.toggleEditEventDivision = function toggleEditEventDivision(btn) {
    btn.classList.toggle("sel");
    syncEditEventDivisionListFromButtons();
  };

  window.toggleEditEventRole = function toggleEditEventRole(btn) {
    btn.classList.toggle("sel");
    syncEditEventRoleListFromButtons();
  };

  window.toggleEditEventStage = function toggleEditEventStage(btn) {
    btn.classList.toggle("sel");
    syncEditEventWorkflowFromButtons();
  };

  window.setDefaultEditWorkflow = function setDefaultEditWorkflow() {
    document.querySelectorAll("#edit-event-stage-grid .edit-chip").forEach((el) => el.classList.add("sel"));
    syncEditEventWorkflowFromButtons();
  };

  window.clearEditWorkflowStages = function clearEditWorkflowStages() {
    document.querySelectorAll("#edit-event-stage-grid .edit-chip").forEach((el) => el.classList.remove("sel"));
    syncEditEventWorkflowFromButtons();
  };

  function primeEditEventRoleButtons(selectedRoles) {
    const root = document.getElementById("edit-event-role-grid");
    if (!root) return;
    const selected = new Set((selectedRoles || []).map((r) => String(r)));
    root.innerHTML = EDIT_EVENT_ROLES
      .map((role) => `<button type="button" class="edit-chip ${selected.has(role) ? "sel" : ""}" data-value="${role.replace(/"/g, "&quot;")}" onclick="toggleEditEventRole(this)">${role}</button>`)
      .join("");
  }

  function buildDivisionSummary(divisionName, leaderRole) {
    const allUsers = dashboardCache?.users || [];
    let members = allUsers.filter((u) => u.department === divisionName);
    const leaderByRole = allUsers.find((u) => u.role_title === leaderRole);
    if (leaderByRole && !members.some((m) => m.email === leaderByRole.email)) {
      members = [leaderByRole, ...members];
    }
    const leader = members.find((u) => u.role_title === leaderRole) || members[0];
    const memberEmails = new Set(members.map((m) => m.email));
    const tasks = (dashboardCache?.tasks || []).filter((t) => memberEmails.has(t.owner_email));
    const completed = tasks.filter((t) => t.status === "completed").length;
    const overdue = tasks.filter((t) => t.status === "overdue").length;
    const blockedIds = new Set(
      (dashboardCache?.dependencies || [])
        .filter((d) => {
          const task = (dashboardCache?.tasks || []).find((t) => t.id === d.task_id);
          return task && memberEmails.has(task.owner_email);
        })
        .map((d) => d.task_id)
    );
    const pct = Math.round((completed / Math.max(1, tasks.length)) * 100);
    return { members, leader, tasks, overdue, blocked: blockedIds.size, pct };
  }

  function renderReportsLive() {
    const root = document.getElementById("reports-list");
    if (!root) return;
    const allReports = dashboardCache?.reports || [];
    const reports = window.__showArchivedReports ? allReports : allReports.filter((r) => String(r.status || "").toLowerCase() !== "archived");
    const esc = (s) => (s == null || s === "") ? "" : String(s).replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    root.innerHTML = reports.length
      ? `<div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn btn-outline" style="font-size:9px;padding:5px 10px" onclick="toggleArchivedReports()">${window.__showArchivedReports ? "Hide Archived" : "View Archived"}</button></div>` + reports
          .map(
            (r) => {
              const status = (r.status || "open").replace(/_/g, " ");
              const statusStyle = r.status === "reviewed" ? "background:var(--green-dim);color:var(--green)" : r.status === "archived" ? "background:rgba(255,255,255,.06);color:var(--silver)" : r.status === "needs_clarification" ? "background:var(--amber-dim);color:var(--amber)" : "background:rgba(184,154,92,.12);color:var(--gold)";
              return `
        <div class="approval-item">
          <div class="approval-header">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span class="approval-task">${esc(r.reason)}</span>
                <span style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:2px 6px;border-radius:4px;${statusStyle}">${esc(status)}</span>
              </div>
              <div class="approval-by">${esc(r.submitted_by_name)} · ${esc(r.submitted_by_role)} · ${esc(r.division)}</div>
              <div style="font-size:11px;color:var(--silver);margin-top:6px;line-height:1.5">${esc(r.notes)}</div>
              ${r.clarification_notes ? `<div style="font-size:11px;color:var(--amber);margin-top:8px;padding:8px 10px;background:var(--amber-dim);border-left:2px solid var(--amber);"><strong>Clarification:</strong> ${esc(r.clarification_notes)}</div>` : ""}
              ${r.recommended_action ? `<div style="font-size:11px;color:var(--gold);margin-top:8px;padding:8px 10px;background:rgba(184,154,92,.06);border-left:2px solid var(--gold);"><strong>Recommended action:</strong> ${esc(r.recommended_action)}</div>` : ""}
              <div style="font-size:10px;color:var(--silver);margin-top:8px">${esc(r.event_name || "No event")}${r.task_title ? " · " + esc(r.task_title) : ""} · ${r.created_at ? new Date(r.created_at).toLocaleString() : ""}</div>
            </div>
            <div class="approval-actions">
              <button class="btn btn-outline" style="font-size:9px;padding:5px 10px" onclick="updateReportStatus(${r.id}, 'reviewed')">Review</button>
              <button class="btn btn-outline" style="font-size:9px;padding:5px 10px" onclick="clarifyReport(${r.id})">Clarify</button>
              <button class="btn btn-red" style="font-size:9px;padding:5px 10px" onclick="updateReportStatus(${r.id}, 'archived')">Archive</button>
            </div>
          </div>
        </div>
      `;
            }
          )
          .join("")
      : `<div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn btn-outline" style="font-size:9px;padding:5px 10px" onclick="toggleArchivedReports()">${window.__showArchivedReports ? "Hide Archived" : "View Archived"}</button></div><div style="font-size:13px;color:var(--silver);padding:12px">No escalation reports yet.</div>`;
  }

  window.renderEventPanel = function renderEventPanelLive(name) {
    const event = (dashboardCache?.events || []).find((e) => e.name === name) || (dashboardCache?.events || [])[0];
    if (!event) return;
    const tasks = (dashboardCache?.tasks || []).filter((t) => t.event_id === event.id);
    const divisions = [...new Set(tasks.map((t) => t.department))];
    const statsRoot = document.getElementById("event-stats");
    if (statsRoot) {
      const done = tasks.filter((t) => t.status === "completed").length;
      const overdue = tasks.filter((t) => t.status === "overdue").length;
      const active = tasks.filter((t) => ["current", "pending_review", "redo"].includes(t.status)).length;
      statsRoot.innerHTML = `
        <div class="stat-card"><div class="stat-num">${tasks.length}</div><div class="stat-label">Total Tasks</div></div>
        <div class="stat-card"><div class="stat-num green">${done}</div><div class="stat-label">Completed</div></div>
        <div class="stat-card"><div class="stat-num amber">${active}</div><div class="stat-label">Active</div></div>
        <div class="stat-card"><div class="stat-num red">${overdue}</div><div class="stat-label">Overdue</div></div>
        <div class="stat-card"><div class="stat-num">${event.progress}%</div><div class="stat-label">Progress</div></div>`;
    }
    const progressRoot = document.getElementById("dept-progress");
    if (progressRoot) {
      progressRoot.innerHTML = divisions.length
        ? divisions
            .map((division) => {
              const divTasks = tasks.filter((t) => t.department === division);
              const done = divTasks.filter((t) => t.status === "completed").length;
              const overdue = divTasks.filter((t) => t.status === "overdue").length;
              const pct = Math.round((done / Math.max(1, divTasks.length)) * 100);
              const memberNames = [...new Set(divTasks.map((t) => t.owner_name))];
              const leader =
                division === "External Division"
                  ? "Vice President, Chief of External Affairs"
                  : division === "Executive Division"
                  ? "Executive President"
                  : "Vice President, Chief of Internal Affairs";
              return `<div style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,.05)">
                <div style="display:flex;justify-content:space-between;gap:12px">
                  <div>
                    <div style="font-size:13px;color:var(--white)">${division}</div>
                    <div style="font-size:10px;color:var(--silver)">Leader: ${leader}</div>
                    <div style="font-size:10px;color:var(--silver);margin-top:4px">Members: ${memberNames.join(", ") || "None"}</div>
                  </div>
                  <div style="text-align:right">
                    <div style="font-size:13px;color:var(--gold)">${pct}%</div>
                    <div style="font-size:10px;color:var(--silver)">${done}/${divTasks.length} complete${overdue ? ` · ${overdue} overdue` : ""}</div>
                  </div>
                </div>
                <div class="progress-bar" style="margin-top:8px"><div class="progress-fill" style="width:${pct}%"></div></div>
              </div>`;
            })
            .join("")
        : '<div style="font-size:12px;color:var(--silver)">No division work tied to this event yet.</div>';
    }
    const taskRoot = document.getElementById("event-tasks-list");
    if (taskRoot) {
      taskRoot.innerHTML = tasks.length
        ? tasks
            .sort((a, b) => new Date(a.unlock_at).getTime() - new Date(b.unlock_at).getTime())
            .map(
              (t) => `
          <div class="task-item" onclick="inspectTask(${t.id})">
            <div class="task-stripe ${t.status === "completed" ? "done" : t.status === "overdue" ? "urgent" : t.status === "current" ? "current" : "locked"}"></div>
            <div>
              <div class="task-title">${t.title}</div>
              <div class="task-meta">
                <span>${t.owner_name}</span>
                <span>${t.owner_role}</span>
                <span>${t.department}</span>
                <span>Stage ${t.phase || "Planning"}</span>
                <span>Due ${new Date(t.due_at).toLocaleDateString()}</span>
              </div>
              ${t.previous_summary ? `<div style="font-size:11px;color:var(--silver);margin-top:6px">${t.previous_summary}</div>` : ""}
            </div>
            <div class="task-actions"><span class="status-badge ${t.status === "completed" ? "sb-done" : t.status === "pending_review" ? "sb-pending" : t.status === "overdue" ? "sb-urgent" : t.status === "current" ? "sb-current" : "sb-locked"}">${typeof statusDisplayLabel === "function" ? statusDisplayLabel(t.status) : t.status.replaceAll("_", " ")}</span></div>
          </div>`
            )
            .join("")
        : '<div style="font-size:12px;color:var(--silver)">No tasks linked to this event yet.</div>';
    }
  };

  window.renderDivisions = function renderDivisionsLive() {
    const seededEmails = new Set((dashboardCache?.users || []).map((u) => u.email));
    const configs = [
      ["Executive Division", "Executive President", "exec-member-cards"],
      ["Internal Division", "Vice President, Chief of Internal Affairs", "internal-member-cards"],
      ["External Division", "Vice President, Chief of External Affairs", "external-member-cards"]
    ];
    configs.forEach(([divisionName, leaderRole, rootId]) => {
      const root = document.getElementById(rootId);
      if (!root) return;
      const summary = buildDivisionSummary(divisionName, leaderRole);
      const leader = summary.members.find((m) => m.role_title === leaderRole);
      const sortedMembers = leader
        ? [leader, ...summary.members.filter((m) => m.email !== leader.email)]
        : summary.members;
      root.innerHTML = `
        <div class="card">
          <div class="section-label">${divisionName}</div>
          <div class="card-title">${summary.leader ? summary.leader.full_name : "Division Overview"}</div>
          <div class="card-sub">${summary.leader ? summary.leader.role_title : "No leader mapped"} · ${summary.pct}% complete · ${summary.overdue} overdue · ${summary.blocked} blockers</div>
          <div class="division-cards-grid">
            ${sortedMembers
              .map((m) => {
                const memberTasks = summary.tasks.filter((t) => t.owner_email === m.email);
                const active = memberTasks.filter((t) => ["current", "pending_review", "redo", "locked"].includes(t.status)).length;
                const overdue = memberTasks.filter((t) => t.status === "overdue").length;
                const isLeader = m.role_title === leaderRole;
                return `<div class="card-sm">
                  <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:6px">${m.department}${isLeader ? " · Leader" : ""}</div>
                  <div style="font-size:15px;font-family:var(--font-display);color:var(--white)">${m.full_name}</div>
                  <div style="font-size:11px;color:var(--silver);margin-bottom:10px">${m.role_title}</div>
                  <div style="font-size:11px;color:var(--off-white)">Active Tasks: ${active}</div>
                  <div style="font-size:11px;color:${overdue ? "var(--red)" : "var(--silver)"}">Overdue / Failed: ${overdue}</div>
                  <div style="font-size:10px;color:var(--silver);margin-top:8px">${memberTasks.slice(0, 3).map((t) => t.title).join(" · ") || "No assigned tasks"}</div>
                </div>`;
              })
              .join("")}
          </div>
        </div>`;
    });
    const renderDivisionBuckets = (root, tasks, emptyLabel) => {
      if (!root) return;
      const complete = tasks.filter((t) => t.status === "completed");
      const redo = tasks.filter((t) => t.status === "redo");
      const current = tasks.filter((t) => ["current", "overdue"].includes(t.status));
      const upcoming = tasks.filter((t) => ["locked", "pending", "pending_review"].includes(t.status));
      const section = (title, list) => `
        <div class="card" style="margin-bottom:10px;background:var(--navy);border:1px solid rgba(255,255,255,.06)">
          <div class="section-label">${title}</div>
          ${list.length ? list.map(asTaskCard).join("") : '<div style="font-size:12px;color:var(--silver);padding:10px 0">No tasks in this section.</div>'}
        </div>
      `;
      if (!tasks.length) {
        root.innerHTML = `<div style="font-size:12px;color:var(--silver)">${emptyLabel}</div>`;
        return;
      }
      root.innerHTML = section("Current", current) + section("Upcoming", upcoming) + section("Redo", redo) + section("Complete", complete);
    };

    const internalRoot = document.getElementById("internal-tasks-list");
    const externalRoot = document.getElementById("external-tasks-list");
    const execRoot = document.getElementById("exec-tasks-list");
    const allTasks = (dashboardCache?.tasks || []).filter((t) => seededEmails.has(t.owner_email));
    renderDivisionBuckets(
      internalRoot,
      allTasks.filter((t) => t.department === "Internal Division"),
      "No internal tasks."
    );
    renderDivisionBuckets(
      externalRoot,
      allTasks.filter((t) => t.department === "External Division"),
      "No external tasks."
    );
    renderDivisionBuckets(
      execRoot,
      allTasks.filter((t) => t.department === "Executive Division"),
      "No executive tasks."
    );
  };

  window.renderTemplates = function renderTemplatesLive() {
    const root = document.getElementById("templates-grid");
    if (!root) return;
    const templates = [
      {
        id: "somali-night",
        name: "Cultural Night / Somali Night",
        text: "Production timeline, venue operations, finance approvals, creative build-out, promotion launch, performer confirmations, rehearsal checkpoints, and final run-of-show sequencing.",
        preset: {
          event_type: "Flagship Production",
          scope: "Large Scale (500+)",
          roles: [
            "Director of Operations",
            "Director of Finance & Development - Finance",
            "Director of Events & Experiences",
            "Director of Brand & Marketing",
            "Executive Producer, Somali Night — Production",
            "Executive Producer, Somali Night — Creative"
          ],
          tasks: [
            { title: "Finalize Event Budget & Secure Initial Funding", department: "Internal Division", role: "Director of Finance & Development - Finance", priority: "high", dependsOnTitles: [] },
            { title: "Confirm Venue Booking & Layout", department: "Internal Division", role: "Director of Operations", priority: "high", dependsOnTitles: ["Finalize Event Budget & Secure Initial Funding"] },
            { title: "Recruit & Confirm Performers/Cultural Groups", department: "Internal Division", role: "Director of Events & Experiences", priority: "high", dependsOnTitles: ["Confirm Venue Booking & Layout"] },
            { title: "Launch Full Marketing Campaign", department: "External Division", role: "Director of Brand & Marketing", priority: "high", dependsOnTitles: ["Recruit & Confirm Performers/Cultural Groups"] },
            { title: "Finalize Production Run-of-Show", department: "Internal Division", role: "Executive Producer, Somali Night — Production", priority: "critical", dependsOnTitles: ["Launch Full Marketing Campaign"] }
          ]
        }
      },
      {
        id: "campus-kickoff",
        name: "Campus Kickoff",
        text: "Space booking, campus activation, outreach assets, volunteer coverage, tabling logistics, sponsorship asks, and follow-up communications.",
        preset: {
          event_type: "Campus Kickoff",
          scope: "Medium (100–500)",
          roles: [
            "Director of Campus Activation",
            "Director of Strategic Relations & Advancement",
            "Director of Brand & Marketing",
            "Director of Operations"
          ],
          tasks: [
            { title: "Book Campus Activation Space", department: "Internal Division", role: "Director of Operations", priority: "high", dependsOnTitles: [] },
            { title: "Build Sponsor Outreach List", department: "External Division", role: "Director of Strategic Relations & Advancement", priority: "standard", dependsOnTitles: [] },
            { title: "Prepare Tabling Assets & Flyers", department: "External Division", role: "Director of Brand & Marketing", priority: "standard", dependsOnTitles: ["Book Campus Activation Space"] },
            { title: "Execute Campus Activation Plan", department: "External Division", role: "Director of Campus Activation", priority: "high", dependsOnTitles: ["Prepare Tabling Assets & Flyers"] }
          ]
        }
      },
      {
        id: "speaker-event",
        name: "Speaker Event",
        text: "Speaker coordination, contract/transport, room logistics, editorial messaging, marketing rollout, check-in flow, and post-event recap tasks.",
        preset: {
          event_type: "Speaker Event",
          scope: "Medium (100–500)",
          roles: [
            "Director of Operations",
            "Director of Editorial & Communications",
            "Director of Brand & Marketing"
          ],
          tasks: [
            { title: "Finalize Speaker Contract & Travel", department: "Internal Division", role: "Director of Operations", priority: "high", dependsOnTitles: [] },
            { title: "Publish Speaker Messaging Brief", department: "External Division", role: "Director of Editorial & Communications", priority: "standard", dependsOnTitles: ["Finalize Speaker Contract & Travel"] },
            { title: "Launch Speaker Event Promotion", department: "External Division", role: "Director of Brand & Marketing", priority: "high", dependsOnTitles: ["Publish Speaker Messaging Brief"] }
          ]
        }
      },
      {
        id: "fundraiser",
        name: "Fundraiser",
        text: "Donor targets, finance tracking, creative collateral, external partnerships, activation plan, collection checkpoints, and wrap-up reporting.",
        preset: {
          event_type: "Campus Event",
          scope: "Small (<100)",
          roles: [
            "Director of Finance & Development - Development",
            "Director of Strategic Relations & Advancement",
            "Director of Brand & Marketing"
          ],
          tasks: [
            { title: "Set Fundraising Target & Budget Framework", department: "Internal Division", role: "Director of Finance & Development - Development", priority: "high", dependsOnTitles: [] },
            { title: "Secure External Partners", department: "External Division", role: "Director of Strategic Relations & Advancement", priority: "standard", dependsOnTitles: ["Set Fundraising Target & Budget Framework"] },
            { title: "Launch Fundraiser Creative Campaign", department: "External Division", role: "Director of Brand & Marketing", priority: "high", dependsOnTitles: ["Secure External Partners"] }
          ]
        }
      }
    ];
    window.__eventTemplates = templates;
    root.innerHTML = templates
      .map(
        (t) => `<div class="card-sm">
          <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:8px">Template</div>
          <div style="font-size:18px;font-family:var(--font-display);color:var(--white);margin-bottom:8px">${t.name}</div>
          <div style="font-size:12px;color:var(--silver);line-height:1.7">${t.text}</div>
          <button class="btn btn-outline" style="margin-top:14px;font-size:10px" onclick="useEventTemplate('${t.id}')">Use Template</button>
        </div>`
      )
      .join("");
  };

  window.useEventTemplate = function useEventTemplate(templateId) {
    const template = (window.__eventTemplates || []).find((t) => t.id === templateId);
    if (!template) return;
    const evTypeVal = template.preset.event_type || "";
    document.getElementById("ev-type").value = evTypeVal;
    document.querySelectorAll("#ev-type-grid .type-card").forEach(c => { c.classList.toggle("on", c.getAttribute("data-value") === evTypeVal); });
    document.getElementById("ev-scope").value = template.preset.scope || "";
    document.querySelectorAll("#dept-checkboxes .cb-item").forEach((chip) => {
      const role = chip.getAttribute("data-role");
      chip.classList.toggle("checked", template.preset.roles.includes(role));
    });
    renderRoleDeliverableInputs();
    genTasks = (template.preset.tasks || []).map((t, idx) => ({
      id: `tpl-${template.id}-${idx + 1}`,
      title: t.title,
      description: t.description || `${t.title} for ${template.name}`,
      department: t.department,
      role: t.role,
      priority: t.priority || "standard",
      dependsOnTitles: t.dependsOnTitles || []
    }));
    openModal("eventCreateModal");
    goToCreateStep(5);
    renderGenTasks();
    showToast(`${template.name} template applied.`);
  };

  async function hydrateDashboard() {
    if (hydrateDashboardBusy) return;
    hydrateDashboardBusy = true;
    try {
    const me = await apiGet("/api/me");
    const data = await apiGet("/api/dashboard");
    dashboardCache = data;
    window.__presidentDashboardCache = data;

    const nameEl = document.querySelector(".sb-user-name");
    const roleEl = document.querySelector(".sb-user-role");
    const deptEl = document.querySelector(".sb-user-dept");
    if (nameEl) nameEl.textContent = `Hey ${me.user.full_name.split(" ")[0]},`;
    if (roleEl) roleEl.textContent = me.user.role_title;
    if (deptEl) deptEl.textContent = `${me.user.department} · Full Access`;

    if (typeof TASKS !== "undefined") {
      TASKS.length = 0;
      data.tasks.forEach((t) =>
        TASKS.push({
          id: t.id,
          title: t.title,
          dept: t.department,
          assigned: t.owner_name,
          status: toLegacyStatus(t.status),
          priority: t.priority,
          event: (data.events.find((e) => e.id === t.event_id) || {}).name || "",
          due: new Date(t.due_at).toLocaleDateString(),
          dep: data.dependencies.filter((d) => d.task_id === t.id).map((d) => d.depends_on_task_id),
          summary: t.previous_summary || "",
          description: t.description || "",
          owner_role: t.owner_role || "",
          owner_email: t.owner_email || "",
          event_id: t.event_id || null,
          phase: t.phase || "Planning",
          unlock_at: t.unlock_at,
          due_at: t.due_at,
          notes: t.notes || "",
          meeting_date: t.meeting_date || "",
          meeting_time: t.meeting_time || "",
          meeting_location: t.meeting_location || "",
          attachments_json: t.attachments_json || "[]",
          redo_rules: t.redo_rules || "",
          escalation_rules: t.escalation_rules || ""
        })
      );
    }
    if (typeof EVENTS_DATA !== "undefined") {
      EVENTS_DATA.length = 0;
      data.events.forEach((e) =>
        EVENTS_DATA.push({
          id: e.id,
          name: e.name,
          event_date: e.event_date,
          date: new Date(e.event_date).toLocaleDateString(),
          venue: e.venue || e.location || e.scope,
          location: e.location || "",
          scope: e.scope || "",
          type: e.event_type,
          progress: e.progress,
          status: e.status || "",
          budget_limit: e.budget_limit,
          planning_notes: e.planning_notes || "",
          timeline_assumptions: e.timeline_assumptions || "",
          roles_json: e.roles_json || [],
          divisions_json: e.divisions_json || [],
          deliverables_json: e.deliverables_json || {},
          constraints_json: e.constraints_json || {},
          tasks: data.tasks.filter((t) => t.event_id === e.id).length,
          done: data.tasks.filter((t) => t.event_id === e.id && t.status === "completed").length,
          overdue: data.tasks.filter((t) => t.event_id === e.id && t.status === "overdue").length,
          isPast:
            Number(e.progress || 0) >= 100 ||
            String(e.status || "").toLowerCase() === "completed" ||
            (Number.isFinite(new Date(e.event_date).getTime()) && new Date(e.event_date).getTime() < Date.now())
        })
      );
    }

    renderOverviewLive(data);
    if (typeof renderAllTasks === "function") renderAllTasks();
    if (typeof renderApprovals === "function") renderApprovals();
    if (typeof renderOverdue === "function") renderOverdue();
    if (typeof renderEvents === "function") renderEvents();
    if (typeof window.PRESIDENT_DASHBOARD !== "undefined") {
      window.PRESIDENT_DASHBOARD = { tasks: data.tasks, dependencies: data.dependencies, events: data.events || [] };
    } else {
      window.PRESIDENT_DASHBOARD = { tasks: data.tasks, dependencies: data.dependencies, events: data.events || [] };
    }
    const events = data.events || [];
    const presDepSelect = document.getElementById("pres-dep-event-select");
    const presDepName = document.getElementById("pres-dep-event-name");
    const presDepDropdown = document.getElementById("pres-dep-event-dropdown");
    if (presDepSelect) presDepSelect.value = "";
    if (presDepName) presDepName.textContent = "All events";
    if (presDepDropdown) {
      presDepDropdown.innerHTML = "<div class=\"dep-event-opt\" data-value=\"\" onclick=\"pickPresDepEvent('')\">All events</div>" +
        events.map((e) => `<div class="dep-event-opt" data-value="${e.id}" onclick="pickPresDepEvent('${e.id}')">${(e.name || '').replace(/"/g, '&quot;')}</div>`).join("");
    }
    if (typeof renderDependencyGraph === "function") {
      const eventId = presDepSelect && presDepSelect.value ? Number(presDepSelect.value) : null;
      const tasks = eventId ? data.tasks.filter((t) => Number(t.event_id) === eventId) : data.tasks;
      const taskIds = new Set(tasks.map((t) => t.id));
      const deps = (data.dependencies || []).filter((d) => taskIds.has(d.task_id) && taskIds.has(d.depends_on_task_id));
      renderDependencyGraph(document.getElementById("dep-graph-content"), tasks, deps);
    }
    if (typeof renderCalendar === "function") {
      renderOperationalCalendar(document.getElementById("cal-content"), data.events, data.tasks);
    }
    if (typeof renderDivisions === "function") renderDivisions();
    if (typeof renderTemplates === "function") renderTemplates();
    if (typeof renderReportsLive === "function") renderReportsLive();
    const isPastEvent = (e) =>
      Number(e.progress || 0) >= 100 ||
      String(e.status || "").toLowerCase() === "completed" ||
      (Number.isFinite(new Date(e.event_date).getTime()) && new Date(e.event_date).getTime() < Date.now());
    const activeEvents = (data.events || []).filter((e) => !isPastEvent(e));
    const assignEvent = document.getElementById("p-assign-event");
    if (assignEvent) {
      assignEvent.innerHTML = `<option value="">Standalone</option>${activeEvents
        .map((e) => `<option value="${e.id}">${e.name}</option>`)
        .join("")}`;
    }
    const assignDeps = document.getElementById("p-assign-dependencies");
    if (assignDeps) {
      const users = data.users || [];
      assignDeps.innerHTML = data.tasks
        .filter((t) => String(t.status || "").toLowerCase() !== "completed")
        .map((t) => {
          const status = ["current", "pending_review", "redo", "overdue"].includes(t.status) ? "Active" : "Queued";
          const psClass = ["current", "pending_review", "redo", "overdue"].includes(t.status) ? "at-ps-active" : "at-ps-locked";
          const dept = (t.owner_role || t.department || "").replace(/</g, "&lt;");
          const owner = users.find((u) => (u.email || "").toLowerCase() === (t.owner_email || "").toLowerCase());
          const assigneeLine = owner ? `${(owner.full_name || "").replace(/</g, "&lt;")} · ${(owner.role_title || "").replace(/</g, "&lt;")}` : (t.owner_name || "").replace(/</g, "&lt;");
          return `<div class="at-prereq-item" data-task-id="${t.id}" onclick="toggleAssignPrereq(this)">
            <input type="checkbox" value="${t.id}" class="p-assign-dep-cb" style="position:absolute;opacity:0;width:0;height:0;margin:0" />
            <div class="at-prereq-cb"><div style="width:6px;height:6px;background:var(--navy);border-radius:1px;display:none" class="at-prereq-cb-inner"></div></div>
            <div><div class="at-prereq-dept">${dept}</div><div class="at-prereq-name">${(t.title || "").replace(/</g, "&lt;")}</div><div class="at-prereq-assignee">${assigneeLine}</div></div>
            <span class="at-prereq-status ${psClass}">${status}</span></div>`;
        })
        .join("");
    }
    const roleChipsRoot = document.getElementById("p-assign-role-chips");
    const roleSelect = document.getElementById("p-assign-role");
    if (roleChipsRoot && roleSelect) {
      const roleSet = new Map();
      (data.users || []).forEach((u) => { if (u.role_title && !roleSet.has(u.role_title)) roleSet.set(u.role_title, u.department); });
      const roles = Array.from(roleSet.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      const opts = roles.map(([r, d]) => `<option value="${r.replace(/"/g, "&quot;")}">${r}</option>`).join("");
      roleSelect.innerHTML = `<option value="">— Select role —</option>${opts}`;
      roleChipsRoot.innerHTML = roles
        .map(([roleTitle, dept]) => {
          const div = dept && dept.indexOf("External") !== -1 ? "External" : dept && dept.indexOf("Internal") !== -1 ? "Internal" : "Executive";
          const dotColor = div === "External" ? "#4caf7d" : div === "Internal" ? "#7ba3d4" : "var(--gold)";
          return `<div class="at-role-chip" data-role="${roleTitle.replace(/"/g, "&quot;")}" onclick="selectAssignRole(this)">
            <div class="at-rc-dot" style="background:${dotColor}"></div>
            <div><div class="at-rc-div">${div}</div><div class="at-rc-name">${roleTitle}</div></div></div>`;
        })
        .join("");
    }

    const pendingRes = await apiGet("/api/submissions/pending").catch(() => ({ pending: [] }));
    const notifications = await apiGet("/api/notifications").catch(() => ({ count: 0, items: [], stats: { pendingReview: 0, overdue: 0 } }));
    const pendingHtml = pendingRes.pending
      .map(
        (s) => `
      <div class="approval-item">
        <div class="approval-header">
          <div>
            <div class="approval-task">${s.title}</div>
            <div class="approval-by">${s.owner_name} · ${s.department}</div>
            <div style="font-size:11px;color:var(--silver);margin-top:6px">${s.summary}</div>
          </div>
          <div class="approval-actions">
            <button class="btn btn-green" style="font-size:9px;padding:5px 12px" onclick="approveTaskById(${s.task_id})">Approve</button>
            <button class="btn btn-red" style="font-size:9px;padding:5px 12px" onclick="openRedoModalWithTask(${s.task_id})">Redo</button>
          </div>
        </div>
      </div>
    `
      )
      .join("");
    const approvalList = document.getElementById("full-approval-list");
    if (approvalList) {
      approvalList.innerHTML =
        pendingHtml || '<div style="color:var(--silver);font-size:13px;padding:16px">No pending submissions.</div>';
    }
    const approvalBadge = document.getElementById("approval-badge");
    if (approvalBadge) approvalBadge.textContent = String(notifications.stats?.pendingReview || 0);
    const overdueBadge = document.getElementById("overdue-badge");
    if (overdueBadge) overdueBadge.textContent = String(notifications.stats?.overdue || 0);
    } finally {
      hydrateDashboardBusy = false;
    }
  }

  window.approveTaskById = async function approveTaskByIdLive(id) {
    await apiPost(`/api/tasks/${id}/approve`, {});
    showToast("Task approved.");
    await hydrateDashboard();
  };

  window.openRedoModalWithTask = function openRedoModalWithTask(taskId) {
    const task = (dashboardCache?.tasks || []).find((t) => t.id === taskId);
    if (task) {
      const val = document.querySelector("#redoModal .redo-val");
      if (val) val.textContent = task.title;
      const hidden = document.getElementById("redoTaskIdHidden");
      if (hidden) hidden.value = String(taskId);
    }
    openModal("redoModal");
  };

  window.submitRedo = async function submitRedoLive() {
    const hidden = document.getElementById("redoTaskIdHidden");
    const taskId = Number(hidden?.value || 0);
    const notes =
      document.querySelector("#redoModal textarea")?.value?.trim() || "Redo required by admin.";
    if (!taskId) {
      closeModal("redoModal");
      return;
    }
    await apiPost(`/api/tasks/${taskId}/redo`, { notes });
    closeModal("redoModal");
    showToast("Redo request sent.");
    await hydrateDashboard();
  };

  if (!document.getElementById("redoTaskIdHidden")) {
    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.id = "redoTaskIdHidden";
    document.body.appendChild(hidden);
  }

  function escAttr(s) { return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function escText(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  const CREATE_PHASES = ["Planning", "Pre-Event", "Execution", "Wrap-Up"];
  function normalizeCreatePhase(phase) {
    const p = String(phase || "").trim().toLowerCase();
    if (p === "planning") return "Planning";
    if (p === "pre-event" || p === "pre event") return "Pre-Event";
    if (p === "execution") return "Execution";
    if (p === "wrap-up" || p === "wrap up" || p === "wrapup") return "Wrap-Up";
    return "Planning";
  }

  window.openGenTaskDetail = function openGenTaskDetail(idx) {
    const t = genTasks[idx];
    if (!t) return;
    const body = document.getElementById("gen-task-detail-body");
    const title = document.getElementById("gen-task-detail-title");
    if (title) title.textContent = t.title || "Generated Task";
    if (!body) return;
    body.innerHTML = `
      <div class="fg"><label class="at-fl">Title</label><input class="at-fi" id="gtd-title" value="${escAttr(t.title || "")}" /></div>
      <div class="form-row">
        <div class="fg"><label class="at-fl">Role</label><input class="at-fi" id="gtd-role" value="${escAttr(t.role || "")}" /></div>
        <div class="fg"><label class="at-fl">Owner Suggestion</label><input class="at-fi" id="gtd-owner" value="${escAttr(t.ownerSuggestion || "")}" /></div>
      </div>
      <div class="form-row">
        <div class="fg"><label class="at-fl">Department</label><input class="at-fi" id="gtd-dept" value="${escAttr(t.department || t.dept || "")}" /></div>
        <div class="fg"><label class="at-fl">Stage</label><select class="at-fi" id="gtd-phase">${CREATE_PHASES.map((p) => `<option value="${p}" ${normalizeCreatePhase(t.phase) === p ? "selected" : ""}>${p}</option>`).join("")}</select></div>
      </div>
      <div class="fg"><label class="at-fl">Description</label><textarea class="at-fi" id="gtd-desc">${escText(t.description || "")}</textarea></div>
      <div class="fg"><label class="at-fl">Goals</label><input class="at-fi" id="gtd-goals" value="${escAttr(t.goals || "")}" /></div>
      <div class="fg"><label class="at-fl">Success Criteria</label><textarea class="at-fi" id="gtd-success">${escText(t.successCriteria || "")}</textarea></div>
      <div class="fg"><label class="at-fl">Avoid</label><textarea class="at-fi" id="gtd-avoid">${escText(t.whatWeDontWant || "")}</textarea></div>
      <div class="fg"><label class="at-fl">Depends On Titles (comma separated)</label><input class="at-fi" id="gtd-deps" value="${escAttr((t.dependsOnTitles || []).join(", "))}" /></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px">
        <button class="btn btn-outline" onclick="closeModal('genTaskDetailModal')">Cancel</button>
        <button class="btn btn-gold" onclick="saveGenTaskDetail(${idx})">Save Task</button>
      </div>
    `;
    openModal("genTaskDetailModal");
  };

  window.saveGenTaskDetail = function saveGenTaskDetail(idx) {
    if (!genTasks[idx]) return;
    genTasks[idx].title = document.getElementById("gtd-title")?.value || "";
    genTasks[idx].role = document.getElementById("gtd-role")?.value || "";
    genTasks[idx].ownerSuggestion = document.getElementById("gtd-owner")?.value || "";
    genTasks[idx].department = document.getElementById("gtd-dept")?.value || "";
    genTasks[idx].dept = genTasks[idx].department;
    genTasks[idx].phase = normalizeCreatePhase(document.getElementById("gtd-phase")?.value || "Planning");
    genTasks[idx].description = document.getElementById("gtd-desc")?.value || "";
    genTasks[idx].goals = document.getElementById("gtd-goals")?.value || "";
    genTasks[idx].successCriteria = document.getElementById("gtd-success")?.value || "";
    genTasks[idx].whatWeDontWant = document.getElementById("gtd-avoid")?.value || "";
    genTasks[idx].dependsOnTitles = String(document.getElementById("gtd-deps")?.value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    closeModal("genTaskDetailModal");
    renderGenTasks();
  };

  window.renderGenTasks = function renderGenTasksEditable() {
    const root = document.getElementById("generated-tasks-list");
    if (!root) return;
    const byPhase = new Map(CREATE_PHASES.map((p) => [p, []]));
    (genTasks || []).forEach((t, i) => {
      const phase = normalizeCreatePhase(t.phase);
      t.phase = phase;
      byPhase.get(phase).push({ task: t, idx: i });
    });
    root.innerHTML = CREATE_PHASES.map((phase) => {
      const items = byPhase.get(phase) || [];
      return `
        <div class="card" style="margin-bottom:10px">
          <div class="section-label">${phase}</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin-top:8px">
            ${items.length ? items.map(({ task: t, idx }) => `
              <div style="background:var(--navy-light);border:1px solid rgba(255,255,255,.08);padding:10px">
                <button type="button" onclick="openGenTaskDetail(${idx})" style="text-align:left;background:transparent;border:0;padding:0;cursor:pointer;width:100%">
                  <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--silver)">${escText(t.role || t.department || "Role TBD")}</div>
                  <div style="font-size:13px;color:var(--white);margin:6px 0 4px">${escText(t.title || "Untitled task")}</div>
                  <div style="font-size:11px;color:var(--silver)">${escText(t.ownerSuggestion || "No owner suggestion")}</div>
                  <div style="font-size:10px;color:var(--silver);margin-top:6px">${(t.dependsOnTitles || []).length} prerequisite(s)</div>
                </button>
                <div style="display:flex;gap:6px;align-items:center;margin-top:8px">
                  <select class="at-fi" data-phase-idx="${idx}" style="min-width:130px">
                    ${CREATE_PHASES.map((p) => `<option value="${p}" ${p === phase ? "selected" : ""}>${p}</option>`).join("")}
                  </select>
                  <button type="button" class="btn-icon red" title="Remove task" onclick="removeGenTask('${String(t.id || "").replace(/'/g, "\\'")}')">✕</button>
                </div>
              </div>
            `).join("") : '<div style="font-size:12px;color:var(--silver)">No tasks in this stage yet.</div>'}
          </div>
        </div>`;
    }).join("");
    root.querySelectorAll("[data-phase-idx]").forEach((el) => {
      el.addEventListener("change", () => {
        const idx = Number(el.getAttribute("data-phase-idx"));
        if (!genTasks[idx]) return;
        genTasks[idx].phase = normalizeCreatePhase(el.value);
        renderGenTasks();
        if (typeof showToast === "function") showToast("Task added to " + el.value);
      });
    });
  };

  window.generateTasks = async function generateTasksLive() {
    if (isGeneratingTasks) return;
    if (!validateBudgetLimit()) { showToast("Fix budget limit (0–150,000)."); return; }
    isGeneratingTasks = true;
    const selectedRoles = [...document.querySelectorAll("#dept-checkboxes .cb-item.checked")]
      .map((el) => ({
        role: el.getAttribute("data-role") || el.textContent.trim(),
        division: el.getAttribute("data-division") || ""
      }))
      .filter((r) => r.role);
    const deliverablesByRole = {};
    document.querySelectorAll("[data-role-deliverable]").forEach((el) => {
      const key = el.getAttribute("data-role-deliverable") || "";
      if (key) deliverablesByRole[key] = String(el.value || "").trim();
    });
    const payload = {
      name: document.getElementById("ev-name")?.value || "",
      eventDate: document.getElementById("ev-date")?.value || "",
      eventType: document.getElementById("ev-type")?.value || "",
      scope: document.getElementById("ev-scope")?.value || "",
      venue: (function(){ var v = document.getElementById("ev-venue")?.value || ""; var r = document.getElementById("ev-venue-room")?.value?.trim() || ""; return r ? v + ", " + r : v; })(),
      selectedRoles,
      deliverablesByRole,
      constraints: {
        budgetLimitUsd: document.getElementById("ev-budget-limit")?.value || "",
        hardDeadline: document.getElementById("ev-hard-deadline")?.value || "",
        requiresVenueContract: document.getElementById("ev-need-contract")?.value || "yes",
        requiresSponsorOutreach: document.getElementById("ev-need-sponsors")?.value || "yes"
      },
      sequencing: document.getElementById("ev-sequence")?.value || "",
      customPrompt: document.getElementById("ev-prompt")?.value || ""
    };

    const status = document.getElementById("gen-status");
    const log = document.getElementById("gen-detail-log");
    const inputPreview = document.getElementById("gen-input-preview");
    const nextBtn = document.getElementById("create-next-btn");
    const backBtn = document.getElementById("create-back-btn");
    const pushLog = (line) => {
      if (!log) return;
      const ts = new Date().toLocaleTimeString();
      log.innerHTML += `<div style="padding:3px 0;border-bottom:1px dashed rgba(255,255,255,.06)">[${ts}] ${line}</div>`;
      log.scrollTop = log.scrollHeight;
    };
    if (log) log.innerHTML = "";
    if (inputPreview) {
      inputPreview.textContent = `Input: ${payload.name || "Untitled Event"} · ${
        payload.eventType || "Custom Type"
      } · Date ${payload.eventDate || "Not set"} · Scope ${payload.scope || "Not set"}`;
    }
    if (status) status.textContent = "Preparing Gemini request...";
    if (nextBtn) {
      nextBtn.disabled = true;
      nextBtn.textContent = "Generating...";
      nextBtn.style.opacity = ".7";
    }
    if (backBtn) backBtn.style.pointerEvents = "none";
    pushLog("Validating event inputs and building generation prompt.");
    pushLog(
      `Using fields: name, date, type, scope, venue, selected roles, per-role deliverables, structured constraints, sequencing, custom prompt.`
    );
    try {
      if (status) status.textContent = "Contacting Gemini 2.5 Flash...";
      pushLog("Sending request to /api/events/generate.");
      const resp = await apiPost("/api/events/generate", payload);
      pushLog(`Received model response${resp.model ? ` from ${resp.model}` : ""}.`);
      genTasks = (resp.generated || []).map((t, idx) => ({
        id: `g-${idx + 1}`,
        title: t.title,
        department: t.department,
        dept: t.department,
        role: t.role || "",
        ownerSuggestion: t.ownerSuggestion || "",
        description: t.description || "",
        priority: t.priority,
        dependsOnTitles: t.dependsOnTitles || [],
        phase: t.phase || "",
        goals: t.goals || "",
        successCriteria: t.successCriteria || "",
        whatWeDontWant: t.whatWeDontWant || ""
      }));
      if (!genTasks.length) throw new Error("Gemini returned no tasks.");
      const depsCount = genTasks.reduce(
        (acc, t) => acc + (Array.isArray(t.dependsOnTitles) ? t.dependsOnTitles.length : 0),
        0
      );
      const roles = [...new Set(genTasks.map((t) => t.department || t.dept).filter(Boolean))];
      pushLog(`Generated ${genTasks.length} tasks.`);
      pushLog(`Detected ${depsCount} dependency links across tasks.`);
      pushLog(`Roles/departments in plan: ${roles.length ? roles.join(", ") : "None detected"}.`);
      if (status) status.textContent = `Generated ${genTasks.length} tasks. Opening review...`;
      renderGenTasks();
      goToCreateStep(5);
    } catch (error) {
      if (status) status.textContent = "Generation failed.";
      pushLog(`Generation failed: ${String(error?.message || error)}`);
      pushLog("Tip: verify GEMINI_API_KEY and retry with a shorter custom prompt.");
      showToast(String(error?.message || error));
    } finally {
      isGeneratingTasks = false;
      if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.style.opacity = "";
        nextBtn.textContent = currentStep === totalSteps ? "Publish Event" : currentStep === 4 ? "Generate" : "Continue →";
      }
      if (backBtn) backBtn.style.pointerEvents = "";
    }
  };

  window.publishEvent = async function publishEventLive() {
    if (!validateBudgetLimit()) { showToast("Fix budget limit (0–150,000)."); return; }
    const roles = [...document.querySelectorAll("#dept-checkboxes .cb-item.checked")].map((el) => el.getAttribute("data-role")).filter(Boolean);
    const divisions = [...new Set([...document.querySelectorAll("#dept-checkboxes .cb-item.checked")].map((el) => { const d = el.getAttribute("data-division"); return d === "external" ? "External Division" : d === "executive" ? "Executive Division" : "Internal Division"; }))];
    const deliverables_by_role = {};
    document.querySelectorAll("[data-role-deliverable]").forEach((el) => {
      const key = el.getAttribute("data-role-deliverable");
      if (key) deliverables_by_role[key] = el.value || "";
    });
    const event = {
      name: document.getElementById("ev-name")?.value || "Untitled Event",
      event_date: new Date(document.getElementById("ev-date")?.value || Date.now()).toISOString(),
      event_type: document.getElementById("ev-type")?.value || "Custom Event",
      scope: document.getElementById("ev-scope")?.value || "Custom",
      budget_limit: document.getElementById("ev-budget-limit")?.value || "",
      venue: (function(){ var v = document.getElementById("ev-venue")?.value || ""; var r = document.getElementById("ev-venue-room")?.value?.trim() || ""; return r ? v + ", " + r : v; })(),
      location: (function(){ var v = document.getElementById("ev-venue")?.value || ""; var r = document.getElementById("ev-venue-room")?.value?.trim() || ""; return r ? v + ", " + r : v; })(),
      planning_notes: document.getElementById("ev-prompt")?.value || "",
      timeline_assumptions: document.getElementById("ev-sequence")?.value || "",
      hard_deadline: document.getElementById("ev-hard-deadline")?.value || "",
      roles,
      divisions,
      deliverables_by_role,
      constraints: {
        hard_deadline: document.getElementById("ev-hard-deadline")?.value || "",
        requiresVenueContract: document.getElementById("ev-need-contract")?.value || "",
        requiresSponsorOutreach: document.getElementById("ev-need-sponsors")?.value || ""
      }
    };
    const tasks = (genTasks || []).map((t) => {
      const descParts = [t.description || "Generated task"];
      if (t.goals) descParts.push("Goals: " + t.goals);
      if (t.successCriteria) descParts.push("Success looks like: " + t.successCriteria);
      if (t.whatWeDontWant) descParts.push("What we don't want: " + t.whatWeDontWant);
      return {
        title: t.title,
        description: descParts.join("\n\n"),
        department: t.department || t.dept || "Board Operations",
        role: t.role || "",
        ownerSuggestion: t.ownerSuggestion || "",
        phase: t.phase || "",
        division: t.division || "",
        priority: t.priority || "medium",
        dependsOnTitles: t.dependsOnTitles || [],
        due_at: t.due_at || null
      };
    });
    const now = Date.now();
    const eventDate = new Date(event.event_date);
    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      const dueMs = t.due_at ? new Date(t.due_at).getTime() : (function() {
        const d = new Date(eventDate);
        d.setDate(d.getDate() - (t.dueOffsetDaysBeforeEvent ?? 7));
        return d.getTime();
      })();
      if (dueMs < now) { showToast("One or more tasks have a due date in the past. Fix dates before publishing."); return; }
    }
    try {
      await apiPost("/api/events/publish", { event, tasks });
      closeModal("eventCreateModal");
      showToast("Event workflow published.");
      await hydrateDashboard();
    } catch (e) {
      let msg = "Unable to publish event.";
      if (e && e.message) {
        try {
          const data = JSON.parse(e.message);
          if (data && data.error) msg = data.error;
        } catch (_) { msg = e.message; }
      }
      showToast(msg);
    }
  };

  window.loadPresidentSuggestions = async function loadPresidentSuggestions() {
    selectedPresidentAssignee = "";
    const role = document.getElementById("p-assign-role")?.value || "";
    const root = document.getElementById("p-assign-suggestions");
    if (!root) return;
    if (!role) {
      root.innerHTML = '<div style="font-size:12px;color:var(--silver);padding:8px 0">Select a role to load suggestions.</div>';
      updateAssignFooterHint();
      return;
    }
    root.innerHTML = '<div style="font-size:12px;color:var(--silver);padding:8px 0">Loading suggestions...</div>';
    try {
      const resp = await apiGet(`/api/assign/suggestions?role=${encodeURIComponent(role)}`);
      const list = resp.suggestions || [];
      root.innerHTML = list.length
        ? list
            .map((m, i) => {
              const pct = Math.min(100, (m.activeCount || 0) * 25);
              const wlClass = pct >= 80 ? "at-wl-over" : pct >= 60 ? "at-wl-warn" : "at-wl-ok";
              return `<div class="at-suggest-item" data-email="${(m.email || "").replace(/"/g, "&quot;")}" data-name="${(m.full_name || "").replace(/"/g, "&quot;")}" data-role="${(m.role_title || "").replace(/"/g, "&quot;")}" onclick="selectPresidentAssignee('${(m.email || "").replace(/'/g, "\\'")}'); selectAssignSuggestionItem(this); updateAssignFooterHint();">
                <div class="at-si-rank">${i + 1}</div>
                <div class="at-si-info"><div class="at-si-name">${m.full_name}</div><div class="at-si-role">${m.role_title} · ${m.department || ""}</div></div>
                <div class="at-si-load"><span class="at-si-role">${m.activeCount || 0} tasks</span><div class="at-wl-bar"><div class="at-wl-fill ${wlClass}" style="width:${pct}%"></div></div></div>
              </div>`;
            })
            .join("")
        : '<div style="font-size:12px;color:var(--silver);padding:8px 0">No users found for this role.</div>';
      updateAssignFooterHint();
    } catch (e) {
      root.innerHTML = `<div style="font-size:12px;color:var(--red);padding:8px 0">Unable to load suggestions: ${String(e.message || e)}</div>`;
      updateAssignFooterHint();
    }
  };

  window.selectAssignRole = function selectAssignRole(el) {
    const role = el.getAttribute("data-role") || "";
    document.querySelectorAll("#p-assign-role-chips .at-role-chip").forEach((c) => c.classList.remove("selected"));
    el.classList.add("selected");
    const roleSelect = document.getElementById("p-assign-role");
    if (roleSelect) roleSelect.value = role;
    loadPresidentSuggestions();
  };

  window.toggleAssignPrereq = function toggleAssignPrereq(el) {
    const cb = el.querySelector(".p-assign-dep-cb");
    if (cb) {
      cb.checked = !cb.checked;
      el.classList.toggle("checked", cb.checked);
      const inner = el.querySelector(".at-prereq-cb-inner");
      if (inner) inner.style.display = cb.checked ? "block" : "none";
    }
  };

  window.selectAssignSuggestionItem = function selectAssignSuggestionItem(el) {
    document.querySelectorAll("#p-assign-suggestions .at-suggest-item").forEach((s) => s.classList.remove("selected"));
    el.classList.add("selected");
  };

  window.updateAssignFooterHint = function updateAssignFooterHint() {
    const hint = document.getElementById("p-assign-footer-hint");
    if (!hint) return;
    const sel = document.querySelector("#p-assign-suggestions .at-suggest-item.selected");
    if (sel) {
      const name = sel.getAttribute("data-name") || sel.querySelector(".at-si-name")?.textContent || "Assignee";
      const role = sel.getAttribute("data-role") || sel.querySelector(".at-si-role")?.textContent?.split("·")[0]?.trim() || "";
      hint.innerHTML = `Assigning to <strong style="color:var(--gold-light)">${name}</strong>${role ? ` · ${role}` : ""}`;
    } else {
      hint.textContent = "Select a role and assignee above.";
    }
  };

  window.updateAssignProgress = function updateAssignProgress() {
    const prog = document.getElementById("p-assign-progress");
    if (!prog) return;
    let n = 0;
    if (document.getElementById("p-assign-title")?.value?.trim()) n += 25;
    if (document.getElementById("p-assign-due")?.value) n += 15;
    if (document.getElementById("p-assign-description")?.value?.trim()) n += 20;
    if (document.getElementById("p-assign-role")?.value) n += 20;
    if (selectedPresidentAssignee) n += 20;
    prog.style.width = Math.min(100, n) + "%";
  };

  window.updateAssignDescHint = function updateAssignDescHint() {
    const hint = document.getElementById("p-assign-desc-hint");
    const text = document.getElementById("p-assign-description")?.value || "";
    if (!hint) return;
    hint.textContent = `Recommended ${text.length}/100 characters (minimum 40).`;
    hint.style.color = "var(--gold)";
  };

  window.setAssignPrio = function setAssignPrio(el) {
    document.querySelectorAll(".at-prio-btn").forEach((b) => b.classList.remove("active-urgent", "active-high", "active-standard", "active-low"));
    el.classList.add("active-" + (el.getAttribute("data-prio") || "standard"));
    const hid = document.getElementById("p-assign-priority");
    if (hid) hid.value = el.getAttribute("data-prio") || "standard";
  };

  window.openAssignTaskCalendar = function openAssignTaskCalendar() {
    const title = document.getElementById("p-assign-title")?.value?.trim() || "New Task";
    const due = document.getElementById("p-assign-due")?.value;
    const desc = document.getElementById("p-assign-description")?.value?.trim() || "";
    const meeting = document.getElementById("p-assign-meeting-link")?.value?.trim() || "";
    const details = [desc, meeting ? `Meeting: ${meeting}` : ""].filter(Boolean).join("\n");
    const start = due ? new Date(due + "T09:00:00") : new Date();
    const end = due ? new Date(due + "T10:00:00") : new Date(Date.now() + 3600000);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent(details)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    return false;
  };
  window.openEditTaskCalendar = function openEditTaskCalendar(ev) {
    const title = document.getElementById("edit-task-title")?.value?.trim() || "Task";
    const due = document.getElementById("edit-task-due")?.value;
    const desc = document.getElementById("edit-task-description")?.value?.trim() || "";
    const meetingLink = document.getElementById("edit-task-meeting-link")?.value?.trim() || "";
    const fmt = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    let start, end;
    if (due) {
      start = new Date(due);
      end = new Date(start.getTime() + 60 * 60 * 1000);
    } else {
      start = new Date();
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }
    const details = [desc, meetingLink ? `Meeting: ${meetingLink}` : ""].filter(Boolean).join("\n");
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent(details)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    if (ev) ev.preventDefault();
    return false;
  };

  window.selectPresidentAssignee = function selectPresidentAssignee(email) {
    selectedPresidentAssignee = String(email || "").trim().toLowerCase();
  };

  window.assignTaskFromPresident = async function assignTaskFromPresident() {
    const title = document.getElementById("p-assign-title")?.value?.trim() || "";
    const role = document.getElementById("p-assign-role")?.value?.trim() || "";
    const dueDate = document.getElementById("p-assign-due")?.value || "";
    const priority = document.getElementById("p-assign-priority")?.value || "standard";
    const eventId = document.getElementById("p-assign-event")?.value || "";
    const description =
      document.getElementById("p-assign-description")?.value?.trim() || "Assigned by executive president.";
    const dependency_task_ids = [...document.querySelectorAll("#p-assign-dependencies .p-assign-dep-cb:checked")].map((el) => Number(el.value));
    const meetingInput = document.getElementById("p-assign-meeting-link");
    if (meetingInput && meetingInput.value && !validateMeetingLink(meetingInput)) {
      showToast("Please enter a valid meeting link (Zoom, Google Meet, Teams, or Webex).");
      return;
    }
    if (!title || !role) {
      showToast("Fill task title and role.");
      return;
    }
    if (description.length < 40) {
      showToast("Description must be at least 40 characters.");
      return;
    }
    const finalDueDate =
      dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const dueAt = new Date(`${finalDueDate}T23:59:00`);
    try {
      const meetingLink = document.getElementById("p-assign-meeting-link")?.value?.trim() || "";
    await apiPost("/api/tasks/assign", {
        title,
        role,
        due_at: dueAt.toISOString(),
        priority,
        description,
        assignee_email: selectedPresidentAssignee || undefined,
        event_id: eventId || undefined,
        unlock_at: new Date(0).toISOString(),
        meeting_link: meetingLink || undefined,
        dependency_task_ids
      });
      showToast("Task assigned.");
      closeModal("assignTaskModal");
      document.getElementById("p-assign-title").value = "";
      document.getElementById("p-assign-description").value = "";
      document.getElementById("p-assign-due").value = "";
      if (document.getElementById("p-assign-event")) document.getElementById("p-assign-event").value = "";
      document.querySelectorAll("#p-assign-dependencies .p-assign-dep-cb").forEach((el) => { el.checked = false; });
      document.querySelectorAll("#p-assign-dependencies .at-prereq-item").forEach((el) => { el.classList.remove("checked"); el.querySelector(".at-prereq-cb-inner") && (el.querySelector(".at-prereq-cb-inner").style.display = "none"); });
      document.querySelectorAll("#p-assign-role-chips .at-role-chip").forEach((c) => c.classList.remove("selected"));
      if (document.getElementById("p-assign-progress")) document.getElementById("p-assign-progress").style.width = "20%";
      updateAssignDescHint();
      selectedPresidentAssignee = "";
      await hydrateDashboard();
    } catch (e) {
      showToast(String(e.message || e));
    }
  };

  window.setEditStatus = function setEditStatus(el) {
    const s = el && el.getAttribute("data-s");
    if (!s) return;
    document.getElementById("edit-task-status").value = s;
    document.querySelectorAll("#edit-task-status-grid .st-btn").forEach((b) => b.classList.remove("active"));
    if (el) el.classList.add("active");
  };
  window.setEditPrio = function setEditPrio(el) {
    const p = el && el.getAttribute("data-p");
    if (!p) return;
    document.getElementById("edit-task-priority").value = p;
    document.querySelectorAll("#edit-task-prio-row .at-prio-btn").forEach((b) => b.classList.remove("active-urgent", "active-high", "active-standard", "active-low"));
    if (el) el.classList.add("active-" + (p === "urgent" ? "urgent" : p === "high" ? "high" : p === "low" ? "low" : "standard"));
  };
  window.toggleEditDep = function toggleEditDep(el) {
    const cb = el && el.querySelector('input[type="checkbox"]');
    if (cb) { cb.checked = !cb.checked; el.classList.toggle("chk", cb.checked); }
  };
  function editAttFileType(path) {
    const ext = (path.split(".").pop() || "").split("?")[0].toLowerCase();
    if (ext === "pdf") return { label: "PDF", class: "att-pdf" };
    if (["png","jpg","jpeg","gif","webp"].includes(ext)) return { label: "IMG", class: "att-img" };
    if (["doc","docx"].includes(ext)) return { label: "DOC", class: "att-doc" };
    if (["ppt","pptx"].includes(ext)) return { label: "SLIDE", class: "att-slide" };
    return { label: "FILE", class: "att-doc" };
  }
  function editAttFileName(path) { return path.replace(/^.*\//, "").split("?")[0] || "file"; }
  window.renderEditAttachments = function renderEditAttachments() {
    const raw = document.getElementById("edit-task-attachments").value || "[]";
    let arr = [];
    try { arr = JSON.parse(raw); } catch (_) {}
    const list = document.getElementById("edit-task-att-list");
    if (!list) return;
    list.innerHTML = arr.map((path, i) => {
      const type = editAttFileType(path);
      const name = editAttFileName(path);
      return `<div class="att-file" data-path="${(path || "").replace(/"/g, "&quot;")}">
        <div class="att-file-icon ${type.class}">${type.label}</div>
        <div class="att-file-info">
          <div class="att-file-name">${(name || "file").replace(/</g, "&lt;")}</div>
          <div class="att-file-meta">Uploaded</div>
        </div>
        <span class="att-file-status att-done">✓ Done</span>
        <button type="button" class="att-file-del" onclick="removeEditAtt(this)" aria-label="Remove">✕</button>
      </div>`;
    }).join("");
  };
  window.removeEditAtt = function removeEditAtt(btn) {
    const row = btn && btn.closest(".att-file");
    if (!row) return;
    const path = row.getAttribute("data-path");
    const raw = document.getElementById("edit-task-attachments").value || "[]";
    let arr = [];
    try { arr = JSON.parse(raw); } catch (_) {}
    arr = arr.filter((p) => p !== path);
    document.getElementById("edit-task-attachments").value = JSON.stringify(arr);
    renderEditAttachments();
  };
  window.editAttZoneDrag = function editAttZoneDrag(el, on) { if (el) el.classList.toggle("drag", !!on); };
  window.editAttZoneDrop = function editAttZoneDrop(ev) {
    editAttZoneDrag(document.getElementById("edit-task-att-zone"), false);
    const files = ev.dataTransfer && ev.dataTransfer.files;
    if (files && files.length) editAttUploadFiles(Array.from(files));
  };
  window.editAttFilesPicked = function editAttFilesPicked(input) {
    const files = input && input.files;
    if (files && files.length) editAttUploadFiles(Array.from(files));
    if (input) input.value = "";
  };
  async function editAttUploadFiles(files) {
    const taskId = Number(document.getElementById("edit-task-id").value || 0);
    const token = getSessionToken();
    const hidden = document.getElementById("edit-task-attachments");
    let current = [];
    try { current = JSON.parse(hidden.value || "[]"); } catch (_) {}
    const list = document.getElementById("edit-task-att-list");
    for (const file of files) {
      const path = "/uploads/" + (file.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
      const id = "att-" + Math.random().toString(36).slice(2, 9);
      const type = editAttFileType(file.name || "");
      const row = document.createElement("div");
      row.className = "att-file";
      row.id = id;
      row.innerHTML = `<div class="att-file-icon ${type.class}">${type.label}</div>
        <div class="att-file-info">
          <div class="att-file-name">${(file.name || "file").replace(/</g, "&lt;")}</div>
          <div class="att-file-meta">Uploading…</div>
          <div class="att-prog-wrap"><div class="att-prog-bar"><div class="att-prog-fill" style="width:0%"></div></div></div>
        </div>
        <span class="att-file-status att-up">0%</span>
        <button type="button" class="att-file-del" onclick="this.closest('.att-file').remove()">✕</button>`;
      list.appendChild(row);
      try {
        const fd = new FormData();
        fd.append("files", file);
        const xhr = new XMLHttpRequest();
        const fill = row.querySelector(".att-prog-fill");
        const pct = row.querySelector(".att-file-status");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const v = Math.round((e.loaded / e.total) * 100);
            if (fill) fill.style.width = v + "%";
            if (pct) pct.textContent = v + "%";
          }
        };
        const done = await new Promise((resolve, reject) => {
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.responseText) : reject(new Error(xhr.statusText)));
          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.open("POST", "/api/upload");
          xhr.setRequestHeader("x-session-token", token);
          xhr.send(fd);
        });
        const data = JSON.parse(done);
        const uploaded = (data && data.paths && data.paths[0]) || path;
        current.push(uploaded);
        if (fill) fill.style.width = "100%";
        if (pct) { pct.textContent = "✓ Done"; pct.className = "att-file-status att-done"; }
        row.querySelector(".att-file-meta").textContent = "Uploaded";
        row.removeAttribute("id");
        row.setAttribute("data-path", uploaded);
        row.querySelector(".att-prog-wrap").outerHTML = "";
        row.querySelector(".att-file-del").onclick = function() { removeEditAtt(this); };
      } catch (_) {
        row.querySelector(".att-file-meta").textContent = "Upload failed";
        const pct = row.querySelector(".att-file-status");
        if (pct) { pct.textContent = "✕ Failed"; pct.className = "att-file-status att-err"; }
        row.querySelector(".att-prog-wrap").outerHTML = "";
      }
    }
    hidden.value = JSON.stringify(current);
  }
  window.validateMeetingLink = function validateMeetingLink(inputEl) {
    if (!inputEl) return true;
    const val = (inputEl.value || "").trim();
    const errId = inputEl.id + "-err";
    const errEl = document.getElementById(errId);
    if (!val) {
      if (errEl) { errEl.style.display = "none"; errEl.textContent = ""; }
      return true;
    }
    const lower = val.toLowerCase();
    const valid = lower.startsWith("https://") || lower.startsWith("http://")
      ? (lower.includes("zoom.us") || lower.includes("meet.google.com") || lower.includes("teams.microsoft.com") || lower.includes("webex.com") || /^https?:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(val))
      : false;
    if (errEl) {
      errEl.style.display = valid ? "none" : "block";
      errEl.textContent = valid ? "" : "Enter a valid meeting link (e.g. Zoom, Google Meet, Teams, or Webex).";
    }
    return valid;
  };
  window.toggleRuleBtn = function toggleRuleBtn(el, kind) {
    if (!el) return;
    const wrap = kind === "redo" ? document.getElementById("edit-task-redo-rules-wrap") : document.getElementById("edit-task-escalation-rules-wrap");
    const input = kind === "redo" ? document.getElementById("edit-task-redo-rules") : document.getElementById("edit-task-escalation-rules");
    if (!wrap || !input) return;
    const rule = el.getAttribute("data-rule");
    if (rule === "none" || rule === "no_auto_redo") {
      wrap.querySelectorAll(".rule-btn").forEach((b) => b.classList.remove("sel"));
      el.classList.add("sel");
      input.value = rule;
      return;
    }
    el.classList.toggle("sel");
    if (el.classList.contains("sel")) {
      wrap.querySelectorAll(".rule-btn[data-rule='none'], .rule-btn[data-rule='no_auto_redo']").forEach((b) => b.classList.remove("sel"));
    }
    const selected = [...wrap.querySelectorAll(".rule-btn.sel")].map((b) => b.getAttribute("data-rule")).filter(Boolean);
    input.value = selected.join(", ");
  };
  window.deleteTaskFromEditModal = async function deleteTaskFromEditModal() {
    const taskId = Number(document.getElementById("edit-task-id").value || 0);
    if (!taskId) return;
    openStyledConfirm("Delete this task permanently from workflow?", async () => {
      const token = getSessionToken();
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE", headers: { "x-session-token": token } });
      if (!res.ok) { showToast("Unable to delete task."); return; }
      showToast("Task deleted.");
      closeModal("taskEditModal");
      await hydrateDashboard();
    }, { holdMs: 5000 });
  };

  window.editTaskAdmin = async function editTaskAdmin() {
    const taskId = Number(window.__presidentInspectTaskId || 0);
    if (!taskId) return;
    const task = (dashboardCache?.tasks || []).find((t) => t.id === taskId);
    if (!task) return;
    document.getElementById("edit-task-id").value = String(task.id);
    document.getElementById("edit-task-id-badge").textContent = "TASK-" + String(task.id).padStart(3, "0");
    const eventName = (dashboardCache?.events || []).find((e) => e.id === task.event_id);
    document.getElementById("edit-task-header-sub").textContent = (eventName ? eventName.name + " · " : "") + "SSA Board Platform";
    document.getElementById("edit-task-title").value = task.title || "";
    document.getElementById("edit-task-role").value = task.owner_role || "";
    document.getElementById("edit-task-division").value = task.department || "";
    document.getElementById("edit-task-description").value = task.description || "";
    const prio = task.priority || "standard";
    document.getElementById("edit-task-priority").value = (prio === "critical" ? "urgent" : prio);
    const status = task.status || "current";
    document.getElementById("edit-task-status").value = status;
    document.getElementById("edit-task-unlock").value = task.unlock_at ? new Date(task.unlock_at).toISOString().slice(0,16) : "";
    document.getElementById("edit-task-due").value = task.due_at ? new Date(task.due_at).toISOString().slice(0,16) : "";
    document.getElementById("edit-task-meeting-link").value = task.meeting_link || "";
    const attJson = task.attachments_json || "[]";
    document.getElementById("edit-task-attachments").value = attJson;
    if (window.renderEditAttachments) renderEditAttachments();
    const escRules = String(task.escalation_rules || "").trim();
    document.getElementById("edit-task-escalation-rules").value = escRules;
    document.querySelectorAll("#edit-task-escalation-rules-wrap .rule-btn").forEach((b) => b.classList.toggle("sel", escRules.split(/[,\n]/).map((s) => s.trim().toLowerCase()).includes((b.getAttribute("data-rule") || "").toLowerCase())));

    document.querySelectorAll("#edit-task-status-grid .st-btn").forEach((b) => b.classList.remove("active"));
    const statusBtn = document.querySelector("#edit-task-status-grid .st-btn[data-s=\"" + status + "\"]");
    if (statusBtn) statusBtn.classList.add("active");
    document.querySelectorAll("#edit-task-prio-row .at-prio-btn").forEach((b) => b.classList.remove("active-urgent", "active-high", "active-standard", "active-low"));
    const prioKey = prio === "critical" ? "urgent" : prio;
    const prioBtn = document.querySelector("#edit-task-prio-row .at-prio-btn[data-p=\"" + prioKey + "\"]");
    if (prioBtn) prioBtn.classList.add("active-" + (prioKey === "urgent" ? "urgent" : prioKey === "high" ? "high" : prioKey === "low" ? "low" : "standard"));

    const eventSelect = document.getElementById("edit-task-event");
    eventSelect.innerHTML = `<option value="">Standalone</option>${(dashboardCache?.events || [])
      .map((e) => `<option value="${e.id}">${e.name}</option>`)
      .join("")}`;
    eventSelect.value = task.event_id ? String(task.event_id) : "";

    const assigneeSelect = document.getElementById("edit-task-assignee");
    assigneeSelect.innerHTML = (dashboardCache?.users || [])
      .map((u) => `<option value="${(u.email || "").replace(/"/g, "&quot;")}" data-role="${(u.role_title || "").replace(/"/g, "&quot;")}" data-department="${(u.department || "").replace(/"/g, "&quot;")}">${(u.full_name || "").replace(/</g, "&lt;")} · ${(u.role_title || "").replace(/</g, "&lt;")}</option>`)
      .join("");
    assigneeSelect.value = task.owner_email || "";
    assigneeSelect.onchange = function editTaskAssigneeChange() {
      const opt = this.selectedOptions && this.selectedOptions[0];
      if (opt) {
        document.getElementById("edit-task-role").value = opt.getAttribute("data-role") || "";
        document.getElementById("edit-task-division").value = opt.getAttribute("data-department") || "";
      }
    };
    const assigneeName = (dashboardCache?.users || []).find((u) => (u.email || "").toLowerCase() === (task.owner_email || "").toLowerCase());
    const statusLabel = (status === "pending_review" ? "Pending Review" : status === "current" ? "Current" : status === "locked" ? "Locked" : status === "redo" ? "Redo" : status === "completed" ? "Completed" : "Overdue");
    document.getElementById("edit-task-footer-hint").innerHTML = "Assigned to <strong style=\"color:var(--gold)\">" + (assigneeName ? assigneeName.full_name : task.owner_email || "—") + "</strong> · " + statusLabel;

    const depIds = new Set((dashboardCache?.dependencies || []).filter((d) => d.task_id === task.id).map((d) => d.depends_on_task_id));
    function prereqStatus(t) {
      const s = (t.status || "current").toLowerCase();
      if (s === "completed") return { class: "ps-done", label: "Done" };
      if (s === "current" || s === "pending_review" || s === "redo") return { class: "ps-act", label: "In Progress" };
      return { class: "ps-lock", label: "Locked" };
    }
    const editUsers = dashboardCache?.users || [];
    document.getElementById("edit-task-dependencies").innerHTML = (dashboardCache?.tasks || [])
      .filter((t) => t.id !== task.id)
      .map((t) => {
        const ps = prereqStatus(t);
        const chk = depIds.has(t.id) ? " chk" : "";
        const owner = editUsers.find((u) => (u.email || "").toLowerCase() === (t.owner_email || "").toLowerCase());
        const assigneeLine = owner ? `${(owner.full_name || "").replace(/</g, "&lt;")} · ${(owner.role_title || "").replace(/</g, "&lt;")}` : (t.owner_name || "").replace(/</g, "&lt;");
        return `<div class="pre-item${chk}" onclick="toggleEditDep(this)"><div class="pre-cb"><div class="pre-cb-dot"></div></div><div><div class="pre-dept">${(t.department || "—").replace(/</g, "&lt;")}</div><div class="pre-name">${(t.title || "").replace(/</g, "&lt;")}</div><div class="pre-assignee">${assigneeLine}</div></div><span class="ps ${ps.class}">${ps.label}</span><input type="checkbox" value="${t.id}" ${depIds.has(t.id) ? "checked" : ""} style="position:absolute;opacity:0;width:0;height:0;pointer-events:none" /></div>`;
      })
      .join("");
    closeModal("taskInspectModal");
    openModal("taskEditModal");
  };

  window.deleteTaskAdmin = async function deleteTaskAdmin() {
    const taskId = Number(window.__presidentInspectTaskId || 0);
    if (!taskId) return;
    openStyledConfirm("Delete this task permanently from workflow?", async () => {
      const token = getSessionToken();
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
        headers: { "x-session-token": token }
      });
      if (!res.ok) {
        showToast("Unable to delete task.");
        return;
      }
      showToast("Task deleted.");
      closeModal("taskInspectModal");
      await hydrateDashboard();
    }, { holdMs: 5000 });
  };

  window.deleteEventLive = async function deleteEventLive(eventId) {
    openStyledConfirm("Delete this event and all related tasks?", async () => {
      const token = getSessionToken();
      const res = await fetch(`/api/events/${eventId}`, {
        method: "DELETE",
        headers: { "x-session-token": token }
      });
      if (!res.ok) {
        showToast("Unable to delete event.");
        return;
      }
      showToast("Event deleted.");
      await hydrateDashboard();
    }, { holdMs: 5000 });
  };

  window.editEventLive = async function editEventLive(eventId, currentName) {
    const event = (dashboardCache?.events || []).find((e) => e.id === eventId);
    if (!event) return;
    document.getElementById("edit-event-id").value = String(event.id);
    document.getElementById("edit-event-name").value = event.name || currentName || "";
    document.getElementById("edit-event-budget").value = event.budget_limit || "";
    document.getElementById("edit-event-type").value = event.event_type || "";
    document.getElementById("edit-event-date").value = event.event_date ? String(event.event_date).slice(0, 10) : "";
    document.getElementById("edit-event-scope").value = event.scope || "";
    document.getElementById("edit-event-venue").value = event.venue || "";
    document.getElementById("edit-event-location").value = event.location || "";
    document.getElementById("edit-event-notes").value = event.planning_notes || "";
    document.getElementById("edit-event-timeline").value = event.timeline_assumptions || "";
    const workflowValue = Array.isArray(event.workflow_json)
      ? event.workflow_json.map((w) => String(w)).join("\n")
      : event.workflow_json || "";
    document.getElementById("edit-event-workflow").value = workflowValue;
    document.getElementById("edit-event-divisions").value = Array.isArray(event.divisions_json)
      ? event.divisions_json.join("\n")
      : String(event.divisions_json || "").replace(/[\[\]"]/g, "").split(",").map((s) => s.trim()).filter(Boolean).join("\n");
    document.getElementById("edit-event-roles").value = Array.isArray(event.roles_json)
      ? event.roles_json.join("\n")
      : String(event.roles_json || "").replace(/[\[\]"]/g, "").split(",").map((s) => s.trim()).filter(Boolean).join("\n");
    const deliverablesObj = typeof event.deliverables_json === "object" && event.deliverables_json ? event.deliverables_json : {};
    document.getElementById("edit-event-deliverables").value = Object.keys(deliverablesObj).map((k) => `${k}: ${deliverablesObj[k]}`).join("\n");
    const constraintsObj = typeof event.constraints_json === "object" && event.constraints_json ? event.constraints_json : {};
    document.getElementById("edit-event-constraints").value = Object.keys(constraintsObj).map((k) => `${k}: ${constraintsObj[k]}`).join("\n");
    document.getElementById("edit-event-hard-deadline").value = String(constraintsObj.hardDeadline || constraintsObj.hard_deadline || event.hard_deadline || "").slice(0, 10);
    document.getElementById("edit-event-constraint-note").value = String(constraintsObj.notes || "");

    document.querySelectorAll("#edit-event-type-grid .edit-chip").forEach((el) => el.classList.toggle("sel", (el.getAttribute("data-value") || "") === (event.event_type || "")));
    document.querySelectorAll("#edit-event-scope-grid .edit-chip").forEach((el) => el.classList.toggle("sel", (el.getAttribute("data-value") || "") === (event.scope || "")));
    const selectedDivisions = new Set(parseListInput(document.getElementById("edit-event-divisions").value));
    document.querySelectorAll("#edit-event-division-grid .edit-chip").forEach((el) => el.classList.toggle("sel", selectedDivisions.has(el.getAttribute("data-value") || "")));
    const selectedStages = new Set(parseListInput(workflowValue));
    document.querySelectorAll("#edit-event-stage-grid .edit-chip").forEach((el) => el.classList.toggle("sel", selectedStages.has(el.getAttribute("data-value") || "")));
    primeEditEventRoleButtons(parseListInput(document.getElementById("edit-event-roles").value));
    renderEditEventDeliverables();
    openModal("eventEditModal");
  };

  window.saveTaskEdit = async function saveTaskEdit() {
    const taskId = Number(document.getElementById("edit-task-id").value || 0);
    if (!taskId) return;
    const meetingInput = document.getElementById("edit-task-meeting-link");
    if (meetingInput && meetingInput.value && !validateMeetingLink(meetingInput)) {
      showToast("Please enter a valid meeting link (Zoom, Google Meet, Teams, or Webex).");
      return;
    }
    const dependency_task_ids = [...document.querySelectorAll("#edit-task-dependencies input:checked")].map((el) => Number(el.value));
    try {
      await apiPatch(`/api/tasks/${taskId}`, {
        title: document.getElementById("edit-task-title").value,
        description: document.getElementById("edit-task-description").value,
        assignee_email: document.getElementById("edit-task-assignee").value,
        role: document.getElementById("edit-task-role").value.trim(),
        department: document.getElementById("edit-task-division").value.trim(),
        event_id: document.getElementById("edit-task-event").value || null,
        due_at: document.getElementById("edit-task-due").value ? new Date(document.getElementById("edit-task-due").value).toISOString() : null,
        unlock_at: (function() {
          const u = document.getElementById("edit-task-unlock").value;
          if (u) return new Date(u).toISOString();
          return new Date(0).toISOString();
        })(),
        priority: document.getElementById("edit-task-priority").value,
        status: document.getElementById("edit-task-status").value,
        meeting_date: "",
        meeting_time: "",
        meeting_location: "",
        meeting_link: document.getElementById("edit-task-meeting-link").value,
        notes: "",
        attachments: JSON.parse(document.getElementById("edit-task-attachments").value || "[]"),
        escalation_rules: document.getElementById("edit-task-escalation-rules").value,
        dependency_task_ids
      });
      closeModal("taskEditModal");
      showToast("Task updated.");
      await hydrateDashboard();
    } catch (error) {
      let msg = "Unable to save task edit.";
      if (error && error.message) {
        try {
          const data = JSON.parse(error.message);
          if (data && data.error) msg = data.error;
        } catch (_) { msg = error.message; }
      }
      showToast(msg);
    }
  };

  window.saveEventEdit = async function saveEventEdit() {
    const eventId = Number(document.getElementById("edit-event-id").value || 0);
    if (!eventId) return;
    try {
      syncEditEventDivisionListFromButtons();
      syncEditEventRoleListFromButtons();
      syncEditEventWorkflowFromButtons();
      const deliverablesByRole = syncEditEventDeliverablesFromFields();
      const constraints = {
        hardDeadline: document.getElementById("edit-event-hard-deadline").value || "",
        notes: document.getElementById("edit-event-constraint-note").value || ""
      };
      const res = await apiPatch(`/api/events/${eventId}`, {
        name: document.getElementById("edit-event-name").value,
        budget_limit: document.getElementById("edit-event-budget").value,
        event_type: document.getElementById("edit-event-type").value,
        event_date: document.getElementById("edit-event-date").value,
        scope: document.getElementById("edit-event-scope").value,
        venue: document.getElementById("edit-event-venue").value,
        location: document.getElementById("edit-event-location").value,
        planning_notes: document.getElementById("edit-event-notes").value,
        timeline_assumptions: document.getElementById("edit-event-timeline").value,
        workflow: parseListInput(document.getElementById("edit-event-workflow").value),
        divisions: parseListInput(document.getElementById("edit-event-divisions").value),
        roles: parseListInput(document.getElementById("edit-event-roles").value),
        deliverables_by_role: deliverablesByRole,
        constraints
      });
      closeModal("eventEditModal");
      showToast(res.warnings?.length ? res.warnings[0] : "Event updated.");
      await hydrateDashboard();
    } catch (_error) {
      showToast("Unable to save event edit.");
    }
  };

  window.toggleArchivedReports = function toggleArchivedReports() {
    window.__showArchivedReports = !window.__showArchivedReports;
    renderReportsLive();
  };

  window.clarifyReport = async function clarifyReport(reportId) {
    const note = prompt("Clarification note to send back:");
    if (note == null) return;
    await updateReportStatus(reportId, "needs_clarification", note);
  };

  window.updateReportStatus = async function updateReportStatus(reportId, status, clarificationNotes) {
    await apiPatch(`/api/reports/${reportId}`, { status, clarification_notes: clarificationNotes || null });
    if (status === "archived") showToast("Report archived.");
    else if (status === "needs_clarification") showToast("Clarification sent.");
    else if (status === "reviewed") showToast("Report reviewed.");
    else showToast("Report updated.");
    await hydrateDashboard();
  };

  window.markTaskOverdue = async function markTaskOverdue(taskId) {
    await apiPatch(`/api/tasks/${taskId}`, { status: "overdue" });
    showToast("Task marked overdue.");
    await hydrateDashboard();
  };

  window.extendTaskDeadline = async function extendTaskDeadline(taskId) {
    const nextDate = prompt("New due date (YYYY-MM-DD):");
    if (!nextDate) return;
    const dueAt = new Date(`${nextDate}T23:59:00`);
    if (!Number.isFinite(dueAt.getTime())) {
      showToast("Invalid date.");
      return;
    }
    await apiPatch(`/api/tasks/${taskId}`, { due_at: dueAt.toISOString(), status: "current" });
    showToast("Deadline updated.");
    await hydrateDashboard();
  };

  window.reassignOverdueTask = async function reassignOverdueTask(taskId) {
    const task = (dashboardCache?.tasks || []).find((t) => t.id === taskId);
    if (!task) return;
    const role = task.owner_role || "";
    const suggestions = await apiGet(`/api/assign/suggestions?role=${encodeURIComponent(role)}`).catch(() => ({ suggestions: [] }));
    if (!suggestions.suggestions?.length) {
      showToast("No reassignment options found.");
      return;
    }
    const selected = suggestions.suggestions[0];
    await apiPatch(`/api/tasks/${taskId}`, {
      assignee_email: selected.email,
      role: selected.role_title,
      department: selected.department,
      status: "current"
    });
    showToast(`Reassigned to ${selected.full_name}.`);
    await hydrateDashboard();
  };

  await hydrateDashboard();
  setInterval(async () => {
    await hydrateDashboard();
  }, 30000);

  document.addEventListener("click", function(e) {
    const wrap = document.querySelector("#pres-dep-picker-wrap.open");
    if (wrap && !wrap.contains(e.target)) wrap.classList.remove("open");
  });
})();
