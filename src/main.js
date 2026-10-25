import * as tg from "./tg.js";
import * as rc from "./remote.js";
import * as tmdb from "./tmdb.js";
import * as player from "./player.js";
import * as legal from "./legal.js";
import * as guides from "./guides.js";

const root = document.getElementById("app");
setTimeout(() => {
  const s = document.getElementById("splash");
  if (s) { s.classList.add("out"); setTimeout(() => s.remove(), 600); }
}, 1600);
const LIB = "nwios_lib";
const POS = "nwios_pos";
const SET = "nwios_set";
let library = JSON.parse(localStorage.getItem(LIB) || "[]");
let pos = JSON.parse(localStorage.getItem(POS) || "{}");
let settings = Object.assign({ speed: 1, skip: 10, resume: true, hide: true, gestures: true, subSize: 20, subBg: true, stats: true, vol: 1, bright: 1, text: 17, accent: "#B88CFF", buffer: 40, saver: false }, JSON.parse(localStorage.getItem(SET) || "{}"));
let pending = null;

const save = () => localStorage.setItem(SET, JSON.stringify(settings));
function applyTheme() {
  document.documentElement.style.setProperty("--acc", settings.accent);
  document.documentElement.style.fontSize = settings.text + "px";
  document.body.style.fontSize = settings.text + "px";
}
applyTheme();
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
  if (kind === "error") {
    const e = document.getElementById("err");
    if (e) e.textContent = text;
    const g = document.getElementById("go");
    if (g) g.disabled = false;
    return;
  }
  const logo = '<img src="icon.png" width="96" height="96" alt="">';
  if (kind === "code") {
    view(`<div class="login">${logo}<h1>Enter the code</h1><p class="muted">We sent it to your Telegram app</p>
      <div class="otp"><div class="boxes">${"<i></i>".repeat(5)}</div><input id="v" type="tel" inputmode="numeric" autocomplete="one-time-code" maxlength="5"></div>
      <p id="err" class="bad">${esc(text || "")}</p>
      <button id="go" class="btn">Continue</button>
      <button id="rs" class="linkbtn" disabled>Resend code in 30s</button>
      <button id="gd" class="linkbtn">Where do I find the code?</button></div>`);
    const input = document.getElementById("v"), go = document.getElementById("go"), rs = document.getElementById("rs");
    const boxes = [...document.querySelectorAll(".boxes i")];
    document.getElementById("gd").onclick = () => guides.openGuide("otp");
    input.focus();
    let left = 30;
    const timer = setInterval(() => {
      left--;
      if (left <= 0) { clearInterval(timer); rs.disabled = false; rs.textContent = "Resend code"; }
      else rs.textContent = "Resend code in " + left + "s";
    }, 1000);
    return new Promise((res) => {
      const submit = () => {
        if (input.value.length < 5) { document.getElementById("err").textContent = "Enter all 5 digits."; return; }
        clearInterval(timer); go.disabled = true; res(input.value);
      };
      input.oninput = () => {
        const v = input.value.replace(/\D/g, "");
        input.value = v;
        boxes.forEach((b, i) => { b.textContent = v[i] || ""; b.className = i === v.length ? "cur" : v[i] ? "fill" : ""; });
      };
      input.onkeydown = (e) => { if (e.key === "Enter") submit(); };
      go.onclick = submit;
      rs.onclick = () => { clearInterval(timer); res("__resend__"); };
    });
  }
  const labels = { phone: ["Phone number", "+91 98765 43210", "tel"], password: ["Two-step password", "Password", "password"] };
  const [title, hint, type] = labels[kind];
  view(`<div class="login">${logo}<h1>NWFlix iOS</h1>
    <p>${kind === "phone" ? "Sign in with your Telegram number" : esc(title)}</p>
    <input id="v" type="${type}" placeholder="${hint}" autocomplete="off">
    <p id="err" class="bad">${esc(text || "")}</p><button id="go" class="btn">Continue</button></div>`);
  const input = document.getElementById("v");
  input.focus();
  return new Promise((res) => {
    const done = () => { const v = input.value.trim(); if (v) { document.getElementById("go").disabled = true; res(v); } };
    document.getElementById("go").onclick = done;
    input.onkeydown = (e) => { if (e.key === "Enter") done(); };
  });
}

