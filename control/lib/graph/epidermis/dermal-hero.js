/**
 * DERMAL HERO — the realistic hero's whole skin for an export: the body's (dermal-body.js: its grids unrolled into
 * islands, painted by the head's painter) and the head's (the relational grid head the door mints, hero-relational-head.js,
 * read back into the head's own frame by the fit its recipe keeps, `recipe.headFit`, and charted on the head's sphere
 * with its marks, dermal-head.js `headChartOf`: the surface net's addresses, so its lips, lids, brows and beard land
 * where the dermis map lays them), the neck toned toward the head's lowest skin. Two pages: the body's and the head's.
 *
 *   heroDermis(mesh, recipe, { sex, dermis, page, headPage }) → { pages: { body, head? }, faceOf(fi) → { page, uv } | null }
 *   heroSkinPaint(mesh, recipe, opts)  → the PAINT a figure's pack carries (station-loft-rig.js packLayeredRig `paint`, as
 *                                        skin-paint.js's): the two pages' albedo on one atlas (the body's over the head's),
 *                                        each skin face's corners on it, the rest on its white texel; the GLB's base colour
 *
 * A face is the skin's when its part is the body's or the head's and its group is `Skin` (a painted band, a garment, an
 * eye's globe or the mouth keep their colours: null). The head's points let down inside another part's skin (the
 * cranium under the visage, a rim tucked under its neighbour) are painted too but cast and take no occlusion.
 * `mesh` the compiled hero (station-loft.js `compileLayered`), `recipe` its recipe. Pure and deterministic.
 */
import { relationalHead } from '../polygonizer/head-relational.js';
import { HEAD_TUNES } from '../polygonizer/hero-relational-head.js';
import { readDermis, skinBase } from './dermal-map.js';
import { vertexNormals } from './dermal-chart.js';
import { headChartOf, STAND_M } from './dermal-head.js';
import { bodyDermis, neckTone, BODY_DERMIS } from './dermal-body.js';
import { layoutDermis, paintDermis } from './dermal-texture.js';
import { encodePngRgba } from '../landscape/surface-textures.js';

/**
 * The hero's DERMIS spec (the door's `skin`, layered.js): the cast's preset with the body's own over it (BODY_DERMIS),
 * `palette.Skin` its tone when `skin.tone` is not given, then `skin`. → { spec, base } (`base` the skin's flat colour,
 * dermal-map.js `skinBase`: the palette's Skin on the realistic recipe). Throws a dermis refusal (dermal-map.js).
 */
export function heroDermisSpec(hero) {
  const sex = hero.cast === 'female' ? 'female' : 'male', skin = hero.skin ?? {};
  const spec = { from: sex, ...BODY_DERMIS[sex], ...(hero.palette?.Skin && skin.tone === undefined ? { tone: hero.palette.Skin.toLowerCase() } : {}), ...skin };
  return { spec, base: skinBase(readDermis(spec)) };
}

/** the relational head's parts on the hero */
const HEAD = /^(cranium|jaw|visage|nose|eye[RL]|ear[RL])$/;
/** the body's skin parts (dermal-body.js charts them) */
const BODY = /^(torso|neck|pelvis|upperArm[RL]|foreArm[RL]|hand[RL]|thumb[RL]|index[RL]|middle[RL]|ring[RL]|little[RL]|thigh[RL]|shank[RL]|foot[RL]|toes[RL])$/;
/** a head point this far inside its field (m) is let down under another part's skin */
const HIDDEN = 0.0003;

