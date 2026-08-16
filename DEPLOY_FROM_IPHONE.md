# Deploy from an iPhone

The PWA needs an HTTPS URL before Safari can grant live-camera access.

The easiest no-Mac workflow is to use a static hosting provider from Safari:

1. Sign in to your preferred static host from Safari.
2. Create a new static site/project.
3. Upload all files from the `LBW-Tracker-PWA` folder, keeping the `icons` folder intact.
4. Publish/deploy the project.
5. Open the generated `https://...` address in Safari.
6. Tap **Share → Add to Home Screen**.

No Node.js, npm, database, API key, or server-side code is required.

If your hosting provider only accepts a ZIP, upload `LBW-Tracker-PWA.zip` and choose the option that deploys/extracts static site files at the site root.
