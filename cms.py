"""SSA content backend — newsletter CMS, image uploads, event suggestions, arcade scores."""
import base64
import json
import os
import re
import secrets
from datetime import datetime, timezone
from pathlib import Path

from db import db

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Ilovesomalia393@")
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
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
            if not (src.startswith("/uploads/") or src.startswith("/assets/")):
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
            cur.execute("SELECT id, title, published, created_at, updated_at FROM newsletters ORDER BY created_at DESC LIMIT 100")
        else:
            cur.execute("SELECT id, title, published, created_at, updated_at FROM newsletters WHERE published = TRUE ORDER BY created_at DESC LIMIT 100")
        rows = cur.fetchall()
    return 200, {
        "ok": True,
        "newsletters": [
            {
                "id": r["id"],
                "title": r["title"],
                "published": bool(r["published"]),
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
    """Accepts {password, filename, data(base64)} and stores under /uploads."""
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
    UPLOAD_DIR.mkdir(exist_ok=True)
    safe = re.sub(r"[^a-z0-9-]", "", filename.rsplit(".", 1)[0].lower().replace(" ", "-"))[:40] or "image"
    name = f"{safe}-{secrets.token_hex(5)}.{ALLOWED_IMAGE_TYPES[ext]}"
    (UPLOAD_DIR / name).write_bytes(raw)
    return 200, {"ok": True, "url": f"/uploads/{name}"}


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
    submitter = str(payload.get("submitter", "")).strip()[:100]
    email = str(payload.get("email", "")).strip().lower()[:180]
    caption = str(payload.get("caption", "")).strip()[:300]
    alt_text = str(payload.get("alt", "")).strip()[:300]
    raw, mime, error = _decode_public_image(payload.get("data"), payload.get("filename"))
    if not submitter or "@" not in email or not caption or not alt_text:
        return 400, {"error": "Name, email, caption, and photo description are required."}
    if error:
        return 400, {"error": error}
    with db() as cur:
        cur.execute(
            """
            INSERT INTO gallery_items
                (submitter, email, caption, alt_text, image_data, content_type, status, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, 'pending', %s)
            RETURNING id
            """,
            (submitter, email, caption, alt_text, raw, mime, utcnow()),
        )
        item_id = cur.fetchone()["id"]
    return 200, {"ok": True, "id": item_id, "message": "Submitted for board review."}


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
                "WHERE status = 'approved' ORDER BY created_at DESC LIMIT 200"
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


def moderate_gallery_item(item_id, payload):
    if not is_admin(payload):
        return 401, {"error": "Invalid password."}
    action = str(payload.get("action", "")).strip().lower()
    if action not in ("approved", "rejected"):
        return 400, {"error": "Choose approve or reject."}
    with db() as cur:
        cur.execute(
            "UPDATE gallery_items SET status = %s, reviewed_at = %s WHERE id = %s",
            (action, utcnow(), item_id),
        )
        if cur.rowcount == 0:
            return 404, {"error": "Gallery submission not found."}
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
