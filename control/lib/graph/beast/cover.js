/**
 * COVER AS FORM, NOT CARDS: a beast-kin's fur, scales, chitin or feathers carried as a MATERIAL an engine lights (the
 * seventh generation's surface model, era/eras.js `form`), where the sixth generation built them as cards (the creature
 * biped's fur tiles and scale tiles were half its triangles). Each kind is a tileable RELIEF (a height field in metres on
 * a square tile), read by the form render's material (form/relief-material.js) into glTF's maps:
 *
 *   COVERS                   the kinds: each its tile's size (metres), its relief's depth, its roughness
 *   coverTile(kind)          → { kind, W, H, px, height, cavity, convex, maps: { base, normal, orm, height } }: the relief
 *                              (deterministic: mulberry32 on the kind), its hollows and crests, and its four maps as PNG
 *                              data URLs: the base a grey the vertex colour multiplies (the coat, darker in its hollows),
 *                              the tangent-space normal (glTF's: +y up the tile), occlusion · roughness · metal packed as
 *                              glTF reads them, and the height (for parallax and displacement, where an engine reads it).
 *                              A FLAT PATCH at the tile's origin (`FLAT_PATCH` texels) is level, white and unoccluded:
 *                              a face the cover does not reach samples it, so one material serves the whole figure.
 *   beastCoverOf(hero)       → the cover a beast wears: `beast.cover` ('none' | a kind), else its kin preset's
 *   coverMap(mesh, recipe, normals, kind)  → { uvAt(fi, k), tangentAt(fi, k), maps, stats }: every coat face (the body's
 *                              skin and the groups its clothes would be, its head's excepted) mapped by its part's own
 *                              rings (the tile's u a slot's place round them, a whole number of tiles so the wrap is
 *                              seamless, its v a station's arc length along their centres), each corner's
 *                              tangent built the MikkTSpace way (polygonizer/normal-bake.js meshTangents); every other
 *                              face on the flat patch
 *
 * The World page draws the cover as paint (its fills are unlit: the coat's colour) until it lights a figure live; the
 * lit skinned GLB carries the maps (station-loft-rig.js packLayeredRig `cover`, scene-gltf.js). Pure.
 */
import { beastCard } from './tiered.js';
import { reliefMaterial } from '../form/relief-material.js';
import { meshTangents, axisTangent } from '../polygonizer/normal-bake.js';
import { encodePng } from '../landscape/surface-textures.js';
import { mulberry32 } from '../polygonizer/floorplan-glyphs.js';

/** each cover's tile (metres across), its relief's depth (metres) and its material's roughness */
export const COVERS = Object.freeze({
  fur: Object.freeze({ tile: 0.08, depth: 0.0025, rough: 0.9 }),
  scales: Object.freeze({ tile: 0.06, depth: 0.003, rough: 0.55 }),
  chitin: Object.freeze({ tile: 0.16, depth: 0.004, rough: 0.35 }),
  feathers: Object.freeze({ tile: 0.12, depth: 0.003, rough: 0.75 }),
});
export const COVER_KINDS = Object.freeze(['none', ...Object.keys(COVERS)]);
/** THE COVER'S QUALITIES (`beast.cover: { kind, … }`), the style words the older generations gave a coat (the egocube
 * creature's cell sizes and its scutes, the fauna's coats), as the material's: each word's entries over its kind's
 * tile (`tile`, `depth` in metres; `L` a fur strand's length, `keel` a ridge down each scale, `rough`, `metal`). The first
 * entry of each word is never the default: a word absent leaves the tile as it was.
 *   length   fur: short (a sleek pelt), plush (the default), shaggy (long, deep strands)
 *   size     scales: fine | medium | large; chitin, feathers: small | medium | large
 *   shape    scales: round (the default) | keeled (a ridge down each scale, a viper's)
 *   sheen    any: matte | satin (the kind's own) | glossy | metal
 *   tipped   any: 0 … 1, the crests lightened (frosted fur, rimed scales, an agouti's banded tips) */
