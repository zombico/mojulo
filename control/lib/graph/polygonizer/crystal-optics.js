/**
 * crystal-optics — what a crystal does to light, as a table a renderer can read (crystal-shine S1).
 *
 * The lattice fixes more than a crystal's angles: its point group fixes the optical class (Neumann's principle: the
 * dielectric tensor must be invariant under the group — cubic → one index, a single 3/4/6-fold axis → two with the
 * optic axis on c), and its cell and habit fix where light enters and leaves. What the lattice does NOT fix rides
 * here as literature data: the indices (Sellmeier sets), the guest ions' absorption bands (Cr³⁺ in ruby, Fe in
 * amethyst and tourmaline), ruby's R-line glow, opal's sphere lattice.
 *
 * The renderer never integrates a spectrum. Everything spectral is folded at load into a small block per gem:
 *   - indices at three wavelengths (630 / 532 / 465 nm, the R/G/B a pixel shader refracts), ordinary and
 *     extraordinary: dispersion (fire) and birefringence in six numbers;
 *   - the colour white light keeps after a path, at four path lengths per ray (o and e): a thin ruby is pink and a
 *     thick one red, so colour is a function of path, not one tint (the crystal-light study's L5 finding: RGB
 *     Beer–Lambert is right at one path length only);
 *   - the glow (ruby: the share of absorbed light re-emitted at 694 nm, and its colour);
 *   - opal's photonic cell (the (111) spacing range and effective index: λ = 2·d·n·cosθ).
 * The spike (crystal-light) verified the numbers against a spectral, polarized photon tracer; the pins live in
 * crystal-optics.test.js.
 *
 * Frame: mojulo's, z up; a crystal's c axis is its local z. Pure: no dice, no clock; the only import is the lattice.
 */

import { planeNormal, pointGroup } from './rock-minerals.js';

const DEG = Math.PI / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const apply = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];

// ─── the eye: CIE 1931 2° (10 nm, 380–780) and D65, both linearly interpolated ─────────────────────────────
const CMF = [[0.001368, 0.000039, 0.00645], [0.004243, 0.00012, 0.02005], [0.01431, 0.000396, 0.06785], [0.04351, 0.00121, 0.2074],
  [0.13438, 0.004, 0.6456], [0.2839, 0.0116, 1.3856], [0.34828, 0.023, 1.74706], [0.3362, 0.038, 1.77211], [0.2908, 0.06, 1.6692],
  [0.19536, 0.09098, 1.28764], [0.09564, 0.13902, 0.81295], [0.03201, 0.20802, 0.46518], [0.0049, 0.323, 0.272], [0.0093, 0.503, 0.1582],
  [0.06327, 0.71, 0.07825], [0.1655, 0.862, 0.04216], [0.2904, 0.954, 0.0203], [0.43345, 0.99495, 0.00875], [0.5945, 0.995, 0.0039],
  [0.7621, 0.952, 0.0021], [0.9163, 0.87, 0.00165], [1.0263, 0.757, 0.0011], [1.0622, 0.631, 0.0008], [1.0026, 0.503, 0.00034],
  [0.85445, 0.381, 0.00019], [0.6424, 0.265, 0.00005], [0.4479, 0.175, 0.00002], [0.2835, 0.107, 0], [0.1649, 0.061, 0], [0.0874, 0.032, 0],
  [0.04677, 0.017, 0], [0.0227, 0.00821, 0], [0.011359, 0.004102, 0], [0.00579, 0.002091, 0], [0.002899, 0.001047, 0], [0.00144, 0.00052, 0],
  [0.00069, 0.000249, 0], [0.000332, 0.00012, 0], [0.000166, 0.00006, 0], [0.000083, 0.00003, 0], [0.000042, 0.000015, 0]];
const D65 = [49.98, 54.65, 82.75, 91.49, 93.43, 86.68, 104.86, 117.01, 117.81, 114.86, 115.92, 108.81, 109.35, 107.8, 104.79, 107.69, 104.41,
  104.05, 100, 96.33, 95.79, 88.69, 90.01, 89.6, 87.7, 83.29, 83.7, 80.03, 80.21, 82.28, 78.28, 69.72, 71.61, 74.35, 61.6, 69.89, 75.09, 63.59,
  46.42, 66.81, 63.38];
