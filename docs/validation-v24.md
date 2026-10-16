# Shoulder support, cube contact and composition workspace

## Behavior

- Standalone sleeve opening uses a fitted shoulder radius (arm radius + 25 mm), independent of ease. Ease grows smoothly over the first 35 cm. The support follows the shoulder transform. Wind below 8 m/s does not shift it; stronger wind allows at most 25 mm displacement. Released pins remain released.
- Triangle/AABB SAT contact supplements particle collision for the cube, including corners that intersect a triangle with all three vertices outside. Correction moves position history equally, is capped at 25 mm/pass, and respects pinned points. It runs only with an enabled cube, twice per simulation step with at most three passes.
- Composition is a separate lazy-loaded workspace. Six fabric shapes and four independent materials can be combined; objects have independent color, translation, rotation and removable supports. Up to six cloth objects / 7500 particles and three separately editable mannequins are allowed.
- Mannequin root uses translation arrows. Torso, head, shoulders, elbows, hips and knees use rotation rings with joint limits. Selecting one mannequin or limb does not edit another. Body colliders are shared by the cloth simulations and refreshed only on pose changes.
- Cross-object cloth contact uses reused spatial-hash storage and local vertex/face separation. This remains approximate: deeply interpenetrating initial arrangements and fast crossings are not guaranteed to untangle.
- The two modes retain their current session state while switching; the hidden mode pauses. Workspace state is not saved across page reloads. Only one renderer is used for all objects within the composition.

## Performance and lifecycle

Mesh generation uses the existing worker, with bounded jobs and error/timeout handling. Added objects use medium-low mesh density. Frame pacing uses the existing 25/30/60 Hz hysteresis, without catch-up bursts. Hidden browser tabs stop animation. Deleted objects dispose their materials and geometry; combined contact buffers are rebuilt or released when no longer needed. No unbounded cache or persistent scene history was added.

## Validation

- TypeScript check and production build.
- Regression tests: triangle/cube corner contact with all vertices outside, fixed points, nonuniform/distant boxes, cross-object cloth separation, shoulder location at several ease values, strong-wind threshold and return to neutral.
- A 150-frame falling-cloth test left 0.00047 m overlap with the padded cube boundary; physics averaged 4.12 ms/step.
- Three materials plus one mannequin: 1380 particles, 90 finite simulation frames, 6.73 ms physics/step in this runtime. Excludes drawing; not a device FPS guarantee.
- Headless control tests: independent limbs/mannequins, joint bounds, transforms preserving Verlet history, removal disposing geometry/materials and combined contact storage.
- Existing garment contacts, repeated worker transfers and floor-rest tests passed. 100 solver rebuilds retained about 0.01 MiB after GC (excludes browser/GPU).
- Browser QA was unavailable under the supported preview workflow. Pointer/gizmo rendering, mobile layout and GPU behavior were not visually verified.
