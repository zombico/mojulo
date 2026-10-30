/**
 * DERMAL RELIEF — the realistic hero's relief baked from its own field into a normal map (polygonizer/normal-bake.js) on
 * its skin's atlas (dermal-hero.js heroSkinPaint: the UVs the base colour already uses), for an engine that lights the
 * figure live: the lit skinned GLB (scene-gltf.js), and through it Godot, Unity, Unreal and Blender.
 *
 *   heroRelief(mesh, recipe, paint, normals, opts) → { tangentAt(fi, k), atlas: { url, w, h }, orm?, stats } | null
 *
 * A paint carrying a CLOTH PAGE (realistic laws 13: heroSkinPaint's `cloth`, epidermis/cloth-relief.js) has its clothes'
 * relief baked into the same map's rows (each garment's tube unrolled there), its cloth faces' tangents built on their
 * own UVs as the head's are, an `orm` map ({ url, w, h }: occlusion, roughness, metalness; the skin's texels
 * SKIN_ROUGH) and a `depth` map ({ url, w, h, depth, perM }: the parallax's, white the surface, black `depth` m under it,
 * `perM` the UVs a metre spans across and along the cloth page) beside it.
 *
 * The one-skin head (hero-one-skin.js) is its field netted and quadric-simplified: the map puts back what the
 * simplification spent (the lids' crease, the lips' line, the nostrils' wings), each texel the field's own normal at its
 * light-mesh point stepped onto the field (hero-relational-head.js oneSkinFields: the skin's field, each ear's own). The
 * faces baked are the head page's skin faces of `headSkin`, `earR` and `earL`; every other texel of the atlas is flat
 * (the interpolated normal), so the body's page, a garment's corners on the atlas's white texel and the rest shade as
 * they would without a map.
 *
 * `normals` are the shading normals the pack carries per face corner (station-loft-shade.js layeredShadingNormals: the
 * lit export's weld); the tangents are built on exactly those corners (each corner's vertex, its place on the atlas and
 * its normal one vertex, as the GLB welds them), so the basis the map is baked in is the one the GLB writes.
 * `tangentAt(fi, k)` is a corner's [x, y, z, w]; a corner off the bake takes the axis least along its normal, laid in
 * its plane (w 1), which a flat texel never reads. The map's size is the atlas scaled so the head's page is `size`
 * texels across: by the skin's own rung (`headFit.skinFaces`, set by the target through ONE_SKIN_RUNGS), RELIEF_SIZE.
 * null when the head is not one skin or its fit keeps no column (a hero minted before realistic laws 5). Pure and
 * deterministic.
 */
import { bakeFieldNormals, meshTangents, axisTangent, FLAT } from '../polygonizer/normal-bake.js';
import { encodePng } from '../landscape/surface-textures.js';
import { oneSkinFields } from '../polygonizer/hero-relational-head.js';
import { ONE_SKIN, ONE_SKIN_RUNGS } from '../polygonizer/hero-one-skin.js';
import { clothBake, clothMaps, SKIN_ROUGH, CLOTH_DEPTH } from './cloth-relief.js';

/** the head's page in texels across the map by the skin's rung (no target: the skin whole, as L2) */
export const RELIEF_SIZE = Object.freeze({ L2: 512, L1: 256, L0: 128 });
/** the bake on the head: a light-mesh point further than trust[0] m from the rebuilt field eases flat, wholly by
 * trust[1] (a guard: the rebuilt field matches the netted one within a few millimetres); the longest projection step */
export const RELIEF_BAKE = Object.freeze({ trust: [0.004, 0.008], step: 0.006 });
/** the parts the head's bake covers, and the field each reads */
const RELIEF_PARTS = Object.freeze({ headSkin: 'skin', earR: 'earR', earL: 'earL' });

/** a hero record whose lit skinned export carries the relief: the realistic form minted under realistic laws 5, on its
 * relational head (one skin); the bake itself still needs the fit's column (heroRelief returns null without it) */