let installEvt = null;
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; });

function a2hs(force) {
  if (!force && (matchMedia("(display-mode: standalone)").matches || navigator.standalone)) return;
  if (!force) localStorage.setItem("nwios_a2hs", "1");
  const b = document.createElement("div");
  b.className = "cover dim";
  b.style.zIndex = 70;
  b.innerHTML = `<div class="dialog"><img src="icon.png" width="64" height="64" alt="" style="border-radius:16px;align-self:center">
    <h2>Add NWFlix iOS to your Home Screen</h2><p>Open it like a real app: full screen, with no browser bar.</p>
    ${installEvt ? '<button id="ai" class="btn">Install</button>' : '<ol class="steps"><li>Tap the <b>Share</b> button in your browser <svg class="shr" viewBox="0 0 24 24"><path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 00-1 1v8a1 1 0 001 1h14a1 1 0 001-1v-8a1 1 0 00-1-1h-1"/></svg></li><li>Scroll down and tap <b>Add to Home Screen</b></li><li>Tap <b>Add</b></li></ol>'}
    ${installEvt ? "" : '<button id="ao" class="btn ghost">Got it</button>'}</div>`;
  b.onclick = (e) => { if (e.target === b) b.remove(); };
  document.body.appendChild(b);
  const ao = document.getElementById("ao");
  if (ao) ao.onclick = () => b.remove();
  const ai = document.getElementById("ai");
  if (ai) ai.onclick = async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; b.remove(); };
}

