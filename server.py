from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("DB_PATH", ROOT / "ssa_site.sqlite"))
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Ilovesomalia393@")
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "5600"))


def db_connect():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with db_connect() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS newsletter_subscribers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS rsvp_interest (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_name TEXT NOT NULL,
                event_date TEXT NOT NULL,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_rsvp_unique ON rsvp_interest (event_name, email)"
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS game_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                mistakes INTEGER NOT NULL,
                seconds INTEGER NOT NULL,
                solved INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS connect_interest (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reason TEXT NOT NULL,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                organization TEXT,
                details TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )


class SSAHandler(SimpleHTTPRequestHandler):
    def _send_json(self, status, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        return json.loads(raw or "{}")

    def _leaderboard(self, limit=10):
        with db_connect() as db:
            rows = db.execute(
                """
                SELECT name, mistakes, seconds, solved
                FROM game_scores
                WHERE solved = 1
                ORDER BY mistakes ASC, seconds ASC, created_at ASC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [
            {"name": r["name"], "mistakes": r["mistakes"], "seconds": r["seconds"], "solved": bool(r["solved"])}
            for r in rows
        ]

    def _attendees(self, event_name):
        with db_connect() as db:
            rows = db.execute(
                "SELECT name, email FROM rsvp_interest WHERE event_name = ? ORDER BY created_at ASC",
                (event_name,),
            ).fetchall()
        return [{"name": r["name"], "email": r["email"]} for r in rows]

    def _admin_payload(self):
        with db_connect() as db:
            newsletters = db.execute(
                "SELECT email, created_at FROM newsletter_subscribers ORDER BY created_at DESC"
            ).fetchall()
            messages = db.execute(
                "SELECT name, email, message, created_at FROM messages ORDER BY created_at DESC"
            ).fetchall()
            rsvps = db.execute(
                "SELECT event_name, event_date, name, email, created_at FROM rsvp_interest ORDER BY created_at DESC"
            ).fetchall()
            connects = db.execute(
                "SELECT reason, name, email, organization, details, created_at FROM connect_interest ORDER BY created_at DESC"
            ).fetchall()
            scores = db.execute(
                """
                SELECT name, mistakes, seconds, solved, created_at
                FROM game_scores
                ORDER BY created_at DESC
                LIMIT 200
                """
            ).fetchall()
        return {
            "newsletters": [{"email": r["email"], "created_at": r["created_at"]} for r in newsletters],
            "messages": [
                {"name": r["name"], "email": r["email"], "message": r["message"], "created_at": r["created_at"]}
                for r in messages
            ],
            "rsvp": [
                {
                    "event_name": r["event_name"],
                    "event_date": r["event_date"],
                    "name": r["name"],
                    "email": r["email"],
                    "created_at": r["created_at"],
                }
                for r in rsvps
            ],
            "connect": [
                {
                    "reason": r["reason"],
                    "name": r["name"],
                    "email": r["email"],
                    "organization": r["organization"] or "",
                    "details": r["details"],
                    "created_at": r["created_at"],
                }
                for r in connects
            ],
            "scores": [
                {
                    "name": r["name"],
                    "mistakes": r["mistakes"],
                    "seconds": r["seconds"],
                    "solved": bool(r["solved"]),
                    "created_at": r["created_at"],
                }
                for r in scores
            ],
        }

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/health":
            self._send_json(200, {"ok": True, "database": str(DB_PATH.resolve())})
            return
        if path == "/api/leaderboard":
            self._send_json(200, {"scores": self._leaderboard()})
            return
        if path == "/api/rsvp":
            qs = parse_qs(urlparse(self.path).query)
            event_name = (qs.get("event", [""])[0]).strip()
            if not event_name:
                self._send_json(400, {"error": "event is required"})
                return
            attendees = self._attendees(event_name)
            self._send_json(200, {"count": len(attendees), "attendees": attendees})
            return
        super().do_GET()

    def do_POST(self):
        try:
            payload = self._read_json()
        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON."})
            return

        now = datetime.now(timezone.utc).isoformat()

        if self.path == "/api/newsletter":
            email = str(payload.get("email", "")).strip().lower()
            if "@" not in email:
                self._send_json(400, {"error": "A valid email is required."})
                return
            with db_connect() as db:
                db.execute(
                    "INSERT OR IGNORE INTO newsletter_subscribers (email, created_at) VALUES (?, ?)",
                    (email, now),
                )
            self._send_json(200, {"ok": True})
            return

        if self.path == "/api/messages":
            name = str(payload.get("name", "")).strip()
            email = str(payload.get("email", "")).strip().lower()
            message = str(payload.get("message", "")).strip()
            if not name or "@" not in email or not message:
                self._send_json(400, {"error": "Name, valid email, and message are required."})
                return
            with db_connect() as db:
                db.execute(
                    "INSERT INTO messages (name, email, message, created_at) VALUES (?, ?, ?, ?)",
                    (name, email, message, now),
                )
            self._send_json(200, {"ok": True})
            return

        if self.path == "/api/rsvp":
            event_name = str(payload.get("event", "")).strip()
            event_date = str(payload.get("date", "")).strip()
            name = str(payload.get("name", "")).strip()
            email = str(payload.get("email", "")).strip().lower()
            if not event_name or not event_date or not name or "@" not in email:
                self._send_json(400, {"error": "Event, date, name, and valid email are required."})
                return
            with db_connect() as db:
                cursor = db.execute(
                    """
                    INSERT OR IGNORE INTO rsvp_interest (event_name, event_date, name, email, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (event_name, event_date, name, email, now),
                )
                already = cursor.rowcount == 0
                rows = db.execute(
                    "SELECT name, email FROM rsvp_interest WHERE event_name = ? ORDER BY created_at ASC",
                    (event_name,),
                ).fetchall()
            attendees = [{"name": r["name"], "email": r["email"]} for r in rows]
            self._send_json(200, {
                "ok": True,
                "already": already,
                "count": len(attendees),
                "attendees": attendees,
            })
            return

        if self.path == "/api/score":
            name = str(payload.get("name", "")).strip()[:24] or "Anonymous"
            try:
                mistakes = int(payload.get("mistakes", 4))
                seconds = int(payload.get("seconds", 0))
            except (TypeError, ValueError):
                self._send_json(400, {"error": "Invalid score."})
                return
            solved = 1 if payload.get("solved") else 0
            mistakes = max(0, min(mistakes, 4))
            seconds = max(0, min(seconds, 86400))
            with db_connect() as db:
                db.execute(
                    "INSERT INTO game_scores (name, mistakes, seconds, solved, created_at) VALUES (?, ?, ?, ?, ?)",
                    (name, mistakes, seconds, solved, now),
                )
            self._send_json(200, {"ok": True, "scores": self._leaderboard()})
            return

        if self.path == "/api/connect":
            reason = str(payload.get("reason", "")).strip().lower()
            name = str(payload.get("name", "")).strip()
            email = str(payload.get("email", "")).strip().lower()
            organization = str(payload.get("organization", "")).strip()
            details = str(payload.get("details", "")).strip()
            allowed = {"sponsorship", "collaborations", "partnerships", "board", "ideas"}
            if reason not in allowed:
                self._send_json(400, {"error": "A valid connection reason is required."})
                return
            if not name or "@" not in email or not details:
                self._send_json(400, {"error": "Name, valid email, and details are required."})
                return
            with db_connect() as db:
                db.execute(
                    """
                    INSERT INTO connect_interest (reason, name, email, organization, details, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (reason, name, email, organization, details, now),
                )
            self._send_json(200, {"ok": True})
            return

        if self.path == "/api/admin":
            password = str(payload.get("password", ""))
            if password != ADMIN_PASSWORD:
                self._send_json(401, {"error": "Invalid password."})
                return
            self._send_json(200, {"ok": True, **self._admin_payload()})
            return

        self._send_json(404, {"error": "Endpoint not found."})


if __name__ == "__main__":
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), SSAHandler)
    print(f"SSA site running at http://localhost:{PORT}")
    print(f"Persistent SQLite database: {DB_PATH.resolve()}")
    print("All submissions (newsletter, RSVP, connect, game scores) are saved to this file.")
    server.serve_forever()
