# LBW Tracker PWA

An iPhone-first Progressive Web App for local cricket LBW video review.

## Features
- Rear/front camera selection
- Live 1080p/60fps request (device/browser chooses the supported mode)
- Rolling in-memory video buffer
- Configurable pre-appeal and post-appeal capture windows
- REVIEW LBW trigger
- Local IndexedDB review library
- Replay at 1x or 0.25x
- OUT / NOT OUT tagging
- iOS Share Sheet support
- Installable to iPhone Home Screen
- Offline app shell after first load

## Important iPhone requirement
Camera capture in Safari requires an HTTPS origin. Deploy these files to GitHub Pages or another HTTPS static host, then open the URL in Safari.

## GitHub Pages
1. Create a public GitHub repository, e.g. `lbw-tracker`.
2. Upload all files from this folder to the repository root.
3. In GitHub: Settings → Pages → Build and deployment → Deploy from a branch.
4. Select `main` and `/ (root)`, then Save.
5. Open the Pages URL in Safari on iPhone.
6. Share → Add to Home Screen.

## Privacy
Video is stored locally in the browser's IndexedDB. The app contains no analytics, backend, account system, or automatic upload.

## MVP note
This version records and reviews LBW events. It does not yet make an automated LBW decision or track the ball trajectory.
