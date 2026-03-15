const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const express = require("express");
const dotenv = require("dotenv");
const { OAuth2Client } = require("google-auth-library");
const multer = require("multer");
const { initDb, db, seedUsers } = require("./sqlite");

dotenv.config();
initDb();

const app = express();
const PORT = Number(process.env.PORT || 5600);
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID || undefined);
// Use same persistent dir as SQLite when DATA_DIR is set (e.g. Render disk at /data).
const dataDir = process.env.DATA_DIR || __dirname;
const uploadsDir = path.join(dataDir, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const upload = multer({ dest: uploadsDir });

const siteContentPath = path.join(dataDir, "site-content.json");
const legacyImagesDir = path.join(__dirname, "images");
const galleryDir = path.join(__dirname, "gallery");
const boardImagesDir = path.join(__dirname, "board-images");
const logoImagesDir = path.join(__dirname, "logo-images");
const newsletterImagesDir = path.join(__dirname, "newsletter-images");
const aboutSsaImagesDir = path.join(__dirname, "about-ssa-images");

const CONFIRMED_BOARD = [
  { id: "bm-1", name: "Aisha Dakol", role: "Vice President", major: "", image: "board-images/Aisha Dakol - Vice President.png" },
  { id: "bm-2", name: "Dahir Munye", role: "President", major: "", image: "board-images/Dahir Munye - President.png" },
  { id: "bm-3", name: "Salman Said", role: "Co-Committee Chair", major: "", image: "board-images/Salman Said - Co-Committee Chair.png" },
  { id: "bm-4", name: "Ruweyda Warsame", role: "Co-Committee Chair", major: "", image: "board-images/Ruweyda Warsame - Co-Committee Chair.png" },
  { id: "bm-5", name: "Ikhlas Abdi", role: "Outreach Coordinator", major: "", image: "board-images/Ikhlas Abdi - Outreach Coordinator.png" },
  { id: "bm-6", name: "Ifrah Ali", role: "Treasurer", major: "", image: "board-images/Ifrah Ali - Treasurer.png" },
  { id: "bm-7", name: "Layla Salad", role: "Co-Event Coordinator", major: "", image: "board-images/Layla Salad - Co-Event Coordinator.png" },
  { id: "bm-8", name: "Ahmed Abdul", role: "Co-Event Coordinator", major: "", image: "board-images/Ahmed Abdul - Co-Event Coordinator.png" },
  { id: "bm-9", name: "Salma Tawane", role: "Secretary", major: "", image: "board-images/Salma Tawane - Secretary.png" },
  { id: "bm-10", name: "Maida Ahmed", role: "Co-Public Relations", major: "", image: "board-images/Maida Ahmed - Co-Public Relations.png" },
  { id: "bm-11", name: "Ashaar Ali", role: "Co-Public Relations", major: "", image: "board-images/Ashaar Ali - Co-Public Relations.png" }
];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}
function normalizeRelPath(p) {
  return String(p || "").replace(/^\/+/, "");
}
function copyIfMissing(src, dest) {
  try {
    if (fs.existsSync(src) && !fs.existsSync(dest)) fs.copyFileSync(src, dest);
  } catch (_e) {}
}
function isImageFilename(name) {
  return /\.(png|jpg|jpeg|webp|gif)$/i.test(name);
}
function boardFilenameFromName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") + ".png";
}

function migrateLegacyImageAssets() {
  ensureDir(galleryDir);
  ensureDir(boardImagesDir);
  ensureDir(logoImagesDir);
  ensureDir(newsletterImagesDir);
  ensureDir(aboutSsaImagesDir);
  if (!fs.existsSync(legacyImagesDir)) return;
  const files = fs.readdirSync(legacyImagesDir);
  const boardSet = new Set([
    "aisha-dakol-vice-president.png",
    "dahir-munye-president.png",
    "salman-said-updated.png",
    "ruweyda-warsame-co-committee-chair.png",
    "ikhlas-abdi-outreach-coordinator.png",
    "ifrah-ali-treasurer.png",
    "layla-salad-co-event-coordinator.png",
    "ahlam-abdul.png",
    "salma-tawane-secretary.png",
    "maida-ahmed-co-public-relations.png"
  ]);
  for (const name of files) {
    if (!isImageFilename(name) && !/\.svg$/i.test(name)) continue;
    const src = path.join(legacyImagesDir, name);
    let destDir = galleryDir;
    if (/instagram|logo|favicon|lock-icon|ssa-logo/i.test(name)) destDir = logoImagesDir;
    else if (/newsletter|february-newsletter/i.test(name)) destDir = newsletterImagesDir;
    else if (/IMG_5340-4164bde8-0cef-4b51-9075-8e792591b108|about/i.test(name)) destDir = aboutSsaImagesDir;
    else if (boardSet.has(name)) destDir = boardImagesDir;
    copyIfMissing(src, path.join(destDir, name));
  }
}

function defaultBoardMembers() {
  return CONFIRMED_BOARD.map((m) => ({
    ...m,
    image: m.image || `board-images/${boardFilenameFromName(m.name)}`
  }));
}
function defaultGalleryFromFolder() {
  try {
    ensureDir(galleryDir);
    return fs
      .readdirSync(galleryDir)
      .filter(isImageFilename)
      .sort()
      .map((name) => ({ id: `gallery-${name}`, src: `gallery/${name}`, alt: "SSA event" }));
  } catch (_e) {
    return [];
  }
}
function normalizeBoardMember(member, idx) {
  const m = member || {};
  let img = normalizeRelPath(m.image || "");
  if (img.startsWith("images/")) img = `board-images/${path.basename(img)}`;
  return {
    id: m.id || `bm-${idx + 1}`,
    name: String(m.name || "").trim(),
    role: String(m.role || "Executive Board Member").trim(),
    major: String(m.major || m.bio || "").trim(),
    image: img
  };
}
function normalizeGalleryImage(image, idx) {
  const g = image || {};
  let src = normalizeRelPath(g.src || "");
  if (src.startsWith("images/")) src = `gallery/${path.basename(src)}`;
  return {
    id: g.id || `g-${idx + 1}`,
    src,
    alt: String(g.alt || "SSA event")
  };
}

function readSiteContent() {
  let galleryImages = [];
  let boardMembers = [];
  try {
    if (fs.existsSync(siteContentPath)) {
      const raw = fs.readFileSync(siteContentPath, "utf8");
      const data = JSON.parse(raw);
      galleryImages = Array.isArray(data.galleryImages) ? data.galleryImages.map(normalizeGalleryImage) : [];
      boardMembers = Array.isArray(data.boardMembers) ? data.boardMembers.map(normalizeBoardMember) : [];
    }
  } catch (_e) {}
  if (!galleryImages.length) galleryImages = defaultGalleryFromFolder();
  if (!boardMembers.length) boardMembers = defaultBoardMembers();
  // Hard enforce section-specific folder sources.
  galleryImages = galleryImages.filter((g) => normalizeRelPath(g.src).startsWith("gallery/"));
  boardMembers = boardMembers.map((m, idx) => {
    const fixed = normalizeBoardMember(m, idx);
    if (!normalizeRelPath(fixed.image).startsWith("board-images/")) {
      fixed.image = `board-images/${path.basename(fixed.image || boardFilenameFromName(fixed.name))}`;
    }
    return fixed;
  });
  return { galleryImages, boardMembers };
}
function writeSiteContent(data) {
  const payload = {
    galleryImages: Array.isArray(data.galleryImages)
      ? data.galleryImages.map(normalizeGalleryImage).filter((g) => normalizeRelPath(g.src).startsWith("gallery/"))
      : [],
    boardMembers: Array.isArray(data.boardMembers)
      ? data.boardMembers.map(normalizeBoardMember).map((m) => {
          const fixed = { ...m };
          if (!normalizeRelPath(fixed.image).startsWith("board-images/")) {
            fixed.image = `board-images/${path.basename(fixed.image || boardFilenameFromName(fixed.name))}`;
          }
          return fixed;
        })
      : []
  };
  fs.writeFileSync(siteContentPath, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}
function canEditGallery(user) {
  if (!user) return false;
  const level = user.permission_level || user.view_type || "";
  return level === "president" || level === "vp" || level === "board";
}
function isPresident(user) {
  if (!user) return false;
  return (user.permission_level || user.view_type) === "president";
}

migrateLegacyImageAssets();
// Persist a normalized site-content file once on startup so legacy image paths migrate cleanly.
writeSiteContent(readSiteContent());

app.use(express.json({ limit: "2mb" }));
// Cache image assets for 1 year (asset file names are content-addressed in most flows).
app.use("/gallery", express.static(galleryDir, { maxAge: "1y", immutable: true }));
app.use("/board-images", express.static(boardImagesDir, { maxAge: "1y", immutable: true }));
app.use("/logo-images", express.static(logoImagesDir, { maxAge: "1y", immutable: true }));
app.use("/newsletter-images", express.static(newsletterImagesDir, { maxAge: "1y", immutable: true }));
app.use("/about-ssa-images", express.static(aboutSsaImagesDir, { maxAge: "1y", immutable: true }));
// Legacy path kept for backward compatibility during migration.
app.use("/images", express.static(legacyImagesDir, { maxAge: "1y", immutable: true }));
app.use(express.static(path.join(__dirname)));
app.use("/uploads", express.static(uploadsDir));

function classifyRoleFromMode(requestedRole) {
  const normalizedRole = String(requestedRole || "board").toLowerCase();
  if (normalizedRole === "president") {
    return {
      role_title: "Executive President",
      permission_level: "president",
      view_type: "president",
      vp_type: null
    };
  }
  if (normalizedRole === "vp-internal") {
    return {
      role_title: "Vice President, Chief of Internal Affairs",
      permission_level: "vp",
      view_type: "vp",
      vp_type: "internal"
    };
  }
  if (normalizedRole === "vp-external") {
    return {
      role_title: "Vice President, Chief of External Affairs",
      permission_level: "vp",
      view_type: "vp",
      vp_type: "external"
    };
  }
  return {
    role_title: "Board Member",
    permission_level: "board",
    view_type: "board",
    vp_type: null
  };
}

function resolveRedirectPath(user, requestedRole) {
  const normalizedRole = String(requestedRole || "").toLowerCase();
  if (normalizedRole === "president") return "president.html";
  if (normalizedRole === "vp-internal") return "vp.html?division=internal";
  if (normalizedRole === "vp-external") return "vp.html?division=external";
  if (normalizedRole === "board") return "board.html";

  if (user?.view_type === "president") return "president.html";
  if (user?.view_type === "vp") {
    const division = user?.vp_type === "external" ? "external" : "internal";
    return `vp.html?division=${division}`;
  }
  return "board.html";
}

function isAdminUser(user) {
  if (!user) return false;
  return (
    user.permission_level === "president" ||
    user.permission_level === "vp" ||
    user.view_type === "president" ||
    user.view_type === "vp"
  );
}

function isUmnEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase()
    .endsWith("@umn.edu");
}

