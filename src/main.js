import * as tg from "./tg.js";
import * as rc from "./remote.js";
import * as tmdb from "./tmdb.js";
import * as player from "./player.js";
import * as legal from "./legal.js";
import * as guides from "./guides.js";
import * as cty from "./countries.js";
import * as dl from "./downloads.js";
import { BRAND } from "./brand.js";

const root = document.getElementById("app");
const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const get = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const jp = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v && typeof v === "object" ? v : d; } catch (e) { return d; } };
setTimeout(() => {
  const s = document.getElementById("splash");
  if (s) { s.classList.add("out"); setTimeout(() => s.remove(), 600); }
}, 1600);
const LIB = "nwios_lib";
const POS = "nwios_pos";
const SET = "nwios_set";
let library = jp(LIB, []);
let pos = jp(POS, {});
let settings = Object.assign({ speed: 1, skip: 10, resume: true, hide: true, gestures: true, subSize: 20, subBg: true, stats: true, vol: 1, bright: 1, text: 16, accent: "#B88CFF", buffer: 40, saver: false, sync: true, fit: "contain" }, jp(SET, {}));

const save = () => put(SET, JSON.stringify(settings));
if (settings.v !== 2) { settings.text = 16; settings.v = 2; save(); }
function applyTheme() {
  document.documentElement.style.setProperty("--acc", settings.accent);
  document.documentElement.style.fontSize = settings.text + "px";
  document.body.style.fontSize = "";
}
applyTheme();

function toast(t) {
  const d = document.createElement("div");
  d.className = "toast";
  d.textContent = t;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2600);
}
addEventListener("offline", () => toast("You're offline"));
addEventListener("online", () => toast("Back online"));

const ptr = document.createElement("div");
ptr.id = "ptr";
ptr.textContent = "Pull to refresh";
document.body.appendChild(ptr);
let pullY = null, pullD = 0;
document.addEventListener("touchstart", (e) => { pullY = window.scrollY === 0 && document.getElementById("refresh") ? e.touches[0].clientY : null; pullD = 0; }, { passive: true });
document.addEventListener("touchmove", (e) => {
  if (pullY === null) return;
  pullD = e.touches[0].clientY - pullY;
  if (pullD > 10) { ptr.style.transform = "translate(-50%, " + Math.min(pullD, 110) + "px)"; ptr.textContent = pullD > 80 ? "Release to scan" : "Pull to refresh"; }
}, { passive: true });
document.addEventListener("touchend", () => { if (pullY !== null && pullD > 80) rescan(); pullY = null; ptr.style.transform = ""; });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const LANGS = { tam: "Tamil", tamil: "Tamil", tel: "Telugu", telugu: "Telugu", hin: "Hindi", hindi: "Hindi", mal: "Malayalam", malayalam: "Malayalam", kan: "Kannada", kannada: "Kannada", eng: "English", english: "English", kor: "Korean", korean: "Korean", jap: "Japanese", japanese: "Japanese", chi: "Chinese", chinese: "Chinese", spa: "Spanish", spanish: "Spanish", fre: "French", french: "French", ger: "German", german: "German", ara: "Arabic", arabic: "Arabic", tha: "Thai", thai: "Thai", multi: "Multi audio", dual: "Dual audio" };
const tags = (n) => {
  const t = n.toLowerCase(), o = [];
  const q = /2160p|\b4k\b/.test(t) ? "4K" : /1080p/.test(t) ? "1080p" : /720p/.test(t) ? "720p" : /480p/.test(t) ? "480p" : "";
  if (q) o.push(q);
  if (/x265|hevc/.test(t)) o.push("HEVC");
  t.split(/[^a-z]+/).forEach((w) => { const l = LANGS[w]; if (l && !o.includes(l)) o.push(l); });
  return o;
};
const gb = (b) => (b / 1073741824).toFixed(2) + " GB";
const $ = (id) => document.getElementById(id);

const svg = (d, cls = "fi") => `<svg class="${cls}" viewBox="0 0 24 24"><path d="${d}"/></svg>`;
const IC = {
  back: "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z",
  refresh: "M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
  caret: "M7 10l5 5 5-5z",
  send: "M2.01 21 23 12 2.01 3 2 10l15 2-15 2z",
  help: "M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z",
  movie: "M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z",
  shield: "M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z",
  eyeoff: "M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z",
  person: "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  chev: "M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z",
  close: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  search: "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
  logout: "M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z",
  trash: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
  mail: "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z",
  check: "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  account: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2a7.2 7.2 0 0 1-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 0 1-6 3.22z"
};
const ficon = (k) => svg(IC[k]);
const SPIN = '<span class="spin sm"></span>';

function view(html) { clearInterval(O.timer); clearInterval(heroT); root.innerHTML = html; window.scrollTo(0, 0); }

function dialog(html) {
  const b = document.createElement("div");
  b.className = "cover dim";
  b.style.zIndex = 70;
  b.innerHTML = `<div class="dialog">${html}</div>`;
  const close = () => b.remove();
  b.onclick = (e) => { if (e.target === b) close(); };
  document.body.appendChild(b);
  return { box: b, close };
}

function confirmBox(title, text, ok, onOk) {
  const d = dialog(`<h3>${esc(title)}</h3><p class="dtx">${esc(text)}</p><div class="dact"><button class="tbtn" id="dn">Cancel</button><button class="tbtn" id="dy">${esc(ok)}</button></div>`);
  d.box.querySelector("#dn").onclick = d.close;
  d.box.querySelector("#dy").onclick = () => { d.close(); onOk(); };
}

function choose(title, opts, cur, pick) {
  const d = dialog(`<h3>${esc(title)}</h3><div class="opts">${opts.map(([v, l], i) => `<button class="opt" data-i="${i}"><span class="rad ${String(v) === String(cur) ? "on" : ""}"></span>${esc(l)}</button>`).join("")}</div><div class="dact"><button class="tbtn" id="dx">Close</button></div>`);
  d.box.querySelectorAll(".opt").forEach((b) => (b.onclick = () => { pick(opts[Number(b.dataset.i)][0]); d.close(); }));
  d.box.querySelector("#dx").onclick = d.close;
}

function legalBody(k) {
  const p = legal.PAGES[k];
  return p.sections.map(([h, t], i) => `<h4 class="lh">${i + 1}. ${esc(h)}</h4><p class="lp">${esc(t)}</p>`).join("");
}

function legalOverlay(k) {
  const p = legal.PAGES[k];
  const b = document.createElement("div");
  b.id = "legalov";
  b.innerHTML = `<header class="pbar"><button id="lx" class="pib2" aria-label="Close">${ficon("close")}</button><h2>${esc(p.title)}</h2></header><div class="pbody doc">${legalBody(k)}</div>`;
  document.body.appendChild(b);
  b.querySelector("#lx").onclick = () => b.remove();
}

let installEvt = null, onInstallReady = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; if (onInstallReady) onInstallReady(); });

const isStandalone = () => matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches || navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const SHARE = '<svg class="shr" viewBox="0 0 24 24"><path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 00-1 1v8a1 1 0 001 1h14a1 1 0 001-1v-8a1 1 0 00-1-1h-1"/></svg>';

function installSteps() {
  if (installEvt) return '<button id="ai" class="btn">Install</button>';
  if (isIos()) return `<ol class="steps"><li>Tap the <b>Share</b> button in your browser ${SHARE}</li><li>Scroll down and tap <b>Add to Home Screen</b></li><li>Tap <b>Add</b>, then open <b>NWFlix iOS</b> from your Home Screen</li></ol>`;
  return '<ol class="steps"><li>Tap the <b>menu</b> button of your browser (the three dots)</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b></li><li>Open <b>NWFlix iOS</b> from your Home screen</li></ol>';
}

function installGate() {
  if (isStandalone()) return false;
  const draw = () => {
    view(`<div class="login lg"><img class="lg-logo" src="${BRAND}" width="72" height="72" alt=""><div class="lg-brand">NWFLIX</div>
      <h1>Add NWFlix iOS to your Home Screen</h1>
      <p class="lsub">NWFlix iOS works like a real app. Add it to your Home Screen and open it from there to continue.</p>
      <div class="gatebox">${installSteps()}</div></div>`);
    const ai = $("ai");
    if (ai) ai.onclick = async () => {
      installEvt.prompt();
      const r = await installEvt.userChoice;
      installEvt = null;
      if (r && r.outcome === "accepted") done(); else draw();
    };
  };
  const done = () => view(`<div class="login lg"><img class="lg-logo" src="${BRAND}" width="72" height="72" alt=""><h1>NWFlix iOS is installed</h1><p class="lsub">Open NWFlix iOS from your Home Screen to continue.</p></div>`);
  onInstallReady = () => { if ($("ai") === null && document.querySelector(".gatebox")) draw(); };
  addEventListener("appinstalled", done);
  draw();
  return true;
}

function a2hs() {
  const d = dialog(`<img src="${BRAND}" width="64" height="64" alt="" style="border-radius:16px;align-self:center"><h3 style="text-align:center">Add NWFlix iOS to your Home Screen</h3><p class="dtx">Open it like a real app: full screen, with no browser bar.</p>${isStandalone() ? '<p class="dtx">NWFlix iOS is already on your Home Screen.</p>' : installSteps()}<div class="dact"><button class="tbtn" id="dx">Got it</button></div>`);
  d.box.querySelector("#dx").onclick = d.close;
  const ai = d.box.querySelector("#ai");
  if (ai) ai.onclick = async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; d.close(); };
}

let loginCc = get("nwios_cc") || cty.guess();
let loginPhone = "";
const O = { res: null, state: "idle", timer: 0, setState: null };

function loginHead(h, sub) {
  return `<img class="lg-logo" src="${BRAND}" width="64" height="64" alt=""><div class="lg-brand">NWFLIX</div><h1>${h}</h1><p class="lsub">${sub}</p>`;
}

function infoRows() {
  const row = (ico, t, s) => `<div class="inf"><span class="infi">${ficon(ico)}</span><div><b>${t}</b><small>${s}</small></div></div>`;
  return `<div class="infs">${row("shield", "Secure & encrypted", "Your session is stored only in this browser.")}${row("movie", "Only movies", "Documents and other files are filtered out.")}${row("eyeoff", "Private", "Your chats and movie list stay on your device. Details: Privacy Policy.")}</div>
    <p class="hint c">By continuing you agree to the Terms & Conditions and the Privacy Policy.</p>
    <div class="trow"><button class="tbtn" id="lt">Terms & Conditions</button><button class="tbtn" id="lp">Privacy Policy</button></div>
    <p class="hint c">Only use NWFlix iOS with content you are allowed to watch.</p>`;
}

