/**
 * rock-minerals — the lattice half of a rock (rock-formation.plan.md R1). A mineral's unit cell and point group fix a
 * finite set of plane orientations: where it CLEAVES (breaks flat) and where it GROWS (habit faces). An angle has no
 * size, so these are what a crystal carries from the atom to the outcrop; the grain size and the fracture law, which
 * DO have scale, live in rock-fracture.js.
 *
 * Frame: mojulo's, z up. Direct basis: a along x, b in the xy plane, c completes — so a hexagonal c axis is z and a
 * monoclinic unique b axis is y. Plane normals come from the reciprocal basis: n(hkl) ∝ h·a* + k·b* + l·c*.
 * Miller–Bravais (h k i l) is accepted and reduced to (h k l).
 *
 * The derived angles are pinned against the textbook values in rock-minerals.test.js (calcite's rhomb 74.94° /
 * 105.06°, quartz's r face 51.79° from c, albite's 86.38°, orthoclase's 90°, augite's ≈87°, hornblende's ≈56°).
 *
 * Import-free on purpose: pure math and data, so the same module can ride a recipe-book builder unchanged.
 * No dice, no clock.
 */

const DEG = Math.PI / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mmul = (A, B) => A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
const apply = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];

/** Direct basis vectors of a cell `{ a, b?, c?, alpha?, beta?, gamma? }` (Å, degrees). */
export function directBasis({ a, b = a, c = a, alpha = 90, beta = 90, gamma = 90 }) {
  const ca = Math.cos(alpha * DEG), cb = Math.cos(beta * DEG), cg = Math.cos(gamma * DEG), sg = Math.sin(gamma * DEG);
  const cx = c * cb, cy = c * (ca - cb * cg) / sg;
  return [[a, 0, 0], [b * cg, b * sg, 0], [cx, cy, Math.sqrt(c * c - cx * cx - cy * cy)]];
}
export function reciprocalBasis([A, B, C]) {
  const V = dot(A, cross(B, C));
  return [scale(cross(B, C), 1 / V), scale(cross(C, A), 1 / V), scale(cross(A, B), 1 / V)];
}
function hkl3(m) {
  if (m.length === 4) { if (m[2] !== -(m[0] + m[1])) throw new Error(`rock-minerals: (${m.join(' ')}) is not Miller–Bravais: i must equal -(h+k)`); return [m[0], m[1], m[3]]; }
  return m;
}
/** Unit normal of the plane (hkl) or (hkil) of a cell, in the frame above. */
export function planeNormal(cell, m) {
  const [h, k, l] = hkl3(m); const [as, bs, cs] = reciprocalBasis(directBasis(cell));
  return unit(add(add(scale(as, h), scale(bs, k)), scale(cs, l)));
}
export const angleDeg = (u, v) => Math.acos(Math.max(-1, Math.min(1, dot(unit(u), unit(v))))) / DEG;

// ─── point groups: closure of Cartesian generators ───────────────────────────────────────────────────────────
const Rz = (t) => [[Math.cos(t), -Math.sin(t), 0], [Math.sin(t), Math.cos(t), 0], [0, 0, 1]];
const Rx = (t) => [[1, 0, 0], [0, Math.cos(t), -Math.sin(t)], [0, Math.sin(t), Math.cos(t)]];
const Ry = (t) => [[Math.cos(t), 0, Math.sin(t)], [0, 1, 0], [-Math.sin(t), 0, Math.cos(t)]];
const INV = [[-1, 0, 0], [0, -1, 0], [0, 0, -1]];
export const POINT_GROUP_GENERATORS = Object.freeze({
  'm-3m': [Rz(Math.PI / 2), [[0, 0, 1], [1, 0, 0], [0, 1, 0]], INV],   // cubic: halite, garnet
  '32': [Rz(2 * Math.PI / 3), Rx(Math.PI)],                           // quartz (no centre)
  '-3m': [Rz(2 * Math.PI / 3), Rx(Math.PI), INV],                      // calcite
  mmm: [Rx(Math.PI), Ry(Math.PI), INV],                               // orthorhombic: olivine
  '2/m': [Ry(Math.PI), INV],                                           // monoclinic, b unique: micas, feldspar, augite, hornblende
  '-1': [INV],                                                         // triclinic: albite
});
const groupCache = new Map();
export function pointGroup(name) {
  if (groupCache.has(name)) return groupCache.get(name);
  const gens = POINT_GROUP_GENERATORS[name]; if (!gens) throw new Error(`rock-minerals: unknown point group '${name}'`);
  const key = (M) => M.flat().map((x) => Math.round(x * 1e6)).join(',');
  const I = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]; const seen = new Map([[key(I), I]]); const queue = [I];
  while (queue.length) { const M = queue.shift(); for (const G of gens) { const P = mmul(G, M); const k = key(P); if (!seen.has(k)) { seen.set(k, P); queue.push(P); } } }
  const out = Object.freeze([...seen.values()]); groupCache.set(name, out); return out;
}
/** All symmetry-equivalent unit normals of the form {hkl}. */
export function formNormals(mineral, hkl) {
  const m = mineralOf(mineral); const n = planeNormal(m.cell, hkl); const out = [];
  for (const M of pointGroup(m.group)) { const v = unit(apply(M, n)); if (!out.some((o) => dot(o, v) > 1 - 1e-6)) out.push(v); }
  return out;
}

