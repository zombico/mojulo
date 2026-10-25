#!/usr/bin/env node
/**
 * SPIKE: the resampler at scale (scene/channels/resample.js): a 40 m road, a sidewalk and long walls in painted detail
 * tiles, seen obliquely, without and with the resampler, so the repeat (or its absence) can be read.
 *
 *   cd control && node scripts/spikes/geotown/resampler.mjs → ../lite-template/integration/1021/spike-output/geotown/resampler.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { emitThreeWorld } = await import('../../../lib/graph/scene/scene-three.js');
const { detailKey, layDetail, resamplePlans } = await import('../../../lib/graph/matte-paint/detail.js');
const { normalizeTileSpec } = await import('../../../lib/graph/era/tile-specs.js');
const { surfaceTexture } = await import('../../../lib/graph/landscape/surface-textures.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS, CHROMIUM_WEBGL_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1021/spike-output/geotown');
mkdirSync(outDir, { recursive: true });
const key = (spec, metres) => { const { seed = 1, ...params } = normalizeTileSpec({ gen: 'dressed', mortar: [120, 114, 102], grit: 0.6, ...spec }).params; return detailKey(params, seed, metres, 0); };
const K = {
  asphalt: [key({ cut: 'asphalt', face: 'floor', stone: [70, 70, 72], vary: 8, spall: 0 }, 4), 4],
  walk: [key({ cut: 'pavement', face: 'floor', stone: [176, 174, 168], cols: 2, vary: 8, spall: 0 }, 3), 3],
  brick: [key({ cut: 'brick', stone: [158, 82, 62], mortar: [176, 170, 160], rows: 16, cols: 5, vary: 14, spall: 0 }, 1.2), 1.2],
  render: [key({ cut: 'render', stone: [196, 182, 156], render: [222, 212, 192], rows: 6, cols: 2, loss: 0.45 }, 3), 3],
  precast: [key({ cut: 'precast', stone: [204, 198, 186], cols: 2, rows: 1, vary: 8, spall: 0 }, 3), 3],
  setts: [key({ cut: 'setts', face: 'floor', stone: [180, 168, 150], rows: 10, cols: 8, vary: 24 }, 1.2), 1.2],
};
const quad = (c, fill, [k, m], as) => layDetail({ corners: c, fill, cornerFills: [fill, fill, fill, fill] }, { key: k, metres: m, as });
const faces = [
  quad([[0, 0, 0], [40, 0, 0], [40, 12, 0], [0, 12, 0]], '#4a4946', K.asphalt, 'floor'),
  quad([[0, 12, 0.15], [40, 12, 0.15], [40, 16, 0.15], [0, 16, 0.15]], '#b4b1aa', K.walk, 'floor'),
  quad([[0, 16, 0], [14, 16, 0], [14, 16, 9], [0, 16, 9]].reverse(), '#9c5440', K.brick, 'wall'),
  quad([[14, 16, 0], [28, 16, 0], [28, 16, 9], [14, 16, 9]].reverse(), '#d4c7ad', K.render, 'wall'),
  quad([[28, 16, 0], [40, 16, 0], [40, 16, 12], [28, 16, 12]].reverse(), '#cbc5b7', K.precast, 'wall'),
  quad([[-24, 0, 0], [0, 0, 0], [0, 16, 0], [-24, 16, 0]], '#a89a86', K.setts, 'floor'),
].map((f) => ({ ...f, normal: undefined }));
const textures = Object.fromEntries(Object.values(K).map(([k]) => [k, surfaceTexture(k)]));
const W = 860, H = 520, cams = [{ name: 'down the street', worldFraming: { cameraPosition: [-6, 6, 1.7], lookAt: [30, 13, 2.5], horizontalFov: 70 } }, { name: 'over it', worldFraming: { cameraPosition: [8, -16, 22], lookAt: [8, 10, 0], horizontalFov: 70 } }, { name: 'close on the setts and the road', worldFraming: { cameraPosition: [-4, 4, 3], lookAt: [-8, 12, 0], horizontalFov: 60 } }, { name: 'close on the walls', worldFraming: { cameraPosition: [12, 10, 2], lookAt: [14, 16, 3], horizontalFov: 70 } }];
const browser = await launchChromium({ executablePath: await resolveChromium(), args: [...CHROMIUM_LAUNCH_ARGS, ...CHROMIUM_WEBGL_ARGS] });
const cells = [];
try {
  for (const cam of cams) for (const on of [false, true]) {
    const html = emitThreeWorld({ faces, textures, ...(on ? { resample: resamplePlans(Object.keys(textures)) } : {}), cameras: [{ ...cam, worldFraming: { ...cam.worldFraming, pictureCenter: [W / 2, H / 2] } }], viewBox: { width: W, height: H }, sky: { zenith: [90, 140, 200], horizon: [207, 225, 236], day: 1, stars: 0, seed: 1 }, bg: '#cfe1ec', inline: true });
    const page = await browser.newPage(); await page.setViewport({ width: W, height: H });
    const logs = []; page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.text().slice(0, 300)); }); page.on('pageerror', (e) => logs.push(e.message));
    await page.setContent(html, { waitUntil: 'domcontentloaded' }); await new Promise((r) => setTimeout(r, 4000));
    await page.evaluate(() => { for (const q of ['#ctrl', '.ctrl', '.hint', '.controls', '.hud']) for (const e of document.querySelectorAll(q)) e.style.display = 'none'; });
    const el = await page.$('#wrap'), png = Buffer.from(el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' }));
    await page.close();
    if (logs.length) console.log(cam.name, on, 'LOGS:', logs.slice(0, 3).join(' | '));
    cells.push({ cap: `${cam.name} · ${on ? 'resampled' : 'as painted'}`, src: `data:image/png;base64,${png.toString('base64')}` });
  }
} finally { await browser.close(); }
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:13px system-ui}.r{display:grid;grid-template-columns:repeat(2,${W}px);gap:8px}img{display:block;width:${W}px}figure{margin:0}</style><div class=r>${cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.cap}</figcaption></figure>`).join('')}</div>`;
const b2 = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b2.newPage(); await p.setViewport({ width: 2 * W + 40, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 400)); writeFileSync(path.join(outDir, 'resampler.png'), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b2.close(); }
console.log('→', path.join(outDir, 'resampler.png'));