function pickCountry() {
  const b = document.createElement("div");
  b.className = "cover dim";
  b.style.zIndex = 70;
  b.innerHTML = `<div class="cdlg"><div class="cdh"><b>Select country</b><button id="cx" class="pib2" aria-label="Close">${ficon("close")}</button></div>
    <input id="cq" type="search" placeholder="Search country or code" autocomplete="off"><div id="cl" class="clist"></div></div>`;
  document.body.appendChild(b);
  const draw = () => {
    const t = $("cq").value.trim().replace(/^\+/, "").toLowerCase();
    const list = !t ? cty.ALL : cty.ALL.filter((c) => c.name.toLowerCase().includes(t) || c.dial.startsWith(t) || c.iso.toLowerCase() === t);
    $("cl").innerHTML = list.map((c) => `<button class="crow ${c.iso === loginCc ? "on" : ""}" data-i="${c.iso}"><span class="cf">${c.flag}</span><span class="cn">${esc(c.name)}</span><span class="cd">+${c.dial}</span></button>`).join("");
    $("cl").querySelectorAll(".crow").forEach((r) => (r.onclick = () => { loginCc = r.dataset.i; put("nwios_cc", loginCc); b.remove(); paintCc(); }));
  };
  $("cq").oninput = draw;
  $("cx").onclick = () => b.remove();
  b.onclick = (e) => { if (e.target === b) b.remove(); };
  draw();
}

function paintCc() {
  const c = cty.find(loginCc);
  const b = $("cc");
  if (b) b.innerHTML = `<span class="cf">${c.flag}</span><b>+${c.dial}</b>${ficon("caret")}`;
  const h = $("cchint");
  if (h) h.textContent = c.name + " is selected. Type your number without the country code.";
}

function phoneScreen(text) {
  view(`<div class="login lg">${loginHead("Connect with Telegram", "Log in with your Telegram account to access your movies.")}
    <div class="phone"><button id="cc" class="ccb"></button><input id="v" type="tel" inputmode="tel" placeholder="Phone number" autocomplete="tel-national" maxlength="18" value="${esc(loginPhone)}"></div>
    <p id="cchint" class="hint"></p>
    <p id="err" class="bad">${esc(text || "")}</p>
    <button id="go" class="btn lgbtn">${ficon("send")}<span>Login with Telegram</span></button>
    <button id="h1" class="tbtn">${ficon("help")}How does login work?</button>
    <button id="h2" class="tbtn">${ficon("movie")}How do I get movies in NWFlix?</button>
    ${infoRows()}</div>`);
  paintCc();
  const input = $("v"), go = $("go");
  const ok = () => { go.disabled = input.value.replace(/\D/g, "").length <= 5; };
  ok();
  $("cc").onclick = pickCountry;
  $("h1").onclick = () => guides.openGuide("otp");
  $("h2").onclick = () => guides.openGuide("movies");
  $("lt").onclick = () => legalOverlay("terms");
  $("lp").onclick = () => legalOverlay("privacy");
  return new Promise((res) => {
    const submit = () => {
      if (go.disabled) return;
      loginPhone = input.value;
      go.disabled = true;
      go.innerHTML = SPIN;
      res(cty.fullNumber(cty.find(loginCc), input.value));
    };
    input.oninput = () => { input.value = input.value.replace(/[^\d +]/g, ""); ok(); };
    input.onkeydown = (e) => { if (e.key === "Enter") submit(); };
    go.onclick = submit;
  });
}

function renderCode() {
  view(`<div class="login lg">${loginHead("Connect with Telegram", "Enter the code Telegram just sent to your Telegram app (or SMS).")}
    <div id="otp" class="otp"><div id="boxes" class="boxes">${"<i></i>".repeat(5)}</div><input id="v" type="tel" inputmode="numeric" autocomplete="one-time-code" maxlength="5"></div>
    <p id="otpmsg" class="otpmsg">Type the 5-digit code</p>
    <button id="tgb" class="btn ghost lgbtn">${ficon("send")}<span>Open Telegram to see the code</span></button>
    <div class="trow"><button id="rs" class="tbtn" disabled>Resend code in 30s</button><button id="gd" class="tbtn">Didn't get the code?</button></div>
    ${infoRows()}</div>`);
  const input = $("v"), wrap = $("boxes"), msg = $("otpmsg"), rs = $("rs");
  const boxes = [...wrap.querySelectorAll("i")];
  O.res = null;
  O.state = "idle";
  const paint = () => boxes.forEach((b, i) => {
    const d = input.value[i] || "";
    b.textContent = d;
    b.className = O.state === "idle" ? (i === Math.min(input.value.length, 4) ? "cur" : d ? "fill" : "") : "";
  });
  O.setState = (s, t) => {
    O.state = s;
    wrap.className = "boxes" + (s === "idle" ? "" : " " + s);
    msg.className = "otpmsg" + (s === "wrong" ? " bad" : "");
    msg.textContent = t || (s === "checking" ? "Checking the code…" : "Type the 5-digit code");
    input.readOnly = s !== "idle";
    if (s === "idle") { try { input.focus(); } catch (e) {} }
    paint();
  };
  O.countdown = () => {
    clearInterval(O.timer);
    let left = 30;
    rs.disabled = true;
    rs.textContent = "Resend code in 30s";
    O.timer = setInterval(() => {
      left--;
      if (left <= 0) { clearInterval(O.timer); rs.disabled = false; rs.textContent = "Resend code"; }
      else rs.textContent = "Resend code in " + left + "s";
    }, 1000);
  };
  O.countdown();
  input.oninput = () => {
    if (O.state !== "idle") return;
    input.value = input.value.replace(/\D/g, "").slice(0, 5);
    paint();
    if (input.value.length === 5 && O.res) { const r = O.res; O.res = null; O.setState("checking"); r(input.value); }
  };
  rs.onclick = () => { if (!O.res) return; const r = O.res; O.res = null; clearInterval(O.timer); r("__resend__"); };
  $("gd").onclick = () => guides.openGuide("otp");
  $("lt").onclick = () => legalOverlay("terms");
  $("lp").onclick = () => legalOverlay("privacy");
  $("tgb").onclick = () => {
    const t = setTimeout(() => { if (!document.hidden) toast("Telegram is not installed on this phone"); }, 1800);
    document.addEventListener("visibilitychange", () => clearTimeout(t), { once: true });
    location.href = "tg://";
  };
  setTimeout(() => { try { input.focus(); } catch (e) {} }, 50);
}

function codeScreen(text) {
  if (!$("otp")) renderCode();
  const input = $("v");
  return new Promise((res) => {
    O.res = res;
    if (!text) { O.setState("idle"); return; }
    if (/^A new code/.test(text)) { input.value = ""; O.setState("idle", text); O.countdown(); return; }
    O.setState("wrong", text);
    if (/wrong/i.test(text)) setTimeout(() => { input.value = ""; O.setState("idle"); }, 1100);
    else setTimeout(() => { input.value = ""; O.setState("idle", text); $("otpmsg").className = "otpmsg bad"; }, 1100);
  });
}

function passScreen(text) {
  view(`<div class="login lg">${loginHead("Connect with Telegram", "Your account has two-step verification. Enter your password.")}
    <input id="v" class="pw" type="password" placeholder="Password" autocomplete="off">
    <p id="err" class="bad">${esc(text || "")}</p><button id="go" class="btn lgbtn">Continue</button></div>`);
  const input = $("v");
  input.focus();
  return new Promise((res) => {
    const done = () => { const v = input.value.trim(); if (v) { $("go").disabled = true; res(v); } };
    $("go").onclick = done;
    input.onkeydown = (e) => { if (e.key === "Enter") done(); };
  });
}

function ask(kind, text) {
  if (kind === "error") {
    const e = $("err");
    if (e) e.textContent = text;
    const g = $("go");
    if (g) g.disabled = false;
    return;
  }
  if (kind === "code") return codeScreen(text);
  if (kind === "phone") return phoneScreen(text);
  return passScreen(text);
}

async function gate() {
  if (await rc.ready()) return;
  view(`<div class="login lg"><img class="lg-logo" src="${BRAND}" width="72" height="72" alt=""><div class="lg-brand">NWFLIX</div><h1>One last step</h1><p class="lsub">Sign in with your email</p>
    <button id="g" class="btn lgbtn">Continue with Google</button><p id="err" class="bad"></p></div>`);
  await new Promise((res) => {
    $("g").onclick = async () => {
      try { await rc.signInGoogle(); res(); }
      catch (e) { if (e.message !== "Cancelled") $("err").textContent = e.message; }
    };
  });
}

function regionOk(list) {
  if (!list) return true;
  const langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""]);
  const here = (langs.map((l) => (l.split("-")[1] || "")).find(Boolean) || "").toUpperCase();
  if (!here) return true;
  return list.split(",").some((x) => x.trim().toUpperCase() === here);
}

function applyRemote(c) {
  let box = $("remote");
  if (!box) { box = document.createElement("div"); box.id = "remote"; document.body.appendChild(box); }
  if (c.maintenanceOn) {
    box.className = "cover";
    box.innerHTML = `<h1>${esc(c.maintenanceTitle || "We'll be right back")}</h1><p class="muted">${esc(c.maintenanceMessage || "NWFlix is being updated. Please try again in a little while.")}</p>`;
    return;
  }
  const live = c.annId && regionOk(c.annCountry) && get("nwios_ann") !== c.annId && (!c.annExpiresAt || Date.now() < c.annExpiresAt);
  if (!live) { box.className = ""; box.innerHTML = ""; return; }
  const link = c.annButtonText && c.annButtonUrl.startsWith("https://");
  box.className = "cover dim";
  box.innerHTML = `<div class="dialog"><h3>${esc(c.annTitle || "NWFlix")}</h3><p class="dtx">${esc(c.annMessage)}</p>
    <div class="dact">${c.annDismissible || !link ? `<button id="ac" class="tbtn">${link ? "Later" : "OK"}</button>` : ""}${link ? `<a id="ab" class="tbtn" href="${esc(c.annButtonUrl)}" target="_blank" rel="noopener">${esc(c.annButtonText)}</a>` : ""}</div></div>`;
  const close = () => { put("nwios_ann", c.annId); applyRemote(Object.assign({}, c, { annId: "" })); };
  const ac = $("ac"); if (ac) ac.onclick = close;
  const ab = $("ab"); if (ab) ab.onclick = () => setTimeout(close, 300);
}

function offlineView() {
  view(`<div class="login"><svg class="nowifi" viewBox="0 0 24 24"><path d="M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0M12 19.5v.5M3 3l18 18"/></svg>
    <h1>No connection</h1><p class="muted center">NWFlix can't reach Telegram right now. Check your internet and try again.</p>
    <button class="btn" onclick="location.reload()">Retry</button></div>`);
}

const isKey = (k) => /^[ts]\d+$/.test(k);

function touchSync() {
  put("nwios_syncT", String(Date.now()));
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushSync, 5000);
}

async function pushSync() {
  if (!settings.sync) return;
  const keep = (o) => Object.keys(o).filter((k) => o[k] && isKey(k));
  const p = {};
  Object.entries(pos).forEach(([k, v]) => { if (v > 5) p[k] = v; });
  try { await rc.pushSync({ wl: keep(ud.wl), fav: keep(ud.fav), seen: Object.keys(ud.seen), pos: p, time: wt, t: Number(localStorage.getItem("nwios_syncT") || 0) }); } catch (e) {}
}