/** The realistic hero's skin: its pages and each face's page and UVs (see the head of this file). */
export function heroDermis(mesh, recipe, { sex = recipe.headFit?.sex ?? 'male', dermis = null, page = 2048, headPage = 1024 } = {}) {
  const D = dermis && Object.isFrozen(dermis) && 'seed' in dermis ? dermis : readDermis(dermis || { from: sex, ...BODY_DERMIS[sex] });
  const partOf = (vi) => mesh.provenance[vi].part, groupOf = (fi) => mesh.groups[fi];
  const head = recipe.headFit ? headSkin(mesh, recipe, D, headPage) : null;
  // the body's islands only where its skin shows: a part painted another group (the suit's Top, the feet's Shoes) or a
  // point under what it wears takes no texel
  const covered = coveredSkin(mesh, recipe), shown = (vi) => recipe.parts[partOf(vi)]?.group === 'Skin' && !covered?.[vi];
  const body = bodyDermis(mesh, recipe, { dermis: D, sex, page, ...(head ? { neck: neckTone(head.chart, D) } : {}), shown });
  const faceOf = (fi) => {
    if (groupOf(fi) !== 'Skin') return null;
    const tri = mesh.faces[fi], part = partOf(tri[0]);
    if (head && HEAD.test(part)) { const l = head.local.get(fi); return l === undefined || !head.skinFace[l] ? null : { page: 'head', uv: head.maps.faceUV(l) }; }
    // (a face off the body's islands, under a garment or an armour, keeps the base colour: no texel)
    if (BODY.test(part)) return tri.every((v) => body.chart.where[v]) ? { page: 'body', uv: body.maps.faceUV(fi) } : null;
    return null;
  };
  return { pages: { body: body.maps, ...(head ? { head: head.maps } : {}) }, faceOf, dermis: D, covered };
}

/**
 * The body's skin COVERED by what it wears (→ a flag per mesh vertex, or null when it wears nothing): a skin point is
 * covered when a ray out along its normal meets, within `reach` (m), a face of a garment or an armour (a part neither
 * the body's nor the head's, not Skin) carried by the point's own bone or one within two joints of it (the flank under
 * the arm is covered by the sleeve), so a hand at the thigh is not covered by the trousers. The covering faces in a grid of `cell`; pure geometry.
 */
export function coveredSkin(mesh, recipe, { reach = 0.08, cell = 0.03 } = {}) {
  const V = mesh.vertices, F = mesh.faces, partOf = (vi) => mesh.provenance[vi].part, boneOf = (part) => recipe.parts[part]?.bind?.bone;
  const cover = []; F.forEach((t, fi) => { const p = partOf(t[0]); if (!HEAD.test(p) && !BODY.test(p) && mesh.groups[fi] !== 'Skin') cover.push(fi); });
  if (!cover.length) return null;
  // the bones beside each bone: those sharing a joint (a head or a tail)
  const bones = recipe.rig?.bones || [], ends = new Map(bones.map((b) => [b.id, [b.head, b.tail].filter(Boolean)])), beside = new Map();
  const touch = new Map(bones.map((a) => [a.id, bones.filter((b) => b.id === a.id || ends.get(b.id).some((j) => ends.get(a.id).includes(j))).map((b) => b.id)]));
  for (const a of bones) beside.set(a.id, new Set(touch.get(a.id).flatMap((b) => touch.get(b))));
  const key = (x, y, z) => `${x},${y},${z}`, grid = new Map(), ci = (v) => Math.floor(v / cell);
  for (const fi of cover) {
    const [a, b, c] = F[fi].map((v) => V[v]), lo = [0, 1, 2].map((k) => ci(Math.min(a[k], b[k], c[k]))), hi = [0, 1, 2].map((k) => ci(Math.max(a[k], b[k], c[k])));
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) { const k = key(x, y, z); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(fi); }
  }
  const coverBone = new Map(cover.map((fi) => [fi, boneOf(partOf(F[fi][0]))]));
  const normals = vertexNormals(V, F), out = new Uint8Array(V.length), seen = new Int32Array(F.length).fill(-1);
  // (Möller–Trumbore: the distance along the ray to the triangle, or Infinity)
  const hit = (o, d, fi) => {
    const [a, b, c] = F[fi].map((v) => V[v]), e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
    if (Math.abs(det) < 1e-12) return Infinity;
    const s = [o[0] - a[0], o[1] - a[1], o[2] - a[2]], u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) / det; if (u < 0 || u > 1) return Infinity;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], w = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) / det; if (w < 0 || u + w > 1) return Infinity;
    const t = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) / det; return t > 0 ? t : Infinity;
  };
  for (let vi = 0; vi < V.length; vi++) {
    const part = partOf(vi); if (!BODY.test(part)) continue;
    const near = beside.get(boneOf(part)) ?? new Set([boneOf(part)]), n = normals[vi], o = V[vi];
    let found = false;
    for (let t = 0; t <= reach && !found; t += cell / 2) {
      const l = grid.get(key(ci(o[0] + n[0] * t), ci(o[1] + n[1] * t), ci(o[2] + n[2] * t))); if (!l) continue;
      for (const fi of l) { if (seen[fi] === vi) continue; seen[fi] = vi; if (near.has(coverBone.get(fi)) && hit(o, n, fi) <= reach) { found = true; break; } }
    }
    if (found) out[vi] = 1;
  }
  return out;
}

