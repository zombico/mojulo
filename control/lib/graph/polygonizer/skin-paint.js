/**
 * skin-paint — a creature's SKIN TEXTURE: scales, plates and belly scutes drawn into a texture over its body, the way a
 * toon game paints a hide. The texture is VALUE only (a light rim round each cell, the cell a step darker), so the
 * body's own colours, its markings and both tones of the character light read through it, and the light's step falls
 * over it: the page draws texel × the lit or shaded fill (the painted face's path, face-paint.js: `textureLit`).
 *
 * A plan's `skin` is a list of REGIONS, worn in order (a later region over an earlier one on the faces both take):
 *   { parts: [base names], pattern: 'scales' | 'plates' | 'bands', cell (metres: a cell's size), contrast? (0.04–0.3,
 *     how much darker a cell is than its rim, default 0.14), t?: [a, b] (a share of the ring half, 0 front → 1 back, as
 *     body paint measures it), run?: [a, b] (a share of the part's length) }
 *   scales  overlapping rounded scales pointing down the part (the arm's, the tail's, the back's)
 *   plates  irregular polygonal plates (a reptile's head: the cranium's and the jaw's)
 *   bands   broad transverse scutes across the part (the belly's, the throat's)
 *   feathers  long rounded tips in offset rows down the part, a shaft down each (a bird's body)
 *   fur     tufts: tapering light strokes lying down the part, staggered and jittered (the lie of the coat)
 *   segments  chitin rings round the part: a light lip over a dark seam at each plate's edge
 * `lines: 'dark'` draws the pattern's lines darker than the hide instead of lighter (a pale coat's: light on light does
 * not read). `fade: false` keeps a region's pattern to the part's very ends (by default it fades out over most of a cell there, so
 * two parts' patterns never meet in a seam at a joint)
 *
 * ECONOMY: one texture per creature, an ATLAS. Every part a region covers gets its own rectangle, as wide as its ring
 * (in cells, a whole number round it, so the pattern closes on itself) and as long as the part, at a few texels a cell;
 * the pattern is painted straight into it (no repeat wrapping: one texture serves the static page, the rig pack and the
 * glTF, as the painted face's atlas does). A white tile takes every face the skin does not cover.
 * The UV of a vertex is its place on its part, read off its id (`part/st3.frontR`): along, the station's distance down
 * the part's centreline in metres; around, its slot's place in the ring. A cap's apex is not painted (the ring's
 * parameter pinches there), so a region fades out at a part's ends.
 * LEVEL OF DETAIL: a region whose cell would be under SKIN_MIN_PX pixels at the creature's target is dropped (the drawn
 * tier's rule: a detail too small to read is noise).
 *
 *   validateSkin(skin)                        error strings
 *   skinPaintOf(mesh, skin, { ppm })          the paint on a compiled mesh, or null: { key, url, painted(fi), uvAt(ref),
 *                                             light(fill), atlas, baseUV, white, … } (characterLitFaces' `paint`, and the
 *                                             rig pack's)
 * Pure JS, deterministic: the same mesh and regions give the same bytes.
 */
import { encodePngGrey } from '../landscape/surface-textures.js';

export const SKIN_PATTERNS = Object.freeze(['scales', 'plates', 'bands', 'feathers', 'fur', 'segments']);
/** the least a cell may measure on screen and still be drawn (px at the target) */
export const SKIN_MIN_PX = 5;
/** texels a cell is painted at (more for the fine, fewer for the large, inside the atlas's bounds) */
const PX_PER_CELL = 20, ATLAS_W = 1024, ATLAS_MAX_H = 2048, PAD = 2, WHITE = 8;