async function gate() {
  if (await rc.ready()) return;
  view(`<div class="login"><img src="icon.png" width="72" height="72" alt=""><h1>NWFlix iOS</h1><p>One last step: sign in with your email</p>
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
  const here = (navigator.language.split("-")[1] || "").toUpperCase();
  const aimed = !c.annCountries || c.annCountries.split(",").map((x) => x.trim().toUpperCase()).includes(here);
  const live = c.annId && aimed && localStorage.getItem("nwios_ann") !== c.annId && (!c.annExpiresAt || Date.now() < c.annExpiresAt);
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
  if (!tg.hasKeys()) { view('<div class="login"><h1>NWFlix iOS</h1><p class="bad">Telegram keys are missing in this build.</p></div>'); return; }
  if (!tg.hasSession()) await rc.logout();
  view('<div class="login"><div class="spin"></div></div>');
  if (!("serviceWorker" in navigator)) { view('<div class="login"><h1>NWFlix iOS</h1><p class="bad">This browser cannot stream. Update iOS and open this page in Safari.</p></div>'); return; }
  if (!(await tg.resume())) {
    try { await tg.login(ask); } catch (e) { view(`<div class="login"><p class="bad">${esc(tg.friendly(e.message || ""))}</p><button class="btn" onclick="location.reload()">Try again</button></div>`); return; }
  }
  await gate();
  rc.watchConfig(applyRemote);
  if (settings.stats) rc.heartbeat();
  tg.me().then((n) => { userName = n; });
  await tg.startStreaming(() => library);
  if (!localStorage.getItem("nwios_a2hs")) setTimeout(() => a2hs(false), 1800);
  home();
  if (!library.length) rescan(); else enrichAll();
}

const ud = Object.assign({ fav: {}, wl: {}, seen: {} }, JSON.parse(localStorage.getItem("nwios_user") || "{}"));
const saveUd = () => localStorage.setItem("nwios_user", JSON.stringify(ud));
let scanNote = "";
let userName = "";
const wt = JSON.parse(localStorage.getItem("nwios_time") || "{}");
let tab = "all", sortBy = "added", fGenre = "", fLang = "", fQual = "", fType = "";

const ICONS = {
  all: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z"/></svg>',
  wl: '<svg viewBox="0 0 24 24"><path d="M6 3h12a1 1 0 011 1v17l-7-4-7 4V4a1 1 0 011-1z"/></svg>',
  fav: '<svg viewBox="0 0 24 24"><path d="M12 21s-8-5.2-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.8-8 11-8 11z"/></svg>'
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
  const names = { all: "Home", wl: "Watchlist", fav: "Favorites" };
  view(`<header class="bar"><span class="brand"><img src="icon.png" alt="">NWFlix iOS</span><div><button id="scan" class="ico">Rescan</button><button id="set" class="ico">Settings</button></div></header>
    <div class="search"><input id="q" type="search" placeholder="Search movies or cast" value="${esc(q)}"></div>
    <div class="filters">
      <select id="so">${Object.entries(SORT_NAMES).map(([k, n]) => `<option value="${k}" ${k === sortBy ? "selected" : ""}>${n}</option>`).join("")}</select>
      ${select("fg", "Genre", genres, fGenre)}${select("fl", "Language", langs, fLang)}${select("fq", "Quality", QUALITIES, fQual)}${select("ft", "Type", ["Movies", "Series"], fType)}
    </div>
    <p id="status" class="muted">${esc(scanNote)}</p>
    ${hiddenN ? `<p class="muted">${hiddenN} files without details are hidden. <button id="showall" class="linkbtn">Show them</button></p>` : ""}
    ${cont.length ? `<h3 class="sec">Continue watching</h3><div class="row">${cont.map((g) => cardHtml(g, true)).join("")}</div>` : ""}
    <main class="grid">${list.map((g) => cardHtml(g, false)).join("")}</main>
    ${list.length ? "" : `<p class="muted center">${tab === "all" ? "No movies yet. Tap Rescan." : "Nothing here yet."}</p>`}
    <nav class="tabs">${Object.entries(names).map(([k, n]) => `<button data-t="${k}" class="${k === tab ? "on" : ""}">${ICONS[k]}<span>${n}</span></button>`).join("")}</nav>`);
  const qi = document.getElementById("q");
  qi.oninput = () => { const v = qi.value; home(v); const n = document.getElementById("q"); n.focus(); n.setSelectionRange(v.length, v.length); };
  document.getElementById("scan").onclick = rescan;
  document.getElementById("set").onclick = () => settingsView();
  const sa = document.getElementById("showall");
  if (sa) sa.onclick = () => { settings.hide = false; save(); home(q); };
  document.getElementById("so").onchange = (e) => { sortBy = e.target.value; home(q); };
  document.getElementById("fg").onchange = (e) => { fGenre = e.target.value; home(q); };
  document.getElementById("fl").onchange = (e) => { fLang = e.target.value; home(q); };
  document.getElementById("fq").onchange = (e) => { fQual = e.target.value; home(q); };
  document.getElementById("ft").onchange = (e) => { fType = e.target.value; home(q); };
  document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => { tab = b.dataset.t; home(); }));
  document.querySelectorAll(".card").forEach((c) => (c.onclick = () => detail(byKey(c.dataset.k), () => home(q))));
}

function detail(g, back) {
  if (isSeries(g)) return seriesDetail(g, back);
  const v = g.v;
  const files = g.files.slice().sort((a, b) => b.size - a.size);
  const resumeFile = files.filter((f) => (pos[f.id] || 0) > 5 && !ud.seen[f.id]).sort((a, b) => pos[b.id] - pos[a.id])[0];
  const best = resumeFile || (settings.saver ? files[files.length - 1] : files[0]);
  const again = () => detail(g, back);
  view(`<div class="hero" ${v.backdrop ? `style="background-image:linear-gradient(#0000,#08090a),url(${tmdb.img(v.backdrop, "w780")})"` : ""}>
      <button id="b" class="ico">Back</button></div>
    <div class="info ${v.poster ? "hasp" : ""}">${v.poster ? `<img class="pimg" src="${tmdb.img(v.poster)}" alt="">` : ""}<h1>${esc(title(v))}</h1>
      <p class="muted nopad">${[year(v), v.runtime ? v.runtime + " min" : "", v.rating ? "★ " + v.rating.toFixed(1) : ""].filter(Boolean).join(" · ")}</p>
      ${v.genres ? `<p class="muted nopad">${esc(v.genres)}</p>` : ""}
      <button id="p" class="btn"><svg class="pl" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>${resumeFile ? "Resume" : "Play"}</button>
      <div class="acts"><button id="wl" class="ghost">${ud.wl[g.key] ? "In watchlist" : "Add to watchlist"}</button><button id="fv" class="ghost">${ud.fav[g.key] ? "Favorite ♥" : "Favorite ♡"}</button><button id="sn" class="ghost">${watched(g) ? "Mark unwatched" : "Mark watched"}</button></div>
      ${v.overview ? `<p>${esc(v.overview)}</p>` : ""}
      ${v.cast && v.cast.length ? `<h3>Cast & crew</h3><div class="chips">${v.cast.map((c) => `<button class="chip" data-p="${esc(c.n)}">${esc(c.n)}${c.c ? `<small>${esc(c.c)}</small>` : ""}</button>`).join("")}</div>` : ""}
      <h3>Files</h3>${files.map((f, i) => `<button class="file" data-i="${i}"><span>${esc(tags(f.name).join(" · ") || "Video")}${ud.seen[f.id] ? " ✓" : ""}</span><small>${gb(f.size)}</small></button>`).join("")}
      ${tmdb.hasKey() ? '<button id="fix" class="ghost wide">Wrong movie? Pick another</button>' : ""}</div>`);
  document.getElementById("b").onclick = back;
  document.getElementById("p").onclick = () => play(best, again);
  document.getElementById("wl").onclick = () => { ud.wl[g.key] = !ud.wl[g.key]; saveUd(); again(); };
  document.getElementById("fv").onclick = () => { ud.fav[g.key] = !ud.fav[g.key]; saveUd(); again(); };
  document.getElementById("sn").onclick = () => {
    const on = !watched(g);
    g.files.forEach((f) => { if (on) ud.seen[f.id] = 1; else { delete ud.seen[f.id]; pos[f.id] = 0; } });
    saveUd(); localStorage.setItem(POS, JSON.stringify(pos)); again();
  };
  document.querySelectorAll(".file").forEach((b) => (b.onclick = () => play(files[Number(b.dataset.i)], again)));
  document.querySelectorAll(".chip").forEach((b) => (b.onclick = () => person(b.dataset.p, again)));
  const fx = document.getElementById("fix");
  if (fx) fx.onclick = () => fix(g, back);
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
      ${v.cast && v.cast.length ? `<h3>Cast & crew</h3><div class="chips">${v.cast.map((c) => `<button class="chip" data-p="${esc(c.n)}">${esc(c.n)}${c.c ? `<small>${esc(c.c)}</small>` : ""}</button>`).join("")}</div>` : ""}</div>`);
  document.getElementById("b").onclick = back;
  document.getElementById("p").onclick = () => playEp(eps, Math.max(0, eps.indexOf(open || shown[0] || eps[0])), again);
  document.getElementById("wl").onclick = () => { ud.wl[g.key] = !ud.wl[g.key]; saveUd(); again(); };
  document.getElementById("fv").onclick = () => { ud.fav[g.key] = !ud.fav[g.key]; saveUd(); again(); };
  document.querySelectorAll(".chip[data-s]").forEach((b) => (b.onclick = () => seriesDetail(g, back, Number(b.dataset.s))));
  document.querySelectorAll(".chip[data-p]").forEach((b) => (b.onclick = () => person(b.dataset.p, again)));
  document.querySelectorAll(".file").forEach((b) => (b.onclick = () => playEp(eps, Number(b.dataset.i), again)));
}

