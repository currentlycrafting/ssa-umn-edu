"""SSA content backend — newsletter CMS, image uploads, event suggestions, arcade scores."""
import base64
import json
import os
from datetime import datetime, timedelta, timezone
from urllib.parse import quote
from zoneinfo import ZoneInfo

from db import db

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "SSA")
BASE_URL = (os.environ.get("BASE_URL") or "https://www.ssaumn.com").rstrip("/")
ALLOWED_IMAGE_TYPES = {"png": "png", "jpg": "jpg", "jpeg": "jpg", "webp": "webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
DISPLAY_TZ = ZoneInfo("America/Chicago")
PAST_EVENT_DAYS = 90

BLOCK_TYPES = {"heading", "paragraph", "announcement", "image", "timeline", "game"}
ALLOWED_RICH_TAGS = {"b", "strong", "i", "em", "u", "ul", "ol", "li", "br", "p", "span", "div"}
ALLOWED_FONTS = {
    "Georgia, serif",
    '"Plus Jakarta Sans", sans-serif',
    '"Caveat", cursive',
    '"Times New Roman", Times, serif',
    '"Courier New", monospace',
}
ARCADE_GAMES = {"daily"}


def utcnow():
    return datetime.now(timezone.utc)


def _iso(value):
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def is_admin(payload):
    return str(payload.get("password", "")) == ADMIN_PASSWORD


def _sanitize_html(value):
    import re
    html = str(value or "")[:8000]
    # Strip scripts/styles and disallowed tags while keeping a small formatting subset.
    html = re.sub(r"(?is)<(script|style).*?>.*?</\1>", "", html)
    html = re.sub(r"(?i)\son\w+\s*=\s*([\"']).*?\1", "", html)
    html = re.sub(r"(?i)\son\w+\s*=\s*[^\s>]+", "", html)
    html = re.sub(r"(?i)javascript:", "", html)

    def replacer(match):
        tag = match.group(1).lower()
        closing = match.group(0).startswith("</")
        name = tag.lstrip("/")
        if name not in ALLOWED_RICH_TAGS:
            return ""
        if closing:
            return f"</{name}>"
        if name == "br":
            return "<br>"
        if name == "span":
            style = ""
            style_match = re.search(r"(?i)style\s*=\s*[\"']([^\"']*)[\"']", match.group(0))
            if style_match:
                safe_bits = []
                for part in style_match.group(1).split(";"):
                    bit = part.strip().lower()
                    if bit.startswith("color:") or bit.startswith("font-family:") or bit.startswith("font-weight:") or bit.startswith("font-style:") or bit.startswith("text-decoration:"):
                        safe_bits.append(part.strip())
                if safe_bits:
                    style = f' style="{"; ".join(safe_bits)}"'
            return f"<span{style}>"
        return f"<{name}>"

    return re.sub(r"</?([a-z0-9]+)([^>]*)>", replacer, html)


def _clean_side_image(value):
    if not isinstance(value, dict):
        return None
    src = str(value.get("src", ""))[:500]
    if not (src.startswith("/api/uploads/") or src.startswith("/uploads/") or src.startswith("/assets/")):
        return None
    return {"src": src, "caption": str(value.get("caption", ""))[:300]}


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
        if btype == "paragraph":
            item["text"] = str(block.get("text", ""))[:4000]
            item["html"] = _sanitize_html(block.get("html", ""))
            font = str(block.get("font", "Georgia, serif"))[:80]
            item["font"] = font if font in ALLOWED_FONTS else "Georgia, serif"
            color = str(block.get("color", "#1f2430"))[:20]
            item["color"] = color if color.startswith("#") and len(color) <= 9 else "#1f2430"
            item["indent"] = bool(block.get("indent"))
            left = _clean_side_image(block.get("sideLeft"))
            right = _clean_side_image(block.get("sideRight"))
            if left:
                item["sideLeft"] = left
            if right:
                item["sideRight"] = right
        elif btype in ("heading", "announcement"):
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
    event_id = row["id"]
    return {
        "id": event_id,
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


def _parse_starts_at(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    text = str(value).strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _annotate_events(events, public_only=False):
    now = utcnow()
    past_cutoff = now - timedelta(days=PAST_EVENT_DAYS)
    annotated = []
    for event in events:
        starts = _parse_starts_at(event.get("startsAt"))
        event = dict(event)
        event["showCountdown"] = True
        event["_starts"] = starts
        past = bool(starts and starts <= now)
        event["past"] = past
        if public_only:
            if not starts:
                continue
            if past and starts < past_cutoff:
                continue
        annotated.append(event)
    upcoming = [e for e in annotated if not e.get("past")]
    past_events = [e for e in annotated if e.get("past")]
    upcoming.sort(
        key=lambda event: (
            event["_starts"] is None,
            event["_starts"] or datetime.max.replace(tzinfo=timezone.utc),
            event.get("sortOrder", 0),
        )
    )
    past_events.sort(
        key=lambda event: event["_starts"] or datetime.min.replace(tzinfo=timezone.utc),
        reverse=True,
    )
    annotated = upcoming + past_events
    next_id = upcoming[0]["id"] if upcoming else None
    for event in annotated:
        event["featured"] = event.get("id") == next_id and next_id is not None
        event.pop("_starts", None)
    return annotated


def list_events(include_unpublished=False):
    with db() as cur:
        if include_unpublished:
            cur.execute("SELECT * FROM events ORDER BY starts_at ASC NULLS LAST, sort_order ASC")
        else:
            cur.execute(
                "SELECT * FROM events WHERE published = TRUE "
                "ORDER BY starts_at ASC NULLS LAST, sort_order ASC"
            )
        rows = cur.fetchall()
    events = [_event_json(row) for row in rows]
    return _annotate_events(events, public_only=not include_unpublished)


def get_event(event_id):
    with db() as cur:
        cur.execute("SELECT * FROM events WHERE id = %s AND published = TRUE", (int(event_id),))
        row = cur.fetchone()
    if not row:
        return None
    return _annotate_events([_event_json(row)], public_only=False)[0]


def event_ics(event):
    """Build a minimal .ics calendar payload for one event."""
    starts = _parse_starts_at(event.get("startsAt"))
    if not starts:
        return None
    ends = starts + timedelta(hours=2)
    def stamp(dt):
        return dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    uid = f"ssa-event-{event['id']}@ssaumn.com"
    summary = (event.get("title") or "SSA Event").replace("\n", " ")
    description = (event.get("description") or "").replace("\n", "\\n")
    location = (event.get("location") or "").replace("\n", " ")
    url = f"{BASE_URL}/events"
    return "\r\n".join([
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//SSA UMN//Events//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{stamp(utcnow())}",
        f"DTSTART:{stamp(starts)}",
        f"DTEND:{stamp(ends)}",
        f"SUMMARY:{summary}",
        f"DESCRIPTION:{description}",
        f"LOCATION:{location}",
        f"URL:{url}",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
    ])


def google_calendar_url(event):
    starts = _parse_starts_at(event.get("startsAt"))
    if not starts:
        return ""
    ends = starts + timedelta(hours=2)
    def stamp(dt):
        return dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    params = {
        "action": "TEMPLATE",
        "text": event.get("title") or "SSA Event",
        "dates": f"{stamp(starts)}/{stamp(ends)}",
        "details": event.get("description") or "",
        "location": event.get("location") or "",
    }
    query = "&".join(f"{k}={quote(str(v))}" for k, v in params.items())
    return f"https://calendar.google.com/calendar/render?{query}"


def save_event(payload):
    if not is_admin(payload):
        return 401, {"error": "Invalid password."}
    event_id = payload.get("id")
    rsvp_key = str(payload.get("rsvpKey", "")).strip()[:120]
    title = str(payload.get("title", "")).strip()[:160]
    description = str(payload.get("description", "")).strip()[:1200]
    location = str(payload.get("location", "")).strip()[:200]
    image_url = str(payload.get("imageUrl", "")).strip()[:500]
    attendance_mode = str(payload.get("attendanceMode", "rsvp")).strip().lower()
    if attendance_mode not in ("rsvp", "quick"):
        return 400, {"error": "Choose RSVP form or quick Yes/No."}
    published = payload.get("published") is not False
    try:
        sort_order = int(payload.get("sortOrder", 0))
    except (TypeError, ValueError):
        sort_order = 0
    starts = _parse_starts_at(payload.get("startsAt"))
    if not starts:
        return 400, {"error": "Set a date and start time."}
    starts_at = starts.isoformat()
    local = starts.astimezone(DISPLAY_TZ)
    start_time = local.strftime("%H:%M")
    date_label = local.strftime("%B %d, %Y · %I:%M %p").replace(" 0", " ")
    short_date = local.strftime("%b %d").replace(" 0", " ")
    if location:
        date_label = f"{local.strftime('%B %d').replace(' 0', ' ')} - {location}"
        short_date = local.strftime("%b %d").replace(" 0", " ")
    show_countdown = True
    featured = False
    if not rsvp_key:
        rsvp_key = title
    if not title or not description:
        return 400, {"error": "Title and description are required."}
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
        if event_id:
            cur.execute(
                """
                UPDATE events SET rsvp_key=%s, title=%s, description=%s, location=%s,
                    date_label=%s, short_date=%s, start_time=%s, starts_at=%s, image_url=%s,
                    attendance_mode=%s, featured=%s, show_countdown=%s,
                    sort_order=%s, published=%s, updated_at=%s
                WHERE id=%s
                RETURNING *
                """,
                (
                    rsvp_key, title, description, location, date_label, short_date,
                    start_time, starts_at, image_url, attendance_mode,
                    featured, show_countdown, sort_order, published, utcnow(),
                    int(event_id),
                ),
            )
        else:
            cur.execute(
                """
                INSERT INTO events
                    (rsvp_key, title, description, location, date_label, short_date,
                     start_time, starts_at, image_url, attendance_mode,
                     featured, show_countdown, sort_order, published, created_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING *
                """,
                (
                    rsvp_key, title, description, location, date_label, short_date,
                    start_time, starts_at, image_url, attendance_mode,
                    featured, show_countdown, sort_order, published, utcnow(),
                ),
            )
        row = cur.fetchone()
    if not row:
        return 404, {"error": "Event not found."}
    return 200, {"ok": True, "event": _annotate_events([_event_json(row)])[0]}


def delete_event(event_id, payload):
    if not is_admin(payload):
        return 401, {"error": "Invalid password."}
    with db() as cur:
        cur.execute("SELECT rsvp_key FROM events WHERE id = %s", (event_id,))
        row = cur.fetchone()
        if not row:
            return 404, {"error": "Event not found."}
        cur.execute("DELETE FROM rsvp_interest WHERE event_name = %s", (row["rsvp_key"],))
        cur.execute("DELETE FROM events WHERE id = %s", (event_id,))
    return 200, {"ok": True}


# ---------------- event suggestions ----------------

def _store_suggestion_image(filename, data):
    raw, mime, error = _decode_public_image(data, filename)
    if error:
        return None, error
    with db() as cur:
        cur.execute(
            """
            INSERT INTO newsletter_images (image_data, content_type, created_at)
            VALUES (%s, %s, %s)
            RETURNING id
            """,
            (raw, mime, utcnow()),
        )
        image_id = cur.fetchone()["id"]
    return f"/api/uploads/{image_id}", None


def add_event_suggestion(payload):
    name = str(payload.get("name", "")).strip()[:120]
    etype = str(payload.get("type", "")).strip().lower() or "campus"
    description = str(payload.get("description", "")).strip()[:1200]
    audience = str(payload.get("audience", "")).strip()[:200]
    budget = str(payload.get("budget", "")).strip()[:80]
    preferred_date = str(payload.get("preferredDate", "")).strip()[:60]
    fun_answer = str(payload.get("funAnswer", "")).strip().lower()
    inspiration_links = str(payload.get("inspirationLinks", "")).strip()[:1200]
    notes = str(payload.get("notes", "")).strip()
    if etype not in ("campus", "community"):
        return 400, {"error": "Pick campus or community."}
    if not name or len(description) < 4:
        return 400, {"error": "Event name and a short description are required."}
    note_parts = []
    if notes:
        note_parts.append(notes)
    if fun_answer in ("yes", "no"):
        note_parts.append(f"Would show up tomorrow: {fun_answer}")
    if inspiration_links:
        note_parts.append(f"Inspiration links:\n{inspiration_links}")
    images = payload.get("inspirationImages") or []
    if isinstance(images, list):
        for item in images[:3]:
            if not isinstance(item, dict):
                continue
            url, error = _store_suggestion_image(item.get("filename"), item.get("data"))
            if error:
                return 400, {"error": error}
            note_parts.append(f"Inspiration image: {url}")
    notes = "\n\n".join(note_parts).strip()[:4000]
    with db() as cur:
        cur.execute(
            """
            INSERT INTO event_suggestions
                (name, type, description, audience, budget, preferred_date, notes, votes, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 0, %s)
            RETURNING id
            """,
            (name, etype, description, audience, budget, preferred_date, notes, utcnow()),
        )
        suggestion_id = cur.fetchone()["id"]
    return 200, {"ok": True, "id": suggestion_id}


def vote_event_suggestion(suggestion_id, payload):
    guest_token = str(payload.get("guestToken", "")).strip()[:80]
    if len(guest_token) < 16:
        return 400, {"error": "Missing voter id."}
    with db() as cur:
        cur.execute("SELECT id, votes FROM event_suggestions WHERE id = %s", (int(suggestion_id),))
        row = cur.fetchone()
        if not row:
            return 404, {"error": "Suggestion not found."}
        cur.execute(
            """
            INSERT INTO event_suggestion_votes (suggestion_id, guest_token, created_at)
            VALUES (%s, %s, %s)
            ON CONFLICT (suggestion_id, guest_token) DO NOTHING
            RETURNING id
            """,
            (int(suggestion_id), guest_token, utcnow()),
        )
        inserted = cur.fetchone()
        if not inserted:
            cur.execute(
                "SELECT votes FROM event_suggestions WHERE id = %s",
                (int(suggestion_id),),
            )
            votes = int(cur.fetchone()["votes"] or 0)
            return 200, {"ok": True, "already": True, "votes": votes}
        cur.execute(
            """
            UPDATE event_suggestions
            SET votes = COALESCE(votes, 0) + 1
            WHERE id = %s
            RETURNING votes
            """,
            (int(suggestion_id),),
        )
        votes = int(cur.fetchone()["votes"])
    return 200, {"ok": True, "already": False, "votes": votes}


def list_event_suggestions():
    with db() as cur:
        cur.execute(
            """
            SELECT * FROM event_suggestions
            ORDER BY COALESCE(votes, 0) DESC, created_at DESC
            LIMIT 200
            """
        )
        rows = cur.fetchall()
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "type": r["type"],
            "description": r["description"],
            "audience": r["audience"] or "",
            "budget": r["budget"] or "",
            "preferred_date": r["preferred_date"] or "",
            "notes": r["notes"] or "",
            "votes": int(r.get("votes") or 0),
            "created_at": _iso(r["created_at"]),
        }
        for r in rows
    ]


def list_event_suggestions_public():
    """Public homepage feed — excludes notes (may contain contact/inspiration details)."""
    with db() as cur:
        cur.execute(
            """
            SELECT id, name, type, description, audience, preferred_date, votes, created_at
            FROM event_suggestions
            ORDER BY COALESCE(votes, 0) DESC, created_at DESC
            LIMIT 200
            """
        )
        rows = cur.fetchall()
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "type": r["type"],
            "description": r["description"],
            "audience": r["audience"] or "",
            "preferred_date": r["preferred_date"] or "",
            "votes": int(r.get("votes") or 0),
            "created_at": _iso(r["created_at"]),
        }
        for r in rows
    ]


