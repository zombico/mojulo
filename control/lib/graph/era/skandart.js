/**
 * SKANDART — a room's debris: what falls, wears off, is dropped or grows in a place, and where it comes to rest. A kit
 * answers the question on its card (`skandart`: each cause, what it is made of, where it lies); a recipe asks for it
 * (`skandart: true | 0…1 | { amount }`, era/stage.js) and, absent, nothing here runs and the room is as it was.
 *
 * The flow: read the place (its walls, their bays between the pilasters and their rhythm, its corners, its doorways,
 * the floor plan's border course, the set piece and its candles), answer each cause, build each clump ONCE in its own
 * frame, and lay it where the cause puts it: the stamps carry a place and a turn, and era/stage.js lights each one where
 * it lies and sends the clumps to the page as instanced repeats (one geometry a clump, one transform a stamp).
 *
 *   foot     a wall's coat failing low (damp rises): flakes of the render and spall of the ashlar behind it, along the
 *            border course at the wall's foot, a strip a bay, the bays in the wall's rhythm (era/wall-rhythm.js): the
 *            full strip and the lesser one, the same strip with less on it
 *   corner   what falls is pushed into the corners: spall heaped where two walls meet, against the pilasters' feet
 *   apron    the candles at the set piece's corners pour their wax on its dais and down onto the floor at its foot
 *   webs     swept within reach, left above it (era/crypt.js cryptCobwebs reads `plan.skandart`)
 *
 * The laws (SKANDART): nothing smaller than a hand is built (it is relief in the floor's tile, `openings-have-depth`'s
 * line); a piece is the size it would be (a course's chip, `built-scale`); its matter is what it fell from, its tone the
 * source's (`value-by-light`); big pieces lie against the wall and the small roll out toward the toe, never past the
 * border course into the walk; nothing floats and nothing stands in a wall. A clump is shaded only by how its faces turn
 * up (the same under every turn), so a stamp may turn and still be lit by where it lies.
 *
 *   readSkandart(m) → null | { amount }
 *   SKANDART                         the laws' numbers
 *   skandartTemplates(plan, amount)  → { [id]: { faces: [{ corners, normal, matter }], role } } in each clump's frame
 *   skandartStamps(plan, geom)       → [{ tpl, at: [x, y, z], rotZ, look: [nx, ny, nz] }] where each clump lies
 *   skandartLaws(plan, templates, stamps) → [{ law, ok, what }]
 *   skandartLay(plan, geom)          → the clumps, their stamps, and what the bake is asked (a probe a stamp, the paints)
 *   skandartRepeats(laid, { form | paintFills, grime }) → the clumps as instanced repeats, each stamp's light its tint
 * A clump that lies in the kit's gutter rests on the gutter's floor; a stone across its lip is not laid. Every piece is
 * a rock-pool chip, a flake of the coat or a pool of wax: a few dozen triangles, so a room's debris costs a few
 * thousand, drawn as one instanced draw a clump.
 * Pure; seeded by integer hashes.
 */
import { hash3 } from './dirt.js';
import { wallFrame, openingU, r5, hexRgb, rgbHex } from './geom.js';
import { generatedSpecOf } from '../landscape/surface-textures.js';
import { decodeSrgb, encodeSrgb } from '../color-theorist/light.js';
import { wallRhythm, rhythmFaults } from './wall-rhythm.js';
import { cryptTomb, tombSite } from './crypt.js';
import { rockPool } from '../polygonizer/rock-pool.js';

const mix = (a, b, t) => a + (b - a) * t;
const SIDES = ['-x', '+x', '-y', '+y'];

/** The laws' numbers. Metres and degrees. */
export const SKANDART = Object.freeze({
  // smaller than a hand is relief in the tile, never built (era/laws.js 'openings-have-depth' draws the line there)
  hand: 0.1,
  // loose stone's slope: a piece resting on another is lifted at most this steeply off the floor
  repose: 35,
  // an edge strip a bay, its length along the wall; a bay shorter than `bay` takes the lesser strip or none
  strip: 2, bay: 2.4,
  // a corner heap's reach from the corner, and how near a doorway a corner or a strip may lie
  corner: 0.95, door: 1.2,
  // how much the clumps' faces turn their shade by: a face turned down takes `down`, up 1, a wall-ward face between
  shade: Object.freeze({ down: 0.55, side: 0.78 }),
  // the most the amount dial makes of each clump (pieces)
  most: Object.freeze({ anchor: 3, spall: 7, flake: 8 }),
});

