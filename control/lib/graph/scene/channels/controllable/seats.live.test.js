// Seats on the World page (an e2e suite: a real browser, skipped when none is installed): two pads
// sit down by pushing a stick, the first is seat 1 and drives the world's pilot, the second drives its own body; each reads
// only its own pad. The strip names who is in. Four pads take four seats in the order they press, each its own colour.
// A world without seats emits no seats code at all.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { emitThreeWorld } from '../../scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../../chromium.js';

const hero = (id, x) => ({ id, pilotable: true, transform: { pos: [x, 0, 0], heading: 0 }, rule: { type: 'platform', eye: 0, speed: 6 }, ambient: { type: 'static' }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.6] } });
const floor = { corners: [[-40, -10, 0], [80, -10, 0], [80, 10, 0], [-40, 10, 0]], fill: '#445566' };
const world = (seats, n = 2) => emitThreeWorld({ faces: [floor], entities: Array.from({ length: n }, (_, i) => hero(`p${i + 1}`, -2 * i)), camera: { rule: 'side', target: 'p1' }, ...(seats ? { seats } : {}), inline: true });
// four standard pads the test pushes, in place of the browser's
const PADS = `<script>(() => { const mk = (i) => ({ index: i, id: 'stub pad ' + i, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });
  window.__pads = [mk(0), mk(1), mk(2), mk(3)]; navigator.getGamepads = () => window.__pads; })();</script>`;

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('seats on the World page', () => {
  it('a world without seats carries no seats code', () => {
    expect(world()).not.toMatch(/__mojSeats/);
    expect(world({ bodies: ['p2'] })).toMatch(/__mojSeats/);
  });

  it('two pads take two seats and each drives its own body', async () => {
    if (!browser) return;
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent(world({ bodies: ['p2'] }).replace('<head>', '<head>' + PADS), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world && window.__mojSeats, { timeout: 20000 });
    const x = () => page.evaluate(() => ['p1', 'p2'].map((id) => window.__mojCtrl.world.byId[id].transform.pos[0]));
    const push = (i, v) => page.evaluate(([i, v]) => { window.__pads[i].axes[1] = v; }, [i, v]);
    // a wait of the page's own frames (about 0.4 s at 60 fps): the world steps once a frame, so a wall-clock wait moves a
    // body less on a slow runner, where fewer frames run
    const settle = () => page.evaluate(() => new Promise((r) => { let n = 24; const f = () => (--n ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }));

    await push(0, -1);   // pad 0 pushes forward first: it is seat 1, the pilot
    await settle();
    const [a1, a2] = await x();
    expect(a1).toBeGreaterThan(0.5);
    expect(a2).toBe(-2);
    await push(0, 0);
    await push(1, -1);   // pad 1 pushes: seat 2, its own body; seat 1's pilot ignores it
    await settle();
    await settle();
    const [b1, b2] = await x();
    expect(b2).toBeGreaterThan(a2 + 0.5);
    expect(b1 - a1).toBeLessThan(0.5);   // seat 1 only coasts to a stop
    const seats = await page.evaluate(() => window.__mojSeats().seats.map((s) => [s.n, s.controller]));
    expect(seats).toEqual([[1, 'pad:0'], [2, 'pad:1']]);
    expect(await page.evaluate(() => document.body.innerText)).toMatch(/P1[\s\S]*P2/);
    expect(errors).toEqual([]);
    await page.close();
  }, 60000);

  it('four pads take four seats in the order they press, each driving its own body under its own colour', async () => {
    if (!browser) return;
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent(world({ bodies: ['p2', 'p3', 'p4'] }, 4).replace('<head>', '<head>' + PADS), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world && window.__mojSeats, { timeout: 20000 });
    // a wait of the page's own frames for `ms` at 60 fps (the world steps once a frame: see the test above)
    const settle = (ms = 200) => page.evaluate((n) => new Promise((r) => { const f = () => (--n > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }), Math.max(1, Math.round(ms / 16.7)));
    // pads 3, 1, 0, 2 press a button, one after the other: seats 1 to 4 in that order. Each press is held across two of
    // the page's frames and released across two more: the world polls the pads once a frame, so a fixed hold could fall
    // between polls on a slow runner and the press would never land
    const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    for (const i of [3, 1, 0, 2]) {
      await page.evaluate((i) => { window.__pads[i].buttons[0] = { pressed: true, value: 1 }; }, i);
      await frames();
      await page.evaluate((i) => { window.__pads[i].buttons[0] = { pressed: false, value: 0 }; }, i);
      await frames();
    }
    const seats = await page.evaluate(() => window.__mojSeats().seats.map((s) => [s.n, s.controller, s.color]));
    expect(seats).toEqual([[1, 'pad:3', '#e5483b'], [2, 'pad:1', '#3b7be5'], [3, 'pad:0', '#f2c230'], [4, 'pad:2', '#36b04c']]);
    const x0 = await page.evaluate(() => ['p1', 'p2', 'p3', 'p4'].map((id) => window.__mojCtrl.world.byId[id].transform.pos[0]));
    // seat 3 (pad 0) alone runs: only its body, p3, moves
    await page.evaluate(() => { window.__pads[0].axes[1] = -1; });
    await settle(500);
    await page.evaluate(() => { window.__pads[0].axes[1] = 0; });
    const x1 = await page.evaluate(() => ['p1', 'p2', 'p3', 'p4'].map((id) => window.__mojCtrl.world.byId[id].transform.pos[0]));
    expect(x1[2] - x0[2]).toBeGreaterThan(0.5);
    for (const k of [0, 1, 3]) expect(x1[k]).toBe(x0[k]);
    // every seat's ring in its own colour, and the strip naming all four
    const rings = await page.evaluate(() => window.__mojSeatRings());
    expect(rings).toEqual([{ n: 1, color: '#e5483b', visible: true }, { n: 2, color: '#3b7be5', visible: true }, { n: 3, color: '#f2c230', visible: true }, { n: 4, color: '#36b04c', visible: true }]);
    expect(await page.evaluate(() => document.body.innerText)).toMatch(/P1[\s\S]*P2[\s\S]*P3[\s\S]*P4/);
    expect(errors).toEqual([]);
    await page.close();
  }, 60000);
});
