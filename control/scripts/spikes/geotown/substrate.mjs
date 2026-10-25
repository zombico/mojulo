#!/usr/bin/env node
/**
 * SPIKE: what the ground is (era/substrate.js), from above — a stage's land cell by cell in its substrate's colour, per
 * set, with its shares: for the substrate rules and the formations' turn.
 *
 *   cd control && node scripts/spikes/geotown/substrate.mjs [name] [stage-json|caption …]
 *     → ../lite-template/integration/1021/spike-output/geotown/<name>.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { substrateOf } = await import('../../../lib/graph/era/substrate-of.js');
const { SUBSTRATE_IDS } = await import('../../../lib/graph/era/substrate.js');
const { encodePng } = await import('../../../lib/graph/landscape/surface-textures.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1021/spike-output/geotown');
mkdirSync(outDir, { recursive: true });
const [name = 'substrate', ...sets] = process.argv.slice(2);
const M = { kind: 'stage', kit: 'isekai-meadow' };
const SETS = sets.length ? sets.map((s) => s.split('|')) : [
  [JSON.stringify({ ...M, trail: {} }), 'a trail (no formation)'],
  [JSON.stringify({ ...M, trail: { beats: ['crossing', 'reveal', 'pocket', 'landmark'] } }), 'a trail with a crossing'],
  [JSON.stringify({ ...M, trail: {}, shading: { grit: 0.7, skin: 'limestone' } }), 'limestone'],
  [JSON.stringify({ ...M, trail: {}, shading: { grit: 0.7, skin: 'sandstone' } }), 'sandstone'],
  [JSON.stringify({ ...M, trail: {}, shading: { grit: 0.7, skin: 'flagstone' } }), 'flagstone'],
];
const COLOUR = { bedrock: [110, 108, 116], scree: [168, 160, 150], soil: [96, 150, 70], sand: [228, 204, 140], wet: [70, 130, 190], path: [176, 130, 96] };
const PX = 3, cells = [];
for (const [json, caption] of SETS) {
  const S = substrateOf(JSON.parse(json)), W = S.nx * PX, H = S.ny * PX, rgb = Buffer.alloc(W * H * 3, 30);
  for (let j = 0; j < S.ny; j++) for (let i = 0; i < S.nx; i++) {
    const k = S.cells[j * S.nx + i]; if (k === 255) continue;
    const c = COLOUR[SUBSTRATE_IDS[k]];
    // (y up the page: the trail's start at the foot)
    for (let dy = 0; dy < PX; dy++) for (let dx = 0; dx < PX; dx++) { const o = ((H - 1 - (j * PX + dy)) * W + i * PX + dx) * 3; rgb[o] = c[0]; rgb[o + 1] = c[1]; rgb[o + 2] = c[2]; }
  }
  cells.push({ caption: caption ?? json, src: `data:image/png;base64,${encodePng(rgb, W, H).toString('base64')}`, shares: S.shares });
  console.log(caption, JSON.stringify(S.shares));
}
const legend = SUBSTRATE_IDS.map((k) => `<span><i style="background:rgb(${COLOUR[k]})"></i>${k}</span>`).join('');
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:flex;gap:12px;flex-wrap:wrap}figure{margin:0}img{display:block;image-rendering:pixelated}small{display:block;color:#aaa;max-width:360px}.l span{margin-right:14px}.l i{display:inline-block;width:12px;height:12px;margin-right:4px;vertical-align:-2px}</style>
<div class=l>${legend}</div><br><div class=r>${cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.caption}<small>${SUBSTRATE_IDS.filter((k) => c.shares[k]).map((k) => `${k} ${Math.round(c.shares[k] * 100)}%`).join(' · ')}</small></figcaption></figure>`).join('')}</div>`;
writeFileSync(path.join(outDir, `${name}.html`), page);
const b = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b.newPage(); await p.setViewport({ width: 1900, height: 700 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 300)); writeFileSync(path.join(outDir, `${name}.png`), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b.close(); }
console.log('→', path.join(outDir, `${name}.png`));
