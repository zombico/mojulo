/**
 * face-paint — the anime head's PAINTED FACE: its eyes, lashes, lids, brows, nose
 * line and mouth drawn into a texture on a smooth face, in place of the feature slabs, the way a toon game paints a face. Half of the painterly look (`painterly: true` on an anime hero); the other half is the
 * soft ramp (station-loft-shade.js characterLitPieces, `light.soft`).
 *
 * The features are the head's own: buildAnime (anime-form.js, `paint`) still builds every feature from the graphic face's
 * words, into its own part, and here each part's triangles are projected onto the face's front plane (the studio frame
 * with the head's pitch undone: x right, y up) and kept as the painter's LAYERS. So a painted face places every feature
 * where the slab face does, by construction, and every sculpt word moves the paint as it moved the slab.
 *
 *   FACE_PAINT_WINDOW            the face's front plane in studio units that the texture covers
 *   texOf([x, y])                a point on that plane → texture [s, t] (t up)
 *   paintLayers(parts, project)  the feature parts (studio xyz, flat arrays) → [{ kind, tris }] (quantized [s, t])
 *   faceTexture(paint, palette)  the PNG for a face part's `paint` under its palette: { key, url } (memoized by key)
 *   facePaintOf(mesh, palette)   the painted face on a compiled mesh, for the World faces (characterLitFaces `paint`)
 *   facePaintDense(target)       whether the hero's target keeps the face's full lattice (a close-up's tier)
 *
 * The texture is painted on read from the layers the recipe stores (never stored itself): the skin's base colour
 * everywhere (so an unpainted face of the same skin meets it without a seam), a blush under each eye, then the layers in
 * the slabs' own stacking: the white, its lid shadow, the iris graded dark at the top and light at the bottom with a
 * darker rim, the pupil, the catchlight, the lower rim, the lid and the lash, the brow, the nose line and the mouth.
 * Drawn at three samples a texel each way and averaged. Pure JS, deterministic: the same layers and palette give the
 * same bytes.
 */
import { encodePng } from '../landscape/surface-textures.js';
import { readTarget, DEFAULT_TARGET } from '../era/target.js';
import { tierOf } from '../era/cast-spend.js';

/** the face's front plane the texture covers (studio units: the lattice's u spans about ±0.8, its y about −1.05…1.2) */
export const FACE_PAINT_WINDOW = Object.freeze({ x: Object.freeze([-1.1, 1.1]), y: Object.freeze([-1.2, 1.0]) });
/** the texture's side in texels */
export const FACE_PAINT_SIZE = 512;
/** the tiers (era/cast-spend.js) a painted face keeps the full lattice at: a close-up, 4K; below them the face's skin is
 * the thinned lattice (anime-form.js `paint`), its features being paint */
export const FACE_PAINT_DENSE_TIERS = Object.freeze(['T3', 'T4']);
/** whether a hero drawn for `target` (a target spec, or none: the default, 1080p third-person) wears the dense lattice */
export const facePaintDense = (target) => FACE_PAINT_DENSE_TIERS.includes(tierOf(readTarget(target ?? DEFAULT_TARGET).figurePx).id);
/** the layers' quantum (texture units × Q, integers) */
const Q = 4096;
/** the feature parts buildAnime builds for the painter, in painting order */
export const PAINT_KINDS = Object.freeze(['sclera', 'iris', 'pupil', 'catch', 'ink', 'lid', 'brow', 'nose', 'mouth']);

const W = FACE_PAINT_WINDOW;
export const texOf = ([x, y]) => [(x - W.x[0]) / (W.x[1] - W.x[0]), (y - W.y[0]) / (W.y[1] - W.y[0])];

/** The feature parts (flat xyz arrays, studio units) projected by `project(p) → [x, y]` onto the front plane: the
 * layers in PAINT_KINDS order, each `{ kind, tris }` (tris: flat [s, t] × 3 per triangle, × Q, integers). */
export function paintLayers(parts, project) {
  const out = [];
  for (const kind of PAINT_KINDS) {
    const a = parts[kind]; if (!a?.length) continue;
    const tris = [];
    for (let i = 0; i + 8 < a.length; i += 9) for (let k = 0; k < 3; k++) { const [s, t] = texOf(project([a[i + 3 * k], a[i + 3 * k + 1], a[i + 3 * k + 2]])); tris.push(Math.round(s * Q), Math.round(t * Q)); }
    out.push({ kind, tris });
  }
  return out;
}

// ─── on the compiled mesh ──────────────────────────────────────────────────
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const srgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const toHex = (c) => `#${c.map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0')).join('')}`;

/**
 * The painted face on a compiled layered mesh, or null when no part carries `paint`: `{ key, url, painted(fi), uvAt(ref),
 * light(fill) }`. `painted(fi)`: the mesh face is one the texture covers; `uvAt(ref)`: a piece's corner (a vertex, a point
 * on an edge, a point inside a face, a ring's centroid: characterLitPieces' refs) → its [s, t], interpolated the way its
 * position was; `light(fill)`: a painted face's baked colour as the LIGHT alone, the fill over the skin's base colour in
 * linear light (so the page's texel × colour gives the fill wherever the texture is the base: no seam with the unpainted
 * skin). One painted part per mesh (the anime head's `face`).
 */
