"""SSA Timeline events — public sticky-note cards managed from admin."""
import os
import re
from datetime import date, datetime, timezone

from db import db
import cms

DECO_OPTIONS = {"none", "field", "books", "film", "hike", "shoot"}
URL_RE = re.compile(r"^https?://", re.I)


def utcnow():
    return datetime.now(timezone.utc)


def _iso(value):
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _parse_date(value):
    raw = str(value or "").strip()
    if not raw:
        return None
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        return None


def _row_json(row):
    return {
        "id": row["id"],
        "eventDate": row["event_date"].isoformat(),
        "dateLabel": row["date_label"],
        "pill": row["pill"],
        "title": row["title"],
        "heldAt": row["held_at"] or "",
        "copy": row["body"] or "",
        "linkUrl": row["link_url"] or "",
        "linkLabel": row["link_label"] or "View the fun",
        "deco": row["deco"] or "none",
        "sortOrder": int(row["sort_order"] or 0),
        "published": bool(row["published"]),
        "createdAt": _iso(row["created_at"]),
    }


def init_tables():
    with db() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS timeline_events (
                id SERIAL PRIMARY KEY,
                event_date DATE NOT NULL,
                date_label TEXT NOT NULL,
                pill TEXT NOT NULL DEFAULT '',
                title TEXT NOT NULL,
                held_at TEXT NOT NULL DEFAULT '',
                body TEXT NOT NULL DEFAULT '',
                link_url TEXT NOT NULL DEFAULT '',
                link_label TEXT NOT NULL DEFAULT 'View the fun',
                deco TEXT NOT NULL DEFAULT 'none',
                sort_order INTEGER NOT NULL DEFAULT 0,
                published BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS timeline_events_order_idx "
            "ON timeline_events (event_date ASC, sort_order ASC, id ASC)"
        )
        cur.execute("SELECT COUNT(*) AS count FROM timeline_events")
        if int(cur.fetchone()["count"] or 0) == 0:
            seeds = [
                (
                    "2025-06-11",
                    "June 11",
                    "Board Bonding",
                    "SSA Board Bonding — Field Day",
                    "Held at Van Cleve Park",
                    "The full board met each other as a team for the first time through a field day built around connection, games, and setting the tone for the year.",
                    "https://www.tiktok.com/t/ZTS2dNXa6/",
                    "View the fun",
                    "field",
                    10,
                ),
                (
                    "2025-06-25",
                    "June 25",
                    "Board Meeting",
                    "First Board Meeting",
                    "Held with the SSA board",
                    "The first official board meeting set expectations, aligned leadership responsibilities, and started the operational rhythm for the year.",
                    "",
                    "View the fun",
                    "books",
                    20,
                ),
                (
                    "2025-07-02",
                    "July 2",
                    "Community Event",
                    "Somali Cinema Week",
                    "Held during Somali Cinema Week",
                    "A community-centered film moment that brought students together around Somali storytelling, culture, and shared conversation.",
                    "https://www.instagram.com/reel/DaEia-nONFR/?igsh=MWpoZ3gydWYybHVtag==",
                    "View the fun",
                    "film",
                    30,
                ),
                (
                    "2025-07-24",
                    "July 24",
                    "Board Event",
                    "Hike with SSA",
                    "A summer hike with the SSA community",
                    "Board and members hit the trail together for fresh air, conversation, and a shared outdoor reset mid-summer.",
                    "https://www.instagram.com/reel/DbZG_2Qpxs8/?igsh=MW03cDBiODdtbmR3MA==",
                    "View the fun",
                    "hike",
                    40,
                ),
                (
                    "2025-08-23",
                    "August 23",
                    "Board Photoshoot",
                    "SSA Board Photoshoot",
                    "A board portraits day",
                    "The board gathered for a dedicated photoshoot to capture the team, the energy, and the look of the year ahead.",
                    "https://www.tiktok.com/t/ZTDXUYwdp/",
                    "View the fun",
                    "shoot",
                    50,
                ),
            ]
            for seed in seeds:
                cur.execute(
                    """
                    INSERT INTO timeline_events
                        (event_date, date_label, pill, title, held_at, body,
                         link_url, link_label, deco, sort_order, published, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, TRUE, %s)
                    """,
                    (*seed, utcnow()),
                )


def list_public():
    with db() as cur:
        cur.execute(
            """
            SELECT * FROM timeline_events
            WHERE published = TRUE
            ORDER BY event_date ASC, sort_order ASC, id ASC
            """
        )
        rows = cur.fetchall()
    return 200, {"ok": True, "events": [_row_json(row) for row in rows]}


def list_all(payload):
    if not cms.is_admin(payload):
        return 401, {"error": "Invalid password."}
    with db() as cur:
        cur.execute(
            """
            SELECT * FROM timeline_events
            ORDER BY event_date ASC, sort_order ASC, id ASC
            """
        )
        rows = cur.fetchall()
    return 200, {"ok": True, "events": [_row_json(row) for row in rows]}


def save_event(payload):
    if not cms.is_admin(payload):
        return 401, {"error": "Invalid password."}
    event_id = payload.get("id")
    event_date = _parse_date(payload.get("eventDate"))
    if not event_date:
        return 400, {"error": "Pick an event date."}
    date_label = str(payload.get("dateLabel", "")).strip()[:40]
    if not date_label:
        date_label = f"{event_date.strftime('%B')} {event_date.day}"
    pill = str(payload.get("pill", "")).strip()[:48] or "Moment"
    title = str(payload.get("title", "")).strip()[:160]
    if not title:
        return 400, {"error": "Add a title."}
    held_at = str(payload.get("heldAt", "")).strip()[:160]
    body = str(payload.get("copy", payload.get("body", ""))).strip()[:2000]
    link_url = str(payload.get("linkUrl", "")).strip()[:500]
    if link_url and not URL_RE.match(link_url):
        return 400, {"error": "Link must start with http:// or https://."}
    link_label = str(payload.get("linkLabel", "")).strip()[:40] or "View the fun"
    deco = str(payload.get("deco", "none")).strip().lower()
    if deco not in DECO_OPTIONS:
        deco = "none"
    sort_order = int(payload.get("sortOrder") or 0)
    published = bool(payload.get("published", True))

    with db() as cur:
        if event_id:
            cur.execute(
                """
                UPDATE timeline_events SET
                    event_date = %s, date_label = %s, pill = %s, title = %s,
                    held_at = %s, body = %s, link_url = %s, link_label = %s,
                    deco = %s, sort_order = %s, published = %s
                WHERE id = %s
                RETURNING *
                """,
                (
                    event_date, date_label, pill, title, held_at, body,
                    link_url, link_label, deco, sort_order, published, int(event_id),
                ),
            )
            row = cur.fetchone()
            if not row:
                return 404, {"error": "Timeline card not found."}
        else:
            cur.execute(
                """
                INSERT INTO timeline_events
                    (event_date, date_label, pill, title, held_at, body,
                     link_url, link_label, deco, sort_order, published, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
                """,
                (
                    event_date, date_label, pill, title, held_at, body,
                    link_url, link_label, deco, sort_order, published, utcnow(),
                ),
            )
            row = cur.fetchone()
    return 200, {"ok": True, "event": _row_json(row)}


def delete_event(event_id, payload):
    if not cms.is_admin(payload):
        return 401, {"error": "Invalid password."}
    with db() as cur:
        cur.execute("DELETE FROM timeline_events WHERE id = %s", (int(event_id),))
        if cur.rowcount == 0:
            return 404, {"error": "Timeline card not found."}
    return 200, {"ok": True}