export function reliefOnRecord(hero) {
  if (!hero || hero.form !== 'realistic' || (hero.head ?? 'relational') !== 'relational') return false;
  const laws = hero.physique && typeof hero.physique === 'object' ? hero.physique.laws : undefined;
  return (laws ?? 1) >= 5;
}

/** the skin's rung from the faces it was simplified to */
export function reliefRung(recipe) {
  const n = recipe?.headFit?.skinFaces;
  if (!n) return 'L2';
  return Object.entries(ONE_SKIN_RUNGS).find(([, r]) => (r.faces ?? ONE_SKIN.faces) === n)?.[0] ?? 'L2';
}

const f32 = Math.fround;
const unit = (a) => { const l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); return l > 0 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 1]; };

/** The realistic head's relief map and its tangents (see the head of the file). */
export function heroRelief(mesh, recipe, paint, normals, { size = null, dilate = 4, trace = false } = {}) {
  const fields = oneSkinFields(recipe);
  if (!fields || !paint?.faceUV || !paint.pages || !normals) return null;
  const partOf = (fi) => mesh.provenance[mesh.faces[fi][0]].part;
  // THE LIGHT MESH: the head page's skin faces of the bake's parts, each corner one vertex by its point, its place on the
  // atlas and its normal (as the pack writes them, float32): the GLB's own vertices
  const key = new Map(), V = [], N = [], uv = [], F = [], fieldOfF = [], cornerV = new Map();
  mesh.faces.forEach((tri, fi) => {
    const which = RELIEF_PARTS[partOf(fi)]; if (!which || !paint.onHead(fi) || !fields[which]) return;
    const st = paint.faceUV(fi); if (!st) return;
    const t = tri.map((vi, k) => {
      const n = normals[fi][k], s = f32(st[k][0]), v = f32(1 - f32(st[k][1])), nn = [f32(n[0]), f32(n[1]), f32(n[2])];
      const kk = `${vi}|${s}|${v}|${nn.join(',')}`;
      let i = key.get(kk);
      if (i === undefined) { i = V.length; key.set(kk, i); V.push(mesh.vertices[vi]); N.push(unit(nn)); uv.push([s, v]); }
      return i;
    });
    F.push(t); fieldOfF.push(fields[which]); cornerV.set(fi, t);
  });
  if (!F.length) return null;
  const T = meshTangents(V, F, uv, N);
  // THE MAP: the atlas scaled so its head page is `size` texels across
  const S = size ?? RELIEF_SIZE[reliefRung(recipe)], scale = S / paint.pages.head[0];
  const width = Math.max(1, Math.round(paint.pages.W * scale)), height = Math.max(1, Math.round(paint.pages.H * scale));
  const bake = bakeFieldNormals({ V, F, uv, N, T, fieldOf: (i) => fieldOfF[i], width, height, dilate, trust: RELIEF_BAKE.trust, step: RELIEF_BAKE.step, trace });
  // (the atlas's white texel, every unpainted corner's: flat about it, whatever a chart's dilation reached)
  const wx = Math.floor(paint.white[0] * width), wy = Math.floor((1 - paint.white[1]) * height);
  for (let y = Math.max(0, wy - 2); y <= Math.min(height - 1, wy + 2); y++) for (let x = Math.max(0, wx - 2); x <= Math.min(width - 1, wx + 2); x++) bake.rgb.set(FLAT, (y * width + x) * 3);
  // THE CLOTH PAGE (realistic laws 13, epidermis/cloth-relief.js; the paint's `cloth`, at this map's own scale): its
  // relief into the map's rows under the strands, its faces' tangents from their own UVs (the tube unrolled), and the
  // whole map's ORM beside it (the skin's texels the export's roughness, SKIN_ROUGH; a cloth's its own)
  const C = paint.cloth && Math.abs(paint.cloth.scale - scale) < 1e-9 ? paint.cloth : null;
  let orm = null, depthMap = null, clothStats = null;
  const clothV = new Map();
  let CT = null;
  if (C) {
    const page = C.page, cb = clothBake(C.chart, page, recipe), maps = clothMaps(cb, page), row = Math.round(C.row * scale);
    const cw = Math.min(page.W, width);
    for (let y = 0; y < page.H && row + y < height; y++) bake.rgb.set(maps.normal.subarray(y * page.W * 3, (y * page.W + cw) * 3), ((row + y) * width) * 3);
    const o = new Uint8Array(width * height * 3);
    for (let q = 0; q < width * height; q++) { o[q * 3] = 255; o[q * 3 + 1] = Math.round(SKIN_ROUGH * 255); o[q * 3 + 2] = 0; }
    for (let y = 0; y < page.H && row + y < height; y++) o.set(maps.orm.subarray(y * page.W * 3, (y * page.W + cw) * 3), ((row + y) * width) * 3);
    const op = encodePng(Buffer.from(o.buffer, o.byteOffset, o.byteLength), width, height);
    orm = { url: `data:image/png;base64,${op.toString('base64')}`, w: width, h: height };
    // (the PARALLAX's depth map over the whole atlas, white but where a cloth sinks; the UVs a metre spans across and
    // along the cloth page, for an engine to march it in metres)
    const dm = new Uint8Array(width * height * 3).fill(255);
    for (let y = 0; y < page.H && row + y < height; y++) dm.set(maps.depth.subarray(y * page.W * 3, (y * page.W + cw) * 3), ((row + y) * width) * 3);
    const dp = encodePng(Buffer.from(dm.buffer, dm.byteOffset, dm.byteLength), width, height);
    depthMap = { url: `data:image/png;base64,${dp.toString('base64')}`, w: width, h: height, depth: CLOTH_DEPTH, perM: [1 / (page.least * width), 1 / (page.least * height)].map((v) => Math.round(v * 1e6) / 1e6) };
    // (the cloth's light mesh, as the head's: each corner one vertex by its point, its place and its normal)
    const ck = new Map(), CV = [], CN = [], cuv = [], CF = [];
    mesh.faces.forEach((tri, fi) => {
      const st = paint.clothUV?.(fi); if (!st) return;
      clothV.set(fi, tri.map((vi, k) => {
        const n = normals[fi][k], su = f32(st[k][0]), v = f32(1 - f32(st[k][1])), nn = [f32(n[0]), f32(n[1]), f32(n[2])], kk = `${vi}|${su}|${v}|${nn.join(',')}`;
        let i = ck.get(kk); if (i === undefined) { i = CV.length; ck.set(kk, i); CV.push(mesh.vertices[vi]); CN.push(unit(nn)); cuv.push([su, v]); }
        return i;
      }));
    });
    for (const t of clothV.values()) CF.push(t);
    CT = meshTangents(CV, CF, cuv, CN);
    clothStats = { islands: C.chart.islands.length, swatches: C.chart.swatches.length, faces: clothV.size, page: [page.W, page.H], bytes: op.length };
  }
  const png = encodePng(Buffer.from(bake.rgb.buffer, bake.rgb.byteOffset, bake.rgb.byteLength), width, height);
  return {
    tangentAt: (fi, k) => { const t = cornerV.get(fi); if (t) return T[t[k]]; const c = clothV.get(fi); return c ? CT[c[k]] : axisTangent(unit(normals[fi][k])); },
    atlas: { url: `data:image/png;base64,${png.toString('base64')}`, w: width, h: height },
    ...(orm ? { orm } : {}),
    ...(depthMap ? { depth: depthMap } : {}),
    stats: { ...bake.stats, width, height, size: S, faces: F.length, vertices: V.length, bytes: png.length, ...(clothStats ? { cloth: clothStats } : {}) },
    // (the bake and its light mesh, for a gate to read the map against the mesh: never packed)
    map: bake, light: { V, F, N, uv }, fields,
  };
}