/** A recipe's `skandart`: true (the kit's answer at its middle amount), a number 0…1, or { amount }. → null | { amount } */
export function readSkandart(m) {
  const v = m.skandart;
  if (v === undefined || v === false) return null;
  const amt = (a) => {
    if (!(typeof a === 'number' && a >= 0 && a <= 1)) throw new Error('stage: skandart is true, a number from 0 (none) to 1 (the place has given way), or { amount }');
    return a;
  };
  if (v === true) return { amount: 0.6 };
  if (typeof v === 'number') return amt(v) > 0 ? { amount: v } : null;
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const k of Object.keys(v)) if (k !== 'amount') throw new Error(`stage: skandart.${k} is not a dial of it (amount)`);
    const a = v.amount === undefined ? 0.6 : amt(v.amount);
    return a > 0 ? { amount: a } : null;
  }
  return amt(v);
}

// ── the clumps, each in its own frame ──────────────────────────────────────────────────────
// An EDGE strip: x along the wall (−strip/2…strip/2), y out of the wall's face into the room, z up; the wall's face at
// y = 0. A CORNER heap: the two walls at x = 0 and y = 0, the room in +x +y. The APRON's wax: its pour at the candles on
// the dais (the dais's outer corner toward +x +y), its pool on the floor at the dais's foot.

const yawP = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; };
const tiltX = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; };

/** A rock-pool piece (a convex chip, its base at z 0, about 0.6 wide at scale 1) at `at`, `w` wide, turned `yaw`. */
function chip(pool, k, at, w, yaw, sink, matter) {
  const s = w / 0.6, T = pool[k % pool.length].faces;
  return T.map((f) => ({ corners: f.corners.map((p) => { const q = yawP(p, yaw); return [r5(at[0] + q[0] * s), r5(at[1] + q[1] * s), r5(at[2] + q[2] * s - sink)]; }), normal: yawP(f.outNormal, yaw).map(r5), matter }));
}

/** A flake of the coat: a thin irregular plate `w` across, `t` thick, lying at `at` tilted `tilt` about its own x, turned `yaw`. */
function flake(seed, at, w, t, tilt, yaw, matter) {
  const n = 6, ring = Array.from({ length: n }, (_, i) => { const a = (i / n) * 2 * Math.PI + (hash3(seed, i, 7101) - 0.5) * 0.6, r = (w / 2) * mix(0.65, 1, hash3(seed, i, 7103)); return [Math.cos(a) * r, Math.sin(a) * r * 0.8]; });
  const place = (p) => { const q = yawP(tiltX(p, tilt), yaw); return [r5(at[0] + q[0]), r5(at[1] + q[1]), r5(at[2] + q[2])]; };
  const up = yawP(tiltX([0, 0, 1], tilt), yaw).map(r5), down = up.map((v) => r5(-v) + 0);
  const top = ring.map(([x, y]) => place([x, y, t])), bot = ring.map(([x, y]) => place([x, y, 0])).reverse();
  const faces = [{ corners: top, normal: up, matter }, { corners: bot, normal: down, matter }];
  // its broken edge stands proud and casts (era/laws.js 'layers-stand-proud')
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], l = Math.hypot(mid[0], mid[1]) || 1;
    faces.push({ corners: [place([a[0], a[1], 0]), place([b[0], b[1], 0]), place([b[0], b[1], t]), place([a[0], a[1], t])], normal: yawP(tiltX([mid[0] / l, mid[1] / l, 0], tilt), yaw).map(r5), matter });
  }
  return faces;
}

