/**
 * Render realistic vehicles compiled from briefs (lib/graph/car-designer: sheet → realistic.js) side by side on a
 * ground plane, one PNG per camera — the car designer's eyes-gate frames. Tooling; output where you point it.
 *
 *   cd control && node scripts/render-vehicles.mjs <out-dir> '["a compact", "lifted two-tone pickup", …]' [seed]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);
const { rollVehicleSheet } = await import('../lib/graph/car-designer/sheet.js');
const { compileRealistic } = await import('../lib/graph/car-designer/realistic.js');
const { collectFaceTextures } = await import('../lib/graph/landscape/surface-textures.js');
const { emitThreeWorld } = await import('../lib/graph/scene/scene-three.js');
const { resolveChromium, CHROMIUM_WEBGL_ARGS } = await import('../lib/graph/scene/chromium.js');

const outDir = path.resolve(process.argv[2] || '.');
const briefs = JSON.parse(process.argv[3] || '["a compact"]'), seed = Number(process.argv[4] || 3);
mkdirSync(outDir, { recursive: true });
// side by side along x, noses toward −y (the camera stands in front, three-quarter)
const faces = [];
let x = 0;
const placed = [];
for (const brief of briefs) {
  const c = compileRealistic(rollVehicleSheet({ brief, facets: { pole: 'realistic' }, seed: seed + placed.length }));
  const w = c.census.W, at = x + w / 2;
  for (const f of [...c.faces.root, ...c.faces.wheels.flatMap((q) => q.faces)]) faces.push({ ...f, corners: f.corners.map(([px, py, pz]) => [at - px, -py, pz]) });
  placed.push({ brief, at, L: c.census.L, H: c.census.H });
  x += w + 2.2;
}
const span = x - 2.2, cx = span / 2, G = 60;
faces.push({ corners: [[cx - G, -G, -0.002], [cx + G, -G, -0.002], [cx + G, G, -0.002], [cx - G, G, -0.002]], fill: '#b9b6ad' });
const look = [cx, 0, 0.9], pc = [560, 390];
const cameras = [
  { name: 'line-up', worldFraming: { cameraPosition: [cx - span * 0.2, -span * 0.95 - 6, 3.2], lookAt: look, horizontalFov: 50, pictureCenter: pc } },
  { name: 'side', worldFraming: { cameraPosition: [cx, -0.3, 1.4], lookAt: [cx, 30, 1.0], horizontalFov: 40, pictureCenter: pc } },
  { name: 'profile', worldFraming: { cameraPosition: [cx + 0.01, -span * 1.1 - 10, 1.0], lookAt: [cx, 0, 1.0], horizontalFov: 45, pictureCenter: pc } },
];
// the profile camera looks along +y at the line from the noses' side: rotate so it sees their flanks
cameras[1].worldFraming = { cameraPosition: [cx, 40, 1.3], lookAt: [cx, 0, 1.1], horizontalFov: Math.min(80, 2 * Math.atan(span / 2 / 40) * 180 / Math.PI + 6), pictureCenter: pc };
const payload = { faces, cameras, viewBox: { width: 1120, height: 780 }, title: 'mojulo vehicles', bg: '#c6cfda', sky: { preset: 'day', zenith: [96, 138, 190], horizon: [198, 207, 218], day: 1, stars: 0, seed: 7 }, metersPerUnit: 1 };
payload.textures = collectFaceTextures(payload.faces, {});
const browser = await puppeteer.launch({ executablePath: await resolveChromium(), headless: true, args: CHROMIUM_WEBGL_ARGS });
try {
  for (let i = 0; i < 2; i++) {
    const cams = [cameras[i], ...cameras.filter((_, j) => j !== i)];
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await page.setViewport({ width: 1120, height: 780, deviceScaleFactor: 1 });
    await page.setContent(emitThreeWorld({ ...payload, cameras: cams, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 5000));
    const el = await page.$('#wrap');
    const out = path.join(outDir, `${cameras[i].name}.png`);
    writeFileSync(out, Buffer.from(el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' })));
    console.log('wrote', out);
    await page.close();
  }
} finally { await browser.close().catch(() => {}); }
console.log(JSON.stringify(placed));