export function facePaintOf(mesh, palette = {}) {
  const entry = Object.entries(mesh.parts || {}).find(([, p]) => p?.paint?.layers);
  if (!entry) return null;
  const [name, part] = entry, P = part.paint, { key, url } = faceTexture(P, palette);
  const faces = new Set(P.faces.map((f) => `${name}/${f}`)), uv = new Map();
  mesh.vertices.forEach((_, vi) => { const id = mesh.pointIds?.[vi]; if (id?.startsWith(`${name}/`)) { const t = P.uv[id.slice(name.length + 1)]; if (t) uv.set(vi, t); } });
  const fis = new Set(); mesh.faces.forEach((_, fi) => { if (faces.has(mesh.faceIds?.[fi]) && mesh.faces[fi].every((v) => uv.has(v))) fis.add(fi); });
  const base = hex3(typeof palette.Skin === 'string' ? palette.Skin : '#d9a77e').map(lin);
  const uvAt = (r) => {
    if (r.vi !== undefined) return uv.get(r.vi);
    if (r.bary) return r.bary.reduce((s, [vi, w]) => { const t = uv.get(vi); return [s[0] + t[0] * w, s[1] + t[1] * w]; }, [0, 0]);
    if (r.mix) { const m = r.mix.map(uvAt); return [m.reduce((s, t) => s + t[0], 0) / m.length, m.reduce((s, t) => s + t[1], 0) / m.length]; }
    const a = uv.get(r.a), b = uv.get(r.b); return [a[0] + (b[0] - a[0]) * r.s, a[1] + (b[1] - a[1]) * r.s];
  };
  const lights = new Map();
  const light = (fill) => { let h = lights.get(fill); if (!h) lights.set(fill, h = toHex(hex3(fill).map((c, i) => srgb(Math.min(1, lin(c) / Math.max(1e-6, base[i])))))); return h; };
  return { key, url, painted: (fi) => fis.has(fi), uvAt, light };
}

// ─── colour ────────────────────────────────────────────────────────────────
const hex3 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const mix = (a, b, k) => a.map((x, i) => x + (b[i] - x) * k);
const mul = (a, k) => a.map((x, i) => x * (Array.isArray(k) ? k[i] : k));
const lift = (a, k) => a.map((x) => x + (1 - x) * k);

