// construction/sheets — the manufactured boards furniture is cut from: what each is, how stiff and how it creeps, how
// well it holds a screw, the sizes it comes in, and what its faces and edges look like.
//
// A sheet member (frame.js, `material: 'particleboard' | 'mfc' | 'mdf' | 'plywood' | 'osb' | 'hardboard'`) is a board
// whose local z is its thickness and whose local x runs its length (a plywood sheet's face grain). Its six sides are
// two FACES (±z) and four EDGES, and they wear different things:
//   · particleboard: fine particles on the faces; on a raw edge, the coarse flaked core between two fine skins;
//   · MDF: a fine, even speckle, a little fuzzier on the edge;
//   · plywood: the face is a rotary-cut veneer — the log field (log.js) read along the unrolled spiral a lathe peels —
//     and the edge shows its plies, long grain and end grain alternating, with glue lines between;
//   · OSB: oriented strands, the face layer running the sheet's length;
//   · hardboard: dense and dark; melamine-faced board (MFC): a particleboard core with a decor face (a flat colour, the
//     `finish`), and its edges banded to match unless an edge is left `none`.
// Figures are stored relative to the board's base colour, like timber's, so a stain or lacquer is a tint and paint
// covers it. Faces tile (the World repeats textures), so every sheet of one material shares one face tile.
//
// Mechanical rows for the common 13–20 mm band: E is the MEAN bending stiffness (what a deflection is computed with),
// MOR the characteristic bending strength, from EN 12369-1 for particleboard (P4), MDF and OSB/3 and a birch maker's
// table for plywood; with Eurocode 5's creep factor k_def for service class 1 (indoors): long-term deflection =
// instant × (1 + k_def). Values not from a standard are marked `est`.
import { registerTextureResolver, encodePng } from '../landscape/surface-textures.js';
import { FINISHES, hexRgb } from './timber.js';
import { makeLog } from './log.js';
import { figureAt, rayField } from './figure.js';

export const SHEETS = Object.freeze({
  particleboard: {
    title: 'particleboard (EN 312)', figure: 'particle', base: [204, 176, 132],
    density: 650, E: 3.2, MOR: 14.2, kdef: 2.25, holding: { face: 'fair', edge: 'poor' },
    thicknesses: [8, 10, 12, 15, 16, 18, 19, 22, 25, 30], sheet: [2800, 2070], rotate: true,
  },
  mfc: {
    title: 'melamine-faced chipboard', figure: 'particle', base: [204, 176, 132], decor: '#efece4', banded: true,
    density: 650, E: 3.2, MOR: 14.2, kdef: 2.25, holding: { face: 'fair', edge: 'poor' },
    thicknesses: [8, 10, 12, 15, 16, 18, 19, 22, 25], sheet: [2800, 2070], rotate: true,
  },
  mdf: {
    title: 'MDF (EN 622-5)', figure: 'mdf', base: [178, 142, 102],
    density: 750, E: 3.7, MOR: 21, kdef: 2.25, holding: { face: 'good', edge: 'fair' },
    thicknesses: [3, 6, 9, 12, 15, 16, 18, 19, 22, 25, 30], sheet: [2440, 1220], rotate: true,
  },
  plywood: {
    title: 'birch plywood (EN 636)', figure: 'ply', base: [232, 212, 176], veneer: 'birch', plyMm: 1.4,
    density: 680, E: 8.3, MOR: 50, kdef: 0.8, holding: { face: 'good', edge: 'good' }, est: true,
    thicknesses: [4, 6.5, 9, 12, 15, 18, 21, 24], sheet: [2500, 1250], rotate: false,
  },
  osb: {
    title: 'OSB/3 (EN 300)', figure: 'osb', base: [214, 180, 120],
    density: 620, E: 4.93, MOR: 16.4, kdef: 1.5, holding: { face: 'good', edge: 'fair' },
    thicknesses: [9, 11, 12, 15, 18, 22, 25], sheet: [2440, 1220], rotate: false,
  },
  hardboard: {
    title: 'hardboard (EN 622-2)', figure: 'mdf', base: [122, 88, 60],
    density: 950, E: 3.5, MOR: 30, kdef: 2.25, holding: { face: 'poor', edge: 'poor' }, est: true,
    thicknesses: [3, 3.2, 4, 5, 6], sheet: [2440, 1220], rotate: true,
  },
});
export const SHEET_KEYS = Object.freeze(Object.keys(SHEETS));
export const isSheet = (material) => Object.prototype.hasOwnProperty.call(SHEETS, material);

