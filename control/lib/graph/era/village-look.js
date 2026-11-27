/**
 * A VILLAGE'S LOOK — the buildings of a glyph map's town (a region that says `town`, level/grid.js) dressed as an anime
 * game's village is: in a PALETTE OF THEIR OWN, apart from the land's (its grass and its leaves, its rock and its soil are
 * the cube's; a village's walls, roofs and paint are this), and each one DRESSED so it reads at a glance and every part of
 * it is considered:
 *
 *   THE PALETTE (VILLAGE_LOOKS[look])  walls of pastel lime plaster (cream, blush, lavender, butter), timber dark and warm, a footing of cool blue-grey
 *                     stone, and ROOFS in hues the meadow never wears (cobalt, teal, terracotta, plum, indigo, amber),
 *                     none green: a roof stands off the grass by hue as the walls stand off it by value. Each building
 *                     its own roof by what it is (the hall cobalt, the tavern terracotta) or, a home, by its dice, its
 *                     shutters and its door the roof's own hue taken deeper, its window frames white
 *   THE DRESS (villageDress)  on the walls the shell already stands: a STONE FOOTING round them, TIMBER at every corner
 *                     and under the eaves (and a rail at the upper floor where the wall is tall), STUDS between the
 *                     windows, a pair of SHUTTERS opened back beside each window, a FRAME round the door; a CHIMNEY on a
 *                     home or a tavern, a hanging SIGN on its bracket by the tavern's door, BANNERS either side of the
 *                     hall's
 *   ITS GROUND (VILLAGE.clear)  the land round each building kept clear of trees `clear` metres out, and laid as the
 *                     land's own levelled ground, never a poured slab
 *
 *   villageOf(look, b, seed)          → { look, wall, timber, stone, roof, shutter, door, frame, sign } one building's colours
 *   villageDress(V, { rects, tops, holes, ways, entry, below, pitch, use, wall }) → [{ corners, group, colour }] in the
 *                     plan's frame (metres, z up from the floor), the faces to paint and light as the shell is; `wall` the
 *                     wall's half thickness (a window's hole is measured on the room's face, its dress on the shell's)
 *   villageLight(hex, lam) → a face's colour under the sun: the shade side lifted, as an anime game lights a building
 *   gableDress(tri, colour) → a gable end's barge boards, tie beam and king post, in the world's frame
 *   villagePaint(V, group)  → a building language's group in the village's palette (a street house's)
 *   VILLAGE_LANGUAGE        the fantasy language a town's street houses are spoken in
 *   villagePlaces(T, open, width, free) → the street's houses' places on a town's path tile
 *   villageTurret(V, { x, y, z0, top, r? }) → a round turret with a cone roof; turreted(id, seed) whether a house has one
 *
 * Pure and deterministic: the same building, the same village.
 */

export const VILLAGE_LOOKS = Object.freeze({
  storybook: Object.freeze({
    walls: Object.freeze(['#f4ead6', '#f3d9d2', '#e6def0', '#f5ecc6']),
    timber: '#5b3a29', stone: '#8c95a6', frame: '#fbf7ee', sign: '#e2ba2c',
    roofs: Object.freeze({ hall: '#3a63b0', tavern: '#c4533a', homes: Object.freeze(['#2f8a9a', '#8a4a8f', '#4b4f9e', '#d08a2c', '#3f7fae']) }),
  }),
});
export const VILLAGE_LOOK_IDS = Object.freeze(Object.keys(VILLAGE_LOOKS));
/** The village's numbers: the groves and the boulders a town's tile keeps (era/isekai.js), how far trees keep off its
 * buildings (m), the dress's sizes (m). */
export const VILLAGE = Object.freeze({ groves: 1, boulders: 1, clear: 7, barge: 0.24, footing: 0.55, proud: 0.07, post: 0.24, girt: 0.2, stud: 0.16, studEvery: 2.1, shutter: 0.05, jamb: 0.16, rail: 2.6 });

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hex = (c) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
const deeper = (h, k) => hex(rgb(h).map((v) => v * k));

