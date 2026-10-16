import type { V3 } from './presets';

/** Build-time refinement only: split rows near joints, with a fixed particle budget. */
export function jointRows(length: number, count: number, zones: ReadonlyArray<readonly [number, number]>, maxExtra: number): number[] {
  const rows = Array.from({length: Math.max(2, count)}, (_, i) => i * length / (Math.max(2, count) - 1));
  const candidates: {mid: number; score: number}[] = [];
  for (let i = 1; i < rows.length; i++) {
    const mid = (rows[i - 1] + rows[i]) / 2;
    let score = Infinity;
    for (const [center, radius] of zones) score = Math.min(score, Math.abs(mid - center) / radius);
    if (score < 1) candidates.push({mid, score});
  }
  candidates.sort((a, b) => a.score - b.score);
  return rows.concat(candidates.slice(0, maxExtra).map(v => v.mid)).sort((a, b) => a - b);
}

/** Continuous ring frame through a hinge; avoids the old discontinuous elbow seam. */
export function limbRing(points: [V3, V3, V3], distance: number, joint: number, end: number, blendWidth: number, radialAxis: 'crossZ' | 'x' | V3 = 'crossZ') {
  const segment = distance < joint ? 0 : 1;
  const t = (distance - segment * joint) / (segment ? end : joint);
  const center = points[segment].map((v, k) => v + (points[segment + 1][k] - v) * t) as V3;
  const u = Math.max(0, Math.min(1, (distance - joint + blendWidth) / (2 * blendWidth)));
  const blend = u * u * (3 - 2 * u);
  const tangent = points[1].map((v, k) => (v - points[0][k]) / joint * (1 - blend) + (points[2][k] - v) / end * blend) as V3;
  const len = Math.hypot(...tangent) || 1;
  for (let k = 0; k < 3; k++) tangent[k] /= len;
  // Z is stable for the supported shoulder motions. Fall back at its singularity.
  const hint = Array.isArray(radialAxis) ? radialAxis : null;
  const dot = hint ? hint[0]*tangent[0]+hint[1]*tangent[1]+hint[2]*tangent[2] : 0;
  let radial: V3 = hint ? hint.map((v,k)=>v-dot*tangent[k]) as V3 : radialAxis === 'x' ? [1-tangent[0]**2,-tangent[0]*tangent[1],-tangent[0]*tangent[2]] : [-tangent[1], tangent[0], 0];
  let rlen = Math.hypot(...radial);
  if (rlen < .05) { radial = [1 - tangent[0] ** 2, -tangent[0] * tangent[1], -tangent[0] * tangent[2]]; rlen = Math.hypot(...radial) || 1; }
  for (let k = 0; k < 3; k++) radial[k] /= rlen;
  const normal: V3 = [tangent[1]*radial[2]-tangent[2]*radial[1], tangent[2]*radial[0]-tangent[0]*radial[2], tangent[0]*radial[1]-tangent[1]*radial[0]];
  return {center, radial, normal};
}
