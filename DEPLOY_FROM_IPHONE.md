# Deploy from iPhone to your existing GitHub Pages site

This release changes the app JavaScript, UI and service-worker cache. Replace the complete site contents from this folder in your existing repository.

Required files/folders:

- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
- `.nojekyll`
- `icon-180.png`
- `icon-512.png`
- `icons/`

You can also upload the README/feature documents; they do not affect the app.

## After commit

1. Open the repository in GitHub.
2. Open **Actions**.
3. Wait for **pages build and deployment** to show a green check.
4. Open the Pages URL in Safari.
5. Refresh once.
6. Fully close the Home Screen LBW Tracker app and reopen it.
7. If the previous build is still visible, remove its Home Screen icon, open the Pages URL in Safari again, then **Add to Home Screen**.

## First AI use

The Hybrid AI build downloads TensorFlow.js and the generic COCO-SSD Lite model on first use. Keep internet access available when you first tap **Start Camera**. If model loading fails, the app continues with the fast tracker and shows **FAST FALLBACK** rather than preventing recording.
