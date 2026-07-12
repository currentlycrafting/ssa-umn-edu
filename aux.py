"""Want The Aux — guest song requests with Spotify playback for one host.

Guests never touch Spotify auth: search uses the app's client-credentials
token. Exactly one person (the DJ) connects their Spotify account via OAuth;
playback endpoints verify the DJ key on every request.
"""
import secrets
import time
from datetime import datetime, timezone

import spotify
from db import db


def utcnow():
    return datetime.now(timezone.utc)


def _iso(value):
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def bump_version(cur):
    cur.execute("UPDATE aux_meta SET version = version + 1 WHERE id = 1")


def _meta(cur):
    cur.execute("SELECT * FROM aux_meta WHERE id = 1")
    return cur.fetchone()


def _dj(cur):
    cur.execute("SELECT * FROM aux_dj WHERE id = 1")
    return cur.fetchone()


def dj_authorized(cur, key):
    row = _dj(cur)
    return bool(row and row["dj_key"] and key and secrets.compare_digest(row["dj_key"], key))


def _dj_access_token():
    """Fresh access token for the connected DJ, refreshing when expired."""
    with db() as cur:
        row = _dj(cur)
    if not row or not row["refresh_token"]:
        return None
    now_ts = time.time()
    if row["access_token"] and row["expires_at"] and row["expires_at"] > now_ts + 30:
        return spotify.unseal(row["access_token"])
    refreshed = spotify.refresh_access_token(spotify.unseal(row["refresh_token"]))
    access = refreshed["access_token"]
    new_refresh = refreshed.get("refresh_token")
    with db() as cur:
        cur.execute(
            """
            UPDATE aux_dj
            SET access_token = %s,
                expires_at = %s,
                refresh_token = COALESCE(%s, refresh_token)
            WHERE id = 1
            """,
            (
                spotify.seal(access),
                now_ts + int(refreshed.get("expires_in", 3600)),
                spotify.seal(new_refresh) if new_refresh else None,
            ),
        )
    return access


# ---------------- guest-facing ----------------

def search(query):
    query = (query or "").strip()
    if not query:
        return 400, {"error": "Type a song or artist to search."}
    if not spotify.configured():
        return 503, {"error": "Spotify is not configured on the server."}
    try:
        results = spotify.search_tracks(spotify.app_token(), query)
    except spotify.SpotifyError as exc:
        return 502, {"error": f"Spotify search failed: {exc.message}"}
    return 200, {"ok": True, "results": results}


