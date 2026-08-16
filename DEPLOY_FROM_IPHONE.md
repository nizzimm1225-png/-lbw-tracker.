# Update from iPhone

1. Unzip this package in the iPhone Files app.
2. Open your existing GitHub repository in Safari.
3. Replace these three root files:
   - `index.html`
   - `manifest.webmanifest`
   - `sw.js`
4. Commit the changes to `main`.
5. Open **Actions** and wait for **pages build and deployment** to show a green check.
6. Open the published GitHub Pages URL in Safari and refresh it.
7. Fully close the existing LBW Tracker Home Screen app and reopen it.
8. Start Camera -> CALIBRATE -> check/drag points -> SAVE POINTS -> START OVER.

If the old UI still appears, open the Pages URL in Safari once more and refresh; the service worker cache name was changed in this release.
