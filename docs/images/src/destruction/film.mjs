// Film a blast on a destructible World page: the page in capture mode, a building picked from its breakables, a charge
// set at its foot, and the world stepped on a fixed clock, a screenshot a tick.
//
//   node docs/images/src/destruction/film.mjs <world.html> <outDir> [fps] [seconds] [radius]
//
// The charge is the game's own burst (worlds/controllable/rupa.js): each block in reach takes its share of the burst's
// energy by the solid angle its face fills (burstShare over blastJoules), landed through the page's public
// `__mojCtrl.strike(id, joules, 'burst', { from })`, as a grenade's burst lands it. What falls, falls by the page's own
// physics. Writes frame-NNN.png and pick.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, sleep, captureCopy } from '../lib/browser.mjs';

const [world, outDir, fpsArg = '12', secondsArg = '4', radiusArg = '7'] = process.argv.slice(2);
if (!world || !outDir) { console.error('usage: film.mjs <world.html> <outDir> [fps] [seconds] [radius]'); process.exit(1); }
const fps = Number(fpsArg), seconds = Number(secondsArg), radius = Number(radiusArg), W = 960, H = 540;
mkdirSync(outDir, { recursive: true });

const file = await captureCopy(world);
const browser = await launch(true, { protocolTimeout: 0 });   // a big world's step can outlast puppeteer's 180 s
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(0);
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(file).href, { waitUntil: 'domcontentloaded', timeout: 0 });
  await page.waitForFunction(() => window.__mojCapture && window.__mojCapture.ready && window.__mojCtrl && window.__mojCtrl.strike, { timeout: 0, polling: 500 });
  await page.evaluate((w, h) => {
    for (const sel of ['.hud', '.hint', '.rig-preview']) for (const el of document.querySelectorAll(sel)) el.style.display = 'none';
    for (const b of document.querySelectorAll('button')) b.parentElement.style.display = 'none';
    const el = document.querySelector('#wrap');
    if (el) { el.style.width = `${w}px`; el.style.height = `${h}px`; el.style.maxWidth = 'none'; el.style.aspectRatio = 'auto'; window.dispatchEvent(new Event('resize')); }
  }, W, H);

  // the building: the tallest breakable group near the hero, and a camera across the street from it
  const pick = await page.evaluate(() => {
    const w = window.__mojCtrl.world, hero = w.entities.find((e) => e.pilotable) || w.entities[0], eye = hero.transform.pos;
    const groups = new Map();
    for (const b of w.breakables) {
      if (b.broken) continue;
      const g = b.id.slice(0, b.id.lastIndexOf(':')) || b.id;
      const G = groups.get(g) || { id: g, min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9], n: 0 };
      for (let i = 0; i < 3; i++) { G.min[i] = Math.min(G.min[i], b.min[i]); G.max[i] = Math.max(G.max[i], b.max[i]); }
      G.n++; groups.set(g, G);
    }
    const near = [...groups.values()].filter((G) => G.n >= 12).map((G) => ({ ...G, d: Math.hypot((G.min[0] + G.max[0]) / 2 - eye[0], (G.min[1] + G.max[1]) / 2 - eye[1]), h: G.max[2] - G.min[2] }));
    near.sort((a, b) => (a.d < 80) - (b.d < 80) || b.h - a.h);
    const G = near.find((q) => q.d < 80) || near[0];
    return { eye, group: G, count: groups.size };
  });
  const G = pick.group, c = [(G.min[0] + G.max[0]) / 2, (G.min[1] + G.max[1]) / 2], h = G.max[2] - G.min[2];
  const span = Math.max(G.max[0] - G.min[0], G.max[1] - G.min[1], h);
  // stand off from the building toward the hero (the street it was picked from), a little above its middle
  const dir = [pick.eye[0] - c[0], pick.eye[1] - c[1]], dl = Math.hypot(...dir) || 1;
  const back = span * 1.6;
  const camera = { pos: [c[0] + (dir[0] / dl) * back + (-dir[1] / dl) * back * 0.35, c[1] + (dir[1] / dl) * back + (dir[0] / dl) * back * 0.35, G.min[2] + h * 0.55], target: [c[0], c[1], G.min[2] + h * 0.4] };
  const at = [c[0] + (dir[0] / dl) * ((G.max[0] - G.min[0]) / 2), c[1] + (dir[1] / dl) * ((G.max[1] - G.min[1]) / 2), G.min[2] + 1.2];
  writeFileSync(path.join(outDir, 'pick.json'), JSON.stringify({ ...pick, camera, at, radius }, null, 1));
  console.log(`building ${G.id}: ${G.n} blocks, ${h.toFixed(1)} m tall; charge at ${at.map((v) => v.toFixed(1))} r ${radius} m`);

  const dt = 1 / fps, total = Math.round(seconds * fps), blastAt = Math.round(0.5 * fps);
  for (let k = 0; k < total; k++) {
    if (k === blastAt) {
      const hit = await page.evaluate((at, R) => {
        const w = window.__mojCtrl.world, P = window.__mojCtrl.physics, J = P.blastJoules(R, w.rupa.blastZ ?? 4) * (w.rupa.power ?? 1);
        const dist = (b) => Math.hypot(...[0, 1, 2].map((i) => Math.max(b.min[i] - at[i], 0, at[i] - b.max[i])));
        let n = 0;
        for (const b of w.breakables) if (!b.broken && dist(b) <= R) { window.__mojCtrl.strike(b.id, P.burstShare(b, at, J), 'burst', { from: at }); n++; }
        return n;
      }, at, radius);
      console.log(`blast: ${hit} blocks in reach`);
    }
    const t0 = Date.now();
    await page.evaluate((s) => window.__mojCapture.step(s), { dt, input: {}, pos: camera.pos, target: camera.target });
    if (k < 3 || k === blastAt) console.log(`step ${k}: ${Date.now() - t0} ms`);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
    const shot = await (await page.$('#wrap')).screenshot({ type: 'png' });
    writeFileSync(path.join(outDir, `frame-${String(k).padStart(3, '0')}.png`), shot);
    if (k % 6 === 0) console.log(`frame ${k + 1}/${total}`);
  }
} finally { await browser.close(); }