async function syncPull() {
  try {
    const r = await rc.pullSync();
    const local = Number(localStorage.getItem("nwios_syncT") || 0);
    if (r && r.t > local) {
      const mix = (cur, list) => { const o = {}; Object.keys(cur).forEach((k) => { if (!isKey(k) && cur[k]) o[k] = true; }); list.forEach((k) => (o[k] = true)); return o; };
      ud.wl = mix(ud.wl, r.wl || []);
      ud.fav = mix(ud.fav, r.fav || []);
      ud.seen = Object.fromEntries((r.seen || []).map((k) => [k, 1]));
      Object.keys(pos).forEach((k) => delete pos[k]);
      Object.assign(pos, r.pos || {});
      Object.keys(wt).forEach((k) => delete wt[k]);
      Object.assign(wt, r.time || {});
      put("nwios_user", JSON.stringify(ud));
      put(POS, JSON.stringify(pos));
      put("nwios_time", JSON.stringify(wt));
      put("nwios_syncT", String(r.t));
      if (onHome()) home();
    } else if (local > (r ? r.t : 0)) pushSync();
  } catch (e) {}
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) { if (syncTimer) { clearTimeout(syncTimer); syncTimer = 0; pushSync(); } return; }
  if (scanning) grabWake();
  else if (booted && get("nwios_scanning") === "1") rescan();
});

let booted = false;

async function boot() {
  if (installGate()) return;
  if (!tg.hasKeys()) { view('<div class="login"><h1>NWFlix iOS</h1><p class="bad">Telegram keys are missing in this build.</p></div>'); return; }
  if (!navigator.onLine) { if (dl.all().some((d) => d.state === "done")) downloadsView(true); else offlineView(); return; }
  if (!tg.hasSession()) await rc.logout();
  view('<div class="login"><div class="spin"></div></div>');
  if (!("serviceWorker" in navigator)) { view('<div class="login"><h1>NWFlix iOS</h1><p class="bad">This browser cannot stream. Update iOS and open this page in Safari.</p></div>'); return; }
  const resumed = await tg.resume();
  if (resumed === "error") { offlineView(); return; }
  if (!resumed) {
    try { await tg.login(ask); } catch (e) { view(`<div class="login"><p class="bad">${esc(tg.friendly(e.message || ""))}</p><button class="btn" onclick="location.reload()">Try again</button></div>`); return; }
  }
  await gate();
  rc.watchConfig(applyRemote);
  if (settings.sync) syncPull();
  if (settings.stats) rc.heartbeat();
  tg.me().then((n) => { userName = n; });
  await tg.startStreaming(() => library);
  booted = true;
  home();
  dl.resumeAll();
  if (get("nwios_nm") !== "1") {
    library.forEach((x) => { if (x.tmdb > 0 && x.tname === undefined) x.tname = x.name; });
    put(LIB, JSON.stringify(library));
    cursor = {};
    put("nwios_cur", "{}");
    put("nwios_nm", "1");
    put("nwios_scanning", "1");
  }
  const unfinished = get("nwios_scanning") === "1";
  if (!library.length) rescan(); else { enrichAll(); rescan({ quiet: !unfinished }); }
}

const ud = Object.assign({ fav: {}, wl: {}, seen: {} }, jp("nwios_user", {}));
const saveUd = () => { put("nwios_user", JSON.stringify(ud)); touchSync(); };
let scanNote = "";
let userName = "";
let cursor = jp("nwios_cur", {});
let scanning = false, restoreY = null, syncTimer = 0;
const scanSt = { on: false, phase: "", found: 0, quiet: false };
const wt = jp("nwios_time", {});
let sortBy = "added", fGenre = "", fLang = "", fQual = "", fType = "", exQ = "";
let curDetail = "", heroT = 0, dlTab = "run";
const lastPl = jp("nwios_last", {});
const opened = jp("nwios_open", {});
let baseAt = Number(get("nwios_base") || 0);
if (!baseAt) { baseAt = Date.now(); put("nwios_base", String(baseAt)); }
const enrSt = { on: false, n: 0, t: 0 };
const onHome = () => !!$("refresh");
const onExplore = () => !!$("exq");

const fi = (d) => `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>`;
const ICONS = {
  all: fi("M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"),
  ex: fi("M12 10.9c-.61 0-1.1.49-1.1 1.1s.49 1.1 1.1 1.1c.61 0 1.1-.49 1.1-1.1s-.49-1.1-1.1-1.1zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm2.19 12.19L6 18l3.81-8.19L18 6l-3.81 8.19z"),
  dl: fi("M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"),
  lib: fi("M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"),
  set: fi("M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z")
};
const DP = {
  heartOff: "M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z",
  heartOn: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
  eye: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z",
  add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
  down: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
  pause: "M6 19h4V5H6v14zm8-14v14h4V5h-4z",
  play: "M8 5v14l11-7z",
  check: "M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
  clapper: "M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z",
  info: "M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
};
const dpi = (k) => svg(DP[k]);

const SORTS = {
  added: (a, b) => b.at - a.at,
  popular: (a, b) => (b.v.pop || 0) - (a.v.pop || 0) || (b.v.rating || 0) - (a.v.rating || 0),
  rating: (a, b) => (b.v.rating || 0) - (a.v.rating || 0),
  year: (a, b) => (b.v.year || 0) - (a.v.year || 0) || b.at - a.at,
  az: (a, b) => title(a.v).localeCompare(title(b.v)),
  longest: (a, b) => (b.v.runtime || 0) - (a.v.runtime || 0)
};
const SORT_NAMES = { added: "Recently added", popular: "Most popular", rating: "Rating", year: "Release year", az: "A to Z", longest: "Longest" };
const QUALITIES = ["4K", "1080p", "720p", "480p"];

function groups() {
  const map = new Map();
  for (const f of library) {
    const k = f.tmdb > 0 ? (f.series ? "s" : "t") + f.tmdb : "n" + f.title.toLowerCase().replace(/[^a-z0-9]/g, "") + f.year;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(f);
  }
  return [...map.entries()].map(([key, files]) => ({ key, files, v: files.find((f) => f.tmdb > 0) || files[0], at: Math.max(...files.map((f) => f.at)) }));
}

const isSeries = (g) => g.v.series || g.v.season > 0;
const byKey = (k) => groups().find((g) => g.key === k);
const title = (m) => m.tname || m.title;
const year = (m) => m.year || "";
const watched = (g) => g.files.every((f) => ud.seen[f.id]);
const started = (g) => g.files.some((f) => (pos[f.id] || 0) > 5 && !ud.seen[f.id]);
const lastOf = (g) => Math.max(0, ...g.files.map((f) => lastPl[f.id] || 0));
const matchedG = (g) => g.v.tmdb > 0;
const percent = (g) => {
  const f = g.files.filter((x) => (pos[x.id] || 0) > 5 && x.dur).sort((a, b) => pos[b.id] - pos[a.id])[0];
  return f ? Math.min(100, Math.round((pos[f.id] / f.dur) * 100)) : 0;
};
const mins = (n) => (n ? Math.floor(n / 60) + "h " + (n % 60) + "m" : "");

function cardHtml(g, bar) {
  const v = g.v;
  const badge = isSeries(g) ? episodes(g).length + " eps" : g.files.length > 1 ? g.files.length + " files" : "";
  const fresh = g.at > baseAt && !opened[g.key];
  return `<button class="card" data-k="${esc(g.key)}"><div class="poster">${v.poster ? `<img src="${tmdb.img(v.poster)}" loading="lazy" alt="">` : esc(title(v).slice(0, 1).toUpperCase())}${badge ? `<i class="chip1">${badge}</i>` : ""}${fresh ? '<i class="newc">NEW</i>' : ""}${v.rating ? `<i class="rate"><b>★</b> ${v.rating.toFixed(1)}</i>` : ""}${watched(g) ? '<i class="tick">✓</i>' : ""}${bar ? `<i class="prog" style="width:${percent(g)}%"></i>` : ""}</div>
    <span class="t">${esc(title(v))}</span><span class="s">${year(v)}</span></button>`;
}

const TABS = [["all", "Home"], ["ex", "Explore"], ["dl", "Downloads"], ["lib", "My List"], ["set", "Settings"]];
const tabsHtml = (on) => `<div class="tail"></div><nav class="tabs">${TABS.map(([k, n]) => `<button data-t="${k}" class="${k === on ? "on" : ""}">${ICONS[k]}<span>${n}</span></button>`).join("")}</nav>`;
const bindTabs = () => document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => {
  const k = b.dataset.t;
  if (k === "lib") libraryView(); else if (k === "set") settingsView(); else if (k === "ex") explore(); else if (k === "dl") downloadsView(); else home();
}));
let libTab = "wl";

function libraryView() {
  const all = groups();
  const sets = { wl: all.filter((g) => ud.wl[g.key]), fav: all.filter((g) => ud.fav[g.key]), hist: all.filter((g) => watched(g) || started(g)) };
  const info = { wl: ["Your list is empty", "Open a movie and tap My List."], fav: ["No favorites yet", "Tap the heart on a movie page to keep it here."], hist: ["Nothing watched yet", "Movies you start will show up here."] };
  const list = sets[libTab].slice().sort(libTab === "hist" ? (a, b) => lastOf(b) - lastOf(a) : SORTS.added);
  view(`<h1 class="shead">My List</h1>
    <div class="seg">${[["wl", "My List"], ["fav", "Favorites"], ["hist", "History"]].map(([k, n]) => `<button data-s="${k}" class="${k === libTab ? "on" : ""}">${n} <small>${sets[k].length}</small></button>`).join("")}</div>
    <main class="grid">${list.map((g) => cardHtml(g, libTab === "hist")).join("")}</main>
    ${list.length ? "" : `<div class="empty">${svg(DP.clapper, "fi big")}<b>${info[libTab][0]}</b><p class="muted center">${info[libTab][1]}</p></div>`}
    ${tabsHtml("lib")}`);
  document.querySelectorAll(".seg button").forEach((b) => (b.onclick = () => { libTab = b.dataset.s; libraryView(); }));
  document.querySelectorAll(".card").forEach((c) => (c.onclick = () => detail(byKey(c.dataset.k), libraryView)));
  bindTabs();
}

const isBusy = () => (scanSt.on && !scanSt.quiet) || enrSt.on;

function statusLine() {
  if (scanSt.on && !scanSt.quiet && (!library.length || scanSt.found > 0)) return scanSt.phase + "  •  " + scanSt.found + " found";
  if (enrSt.on) return "Fetching movie details…  •  " + enrSt.n + " / " + enrSt.t;
  return scanNote;
}

function paintStatus() {
  const e = $("status");
  const t = statusLine();
  if (e) e.innerHTML = t ? (isBusy() ? SPIN : "") + "<span>" + esc(t) + "</span>" : "";
  const r = $("refresh");
  if (r) r.innerHTML = scanSt.on && !scanSt.quiet ? SPIN : svg(IC.refresh);
}

