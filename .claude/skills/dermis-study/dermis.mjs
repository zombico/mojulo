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

// ─── arguments ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let out = '/tmp/dermis-study', dermisSpec = {}, scalpSpec = null, epiSpec = 'default', cells = 110, page = 1024;
const sexes = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--dermis') { dermisSpec = JSON.parse(args[++i]); continue; }
  if (a === '--scalp') { const v = args[++i]; scalpSpec = v.trim().startsWith('{') ? JSON.parse(v) : v; continue; }
  if (a === '--epidermis') { const v = args[++i]; epiSpec = v.trim().startsWith('{') ? JSON.parse(v) : v; continue; }
  if (a === '--cells') { cells = Number(args[++i]); continue; }
  if (a === '--page') { page = Number(args[++i]); continue; }
  if (a === '--out') { out = args[++i]; continue; }
  if (a === 'male' || a === 'female') { sexes.push(a); continue; }
  throw new Error(`dermis-study: unknown argument ${a}`);
}
if (!sexes.length) sexes.push('male', 'female');
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
function headOf(sex) {
  const t0 = Date.now();
  const head = relationalHead({ sex, tune: true }), chart = relationalHeadChart(head, { cells });
  const D = readDermis({ from: sex, ...dermisSpec });
  const word = scalpSpec ?? (sex === 'female' ? 'shoulder' : 'short'), S = word === 'none' ? null : readScalp(word);
  const L = layoutDermis(chart, { page }), T = paintDermis(chart, D, L, { scalp: !!S });
  const scalp = S ? growScalp(chart, D, S, { colliders: ['head'] }) : null;
  const beard = growBodyHair(chart, D, { share: 0.5, tracts: ['beard'] });
  // the cube's brows and lashes, in the head's STAND units → metres
  const epi = growEpidermis(head, readEpidermis(epiSpec));
  const brows = epi.strands.map((s) => ({ ...s, pts: s.pts.map((p) => [p.x * STAND_M, p.y * STAND_M, p.z * STAND_M]), r: s.r * STAND_M }));
  return { head, chart, D, S, L, T, scalp, beard, brows, epiColour: epi.colour, ms: Date.now() - t0 };
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
function render(H, cam, W, Hh, mode) {
  const { chart, T, head } = H, N = [T.page, T.pageH], V = chart.vertices, Nv = chart.normals;
  const zbuf = new Float32Array(W * Hh).fill(-Infinity), img = new Float32Array(W * Hh * 3);
  const bg = hexLin(BG); for (let i = 0; i < W * Hh; i++) img.set(bg, i * 3);
  const kinds = mode === 'kinds' ? chart.samples.map((s) => (s ? dermisAt(s, H.D, { detail: false }).kind : null)) : null;
  chart.faces.forEach((tri, fi) => {
    const P = tri.map((v) => cam.project(V[v])), [A, B, C] = P, uv = T.faceUV(fi);
    const area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]); if (!area) return;
    const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
    const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(Hh - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
    const skin = tri.every((vi) => chart.samples[vi]);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const qx = x + 0.5, qy = y + 0.5;
      const w0 = ((B[0] - qx) * (C[1] - qy) - (B[1] - qy) * (C[0] - qx)) / area, w1 = ((C[0] - qx) * (A[1] - qy) - (C[1] - qy) * (A[0] - qx)) / area, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const d = w0 * A[2] + w1 * B[2] + w2 * C[2], o = y * W + x; if (d <= zbuf[o]) continue; zbuf[o] = d;
      let n = [0, 1, 2].map((q) => w0 * Nv[tri[0]][q] + w1 * Nv[tri[1]][q] + w2 * Nv[tri[2]][q]); const l = Math.hypot(...n) || 1; n = n.map((v) => v / l);
      const NL = n[0] * cam.light[0] + n[1] * cam.light[1] + n[2] * cam.light[2], NV = Math.max(0, n[0] * cam.view[0] + n[1] * cam.view[1] + n[2] * cam.view[2]);
      const Hv = [0, 1, 2].map((k) => cam.light[k] + cam.view[k]), hl = Math.hypot(...Hv), NH = Math.max(0, (n[0] * Hv[0] + n[1] * Hv[1] + n[2] * Hv[2]) / hl);
      let col;
      if (!skin) {
        // the globe: its paint at the point (the head's own), glossy
        const p = [0, 1, 2].map((k) => (w0 * V[tri[0]][k] + w1 * V[tri[1]][k] + w2 * V[tri[2]][k]) / STAND_M), t = head.paint({ x: p[0], y: p[1], z: p[2] });
        const base = t === 'pupil' ? PUPIL : t === 'iris' ? IRIS : SCLERA;
        col = base.map((c) => c * (0.35 + 0.65 * Math.max(0, NL)) + 0.5 * NH ** 200);
      } else if (mode === 'kinds') { const k = kinds[tri[[w0, w1, w2].indexOf(Math.max(w0, w1, w2))]]; col = hueOf(k).map((c) => toLin(c) * (0.35 + 0.65 * Math.max(0, NL))); }
      else {
        const U = uv[0][0] * w0 + uv[1][0] * w1 + uv[2][0] * w2, Vv = uv[0][1] * w0 + uv[1][1] * w1 + uv[2][1] * w2;
        const alb = sample(T.albedo, N, U, Vv).slice(0, 3).map((c) => toLin(c / 255));
        const tr = sample(T.translucency, N, U, Vv, 1)[0] / 255, ro = sample(T.roughness, N, U, Vv, 1)[0] / 255, fz = sample(T.fuzz, N, U, Vv, 1)[0] / 255;
        // the skin's cheats: the wrap (red reaches past the terminator by the thinness), the sheen, the vellus's rim
        const wrap = [0.18 + 0.5 * tr, 0.1 + 0.22 * tr, 0.08 + 0.18 * tr];
        const spec = 0.07 * (1 - ro) ** 2 * NH ** (2 / Math.max(0.02, ro ** 4)) * (NL > 0 ? 1 : 0), rim = 0.12 * fz * (1 - NV) ** 3;
        col = alb.map((c, k) => c * (0.22 + 0.78 * Math.max(0, (NL + wrap[k]) / (1 + wrap[k]))) + spec + rim * 0.9);
      }
      img.set(col, o * 3);
    }
  });
  return { img, zbuf };
}

