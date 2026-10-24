import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import bigInt from "big-integer";

const API_ID = Number(import.meta.env.VITE_TG_API_ID || 0);
const API_HASH = import.meta.env.VITE_TG_API_HASH || "";
const SESSION_KEY = "nwios_session";
const CHUNK = 512 * 1024;
const VIDEO_EXT = ["mkv", "mp4", "avi", "mov", "webm", "m4v", "ts", "wmv", "flv", "mpg", "mpeg", "3gp"];
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
  localStorage.removeItem("nwios_lib");
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

const ext = (n) => (n.includes(".") ? n.split(".").pop().toLowerCase() : "");

function looksLikeMovie(r) {
  if (!(VIDEO_EXT.includes(ext(r.name)) || r.mime.startsWith("video/"))) return false;
  const mb = 1024 * 1024;
  if (r.dur > 0) return r.dur >= 40 * 60 || r.size >= 700 * mb;
  return r.size >= 350 * mb;
}

function parse(name) {
  let t = name.replace(/\.[a-z0-9]{2,4}$/i, "").replace(/^\s*(\[[^\]]*\]|\{[^}]*\}|@\w+)[\s._-]*/, "");
  t = t.replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
  const y = /(?<![0-9])(19[2-9]\d|20[0-4]\d)(?![0-9])/.exec(t);
  const junk = /\b(2160p|1080p|720p|576p|480p|4k|uhd|bluray|brrip|bdrip|webrip|web-dl|hdrip|hdtv|dvdrip|x264|x265|h264|h265|hevc|10bit|aac|ac3|dts|hindi|tamil|telugu|malayalam|english|dubbed|esubs?|hdcam|camrip)\b.*/i;
  const title = y && y.index > 0 ? t.slice(0, y.index) : t.replace(junk, "");
  return { title: title.replace(/[-(\[\s]+$/, "").trim() || name, year: y ? Number(y[1]) : 0 };
}

export async function scan(onFound) {
  const dialogs = await client.getDialogs({ limit: 300 });
  const out = [];
  const seen = new Set();
  for (const d of dialogs) {
    for (const F of [Api.InputMessagesFilterVideo, Api.InputMessagesFilterDocument]) {
      try {
        const msgs = await client.getMessages(d.entity, { limit: 100, filter: new F() });
        for (const m of msgs) {
          if (!m.document || !m.file) continue;
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
          if (!looksLikeMovie(r)) continue;
          const dup = r.size + "|" + r.dur;
          if (seen.has(dup)) continue;
          seen.add(dup);
          Object.assign(r, parse(r.name));
          out.push(r);
        }
      } catch (e) {}
    }
    onFound(out.length);
  }
  out.sort((a, b) => b.at - a.at);
  return out;
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
