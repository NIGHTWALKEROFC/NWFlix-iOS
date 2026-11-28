import { readRange } from "./tg.js";

const KEY = "nwios_dl";
const STEP = 2 * 1048576;
let db = {};
try { db = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { db = {}; }
Object.values(db).forEach((d) => { if (d.state === "run" || d.state === "queued") d.state = "paused"; });

const listeners = new Set();
const stopped = new Set();
const queue = [];
let running = "";
let tickAt = 0;
let dbp = null;

const open = () => dbp || (dbp = new Promise((res, rej) => {
  const r = indexedDB.open("nwios_dl_files", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("c");
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
}));

const tx = async (mode, fn) => {
  const d = await open();
  return new Promise((res, rej) => {
    const t = d.transaction("c", mode);
    let out;
    try { out = fn(t.objectStore("c")); } catch (e) { rej(e); return; }
    t.oncomplete = () => res(out ? out.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
};

const range = (id) => IDBKeyRange.bound(id + "#", id + "#\uffff");
const key = (id, i) => id + "#" + String(i).padStart(6, "0");
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
const emit = () => listeners.forEach((f) => { try { f(); } catch (e) {} });

export const supported = () => typeof indexedDB !== "undefined";
export const onChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
export const all = () => Object.values(db).sort((a, b) => b.at - a.at);
export const get = (id) => db[id] || null;
export const isDone = (id) => !!(db[id] && db[id].state === "done");

async function pump() {
  if (running || !queue.length) return;
  const id = queue.shift();
  const e = db[id];
  if (!e || e.state === "done") { pump(); return; }
  running = id;
  e.state = "run";
  e.err = "";
  emit();
  try {
    let idx = await tx("readonly", (s) => s.count(range(id)));
    let at = Math.min(idx * STEP, e.size);
    e.done = at;
    emit();
    while (at < e.size && db[id] && !stopped.has(id)) {
      const chunk = await readRange(e.item, at, STEP);
      if (!chunk.length) throw new Error("The download stopped. Please try again.");
      await tx("readwrite", (s) => s.put(new Blob([chunk]), key(id, idx)));
      idx++;
      at += chunk.length;
      e.done = at;
      const now = Date.now();
      if (now - tickAt > 500) { tickAt = now; emit(); }
    }
    if (db[id]) e.state = at >= e.size ? "done" : "paused";
  } catch (err) {
    if (db[id]) {
      e.state = "error";
      e.err = err && err.name === "QuotaExceededError" ? "Not enough storage on this device." : String((err && err.message) || err);
    }
  }
  running = "";
  persist();
  emit();
  pump();
}

export function start(item, meta) {
  if (!supported()) return false;
  const id = item.id;
  if (db[id] && db[id].state === "done") return true;
  db[id] = Object.assign({ id, item, size: item.size, done: (db[id] && db[id].done) || 0, state: "queued", at: Date.now(), err: "", auto: true }, meta || {});
  stopped.delete(id);
  persist();
  if (!queue.includes(id) && running !== id) queue.push(id);
  emit();
  pump();
  return true;
}

export function pause(id) {
  const e = db[id];
  if (!e || e.state === "done") return;
  stopped.add(id);
  const i = queue.indexOf(id);
  if (i >= 0) queue.splice(i, 1);
  e.state = "paused";
  e.auto = false;
  persist();
  emit();
}

export function resume(id) {
  const e = db[id];
  if (!e || e.state === "done") return;
  e.state = "queued";
  e.auto = true;
  e.err = "";
  stopped.delete(id);
  if (!queue.includes(id) && running !== id) queue.push(id);
  persist();
  emit();
  pump();
}

export function resumeAll() {
  Object.values(db).forEach((d) => { if (d.auto && d.state === "paused") resume(d.id); });
}

export async function remove(id) {
  stopped.add(id);
  const i = queue.indexOf(id);
  if (i >= 0) queue.splice(i, 1);
  delete db[id];
  persist();
  emit();
  for (let n = 0; n < 100 && running === id; n++) await new Promise((r) => setTimeout(r, 100));
  try { await tx("readwrite", (s) => s.delete(range(id))); } catch (e) {}
}

export async function file(id) {
  const parts = await tx("readonly", (s) => s.getAll(range(id)));
  const e = db[id];
  return new Blob(parts, { type: (e && e.item && e.item.mime) || "video/mp4" });
}

export async function usage() {
  const used = all().reduce((a, d) => a + (d.done || 0), 0);
  let quota = 0;
  try { const est = await navigator.storage.estimate(); quota = est.quota || 0; } catch (e) {}
  return { used, quota };
}
