// construction/roofing — a roof's covering, laid the way a roofer lays it: courses up from the eave at the gauge, each
// unit lapping the course below, the ridges and hips capped. A roof plane is given as its corners; the eave is its
// lowest level edge, and courses run parallel to it, so any pitched plane of any roof form takes any covering.
//
// Coverings (COVERINGS): flat units (asphalt shingle, cedar shake, natural slate, plain tile) laid broken-bond, each
// resting on the course below so its butt stands proud; profiled units laid straight-bond — pantile (a pan and a
// roll), kawara (the Japanese J-profile sangawara, its ridge a stack of noshi under a round kanmuri), barrel (mission
// and Spanish: pans with covers over the gaps between them); and standing-seam metal, panels eave to ridge with a
// raised seam at each edge.
//
// Render ladder (as masonry's): 'units' draws every unit, stamped per plane and shape as `repeats` with a tint each
// (kiln and weather variation); 'surface' draws the plane wearing the covering's map (a library texture, or one baked
// here under `covering:`); 'mass' draws the plane in the covering's far colour. 'auto' picks from the eyes: units while
// a course is at least 5 px from the nearest eye, the map while it is at least a pixel.
//
// Every length in a plane is the caller's unit (the house's feet, `unit` metres each); unit sizes are millimetres.
import { shadeHexMat, DEFAULT_LIGHT } from '../polygonizer/vexar.js';
import { resolveMaterial, tagFacesWithMaterial } from '../polygonizer/materials.js';
import { rgbHex, hexRgb } from './timber.js';
import { CATALOG } from './catalog.js';
import { registerTextureResolver, encodePng } from '../landscape/surface-textures.js';
import * as dmath from '../../util/dmath.js';

