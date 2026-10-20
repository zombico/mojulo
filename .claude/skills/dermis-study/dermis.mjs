#!/usr/bin/env node
// dermis-study — the DERMAL TEXTURIZER on the hero's body: the skin laid out by its chart (control/lib/graph/epidermis/
// dermal-chart.js, dermal-map.js), baked to an atlas (dermal-texture.js) and sampled back through the face UVs as an
// engine would, lit with the skin's cheats (a wrap that reddens the terminator by the translucency map, the sheen by the
// roughness map, the vellus's rim by the fuzz map), wearing the hair the tracts grow (dermal-hair.js: body hair lying on
// the skin, the scalp's clumps on elastica guides, drawn with a hair shader's shifted dual highlight). Run, then Read.
//
//   node .claude/skills/dermis-study/dermis.mjs [male] [female] [--dermis '{…}'] [--scalp '{…}'|word] [--crop <c>]
//                                               [--page N] [--share s] [--out dir]
//
//   male / female   which casts (default both).
//   --dermis        the dermis's dials over the cast's preset (dermal-map.js DERMIS_DIALS): '{"tone":8,"freckles":0.5}'
//   --scalp         the scalp groom (dermal-hair.js): a style word (buzz, crop, short, bob, shoulder, long) or
//                   '{"style":"shoulder","type":"coily"}'; 'none' grows no scalp hair (a bare scalp, shaven)
//   --crop          face | forearm | hand | scalp | shin: a close row of the right side's (adds to the whole-body rows)
//   --page          the atlas's page in texels (default 1024)
//   --share         the body hair's share (default 0.25: a strand stands for four)
//   --out           output dir (default /tmp/dermis-study): sheet.png, sheet.svg, atlas-*.png, report.json
//
// Rows per cast: the body textured and lit with its hair (front, front ¾, lateral, back); the same views in the map's
// kinds (each region its own colour) with the hair's flow (a tick per vertex along its tract); the crop when asked; then
// the atlas's pages (albedo, roughness, translucency, hair density and flow) and the relief tiles (the detail normals).
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
const { heroRecord, expandLayeredManifest } = await import('@/lib/mcp/tools/layered.js');
const { compileLayered } = await import('@/lib/graph/polygonizer/station-loft.js');
const { layeredShadingNormals } = await import('@/lib/graph/polygonizer/station-loft-shade.js');
const { heroChart } = await import('@/lib/graph/epidermis/dermal-chart.js');
const { readDermis, dermisAt, hairColourOf, hexLin, toSrgb } = await import('@/lib/graph/epidermis/dermal-map.js');
const { layoutDermis, paintDermis, dermalPngs, reliefTile } = await import('@/lib/graph/epidermis/dermal-texture.js');
const { growBodyHair, growScalp, readScalp } = await import('@/lib/graph/epidermis/dermal-hair.js');

// ─── arguments ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let out = '/tmp/dermis-study', dermisSpec = {}, scalpSpec = null, crop = null, page = 1024, share = 0.25;
const casts = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--dermis') { dermisSpec = JSON.parse(args[++i]); continue; }
  if (a === '--scalp') { const v = args[++i]; scalpSpec = v.trim().startsWith('{') ? JSON.parse(v) : v; continue; }
  if (a === '--crop') { crop = args[++i]; continue; }
  if (a === '--page') { page = Number(args[++i]); continue; }
  if (a === '--share') { share = Number(args[++i]); continue; }
  if (a === '--out') { out = args[++i]; continue; }
  if (a.startsWith('--')) throw new Error(`dermis-study: unknown option ${a}`);
  casts.push(a);
}
if (!casts.length) casts.push('male', 'female');
const CROPS = { face: ['cranium'], forearm: ['foreArmR'], hand: ['handR', 'thumbR', 'indexR', 'middleR', 'ringR', 'littleR'], scalp: ['cranium', 'neck'], shin: ['shankR'] };
if (crop && !CROPS[crop]) throw new Error(`dermis-study: crop '${crop}' is not one of ${Object.keys(CROPS).join(', ')}`);
mkdirSync(out, { recursive: true });