export const COVER_STYLE = Object.freeze({
  length: Object.freeze({ fur: Object.freeze({ short: { tile: 0.06, depth: 0.0016, L: 0.6 }, plush: {}, shaggy: { tile: 0.11, depth: 0.0042, L: 1.6 } }) }),
  size: Object.freeze({
    scales: Object.freeze({ fine: { tile: 0.035, depth: 0.0022 }, medium: {}, large: { tile: 0.1, depth: 0.0045 } }),
    chitin: Object.freeze({ small: { tile: 0.1, depth: 0.003 }, medium: {}, large: { tile: 0.24, depth: 0.005 } }),
    feathers: Object.freeze({ small: { tile: 0.08, depth: 0.0024 }, medium: {}, large: { tile: 0.17, depth: 0.004 } }),
  }),
  shape: Object.freeze({ scales: Object.freeze({ round: {}, keeled: { keel: 0.6 } }) }),
  sheen: Object.freeze({ matte: { rough: 0.95 }, satin: {}, glossy: { rough: 0.28 }, metal: { rough: 0.32, metal: true } }),
});
const STYLE_WORDS = ['kind', 'length', 'size', 'shape', 'sheen', 'tipped'];
/** the words a kind takes */
const wordsOf = (kind, w) => (w === 'sheen' ? COVER_STYLE.sheen : COVER_STYLE[w]?.[kind] ?? null);

/** Error strings for a cover word (empty = valid): a kind, or { kind, …its qualities } */
export function coverErrors(cover, label = 'beast.cover') {
  if (cover === undefined || typeof cover === 'string') return cover === undefined || COVER_KINDS.includes(cover) ? [] : [`${label}: ${COVER_KINDS.join(' | ')}, or { kind, length?, size?, shape?, sheen?, tipped? } (its coat carried as a material)`];
  if (!cover || typeof cover !== 'object' || Array.isArray(cover) || !COVERS[cover.kind]) return [`${label}: { kind: ${Object.keys(COVERS).join(' | ')}, length?, size?, shape?, sheen?, tipped? }`];
  const errs = [];
  for (const [w, v] of Object.entries(cover)) {
    if (!STYLE_WORDS.includes(w)) { errs.push(`${label}.${w}: not a quality of the cover (${STYLE_WORDS.join(', ')})`); continue; }
    if (w === 'kind') continue;
    if (w === 'tipped') { if (!(Number.isFinite(v) && v >= 0 && v <= 1)) errs.push(`${label}.tipped: 0 … 1 (the crests lightened)`); continue; }
    const T = wordsOf(cover.kind, w);
    if (!T) errs.push(`${label}.${w}: ${cover.kind} takes ${STYLE_WORDS.filter((x) => x !== 'kind' && (x === 'tipped' || wordsOf(cover.kind, x))).join(', ')}`);
    else if (!T[v]) errs.push(`${label}.${w}: ${Object.keys(T).join(' | ')}`);
  }
  return errs;
}
/** the qualities of `style` a kind takes (an ooze's cover over any kind: shaggy is fur's, keeled a scale's) */
export const coverQualities = (kind, style = {}) => Object.fromEntries(Object.entries(style).filter(([w, v]) => (w === 'tipped' ? Number.isFinite(v) : !!wordsOf(kind, w)?.[v])));
/** a cover word → { kind, …its qualities } (null for none) */
export const coverStyle = (cover) => (!cover || cover === 'none' ? null : typeof cover === 'string' ? { kind: cover } : { ...cover });
/** a tile's texels across; the flat patch's, at its origin */
export const TILE_PX = 128, FLAT_PATCH = 4;

/** the groups a hero's cover covers: its coat's where it lies below the waist (a lamia's coil and hips), else the whole
 * bare body's */
