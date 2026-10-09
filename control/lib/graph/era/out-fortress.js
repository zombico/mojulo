/**
 * THE FORTIFICATION — its elements, and the dial that closes a town with them. Two structures are built of them: the
 * FORTIFIED TOWN, here (a town drawn tighter, the lord's land in its inmost ward; in a game it is bigger on the
 * inside, so what is designed is what is read from outside and from the walls), and the CASTLE (era/out-castle.js:
 * the town's walls taken off and the lord's land compressed into one structure, the town outside it). Fortifying a
 * town is one DIAL, `fortified` 0…1 on the town recipe: 0 is the open town, a little closes a curtain round it, more
 * digs a ditch and bends the approach under the wall, more again turns its terraces into WARDS (each terrace's wall a
 * curtain the walk climbs through a gate), until one gate leads to the keep through every ward in turn.
 *
 * The fortification is designed like the town: ELEMENTS first (the curtain and how it stands, the parapet, the walk,
 * the tower's plan and crown, the gate, the ditch), each with its rails; the BAY (a length of curtain with its walk
 * and parapet) is the fortification's citizen, every stretch of wall a bay; the TOWER is derived from the bay by
 * contrast, as the town's secondary is from its anchor (it rises over the walk, stands out of the wall's face to flank
 * it, turns its plan, crowns itself); the GATEHOUSE composes towers over a passage; the KEEP is the town's landmark
 * spoken higher than everything. Heights are game-scaled: a rampart of 5–9 m, about two thirds of a historical one,
 * so a ward still reads as a town from its wall-walk.
 *
 *   FORT_KINDS / FORT_SETS     the elements and the authored compositions (crenellated, battered); seedFort(seed)
 *   composeFort(F)             the elements checked against their rails, the tower derived, the gate composed
 *   TOWER_RULES                the contrast rules the tower is derived by
 *   FORTIFY / fortDial(f)      what each reach of the dial closes
 *   build                      bay, tower, gatehouse, keep: faces by depth, in values on surface groups
 *   octagon(…)                 the curtain's trace
 *
 * Pure; seeded dice only; values only.
 */
import { geometry as G } from './out-structures.js';
import { build as EB } from './out-anchor-elements.js';

const { face, dice, subSeed, r3 } = G;

// ── the elements ────────────────────────────────────────────────────────────────────────────────────────────────────
const WORDS = { base: ['straight', 'battered'], parapet: ['crenel', 'loophole', 'solid'], plan: ['round', 'square'], crown: ['crenel', 'cone', 'dome', 'hip', 'tiers'], gate: ['twin', 'box'] };
/** A rampart, game-scaled: the curtain's height above its ground grows along this rail as the dial turns. */
export const RAMPART = Object.freeze([5, 9]);
export const FORT_KINDS = Object.freeze({
  curtain: { depth: 0, read: 'the wall round a ward: how it stands (straight, or battered back on a sloped stone base), how thick, of what', params: { base: { rail: WORDS.base }, batter: { rail: [0, 0.35] }, t: { rail: [1.6, 3.6] } } },
  parapet: { depth: 1, read: 'what shields the walk: crenels (merlons and gaps), a loopholed wall under its coping, or a solid breastwork', params: { form: { rail: WORDS.parapet }, h: { rail: [1.2, 2.2] }, merlon: { rail: [0.6, 1.4] }, crenel: { rail: [0.4, 0.9] } } },
  walk: { depth: 1, read: 'the wall-walk on the curtain\'s top, behind the parapet', params: { w: { rail: [1, 2.6] } } },
  tower: { depth: 0, read: 'what flanks the curtain: its plan and its crown (the rest is derived from the bay)', params: { plan: { rail: WORDS.plan }, crown: { rail: WORDS.crown } } },
  gate: { depth: 0, read: 'how a curtain is passed: a passage between twin towers, or a box gate-tower over it', params: { form: { rail: WORDS.gate }, clear: { rail: [3.6, 5] } } },
  ditch: { depth: 0, read: 'what keeps the foot of the wall: a dug ditch before the curtain, crossed by a bridge at the gate', params: { w: { rail: [4, 14] }, depth: { rail: [1.5, 4] } } },
});
export const FORT_KIND_IDS = Object.freeze(Object.keys(FORT_KINDS));

/** The authored compositions: two to strive for, neither a preset (the same code speaks a seeded one). */
export const FORT_SETS = Object.freeze({
  crenellated: {
    read: 'a straight curtain of coursed stone, crenellated over its walk, round drum towers under slate cones standing out of its face, a gatehouse of twin towers over the passage, a ditch before it',
    curtain: { base: 'straight', batter: 0, t: 2.4, group: 'str:stone', value: 0.6, bond: 'coursed' },
    parapet: { form: 'crenel', h: 1.6, merlon: 1.1, crenel: 0.7, group: 'str:stone', value: 0.68 },
    walk: { w: 1.6 },
    tower: { plan: 'round', crown: 'cone', cover: 'str:slate', value: 0.38 },
    gate: { form: 'twin', clear: 4.2 },
    ditch: { w: 7, depth: 2.5 },
  },
  battered: {
    read: 'a battered base of fitted stone sweeping up to a plastered wall pierced with loopholes under a tile coping, square towers of two tiers under hipped roofs, a box gate-tower over the passage, a broad ditch before it',
    curtain: { base: 'battered', batter: 0.3, t: 3, group: 'str:stone', value: 0.55, bond: 'rubble' },
    parapet: { form: 'loophole', h: 1.9, group: 'str:plaster', value: 0.92, cope: 'str:tile', copeValue: 0.28 },
    walk: { w: 2 },
    tower: { plan: 'square', crown: 'tiers', cover: 'str:tile', value: 0.28, upper: 'str:plaster', upperValue: 0.92 },
    gate: { form: 'box', clear: 4.4 },
    ditch: { w: 10, depth: 3 },
  },
});
export const FORT_SET_IDS = Object.freeze(Object.keys(FORT_SETS));