// ─── the camera (body-study's: metres, z up, +y forward) ───
const VIEWS = [{ name: 'front', az: 0, elev: 4 }, { name: 'front ¾', az: 35, elev: 8 }, { name: 'lateral', az: 90, elev: 2 }, { name: 'back', az: 180, elev: 4 }];
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
  // the light in the world: the view's frame turned back (key from the upper left, as body-study lights)
  const light = [0, 1, 2].map((k) => r[k] * lv[0] + u[k] * lv[1] + c[k] * lv[2]);
  return { project: (p) => [W / 2 + dot(p, r) * sc, H / 2 - dot(p, u) * sc, dot(p, c)], view: c, light, pxMm: 1000 / sc };
}

// ─── the hero and its skin ───
function heroOf(cast) {
  const m = expandLayeredManifest({ kind: 'layered', hero: heroRecord({ cast, hair: 'none' }) });
  const mesh = compileLayered(m.recipe, m.dials), chart = heroChart(mesh), normals = layeredShadingNormals(mesh, m.recipe);
  const D = readDermis({ from: cast === 'female' ? 'female' : 'male', ...dermisSpec });
  const scalpWord = scalpSpec ?? (cast === 'female' ? 'shoulder' : 'short');
  const S = scalpWord === 'none' ? null : readScalp(scalpWord);
  const L = layoutDermis(chart, { page }), T = paintDermis(chart, D, L, { scalp: !!S });
  const body = growBodyHair(chart, D, { share }), scalp = S ? growScalp(chart, D, S) : null;
  return { mesh, chart, normals, D, S, L, T, body, scalp };
}

