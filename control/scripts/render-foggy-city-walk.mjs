/**
 * Foggy city — WALKABLE. The P3.5 fog-in-World plus emitThreeWorld's first-person WALK mode, so you
 * can walk the streets through the fog (WASD + mouse-look, gravity + wall collision). As you move, the
 * fog overlay follows the camera: nearby buildings sharpen, distant ones stay veiled (Beer–Lambert) —
 * the "camera inside the fog volume" case from effects-layer.plan.md, made interactive.
 *
 *   cd control && node scripts/render-foggy-city-walk.mjs
 *     → ../lite-template/integration/0629/spike-output/foggy-city-walk/foggy-city-walk.html  (open + click "walk")
 *     → ../lite-template/integration/0629/spike-output/foggy-city-walk/foggy-city-walk.png   (initial frame)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

import { boxFromFootprint } from '../lib/graph/effects/effects-occluder.js';
import { composeVolumeFog } from '../lib/graph/effects/effects-fog.js';
import { planFractalCity, assembleFractalCityScene } from '../lib/graph/city/fractal-city.js';
import { emitThreeWorld } from '../lib/graph/scene/scene-three.js';
import { resolveChromium, CHROMIUM_WEBGL_ARGS } from '../lib/graph/scene/chromium.js';

const CITY = { region: { x: 0, y: 0, w: 80, d: 52 }, depth: 4, seed: 5, anchor: 'tower', density: 0.9, profile: 'city', elements: { townhouses: true } };

const payload = assembleFractalCityScene({ ...CITY, time: 'day', groundShadows: true, title: 'mojulo city · walk the fog' });

const STRUCT = new Set(['building', 'anchor', 'house', 'townhouse', 'midtower', 'garage']);
const boxes = planFractalCity(CITY).boxes
  .filter((b) => STRUCT.has(b.kind) && b.z1 > (b.z0 || 0) && b.w > 0 && b.d > 0)
  .map((b) => boxFromFootprint(b, { up: 'z' }));

// the productized fog primitive — same call resolveWorldScene makes for `fog:{...}` on a world.
// lighter + taller-ceiling than the flyover so streets stay legible on foot.
const fog = composeVolumeFog(boxes, { up: 'z', density: 0.24, height: 11, maxDist: 150, steps: 160 });
console.log(`city: ${fog.meta.count} structural masses · overflow ${fog.meta.overflow}`);

const W = payload.viewBox?.width || 1120, H = payload.viewBox?.height || 780;
const html = emitThreeWorld({
  ...payload,
  inline: true,
  walk: { eye: 1.7, spawn: [40, 4] },     // street-level eye height; spawn at the front edge, looking in
  fog,
});

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../lite-template/integration/0629/spike-output/foggy-city-walk');
mkdirSync(outDir, { recursive: true });
const htmlPath = path.join(outDir, 'foggy-city-walk.html');
writeFileSync(htmlPath, html);
console.log('wrote', htmlPath, '— open it, click "walk", then WASD + mouse');

// initial-frame screenshot (orbit view; walk starts on button click). If WALK=1, drive a few WASD
// steps in pointer-lock so the PNG shows a street-level walk-through frame.
const exe = await resolveChromium();
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.goto('file://' + htmlPath, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 3500));
  if (process.env.WALK) {
    // enter walk mode + step forward a bit (pointer-lock mouse-look may not engage headless, but
    // walkOn + key movement does), to capture a street-level frame inside the fog.
    await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (b.textContent.trim() === 'walk') b.click(); });
    await new Promise((r) => setTimeout(r, 200));
    for (let i = 0; i < 30; i++) {
      await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })));
      await new Promise((r) => setTimeout(r, 60));
    }
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })));
    await new Promise((r) => setTimeout(r, 600));
  }
  const el = await page.$('#wrap');
  const shot = el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' });
  const outPng = path.join(outDir, process.env.WALK ? 'foggy-city-walk-fpv.png' : 'foggy-city-walk.png');
  writeFileSync(outPng, Buffer.from(shot));
  console.log('wrote', outPng);
} finally {
  await browser.close().catch(() => {});
}
