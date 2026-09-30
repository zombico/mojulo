// materials/metal-surface — a metal surface: a metal, a finish, an optional oxide film, a toolpath direction, a seed.
//
// The spec is `{ metal, finish?, along?, film?, seed? }`, accepted wherever a shelf material is (polygonizer/materials.js
// recognises it by `typeof m.metal === 'string'`; the shelf's own rows carry `metal: 1`, a number, and are untouched).
//
// The optics are computed once, at load, from measured n + ik (metal-optics-data.js): a metal's reflectance by angle
// is conductor Fresnel on its complex index; an oxide film's colour is the Airy sum of one film on that metal, over
// thickness and angle. Spectra (380–780 nm, 10 nm) go through the CIE 1931 2° observer (the Wyman–Sloan–Shirley fit)
// under D65 to linear sRGB, white-balanced so a perfect mirror is [1, 1, 1]. Everything is Math on fixed tables: the
// same bytes on every load. The metal-surface spike (lite-template/integration, not tracked) is the derivation.
import { METAL_NK, OXIDE_NK, LAMBDA0, LAMBDA_STEP, LAMBDA_N } from './metal-optics-data.js';
import { damascusError, canonDamascus, DAMASCUS_TYPES } from './damascus.js';

// ---------- the metals ----------
// nk: the measured table; oxide: the film it grows; finish: its natural finish. Film laws, per metal:
//   temper [[°C, nm], [°C, nm]] — a parabolic growth law through two chart points (the first straw, the first blue);
//   scaleFrom (nm) — past first-order blue a thermal oxide thickens into grey scale instead of second-order colours;
//   anodize [d0, nm per volt] — titanium's anodic film; age — copper alloys tarnish, brown, then turn green.
export const METALS = Object.freeze({
  steel: { nk: 'Fe', oxide: 'Fe2O3', finish: 'mill', temper: [[220, 7], [295, 23]], scaleFrom: 38 },
  stainless: { nk: 'SS', oxide: 'Cr2O3', finish: 'polished', temper: [[290, 9], [540, 41]], scaleFrom: 50 },
  aluminium: { nk: 'Al', finish: 'polished' },
  titanium: { nk: 'Ti', oxide: 'TiO2', finish: 'polished', temper: [[320, 8], [560, 43]], scaleFrom: 58, anodize: [9, 1.6] },
  copper: { nk: 'Cu', oxide: 'Cu2O', finish: 'polished', age: true },
  brass: { nk: 'Brass', oxide: 'Cu2O', finish: 'polished', age: true },
  bronze: { nk: 'Bronze', oxide: 'Cu2O', finish: 'polished', age: true },
  zinc: { nk: 'Zn', oxide: 'ZnO', finish: 'spangle' },
  nickel: { nk: 'Ni', finish: 'polished' },
  chrome: { nk: 'Cr', finish: 'mirror' },
  gold: { nk: 'Au', finish: 'polished' },
  silver: { nk: 'Ag', finish: 'polished' },
  bismuth: { nk: 'Bi', oxide: 'Bi2O3', finish: 'hopper', film: { nm: [40, 180] } },
});
export const METAL_ALIASES = Object.freeze({ aluminum: 'aluminium', iron: 'steel', 'mild steel': 'steel', 'stainless steel': 'stainless', chromium: 'chrome', galvanized: 'zinc' });
export const METAL_NAMES = Object.freeze(Object.keys(METALS));

// ---------- the finishes ----------
// ax / ay: microfacet slope widths along / across the toolpath; fig: the figure the page draws (0 none, 1 streaks,
// 2 feed rings, 3 blast grain, 4 hammer dimples, 5 spangle, 6 mill scale, 7 hopper terraces; 8 is a pattern-welded
// surface's etch, set by `pattern`, not a finish); only: the metals it
// belongs to (mill scale is iron oxide; spangle is how zinc freezes; hopper terraces are how bismuth grows).
export const FINISHES = Object.freeze({
  mirror: { ax: 0.01, ay: 0.01, fig: 0 },
  polished: { ax: 0.04, ay: 0.04, fig: 0 },
  brushed: { ax: 0.03, ay: 0.24, fig: 1 },
  turned: { ax: 0.025, ay: 0.2, fig: 2 },
  blasted: { ax: 0.2, ay: 0.2, fig: 3 },
  planished: { ax: 0.035, ay: 0.035, fig: 4 },
  spangle: { ax: 0.04, ay: 0.04, fig: 5, only: ['zinc'] },
  mill: { ax: 0.16, ay: 0.3, fig: 6, only: ['steel'] },
  hopper: { ax: 0.015, ay: 0.015, fig: 7, only: ['bismuth'] },
});
export const FINISH_NAMES = Object.freeze(Object.keys(FINISHES));
export const ALONG = Object.freeze(['auto', 'x', 'y', 'z', 'around']);
export const PATTERN_METALS = Object.freeze(['steel', 'stainless']);
export { DAMASCUS_TYPES };