function normalizeDivision(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "internal") return "internal";
  if (v === "external") return "external";
  return null;
}

function getUserByEmail(email) {
  return db
    .prepare(
      `
      SELECT email, full_name, role_title, department, permission_level, view_type, vp_type
      FROM users
      WHERE lower(email) = lower(?)
    `
    )
    .get(String(email || "").trim().toLowerCase());
}

function userMatchesRequestedWorkspace(user, requestedRole, profile = {}) {
  const mode = String(requestedRole || "board").toLowerCase();
  if (mode === "president") {
    return user.permission_level === "president" || user.view_type === "president";
  }
  if (mode === "vp-internal") {
    return (user.permission_level === "vp" || user.view_type === "vp") && user.vp_type === "internal";
  }
  if (mode === "vp-external") {
    return (user.permission_level === "vp" || user.view_type === "vp") && user.vp_type === "external";
  }
  if (mode === "board") {
    if (user.permission_level === "president" || user.permission_level === "vp") return false;
    const requestedTitle = String(profile?.title || "").trim();
    if (requestedTitle) return user.role_title === requestedTitle;
    return user.view_type === "board" || user.permission_level === "board";
  }
  return false;
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (_e) {
    return fallback;
  }
}

function toJson(value) {
  return JSON.stringify(value == null ? null : value);
}

function listUsersInScope(user) {
  let sql = `
    SELECT email, full_name, role_title, department, permission_level, view_type, vp_type
    FROM users
  `;
  const params = {};
  if (user.permission_level === "vp" || user.view_type === "vp") {
    sql += " WHERE vp_type = @vpType OR permission_level = 'president' OR view_type = 'president'";
    params.vpType = user.vp_type || "internal";
  }
  sql += " ORDER BY department ASC, role_title ASC, full_name ASC";
  return db.prepare(sql).all(params);
}

function resolveAssigneeForTask(task, fallbackUser) {
  const roleHint = String(task.role || task.ownerSuggestion || task.owner_role || "").trim();
  const divisionHint = normalizeDivision(task.division || task.vp_scope);
  const departmentHint = String(task.department || "").trim();
  let sql = `
    SELECT email, full_name, role_title, department, vp_type
    FROM users
    WHERE 1=1
  `;
  const params = {};
  if (roleHint) {
    sql += " AND lower(role_title) LIKE lower(@roleLike)";
    params.roleLike = `%${roleHint}%`;
  } else if (departmentHint) {
    sql += " AND lower(department) LIKE lower(@deptLike)";
    params.deptLike = `%${departmentHint}%`;
  }
  if (divisionHint) {
    sql += " AND vp_type = @vpType";
    params.vpType = divisionHint;
  }
  sql += " ORDER BY rowid ASC LIMIT 1";
  const match = db.prepare(sql).get(params);
  return {
    ownerEmail: match?.email || fallbackUser.email,
    ownerName: match?.full_name || fallbackUser.full_name,
    ownerRole: match?.role_title || fallbackUser.role_title,
    department: match?.department || departmentHint || fallbackUser.department || "Board Operations",
    vpScope: match?.vp_type || divisionHint || fallbackUser.vp_type || null
  };
}

function recomputeTaskStatusesForEvent(eventId) {
  const tasks = db
    .prepare(
      `
      SELECT id, status, due_at
      FROM tasks
      WHERE event_id = ?
    `
    )
    .all(eventId);
  const depsByTask = new Map();
  db.prepare(
    `
    SELECT task_id, depends_on_task_id
    FROM task_dependencies
    WHERE task_id IN (SELECT id FROM tasks WHERE event_id = ?)
  `
  )
    .all(eventId)
    .forEach((d) => {
      const arr = depsByTask.get(d.task_id) || [];
      arr.push(d.depends_on_task_id);
      depsByTask.set(d.task_id, arr);
    });
  const statusById = new Map(tasks.map((t) => [t.id, t.status]));
  tasks.forEach((task) => {
    if (["completed", "pending_review", "redo"].includes(task.status)) return;
    const deps = depsByTask.get(task.id) || [];
    const overdue = new Date(task.due_at).getTime() < Date.now();
    let nextStatus = overdue ? "overdue" : "current";
    if (deps.length && deps.some((depId) => statusById.get(depId) !== "completed")) {
      nextStatus = overdue ? "overdue" : "locked";
    }
    db.prepare(`UPDATE tasks SET status = ? WHERE id = ?`).run(nextStatus, task.id);
  });
}

function wouldCreateCircularDependency(taskId, dependencyIds) {
  const graph = new Map();
  db.prepare(`SELECT task_id, depends_on_task_id FROM task_dependencies`)
    .all()
    .forEach((row) => {
      const arr = graph.get(row.depends_on_task_id) || [];
      arr.push(row.task_id);
      graph.set(row.depends_on_task_id, arr);
    });
  const stack = [...dependencyIds];
  const seen = new Set();
  while (stack.length) {
    const current = Number(stack.pop());
    if (!Number.isFinite(current) || seen.has(current)) continue;
    if (current === taskId) return true;
    seen.add(current);
    (graph.get(current) || []).forEach((next) => stack.push(next));
  }
  return false;
}

