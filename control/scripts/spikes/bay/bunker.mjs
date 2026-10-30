// THE BUNKER SEEN (style/bay-axes.js CONSTRUCTIONS.bunker, bay.js B.fittings): the bay suite built as a bunker and as the
// military register, read in gen-7 and captured from inside the tall room toward its doorway (the blast door's leaf
// parked over it, the jambs' chevrons, the placard) down a long wall and close on it (the cable tray under the crown, its back cable dipping along the wall), with each
// room's fittings counted. The machine gate: no page errors, the fittings laid; the look is the operator's.
//
//   node scripts/spikes/bay/bunker.mjs [--out <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
const { resolveCompose } = await import('@/lib/graph/era/compose');
const { planStage, buildStageGeometry } = await import('@/lib/graph/era/stage');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'bay-bunker')), W = 1120, H = 700;
fs.mkdirSync(out, { recursive: true });
const SUITE = { kind: 'stage', kit: 'bay-military', rooms: [{ id: 'low', x: 0, y: 0, w: 6, d: 12, h: 3.5 }, { id: 'tall', x: -6, y: 12, w: 18, d: 30, h: 12 }], links: [{ from: 'low', to: 'tall' }] };
const CASES = [['bunker', { ...SUITE, compose: { construction: 'bunker' } }], ['military', { ...SUITE, compose: 'a hangar' }]];
// (the tall room: from its far end toward the doorway it is entered by; from its near corner down the long wall)
const CAMS = { door: { pos: [3, 30, 1.7], target: [3, 12, 3.2], vfov: 70 }, wall: { pos: [6, 14, 2.2], target: [-5.6, 34, 8.5], vfov: 68 }, tray: { pos: [1, 20, 5.5], target: [-6, 27, 6.8], vfov: 60 } };
const pages = [];
for (const [name, m0] of CASES) {
  const manifest = resolveCompose(m0), g = buildStageGeometry(planStage(manifest));
  console.log(name.padEnd(9), g.bayRooms.map((R) => `${R.r.id}: ${R.fittings ? JSON.stringify(R.fittings) : 'no fittings'}`).join(' | '));
  const { payload } = await resolveWorldScene({ ref: `bunker-${name}`, title: name, manifest }, { era: 'gen-7', live: true });
  pages.push({ name, payload });
}
const browser = await launchChromium({ executablePath: await resolveChromium({ allowFetch: false }), headless: true, args: CHROMIUM_WEBGL_ARGS });
for (const p of pages) {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewport({ width: W, height: H });
  await page.setContent(emitThreeWorld({ ...p.payload, viewBox: { width: W, height: H }, inline: true, capture: true, hud: false, walk: false }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready, { timeout: 300000 });
  for (const [shot, cam] of Object.entries(CAMS)) {
    await page.evaluate(async (c) => { window.__mojCapture.frame(c); await new Promise((r) => setTimeout(r, 400)); window.__mojCapture.frame(c); }, cam);
    await (await page.$('#wrap')).screenshot({ path: path.join(out, `${p.name}-${shot}.png`) });
  }
  console.log(p.name, errors.length ? `errors: ${errors.slice(0, 2).join(' | ')}` : 'no page errors');
  await page.close();
}
await browser.close();
process.exit(0);