export const beastCoatOf = (hero) => { const C = beastCard(hero)?.coat; return C ? new Set(C) : COAT; };
export function beastCoverOf(hero) {
  const k = beastCard(hero)?.cover ?? 'none';
  return k === 'none' ? null : k;
}
/** the cover a beast wears with its qualities ({ kind, … }: its own words, an ooze's under them), or null */
export function beastCoverStyleOf(hero) {
  const C = beastCard(hero); if (!C || C.cover === 'none') return null;
  return { kind: C.cover, ...(C.coverStyle ?? {}) };
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (i, n) => ((i % n) + n) % n;
// the shortest way across a wrapping tile
const dW = (a, b, n) => { const d = wrap(a - b, n); return d > n / 2 ? d - n : d; };

// the reliefs, each in texels then scaled to the cover's depth: the most any feature stands at a texel
function relief(kind, W, rand, Q = {}) {
  const h = new Float32Array(W * W);
  const stamp = (cx, cy, rx, ry, f) => { for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
    const u = dW(x, cx, W) / rx, v = dW(y, cy, W) / ry, z = f(u, v); if (z > 0) { const k = wrap(y, W) * W + wrap(x, W); if (z > h[k]) h[k] = z; } } };
  if (kind === 'fur') {
    // strands lying down the body (+v), each a ridge tapering at both ends, a little lean of its own
    for (let n = 0; n < 340; n++) {
      const x0 = rand() * W, y0 = rand() * W, L = (10 + rand() * 12) * (Q.L ?? 1), lean = (rand() - 0.5) * 0.35, w = 1.1 + rand() * 0.6;
      for (let s = 0; s <= L; s++) { const t = s / L, a = Math.sin(Math.PI * t) * (0.55 + 0.45 * (1 - t)); stamp(x0 + lean * s, y0 + s, w, w, (u, v) => a * (1 - u * u - v * v)); }
    }
  } else if (kind === 'scales' || kind === 'feathers') {
    // shingles in offset rows, each over the row above it (a lower row drawn last): a dome whose lower lip stands proud
    const rows = kind === 'scales' ? 8 : 5, per = kind === 'scales' ? 8 : 6, ry = W / rows, rx = W / per;
    for (let r = 0; r < rows; r++) for (let c = 0; c < per; c++) {
      const cx = (c + (r % 2) * 0.5) * rx + (rand() - 0.5) * rx * 0.08, cy = (r + 0.5) * ry;
      // (a feather's vane narrows to its tip, so the rows read as shingled feathers, not stripes)
      stamp(cx, cy, rx * (kind === 'scales' ? 0.62 : 0.56), ry * (kind === 'scales' ? 0.9 : 1.05), (u0, v) => { const u = kind === 'feathers' ? u0 / Math.max(0.2, 1 - 0.6 * clamp(v, 0, 1)) : u0, d = 1 - u * u - v * v; if (d <= 0) return 0;
        const lip = 0.55 + 0.45 * clamp((v + 1) / 2, 0, 1), rachis = kind === 'feathers' ? 1 - 0.35 * Math.exp(-((u * 6) ** 2)) : 1;
        // (a keeled scale: a ridge down its middle, a viper's)
        const keel = Q.keel ? 1 + Q.keel * Math.exp(-((u * 5) ** 2)) * clamp((v + 1) / 2, 0, 1) : 1;
        return (0.25 + 0.75 * Math.sqrt(d)) * lip * rachis * keel + r * 1e-3; });
    }
  } else if (kind === 'chitin') {
    // plates with rounded edges, the grooves between them their joints
    const cols = 2, rows = 3, pw = W / cols, ph = W / rows;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
      const r = Math.floor(y / ph), off = (r % 2) * pw * 0.5, u = (wrap(x - off, W) % pw) / pw * 2 - 1, v = (y % ph) / ph * 2 - 1;
      const edge = Math.min(1 - Math.abs(u), 1 - Math.abs(v)), z = clamp(edge / 0.12, 0, 1);
      h[y * W + x] = z * z * (3 - 2 * z) * (0.85 + 0.15 * (1 - v * v));
    }
  }
  return h;
}

