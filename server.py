from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from db import database_ready, db, init_db, warm_pool

ROOT = Path(__file__).resolve().parent
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Ilovesomalia393@")
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "5600"))
LEADERBOARD_TTL = int(os.environ.get("LEADERBOARD_TTL", "30"))

_leaderboard_cache = {"at": 0.0, "scores": []}
_newsletter_count_cache = {"at": 0.0, "count": None}
NEWSLETTER_COUNT_TTL = int(os.environ.get("NEWSLETTER_COUNT_TTL", "30"))
RSVP_SUMMARY_TTL = int(os.environ.get("RSVP_SUMMARY_TTL", "20"))
_rsvp_summary_cache = {"at": 0.0, "events": {}}


def utcnow():
    return datetime.now(timezone.utc)


def invalidate_leaderboard_cache():
    _leaderboard_cache["at"] = 0.0
    _leaderboard_cache["scores"] = []


def invalidate_newsletter_count_cache():
    _newsletter_count_cache["at"] = 0.0
    _newsletter_count_cache["count"] = None


def invalidate_rsvp_summary_cache():
    _rsvp_summary_cache["at"] = 0.0
    _rsvp_summary_cache["events"] = {}


def fetch_newsletter_count():
    now = time.monotonic()
    cached = _newsletter_count_cache["count"]
    if cached is not None and now - _newsletter_count_cache["at"] < NEWSLETTER_COUNT_TTL:
        return cached
    with db() as cur:
        cur.execute("SELECT COUNT(*) AS c FROM newsletter_subscribers")
        count = int(cur.fetchone()["c"])
    _newsletter_count_cache["at"] = now
    _newsletter_count_cache["count"] = count
    return count


def fetch_rsvp_summary():
    now = time.monotonic()
    if _rsvp_summary_cache["events"] and now - _rsvp_summary_cache["at"] < RSVP_SUMMARY_TTL:
        return dict(_rsvp_summary_cache["events"])
    with db() as cur:
        cur.execute(
            """
            SELECT event_name, COUNT(*) AS count
            FROM rsvp_interest
            GROUP BY event_name
            """
        )
        rows = cur.fetchall()
    events = {r["event_name"]: int(r["count"]) for r in rows}
    _rsvp_summary_cache["at"] = now
    _rsvp_summary_cache["events"] = events
    return events


def fetch_leaderboard(limit=10):
    now = time.monotonic()
    cached = _leaderboard_cache["scores"]
    if cached and now - _leaderboard_cache["at"] < LEADERBOARD_TTL:
        return cached[:limit]

    with db() as cur:
        cur.execute(
            """
            SELECT name, mistakes, seconds, solved
            FROM game_scores
            WHERE solved = TRUE
            ORDER BY mistakes ASC, seconds ASC, created_at ASC
            LIMIT %s
            """,
            (max(limit, 10),),
        )
        rows = cur.fetchall()

    scores = [
        {
            "name": r["name"],
            "mistakes": r["mistakes"],
            "seconds": r["seconds"],
            "solved": bool(r["solved"]),
        }
        for r in rows
    ]
    _leaderboard_cache["at"] = now
    _leaderboard_cache["scores"] = scores
    return scores[:limit]


def warm_leaderboard_cache():
    try:
        fetch_leaderboard(10)
    except Exception as exc:
        print(f"Leaderboard warm-up skipped: {exc}")


