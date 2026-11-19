/**
 * LEVEL 0'S PLAN — a sneak's level read from its recipe (level0.json) and what the land grew: the cover's boxes (what is
 * parked and laid, and the land's own shrubs), the watchers as the route search knows them, and for each interaction
 * point the ways through it (gameworld/stealth-routes.js). Pure but for the vehicle registry's boxes: no page is made.
 *
 *   coverBoxes(L, colliders)  → [{ id, min, max }] flat to the search (a box's foot on the ground, its height its own)
 *   watchersOf(L)             → the recipe's watchers as the search reads them
 *   planLevel(L, colliders)   → { boxes, watchers, points: [{ id, reads, routes }], laws }
 *   planSvg(L, plan, field)   → the level seen from above: cover, each watcher's round and fan, each point's first try
 *                               (seen), its way unseen and its second way
 */
import { sneakRoutes, watcherAt } from '../../../lib/graph/gameworld/stealth-routes.js';
import { withParked } from '../../../lib/graph/vehicle-registry/parked.js';
import { readTallGrass } from '../../../lib/graph/form/tall-grass.js';

/** The trail's line from its own faces (the land's `trail` group): x across the site at each metre up it, the mean of
 *  the faces' middles there, read between the metres. → { x(y), samples: [[y, x]] } */
export function spineFrom(faces) {
  const by = new Map();
  for (const f of faces) {
    if (!/trail/.test(String(f.group ?? '')) || !Array.isArray(f.corners)) continue;
    const n = f.corners.length, cx = f.corners.reduce((a, q) => a + q[0], 0) / n, cy = f.corners.reduce((a, q) => a + q[1], 0) / n, k = Math.round(cy);
    const b = by.get(k) ?? [0, 0]; b[0] += cx; b[1]++; by.set(k, b);
  }
  return spineOf([...by].sort((a, b) => a[0] - b[0]).map(([y, [sx, n]]) => [y, +(sx / n).toFixed(3)]));
}
export function spineOf(samples) {
  const x = (y) => {
    if (!samples.length) return 0;
    if (y <= samples[0][0]) return samples[0][1];
    for (let k = 1; k < samples.length; k++) if (y <= samples[k][0]) { const [y0, x0] = samples[k - 1], [y1, x1] = samples[k]; return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0 || 1); }
    return samples[samples.length - 1][1];
  };
  return { x, samples };
}
/** The recipe with every place said along the trail (`{ trail, off }`: metres up it from its head, metres to its side,
 *  east positive) set down as [x, y] on this land's trail; a place already [x, y] stays as it is. */
const laneOf = (spine, [y0, y1], [lo, hi]) => { let a = Infinity, b = -Infinity; for (let y = y0; y <= y1; y += 1) { a = Math.min(a, spine.x(y) + lo); b = Math.max(b, spine.x(y) + hi); } return [+a.toFixed(2), +b.toFixed(2)]; };
export function placeRecipe(L, spine) {
  const at = (p) => (Array.isArray(p) ? p : p && typeof p === 'object' ? [+(spine.x(p.trail) + (p.off ?? 0)).toFixed(2), p.trail] : p);
  const structures = (L.structures ?? []).map((t) => ({ ...t, ...(t.at ? { at: at(t.at) } : {}), ...(t.from ? { from: at(t.from), to: at(t.to) } : {}) }));
  // (a watcher posted on a tower stands where the tower does)
  const posted = (w) => (w.on ? (structures.find((t) => t.id === w.on) ?? {}).at : at(w.at));
  return { ...L, structures, start: at(L.start), exit: at(L.exit), ...(L.backup ? { backup: { ...L.backup, from: at(L.backup.from) } } : {}),
    cover: L.cover.map((c) => ({ ...c, at: at(c.at) })), watchers: L.watchers.map((w) => ({ ...w, at: posted(w), ...(w.to ? { to: at(w.to) } : {}), ...(w.facing ? { facing: at(w.facing) } : {}) })),
    // (a point searched in a LANE, `off: [lo, hi]`: metres to the trail's side, the band of the field it may go through,
    // laid as the trail's own x either side over its window)
    points: L.points.map((P) => ({ ...P, from: at(P.from), to: at(P.to), ...(P.off ? { lane: laneOf(spine, P.window, P.off) } : {}) })), hints: L.hints.map((h) => ({ ...h, at: at(h.at) })), ...(L.supplies ? { supplies: L.supplies.map((x) => ({ ...x, at: at(x.at) })) } : {}),
    // (its tall grass, each patch's middle along the trail too: form/tall-grass.js)
    ...(L.grass ? { grass: L.grass.map((g) => ({ ...g, at: at(g.at) })) } : {}),
    // (its floodlights' places and aims too)
    ...(L.floods ? { floods: L.floods.map((f) => ({ ...f, ...(f.at ? { at: at(f.at) } : {}), aim: at(f.aim) })) } : {}) };
}

