# LBW Tracker Pro — Product Beta

A local-first iPhone PWA for club cricket video review and single-camera analytics. It combines the earlier over-buffer workflow with automatic delivery segmentation, editable pitch calibration, ball trail, speed/swing/post-bounce movement estimates, pitch map, beehive, shot tagging/wagon wheel, DRS-style replay and automatic WIDE/LBW/NOTHING/REVIEW decision assist.

## Match workflow
1. Open from the iPhone Home Screen.
2. Start Camera.
3. Calibrate: Auto Detect, drag any incorrect markers, Save Points.
4. Start Over. Keep the phone fixed.
5. The tracker attempts to create a delivery automatically when a valid trajectory ends. MARK DELIVERY is the fallback.
6. The result flashes immediately and the delivery appears on the timeline.
7. End Over to persist the video and delivery metadata locally.

## Analytics implemented
- Auto ball-by-ball delivery references inside each over recording
- Live/replay 2D trajectory and projected wicket corridor
- Estimated speed from calibrated pitch distance + frame timing
- Pre-bounce lateral movement (“swing” estimate)
- Post-bounce lateral movement angle proxy (not measured RPM)
- Pitch map / line-length classification
- Striker-end beehive
- Speed trend
- Batting tags: outcome, intent, footwork, loft, direction
- Wagon wheel from shot-direction tags
- WIDE / LBW / NOTHING / REVIEW decision assist
- Player/session-style metadata, filtering and JSON export
- Local video library and iOS share sheet

## Accuracy boundary
This is a single-camera browser product beta. It is not certified DRS and should not be used as an authoritative umpiring system. A trained cricket-ball detector and calibrated 3D model/backend are needed for FullTrack/Hawk-Eye-class reliability. The current tracker uses motion + red/white colour candidates, temporal continuity and pitch calibration. LBW cannot reliably establish bat-before-pad, exact 3D height or front-foot No ball. Low-confidence cases deliberately return REVIEW.

## GitHub Pages
Replace your existing site files with this folder’s root files, commit to `main`, then wait for **Actions → pages build and deployment** to turn green. Open the Pages URL in Safari once and refresh before reopening the Home Screen app.
