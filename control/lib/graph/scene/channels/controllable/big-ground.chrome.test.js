// BIG GROUNDS, in Chrome (the e2e tier: it resolves whole levels and launches a browser, and passes saying nothing when
// none is installed). A flight's land is 16 km across and streams in as hundreds of chunks; a roadway race stands in a
// 12 km backdrop. The ground grid (ground-grid.js) began every big mesh at 2 m cells and the ground index
// (ground-index.js) bucketed every chunk at 4 m over the whole land: the flight page grew past 3 GB and the race's past
// 3.5 GB, and neither drew a first frame. This loads each level as it ships and holds its heap, collected, under a
// ceiling once the land has streamed in, with the flyer and the kart under control.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolveWorldScene } from '../../../worlds/world-scene.js';
import { emitThreeWorld } from '../../scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../../chromium.js';

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

// (the page's JS heap, collected first: what it holds, not what it has yet to free)
async function heldMB(page) {
  const cdp = await page.target().createCDPSession();
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  await cdp.detach();
  return usedSize / 1e6;
}

async function load(manifest) {
  const { payload } = await resolveWorldScene({ ref: 'big-ground', title: 'big ground', manifest }, { live: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewport({ width: 320, height: 240 });
  await page.setContent(emitThreeWorld({ ...payload, viewBox: { width: 320, height: 240 }, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world, { timeout: 120000 });
  // (long enough for the land to stream in and for many probes over it)
  await new Promise((r) => setTimeout(r, 15000));
  const held = await heldMB(page), ctrl = await page.evaluate(() => !!(window.__mojCtrl.world.entities || []).length);
  await page.close();
  return { errors, held, ctrl };
}

describe('big grounds', () => {
  it('a flight over its land and a kart race in its backdrop load, and hold their heap under a ceiling', async () => {
    if (!browser) return;
    // (a trainer's island, its runway and its gate course; the kart oval as a quick race lays it. On each a walker, whose
    // ground probe every frame is what the grids serve, and its camera: the smallest page that probes the big ground)
    const on = (at) => [{ id: 'w', pilotable: true, rule: { type: 'walk', speed: 3, eye: 1.6 }, body: { type: 'mesh', shape: 'box', size: [0.5, 0.5, 1.7] }, transform: { pos: at, heading: 0 } },
      { id: 'cam', rule: { type: 'follow', target: 'w', dist: 6, height: 2.5 }, transform: { pos: [at[0], at[1] - 6, at[2] + 3], heading: 0 } }];
    for (const manifest of [
      { kind: 'airspace', map: { craft: 'trainer' }, ground: { pads: [{ kind: 'runway', at: [0.5, 0.25] }] }, course: true, seed: 9356, entities: on([-980, -1000, 40]) },
      { kind: 'roadway', form: 'circuit', course: 'kart-oval', seed: 9356, entities: on([-55, -27, 1]) },
    ]) {
      const { errors, held, ctrl } = await load(manifest);
      expect(errors, manifest.kind).toEqual([]);
      expect(ctrl, manifest.kind).toBe(true);
      expect(held, manifest.kind).toBeLessThan(400);   // (about 60 MB on the reference box; it was past 3,000 before)
    }
  }, 300000);
});