const rowHtml = (name, list, sort) => `<div class="sh"><h3>${esc(name)}</h3>${sort ? `<button class="sa" data-sort="${sort}">See all</button>` : ""}</div><div class="row">${list.map((g) => cardHtml(g, name === "Continue Watching")).join("")}</div>`;

function heroHtml(list) {
  return `<div class="hero2" id="hero">${list.map((g) => `<div class="hs" data-k="${esc(g.key)}" style="background-image:linear-gradient(#0000 35%, #010314f2), url(${tmdb.img(g.v.backdrop, "w780")})"><div class="hsc"><h2>${esc(title(g.v))}</h2><p>${esc([g.v.year, (g.v.genres || "").split(", ").slice(0, 2).join(" • "), mins(g.v.runtime)].filter(Boolean).join("  •  "))}</p><div class="hsb"><span class="btn small" data-w="${esc(g.key)}">${dpi("play")}Watch Now</span><span class="tonal" data-l="${esc(g.key)}">${dpi(ud.wl[g.key] ? "check" : "add")}</span></div></div></div>`).join("")}</div>`;
}

function becauseRows(gs) {
  const seeds = gs.filter((g) => matchedG(g) && lastOf(g) > 0 && g.v.genres).sort((a, b) => lastOf(b) - lastOf(a));
  const cands = gs.filter((g) => matchedG(g) && lastOf(g) === 0 && !watched(g) && g.v.genres);
  const out = [], used = new Set();
  for (const s of seeds) {
    if (out.length >= 2) break;
    const sg = new Set(s.v.genres.toLowerCase().split(", "));
    const need = Math.min(2, sg.size);
    const list = cands.filter((c) => !used.has(c.key) && isSeries(c) === isSeries(s))
      .map((c) => [c, c.v.genres.toLowerCase().split(", ").filter((x) => sg.has(x)).length]).filter((x) => x[1] >= need)
      .sort((a, b) => b[1] - a[1] || (b[0].v.rating || 0) - (a[0].v.rating || 0)).slice(0, 20).map((x) => x[0]);
    if (list.length >= 3) { out.push([s, list]); list.forEach((c) => used.add(c.key)); }
  }
  return out;
}

function home() {
  curDetail = "";
  const all = groups();
  const hide = settings.hide && tmdb.hasKey();
  const gs = hide ? all.filter(matchedG) : all;
  const matched = gs.filter(matchedG);
  const unmatchedN = all.filter((g) => !matchedG(g)).length;
  const featured = matched.filter((g) => g.v.backdrop).sort(SORTS.popular).slice(0, 5);
  const cont = gs.filter((g) => lastOf(g) > 0 && started(g) && !watched(g)).sort((a, b) => lastOf(b) - lastOf(a));
  const pool = matched.filter((g) => g.v.backdrop && !watched(g)).sort((a, b) => String(a.v.tmdb).localeCompare(String(b.v.tmdb)));
  const d = new Date();
  const motd = pool.length < 3 ? null : pool[((d.getFullYear() * 366 + Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5)) * 7919) % pool.length];
  const series = gs.filter(isSeries).sort(SORTS.added);
  const recent = gs.slice().sort(SORTS.added);
  const busy = scanSt.on && !scanSt.quiet;
  let body = "";
  if (!gs.length) {
    body = busy
      ? `<div class="empty">${svg(DP.clapper, "fi big")}<b>Looking for your movies…</b><p class="muted center">Large chats can take a minute the first time.</p></div>`
      : `<div class="empty">${svg(DP.clapper, "fi big")}<b>No movies found yet</b><p class="muted center">NWFlix looks for long videos and big video files in the chats and channels you can access.</p><button id="again" class="btn small">Scan again</button></div>`;
  } else {
    body = (featured.length ? heroHtml(featured) : "") +
      (motd ? `<div class="motd" data-k="${esc(motd.key)}" style="background-image:linear-gradient(#0000 25%, #010314f2), url(${tmdb.img(motd.v.backdrop, "w780")})"><div><small>MOVIE OF THE DAY</small><h3>${esc(title(motd.v))}</h3><p>${esc([motd.v.year, (motd.v.genres || "").split(", ").slice(0, 2).join(" • "), motd.v.rating ? "★ " + motd.v.rating.toFixed(1) : ""].filter(Boolean).join("  •  "))}</p></div></div>` : "") +
      (cont.length ? rowHtml("Continue Watching", cont) : "") +
      becauseRows(gs).map(([s, l]) => rowHtml("Because you watched " + title(s.v), l)).join("") +
      (matched.length ? rowHtml("Trending Now", matched.slice().sort(SORTS.popular).slice(0, 60), "popular") : "") +
      (matched.some((g) => g.v.rating > 0) ? rowHtml("Top Rated", matched.filter((g) => g.v.rating > 0).sort(SORTS.rating).slice(0, 60), "rating") : "") +
      (matched.length ? rowHtml("New Releases", matched.slice().sort(SORTS.year).slice(0, 60), "year") : "") +
      (series.length ? rowHtml("TV Series", series.slice(0, 60)) : "") +
      rowHtml("Recently Added (" + recent.length + ")", recent.slice(0, 80), "added") +
      (hide && unmatchedN ? `<button class="notice" id="unm"><span>${unmatchedN} ${unmatchedN === 1 ? "file has" : "files have"} no movie details yet. Review them in Explore.</span>${svg(IC.chev, "fi")}</button>` : "");
  }
  view(`<header class="bar"><img class="bmark" src="${BRAND}" alt=""><span class="bname">NWFLIX</span><div class="hb"><button id="refresh" class="ib" aria-label="Refresh">${busy ? SPIN : svg(IC.refresh)}</button><button id="srch" class="ib" aria-label="Search">${svg(IC.search)}</button><button id="av" class="avs" aria-label="Settings">${esc((userName || "N")[0].toUpperCase())}</button></div></header>
    <div id="rmenu" class="menu hidden"><button id="m1">Check for new movies</button><button id="m2">Full rescan (slower)</button></div>
    <div id="status" class="stat-row"></div>
    ${body}
    ${tabsHtml("all")}`);
  paintStatus();
  const menu = $("rmenu");
  $("refresh").onclick = (e) => {
    e.stopPropagation();
    menu.classList.toggle("hidden");
    if (!menu.classList.contains("hidden")) document.addEventListener("click", () => menu.classList.add("hidden"), { once: true });
  };
  $("m1").onclick = () => { menu.classList.add("hidden"); rescan(); toast("Checking for new movies…"); };
  $("m2").onclick = () => { menu.classList.add("hidden"); rescan({ full: true }); toast("Full scan started"); };
  $("srch").onclick = () => { exQ = ""; explore(true); };
  $("av").onclick = settingsView;
  const ag = $("again");
  if (ag) ag.onclick = () => rescan({ full: true });
  const un = $("unm");
  if (un) un.onclick = () => { fGenre = "Unmatched"; sortBy = "added"; explore(); };
  document.querySelectorAll(".sa").forEach((b) => (b.onclick = () => { sortBy = b.dataset.sort; fGenre = ""; fLang = ""; fQual = ""; fType = ""; exQ = ""; explore(); }));
  const open = (k) => { const y = window.scrollY; detail(byKey(k), () => { restoreY = y; home(); }); };
  document.querySelectorAll(".card, .motd").forEach((c) => (c.onclick = () => open(c.dataset.k)));
  document.querySelectorAll(".hs").forEach((c) => (c.onclick = (e) => {
    const l = e.target.closest("[data-l]");
    if (l) { ud.wl[l.dataset.l] = !ud.wl[l.dataset.l]; saveUd(); l.innerHTML = dpi(ud.wl[l.dataset.l] ? "check" : "add"); return; }
    open(c.dataset.k);
  }));
  const hero = $("hero");
  if (hero && hero.children.length > 1) {
    heroT = setInterval(() => {
      const h = $("hero");
      if (!h) { clearInterval(heroT); return; }
      const step = h.children[1].offsetLeft - h.children[0].offsetLeft;
      const i = (Math.round(h.scrollLeft / step) + 1) % h.children.length;
      h.scrollTo({ left: i * step, behavior: "smooth" });
    }, 6000);
  }
  bindTabs();
  if (restoreY !== null) { window.scrollTo(0, restoreY); restoreY = null; }
}

const EXI = {
  sort: "M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z",
  filter: "M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z",
  shuffle: "M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"
};

function filterDialog(langs) {
  let l = fLang, q = fQual, t = fType;
  const chips = (arr, cur, k) => arr.map((x) => `<button class="fc ${x === cur ? "on" : ""}" data-k="${k}" data-v="${esc(x)}">${esc(x)}</button>`).join("");
  const d = dialog(`<h3>Filters</h3>
    ${langs.length ? `<h4 class="fh">Language</h4><div class="fcs">${chips(langs, l, "l")}</div>` : ""}
    <h4 class="fh">Quality</h4><div class="fcs">${chips(QUALITIES, q, "q")}</div>
    <h4 class="fh">Type</h4><div class="fcs">${chips(["Movies", "Series"], t, "t")}</div>
    <div class="dact"><button class="tbtn" id="fr">Reset</button><button class="tbtn" id="fa">Apply</button></div>`);
  d.box.querySelectorAll(".fc").forEach((b) => (b.onclick = () => {
    const k = b.dataset.k, v = b.dataset.v;
    const on = b.classList.contains("on");
    d.box.querySelectorAll('.fc[data-k="' + k + '"]').forEach((x) => x.classList.remove("on"));
    if (!on) b.classList.add("on");
    const val = on ? "" : v;
    if (k === "l") l = val; else if (k === "q") q = val; else t = val;
  }));
  d.box.querySelector("#fr").onclick = () => { fLang = ""; fQual = ""; fType = ""; d.close(); explore(); };
  d.box.querySelector("#fa").onclick = () => { fLang = l; fQual = q; fType = t; d.close(); explore(); };
}