def get_state(since, guest_id=""):
    with db() as cur:
        meta = _meta(cur)
        version = int(meta["version"])
        dj = _dj(cur)

    token = None
    now_playing = None
    spotify_queue = []
    spotify_state_ok = False
    connected = bool(dj and dj["refresh_token"])
    if connected:
        try:
            token = _dj_access_token()
            if token:
                now_playing = spotify.currently_playing(token)
                spotify_queue = spotify.user_queue(token)
                spotify_state_ok = True
        except spotify.SpotifyError:
            token = None
            now_playing = None
            spotify_queue = []

    with db() as cur:
        changed = False
        if now_playing and now_playing.get("trackId"):
            cur.execute(
                """
                UPDATE aux_requests
                SET played = TRUE, played_at = %s
                WHERE track_id = %s AND played = FALSE
                """,
                (utcnow(), now_playing["trackId"]),
            )
            if cur.rowcount:
                changed = True
        if spotify_state_ok:
            upcoming_ids = {
                song.get("trackId") for song in spotify_queue if song.get("trackId")
            }
            cur.execute(
                """
                SELECT id, track_id, queued_to_spotify, created_at, queued_at
                FROM aux_requests
                WHERE played = FALSE
                """
            )
            check_time = utcnow()
            for request in cur.fetchall():
                queued_time = request["queued_at"] or request["created_at"]
                old_enough = (check_time - queued_time).total_seconds() >= 10
                if request["track_id"] in upcoming_ids and not request["queued_to_spotify"]:
                    cur.execute(
                        """
                        UPDATE aux_requests
                        SET queued_to_spotify = TRUE, queued_at = COALESCE(queued_at, %s)
                        WHERE id = %s
                        """,
                        (check_time, request["id"]),
                    )
                    changed = True
                elif (
                    request["queued_to_spotify"]
                    and old_enough
                    and request["track_id"] not in upcoming_ids
                ):
                    cur.execute("DELETE FROM aux_requests WHERE id = %s", (request["id"],))
                    changed = True
        if changed:
            bump_version(cur)

    if token and now_playing:
        with db() as cur:
            cur.execute(
                """
                SELECT id, track_id FROM aux_requests
                WHERE played = FALSE AND queued_to_spotify = FALSE
                ORDER BY created_at ASC
                """
            )
            waiting = cur.fetchall()
        added_to_spotify = False
        for request in waiting:
            with db() as cur:
                cur.execute(
                    """
                    UPDATE aux_requests
                    SET queued_to_spotify = TRUE, queued_at = %s
                    WHERE id = %s AND played = FALSE AND queued_to_spotify = FALSE
                    RETURNING id
                    """,
                    (utcnow(), request["id"]),
                )
                claimed = cur.fetchone()
                if claimed:
                    bump_version(cur)
            if not claimed:
                continue
            try:
                spotify.queue_track(token, request["track_id"])
                added_to_spotify = True
            except spotify.SpotifyError as exc:
                if exc.status == 404:
                    with db() as cur:
                        cur.execute(
                            """
                            UPDATE aux_requests
                            SET queued_to_spotify = FALSE, queued_at = NULL
                            WHERE id = %s AND played = FALSE
                            """,
                            (request["id"],),
                        )
                        bump_version(cur)
            except Exception:
                # Keep the request claimed so an ambiguous Spotify response
                # can never enqueue the same song twice.
                pass
        if added_to_spotify:
            try:
                spotify_queue = spotify.user_queue(token)
            except spotify.SpotifyError:
                pass

    with db() as cur:
        meta = _meta(cur)
        version = int(meta["version"])
        cur.execute(
            """
            SELECT * FROM aux_requests
            WHERE played = FALSE
            ORDER BY created_at ASC
            LIMIT 100
            """
        )
        rows = cur.fetchall()

    spotify_order = {
        song.get("trackId"): index
        for index, song in enumerate(spotify_queue)
        if song.get("trackId")
    }
    rows = sorted(
        rows,
        key=lambda row: (
            spotify_order.get(row["track_id"], len(spotify_order) + 1),
            row["created_at"],
        ),
    )

    return 200, {
        "ok": True,
        "changed": True,
        "version": version,
        "title": meta["title"],
        "djConnected": connected,
        "djName": (dj["display_name"] if dj else "") or "",
        "nowPlaying": now_playing,
        "spotifyQueue": spotify_queue,
        "queue": [
            {
                "id": r["id"],
                "trackId": r["track_id"],
                "songName": r["song_name"],
                "artist": r["artist"],
                "albumImage": r["album_image"] or "",
                "requestedBy": r["requested_by"],
                "queued": bool(r["queued_to_spotify"]),
                "canDelete": bool(
                    guest_id
                    and r["guest_id"]
                    and secrets.compare_digest(guest_id, r["guest_id"])
                ),
                "createdAt": _iso(r["created_at"]),
            }
            for r in rows
        ],
    }


def add_request(payload):
    name = str(payload.get("name", "")).strip()[:40] or "Anonymous"
    guest_id = str(payload.get("guestId", "")).strip()[:80]
    track_id = str(payload.get("trackId", "")).strip()
    song_name = str(payload.get("songName", "")).strip()[:200]
    artist = str(payload.get("artist", "")).strip()[:200]
    album_image = str(payload.get("albumImage", "")).strip()[:500]
    if not track_id.isalnum() or not (8 <= len(track_id) <= 40) or not song_name:
        return 400, {"error": "Pick a song from the search results."}
    if len(guest_id) < 16:
        return 400, {"error": "Refresh the page before requesting a song."}

    # Persist first. Once this row exists, retries and double-clicks cannot send
    # the same track to Spotify again.
    queued_at = utcnow()
    with db() as cur:
        cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (track_id,))
        cur.execute("SELECT 1 FROM aux_requests WHERE track_id = %s", (track_id,))
        if cur.fetchone():
            return 409, {"error": "That song has already been requested or played."}
        cur.execute(
            """
            INSERT INTO aux_requests (
                track_id, song_name, artist, album_image, requested_by,
                guest_id, queued_to_spotify, created_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, FALSE, %s)
            RETURNING id
            """,
            (track_id, song_name, artist, album_image, name, guest_id, queued_at),
        )
        rid = cur.fetchone()["id"]
        bump_version(cur)

    queued = False
    try:
        token = _dj_access_token()
        if token:
            # This is the only code path that adds this request to Spotify.
            spotify.queue_track(token, track_id)
            queued = True
            with db() as cur:
                cur.execute(
                    """
                    UPDATE aux_requests
                    SET queued_to_spotify = TRUE, queued_at = %s
                    WHERE id = %s
                    """,
                    (utcnow(), rid),
                )
                bump_version(cur)
    except Exception:
        # The request stays visible even if Spotify is unavailable or its
        # success response is lost. It is never retried automatically.
        queued = False
    return 200, {"ok": True, "id": rid, "queued": queued}


