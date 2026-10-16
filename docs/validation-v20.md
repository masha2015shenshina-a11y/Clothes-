# Clothing update validation

## Changes

- SurfaceContacts checks triangle interiors against body capsules and oriented ellipsoids; particle-only checks missed limbs passing through large faces. Scratch buffers are reused, broad-phase bounds reject distant pairs, and the final solve is capped at three passes.
- Contact displacement caps prevent correction amplification near fixed shoulders. Corrections also update Verlet history to avoid artificial impulses.
- Trouser rings concentrate around knees, use a full 3D blended limb frame, and allow additional bend clearance. Sleeve guides also allow elbow clearance.
- Idle poses no longer require two deep clones per frame. Late worker results are adapted to the current pose. Paused pose changes invalidate geometry.
- Default mesh quality is medium, with existing bounded quality choices and adaptive 25/30/60 frame pacing retained. This is a pacing target, not a hardware FPS guarantee.
- Clothing controls are grouped; clothes, pose, scene, and physics have separate compact tabs. Sleeve activation also enables its required arms/tunic.
- Diffuse lighting is stronger; disabled directional lighting does not request shadow rendering.

## Checks

TypeScript check and whitespace check passed. Triangle interior capsule/ellipsoid regression tests passed without injecting velocity. Bent-knee motion passed at 25/30/60 simulation rates, including independent legs and paused pose changes. Thirty background-worker rebuilds passed with transferable buffers and fixed shoulder metadata. One hundred solver rebuilds showed no retained heap/buffer growth after GC (measured delta -0.07 MiB).

Full upper outfit motion took approximately 27 ms per physics step on the test host at maximum mesh quality. This excludes browser rendering. Cape vertex checks found no arm penetration in 4,080 checks; this does NOT prove all triangle surfaces are penetration-free. Previous floor-rest and raised/lowered hood stability checks passed.

## Remaining limits

Sharp elbow poses still produce sleeve triangle/body intersections. The static surface solver improves contact coverage but is not a complete continuous triangle collision solver. Constraints, guides, pinned seams, and layering can compete; no zero-intersection guarantee is justified. Browser visual QA, mobile FPS, GPU memory, and final lighting appearance were not measured in this environment.

Existing bounded weave texture cache and capped undo history are intentional, not leaks. Engine teardown already releases graphics resources, observers, listeners, and worker state. Node rebuild tests cover solver arrays only, not browser/GPU allocations.

## Reproducing tests

Compile presets.ts, mannequin.ts and solver.ts to a temporary CommonJS directory using TypeScript. Pass that directory to tests/surface-contacts.cjs, tests/pants-follow.cjs, tests/build-worker.cjs, and tests/rebuild-memory.cjs (the last uses node --expose-gc). Motion tests use esbuild bundles of upperCloth.ts and legCloth.ts at /tmp/upperCloth-v20.cjs and /tmp/legCloth-v20.cjs. These diagnostic paths are not application dependencies.