// ─── the table ───────────────────────────────────────────────────────────────────────────────────────────────
// Cells: standard room-temperature values (Å, °). Cleavage `q` is how readily a chip takes that plane (perfect ≈ 0.95,
// good ≈ 0.6–0.85, poor ≈ 0.25); none → the mineral breaks conchoidally. `color` is a representative hand-sample tone.
export const MINERALS = Object.freeze({
  quartz: { formula: 'SiO2', system: 'trigonal', group: '32', cell: { a: 4.9137, c: 5.4047, gamma: 120 }, cleavage: [], color: '#d5d2cd',
    linkage: 'framework: every SiO4 tetrahedron shares all four corners; equal bonds every way, so no cleavage' },
  orthoclase: { formula: 'KAlSi3O8', system: 'monoclinic', group: '2/m', cell: { a: 8.56, b: 12.96, c: 7.21, beta: 116.0 }, color: '#d69f86',
    cleavage: [{ hkl: [0, 0, 1], q: 0.85 }, { hkl: [0, 1, 0], q: 0.6 }], linkage: 'framework of four-rings; weaker across (001) and (010), two cleavages at 90°' },
  albite: { formula: 'NaAlSi3O8', system: 'triclinic', group: '-1', cell: { a: 8.137, b: 12.785, c: 7.158, alpha: 94.26, beta: 116.60, gamma: 87.71 }, color: '#ebe7de',
    cleavage: [{ hkl: [0, 0, 1], q: 0.85 }, { hkl: [0, 1, 0], q: 0.6 }], linkage: 'the feldspar framework tilted off-monoclinic: plagio-clase, the oblique break' },
  muscovite: { formula: 'KAl2(AlSi3O10)(OH)2', system: 'monoclinic', group: '2/m', cell: { a: 5.19, b: 9.03, c: 20.10, beta: 95.8 }, color: '#cdc4a3',
    cleavage: [{ hkl: [0, 0, 1], q: 0.98 }], linkage: 'sheets: tetrahedra share three corners; T-O-T layers held by weak K+' },
  biotite: { formula: 'K(Mg,Fe)3(AlSi3O10)(OH)2', system: 'monoclinic', group: '2/m', cell: { a: 5.33, b: 9.23, c: 10.23, beta: 100.2 }, color: '#2c2521',
    cleavage: [{ hkl: [0, 0, 1], q: 0.98 }], linkage: 'sheets, as muscovite, with Mg/Fe in the octahedral layer' },
  augite: { formula: '(Ca,Na)(Mg,Fe,Al)(Si,Al)2O6', system: 'monoclinic', group: '2/m', cell: { a: 9.73, b: 8.89, c: 5.25, beta: 105.9 }, color: '#2f302c',
    cleavage: [{ hkl: [1, 1, 0], q: 0.8 }], linkage: 'single chains (pyroxene): two cleavages between the chains, near 87° and 93°' },
  hornblende: { formula: 'Ca2(Mg,Fe,Al)5(Al,Si)8O22(OH)2', system: 'monoclinic', group: '2/m', cell: { a: 9.87, b: 18.05, c: 5.31, beta: 105.1 }, color: '#1f2620',
    cleavage: [{ hkl: [1, 1, 0], q: 0.9 }], linkage: 'double chains (amphibole): wider chains, so the two cleavages meet near 56° and 124°' },
  olivine: { formula: '(Mg,Fe)2SiO4', system: 'orthorhombic', group: 'mmm', cell: { a: 4.76, b: 10.20, c: 5.98 }, color: '#6b7a3c',
    cleavage: [{ hkl: [0, 1, 0], q: 0.25 }], linkage: 'isolated tetrahedra locked by Mg/Fe octahedra; poor cleavage, mostly conchoidal' },
  calcite: { formula: 'CaCO3', system: 'trigonal', group: '-3m', cell: { a: 4.990, c: 17.062, gamma: 120 }, color: '#efebe2',
    cleavage: [{ hkl: [1, 0, -1, 4], q: 0.95 }], linkage: 'NaCl-like packing of Ca and flat CO3 triangles squashed along the 3-fold: the cleavage rhomb' },
  halite: { formula: 'NaCl', system: 'cubic', group: 'm-3m', cell: { a: 5.640 }, color: '#e8e2d8',
    cleavage: [{ hkl: [1, 0, 0], q: 0.95 }], linkage: 'ionic packing: NaCl6 octahedra sharing edges; cleaves into cubes at every size' },
});
function mineralOf(name) { const m = MINERALS[name]; if (!m) throw new Error(`rock-minerals: unknown mineral '${name}' (have ${Object.keys(MINERALS).join(', ')})`); return m; }