function upsertUserByEmail(email, fullName, requestedRole, profile = {}) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!isUmnEmail(normalizedEmail)) return null;
  const requestedRoleInfo = classifyRoleFromMode(requestedRole);
  const boardDivision = normalizeDivision(profile?.division);
  const boardTitle = String(profile?.title || "")
    .trim()
    .replace(/\s+/g, " ");
  const boardName = `${String(profile?.first_name || "").trim()} ${String(
    profile?.last_name || ""
  ).trim()}`.trim();
  const desiredName =
    requestedRoleInfo.permission_level === "board" && boardName
      ? boardName
      : String(fullName || "")
          .trim()
          .replace(/\s+/g, " ");
  const desiredRoleTitle =
    requestedRoleInfo.permission_level === "board" && boardTitle
      ? boardTitle
      : requestedRoleInfo.role_title;
  const desiredDepartment =
    requestedRoleInfo.permission_level === "board" && boardDivision
      ? boardDivision === "internal"
        ? "Internal Division"
        : "External Division"
      : "Board Operations";
  const desiredVpType =
    requestedRoleInfo.permission_level === "vp"
      ? requestedRoleInfo.vp_type
      : requestedRoleInfo.permission_level === "board"
      ? boardDivision
      : null;

  const existing = db
    .prepare(
      `
      SELECT email, full_name, role_title, department, permission_level, view_type, vp_type
      FROM users
      WHERE lower(email) = lower(?)
    `
    )
    .get(normalizedEmail);

  if (existing) {
    const shouldUpdateRole =
      existing.permission_level !== requestedRoleInfo.permission_level ||
      existing.view_type !== requestedRoleInfo.view_type ||
      existing.role_title !== desiredRoleTitle ||
      existing.department !== desiredDepartment ||
      String(existing.vp_type || "") !== String(desiredVpType || "");
    const nextName = desiredName || existing.full_name;

    if (shouldUpdateRole || nextName !== existing.full_name) {
      db.prepare(
        `
        UPDATE users
        SET full_name = ?, role_title = ?, department = ?, permission_level = ?, view_type = ?, vp_type = ?
        WHERE lower(email) = lower(?)
      `
      ).run(
        nextName,
        desiredRoleTitle,
        desiredDepartment,
        requestedRoleInfo.permission_level,
        requestedRoleInfo.view_type,
        desiredVpType,
        normalizedEmail
      );
    }

    return db
      .prepare(
        `
        SELECT email, full_name, role_title, department, permission_level, view_type, vp_type
        FROM users
        WHERE lower(email) = lower(?)
      `
      )
      .get(normalizedEmail);
  }

  const inferredName =
    desiredName ||
    normalizedEmail
      .split("@")[0]
      .split(".")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  db.prepare(
    `
    INSERT INTO users (email, full_name, role_title, department, permission_level, view_type, vp_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    normalizedEmail,
    inferredName,
    desiredRoleTitle,
    desiredDepartment,
    requestedRoleInfo.permission_level,
    requestedRoleInfo.view_type,
    desiredVpType
  );

  return db
    .prepare(
      `
      SELECT email, full_name, role_title, department, permission_level, view_type, vp_type
      FROM users
      WHERE lower(email) = lower(?)
    `
    )
    .get(normalizedEmail);
}

function createSession(user) {
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + 1000 * 60 * 60 * 8;
  db.prepare(
    `
    INSERT INTO sessions (token, user_email, expires_at)
    VALUES (?, ?, ?)
  `
  ).run(token, user.email, expiresAt);
  return { token, expiresAt };
}

function getUserFromSession(token) {
  if (!token) return null;
  const session = db
    .prepare(
      `
      SELECT token, user_email, expires_at
      FROM sessions
      WHERE token = ?
    `
    )
    .get(token);

  if (!session) return null;
  if (session.expires_at < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
    return null;
  }

  return db
    .prepare(
      `
      SELECT email, full_name, role_title, department, permission_level, view_type, vp_type
      FROM users
      WHERE email = ?
    `
    )
    .get(session.user_email);
}

function selectDashboardData(user) {
  const users = listUsersInScope(user);
  const seededEmails = new Set(users.map((u) => u.email));

  const rolePredicate =
    user.permission_level === "president"
      ? "1=1"
      : user.permission_level === "vp"
      ? "((owner_email = @email) OR (vp_scope = @vpType))"
      : "(owner_email = @email OR visibility = 'board')";

  const rawTasks = db
    .prepare(
      `
      SELECT
        id, event_id, title, description, owner_email, owner_name, owner_role,
        department, status, unlock_at, due_at, priority, visibility, vp_scope,
        meeting_date, meeting_time, meeting_location, meeting_link, previous_summary,
        notes, attachments_json, redo_rules, escalation_rules, phase
      FROM tasks
      WHERE ${rolePredicate}
      ORDER BY datetime(due_at) ASC
      LIMIT 120
    `
    )
    .all({ email: user.email, vpType: user.vp_type });
  const onlySeededTasks = rawTasks.filter((t) => seededEmails.has(t.owner_email));
  const tasks =
    user.permission_level === "president"
      ? onlySeededTasks.map((t) => (t.status === "locked" ? { ...t, status: "current" } : t))
      : onlySeededTasks;

  const eventsRaw = db
    .prepare(
      `
      SELECT id, name, event_date, event_type, scope, progress, status,
        budget_limit, venue, location, planning_notes, timeline_assumptions,
        workflow_json, divisions_json, roles_json, deliverables_json, constraints_json, hard_deadline
      FROM events
      ORDER BY datetime(event_date) ASC
      LIMIT 40
    `
    )
    .all();
  const events = eventsRaw.map((e) => ({
    ...e,
    workflow_json: safeJsonParse(e.workflow_json, []),
    divisions_json: safeJsonParse(e.divisions_json, []),
    roles_json: safeJsonParse(e.roles_json, []),
    deliverables_json: safeJsonParse(e.deliverables_json, {}),
    constraints_json: safeJsonParse(e.constraints_json, {})
  }));

  const rawDeps = db
    .prepare(
      `
      SELECT td.task_id, td.depends_on_task_id
      FROM task_dependencies td
      JOIN tasks t ON t.id = td.task_id
      WHERE ${rolePredicate.replaceAll("owner_email", "t.owner_email").replaceAll("visibility", "t.visibility").replaceAll("vp_scope", "t.vp_scope")}
      LIMIT 300
    `
    )
    .all({ email: user.email, vpType: user.vp_type });
  const taskIds = new Set(tasks.map((t) => t.id));
  const dependencies = rawDeps.filter(
    (d) => taskIds.has(d.task_id) && taskIds.has(d.depends_on_task_id)
  );

  const reports =
    user.permission_level === "president" || user.view_type === "president" || user.view_type === "board"
      ? db
          .prepare(
            `
            SELECT
              r.id, r.submitted_by_email, r.submitted_by_name, r.submitted_by_role,
              r.division, r.event_id, r.task_id, r.reason, r.notes, r.recommended_action,
              r.status, r.clarification_notes, r.created_at,
              e.name AS event_name, t.title AS task_title
            FROM reports r
            LEFT JOIN events e ON e.id = r.event_id
            LEFT JOIN tasks t ON t.id = r.task_id
            ORDER BY datetime(r.created_at) DESC
            LIMIT 200
          `
          )
          .all()
      : [];

  return { tasks, events, dependencies, users, reports };
}

async function verifyGoogleIdToken(idToken) {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID
  });
  return ticket.getPayload();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "ssa-ops" });
});

app.get("/api/config/public", (_req, res) => {
  res.json({
    googleClientIdConfigured: Boolean(GOOGLE_CLIENT_ID),
    googleClientSecretConfigured: Boolean(GOOGLE_CLIENT_SECRET),
    geminiConfigured: Boolean(GEMINI_API_KEY),
    googleClientId: GOOGLE_CLIENT_ID || ""
  });
});

app.get("/api/public/site-content", (_req, res) => {
  const content = readSiteContent();
  res.json(content);
});

app.post("/api/auth/google", async (req, res) => {
  try {
    const { credential, role, profile } = req.body || {};
    if (!credential) {
      return res.status(400).json({ error: "Missing Google credential token." });
    }

    const payload = await verifyGoogleIdToken(credential);
    const email = String(payload?.email || "").toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "Google account email not found." });
    }
    if (!isUmnEmail(email)) {
      return res
        .status(403)
        .json({ error: "Only @umn.edu emails can access this workspace." });
    }
    const mappedUser = getUserByEmail(email);
    if (!mappedUser) {
      return res.status(403).json({
        error: "This email is not authorized in board role mappings."
      });
    }
    if (!userMatchesRequestedWorkspace(mappedUser, role, profile || {})) {
      return res.status(403).json({
        error: "This email is not authorized for the selected workspace mode."
      });
    }

    const { token, expiresAt } = createSession(mappedUser);
    res.json({
      token,
      expiresAt,
      user: mappedUser,
      redirect_to: resolveRedirectPath(mappedUser, role)
    });
  } catch (error) {
    res.status(401).json({
      error:
        "Google sign-in verification failed. If you see origin_mismatch, add your local URL in Google Cloud OAuth authorized JavaScript origins."
    });
  }
});

app.post("/api/auth/dev", (req, res) => {
  const { email, role, profile } = req.body || {};
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return res.status(400).json({ error: "Email is required." });
  if (!isUmnEmail(normalized)) {
    return res.status(403).json({ error: "Only @umn.edu emails are allowed." });
  }
  const mappedUser = getUserByEmail(normalized);
  if (!mappedUser) {
    return res.status(403).json({ error: "This email is not authorized in board role mappings." });
  }
  if (!userMatchesRequestedWorkspace(mappedUser, role, profile || {})) {
    return res.status(403).json({ error: "This email is not authorized for the selected workspace mode." });
  }
  const { token, expiresAt } = createSession(mappedUser);
  res.json({
    token,
    expiresAt,
    user: mappedUser,
    redirect_to: resolveRedirectPath(mappedUser, role)
  });
});

app.get("/api/me", (req, res) => {
  const token = req.header("x-session-token") || req.query.token;
  const user = getUserFromSession(token);
  if (!user) {
    return res.status(401).json({ error: "Invalid session." });
  }
  return res.json({ user });
});

app.get("/api/dashboard", (req, res) => {
  const token = req.header("x-session-token") || req.query.token;
  const user = getUserFromSession(token);
  if (!user) {
    return res.status(401).json({ error: "Invalid session." });
  }
  const data = selectDashboardData(user);
  res.json({ user, ...data });
});

app.get("/api/tasks/all-for-prereq", (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  if (user.permission_level !== "president" && user.permission_level !== "vp" && user.view_type !== "president" && user.view_type !== "vp") {
    return res.status(403).json({ error: "Admin access required." });
  }
  const tasks = db
    .prepare(
      `
      SELECT id, title, owner_email, owner_name, owner_role, department, status
      FROM tasks
      ORDER BY title ASC
      LIMIT 500
    `
    )
    .all();
  res.json({ tasks });
});

app.get("/api/submissions/pending", (req, res) => {
  const token = req.header("x-session-token") || req.query.token;
  const user = getUserFromSession(token);
  if (!user) {
    return res.status(401).json({ error: "Invalid session." });
  }
  if (user.permission_level !== "president" && user.permission_level !== "vp") {
    return res.status(403).json({ error: "Admin access required." });
  }

  const pending = db
    .prepare(
      `
      SELECT
        s.id, s.task_id, s.submitted_by_email, s.summary, s.proof_links, s.comments,
        s.difficulty, s.questions, s.feedback, s.created_at,
        t.title, t.owner_name, t.department, t.status
      FROM task_submissions s
      JOIN tasks t ON t.id = s.task_id
      JOIN users u ON u.email = t.owner_email
      WHERE t.status = 'pending_review'
      ORDER BY datetime(s.created_at) DESC
      LIMIT 200
    `
    )
    .all();
  res.json({ pending });
});

app.post("/api/tasks/:id/submit", (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) {
    return res.status(401).json({ error: "Invalid session." });
  }

  const taskId = Number(req.params.id);
  if (!Number.isFinite(taskId)) {
    return res.status(400).json({ error: "Invalid task id." });
  }

  const task = db
    .prepare(
      `
      SELECT id, owner_email, status, unlock_at
      FROM tasks
      WHERE id = ?
    `
    )
    .get(taskId);
  if (!task) {
    return res.status(404).json({ error: "Task not found." });
  }
  if (task.owner_email !== user.email) {
    return res.status(403).json({ error: "You can only submit your own task." });
  }
  if (new Date(task.unlock_at).getTime() > Date.now()) {
    return res.status(400).json({ error: "Task is still locked." });
  }

  const {
    summary = "",
    proofLinks = "",
    comments = "",
    difficulty = "",
    questions = "",
    feedback = ""
  } = req.body || {};
  if (!String(summary).trim()) {
    return res.status(400).json({ error: "Summary is required." });
  }

  db.prepare(
    `
    INSERT INTO task_submissions (
      task_id, submitted_by_email, summary, proof_links, comments, difficulty, questions, feedback
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    taskId,
    user.email,
    String(summary),
    String(proofLinks),
    String(comments),
    String(difficulty),
    String(questions),
    String(feedback)
  );

  db.prepare(
    `
    UPDATE tasks
    SET status = 'pending_review', previous_summary = ?
    WHERE id = ?
  `
  ).run(String(summary), taskId);

  res.json({ ok: true });
});

