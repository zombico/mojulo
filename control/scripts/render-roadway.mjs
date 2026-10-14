/**
 * Render the roadway world's preset cameras (roads/roadway.js → emitThreeWorld), one PNG each —
 * the eyes-gate frames for road-affordances. Spike tooling; output under the plan's spike-output.
 *
 *   cd control && node scripts/render-roadway.mjs [out-dir] ['{"express":4,…}']
 *   CAMS=driver,aerial limits the shots; FILTER='<js expr over f>' keeps only matching faces (debug).
 *   MAP=1 renders the inspectable map instead (map.html, map.png, and map-zoom.png: the overpass
 *   window with a vehicle inspected).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
register(pathToFileURL(path.join(here, 'mcp-stdio-loader.mjs')).href);
const { assembleRoadwayScene } = await import('../lib/graph/roads/roadway.js');
const { collectFaceTextures } = await import('../lib/graph/landscape/surface-textures.js');
const { emitThreeWorld } = await import('../lib/graph/scene/scene-three.js');
const { resolveChromium, CHROMIUM_WEBGL_ARGS } = await import('../lib/graph/scene/chromium.js');
const { planRoadway } = await import('../lib/graph/roads/roadway.js');
const { roadwayMapData, renderRoadwayMap } = await import('../lib/graph/roads/roadway-map.js');

const outDir = path.resolve(process.argv[2] || '../lite-template/integration/0927/spike-output/roadway');
const recipe = process.argv[3] ? JSON.parse(process.argv[3]) : {};
mkdirSync(outDir, { recursive: true });
if (process.env.MAP) {
  const html = renderRoadwayMap(roadwayMapData(planRoadway(recipe), { title: 'Highway 401 by Pearson' }), { worldHref: '/world' });
  writeFileSync(path.join(outDir, 'map.html'), html);
  const browser = await puppeteer.launch({ executablePath: await resolveChromium(), headless: true, args: CHROMIUM_WEBGL_ARGS });
  try {
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 400));
    writeFileSync(path.join(outDir, 'map.png'), await page.screenshot({ type: 'png', fullPage: true }));
    // zoom to the overpass window, hover a station, click the nearest vehicle
    await page.evaluate(() => { const o = DATA.structures.find((s) => s.kind === 'overpass'); v0 = o.s - 160; v1 = o.s + 120; hover = o.s - 60; draw(); });
    const rect = await page.$$eval('#sld rect.hit', (els) => { const w = els.filter((e) => e.getAttribute('rx') != null && +e.getAttribute('width') > 20); const b = w[Math.floor(w.length / 2)].getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; });
    await page.mouse.click(rect[0], rect[1]);
    await new Promise((r) => setTimeout(r, 200));
    writeFileSync(path.join(outDir, 'map-zoom.png'), await page.screenshot({ type: 'png', fullPage: true }));
    console.log('wrote map.html, map.png, map-zoom.png in', outDir);
  } finally { await browser.close().catch(() => {}); }
  process.exit(0);
}
const payload = assembleRoadwayScene(recipe);
if (process.env.FILTER) payload.faces = payload.faces.filter(new Function('f', `return ${process.env.FILTER}`));
payload.textures = collectFaceTextures(payload.faces, {});
const only = process.env.CAMS ? process.env.CAMS.split(',') : null;
const W = 1120, H = 780;
const exe = await resolveChromium();
const browser = await puppeteer.launch({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
try {
  for (let i = 0; i < payload.cameras.length; i++) {
    if (only && !only.includes(payload.cameras[i].name)) continue;
    const cams = [payload.cameras[i], ...payload.cameras.filter((_, j) => j !== i)];
    const html = emitThreeWorld({ ...payload, cameras: cams, inline: true, hud: false });
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 6000));
    const el = await page.$('#wrap');
    const shot = el ? await el.screenshot({ type: 'png' }) : await page.screenshot({ type: 'png' });
    const out = path.join(outDir, `${payload.cameras[i].name}.png`);
    writeFileSync(out, Buffer.from(shot));
    console.log('wrote', out);
    await page.close();
  }
} finally { await browser.close().catch(() => {}); }
