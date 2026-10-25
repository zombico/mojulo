/**
 * title-carve — the glyph carver's letters as the game's words: a HUD `title` row's text carved into 3D at resolve
 * time, for the page to slam onto the screen when its event fires ("ROUND 1", "FIGHT!", "K.O.", "LEVEL CLEAR").
 *
 * The carve kernel (lib/motion/glyph-carver.js: any UTF-8 character a font covers → styled contours; the pre-three
 * renderer's letter primitive) and the bevelled extruder (polygonizer/carve-solid.js extrudeProfile) make each
 * character a solid; the caps are tessellated (polygonizer/triangulate.js) so the page gets a plain triangle list. A
 * title's letters are carried as a GLYPH ATLAS — one indexed mesh per distinct character, per carve style — and the
 * page lays a run out by advance when the title fires, so a `{score}` substituted at play time still carves (the
 * digits ride along whenever a text carries a placeholder). The page bakes the look (cel bands or metal, the register's)
 * into vertex colour from the triangles' winding, so the atlas is colour-free and shared by every title that uses it.
 *
 *   TITLE_SIZING                         cap height = 1 (the page scales a word by its letter height); space, tracking
 *   needsShaping(text)                   the script that needs a shaping engine (Arabic, Hebrew, Thai, the Indic
 *                                        scripts …) — a title in it stays the DOM banner, which the browser shapes
 *   titleChars(text)                     the characters a text carves (its own, less placeholders and spaces; the
 *                                        digits and signs when it has a placeholder)
 *   carveTitles(widgets, opts?)          the title widgets → { styles: { <style>: { glyphs: { <ch>: { p, i, a } }, depth } },
 *                                        space, tracking, fallback: [{ on, text, reason }] } or null when none is a title.
 *                                        A title that cannot carve (no opentype.js, no font on the host, a shaped script,
 *                                        a character no font covers) is listed in `fallback` with its reason, and the
 *                                        caller lets it stay a banner — absence degrades a title to words on a plate,
 *                                        never breaks the world.
 *
 * The letters follow the host's faces: MOJULO_TITLE_FONT (a .ttf) first, then the cover shelf's vendored display face
 * when it is there, then bold display faces where macOS, Windows and Linux keep them, each character taking the first
 * face that covers it (a CJK face after a Latin one). Vendor a face to pin the letters across hosts. Deterministic for
 * a host: the same (text, style) carves the same bytes.
 *
 * Reads font files from the host (a data reader: scripts/test-changed.mjs DATA_READERS). Pure arithmetic otherwise.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { moduleDir } from '../../module-dir.js';
import { loadFont, glyphContours, styleContours, CARVE_STYLES } from '../../motion/glyph-carver.js';
import { extrudeProfile } from '../polygonizer/carve-solid.js';
import { triangulateRings } from '../polygonizer/triangulate.js';
import { TITLE_STYLES } from './hud-widgets.js';

const SHELF_DIR = path.resolve(moduleDir(import.meta.url, 'lib/graph/game'), '../image-outcomes/fonts');

/** The run's measures, in cap heights (the atlas normalizes every face so a capital stands 1 high). */
export const TITLE_SIZING = Object.freeze({ space: 0.6, tracking: 0.08 });

// the extrusion a title gets per carve style (depth in cap heights; the bevel rounds the front edge)
const EXTRUDE = Object.freeze({
  heavy: { depth: 0.28, bevel: 0.05, bevelSteps: 2 },
  blocky: { depth: 0.34, bevel: 0, bevelSteps: 0 },
  slick: { depth: 0.2, bevel: 0.04, bevelSteps: 2 },
  thin: { depth: 0.16, bevel: 0.03, bevelSteps: 2 },
  italic: { depth: 0.22, bevel: 0.04, bevelSteps: 2 },
});
const CURVE_STEPS = 5;   // the page draws letters at a glance, not a wordmark up close
// the blocky carve is RASTERED, not snapped: the outline's even-odd fill sampled on a grid of cells per cap height, each
// filled cell a block (the pixel-art letter; a snapped outline touches itself in a thin stroke and its cap tears). The
// same raster, finer, is the guard for any glyph whose cap tessellation fails to cover its footprint (a thin carve's
// erosion can fold an outline): a chunkier letter, never a torn one.
export const TITLE_GRID = Object.freeze({ blocky: 12, guard: 24 });
const COVERAGE_TOLERANCE = 0.015;

