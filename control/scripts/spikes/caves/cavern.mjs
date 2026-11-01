// A CAVERN SEEN (era/cavern.js): a whole geocube trail underground, captured from the trailhead along the walk, from the
// middle at its wall and formations, under its skylight, up at its ceiling and from the high ground over the walk. The
// machine gate: no page errors, the cavern laid (its top, its formations, its lamps); the look is the operator's.
//
//   node scripts/spikes/caves/cavern.mjs [--out <dir>] [--cube valley-morning] [--cavern '{"skylight":{"y":40}}']
//     [--lights torch,bio,fluorescent] [--ground '{}'] [--era gen-7]
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';

register('../../mcp-stdio-loader.mjs', import.meta.url);
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three');
const { assembleStageScene } = await import('@/lib/graph/era/stage');
const { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } = await import('@/lib/graph/scene/chromium');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = path.resolve(arg('--out', 'cavern')), W = 1120, H = 700;
const cube = arg('--cube', 'valley-morning'), era = arg('--era', 'gen-7'), cavern = JSON.parse(arg('--cavern', '{"skylight":{"y":40}}'));
const ground = JSON.parse(arg('--ground', '{}')), lights = arg('--lights', 'torch').split(',');
fs.mkdirSync(out, { recursive: true });

function cams(P) {
  const beats = P.anchors.filter((a) => a.kind === 'beat'), C = P.anchors.find((a) => a.kind === 'cavern'), b0 = beats[0], bm = beats[Math.floor(beats.length / 2)], bl = beats.at(-1);
  const z = (b) => b.at[2] ?? 0, cam = {
    along: { pos: [b0.at[0], b0.at[1] + 2, z(b0) + 1.7], target: [bm.at[0], bm.at[1], z(bm) + 2], vfov: 70 },
    wall: { pos: [bm.at[0] + 2, bm.at[1], z(bm) + 1.7], target: [bm.at[0] - 14, bm.at[1] + 6, z(bm) + 5], vfov: 72 },
    ceiling: { pos: [bm.at[0], bm.at[1], z(bm) + 1.6], target: [bm.at[0] + 0.5, bm.at[1] + 4, z(bm) + 30], vfov: 80 },
    back: { pos: [bl.at[0], bl.at[1] - 2, z(bl) + 1.7], target: [bm.at[0], bm.at[1], z(bm) + 2.5], vfov: 70 },
  };
  // (the skylight's shaft: where its sun carries the hole down to the floor, seen from beside it)
  if (C?.skylight) {
    // (both from the walk at the beat nearest the skylight's station: a camera off it may stand in the rock)
    const sk = C.skylight, d = P.sky?.sun?.dir, bs = beats.reduce((m, b) => (Math.abs(b.at[1] - sk.y) < Math.abs(m.at[1] - sk.y) ? b : m)), drop = C.top + C.height * 0.8 - z(bs);
    const spot = d && d[2] > 0.05 ? [sk.x - (d[0] / d[2]) * drop, sk.y - (d[1] / d[2]) * drop] : [sk.x, sk.y];
    cam.skylight = { pos: [bs.at[0], bs.at[1], z(bs) + 1.7], target: [spot[0], spot[1], z(bs)], vfov: 72 };
    cam.shaft = { pos: [bs.at[0], bs.at[1], z(bs) + 1.6], target: [sk.x, sk.y, C.top + C.height * 0.8], vfov: 80 };
  }
  // (each set piece at its focus, seen from the walk a few metres before its beat: era/cavern-set.js)
  for (const a of P.anchors.filter((q) => q.kind === 'prop' && q.set)) {
    const b = beats.find((q) => q.id === a.beat), y = Math.max(2, a.at[1] - 7), bb = beats.reduce((m, q) => (Math.abs(q.at[1] - y) < Math.abs(m.at[1] - y) ? q : m));
    cam[`set-${a.id.split('/')[0]}-${a.id.split('/').pop()}`] = { pos: [P.anchors.find((q) => q.id === bb.id).at[0], y, (b ?? bb).at[2] + 2.2], target: [a.at[0], a.at[1], a.at[2] + 1], vfov: 62 };
  }
  return cam;
}

const pages = [];
for (const light of lights) {
  const manifest = { kind: 'stage', geocube: cube, trail: { ground: { ...ground, cavern: { ...cavern, light } } }, hour: 'noon' };
  const t = Date.now(), P = assembleStageScene(manifest), C = P.anchors.find((a) => a.kind === 'cavern');
  console.log(`${light.padEnd(12)} cavern: top ${C.top} m, crown ${C.height} m over it, skylight ${JSON.stringify(C.skylight ?? null)}; ${P.faces.length} faces (${Date.now() - t} ms)`);
  const { payload } = await resolveWorldScene({ ref: `cavern-${light}`, title: `a cavern, ${light}`, manifest }, { era, live: true });
  pages.push({ name: `cavern-${cube}-${light}`, payload, cams: cams(P) });
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
