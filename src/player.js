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
const mb = (b) => (b >= 1073741824 ? (b / 1073741824).toFixed(2) + " GB" : (b / 1048576).toFixed(1) + " MB");

const ic = (d) => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;
const IC = {
  back: ic("M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"),
  play: ic("M8 5v14l11-7z"),
  pause: ic("M6 19h4V5H6v14zm8-14v14h4V5h-4z"),
  pip: ic("M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"),
  rotate: ic("M16.48 2.52c3.27 1.55 5.61 4.72 5.97 8.48h1.5C23.44 4.84 18.29 0 12 0l-.66.03 3.81 3.81 1.33-1.32zm-6.25-.77c-.59-.59-1.54-.59-2.12 0L1.75 8.11c-.59.59-.59 1.54 0 2.12l12.02 12.02c.59.59 1.54.59 2.12 0l6.36-6.36c.59-.59.59-1.54 0-2.12L10.23 1.75zm4.6 19.44L2.81 9.17l6.36-6.36 12.02 12.02-6.36 6.36zm-7.31.29C4.25 19.94 1.91 16.76 1.55 13H.05C.56 19.16 5.71 24 12 24l.66-.03-3.81-3.81-1.33 1.32z"),
  tune: ic("M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"),
  lock: ic("M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"),
  subs: ic("M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z"),
  audio: ic("M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"),
  speed: ic("M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-10.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z"),
  aspect: ic("M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.99h18v14.02z"),
  more: ic("M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"),
  moon: ic("M12.43 2.3c-2.38-.59-4.68-.27-6.63.64-.35.16-.41.64-.1.86C8.3 5.6 10 8.6 10 12c0 3.4-1.7 6.4-4.3 8.2-.32.22-.25.7.1.86 1.28.6 2.71.94 4.2.94 5.52 0 10-4.48 10-10 0-4.75-3.31-8.72-7.57-9.7z"),
  versions: ic("M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z"),
  engine: ic("M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"),
  folder: ic("M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z")
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

function parseAss(text) {
  const out = [];
  const t = (x) => { const q = x.trim().split(":"); return Number(q[0]) * 3600 + Number(q[1]) * 60 + parseFloat(q[2]); };
  text.replace(/\r/g, "").split("\n").forEach((l) => {
    if (!l.startsWith("Dialogue:")) return;
    const p = l.slice(9).split(",");
    if (p.length < 10) return;
    out.push({ s: t(p[1]), e: t(p[2]), t: p.slice(9).join(",").replace(/\{[^}]*\}/g, "").replace(/\\N/gi, "\n") });
  });
  return out.sort((a, b) => a.s - b.s);
}

const srcOf = (m) => (m.localFile ? URL.createObjectURL(m.localFile) : streamUrl(m));

