import * as tg from "./tg.js";
import * as rc from "./remote.js";
import * as tmdb from "./tmdb.js";
import * as player from "./player.js";
import * as legal from "./legal.js";
import * as guides from "./guides.js";
import * as cty from "./countries.js";

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
const tags = (n) => {
  const t = n.toLowerCase(), o = [];
  const q = /2160p|\b4k\b/.test(t) ? "4K" : /1080p/.test(t) ? "1080p" : /720p/.test(t) ? "720p" : /480p/.test(t) ? "480p" : "";
  if (q) o.push(q);
  if (/x265|hevc/.test(t)) o.push("HEVC");
  ["hindi", "english", "tamil", "telugu", "malayalam", "kannada", "korean"].forEach((l) => { if (t.includes(l)) o.push(l[0].toUpperCase() + l.slice(1)); });
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

function view(html) { clearInterval(O.timer); root.innerHTML = html; window.scrollTo(0, 0); }

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
    view(`<div class="login lg"><img class="lg-logo" src="icon.png" width="72" height="72" alt=""><div class="lg-brand">NWFLIX</div>
      <h1>Add NWFlix iOS to your Home Screen</h1>
      <p class="sub">NWFlix iOS works like a real app. Add it to your Home Screen and open it from there to continue.</p>
      <div class="gatebox">${installSteps()}</div></div>`);
    const ai = $("ai");
    if (ai) ai.onclick = async () => {
      installEvt.prompt();
      const r = await installEvt.userChoice;
      installEvt = null;
      if (r && r.outcome === "accepted") done(); else draw();
    };
  };
  const done = () => view(`<div class="login lg"><img class="lg-logo" src="icon.png" width="72" height="72" alt=""><h1>NWFlix iOS is installed</h1><p class="sub">Open NWFlix iOS from your Home Screen to continue.</p></div>`);
  onInstallReady = () => { if ($("ai") === null && document.querySelector(".gatebox")) draw(); };
  addEventListener("appinstalled", done);
  draw();
  return true;
}

function a2hs() {
  const d = dialog(`<img src="icon.png" width="64" height="64" alt="" style="border-radius:16px;align-self:center"><h3 style="text-align:center">Add NWFlix iOS to your Home Screen</h3><p class="dtx">Open it like a real app: full screen, with no browser bar.</p>${isStandalone() ? '<p class="dtx">NWFlix iOS is already on your Home Screen.</p>' : installSteps()}<div class="dact"><button class="tbtn" id="dx">Got it</button></div>`);
  d.box.querySelector("#dx").onclick = d.close;
  const ai = d.box.querySelector("#ai");
  if (ai) ai.onclick = async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; d.close(); };
}

let loginCc = get("nwios_cc") || cty.guess();
let loginPhone = "";
const O = { res: null, state: "idle", timer: 0, setState: null };