def submit_event_feedback(payload):
    event_name = str(payload.get("event", "")).strip()[:120]
    guest_token = str(payload.get("guestToken", "")).strip()[:80]
    comment = str(payload.get("comment", "")).strip()[:280]
    try:
        rating = int(payload.get("rating", 0))
    except (TypeError, ValueError):
        rating = 0
    if not event_name or len(guest_token) < 16:
        return 400, {"error": "Event and guest id are required."}
    if rating < 1 or rating > 5:
        return 400, {"error": "Pick a rating from 1 to 5."}
    if not comment:
        return 400, {"error": "Leave a one-line note."}
    with db() as cur:
        cur.execute(
            "SELECT id FROM events WHERE rsvp_key = %s AND published = TRUE",
            (event_name,),
        )
        if not cur.fetchone():
            return 404, {"error": "Event not found."}
        cur.execute(
            """
            INSERT INTO event_feedback (event_name, guest_token, rating, comment, created_at)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (event_name, guest_token)
            DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = EXCLUDED.created_at
            RETURNING id
            """,
            (event_name, guest_token, rating, comment, utcnow()),
        )
    return 200, {"ok": True}


def list_event_feedback_admin(payload):
    if not is_admin(payload):
        return 401, {"error": "Invalid password."}
    with db() as cur:
        cur.execute(
            """
            SELECT event_name, rating, comment, created_at
            FROM event_feedback
            ORDER BY created_at DESC
            LIMIT 300
            """
        )
        rows = cur.fetchall()
    return 200, {
        "ok": True,
        "items": [
            {
                "event_name": r["event_name"],
                "rating": int(r["rating"]),
                "comment": r["comment"],
                "created_at": _iso(r["created_at"]),
            }
            for r in rows
        ],
    }


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