/** A face's colour at its sun (lam, 0 turned away to 1 square to it): its shade side lifted, never grey. */
export const villageLight = (h, lam) => hex(rgb(h).map((v) => v * (0.82 + 0.18 * Math.max(0, Math.min(1, lam)))));
/** One building's colours, by what it is and its dice. */
export function villageOf(look, b, seed = 1) {
  const L = VILLAGE_LOOKS[look];
  if (!L) throw new Error(`village: the look is one of ${VILLAGE_LOOK_IDS.join(', ')}`);
  const d = hash(`${b.id ?? ''}|${seed}`), use = b.use;
  const roof = use === 'hall' ? L.roofs.hall : use === 'tavern' ? L.roofs.tavern : L.roofs.homes[d % L.roofs.homes.length];
  return { look, wall: L.walls[(d >>> 3) % L.walls.length], timber: L.timber, stone: L.stone, roof, shutter: deeper(roof, 0.78), door: deeper(roof, 0.55), frame: L.frame, sign: L.sign };
}

// a box's six faces wound outward, in the plan's frame
function box(x0, y0, z0, x1, y1, z1, group, colour) {
  const q = (cs) => ({ corners: cs, group, colour });
  return [
    q([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]), q([[x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0]]),
    q([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]), q([[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]]),
    q([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]]), q([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]]),
  ];
}
// a strip along a wall: from `a` to `b` on the plan (a run along x or y), out `d` past its face on the side `n`
function strip(run, z0, z1, d, group, colour) {
  const { x0, y0, x1, y1, n } = run;
  if (n[1] !== 0) { const y = n[1] < 0 ? y0 : y1; return box(Math.min(x0, x1), Math.min(y, y + n[1] * d), z0, Math.max(x0, x1), Math.max(y, y + n[1] * d), z1, group, colour); }
  const x = n[0] < 0 ? x0 : x1; return box(Math.min(x, x + n[0] * d), Math.min(y0, y1), z0, Math.max(x, x + n[0] * d), Math.max(y0, y1), z1, group, colour);
}

/** The outer runs of the rooms' walls: each room's sides where no other room stands against them, cut into the stretches
 * that are outside. → [{ x0, y0, x1, y1, n, room, top }] */
function outerRuns(rects, tops) {
  const inside = (x, y, skip) => rects.some((R, k) => k !== skip && x > R[0] + 1e-6 && x < R[2] - 1e-6 && y > R[1] + 1e-6 && y < R[3] - 1e-6);
  const runs = [];
  rects.forEach((R, k) => {
    const [x0, y0, x1, y1] = R, sides = [[[x0, y0], [x1, y0], [0, -1]], [[x1, y0], [x1, y1], [1, 0]], [[x1, y1], [x0, y1], [0, 1]], [[x0, y1], [x0, y0], [-1, 0]]];
    for (const [p, q, n] of sides) {
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]), N = Math.max(1, Math.round(L / 0.5)), out = [];
      for (let s = 0; s < N; s++) { const t = (s + 0.5) / N, x = p[0] + (q[0] - p[0]) * t + n[0] * 0.3, y = p[1] + (q[1] - p[1]) * t + n[1] * 0.3; out.push(!inside(x, y, k)); }
      let s = 0;
      while (s < N) { if (!out[s]) { s++; continue; } let e = s; while (e < N && out[e]) e++;
        const a = [p[0] + ((q[0] - p[0]) * s) / N, p[1] + ((q[1] - p[1]) * s) / N], b = [p[0] + ((q[0] - p[0]) * e) / N, p[1] + ((q[1] - p[1]) * e) / N];
        runs.push({ x0: a[0], y0: a[1], x1: b[0], y1: b[1], n, room: k, top: tops[k] }); s = e; }
    }
  });
  return runs;
}

