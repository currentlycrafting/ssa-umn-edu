(function () {
  "use strict";

  const state = {
    canManage: false,
    current: null,
    draftHtml: "",
    draftMode: "edit", // edit | create
    draftValidationOk: false,
    draftViewed: false
  };

  const IDS = {
    previewWrap: "newsletter-preview-wrap",
    editorList: "newsletter-editor-list",
    fullModalBody: "newsletter-full-modal-body",
    fullModal: "newsletter-full-modal",
    nlCreateModal: "nl-create-modal",
    nlGenerateLoading: "nl-generate-loading",
    nlToastStatus: "nl-status",
    // Edit flow
    editGenerate: "nl-edit-generate",
    editPreview: "nl-edit-preview",
    editPublish: "nl-edit-publish",
    editStatus: "nl-edit-status",
    // Create flow
    createGenerate: "nl-create-generate",
    createPreview: "nl-create-preview",
    createPublish: "nl-create-publish",
    createStatus: "nl-create-status"
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function toast(msg) {
    if (typeof window.showToast === "function") window.showToast(msg);
    else console.log(msg);
  }

  async function copyTextToClipboard(text) {
    const safeText = String(text ?? "");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(safeText);
        return true;
      }
    } catch (e) {
      // fall back to legacy copy approach below
    }

    // Legacy fallback: temporary textarea + execCommand.
    const ta = document.createElement("textarea");
    ta.value = safeText;
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.left = "-1000px";
    ta.setAttribute("readonly", "readonly");
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand && document.execCommand("copy");
    document.body.removeChild(ta);
    return !!ok;
  }

  function getToken() {
    if (typeof window.getSessionToken === "function") return window.getSessionToken();
    return localStorage.getItem("ssa_ops_token") || "";
  }

  async function api(url, options) {
    const headers = Object.assign({}, options && options.headers ? options.headers : {});
    const t = getToken();
    if (t) headers["x-session-token"] = t;
    const res = await fetch(url, Object.assign({}, options || {}, { headers }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  function hideLegacyControls() {
    const page = document.getElementById("page-newsletter");
    if (!page) return;

    // Remove most clutter from the legacy newsletter editor (it’s replaced by this script).
    page.querySelectorAll('button[onclick*="newsletterAddEntry"]').forEach((b) => (b.style.display = "none"));
    page.querySelectorAll('button[onclick*="newsletterPushToGitHub"]').forEach((b) => (b.style.display = "none"));
    page.querySelectorAll('button[onclick="loadNewsletterPage()"]').forEach((b) => (b.style.display = "none"));
    page.querySelectorAll('button[onclick="openNewsletterFullView()"]').forEach((b) => (b.style.display = "none"));

    // Hide noisy legacy headings; our injected UI provides clearer labels.
    page.querySelectorAll(".section-eyebrow, .section-title, .section-sub, .section-label, .card-title").forEach((el) => {
      // Keep the preview and editor containers visible.
      if (el.closest(`#${IDS.previewWrap}`) || el.closest(`#${IDS.editorList}`)) return;
      el.style.display = "none";
    });
  }

  function hideNewsletterNav() {
    const navItem = byId("sb-item-newsletter");
    if (navItem) navItem.style.display = "none";
    const sectionLabel = byId("board-newsletter-section-label");
    if (sectionLabel) sectionLabel.style.display = "none";
  }

  function showNewsletterNav() {
    const navItem = byId("sb-item-newsletter");
    if (navItem) navItem.style.display = "";
    const sectionLabel = byId("board-newsletter-section-label");
    if (sectionLabel) sectionLabel.style.display = "";
  }

  function determineModalHostClass() {
    // board.html uses .modal-backdrop, vp/president use .modal-overlay
    return document.querySelector(".modal-backdrop") ? "modal-backdrop" : "modal-overlay";
  }

  function openModal(id) {
    if (typeof window.openModal === "function") return window.openModal(id);
    const el = byId(id);
    if (el) el.classList.add("open");
  }

  function closeModal(id) {
    if (typeof window.closeModal === "function") return window.closeModal(id);
    const el = byId(id);
    if (el) el.classList.remove("open");
  }

  function renderCurrentPreview() {
    const wrap = byId(IDS.previewWrap);
    if (!wrap) return;
    const editionName = state.current?.edition_name || "Current Newsletter";
    const dateRange = state.current?.date_range || "";

    wrap.innerHTML = `
      <div style="border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.02);padding:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);">Published</div>
            <div style="font-size:22px;font-family:var(--font-display);color:var(--white)">${escapeText(editionName)}</div>
            ${dateRange ? `<div style="font-size:12px;color:var(--silver)">${escapeText(dateRange)}</div>` : ""}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <a class="btn btn-outline" href="newsletter.html" target="_blank" rel="noopener noreferrer">Public page</a>
            <button type="button" class="btn btn-outline" id="nl-preview-current-full">Preview</button>
          </div>
        </div>
        <div style="margin-top:12px;border:1px solid rgba(255,255,255,.08);background:#fff;border-radius:10px;overflow:hidden;">
          <iframe src="newsletters/current.html" style="width:100%;height:420px;border:0;"></iframe>
        </div>
      </div>
    `;

    const previewBtn = byId("nl-preview-current-full");
    if (previewBtn) {
      previewBtn.onclick = function () {
        const body = byId(IDS.fullModalBody);
        if (!body) return;
        body.innerHTML = "";
        const iframe = document.createElement("iframe");
        iframe.src = "newsletters/current.html";
        iframe.style.width = "100%";
        iframe.style.height = "80vh";
        iframe.style.border = "0";
        iframe.style.background = "#fff";
        body.appendChild(iframe);
        openModal(IDS.fullModal);
      };
    }
  }

  function escapeText(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function renderEditPanel() {
    const list = byId(IDS.editorList);
    if (!list) return;
    if (!state.canManage) {
      list.innerHTML = `<div style="border:1px solid rgba(255,255,255,.12);padding:14px;color:var(--silver);">No newsletter access.</div>`;
      return;
    }

    const c = state.current || {};
    state.draftHtml = "";
    state.draftValidationOk = false;
    state.draftViewed = false;

    const parsed = parseNewsletterText(state.current_html || "");
    const s1 = parsed?.story1 || {};
    const s2 = parsed?.story2 || {};
    const s3 = parsed?.story3 || {};
    const hero1 = parsed?.hero_line_1 ?? c.hero_line_1 ?? "";
    const hero2 = parsed?.hero_line_2 ?? c.hero_line_2 ?? "";
    const heroSub = parsed?.hero_subtitle ?? c.hero_subtitle ?? "";
    const closing = parsed?.closing_phrase ?? c.closing_phrase ?? "";
    const currentImageRefs = getNewsletterImageRefs(state.current_html || "");

    list.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.02);padding:14px;border-radius:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
            <div>
              <div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);">Newsletter</div>
              <div style="font-size:13px;color:var(--silver);margin-top:4px">Update fields below, generate a draft, then publish.</div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button class="btn btn-gold" type="button" id="${IDS.editGenerate}">Generate draft</button>
              <button class="btn btn-gold" type="button" id="${IDS.editPublish}" disabled>Publish</button>
            </div>
          </div>
          <div id="${IDS.editStatus}" style="margin-top:10px;color:var(--silver);font-size:12px;">Ready.</div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:12px;">
            <label><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);margin-bottom:4px;">Edition name</div><input id="nl-edit-edition" style="${inputStyle()}" value="${escapeText(c.edition_name || "")}" /></label>
            <label><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);margin-bottom:4px;">Month</div><input id="nl-edit-month" style="${inputStyle()}" value="${escapeText(c.month || "")}" /></label>
            <label><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);margin-bottom:4px;">Year</div><input id="nl-edit-year" style="${inputStyle()}" value="${escapeText(c.year || "")}" /></label>
            <label><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);margin-bottom:4px;">Date range</div><input id="nl-edit-date-range" style="${inputStyle()}" value="${escapeText(c.date_range || "")}" /></label>
            <label><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);margin-bottom:4px;">Hero line 1</div><input id="nl-edit-hero-1" style="${inputStyle()}" value="${escapeText(hero1)}" /></label>
            <label><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);margin-bottom:4px;">Hero line 2</div><input id="nl-edit-hero-2" style="${inputStyle()}" value="${escapeText(hero2)}" /></label>
            <label><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);margin-bottom:4px;">Hero subtitle</div><input id="nl-edit-hero-subtitle" style="${inputStyle()}" value="${escapeText(heroSub)}" /></label>
            <label><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);margin-bottom:4px;">Closing phrase</div><input id="nl-edit-closing" style="${inputStyle()}" value="${escapeText(closing)}" /></label>
          </div>

          <div style="margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.08);">
            <div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:10px;">Newsletter text (editable)</div>
            <div style="display:grid;gap:12px;">
              <div style="background:rgba(0,0,0,.15);padding:12px;border-radius:10px;">
                <div style="font-size:11px;color:var(--gold);margin-bottom:8px;">Story 1</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                  <label><div style="font-size:9px;color:var(--silver);margin-bottom:2px;">Section label</div><input id="nl-edit-s1-label" style="${inputStyle()}" value="${escapeText(s1.section_label)}" /></label>
                  <label><div style="font-size:9px;color:var(--silver);margin-bottom:2px;">Date</div><input id="nl-edit-s1-date" style="${inputStyle()}" value="${escapeText(s1.date)}" /></label>
                </div>
                <label style="display:block;margin-top:8px;"><div style="font-size:9px;color:var(--silver);margin-bottom:2px;">Heading</div><input id="nl-edit-s1-heading" style="${inputStyle()}" value="${escapeText(s1.heading)}" /></label>
                <label style="display:block;margin-top:8px;"><div style="font-size:9px;color:var(--silver);margin-bottom:2px;">Body</div><textarea id="nl-edit-s1-body" style="${inputStyle()};min-height:70px;resize:vertical" rows="3">${escapeText(s1.body)}</textarea></label>
                <label style="display:block;margin-top:8px;"><div style="font-size:9px;color:var(--silver);margin-bottom:2px;">Highlight</div><input id="nl-edit-s1-highlight" style="${inputStyle()}" value="${escapeText(s1.highlight)}" /></label>
                <label style="display:block;margin-top:8px;"><div style="font-size:9px;color:var(--silver);margin-bottom:2px;">Image caption</div><input id="nl-edit-s1-caption" style="${inputStyle()}" value="${escapeText(s1.caption)}" /></label>
              </div>
              <div style="background:rgba(0,0,0,.15);padding:12px;border-radius:10px;">
                <div style="font-size:11px;color:var(--gold);margin-bottom:8px;">Story 2</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                  <label><div style="font-size:9px;color:var(--silver);margin-bottom:2px;">Section label</div><input id="nl-edit-s2-label" style="${inputStyle()}" value="${escapeText(s2.section_label)}" /></label>
                  <label><div style="font-size:9px;color:var(--silver);margin-bottom:2px;">Date</div><input id="nl-edit-s2-date" style="${inputStyle()}" value="${escapeText(s2.date)}" /></label>
                </div>
                <label style="display:block;margin-top:8px;"><div style="font-size:9px;color:var(--silver);margin-bottom:2px;">Heading</div><input id="nl-edit-s2-heading" style="${inputStyle()}" value="${escapeText(s2.heading)}" /></label>
                <label style="display:block;margin-top:8px;"><div style="font-size:9px;color:var(--silver);margin-bottom:2px;">Body</div><textarea id="nl-edit-s2-body" style="${inputStyle()};min-height:70px;resize:vertical" rows="3">${escapeText(s2.body)}</textarea></label>
                <label style="display:block;margin-top:8px;"><div style="font-size:9px;color:var(--silver);margin-bottom:2px;">Highlight</div><input id="nl-edit-s2-highlight" style="${inputStyle()}" value="${escapeText(s2.highlight)}" /></label>
                <label style="display:block;margin-top:8px;"><div style="font-size:9px;color:var(--silver);margin-bottom:2px;">Image caption</div><input id="nl-edit-s2-caption" style="${inputStyle()}" value="${escapeText(s2.caption)}" /></label>
              </div>
              <div style="background:rgba(0,0,0,.15);padding:12px;border-radius:10px;">
                <div style="font-size:11px;color:var(--gold);margin-bottom:8px;">Story 3</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                  <label><div style="font-size:9px;color:var(--silver);margin-bottom:2px;">Section label</div><input id="nl-edit-s3-label" style="${inputStyle()}" value="${escapeText(s3.section_label)}" /></label>
                  <label><div style="font-size:9px;color:var(--silver);margin-bottom:2px;">Date</div><input id="nl-edit-s3-date" style="${inputStyle()}" value="${escapeText(s3.date)}" /></label>
                </div>
                <label style="display:block;margin-top:8px;"><div style="font-size:9px;color:var(--silver);margin-bottom:2px;">Heading</div><input id="nl-edit-s3-heading" style="${inputStyle()}" value="${escapeText(s3.heading)}" /></label>
                <label style="display:block;margin-top:8px;"><div style="font-size:9px;color:var(--silver);margin-bottom:2px;">Body</div><textarea id="nl-edit-s3-body" style="${inputStyle()};min-height:70px;resize:vertical" rows="3">${escapeText(s3.body)}</textarea></label>
                <label style="display:block;margin-top:8px;"><div style="font-size:9px;color:var(--silver);margin-bottom:2px;">Highlight</div><input id="nl-edit-s3-highlight" style="${inputStyle()}" value="${escapeText(s3.highlight)}" /></label>
              </div>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px;">
            ${assetDropHtml("nl-edit-image-1", "Story image 1", "image/*", "Image 1", currentImageRefs[0])}
            ${assetDropHtml("nl-edit-image-2", "Story image 2", "image/*", "Image 2", currentImageRefs[1])}
            ${assetDropHtml("nl-edit-image-3", "Story image 3", "image/*", "Image 3", currentImageRefs[2])}
            ${assetDropHtml("nl-edit-image-4", "Story image 4", "image/*", "Image 4", currentImageRefs[3])}
          </div>
        </div>

        <div style="border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.02);padding:14px;border-radius:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);">Create new</div>
            <div style="font-size:14px;color:var(--silver);margin-top:2px">Start a new monthly edition, generate draft with Gemini, then publish.</div>
          </div>
          <button class="btn btn-gold" type="button" id="nl-open-create-modal">Create new edition</button>
        </div>
      </div>
    `;

    setupAssetDropZone({ dropId: "nl-edit-image-1-drop", inputId: "nl-edit-image-1-file", accept: "image/*", multiple: false });
    setupAssetDropZone({ dropId: "nl-edit-image-2-drop", inputId: "nl-edit-image-2-file", accept: "image/*", multiple: false });
    setupAssetDropZone({ dropId: "nl-edit-image-3-drop", inputId: "nl-edit-image-3-file", accept: "image/*", multiple: false });
    setupAssetDropZone({ dropId: "nl-edit-image-4-drop", inputId: "nl-edit-image-4-file", accept: "image/*", multiple: false });

    const genBtn = byId(IDS.editGenerate);
    const publishBtn = byId(IDS.editPublish);
    const statusEl = byId(IDS.editStatus);

    function setDraftButtonsEnabled() {
      if (publishBtn) publishBtn.disabled = !state.draftHtml;
    }
    setDraftButtonsEnabled();

    genBtn.onclick = async function () {
      setButtonsBusy([genBtn, publishBtn], true);
      state.draftHtml = "";
      state.draftValidationOk = false;
      state.draftViewed = false;
      const stopLoading = startLoadingStatus(statusEl, "Generating draft with Gemini");
      try {
        const meta = collectMetadata("nl-edit");
        const form = new FormData();
        appendMetadata(form, meta);
        getImageFilesForPrefix("nl-edit-image", 4).forEach((f) => form.append("assets", f));
        const data = await api("/api/newsletter/generate-draft", { method: "POST", body: form });
        state.draftHtml = data.draft_html || "";
        state.draftMode = "edit";
        state.draftValidationOk = data.validation_ok !== false;
        stopLoading();
        if (statusEl) {
          if (state.draftValidationOk) {
            statusEl.textContent = `Draft ready (${data.model || "Gemini"}). Click Publish when satisfied.`;
          } else {
            statusEl.textContent = `Draft ready; validation note: ${data.validation_error || "Output did not match the design contract."} You may still publish.`;
          }
        }
        setDraftButtonsEnabled();
      } catch (e) {
        stopLoading();
        const msg = e.message || "Draft generation failed.";
        if (statusEl) statusEl.textContent = msg;
        toast(msg);
      } finally {
        setButtonsBusy([genBtn, publishBtn], false);
        setDraftButtonsEnabled();
      }
    };

    publishBtn.onclick = async function () {
      if (!state.draftHtml) return;
      setButtonsBusy([publishBtn], true);
      if (statusEl) statusEl.textContent = "Publishing...";
      try {
        const meta = collectMetadata("nl-edit");
        await api("/api/newsletter/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draft_html: state.draftHtml,
            ...meta,
            push_to_github: true
          })
        });
        toast("Published and pushed to GitHub.");
        await loadState();
        state.draftHtml = "";
        state.draftValidationOk = false;
        state.draftViewed = false;
        renderCurrentPreview();
        renderEditPanel();
      } catch (e) {
        const msg = e.message || "Publish failed.";
        if (statusEl) statusEl.textContent = msg;
        toast(msg);
      } finally {
        setButtonsBusy([publishBtn], false);
        setDraftButtonsEnabled();
      }
    };

    const createBtn = byId("nl-open-create-modal");
    if (createBtn) createBtn.onclick = openCreateModal;
  }

  function inputStyle() {
    return "width:100%;background:#0b1020;border:1px solid rgba(255,255,255,.15);color:#e9edf8;padding:10px;font-family:inherit;font-size:13px;border-radius:10px;";
  }

  function assetDropHtml(prefix, helperText, acceptLabel, titleText, currentImageSrc) {
    // Prefix is used for element ids.
    const inputId = `${prefix}-file`;
    const dropId = `${prefix}-drop`;
    const currentImgHtml = currentImageSrc
      ? `<div style="margin-top:10px;"><div style="font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--silver);margin-bottom:4px;">Current image</div><img src="${escapeText(currentImageSrc)}" alt="Current" style="max-width:100%;max-height:88px;object-fit:cover;border-radius:8px;display:block;border:1px solid rgba(255,255,255,.1);" onerror="this.style.display='none'"/></div>`
      : "";
    return `
      <div
        id="${dropId}"
        class="comp-drop-zone"
        style="border-radius:10px;border:1px dashed rgba(184,154,92,.45);background:rgba(30,37,64,.25);padding:18px 14px;text-align:center;cursor:pointer;"
      >
        <div class="comp-dz-text" style="font-size:12px;color:var(--silver);line-height:1.6;">
          ${titleText ? `<div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-light);margin-bottom:4px;">${titleText}</div>` : ""}
          <strong style="color:var(--gold-light)">${acceptLabel === ".pdf" ? "Click to upload PDF" : "Click to upload image"}</strong>
          or drag and drop
        </div>
        <input type="file" id="${inputId}" accept="${acceptLabel}" multiple style="display:none" />
        <div style="margin-top:8px;font-size:11px;color:var(--silver)" id="${prefix}-file-summary">${helperText || "No file selected"}</div>
        ${currentImgHtml}
      </div>
    `;
  }

  function getImageFilesForPrefix(prefix, count) {
    const files = [];
    for (let i = 1; i <= count; i += 1) {
      const picked = getSelectedFiles(`${prefix}-${i}-file`);
      if (picked.length) files.push(picked[0]);
    }
    return files;
  }

  function setupAssetDropZone({ dropId, inputId, accept, multiple }) {
    const drop = byId(dropId);
    const input = byId(inputId);
    if (!drop || !input) return;

    if (drop.dataset && drop.dataset.nlDzWired === "1") return;
    if (drop.dataset) drop.dataset.nlDzWired = "1";

    input.multiple = !!multiple;
    input.accept = accept;

    const summaryEl = byId(`${inputId.replace(/-file$/, "")}-file-summary`);

    function updateSummary() {
      const files = getSelectedFiles(inputId);
      if (!files.length) {
        if (summaryEl) summaryEl.textContent = "No files";
        return;
      }
      if (summaryEl) {
        const names = files.slice(0, 2).map((f) => f.name).join(", ");
        summaryEl.textContent = `${files.length} file(s) selected${files.length > 2 ? ": " + names + "…" : ": " + names}`;
      }
    }

    function setZoneDrag(on) {
      if (!drop.classList) return;
      drop.classList.toggle("drag-over", !!on);
    }

    drop.onclick = function () {
      input.click();
    };

    drop.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setZoneDrag(true);
    });
    drop.addEventListener("dragleave", () => setZoneDrag(false));

    drop.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setZoneDrag(false);
      const files = Array.from(e.dataTransfer?.files || []);
      if (!files.length) return;
      const dt = new DataTransfer();
      files.forEach((f) => dt.items.add(f));
      input.files = dt.files;
      updateSummary();
    });

    input.addEventListener("change", () => updateSummary());
    updateSummary();
  }

  function getSelectedFiles(inputId) {
    const input = byId(inputId);
    if (!input || !input.files) return [];
    return Array.from(input.files || []);
  }

  function setButtonsBusy(btns, busy) {
    btns.forEach((b) => {
      if (!b) return;
      if (!b.tagName || b.tagName.toLowerCase() !== "button") {
        b.disabled = !!busy;
        return;
      }
      if (busy) {
        if (b.dataset.prevDisabled == null) b.dataset.prevDisabled = b.disabled ? "1" : "0";
        b.disabled = true;
        if (!b.dataset.prevText) b.dataset.prevText = b.textContent;
        b.textContent = "Working…";
      } else {
        b.disabled = b.dataset.prevDisabled === "1";
        if (b.dataset.prevText) b.textContent = b.dataset.prevText;
        delete b.dataset.prevText;
        delete b.dataset.prevDisabled;
      }
    });
  }

  function collectMetadata(prefix) {
    const get = (id) => byId(`${prefix}-${id}`)?.value || "";
    const yearRaw = Number(get("year")) || new Date().getFullYear();
    return {
      edition_name: get("edition").trim(),
      month: get("month").trim(),
      year: yearRaw,
      date_range: get("date-range").trim(),
      hero_line_1: get("hero-1").trim(),
      hero_line_2: get("hero-2").trim(),
      hero_subtitle: get("hero-subtitle").trim(),
      closing_phrase: get("closing").trim()
    };
  }

  function appendMetadata(form, meta) {
    form.append("edition_name", meta.edition_name);
    form.append("month", meta.month);
    form.append("year", String(meta.year));
    form.append("date_range", meta.date_range);
    form.append("hero_line_1", meta.hero_line_1);
    form.append("hero_line_2", meta.hero_line_2);
    form.append("hero_subtitle", meta.hero_subtitle);
    form.append("closing_phrase", meta.closing_phrase);
  }

  function getNewsletterImageRefs(html) {
    if (!html || !html.trim()) return [];
    try {
      const div = document.createElement("div");
      div.innerHTML = html;
      const refs = [];
      const stories = div.querySelectorAll(".story");
      stories.forEach((story) => {
        const img = story.querySelector(".story-image img");
        if (img) refs.push(img.getAttribute("src") || "");
      });
      const wideImages = div.querySelectorAll(".story-wide .story-wide-images img");
      wideImages.forEach((img) => refs.push(img.getAttribute("src") || ""));
      return refs.slice(0, 4).map((src) => {
        const s = (src || "").trim();
        if (!s || s.startsWith("http")) return s;
        if (s.startsWith("newsletters/")) return s;
        return "newsletters/" + s.replace(/^\.\//, "");
      });
    } catch (e) {
      return [];
    }
  }

  function parseNewsletterText(html) {
    if (!html || !html.trim()) return null;
    try {
      const div = document.createElement("div");
      div.innerHTML = html;
      const text = (sel) => {
        const el = div.querySelector(sel);
        return el ? el.textContent.trim() : "";
      };
      const heroTitle = div.querySelector(".hero-title");
      let hero1 = "";
      let hero2 = "";
      if (heroTitle) {
        const parts = heroTitle.innerHTML.split(/<br\s*\/?>/i);
        hero1 = (parts[0] || "").replace(/<[^>]+>/g, "").trim();
        const second = (parts[1] || "").replace(/<[^>]+>/g, "").trim();
        hero2 = second;
      }
      const stories = div.querySelectorAll(".story");
      const storyWide = div.querySelector(".story-wide .story-wide-content");
      const storyFields = (container) => ({
        section_label: container ? (container.querySelector(".section-label")?.textContent || "").trim() : "",
        date: container ? (container.querySelector(".story-date-tag")?.textContent || "").trim() : "",
        heading: container ? (container.querySelector(".story-heading")?.textContent || "").trim() : "",
        body: container ? (container.querySelector(".story-body")?.textContent || "").trim() : "",
        highlight: container ? (container.querySelector(".story-highlight")?.textContent || "").trim() : "",
        caption: container ? (container.querySelector(".story-image-caption")?.textContent || "").trim() : ""
      });
      return {
        hero_line_1: hero1,
        hero_line_2: hero2,
        hero_subtitle: text(".hero-subtitle"),
        closing_phrase: text(".footer-right"),
        story1: storyFields(stories[0]),
        story2: storyFields(stories[1]),
        story3: storyWide ? {
          section_label: (storyWide.querySelector(".section-label")?.textContent || "").trim(),
          date: (storyWide.querySelector(".story-date-tag")?.textContent || "").trim(),
          heading: (storyWide.querySelector(".story-heading")?.textContent || "").trim(),
          body: (storyWide.querySelector(".story-body")?.textContent || "").trim(),
          highlight: (storyWide.querySelector(".story-highlight")?.textContent || "").trim(),
          caption: ""
        } : { section_label: "", date: "", heading: "", body: "", highlight: "", caption: "" }
      };
    } catch (e) {
      return null;
    }
  }

  function applyNewsletterText(html, values) {
    if (!html || !html.trim() || !values) return html;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const setText = (sel, val) => {
        const el = doc.querySelector(sel);
        if (el) el.textContent = String(val == null ? "" : val).trim();
      };
      const safe = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").trim();
      const setHeroTitle = (line1, line2) => {
        const el = doc.querySelector(".hero-title");
        if (el) el.innerHTML = safe(line1) + "<br/><em>" + safe(line2) + "</em>";
      };
      setHeroTitle(values.hero_line_1 || "", values.hero_line_2 || "");
      setText(".hero-subtitle", values.hero_subtitle);
      setText(".footer-right", values.closing_phrase);
      const stories = doc.querySelectorAll(".story");
      const storyWide = doc.querySelector(".story-wide .story-wide-content");
      const applyStory = (container, s) => {
        if (!container || !s) return;
        const q = (sel) => container.querySelector(sel);
        if (q(".section-label")) q(".section-label").textContent = String(s.section_label || "").trim();
        if (q(".story-date-tag")) q(".story-date-tag").textContent = String(s.date || "").trim();
        if (q(".story-heading")) q(".story-heading").textContent = String(s.heading || "").trim();
        if (q(".story-body")) q(".story-body").textContent = String(s.body || "").trim();
        if (q(".story-highlight")) q(".story-highlight").textContent = String(s.highlight || "").trim();
        if (s.caption) {
          const cap = container.querySelector(".story-image-caption");
          if (cap) cap.textContent = String(s.caption || "").trim();
        }
      };
      applyStory(stories[0], values.story1);
      applyStory(stories[1], values.story2);
      if (storyWide && values.story3) {
        const s = values.story3;
        const q = (sel) => storyWide.querySelector(sel);
        if (q(".section-label")) q(".section-label").textContent = String(s.section_label || "").trim();
        if (q(".story-date-tag")) q(".story-date-tag").textContent = String(s.date || "").trim();
        if (q(".story-heading")) q(".story-heading").textContent = String(s.heading || "").trim();
        if (q(".story-body")) q(".story-body").textContent = String(s.body || "").trim();
        if (q(".story-highlight")) q(".story-highlight").textContent = String(s.highlight || "").trim();
      }
      return "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
    } catch (e) {
      return html;
    }
  }

  function previewHtmlInFullModal(html) {
    const body = byId(IDS.fullModalBody);
    if (!body) return;
    body.innerHTML = "";
    const frameWrap = document.createElement("div");
    frameWrap.style.width = "100%";
    frameWrap.style.height = "72vh";
    frameWrap.style.overflow = "auto";
    frameWrap.style.display = "flex";
    frameWrap.style.justifyContent = "center";
    frameWrap.style.alignItems = "flex-start";
    frameWrap.style.background = "transparent";
    frameWrap.style.border = "0";
    frameWrap.style.borderRadius = "0";
    frameWrap.style.padding = "0";
    const iframe = document.createElement("iframe");
    iframe.style.width = "133%";
    iframe.style.height = "96vh";
    iframe.style.border = "0";
    iframe.style.background = "#fff";
    iframe.style.transform = "scale(0.75)";
    iframe.style.transformOrigin = "top center";
    iframe.srcdoc = html;
    frameWrap.appendChild(iframe);
    body.appendChild(frameWrap);

    // Ensure the draft preview appears above the create modal.
    const fullModal = byId(IDS.fullModal);
    if (fullModal && fullModal.style) fullModal.style.zIndex = "2500";
    const createModal = byId(IDS.nlCreateModal);
    if (createModal && createModal.style) createModal.style.zIndex = "2000";

    openModal(IDS.fullModal);
  }

  function ensureCreateModal() {
    const existing = byId(IDS.nlCreateModal);
    const hasSourceText = existing ? !!existing.querySelector("#nl-new-source-text") : false;
    const hasImageDrop = existing ? !!existing.querySelector("#nl-new-image-4-drop") : false;
    const hasCopyBtn = existing ? !!existing.querySelector("#nl-copy-source-template") : false;
    const shouldRender = !existing || !(hasSourceText && hasImageDrop && hasCopyBtn);

    const hostClass = determineModalHostClass();
    const host = existing || document.createElement("div");
    host.id = IDS.nlCreateModal;
    host.className = hostClass;
    host.setAttribute("role", "dialog");
    host.setAttribute("aria-modal", "true");
    if (shouldRender) {
      host.innerHTML = `
        <div class="modal" style="max-width:1100px;">
          <div class="modal-header">
            <span class="modal-header-title" style="font-family:var(--font-display);font-size:22px;">Create new edition</span>
            <button class="modal-close" type="button" id="nl-create-close" aria-label="Close">✕</button>
          </div>
          <div class="modal-body" style="padding:20px 26px;">
            <div id="${IDS.createStatus}" style="margin-bottom:12px;color:var(--silver);font-size:12px;">Fill details, paste source text, then generate a draft.</div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;">
              <label><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);margin-bottom:4px;">Edition name</div><input id="nl-new-edition" style="${inputStyle()}" placeholder="Ramadan Edition" /></label>
              <label><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);margin-bottom:4px;">Month</div><input id="nl-new-month" style="${inputStyle()}" placeholder="March" /></label>
              <label><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);margin-bottom:4px;">Year</div><input id="nl-new-year" style="${inputStyle()}" placeholder="2026" /></label>
              <label><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);margin-bottom:4px;">Date range</div><input id="nl-new-date-range" style="${inputStyle()}" placeholder="March 2026" /></label>
              <label><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);margin-bottom:4px;">Hero line 1</div><input id="nl-new-hero-1" style="${inputStyle()}" placeholder="Ramadan" /></label>
              <label><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);margin-bottom:4px;">Hero line 2</div><input id="nl-new-hero-2" style="${inputStyle()}" placeholder="Mubarak" /></label>
              <label><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);margin-bottom:4px;">Hero subtitle</div><input id="nl-new-hero-subtitle" style="${inputStyle()}" placeholder="Events · Community · Reflection" /></label>
              <label><div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);margin-bottom:4px;">Closing phrase</div><input id="nl-new-closing" style="${inputStyle()}" placeholder="Ramadan Kareem" /></label>
            </div>

            <label style="display:block;margin-top:10px;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px;">
                <div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--silver);">Source text</div>
                <button type="button" class="btn btn-outline" id="nl-copy-source-template" style="padding:8px 12px;font-size:12px;white-space:nowrap;">Copy template</button>
              </div>
              <textarea
                id="nl-new-source-text"
                style="${inputStyle()};min-height:190px;padding:12px;resize:vertical;white-space:pre;"
                placeholder="Paste your STORY_1 / STORY_2 / STORY_3 blocks below (use whatever details you have). Gemini will build the newsletter HTML from this text + the metadata fields above.

