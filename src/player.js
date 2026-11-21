import { streamUrl } from "./tg.js";
import { attach } from "./mkv.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const fmt = (s) => {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return (h ? h + ":" + pad(m) : m) + ":" + pad(s % 60);
};
const secs = (s) => {
  const p = s.trim().replace(",", ".").split(":").map(parseFloat);
  return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
};

const ic = (d) => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;
const IC = {
  back: ic("M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"),
  play: ic("M8 5v14l11-7z"),
  pause: ic("M6 19h4V5H6v14zm8-14v14h4V5h-4z"),
  pip: ic("M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"),
  rotate: ic("M16.48 2.52c3.27 1.55 5.61 4.72 5.97 8.48h1.5C23.44 4.84 18.29 0 12 0l-.66.03 3.81 3.81 1.33-1.32zm-6.25-.77c-.59-.59-1.54-.59-2.12 0L1.75 8.11c-.59.59-.59 1.54 0 2.12l12.02 12.02c.59.59 1.54.59 2.12 0l6.36-6.36c.59-.59.59-1.54 0-2.12L10.23 1.75zm4.6 19.44L2.81 9.17l6.36-6.36 12.02 12.02-6.36 6.36zm-7.31.29C4.25 19.94 1.91 16.76 1.55 13H.05C.56 19.16 5.71 24 12 24l.66-.03-3.81-3.81-1.33 1.32z"),
  tune: ic("M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"),
  subs: ic("M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z"),
  audio: ic("M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"),
  speed: ic("M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z"),
  aspect: ic("M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z"),
  more: ic("M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z")
};
const skipIcon = (n, fwd) => `<svg class="skip" viewBox="0 0 24 24"><path d="${fwd ? "M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6" : "M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6"}"/><text x="12" y="16" text-anchor="middle" font-size="7.5" font-weight="700">${n}</text></svg>`;

function parseSubs(text) {
  return text.replace(/\r/g, "").split(/\n\n+/).map((b) => {
    const l = b.split("\n");
    const i = l.findIndex((x) => x.includes("-->"));
    if (i < 0) return null;
    const [a, c] = l[i].split("-->");
    return { s: secs(a), e: secs(c.trim().split(" ")[0]), t: l.slice(i + 1).join("\n").replace(/<[^>]+>/g, "") };
  }).filter(Boolean);
}