// ---------- colour ----------
const LAMBDA = Array.from({ length: LAMBDA_N }, (_, i) => LAMBDA0 + LAMBDA_STEP * i);
const g = (x, mu, s1, s2) => { const t = (x - mu) / (x < mu ? s1 : s2); return Math.exp(-0.5 * t * t); };
const cmf = (l) => [
  1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2),
  0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1),
  1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8),
];
// CIE D65 relative spectral power, 380–780 nm at 10 nm
const D65 = [49.98, 54.65, 82.75, 91.49, 93.43, 86.68, 104.86, 117.01, 117.81, 114.86, 115.92, 108.81, 109.35, 107.80, 104.79,
  107.69, 104.41, 104.05, 100.00, 96.33, 95.79, 88.69, 90.01, 89.60, 87.70, 83.29, 83.70, 80.03, 80.21, 82.28, 78.28, 69.72, 71.61,
  74.35, 61.60, 69.89, 75.09, 63.59, 46.42, 66.81, 63.38];
const XYZ2RGB = [[3.2406, -1.5372, -0.4986], [-0.9689, 1.8758, 0.0415], [0.0557, -0.2040, 1.0570]];
const W_XYZ = LAMBDA.map((l, i) => cmf(l).map((c) => c * D65[i]));
const toRgb = (spec) => { const s = [0, 0, 0]; spec.forEach((r, i) => { for (let k = 0; k < 3; k++) s[k] += r * W_XYZ[i][k]; }); return XYZ2RGB.map((row) => row[0] * s[0] + row[1] * s[1] + row[2] * s[2]); };
const WHITE = toRgb(LAMBDA.map(() => 1));
/** A reflectance spectrum (per LAMBDA) → linear sRGB, white-balanced, clamped to [0, 1]. */
const spectrumRgb = (spec) => toRgb(spec).map((v, k) => Math.min(1, Math.max(0, v / WHITE[k])));

// ---------- reflectance (complex arithmetic on [re, im]) ----------
const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]], csub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const csqrt = (a) => { const r = Math.hypot(a[0], a[1]); const re = Math.sqrt((r + a[0]) / 2); let im = Math.sqrt(Math.max(0, (r - a[0]) / 2)); if (a[1] < 0) im = -im; return [re, im]; };
const cexp = (a) => { const e = Math.exp(a[0]); return [e * Math.cos(a[1]), e * Math.sin(a[1])]; };
const cosIn = (s0, nj) => { const q = cdiv([s0, 0], nj); return csqrt(csub([1, 0], cmul(q, q))); };
const rFace = (ni, ci, nj, cj, s) => (s
  ? cdiv(csub(cmul(ni, ci), cmul(nj, cj)), cadd(cmul(ni, ci), cmul(nj, cj)))
  : cdiv(csub(cmul(nj, ci), cmul(ni, cj)), cadd(cmul(nj, ci), cmul(ni, cj))));