function mix(n) { n = Math.imul(n ^ (n >>> 16), 0x7feb352d); n = Math.imul(n ^ (n >>> 15), 0x846ca68b); return (n ^ (n >>> 16)) >>> 0; }
const hash3 = (a, b, c) => mix((Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0);
const hf = (h, n) => mix((h + Math.imul(n + 1, 0x9e3779b9)) | 0) / 4294967296;

/**
 * The coverings. `gauge` (mm) is the course spacing up the slope, `cover` the width one unit covers, `thick` its
 * thickness, `depth` a profile's rise; `bond` 'half' offsets alternate courses by half a unit, 'broken' by a random
 * part of one, 'straight' not at all; `cap` how ridges and hips are finished; `material` the catalog default.
 */
export const COVERINGS = Object.freeze({
  'asphalt-shingle': { profile: 'flat', gauge: 143, cover: 305, thick: 5, bond: 'half', cap: 'fold', material: 'roofing:shingle-weathered', shade: 'matte', vary: 0.07 },
  'cedar-shake': { profile: 'flat', gauge: 254, cover: [150, 200, 250, 300], thick: 16, bond: 'broken', cap: 'fold', material: 'roofing:shake-cedar', shade: 'wood', vary: 0.16 },
  slate: { profile: 'flat', gauge: 212, cover: 250, thick: 7, bond: 'half', cap: 'roll', material: 'roofing:slate-blue', shade: 'stone', vary: 0.07 },
  'plain-tile': { profile: 'flat', gauge: 100, cover: 165, thick: 12, bond: 'half', cap: 'roll', material: 'roofing:plain-tile-red', shade: 'stone', vary: 0.12 },
  pantile: { profile: 'pantile', gauge: 250, cover: 210, thick: 12, depth: 62, bond: 'straight', cap: 'roll', material: 'roofing:pantile-red', shade: 'stone', vary: 0.1 },
  kawara: { profile: 'kawara', gauge: 235, cover: 265, thick: 15, depth: 38, bond: 'straight', cap: 'noshi', material: 'roofing:kawara-ibushi', shade: 'stone', vary: 0.05 },
  barrel: { profile: 'barrel', gauge: 356, cover: 250, thick: 12, depth: 55, bond: 'straight', cap: 'roll', material: 'roofing:clay-terracotta', shade: 'stone', vary: 0.14 },
  'standing-seam': { profile: 'seam', cover: 406, thick: 1, seam: 38, cap: 'flashing', material: 'roofing:standing-seam-zinc', shade: 'steel', vary: 0 },
});
export const COVERING_KEYS = Object.freeze(Object.keys(COVERINGS));
export const COVERING_DETAILS = Object.freeze(['auto', 'units', 'surface', 'mass']);

/** A house roof style's library texture → the covering it is laid as. */
export function coveringForTexture(texture) {
  if (!texture) return { type: 'standing-seam' };
  if (/^shingle-/.test(texture)) return { type: 'asphalt-shingle', material: `roofing:${texture}` };
  if (texture === 'clay-slate') return { type: 'slate' };
  if (/^clay-/.test(texture)) return { type: 'barrel', material: `roofing:${texture}` };
  return { type: 'asphalt-shingle' };
}

/** Validate a `covering` value → string[]. */
export function validateCovering(c, at = 'covering') {
  if (c === true || c === undefined) return [];
  const spec = typeof c === 'string' ? { type: c } : c;
  if (!spec || typeof spec !== 'object') return [`${at}: true, a covering name (${COVERING_KEYS.join(', ')}) or { type, material?, color?, detail? }`];
  const e = [];
  if (spec.type !== undefined && !COVERINGS[spec.type]) e.push(`${at}.type: one of ${COVERING_KEYS.join(', ')}`);
  if (spec.material !== undefined && !(CATALOG[spec.material] && CATALOG[spec.material].kind === 'roofing')) e.push(`${at}.material: a roofing name from the catalog (${Object.keys(CATALOG).filter((k) => k.startsWith('roofing:')).join(', ')})`);
  if (spec.color !== undefined && !hexRgb(spec.color)) e.push(`${at}.color: a hex colour`);
  if (spec.detail !== undefined && !COVERING_DETAILS.includes(spec.detail)) e.push(`${at}.detail: one of ${COVERING_DETAILS.join(', ')}`);
  return e;
}

/** A `covering` value (with the style's texture for `true`) → { type, def, material, rgb, detail }. */
export function coveringOf(c, styleTexture = null) {
  const spec = c === true ? coveringForTexture(styleTexture) : typeof c === 'string' ? { type: c } : { ...(c.type ? {} : coveringForTexture(styleTexture)), ...c };
  const type = COVERINGS[spec.type] ? spec.type : 'asphalt-shingle';
  const def = COVERINGS[type];
  const material = spec.material || def.material;
  const rgb = hexRgb(spec.color) || (CATALOG[material] && CATALOG[material].rgb) || [140, 90, 70];
  return { type, def, material, rgb, detail: spec.detail || 'auto' };
}

// ── vectors ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit3 = (a) => { const l = dmath.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const q6 = (v) => Math.round(v * 1e6) / 1e6;

/**
 * A plane's frame: origin at the eave's first end, `e` along the eave, `u` up the slope, `n` out of the roof; `poly` its
 * corners as (s along the eave, t up the slope). Null for a plane too flat to shed a covering (under about 1 in 12).
 */
export function planeFrame(corners) {
  const n0 = corners.length;
  let best = null;
  for (let i = 0; i < n0; i++) {
    const a = corners[i], b = corners[(i + 1) % n0];
    if (Math.abs(a[2] - b[2]) > 1e-3 || dmath.hypot(b[0] - a[0], b[1] - a[1]) < 1e-3) continue;
    if (!best || a[2] < best.z - 1e-6) best = { i, z: a[2] };
  }
  if (!best) return null;
  const O = corners[best.i], e = unit3(sub(corners[(best.i + 1) % n0], O));
  const far = corners.reduce((m, c) => (c[2] > m[2] ? c : m), corners[0]);
  let u = sub(far, O); u = unit3(sub(u, mul(e, dot(u, e))));
  if (u[2] < 0.08) return null;
  let n = cross(e, u); if (n[2] < 0) n = mul(n, -1);
  const poly = corners.map((c) => { const r = sub(c, O); return [dot(r, e), dot(r, u)]; });
  return { O, e, u, n, poly, sMin: Math.min(...poly.map((p) => p[0])), sMax: Math.max(...poly.map((p) => p[0])), tMax: Math.max(...poly.map((p) => p[1])) };
}
/** The span [lo, hi] of the polygon's `axis` coordinate on the line where its other coordinate is `v`, or null. */
function spanAt(poly, axis, v) {
  const o = 1 - axis; let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if ((a[o] - v) * (b[o] - v) > 0) continue;
    if (Math.abs(b[o] - a[o]) < 1e-9) { lo = Math.min(lo, a[axis], b[axis]); hi = Math.max(hi, a[axis], b[axis]); continue; }
    const k = (v - a[o]) / (b[o] - a[o]); const x = a[axis] + k * (b[axis] - a[axis]);
    lo = Math.min(lo, x); hi = Math.max(hi, x);
  }
  return hi >= lo ? [lo, hi] : null;
}

