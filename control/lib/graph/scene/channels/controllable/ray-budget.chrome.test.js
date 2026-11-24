// THE RAY BUDGET, in Chrome (the e2e tier: it builds a gen-7 land and launches a browser, and passes saying nothing when
// none is installed). A world's rays (the ground probe under each walker, every frame; the camera's) must never test a
// big mesh triangle by triangle: the ground grid (ground-grid.js) takes every big static mesh, and a ray leaves the bodies
// out. A gen-7 land is the case that broke it: its form is built after the first probe, and the grid, indexed once at that
// probe, never took it (a level at 8 frames a second with nothing drawn). The page names each big mesh a ray tested slowly
// (window.__mojCost.slow); this asserts there is none, and that the frame's cost is read by side.
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

describe('the ray budget', () => {
  it('a walker on a gen-7 land: no ray tests a big mesh triangle by triangle, and the frame says what it cost', async () => {
    if (!browser) return;
    // (the smallest world that builds its land after the first probe: a geocube's path in gen-7, one walker, its camera)
    const manifest = { kind: 'geocube', cube: { from: 'jungle-haze', era: 'gen-7' }, show: 'path', seed: 3,
      entities: [{ id: 'w', pilotable: true, rule: { type: 'walk', speed: 3, eye: 1.6 }, body: { type: 'mesh', shape: 'box', size: [0.5, 0.5, 1.7] }, transform: { pos: [0, 0, 0], heading: 0 } },
        { id: 'cam', rule: { type: 'follow', target: 'w', dist: 6, height: 2.5 }, transform: { pos: [0, -6, 3], heading: 0 } }] };
    const { payload } = await resolveWorldScene({ ref: 'ray-budget', title: 'ray budget', manifest }, { era: 'gen-7', live: true });
    expect(payload.form).toBeTruthy();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setViewport({ width: 320, height: 240 });
    await page.setContent(emitThreeWorld({ ...payload, viewBox: { width: 320, height: 240 }, inline: true, hud: false }), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojCost && window.__mojCtrl, { timeout: 120000 });
    // (long enough for the land's form to be built and for many probes after it)
    await new Promise((r) => setTimeout(r, 8000));
    const C = await page.evaluate(() => ({ slow: window.__mojCost.slow, logic: window.__mojCost.logic, rays: window.__mojCost.rays, render: window.__mojCost.render }));
    await page.close();
    expect(errors).toEqual([]);
    expect(C.slow).toEqual({});                                   // (each key a mesh the grids missed, with its count)
    for (const k of ['logic', 'rays', 'render']) expect(Number.isFinite(C[k]) && C[k] >= 0).toBe(true);
    expect(C.rays).toBeLessThanOrEqual(C.logic + 1e-6);           // (the rays are the logic's, never more)
  }, 300000);
});