/** A fortification drawn from the kinds' rails, each choice constraining the next (a battered base takes a walled parapet). */
export function seedFort(seed = 1) {
  const D = dice(subSeed(seed, 'fort')), pick = (a) => a[Math.floor(D.R() * a.length)], roll = (r) => D.roll(r);
  const base = pick(WORDS.base), parapet = base === 'battered' ? pick(['loophole', 'solid']) : pick(['crenel', 'crenel', 'solid']), plan = pick(WORDS.plan);
  const crown = plan === 'round' ? pick(['crenel', 'cone']) : pick(['crenel', 'hip', 'tiers']), t = roll([2, 3.2]), plaster = parapet === 'loophole' || (parapet === 'solid' && D.R() < 0.5);
  return {
    read: `a seeded fortification (${seed}): a ${base} curtain, ${parapet} parapet, ${plan} towers under ${crown}`, seeded: seed,
    curtain: { base, batter: base === 'battered' ? roll([0.18, 0.34]) : 0, t, group: 'str:stone', value: roll([0.5, 0.66]), bond: pick(['coursed', 'rubble', 'ashlar']) },
    parapet: { form: parapet, h: roll(parapet === 'loophole' ? [1.6, 2.1] : [1.3, 1.8]), merlon: roll([0.8, 1.3]), crenel: roll([0.5, 0.8]), group: plaster ? 'str:plaster' : 'str:stone', value: plaster ? 0.9 : 0.68, ...(plaster ? { cope: 'str:tile', copeValue: 0.3 } : {}) },
    walk: { w: r3(Math.min(t - 0.5, roll([1.4, 2.1]))) },
    tower: { plan, crown, cover: pick(['str:slate', 'str:tile', 'str:shingle']), value: roll([0.28, 0.42]), ...(crown === 'tiers' ? { upper: 'str:plaster', upperValue: 0.9 } : {}) },
    gate: { form: plan === 'round' ? 'twin' : pick(WORDS.gate), clear: roll([4, 4.6]) },
    ditch: { w: roll([5, 11]), depth: roll([2, 3.5]) },
  };
}

const inRail = (v, rail) => (typeof rail[0] === 'string' ? rail.includes(v) : typeof v === 'number' && v >= rail[0] - 1e-9 && v <= rail[1] + 1e-9);
/**
 * THE TOWER, derived from the bay by contrast: it shares the curtain's stone and base, RISES a storey and a half over
 * the walk, STANDS OUT of the wall's face by 0.6 of its width (so it sees along the face it flanks), TURNS to its own
 * plan, and CROWNS itself (crenels, a cone, a hipped roof, or a second tier under one).
 */
export const TOWER_RULES = Object.freeze([
  { id: 'shares', rule: 'the curtain\'s stone, value and base: it is the same wall, turned upright' },
  { id: 'rises', rule: 'a storey and a half (at least 3 m) over the walk, and over whatever stands near it inside' },
  { id: 'stands-out', rule: 'out of the curtain\'s face by 0.6 of its width: from it the face it flanks is seen end to end' },
  { id: 'turns', rule: 'its own plan: a drum (round) or a square, 2.6 times the curtain\'s thickness across (5–9 m)' },
  { id: 'crowns', rule: 'its crown: the bay\'s crenels carried round, a cone, a dome or a hipped roof over a ring of eaves, or a second tier under one' },
]);
/** A fortification's elements against their rails, the tower derived from the bay, the gate composed. */
export function composeFort(F) {
  const A = typeof F === 'string' ? FORT_SETS[F] : F?.seed !== undefined && !F.curtain ? seedFort(F.seed) : F;
  if (!A?.curtain) throw new Error(`fort: give a fortification as ${FORT_SET_IDS.join(' | ')}, { seed }, or its elements { curtain, parapet, walk, tower, gate, ditch }`);
  for (const k of FORT_KIND_IDS) {
    if (!A[k]) throw new Error(`fort: the ${k} is missing (${FORT_KINDS[k].read})`);
    for (const [p, spec] of Object.entries(FORT_KINDS[k].params)) if (A[k][p] !== undefined && !inRail(A[k][p], spec.rail)) throw new Error(`fort: ${k}.${p} is ${typeof spec.rail[0] === 'string' ? spec.rail.join(' | ') : `${spec.rail[0]}–${spec.rail[1]}`} (got ${JSON.stringify(A[k][p])})`);
  }
  if (A.walk.w > A.curtain.t - 0.4 + 1e-9) throw new Error(`fort: the walk (${A.walk.w} m) does not fit on a ${A.curtain.t} m curtain behind its parapet (at most ${r3(A.curtain.t - 0.4)} m)`);
  if (A.tower.plan === 'round' && ['hip', 'tiers'].includes(A.tower.crown)) throw new Error('fort: a drum is crowned by crenels, a cone or a dome, not a hipped roof');
  if (A.tower.plan === 'square' && A.tower.crown === 'dome') throw new Error('fort: a dome crowns a drum, not a square');
  const w = r3(Math.max(5, Math.min(9, A.curtain.t * 2.6)));
  return { ...A, towerDims: { w, proud: r3(0.6 * w), over: 3 }, read: A.read };
}

// ── the dial ────────────────────────────────────────────────────────────────────────────────────────────────────────
/** What each reach of the dial closes, in order. */
export const FORTIFY = Object.freeze([
  { at: 0, id: 'open', read: 'the open town: lots keep their own lines, nothing keeps the town' },
  { at: 0.01, id: 'walled', read: 'a curtain round the town, a gate where each route crosses it, towers at its corners, where it steps a terrace, and at a rhythm that tightens as the dial turns' },
  { at: 0.4, id: 'ditched', read: 'a ditch before the curtain, a bridge at each gate, and the approach run under the west wall before it turns into the gate' },
  { at: 0.6, id: 'warded', read: 'each terrace\'s wall a curtain: a ward, entered by one gate where the branch climbs, the branch dog-legging inside so no two gates line up' },
  { at: 0.75, id: 'one-gate', read: 'one gate: the lane ends inside the east wall' },
  { at: 0.85, id: 'lords-land', read: 'the lord\'s land: two wards over the bailey, the keep in the inmost, the lane drawn in' },
]);
const lerp = (a, b, t) => a + (b - a) * t;
/** The dial read: what closes at `f`, how high the rampart stands, how close the towers. */
export function fortDial(f) {
  return { f, walled: f > 0, H: r3(lerp(RAMPART[0], RAMPART[1], f)), spacing: r3(lerp(46, 26, f)), ditch: f >= 0.4, approach: f >= 0.4, wards: f >= 0.6, oneGate: f >= 0.75, levels: f >= 0.85 ? 2 : f >= 0.6 ? 1 : 0, squeeze: r3(1 - 0.3 * f), steps: FORTIFY.filter((s) => f >= s.at).map((s) => s.id) };
}

