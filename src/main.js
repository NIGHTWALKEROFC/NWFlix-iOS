import "./style.css";
import * as tg from "./tg.js";
import * as rc from "./remote.js";
import * as tmdb from "./tmdb.js";

const root = document.getElementById("app");
const LIB = "nwios_lib";
const POS = "nwios_pos";
const SET = "nwios_set";
let library = JSON.parse(localStorage.getItem(LIB) || "[]");
let pos = JSON.parse(localStorage.getItem(POS) || "{}");
let settings = Object.assign({ speed: 1, skip: 10, resume: true, hide: true }, JSON.parse(localStorage.getItem(SET) || "{}"));
let pending = null;

const save = () => localStorage.setItem(SET, JSON.stringify(settings));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tags = (n) => {
  const t = n.toLowerCase(), o = [];
  const q = /2160p|\b4k\b/.test(t) ? "4K" : /1080p/.test(t) ? "1080p" : /720p/.test(t) ? "720p" : /480p/.test(t) ? "480p" : "";
  if (q) o.push(q);
  if (/x265|hevc/.test(t)) o.push("HEVC");
  ["hindi", "english", "tamil", "telugu", "malayalam", "kannada", "korean"].forEach((l) => { if (t.includes(l)) o.push(l[0].toUpperCase() + l.slice(1)); });
  return o;
};
const gb = (b) => (b / 1073741824).toFixed(2) + " GB";

function view(html) { root.innerHTML = html; }

function ask(kind, text) {
  if (kind === "error") { const e = document.getElementById("err"); if (e) e.textContent = text; return; }
  const labels = { phone: ["Phone number", "+91 98765 43210", "tel"], code: ["Code from Telegram", "12345", "tel"], password: ["Two-step password", "Password", "password"] };
  const [title, hint, type] = labels[kind];
  view(`<div class="login"><img src="icon.png" width="72" height="72" alt=""><h1>NWFlix iOS</h1>
    <p>${kind === "phone" ? "Sign in with your Telegram number" : esc(title)}</p>
    <input id="v" type="${type}" placeholder="${hint}" autocomplete="off" ${kind === "code" ? 'inputmode="numeric"' : ""}>
    <p id="err" class="bad"></p><button id="go" class="btn">Continue</button></div>`);
  const input = document.getElementById("v");
  input.focus();
  return new Promise((res) => {
    const done = () => { const v = input.value.trim(); if (v) { document.getElementById("go").disabled = true; res(v); } };
    document.getElementById("go").onclick = done;
    input.onkeydown = (e) => { if (e.key === "Enter") done(); };
  });
}

async function gate() {
  if (await rc.ready()) return;
  view(`<div class="login"><img src="icon.png" width="72" height="72" alt=""><h1>NWFlix iOS</h1><p>Sign in with your email</p>
    <button id="g" class="btn">Continue with Google</button><p id="err" class="bad"></p></div>`);
  await new Promise((res) => {
    document.getElementById("g").onclick = async () => {
      try { await rc.signInGoogle(); res(); }
      catch (e) { if (e.message !== "Cancelled") document.getElementById("err").textContent = e.message; }
    };
  });
}

function applyRemote(c) {
  let box = document.getElementById("remote");
  if (!box) { box = document.createElement("div"); box.id = "remote"; document.body.appendChild(box); }
  if (c.maintenanceOn) {
    box.className = "cover";
    box.innerHTML = `<h1>${esc(c.maintenanceTitle || "We'll be right back")}</h1><p class="muted">${esc(c.maintenanceMessage || "NWFlix is being updated. Please try again in a little while.")}</p>`;
    return;
  }
  const live = c.annId && localStorage.getItem("nwios_ann") !== c.annId && (!c.annExpiresAt || Date.now() < c.annExpiresAt);
  if (!live) { box.className = ""; box.innerHTML = ""; return; }
  const link = c.annButtonText && c.annButtonUrl.startsWith("https://");
  box.className = "cover dim";
  box.innerHTML = `<div class="dialog"><h2>${esc(c.annTitle || "NWFlix")}</h2><p>${esc(c.annMessage)}</p>
    ${link ? `<a id="ab" class="btn" href="${esc(c.annButtonUrl)}" target="_blank" rel="noopener">${esc(c.annButtonText)}</a>` : ""}
    ${c.annDismissible || !link ? `<button id="ac" class="btn ghost">${link ? "Later" : "OK"}</button>` : ""}</div>`;
  const close = () => { localStorage.setItem("nwios_ann", c.annId); applyRemote(Object.assign({}, c, { annId: "" })); };
  const ac = document.getElementById("ac"); if (ac) ac.onclick = close;
  const ab = document.getElementById("ab"); if (ab) ab.onclick = () => setTimeout(close, 300);
}

