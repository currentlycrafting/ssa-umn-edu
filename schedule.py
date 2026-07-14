"""Persistent SSA board scheduling polls."""

import json
import os
import secrets
from datetime import date, datetime, timedelta, timezone

from db import db


BOARD_MEMBERS = (
    "Salman Said",
    "Suhaila Osman",
    "Ruweyda Warsame",
    "Muno Aynab",
    "Kamila Deef",
    "Zakaria Samatar",
    "Suhaib Mohamed",
    "Zakaria Hussein",
    "Salma Tawane",
    "Bashir Mumin",
    "Khalid Mohamed",
    "Asma Yusuf",
)

HOUR_START = 8
HOUR_END = 24
SLOT_MINUTES = 60
MAX_DAYS = 366
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "SSA")


def utcnow():
    return datetime.now(timezone.utc)


def init_tables():
    with db() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS schedule_polls (
                id SERIAL PRIMARY KEY,
                slug TEXT NOT NULL UNIQUE,
                title TEXT NOT NULL,
                date_start DATE NOT NULL,
                date_end DATE NOT NULL,
                allowed_slots JSONB NOT NULL DEFAULT '[]'::jsonb,
                version BIGINT NOT NULL DEFAULT 1,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS schedule_availability (
                id SERIAL PRIMARY KEY,
                poll_id INTEGER NOT NULL REFERENCES schedule_polls(id) ON DELETE CASCADE,
                member_name TEXT NOT NULL,
                response_token TEXT NOT NULL,
                slots JSONB NOT NULL DEFAULT '[]'::jsonb,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (poll_id, member_name)
            )
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_schedule_availability_poll
            ON schedule_availability (poll_id)
            """
        )


def _parse_date(value):
    try:
        return date.fromisoformat(str(value or "").strip())
    except ValueError:
        return None


def _all_slots(date_start, date_end):
    slots = []
    current = date_start
    while current <= date_end:
        for minutes in range(HOUR_START * 60, HOUR_END * 60, SLOT_MINUTES):
            hour, minute = divmod(minutes, 60)
            slots.append(f"{current.isoformat()}:{hour:02d}:{minute:02d}")
        current += timedelta(days=1)
    return slots


def _clean_dates(values):
    dates = []
    seen = set()
    for value in values if isinstance(values, list) else []:
        parsed = _parse_date(value)
        if not parsed:
            continue
        key = parsed.isoformat()
        if key in seen:
            continue
        seen.add(key)
        dates.append(parsed)
    dates.sort()
    return dates


def _slots_for_dates(dates):
    slots = []
    for current in dates:
        for minutes in range(HOUR_START * 60, HOUR_END * 60, SLOT_MINUTES):
            hour, minute = divmod(minutes, 60)
            slots.append(f"{current.isoformat()}:{hour:02d}:{minute:02d}")
    return slots


def _clean_slots(values, valid_slots):
    requested = values if isinstance(values, list) else []
    requested_set = {
        str(value) for value in requested
        if isinstance(value, str) and value in valid_slots
    }
    return [slot for slot in valid_slots if slot in requested_set]


def _new_slug():
    for _ in range(8):
        slug = secrets.token_urlsafe(9)
        with db() as cur:
            cur.execute("SELECT 1 FROM schedule_polls WHERE slug = %s", (slug,))
            if not cur.fetchone():
                return slug
    raise RuntimeError("Could not create a unique scheduling link.")


def _poll_rows(slug):
    with db() as cur:
        cur.execute("SELECT * FROM schedule_polls WHERE slug = %s", (slug,))
        poll = cur.fetchone()
        if not poll:
            return None, []
        cur.execute(
            """
            SELECT member_name, slots, updated_at
            FROM schedule_availability
            WHERE poll_id = %s
            ORDER BY updated_at ASC
            """,
            (poll["id"],),
        )
        responses = cur.fetchall()
    return poll, responses


def _state_payload(poll, responses):
    allowed = list(poll["allowed_slots"] or [])
    allowed_set = set(allowed)
    aggregate = {slot: {"count": 0, "names": []} for slot in allowed}
    public_responses = []
    for response in responses:
        slots = [
            slot for slot in list(response["slots"] or [])
            if slot in allowed_set
        ]
        public_responses.append({
            "memberName": response["member_name"],
            "slots": slots,
            "updatedAt": response["updated_at"].isoformat(),
        })
        for slot in slots:
            aggregate[slot]["count"] += 1
            aggregate[slot]["names"].append(response["member_name"])
    return {
        "ok": True,
        "changed": True,
        "version": int(poll["version"]),
        "poll": {
            "slug": poll["slug"],
            "title": poll["title"],
            "dateStart": poll["date_start"].isoformat(),
            "dateEnd": poll["date_end"].isoformat(),
            "dates": sorted({slot[:10] for slot in allowed}),
            "hourStart": HOUR_START,
            "hourEnd": HOUR_END,
            "slotMinutes": SLOT_MINUTES,
            "allowedSlots": allowed,
            "createdAt": poll["created_at"].isoformat(),
        },
        "boardMembers": list(BOARD_MEMBERS),
        "responses": public_responses,
        "takenNames": [response["member_name"] for response in responses],
        "responseCount": len(responses),
        "aggregate": aggregate,
    }


def create_poll(payload):
    title = str(payload.get("title", "")).strip()[:120] or "SSA Board Meeting"
    selected_dates = _clean_dates(payload.get("dates"))
    if not selected_dates:
        date_start = _parse_date(payload.get("dateStart"))
        date_end = _parse_date(payload.get("dateEnd")) or date_start
        if not date_start or not date_end:
            return 400, {"error": "Choose at least one meeting date."}
        if date_end < date_start:
            return 400, {"error": "The end date must be on or after the start date."}
        if (date_end - date_start).days >= MAX_DAYS:
            return 400, {"error": f"Choose no more than {MAX_DAYS} days."}
        selected_dates = []
        current = date_start
        while current <= date_end:
            selected_dates.append(current)
            current += timedelta(days=1)
    if not selected_dates:
        return 400, {"error": "Choose at least one meeting date."}
    if len(selected_dates) > MAX_DAYS:
        return 400, {"error": f"Choose no more than {MAX_DAYS} dates."}
    if (selected_dates[-1] - selected_dates[0]).days >= MAX_DAYS:
        return 400, {"error": "Keep selected dates within a one-year window."}
    date_start = selected_dates[0]
    date_end = selected_dates[-1]
    valid_slots = _slots_for_dates(selected_dates)
    allowed_slots = _clean_slots(payload.get("allowedSlots"), valid_slots)
    if not allowed_slots:
        return 400, {"error": "Select at least one time that could work."}
    slug = _new_slug()
    with db() as cur:
        cur.execute(
            """
            INSERT INTO schedule_polls
                (slug, title, date_start, date_end, allowed_slots, version, created_at)
            VALUES (%s, %s, %s, %s, %s::jsonb, 1, %s)
            RETURNING *
            """,
            (
                slug,
                title,
                date_start,
                date_end,
                json.dumps(allowed_slots),
                utcnow(),
            ),
        )
        poll = cur.fetchone()
    return 201, {"ok": True, "slug": slug, "state": _state_payload(poll, [])}


def get_poll(slug, since=None):
    poll, responses = _poll_rows(slug)
    if not poll:
        return 404, {"error": "This scheduling link does not exist."}
    version = int(poll["version"])
    if since is not None and int(since) == version:
        return 200, {"ok": True, "changed": False, "version": version}
    return 200, _state_payload(poll, responses)


def list_polls():
    with db() as cur:
        cur.execute(
            """
            SELECT p.slug, p.title, p.date_start, p.date_end, p.created_at,
                   COUNT(a.id)::INTEGER AS response_count
            FROM schedule_polls p
            LEFT JOIN schedule_availability a ON a.poll_id = p.id
            GROUP BY p.id
            ORDER BY p.created_at DESC
            LIMIT 100
            """
        )
        rows = cur.fetchall()
    return 200, {
        "ok": True,
        "boardMembers": list(BOARD_MEMBERS),
        "schedules": [
            {
                "slug": row["slug"],
                "title": row["title"],
                "dateStart": row["date_start"].isoformat(),
                "dateEnd": row["date_end"].isoformat(),
                "createdAt": row["created_at"].isoformat(),
                "responseCount": int(row["response_count"]),
            }
            for row in rows
        ],
    }


def delete_poll(slug, payload):
    if str(payload.get("password", "")) != ADMIN_PASSWORD:
        return 401, {"error": "Invalid admin password."}
    with db() as cur:
        cur.execute("DELETE FROM schedule_polls WHERE slug = %s", (slug,))
        if cur.rowcount == 0:
            return 404, {"error": "This schedule no longer exists."}
    return 200, {"ok": True}


def save_availability(slug, payload):
    member_name = str(payload.get("memberName", "")).strip()
    if member_name not in BOARD_MEMBERS:
        return 400, {"error": "Choose a current SSA board member."}
    supplied_token = str(payload.get("responseToken", "")).strip()
    with db() as cur:
        cur.execute("SELECT * FROM schedule_polls WHERE slug = %s FOR UPDATE", (slug,))
        poll = cur.fetchone()
        if not poll:
            return 404, {"error": "This scheduling link does not exist."}
        allowed = list(poll["allowed_slots"] or [])
        slots = _clean_slots(payload.get("slots"), allowed)
        cur.execute(
            """
            SELECT id, response_token
            FROM schedule_availability
            WHERE poll_id = %s AND member_name = %s
            FOR UPDATE
            """,
            (poll["id"], member_name),
        )
        existing = cur.fetchone()
        if existing:
            if not supplied_token or not secrets.compare_digest(
                supplied_token, existing["response_token"]
            ):
                return 409, {
                    "error": (
                        f"{member_name} already responded. "
                        "Use the same browser to edit that response."
                    )
                }
            response_token = existing["response_token"]
            cur.execute(
                """
                UPDATE schedule_availability
                SET slots = %s::jsonb, updated_at = %s
                WHERE id = %s
                """,
                (json.dumps(slots), utcnow(), existing["id"]),
            )
        else:
            response_token = secrets.token_urlsafe(24)
            cur.execute(
                """
                INSERT INTO schedule_availability
                    (poll_id, member_name, response_token, slots, updated_at)
                VALUES (%s, %s, %s, %s::jsonb, %s)
                """,
                (
                    poll["id"],
                    member_name,
                    response_token,
                    json.dumps(slots),
                    utcnow(),
                ),
            )
        cur.execute(
            "UPDATE schedule_polls SET version = version + 1 WHERE id = %s",
            (poll["id"],),
        )
    poll, responses = _poll_rows(slug)
    return 200, {
        "ok": True,
        "responseToken": response_token,
        "state": _state_payload(poll, responses),
    }