/** A pool of wax: a few overlapping drops on a surface, each a low disc, `r` its largest radius. */
function wax(seed, at, r, drops, matter) {
  const faces = [];
  for (let d = 0; d < drops; d++) {
    const a = hash3(seed, d, 7201) * 2 * Math.PI, o = d === 0 ? 0 : r * mix(0.4, 0.9, hash3(seed, d, 7203)), rr = d === 0 ? r : r * mix(0.35, 0.6, hash3(seed, d, 7205));
    const c = [at[0] + Math.cos(a) * o, at[1] + Math.sin(a) * o], h = 0.004 + 0.003 * d, n = 7;
    const ring = Array.from({ length: n }, (_, i) => { const t = (i / n) * 2 * Math.PI; return [r5(c[0] + Math.cos(t) * rr), r5(c[1] + Math.sin(t) * rr)]; });
    faces.push({ corners: ring.map(([x, y]) => [x, y, r5(at[2] + h)]), normal: [0, 0, 1], matter });
    for (let i = 0; i < n; i++) { const p = ring[i], q = ring[(i + 1) % n], m = [(p[0] + q[0]) / 2 - c[0], (p[1] + q[1]) / 2 - c[1]], l = Math.hypot(m[0], m[1]) || 1;
      faces.push({ corners: [[p[0], p[1], r5(at[2])], [q[0], q[1], r5(at[2])], [q[0], q[1], r5(at[2] + h)], [p[0], p[1], r5(at[2] + h)]], normal: [r5(m[0] / l), r5(m[1] / l), 0], matter }); }
  }
  return faces;
}

/**
 * The pieces of a heap, graded: anchors (a course's chip) against the wall, spall rolled out from them, flakes of the
 * coat lying over and among them. `inside(x, y)` keeps a piece in its frame's ground (an edge strip's border course, a
 * corner's quarter); `wallDist(x, y)` is how far a point is from the nearest wall. Each piece → { kind, x, y, w, z, h }.
 */
function heapPieces(seed, amount, { span, reach, start, inside, wallDist, around, ground }) {
  const M = SKANDART.most, pieces = [];
  const nA = Math.max(1, Math.round(M.anchor * amount)), nS = Math.round(M.spall * amount), nF = Math.max(1, Math.round(M.flake * amount));
  const free = (x, y, w) => pieces.every((q) => q.kind === 'flake' || Math.hypot(q.x - x, q.y - y) > (q.w + w) * 0.45);
  for (let i = 0; i < nA; i++) for (let tries = 0; tries < 8; tries++) {
    const w = mix(0.18, 0.3, hash3(seed, i * 8 + tries, 7301)), [x, y] = around(hash3(seed, i * 8 + tries, 7303), start + w / 2 + 0.02);
    const z = inside(x, y, w) && free(x, y, w) ? ground(x, y, w) : null;
    if (z !== null) { pieces.push({ kind: 'anchor', x, y, w, z, ground: z, h: w * 0.66 }); break; }
  }
  // (no anchor found its ground: no heap here)
  if (!pieces.length) return pieces;
  // the spall rolls out from an anchor: the smaller, the farther (the slope sorts them)
  for (let i = 0; i < nS; i++) for (let tries = 0; tries < 8; tries++) {
    const A = pieces[Math.floor(hash3(seed, i * 8 + tries, 7311) * Math.min(pieces.length, nA))] || pieces[0];
    const w = mix(SKANDART.hand, 0.17, hash3(seed, i * 8 + tries, 7313)), out = (1 - (w - SKANDART.hand) / 0.07) * reach * 0.55 + 0.05;
    const a = (hash3(seed, i * 8 + tries, 7315) - 0.5) * 2.2, x = A.x + Math.sin(a) * (A.w * 0.5 + out * 0.6), y = Math.max(start + w / 2, A.y + Math.cos(a) * out);
    const z = inside(x, y, w) && free(x, y, w) ? ground(x, y, w) : null;
    if (z !== null) { pieces.push({ kind: 'spall', x, y, w, z, ground: z, h: w * 0.66 }); break; }
  }
  // the coat's flakes: wide and thin, lying among the stones and over them, leaning off the one they rest on
  for (let i = 0; i < nF; i++) {
    const w = mix(0.11, 0.24, hash3(seed, i, 7321)), x = (hash3(seed, i, 7323) - 0.5) * span, y = start + 0.03 + hash3(seed, i, 7325) ** 1.4 * reach * 0.9;
    if (!inside(x, y, w)) continue;
    const under = pieces.find((q) => q.kind !== 'flake' && Math.hypot(q.x - x, q.y - y) < q.w * 0.5), g = ground(x, y, w, true);
    if (g === null && !under) continue;
    pieces.push({ kind: 'flake', x, y, w, z: under ? under.z + under.h * 0.55 : g, ground: under ? under.z : g, h: 0.016, on: under || null, wall: wallDist(x, y) });
  }
  return pieces;
}