const isWin = (w) => Array.isArray(w) && w.length === 2 && w.every(Number.isFinite) && w[0] <= w[1];
export function validateSkin(skin) {
  const errs = [];
  if (skin === undefined) return errs;
  if (!Array.isArray(skin)) return ['skin is a list of regions { parts, pattern, cell, contrast?, t?, run? }'];
  skin.forEach((R, i) => {
    const at = `skin[${i}]`;
    if (!R || typeof R !== 'object') { errs.push(`${at}: a region { parts, pattern, cell }`); return; }
    if (!Array.isArray(R.parts) || !R.parts.length || !R.parts.every((p) => typeof p === 'string')) errs.push(`${at}.parts: a list of part names (a base name takes both sides)`);
    if (!SKIN_PATTERNS.includes(R.pattern)) errs.push(`${at}.pattern: ${SKIN_PATTERNS.map((p) => `'${p}'`).join(' | ')}`);
    if (!(Number.isFinite(R.cell) && R.cell >= 0.003 && R.cell <= 0.3)) errs.push(`${at}.cell: metres, 0.003 … 0.3`);
    if (R.contrast !== undefined && !(Number.isFinite(R.contrast) && R.contrast >= 0.04 && R.contrast <= 0.3)) errs.push(`${at}.contrast: 0.04 … 0.3`);
    if (R.lines !== undefined && !['light', 'dark'].includes(R.lines)) errs.push(`${at}.lines: 'light' (a light line, the default) | 'dark' (a darker line: a pale hide's)`);
    if (R.fade !== undefined && typeof R.fade !== 'boolean') errs.push(`${at}.fade: true (the default: the pattern fades out at a part's ends) or false`);
    for (const w of ['t', 'run']) if (R[w] !== undefined && !(isWin(R[w]) && R[w][0] >= 0 && R[w][1] <= 1)) errs.push(`${at}.${w}: [a, b] within 0 … 1`);
  });
  return errs;
}

// ─── the patterns: value at a point in CELL units (a across the ring, b down the part) → [0..1], 1 the rim ───
const hash = (x, y, s) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const RIM = { scales: 0.22, plates: 0.13, bands: 0.14, feathers: 0.16, fur: 0.12, segments: 0.1 };
/** overlapping scales pointing down the part: rows half a cell apart, every other row offset by half; each scale a disc,
 * the one nearer the root lying over the next (a scale's free edge, its lower arc, points down the part) */
function scalesAt(a, b) {
  const H = 0.5, R = 0.56, j0 = Math.floor(b / H);
  for (let j = j0 - 1; j <= j0 + 2; j++) {   // root-ward first: it lies on top
    const off = (j & 1) * 0.5, cx = Math.round(a - off) + off, cy = j * H, d = Math.hypot(a - cx, b - cy);
    if (d <= R && b >= cy - 0.05) return d > R * (1 - RIM.scales) ? 1 : 0;
  }
  return 1;
}
/** feathers: long rounded tips in offset rows pointing down the part (a cell twice as long as wide), each with its
 * shaft down its middle; the one nearer the root lies over the next */
function feathersAt(a, b) {
  const H = 0.9, R = 0.55, j0 = Math.floor(b / H);
  for (let j = j0 - 1; j <= j0 + 2; j++) {
    const off = (j & 1) * 0.5, cx = Math.round(a - off) + off, cy = j * H, dx = a - cx, dy = (b - cy) / 1.8, d = Math.hypot(dx, dy);
    if (d <= R && b >= cy - 0.05) return d > R * (1 - RIM.feathers) ? 1 : Math.abs(dx) < 0.035 && b < cy + 0.75 ? 1 : 0;
  }
  return 1;
}
/** fur: TUFTS, each three strokes converging to a point down the part (the lie of the coat), sized and placed by seed;
 * the coat's FLOW leans them: round the trunk they lie out toward the sides (`v` the place round the ring), and each
 * tuft turns a little its own way (value 1 the stroke, 0 the ground: the stroke is the light catching the hair) */
function furAt(a, b, seed, v = 0) {
  const j0 = Math.floor(b / 0.8), flow = 0.45 * Math.sin(2 * Math.PI * v);
  for (let j = j0 - 2; j <= j0; j++) for (const di of [0, -1, 1]) {
    const off = (j & 1) * 0.5, i = Math.round(a - off) + di, jit = hash(i, j, seed) - 0.5, size = 0.75 + 0.5 * hash(j, i, seed + 11);
    const cx = i + off + 0.25 * jit, top = j * 0.8 + 0.2 * hash(j, i, seed + 3), len = 1.0 * size;
    const t = (b - top) / len; if (t < 0 || t > 1) continue;
    const slope = flow + 0.35 * jit, lean = slope * t * len + 0.08 * Math.sin(t * 2.2 + jit * 3), w = (RIM.fur * 0.7 * (1 - t) + 0.012) * size;
    for (const dx of [-0.22, 0, 0.22]) if (Math.abs(a - (cx + dx * size * (1 - t) ** 1.4 + lean)) < w * (dx ? 0.8 : 1)) return 1;
  }
  return 0;
}
/** chitin segments: rings round the part, each a plate whose lower edge is a light lip over a dark seam (the next plate
 * tucked under it); the seam's depth is the value below the cell's (`2`: the darker tone) */
