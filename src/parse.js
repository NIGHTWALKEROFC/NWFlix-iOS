const VIDEO_EXT = new Set(["mkv", "mp4", "avi", "mov", "webm", "m4v", "ts", "wmv", "flv", "mpg", "mpeg", "3gp"]);
const SXXEYY = /\bS(\d{1,2})[ ._-]?E(\d{1,3})(?:[ ._-]?E\d{1,3})*\b/i;
const NXNN = /\b(\d{1,2})x(\d{2,3})\b/i;
const SEASON_EP = /\bseason[ ._-]?(\d{1,2})[ ._-]+(?:episode|ep)[ ._-]?(\d{1,3})\b/i;
const PART = /(?<![a-z0-9])(cd|disc|disk|part|pt)[ ._-]?(\d)(?![0-9a-z])/i;
const DISC_ONLY = /(?<![a-z0-9])(cd|disc|disk)[ ._-]?(\d)(?![0-9a-z])/gi;
const YEAR = /(?<![0-9])(19[2-9][0-9]|20[0-4][0-9])(?![0-9])/g;
const JUNK = /\b(2160p|1080p|720p|576p|480p|4k|uhd|bluray|blu-ray|brrip|bdrip|webrip|web-dl|webdl|web|hdrip|hdtv|dvdrip|dvdscr|x264|x265|h264|h265|hevc|avc|10bit|8bit|aac|ac3|eac3|dts|ddp?5?|atmos|hdr10?|hdr|dv|remux|proper|extended|unrated|repack|yify|yts|rarbg|dual|multi|esubs?|subs?|hindi|tamil|telugu|malayalam|english|dubbed|hdcam|camrip|hdts|hdtc|predvd|amzn|nf|dsnp|zee5|hotstar|sonyliv|atvp|hmax|tamilmv|tamilblasters|tamilrockers|mkvcinemas|hdhub4u|vegamovies|filmyzilla|bolly4u|katmoviehd|moviesmod|mlwbd|jiorockers)\b.*/i;
const WWW_PREFIX = /^\s*(?:https?:\/\/)?www\.[a-z0-9-]+\.[a-z]{2,6}\b[\s._-]*/i;
const DIGIT_SITE = /^\s*[a-z0-9-]*\d[a-z0-9-]*\.(?:com|net|org|xyz|cc|ws|lol|club|site|vip|link|ink|io)\b[\s._-]*/i;
const SITE_DASH = /^\s*[a-z0-9-]+\.(?:com|net|org|xyz|cc|ws|co|in|me|tv)\s+[-–]\s+/i;
const HANDLE = /^\s*@[A-Za-z0-9_]+(?:\s+[-–:|]\s*|\s+)/;
const BRACKETS = /^\s*(?:\[[^\]]*\]|\{[^}]*\})[\s._-]*/;
const TAG_WORD = /^[A-Z]{2,5}[\s_-]+(?=\S)/;
const TAG_GLUED = /^[A-Z]{1,4}(?=[A-Z][a-z]{2,})/;

export const extension = (n) => (n.includes(".") ? n.split(".").pop().toLowerCase() : "");
const stripExt = (n) => (VIDEO_EXT.has(extension(n)) ? n.slice(0, n.lastIndexOf(".")) : n);

let handles = [];
const TOKEN = /[^_\s.\-]+/g;

export function learnHandles(names) {
  const stems = [...new Set(names.map((n) => stripExt(n).trim()).filter((s) => s.startsWith("@")))]
    .map((s) => (s.match(TOKEN) || []).slice(0, 7).map((x) => x.toLowerCase())).filter((t) => t.length >= 2);
  const count = new Map(), next = new Map();
  for (const t of stems) for (let k = 1; k <= Math.min(5, t.length - 1); k++) {
    const key = t.slice(0, k).join("_");
    count.set(key, (count.get(key) || 0) + 1);
    if (!next.has(key)) next.set(key, new Set());
    next.get(key).add(t[k]);
  }
  const found = new Map();
  for (const t of stems) for (let k = 1; k <= Math.min(5, t.length - 1); k++) {
    const key = t.slice(0, k).join("_");
    if ((count.get(key) || 0) >= 3 && (next.get(key) ? next.get(key).size : 0) >= 3) { found.set(key, t.slice(0, k)); break; }
  }
  handles = [...found.values()].sort((a, b) => b.length - a.length);
}

