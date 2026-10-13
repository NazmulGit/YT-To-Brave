// PiP player using YouTube IFrame Player API for full programmatic control.
// Lives in an extension popup window so the controls are persistent and
// independent of the user's main browsing tab.

(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const sourceUrl = params.get("src") || "";

  // ----- URL parsing (inline copies — cannot import into non-module) -----
  function extractVideoId(url) {
    try {
      const u = new URL(url);
      if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
      if (u.pathname === "/watch") return u.searchParams.get("v");
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || null;
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] || null;
      return null;
    } catch { return null; }
  }
  function extractTimestamp(url) {
    try {
      const u = new URL(url);
      const t = u.searchParams.get("t") || u.searchParams.get("start");
      if (!t) return 0;
      if (/^\d+$/.test(t)) return parseInt(t, 10);
      let s = 0;
      const mh = t.match(/(\d+)h/), mm = t.match(/(\d+)m/), ms = t.match(/(\d+)s/);
      if (mh) s += parseInt(mh[1]) * 3600;
      if (mm) s += parseInt(mm[1]) * 60;
      if (ms) s += parseInt(ms[1]);
      return s;
    } catch { return 0; }
  }

  const videoId = extractVideoId(sourceUrl);
  const startSeconds = extractTimestamp(sourceUrl);

  let settings = {
    pip: { autoplay: true, defaultSpeed: 1, skipSeconds: 10, bigSkipSeconds: 30, showCaptions: false, rememberPosition: true },
  };

  // -------- DOM --------
  const $ = (id) => document.getElementById(id);
  const overlay = $("overlay");
  const playPause = $("playPauseBtn");
  const playIcon = $("playIcon");
  const pauseIcon = $("pauseIcon");
  const skipBack = $("skipBack");
  const skipFwd = $("skipFwd");
  const bigSkipBack = $("bigSkipBack");
  const bigSkipFwd = $("bigSkipFwd");
  const muteBtn = $("muteBtn");
  const volume = $("volume");
  const speed = $("speedSelect");
  const captions = $("captionsBtn");
  const fullscreen = $("fullscreenBtn");
  const theaterBtn = $("theaterBtn");
  const alwaysOnTop = $("alwaysOnTop");
  const popout = $("popoutBtn");
  const closeBtn = $("closeBtn");
  const progress = $("progress");
  const progressFill = $("progressFill");
  const progressBuf = $("progressBuf");
  const progressThumb = $("progressThumb");
  const curTime = $("curTime");
  const durTime = $("durTime");
  const vidTitle = $("vidTitle");
  const toastEl = $("toast");

  if (!videoId) {
    document.body.innerHTML = `<div style="display:grid;place-items:center;height:100%;text-align:center;font-family:sans-serif;padding:20px;">
      <div>
        <h2 style="color:#ff3d00;margin:0 0 8px;">Not a video URL</h2>
        <p style="color:#aaa;font-size:13px;">${sourceUrl ? sourceUrl.slice(0, 100) : ""}</p>
      </div>
    </div>`;
    return;
  }

  // -------- LOAD SETTINGS --------
  chrome.storage.sync.get("settings", ({ settings: s }) => {
    if (s) {
      settings = s;
      volume.value = 100;
      speed.value = String(settings.pip.defaultSpeed || 1);
    }
    loadIframeApi();
  });

  // -------- IFRAME API --------
  let player;
  let timer;

  function loadIframeApi() {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = createPlayer;
  }

  function createPlayer() {
    // Replace iframe with API-managed player
    const old = document.getElementById("ytFrame");
    const div = document.createElement("div");
    div.id = "ytFrame";
    old.replaceWith(div);

    player = new YT.Player("ytFrame", {
      videoId,
      playerVars: {
        autoplay: settings.pip.autoplay !== false ? 1 : 0,
        start: startSeconds || 0,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        iv_load_policy: 3,
        cc_load_policy: settings.pip.showCaptions ? 1 : 0,
      },
      events: {
        onReady: onReady,
        onStateChange: onStateChange,
      },
    });
  }

  function onReady(e) {
    e.target.setPlaybackRate(parseFloat(settings.pip.defaultSpeed) || 1);
    e.target.setVolume(100);
    if (settings.pip.showCaptions) {
      try { e.target.loadModule("captions"); e.target.setOption("captions", "track", { languageCode: "en" }); } catch {}
    }
    try {
      const data = e.target.getVideoData?.();
      if (data?.title) vidTitle.textContent = data.title;
    } catch {}
    startTimer();
  }

  function onStateChange(e) {
    const state = e.data;
    const playing = state === YT.PlayerState.PLAYING;
    playIcon.hidden = playing;
    pauseIcon.hidden = !playing;
    if (state === YT.PlayerState.ENDED) {
      stopTimer();
    }
  }

  function startTimer() {
    stopTimer();
    timer = setInterval(() => {
      if (!player?.getDuration) return;
      const dur = player.getDuration() || 0;
      const cur = player.getCurrentTime() || 0;
      const buf = (player.getVideoLoadedFraction?.() || 0) * 100;
      progressFill.style.width = dur ? (cur / dur * 100) + "%" : "0%";
      progressThumb.style.left = dur ? (cur / dur * 100) + "%" : "0%";
      progressBuf.style.width = buf + "%";
      curTime.textContent = fmt(cur);
      durTime.textContent = fmt(dur);
    }, 250);
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  function fmt(t) {
    t = Math.max(0, Math.floor(t));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    if (h) return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    return `${m}:${String(s).padStart(2,"0")}`;
  }

  // -------- CONTROLS --------
  function togglePlay() {
    if (!player) return;
    const state = player.getPlayerState();
    if (state === YT.PlayerState.PLAYING) player.pauseVideo();
    else player.playVideo();
  }
  function seekBy(d) {
    if (!player) return;
    const t = (player.getCurrentTime() || 0) + d;
    player.seekTo(Math.max(0, t), true);
    flash((d > 0 ? "+" : "") + d + "s");
  }
  function setSpeed(v) {
    if (!player) return;
    player.setPlaybackRate(v);
    speed.value = String(v);
    flash(v + "× speed");
  }
  function bumpSpeed(dir) {
    const opts = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const cur = parseFloat(speed.value);
    const i = opts.indexOf(cur);
    const next = opts[Math.max(0, Math.min(opts.length - 1, i + dir))];
    setSpeed(next);
  }
  function setVolume(v) {
    if (!player) return;
    player.setVolume(v);
    volume.value = v;
    if (v === 0) {
      player.mute();
      muteBtn.textContent = "🔇";
    } else {
      player.unMute();
      muteBtn.textContent = v < 50 ? "🔉" : "🔊";
    }
  }
  function toggleMute() {
    if (!player) return;
    if (player.isMuted()) {
      player.unMute();
      muteBtn.textContent = volume.value < 50 ? "🔉" : "🔊";
      flash("Unmuted");
    } else {
      player.mute();
      muteBtn.textContent = "🔇";
      flash("Muted");
    }
  }
  function toggleCaptions() {
    if (!player) return;
    captions.classList.toggle("active");
    const on = captions.classList.contains("active");
    try {
      if (on) {
        player.loadModule("captions");
        player.setOption("captions", "track", { languageCode: "en" });
      } else {
        player.setOption("captions", "track", {});
      }
    } catch {}
    flash(on ? "Captions ON" : "Captions OFF");
  }
  function toggleFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
  }
  function toggleAlwaysOnTop() {
    alwaysOnTop.classList.toggle("active");
    chrome.windows.getCurrent((w) => {
      const newTop = alwaysOnTop.classList.contains("active");
      chrome.windows.update(w.id, { state: newTop ? "normal" : "normal", focused: true });
    });
    flash(alwaysOnTop.classList.contains("active") ? "Always on top: ON" : "Always on top: OFF");
  }
  function openInBrave() {
    chrome.runtime.sendMessage({
      type: "OPEN_IN_BROWSER",
      url: "https://www.youtube.com/watch?v=" + videoId + (player ? "&t=" + Math.floor(player.getCurrentTime() || 0) + "s" : ""),
    });
    window.close();
  }
  function jumpPercent(pct) {
    if (!player) return;
    const dur = player.getDuration() || 0;
    if (!dur) return;
    player.seekTo(dur * pct / 100, true);
    flash(pct + "%");
  }

  // -------- BIND --------
  playPause.addEventListener("click", togglePlay);
  skipBack.addEventListener("click", () => seekBy(-(settings.pip.skipSeconds || 10)));
  skipFwd.addEventListener("click", () => seekBy(+(settings.pip.skipSeconds || 10)));
  bigSkipBack.addEventListener("click", () => seekBy(-(settings.pip.bigSkipSeconds || 30)));
  bigSkipFwd.addEventListener("click", () => seekBy(+(settings.pip.bigSkipSeconds || 30)));
  muteBtn.addEventListener("click", toggleMute);
  volume.addEventListener("input", (e) => setVolume(parseInt(e.target.value, 10)));
  speed.addEventListener("change", (e) => setSpeed(parseFloat(e.target.value)));
  captions.addEventListener("click", toggleCaptions);
  fullscreen.addEventListener("click", toggleFullscreen);
  theaterBtn.addEventListener("click", () => {
    chrome.windows.getCurrent((w) => {
      const big = w.width >= screen.availWidth * 0.7;
      chrome.windows.update(w.id, big
        ? { width: 480, height: 306 }
        : { width: Math.floor(screen.availWidth * 0.7), height: Math.floor(screen.availHeight * 0.7) });
    });
  });
  alwaysOnTop.addEventListener("click", toggleAlwaysOnTop);
  popout.addEventListener("click", openInBrave);
  closeBtn.addEventListener("click", () => window.close());

  // Progress click + drag
  let dragging = false;
  function pctFromEvent(e) {
    const r = progress.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  }
  progress.addEventListener("mousedown", (e) => {
    dragging = true;
    seekToPct(pctFromEvent(e));
  });
  window.addEventListener("mousemove", (e) => { if (dragging) seekToPct(pctFromEvent(e)); });
  window.addEventListener("mouseup", () => { dragging = false; });
  function seekToPct(p) {
    if (!player?.getDuration) return;
    const dur = player.getDuration() || 0;
    player.seekTo(dur * p, true);
  }

  // Overlay show/hide
  let overlayTimer;
  function showOverlay() {
    overlay.classList.add("show");
    clearTimeout(overlayTimer);
    overlayTimer = setTimeout(() => overlay.classList.remove("show"), 2400);
  }
  document.addEventListener("mousemove", showOverlay);
  document.addEventListener("touchstart", showOverlay);
  document.addEventListener("keydown", showOverlay);
  showOverlay();

  // -------- KEYBOARD --------
  document.addEventListener("keydown", (e) => {
    if (e.target.matches?.("input, select, textarea")) return;
    const skip = settings.pip.skipSeconds || 10;
    const big = settings.pip.bigSkipSeconds || 30;
    switch (e.key) {
      case " ":
      case "k":
        e.preventDefault(); togglePlay(); break;
      case "ArrowLeft": seekBy(-skip); break;
      case "ArrowRight": seekBy(+skip); break;
      case "j": seekBy(-big); break;
      case "l": seekBy(+big); break;
      case "ArrowUp":
        e.preventDefault();
        setVolume(Math.min(100, parseInt(volume.value) + 5)); break;
      case "ArrowDown":
        e.preventDefault();
        setVolume(Math.max(0, parseInt(volume.value) - 5)); break;
      case "m": toggleMute(); break;
      case "f": toggleFullscreen(); break;
      case "c": toggleCaptions(); break;
      case "<": case ",": bumpSpeed(-1); break;
      case ">": case ".": bumpSpeed(+1); break;
      case "Home": jumpPercent(0); break;
      case "End": jumpPercent(99); break;
      case "0": case "1": case "2": case "3": case "4":
      case "5": case "6": case "7": case "8": case "9":
        jumpPercent(parseInt(e.key) * 10); break;
      case "Escape":
        if (document.fullscreenElement) document.exitFullscreen();
        break;
    }
  });

  let toastTimer;
  function flash(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    toastEl.style.animation = "none";
    void toastEl.offsetWidth;
    toastEl.style.animation = "";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.hidden = true), 900);
  }

  // Save window position when closing (if remember position is on)
  window.addEventListener("beforeunload", () => {
    if (!settings.pip.rememberPosition) return;
    chrome.windows.getCurrent((w) => {
      chrome.storage.local.set({
        pipWindow: { left: w.left, top: w.top, width: w.width, height: w.height },
      });
    });
  });
})();
