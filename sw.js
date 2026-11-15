importScripts("push-sw.js");   // away alerts: push + notification handling

/* WorkoutPlus service worker.
 * Optional: index.html works fine without it, but dropping this file
 * alongside index.html on a real host (Netlify, GitHub Pages) makes the
 * installed app genuinely offline-capable.
 *
 * Bump CACHE whenever you edit index.html, or the old copy will stick around.
 */
const CACHE  = "workoutplus-v16";
const PREFIX = "workoutplus-";   // only ever touch our own caches
const LEGACY_PREFIX = "spinesafe-";   // caches from before the rename
const ASSETS = [
  "./",
  "./index.html",
  "./hiit-program.json",
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
      // "reload" skips the browser's HTTP cache, which GitHub Pages fills for
      // 10 minutes, so a new version never precaches the previous index.html.
      .then(c => c.addAll(ASSETS.map(url => new Request(url, { cache:"reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => (k.startsWith(PREFIX) || k.startsWith(LEGACY_PREFIX)) && k !== CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* Network-first so an updated index.html is picked up as soon as you're
 * online, with the cached copy as the fallback in a signal-free gym. */
self.addEventListener("fetch", event => {
  if(event.request.method !== "GET") return;
  // Leave other sites alone, including the away-alerts Worker.
  if(new URL(event.request.url).origin !== self.location.origin) return;
  // "no-cache" revalidates with GitHub Pages instead of reusing its 10-minute
  // HTTP cache, so a push shows up on the next open, not ten minutes later.
  const fresh = fetch(event.request.url, { cache:"no-cache", credentials:"same-origin" })
    .then(res => res.redirected ? fetch(event.request) : res);
  event.respondWith(
    fresh
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(event.request, copy)).catch(()=>{});
        return res;
      })
      .catch(() => caches.match(event.request).then(hit => hit || caches.match("./index.html")))
  );
});