/**
 * THE STRUCTURES a patrol builds where it stands, static and cheap (a few boxes each, drawn as the static world's own
 * faces, never a body): `sandbags` a run of bags a metre high from `from` to `to` (it hides a crouch); `wire` a run of
 * coiled wire on stakes (it stops a body, it hides nothing); `tower` a watchtower at `at`, its platform `height` up on
 * four legs (a watcher posted `on` it sees from there, over what a guard on the ground cannot).
 */
export const STRUCTURE = Object.freeze({
  sandbags: Object.freeze({ h: 1.0, d: 0.75, fill: '#8a7a55', top: '#9c8b62' }),
  wire: Object.freeze({ h: 0.9, d: 0.6, fill: '#3a3d40', stake: '#5a4630' }),
  tower: Object.freeze({ height: 4, side: 2.6, leg: 0.22, deck: 0.18, rail: 1.0, fill: '#5d4a33', deckFill: '#6d5a40', dark: '#463626', roofFill: '#4c5546',
    // (its stair: a straight flight out from one side to the ground, risers the walker steps up, a handrail; its roof a
    // pyramid over the deck, the eave and the apex over the deck, the eave standing past it)
    stair: Object.freeze({ rise: 0.25, going: 0.28, width: 0.95 }), roof: Object.freeze({ eave: 2.2, apex: 2.85, over: 0.35 }) }),
});
// (the deck's frame's underside: over a guard's head (1.8) with the 0.4 the page sinks every box into the ground under it)
const FRAME_LOW = 2.4;
const SIDES = Object.freeze({ '+x': [1, 0], '-x': [-1, 0], '+y': [0, 1], '-y': [0, -1] });
/** A tower's stair (`stair`: the side its flight runs out from, '+x' unless said): its treads, each a step up from the
 *  ground to the deck: { n, dir, lat, edge, treads: [{ lo, hi, z }] } (lo/hi the tread's span out from the deck's edge). */
