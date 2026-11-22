/**
 * THE CLOSED PARTS, PAINTED (docs/side-map-principles.md "The closed parts are painted"): what Jumping Giuseppe's strip
 * never did. Every closed part the camera sees is drawn as its place's FILL (fills.js), designed at the size it is seen
 * at, as MARKS on its face toward the camera: data the build draws and the drawing shows, never geometry of its own.
 *
 *   the FILL        rock: beds level across the whole level (one datum, so a gap shows the same strata either side),
 *                   joints along them, roots near an outdoor top. Built: courses in running bond, a trim under every
 *                   lip. Machine: panels and their seams on one grid. Padded: blocks in a frame, each with its light
 *   the SLICES      a zone's closed parts cut along the way in slices a quarter screen wide, A and B by the walls' rule
 *                   (era/wall-rhythm.js): an A slice carries its fill's motif (a pocket, a niche, a lamp panel, a bolt
 *                   plate), a B slice only the fill, so no stretch repeats
 *   the MIDDLE      a big mass something toward its middle, so it is a mass and not a texture: a vein of ore, a recessed
 *                   panel, a window into the works behind, a great block
 *   the EDGES       a solid's end toward open space lit; its end at a pit the place's own break (teeth bitten out)
 *   the CAP         every top a hero stands on a designed surface in segments on its fill's module (SIDE_CAP): built
 *                   coping in half bond with a pier cap at each pillar, machine deck plates with seams, rivets and a
 *                   hazard band at a pit's lip, padded cushions, rock slabs on one rhythm; down its lit edge and across
 *                   the walking surface (a mark with `top`: drawn level on the top, not on the face)
 *   the JAMB        every wall a hero kicks off or runs into the cap on its side (SIDE_JAMB, wallSurfaces): a band down
 *                   its edge and its face into the open (a mark with `side`: drawn on that face) in segments on the
 *                   fill's module, chunky (notches the open shows through, never past the kicking plane), a string
 *                   course every few courses, a bracket under each rest
 *   the THREADS     the dress's thread (pipes, cables, roots, a channel) carried through the closed parts from one zone into
 *                   the next under the way, up a shaft's wall and down a chute's, drawn wherever it passes behind a face
 *
 *   paintSideMap(layout, dress, { seed? }) → { marks: [{ zone, s0, s1, z0, z1, fill, layer, what }], slices: [{ zone,
 *                     s0, s1, ab }], threads: [{ kind, path: [[s, z], …] }] }   (layer: 1 the fill, 2 a motif or the
 *                     middle, 3 a thread, 4 an edge; drawn over each other in that order)
 *   SLICE            a slice's width, a share of the screen's
 *
 * Pure and deterministic: seeded dice (city/plan/dice.js streamOf).
 */
import { wallRhythm } from '../../era/wall-rhythm.js';
import { streamOf } from '../../city/plan/dice.js';
import { cakeBody, icingOf } from './cake.js';

export const SLICE = 0.25;
const r3 = (v) => Math.round(v * 1000) / 1000;
const BIG = 5, LINE = 0.07, THREAD = 0.32, UNDER = 2.2, BESIDE = 1.3;
/** The jamb a wall a hero kicks off wears (the cap on its side): each fill's course (m) up the wall, its band's widths
 *  in turn (built: long and short quoins), its tones' cycle, its notches' depths in turn (chunky: never past 0.15 m, the
 *  plane the hero kicks off untouched), how many courses to a string course, the rock's rhythm of heights. */
