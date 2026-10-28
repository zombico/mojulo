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
 *   beastCoverOf(hero)       → the cover a beast wears: `beast.cover` ('none' | a kind), else its kin's card's
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
import { BEAST_KINS } from './cards.js';
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
/** a tile's texels across; the flat patch's, at its origin */
export const TILE_PX = 128, FLAT_PATCH = 4;
const KIN_COVER = Object.freeze({ ursine: 'fur', lupine: 'fur', feline: 'fur', draconic: 'scales', avian: 'feathers', insectoid: 'chitin' });

export function beastCoverOf(hero) {
  const B = hero?.beast; if (!B || !BEAST_KINS[B.kin]) return null;
  const k = B.cover ?? KIN_COVER[B.kin] ?? 'none';
  return k === 'none' ? null : k;
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (i, n) => ((i % n) + n) % n;
// the shortest way across a wrapping tile
const dW = (a, b, n) => { const d = wrap(a - b, n); return d > n / 2 ? d - n : d; };

// the reliefs, each in texels then scaled to the cover's depth: the most any feature stands at a texel
function relief(kind, W, rand) {
  const h = new Float32Array(W * W);
  const stamp = (cx, cy, rx, ry, f) => { for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
    const u = dW(x, cx, W) / rx, v = dW(y, cy, W) / ry, z = f(u, v); if (z > 0) { const k = wrap(y, W) * W + wrap(x, W); if (z > h[k]) h[k] = z; } } };
  if (kind === 'fur') {
    // strands lying down the body (+v), each a ridge tapering at both ends, a little lean of its own
    for (let n = 0; n < 340; n++) {
      const x0 = rand() * W, y0 = rand() * W, L = 10 + rand() * 12, lean = (rand() - 0.5) * 0.35, w = 1.1 + rand() * 0.6;
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
        return (0.25 + 0.75 * Math.sqrt(d)) * lip * rachis + r * 1e-3; });
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
export function coverTile(kind) {
  if (!COVERS[kind]) throw new Error(`beast cover: no cover '${kind}' (${Object.keys(COVERS).join(', ')})`);
  if (tileCache.has(kind)) return tileCache.get(kind);
  const C = COVERS[kind], W = TILE_PX, px = C.tile / W, rand = mulberry32([...kind].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) >>> 0, 7));
  const raw = relief(kind, W, rand);
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
  for (let k = 0; k < W * W; k++) { const v = Math.round(255 * clamp(1 - 0.45 * cavity[k] + 0.05 * convex[k], 0, 1)); base[k * 3] = base[k * 3 + 1] = base[k * 3 + 2] = v; }
  const M = reliefMaterial({ W, H: W, px, height, tile: true }, { base, cavity, convex, rough: C.rough });
  for (let y = 0; y < FLAT_PATCH; y++) for (let x = 0; x < FLAT_PATCH; x++) { const k = (y * W + x) * 3; M.normal[k] = 128; M.normal[k + 1] = 128; M.normal[k + 2] = 255; base[k] = base[k + 1] = base[k + 2] = 255; }
  const hgt = Buffer.alloc(W * W * 3);
  for (let k = 0; k < W * W; k++) { const v = Math.round(255 * clamp(height[k] / C.depth, 0, 1)); hgt[k * 3] = hgt[k * 3 + 1] = hgt[k * 3 + 2] = v; }
  const url = (buf) => `data:image/png;base64,${encodePng(buf, W, W).toString('base64')}`;
  const T = { kind, W, H: W, px, height, cavity, convex, normal: M.normal, orm: M.orm, maps: { base: url(base), normal: url(M.normal), orm: url(M.orm), height: url(hgt), size: C.tile, depth: C.depth } };
  tileCache.set(kind, T);
  return T;
}

// the parts a cover reaches: the body's coat (a beast is bare: its skin, and the groups its clothes would be, all its coat:
// beast/tiered.js beastWords), not the head's (a library head keeps its own surface)
const COAT = new Set(['Skin', 'Top', 'Bottom', 'Shoes']);
const HEAD_PART = /^(cranium|jaw|eye|iris|pupil|lid|brow|ear|nose|nostril|catch|orbit|tooth|teeth|tongue|whisker|horn|crest|frill|mandible|antenna|beak|lip|mouth|wing[RL]|upperLip|lowerLip)/;

export function coverMap(mesh, recipe, normals, kind) {
  const T = coverTile(kind), C = COVERS[kind];
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
  const covered = (fi) => { const name = partOf(fi), P = recipe.parts[name]; return !!P && COAT.has(mesh.groups[fi]) && (P.layer ?? 1) === 1 && !HEAD_PART.test(name) && !!frameOf(name); };
  // the light mesh the tangents are built on: each covered corner its own vertex (its uv, its normal)
  const V = [], F = [], UV = [], N = [], cornerV = new Map();
  const flat = [(FLAT_PATCH / 2) / TILE_PX, (FLAT_PATCH / 2) / TILE_PX];
  mesh.faces.forEach((tri, fi) => {
    if (!covered(fi)) return;
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
