/* SpineSafe service worker.
 * Optional: index.html works fine without it, but dropping this file
 * alongside index.html on a real host (Netlify, GitHub Pages) makes the
 * installed app genuinely offline-capable.
 *
 * Bump CACHE whenever you edit index.html, or the old copy will stick around.
 */
const CACHE  = "spinesafe-v2";
const PREFIX = "spinesafe-";   // only ever touch our own caches
const ASSETS = [
  "./",
  "./index.html",
  "./apple-touch-icon.png",
  "./favicon-180.png",
  "./favicon-32.png",
  "./icon-1024.png",
  "./icon-120.png",
  "./icon-152.png",
  "./icon-167.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./manifest.webmanifest",
  "./splash-1125x2436.png",
  "./splash-1170x2532.png",
  "./splash-1179x2556.png",
  "./splash-1206x2622.png",
  "./splash-1242x2208.png",
  "./splash-1242x2688.png",
  "./splash-1284x2778.png",
  "./splash-1290x2796.png",
  "./splash-640x1136.png",
  "./splash-750x1334.png",
  "./splash-828x1792.png",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith(PREFIX) && k !== CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* Network-first so an updated index.html is picked up as soon as you're
 * online, with the cached copy as the fallback in a signal-free gym. */
self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(event.request, copy)).catch(()=>{});
        return res;
      })
      .catch(() => caches.match(event.request).then(hit => hit || caches.match("./index.html")))
  );
});