export function play({ m, label, settings, pos, save, view, back, onSeen, onWatch, next, title, poster, versions, onSwitch }) {
  const risky = /\.(avi|wmv|flv|ts|mpg|mpeg|3gp)$/i.test(m.name);
  const isMkv = /\.mkv$/i.test(m.name);
  view(`<div class="player buf" id="pl">
    <video id="v" playsinline autoplay preload="auto"></video>
    <div id="sub" class="sub"></div>
    <div id="dim" class="pdim"></div>
    <div id="gest" class="gest"></div>
    <div class="pspin"><i></i><span>Loading…</span></div>
    <p id="msg" class="pmsg">${risky ? "This format may not play in your browser." : ""}</p>
    <p id="pipnote" class="pipnote">Playing in picture in picture</p>
    <button id="ul" class="ulk" aria-label="Unlock">${IC.lock}</button>
    <div class="pui">
      <div class="ptop">
        <button id="back" class="pib" aria-label="Back">${IC.back}</button>
        <span class="ptitle">${label}</span>
        <button id="lk" class="pib" aria-label="Lock">${IC.lock}</button>
        <button id="pip" class="pib" aria-label="Picture in picture">${IC.pip}</button>
        <button id="rt" class="pib" aria-label="Rotate">${IC.rotate}</button>
        <button id="mn" class="pib" aria-label="Brightness and volume">${IC.tune}</button>
      </div>
      <div class="pmid">
        <button id="rw" class="big" aria-label="Back ${settings.skip} seconds">${skipIcon(settings.skip, false)}</button>
        <button id="pp" class="big main" aria-label="Play or pause"><span class="ico2">${IC.pause}</span><small>Loading…</small><b class="ring"></b></button>
        <button id="fw" class="big" aria-label="Forward ${settings.skip} seconds">${skipIcon(settings.skip, true)}</button>
      </div>
      <div class="pbot">
        <input id="seek" class="pseek" type="range" min="0" max="1000" value="0">
        <div class="ptimes"><span id="cur">0:00</span><span id="dur">0:00</span></div>
        <div class="pbtns">
          <button class="pbtn" id="bs">${IC.subs}<span>Subtitles</span></button>
          <button class="pbtn" id="ba">${IC.audio}<span>Audio</span></button>
          <button class="pbtn" id="bp">${IC.speed}<span id="spl"></span></button>
          <button class="pbtn" id="ft">${IC.aspect}<span id="ftl">Fit</span></button>
          <button class="pbtn" id="bm">${IC.more}<span>More</span></button>
        </div>
      </div>
    </div></div>`);
  const $ = (id) => document.getElementById(id);
  const v = $("v"), pl = $("pl"), sub = $("sub");
  let cues = [], delay = 0, hideT = 0, msgT = 0, ulT = 0, seeking = false, marked = false, ticks = 0, nativeMode = false, mkErr = "", locked = false, subSel = "off", fileName = "";
  const emb = {};
  let mk = null, gone = false;
  const url = () => srcOf(m);
  const setBuf = (on) => pl.classList.toggle("buf", on);

  if (isMkv) {
    $("msg").textContent = "Preparing MKV…";
    attach(v, m, { onCue: (tn, c) => { (emb[tn] = emb[tn] || []).push(c); }, buffer: () => settings.buffer }).then((c) => {
      if (gone || nativeMode) { c.destroy(); return; }
      mk = c;
      $("msg").textContent = c.note;
    }).catch((e) => {
      if (gone) return;
      mkErr = e.message || "";
      nativeMode = true;
      $("msg").textContent = "Trying standard playback…";
      v.src = url();
      pl.classList.add("show");
    });
  } else v.src = url();
  v.playbackRate = settings.speed;
  $("spl").textContent = settings.speed.toFixed(1) + "x";

  let actx = null, gain = null, acc = 0, lastT = 0, mode = "", ly = 0;
  const setVol = (x) => {
    settings.vol = Math.max(0, Math.min(3, x));
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
  };
  setBright(settings.bright);
  if (settings.vol !== 1) v.addEventListener("play", () => setVol(settings.vol), { once: true });
  const FITS = [["contain", "Fit"], ["cover", "Fill"], ["fill", "Stretch"]];
  const setFit = (i) => { v.style.objectFit = FITS[i][0]; $("ftl").textContent = FITS[i][1]; settings.fit = FITS[i][0]; };
  setFit(Math.max(0, FITS.findIndex((x) => x[0] === settings.fit)));
  let sleepT = 0, sleepEnd = false, sleepSel = "0", land = false, wake = null;
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
  const dialogOpen = () => !!pl.querySelector(".pdlg");
  const show = () => {
    if (locked) return;
    pl.classList.add("show");
    clearTimeout(hideT);
    hideT = setTimeout(() => { if (!v.paused && !dialogOpen()) pl.classList.remove("show"); }, 3500);
  };
  const skip = (dir) => { v.currentTime = Math.max(0, Math.min(v.duration || 1e9, v.currentTime + dir * settings.skip)); flash((dir > 0 ? "+" : "-") + settings.skip + "s"); };
  const styleSub = () => { sub.style.fontSize = settings.subSize + "px"; sub.classList.toggle("bg", settings.subBg); };
  styleSub();
  const setPP = (playing) => { $("pp").querySelector(".ico2").innerHTML = playing ? IC.pause : IC.play; };
  const paintSeek = () => { const s = $("seek"); s.style.setProperty("--p", (s.value / 10) + "%"); };

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
  });
  v.addEventListener("timeupdate", () => { if (gone) return;
    $("cur").textContent = fmt(v.currentTime);
    if (!seeking && v.duration) { $("seek").value = Math.round((v.currentTime / v.duration) * 1000); paintSeek(); }
    const nt = v.currentTime;
    if (!v.paused && nt > lastT && nt - lastT < 3) acc += nt - lastT;
    lastT = nt;
    if (navigator.mediaSession && v.duration && isFinite(v.duration)) { try { navigator.mediaSession.setPositionState({ duration: v.duration, playbackRate: v.playbackRate || 1, position: Math.min(nt, v.duration) }); } catch (e) {} }
    if (acc >= 10) { onWatch(acc); acc = 0; }
    pos[m.id] = Math.floor(v.currentTime);
    if (!marked && v.duration && v.currentTime / v.duration >= 0.92) { marked = true; onSeen(m); }
    if (++ticks % 20 === 0) save();
  });
  ["waiting", "seeking", "stalled"].forEach((n) => v.addEventListener(n, () => { if (!gone) setBuf(true); }));
  ["playing", "canplay", "seeked", "loadeddata"].forEach((n) => v.addEventListener(n, () => { if (!gone && !v.seeking && v.readyState >= 3) setBuf(false); }));
  v.addEventListener("play", () => { if (gone) return; setPP(true); show(); });
  v.addEventListener("pause", () => { if (gone) return; setPP(false); if (!pl.classList.contains("inpip") && !locked) pl.classList.add("show"); });
  v.addEventListener("ended", () => { if (gone) return; if (!marked) { marked = true; onSeen(m); } pos[m.id] = 0; save(); if (next && !sleepEnd) { clearInterval(tick); next(); } });
  v.addEventListener("error", () => { if (gone) return; setBuf(false); $("msg").textContent = "This file can't be played in your browser." + (mkErr ? " " + mkErr : ""); pl.classList.add("show"); });

  const tick = setInterval(() => {
    const t = v.currentTime;
    const c = cues.find((x) => t >= x.s + delay && t <= x.e + delay);
    sub.textContent = c ? c.t : "";
  }, 150);

  const dlg = (html, wire) => {
    const d = document.createElement("div");
    d.className = "pdlg";
    d.innerHTML = `<div class="dialog">${html}</div>`;
    pl.appendChild(d);
    const close = () => { d.remove(); show(); };
    d.onclick = (e) => { if (e.target === d) close(); };
    wire(d, close);
    return d;
  };
  const radios = (items, cur) => items.map(([v2, l], i) => `<button class="opt" data-i="${i}"><span class="rad ${String(v2) === String(cur) ? "on" : ""}"></span><span>${esc(l)}</span></button>`).join("");
  const rows = (d, items, pick, close) => d.querySelectorAll(".opt").forEach((b) => (b.onclick = () => { pick(items[Number(b.dataset.i)][0]); close(); }));

  const subsDialog = () => {
    const items = [["off", "Off"]];
    if (mk) mk.subs.forEach((s) => items.push([String(s.num), s.label]));
    if (cues.length && fileName) items.push(["file", fileName]);
    dlg(`<h3>Subtitles</h3><div class="opts">${radios(items, subSel)}</div>
      <button id="sf" class="obtn wide">${IC.folder}Load subtitle file (.srt .vtt .ass)</button>
      <p class="dtx" id="dl">Subtitle delay: ${Math.round(delay * 1000)} ms</p>
      <div class="chp"><button data-d="-500">-500</button><button data-d="-100">-100</button><button data-d="100">+100</button><button data-d="500">+500</button><button id="dr" class="tbtn">Reset</button></div>
      <input id="sfile" type="file" accept=".srt,.vtt,.ass,.ssa,text/plain" hidden>`, (d, close) => {
      rows(d, items, (val) => {
        subSel = val;
        if (val === "off") { cues = []; sub.textContent = ""; }
        else if (val !== "file") { emb[val] = emb[val] || []; cues = emb[val]; }
      }, close);
      const lab = () => { d.querySelector("#dl").textContent = "Subtitle delay: " + Math.round(delay * 1000) + " ms"; };
      d.querySelectorAll("[data-d]").forEach((b) => (b.onclick = () => { delay += Number(b.dataset.d) / 1000; lab(); }));
      d.querySelector("#dr").onclick = () => { delay = 0; lab(); };
      d.querySelector("#sf").onclick = () => d.querySelector("#sfile").click();
      d.querySelector("#sfile").onchange = async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const t = await f.text();
        cues = /\.(ass|ssa)$/i.test(f.name) ? parseAss(t) : parseSubs(t);
        fileName = f.name;
        subSel = "file";
        close();
        flash(cues.length ? "Subtitles loaded" : "Could not read that file");
      };
    });
  };

  const audioDialog = () => {
    let items = [], cur = "", pick = () => {};
    if (mk && mk.audios.length) { items = mk.audios.map((a) => [String(a.i), a.label]); cur = String(mk.activeAudio()); pick = async (val) => { const ok = await mk.setAudio(Number(val)); if (!ok) flash("That audio format isn't supported"); }; }
    else if (v.audioTracks && v.audioTracks.length > 1) { items = Array.from(v.audioTracks).map((t, i) => [String(i), t.label || t.language || "Track " + (i + 1)]); const on = Array.from(v.audioTracks).findIndex((t) => t.enabled); cur = String(on); pick = (val) => { Array.from(v.audioTracks).forEach((t, i) => { t.enabled = i === Number(val); }); }; }
    dlg(`<h3>Audio</h3>${items.length ? `<div class="opts">${radios(items, cur)}</div>` : '<p class="dtx">This file has a single audio track.</p>'}<div class="dact"><button class="tbtn" id="dx">Close</button></div>`, (d, close) => {
      rows(d, items, pick, close);
      d.querySelector("#dx").onclick = close;
    });
  };

  const speedDialog = () => {
    const items = [0.5, 0.75, 1, 1.25, 1.5, 2].map((n) => [n, n + "x"]);
    dlg(`<h3>Playback speed</h3><div class="opts">${radios(items, settings.speed)}</div><div class="dact"><button class="tbtn" id="dx">Close</button></div>`, (d, close) => {
      rows(d, items, (val) => { settings.speed = val; v.playbackRate = val; $("spl").textContent = val.toFixed(1) + "x"; save(); }, close);
      d.querySelector("#dx").onclick = close;
    });
  };

  const sleepDialog = () => {
    const items = [["0", "Off"], ["15", "15 minutes"], ["30", "30 minutes"], ["60", "60 minutes"], ["end", "End of episode"]];
    dlg(`<h3>Sleep timer</h3><div class="opts">${radios(items, sleepSel)}</div><div class="dact"><button class="tbtn" id="dx">Close</button></div>`, (d, close) => {
      rows(d, items, (val) => {
        sleepSel = val;
        clearTimeout(sleepT);
        sleepEnd = val === "end";
        const n = Number(val);
        if (n) sleepT = setTimeout(() => { v.pause(); flash("Sleep timer: paused"); }, n * 60000);
      }, close);
      d.querySelector("#dx").onclick = close;
    });
  };

  const switchEngine = () => {
    const t = v.currentTime;
    nativeMode = true;
    if (mk) { mk.destroy(); mk = null; }
    mkErr = "";
    setBuf(true);
    v.removeAttribute("src");
    v.src = url();
    v.addEventListener("loadedmetadata", () => { if (t > 5) v.currentTime = t; v.play().catch(() => {}); }, { once: true });
    $("msg").textContent = "";
    flash("Standard playback");
  };

  const teardown = () => {
    gone = true;
    clearTimeout(msgT); clearTimeout(sleepT); clearTimeout(hideT); clearTimeout(ulT);
    if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
    if (acc > 0) onWatch(acc);
    if (mk) mk.destroy();
    clearInterval(tick);
    save();
    v.pause();
    removeEventListener("resize", onResize);
    if (wake) wake.release();
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    try { screen.orientation.unlock(); } catch (e) {}
    if ("mediaSession" in navigator) ["play", "pause", "seekbackward", "seekforward", "seekto", "nexttrack"].forEach((a) => { try { navigator.mediaSession.setActionHandler(a, null); } catch (e) {} });
    if (v.src.startsWith("blob:")) URL.revokeObjectURL(v.src);
    v.removeAttribute("src");
    v.load();
  };

  const moreDialog = () => {
    const info = [m.name, v.videoWidth ? v.videoWidth + "×" + v.videoHeight : "", mb(m.size)].filter(Boolean).join("  •  ");
    const many = versions && versions.length > 1;
    dlg(`<h3>More</h3>
      <button class="mrow2" id="m1">${IC.moon}<span>Sleep timer</span></button>
      ${many ? `<button class="mrow2" id="m2">${IC.versions}<span>Switch version (other files of this movie)</span></button>` : ""}
      ${isMkv ? `<button class="mrow2" id="m3">${IC.engine}<span>Play with the standard engine (other formats)</span></button>` : ""}
      <h4 class="mh2">Info</h4><p class="dtx">${esc(info)}</p>`, (d, close) => {
      d.querySelector("#m1").onclick = () => { close(); sleepDialog(); };
      const a = d.querySelector("#m2");
      if (a) a.onclick = () => {
        close();
        const items = versions.map((f, i) => [String(i), (f.label || f.name) + "  •  " + mb(f.size)]);
        dlg(`<h3>Switch version</h3><div class="opts">${radios(items, versions.findIndex((f) => f.id === m.id))}</div><div class="dact"><button class="tbtn" id="dx">Close</button></div>`, (d2, close2) => {
          rows(d2, items, (val) => { const f = versions[Number(val)]; if (f.id !== m.id) { const t = v.currentTime; teardown(); onSwitch(f, t); } }, close2);
          d2.querySelector("#dx").onclick = close2;
        });
      };
      const b = d.querySelector("#m3");
      if (b) b.onclick = () => { close(); switchEngine(); };
    });
  };

  const tuneDialog = () => {
    dlg(`<h3>Picture & sound</h3>
      <div class="slr"><div class="slt"><span>Brightness</span><span id="bv" class="cv">${Math.round(settings.bright * 100)}%</span></div><input id="br" type="range" min="15" max="180" value="${Math.round(settings.bright * 100)}"></div>
      <div class="slr"><div class="slt"><span>Volume</span><span id="vv" class="cv">${Math.round(settings.vol * 100)}%</span></div><input id="vol" type="range" min="0" max="300" value="${Math.round(settings.vol * 100)}"></div>
      <div class="dact"><button class="tbtn" id="dx">Done</button></div>`, (d, close) => {
      d.querySelector("#br").oninput = (e) => { setBright(e.target.value / 100); d.querySelector("#bv").textContent = e.target.value + "%"; };
      d.querySelector("#vol").oninput = (e) => { setVol(e.target.value / 100); d.querySelector("#vv").textContent = e.target.value + "%"; };
      d.querySelector("#br").onchange = save;
      d.querySelector("#vol").onchange = save;
      d.querySelector("#dx").onclick = close;
    });
  };

  const inPip = (on) => {
    pl.classList.toggle("inpip", on);
    if (on) { pl.querySelectorAll(".pdlg").forEach((x) => x.remove()); pl.classList.remove("show"); }
    else show();
  };
  const setLock = (on) => {
    locked = on;
    pl.classList.toggle("locked", on);
    pl.classList.remove("show");
    if (on) flash("Screen locked");
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
  $("rw").onclick = () => { skip(-1); show(); };
  $("fw").onclick = () => { skip(1); show(); };
  $("seek").addEventListener("touchstart", () => { seeking = true; }, { passive: true });
  $("seek").oninput = () => { paintSeek(); if (v.duration) v.currentTime = ($("seek").value / 1000) * v.duration; };
  $("seek").addEventListener("change", () => { seeking = false; show(); });
  $("bs").onclick = subsDialog;
  $("ba").onclick = audioDialog;
  $("bp").onclick = speedDialog;
  $("bm").onclick = moreDialog;
  $("mn").onclick = tuneDialog;
  $("lk").onclick = () => setLock(true);
  $("ul").onclick = () => setLock(false);
  $("pip").onclick = async () => {
    try {
      if (v.webkitSupportsPresentationMode && v.webkitSupportsPresentationMode("picture-in-picture")) v.webkitSetPresentationMode("picture-in-picture");
      else if (v.requestPictureInPicture) await v.requestPictureInPicture();
      else flash("Picture in picture is not available");
    } catch (e) { flash("Picture in picture is not available"); }
  };
  v.addEventListener("enterpictureinpicture", () => inPip(true));
  v.addEventListener("leavepictureinpicture", () => inPip(false));
  v.addEventListener("webkitpresentationmodechanged", () => inPip(v.webkitPresentationMode === "picture-in-picture"));
  $("back").onclick = () => { teardown(); back(); };

  const g = $("gest");
  let sx = 0, sy = 0, moved = false, drag = 0, lastTap = 0, tapT = 0;
  g.addEventListener("touchstart", (e) => { const q0 = pt(e.touches[0]); sx = q0.x; sy = q0.y; moved = false; drag = 0; mode = ""; }, { passive: true });
  g.addEventListener("touchmove", (e) => {
    if (!settings.gestures || locked) return;
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
    if (locked) {
      pl.classList.add("show");
      clearTimeout(ulT);
      ulT = setTimeout(() => { if (locked) pl.classList.remove("show"); }, 2500);
      return;
    }
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
  paintSeek();
  show();
}
