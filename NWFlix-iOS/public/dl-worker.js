const handles = {};
self.onmessage = async (e) => {
  const d = e.data;
  const reply = (extra) => self.postMessage(Object.assign({ id: d.rid }, extra || {}));
  try {
    const root = await navigator.storage.getDirectory();
    if (d.cmd === "open") {
      if (handles[d.name]) { try { handles[d.name].close(); } catch (x) {} }
      const fh = await root.getFileHandle(d.name, { create: true });
      const ah = await fh.createSyncAccessHandle();
      handles[d.name] = ah;
      reply({ size: ah.getSize() });
    } else if (d.cmd === "write") {
      handles[d.name].write(new Uint8Array(d.buf), { at: d.at });
      reply({ ok: true });
    } else if (d.cmd === "close") {
      const ah = handles[d.name];
      if (ah) { ah.flush(); ah.close(); delete handles[d.name]; }
      reply({ ok: true });
    } else if (d.cmd === "remove") {
      const ah = handles[d.name];
      if (ah) { try { ah.close(); } catch (x) {} delete handles[d.name]; }
      try { await root.removeEntry(d.name); } catch (x) {}
      reply({ ok: true });
    }
  } catch (err) {
    reply({ error: String((err && err.message) || err) });
  }
};
