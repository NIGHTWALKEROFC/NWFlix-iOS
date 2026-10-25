import { streamUrl } from "./tg.js";
import { attach } from "./mkv.js";

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

export function play({ m, label, settings, pos, save, view, back, onSeen, next }) {
  const risky = /\.(avi|wmv|flv|ts)$/i.test(m.name);
  view(`<div class="player" id="pl">
    <video id="v" playsinline autoplay preload="auto"></video>
    <div id="sub" class="sub"></div>
    <div id="gest" class="gest"></div>
    <p id="msg" class="pmsg">${risky ? "This is an MKV-style file. Safari may not play it." : ""}</p>
    <div class="pui">
      <div class="ptop"><button id="back" class="ico">Back</button><span>${label}</span><button id="mn" class="ico">More</button></div>
      <div class="pmid"><button id="rw" class="big">-${settings.skip}</button><button id="pp" class="big">❚❚</button><button id="fw" class="big">+${settings.skip}</button></div>
      <div class="pbot"><span id="cur">0:00</span><input id="seek" type="range" min="0" max="1000" value="0"><span id="dur">0:00</span></div>
    </div>
    <div id="menu" class="pmenu hidden">
      <label>Speed<select id="sp">${[0.5, 0.75, 1, 1.25, 1.5, 2].map((n) => `<option ${n === settings.speed ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <label>Subtitle size<select id="ss">${[16, 20, 24, 28, 34].map((n) => `<option ${n === settings.subSize ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <label>Subtitle background<input id="sb" type="checkbox" ${settings.subBg ? "checked" : ""}></label>
      <div class="mrow">Subtitle delay<span><button id="dm">-0.5s</button> <b id="dv">0.0s</b> <button id="dp">+0.5s</button></span></div>
      <button id="sf">Load subtitles (.srt or .vtt)</button><input id="sfile" type="file" accept=".srt,.vtt,text/plain" hidden>
      <button id="so">Subtitles off</button>
      <label id="alab" class="hidden">Audio track<select id="at"></select></label>
      <button id="pip">Picture in picture</button>
      <button id="mc" class="ghost">Close</button>
    </div></div>`);
  const $ = (id) => document.getElementById(id);
  const v = $("v"), pl = $("pl"), menu = $("menu"), sub = $("sub");
  let cues = [], delay = 0, hideT = 0, msgT = 0, seeking = false, marked = false, ticks = 0;

  let mk = null;
  if (/\.mkv$/i.test(m.name)) {
    $("msg").textContent = "Preparing MKV…";
    attach(v, m).then((c) => { mk = c; $("msg").textContent = c.note; }).catch((e) => { $("msg").textContent = e.message; pl.classList.add("show"); });
  } else v.src = streamUrl(m);
  v.playbackRate = settings.speed;

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
      $("at").innerHTML = Array.from(v.audioTracks).map((t, i) => `<option value="${i}" ${t.enabled ? "selected" : ""}>${t.label || t.language || "Track " + (i + 1)}</option>`).join("");
    }
  });
  v.addEventListener("timeupdate", () => {
    $("cur").textContent = fmt(v.currentTime);
    if (!seeking && v.duration) $("seek").value = Math.round((v.currentTime / v.duration) * 1000);
    pos[m.id] = Math.floor(v.currentTime);
    if (!marked && v.duration && v.currentTime / v.duration >= 0.92) { marked = true; onSeen(m); }
    if (++ticks % 20 === 0) save();
  });
  v.addEventListener("play", () => { $("pp").textContent = "❚❚"; show(); });
  v.addEventListener("pause", () => { $("pp").textContent = "▶"; pl.classList.add("show"); });
  v.addEventListener("ended", () => { if (!marked) { marked = true; onSeen(m); } pos[m.id] = 0; save(); if (next) { clearInterval(tick); next(); } });
  v.addEventListener("error", () => { $("msg").textContent = "This file can't be played in your browser."; pl.classList.add("show"); });

  const tick = setInterval(() => {
    const t = v.currentTime;
    const c = cues.find((x) => t >= x.s + delay && t <= x.e + delay);
    sub.textContent = c ? c.t : "";
  }, 150);

  $("pp").onclick = () => (v.paused ? v.play() : v.pause());
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
  $("at").onchange = (e) => { Array.from(v.audioTracks).forEach((t, i) => { t.enabled = i === Number(e.target.value); }); };
  $("pip").onclick = () => {
    if (v.webkitSupportsPresentationMode && v.webkitSupportsPresentationMode("picture-in-picture")) v.webkitSetPresentationMode("picture-in-picture");
    else if (v.requestPictureInPicture) v.requestPictureInPicture().catch(() => flash("Picture in picture is not available"));
    else flash("Picture in picture is not available");
  };
  $("back").onclick = () => { if (mk) mk.destroy(); clearInterval(tick); save(); v.pause(); v.removeAttribute("src"); v.load(); back(); };

  const g = $("gest");
  let sx = 0, sy = 0, moved = false, drag = 0, lastTap = 0, tapT = 0;
  g.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; moved = false; drag = 0; }, { passive: true });
  g.addEventListener("touchmove", (e) => {
    if (!settings.gestures) return;
    const dx = e.touches[0].clientX - sx;
    if (Math.abs(dx) > 25 && Math.abs(dx) > Math.abs(e.touches[0].clientY - sy)) {
      moved = true;
      drag = Math.round((dx / g.clientWidth) * 120);
      flash((drag >= 0 ? "+" : "") + drag + "s");
    }
  }, { passive: true });
  g.addEventListener("touchend", () => {
    if (moved) { if (drag) v.currentTime = Math.max(0, Math.min(v.duration || 1e9, v.currentTime + drag)); return; }
    const now = Date.now();
    if (now - lastTap < 300) {
      clearTimeout(tapT); lastTap = 0;
      if (settings.gestures) skip(sx < g.clientWidth / 2 ? -1 : 1);
    } else {
      lastTap = now;
      tapT = setTimeout(() => { if (pl.classList.contains("show") && !v.paused) pl.classList.remove("show"); else show(); }, 300);
    }
  });
  show();
}