# ---------------- DJ (Spotify-connected host) ----------------

def spotify_login_redirect():
    if not spotify.configured():
        return None, (503, {"error": "Spotify credentials are not configured on the server."})
    state = spotify.create_oauth_state()
    return spotify.auth_url(state), None


def spotify_callback(code, state):
    if not spotify.valid_oauth_state(state):
        return None, (400, {"error": "Invalid or expired authorization state."})
    try:
        tokens = spotify.exchange_code(code)
        access = tokens["access_token"]
        refresh = tokens.get("refresh_token", "")
        profile = spotify.me(access)
    except spotify.SpotifyError as exc:
        return None, (502, {"error": f"Spotify connection failed: {exc.message}"})
    dj_key = secrets.token_urlsafe(24)
    with db() as cur:
        cur.execute(
            """
            UPDATE aux_dj
            SET spotify_user_id = %s,
                display_name = %s,
                access_token = %s,
                refresh_token = %s,
                expires_at = %s,
                dj_key = %s,
                oauth_state = NULL
            WHERE id = 1
            """,
            (
                profile["id"],
                profile.get("display_name") or profile["id"],
                spotify.seal(access),
                spotify.seal(refresh),
                time.time() + int(tokens.get("expires_in", 3600)),
                dj_key,
            ),
        )
        bump_version(cur)
    # The browser that completes OAuth becomes the DJ: it receives the key
    # in the redirect, stores it locally, and strips it from the URL.
    return f"{spotify.BASE_URL}/aux?dj={dj_key}", None


def playback(payload):
    key = str(payload.get("djKey", "")).strip()
    action = str(payload.get("action", "")).strip().lower()
    if action not in {"play", "pause", "skip", "previous"}:
        return 400, {"error": "Unknown playback action."}
    with db() as cur:
        if not dj_authorized(cur, key):
            return 403, {"error": "Only the connected DJ can control playback."}
    try:
        token = _dj_access_token()
        if not token:
            return 409, {"error": "Connect Spotify first."}
        if action == "play":
            spotify.play(token)
        elif action == "pause":
            spotify.pause(token)
        elif action == "skip":
            spotify.next_track(token)
        elif action == "previous":
            spotify.previous_track(token)
    except spotify.SpotifyError as exc:
        if exc.status == 404:
            return 409, {"error": "No active Spotify device — open Spotify and press play once, then try again."}
        if exc.status == 403:
            return 409, {"error": "Spotify says this account can't do that (Premium is required for remote control)."}
        return 502, {"error": f"Spotify error: {exc.message}"}
    with db() as cur:
        bump_version(cur)
    return 200, {"ok": True}


def queue_on_spotify(request_id, payload):
    """Connected Spotify host overrides the queue and starts a song."""
    key = str(payload.get("djKey", "")).strip()
    with db() as cur:
        if not dj_authorized(cur, key):
            return 403, {"error": "Only the connected admin can control playback."}
    return admin_play_now(request_id)


