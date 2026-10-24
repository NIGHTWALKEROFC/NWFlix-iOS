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
    client.getDialogs({ limit: 200 }).catch(() => {});
    return true;
  } catch (e) { return false; }
}

export async function login(ask) {
  await connect();
  await client.signInUser(
    { apiId: API_ID, apiHash: API_HASH },
    {
      phoneNumber: () => ask("phone"),
      phoneCode: () => ask("code"),
      password: () => ask("password"),
      onError: async (e) => { ask("error", friendly(e.message || String(e))); return false; }
    }
  );
  localStorage.setItem(SESSION_KEY, client.session.save());
}

export async function logout() {
  try { await client.invoke(new Api.auth.LogOut()); } catch (e) {}
  localStorage.removeItem(SESSION_KEY);
  ["nwios_lib", "nwios_user", "nwios_pos", "nwios_fs"].forEach((k) => localStorage.removeItem(k));
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

export async function scan(onProgress) {
  const main = await client.getDialogs({ limit: 500 });
  let archived = [];
  try { archived = await client.getDialogs({ limit: 300, folder: 1 }); } catch (e) {}
  const dialogs = main.concat(archived).filter((d, i, a) => d.entity && a.findIndex((x) => x.id.toString() === d.id.toString()) === i);
  const out = [];
  const raws = [];
  const seen = new Set();
  let done = 0, errors = 0, docs = 0, passed = 0, firstErr = "";

  const take = (d, m) => {
    if (!m.document || !m.file) return;
    docs++;
    const r = {
      id: d.id.toString() + "_" + m.id,
      chat: d.id.toString(),
      msg: m.id,
      name: m.file.name || "",
      size: Number(m.file.size || 0),
      dur: Number(m.file.duration || 0),
      mime: m.file.mimeType || "video/mp4",
      at: (m.date || 0) * 1000
    };
    if (!looksLikeMovie(r)) return;
    passed++;
    const dup = r.id;
    if (seen.has(dup)) return;
    seen.add(dup);
    r.cap = m.message || "";
    raws.push(r);
  };

  const run = async (list, filters, limit) => {
    let next = 0;
    done = 0;
    const worker = async () => {
      while (next < list.length) {
        const d = list[next++];
        for (const F of filters) {
          try {
            const opt = F ? { filter: new F(), limit } : { limit };
            for await (const m of client.iterMessages(d.entity, opt)) take(d, m);
          } catch (e) { errors++; firstErr = firstErr || String((e && e.message) || e); }
        }
        done++;
        onProgress(raws.length, done, list.length);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  };

  await run(dialogs, [Api.InputMessagesFilterVideo, Api.InputMessagesFilterDocument], 2000);
  if (!docs) await run(dialogs.slice(0, 100), [null], 300);
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
  const [m] = await client.getMessages(item.chat, { ids: [item.msg] });
  if (!m || !m.media) throw new Error("File not found in Telegram");
  cache.set(item.id, m);
  return m;
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