function person(name, back) {
  const list = groups().filter((g) => (g.v.cast || []).some((c) => c.n === name)).sort(SORTS.year);
  view(`<header class="bar"><button id="b" class="ico">Back</button><b>${esc(name)}</b><span></span></header>
    <main class="grid">${list.map((g) => cardHtml(g, false)).join("")}</main>${list.length ? "" : '<p class="muted center">No movies in your library.</p>'}`);
  document.getElementById("b").onclick = back;
  document.querySelectorAll(".card").forEach((c) => (c.onclick = () => detail(byKey(c.dataset.k), () => person(name, back))));
}

function fix(g, back) {
  view(`<header class="bar"><button id="b" class="ico">Back</button><b>Pick the right movie</b><span></span></header>
    <div class="search"><input id="fq" type="search" placeholder="Movie title" value="${esc(title(g.v))}"></div>
    <div class="list"><button id="go" class="btn">Search</button><div id="res"></div></div>`);
  document.getElementById("b").onclick = () => detail(g, back);
  document.getElementById("go").onclick = async () => {
    const res = document.getElementById("res");
    res.innerHTML = '<p class="muted">Searching…</p>';
    let hits = [];
    try { hits = await tmdb.find(document.getElementById("fq").value.trim()); } catch (e) {}
    res.innerHTML = hits.length ? hits.map((h) => `<button class="file" data-id="${h.id}"><span>${esc(h.title)} ${h.year || ""}</span></button>`).join("") : '<p class="muted">Nothing found.</p>';
    res.querySelectorAll(".file").forEach((b) => (b.onclick = async () => {
      b.textContent = "Applying…";
      try {
        const d = await tmdb.details(Number(b.dataset.id));
        g.files.forEach((f) => Object.assign(f, d, { tried: Date.now() }));
        localStorage.setItem(LIB, JSON.stringify(library));
        const ng = groups().find((x) => x.files.some((f) => f.id === g.files[0].id));
        detail(ng, back);
      } catch (e) { b.textContent = "Could not apply, try again"; }
    }));
  };
}

