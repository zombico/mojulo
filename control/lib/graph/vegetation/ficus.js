// vegetation/ficus — the figs of a tropical forest: what a fig adds to a grown broadleaf is below its crown.
//
// The crown is the engine's own (an evergreen Rauh or Troll row: F. benjamina is Troll's model, F. aurea Rauh's). What
// makes a fig read as a fig is three root forms, each a small mechanism over the grown plant:
//   · AERIAL ROOTS (the banyan): grown by the engine (`arch.aerial`, grow.js): they hang from near-horizontal limbs as
//     plumb lines, 4–10 mm across, and on landing take pipes and load from the limb (a guy-cable first, in tension wood,
//     then a pillar that thickens as a new water path: Zimmermann, Wardrop & Tomlinson 1968). The pillars carry the
//     pipes, so the first trunk thins among them.
//   · THE LATTICE (the strangler): roots run down a host's trunk and graft where they cross (inosculation), closing into
//     a lattice round a host that dies and rots: a hollow column under a fig crown (Putz & Holbrook 1989). Drawn as two
//     families of helices of opposite hand, the palm's parastichies again, over a dark core.
//   · BUTTRESSES (the rubber fig, and most big figs): plank fins that give most of a shallow-rooted tree's anchorage,
//     working in tension windward and in compression leeward (Crook, Ennos & Banks 1997); the biggest stand on the side
//     away from the crown's lean.
// Economy, by the tree's own rulers: a hanging root is a straight segment, cut by the ladder's diameter rule like a twig;
// past that cut a curtain of them is a turbid sheet (one dark ribbon per cell, as foliage becomes a blob); the lattice and
// fins exist only at the near levels, and far off the column is a cylinder.
// Deterministic: mulberry32 dice from the plant's seed.
import { ARCHITECTURES, mulberry32, vec } from './grow.js';
import { tubeTris, barkQuads } from './tree-mesh.js';
import { mix } from './util.js';
import * as dmath from '../../util/dmath.js';

const { add, mul } = vec;
const TONE = { root: [132, 104, 80], rootLit: [156, 128, 100], pillar: [118, 112, 104], core: [58, 46, 36], lattice: [128, 120, 108], fin: [120, 114, 106] };

/**
 * The fig rows: an architecture (a row of grow.js's table, made evergreen with a fig's leaf) and its look below the
 * crown (`fig`): `roots` (the engine's aerial roots are drawn), `lattice` (a strangler's column to the crown base),
 * `buttress` ({ n, h: height over the trunk's diameter }).
 */
export const FIGS = Object.freeze({
  // Ficus benghalensis: a spreading Rauh crown, limbs near horizontal, dropping roots that land and become pillars
  banyan: { ...ARCHITECTURES.rauh, label: 'banyan (Ficus benghalensis)', leafLife: 3, leafSize: 0.16, leavesPerNode: 3, setPoint: [0, 62, 72, 80], insertion: [55, 60, 60],
    aerial: { rate: 0.06, share: 0.7 }, fig: { roots: true, buttress: { n: 3, h: 1.2 } } },
  // a strangler (F. aurea, F. watkinsiana): an open-grown crown over its root lattice (a stand would lift the crown, but
  // starves it: a clear bole costs the engine's crown most of its leaves), emergent by its height range
  strangler: { ...ARCHITECTURES.rauh, label: 'strangler fig (Ficus aurea)', leafLife: 3, leafSize: 0.12, leavesPerNode: 3,
    fig: { lattice: true, buttress: { n: 5, h: 1.6 } } },
  // F. elastica / F. macrophylla: a big-leaved Troll crown on plank buttresses, a few roots hanging from the limbs
  rubberfig: { ...ARCHITECTURES.troll, label: 'rubber fig (Ficus elastica)', leafLife: 3, leafSize: 0.24,
    aerial: { rate: 0.03, drop: 0.4, max: 24 }, fig: { roots: true, buttress: { n: 6, h: 2.2 } } },
});

const vertical = (top, z0, r0, r1) => ({ pts: [[top[0], top[1], z0], top], rs: [r0, r1], continues: true, dMax: 2 * Math.max(r0, r1) });

/** The aerial roots as chains: a landed one a pillar from the ground to its limb, a hanging one a strand of its length. */
export function rootChains(plant) {
  const out = [];
  for (const q of plant.roots || []) {
    const n = plant.nodes[q.node]; if (n.died) continue;
    if (q.landed) out.push({ ...vertical(n.pos, 0, q.r, Math.max(n.r, 0.7 * q.r)), landed: true });
    else out.push({ ...vertical(n.pos, n.pos[2] - q.len, q.r, q.r), landed: false, continues: false });
  }
  return out;
}

