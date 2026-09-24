/** head-detail/render.mjs — draw both heads in every expression. Wire SVGs through the native emitter
 * (lib/graph/scene/wire-svg.js) and flat-shaded colour PNGs through a small z-buffer rasterizer, so group
 * colours (sclera, iris, lids, tongue …) can be seen; wire-svg is line-only. Output lands in the gitignored
 * spike tree (override with MOJULO_SPIKE_OUT). Node only: PNGs are encoded with node:zlib.
 *   expressions.png — rows: dragon face, eye, mouth, profile; bear face, eye, mouth, profile.
 *                     columns: the EXPRESSIONS in declaration order.
 *   <head>-<expression>-<view>.png|svg, stats.json (face counts and the per-part closure audit). */
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { HEADS, EXPRESSIONS, build, toSource, carriers, frameAt, compile, vec } from './compile.mjs';
import { orbitCamera, wireSvg, projectVertices } from '../../../control/lib/graph/scene/wire-svg.js';

const { sub, add, mul, dot, cross, unit } = vec;
const OUT = resolve(process.env.MOJULO_SPIKE_OUT || fileURLToPath(new URL('../../../lite-template/integration/0924/spike-output/head-detail/', import.meta.url)));
mkdirSync(OUT, { recursive: true });
const SIZE = 900, SS = 2, BG = [247, 245, 239];
const LIGHT = unit([0.35, -0.55, 0.75]);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** flat-shaded z-buffer raster at SS× then box-downsampled: RGB rows */
function raster(src, cam, palette) {
  const P = projectVertices(src.vertices, cam); const N = SIZE * SS; const img = new Uint8Array(N * N * 3); const zb = new Float64Array(N * N).fill(Infinity);
  for (let i = 0; i < N * N; i++) img.set(BG, 3 * i);
  src.faces.forEach((f, fi) => {
    const g = src.groups[fi]; const base = g === 'LidShadow' ? hex(palette.Sclera).map((v) => v * 0.72) : hex(palette[g] || '#ff00ff'); const [a, b, c] = f.map((k) => src.vertices[k]);
    const k = 0.5 + 0.55 * Math.max(0, dot(unit(cross(sub(b, a), sub(c, a))), LIGHT)); const col = base.map((x) => Math.min(255, Math.round(x * k)));
    const [[ax, ay, az], [bx, by, bz], [cx, cy, cz]] = f.map((v) => [P[v][0] * SS, P[v][1] * SS, P[v][2]]);
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(den) < 1e-12) return;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(N - 1, Math.ceil(Math.max(ax, bx, cx))), y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(N - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5; const w0 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, w1 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den, w2 = 1 - w0 - w1;
      if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue; const z = 1 / (w0 / az + w1 / bz + w2 / cz); const idx = y * N + x;
      if (z < zb[idx]) { zb[idx] = z; img.set(col, 3 * idx); } }
  });
  return downsample(img, N, SS);
}
function downsample(img, N, s) { const M = N / s, out = new Uint8Array(M * M * 3);
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) for (let ch = 0; ch < 3; ch++) { let t = 0; for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) t += img[3 * ((y * s + dy) * N + x * s + dx) + ch]; out[3 * (y * M + x) + ch] = Math.round(t / (s * s)); }
  return out; }
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function png(rgb, w, h) {
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h); for (let y = 0; y < h; y++) Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const VIEWS = (ctr, eyeO, mouthO) => [['face', 140, 12, ctr, 1.45], ['eye', 118, 10, add(eyeO, [0, 0.01, 0.005]), 0.4], ['mouth', 145, 16, add(mouthO, [0, 0.08, -0.02]), 0.95], ['profile', 90, 4, ctr, 1.45]];
const SHEET_VIEWS = ['face', 'eye', 'mouth', 'profile']; const CELL = 300; const exprs = Object.keys(EXPRESSIONS); const heads = Object.keys(HEADS);
const sheet = new Uint8Array(exprs.length * CELL * heads.length * SHEET_VIEWS.length * CELL * 3).fill(BG[0]); const SW = exprs.length * CELL;
const stats = {};
heads.forEach((hname, hIdx) => { const head = HEADS[hname];
  const restB = carriers(head.recipe, head, {}).bone; const eyeO = frameAt(restB, 'cranium', head.regions.eye.at, 'R').origin; const mouthO = frameAt(restB, 'jaw', [2.6, 0.02], 'R').origin;
  const V = compile(head.recipe, {}, { details: false, creases: false }).vertices; const lo = [0, 1, 2].map((k) => Math.min(...V.map((v) => v[k]))), hi = [0, 1, 2].map((k) => Math.max(...V.map((v) => v[k]))); const ctr = mul(add(lo, hi), 0.5);
  exprs.forEach((ename, ei) => {
    const src = toSource(build(head, EXPRESSIONS[ename])); const name = `${hname}-${ename}`; stats[name] = { faces: src.faces.length, vertices: src.vertices.length, audit: src.audit };
    for (const [label, az, el, tgt, dist] of VIEWS(ctr, eyeO, mouthO)) {
      const cam = orbitCamera({ azimuthDegrees: az, elevationDegrees: el, target: tgt, distance: dist, focalPixels: 1400, size: SIZE });
      const rgb = raster(src, cam, head.palette); writeFileSync(`${OUT}/${name}-${label}.png`, png(rgb, SIZE, SIZE));
      if (label === 'face') writeFileSync(`${OUT}/${name}-${label}.svg`, wireSvg(src, cam, { features: Object.keys(head.palette), title: `${name} ${label}` }));
      const row = hIdx * SHEET_VIEWS.length + SHEET_VIEWS.indexOf(label); const s = SIZE / CELL;   // nearest-neighbour into the sheet cell
      for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) { const si = 3 * (Math.floor(y * s) * SIZE + Math.floor(x * s)); sheet.set(rgb.subarray(si, si + 3), 3 * ((row * CELL + y) * SW + ei * CELL + x)); }
    }
  });
});
writeFileSync(`${OUT}/expressions.png`, png(sheet, SW, heads.length * SHEET_VIEWS.length * CELL));
writeFileSync(`${OUT}/stats.json`, JSON.stringify(stats, null, 1) + '\n');
console.log(JSON.stringify({ out: OUT, sheet: 'expressions.png', columns: exprs, rows: heads.flatMap((h) => SHEET_VIEWS.map((v) => `${h}/${v}`)), audit: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, `${v.faces}f open=${v.audit.open} wind=${v.audit.badWinding}`])) }));