async function rescan() {
  const s = document.getElementById("status");
  if (s) s.textContent = "Scanning your Telegram chats…";
  try {
    const res = await tg.scan((n, d, t) => { const e = document.getElementById("status"); if (e) e.textContent = "Scanning chat " + d + " of " + t + " · " + n + " found"; });
    const old = new Map(library.map((m) => [m.id, m]));
    library = res.items.map((m) => old.get(m.id) || m);
    localStorage.setItem(LIB, JSON.stringify(library));
    scanNote = res.items.length ? "" : "Checked " + res.chats + " chats · " + res.docs + " files seen · " + res.passed + " passed the movie check" + (res.errors ? " · " + res.errors + " chats unreadable (" + res.firstErr + ")" : "");
  } catch (e) { scanNote = "Scan failed: " + (e.message || e); }
  home();
  const sn = document.getElementById("status"); if (sn) sn.textContent = scanNote;
  enrichAll();
}

async function enrichAll() {
  if (!tmdb.hasKey()) return;
  const store = () => localStorage.setItem(LIB, JSON.stringify(library));
  await tmdb.enrich(library, (n, t) => { const e = document.getElementById("status"); if (e) e.textContent = "Fetching movie details… " + n + "/" + t; }, store);
  if (document.getElementById("status")) home();
}

function play(m, back, next) {
  const g = groups().find((x) => x.files.some((f) => f.id === m.id));
  player.play({
    m, label: esc(g ? title(g.v) : m.title), settings, pos, view, back,
    save: () => { save(); localStorage.setItem(POS, JSON.stringify(pos)); },
    next, onSeen: (f) => { ud.seen[f.id] = 1; saveUd(); },
    onWatch: (s) => { const d = new Date().toISOString().slice(0, 10); wt[d] = Math.round((wt[d] || 0) + s); localStorage.setItem("nwios_time", JSON.stringify(wt)); }
  });
}