const cleavageCache = new Map();
/** One unit normal per cleavage PLANE of a mineral (± is the same plane), crystal frame, with its quality. */
export function cleavageNormals(name) {
  if (cleavageCache.has(name)) return cleavageCache.get(name);
  const m = mineralOf(name); const out = [];
  for (const c of m.cleavage) for (const n of formNormals(name, c.hkl)) if (!out.some((o) => Math.abs(dot(o.n, n)) > 1 - 1e-6)) out.push({ n, q: c.q });
  const frozen = Object.freeze(out); cleavageCache.set(name, frozen); return frozen;
}

// ─── rocks: a modal mix, a grain size (m), an optional fabric, optional tone overrides ─────────────────────────
// `fabric.normal` aligns every grain's c axis (mica's cleavage pole) to it within `scatterDeg`: slate's cleavage.
export const ROCK_PRESETS = Object.freeze({
  granite: { modes: [['quartz', 0.30], ['orthoclase', 0.35], ['albite', 0.25], ['biotite', 0.10]], grain: 0.005 },
  slate: { modes: [['muscovite', 0.55], ['quartz', 0.30], ['biotite', 0.15]], grain: 0.0003, fabric: { normal: [0.75, 0.433, 0.5], scatterDeg: 8 },
    colors: { muscovite: '#5d6468', quartz: '#6b7074', biotite: '#3f4549' } },
  marble: { modes: [['calcite', 1]], grain: 0.003 },
  quartzite: { modes: [['quartz', 1]], grain: 0.002, colors: { quartz: '#d9d2c6' } },
  basalt: { modes: [['albite', 0.5], ['augite', 0.35], ['olivine', 0.15]], grain: 0.0004, colors: { albite: '#8b8b86', augite: '#2a2a28', olivine: '#56613a' } },
});
export const ROCK_PRESET_IDS = Object.freeze(Object.keys(ROCK_PRESETS));

/** A rock spec's `rock` (preset id or `{ modes, grain, fabric?, colors? }`) → the resolved rock, or throws a teaching error. */
export function resolveRock(rock) {
  const r = typeof rock === 'string' ? ROCK_PRESETS[rock] : rock;
  if (!r) throw new Error(`rock: unknown preset '${rock}' (have ${ROCK_PRESET_IDS.join(', ')}, or give { modes:[[mineral, share], …], grain })`);
  return r;
}
/** A rock's modal mean colour, [r, g, b] 0–255: each mineral's colour (the rock's own override first) weighted by its share. */
export function rockMeanRgb(rock) {
  const r = resolveRock(rock); let tot = 0; const out = [0, 0, 0];
  for (const [m, f] of r.modes) { const h = (r.colors?.[m] ?? MINERALS[m].color).replace('#', ''); for (let k = 0; k < 3; k++) out[k] += f * parseInt(h.slice(2 * k, 2 * k + 2), 16); tot += f; }
  return out.map((v) => v / tot);
}
/** Errors (strings) for a `rock` value; [] when it resolves. */
export function validateRockMix(rock, at = 'rock') {
  if (typeof rock === 'string') return ROCK_PRESETS[rock] ? [] : [`${at}: unknown preset '${rock}' (have ${ROCK_PRESET_IDS.join(', ')})`];
  const e = [];
  if (!rock || typeof rock !== 'object') return [`${at}: a preset id (${ROCK_PRESET_IDS.join(', ')}) or { modes, grain }`];
  if (!Array.isArray(rock.modes) || !rock.modes.length) e.push(`${at}.modes: [[mineral, share], …] with at least one mineral`);
  else for (const [i, m] of rock.modes.entries()) {
    if (!Array.isArray(m) || !MINERALS[m[0]] || !(Number.isFinite(m[1]) && m[1] > 0)) e.push(`${at}.modes[${i}]: [mineral, share>0] with mineral one of ${Object.keys(MINERALS).join(', ')}`);
  }
  if (!(Number.isFinite(rock.grain) && rock.grain > 0)) e.push(`${at}.grain: the mean grain size in metres, > 0`);
  if (rock.fabric != null && !(Array.isArray(rock.fabric.normal) && rock.fabric.normal.length === 3 && rock.fabric.normal.every(Number.isFinite) && Math.hypot(...rock.fabric.normal) > 0)) e.push(`${at}.fabric.normal: [x,y,z], non-zero`);
  return e;
}