STORY_1:
Section label: 
Info / recap (2-6 sentences):
Key highlight (1 sentence, short and specific):
Collab / communities (comma-separated, optional):
Image caption (optional):

STORY_2:
Section label:
Info / recap (2-6 sentences):
Key highlight:
Collab / communities (comma-separated, optional):
Image caption (optional):

STORY_3:
Section label:
Info / recap (2-6 sentences):
Key highlight:
Collab / communities (comma-separated, optional):
Image caption 1 (optional):
Image caption 2 (optional):"
              ></textarea>
              <div style="margin-top:8px;font-size:11px;color:var(--silver);line-height:1.5;">
                Tip: If you don't know what to write, paste bullet notes. Gemini can turn notes into full prose.
              </div>
            </label>

            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px;">
              ${assetDropHtml("nl-new-image-1", "Story image 1", "image/*", "Image 1")}
              ${assetDropHtml("nl-new-image-2", "Story image 2", "image/*", "Image 2")}
              ${assetDropHtml("nl-new-image-3", "Story image 3", "image/*", "Image 3")}
              ${assetDropHtml("nl-new-image-4", "Story image 4", "image/*", "Image 4")}
            </div>

            <div class="modal-footer" style="justify-content:flex-end;gap:10px;padding:16px 26px;">
              <button type="button" class="btn btn-gold" id="${IDS.createGenerate}">Generate draft</button>
              <button type="button" class="btn btn-gold" id="${IDS.createPublish}" disabled>Publish</button>
            </div>
          </div>
        </div>
      `;
    }

    if (!existing) document.body.appendChild(host);

    const closeBtn = byId("nl-create-close");
    if (closeBtn) closeBtn.onclick = function () {
      closeModal(IDS.nlCreateModal);
    };

    const copyBtn = byId("nl-copy-source-template");
    if (copyBtn) {
      copyBtn.onclick = async function () {
        const ta = byId("nl-new-source-text");
        const placeholder = ta?.getAttribute("placeholder") || ta?.placeholder || "";
        if (ta && !ta.value.trim()) ta.value = placeholder;
        const ok = await copyTextToClipboard(placeholder);
        toast(ok ? "Copied source template to clipboard." : "Copy failed. You can manually select the template from the textarea.");
      };
    }

    // Wire 4 image slots.
    setupAssetDropZone({ dropId: "nl-new-image-1-drop", inputId: "nl-new-image-1-file", accept: "image/*", multiple: false });
    setupAssetDropZone({ dropId: "nl-new-image-2-drop", inputId: "nl-new-image-2-file", accept: "image/*", multiple: false });
    setupAssetDropZone({ dropId: "nl-new-image-3-drop", inputId: "nl-new-image-3-file", accept: "image/*", multiple: false });
    setupAssetDropZone({ dropId: "nl-new-image-4-drop", inputId: "nl-new-image-4-file", accept: "image/*", multiple: false });
  }

  function openCreateModal() {
    ensureCreateModal();
    // Reset draft state for this flow.
    state.draftHtml = "";
    state.draftValidationOk = false;
    state.draftViewed = false;
    const publishBtn = byId(IDS.createPublish);
    if (publishBtn) publishBtn.disabled = true;

    const statusEl = byId(IDS.createStatus);
    if (statusEl) statusEl.textContent = "Fill details, paste source text, then generate a draft.";
    openModal(IDS.nlCreateModal);

    bindCreateActions();
  }

  function bindCreateActions() {
    const genBtn = byId(IDS.createGenerate);
    const publishBtn = byId(IDS.createPublish);
    const statusEl = byId(IDS.createStatus);
    if (!genBtn || !publishBtn || !statusEl) return;

    genBtn.onclick = async function () {
      genBtn.disabled = true;
      state.draftHtml = "";
      state.draftValidationOk = false;
      state.draftViewed = false;
      const stopLoading = startLoadingStatus(statusEl, "Generating draft with Gemini");
      if (publishBtn) publishBtn.disabled = true;

      showGenerateLoadingPopup();

      try {
        const meta = collectMetadataNew();
        const form = new FormData();
        appendMetadata(form, meta);
        getImageFilesForPrefix("nl-new-image", 4).forEach((f) => form.append("assets", f));

        form.append("source_text", (byId("nl-new-source-text")?.value || "").trim());

        const data = await api("/api/newsletter/generate-draft", { method: "POST", body: form });
        stopLoading();
        hideGenerateLoadingPopup();
        state.draftHtml = data.draft_html || "";
        state.draftMode = "create";
        state.draftValidationOk = data.validation_ok !== false;
        if (statusEl) {
          if (state.draftValidationOk) {
            statusEl.textContent = `Draft ready (${data.model || "Gemini"}). Click Publish when satisfied.`;
          } else {
            statusEl.textContent = `Draft ready; validation note: ${data.validation_error || "Output did not match the design contract."} You may still publish.`;
          }
        }
        if (publishBtn) publishBtn.disabled = !state.draftHtml;
      } catch (e) {
        stopLoading();
        const msg = e.message || "Draft generation failed.";
        if (statusEl) statusEl.textContent = msg;
        toast(msg);
        if (publishBtn) publishBtn.disabled = true;
      } finally {
        hideGenerateLoadingPopup();
        genBtn.disabled = false;
      }
    };

    publishBtn.onclick = async function () {
      if (!state.draftHtml) return;
      publishBtn.disabled = true;
      if (statusEl) statusEl.textContent = "Publishing...";
      try {
        const meta = collectMetadataNew();
        await api("/api/newsletter/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            draft_html: state.draftHtml,
            ...meta,
            push_to_github: true
          })
        });
        toast("Published and pushed to GitHub.");
        closeModal(IDS.nlCreateModal);
        state.draftHtml = "";
        state.draftValidationOk = false;
        state.draftViewed = false;
        await loadState();
        renderCurrentPreview();
        renderEditPanel();
      } catch (e) {
        const msg = e.message || "Publish failed.";
        if (statusEl) statusEl.textContent = msg;
        toast(msg);
        publishBtn.disabled = false;
      }
    };
  }

  function startLoadingStatus(statusEl, label) {
    if (!statusEl) return () => {};
    let tick = 0;
    statusEl.textContent = `${label}.`;
    const iv = setInterval(() => {
      tick += 1;
      const dots = ".".repeat((tick % 3) + 1);
      const sec = tick;
      statusEl.textContent = `${label}${dots} ${sec}s`;
    }, 1000);
    return function stop() {
      clearInterval(iv);
    };
  }

  function showGenerateLoadingPopup() {
    hideGenerateLoadingPopup();
    const overlay = document.createElement("div");
    overlay.id = IDS.nlGenerateLoading;
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.style.cssText = "position:fixed;inset:0;z-index:3500;display:flex;align-items:center;justify-content:center;background:rgba(5,8,15,.75);backdrop-filter:blur(4px);";
    overlay.innerHTML = `
      <div style="background:var(--navy-mid);border:1px solid rgba(184,154,92,.25);border-radius:14px;padding:28px 36px;box-shadow:0 20px 50px rgba(0,0,0,.4);text-align:center;min-width:260px;">
        <div class="nl-loading-spinner" style="width:36px;height:36px;margin:0 auto 16px;border:3px solid rgba(184,154,92,.2);border-top-color:var(--gold);border-radius:50%;animation:nl-spin .8s linear infinite;"></div>
        <div style="font-family:var(--font-display);font-size:16px;color:var(--white);margin-bottom:6px;">Generating draft</div>
        <div style="font-size:12px;color:var(--silver);">Gemini is building your newsletter…</div>
      </div>
    `;
    const style = document.createElement("style");
    style.id = "nl-loading-popup-style";
    style.textContent = "@keyframes nl-spin{to{transform:rotate(360deg)}}";
    if (!document.getElementById("nl-loading-popup-style")) document.head.appendChild(style);
    document.body.appendChild(overlay);
  }

  function hideGenerateLoadingPopup() {
    const el = byId(IDS.nlGenerateLoading);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function collectMetadataNew() {
    const year = Number(byId("nl-new-year")?.value || 0) || new Date().getFullYear();
    return {
      edition_name: (byId("nl-new-edition")?.value || "").trim(),
      month: (byId("nl-new-month")?.value || "").trim(),
      year,
      date_range: (byId("nl-new-date-range")?.value || "").trim(),
      hero_line_1: (byId("nl-new-hero-1")?.value || "").trim(),
      hero_line_2: (byId("nl-new-hero-2")?.value || "").trim(),
      hero_subtitle: (byId("nl-new-hero-subtitle")?.value || "").trim(),
      closing_phrase: (byId("nl-new-closing")?.value || "").trim()
    };
  }

  async function loadState() {
    try {
      const data = await api("/api/newsletter/admin/state", { method: "GET" });
      state.canManage = !!data.can_manage;
      state.current = data.current || null;
      state.current_html = data.current_html || "";
    } catch (e) {
      state.canManage = false;
      state.current = null;
      state.current_html = "";
    }

    state.canManage ? showNewsletterNav() : hideNewsletterNav();
  }

  window.loadNewsletterPage = async function loadNewsletterPage() {
    await loadState();
    hideLegacyControls();
    if (state.canManage) {
      renderCurrentPreview();
      renderEditPanel();
    } else {
      renderCurrentPreview();
      renderEditPanel();
    }
  };

  // Legacy pages call this; now it’s unnecessary (publish already pushes). Keep as no-op.
  window.newsletterPushToGitHub = async function newsletterPushToGitHub() {
    toast("Use Generate + Approve & publish instead.");
  };

  // Initial mount.
  loadState().then(() => {
    hideLegacyControls();
    renderCurrentPreview();
    renderEditPanel();
  });
})();

