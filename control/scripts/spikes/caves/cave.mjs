// A CAVE SEEN (era/cave.js): a cave cut into a geocube trail's cliff, captured at each hour from the approach (the
// mouth in the cliff), at the mouth looking in, from its far end looking back out at the light, up at its ceiling, and
// wide (the cliff with its mouth and the land over it). The machine gate: no page errors, the cave seated (its path, its
// mouth's floor); the look is the operator's.
//
//   node scripts/spikes/caves/cave.mjs [--out <dir>] [--cube valley-morning] [--hours noon,dusk] [--cave '{"y":36,"depth":10,"along":14}']
//     [--ground '{"cliff":{"height":32},"behind":40}'] [--lights fluorescent,torch,bio] [--era gen-7]
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
const { assembleStageScene } = await import('@/lib/graph/era/stage');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'cave')), W = 1120, H = 700;
const cube = arg('--cube', 'valley-morning'), hours = arg('--hours', 'noon,dusk').split(','), era = arg('--era', 'gen-7');
const cave = JSON.parse(arg('--cave', '{"y":36,"depth":10,"along":14}'));
// (the trail's ground round it: a gargantuan cave wants a taller cliff and more rock behind it, `cliff.height`, `behind`)
const ground = JSON.parse(arg('--ground', '{}'));
// (the register it is lit by past its daylight: fluorescent, torch or bio; each its own page)
const lights = arg('--lights', null)?.split(',') ?? [null];
fs.mkdirSync(out, { recursive: true });

const unit = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
function cams(C) {
  // (each at its distance for a cave 8 m wide, scaled with this one's: a gargantuan cave seen as a small one is)
  const [m, a] = C.path, e = C.path.at(-1), b = C.path.at(-2), into = unit([a[0] - m[0], a[1] - m[1]]), side = [-into[1], into[0]], z = C.floor, k = Math.max(1, C.width / 8);
  const back = unit([b[0] - e[0], b[1] - e[1]]);
  return {
    approach: { pos: [m[0] - into[0] * 14 * k + side[0] * 4 * k, m[1] - into[1] * 14 * k + side[1] * 4 * k, z + 1.7], target: [m[0] + into[0] * 4, m[1] + into[1] * 4, z + 2.4 * k], vfov: 62 },
    wide: { pos: [m[0] - into[0] * 26 * k + side[0] * 14 * k, m[1] - into[1] * 26 * k + side[1] * 14 * k, z + 14 * k], target: [m[0] + into[0] * 4 * k, m[1] + into[1] * 4 * k, z + 5 * k], vfov: 58 },
    mouth: { pos: [m[0] + into[0] * 1, m[1] + into[1] * 1, z + 1.7], target: [a[0], a[1], z + 2], vfov: 72 },
    deep: { pos: [e[0] + back[0] * 1.5, e[1] + back[1] * 1.5, z + 1.7], target: [m[0], m[1], z + 2], vfov: 72 },
    ceiling: { pos: [a[0] - into[0] * 2, a[1] - into[1] * 2, z + 1.5], target: [a[0] + side[0] * 0.1, a[1] + side[1] * 0.1, z + C.height + 3], vfov: 80 },
  };
}

const pages = [];
for (const light of lights) for (const hour of hours) {
  const lit = (c) => (light ? { ...c, light } : c);
  const manifest = { kind: 'stage', geocube: cube, trail: { ground: { ...ground, caves: (Array.isArray(cave) ? cave : [cave]).map(lit) } }, hour };
  const t = Date.now(), P = assembleStageScene(manifest), C = P.anchors.find((x) => x.kind === 'cave' && x.id === (process.argv.includes('--second') ? 'cave-2' : 'cave-1'));
  console.log(`${hour.padEnd(6)} ${C.id}: path ${JSON.stringify(C.path)} ${C.width} m wide, ${C.height} m high, its mouth's floor at ${C.floor} m (${Date.now() - t} ms)`);
  const { payload } = await resolveWorldScene({ ref: `cave-${hour}`, title: `a cave at ${hour}`, manifest }, { era, live: true });
  pages.push({ name: `cave-${cube}-${hour}${light ? `-${light}` : ''}`, payload, cams: cams(C) });
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
