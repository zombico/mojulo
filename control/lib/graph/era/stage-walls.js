/**
 * THE WALLED STREET — a town's street on a stage closed by its fortification (era/out-fortress.js): a gatehouse across
 * the trail before the first house and after the last, the curtain along both sides behind the houses, towers at its
 * corners and along it. The town on a stage is its street (stage-buildings.js: its houses seated beside the trail, not
 * on the town's plan), so its walls are the street's: what is read from the approach (the gate, the towers, the
 * curtain's crown over the roofs) and from inside (the walls closing the street's ends and sides).
 *
 *   streetWalls(site, span, { y0, y1, taken, ground, fort?, H?, step?, seed? })
 *     → { pieces: [{ faces, boxes: [[x0, y0, x1, y1]], z0, z1 }], keep: [[x0, y0, x1, y1]] }
 *     site    the trail's site (out-trail.js: trailX(y), D); span the street's (stage-street.js: its half width)
 *     y0, y1  the street's stretch along the trail; taken the footprints already standing ([x0, y0, x1, y1])
 *     fort    a fortification (FORT_SETS id, { seed }, or its elements: out-fortress.js composeFort), the civilization's
 *     H       the curtain's height over its ground (RAMPART's low end by default: a town's wall, not a keep's)
 *     pieces  the faces of each bay, tower and gatehouse placed on the stage (z up, metres), with the boxes it stands in
 *             for its colliders (a cross wall's split round its gate, the gatehouse's its two towers)
 *     keep    the ground the walls stand on, kept clear of what grows
 *
 * Pure: values only, painted by the stage (the town's own paint and light).
 */
import { composeFort, build as FB, RAMPART } from './out-fortress.js';

const r3 = (v) => Math.round(v * 1000) / 1000;
const unit2 = ([x, y]) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };

// a fort's faces, built in its frame (x along the curtain, y across it, −y the field), set on the stage at `o` with `d`
// along the curtain and `n` its inward side, standing at `z`
function place(faces, o, d, n, z) {
  const W = ([x, y, h]) => [r3(o[0] + d[0] * x + n[0] * y), r3(o[1] + d[1] * x + n[1] * y), r3(z + h)];
  return faces.map((f) => ({ ...f, corners: f.corners.map(W), normal: f.normal ? [r3(d[0] * f.normal[0] + n[0] * f.normal[1]), r3(d[1] * f.normal[0] + n[1] * f.normal[1]), f.normal[2]] : f.normal }));
}
// the box a length of curtain from p to q stands in (its thickness inward of the line)
const boxOf = (p, q, n, t) => { const xs = [p[0], q[0], p[0] + n[0] * t, q[0] + n[0] * t], ys = [p[1], q[1], p[1] + n[1] * t, q[1] + n[1] * t]; return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(r3); };

export function streetWalls(site, span, { y0, y1, taken = [], ground = () => 0, fort = 'crenellated', H = RAMPART[0] + 1, step = 8, seed = 1 } = {}) {
  const F = composeFort(fort), t = F.curtain.t, tw = F.towerDims.w;
  const gz = (x, y) => { const z = ground(x, y); return Number.isFinite(z) ? z : 0; };
  // (the walls behind the houses on each side: past the furthest of them, and clear of the street itself)
  let right = span.half + 4, left = span.half + 4;
  for (const [a, b, c, e] of taken) {
    const cy = (b + e) / 2, cx = (a + c) / 2, tx = site.trailX(cy);
    if (cy < y0 - 2 || cy > y1 + 2) continue;
    if (cx >= tx) right = Math.max(right, c - tx + 2.5); else left = Math.max(left, tx - a + 2.5);
  }
  const ys = []; for (let y = y0; y < y1 - 0.5; y += step) ys.push(y); ys.push(y1);
  const R = ys.map((y) => [r3(site.trailX(y) + right), y]), L = ys.map((y) => [r3(site.trailX(y) - left), y]);
  const pieces = [], keep = [];
  const wall = (p, q, k, gate = null) => {
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]), d = unit2([q[0] - p[0], q[1] - p[1]]), n = [-d[1], d[0]];
    const z = Math.min(gz(...p), gz(...q)) - 0.4, o = [];
    FB.bay(o, len, F, H, { depth: 1, gates: gate ? [gate] : [], seed: seed * 31 + k });
    const at = (u) => [p[0] + d[0] * u, p[1] + d[1] * u];
    // (its collider split round its gate, so the trail passes; the gatehouse's towers each a box of their own)
    const boxes = gate ? [boxOf(p, at(gate.u - gate.w / 2), n, t), boxOf(at(gate.u + gate.w / 2), q, n, t)] : [boxOf(p, q, n, t)];
    pieces.push({ faces: place(o, p, d, n, z), boxes, z0: r3(z), z1: r3(z + H + F.parapet.h) });
    keep.push(boxOf(p, q, n, t));
    if (gate) {
      const g = at(gate.u), og = [];
      FB.gatehouse(og, F, H, gate.w, { depth: 1 });
      const side = (s) => { const c = at(gate.u + s * (gate.w / 2 + tw / 2)); return [c[0] - tw / 2, c[1] - tw / 2, c[0] + tw / 2, c[1] + tw / 2].map(r3); };
      pieces.push({ faces: place(og, g, d, n, z), boxes: [side(-1), side(1)], z0: r3(z), z1: r3(z + H + 3), gatehouse: true });
    }
  };
  const tower = (at, k) => {
    const z = gz(...at) - 0.4, o = [];
    FB.tower(o, F, H + 3, { depth: 1 });
    const box = [at[0] - tw / 2, at[1] - tw / 2, at[0] + tw / 2, at[1] + tw / 2].map(r3);
    pieces.push({ faces: place(o, at, [1, 0], [0, 1], z), boxes: [box], z0: r3(z), z1: r3(z + H + 3), tower: true });
    keep.push(box);
  };
  // the sides: the right along the trail, the left back down it (each its inward side toward the street)
  for (let k = 0; k + 1 < R.length; k++) wall(R[k], R[k + 1], k);
  for (let k = L.length - 1; k > 0; k--) wall(L[k], L[k - 1], 100 + k);
  // the ends: the near across the trail toward +x, the far back toward −x, each with its gate where the trail passes
  const pw = r3(2 * span.half + 1.2);
  wall(L[0], R[0], 200, { u: r3(site.trailX(y0) - L[0][0]), w: pw });
  wall(R.at(-1), L.at(-1), 201, { u: r3(R.at(-1)[0] - site.trailX(y1)), w: pw });
  // its towers: the four corners, and every other joint along each side
  for (const p of [L[0], R[0], L.at(-1), R.at(-1)]) tower(p, pieces.length);
  for (let k = 2; k + 1 < R.length; k += 2) { tower(R[k], 300 + k); tower(L[k], 400 + k); }
  return { pieces, keep, fort: F, H };
}
