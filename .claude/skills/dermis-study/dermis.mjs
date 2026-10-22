#!/usr/bin/env node
// dermis-study — the DERMAL TEXTURIZER on the realistic register's head (head-relational.js): its skin laid out by its
// relations (control/lib/graph/epidermis/dermal-head.js, dermal-map.js), baked to an atlas (dermal-texture.js) and
// sampled back through the face UVs as an engine would, lit with the skin's cheats (a wrap that reddens the terminator by
// the translucency map, the sheen by the roughness map, the vellus's rim by the fuzz map), wearing the epidermis cube's
// brows and lashes (epidermis.js), the beard's stubble and the scalp's clumps (dermal-hair.js), drawn with a hair
// shader's shifted dual highlight. Run, then Read the sheet.
//
//   node .claude/skills/dermis-study/dermis.mjs [male] [female] [--dermis '{…}'] [--scalp '{…}'|word]
//                                               [--epidermis '{…}'|preset] [--cells N] [--page N] [--out dir]
//
//   male / female   which poles (default both).
//   --dermis        the dermis's dials over the pole's preset (dermal-map.js DERMIS_DIALS): '{"tone":8,"stubble":4}'
//   --scalp         the scalp groom (dermal-hair.js): a style word (buzz, crop, short, bob, shoulder, long) or
//                   '{"style":"shoulder","type":"coily"}'; 'none' grows no scalp hair (a bare scalp, shaven)
//   --epidermis     the cube's brows and lashes (epidermis.js): a preset or '{"hair":{"brows":{"shape":"thick"}}}'
//   --ancestry      people of the egocube's ancestries, rolled in their ranges: id[:sex[:seed]], comma-separated
//                   (african, european, east-asian, south-asian …; dermal-looks.js readAncestry); --game carves the
//                   creator's face over them
//   --lineup        the subjects side by side at the front and the front ¾ (no atlases; --lineup-all adds the lateral and
//                   the back, two subjects to a row); --lineup-crop eyes frames
//                   the eyes close (eye: the right eye alone; face: the face, brow to chin) (an ancestry's subject may name its eyes: id:sex:seed:monolid | inner-fold | parallel | hooded)
//   --faces         subjects of their own: '[{"label":"…","sex":"female","relations":{…},"eyes":{…},"ancestry"?,"seed"?,"epidermis"?,"dermis"?,"scalp"?,"tune"?,"light"?}]'
//                   (`light`: { key, fill, rim: hexes, exposure }, an art direction's, color-theorist/adapters.js skinDirection)
//                   (the head's relations replaced as given, the wave's tune solved for them; an ancestry rolls the
//                   tone and the hair as --ancestry does, at the seed): a spike's sets side by side
//   --look          creator looks (dermal-looks.js LOOKS: warrior, shieldmaiden, scholar, rogue, elder), comma-separated:
//                   the game face's relations, the dermis, the groom and the brows as the look sets them (the flags over it)
//   --body          the REALISTIC BODY (docs/realistic-body.md) in its dermis (epidermis/dermal-body.js) instead of the head
//                   rows: the relational head grafted on it with its own atlas and hair; rows of the body textured and lit,
//                   the map's kinds, the body-part map (polygonizer/body-relational-map.js) on the skin, the channels on the shape, the neck where the head meets it; then the body's atlas pages.
//                   --physique a word or JSON (the door's), --body-page the atlas's width (default 2048)
//   --cells         the head's surface net (default 110)
//   --page          the atlas's page in texels (default 1024)
//   --out           output dir (default /tmp/dermis-study): sheet.png, sheet.svg, atlas-*.png, report.json
//
// Rows per pole: the head textured and lit with its hair (front, front ¾, lateral, back); the same bare (the skin and the
// brows and lashes alone: the atlas's reading); the map's kinds with the scalp's guides; the eyes and the mouth close;
// then the atlas's pages (albedo, roughness, translucency, hair density and flow) and the relief tiles.
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire, register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const CONTROL = path.join(REPO, 'control');
register(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
process.chdir(CONTROL);
const sharp = createRequire(path.join(CONTROL, 'package.json'))('sharp');
const { relationalHead } = await import('@/lib/graph/polygonizer/head-relational.js');
const { relationalHeadChart, STAND_M } = await import('@/lib/graph/epidermis/dermal-head.js');
const { readDermis, dermisAt, hexLin, toSrgb } = await import('@/lib/graph/epidermis/dermal-map.js');
const { layoutDermis, paintDermis, dermalPngs, reliefTile } = await import('@/lib/graph/epidermis/dermal-texture.js');
const { growBodyHair, growScalp, readScalp, hairShade } = await import('@/lib/graph/epidermis/dermal-hair.js');
const { readEpidermis, growEpidermis } = await import('@/lib/graph/epidermis/epidermis.js');
const { readLook, LOOKS, readAncestry } = await import('@/lib/graph/epidermis/dermal-looks.js');
const { bodyDermis, neckTone, BODY_DERMIS } = await import('@/lib/graph/epidermis/dermal-body.js');
const { PART_COLOURS } = await import('@/lib/graph/polygonizer/body-relational-map.js');

// ─── arguments ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let out = '/tmp/dermis-study', body = false, physiqueSpec = null, bodyPage = 2048, dermisSpec = {}, scalpSpec = null, epiSpec = null, cells = 110, page = 1024, looks = [], ancestries = [], faces = [], lineup = false, game = false, lineupCrop = null, lineupAll = false;
const sexes = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--dermis') { dermisSpec = JSON.parse(args[++i]); continue; }
  if (a === '--scalp') { const v = args[++i]; scalpSpec = v.trim().startsWith('{') ? JSON.parse(v) : v; continue; }
  if (a === '--epidermis') { const v = args[++i]; epiSpec = v.trim().startsWith('{') ? JSON.parse(v) : v; continue; }
  if (a === '--cells') { cells = Number(args[++i]); continue; }
  if (a === '--look') { looks.push(...args[++i].split(',')); continue; }
  if (a === '--faces') { faces.push(...JSON.parse(args[++i])); continue; }
  if (a === '--ancestry') { ancestries.push(...args[++i].split(',')); continue; }
  if (a === '--lineup') { lineup = true; continue; }
  if (a === '--lineup-all') { lineup = true; lineupAll = true; continue; }
  if (a === '--lineup-crop') { lineup = true; lineupCrop = args[++i]; continue; }
  if (a === '--game') { game = true; continue; }
  if (a === '--body') { body = true; continue; }
  if (a === '--physique') { const v = args[++i]; physiqueSpec = v.trim().startsWith('{') ? JSON.parse(v) : v; continue; }
  if (a === '--body-page') { bodyPage = Number(args[++i]); continue; }
  if (a === '--page') { page = Number(args[++i]); continue; }
  if (a === '--out') { out = args[++i]; continue; }
  if (a === 'male' || a === 'female') { sexes.push(a); continue; }
  throw new Error(`dermis-study: unknown argument ${a}`);
}
if (!sexes.length && !looks.length && !ancestries.length && !faces.length) sexes.push('male', 'female');
for (const l of looks) if (!LOOKS[l]) throw new Error(`dermis-study: unknown look '${l}' (have ${Object.keys(LOOKS).join(', ')})`);
mkdirSync(out, { recursive: true });

