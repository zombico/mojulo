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

/** One stack's faces, painted `hex`, shaded by `light`. An annulus (`inner`) gets its inner wall and ring-shaped caps. */
export function stackToFaces(st, hex, light, group) {
  const at = placer(st), ring = st.ring, n = ring.length, out = [];
  const push = (corners) => {
    const nrm = newellNormal(corners);
    if (!(Math.abs(nrm[0]) + Math.abs(nrm[1]) + Math.abs(nrm[2]) > 0.5)) return;   // a degenerate face
    out.push({ corners, fill: shadeHex(hex, nrm, light), doubleSided: true, outNormal: nrm, group });
  };
  const rings = st.stations.map(({ z, s }) => ring.map((p) => at(p, s, z)));
  const inners = st.inner ? st.stations.map(({ z }, k) => ring.map((p) => at(p, st.inner[k], z))) : null;
  const last = st.stations.length - 1;
  for (let k = 0; k < last; k += 1) {
    const A = rings[k], B = rings[k + 1], closeA = st.stations[k].s < 1e-6, closeB = st.stations[k + 1].s < 1e-6;
    if (closeA && closeB) continue;
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      if (closeB) push([A[i], A[j], B[i]]);
      else if (closeA) push([A[i], B[j], B[i]]);
      else push([A[i], A[j], B[j], B[i]]);
      // the inner wall faces the open ground: the same quad walked the other way
      if (inners) push([inners[k][j], inners[k][i], inners[k + 1][i], inners[k + 1][j]]);
    }
  }
  const cap = (k, up) => {
    const R = rings[k];
    if (inners) {
      const I = inners[k];
      for (let i = 0; i < n; i += 1) { const j = (i + 1) % n; push(up ? [R[i], R[j], I[j], I[i]] : [R[j], R[i], I[i], I[j]]); }
      return;
    }
    if (ringConvex(ring)) { push(up ? R : [...R].reverse()); return; }
    const o = at([0, 0], 0, st.stations[k].z);
    for (let i = 0; i < n; i += 1) { const j = (i + 1) % n; push(up ? [o, R[i], R[j]] : [o, R[j], R[i]]); }
  };
  if (st.caps.top && st.stations[last].s > 1e-6) cap(last, true);
  if (st.caps.bottom && st.stations[0].s > 1e-6) cap(0, false);
  return out;
}

/** The faces of a grown structure (grow.js), each stack painted from its own structure's palette: tiers alternate a shade, copies lift one. */
export function grownFaces(S, grown, light) {
  const faces = [];
  for (const st of grown.stacks) {
    let hex = (st.pal || S.palette)[ROLE_PAINT[st.role]];
    if (st.role === 'body' && st.tier % 2 === 1) hex = scaleHex(hex, 0.95);
    if (st.level > 0) hex = scaleHex(hex, 1 + 0.035 * st.level);
    for (const f of stackToFaces(st, hex, light, `structure:${S.id}:${st.role}`)) faces.push(f);
  }
  return faces;
}

/**
 * Box colliders for the main body's tiers, its plinth steps, its columns and its entablature: each a solid's ring
 * bounds over its heights; an annulus (a hollow tier, a ring beam) one box per wall segment, so its open ground stays open.
 */
export function grownColliders(S, grown) {
  const out = [];
  const box = (pts, k, tag) => {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    out.push({ min: [Math.min(...xs), Math.min(...ys), r4(k.z0)], max: [Math.max(...xs), Math.max(...ys), r4(k.z1)], of: `structure:${S.id}:${tag}` });
  };
  grown.colliders.forEach((k, i) => {
    const at = placer(k), O = k.ring.map((p) => at(p, k.s, 0));
    if (k.inner === undefined) { box(O, k, `${k.role}-${i}`); return; }
    const I = k.ring.map((p) => at(p, k.inner, 0));
    for (let e = 0; e < O.length; e += 1) { const f = (e + 1) % O.length; box([O[e], O[f], I[e], I[f]], k, `${k.role}-${i}.${e}`); }
  });
  return out;
}