export function towerStair(t) {
  const T = STRUCTURE.tower, S = T.stair, H = t.height ?? T.height, dir = SIDES[t.stair ?? '+x'];
  if (!dir) throw new Error(`level 0: structure ${t.id}: stair is one of ${Object.keys(SIDES).join(', ')}`);
  const n = Math.round(H / S.rise), r = H / n, treads = [];
  // (tread i, from the bottom, stands i risers up and n - i goings out from the deck's edge; the last riser is the deck)
  for (let i = 1; i < n; i++) treads.push({ lo: (n - i - 1) * S.going, hi: (n - i) * S.going, z: i * r });
  return { n, r, dir, lat: [-dir[1], dir[0]], edge: T.side / 2, run: (n - 1) * S.going, treads };
}
/** A structure's boxes: { min, max, fill, sight?, walk? } (a box the search and the page both read). */
export function structureBoxes(t) {
  const out = [];
  if (t.kind === 'sandbags' || t.kind === 'wire') {
    const S = STRUCTURE[t.kind], [a, b] = [t.from, t.to], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 1.2));
    // (a run laid as short boxes along its line, so a slanted run is still axis-aligned boxes)
    for (let k = 0; k < n; k++) {
      const u0 = k / n, u1 = (k + 1) / n, x0 = a[0] + (b[0] - a[0]) * u0, y0 = a[1] + (b[1] - a[1]) * u0, x1 = a[0] + (b[0] - a[0]) * u1, y1 = a[1] + (b[1] - a[1]) * u1, r = S.d / 2;
      out.push({ min: [Math.min(x0, x1) - r, Math.min(y0, y1) - r, 0], max: [Math.max(x0, x1) + r, Math.max(y0, y1) + r, S.h], fill: k % 2 ? S.fill : (S.top ?? S.fill), ...(t.kind === 'wire' ? { sight: false } : {}) });
    }
  } else if (t.kind === 'tower') {
    const T = STRUCTURE.tower, H = t.height ?? T.height, h = T.side / 2, [x, y] = t.at;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.push({ min: [x + sx * h - (sx > 0 ? T.leg : 0), y + sy * h - (sy > 0 ? T.leg : 0), 0], max: [x + sx * h + (sx < 0 ? T.leg : 0), y + sy * h + (sy < 0 ? T.leg : 0), H], fill: T.fill, sight: false });
    out.push({ min: [x - h, y - h, H - T.deck], max: [x + h, y + h, H], fill: T.deckFill, sight: false, walk: false, deck: true });
    // (its deck's frame, the joists under the boards, a box over a standing head (FRAME_LOW: a guard walks under it, the
    // search's band never meets it) up to the boards: the stair's treads end against it, so the flight and the deck are
    // ONE thing to a runner, and the free-run (worlds/controllable/free-run.js) never takes the last few treads for a low
    // box to vault, out over the top and down under the deck; a body on the top treads stands within a step of its top)
    out.push({ min: [x - h, y - h, FRAME_LOW], max: [x + h, y + h, H - T.deck - 0.02], sight: false, frame: true });
    // (its rail, open a stair's width where the flight arrives)
    const ST = towerStair(t), gap = T.stair.width / 2 + 0.05;
    for (const [sx, sy] of Object.values(SIDES)) {
      const along = sx ? 1 : 0, c = [x + sx * (h - 0.04), y + sy * (h - 0.04)], open = sx === ST.dir[0] && sy === ST.dir[1];
      const seg = (a0, a1) => { const p0 = along ? [c[0] - 0.04, y + a0] : [x + a0, c[1] - 0.04], p1 = along ? [c[0] + 0.04, y + a1] : [x + a1, c[1] + 0.04]; out.push({ min: [p0[0], p0[1], H], max: [p1[0], p1[1], H + T.rail], fill: T.fill, sight: false, walk: false, rail: true }); };
      if (open) { seg(-h, -gap); seg(gap, h); } else seg(-h, h);
    }
    // (its stair's treads, each a block from the ground to ONE RISER UNDER its top, the tread before it's height: a tread is
    // shallower than a body is wide, so a body on one reaches two ahead, and a block at its own tread's height would stand
    // two risers over its feet, past its step; one riser under, it never blocks the climb, while from the ground beside
    // the flight every block past the second stands over a step and keeps a body from walking in under it. The walk
    // stands on the drawn treads; seen through, a flight of open treads)
    for (const q of ST.treads) {
      if (q.z - ST.r <= 1e-6) continue;
      const o0 = ST.edge + q.lo, o1 = ST.edge + q.hi, w = T.stair.width / 2;
      const A = [x + ST.dir[0] * o0 + ST.lat[0] * w, y + ST.dir[1] * o0 + ST.lat[1] * w], B = [x + ST.dir[0] * o1 - ST.lat[0] * w, y + ST.dir[1] * o1 - ST.lat[1] * w];
      out.push({ min: [Math.min(A[0], B[0]), Math.min(A[1], B[1]), 0], max: [Math.max(A[0], B[0]), Math.max(A[1], B[1]), +(q.z - ST.r).toFixed(4)], fill: T.deckFill, sight: false, tread: true });
    }
  }
  return out;
}