/** An octagon [x0, x1] × [y0, y1] with its corners cut by `c`, counter-clockwise (inside on the left of each edge). */
export function octagon(x0, y0, x1, y1, c) {
  return [[x0 + c, y0], [x1 - c, y0], [x1, y0 + c], [x1, y1 - c], [x1 - c, y1], [x0 + c, y1], [x0, y1 - c], [x0, y0 + c]].map((p) => p.map(r3));
}

// ── the builders: in their own frame, x along, y across (−y outside, toward the field), z up from the foot ─────────
const mark = (out, pts, n, value, group) => face(out, pts, n, 'opening', value, { group, tile: true });
/** A wall face's point at height z, on the outside: a battered base leans back as it rises. */
const outsideY = (C, w0, Hb, z) => -(w0 / 2) + Math.min(1, z / (Hb || 1)) * ((w0 - C.t) / 2);
/**
 * THE BAY: a length of curtain `len` long, `H` over its foot (plus `retain` held back behind it: a ward's wall holds a
 * terrace), with its walk and its parapet, by depth: 0 the wall to the parapet's top as one mass; 1 the walk and the
 * parapet (merlons and gaps, or a loopholed wall under its coping); 2 the laying (courses, or a battered base's fitted
 * stones) and the loopholes, in the tile; 3 the walk's paving. `gates` are openings [{ u, w }] (the gatehouse fills them).
 */
function bay(out, len, F, H, { depth = 3, gates = [], retain = 0, seed = 1 } = {}) {
  const C = F.curtain, P = F.parapet, R = G.mulberry32(seed), top = retain + H, ph = P.h, bat = C.base === 'battered' ? C.batter : 0;
  const w0 = r3(C.t + 2 * bat * Math.min(top, 6)), Hb = Math.min(top, 6), spans = [];
  let x = 0; for (const g of [...gates].sort((a, b) => a.u - b.u)) { if (g.u - g.w / 2 - x > 0.05) spans.push([x, g.u - g.w / 2]); x = Math.max(x, g.u + g.w / 2); } if (len - x > 0.05) spans.push([x, len]);
  const dark = Math.max(0.04, C.value - 0.22);
  for (const [a, b] of spans) {
    // the body: battered to its base's height then straight, or straight; at depth 0 it stands to the parapet's top
    if (bat) { EB.slab(out, a, b, w0, C.t, 0, Hb, C.group, C.value, { back: !retain, top: false }); if (top > Hb) EB.slab(out, a, b, C.t, C.t, Hb, depth ? top : top + ph, C.group, C.value, { back: !retain, top: !depth }); else if (!depth) EB.slab(out, a, b, C.t, C.t, Hb, top + ph, C.group, C.value, { back: !retain }); }
    else EB.slab(out, a, b, C.t, C.t, 0, depth ? top : top + ph, C.group, C.value, { back: !retain, top: !depth });
    // a wall holding ground behind it shows its inner face only over that ground
    if (retain) face(out, [[b, C.t / 2, retain], [a, C.t / 2, retain], [a, C.t / 2, depth ? top : top + ph], [b, C.t / 2, depth ? top : top + ph]], [0, 1, 0], 'dress', C.value, { group: C.group });
    if (!depth) continue;
    // the walk on the top, behind the parapet; the parapet on the outer edge
    const pt = Math.max(0.4, C.t - F.walk.w), y0 = -C.t / 2, y1 = y0 + pt;
    face(out, [[a, y1, top], [b, y1, top], [b, C.t / 2, top], [a, C.t / 2, top]], [0, 0, 1], 'dress', Math.min(1, C.value + 0.12), { group: C.group });
    const pg = P.group ?? C.group, pv = P.value ?? C.value;
    const pslab = (u0, u1, z1) => { const o = []; EB.slab(o, u0, u1, pt, pt, top, z1, pg, pv); out.push(...o.map((f) => ({ ...f, corners: f.corners.map(([u, y, z]) => [u, y + (y0 + y1) / 2, z]) }))); };
    if (P.form === 'crenel') {
      // the breastwork to the gaps' sills, then a merlon every pitch
      pslab(a, b, top + ph * 0.45);
      const pitch = P.merlon + P.crenel, n = Math.max(1, Math.floor((b - a + P.crenel) / pitch)), lead = (b - a - (n * pitch - P.crenel)) / 2;
      for (let k = 0; k < n; k++) { const u = a + lead + k * pitch; pslab(u, u + P.merlon, top + ph); if (depth >= 2) mark(out, [[u + P.merlon / 2 - 0.04, y0 - 0.01, top + ph * 0.55], [u + P.merlon / 2 + 0.04, y0 - 0.01, top + ph * 0.55], [u + P.merlon / 2 + 0.04, y0 - 0.01, top + ph * 0.92], [u + P.merlon / 2 - 0.04, y0 - 0.01, top + ph * 0.92]], [0, -1, 0], 0.05, pg); }
    } else {
      pslab(a, b, top + ph);
      // a loopholed wall carries a tile coping, a little roof along it
      if (P.cope) { const e = 0.18, zc = top + ph; face(out, [[a, y0 - e, zc], [b, y0 - e, zc], [b, (y0 + y1) / 2, zc + 0.28], [a, (y0 + y1) / 2, zc + 0.28]], [0, -1, 1.4], 'roof', P.copeValue, { group: P.cope }); face(out, [[a, y1 + e, zc], [b, y1 + e, zc], [b, (y0 + y1) / 2, zc + 0.28], [a, (y0 + y1) / 2, zc + 0.28]], [0, 1, 1.4], 'roof', Math.min(1, P.copeValue + 0.06), { group: P.cope }); }
      if (depth >= 2 && P.form === 'loophole') for (let u = a + 0.9, k = 0; u < b - 0.4; u += 1.8, k++) mark(out, k % 2 ? [[u - 0.14, y0 - 0.01, top + ph * 0.42], [u + 0.14, y0 - 0.01, top + ph * 0.42], [u + 0.14, y0 - 0.01, top + ph * 0.66], [u - 0.14, y0 - 0.01, top + ph * 0.66]] : [[u - 0.16, y0 - 0.01, top + ph * 0.4], [u + 0.16, y0 - 0.01, top + ph * 0.4], [u, y0 - 0.01, top + ph * 0.68]], [0, -1, 0], 0.05, pg);
    }
    // the laying, on the outer face: courses, or a battered base's fitted stones
    if (depth >= 2) {
      const yAt = (z) => outsideY(C, w0, bat ? Hb : top, z) - 0.008;
      const q = (u0, u1, z0, z1) => mark(out, [[u0, yAt(z0), z0], [u1, yAt(z0), z0], [u1, yAt(z1), z1], [u0, yAt(z1), z1]], [0, -1, bat ? 0.3 : 0], dark, C.group);
      const ch = C.bond === 'rubble' ? 0.55 : C.bond === 'ashlar' ? 0.6 : 0.45, pw = ch * 2.2;
      let k = 0;
      for (let z = ch; z < top - 0.1; z += ch, k++) { q(a, b, z - 0.02, z + 0.02); for (let u = a + (C.bond === 'rubble' ? R() * pw : k % 2 ? pw / 2 : pw); u < b - 0.1; u += C.bond === 'rubble' ? pw * (0.6 + R() * 0.8) : pw) q(u - 0.02, u + 0.02, z - ch, z); }
    }
    if (depth >= 3) for (let u = a + 0.9; u < b - 0.1; u += 0.9) mark(out, [[u - 0.015, y1, top + 0.004], [u + 0.015, y1, top + 0.004], [u + 0.015, C.t / 2, top + 0.004], [u - 0.015, C.t / 2, top + 0.004]], [0, 0, 1], Math.max(0.04, C.value - 0.1), C.group);
  }
}