const SI = {
  account: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
  privacy: "M6 11V8a6 6 0 0112 0v3M5 11h14v10H5z",
  player: "M12 3a9 9 0 100 18 9 9 0 000-18zM10 8l6 4-6 4z",
  library: "M3 6h7l2 2h9v12H3z",
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
  ["Account", [["account", "Account & Security", "Telegram session, sign out"], ["privacy", "Privacy & Security", "Statistics and your data"]]],
  ["Preferences", [["appearance", "Appearance", "Accent colour and text size"], ["player", "Player Settings", "Playback, subtitles, gestures"], ["network", "Network & Download", "Buffer and data saver"], ["storage", "Storage & Cache", "Cache and saved details"], ["library", "Library", "Details, history, rescan"]]],
  ["Activity", [["stats", "Watch statistics", "Your movies and lists"]]],
  ["App", [["help", "Help & Support", "Guides and Home Screen"]]],
  ["Legal", [["privacy_policy", "Privacy Policy", "How your information is used"], ["terms", "Terms & Conditions", "Rules for using NWFlix"], ["disclaimer", "Disclaimer & Copyright", "Content and credits"]]],
  ["About", [["about", "About NWFlix iOS", "Developer, credits and contact"]]]
];
const srow = (k, t, s) => `<button class="srow" data-k="${k}"><span class="sico"><svg viewBox="0 0 24 24"><path d="${SI[k]}"/></svg></span><span class="stx"><b>${t}</b><small>${s}</small></span><i class="chev">›</i></button>`;
const sw = (id, label, on) => `<label class="sw">${label}<input id="${id}" type="checkbox" ${on ? "checked" : ""}></label>`;
const sel = (id, label, opts, cur) => `<label class="sw">${label}<select id="${id}">${opts.map((n) => `<option ${String(n) === String(cur) ? "selected" : ""}>${n}</option>`).join("")}</select></label>`;
const page = (t, body, backFn) => {
  view(`<header class="bar"><button id="b" class="ico">Back</button><b>${t}</b><span></span></header><div class="list">${body}</div>`);
  document.getElementById("b").onclick = backFn;
};
const $ = (id) => document.getElementById(id);
const flag = (id, key) => { $(id).onchange = (e) => { settings[key] = e.target.checked; save(); }; };
const num = (id, key) => { $(id).onchange = (e) => { settings[key] = Number(e.target.value); save(); }; };

function settingsView() {
  const email = rc.email();
  view(`<header class="bar"><button id="b" class="ico">Back</button><b>Settings</b><span></span></header>
    <div class="profile"><div class="avatar">${esc((userName || email || "N")[0].toUpperCase())}</div>
      <div><b>${esc(userName || "NWFlix user")}</b><small>Connected with Telegram</small>${email ? `<small>${esc(email)}</small>` : ""}</div></div>
    ${SECTIONS.map(([h, rows]) => `<h3 class="grp">${h}</h3><div class="sgroup">${rows.map((r) => srow(...r)).join("")}</div>`).join("")}
    <p class="muted center ver">NWFlix iOS 1.0</p>`);
  $("b").onclick = () => home();
  document.querySelectorAll(".srow").forEach((r) => (r.onclick = () => {
    const k = r.dataset.k;
    if (["privacy_policy", "terms", "disclaimer"].includes(k)) legalView(k === "privacy_policy" ? "privacy" : k);
    else if (k === "about") aboutView();
    else settingsPage(k);
  }));
}

function watchTime() {
  const fmt = (s) => (s >= 3600 ? Math.floor(s / 3600) + "h " + Math.floor((s % 3600) / 60) + "m" : Math.floor(s / 60) + "m");
  const cell = (n, t) => `<div class="stat"><b>${n}</b><small>${t}</small></div>`;
  const days = [...Array(7)].map((_, i) => { const d = new Date(Date.now() - (6 - i) * 864e5); return { k: d.toISOString().slice(0, 10), n: "SMTWTFS"[d.getDay()] }; });
  const vals = days.map((d) => wt[d.k] || 0);
  const max = Math.max(...vals, 1);
  const all = Object.values(wt).reduce((a, b) => a + b, 0);
  return `<h3 class="sec nopad">Watch time</h3><div class="stats">${cell(fmt(vals[6]), "Today")}${cell(fmt(vals.reduce((a, b) => a + b, 0)), "Last 7 days")}${cell(fmt(all), "All time")}</div>
    <div class="bars">${days.map((d, i) => `<div><i style="height:${Math.round((vals[i] / max) * 100)}%"></i><small>${d.n}</small></div>`).join("")}</div>`;
}

