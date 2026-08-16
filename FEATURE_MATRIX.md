# Feature Matrix

| Feature | Product Beta | Notes |
|---|---:|---|
| Ball-by-ball video organisation | Yes | Delivery references inside whole-over recording |
| Automatic delivery detection | Yes | Heuristic single-camera tracker |
| Ball trail | Yes | 2D |
| DRS-style replay | Yes | Decision assist, not certified DRS |
| Speed | Yes | Estimated from calibration + timing |
| Swing | Yes | Lateral movement estimate |
| Spin | Partial | Post-bounce movement proxy; not RPM |
| Pitch map | Yes | Estimated bounce point |
| Beehive | Yes | Striker-end pass point |
| Line / length filters | Yes | Based on calibrated geometry |
| Wagon wheel | Yes | From review shot tags |
| Shot outcome / intent / loft / footwork | Yes | Manual tagging in review |
| Auto calibration | Yes | Best-effort point detection + drag correction |
| Edit saved calibration | Yes | Without starting over |
| WIDE auto call | Assist | Uses calibrated wide corridor |
| LBW auto call | Assist | Single-camera 2D projection + rule inputs |
| Cloud storage | No | Local IndexedDB + export/share; backend required |
| True 3D trajectory | No | Requires trained 3D model / multi-view or proprietary approach |
| Live streaming to viewers | No | Requires backend/WebRTC service |

## Hybrid AI stage

| Capability | Status | Notes |
|---|---|---|
| Generic sports-ball ML detection | Implemented | TensorFlow.js COCO-SSD Lite, periodic inference |
| ML + temporal tracker fusion | Implemented | AI anchors fast tracker; fallback remains available |
| iPhone WebGL inference | Implemented | Falls back if unavailable |
| Cricket-specific trained detector | Data-collection stage | Requires real labelled cricket-ball footage |
| Local labelled sample capture | Implemented | Ball/background frames stored in IndexedDB |
| Dataset export | Implemented | JSON with JPEG data + normalized bounding box |