const lerpTable = (T, nm) => { const x = (nm - 380) / 10; if (x < 0 || x > 40) return null; const i = Math.min(39, Math.floor(x)), f = x - i; return [T[i], T[i + 1], f]; };
export function cie(nm) { const r = lerpTable(CMF, nm); if (!r) return [0, 0, 0]; const [a, b, f] = r; return [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * f); }
const d65 = (nm) => { const r = lerpTable(D65, nm); return r ? r[0] + (r[1] - r[0]) * r[2] : 0; };
export const xyzToLinearSrgb = ([X, Y, Z]) => [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
/** The linear-sRGB colour of a wavelength, scaled so its brightest channel is 1 (negative lobes clipped). */
export function wavelengthRgb(nm) { const L = xyzToLinearSrgb(cie(nm)).map((v) => Math.max(0, v)); const m = Math.max(...L) || 1; return L.map((v) => v / m); }

// ─── indices ──────────────────────────────────────────────────────────────────────────────────────────────
const sellmeier = (A, terms) => (nm) => { const L2 = (nm / 1000) ** 2; let n2 = A; for (const [B, C] of terms) n2 += (B * L2) / (L2 - C); return Math.sqrt(n2); };
const cauchy = (nD, bg) => { const B = bg / (1 / 0.4308 ** 2 - 1 / 0.6867 ** 2); const A = nD - B / 0.5893 ** 2; return (nm) => A + B / (nm / 1000) ** 2; };
const INDEX = {
  quartz: { o: sellmeier(1.28604141, [[1.07044083, 1.00585997e-2], [1.10202242, 100]]), e: sellmeier(1.28851804, [[1.09509924, 1.02101864e-2], [1.15662475, 100]]) },   // Ghosh 1999
  calcite: { o: sellmeier(1.73358749, [[0.96464345, 1.94325203e-2], [1.82831454, 120]]), e: sellmeier(1.35859695, [[0.8242783, 1.06689543e-2], [0.14429128, 120]]) },  // Ghosh 1999
  diamond: { o: sellmeier(1, [[0.3306, 0.175 ** 2], [4.3356, 0.106 ** 2]]) },                                                                                          // Peter 1923
  corundum: { o: sellmeier(1, [[1.4313493, 0.0726631 ** 2], [0.65054713, 0.1193242 ** 2], [5.3414021, 18.028251 ** 2]]),                                               // Malitson & Dodge 1972
    e: sellmeier(1, [[1.5039759, 0.0740288 ** 2], [0.55069141, 0.1216529 ** 2], [6.5927379, 20.072248 ** 2]]) },
  tourmaline: { o: cauchy(1.64, 0.017), e: cauchy(1.62, 0.017) },                                                                                                      // elbaite: nD and B–G
  opal: { o: cauchy(1.44, 0.008) },                                                                                                                                    // hydrated silica
};

// ─── the species: lattice (cell, point group, habit forms) and index set ────────────────────────────────────
// Habit `d` is a Wulff central distance: a recipe dial, not a prediction. Forms are Miller or Miller–Bravais.
export const CRYSTAL_SPECIES = Object.freeze({
  quartz: { group: '32', cell: { a: 4.9137, c: 5.4047, gamma: 120 }, habit: [{ hkl: [1, 0, -1, 0], d: 1 }, { hkl: [1, 0, -1, 1], d: 2.2 }, { hkl: [0, 1, -1, 1], d: 2.4 }] },
  calcite: { group: '-3m', cell: { a: 4.99, c: 17.062, gamma: 120 }, habit: [{ hkl: [1, 0, -1, 4], d: 1 }] },                                              // the cleavage rhomb (Iceland spar)
  diamond: { group: 'm-3m', cell: { a: 3.567 }, habit: [{ hkl: [1, 1, 1], d: 1 }] },                                                                    // the octahedron
  corundum: { group: '-3m', cell: { a: 4.759, c: 12.991, gamma: 120 }, habit: [{ hkl: [1, 1, -2, 0], d: 1 }, { hkl: [0, 0, 0, 1], d: 0.62 }, { hkl: [1, 0, -1, 1], d: 1.02 }] },   // a hexagonal barrel
  tourmaline: { group: '3m', cell: { a: 15.95, c: 7.14, gamma: 120 }, habit: [{ hkl: [1, 0, -1, 0], d: 0.3 }, { hkl: [1, 1, -2, 0], d: 0.33 }, { hkl: [1, 0, -1, 1], d: 1.25 }, { hkl: [0, 0, 0, -1], d: 1 }] },
  opal: { group: 'm-3m', cell: null, habit: null },                                                                                                    // amorphous at the atom: cut as a cabochon
});

// ─── absorption: Gaussian bands in wavenumber, per ray (1/cm). `red` / `blue`: the FWHM on each side (cm⁻¹) ─────
const band = ({ at, fwhm, red = fwhm, blue = fwhm, peak }) => { const nu0 = 1e7 / at; return (nm) => { const d = 1e7 / nm - nu0; const s = (d < 0 ? red : blue) / 2.3548; return peak * Math.exp(-0.5 * (d / s) ** 2); }; };
const bands = (list, base = 0) => { const fs = list.map(band); return (nm) => base + fs.reduce((a, f) => a + f(nm), 0); };
const clear = () => 0;

// ─── the gems: a species, a colour (absorption per ray), an optional glow, opal's photonic cell ─────────────
// Absorption is illustrative (band positions and shapes from the mineral-spectroscopy literature, strengths tuned so a
// 1 cm stone reads as the gem); the o ray is E ⟂ c (ruby's σ), the e ray E ∥ c (π).
const GEM_SPECS = {
  quartz: { species: 'quartz', o: clear, e: clear, tint: '#e9eef2' },                                                                     // rock crystal: the clear control
  amethyst: { species: 'quartz', o: bands([{ at: 545, fwhm: 4200, peak: 1.6 }, { at: 357, fwhm: 3000, peak: 3 }]), e: bands([{ at: 545, fwhm: 4200, peak: 1.2 }]), tint: '#8a5bb8' },   // Fe⁴⁺ charge transfer
  calcite: { species: 'calcite', o: clear, e: clear, tint: '#f3f0e8' },
  diamond: { species: 'diamond', o: clear, e: clear, tint: '#f4f6f8' },
  ruby: { species: 'corundum', tint: '#9b1b30',
    o: bands([{ at: 555, red: 2700, blue: 3600, peak: 14 }, { at: 405, red: 4200, blue: 3000, peak: 19 }, { at: 450, fwhm: 2000, peak: 1.2 }]),
    e: bands([{ at: 572, red: 2600, blue: 3500, peak: 11 }, { at: 398, red: 4000, blue: 3000, peak: 11 }, { at: 450, fwhm: 2000, peak: 1 }]),
    glow: { lines: [[694.3, 0.62], [692.9, 0.28], [705, 0.1]], qe: 0.7 } },
  sapphire: { species: 'corundum', tint: '#1f3f9a',                                                                                        // Fe²⁺–Ti⁴⁺: absorbs the red and yellow
    o: bands([{ at: 700, fwhm: 5200, peak: 5 }, { at: 580, fwhm: 4000, peak: 2.4 }]), e: bands([{ at: 720, fwhm: 5200, peak: 3.5 }, { at: 590, fwhm: 4000, peak: 1.6 }]) },
  tourmaline: { species: 'tourmaline', tint: '#3d7a4a',                                                                                   // the o ray is absorbed almost everywhere: a polarizer
    o: bands([{ at: 730, fwhm: 5000, peak: 30 }, { at: 455, fwhm: 6000, peak: 30 }], 22), e: bands([{ at: 730, fwhm: 4500, peak: 16 }, { at: 440, fwhm: 5000, peak: 14 }], 0.5) },
  opal: { species: 'opal', o: clear, e: clear, tint: '#2a2f3a', photonic: { D: [200, 330], fill: 0.74, nS: 1.45, nM: 1.33 } },           // a black opal
};
export const CRYSTAL_GEMS = Object.freeze(Object.keys(GEM_SPECS));
export const CRYSTAL_BANDS_NM = Object.freeze([630, 532, 465]);              // the R, G, B a shader refracts
export const CRYSTAL_PATHS_CM = Object.freeze([0.1, 0.3, 1, 3]);             // path lengths the colour is tabled at

/** Neumann's principle: symmetrize a generic symmetric tensor over the point group, count distinct eigenvalues. */
export function opticalClass(group) {
  const T0 = [[1.3, 0.21, 0.17], [0.21, 1.9, 0.13], [0.17, 0.13, 2.6]]; const G = pointGroup(group); const T = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const R of G) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { let s = 0; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) s += R[i][a] * T0[a][b] * R[j][b]; T[i][j] += s / G.length; }
  // T is symmetric; on the class axis it is diagonal in the crystal frame for every group mojulo carries (c = z)
  const off = Math.abs(T[0][1]) + Math.abs(T[0][2]) + Math.abs(T[1][2]);
  const d = [T[0][0], T[1][1], T[2][2]]; const distinct = off < 1e-9 ? new Set(d.map((x) => x.toFixed(9))).size : 3;
  return distinct === 1 ? 'isotropic' : distinct === 2 ? 'uniaxial' : 'biaxial';
}