function loginHead(h, sub) {
  return `<img class="lg-logo" src="icon.png" width="64" height="64" alt=""><div class="lg-brand">NWFLIX</div><h1>${h}</h1><p class="sub">${sub}</p>`;
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
  const c = cty.find(loginCc);
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
  view(`<div class="login lg"><img class="lg-logo" src="icon.png" width="72" height="72" alt=""><div class="lg-brand">NWFLIX</div><h1>One last step</h1><p class="sub">Sign in with your email</p>
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
  if (!navigator.onLine) { offlineView(); return; }
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
  const unfinished = get("nwios_scanning") === "1";
  if (!library.length) rescan(); else { enrichAll(); rescan({ quiet: !unfinished }); }
}

const ud = Object.assign({ fav: {}, wl: {}, seen: {} }, jp("nwios_user", {}));
const saveUd = () => { put("nwios_user", JSON.stringify(ud)); touchSync(); };
let scanNote = "";
let userName = "";
let cursor = jp("nwios_cur", {});
let scanning = false, homeY = 0, restoreY = null, syncTimer = 0;
const scanSt = { on: false, phase: "", found: 0, quiet: false };
const wt = jp("nwios_time", {});
let tab = "all", sortBy = "added", fGenre = "", fLang = "", fQual = "", fType = "";
let curDetail = "";
const onHome = () => !!$("refresh");

const ICONS = {
  all: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z"/></svg>',
  wl: '<svg viewBox="0 0 24 24"><path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z"/></svg>',
  lib: '<svg viewBox="0 0 24 24"><path d="M5 4h4v16H5zM11 4h4v16h-4zM17.5 5l3.5 1-3.5 14-3.5-1z"/></svg>',
  fav: '<svg viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.8-8 11-8 11z"/></svg>',
  set: '<svg viewBox="0 0 24 24"><path d="M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg>'
};

const SORTS = {
  added: (a, b) => b.at - a.at,
  rating: (a, b) => (b.v.rating || 0) - (a.v.rating || 0),
  year: (a, b) => (b.v.year || 0) - (a.v.year || 0),
  az: (a, b) => title(a.v).localeCompare(title(b.v)),
  longest: (a, b) => (b.v.runtime || 0) - (a.v.runtime || 0)
};
const SORT_NAMES = { added: "Recently added", rating: "Rating", year: "Release year", az: "A to Z", longest: "Longest" };
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
const title = (m) => m.name || m.title;
const year = (m) => m.year || "";
const watched = (g) => g.files.every((f) => ud.seen[f.id]);
const started = (g) => g.files.some((f) => (pos[f.id] || 0) > 5 && !ud.seen[f.id]);
const percent = (g) => {
  const f = g.files.filter((x) => (pos[x.id] || 0) > 5 && x.dur).sort((a, b) => pos[b.id] - pos[a.id])[0];
  return f ? Math.min(100, Math.round((pos[f.id] / f.dur) * 100)) : 0;
};

function cardHtml(g, bar) {
  const v = g.v;
  return `<button class="card" data-k="${esc(g.key)}"><div class="poster">${v.poster ? `<img src="${tmdb.img(v.poster)}" loading="lazy" alt="">` : esc(title(v).slice(0, 1).toUpperCase())}${v.rating ? `<i class="rate">★ ${v.rating.toFixed(1)}</i>` : ""}${watched(g) ? '<i class="tick">✓</i>' : ""}${bar ? `<i class="prog" style="width:${percent(g)}%"></i>` : ""}</div>
    <span class="t">${esc(title(v))}</span><span class="s">${year(v)}${g.files.length > 1 ? " · " + g.files.length + " files" : ""}</span></button>`;
}

function select(id, label, opts, cur) {
  return `<select id="${id}"><option value="">${label}</option>${opts.map((o) => `<option ${o === cur ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
}

const tabsHtml = (on) => `<nav class="tabs">${[["all", "Home"], ["lib", "Library"], ["set", "Settings"]].map(([k, n]) => `<button data-t="${k}" class="${k === on ? "on" : ""}">${ICONS[k]}<span>${n}</span></button>`).join("")}</nav>`;
const bindTabs = () => document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => (b.dataset.t === "lib" ? libraryView() : b.dataset.t === "set" ? settingsView() : home())));
let libTab = "wl";

function libraryView() {
  const all = groups();
  const sets = { wl: all.filter((g) => ud.wl[g.key]), fav: all.filter((g) => ud.fav[g.key]), hist: all.filter((g) => watched(g) || started(g)) };
  const info = { wl: ["Your watchlist is empty", "Open a movie and tap Add to watchlist."], fav: ["No favorites yet", "Tap Favorite on a movie page to keep it here."], hist: ["Nothing watched yet", "Movies you start will show up here."] };
  const list = sets[libTab].slice().sort(libTab === "hist" ? (a, b) => percent(b) - percent(a) : SORTS.added);
  view(`<header class="bar"><b>Library</b><span></span></header>
    <div class="seg">${[["wl", "Watchlist"], ["fav", "Favorites"], ["hist", "History"]].map(([k, n]) => `<button data-s="${k}" class="${k === libTab ? "on" : ""}">${n} <small>${sets[k].length}</small></button>`).join("")}</div>
    <main class="grid">${list.map((g) => cardHtml(g, libTab === "hist")).join("")}</main>
    ${list.length ? "" : `<div class="empty"><b>${info[libTab][0]}</b><p class="muted center">${info[libTab][1]}</p></div>`}
    ${tabsHtml("lib")}`);
  document.querySelectorAll(".seg button").forEach((b) => (b.onclick = () => { libTab = b.dataset.s; libraryView(); }));
  document.querySelectorAll(".card").forEach((c) => (c.onclick = () => detail(byKey(c.dataset.k), libraryView)));
  bindTabs();
}

function statusLine() {
  if (scanSt.on && !scanSt.quiet && (!library.length || scanSt.found > 0)) return scanSt.phase + "  •  " + scanSt.found + " found";
  return scanNote;
}

function paintStatus() {
  const e = $("status");
  if (e) e.textContent = statusLine();
  const r = $("refresh");
  if (r) r.innerHTML = scanSt.on && !scanSt.quiet ? SPIN : svg(IC.refresh);
}

function home(q = "") {
  const all = groups();
  const hide = settings.hide && tmdb.hasKey();
  const ql = q.toLowerCase();
  let list = all.filter((g) => !hide || g.v.tmdb > 0 || g.files.some((f) => !f.tried));
  const hiddenN = tab === "all" ? all.length - list.length : 0;
  if (tab === "wl") list = list.filter((g) => ud.wl[g.key]);
  if (tab === "fav") list = list.filter((g) => ud.fav[g.key]);
  list = list.filter((g) =>
    (!ql || (title(g.v) + " " + (g.v.cast || []).map((c) => c.n).join(" ") + " " + g.files.map((f) => f.name).join(" ")).toLowerCase().includes(ql)) &&
    (!fGenre || (g.v.genres || "").includes(fGenre)) &&
    (!fLang || g.files.some((f) => tags(f.name).includes(fLang))) &&
    (!fQual || g.files.some((f) => tags(f.name).includes(fQual))) &&
    (!fType || (fType === "Series") === isSeries(g))
  ).sort(SORTS[sortBy]);
  const genres = [...new Set(all.flatMap((g) => (g.v.genres || "").split(", ").filter(Boolean)))].sort();
  const langs = [...new Set(all.flatMap((g) => g.files.flatMap((f) => tags(f.name))))].filter((t) => !QUALITIES.includes(t) && t !== "HEVC").sort();
  const cont = tab === "all" && !q && !fGenre && !fLang && !fQual ? list.filter(started) : [];
  view(`<header class="bar"><span class="brand"><img src="icon.png" alt="">NWFlix iOS</span><div class="hb"><button id="refresh" class="ib" aria-label="Refresh">${scanSt.on && !scanSt.quiet ? SPIN : svg(IC.refresh)}</button></div></header>
    <div id="rmenu" class="menu hidden"><button id="m1">Check for new movies</button><button id="m2">Full rescan (slower)</button></div>
    <div class="search"><input id="q" type="search" placeholder="Search movies or cast" value="${esc(q)}"></div>
    <div class="filters">
      <select id="so">${Object.entries(SORT_NAMES).map(([k, n]) => `<option value="${k}" ${k === sortBy ? "selected" : ""}>${n}</option>`).join("")}</select>
      ${select("fg", "Genre", genres, fGenre)}${select("fl", "Language", langs, fLang)}${select("fq", "Quality", QUALITIES, fQual)}${select("ft", "Type", ["Movies", "Series"], fType)}
    </div>
    <p id="status" class="muted stat-line">${esc(statusLine())}</p>
    ${hiddenN ? `<p class="muted">${hiddenN} files without details are hidden. <button id="showall" class="linkbtn">Show them</button></p>` : ""}
    ${cont.length ? `<h3 class="sec">Continue watching</h3><div class="row">${cont.map((g) => cardHtml(g, true)).join("")}</div>` : ""}
    <main class="grid">${list.map((g) => cardHtml(g, false)).join("")}</main>
    ${list.length ? "" : `<p class="muted center">${tab === "all" ? "No movies yet. Tap the refresh button to scan." : "Nothing here yet."}</p>`}
    ${tabsHtml("all")}`);
  const qi = $("q");
  qi.oninput = () => { const v = qi.value; home(v); const n = $("q"); n.focus(); n.setSelectionRange(v.length, v.length); };
  const menu = $("rmenu");
  $("refresh").onclick = (e) => {
    e.stopPropagation();
    menu.classList.toggle("hidden");
    if (!menu.classList.contains("hidden")) document.addEventListener("click", () => menu.classList.add("hidden"), { once: true });
  };
  $("m1").onclick = () => { menu.classList.add("hidden"); rescan(); toast("Checking for new movies…"); };
  $("m2").onclick = () => { menu.classList.add("hidden"); rescan({ full: true }); toast("Full scan started"); };
  const sa = $("showall");
  if (sa) sa.onclick = () => { settings.hide = false; save(); home(q); };
  $("so").onchange = (e) => { sortBy = e.target.value; home(q); };
  $("fg").onchange = (e) => { fGenre = e.target.value; home(q); };
  $("fl").onchange = (e) => { fLang = e.target.value; home(q); };
  $("fq").onchange = (e) => { fQual = e.target.value; home(q); };
  $("ft").onchange = (e) => { fType = e.target.value; home(q); };
  bindTabs();
  document.querySelectorAll(".card").forEach((c) => (c.onclick = () => { homeY = window.scrollY; detail(byKey(c.dataset.k), () => { restoreY = homeY; home(q); }); }));
  if (restoreY !== null) { window.scrollTo(0, restoreY); restoreY = null; }
}

function castHtml(v) {
  if (!v.cast || !v.cast.length) return "";
  return `<h3>Cast & crew <small class="muted nopad">(tap a name)</small></h3><div class="cast">${v.cast.map((c) => `<button class="cm" data-p="${esc(c.n)}"><span class="cph">${c.p ? `<img src="${tmdb.img(c.p, "w185")}" loading="lazy" alt="">` : svg(IC.person, "fi ph")}</span><b>${esc(c.n)}</b><small>${esc(c.c || "")}</small></button>`).join("")}</div>`;
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

function detail(g, back) {
  if (isSeries(g)) return seriesDetail(g, back);
  curDetail = g.key;
  const v = g.v;
  const files = g.files.slice().sort((a, b) => b.size - a.size);
  const resumeFile = files.filter((f) => (pos[f.id] || 0) > 5 && !ud.seen[f.id]).sort((a, b) => pos[b.id] - pos[a.id])[0];
  const best = resumeFile || (settings.saver ? files[files.length - 1] : files[0]);
  const again = () => detail(g, back);
  view(`<div class="hero" ${v.backdrop ? `style="background-image:linear-gradient(#0000,#010314),url(${tmdb.img(v.backdrop, "w780")})"` : ""}>
      <button id="b" class="ico">Back</button></div>
    <div class="info ${v.poster ? "hasp" : ""}">${v.poster ? `<img class="pimg" src="${tmdb.img(v.poster)}" alt="">` : ""}<h1>${esc(title(v))}</h1>
      <p class="muted nopad">${[year(v), v.runtime ? v.runtime + " min" : "", v.rating ? "★ " + v.rating.toFixed(1) : ""].filter(Boolean).join(" · ")}</p>
      ${v.genres ? `<p class="muted nopad">${esc(v.genres)}</p>` : ""}
      <button id="p" class="btn"><svg class="pl" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>${resumeFile ? "Resume" : "Play"}</button>
      <div class="acts"><button id="wl" class="ghost">${ud.wl[g.key] ? "In watchlist" : "Add to watchlist"}</button><button id="fv" class="ghost">${ud.fav[g.key] ? "Favorite ♥" : "Favorite ♡"}</button><button id="sn" class="ghost">${watched(g) ? "Mark unwatched" : "Mark watched"}</button></div>
      ${v.overview ? `<p>${esc(v.overview)}</p>` : ""}
      ${castHtml(v)}
      <h3>Files</h3>${files.map((f, i) => `<button class="file" data-i="${i}"><span>${esc(tags(f.name).join(" · ") || "Video")}${ud.seen[f.id] ? " ✓" : ""}</span><small>${gb(f.size)}</small></button>`).join("")}
      ${tmdb.hasKey() ? '<button id="fix" class="ghost wide">Wrong movie? Pick another</button>' : ""}</div>`);
  $("b").onclick = back;
  $("p").onclick = () => play(best, again);
  $("wl").onclick = () => { ud.wl[g.key] = !ud.wl[g.key]; saveUd(); again(); };
  $("fv").onclick = () => { ud.fav[g.key] = !ud.fav[g.key]; saveUd(); again(); };
  $("sn").onclick = () => {
    const on = !watched(g);
    g.files.forEach((f) => { if (on) ud.seen[f.id] = 1; else { delete ud.seen[f.id]; pos[f.id] = 0; } });
    saveUd(); put(POS, JSON.stringify(pos)); again();
  };
  document.querySelectorAll(".file").forEach((b) => (b.onclick = () => play(files[Number(b.dataset.i)], again)));
  document.querySelectorAll(".cm").forEach((b) => (b.onclick = () => person(b.dataset.p, again)));
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

function playEp(eps, i, back) {
  const fl = eps[i].files.slice().sort((a, b) => b.size - a.size);
  const f = settings.saver ? fl[fl.length - 1] : fl[0];
  play(f, back, eps[i + 1] ? () => playEp(eps, i + 1, back) : null);
}

function seriesDetail(g, back, season) {
  curDetail = g.key;
  const v = g.v;
  const eps = episodes(g);
  const seasons = [...new Set(eps.map((e) => e.s))];
  const open = eps.find((e) => e.files.some((f) => (pos[f.id] || 0) > 5 && !ud.seen[f.id]));
  const cur = season !== undefined ? season : open ? open.s : seasons[0];
  const again = () => seriesDetail(g, back, cur);
  const shown = eps.filter((e) => e.s === cur);
  view(`<div class="hero" ${v.backdrop ? `style="background-image:linear-gradient(#0000,#010314),url(${tmdb.img(v.backdrop, "w780")})"` : ""}>
      <button id="b" class="ico">Back</button></div>
    <div class="info ${v.poster ? "hasp" : ""}">${v.poster ? `<img class="pimg" src="${tmdb.img(v.poster)}" alt="">` : ""}<h1>${esc(title(v))}</h1>
      <p class="muted nopad">${[year(v), v.runtime ? v.runtime + " min" : "", v.rating ? "★ " + v.rating.toFixed(1) : "", eps.length + " episodes"].filter(Boolean).join(" · ")}</p>
      ${v.genres ? `<p class="muted nopad">${esc(v.genres)}</p>` : ""}
      <button id="p" class="btn"><svg class="pl" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>${open ? "Resume" : "Play"}</button>
      <div class="acts"><button id="wl" class="ghost">${ud.wl[g.key] ? "In watchlist" : "Add to watchlist"}</button><button id="fv" class="ghost">${ud.fav[g.key] ? "Favorite ♥" : "Favorite ♡"}</button></div>
      ${v.overview ? `<p>${esc(v.overview)}</p>` : ""}
      <div class="chips">${seasons.map((s) => `<button class="chip ${s === cur ? "on" : ""}" data-s="${s}">${s ? "Season " + s : "Episodes"}</button>`).join("")}</div>
      <h3>Episodes</h3>${shown.map((e) => `<button class="file" data-i="${eps.indexOf(e)}"><span>${e.e ? "E" + e.e : "Episode"}${e.files.every((f) => ud.seen[f.id]) ? " ✓" : ""}</span><small>${esc(tags(e.files[0].name).join(" · "))} · ${gb(e.files[0].size)}</small></button>`).join("")}
      ${castHtml(v)}</div>`);
  $("b").onclick = back;
  $("p").onclick = () => playEp(eps, Math.max(0, eps.indexOf(open || shown[0] || eps[0])), again);
  $("wl").onclick = () => { ud.wl[g.key] = !ud.wl[g.key]; saveUd(); again(); };
  $("fv").onclick = () => { ud.fav[g.key] = !ud.fav[g.key]; saveUd(); again(); };
  document.querySelectorAll(".chip[data-s]").forEach((b) => (b.onclick = () => seriesDetail(g, back, Number(b.dataset.s))));
  document.querySelectorAll(".cm").forEach((b) => (b.onclick = () => person(b.dataset.p, again)));
  document.querySelectorAll(".file").forEach((b) => (b.onclick = () => playEp(eps, Number(b.dataset.i), again)));
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
        const have = new Set(library.map((m) => m.id));
        const fresh = got.filter((m) => !have.has(m.id));
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
  if (onHome()) home(); else paintStatus();
  enrichAll();
}

async function enrichAll() {
  if (!tmdb.hasKey()) return;
  const store = () => put(LIB, JSON.stringify(library));
  await tmdb.enrich(library, (n, t) => { const e = $("status"); if (e && !scanSt.on) e.textContent = "Fetching movie details… " + n + "/" + t; }, store);
  if ($("status") && onHome()) home();
}

function play(m, back, next) {
  const g = groups().find((x) => x.files.some((f) => f.id === m.id));
  player.play({
    m, label: esc(g ? title(g.v) : m.title), title: g ? title(g.v) : m.title, poster: g && g.v.poster ? tmdb.img(g.v.poster) : "", settings, pos, view, back,
    save: () => { save(); put(POS, JSON.stringify(pos)); touchSync(); },
    next, onSeen: (f) => { ud.seen[f.id] = 1; saveUd(); },
    onWatch: (s) => { const d = new Date().toISOString().slice(0, 10); wt[d] = Math.round((wt[d] || 0) + s); put("nwios_time", JSON.stringify(wt)); touchSync(); }
  });
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
      grp("Total") + `<p class="note big">Library: ${lib} KB   •   Lists and history: ${hist} KB</p>`, back);
    $("cd").onclick = () => confirmBox("Delete saved movie details?", "Posters and details will have to be fetched from TMDB again, which can take a while for a big library.", "Delete", () => {
      library.forEach((m) => ["tmdb", "series", "name", "rating", "overview", "poster", "backdrop", "runtime", "genres", "cast", "tried"].forEach((x) => delete m[x]));
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
  page("About", `<div class="abt"><img src="icon.png" width="72" height="72" alt=""><h2>NWFlix iOS</h2><p class="muted center">Version 1.0</p>
      <p class="muted center">Watch the movies in your own Telegram chats, without leaving the app.</p></div>
    ${grp("Developer")}${arow("", "Mohammed Rinshan", "NIGHTWALKER", "person")}${arow("ab", "Contact & report a bug", "Send a message to the developer", "mail")}
    ${grp("Credits")}${arow("", "Movie information", "This product uses the TMDB API but is not endorsed or certified by TMDB.")}
    ${arow("", "Telegram", "Telegram access by the open source GramJS library. NWFlix iOS is not affiliated with or endorsed by Telegram.")}
    ${grp("Legal")}${arow("", "Use responsibly", "NWFlix iOS does not host any movies. Use it only with content you own or are allowed to watch, and follow Telegram's terms and the copyright laws of your country.")}
    <p class="note">© 2026 Mohammed Rinshan (NIGHTWALKER). All rights reserved.</p>`, settingsView);
  $("ab").onclick = contactDialog;
}

boot();
