#!/usr/bin/env node
/**
 * SPIKE: the dressed-stone tile (matte-paint/dressed.js) beside the stone-brick pixel map it supersedes, each repeated
 * 2 × 2 (a seam would show), at the room's own metres (a 2 m repeat).
 *
 *   cd control && node scripts/spikes/matte/dressed.mjs → ../lite-template/integration/1020/spike-output/matte/dressed.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { dressedTile } = await import('../../../lib/graph/matte-paint/dressed.js');
const { encodePng, surfaceTexture } = await import('../../../lib/graph/landscape/surface-textures.js');
const { tileFamilyOf } = await import('../../../lib/graph/era/tile-specs.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1020/spike-output/matte');
mkdirSync(outDir, { recursive: true });
const url = ({ rgb, W, H }) => `data:image/png;base64,${encodePng(rgb, W, H).toString('base64')}`;
const STONE = { gen: 'stone-brick', stone: [150, 150, 150], mortar: [88, 88, 88], rows: 6, cols: 4, mortarThick: 0.1, vary: 28, grain: 11, bevel: 0.2, accent: 0.14, accentDark: 40, accentLight: 26, seed: 13 };
const cells = [{ cap: 'stone-brick (today)', src: surfaceTexture(`${tileFamilyOf(STONE)}-a`) }];
for (const [cap, cfg] of [['dressed · tooled ashlar', { stone: [176, 168, 150], mortar: [120, 114, 102] }], ['dressed · pitched, gritty', { stone: [176, 168, 150], mortar: [110, 104, 92], tool: 'pitched', grit: 0.8, spall: 0.9, rows: 5 }], ['dressed · big blocks, quiet', { stone: [176, 168, 150], mortar: [130, 124, 112], rows: 3, cols: 1, grit: 0.25, spall: 0.2, pit: 0.1 }]]) {
  const t0 = Date.now(), src = url(dressedTile(cfg, { size: 512, seed: 13 }));
  cells.push({ cap: `${cap} (${Date.now() - t0} ms)`, src });
}
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:flex;gap:12px;flex-wrap:wrap}.t{width:420px;height:420px;background-size:210px 210px;image-rendering:auto}</style>
<div style="margin-bottom:8px">each tile repeated 2 × 2 (a 2 m repeat shown at 210 px): the pixel map beside the matte-painted ashlar</div>
<div class=r>${cells.slice(1, 3).map((c) => `<figure style="margin:0"><img src="${c.src}" style="width:512px;height:512px"><figcaption>${c.cap} · one repeat at 1:1</figcaption></figure>`).join('')}</div>
<div class=r>${cells.map((c) => `<figure style="margin:0"><div class=t style="background-image:url(${c.src})"></div><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`;
writeFileSync(path.join(outDir, 'dressed.html'), page);
const browser = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await browser.newPage(); await p.setViewport({ width: 1780, height: 1100 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 500)); writeFileSync(path.join(outDir, 'dressed.png'), await p.screenshot({ type: 'png', fullPage: true })); } finally { await browser.close(); }