/** A ring of eaves and a roof: a cone over a drum, a hipped (pyramid) roof over a square, from z0 rising `rise`. */
function cap(out, plan, w, z0, rise, group, value, eave = 0.5) {
  const r = w / 2 + eave, n = plan === 'round' ? 12 : 4, rot = plan === 'round' ? 0 : Math.PI / 4, R = plan === 'round' ? r : r * Math.SQRT2;
  const P = (k) => [R * Math.cos(rot + (2 * Math.PI * k) / n), R * Math.sin(rot + (2 * Math.PI * k) / n), z0];
  for (let k = 0; k < n; k++) { const a = P(k), b = P(k + 1); face(out, [a, b, [0, 0, z0 + rise]], [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, R * 0.8], 'roof', value, { group }); }
}
/** A hipped roof over a rectangle, its ridge along x, from z rising `rise`. */
function hip(out, x0, x1, y0, y1, z, rise, group, value) {
  const ym = (y0 + y1) / 2, d = Math.min((y1 - y0) / 2, (x1 - x0) / 2) * 0.9, zr = z + rise, k = (2 * rise) / (y1 - y0);
  face(out, [[x0, y0, z], [x1, y0, z], [x1 - d, ym, zr], [x0 + d, ym, zr]], [0, -1, 1 / k], 'roof', value, { group });
  face(out, [[x1, y1, z], [x0, y1, z], [x0 + d, ym, zr], [x1 - d, ym, zr]], [0, 1, 1 / k], 'roof', Math.min(1, value + 0.06), { group });
  face(out, [[x0, y1, z], [x0, y0, z], [x0 + d, ym, zr]], [-1, 0, 1 / k], 'roof', Math.min(1, value + 0.03), { group });
  face(out, [[x1, y0, z], [x1, y1, z], [x1 - d, ym, zr]], [1, 0, 1 / k], 'roof', Math.min(1, value + 0.03), { group });
}
/** A body: a drum or a square, `w` across, z0 to z1, its foot battered out by `bat` (a square only). */
function body(out, plan, w, z0, z1, group, value, bat = 0, sides = 12) {
  if (plan === 'round') { const r = w / 2, P = (k, z) => [r * Math.cos((2 * Math.PI * k) / sides), r * Math.sin((2 * Math.PI * k) / sides), z]; for (let k = 0; k < sides; k++) face(out, [P(k, z0), P(k + 1, z0), P(k + 1, z1), P(k, z1)], [Math.cos((2 * Math.PI * (k + 0.5)) / sides), Math.sin((2 * Math.PI * (k + 0.5)) / sides), 0], 'wall', value, { group }); face(out, Array.from({ length: sides }, (_, k) => P(k, z1)), [0, 0, 1], 'wall', Math.min(1, value + 0.1), { group }); return; }
  const h0 = w / 2 + bat * (z1 - z0), h1 = w / 2, c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let k = 0; k < 4; k++) { const [a, b] = [c[k], c[(k + 1) % 4]], n = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, bat]; face(out, [[a[0] * h0, a[1] * h0, z0], [b[0] * h0, b[1] * h0, z0], [b[0] * h1, b[1] * h1, z1], [a[0] * h1, a[1] * h1, z1]], n, 'wall', value, { group }); }
  face(out, c.map(([x, y]) => [x * h1, y * h1, z1]), [0, 0, 1], 'wall', Math.min(1, value + 0.1), { group });
}
/** A dome: the upper half of a spheroid `r` across its foot at z0, rising `rise`, in rings of quads (a point at its crown). */
function dome(out, r, z0, rise, group, value, sides = 12, rings = 4) {
  const P = (k, j) => { const a = (Math.PI / 2) * (j / rings), t = (2 * Math.PI * k) / sides; return [r * Math.cos(a) * Math.cos(t), r * Math.cos(a) * Math.sin(t), z0 + rise * Math.sin(a)]; };
  for (let j = 0; j < rings; j++) for (let k = 0; k < sides; k++) {
    const t = (2 * Math.PI * (k + 0.5)) / sides, a = (Math.PI / 2) * ((j + 0.5) / rings), n = [Math.cos(a) * Math.cos(t) / r, Math.cos(a) * Math.sin(t) / r, Math.sin(a) / rise];
    const pts = j === rings - 1 ? [P(k, j), P(k + 1, j), P(0, rings)] : [P(k, j), P(k + 1, j), P(k + 1, j + 1), P(k, j + 1)];
    face(out, pts.map((p) => p.map(r3)), n, 'roof', Math.min(1, value + 0.05 * j), { group });
  }
}
/**
 * A TOWER `H` over its foot, derived from the bay (`F.towerDims`), in its own frame (centred, −y the field), by depth:
 * 0 its body to its crown's foot and a plain cap; 1 its crown (crenels round it, a cone or a hipped roof over eaves,
 * or a second tier); 2 its loopholes and windows, in the tile.
 */
