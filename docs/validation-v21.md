# Joint mesh and garment stability update

## Implementation

Mesh refinement is performed only during garment construction in the worker. `jointRows` splits a bounded number of intervals near a joint; the solver never remeshes during motion. Tunic shoulders/armholes have extra columns and upper rows; sleeves have additional shoulder/elbow rows; trousers have four extra knee rows. Cape shoulder rows are denser, with fewer columns elsewhere to offset the cost.

Sleeve motion reads mesh metadata rather than assuming 340 vertices per arm. A continuous ring frame replaces the abrupt elbow frame change, including the singular forward-vertical arm pose. Loose directional guides preserve the original side of sleeves/trouser legs while allowing sliding and folds. Guides are rebuilt on pose changes, and their numeric buffers are reused.

Trouser crotch shaping now transitions across several rows instead of reversing the first strip of triangles. Its rest pattern includes the same shaping and seam welding. Fixed waistband vertices are initialized outside the pelvis collider. Upper-arm motion no longer drags arbitrary tunic vertices sideways. Contact displacement is capped at 2.5 cm per face correction; a bounded structural stretch guard reduces contact-induced spikes in trousers/tunic. The cape is excluded from that guard to avoid pushing it through raised arms.

Removed the explanatory paragraph under the torso pose controls.

## Verification

- TypeScript and whitespace checks pass.
- New regression tests cover monotone trouser rows, initial rest-length agreement, fixed shoulder invariance, fixed waistband clearance, denser knee rows, correct skin metadata after seam welding, and sleeve-frame continuity at vertical arm positions.
- Quality 0.6/0.8/1 full outfit construction produces 2,697 / 3,559 / 4,303 particles; 5,076 / 6,766 / 8,230 triangles.
- Bent knee tests at 60/30/25 simulation Hz pass. Max hem-to-ankle offset was approximately 5.7 cm (independent) and 5.5 cm (linked), compared with approximately 9.6 / 19.0 cm in the preceding version's test.
- Worker repeated-build checks and 100 solver rebuilds pass. The measured retained heap+buffer delta after GC was -0.06 MiB; GPU memory is not covered.
- Hood up/down stability tests pass. Full upper outfit motion passes with no NaN or runaway positions.
- The difficult upper-motion diagnostic at medium quality took approximately 28 ms per physics step on this host. This excludes rendering and is not a browser FPS measurement. Sleeve surface penetration in that pose remains approximately 5.9 cm including collision padding; the previous version's diagnostic reached 11.9 cm. This is a residual error, not a claim of complete collision correctness.

## Limits

Deep underarm poses still produce body/tunic intersections, and discrete surface collision plus finite solver passes cannot guarantee no intersections. The cloth remains a bounded interactive reference simulation. No browser visual QA or device-specific FPS was available. Screenshot-reported crotch/fold defects were addressed in generation and solver code and covered by numerical tests, but no pixel-level browser comparison was performed.
