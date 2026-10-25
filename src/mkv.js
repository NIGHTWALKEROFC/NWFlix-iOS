import { readRange } from "./tg.js";

const vlen = (b, p) => { let l = 1, m = 0x80; while (l < 8 && !(b[p] & m)) { l++; m >>= 1; } return l; };
const rid = (b, p) => { const l = vlen(b, p); let v = 0; for (let i = 0; i < l; i++) v = v * 256 + b[p + i]; return [v, l]; };
const rsz = (b, p) => {
  const l = vlen(b, p), mask = 0xff >> l;
  let v = b[p] & mask, unk = v === mask;
  for (let i = 1; i < l; i++) { v = v * 256 + b[p + i]; if (b[p + i] !== 0xff) unk = false; }
  return [unk ? -1 : v, l];
};
const uint = (b, s, n) => { let v = 0; for (let i = 0; i < n; i++) v = v * 256 + b[s + i]; return v; };
const flt = (b, s, n) => { const d = new DataView(b.buffer, b.byteOffset + s, n); return n === 4 ? d.getFloat32(0) : d.getFloat64(0); };

function kids(b, s, e) {
  const out = [];
  let p = s;
  while (p + 2 <= Math.min(e, b.length)) {
    const [id, il] = rid(b, p);
    const [sz, sl] = rsz(b, p + il);
    const ds = p + il + sl;
    out.push({ id, p, ds, sz, end: sz < 0 ? e : ds + sz });
    if (sz < 0) break;
    p = ds + sz;
  }
  return out;
}

function parseCues(b, k, seg, scale) {
  const out = [];
  for (const cp of kids(b, k.ds, k.end)) {
    if (cp.id !== 0xBB) continue;
    let t = 0, pos = -1;
    for (const x of kids(b, cp.ds, cp.end)) {
      if (x.id === 0xB3) t = uint(b, x.ds, x.end - x.ds);
      if (x.id === 0xB7) for (const y of kids(b, x.ds, x.end)) if (y.id === 0xF1) pos = seg + uint(b, y.ds, y.end - y.ds);
    }
    if (pos >= 0) out.push({ t: (t * scale) / 1e6, pos });
  }
  return out;
}

async function openFile(item) {
  const head = await readRange(item, 0, 3 * 1048576);
  const [, il] = rid(head, 0);
  const [hs, sl] = rsz(head, il);
  const sp = il + sl + hs;
  const [, sil] = rid(head, sp);
  const [, ssl] = rsz(head, sp + sil);
  const seg = sp + sil + ssl;
  const f = { scale: 1e6, dur: 0, tracks: [], cues: [], first: -1, seg };
  let cuesAt = -1;
  for (const k of kids(head, seg, head.length)) {
    if (k.id === 0x1549A966) {
      for (const x of kids(head, k.ds, k.end)) {
        if (x.id === 0x2AD7B1) f.scale = uint(head, x.ds, x.end - x.ds);
        if (x.id === 0x4489) f.dur = flt(head, x.ds, x.end - x.ds);
      }
    } else if (k.id === 0x1654AE6B) {
      for (const te of kids(head, k.ds, k.end)) {
        if (te.id !== 0xAE) continue;
        const t = { num: 0, type: 0, codec: "", priv: null, w: 0, h: 0, rate: 48000, ch: 2 };
        for (const x of kids(head, te.ds, te.end)) {
          if (x.id === 0xD7) t.num = uint(head, x.ds, x.end - x.ds);
          if (x.id === 0x83) t.type = uint(head, x.ds, x.end - x.ds);
          if (x.id === 0x86) t.codec = String.fromCharCode(...head.subarray(x.ds, x.end));
          if (x.id === 0x63A2) t.priv = head.slice(x.ds, x.end);
          if (x.id === 0xE0) for (const y of kids(head, x.ds, x.end)) { if (y.id === 0xB0) t.w = uint(head, y.ds, y.end - y.ds); if (y.id === 0xBA) t.h = uint(head, y.ds, y.end - y.ds); }
          if (x.id === 0xE1) for (const y of kids(head, x.ds, x.end)) { if (y.id === 0xB5) t.rate = Math.round(flt(head, y.ds, y.end - y.ds)); if (y.id === 0x9F) t.ch = uint(head, y.ds, y.end - y.ds); }
        }
        f.tracks.push(t);
      }
    } else if (k.id === 0x114D9B74) {
      for (const s of kids(head, k.ds, k.end)) {
        if (s.id !== 0x4DBB) continue;
        let id = 0, pos = 0;
        for (const x of kids(head, s.ds, s.end)) { if (x.id === 0x53AB) id = uint(head, x.ds, x.end - x.ds); if (x.id === 0x53AC) pos = uint(head, x.ds, x.end - x.ds); }
        if (id === 0x1C53BB6B) cuesAt = seg + pos;
      }
    } else if (k.id === 0x1C53BB6B && k.end <= head.length) f.cues = parseCues(head, k, seg, f.scale);
    else if (k.id === 0x1F43B675) { f.first = k.p; break; }
  }
  if (!f.cues.length && cuesAt > 0) {
    const cb = await readRange(item, cuesAt, 4 * 1048576);
    const k = kids(cb, 0, cb.length)[0];
    if (k && k.id === 0x1C53BB6B) f.cues = parseCues(cb, k, seg, f.scale);
  }
  f.seconds = (f.dur * f.scale) / 1e9;
  return f;
}