// ─── the rasteriser: the atlas sampled through the face UVs, lit as skin ───
function sampleRGBA(buf, N, u, v, ch = 4) {
  const x = Math.max(0, Math.min(N - 1, u * N - 0.5)), y = Math.max(0, Math.min(N - 1, (1 - v) * N - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(N - 1, x0 + 1), y1 = Math.min(N - 1, y0 + 1), fx = x - x0, fy = y - y0;
  const at = (xx, yy, k) => buf[(yy * N + xx) * ch + k];
  return Array.from({ length: ch }, (_, k) => (at(x0, y0, k) * (1 - fx) + at(x1, y0, k) * fx) * (1 - fy) + (at(x0, y1, k) * (1 - fx) + at(x1, y1, k) * fx) * fy);
}
const KIND_HUE = {};
const hueOf = (k) => (KIND_HUE[k] ??= (() => { let h = 0; for (const c of k) h = (h * 37 + c.charCodeAt(0)) % 360; const f = (n) => { const q = (n + h / 30) % 12; return 0.75 - 0.35 * Math.max(-1, Math.min(q - 3, 9 - q, 1)); }; return [f(0), f(8), f(4)]; })());
function render(H, cam, W, Hh, mode, faceSet = null) {
  const { mesh, chart, normals, T } = H, N = T.page, V = mesh.vertices;
  const zbuf = new Float32Array(W * Hh).fill(-Infinity), img = new Float32Array(W * Hh * 3);
  const bg = hexLin(BG); for (let i = 0; i < W * Hh; i++) img.set(bg, i * 3);
  const kindOf = mode === 'kinds' ? chart.samples.map((s) => (s ? dermisAt(s, H.D, { detail: false }).kind : null)) : null;
  const V3 = (a) => Math.hypot(...a);
  mesh.faces.forEach((tri, fi) => {
    if (faceSet && !faceSet.has(fi)) return;
    const s = tri.map((vi) => chart.samples[vi]); if (s.every((x) => !x)) return;
    const P = tri.map((v) => cam.project(V[v])), [A, B, C] = P, Nn = normals[fi], uv = T.faceUV(fi);
    const area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]); if (!area) return;
    const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
    const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(Hh - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
    const skin = s.every(Boolean);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const qx = x + 0.5, qy = y + 0.5;
      const w0 = ((B[0] - qx) * (C[1] - qy) - (B[1] - qy) * (C[0] - qx)) / area, w1 = ((C[0] - qx) * (A[1] - qy) - (C[1] - qy) * (A[0] - qx)) / area, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const d = w0 * A[2] + w1 * B[2] + w2 * C[2], o = y * W + x; if (d <= zbuf[o]) continue; zbuf[o] = d;
      let n = [0, 1, 2].map((q) => w0 * Nn[0][q] + w1 * Nn[1][q] + w2 * Nn[2][q]); const l = V3(n) || 1; n = n.map((v) => v / l);
      const NL = n[0] * cam.light[0] + n[1] * cam.light[1] + n[2] * cam.light[2], NV = Math.max(0, n[0] * cam.view[0] + n[1] * cam.view[1] + n[2] * cam.view[2]);
      let col;
      if (!skin) col = [0.85, 0.85, 0.85].map((c) => c * (0.3 + 0.7 * Math.max(0, NL)));
      else if (mode === 'kinds') { const k = kindOf[tri[[w0, w1, w2].indexOf(Math.max(w0, w1, w2))]]; col = hueOf(k).map((c) => toLinC(c) * (0.35 + 0.65 * Math.max(0, NL))); }
      else {
        const U = uv[0][0] * w0 + uv[1][0] * w1 + uv[2][0] * w2, Vv = uv[0][1] * w0 + uv[1][1] * w1 + uv[2][1] * w2;
        const alb = sampleRGBA(T.albedo, N, U, Vv).slice(0, 3).map((c) => toLinC(c / 255));
        const tr = sampleRGBA(T.translucency, N, U, Vv, 1)[0] / 255, ro = sampleRGBA(T.roughness, N, U, Vv, 1)[0] / 255, fz = sampleRGBA(T.fuzz, N, U, Vv, 1)[0] / 255;
        // the skin's cheats: the wrap (red reaches past the terminator by the thinness), a sheen by the roughness, the
        // vellus's rim
        const wrap = [0.18 + 0.5 * tr, 0.1 + 0.22 * tr, 0.08 + 0.18 * tr];
        const Hv = [0, 1, 2].map((k) => cam.light[k] + cam.view[k]), hl = V3(Hv), NH = Math.max(0, (n[0] * Hv[0] + n[1] * Hv[1] + n[2] * Hv[2]) / hl);
        const spec = 0.06 * (1 - ro) ** 2 * NH ** (2 / Math.max(0.02, ro ** 4)) * (NL > 0 ? 1 : 0), rim = 0.12 * fz * (1 - NV) ** 3;
        col = alb.map((c, k) => c * (0.22 + 0.78 * Math.max(0, (NL + wrap[k]) / (1 + wrap[k]))) + spec + rim * 0.9);
      }
      img.set(col, o * 3);
    }
  });
  return { img, zbuf };
}
const toLinC = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** strands over the surface: each segment a line, depth-tested, its alpha the hairs it stands for over a pixel; a hair
 * shader's look (diffuse by the tangent, the primary highlight white and the secondary tinted, each shifted) */
