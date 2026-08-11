# SpineSafe Recomp — deploy bundle

Everything here is static. No build step, no dependencies, no network calls.

## Deploy to GitHub Pages

1. Put **the contents of this folder at the repo root** — `index.html` must sit
   at the top level, not inside a subfolder.
2. Settings → Pages → Source: **Deploy from a branch**, branch `main`, folder
   `/ (root)`. (`/docs` also works if you'd rather keep the root clean — just
   put these files in a `docs/` folder instead.)
3. Confirm **Enforce HTTPS** is ticked. The service worker, Wake Lock, and
   Add to Home Screen all refuse to run over plain http.
4. Wait for the green check, then open the URL.

The `.nojekyll` file is intentional — it tells Pages to skip Jekyll processing
and serve these files verbatim. Don't delete it.

Every path in `index.html` is relative, so the app works both at
`username.github.io` (user site) and `username.github.io/spinesafe/`
(project site) with no changes.

## Sharing an origin with your other apps

All your project sites live on the same origin, `username.github.io`. They
share localStorage, the Cache API, and service worker registrations. This app
is namespaced to stay out of their way:

- localStorage key: `spinesafe.v2`
- Cache name: `spinesafe-v2`, and the service worker only ever deletes caches
  beginning `spinesafe-`
- Service worker scope: limited to this app's own folder

If any of your other apps use a generic localStorage key like `state` or
`settings`, they can collide with each other. Worth a look.

## Install on iPhone

1. Open the site in **Safari** — Chrome on iOS cannot add to the home screen.
2. Share → **Add to Home Screen**.
3. Launch from the icon, not from Safari. Only the home-screen copy runs
   full-screen, keeps the display awake, and gets its own storage.

## Files

| File | Purpose |
|---|---|
| `index.html` | The entire app. Self-contained. |
| `.nojekyll` | Stops GitHub Pages running Jekyll over the files. |
| `manifest.webmanifest` | Android/desktop install metadata. iOS ignores it. |
| `sw.js` | Offline cache. Bump `CACHE` whenever you edit `index.html`. |
| `apple-touch-icon.png` | 180x180 home-screen icon. iOS reads **only PNG** here. |
| `icon-*.png` | Manifest icon set, including a maskable variant for Android. |
| `splash-*.png` | iOS launch images. Without them you get a white flash. |
| `favicon-32.png` | Browser tab icon. |

## After editing index.html

Change the `CACHE` constant in `sw.js` (`spinesafe-v2` -> `spinesafe-v3`) and
push. Otherwise the old cached copy keeps being served. GitHub Pages also puts
a 10-minute cache on assets, so give it a moment before assuming a change
didn't land — and test offline mode with the phone off Wi-Fi.

The icon is embedded in `index.html` as a base64 PNG so the file works alone.
Once deployed you can swap that line for the smaller file reference:

```html
<link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png">
```