// Generic upload for president/VP (e.g. task attachments in edit modal)
app.post("/api/upload", upload.array("files", 10), (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  if (user.permission_level !== "president" && user.permission_level !== "vp") {
    return res.status(403).json({ error: "Admin access required." });
  }
  const paths = (req.files || []).map((f) => `/uploads/${f.filename}`);
  res.json({ paths });
});

app.post("/api/tasks/:id/submit-form", upload.array("attachments", 8), (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) {
    return res.status(401).json({ error: "Invalid session." });
  }

  const taskId = Number(req.params.id);
  if (!Number.isFinite(taskId)) {
    return res.status(400).json({ error: "Invalid task id." });
  }

  const task = db
    .prepare(
      `
      SELECT id, owner_email, unlock_at
      FROM tasks
      WHERE id = ?
    `
    )
    .get(taskId);
  if (!task) {
    return res.status(404).json({ error: "Task not found." });
  }
  if (task.owner_email !== user.email) {
    return res.status(403).json({ error: "You can only submit your own task." });
  }
  if (new Date(task.unlock_at).getTime() > Date.now()) {
    return res.status(400).json({ error: "Task is still locked." });
  }

  const body = req.body || {};
  const summary = String(body.summary || "").trim();
  if (!summary) {
    return res.status(400).json({ error: "Summary is required." });
  }

  const uploadedPaths = (req.files || []).map((f) => `/uploads/${f.filename}`);
  const proofLinks = [String(body.proofLinks || "").trim(), ...uploadedPaths]
    .filter(Boolean)
    .join("\n");

  db.prepare(
    `
    INSERT INTO task_submissions (
      task_id, submitted_by_email, summary, proof_links, comments, difficulty, questions, feedback
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    taskId,
    user.email,
    summary,
    proofLinks,
    String(body.comments || ""),
    String(body.difficulty || ""),
    String(body.questions || ""),
    String(body.feedback || "")
  );

  db.prepare(
    `
    UPDATE tasks
    SET status = 'pending_review', previous_summary = ?
    WHERE id = ?
  `
  ).run(summary, taskId);

  res.json({ ok: true, uploaded: uploadedPaths });
});

app.post("/api/tasks/:id/approve", (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) {
    return res.status(401).json({ error: "Invalid session." });
  }
  if (user.permission_level !== "president" && user.permission_level !== "vp") {
    return res.status(403).json({ error: "Admin access required." });
  }

  const taskId = Number(req.params.id);
  db.prepare(
    `
    UPDATE tasks
    SET status = 'completed'
    WHERE id = ?
  `
  ).run(taskId);

  res.json({ ok: true });
});

app.post("/api/tasks/:id/redo", (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) {
    return res.status(401).json({ error: "Invalid session." });
  }
  if (user.permission_level !== "president" && user.permission_level !== "vp") {
    return res.status(403).json({ error: "Admin access required." });
  }

  const taskId = Number(req.params.id);
  const { notes = "", updatedDueAt = null } = req.body || {};
  if (!String(notes).trim()) {
    return res.status(400).json({ error: "Redo notes are required." });
  }

  db.prepare(
    `
    INSERT INTO redo_requests (task_id, requested_by_email, notes, updated_due_at)
    VALUES (?, ?, ?, ?)
  `
  ).run(taskId, user.email, String(notes), updatedDueAt ? String(updatedDueAt) : null);

  if (updatedDueAt) {
    db.prepare(
      `
      UPDATE tasks
      SET status = 'redo', due_at = ?
      WHERE id = ?
    `
    ).run(String(updatedDueAt), taskId);
  } else {
    db.prepare(
      `
      UPDATE tasks
      SET status = 'redo'
      WHERE id = ?
    `
    ).run(taskId);
  }

  res.json({ ok: true });
});

app.get("/api/poll", (req, res) => {
  const token = req.header("x-session-token") || req.query.token;
  const user = getUserFromSession(token);
  if (!user) {
    return res.status(401).json({ error: "Invalid session." });
  }

  // Auto-mark overdue tasks.
  db.prepare(
    `
    UPDATE tasks
    SET status = 'overdue'
    WHERE status IN ('current', 'locked', 'pending_review')
      AND datetime(due_at) < datetime('now')
  `
  ).run();

  const data = selectDashboardData(user);

  const pendingReview = data.tasks.filter((t) => t.status === "pending_review").length;

  const overdue = data.tasks.filter((t) => t.status === "overdue").length;

  const mine = db
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM tasks
      WHERE owner_email = ?
        AND status IN ('current', 'locked', 'pending_review', 'redo')
    `
    )
    .get(user.email).count;

  res.json({
    serverTime: new Date().toISOString(),
    alerts: { pendingReview, overdue, myActiveTasks: mine }
  });
});

app.get("/api/notifications", (req, res) => {
  const token = req.header("x-session-token") || req.query.token;
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });

  const data = selectDashboardData(user);
  const now = Date.now();
  const items = [];

  data.tasks
    .filter((t) => t.status === "pending_review")
    .slice(0, 10)
    .forEach((t) => {
      items.push({
        type: "pending_review",
        title: `Pending review: ${t.title}`,
        sub: `${t.owner_name} · ${t.department}`,
        at: t.due_at
      });
    });

  data.tasks
    .filter((t) => t.status === "overdue")
    .slice(0, 10)
    .forEach((t) => {
      items.push({
        type: "overdue",
        title: `Overdue: ${t.title}`,
        sub: `${t.owner_name} · due ${new Date(t.due_at).toLocaleDateString()}`,
        at: t.due_at
      });
    });

  data.tasks
    .filter((t) => {
      const due = new Date(t.due_at).getTime();
      return Number.isFinite(due) && due > now && due - now <= 1000 * 60 * 60 * 24 * 3;
    })
    .slice(0, 8)
    .forEach((t) => {
      items.push({
        type: "due_soon",
        title: `Due soon: ${t.title}`,
        sub: `${t.owner_name} · ${new Date(t.due_at).toLocaleDateString()}`,
        at: t.due_at
      });
    });

  data.events
    .filter((e) => {
      const d = new Date(e.event_date).getTime();
      return Number.isFinite(d) && d > now && d - now <= 1000 * 60 * 60 * 24 * 7;
    })
    .slice(0, 8)
    .forEach((e) => {
      items.push({
        type: "event",
        title: `Upcoming event: ${e.name}`,
        sub: `${e.event_type} · ${new Date(e.event_date).toLocaleDateString()}`,
        at: e.event_date
      });
    });

  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  data.tasks
    .filter((t) => {
      const rules = String(t.escalation_rules || "").toLowerCase();
      if (!rules || rules === "none") return false;
      const due = new Date(t.due_at).getTime();
      if (!Number.isFinite(due) || due > now) return false;
      const pastTwoDays = now - due >= twoDaysMs;
      if (t.status === "completed") return false;
      if (rules.includes("notify_vp_2days") && pastTwoDays) {
        const dept = (t.department || "").toLowerCase();
        const isInternal = dept.includes("internal");
        if (user.permission_level === "vp" || user.view_type === "vp") {
          const vpType = (user.vp_type || "internal").toLowerCase();
          if (vpType === "internal" && isInternal) return true;
          if (vpType === "external" && !isInternal) return true;
        }
      }
      if (rules.includes("escalate_to_president") && pastTwoDays && (user.permission_level === "president" || user.view_type === "president")) return true;
      if (rules.includes("auto_remind") && (t.owner_email || "").toLowerCase() === (user.email || "").toLowerCase()) return true;
      return false;
    })
    .slice(0, 10)
    .forEach((t) => {
      const rules = String(t.escalation_rules || "").toLowerCase();
      const dept = (t.department || "").toLowerCase();
      const isInternal = dept.includes("internal");
      if (rules.includes("notify_vp_2days") && (user.permission_level === "vp" || user.view_type === "vp")) {
        const vpType = (user.vp_type || "internal").toLowerCase();
        if ((vpType === "internal" && isInternal) || (vpType === "external" && !isInternal)) {
          items.push({
            type: "escalation_vp",
            title: `Notify VP: ${t.title}`,
            sub: `${t.owner_name} · ${t.department} · overdue`,
            at: t.due_at
          });
        }
      }
      if (rules.includes("escalate_to_president") && (user.permission_level === "president" || user.view_type === "president")) {
        items.push({
          type: "escalation_president",
          title: `Escalate: ${t.title}`,
          sub: `${t.owner_name} · due ${new Date(t.due_at).toLocaleDateString()}`,
          at: t.due_at
        });
      }
      if (rules.includes("auto_remind") && (t.owner_email || "").toLowerCase() === (user.email || "").toLowerCase()) {
        items.push({
          type: "remind_assignee",
          title: `Reminder: ${t.title}`,
          sub: `Due ${new Date(t.due_at).toLocaleDateString()}`,
          at: t.due_at
        });
      }
    });

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  res.json({
    count: items.length,
    items: items.slice(0, 20),
    stats: {
      pendingReview: items.filter((i) => i.type === "pending_review").length,
      overdue: items.filter((i) => i.type === "overdue").length
    }
  });
});