function settingsPage(k) {
  const back = settingsView;
  if (k === "account") {
    page("Account & Security", `<p class="muted nopad">Signed in as ${esc(rc.email())}</p><p class="muted nopad">Your Telegram session is stored only in this browser.</p>
      <button id="rs" class="btn ghost">Rescan Telegram chats</button><button id="out" class="btn ghost">Sign out</button>`, back);
    $("rs").onclick = () => { home(); rescan(); };
    $("out").onclick = async () => { await rc.logout(); tg.logout(); };
  } else if (k === "privacy") {
    page("Privacy & Security", `${sw("st", "Share anonymous usage statistics", settings.stats)}
      <p class="muted nopad">Only your app version, iOS version, country and how often you open the app. Never what you watch.</p>
      <button id="del" class="btn ghost">Delete my data on this device</button>`, back);
    flag("st", "stats");
    $("del").onclick = async () => { await rc.logout(); tg.logout(); };
  } else if (k === "player") {
    page("Player Settings", `${sw("r", "Resume where I stopped", settings.resume)}${sw("gs", "Swipe gestures: seek, brightness, volume", settings.gestures)}
      ${sel("k", "Skip buttons (seconds)", [5, 10, 15, 30], settings.skip)}${sel("sp", "Default speed", [0.5, 0.75, 1, 1.25, 1.5, 2], settings.speed)}
      ${sel("ss", "Subtitle size", [16, 20, 24, 28, 34], settings.subSize)}${sw("sb", "Subtitle background", settings.subBg)}`, back);
    flag("r", "resume"); flag("gs", "gestures"); flag("sb", "subBg"); num("k", "skip"); num("sp", "speed"); num("ss", "subSize");
  } else if (k === "library") {
    page("Library", `${sw("h", "Hide movies without details", settings.hide)}
      <button id="clr" class="btn ghost">Clear watch history</button><button id="rst" class="btn ghost">Clear library and rescan</button>`, back);
    flag("h", "hide");
    $("clr").onclick = () => { pos = {}; ud.seen = {}; localStorage.setItem(POS, "{}"); saveUd(); $("clr").textContent = "History cleared"; };
    $("rst").onclick = () => { library = []; localStorage.setItem(LIB, "[]"); home(); rescan(); };
  } else if (k === "stats") {
    const gs = groups();
    const cell = (n, t) => `<div class="stat"><b>${n}</b><small>${t}</small></div>`;
    page("Watch statistics", `<div class="stats">${cell(gs.filter((g) => !isSeries(g)).length, "Movies")}${cell(gs.filter(isSeries).length, "Series")}
      ${cell(gs.filter(watched).length, "Watched")}${cell(gs.filter(started).length, "In progress")}${cell(Object.keys(ud.wl).filter((x) => ud.wl[x]).length, "Watchlist")}${cell(Object.keys(ud.fav).filter((x) => ud.fav[x]).length, "Favorites")}</div>${watchTime()}`, back);
  } else if (k === "appearance") {
    const cols = ["#B88CFF", "#4FC3F7", "#81C784", "#FFB74D", "#F06292"];
    page("Appearance", `<p class="muted nopad">Accent colour</p><div class="swatches">${cols.map((c) => `<button class="swatch ${c === settings.accent ? "on" : ""}" data-c="${c}" style="background:${c}"></button>`).join("")}</div>${sel("tx", "Text size", [15, 16, 17, 18, 20], settings.text)}`, back);
    document.querySelectorAll(".swatch").forEach((b) => (b.onclick = () => { settings.accent = b.dataset.c; save(); applyTheme(); settingsPage("appearance"); }));
    $("tx").onchange = (e) => { settings.text = Number(e.target.value); save(); applyTheme(); };
  } else if (k === "network") {
    page("Network & Download", `${sel("bf", "Buffer ahead (seconds)", [20, 40, 90], settings.buffer)}${sw("sv", "Data saver: start with the smallest file", settings.saver)}
      <p class="muted nopad">NWFlix streams straight from Telegram and never downloads whole movies. A bigger buffer plays smoother on slow networks but uses more data and memory. Use Wi-Fi for HD files.</p>`, back);
    num("bf", "buffer"); flag("sv", "saver");
  } else if (k === "storage") {
    const kb = (key) => Math.round((localStorage.getItem(key) || "").length / 1024) + " KB";
    page("Storage & Cache", `<div class="sgroup">${[["Library and movie details", LIB], ["Watch progress", POS], ["Lists and watched marks", "nwios_user"], ["Watch time", "nwios_time"]].map(([t, key]) => `<div class="srow"><span class="stx"><b>${t}</b></span><small>${kb(key)}</small></div>`).join("")}</div>
      <button id="cd" class="btn ghost">Clear saved movie details</button><button id="cl" class="btn ghost">Clear library cache</button><button id="ch" class="btn ghost">Clear watch history</button>`, back);
    $("cd").onclick = () => { library.forEach((m) => ["tmdb", "series", "name", "rating", "overview", "poster", "backdrop", "runtime", "genres", "cast", "tried"].forEach((x) => delete m[x])); localStorage.setItem(LIB, JSON.stringify(library)); home(); enrichAll(); };
    $("cl").onclick = () => { library = []; localStorage.setItem(LIB, "[]"); home(); rescan(); };
    $("ch").onclick = () => { pos = {}; ud.seen = {}; localStorage.setItem(POS, "{}"); saveUd(); $("ch").textContent = "History cleared"; };
  } else if (k === "help") {
    page("Help & Support", `<div class="sgroup">
      <button class="srow" id="h1"><span class="stx"><b>Where to find the login code</b><small>English and മലയാളം</small></span><i class="chev">›</i></button>
      <button class="srow" id="h2"><span class="stx"><b>How to get movies in NWFlix</b><small>English and മലയാളം</small></span><i class="chev">›</i></button>
      <button class="srow" id="h3"><span class="stx"><b>Add to Home Screen</b><small>Open NWFlix like a real app</small></span><i class="chev">›</i></button></div>`, back);
    $("h1").onclick = () => guides.openGuide("otp");
    $("h2").onclick = () => guides.openGuide("movies");
    $("h3").onclick = () => a2hs(true);
  }
}