// faces tried in order, a character taking the first that covers it; .ttc collections are not parsed by opentype.js
const HOST_FONTS = Object.freeze([
  '/System/Library/Fonts/Supplemental/Arial Black.ttf', '/System/Library/Fonts/Supplemental/Impact.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
  '/System/Library/Fonts/Supplemental/AppleGothic.ttf',
  'C:\\Windows\\Fonts\\impact.ttf', 'C:\\Windows\\Fonts\\ariblk.ttf', 'C:\\Windows\\Fonts\\arialbd.ttf',
  'C:\\Windows\\Fonts\\malgunbd.ttf', 'C:\\Windows\\Fonts\\simhei.ttf', 'C:\\Windows\\Fonts\\arial.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf', '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
  '/usr/share/fonts/truetype/fonts-japanese-gothic.ttf', '/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf',
  '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
]);

/** The faces a title tries, in order: the env's, the shelf's vendored display face, then the host's. */
export function titleFontPaths(env = process.env) {
  const out = [];
  if (env.MOJULO_TITLE_FONT) out.push(env.MOJULO_TITLE_FONT);
  out.push(path.join(SHELF_DIR, 'archivo-black.ttf'));
  out.push(...HOST_FONTS);
  return out;
}

let _fonts = null, _fontsReason = null;
function fonts() {
  if (_fonts) return _fonts;
  const loaded = [];
  for (const p of titleFontPaths()) {
    if (!existsSync(p)) continue;
    try { loaded.push({ path: p, font: loadFont(readFileSync(p)) }); }
    catch (err) {
      // opentype.js itself missing (an optional dependency): every face fails the same way, say so once
      if (err && (err.code === 'MODULE_NOT_FOUND' || /opentype/i.test(String(err.message)))) { _fontsReason = 'no-opentype'; _fonts = []; return _fonts; }
      /* a face opentype.js cannot parse (a .ttc collection): the next */
    }
  }
  _fonts = loaded;
  _fontsReason = loaded.length ? null : 'no-font';
  return _fonts;
}
/** For tests: forget the loaded faces (a changed MOJULO_TITLE_FONT is read again). */
export function resetTitleFonts() { _fonts = null; _fontsReason = null; }

// scripts whose letters join, stack or reorder: the browser shapes them, the carver would not
const SHAPED = [
  ['arabic', /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/],
  ['hebrew', /[\u0590-\u05FF]/],
  ['syriac', /[\u0700-\u074F]/],
  ['devanagari', /[\u0900-\u097F]/], ['bengali', /[\u0980-\u09FF]/], ['gurmukhi', /[\u0A00-\u0A7F]/], ['gujarati', /[\u0A80-\u0AFF]/],
  ['oriya', /[\u0B00-\u0B7F]/], ['tamil', /[\u0B80-\u0BFF]/], ['telugu', /[\u0C00-\u0C7F]/], ['kannada', /[\u0C80-\u0CFF]/],
  ['malayalam', /[\u0D00-\u0D7F]/], ['sinhala', /[\u0D80-\u0DFF]/],
  ['thai', /[\u0E00-\u0E7F]/], ['lao', /[\u0E80-\u0EFF]/], ['tibetan', /[\u0F00-\u0FFF]/], ['myanmar', /[\u1000-\u109F]/], ['khmer', /[\u1780-\u17FF]/],
];
/** The shaped script a text is written in, or null when every character stands alone. */
export function needsShaping(text) {
  const s = String(text == null ? '' : text);
  for (const [name, re] of SHAPED) if (re.test(s)) return name;
  return null;
}