// the renderer seam (see architecture/roof.js): a 4-corner face that is not a parallelogram carries its true outline
function cardClip(c4) {
  const O = c4[0], U = sub(c4[1], O), V = sub(c4[3], O);
  const uu = dot(U, U), vv = dot(V, V), uv = dot(U, V), det = uu * vv - uv * uv || 1;
  const poly = c4.map((p) => { const d = sub(p, O), du = dot(d, U), dv = dot(d, V); return [(vv * du - uv * dv) / det, (uu * dv - uv * du) / det]; });
  const ideal = [[0, 0], [1, 0], [1, 1], [0, 1]];
  if (poly.every((p, i) => Math.abs(p[0] - ideal[i][0]) < 2e-3 && Math.abs(p[1] - ideal[i][1]) < 2e-3)) return null;
  return 'polygon(' + poly.map(([a, b]) => `${(a * 100).toFixed(2)}% ${(b * 100).toFixed(2)}%`).join(',') + ')';
}
/** A polygon (3 or 4 world corners) as one face, padded and clipped for the renderer seam. */
export function planeFace(corners, fill, normal, extra = {}) {
  const c4 = corners.length === 3 ? [corners[0], corners[1], corners[2], corners[2]] : corners;
  const clip = cardClip(c4);
  return { corners: c4.map((c) => c.map(q6)), fill, normal, outNormal: normal, doubleSided: true, ...(clip ? { clip } : {}), ...extra };
}

// ── unit shapes, in plane-local (s across, t up, h out), millimetres converted by the caller ──────────────────────────
/** Profile height (0…1 of `depth`) across a unit (σ 0…1). */
const PROFILES = {
  pantile: (x) => (x < 0.62 ? 0.15 - 0.15 * dmath.sin((Math.PI * x) / 0.62) : 0.15 + 0.85 * dmath.sin((Math.PI * (x - 0.62)) / 0.38)),
  kawara: (x) => (x < 0.72 ? 0.1 - 0.1 * dmath.sin((Math.PI * x) / 0.72) : 0.1 + 0.9 * dmath.sin((Math.PI * (x - 0.72)) / 0.28)),
  pan: (x) => 1 - dmath.sin(Math.PI * x),
  cover: (x) => dmath.sin(Math.PI * x),
};

/**
 * One unit's faces in local coordinates (feet), relative to its anchor (its lower left at the eave side): a shell whose
 * top runs from the butt, resting `lift` proud on the course below, back to `len` up the slope. `prof` is a profile
 * function or null (a flat unit), `w` the unit's width, `d` its profile rise, `th` its thickness.
 */
function unitShell(w, len, th, lift, prof, d, segs = 8) {
  const out = [];
  if (!prof) {
    const A = (s, t, h) => [s, t, h];
    const b0 = lift, b1 = lift + th;                                       // butt: bottom and top, head sits on the plane
    out.push([A(0, 0, b1), A(w, 0, b1), A(w, len, th), A(0, len, th)]);    // top
    out.push([A(0, 0, b0), A(w, 0, b0), A(w, 0, b1), A(0, 0, b1)]);        // butt
    out.push([A(0, 0, b0), A(0, len, 0), A(0, len, th), A(0, 0, b1)]);     // sides
    out.push([A(w, 0, b0), A(w, len, 0), A(w, len, th), A(w, 0, b1)]);
    return out;
  }
  const pts = []; for (let i = 0; i <= segs; i++) { const x = i / segs; pts.push([x * w, prof(x) * d]); }
  for (let i = 0; i < segs; i++) {
    const [s0, y0] = pts[i], [s1, y1] = pts[i + 1];
    out.push([[s0, 0, lift + th + y0], [s1, 0, lift + th + y1], [s1, len, th + y1], [s0, len, th + y0]]);   // top strip
    out.push([[s0, 0, lift + y0], [s1, 0, lift + y1], [s1, 0, lift + th + y1], [s0, 0, lift + th + y0]]);   // butt rim
  }
  return out;
}

/** A cap's faces along +x (0…len) in its line frame (y across, z up), feet: 'roll' | 'fold' | 'flashing' | noshi layers. */
function capShell(kind, len, r, base) {
  const out = [];
  if (kind === 'fold' || kind === 'flashing') {
    const w = kind === 'fold' ? r * 1.3 : r * 1.6, dz = kind === 'fold' ? r * 0.45 : r * 0.35, th = kind === 'fold' ? r * 0.1 : r * 0.02;
    for (const s of [-1, 1]) {
      out.push([[0, 0, base + dz + th], [len, 0, base + dz + th], [len, s * w, base + th], [0, s * w, base + th]]);
      out.push([[0, s * w, base], [len, s * w, base], [len, s * w, base + th], [0, s * w, base + th]]);
    }
    return out;
  }
  const segs = 7;
  for (let i = 0; i < segs; i++) {
    const a0 = Math.PI * (i / segs), a1 = Math.PI * ((i + 1) / segs);
    const p0 = [r * dmath.cos(a0), base + r * 0.85 * dmath.sin(a0)], p1 = [r * dmath.cos(a1), base + r * 0.85 * dmath.sin(a1)];
    out.push([[0, p0[0], p0[1]], [0, p1[0], p1[1]], [len, p1[0], p1[1]], [len, p0[0], p0[1]]]);
  }
  return out;
}