/** the painter's swatches from the palette (sRGB 0..1) */
function swatches(pal) {
  const get = (k, d) => hex3(typeof pal[k] === 'string' && /^#[0-9a-f]{6}$/i.test(pal[k]) ? pal[k] : d);
  const skin = get('Skin', '#d9a77e'), ink = get('Ink', '#16181c'), hair = get('Hair', '#3b291e');
  return {
    skin, ink, sclera: get('Sclera', '#faf7eb'), iris: get('Iris', '#4d6b6e'), pupil: get('Pupil', '#12171a'), mouth: get('Mouth', '#3d2124'),
    // the brow in the hair's colour taken toward the ink (a painted brow is the hair's, never the lash's black)
    brow: typeof pal.Brow === 'string' ? get('Brow', '#000000') : mix(hair, ink, 0.45),
    // the lower rim lighter than the lash: the ink toward the skin
    rim: mix(ink, skin, 0.35),
    nose: mul(skin, [0.80, 0.70, 0.68]),
    blush: mix(skin, [0.96, 0.52, 0.48], 0.55),
  };
}

// ─── the painter ───────────────────────────────────────────────────────────
const SS = 3;   // samples per texel, each way
const MEMO = new Map(), MEMO_MAX = 16;

/** FNV-1a over a string: the texture's key (deterministic, no platform hash) */
function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/** The PNG of a face part's `paint` ({ size?, layers }) under `palette`: `{ key, url }`, memoized by key. */
export function faceTexture(paint, palette = {}) {
  const size = paint.size ?? FACE_PAINT_SIZE, C = swatches(palette || {});
  const key = `facepaint-${fnv(JSON.stringify([size, C, paint.layers]))}`;
  let url = MEMO.get(key);
  if (!url) {
    url = `data:image/png;base64,${encodePng(paintRgb(paint.layers, size, C), size, size).toString('base64')}`;
    if (MEMO.size >= MEMO_MAX) MEMO.delete(MEMO.keys().next().value);
    MEMO.set(key, url);
  }
  return { key, url };
}

/** the layers painted at SS × SS samples a texel and averaged: an RGB byte buffer, row 0 the top (t = 1) */
function paintRgb(layers, size, C) {
  const N = size * SS, buf = new Float32Array(N * N * 3);
  for (let i = 0; i < N * N; i++) buf.set(C.skin, i * 3);
  const set = (x, y, c) => buf.set(c, (y * N + x) * 3);
  const get = (x, y) => buf.subarray((y * N + x) * 3, (y * N + x) * 3 + 3);
  // a layer's triangles in sample space (x right, y down), each sample whose centre falls inside painted by `colour(x, y)`
  const fill = (tris, colour) => {
    for (let i = 0; i + 5 < tris.length; i += 6) {
      const P = [0, 2, 4].map((k) => [tris[i + k] / Q * N, (1 - tris[i + k + 1] / Q) * N]);
      const area = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]); if (!area) continue;
      const x0 = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0]))), x1 = Math.min(N - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])));
      const y0 = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1]))), y1 = Math.min(N - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const X = x + 0.5, Y = y + 0.5;
        const w0 = ((P[1][0] - X) * (P[2][1] - Y) - (P[2][0] - X) * (P[1][1] - Y)) / area, w1 = ((P[2][0] - X) * (P[0][1] - Y) - (P[0][0] - X) * (P[2][1] - Y)) / area;
        if (w0 < 0 || w1 < 0 || w0 + w1 > 1) continue;
        set(x, y, colour(x, y));
      }
    }
  };
  // each eye's box (sample space) from a layer's triangles: left and right of the face's middle
  const boxes = (tris) => {
    const B = [null, null];
    for (let i = 0; i + 1 < tris.length; i += 2) {
      const x = tris[i] / Q * N, y = (1 - tris[i + 1] / Q) * N, side = x < N / 2 ? 0 : 1, b = B[side] || (B[side] = [Infinity, Infinity, -Infinity, -Infinity]);
      b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y);
    }
    return B;
  };
  const boxAt = (B, x) => B[x < N / 2 ? 0 : 1];
  const by = Object.fromEntries(layers.map((l) => [l.kind, l.tris]));
  // the BLUSH: a soft oval under each eye, toward the cheek (under the white's box), before the features
  const whites = by.sclera ? boxes(by.sclera) : [null, null];
  for (const b of whites) {
    if (!b) continue;
    const cx = (b[0] + b[2]) / 2 + (b[0] < N / 2 ? -1 : 1) * 0.12 * (b[2] - b[0]), cy = b[3] + 0.55 * (b[3] - b[1]), rx = 0.62 * (b[2] - b[0]), ry = 0.32 * (b[2] - b[0]);
    for (let y = Math.max(0, Math.floor(cy - ry)); y < Math.min(N, Math.ceil(cy + ry)); y++) for (let x = Math.max(0, Math.floor(cx - rx)); x < Math.min(N, Math.ceil(cx + rx)); x++) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2; if (d >= 1) continue;
      const k = 0.42 * (1 - d) * (1 - d); set(x, y, mix(get(x, y), C.blush, k));
    }
  }
  // the WHITE, shaded under the lid: its top third toward a cool shade
  if (by.sclera) fill(by.sclera, (x, y) => { const b = boxAt(whites, x), u = (y - b[1]) / Math.max(1, b[3] - b[1]); return u < 0.38 ? mix(mul(C.sclera, [0.80, 0.82, 0.90]), C.sclera, u / 0.38) : C.sclera; });
  // the IRIS: dark at its top (the lid's shadow), light at its bottom, its rim darker
  if (by.iris) {
    const irises = boxes(by.iris), dark = mul(C.iris, 0.5), light = lift(C.iris, 0.38);
    fill(by.iris, (x, y) => {
      const b = boxAt(irises, x), u = (y - b[1]) / Math.max(1, b[3] - b[1]), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      const r = Math.hypot((x - cx) / Math.max(1, (b[2] - b[0]) / 2), (y - cy) / Math.max(1, (b[3] - b[1]) / 2));
      const c = u < 0.5 ? mix(dark, C.iris, u / 0.5) : mix(C.iris, light, (u - 0.5) / 0.5);
      return r > 0.8 ? mix(c, dark, Math.min(1, (r - 0.8) / 0.15)) : c;
    });
  }
  if (by.pupil) fill(by.pupil, () => C.pupil);
  if (by.catch) fill(by.catch, () => [1, 1, 1]);
  if (by.ink) fill(by.ink, () => C.rim);
  if (by.lid) fill(by.lid, () => C.ink);
  if (by.brow) fill(by.brow, () => C.brow);
  if (by.nose) fill(by.nose, () => C.nose);
  if (by.mouth) fill(by.mouth, () => C.mouth);
  // down to a texel: the mean of its samples, as sRGB bytes
  const rgb = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) for (let c = 0; c < 3; c++) {
    let acc = 0; for (let j = 0; j < SS; j++) for (let i = 0; i < SS; i++) acc += buf[((y * SS + j) * N + x * SS + i) * 3 + c];
    rgb[(y * size + x) * 3 + c] = Math.round(Math.min(1, Math.max(0, acc / (SS * SS))) * 255);
  }
  return rgb;
}