const PLACEHOLDER = /\{[^}]*\}/g;
const DIGITS_AND_SIGNS = '0123456789+-.:x%';
/** The characters a text carves: its own (placeholders and spaces out), and with a placeholder the digits and signs. */
export function titleChars(text) {
  const s = String(text == null ? '' : text);
  const has = PLACEHOLDER.test(s); PLACEHOLDER.lastIndex = 0;
  const set = new Set([...s.replace(PLACEHOLDER, '')].filter((c) => c.trim()));
  if (has) for (const c of DIGITS_AND_SIGNS) set.add(c);
  return [...set];
}

const q = (v) => Math.round(v * 1000);   // the atlas is quantized to a thousandth of a cap height
const signedArea = (ring) => { let s = 0; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]); return s / 2; };

/** The cap height of a face in em (its 'H'), the unit every glyph is scaled by. */
function capHeight(font) {
  if (!font.hasChar('H')) return 0.7;
  const { contours } = glyphContours(font, 'H', { curveSteps: 2 });
  let max = 0; for (const r of contours) for (const [, y] of r) if (y > max) max = y;
  return max > 0.1 ? max : 0.7;
}

const inside = (p, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], b = r[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
const insideAll = (p, rings) => { let n = 0; for (const r of rings) if (inside(p, r)) n++; return n % 2 === 1; };   // even-odd
const triArea = (t) => Math.abs((t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[2][0] - t[0][0]) * (t[1][1] - t[0][1])) / 2;
/** The footprint's even-odd area (a ring at odd nesting depth is a hole). */
function footprintArea(rings) {
  let a = 0;
  rings.forEach((r, i) => { let depth = 0; rings.forEach((o, j) => { if (i !== j && inside(r[0], o)) depth++; }); a += (depth % 2 ? -1 : 1) * Math.abs(signedArea(r)); });
  return a;
}

/** An indexed mesh builder in the atlas's frame (x right, y up, z toward the viewer at 0, the back at -depth). */
function meshBuilder() {
  const verts = new Map(), P = [], I = [];
  const vid = ([x, y, z]) => { const kx = q(x), ky = q(y), kz = q(z), key = kx + ',' + ky + ',' + kz; let id = verts.get(key); if (id === undefined) { id = P.length / 3; verts.set(key, id); P.push(kx, ky, kz); } return id; };
  // a triangle whose winding is made to face `n` (the outward direction the caller knows)
  const tri = (a, b, c, n) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const ia = vid(a), ib = vid(b), ic = vid(c);
    if (ia === ib || ib === ic || ia === ic) return;
    if (nx * n[0] + ny * n[1] + nz * n[2] < 0) I.push(ia, ic, ib); else I.push(ia, ib, ic);
  };
  const quad = (a, b, c, d, n) => { tri(a, b, c, n); tri(a, c, d, n); };
  return { tri, quad, P, I };
}

/**
 * The raster carve: the outline's even-odd fill sampled on cells 1/N cap heights wide (a cell is filled when its centre
 * is in, or two of its quarter points are: a thin diagonal stays joined), each filled cell a block of the given depth,
 * the walls where a filled cell meets an empty one. Always a clean closed mesh.
 */
