/* SpineSafe away alerts — push handling for the service worker.
 *
 * Pulled into sw.js with one line at the very top of that file:
 *     importScripts("push-sw.js");
 *
 * The pushes from the Worker carry no data. When one arrives, this reads
 * the timeline the app saved to IndexedDB as you left, picks the interval
 * that has just started, and shows it. iOS requires every push to show a
 * notification, so even a stray push with no timeline shows something.
 */
(function(){
  "use strict";
  const DB = "spinesafe-push";
  const TAG = "spinesafe-timer";   // each alert replaces the last one
  const EARLY_MS = 3000;           // a push can land a moment before its interval

  function readTimeline(){
    return new Promise(resolve => {
      let req;
      try{ req = indexedDB.open(DB, 1); }catch(e){ resolve(null); return; }
      req.onupgradeneeded = () => req.result.createObjectStore("kv");
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        try{
          const get = req.result.transaction("kv", "readonly").objectStore("kv").get("timeline");
          get.onsuccess = () => resolve(get.result || null);
          get.onerror = () => resolve(null);
        }catch(e){ resolve(null); }
      };
    });
  }

  function pick(timeline, now){
    const events = (timeline && timeline.events) || [];
    let found = null;
    for(const ev of events){
      if(ev.at <= now + EARLY_MS) found = ev;
      else break;
    }
    if(!found && events.length && events[0].at - now < 15000) found = events[0];
    return found;
  }

  self.addEventListener("push", event => {
    event.waitUntil((async () => {
      const ev = pick(await readTimeline(), Date.now());
      await self.registration.showNotification(
        ev ? ev.title : "SpineSafe",
        {
          body: ev ? ev.body : "Your workout timer moved on. Tap to jump back in.",
          tag: TAG,
          renotify: true,
          data: { url: self.registration.scope }
        }
      );
    })());
  });

  self.addEventListener("notificationclick", event => {
    event.notification.close();
    const scope = self.registration.scope;
    event.waitUntil((async () => {
      const wins = await self.clients.matchAll({ type:"window", includeUncontrolled:true });
      for(const win of wins){
        if(win.url.startsWith(scope) && "focus" in win) return win.focus();
      }
      return self.clients.openWindow(scope);
    })());
  });
})();
