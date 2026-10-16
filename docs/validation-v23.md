# Waist support and seams

Trouser outer arcs now form one raised elliptical waistband; the matching inner arcs form the crotch seam. The waistband is 10 cm above the pelvis origin instead of starting at the hip joint. Skirts share this height and a fitted elliptical waist independent of hem width.

A small compliant support loop replaces rigid waist pins. Lateral supports are firmer; front/back can yield under load. Forward bending lowers the back target by up to about 2 cm, with bounded slack. Position history receives the same corrections to avoid injecting velocity. Releasing supports disables the loop, and runtime snapshots preserve this state.

Waist, crotch, tunic side and sleeve attachment seams use stiffer stretch constraints while retaining bending. Lower free tunic vertices follow torso motion less strongly so the solver can form compression folds. This is an approximate real-time model, not a physically calibrated sewing/friction simulation.

Optimization: construction removes duplicate/self constraints and collapsed render triangles after welding; contact stretch checks use a precomputed edge list; unchanged arms no longer allocate transformation matrices; absent sleeves skip guide arrays and arm ring calculations. No new persistent geometry cache. Waist solving visits only 24 trouser / 56 skirt seam vertices at medium quality.

Validation:
- TypeScript check, topology/rest lengths at three quality levels, background worker transferable buffers, smooth garment profiles and upper/lower pose tests passed.
- 120-frame waist test with bending torso and moving knee: maximum distance from support targets 1.34 cm (pants), 1.24 cm (skirt), below the 4 cm regression bound. Back target drop 1.82/1.80 cm. Load test confirms firmer side support; release works.
- Upper outfit motion with sleeves/cape: 31.51 ms physics per step in this runtime; tested cape vertices had zero arm-capsule penetration in the final pose. Pants motion: 16.78–17.70 ms per step. These exclude rendering and are not device FPS guarantees or proof of intersection-free cloth in every pose.
- Full outfit triangles at quality .6/.8/1: 5068/6758/8222 (eight collapsed triangles removed); particle counts unchanged.
- Browser visual comparison unavailable in this session.