/** Hanging roots past the diameter cut: per cell of size c, one dark ribbon as wide as the roots cover (Beer–Lambert). */
function rootCurtains(hanging, c) {
  const cells = new Map();
  for (const ch of hanging) {
    const top = ch.pts[1]; const k = `${Math.floor(top[0] / c)},${Math.floor(top[1] / c)}`;
    if (!cells.has(k)) cells.set(k, { x: 0, y: 0, top: 0, bot: 0, n: 0, x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, w: 0 });
    const g = cells.get(k); g.x += top[0]; g.y += top[1]; g.top += top[2]; g.bot += ch.pts[0][2]; g.n++; g.w += 2 * ch.rs[0];
    g.x0 = Math.min(g.x0, top[0]); g.x1 = Math.max(g.x1, top[0]); g.y0 = Math.min(g.y0, top[1]); g.y1 = Math.max(g.y1, top[1]);
  }
  const tris = [];
  for (const g of [...cells.values()].sort((a, b) => a.x - b.x || a.y - b.y)) {
    const m = [g.x / g.n, g.y / g.n]; const spread = Math.max(g.x1 - g.x0, g.y1 - g.y0, 0.3);
    // the ribbon covers what its strands would: their summed width, never more than the spread they hang across
    const w = Math.min(spread, Math.max(0.08, 4 * g.w)); const along = g.x1 - g.x0 >= g.y1 - g.y0 ? [1, 0, 0] : [0, 1, 0];
    const top = g.top / g.n, bot = g.bot / g.n; const a = add([m[0], m[1], 0], mul(along, -w / 2)), b = add([m[0], m[1], 0], mul(along, w / 2));
    const p = [[a[0], a[1], top], [b[0], b[1], top], [b[0], b[1], bot], [a[0], a[1], bot]];
    tris.push({ p: [p[0], p[1], p[2]], c: TONE.root, kind: 'wood' }, { p: [p[0], p[2], p[3]], c: TONE.root, kind: 'wood' });
  }
  return tris;
}

/**
 * The strangler's column from the ground to `top`: `strands` helices of each hand, radius R, grafted where they cross,
 * round a dark core (the host's rotted heart shows through the holes).
 */
export function latticeTris(base, R, top, { strands = 6, turns = null, sides = 4, segs = 14, seed = 1 } = {}) {
  // the roots run mostly down (under a turn over the column), so the grafts close tall diamonds, not a coil
  const rng = mulberry32((seed * 2654435761 + 17) >>> 0); const tris = []; const t = turns ?? Math.min(0.9, Math.max(0.35, top / (30 * R)));
  const core = { pts: [[base[0], base[1], 0], [base[0], base[1], top]], rs: [0.84 * R, 0.8 * R], continues: true, dMax: 1.7 * R };
  for (const x of tubeTris(core, { sidesFor: () => 8, colorFor: () => TONE.core })) tris.push(x);
  for (const hand of [1, -1]) for (let s = 0; s < strands; s++) {
    const a0 = (2 * Math.PI * (s + 0.5 * (hand < 0))) / strands + 0.3 * (rng() - 0.5); const wob = 0.12 * rng();
    const pts = [], rs = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs, z = u * top, a = a0 + hand * 2 * Math.PI * t * u + wob * dmath.sin(9 * u + s);
      const rr = R * (1 + 0.35 * dmath.pow(1 - u, 3));                      // the column flares where the roots enter the soil
      pts.push([base[0] + rr * dmath.cos(a), base[1] + rr * dmath.sin(a), z]); rs.push(R * (0.26 + 0.2 * dmath.pow(1 - u, 2)));
    }
    for (const x of tubeTris({ pts, rs, continues: true }, { sidesFor: () => sides, colorFor: () => TONE.lattice })) tris.push(x);
  }
  return tris;
}

/**
 * Plank buttresses round a trunk of radius r at `base`: `n` fins, each a thin plank whose edge falls from height h at the
 * trunk to the ground at reach ≈ 1.4 h along a concave (exponential) profile. The biggest face away from `lean` (the
 * crown's offset), the tension side. → tris.
 */