app.post("/api/reports", (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  if (!(user.permission_level === "vp" || user.view_type === "vp")) {
    return res.status(403).json({ error: "VP access required." });
  }

  const body = req.body || {};
  const reason = String(body.reason || "").trim();
  const notes = String(body.notes || "").trim();
  if (!reason || !notes) {
    return res.status(400).json({ error: "Reason and notes are required." });
  }

  const info = db
    .prepare(
      `
      INSERT INTO reports (
        submitted_by_email, submitted_by_name, submitted_by_role, division,
        event_id, task_id, reason, notes, recommended_action, status, clarification_notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `
    )
    .run(
      user.email,
      user.full_name,
      user.role_title,
      user.department,
      body.event_id ? Number(body.event_id) : null,
      body.task_id ? Number(body.task_id) : null,
      reason,
      notes,
      String(body.recommended_action || ""),
      String(body.clarification_notes || "")
    );

  res.json({ ok: true, id: info.lastInsertRowid });
});

app.patch("/api/reports/:id", (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  if (!(user.permission_level === "president" || user.view_type === "president")) {
    return res.status(403).json({ error: "President access required." });
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid report id." });
  const body = req.body || {};
  db.prepare(
    `
    UPDATE reports
    SET
      status = COALESCE(@status, status),
      clarification_notes = COALESCE(@clarification_notes, clarification_notes)
    WHERE id = @id
  `
  ).run({
    id,
    status: body.status ? String(body.status) : null,
    clarification_notes: body.clarification_notes ? String(body.clarification_notes) : null
  });

  res.json({ ok: true });
});

// Submit suggestion from join.html (public, no auth)
app.post("/api/suggestions", (req, res) => {
  const body = req.body || {};
  const submitterName = body.submitter_name != null ? String(body.submitter_name).trim() : "";
  const suggestionType = String(body.suggestion_type || "").trim();
  const ideaText = String(body.idea_text || "").trim();
  const audience = body.audience != null ? String(body.audience).trim() : "";
  if (!ideaText) return res.status(400).json({ error: "Idea or suggestion text is required." });
  if (!suggestionType) return res.status(400).json({ error: "Suggestion type is required." });

  const info = db
    .prepare(
      `
    INSERT INTO suggestions (submitter_name, suggestion_type, idea_text, audience, status)
    VALUES (?, ?, ?, ?, 'new')
  `
    )
    .run(submitterName || null, suggestionType, ideaText, audience || null);
  res.json({ ok: true, id: info.lastInsertRowid });
});

// List suggestions (Internal VP only)
app.get("/api/suggestions", (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  const isInternalVp =
    (user.permission_level === "vp" || user.view_type === "vp") && user.vp_type === "internal";
  if (!isInternalVp) return res.status(403).json({ error: "Internal VP access required." });

  const rows = db.prepare(`SELECT id, submitter_name, suggestion_type, idea_text, audience, status, created_at FROM suggestions ORDER BY created_at DESC`).all();
  res.json({ suggestions: rows });
});

app.post("/api/events/generate", async (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) {
    return res.status(401).json({ error: "Invalid session." });
  }
  if (user.permission_level !== "president" && user.permission_level !== "vp") {
    return res.status(403).json({ error: "Only admins can generate plans." });
  }

  const payload = req.body || {};
  const actualBoard = listUsersInScope(user).map((u) => ({
    full_name: u.full_name,
    role_title: u.role_title,
    department: u.department,
    vp_type: u.vp_type
  }));
  const prompt = `
You are planning operations tasks for a student organization board.
Return JSON with this exact shape only (no extra fields, no trailing commas):
{
  "tasks": [
    {
      "title": "string",
      "department": "string",
      "role": "exact real role title from the board list below",
      "ownerSuggestion": "string",
      "unlockOffsetDaysBeforeEvent": number,
      "dueOffsetDaysBeforeEvent": number,
      "priority": "low|medium|high|urgent",
      "dependsOnTitles": ["string"],
      "description": "string",
      "phase": "Planning|Pre-Event|Execution|Wrap-up",
      "goals": "string",
      "successCriteria": "string",
      "whatWeDontWant": "string"
    }
  ]
}

Rules:
- Use ONLY real roles from the board roster. Use exact role titles.
- phase: use exactly one of Planning, Pre-Event, Execution, Wrap-up (this maps to the dependency graph).
- title: clear, specific task name (one short sentence or phrase; descriptive, not vague).
- description: 2–4 sentences: scope, context, what the task involves, and why it matters.
- goals: 1–2 sentences on what we're trying to achieve with this task.
- successCriteria: 1–2 sentences on how we know this task is done well (concrete outcomes).
- whatWeDontWant: 1–2 sentences on what to avoid or common pitfalls.
Keep the full JSON valid and complete. Do not truncate.

Board roster:
${JSON.stringify(actualBoard, null, 2)}

Event details:
${JSON.stringify(payload, null, 2)}
`;

  if (!GEMINI_API_KEY) {
    return res.status(400).json({
      error: "GEMINI_API_KEY is missing. Add it in .env to enable Gemini generation."
    });
  }

  try {
    const parseTasksPayload = (rawText) => {
      const text = String(rawText || "").trim();
      if (!text) return null;

      const cleaned = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      const candidates = [cleaned];
      const objectMatch = cleaned.match(/\{[\s\S]*\}/);
      if (objectMatch) candidates.push(objectMatch[0]);

      for (const candidate of candidates) {
        try {
          const parsed = JSON.parse(candidate);
          if (parsed && Array.isArray(parsed.tasks)) return parsed;
        } catch (_e) {
          // try next candidate
        }
      }
      return null;
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
        GEMINI_API_KEY
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    `${prompt}\n\nReturn ONLY valid JSON. No markdown, no prose, no extra text. Ensure the entire JSON is complete (no cut-off descriptions).`
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({
        error: "Gemini generation failed.",
        details: String(errText).slice(0, 400)
      });
    }

    const json = await response.json();
    const text = (json?.candidates || [])
      .flatMap((c) => c?.content?.parts || [])
      .map((p) => p?.text || "")
      .join("\n");

    let parsed = parseTasksPayload(text);

    if (!parsed) {
      // One repair attempt: ask Gemini to convert its prior output into strict JSON.
      const repairResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
          GEMINI_API_KEY
        )}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text:
                      `Convert the following text into valid JSON with shape {"tasks":[...]} and no markdown fences.\n\n${text}`
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 8192,
              responseMimeType: "application/json"
            }
          })
        }
      );
      if (repairResponse.ok) {
        const repairJson = await repairResponse.json();
        const repairText = (repairJson?.candidates || [])
          .flatMap((c) => c?.content?.parts || [])
          .map((p) => p?.text || "")
          .join("\n");
        parsed = parseTasksPayload(repairText);
      }
    }

    if (parsed && Array.isArray(parsed.tasks)) {
      return res.json({ generated: parsed.tasks, model: "gemini-2.5-flash" });
    }

    return res.status(502).json({
      error: "Gemini returned non-JSON task payload.",
      details: String(text).slice(0, 400)
    });
  } catch (error) {
    return res.status(500).json({
      error: "Unable to call Gemini API.",
      details: String(error?.message || error)
    });
  }
});

function computeDateFromOffsets(eventDateIso, offsetDays) {
  const base = new Date(eventDateIso);
  if (!Number.isFinite(base.getTime())) return new Date();
  const out = new Date(base);
  out.setDate(out.getDate() - Number(offsetDays || 0));
  return out;
}

