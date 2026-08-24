import sqlite3
from datetime import datetime, timezone

from flask import Flask, jsonify, request, render_template

from db import get_db, get_or_create_song, init_db

app = Flask(__name__)
init_db()

HLS_STREAM_URL = "https://d3d4yli4hf5bmh.cloudfront.net/hls/live.m3u8"
METADATA_URL = "https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json"
COVER_URL = "https://d3d4yli4hf5bmh.cloudfront.net/cover.jpg"


@app.get("/")
@app.get("/player")
def player():
    return render_template(
        "player.html",
        stream_url=HLS_STREAM_URL,
        metadata_url=METADATA_URL,
        cover_url=COVER_URL,
        current_year=datetime.now(timezone.utc).year,
    )


@app.get("/prototype")
def prototype():
    return render_template("index.html")


@app.get("/api/items")
def list_items():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM items ORDER BY id DESC").fetchall()
    return jsonify([dict(row) for row in rows])


@app.post("/api/items")
def create_item():
    data = request.get_json(silent=True) or {}
    name = data.get("name")
    if not name or not isinstance(name, str):
        return jsonify({"error": "name is required"}), 400

    with get_db() as conn:
        cur = conn.execute("INSERT INTO items (name) VALUES (?)", (name,))
        row = conn.execute("SELECT * FROM items WHERE id = ?", (cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201


@app.delete("/api/items/<int:item_id>")
def delete_item(item_id):
    with get_db() as conn:
        conn.execute("DELETE FROM items WHERE id = ?", (item_id,))
    return "", 204


def _song_ratings_summary(conn, song_id, listener_id):
    row = conn.execute(
        """
        SELECT
            COALESCE(SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END), 0) AS thumbs_up,
            COALESCE(SUM(CASE WHEN rating = -1 THEN 1 ELSE 0 END), 0) AS thumbs_down
        FROM song_ratings
        WHERE song_id = ?
        """,
        (song_id,),
    ).fetchone()

    user_rating = None
    if listener_id:
        existing = conn.execute(
            "SELECT rating FROM song_ratings WHERE song_id = ? AND listener_id = ?",
            (song_id, listener_id),
        ).fetchone()
        if existing:
            user_rating = existing["rating"]

    return {
        "thumbs_up": row["thumbs_up"],
        "thumbs_down": row["thumbs_down"],
        "user_rating": user_rating,
    }


@app.get("/api/songs/rating")
def get_song_rating():
    artist = (request.args.get("artist") or "").strip()
    title = (request.args.get("title") or "").strip()
    listener_id = (request.args.get("listener_id") or "").strip()

    if not artist or not title:
        return jsonify({"error": "artist and title are required"}), 400

    with get_db() as conn:
        song_row = conn.execute(
            "SELECT id FROM songs WHERE artist = ? AND title = ?", (artist, title)
        ).fetchone()
        if not song_row:
            return jsonify({"thumbs_up": 0, "thumbs_down": 0, "user_rating": None})
        summary = _song_ratings_summary(conn, song_row["id"], listener_id)

    return jsonify(summary)


@app.post("/api/songs/rate")
def rate_song():
    data = request.get_json(silent=True) or {}
    artist = (data.get("artist") or "").strip()
    title = (data.get("title") or "").strip()
    listener_id = (data.get("listener_id") or "").strip()
    rating = data.get("rating")

    if not artist or not title:
        return jsonify({"error": "artist and title are required"}), 400
    if not listener_id:
        return jsonify({"error": "listener_id is required"}), 400
    if rating not in (1, -1):
        return jsonify({"error": "rating must be 1 (thumbs up) or -1 (thumbs down)"}), 400

    with get_db() as conn:
        song_id = get_or_create_song(conn, artist, title)
        try:
            conn.execute(
                "INSERT INTO song_ratings (song_id, listener_id, rating) VALUES (?, ?, ?)",
                (song_id, listener_id, rating),
            )
        except sqlite3.IntegrityError:
            return jsonify({"error": "you have already rated this song"}), 409
        summary = _song_ratings_summary(conn, song_id, listener_id)

    return jsonify(summary), 201


if __name__ == "__main__":
    app.run(debug=True, port=3000)
