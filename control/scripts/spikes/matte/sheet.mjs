#!/usr/bin/env node
/**
 * The matte-paint sheet: one stone block's face (lib/graph/matte-paint) painted from a geocube's ramps, its layers added
 * one at a time, a grit sweep, and the light turned. Shot in headless Chromium.
 *
 *   cd control && node scripts/spikes/matte/sheet.mjs [cube=gothic-night] [seed=7]
 *     → ../lite-template/integration/1020/spike-output/matte/<cube>-sheet.png (and .html)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { paintSurface } = await import('../../../lib/graph/matte-paint/index.js');
const { readGeocube, geocubeRamps, GEOCUBE_PALETTES } = await import('../../../lib/graph/era/geocube.js');
const { resolveChromium, launchChromium, CHROMIUM_LAUNCH_ARGS } = await import('../../../lib/graph/scene/chromium.js');

const [cubeId = 'gothic-night', seedArg = '7'] = process.argv.slice(2), seed = Number(seedArg);
const here = path.dirname(fileURLToPath(import.meta.url)), outDir = path.resolve(here, '../../../../lite-template/integration/1020/spike-output/matte');
mkdirSync(outDir, { recursive: true });
const cube = GEOCUBE_PALETTES[cubeId] ? readGeocube({ from: cubeId, palette: { ...GEOCUBE_PALETTES[cubeId], seed: 3 } }) : readGeocube(cubeId);
const R = geocubeRamps(cube), ramp = (k) => R[k].map((c) => (typeof c === 'string' ? c : `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`));
const outline = { shape: 'block', w: 1.2, h: 0.6 };
const paint = { ramp: ramp('stone'), mottle: { ramp: ramp('sand') }, dirt: { ramp: ramp('floor') } };
const none = { form: false, rough: false, spall: false, groove: false, pit: false };
const rows = [
  ['the layers, one at a time', [
    ['form', { relief: { ...none, form: {} }, paint: { ramp: ramp('stone'), mottle: false, fleck: false, damp: false } }],
    ['+ rough', { relief: { ...none, form: {}, rough: {} }, paint: { ramp: ramp('stone'), mottle: false, fleck: false, damp: false } }],
    ['+ spall, groove, pit', { relief: {}, paint: { ramp: ramp('stone'), mottle: false, fleck: false, damp: false } }],
    ['+ paint layers', { relief: {}, paint }],
  ]],
  ['grit', [0, 0.35, 0.7, 1].map((g) => [`grit ${g}`, { grit: g, relief: {}, paint }])],
  ['the light and the finish', [
    ['low sun from the right', { grit: 0.8, light: { az: 15, el: 14 }, paint }],
    ['from straight above', { grit: 0.8, light: { az: 90, el: 55 }, paint }],
    ['tooled', { grit: 0.3, relief: { tool: { kind: 'tooled' }, groove: false, pit: false }, paint }],
    ['pitched (rock-faced)', { grit: 0.6, relief: { tool: { kind: 'pitched' }, form: { pillow: 0.012 } }, paint: { ...paint, moss: { ramp: ramp('foliage'), amount: 0.6 } } }],
  ]],
];
const html = [];
for (const [title, cells] of rows) {
  html.push(`<h2>${title}</h2><div class=row>`);
  for (const [label, s] of cells) {
    const t0 = Date.now(), f = paintSurface({ outline, seed, ppm: 256, ...s });
    html.push(`<figure><img src="${f.url}"><figcaption>${label}<small>${f.W}×${f.H} · ${(f.png.length / 1024).toFixed(0)} KB · ${Date.now() - t0} ms</small></figcaption></figure>`);
  }
  html.push('</div>');
}
const page = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:12px 16px;background:#4e4b46;color:#eee;font:13px system-ui}h2{font-size:14px;margin:10px 0 6px;color:#d8d2c6}.row{display:flex;gap:14px}figure{margin:0}img{display:block;width:307px;background:#2f2d2a}figcaption small{display:block;color:#bdb6aa}</style><h1 style="font-size:15px;margin:0">${cube.title} · matte-painted stone block (1.2 × 0.6 m, seed ${seed})</h1>${html.join('')}`;
writeFileSync(path.join(outDir, `${cubeId}-sheet.html`), page);
const browser = await launchChromium({ executablePath: await resolveChromium(), args: CHROMIUM_LAUNCH_ARGS });
try {
  const p = await browser.newPage(); await p.setViewport({ width: 1340, height: 760 });
  await p.setContent(page); await new Promise((r) => setTimeout(r, 400));
  writeFileSync(path.join(outDir, `${cubeId}-sheet.png`), await p.screenshot({ type: 'png', fullPage: true }));
} finally { await browser.close(); }
console.log(`sheet → ${path.join(outDir, `${cubeId}-sheet.png`)}`);