app.post("/api/events/publish", (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) {
    return res.status(401).json({ error: "Invalid session." });
  }

  const { event, tasks = [] } = req.body || {};
  if (!event?.name || !event?.event_date) {
    return res.status(400).json({ error: "Event name and date are required." });
  }
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: "At least one task is required." });
  }

  const insertEvent = db.prepare(
    `
    INSERT INTO events (
      name, event_date, event_type, scope, progress, status, budget_limit, venue, location,
      planning_notes, timeline_assumptions, workflow_json, divisions_json, roles_json,
      deliverables_json, constraints_json, hard_deadline
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  );
  const insertTask = db.prepare(
    `
    INSERT INTO tasks (
      event_id, title, description, owner_email, owner_name, owner_role,
      department, status, unlock_at, due_at, priority, visibility, vp_scope,
        meeting_date, meeting_time, meeting_location, meeting_link, previous_summary,
        notes, attachments_json, redo_rules, escalation_rules, phase
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  );
  const insertDep = db.prepare(
    `
    INSERT INTO task_dependencies (task_id, depends_on_task_id)
    VALUES (?, ?)
  `
  );

  const result = db.transaction(() => {
    const eventId = insertEvent.run(
      String(event.name),
      String(event.event_date),
      String(event.event_type || "Custom Event"),
      String(event.scope || "Custom"),
      0,
      "upcoming",
      event.budget_limit != null && event.budget_limit !== "" ? Number(event.budget_limit) : null,
      String(event.venue || ""),
      String(event.location || event.venue || ""),
      String(event.planning_notes || event.custom_prompt || ""),
      String(event.timeline_assumptions || event.sequencing || ""),
      toJson(event.workflow || []),
      toJson(event.divisions || []),
      toJson(event.roles || []),
      toJson(event.deliverables_by_role || {}),
      toJson(event.constraints || {}),
      event.hard_deadline ? String(event.hard_deadline) : null
    ).lastInsertRowid;

    const taskIdByTitle = new Map();
    const insertedRows = [];

    tasks.forEach((task) => {
      const dept = String(task.department || "Board Operations");
      const assignee = resolveAssigneeForTask(task, user);
      const unlockAt = task.unlock_at
        ? new Date(task.unlock_at)
        : computeDateFromOffsets(event.event_date, task.unlockOffsetDaysBeforeEvent || 14);
      const dueAt = task.due_at
        ? new Date(task.due_at)
        : computeDateFromOffsets(event.event_date, task.dueOffsetDaysBeforeEvent || 7);

      const newTaskId = insertTask.run(
        eventId,
        String(task.title || "Untitled Task"),
        String(task.description || "Auto-generated task."),
        assignee.ownerEmail,
        assignee.ownerName,
        assignee.ownerRole,
        assignee.department || dept,
        "current",
        unlockAt.toISOString(),
        dueAt.toISOString(),
        String(task.priority || "medium"),
        "board",
        assignee.vpScope,
        task.meeting_date ? String(task.meeting_date) : null,
        task.meeting_time ? String(task.meeting_time) : null,
        task.meeting_location ? String(task.meeting_location) : null,
        task.meeting_link ? String(task.meeting_link) : null,
        String(task.previous_summary || ""),
        String(task.notes || ""),
        toJson(task.attachments || []),
        String(task.redo_rules || ""),
        String(task.escalation_rules || ""),
        String(task.phase || "")
      ).lastInsertRowid;

      insertedRows.push({
        id: newTaskId,
        title: String(task.title || "Untitled Task")
      });
      taskIdByTitle.set(String(task.title || "Untitled Task"), newTaskId);
    });

    tasks.forEach((task) => {
      const currentId = taskIdByTitle.get(String(task.title || ""));
      const deps = Array.isArray(task.dependsOnTitles)
        ? task.dependsOnTitles
        : task.depends_on_titles || [];
      deps.forEach((depTitle) => {
        const depId = taskIdByTitle.get(String(depTitle));
        if (currentId && depId) insertDep.run(currentId, depId);
      });
    });

    recomputeTaskStatusesForEvent(eventId);

    return { eventId, insertedRows };
  })();

  res.json({ ok: true, event_id: result.eventId, tasks: result.insertedRows });
});

app.get("/api/assign/suggestions", (req, res) => {
  const token = req.header("x-session-token") || req.query.token;
  const user = getUserFromSession(token);
  if (!user) {
    return res.status(401).json({ error: "Invalid session." });
  }
  if (!isAdminUser(user)) {
    return res.status(403).json({ error: "Admin access required." });
  }

  const role = String(req.query.role || "").trim();
  if (!role) return res.json({ suggestions: [] });
  let sql = `
    SELECT email, full_name, role_title, department, permission_level, vp_type
    FROM users
    WHERE lower(role_title) LIKE lower(@roleLike)
  `;
  const params = { roleLike: `%${role}%` };
  if (user.permission_level === "vp" || user.view_type === "vp") {
    sql += " AND vp_type = @vpType";
    params.vpType = user.vp_type || "internal";
  }
  const members = db.prepare(sql).all(params);

  const withStats = members.map((m) => {
    const activeCount = db
      .prepare(
        `
      SELECT COUNT(*) AS count
      FROM tasks
      WHERE owner_email = ?
        AND status IN ('current', 'locked', 'pending_review', 'redo')
    `
      )
      .get(m.email).count;

    const completedCount = db
      .prepare(
        `
      SELECT COUNT(*) AS count
      FROM tasks
      WHERE owner_email = ?
        AND status = 'completed'
    `
      )
      .get(m.email).count;

    const score =
      (m.role_title.toLowerCase() === role.toLowerCase() ? 50 : 25) +
      Math.max(0, 20 - activeCount * 3) +
      Math.min(30, completedCount * 2);

    return {
      ...m,
      activeCount,
      completedCount,
      score
    };
  });

  withStats.sort((a, b) => b.score - a.score);
  res.json({ suggestions: withStats.slice(0, 5) });
});