/** strands: each segment a line, depth-tested, its alpha the hairs it stands for over a pixel (a segment shorter than a
 * pixel its share of one), lit by a hair shader (diffuse by the tangent, the primary highlight white and the secondary
 * tinted, each shifted) */
function drawStrands(R, cam, W, Hh, strands, shade, represents, flat = null) {
  const { img, zbuf } = R, root = hexLin(shade.root), tip = hexLin(shade.tip), tint = hexLin(shade.secondary.tint);
  const L = cam.light, Vw = cam.view, Hv = [L[0] + Vw[0], L[1] + Vw[1], L[2] + Vw[2]], hl = Math.hypot(...Hv), Hn = Hv.map((x) => x / hl);
  for (const st of strands) {
    const n = st.pts.length - 1, a = Math.min(0.95, (represents(st) * st.r * 2 * 1000) / cam.pxMm);
    if (a < 0.003) continue;
    for (let k = 0; k < n; k++) {
      const p = st.pts[k], q = st.pts[k + 1], A = cam.project(p), B = cam.project(q);
      const t = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], tl = Math.hypot(...t) || 1, T = t.map((x) => x / tl);
      const s = (k + 0.5) / n, base = root.map((c, i) => c + (tip[i] - c) * s);
      const TL = T[0] * L[0] + T[1] * L[1] + T[2] * L[2], TH = T[0] * Hn[0] + T[1] * Hn[1] + T[2] * Hn[2];
      const diff = Math.sqrt(Math.max(0, 1 - TL * TL)), s1 = Math.sqrt(Math.max(0, 1 - (TH + shade.primary.shift) ** 2)), s2 = Math.sqrt(Math.max(0, 1 - (TH + shade.secondary.shift) ** 2));
      const sp1 = 0.35 * s1 ** (8 / shade.primary.roughness ** 2), sp2 = 0.3 * s2 ** (4 / shade.secondary.roughness ** 2);
      const col = flat || base.map((c, i) => c * (0.25 + 0.75 * diff) + sp1 + sp2 * tint[i]);
      const lp = Math.hypot(B[0] - A[0], B[1] - A[1]), steps = Math.max(1, Math.ceil(lp)), as = a * Math.min(1, lp);
      for (let j = 0; j < steps; j++) {
        const f = j / steps, x = Math.floor(A[0] + (B[0] - A[0]) * f), y = Math.floor(A[1] + (B[1] - A[1]) * f);
        if (x < 0 || y < 0 || x >= W || y >= Hh) continue;
        const o = y * W + x, d = A[2] + (B[2] - A[2]) * f; if (d < zbuf[o] - 0.0015) continue;
        for (let i = 0; i < 3; i++) img[o * 3 + i] = img[o * 3 + i] * (1 - as) + col[i] * as;
      }
    }
  }
}
/**
 * The CARDS, as an engine draws them: each a ribbon (two triangles a segment) carrying a strand-alpha texture made here
 * (a dozen strands across it, each its own width and its own end, fading in at the root over the scalp paint), lit by
 * the hair shader along the card's own direction, the section cards (the inner layer) darker; drawn back to front over
 * the skin (depth-tested against it), blended by their alpha.
 */
