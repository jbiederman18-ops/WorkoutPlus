# SpineSafe away alerts — setup

When you leave SpineSafe mid-workout, this Worker sends a notification at
every interval change. Coming back to the app cancels the rest. No secrets
to manage: the Worker makes its own push keys on first use.

## 1. Deploy the Worker (one time, on your computer)

You need Node 18 or newer and a free Cloudflare account.

1. Open `wrangler.toml` and change two lines:
   - `VAPID_SUBJECT`: `mailto:` plus your real email. Apple rejects placeholders.
   - `ALLOWED_ORIGIN`: your GitHub Pages origin, e.g. `https://yourname.github.io`
     (no path, no trailing slash).
2. In this folder, run:
   ```
   npm install
   npx wrangler login
   npx wrangler deploy
   ```
3. Deploy prints a URL like `https://spinesafe-push.yourname.workers.dev`.
   Open `<that URL>/vapid` in a browser. You should see `{"publicKey":"B..."}`.

## 2. Update the app (in your SpineSafe repo)

1. In `index.html`, find `const PUSH_URL = "";` and paste the Worker URL
   between the quotes (no trailing slash).
2. Add `push-sw.js` next to `index.html`.
3. Add this as the **first line** of your existing `sw.js`:
   ```js
   importScripts("push-sw.js");
   ```
   Changing `sw.js` also makes phones pick up the new service worker.
4. Commit and push.

## 3. Turn it on (on the iPhone)

1. Open SpineSafe **from the Home Screen icon**. iOS only offers
   notifications to installed web apps, not Safari tabs.
2. Tap the ⓘ button → **Turn on away alerts** → **Allow**.
3. Test: start a session, wait a few seconds, swipe to another app. The
   next interval change should arrive as a notification. Return to the app
   and they stop.

## Troubleshooting

- **"Away alerts need sw.js deployed"**: the service worker isn't registered.
  Check that `sw.js` is live and the `importScripts` line is in it.
- **"Couldn't reach the alert server"**: check `PUSH_URL`, and that
  `<URL>/vapid` loads.
- **No notifications arrive**: look at the Worker's logs in the Cloudflare
  dashboard (Workers → spinesafe-push → Logs) while you test. A 403 from
  Apple usually means `VAPID_SUBJECT` still has the placeholder.
- **Notifications stopped after a reinstall**: re-tap Turn on away alerts.
  Removing the Home Screen app drops its subscription.

## How it works

- `GET /vapid` returns the public key the phone subscribes with.
- On hide, the app sends `POST /schedule` with every upcoming interval time.
  Each phone gets its own Durable Object, which sets an alarm for the next
  time, sends an empty push when it fires, then moves to the one after.
- The push carries no data. `push-sw.js` reads the interval labels the app
  saved on the phone and shows the one that just started, so exercise names
  never leave your phone.
- Coming back to the app, ending the workout, or finishing it sends
  `POST /cancel`. Pausing isn't possible while you're away, so it needs nothing.
- Alerts more than a minute late are skipped, and each one replaces the
  last, so you see one notification, not a stack.

The free Workers plan covers this easily: a session is about 50 alarms.