function explore(focus) {
  curDetail = "";
  const all = groups();
  const ql = exQ.toLowerCase();
  const list = all.filter((g) =>
    (!ql || (title(g.v) + " " + (g.v.cast || []).map((c) => c.n).join(" ") + " " + g.files.map((f) => f.name).join(" ")).toLowerCase().includes(ql)) &&
    (!fGenre || (fGenre === "Unmatched" ? !matchedG(g) : (g.v.genres || "").includes(fGenre))) &&
    (!fLang || g.files.some((f) => tags(f.name).includes(fLang))) &&
    (!fQual || g.files.some((f) => tags(f.name).includes(fQual))) &&
    (!fType || (fType === "Series") === isSeries(g))
  ).sort(SORTS[sortBy]);
  const count = new Map();
  all.forEach((g) => (g.v.genres || "").split(", ").filter(Boolean).forEach((x) => count.set(x, (count.get(x) || 0) + 1)));
  const genres = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map((x) => x[0]);
  const unm = all.filter((g) => !matchedG(g)).length;
  const langs = [...new Set(all.flatMap((g) => g.files.flatMap((f) => tags(f.name))))].filter((x) => !QUALITIES.includes(x) && x !== "HEVC").sort();
  const nf = (fLang ? 1 : 0) + (fQual ? 1 : 0) + (fType ? 1 : 0);
  const gchip = (v, n) => `<button class="gc ${fGenre === v ? "on" : ""}" data-g="${esc(v)}">${esc(n)}</button>`;
  view(`<header class="ehead"><h1>Explore</h1><button id="exs" class="ib" aria-label="Search">${svg(IC.search)}</button></header>
    <div id="exsb" class="search ${exQ || focus ? "" : "hidden"}"><input id="exq" type="search" placeholder="Search movies or cast" value="${esc(exQ)}"></div>
    <div class="gchips">${gchip("", "All")}${unm ? gchip("Unmatched", "Unmatched · " + unm) : ""}${genres.map((x) => gchip(x, x)).join("")}</div>
    <div class="erow"><button id="esort" class="ech on">${svg(EXI.sort)}${esc(SORT_NAMES[sortBy])}</button><button id="efil" class="ech ${nf ? "on" : ""}">${svg(EXI.filter)}Filters${nf ? " · " + nf : ""}</button><span class="sp"></span><button id="eshuf" class="ib" aria-label="Surprise me">${svg(EXI.shuffle)}</button><span class="ecount">${list.length} ${list.length === 1 ? "title" : "titles"}</span></div>
    <main class="grid">${list.map((g) => cardHtml(g, false)).join("")}</main>
    ${list.length ? "" : '<p class="muted center">Nothing matches.</p>'}
    ${tabsHtml("ex")}`);
  const qi = $("exq");
  qi.oninput = () => { exQ = qi.value; explore(true); };
  if (focus) { qi.focus(); qi.setSelectionRange(exQ.length, exQ.length); }
  $("exs").onclick = () => { $("exsb").classList.toggle("hidden"); if (!$("exsb").classList.contains("hidden")) qi.focus(); };
  document.querySelectorAll(".gc").forEach((b) => (b.onclick = () => { fGenre = b.dataset.g; explore(); }));
  $("esort").onclick = () => choose("Sort by", Object.entries(SORT_NAMES), sortBy, (v) => { sortBy = v; explore(); });
  $("efil").onclick = () => filterDialog(langs);
  $("eshuf").onclick = () => { if (list.length) detail(list[Math.floor(Math.random() * list.length)], () => explore()); };
  bindTabs();
  document.querySelectorAll(".card").forEach((c) => (c.onclick = () => detail(byKey(c.dataset.k), () => explore())));
}

const ringHtml = (e) => {
  if (!e) return dpi("down");
  if (e.state === "done") return dpi("check");
  if (e.state === "paused" || e.state === "error") return dpi("play");
  const p = e.size ? Math.round((e.done / e.size) * 100) : 0;
  return `<span class="pct">${p}%</span>`;
};

function paintDlButtons() {
  document.querySelectorAll(".dlb").forEach((b) => { b.innerHTML = ringHtml(dl.get(b.dataset.id)); });
}

function dlAction(f, g) {
  const e = dl.get(f.id);
  if (!e) {
    if (!dl.supported()) { toast("Downloads are not supported in this browser"); return; }
    dl.start({ id: f.id, chat: f.chat, msg: f.msg, name: f.name, size: f.size, mime: f.mime, title: f.title }, { title: title(g.v), year: g.v.year, poster: g.v.poster, key: g.key, label: fileLine(f) });
    toast("Download started");
  } else if (e.state === "done") {
    confirmBox("Remove download?", "The offline copy of this file will be deleted from this device.", "Remove", () => dl.remove(f.id));
  } else if (e.state === "paused" || e.state === "error") dl.resume(f.id);
  else dl.pause(f.id);
}

function dlRow(d, done) {
  const p = d.size ? Math.round((d.done / d.size) * 100) : 0;
  const sub = done ? [d.label, sz(d.size)].filter(Boolean).join(" • ") : (d.state === "error" ? d.err || "Failed" : d.state === "paused" ? "Paused • " : "") + sz(d.done) + " / " + sz(d.size);
  return `<div class="dli" data-id="${esc(d.id)}"><div class="dlp">${d.poster ? `<img src="${tmdb.img(d.poster)}" alt="">` : ""}</div><div class="dlt"><b>${esc(d.title || "Video")}${d.year ? " (" + d.year + ")" : ""}</b><small>${esc(sub)}</small>${done ? "" : `<div class="pbar2"><i style="width:${p}%"></i></div>`}</div>${done ? `<button class="ib dlx" data-a="del" aria-label="Delete">${svg(IC.trash)}</button>` : `<button class="ib dlx" data-a="pp" aria-label="Pause or resume">${svg(d.state === "run" || d.state === "queued" ? DP.pause : DP.play)}</button><button class="ib dlx" data-a="del" aria-label="Cancel">${svg(IC.close)}</button>`}</div>`;
}

let dlSig = "", usageAt = 0;