class SSAHandler(SimpleHTTPRequestHandler):
    def _send_json(self, status, payload, cache_seconds=0):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        if cache_seconds > 0:
            self.send_header("Cache-Control", f"public, max-age={cache_seconds}")
        self.end_headers()
        self.wfile.write(data)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        return json.loads(raw or "{}")

    def _attendees(self, event_name):
        with db() as cur:
            cur.execute(
                """
                SELECT name, email
                FROM rsvp_interest
                WHERE event_name = %s
                ORDER BY created_at ASC
                """,
                (event_name,),
            )
            rows = cur.fetchall()
        return [{"name": r["name"], "email": r["email"]} for r in rows]

    def _admin_payload(self):
        with db() as cur:
            cur.execute(
                "SELECT email, created_at FROM newsletter_subscribers ORDER BY created_at DESC"
            )
            newsletters = cur.fetchall()
            cur.execute(
                "SELECT name, email, message, created_at FROM messages ORDER BY created_at DESC"
            )
            messages = cur.fetchall()
            cur.execute(
                """
                SELECT event_name, event_date, name, email, created_at
                FROM rsvp_interest
                ORDER BY created_at DESC
                """
            )
            rsvps = cur.fetchall()
            cur.execute(
                """
                SELECT reason, name, email, organization, details, created_at
                FROM connect_interest
                ORDER BY created_at DESC
                """
            )
            connects = cur.fetchall()
            cur.execute(
                """
                SELECT name, mistakes, seconds, solved, created_at
                FROM game_scores
                ORDER BY created_at DESC
                LIMIT 200
                """
            )
            scores = cur.fetchall()

        def iso(value):
            return value.isoformat() if hasattr(value, "isoformat") else str(value)

        return {
            "newsletters": [{"email": r["email"], "created_at": iso(r["created_at"])} for r in newsletters],
            "messages": [
                {
                    "name": r["name"],
                    "email": r["email"],
                    "message": r["message"],
                    "created_at": iso(r["created_at"]),
                }
                for r in messages
            ],
            "rsvp": [
                {
                    "event_name": r["event_name"],
                    "event_date": r["event_date"],
                    "name": r["name"],
                    "email": r["email"],
                    "created_at": iso(r["created_at"]),
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
                    "created_at": iso(r["created_at"]),
                }
                for r in connects
            ],
            "scores": [
                {
                    "name": r["name"],
                    "mistakes": r["mistakes"],
                    "seconds": r["seconds"],
                    "solved": bool(r["solved"]),
                    "created_at": iso(r["created_at"]),
                }
                for r in scores
            ],
        }

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/api/health":
            try:
                warm_pool()
                self._send_json(200, {"ok": True, "database": "postgresql"}, cache_seconds=5)
            except Exception as exc:
                self._send_json(503, {"ok": False, "error": str(exc)})
            return
        if path == "/api/leaderboard":
            try:
                scores = fetch_leaderboard()
                self._send_json(200, {"scores": scores}, cache_seconds=LEADERBOARD_TTL)
            except Exception as exc:
                self._send_json(503, {"ok": False, "error": str(exc)})
            return
        if path == "/api/newsletter/count":
            try:
                count = fetch_newsletter_count()
                self._send_json(200, {"count": count}, cache_seconds=NEWSLETTER_COUNT_TTL)
            except Exception as exc:
                self._send_json(503, {"ok": False, "error": str(exc)})
            return
        if path == "/api/rsvp/summary":
            try:
                events = fetch_rsvp_summary()
                self._send_json(200, {"events": events}, cache_seconds=RSVP_SUMMARY_TTL)
            except Exception as exc:
                self._send_json(503, {"ok": False, "error": str(exc)})
            return
        if path == "/api/rsvp":
            qs = parse_qs(urlparse(self.path).query)
            event_name = (qs.get("event", [""])[0]).strip()
            if not event_name:
                self._send_json(400, {"error": "event is required"})
                return
            try:
                attendees = self._attendees(event_name)
                self._send_json(
                    200,
                    {"count": len(attendees), "attendees": attendees},
                    cache_seconds=10,
                )
            except Exception as exc:
                self._send_json(503, {"ok": False, "error": str(exc)})
            return
        super().do_GET()

    def do_POST(self):
        try:
            payload = self._read_json()
        except json.JSONDecodeError:
            self._send_json(400, {"error": "Invalid JSON."})
            return

        now = utcnow()

        if self.path == "/api/newsletter":
            email = str(payload.get("email", "")).strip().lower()
            if "@" not in email:
                self._send_json(400, {"error": "A valid email is required."})
                return
            try:
                with db() as cur:
                    cur.execute(
                        """
                        INSERT INTO newsletter_subscribers (email, created_at)
                        VALUES (%s, %s)
                        ON CONFLICT (email) DO NOTHING
                        """,
                        (email, now),
                    )
                invalidate_newsletter_count_cache()
                self._send_json(200, {"ok": True, "count": fetch_newsletter_count()})
            except Exception as exc:
                self._send_json(503, {"ok": False, "error": str(exc)})
            return

        if self.path == "/api/messages":
            name = str(payload.get("name", "")).strip()
            email = str(payload.get("email", "")).strip().lower()
            message = str(payload.get("message", "")).strip()
            if not name or "@" not in email or not message:
                self._send_json(400, {"error": "Name, valid email, and message are required."})
                return
            try:
                with db() as cur:
                    cur.execute(
                        """
                        INSERT INTO messages (name, email, message, created_at)
                        VALUES (%s, %s, %s, %s)
                        """,
                        (name, email, message, now),
                    )
                self._send_json(200, {"ok": True})
            except Exception as exc:
                self._send_json(503, {"ok": False, "error": str(exc)})
            return

        if self.path == "/api/rsvp":
            event_name = str(payload.get("event", "")).strip()
            event_date = str(payload.get("date", "")).strip()
            name = str(payload.get("name", "")).strip()
            email = str(payload.get("email", "")).strip().lower()
            if not event_name or not event_date or not name or "@" not in email:
                self._send_json(400, {"error": "Event, date, name, and valid email are required."})
                return
            try:
                with db() as cur:
                    cur.execute(
                        """
                        INSERT INTO rsvp_interest (event_name, event_date, name, email, created_at)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (event_name, email) DO NOTHING
                        """,
                        (event_name, event_date, name, email, now),
                    )
                    already = cur.rowcount == 0
                    cur.execute(
                        """
                        SELECT name, email
                        FROM rsvp_interest
                        WHERE event_name = %s
                        ORDER BY created_at ASC
                        """,
                        (event_name,),
                    )
                    rows = cur.fetchall()
                attendees = [{"name": r["name"], "email": r["email"]} for r in rows]
                invalidate_rsvp_summary_cache()
                self._send_json(200, {
                    "ok": True,
                    "already": already,
                    "count": len(attendees),
                    "attendees": attendees,
                })
            except Exception as exc:
                self._send_json(503, {"ok": False, "error": str(exc)})
            return

        if self.path == "/api/score":
            name = str(payload.get("name", "")).strip()[:24] or "Anonymous"
            try:
                mistakes = int(payload.get("mistakes", 4))
                seconds = int(payload.get("seconds", 0))
            except (TypeError, ValueError):
                self._send_json(400, {"error": "Invalid score."})
                return
            solved = bool(payload.get("solved", True))
            mistakes = max(0, min(mistakes, 4))
            seconds = max(0, min(seconds, 86400))
            try:
                with db() as cur:
                    cur.execute(
                        """
                        INSERT INTO game_scores (name, mistakes, seconds, solved, created_at)
                        VALUES (%s, %s, %s, %s, %s)
                        """,
                        (name, mistakes, seconds, solved, now),
                    )
                invalidate_leaderboard_cache()
                scores = fetch_leaderboard()
                self._send_json(200, {"ok": True, "scores": scores})
            except Exception as exc:
                self._send_json(503, {"ok": False, "error": str(exc)})
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
            try:
                with db() as cur:
                    cur.execute(
                        """
                        INSERT INTO connect_interest (reason, name, email, organization, details, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        (reason, name, email, organization, details, now),
                    )
                self._send_json(200, {"ok": True})
            except Exception as exc:
                self._send_json(503, {"ok": False, "error": str(exc)})
            return

        if self.path == "/api/admin":
            password = str(payload.get("password", ""))
            if password != ADMIN_PASSWORD:
                self._send_json(401, {"error": "Invalid password."})
                return
            try:
                self._send_json(200, {"ok": True, **self._admin_payload()})
            except Exception as exc:
                self._send_json(503, {"ok": False, "error": str(exc)})
            return

        self._send_json(404, {"error": "Endpoint not found."})


if __name__ == "__main__":
    if not database_ready():
        raise SystemExit("DATABASE_URL is required. Add a PostgreSQL database and set DATABASE_URL.")
    init_db()
    warm_pool()
    warm_leaderboard_cache()
    server = ThreadingHTTPServer((HOST, PORT), SSAHandler)
    print(f"SSA site running at http://localhost:{PORT}")
    print("PostgreSQL connected — all submissions persist in the database.")
    server.serve_forever()