async function boot() {
  await gate();
  rc.watchConfig(applyRemote);
  if (!tg.hasKeys()) { view('<div class="login"><h1>NWFlix iOS</h1><p class="bad">Telegram keys are missing in this build.</p></div>'); return; }
  view('<div class="login"><div class="spin"></div></div>');
  if (!("serviceWorker" in navigator)) { view('<div class="login"><h1>NWFlix iOS</h1><p class="bad">This browser cannot stream. Update iOS and open this page in Safari.</p></div>'); return; }
  let ok = await tg.resume();
  if (!ok) {
    try { await tg.login(ask); ok = true; } catch (e) { view(`<div class="login"><p class="bad">${esc(tg.friendly(e.message || ""))}</p><button class="btn" onclick="location.reload()">Try again</button></div>`); return; }
  }
  await tg.startStreaming(() => library);
  home();
  if (!library.length) rescan(); else enrichAll();
}

function groups() {
  const map = new Map();
  for (const f of library) {
    const k = f.tmdb > 0 ? "t" + f.tmdb : "n" + f.title.toLowerCase().replace(/[^a-z0-9]/g, "") + f.year;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(f);
  }
  return [...map.values()].map((files) => ({ files, v: files.find((f) => f.tmdb > 0) || files[0], at: Math.max(...files.map((f) => f.at)) })).sort((a, b) => b.at - a.at);
}

const title = (m) => m.name || m.title;
const year = (m) => m.year || "";

function home(q = "") {
  const hide = settings.hide && tmdb.hasKey();
  const list = groups().filter((g) => (!hide || g.v.tmdb > 0) &&
    (title(g.v) + " " + (g.v.cast || []).map((c) => c.n).join(" ") + " " + g.files.map((f) => f.name).join(" ")).toLowerCase().includes(q.toLowerCase()));
  view(`<header class="bar"><b>NWFlix iOS</b><div><button id="scan" class="ico">Rescan</button><button id="set" class="ico">Settings</button></div></header>
    <div class="search"><input id="q" type="search" placeholder="Search movies or cast" value="${esc(q)}"></div>
    <p id="status" class="muted"></p>
    <main class="grid">${list.map((g, i) => `<button class="card" data-i="${i}"><div class="poster">${g.v.poster ? `<img src="${tmdb.img(g.v.poster)}" loading="lazy" alt="">` : esc(title(g.v).slice(0, 1).toUpperCase())}</div>
      <span class="t">${esc(title(g.v))}</span><span class="s">${year(g.v)}${g.v.rating ? " · ★ " + g.v.rating.toFixed(1) : ""}${g.files.length > 1 ? " · " + g.files.length + " files" : ""}</span></button>`).join("")}</main>
    ${list.length ? "" : '<p class="muted center">No movies yet. Tap Rescan.</p>'}`);
  const qi = document.getElementById("q");
  qi.oninput = () => { const v = qi.value; home(v); const n = document.getElementById("q"); n.focus(); n.setSelectionRange(v.length, v.length); };
  document.getElementById("scan").onclick = rescan;
  document.getElementById("set").onclick = settingsView;
  document.querySelectorAll(".card").forEach((c) => (c.onclick = () => detail(list[Number(c.dataset.i)], q)));
}

function detail(g, q) {
  const v = g.v;
  const files = g.files.slice().sort((a, b) => b.size - a.size);
  const resumeFile = files.filter((f) => (pos[f.id] || 0) > 5).sort((a, b) => (pos[b.id] || 0) - (pos[a.id] || 0))[0];
  const best = resumeFile || files[0];
  const back = () => detail(g, q);
  view(`<div class="hero" ${v.backdrop ? `style="background-image:linear-gradient(#0000,#08090a),url(${tmdb.img(v.backdrop, "w780")})"` : ""}>
      <button id="b" class="ico">Back</button></div>
    <div class="info"><h1>${esc(title(v))}</h1>
      <p class="muted nopad">${[year(v), v.runtime ? v.runtime + " min" : "", v.rating ? "★ " + v.rating.toFixed(1) : ""].filter(Boolean).join(" · ")}</p>
      ${v.genres ? `<p class="muted nopad">${esc(v.genres)}</p>` : ""}
      <button id="p" class="btn">${resumeFile ? "Resume" : "Play"}</button>
      ${v.overview ? `<p>${esc(v.overview)}</p>` : ""}
      ${v.cast && v.cast.length ? `<h3>Cast</h3><p class="muted nopad">${v.cast.map((c) => esc(c.n) + (c.c ? " (" + esc(c.c) + ")" : "")).join(", ")}</p>` : ""}
      <h3>Files</h3>${files.map((f, i) => `<button class="file" data-i="${i}"><span>${esc(tags(f.name).join(" · ") || "Video")}</span><small>${gb(f.size)}</small></button>`).join("")}</div>`);
  document.getElementById("b").onclick = () => home(q);
  document.getElementById("p").onclick = () => play(best, back);
  document.querySelectorAll(".file").forEach((b) => (b.onclick = () => play(files[Number(b.dataset.i)], back)));
}