export const SIDE_JAMB = Object.freeze({
  module: Object.freeze({ built: 0.5, machine: 1.6, padded: 1.2 }),
  width: Object.freeze({ built: [0.6, 0.34], machine: [0.4], padded: [0.45], rock: [0.34, 0.5, 0.4, 0.6, 0.3] }),
  cycle: Object.freeze({ built: [0, 1], machine: [0, 1], padded: [0, 1], rock: [0, 2, 1, 0, 1] }),
  notch: Object.freeze({ built: [0, 0.13], machine: [0, 0.14], padded: [0, 0.11], rock: [0, 0.15, 0.07, 0.13, 0.03] }),
  string: Object.freeze({ built: 6, machine: 3, padded: 4, rock: 5 }),
  rock: Object.freeze([1.1, 0.7, 1.5, 0.9, 1.3]),
});
/** The walls a hero kicks off or runs into: each end of a closed part standing on open space a body tall or more →
 *  [{ zone, solid, e (its end), dir (+1: the open beyond it, at greater s), z0, z1 }]. */
export function wallSurfaces(L, tall = 2) {
  const out = [];
  for (const r of L.solids) {
    if (r.role === 'ceiling') continue;
    for (const [e, dir] of [[r.s0, -1], [r.s1, 1]]) {
      let z0 = Infinity, z1 = -Infinity;
      for (const o of L.open) if (Math.abs((dir > 0 ? o.s0 : o.s1) - e) < 0.02) { const a = Math.max(r.z0, o.z0), b = Math.min(r.z1, o.z1); if (b - a > 0) { z0 = Math.min(z0, a); z1 = Math.max(z1, b); } }
      if (z1 - z0 >= tall) out.push({ zone: r.zone, solid: r, e, dir, z0: r3(z0), z1: r3(z1) });
    }
  }
  return out;
}

/** The cap a top a hero stands on wears: its band's height, each fill's module (m) and its tones' cycle, the rock's rhythm. */
export const SIDE_CAP = Object.freeze({
  height: 0.34,
  module: Object.freeze({ built: 1.3, machine: 2.4, padded: 1.2 }),
  cycle: Object.freeze({ built: [0, 1, 0, 2], machine: [0, 1], padded: [0, 1], rock: [0, 2, 1, 0, 1, 2] }),
  rock: Object.freeze([1.7, 1.1, 2.3, 0.9, 1.5, 1.2]),
});
const mix = (hex, to, k) => {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16), c = [16, 8, 0].map((s) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};
const THREAD_TONE = { pipes: ['#9aa6b2', 0.35], cables: ['#141418', 0.6], roots: ['#3b2a1e', 0.55], channels: ['#c8d6e0', 0.3] };