def list_gallery_items(include_pending=False, limit=None):
    try:
        limit = int(limit) if limit is not None else None
    except (TypeError, ValueError):
        limit = None
    if limit is not None:
        limit = max(1, min(limit, 300))
    with db() as cur:
        if include_pending:
            cur.execute(
                "SELECT id, submitter, email, caption, alt_text, status, created_at "
                "FROM gallery_items ORDER BY created_at DESC LIMIT %s",
                (limit or 300,),
            )
        else:
            cur.execute(
                "SELECT id, caption, alt_text, status, created_at FROM gallery_items "
                "WHERE status <> 'rejected' ORDER BY created_at ASC LIMIT %s",
                (limit or 200,),
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
            "ALTER TABLE event_suggestions ADD COLUMN IF NOT EXISTS votes INTEGER NOT NULL DEFAULT 0"
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS event_suggestion_votes (
                id SERIAL PRIMARY KEY,
                suggestion_id INTEGER NOT NULL REFERENCES event_suggestions(id) ON DELETE CASCADE,
                guest_token TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (suggestion_id, guest_token)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS event_feedback (
                id SERIAL PRIMARY KEY,
                event_name TEXT NOT NULL,
                guest_token TEXT NOT NULL,
                rating INTEGER NOT NULL,
                comment TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (event_name, guest_token)
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id SERIAL PRIMARY KEY,
                endpoint TEXT NOT NULL UNIQUE,
                p256dh TEXT NOT NULL DEFAULT '',
                auth TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
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
