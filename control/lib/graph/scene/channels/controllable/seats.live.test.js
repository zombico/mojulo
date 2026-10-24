// Seats on the World page (an e2e suite: a real browser, skipped when none is installed; pilots.plan.md phase 3): two pads
// sit down by pushing a stick, the first is seat 1 and drives the world's pilot, the second drives its own body; each reads
// only its own pad. The strip names who is in. A world without seats emits no seats code at all.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { emitThreeWorld } from '../../scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../../chromium.js';

const hero = (id, x) => ({ id, pilotable: true, transform: { pos: [x, 0, 0], heading: 0 }, rule: { type: 'platform', eye: 0, speed: 6 }, ambient: { type: 'static' }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.6] } });
const floor = { corners: [[-40, -10, 0], [80, -10, 0], [80, 10, 0], [-40, 10, 0]], fill: '#445566' };
const world = (seats) => emitThreeWorld({ faces: [floor], entities: [hero('p1', 0), hero('p2', -2)], camera: { rule: 'side', target: 'p1' }, ...(seats ? { seats } : {}), inline: true });
// two standard pads the test pushes, in place of the browser's
const PADS = `<script>(() => { const mk = (i) => ({ index: i, id: 'stub pad ' + i, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });
  window.__pads = [mk(0), mk(1)]; navigator.getGamepads = () => window.__pads; })();</script>`;

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
    const settle = () => new Promise((r) => setTimeout(r, 400));

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
});