function legalView(k) {
  const p = legal.PAGES[k];
  view(`<header class="bar"><button id="b" class="ico">Back</button><b>${p.title}</b><span></span></header>
    <div class="doc">${p.sections.map(([h, t], i) => `<h3>${i + 1}. ${esc(h)}</h3><p>${esc(t)}</p>`).join("")}</div>`);
  document.getElementById("b").onclick = settingsView;
}

function aboutView() {
  const c = legal.CONTACT;
  view(`<header class="bar"><button id="b" class="ico">Back</button><b>About</b><span></span></header>
    <div class="doc center"><img src="icon.png" width="84" height="84" alt=""><h2>NWFlix iOS</h2><p class="muted">Version 1.0</p>
      <p>Made by Mohammed Rinshan (NIGHTWALKER).</p>
      <a class="btn" href="mailto:${c.mail}?subject=NWFlix%20iOS%20help">Contact & report a bug</a>
      <a class="btn ghost" href="${c.telegram}" target="_blank" rel="noopener">Telegram</a>
      <a class="btn ghost" href="${c.instagram}" target="_blank" rel="noopener">Instagram</a>
      <h3>Credits</h3>
      <p class="muted">Telegram access by the open source GramJS library.</p>
      <p class="muted">This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      <p class="muted">NWFlix iOS is not affiliated with or endorsed by Telegram. NWFlix iOS does not host any movies.</p></div>`);
  document.getElementById("b").onclick = settingsView;
}

boot();