/** Unpolarised reflectance: air / film (ñ1, d nm; d = 0 → none) / metal (ñ2) at wavelength λ, incidence θ. */
function reflect1(n1, d, n2, lam, theta) {
  const s0 = Math.sin(theta), n0 = [1, 0], c0 = [Math.cos(theta), 0], c2 = cosIn(s0, n2); let R = 0;
  for (const s of [true, false]) {
    let r;
    if (!d) r = rFace(n0, c0, n2, c2, s);
    else {
      const c1 = cosIn(s0, n1); const r01 = rFace(n0, c0, n1, c1, s), r12 = rFace(n1, c1, n2, c2, s);
      const e = cexp(cmul([0, 2], cmul([2 * Math.PI * d / lam, 0], cmul(n1, c1))));
      r = cdiv(cadd(r01, cmul(r12, e)), cadd([1, 0], cmul(cmul(r01, r12), e)));
    }
    R += (r[0] * r[0] + r[1] * r[1]) / 2;
  }
  return R;
}
const nkRows = (flat) => Array.from({ length: LAMBDA_N }, (_, i) => [flat[2 * i], flat[2 * i + 1]]);
const NK = Object.fromEntries(Object.entries(METAL_NK).map(([k, v]) => [k, nkRows(v)]));
const OX = Object.fromEntries(Object.entries(OXIDE_NK).map(([k, v]) => [k, nkRows(v)]));
/** Linear-sRGB reflectance of a metal (under an oxide of d nm) at incidence cosθ. */
export function metalRgb(metal, { d = 0, cos = 1 } = {}) {
  const row = METALS[metal]; const m = NK[row.nk], o = d && row.oxide ? OX[row.oxide] : null; const th = Math.acos(Math.max(0, Math.min(1, cos)));
  return spectrumRgb(LAMBDA.map((l, i) => reflect1(o ? o[i] : null, o ? d : 0, m[i], l, Math.min(th, Math.PI / 2 - 1e-4))));
}

// ---------- the lookup table the page reads ----------
// One table per metal: LUT_D rows of thickness (0, 5, 10 … nm; one row for a metal with no oxide) × LUT_A angle
// columns, column i at cosθ = (1 − i / (LUT_A − 1))², so the samples crowd toward grazing where Fresnel moves.
// Stored as sqrt(R) in bytes, RGB: 64 × 16 × 3 = 3 kB for a film metal, 48 B for a bare one.
export const LUT_D = 64, LUT_STEP = 5, LUT_A = 16;
const LUTS = new Map();
export function metalLut(metal) {
  if (LUTS.has(metal)) return LUTS.get(metal);
  const rows = METALS[metal].oxide ? LUT_D : 1; const out = new Uint8Array(rows * LUT_A * 3);
  for (let r = 0; r < rows; r++) for (let i = 0; i < LUT_A; i++) {
    const c = (1 - i / (LUT_A - 1)) ** 2; const rgb = metalRgb(metal, { d: r * LUT_STEP, cos: c });
    for (let k = 0; k < 3; k++) out[(r * LUT_A + i) * 3 + k] = Math.round(255 * Math.sqrt(rgb[k]));
  }
  LUTS.set(metal, out); return out;
}

// ---------- films ----------
const K0 = 273.15, RG = 8.314;
/** d(T) = √(A·exp(−Q/RT)): the parabolic growth law through the two chart points. */
function growth([[T1, d1], [T2, d2]], T) { const Q = 2 * RG * Math.log(d2 / d1) / (1 / (T1 + K0) - 1 / (T2 + K0)); const A = d1 * d1 * Math.exp(Q / (RG * (T1 + K0))); return T <= 30 ? 0 : Math.sqrt(A * Math.exp(-Q / (RG * (T + K0)))); }
/** Copper's tarnish at an age (years): the film, the brown past interference, the verdigris share (up-facing first). */
export function copperAge(age) {
  const d = 90 * Math.sqrt(Math.max(0, age) / 0.25); const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  return { d: Math.min(d, 110), brown: sstep(110, 380, d), green: sstep(4, 40, age) };
}
const FILM_KEYS = ['nm', 'temper', 'anodize', 'age'];
function filmError(metal, film) {
  if (film == null) return null;
  const row = METALS[metal];
  if (typeof film !== 'object' || Array.isArray(film)) return `film is an object: one of { nm }, { temper: °C }, { anodize: volts }, { age: years }`;
  const keys = Object.keys(film); if (keys.length !== 1 || !FILM_KEYS.includes(keys[0])) return `film takes exactly one of ${FILM_KEYS.join(', ')} — got ${keys.join(', ') || 'nothing'}`;
  if (!row.oxide) return `${metal} grows no coloured film here — the film metals are ${METAL_NAMES.filter((m) => METALS[m].oxide).join(', ')}`;
  const [k] = keys; const v = film[k];
  if (k === 'nm') { const ok = (x) => Number.isFinite(x) && x >= 0 && x <= (LUT_D - 1) * LUT_STEP; if (Array.isArray(v) ? !(v.length === 2 && v.every(ok) && v[0] <= v[1]) : !ok(v)) return `film.nm is a thickness 0–${(LUT_D - 1) * LUT_STEP} nm, or [min, max]`; }
  if (k === 'temper') { if (!row.temper) return `${metal} has no temper colours here — temper works on ${METAL_NAMES.filter((m) => METALS[m].temper).join(', ')}`; if (!(Number.isFinite(v) && v >= 0 && v <= 1200)) return 'film.temper is a temperature in °C (0–1200)'; }
  if (k === 'anodize') { if (!row.anodize) return `only titanium anodizes to colour here`; if (!(Number.isFinite(v) && v >= 0 && v <= 150)) return 'film.anodize is a voltage (0–150 V)'; }
  if (k === 'age') { if (!row.age) return `age applies to copper, brass and bronze`; if (!(Number.isFinite(v) && v >= 0 && v <= 200)) return 'film.age is in years (0–200)'; }
  return null;
}