export function rasterGlyphMesh(contours, N, depth) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of contours) for (const [x, y] of r) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const i0 = Math.floor(minX * N), i1 = Math.ceil(maxX * N), j0 = Math.floor(minY * N), j1 = Math.ceil(maxY * N);
  const W = i1 - i0, Hh = j1 - j0, cell = new Uint8Array(Math.max(0, W * Hh));
  const filled = (i, j) => i >= i0 && i < i1 && j >= j0 && j < j1 && cell[(j - j0) * W + (i - i0)] === 1;
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
    const cx = (i + 0.5) / N, cy = (j + 0.5) / N, h = 0.25 / N;
    let on = insideAll([cx, cy], contours);
    if (!on) { let k = 0; for (const [dx, dy] of [[-h, -h], [h, -h], [h, h], [-h, h]]) if (insideAll([cx + dx, cy + dy], contours)) k++; on = k >= 2; }
    if (on) cell[(j - j0) * W + (i - i0)] = 1;
  }
  const M = meshBuilder(), d = -depth;
  // a row's filled cells in runs: one block per run for the caps, the top and bottom walls in spans where the row
  // above or below is empty, a side wall at each end of the run
  for (let j = j0; j < j1; j++) {
    const y0 = j / N, y1 = (j + 1) / N;
    for (let i = i0; i < i1; i++) {
      if (!filled(i, j)) continue;
      let e = i; while (filled(e + 1, j)) e++;
      const x0 = i / N, x1 = (e + 1) / N;
      M.quad([x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0], [0, 0, 1]);     // the front
      M.quad([x0, y0, d], [x1, y0, d], [x1, y1, d], [x0, y1, d], [0, 0, -1]);    // the back
      M.quad([x0, y0, 0], [x0, y1, 0], [x0, y1, d], [x0, y0, d], [-1, 0, 0]);    // the run's left side
      M.quad([x1, y0, 0], [x1, y1, 0], [x1, y1, d], [x1, y0, d], [1, 0, 0]);     // its right side
      for (const [dj, ny, y] of [[1, 1, y1], [-1, -1, y0]]) {
        for (let a = i; a <= e; a++) {
          if (filled(a, j + dj)) continue;
          let b = a; while (b + 1 <= e && !filled(b + 1, j + dj)) b++;
          M.quad([a / N, y, 0], [(b + 1) / N, y, 0], [(b + 1) / N, y, d], [a / N, y, d], [0, ny, 0]);
          a = b;
        }
      }
      i = e;
    }
  }
  return { p: M.P, i: M.I };
}

/**
 * One character → an indexed mesh in cap-height units: front at z = 0 (toward the viewer), back at z = -depth, x right,
 * y up with the baseline at 0, winding carrying the outward normal (the page's flat normals read it).
 * Returns { p: [x, y, z, …] × 1000, i: [a, b, c, …], a: advance } or null when the face has no outline for it.
 */