app.post("/api/tasks/assign", (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  if (!isAdminUser(user)) {
    return res.status(403).json({ error: "Admin access required." });
  }
  const isVpUser = user.permission_level === "vp" || user.view_type === "vp";
  const isPresidentUser =
    user.permission_level === "president" || user.view_type === "president";

  const {
    title,
    role,
    due_at,
    priority,
    description,
    assignee_email,
    event_id,
    unlock_at,
    meeting_date,
    meeting_time,
    meeting_location,
    meeting_link,
    notes,
    attachments,
    redo_rules,
    escalation_rules,
    dependency_task_ids = []
  } = req.body || {};
  const taskTitle = String(title || "").trim();
  const roleTitle = String(role || "").trim();
  const desc = String(description || "").trim();
  const prio = String(priority || "standard").trim().toLowerCase();
  if (!taskTitle || !roleTitle || !desc || !due_at) {
    return res.status(400).json({ error: "Title, role, due date, priority, and description are required." });
  }
  const due = new Date(due_at);
  if (!Number.isFinite(due.getTime())) return res.status(400).json({ error: "Invalid due date." });

  let userSql = `
    SELECT email, full_name, role_title, department, vp_type
    FROM users
    WHERE lower(role_title) LIKE lower(@roleLike)
  `;
  const params = { roleLike: `%${roleTitle}%` };
  if (isVpUser) {
    userSql += " AND vp_type = @vpType";
    params.vpType = user.vp_type || "internal";
  }
  const candidates = db.prepare(userSql).all(params);
  if (!candidates.length) {
    return res.status(400).json({ error: "No matching assignee found for that role in your scope." });
  }

  let assignee = null;
  if (assignee_email) {
    const target = String(assignee_email).trim().toLowerCase();
    assignee = candidates.find((c) => String(c.email).toLowerCase() === target) || null;
    if (!assignee) {
      return res.status(400).json({ error: "Chosen assignee is outside your allowed scope." });
    }
  } else {
    assignee = candidates
      .map((c) => {
        const activeCount = db
          .prepare(
            `
          SELECT COUNT(*) AS count
          FROM tasks
          WHERE owner_email = ?
            AND status IN ('current', 'locked', 'pending_review', 'redo')
        `
          )
          .get(c.email).count;
        return { ...c, activeCount };
      })
      .sort((a, b) => a.activeCount - b.activeCount)[0];
  }

  const nowIso = new Date().toISOString();
  const dueIso = due.toISOString();
  const unlockIso = unlock_at ? new Date(unlock_at).toISOString() : nowIso;
  const unlockMs = new Date(unlockIso).getTime();
  const status =
    new Date(dueIso).getTime() < Date.now()
      ? "overdue"
      : Array.isArray(dependency_task_ids) && dependency_task_ids.length
      ? "locked"
      : Number.isFinite(unlockMs) && unlockMs > Date.now()
      ? "locked"
      : "current";
  const vpScope = assignee.vp_type || (isVpUser ? user.vp_type : null);

  const taskId = db
    .prepare(
      `
      INSERT INTO tasks (
        event_id, title, description, owner_email, owner_name, owner_role,
        department, status, unlock_at, due_at, priority, visibility, vp_scope,
        meeting_date, meeting_time, meeting_location, meeting_link, previous_summary,
        notes, attachments_json, redo_rules, escalation_rules
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      event_id ? Number(event_id) : null,
      taskTitle,
      desc,
      assignee.email,
      assignee.full_name,
      assignee.role_title,
      assignee.department || "Board Operations",
      status,
      unlockIso,
      dueIso,
      prio,
      "board",
      isPresidentUser ? vpScope : user.vp_type || vpScope,
      meeting_date ? String(meeting_date) : null,
      meeting_time ? String(meeting_time) : null,
      meeting_location ? String(meeting_location) : null,
      meeting_link ? String(meeting_link) : null,
      "",
      String(notes || ""),
      toJson(Array.isArray(attachments) ? attachments : []),
      String(redo_rules || ""),
      String(escalation_rules || "")
    ).lastInsertRowid;

  if (Array.isArray(dependency_task_ids)) {
    dependency_task_ids
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id))
      .forEach((depId) => {
        db.prepare(`INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)`).run(taskId, depId);
      });
  }
  if (event_id) recomputeTaskStatusesForEvent(Number(event_id));

  return res.json({
    ok: true,
    task: {
      id: taskId,
      title: taskTitle,
      owner_email: assignee.email,
      owner_name: assignee.full_name,
      owner_role: assignee.role_title
    }
  });
});

app.patch("/api/tasks/:id", (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  if (!isAdminUser(user)) return res.status(403).json({ error: "Admin access required." });

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid task id." });
  const existing = db
    .prepare(`SELECT id, event_id, vp_scope, owner_email FROM tasks WHERE id = ?`)
    .get(id);
  if (!existing) return res.status(404).json({ error: "Task not found." });
  if ((user.permission_level === "vp" || user.view_type === "vp") && existing.vp_scope && existing.vp_scope !== user.vp_type) {
    return res.status(403).json({ error: "Task is outside your division scope." });
  }

  const body = req.body || {};
  let assignee = null;
  if (body.assignee_email || body.role || body.division) {
    const taskLike = {
      role: body.role,
      division: body.division,
      department: body.department
    };
    assignee = resolveAssigneeForTask(taskLike, user);
    if (body.assignee_email) {
      const selected = listUsersInScope(user).find(
        (u) => String(u.email).toLowerCase() === String(body.assignee_email).toLowerCase()
      );
      if (selected) {
        assignee = {
          ownerEmail: selected.email,
          ownerName: selected.full_name,
          ownerRole: selected.role_title,
          department: selected.department,
          vpScope: selected.vp_type || null
        };
      }
    }
  }
  const dependencyIds = Array.isArray(body.dependency_task_ids)
    ? body.dependency_task_ids.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x !== id)
    : null;
  if (dependencyIds && wouldCreateCircularDependency(id, dependencyIds)) {
    return res.status(400).json({ error: "Dependency change would create a circular dependency." });
  }
  db.prepare(
    `
    UPDATE tasks
    SET
      title = COALESCE(@title, title),
      description = COALESCE(@description, description),
      owner_email = COALESCE(@owner_email, owner_email),
      owner_name = COALESCE(@owner_name, owner_name),
      owner_role = COALESCE(@owner_role, owner_role),
      department = COALESCE(@department, department),
      event_id = COALESCE(@event_id, event_id),
      due_at = COALESCE(@due_at, due_at),
      unlock_at = COALESCE(@unlock_at, unlock_at),
      priority = COALESCE(@priority, priority),
      status = COALESCE(@status, status),
      meeting_date = COALESCE(@meeting_date, meeting_date),
      meeting_time = COALESCE(@meeting_time, meeting_time),
      meeting_location = COALESCE(@meeting_location, meeting_location),
      meeting_link = COALESCE(@meeting_link, meeting_link),
      notes = COALESCE(@notes, notes),
      attachments_json = COALESCE(@attachments_json, attachments_json),
      redo_rules = COALESCE(@redo_rules, redo_rules),
      escalation_rules = COALESCE(@escalation_rules, escalation_rules),
      vp_scope = COALESCE(@vp_scope, vp_scope)
    WHERE id = @id
  `
  ).run({
    id,
    title: body.title ? String(body.title) : null,
    description: body.description ? String(body.description) : null,
    owner_email: assignee?.ownerEmail || null,
    owner_name: assignee?.ownerName || null,
    owner_role: assignee?.ownerRole || (body.role ? String(body.role) : null),
    department: assignee?.department || (body.department ? String(body.department) : null),
    event_id:
      body.event_id === null ? null : body.event_id != null ? Number(body.event_id) : null,
    due_at: body.due_at ? String(body.due_at) : null,
    unlock_at: body.unlock_at ? String(body.unlock_at) : null,
    priority: body.priority ? String(body.priority) : null,
    status: body.status ? String(body.status) : null,
    meeting_date: body.meeting_date ? String(body.meeting_date) : null,
    meeting_time: body.meeting_time ? String(body.meeting_time) : null,
    meeting_location: body.meeting_location ? String(body.meeting_location) : null,
    meeting_link: body.meeting_link ? String(body.meeting_link) : null,
    notes: body.notes ? String(body.notes) : null,
    attachments_json: body.attachments ? toJson(body.attachments) : null,
    redo_rules: body.redo_rules ? String(body.redo_rules) : null,
    escalation_rules: body.escalation_rules ? String(body.escalation_rules) : null,
    vp_scope: assignee?.vpScope || (body.division ? normalizeDivision(body.division) : null)
  });
  if (dependencyIds) {
    db.prepare(`DELETE FROM task_dependencies WHERE task_id = ?`).run(id);
    dependencyIds.forEach((depId) => {
      db.prepare(`INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)`).run(id, depId);
    });
  }
  const nextEventId = body.event_id != null ? Number(body.event_id) : existing.event_id;
  if (Number.isFinite(Number(existing.event_id))) recomputeTaskStatusesForEvent(Number(existing.event_id));
  if (Number.isFinite(Number(nextEventId))) recomputeTaskStatusesForEvent(Number(nextEventId));
  res.json({ ok: true });
});

app.delete("/api/tasks/:id", (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  if (!isAdminUser(user)) return res.status(403).json({ error: "Admin access required." });
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid task id." });
  const existing = db.prepare(`SELECT id, vp_scope FROM tasks WHERE id = ?`).get(id);
  if (!existing) return res.status(404).json({ error: "Task not found." });
  if ((user.permission_level === "vp" || user.view_type === "vp") && existing.vp_scope && existing.vp_scope !== user.vp_type) {
    return res.status(403).json({ error: "Task is outside your division scope." });
  }
  db.prepare(`DELETE FROM task_dependencies WHERE task_id = ? OR depends_on_task_id = ?`).run(id, id);
  db.prepare(`DELETE FROM task_submissions WHERE task_id = ?`).run(id);
  db.prepare(`DELETE FROM redo_requests WHERE task_id = ?`).run(id);
  db.prepare(`DELETE FROM tasks WHERE id = ?`).run(id);
  res.json({ ok: true });
});

app.patch("/api/events/:id", (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  if (!isAdminUser(user)) return res.status(403).json({ error: "Admin access required." });
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid event id." });
  const existing = db
    .prepare(
      `
      SELECT id, event_date, roles_json, divisions_json, workflow_json
      FROM events
      WHERE id = ?
    `
    )
    .get(id);
  if (!existing) return res.status(404).json({ error: "Event not found." });

  const b = req.body || {};
  const warningCount =
    (b.event_date && b.event_date !== existing.event_date ? 1 : 0) +
    (b.roles && JSON.stringify(b.roles) !== String(existing.roles_json || "") ? 1 : 0) +
    (b.workflow && JSON.stringify(b.workflow) !== String(existing.workflow_json || "") ? 1 : 0);
  db.prepare(
    `
    UPDATE events
    SET
      name = COALESCE(@name, name),
      event_date = COALESCE(@event_date, event_date),
      event_type = COALESCE(@event_type, event_type),
      scope = COALESCE(@scope, scope),
      progress = COALESCE(@progress, progress),
      status = COALESCE(@status, status),
      budget_limit = COALESCE(@budget_limit, budget_limit),
      venue = COALESCE(@venue, venue),
      location = COALESCE(@location, location),
      planning_notes = COALESCE(@planning_notes, planning_notes),
      timeline_assumptions = COALESCE(@timeline_assumptions, timeline_assumptions),
      workflow_json = COALESCE(@workflow_json, workflow_json),
      divisions_json = COALESCE(@divisions_json, divisions_json),
      roles_json = COALESCE(@roles_json, roles_json),
      deliverables_json = COALESCE(@deliverables_json, deliverables_json),
      constraints_json = COALESCE(@constraints_json, constraints_json),
      hard_deadline = COALESCE(@hard_deadline, hard_deadline)
    WHERE id = @id
  `
  ).run({
    id,
    name: b.name ? String(b.name) : null,
    event_date: b.event_date ? String(b.event_date) : null,
    event_type: b.event_type ? String(b.event_type) : null,
    scope: b.scope ? String(b.scope) : null,
    progress: Number.isFinite(Number(b.progress)) ? Number(b.progress) : null,
    status: b.status ? String(b.status) : null,
    budget_limit: b.budget_limit != null && b.budget_limit !== "" ? Number(b.budget_limit) : null,
    venue: b.venue ? String(b.venue) : null,
    location: b.location ? String(b.location) : null,
    planning_notes: b.planning_notes ? String(b.planning_notes) : null,
    timeline_assumptions: b.timeline_assumptions ? String(b.timeline_assumptions) : null,
    workflow_json: b.workflow ? toJson(b.workflow) : null,
    divisions_json: b.divisions ? toJson(b.divisions) : null,
    roles_json: b.roles ? toJson(b.roles) : null,
    deliverables_json: b.deliverables_by_role ? toJson(b.deliverables_by_role) : null,
    constraints_json: b.constraints ? toJson(b.constraints) : null,
    hard_deadline: b.hard_deadline ? String(b.hard_deadline) : null
  });
  res.json({
    ok: true,
    warnings:
      warningCount > 0
        ? [
            "This event edit may affect task timelines, assignments, or dependencies. Review related tasks after saving."
          ]
        : []
  });
});

function extractSeedUsersFunction(content) {
  const start = content.indexOf("function seedUsers()");
  if (start === -1) return content;
  const openBrace = content.indexOf("{", start);
  if (openBrace === -1) return content;
  let depth = 1;
  let i = openBrace + 1;
  while (i < content.length && depth > 0) {
    if (content[i] === "{") depth++;
    else if (content[i] === "}") depth--;
    i++;
  }
  return content.slice(start, depth === 0 ? i : content.length).trim();
}

function replaceSeedUsersInFile(fullContent, newSeedUsersBlock) {
  const start = fullContent.indexOf("function seedUsers()");
  if (start === -1) return null;
  const openBrace = fullContent.indexOf("{", start);
  if (openBrace === -1) return null;
  let depth = 1;
  let i = openBrace + 1;
  while (i < fullContent.length && depth > 0) {
    if (fullContent[i] === "{") depth++;
    else if (fullContent[i] === "}") depth--;
    i++;
  }
  if (depth !== 0) return null;
  return fullContent.slice(0, start) + newSeedUsersBlock + fullContent.slice(i);
}

app.get("/api/admin/seed-users-snippet", (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  if (user.permission_level !== "president" && user.view_type !== "president") {
    return res.status(403).json({ error: "President access required." });
  }
  try {
    const sqlitePath = path.join(__dirname, "sqlite.js");
    const fullContent = fs.readFileSync(sqlitePath, "utf8");
    const content = extractSeedUsersFunction(fullContent);
    res.json({ content, filename: "sqlite.js" });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to read file." });
  }
});

app.post("/api/admin/run-seed", (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  if (user.permission_level !== "president" && user.view_type !== "president") {
    return res.status(403).json({ error: "President access required." });
  }
  try {
    seedUsers();
    res.json({ ok: true, message: "Seed users run successfully." });
  } catch (e) {
    res.status(500).json({ error: e.message || "Seed failed." });
  }
});

app.get("/api/admin/github-repo", (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  if (user.permission_level !== "president" && user.view_type !== "president") {
    return res.status(403).json({ error: "President access required." });
  }
  const url = process.env.GITHUB_REPO || null;
  const branch = process.env.GITHUB_BRANCH || "main";
  res.json({ url, branch });
});

app.post("/api/admin/seed-users-push", async (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  if (user.permission_level !== "president" && user.view_type !== "president") {
    return res.status(403).json({ error: "President access required." });
  }
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    return res.status(400).json({ error: "GITHUB_TOKEN is not set. Add it in .env to push to GitHub." });
  }
  const { content: newSeedUsersBlock } = req.body || {};
  if (!newSeedUsersBlock || typeof newSeedUsersBlock !== "string") {
    return res.status(400).json({ error: "Request body must include content (the seedUsers() function)." });
  }
  const repoUrl = process.env.GITHUB_REPO || "";
  const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!match) {
    return res.status(400).json({ error: "GITHUB_REPO is missing or invalid (e.g. https://github.com/owner/repo)." });
  }
  const [, owner, repo] = match;
  const branch = process.env.GITHUB_BRANCH || "main";
  try {
    const sqlitePath = path.join(__dirname, "sqlite.js");
    const fullContent = fs.readFileSync(sqlitePath, "utf8");
    const newFullContent = replaceSeedUsersInFile(fullContent, newSeedUsersBlock.trim());
    if (!newFullContent) {
      return res.status(400).json({ error: "Could not find seedUsers() in sqlite.js to replace." });
    }
    const getRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/sqlite.js?ref=${encodeURIComponent(branch)}`,
      { headers: { Accept: "application/vnd.github.v3+json", Authorization: `Bearer ${githubToken}` } }
    );
    const getData = await getRes.json();
    const sha = getData && getData.sha ? getData.sha : null;
    const body = {
      message: "Update seedUsers() from SSA Ops",
      content: Buffer.from(newFullContent, "utf8").toString("base64"),
      branch
    };
    if (sha) body.sha = sha;
    const putRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/sqlite.js`,
      {
        method: "PUT",
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${githubToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      }
    );
    if (!putRes.ok) {
      const errData = await putRes.json().catch(() => ({}));
      return res.status(502).json({ error: errData.message || "GitHub API error." });
    }
    fs.writeFileSync(sqlitePath, newFullContent, "utf8");
    res.json({ ok: true, message: "Pushed to GitHub and local file updated." });
  } catch (e) {
    res.status(500).json({ error: e.message || "Push failed." });
  }
});

// ---------- Site content (gallery + board): board/VP/president add gallery; president edits board & pushes ----------
// Upload one image for gallery; save to gallery/ and return its path.
app.post("/api/site/gallery/upload", upload.single("photo"), (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  if (!canEditGallery(user)) return res.status(403).json({ error: "Only board, VP, or president can add gallery photos." });
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No photo file uploaded." });
  try {
    const ext = path.extname(file.originalname || "") || ".png";
    const safeExt = /^\.(png|jpg|jpeg|webp|gif)$/i.test(ext) ? ext : ".png";
    const destName = `gallery-${crypto.randomUUID()}${safeExt}`;
    const destPath = path.join(galleryDir, destName);
    if (!fs.existsSync(galleryDir)) fs.mkdirSync(galleryDir, { recursive: true });
    fs.copyFileSync(file.path, destPath);
    res.json({ path: `gallery/${destName}` });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to save image." });
  }
});

app.post("/api/site/board/upload", upload.single("photo"), (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  if (!isPresident(user)) return res.status(403).json({ error: "Only president can upload board photos." });
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No photo file uploaded." });
  try {
    const ext = path.extname(file.originalname || "") || ".png";
    const safeExt = /^\.(png|jpg|jpeg|webp|gif)$/i.test(ext) ? ext : ".png";
    const destName = `board-${crypto.randomUUID()}${safeExt}`;
    const destPath = path.join(boardImagesDir, destName);
    if (!fs.existsSync(boardImagesDir)) fs.mkdirSync(boardImagesDir, { recursive: true });
    fs.copyFileSync(file.path, destPath);
    res.json({ path: `board-images/${destName}` });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to save board photo." });
  }
});

// Replace entire gallery (save temporary/staging gallery)
app.put("/api/site/gallery", (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  if (!canEditGallery(user)) return res.status(403).json({ error: "Only board, VP, or president can edit gallery." });
  const { galleryImages } = req.body || {};
  if (!Array.isArray(galleryImages)) return res.status(400).json({ error: "Request body must include galleryImages array." });
  const content = readSiteContent();
  content.galleryImages = galleryImages;
  writeSiteContent(content);
  res.json({ ok: true, galleryImages: content.galleryImages });
});

app.post("/api/site/gallery", upload.single("photo"), (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  if (!canEditGallery(user)) return res.status(403).json({ error: "Only board, VP, or president can add gallery photos." });
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No photo file uploaded." });
  const alt = (req.body && req.body.alt) ? String(req.body.alt).trim() : "SSA event";
  const content = readSiteContent();
  const id = crypto.randomUUID();
  const ext = path.extname(file.originalname || "") || ".png";
  const safeExt = /^\.(png|jpg|jpeg|webp|gif)$/i.test(ext) ? ext : ".png";
  const destName = `gallery-${crypto.randomUUID()}${safeExt}`;
  const destPath = path.join(galleryDir, destName);
  if (!fs.existsSync(galleryDir)) fs.mkdirSync(galleryDir, { recursive: true });
  fs.copyFileSync(file.path, destPath);
  content.galleryImages.push({ id, src: `gallery/${destName}`, alt });
  writeSiteContent(content);
  res.json({ ok: true, galleryImages: content.galleryImages });
});

app.delete("/api/site/gallery/:id", (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  if (!canEditGallery(user)) return res.status(403).json({ error: "Only board, VP, or president can remove gallery photos." });
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: "Missing image id." });
  const content = readSiteContent();
  const before = content.galleryImages.length;
  content.galleryImages = content.galleryImages.filter((img) => img.id !== id);
  if (content.galleryImages.length === before) return res.status(404).json({ error: "Gallery image not found." });
  writeSiteContent(content);
  res.json({ ok: true, galleryImages: content.galleryImages });
});

app.get("/api/site/board", (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  const content = readSiteContent();
  res.json({ boardMembers: content.boardMembers });
});

app.put("/api/site/board", (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  if (!isPresident(user)) return res.status(403).json({ error: "Only president can edit the board section." });
  const { boardMembers } = req.body || {};
  if (!Array.isArray(boardMembers)) return res.status(400).json({ error: "Request body must include boardMembers array." });
  const content = readSiteContent();
  content.boardMembers = boardMembers;
  writeSiteContent(content);
  res.json({ ok: true, boardMembers: content.boardMembers });
});

app.post("/api/site/push", async (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  if (!isPresident(user)) return res.status(403).json({ error: "Only president can push site content to GitHub." });
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) return res.status(400).json({ error: "GITHUB_TOKEN is not set. Add it in .env to push to GitHub." });
  const repoUrl = process.env.GITHUB_REPO || "";
  const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (!match) return res.status(400).json({ error: "GITHUB_REPO is missing or invalid." });
  const [, owner, repo] = match;
  const branch = process.env.GITHUB_BRANCH || "main";
  try {
    const content = readSiteContent();
    const jsonStr = JSON.stringify(content, null, 2);
    const getRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/data/site-content.json?ref=${encodeURIComponent(branch)}`,
      { headers: { Accept: "application/vnd.github.v3+json", Authorization: `Bearer ${githubToken}` } }
    );
    const getData = await getRes.json();
    const sha = getData && getData.sha ? getData.sha : null;
    const putBody = {
      message: "Update site content (gallery + board) from SSA Ops",
      content: Buffer.from(jsonStr, "utf8").toString("base64"),
      branch
    };
    if (sha) putBody.sha = sha;
    const putRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/data/site-content.json`,
      {
        method: "PUT",
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${githubToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(putBody)
      }
    );
    if (!putRes.ok) {
      const errData = await putRes.json().catch(() => ({}));
      return res.status(502).json({ error: errData.message || "GitHub API error." });
    }
    res.json({ ok: true, message: "Site content pushed to GitHub." });
  } catch (e) {
    res.status(500).json({ error: e.message || "Push failed." });
  }
});

app.delete("/api/events/:id", (req, res) => {
  const token = req.header("x-session-token");
  const user = getUserFromSession(token);
  if (!user) return res.status(401).json({ error: "Invalid session." });
  if (!isAdminUser(user)) return res.status(403).json({ error: "Admin access required." });
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid event id." });
  const existing = db.prepare(`SELECT id FROM events WHERE id = ?`).get(id);
  if (!existing) return res.status(404).json({ error: "Event not found." });

  const taskIds = db.prepare(`SELECT id FROM tasks WHERE event_id = ?`).all(id).map((t) => t.id);
  if (taskIds.length) {
    const placeholders = taskIds.map(() => "?").join(",");
    db.prepare(`DELETE FROM task_dependencies WHERE task_id IN (${placeholders}) OR depends_on_task_id IN (${placeholders})`).run(
      ...taskIds,
      ...taskIds
    );
    db.prepare(`DELETE FROM task_submissions WHERE task_id IN (${placeholders})`).run(...taskIds);
    db.prepare(`DELETE FROM redo_requests WHERE task_id IN (${placeholders})`).run(...taskIds);
  }
  db.prepare(`DELETE FROM tasks WHERE event_id = ?`).run(id);
  db.prepare(`DELETE FROM events WHERE id = ?`).run(id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`SSA Ops running on http://localhost:${PORT}`);
});
