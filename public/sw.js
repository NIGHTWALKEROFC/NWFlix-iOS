self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (u.pathname.indexOf("/stream/") === -1) return;
  e.respondWith(serve(e, u));
});

async function serve(e, u) {
  const size = Number(u.searchParams.get("size"));
  const mime = u.searchParams.get("mime") || "video/mp4";
  const id = decodeURIComponent(u.pathname.split("/stream/")[1]);
  const m = /bytes=(\d+)-(\d*)/.exec(e.request.headers.get("range") || "");
  const start = m ? Number(m[1]) : 0;
  if (start >= size) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + size } });
  const end = Math.min(size - 1, m && m[2] ? Number(m[2]) : start + 16 * 1024 * 1024 - 1);
  const page = (e.clientId && (await self.clients.get(e.clientId))) || (await self.clients.matchAll({ type: "window" }))[0];
  if (!page) return new Response("No page", { status: 503 });
  const ch = new MessageChannel();
  const body = new ReadableStream({
    start(ctrl) {
      ch.port1.onmessage = (ev) => {
        const d = ev.data;
        if (d.chunk) ctrl.enqueue(new Uint8Array(d.chunk));
        else if (d.done) ctrl.close();
        else if (d.err) ctrl.error(new Error(d.err));
      };
    },
    cancel() { ch.port1.postMessage({ stop: true }); }
  });
  page.postMessage({ type: "read", id, size, start, end }, [ch.port2]);
  return new Response(body, {
    status: 206,
    headers: {
      "Content-Type": mime,
      "Content-Length": String(end - start + 1),
      "Content-Range": "bytes " + start + "-" + end + "/" + size,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store"
    }
  });
}
