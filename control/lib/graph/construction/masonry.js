// construction/masonry — walls laid in units, floors laid in tiles, roofs hung in slates. A frame entry's `walls`,
// `paving` and `slates` (frame.js); lengths in the frame's unit, unit sizes in millimetres.
//
// A WALL is a baseline (`from` → `to`, its foot), a `height`, a unit and a bond:
//   { id?, from, to, height, unit?: 'uk' | 'us' | 'roman' | 'japanese' | 'cmu' | 'ashlar' | { l, w, h, j },
//     bond?: 'stretcher' | 'english' | 'flemish' | 'header' | 'stack', leaves?, body?, stone?, mortar?, joint?: 'flush' |
//     'struck' | 'raked', flash?, lintel?: 'soldier' | 'stone', openings?: [{ at, width, height, sill? }], seed? }
// Units are laid course by course from the baseline. English bond alternates a course of stretchers with a course of
// headers (a queen closer after the first header keeps the quarter lap); Flemish alternates header and stretcher in
// every course, the closer shifting alternate courses; header and English and Flemish bonds need a wall a brick thick
// (two leaves), stretcher and stack bond a half-brick leaf. Openings are set to the course gauge (sill and head snap to
// the nearest bed joint; the report gives the snapped sizes), the units at a reveal are cut to it, and a soldier course
// (brick) or a stone lintel (ashlar) spans each head. Mortar is a backing recessed by the joint profile, so a raked joint
// reads as a shadow line. A brick's colour is its body (red, buff, blue engineering, London stock, gault, brown) jittered
// unit by unit, headers flashed darker in the bonds that show them; an ashlar stone wears a window of a stone surface.
//
// PAVING is a rectangle of tiles on a floor: { id?, origin:[x,y,z], size:[a, b], tile?: [l, w, t] mm, pattern?:
// 'stack' | 'running' | 'herringbone' | 'basketweave', stone?, grout?, gap?: mm, seed? }. Each tile wears its own window
// of the stone's surface (a marble slab's veins run on across a tile and change at the next).
//
// SLATES hang on a pitched plane from its eave: { id?, eave: [[x,y,z], [x,y,z]], pitch (degrees), run (horizontal
// metres up the slope, in the unit), side?: 1 | -1 (which side of the eave the roof rises), slate?: [l, w, t] mm,
// headlap?: mm, stone? }. Courses are laid at the gauge (length − headlap) / 2, alternate courses offset by half a slate.
import { shadeHexMat, DEFAULT_LIGHT } from '../polygonizer/vexar.js';
import { resolveMaterial, tagFacesWithMaterial } from '../polygonizer/materials.js';
import { memberFrame, toWorld, dirWorld } from './members.js';
import { rgbHex, hexRgb } from './timber.js';
import { registerTextureResolver, encodePng } from '../landscape/surface-textures.js';

function mix(n) { n = Math.imul(n ^ (n >>> 16), 0x7feb352d); n = Math.imul(n ^ (n >>> 15), 0x846ca68b); return (n ^ (n >>> 16)) >>> 0; }
const hash3 = (a, b, c) => mix((Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0);
const hf = (h, n) => mix((h + Math.imul(n + 1, 0x9e3779b9)) | 0) / 4294967296;

export const UNITS = Object.freeze({
  uk: { l: 215, w: 102.5, h: 65, j: 10 }, us: { l: 194, w: 92, h: 57, j: 9.5 }, roman: { l: 290, w: 90, h: 40, j: 10 },
  japanese: { l: 210, w: 100, h: 60, j: 10 }, cmu: { l: 390, w: 190, h: 190, j: 10, block: true },
  ashlar: { l: 600, w: 250, h: 300, j: 6, stone: true, vary: 0.35 },
});
export const BONDS = Object.freeze(['stretcher', 'english', 'flemish', 'header', 'stack']);
export const BODIES = Object.freeze({
  red: [150, 64, 46], buff: [198, 162, 112], blue: [62, 64, 74], stock: [192, 162, 106], gault: [214, 205, 180], brown: [118, 78, 56], block: [168, 166, 160],
});
export const MORTARS = Object.freeze({ lime: [208, 200, 184], grey: [152, 152, 148], dark: [84, 84, 82] });
export const JOINTS = Object.freeze({ flush: 0.0005, struck: 0.003, raked: 0.008 });
/** Stone surfaces a unit can wear: a surface-texture key (or a family), the metres one tile of it spans, and a tint. */
export const STONES = Object.freeze({
  'marble-carrara': { keys: ['marble-carrara'], m: 1.2 }, 'marble-calacatta': { keys: ['marble-calacatta'], m: 1.2 },
  'marble-verde': { keys: ['marble-verde'], m: 1.2 }, 'marble-nero': { keys: ['marble-nero'], m: 1.2 },
  granite: { keys: ['granite-grey'], m: 0.6 }, 'granite-pink': { keys: ['granite-pink'], m: 0.6 }, 'granite-black': { keys: ['granite-black'], m: 0.6 },
  slate: { keys: ['slate'], m: 0.6 }, 'slate-purple': { keys: ['slate-purple'], m: 0.6 }, 'slate-green': { keys: ['slate-green'], m: 0.6 },
  'slate-riven': { keys: ['slate-riven'], m: 0.6 },
  sandstone: { keys: ['rock-sandstone-a', 'rock-sandstone-b', 'rock-sandstone-c', 'rock-sandstone-d'], m: 1.0 },
  concrete: { keys: ['concrete-board'], m: 1.0 },
});

const isPt = (p) => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite);
const within = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
// Runaway guards. A custom brick, a tile and a slate have sizes a mason would lay (mm), and the units one recipe's
// frames lay one by one (every wall, floor and roof drawn as units) are counted before any is laid.
const UNIT_MM = [10, 1000], TILE_MM = [10, 3000], SLATE_MM = [10, 1500];
export const MAX_MASONRY_UNITS = 250000;
const customUnitOk = (u) => ['l', 'w', 'h'].every((k) => within(u[k], ...UNIT_MM)) && (u.j === undefined || within(u.j, 0, 50)) && (u.vary === undefined || within(u.vary, 0, 0.9));