/** the minted head read back into its own frame (`recipe.headFit`): its field with the ears (`H`) and without (`plain`),
 * `stand` a hero point in the head's frame, and `shown(v)`: a head point on its surface (an ear on the ear's), not let
 * down inside it under another part */
function headFrame(mesh, recipe) {
  const { sex, k, ty, men, relations, eyes } = recipe.headFit, own = { ...(relations ? { relations } : {}), ...(eyes ? { eyes } : {}) };
  const H = relationalHead({ sex, tune: HEAD_TUNES[sex], ...own });
  const plain = relationalHead({ sex, tune: HEAD_TUNES[sex], ears: false, ...own });
  const stand = (p) => ({ x: p[0] / k, y: (p[1] - ty) / k, z: (p[2] - men) / k });
  const shown = (v) => (/^ear/.test(mesh.provenance[v].part) ? H : plain).field(stand(mesh.vertices[v])) * k >= -HIDDEN;
  return { H, plain, stand, k, shown };
}

/**
 * The realistic hero's HIDDEN points (→ a flag per mesh vertex, null without a head's fit): the head's layers let down
 * under another of its parts (the cranium under the face, the face under the nose and the eyes, a lid's rings into the
 * eye's opening), and the eye's globe. What the bake's occlusion leaves out of its casters (polygonizer/surface-bake.js `hidden`), as the
 * skin's own occlusion does.
 */
export function heroHidden(mesh, recipe) {
  if (!recipe.headFit) return null;
  const { shown } = headFrame(mesh, recipe), out = new Uint8Array(mesh.vertices.length);
  for (let v = 0; v < out.length; v++) if (HEAD.test(mesh.provenance[v].part) && !shown(v)) out[v] = 1;
  // (and the eye's globe: lit and wet, it darkens no lid; the socket's shadow is cast by the brow and the lids)
  mesh.faces.forEach((t, fi) => { if (GLOBE.test(mesh.groups[fi])) for (const v of t) out[v] = 1; });
  return out;
}
/** the eye's globe's groups */
export const GLOBE = /^(Sclera|Iris|Pupil)$/;

