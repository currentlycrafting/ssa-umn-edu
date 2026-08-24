"""SSA content backend — newsletter CMS, image uploads, event suggestions, arcade scores."""
import base64
import json
import os
from datetime import datetime, timezone

from db import db

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "SSA")
ALLOWED_IMAGE_TYPES = {"png": "png", "jpg": "jpg", "jpeg": "jpg", "webp": "webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024

BLOCK_TYPES = {"heading", "paragraph", "announcement", "image", "timeline", "game"}
ARCADE_GAMES = {"daily"}


def utcnow():
    return datetime.now(timezone.utc)


def _iso(value):
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def is_admin(payload):
    return str(payload.get("password", "")) == ADMIN_PASSWORD


# ---------------- newsletter CMS ----------------

def _clean_blocks(blocks):
    if not isinstance(blocks, list):
        return []
    cleaned = []
    for block in blocks[:60]:
        if not isinstance(block, dict):
            continue
        btype = str(block.get("type", "")).strip()
        if btype not in BLOCK_TYPES:
            continue
        item = {"type": btype}
        if btype in ("heading", "paragraph", "announcement"):
            item["text"] = str(block.get("text", ""))[:4000]
        elif btype == "image":
            src = str(block.get("src", ""))[:500]
            if not (src.startswith("/api/uploads/") or src.startswith("/uploads/") or src.startswith("/assets/")):
                continue
            item["src"] = src
            item["caption"] = str(block.get("caption", ""))[:300]
        elif btype == "timeline":
            item["month"] = str(block.get("month", ""))[:40]
            rows = block.get("rows") or []
            item["rows"] = [
                {"date": str(r.get("date", ""))[:20], "label": str(r.get("label", ""))[:120]}
                for r in rows[:20] if isinstance(r, dict)
            ]
        elif btype == "game":
            item["title"] = str(block.get("title", ""))[:120]
            item["text"] = str(block.get("text", ""))[:2000]
            item["link"] = str(block.get("link", ""))[:200]
        cleaned.append(item)
    return cleaned


def list_newsletters(include_drafts=False):
    with db() as cur:
        if include_drafts:
            cur.execute("SELECT id, title, blocks, published, created_at, updated_at FROM newsletters ORDER BY created_at DESC LIMIT 100")
        else:
            cur.execute("SELECT id, title, blocks, published, created_at, updated_at FROM newsletters WHERE published = TRUE ORDER BY created_at DESC LIMIT 100")
        rows = cur.fetchall()
    return 200, {
        "ok": True,
        "newsletters": [
            {
                "id": r["id"],
                "title": r["title"],
                "published": bool(r["published"]),
                "cover": next(
                    (b.get("src", "") for b in json.loads(r["blocks"] or "[]") if b.get("type") == "image"),
                    "",
                ),
                "createdAt": _iso(r["created_at"]),
                "updatedAt": _iso(r["updated_at"]) if r["updated_at"] else "",
            }
            for r in rows
        ],
    }


def get_newsletter(newsletter_id):
    with db() as cur:
        cur.execute("SELECT * FROM newsletters WHERE id = %s", (newsletter_id,))
        row = cur.fetchone()
    if not row:
        return 404, {"error": "Newsletter not found."}
    return 200, {
        "ok": True,
        "newsletter": {
            "id": row["id"],
            "title": row["title"],
            "published": bool(row["published"]),
            "blocks": json.loads(row["blocks"] or "[]"),
            "createdAt": _iso(row["created_at"]),
        },
    }


def save_newsletter(payload):
    if not is_admin(payload):
        return 401, {"error": "Invalid password."}
    title = str(payload.get("title", "")).strip()[:160]
    if not title:
        return 400, {"error": "A title is required."}
    blocks = _clean_blocks(payload.get("blocks"))
    published = bool(payload.get("published"))
    nid = payload.get("id")
    with db() as cur:
        if nid:
            cur.execute(
                "UPDATE newsletters SET title = %s, blocks = %s, published = %s, updated_at = %s WHERE id = %s",
                (title, json.dumps(blocks), published, utcnow(), int(nid)),
            )
            if cur.rowcount == 0:
                return 404, {"error": "Newsletter not found."}
            return 200, {"ok": True, "id": int(nid)}
        cur.execute(
            "INSERT INTO newsletters (title, blocks, published, created_at) VALUES (%s, %s, %s, %s) RETURNING id",
            (title, json.dumps(blocks), published, utcnow()),
        )
        new_id = cur.fetchone()["id"]
    return 200, {"ok": True, "id": new_id}


def delete_newsletter(newsletter_id, payload):
    if not is_admin(payload):
        return 401, {"error": "Invalid password."}
    with db() as cur:
        cur.execute("DELETE FROM newsletters WHERE id = %s", (newsletter_id,))
        if cur.rowcount == 0:
            return 404, {"error": "Newsletter not found."}
    return 200, {"ok": True}


def upload_image(payload):
    """Accepts {password, filename, data(base64)} and stores the image in PostgreSQL."""
    if not is_admin(payload):
        return 401, {"error": "Invalid password."}
    filename = str(payload.get("filename", "image.png"))
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_IMAGE_TYPES:
        return 400, {"error": "Only PNG, JPG, and WEBP images are allowed."}
    data = str(payload.get("data", ""))
    if "," in data:  # strip data URL prefix
        data = data.split(",", 1)[1]
    try:
        raw = base64.b64decode(data)
    except Exception:
        return 400, {"error": "Invalid image data."}
    if not raw or len(raw) > MAX_UPLOAD_BYTES:
        return 400, {"error": "Image must be under 5 MB."}
    content_type = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
    with db() as cur:
        cur.execute(
            """
            INSERT INTO newsletter_images (image_data, content_type, created_at)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (raw, content_type, utcnow()),
        )
        image_id = cur.fetchone()["id"]
    return 200, {"ok": True, "url": f"/api/uploads/{image_id}"}


def get_newsletter_image(image_id):
    with db() as cur:
        cur.execute(
            "SELECT image_data, content_type FROM newsletter_images WHERE id = %s",
            (image_id,),
        )
        row = cur.fetchone()
    if not row:
        return None
    return bytes(row["image_data"]), row["content_type"]


# ---------------- events CMS ----------------

def _event_json(row):
    return {
        "id": row["id"],
        "rsvpKey": row["rsvp_key"],
        "title": row["title"],
        "description": row["description"],
        "location": row["location"] or "",
        "dateLabel": row["date_label"],
        "shortDate": row["short_date"],
        "startTime": row.get("start_time") or "",
        "startsAt": _iso(row["starts_at"]) if row["starts_at"] else "",
        "imageUrl": row["image_url"] or "",
        "attendanceMode": row.get("attendance_mode") or "rsvp",
        "featured": bool(row["featured"]),
        "showCountdown": bool(row.get("show_countdown")),
        "sortOrder": int(row["sort_order"]),
        "published": bool(row["published"]),
    }


def list_events(include_unpublished=False):
    with db() as cur:
        if include_unpublished:
            cur.execute("SELECT * FROM events ORDER BY featured DESC, sort_order ASC, starts_at ASC NULLS LAST")
        else:
            cur.execute(
                "SELECT * FROM events WHERE published = TRUE "
                "ORDER BY featured DESC, sort_order ASC, starts_at ASC NULLS LAST"
            )
        rows = cur.fetchall()
    return [_event_json(row) for row in rows]


def save_event(payload):
    if not is_admin(payload):
        return 401, {"error": "Invalid password."}
    event_id = payload.get("id")
    rsvp_key = str(payload.get("rsvpKey", "")).strip()[:120]
    title = str(payload.get("title", "")).strip()[:160]
    description = str(payload.get("description", "")).strip()[:1200]
    location = str(payload.get("location", "")).strip()[:200]
    date_label = str(payload.get("dateLabel", "")).strip()[:240]
    short_date = str(payload.get("shortDate", "")).strip()[:40]
    start_time = str(payload.get("startTime", "")).strip()[:20]
    image_url = str(payload.get("imageUrl", "")).strip()[:500]
    featured = bool(payload.get("featured"))
    show_countdown = bool(payload.get("showCountdown"))
    attendance_mode = str(payload.get("attendanceMode", "rsvp")).strip().lower()
    if attendance_mode not in ("rsvp", "quick"):
        return 400, {"error": "Choose RSVP form or quick Yes/No."}
    published = payload.get("published") is not False
    try:
        sort_order = int(payload.get("sortOrder", 0))
    except (TypeError, ValueError):
        sort_order = 0
    starts_at = str(payload.get("startsAt", "")).strip() or None
    if show_countdown and not starts_at:
        return 400, {"error": "Set a countdown end date and time."}
    if not rsvp_key:
        rsvp_key = title
    if not short_date:
        short_date = date_label.split("—", 1)[0].strip()[:40]
    if not location and "—" in date_label:
        location = date_label.split("—", 1)[1].strip()[:200]
    if not title or not description or not date_label:
        return 400, {"error": "Public title, full date label, and description are required."}
    if image_url and not (
        image_url.startswith("/assets/") or image_url.startswith("/api/uploads/")
    ):
        return 400, {"error": "Use an uploaded image or a site asset."}
    with db() as cur:
        if event_id:
            cur.execute("SELECT rsvp_key FROM events WHERE id = %s", (int(event_id),))
            existing = cur.fetchone()
            if not existing:
                return 404, {"error": "Event not found."}
            rsvp_key = existing["rsvp_key"]
        if featured:
            cur.execute("UPDATE events SET featured = FALSE WHERE featured = TRUE")
        if event_id:
            cur.execute(
                """
                UPDATE events SET rsvp_key=%s, title=%s, description=%s, location=%s,
                    date_label=%s, short_date=%s, start_time=%s, starts_at=%s, image_url=%s,
                    attendance_mode=%s, featured=%s, show_countdown=%s, sort_order=%s,
                    published=%s, updated_at=%s
                WHERE id=%s
                RETURNING *
                """,
                (
                    rsvp_key, title, description, location, date_label, short_date,
                    start_time, starts_at, image_url, attendance_mode, featured,
                    show_countdown, sort_order, published, utcnow(),
                    int(event_id),
                ),
            )
        else:
            cur.execute(
                """
                INSERT INTO events
                    (rsvp_key, title, description, location, date_label, short_date,
                     start_time, starts_at, image_url, attendance_mode, featured,
                     show_countdown, sort_order, published, created_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING *
                """,
                (
                    rsvp_key, title, description, location, date_label, short_date,
                    start_time, starts_at, image_url, attendance_mode, featured,
                    show_countdown, sort_order, published, utcnow(),
                ),
            )
        row = cur.fetchone()
    if not row:
        return 404, {"error": "Event not found."}
    return 200, {"ok": True, "event": _event_json(row)}


def delete_event(event_id, payload):
    if not is_admin(payload):
        return 401, {"error": "Invalid password."}
    with db() as cur:
        cur.execute("UPDATE events SET published = FALSE, updated_at = %s WHERE id = %s", (utcnow(), event_id))
        if cur.rowcount == 0:
            return 404, {"error": "Event not found."}
    return 200, {"ok": True}


# ---------------- event suggestions ----------------

def add_event_suggestion(payload):
    name = str(payload.get("name", "")).strip()[:120]
    etype = str(payload.get("type", "")).strip().lower()
    description = str(payload.get("description", "")).strip()[:1200]
    audience = str(payload.get("audience", "")).strip()[:200]
    budget = str(payload.get("budget", "")).strip()[:80]
    preferred_date = str(payload.get("preferredDate", "")).strip()[:60]
    notes = str(payload.get("notes", "")).strip()[:800]
    if etype not in ("campus", "community"):
        return 400, {"error": "Pick campus or community."}
    if not name or len(description) < 4:
        return 400, {"error": "Event name and a short description are required."}
    with db() as cur:
        cur.execute(
            """
            INSERT INTO event_suggestions
                (name, type, description, audience, budget, preferred_date, notes, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (name, etype, description, audience, budget, preferred_date, notes, utcnow()),
        )
    return 200, {"ok": True}


def list_event_suggestions():
    with db() as cur:
        cur.execute("SELECT * FROM event_suggestions ORDER BY created_at DESC LIMIT 200")
        rows = cur.fetchall()
    return [
        {
            "name": r["name"],
            "type": r["type"],
            "description": r["description"],
            "audience": r["audience"] or "",
            "budget": r["budget"] or "",
            "preferred_date": r["preferred_date"] or "",
            "notes": r["notes"] or "",
            "created_at": _iso(r["created_at"]),
        }
        for r in rows
    ]


# ---------------- moderated gallery ----------------

def _decode_public_image(data, filename):
    ext = str(filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_IMAGE_TYPES:
        return None, None, "Only PNG, JPG, and WEBP images are allowed."
    encoded = str(data or "")
    if "," in encoded:
        encoded = encoded.split(",", 1)[1]
    try:
        raw = base64.b64decode(encoded, validate=True)
    except Exception:
        return None, None, "Invalid image data."
    if not raw or len(raw) > MAX_UPLOAD_BYTES:
        return None, None, "Image must be under 5 MB."
    mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
    return raw, mime, None


def submit_gallery_item(payload):
    if not is_admin(payload):
        return 401, {"error": "Invalid password."}
    caption = str(payload.get("caption", "")).strip()[:300]
    raw, mime, error = _decode_public_image(payload.get("data"), payload.get("filename"))
    if not caption:
        return 400, {"error": "A caption and photo are required."}
    if error:
        return 400, {"error": error}
    with db() as cur:
        cur.execute(
            """
            INSERT INTO gallery_items
                (submitter, email, caption, alt_text, image_data, content_type, status, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, 'approved', %s)
            RETURNING id
            """,
            ("SSA", "", caption, caption, raw, mime, utcnow()),
        )
        item_id = cur.fetchone()["id"]
    return 200, {"ok": True, "id": item_id, "message": "Added to the gallery."}


def list_gallery_items(include_pending=False):
    with db() as cur:
        if include_pending:
            cur.execute(
                "SELECT id, submitter, email, caption, alt_text, status, created_at "
                "FROM gallery_items ORDER BY created_at DESC LIMIT 300"
            )
        else:
            cur.execute(
                "SELECT id, caption, alt_text, status, created_at FROM gallery_items "
                "WHERE status <> 'rejected' ORDER BY created_at ASC LIMIT 200"
            )
        rows = cur.fetchall()
    return [
        {
            "id": r["id"],
            "submitter": r.get("submitter") or "",
            "email": r.get("email") or "",
            "caption": r["caption"],
            "alt": r["alt_text"],
            "status": r["status"],
            "src": f"/api/gallery/{r['id']}/image",
            "created_at": _iso(r["created_at"]),
        }
        for r in rows
    ]


def get_gallery_image(item_id):
    with db() as cur:
        cur.execute(
            "SELECT image_data, content_type FROM gallery_items WHERE id = %s",
            (item_id,),
        )
        row = cur.fetchone()
    if not row:
        return None
    return bytes(row["image_data"]), row["content_type"]


def delete_gallery_item(item_id, payload):
    if not is_admin(payload):
        return 401, {"error": "Invalid password."}
    with db() as cur:
        cur.execute("DELETE FROM gallery_items WHERE id = %s", (item_id,))
        if cur.rowcount == 0:
            return 404, {"error": "Gallery photo not found."}
    return 200, {"ok": True}


# ---------------- arcade (SSA Daily) ----------------

def arcade_leaderboard(game):
    if game not in ARCADE_GAMES:
        return 400, {"error": "Unknown game."}
    with db() as cur:
        cur.execute(
            """
            SELECT name, score, created_at FROM arcade_scores
            WHERE game = %s
            ORDER BY score DESC, created_at ASC
            LIMIT 10
            """,
            (game,),
        )
        rows = cur.fetchall()
    return 200, {
        "ok": True,
        "scores": [
            {"name": r["name"], "score": int(r["score"]), "date": _iso(r["created_at"])[:10]}
            for r in rows
        ],
    }


def arcade_submit(payload):
    game = str(payload.get("game", "")).strip().lower()
    name = str(payload.get("name", "")).strip()[:24] or "Anonymous"
    if game not in ARCADE_GAMES:
        return 400, {"error": "Unknown game."}
    try:
        score = int(payload.get("score", 0))
    except (TypeError, ValueError):
        return 400, {"error": "Invalid score."}
    score = max(0, min(score, 1_000_000))
    with db() as cur:
        cur.execute(
            "INSERT INTO arcade_scores (game, name, score, created_at) VALUES (%s, %s, %s, %s)",
            (game, name, score, utcnow()),
        )
    return arcade_leaderboard(game)


# ---------------- schema ----------------

def init_tables():
    with db() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS newsletters (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                blocks TEXT NOT NULL DEFAULT '[]',
                published BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS newsletter_images (
                id SERIAL PRIMARY KEY,
                image_data BYTEA NOT NULL,
                content_type TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS event_suggestions (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                description TEXT NOT NULL,
                audience TEXT,
                budget TEXT,
                preferred_date TEXT,
                notes TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                id SERIAL PRIMARY KEY,
                rsvp_key TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                location TEXT,
                date_label TEXT NOT NULL,
                short_date TEXT NOT NULL,
                start_time TEXT NOT NULL DEFAULT '',
                starts_at TIMESTAMPTZ,
                image_url TEXT NOT NULL DEFAULT '',
                attendance_mode TEXT NOT NULL DEFAULT 'rsvp',
                featured BOOLEAN NOT NULL DEFAULT FALSE,
                sort_order INTEGER NOT NULL DEFAULT 0,
                published BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ
            )
            """
        )
        cur.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time TEXT NOT NULL DEFAULT ''")
        cur.execute("ALTER TABLE events ADD COLUMN IF NOT EXISTS attendance_mode TEXT NOT NULL DEFAULT 'rsvp'")
        cur.execute(
            "ALTER TABLE events ADD COLUMN IF NOT EXISTS show_countdown "
            "BOOLEAN NOT NULL DEFAULT FALSE"
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_flags (
                key TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute("SELECT 1 FROM schema_flags WHERE key = 'clear_seed_events_v1'")
        if not cur.fetchone():
            cur.execute(
                """
                DELETE FROM events
                WHERE rsvp_key IN (
                    'Hiking Event', 'Freshman Mixer', 'Fall Kickoff',
                    'Family Feud', 'Field Day'
                )
                """
            )
            cur.execute(
                "INSERT INTO schema_flags (key) VALUES ('clear_seed_events_v1')"
            )
        cur.execute("SELECT 1 FROM schema_flags WHERE key = 'clear_seed_events_v2'")
        if not cur.fetchone():
            cur.execute(
                """
                DELETE FROM events
                WHERE rsvp_key IN (
                    'Hiking Event', 'Freshman Mixer', 'Fall Kickoff',
                    'Family Feud', 'Field Day'
                )
                OR title IN (
                    'SSA Hiking Adventure', 'Freshman Mixer', 'Fall Kickoff',
                    'Family Feud', 'Field Day'
                )
                """
            )
            cur.execute(
                "INSERT INTO schema_flags (key) VALUES ('clear_seed_events_v2')"
            )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS arcade_scores (
                id SERIAL PRIMARY KEY,
                game TEXT NOT NULL,
                name TEXT NOT NULL,
                score INTEGER NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS gallery_items (
                id SERIAL PRIMARY KEY,
                submitter TEXT NOT NULL,
                email TEXT NOT NULL,
                caption TEXT NOT NULL,
                alt_text TEXT NOT NULL,
                image_data BYTEA NOT NULL,
                content_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                reviewed_at TIMESTAMPTZ
            )
            """
        )
        # New connect fields (year/major/interests) reuse connect_interest
        cur.execute("ALTER TABLE connect_interest ADD COLUMN IF NOT EXISTS year TEXT")
        cur.execute("ALTER TABLE connect_interest ADD COLUMN IF NOT EXISTS major TEXT")
        cur.execute("ALTER TABLE connect_interest ADD COLUMN IF NOT EXISTS interests TEXT")
