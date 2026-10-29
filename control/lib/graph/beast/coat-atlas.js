/**
 * THE COAT AS AN ATLAS: a beast-kin's pattern (./pattern.js) painted in colour into one texture over its coat, at texel
 * density, so a stripe or a spot is as fine as it is drawn and never the rings' (a thigh has six, a neck three). The hide
 * atlas's layout (polygonizer/skin-paint.js: every covered part its own rectangle, as wide as its ring and as long as the
 * part, the UV of a vertex read off its id) and the realistic skin's colour (epidermis/dermal-hero.js heroSkinPaint: the
 * texel carries the albedo, the face's own light divided by the coat's colour lights it, so it is never tinted twice).
 * Its interface is theirs, so the World page draws it and the skinned GLB carries it as they do.
 *
 * Each texel is a point on the REST surface (its part's rings, bilinear between two stations and two slots), read in the
 * biped's anatomy: its region, its dorsality and angle round from the back, its height on the trunk, its distance down
 * its limb or its tail (./pattern.js says what each layer makes of them).
 *
 *   beastCoatPaint(mesh, recipe, hero)  → the paint ({ key, url, painted(fi), uvAt(ref), light(fill), atlas, baseUV,
 *                                         white, … }), or null when the beast wears no pattern
 * Pure, deterministic.
 */
import { beastCard } from './tiered.js';
import { beastCoatOf } from './cover.js';
import { patternField } from './pattern.js';
import { encodePngRgba, encodePng } from '../landscape/surface-textures.js';
import { coverTile } from './cover.js';
import { meshTangents, axisTangent } from '../polygonizer/normal-bake.js';

/** texels a metre at a 1.8 m figure, the atlas's width and its tallest, the gutter and the white tile */
export const COAT_PPM = 240;
const ATLAS_W = 1024, ATLAS_MAX_H = 2048, PAD = 2, WHITE = 8;

const ARM = /^(shoulderBall|shoulderCone|shoulderWeb|upperArm|elbowBridge|foreArm|wristBridge|hand|thumb|index|middle|ring|little)2?[RL]?$/;
const LEG = /^(thigh|kneeBridge|shank|hockBridge|meta|foot|paw|toes|hallux|toe\d)[RL]?$/;
const regionOf = (name) => (/^(torso|pelvis|nape|pectoral[RL]?)$/.test(name) ? 'trunk' : /^(neck|ruff\d+[RL]?)$/.test(name) ? 'neck' : ARM.test(name) ? 'arm' : LEG.test(name) ? 'leg' : /^(tail|tailSocket)$/.test(name) ? 'tail' : name === 'coil' ? 'coil' : 'other');
const sideOf = (name) => (/L$/.test(name) ? 'L' : 'R');

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const lerp = (a, b, t) => add(a, mul(sub(b, a), t)), dist = (a, b) => Math.hypot(...sub(a, b)), unit = (a) => { const l = Math.hypot(...a) || 1; return mul(a, 1 / l); };
const cen = (pts) => { const v = Object.values(pts); return [0, 1, 2].map((k) => v.reduce((t, p) => t + p[k], 0) / v.length); };
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4), srgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const hex3 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const toHex = (c) => `#${c.map((x) => Math.round(Math.max(0, Math.min(1, x)) * 255).toString(16).padStart(2, '0')).join('')}`;
function fnvBytes(b) { let h = 0x811c9dc5; for (let i = 0; i < b.length; i += 7) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }

