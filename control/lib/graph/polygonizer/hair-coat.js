/**
 * THE LOCK'S COAT: an anime head's shaped locks (anime-form.js `shapes`) coloured as an animal's coat is, not one flat
 * `Hair`: textured (a cover: scales, fur, chitin, feathers) and marked (a pattern: countershade, stripes, spots,
 * rosettes, points, dorsal), so tendrils can be a snake's, quills banded, feathers barred, flames hot at the root.
 *
 * The grammar is the beast-kin's, not a new one (beast/cover.js, beast/pattern.js), checked by its own validators. A
 * layer, a placed piece or the whole `shapes` takes
 *
 *   coat: '<card>' | { from?: '<card>', color?, cover?, pattern? }
 *     color    the lock's own colour: '#rrggbb' or a palette key (`Hair` by default)
 *     cover    a relief: scales | fur | chitin | feathers, or { kind, size?, shape?, sheen?, tipped? }
 *     pattern  the beast's layers, read on the lock as on a tail (pattern.js region `lock`)
 *
 * A card (COAT_CARDS) is a coat filled in; `from` lays the person's words over one.
 *
 * A lock is read along its own centre line (the line it was built along): `t` its place from root (0) to tip (1), `theta`
 * its place round it from its OUTER face (0, away from the head) to the face toward the head (1), the same on both of
 * its sides, so the map has no seam (a lock is a tube, and every marking a tube carries here is symmetric across it).
 *
 *   validateHairCoat(coat, at)        → error strings (form)
 *   resolveHairCoat(coat)             → { color, cover, pattern } (a card's words under the coat's own)
 *   lockCoatFrame(points, line, centre) → { uv: [[theta, t] per point], length, radius } (construction units)
 *   hairCoatPaint(mesh, recipe)       → the paint over the coated locks (the face paint's interface), or null
 *   composePaints(paints)             → one paint over several (each face drawn by the first that paints it), or the one
 *
 * The page draws a coat as colour; a cover's relief shades it there too (its hollows darker, its crests lighter, read off
 * the cover's own tile), so scales read on a cel-lit head. Pure, deterministic. Absent a coat, nothing here runs.
 */
import { coverErrors, coverTile, COVER_KINDS } from '../beast/cover.js';
import { patternErrors, patternField } from '../beast/pattern.js';
import { encodePngRgba } from '../landscape/surface-textures.js';
import { decodePng } from '../era/tone.js';
import { COAT_CARDS, COAT_CARD_NAMES, hairCoatFormErrors, resolveHairCoat, lockCoatFrame } from './hair-coat-words.js';

export { COAT_CARDS, COAT_CARD_NAMES, hairCoatFormErrors, resolveHairCoat, lockCoatFrame };

const HEX = /^#[0-9a-f]{6}$/i;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** Error strings for a `coat` (empty = valid): its form, then its cover's and its pattern's words, the beast's own */
export function validateHairCoat(coat, at = 'coat') {
  const errs = hairCoatFormErrors(coat, at);
  if (errs.length || !isObj(coat)) return errs;
  if (coat.cover !== undefined && coat.cover !== 'none') errs.push(...coverErrors(coat.cover, `${at}.cover`));
  errs.push(...patternErrors(coat.pattern, `${at}.pattern`));
  return errs;
}

