"""Persistent SSA board scheduling polls."""

import hashlib
import hmac
import json
import os
import re
import secrets
from datetime import date, datetime, timedelta, timezone

from db import db


HOUR_START = 8
HOUR_END = 24
SLOT_MINUTES = 60
MAX_DAYS = 366
MAX_MEMBERS = 40
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "SSA")
PIN_RE = re.compile(r"^\d{4}$")
PBKDF2_ROUNDS = 120_000


def utcnow():
    return datetime.now(timezone.utc)


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


def _clean_members(values):
    members = []
    seen = set()
    for value in values if isinstance(values, list) else []:
        name = str(value or "").strip()[:80]
        if not name:
            continue
        key = name.casefold()
        if key in seen:
            continue
        seen.add(key)
        members.append(name)
        if len(members) >= MAX_MEMBERS:
            break
    return members


def _poll_members(poll):
    raw = poll.get("members") if isinstance(poll, dict) else None
    if raw is None and hasattr(poll, "get"):
        raw = poll.get("members")
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            raw = []
    members = _clean_members(raw or [])
    # Legacy polls created before custom name lists.
    if not members and not _has_pin(poll):
        return [
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
        ]
    return members


def _has_pin(poll):
    return bool(poll.get("password_hash") and poll.get("password_salt"))


def _token_key(slug):
    return f"ssaScheduleAccess:{slug}"


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
        cur.execute(
            "ALTER TABLE schedule_polls ADD COLUMN IF NOT EXISTS members JSONB NOT NULL DEFAULT '[]'::jsonb"
        )
        cur.execute(
            "ALTER TABLE schedule_polls ADD COLUMN IF NOT EXISTS password_salt TEXT NOT NULL DEFAULT ''"
        )
        cur.execute(
            "ALTER TABLE schedule_polls ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT ''"
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS schedule_access_tokens (
                id SERIAL PRIMARY KEY,
                poll_id INTEGER NOT NULL REFERENCES schedule_polls(id) ON DELETE CASCADE,
                token TEXT NOT NULL UNIQUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_schedule_access_poll ON schedule_access_tokens (poll_id)"
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
        "boardMembers": _poll_members(poll),
        "locked": False,
        "responses": public_responses,
        "takenNames": [response["member_name"] for response in responses],
        "responseCount": len(responses),
        "aggregate": aggregate,
    }


def _issue_access_token(poll_id):
    token = secrets.token_urlsafe(24)
    with db() as cur:
        cur.execute(
            """
            INSERT INTO schedule_access_tokens (poll_id, token, created_at)
            VALUES (%s, %s, %s)
            """,
            (poll_id, token, utcnow()),
        )
    return token


def _valid_access_token(poll_id, token):
    token = str(token or "").strip()
    if not token:
        return False
    with db() as cur:
        cur.execute(
            """
            SELECT 1 FROM schedule_access_tokens
            WHERE poll_id = %s AND token = %s
            """,
            (poll_id, token),
        )
        return bool(cur.fetchone())


def _locked_stub(poll):
    return {
        "ok": True,
        "locked": True,
        "version": int(poll["version"]),
        "poll": {
            "slug": poll["slug"],
            "title": poll["title"],
            "dateStart": poll["date_start"].isoformat(),
            "dateEnd": poll["date_end"].isoformat(),
            "createdAt": poll["created_at"].isoformat(),
        },
        "boardMembers": [],
        "responses": [],
        "takenNames": [],
        "responseCount": 0,
        "aggregate": {},
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
    members = _clean_members(payload.get("members"))
    if not members:
        return 400, {"error": "Add at least one name for people who can respond."}
    pin = str(payload.get("password", "")).strip()
    if not PIN_RE.match(pin):
        return 400, {"error": "Choose a 4-digit schedule password."}
    salt, password_hash = _hash_pin(pin)
    slug = _new_slug()
    with db() as cur:
        cur.execute(
            """
            INSERT INTO schedule_polls
                (slug, title, date_start, date_end, allowed_slots, members,
                 password_salt, password_hash, version, created_at)
            VALUES (%s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, 1, %s)
            RETURNING *
            """,
            (
                slug,
                title,
                date_start,
                date_end,
                json.dumps(allowed_slots),
                json.dumps(members),
                salt,
                password_hash,
                utcnow(),
            ),
        )
        poll = cur.fetchone()
    access_token = _issue_access_token(poll["id"])
    state = _state_payload(poll, [])
    state["accessToken"] = access_token
    return 201, {"ok": True, "slug": slug, "accessToken": access_token, "state": state}


def get_poll(slug, since=None, access_token=None):
    poll, responses = _poll_rows(slug)
    if not poll:
        return 404, {"error": "This scheduling link does not exist."}
    version = int(poll["version"])
    if _has_pin(poll) and not _valid_access_token(poll["id"], access_token):
        return 200, _locked_stub(poll)
    if since is not None and int(since) == version:
        return 200, {"ok": True, "changed": False, "version": version, "locked": False}
    return 200, _state_payload(poll, responses)


def unlock_poll(slug, payload):
    poll, responses = _poll_rows(slug)
    if not poll:
        return 404, {"error": "This scheduling link does not exist."}
    if not _has_pin(poll):
        state = _state_payload(poll, responses)
        return 200, {"ok": True, "accessToken": "", "state": state}
    pin = str(payload.get("password", "")).strip()
    if not _verify_pin(pin, poll.get("password_salt"), poll.get("password_hash")):
        return 401, {"error": "Incorrect password. Please try again."}
    access_token = _issue_access_token(poll["id"])
    state = _state_payload(poll, responses)
    state["accessToken"] = access_token
    return 200, {"ok": True, "accessToken": access_token, "state": state}


def list_polls():
    with db() as cur:
        cur.execute(
            """
            SELECT p.slug, p.title, p.date_start, p.date_end, p.created_at,
                   p.password_hash, COUNT(a.id)::INTEGER AS response_count
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
        "schedules": [
            {
                "slug": row["slug"],
                "title": row["title"],
                "dateStart": row["date_start"].isoformat(),
                "dateEnd": row["date_end"].isoformat(),
                "createdAt": row["created_at"].isoformat(),
                "responseCount": int(row["response_count"]),
                "locked": bool(row.get("password_hash")),
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
    supplied_token = str(payload.get("responseToken", "")).strip()
    access_token = str(payload.get("accessToken", "")).strip()
    with db() as cur:
        cur.execute("SELECT * FROM schedule_polls WHERE slug = %s FOR UPDATE", (slug,))
        poll = cur.fetchone()
        if not poll:
            return 404, {"error": "This scheduling link does not exist."}
        if _has_pin(poll):
            # Validate access without nesting another DB connection under FOR UPDATE.
            cur.execute(
                """
                SELECT 1 FROM schedule_access_tokens
                WHERE poll_id = %s AND token = %s
                """,
                (poll["id"], access_token),
            )
            if not cur.fetchone():
                return 401, {"error": "Unlock this schedule with its 4-digit password first."}
        members = _poll_members(poll)
        if member_name not in members:
            return 400, {"error": "Choose a name from this schedule's list."}
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