export function carveGlyphMesh(font, ch, styleName, cap) {
  const raster = styleName === 'blocky';
  const style = { ...CARVE_STYLES[styleName], curveSteps: CURVE_STEPS, ...(raster ? { blocky: 0 } : {}) };   // the raster snaps, not the outline
  const { contours: raw, advance } = glyphContours(font, ch, style);
  if (!raw.length) return { p: [], i: [], a: +(advance / cap).toFixed(4) };
  const k = 1 / cap;
  const contours = styleContours(raw, style).map((r) => r.map(([x, y]) => [x * k, y * k])).filter((r) => r.length > 2);
  if (!contours.length) return { p: [], i: [], a: +(advance / cap).toFixed(4) };
  const ex = EXTRUDE[styleName] || EXTRUDE.heavy;
  if (raster) return { ...rasterGlyphMesh(contours, TITLE_GRID.blocky, ex.depth), a: +(advance / cap).toFixed(4) };
  // the guard: a cap whose tessellation does not cover the footprint (a folded outline) is rastered instead, finely
  const frontTris = triangulateRings(contours), want = footprintArea(contours);
  const got = frontTris.reduce((s, t) => s + triArea(t), 0);
  if (!(want > 0) || Math.abs(got / want - 1) > COVERAGE_TOLERANCE) return { ...rasterGlyphMesh(contours, TITLE_GRID.guard, ex.depth), a: +(advance / cap).toFixed(4) };
  const { faces } = extrudeProfile(contours, ex);
  // which rings are holes: the largest ring is an outer; a ring wound the other way is a hole
  const areas = contours.map(signedArea);
  let big = 0; areas.forEach((a, i) => { if (Math.abs(a) > Math.abs(areas[big])) big = i; });
  const outerSign = Math.sign(areas[big]) || 1;

  const verts = new Map(), P = [], I = [];
  const vid = ([x, y, z]) => {
    const kx = q(x), ky = q(y), kz = q(-z);   // z flipped: the front cap toward the viewer at 0, the back at -depth
    const key = kx + ',' + ky + ',' + kz;
    let id = verts.get(key);
    if (id === undefined) { id = P.length / 3; verts.set(key, id); P.push(kx, ky, kz); }
    return id;
  };
  // a triangle wound OUTWARD in the extruder's frame (z growing away from the viewer): the z flip is a mirror, which
  // reverses a winding, so the order is reversed with it and the page's flat normals come out outward again
  const tri = (a, b, c) => { const ia = vid(a), ib = vid(b), ic = vid(c); if (ia !== ib && ib !== ic && ia !== ic) I.push(ia, ic, ib); };
  // a triangle's winding in the x-y plane: counter-clockwise faces +z
  const ccw = (t) => (t[1][0] - t[0][0]) * (t[2][1] - t[0][1]) - (t[2][0] - t[0][0]) * (t[1][1] - t[0][1]) > 0;

  for (const f of faces) {
    if (f.kind === 'cap') {
      // in the extruder's frame the front cap (z = 0) faces -z, toward the viewer, and the back cap +z
      const z = f.contours[0][0][2], front = f.side === 'front';
      const rings = f.contours.map((r) => r.map(([x, y]) => [x, y]));
      for (const t of triangulateRings(rings)) {
        const w = ccw(t) === !front ? t : [t[0], t[2], t[1]];
        tri([w[0][0], w[0][1], z], [w[1][0], w[1][1], z], [w[2][0], w[2][1], z]);
      }
    } else {
      // a wall or bevel panel [F_i, F_j, B_j, B_i] runs along its ring: its right-hand normal points outward of the
      // solid when the outers run counter-clockwise (a hole, wound the other way, points into the hole, which is
      // outward too); outers running clockwise flip every panel
      const [a, b, c, d] = f.pts;
      if (outerSign > 0) { tri(a, b, c); tri(a, c, d); } else { tri(a, d, c); tri(a, c, b); }
    }
  }
  return { p: P, i: I, a: +(advance / cap).toFixed(4) };
}

/**
 * The title widgets' atlas. `widgets` are normalized hud widgets (hud-widgets.js normalizeHud); only `kind: 'title'`
 * rows count. Returns null when none is a title.
 */
export function carveTitles(widgets) {
  const titles = (Array.isArray(widgets) ? widgets : []).filter((w) => w && w.kind === 'title');
  if (!titles.length) return null;
  const out = { styles: {}, space: TITLE_SIZING.space, tracking: TITLE_SIZING.tracking, fallback: [] };
  const F = fonts();
  const caps = F.map(({ font }) => capHeight(font));
  for (const w of titles) {
    const styleName = TITLE_STYLES.includes(w.style) ? w.style : TITLE_STYLES[0];
    const shaped = needsShaping(w.text);
    if (shaped) { out.fallback.push({ on: w.on, text: w.text, reason: `shaped-script:${shaped}` }); continue; }
    if (!F.length) { out.fallback.push({ on: w.on, text: w.text, reason: _fontsReason || 'no-font' }); continue; }
    const glyphs = out.styles[styleName] ? out.styles[styleName].glyphs : {};
    const missing = [];
    for (const ch of titleChars(w.text)) {
      if (glyphs[ch]) continue;
      const k = F.findIndex(({ font }) => font.hasChar(ch));
      if (k < 0) { missing.push(ch); continue; }
      glyphs[ch] = carveGlyphMesh(F[k].font, ch, styleName, caps[k]);
    }
    if (missing.length) { out.fallback.push({ on: w.on, text: w.text, reason: `missing-glyphs:${missing.join('')}` }); continue; }
    if (!out.styles[styleName]) out.styles[styleName] = { glyphs, depth: (EXTRUDE[styleName] || EXTRUDE.heavy).depth };
  }
  if (!Object.keys(out.styles).length && !out.fallback.length) return null;
  return out;
}

/** The faces the host offers (their paths), for a readout; [] when none parses. */
export function titleFontsFound() { return fonts().map((f) => f.path); }
