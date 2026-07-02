/**
 * Foggy city IN WORLD — effects-layer P3.5: the volumetric fog composited INTO a real mojulo World.
 * One render: the rasterized three.js `fractal-city` mesh (windows, cars, trees, baked lighting) with
 * the fog as a transparent overlay pass that occludes against the city via the box-field scene SDF.
 *
 * This is the fog *in* the World — not a separate raymarch image. The fog runs in the World's native
 * z-up frame (up = z), the same coordinates as the mesh, baked WITHOUT centering so it lines up.
 *
 *   cd control && node scripts/render-foggy-city-world.mjs
 *     → ../lite-template/integration/0629/spike-output/foggy-city-world/foggy-city-world.png
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

// the rasterized mesh world (the SOLID city)
const payload = assembleFractalCityScene({ ...CITY, time: 'day', groundShadows: true, title: 'mojulo city · fog' });

// the box field for the fog occluder — NATIVE z-up coords (no centering), same frame as the mesh
const STRUCT = new Set(['building', 'anchor', 'house', 'townhouse', 'midtower', 'garage']);
const boxes = planFractalCity(CITY).boxes
  .filter((b) => STRUCT.has(b.kind) && b.z1 > (b.z0 || 0) && b.w > 0 && b.d > 0)
  .map((b) => boxFromFootprint(b, { up: 'z' }));

// the productized fog primitive — same call resolveWorldScene makes for `fog:{...}` on a world
const fog = composeVolumeFog(boxes, { up: 'z', density: 0.5, height: 8, maxDist: 150, steps: 170 });
console.log(`city: ${fog.meta.count} structural masses · overflow ${fog.meta.overflow}`);

const W = payload.viewBox?.width || 1120, H = payload.viewBox?.height || 780;
const html = emitThreeWorld({ ...payload, inline: true, fog });

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../lite-template/integration/0629/spike-output/foggy-city-world');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'foggy-city-world.html'), html);   // open in a browser: live, interactive, offline
console.log('wrote', path.join(outDir, 'foggy-city-world.html'));

const exe = await resolveChromium();
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 5000));
  const el = await page.$('#wrap');
  const shot = el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' });
  const outPng = path.join(outDir, 'foggy-city-world.png');
  writeFileSync(outPng, Buffer.from(shot));
  console.log('wrote', outPng);
} finally {
  await browser.close().catch(() => {});
}