async function* clusters(item, pos, tok) {
  let buf = new Uint8Array(0), base = pos;
  const more = async () => {
    const next = await readRange(item, base + buf.length, 2 * 1048576);
    if (!next.length) return false;
    const nb = new Uint8Array(buf.length + next.length);
    nb.set(buf); nb.set(next, buf.length); buf = nb;
    return true;
  };
  if (!(await more())) return;
  while (!tok.stop) {
    while (buf.length < 16) if (!(await more())) return;
    const [id, il] = rid(buf, 0);
    const [sz, sl] = rsz(buf, il);
    if (sz < 0) return;
    const tot = il + sl + sz;
    while (buf.length < tot) if (!(await more())) return;
    if (id === 0x1F43B675) yield buf.subarray(il + sl, tot);
    buf = buf.subarray(tot); base += tot;
  }
}

function frames(c, scale) {
  const out = [];
  let tc = 0;
  for (const k of kids(c, 0, c.length)) {
    if (k.id === 0xE7) tc = uint(c, k.ds, k.end - k.ds);
    let b = null, key = true;
    if (k.id === 0xA3) b = k;
    if (k.id === 0xA0) for (const x of kids(c, k.ds, k.end)) { if (x.id === 0xA1) b = x; if (x.id === 0xFB) key = false; }
    if (!b) continue;
    const [tn, tl] = rsz(c, b.ds);
    const rel = (c[b.ds + tl] << 8) | c[b.ds + tl + 1];
    const flags = c[b.ds + tl + 2];
    if ((flags >> 1) & 3) continue;
    if (k.id === 0xA3) key = !!(flags & 0x80);
    out.push({ tn, ms: ((tc + (rel > 32767 ? rel - 65536 : rel)) * scale) / 1e6, key, data: c.subarray(b.ds + tl + 3, b.end) });
  }
  return out;
}

