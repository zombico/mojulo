#!/usr/bin/env node
// brawler belt — the streets a brawl is fought down, seen as the brawl sees it: the greybox street from its belt's
// locked angle at each screen's middle (and each angle at the first held screen's), then the belt laid in the indoor
// designer's rooms on each kit (the first screen, and the first held screen's end, where the camera holds), one shot
// each, on one sheet. The eyes gate is the operator's: the shots.
//
//   node control/scripts/spikes/brawler/belt.mjs [--out dir] [--preset street] [--kits a,b] [--only greybox|stage]
import { register as registerLoader, createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const HERE = path.dirname(fileURLToPath(import.meta.url)), CONTROL = path.resolve(HERE, '../../..');
const { values: opt } = parseArgs({ options: { out: { type: 'string', default: path.join(os.tmpdir(), 'brawler-belt') }, preset: { type: 'string', default: 'street' }, kits: { type: 'string' }, only: { type: 'string' } } });
const out = path.resolve(opt.out); mkdirSync(out, { recursive: true });
process.chdir(CONTROL);
registerLoader(pathToFileURL(path.join(CONTROL, 'scripts/mcp-stdio-loader.mjs')).href);
process.env.SQLITE_PATH = path.join(out, 'store.db'); process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';

const { brawlLevel, BRAWL_STAGE_KITS } = await import('@/lib/graph/brawl/brawl-levels.js');
const { beltCamera, viewHalf, BELT_ANGLE_IDS } = await import('@/lib/graph/brawl/brawl-belt.js');
const { resolveWorldScene } = await import('@/lib/graph/worlds/world-scene.js');
const { emitThreeWorld } = await import('@/lib/graph/scene/scene-three.js');

const shots = [];
for (const angle of opt.only === 'stage' ? [] : BELT_ANGLE_IDS) {
  const manifest = brawlLevel({ kind: 'greybox', preset: opt.preset, belt: { angle } }, { title: 'street' });
  const B = manifest.brawl.belt, half = viewHalf(B);
  // (the classic angle down the whole street, screen by screen; the others at the first held screen's end)
  const at = angle === 'classic' ? B.screens.map((sc) => Math.min(Math.max(half, (sc.from + sc.to) / 2), B.length - half)) : [B.screens.find((sc) => sc.gate).to - half];
  const { brawl, ...world } = manifest;
  // (stand-ins a body's size, for scale: at the band's near edge, its middle and its far edge, across the first view)
  const { beltPoint } = await import('@/lib/graph/brawl/brawl-belt.js');
  for (const [s, n] of [[half - 3, B.depth[0] + 0.3], [half, (B.depth[0] + B.depth[1]) / 2], [half + 3, B.depth[1] - 0.3]]) world.blocks = [...world.blocks, { at: beltPoint(B, s, n, 0), size: [0.5, 0.3, 1.8], turn: B.heading, tone: 'edge' }];
  const { payload } = await resolveWorldScene({ ref: 'street', title: 'street', manifest: world }, {});
  for (const cam of at) {
    const name = `${angle}-${cam.toFixed(1)}`;
    writeFileSync(path.join(out, `${name}.html`), emitThreeWorld({ ...payload, cameras: [{ name, worldFraming: beltCamera(B, cam) }], hud: false, inline: true }));
    shots.push(name);
  }
}
// the belt in the indoor designer's rooms, kit by kit (its `brawl` block rides on the stage recipe, as a fight's `versus`)
for (const kit of opt.only === 'greybox' ? [] : opt.kits ? opt.kits.split(',') : BRAWL_STAGE_KITS) {
  const manifest = brawlLevel({ kind: 'stage', kit }, { title: kit });
  const B = manifest.brawl.belt, half = viewHalf(B);
  const { payload } = await resolveWorldScene({ ref: kit, title: kit, manifest }, {});
  for (const cam of [half, B.screens.find((sc) => sc.gate).to - half]) {
    const name = `${kit}-${cam.toFixed(1)}`;
    writeFileSync(path.join(out, `${name}.html`), emitThreeWorld({ ...payload, cameras: [{ name, worldFraming: beltCamera(B, cam) }], hud: false, inline: true }));
    shots.push(name);
  }
}
const { chromium } = createRequire(path.join(CONTROL, 'package.json'))('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
const tab = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
tab.on('pageerror', (e) => errs.push(e.message));
for (const name of shots) {
  await tab.goto(pathToFileURL(path.join(out, `${name}.html`)).href, { waitUntil: 'load', timeout: 120000 });
  await tab.waitForTimeout(2500);
  await tab.screenshot({ path: path.join(out, `${name}.png`) });
}
// the sheet: every shot, captioned
writeFileSync(path.join(out, 'sheet.html'), `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#111;color:#ddd;font:14px monospace;display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:6px}figure{margin:0}img{width:100%;display:block}</style>${shots.map((n) => `<figure><img src="${n}.png"><figcaption>${n}</figcaption></figure>`).join('')}`);
await tab.setViewportSize({ width: 1600, height: 300 * Math.ceil(shots.length / 2) + 40 });
await tab.goto(pathToFileURL(path.join(out, 'sheet.html')).href, { waitUntil: 'load' });
await tab.screenshot({ path: path.join(out, 'sheet.png'), fullPage: true });
await browser.close();
console.log('errors', JSON.stringify([...new Set(errs)].slice(0, 6)));
console.log(out);
