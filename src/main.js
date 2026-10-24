import "./style.css";
import * as tg from "./tg.js";

const root = document.getElementById("app");
const LIB = "nwios_lib";
const POS = "nwios_pos";
const SET = "nwios_set";
let library = JSON.parse(localStorage.getItem(LIB) || "[]");
let pos = JSON.parse(localStorage.getItem(POS) || "{}");
let settings = Object.assign({ speed: 1, skip: 10, resume: true }, JSON.parse(localStorage.getItem(SET) || "{}"));
let pending = null;

const save = () => localStorage.setItem(SET, JSON.stringify(settings));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
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

async function boot() {
  if (!tg.hasKeys()) { view('<div class="login"><h1>NWFlix iOS</h1><p class="bad">Telegram keys are missing in this build.</p></div>'); return; }
  view('<div class="login"><div class="spin"></div></div>');
  if (!("serviceWorker" in navigator)) { view('<div class="login"><h1>NWFlix iOS</h1><p class="bad">This browser cannot stream. Update iOS and open this page in Safari.</p></div>'); return; }
  let ok = await tg.resume();
  if (!ok) {
    try { await tg.login(ask); ok = true; } catch (e) { view(`<div class="login"><p class="bad">${esc(tg.friendly(e.message || ""))}</p><button class="btn" onclick="location.reload()">Try again</button></div>`); return; }
  }
  await tg.startStreaming(() => library);
  home();
  if (!library.length) rescan();
}

function home(q = "") {
  const list = library.filter((m) => (m.title + " " + m.name).toLowerCase().includes(q.toLowerCase()));
  view(`<header class="bar"><b>NWFlix iOS</b><div><button id="scan" class="ico">Rescan</button><button id="set" class="ico">Settings</button></div></header>
    <div class="search"><input id="q" type="search" placeholder="Search movies" value="${esc(q)}"></div>
    <p id="status" class="muted"></p>
    <main class="grid">${list.map((m) => `<button class="card" data-id="${esc(m.id)}"><div class="poster">${esc(m.title.slice(0, 1).toUpperCase())}</div>
      <span class="t">${esc(m.title)}</span><span class="s">${m.year || ""} · ${gb(m.size)}</span></button>`).join("")}</main>
    ${list.length ? "" : '<p class="muted center">No movies yet. Tap Rescan.</p>'}`);
  const qi = document.getElementById("q");
  qi.oninput = () => { const v = qi.value; home(v); const n = document.getElementById("q"); n.focus(); n.setSelectionRange(v.length, v.length); };
  document.getElementById("scan").onclick = rescan;
  document.getElementById("set").onclick = settingsView;
  document.querySelectorAll(".card").forEach((c) => (c.onclick = () => play(library.find((m) => m.id === c.dataset.id))));
}

async function rescan() {
  const s = document.getElementById("status");
  if (s) s.textContent = "Scanning your Telegram chats…";
  try {
    library = await tg.scan((n) => { const e = document.getElementById("status"); if (e) e.textContent = "Scanning… " + n + " found"; });
    localStorage.setItem(LIB, JSON.stringify(library));
  } catch (e) {}
  home();
}

function play(m) {
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
  document.getElementById("back").onclick = () => { localStorage.setItem(POS, JSON.stringify(pos)); v.pause(); v.removeAttribute("src"); v.load(); home(); };
}

function settingsView() {
  view(`<header class="bar"><button id="b" class="ico">Back</button><b>Settings</b><span></span></header>
    <div class="list">
      <label>Resume where I stopped<input id="r" type="checkbox" ${settings.resume ? "checked" : ""}></label>
      <label>Skip buttons (seconds)<select id="k">${[5, 10, 15, 30].map((n) => `<option ${n === settings.skip ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <button id="clr" class="btn ghost">Clear watch history</button>
      <button id="out" class="btn ghost">Sign out</button>
      <p class="muted center">NWFlix iOS 1.0 · Made by Mohammed Rinshan (NIGHTWALKER)</p>
    </div>`);
  document.getElementById("b").onclick = () => home();
  document.getElementById("r").onchange = (e) => { settings.resume = e.target.checked; save(); };
  document.getElementById("k").onchange = (e) => { settings.skip = Number(e.target.value); save(); };
  document.getElementById("clr").onclick = () => { pos = {}; localStorage.setItem(POS, "{}"); };
  document.getElementById("out").onclick = () => tg.logout();
}

boot();
