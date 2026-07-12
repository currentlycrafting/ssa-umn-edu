"""Spotify Web API helpers — server-side only.

The client secret and all tokens live on the server. Tokens are stored
obfuscated with a keystream cipher derived from SECRET_KEY.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request

CLIENT_ID = os.environ.get("SPOTIFY_CLIENT_ID", "").strip()
CLIENT_SECRET = os.environ.get("SPOTIFY_CLIENT_SECRET", "").strip()
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:5600").rstrip("/")
# This exact path is registered in the Spotify dashboard (prod + local).
REDIRECT_URI = BASE_URL + "/api/rz/spotify/callback"
SECRET_KEY = (os.environ.get("SECRET_KEY") or os.environ.get("ADMIN_PASSWORD") or "ssa-aux").encode()

SCOPES = " ".join([
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "playlist-modify-private",
    "playlist-modify-public",
])

_app_token = {"token": None, "expires": 0.0}


def configured():
    return bool(CLIENT_ID and CLIENT_SECRET)


def create_oauth_state():
    timestamp = str(int(time.time()))
    nonce = secrets.token_urlsafe(12)
    payload = f"aux.{timestamp}.{nonce}"
    signature = hmac.new(SECRET_KEY, payload.encode(), hashlib.sha256).digest()[:18]
    encoded = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    return f"{payload}.{encoded}"


def valid_oauth_state(state, max_age=600):
    try:
        prefix, timestamp, nonce, supplied = str(state or "").split(".", 3)
        issued_at = int(timestamp)
    except (TypeError, ValueError):
        return False
    if prefix != "aux" or not nonce:
        return False
    age = int(time.time()) - issued_at
    if age < -60 or age > max_age:
        return False
    payload = f"{prefix}.{timestamp}.{nonce}"
    signature = hmac.new(SECRET_KEY, payload.encode(), hashlib.sha256).digest()[:18]
    expected = base64.urlsafe_b64encode(signature).decode().rstrip("=")
    return hmac.compare_digest(expected, supplied)


# ---------- token obfuscation at rest ----------

def _keystream(key, n):
    out = b""
    counter = 0
    while len(out) < n:
        out += hashlib.sha256(key + counter.to_bytes(4, "big")).digest()
        counter += 1
    return out[:n]


def seal(text):
    if not text:
        return ""
    nonce = os.urandom(8)
    data = text.encode()
    ks = _keystream(SECRET_KEY + nonce, len(data))
    return base64.b64encode(nonce + bytes(a ^ b for a, b in zip(data, ks))).decode()


def unseal(blob):
    if not blob:
        return ""
    raw = base64.b64decode(blob)
    nonce, data = raw[:8], raw[8:]
    ks = _keystream(SECRET_KEY + nonce, len(data))
    return bytes(a ^ b for a, b in zip(data, ks)).decode()


# ---------- HTTP ----------

class SpotifyError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def _request(method, url, headers=None, body=None, form=False):
    data = None
    hdrs = dict(headers or {})
    if body is not None:
        if form:
            data = urllib.parse.urlencode(body).encode()
            hdrs["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            data = json.dumps(body).encode()
            hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            raw = resp.read()
            return json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            payload = json.loads(exc.read() or b"{}")
            detail = payload.get("error", {}).get("message") or payload.get("error_description") or ""
        except Exception:
            pass
        raise SpotifyError(exc.code, detail or f"Spotify error {exc.code}")
    except urllib.error.URLError as exc:
        raise SpotifyError(503, f"Spotify unreachable: {exc.reason}")


def _basic_auth():
    creds = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    return {"Authorization": f"Basic {creds}"}


# ---------- OAuth ----------

def auth_url(state):
    params = urllib.parse.urlencode({
        "response_type": "code",
        "client_id": CLIENT_ID,
        "scope": SCOPES,
        "redirect_uri": REDIRECT_URI,
        "state": state,
        "show_dialog": "false",
    })
    return "https://accounts.spotify.com/authorize?" + params


def exchange_code(code):
    return _request(
        "POST", "https://accounts.spotify.com/api/token", headers=_basic_auth(),
        body={"grant_type": "authorization_code", "code": code, "redirect_uri": REDIRECT_URI},
        form=True,
    )


def refresh_access_token(refresh_token):
    return _request(
        "POST", "https://accounts.spotify.com/api/token", headers=_basic_auth(),
        body={"grant_type": "refresh_token", "refresh_token": refresh_token},
        form=True,
    )


def app_token():
    """Client-credentials token — lets guests search without any user login."""
    now = time.monotonic()
    if _app_token["token"] and now < _app_token["expires"] - 30:
        return _app_token["token"]
    data = _request(
        "POST", "https://accounts.spotify.com/api/token", headers=_basic_auth(),
        body={"grant_type": "client_credentials"}, form=True,
    )
    _app_token["token"] = data["access_token"]
    _app_token["expires"] = now + int(data.get("expires_in", 3600))
    return _app_token["token"]


# ---------- Web API ----------

def api(token, method, path, body=None):
    return _request(
        method, "https://api.spotify.com/v1" + path,
        headers={"Authorization": f"Bearer {token}"}, body=body,
    )


def me(token):
    return api(token, "GET", "/me")


def search_tracks(token, query, limit=8):
    qs = urllib.parse.urlencode({"q": query, "type": "track", "limit": limit})
    data = api(token, "GET", f"/search?{qs}")
    items = (data.get("tracks") or {}).get("items") or []
    out = []
    for t in items:
        images = ((t.get("album") or {}).get("images") or [])
        out.append({
            "trackId": t.get("id"),
            "songName": t.get("name"),
            "artist": ", ".join(a.get("name", "") for a in (t.get("artists") or [])),
            "albumImage": images[1]["url"] if len(images) > 1 else (images[0]["url"] if images else ""),
        })
    return out


def currently_playing(token):
    try:
        data = api(token, "GET", "/me/player/currently-playing")
    except SpotifyError as exc:
        if exc.status in (204, 404):
            return None
        raise
    if not data or not data.get("item"):
        return None
    item = data["item"]
    images = ((item.get("album") or {}).get("images") or [])
    return {
        "trackId": item.get("id"),
        "songName": item.get("name"),
        "artist": ", ".join(a.get("name", "") for a in (item.get("artists") or [])),
        "albumImage": images[1]["url"] if len(images) > 1 else (images[0]["url"] if images else ""),
        "isPlaying": bool(data.get("is_playing")),
        "progressMs": data.get("progress_ms", 0),
        "durationMs": item.get("duration_ms", 0),
    }


def user_queue(token):
    """Return Spotify's upcoming queue for the connected account."""
    data = api(token, "GET", "/me/player/queue") or {}
    items = data.get("queue") or []
    result = []
    for item in items[:40]:
        if not item or item.get("type") != "track":
            continue
        images = ((item.get("album") or {}).get("images") or [])
        result.append({
            "trackId": item.get("id"),
            "songName": item.get("name"),
            "artist": ", ".join(a.get("name", "") for a in (item.get("artists") or [])),
            "albumImage": images[1]["url"] if len(images) > 1 else (images[0]["url"] if images else ""),
        })
    return result


def play(token):
    return api(token, "PUT", "/me/player/play", {})


def play_track(token, track_id):
    return api(token, "PUT", "/me/player/play", {"uris": [f"spotify:track:{track_id}"]})


def pause(token):
    return api(token, "PUT", "/me/player/pause", {})


def next_track(token):
    return api(token, "POST", "/me/player/next", {})


def previous_track(token):
    return api(token, "POST", "/me/player/previous", {})


def queue_track(token, track_id):
    qs = urllib.parse.urlencode({"uri": f"spotify:track:{track_id}"})
    return api(token, "POST", f"/me/player/queue?{qs}", {})