// a beam from A to B, `w` square, as a box's six faces turned along it (the page's painted faces: corners, a normal each)
function beamFaces(A, B, w, fill, group) {
  const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], L = Math.hypot(...d) || 1e-9, a = d.map((v) => v / L);
  const cr = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], nz = (v) => { const m = Math.hypot(...v) || 1; return v.map((x) => x / m); };
  const side = Math.abs(a[2]) > 0.95 ? [1, 0, 0] : nz(cr(a, [0, 0, 1])), up = nz(cr(side, a)), r = w / 2;
  const P = (E, s, u) => E.map((v, k) => +(v + side[k] * s * r + up[k] * u * r).toFixed(4));
  const c = (E) => [P(E, -1, -1), P(E, 1, -1), P(E, 1, 1), P(E, -1, 1)], ca = c(A), cb = c(B);
  const q = (cs, n) => ({ corners: cs, fill, cornerFills: cs.map(() => fill), normal: n.map((v) => +v.toFixed(4)), outNormal: n.map((v) => +v.toFixed(4)), group });
  return [q([ca[0], ca[1], cb[1], cb[0]], up.map((v) => -v)), q([ca[1], ca[2], cb[2], cb[1]], side), q([ca[2], ca[3], cb[3], cb[2]], up), q([ca[3], ca[0], cb[0], cb[3]], side.map((v) => -v)),
    q([ca[3], ca[2], ca[1], ca[0]], a.map((v) => -v)), q([cb[0], cb[1], cb[2], cb[3]], a)];
}
/** A tower's LOOK (its boxes are what the search, the colliders and the walk read): four posts up to the eave, an X of
 *  bracing on each side but the stair's, a deck of planks on joists, its rail on posts, open where the stair arrives, a
 *  flight of open treads on two stringers with a handrail, and a pyramid roof over the deck. Faces at the tower's own
 *  ground (z from 0), each { corners, fill, cornerFills, normal, outNormal, group }. */