/** The dress of one building (see the header), in the plan's frame. */
export function villageDress(V, { rects, tops, holes = [], ways = [], entry = null, below = 0.3, pitch = 35, use = 'dwelling', wall = 0.25 }) {
  const D = VILLAGE, out = [], runs = outerRuns(rects, tops);
  const along = (r) => (r.n[1] !== 0 ? 'x' : 'y'), lo = (r) => (along(r) === 'x' ? Math.min(r.x0, r.x1) : Math.min(r.y0, r.y1)), hi = (r) => (along(r) === 'x' ? Math.max(r.x0, r.x1) : Math.max(r.y0, r.y1));
  const plane = (r) => (along(r) === 'x' ? (r.n[1] < 0 ? r.y0 : r.y1) : (r.n[0] < 0 ? r.x0 : r.x1));
  // (what is cut through a run's wall: its windows and its doors, each an interval along it)
  const cutsOn = (r) => [
    ...holes.filter((h) => (along(r) === 'x' ? h.n[0] === 0 && Math.sign(h.n[1]) === r.n[1] : h.n[1] === 0 && Math.sign(h.n[0]) === r.n[0]) && Math.abs(h.plane - plane(r)) < 0.6 + wall).map((h) => [h.u0, h.u1]),
    ...(entry && along(r) === 'x' && r.n[1] < 0 && Math.abs(plane(r) - entry.y) < 0.6 ? ways.map((w) => [w.lo, w.hi]) : []),
  ];
  for (const r of runs) {
    const top = r.top, cuts = cutsOn(r), a = lo(r), b = hi(r);
    // THE FOOTING: stone from under the floor to knee height
    out.push(...strip(r, -below - 0.05, D.footing, D.proud + 0.03, 'building:dress-stone', V.stone));
    // THE TIMBER: a girt under the eaves, and a rail at the upper floor on a tall wall
    out.push(...strip(r, top - 0.34, top - 0.34 + D.girt, D.proud, 'building:dress-timber', V.timber));
    if (top > D.rail + 1.2) out.push(...strip(r, D.rail, D.rail + D.girt * 0.8, D.proud, 'building:dress-timber', V.timber));
    // ITS STUDS between what is cut through it, every `studEvery` metres, never across a window or a door
    const N = Math.floor((b - a) / D.studEvery);
    for (let k = 1; k < N; k++) {
      const u = a + ((b - a) * k) / N;
      if (cuts.some(([c0, c1]) => u > c0 - 0.35 && u < c1 + 0.35)) continue;
      const s = along(r) === 'x' ? { ...r, x0: u - D.stud / 2, x1: u + D.stud / 2 } : { ...r, y0: u - D.stud / 2, y1: u + D.stud / 2 };
      out.push(...strip(s, D.footing, top - 0.34, D.proud * 0.8, 'building:dress-timber', V.timber));
    }
  }
  // THE CORNERS: a post at every corner two outer runs meet at
  const ends = runs.flatMap((r) => [[r.x0, r.y0, r], [r.x1, r.y1, r]]), seen = new Set();
  for (const [x, y, r] of ends) {
    const key = `${x.toFixed(2)},${y.toFixed(2)}`, other = ends.find(([x2, y2, r2]) => r2 !== r && Math.abs(x2 - x) < 1e-3 && Math.abs(y2 - y) < 1e-3 && (r2.n[0] !== r.n[0] || r2.n[1] !== r.n[1]));
    if (!other || seen.has(key)) continue;
    seen.add(key);
    const n = [r.n[0] + other[2].n[0], r.n[1] + other[2].n[1]], h = D.post / 2, cx = x + n[0] * (D.proud - h + 0.02), cy = y + n[1] * (D.proud - h + 0.02);
    out.push(...box(cx - h, cy - h, D.footing, cx + h, cy + h, Math.min(r.top, other[2].top) - 0.14, 'building:dress-timber', V.timber));
  }
  // THE WINDOWS: a white frame round each and its shutters opened back beside it
  for (const w of holes) {
    // (a window's hole is measured on the room's own face; the shell's outer face stands the wall's half thickness out)
    const pl = w.plane + (w.n[0] === 0 ? w.n[1] : w.n[0]) * wall;
    const al = w.n[0] === 0, o = (u, v, z) => (al ? [u, pl + w.n[1] * v, z] : [pl + w.n[0] * v, u, z]);
    const slab = (u0, u1, z0, z1, v0, v1, group, colour) => { const A = o(u0, v0, z0), B = o(u1, v1, z1); return box(Math.min(A[0], B[0]), Math.min(A[1], B[1]), z0, Math.max(A[0], B[0]), Math.max(A[1], B[1]), z1, group, colour); };
    const fw = 0.09, sw = Math.min(0.75, (w.u1 - w.u0) / 2 + 0.05);
    out.push(...slab(w.u0 - fw, w.u0, w.z0 - fw, w.z1 + fw, 0, 0.06, 'building:dress-frame', V.frame), ...slab(w.u1, w.u1 + fw, w.z0 - fw, w.z1 + fw, 0, 0.06, 'building:dress-frame', V.frame));
    out.push(...slab(w.u0 - fw - 0.04 - sw, w.u0 - fw - 0.04, w.z0, w.z1, 0, D.shutter, 'building:dress-shutter', V.shutter), ...slab(w.u1 + fw + 0.04, w.u1 + fw + 0.04 + sw, w.z0, w.z1, 0, D.shutter, 'building:dress-shutter', V.shutter));
  }
  // THE DOOR: a timber frame round the way in (its jambs and its head), and, a tavern's, its sign; a hall's, its banners
  if (entry && ways.length) {
    const w = ways[0], y = entry.y - 0.25, head = Math.min(2.5, (tops[0] ?? 3) - 0.5), J = D.jamb;
    out.push(...box(w.lo - J, y - 0.1, 0, w.lo, y + 0.02, head, 'building:dress-timber', V.timber), ...box(w.hi, y - 0.1, 0, w.hi + J, y + 0.02, head, 'building:dress-timber', V.timber));
    out.push(...box(w.lo - J - 0.06, y - 0.12, head, w.hi + J + 0.06, y + 0.02, head + 0.22, 'building:dress-timber', V.timber));
    if (use === 'tavern') {
      const x = w.hi + 0.9;
      out.push(...box(x - 0.05, y - 1.0, 2.75, x + 0.05, y, 2.85, 'building:dress-timber', V.timber));
      out.push(...box(x - 0.36, y - 0.98, 2.0, x + 0.36, y - 0.9, 2.66, 'building:dress-sign', V.sign), ...box(x - 0.42, y - 0.99, 1.94, x + 0.42, y - 0.89, 2.0, 'building:dress-timber', V.timber));
    }
    if (use === 'hall') for (const x of [w.lo - 1.1, w.hi + 1.1]) out.push(...box(x - 0.36, y - 0.14, Math.max(1.2, head - 0.9), x + 0.36, y - 0.1, head + 1.4, 'building:dress-banner', V.roof));
  }
  // A TURRET on the hall's and the tavern's front corner, the one further from the door
  if ((use === 'hall' || use === 'tavern') && rects.length && entry && ways.length) {
    const R = rects[0], w = ways[0], cx = Math.abs(R[0] - w.lo) > Math.abs(R[2] - w.hi) ? R[0] : R[2];
    out.push(...villageTurret(V, { x: cx, y: R[1], z0: -below, top: tops[0] }));
  }
  // THE CHIMNEY: a home's or a tavern's, stone, at the far end of its biggest room, standing through its roof
  if (use !== 'hall' && rects.length) {
    const k = rects.map((R, i) => [i, (R[2] - R[0]) * (R[3] - R[1])]).sort((p, q) => q[1] - p[1])[0][0], R = rects[k], top = tops[k];
    const rise = (Math.min(R[2] - R[0], R[3] - R[1]) / 2) * Math.tan((Math.max(15, Math.min(55, pitch)) * Math.PI) / 180);
    const cx = R[2] - 0.9, cy = (R[1] + R[3]) / 2 + (R[3] - R[1]) * 0.18;
    out.push(...box(cx - 0.38, cy - 0.38, top - 0.4, cx + 0.38, cy + 0.38, top + rise * 0.8 + 0.9, 'building:dress-stone', V.stone), ...box(cx - 0.45, cy - 0.45, top + rise * 0.8 + 0.9, cx + 0.45, cy + 0.45, top + rise * 0.8 + 1.05, 'building:dress-stone', V.stone));
  }
  return out;
}

