const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

// Use DATA_DIR for persistent storage (e.g. Render persistent disk at /data).
// Set env DATA_DIR=/data and mount a disk there so the DB survives deploys.
const dataDir = process.env.DATA_DIR || path.resolve(__dirname, "..");
if (dataDir !== __dirname) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (e) {
    console.warn("DATA_DIR mkdir:", e.message);
  }
}
const dbPath = path.join(dataDir, "ssa-ops.db");
const db = new Database(dbPath);

function ensureColumn(tableName, columnName, columnSql) {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (!cols.some((c) => c.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnSql}`);
  }
}

function initDb() {
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      role_title TEXT NOT NULL,
      department TEXT NOT NULL,
      permission_level TEXT NOT NULL,
      view_type TEXT NOT NULL,
      vp_type TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_type TEXT NOT NULL,
      scope TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'upcoming',
      budget_limit REAL,
      venue TEXT,
      location TEXT,
      planning_notes TEXT,
      timeline_assumptions TEXT,
      workflow_json TEXT,
      divisions_json TEXT,
      roles_json TEXT,
      deliverables_json TEXT,
      constraints_json TEXT,
      hard_deadline TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      owner_role TEXT NOT NULL,
      department TEXT NOT NULL,
      status TEXT NOT NULL,
      unlock_at TEXT NOT NULL,
      due_at TEXT NOT NULL,
      priority TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'board',
      vp_scope TEXT,
      meeting_date TEXT,
      meeting_time TEXT,
      meeting_location TEXT,
      previous_summary TEXT,
      notes TEXT,
      attachments_json TEXT,
      redo_rules TEXT,
      escalation_rules TEXT
    );

    CREATE TABLE IF NOT EXISTS task_dependencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      depends_on_task_id INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      submitted_by_email TEXT NOT NULL,
      summary TEXT NOT NULL,
      proof_links TEXT,
      comments TEXT,
      difficulty TEXT,
      questions TEXT,
      feedback TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS redo_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      requested_by_email TEXT NOT NULL,
      notes TEXT NOT NULL,
      updated_due_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submitted_by_email TEXT NOT NULL,
      submitted_by_name TEXT NOT NULL,
      submitted_by_role TEXT NOT NULL,
      division TEXT NOT NULL,
      event_id INTEGER,
      task_id INTEGER,
      reason TEXT NOT NULL,
      notes TEXT NOT NULL,
      recommended_action TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      clarification_notes TEXT,
      status_updated_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submitter_name TEXT,
      suggestion_type TEXT NOT NULL,
      idea_text TEXT NOT NULL,
      audience TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  ensureColumn("events", "budget_limit", "REAL");
  ensureColumn("events", "venue", "TEXT");
  ensureColumn("events", "location", "TEXT");
  ensureColumn("events", "planning_notes", "TEXT");
  ensureColumn("events", "timeline_assumptions", "TEXT");
  ensureColumn("events", "workflow_json", "TEXT");
  ensureColumn("events", "divisions_json", "TEXT");
  ensureColumn("events", "roles_json", "TEXT");
  ensureColumn("events", "deliverables_json", "TEXT");
  ensureColumn("events", "constraints_json", "TEXT");
  ensureColumn("events", "hard_deadline", "TEXT");

  ensureColumn("tasks", "notes", "TEXT");
  ensureColumn("tasks", "attachments_json", "TEXT");
  ensureColumn("tasks", "redo_rules", "TEXT");
  ensureColumn("tasks", "escalation_rules", "TEXT");
  ensureColumn("tasks", "meeting_link", "TEXT");
  ensureColumn("tasks", "phase", "TEXT");
  ensureColumn("reports", "escalated_to", "TEXT NOT NULL DEFAULT 'president'");
  ensureColumn("reports", "target_vp_type", "TEXT");
  ensureColumn("reports", "status_updated_at", "TEXT");

  // Keep auth domain policy aligned with @umn.edu access.
  db.exec(`
    DELETE FROM users
    WHERE lower(email) NOT LIKE '%@umn.edu';
  `);

  // Remove previous demo records if they still exist.
  db.exec(`
    DELETE FROM task_dependencies
    WHERE task_id IN (
      SELECT id FROM tasks
      WHERE title IN (
        'Book venue contract',
        'Approve event budget',
        'Complete Phase I promotion kit',
        'Part III - Build full marketing campaign',
        'Kickoff logistics checklist'
      )
    )
    OR depends_on_task_id IN (
      SELECT id FROM tasks
      WHERE title IN (
        'Book venue contract',
        'Approve event budget',
        'Complete Phase I promotion kit',
        'Part III - Build full marketing campaign',
        'Kickoff logistics checklist'
      )
    );

    DELETE FROM tasks
    WHERE title IN (
      'Book venue contract',
      'Approve event budget',
      'Complete Phase I promotion kit',
      'Part III - Build full marketing campaign',
      'Kickoff logistics checklist',
      'Book venue',
      'Approve budget',
      'Launch marketing campaign'
    );

    DELETE FROM events
    WHERE name IN ('SSA Night 2026', 'Fall Kickoff', 'Test Event');
  `);

  seedUsers();
}

const { loadBoardRosterUsers } = require("./board-roster");

function seedUsers() {
  const seeded = loadBoardRosterUsers();

  const upsert = db.prepare(`
    INSERT INTO users (email, full_name, role_title, department, permission_level, view_type, vp_type)
    VALUES (@email, @full_name, @role_title, @department, @permission_level, @view_type, @vp_type)
    ON CONFLICT(email) DO UPDATE SET
      full_name = excluded.full_name,
      role_title = excluded.role_title,
      department = excluded.department,
      permission_level = excluded.permission_level,
      view_type = excluded.view_type,
      vp_type = excluded.vp_type
  `);
  const seededEmails = seeded.map((u) => u.email);
  const placeholders = seededEmails.map(() => "?").join(",");
  const deleteNotSeeded = db.prepare(
    `DELETE FROM users WHERE email NOT IN (${placeholders})`
  );
  const tx = db.transaction(() => {
    seeded.forEach((u) => upsert.run(u));
    deleteNotSeeded.run(...seededEmails);
  });
  tx();
}

module.exports = { db, initDb, seedUsers };