/** The colour white (D65) light keeps after `cm` of path in one ray's absorption, linear sRGB relative to white. */
function pathColour(alpha, cm) {
  const X = [0, 0, 0], W = [0, 0, 0];
  for (let nm = 380; nm <= 780; nm += 2) { const c = cie(nm), w = d65(nm), t = Math.exp(-alpha(nm) * cm); for (let k = 0; k < 3; k++) { X[k] += w * t * c[k]; W[k] += w * c[k]; } }
  const a = xyzToLinearSrgb(X), b = xyzToLinearSrgb(W); return a.map((v, k) => Math.max(0, Math.min(1, v / b[k])));
}
/** Ruby's glow: the share of white light a 1 cm stone absorbs (what can be re-emitted) and the glow's colour. */
function glowOf(spec) {
  if (!spec.glow) return null;
  let abs = 0, tot = 0; for (let nm = 380; nm <= 780; nm += 2) { const w = d65(nm); abs += w * (1 - Math.exp(-(spec.o(nm) + spec.e(nm)) / 2)); tot += w; }
  const X = [0, 0, 0]; for (const [nm, share] of spec.glow.lines) { const c = cie(nm); for (let k = 0; k < 3; k++) X[k] += share * c[k]; }
  const rgb = xyzToLinearSrgb(X).map((v) => Math.max(0, v)); const m = Math.max(...rgb);
  return { rgb: rgb.map((v) => v / m), strength: (abs / tot) * spec.glow.qe };
}