// ─── the camera (metres, z up, +y the face) ───
const VIEWS = [{ name: 'front', az: 0, elev: 4 }, { name: 'front ¾', az: 35, elev: 8 }, { name: 'lateral', az: 90, elev: 2 }, { name: 'back', az: 180, elev: 6 }];
const BG = '#e9e7e3';
function camera(az, elev, box, W, H) {
  const a = (az * Math.PI) / 180, e = (elev * Math.PI) / 180;
  const c = [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)], r = [-Math.cos(a), Math.sin(a), 0];
  const u = [c[1] * r[2] - c[2] * r[1], c[2] * r[0] - c[0] * r[2], c[0] * r[1] - c[1] * r[0]];
  const ctr = [0, 1, 2].map((k) => (box.min[k] + box.max[k]) / 2);
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((m) => [0, 1, 2].map((k) => ((m >> k) & 1 ? box.max[k] : box.min[k]) - ctr[k]));
  const span = (v) => Math.max(...corners.map((p) => p[0] * v[0] + p[1] * v[1] + p[2] * v[2])) * 2;
  const sc = 0.94 * Math.min(W / span(r), H / span(u));
  const dot = (p, v) => (p[0] - ctr[0]) * v[0] + (p[1] - ctr[1]) * v[1] + (p[2] - ctr[2]) * v[2];
  const L = [-0.45, 0.55, 0.75], ln = Math.hypot(...L), lv = L.map((x) => x / ln);
  const light = [0, 1, 2].map((k) => r[k] * lv[0] + u[k] * lv[1] + c[k] * lv[2]);
  return { project: (p) => [W / 2 + dot(p, r) * sc, H / 2 - dot(p, u) * sc, dot(p, c)], view: c, light, pxMm: 1000 / sc };
}

// ─── the head and its skin ───
function headOf(sex, look = null, anc = null, face = null) {
  const t0 = Date.now(), Lk = face ? { ...(face.ancestry ? ((A) => ({ ...A, dermis: { ...A.dermis, ...face.dermis }, scalp: face.scalp?.style ? { ...face.scalp, seed: face.seed ?? 1 } : face.scalp && readScalp(A.scalp).part !== 'none' ? { ...A.scalp, ...face.scalp } : A.scalp }))(readAncestry({ id: face.ancestry, sex: face.sex || 'female', seed: face.seed ?? 1 })) : { dermis: { from: face.sex || 'female', ...face.dermis }, scalp: face.scalp ?? (face.sex === 'male' ? 'short' : 'shoulder'), epidermis: { hair: {} } }), sex: face.sex || 'female', relations: face.relations || {}, eyes: face.eyes || {}, rolled: null, ...(face.epidermis ? { epidermis: { hair: { ...(face.ancestry ? readAncestry({ id: face.ancestry, sex: face.sex || 'female', seed: face.seed ?? 1 }).epidermis.hair : {}), ...face.epidermis.hair } } } : {}) } : anc ? readAncestry({ ...anc, game }) : look ? readLook(look) : null;
  if (Lk) sex = Lk.sex;
  const head = relationalHead({ sex, tune: face?.tune ?? true, ...(Lk ? { relations: Lk.relations } : {}), ...(Lk?.eyes && Object.keys(Lk.eyes).length ? { eyes: Lk.eyes } : {}) }), chart = relationalHeadChart(head, { cells });
  const D = readDermis({ ...(Lk ? Lk.dermis : { from: sex }), ...dermisSpec });
  const word = scalpSpec ?? (Lk ? Lk.scalp : sex === 'female' ? 'shoulder' : 'short'), S = word === 'none' ? null : readScalp(word);
  const L = layoutDermis(chart, { page }), T = paintDermis(chart, D, L, { scalp: !!S });
  const scalp = S ? growScalp(chart, D, S, { colliders: ['head'] }) : null;
  const beard = growBodyHair(chart, D, { share: 0.5, tracts: ['beard'] });
  // the cube's brows and lashes, in the head's STAND units → metres
  const epi = growEpidermis(head, readEpidermis(epiSpec ?? (Lk ? { from: 'default', hair: Lk.epidermis.hair } : 'default')));
  const brows = epi.strands.map((s) => ({ ...s, pts: s.pts.map((p) => [p.x * STAND_M, p.y * STAND_M, p.z * STAND_M]), r: s.r * STAND_M }));
  return { sex, look, rolled: Lk?.rolled ?? null, head, chart, D, S, L, T, scalp, beard, brows, epiColour: epi.colour, ms: Date.now() - t0 };
}