/**
 * The ground a piece lies on in a frame, by its distance from the nearest wall `d`: the gutter's floor where the kit has
 * a gutter at its walls' feet (era/stage.js: from the plinth's face, `width` wide, `depth` deep) and the piece lies
 * wholly in it; the floor wholly past it; a stone across the gutter's lip has no ground and is not laid (a flake, `lies`,
 * lies on the lip). → z or null
 */
function groundOf(K) {
  const g = K.gutter, lip = (K.plinth?.out ?? 0) + (g ? g.width : 0);
  return (d, w, lies = false) => {
    if (!g) return 0;
    if (d + w / 2 <= lip) return -g.depth;
    if (d - w / 2 >= lip) return 0;
    return lies ? 0 : null;
  };
}

/** Pieces → faces: an anchor and the spall from the kit's spall pool, a flake as a plate. The lesser strip keeps the
 *  anchors, the spall nearest the wall and every other flake: the same strip with less on it. */
function piecesFaces(pieces, pool, seed, matter) {
  const faces = [], tanR = Math.tan((SKANDART.repose * Math.PI) / 180);
  pieces.forEach((q, i) => {
    if (q.kind === 'flake') {
      // tilted off what it rests on, never steeper than loose stone lies
      const tilt = q.on ? Math.min(Math.atan(tanR), 0.35 + 0.3 * hash3(seed, i, 7401)) * (q.y > q.on.y ? 1 : -1) : (hash3(seed, i, 7403) - 0.5) * 0.12;
      faces.push(...flake(seed * 131 + i, [q.x, q.y, q.z + 0.002], q.w, q.h, tilt, hash3(seed, i, 7405) * Math.PI, matter.flake));
    } else faces.push(...chip(pool, Math.floor(hash3(seed, i, 7407) * 6), [q.x, q.y, q.z], q.w, hash3(seed, i, 7409) * 2 * Math.PI, q.w * 0.08, matter.stone));
  });
  return faces;
}
const lesser = (pieces) => { const S = pieces.filter((q) => q.kind === 'spall').sort((a, b) => a.y - b.y); const keep = new Set(S.slice(0, Math.ceil(S.length / 3)));
  let f = 0; return pieces.filter((q) => q.kind === 'anchor' || keep.has(q) || (q.kind === 'flake' && f++ % 2 === 0)); };

/** The clumps a kit's answer builds, each in its own frame: two families of edge strip (each its full and its lesser),
 *  two corner heaps, the wax's pour and its pool. → { [id]: { faces, role } } */
