/**
 * Painted-landscape → raymarch. Exercises the PRODUCTIZED path the MCP output uses:
 *   composeLandscapeRaymarch(manifest) → emitThreeWorld({ raymarch }) → emitRaymarchWorld
 * i.e. exactly what /api/sketches/[ref]/world?render=raymarch renders (via resolveWorldScene).
 *
 *   cd control && node scripts/render-landscape.mjs [heartbeat] [splatch]
 *   cd control && SUNZ=0.06 LABEL=landscape-dusk node scripts/render-landscape.mjs ridge-step dusk-trio
 *     → ../lite-template/integration/0630/spike-output/landscape/<LABEL>.{html,png}
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

import { composeLandscapeRaymarch } from '../lib/graph/landscape/painted-landscape-raymarch.js';
import { emitThreeWorld } from '../lib/graph/scene/scene-three.js';
import { resolveChromium, CHROMIUM_WEBGL_ARGS } from '../lib/graph/scene/chromium.js';

const HEARTBEAT = process.argv[2] || 'chop';
const SPLATCH = process.argv[3] || 'verdure-trio';
const SUN_Z = process.env.SUNZ != null ? +process.env.SUNZ : 0.36;
const LABEL = process.env.LABEL || 'landscape';

const manifest = {
  kind: 'painted-landscape',
  heartbeat: HEARTBEAT,
  splatch: SPLATCH,
  seed: 'meadow-7',
  light: { x: 0.55, y: 0.35, z: SUN_Z },     // z < 0 → night (moon + stars)
  waterLevel: -0.55,                         // opt-in water plane (basins below this fill)
  ...(process.env.CLOUDS ? { sky: { clouds: { coverage: +process.env.CLOUDS } } } : {}),
  ...(process.env.FOREST ? { forest: { density: +process.env.FOREST || 0.6, treeline: +process.env.TREELINE || undefined } } : {}),
  ...(process.env.SWATHE ? { swathe: +process.env.SWATHE } : {}),
  title: `${HEARTBEAT} / ${SPLATCH}`,
};

const W = 1100, H = 720;
const raymarch = composeLandscapeRaymarch(manifest);
console.log(`landscape raymarch: ${HEARTBEAT} / ${SPLATCH}`);
// emitThreeWorld dispatches a `raymarch` payload straight to emitRaymarchWorld — the route's path.
const html = emitThreeWorld({ raymarch, viewBox: { width: W, height: H }, bg: '#9fb6c8', title: manifest.title, inline: true });

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../lite-template/integration/0630/spike-output/landscape');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, LABEL + '.html'), html);

const exe = await resolveChromium();
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()); });
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
  await page.goto('file://' + path.join(outDir, LABEL + '.html'), { waitUntil: 'domcontentloaded' });
  await new Promise((r) => setTimeout(r, 3500));
  const el = await page.$('#wrap');
  const shot = el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' });
  writeFileSync(path.join(outDir, LABEL + '.png'), Buffer.from(shot));
  console.log('wrote', path.join(outDir, LABEL + '.png'), '+', LABEL + '.html');
} finally {
  await browser.close().catch(() => {});
}
