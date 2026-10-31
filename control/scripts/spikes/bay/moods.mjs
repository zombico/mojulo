// THE LIGHT PLOT BY MOOD (era/compose-plot.js): one composed suite (a low room into a great hall) in each mood, read in
// gen-6 and gen-7 and captured from the low room's door looking into the hall, with what the plot measured (the ratio at
// each room's focus over its mean, asked and reached, on the bake: compose-report.js). The machine gate is the report's;
// the look is the operator's.
//
//   node scripts/spikes/bay/moods.mjs [--out <dir>] [--words 'a hangar'] [--kit bay-military]
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
const { assembleStageScene } = await import('@/lib/graph/era/stage');
const { MOOD_IDS } = await import('@/lib/graph/era/compose-plot');
const { resolveCompose } = await import('@/lib/graph/era/compose');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'bay-moods')), words = arg('--words', 'a hangar'), kit = arg('--kit', 'bay-military');
const W = 1120, H = 700;
fs.mkdirSync(out, { recursive: true });
const ROOMS = { rooms: [{ id: 'low', x: 0, y: 0, w: 6, d: 12, h: 3.5 }, { id: 'tall', x: -6, y: 12, w: 18, d: 30, h: 12 }], links: [{ from: 'low', to: 'tall' }] };
// (from the low room's back, through its doorway, down the hall's length)
const cam = { pos: [3, 1.2, 1.6], target: [3, 40, 3.5], vfov: 68 };
const pages = [], report = [];
for (const mood of MOOD_IDS) {
  const manifest = resolveCompose({ kind: 'stage', kit, ...ROOMS, compose: { words, mood } });
  // (the seventh generation's bake, and the report on it: compose-report.js)
  const S = assembleStageScene(manifest, { formLit: true }), R = S.compose.report;
  report.push({ mood, plot: S.compose.plot, report: R });
  console.log(mood.padEnd(6), `${R.measured}:`, R.rooms.map((r) => `${r.room} ${r.role} ${r.ratio ?? '-'} of ${r.target ?? '-'}${r.short ? ' (short)' : ''}`).join('  |  '), '|', R.laws.map((l) => `${l.ok ? '' : 'NOT '}${l.id}`).join(' '));
  for (const era of ['gen-6', 'gen-7']) {
    const { payload } = await resolveWorldScene({ ref: `mood-${mood}`, title: `${words} · ${mood} · ${era}`, manifest }, { era, live: true });
    pages.push({ mood, era, payload });
  }
}
const browser = await launchChromium({ executablePath: await resolveChromium({ allowFetch: false }), headless: true, args: CHROMIUM_WEBGL_ARGS });
for (const p of pages) {
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewport({ width: W, height: H });
  await page.setContent(emitThreeWorld({ ...p.payload, viewBox: { width: W, height: H }, inline: true, capture: true, hud: false, walk: false }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready, { timeout: 300000 });
  await page.evaluate(async (c) => { window.__mojCapture.frame(c); await new Promise((r) => setTimeout(r, 400)); window.__mojCapture.frame(c); }, cam);
  await (await page.$('#wrap')).screenshot({ path: path.join(out, `${p.mood}-${p.era}.png`) });
  console.log(p.mood, p.era, errors.length ? `errors: ${errors.slice(0, 2).join(' | ')}` : 'no page errors');
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
process.exit(0);
