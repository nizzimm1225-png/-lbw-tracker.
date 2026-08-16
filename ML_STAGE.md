# ML Stage — Hybrid Cricket Ball Tracking

This build moves the live tracker from heuristic-only tracking to a hybrid detector designed for iPhone Safari.

## Runtime design

1. A TensorFlow.js COCO-SSD Lite model runs periodically and searches for the `sports ball` class.
2. The model detection is treated as an AI anchor rather than the complete trajectory.
3. The existing high-rate motion/red-white candidate tracker runs between AI frames.
4. Temporal proximity, pitch calibration and the AI anchor are fused to choose the most likely ball.
5. If TensorFlow.js or the model cannot load, the app keeps working with the fast tracker.

This design is intentional for iPhone battery/thermal limits. Running a full object detector on every 60-fps frame in Safari is not practical.

## Training data capture

The Setup screen now includes:

- Capture Ball Sample — use after the tracker/seed is correctly locked on the ball.
- Capture Background — saves a negative frame.
- Export ML Data — exports all confirmed samples as JSON with JPEG data and normalized ball box metadata.
- Clear ML Data — deletes only training samples; match videos and calibration are unaffected.

Collect examples in the real conditions you care about: red and white balls, sun/cloud, different pitches, bowler speeds, indoor nets and long-distance small-ball frames. Those samples are the basis for replacing the generic sports-ball model with a cricket-specific detector.

## Important accuracy note

The bundled model is a general COCO sports-ball detector, not a proprietary cricket model. It is used to improve reacquisition and reduce false locks, but it is not expected to equal FullTrack/Hawk-Eye accuracy on a tiny cricket ball. The app deliberately retains manual seed and REVIEW fallbacks.
