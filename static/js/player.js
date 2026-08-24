(() => {
  const { STREAM_URL, METADATA_URL, COVER_URL } = JSON.parse(
    document.getElementById('radio-calico-config').textContent
  );

  const audio = document.getElementById('audio');
  const playBtn = document.getElementById('play-btn');
  const playIcon = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');
  const status = document.getElementById('status');
  const elapsedEl = document.getElementById('elapsed');
  const volume = document.getElementById('volume');

  const headerListenBtn = document.getElementById('header-listen-btn');
  const headerPlayIcon = document.getElementById('header-play-icon');
  const headerPauseIcon = document.getElementById('header-pause-icon');
  const headerListenLabel = document.getElementById('header-listen-label');

  let hls = null;
  let started = false;
  let elapsedSeconds = 0;
  let elapsedTimer = null;

  function setStatus(text) {
    status.textContent = text;
  }

  function formatElapsed(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  function startElapsedTimer() {
    if (elapsedTimer) return;
    elapsedTimer = setInterval(() => {
      elapsedSeconds += 1;
      elapsedEl.textContent = formatElapsed(elapsedSeconds);
    }, 1000);
  }

  function stopElapsedTimer() {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
  }

  function resetElapsedTimer() {
    stopElapsedTimer();
    elapsedSeconds = 0;
    elapsedEl.textContent = formatElapsed(0);
  }

  function setPlayingUI(isPlaying) {
    playIcon.classList.toggle('icon-hidden', isPlaying);
    pauseIcon.classList.toggle('icon-hidden', !isPlaying);
    playBtn.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');

    headerPlayIcon.classList.toggle('icon-hidden', isPlaying);
    headerPauseIcon.classList.toggle('icon-hidden', !isPlaying);
    headerListenLabel.textContent = isPlaying ? 'Pause' : 'Listen Now';
  }

  function startStream() {
    if (started) return;
    started = true;
    setStatus('Loading…');

    if (window.Hls && Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(STREAM_URL);
      hls.attachMedia(audio);
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          setStatus('Stream error: ' + data.type);
        }
      });
    } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = STREAM_URL;
    } else {
      setStatus('HLS is not supported in this browser');
      started = false;
      return;
    }
  }

  function togglePlayback() {
    startStream();
    if (audio.paused) {
      audio.play().catch((err) => setStatus('Playback failed: ' + err.message));
    } else {
      audio.pause();
    }
  }

  playBtn.addEventListener('click', togglePlayback);
  headerListenBtn.addEventListener('click', togglePlayback);

  audio.addEventListener('play', () => setPlayingUI(true));
  audio.addEventListener('playing', () => {
    setPlayingUI(true);
    setStatus('Live');
    startElapsedTimer();
  });
  audio.addEventListener('pause', () => {
    setPlayingUI(false);
    stopElapsedTimer();
  });
  audio.addEventListener('waiting', () => setStatus('Buffering…'));
  audio.addEventListener('error', () => {
    setStatus('Playback error');
    resetElapsedTimer();
    started = false;
  });

  volume.addEventListener('input', () => {
    audio.volume = Number(volume.value);
  });
  audio.volume = Number(volume.value);

  const npCover = document.getElementById('np-cover');
  const npTitle = document.getElementById('np-title');
  const npArtist = document.getElementById('np-artist');
  const npMeta = document.getElementById('np-meta');
  const recentList = document.getElementById('recent-list');
  const startedAt = document.getElementById('started-at');
  const startedAtText = document.getElementById('started-at-text');

  function formatClockTime(date) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  const thumbsUpBtn = document.getElementById('thumbs-up-btn');
  const thumbsDownBtn = document.getElementById('thumbs-down-btn');
  const thumbsUpCount = document.getElementById('thumbs-up-count');
  const thumbsDownCount = document.getElementById('thumbs-down-count');
  const ratingStatus = document.getElementById('rating-status');

  let lastTrackKey = null;
  let currentSong = null; // { artist, title }

  function getListenerId() {
    let id = localStorage.getItem('radiocalico_listener_id');
    if (!id) {
      id = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'listener-' + Date.now() + '-' + Math.random().toString(16).slice(2);
      localStorage.setItem('radiocalico_listener_id', id);
    }
    return id;
  }

  const listenerId = getListenerId();

  function renderRating(summary) {
    thumbsUpCount.textContent = summary.thumbs_up;
    thumbsDownCount.textContent = summary.thumbs_down;

    const rated = summary.user_rating !== null && summary.user_rating !== undefined;
    thumbsUpBtn.classList.toggle('active', summary.user_rating === 1);
    thumbsDownBtn.classList.toggle('active', summary.user_rating === -1);
    thumbsUpBtn.setAttribute('aria-pressed', String(summary.user_rating === 1));
    thumbsDownBtn.setAttribute('aria-pressed', String(summary.user_rating === -1));
    thumbsUpBtn.disabled = rated;
    thumbsDownBtn.disabled = rated;

    if (summary.user_rating === 1) {
      ratingStatus.textContent = 'You rated this song 👍 — thanks!';
    } else if (summary.user_rating === -1) {
      ratingStatus.textContent = 'You rated this song 👎 — thanks!';
    } else {
      ratingStatus.textContent = '';
    }
  }

  async function loadRating(song) {
    try {
      const params = new URLSearchParams({
        artist: song.artist,
        title: song.title,
        listener_id: listenerId,
      });
      const res = await fetch('/api/songs/rating?' + params.toString());
      if (!res.ok) return;
      renderRating(await res.json());
    } catch (err) {
      // Ratings are best-effort; leave the UI in its current state on failure.
    }
  }

  async function submitRating(rating) {
    if (!currentSong) return;
    thumbsUpBtn.disabled = true;
    thumbsDownBtn.disabled = true;
    ratingStatus.textContent = 'Submitting…';
    try {
      const res = await fetch('/api/songs/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artist: currentSong.artist,
          title: currentSong.title,
          rating,
          listener_id: listenerId,
        }),
      });
      if (res.ok || res.status === 409) {
        await loadRating(currentSong);
      } else {
        thumbsUpBtn.disabled = false;
        thumbsDownBtn.disabled = false;
        ratingStatus.textContent = 'Could not submit your rating — please try again.';
      }
    } catch (err) {
      thumbsUpBtn.disabled = false;
      thumbsDownBtn.disabled = false;
      ratingStatus.textContent = 'Could not submit your rating — please try again.';
    }
  }

  thumbsUpBtn.addEventListener('click', () => submitRating(1));
  thumbsDownBtn.addEventListener('click', () => submitRating(-1));

  async function pollMetadata() {
    try {
      const res = await fetch(METADATA_URL + '?_=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();

      const trackKey = data.artist + ' - ' + data.title;
      if (trackKey !== lastTrackKey) {
        lastTrackKey = trackKey;
        currentSong = { artist: data.artist || 'Unknown artist', title: data.title || 'Unknown title' };
        renderRating({ thumbs_up: 0, thumbs_down: 0, user_rating: null });
        loadRating(currentSong);
        npTitle.textContent = data.title || 'Unknown title';
        npArtist.textContent = data.artist || 'Unknown artist';
        const parts = [];
        if (data.album) parts.push(data.album);
        if (data.date) parts.push(data.date);
        if (data.bit_depth && data.sample_rate) {
          parts.push(`${data.bit_depth}-bit / ${(data.sample_rate / 1000).toFixed(1)}kHz`);
        }
        npMeta.textContent = parts.join(' · ');

        startedAt.hidden = false;
        startedAtText.textContent = 'Playing since ' + formatClockTime(new Date());

        npCover.hidden = true;
        const coverProbe = new Image();
        coverProbe.onload = () => {
          npCover.src = coverProbe.src;
          npCover.hidden = false;
        };
        coverProbe.src = COVER_URL + '?_=' + Date.now();

        recentList.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
          const artist = data[`prev_artist_${i}`];
          const title = data[`prev_title_${i}`];
          if (!artist && !title) continue;
          const li = document.createElement('li');

          const info = document.createElement('div');
          info.className = 'recent-info';
          const artistSpan = document.createElement('span');
          artistSpan.className = 'recent-artist';
          artistSpan.textContent = artist || 'Unknown artist';
          const titleSpan = document.createElement('span');
          titleSpan.className = 'recent-title';
          titleSpan.textContent = title || 'Unknown title';
          info.append(artistSpan, titleSpan);

          const timeSpan = document.createElement('span');
          timeSpan.className = 'recent-time';
          timeSpan.textContent = i === 1 ? '1 song ago' : `${i} songs ago`;

          li.append(info, timeSpan);
          recentList.appendChild(li);
        }
      }
    } catch (err) {
      // Metadata is best-effort; leave last known values in place on failure.
    }
  }

  pollMetadata();
  setInterval(pollMetadata, 15000);
})();