// ─── the rasteriser: the atlas sampled through the face UVs, lit as skin ───
function sample(buf, [N, NH], u, v, ch = 4) {
  const x = Math.max(0, Math.min(N - 1, u * N - 0.5)), y = Math.max(0, Math.min(NH - 1, (1 - v) * NH - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(N - 1, x0 + 1), y1 = Math.min(NH - 1, y0 + 1), fx = x - x0, fy = y - y0;
  const at = (xx, yy, k) => buf[(yy * N + xx) * ch + k];
  return Array.from({ length: ch }, (_, k) => (at(x0, y0, k) * (1 - fx) + at(x1, y0, k) * fx) * (1 - fy) + (at(x0, y1, k) * (1 - fx) + at(x1, y1, k) * fx) * fy);
}
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const KIND_HUE = {};
const hueOf = (k) => (KIND_HUE[k] ??= (() => { let h = 0; for (const c of k) h = (h * 37 + c.charCodeAt(0)) % 360; const f = (n) => { const q = (n + h / 30) % 12; return 0.75 - 0.35 * Math.max(-1, Math.min(q - 3, 9 - q, 1)); }; return [f(0), f(8), f(4)]; })());
const SCLERA = hexLin('#efe8de'), IRIS = hexLin('#4a3626'), PUPIL = hexLin('#0e0b0a');
function render(H, cam, W, Hh, mode, R = null) {
  const { chart, T, head } = H, V = chart.vertices, Nv = chart.normals;
  R ||= frame(W, Hh);
  const kinds = mode === 'kinds' ? chart.samples.map((s) => (s ? dermisAt(s, H.D, { detail: false }).kind : null)) : mode === 'parts' ? chart.samples.map((s) => s?.bodyPart ?? null) : null;
  // (`H.place`: the head moved onto a body, its vertices and its normals; `H.cornerNormals`: per face corner)
  const P = H.place ? V.map(H.place) : V;
  raster(R, cam, W, Hh, P, chart.faces, (fi, tri) => H.cornerNormals?.[fi] ?? tri.map((v) => Nv[v]), (fi, tri, [w0, w1, w2], n, NL, NH, NV) => {
    if (H.hide?.(fi)) return null;
    const skin = tri.every((vi) => chart.samples[vi]);
    if (!skin) {
      if (!head) return null;
      // the globe: its paint at the point (the head's own), glossy
      const p = [0, 1, 2].map((k) => (w0 * V[tri[0]][k] + w1 * V[tri[1]][k] + w2 * V[tri[2]][k]) / STAND_M), t = head.paint({ x: p[0], y: p[1], z: p[2] });
      const base = t === 'pupil' ? PUPIL : t === 'iris' ? IRIS : SCLERA;
      return base.map((c) => c * (0.35 + 0.65 * Math.max(0, NL)) + 0.5 * NH ** 200);
    }
    if (mode === 'kinds') { const k = kinds[tri[[w0, w1, w2].indexOf(Math.max(w0, w1, w2))]]; return hueOf(k).map((c) => toLin(c) * (0.35 + 0.65 * Math.max(0, NL))); }
    // (the body-part map's parts in its own colours; a point it does not label, the hands, the feet, the head: grey)
    if (mode === 'parts') { const k = kinds[tri[[w0, w1, w2].indexOf(Math.max(w0, w1, w2))]]; return (k ? hexLin(PART_COLOURS[k]) : [0.3, 0.3, 0.3]).map((c) => c * (0.35 + 0.65 * Math.max(0, NL))); }
    const uv = T.faceUV(fi), U = uv[0][0] * w0 + uv[1][0] * w1 + uv[2][0] * w2, Vv = uv[0][1] * w0 + uv[1][1] * w1 + uv[2][1] * w2;
    // (an enclosed face, a nostril's or the lips' line inside, is darkened by its own occlusion: it has no texels)
    const shut = tri.some((vi) => chart.samples[vi].enclosed) && chart.ao ? 0.35 + 0.65 * Math.min(...tri.map((vi) => chart.ao[vi])) : 1;
    return skinShade(T, U, Vv, n, NL, NH, NV, cam, shut, mode);
  });
  return R;
}
const frame = (W, Hh) => { const zbuf = new Float32Array(W * Hh).fill(-Infinity), img = new Float32Array(W * Hh * 3), bg = hexLin(BG); for (let i = 0; i < W * Hh; i++) img.set(bg, i * 3); return { img, zbuf }; };
/** the triangles z-buffered: `normalsOf(fi, tri)` the corners' normals, `colour(fi, tri, w, n, NL, NH, NV)` a texel's
 * linear colour (null: not drawn) */
function raster(R, cam, W, Hh, V, faces, normalsOf, colour) {
  const { img, zbuf } = R;
  faces.forEach((tri, fi) => {
    const P = tri.map((v) => cam.project(V[v])), [A, B, C] = P;
    const area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]); if (!area) return;
    const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
    const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(Hh - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
    const Nc = normalsOf(fi, tri);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const qx = x + 0.5, qy = y + 0.5;
      const w0 = ((B[0] - qx) * (C[1] - qy) - (B[1] - qy) * (C[0] - qx)) / area, w1 = ((C[0] - qx) * (A[1] - qy) - (C[1] - qy) * (A[0] - qx)) / area, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const d = w0 * A[2] + w1 * B[2] + w2 * C[2], o = y * W + x; if (d <= zbuf[o]) continue;
      let n = [0, 1, 2].map((q) => w0 * Nc[0][q] + w1 * Nc[1][q] + w2 * Nc[2][q]); const l = Math.hypot(...n) || 1; n = n.map((v) => v / l);
      const NL = n[0] * cam.light[0] + n[1] * cam.light[1] + n[2] * cam.light[2], NV = Math.max(0, n[0] * cam.view[0] + n[1] * cam.view[1] + n[2] * cam.view[2]);
      const Hv = [0, 1, 2].map((k) => cam.light[k] + cam.view[k]), hl = Math.hypot(...Hv), NH = Math.max(0, (n[0] * Hv[0] + n[1] * Hv[1] + n[2] * Hv[2]) / hl);
      const col = colour(fi, tri, [w0, w1, w2], n, NL, NH, NV); if (!col) continue;
      zbuf[o] = d; img.set(col, o * 3);
    }
  });
}
// the study's light (a warm key, its fill, a cool rim); a subject's `light` (an art direction's: hexes, each read at a
// luminance of one) replaces it
const LIGHT_DEFAULT = { key: [1.04, 1, 0.95], fill: [1.04, 1, 0.95], rim: [0.75, 0.85, 1], exposure: 1 };
let LIGHT = null;
const lightOfHex = (L) => { const n = (h, s = 1) => { const c = hexLin(h), l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] || 1; return c.map((v) => (v / l) * s); }; return { key: L.key ? n(L.key) : LIGHT_DEFAULT.key, fill: L.fill ? n(L.fill) : LIGHT_DEFAULT.fill, rim: L.rim ? n(L.rim, 0.85) : LIGHT_DEFAULT.rim, exposure: L.exposure ?? 1 }; };
/** a skin texel lit from its atlas: `mode` 'lit' (the skin's cheats), or one of the atlas's channels shown as grey on
 * the shape ('roughness', 'translucency', 'hair', 'ao'), lit flat */