const cache = new Map();
/**
 * A gem's optics, resolved: `{ gem, species, group, opticalClass, n: { o: [R,G,B], e: [R,G,B] }, nD, abbe,
 * dispersion (20/V), colour: { paths, o: [[rgb]…], e: [[rgb]…] }, glow, photonic, tint }`. Throws a teaching error on
 * an unknown gem.
 */
export function crystalOptics(gem) {
  if (cache.has(gem)) return cache.get(gem);
  const spec = GEM_SPECS[gem]; if (!spec) throw new Error(`crystal: unknown gem '${gem}' (have ${CRYSTAL_GEMS.join(', ')})`);
  const sp = CRYSTAL_SPECIES[spec.species]; const ix = INDEX[spec.species]; const eIx = ix.e || ix.o;
  const cls = opticalClass(sp.group);
  const mean = (nm) => (ix.o(nm) + eIx(nm)) / 2; const nD = mean(589.3), V = (nD - 1) / (mean(486.1) - mean(656.3));
  let photonic = null;
  if (spec.photonic) { const p = spec.photonic; const nEff = Math.sqrt(p.fill * p.nS ** 2 + (1 - p.fill) * p.nM ** 2); photonic = { d111: p.D.map((D) => D * Math.sqrt(2 / 3)), nEff }; }
  const out = Object.freeze({
    gem, species: spec.species, group: sp.group, opticalClass: cls,
    n: { o: CRYSTAL_BANDS_NM.map(ix.o), e: CRYSTAL_BANDS_NM.map(eIx) }, nD, abbe: V, dispersion: 20 / V,
    colour: { paths: CRYSTAL_PATHS_CM, o: CRYSTAL_PATHS_CM.map((cm) => pathColour(spec.o, cm)), e: CRYSTAL_PATHS_CM.map((cm) => pathColour(spec.e, cm)) },
    glow: glowOf(spec), photonic, tint: spec.tint,
  });
  cache.set(gem, out); return out;
}
/** The index at any wavelength for a gem's ray ('o' | 'e'), from its Sellmeier set (used by the tests and the print). */
export function crystalIndex(gem, ray, nm) { const ix = INDEX[GEM_SPECS[gem].species]; return (ray === 'e' && ix.e ? ix.e : ix.o)(nm); }
/** One ray's absorption (1/cm) at a wavelength. */
export function crystalAbsorption(gem, ray, nm) { const s = GEM_SPECS[gem]; return (ray === 'e' ? s.e : s.o)(nm); }

