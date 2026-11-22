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
 *   wallStructure(out, len, F, H, gate?)   a bay's plinth, buttresses, pilasters and string course (WALL_STRUCTURE)
 *   gateLeaves(out, F, pw)                 a gatehouse's open leaves and raised portcullis (GATE_LEAVES)
 *
 * Pure: values only, painted by the stage (the town's own paint and light).
 */
import { composeFort, build as FB, RAMPART } from './out-fortress.js';
import { build as EB } from './out-anchor-elements.js';

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

/**
 * A WALL'S STRUCTURE, over its bay (era/out-fortress.js bay: its body, walk, parapet and laying): a PLINTH, a course of
 * larger blocks standing proud at its foot; BUTTRESSES on the field side at their stride, stepped back once below the
 * walk, and PILASTERS on the street side between them; a STRING COURSE proud along the walk's line. Each clear of the
 * gate. In the bay's frame: x along, −y the field, z up from the foot. A new member is a row.
 */
export const WALL_STRUCTURE = Object.freeze({
  plinth: Object.freeze({ h: 0.9, proud: 0.25, dark: 0.06 }),
  buttress: Object.freeze({ every: 6, w: 0.9, proud: 0.6, step: 0.32, margin: 1.2 }),
  pilaster: Object.freeze({ w: 0.6, proud: 0.2 }),
  string: Object.freeze({ h: 0.2, proud: 0.14, light: 0.06 }),
});
export function wallStructure(out, len, F, H, gate) {
  const C = F.curtain, S = WALL_STRUCTURE, half = C.t / 2, v = C.value, g = C.group;
  const spans = gate ? [[0, gate.u - gate.w / 2], [gate.u + gate.w / 2, len]].filter(([a, b]) => b - a > 0.3) : [[0, len]];
  for (const [a, b] of spans) {
    EB.box(out, [a, -half - S.plinth.proud, 0], [b, half + S.plinth.proud, S.plinth.h], g, Math.max(0.04, v - S.plinth.dark));
    EB.box(out, [a, -half - S.string.proud, H - S.string.h], [b, half + S.string.proud, H], g, Math.min(1, v + S.string.light), false);
    const n = Math.floor((b - a - 2 * S.buttress.margin) / S.buttress.every);
    for (let i = 0; i <= n; i++) {
      const u = a + S.buttress.margin + (n ? (i * (b - a - 2 * S.buttress.margin)) / n : (b - a) / 2 - S.buttress.margin), w = S.buttress.w / 2;
      if (u - w < a || u + w > b) continue;
      // (stepped: its full depth to two thirds of the wall, then a step back to under the string course)
      const z1 = r3(H * 0.66), z2 = r3(H - S.string.h);
      EB.box(out, [u - w, -half - S.buttress.proud, 0], [u + w, -half, z1], g, v);
      EB.box(out, [u - w * 0.85, -half - S.buttress.step, z1], [u + w * 0.85, -half, z2], g, Math.min(1, v + 0.03));
      const pw = S.pilaster.w / 2;
      EB.box(out, [u - pw, half, 0], [u + pw, half + S.pilaster.proud, z2], g, Math.min(1, v + 0.02));
    }
  }
}
/**
 * A GATE'S LEAVES AND ITS PORTCULLIS, in a gatehouse's passage `pw` wide (era/out-fortress.js gatehouse's frame: x along
 * the curtain, centred on the passage, −y the field): the PORTCULLIS raised into its slot just inside the field's face,
 * its iron grid's teeth over the way; the two timber LEAVES swung open against the passage's sides, each banded in iron.
 * The way stays open: nothing here stands in it.
 */
export const GATE_LEAVES = Object.freeze({ bar: 0.08, pitch: 0.34, rails: [1.3, 0.8, 0.3], drop: 1.5, leaf: 0.1, band: [0.7, 0.62], iron: 0.1, timber: 0.34 });
export function gateLeaves(out, F, pw) {
  const G = GATE_LEAVES, d = F.curtain.t + 2, clear = F.gate.clear, y = -d / 2 + 0.35, iron = 'str:timber';
  // the portcullis: its bars from the slot down to their teeth, its rails across them
  for (let x = -pw / 2 + 0.2; x <= pw / 2 - 0.2 + 1e-6; x += G.pitch) EB.box(out, [r3(x - G.bar / 2), r3(y - G.bar / 2), r3(clear - G.drop)], [r3(x + G.bar / 2), r3(y + G.bar / 2), r3(clear)], iron, G.iron);
  for (const r of G.rails) EB.box(out, [r3(-pw / 2 + 0.12), r3(y - 0.05), r3(clear - r - 0.05)], [r3(pw / 2 - 0.12), r3(y + 0.05), r3(clear - r + 0.05)], iron, G.iron, false);
  // the leaves, open: each against its side of the passage, the height of the way, banded twice
  const len = Math.min(pw / 2 - 0.2, d - 1.2), y0 = -d / 2 + 0.7;
  for (const s of [-1, 1]) {
    const x0 = s * (pw / 2 - 0.05), x1 = x0 - s * G.leaf, a = Math.min(x0, x1), b = Math.max(x0, x1);
    EB.box(out, [r3(a), r3(y0), 0], [r3(b), r3(y0 + len), r3(clear - 0.25)], 'str:timber', G.timber);
    for (const f of G.band) { const z = (clear - 0.25) * f; EB.box(out, [r3(a - s * 0.02), r3(y0), r3(z - 0.07)], [r3(b - s * 0.02), r3(y0 + len), r3(z + 0.07)], iron, G.iron, false); }
  }
}

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
    // (its laying and its loopholes or its merlons' slits, depth 2; then its STRUCTURE: a plinth, buttresses, a string
    // course: WALL_STRUCTURE)
    FB.bay(o, len, F, H, { depth: 2, gates: gate ? [gate] : [], seed: seed * 31 + k });
    wallStructure(o, len, F, H, gate);
    const at = (u) => [p[0] + d[0] * u, p[1] + d[1] * u];
    // (its collider split round its gate, so the trail passes; the gatehouse's towers each a box of their own)
    const boxes = gate ? [boxOf(p, at(gate.u - gate.w / 2), n, t), boxOf(at(gate.u + gate.w / 2), q, n, t)] : [boxOf(p, q, n, t)];
    pieces.push({ faces: place(o, p, d, n, z), boxes, z0: r3(z), z1: r3(z + H + F.parapet.h) });
    keep.push(boxOf(p, q, n, t));
    if (gate) {
      const g = at(gate.u), og = [];
      FB.gatehouse(og, F, H, gate.w, { depth: 1 });
      gateLeaves(og, F, gate.w);
      const side = (s) => { const c = at(gate.u + s * (gate.w / 2 + tw / 2)); return [c[0] - tw / 2, c[1] - tw / 2, c[0] + tw / 2, c[1] + tw / 2].map(r3); };
      pieces.push({ faces: place(og, g, d, n, z), boxes: [side(-1), side(1)], z0: r3(z), z1: r3(z + H + 3), gatehouse: true });
    }
  };
  const tower = (at, k) => {
    const z = gz(...at) - 0.4, o = [];
    FB.tower(o, F, H + 3, { depth: 2 });
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
