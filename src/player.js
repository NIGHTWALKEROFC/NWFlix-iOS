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
  const risky = /\.(avi|wmv|flv|ts)$/i.test(m.name);
  view(`<div class="player" id="pl">
    <video id="v" playsinline autoplay preload="auto"></video>
    <div id="sub" class="sub"></div>
    <div id="dim" class="dim"></div>
    <div id="gest" class="gest"></div>
    <p id="msg" class="pmsg">${risky ? "This is an MKV-style file. Safari may not play it." : ""}</p>
    <div class="pui">
      <div class="ptop"><button id="back" class="ico">Back</button><span>${label}</span><button id="rt" class="ico">Rotate</button><button id="ft" class="ico">Fit</button><button id="mn" class="ico">More</button></div>
      <div class="pmid"><button id="rw" class="big">-${settings.skip}</button><button id="pp" class="big">❚❚</button><button id="fw" class="big">+${settings.skip}</button></div>
      <div class="pbot"><span id="cur">0:00</span><input id="seek" type="range" min="0" max="1000" value="0"><span id="dur">0:00</span></div>
    </div>
    <div id="menu" class="pmenu hidden">
      <div class="mh"><b>Player settings</b><button id="mc" class="ico">Done</button></div>
      <div class="ms"><h4>Playback</h4>
        <label>Speed<select id="sp">${[0.5, 0.75, 1, 1.25, 1.5, 2].map((n) => `<option ${n === settings.speed ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label>Sleep timer<select id="sl"><option value="0">Off</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">60 minutes</option><option value="end">End of episode</option></select></label></div>
      <div class="ms"><h4>Picture</h4>
        <label>Brightness<span class="rng"><input id="br" type="range" min="15" max="180" value="${Math.round(settings.bright * 100)}"><output id="bv"></output></span></label></div>
      <div class="ms"><h4>Sound</h4>
        <label>Volume<span class="rng"><input id="vol" type="range" min="0" max="300" value="${Math.round(settings.vol * 100)}"><output id="vv"></output></span></label>
        <label id="alab" class="hidden">Audio track<select id="at"></select></label></div>
      <div class="ms"><h4>Subtitles</h4>
        <label id="slab" class="hidden">Embedded<select id="es"></select></label>
        <label>Size<select id="ss">${[16, 20, 24, 28, 34].map((n) => `<option ${n === settings.subSize ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label>Background<input id="sb" class="tgl" type="checkbox" ${settings.subBg ? "checked" : ""}></label>
        <div class="mrow">Delay<span class="stepper"><button id="dm">-0.5s</button><b id="dv">0.0s</b><button id="dp">+0.5s</button></span></div>
        <div class="two"><button id="sf">Load file</button><button id="so">Turn off</button></div><input id="sfile" type="file" accept=".srt,.vtt,text/plain" hidden></div>
      <div class="ms"><button id="pip" class="full">Picture in picture</button></div>
    </div></div>`);
  const $ = (id) => document.getElementById(id);
  const v = $("v"), pl = $("pl"), menu = $("menu"), sub = $("sub");
  let cues = [], delay = 0, hideT = 0, msgT = 0, seeking = false, marked = false, ticks = 0;

  let mk = null;
  if (/\.mkv$/i.test(m.name)) {
    $("msg").textContent = "Preparing MKV…";
    attach(v, m, { onCue: (tn, c) => { (emb[tn] = emb[tn] || []).push(c); }, buffer: () => settings.buffer }).then((c) => {
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
    }).catch((e) => { $("msg").textContent = e.message; pl.classList.add("show"); });
  } else v.src = streamUrl(m);
  v.playbackRate = settings.speed;

  let actx = null, gain = null, acc = 0, lastT = 0, mode = "", ly = 0;
  const emb = {};
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
  const FITS = [["contain", "Fit"], ["cover", "Fill"], ["fill", "Stretch"]];
  const setFit = (i) => { v.style.objectFit = FITS[i][0]; $("ft").textContent = FITS[i][1]; settings.fit = FITS[i][0]; };
  setFit(Math.max(0, FITS.findIndex((x) => x[0] === settings.fit)));
  let sleepT = 0, sleepEnd = false, land = false, wake = null;
  const pt = (t) => (land ? { x: t.clientY, y: window.innerWidth - t.clientX } : { x: t.clientX, y: t.clientY });
  const onResize = () => { if (land && window.innerWidth > window.innerHeight) { land = false; pl.classList.remove("land"); } };
  addEventListener("resize", onResize);
  const keepAwake = async () => { try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } } catch (e) {} };
  v.addEventListener("play", keepAwake);
  if (settings.vol !== 1) v.addEventListener("play", () => setVol(settings.vol), { once: true });
  const flash = (t) => { $("msg").textContent = t; clearTimeout(msgT); msgT = setTimeout(() => { $("msg").textContent = ""; }, 900); };
  const show = () => {
    pl.classList.add("show");
    clearTimeout(hideT);
    hideT = setTimeout(() => { if (!v.paused && menu.classList.contains("hidden")) pl.classList.remove("show"); }, 3500);
  };
  const skip = (dir) => { v.currentTime = Math.max(0, Math.min(v.duration || 1e9, v.currentTime + dir * settings.skip)); flash((dir > 0 ? "+" : "-") + settings.skip + "s"); };
  const styleSub = () => { sub.style.fontSize = settings.subSize + "px"; sub.classList.toggle("bg", settings.subBg); };
  styleSub();

  const last = pos[m.id];
  v.addEventListener("loadedmetadata", () => {
    if (settings.resume && last > 5 && last < v.duration - 30) v.currentTime = last;
    v.playbackRate = settings.speed;
    $("dur").textContent = fmt(v.duration);
    if (v.audioTracks && v.audioTracks.length > 1) {
      $("alab").classList.remove("hidden");
      $("at").innerHTML = Array.from(v.audioTracks).map((t, i) => `<option value="${i}" ${t.enabled ? "selected" : ""}>${esc(t.label || t.language || "Track " + (i + 1))}</option>`).join("");
    }
  });
  v.addEventListener("timeupdate", () => {
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
  v.addEventListener("play", () => { $("pp").textContent = "❚❚"; show(); });
  v.addEventListener("pause", () => { $("pp").textContent = "▶"; pl.classList.add("show"); });
  v.addEventListener("ended", () => { if (!marked) { marked = true; onSeen(m); } pos[m.id] = 0; save(); if (next && !sleepEnd) { clearInterval(tick); next(); } });
  v.addEventListener("error", () => { $("msg").textContent = "This file can't be played in your browser."; pl.classList.add("show"); });

  const tick = setInterval(() => {
    const t = v.currentTime;
    const c = cues.find((x) => t >= x.s + delay && t <= x.e + delay);
    sub.textContent = c ? c.t : "";
  }, 150);

  $("pp").onclick = () => (v.paused ? v.play() : v.pause());
  $("rt").onclick = async () => {
    const o = screen.orientation;
    if (o && o.lock && pl.requestFullscreen) {
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
  $("mn").onclick = () => { menu.classList.remove("hidden"); pl.classList.add("show"); };
  $("mc").onclick = () => { menu.classList.add("hidden"); show(); };
  $("sp").onchange = (e) => { settings.speed = Number(e.target.value); v.playbackRate = settings.speed; save(); };
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
  $("pip").onclick = () => {
    if (v.webkitSupportsPresentationMode && v.webkitSupportsPresentationMode("picture-in-picture")) v.webkitSetPresentationMode("picture-in-picture");
    else if (v.requestPictureInPicture) v.requestPictureInPicture().catch(() => flash("Picture in picture is not available"));
    else flash("Picture in picture is not available");
  };
  $("back").onclick = () => { clearTimeout(sleepT); if ("mediaSession" in navigator) navigator.mediaSession.metadata = null; if (acc > 0) onWatch(acc); if (mk) mk.destroy(); clearInterval(tick); save(); v.pause();
    removeEventListener("resize", onResize);
    if (wake) wake.release();
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
