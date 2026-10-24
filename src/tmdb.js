const KEY = import.meta.env.VITE_TMDB_API_KEY || "";
const BASE = "https://api.themoviedb.org/3";
let nextAt = 0;

export const hasKey = () => KEY.length > 0;
export const img = (p, size = "w342") => (p ? "https://image.tmdb.org/t/p/" + size + p : "");

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/([a-z])\1+/g, "$1").trim();

function lev(a, b) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

function similarity(query, candidate) {
  const q = norm(query), c = norm(candidate);
  if (!q || !c) return 0;
  if (q === c) return 1;
  const a = q.replace(/ /g, ""), b = c.replace(/ /g, "");
  const letters = 1 - lev(a, b) / Math.max(a.length, b.length);
  const qs = new Set(q.split(" ")), cs = new Set(c.split(" "));
  const words = [...qs].filter((w) => cs.has(w)).length / Math.max(qs.size, cs.size);
  return Math.max(letters, words);
}

function pickBest(title, year, hits) {
  let best = null;
  for (const h of hits) {
    const s = Math.max(similarity(title, h.title), similarity(title, h.original));
    const dy = year > 0 && h.year > 0 ? Math.abs(h.year - year) : -1;
    const ok = dy === 0 ? s >= 0.72 : dy === 1 ? s >= 0.8 : dy < 0 ? s >= 0.88 : s >= 0.97;
    if (!ok) continue;
    const score = s + (dy === 0 ? 0.15 : 0);
    if (!best || score > best.score || (score === best.score && h.popularity > best.h.popularity)) best = { h, score };
  }
  return best ? best.h : null;
}

async function get(path, params = {}, attempt = 0) {
  const wait = nextAt - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  nextAt = Math.max(nextAt, Date.now()) + 90;
  const q = new URLSearchParams({ ...params, api_key: KEY, language: "en-US" });
  const r = await fetch(BASE + path + "?" + q);
  if (r.status === 401) throw new Error("auth");
  if (r.status === 429 && attempt < 4) {
    nextAt = Date.now() + 2000 * (attempt + 1);
    return get(path, params, attempt + 1);
  }
  if (!r.ok) throw new Error("tmdb " + r.status);
  return r.json();
}

const yearOf = (d) => Number((d || "").slice(0, 4)) || 0;

async function search(title, year) {
  const run = async (y) => {
    const p = { query: title, include_adult: "false" };
    if (y > 0) p.year = String(y);
    const j = await get("/search/movie", p);
    return (j.results || []).slice(0, 10).map((o) => ({
      id: o.id, title: o.title || "", original: o.original_title || "", year: yearOf(o.release_date), popularity: o.popularity || 0
    }));
  };
  const first = await run(year);
  return first.length || !year ? first : run(0);
}

async function details(id) {
  const o = await get("/movie/" + id, { append_to_response: "credits" });
  const crew = ((o.credits && o.credits.crew) || []).filter((c) => c.job === "Director").slice(0, 2).map((c) => ({ n: c.name, c: "Director" }));
  const cast = ((o.credits && o.credits.cast) || []).slice(0, 10).map((c) => ({ n: c.name, c: c.character || "" }));
  return {
    tmdb: o.id, name: o.title || "", year: yearOf(o.release_date), rating: o.vote_average || 0, overview: o.overview || "",
    poster: o.poster_path || "", backdrop: o.backdrop_path || "", runtime: o.runtime || 0,
    genres: (o.genres || []).map((g) => g.name).join(", "), cast: crew.concat(cast)
  };
}

function variants(title) {
  const w = title.split(" ").filter(Boolean);
  const out = new Set([title]);
  if (w.length >= 3) out.add(w.slice(0, -1).join(" "));
  if (w.length >= 3 && w[0].length <= 6) out.add(w.slice(1).join(" "));
  if (w.length >= 4) out.add(w.slice(0, -2).join(" "));
  return [...out].filter((t) => t.length >= 2);
}

async function matchOne(m) {
  for (const t of variants(m.title)) {
    const hit = pickBest(t, m.year, await search(t, m.year)) || (m.year ? pickBest(t, m.year, await search(t, 0)) : null);
    if (hit) { Object.assign(m, await details(hit.id)); return; }
  }
}

export async function enrich(items, onProgress, onSave) {
  const todo = items.filter((m) => !m.tmdb && !m.tried);
  let done = 0, failed = 0, stop = false;
  const worker = async () => {
    while (todo.length && !stop && failed < 8) {
      const m = todo.shift();
      try { await matchOne(m); m.tried = Date.now(); }
      catch (e) { if (e.message === "auth") stop = true; else failed++; }
      done++;
      onProgress(done, done + todo.length);
      if (done % 15 === 0) onSave();
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  onSave();
}
