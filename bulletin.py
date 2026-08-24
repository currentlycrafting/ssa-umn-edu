"""SSA Bulletin Board — roommate / study / friends posts with public email contact."""
import hashlib
import hmac
import os
import re
import secrets
from datetime import datetime, timezone

from db import db

CATEGORIES = {
    "roommates": "Roommates",
    "study": "Study Groups",
    "friends": "Friends & Activities",
}
STATUSES = {"active", "complete"}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PIN_RE = re.compile(r"^\d{4}$")
PBKDF2_ROUNDS = 120_000


def utcnow():
    return datetime.now(timezone.utc)


def _iso(value):
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _hash_pin(pin, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        pin.encode("utf-8"),
        salt.encode("utf-8"),
        PBKDF2_ROUNDS,
    ).hex()
    return salt, digest


def _verify_pin(pin, salt, password_hash):
    if not salt or not password_hash or not PIN_RE.match(pin or ""):
        return False
    _, digest = _hash_pin(pin, salt)
    return hmac.compare_digest(digest, password_hash)


def _post_json(row):
    anonymous = bool(row["anonymous"])
    return {
        "id": row["id"],
        "category": row["category"],
        "categoryLabel": CATEGORIES.get(row["category"], row["category"]),
        "title": row["title"],
        "description": row["description"],
        "name": "Anonymous" if anonymous else row["name"],
        "anonymous": anonymous,
        "email": row["email"],
        "interactionCount": int(row["interaction_count"] or 0),
        "status": row["status"],
        "createdAt": _iso(row["created_at"]),
    }


def init_tables():
    with db() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS bulletin_posts (
                id SERIAL PRIMARY KEY,
                category TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                name TEXT NOT NULL DEFAULT '',
                anonymous BOOLEAN NOT NULL DEFAULT FALSE,
                email TEXT NOT NULL,
                interaction_count INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'active',
                password_salt TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                completed_at TIMESTAMPTZ
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS bulletin_interactions (
                id SERIAL PRIMARY KEY,
                post_id INTEGER NOT NULL REFERENCES bulletin_posts(id) ON DELETE CASCADE,
                guest_token TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (post_id, guest_token)
            )
            """
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS bulletin_posts_status_idx "
            "ON bulletin_posts (status, created_at DESC)"
        )


def list_posts(category=None, status=None):
    clauses = []
    params = []
    if category in CATEGORIES:
        clauses.append("category = %s")
        params.append(category)
    if status in STATUSES:
        clauses.append("status = %s")
        params.append(status)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    with db() as cur:
        cur.execute(
            f"""
            SELECT * FROM bulletin_posts
            {where}
            ORDER BY
                CASE WHEN status = 'active' THEN 0 ELSE 1 END,
                created_at DESC
            LIMIT 200
            """,
            params,
        )
        rows = cur.fetchall()
    return 200, {"ok": True, "posts": [_post_json(row) for row in rows]}


def create_post(payload):
    category = str(payload.get("category", "")).strip().lower()
    title = str(payload.get("title", "")).strip()[:120]
    description = str(payload.get("description", "")).strip()[:1200]
    anonymous = payload.get("anonymous") is True
    name = "" if anonymous else str(payload.get("name", "")).strip()[:80]
    email = str(payload.get("email", "")).strip().lower()[:160]
    pin = str(payload.get("password", "")).strip()

    if category not in CATEGORIES:
        return 400, {"error": "Choose a category."}
    if not title or not description:
        return 400, {"error": "Title and description are required."}
    if not anonymous and not name:
        return 400, {"error": "Enter a name or post anonymously."}
    if not EMAIL_RE.match(email):
        return 400, {"error": "A valid public email is required."}
    if not PIN_RE.match(pin):
        return 400, {"error": "Create a 4-digit password."}

    # Light anti-spam: limit active posts per email
    with db() as cur:
        cur.execute(
            """
            SELECT COUNT(*) AS c FROM bulletin_posts
            WHERE email = %s AND status = 'active'
              AND created_at > NOW() - INTERVAL '24 hours'
            """,
            (email,),
        )
        if int(cur.fetchone()["c"]) >= 5:
            return 429, {"error": "Too many posts from this email today. Try again later."}

        salt, digest = _hash_pin(pin)
        cur.execute(
            """
            INSERT INTO bulletin_posts
                (category, title, description, name, anonymous, email,
                 password_salt, password_hash, status, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'active', %s)
            RETURNING *
            """,
            (
                category, title, description, name, anonymous, email,
                salt, digest, utcnow(),
            ),
        )
        row = cur.fetchone()
    return 200, {"ok": True, "post": _post_json(row)}


def record_interest(post_id, payload):
    guest_token = str(payload.get("guestToken", "")).strip()[:80]
    if len(guest_token) < 16:
        return 400, {"error": "Guest ID is required."}
    with db() as cur:
        cur.execute("SELECT id, status, interaction_count FROM bulletin_posts WHERE id = %s", (int(post_id),))
        post = cur.fetchone()
        if not post:
            return 404, {"error": "Post not found."}
        if post["status"] != "active":
            return 400, {"error": "This post is already complete."}
        cur.execute(
            """
            INSERT INTO bulletin_interactions (post_id, guest_token, created_at)
            VALUES (%s, %s, %s)
            ON CONFLICT (post_id, guest_token) DO NOTHING
            RETURNING id
            """,
            (int(post_id), guest_token, utcnow()),
        )
        inserted = cur.fetchone()
        if inserted:
            cur.execute(
                """
                UPDATE bulletin_posts
                SET interaction_count = interaction_count + 1
                WHERE id = %s
                RETURNING interaction_count
                """,
                (int(post_id),),
            )
            count = int(cur.fetchone()["interaction_count"])
            return 200, {"ok": True, "counted": True, "interactionCount": count}
        return 200, {
            "ok": True,
            "counted": False,
            "interactionCount": int(post["interaction_count"] or 0),
        }


def complete_post(post_id, payload):
    pin = str(payload.get("password", "")).strip()
    if not PIN_RE.match(pin):
        return 400, {"error": "Enter your 4-digit password."}
    with db() as cur:
        cur.execute("SELECT * FROM bulletin_posts WHERE id = %s", (int(post_id),))
        post = cur.fetchone()
        if not post:
            return 404, {"error": "Post not found."}
        if post["status"] == "complete":
            return 200, {"ok": True, "post": _post_json(post)}
        if not _verify_pin(pin, post["password_salt"], post["password_hash"]):
            return 403, {"error": "Incorrect password. Please try again."}
        cur.execute(
            """
            UPDATE bulletin_posts
            SET status = 'complete', completed_at = %s
            WHERE id = %s
            RETURNING *
            """,
            (utcnow(), int(post_id)),
        )
        row = cur.fetchone()
    return 200, {"ok": True, "post": _post_json(row)}
