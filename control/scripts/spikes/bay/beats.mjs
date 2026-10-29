// A BEAT IN THE LIGHT (era/compose-plot.js BEATS, scene/channels/form.js): a composed hall whose key sounds a beat (an
// alarm by default), read in gen-7, captured at the beat's peak and at its trough from inside the hall toward its focus;
// the machine gate: no page errors, the frame changes between the two, and the bake holds none of the beat's light.
//
//   node scripts/spikes/bay/beats.mjs [--out <dir>] [--beat alarm|pulse|flicker]
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
const { resolveCompose } = await import('@/lib/graph/era/compose');
const { BEATS } = await import('@/lib/graph/era/compose-plot');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium');
const sharp = (await import('sharp')).default;

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'bay-beats')), beat = arg('--beat', 'alarm'), W = 1120, H = 700;
fs.mkdirSync(out, { recursive: true });
const manifest = resolveCompose({ kind: 'stage', kit: 'bay-military', compose: { words: 'a hangar', mood: 'noir', beats: { tall: beat } },
  rooms: [{ id: 'low', x: 0, y: 0, w: 6, d: 12, h: 3.5 }, { id: 'tall', x: -6, y: 12, w: 18, d: 30, h: 12 }], links: [{ from: 'low', to: 'tall' }] });
const { payload } = await resolveWorldScene({ ref: 'beat', title: `${beat} in the hall`, manifest }, { era: 'gen-7', live: true });
const L = payload.form.room.lights.filter((l) => l.beat);
console.log('beat lamps on the page:', L.map((l) => `${l.beat} at ${l.at}`).join(', '));
// (the alarm's sweep peaks a quarter turn in and is dark half a turn on; a pulse likewise; a flicker is mostly on)
const rate = BEATS[beat].rate, times = { peak: 0.25 / rate, trough: 0.75 / rate };
const cam = { pos: [3, 16, 1.7], target: [3, 40, 2.5], vfov: 70 };
const browser = await launchChromium({ executablePath: await resolveChromium({ allowFetch: false }), headless: true, args: CHROMIUM_WEBGL_ARGS });
const page = await browser.newPage(), errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.setViewport({ width: W, height: H });
await page.setContent(emitThreeWorld({ ...payload, viewBox: { width: W, height: H }, inline: true, capture: true, hud: false, walk: false }), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready, { timeout: 300000 });
const lum = {};
for (const [name, at] of Object.entries(times)) {
  await page.evaluate(async ({ c, at }) => { window.__mojForm.at = at; window.__mojCapture.frame(c); await new Promise((r) => setTimeout(r, 300)); window.__mojCapture.frame(c); }, { c: cam, at });
  const file = path.join(out, `${beat}-${name}.png`);
  await (await page.$('#wrap')).screenshot({ path: file });
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  // (the window round the focus the camera looks at: the beat lights a patch of the far wall, not the frame)
  let s = 0, n = 0;
  for (let y = Math.round(info.height * 0.3); y < Math.round(info.height * 0.6); y++) for (let x = Math.round(info.width * 0.38); x < Math.round(info.width * 0.62); x++) { const o = (y * info.width + x) * info.channels; s += 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]; n++; }
  lum[name] = +(s / n).toFixed(1);
}
await browser.close();
console.log('mean luminance round the focus', lum, errors.length ? `errors: ${errors.slice(0, 2).join(' | ')}` : 'no page errors');
process.exit(errors.length || !(lum.peak > lum.trough) ? 1 : 0);