function drawStrands(R, cam, W, Hh, strands, shade, represents, kind) {
  const { img, zbuf } = R, root = hexLin(shade.root), tip = hexLin(shade.tip), tint = hexLin(shade.secondary.tint);
  const L = cam.light, Vw = cam.view, Hv = [L[0] + Vw[0], L[1] + Vw[1], L[2] + Vw[2]], hl = Math.hypot(...Hv), Hn = Hv.map((x) => x / hl);
  for (const st of strands) {
    const n = st.pts.length - 1, a = Math.min(0.95, ((represents(st) * st.r * 2 * 1000) / cam.pxMm));
    if (a < 0.004) continue;
    for (let k = 0; k < n; k++) {
      const p = st.pts[k], q = st.pts[k + 1], A = cam.project(p), B = cam.project(q);
      const t = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], tl = Math.hypot(...t) || 1, T = t.map((x) => x / tl);
      const s = (k + 0.5) / n, base = root.map((c, i) => c + (tip[i] - c) * s);
      const TL = T[0] * L[0] + T[1] * L[1] + T[2] * L[2], TH = T[0] * Hn[0] + T[1] * Hn[1] + T[2] * Hn[2];
      const diff = Math.sqrt(Math.max(0, 1 - TL * TL)), s1 = Math.sqrt(Math.max(0, 1 - (TH + shade.primary.shift) ** 2)), s2 = Math.sqrt(Math.max(0, 1 - (TH + shade.secondary.shift) ** 2));
      const sp1 = 0.35 * s1 ** (8 / shade.primary.roughness ** 2), sp2 = 0.3 * s2 ** (4 / shade.secondary.roughness ** 2);
      const col = kind === 'flow' ? [0.05, 0.05, 0.08] : base.map((c, i) => c * (0.25 + 0.75 * diff) + sp1 + sp2 * tint[i]);
      // a segment shorter than a pixel covers its share of one (its endpoint is the next segment's: drawn once)
      const lp = Math.hypot(B[0] - A[0], B[1] - A[1]), steps = Math.max(1, Math.ceil(lp)), as = a * Math.min(1, lp);
      for (let j = 0; j < steps; j++) {
        const f = j / steps, x = Math.floor(A[0] + (B[0] - A[0]) * f), y = Math.floor(A[1] + (B[1] - A[1]) * f);
        if (x < 0 || y < 0 || x >= W || y >= Hh) continue;
        const o = y * W + x, d = A[2] + (B[2] - A[2]) * f; if (d < zbuf[o] - 0.004) continue;
        for (let i = 0; i < 3; i++) img[o * 3 + i] = img[o * 3 + i] * (1 - as) + col[i] * as;
      }
    }
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
async function cellPng(x, y, png, W, Hh) { parts.push(`<image x="${x}" y="${y}" width="${W}" height="${Hh}" href="data:image/png;base64,${png.toString('base64')}"/>`); }
const boxOf = (V) => ({ min: [0, 1, 2].map((k) => Math.min(...V.map((p) => p[k]))), max: [0, 1, 2].map((k) => Math.max(...V.map((p) => p[k]))) });

for (const cast of casts) {
  const t0 = Date.now(), H = heroOf(cast), V = H.mesh.vertices;
  const scalpRep = H.scalp ? (200 * (H.S.spacing * 100) ** 2) / Math.max(1, H.S.children) : 0;
  const allStrands = [...H.body.strands, ...(H.scalp?.strands || [])];
  const represents = (st) => (st.groom === 'scalp' || st.groom === 'flyaway' ? (H.scalp?.counts?.lying ? 2 : scalpRep) : 1 / share);
  const shade = H.scalp?.shade ?? (await import('@/lib/graph/epidermis/dermal-hair.js')).hairShade(hairColourOf(H.D));
  const hairBox = boxOf([...V, ...allStrands.filter((s, i) => i % 7 === 0).flatMap((s) => s.pts)]);
  const rows = [{ mode: 'lit', box: hairBox, W: 300, Hh: 600, what: 'textured from its atlas, lit as skin, with its hair' }, { mode: 'kinds', box: hairBox, W: 300, Hh: 600, what: 'the map\'s kinds and the hair\'s flow' }];
  if (crop) {
    const names = new Set(CROPS[crop]), fs = new Set(); H.mesh.faces.forEach((tri, fi) => { const id = H.mesh.pointIds[tri[0]]; if (id && names.has(id.slice(0, id.indexOf('/')))) fs.add(fi); });
    const vs = [...fs].flatMap((fi) => H.mesh.faces[fi].map((v) => V[v])), hairV = crop === 'scalp' && H.scalp ? H.scalp.strands.filter((s, i) => i % 5 === 0).flatMap((s) => s.pts) : [];
    rows.push({ mode: 'lit', box: boxOf([...vs, ...hairV]), W: 380, Hh: 440, what: `the ${crop}, close`, faces: crop === 'scalp' ? null : null });
  }
  for (const row of rows) {
    for (const [col, v] of VIEWS.entries()) {
      const cam = camera(v.az, v.elev, row.box, row.W, row.Hh), R = render(H, cam, row.W, row.Hh, row.mode);
      if (row.mode === 'lit') drawStrands(R, cam, row.W, row.Hh, allStrands, shade, represents, 'lit');
      else drawStrands(R, cam, row.W, row.Hh, H.body.strands.filter((s, i) => i % 6 === 0), shade, () => 60, 'flow');
      await cellRaw(col * row.W, y0, toRGBA(R.img, row.W, row.Hh), row.W, row.Hh);
      label(col * row.W, y0 + row.Hh - 10, `${cast} · ${v.name} · ${cam.pxMm.toFixed(2)} mm/px`, 11);
    }
    label(0, y0 + 16, `${cast}: ${row.what}`, 13);
    sheetW = Math.max(sheetW, VIEWS.length * row.W);
    y0 += row.Hh;
  }
  // the atlas's pages and the relief tiles
  const pngs = dermalPngs(H.T), PW = 280;
  for (const [k, b] of Object.entries(pngs)) writeFileSync(path.join(out, `atlas-${cast}-${k}.png`), b);
  parts.push(`<rect x="0" y="${y0}" width="${Math.max(sheetW, 1500)}" height="${PW + 230}" fill="#faf9f7"/>`);
  let x = 0;
  for (const k of ['albedo', 'roughness', 'translucency', 'hair']) { await cellPng(x, y0 + 24, pngs[k], PW, PW); label(x, y0 + 18, `atlas · ${k}`, 12); x += PW + 8; }
  const tiles = ['body', 'face', 'glabrous'].map((c) => H.T.classes.find((q) => q.class === c) || (c === 'face' ? H.T.classes.find((q) => q.class === 'cheek') : null)).filter(Boolean);
  for (const c of tiles) {
    const tile = reliefTile(c, { px: 160, size: 10, seed: H.D.seed, age: H.D.age });
    const rgb = Buffer.alloc(160 * 160 * 3); tile.normal.forEach((v, i) => (rgb[i] = v));
    const tiled = Buffer.alloc(320 * 320 * 3); for (let yy = 0; yy < 320; yy++) for (let xx = 0; xx < 320; xx++) for (let k = 0; k < 3; k++) tiled[(yy * 320 + xx) * 3 + k] = rgb[((yy % 160) * 160 + (xx % 160)) * 3 + k];
    await cellRaw(x, y0 + 24, tiled, 320, 320, 3); label(x, y0 + 18, `relief tile · ${c.class} (2×2, 20 mm)`, 12); x += 328;
  }
  sheetW = Math.max(sheetW, x);
  const C = H.T.classes.map((c) => c.class).join(', ');
  const lines = [
    `dermis ${JSON.stringify(H.D)}`,
    `scalp ${H.S ? `${H.S.style} · ${H.S.type} · ${(H.S.length * 100).toFixed(0)} cm stretched, falls ${(H.S.length * (H.scalp.counts.shrink ?? 1) * 100).toFixed(0)} cm · ${H.scalp.counts.guides} clumps × ${H.scalp.counts.children ?? 0} · ${H.scalp.counts.strands} strands` : 'none (shaven)'}`,
    `body hair ${H.body.strands.length} strands (each stands for ${Math.round(1 / share)}): ${Object.entries(H.body.counts).map(([k, v]) => `${k} ${v.strands}`).join(', ')}`,
    `atlas ${H.T.page}² · ${H.L.mmPerTexel.toFixed(2)} mm/texel (the head ${(H.L.mmPerTexel / H.L.faceWeight).toFixed(2)}) · relief classes: ${C}`,
  ];
  lines.forEach((t, i) => label(0, y0 + PW + 60 + i * 17, t, 12));
  report[cast] = { dermis: H.D, scalp: H.S, scalpCounts: H.scalp?.counts ?? null, body: H.body.counts, mmPerTexel: H.L.mmPerTexel, classes: C.split(', '), ms: Date.now() - t0 };
  console.log(`\n${cast}:`); for (const t of lines) console.log(`  ${t}`);
  y0 += PW + 230;
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sheetW}" height="${y0}" viewBox="0 0 ${sheetW} ${y0}"><rect width="100%" height="100%" fill="${BG}"/>${parts.join('')}</svg>`;
writeFileSync(path.join(out, 'sheet.svg'), svg);
writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
const r = spawnSync('node', [path.join(REPO, '.claude/skills/view-svg/rasterize.mjs'), path.join(out, 'sheet.svg'), '--out', out, '--max', '2400'], { cwd: REPO, encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr || r.stdout); process.exit(1); }
console.log(`\n— dermis-study: ${casts.join(' + ')} → ${out} (sheet.png, sheet.svg, atlas-*.png, report.json)`);