function tower(out, F, H, { depth = 2, sides = 12 } = {}) {
  const T = F.tower, w = F.towerDims.w, C = F.curtain, P = F.parapet, round = T.plan === 'round', bat = C.base === 'battered' && !round ? C.batter * 0.5 : 0;
  const n = depth ? sides : 8, z1 = T.crown === 'tiers' ? H * 0.62 : H;
  body(out, T.plan, w, 0, z1, C.group, C.value, bat, n);
  if (T.crown === 'crenel') {
    if (depth) { const k = round ? 8 : 4; for (let i = 0; i < (round ? k : 8); i++) { const t = (2 * Math.PI * i) / (round ? k : 8), r = w / 2 - 0.3, cx = r * Math.cos(t), cy = r * Math.sin(t); EB.box(out, [cx - 0.35, cy - 0.35, z1], [cx + 0.35, cy + 0.35, z1 + P.h * 0.7], P.group ?? C.group, P.value ?? C.value); } }
  } else if (T.crown === 'tiers') {
    // the second tier: a smaller storey of plaster over a skirt of eaves, its own hipped roof over it
    cap(out, 'square', w, z1, depth ? 0.9 : 0, T.cover, T.value, 0.7);
    if (depth) { body(out, 'square', w * 0.72, z1 + 0.5, H, T.upper ?? C.group, T.upperValue ?? C.value); cap(out, 'square', w * 0.72, H, w * 0.36, T.cover, T.value, 0.6); }
    else cap(out, 'square', w, z1, H - z1 + w * 0.3, T.cover, T.value, 0.4);
  } else if (T.crown === 'dome') {
    // a dome over a ring of eaves, a point at its crown
    if (depth) { cap(out, 'round', w + 0.2, z1, 0.25, T.cover, Math.max(0, T.value - 0.08), 0.2); dome(out, w / 2, z1 + 0.25, w * 0.5, T.cover, T.value, sides, 4); }
    else cap(out, 'round', w, z1, w * 0.45, T.cover, T.value, 0.2);
  } else cap(out, T.plan, w, z1, depth ? (T.crown === 'cone' ? w * 0.95 : w * 0.42) : w * 0.6, T.cover, T.value, depth ? 0.45 : 0.2);
  if (depth >= 2) {
    // loopholes on the field's faces, a storey apart
    const r = w / 2 + 0.01;
    for (let z = 2.4; z < z1 - 1; z += 2.8) for (const t of round ? [-Math.PI / 2, -Math.PI / 2 - 0.9, -Math.PI / 2 + 0.9] : [-Math.PI / 2]) { const x = r * Math.cos(t), y = r * Math.sin(t), tx = -Math.sin(t) * 0.07; mark(out, [[x - tx, y, z], [x + tx, y, z], [x + tx, y, z + 0.9], [x - tx, y, z + 0.9]], [Math.cos(t), Math.sin(t), 0], 0.05, C.group); }
  }
}
/**
 * A GATEHOUSE over a passage `clear` high and `pw` wide through a curtain `H` high: twin towers either side and a
 * block over the passage under its parapet, or one box gate-tower over it with a roofed storey; by depth as a tower.
 * Its frame: x along the curtain, y across it (−y the field), centred on the passage.
 */
function gatehouse(out, F, H, pw, { depth = 2 } = {}) {
  const G0 = F.gate, C = F.curtain, w = F.towerDims.w, d = C.t + 2, clear = G0.clear;
  if (G0.form === 'twin') {
    for (const s of [-1, 1]) { const o = []; tower(o, F, H + 3, { depth }); out.push(...o.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [r3(x + s * (pw / 2 + w / 2)), r3(y - w * 0.25), z]) }))); }
    EB.slab(out, -pw / 2, pw / 2, d, d, clear, H + F.parapet.h * (depth ? 0.45 : 1), C.group, C.value);
  } else {
    const W = pw + 6;
    for (const s of [-1, 1]) EB.slab(out, s < 0 ? -W / 2 : pw / 2, s < 0 ? -pw / 2 : W / 2, d + 1, d + 1, 0, H, C.group, C.value);
    EB.slab(out, -pw / 2, pw / 2, d + 1, d + 1, clear, H, C.group, C.value);
    // the gate-tower's storey over the passage, plastered, under a hipped roof
    const up = F.tower.upper ?? F.parapet.group ?? C.group, uv = F.tower.upperValue ?? F.parapet.value ?? C.value;
    EB.slab(out, -W / 2 + 0.6, W / 2 - 0.6, d - 0.4, d - 0.4, H, H + 3, up, uv);
    if (depth) hip(out, -W / 2 - 0.4, W / 2 + 0.4, -d / 2 - 0.6, d / 2 + 0.6, H + 3, 2, F.tower.cover, F.tower.value);
  }
  // the gates: two leaves in the passage, shut, under the arch
  if (depth >= 2) mark(out, [[-pw / 2 + 0.1, -d / 2 - 0.02, 0], [pw / 2 - 0.1, -d / 2 - 0.02, 0], [pw / 2 - 0.1, -d / 2 - 0.02, clear - 0.1], [-pw / 2 + 0.1, -d / 2 - 0.02, clear - 0.1]], [0, -1, 0], 0.3, 'str:timber');
}

