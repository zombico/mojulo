#!/usr/bin/env node
/**
 * SPIKE: a town's walls painted from relief (matte-paint/dressed.js): lime render fallen away to the ashlar at three
 * losses, and the ashlar, each repeated 2 × 2 (a seam would show), in a cube's stone.
 *
 *   cd control && node scripts/spikes/geotown/walls.mjs → ../lite-template/integration/1021/spike-output/geotown/walls.png
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
const stone = [196, 182, 156], mortar = [140, 128, 110], render = [222, 212, 192];
const cells = [];
const clay = [178, 96, 70], slateC = [96, 100, 108], wood = [140, 104, 72];
for (const [cap, cfg] of [['render · loss 0.2', { cut: 'render', loss: 0.2, grit: 0.5 }], ['render · loss 0.5', { cut: 'render', loss: 0.5, grit: 0.7 }], ['render · loss 0.8', { cut: 'render', loss: 0.8, grit: 0.85 }], ['ashlar · pitched', { tool: 'pitched', grit: 0.85 }],
  ['tile · pantiles', { cut: 'tile', stone: clay, rows: 10, cols: 8, grit: 0.7 }], ['slate', { cut: 'slate', stone: slateC, rows: 12, cols: 6, grit: 0.7 }], ['boards', { cut: 'boards', stone: wood, cols: 9, grit: 0.7 }]]) {
  const t0 = Date.now(), T = dressedTile({ stone, mortar, render, rows: 5, cols: 2, metres: 2, ...cfg }, { size: 512, seed: 13 });
  cells.push({ cap: `${cap} (${Date.now() - t0} ms)`, src: `data:image/png;base64,${encodePng(T.rgb, T.W, T.H).toString('base64')}` });
}
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:flex;gap:12px;flex-wrap:wrap}.t{width:400px;height:400px;background-size:200px 200px}</style>
<div style="margin-bottom:8px">each 2 m repeat shown twice across (a seam would show)</div><div class=r>${cells.map((c) => `<figure style="margin:0"><div class=t style="background-image:url(${c.src})"></div><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>
<div class=r style="margin-top:12px">${cells.slice(4).map((c) => `<figure style="margin:0"><img src="${c.src}" style="width:400px"><figcaption>${c.cap} · 1:1</figcaption></figure>`).join('')}</div>`;
const b = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b.newPage(); await p.setViewport({ width: 1700, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, 'walls.png'), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b.close(); }
console.log(cells.map((c) => c.cap).join(' · '));
