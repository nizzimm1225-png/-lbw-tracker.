# LBW Tracker Pro — Hybrid AI Edition

Single-iPhone PWA for cricket over recording, ball-by-ball replay, hybrid AI ball tracking, calibration, trajectory overlays, DRS decision assist and session analytics.

## New in this build

- TensorFlow.js COCO-SSD Lite `sports ball` detector as a periodic AI anchor.
- Fusion of AI anchors with the existing fast motion/red-white temporal tracker.
- Automatic fallback to fast tracking if the AI model cannot load.
- AI status and backend indicators.
- Configurable AI anchor rate for performance/battery balance.
- Local ML training-sample capture and export so a cricket-specific model can be trained from real club footage.

## Recommended first test

1. Publish the files to GitHub Pages.
2. Open the PWA on the iPhone with an internet connection for the first AI-model load.
3. Start Camera and wait for `AI READY`.
4. Auto-calibrate the pitch, correct any points, then save.
5. Start an over.
6. If the tracker misses the ball, tap directly on the ball to seed it.
7. When the lock is correct, capture several Ball Samples from Setup; also capture Background samples.
8. Export ML Data after a practice session.

See `ML_STAGE.md` for the model/data strategy and `DEPLOY_FROM_IPHONE.md` for GitHub Pages deployment.