export function skandartTemplates(plan, amount) {
  const K = plan.kit, card = K.skandart, out = {};
  const start = (K.plinth?.out ?? 0) + 0.02, reach = Math.max(0.3, (K.floorPlan?.border?.w ?? 0.8) - start - 0.04);
  const pool = rockPool({ rock: 'basalt', variants: 6, detail: 0, tone: '#808080', seed: 'skandart-spall', group: 'skandart' });
  const matter = { stone: 'stone', flake: 'render' }, onGround = groundOf(K);
  if (card.foot) for (let fam = 0; fam < 2; fam++) {
    const seed = 911 + fam * 37, span = SKANDART.strip;
    const P = heapPieces(seed, amount, { span, reach, start,
      inside: (x, y, w) => Math.abs(x) + w / 2 < span / 2 && y - w / 2 >= start - 0.01 && y + w / 2 <= start + reach,
      wallDist: (x, y) => y,
      ground: (x, y, w, lies) => onGround(y, w, lies),
      around: (u, y) => [(u - 0.5) * span * 0.8, y] });
    const L = lesser(P);
    out[`foot-${fam}a`] = { role: 'foot', pieces: P, faces: piecesFaces(P, pool, seed, matter) };
    out[`foot-${fam}b`] = { role: 'foot', pieces: L, faces: piecesFaces(L, pool, seed, matter) };
  }
  if (card.corner) for (let fam = 0; fam < 2; fam++) {
    const seed = 1301 + fam * 41, R = SKANDART.corner, s0 = (K.pilaster ? K.pilaster.out + (K.pilaster.bands?.base?.out ?? 0) : K.plinth?.out ?? 0) + 0.02;
    const P = heapPieces(seed, Math.min(1, amount * 1.3), { span: R * 2, reach: R - s0, start: s0,
      inside: (x, y, w) => x - w / 2 >= s0 - 0.01 && y - w / 2 >= s0 - 0.01 && Math.hypot(x, y) + w / 2 <= R,
      wallDist: (x, y) => Math.min(x, y),
      ground: (x, y, w, lies) => onGround(Math.min(x, y), w, lies),
      // (the anchors in the angle itself, the rest fanned across the quarter)
      around: (u, d) => { const a = (Math.PI / 2) * mix(0.15, 0.85, u), o = 0.1 + 0.25 * u; return [d + Math.cos(a) * o * (u < 0.5 ? 1 : 0.2), d + Math.sin(a) * o * (u < 0.5 ? 0.2 : 1)]; } });
    const C = P.filter((q) => q.kind !== 'flake' || (q.x - q.w / 2 >= s0 - 0.01 && (q.on || onGround(Math.min(q.x, q.y), q.w, true) === q.z)));
    out[`corner-${fam}`] = { role: 'corner', pieces: C, faces: piecesFaces(C, pool, seed, matter) };
  }
  if (card.apron) {
    out['apron-pour'] = { role: 'apron', faces: wax(1501, [0.02, 0.02, 0], 0.07, 4, 'wax') };
    out['apron-pool'] = { role: 'apron', faces: wax(1503, [0.05, 0.05, 0], 0.11, 5, 'wax') };
  }
  return out;
}

// ── where they lie ────────────────────────────────────────────────────────────────────────
/** The turn that brings a clump's +y onto a wall's inward normal N. */
const turnTo = (N) => r5(Math.atan2(-N[0], N[1])) + 0;

/** Each room's walls with their pilasters (era/stage.js pilasters: { F, u, room }) and their doorway cuts. */
function wallsOf(plan, geom) {
  const out = [];
  plan.rooms.forEach((r) => SIDES.forEach((side) => {
    if (r.open.includes(side)) return;
    const F = wallFrame(r, side), same = (G) => G.N[0] === F.N[0] && G.N[1] === F.N[1] && Math.abs(G.o[0] - F.o[0]) + Math.abs(G.o[1] - F.o[1]) < 1e-6;
    const us = (geom.pilasters || []).filter((p) => p.room === r.id && same(p.F)).map((p) => p.u).sort((a, b) => a - b);
    const cuts = r.openings[side].map((op) => openingU(F, op));
    out.push({ r, side, F, us, cuts });
  }));
  return out;
}

/**
 * Where each clump lies in a room stage: a strip at the foot of each bay (the bays in the wall's rhythm, the full strip
 * and the lesser), a heap in each corner no doorway is near, the wax at the set piece's candles. A strip or a heap
 * keeps off a doorway and off the set piece's ground. → [{ tpl, at, rotZ, look }] (`look`: the way the place it lies
 * in faces, for its light)
 */