function skinShade(T, U, Vv, n, NL, NH, NV, cam, shut = 1, mode = 'lit') {
  const N = [T.page, T.pageH];
  if (mode !== 'lit') {
    const g = mode === 'hair' ? sample(T.hair, N, U, Vv)[0] / 255 : sample(T[mode === 'roughness' ? 'roughness' : mode], N, U, Vv, 1)[0] / 255;
    return [0, 1, 2].map(() => toLin(g) * (0.55 + 0.45 * Math.max(0, NL)));
  }
  const alb = sample(T.albedo, N, U, Vv).slice(0, 3).map((c) => toLin(c / 255));
  const tr = sample(T.translucency, N, U, Vv, 1)[0] / 255, ro = sample(T.roughness, N, U, Vv, 1)[0] / 255, fz = sample(T.fuzz, N, U, Vv, 1)[0] / 255;
  // the skin's cheats: the wrap (red reaches past the terminator by the thinness), the sheen, the vellus's rim
  const wrap = [0.18 + 0.5 * tr, 0.1 + 0.22 * tr, 0.08 + 0.18 * tr];
  // (skin reflects about 4 % at every tone: an energy-conserving lobe, so a deep skin's sheen carries its form)
  const pw = 2 / Math.max(0.02, ro ** 4), spec = 0.04 * ((pw + 2) / 8) * NH ** pw * Math.max(0, NL), rim = 0.12 * fz * (1 - NV) ** 3;
  // and a cool RIM from behind (the creator's three-point light: a warm key, a cool rim that cuts the head out)
  const rimL = 0.16 * (1 - NV) ** 2.5 * Math.max(0, -(n[0] * cam.light[0] + n[1] * cam.light[1]) * 0.6 + 0.4);
  const Lt = LIGHT || LIGHT_DEFAULT;
  return alb.map((c, k) => (c * shut * (0.22 * Lt.fill[k] + 0.78 * Math.max(0, (NL + wrap[k]) / (1 + wrap[k])) * Lt.key[k]) + spec * shut * (LIGHT ? Lt.key[k] : 1) + rim * 0.9 + rimL * Lt.rim[k]) * Lt.exposure);
}

/** strands: each segment a line, depth-tested, its alpha the hairs it stands for over a pixel (a segment shorter than a
 * pixel its share of one), lit by a hair shader (diffuse by the tangent, the primary highlight white and the secondary
 * tinted, each shifted) */
function drawStrands(R, cam, W, Hh, strands, shade, represents, flat = null, ribbon = null) {
  const { img, zbuf } = R, root = hexLin(shade.root), tip = hexLin(shade.tip), tint = hexLin(shade.secondary.tint);
  const L = cam.light, Vw = cam.view, Hv = [L[0] + Vw[0], L[1] + Vw[1], L[2] + Vw[2]], hl = Math.hypot(...Hv), Hn = Hv.map((x) => x / hl);
  for (const st of strands) {
    // a strand that stands for a RIBBON of hair (the scalp's: the gap between strands) is drawn that wide, its alpha the
    // ribbon's cover; a lone hair one pixel wide, its alpha its share of the pixel
    const rw = ribbon?.(st) ?? 0, wpx = Math.max(1, Math.round((rw * 1000) / cam.pxMm)), n = st.pts.length - 1;
    const a = rw ? Math.min(0.92, (represents(st) * st.r * 2) / rw) : Math.min(0.95, (represents(st) * st.r * 2 * 1000) / cam.pxMm);
    if (a < 0.003) continue;
    for (let k = 0; k < n; k++) {
      const p = st.pts[k], q = st.pts[k + 1], A = cam.project(p), B = cam.project(q);
      const t = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], tl = Math.hypot(...t) || 1, T = t.map((x) => x / tl);
      const s = (k + 0.5) / n, inner = 1 - (shade.selfShadow ?? 0.25) * (1 - s), base = root.map((c, i) => (c + (tip[i] - c) * s) * inner);
      const TL = T[0] * L[0] + T[1] * L[1] + T[2] * L[2], TH = T[0] * Hn[0] + T[1] * Hn[1] + T[2] * Hn[2];
      const diff = Math.sqrt(Math.max(0, 1 - TL * TL)), s1 = Math.sqrt(Math.max(0, 1 - (TH + shade.primary.shift) ** 2)), s2 = Math.sqrt(Math.max(0, 1 - (TH + shade.secondary.shift) ** 2));
      const g = shade.gloss ?? 1, sp1 = 0.35 * g * s1 ** (8 / shade.primary.roughness ** 2), sp2 = 0.3 * g * s2 ** (4 / shade.secondary.roughness ** 2);
      const col = flat || base.map((c, i) => c * (0.25 + 0.75 * diff) + sp1 + sp2 * tint[i]);
      const lp = Math.hypot(B[0] - A[0], B[1] - A[1]), steps = Math.max(1, Math.ceil(lp)), as = a * Math.min(1, lp);
      const h0 = -Math.floor((wpx - 1) / 2), h1 = h0 + wpx - 1;
      for (let j = 0; j < steps; j++) {
        const f = j / steps, cx = Math.floor(A[0] + (B[0] - A[0]) * f), cy = Math.floor(A[1] + (B[1] - A[1]) * f), d = A[2] + (B[2] - A[2]) * f;
        for (let dy = h0; dy <= h1; dy++) for (let dx = h0; dx <= h1; dx++) {
          const x = cx + dx, y = cy + dy;
          if (x < 0 || y < 0 || x >= W || y >= Hh) continue;
          const o = y * W + x; if (d < zbuf[o] - 0.0015) continue;
          for (let i = 0; i < 3; i++) img[o * 3 + i] = img[o * 3 + i] * (1 - as) + col[i] * as;
        }
      }
    }
  }
}
/** a tie's BAND: a ring round the bundle where it is gathered, dark and a few millimetres wide */
function drawBands(R, cam, W, Hh, bands, shade) {
  if (!bands?.length) return;
  for (const b of bands) {
    const a = b.axis, e1 = (() => { const t = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], d = t[0] * a[0] + t[1] * a[1] + t[2] * a[2], v = [t[0] - a[0] * d, t[1] - a[1] * d, t[2] - a[2] * d], l = Math.hypot(...v); return v.map((x) => x / l); })();
    const e2 = [a[1] * e1[2] - a[2] * e1[1], a[2] * e1[0] - a[0] * e1[2], a[0] * e1[1] - a[1] * e1[0]];
    const ring = Array.from({ length: 33 }, (_, i) => { const t = (i / 32) * 2 * Math.PI; return [0, 1, 2].map((k) => b.c[k] + b.r * (Math.cos(t) * e1[k] + Math.sin(t) * e2[k])); });
    drawStrands(R, cam, W, Hh, [{ pts: ring, r: 0.002, groom: 'band' }], shade, () => 1, [0.06, 0.05, 0.05], () => 0.004);
  }
}
const toRGBA = (img, W, Hh) => { const b = Buffer.alloc(W * Hh * 4); for (let i = 0; i < W * Hh; i++) { for (let k = 0; k < 3; k++) b[i * 4 + k] = Math.round(Math.max(0, Math.min(1, toSrgb(img[i * 3 + k]))) * 255); b[i * 4 + 3] = 255; } return b; };