export function buttressTris(base, r, h, { n = 5, lean = [0, 0], seed = 1, segs = 7 } = {}) {
  const rng = mulberry32((seed * 2246822519 + 5) >>> 0); const tris = []; const la = dmath.hypot(lean[0], lean[1]);
  const away = la > 1e-6 ? dmath.atan2(-lean[1], -lean[0]) : 0; const reach = 1.4 * h;
  for (let k = 0; k < n; k++) {
    const az = away + (2 * Math.PI * k) / n + 0.35 * (rng() - 0.5);
    const cosd = dmath.cos(az - away); const size = la > 1e-6 ? 0.6 + 0.4 * Math.max(0, cosd) + 0.15 * rng() : 0.75 + 0.3 * rng();
    const d = [dmath.cos(az), dmath.sin(az), 0], sd = [-dmath.sin(az), dmath.cos(az), 0]; const th = Math.max(0.04, 0.22 * r) * size;
    const H = h * size, L = reach * size; const edge = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs; const x = r * 0.7 + u * L; const z = H * (dmath.exp(-3.2 * u) - dmath.exp(-3.2)) / (1 - dmath.exp(-3.2));
      edge.push([x, z, th * (1 - 0.7 * u)]);
    }
    const at = (x, z, s) => add(add(base, mul(d, x)), add(mul(sd, s), [0, 0, z]));
    const c = mix(TONE.fin, TONE.pillar, 0.3 + 0.4 * rng());
    for (let i = 0; i < segs; i++) {
      const [x0, z0, t0] = edge[i], [x1, z1, t1] = edge[i + 1];
      for (const s of [1, -1]) {                                             // the two faces, ground to edge
        const q = [at(x0, 0, s * t0), at(x1, 0, s * t1), at(x1, z1, s * t1 * 0.5), at(x0, z0, s * t0 * 0.5)];
        tris.push({ p: [q[0], q[1], q[2]], c, kind: 'wood' }, { p: [q[0], q[2], q[3]], c, kind: 'wood' });
      }
      const e = [at(x0, z0, t0 * 0.5), at(x1, z1, t1 * 0.5), at(x1, z1, -t1 * 0.5), at(x0, z0, -t0 * 0.5)];   // the rounded edge
      tris.push({ p: [e[0], e[1], e[2]], c, kind: 'wood' }, { p: [e[0], e[2], e[3]], c, kind: 'wood' });
    }
  }
  return tris;
}

/** The crown's horizontal offset from the trunk: where its leaves' centroid sits (a buttress faces away from it). */
function crownLean(plant) {
  let x = 0, y = 0, w = 0; for (const n of plant.nodes) if (!n.died && n.leaves) { x += n.pos[0] * n.leaves; y += n.pos[1] * n.leaves; w += n.leaves; }
  return w ? [x / w, y / w] : [0, 0];
}

/**
 * The fig's parts at one level of the ladder (`plant.arch.fig`). Roots thicker than `dCut` are tubes (bark quads with
 * `bark`, when thick enough); thinner hanging roots become curtains of cell `cell` (none at `far`). The lattice and the
 * buttresses are drawn at the near levels (`near`); far off, the lattice is a plain column and the fins are dropped.
 */
export function figTris(plant, { dCut = 0, sidesMax = 10, cell = 1, near = true, far = false, bark = null } = {}) {
  const F = plant.arch.fig; if (!F) return [];
  const tris = []; const trunk = plant.nodes[1] || plant.nodes[0]; const r0 = trunk.r; const seed = plant.params.seed;
  const sidesFor = (r) => Math.min(sidesMax, r > 0.08 ? 8 : r > 0.03 ? 6 : r > 0.012 ? 4 : 3);
  if (F.roots) {
    const chains = rootChains(plant); const thin = [];
    for (const ch of chains) {
      if (ch.dMax < dCut) { if (!ch.landed) thin.push(ch); continue; }
      if (bark && ch.landed && near && ch.dMax >= 2 * bark.minR) { for (const t of barkQuads(ch, { sidesFor, tile: bark.tile, color: bark.color, key: bark.key })) tris.push(t); continue; }
      const c = ch.landed ? TONE.pillar : TONE.rootLit;
      for (const t of tubeTris(ch, { sidesFor, colorFor: () => c })) tris.push(t);
    }
    if (!far && thin.length) for (const t of rootCurtains(thin, cell)) tris.push(t);
  }
  if (F.lattice) {
    let crownBase = Infinity; for (const n of plant.nodes) if (!n.died && n.leaves && n.order > 0) crownBase = Math.min(crownBase, n.pos[2]);
    const H = plant.nodes.reduce((a, n) => (n.died ? a : Math.max(a, n.pos[2])), 0);
    const top = Math.max(0.35 * H, Number.isFinite(crownBase) ? crownBase : 0);   // limbs may leave from inside the lattice
    const R = Math.max(0.12, 1.5 * r0);
    if (near) for (const t of latticeTris(trunk.pos.slice(0, 2).concat(0), R, top, { strands: sidesMax >= 6 ? 6 : 4, sides: sidesMax >= 10 ? 5 : 3, segs: sidesMax >= 10 ? 18 : 10, seed })) tris.push(t);
    else for (const t of tubeTris({ pts: [[trunk.pos[0], trunk.pos[1], 0], [trunk.pos[0], trunk.pos[1], top]], rs: [1.2 * R, R], continues: true }, { sidesFor: () => (far ? 4 : 6), colorFor: () => mix(TONE.lattice, TONE.core, 0.35) })) tris.push(t);
  }
  if (F.buttress && near) {
    const base = [plant.nodes[0].pos[0], plant.nodes[0].pos[1], 0];
    for (const t of buttressTris(base, F.lattice ? Math.max(0.12, 1.5 * r0) : r0, F.buttress.h * 2 * r0 + 0.4, { n: F.buttress.n, lean: crownLean(plant).map((v, i) => v - base[i]), seed, segs: sidesMax >= 10 ? 7 : 4 })) tris.push(t);
  }
  return tris;
}
