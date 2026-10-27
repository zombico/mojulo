// THE BAY'S MATERIALS (matte-paint/dressed.js, the made class): each cut painted as gen-6 draws it, and read as the
// form render's material (its colour under no light, its normal, its height), a row each, on one sheet. The machine
// gate: each cut the same bytes twice, and a relief deep enough to march (form/room-form.js PARALLAX). The look is the
// operator's.
//
//   node scripts/spikes/bay/cuts.mjs [--out <dir>] [--size 256] [--only matte,carbon]
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { dressedTile, dressedMaterial } = await import('@/lib/graph/matte-paint/dressed');
const { encodePng } = await import('@/lib/graph/landscape/surface-textures');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'bay-cuts')), size = Number(arg('--size', 256)), only = arg('--only', null)?.split(',');
// each cut in a colour its register would give it
export const CUTS = {
  plate: { cut: 'plate', stone: [78, 92, 104], mortar: [158, 160, 158], cols: 2, rows: 2, grit: 0.6 },
  tread: { cut: 'tread', face: 'floor', stone: [128, 130, 132], mortar: [60, 60, 62], cols: 1, rows: 1, grit: 0.5, metres: 1 },
  block: { cut: 'block', stone: [150, 148, 140], mortar: [120, 118, 112], cols: 5, rows: 10, grit: 0.5 },
  panel: { cut: 'panel', stone: [196, 200, 198], mortar: [40, 42, 44], cols: 2, rows: 1, grit: 0.4 },
  epoxy: { cut: 'epoxy', face: 'floor', stone: [92, 104, 112], mortar: [40, 42, 44], cols: 1, rows: 1, grit: 0.5 },
  grating: { cut: 'grating', face: 'floor', stone: [140, 142, 140], mortar: [24, 24, 26], cols: 1, rows: 1, grit: 0.5, metres: 1 },
  corrugated: { cut: 'corrugated', stone: [110, 120, 112], mortar: [80, 80, 80], cols: 12, rows: 1, grit: 0.5 },
  perforated: { cut: 'perforated', stone: [150, 156, 160], mortar: [20, 20, 22], cols: 1, rows: 1, grit: 0.4, metres: 0.5 },
  terrazzo: { cut: 'terrazzo', face: 'floor', stone: [200, 196, 186], mortar: [90, 96, 104], cols: 2, rows: 2, grit: 0.3 },
  glazed: { cut: 'glazed', stone: [210, 226, 222], mortar: [150, 156, 154], cols: 8, rows: 16, grit: 0.4, metres: 1.2 },
  studded: { cut: 'studded', face: 'floor', stone: [60, 64, 66], mortar: [40, 40, 40], cols: 1, rows: 1, grit: 0.5, metres: 1 },
  seam: { cut: 'seam', stone: [130, 60, 50], mortar: [80, 80, 80], cols: 4, rows: 1, grit: 0.5 },
  acoustic: { cut: 'acoustic', stone: [220, 218, 210], mortar: [200, 200, 196], cols: 4, rows: 4, grit: 0.4, metres: 2.4 },
  matte: { cut: 'matte', stone: [82, 92, 78], mortar: [82, 92, 78], cols: 1, rows: 2, grit: 0.5, metres: 1 },
  carbon: { cut: 'carbon', stone: [44, 46, 50], mortar: [40, 42, 46], cols: 1, rows: 1, grit: 0.3, metres: 0.5 },
  drywall: { cut: 'drywall', stone: [214, 208, 196], mortar: [200, 196, 186], cols: 2, rows: 1, grit: 0.5, metres: 2.4 },
  carpet: { cut: 'carpet', face: 'floor', stone: [84, 90, 100], mortar: [150, 140, 120], cols: 2, rows: 2, grit: 0.5, metres: 1 },
  vinyl: { cut: 'vinyl', face: 'floor', stone: [196, 190, 176], mortar: [150, 140, 124], cols: 4, rows: 4, grit: 0.5, metres: 1.2 },
  laminate: { cut: 'laminate', face: 'floor', stone: [176, 140, 100], mortar: [110, 78, 50], cols: 6, rows: 1, grit: 0.4, metres: 1.2 },
  porcelain: { cut: 'porcelain', face: 'floor', stone: [170, 168, 162], mortar: [120, 118, 112], cols: 2, rows: 2, grit: 0.4, metres: 1.2 },
  veneer: { cut: 'veneer', stone: [170, 120, 80], mortar: [40, 30, 24], cols: 2, rows: 1, grit: 0.2, metres: 1.2 },
};
const SHOWN = Object.fromEntries(Object.entries(CUTS).filter(([k]) => !only || only.includes(k)));
const W = size, cols = 4, sheet = Buffer.alloc(W * cols * W * Object.keys(SHOWN).length * 3);
const put = (rgb, col, row) => { for (let j = 0; j < W; j++) rgb.copy(sheet, ((row * W + j) * W * cols + col * W) * 3, j * W * 3, (j + 1) * W * 3); };
fs.mkdirSync(out, { recursive: true });
const report = [];
Object.entries(SHOWN).forEach(([name, cfg], row) => {
  const t0 = Date.now(), painted = dressedTile(cfg, { size, seed: 3 }).rgb, again = dressedTile(cfg, { size, seed: 3 }).rgb, M = dressedMaterial(cfg, { size, seed: 3 });
  let lo = Infinity, hi = -Infinity; for (const h of M.height) { lo = Math.min(lo, h); hi = Math.max(hi, h); }
  const hg = Buffer.alloc(W * W * 3); for (let k = 0; k < W * W; k++) hg[k * 3] = hg[k * 3 + 1] = hg[k * 3 + 2] = Math.round(((M.height[k] - lo) / (hi - lo || 1)) * 255);
  put(painted, 0, row); put(M.baseColor, 1, row); put(M.normal, 2, row); put(hg, 3, row);
  report.push({ cut: name, same: Buffer.compare(painted, again) === 0, relief: +((hi - lo) * 1000).toFixed(2), ms: Date.now() - t0 });
});
fs.writeFileSync(path.join(out, 'cuts.png'), encodePng(sheet, W * cols, W * Object.keys(SHOWN).length));
fs.writeFileSync(path.join(out, 'cuts.json'), JSON.stringify(report, null, 2));
for (const r of report) console.log(`${r.cut.padEnd(11)} same bytes ${r.same}  relief ${r.relief} mm  ${r.ms} ms`);
console.log('columns: painted (gen-6) · colour under no light · normal · height');