/** A skirt of eaves round a square storey: from the eave ring `w0` across at z, rising `rise` in to the storey `w1` over it. */
function skirt(out, w0, w1, z, rise, group, value) {
  const a = w0 / 2, b = w1 / 2, c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let k = 0; k < 4; k++) { const [p, q] = [c[k], c[(k + 1) % 4]]; face(out, [[p[0] * a, p[1] * a, z], [q[0] * a, q[1] * a, z], [q[0] * b, q[1] * b, z + rise], [p[0] * b, p[1] * b, z + rise]], [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (a - b) / rise], 'roof', Math.min(1, value + (k % 2) * 0.05), { group }); }
}
/** A gable standing out of a skirt on the −y face: its triangle and its two roof planes back to the storey behind. */
function gable(out, g, yE, yW, z, group, value, wall, wallValue) {
  const h = g * 0.9;
  face(out, [[-g, yE, z], [g, yE, z], [0, yE, z + h]], [0, -1, 0], 'wall', wallValue, { group: wall });
  face(out, [[-g - 0.3, yE - 0.2, z - 0.1], [0, yE - 0.2, z + h + 0.15], [0, yW, z + h + 0.15], [-g - 0.3, yW, z - 0.1]], [-h, 0, g], 'roof', value, { group });
  face(out, [[0, yE - 0.2, z + h + 0.15], [g + 0.3, yE - 0.2, z - 0.1], [g + 0.3, yW, z - 0.1], [0, yW, z + h + 0.15]], [h, 0, g], 'roof', Math.min(1, value + 0.05), { group });
}
/**
 * THE KEEP: the lord's tower, `K` across and `H` to its parapet's top (a tiered keep: to its top storey's eaves), in
 * its own frame (centred, −y the field), derived from the tower as the tower from the bay: the same stone and plan,
 * twice as broad and more, crowned by what the tower's crown says at its scale. A crenellated crown or a roof over a
 * square: a great tower, pilastered, its parapet broken by corner turrets that rise over it, a forebuilding on the
 * court side holding its stair; a drum: crenels round a cone, a stair turret beside it; tiers: a battered stone base
 * to `base` and over it, then storeys stepping in, each under its skirt of eaves, gables out of the skirts, the top
 * under a hipped roof. By depth: 0 the mass and a plain cap; 1 the crown, turrets, forebuilding, gables; 2 the windows
 * and loops, in the tile.
 */