function drawCards(R, cam, W, Hh, cards, shade, seed) {
  const { img, zbuf } = R, root = hexLin(shade.root), tip = hexLin(shade.tip), tint = hexLin(shade.secondary.tint);
  const L = cam.light, Vw = cam.view, Hv = [L[0] + Vw[0], L[1] + Vw[1], L[2] + Vw[2]], hl = Math.hypot(...Hv), Hn = Hv.map((x) => x / hl);
  const hash = (a, b) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(seed | 0, 2246822519); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const STR = 12;
  const alphaAt = (ci, u, v) => {
    // the strands across the card: each at its own place, width and end (ragged tips), thinning toward its end
    let a = 0;
    const k0 = Math.floor(u * STR);
    for (let k = Math.max(0, k0 - 1); k <= Math.min(STR - 1, k0 + 1); k++) {
      const c = (k + 0.2 + 0.6 * hash(ci, k)) / STR, w = (0.35 + 0.5 * hash(k, ci + 7)) / STR, end = 1 - 0.35 * hash(ci + 3, k) ** 2;
      if (v > end) continue;
      const d = Math.abs(u - c) / (w * (1 - 0.6 * v / end));
      a = Math.max(a, Math.max(0, 1 - d * d));
    }
    return a * Math.min(1, v / 0.04) * (1 - smoothEdge(u));
  };
  const smoothEdge = (u) => { const e = Math.min(u, 1 - u); return e > 0.08 ? 0 : 1 - e / 0.08; };
  const order = cards.map((c, i) => ({ i, d: c.pts.reduce((a, p) => a + cam.project(p)[2], 0) / c.pts.length })).sort((a, b) => a.d - b.d);
  for (const { i: ci } of order) {
    const c = cards[ci], dark = c.level === 'section' ? 0.62 : 1, N = c.pts.length - 1;
    for (let k = 0; k < N; k++) {
      const p = c.pts[k], q = c.pts[k + 1], t = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], tl = Math.hypot(...t) || 1, T = t.map((x) => x / tl);
      const TL = T[0] * L[0] + T[1] * L[1] + T[2] * L[2], TH = T[0] * Hn[0] + T[1] * Hn[1] + T[2] * Hn[2];
      const diff = Math.sqrt(Math.max(0, 1 - TL * TL)), s1 = Math.sqrt(Math.max(0, 1 - (TH + shade.primary.shift) ** 2)), s2 = Math.sqrt(Math.max(0, 1 - (TH + shade.secondary.shift) ** 2));
      const sp1 = 0.3 * s1 ** (8 / shade.primary.roughness ** 2), sp2 = 0.25 * s2 ** (4 / shade.secondary.roughness ** 2);
      const corner = (j, side) => { const m = c.pts[j], h = c.width[j] / 2 * side; return [m[0] + c.side[j][0] * h, m[1] + c.side[j][1] * h, m[2] + c.side[j][2] * h]; };
      const quad = [[corner(k, -1), 0, c.v[k]], [corner(k, 1), 1, c.v[k]], [corner(k + 1, 1), 1, c.v[k + 1]], [corner(k + 1, -1), 0, c.v[k + 1]]].map(([P3, u, v]) => ({ P: cam.project(P3), u, v }));
      for (const tri of [[quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]]) {
        const [A, B, C] = tri.map((x) => x.P), area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]); if (!area) continue;
        const x0 = Math.max(0, Math.floor(Math.min(A[0], B[0], C[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(A[0], B[0], C[0])));
        const y0 = Math.max(0, Math.floor(Math.min(A[1], B[1], C[1]))), y1 = Math.min(Hh - 1, Math.ceil(Math.max(A[1], B[1], C[1])));
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const qx = x + 0.5, qy = y + 0.5;
          const w0 = ((B[0] - qx) * (C[1] - qy) - (B[1] - qy) * (C[0] - qx)) / area, w1 = ((C[0] - qx) * (A[1] - qy) - (C[1] - qy) * (A[0] - qx)) / area, w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const o = y * W + x, d = w0 * A[2] + w1 * B[2] + w2 * C[2]; if (d < zbuf[o] - 0.001) continue;
          const u = w0 * tri[0].u + w1 * tri[1].u + w2 * tri[2].u, v = w0 * tri[0].v + w1 * tri[1].v + w2 * tri[2].v;
          const a = alphaAt(ci, u, v) * (c.level === 'section' ? 0.9 : 0.85); if (a < 0.01) continue;
          const col = root.map((r0, i) => (r0 + (tip[i] - r0) * v) * dark * (0.25 + 0.75 * diff) + (sp1 + sp2 * tint[i]) * dark);
          for (let i = 0; i < 3; i++) img[o * 3 + i] = img[o * 3 + i] * (1 - a) + col[i] * a;
        }
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
const cellPng = (x, y, png, W, Hh) => parts.push(`<image x="${x}" y="${y}" width="${W}" height="${Hh}" href="data:image/png;base64,${png.toString('base64')}"/>`);
const boxOf = (V) => ({ min: [0, 1, 2].map((k) => Math.min(...V.map((p) => p[k]))), max: [0, 1, 2].map((k) => Math.max(...V.map((p) => p[k]))) });
/** a box about a mark's 3D point (metres), `r` across */
const boxAt = (c, r) => ({ min: c.map((v) => v - r), max: c.map((v) => v + r) });
const m3 = (p) => [p.x * STAND_M, p.y * STAND_M, p.z * STAND_M];

for (const sex of sexes) {
  const H = headOf(sex), V = H.chart.vertices, Lm = H.head.landmarks;
  const shade = H.scalp?.shade ?? hairShade(hexLin(H.epiColour));
  const hair = [...(H.scalp?.strands || []), ...H.beard.strands], fine = H.brows, cards = H.scalp?.cards || [];
  const rep = (st) => (st.groom === 'scalp' ? 2 : st.groom === 'flyaway' ? 3 : st.groom === 'beard' ? 2 : 1);
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
      if (row.hair) { drawCards(R, cam, row.W, row.Hh, cards, shade, H.D.seed); drawStrands(R, cam, row.W, row.Hh, hair, shade, rep); }
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
  for (const [k, b] of Object.entries(pngs)) writeFileSync(path.join(out, `atlas-${sex}-${k}.png`), b);
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
    `scalp ${H.S ? `${H.S.style} · ${H.S.type} · ${(H.S.length * 100).toFixed(0)} cm stretched, falls ${(H.S.length * (H.scalp.counts.shrink ?? 1) * 100).toFixed(0)} cm · ${H.scalp.counts.lying ? `lying, ${H.scalp.counts.strands} strands` : `${H.scalp.counts.clumps} named clumps → ${H.scalp.counts.sections} sections → ${H.scalp.counts.leaves} leaves · ${H.scalp.counts.cards} cards · ${H.scalp.counts.strands} flyaways`}` : 'none (shaven)'}`,
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