const tileCache = new Map();
/** a cover's tile, its qualities over its kind's (`style`: coverStyle's; absent or empty, the kind's own tile) */
export function coverTile(kind, style = {}) {
  if (!COVERS[kind]) throw new Error(`beast cover: no cover '${kind}' (${Object.keys(COVERS).join(', ')})`);
  const Q = Object.assign({}, ...['length', 'size', 'shape', 'sheen'].map((w) => (style[w] !== undefined ? wordsOf(kind, w)?.[style[w]] ?? {} : {})), style.tipped ? { tipped: style.tipped } : {});
  const key = Object.keys(Q).length ? `${kind}|${JSON.stringify(Q)}` : kind;
  if (tileCache.has(key)) return tileCache.get(key);
  const C = { ...COVERS[kind], ...Q }, W = TILE_PX, px = C.tile / W, rand = mulberry32([...kind].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) >>> 0, 7));
  const raw = relief(kind, W, rand, Q);
  // the flat patch: level at the relief's mean, so a face that samples it reads as the coat with no relief
  let mean = 0; for (const z of raw) mean += z; mean /= raw.length;
  for (let y = 0; y < FLAT_PATCH; y++) for (let x = 0; x < FLAT_PATCH; x++) raw[y * W + x] = mean;
  const height = Float32Array.from(raw, (z) => z * C.depth);
  // the hollows and crests: each texel against its neighbourhood (a wrapping box of a sixteenth of the tile)
  const r = Math.max(1, Math.round(W / 16)), cavity = new Float32Array(W * W), convex = new Float32Array(W * W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    let s = 0, n = 0; for (let b = -r; b <= r; b++) for (let a = -r; a <= r; a++) { s += height[wrap(y + b, W) * W + wrap(x + a, W)]; n++; }
    const d = (s / n - height[y * W + x]) / (C.depth * 0.5);
    cavity[y * W + x] = clamp(d, 0, 1); convex[y * W + x] = clamp(-d, 0, 1);
  }
  for (let y = 0; y < FLAT_PATCH; y++) for (let x = 0; x < FLAT_PATCH; x++) { cavity[y * W + x] = 0; convex[y * W + x] = 0; }
  // the base: a grey the vertex colour multiplies, darker in the hollows (white on the flat patch)
  const base = Buffer.alloc(W * W * 3);
  // (tipped: the coat darkened toward its roots and its crests left light, the tips frosted or banded; the crests are
  // already the base's white, so a tip reads by the coat under it)
  const root = (k) => (C.tipped ? 1 - 0.4 * C.tipped * (1 - convex[k]) : 1);
  for (let k = 0; k < W * W; k++) { const v = Math.round(255 * clamp((1 - 0.45 * cavity[k] + 0.05 * convex[k]) * root(k), 0, 1)); base[k * 3] = base[k * 3 + 1] = base[k * 3 + 2] = v; }
  const M = reliefMaterial({ W, H: W, px, height, tile: true }, { base, cavity, convex, rough: C.rough });
  for (let y = 0; y < FLAT_PATCH; y++) for (let x = 0; x < FLAT_PATCH; x++) { const k = (y * W + x) * 3; M.normal[k] = 128; M.normal[k + 1] = 128; M.normal[k + 2] = 255; base[k] = base[k + 1] = base[k + 2] = 255; }
  // (a metal sheen: the occlusion-roughness-metal map's metal channel full, the flat patch's left a dielectric)
  if (C.metal) for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (x >= FLAT_PATCH || y >= FLAT_PATCH) M.orm[(y * W + x) * 3 + 2] = 255;
  const hgt = Buffer.alloc(W * W * 3);
  for (let k = 0; k < W * W; k++) { const v = Math.round(255 * clamp(height[k] / C.depth, 0, 1)); hgt[k * 3] = hgt[k * 3 + 1] = hgt[k * 3 + 2] = v; }
  const url = (buf) => `data:image/png;base64,${encodePng(buf, W, W).toString('base64')}`;
  const T = { kind, W, H: W, px, height, cavity, convex, normal: M.normal, orm: M.orm, maps: { base: url(base), normal: url(M.normal), orm: url(M.orm), height: url(hgt), size: C.tile, depth: C.depth } };
  tileCache.set(key, T);
  return T;
}

// the parts a cover reaches: the body's coat (a beast is bare: its skin, and the groups its clothes would be, all its coat:
// beast/tiered.js beastWords), not the head's (a library head keeps its own surface)
const COAT = new Set(['Skin', 'Top', 'Bottom', 'Shoes']);
const HEAD_PART = /^(cranium|jaw|eye|iris|pupil|lid|brow|ear|nose|nostril|catch|orbit|tooth|teeth|tongue|whisker|horn|crest|frill|mandible|antenna|beak|lip|mouth|wing[RL]|upperLip|lowerLip)/;