/** every `coat` a hero's hair names (in its shapes, its layers, its pieces), with where: for the hero door's check */
export function hairCoatsIn(hair, at = 'hair') {
  const out = [];
  const walk = (v, path) => { if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`)); else if (isObj(v)) for (const [k, x] of Object.entries(v)) { if (k === 'coat') out.push([x, `${path}.coat`]); else walk(x, `${path}.${k}`); } };
  walk(hair, at);
  return out;
}


// ─── the paint, on the compiled mesh ─────────────────────────────────────────
/** texels a metre at a 1.8 m figure (finer than a body's coat: a lock is a few centimetres round), the atlas's bounds */
export const HAIR_COAT_PPM = 900;
const ATLAS_W = 1024, ATLAS_MAX_H = 2048, PAD = 2, WHITE = 8;
const hex3 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4), srgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const toHex = (c) => `#${c.map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('')}`;
function fnvBytes(b) { let h = 0x811c9dc5; for (let i = 0; i < b.length; i += 7) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
const hexOf = (c, palette, fallback) => (HEX.test(c) ? c : HEX.test(palette?.[c] ?? '') ? palette[c] : fallback);

/** The paint over a figure's coated locks (each part carrying `coat`: its spec, its points' [theta, t], its length and
 * radius in metres), or null when none is coated. */
export function hairCoatPaint(mesh, recipe = {}) {
  const palette = recipe.palette || {};
  const locks = Object.entries(mesh.parts || {}).filter(([, P]) => P?.coat?.uv && P.coat.spec);
  if (!locks.length) return null;
  const zs = mesh.vertices.map((v) => v[2]), k = (Math.max(...zs) - Math.min(...zs)) / 1.8 || 1, hairHex = hexOf('Hair', palette, '#3b291e');
  // each coat's field and its cover's tile, once
  const fields = new Map(), tiles = new Map();
  const fieldOf = (spec) => { const key = JSON.stringify(spec); let f = fields.get(key);
    if (!f) { const base = hexOf(spec.color, palette, hairHex); fields.set(key, f = { base, field: spec.pattern?.length ? patternField(spec.pattern, { coat: base, k }) : () => null }); } return f; };
  const tileOf = (cover) => { if (!cover?.kind || !COVER_KINDS.includes(cover.kind) || cover.kind === 'none') return null; const key = JSON.stringify(cover); let T = tiles.get(key);
    if (T === undefined) { const { kind, ...style } = cover; try { T = coverTile(kind, style); } catch { T = null; } tiles.set(key, T); } return T; };
  // each lock's size in metres: its build-unit length and radius by the ratio of its span on the mesh to its span built
  const spans = new Map(locks.map(([name]) => [name, [[Infinity, Infinity, Infinity], [-Infinity, -Infinity, -Infinity]]]));
  mesh.vertices.forEach((v, vi) => { const id = mesh.pointIds?.[vi]; if (!id) return; const b = spans.get(id.slice(0, id.indexOf('/'))); if (!b) return; for (let q = 0; q < 3; q++) { b[0][q] = Math.min(b[0][q], v[q]); b[1][q] = Math.max(b[1][q], v[q]); } });
  const metres = (name, P) => { const b = spans.get(name), d = Math.hypot(b[1][0] - b[0][0], b[1][1] - b[0][1], b[1][2] - b[0][2]); return Number.isFinite(d) && P.coat.span > 0 ? d / P.coat.span : 1; };
  // the rectangles: round the lock (half its girth: the map is mirrored) by down it, packed in shelves, tallest first
  const rects = locks.map(([name, P], i) => { const m = metres(name, P), length = P.coat.length * m, radius = P.coat.radius * m;
    return { name, i, P, length, radius, w: Math.max(4, Math.ceil(Math.PI * radius * HAIR_COAT_PPM / k)), h: Math.max(4, Math.ceil(length * HAIR_COAT_PPM / k)) }; });
  rects.sort((x, y) => y.h - x.h || (x.name < y.name ? -1 : 1));
  let scale = 1, H = 0;
  const pack = (sc) => { let x = WHITE + PAD, y = 0, shelf = 0;
    for (const r of rects) { r.W = Math.max(4, Math.min(ATLAS_W - PAD, Math.ceil(r.w * sc))); r.Hh = Math.max(4, Math.ceil(r.h * sc)); if (x + r.W + PAD > ATLAS_W) { x = 0; y += shelf + PAD; shelf = 0; } r.x = x; r.y = y; x += r.W + PAD; shelf = Math.max(shelf, r.Hh); }
    return y + shelf + PAD; };
  for (let it = 0; it < 14; it++) { H = pack(scale); if (H <= ATLAS_MAX_H) break; scale *= 0.85; }
  H = 1 << Math.ceil(Math.log2(Math.max(WHITE + PAD, H)));
  // PAINT: each texel the coat's field at its place on the lock, shaded by the cover's relief
  const px = new Uint8Array(ATLAS_W * H * 4).fill(255);
  for (const r of rects) {
    const { spec } = r.P.coat, { length, radius } = r, F = fieldOf(spec), T = tileOf(spec.cover), base = hex3(F.base);
    for (let py = 0; py < r.Hh; py++) for (let qx = 0; qx < r.W; qx++) {
      const theta = (qx + 0.5) / r.W, t = (py + 0.5) / r.Hh, s = t * length, across = theta * Math.PI * radius, D = Math.cos(theta * Math.PI);
      const c = F.field({ region: 'lock', D, theta, z: 0, zt: 0, chain: t, s, across, p: [across, s, r.i * 0.37] });
      let rgb = c ? hex3(c) : base;
      if (T) { const n = T.W, x = ((Math.floor((across / T.maps.size) * n) % n) + n) % n, y = ((Math.floor((s / T.maps.size) * n) % n) + n) % n, o = y * n + x;
        const shade = Math.max(0, Math.min(1.1, 1 - 0.35 * T.cavity[o] + 0.08 * T.convex[o])); rgb = rgb.map((v) => Math.min(1, v * shade)); }
      const o = ((r.y + py) * ATLAS_W + r.x + qx) * 4; px[o] = Math.round(rgb[0] * 255); px[o + 1] = Math.round(rgb[1] * 255); px[o + 2] = Math.round(rgb[2] * 255); px[o + 3] = 255;
    }
  }
  const url = `data:image/png;base64,${encodePngRgba(Buffer.from(px.buffer, px.byteOffset, px.byteLength), ATLAS_W, H).toString('base64')}`;
  const key = `hairCoat-${fnvBytes(px)}-${ATLAS_W}x${H}`;
  // UV per vertex on its lock's rectangle (`part/v12`)
  const byName = new Map(rects.map((r) => [r.name, r])), uv = new Map(), owner = new Map();
  mesh.vertices.forEach((_, vi) => {
    const id = mesh.pointIds?.[vi]; if (!id) return;
    const slash = id.indexOf('/'), r = byName.get(id.slice(0, slash)); if (!r) return;
    const q = r.P.coat.uv[id.slice(slash + 1)]; if (!q) return;
    uv.set(vi, [(r.x + q[0] * r.W) / ATLAS_W, 1 - (r.y + q[1] * r.Hh) / H]); owner.set(vi, r);
  });
  // a face is painted when its corners all lie on one coated lock; its light is its lit fill over the lock's own group's
  // colour (the fill the page lit it from), so the texel, which carries the coat, is lit and never tinted twice
  const fis = new Map();
  mesh.faces.forEach((tri, fi) => { const r = owner.get(tri[0]); if (r && tri.every((vi) => owner.get(vi) === r)) fis.set(fi, r); });
  if (!fis.size) return null;
  const white = [(WHITE / 2) / ATLAS_W, 1 - (WHITE / 2) / H];
  const bases = new Map(rects.map((r) => [r.name, hex3(hexOf(r.P.group ?? 'Hair', palette, hairHex)).map(lin)])), lights = new Map();
  let face = -1;
  const uvAt = (ref) => {
    if (ref.vi !== undefined) return uv.get(ref.vi) ?? white;
    if (ref.bary) return ref.bary.reduce((s, [vi, w]) => { const t = uv.get(vi) ?? white; return [s[0] + t[0] * w, s[1] + t[1] * w]; }, [0, 0]);
    if (ref.mix) { const m = ref.mix.map(uvAt); return [m.reduce((s, t) => s + t[0], 0) / m.length, m.reduce((s, t) => s + t[1], 0) / m.length]; }
    const A = uv.get(ref.a) ?? white, B = uv.get(ref.b) ?? white; return [A[0] + (B[0] - A[0]) * ref.s, A[1] + (B[1] - A[1]) * ref.s];
  };
  const light = (fill) => { const r = fis.get(face), base = bases.get(r?.name) ?? hex3(hairHex).map(lin), lk = `${r?.name}|${fill}`;
    let h = lights.get(lk); if (!h) lights.set(lk, h = toHex(hex3(fill).map((x, i) => srgb(Math.min(1, lin(x) / Math.max(1e-6, base[i])))))); return h; };
  return { key, url, painted: (fi) => { if (fis.has(fi)) { face = fi; return true; } return false; }, uvAt, light,
    atlas: { url, w: ATLAS_W, h: H }, white, stats: { locks: rects.length, faces: fis.size, scale, height: H },
    // (the rig pack's paint, for a figure whose pack carries no other: its UVs on the atlas as they are, no drawn states)
    baseUV: (t) => t, regionOf: new Map(), regions: [], hidden: [0, 0, 0], targets: 0, rgba: px };
}

/** The rig pack's paint with the coat's under it on one atlas (the pack carries one texture): the pack's page above, the
 * coat's below, each paint's UVs (its cards' and its cloth's too) moved onto its own rows; a face the coat paints is the
 * coat's. For the World page's clip preview; an export keeps the pack's atlas as its own laws lay it out. A pack whose
 * atlas cannot be read, or one drawing states (`targets`, `regions`): the pack as it is. */
export function stackPaints(a, b) {
  if (!a || !b?.rgba || a.targets || a.regions?.length) return a ?? b;
  const A = decodePng(a.atlas?.url); if (!A) return a;
  const bw = b.atlas.w, bh = b.atlas.h, W = Math.max(A.W, bw), H = A.H + bh, px = new Uint8Array(W * H * 4).fill(255);
  for (let y = 0; y < A.H; y++) px.set(A.px.subarray(y * A.W * 4, (y + 1) * A.W * 4), y * W * 4);
  for (let y = 0; y < bh; y++) px.set(b.rgba.subarray(y * bw * 4, (y + 1) * bw * 4), (A.H + y) * W * 4);
  const onA = ([s, t]) => [(s * A.W) / W, 1 - ((1 - t) * A.H) / H], onB = ([s, t]) => [(s * bw) / W, 1 - (A.H + (1 - t) * bh) / H];
  const url = `data:image/png;base64,${encodePngRgba(Buffer.from(px.buffer, px.byteOffset, px.byteLength), W, H).toString('base64')}`;
  let cur = null;
  const moved = (f) => (f ? (fi) => { const c = f(fi); return c ? c.map(onA) : c; } : undefined);
  return {
    key: `${a.key}+${b.key}`, url, atlas: { url, w: W, h: H }, baseUV: (t) => t, white: onA(a.white),
    painted: (fi) => { cur = b.painted(fi) ? b : a.painted(fi) ? a : null; return !!cur; },
    uvAt: (r) => (cur === b ? onB(b.uvAt(r)) : onA(a.baseUV(a.uvAt(r)))), light: (fill) => cur.light(fill),
    regionOf: new Map(), regions: [], hidden: a.hidden ?? [0, 0, 0], targets: 0,
    ...(a.cardUV ? { cardUV: moved(a.cardUV) } : {}), ...(a.clothUV ? { clothUV: moved(a.clothUV) } : {}), ...(a.alphaMask ? { alphaMask: true } : {}),
  };
}

/** One paint over several: each face is drawn by the first that paints it (its texture, its UVs, its light); the page
 * registers every texture (`textures`). One paint alone is returned as it is; none, null. */
export function composePaints(paints) {
  const list = paints.filter(Boolean);
  if (list.length < 2) return list[0] ?? null;
  let cur = null;
  return {
    get key() { return cur?.key ?? list[0].key; },
    url: list[0].url,
    textures: Object.fromEntries(list.map((p) => [p.key, p.url])),
    painted: (fi) => { cur = list.find((p) => p.painted(fi)) ?? null; return !!cur; },
    uvAt: (r) => cur.uvAt(r),
    light: (fill) => cur.light(fill),
  };
}