/** the grid head's chart, layout and maps, its faces indexed locally (`local`: mesh face → chart face) */
function headSkin(mesh, recipe, D, page) {
  const { H, stand, k, shown: shownAt } = headFrame(mesh, recipe);
  // the head's faces and their points, in the head's frame (metres)
  const local = new Map(), vOf = new Map(), vertices = [], faces = [], src = [];
  mesh.faces.forEach((tri, fi) => {
    if (!HEAD.test(mesh.provenance[tri[0]].part)) return;
    local.set(fi, faces.length);
    faces.push(tri.map((v) => { let i = vOf.get(v); if (i === undefined) { i = vertices.length; vOf.set(v, i); const s = stand(mesh.vertices[v]); vertices.push([s.x * STAND_M, s.y * STAND_M, s.z * STAND_M]); src.push(v); } return i; }));
  });
  // the field's normals the recipe carries (each part's stations' `normals`); a cap's point the mesh's own
  const normals = vertexNormals(vertices, faces), byPart = new Map();
  src.forEach((v, i) => {
    const id = mesh.pointIds[v], part = mesh.provenance[v].part, rest = id.slice(part.length + 1), d = rest.lastIndexOf('.'); if (d < 0) return;
    let m = byPart.get(part); if (!m) { m = new Map((recipe.parts[part]?.stations || []).map((st) => [st.id, st.normals])); byPart.set(part, m); }
    const n = m.get(rest.slice(0, d))?.[rest.slice(d + 1)]; if (n) normals[i] = n;
  });
  // skin: every point but a globe's (a layer let down under another is skin too: unseen, its texels cost nothing, and
  // where two cross the one on top is a little inside the field); SHOWN: on the head's surface (an ear on the ear's), not
  // let down inside it, so the layers under the face neither cast occlusion on it nor take any
  const skin = src.map((v) => !H.paint?.(stand(mesh.vertices[v])));
  const shown = src.map(shownAt);
  const chart = headChartOf(H, { vertices, faces, normals }, (vi) => skin[vi], undefined, { shownAt: (vi) => shown[vi] });
  const skinFace = faces.map((t) => t.every((vi) => skin[vi]));
  const layout = layoutDermis(chart, { page }), maps = paintDermis(chart, D, layout);
  return { chart, layout, maps, local, skinFace };
}

/**
 * The hero's skin as a figure's PAINT (packLayeredRig `paint`; the GLB writes its atlas as the figure's base colour
 * texture, each corner's texel times its colour): the body's page on top, the head's under it at the left, one image; a
 * skin face's corners on their page's place in it, every other corner on the body's white texel (its colour as before).
 * `painted(fi)` names the face being packed, so `uvAt({ vi })` is that face's own corner (a seam's two sides apart).
 */
export function heroSkinPaint(mesh, recipe, opts = {}) {
  const H = heroDermis(mesh, recipe, opts), B = H.pages.body, Hd = H.pages.head ?? null;
  const W = B.page, BH = B.pageH ?? B.page, HW = Hd ? Hd.page : 0, HH = Hd ? Hd.pageH ?? Hd.page : 0, TH = BH + HH;
  const px = new Uint8Array(W * TH * 4).fill(255);
  px.set(B.albedo.subarray(0, W * BH * 4), 0);
  if (Hd) for (let y = 0; y < HH; y++) px.set(Hd.albedo.subarray(y * HW * 4, (y + 1) * HW * 4), ((BH + y) * W) * 4);
  // (a page's [s, t], t up, onto the atlas's)
  const onBody = ([s, t]) => [s, 1 - ((1 - t) * BH) / TH], onHead = ([s, t]) => [(s * HW) / W, 1 - (BH + (1 - t) * HH) / TH];
  const white = onBody(B.faceUV(-1)?.[0] ?? [0.001, 0.999]), fis = new Map();
  mesh.faces.forEach((tri, fi) => { const f = H.faceOf(fi); if (f) fis.set(fi, f.uv.map(f.page === 'head' ? onHead : onBody)); });
  let face = -1;
  const url = `data:image/png;base64,${encodePngRgba(Buffer.from(px.buffer, px.byteOffset, px.byteLength), W, TH).toString('base64')}`;
  const uvAt = (ref) => { const c = fis.get(face); if (!c || ref.vi === undefined) return white; const k = mesh.faces[face].indexOf(ref.vi); return k < 0 ? white : c[k]; };
  return { key: 'heroSkin', url, painted: (fi) => { if (fis.has(fi)) { face = fi; return true; } return false; }, uvAt,
    atlas: { url, w: W, h: TH }, baseUV: (t) => t, white, regionOf: new Map(), regions: [], hidden: [0, 0, 0], targets: 0 };
}