// ─── the sheet ───
const parts = [], report = {};
let y0 = 0, sheetW = 1200;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const label = (x, y, t, size = 12) => parts.push(`<text x="${x + 6}" y="${y}" font-family="monospace" font-size="${size}" fill="#333">${esc(t)}</text>`);
async function cellRaw(x, y, buf, W, Hh, ch = 4) {
  const png = await sharp(buf, { raw: { width: W, height: Hh, channels: ch } }).png().toBuffer();
  parts.push(`<image x="${x}" y="${y}" width="${W}" height="${Hh}" href="data:image/png;base64,${png.toString('base64')}"/>`);
}
const cellPng = (x, y, png, W, Hh) => parts.push(`<image x="${x}" y="${y}" width="${W}" height="${Hh}" href="data:image/png;base64,${png.toString('base64')}"/>`);
const boxOf = (V) => ({ min: [0, 1, 2].map((k) => Math.min(...V.map((p) => p[k]))), max: [0, 1, 2].map((k) => Math.max(...V.map((p) => p[k]))) });
/** a box about a mark's 3D point (metres), `r` across */
const boxAt = (c, r) => ({ min: c.map((v) => v - r), max: c.map((v) => v + r) });
const m3 = (p) => [p.x * STAND_M, p.y * STAND_M, p.z * STAND_M];