// ─── shape: an exact convex polytope from half-spaces (the Wulff habit), a brilliant, a cabochon ─────────────
/** Planes { n (outward, unit), d } → { vertices, faces (CCW seen from outside), normals, planes } (redundant planes dropped). */
export function halfspacePolytope(planes) {
  const verts = [];
  for (let i = 0; i < planes.length; i++) for (let j = i + 1; j < planes.length; j++) for (let k = j + 1; k < planes.length; k++) {
    const P = planes[i], Q = planes[j], R = planes[k]; const det = dot(P.n, cross(Q.n, R.n)); if (Math.abs(det) < 1e-9) continue;
    const p = scale(add(add(scale(cross(Q.n, R.n), P.d), scale(cross(R.n, P.n), Q.d)), scale(cross(P.n, Q.n), R.d)), 1 / det);
    if (planes.every((q) => dot(q.n, p) <= q.d + 1e-9 * (1 + Math.abs(q.d)) * 1e3) && !verts.some((v) => len(sub(v, p)) < 1e-9 * (1 + len(p)) * 1e3)) verts.push(p);
  }
  const faces = [], normals = [], kept = [];
  planes.forEach((pl) => {
    const on = verts.map((v, i) => [v, i]).filter(([v]) => Math.abs(dot(pl.n, v) - pl.d) < 1e-6 * (1 + Math.abs(pl.d)));
    if (on.length < 3) return;
    const c = scale(on.reduce((s, [v]) => add(s, v), [0, 0, 0]), 1 / on.length); const u = unit(sub(on[0][0], c)); const w = cross(pl.n, u);
    on.sort(([a], [b]) => Math.atan2(dot(sub(a, c), w), dot(sub(a, c), u)) - Math.atan2(dot(sub(b, c), w), dot(sub(b, c), u)));
    faces.push(on.map(([, i]) => i)); normals.push(pl.n); kept.push(pl);
  });
  return { vertices: verts, faces, normals, planes: kept };
}
/** A round brilliant (Tolkowsky: table 53%, crown 34.5°, pavilion 40.75°), diameter 1, girdle at z 0..0.02. */
function brilliantPlanes({ table = 0.53, crown = 34.5, pavilion = 40.75, girdle = 0.02, star = 16, upper = 42, lower = 42 } = {}) {
  const R = 0.5, gz = girdle, planes = [];
  const slope = (deg, phi, up, through) => { const s = Math.sin(deg * DEG), c = Math.cos(deg * DEG); const n = [s * Math.cos(phi), s * Math.sin(phi), up ? c : -c]; return { n, d: dot(n, through), form: '' }; };
  const zTable = gz + (R - table * R) * Math.tan(crown * DEG);
  planes.push({ n: [0, 0, 1], d: zTable, form: 'table' });
  for (let i = 0; i < 64; i++) { const p = (i / 64) * 2 * Math.PI; planes.push({ n: [Math.cos(p), Math.sin(p), 0], d: R, form: 'girdle' }); }
  for (let i = 0; i < 8; i++) {
    const p = (i / 8) * 2 * Math.PI; const at = (r, ph, z) => [r * Math.cos(ph), r * Math.sin(ph), z];
    planes.push({ ...slope(crown, p, true, at(R, p, gz)), form: 'bezel' }, { ...slope(pavilion, p, false, at(R, p, 0)), form: 'pavilion' });
    const ps = p + Math.PI / 8; planes.push({ ...slope(star, ps, true, at(table * R, ps, zTable)), form: 'star' });
    for (const o of [-1, 1]) { const pg = p + Math.PI / 8 + (o * Math.PI) / 16; planes.push({ ...slope(upper, pg, true, at(R, pg, gz)), form: 'upper-girdle' }, { ...slope(lower, pg, false, at(R, pg, 0)), form: 'lower-girdle' }); }
  }
  return planes;
}
/** A cabochon: a dome over a flat base, as a convex polytope of tangent planes (so the print can trace it too). */
function cabochonPlanes(radii = [0.5, 0.36, 0.25], rings = 5, perRing = 16) {   // ~70 facets: a dome's stand-in, kept light
  const [a, b, c] = radii; const planes = [{ n: [0, 0, -1], d: 0, form: 'base' }];
  for (let i = 0; i < rings; i++) {
    const v = ((i + 0.5) / rings) * (Math.PI / 2); const m = i === rings - 1 ? 1 : perRing;
    for (let j = 0; j < m; j++) { const u = (j / m) * 2 * Math.PI + (i % 2) * (Math.PI / m); const p = [a * Math.cos(v) * Math.cos(u), b * Math.cos(v) * Math.sin(u), c * Math.sin(v)];
      const n = unit([p[0] / (a * a), p[1] / (b * b), p[2] / (c * c)]); planes.push({ n, d: dot(n, p), form: 'dome' }); }
  }
  planes.push(...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const u = (k / 8) * 2 * Math.PI; const n = [Math.cos(u) / a, Math.sin(u) / b, 0]; const l = Math.hypot(n[0], n[1]); return { n: [n[0] / l, n[1] / l, 0], d: 1 / l, form: 'girdle' }; }));
  return planes;
}
export const CRYSTAL_CUTS = Object.freeze(['natural', 'brilliant', 'cabochon']);