function stripHandle(raw) {
  const t = raw.trimStart();
  if (!t.startsWith("@")) return raw;
  const toks = [...t.matchAll(TOKEN)].slice(0, 6);
  for (const h of handles) {
    if (toks.length > h.length && h.every((x, i) => toks[i][0].toLowerCase() === x)) {
      const last = toks[h.length - 1];
      return t.slice(last.index + last[0].length).replace(/^[_ .\-]+/, "");
    }
  }
  return t.replace(HANDLE, "");
}

function stripPrefixes(raw) {
  let t = raw;
  for (let i = 0; i < 4; i++) {
    const before = t;
    t = stripHandle(t.replace(WWW_PREFIX, "").replace(DIGIT_SITE, "").replace(SITE_DASH, "")).replace(BRACKETS, "");
    if (t === before) break;
  }
  return t;
}

function episodeOf(text) {
  let m = SXXEYY.exec(text) || SEASON_EP.exec(text) || NXNN.exec(text);
  return m ? { s: Number(m[1]), e: Number(m[2]), at: m.index } : null;
}

function fromText(raw) {
  let t = stripPrefixes(raw).replace(/[._]+/g, " ").replace(/[\[\](){}]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const ym = [...t.matchAll(YEAR)].find((x) => x.index > 0);
  if (ym) {
    const title = t.slice(0, ym.index).replace(/^[\s\-(\[]+|[\s\-(\[]+$/g, "");
    return title ? { title, year: Number(ym[1]) } : null;
  }
  const title = t.replace(JUNK, "").replace(/^[\s-]+|[\s-]+$/g, "");
  return title.length < 2 ? null : { title, year: 0 };
}

export function looksLikeMovie(r) {
  if (!(VIDEO_EXT.has(extension(r.name)) || r.mime.startsWith("video/"))) return false;
  const ep = !!episodeOf(stripExt(r.name));
  const mb = 1048576;
  if (r.dur > 0) return r.dur >= (ep ? 600 : 2400) || r.size >= (ep ? 120 : 700) * mb;
  return r.size >= (ep ? 60 : 350) * mb;
}

export function parse(fileName, caption) {
  const base = stripExt(fileName);
  const line = (caption || "").split("\n").find((l) => l.trim());
  const ep = episodeOf(base);
  if (ep) {
    let p = fromText(base.slice(0, ep.at));
    if (!p && line) { const e = episodeOf(line); if (e) p = fromText(line.slice(0, e.at)); }
    return p ? { title: p.title, year: p.year, season: ep.s, episode: ep.e, part: 0 } : null;
  }
  const pm = PART.exec(base);
  const part = pm ? Number(pm[2]) : 0;
  const cleaned = base.replace(DISC_ONLY, " ");
  const p = fromText(cleaned);
  if (p) return { title: p.title, year: p.year, season: 0, episode: 0, part };
  if (line && !episodeOf(line)) { const q = fromText(line.trim()); if (q) return { title: q.title, year: q.year, season: 0, episode: 0, part }; }
  const fb = cleaned.replace(/[._]+/g, " ").trim();
  return fb ? { title: fb, year: 0, season: 0, episode: 0, part } : null;
}

export function titleVariants(title) {
  const t = title.trim();
  const w = t.split(" ").filter(Boolean);
  const out = new Set();
  if (t.startsWith("@")) {
    for (let k = 1; k <= 4; k++) if (w.length > k) out.add(w.slice(k).join(" "));
    out.add(t.replace(/^@+/, ""));
  } else {
    out.add(t);
    out.add(t.replace(TAG_WORD, "").trim());
    out.add(t.replace(TAG_GLUED, "").trim());
    if (w.length >= 3) out.add(w.slice(0, -1).join(" "));
    if (w.length >= 4) out.add(w.slice(0, -2).join(" "));
    if (w.length >= 3 && w[0].length <= 6) out.add(w.slice(1).join(" "));
    if (w.length >= 4 && w[0].length <= 6 && w[1].length <= 6) out.add(w.slice(2).join(" "));
  }
  return [...out].filter((x) => x.length >= 2);
}