/** The means the figures fade to (relative to base): what a flat or far face is drawn in. */
const MEAN = { particle: [0.9, 0.89, 0.87], mdf: [0.95, 0.95, 0.95], ply: [0.93, 0.92, 0.9], osb: [0.86, 0.84, 0.8] };
export const sheetFigureMean = (material) => MEAN[SHEETS[material].figure];

/**
 * The colour a sheet's face and its edges wear → { face: { mode, rgb }, edge: { mode, rgb } }. The face takes the
 * finish (a name from timber's FINISHES, { stain }, { paint }); MFC's face is its decor (default white) and its edge
 * the core's figure unless banded. `band` is an edge band: 'abs' (the face's colour), or { paint }.
 */
export function sheetColor(material, { finish, tint } = {}) {
  const row = SHEETS[material];
  const base = hexRgb(tint) || row.base;
  let face;
  const fin = finish !== undefined ? finish : (row.decor ? { paint: row.decor } : undefined);
  if (fin && typeof fin === 'object' && fin.paint) face = { mode: 'paint', rgb: hexRgb(fin.paint) };
  else if (fin && typeof fin === 'object' && fin.stain) { const s = hexRgb(fin.stain); face = { mode: 'figure', rgb: base.map((v, i) => (v * s[i]) / 255) }; }
  else {
    const f = FINISHES[typeof fin === 'string' ? fin : 'raw'];
    face = f.mode === 'paint' ? { mode: 'paint', rgb: f.color.slice() } : { mode: 'figure', rgb: base.map((v, i) => v * f.tint[i]) };
  }
  // an unbanded edge of a decor or painted board shows its raw core
  const edge = row.decor || (fin && typeof fin === 'object' && fin.paint) ? { mode: 'figure', rgb: row.base.slice() } : face;
  return { face, edge };
}

/** Why an edge-band spec is invalid, or null: { front|back|left|right|top|bottom|all|±x…: 'abs' | 'none' | { paint } }. */
export const EDGE_NAMES = Object.freeze({ front: '-y', back: '+y', left: '-x', right: '+x', top: '+z', bottom: '-z' });
export function edgesError(edges) {
  if (edges === undefined) return null;
  if (!edges || typeof edges !== 'object' || Array.isArray(edges)) return 'edges: an object like { front: \'abs\', back: \'none\' }';
  for (const [k, v] of Object.entries(edges)) {
    if (!(k === 'all' || EDGE_NAMES[k] || /^[+-][xyz]$/.test(k))) return `edges.${k}: one of all, front, back, left, right, top, bottom (front is −y), or ±x / ±y / ±z`;
    if (!(v === 'abs' || v === 'none' || (v && typeof v === 'object' && hexRgb(v.paint)))) return `edges.${k}: 'abs' (matches the face), 'none' (raw), or { paint: '#rrggbb' }`;
  }
  return null;
}
/** The band on the edge facing world direction `dir` ('+x' …) → 'abs' | 'none' | { paint }. */
export function bandFor(material, edges, dir) {
  const e = edges || {};
  const named = Object.entries(EDGE_NAMES).find(([, d]) => d === dir);
  const v = e[dir] ?? (named ? e[named[0]] : undefined) ?? e.all;
  return v !== undefined ? v : (SHEETS[material].banded ? 'abs' : 'none');
}