/**
 * A GABLE's timber (a village building's gable end, the shell's own triangle in the world's frame): barge boards down its
 * two sloped edges, a tie beam across its foot and a king post from the beam to the ridge, each a band on its face set a
 * hand proud of it. → [{ corners, group, colour }]
 */
export function gableDress(tri, colour) {
  if (!Array.isArray(tri) || tri.length !== 3) return [];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], k = (a, f) => a.map((v) => v * f);
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], un = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  const n = un(cr(sub(tri[1], tri[0]), sub(tri[2], tri[0]))), out = k(n, VILLAGE.proud * 0.8), mid = k(add(add(tri[0], tri[1]), tri[2]), 1 / 3), W = VILLAGE.barge;
  // (the apex: the corner highest up; the foot: the other two)
  const ai = [0, 1, 2].sort((a, b) => tri[b][2] - tri[a][2])[0], apex = tri[ai], [f0, f1] = tri.filter((_, i) => i !== ai);
  const band = (p, q, w) => { const d0 = un(cr(n, sub(q, p))), toMid = sub(mid, p), d = d0[0] * toMid[0] + d0[1] * toMid[1] + d0[2] * toMid[2] >= 0 ? d0 : k(d0, -1);
    const cs = [p, q, add(q, k(d, w)), add(p, k(d, w))].map((c) => add(c, out)), nn = un(cr(sub(cs[1], cs[0]), sub(cs[3], cs[0])));
    return { corners: nn[0] * n[0] + nn[1] * n[1] + nn[2] * n[2] < 0 ? cs.slice().reverse() : cs, group: 'building:dress-timber', colour }; };
  const footMid = k(add(f0, f1), 0.5), post = (() => { const h = sub(apex, footMid), side = un(sub(f1, f0)), half = k(side, VILLAGE.post / 2);
    const cs = [sub(footMid, half), add(footMid, half), add(apex, half), sub(apex, half)].map((c) => add(c, out)), nn = un(cr(sub(cs[1], cs[0]), sub(cs[3], cs[0])));
    return { corners: nn[0] * n[0] + nn[1] * n[1] + nn[2] * n[2] < 0 ? cs.slice().reverse() : cs, group: 'building:dress-timber', colour, h: Math.hypot(...h) }; })();
  return [band(f0, apex, W), band(apex, f1, W), band(f0, f1, VILLAGE.girt), post].map(({ h: _h, ...f }) => f);
}

