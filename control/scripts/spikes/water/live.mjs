// THE WATER LIVE SEEN (era/water-live.js): a geocube's path with water, read in gen-6 (its painted sheets) and gen-7 (its
// river, brook, falls and pool drawn as they move), from each water still at two moments `--dt` seconds apart, so the
// motion shows as a pair. The machine gate: no page errors, the live water carried; the look is the operator's.
//
//   node scripts/spikes/water/live.mjs [--out <dir>] [--cube valley-morning] [--water '{"river":true,"falls":true,"lake":true}']
//     [--eras gen-6,gen-7] [--dt 0.5]
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'water-live')), W = 1120, H = 700, dt = +arg('--dt', '0.5');
const cube = arg('--cube', 'valley-morning'), water = JSON.parse(arg('--water', '{"river":true,"falls":true,"lake":true}')), eras = arg('--eras', 'gen-6,gen-7').split(',');
fs.mkdirSync(out, { recursive: true });

const browser = await launchChromium({ executablePath: await resolveChromium({ allowFetch: false }), headless: true, args: CHROMIUM_WEBGL_ARGS });
for (const era of eras) {
  const manifest = { kind: 'geocube', cube: { from: cube, outside: { water } }, show: 'path' };
  const { payload } = await resolveWorldScene({ ref: `water-${era}`, title: `water, ${era}`, manifest }, { era, live: true });
  const live = `${(payload.surfaces || []).length} surfaces, ${(payload.shallows?.bodies || []).length} ponds, ${(payload.jets || []).length} jets, ${payload.faces.filter((f) => f.water).length} painted water faces`;
  const cams = Object.fromEntries((payload.cameras || []).filter((c) => ['river', 'falls', 'lake', 'shore'].includes(c.name) && c.worldFraming)
    .map((c) => [c.name, { pos: c.worldFraming.cameraPosition, target: c.worldFraming.lookAt, vfov: 50 }]));
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewport({ width: W, height: H });
  await page.setContent(emitThreeWorld({ ...payload, viewBox: { width: W, height: H }, inline: true, capture: true, hud: false, walk: false }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready, { timeout: 300000 });
  // (each shot twice, its clock pinned `dt` seconds apart: frame's `t` is the page's clock, in ms)
  for (const [shot, cam] of Object.entries(cams)) for (const k of [0, 1]) {
    await page.evaluate(async (c) => { window.__mojCapture.frame(c); await new Promise((r) => setTimeout(r, 300)); window.__mojCapture.frame(c); }, { ...cam, t: 2000 + k * dt * 1000 });
    await (await page.$('#wrap')).screenshot({ path: path.join(out, `${era}-${shot}-${k}.png`) });
  }
  console.log(era, live, '·', Object.keys(cams).join(', '), '·', errors.length ? `errors: ${errors.slice(0, 2).join(' | ')}` : 'no page errors');
  await page.close();
}
await browser.close();
process.exit(0);