export function skandartStamps(plan, geom) {
  const K = plan.kit, card = K.skandart, out = [];
  const pw = K.pilaster ? K.pilaster.w / 2 + (K.pilaster.bands?.base?.out ?? 0) + 0.06 : 0.1;
  const site = card.apron && K.dress?.tomb ? tombSite(plan) : null;
  const clear = site ? { x: site.at[0], y: site.at[1], r: Math.hypot(site.w, site.d) / 2 + 0.9 } : null;
  const offSet = (x, y, rr) => !clear || Math.hypot(x - clear.x, y - clear.y) > clear.r + rr;
  const nearCut = (W, u) => W.cuts.some(([a, b]) => u > a - SKANDART.door && u < b + SKANDART.door);
  const walls = wallsOf(plan, geom);
  // (a stamp's light is read where its clump's mass is: in the gutter, if the kit has one, a third of a metre out)
  const mid = (K.plinth?.out ?? 0) + 0.25, gMid = K.gutter && mid < (K.plinth?.out ?? 0) + K.gutter.width ? -K.gutter.depth : 0;
  if (card.foot) walls.forEach((W, wi) => {
    // the bays between the pilasters (a wall without them, cut in strips' lengths)
    const edges = W.us.length ? W.us : Array.from({ length: Math.max(1, Math.floor(W.F.len / SKANDART.bay)) + 1 }, (_, i, a) => (i * W.F.len) / (a.length - 1));
    const bays = [];
    for (let i = 0; i + 1 < edges.length; i++) {
      const u0 = edges[i] + (W.us.length ? pw : 0.3), u1 = edges[i + 1] - (W.us.length ? pw : 0.3), mid = (u0 + u1) / 2;
      if (u1 - u0 < SKANDART.strip * 0.8 || W.cuts.some(([a, b]) => u1 > a - 0.4 && u0 < b + 0.4)) continue;
      const x = W.F.o[0] + W.F.U[0] * mid, y = W.F.o[1] + W.F.U[1] * mid;
      if (offSet(x, y, 1.2)) bays.push({ x, y, long: u1 - u0 >= SKANDART.bay });
    }
    if (!bays.length) return;
    // (the strips a wall takes keep its rhythm: the full strip and the lesser, never three alike, no pair repeated; a
    // bay too short for the full strip takes the lesser whatever the rhythm asked, and the laws say so)
    const order = wallRhythm(bays.length, { pick: hash3(wi, bays.length, 7501) }), fam = Math.floor(hash3(wi, 3, 7503) * 2);
    bays.forEach((b, i) => {
      const full = order[i] === 'A' && b.long;
      out.push({ tpl: `foot-${fam}${full ? 'a' : 'b'}`, at: [r5(b.x), r5(b.y), 0], rotZ: turnTo(W.F.N), look: [r5(W.F.N[0] * 0.6), r5(W.F.N[1] * 0.6), 0.8], mid: [r5(b.x + W.F.N[0] * mid), r5(b.y + W.F.N[1] * mid), r5(gMid)], wall: wi });
    });
  });
  if (card.corner) plan.rooms.forEach((r, ri) => {
    const C = [[r.x0, r.y0, 0], [r.x1, r.y0, Math.PI / 2], [r.x1, r.y1, Math.PI], [r.x0, r.y1, -Math.PI / 2]];
    C.forEach(([x, y, a], ci) => {
      // the two walls meeting there, both closed and no doorway near the corner
      const two = walls.filter((W) => W.r === r && Math.abs((x - W.F.o[0]) * W.F.N[0] + (y - W.F.o[1]) * W.F.N[1]) < 1e-6);
      if (two.length < 2) return;
      if (two.some((W) => { const u = (x - W.F.o[0]) * W.F.U[0] + (y - W.F.o[1]) * W.F.U[1]; return nearCut(W, u); })) return;
      if (!offSet(x, y, SKANDART.corner)) return;
      const d = [Math.cos(a + Math.PI / 4), Math.sin(a + Math.PI / 4)];
      out.push({ tpl: `corner-${Math.floor(hash3(ri, ci, 7511) * 2)}`, at: [r5(x), r5(y), 0], rotZ: r5(a) + 0, look: [r5(d[0] * 0.5), r5(d[1] * 0.5), 0.85], mid: [r5(x + d[0] * 0.6), r5(y + d[1] * 0.6), r5(gMid)] });
    });
  });
  if (card.apron && site) {
    const tomb = cryptTomb(plan), [tx, ty] = site.at;
    tomb.corners.forEach((c, i) => {
      const sx = Math.sign(c[0] - tx) || 1, sy = Math.sign(c[1] - ty) || 1, a = Math.atan2(sy, sx) - Math.PI / 4;
      out.push({ tpl: 'apron-pour', at: [r5(c[0]), r5(c[1]), r5(c[2])], rotZ: r5(a) + 0, look: [0, 0, 1] });
      out.push({ tpl: 'apron-pool', at: [r5(tx + sx * site.w / 2), r5(ty + sy * site.d / 2), 0], rotZ: r5(a) + 0, look: [r5(sx * 0.4), r5(sy * 0.4), 0.8] });
    });
  }
  return out;
}