export function towerFaces(t, group = 'cover:tower') {
  const T = STRUCTURE.tower, H = t.height ?? T.height, h = T.side / 2, [x, y] = t.at, ST = towerStair(t), R = T.roof, out = [];
  const beam = (A, B, w, fill = T.fill) => out.push(...beamFaces(A, B, w, fill, group));
  const at = (sx, sy, z) => [x + sx * h, y + sy * h, z];
  const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  // posts, from a footing under the ground to the eave
  for (const [sx, sy] of corners) beam(at(sx, sy, -0.3), at(sx, sy, H + R.eave), 0.2);
  // bracing: an X between each pair of posts, but on the stair's side; and a girt round under the deck
  for (let k = 0; k < 4; k++) {
    const [a0, b0] = corners[k], [a1, b1] = corners[(k + 1) % 4], mid = [(a0 + a1) / 2, (b0 + b1) / 2];
    beam(at(a0, b0, H - 0.45), at(a1, b1, H - 0.45), 0.12, T.dark);
    if (mid[0] === ST.dir[0] && mid[1] === ST.dir[1]) continue;
    beam(at(a0, b0, 0.35), at(a1, b1, H - 0.55), 0.1, T.dark); beam(at(a1, b1, 0.35), at(a0, b0, H - 0.55), 0.1, T.dark);
  }
  // the deck: planks across joists, edge to edge, a hand's gap between them
  // (flat boards, their tops at the deck's height, where the walk and the guards stand; the deck's own underside dark)
  const nP = 9, pw = (2 * h + 0.2) / nP, quad = (cs, n, fill) => out.push({ corners: cs.map((p) => p.map((v) => +v.toFixed(4))), fill, cornerFills: cs.map(() => fill), normal: n, outNormal: n, group });
  for (let i = 0; i < nP; i++) { const u0 = -h - 0.1 + pw * i + 0.012, u1 = u0 + pw - 0.024; quad([[x + u0, y - h - 0.1, H], [x + u1, y - h - 0.1, H], [x + u1, y + h + 0.1, H], [x + u0, y + h + 0.1, H]], [0, 0, 1], T.deckFill); }
  quad([[x - h - 0.1, y - h - 0.1, H - 0.05], [x - h - 0.1, y + h + 0.1, H - 0.05], [x + h + 0.1, y + h + 0.1, H - 0.05], [x + h + 0.1, y - h - 0.1, H - 0.05]], [0, 0, -1], T.dark);
  for (const v of [-0.8, 0, 0.8]) beam([x - h, y + v * h, H - 0.2], [x + h, y + v * h, H - 0.2], 0.12, T.dark);
  // the rail: a top rail and a mid rail on posts, open where the stair arrives
  const gap = T.stair.width / 2 + 0.05;
  for (let k = 0; k < 4; k++) {
    const [a0, b0] = corners[k], [a1, b1] = corners[(k + 1) % 4], mid = [(a0 + a1) / 2, (b0 + b1) / 2], open = mid[0] === ST.dir[0] && mid[1] === ST.dir[1];
    const pt = (u, z) => { const sx = a0 + (a1 - a0) * u, sy = b0 + (b1 - b0) * u; return at(sx, sy, z); };
    const gu = gap / (2 * h), runs = open ? [[0, 0.5 - gu], [0.5 + gu, 1]] : [[0, 1]];
    for (const [u0, u1] of runs) for (const z of [H + T.rail, H + T.rail * 0.5]) beam(pt(u0, z), pt(u1, z), 0.07);
    if (open) for (const u of [0.5 - gu, 0.5 + gu]) beam(pt(u, H), pt(u, H + T.rail), 0.09);
    else beam(pt(0.5, H), pt(0.5, H + T.rail), 0.08);
  }
  // the stair: two stringers from the ground to the deck's edge, its treads between them, a handrail on each side
  const w = T.stair.width / 2, off = (o, l, z) => [x + ST.dir[0] * o + ST.lat[0] * l, y + ST.dir[1] * o + ST.lat[1] * l, z];
  for (const l of [-w, w]) {
    beam(off(ST.edge + ST.run + ST.r * 0.6, l, -0.05), off(ST.edge, l, H - 0.1), 0.09, T.dark);
    beam(off(ST.edge + ST.run + 0.1, l, 1.0), off(ST.edge, l, H + T.rail), 0.06);
    beam(off(ST.edge + ST.run + 0.1, l, 0), off(ST.edge + ST.run + 0.1, l, 1.05), 0.08);
  }
  // (each tread a board the going deep, its nosing a strip along its front edge)
  for (const q of ST.treads) beam(off(ST.edge + q.lo + 0.03, -w, q.z - 0.03), off(ST.edge + q.lo + 0.03, w, q.z - 0.03), 0.06, T.dark);
  for (const q of ST.treads) { const o0 = ST.edge + q.lo + 0.01, o1 = ST.edge + q.hi - 0.01, z = q.z;
    const cs = [off(o0, -w, z), off(o1, -w, z), off(o1, w, z), off(o0, w, z)].map((p) => p.map((v) => +v.toFixed(4)));
    out.push({ corners: cs, fill: T.deckFill, cornerFills: cs.map(() => T.deckFill), normal: [0, 0, 1], outNormal: [0, 0, 1], group }); }
  // the roof: a pyramid over the deck, its eave past it, and its underside
  const o = h + R.over, apex = [x, y, H + R.apex], eave = (sx, sy) => [x + sx * o, y + sy * o, H + R.eave];
  for (let k = 0; k < 4; k++) {
    const [a0, b0] = corners[k], [a1, b1] = corners[(k + 1) % 4], cs = [eave(a0, b0), eave(a1, b1), apex, apex];
    const e = [cs[1][0] - cs[0][0], cs[1][1] - cs[0][1], 0], f = [apex[0] - cs[0][0], apex[1] - cs[0][1], apex[2] - cs[0][2]];
    let n = [e[1] * f[2] - e[2] * f[1], e[2] * f[0] - e[0] * f[2], e[0] * f[1] - e[1] * f[0]]; const m = Math.hypot(...n); n = n.map((v) => v / m);
    if (n[2] < 0) n = n.map((v) => -v);
    out.push({ corners: cs, fill: T.roofFill, cornerFills: cs.map(() => T.roofFill), normal: n.map((v) => +v.toFixed(4)), outNormal: n.map((v) => +v.toFixed(4)), group });
  }
  const under = [eave(1, 1), eave(1, -1), eave(-1, -1), eave(-1, 1)];
  out.push({ corners: under, fill: T.dark, cornerFills: under.map(() => T.dark), normal: [0, 0, -1], outNormal: [0, 0, -1], group });
  return out;
}

