import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import bigInt from "big-integer";
import { looksLikeMovie, parse, learnHandles } from "./parse.js";

const API_ID = Number(import.meta.env.VITE_TG_API_ID || 0);
const API_HASH = import.meta.env.VITE_TG_API_HASH || "";
const SESSION_KEY = "nwios_session";
const CHUNK = 512 * 1024;
const cache = new Map();

export let client = null;
export const hasKeys = () => API_ID > 0 && API_HASH.length > 0;
export const hasSession = () => !!localStorage.getItem(SESSION_KEY);

async function connect() {
  client = new TelegramClient(new StringSession(localStorage.getItem(SESSION_KEY) || ""), API_ID, API_HASH, {
    connectionRetries: 5,
    deviceModel: "NWFlix iOS",
    appVersion: "1.0"
  });
  await client.connect();
}

export async function resume() {
  if (!hasSession()) return false;
  try {
    await connect();
    if (!(await client.checkAuthorization())) return false;
    loadChats().catch(() => {});
    return true;
  } catch (e) { return false; }
}

export async function login(ask) {
  await connect();
  const creds = { apiId: API_ID, apiHash: API_HASH };
  let phone = "", sent = null, err = "";
  while (!sent) {
    phone = await ask("phone", err);
    try { sent = await client.sendCode(creds, phone); } catch (e) { err = friendly(e.errorMessage || e.message || ""); }
  }
  let hash = sent.phoneCodeHash;
  err = "";
  for (;;) {
    const code = await ask("code", err);
    err = "";
    if (code === "__resend__") {
      try { sent = await client.sendCode(creds, phone, true); hash = sent.phoneCodeHash; err = "A new code was sent."; }
      catch (e) { err = friendly(e.errorMessage || e.message || ""); }
      continue;
    }
    try {
      await client.invoke(new Api.auth.SignIn({ phoneNumber: phone, phoneCodeHash: hash, phoneCode: code }));
      break;
    } catch (e) {
      const m = e.errorMessage || e.message || "";
      if (m === "SESSION_PASSWORD_NEEDED") {
        await client.signInWithPassword(creds, {
          password: () => ask("password", ""),
          onError: async (er) => { ask("error", friendly(er.errorMessage || er.message || "")); return false; }
        });
        break;
      }
      err = friendly(m);
    }
  }
  localStorage.setItem(SESSION_KEY, client.session.save());
}

export async function logout() {
  try { await client.invoke(new Api.auth.LogOut()); } catch (e) {}
  localStorage.removeItem(SESSION_KEY);
  ["nwios_lib", "nwios_user", "nwios_pos", "nwios_fs", "nwios_time"].forEach((k) => localStorage.removeItem(k));
  location.reload();
}

export function friendly(m) {
  if (m.includes("PHONE_NUMBER_INVALID")) return "That phone number isn't valid. Use international format, e.g. +91 98765 43210.";
  if (m.includes("PHONE_CODE_INVALID") || m.includes("PHONE_CODE_EMPTY")) return "That code is wrong. Check the latest code in your Telegram app.";
  if (m.includes("PHONE_CODE_EXPIRED")) return "That code expired. Refresh the page and request a new one.";
  if (m.includes("PASSWORD_HASH_INVALID")) return "Wrong two-step verification password.";
  if (m.includes("FLOOD")) return "Too many attempts. Wait a few minutes and try again.";
  if (m.includes("API_ID")) return "Telegram rejected the api_id / api_hash.";
  return m || "Something went wrong talking to Telegram.";
}

const entities = new Map();
let loading = null;

export function loadChats() {
  loading = (async () => {
    const main = await client.getDialogs({ limit: 500 });
    let arch = [];
    try { arch = await client.getDialogs({ limit: 300, folder: 1 }); } catch (e) {}
    const list = main.concat(arch).filter((d, i, a) => d.entity && a.findIndex((x) => x.id.toString() === d.id.toString()) === i);
    list.forEach((d) => entities.set(d.id.toString(), d));
    return list;
  })();
  return loading;
}

export async function me() {
  try { const u = await client.getMe(); return u.firstName || u.username || ""; } catch (e) { return ""; }
}

