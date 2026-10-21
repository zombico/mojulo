#!/usr/bin/env node
/**
 * SPIKE: the painted cloud band (matte-paint/sky.js) for each weather at three hours of one cube, unrolled over its
 * dome's gradient (a front half: azimuth 0…180°).
 *
 *   cd control && node scripts/spikes/sky/bands.mjs [cube] → ../lite-template/integration/1020/spike-output/sky/bands.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { readGeocube } = await import('../../../lib/graph/era/geocube.js');
const { hourLight } = await import('../../../lib/graph/era/geocube-hours.js');
const { sunDir } = await import('../../../lib/graph/era/sun.js');
const { paintCloudBand, WEATHERS } = await import('../../../lib/graph/matte-paint/sky.js');
const { encodePngRgba } = await import('../../../lib/graph/landscape/surface-textures.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1020/spike-output/sky');
mkdirSync(outDir, { recursive: true });
const cube = readGeocube(process.argv[2] || 'limestone-crags'), rows = [];
for (const hour of [12, 17.5, 23]) {
  const L = hourLight(cube, hour), sun = sunDir(L.key.elevation, L.key.azimuth);
  for (const kind of Object.keys(WEATHERS)) {
    const t0 = Date.now(), B = paintCloudBand({ weather: { kind, cover: 0.5, seed: 1 }, sun, key: L.key.color, zenith: L.dome.zenith, horizon: L.dome.horizon, night: L.night });
    const ms = Date.now() - t0, png = encodePngRgba(B.rgba, B.W, B.H);
    rows.push({ cap: `${hour}h · ${kind} · ${ms} ms · ${(png.length / 1024).toFixed(0)} KB · sun az ${L.key.azimuth}`, src: `data:image/png;base64,${png.toString('base64')}`, zen: L.dome.zenith, hor: L.dome.horizon });
  }
}
const g = (r) => `linear-gradient(to bottom, rgb(${r.zen.join(',')}), rgb(${r.hor.join(',')}))`;
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px;background:#2b2a28;color:#ddd;font:12px system-ui}.b{width:1536px;height:192px;background-size:3072px 192px;background-position:0 0}figure{margin:0 0 8px}</style>
${rows.map((r) => `<figure><div class=b style="background-image:url(${r.src}),${g(r)};background-size:3072px 192px,auto"></div><figcaption>${r.cap}</figcaption></figure>`).join('')}`;
writeFileSync(path.join(outDir, 'bands.html'), page);
const b = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try { const p = await b.newPage(); await p.setViewport({ width: 1570, height: 900 }); await p.setContent(page); await new Promise((r) => setTimeout(r, 500)); writeFileSync(path.join(outDir, 'bands.png'), await p.screenshot({ type: 'png', fullPage: true })); } finally { await b.close(); }
console.log(rows.map((r) => r.cap).join('\n'));