/** The closed parts' paint over a laid, dressed map. */
export function paintSideMap(layout, dress, { seed = 1 } = {}) {
  const L = layout, W = L.screen.width, SL = W * SLICE, marks = [], dice = (k) => streamOf(seed, 'side-map-paint', k);
  const mark = (zone, s0, s1, z0, z1, fill, layer, what, r) => {
    const a = Math.max(s0, r.s0), b = Math.min(s1, r.s1), c = Math.max(z0, r.z0), d = Math.min(z1, r.z1);
    if (b - a > 1e-3 && d - c > 1e-3) marks.push({ zone, s0: r3(a), s1: r3(b), z0: r3(c), z1: r3(d), fill, layer, what });
  };
  // the datum: beds, courses and panels level across the whole level
  const zTop = Math.max(...L.swept.map((r) => r.z1)), zLo = Math.min(...L.swept.map((r) => r.z0));
  const beds = [], bd = dice('beds');
  for (let z = Math.ceil(zTop) + 1, k = 0; z > zLo; k++) { const t = 0.6 + 0.7 * bd(); beds.push([z - t, z, k]); z -= t; }
  // the slices, A and B by the walls' rule, a zone at a time
  const slices = [];
  for (const Z of L.zones) {
    const k0 = Math.floor(Z.rect[0] / SL), k1 = Math.ceil(Z.rect[1] / SL), n = Math.max(1, k1 - k0), order = wallRhythm(n, { pick: dice(`slices-${Z.i}`)() }) ?? 'A'.repeat(n);
    for (let k = 0; k < n; k++) slices.push({ zone: Z.i, s0: r3((k0 + k) * SL), s1: r3((k0 + k + 1) * SL), ab: order[k] });
  }
  const pits = L.gaps.filter((g) => g.kind !== 'wall');
  const touches = (r, s) => L.solids.some((o) => o !== r && Math.abs((s === r.s0 ? o.s1 : o.s0) - s) < 1e-3 && o.z0 < r.z1 - 0.5 && o.z1 > r.z0 + 0.5);
  L.solids.forEach((r, i) => {
    const z = dress.zones[r.zone], fam = z.family, d = dice(`solid-${i}`), dark = mix(z.key, '#000000', 0.32), deep = mix(z.key, '#000000', 0.58), light = mix(z.key, '#ffffff', 0.22);
    const M = (s0, s1, z0, z1, fill, layer, what) => mark(r.zone, s0, s1, z0, z1, fill, layer, what, r);
    // the cake's layers where its material draws them (cake.js: kibble, plate, rock, snow), else the fill's own
    if (z.material && cakeBody(r, z, { M, mix, beds, slices })) {
      // (its body the material's)
    } else if (fam === 'rock') {
      for (const [b0, b1, k] of beds) {
        if (b1 < r.z0 || b0 > r.z1) continue;
        if (k % 2) M(r.s0, r.s1, b0, b1, mix(z.key, '#000000', 0.12), 1, 'bed');
        for (let s = Math.floor(r.s0 / 3.5) * 3.5 + 1.5 * ((k * 7) % 3) / 2; s < r.s1; s += 1.5 + 2 * bd()) M(s, s + LINE, b0, b1, dark, 1, 'joint');
      }
      if (!z.indoor) for (let s = r.s0 + 0.4; s < r.s1 - 0.3; s += 0.8 + 0.8 * d()) M(s, s + 0.09, r.z1 - 0.3 - 0.7 * d(), r.z1, deep, 1, 'root');
    } else if (fam === 'built') {
      let k = 0;
      for (let z1 = Math.floor(r.z1 * 2) / 2; z1 > r.z0; z1 -= 0.5, k++) {
        M(r.s0, r.s1, z1 - 0.05, z1, dark, 1, 'course');
        for (let s = Math.floor(r.s0 / 1.3) * 1.3 + (k % 2) * 0.65; s < r.s1; s += 1.3) M(s, s + 0.05, z1 - 0.5, z1, dark, 1, 'stone');
      }
    } else if (fam === 'machine') {
      for (let s = Math.ceil(r.s0 / 2.4) * 2.4; s < r.s1; s += 2.4) M(s - LINE / 2, s + LINE / 2, r.z0, r.z1, deep, 1, 'seam');
      for (let zz = Math.ceil(r.z0 / 1.6) * 1.6; zz < r.z1; zz += 1.6) M(r.s0, r.s1, zz - LINE / 2, zz + LINE / 2, deep, 1, 'seam');
    } else {
      for (let s = Math.ceil(r.s0 / 1.2) * 1.2; s < r.s1; s += 1.2) M(s - 0.06, s + 0.06, r.z0, r.z1, deep, 1, 'frame');
      for (let zz = Math.ceil(r.z0 / 1.2) * 1.2; zz < r.z1; zz += 1.2) { M(r.s0, r.s1, zz - 0.06, zz + 0.06, deep, 1, 'frame'); M(r.s0, r.s1, zz + 0.06, zz + 0.14, light, 1, 'cushion'); }
    }
    // the A slices' motif, where the solid is tall enough to carry one
    if (r.z1 - r.z0 >= 2.5) for (const sl of slices.filter((x) => x.zone === r.zone && x.ab === 'A' && x.s0 < r.s1 && x.s1 > r.s0)) {
      const a = Math.max(sl.s0, r.s0), b = Math.min(sl.s1, r.s1), c = (a + b) / 2, h = r.z0 + (r.z1 - r.z0) * (0.35 + 0.3 * d());
      if (b - a < 1.6) continue;
      if (fam === 'rock') { M(c - 0.7, c + 0.7, h - 0.4, h + 0.4, deep, 2, 'pocket'); M(c - 0.7, c + 0.7, h - 0.5, h - 0.4, light, 2, 'pocket'); }
      else if (fam === 'built') { M(c - 0.6, c + 0.6, h - 0.9, h + 0.9, deep, 2, 'niche'); M(c - 0.6, c + 0.6, h + 0.9, h + 1.05, light, 2, 'niche'); }
      else if (fam === 'machine') { M(c - 0.8, c + 0.8, h - 0.5, h + 0.5, deep, 2, 'lamp-panel'); M(c - 0.5, c + 0.5, h - 0.2, h + 0.2, z.edge, 2, 'lamp-panel'); }
      else M(c - 0.45, c + 0.45, h - 0.45, h + 0.45, light, 2, 'plate');
    }
    // the middle of a big mass
    const w = r.s1 - r.s0, t = r.z1 - r.z0;
    if (w >= BIG && t >= BIG) {
      const cs = (r.s0 + r.s1) / 2, cz = (r.z0 + r.z1) / 2, m = 0.35 * Math.min(w, t);
      if (fam === 'rock') for (let k = 0; k < 7; k++) M(cs - m / 2 + (k * m) / 7, cs - m / 2 + ((k + 1) * m) / 7, cz - m / 4 + (k * m) / 14, cz - m / 4 + (k * m) / 14 + 0.35, mix(z.edge, '#ffd890', 0.3), 2, 'vein');
      else if (fam === 'built') { M(cs - m / 2, cs + m / 2, cz - m / 2, cz + m / 2, deep, 2, 'recess'); M(cs - m / 2, cs + m / 2, cz + m / 2, cz + m / 2 + 0.18, light, 2, 'recess'); }
      else if (fam === 'machine') {
        M(cs - m / 2 - 0.2, cs + m / 2 + 0.2, cz - m / 3 - 0.2, cz + m / 3 + 0.2, deep, 2, 'window');
        M(cs - m / 2, cs + m / 2, cz - m / 3, cz + m / 3, mix('#ffcf73', z.key, 0.25), 2, 'window');
        M(cs - m / 4, cs - m / 4 + m / 5, cz - m / 3, cz + m / 8, dark, 2, 'works'); M(cs + m / 8, cs + m / 8 + m / 6, cz - m / 3, cz, dark, 2, 'works');
      } else { M(cs - m / 2, cs + m / 2, cz - m / 2, cz + m / 2, deep, 2, 'great-block'); M(cs - m / 2 + 0.15, cs + m / 2 - 0.15, cz - m / 2 + 0.15, cz + m / 2 - 0.15, light, 2, 'great-block'); }
    }
    // the edges: an end toward open space lit; an end at a pit bitten out
    for (const s of [r.s0, r.s1]) {
      const inward = s === r.s0 ? 1 : -1, atPit = pits.some((g) => g.zone === r.zone && Math.abs((inward > 0 ? g.s1 : g.s0) - s) < 1e-3);
      if (atPit) for (let zz = r.z1 - 0.15, k = 0; zz > Math.max(r.z0, r.z1 - 2.4); zz -= 0.3, k++) { if (k % 2) M(Math.min(s, s + inward * 0.28), Math.max(s, s + inward * 0.28), zz - 0.3, zz, deep, 4, 'break'); }
      else if (!touches(r, s)) M(Math.min(s, s + inward * 0.12), Math.max(s, s + inward * 0.12), r.z0, r.z1 - 0.14, mix(z.key, '#ffffff', 0.35), 4, 'edge');
    }
  });
  // THE CAP: every top a hero stands on is a designed surface, never one smooth band. Its band down the lit edge and the
  // walking surface itself cut in segments on its fill's module (a built run's coping in half bond with its courses, a
  // machine's deck plates on its panel grid with their seams and rivets and a hazard band at a pit's lip, a padded run's
  // cushions on its block grid, a rock's slabs on one rhythm of lengths, chipped every third joint), each segment a tone
  // of the zone's own in a fixed cycle, a pier cap where a back wall's pillar stands; on the level's own grid, so a cap
  // reads the same on every floor of a fill
  const exposed = (r) => !L.solids.some((o) => o !== r && Math.abs(o.z0 - r.z1) < 0.05 && Math.min(o.s1, r.s1) - Math.max(o.s0, r.s0) > 0.3);
  for (const r of L.solids) {
    if (r.role === 'ceiling' || r.role === 'wall' || !exposed(r)) continue;
    const z = dress.zones[r.zone], fam = z.family, CAP = Math.min(SIDE_CAP.height, r.z1 - r.z0);
    // (iced in the material's own where it has one: snow is iced with snow, cake.js)
    const ic = icingOf(z.material, z, mix);
    const tone = ic?.tone ?? [mix(z.edge, z.key, 0.4), mix(z.edge, z.key, 0.2), mix(z.edge, z.key, 0.55)], joint = ic?.joint ?? mix(z.key, '#000000', 0.45), shine = ic?.shine ?? z.edge;
    const C = (s0, s1, z0, z1, fill, what) => mark(r.zone, s0, s1, z0, z1, fill, 4, what, r);
    const T = (s0, s1, fill, what) => { const a = Math.max(s0, r.s0), b = Math.min(s1, r.s1); if (b - a > 1e-3) marks.push({ zone: r.zone, s0: r3(a), s1: r3(b), z0: r3(r.z1), z1: r3(r.z1), fill, layer: 4, what, top: true }); };
    const segs = [];
    if (fam === 'rock') { const R = SIDE_CAP.rock, sum = R.reduce((a, b) => a + b, 0); let u = Math.floor(r.s0 / sum) * sum, k = 0; while (u < r.s1) { segs.push([u, u + R[k % R.length], k]); u += R[k % R.length]; k++; } }
    else { const m = SIDE_CAP.module[fam], o = fam === 'built' ? m / 2 : 0; for (let u = Math.floor((r.s0 - o) / m) * m + o, k = Math.floor((r.s0 - o) / m); u < r.s1; u += m, k++) segs.push([u, u + m, k]); }
    const cycle = SIDE_CAP.cycle[fam];
    for (const [a, b, k] of segs) {
      const t = tone[cycle[((k % cycle.length) + cycle.length) % cycle.length]], jw = fam === 'machine' ? 0.08 : fam === 'padded' ? 0.1 : 0.05;
      C(a, b, r.z1 - CAP, r.z1, t, 'cap');
      C(a, a + jw, r.z1 - CAP, r.z1, joint, 'cap-joint');
      C(a, b, r.z1 - 0.06, r.z1, shine, 'cap-shine');
      T(a, b, mix(t, shine, 0.3), 'cap-top'); T(a, a + jw, joint, 'cap-top-joint');
      if (fam === 'machine') for (const u of [a + 0.25, b - 0.35]) C(u, u + 0.1, r.z1 - CAP / 2 - 0.05, r.z1 - CAP / 2 + 0.05, joint, 'cap-rivet');
      if (fam === 'padded') C(a + 0.15, b - 0.15, r.z1 - CAP + 0.08, r.z1 - 0.12, mix(t, shine, 0.35), 'cap-cushion');
      if (fam === 'rock' && k % 3 === 0) C(a + 0.05, a + 0.22, r.z1 - 0.16, r.z1 - 0.06, joint, 'cap-chip');
    }
    // (a pier cap where a back wall's pillar stands: the floor answers the wall's rhythm)
    if (fam === 'built') for (const p of z.pillars ?? []) if (p > r.s0 + 0.5 && p < r.s1 - 0.5) { C(p - 0.45, p + 0.45, r.z1 - CAP - 0.12, r.z1, shine, 'cap-pier'); C(p - 0.45, p - 0.4, r.z1 - CAP - 0.12, r.z1, joint, 'cap-joint'); C(p + 0.4, p + 0.45, r.z1 - CAP - 0.12, r.z1, joint, 'cap-joint'); T(p - 0.45, p + 0.45, shine, 'cap-top'); }
    // (a machine's lip at a pit: a hazard band, its stripes the zone's own dark and light)
    if (fam === 'machine') for (const g of pits.filter((g) => g.zone === r.zone)) {
      const end = Math.abs(g.s0 - r.s1) < 1e-3 ? r.s1 : Math.abs(g.s1 - r.s0) < 1e-3 ? r.s0 : null;
      if (end === null) continue;
      const a = end === r.s1 ? end - 1.2 : end;
      for (let u = a, k = 0; u < a + 1.2 - 1e-6; u += 0.3, k++) C(u, u + 0.3, r.z1 - CAP, r.z1 - 0.06, k % 2 ? joint : shine, 'cap-hazard');
    }
  }
  // THE JAMB: every wall a hero kicks off or runs into (a face of a closed part, a body tall or more, standing on open
  // space: a shaft's walls, a chute's, a room's) is the cap turned on its side, so the walls and the floors are one
  // terrain: a band down its edge on the front, and its face into the open (the kicking surface itself, seen aslant),
  // cut on the fill's own module on the level's own grid (built quoins, long and short in turn; machine plates with
  // their seams and rivets; padded cushions; rock slabs on one rhythm), in the cap's tones and joints and its lit edge.
  // CHUNKY: the edge steps in and out on that rhythm (a notch the open space shows through, never past the plane the
  // hero kicks off: the climb is the collider's, untouched), a string course every few courses as a floor has its pier
  // caps, and under each rest a bracket in the wall's own matter
  for (const W0 of wallSurfaces(L)) {
    const r = W0.solid, z = dress.zones[r.zone], fam = z.family, J = SIDE_JAMB, e = W0.e, dir = W0.dir;
    const ic = icingOf(z.material, z, mix);
    const tone = ic?.tone ?? [mix(z.edge, z.key, 0.4), mix(z.edge, z.key, 0.2), mix(z.edge, z.key, 0.55)], joint = ic?.joint ?? mix(z.key, '#000000', 0.45), shine = ic?.shine ?? z.edge, hole = mix(z.void, z.key, 0.15);
    const band = (w) => (dir > 0 ? [e - w, e] : [e, e + w]);
    const C = (w, z0, z1, fill, what) => { const [a, b] = band(w); mark(r.zone, a, b, z0, z1, fill, 4, what, r); };
    const S = (z0, z1, fill, what) => { const a = Math.max(z0, W0.z0), b = Math.min(z1, W0.z1); if (b - a > 1e-3) marks.push({ zone: r.zone, s0: r3(e), s1: r3(e), z0: r3(a), z1: r3(b), fill, layer: 4, what, side: dir > 0 ? 'py' : 'ny' }); };
    // the courses up the wall, on the level's grid
    const segs = [];
    if (fam === 'rock') { const R = J.rock, sum = R.reduce((a, b) => a + b, 0); let u = Math.floor(W0.z0 / sum) * sum, k = 0; while (u < W0.z1) { segs.push([u, u + R[k % R.length], k]); u += R[k % R.length]; k++; } }
    else { const m = J.module[fam]; for (let u = Math.floor(W0.z0 / m) * m, k = Math.floor(W0.z0 / m); u < W0.z1; u += m, k++) segs.push([u, u + m, k]); }
    for (const [a, b, k] of segs) {
      const kk = ((k % 1000) + 1000) % 1000, t = tone[J.cycle[fam][kk % J.cycle[fam].length]], w = J.width[fam][kk % J.width[fam].length], jh = fam === 'machine' ? 0.08 : fam === 'padded' ? 0.1 : 0.05;
      C(w, a, b, t, 'jamb'); C(w, a, a + jh, joint, 'jamb-joint'); C(0.06, a, b, shine, 'jamb-shine');
      S(a, b, mix(t, joint, 0.15), 'jamb-face'); S(a, a + jh, joint, 'jamb-face-joint');
      if (fam === 'machine') C(0.1, (a + b) / 2 - 0.05, (a + b) / 2 + 0.05, joint, 'jamb-rivet');
      if (fam === 'padded') C(w - 0.12, a + 0.12, b - 0.12, mix(t, shine, 0.35), 'jamb-cushion');
      // (chunky: a notch the open shows through, on the fill's rhythm, never past the plane the hero kicks off)
      const d = J.notch[fam][kk % J.notch[fam].length];
      if (d > 0) { const [na, nb] = band(d); marks.push({ zone: r.zone, s0: r3(Math.max(na, r.s0)), s1: r3(Math.min(nb, r.s1)), z0: r3(Math.max(a + jh, W0.z0)), z1: r3(Math.min(b, W0.z1)), fill: hole, layer: 5, what: 'jamb-notch' }); }
      // (a string course every few courses: the wall's beat, as a floor's pier caps are its)
      if (kk % J.string[fam] === 0) { C(Math.min(0.7, w + 0.25), b - 0.1, b, shine, 'jamb-string'); S(b - 0.1, b, shine, 'jamb-face-string'); }
    }
  }
  // (under each rest against a wall, a bracket in the wall's matter: the ledge is held, not hung)
  for (const q of L.solids.filter((x) => x.role === 'rest')) {
    const w = L.solids.find((x) => x.role === 'wall' && x.zone === q.zone && (Math.abs(x.s1 - q.s0) < 0.02 || Math.abs(x.s0 - q.s1) < 0.02) && x.z0 < q.z1 && x.z1 > q.z0 - 0.5);
    if (!w) continue;
    const z = dress.zones[q.zone], at = Math.abs(w.s1 - q.s0) < 0.02 ? q.s0 : q.s1, out = at === q.s0 ? 1 : -1, t = mix(z.edge, z.key, 0.4), joint = mix(z.key, '#000000', 0.45);
    const rect = (w0, z0, z1, fill, what) => { const [a, b] = out > 0 ? [at, at + w0] : [at - w0, at]; marks.push({ zone: q.zone, s0: r3(a), s1: r3(b), z0: r3(z0), z1: r3(z1), fill, layer: 4, what }); };
    rect(0.7, q.z0 - 0.26, q.z0, t, 'bracket'); rect(0.4, q.z0 - 0.5, q.z0 - 0.26, t, 'bracket'); rect(0.7, q.z0 - 0.3, q.z0 - 0.26, joint, 'bracket-joint');
  }
  // the threads: under each run's way, up a shaft's far wall, down a chute's near wall, joined zone to zone
  const kind = dress.threads[0]?.kind ?? 'pipes', path = [];
  for (const Z of L.zones) {
    const [es, ez] = Z.i ? L.zones[Z.i - 1].exit : [0, 0], [xs, xz] = Z.exit, o = L.open.find((r) => r.zone === Z.i);
    if (Z.run === 'up') path.push([es - BESIDE, ez - UNDER], [o ? o.s1 + BESIDE : xs + BESIDE, ez - UNDER], [o ? o.s1 + BESIDE : xs + BESIDE, xz - UNDER]);
    else if (Z.drop === 'chute' && o) path.push([o.s0 - BESIDE, ez - UNDER], [o.s0 - BESIDE, xz - UNDER]);
    else path.push([es, Math.min(ez, xz) - UNDER], [xs, Math.min(ez, xz) - UNDER]);
  }
  const P = path.filter((p, k) => !k || p[0] !== path[k - 1][0] || p[1] !== path[k - 1][1]).map((p) => p.map(r3));
  const [tone, k] = THREAD_TONE[kind] ?? THREAD_TONE.pipes;
  for (let n = 1; n < P.length; n++) {
    const [a, b] = [P[n - 1], P[n]], horiz = Math.abs(a[1] - b[1]) < 1e-6;
    const seg = horiz ? [Math.min(a[0], b[0]), Math.max(a[0], b[0]), a[1] - THREAD / 2, a[1] + THREAD / 2] : [a[0] - THREAD / 2, a[0] + THREAD / 2, Math.min(a[1], b[1]), Math.max(a[1], b[1])];
    // (a step from one height to the next joined by a riser at its end)
    const parts = horiz || Math.abs(a[0] - b[0]) < 1e-6 ? [seg] : [[Math.min(a[0], b[0]), Math.max(a[0], b[0]), a[1] - THREAD / 2, a[1] + THREAD / 2], [b[0] - THREAD / 2, b[0] + THREAD / 2, Math.min(a[1], b[1]), Math.max(a[1], b[1])]];
    for (const [s0, s1, z0, z1] of parts) L.solids.forEach((r) => mark(r.zone, s0, s1, z0, z1, mix(tone, dress.zones[r.zone].key, k), 3, kind, r));
  }
  return { marks, slices, threads: [{ kind, path: P }] };
}