/** The largest projected size (px) of `m` metres at any of `pts` (metres) from any eye. */
function maxPx(m, pts, eyes) {
  let px = 0;
  for (const e of eyes) for (const q of pts) px = Math.max(px, (m * e.focalPx) / Math.max(0.1, dmath.hypot(q[0] - e.pos[0], q[1] - e.pos[1], q[2] - e.pos[2])));
  return px;
}

/** The level a plane draws at. */
function planeLevel(detail, courseM, corners, unit, eyes) {
  if (detail && detail !== 'auto') return detail;
  if (!eyes || !eyes.length) return 'units';
  const pts = corners.map((c) => c.map((v) => v * unit));
  const px = maxPx(courseM, pts, eyes);
  return px >= 5 ? 'units' : px >= 1 ? 'surface' : 'mass';
}

// ── the map: a covering's seamless tile, baked ───────────────────────────────────────────────────────────────────────
export const COVERING_TEXTURE_PREFIX = 'covering:';
const MAP_COLS = 4, MAP_ROWS = 6;
/** The map key of a covering in a colour. */
export const coveringKey = (type, rgb) => `${COVERING_TEXTURE_PREFIX}${type}:${rgbHex(rgb)}`;
/** The metres one tile of a covering's map spans, [across, up]. */
export function coveringTileM(type) {
  const d = COVERINGS[type];
  const cover = Array.isArray(d.cover) ? d.cover.reduce((a, b) => a + b, 0) / d.cover.length : d.cover;
  return [(cover * MAP_COLS) / 1000, ((d.gauge || 600) * MAP_ROWS) / 1000];
}
/** Bake a covering key → { rgb, W, H } (a seamless tile of MAP_COLS units by MAP_ROWS courses), or null. */
export function bakeCoveringKey(key) {
  const m = /^covering:([a-z-]+):#([0-9a-f]{6})$/i.exec(key || '');
  if (!m || !COVERINGS[m[1]]) return null;
  const d = COVERINGS[m[1]]; const base = hexRgb(`#${m[2]}`);
  const W = 128, H = d.profile === 'seam' ? 128 : 192;
  const rgb = Buffer.alloc(W * H * 3);
  const rows = d.profile === 'seam' ? 1 : MAP_ROWS;
  for (let y = 0; y < H; y++) {
    const tv = (y / H) * rows, row = Math.floor(tv), fv = tv - row;           // fv 0 at a course's butt, 1 at its top
    const off = d.bond === 'half' ? (row % 2) * 0.5 : d.bond === 'broken' ? hf(hash3(row, 7, 3), 0) : 0;
    for (let x = 0; x < W; x++) {
      const tu = (x / W) * MAP_COLS + off, col = ((Math.floor(tu) % MAP_COLS) + MAP_COLS) % MAP_COLS, fu = tu - Math.floor(tu);
      let k = 1;
      if (d.profile === 'flat') k = fu < 0.03 ? 0.45 : 1;                     // the keyway between units
      else if (d.profile === 'seam') k = fu < 0.04 ? 1.18 : fu < 0.07 ? 0.62 : 1 - 0.04 * dmath.sin(Math.PI * fu);
      else {
        const pf = d.profile === 'barrel' ? (fu < 0.6 ? PROFILES.pan(fu / 0.6) : 1) : PROFILES[d.profile](fu);
        const dx = 1e-3, pf1 = d.profile === 'barrel' ? (fu < 0.6 ? PROFILES.pan(Math.min(1, fu / 0.6 + dx)) : 1) : PROFILES[d.profile](Math.min(1, fu + dx));
        const slope = (pf1 - pf) / dx;
        k = d.profile === 'barrel' && fu >= 0.6 ? 1.12 - 0.3 * Math.abs(fu - 0.8) / 0.2 : 0.92 + 0.08 * pf - 0.05 * slope;
      }
      if (d.profile !== 'seam') k *= fv > 0.86 ? 0.62 : 1 - 0.1 * (1 - fv);   // the next course's butt shadow, a fall-off to it
      const h = hash3(row, col, 11);
      k *= 1 + d.vary * (2 * hf(h, 0) - 1) + 0.03 * (hf(hash3(x, y, 5), 0) - 0.5);
      const o = ((H - 1 - y) * W + x) * 3;
      for (let c = 0; c < 3; c++) rgb[o + c] = Math.max(0, Math.min(255, Math.round(base[c] * k)));
    }
  }
  return { rgb, W, H };
}
const mapUrls = new Map();
/** The data URL for a covering key (cached), or null. */
export function resolveCoveringTexture(key) {
  if (mapUrls.has(key)) return mapUrls.get(key);
  const b = bakeCoveringKey(key);
  if (!b) return null;
  const url = `data:image/png;base64,${encodePng(b.rgb, b.W, b.H).toString('base64')}`;
  mapUrls.set(key, url); if (mapUrls.size > 64) mapUrls.delete(mapUrls.keys().next().value);
  return url;
}
registerTextureResolver(COVERING_TEXTURE_PREFIX, resolveCoveringTexture);