export const GUARD = Object.freeze({ cone: 0.6, range: 14, speed: 1.6, eye: 1.35, hear: 7 });
const rad = (d) => (d * Math.PI) / 180;

/** The recipe's cover as the manifest takes it: what is parked (the registry's vehicles), and what is laid (boxes). */
export function coverOf(L) {
  const parked = L.cover.filter((c) => c.vehicle).map((c) => ({ vehicle: c.vehicle, at: [c.at[0], c.at[1], 0], heading: rad(c.heading ?? 0) }));
  const laid = L.cover.filter((c) => c.box).map((c) => ({ id: c.id, size: c.box, at: c.at }));
  return { parked, laid };
}

export function coverBoxes(L, colliders = []) {
  const { parked, laid } = coverOf(L), out = [];
  // (a parked vehicle's box, the registry's own, on flat ground)
  const P = parked.length ? withParked({ parked }).colliders : [];
  P.forEach((c, i) => out.push({ id: L.cover.filter((x) => x.vehicle)[i].id, min: [c.min[0], c.min[1], 0], max: [c.max[0], c.max[1], c.max[2] - c.min[2]] }));
  for (const t of L.structures ?? []) for (const b of structureBoxes(t)) out.push({ id: t.id, ...b });
  for (const b of laid) out.push({ id: b.id, min: [b.at[0] - b.size[0] / 2, b.at[1] - b.size[1] / 2, 0], max: [b.at[0] + b.size[0] / 2, b.at[1] + b.size[1] / 2, b.size[2]] });
  // (what the land grew: a shrub's box, its height its own over its foot)
  for (const c of colliders) if (/^shrub/.test(c.of ?? '')) out.push({ id: c.of, min: [c.min[0], c.min[1], 0], max: [c.max[0], c.max[1], c.max[2] - c.min[2]] });
  return out;
}

export function watchersOf(L) {
  // (a watcher posted on a tower sees from its deck)
  const up = (w) => { const T = w.on && (L.structures ?? []).find((t) => t.id === w.on); return T ? (T.height ?? STRUCTURE.tower.height) : 0; };
  return L.watchers.map((w) => ({ id: w.id, at: w.at, elevation: up(w), ...(w.near ? { near: w.near } : {}), ...(w.kind === 'patrol' ? { to: w.to, speed: w.speed ?? GUARD.speed, ...(w.look ? { look: w.look } : {}) } : { heading: Math.atan2(w.facing[1] - w.at[1], w.facing[0] - w.at[0]) }),
    cone: w.cone ?? GUARD.cone, range: w.range ?? GUARD.range, eye: GUARD.eye + up(w), hear: w.hear ?? GUARD.hear }));
}

/** The level's tall grass as the geocube reads it (`tallGrass`, form/tall-grass.js) and as the search's veils. */
export function tallGrassOf(L) { return L.grass && L.grass.length ? { patches: L.grass.map((g) => ({ at: g.at, r: g.r, ...(g.h ? { h: g.h } : {}) })), ...(L.grassElsewhere ? { elsewhere: L.grassElsewhere } : {}) } : null; }
export function grassVeils(L) { const T = readTallGrass(tallGrassOf(L)); return T ? T.patches : []; }