/**
 * A gem as an exact convex polytope, centred, its longest extent `size`, crystal frame (c = z):
 * `{ vertices, faces, normals, planes, forms }`. `cut`: 'natural' (the habit; opal has none, so a cabochon),
 * 'brilliant', or 'cabochon'.
 */
export function crystalPolytope(gem, { size = 1, cut = 'natural' } = {}) {
  const spec = GEM_SPECS[gem]; if (!spec) throw new Error(`crystal: unknown gem '${gem}' (have ${CRYSTAL_GEMS.join(', ')})`);
  if (!CRYSTAL_CUTS.includes(cut)) throw new Error(`crystal.cut: '${cut}' — one of ${CRYSTAL_CUTS.join(', ')}`);
  const sp = CRYSTAL_SPECIES[spec.species]; const how = cut === 'natural' && !sp.habit ? 'cabochon' : cut;
  let planes;
  if (how === 'brilliant') planes = brilliantPlanes();
  else if (how === 'cabochon') planes = cabochonPlanes();
  else { planes = []; for (const f of sp.habit) { const n0 = planeNormal(sp.cell, f.hkl); for (const M of pointGroup(sp.group)) { const n = unit(apply(M, n0)); if (!planes.some((p) => dot(p.n, n) > 1 - 1e-9)) planes.push({ n, d: f.d, form: f.hkl.join('') }); } } }
  const poly = halfspacePolytope(planes);
  const lo = [0, 1, 2].map((k) => Math.min(...poly.vertices.map((v) => v[k]))), hi = [0, 1, 2].map((k) => Math.max(...poly.vertices.map((v) => v[k])));
  const mid = scale(add(lo, hi), 0.5); const ext = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]); const s = size / ext;
  const vertices = poly.vertices.map((v) => scale(sub(v, mid), s));
  const P = poly.planes.map((p) => ({ n: p.n, d: (p.d - dot(p.n, mid)) * s, form: p.form }));
  return { vertices, faces: poly.faces, normals: poly.normals, planes: P, forms: P.map((p) => p.form), cut: how };
}