function keep(out, F, K, H, { depth = 2, base = 0, form = null } = {}) {
  const C = F.curtain, P = F.parapet, T = F.tower, pg = P.group ?? C.group, pv = P.value ?? C.value, dark = Math.max(0.04, C.value - 0.3);
  if (form === 'orbs') return orbs(out, F, K, H, { depth, base });
  if (form === 'stepped') return stepped(out, F, K, H, { depth, base });
  const lights = (w, z0, z1, every, wide = 0.5, tall = 1.1, faces4 = true) => {
    // windows a storey apart on each face, in the tile
    for (let z = z0; z < z1 - tall; z += every) for (let k = 0; k < (faces4 ? 4 : 1); k++) {
      const n = Math.max(1, Math.floor(w / 3.2)), t = (k * Math.PI) / 2, cs = Math.cos(t), sn = Math.sin(t);
      for (let i = 0; i < n; i++) { const u = -w / 2 + (w * (i + 0.5)) / n, y = -w / 2 - 0.01, P2 = (x, zz) => [x * cs - y * sn, x * sn + y * cs, zz]; mark(out, [P2(u - wide / 2, z), P2(u + wide / 2, z), P2(u + wide / 2, z + tall), P2(u - wide / 2, z + tall)], [sn, -cs, 0], 0.06, C.group); }
    }
  };
  if (T.crown === 'tiers') {
    // the stone base, battered, to the ward's platform and a storey over it; then the storeys, stepping in
    const hb = r3(Math.max(3.5, base + 3)), n = 3, th = (H - hb) / n, eave = Math.max(0.9, K * 0.07), up = T.upper ?? pg, uv = T.upperValue ?? pv;
    body(out, 'square', K, 0, hb, C.group, C.value, C.batter * 0.5);
    for (let i = 0; i < n; i++) {
      const w = r3((K - 1.2) * 0.8 ** i), z0 = r3(hb + i * th), z1 = r3(z0 + th), next = i < n - 1 ? r3((K - 1.2) * 0.8 ** (i + 1)) : 0;
      body(out, 'square', w, z0, z1, up, uv);
      if (i < n - 1) {
        skirt(out, w + 2 * eave, next, z1 - 0.9, 1.5, T.cover, T.value);
        // a gable out of the skirt, on the face the eye meets, turning a face each storey
        if (depth && i < 2) { const o = []; gable(o, w * 0.24, -(w / 2 + eave * 0.4), -next / 2, z1 - 0.7, T.cover, T.value, up, uv); const t = (i * Math.PI) / 2; out.push(...o.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [r3(x * Math.cos(t) - y * Math.sin(t)), r3(x * Math.sin(t) + y * Math.cos(t)), z]), normal: [f.normal[0] * Math.cos(t) - f.normal[1] * Math.sin(t), f.normal[0] * Math.sin(t) + f.normal[1] * Math.cos(t), f.normal[2]] }))); }
      } else hip(out, -w / 2 - eave, w / 2 + eave, -w / 2 - eave, w / 2 + eave, z1, depth ? w * 0.42 : w * 0.3, T.cover, T.value);
      if (depth >= 2) lights(w, z0 + 1, z1 - 0.9, th, 0.9, 0.8);
    }
    if (depth >= 2) for (let z = 0.6; z < hb - 0.2; z += 0.6) mark(out, [[-K / 2 - 0.01, -K / 2 - 0.01, z - 0.02], [K / 2 + 0.01, -K / 2 - 0.01, z - 0.02], [K / 2 + 0.01, -K / 2 - 0.01, z + 0.02], [-K / 2 - 0.01, -K / 2 - 0.01, z + 0.02]], [0, -1, 0.2], dark, C.group);
    return;
  }
  if (T.plan === 'round') {
    // a drum: crenels round its top, a cone inside them, a stair turret beside it on the court side
    body(out, 'round', K, 0, H, C.group, C.value, 0, depth ? 16 : 10);
    if (depth) {
      const k = Math.max(10, Math.round((Math.PI * K) / (P.merlon + P.crenel))), r = K / 2 - 0.3;
      for (let i = 0; i < k; i++) { const t = (2 * Math.PI * i) / k, cx = r * Math.cos(t), cy = r * Math.sin(t); EB.box(out, [cx - 0.35, cy - 0.35, H], [cx + 0.35, cy + 0.35, H + P.h * 0.7], pg, pv); }
      if (T.crown === 'cone') cap(out, 'round', K - 1.6, H - 0.2, K * 0.6, T.cover, T.value, 0);
      const st = []; body(st, 'round', 3.4, 0, H + 3, C.group, C.value, 0, 10); if (T.crown === 'cone') cap(st, 'round', 3.4, H + 3, 2.8, T.cover, T.value, 0.25);
      out.push(...st.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [r3(x + K * 0.3), r3(y + K * 0.42), z]) })));
    } else cap(out, 'round', K, H, K * 0.5, T.cover, T.value, 0.2);
    if (depth >= 2) for (let z = 3; z < H - 2; z += 3.6) for (const t of [-Math.PI / 2, -Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8, 0, Math.PI]) { const x = (K / 2 + 0.01) * Math.cos(t), y = (K / 2 + 0.01) * Math.sin(t), tx = -Math.sin(t) * 0.25, ty = Math.cos(t) * 0.25; mark(out, [[x - tx, y - ty, z], [x + tx, y + ty, z], [x + tx, y + ty, z + 1.2], [x - tx, y - ty, z + 1.2]], [Math.cos(t), Math.sin(t), 0], 0.06, C.group); }
    return;
  }
  // a great tower: pilastered, its parapet broken by turrets at the corners, a roof inside if its crown is roofed
  body(out, 'square', K, 0, H, C.group, C.value, C.base === 'battered' ? C.batter * 0.4 : 0);
  if (!depth) { if (T.crown === 'crenel') EB.slab(out, -K / 2, K / 2, K, K, H, H + P.h, pg, pv); else hip(out, -K / 2 - 0.3, K / 2 + 0.3, -K / 2 - 0.3, K / 2 + 0.3, H, K * 0.3, T.cover, T.value); return; }
  const tw = r3(Math.max(2.6, Math.min(3.8, K * 0.2))), pitch = P.merlon + P.crenel;
  for (let k = 0; k < 4; k++) {
    // each face: its pilasters, its breastwork and merlons between the turrets
    const t = (k * Math.PI) / 2, cs = Math.cos(t), sn = Math.sin(t), rot = (x, y, z) => [r3(x * cs - y * sn), r3(x * sn + y * cs), z], o = [];
    for (const u of [-K / 6, K / 6]) EB.box(o, [u - 0.6, -K / 2 - 0.35, 0], [u + 0.6, -K / 2 + 0.01, H - 0.4], C.group, C.value);
    EB.box(o, [-K / 2 + tw, -K / 2, H], [K / 2 - tw, -K / 2 + 0.7, H + P.h * 0.45], pg, pv);
    const span = K - 2 * tw, n = Math.max(1, Math.floor((span + P.crenel) / pitch)), lead = (span - (n * pitch - P.crenel)) / 2;
    for (let i = 0; i < n; i++) { const u = -K / 2 + tw + lead + i * pitch; EB.box(o, [u, -K / 2, H], [u + P.merlon, -K / 2 + 0.7, H + P.h], pg, pv); }
    out.push(...o.map((f) => ({ ...f, corners: f.corners.map((p) => rot(...p)), normal: [f.normal[0] * cs - f.normal[1] * sn, f.normal[0] * sn + f.normal[1] * cs, f.normal[2]] })));
  }
  // the turrets: square, over the parapet by a storey, crenellated or capped as the tower is crowned
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const cx = sx * (K / 2 - tw / 2), cy = sy * (K / 2 - tw / 2), top = H + P.h + 2.2, o = [];
    EB.box(o, [cx - tw / 2, cy - tw / 2, H - 1], [cx + tw / 2, cy + tw / 2, top], C.group, C.value);
    if (T.crown === 'crenel') for (const [mx, my] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) EB.box(o, [cx + mx * tw / 2 - (mx > 0 ? 0.7 : 0), cy + my * tw / 2 - (my > 0 ? 0.7 : 0), top], [cx + mx * tw / 2 + (mx < 0 ? 0.7 : 0), cy + my * tw / 2 + (my < 0 ? 0.7 : 0), top + P.h * 0.6], pg, pv);
    else { const c0 = []; cap(c0, 'square', tw, top, tw * 0.7, T.cover, T.value, 0.25); o.push(...c0.map((f) => ({ ...f, corners: f.corners.map(([x, y, z]) => [r3(x + cx), r3(y + cy), z]) }))); }
    out.push(...o);
  }
  if (T.crown !== 'crenel') hip(out, -K / 2 + tw, K / 2 - tw, -K / 2 + 0.9, K / 2 - 0.9, H - 0.3, K * 0.32, T.cover, T.value);
  // the forebuilding on the court side: the stair to the first floor, under its own parapet
  const fw = r3(K * 0.42), fd = 4.2, fh = r3(Math.min(H * 0.42, 9));
  EB.box(out, [-K / 2 + 1, K / 2, 0], [-K / 2 + 1 + fw, K / 2 + fd, fh], C.group, C.value);
  for (let u = -K / 2 + 1.2; u < -K / 2 + 1 + fw - P.merlon; u += pitch) EB.box(out, [u, K / 2 + fd - 0.6, fh], [u + P.merlon, K / 2 + fd, fh + P.h * 0.8], pg, pv);
  if (depth >= 2) { lights(K, 4, H - 1.5, 4, 0.6, 1.4); for (let u = -K / 2 + 1.6; u < -K / 2 + fw; u += 1.8) mark(out, [[u, K / 2 + fd + 0.01, 2.5], [u + 0.5, K / 2 + fd + 0.01, 2.5], [u + 0.5, K / 2 + fd + 0.01, 3.5], [u, K / 2 + fd + 0.01, 3.5]], [0, 1, 0], 0.06, C.group); }
}

/**
 * A KEEP OF ORBS, for a language of shells: a drum of stone to the platform and a storey over it, then orbs stacked
 * smaller, each a collar and a dome, the next rising out of the dome under it, a point at the crown; by depth: 0 the
 * drum and one dome; 1 the stack; 2 the lights round each collar, in the tile.
 */