export function coverMap(mesh, recipe, normals, cover, groups = COAT) {
  const { kind, ...style } = coverStyle(cover), T = coverTile(kind, style), C = { ...COVERS[kind], tile: T.maps.size }, coat = groups instanceof Set ? groups : new Set(groups);
  const partOf = (fi) => mesh.provenance[mesh.faces[fi][0]].part;
  // each covered part's own rings: a slot's place round them (a whole number of tiles round, so the wrap is seamless) and a
  // station's arc length along their centres (so a curved tail, a flaring socket and a funnel map as they run, where one
  // straight axis swung the tile round them)
  const frames = new Map();
  const cen = (pts) => { const v = Object.values(pts); return [0, 1, 2].map((q) => v.reduce((t, p) => t + p[q], 0) / v.length); };
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const frameOf = (name) => {
    if (frames.has(name)) return frames.get(name);
    const P = recipe.parts[name], st = P?.stations;
    let f = null;
    if (Array.isArray(st) && st.length >= 2 && st.every((x) => x.points)) {
      const slots = Array.isArray(P.slots) ? P.slots : Object.keys(st[0].points), n = slots.length, at = {}; let s = 0, perim = 0;
      st.forEach((x, i) => { const c = cen(x.points); if (i) s += dist(c, cen(st[i - 1].points)); at[x.id] = { s, c };
        perim += slots.reduce((t, sl, k) => t + dist(x.points[sl], x.points[slots[(k + 1) % n]]), 0); });
      f = { slot: Object.fromEntries(slots.map((sl, k) => [sl, k / n])), at, first: st[0].id, last: st.at(-1).id, around: Math.max(1, Math.round(perim / st.length / C.tile)) };
    }
    frames.set(name, f); return f;
  };
  // (a mesh part that asks for it, `coverChart`, the relational creature head's skin and ears: creature-heads/worn.js, has no
  // rings to run the tile round; each face takes the box chart across its own facing, the tile laid flat on the plane the
  // face looks along most)
  const charted = (P) => !!P?.coverChart && !!P.mesh;
  const covered = (fi) => { const name = partOf(fi), P = recipe.parts[name]; return !!P && coat.has(mesh.groups[fi]) && (P.layer ?? 1) === 1 && (charted(P) ? true : !HEAD_PART.test(name) && !!frameOf(name)); };
  // the light mesh the tangents are built on: each covered corner its own vertex (its uv, its normal)
  const V = [], F = [], UV = [], N = [], cornerV = new Map();
  const flat = [(FLAT_PATCH / 2) / TILE_PX, (FLAT_PATCH / 2) / TILE_PX];
  mesh.faces.forEach((tri, fi) => {
    if (!covered(fi)) return;
    if (charted(recipe.parts[partOf(fi)])) {
      const [a, b, c] = tri.map((vi) => mesh.vertices[vi]), u0 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v0 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [Math.abs(u0[1] * v0[2] - u0[2] * v0[1]), Math.abs(u0[2] * v0[0] - u0[0] * v0[2]), Math.abs(u0[0] * v0[1] - u0[1] * v0[0])];
      const ax = n[0] >= n[1] && n[0] >= n[2] ? 0 : n[1] >= n[2] ? 1 : 2, [i, j] = ax === 0 ? [1, 2] : ax === 1 ? [0, 2] : [0, 1];
      const t = tri.map((vi, k) => { const q = V.length, p = mesh.vertices[vi]; V.push(p); UV.push([p[i] / C.tile, p[j] / C.tile]); const nn = normals?.[fi]?.[k] ?? [0, 0, 1], l = Math.hypot(...nn) || 1; N.push(nn.map((x) => x / l)); return q; });
      F.push(t); cornerV.set(fi, t); return;
    }
    const f = frameOf(partOf(fi)), pole = [];
    const uv = tri.map((vi) => { const pv = mesh.provenance[vi], A = pv.station && f.at[pv.station];
      if (A && f.slot[pv.slot] !== undefined) { pole.push(false); return [f.slot[pv.slot] * f.around, A.s / C.tile]; }
      // (a cap's point: before the first ring or past the last, by its distance from it; no way round of its own)
      pole.push(true); const p = mesh.vertices[vi], back = /\/back$/.test(pv.id), E = f.at[back ? f.first : f.last];
      return [0, (E.s + (back ? -1 : 1) * dist(p, E.c)) / C.tile]; });
    // (a face across the wrap: its corners taken round the same side, so the tile runs on; a cap's point takes its face's
    // others' way round)
    const off = uv.filter((_, k) => !pole[k]), us = off.map((x) => x[0]);
    if (us.length && Math.max(...us) - Math.min(...us) > f.around / 2) for (const x of off) if (x[0] < f.around / 2) x[0] += f.around;
    if (off.length && off.length < 3) { const m = off.reduce((t, x) => t + x[0], 0) / off.length; uv.forEach((x, k) => { if (pole[k]) x[0] = m; }); }
    const t = tri.map((vi, k) => { const i = V.length; V.push(mesh.vertices[vi]); UV.push(uv[k]); const n = normals?.[fi]?.[k] ?? [0, 0, 1], l = Math.hypot(...n) || 1; N.push(n.map((x) => x / l)); return i; });
    F.push(t); cornerV.set(fi, t);
  });
  const Tn = F.length ? meshTangents(V, F, UV.map(([u, v]) => [u, -v]), N) : [];
  return {
    kind, maps: T.maps,
    uvAt: (fi, k) => { const t = cornerV.get(fi); return t ? UV[t[k]] : flat; },
    tangentAt: (fi, k) => { const t = cornerV.get(fi); return t ? Tn[t[k]] : axisTangent((() => { const n = normals?.[fi]?.[k] ?? [0, 0, 1], l = Math.hypot(...n) || 1; return n.map((x) => x / l); })()); },
    stats: { faces: F.length, of: mesh.faces.length, parts: [...frames.values()].filter(Boolean).length },
  };
}
