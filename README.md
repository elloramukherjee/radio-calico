# RadioCalico

A live internet radio player built with Flask. Streams HLS audio, shows real-time now-playing metadata and cover art, and lets listeners thumbs-up / thumbs-down the current track.

## Features

- **Live HLS playback** via [hls.js](https://github.com/video-dev/hls.js/), with an elapsed-time clock
- **Now-playing metadata** polled every 15 seconds from a CloudFront JSON endpoint (artist, title, cover art)
- **Song ratings** — thumbs up/down per track, one vote per listener (tracked via a `localStorage` UUID, no login required)
- No JS build step — plain `<script>` tags, server config passed into the page via a JSON `<script>` tag

## Tech stack

- **Backend**: Flask (Python), SQLite (WAL mode)
- **Frontend**: vanilla HTML/CSS/JS, [hls.js](https://github.com/video-dev/hls.js/) for stream playback
- **Data**: `songs` and `song_ratings` tables, upserted/queried per request — no ORM, no migration framework

## Getting started

### Prerequisites

- Python 3.10+

### Setup

```bash
python -m venv venv

# Windows
venv\Scripts\pip.exe install -r requirements.txt
venv\Scripts\python.exe app.py

# macOS/Linux
venv/bin/pip install -r requirements.txt
venv/bin/python app.py
```

The app runs in debug mode on **http://localhost:3000**.

## Project structure

```
radiocalico/
├── app.py                  # Flask app, routes, init_db() call
├── db.py                   # SQLite connection + schema (get_db, init_db)
├── requirements.txt
├── data/
│   └── app.db               # SQLite DB file (created on first run, WAL mode)
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

## Routes

| Route | Method | Description |
|---|---|---|
| `/`, `/player` | GET | The live radio player page |
| `/prototype` | GET | Throwaway CRUD scaffold page (not part of the radio product) |
| `/api/items` | GET, POST | CRUD backing the `/prototype` page |
| `/api/items/<id>` | DELETE | Delete an item |
| `/api/songs/rating` | GET | Get thumbs up/down totals + the current listener's vote for a track |
| `/api/songs/rate` | POST | Submit a thumbs up (`1`) or thumbs down (`-1`) for a track; 409 if already rated |

## Architecture notes

- Two independent surfaces share one Flask instance: the real product (`/`, `/player`) and a throwaway CRUD prototype (`/prototype`). Treat the prototype as scaffolding, not a pattern to extend.
- `player.html` passes server-side config (stream URL, metadata URL, cover URL) into `player.js` via a `<script type="application/json">` tag rendered with Jinja's `tojson`, read client-side with `JSON.parse` — this avoids mixing Jinja syntax inside JS.
- `db.py` runs `CREATE TABLE IF NOT EXISTS` at import time; there's no migration framework, so schema changes are additive edits to the schema strings in `db.py`.
- A listener is identified by a client-generated UUID stored in `localStorage` (`radiocalico_listener_id`) — there is no user authentication.
- The live stream, metadata, and cover art come from a fixed CloudFront origin, hardcoded in `app.py`; there's no fallback if that origin is unreachable.

## Styling

Design tokens live in `static/theme.css`, following the RadioCalico style guide. Key brand colors:

| Token | Hex | Usage |
|---|---|---|
| Forest Green | `#1F4E23` | Primary / headings |
| Teal | `#38A29D` | Accents / hover |
| Mint | `#D8F2D5` | Backgrounds |
| Calico Orange | `#EFA63C` | CTA accents |
| Charcoal | `#231F20` | Body text |

Fonts: Montserrat (headings), Open Sans (body).

## License

No license specified yet.