function orbs(out, F, K, H, { depth = 2, base = 0 } = {}) {
  const C = F.curtain, T = F.tower, sides = depth ? 16 : 10, hb = r3(Math.max(3, base + 2.5)), up = T.upper ?? F.parapet.group ?? C.group, uv = T.upperValue ?? F.parapet.value ?? C.value;
  body(out, 'round', K, 0, hb, C.group, C.value, 0, sides);
  if (!depth) { dome(out, K / 2, hb, H - hb, up, uv, sides, 3); return; }
  const rs = [0.5, 0.36, 0.25].map((k) => r3(K * k)), share = [0.46, 0.32, 0.22];
  let z = hb;
  rs.forEach((r, i) => {
    const h = (H - hb) * share[i], collar = r3(h * 0.3), hd = r3(h * 0.95);
    body(out, 'round', 2 * r * 0.98, z, z + collar, up, uv, 0, sides);
    dome(out, r, z + collar, hd, up, Math.min(1, uv + 0.04 * i), sides, 4);
    if (depth >= 2) for (let k = 0; k < 8; k++) { const t = (2 * Math.PI * (k + 0.5)) / 8, x = r * 0.99 * Math.cos(t), y = r * 0.99 * Math.sin(t), tx = -Math.sin(t) * 0.35, ty = Math.cos(t) * 0.35, zc = z + collar * 0.5; mark(out, [[x - tx, y - ty, zc - 0.3], [x + tx, y + ty, zc - 0.3], [x + tx, y + ty, zc + 0.3], [x - tx, y - ty, zc + 0.3]], [Math.cos(t), Math.sin(t), 0], 0.62, 'str:lens'); }
    // the next orb rises out of this dome where its collar meets it
    const next = rs[i + 1];
    z = next ? r3(z + collar + hd * Math.sqrt(Math.max(0, 1 - ((next * 0.98) / r) ** 2))) : z;
  });
  const tip = H + (H - hb) * 0.12; face(out, [[-0.25, 0, H - 0.4], [0.25, 0, H - 0.4], [0, 0, tip]], [0, -1, 0], 'roof', T.value, { group: T.cover }); face(out, [[0, -0.25, H - 0.4], [0, 0.25, H - 0.4], [0, 0, tip]], [1, 0, 0], 'roof', T.value, { group: T.cover });
}
/**
 * A STEPPED KEEP, for a language that steps in tiers under flat roofs: terraces of sloped stone (each a talud under a
 * panel), stepping in to a platform at seven tenths of its height; a stair up the face toward the court between its
 * balustrades; on the platform a shrine under a flat roof and a crest. By depth: 0 the terraces as one stepped mass;
 * 1 the panels, the stair, the shrine and its crest; 2 the stair's treads and the panels' frames, in the tile.
 */
function stepped(out, F, K, H, { depth = 2 } = {}) {
  const C = F.curtain, P = F.parapet, T = F.tower, n = 4, hp = r3(H * 0.7), th = hp / n, up = T.upper ?? P.group ?? C.group, uv = T.upperValue ?? P.value ?? C.value, crest = P.group ?? C.group;
  const wOf = (i) => r3(K * (1 - 0.17 * i));
  for (let i = 0; i < n; i++) {
    const w = wOf(i), z0 = r3(i * th), zt = r3(z0 + th * 0.62);
    body(out, 'square', w, z0, depth ? zt : z0 + th, C.group, C.value, 0.22);
    if (depth) body(out, 'square', w - 0.6, zt, z0 + th, C.group, Math.min(1, C.value + 0.1));
    if (depth >= 2) for (let k = 0; k < 4; k++) { const t = (k * Math.PI) / 2, cs = Math.cos(t), sn = Math.sin(t), y = -(w - 0.6) / 2 - 0.01, a = -(w - 0.6) / 2 + 0.4, b = (w - 0.6) / 2 - 0.4, R = (x, zz) => [r3(x * cs - y * sn), r3(x * sn + y * cs), zz]; mark(out, [R(a, zt + 0.15), R(b, zt + 0.15), R(b, z0 + th - 0.15), R(a, z0 + th - 0.15)], [sn, -cs, 0], Math.max(0.04, C.value - 0.25), C.group); }
  }
  if (!depth) return;
  // the stair up the court's face (+y), its balustrades either side
  const sw = r3(Math.max(3, K * 0.24)), steps = Math.round(hp / 0.3), run = K / 2 - wOf(n - 1) / 2;
  for (let k = 0; k < steps; k++) { const z = r3(((k + 1) * hp) / steps), y = r3(K / 2 - (k * run) / steps + 0.4); EB.box(out, [-sw / 2, y - run / steps - 0.05, z - hp / steps], [sw / 2, y, z], C.group, Math.min(1, C.value + 0.12)); }
  for (const sx of [-1, 1]) { const x = sx * (sw / 2 + 0.35); face(out, [[x - 0.35, K / 2 + 0.4, 0], [x + 0.35, K / 2 + 0.4, 0], [x + 0.35, K / 2 - run + 0.4, hp + 0.3], [x - 0.35, K / 2 - run + 0.4, hp + 0.3]], [0, 1, run / hp], 'wall', Math.max(0, C.value - 0.06), { group: C.group }); }
  // the shrine on the platform, under a flat roof, its crest over it
  const sh = r3(wOf(n - 1) * 0.68), z1 = H - 0.4;
  EB.box(out, [-sh / 2, -sh / 2, hp], [sh / 2, sh / 2, z1], up, uv);
  EB.box(out, [-sh / 2 - 0.4, -sh / 2 - 0.4, z1], [sh / 2 + 0.4, sh / 2 + 0.4, H], C.group, C.value);
  EB.box(out, [-sh * 0.35, -0.3, H], [sh * 0.35, 0.3, H + sh * 0.45], crest, P.value ?? C.value);
  if (depth >= 2) { mark(out, [[-0.8, sh / 2 + 0.01, hp], [0.8, sh / 2 + 0.01, hp], [0.8, sh / 2 + 0.01, hp + 2.4], [-0.8, sh / 2 + 0.01, hp + 2.4]], [0, 1, 0], 0.05, up); for (let x = -sh * 0.3; x < sh * 0.3; x += 0.9) mark(out, [[x, -0.31, H + 0.4], [x + 0.45, -0.31, H + 0.4], [x + 0.45, -0.31, H + sh * 0.35], [x, -0.31, H + sh * 0.35]], [0, -1, 0], 0.62, 'str:lens'); }
}

export const build = Object.freeze({ bay, tower, gatehouse, keep });