// ── the figures ──────────────────────────────────────────────────────────────────────────────────────────────────

export const SHEET_TEXTURE_PREFIX = 'sheet:';
const FACE_TILE = 0.256;           // m a face tile spans
const EDGE_TILE = 0.064;           // m an edge tile spans along the edge
const b64u = (s) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
function mix(n) { n = Math.imul(n ^ (n >>> 16), 0x7feb352d); n = Math.imul(n ^ (n >>> 15), 0x846ca68b); return (n ^ (n >>> 16)) >>> 0; }
const h3 = (a, b, c) => mix((Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0) / 4294967296;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * The tile a side wears → { key, tileU, tileV } (metres a tile spans along the side's u and v; tileV null when the
 * texture spans the side exactly, as an edge spans the thickness). `side` 'face' | 'edge-long' | 'edge-end'.
 */
export function sheetTile(material, side, { thickMm, seed = 1 }) {
  const row = SHEETS[material];
  if (side === 'face') {
    const tile = row.figure === 'ply' ? 0.6 : FACE_TILE;
    const px = row.figure === 'ply' ? 0.0015 : 0.001;
    const n = Math.round(tile / px);
    return { key: sheetKey({ m: row.figure, side, seed, ...(row.veneer ? { veneer: row.veneer } : {}), tile, nu: n, nv: n }), tileU: tile, tileV: tile };
  }
  const nu = Math.round(EDGE_TILE / 0.00025), nv = Math.min(MAX_EDGE_NV, Math.max(8, Math.round(thickMm / 0.25)));
  return { key: sheetKey({ m: row.figure, side, seed, t: thickMm, ...(row.plyMm ? { ply: row.plyMm } : {}), nu, nv }), tileU: EDGE_TILE, tileV: null };
}
const sheetKey = (o) => SHEET_TEXTURE_PREFIX + b64u(JSON.stringify(o));

// A key is recipe text as well (a dungeon's style, an extrude's wrap and a figure's skin name a texture), so a key is
// baked only in the shape sheetTile mints: a known figure and side, a face at most 512 pixels square, an edge 256
// along by a pixel per 0.25 mm of thickness up to 512 mm (2048; a thicker board's edge pixel grows), the veneer a
// sheet names and dressSheet's seed (0–6). The bake's time and memory grow with the pixels.
const MAX_FACE_N = 512, MAX_EDGE_NV = 2048;
const FIGURES = new Set(Object.values(SHEETS).map((r) => r.figure));
const VENEERS = new Set(Object.values(SHEETS).map((r) => r.veneer).filter(Boolean));
const pos = (v) => Number.isFinite(v) && v > 0;
const upTo = (n, max) => Number.isInteger(n) && n >= 1 && n <= max;
function inReach(p) {
  if (!FIGURES.has(p.m) || !(Number.isInteger(p.seed) && p.seed >= 0 && p.seed < 7)) return false;
  if (p.side === 'face') return upTo(p.nu, MAX_FACE_N) && upTo(p.nv, MAX_FACE_N) && pos(p.tile) && (p.veneer === undefined || VENEERS.has(p.veneer));
  if (p.side !== 'edge-long' && p.side !== 'edge-end') return false;
  return upTo(p.nu, Math.round(EDGE_TILE / 0.00025)) && upTo(p.nv, MAX_EDGE_NV) && pos(p.t) && (p.ply === undefined || pos(p.ply));
}

/** Particleboard: Voronoi flakes, fine near a face and coarse in the core, flattened in the board's plane. */
function particleAt(u, v, depthMm, seed, edge) {
  const core = smoothstep(1.2, 3.5, depthMm);                      // 0 in the fine skins, 1 in the core
  const s = 0.6 + 2.4 * core;                                      // flake size, mm
  const ax = edge ? 3 : 1;                                         // on an edge the flakes show as slivers
  const gu = u / (s * ax), gv = v / s;
  const iu = Math.floor(gu), iv = Math.floor(gv);
  let best = Infinity, id = 0;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const cu = iu + a, cv = iv + b;
    const pu = cu + h3(cu, cv, seed), pv = cv + h3(cv, cu, seed + 7);
    const d = (pu - gu) ** 2 + (pv - gv) ** 2;
    if (d < best) { best = d; id = mix((cu * 73856093) ^ (cv * 19349663) ^ seed); }
  }
  const r = (id % 10000) / 10000;
  let L = 0.9 + 0.16 * (r - 0.5);
  if (r > 0.965) L *= 0.62;                                        // a bark fleck or a dark chip
  if (core > 0.5 && r < 0.025) L *= 0.5;                           // a void in the core
  return [L * 1.01, L, L * 0.97];
}
const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
/** Value noise, one octave, cell `c` mm. */
function vnoise(u, v, c, seed) {
  const x = u / c, y = v / c, i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const n = (a, b) => h3(a, b, seed);
  return (n(i, j) * (1 - sx) + n(i + 1, j) * sx) * (1 - sy) + (n(i, j + 1) * (1 - sx) + n(i + 1, j + 1) * sx) * sy;
}
function mdfAt(u, v, edge, seed) {
  const L = 0.95 + 0.05 * (vnoise(u, v, 0.4, seed) - 0.5) + 0.03 * (vnoise(u, v, 3, seed + 1) - 0.5) - (edge ? 0.04 : 0);
  return [L, L, L];
}
/** OSB: strands ~80×20 mm laid along u within ±20°; the top-most strand covering a point shows. */
function osbAt(u, v, seed) {
  const cu = 40, cv = 14; const iu = Math.floor(u / cu), iv = Math.floor(v / cv);
  let top = -1, L = 0.55;
  for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
    const gu = iu + a, gv = iv + b;
    const h = mix((gu * 83492791) ^ (gv * 2971215073) ^ seed);
    const x0 = (gu + h3(gu, gv, seed)) * cu, y0 = (gv + h3(gv, gu, seed + 3)) * cv;
    const ang = (h3(gu, gv, seed + 5) - 0.5) * 0.7; const len = 60 + 40 * h3(gu, gv, seed + 9), wid = 14 + 10 * h3(gv, gu, seed + 11);
    const dx = u - x0, dy = v - y0; const c = Math.cos(ang), s = Math.sin(ang);
    const along = dx * c + dy * s, across = -dx * s + dy * c;
    if (Math.abs(along) > len / 2 || Math.abs(across) > wid / 2) continue;
    if (h <= top) continue;
    top = h;
    const tone = 0.82 + 0.26 * ((h % 1000) / 1000 - 0.5);
    L = tone * (0.94 + 0.06 * Math.sin(across * 3.1 + (h % 7)));   // fibres along the strand
  }
  return [L * 1.02, L, L * 0.95];
}
/** Plywood edge: plies of `ply` mm, long grain and end grain alternating from the face ply, glue lines between. */
function plyEdgeAt(u, depthMm, ply, longFirst) {
  const k = Math.floor(depthMm / ply), f = depthMm / ply - k;
  if (f < 0.06 || f > 0.94) return [0.62, 0.58, 0.52];              // glue line
  const long = (k % 2 === 0) === longFirst;
  if (long) { const L = 0.95 + 0.04 * Math.sin(depthMm * 23 + k); return [L, L, L]; }
  const L = 0.8 + 0.05 * Math.sin(u * 2.3 + k * 1.7);               // end grain: darker, dotted by fibre bundles
  return [L, L * 0.98, L * 0.95];
}

