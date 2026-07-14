from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse, parse_qs


def _load_env_file():
    """Load .env into os.environ without overriding already-set variables.

    Must run before importing modules that read env at import time.
    """
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and value and key not in os.environ:
            os.environ[key] = value


_load_env_file()

import aux  # noqa: E402
import cms  # noqa: E402
import schedule  # noqa: E402
from db import database_ready, db, init_db, warm_pool  # noqa: E402

ROOT = Path(__file__).resolve().parent
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "SSA")
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


# Pretty routes served as static HTML under ssaumn.com/<route>
PAGE_ROUTES = {
    "/events": "events.html",
    "/games": "games.html",
    "/daily": "daily.html",
    "/newsletter": "newsletter-page.html",
    "/newsletter/studio": "newsletter-studio.html",
    "/donate": "donate.html",
    "/aux": "aux.html",
    "/board": "board.html",
    "/schedule": "schedule.html",
    "/gallery": "gallery.html",
    "/connections": "connections.html",
    "/admin": "admin.html",
}


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

    def _send_bytes(self, status, data, content_type, cache_seconds=0):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
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
                SELECT name
                FROM rsvp_interest
                WHERE event_name = %s
                ORDER BY created_at ASC
                """,
                (event_name,),
            )
            rows = cur.fetchall()
        return [{"name": r["name"]} for r in rows]

    def _event_attendance_mode(self, event_name):
        with db() as cur:
            cur.execute(
                "SELECT attendance_mode FROM events WHERE rsvp_key = %s AND published = TRUE",
                (event_name,),
            )
            row = cur.fetchone()
        return row["attendance_mode"] if row else "rsvp"

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
                SELECT event_name, event_date, name, is_student, is_over_18, created_at
                FROM rsvp_interest
                ORDER BY created_at DESC
                """
            )
            rsvps = cur.fetchall()
            cur.execute(
                """
                SELECT reason, name, email, organization, details,
                       year, major, interests, created_at
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
            cur.execute(
                """
                SELECT id, song_name, artist, album_image, requested_by, queued_to_spotify, created_at
                FROM aux_requests
                WHERE played = FALSE
                ORDER BY created_at ASC
                LIMIT 100
                """
            )
            aux_queue = cur.fetchall()

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
                    "is_student": bool(r["is_student"]),
                    "is_over_18": bool(r["is_over_18"]),
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
                    "year": r.get("year") or "",
                    "major": r.get("major") or "",
                    "interests": r.get("interests") or "",
                    "created_at": iso(r["created_at"]),
                }
                for r in connects
            ],
            "event_suggestions": cms.list_event_suggestions(),
            "aux": [
                {
                    "id": r["id"],
                    "songName": r["song_name"],
                    "artist": r["artist"],
                    "albumImage": r["album_image"] or "",
                    "requestedBy": r["requested_by"],
                    "queued": bool(r["queued_to_spotify"]),
                    "created_at": iso(r["created_at"]),
                }
                for r in aux_queue
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

    def _send_file(self, filename):
        target = ROOT / filename
        if not target.exists():
            self.send_error(404)
            return
        data = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _redirect(self, url):
        self.send_response(302)
        self.send_header("Location", url)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        qs = parse_qs(parsed.query)

        if path == "/stories":
            self._redirect("/gallery")
            return

        if path in PAGE_ROUTES:
            self._send_file(PAGE_ROUTES[path])
            return

        # ---- board scheduling ----
        if path == "/api/schedules":
            try:
                status, payload = schedule.list_polls()
            except Exception as exc:
                status, payload = 503, {"ok": False, "error": str(exc)}
            self._send_json(status, payload)
            return
        m = re.fullmatch(r"/api/schedule/([A-Za-z0-9_-]+)", path)
        if m:
            since_raw = (qs.get("since", [""])[0]).strip()
            since = int(since_raw) if since_raw.isdigit() else None
            try:
                status, payload = schedule.get_poll(m.group(1), since)
            except Exception as exc:
                status, payload = 503, {"ok": False, "error": str(exc)}
            self._send_json(status, payload)
            return

        # ---- Want The Aux API ----
        if path == "/api/aux/state":
            since_raw = (qs.get("since", [""])[0]).strip()
            since = int(since_raw) if since_raw.isdigit() else None
            guest_id = (qs.get("guest", [""])[0]).strip()[:80]
            try:
                status, payload = aux.get_state(since, guest_id)
            except Exception as exc:
                status, payload = 503, {"ok": False, "error": str(exc)}
            self._send_json(status, payload)
            return
        if path == "/api/aux/search":
            try:
                status, payload = aux.search((qs.get("q", [""])[0]).strip())
            except Exception as exc:
                status, payload = 503, {"ok": False, "error": str(exc)}
            self._send_json(status, payload)
            return
        if path == "/api/aux/spotify/login":
            url, err = aux.spotify_login_redirect()
            if err:
                self._send_json(err[0], err[1])
            else:
                self._redirect(url)
            return
        if path == "/api/rz/spotify/callback":  # registered redirect URI path
            code = (qs.get("code", [""])[0]).strip()
            state = (qs.get("state", [""])[0]).strip()
            if not code:
                self._redirect("/aux?spotify=denied")
                return
            url, err = aux.spotify_callback(code, state)
            if err:
                self._send_json(err[0], err[1])
            else:
                self._redirect(url)
            return

        # ---- newsletter CMS ----
        if path == "/api/newsletters":
            status, payload = cms.list_newsletters(include_drafts=False)
            self._send_json(status, payload)
            return
        if path == "/api/events":
            self._send_json(200, {"ok": True, "events": cms.list_events()})
            return

        if path == "/api/gallery":
            self._send_json(200, {"ok": True, "items": cms.list_gallery_items()})
            return
        m = re.fullmatch(r"/api/gallery/(\d+)/image", path)
        if m:
            image = cms.get_gallery_image(int(m.group(1)))
            if not image:
                self.send_error(404)
            else:
                self._send_bytes(200, image[0], image[1], cache_seconds=86400)
            return
        m = re.fullmatch(r"/api/newsletters/(\d+)", path)
        if m:
            status, payload = cms.get_newsletter(int(m.group(1)))
            self._send_json(status, payload)
            return
        m = re.fullmatch(r"/api/uploads/(\d+)", path)
        if m:
            image = cms.get_newsletter_image(int(m.group(1)))
            if not image:
                self.send_error(404)
            else:
                self._send_bytes(200, image[0], image[1], cache_seconds=86400)
            return

        # ---- arcade ----
        m = re.fullmatch(r"/api/arcade/([a-z]+)", path)
        if m:
            status, payload = cms.arcade_leaderboard(m.group(1))
            self._send_json(status, payload, cache_seconds=15)
            return

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
                mode = self._event_attendance_mode(event_name)
                attendees = [] if mode == "quick" else self._attendees(event_name)
                with db() as cur:
                    cur.execute("SELECT COUNT(*) AS count FROM rsvp_interest WHERE event_name = %s", (event_name,))
                    count = int(cur.fetchone()["count"])
                self._send_json(
                    200,
                    {"count": count, "attendees": attendees, "mode": mode},
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
        post_path = self.path.split("?")[0].rstrip("/")

        # ---- Want The Aux ----
        try:
            # ---- board scheduling ----
            if post_path == "/api/schedule":
                status, resp = schedule.create_poll(payload)
                self._send_json(status, resp)
                return
            m = re.fullmatch(
                r"/api/schedule/([A-Za-z0-9_-]+)/delete", post_path
            )
            if m:
                status, resp = schedule.delete_poll(m.group(1), payload)
                self._send_json(status, resp)
                return
            m = re.fullmatch(
                r"/api/schedule/([A-Za-z0-9_-]+)/availability", post_path
            )
            if m:
                status, resp = schedule.save_availability(m.group(1), payload)
                self._send_json(status, resp)
                return

            if post_path == "/api/admin/aux/clear":
                if str(payload.get("password", "")) != ADMIN_PASSWORD:
                    self._send_json(401, {"error": "Invalid password."})
                    return
                status, resp = aux.clear_requests()
                self._send_json(status, resp)
                return
            m = re.fullmatch(r"/api/admin/aux/(\d+)/play", post_path)
            if m:
                if str(payload.get("password", "")) != ADMIN_PASSWORD:
                    self._send_json(401, {"error": "Invalid password."})
                    return
                status, resp = aux.admin_play_now(int(m.group(1)))
                self._send_json(status, resp)
                return
            if post_path == "/api/aux/request":
                status, resp = aux.add_request(payload)
                self._send_json(status, resp)
                return
            m = re.fullmatch(r"/api/aux/request/(\d+)/queue", post_path)
            if m:
                status, resp = aux.queue_on_spotify(int(m.group(1)), payload)
                self._send_json(status, resp)
                return
            m = re.fullmatch(r"/api/aux/request/(\d+)/remove-own", post_path)
            if m:
                status, resp = aux.remove_own_request(int(m.group(1)), payload)
                self._send_json(status, resp)
                return
            m = re.fullmatch(r"/api/aux/request/(\d+)/remove", post_path)
            if m:
                status, resp = aux.remove_request(int(m.group(1)), payload)
                self._send_json(status, resp)
                return
            if post_path == "/api/aux/playback":
                status, resp = aux.playback(payload)
                self._send_json(status, resp)
                return
            if post_path == "/api/aux/title":
                status, resp = aux.set_title(payload)
                self._send_json(status, resp)
                return
            if post_path == "/api/aux/verify":
                status, resp = aux.verify_dj(payload)
                self._send_json(status, resp)
                return

            # ---- newsletter CMS ----
            if post_path == "/api/newsletters":
                status, resp = cms.save_newsletter(payload)
                self._send_json(status, resp)
                return
            if post_path == "/api/newsletters/list-all":
                if not cms.is_admin(payload):
                    self._send_json(401, {"error": "Invalid password."})
                    return
                status, resp = cms.list_newsletters(include_drafts=True)
                self._send_json(status, resp)
                return
            m = re.fullmatch(r"/api/newsletters/(\d+)/delete", post_path)
            if m:
                status, resp = cms.delete_newsletter(int(m.group(1)), payload)
                self._send_json(status, resp)
                return
            if post_path == "/api/uploads":
                status, resp = cms.upload_image(payload)
                self._send_json(status, resp)
                return
            if post_path == "/api/gallery":
                status, resp = cms.submit_gallery_item(payload)
                self._send_json(status, resp)
                return
            if post_path == "/api/gallery/list-all":
                if not cms.is_admin(payload):
                    self._send_json(401, {"error": "Invalid password."})
                else:
                    self._send_json(200, {"ok": True, "items": cms.list_gallery_items(include_pending=True)})
                return
            m = re.fullmatch(r"/api/gallery/(\d+)/delete", post_path)
            if m:
                status, resp = cms.delete_gallery_item(int(m.group(1)), payload)
                self._send_json(status, resp)
                return
            if post_path == "/api/events":
                status, resp = cms.save_event(payload)
                self._send_json(status, resp)
                return
            if post_path == "/api/events/list-all":
                if not cms.is_admin(payload):
                    self._send_json(401, {"error": "Invalid password."})
                else:
                    self._send_json(200, {"ok": True, "events": cms.list_events(include_unpublished=True)})
                return
            m = re.fullmatch(r"/api/events/(\d+)/delete", post_path)
            if m:
                status, resp = cms.delete_event(int(m.group(1)), payload)
                self._send_json(status, resp)
                return
            # ---- event suggestions + arcade ----
            if post_path == "/api/event-suggestions":
                status, resp = cms.add_event_suggestion(payload)
                self._send_json(status, resp)
                return
            if post_path == "/api/arcade":
                status, resp = cms.arcade_submit(payload)
                self._send_json(status, resp)
                return
        except Exception as exc:
            self._send_json(503, {"ok": False, "error": str(exc)})
            return

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
            mode = self._event_attendance_mode(event_name)
            if mode == "quick":
                guest_token = str(payload.get("guestToken", "")).strip()[:80]
                coming = payload.get("coming") is True
                if not event_name or not event_date or len(guest_token) < 16:
                    self._send_json(400, {"error": "Event and guest ID are required."})
                    return
                try:
                    with db() as cur:
                        if coming:
                            cur.execute(
                                """
                                INSERT INTO rsvp_interest
                                    (event_name, event_date, name, guest_token, created_at)
                                VALUES (%s, %s, 'Guest', %s, %s)
                                ON CONFLICT DO NOTHING
                                """,
                                (event_name, event_date, guest_token, now),
                            )
                        else:
                            cur.execute(
                                "DELETE FROM rsvp_interest WHERE event_name = %s AND guest_token = %s",
                                (event_name, guest_token),
                            )
                        cur.execute("SELECT COUNT(*) AS count FROM rsvp_interest WHERE event_name = %s", (event_name,))
                        count = int(cur.fetchone()["count"])
                    invalidate_rsvp_summary_cache()
                    self._send_json(200, {"ok": True, "coming": coming, "count": count, "attendees": [], "mode": "quick"})
                except Exception as exc:
                    self._send_json(503, {"ok": False, "error": str(exc)})
                return
            name = str(payload.get("name", "")).strip()
            is_student = payload.get("isStudent") is True
            is_over_18 = payload.get("isOver18") is True
            if not event_name or not event_date or not name:
                self._send_json(400, {"error": "Event, date, and name are required."})
                return
            if not is_student and not is_over_18:
                self._send_json(403, {"error": "You must be a U of MN student or at least 18 years old to RSVP."})
                return
            try:
                with db() as cur:
                    cur.execute(
                        """
                        INSERT INTO rsvp_interest
                            (event_name, event_date, name, is_student, is_over_18, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        """,
                        (event_name, event_date, name, is_student, is_over_18, now),
                    )
                    cur.execute(
                        """
                        SELECT name
                        FROM rsvp_interest
                        WHERE event_name = %s
                        ORDER BY created_at ASC
                        """,
                        (event_name,),
                    )
                    rows = cur.fetchall()
                attendees = [{"name": r["name"]} for r in rows]
                invalidate_rsvp_summary_cache()
                self._send_json(200, {
                    "ok": True,
                    "already": False,
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
            name = str(payload.get("name", "")).strip()[:80]
            email = str(payload.get("email", "")).strip().lower()[:160]
            reason = str(payload.get("reason", "")).strip().lower()[:40]
            organization = str(payload.get("organization", "")).strip()[:160]
            details = str(payload.get("details", "")).strip()[:1200]
            year = str(payload.get("year", "")).strip()[:40]
            major = str(payload.get("major", "")).strip()[:120]
            message = str(payload.get("message", "")).strip()[:1200]
            raw_interests = payload.get("interests") or []
            allowed_interests = {
                "Events", "Volunteering", "Professional Development",
                "Culture", "Sports", "Media", "Leadership",
            }
            interests = [i for i in raw_interests if isinstance(i, str) and i in allowed_interests][:7]
            if not name or "@" not in email:
                self._send_json(400, {"error": "Name and a valid email are required."})
                return
            community_reasons = {"sponsorship", "collaborations", "partnerships", "board", "ideas"}
            is_community = reason in community_reasons
            if is_community and not details:
                self._send_json(400, {"error": "Tell us how you would like to work together."})
                return
            if not is_community and not interests:
                self._send_json(400, {"error": "Pick at least one interest area."})
                return
            try:
                with db() as cur:
                    cur.execute(
                        """
                        INSERT INTO connect_interest
                            (reason, name, email, organization, details, year, major, interests, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            reason if is_community else "connect", name, email,
                            organization if is_community else "",
                            details if is_community else (message or "—"),
                            year, major, ", ".join(interests), now,
                        ),
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
    aux.init_tables()
    cms.init_tables()
    schedule.init_tables()
    warm_pool()
    warm_leaderboard_cache()
    server = ThreadingHTTPServer((HOST, PORT), SSAHandler)
    print(f"SSA site running at http://localhost:{PORT}")
    print("PostgreSQL connected — all submissions persist in the database.")
    server.serve_forever()