/** A building-language group's colour in a village's palette (a street house spoken in its language, era/out-anchor-structure.js
 * speak): its plaster the walls', its stone and timber, its tile the roof's, its paint the shutters', its openings dark. */
const GROUP_OF = Object.freeze({ 'str:plaster': 'wall', 'str:shell': 'wall', 'str:stone': 'stone', 'str:timber': 'timber', 'str:tile': 'roof', 'str:roof': 'roof', 'str:paint': 'shutter', 'str:motif': 'sign', 'str:opening': 'glass', 'str:lens': 'glass' });
export function villagePaint(V, group) {
  const k = GROUP_OF[group] ?? 'stone';
  return k === 'glass' ? '#2c3442' : V[k];
}

/**
 * THE VILLAGE'S LANGUAGE (a building language written as its elements, era/out-anchor-elements.js ELEMENT_SETS' shape):
 * what a fantasy village's street houses are spoken in. A stone ground storey under a plaster one framed in timber,
 * quoined, a band painted at the storey; a steep gable with a deep eave and a cornice under it, finials at the ridge's
 * ends; round-headed lights on stone sills under keystone heads, shutters at most; an arched door; a chimney; its own
 * street of setts between flagged walks, lanterns on brackets (a map's town lays its ways in brick itself, VILLAGE_WAY).
 * Passed as a street town's `anchor` (a map's town tiles).
 */
const SG = (group, value, bond = 'none') => ({ group, value, bond });
export const VILLAGE_LANGUAGE = Object.freeze({
  read: 'a storybook house: a stone ground storey under a timber-framed plaster one, a steep gable with finials, round-headed windows with keystones, shutters, an arched door and a chimney; a street of setts with lanterns',
  storeyH: 2.9,
  elements: {
    wall: { kind: 'wall', storeys: [SG('str:stone', 0.62, 'coursed'), SG('str:plaster', 0.88)] },
    roof: { kind: 'cap', form: 'gable', pitch: 54, eave: 0.95, group: 'str:tile', value: 0.5, courses: true },
    lights: { kind: 'light', form: 'arch', w: 1.0, h: 1.5, sill: 0.85, bay: 2.6, group: 'str:opening', value: 0.04 },
    door: { kind: 'door', form: 'arch', w: 1.2, h: 2.3 },
    socle: { kind: 'socle', h: 0.5, group: 'str:stone', value: 0.48 },
    sills: { kind: 'sill', h: 0.16, over: 0.08, group: 'str:stone', value: 0.78 },
    lintels: { kind: 'lintel', h: 0.24, form: 'key', group: 'str:stone', value: 0.7 },
    quoins: { kind: 'quoins', w: 0.36, course: 0.3, group: 'str:stone', value: 0.8 },
    cornice: { kind: 'cornice', h: 0.22, proud: 0.14, group: 'str:timber', value: 0.38 },
    bands: { kind: 'band', w: 0.2, group: 'str:paint', value: 0.55 },
    finial: { kind: 'point', count: 2, len: 0.22, base: 0.22, group: 'str:motif', value: 0.6 },
    stack: { kind: 'chimney', w: 0.6, group: 'str:stone', value: 0.55 },
    frame: { kind: 'frame', member: 0.2, group: 'str:timber', value: 0.25 },
    shutters: { kind: 'shutters', share: 0.8, group: 'str:paint', value: 0.55 },
    road: { kind: 'road', paving: 'setts' }, footway: { kind: 'footway', w: 1.5, paving: 'flags' }, kerb: { kind: 'kerb', h: 0.12, w: 0.22 },
    lamp: { kind: 'lamp', h: 3, head: 'lantern', arm: 'bracket', stride: 14 }, post: { kind: 'post', h: 0.9, form: 'capped', stride: 3.2 },
    pickets: { kind: 'boundary', form: 'picket', roles: ['front'], lift: 0.6, pier: 2.4 },
    yards: { kind: 'boundary', form: 'drystone', roles: ['side', 'back', 'field', 'guard', 'retain'], lift: 0.4, pier: 4, cope: 0.06 },
  },
  compose: { mass: { kind: 'block', w: 8, d: 7 }, storeys: 2, annex: { scale: 0.6 } },
});