export function beastCoatPaint(mesh, recipe, hero) {
  const card = beastCard(hero), layers = hero?.beast?.pattern;
  if (!card || !Array.isArray(layers) || !layers.length) return null;
  const coatGroups = beastCoatOf(hero), coatHex = recipe.palette?.[card.coat?.[0] ?? 'Skin'] ?? recipe.palette?.Skin ?? '#8a7a6a';
  // the parts the coat covers: a part with rings whose faces are of the coat (not a garment's, not the head's own groups)
  const coatParts = new Set();
  mesh.faces.forEach((tri, fi) => { if (coatGroups.has(mesh.groups[fi])) coatParts.add(mesh.provenance[tri[0]].part); });
  const zs = mesh.vertices.map((v) => v[2]), k = (Math.max(...zs) - Math.min(...zs)) / 1.8 || 1;
  const field = patternField(layers, { coat: coatHex, k });
  // each part's frame: its stations' centroids, their distance down the part, its girth
  const frames = new Map();
  for (const name of coatParts) {
    const P = mesh.parts[name]; if (!P?.stations?.length || P.stations.length < 2 || !P.slots?.length || P.garment || regionOf(name) === 'other') continue;
    if (!P.stations.every((st) => P.slots.every((sl) => st.points[sl]))) continue;
    const C = P.stations.map((st) => cen(Object.fromEntries(P.slots.map((sl) => [sl, st.points[sl]]))));
    const along = [0]; for (let i = 1; i < C.length; i++) along.push(along[i - 1] + dist(C[i], C[i - 1]));
    const girth = P.stations.map((st) => P.slots.reduce((g, sl, j) => g + dist(st.points[sl], st.points[P.slots[(j + 1) % P.slots.length]]), 0));
    frames.set(name, { P, C, along, girth, index: new Map(P.stations.map((st, i) => [st.id, i])), region: regionOf(name), side: sideOf(name) });
  }
  if (!frames.size) return null;
  // the body's measures: each limb's root (its first part's first ring) and reach, the trunk's height, the tail's length
  const firstRing = (name) => frames.get(name)?.C[0];
  const roots = { armR: firstRing('upperArmR'), armL: firstRing('upperArmL'), legR: firstRing('thighR'), legL: firstRing('thighL') };
  const reach = {};
  for (const F of frames.values()) if (F.region === 'arm' || F.region === 'leg') {
    const key = `${F.region}${F.side}`, r = roots[key]; if (!r) continue;
    for (const st of F.P.stations) for (const sl of F.P.slots) reach[key] = Math.max(reach[key] ?? 0, dist(st.points[sl], r));
  }
  const trunkZ = [...frames.values()].filter((F) => F.region === 'trunk').flatMap((F) => F.C.map((c) => c[2]));
  const z0 = Math.min(...trunkZ), z1 = Math.max(...trunkZ), tailLen = frames.get('tail')?.along.at(-1) ?? 1, coilLen = frames.get('coil')?.along.at(-1) ?? 1;
  // a point on a part's surface (station i + t, slot j + f) and the anatomy it is read in
  const sampleAt = (F, u, v) => {
    const { P, along } = F, L = along.at(-1) || 1, s = u * L, n = P.slots.length;
    let i = 0; while (i < along.length - 2 && s > along[i + 1]) i++;
    const t = Math.min(1, Math.max(0, (s - along[i]) / ((along[i + 1] - along[i]) || 1))), a = (v % 1) * n, j = Math.floor(a) % n, f = a - Math.floor(a), j2 = (j + 1) % n;
    const S0 = P.stations[i].points, S1 = P.stations[i + 1].points, sl = P.slots;
    const p = lerp(lerp(S0[sl[j]], S0[sl[j2]], f), lerp(S1[sl[j]], S1[sl[j2]], f), t), c = lerp(F.C[i], F.C[i + 1], t), nr = unit(sub(p, c));
    let D, theta = 0, chain = 0;
    if (F.region === 'trunk' || F.region === 'neck') { const h = Math.hypot(nr[0], nr[1]) || 1; D = -nr[1] / h; theta = Math.acos(Math.max(-1, Math.min(1, D))) / Math.PI; }
    else if (F.region === 'arm' || F.region === 'leg') {
      D = Math.max(-1, Math.min(1, 0.9 * Math.sign(p[0] || 1) * nr[0] + 0.15 * -nr[1]));
      const key = `${F.region}${F.side}`; chain = roots[key] && reach[key] ? Math.min(1, dist(p, roots[key]) / reach[key]) : 0;
      // (its distance in metres from the limb's root, not down the part: a band runs on across the knee and the elbow)
      return { region: F.region, D, theta, z: p[2], zt: (p[2] - z0) / ((z1 - z0) || 1), chain, s: roots[key] ? dist(p, roots[key]) : s, p };
    } else { D = nr[2]; chain = F.region === 'tail' ? (F.P === frames.get('tail')?.P ? s / tailLen : 0) : s / coilLen; }
    return { region: F.region, D, theta, z: p[2], zt: (p[2] - z0) / ((z1 - z0) || 1), chain, s, p };
  };
  // the RECTANGLES, packed in shelves, tallest first; scaled down together when the atlas would grow past its bound
  const rects = [...frames.entries()].map(([name, F]) => { const extra = 1 / F.P.slots.length;
    return { name, F, extra, w: Math.max(4, Math.ceil(Math.max(...F.girth) * (COAT_PPM / k) * (1 + extra))), h: Math.max(4, Math.ceil(F.along.at(-1) * (COAT_PPM / k))) }; });
  rects.sort((x, y) => y.h - x.h || (x.name < y.name ? -1 : 1));
  let scale = 1, H = 0;
  const pack = (sc) => { let x = WHITE + PAD, y = 0, shelf = 0;
    for (const r of rects) { r.W = Math.max(4, Math.min(ATLAS_W - PAD, Math.ceil(r.w * sc))); r.Hh = Math.max(4, Math.ceil(r.h * sc)); if (x + r.W + PAD > ATLAS_W) { x = 0; y += shelf + PAD; shelf = 0; } r.x = x; r.y = y; x += r.W + PAD; shelf = Math.max(shelf, r.Hh); }
    return y + shelf + PAD; };
  for (let it = 0; it < 14; it++) { H = pack(scale); if (H <= ATLAS_MAX_H) break; scale *= 0.85; }
  H = 1 << Math.ceil(Math.log2(Math.max(WHITE + PAD, H)));
  // PAINT: the coat's colour, the pattern over it texel by texel; white at the corner tile
  const px = new Uint8Array(ATLAS_W * H * 4).fill(255), coatC = hex3(coatHex).map((x) => Math.round(x * 255));
  const put = (x, y, c) => { const o = (y * ATLAS_W + x) * 4; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255; };
  for (const r of rects) for (let py = 0; py < r.Hh; py++) for (let qx = 0; qx < r.W; qx++) {
    const v = (qx + 0.5) / r.W * (1 + r.extra), u = (py + 0.5) / r.Hh, c = field(sampleAt(r.F, u, v));
    put(r.x + qx, r.y + py, c ? hex3(c).map((x) => Math.round(x * 255)) : coatC);
  }
  const url = `data:image/png;base64,${encodePngRgba(Buffer.from(px.buffer, px.byteOffset, px.byteLength), ATLAS_W, H).toString('base64')}`;
  const key = `beastCoat-${fnvBytes(px)}-${ATLAS_W}x${H}`;
  // UV per vertex on its part's rectangle (a ring point: `part/st3.frontR`; a cap's apex is not painted)
  const byName = new Map(rects.map((r) => [r.name, r])), uv = new Map();
  const toUv = (r, v, u) => [(r.x + v / (1 + r.extra) * r.W) / ATLAS_W, 1 - (r.y + u * r.Hh) / H];
  mesh.vertices.forEach((_, vi) => {
    const id = mesh.pointIds?.[vi]; if (!id) return;
    const slash = id.indexOf('/'), r = byName.get(id.slice(0, slash)); if (!r) return;
    const local = id.slice(slash + 1), dot = local.indexOf('.'); if (dot < 0) return;
    const si = r.F.index.get(local.slice(0, dot)), sk = r.F.P.slots.indexOf(local.slice(dot + 1));
    if (si === undefined || sk < 0) return;
    uv.set(vi, { r, u: r.F.along[si] / (r.F.along.at(-1) || 1), v: sk / r.F.P.slots.length });
  });
  // a face is painted when it is of the coat and its corners lie on one part (a face across the ring's seam takes its
  // low corners a turn on: the rectangle's extra step); a second skin's cloth is not the coat
  const fis = new Map();
  mesh.faces.forEach((tri, fi) => {
    if (!coatGroups.has(mesh.groups[fi])) return;
    const c = tri.map((vi) => uv.get(vi)); if (c.some((x) => !x) || c.some((x) => x.r !== c[0].r)) return;
    const own = mesh.parts[c[0].r.name]; if (Array.isArray(own?.painted) && own.painted.includes(mesh.groups[fi])) return;
    const vs = c.map((x) => x.v), wrap = Math.max(...vs) - Math.min(...vs) > 0.5;
    fis.set(fi, tri.map((_, j) => toUv(c[j].r, wrap && c[j].v < 0.5 ? c[j].v + 1 : c[j].v, c[j].u)));
  });
  if (!fis.size) return null;
  const white = [(WHITE / 2) / ATLAS_W, 1 - (WHITE / 2) / H];
  let face = -1;
  const uvAt = (ref) => { const c = fis.get(face); if (!c) return white; const at = (vi) => { const j = mesh.faces[face].indexOf(vi); return j < 0 ? null : c[j]; };
    if (ref.vi !== undefined) return at(ref.vi) ?? white;
    if (ref.bary) return ref.bary.reduce((s, [vi, w]) => { const t = at(vi) ?? white; return [s[0] + t[0] * w, s[1] + t[1] * w]; }, [0, 0]);
    if (ref.mix) { const m = ref.mix.map(uvAt); return [m.reduce((s, t) => s + t[0], 0) / m.length, m.reduce((s, t) => s + t[1], 0) / m.length]; }
    const A = at(ref.a) ?? white, B = at(ref.b) ?? white; return [A[0] + (B[0] - A[0]) * ref.s, A[1] + (B[1] - A[1]) * ref.s]; };
  // (a painted face's LIGHT: its lit fill over the coat's flat colour, so the texel, which carries the coat's colour and its
  // pattern, is lit and never tinted twice)
  const base = hex3(coatHex).map(lin), lights = new Map();
  const light = (fill) => { let h = lights.get(fill); if (!h) lights.set(fill, h = toHex(hex3(fill).map((x, i) => srgb(Math.min(1, lin(x) / Math.max(1e-6, base[i])))))); return h; };
  return { key, url, painted: (fi) => { if (fis.has(fi)) { face = fi; return true; } return false; }, uvAt, light,
    atlas: { url, w: ATLAS_W, h: H }, baseUV: (t) => t, white, regionOf: new Map(), regions: [], hidden: [0, 0, 0], targets: 0,
    faceUV: (fi) => fis.get(fi) ?? null, layout: { rects, W: ATLAS_W, H }, stats: { parts: rects.length, faces: fis.size, of: mesh.faces.length, scale } };
}

