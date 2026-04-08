/* vp.html — live API integration layer */

// Index gallery (VP can add/remove/reorder; president pushes from President page)
var vpGalleryImagesCurrent = [];
function vpGalleryFilename(img) { return (img.src || '').split('/').pop() || ''; }
function vpGalleryItemHtml(img, i, total) {
  var src = (img.src && img.src.startsWith('/')) ? (window.location.origin + img.src) : (img.src || '');
  var fn = (vpGalleryFilename(img) || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  var moveUp = i > 0 ? '<button type="button" class="site-gallery-move" onclick="vpMoveGalleryPhoto(' + i + ', -1)" title="Move up" aria-label="Move up">↺</button>' : '';
  var moveDown = i < total - 1 ? '<button type="button" class="site-gallery-move" onclick="vpMoveGalleryPhoto(' + i + ', 1)" title="Move down" aria-label="Move down">↻</button>' : '';
  return '<div class="site-gallery-row">' +
    '<div class="site-gallery-order-btns">' + moveUp + moveDown + '</div>' +
    '<div class="site-gallery-item"><img src="' + src + '" alt="" /><button type="button" class="site-gallery-remove" data-filename="' + fn + '" onclick="vpRemoveGalleryPhoto(this.getAttribute(\'data-filename\'))" aria-label="Remove">×</button></div>' +
    '</div>';
}
window.vpLoadSiteGalleryPage = async function vpLoadSiteGalleryPage() {
  try {
    const r = await fetch('/api/public/site-content');
    const data = r.ok ? await r.json() : {};
    const list = document.getElementById('vp-gallery-list');
    if (!list) return;
    const images = data.galleryImages || [];
    vpGalleryImagesCurrent = images;
    if (images.length === 0) {
      list.innerHTML = '<span style="font-size:12px;color:var(--silver)">No photos yet. Add one above.</span>';
      return;
    }
    list.innerHTML = images.map(function (img, i) { return vpGalleryItemHtml(img, i, images.length); }).join('');
  } catch (_e) {
    const list = document.getElementById('vp-gallery-list');
    if (list) list.innerHTML = '<span style="font-size:12px;color:var(--silver)">Could not load gallery.</span>';
  }
};
window.vpMoveGalleryPhoto = async function vpMoveGalleryPhoto(index, delta) {
  var arr = vpGalleryImagesCurrent.slice();
  var next = index + delta;
  if (next < 0 || next >= arr.length) return;
  var t = arr[index]; arr[index] = arr[next]; arr[next] = t;
  var order = arr.map(function (img) { return img.src || ''; }).filter(Boolean);
  var token = getSessionToken();
  if (!token) { if (typeof showToast === 'function') showToast('You must be logged in.'); return; }
  try {
    var res = await fetch('/api/site/gallery-order', { method: 'PUT', headers: { 'x-session-token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ galleryOrder: order }) });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Reorder failed');
    if (typeof showToast === 'function') showToast('Order saved.');
    vpLoadSiteGalleryPage();
  } catch (e) { if (typeof showToast === 'function') showToast(e.message || 'Reorder failed'); }
};
window.vpGalleryDragOver = function vpGalleryDragOver(e) { e.preventDefault(); e.stopPropagation(); var z = document.getElementById('vp-gallery-drop'); if (z) z.classList.add('drag-over'); };
window.vpGalleryDragLeave = function vpGalleryDragLeave(e) { e.preventDefault(); var z = document.getElementById('vp-gallery-drop'); if (z) z.classList.remove('drag-over'); };
window.vpGalleryDrop = function vpGalleryDrop(e) {
  e.preventDefault(); e.stopPropagation();
  var z = document.getElementById('vp-gallery-drop'); if (z) z.classList.remove('drag-over');
  var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (f && f.type && f.type.indexOf('image/') === 0) vpUploadGalleryFile(f);
};
window.vpGalleryFileChosen = function vpGalleryFileChosen(input) {
  var f = input && input.files && input.files[0];
  if (f) vpUploadGalleryFile(f);
  input.value = '';
};
window.vpUploadGalleryFile = async function vpUploadGalleryFile(file) {
  var token = getSessionToken();
  if (!token) { if (typeof showToast === 'function') showToast('You must be logged in.'); return; }
  var fd = new FormData(); fd.append('photo', file); fd.append('alt', 'SSA event');
  var dz = document.getElementById('vp-gallery-dz-text');
  if (dz) dz.textContent = 'Uploading…';
  try {
    var res = await fetch('/api/site/gallery', { method: 'POST', headers: { 'x-session-token': token }, body: fd });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    if (typeof showToast === 'function') showToast('Photo added.');
    vpLoadSiteGalleryPage();
  } catch (err) {
    if (typeof showToast === 'function') showToast(err.message || 'Upload failed');
  }
  if (dz) { dz.innerHTML = '<strong>Click to upload</strong> or drag and drop'; }
};
window.vpRemoveGalleryPhoto = async function vpRemoveGalleryPhoto(filename) {
  if (!filename) return;
  var token = getSessionToken();
  if (!token) { if (typeof showToast === 'function') showToast('You must be logged in.'); return; }
  try {
    var res = await fetch('/api/site/gallery/file/' + encodeURIComponent(filename), { method: 'DELETE', headers: { 'x-session-token': token } });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Remove failed');
    if (typeof showToast === 'function') showToast('Photo removed.');
    vpLoadSiteGalleryPage();
  } catch (e) { if (typeof showToast === 'function') showToast(e.message || 'Remove failed'); }
};
window.vpPushGalleryToGitHub = async function vpPushGalleryToGitHub() {
  var token = getSessionToken();
  if (!token) { if (typeof showToast === 'function') showToast('You must be logged in.'); return; }
  var el = document.getElementById('vp-push-gallery-status');
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

// Live API integration layer for the existing VP UI.
(async function wireVpLive() {
  const token = getSessionToken();
  if (!token) {
    window.location.href = "ops-login.html";
    return;
  }

  let dashboard = null;
  let selectedAssigneeEmail = "";
  let selectedVpAssigneeEmail = "";
  let pendingVpConfirmAction = null;
  let hydrateBusy = false;
  let __vpTourInited = false;
  let __vpTourIdx = 0;
  const VP_TOUR_STORAGE_KEY = "ssa_tour_seen_vp_v1";
  const VP_TOUR_STEPS = [
    {
      title: "Welcome",
      body: `
        <div style="font-size:12px;color:var(--silver);line-height:1.8">
          This is your division hub. Your job is to <strong style="color:var(--white)">review submissions</strong>, keep the division moving,
          and escalate issues to the President when needed.
        </div>
      `
    },
    {
      title: "What to do each week",
      body: `
        <div style="font-size:12px;color:var(--silver);line-height:1.9">
          <ol style="margin:0;padding-left:18px">
            <li>Open <strong style="color:var(--white)">Submissions to Review</strong> and approve or request redo.</li>
            <li>Check <strong style="color:var(--white)">Overdue & Alerts</strong> for anything at risk.</li>
            <li>Open <strong style="color:var(--white)">Events</strong> to spot bottlenecks.</li>
          </ol>
        </div>
      `
    },
    {
      title: "Escalations",
      body: `
        <div style="font-size:12px;color:var(--silver);line-height:1.9">
          Use <strong style="color:var(--white)">Escalate to President</strong> when a blocker affects the whole event or requires executive judgment.
          Keep it short: what’s happening, what you need, and what decision is required.
        </div>
      `
    }
  ];

  function renderVpTour() {
    const step = VP_TOUR_STEPS[Math.max(0, Math.min(__vpTourIdx, VP_TOUR_STEPS.length - 1))];
    const title = document.getElementById("vp-tour-title");
    const body = document.getElementById("vp-tour-body");
    if (title) title.textContent = `Quick Tour · ${step.title}`;
    if (body) body.innerHTML = step.body;
  }

  window.openVpTour = function openVpTour() {
    const host = document.getElementById("vp-tour-modal");
    if (!host) return;
    __vpTourIdx = 0;
    renderVpTour();
    host.classList.add("open");
    host.setAttribute("aria-hidden", "false");
  };
  window.closeVpTour = function closeVpTour() {
    const host = document.getElementById("vp-tour-modal");
    if (!host) return;
    host.classList.remove("open");
    host.setAttribute("aria-hidden", "true");
  };
  window.vpTourNext = function vpTourNext() {
    __vpTourIdx = Math.min(VP_TOUR_STEPS.length - 1, __vpTourIdx + 1);
    renderVpTour();
  };
  window.vpTourPrev = function vpTourPrev() {
    __vpTourIdx = Math.max(0, __vpTourIdx - 1);
    renderVpTour();
  };
  window.finishVpTour = function finishVpTour() {
    try { localStorage.setItem(VP_TOUR_STORAGE_KEY, "1"); } catch (_e) {}
    window.closeVpTour();
  };
  function maybeAutoOpenVpTour() {
    if (__vpTourInited) return;
    __vpTourInited = true;
    try {
      if (localStorage.getItem(VP_TOUR_STORAGE_KEY) === "1") return;
    } catch (_e) {}
    setTimeout(() => window.openVpTour && window.openVpTour(), 500);
  }

  window.vpOpenAssignModal = async function vpOpenAssignModal() {
    if (!dashboard) return;
    const divName = (dashboard.user && dashboard.user.department) ? dashboard.user.department : (VP_CONFIG.division || "Division");
    const hsub = document.getElementById("vp-assign-hsub");
    if (hsub) hsub.textContent = divName + " · SSA Board Platform";
    const eventSelect = document.getElementById("vp-assign-event");
    if (eventSelect) {
      const activeEvents = (dashboard.events || []).filter((e) => {
        const ts = new Date(e.event_date).getTime();
        return !(Number(e.progress || 0) >= 100 || String(e.status || "").toLowerCase() === "completed" || (Number.isFinite(ts) && ts < Date.now()));
      });
      eventSelect.innerHTML = "<option value=\"\">Standalone</option>" + activeEvents.map((e) => `<option value="${e.id}">${e.name}</option>`).join("");
    }
    const users = dashboard.users || [];
    const roleSet = new Map();
    users.forEach((u) => { if (u.role_title && !roleSet.has(u.role_title)) roleSet.set(u.role_title, u.department); });
    const roles = Array.from(roleSet.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const roleSelect = document.getElementById("vp-assign-role");
    if (roleSelect) {
      roleSelect.innerHTML = "<option value=\"\">— Select role —</option>" + roles.map(([r]) => `<option value="${r.replace(/"/g, "&quot;")}">${r}</option>`).join("");
    }
    const chipsRoot = document.getElementById("vp-assign-role-chips");
    if (chipsRoot) {
      chipsRoot.innerHTML = roles.map(([roleTitle, dept]) => {
        const div = (dept || "").indexOf("External") !== -1 ? "External" : (dept || "").indexOf("Internal") !== -1 ? "Internal" : "Executive";
        const dotColor = div === "External" ? "#4caf7d" : div === "Internal" ? "#7ba3d4" : "var(--gold)";
        return `<div class="at-role-chip" data-role="${roleTitle.replace(/"/g, "&quot;")}" onclick="vpSelectAssignRole(this)"><div class="at-rc-dot" style="background:${dotColor}"></div><div><div class="at-rc-div">${div}</div><div class="at-rc-name">${roleTitle}</div></div></div>`;
      }).join("");
    }
    const depsRoot = document.getElementById("vp-assign-dependencies");
    if (depsRoot) {
      depsRoot.innerHTML = "<div style=\"font-size:12px;color:var(--silver);padding:8px 0\">Loading prerequisites (any division)…</div>";
      try {
        const data = await apiGet("/api/tasks/all-for-prereq");
        const allTasks = (data.tasks || []).filter((t) => String(t.status || "").toLowerCase() !== "completed");
        depsRoot.innerHTML = allTasks.map((t) => {
          const status = t.status === "completed" ? "Done" : ["current", "pending_review", "redo"].includes(t.status) ? "In Progress" : "Locked";
          const psClass = t.status === "completed" ? "at-ps-done" : ["current", "pending_review", "redo"].includes(t.status) ? "at-ps-active" : "at-ps-locked";
          const dept = (t.owner_role || t.department || "").replace(/</g, "&lt;");
          const assigneeLine = (t.owner_name || "").replace(/</g, "&lt;") + (t.owner_role ? " · " + (t.owner_role || "").replace(/</g, "&lt;") : "");
          return `<div class="at-prereq-item" data-task-id="${t.id}" onclick="vpToggleAssignPrereq(this)"><input type="checkbox" value="${t.id}" class="vp-assign-dep-cb" style="position:absolute;opacity:0;width:0;height:0;margin:0" /><div class="at-prereq-cb"><div style="width:6px;height:6px;background:var(--navy);border-radius:1px;display:none" class="at-prereq-cb-inner"></div></div><div><div class="at-prereq-dept">${dept}</div><div class="at-prereq-name">${(t.title || "").replace(/</g, "&lt;")}</div><div class="at-prereq-assignee">${assigneeLine}</div></div><span class="at-prereq-status ${psClass}">${status}</span></div>`;
        }).join("");
      } catch (_) {
        depsRoot.innerHTML = "<div style=\"font-size:12px;color:var(--silver)\">Could not load prerequisites.</div>";
      }
    }
    document.getElementById("vp-assign-title").value = "";
    document.getElementById("vp-assign-priority").value = "standard";
    document.querySelectorAll("#vp-assign-role-chips + .at-suggest-wrap").forEach(() => {});
    document.querySelectorAll("#vpAssignTaskModal .at-prio-btn").forEach((b) => b.classList.remove("active-urgent", "active-high", "active-standard", "active-low"));
    const stdBtn = document.querySelector("#vpAssignTaskModal .at-prio-btn[data-prio=\"standard\"]");
    if (stdBtn) stdBtn.classList.add("active-standard");
    document.getElementById("vp-assign-description").value = "";
    document.getElementById("vp-assign-due").value = "";
    document.getElementById("vp-assign-meeting-link").value = "";
    if (typeof vpUpdateAssignDescHint === "function") vpUpdateAssignDescHint();
    selectedVpAssigneeEmail = "";
    document.getElementById("vp-assign-suggestions").innerHTML = "<div style=\"font-size:12px;color:var(--silver);padding:8px 0\">Select a role to load suggestions.</div>";
    vpUpdateAssignFooterHint();
    openModal("vpAssignTaskModal");
  };

  window.vpSetAssignPrio = function vpSetAssignPrio(el) {
    if (!el) return;
    const p = el.getAttribute("data-prio");
    document.getElementById("vp-assign-priority").value = p || "standard";
    document.querySelectorAll("#vpAssignTaskModal .at-prio-btn").forEach((b) => b.classList.remove("active-urgent", "active-high", "active-standard", "active-low"));
    el.classList.add("active-" + (p === "urgent" ? "urgent" : p === "high" ? "high" : p === "low" ? "low" : "standard"));
  };

  window.vpSelectAssignRole = function vpSelectAssignRole(el) {
    if (!el) return;
    const role = el.getAttribute("data-role") || "";
    document.querySelectorAll("#vp-assign-role-chips .at-role-chip").forEach((c) => c.classList.remove("selected"));
    el.classList.add("selected");
    document.getElementById("vp-assign-role").value = role;
    vpLoadAssignSuggestions();
    vpUpdateAssignFooterHint();
  };

  async function vpLoadAssignSuggestions() {
    const role = document.getElementById("vp-assign-role")?.value?.trim();
    const root = document.getElementById("vp-assign-suggestions");
    if (!root) return;
    if (!role) {
      root.innerHTML = "<div style=\"font-size:12px;color:var(--silver);padding:8px 0\">Select a role to load suggestions.</div>";
      return;
    }
    root.innerHTML = "<div style=\"font-size:12px;color:var(--silver);padding:8px 0\">Loading…</div>";
    try {
      const resp = await apiGet("/api/assign/suggestions?role=" + encodeURIComponent(role));
      const list = resp.suggestions || [];
      root.innerHTML = list.length ? list.map((m, i) => `<div class="at-suggest-item" data-email="${(m.email || "").replace(/"/g, "&quot;")}" data-name="${(m.full_name || "").replace(/"/g, "&quot;")}" data-role="${(m.role_title || "").replace(/"/g, "&quot;")}" onclick="vpSelectAssignSuggestion(this)"><div class="at-si-rank">${i + 1}</div><div class="at-si-info"><div class="at-si-name">${m.full_name}</div><div class="at-si-role">${m.role_title} · ${m.department || ""}</div></div></div>`).join("") : "<div style=\"font-size:12px;color:var(--silver)\">No suggestions for this role in your division.</div>";
    } catch (_) {
      root.innerHTML = "<div style=\"font-size:12px;color:var(--red)\">Could not load suggestions.</div>";
    }
    vpUpdateAssignFooterHint();
  }

  window.vpSelectAssignSuggestion = function vpSelectAssignSuggestion(el) {
    if (!el) return;
    selectedVpAssigneeEmail = el.getAttribute("data-email") || "";
    document.querySelectorAll("#vp-assign-suggestions .at-suggest-item").forEach((s) => s.classList.remove("selected"));
    el.classList.add("selected");
    vpUpdateAssignFooterHint();
  };

  window.vpValidateMeetingLink = function vpValidateMeetingLink(inputEl) {
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

  window.vpUpdateAssignFooterHint = function vpUpdateAssignFooterHint() {
    const hint = document.getElementById("vp-assign-footer-hint");
    if (!hint) return;
    const role = document.getElementById("vp-assign-role")?.value?.trim();
    if (!role) { hint.textContent = "Select a role and assignee above (division members only)."; return; }
    if (selectedVpAssigneeEmail) {
      const sel = document.querySelector("#vp-assign-suggestions .at-suggest-item.selected");
      hint.textContent = "Assignee: " + (sel ? sel.getAttribute("data-name") : selectedVpAssigneeEmail);
    } else hint.textContent = "Select a role and click a suggestion to choose assignee (division only).";
  };

  window.vpUpdateAssignDescHint = function vpUpdateAssignDescHint() {
    const hint = document.getElementById("vp-assign-desc-hint");
    const text = document.getElementById("vp-assign-description")?.value || "";
    if (!hint) return;
    hint.textContent = `Recommended ${text.length}/100 characters (minimum 40).`;
    hint.style.color = "var(--gold)";
  };

  window.updateAssignDescriptionHint = function updateAssignDescriptionHint() {
    const hint = document.getElementById("assign-desc-hint");
    const text = document.getElementById("assign-description")?.value || "";
    if (!hint) return;
    hint.textContent = `Recommended ${text.length}/100 characters (minimum 40).`;
    hint.style.color = "var(--gold)";
  };

  window.vpToggleAssignPrereq = function vpToggleAssignPrereq(el) {
    if (!el) return;
    const cb = el.querySelector("input.vp-assign-dep-cb");
    const inner = el.querySelector(".at-prereq-cb-inner");
    if (cb) cb.checked = !cb.checked;
    el.classList.toggle("checked", cb && cb.checked);
    if (inner) inner.style.display = cb && cb.checked ? "block" : "none";
  };

  window.vpAssignTask = async function vpAssignTask() {
    const title = document.getElementById("vp-assign-title")?.value?.trim();
    const role = document.getElementById("vp-assign-role")?.value?.trim();
    const due = document.getElementById("vp-assign-due")?.value;
    const priority = document.getElementById("vp-assign-priority")?.value || "standard";
    const eventId = document.getElementById("vp-assign-event")?.value || "";
    const description = document.getElementById("vp-assign-description")?.value?.trim() || "Assigned by VP.";
    const meetingLink = document.getElementById("vp-assign-meeting-link")?.value?.trim() || "";
    const meetingInput = document.getElementById("vp-assign-meeting-link");
    if (meetingInput && meetingInput.value && !vpValidateMeetingLink(meetingInput)) {
      showToast("Please enter a valid meeting link (Zoom, Google Meet, Teams, or Webex).");
      return;
    }
    const dependency_task_ids = [...(document.querySelectorAll("#vp-assign-dependencies input.vp-assign-dep-cb:checked") || [])].map((el) => Number(el.value)).filter(Boolean);
    if (!title || !role) {
      showToast("Fill task title and role.");
      return;
    }
    if (description.length < 40) {
      showToast("Description must be at least 40 characters.");
      return;
    }
    const dueAt = due ? new Date(due + "T23:59:00") : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    try {
      await apiPost("/api/tasks/assign", {
        title,
        role,
        due_at: dueAt.toISOString(),
        priority,
        description,
        assignee_email: selectedVpAssigneeEmail || undefined,
        event_id: eventId || undefined,
        unlock_at: new Date(0).toISOString(),
        meeting_link: meetingLink || undefined,
        dependency_task_ids
      });
      showToast("Task assigned.");
      closeModal("vpAssignTaskModal");
      await hydrate();
    } catch (e) {
      showToast(String(e?.message || "Unable to assign task."));
    }
  };

  function taskHtmlLive(t) {
    const cls =
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
    const eventName = (dashboard?.events || []).find((e) => e.id === t.event_id)?.name || "N/A";
    const meetingLine = t.meeting_date || t.meeting_location
      ? `Meeting ${t.meeting_date || ""} ${t.meeting_time || ""} ${t.meeting_location || ""}`
      : "Meeting N/A";
    return `
      <div class="task-item" onclick="inspectTask(${t.id})">
        <div class="task-stripe ${stripe}"></div>
        <div>
          <div class="task-title">${t.title}</div>
          <div class="task-meta">
            <span>${t.owner_name}</span>
            <span>${t.department}</span>
            <span>Priority ${(t.priority || "standard").replace(/^./, (s) => s.toUpperCase())}</span>
            <span>Due ${new Date(t.due_at).toLocaleDateString()}</span>
            <span>Event ${eventName}</span>
            <span>${meetingLine}</span>
          </div>
          ${t.description ? `<div style="font-size:11px;color:var(--silver);margin-top:6px">${t.description}</div>` : ""}
        </div>
        <div class="task-actions"><span class="status-badge ${cls}">${t.status.replaceAll("_", " ")}</span><button class="btn btn-outline" style="font-size:9px;padding:3px 8px" onclick="event.stopPropagation();inspectTask(${t.id})">Click to Review</button></div>
      </div>
    `;
  }

  function renderLiveStats(tasks) {
    const active = tasks.filter((t) => ["current", "pending_review", "redo"].includes(t.status)).length;
    const overdue = tasks.filter((t) => t.status === "overdue").length;
    const pending = tasks.filter((t) => t.status === "pending_review").length;
    const done = tasks.filter((t) => t.status === "completed").length;
    const root = document.getElementById("overview-stats");
    if (!root) return;
    root.innerHTML = `
      <div class="stat-card"><div class="stat-num">${active}</div><div class="stat-label">Active Tasks</div></div>
      <div class="stat-card"><div class="stat-num red">${overdue}</div><div class="stat-label">Overdue</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--blue)">${pending}</div><div class="stat-label">Pending Review</div></div>
      <div class="stat-card"><div class="stat-num green">${done}</div><div class="stat-label">Completed</div></div>
    `;
  }

  function openVpStyledConfirm(message, onConfirm) {
    const msgEl = document.getElementById("vp-confirm-action-message");
    const btn = document.getElementById("vp-confirm-action-btn");
    if (msgEl) msgEl.textContent = message;
    pendingVpConfirmAction = onConfirm;
    if (btn) {
      btn.onclick = async () => {
        const fn = pendingVpConfirmAction;
        pendingVpConfirmAction = null;
        closeModal("vpConfirmActionModal");
        if (typeof fn === "function") await fn();
      };
    }
    openModal("vpConfirmActionModal");
  }

  function parseListInput(text) {
    const raw = String(text || "").trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
    } catch (_e) {}
    return raw.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
  }

  function populateReportSelectors() {
    const eventRoot = document.getElementById("report-event");
    const taskRoot = document.getElementById("report-task");
    if (eventRoot) {
      eventRoot.innerHTML = `<option value="">No linked event</option>${(dashboard?.events || [])
        .map((e) => `<option value="${e.id}">${(e.name || "").replace(/</g, "&lt;")}</option>`)
        .join("")}`;
    }
    if (taskRoot) {
      taskRoot.innerHTML = `<option value="">No linked task</option>${(dashboard?.tasks || [])
        .map((t) => `<option value="${t.id}">${(t.title || "").replace(/</g, "&lt;")}</option>`)
        .join("")}`;
    }
  }

  const VP_ESC_SEV = {
    critical: { btnCls: "active-crit", bannerColor: "var(--red)", bannerBg: "var(--red-dim)", icon: "⚠", text: "Critical escalation — the President will be alerted immediately. Reserve this level for genuine emergencies where delay causes real organizational damage.", footerNote: "<strong>Critical severity</strong> — President is notified immediately and expected to respond within the hour. Use only when delay causes real failure.", btnCls2: "crit", btnLabel: "Send Critical Escalation" },
    high: { btnCls: "active-high", bannerColor: "var(--amber)", bannerBg: "var(--amber-dim)", icon: "◑", text: "High escalation — time-sensitive but not an immediate emergency. The President will review this within the day.", footerNote: "<strong>High severity</strong> — The President will be notified immediately. Escalations are logged permanently and visible to executive leadership.", btnCls2: "", btnLabel: "Send Escalation" },
    standard: { btnCls: "active-std", bannerColor: "var(--gold)", bannerBg: "rgba(184,154,92,.07)", icon: "◈", text: "Standard escalation — no immediate risk. The President will review and respond at their next availability.", footerNote: "<strong>Standard severity</strong> — The President will be notified and will review at their next availability. No immediate urgency flagged.", btnCls2: "", btnLabel: "Send Escalation" }
  };
  let vpEscCurSev = "high";

  window.vpSetSev = function vpSetSev(el) {
    if (!el) return;
    document.querySelectorAll("#page-escalate .sev-btn").forEach((b) => b.className = "sev-btn");
    const sev = el.getAttribute("data-sev") || "high";
    vpEscCurSev = sev;
    const cfg = VP_ESC_SEV[sev] || VP_ESC_SEV.high;
    el.classList.add(cfg.btnCls);
    const banner = document.getElementById("sev-banner");
    if (banner) {
      banner.style.borderLeftColor = cfg.bannerColor;
      banner.style.background = cfg.bannerBg;
      banner.style.color = cfg.bannerColor;
      banner.classList.add("show");
    }
    const iconEl = document.getElementById("sev-icon");
    const textEl = document.getElementById("sev-text");
    if (iconEl) iconEl.textContent = cfg.icon;
    if (textEl) textEl.textContent = cfg.text;
    const noteEl = document.getElementById("esc-footer-note");
    if (noteEl) noteEl.innerHTML = cfg.footerNote;
    const btn = document.getElementById("esc-send-btn");
    if (btn) { btn.className = "esc-btn-send " + cfg.btnCls2; btn.textContent = cfg.btnLabel; }
  };

  window.vpTogType = function vpTogType(el) {
    if (!el) return;
    const reason = el.getAttribute("data-reason") || "";
    document.querySelectorAll("#page-escalate .type-chip").forEach((c) => c.classList.remove("on"));
    el.classList.add("on");
    const hid = document.getElementById("report-reason");
    if (hid) hid.value = reason;
  };

  window.vpEscCountChars = function vpEscCountChars(taId, hintId) {
    const ta = document.getElementById(taId);
    const hint = document.getElementById(hintId);
    if (!ta || !hint) return;
    const max = taId === "report-notes" ? 800 : 200;
    const n = (ta.value || "").length;
    hint.textContent = n + " / " + max + " recommended";
    hint.className = "esc-char-hint" + (n > max ? " warn" : "");
  };

  function vpEscInitSev() {
    const highBtn = document.querySelector("#page-escalate .sev-btn[data-sev=\"high\"]");
    if (highBtn && typeof window.vpSetSev === "function") window.vpSetSev(highBtn);
  }

  async function hydrate() {
    if (hydrateBusy) return;
    hydrateBusy = true;
    try {
    const me = await apiGet("/api/me");
    if (me.user.view_type !== "vp" && me.user.view_type !== "president") {
      window.location.href = "board.html";
      return;
    }
    if (me.user.view_type === "president") {
      window.location.href = "president.html";
      return;
    }
    const expectedDivision = me.user.vp_type === "external" ? "external" : "internal";
    const currentDivision = new URLSearchParams(window.location.search).get("division") || "internal";
    if (currentDivision !== expectedDivision) {
      window.location.href = `vp.html?division=${expectedDivision}`;
      return;
    }
    dashboard = await apiGet("/api/dashboard");
    const pending = await apiGet("/api/submissions/pending").catch(() => ({ pending: [] }));
    const notifications = await apiGet("/api/notifications").catch(() => ({ count: 0, items: [], stats: { pendingReview: 0, overdue: 0 } }));

    document.getElementById("vp-greeting").textContent = `Hey ${me.user.full_name.split(" ")[0]},`;
    document.getElementById("vp-role").textContent = me.user.role_title;
    document.getElementById("vp-div").textContent = `${me.user.department} · Division Admin`;
    const sbSuggestions = document.getElementById("sb-item-suggestions");
    if (sbSuggestions) sbSuggestions.style.display = me.user.vp_type === "external" ? "none" : "";
    populateReportSelectors();

    renderLiveStats(dashboard.tasks);
    if (typeof ALL_TASKS !== "undefined") {
      const userEmail = (me && me.user && me.user.email) ? String(me.user.email).toLowerCase() : "";
      ALL_TASKS.length = 0;
      dashboard.tasks.forEach((t) => {
        const vpScope = String(t.vp_scope || t.vp_type || "").toLowerCase();
        const div = vpScope === "external" ? "external" : vpScope === "internal" ? "internal" : "";
        ALL_TASKS.push({
          id: t.id,
          title: t.title,
          assigned: t.owner_name,
          assigned_email: (t.owner_email || "").toLowerCase(),
          owner_role: t.owner_role,
          dept: t.department,
          div: div,
          event: (dashboard.events.find((e) => e.id === t.event_id) || {}).name || "",
          due: new Date(t.due_at).toLocaleDateString(),
          due_at: t.due_at,
          phase: t.phase || "Planning",
          priority: t.priority || "standard",
          meeting_date: t.meeting_date || "",
          meeting_time: t.meeting_time || "",
          meeting_location: t.meeting_location || "",
          meeting_link: t.meeting_link || "",
          status: t.status === "completed" ? "done" : t.status === "pending_review" ? "pending" : t.status,
          summary: t.previous_summary || "",
          description: t.description || "",
          notes: t.notes || "",
          redo_notes: t.redo_notes || "",
          redo_requested_at: t.redo_requested_at || ""
        });
      });
      divTasks = ALL_TASKS.filter((t) => t.div === VP_CONFIG.type);
      MY_TASKS.length = 0;
      ALL_TASKS.filter((t) => t.assigned_email === userEmail).forEach((t) => MY_TASKS.push(t));
    }
    const myTasksHtml = (typeof MY_TASKS !== "undefined" ? MY_TASKS : []).map((t) => taskHtml(t)).join("") || '<div style="color:var(--silver);font-size:13px;padding:16px">No tasks assigned to you.</div>';
    const divTasksHtml = (typeof divTasks !== "undefined" ? divTasks : []).map((t) => taskHtml(t, true)).join("") || '<div style="color:var(--silver);font-size:13px;padding:16px">No division tasks.</div>';
    const myTaskList = document.getElementById("my-task-list");
    const divTaskList = document.getElementById("div-task-list");
    if (myTaskList) myTaskList.innerHTML = myTasksHtml;
    if (divTaskList) divTaskList.innerHTML = divTasksHtml;

    const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const splitProofLinks = (raw) => String(raw || "")
      .split(/\r?\n|,/)
      .map((s) => s.trim())
      .filter(Boolean);
    const pHtml = pending.pending
      .map(
        (s) => {
          const proofLinks = splitProofLinks(s.proof_links);
          const proofHtml = proofLinks.length
            ? `<div style="margin-top:8px">
                <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin-bottom:5px">Proof links / attachments</div>
                <div style="display:flex;flex-direction:column;gap:6px">
                  ${proofLinks.map((l) => `<a href="${esc(l)}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:var(--gold-light);text-decoration:none;word-break:break-all">${esc(l)}</a>`).join("")}
                </div>
              </div>`
            : `<div style="font-size:11px;color:var(--silver);margin-top:8px">No proof links provided.</div>`;
          const quality = s.difficulty ? esc(s.difficulty) : "Not provided";
          return `
      <div class="approval-item">
        <div class="approval-header">
          <div>
            <div class="approval-task">${esc(s.title)}</div>
            <div class="approval-by">${esc(s.owner_name)} · ${esc(s.department)} · ${s.created_at ? new Date(s.created_at).toLocaleString() : ''}</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-green" style="font-size:9px;padding:4px 10px" onclick="approveTaskLive(${s.task_id})">Approve</button>
            <button class="btn btn-red" style="font-size:9px;padding:4px 10px" onclick="redoTaskLive(${s.task_id})">Redo</button>
          </div>
        </div>
        <details style="margin-top:8px;border-left:2px solid var(--blue);background:var(--blue-dim);padding:8px 10px">
          <summary style="cursor:pointer;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--blue)">Full submission detail</summary>
          <div style="font-size:11px;color:var(--silver);line-height:1.65;margin-top:8px">
            <div style="margin-bottom:10px">
              <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin-bottom:5px">What did you do?</div>
              <div>${esc(s.summary || "—")}</div>
            </div>
            <div style="margin-bottom:10px">
              <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin-bottom:5px">Completion quality</div>
              <div>${quality}</div>
            </div>
            <div style="margin-bottom:10px">
              <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin-bottom:5px">Blockers / notes</div>
              <div>${esc(s.comments || "—")}</div>
            </div>
            ${proofHtml}
          </div>
        </details>
      </div>
    `
        }
      )
      .join("");

    const fullApprovals = document.getElementById("full-approvals");
    const overviewApprovals = document.getElementById("overview-approvals");
    if (fullApprovals) fullApprovals.innerHTML = pHtml || '<div style="color:var(--silver);font-size:13px;padding:16px">No pending submissions.</div>';
    if (overviewApprovals) overviewApprovals.innerHTML = pHtml || '<div style="color:var(--silver);font-size:13px;padding:16px">No pending submissions.</div>';

    const overdueTasks = dashboard.tasks.filter((t) => t.status === "overdue");
    const overHtml = overdueTasks
      .map(
        (t) => `
      <div class="overdue-alert">
        <div class="alert-icon">⚠</div>
        <div class="alert-body">
          <div class="alert-title">${t.title}</div>
          <div class="alert-sub">${t.owner_name} · Due ${new Date(t.due_at).toLocaleDateString()}</div>
          <div class="alert-actions">
            <button class="btn btn-outline" style="font-size:9px;padding:4px 10px" onclick="extendTaskDeadlineLive(${t.id})">Extend Deadline</button>
            <button class="btn btn-outline" style="font-size:9px;padding:4px 10px" onclick="reassignOverdueTaskLive(${t.id})">Reassign</button>
            <button class="btn btn-outline" style="font-size:9px;padding:4px 10px" onclick="markTaskOverdueById(${t.id})">Mark Overdue</button>
          </div>
        </div>
      </div>
    `
      )
      .join("");
    const fullOver = document.getElementById("full-overdue");
    const overviewAlerts = document.getElementById("overview-alerts");
    if (fullOver) fullOver.innerHTML = overHtml || '<div style="color:var(--silver);font-size:13px;padding:16px">No overdue tasks.</div>';
    if (overviewAlerts) overviewAlerts.innerHTML = overHtml || '<div style="color:var(--silver);font-size:13px;padding:16px">No overdue tasks.</div>';

    const apprBadge = document.getElementById("appr-badge");
    if (apprBadge) apprBadge.textContent = String(notifications.stats?.pendingReview || 0);
    const overBadge = document.getElementById("over-badge");
    if (overBadge) overBadge.textContent = String(notifications.stats?.overdue || 0);
    const reportsBadge = document.getElementById("reports-badge");
    const reportCount = (notifications.items || []).length;
    if (reportsBadge) {
      reportsBadge.textContent = String(reportCount);
      reportsBadge.style.display = reportCount ? "inline-flex" : "none";
    }
    const assignEvent = document.getElementById("assign-event");
    if (assignEvent) {
      const activeEvents = (dashboard.events || []).filter((e) => {
        const ts = new Date(e.event_date).getTime();
        return !(Number(e.progress || 0) >= 100 || String(e.status || "").toLowerCase() === "completed" || (Number.isFinite(ts) && ts < Date.now()));
      });
      assignEvent.innerHTML = `<option value="">Standalone</option>${activeEvents
        .map((e) => `<option value="${e.id}">${e.name}</option>`)
        .join("")}`;
    }
    const assignDeps = document.getElementById("assign-dependencies");
    if (assignDeps) {
      assignDeps.innerHTML = dashboard.tasks
        .filter((t) => String(t.status || "").toLowerCase() !== "completed")
        .map((t) => `<label style="font-size:11px;color:var(--silver);display:flex;gap:8px"><input type="checkbox" value="${t.id}" /> <span>${t.title}</span></label>`)
        .join("");
    }

    const isPastEvent = (e) => {
      const ts = new Date(e.event_date).getTime();
      return Number(e.progress || 0) >= 100 || String(e.status || "").toLowerCase() === "completed" || (Number.isFinite(ts) && ts < Date.now());
    };
    const currentEvents = (dashboard.events || []).filter((e) => !isPastEvent(e));
    const pastEvents = (dashboard.events || []).filter((e) => isPastEvent(e));
    const tagChip = (txt) => `<span style="display:inline-block;border:1px solid rgba(255,255,255,.16);padding:3px 7px;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--silver)">${txt}</span>`;
    const renderEventCard = (e, sectionLabel) => `
      <div class="card" style="margin-bottom:12px;cursor:pointer" onclick="openVpEventDetail(${Number(e.id)})">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px">
          <div>
            <div style="font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:4px">${new Date(e.event_date).toLocaleDateString()} · ${e.venue || e.location || e.scope || "TBD Location"}</div>
            <div style="font-family:var(--font-display);font-size:24px;color:var(--white);margin-bottom:6px">${e.name}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              ${tagChip(e.event_type || "Event")}
              ${tagChip(sectionLabel)}
            </div>
          </div>
          <div style="text-align:right">
            <div style="font-family:var(--font-display);font-size:34px;color:var(--white);line-height:1">${Math.max(0, Number(e.progress || 0))}%</div>
            <div style="font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:var(--silver)">Complete</div>
          </div>
        </div>
        <div class="progress-bar" style="margin:12px 0 10px"><div class="progress-fill" style="width:${Math.max(0, Number(e.progress || 0))}%"></div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div style="padding:10px;background:rgba(122,152,212,.08);border:1px solid rgba(123,163,212,.22)">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:.15em;color:var(--gold);margin-bottom:4px">Your Tasks</div>
            <div style="font-family:var(--font-display);font-size:22px;color:var(--white)">${(dashboard.tasks || []).filter((t) => Number(t.event_id) === Number(e.id)).length}</div>
          </div>
          <div style="padding:10px;background:rgba(76,175,125,.08);border:1px solid rgba(76,175,125,.22)">
            <div style="font-size:9px;text-transform:uppercase;letter-spacing:.15em;color:var(--green);margin-bottom:4px">Done</div>
            <div style="font-family:var(--font-display);font-size:22px;color:var(--green)">${(dashboard.tasks || []).filter((t) => Number(t.event_id) === Number(e.id) && String(t.status) === "completed").length}</div>
          </div>
        </div>
      </div>
    `;
    const eventHtml = `
      <div class="card">
        <div class="section-label">Current</div>
        <div class="card-title" style="margin-bottom:10px">Current Events</div>
        ${currentEvents.length ? currentEvents.map((e) => renderEventCard(e, "Current")).join("") : '<div style="color:var(--silver);font-size:13px;padding:8px 0">No current events.</div>'}
      </div>
      <div class="card">
        <div class="section-label">Past</div>
        <div class="card-title" style="margin-bottom:10px">Past Events</div>
        ${pastEvents.length ? pastEvents.map((e) => renderEventCard(e, "Past")).join("") : '<div style="color:var(--silver);font-size:13px;padding:8px 0">No past events.</div>'}
      </div>
    `;
    const eventsList = document.getElementById("events-list");
    const overviewEvents = document.getElementById("overview-events");
    if (eventsList) eventsList.innerHTML = eventHtml;
    if (overviewEvents) overviewEvents.innerHTML = currentEvents.slice(0, 3).map((e) => renderEventCard(e, "Current")).join("") || '<div style="color:var(--silver);font-size:13px;padding:8px 0">No current events.</div>';

    const memberBuckets = {};
    dashboard.tasks.forEach((t) => {
      const key = t.owner_email || t.owner_name || "unknown";
      if (!memberBuckets[key]) {
        memberBuckets[key] = {
          name: t.owner_name || "Unassigned",
          role: t.owner_role || "",
          active: 0,
          done: 0,
          total: 0
        };
      }
      memberBuckets[key].total += 1;
      if (["current", "locked", "pending_review", "redo"].includes(t.status)) memberBuckets[key].active += 1;
      if (t.status === "completed") memberBuckets[key].done += 1;
    });
    const members = Object.values(memberBuckets);
    const snapshot = document.getElementById("member-snapshot");
    if (snapshot) {
      snapshot.innerHTML = members.length
        ? members
            .map((m) => {
              const pct = Math.round((m.active / Math.max(1, m.total)) * 100);
              const c = pct >= 90 ? "wl-over" : pct >= 70 ? "wl-warn" : "wl-ok";
              return `<div class="card-sm">
                <div style="font-size:15px;font-family:var(--font-display);color:var(--white)">${m.name}</div>
                <div style="font-size:10px;color:var(--silver);margin-bottom:8px">${m.role || "Board Member"}</div>
                <div style="font-size:10px;color:var(--silver);margin-bottom:6px">${m.active} active / ${m.total} total</div>
                <div class="wl-bar"><div class="wl-fill ${c}" style="width:${pct}%"></div></div>
              </div>`;
            })
            .join("")
        : '<div style="color:var(--silver);font-size:13px">No division members in current task scope.</div>';
    }

    const memberCards = document.getElementById("member-cards");
    if (memberCards) {
      memberCards.innerHTML = snapshot ? snapshot.innerHTML : "";
    }

    const workloadBars = document.getElementById("workload-bars");
    if (workloadBars) {
      workloadBars.innerHTML = members
        .map((m) => {
          const pct = Math.round((m.active / Math.max(1, m.total)) * 100);
          const c = pct >= 90 ? "wl-over" : pct >= 70 ? "wl-warn" : "wl-ok";
          return `<div style="background:var(--navy-light);padding:14px;border:1px solid rgba(255,255,255,.05);margin-bottom:6px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <div><span style="font-size:13px;color:var(--white)">${m.name}</span></div>
              <span style="color:var(--silver)">${m.active}/${m.total}</span>
            </div>
            <div class="wl-bar"><div class="wl-fill ${c}" style="width:${pct}%"></div></div>
          </div>`;
        })
        .join("");
    }

    const perfMembers = document.getElementById("perf-members");
    if (perfMembers) {
      perfMembers.innerHTML = members
        .map((m) => {
          const rate = Math.round((m.done / Math.max(1, m.total)) * 100);
          return `<div class="perf-row">
            <div><div style="font-size:12px;color:var(--white)">${m.name}</div><div style="font-size:10px;color:var(--silver)">${m.role || "Board Member"}</div></div>
            <div style="text-align:right"><div style="font-size:13px;color:${rate>=85?'var(--green)':rate>=70?'var(--amber)':'var(--red)'}">${rate}%</div><div style="font-size:9px;color:var(--silver)">completion</div></div>
          </div>`;
        })
        .join("") || '<div style="color:var(--silver);font-size:13px">No performance data.</div>';
    }
    const perfRedo = document.getElementById("perf-redo");
    if (perfRedo) {
      const redos = dashboard.tasks.filter((t) => t.status === "redo").slice(0, 8);
      perfRedo.innerHTML = redos.length
        ? redos.map((t) => `<div style="font-size:12px;color:var(--silver);padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)">${t.title} · ${t.owner_name}</div>`).join("")
        : '<div style="font-size:12px;color:var(--silver)">No redo requests in current scope.</div>';
    }

    renderOperationalCalendar(document.getElementById("cal-content"), dashboard.events, dashboard.tasks);
    window.VP_DASHBOARD = dashboard;
    maybeAutoOpenVpTour();
    const events = dashboard.events || [];
    const vpDepSelect = document.getElementById("vp-dep-event-select");
    const vpDepName = document.getElementById("vp-dep-event-name");
    const vpDepDropdown = document.getElementById("vp-dep-event-dropdown");
    if (vpDepSelect) vpDepSelect.value = "";
    if (vpDepName) vpDepName.textContent = "All events";
    if (vpDepDropdown) {
      vpDepDropdown.innerHTML = "<div class=\"dep-event-opt\" data-value=\"\" onclick=\"pickVpDepEvent('')\">All events</div>" +
        events.map((e) => `<div class="dep-event-opt" data-value="${e.id}" onclick="pickVpDepEvent('${e.id}')">${(e.name || '').replace(/"/g, '&quot;')}</div>`).join("");
    }
    let deps = dashboard.dependencies || [];
    const depTaskIds = new Set();
    deps.forEach((d) => { depTaskIds.add(d.task_id); depTaskIds.add(d.depends_on_task_id); });
    let tasksWithDeps = (dashboard.tasks || []).filter((t) => depTaskIds.has(t.id));
    const eventIdVal = vpDepSelect ? vpDepSelect.value : null;
    if (eventIdVal) {
      const eid = Number(eventIdVal);
      tasksWithDeps = tasksWithDeps.filter((t) => Number(t.event_id) === eid);
      const taskIds = new Set(tasksWithDeps.map((t) => t.id));
      deps = deps.filter((d) => taskIds.has(d.task_id) && taskIds.has(d.depends_on_task_id));
    }
    renderDependencyGraph(document.getElementById("dep-graph"), tasksWithDeps, deps);
    } finally {
      hydrateBusy = false;
    }
  }
  window.setVpDepEvent = function setVpDepEvent(eventIdVal) {
    const dash = window.VP_DASHBOARD;
    if (!dash || !dash.tasks) return;
    const eventId = eventIdVal ? Number(eventIdVal) : null;
    const sel = document.getElementById("vp-dep-event-select");
    const nameEl = document.getElementById("vp-dep-event-name");
    if (sel) sel.value = eventId != null ? String(eventId) : "";
    const events = dash.events || [];
    const ev = eventId ? events.find((e) => Number(e.id) === eventId) : null;
    if (nameEl) nameEl.textContent = ev ? ev.name : "All events";
    let tasks = dash.tasks || [];
    let deps = dash.dependencies || [];
    if (eventId) {
      tasks = tasks.filter((t) => Number(t.event_id) === eventId);
      const taskIds = new Set(tasks.map((t) => t.id));
      deps = deps.filter((d) => taskIds.has(d.task_id) && taskIds.has(d.depends_on_task_id));
    } else {
      const depTaskIds = new Set();
      deps.forEach((d) => { depTaskIds.add(d.task_id); depTaskIds.add(d.depends_on_task_id); });
      tasks = tasks.filter((t) => depTaskIds.has(t.id));
    }
    const g = document.getElementById("dep-graph");
    if (g && typeof renderDependencyGraph === "function") renderDependencyGraph(g, tasks, deps);
  };
  window.toggleVpDepEventDropdown = function() {
    const wrap = document.getElementById("vp-dep-picker-wrap");
    if (wrap) wrap.classList.toggle("open");
  };
  window.pickVpDepEvent = function(value) {
    const wrap = document.getElementById("vp-dep-picker-wrap");
    if (wrap) wrap.classList.remove("open");
    setVpDepEvent(value || null);
  };

  async function renderSuggestionsBox() {
    const list = document.getElementById("suggestions-list");
    if (!list) return;
    list.innerHTML = '<div style="color:var(--silver);padding:16px">Loading…</div>';
    try {
      const data = await apiGet("/api/suggestions");
      const suggestions = data.suggestions || [];
      list.innerHTML =
        suggestions.length === 0
          ? '<div style="color:var(--silver);font-size:13px;padding:16px">No suggestions yet.</div>'
          : suggestions
              .map(
                (s) => `
        <div class="approval-item" style="margin-bottom:12px">
          <div class="approval-header">
            <div>
              <div class="approval-task">${(s.submitter_name || "Anonymous").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
              <div class="approval-by">${String(s.suggestion_type || "").replace(/</g, "&lt;")} · ${String(s.audience || "—").replace(/</g, "&lt;")} · ${String(s.status || "new").replace(/</g, "&lt;")}</div>
            </div>
          </div>
          <div style="font-size:12px;color:var(--silver);margin-top:6px;white-space:pre-wrap">${String(s.idea_text || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
          <div style="font-size:10px;color:var(--silver);margin-top:4px">${new Date(s.created_at).toLocaleString()}</div>
        </div>
      `
              )
              .join("");
    } catch (e) {
      list.innerHTML = '<div style="color:var(--red);font-size:13px;padding:16px">Could not load suggestions.</div>';
    }
  }

  async function renderReportsBox() {
    const list = document.getElementById("reports-list");
    const badge = document.getElementById("reports-badge");
    if (!list) return;
    list.innerHTML = '<div style="color:var(--silver);padding:16px">Loading…</div>';
    try {
      if (!dashboard) dashboard = await apiGet("/api/dashboard");
      const data = await apiGet("/api/notifications");
      const items = data.items || [];
      if (badge) {
        badge.textContent = String(items.length);
        badge.style.display = items.length ? "inline-flex" : "none";
      }
      list.innerHTML =
        items.length === 0
          ? '<div style="color:var(--silver);font-size:13px;padding:16px">No notifications for your division right now.</div>'
          : items
              .map(
                (i) => `
        <div class="approval-item" style="margin-bottom:12px;border-left:3px solid ${i.type === "overdue" ? "var(--red)" : i.type === "pending_review" ? "var(--blue)" : i.type === "escalation_vp" || i.type === "escalation_president" ? "var(--amber)" : i.type === "remind_assignee" ? "var(--gold)" : "var(--silver)"}">
          <div class="approval-header">
            <div>
              <div class="approval-task">${String(i.title || "").replace(/</g, "&lt;")}</div>
              <div class="approval-by">${String(i.sub || "").replace(/</g, "&lt;")}</div>
            </div>
          </div>
          <div style="font-size:10px;color:var(--silver);margin-top:4px">${i.at ? new Date(i.at).toLocaleString() : ""}</div>
        </div>
      `
              )
              .join("");
    } catch (e) {
      list.innerHTML = '<div style="color:var(--red);font-size:13px;padding:16px">Could not load notifications.</div>';
      if (badge) badge.style.display = "none";
    }
    const boardList = document.getElementById("vp-board-reports-list");
    if (boardList && dashboard && Array.isArray(dashboard.reports)) {
      const fromBoard = dashboard.reports.filter((r) => r.escalated_to === "vp");
      boardList.innerHTML = fromBoard.length
        ? fromBoard
            .map(
              (r) => {
                const meta = `${r.event_name || "No event"}${r.task_title ? " · " + r.task_title : ""} · ${r.created_at ? new Date(r.created_at).toLocaleString() : ""}`;
                return `<div class="approval-item">
                  <div class="approval-header">
                    <div>
                      <div class="approval-task">${(r.reason || "").replace(/</g, "&lt;")}</div>
                      <div class="approval-by">${(r.submitted_by_name || "").replace(/</g, "&lt;")} · ${(r.submitted_by_role || "").replace(/</g, "&lt;")}</div>
                      <div style="font-size:11px;color:var(--silver);margin-top:6px">${(r.notes || "").replace(/</g, "&lt;")}</div>
                      <div style="font-size:10px;color:var(--gold);margin-top:6px">${meta.replace(/</g, "&lt;")}</div>
                    </div>
                    <div class="approval-actions">
                      <button type="button" class="btn btn-red" style="font-size:9px;padding:5px 10px" onclick="vpUpdateReportStatus(${r.id}, 'archived')">Archive</button>
                    </div>
                  </div>
                </div>`;
              }
            )
            .join("")
        : '<div style="font-size:13px;color:var(--silver);padding:12px">No reports from board members yet.</div>';
    } else if (boardList) {
      boardList.innerHTML = '<div style="font-size:13px;color:var(--silver);padding:12px">No reports from board members yet.</div>';
    }
  }

  window.vpUpdateReportStatus = async function vpUpdateReportStatus(reportId, status) {
    try {
      await apiPatch(`/api/reports/${reportId}`, { status });
      showToast("Report updated.");
      await hydrate();
      renderReportsBox();
    } catch (_e) {
      showToast("Unable to update report.");
    }
  };

  window.openVpEventDetail = function openVpEventDetail(eventId) {
    const event = (dashboard?.events || []).find((e) => Number(e.id) === Number(eventId));
    if (!event) return;
    const tasks = (dashboard?.tasks || []).filter((t) => Number(t.event_id) === Number(event.id));
    const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const kv = (label, value) => `<div class="info-block"><div class="info-label">${label}</div><div class="info-val">${value || "—"}</div></div>`;
    const body = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <span class="event-meta-tag">${(Number(event.progress || 0) >= 100 || String(event.status || "").toLowerCase() === "completed" || (Number.isFinite(new Date(event.event_date).getTime()) && new Date(event.event_date).getTime() < Date.now())) ? "Past" : "Current"}</span>
        <span class="event-meta-tag">${esc(event.event_type || "Event")}</span>
        <span class="event-meta-tag">${Number(event.progress || 0)}% Complete</span>
      </div>
      ${kv("Date", esc(new Date(event.event_date).toLocaleDateString()))}
      ${kv("Venue", esc(event.venue || ""))}
      ${kv("Location", esc(event.location || ""))}
      ${kv("Scope", esc(event.scope || ""))}
      ${kv("Budget", event.budget_limit != null && event.budget_limit !== "" ? `$${Number(event.budget_limit).toLocaleString()}` : "—")}
      ${kv("Description", esc(event.description || event.planning_notes || ""))}
      ${kv("Timeline Assumptions", esc(event.timeline_assumptions || ""))}
      ${event.hard_deadline ? kv("Hard Deadline", esc(new Date(event.hard_deadline).toLocaleDateString())) : ""}
      <div class="info-block"><div class="info-label">Workflow</div><div class="info-val"><pre style="white-space:pre-wrap;margin:0">${esc(JSON.stringify(event.workflow_json || [], null, 2))}</pre></div></div>
      <div class="info-block"><div class="info-label">Divisions</div><div class="info-val">${esc((event.divisions_json || []).join(", ")) || "—"}</div></div>
      <div class="info-block"><div class="info-label">Roles</div><div class="info-val">${esc((event.roles_json || []).join(", ")) || "—"}</div></div>
      <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--silver);margin:12px 0 8px">All Tasks for This Event</div>
      <div class="task-list">${tasks.map(asTaskCard).join("") || '<div style="color:var(--silver);font-size:12px">No tasks linked to this event.</div>'}</div>
    `;
    const titleEl = document.getElementById("vp-event-detail-title");
    const bodyEl = document.getElementById("vp-event-detail-body");
    const editBtn = document.getElementById("vp-event-detail-edit-btn");
    const delBtn = document.getElementById("vp-event-detail-delete-btn");
    if (titleEl) titleEl.textContent = event.name || "Event Detail";
    if (bodyEl) bodyEl.innerHTML = body;
    if (editBtn) {
      editBtn.style.display = "";
      editBtn.onclick = () => {
        closeModal("vpEventDetailModal");
        editEventLive(event.id, event.name || "");
      };
    }
    if (delBtn) {
      delBtn.style.display = "";
      delBtn.onclick = () => {
        closeModal("vpEventDetailModal");
        deleteEventLive(event.id);
      };
    }
    openModal("vpEventDetailModal");
  };

  // ── Newsletter editor (same as president; Director of Operations + president only)
  var presidentNewsletters = [];
  var newsletterImageInput = null;
  window.loadNewsletterPage = async function loadNewsletterPage() {
    var listEl = document.getElementById("newsletter-editor-list");
    var statusEl = document.getElementById("newsletter-save-status");
    if (statusEl) statusEl.textContent = "";
    try {
      var res = await fetch("/api/public/site-content");
      var data = res.ok ? await res.json() : {};
      presidentNewsletters = Array.isArray(data.newsletters) ? data.newsletters.slice() : [];
    } catch (_e) {
      presidentNewsletters = [];
    }
    renderNewsletterEditorList();
    renderNewsletterPreview();
  };
  function renderNewsletterPreview() {
    var wrap = document.getElementById("newsletter-preview-wrap");
    if (!wrap) return;
    if (presidentNewsletters.length === 0) {
      wrap.innerHTML = "<p style=\"font-size:12px;color:var(--silver)\">No newsletter entries yet. Add entries below to see the preview.</p>";
      return;
    }
    var baseUrl = window.location.origin + (window.location.pathname.replace(/\/[^/]*$/, "") || "") + "/";
    wrap.innerHTML = presidentNewsletters
      .map(function (n) {
        var imgSrc = n.image ? (n.image.startsWith("/") ? window.location.origin + n.image : baseUrl + n.image) : "";
        if (imgSrc && n._ts) imgSrc += "?t=" + n._ts;
        var desc = (n.description || "").slice(0, 280);
        if ((n.description || "").length > 280) desc += "…";
        desc = desc.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;").replace(/\n/g, "<br />");
        var title = (n.title || "").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        var date = (n.date || "").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        return (
          '<div style="background:var(--navy);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px;display:grid;grid-template-columns:min(180px,100%) 1fr;gap:20px;align-items:start">' +
          (imgSrc
            ? '<div style="aspect-ratio:4/5;border-radius:8px;overflow:hidden;background:var(--navy-light)"><img src="' + imgSrc + '" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.display=\'none\'" /></div>'
            : '<div style="aspect-ratio:4/5;border-radius:8px;background:var(--navy-light);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--silver)">No image</div>') +
          '<div><div style="font-family:var(--font-display);font-size:20px;color:var(--white);margin-bottom:4px">' +
          title +
          "</div>" +
          '<div style="font-size:11px;color:var(--gold-light);letter-spacing:.08em;margin-bottom:10px">' +
          date +
          "</div>" +
          '<p style="font-size:13px;color:var(--stone);line-height:1.6;margin-bottom:0">' +
          desc +
          "</p></div></div>"
        );
      })
      .join("");
  }
  window.openNewsletterFullView = function openNewsletterFullView() {
    var body = document.getElementById("newsletter-full-modal-body");
    var modal = document.getElementById("newsletter-full-modal");
    if (!body || !modal) return;
    if (presidentNewsletters.length === 0) {
      body.innerHTML = "<p style=\"font-size:13px;color:var(--silver)\">No newsletter entries to show.</p>";
      modal.classList.add("open");
      return;
    }
    var baseUrl = window.location.origin + (window.location.pathname.replace(/\/[^/]*$/, "") || "") + "/";
    body.innerHTML = presidentNewsletters
      .map(function (n) {
        var imgSrc = n.image ? (n.image.startsWith("/") ? window.location.origin + n.image : baseUrl + n.image) : "";
        var desc = (n.description || "").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;").replace(/\n/g, "<br />");
        var title = (n.title || "").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        var date = (n.date || "").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&/g, "&amp;").replace(/"/g, "&quot;");
        return (
          '<div style="background:var(--navy);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:24px;margin-bottom:20px">' +
          '<div style="font-family:var(--font-display);font-size:22px;color:var(--white);margin-bottom:6px">' + title + "</div>" +
          '<div style="font-size:11px;color:var(--gold-light);letter-spacing:.08em;margin-bottom:16px">' + date + "</div>" +
          (imgSrc
            ? '<div style="margin-bottom:16px;border-radius:8px;overflow:hidden;max-width:100%"><img src="' + imgSrc + '" alt="" style="width:100%;max-width:400px;height:auto;display:block" onerror="this.parentElement.style.display=\'none\'" /></div>'
            : "") +
          '<div style="font-size:14px;color:var(--stone);line-height:1.7">' + desc + "</div></div>"
        );
      })
      .join("");
    modal.classList.add("open");
  };
  function renderNewsletterEditorList() {
    var listEl = document.getElementById("newsletter-editor-list");
    if (!listEl) return;
    if (presidentNewsletters.length === 0) {
      listEl.innerHTML = '<p style="font-size:12px;color:var(--silver)">No newsletter entries yet. Click "Add newsletter entry" to create one.</p>';
      return;
    }
    var baseUrl = window.location.origin + (window.location.pathname.replace(/\/[^/]*$/, "") || "") + "/";
    var html = presidentNewsletters
      .map(function (n, i) {
        var id = (n.id || "").replace(/"/g, "&quot;");
        var title = (n.title || "").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        var date = (n.date || "").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        var desc = n.description || "";
        var descAttr = desc.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        var image = (n.image || "").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        var link = (n.link || "").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        var sec = (n.secondaryLink || "").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        var imgSrc = image ? (image.startsWith("/") ? window.location.origin + image : baseUrl + image) : "";
        if (imgSrc && n._ts) imgSrc += "?t=" + n._ts;
        return (
          '<div class="newsletter-editor-card" data-index="' +
          i +
          '" style="background:var(--navy-light);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:20px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
          '<span style="font-size:11px;letter-spacing:.1em;color:var(--gold);">Entry ' +
          (i + 1) +
          "</span>" +
          '<button type="button" class="btn btn-outline" style="padding:4px 10px;font-size:10px" onclick="newsletterRemoveEntry(' + i + ')">Remove</button>' +
          "</div>" +
          '<div class="fg" style="margin-bottom:10px"><label>Title</label><input type="text" data-nl-field="title" value="' + title + '" placeholder="e.g. February Newsletter" style="background:var(--navy);border:1px solid rgba(255,255,255,.12);padding:10px 12px;border-radius:8px;color:var(--white);font-size:13px;width:100%" /></div>' +
          '<div class="fg" style="margin-bottom:10px"><label>Date</label><input type="text" data-nl-field="date" value="' + date + '" placeholder="e.g. February 2026" style="background:var(--navy);border:1px solid rgba(255,255,255,.12);padding:10px 12px;border-radius:8px;color:var(--white);font-size:13px;width:100%" /></div>' +
          '<div class="fg" style="margin-bottom:10px"><label>Description</label><textarea data-nl-field="description" data-value="' + descAttr + '" rows="4" placeholder="Newsletter body text..." style="background:var(--navy);border:1px solid rgba(255,255,255,.12);padding:10px 12px;border-radius:8px;color:var(--white);font-size:13px;width:100%;resize:vertical"></textarea></div>' +
          (imgSrc ? '<div style="margin-bottom:10px"><img src="' + imgSrc + '" alt="" style="max-width:200px;max-height:120px;object-fit:contain;border-radius:8px" onerror="this.style.display=\'none\'" /></div>' : "") +
          '<div style="margin-bottom:10px"><button type="button" class="btn btn-outline" style="padding:6px 12px;font-size:11px" onclick="newsletterUploadImage(' + i + ')">Upload new image</button></div>' +
          '<div class="fg" style="margin-bottom:10px"><label>Primary link (e.g. Instagram)</label><input type="url" data-nl-field="link" value="' + link + '" placeholder="https://..." style="background:var(--navy);border:1px solid rgba(255,255,255,.12);padding:10px 12px;border-radius:8px;color:var(--white);font-size:13px;width:100%" /></div>' +
          '<div class="fg" style="margin-bottom:0"><label>Secondary link (optional)</label><input type="url" data-nl-field="secondaryLink" value="' + sec + '" placeholder="https://..." style="background:var(--navy);border:1px solid rgba(255,255,255,.12);padding:10px 12px;border-radius:8px;color:var(--white);font-size:13px;width:100%" /></div>' +
          "</div>"
        );
      })
      .join("");
    listEl.innerHTML = html;
    listEl.querySelectorAll('textarea[data-nl-field="description"]').forEach(function (ta) {
      ta.value = ta.getAttribute("data-value") || "";
      ta.removeAttribute("data-value");
    });
  }
  window.newsletterUploadImage = function newsletterUploadImage(index) {
    newsletterImageInput = newsletterImageInput || document.createElement("input");
    newsletterImageInput.type = "file";
    newsletterImageInput.accept = "image/*";
    newsletterImageInput.setAttribute("data-nl-upload-index", String(index));
    newsletterImageInput.onchange = function () {
      var file = newsletterImageInput.files && newsletterImageInput.files[0];
      if (!file) return;
      var idx = parseInt(newsletterImageInput.getAttribute("data-nl-upload-index"), 10);
      var token = typeof getSessionToken === "function" ? getSessionToken() : "";
      if (!token) { showToast("You must be logged in."); return; }
      var fd = new FormData();
      fd.append("photo", file);
      fetch("/api/site/newsletter-image", { method: "POST", headers: { "x-session-token": token }, body: fd })
        .then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (data) {
          if (data.path && presidentNewsletters[idx]) {
            presidentNewsletters[idx].image = data.path;
            presidentNewsletters[idx]._ts = Date.now();
            renderNewsletterEditorList();
            renderNewsletterPreview();
            showToast("Image uploaded.");
          } else showToast(data.error || "Upload failed");
        })
        .catch(function () { showToast("Upload failed"); });
      newsletterImageInput.value = "";
    };
    newsletterImageInput.click();
  };
  window.newsletterAddEntry = function newsletterAddEntry() {
    presidentNewsletters.push({
      id: "nl-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9),
      title: "",
      date: "",
      description: "",
      image: "",
      link: "",
      secondaryLink: ""
    });
    renderNewsletterEditorList();
  };
  window.newsletterRemoveEntry = function newsletterRemoveEntry(index) {
    presidentNewsletters.splice(index, 1);
    renderNewsletterEditorList();
  };
  window.newsletterSave = async function newsletterSave() {
    var listEl = document.getElementById("newsletter-editor-list");
    var statusEl = document.getElementById("newsletter-save-status");
    if (!listEl) return;
    var cards = listEl.querySelectorAll(".newsletter-editor-card");
    var payload = [];
    cards.forEach(function (card) {
      var i = card.getAttribute("data-index");
      var entry = presidentNewsletters[parseInt(i, 10)];
      if (!entry) return;
      var titleIn = card.querySelector('[data-nl-field="title"]');
      var dateIn = card.querySelector('[data-nl-field="date"]');
      var descIn = card.querySelector('[data-nl-field="description"]');
      var linkIn = card.querySelector('[data-nl-field="link"]');
      var secIn = card.querySelector('[data-nl-field="secondaryLink"]');
      payload.push({
        id: entry.id,
        title: titleIn ? titleIn.value.trim() : "",
        date: dateIn ? dateIn.value.trim() : "",
        description: descIn ? descIn.value.trim() : "",
        image: entry.image || "newsletter-images/newsletter.png",
        link: linkIn ? linkIn.value.trim() : "",
        secondaryLink: secIn ? secIn.value.trim() : ""
      });
    });
    var token = typeof getSessionToken === "function" ? getSessionToken() : "";
    if (!token) { showToast("You must be logged in."); return; }
    if (statusEl) statusEl.textContent = "Saving…";
    try {
      var res = await fetch("/api/site/newsletters", {
        method: "PUT",
        headers: { "x-session-token": token, "Content-Type": "application/json" },
        body: JSON.stringify({ newsletters: payload })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || "Save failed");
      presidentNewsletters = Array.isArray(data.newsletters) ? data.newsletters : payload;
      if (statusEl) statusEl.textContent = "Saved.";
      renderNewsletterPreview();
      showToast("Newsletters saved.");
    } catch (e) {
      if (statusEl) statusEl.textContent = "";
      showToast(e.message || "Save failed");
    }
  };
  window.newsletterPushToGitHub = async function newsletterPushToGitHub() {
    var token = typeof getSessionToken === "function" ? getSessionToken() : "";
    if (!token) { showToast("You must be logged in."); return; }
    var listEl = document.getElementById("newsletter-editor-list");
    if (!listEl) return;
    var cards = listEl.querySelectorAll(".newsletter-editor-card");
    var payload = [];
    cards.forEach(function (card) {
      var i = card.getAttribute("data-index");
      var entry = presidentNewsletters[parseInt(i, 10)];
      if (!entry) return;
      var titleIn = card.querySelector('[data-nl-field="title"]');
      var dateIn = card.querySelector('[data-nl-field="date"]');
      var descIn = card.querySelector('[data-nl-field="description"]');
      var linkIn = card.querySelector('[data-nl-field="link"]');
      var secIn = card.querySelector('[data-nl-field="secondaryLink"]');
      payload.push({
        id: entry.id,
        title: titleIn ? titleIn.value.trim() : "",
        date: dateIn ? dateIn.value.trim() : "",
        description: descIn ? descIn.value.trim() : "",
        image: entry.image || "newsletter-images/newsletter.png",
        link: linkIn ? linkIn.value.trim() : "",
        secondaryLink: secIn ? secIn.value.trim() : ""
      });
    });
    var statusEl = document.getElementById("newsletter-push-status");
    if (statusEl) statusEl.textContent = "Pushing…";
    try {
      var res = await fetch("/api/site/push-newsletter", {
        method: "POST",
        headers: { "x-session-token": token, "Content-Type": "application/json" },
        body: JSON.stringify({ newsletters: payload })
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(data.error || "Push failed");
      if (statusEl) statusEl.textContent = data.message || "Pushed to GitHub.";
      showToast(data.message || "Newsletter pushed to GitHub.");
    } catch (e) {
      if (statusEl) statusEl.textContent = "";
      showToast(e.message || "Push failed");
    }
  };

  const origShowPage = window.showPage;
  window.showPage = function (id) {
    if (typeof origShowPage === "function") origShowPage(id);
    if (id === "suggestions") renderSuggestionsBox();
    if (id === "reports") renderReportsBox();
    if (id === "escalate" && typeof vpEscInitSev === "function") vpEscInitSev();
    if (id === "newsletter" && typeof loadNewsletterPage === "function") loadNewsletterPage();
  };

  window.approveTaskLive = async function approveTaskLive(taskId) {
    await apiPost(`/api/tasks/${taskId}/approve`, {});
    showToast("Task approved.");
    await hydrate();
  };
  window.redoTaskLive = async function redoTaskLive(taskId) {
    // Use the same frictionless redo modal everywhere.
    openRedoModal(taskId);
  };
  window.updateSuggestions = async function updateSuggestionsLive() {
    selectedAssigneeEmail = "";
    const role = document.getElementById("assign-role")?.value || "";
    const root = document.getElementById("assign-suggestions");
    if (!root) return;
    if (!role) {
      root.innerHTML =
        '<div style="font-size:13px;color:var(--silver);text-align:center;padding:32px 0;opacity:.5">Select a role to see suggestions</div>';
      return;
    }
    const suggestions = await apiGet(`/api/assign/suggestions?role=${encodeURIComponent(role)}`);
    if (!root) return;
    root.innerHTML = (suggestions.suggestions || [])
      .map(
        (m, i) => `
      <div class="assign-suggestion">
        <div class="assign-rank">${i + 1}</div>
        <div style="flex:1">
          <div class="assign-name">${m.full_name}</div>
          <div class="assign-reason">${m.role_title} · active ${m.activeCount}</div>
          <div style="font-size:10px;color:var(--silver);margin-top:2px">${m.email}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <div class="assign-load">${m.score}</div>
          <button class="btn btn-outline" style="font-size:9px;padding:4px 10px" onclick="selectAssignee('${m.email}')">Select</button>
        </div>
      </div>`
      )
      .join("") || '<div style="font-size:13px;color:var(--silver);padding:8px 0">No users found in DB for that role and scope.</div>';
  };

  window.selectAssignee = function selectAssigneeLive(email) {
    selectedAssigneeEmail = String(email || "").trim().toLowerCase();
    showToast(`Selected ${selectedAssigneeEmail}`);
  };

  window.assignTask = async function assignTaskLive() {
    const title = document.getElementById("assign-task-title")?.value?.trim() || "";
    const role = document.getElementById("assign-role")?.value?.trim() || "";
    const dueDate = document.getElementById("assign-due")?.value || "";
    const priority = document.getElementById("assign-priority")?.value || "standard";
    const eventId = document.getElementById("assign-event")?.value || "";
    const description =
      document.getElementById("assign-description")?.value?.trim() || "Assigned by division admin.";
    const dependency_task_ids = [...document.querySelectorAll("#assign-dependencies input:checked")].map((el) => Number(el.value));
    if (!title || !role) {
      showToast("Fill at least task title and role.");
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
      const meetingLink = document.getElementById("assign-meeting-link")?.value?.trim() || "";
    await apiPost("/api/tasks/assign", {
        title,
        role,
        due_at: dueAt.toISOString(),
        priority,
        description,
        assignee_email: selectedAssigneeEmail || undefined,
        event_id: eventId || undefined,
        unlock_at: new Date(0).toISOString(),
        meeting_link: meetingLink || undefined,
        dependency_task_ids
      });
      showToast("Task assigned.");
      document.getElementById("assign-task-title").value = "";
      document.getElementById("assign-description").value = "";
      document.getElementById("assign-due").value = "";
      if (document.getElementById("assign-event")) document.getElementById("assign-event").value = "";
      document.querySelectorAll("#assign-dependencies input").forEach((el) => { el.checked = false; });
      if (typeof updateAssignDescriptionHint === "function") updateAssignDescriptionHint();
      selectedAssigneeEmail = "";
      await hydrate();
      await window.updateSuggestions();
    } catch (error) {
      showToast(String(error?.message || "Unable to assign task."));
    }
  };

  window.vpSetEditStatus = function vpSetEditStatus(el) {
    if (!el) return;
    const s = el.getAttribute("data-s") || "current";
    document.getElementById("vp-edit-task-status").value = s;
    document.querySelectorAll("#vp-edit-task-status-grid .st-btn").forEach((b) => b.classList.remove("active"));
    el.classList.add("active");
  };

  window.vpSetEditPrio = function vpSetEditPrio(el) {
    if (!el) return;
    const p = el.getAttribute("data-p") || "standard";
    document.getElementById("vp-edit-task-priority").value = p;
    document.querySelectorAll("#vp-edit-task-prio-row .at-prio-btn").forEach((b) => b.classList.remove("active-urgent", "active-high", "active-standard", "active-low"));
    el.classList.add("active-" + (p === "urgent" ? "urgent" : p === "high" ? "high" : p === "low" ? "low" : "standard"));
  };

  window.vpToggleEditDep = function vpToggleEditDep(el) {
    if (!el) return;
    const cb = el.querySelector('input[type="checkbox"]');
    if (cb) { cb.checked = !cb.checked; el.classList.toggle("chk", cb.checked); }
  };

  window.vpToggleRuleBtn = function vpToggleRuleBtn(el, kind) {
    if (!el || kind !== "escalation") return;
    const rule = el.getAttribute("data-rule");
    const wrap = document.getElementById("vp-edit-task-escalation-rules-wrap");
    const hidden = document.getElementById("vp-edit-task-escalation-rules");
    if (rule === "none") {
      wrap.querySelectorAll(".rule-btn").forEach((b) => b.classList.remove("sel"));
      el.classList.add("sel");
      if (hidden) hidden.value = "none";
      return;
    }
    wrap.querySelectorAll(".rule-btn[data-rule=\"none\"]").forEach((b) => b.classList.remove("sel"));
    el.classList.toggle("sel");
    const sel = wrap ? [...wrap.querySelectorAll(".rule-btn.sel")].filter((b) => b.getAttribute("data-rule") !== "none").map((b) => b.getAttribute("data-rule")).filter(Boolean) : [];
    if (hidden) hidden.value = sel.length ? sel.join(",") : "";
  };

  window.editTaskLive = async function editTaskLive() {
    if (!inspectId) return;
    const t = (dashboard?.tasks || []).find((x) => x.id === inspectId);
    if (!t) return;
    closeModal("inspectModal");
    const divName = (dashboard?.user && dashboard.user.department) ? dashboard.user.department : (VP_CONFIG.division || "Division");
    document.getElementById("vp-edit-task-id").value = String(t.id);
    document.getElementById("vp-edit-task-id-badge").textContent = "TASK-" + String(t.id).padStart(3, "0");
    const headerSub = document.getElementById("vp-edit-task-header-sub");
    if (headerSub) headerSub.textContent = divName + " · SSA Board Platform";
    document.getElementById("vp-edit-task-title").value = t.title || "";
    document.getElementById("vp-edit-task-role").value = t.owner_role || "";
    document.getElementById("vp-edit-task-division").value = t.department || "";
    document.getElementById("vp-edit-task-description").value = t.description || "";
    document.getElementById("vp-edit-task-priority").value = t.priority || "standard";
    document.getElementById("vp-edit-task-status").value = t.status || "current";
    document.getElementById("vp-edit-task-unlock").value = t.unlock_at ? new Date(t.unlock_at).toISOString().slice(0,16) : "";
    document.getElementById("vp-edit-task-due").value = t.due_at ? new Date(t.due_at).toISOString().slice(0,16) : "";
    document.getElementById("vp-edit-task-meeting-link").value = t.meeting_link || "";
    document.querySelectorAll("#vp-edit-task-status-grid .st-btn").forEach((b) => { b.classList.toggle("active", b.getAttribute("data-s") === (t.status || "current")); });
    document.querySelectorAll("#vp-edit-task-prio-row .at-prio-btn").forEach((b) => {
      b.classList.remove("active-urgent", "active-high", "active-standard", "active-low");
      if (b.getAttribute("data-p") === (t.priority || "standard")) b.classList.add("active-" + (t.priority === "urgent" ? "urgent" : t.priority === "high" ? "high" : t.priority === "low" ? "low" : "standard"));
    });
    const eventRoot = document.getElementById("vp-edit-task-event");
    eventRoot.innerHTML = `<option value="">Standalone</option>${(dashboard?.events || [])
      .map((e) => `<option value="${e.id}">${e.name}</option>`)
      .join("")}`;
    eventRoot.value = t.event_id ? String(t.event_id) : "";
    const assigneeRoot = document.getElementById("vp-edit-task-assignee");
    assigneeRoot.innerHTML = (dashboard?.users || [])
      .map((u) => `<option value="${(u.email || "").replace(/"/g, "&quot;")}" data-role="${(u.role_title || "").replace(/"/g, "&quot;")}" data-department="${(u.department || "").replace(/"/g, "&quot;")}">${(u.full_name || "").replace(/</g, "&lt;")} · ${(u.role_title || "").replace(/</g, "&lt;")}</option>`)
      .join("");
    assigneeRoot.value = t.owner_email || "";
    assigneeRoot.onchange = function() {
      const opt = assigneeRoot.options[assigneeRoot.selectedIndex];
      if (opt) {
        document.getElementById("vp-edit-task-role").value = opt.getAttribute("data-role") || "";
        document.getElementById("vp-edit-task-division").value = opt.getAttribute("data-department") || "";
      }
    };
    const depIds = new Set((dashboard?.dependencies || []).filter((d) => d.task_id === t.id).map((d) => d.depends_on_task_id));
    function prereqStatus(task) {
      const s = (task.status || "current").toLowerCase();
      if (s === "completed") return { class: "ps-done", label: "Done" };
      if (s === "current" || s === "pending_review" || s === "redo") return { class: "ps-act", label: "In Progress" };
      return { class: "ps-lock", label: "Locked" };
    }
    const depsRoot = document.getElementById("vp-edit-task-dependencies");
    depsRoot.innerHTML = "<div style=\"font-size:12px;color:var(--silver);padding:8px 0\">Loading prerequisites (any division)…</div>";
    try {
      const data = await apiGet("/api/tasks/all-for-prereq");
      const allTasks = (data.tasks || []).filter((x) => x.id !== t.id);
      depsRoot.innerHTML = allTasks.map((x) => {
        const ps = prereqStatus(x);
        const chk = depIds.has(x.id) ? " chk" : "";
        const assigneeLine = (x.owner_name || "").replace(/</g, "&lt;") + (x.owner_role ? " · " + (x.owner_role || "").replace(/</g, "&lt;") : "");
        return `<div class="pre-item${chk}" onclick="vpToggleEditDep(this)"><div class="pre-cb"><div class="pre-cb-dot"></div></div><div><div class="pre-dept">${(x.department || x.owner_role || "—").replace(/</g, "&lt;")}</div><div class="pre-name">${(x.title || "").replace(/</g, "&lt;")}</div><div class="pre-assignee">${assigneeLine}</div></div><span class="ps ${ps.class}">${ps.label}</span><input type="checkbox" value="${x.id}" ${depIds.has(x.id) ? "checked" : ""} style="position:absolute;opacity:0;width:0;height:0;pointer-events:none" /></div>`;
      }).join("");
    } catch (_) {
      depsRoot.innerHTML = "<div style=\"font-size:12px;color:var(--silver)\">Could not load prerequisites.</div>";
    }
    openModal("vpTaskEditModal");
  };

  window.vpDeleteTaskFromEditModal = function vpDeleteTaskFromEditModal() {
    const taskId = Number(document.getElementById("vp-edit-task-id")?.value || 0);
    if (!taskId) return;
    openVpStyledConfirm("Delete this task permanently from workflow?", async () => {
      const token = getSessionToken();
      const res = await fetch("/api/tasks/" + taskId, { method: "DELETE", headers: { "x-session-token": token } });
      if (!res.ok) {
        showToast("Unable to delete task.");
        return;
      }
      closeModal("vpTaskEditModal");
      showToast("Task deleted.");
      await hydrate();
    });
  };

  window.deleteTaskLive = async function deleteTaskLive() {
    if (!inspectId) return;
    openVpStyledConfirm("Delete this task permanently from workflow?", async () => {
      const token = getSessionToken();
      const res = await fetch(`/api/tasks/${inspectId}`, {
        method: "DELETE",
        headers: { "x-session-token": token }
      });
      if (!res.ok) {
        showToast("Unable to delete task.");
        return;
      }
      closeModal("inspectModal");
      showToast("Task deleted.");
      await hydrate();
    });
  };

  window.deleteEventLive = async function deleteEventLive(eventId) {
    openVpStyledConfirm("Delete this event and related tasks?", async () => {
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
      await hydrate();
    });
  };

  window.editEventLive = async function editEventLive(eventId, currentName) {
    const event = (dashboard?.events || []).find((e) => e.id === eventId);
    if (!event) return;
    document.getElementById("vp-edit-event-id").value = String(event.id);
    document.getElementById("vp-edit-event-name").value = event.name || currentName || "";
    document.getElementById("vp-edit-event-budget").value = event.budget_limit || "";
    document.getElementById("vp-edit-event-type").value = event.event_type || "";
    document.getElementById("vp-edit-event-date").value = event.event_date ? String(event.event_date).slice(0, 10) : "";
    document.getElementById("vp-edit-event-scope").value = event.scope || "";
    document.getElementById("vp-edit-event-venue").value = event.venue || "";
    document.getElementById("vp-edit-event-location").value = event.location || "";
    document.getElementById("vp-edit-event-notes").value = event.planning_notes || "";
    document.getElementById("vp-edit-event-timeline").value = event.timeline_assumptions || "";
    document.getElementById("vp-edit-event-workflow").value = Array.isArray(event.workflow_json)
      ? event.workflow_json.join("\n")
      : event.workflow_json || "";
    openModal("vpEventEditModal");
  };

  window.vpSaveTaskEdit = window.saveVpTaskEdit = async function vpSaveTaskEdit() {
    const taskId = Number(document.getElementById("vp-edit-task-id")?.value || 0);
    if (!taskId) return;
    const meetingInput = document.getElementById("vp-edit-task-meeting-link");
    if (meetingInput && meetingInput.value && !vpValidateMeetingLink(meetingInput)) {
      showToast("Please enter a valid meeting link (Zoom, Google Meet, Teams, or Webex).");
      return;
    }
    const dependency_task_ids = [...(document.querySelectorAll("#vp-edit-task-dependencies input:checked") || [])].map((el) => Number(el.value)).filter(Boolean);
    try {
      await apiPatch(`/api/tasks/${taskId}`, {
        title: document.getElementById("vp-edit-task-title").value,
        description: document.getElementById("vp-edit-task-description").value,
        assignee_email: document.getElementById("vp-edit-task-assignee").value,
        role: document.getElementById("vp-edit-task-role").value,
        department: document.getElementById("vp-edit-task-division").value,
        event_id: document.getElementById("vp-edit-task-event").value || null,
        due_at: document.getElementById("vp-edit-task-due").value ? new Date(document.getElementById("vp-edit-task-due").value).toISOString() : null,
        unlock_at: (function() {
          const u = document.getElementById("vp-edit-task-unlock").value;
          if (u) return new Date(u).toISOString();
          return new Date(0).toISOString();
        })(),
        priority: document.getElementById("vp-edit-task-priority").value,
        status: document.getElementById("vp-edit-task-status").value,
        meeting_date: "",
        meeting_time: "",
        meeting_location: "",
        meeting_link: document.getElementById("vp-edit-task-meeting-link").value,
        notes: "",
        dependency_task_ids
      });
      closeModal("vpTaskEditModal");
      showToast("Task updated.");
      await hydrate();
    } catch (e) {
      let msg = "Unable to save task edit.";
      if (e && e.message) {
        try {
          const data = JSON.parse(e.message);
          if (data && data.error) msg = data.error;
        } catch (_) { msg = e.message; }
      }
      showToast(msg);
    }
  };

  window.saveVpEventEdit = async function saveVpEventEdit() {
    const eventId = Number(document.getElementById("vp-edit-event-id").value || 0);
    if (!eventId) return;
    try {
      const res = await apiPatch(`/api/events/${eventId}`, {
        name: document.getElementById("vp-edit-event-name").value,
        budget_limit: document.getElementById("vp-edit-event-budget").value,
        event_type: document.getElementById("vp-edit-event-type").value,
        event_date: document.getElementById("vp-edit-event-date").value,
        scope: document.getElementById("vp-edit-event-scope").value,
        venue: document.getElementById("vp-edit-event-venue").value,
        location: document.getElementById("vp-edit-event-location").value,
        planning_notes: document.getElementById("vp-edit-event-notes").value,
        timeline_assumptions: document.getElementById("vp-edit-event-timeline").value,
        workflow: parseListInput(document.getElementById("vp-edit-event-workflow").value)
      });
      closeModal("vpEventEditModal");
      showToast(res.warnings?.length ? res.warnings[0] : "Event updated.");
      await hydrate();
    } catch (_e) {
      showToast("Unable to save event edit.");
    }
  };

  window.sendEscalation = async function sendEscalationLive() {
    const reason = (document.getElementById("report-reason") && document.getElementById("report-reason").value) || "";
    const notesEl = document.getElementById("report-notes");
    const notesRaw = notesEl ? notesEl.value : "";
    if (!reason.trim() || !notesRaw.trim()) {
      showToast("Please select an issue type and provide escalation details.");
      return;
    }
    const severityPrefix = typeof vpEscCurSev !== "undefined" ? "[Severity: " + (vpEscCurSev.charAt(0).toUpperCase() + vpEscCurSev.slice(1)) + "] " : "";
    const notes = severityPrefix + notesRaw.trim();
    try {
      await apiPost("/api/reports", {
        reason: reason.trim(),
        event_id: (document.getElementById("report-event") && document.getElementById("report-event").value) || null,
        task_id: (document.getElementById("report-task") && document.getElementById("report-task").value) || null,
        notes,
        recommended_action: (document.getElementById("report-action") && document.getElementById("report-action").value) || ""
      });
      if (notesEl) notesEl.value = "";
      const actionEl = document.getElementById("report-action");
      if (actionEl) actionEl.value = "";
      const hint1 = document.getElementById("report-notes-hint");
      const hint2 = document.getElementById("report-action-hint");
      if (hint1) hint1.textContent = "0 / 800 recommended";
      if (hint2) hint2.textContent = "0 / 200 recommended";
      if (hint1) hint1.className = "esc-char-hint";
      if (hint2) hint2.className = "esc-char-hint";
      showToast("Report sent to Executive President.");
    } catch (_e) {
      showToast("Unable to send report.");
    }
  };

  window.markTaskOverdueLive = async function markTaskOverdueLive() {
    if (!inspectId) return;
    await apiPatch(`/api/tasks/${inspectId}`, { status: "overdue" });
    closeModal("inspectModal");
    showToast("Task marked overdue.");
    await hydrate();
  };

  window.markTaskOverdueById = async function markTaskOverdueById(taskId) {
    await apiPatch(`/api/tasks/${taskId}`, { status: "overdue" });
    showToast("Task marked overdue.");
    await hydrate();
  };

  window.extendTaskDeadlineLive = async function extendTaskDeadlineLive(taskId) {
    const nextDate = prompt("New due date (YYYY-MM-DD):");
    if (!nextDate) return;
    const dueAt = new Date(`${nextDate}T23:59:00`);
    if (!Number.isFinite(dueAt.getTime())) {
      showToast("Invalid date.");
      return;
    }
    await apiPatch(`/api/tasks/${taskId}`, { due_at: dueAt.toISOString(), status: "current" });
    showToast("Deadline updated.");
    await hydrate();
  };

  window.reassignOverdueTaskLive = async function reassignOverdueTaskLive(taskId) {
    const task = (dashboard?.tasks || []).find((t) => t.id === taskId);
    if (!task) return;
    const suggestions = await apiGet(`/api/assign/suggestions?role=${encodeURIComponent(task.owner_role || "")}`).catch(() => ({ suggestions: [] }));
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
    await hydrate();
  };

  await hydrate();
  setInterval(async () => {
    await hydrate();
  }, 30000);

  document.addEventListener("click", function(e) {
    const wrap = document.querySelector("#vp-dep-picker-wrap.open");
    if (wrap && !wrap.contains(e.target)) wrap.classList.remove("open");
  });
})();