/** The laws on what was laid: every piece bigger than a hand, none in a wall or past the border course, none floating,
 *  none on the walk. → [{ law, ok, what }] */
export function skandartLaws(plan, templates, stamps) {
  const K = plan.kit, rows = [], row = (law, what, ok) => rows.push({ law, what, ok: !!ok });
  const ext = (fs) => { const c = fs.flatMap((f) => f.corners); return [0, 1, 2].map((k) => [Math.min(...c.map((p) => p[k])), Math.max(...c.map((p) => p[k]))]); };
  const onGround = groundOf(K);
  for (const [id, T] of Object.entries(templates)) {
    if (!T.faces.length) continue;
    const e = ext(T.faces);
    // (every piece on its ground, the gutter's floor or the floor, or on the stone it rests on; read again from the kit)
    if (T.pieces) {
      const d = (q) => (T.role === 'corner' ? Math.min(q.x, q.y) : q.y);
      const off = T.pieces.filter((q) => (q.on ? Math.abs(q.z - (q.on.z + q.on.h * 0.55)) > 1e-9 : q.z !== onGround(d(q), q.w, q.kind === 'flake')));
      row('no-floating', `${id}: ${T.pieces.length - off.length} of ${T.pieces.length} pieces on their ground or on a stone`, !off.length);
      const small = T.pieces.filter((q) => q.w < SKANDART.hand);
      row('hand', `${id}: ${small.length} pieces smaller than a hand (relief in the tile, never built)`, !small.length);
    }
    if (T.role === 'foot') {
      row('not-in-the-wall', `${id}: nearest the wall ${r5(e[1][0])} m (the plinth stands ${K.plinth?.out ?? 0})`, e[1][0] >= (K.plinth?.out ?? 0) - 0.03);
      row('on-the-border', `${id}: farthest from the wall ${r5(e[1][1])} m (the border course ${K.floorPlan?.border?.w ?? 0.8})`, e[1][1] <= (K.floorPlan?.border?.w ?? 0.8) + 0.05);
    }
    if (T.role === 'corner') row('not-in-the-wall', `${id}: nearest either wall ${r5(Math.min(e[0][0], e[1][0]))} m`, Math.min(e[0][0], e[1][0]) >= (K.pilaster?.out ?? 0) - 0.03);
  }
  const byWall = new Map();
  for (const s of stamps) if (s.wall !== undefined) { if (!byWall.has(s.wall)) byWall.set(s.wall, []); byWall.get(s.wall).push(s.tpl.endsWith('a') ? 'A' : 'B'); }
  for (const [w, seq] of byWall) row('wall-rhythm', `wall ${w}'s strips ${seq.join('')}`, !rhythmFaults(seq).length);
  row('placed', `${stamps.length} clumps laid`, stamps.length > 0);
  return rows;
}

// ── to the page ──────────────────────────────────────────────────────────────────────────
/** What each matter is painted: the wall's render and its stone (the colours its dressed tile is generated from) under
 *  the wall's tint, the candles' wax as it is drawn. → { [matter]: { colour (sRGB 0…1), tint } } */