/**
 * THE STREET'S HOUSES on a town's path tile (a map's, level/grid-scene.js): one each side of a straight way through it,
 * its door `off` metres off the way's middle, facing it, on the sides whose neighbour is open land (never against a
 * place's building, another way, or the map's edge). → [{ x, y, facing }] in the tile's frame (x east, y north, 0 to T).
 */
export const VILLAGE_STREET = Object.freeze({ verge: 2.6 });
/** A town's ways: paved in brick, never narrower than a street. */
export const VILLAGE_WAY = Object.freeze({ surface: 'brick-paving', width: 3.4 });
export function villagePlaces(T, open, width, free) {
  const o = [...(open ?? [])].sort().join(''), off = width / 2 + VILLAGE_STREET.verge, m = T / 2, out = [];
  if (o === 'ew') { if (free.n) out.push({ x: m, y: m + off, facing: '-y' }); if (free.s) out.push({ x: m, y: m - off, facing: '+y' }); }
  if (o === 'ns') { if (free.e) out.push({ x: m + off, y: m, facing: '-x' }); if (free.w) out.push({ x: m - off, y: m, facing: '+x' }); }
  return out;
}

/**
 * A TURRET (a fantasy village's mark: on the hall, the tavern and a share of the street's houses): a round tower of
 * `sides` faces at a front corner, its stone footing, its plaster shaft past the eaves, a band of timber at its top, a cone
 * roof in the building's roof's hue `rise` times its radius tall, a gold finial at its point. In whatever frame `at` is
 * given in (metres, z up). → [{ corners, group, colour }]
 */
export const TURRET = Object.freeze({ r: 1.3, sides: 12, past: 1.8, rise: 2.4, finial: 0.7, share: 0.4 });
export function villageTurret(V, { x, y, z0, top, r = TURRET.r }) {
  const N = TURRET.sides, out = [], ring = (rad, z) => Array.from({ length: N }, (_, k) => { const a = (2 * Math.PI * k) / N; return [x + Math.cos(a) * rad, y + Math.sin(a) * rad, z]; });
  const shaft = (r0, za, zb, group, colour) => { const A = ring(r0, za), B = ring(r0, zb); for (let k = 0; k < N; k++) { const k1 = (k + 1) % N; out.push({ corners: [A[k], A[k1], B[k1], B[k]], group, colour }); } };
  const h = top + TURRET.past;
  shaft(r + 0.06, z0, Math.min(h, z0 + VILLAGE.footing + 0.5), 'building:dress-stone', V.stone);
  shaft(r, z0 + VILLAGE.footing + 0.5, h - 0.25, 'building:turret', V.wall);
  shaft(r + 0.05, h - 0.25, h, 'building:dress-timber', V.timber);
  // (the cone, its eave a little out past the shaft)
  const eave = ring(r + 0.35, h), apex = [x, y, h + r * TURRET.rise];
  for (let k = 0; k < N; k++) out.push({ corners: [eave[k], eave[(k + 1) % N], apex], group: 'building:roof', colour: V.roof });
  for (let k = 0; k < N; k++) out.push({ corners: [eave[(k + 1) % N], eave[k], [x, y, h]], group: 'building:roof', colour: V.roof });
  // (its finial: a thin gold spike from the cone's point)
  const f0 = ring(0.07, apex[2] - 0.05);
  for (let k = 0; k < N; k++) out.push({ corners: [f0[k], f0[(k + 1) % N], [x, y, apex[2] + TURRET.finial]], group: 'building:dress-sign', colour: V.sign });
  return out;
}
/** Whether a street's house of this id carries a turret (TURRET.share of them, by its dice). */
export const turreted = (id, seed = 1) => (hash(`turret|${id}|${seed}`) % 1000) / 1000 < TURRET.share;