export function play({ m, label, settings, pos, save, view, back, onSeen, onWatch, next, title, poster }) {
  const risky = /\.(avi|wmv|flv|ts|mpg|mpeg|3gp)$/i.test(m.name);
  const isMkv = /\.mkv$/i.test(m.name);
  view(`<div class="player" id="pl">
    <video id="v" playsinline autoplay preload="auto"></video>
    <div id="sub" class="sub"></div>
    <div id="dim" class="pdim"></div>
    <div id="gest" class="gest"></div>
    <p id="msg" class="pmsg">${risky ? "This format may not play in your browser." : ""}</p>
    <p id="pipnote" class="pipnote">Playing in picture in picture</p>
    <div class="pui">
      <div class="ptop">
        <button id="back" class="pib" aria-label="Back">${IC.back}</button>
        <span class="ptitle">${label}</span>
        <button id="pip" class="pib" aria-label="Picture in picture">${IC.pip}</button>
        <button id="rt" class="pib" aria-label="Rotate">${IC.rotate}</button>
        <button id="mn" class="pib" aria-label="More">${IC.tune}</button>
      </div>
      <div class="pmid">
        <button id="rw" class="big" aria-label="Back ${settings.skip} seconds">${skipIcon(settings.skip, false)}</button>
        <button id="pp" class="big main" aria-label="Play or pause">${IC.pause}</button>
        <button id="fw" class="big" aria-label="Forward ${settings.skip} seconds">${skipIcon(settings.skip, true)}</button>
      </div>
      <div class="pbot">
        <div class="pseek"><span id="cur">0:00</span><input id="seek" type="range" min="0" max="1000" value="0"><span id="dur">0:00</span></div>
        <div class="pbtns">
          <button class="pbtn" data-s="sec-sub">${IC.subs}<span>Subtitles</span></button>
          <button class="pbtn" data-s="sec-sound">${IC.audio}<span>Audio</span></button>
          <button class="pbtn" data-s="sec-play">${IC.speed}<span id="spl">${settings.speed}x</span></button>
          <button class="pbtn" id="ft">${IC.aspect}<span id="ftl">Fit</span></button>
          <button class="pbtn" data-s="top">${IC.more}<span>More</span></button>
        </div>
      </div>
    </div>
    <div id="menu" class="pmenu hidden">
      <div class="mh"><b>Player settings</b><button id="mc" class="mdone">Done</button></div>
      <div class="ms" id="sec-play"><h4>Playback</h4>
        <label>Speed<select id="sp">${[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((n) => `<option ${n === settings.speed ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label>Sleep timer<select id="sl"><option value="0">Off</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">60 minutes</option><option value="end">End of episode</option></select></label></div>
      <div class="ms"><h4>Picture</h4>
        <label>Brightness<span class="rng"><input id="br" type="range" min="15" max="180" value="${Math.round(settings.bright * 100)}"><output id="bv"></output></span></label></div>
      <div class="ms" id="sec-sound"><h4>Sound</h4>
        <label>Volume<span class="rng"><input id="vol" type="range" min="0" max="300" value="${Math.round(settings.vol * 100)}"><output id="vv"></output></span></label>
        <label id="alab" class="hidden">Audio track<select id="at"></select></label></div>
      <div class="ms" id="sec-sub"><h4>Subtitles</h4>
        <label id="slab" class="hidden">Embedded<select id="es"></select></label>
        <label>Size<select id="ss">${[16, 20, 24, 28, 34].map((n) => `<option ${n === settings.subSize ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label>Background<input id="sb" class="tgl" type="checkbox" ${settings.subBg ? "checked" : ""}></label>
        <div class="mrow">Delay<span class="stepper"><button id="dm">-0.5s</button><b id="dv">0.0s</b><button id="dp">+0.5s</button></span></div>
        <div class="two"><button id="sf">Load file</button><button id="so">Turn off</button></div><input id="sfile" type="file" accept=".srt,.vtt,text/plain" hidden></div>
      ${isMkv ? '<div class="ms"><h4>Compatibility</h4><button id="eng" class="full">Try standard playback (other formats)</button></div>' : ""}
    </div></div>`);
  const $ = (id) => document.getElementById(id);
  const v = $("v"), pl = $("pl"), menu = $("menu"), sub = $("sub");
  let cues = [], delay = 0, hideT = 0, msgT = 0, seeking = false, marked = false, ticks = 0, nativeMode = false, mkErr = "";

  let mk = null, gone = false;
  const emb = {};
  if (isMkv) {
    $("msg").textContent = "Preparing MKV…";
    attach(v, m, { onCue: (tn, c) => { (emb[tn] = emb[tn] || []).push(c); }, buffer: () => settings.buffer }).then((c) => {
      if (gone || nativeMode) { c.destroy(); return; }
      mk = c;
      $("msg").textContent = c.note;
      if (c.audios.length > 1) {
        $("alab").classList.remove("hidden");
        $("at").innerHTML = c.audios.map((a) => `<option value="${a.i}" ${a.i === c.activeAudio() ? "selected" : ""}>${esc(a.label)}</option>`).join("");
      }
      if (c.subs.length) {
        $("slab").classList.remove("hidden");
        $("es").innerHTML = '<option value="0">Off</option>' + c.subs.map((s) => `<option value="${s.num}">${esc(s.label)}</option>`).join("");
      }
    }).catch((e) => {
      if (gone) return;
      mkErr = e.message || "";
      nativeMode = true;
      $("msg").textContent = "Trying standard playback…";
      v.src = streamUrl(m);
      pl.classList.add("show");
    });
  } else v.src = streamUrl(m);
  v.playbackRate = settings.speed;

  let actx = null, gain = null, acc = 0, lastT = 0, mode = "", ly = 0;
  const setVol = (x) => {
    settings.vol = Math.max(0, Math.min(3, x));
    const vo = $("vv");
    if (vo) vo.textContent = Math.round(settings.vol * 100) + "%";
    if (!actx && settings.vol === 1) return;
    if (!actx) {
      const A = window.AudioContext || window.webkitAudioContext;
      actx = new A();
      const src = actx.createMediaElementSource(v);
      gain = actx.createGain();
      const comp = actx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 24; comp.ratio.value = 10; comp.attack.value = 0.003; comp.release.value = 0.2;
      src.connect(gain);
      gain.connect(comp);
      comp.connect(actx.destination);
    }
    if (actx.state === "suspended") actx.resume();
    gain.gain.value = settings.vol;
  };
  const setBright = (x) => {
    settings.bright = Math.max(0.15, Math.min(1.8, x));
    const b = settings.bright;
    $("dim").style.opacity = b < 1 ? String(Math.min(0.85, 1 - b)) : "0";
    v.style.filter = b > 1 ? "brightness(" + b + ")" : "none";
    const o = $("bv");
    if (o) o.textContent = Math.round(b * 100) + "%";
  };
  setBright(settings.bright);
  $("vv").textContent = Math.round(settings.vol * 100) + "%";
  if (settings.vol !== 1) v.addEventListener("play", () => setVol(settings.vol), { once: true });
  const FITS = [["contain", "Fit"], ["cover", "Fill"], ["fill", "Stretch"]];
  const setFit = (i) => { v.style.objectFit = FITS[i][0]; $("ftl").textContent = FITS[i][1]; settings.fit = FITS[i][0]; };
  setFit(Math.max(0, FITS.findIndex((x) => x[0] === settings.fit)));
  let sleepT = 0, sleepEnd = false, land = false, wake = null;
  const pt = (t) => (land ? { x: t.clientY, y: window.innerWidth - t.clientX } : { x: t.clientX, y: t.clientY });
  const onResize = () => { if (land && window.innerWidth > window.innerHeight) { land = false; pl.classList.remove("land"); } };
  addEventListener("resize", onResize);
  const keepAwake = async () => { try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) {} };
  v.addEventListener("play", keepAwake);
  const flash = (t) => {
    const e = $("msg");
    if (!e) return;
    e.textContent = t;
    clearTimeout(msgT);
    msgT = setTimeout(() => { const x = $("msg"); if (x) x.textContent = ""; }, 900);
  };
  const show = () => {
    pl.classList.add("show");
    clearTimeout(hideT);
    hideT = setTimeout(() => { if (!v.paused && menu.classList.contains("hidden")) pl.classList.remove("show"); }, 3500);
  };
  const skip = (dir) => { v.currentTime = Math.max(0, Math.min(v.duration || 1e9, v.currentTime + dir * settings.skip)); flash((dir > 0 ? "+" : "-") + settings.skip + "s"); };
  const styleSub = () => { sub.style.fontSize = settings.subSize + "px"; sub.classList.toggle("bg", settings.subBg); };
  styleSub();
  const setPP = (playing) => { $("pp").innerHTML = playing ? IC.pause : IC.play; };

  const wantLandscape = async () => {
    if (window.innerWidth >= window.innerHeight) return;
    const o = screen.orientation;
    if (o && o.lock && pl.requestFullscreen) {
      try { if (!document.fullscreenElement) await pl.requestFullscreen(); await o.lock("landscape"); return; } catch (e) {}
    }
    if (window.innerWidth < window.innerHeight) { land = true; pl.classList.add("land"); }
  };
  wantLandscape();

  const last = pos[m.id];
  v.addEventListener("loadedmetadata", () => { if (gone) return;
    if (settings.resume && last > 5 && last < v.duration - 30) v.currentTime = last;
    v.playbackRate = settings.speed;
    $("dur").textContent = fmt(v.duration);
    if (v.audioTracks && v.audioTracks.length > 1) {
      $("alab").classList.remove("hidden");
      $("at").innerHTML = Array.from(v.audioTracks).map((t, i) => `<option value="${i}" ${t.enabled ? "selected" : ""}>${esc(t.label || t.language || "Track " + (i + 1))}</option>`).join("");
    }
  });
  v.addEventListener("timeupdate", () => { if (gone) return;
    $("cur").textContent = fmt(v.currentTime);
    if (!seeking && v.duration) $("seek").value = Math.round((v.currentTime / v.duration) * 1000);
    const nt = v.currentTime;
    if (!v.paused && nt > lastT && nt - lastT < 3) acc += nt - lastT;
    lastT = nt;
    if (navigator.mediaSession && v.duration && isFinite(v.duration)) { try { navigator.mediaSession.setPositionState({ duration: v.duration, playbackRate: v.playbackRate || 1, position: Math.min(nt, v.duration) }); } catch (e) {} }
    if (acc >= 10) { onWatch(acc); acc = 0; }
    pos[m.id] = Math.floor(v.currentTime);
    if (!marked && v.duration && v.currentTime / v.duration >= 0.92) { marked = true; onSeen(m); }
    if (++ticks % 20 === 0) save();
  });
  v.addEventListener("play", () => { if (gone) return; setPP(true); show(); });
  v.addEventListener("pause", () => { if (gone) return; setPP(false); if (!pl.classList.contains("inpip")) pl.classList.add("show"); });
  v.addEventListener("ended", () => { if (gone) return; if (!marked) { marked = true; onSeen(m); } pos[m.id] = 0; save(); if (next && !sleepEnd) { clearInterval(tick); next(); } });
  v.addEventListener("error", () => { if (gone) return; $("msg").textContent = "This file can't be played in your browser." + (mkErr ? " " + mkErr : ""); pl.classList.add("show"); });

  const tick = setInterval(() => {
    const t = v.currentTime;
    const c = cues.find((x) => t >= x.s + delay && t <= x.e + delay);
    sub.textContent = c ? c.t : "";
  }, 150);

  const openMenu = (id) => {
    menu.classList.remove("hidden");
    pl.classList.add("show");
    const el = id && id !== "top" ? $(id) : null;
    menu.scrollTop = el ? Math.max(0, el.offsetTop - 52) : 0;
  };
  const inPip = (on) => {
    pl.classList.toggle("inpip", on);
    if (on) { menu.classList.add("hidden"); pl.classList.remove("show"); }
    else show();
  };

  $("pp").onclick = () => (v.paused ? v.play() : v.pause());
  $("rt").onclick = async () => {
    const o = screen.orientation;
    if (o && o.lock && pl.requestFullscreen && !land) {
      try { if (!document.fullscreenElement) await pl.requestFullscreen(); await o.lock(o.type.startsWith("landscape") ? "portrait" : "landscape"); return; } catch (e) {}
    }
    land = !land;
    pl.classList.toggle("land", land);
    flash(land ? "Landscape" : "Portrait");
    show();
  };
  $("ft").onclick = () => { const i = (FITS.findIndex((x) => x[0] === settings.fit) + 1) % FITS.length; setFit(i); flash(FITS[i][1]); save(); show(); };
  $("sl").onchange = (e) => {
    clearTimeout(sleepT);
    sleepEnd = e.target.value === "end";
    const n = Number(e.target.value);
    if (n) sleepT = setTimeout(() => { v.pause(); flash("Sleep timer: paused"); }, n * 60000);
  };
  $("rw").onclick = () => { skip(-1); show(); };
  $("fw").onclick = () => { skip(1); show(); };
  $("seek").addEventListener("touchstart", () => { seeking = true; }, { passive: true });
  $("seek").oninput = () => { if (v.duration) v.currentTime = ($("seek").value / 1000) * v.duration; };
  $("seek").addEventListener("change", () => { seeking = false; show(); });
  $("mn").onclick = () => openMenu("top");
  pl.querySelectorAll(".pbtn[data-s]").forEach((b) => (b.onclick = () => openMenu(b.dataset.s)));
  $("mc").onclick = () => { menu.classList.add("hidden"); show(); };
  $("sp").onchange = (e) => { settings.speed = Number(e.target.value); v.playbackRate = settings.speed; $("spl").textContent = settings.speed + "x"; save(); };
  $("ss").onchange = (e) => { settings.subSize = Number(e.target.value); styleSub(); save(); };
  $("sb").onchange = (e) => { settings.subBg = e.target.checked; styleSub(); save(); };
  $("dm").onclick = () => { delay -= 0.5; $("dv").textContent = delay.toFixed(1) + "s"; };
  $("dp").onclick = () => { delay += 0.5; $("dv").textContent = delay.toFixed(1) + "s"; };
  $("sf").onclick = () => $("sfile").click();
  $("sfile").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    cues = parseSubs(await f.text());
    flash(cues.length ? "Subtitles loaded" : "Could not read that file");
  };
  $("so").onclick = () => { cues = []; sub.textContent = ""; };
  $("at").onchange = async (e) => {
    if (mk) { const ok = await mk.setAudio(Number(e.target.value)); if (!ok) flash("That audio format isn't supported"); }
    else Array.from(v.audioTracks).forEach((t, i) => { t.enabled = i === Number(e.target.value); });
  };
  $("es").onchange = (e) => {
    const n = Number(e.target.value);
    if (!n) { cues = []; sub.textContent = ""; } else { emb[n] = emb[n] || []; cues = emb[n]; }
  };
  $("vol").oninput = (e) => setVol(e.target.value / 100);
  $("br").oninput = (e) => setBright(e.target.value / 100);
  $("vol").onchange = save;
  $("br").onchange = save;
  const eng = $("eng");
  if (eng) eng.onclick = () => {
    const t = v.currentTime;
    nativeMode = true;
    if (mk) { mk.destroy(); mk = null; }
    mkErr = "";
    v.removeAttribute("src");
    v.src = streamUrl(m);
    v.addEventListener("loadedmetadata", () => { if (t > 5) v.currentTime = t; v.play().catch(() => {}); }, { once: true });
    $("msg").textContent = "";
    menu.classList.add("hidden");
    flash("Standard playback");
  };
  $("pip").onclick = async () => {
    menu.classList.add("hidden");
    try {
      if (v.webkitSupportsPresentationMode && v.webkitSupportsPresentationMode("picture-in-picture")) v.webkitSetPresentationMode("picture-in-picture");
      else if (v.requestPictureInPicture) await v.requestPictureInPicture();
      else flash("Picture in picture is not available");
    } catch (e) { flash("Picture in picture is not available"); }
  };
  v.addEventListener("enterpictureinpicture", () => inPip(true));
  v.addEventListener("leavepictureinpicture", () => inPip(false));
  v.addEventListener("webkitpresentationmodechanged", () => inPip(v.webkitPresentationMode === "picture-in-picture"));
  $("back").onclick = () => { gone = true; clearTimeout(msgT); clearTimeout(sleepT); if ("mediaSession" in navigator) navigator.mediaSession.metadata = null; if (acc > 0) onWatch(acc); if (mk) mk.destroy(); clearInterval(tick); save(); v.pause();
    removeEventListener("resize", onResize);
    if (wake) wake.release();
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    try { screen.orientation.unlock(); } catch (e) {}
    if ("mediaSession" in navigator) ["play", "pause", "seekbackward", "seekforward", "seekto", "nexttrack"].forEach((a) => { try { navigator.mediaSession.setActionHandler(a, null); } catch (e) {} });
    if (v.src.startsWith("blob:")) URL.revokeObjectURL(v.src);
    v.removeAttribute("src"); v.load(); back(); };

  const g = $("gest");
  let sx = 0, sy = 0, moved = false, drag = 0, lastTap = 0, tapT = 0;
  g.addEventListener("touchstart", (e) => { const q0 = pt(e.touches[0]); sx = q0.x; sy = q0.y; moved = false; drag = 0; mode = ""; }, { passive: true });
  g.addEventListener("touchmove", (e) => {
    if (!settings.gestures) return;
    const t = pt(e.touches[0]), dx = t.x - sx, dy = t.y - sy;
    if (!mode && (Math.abs(dx) > 25 || Math.abs(dy) > 25)) { mode = Math.abs(dx) > Math.abs(dy) ? "h" : "v"; ly = t.y; }
    if (mode === "h") {
      moved = true;
      drag = Math.round((dx / g.clientWidth) * 120);
      flash((drag >= 0 ? "+" : "") + drag + "s");
    } else if (mode === "v") {
      moved = true;
      const d = ((ly - t.y) / g.clientHeight) * 1.2;
      ly = t.y;
      if (sx < g.clientWidth / 2) { setBright(settings.bright + d); flash("Brightness " + Math.round(settings.bright * 100) + "%"); }
      else { setVol(settings.vol + d); flash("Volume " + Math.round(settings.vol * 100) + "%"); }
    }
  }, { passive: true });
  g.addEventListener("touchend", () => {
    if (moved) { if (drag) v.currentTime = Math.max(0, Math.min(v.duration || 1e9, v.currentTime + drag)); save(); return; }
    const now = Date.now();
    if (now - lastTap < 300) {
      clearTimeout(tapT); lastTap = 0;
      if (settings.gestures) skip(sx < g.clientWidth / 2 ? -1 : 1);
    } else {
      lastTap = now;
      tapT = setTimeout(() => { if (pl.classList.contains("show") && !v.paused) pl.classList.remove("show"); else show(); }, 300);
    }
  });
  if ("mediaSession" in navigator) {
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({ title, artist: "NWFlix iOS", artwork: [{ src: poster || new URL("icon-512.png", location.href).href, sizes: "512x512" }] });
    ms.setActionHandler("play", () => v.play());
    ms.setActionHandler("pause", () => v.pause());
    ms.setActionHandler("seekbackward", () => skip(-1));
    ms.setActionHandler("seekforward", () => skip(1));
    ms.setActionHandler("seekto", (d) => { v.currentTime = d.seekTime; });
    ms.setActionHandler("nexttrack", next ? () => { clearInterval(tick); next(); } : null);
  }
  show();
}