/**
 * THE BACKDROP an outdoor zone stands in front of, by the height it stands at on the map (dress `backdrop`): at the
 * foot the near hills and the far range in the frame, higher up the hills fallen out of it and the range lower, at the
 * top only sky over a low horizon. Each layer stands at its depth (`x`, behind the lane) and is sized so the side map's
 * camera sees it where the frame should (a far thing is drawn as big as it must be to be seen at that share of the
 * frame), and wide enough to fill the frame wherever along the zone the camera stands.
 *   backdropOf(layout, dress, { seed? }) → [{ zone, layer: 'hills' | 'range', x, rects: [{ s0, s1, z0, z1 }], haze }]
 */
export const BACKDROP = Object.freeze({
  hills: Object.freeze({ x: -28, haze: 0.45, crest: { land: 0.22 }, bump: [5, 11], rise: 0.07 }),
  range: Object.freeze({ x: -95, haze: 0.7, crest: { land: 0.5, hills: 0.16, sky: -0.18 }, bump: [12, 26], rise: 0.12 }),
});
export function backdropOf(layout, dress, { seed = 1 } = {}) {
  const L = layout, W = L.screen.width, H = L.screen.height, C = L.camera, out = [];
  for (const z of dress.zones) {
    if (z.indoor || !z.backdrop) continue;
    const Z = L.zones[z.zone], lane = (Z.i ? L.zones[Z.i - 1].exit : [0, 0])[1], zc = lane + C.lookH;
    for (const [layer, B] of Object.entries(BACKDROP)) {
      const u = B.crest[z.backdrop];
      if (u === undefined) continue;
      const f = (C.dist - B.x) / C.dist, d = streamOf(seed, 'side-map-backdrop', `${z.zone}-${layer}`);
      // (wide enough for anywhere along the zone the camera stands; cut where the next outdoor zone's layer begins, at the
      // middle between the two, so no two layers stand at one depth over each other: they would flicker)
      let s0 = Z.rect[0] + W / 2 - (W / 2) * f - 2, s1 = Z.rect[1] - W / 2 + (W / 2) * f + 2;
      const prev = [...dress.zones].reverse().find((y) => y.zone < z.zone && !y.indoor && y.backdrop && B.crest[y.backdrop] !== undefined);
      const next = dress.zones.find((y) => y.zone > z.zone && !y.indoor && y.backdrop && B.crest[y.backdrop] !== undefined);
      if (prev) s0 = Math.max(s0, (L.zones[prev.zone].rect[1] + Z.rect[0]) / 2);
      if (next) s1 = Math.min(s1, (Z.rect[1] + L.zones[next.zone].rect[0]) / 2);
      const foot = zc - H * f;
      const at = (v) => zc + (lane + v * H - zc) * f, rects = [];
      for (let s = s0; s < s1; ) { const w = (B.bump[0] + (B.bump[1] - B.bump[0]) * d()) * f, top = at(u + B.rise * (d() - 0.5)); rects.push({ s0: r3(s), s1: r3(Math.min(s1, s + w)), z0: r3(foot), z1: r3(top) }); s += w; }
      out.push({ zone: z.zone, layer, x: B.x, rects, haze: B.haze });
    }
  }
  return out;
}
