# Smooth garment profiles

The tunic previously added a flat 5 cm depth offset to every unpinned vertex above a 28 cm drop. This created position jumps at the fixed top and the end of the band, and gave the chest a rectangular shelf. The replacement profile localizes extra room to the armhole with a compact smooth bump, interpolates ease smoothly, and curves the free chest rows slightly. Fixed shoulder/neckline coordinates remain independent of ease.

Cape shoulder spread and its transition into the hanging portion now have continuous first derivatives. The collar's height variation fades into the shoulder rather than disappearing after row zero. The independent sleeve's frame rotation uses smooth interpolation at the elbow.

Particle and triangle counts are unchanged. Profiles run only during worker mesh construction, with no new per-frame work or persistent mesh cache.

Verification: TypeScript, whitespace, three-quality topology/rest-length tests, upper-outfit motion, repeated worker jobs, and raised/lowered hood stability pass. New profile regression tests check continuity of both position and first derivative across every former shoulder/chest threshold, at multiple widths and panel positions. Fixed neckline invariance also passes. Browser rendering was not available, so no final screenshot comparison was performed.
