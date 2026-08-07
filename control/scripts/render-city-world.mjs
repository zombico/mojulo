/**
 * The same fractal-city rendered as a normal mojulo WORLD — the rasterized three.js mesh path
 * (assembleFractalCityScene → emitThreeWorld), exactly what /api/sketches/[ref]/world serves. This
 * is the SOLID world the effects layer (foggy-city.png) is layered over — rendered here so the two
 * can be compared side by side.
 *
 *   cd control && node scripts/render-city-world.mjs
 *     → ../lite-template/integration/0629/spike-output/foggy-city/city-world.png
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

import { assembleFractalCityScene } from '../lib/graph/city/fractal-city.js';
import { emitThreeWorld } from '../lib/graph/scene/scene-three.js';
import { resolveChromium, CHROMIUM_WEBGL_ARGS } from '../lib/graph/scene/chromium.js';

// same city as the foggy-city render
const payload = assembleFractalCityScene({
  region: { x: 0, y: 0, w: 80, d: 52 },
  depth: 4, seed: 5, anchor: 'tower', density: 0.9, profile: 'city', elements: { townhouses: true },
  time: 'day', groundShadows: true, title: 'mojulo city',
});

const W = payload.viewBox?.width || 1120, H = payload.viewBox?.height || 780;
const html = emitThreeWorld({ ...payload, inline: true });

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../lite-template/integration/0629/spike-output/foggy-city');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'city-world.html'), html);   // open in a browser: live, interactive, offline
console.log('wrote', path.join(outDir, 'city-world.html'));

const exe = await resolveChromium();
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 4500));   // WebGL init + first render
  const el = await page.$('#wrap');
  const shot = el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' });
  const outPng = path.join(outDir, 'city-world.png');
  writeFileSync(outPng, Buffer.from(shot));
  console.log('wrote', outPng);
} finally {
  await browser.close().catch(() => {});
}