/** Validate `walls`, `paving`, `slates` → string[]. */
export function validateMasonry(f, at) {
  const e = [];
  const unitOk = (u) => u === undefined || UNITS[u] || (u && typeof u === 'object' && customUnitOk(u));
  (f.walls || []).forEach((w, i) => {
    const t = `${at}.walls[${i}]`;
    if (!w || typeof w !== 'object') { e.push(`${t}: an object { from, to, height, unit?, bond? }`); return; }
    if (!isPt(w.from) || !isPt(w.to)) e.push(`${t}: from and to must be [x, y, z] (the wall's foot, along its centre)`);
    if (!(Number.isFinite(w.height) && w.height > 0)) e.push(`${t}.height: a positive length`);
    if (!unitOk(w.unit)) e.push(`${t}.unit: one of ${Object.keys(UNITS).join(', ')}, or { l, w, h, j? } in mm (l, w and h ${UNIT_MM[0]}–${UNIT_MM[1]}, the joint j 0–50)`);
    if (w.leaves !== undefined && !(Number.isInteger(w.leaves) && w.leaves >= 1 && w.leaves <= 4)) e.push(`${t}.leaves: a whole number of leaves, 1–4`);
    if (w.bond !== undefined && !BONDS.includes(w.bond)) e.push(`${t}.bond: one of ${BONDS.join(', ')}`);
    if (w.body !== undefined && !BODIES[w.body] && !hexRgb(w.body)) e.push(`${t}.body: one of ${Object.keys(BODIES).join(', ')}, or '#rrggbb'`);
    if (w.stone !== undefined && !STONES[w.stone]) e.push(`${t}.stone: one of ${Object.keys(STONES).join(', ')}`);
    if (w.mortar !== undefined && !MORTARS[w.mortar] && !hexRgb(w.mortar)) e.push(`${t}.mortar: one of ${Object.keys(MORTARS).join(', ')}, or '#rrggbb'`);
    if (w.joint !== undefined && !JOINTS[w.joint]) e.push(`${t}.joint: one of ${Object.keys(JOINTS).join(', ')}`);
    if (w.detail !== undefined && !MASONRY_DETAILS.includes(w.detail)) e.push(`${t}.detail: one of ${MASONRY_DETAILS.join(', ')}`);
    if (w.lintel !== undefined && !['soldier', 'stone'].includes(w.lintel)) e.push(`${t}.lintel: 'soldier' or 'stone'`);
    (w.openings || []).forEach((o, k) => { if (!o || !['at', 'width', 'height'].every((q) => Number.isFinite(o[q]) && o[q] >= 0) || (o.sill !== undefined && !Number.isFinite(o.sill))) e.push(`${t}.openings[${k}]: { at, width, height, sill? } (lengths along the wall from its 'from' end, and up from its foot)`); });
  });
  (f.paving || []).forEach((p, i) => {
    const t = `${at}.paving[${i}]`;
    if (!p || !isPt(p.origin) || !(Array.isArray(p.size) && p.size.length === 2 && p.size.every((v) => v > 0))) e.push(`${t}: { origin:[x,y,z], size:[a, b] }`);
    if (p && p.pattern !== undefined && !['stack', 'running', 'herringbone', 'basketweave'].includes(p.pattern)) e.push(`${t}.pattern: stack, running, herringbone or basketweave`);
    if (p && p.stone !== undefined && !STONES[p.stone]) e.push(`${t}.stone: one of ${Object.keys(STONES).join(', ')}`);
    if (p && p.grout !== undefined && !hexRgb(p.grout)) e.push(`${t}.grout: '#rrggbb'`);
    if (p && p.gap !== undefined && !(Number.isFinite(p.gap) && p.gap >= 0 && p.gap <= 30)) e.push(`${t}.gap: mm, 0–30`);
    if (p && p.tile !== undefined && !(Array.isArray(p.tile) && p.tile.length === 3 && within(p.tile[0], ...TILE_MM) && within(p.tile[1], ...TILE_MM) && p.tile[2] > 0 && p.tile[2] <= 500)) e.push(`${t}.tile: [length, width, thickness] mm (length and width ${TILE_MM[0]}–${TILE_MM[1]}, thickness up to 500)`);
  });
  (f.slates || []).forEach((s, i) => {
    const t = `${at}.slates[${i}]`;
    if (!s || !Array.isArray(s.eave) || s.eave.length !== 2 || !s.eave.every(isPt)) e.push(`${t}.eave: [[x,y,z], [x,y,z]]`);
    if (s && !(Number.isFinite(s.pitch) && s.pitch > 5 && s.pitch < 80)) e.push(`${t}.pitch: degrees, 5–80`);
    if (s && !(Number.isFinite(s.run) && s.run > 0)) e.push(`${t}.run: the horizontal distance up the slope`);
    if (s && s.stone !== undefined && !STONES[s.stone]) e.push(`${t}.stone: one of ${Object.keys(STONES).join(', ')}`);
    if (s && s.slate !== undefined && !(Array.isArray(s.slate) && s.slate.length === 3 && within(s.slate[0], ...SLATE_MM) && within(s.slate[1], ...SLATE_MM) && s.slate[2] > 0 && s.slate[2] <= 100)) e.push(`${t}.slate: [length, width, thickness] mm (length and width ${SLATE_MM[0]}–${SLATE_MM[1]}, thickness up to 100)`);
    const sl = s && Array.isArray(s.slate) ? s.slate[0] : 500;
    if (s && s.headlap !== undefined && !within(s.headlap, 0, sl - 20)) e.push(`${t}.headlap: mm, 0 to the slate's length less 20 (the gauge is half what is left)`);
  });
  return e;
}

/**
 * About how many units a frame's walls, paving and slates lay one by one (a wall a course of its smallest face at a
 * time, a leaf each; a floor its tiles; a roof its slates); an entry drawn as a surface (`detail` 'surface' or 'mass')
 * lays none. `scale` is metres a frame unit. For the cap in validateFrames; an entry validateMasonry refuses counts 0.
 */
export function masonryUnits(f, scale) {
  const mm = scale * 1000; let n = 0;
  const laid = (x) => x && (x.detail === undefined || x.detail === 'auto' || x.detail === 'units');
  for (const w of Array.isArray(f.walls) ? f.walls : []) {
    if (!laid(w) || !isPt(w.from) || !isPt(w.to) || !(w.height > 0)) continue;
    const u = w.unit && typeof w.unit === 'object' ? (customUnitOk(w.unit) ? w.unit : null) : UNITS[w.unit || 'uk'];
    if (!u) continue;
    const j = u.j ?? 10, leaves = Number.isInteger(w.leaves) && w.leaves >= 1 && w.leaves <= 4 ? w.leaves : 1;
    n += Math.ceil((Math.hypot(w.to[0] - w.from[0], w.to[1] - w.from[1], w.to[2] - w.from[2]) * mm) / (Math.min(u.l, u.w) + j)) * Math.ceil((w.height * mm) / (u.h + j)) * leaves;
  }
  for (const p of Array.isArray(f.paving) ? f.paving : []) {
    if (!laid(p) || !Array.isArray(p.size) || !p.size.every((v) => v > 0)) continue;
    const [l, w] = Array.isArray(p.tile) && within(p.tile[0], ...TILE_MM) && within(p.tile[1], ...TILE_MM) ? p.tile : [600, 300];
    n += Math.ceil((p.size[0] * mm) / l) * Math.ceil((p.size[1] * mm) / w);
  }
  for (const s of Array.isArray(f.slates) ? f.slates : []) {
    if (!laid(s) || !Array.isArray(s.eave) || s.eave.length !== 2 || !s.eave.every(isPt) || !(s.pitch > 5 && s.pitch < 80) || !(s.run > 0)) continue;
    const [l, w] = Array.isArray(s.slate) && within(s.slate[0], ...SLATE_MM) && within(s.slate[1], ...SLATE_MM) ? s.slate : [500, 250];
    const gauge = (l - (within(s.headlap, 0, l - 20) ? s.headlap : 75)) / 2;
    const [a, b] = s.eave;
    n += Math.ceil((s.run * mm) / Math.cos((s.pitch * Math.PI) / 180) / gauge) * Math.ceil((Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * mm) / w);
  }
  return n;
}

