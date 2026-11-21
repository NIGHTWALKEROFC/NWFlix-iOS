import { readRange } from "./tg.js";

const KEY = "nwios_dl";
const STEP = 2 * 1048576;
let db = {};
try { db = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { db = {}; }
Object.values(db).forEach((d) => { if (d.state === "run" || d.state === "queued") d.state = "paused"; });

let worker = null;
try { if (typeof Worker !== "undefined") worker = new Worker("dl-worker.js"); } catch (e) { worker = null; }

const listeners = new Set();
const running = new Set();
const stopped = new Set();
const queue = [];
const waits = new Map();
let seq = 0, tickAt = 0;

if (worker) {
  worker.onmessage = (e) => {
    const w = waits.get(e.data.id);
    if (!w) return;
    waits.delete(e.data.id);
    if (e.data.error) w.rej(new Error(e.data.error)); else w.res(e.data);
  };
}

const call = (msg, transfer) => new Promise((res, rej) => {
  const rid = ++seq;
  waits.set(rid, { res, rej });
  worker.postMessage(Object.assign({ rid }, msg), transfer || []);
});

const nameOf = (id) => "dl_" + String(id).replace(/[^A-Za-z0-9_-]/g, "_") + ".bin";
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
const emit = () => listeners.forEach((f) => { try { f(); } catch (e) {} });

export const supported = () => !!(worker && navigator.storage && navigator.storage.getDirectory);
export const onChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
export const all = () => Object.values(db).sort((a, b) => b.at - a.at);
export const get = (id) => db[id] || null;
export const isDone = (id) => !!(db[id] && db[id].state === "done");

async function pump() {
  if (running.size || !queue.length) return;
  const id = queue.shift();
  const e = db[id];
  if (!e) { pump(); return; }
  running.add(id);
  stopped.delete(id);
  e.state = "run";
  e.err = "";
  emit();
  const name = nameOf(id);
  try {
    const o = await call({ cmd: "open", name });
    let at = Math.min(o.size, e.size);
    e.done = at;
    while (at < e.size && !stopped.has(id)) {
      const chunk = await readRange(e.item, at, STEP);
      if (!chunk.length) throw new Error("The download stopped. Please try again.");
      const buf = chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength);
      await call({ cmd: "write", name, buf, at }, [buf]);
      at += chunk.length;
      e.done = at;
      const now = Date.now();
      if (now - tickAt > 400) { tickAt = now; emit(); }
    }
    await call({ cmd: "close", name });
    e.state = at >= e.size ? "done" : "paused";
  } catch (err) {
    e.state = "error";
    e.err = String((err && err.message) || err);
    try { await call({ cmd: "close", name }); } catch (x) {}
  }
  running.delete(id);
  persist();
  emit();
  pump();
}

export function start(item, meta) {
  if (!supported()) return false;
  const id = item.id;
  if (db[id] && db[id].state === "done") return true;
  db[id] = Object.assign({ id, item, size: item.size, done: (db[id] && db[id].done) || 0, state: "queued", at: Date.now(), err: "" }, meta || {});
  persist();
  if (!queue.includes(id) && !running.has(id)) queue.push(id);
  emit();
  pump();
  return true;
}

export function pause(id) {
  stopped.add(id);
  const i = queue.indexOf(id);
  if (i >= 0) queue.splice(i, 1);
  if (db[id] && !running.has(id)) { db[id].state = "paused"; persist(); emit(); }
}

export function resume(id) {
  const e = db[id];
  if (!e || e.state === "done") return;
  e.state = "queued";
  stopped.delete(id);
  if (!queue.includes(id) && !running.has(id)) queue.push(id);
  emit();
  pump();
}

export async function remove(id) {
  stopped.add(id);
  const i = queue.indexOf(id);
  if (i >= 0) queue.splice(i, 1);
  const wait = async () => { for (let n = 0; n < 50 && running.has(id); n++) await new Promise((r) => setTimeout(r, 100)); };
  await wait();
  try { if (worker) await call({ cmd: "remove", name: nameOf(id) }); } catch (e) {}
  delete db[id];
  persist();
  emit();
}

export async function file(id) {
  const root = await navigator.storage.getDirectory();
  const fh = await root.getFileHandle(nameOf(id));
  return fh.getFile();
}

export async function usage() {
  const used = all().reduce((a, d) => a + (d.done || 0), 0);
  let quota = 0;
  try { const est = await navigator.storage.estimate(); quota = est.quota || 0; } catch (e) {}
  return { used, quota };
}