/** the relief map's texels against the colour atlas's (its own map, finer: a fur's strands are millimetres) */
export const COAT_RELIEF_SCALE = 2;
const FLAT = [128, 128, 255];

/**
 * THE COVER'S RELIEF ON THE COAT'S ATLAS: the cover tile's normals (./cover.js coverTile: fur, scales, chitin, feathers and
 * their qualities) laid into each part's rectangle in metres (round the ring by its own girth there, down the part by
 * its length), box-filtered to the map's texel so no strand aliases; each painted corner its tangent on the atlas's UVs,
 * the MikkTSpace way, as the cover's tiling map had them. The pack carries it as the realistic skin's relief
 * (station-loft-rig.js `relief`: `normalTex` on the paint's UVs). → { tangentAt, atlas, stats } or null.
 */
export function coatRelief(mesh, paint, cover, normals) {
  if (!paint?.layout || !paint.faceUV || !cover?.kind || !normals) return null;
  const { kind, ...style } = cover, T = coverTile(kind, style), size = T.maps.size, TW = T.W, { rects, W: AW, H: AH } = paint.layout;
  const W = AW * COAT_RELIEF_SCALE, H = AH * COAT_RELIEF_SCALE, rgb = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) rgb.set(FLAT, i * 3);
  // the tile box-filtered to `n` texels across (a texel of the map), wrapping
  const filtered = new Map();
  const tileAt = (n) => { if (filtered.has(n)) return filtered.get(n);
    const out = new Float32Array(n * n * 3), f = TW / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let a = 0, b = 0, c = 0, m = 0;
      for (let yy = Math.floor(y * f); yy < Math.max(Math.floor(y * f) + 1, Math.floor((y + 1) * f)); yy++) for (let xx = Math.floor(x * f); xx < Math.max(Math.floor(x * f) + 1, Math.floor((x + 1) * f)); xx++) {
        const o = ((yy % TW) * TW + (xx % TW)) * 3; a += T.normal[o] / 127.5 - 1; b += T.normal[o + 1] / 127.5 - 1; c += T.normal[o + 2] / 127.5 - 1; m++; }
      const l = Math.hypot(a, b, c) || 1; out.set([a / l, b / l, c / l], (y * n + x) * 3); }
    filtered.set(n, out); return out; };
  for (const r of rects) {
    const F = r.F, L = F.along.at(-1) || 1, x0 = r.x * COAT_RELIEF_SCALE, y0 = r.y * COAT_RELIEF_SCALE, w = r.W * COAT_RELIEF_SCALE, h = r.Hh * COAT_RELIEF_SCALE;
    // (the map's texel in metres down the part sets the filtered tile's size)
    const n = Math.max(2, Math.min(TW, Math.round(size / (L / h)))), tile = tileAt(n);
    for (let py = 0; py < h; py++) {
      const u = (py + 0.5) / h, s = u * L; let i = 0; while (i < F.along.length - 2 && s > F.along[i + 1]) i++;
      const t = Math.min(1, Math.max(0, (s - F.along[i]) / ((F.along[i + 1] - F.along[i]) || 1))), girth = F.girth[i] + (F.girth[i + 1] - F.girth[i]) * t;
      for (let px = 0; px < w; px++) {
        const v = (px + 0.5) / w * (1 + r.extra), ax = ((v * girth) / size) * n, ay = (s / size) * n;
        const o = ((((Math.floor(ay) % n) + n) % n) * n + (((Math.floor(ax) % n) + n) % n)) * 3;
        rgb.set([Math.round((tile[o] + 1) * 127.5), Math.round((tile[o + 1] + 1) * 127.5), Math.round((tile[o + 2] + 1) * 127.5)], ((y0 + py) * W + x0 + px) * 3);
      }
    }
  }
  // the tangents on the atlas's UVs: each painted corner one vertex of a light mesh (its point, its place, its normal)
  const key = new Map(), V = [], N = [], uv = [], Fs = [], cornerV = new Map();
  mesh.faces.forEach((tri, fi) => {
    const st = paint.faceUV(fi); if (!st) return;
    cornerV.set(fi, Fs.push(tri.map((vi, k) => { const nn = normals[fi][k], kk = `${vi}|${st[k][0]}|${st[k][1]}|${nn.join(',')}`;
      let q = key.get(kk); if (q === undefined) { q = V.length; key.set(kk, q); V.push(mesh.vertices[vi]); N.push(unit(nn)); uv.push([st[k][0], st[k][1]]); } return q; })) - 1);
  });
  if (!Fs.length) return null;
  const Tn = meshTangents(V, Fs, uv, N);
  const png = encodePng(Buffer.from(rgb.buffer, rgb.byteOffset, rgb.byteLength), W, H);
  return {
    tangentAt: (fi, k) => { const f = cornerV.get(fi); return f !== undefined ? Tn[Fs[f][k]] : axisTangent(unit(normals[fi][k])); },
    atlas: { url: `data:image/png;base64,${png.toString('base64')}`, w: W, h: H },
    stats: { width: W, height: H, faces: Fs.length, bytes: png.length },
  };
}
