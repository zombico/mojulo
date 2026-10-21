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
import { readDermis } from './dermal-map.js';
import { vertexNormals } from './dermal-chart.js';
import { headChartOf, STAND_M } from './dermal-head.js';
import { bodyDermis, neckTone, BODY_DERMIS } from './dermal-body.js';
import { layoutDermis, paintDermis } from './dermal-texture.js';
import { encodePngRgba } from '../landscape/surface-textures.js';

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
  const body = bodyDermis(mesh, recipe, { dermis: D, sex, page, ...(head ? { neck: neckTone(head.chart, D) } : {}) });
  const faceOf = (fi) => {
    if (groupOf(fi) !== 'Skin') return null;
    const part = partOf(mesh.faces[fi][0]);
    if (head && HEAD.test(part)) { const l = head.local.get(fi); return l === undefined || !head.skinFace[l] ? null : { page: 'head', uv: head.maps.faceUV(l) }; }
    if (BODY.test(part)) return { page: 'body', uv: body.maps.faceUV(fi) };
    return null;
  };
  return { pages: { body: body.maps, ...(head ? { head: head.maps } : {}) }, faceOf, dermis: D };
}

/** the grid head's chart, layout and maps, its faces indexed locally (`local`: mesh face → chart face) */
function headSkin(mesh, recipe, D, page) {
  const { sex, k, ty, men } = recipe.headFit, H = relationalHead({ sex, tune: HEAD_TUNES[sex] });
  const plain = relationalHead({ sex, tune: HEAD_TUNES[sex], ears: false });
  const stand = (p) => ({ x: p[0] / k, y: (p[1] - ty) / k, z: (p[2] - men) / k });
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
  const shown = src.map((v) => { const q = stand(mesh.vertices[v]), ear = /^ear/.test(mesh.provenance[v].part); return (ear ? H : plain).field(q) * k >= -HIDDEN; });
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