export function skandartMatters(kit) {
  const fam = kit.tiles?.wall?.family, S = fam ? generatedSpecOf(`${fam}-a`) : null, tint = kit.tint?.wall ?? [1, 1, 1];
  const of = (c, fallback) => (Array.isArray(c) ? c.map((v) => v / 255) : fallback);
  return {
    stone: { colour: of(S?.cfg?.stone, [0.45, 0.45, 0.45]), tint },
    render: { colour: of(S?.cfg?.render ?? S?.cfg?.stone, [0.55, 0.54, 0.52]), tint },
    wax: { colour: kit.dress?.candles?.wax ? hexRgb(kit.dress.candles.wax) : [0.9, 0.86, 0.75], tint: [1, 1, 1] },
  };
}

/** The room's debris laid: its clumps, where each lies, and what the bake is asked (a point a stamp's light is read at:
 *  a hand over the middle of its mass, facing the way its place faces, on the ground it lies on, so it takes that
 *  ground's grime; the matters' paints). */
export function skandartLay(plan, geom) {
  const templates = skandartTemplates(plan, plan.skandart.amount), stamps = skandartStamps(plan, geom).filter((s) => templates[s.tpl] && templates[s.tpl].faces.length);
  const matters = skandartMatters(plan.kit), names = Object.keys(matters);
  const probes = stamps.map((s) => { const l = Math.hypot(...s.look) || 1, m = s.mid ?? s.at; return { at: [m[0], m[1], r5(m[2] + 0.15)], normal: s.look.map((v) => r5(v / l)), group: m[2] < 0 ? 'stage:gutter' : 'stage:floor' }; });
  return { templates, stamps, matters, names, probes, paints: names.map((n) => matters[n]) };
}

/** A face's shade by how it turns: up 1, a side `side`, down `down` (the same under any turn about the vertical). */
const shadeOf = (n) => (n[2] >= 0 ? mix(SKANDART.shade.side, 1, n[2]) : mix(SKANDART.shade.side, SKANDART.shade.down, -n[2]));

/**
 * The clumps as instanced repeats, each stamp lit where it lies. In the form render (`form`: the bake's answer, its
 * `probes` and `paints`) a clump's colour is its matter's base and its corners carry its shade as their light, the
 * stamp's light its tint; in the paint (`paintFills`: the bake's fill at each probe) its colour is its matter's paint
 * by its shade, the stamp's light its tint (decoded: the page multiplies in linear). Unshaded, the paint alone.
 * → [{ template, transforms, group }]
 */
export function skandartRepeats(laid, { form = null, paintFills = null, grime = null } = {}) {
  const { templates, stamps, matters, names } = laid, out = [];
  const colourOf = (m, sh) => {
    if (form) { const b = form.paints[names.indexOf(m)]; return rgbHex(b.map((v) => encodeSrgb(Math.min(1, v)))); }
    const M = matters[m]; return rgbHex(M.colour.map((c, k) => c * M.tint[k] * sh));
  };
  for (const [id, T] of Object.entries(templates)) {
    const mine = stamps.map((s, i) => [s, i]).filter(([s]) => s.tpl === id);
    if (!mine.length || !T.faces.length) continue;
    const template = T.faces.map((f) => {
      const sh = r5(shadeOf(f.normal));
      const face = { corners: f.corners, normal: f.normal, outNormal: f.normal, fill: colourOf(f.matter, sh), doubleSided: true, group: `skandart:${id}` };
      return form ? { ...face, cornerLight: f.corners.length === 4 ? f.corners.map(() => [sh, sh, sh]) : [sh, sh, sh] } : face;
    });
    // (in the form render the grime of the ground it lies on, `grime`, darkens its light as it darkens that ground's base)
    const tintOf = (i) => (form ? form.probes[i].map((v, k) => r5(v * (grime ? grime[i][k] : 1))) : paintFills ? hexRgb(paintFills[i].fill).map((v) => r5(decodeSrgb(v))) : null);
    out.push({ template, group: `skandart:${id}`, transforms: mine.map(([s, i]) => ({ pos: s.at, rotZ: s.rotZ, scale: 1, ...(tintOf(i) ? { tint: tintOf(i) } : {}) })) });
  }
  return out;
}