// ---------- the spec ----------
export const isMetalSurface = (m) => !!m && typeof m === 'object' && typeof m.metal === 'string';
// own keys only: a prototype name ('constructor', 'toString', '__proto__') is not a metal or a finish
const own = (o, k) => typeof k === 'string' && Object.hasOwn(o, k);
const metalKey = (name) => (typeof name === 'string' ? (own(METALS, name) ? name : own(METAL_ALIASES, name.trim().toLowerCase()) ? METAL_ALIASES[name.trim().toLowerCase()] : null) : null);
/** Why a metal-surface spec is invalid (a sentence naming the choices), or null. */
export function metalSurfaceError(spec) {
  if (!isMetalSurface(spec)) return 'a metal surface is { metal, finish?, along?, film?, pattern?, seed? }';
  const metal = metalKey(spec.metal); if (!metal) return `unknown metal '${spec.metal}' — use one of: ${METAL_NAMES.join(', ')}`;
  const extra = Object.keys(spec).filter((k) => !['metal', 'finish', 'along', 'film', 'pattern', 'seed'].includes(k)); if (extra.length) return `a metal surface takes metal, finish, along, film, pattern, seed — not ${extra.join(', ')}`;
  if (spec.pattern != null) {
    const pe = damascusError(spec.pattern); if (pe) return pe;
    if (!PATTERN_METALS.includes(metal)) return `pattern-welding folds steels — use ${PATTERN_METALS.join(' or ')}`;
    if (spec.finish != null || spec.film != null) return 'a pattern-welded surface is etched: it takes no finish or film';
  }
  if (spec.finish != null) { const f = own(FINISHES, spec.finish) ? FINISHES[spec.finish] : null; if (!f) return `unknown finish '${spec.finish}' — use one of: ${FINISH_NAMES.join(', ')}`; if (f.only && !f.only.includes(metal)) return `the ${spec.finish} finish belongs to ${f.only.join(', ')}`; }
  const a = spec.along; if (a != null && !(ALONG.includes(a) || (Array.isArray(a) && a.length === 3 && a.every(Number.isFinite) && Math.hypot(...a) > 0))) return `along is one of ${ALONG.join(', ')}, or a direction [x, y, z]`;
  if (spec.seed != null && !Number.isInteger(spec.seed)) return 'seed is an integer';
  return filmError(metal, spec.film);
}
const rgbHex = (lin) => '#' + lin.map((v) => { v = Math.max(0, Math.min(1, v)); const e = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; return Math.round(255 * e).toString(16).padStart(2, '0'); }).join('');
const round = (v, k = 4) => +v.toFixed(k);
/**
 * Resolve a spec to what every consumer reads: the canonical key (the page's and the exporters' identity for it), the
 * metal and finish rows, the film as a thickness (nm, with a spread for a seeded range), the thermal-scale threshold,
 * the copper age, and the colours at normal incidence (bare F0, and with the film) for the fill and the exports.
 * Throws on an invalid spec (callers validate first with metalSurfaceError).
 */
