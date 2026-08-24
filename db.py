import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "app.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
"""

SONGS_SCHEMA = """
CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artist TEXT NOT NULL,
    title TEXT NOT NULL,
    UNIQUE (artist, title)
)
"""

SONG_RATINGS_SCHEMA = """
CREATE TABLE IF NOT EXISTS song_ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    song_id INTEGER NOT NULL REFERENCES songs (id) ON DELETE CASCADE,
    listener_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating IN (1, -1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (song_id, listener_id)
)
"""


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with get_db() as conn:
        conn.execute(SCHEMA)
        conn.execute(SONGS_SCHEMA)
        conn.execute(SONG_RATINGS_SCHEMA)


def get_or_create_song(conn, artist, title):
    """Return the id of the song matching (artist, title), creating it if needed."""
    row = conn.execute(
        "SELECT id FROM songs WHERE artist = ? AND title = ?", (artist, title)
    ).fetchone()
    if row:
        return row["id"]
    cur = conn.execute(
        "INSERT INTO songs (artist, title) VALUES (?, ?)", (artist, title)
    )
    return cur.lastrowid
