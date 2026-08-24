# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Run everything through the project virtualenv (Windows paths shown; this repo has no git yet — `Is a git repository: false`):

```
venv\Scripts\python.exe app.py        # run the dev server (Flask debug mode, port 3000)
venv\Scripts\pip.exe install -r requirements.txt   # install/sync dependencies
```

There is no test suite, linter, or build step configured in this repo.

## File Structure

```
radiocalico/
├── app.py                  # Flask app, routes, init_db() call
├── db.py                   # SQLite connection + schema (get_db, init_db)
├── requirements.txt
├── data/
│   └── app.db               # SQLite DB file (WAL mode)
├── templates/
│   ├── player.html          # "/" and "/player" — the live radio player
│   └── index.html           # "/prototype" — throwaway CRUD scaffold
└── static/
    ├── theme.css             # shared design tokens
    ├── player.css            # player-page styles
    ├── style.css             # prototype-page styles
    ├── img/
    │   └── logo.png
    └── js/
        ├── player.js         # player.html logic (HLS playback, metadata polling, ratings)
        └── prototype.js      # index.html logic (/api/items CRUD)
```

## Architecture

Flask + SQLite app with two independent surfaces sharing one Flask instance (`app.py`):

- **`/` and `/player`** — the real product: a live HLS radio player (`templates/player.html`). All logic (HLS.js playback, elapsed-time clock, metadata polling, song rating UI) lives in `static/js/player.js` — there is no JS build step, it's a plain script tag. The template passes server-side config (`stream_url`, `metadata_url`, `cover_url`) to it via a `<script type="application/json" id="radio-calico-config">` tag rendered with Jinja's `tojson`, which `player.js` reads with `JSON.parse` on load — this avoids mixing Jinja `{{ }}` syntax directly inside a `<script>` JS block (which trips JS-aware linters/editors). The player polls a third-party `METADATA_URL` (CloudFront JSON) every 15s to detect track changes, and uses a client-generated UUID stored in `localStorage` (`radiocalico_listener_id`) to identify a listener for rating persistence — there is no user auth.
- **`/prototype`** — a throwaway CRUD scaffold (`templates/index.html` + the `/api/items` routes) unrelated to the radio player. Its JS lives in `static/js/prototype.js`. Treat it as scaffolding, not a pattern to extend.

**Data layer (`db.py`)**: a single SQLite file at `data/app.db`, opened per-request via `get_db()` (WAL mode, foreign keys on, `sqlite3.Row` factory). `init_db()` runs `CREATE TABLE IF NOT EXISTS` for all tables at import time in `app.py` — there is no migration framework, so schema changes are additive edits to the `SCHEMA`/`SONGS_SCHEMA`/`SONG_RATINGS_SCHEMA` strings in `db.py`.

Song rating model: `songs (artist, title)` is upserted via `get_or_create_song()`, and `song_ratings` enforces one rating per `(song_id, listener_id)` via a UNIQUE constraint — a duplicate vote returns HTTP 409 rather than overwriting the existing rating (see `rate_song` in `app.py`).

**External dependencies**: the live stream, metadata JSON, and cover art all come from a fixed CloudFront origin (`d3d4yli4hf5bmh.cloudfront.net`, hardcoded in `app.py`); the player has no fallback if that origin is unreachable.

## Styling

`static/theme.css` defines the shared design tokens (colors, type) per `RadioCalico_Style_Guide.txt`; `player.css` and `style.css` are page-specific styles layered on top for the player and prototype pages respectively. Key brand tokens: Forest Green `#1F4E23` (primary/headings), Teal `#38A29D` (accents/hover), Mint `#D8F2D5`, Calico Orange `#EFA63C` (CTA accents), Charcoal `#231F20` (body text). Fonts are Montserrat (headings) / Open Sans (body).