const LOGS = new Map();
function veneerLog(species, seed) {
  const k = `${species}:${seed}`;
  if (!LOGS.has(k)) LOGS.set(k, makeLog({ species, age: 70, length: 1.2, seed, knots: 'few' }));
  return LOGS.get(k);
}

/**
 * Bake a key → { rgb, nu, nv }, or null for a malformed key or one past what sheetTile mints. Row 0 is the top of the
 * image (v = 1), uv's convention.
 */
export function bakeSheetKey(key) {
  let p;
  try { p = JSON.parse(unb64u(key.slice(SHEET_TEXTURE_PREFIX.length))); } catch { return null; }
  if (!p || typeof p !== 'object' || !inReach(p)) return null;
  const face = p.side === 'face';
  let rot = null;
  if (p.m === 'ply' && face) {
    // rotary veneer: the lathe peels the log from radius R0 inward; unrolled, v is arc length round the log, u runs
    // up it. The log's ovality and wobble make the knife cross the rings: the wide wandering figure of a peeled face.
    let log; try { log = veneerLog(p.veneer || 'birch', p.seed); } catch { return null; }
    rot = { log, rays: rayField(log), R0: 0.16, t: 0.0014 };
  }
  const { nu, nv } = p; const rgb = Buffer.alloc(nu * nv * 3);
  for (let j = 0; j < nv; j++) {
    const fv = 1 - (j + 0.5) / nv;
    for (let i = 0; i < nu; i++) {
      const fu = (i + 0.5) / nu;
      let c;
      if (face) {
        const u = fu * p.tile * 1000, v = fv * p.tile * 1000;          // mm
        if (p.m === 'particle') c = particleAt(u, v, 0.3, p.seed, false);
        else if (p.m === 'mdf') c = mdfAt(u, v, false, p.seed);
        else if (p.m === 'osb') c = osbAt(u, v, p.seed);
        else {
          const s = v / 1000, R = rot.R0 - (rot.t * s) / (2 * Math.PI * rot.R0), th = s / rot.R0, z = 0.1 + u / 1000;
          const px = p.tile / nu;
          const q = [R * Math.cos(th), R * Math.sin(th), z];
          c = figureAt(rot.log, rot.rays, q, [0, 0, px], [-Math.sin(th) * px, Math.cos(th) * px, 0]);
        }
      } else {
        const u = fu * EDGE_TILE * 1000, depth = fv * p.t;              // mm along the edge, mm from the bottom face
        const fromFace = Math.min(depth, p.t - depth);
        if (p.m === 'particle') c = particleAt(u, depth, fromFace, p.seed, true);
        else if (p.m === 'mdf') c = mdfAt(u, depth * 3, true, p.seed);
        else if (p.m === 'osb') c = osbAt(u, depth * 6, p.seed);
        else c = plyEdgeAt(u, depth, p.ply || 1.4, p.side === 'edge-long');
      }
      const k = (j * nu + i) * 3;
      rgb[k] = Math.round(255 * clamp01(c[0])); rgb[k + 1] = Math.round(255 * clamp01(c[1])); rgb[k + 2] = Math.round(255 * clamp01(c[2]));
    }
  }
  return { rgb, nu, nv };
}

const URLS = new Map(); const MAX_URLS = 64;
export function resolveSheetTexture(key) {
  if (URLS.has(key)) { const v = URLS.get(key); URLS.delete(key); URLS.set(key, v); return v; }
  const b = bakeSheetKey(key); if (!b) return null;
  const url = `data:image/png;base64,${encodePng(b.rgb, b.nu, b.nv).toString('base64')}`;
  URLS.set(key, url); if (URLS.size > MAX_URLS) URLS.delete(URLS.keys().next().value);
  return url;
}
registerTextureResolver(SHEET_TEXTURE_PREFIX, resolveSheetTexture);

/** Why a thickness is not one the material is sold in, or null (advisory: a stamp, not an error). */
export function thicknessAdvice(material, thickMm) {
  const row = SHEETS[material];
  if (row.thicknesses.some((t) => Math.abs(t - thickMm) < 0.05)) return null;
  return `${thickMm} mm is not a stock ${material} thickness (${row.thicknesses.join(', ')} mm)`;
}

