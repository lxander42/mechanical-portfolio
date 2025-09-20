# Manual viewport verification

The `ThreeModelComponent` frustum metrics were revalidated after the camera refactor
using a Playwright harness against the dev server (`npm run start`). The script
queried `ng.getComponent` to read the cached `framingState` and recomputed the same
values from the live bounding data for both desktop (1280×720) and tall mobile
(390×844) viewports.

## Desktop viewport (1280×720)

| State | Cached center (x, y) | Recomputed center (x, y) | Cached half extents (w, h) | Recomputed half extents (w, h) |
| --- | --- | --- | --- | --- |
| Exploded | (0, 0) | (0, 0) | (5.2601, 6.0857) | (5.2601, 6.0857) |
| Collapsed | (0, 0) | (0, 0) | (2.3938, 2.7540) | (2.3938, 2.7540) |
| Re-exploded | (0, 0) | (0, 0) | (5.2560, 6.0807) | (5.2560, 6.0807) |

## Tall mobile viewport (390×844)

| State | Cached center (x, y) | Recomputed center (x, y) | Cached half extents (w, h) | Recomputed half extents (w, h) |
| --- | --- | --- | --- | --- |
| Exploded | (0, 0) | (0, 0) | (5.2398, 6.0607) | (5.2398, 6.0607) |
| Collapsed | (0, 0) | (0, 0) | (2.4198, 2.7852) | (2.4198, 2.7852) |
| Re-exploded | (0, 0) | (0, 0) | (5.2276, 6.0451) | (5.2276, 6.0451) |

No discrepancies were observed between cached and recomputed values in any tested
scenario. A subsequent regression sweep after adding a 12% vertical headroom
offset to the camera target confirmed the exploded cube now sits comfortably
within the frame on desktop and tall-mobile viewports with no clipping during
resize/re-explode cycles.
