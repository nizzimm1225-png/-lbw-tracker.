# LBW Tracker — Portrait + Auto Calibration

This PWA is designed to run directly on an iPhone from Safari / Add to Home Screen.

## New in this build

- Portrait mode is supported for the full running page and recording workflow.
- START OVER no longer requires the iPhone to be rotated sideways.
- The camera preview adapts to the actual stream aspect ratio.
- CALIBRATE performs a best-effort automatic detection of:
  1. bowler-end left / middle / right stump bases
  2. striker-end left / middle / right stump bases
  3. left / right wide-line reference points
- All eight points are shown as numbered draggable markers before saving.
- AUTO DETECT can be run again before saving.
- RESET DEFAULT gives a sensible starting geometry if automatic detection is poor.
- After calibration is saved, the button becomes EDIT CALIBRATION. Reopen it at any time, move one or more points, then save again.
- Cancelling an edit leaves the previously saved calibration unchanged.
- Existing over-buffer, ball timeline, ball tracking and WIDE/LBW/NOTHING/REVIEW assist remain available.

## Calibration advice

Automatic calibration is intentionally assistive rather than authoritative. It uses image contrast and line/stump heuristics from the current camera frame. For best results:

- use the rear camera behind the bowler
- hold or mount the iPhone still
- keep both sets of stumps visible
- perform calibration when players are not blocking the wickets
- check every marker before pressing SAVE POINTS
- recalibrate whenever the phone/tripod position changes

Green markers 1–6 are stump-base points. Amber markers 7–8 are the wide guideline references at the striker end.

## Deploy

Replace `index.html`, `manifest.webmanifest`, and `sw.js` in the root of your existing GitHub Pages repository, commit to `main`, wait for the Pages deployment to turn green, then refresh the site in Safari and fully close/reopen the Home Screen app.

## Important

Automatic LBW and Wide outputs are review aids, not official umpire-grade decisions. A single iPhone camera cannot reliably establish every 3D/playing-condition requirement involved in LBW or Wide decisions.