def admin_play_now(request_id):
    """Start one request immediately; caller is responsible for authorization."""
    played_at = utcnow()
    with db() as cur:
        cur.execute(
            """
            UPDATE aux_requests
            SET played = TRUE, played_at = %s
            WHERE id = %s AND played = FALSE
            RETURNING *
            """,
            (played_at, request_id),
        )
        row = cur.fetchone()
        if not row:
            return 409, {"error": "That song has already left the queue."}
        bump_version(cur)

    def restore_request():
        with db() as cur:
            cur.execute(
                "UPDATE aux_requests SET played = FALSE, played_at = NULL WHERE id = %s",
                (request_id,),
            )
            bump_version(cur)

    try:
        token = _dj_access_token()
        if not token:
            restore_request()
            return 409, {"error": "Connect Spotify first."}
        if row["queued_to_spotify"]:
            upcoming = spotify.user_queue(token)
            position = next(
                (i for i, song in enumerate(upcoming) if song.get("trackId") == row["track_id"]),
                None,
            )
            current = spotify.currently_playing(token)
            if current and current.get("trackId") == row["track_id"]:
                pass
            elif position is None:
                restore_request()
                return 409, {"error": "That song is already moving through Spotify's queue."}
            else:
                for _ in range(position + 1):
                    spotify.next_track(token)
        else:
            spotify.play_track(token, row["track_id"])
    except spotify.SpotifyError as exc:
        restore_request()
        if exc.status == 404:
            return 409, {"error": "No active Spotify device — open Spotify and press play once."}
        return 502, {"error": f"Spotify error: {exc.message}"}
    with db() as cur:
        cur.execute(
            """
            UPDATE aux_requests
            SET queued_to_spotify = TRUE, queued_at = COALESCE(queued_at, %s)
            WHERE id = %s
            """,
            (played_at, request_id),
        )
        bump_version(cur)
    return 200, {"ok": True, "playingNow": True}


def clear_requests():
    """Clear every song that is still waiting in the request queue."""
    with db() as cur:
        cur.execute("DELETE FROM aux_requests WHERE played = FALSE")
        removed = cur.rowcount
        if removed:
            bump_version(cur)
    return 200, {"ok": True, "removed": removed}


def remove_own_request(request_id, payload):
    guest_id = str(payload.get("guestId", "")).strip()[:80]
    if len(guest_id) < 16:
        return 403, {"error": "This request belongs to another guest."}
    with db() as cur:
        cur.execute(
            """
            DELETE FROM aux_requests
            WHERE id = %s AND guest_id = %s AND played = FALSE
            """,
            (request_id, guest_id),
        )
        if not cur.rowcount:
            return 403, {"error": "You can only remove songs you requested."}
        bump_version(cur)
    return 200, {"ok": True}


def remove_request(request_id, payload):
    key = str(payload.get("djKey", "")).strip()
    with db() as cur:
        if not dj_authorized(cur, key):
            return 403, {"error": "Only the connected DJ can remove songs."}
        cur.execute("DELETE FROM aux_requests WHERE id = %s", (request_id,))
        bump_version(cur)
    return 200, {"ok": True}


def set_title(payload):
    key = str(payload.get("djKey", "")).strip()
    title = str(payload.get("title", "")).strip()[:80]
    if not title:
        return 400, {"error": "Title is required."}
    with db() as cur:
        if not dj_authorized(cur, key):
            return 403, {"error": "Only the connected DJ can rename the queue."}
        cur.execute("UPDATE aux_meta SET title = %s WHERE id = 1", (title,))
        bump_version(cur)
    return 200, {"ok": True, "title": title}


def verify_dj(payload):
    key = str(payload.get("djKey", "")).strip()
    with db() as cur:
        ok = dj_authorized(cur, key)
    return 200, {"ok": True, "isDj": ok}


# ---------------- schema ----------------

def init_tables():
    with db() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS aux_meta (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL DEFAULT 'SSA Live Queue',
                version BIGINT NOT NULL DEFAULT 1
            )
            """
        )
        cur.execute("INSERT INTO aux_meta (id) VALUES (1) ON CONFLICT (id) DO NOTHING")
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS aux_dj (
                id INTEGER PRIMARY KEY,
                spotify_user_id TEXT,
                display_name TEXT,
                access_token TEXT,
                refresh_token TEXT,
                expires_at DOUBLE PRECISION,
                dj_key TEXT,
                oauth_state TEXT
            )
            """
        )
        cur.execute("INSERT INTO aux_dj (id) VALUES (1) ON CONFLICT (id) DO NOTHING")
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS aux_requests (
                id SERIAL PRIMARY KEY,
                track_id TEXT NOT NULL,
                song_name TEXT NOT NULL,
                artist TEXT NOT NULL DEFAULT '',
                album_image TEXT,
                requested_by TEXT NOT NULL,
                played BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute("ALTER TABLE aux_requests ADD COLUMN IF NOT EXISTS queued_to_spotify BOOLEAN NOT NULL DEFAULT FALSE")
        cur.execute("ALTER TABLE aux_requests ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ")
        cur.execute("ALTER TABLE aux_requests ADD COLUMN IF NOT EXISTS played_at TIMESTAMPTZ")
        cur.execute("ALTER TABLE aux_requests ADD COLUMN IF NOT EXISTS guest_id TEXT")
