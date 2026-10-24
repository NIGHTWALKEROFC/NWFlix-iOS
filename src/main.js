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
let settings = Object.assign({ speed: 1, skip: 10, resume: true, hide: true, gestures: true, subSize: 20, subBg: true, stats: true }, JSON.parse(localStorage.getItem(SET) || "{}"));
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
  if (kind === "code") {
    view(`<div class="login"><img src="icon.png" width="96" height="96" alt=""><h1>Enter the code</h1><p class="muted">We sent it to your Telegram app</p>
      <div class="otp"><div class="boxes">${"<i></i>".repeat(5)}</div><input id="v" type="tel" inputmode="numeric" autocomplete="one-time-code" maxlength="5"></div>
      <p id="err" class="bad"></p><button id="gd" class="linkbtn">Where do I find the code?</button></div>`);
    document.getElementById("gd").onclick = () => guides.openGuide("otp");
    const input = document.getElementById("v");
    const boxes = [...document.querySelectorAll(".boxes i")];
    input.focus();
    return new Promise((res) => {
      input.oninput = () => {
        const v = input.value.replace(/\D/g, "");
        input.value = v;
        boxes.forEach((b, i) => { b.textContent = v[i] || ""; b.className = i === v.length ? "cur" : v[i] ? "fill" : ""; });
        if (v.length === 5) res(v);
      };
    });
  }
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
    <button id="ao" class="btn ghost">${installEvt ? "Not now" : "Got it"}</button></div>`;
  document.body.appendChild(b);
  document.getElementById("ao").onclick = () => b.remove();
  const ai = document.getElementById("ai");
  if (ai) ai.onclick = async () => { installEvt.prompt(); await installEvt.userChoice; installEvt = null; b.remove(); };
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
  if (!tg.hasSession()) await rc.logout();
  await gate();
  rc.watchConfig(applyRemote);
  if (settings.stats) rc.heartbeat();
  if (!tg.hasKeys()) { view('<div class="login"><h1>NWFlix iOS</h1><p class="bad">Telegram keys are missing in this build.</p></div>'); return; }
  view('<div class="login"><div class="spin"></div></div>');
  if (!("serviceWorker" in navigator)) { view('<div class="login"><h1>NWFlix iOS</h1><p class="bad">This browser cannot stream. Update iOS and open this page in Safari.</p></div>'); return; }
  let ok = await tg.resume();
  if (!ok) {
    try { await tg.login(ask); ok = true; } catch (e) { view(`<div class="login"><p class="bad">${esc(tg.friendly(e.message || ""))}</p><button class="btn" onclick="location.reload()">Try again</button></div>`); return; }
  }
  await tg.startStreaming(() => library);
  if (!localStorage.getItem("nwios_a2hs")) setTimeout(() => a2hs(false), 1800);
  home();
  if (!library.length) rescan(); else enrichAll();
}

const ud = Object.assign({ fav: {}, wl: {}, seen: {} }, JSON.parse(localStorage.getItem("nwios_user") || "{}"));
const saveUd = () => localStorage.setItem("nwios_user", JSON.stringify(ud));
let scanNote = "";
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
  const best = resumeFile || files[0];
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
  const f = eps[i].files.slice().sort((a, b) => b.size - a.size)[0];
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
    next, onSeen: (f) => { ud.seen[f.id] = 1; saveUd(); }
  });
}

function settingsView() {
  const sw = (id, label, on) => `<label>${label}<input id="${id}" type="checkbox" ${on ? "checked" : ""}></label>`;
  const row = (id, label, sub) => `<button id="${id}" class="link"><span>${label}</span><small>${sub}</small></button>`;
  view(`<header class="bar"><button id="b" class="ico">Back</button><b>Settings</b><span></span></header>
    <div class="list">
      <h3 class="sec">Playback</h3>
      ${sw("r", "Resume where I stopped", settings.resume)}
      ${sw("gs", "Swipe to seek and double-tap to skip", settings.gestures)}
      <label>Skip buttons (seconds)<select id="k">${[5, 10, 15, 30].map((n) => `<option ${n === settings.skip ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <label>Subtitle size<select id="ss">${[16, 20, 24, 28, 34].map((n) => `<option ${n === settings.subSize ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      ${sw("sb", "Subtitle background", settings.subBg)}
      <h3 class="sec">Library</h3>
      ${sw("h", "Hide movies without details", settings.hide)}
      <button id="clr" class="btn ghost">Clear watch history</button>
      <button id="rst" class="btn ghost">Clear library and rescan</button>
      <h3 class="sec">Privacy</h3>
      ${sw("st", "Share anonymous usage statistics", settings.stats)}
      <h3 class="sec">Account</h3>
      <p class="muted nopad">Signed in as ${esc(rc.email())}</p>
      <button id="out" class="btn ghost">Sign out</button>
      <h3 class="sec">Help</h3>
      ${row("h-otp", "Where to find the login code", "Step by step, English and മലയാളം")}
      ${row("h-mov", "How to get movies in NWFlix", "Step by step, English and മലയാളം")}
      ${row("h-a2", "Add to Home Screen", "Open NWFlix like a real app")}
      <h3 class="sec">Legal</h3>
      ${row("l-privacy", "Privacy Policy", "How your information is used")}
      ${row("l-terms", "Terms & Conditions", "Rules for using the app")}
      ${row("l-disclaimer", "Disclaimer & Copyright", "Content and credits")}
      <h3 class="sec">About</h3>
      ${row("l-about", "About NWFlix iOS", "Developer, credits and contact")}
    </div>`);
  const $ = (id) => document.getElementById(id);
  const flag = (id, key) => { $(id).onchange = (e) => { settings[key] = e.target.checked; save(); }; };
  const num = (id, key) => { $(id).onchange = (e) => { settings[key] = Number(e.target.value); save(); }; };
  flag("r", "resume"); flag("gs", "gestures"); flag("sb", "subBg"); flag("h", "hide"); flag("st", "stats"); num("k", "skip"); num("ss", "subSize");
  $("b").onclick = () => home();
  $("clr").onclick = () => { pos = {}; ud.seen = {}; localStorage.setItem(POS, "{}"); saveUd(); $("clr").textContent = "History cleared"; };
  $("rst").onclick = () => { library = []; localStorage.setItem(LIB, "[]"); home(); rescan(); };
  $("out").onclick = async () => { await rc.logout(); tg.logout(); };
  ["privacy", "terms", "disclaimer"].forEach((k) => ($("l-" + k).onclick = () => legalView(k)));
  $("l-about").onclick = aboutView;
  $("h-otp").onclick = () => guides.openGuide("otp");
  $("h-mov").onclick = () => guides.openGuide("movies");
  $("h-a2").onclick = () => a2hs(true);
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