/** The map a covering draws with at 'surface': the material's own (a library texture) or one baked in its colour. */
function coveringMap(cov) {
  const m = CATALOG[cov.material] && CATALOG[cov.material].map;
  if (m && m.texture && rgbHex(cov.rgb) === rgbHex(CATALOG[cov.material].rgb)) return { texture: m.texture, tileM: Array.isArray(m.tileM) ? m.tileM : [m.tileM, m.tileM] };
  return { texture: coveringKey(cov.type, cov.rgb), tileM: coveringTileM(cov.type) };
}

/**
 * Lay a covering over roof planes → { faces, repeats, report }.
 *   planes   [{ corners: [[x,y,z]…] (3 or 4, the caller's unit), key? }]
 *   covering a covering value (see coveringOf)
 *   o        { unit (metres per unit, default 0.3048), light, eyes, seed, instance (default true), group, styleTexture,
 *             stage: 'covered' (default) | 'battens' | 'deck', deck: { rgb, texture?, tileM? } }
 * Caps go on every edge two planes share where they meet convex (ridges and hips); a valley is left open.
 */
export function layCovering(planes, covering, o = {}) {
  const unit = o.unit || 0.3048, mmU = 0.001 / unit;                       // one millimetre in the caller's unit
  const light = o.light || DEFAULT_LIGHT, seed = o.seed ?? 1, instance = o.instance !== false;
  const cov = coveringOf(covering, o.styleTexture);
  const d = cov.def;
  const group = o.group || 'roofing';
  const stage = o.stage || 'covered';
  const mat = resolveMaterial(d.shade);
  const faces = [], repeats = [];
  const report = { covering: cov.type, material: cov.material, stage, planes: [], units: 0, areaSqFt: 0, caps: { lines: 0, lengthFt: 0 }, battens: { count: 0, lengthFt: 0 } };
  const toFt = unit / 0.3048;
  const underRgb = stage === 'deck' && o.deck ? o.deck.rgb : [58, 56, 54];   // felt, or the deck
  const frames = [];
  // edges two planes share (ridges, hips, valleys); an open edge that is not an eave is a verge, closed at its side
  const near = (p, q) => dmath.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 0.05;
  const shared = (a, b, self) => planes.some((pl, j) => j !== self && pl.corners.some((c, i) => { const c1 = pl.corners[(i + 1) % pl.corners.length]; return (near(c, a) && near(c1, b)) || (near(c, b) && near(c1, a)); }));
  for (const [pi, pl] of planes.entries()) {
    const F = planeFrame(pl.corners);
    if (!F) {
      // too flat to shed a lapped covering (a mansard's crown): a membrane
      faces.push(planeFace(pl.corners, shadeHexMat(rgbHex(CATALOG['roofing:membrane'].rgb), [0, 0, 1], mat, { light }), [0, 0, 1], { group: `${group}:${pl.key || pi}` }));
      report.planes.push({ key: pl.key || pi, level: 'membrane' });
      continue;
    }
    frames.push({ F, pl, pi });
    let area = 0; for (let i = 0; i < F.poly.length; i++) { const a = F.poly[i], b = F.poly[(i + 1) % F.poly.length]; area += a[0] * b[1] - b[0] * a[1]; }
    area = Math.abs(area) / 2;
    report.areaSqFt += area * toFt * toFt;
    const level = stage === 'covered' ? planeLevel(cov.detail, (d.gauge || d.cover) / 1000, pl.corners, unit, o.eyes) : 'deck';
    const pr = { key: pl.key || pi, level, areaSqFt: Math.round(area * toFt * toFt), units: 0 };
    report.planes.push(pr);
    const W = (s, t, h) => add3(add3(add3(F.O, mul(F.e, s)), mul(F.u, t)), mul(F.n, h));
    const planeFill = (rgb) => shadeHexMat(rgbHex(rgb), F.n, mat, { light });
    const tag = `${group}:${pl.key || pi}`;
    // the plane itself: the underlay the units lie on, or the covering as its map or colour
    if (level === 'surface') {
      const map = coveringMap(cov);
      const [mw, mh] = map.tileM.map((v) => v / unit);
      const uv = pl.corners.map((c) => { const r = sub(c, F.O); return [dot(r, F.e) / mw, dot(r, F.u) / mh]; });
      faces.push(planeFace(pl.corners, shadeHexMat('#ffffff', F.n, mat, { light }), F.n, { texture: map.texture, textureLit: true, uv: uv.length === 3 ? [...uv, uv[2]] : uv, group: tag }));
      continue;
    }
    if (level === 'mass') { faces.push(planeFace(pl.corners, planeFill(cov.rgb), F.n, { group: tag })); continue; }
    if (level === 'deck' && o.deck && o.deck.texture) {
      const [mw, mh] = (Array.isArray(o.deck.tileM) ? o.deck.tileM : [o.deck.tileM || 1, o.deck.tileM || 1]).map((v) => v / unit);
      const uv = pl.corners.map((c) => { const r = sub(c, F.O); return [dot(r, F.e) / mw, dot(r, F.u) / mh]; });
      faces.push(planeFace(pl.corners, shadeHexMat('#ffffff', F.n, resolveMaterial('wood'), { light }), F.n, { texture: o.deck.texture, textureLit: true, uv: uv.length === 3 ? [...uv, uv[2]] : uv, group: tag }));
    } else faces.push(planeFace(pl.corners, planeFill(underRgb), F.n, { group: tag }));
    if (stage === 'deck') continue;

    // ── battens (stage 'battens'), or the units ──
    const g = (d.gauge || 0) * mmU;
    if (stage === 'battens') {
      if (!g) continue;
      const bw = 50 * mmU, bh = 25 * mmU;
      for (let t = g * 0.5; t < F.tMax - bw; t += g) {
        const sp = spanAt(F.poly, 0, t + bw / 2);
        if (!sp || sp[1] - sp[0] < 0.2) continue;
        const c = [W(sp[0], t, 0), W(sp[1], t, 0), W(sp[1], t + bw, 0), W(sp[0], t + bw, 0)];
        faces.push(planeFace(c.map((p) => add3(p, mul(F.n, bh))), planeFill([176, 140, 96]), F.n, { group: `${tag}:batten` }));
        faces.push(planeFace([c[0], c[1], add3(c[1], mul(F.n, bh)), add3(c[0], mul(F.n, bh))], shadeHexMat(rgbHex([150, 118, 80]), mul(F.u, -1), mat, { light }), mul(F.u, -1), { group: `${tag}:batten` }));
        report.battens.count++; report.battens.lengthFt += (sp[1] - sp[0]) * toFt;
      }
      continue;
    }
    const units = [];                                                        // { s0, t0, w, shape, kind }
    const th = d.thick * mmU, dep = (d.depth || 0) * mmU;
    // verges: a closure the height of the covering along each open, non-eave edge, facing out of the plane
    const hv = (2 * d.thick + (d.depth || 0) + 10) * mmU;
    for (let i = 0; i < pl.corners.length; i++) {
      const a = pl.corners[i], b = pl.corners[(i + 1) % pl.corners.length];
      const pa = F.poly[i], pb = F.poly[(i + 1) % F.poly.length];
      if (dmath.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) < 1e-3 || (pa[1] < 1e-3 && pb[1] < 1e-3) || shared(a, b, pi)) continue;
      let out = unit3(cross(sub(b, a), F.n));
      const mid = mul(add3(a, b), 0.5), cen = pl.corners.reduce((m, c) => add3(m, mul(c, 1 / pl.corners.length)), [0, 0, 0]);
      if (dot(out, sub(mid, cen)) < 0) out = mul(out, -1);
      faces.push(planeFace([a, b, add3(b, mul(F.n, hv)), add3(a, mul(F.n, hv))], shadeHexMat(rgbHex(cov.rgb.map((v) => v * 0.78)), out, mat, { light }), out, { group: `${tag}:verge` }));
    }
    if (d.profile === 'seam') {
      const P = d.cover * mmU, rib = d.seam * mmU, rw = 25 * mmU;
      for (let s = F.sMin; s < F.sMax - 1e-6; s += P) {
        const s1 = Math.min(s + P, F.sMax);
        const a = spanAt(F.poly, 1, s + 1e-4), b = spanAt(F.poly, 1, s1 - 1e-4);
        if (!a || !b) continue;
        const c = [W(s, a[0], th), W(s1, b[0], th), W(s1, b[1], th), W(s, a[1], th)];
        faces.push(planeFace(c, planeFill(cov.rgb), F.n, { group: `${tag}:pan` }));
        if (s1 < F.sMax - 1e-6) {
          const sp = spanAt(F.poly, 1, s1);
          if (!sp) continue;
          const lo = sp[0], hi = sp[1];
          const up = mul(F.n, rib);
          const q = [W(s1 - rw / 2, lo, th), W(s1 + rw / 2, lo, th), W(s1 + rw / 2, hi, th), W(s1 - rw / 2, hi, th)];
          faces.push(planeFace(q.map((p) => add3(p, up)), planeFill(cov.rgb.map((v) => v * 1.08)), F.n, { group: `${tag}:seam` }));
          for (const [i0, i1, sg] of [[0, 3, -1], [1, 2, 1]]) {
            const nn = mul(F.e, sg);
            faces.push(planeFace([q[i0], q[i1], add3(q[i1], up), add3(q[i0], up)], shadeHexMat(rgbHex(cov.rgb), nn, mat, { light }), nn, { group: `${tag}:seam` }));
          }
        }
        pr.units++;
      }
      report.units += pr.units;
      continue;
    }
    const covers = Array.isArray(d.cover) ? d.cover : [d.cover];
    const len = g * 1.5;
    for (let k = 0; k * g < F.tMax - g * 0.35; k++) {
      const t0 = k * g, tm = Math.min(t0 + g / 2, F.tMax - 1e-4);
      const sp = spanAt(F.poly, 0, tm);
      if (!sp) continue;
      const ch = hash3(seed, 31 + (pl.key ? String(pl.key).length : pi), k);
      let s = sp[0] - (d.bond === 'half' ? (k % 2) * covers[0] * mmU / 2 : d.bond === 'broken' ? hf(ch, 0) * covers[0] * mmU : 0);
      for (let n = 0; s < sp[1] - 1e-6; n++) {
        const w = covers.length > 1 ? covers[Math.floor(hf(hash3(ch, n, 2), 0) * covers.length)] * mmU : covers[0] * mmU;
        const a = Math.max(s, sp[0]), b = Math.min(s + w, sp[1]);
        if (d.profile === 'flat') {
          if (b - a > w * 0.25) units.push({ s0: a, t0, w: b - a, kind: 'unit', k, n });
        } else if (d.profile === 'barrel') {
          const pw = w * 0.8;                                                // the pan; the cover rides the gap to its right
          if (s >= sp[0] - w * 0.2 && s + pw <= sp[1] + w * 0.2) units.push({ s0: s, t0, w: pw, kind: 'pan', k, n });
          if (s + w < sp[1] - w * 0.2) units.push({ s0: s + pw + (w - pw) / 2 - w * 0.3, t0, w: w * 0.6, kind: 'cover', k, n });
        } else if ((b - a) / w > 0.6) units.push({ s0: s, t0, w, kind: 'unit', k, n });
        s += w;
      }
    }
    // shapes: a unit's shell in world directions relative to its anchor; identical shells stamp as one repeat
    const shapes = new Map();
    const shellOf = (u) => {
      const key = `${u.kind}:${Math.round(u.w * 1e4)}`;
      if (shapes.has(key)) return key;
      let local;
      if (u.kind === 'pan') local = unitShell(u.w, len, th, th, PROFILES.pan, dep);
      else if (u.kind === 'cover') { const pf = (x) => 0.29 + (0.45 * u.w / Math.max(dep, 1e-6)) * PROFILES.cover(x); local = unitShell(u.w, len, th, th, pf, dep); }
      else local = unitShell(u.w, len, th, th, d.profile === 'flat' ? null : PROFILES[d.profile], dep);
      const tpl = local.map((q) => {
        const cs = q.map(([s, t, h]) => add3(add3(mul(F.e, s), mul(F.u, t)), mul(F.n, h)));
        let nn = unit3(cross(sub(cs[1], cs[0]), sub(cs[3], cs[0])));
        if (dot(nn, F.n) < -0.2 || (Math.abs(dot(nn, F.n)) <= 0.2 && dot(nn, F.u) > 0)) nn = mul(nn, -1);
        return { cs, nn };
      });
      shapes.set(key, { tpl, list: [] });
      return key;
    };
    for (const u of units) shapes.get(shellOf(u)).list.push(u);
    for (const [key, { tpl, list }] of shapes) {
      const tint = (u) => { const v = 1 + d.vary * (2 * hf(hash3(seed + 5, u.k, u.n + (u.kind === 'cover' ? 997 : 0)), 0) - 1); return [v, v * (1 + 0.02 * (hf(hash3(u.k, u.n, 9), 0) - 0.5)), v]; };
      const baseFaces = tpl.map(({ cs, nn }) => ({ corners: cs, fill: shadeHexMat(rgbHex(cov.rgb), nn, mat, { light }), normal: nn, outNormal: nn, doubleSided: true }));
      if (instance && list.length >= 4) {
        const tagK = `${tag}:${key}`;
        repeats.push({
          group: tagK,
          template: tagFacesWithMaterial(baseFaces.map((f) => ({ ...f, corners: f.corners.map((c) => c.map(q6)), group: tagK })), mat),
          transforms: list.map((u) => ({ pos: W(u.s0, u.t0, 0).map(q6), tint: tint(u).map((v) => Math.round(v * 1e4) / 1e4) })),
        });
      } else {
        for (const u of list) {
          const at = W(u.s0, u.t0, 0), tt = tint(u);
          for (const f of baseFaces) faces.push({ ...f, fill: rgbHex(hexRgb(f.fill).map((v, i) => Math.min(255, v * tt[i]))), corners: f.corners.map((c) => add3(c, at).map(q6)), group: `${tag}:${key}` });
        }
      }
      pr.units += list.length;
    }
    report.units += pr.units;
  }

  // ── caps on the ridges and hips (where two covered planes meet convex) ──
  if (stage === 'covered' && frames.length) {
    const edges = [];
    for (const { pl, F } of frames) {
      const cs = pl.corners;
      for (let i = 0; i < cs.length; i++) {
        const a = cs[i], b = cs[(i + 1) % cs.length];
        if (dmath.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) < 1e-3) continue;
        edges.push({ a, b, F, c: cs.reduce((m, p) => add3(m, mul(p, 1 / cs.length)), [0, 0, 0]) });
      }
    }
    const lines = [];
    for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
      const E = edges[i], G = edges[j];
      if (E.F === G.F) continue;
      if (!((near(E.a, G.a) && near(E.b, G.b)) || (near(E.a, G.b) && near(E.b, G.a)))) continue;
      const m = mul(add3(E.a, E.b), 0.5), c = mul(add3(E.c, G.c), 0.5);
      if (c[2] < m[2] - 1e-3) lines.push({ a: E.a[2] <= E.b[2] ? E.a : E.b, b: E.a[2] <= E.b[2] ? E.b : E.a, level: planeLevel(cov.detail, (d.gauge || d.cover) / 1000, [E.a, E.b], unit, o.eyes) });
    }
    const capMat = mat;
    const r = (d.cap === 'noshi' ? 90 : d.cap === 'fold' ? 120 : d.cap === 'flashing' ? 130 : 135) * mmU;
    const base = d.cap === 'flashing' ? d.thick * mmU : (2 * d.thick + (d.depth || 0)) * mmU;
    for (const [li, L] of lines.entries()) {
      const ex = unit3(sub(L.b, L.a)); const Lh = dmath.hypot(L.b[0] - L.a[0], L.b[1] - L.a[1], L.b[2] - L.a[2]);
      let ez = sub([0, 0, 1], mul(ex, ex[2])); ez = unit3(ez); const ey = cross(ez, ex);
      const Wl = (x, y, z) => add3(add3(add3(L.a, mul(ex, x)), mul(ey, y)), mul(ez, z));
      report.caps.lines++; report.caps.lengthFt += Lh * toFt;
      const capRgb = cov.rgb.map((v) => v * 0.92);
      const emit = (quads, at, gtag, tint = null) => {
        for (const q of quads) {
          const cs = q.map(([x, y, z]) => Wl(x + at, y, z));
          let nn = unit3(cross(sub(cs[1], cs[0]), sub(cs[3], cs[0]))); if (nn[2] < 0) nn = mul(nn, -1);
          faces.push({ corners: cs.map((p) => p.map(q6)), fill: shadeHexMat(rgbHex(tint ? capRgb.map((v, i) => v * tint[i]) : capRgb), nn, capMat, { light }), normal: nn, outNormal: nn, doubleSided: true, group: gtag });
        }
      };
      const gtag = `${group}:cap:${li}`;
      if (L.level !== 'units') { emit(capShell(d.cap === 'noshi' ? 'roll' : d.cap, Lh, r * 1.1, base), 0, gtag); continue; }
      if (d.cap === 'noshi') {
        // a stack of noshi-gawara, each course narrower, then the kanmuri roll along the top
        let z = base;
        for (let s = 0; s < 3; s++) {
          const hw = (170 - s * 30) * mmU, h = 30 * mmU;
          emit([[[0, -hw, z + h], [Lh, -hw, z + h], [Lh, hw, z + h], [0, hw, z + h]], [[0, -hw, z], [Lh, -hw, z], [Lh, -hw, z + h], [0, -hw, z + h]], [[0, hw, z], [Lh, hw, z], [Lh, hw, z + h], [0, hw, z + h]]], 0, gtag, [0.94 - s * 0.03, 0.94 - s * 0.03, 0.96 - s * 0.03]);
          z += h;
        }
        const step = 300 * mmU, n = Math.max(1, Math.round(Lh / step)), cl = Lh / n;
        for (let k = 0; k < n; k++) emit(capShell('roll', cl * 0.97, r, z), k * cl, gtag);
        continue;
      }
      if (d.cap === 'flashing') { emit(capShell('flashing', Lh, r, base), 0, gtag); continue; }
      const step = (d.cap === 'fold' ? d.cover : 330) * mmU, n = Math.max(1, Math.round(Lh / step)), cl = Lh / n;
      for (let k = 0; k < n; k++) { const v = 1 + d.vary * (2 * hf(hash3(seed, 700 + li, k), 0) - 1); emit(capShell(d.cap, cl * 0.98, r, base), k * cl, gtag, [v, v, v]); }
    }
  }
  report.areaSqFt = Math.round(report.areaSqFt);
  report.caps.lengthFt = Math.round(report.caps.lengthFt * 10) / 10;
  report.battens.lengthFt = Math.round(report.battens.lengthFt);
  if (d.gauge && stage === 'covered') report.gaugeMm = d.gauge;
  return { faces: tagFacesWithMaterial(faces, mat), repeats, report };
}
