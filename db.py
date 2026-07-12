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
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (event_name, email)
            )
            """
        )
        cur.execute("ALTER TABLE rsvp_interest ALTER COLUMN email DROP NOT NULL")
        cur.execute("ALTER TABLE rsvp_interest ADD COLUMN IF NOT EXISTS is_student BOOLEAN NOT NULL DEFAULT FALSE")
        cur.execute("ALTER TABLE rsvp_interest ADD COLUMN IF NOT EXISTS is_over_18 BOOLEAN NOT NULL DEFAULT TRUE")
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