export function planLevel(L, colliders = [], field = [-8, 0, 30, 75.5]) {
  const boxes = coverBoxes(L, colliders), watchers = watchersOf(L);
  const points = L.points.map((P) => ({ id: P.id, reads: P.reads,
    // (a lane's bounds its own band of the field; `needs: 'takedown'` a place only a takedown of one of `takedown` opens)
    routes: sneakRoutes({ bounds: [P.lane ? Math.max(field[0], P.lane[0]) : field[0], P.window[0], P.lane ? Math.min(field[2], P.lane[1]) : field[2], P.window[1]], boxes, veils: grassVeils(L), watchers, start: P.from, goal: P.to, goalRadius: 2, seconds: P.seconds ?? 240,
      ...(P.takedown ? { takedown: { by: P.takedown } } : {}), ...(P.needs ? { needs: P.needs } : {}) }) }));
  return { boxes, watchers, points, laws: points.flatMap((P) => P.routes.verdicts.map((v) => ({ ...v, law: `${P.id}: ${v.law}` }))) };
}

export function planSvg(L, plan, field = [-8, 0, 30, 75.5], trail = [], relief = null) {
  const S = 12, [X0, Y0, X1, Y1] = field, W = (X1 - X0) * S, H = (Y1 - Y0) * S, px = (x) => (x - X0) * S, py = (y) => (Y1 - y) * S;
  const line = (pts, style) => `<polyline fill="none" ${style} points="${pts.map((p) => `${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ')}"/>`;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W + 260}" height="${H}" viewBox="0 0 ${W + 260} ${H}" font-family="ui-monospace,monospace" font-size="11">`, `<rect width="${W + 260}" height="${H}" fill="#101418"/>`, `<rect width="${W}" height="${H}" fill="#1c2a1e"/>`];
  // (the land's relief, a metre a cell: lit from the north-west, a bank's face dark, its steepness the more so; the search
  // reads the ground as flat, so a way that climbs one is the eye's to judge)
  if (relief) {
    const [W0, H0] = relief.size, Z = (i, j) => relief.z[Math.min(H0 - 1, Math.max(0, j)) * W0 + Math.min(W0 - 1, Math.max(0, i))];
    for (let j = 0; j < H0; j++) for (let i = 0; i < W0; i++) {
      const z = Z(i, j); if (z == null) continue;
      const gx = ((Z(i + 1, j) ?? z) - (Z(i - 1, j) ?? z)) / 2, gy = ((Z(i, j + 1) ?? z) - (Z(i, j - 1) ?? z)) / 2, steep = Math.hypot(gx, gy), lit = Math.max(-1, Math.min(1, (-gx + gy) * 0.9));
      if (steep < 0.12) continue;
      out.push(`<rect x="${px(relief.origin[0] + i)}" y="${py(relief.origin[1] + j + 1)}" width="${S}" height="${S}" fill="${lit > 0 ? '#d8d2b8' : '#000'}" opacity="${Math.min(0.55, 0.12 + steep * 0.35).toFixed(2)}"/>`);
    }
  }
  if (trail.length) out.push(line(trail, 'stroke="#6b5a40" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" opacity=".55"'));
  for (const g of grassVeils(L)) out.push(`<circle cx="${px(g.at[0]).toFixed(1)}" cy="${py(g.at[1]).toFixed(1)}" r="${(g.r * S).toFixed(1)}" fill="#7fae4a" opacity=".45" stroke="#a6d46a" stroke-width="1"/>`);
  for (const b of plan.boxes) { if (b.fill) { if (b.walk === false && !b.deck) continue; out.push(`<rect x="${px(b.min[0])}" y="${py(b.max[1])}" width="${(b.max[0] - b.min[0]) * S}" height="${(b.max[1] - b.min[1]) * S}" fill="${b.fill}" opacity="${b.deck ? 0.55 : 1}" stroke="${b.sight === false && !b.deck ? '#aab' : '#0b0e10'}" stroke-dasharray="${b.sight === false && !b.deck ? '3 2' : ''}"/>`); continue; } const sh = /^shrub/.test(b.id); out.push(`<rect x="${px(b.min[0])}" y="${py(b.max[1])}" width="${(b.max[0] - b.min[0]) * S}" height="${(b.max[1] - b.min[1]) * S}" fill="${sh ? '#3f6b3a' : b.max[2] < 0.7 ? '#7a5c3a' : b.max[2] < 1.2 ? '#8a8060' : '#59636b'}" stroke="#0b0e10"/>`); }
  for (const w of plan.watchers) {
    if (w.to) out.push(line([w.at, w.to], 'stroke="#ff7a59" stroke-width="1.5" stroke-dasharray="5 4"'));
    for (const t of w.to ? [0, (Math.hypot(w.to[0] - w.at[0], w.to[1] - w.at[1]) / w.speed) * 1.5] : [0]) {
      const g = watcherAt(w, t), a0 = g.heading - w.cone, a1 = g.heading + w.cone, r = w.range;
      const p = (a) => `${px(g.pos[0] + Math.cos(a) * r).toFixed(1)},${py(g.pos[1] + Math.sin(a) * r).toFixed(1)}`;
      out.push(`<path d="M${px(g.pos[0]).toFixed(1)},${py(g.pos[1]).toFixed(1)} L${p(a0)} A${r * S},${r * S} 0 0 0 ${p(a1)} Z" fill="#ff5a4a" opacity=".13"/>`, `<circle cx="${px(g.pos[0])}" cy="${py(g.pos[1])}" r="5" fill="#ff5a4a"/>`);
    }
    out.push(`<text x="${px(w.at[0]) + 8}" y="${py(w.at[1]) - 6}" fill="#ffb4a8">${w.id}</text>`);
  }
  let row = 0; const key = (c, text) => { out.push(`<rect x="${W + 14}" y="${18 + row * 18}" width="18" height="4" fill="${c}"/>`, `<text x="${W + 40}" y="${24 + row * 18}" fill="#cfd6da">${text}</text>`); row++; };
  for (const P of plan.points) {
    const R = P.routes;
    if (R.direct) { out.push(line(R.direct.path, 'stroke="#ff5a4a" stroke-width="2.5" opacity=".9"')); if (R.direct.seen) out.push(`<circle cx="${px(R.direct.seen.at[0])}" cy="${py(R.direct.seen.at[1])}" r="7" fill="none" stroke="#ff5a4a" stroke-width="2"/>`); }
    for (const [way, c] of [[R.sneak, '#5fe08a'], [R.other, '#5fb8ff']]) if (way) {
      // (thin while it runs, thick while it crouches, dotted while it crawls)
      let seg = [way.path[0]];
      const flush = () => { if (seg.length > 1) out.push(line(seg.map((p) => p.at), `stroke="${c}" stroke-width="${seg[1].stance === 'stand' ? 1.6 : 3.2}" ${seg[1].stance === 'prone' ? 'stroke-dasharray="2 5"' : ''}`)); };
      for (let k = 1; k < way.path.length; k++) { if (way.path[k].stance !== seg[seg.length - 1].stance && seg.length > 1) { flush(); seg = [way.path[k - 1]]; } seg.push(way.path[k]); }
      flush();
    }
    out.push(`<text x="${px(L.points.find((p) => p.id === P.id).from[0]) + 10}" y="${py(L.points.find((p) => p.id === P.id).from[1]) + 4}" fill="#e8ecef" font-size="13">${P.id}</text>`);
  }
  key('#ff5a4a', 'the first try: seen at the ring'); key('#5fe08a', 'the way unseen'); key('#5fb8ff', 'a second way'); row++;
  for (const t of ['thin: a run', 'thick: a crouch', 'dotted: a crawl', '', 'grey: parked (tall)', 'khaki: sandbags (1 m)', 'dashed: wire, seen through', 'square: a tower', 'tan: crates (1 m)', 'brown: logs (0.55 m)', 'green: shrubs', 'pale green: tall grass', '  (hides a crouch, a crawl)', 'light / dark cells: a slope', '  (a bank: the search reads', '  the ground as flat)', 'red fans: what a watcher', '  sees (two moments)']) { out.push(`<text x="${W + 14}" y="${24 + row * 18}" fill="#9aa4aa">${t}</text>`); row++; }
  out.push('</svg>');
  return out.join('\n');
}