// ── faces ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** A local axis-aligned face of box [lo, hi] on `side` ('+x' …) → world corners (scaled) and its world normal. */
function boxFace(F, lo, hi, side, inv) {
  const k = 'xyz'.indexOf(side[1]); const s = side[0] === '+' ? 1 : -1;
  const at = s > 0 ? hi[k] : lo[k];
  const [a, b] = [0, 1, 2].filter((i) => i !== k);
  const P = (u, v) => { const p = [0, 0, 0]; p[k] = at; p[a] = u; p[b] = v; return toWorld(F, p).map((x) => x * inv); };
  const corners = [P(lo[a], lo[b]), P(hi[a], lo[b]), P(hi[a], hi[b]), P(lo[a], hi[b])];
  const n = [0, 0, 0]; n[k] = s;
  return { corners, n: dirWorld(F, n), a, b };
}
const jitter = (rgb, h, amt) => { const v = 1 + amt * (2 * hf(h, 0) - 1); const t = 0.04 * (2 * hf(h, 1) - 1); return [rgb[0] * v * (1 + t), rgb[1] * v, rgb[2] * v * (1 - t)]; };

/** The slots a course's units take along the wall (coordinating lengths include the joint): [{ x, len, kind }]. */
function courseSlots(bond, k, u, Lw, rand) {
  const L = u.l + u.j, H = u.w + u.j, out = [];
  const run = (x, seq) => { let i = 0; while (x < Lw) { const [len, kind] = seq[i % seq.length]; out.push({ x, len, kind }); x += len; i++; } };
  switch (bond) {
    case 'stack': run(0, [[L, 'S']]); break;
    case 'header': run(-(k % 2) * H / 2, [[H, 'H']]); break;
    case 'english': if (k % 2 === 0) run(0, [[L, 'S']]); else { out.push({ x: 0, len: H, kind: 'H' }, { x: H, len: H / 2, kind: 'Q' }); run(1.5 * H, [[H, 'H']]); } break;
    case 'flemish': if (k % 2 === 0) run(0, [[H, 'H'], [L, 'S']]); else { out.push({ x: 0, len: H, kind: 'H' }, { x: H, len: H / 2, kind: 'Q' }); run(1.5 * H, [[L, 'S'], [H, 'H']]); } break;
    case 'ashlar': { let x = -rand(k, 0) * L * 0.6; let i = 1; while (x < Lw) { const len = L * (1 - u.vary + 2 * u.vary * rand(k, i)); out.push({ x, len, kind: 'S' }); x += len; i++; } break; }
    default: run(-(k % 2) * L / 2, [[L, 'S']]);
  }
  return out;
}

// ── the bond texture: a wall's `surface` level ────────────────────────────────────────────────────────────────────

