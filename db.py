import os
from contextlib import contextmanager

import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
_pool = None


def database_ready():
    return bool(DATABASE_URL)


def get_pool():
    global _pool
    if _pool is None:
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL is not set")
        _pool = pool.ThreadedConnectionPool(
            minconn=1,
            maxconn=6,
            dsn=DATABASE_URL,
            cursor_factory=RealDictCursor,
        )
    return _pool


def warm_pool():
    with db() as cur:
        cur.execute("SELECT 1")


@contextmanager
def db():
    conn = get_pool().getconn()
    try:
        with conn.cursor() as cur:
            yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        get_pool().putconn(conn)


def init_db():
    if not database_ready():
        raise RuntimeError("DATABASE_URL is required (PostgreSQL).")
    with db() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS newsletter_subscribers (
                id SERIAL PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS rsvp_interest (
                id SERIAL PRIMARY KEY,
                event_name TEXT NOT NULL,
                event_date TEXT NOT NULL,
                name TEXT NOT NULL,
                email TEXT,
                is_student BOOLEAN NOT NULL DEFAULT FALSE,
                is_over_18 BOOLEAN NOT NULL DEFAULT TRUE,
                guest_token TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (event_name, email)
            )
            """
        )
        cur.execute("ALTER TABLE rsvp_interest ALTER COLUMN email DROP NOT NULL")
        cur.execute("ALTER TABLE rsvp_interest ADD COLUMN IF NOT EXISTS is_student BOOLEAN NOT NULL DEFAULT FALSE")
        cur.execute("ALTER TABLE rsvp_interest ADD COLUMN IF NOT EXISTS is_over_18 BOOLEAN NOT NULL DEFAULT TRUE")
        cur.execute("ALTER TABLE rsvp_interest ADD COLUMN IF NOT EXISTS guest_token TEXT")
        cur.execute("ALTER TABLE rsvp_interest ADD COLUMN IF NOT EXISTS party_size INTEGER NOT NULL DEFAULT 1")
        cur.execute("ALTER TABLE rsvp_interest ADD COLUMN IF NOT EXISTS phone TEXT")
        cur.execute("ALTER TABLE rsvp_interest ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT FALSE")
        cur.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_rsvp_event_guest
            ON rsvp_interest (event_name, guest_token)
            WHERE guest_token IS NOT NULL
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS game_scores (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                mistakes INTEGER NOT NULL,
                seconds INTEGER NOT NULL,
                solved BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_game_scores_leaderboard
            ON game_scores (solved, mistakes, seconds, created_at)
            WHERE solved = TRUE
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS connect_interest (
                id SERIAL PRIMARY KEY,
                reason TEXT NOT NULL,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                organization TEXT,
                details TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS intern_applications (
                id SERIAL PRIMARY KEY,
                email TEXT NOT NULL DEFAULT '',
                name TEXT NOT NULL DEFAULT '',
                year TEXT NOT NULL DEFAULT '',
                preferred_area TEXT NOT NULL DEFAULT '',
                interest_why TEXT NOT NULL DEFAULT '',
                contribution TEXT NOT NULL DEFAULT '',
                goals TEXT NOT NULL DEFAULT '',
                stay_on TEXT NOT NULL DEFAULT '',
                questions TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        # Upgrade any earlier/partial table shapes before creating indexes.
        cur.execute("ALTER TABLE intern_applications ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT ''")
        cur.execute("ALTER TABLE intern_applications ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT ''")
        cur.execute("ALTER TABLE intern_applications ADD COLUMN IF NOT EXISTS year TEXT NOT NULL DEFAULT ''")
        cur.execute("ALTER TABLE intern_applications ADD COLUMN IF NOT EXISTS preferred_area TEXT NOT NULL DEFAULT ''")
        cur.execute("ALTER TABLE intern_applications ADD COLUMN IF NOT EXISTS interest_why TEXT NOT NULL DEFAULT ''")
        cur.execute("ALTER TABLE intern_applications ADD COLUMN IF NOT EXISTS contribution TEXT NOT NULL DEFAULT ''")
        cur.execute("ALTER TABLE intern_applications ADD COLUMN IF NOT EXISTS goals TEXT NOT NULL DEFAULT ''")
        cur.execute("ALTER TABLE intern_applications ADD COLUMN IF NOT EXISTS stay_on TEXT NOT NULL DEFAULT ''")
        cur.execute("ALTER TABLE intern_applications ADD COLUMN IF NOT EXISTS questions TEXT")
        cur.execute("ALTER TABLE intern_applications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()")
        # Older form shapes left extra NOT NULL columns (major, role, etc.). Relax them.
        required_cols = {
            "id",
            "email",
            "name",
            "year",
            "preferred_area",
            "interest_why",
            "contribution",
            "goals",
            "stay_on",
            "questions",
            "created_at",
        }
        cur.execute(
            """
            SELECT column_name, data_type, udt_name
            FROM information_schema.columns
            WHERE table_name = 'intern_applications'
              AND is_nullable = 'NO'
              AND column_default IS NULL
            """
        )
        for row in cur.fetchall():
            col = row["column_name"]
            if col in required_cols:
                continue
            cur.execute(
                f"ALTER TABLE intern_applications ALTER COLUMN {col} DROP NOT NULL"
            )
            if row["udt_name"] in ("json", "jsonb") or row["data_type"] in ("json", "jsonb"):
                cur.execute(
                    f"ALTER TABLE intern_applications ALTER COLUMN {col} SET DEFAULT '{{}}'"
                )
            elif row["data_type"] in ("ARRAY", "USER-DEFINED") or str(row["udt_name"]).startswith("_"):
                continue
            else:
                cur.execute(
                    f"ALTER TABLE intern_applications ALTER COLUMN {col} SET DEFAULT ''"
                )
        cur.execute(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS idx_intern_applications_email
            ON intern_applications (LOWER(email))
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_intern_applications_area
            ON intern_applications (preferred_area)
            """
        )