const u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = (n) => [(n >> 8) & 255, n & 255];
const cat = (...p) => { const a = p.flat(); const o = new Uint8Array(a.reduce((s, x) => s + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const box = (t, ...p) => { const d = cat(...p); return cat(u32(d.length + 8), [...t].map((c) => c.charCodeAt(0)), d); };
const full = (t, v, f, ...p) => box(t, [v, (f >> 16) & 255, (f >> 8) & 255, f & 255], ...p);
const z = (n) => new Array(n).fill(0);

function ac3Info(d) {
  let o = 0;
  while (o < d.length - 8 && !(d[o] === 0x0B && d[o + 1] === 0x77)) o++;
  const bits = []; for (let i = o + 4; i < o + 12; i++) for (let j = 7; j >= 0; j--) bits.push((d[i] >> j) & 1);
  let p = 0; const rd = (n) => { let v = 0; while (n--) v = (v << 1) | bits[p++]; return v; };
  const fscod = rd(2), frm = rd(6), bsid = rd(5), bsmod = rd(3), acmod = rd(3);
  if ((acmod & 1) && acmod !== 1) rd(2);
  if (acmod & 4) rd(2);
  if (acmod === 2) rd(2);
  const lfe = rd(1);
  return [(fscod << 6) | (bsid << 1) | (bsmod >> 2), ((bsmod & 3) << 6) | (acmod << 3) | (lfe << 2) | (frm >> 4), ((frm >> 1) & 31) << 3];
}

const hex = (n) => n.toString(16).padStart(2, "0");
function hevcStr(c) {
  const comp = ((c[2] << 24) | (c[3] << 16) | (c[4] << 8) | c[5]) >>> 0;
  let r = 0; for (let i = 0; i < 32; i++) r = ((r << 1) | ((comp >>> i) & 1)) >>> 0;
  const cs = [...c.subarray(6, 12)]; while (cs.length > 1 && !cs[cs.length - 1]) cs.pop();
  return "hvc1." + ["", "A", "B", "C"][c[1] >> 6] + (c[1] & 31) + "." + r.toString(16) + "." + ((c[1] >> 5) & 1 ? "H" : "L") + c[12] + "." + cs.map((x) => x.toString(16)).join(".");
}

function initSegment(v, a, ac3hdr) {
  const hevc = v.codec.includes("HEVC");
  const ve = box(hevc ? "hvc1" : "avc1", z(6), u16(1), z(16), u16(v.w), u16(v.h), u32(0x480000), u32(0x480000), z(4), u16(1), z(32), u16(0x18), u16(0xffff), box(hevc ? "hvcC" : "avcC", v.priv));
  let ae = null;
  if (a) {
    const head = [z(6), u16(1), z(8), u16(a.ch), u16(16), z(4), u16(a.rate), u16(0)];
    if (a.codec === "A_AAC") {
      const asc = [...a.priv];
      ae = box("mp4a", ...head, full("esds", 0, 0, [3, 23 + asc.length, 0, 1, 0, 4, 15 + asc.length, 0x40, 0x15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, asc.length], asc, [6, 1, 2]));
    } else ae = box("ac-3", ...head, box("dac3", ac3Info(ac3hdr)));
  }
  const trak = (id, type, entry, w, h, ts) => box("trak",
    full("tkhd", 0, 7, u32(0), u32(0), u32(id), u32(0), u32(0), z(8), u16(0), u16(0), u16(type === "soun" ? 0x100 : 0), u16(0), [0, 1, 0, 0, ...z(12), 0, 1, 0, 0, ...z(12), 0x40, 0, 0, 0], u32(w << 16), u32(h << 16)),
    box("mdia", full("mdhd", 0, 0, u32(0), u32(0), u32(ts), u32(0), u16(0x55c4), u16(0)),
      full("hdlr", 0, 0, u32(0), [...type].map((c) => c.charCodeAt(0)), z(12), [0]),
      box("minf", type === "vide" ? full("vmhd", 0, 1, z(8)) : full("smhd", 0, 0, z(4)),
        box("dinf", full("dref", 0, 0, u32(1), full("url ", 0, 1))),
        box("stbl", full("stsd", 0, 0, u32(1), entry), full("stts", 0, 0, u32(0)), full("stsc", 0, 0, u32(0)), full("stsz", 0, 0, u32(0), u32(0)), full("stco", 0, 0, u32(0))))));
  const trex = (id) => full("trex", 0, 0, u32(id), u32(1), u32(0), u32(0), u32(0));
  return cat(box("ftyp", [..."isom"].map((c) => c.charCodeAt(0)), u32(1), [..."isomiso6dash"].map((c) => c.charCodeAt(0))),
    box("moov", full("mvhd", 0, 0, u32(0), u32(0), u32(1000), u32(0), u32(0x10000), u16(0x100), z(10), [0, 1, 0, 0, ...z(12), 0, 1, 0, 0, ...z(12), 0x40, 0, 0, 0], z(24), u32(3)),
      trak(1, "vide", ve, v.w, v.h, 90000), a ? trak(2, "soun", ae, 0, 0, a.rate) : [],
      box("mvex", trex(1), a ? trex(2) : [])));
}

function moof(seq, parts) {
  const build = (offs) => {
    const trafs = parts.map((p, i) => box("traf", full("tfhd", 0, 0x020000, u32(p.id)), full("tfdt", 1, 0, u32(Math.floor(p.base / 4294967296)), u32(p.base >>> 0)),
      full("trun", 1, 0x000f01, u32(p.samples.length), u32(offs[i]), p.samples.map((s) => [u32(s.dur), u32(s.size), u32(s.flags), u32(s.cts >>> 0)]).flat())));
    return box("moof", full("mfhd", 0, 0, u32(seq)), trafs);
  };
  const size = build(parts.map(() => 0)).length;
  let o = size + 8; const offs = parts.map((p) => { const x = o; o += p.data.length; return x; });
  return cat(build(offs), box("mdat", parts.map((p) => p.data)));
}

function fragment(fr, vt, at, seq, ac) {
  const vs = fr.filter((f) => f.tn === vt.num);
  const parts = [];
  if (vs.length) {
    const pts = vs.map((f) => Math.round(f.ms * 90));
    const dts = pts.slice().sort((x, y) => x - y);
    const fallback = Math.round(90000 / 24);
    parts.push({ id: 1, base: dts[0], data: cat(vs.map((f) => f.data)), samples: vs.map((f, i) => ({
      dur: i + 1 < dts.length ? dts[i + 1] - dts[i] : i ? dts[i] - dts[i - 1] : fallback, size: f.data.length, flags: f.key ? 0x02000000 : 0x01010000, cts: pts[i] - dts[i] })) });
  }
  const as = at ? fr.filter((f) => f.tn === at.num) : [];
  if (as.length) {
    const d = at.codec === "A_AAC" ? 1024 : 1536;
    parts.push({ id: 2, base: Math.round((as[0].ms * at.rate) / 1000), data: cat(as.map((f) => f.data)), samples: as.map((f) => ({ dur: d, size: f.data.length, flags: 0x02000000, cts: 0 })) });
  }
  return parts.length ? moof(seq, parts) : null;
}

export async function attach(video, item) {
  const MS = window.ManagedMediaSource || window.MediaSource;
  if (!MS) throw new Error("This iPhone is too old to play MKV files. Update iOS.");
  const f = await openFile(item);
  const vt = f.tracks.find((t) => t.type === 1 && (t.codec.includes("AVC") || t.codec.includes("HEVC")));
  if (!vt || !vt.priv) throw new Error("This MKV uses a video format iPhones cannot play.");
  const at = f.tracks.find((t) => t.type === 2 && (t.codec === "A_AAC" || t.codec === "A_AC3") && (t.codec !== "A_AAC" || t.priv)) || null;
  const probe = { stop: false };
  let ac3hdr = null;
  if (at && at.codec === "A_AC3") for await (const c of clusters(item, f.first, probe)) { const x = frames(c, f.scale).find((y) => y.tn === at.num); ac3hdr = x && x.data; break; }
  const vcodec = vt.codec.includes("HEVC") ? hevcStr(vt.priv) : "avc1." + hex(vt.priv[1]) + hex(vt.priv[2]) + hex(vt.priv[3]);
  const acodec = at ? (at.codec === "A_AAC" ? "mp4a.40." + (at.priv[0] >> 3) : "ac-3") : "";
  const mime = 'video/mp4; codecs="' + vcodec + (acodec ? "," + acodec : "") + '"';
  if (!MS.isTypeSupported(mime)) throw new Error("This iPhone cannot play this MKV (" + vcodec + ").");
  const init = initSegment(vt, at, ac3hdr);
  const ms = new MS();
  video.disableRemotePlayback = true;
  video.src = URL.createObjectURL(ms);
  await new Promise((r) => ms.addEventListener("sourceopen", r, { once: true }));
  if (f.seconds) ms.duration = f.seconds;
  const sb = ms.addSourceBuffer(mime);
  const idle = () => (sb.updating ? new Promise((r) => sb.addEventListener("updateend", r, { once: true })) : null);
  const append = async (d) => { await idle(); sb.appendBuffer(d); await idle(); await new Promise((r) => setTimeout(r, 0)); };
  const clear = async (a, b) => { await idle(); if (sb.buffered.length) { sb.remove(a, b); await idle(); } };
  const sleep = (n) => new Promise((r) => setTimeout(r, n));
  const ahead = () => { for (let i = 0; i < sb.buffered.length; i++) if (video.currentTime >= sb.buffered.start(i) - 0.3 && video.currentTime <= sb.buffered.end(i)) return sb.buffered.end(i) - video.currentTime; return 0; };
  const has = (t) => { for (let i = 0; i < sb.buffered.length; i++) if (t >= sb.buffered.start(i) && t < sb.buffered.end(i)) return true; return false; };
  let tok = { stop: true }, seq = 1;

  const run = async (pos) => {
    tok.stop = true;
    const my = (tok = { stop: false });
    await sleep(30);
    try { await idle(); sb.abort(); } catch (e) {}
    await clear(0, Infinity);
    await append(init);
    try {
      for await (const c of clusters(item, pos, my)) {
        if (my.stop) return;
        const fr = fragment(frames(c, f.scale), vt, at, seq++);
        if (fr) await append(fr);
        while (!my.stop && ahead() > 40) {
          await sleep(500);
          if (video.currentTime > 60 && sb.buffered.length && sb.buffered.start(0) < video.currentTime - 60) await clear(0, video.currentTime - 30);
        }
      }
      if (!my.stop && ms.readyState === "open") ms.endOfStream();
    } catch (e) { if (!my.stop) video.dispatchEvent(new Event("error")); }
  };

  video.addEventListener("seeking", () => {
    const t = video.currentTime;
    if (has(t)) return;
    let best = f.first;
    for (const c of f.cues) if (c.t / 1000 <= t) best = c.pos;
    run(best);
  });
  run(f.first);
  return { note: at || !f.tracks.some((t) => t.type === 2) ? "" : "This file's audio format isn't supported, so it plays without sound.", destroy() { tok.stop = true; } };
}