function segmentsAt(a, b) { const f = ((b % 1) + 1) % 1; return f > 1 - RIM.segments ? 1 : f < RIM.segments * 0.8 ? 2 : 0; }
/** irregular plates: a jittered grid's cells (seeded), their borders the rims */
function platesAt(a, b, seed) {
  const ia = Math.floor(a), ib = Math.floor(b); let d1 = Infinity, d2 = Infinity;
  for (let x = ia - 1; x <= ia + 1; x++) for (let y = ib - 1; y <= ib + 1; y++) {
    const px = x + 0.15 + 0.7 * hash(x, y, seed), py = y + 0.15 + 0.7 * hash(y, x, seed + 7), d = Math.hypot(a - px, b - py);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return d2 - d1 < RIM.plates * 2 ? 1 : 0;
}
/** transverse scutes: bands across the part, each bowed a little toward the front's middle */
function bandsAt(a, b, n) {
  const bow = 0.18 * Math.cos(Math.PI * 2 * (a / n));
  const f = ((b + bow) % 1 + 1) % 1;
  return f < RIM.bands || f > 1 - RIM.bands * 0.4 ? 1 : 0;
}

// ─── on the compiled mesh ───
const baseOf = (name) => name.replace(/[RL]$/, '');
/** a part's centreline: each station's centroid, and its distance down the part in metres */
function partFrame(P) {
  const C = P.stations.map((st) => { const pts = Object.values(st.points); return [0, 1, 2].map((k) => pts.reduce((s, p) => s + p[k], 0) / pts.length); });
  const along = [0]; for (let i = 1; i < C.length; i++) along.push(along[i - 1] + Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1], C[i][2] - C[i - 1][2]));
  const girth = P.stations.map((st) => { const pts = P.slots.map((sl) => st.points[sl]).filter(Boolean); let g = 0; for (let k = 0; k < pts.length; k++) { const p = pts[k], q = pts[(k + 1) % pts.length]; g += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); } return g; });
  return { along, girth, index: new Map(P.stations.map((st, i) => [st.id, i])) };
}

