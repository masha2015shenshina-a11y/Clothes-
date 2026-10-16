import type { V3 } from './presets';

function smooth(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
}

export function neckline(u: number): number {
  return .14 * (1 - smooth((Math.abs(u) - .5) / .3));
}

/** Smooth pattern in torso-local coordinates, measured down from the shoulder. */
export function tunicPanel(u: number, drop: number, length: number, ease: number, face: number): V3 {
  const t = drop / length;
  const waist = Math.exp(-(((drop - .60) / .23) ** 2));
  const freedom = ease * smooth(drop / .30);
  const round = Math.sqrt(Math.max(0, 1 - u * u));
  // Extra room belongs to the armhole, not a rectangular band across the chest.
  // The bump and its first derivative vanish at both ends of the open seam.
  const v = Math.max(0, Math.min(1, drop / .28));
  const armhole = .05 * 16 * v * v * (1 - v) * (1 - v) * smooth((Math.abs(u) - .60) / .40);
  // Curve the free rows gently over the chest while retaining the straight neckline.
  const chestArc = .025 * (1 - u * u) * smooth(drop / .18) * (1 - smooth((drop - .25) / .28));
  return [
    u * (.385 + freedom - .035 * waist),
    -drop - neckline(u) * (1 - t) - chestArc,
    face * ((.25 + freedom - .018 * waist) * round + armhole),
  ];
}

/** C1 shoulder-to-drape transition; no straight crease at a fixed cape row. */
export function capeProfile(drop: number) {
  const shoulder = smooth(drop / .28);
  const v = drop - .28, radius = .06;
  const hanging = v <= -radius ? 0 : v >= radius ? v : (v + radius) ** 2 / (4 * radius);
  return {collarWeight: 1-shoulder, width: .13 + shoulder * .42 + hanging * .20,
    depth: .14 + shoulder * .20 + hanging * .15,
    height: .99 - shoulder * .07 - hanging};
}
