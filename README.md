# LBW Tracker — Auto Decision Assist

An iPhone-first cricket PWA with per-over recording, ball-by-ball review, experimental 2D ball tracking, pitch calibration, and automatic result flashing.

## Camera position
Use one fixed iPhone in **landscape behind the bowler**, looking straight down the pitch toward the striker. Keep both sets of stumps visible and as close to the centreline as practical. A tripod is strongly recommended.

## One-time pitch calibration
Tap **CALIBRATE** and mark these eight points in order:
1. Bowler-end left stump base
2. Bowler-end middle stump base
3. Bowler-end right stump base
4. Striker-end left stump base
5. Striker-end middle stump base
6. Striker-end right stump base
7. Left wide guideline at the striker crease
8. Right wide guideline at the striker crease

Calibration is saved locally on the iPhone. Recalibrate whenever the phone moves, zoom/framing changes, or you use a different pitch.

## Match workflow
1. Start Camera.
2. CALIBRATE if required.
3. Select red/white ball, striker handedness and LBW shot assumption.
4. Tap **START OVER**.
5. Ball tracking follows the delivery.
6. When the tracked trajectory ends/disappears, the decision engine evaluates it and flashes one of:
   - **WIDE** — projected outside the calibrated wide corridor
   - **LBW** — projected through the wicket corridor and the 2D impact condition is eligible
   - **NOTHING** — trajectory is inside the wide corridor and does not satisfy the LBW estimate
   - **REVIEW** — tracking/geometry confidence is below the selected threshold
7. Tap **MARK BALL** after each delivery to add a review marker. The latest auto result is attached to that marker when possible.
8. END OVER saves the whole over locally.

## Important rules/accuracy note
This is an **experimental club-cricket decision aid**, not DRS/Hawk-Eye and not an authoritative umpire replacement.

- Wide decisions under MCC Law 22 depend on striker position, movement and whether the ball is within reach for a normal cricket stroke. This build uses the two calibrated local wide-guideline points as a practical club-mode approximation.
- LBW under MCC Law 36 also requires checks such as No ball, pitching line, first interception, bat contact, impact position, shot attempt and whether the ball would hit the wicket. A single rear iPhone cannot recover all of those reliably in 3D. The app therefore treats LBW as a **review recommendation** even when the main flash reads LBW.
- No-ball detection is not implemented yet. A No ball overrides Wide and prevents LBW dismissal.

Good daylight, a fixed tripod, 720p/60fps, and a clearly visible red or white ball materially improve results.