async function paintDl(offline) {
  const list = $("dlist");
  if (!list) return;
  const items = dl.all();
  const run = items.filter((d) => d.state !== "done"), done = items.filter((d) => d.state === "done");
  document.querySelectorAll(".utabs button").forEach((b) => {
    b.classList.toggle("on", b.dataset.t === dlTab);
    const t = b.dataset.t === "run" ? "Downloading (" + run.length + ")" : "Offline (" + done.length + ")";
    if (b.textContent !== t) b.textContent = t;
  });
  const cur = dlTab === "run" ? run : done;
  const sig = dlTab + "|" + cur.map((d) => d.id + d.state).join(",");
  if (sig !== dlSig) {
    dlSig = sig;
    list.innerHTML = cur.length ? cur.map((d) => dlRow(d, dlTab === "off")).join("")
      : `<div class="empty">${svg(DP.down, "fi big")}<b>${dlTab === "run" ? "Nothing downloading" : "Nothing saved offline"}</b><p class="muted center">${dlTab === "run" ? "Open a movie and tap the download button to watch it without internet." : "Downloaded movies appear here and play without internet."}</p></div>`;
    list.querySelectorAll(".dli").forEach((r) => {
      const id = r.dataset.id;
      r.querySelector(".dlt").onclick = () => { const d = dl.get(id); if (d && d.state === "done") playOffline(d, offline); };
      r.querySelectorAll(".dlx").forEach((b) => (b.onclick = (e) => {
        e.stopPropagation();
        const d = dl.get(id);
        if (!d) return;
        if (b.dataset.a === "pp") { if (d.state === "run" || d.state === "queued") dl.pause(id); else dl.resume(id); }
        else if (d.state === "done") confirmBox("Remove download?", "The offline copy of this file will be deleted from this device.", "Remove", () => dl.remove(id));
        else dl.remove(id);
      }));
    });
  } else {
    cur.forEach((d) => {
      const r = list.querySelector('.dli[data-id="' + d.id.replace(/"/g, "") + '"]');
      if (!r) return;
      const bar = r.querySelector(".pbar2 i");
      if (bar) bar.style.width = (d.size ? Math.round((d.done / d.size) * 100) : 0) + "%";
      const sm = r.querySelector(".dlt small");
      if (sm && dlTab === "run") sm.textContent = (d.state === "error" ? d.err || "Failed" : d.state === "paused" ? "Paused • " : "") + (d.state === "error" ? "" : sz(d.done) + " / " + sz(d.size));
    });
  }
  const now = Date.now();
  if (now - usageAt < 1500 && $("stor") && $("stor").firstChild) return;
  usageAt = now;
  const u = await dl.usage();
  const s = $("stor");
  if (s) s.innerHTML = `<div class="stl"><span>Storage used by downloads</span><span>${u.quota ? sz(u.used) + " / " + sz(u.quota) : sz(u.used)}</span></div><div class="sbar"><i style="width:${u.quota ? Math.max(2, Math.min(100, (u.used / u.quota) * 100)) : 2}%"></i></div><div class="sfr"><button id="fr" class="tbtn">Free up space</button></div>`;
  const fr = $("fr");
  if (fr) fr.onclick = () => { dlTab = "off"; dlSig = ""; paintDl(offline); };
}

function playOffline(d, offline) {
  const back = () => downloadsView(offline);
  play(Object.assign({}, d.item), back, null);
}

function downloadsView(offline) {
  curDetail = "";
  view(`<h1 class="shead">Downloads</h1>
    ${offline ? '<p class="muted">You are offline. Your downloaded movies still play.</p><div class="pad"><button class="btn small" onclick="location.reload()">Try again</button></div>' : ""}
    <div class="utabs"><button data-t="run"></button><button data-t="off"></button></div>
    <div id="dlist"></div>
    <div id="stor" class="stor"></div>
    ${offline ? "" : tabsHtml("dl")}`);
  dlSig = "";
  usageAt = 0;
  document.querySelectorAll(".utabs button").forEach((b) => (b.onclick = () => { dlTab = b.dataset.t; paintDl(offline); }));
  paintDl(offline);
  if (!offline) bindTabs();
}

dl.onChange(() => { paintDlButtons(); if ($("dlist")) paintDl(!document.querySelector(".tabs")); });

function castHtml(v) {
  if (!v.cast || !v.cast.length) return "";
  return `<h3 class="sec2">Cast & crew <small>(tap a name)</small></h3><div class="cast">${v.cast.map((c) => `<button class="cm" data-p="${esc(c.n)}"><span class="cph">${c.p ? `<img src="${tmdb.img(c.p, "w185")}" loading="lazy" alt="">` : svg(IC.person, "fi ph")}</span><b>${esc(c.n)}</b><small>${esc(c.c || "")}</small></button>`).join("")}</div>`;
}

async function castPhotos(g, again) {
  const v = g.v;
  if (!tmdb.hasKey() || !v.tmdb || !v.cast || !v.cast.length || v.cast.every((c) => c.p !== undefined)) return;
  try {
    const d = await tmdb.details(v.tmdb, v.series ? "tv" : "movie");
    g.files.forEach((f) => { if (f.tmdb === v.tmdb) f.cast = d.cast; });
    put(LIB, JSON.stringify(library));
    if (curDetail === g.key && document.querySelector(".cast")) { const y = window.scrollY; again(); window.scrollTo(0, y); }
  } catch (e) {}
}

const sz = (b) => (b >= 1073741824 ? gb(b) : (b / 1048576).toFixed(1) + " MB");

function fileLine(f) {
  const t = f.name.toLowerCase(), o = [];
  const q = /2160p|\b4k\b/.test(t) ? "4K" : /1080p/.test(t) ? "1080p" : /720p/.test(t) ? "720p" : /480p/.test(t) ? "480p" : "";
  if (q) o.push(q);
  const src = t.match(/blu-?ray|br-?rip|web-?dl|web-?rip|hdrip|hdtv|dvdrip|hd-?cam|\bcam\b|\bhdts\b/);
  if (src) o.push(src[0].replace(/^blu-?ray$/, "BluRay").replace(/^br-?rip$/, "BRRip").replace(/^web-?dl$/, "WEB-DL").replace(/^web-?rip$/, "WEBRip").replace(/^hdrip$/, "HDRip").replace(/^hdtv$/, "HDTV").replace(/^dvdrip$/, "DVDRip").replace(/^hd-?cam$/, "HDCAM").replace(/^cam$/, "CAM").replace(/^hdts$/, "HDTS"));
  const c = t.match(/x265|hevc|x264|h\.?264|av1/);
  if (c) o.push(c[0] === "hevc" ? "HEVC" : c[0] === "av1" ? "AV1" : c[0][0] === "h" ? "H264" : c[0]);
  ["hindi", "english", "tamil", "telugu", "malayalam", "kannada", "korean"].forEach((l) => { if (t.includes(l)) o.push(l[0].toUpperCase() + l.slice(1)); });
  if (/\bsubs?\b|esub|msub/.test(t)) o.push("Subs");
  return o.join(" • ") || "Video";
}

function dlBtn(f) {
  return `<button class="dlb" data-id="${esc(f.id)}" aria-label="Download">${ringHtml(dl.get(f.id))}</button>`;
}

function fileCard(f, i, label, sub) {
  return `<div class="fcard" data-i="${i}"><div class="ftx"><b>${esc(label)}${ud.seen[f.id] ? " ✓" : ""}</b><small>${esc(sub)}</small></div>${dlBtn(f)}</div>`;
}

function topBar(g) {
  return `<button id="b" class="rb" aria-label="Back">${svg(IC.back)}</button><button id="fv" class="rb right" aria-label="Favorite">${svg(ud.fav[g.key] ? DP.heartOn : DP.heartOff)}</button>`;
}

function infoBlock(g, files, resume) {
  const v = g.v;
  const meta = [year(v), (v.genres || "").split(", ").filter(Boolean).slice(0, 3).join(" • "), mins(v.runtime)].filter(Boolean).join("  •  ");
  const saver = settings.saver && files.length ? `<p class="dnote">Data saver is on: Play uses the smallest file (${sz(files[files.length - 1].size)}).</p>` : "";
  return `<h1>${esc(title(v))}</h1>
    <div class="dmeta"><span>${esc(meta)}</span>${v.rating ? `<i class="rate big"><b>★</b> ${v.rating.toFixed(1)}</i>` : ""}</div>
    <div class="dact2"><button id="p" class="btn play">${dpi("play")}${resume ? "Resume" : "Play"}</button><button id="wl" class="btn outl">${dpi(ud.wl[g.key] ? "check" : "add")}My List</button></div>
    <button id="sn" class="eye">${dpi("eye")}${watched(g) ? "Mark as unwatched" : "Mark as watched"}</button>
    ${saver}
    ${v.overview ? `<p class="ov">${esc(v.overview)}</p>` : ""}`;
}

function wireTop(g, again, back) {
  $("b").onclick = back;
  $("fv").onclick = () => { ud.fav[g.key] = !ud.fav[g.key]; saveUd(); again(); };
  $("wl").onclick = () => { ud.wl[g.key] = !ud.wl[g.key]; saveUd(); again(); };
  $("sn").onclick = () => {
    const on = !watched(g);
    g.files.forEach((f) => { if (on) ud.seen[f.id] = 1; else { delete ud.seen[f.id]; pos[f.id] = 0; } });
    saveUd(); put(POS, JSON.stringify(pos)); again();
  };
  document.querySelectorAll(".cm").forEach((b) => (b.onclick = () => person(b.dataset.p, again)));
}

function detail(g, back) {
  if (isSeries(g)) return seriesDetail(g, back);
  curDetail = g.key;
  opened[g.key] = 1;
  put("nwios_open", JSON.stringify(opened));
  const v = g.v;
  const files = g.files.slice().sort((a, b) => b.size - a.size);
  const resumeFile = files.filter((f) => (pos[f.id] || 0) > 5 && !ud.seen[f.id]).sort((a, b) => pos[b.id] - pos[a.id])[0];
  const best = resumeFile || (settings.saver ? files[files.length - 1] : files[0]);
  const again = () => detail(g, back);
  view(`<div class="dhero" ${v.backdrop ? `style="background-image:linear-gradient(#0000 45%, #010314), url(${tmdb.img(v.backdrop, "w780")})"` : ""}>${topBar(g)}</div>
    <div class="dinfo">${infoBlock(g, files, resumeFile)}
      ${castHtml(v)}
      <h3 class="sec2">Available files (${files.length})</h3>
      ${files.map((f, i) => fileCard(f, i, fileLine(f), sz(f.size))).join("")}
      ${tmdb.hasKey() ? '<button id="fix" class="ghost wide">Wrong movie? Pick another</button>' : ""}</div>`);
  wireTop(g, again, back);
  $("p").onclick = () => play(best, again, null, g);
  document.querySelectorAll(".fcard").forEach((c) => {
    const f = files[Number(c.dataset.i)];
    c.onclick = () => play(f, again, null, g);
    c.querySelector(".dlb").onclick = (e) => { e.stopPropagation(); dlAction(f, g); };
  });
  const fx = $("fix");
  if (fx) fx.onclick = () => fix(g, back);
  castPhotos(g, again);
}

function episodes(g) {
  const map = new Map();
  for (const f of g.files) {
    const k = (f.season || 0) * 1000 + (f.episode || 0);
    if (!map.has(k)) map.set(k, { s: f.season || 0, e: f.episode || 0, files: [] });
    map.get(k).files.push(f);
  }
  return [...map.values()].sort((a, b) => a.s - b.s || a.e - b.e);
}

function playEp(eps, i, back, g) {
  const fl = eps[i].files.slice().sort((a, b) => b.size - a.size);
  const f = settings.saver ? fl[fl.length - 1] : fl[0];
  play(f, back, eps[i + 1] ? () => playEp(eps, i + 1, back, g) : null, g);
}

function seriesDetail(g, back, season) {
  curDetail = g.key;
  opened[g.key] = 1;
  put("nwios_open", JSON.stringify(opened));
  const v = g.v;
  const eps = episodes(g);
  const seasons = [...new Set(eps.map((e) => e.s))];
  const open = eps.find((e) => e.files.some((f) => (pos[f.id] || 0) > 5 && !ud.seen[f.id]));
  const cur = season !== undefined ? season : open ? open.s : seasons[0];
  const again = () => seriesDetail(g, back, cur);
  const shown = eps.filter((e) => e.s === cur);
  view(`<div class="dhero" ${v.backdrop ? `style="background-image:linear-gradient(#0000 45%, #010314), url(${tmdb.img(v.backdrop, "w780")})"` : ""}>${topBar(g)}</div>
    <div class="dinfo">${infoBlock(g, [], open)}
      <div class="chips">${seasons.map((s) => `<button class="chip ${s === cur ? "on" : ""}" data-s="${s}">${s ? "Season " + s : "Episodes"}</button>`).join("")}</div>
      <h3 class="sec2">Episodes (${shown.length})</h3>
      ${shown.map((e) => { const f = e.files.slice().sort((a, b) => b.size - a.size)[0]; return fileCard(f, eps.indexOf(e), e.e ? "Episode " + e.e : "Episode", fileLine(f) + " • " + sz(f.size)); }).join("")}
      ${castHtml(v)}</div>`);
  wireTop(g, again, back);
  $("p").onclick = () => playEp(eps, Math.max(0, eps.indexOf(open || shown[0] || eps[0])), again, g);
  document.querySelectorAll(".chip[data-s]").forEach((b) => (b.onclick = () => seriesDetail(g, back, Number(b.dataset.s))));
  document.querySelectorAll(".fcard").forEach((c) => {
    const e = eps[Number(c.dataset.i)];
    const f = e.files.slice().sort((a, b) => b.size - a.size)[0];
    c.onclick = () => playEp(eps, Number(c.dataset.i), again, g);
    c.querySelector(".dlb").onclick = (ev) => { ev.stopPropagation(); dlAction(f, g); };
  });
  castPhotos(g, again);
}

function person(name, back) {
  curDetail = "";
  const list = groups().filter((g) => (g.v.cast || []).some((c) => c.n === name)).sort(SORTS.year);
  view(`<header class="bar"><button id="b" class="ico">Back</button><b>${esc(name)}</b><span></span></header>
    <main class="grid">${list.map((g) => cardHtml(g, false)).join("")}</main>${list.length ? "" : '<p class="muted center">No movies in your library.</p>'}`);
  $("b").onclick = back;
  document.querySelectorAll(".card").forEach((c) => (c.onclick = () => detail(byKey(c.dataset.k), () => person(name, back))));
}

function fix(g, back) {
  curDetail = "";
  view(`<header class="bar"><button id="b" class="ico">Back</button><b>Pick the right movie</b><span></span></header>
    <div class="search"><input id="fq" type="search" placeholder="Movie title" value="${esc(title(g.v))}"></div>
    <div class="list"><button id="go" class="btn">Search</button><div id="res"></div></div>`);
  $("b").onclick = () => detail(g, back);
  $("go").onclick = async () => {
    const res = $("res");
    res.innerHTML = '<p class="muted">Searching…</p>';
    let hits = [];
    try { hits = await tmdb.find($("fq").value.trim()); } catch (e) {}
    res.innerHTML = hits.length ? hits.map((h) => `<button class="file" data-id="${h.id}"><span>${esc(h.title)} ${h.year || ""}</span></button>`).join("") : '<p class="muted">Nothing found.</p>';
    res.querySelectorAll(".file").forEach((b) => (b.onclick = async () => {
      b.textContent = "Applying…";
      try {
        const d = await tmdb.details(Number(b.dataset.id));
        g.files.forEach((f) => Object.assign(f, d, { tried: Date.now() }));
        put(LIB, JSON.stringify(library));
        const ng = groups().find((x) => x.files.some((f) => f.id === g.files[0].id));
        detail(ng, back);
      } catch (e) { b.textContent = "Could not apply, try again"; }
    }));
  };
}

let saveT = 0;
const flushLib = () => { clearTimeout(saveT); saveT = 0; put(LIB, JSON.stringify(library)); put("nwios_cur", JSON.stringify(cursor)); };
const saveSoon = () => { if (!saveT) saveT = setTimeout(flushLib, 2500); };

let scanWake = null;
async function grabWake() {
  try { if (navigator.wakeLock && !scanWake) { scanWake = await navigator.wakeLock.request("screen"); scanWake.addEventListener("release", () => { scanWake = null; }); } } catch (e) {}
}
function dropWake() { if (scanWake) { scanWake.release().catch(() => {}); scanWake = null; } }

async function rescan(opts) {
  const o = opts || {};
  if (scanning) return;
  scanning = true;
  put("nwios_scanning", "1");
  if (o.reset) { cursor = {}; library = []; put(LIB, "[]"); put("nwios_cur", "{}"); }
  else if (o.full) { cursor = {}; library.forEach((m) => { if (!m.tmdb) delete m.tried; }); }
  grabWake();
  scanSt.on = true; scanSt.quiet = !!o.quiet; scanSt.found = 0;
  scanSt.phase = library.length ? "Checking for new movies…" : "Scanning your Telegram chats…";
  paintStatus();
  let added = 0, failed = false;
  try {
    const res = await tg.scan(
      (n, d, t) => { scanSt.found = n; scanSt.phase = "Scanning chat " + d + " of " + t; paintStatus(); },
      cursor,
      library.map((m) => m.name),
      (got) => {
        const byId = new Map(library.map((m) => [m.id, m]));
        const fresh = [];
        got.forEach((m) => {
          const e = byId.get(m.id);
          if (e) { e.name = m.name; e.size = m.size; e.dur = m.dur; e.mime = m.mime; } else fresh.push(m);
        });
        if (fresh.length) { library = library.concat(fresh); added += fresh.length; }
        saveSoon();
      }
    );
    if (o.full && !res.errors && res.chats > 0) {
      const keep = new Set(res.items.map((m) => m.id));
      library = library.filter((m) => keep.has(m.id));
    }
    flushLib();
    scanNote = library.length ? "" : "Checked " + res.chats + " chats · " + res.docs + " files seen · " + res.passed + " passed the movie check" + (res.errors ? " · " + res.errors + " chats unreadable (" + res.firstErr + ")" : "");
  } catch (e) { failed = true; flushLib(); if (!o.quiet) scanNote = "Scan failed: " + (e.message || e); }
  scanning = false;
  scanSt.on = false;
  dropWake();
  if (!failed) localStorage.removeItem("nwios_scanning");
  if (!o.quiet && !failed) toast(added ? added + " new " + (added === 1 ? "movie" : "movies") + " added" : "No new movies found");
  if (o.quiet && !added) { paintStatus(); return; }
  if (onHome()) home(); else if (onExplore()) explore(); else paintStatus();
  enrichAll();
}

async function enrichAll() {
  if (!tmdb.hasKey()) return;
  const store = () => put(LIB, JSON.stringify(library));
  await tmdb.enrich(library, (n, t) => { enrSt.on = true; enrSt.n = n; enrSt.t = t; paintStatus(); }, store);
  const wasOn = enrSt.on;
  enrSt.on = false;
  if (wasOn && onHome()) home(); else if (wasOn && onExplore()) explore(); else paintStatus();
}

function play(m, back, next, g0) {
  const g = g0 || groups().find((x) => x.files.some((f) => f.id === m.id));
  const versions = g && !isSeries(g) ? g.files.slice().sort((a, b) => b.size - a.size).map((f) => ({ id: f.id, name: f.name, size: f.size, label: fileLine(f), file: f })) : null;
  lastPl[m.id] = Date.now();
  put("nwios_last", JSON.stringify(lastPl));
  const go = (item) => player.play({
    m: item, label: esc(g ? title(g.v) : m.title), title: g ? title(g.v) : m.title, poster: g && g.v.poster ? tmdb.img(g.v.poster) : "", settings, pos, view, back,
    versions,
    onSwitch: (f, t) => { pos[f.id] = Math.max(pos[f.id] || 0, Math.floor(t)); play(g.files.find((x) => x.id === f.id), back, next, g); },
    save: () => { save(); put(POS, JSON.stringify(pos)); touchSync(); },
    next, onSeen: (f) => { ud.seen[f.id] = 1; saveUd(); },
    onWatch: (s) => { const d = new Date().toISOString().slice(0, 10); wt[d] = Math.round((wt[d] || 0) + s); put("nwios_time", JSON.stringify(wt)); touchSync(); }
  });
  if (dl.isDone(m.id)) dl.file(m.id).then((file) => go(Object.assign({}, m, { localFile: file }))).catch(() => go(m));
  else go(m);
}

const SI = {
  account: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
  privacy: "M6 11V8a6 6 0 0112 0v3M5 11h14v10H5z",
  player: "M12 3a9 9 0 100 18 9 9 0 000-18zM10 8l6 4-6 4z",
  stats: "M5 20V10M12 20V4M19 20v-7",
  help: "M12 3a9 9 0 100 18 9 9 0 000-18zM9.5 9.5a2.5 2.5 0 115 0c0 1.5-2.5 2-2.5 3.5M12 17v.5",
  privacy_policy: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  terms: "M6 3h9l4 4v14H6zM9 12h6M9 16h6",
  disclaimer: "M12 3l10 18H2zM12 10v5M12 18v.5",
  about: "M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v6M12 7.5v.5",
  appearance: "M12 3a9 9 0 100 18c1.5 0 2-1 1.5-2s0-2 1.5-2h2a3 3 0 003-3c0-6-4-11-8-11z",
  network: "M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0M12 19.5v.5",
  storage: "M4 7c0-2 3.5-3 8-3s8 1 8 3-3.5 3-8 3-8-1-8-3zM4 7v10c0 2 3.5 3 8 3s8-1 8-3V7"
};
const SECTIONS = [
  ["Account", [["account", "Account & Security", "Telegram session, scanning, sign out"], ["privacy", "Privacy & Security", "Statistics and your data"]]],
  ["Preferences", [["appearance", "Appearance", "Colours, text size"], ["player", "Player Settings", "Playback, subtitles, gestures"], ["network", "Network & Download", "Data saver, buffer"], ["storage", "Storage & Cache", "Cache and saved details"]]],
  ["Activity", [["stats", "Watch statistics", "Your watch time and favourites"]]],
  ["App", [["help", "Help & Support", "Guides and common problems"]]],
  ["Legal", [["privacy_policy", "Privacy Policy", "How your information is used"], ["terms", "Terms & Conditions", "Rules for using NWFlix"], ["disclaimer", "Disclaimer & Copyright", "Content and credits"]]],
  ["About", [["about", "About NWFlix iOS", "Developer, credits and contact"]]]
];
const srow = (k, t, s) => `<button class="srow" data-k="${k}"><span class="sico"><svg viewBox="0 0 24 24"><path d="${SI[k]}"/></svg></span><span class="stx"><b>${t}</b><small>${s}</small></span>${svg(IC.chev, "fi chv")}</button>`;
const grp = (t) => `<div class="grp">${t}</div>`;
const arow = (id, t, s, ico, danger) => `<${id ? "button" : "div"} ${id ? `id="${id}"` : ""} class="arow ${id ? "tap" : ""} ${danger ? "dng" : ""}">${ico ? svg(IC[ico], "fi aic") : ""}<span class="stx"><b>${esc(t)}</b>${s ? `<small>${esc(s)}</small>` : ""}</span></${id ? "button" : "div"}>`;
const sws = (id, t, s, on) => `<label class="sw"><span class="stx"><b>${t}</b>${s ? `<small>${s}</small>` : ""}</span><input id="${id}" class="tgl" type="checkbox" ${on ? "checked" : ""}></label>`;
const sliderRow = (id, t, label, min, max, step, val) => `<div class="slr"><div class="slt"><span>${t}</span><span id="${id}_l" class="cv">${label}</span></div><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
const crow = (id, t, size, note, btn) => `<div class="crw"><span class="stx"><b>${t}</b><small>${size}${note ? "  •  " + note : ""}</small></span><button id="${id}" class="obtn">${btn}</button></div>`;

const CH = [];
const chs = (id, t, opts, cur, pick) => {
  CH.push({ id, t, opts, pick });
  const lab = (opts.find(([v]) => String(v) === String(cur)) || ["", ""])[1];
  return `<button id="${id}" class="arow tap chrow"><span class="stx"><b>${t}</b></span><span id="${id}_v" class="cv" data-v="${esc(String(cur))}">${esc(lab)}</span>${svg(IC.chev, "fi chv")}</button>`;
};
function bindChoices() {
  CH.splice(0).forEach((c) => {
    $(c.id).onclick = () => choose(c.t, c.opts, $(c.id + "_v").dataset.v, (v) => { $(c.id + "_v").dataset.v = String(v); $(c.id + "_v").textContent = c.opts.find(([x]) => x === v)[1]; c.pick(v); });
  });
}

const page = (t, body, backFn) => {
  view(`<header class="pbar"><button id="b" class="pib2" aria-label="Back">${ficon("back")}</button><h2>${t}</h2></header><div class="pbody">${body}</div>`);
  $("b").onclick = backFn;
  bindChoices();
};
const flag = (id, key) => { $(id).onchange = (e) => { settings[key] = e.target.checked; save(); }; };

function settingsView() {
  curDetail = "";
  const email = rc.email();
  view(`<h1 class="shead">Settings</h1>
    <div class="prof"><div class="avatar">${esc((userName || email || "N")[0].toUpperCase())}</div>
      <div><b>${esc(userName || "NWFlix user")}</b><small>Connected with Telegram</small>${email ? `<small>${esc(email)}</small>` : ""}</div></div>
    ${SECTIONS.map(([h, rows]) => grp(h) + rows.map((r) => srow(...r)).join("")).join("")}
    <p class="muted center ver">NWFlix iOS 1.0</p>
    ${tabsHtml("set")}`);
  document.querySelectorAll(".srow").forEach((r) => (r.onclick = () => {
    const k = r.dataset.k;
    if (["privacy_policy", "terms", "disclaimer"].includes(k)) legalView(k === "privacy_policy" ? "privacy" : k);
    else if (k === "about") aboutView();
    else settingsPage(k);
  }));
  bindTabs();
}

function watchTime() {
  const fmt = (s) => (s >= 3600 ? Math.floor(s / 3600) + "h " + Math.floor((s % 3600) / 60) + "m" : Math.floor(s / 60) + "m");
  const days = [...Array(7)].map((_, i) => { const d = new Date(Date.now() - (6 - i) * 864e5); return { k: d.toISOString().slice(0, 10), n: "SMTWTFS"[d.getDay()] }; });
  const vals = days.map((d) => wt[d.k] || 0);
  const max = Math.max(...vals, 1);
  const all = Object.values(wt).reduce((a, b) => a + b, 0);
  return { all, text: fmt(all), week: fmt(vals.reduce((a, b) => a + b, 0)), today: fmt(vals[6]), bars: `<div class="bars">${days.map((d, i) => `<div><i style="height:${Math.round((vals[i] / max) * 100)}%"></i><small>${d.n}</small></div>`).join("")}</div>` };
}

const sizeKb = (key) => Math.round((get(key) || "").length / 1024);

function settingsPage(k) {
  const back = settingsView;
  if (k === "account") {
    const email = rc.email();
    page("Account & Security",
      grp("Telegram") + arow("", userName || "Telegram user", "Connected. Your session is stored only in this browser.", "account") +
      arow("a1", "Scan for new movies", "Also runs automatically every time you open the app", "refresh") +
      arow("a2", "Full rescan", "Slower: checks every chat deeply and retries unmatched movies", "search") +
      grp("Email account") + arow("", email || "Not signed in", "Signed in", "account") +
      arow("a3", "Use a different email", "You will be asked to choose an account", "logout") +
      grp("Danger zone") + arow("a4", "Log out & clear session", "Signs out of Telegram and deletes everything stored by NWFlix iOS on this device", "logout", true), back);
    $("a1").onclick = () => { rescan(); toast("Scanning…"); };
    $("a2").onclick = () => { rescan({ full: true }); toast("Full scan started"); };
    $("a3").onclick = async () => { await rc.logout(); location.reload(); };
    $("a4").onclick = () => confirmBox("Log out?", "This logs you out of Telegram on this device and deletes the library, lists and caches stored by NWFlix iOS.", "Log out", async () => { await rc.logout(); tg.logout(); });
  } else if (k === "privacy") {
    page("Privacy & Security",
      grp("Usage statistics") + sws("st", "Share anonymous usage statistics", "Helps the developer count users and send important notices. Never includes your Telegram details, chats, file names or what you watch.", settings.stats) +
      sws("sy", "Sync lists and progress across devices", "Your watchlist, favourites and watch progress follow you to your other devices.", settings.sync) +
      grp("Your data") + arow("", "Secure Telegram session", "Your session stays in this browser only. Sign out on shared devices.", "shield") +
      arow("dc", "Delete synced data from the cloud", "Removes the copy saved under your account", "trash") +
      arow("del", "Clear session", "Log out of Telegram and remove all local data", "logout", true), back);
    flag("st", "stats"); flag("sy", "sync");
    $("dc").onclick = () => confirmBox("Delete synced data?", "The copy of your lists and progress saved in the cloud will be deleted. Data on this device stays.", "Delete", async () => { try { await rc.deleteSync(); toast("Cloud data deleted"); } catch (e) { toast("Could not delete, try again"); } });
    $("del").onclick = () => confirmBox("Clear session?", "You will be logged out and all local NWFlix iOS data will be deleted.", "Clear", async () => { await rc.logout(); tg.logout(); });
  } else if (k === "player") {
    page("Player Settings",
      grp("Playback") + chs("sp", "Default playback speed", [0.5, 0.75, 1, 1.25, 1.5, 2].map((n) => [n, n + "x"]), settings.speed, (v) => { settings.speed = v; save(); }) +
      sws("r", "Resume playback", "Continue where you stopped", settings.resume) +
      grp("Audio & subtitles") + chs("ss", "Subtitle size", [16, 20, 24, 28, 34].map((n) => [n, n + " px"]), settings.subSize, (v) => { settings.subSize = v; save(); }) +
      sws("sb", "Subtitle background", "Dark box behind text for easier reading", settings.subBg) +
      grp("Gestures") + sws("gs", "Enable gestures", "Swipe and double-tap on the video: seek, brightness, volume", settings.gestures) +
      chs("k", "Skip buttons & double-tap seek", [5, 10, 15, 30].map((n) => [n, n + " seconds"]), settings.skip, (v) => { settings.skip = v; save(); }), back);
    flag("r", "resume"); flag("gs", "gestures"); flag("sb", "subBg");
  } else if (k === "stats") {
    const gs = groups();
    const t = watchTime();
    const eps = library.filter((f) => (f.series || f.season > 0) && ud.seen[f.id]).length;
    const cell = (n, l) => `<div class="stat"><b>${n}</b><small>${l}</small></div>`;
    page("Watch statistics", `<div class="tot"><small>Total watch time</small><b>${t.text}</b><span>${gs.filter((g) => !isSeries(g) && watched(g)).length} movies finished  •  ${eps} episodes finished</span></div>
      ${t.all === 0 ? '<p class="note">Nothing yet. Watch time is counted from the moment this version is installed.</p>' : ""}
      <div class="stats">${cell(t.today, "Today")}${cell(t.week, "Last 7 days")}${cell(t.text, "All time")}</div>${t.bars}
      <div class="stats s2">${cell(gs.filter((g) => !isSeries(g)).length, "Movies")}${cell(gs.filter(isSeries).length, "Series")}${cell(gs.filter(watched).length, "Watched")}${cell(gs.filter(started).length, "In progress")}${cell(Object.keys(ud.wl).filter((x) => ud.wl[x]).length, "Watchlist")}${cell(Object.keys(ud.fav).filter((x) => ud.fav[x]).length, "Favorites")}</div>`, back);
  } else if (k === "appearance") {
    const cols = ["#B88CFF", "#4FC3F7", "#81C784", "#FFB74D", "#F06292"];
    const pct = Math.max(85, Math.min(130, Math.round((settings.text / 16) * 20) * 5));
    page("Appearance",
      grp("Accent colour") + `<div class="swatches">${cols.map((c) => `<button class="swatch ${c === settings.accent ? "on" : ""}" data-c="${c}" style="background:${c}">${c === settings.accent ? ficon("check") : ""}</button>`).join("")}</div>` +
      grp("Text") + sliderRow("tx", "Text size", pct + "%", 85, 130, 5, pct) +
      grp("Display") + sws("h", "Hide files without movie details", "They are left out of Home. Find them by searching.", settings.hide), back);
    document.querySelectorAll(".swatch").forEach((b) => (b.onclick = () => { settings.accent = b.dataset.c; save(); applyTheme(); settingsPage("appearance"); }));
    $("tx").oninput = (e) => { $("tx_l").textContent = e.target.value + "%"; };
    $("tx").onchange = (e) => { settings.text = Math.round(16 * Number(e.target.value)) / 100; save(); applyTheme(); };
    flag("h", "hide");
  } else if (k === "network") {
    page("Network & Download",
      grp("Data saver") + sws("sv", "Data saver", "Uses less data but lowers quality: the smallest file is played when a movie has several versions.", settings.saver) +
      grp("Streaming") + chs("bf", "Buffer ahead", [20, 40, 90].map((n) => [n, n + " seconds"]), settings.buffer, (v) => { settings.buffer = v; save(); }) +
      '<p class="note">NWFlix streams straight from Telegram and never downloads whole movies. A bigger buffer plays smoother on slow networks but uses more data and memory. Use Wi-Fi for HD files.</p>', back);
    $("sv").onchange = (e) => {
      if (!e.target.checked) { settings.saver = false; save(); return; }
      e.target.checked = false;
      confirmBox("Turn on Data saver?", "This reduces data usage but lowers quality. The smallest file is chosen when a movie has several versions, and a slow connection may buffer more often.", "Turn on", () => { settings.saver = true; save(); $("sv").checked = true; });
    };
  } else if (k === "storage") {
    const lib = sizeKb(LIB), hist = sizeKb(POS) + sizeKb("nwios_user") + sizeKb("nwios_time");
    page("Storage & Cache",
      grp("Saved movie details (kept until you delete them)") + crow("cd", "Movie information", lib + " KB", "Kept so TMDB is not asked again", "Delete") +
      grp("Cache (safe to clear)") + crow("cl", "Movie index", lib + " KB", "Your lists & history are kept", "Clear") +
      crow("ch", "Watch history", hist + " KB", "Progress, watched marks and watch time", "Clear") +
      grp("Total") + arow("", "Movie library", lib + " KB") + arow("", "Lists and history", hist + " KB"), back);
    $("cd").onclick = () => confirmBox("Delete saved movie details?", "Posters and details will have to be fetched from TMDB again, which can take a while for a big library.", "Delete", () => {
      library.forEach((m) => ["tmdb", "series", "tname", "rating", "overview", "poster", "backdrop", "runtime", "genres", "cast", "tried"].forEach((x) => delete m[x]));
      put(LIB, JSON.stringify(library)); toast("Saved details deleted"); settingsPage("storage"); enrichAll();
    });
    $("cl").onclick = () => { home(); rescan({ reset: true }); };
    $("ch").onclick = () => confirmBox("Clear watch history?", "Watch progress and watched marks on this device will be removed.", "Clear", () => { pos = {}; ud.seen = {}; put(POS, "{}"); saveUd(); toast("History cleared"); settingsPage("storage"); });
  } else if (k === "help") {
    page("Help & Support",
      grp("Login") + arow("h1", "Login code not coming?", "Step-by-step guide in English and മലയാളം", "help") +
      arow("h2", "How do I get movies in NWFlix?", "Step-by-step in English and മലയാളം", "movie") +
      arow("h4", "Open Telegram", "See your login code in the Telegram app", "send") +
      grp("Home Screen") + arow("h3", "Add to Home Screen", "Open NWFlix iOS like a real app", "movie") +
      grp("How it works") + arow("", "Where do my movies come from?", "NWFlix scans the Telegram chats and channels you already have access to and keeps only long videos and large video files.") +
      arow("", "A movie has the wrong poster", "Open it → “Wrong movie? Pick another” → search and pick the correct movie.") +
      arow("", "Video is slow to start", "Streaming depends on Telegram's speed. Use Wi-Fi for HD files and try a bigger buffer in Network & Download.") +
      arow("", "Video won't play", "Some formats (for example DTS audio or AVI files) can't be decoded by every browser. Try “Try standard playback” in the player's More menu, or use the Android app.", ""), back);
    $("h1").onclick = () => guides.openGuide("otp");
    $("h2").onclick = () => guides.openGuide("movies");
    $("h3").onclick = () => a2hs();
    $("h4").onclick = () => { location.href = "tg://"; };
  }
}

function legalView(k) {
  const p = legal.PAGES[k];
  page(p.title, `<div class="doc">${legalBody(k)}</div>`, settingsView);
}

function contactDialog() {
  const c = legal.CONTACT;
  const d = dialog(`<h3>How would you like to reach me?</h3><p class="dtx">Choose where to send your message or bug report.</p>
    <a class="btn small" href="${c.instagram}" target="_blank" rel="noopener">Instagram</a>
    <a class="btn small" href="${c.telegram}" target="_blank" rel="noopener">Telegram</a>
    <a class="btn small" href="mailto:${c.mail}?subject=NWFlix%20iOS%20help">Email</a>
    <div class="dact"><button class="tbtn" id="dx">Cancel</button></div>`);
  d.box.querySelector("#dx").onclick = d.close;
}

function aboutView() {
  page("About", `<div class="abt"><img src="${BRAND}" width="72" height="72" alt=""><h2>NWFlix iOS</h2><p class="muted center">Version 1.0</p>
      <p class="muted center">Watch the movies in your own Telegram chats, without leaving the app.</p></div>
    ${grp("Developer")}${arow("", "Mohammed Rinshan", "NIGHTWALKER", "person")}${arow("ab", "Contact & report a bug", "Send a message to the developer", "mail")}
    ${grp("Credits")}${arow("", "Movie information", "This product uses the TMDB API but is not endorsed or certified by TMDB.")}
    ${arow("", "Telegram", "Telegram access by the open source GramJS library. NWFlix iOS is not affiliated with or endorsed by Telegram.")}
    ${grp("Legal")}${arow("", "Use responsibly", "NWFlix iOS does not host any movies. Use it only with content you own or are allowed to watch, and follow Telegram's terms and the copyright laws of your country.")}
    <p class="note">© 2026 Mohammed Rinshan (NIGHTWALKER). All rights reserved.</p>`, settingsView);
  $("ab").onclick = contactDialog;
}

boot();