export const MASONRY_TEXTURE_PREFIX = 'masonry:';
const B64 = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const UNB64 = (s) => JSON.parse(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
const PX_MM = 0.4;                                                     // texels per millimetre: a 10 mm joint is 4

/** A bond's tile in mm: whole periods about 1.2 m wide, eight courses high (a soldier band is one course of units on end). */
function bondTile(bond, u) {
  const L = u.l + u.j, H = u.w + u.j, ph = u.h + u.j;
  if (bond === 'soldier') return { w: Math.max(1, Math.round(1200 / ph)) * ph, h: L, courses: 1 };
  if (bond === 'ashlar') return { w: 2400, h: 4 * ph, courses: 4 };
  const period = bond === 'flemish' ? H + L : bond === 'header' ? H : L;
  return { w: Math.max(1, Math.round(1200 / period)) * period, h: 8 * ph, courses: 8 };
}

/** The key of a wall's bond tile. Colours are absolute: the face's fill carries only the light. */
function bondKey(bond, u0, body, mortar, flash, recess, seed) {
  return MASONRY_TEXTURE_PREFIX + B64({ b: bond, u: [u0.l, u0.w, u0.h, u0.j ?? 10, u0.vary || 0].map((v) => Math.round(v * 100) / 100), c: body.map(Math.round), m: mortar.map(Math.round), f: flash ? 1 : 0, r: recess, s: seed });
}

/** Bake a bond key → { rgb, W, H } (a seamless tile), or null. */
export function bakeBondKey(key) {
  let p; try { p = UNB64(key.slice(MASONRY_TEXTURE_PREFIX.length)); } catch { return null; }
  if (!p || !Array.isArray(p.u) || !Array.isArray(p.c)) return null;
  const [l, w, h, j, vary] = p.u; const u = { l, w, h, j, vary };
  // a key is recipe text too: only a unit validateMasonry would lay (the tile grows with it) is baked
  if (!customUnitOk(u)) return null;
  const t = bondTile(p.b, u);
  const W = Math.max(8, Math.round(t.w * PX_MM)), H = Math.max(8, Math.round(t.h * PX_MM));
  const sx = W / t.w, sy = H / t.h;
  const shade = 1 - Math.min(0.3, p.r * 22);                            // a recessed joint sits in its own shadow
  const rgb = Buffer.alloc(W * H * 3);
  const put = (x, y, c) => { const o = (y * W + x) * 3; rgb[o] = Math.max(0, Math.min(255, c[0])); rgb[o + 1] = Math.max(0, Math.min(255, c[1])); rgb[o + 2] = Math.max(0, Math.min(255, c[2])); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const n = 1 + 0.05 * (hf(hash3(p.s, x, y), 0) - 0.5); put(x, y, p.m.map((v) => v * shade * n)); }
  const rand = (k, n) => hf(hash3(p.s, k, n), 0);
  const unit = (x0, y0, x1, y1, c, hh) => {
    // one unit, wrapped across the tile's left and right edges; y from the tile's foot (texture rows run down)
    for (let py = Math.floor(y0 * sy); py < Math.ceil(y1 * sy); py++) {
      if (py < 0 || py >= H) continue;
      for (let px = Math.floor(x0 * sx); px < Math.ceil(x1 * sx); px++) {
        const X = ((px % W) + W) % W;
        const n = 1 + 0.07 * (hf(hash3(hh, X, py), 1) - 0.5);
        put(X, H - 1 - py, c.map((v) => v * n));
      }
    }
  };
  if (p.b === 'soldier') {
    let n = 0; for (let x = 0; x < t.w - 1e-6; x += h + j, n++) unit(x, 0, x + h, l, jitter(p.c, hash3(p.s, 0, n), 0.09), hash3(p.s, 7, n));
  } else {
    for (let k = 0; k < t.courses; k++) {
      const z0 = k * (h + j);
      let slots = courseSlots(p.b, k, { ...u, l, w, h, j }, t.w, rand);
      if (p.b === 'ashlar') { const tot = slots.reduce((a, q) => a + q.len, 0); let x = 0; slots = slots.map((q) => { const len = (q.len * t.w) / tot; const o = { x, len, kind: q.kind }; x += len; return o; }); }
      slots.forEach((sl, n) => {
        let c = jitter(p.c, hash3(p.s, k, n), p.b === 'ashlar' ? 0.05 : 0.09);
        if (p.f && (sl.kind === 'H' || sl.kind === 'Q')) c = [c[0] * 0.7, c[1] * 0.68, c[2] * 0.74];
        unit(sl.x, z0, sl.x + sl.len - j, z0 + h, c, hash3(p.s, k * 131 + 5, n));
      });
    }
  }
  return { rgb, W, H, tileMm: [t.w, t.h] };
}

const bondUrls = new Map();
/** The data URL for a bond key (cached, least recently used out), or null. */
export function resolveBondTexture(key) {
  if (bondUrls.has(key)) { const v = bondUrls.get(key); bondUrls.delete(key); bondUrls.set(key, v); return v; }
  const b = bakeBondKey(key);
  if (!b) return null;
  const url = `data:image/png;base64,${encodePng(b.rgb, b.W, b.H).toString('base64')}`;
  bondUrls.set(key, url); if (bondUrls.size > 64) bondUrls.delete(bondUrls.keys().next().value);
  return url;
}
registerTextureResolver(MASONRY_TEXTURE_PREFIX, resolveBondTexture);

// ── walls ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const MASONRY_DETAILS = Object.freeze(['auto', 'units', 'surface', 'mass']);
const linRgb = (c) => c.map((v) => (v / 255) ** 2.2), srgb = (c) => c.map((v) => 255 * v ** (1 / 2.2));
/** The far-read colour of a bonded face: body and mortar mixed in linear light by the mortar's share of the face. */
const farRead = (body, mortar, u) => { const m = 1 - (u.l * u.h) / ((u.l + u.j) * (u.h + u.j)); const a = linRgb(body), b = linRgb(mortar); return srgb(a.map((v, i) => v * (1 - m) + b[i] * m)); };

/**
 * The level a wall draws at: `detail` when it names one; under 'auto', from the eyes — units while a course is at least
 * 5 px tall from the nearest eye, the bond texture while it is at least a pixel, the far-read colour below that; with
 * no eyes, units.
 */
function wallLevel(detail, courseM, pts, eyes) {
  if (detail && detail !== 'auto') return detail;
  if (!eyes || !eyes.length) return 'units';
  let px = 0;
  for (const e of eyes) for (const q of pts) px = Math.max(px, (courseM * e.focalPx) / Math.max(0.1, Math.hypot(q[0] - e.pos[0], q[1] - e.pos[1], q[2] - e.pos[2])));
  return px >= 5 ? 'units' : px >= 1 ? 'surface' : 'mass';
}
/** Sample points over a local rectangle (x0..x1 along, z0..z1 up, y at the face), world metres. */
const facePts = (F, x1, z1) => { const out = []; for (let a = 0; a <= 4; a++) for (let b = 0; b <= 2; b++) out.push(toWorld(F, [(x1 * a) / 4, 0, (z1 * b) / 2])); return out; };

/** Lay one wall → { faces, repeats, report }. */
function layWall(w, i, { scale, light, seed, eyes, instance }) {
  const inv = 1 / scale; const mm = 0.001;
  const u0 = typeof w.unit === 'object' ? { j: 10, ...w.unit } : UNITS[w.unit || 'uk'];
  const u = { l: u0.l * mm, w: u0.w * mm, h: u0.h * mm, j: (u0.j ?? 10) * mm, vary: u0.vary || 0 };
  const stone = !!u0.stone || w.stone !== undefined && w.unit === undefined;
  const bond = u0.stone ? 'ashlar' : (w.bond || 'stretcher');
  const leaves = Number.isInteger(w.leaves) ? w.leaves : (['english', 'flemish', 'header'].includes(bond) ? 2 : 1);
  const T = leaves * u.w + (leaves - 1) * u.j;
  const from = w.from.map((v) => v * scale), to = w.to.map((v) => v * scale);
  const F = memberFrame(from, to, [0, 0, 1]);
  const Lw = F.L, Hw = w.height * scale;
  const ph = u.h + u.j; const courses = Math.max(1, Math.floor((Hw + u.j) / ph));
  const top = courses * ph - u.j;
  const recess = JOINTS[w.joint || 'struck'];
  const sd = Number.isInteger(w.seed) ? w.seed : seed * 31 + i;
  const rand = (k, n) => hf(hash3(sd, k, n), 0);
  const group = w.id || `wall-${i}`;
  const level = wallLevel(w.detail, u.h, facePts(F, Lw, top), eyes);
  // openings, snapped to the gauge; each head carries a lintel zone laid on its own
  const snap = (z) => Math.round(z / ph) * ph;
  const lintel = w.lintel || (stone ? 'stone' : 'soldier');
  const holes = [], heads = [];
  for (const o of w.openings || []) {
    const x0 = o.at * scale, x1 = (o.at + o.width) * scale;
    const z0 = o.sill ? snap(o.sill * scale) : 0; const z1 = Math.max(z0 + ph, snap(((o.sill || 0) + o.height) * scale));
    holes.push({ x0, x1, z0, z1 });
    const lz = lintel === 'soldier' ? Math.ceil((u.l + u.j) / ph - 1e-9) * ph : 2 * ph;   // 225/75 is 3.0000000000000004
    const over = lintel === 'stone' ? 0.15 : 0;
    heads.push({ x0: x0 - over, x1: x1 + over, z0: z1, z1: Math.min(courses * ph, z1 + lz), open: { x0, x1 } });
  }
  const blocked = [...holes, ...heads];
  const faces = [];
  const matBrick = resolveMaterial(stone ? 'stone' : 'matte'); const matMortar = resolveMaterial('plaster');
  const body = hexRgb(w.body) || BODIES[w.body || (u0.block ? 'block' : 'red')];
  const flash = w.flash !== undefined ? !!w.flash : ['red', 'brown', 'stock', undefined].includes(w.body) && !stone && !u0.block;
  const st = stone ? STONES[w.stone || 'sandstone'] : null;
  const mortarRgb = hexRgb(w.mortar) || MORTARS[w.mortar || 'lime'];
  const face = (lo, hi, side, fill, extra = {}) => {
    const q = boxFace(F, lo, hi, side, inv);
    return { corners: q.corners, fill: shadeHexMat(fill, q.n, matBrick, { light }), doubleSided: true, outNormal: q.n, group, ...extra, q };
  };
  const strip = (f) => { const { q, ...rest } = f; return rest; };
  const r1 = (v) => Math.round(v * 1000);
  const report = {
    id: group, unit: typeof w.unit === 'object' ? 'custom' : (w.unit || 'uk'), bond, leaves, thicknessMm: r1(T), courses, detail: level, heightMm: r1(top),
    openings: holes.map((r) => ({ atMm: r1(r.x0), widthMm: r1(r.x1 - r.x0), sillMm: r1(r.z0), headMm: r1(r.z1 - u.j) })),
  };

  if (level !== 'units') {
    // ── the wall as a slab: its faces less the openings, wearing the bond (surface) or its far-read colour (mass) ──
    const stoneRgb = st ? [214, 196, 160] : null;
    const unitRgb = stone ? stoneRgb : body;
    const key = level === 'surface' ? bondKey(bond, u0, unitRgb, mortarRgb, flash && bond !== 'stretcher' && bond !== 'stack', recess, sd) : null;
    const tile = level === 'surface' ? bondTile(bond, { ...u0, j: u0.j ?? 10 }) : null;
    const fill = key ? '#ffffff' : rgbHex(farRead(unitRgb, mortarRgb, u));
    const tex = (lo, hi, q, ua, va) => {
      if (!key) return {};
      const P = (a, b) => { const p = [0, 0, 0]; p[q.a] = a; p[q.b] = b; return p; };
      const pts = [P(lo[q.a], lo[q.b]), P(hi[q.a], lo[q.b]), P(hi[q.a], hi[q.b]), P(lo[q.a], hi[q.b])];
      return { texture: key, uv: pts.map((p) => [(p[ua] * 1000) / tile.w, (p[va] * 1000) / tile.h]), textureLit: true };
    };
    const quad = (lo, hi, side, ua, va) => { const f = face(lo, hi, side, fill); return strip({ ...f, ...tex(lo, hi, f.q, ua, va) }); };
    const xs = [...new Set([0, Lw, ...holes.flatMap((r) => [r.x0, r.x1])])].sort((p, q) => p - q);
    for (let s = 0; s + 1 < xs.length; s++) {
      const a = xs[s], b = xs[s + 1]; const mid = (a + b) / 2;
      const over = holes.filter((r) => r.x0 <= mid && r.x1 >= mid).sort((p, q) => p.z0 - q.z0);
      let z = 0; const spans = [];
      for (const r of over) { if (r.z0 > z) spans.push([z, r.z0 - u.j]); z = r.z1; }
      if (z < top) spans.push([z, top]);
      for (const [z0, z1] of spans) for (const side of ['+y', '-y']) faces.push(quad([a, -T / 2, z0], [b, T / 2, z1], side, 0, 2));
    }
    faces.push(quad([0, -T / 2, 0], [Lw, T / 2, top], '+z', 0, 1), quad([0, -T / 2, 0], [Lw, T / 2, top], '-x', 1, 2), quad([0, -T / 2, 0], [Lw, T / 2, top], '+x', 1, 2));
    for (const r of holes) {
      const z0 = r.z0 > 0 ? r.z0 - u.j : 0;
      faces.push(quad([r.x0 - 1, -T / 2, z0], [r.x0, T / 2, r.z1], '+x', 1, 2), quad([r.x1, -T / 2, z0], [r.x1 + 1, T / 2, r.z1], '-x', 1, 2));
      faces.push(quad([r.x0, -T / 2, r.z1], [r.x1, T / 2, r.z1 + 1], '-z', 0, 1));
      if (r.z0 > 0) faces.push(quad([r.x0, -T / 2, z0 - 1], [r.x1, T / 2, z0], '+z', 0, 1));
    }
    // lintels: a soldier course is its own band of units on end; a stone lintel keeps its stone
    if (level === 'surface') for (const hd of heads) {
      const lift = 0.001;
      if (lintel === 'soldier') {
        const skey = bondKey('soldier', u0, body, mortarRgb, false, recess, sd);
        const stile = bondTile('soldier', { ...u0, j: u0.j ?? 10 });
        for (const [side, y] of [['+y', T / 2 + lift], ['-y', -T / 2 - lift]]) {
          const f = face([hd.x0, y, hd.z0], [hd.x1, y, hd.z0 + u.l], side, '#ffffff');
          faces.push(strip({ ...f, texture: skey, uv: [[0, 0], [((hd.x1 - hd.x0) * 1000) / stile.w, 0], [((hd.x1 - hd.x0) * 1000) / stile.w, 1], [0, 1]], textureLit: true }));
        }
      } else if (st) {
        for (const [side, y] of [['+y', T / 2 + lift], ['-y', -T / 2 - lift]]) {
          const f = face([hd.x0, y, hd.z0], [hd.x1, y, hd.z1 - u.j], side, rgbHex([236, 232, 226]));
          faces.push(strip({ ...f, texture: st.keys[0], uv: [[hd.x0 / st.m, hd.z0 / st.m], [hd.x1 / st.m, hd.z0 / st.m], [hd.x1 / st.m, (hd.z1 - u.j) / st.m], [hd.x0 / st.m, (hd.z1 - u.j) / st.m]], textureLit: true }));
        }
      }
    }
    // the units it stands for, estimated from the net face: a unit's face with its joints, a leaf at a time
    const net = Lw * top - holes.reduce((acc, r) => acc + (r.x1 - r.x0) * (r.z1 - (r.z0 > 0 ? r.z0 - u.j : 0)), 0);
    const perLeaf = (u.l + u.j) * (u.h + u.j);
    return { faces: tagFacesWithMaterial(faces, matBrick), repeats: [], report: { ...report, units: Math.round((net * leaves) / perLeaf), unitsEstimated: true } };
  }

  // ── units: every brick, block or stone, and the mortar behind them ──
  const boxes = [];                                                    // { lo, hi, sides, rgb, tex, h }
  const unitColor = (kind, h) => {
    let c = jitter(stone ? [236, 232, 226] : body, h, stone ? 0.05 : 0.09);
    if (flash && (kind === 'H' || kind === 'Q')) c = [c[0] * 0.7, c[1] * 0.68, c[2] * 0.74];
    return c;
  };
  const leafY = (leaf) => (leaf === 0 ? [T / 2 - u.w, T / 2] : [-T / 2, -T / 2 + u.w]);
  const lay = (x0, x1, z0, z1, y, kind, g0, g1, topFace, h) => {
    const a = Math.max(x0, g0), b = Math.min(x1, g1);
    if (b - a < 0.02) return;
    const sides = [];
    if (y[1] >= T / 2 - 1e-9) sides.push('+y');
    if (y[0] <= -T / 2 + 1e-9) sides.push('-y');
    if (Math.abs(a - g0) < 1e-9) sides.push('-x');
    if (Math.abs(b - g1) < 1e-9) sides.push('+x');
    if (topFace) sides.push('+z');
    boxes.push({ lo: [a, y[0], z0], hi: [b, y[1], z1], sides, rgb: unitColor(kind, h), tex: st ? st.keys[Math.floor(hf(h, 5) * st.keys.length)] : null, h });
  };
  for (let k = 0; k < courses; k++) {
    const z0 = k * ph, z1 = z0 + u.h;
    // the course's clear segments: the wall minus the openings and heads this course passes through
    const cuts = blocked.filter((r) => r.z0 < z1 - 1e-6 && r.z1 > z0 + 1e-6).sort((p, q) => p.x0 - q.x0);
    const segs = []; let x = 0;
    for (const r of cuts) { if (r.x0 > x) segs.push([x, r.x0]); x = Math.max(x, r.x1); }
    if (x < Lw) segs.push([x, Lw]);
    // a unit shows its top where the course above is open (a sill) or this is the last course
    const openAbove = (a, b) => k === courses - 1 || holes.some((r) => Math.abs(r.z0 - (z0 + ph)) < 1e-6 && r.x0 < b && r.x1 > a);
    courseSlots(bond, k, u, Lw, rand).forEach((sl, n) => {
      const h = hash3(sd, k, n);
      const len = sl.len - u.j;
      for (const [g0, g1] of segs) {
        if (sl.x + len <= g0 || sl.x >= g1) continue;
        const tf = openAbove(Math.max(sl.x, g0), Math.min(sl.x + len, g1));
        if (sl.kind === 'S') for (let leaf = 0; leaf < leaves; leaf++) lay(sl.x, sl.x + len, z0, z1, leafY(leaf), 'S', g0, g1, tf, h + leaf);
        else lay(sl.x, sl.x + len, z0, z1, [-T / 2, T / 2], sl.kind, g0, g1, tf, h);
      }
    });
  }
  // lintels: a soldier course (bricks on end, their stretcher faces up the wall) or one stone
  heads.forEach((hd, n) => {
    const h0 = hash3(sd, 900, n);
    if (lintel === 'stone') {
      boxes.push({ lo: [hd.x0, -T / 2, hd.z0], hi: [hd.x1, T / 2, hd.z1 - u.j], sides: ['+y', '-y', '-z', '-x', '+x', '+z'], rgb: unitColor('S', h0), tex: st ? st.keys[0] : null, h: h0 });
    } else {
      const pitch = u.h + u.j; const count = Math.max(1, Math.round((hd.x1 - hd.x0 + u.j) / pitch));
      const wd = (hd.x1 - hd.x0 + u.j) / count - u.j;
      for (let s = 0; s < count; s++) {
        const a = hd.x0 + s * (wd + u.j);
        for (let leaf = 0; leaf < leaves; leaf++) boxes.push({ lo: [a, leafY(leaf)[0], hd.z0], hi: [a + wd, leafY(leaf)[1], hd.z0 + u.l], sides: [leaf === 0 ? '+y' : '-y', '-z', '+z', ...(leaves === 1 ? ['-y'] : [])], rgb: unitColor('S', hash3(sd, 901 + n, s)), tex: null, h: 0 });
      }
    }
  });
  // the units: textured stones as faces; plain units instanced by their size and the sides they show, their colour
  // the instance's tint over the body's (the template is built in the wall's own orientation, so no rotation)
  const groups = new Map();
  for (const bx of boxes) {
    if (bx.tex || !instance) continue;
    const k = `${bx.hi.map((v, a) => Math.round((v - bx.lo[a]) * 1e5)).join(',')}|${bx.sides.join('')}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(bx);
  }
  const repeats = [];
  const base = stone ? [236, 232, 226] : body;
  for (const [k, list] of groups) {
    if (list.length < 4) { groups.delete(k); continue; }
    const b0 = list[0]; const d = b0.hi.map((v, a) => v - b0.lo[a]);
    const o0 = toWorld(F, b0.lo).map((v) => v * inv);
    const template = b0.sides.map((side) => {
      const f = face(b0.lo, b0.hi, side, rgbHex(base));
      return strip({ ...f, corners: f.corners.map((c) => c.map((v, a) => v - o0[a])) });
    });
    repeats.push({
      group: `${group}:units:${repeats.length}`, template: tagFacesWithMaterial(template, matBrick),
      transforms: list.map((bx) => ({ pos: toWorld(F, bx.lo).map((v) => Math.round(v * inv * 1e6) / 1e6), tint: bx.rgb.map((v, a) => Math.round((v / base[a]) * 1e4) / 1e4) })),
    });
    for (const bx of list) bx.done = true;
    void d;
  }
  for (const bx of boxes) {
    if (bx.done) continue;
    for (const side of bx.sides) {
      const f = face(bx.lo, bx.hi, side, rgbHex(bx.rgb));
      if (bx.tex) {
        const off = [hf(bx.h, 3) * 7, hf(bx.h, 4) * 7];
        const U = (p) => [(p[f.q.a] + off[0]) / st.m, (p[f.q.b] + off[1]) / st.m];
        const lp = [[bx.lo[f.q.a], bx.lo[f.q.b]], [bx.hi[f.q.a], bx.lo[f.q.b]], [bx.hi[f.q.a], bx.hi[f.q.b]], [bx.lo[f.q.a], bx.hi[f.q.b]]].map(([aa, bb]) => { const p = [0, 0, 0]; p[f.q.a] = aa; p[f.q.b] = bb; return U(p); });
        faces.push(strip({ ...f, texture: bx.tex, uv: lp, textureLit: true }));
      } else faces.push(strip(f));
    }
  }
  // the mortar: a backing recessed by the joint profile, over the wall less its openings
  const mortar = rgbHex(mortarRgb);
  const xs = [...new Set([0, Lw, ...holes.flatMap((r) => [r.x0, r.x1])])].sort((p, q) => p - q);
  for (let s = 0; s + 1 < xs.length; s++) {
    const a = xs[s], b = xs[s + 1]; const mid = (a + b) / 2;
    const over = holes.filter((r) => r.x0 <= mid && r.x1 >= mid).sort((p, q) => p.z0 - q.z0);
    let z = 0; const spans = [];
    for (const r of over) { if (r.z0 > z) spans.push([z, r.z0 - u.j]); z = r.z1; }
    if (z < top) spans.push([z, top]);
    for (const [z0, z1] of spans) {
      for (const side of ['+y', '-y']) {
        const q = boxFace(F, [a, -T / 2 + recess, z0], [b, T / 2 - recess, z1], side, inv);
        faces.push({ corners: q.corners, fill: shadeHexMat(mortar, q.n, matMortar, { light }), doubleSided: true, outNormal: q.n, group });
      }
    }
  }
  return { faces: tagFacesWithMaterial(faces, matBrick), repeats, report: { ...report, units: boxes.length } };
}

/** Tiles of a paving rectangle as axis-aligned rects in its (u, v) plane, units of the tile width w. */
function pavingRects(pattern, l, w, A, B, rand) {
  const out = [];
  const clip = (u0, v0, u1, v1) => { const a = Math.max(0, u0), b = Math.min(A, u1), c = Math.max(0, v0), d = Math.min(B, v1); if (b - a > 0.004 && d - c > 0.004) out.push([a, c, b, d]); };
  switch (pattern) {
    case 'stack': for (let v = 0; v < B; v += w) for (let u = 0; u < A; u += l) clip(u, v, u + l, v + w); break;
    case 'basketweave': {
      const s = l;   // a block of two tiles
      for (let v = 0, j = 0; v < B; v += s, j++) for (let u = 0, i = 0; u < A; u += s, i++) {
        if ((i + j) % 2 === 0) { clip(u, v, u + l, v + w); clip(u, v + w, u + l, v + 2 * w); } else { clip(u, v, u + w, v + l); clip(u + w, v, u + 2 * w, v + l); }
      }
      break;
    }
    case 'herringbone': {
      // 90° herringbone of l = 2w tiles: a horizontal and a vertical tile, translated by (w, w) and (2w, −2w)
      const n = Math.ceil((A + B) / w) + 4;
      for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) {
        const ou = (a + 2 * b) * w, ov = (a - 2 * b) * w;
        if (ou > A + 3 * w || ov > B + 3 * w || ou < -3 * w || ov < -3 * w) continue;
        clip(ou, ov, ou + l, ov + w); clip(ou + l, ov - w, ou + l + w, ov - w + l);
      }
      break;
    }
    default: for (let v = 0, r = 0; v < B; v += w, r++) for (let u = -(r % 2) * l / 2; u < A; u += l) clip(u, v, u + l, v + w);
  }
  return out;
}

function layPaving(p, i, { scale, light, seed, eyes }) {
  const inv = 1 / scale; const mm = 0.001;
  const [tl, tw, tt] = (p.tile || [600, 300, 20]).map((v) => v * mm);
  const gap = (p.gap ?? 3) * mm;
  const pattern = p.pattern || 'running';
  const lpat = pattern === 'herringbone' || pattern === 'basketweave' ? 2 * tw : tl;
  const o = p.origin.map((v) => v * scale); const A = p.size[0] * scale, B = p.size[1] * scale;
  const st = STONES[p.stone || 'marble-carrara'];
  const sd = Number.isInteger(p.seed) ? p.seed : seed * 37 + i;
  const mat = resolveMaterial('stone');
  const faces = [];
  const n = [0, 0, 1];
  const up = (u, v, z) => [(o[0] + u) * inv, (o[1] + v) * inv, (o[2] + z) * inv];
  // far: the floor one slab of its stone (a tile narrower than 3 px has no joints worth drawing)
  const corners = [up(0, 0, tt), up(A, 0, tt), up(A, B, tt), up(0, B, tt)];
  const level = p.detail && p.detail !== 'auto' ? (p.detail === 'units' ? 'units' : 'mass') : (eyes && eyes.length && maxPx(tw, corners.map((c) => c.map((v) => v * scale)), eyes) < 3 ? 'mass' : 'units');
  if (level === 'mass') {
    faces.push({ corners, fill: shadeHexMat('#eeece8', n, mat, { light }), doubleSided: true, outNormal: n, group: p.id || `paving-${i}`, texture: st.keys[0], uv: [[0, 0], [A / st.m, 0], [A / st.m, B / st.m], [0, B / st.m]], textureLit: true });
    return { faces: tagFacesWithMaterial(faces, mat), report: { id: p.id || `paving-${i}`, pattern, tiles: 0, detail: 'mass', stone: p.stone || 'marble-carrara', tileMm: [tl, tw, tt].map((v) => Math.round(v * 1000)) } };
  }
  const rects = pavingRects(pattern, lpat, tw, A, B);
  rects.forEach(([u0, v0, u1, v1], k) => {
    const h = hash3(sd, k, 3);
    const a = u0 + gap / 2, b = u1 - gap / 2, c = v0 + gap / 2, d = v1 - gap / 2;
    const tex = st.keys[Math.floor(hf(h, 5) * st.keys.length)];
    const off = [hf(h, 3) * 9, hf(h, 4) * 9];
    const uv = [[a, c], [b, c], [b, d], [a, d]].map(([x, y]) => [(x + off[0]) / st.m, (y + off[1]) / st.m]);
    const fill = rgbHex(jitter([238, 236, 232], h, 0.04));
    faces.push({ corners: [up(a, c, tt), up(b, c, tt), up(b, d, tt), up(a, d, tt)], fill: shadeHexMat(fill, n, mat, { light }), doubleSided: true, outNormal: n, group: p.id || `paving-${i}`, texture: tex, uv, textureLit: true });
  });
  // grout, just under the tile faces
  const grout = rgbHex(hexRgb(p.grout) || [150, 146, 138]);
  faces.push({ corners: [up(0, 0, tt - 0.0015), up(A, 0, tt - 0.0015), up(A, B, tt - 0.0015), up(0, B, tt - 0.0015)], fill: shadeHexMat(grout, n, mat, { light }), doubleSided: true, outNormal: n, group: p.id || `paving-${i}` });
  return { faces: tagFacesWithMaterial(faces, mat), report: { id: p.id || `paving-${i}`, pattern, tiles: rects.length, detail: 'units', stone: p.stone || 'marble-carrara', tileMm: [tl, tw, tt].map((v) => Math.round(v * 1000)) } };
}

function laySlates(s, i, { scale, light, seed, eyes }) {
  const inv = 1 / scale; const mm = 0.001;
  const [sl, sw, stt] = (s.slate || [500, 250, 6]).map((v) => v * mm);
  const headlap = (s.headlap ?? 75) * mm;
  const gauge = (sl - headlap) / 2;
  const e0 = s.eave[0].map((v) => v * scale), e1 = s.eave[1].map((v) => v * scale);
  const along = [e1[0] - e0[0], e1[1] - e0[1], e1[2] - e0[2]]; const L = Math.hypot(...along); const ea = along.map((v) => v / L);
  const side = s.side === -1 ? -1 : 1;
  const inPlan = [-ea[1] * side, ea[0] * side, 0];                              // up-slope direction in plan
  const pr = (s.pitch * Math.PI) / 180;
  const upSlope = [inPlan[0] * Math.cos(pr), inPlan[1] * Math.cos(pr), Math.sin(pr)];
  const nrm = [ea[1] * upSlope[2] - ea[2] * upSlope[1], ea[2] * upSlope[0] - ea[0] * upSlope[2], ea[0] * upSlope[1] - ea[1] * upSlope[0]].map((v) => v * side);
  const run = s.run * scale; const slopeLen = run / Math.cos(pr);
  const st = STONES[s.stone || 'slate'];
  const mat = resolveMaterial('stone');
  const sd = Number.isInteger(s.seed) ? s.seed : seed * 41 + i;
  const gap = 0.004;
  const faces = []; let count = 0;
  const P = (x, y, lift) => [0, 1, 2].map((k) => (e0[k] + ea[k] * x + upSlope[k] * y + nrm[k] * lift) * inv);
  // far: one plane of slate (a slate narrower than 3 px has no joints worth drawing)
  const plane = [P(0, 0, stt), P(L, 0, stt), P(L, slopeLen, stt), P(0, slopeLen, stt)];
  const level = s.detail && s.detail !== 'auto' ? (s.detail === 'units' ? 'units' : 'mass') : (eyes && eyes.length && maxPx(sw, plane.map((c) => c.map((v) => v * scale)), eyes) < 3 ? 'mass' : 'units');
  if (level === 'mass') {
    faces.push({ corners: plane, fill: shadeHexMat('#e8e8e8', nrm, mat, { light }), doubleSided: true, outNormal: nrm, group: s.id || `slates-${i}`, texture: st.keys[0], uv: [[0, 0], [L / st.m, 0], [L / st.m, slopeLen / st.m], [0, slopeLen / st.m]], textureLit: true });
    return { faces: tagFacesWithMaterial(faces, mat), report: { id: s.id || `slates-${i}`, courses: 0, slates: 0, detail: 'mass', gaugeMm: Math.round(gauge * 1000), headlapMm: Math.round(headlap * 1000) } };
  }
  // courses from the eave up: a slate's tail at the course line, its head a slate-length up the slope
  const courses = Math.max(1, Math.ceil((slopeLen - sl) / gauge) + 1);
  for (let k = 0; k < courses; k++) {
    const y0 = k * gauge; const y1 = Math.min(slopeLen, y0 + sl);
    const lift = (k + 1) * stt * 0.4;                                          // each course lies on the one below
    for (let x = -(k % 2) * sw / 2, n = 0; x < L; x += sw, n++) {
      const a = Math.max(0, x), b = Math.min(L, x + sw - gap);
      if (b - a < 0.02) continue;
      const h = hash3(sd, k, n);
      const off = [hf(h, 3) * 9, hf(h, 4) * 9];
      const uv = [[a, y0], [b, y0], [b, y1], [a, y1]].map(([p, q]) => [(p + off[0]) / st.m, (q + off[1]) / st.m]);
      const fill = rgbHex(jitter([232, 232, 232], h, 0.07));
      faces.push({ corners: [P(a, y0, lift + stt), P(b, y0, lift + stt), P(b, y1, lift + stt), P(a, y1, lift + stt)], fill: shadeHexMat(fill, nrm, mat, { light }), doubleSided: true, outNormal: nrm, group: s.id || `slates-${i}`, texture: st.keys[0], uv, textureLit: true });
      // the tail's edge, the line the eye reads a slate roof by
      const dn = upSlope.map((v) => -v);
      faces.push({ corners: [P(a, y0, lift), P(b, y0, lift), P(b, y0, lift + stt), P(a, y0, lift + stt)], fill: shadeHexMat(rgbHex([70, 72, 78]), dn, mat, { light }), doubleSided: true, outNormal: dn, group: s.id || `slates-${i}` });
      count++;
    }
  }
  return { faces: tagFacesWithMaterial(faces, mat), report: { id: s.id || `slates-${i}`, courses, slates: count, detail: 'units', gaugeMm: Math.round(gauge * 1000), headlapMm: Math.round(headlap * 1000) } };
}

/** The largest projected size (px) of a length `m` metres at any of `pts` (world metres) from any eye. */
function maxPx(m, pts, eyes) {
  let px = 0;
  for (const e of eyes) for (const q of pts) px = Math.max(px, (m * e.focalPx) / Math.max(0.1, Math.hypot(q[0] - e.pos[0], q[1] - e.pos[1], q[2] - e.pos[2])));
  return px;
}

/**
 * Lay a frame entry's walls, paving and slates → { faces, repeats, report: { walls, paving, slates } }. `eyes`
 * ([{ pos: [x,y,z] metres, focalPx }]) let each entry's `detail: 'auto'` pick its level; `instance` stamps a wall's
 * plain units as repeats instead of faces.
 */
export function layMasonry(f, { scale, light = DEFAULT_LIGHT, seed = 1, eyes = null, instance = false }) {
  const faces = [], repeats = [], report = {};
  const run = (list, fn, key) => {
    if (!Array.isArray(list) || !list.length) return;
    report[key] = list.map((x, i) => { const r = fn(x, i, { scale, light, seed, eyes, instance }); for (const x of r.faces) faces.push(x); if (r.repeats) for (const x of r.repeats) repeats.push(x); return r.report; });
  };
  run(f.walls, layWall, 'walls'); run(f.paving, layPaving, 'paving'); run(f.slates, laySlates, 'slates');
  return { faces, repeats, report };
}
