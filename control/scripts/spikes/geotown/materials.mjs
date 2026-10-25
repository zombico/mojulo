#!/usr/bin/env node
/**
 * SPIKE: the two classes of a cube's built materials (matte-paint/dressed.js), each repeated 2 × 2 (a seam would show):
 * the ANCIENT (hand-worked, lime-bound: render over stone, ashlar, clay tile, boards, flags) and the MODERN (machine-made,
 * cement-bound: wire-cut brick, board-formed concrete, precast panels, stucco, sawn stone, a concrete sidewalk).
 *
 *   cd control && node scripts/spikes/geotown/materials.mjs → ../lite-template/integration/1021/spike-output/geotown/materials.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { dressedTile } = await import('../../../lib/graph/matte-paint/dressed.js');
const { encodePng } = await import('../../../lib/graph/landscape/surface-textures.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1021/spike-output/geotown');
mkdirSync(outDir, { recursive: true });
const stone = [196, 182, 156], mortar = [140, 128, 110], grit = 0.6;
const ROWS = {
  ancient: [['lime render over stone', { cut: 'render', render: [222, 212, 192], rows: 6, cols: 2, loss: 0.45, metres: 3 }], ['ashlar, tooled', { rows: 5, cols: 2, metres: 2.4 }], ['clay tile', { cut: 'tile', stone: [178, 96, 70], rows: 10, cols: 8, metres: 2 }], ['flagstones', { face: 'floor', rows: 3, cols: 3, tool: 'none', metres: 1.8 }], ['setts', { cut: 'setts', face: 'floor', rows: 10, cols: 8, vary: 24, metres: 1.2 }]],
  modern: [['wire-cut brick', { cut: 'brick', stone: [158, 82, 62], mortar: [176, 170, 160], rows: 16, cols: 5, vary: 14, metres: 1.2 }], ['board-formed concrete', { cut: 'concrete', stone: [168, 166, 160], cols: 2, rows: 1, vary: 10, metres: 2.4 }], ['precast panels', { cut: 'precast', stone: [204, 198, 186], cols: 2, rows: 1, vary: 8, metres: 3 }], ['stucco', { cut: 'stucco', render: [214, 200, 178], metres: 3 }], ['sawn stone', { rows: 4, cols: 2, tool: 'none', joint: 0.005, recess: 0.002, chamfer: 0.003, pillow: 0.0005, spall: 0, pit: 0.05, vary: 10, metres: 2.4 }], ['concrete sidewalk', { cut: 'pavement', stone: [176, 174, 168], cols: 2, vary: 8, metres: 3 }], ['asphalt', { cut: 'asphalt', stone: [70, 70, 72], vary: 8, metres: 4 }]],
};
const rows = [];
for (const [cls, list] of Object.entries(ROWS)) {
  const cells = [];
  for (const [cap, cfg] of list) {
    const t0 = Date.now(), T = dressedTile({ stone, mortar, grit, ...cfg }, { size: 512, seed: 13 });
    cells.push({ cap: `${cap} · ${cfg.metres} m (${Date.now() - t0} ms)`, src: `data:image/png;base64,${encodePng(T.rgb, T.W, T.H).toString('base64')}` });
  }
  rows.push({ cls, cells });
}
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}.t{width:300px;height:300px;background-size:150px 150px}h3{margin:6px 0;font-weight:500}</style>
${rows.map((r) => `<h3>${r.cls}</h3><div class=r>${r.cells.map((c) => `<figure style="margin:0"><div class=t style="background-image:url(${c.src})"></div><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`).join('')}
<h3>modern, 1:1</h3><div class=r>${rows[1].cells.map((c) => `<figure style="margin:0"><img src="${c.src}" style="width:300px"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`;
const b = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b.newPage(); await p.setViewport({ width: 1900, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, 'materials.png'), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b.close(); }
console.log(rows.flatMap((r) => r.cells.map((c) => c.cap)).join('\n'));