async function rescan() {
  const s = document.getElementById("status");
  if (s) s.textContent = "Scanning your Telegram chats…";
  try {
    const found = await tg.scan((n) => { const e = document.getElementById("status"); if (e) e.textContent = "Scanning… " + n + " found"; });
    const old = new Map(library.map((m) => [m.id, m]));
    library = found.map((m) => old.get(m.id) || m);
    localStorage.setItem(LIB, JSON.stringify(library));
  } catch (e) {}
  home();
  enrichAll();
}

async function enrichAll() {
  if (!tmdb.hasKey()) return;
  const store = () => localStorage.setItem(LIB, JSON.stringify(library));
  await tmdb.enrich(library, (n, t) => { const e = document.getElementById("status"); if (e) e.textContent = "Fetching movie details… " + n + "/" + t; }, store);
  if (document.getElementById("status")) home();
}

function play(m, back = home) {
  const risky = /\.(mkv|avi|wmv|flv|ts)$/i.test(m.name);
  view(`<div class="player"><video id="v" playsinline controls autoplay preload="auto"></video>
    <div class="ptop"><button id="back" class="ico">Back</button><span>${esc(m.title)}</span></div>
    <div class="pbar"><button id="rw" class="ico">-${settings.skip}s</button><button id="sp" class="ico">${settings.speed}x</button><button id="fw" class="ico">+${settings.skip}s</button></div>
    <p id="msg" class="muted center">${risky ? "This is an MKV-style file. Safari may not play it." : ""}</p></div>`);
  const v = document.getElementById("v");
  v.src = tg.streamUrl(m);
  v.playbackRate = settings.speed;
  const last = pos[m.id];
  v.addEventListener("loadedmetadata", () => { if (settings.resume && last > 5 && last < v.duration - 30) v.currentTime = last; v.playbackRate = settings.speed; });
  v.addEventListener("timeupdate", () => { pos[m.id] = Math.floor(v.currentTime); if (Math.floor(v.currentTime) % 5 === 0) localStorage.setItem(POS, JSON.stringify(pos)); });
  v.addEventListener("error", () => { document.getElementById("msg").textContent = "This file can't be played in your browser."; });
  document.getElementById("rw").onclick = () => (v.currentTime = Math.max(0, v.currentTime - settings.skip));
  document.getElementById("fw").onclick = () => (v.currentTime += settings.skip);
  document.getElementById("sp").onclick = (e) => {
    const steps = [0.75, 1, 1.25, 1.5, 2];
    settings.speed = steps[(steps.indexOf(settings.speed) + 1) % steps.length];
    v.playbackRate = settings.speed; e.target.textContent = settings.speed + "x"; save();
  };
  document.getElementById("back").onclick = () => { localStorage.setItem(POS, JSON.stringify(pos)); v.pause(); v.removeAttribute("src"); v.load(); back(); };
}

function settingsView() {
  view(`<header class="bar"><button id="b" class="ico">Back</button><b>Settings</b><span></span></header>
    <div class="list">
      <label>Resume where I stopped<input id="r" type="checkbox" ${settings.resume ? "checked" : ""}></label>
      <label>Hide movies without details<input id="h" type="checkbox" ${settings.hide ? "checked" : ""}></label>
      <label>Skip buttons (seconds)<select id="k">${[5, 10, 15, 30].map((n) => `<option ${n === settings.skip ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <button id="clr" class="btn ghost">Clear watch history</button>
      <button id="out" class="btn ghost">Sign out</button>
      <p class="muted center">Signed in as ${esc(rc.email())}</p>
      <p class="muted center">NWFlix iOS 1.0 · Made by Mohammed Rinshan (NIGHTWALKER)</p>
    </div>`);
  document.getElementById("b").onclick = () => home();
  document.getElementById("r").onchange = (e) => { settings.resume = e.target.checked; save(); };
  document.getElementById("h").onchange = (e) => { settings.hide = e.target.checked; save(); };
  document.getElementById("k").onchange = (e) => { settings.skip = Number(e.target.value); save(); };
  document.getElementById("clr").onclick = () => { pos = {}; localStorage.setItem(POS, "{}"); };
  document.getElementById("out").onclick = async () => { await rc.logout(); tg.logout(); };
}

boot();