/** The skin texture on a compiled mesh, or null when no region covers a face. `ppm`: pixels a metre at the target. */
export function skinPaintOf(mesh, skin, { ppm = Infinity, seed = 1 } = {}) {
  if (!Array.isArray(skin) || !skin.length) return null;
  const regions = skin.filter((R) => R.cell * ppm >= SKIN_MIN_PX);
  if (!regions.length) return null;
  // each part a region names (a base name: both sides and the part itself), its last region the one it wears
  const want = new Map();
  for (const name of Object.keys(mesh.parts)) {
    const P = mesh.parts[name]; if (!P?.stations?.length || !P.slots?.length || P.garment) continue;
    const rs = regions.filter((R) => R.parts.includes(name) || R.parts.includes(baseOf(name)));
    if (rs.length) want.set(name, rs);
  }
  if (!want.size) return null;
  // the RECTANGLES: a part's cells round (a whole number) and down, at PX_PER_CELL texels a cell, by its finest region
  const rects = [];
  for (const [name, rs] of want) {
    const P = mesh.parts[name], F = partFrame(P), L = F.along[F.along.length - 1], G = Math.max(...F.girth);
    const cell = Math.min(...rs.map((R) => R.cell)), nA = Math.max(3, Math.round(G / cell)), nB = Math.max(1, L / (G / nA));
    const extra = 1 / P.slots.length;   // one ring step past the seam, for the faces that cross it
    rects.push({ name, P, F, rs, nA, nB, extra, w: Math.ceil(nA * (1 + extra) * PX_PER_CELL), h: Math.max(4, Math.ceil(nB * PX_PER_CELL)) });
  }
  // shelf packing, tallest first; scaled down together when the atlas would grow past its bound
  rects.sort((x, y) => y.h - x.h || (x.name < y.name ? -1 : 1));
  let k = 1, H = 0;
  const pack = (scale) => { let x = WHITE + PAD, y = 0, shelf = 0;
    for (const r of rects) { r.W = Math.max(4, Math.ceil(r.w * scale)); r.Hh = Math.max(4, Math.ceil(r.h * scale)); if (x + r.W + PAD > ATLAS_W) { x = 0; y += shelf + PAD; shelf = 0; } r.x = x; r.y = y; x += r.W + PAD; shelf = Math.max(shelf, r.Hh); }
    return y + shelf + PAD; };
  for (let i = 0; i < 12; i++) { H = pack(k); if (H <= ATLAS_MAX_H && rects.every((r) => r.W <= ATLAS_W)) break; k *= 0.8; }
  H = Math.max(WHITE + PAD, H); H = 1 << Math.ceil(Math.log2(H));
  // PAINT: grey, the white tile at the corner, each rectangle by its regions (a later region over an earlier one)
  const grey = new Uint8Array(ATLAS_W * H).fill(255);
  for (const r of rects) {
    const Lp = r.F.along[r.F.along.length - 1] || 1, G = Math.max(...r.F.girth);
    // each region its own whole number of cells round the ring (the pattern closes on itself), cells as long as wide
    const per = r.rs.map((R) => { const n = Math.max(3, Math.round(G / R.cell)); return { R, n, down: Lp / (G / n) }; });
    for (let py = 0; py < r.Hh; py++) for (let px = 0; px < r.W; px++) {
      const v = (px + 0.5) / r.W * (1 + r.extra), u = (py + 0.5) / r.Hh;   // v round the ring (0 the front), u down the part
      const vv = v % 1, tShare = Math.min(vv, 1 - vv) * 2;
      let val = 255;
      for (const { R, n, down } of per) {
        if (R.t && !(tShare >= R.t[0] && tShare <= R.t[1])) continue;
        if (R.run && !(u >= R.run[0] && u <= R.run[1])) continue;
        const a = v * n, b = u * down;
        const P = R.pattern, rim = P === 'scales' ? scalesAt(a, b) : P === 'plates' ? platesAt(a, b, seed + n) : P === 'feathers' ? feathersAt(a, b) : P === 'fur' ? furAt(a, b, seed + n, vv) : P === 'segments' ? segmentsAt(a, b) : bandsAt(a, b, n);
        // LINES: light (the default: a light rim, the cell a step darker) or, on a light coat, DARK (the cell the coat, the
        // line drawn darker, as a toon draws the lines of a pale hide); a seam is the darkest either way
        const c = R.contrast ?? 0.14, dark = R.lines === 'dark', lv = rim === 2 ? 1 - 2 * c : dark ? (rim === 1 ? 1 - 1.4 * c : 1) : rim === 1 ? 1 : 1 - c;
        // the pattern FADES out toward a part's ends, where the next part's pattern meets it (no seam at a joint)
        const ends = Math.min(u, 1 - u) * Lp / (R.cell * 0.8), fade = Math.min(1, Math.max(0, R.fade === false ? 1 : ends));
        val = Math.round(255 * (1 - (1 - lv) * fade));
      }
      grey[(r.y + py) * ATLAS_W + r.x + px] = val;
    }
  }
  const url = `data:image/png;base64,${encodePngGrey(grey, ATLAS_W, H).toString('base64')}`;
  const key = `skin-${fnvBytes(grey)}-${ATLAS_W}x${H}`;
  // UV per vertex, on its part's rectangle
  const byName = new Map(rects.map((r) => [r.name, r])), uv = new Map(), wrapUv = new Map();
  const toUv = (r, v, u) => [(r.x + v / (1 + r.extra) * r.W) / ATLAS_W, 1 - (r.y + u * r.Hh) / H];
  mesh.vertices.forEach((_, vi) => {
    const id = mesh.pointIds?.[vi]; if (!id) return;
    const slash = id.indexOf('/'), name = id.slice(0, slash), r = byName.get(name); if (!r) return;
    const local = id.slice(slash + 1), dot = local.indexOf('.'); if (dot < 0) return;   // a cap's apex: not painted
    const si = r.F.index.get(local.slice(0, dot)), sk = r.P.slots.indexOf(local.slice(dot + 1));
    if (si === undefined || sk < 0) return;
    const u = r.F.along[si] / (r.F.along[r.F.along.length - 1] || 1), v = sk / r.P.slots.length;
    uv.set(vi, { r, u, v });
  });
  // a face is painted when its corners are on one part and a region's windows hold its middle; one crossing the ring's
  // seam takes its low corners a turn on (the rectangle's extra step)
  const fis = new Map();
  mesh.faces.forEach((tri, fi) => {
    const c = tri.map((vi) => uv.get(vi)); if (c.some((x) => !x) || c.some((x) => x.r !== c[0].r)) return;
    // a second skin's cloth (body-paint.js: the groups a part's paint laid) is not the hide
    // (paint ON the hide, a ritual's marks, keeps the scales under it)
    const own = mesh.parts[c[0].r.name]; if (Array.isArray(own?.painted) && own.painted.includes(mesh.groups[fi]) && mesh.groups[fi] !== 'OutfitPaint') return;
    const vs = c.map((x) => x.v), wrap = Math.max(...vs) - Math.min(...vs) > 0.5;
    const vmid = (wrap ? vs.map((v) => (v < 0.5 ? v + 1 : v)) : vs).reduce((s, v) => s + v, 0) / 3 % 1, umid = c.reduce((s, x) => s + x.u, 0) / 3, tShare = Math.min(vmid, 1 - vmid) * 2;
    if (!c[0].r.rs.some((R) => (!R.t || (tShare >= R.t[0] && tShare <= R.t[1])) && (!R.run || (umid >= R.run[0] && umid <= R.run[1])))) return;
    fis.set(fi, tri.map((vi, k) => toUv(c[k].r, wrap && c[k].v < 0.5 ? c[k].v + 1 : c[k].v, c[k].u)));
    for (const vi of tri) wrapUv.set(`${fi}:${vi}`, fis.get(fi)[tri.indexOf(vi)]);
  });
  if (!fis.size) return null;
  const white = [(WHITE / 2) / ATLAS_W, 1 - (WHITE / 2) / H];
  // a piece's corner → its UV on its PARENT face (a split piece's refs are that face's vertices, edges and interiors)
  let face = -1;
  const at = (vi) => wrapUv.get(`${face}:${vi}`);
  const uvAt = (ref) => {
    if (ref.vi !== undefined) return at(ref.vi) ?? white;
    if (ref.bary) return ref.bary.reduce((s, [vi, w]) => { const t = at(vi) ?? white; return [s[0] + t[0] * w, s[1] + t[1] * w]; }, [0, 0]);
    if (ref.mix) { const m = ref.mix.map(uvAt); return [m.reduce((s, t) => s + t[0], 0) / m.length, m.reduce((s, t) => s + t[1], 0) / m.length]; }
    const A = at(ref.a) ?? white, B = at(ref.b) ?? white; return [A[0] + (B[0] - A[0]) * ref.s, A[1] + (B[1] - A[1]) * ref.s];
  };
  // the light alone under the texture: the fill lifted by the pattern's mean, so the hide keeps its colour on average
  const DARK = { scales: 0.7, plates: 0.75, bands: 0.8, feathers: 0.7, fur: 0.8, segments: 0.9 }, mean = regions.reduce((m, R) => m + (1 - (R.lines === 'dark' ? 1.4 * (1 - DARK[R.pattern]) : DARK[R.pattern]) * (R.contrast ?? 0.14)), 0) / regions.length, lights = new Map();
  const light = (fill) => { let h = lights.get(fill); if (!h) lights.set(fill, h = liftHex(fill, mean)); return h; };
  return { key, url, painted: (fi) => { if (fis.has(fi)) { face = fi; return true; } return false; }, uvAt, light,
    atlas: { url, w: ATLAS_W, h: H }, baseUV: (t) => t, white, regionOf: new Map(), regions: [], hidden: [0, 0, 0], targets: 0, pad: PAD };
}

const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4), srgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
function liftHex(hex, mean) { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255); return `#${c.map((x) => Math.round(Math.min(1, Math.max(0, srgb(Math.min(1, lin(x) / mean)))) * 255).toString(16).padStart(2, '0')).join('')}`; }
function fnvBytes(b) { let h = 0x811c9dc5; for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