export function resolveMetalSurface(spec) {
  const err = metalSurfaceError(spec); if (err) throw new Error(`metal surface: ${err}`);
  const metal = metalKey(spec.metal); const row = METALS[metal]; const finish = spec.finish || (spec.pattern != null ? 'polished' : row.finish); const fin = FINISHES[finish];
  const film = spec.film ?? row.film ?? null; let d = 0, spread = 0, age = null, thermal = false;
  if (film) {
    const [k] = Object.keys(film); const v = film[k];
    if (k === 'nm') { if (Array.isArray(v)) { d = (v[0] + v[1]) / 2; spread = (v[1] - v[0]) / 2; } else d = v; }
    if (k === 'temper') { d = growth(row.temper, v); thermal = true; }
    if (k === 'anodize') d = row.anodize[0] + row.anodize[1] * v;
    if (k === 'age') { age = v; d = copperAge(v).d; }
  }
  d = round(Math.min(d, (LUT_D - 1) * LUT_STEP), 2);
  const F0 = metalRgb(metal), edge = metalRgb(metal, { cos: Math.cos(80 * Math.PI / 180) });
  let normal = d ? metalRgb(metal, { d: thermal ? Math.min(d, row.scaleFrom) : d }) : F0;
  if (thermal && d > row.scaleFrom) { const t = Math.min(1, (d - row.scaleFrom) / (1.5 * row.scaleFrom)); normal = normal.map((v) => v * (1 - t) + 0.045 * t); }
  if (age != null) { const a = copperAge(age); const cover = Math.max(a.brown * 0.92, a.green * 0.5); const under = [0.07 * (1 - a.green) + 0.16 * a.green, 0.035 * (1 - a.green) + 0.36 * a.green, 0.022 * (1 - a.green) + 0.28 * a.green]; normal = normal.map((v, k) => v * (1 - cover) + under[k] * cover); }
  if (finish === 'mill') normal = normal.map((v, k) => v * 0.15 + [0.07, 0.076, 0.088][k] * 0.85);   // magnetite-rich scale over most of it
  // a pattern-welded blade: the etch darkens the carbon layers (about half the surface) under a dark oxide grey, and the
  // pattern runs along the part's z unless told otherwise (a blade is built along z)
  const pattern = spec.pattern != null ? canonDamascus(spec.pattern) : null;
  if (pattern) normal = normal.map((v) => v * 0.65 * 0.775 + 0.036 * 0.225);
  const along = spec.along ?? (pattern ? 'z' : 'auto'); const seed = spec.seed ?? 0;
  const canon = { metal, ...(pattern ? {} : { finish }), along, ...(film ? { film } : {}), ...(pattern ? { pattern } : {}), seed };
  return {
    key: JSON.stringify(canon), spec: canon, metal, finish, along, alongSet: spec.along != null || !!pattern, seed, fig: pattern ? 8 : fin.fig, ax: pattern ? 0.05 : fin.ax, ay: pattern ? 0.05 : fin.ay,
    ...(pattern ? { pattern } : {}),
    d, spread, thermal, scaleFrom: row.scaleFrom || 0, age, oxide: row.oxide || null,
    F0: F0.map((v) => round(v)), edge: edge.map((v) => round(v)), normal: normal.map((v) => round(v)), hex: rgbHex(normal),
    roughness: round(Math.min(1, Math.sqrt((fin.ax * fin.ax + fin.ay * fin.ay) / 2) * 2.2 + 0.05), 3),
  };
}
/**
 * A resolved surface as a shelf row, so every generator's fill shading (vexar.shadeHexMat) and `tagFacesWithMaterial`
 * keep working: base = the colour at normal incidence, a specular strength from the finish, `metal: 1`, and the
 * surface itself (which tags faces for the page's metal channel and the exporters' metal buckets).
 */
export function metalShelfRow(surface) {
  return { base: surface.hex, ambient: 0.26, diffuse: 0.7, specular: round(1 - surface.roughness, 3), shininess: Math.round(2 / Math.max(0.02, surface.roughness) ** 2), metal: 1, surface };
}