export async function scan(onProgress) {
  const dialogs = await loadChats();
  const raws = [], out = [], seen = new Set();
  let next = 0, done = 0, errors = 0, docs = 0, passed = 0, firstErr = "";

  const take = (d, m) => {
    const doc = m.media && m.media.document;
    if (!doc || !doc.attributes) return;
    docs++;
    const fn = doc.attributes.find((a) => a.className === "DocumentAttributeFilename");
    const vd = doc.attributes.find((a) => a.className === "DocumentAttributeVideo");
    const r = {
      id: d.id.toString() + "_" + m.id, chat: d.id.toString(), msg: m.id,
      name: fn ? fn.fileName : "", size: Number(doc.size || 0), dur: vd ? Number(vd.duration || 0) : 0,
      mime: doc.mimeType || "video/mp4", at: (m.date || 0) * 1000
    };
    if (!looksLikeMovie(r)) return;
    passed++;
    if (seen.has(r.id)) return;
    seen.add(r.id);
    r.cap = m.message || "";
    raws.push(r);
  };

  const pages = async (d, F) => {
    const peer = d.inputEntity || (await client.getInputEntity(d.entity));
    let offsetId = 0;
    for (let i = 0; i < 40; i++) {
      const res = await client.invoke(new Api.messages.Search({
        peer, q: "", filter: new F(), minDate: 0, maxDate: 0, offsetId, addOffset: 0, limit: 100, maxId: 0, minId: 0, hash: bigInt(0)
      }));
      const msgs = res.messages || [];
      msgs.forEach((m) => take(d, m));
      if (msgs.length < 100) break;
      offsetId = msgs[msgs.length - 1].id;
    }
  };

  const worker = async () => {
    while (next < dialogs.length) {
      const d = dialogs[next++];
      for (const F of [Api.InputMessagesFilterVideo, Api.InputMessagesFilterDocument]) {
        try { await pages(d, F); } catch (e) { errors++; firstErr = firstErr || String((e && (e.errorMessage || e.message)) || e); }
      }
      done++;
      onProgress(raws.length, done, dialogs.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);

  learnHandles(raws.map((r) => r.name));
  for (const r of raws) {
    const p = parse(r.name, r.cap);
    if (p) out.push(Object.assign(r, p));
  }
  out.sort((a, b) => b.at - a.at);
  return { items: out, errors, firstErr, chats: dialogs.length, docs, passed };
}

async function message(item) {
  if (cache.has(item.id)) return cache.get(item.id);
  await (loading || loadChats());
  const d = entities.get(item.chat);
  if (!d) throw new Error("Chat not found. Rescan and try again.");
  const [m] = await client.getMessages(d.entity, { ids: [item.msg] });

  if (!m || !m.media) throw new Error("File not found in Telegram");
  cache.set(item.id, m);
  return m;
}

export async function readRange(item, start, len) {
  const m = await message(item);
  const end = Math.min(item.size, start + len);
  const first = Math.floor(start / CHUNK) * CHUNK;
  const parts = [];
  let pos = first, total = 0;
  if (start >= item.size) return new Uint8Array(0);
  for await (const c of client.iterDownload({ file: m.media, offset: bigInt(first), requestSize: CHUNK, fileSize: bigInt(item.size) })) {
    parts.push(c); total += c.length; pos += c.length;
    if (pos >= end) break;
  }
  const all = new Uint8Array(total);
  let o = 0;
  for (const c of parts) { all.set(c, o); o += c.length; }
  return all.subarray(start - first, Math.min(total, end - first));
}

export function streamUrl(item) {
  return "stream/" + encodeURIComponent(item.id) + "?size=" + item.size + "&mime=" + encodeURIComponent(item.mime);
}

export async function startStreaming(library) {
  const reg = await navigator.serviceWorker.register("sw.js");
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) await new Promise((res) => {
    navigator.serviceWorker.addEventListener("controllerchange", res, { once: true });
    setTimeout(res, 1500);
  });
  navigator.serviceWorker.addEventListener("message", async (ev) => {
    const d = ev.data;
    if (!d || d.type !== "read") return;
    const port = ev.ports[0];
    let stop = false;
    port.onmessage = () => { stop = true; };
    try {
      const item = library().find((x) => x.id === d.id);
      const m = await message(item);
      const first = Math.floor(d.start / CHUNK) * CHUNK;
      let pos = first;
      for await (const c of client.iterDownload({ file: m.media, offset: bigInt(first), requestSize: CHUNK, fileSize: bigInt(d.size) })) {
        if (stop) break;
        const from = Math.max(0, d.start - pos);
        const to = Math.min(c.length, d.end + 1 - pos);
        if (to > from) {
          const buf = new Uint8Array(c.subarray(from, to)).buffer;
          port.postMessage({ chunk: buf }, [buf]);
        }
        pos += c.length;
        if (pos > d.end) break;
      }
      port.postMessage({ done: true });
    } catch (e) { port.postMessage({ err: String(e && e.message || e) }); }
  });
  return reg;
}