const ancOf = (t) => { const [id, sx = 'male', sd = '1', eyeShape = null] = t.split(':'); return { id, sex: sx, seed: Number(sd), eyeShape }; };
const subjects = [...sexes.map((x) => [x, null, null]), ...looks.map((l) => [l, l, null]), ...ancestries.map((t) => [t.replace(/:/g, '-'), null, ancOf(t)]), ...faces.map((f, i) => [f.label || `face${i}`, null, null, f])];
// ─── THE BODY (`--body`): the realistic hero's body (docs/realistic-body.md) wearing its dermis (dermal-body.js), the
// relational head grafted on it with its own atlas, as /body-study fits it (vertex to menton, the ear's depth) ───
const HERO_HEAD = /^(cranium|jaw|eye|iris|pupil|lid|brow|ear|nostril|upperLip|mouth|hair|face)/;
async function bodyOf(sex) {
  const t0 = Date.now();
  const { heroRecord, expandLayeredManifest } = await import('@/lib/mcp/tools/layered.js');
  const { compileLayered } = await import('@/lib/graph/polygonizer/station-loft.js');
  const { layeredShadingNormals } = await import('@/lib/graph/polygonizer/station-loft-shade.js');
  const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast: sex, form: 'realistic', ...(physiqueSpec ? { physique: physiqueSpec } : {}) }) });
  const mesh = compileLayered(m.recipe, m.dials), t1 = Date.now();
  const H = headOf(sex), D = readDermis({ from: sex, ...BODY_DERMIS[sex], ...dermisSpec });
  // the body-part map (body-relational-map.js): each point its part, drawn on the skin
  const { validateRig } = await import('@/lib/graph/polygonizer/station-loft-rig.js');
  const { physique } = await import('@/lib/graph/polygonizer/body-relational.js');
  const { bodyPartMap } = await import('@/lib/graph/polygonizer/body-relational-map.js');
  const partMap = bodyPartMap(m.recipe, validateRig(m.recipe.rig), physique(sex === 'female' ? 'shalla' : 'norrin', physiqueSpec ?? 'athletic'));
  const B = bodyDermis(mesh, m.recipe, { dermis: D, page: bodyPage, neck: neckTone(H.chart, H.D), partMap });
  const prov = mesh.provenance, of = (re) => mesh.vertices.filter((_, i) => re.test(prov[i].part));
  const top = Math.max(...of(/^(cranium|jaw)$/).map((v) => v[2])), men = Math.min(...of(/^jaw$/).map((v) => v[2])), ear = of(/^earR$/);
  const sc = (top - men) / (Math.max(...H.chart.vertices.map((v) => v[2])) / STAND_M);
  const ty = (ear.length ? ear.reduce((a, v) => a + v[1], 0) / ear.length : 0) - H.head.landmarks.tragionR.y * sc;
  const place = (p) => [(p[0] / STAND_M) * sc, (p[1] / STAND_M) * sc + ty, (p[2] / STAND_M) * sc + men];
  const k = sc / STAND_M, moved = (st) => ({ ...st, pts: st.pts.map(place), r: st.r * k });
  H.place = place;
  const shell = { chart: B.chart, T: B.maps, D, head: null, cornerNormals: layeredShadingNormals(mesh, m.recipe), hide: (fi) => HERO_HEAD.test(prov[mesh.faces[fi][0]].part) };
  const hair = [...(H.scalp?.strands || []).map(moved), ...H.beard.strands.map(moved)], brows = H.brows.map(moved);
  const neckV = mesh.vertices.filter((_, i) => prov[i].part === 'neck'), neckTop = [0, 1, 2].map((k) => neckV.reduce((a, v) => a + v[k], 0) / neckV.length);
  return { sex, H, B, D, k, shell, hair, brows, mesh, neckAt: [neckTop[0], neckTop[1], neckTop[2] + 0.01], ms: [t1 - t0, Date.now() - t1] };
}
if (body) {
  const BV = [{ name: 'front', az: 0, elev: 3 }, { name: 'front ¾', az: 35, elev: 5 }, { name: 'lateral', az: 90, elev: 2 }, { name: 'back', az: 180, elev: 4 }];
  for (const sex of sexes) {
    const Y = await bodyOf(sex), { H, B } = Y, V = Y.mesh.vertices;
    const shade = H.scalp?.shade ?? hairShade(hexLin(H.epiColour)), perStrand = H.scalp?.counts?.lying ? 2 : H.scalp?.counts?.hairsPerStrand ?? 1;
    const rep = (st) => (st.groom === 'scalp' ? perStrand : st.groom === 'beard' ? 2 : 1);
    const whole = boxOf([...V.filter((_, i) => i % 7 === 0), ...Y.hair.filter((_, i) => i % 9 === 0).flatMap((st) => st.pts)]);
    const draw = (cam, W, Hh, mode, withHair) => {
      const R = render(Y.shell, cam, W, Hh, mode); render(H, cam, W, Hh, mode, R);
      if (withHair) { drawStrands(R, cam, W, Hh, Y.hair, shade, rep, null, (st) => (st.groom === 'scalp' && !H.scalp?.counts?.lying ? H.S.strandGap * 0.75 * Y.k : 0)); drawBands(R, cam, W, Hh, H.scalp?.bands?.map((b) => ({ ...b, c: H.place(b.c), r: b.r * Y.k })), shade); }
      drawStrands(R, cam, W, Hh, Y.brows, hairShade(hexLin(H.epiColour)), () => 1);
      return R;
    };
    const rows = [
      { what: 'textured from its atlas, lit as skin (the head its own atlas, grafted)', cells: BV.map((v) => ({ v, mode: 'lit', hair: true })), box: whole, W: 300, Hh: 760 },
      { what: 'the map\'s kinds (each region its colour): the islands\' addresses read back on the body', cells: BV.map((v) => ({ v, mode: 'kinds' })), box: whole, W: 300, Hh: 760 },
      { what: 'the body-part map (body-relational-map.js) on the skin (the limbs\' seams run through its hidden patches), and the lit body beside it', cells: [BV[0], BV[2], BV[3]].map((v) => ({ v, mode: 'parts' })).concat([{ v: BV[1], mode: 'lit' }]), box: whole, W: 300, Hh: 760 },
      { what: 'the channels on the body: hair density (front, back), translucency (front), roughness (back)', cells: [{ v: BV[0], mode: 'hair' }, { v: BV[3], mode: 'hair' }, { v: BV[0], mode: 'translucency' }, { v: BV[3], mode: 'roughness' }], box: whole, W: 300, Hh: 760 },
      { what: 'where the head meets the body: the neck (front, front ¾, lateral, back)', cells: BV.map((v) => ({ v, mode: 'lit', hair: true })), box: boxAt(Y.neckAt, 0.14), W: 300, Hh: 300 },
    ];
    for (const row of rows) {
      for (const [col, c] of row.cells.entries()) {
        const cam = camera(c.v.az, c.v.elev, row.box, row.W, row.Hh), R = draw(cam, row.W, row.Hh, c.mode, c.hair);
        await cellRaw(col * row.W, y0, toRGBA(R.img, row.W, row.Hh), row.W, row.Hh);
        label(col * row.W, y0 + row.Hh - 10, `${sex} · ${c.v.name}${c.mode === 'lit' ? '' : ` · ${c.mode}`} · ${cam.pxMm.toFixed(1)} mm/px`, 11);
      }
      label(0, y0 + 16, `${sex} body: ${row.what}`, 13);
      sheetW = Math.max(sheetW, row.cells.length * row.W); y0 += row.Hh;
    }
    // the atlas's pages and the body's relief tiles
    const pngs = dermalPngs(B.maps), PW = 300, PH = Math.round((PW * B.maps.pageH) / B.maps.page);
    for (const [k, b] of Object.entries(pngs)) writeFileSync(path.join(out, `body-atlas-${sex}-${k}.png`), b);
    parts.push(`<rect x="0" y="${y0}" width="${Math.max(sheetW, 1600)}" height="${PH + 120}" fill="#faf9f7"/>`);
    let x = 0;
    for (const k of ['albedo', 'roughness', 'translucency', 'hair', 'ao']) { if (!pngs[k]) continue; cellPng(x, y0 + 24, pngs[k], PW, PH); label(x, y0 + 18, `body atlas · ${k}`, 12); x += PW + 8; }
    for (const cl of B.maps.classes.slice(0, 3)) {
      const tile = reliefTile(cl, { px: 150, size: 8, seed: Y.D.seed, age: Y.D.age });
      await cellRaw(x, y0 + 24, Buffer.from(tile.normal), 150, 150, 3); label(x, y0 + 18, `relief · ${cl.class} (8 mm)`, 12); x += 158;
    }
    sheetW = Math.max(sheetW, x);
    const headMpt = H.L.mmPerTexel / H.L.faceWeight;
    const lines = [
      `dermis ${JSON.stringify(Y.D)}`,
      `body atlas ${B.layout.page}×${B.layout.pageH} · ${B.layout.mmPerTexel.toFixed(2)} mm/texel (the head's ${headMpt.toFixed(2)} on its own ${H.T.page}×${H.T.pageH}) · ${B.layout.rects.length} islands · relief classes ${B.maps.classes.map((c) => c.class).join(', ')}`,
      `mint + compile ${Y.ms[0]} ms · the head, the body's chart, layout and paint ${Y.ms[1]} ms`,
    ];
    lines.forEach((t, i) => label(0, y0 + PH + 50 + i * 17, t, 12));
    report[`${sex}-body`] = { dermis: Y.D, page: B.layout.page, pageH: B.layout.pageH, mmPerTexel: B.layout.mmPerTexel, headMmPerTexel: headMpt, islands: B.layout.rects.map((r) => ({ key: r.key, x: r.x, y: r.y, w: r.w, h: r.h })), classes: B.maps.classes.map((c) => c.class), ms: Y.ms };
    console.log(`\n${sex} body:`); for (const t of lines) console.log(`  ${t}`);
    y0 += PH + 120;
  }
}
// THE LINEUP: each subject at the front and the front ¾ only, lit with its hair, four subjects to a row, what each was
// rolled to under it
if (lineup) {
  const W = lineupCrop === 'face' || lineupCrop === 'eye' ? 400 : 260, Hh = lineupCrop === 'face' ? 440 : lineupCrop === 'eye' ? 340 : 330, nv = lineupAll ? 4 : 2, per = lineupAll ? 2 : 4;
  for (let k = 0; k < subjects.length; k++) {
    const [who, look, anc, face] = subjects[k], H = headOf(who, look, anc, face), V = H.chart.vertices;
    LIGHT = face?.light ? lightOfHex(face.light) : null;
    const shade = H.scalp?.shade ?? hairShade(hexLin(H.epiColour)), perStrand = H.scalp?.counts?.lying ? 2 : H.scalp?.counts?.hairsPerStrand ?? 1;
    const hair = [...(H.scalp?.strands || []), ...H.beard.strands], rep = (st) => (st.groom === 'scalp' ? perStrand : st.groom === 'beard' ? 2 : 1);
    // (`--lineup-crop eyes`: the eyes close, for comparing the lids)
    const Le = H.head.landmarks, box = lineupCrop === 'eyes' ? boxAt(m3({ x: 0, y: Le.eyeR.y, z: Le.eyeR.z }), 0.045) : lineupCrop === 'eye' ? boxAt(m3(Le.eyeR), 0.024) : lineupCrop === 'face' ? boxAt(m3({ x: 0, y: Le.eyeR.y, z: Le.eyeR.z }).map((v, i) => v - (i === 2 ? 0.03 : 0)), 0.072) : boxOf([...V.filter((_, i) => i % 9 === 0), ...hair.filter((_, i) => i % 9 === 0).flatMap((st) => st.pts)]);
    const col0 = (k % per) * nv * W, y = Math.floor(k / per) * (Hh + 60);
    for (const [c, v] of VIEWS.slice(0, nv).entries()) {
      const cam = camera(v.az, v.elev, box, W, Hh), R = render(H, cam, W, Hh, 'lit');
      drawStrands(R, cam, W, Hh, hair, shade, rep, null, (st) => (st.groom === 'scalp' && !H.scalp?.counts?.lying ? H.S.strandGap * 0.75 : 0));
      drawBands(R, cam, W, Hh, H.scalp?.bands, shade);
      drawStrands(R, cam, W, Hh, H.brows, hairShade(hexLin(H.epiColour)), () => 1);
      await cellRaw(col0 + c * W, y, toRGBA(R.img, W, Hh), W, Hh);
    }
    const r = H.rolled;
    label(col0, y + Hh + 16, r ? `${r.ancestry} · ${H.sex} · MST ${r.tone} ${r.undertone}` : `${who} · ${H.sex}`, 12);
    label(col0, y + Hh + 32, r ? `${r.texture} ${r.hair} · ${H.S ? `${H.S.style}${H.S.type !== 'straight' ? ` (${H.S.type})` : ''}` : 'shaven'}${r.eyes ? ` · eyes: ${r.eyes}` : ''}` : `${H.S?.style ?? ''}`, 11);
    report[who] = { rolled: r, dermis: H.D, scalp: H.S, ms: H.ms };
    console.log(`${who}: ${JSON.stringify(r)} ${H.S?.style} ${H.ms} ms`);
    sheetW = Math.max(sheetW, Math.min(per, subjects.length) * nv * W); y0 = Math.max(y0, y + Hh + 60);
  }
}
for (const [who, look, anc] of lineup || body ? [] : subjects) {
  const H = headOf(who, look, anc), sex = look ? `${look} (${H.sex})` : anc ? `${H.rolled.ancestry} (${H.sex}, MST ${H.rolled.tone})` : who, V = H.chart.vertices, Lm = H.head.landmarks;
  const shade = H.scalp?.shade ?? hairShade(hexLin(H.epiColour));
  const hair = [...(H.scalp?.strands || []), ...H.beard.strands], fine = H.brows;
  const perStrand = H.scalp?.counts?.lying ? 2 : H.scalp?.counts?.hairsPerStrand ?? 1;
  const rep = (st) => (st.groom === 'scalp' ? perStrand : st.groom === 'beard' ? 2 : 1);
  const hairBox = boxOf([...V.filter((_, i) => i % 9 === 0), ...hair.filter((_, i) => i % 9 === 0).flatMap((s) => s.pts)]);
  const eyes = m3({ x: 0, y: Lm.eyeR.y, z: Lm.eyeR.z }), mouth = m3(Lm.stomion);
  const rows = [
    { mode: 'lit', hair: true, box: hairBox, views: VIEWS, W: 320, Hh: 400, what: 'textured from its atlas, lit as skin, with its hair' },
    { mode: 'lit', hair: false, box: boxOf(V), views: VIEWS, W: 320, Hh: 400, what: 'bare: the skin, the brows and the lashes' },
    { mode: 'kinds', hair: false, box: boxOf(V), views: VIEWS, W: 320, Hh: 400, what: 'the map\'s kinds (each region its colour) and the scalp\'s guides' },
    { mode: 'lit', hair: true, box: boxAt(eyes, 0.05), views: VIEWS.slice(0, 3), W: 420, Hh: 300, what: 'the eyes close' },
    { mode: 'lit', hair: true, box: boxAt(mouth, 0.04), views: VIEWS.slice(0, 3), W: 420, Hh: 300, what: 'the mouth and the beard close' },
  ];
  for (const row of rows) {
    for (const [col, v] of row.views.entries()) {
      const cam = camera(v.az, v.elev, row.box, row.W, row.Hh), R = render(H, cam, row.W, row.Hh, row.mode);
      if (row.mode === 'kinds' && H.scalp) drawStrands(R, cam, row.W, row.Hh, H.scalp.guides.map((g) => ({ pts: g.pts, r: 0.0004 })), shade, () => 1, [0.05, 0.05, 0.08]);
      if (row.hair) { drawStrands(R, cam, row.W, row.Hh, hair, shade, rep, null, (st) => (st.groom === 'scalp' && !H.scalp?.counts?.lying ? H.S.strandGap * 0.75 : 0)); drawBands(R, cam, row.W, row.Hh, H.scalp?.bands, shade); }
      drawStrands(R, cam, row.W, row.Hh, fine, hairShade(hexLin(H.epiColour)), () => 1);
      await cellRaw(col * row.W, y0, toRGBA(R.img, row.W, row.Hh), row.W, row.Hh);
      label(col * row.W, y0 + row.Hh - 10, `${sex} · ${v.name} · ${cam.pxMm.toFixed(2)} mm/px`, 11);
    }
    label(0, y0 + 16, `${sex}: ${row.what}`, 13);
    sheetW = Math.max(sheetW, row.views.length * row.W);
    y0 += row.Hh;
  }
  // the atlas's pages and the relief tiles
  const pngs = dermalPngs(H.T), PW = 280;
  for (const [k, b] of Object.entries(pngs)) writeFileSync(path.join(out, `atlas-${who}-${k}.png`), b);
  parts.push(`<rect x="0" y="${y0}" width="${Math.max(sheetW, 1500)}" height="${PW + 230}" fill="#faf9f7"/>`);
  let x = 0;
  for (const k of ['albedo', 'roughness', 'translucency', 'hair']) { cellPng(x, y0 + 24, pngs[k], PW, Math.round(PW * H.T.pageH / H.T.page)); label(x, y0 + 18, `atlas · ${k}`, 12); x += PW + 8; }
  for (const c of ['cheek', 'nose', 'forehead'].map((k) => H.T.classes.find((q) => q.class === k)).filter(Boolean)) {
    const tile = reliefTile(c, { px: 160, size: 8, seed: H.D.seed, age: H.D.age });
    const tiled = Buffer.alloc(320 * 320 * 3); for (let yy = 0; yy < 320; yy++) for (let xx = 0; xx < 320; xx++) for (let k = 0; k < 3; k++) tiled[(yy * 320 + xx) * 3 + k] = tile.normal[((yy % 160) * 160 + (xx % 160)) * 3 + k];
    await cellRaw(x, y0 + 24, tiled, 320, 320, 3); label(x, y0 + 18, `relief tile · ${c.class} (2×2, 16 mm)`, 12); x += 328;
  }
  sheetW = Math.max(sheetW, x);
  const C = H.T.classes.map((c) => c.class).join(', ');
  const lines = [
    `dermis ${JSON.stringify(H.D)}`,
    `scalp ${H.S ? `${H.S.style} · ${H.S.type} · ${(H.S.length * 100).toFixed(0)} cm stretched, falls ${(H.S.length * (H.scalp.counts.shrink ?? 1) * 100).toFixed(0)} cm · ${H.scalp.counts.lying ? `lying, ${H.scalp.counts.strands} strands` : `combed: ${H.scalp.counts.guides} guides → ${H.scalp.counts.strands} strands (each ${H.scalp.counts.hairsPerStrand} hairs)`}` : 'none (shaven)'}`,
    `beard ${H.beard.strands.length} strands (stubble ${H.D.stubble} mm; under 1.5 mm the texture's follicles alone) · brows and lashes ${fine.length} strands`,
    `atlas ${H.T.page}×${H.T.pageH} · ${(H.L.mmPerTexel / H.L.faceWeight).toFixed(2)} mm/texel · relief classes: ${C} · ${H.chart.vertices.length} vertices · ${H.ms} ms`,
  ];
  lines.forEach((t, i) => label(0, y0 + PW + 60 + i * 17, t, 12));
  report[sex] = { dermis: H.D, scalp: H.S, scalpCounts: H.scalp?.counts ?? null, beard: H.beard.counts, brows: fine.length, mmPerTexel: H.L.mmPerTexel / H.L.faceWeight, classes: C.split(', '), ms: H.ms };
  console.log(`\n${sex}:`); for (const t of lines) console.log(`  ${t}`);
  y0 += PW + 230;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${y0}" viewBox="0 0 ${sheetW} ${y0}"><rect width="100%" height="100%" fill="${BG}"/>${parts.join('')}</svg>`;
writeFileSync(path.join(out, 'sheet.svg'), svg);
writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
const r = spawnSync('node', [path.join(REPO, '.claude/skills/view-svg/rasterize.mjs'), path.join(out, 'sheet.svg'), '--out', out, '--max', '2400'], { cwd: REPO, encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr || r.stdout); process.exit(1); }
console.log(`\n— dermis-study: ${sexes.join(' + ')} → ${out} (sheet.png, sheet.svg, atlas-*.png, report.json)`);
