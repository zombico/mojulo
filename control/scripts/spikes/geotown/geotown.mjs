// A GEOTOWN SEEN (geotown/, the geocube kind's `show: 'geotown'`): a neighbourhood's map first, then the town stood on a
// cube's hills and levelled. Writes the sheet (the surface-area map and its ledger, the laws beside it) and captures the
// town at each hour from its own views: down a street from its walk, a house from across its street, over the town. The
// machine gate: the laws (the budget closes, a back yard every plot, nothing grows on a hard surface, the faces under their
// budget) and no page errors; the look is the operator's.
//
//   node scripts/spikes/geotown/geotown.mjs [--out <dir>] [--cube valley-morning] [--hours noon,dusk] [--seed 1]
//     [--geotown '{"segment":"main-street"}' | '{"evoke":"neighbourhood"}' | '{"evoke":"metro","grid":[2,2]}'] [--era gen-7]
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
const { designGeotown } = await import('@/lib/graph/geotown/design');
const { geotownSheet } = await import('@/lib/graph/geotown/sheet');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'geotown')), W = 1280, H = 720;
const cube = arg('--cube', 'valley-morning'), hours = arg('--hours', 'noon,dusk').split(','), era = arg('--era', 'gen-7'), seed = Number(arg('--seed', '1'));
const geotown = JSON.parse(arg('--geotown', '{}'));
fs.mkdirSync(out, { recursive: true });

// the map first: the sheet, and its laws
const d = designGeotown(geotown, { seed });
fs.writeFileSync(path.join(out, `geotown-${seed}-sheet.svg`), geotownSheet(d, { px: 2 }));
console.log(`map: ${d.pattern.id} ${d.spec.evoke} ${d.spec.grid.join('×')} · ${d.plots.length} plots${d.evoked ? ` for ${d.evoked.stands.plots}` : ''} · ${Math.round(d.ledger.total)} m² · the land ${d.land.range.join('–')} m`);

const pages = [];
for (const hour of hours) {
  const manifest = { kind: 'geocube', cube, show: 'geotown', seed, hour, geotown };
  const t = Date.now(), { payload } = await resolveWorldScene({ ref: `geotown-${hour}`, title: `geotown at ${hour}`, manifest }, { era, live: true });
  const G = payload.geotown;
  console.log(`${hour.padEnd(6)} ${JSON.stringify(G.counts)} (${Date.now() - t} ms)`);
  for (const l of G.laws) console.log(`       ${l.ok ? '✓' : '·'} ${l.law}: ${l.value}`);
  const cams = Object.fromEntries(payload.cameras.map((c) => [c.name, { pos: c.worldFraming.cameraPosition, target: c.worldFraming.lookAt, vfov: (c.worldFraming.horizontalFov * H) / W * 1.1 }]));
  pages.push({ name: `geotown-${cube}-${hour}`, payload, cams });
}
const browser = await launchChromium({ executablePath: await resolveChromium({ allowFetch: false }), headless: true, args: CHROMIUM_WEBGL_ARGS });
for (const p of pages) {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewport({ width: W, height: H });
  await page.setContent(emitThreeWorld({ ...p.payload, viewBox: { width: W, height: H }, inline: true, capture: true, hud: false, walk: false }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready, { timeout: 300000 });
  for (const [shot, cam] of Object.entries(p.cams)) {
    await page.evaluate(async (c) => { window.__mojCapture.frame(c); await new Promise((r) => setTimeout(r, 400)); window.__mojCapture.frame(c); }, cam);
    await (await page.$('#wrap')).screenshot({ path: path.join(out, `${p.name}-${shot}.png`) });
  }
  console.log(p.name, errors.length ? `errors: ${errors.slice(0, 2).join(' | ')}` : 'no page errors');
  await page.close();
}
await browser.close();
process.exit(0);
