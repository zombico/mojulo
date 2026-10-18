/**
 * fractal-structure / faces — stacks (grow.js) → the engine-agnostic face list every World renderer reads
 * (`{ corners, fill, doubleSided, outNormal, group }`, z up), and box colliders `{ min, max, of }` for the worlds a
 * walker is ejected from.
 *
 * A side between two stations is one quad per ring edge (a triangle where a ring closes to a point). A cap is one
 * polygon when the ring is convex, else a fan from the centre: every plan is star-shaped about it (plan.js), so the
 * fan never folds. Shading is vexar's: the world's light on the face's own normal, raw albedo under FLAT_LIGHT.
 */
import { newellNormal, shadeHex, scaleHex } from '../polygonizer/vexar.js';
import { ringConvex } from './plan.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const ROLE_PAINT = { body: 'body', band: 'band', crown: 'crown', plinth: 'plinth' };

function placer(st) {
  const cs = Math.cos(st.turn), sn = Math.sin(st.turn), [cx, cy] = st.c;
  return (p, s, z) => [r4(cx + st.R * s * (cs * p[0] - sn * p[1])), r4(cy + st.R * s * (sn * p[0] + cs * p[1])), r4(z)];
}

/** One stack's faces, painted `hex`, shaded by `light`. */
export function stackToFaces(st, hex, light, group) {
  const at = placer(st), ring = st.ring, n = ring.length, out = [];
  const push = (corners) => {
    const nrm = newellNormal(corners);
    if (!(Math.abs(nrm[0]) + Math.abs(nrm[1]) + Math.abs(nrm[2]) > 0.5)) return;   // a degenerate face
    out.push({ corners, fill: shadeHex(hex, nrm, light), doubleSided: true, outNormal: nrm, group });
  };
  const rings = st.stations.map(({ z, s }) => ring.map((p) => at(p, s, z)));
  for (let k = 0; k + 1 < rings.length; k += 1) {
    const A = rings[k], B = rings[k + 1], closeA = st.stations[k].s < 1e-6, closeB = st.stations[k + 1].s < 1e-6;
    if (closeA && closeB) continue;
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      if (closeB) push([A[i], A[j], B[i]]);
      else if (closeA) push([A[i], B[j], B[i]]);
      else push([A[i], A[j], B[j], B[i]]);
    }
  }
  const cap = (R, z, up) => {
    if (ringConvex(ring)) { push(up ? R : [...R].reverse()); return; }
    const o = at([0, 0], 0, z);
    for (let i = 0; i < n; i += 1) { const j = (i + 1) % n; push(up ? [o, R[i], R[j]] : [o, R[j], R[i]]); }
  };
  if (st.caps.top && st.stations[st.stations.length - 1].s > 1e-6) cap(rings[rings.length - 1], st.stations[st.stations.length - 1].z, true);
  if (st.caps.bottom && st.stations[0].s > 1e-6) cap(rings[0], st.stations[0].z, false);
  return out;
}

/** The faces of a grown structure (grow.js), painted from its palette: tiers alternate a shade, copies lift one. */
export function grownFaces(S, grown, light) {
  const faces = [];
  for (const st of grown.stacks) {
    let hex = S.palette[ROLE_PAINT[st.role]];
    if (st.role === 'body' && st.tier % 2 === 1) hex = scaleHex(hex, 0.95);
    if (st.level > 0) hex = scaleHex(hex, 1 + 0.035 * st.level);
    for (const f of stackToFaces(st, hex, light, `structure:${S.id}:${st.role}`)) faces.push(f);
  }
  return faces;
}

/** Box colliders for the main body's tiers and its plinth: each its ring's bounds over its heights. */
export function grownColliders(S, grown) {
  return grown.colliders.map((k, i) => {
    const at = placer(k), pts = k.ring.map((p) => at(p, k.s, 0));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    return { min: [Math.min(...xs), Math.min(...ys), r4(k.z0)], max: [Math.max(...xs), Math.max(...ys), r4(k.z1)], of: `structure:${S.id}:${k.role}-${i}` };
  });
}
