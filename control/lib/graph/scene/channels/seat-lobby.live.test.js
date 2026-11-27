// The seat lobby on the World page (an e2e suite: a real browser, skipped when none is installed): a level whose seats
// join by lobby opens on it, the level held; pads sit down by pressing, each shown in its colour; seat 1's fresh press of
// A starts the level, the lobby gone and the seats closed (a pad pressing after sits nobody down).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { emitThreeWorld } from '../scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../chromium.js';

const hero = (id, x) => ({ id, pilotable: true, transform: { pos: [x, 0, 0], heading: 0 }, rule: { type: 'platform', eye: 0, speed: 6 }, ambient: { type: 'static' }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.6] } });
const floor = { corners: [[-40, -10, 0], [80, -10, 0], [80, 10, 0], [-40, 10, 0]], fill: '#445566' };
const page = (join) => emitThreeWorld({ faces: [floor], entities: [hero('p1', 0), hero('p2', -2), hero('p3', -4)], camera: { rule: 'side', target: 'p1' }, seats: { bodies: ['p2', 'p3'], join }, inline: true });
const PADS = `<script>(() => { const mk = (i) => ({ index: i, id: 'stub pad ' + i, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) });
  window.__pads = [mk(0), mk(1), mk(2)]; navigator.getGamepads = () => window.__pads; })();</script>`;

let browser = null;
beforeAll(async () => {
  let exe;
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

describe('the seat lobby on the World page', () => {
  it('a page whose seats join drop-in carries no lobby', () => {
    expect(page('drop-in')).not.toMatch(/__mojLobby/);
    expect(page('lobby')).toMatch(/__mojLobby/);
  });

  it('pads sit down while the level is held; seat 1\'s A starts it and closes the seats', async () => {
    if (!browser) return;
    const p = await browser.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.setContent(page('lobby').replace('<head>', '<head>' + PADS), { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world && window.__mojLobby, { timeout: 20000 });
    const frames = (n) => p.evaluate((n) => new Promise((r) => { const f = () => (--n ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }), n);
    const press = async (i, b, on) => { await p.evaluate(([i, b, on]) => { window.__pads[i].buttons[b] = { pressed: on, value: on ? 1 : 0 }; }, [i, b, on]); await frames(4); };
    const tap = async (i, b) => { await press(i, b, true); await press(i, b, false); };
    expect(await p.evaluate(() => window.__mojLobby.up)).toBe(true);
    await tap(0, 0);                                          // pad 0 sits down: seat 1 (its press not a start)
    await tap(1, 0);                                          // pad 1: seat 2
    expect(await p.evaluate(() => window.__mojSeats().seats.map((s) => [s.n, s.controller]))).toEqual([[1, 'pad:0'], [2, 'pad:1']]);
    expect(await p.evaluate(() => window.__mojLobby.up)).toBe(true);
    const said = await p.evaluate(() => document.querySelector('#mjlobby').innerText);
    expect(said).toMatch(/P1[\s\S]*Joined[\s\S]*P2[\s\S]*Joined[\s\S]*P3[\s\S]*Press any button to join/);
    // the level held: seat 1's stick moves nothing
    const x0 = await p.evaluate(() => window.__mojCtrl.world.byId.p1.transform.pos[0]);
    await p.evaluate(() => { window.__pads[0].axes[1] = -1; });
    await frames(20);
    await p.evaluate(() => { window.__pads[0].axes[1] = 0; });
    expect(await p.evaluate(() => window.__mojCtrl.world.byId.p1.transform.pos[0])).toBe(x0);
    await tap(0, 0);                                          // seat 1's fresh A: the level starts
    expect(await p.evaluate(() => window.__mojLobby.up)).toBe(false);
    expect(await p.evaluate(() => !!document.querySelector('#mjlobby'))).toBe(false);
    await tap(2, 0);                                          // pad 2 too late: the seats are closed
    expect(await p.evaluate(() => window.__mojSeats().seats.length)).toBe(2);
    await p.evaluate(() => { window.__pads[0].axes[1] = -1; });
    await frames(20);
    expect(await p.evaluate(() => window.__mojCtrl.world.byId.p1.transform.pos[0])).toBeGreaterThan(x0 + 0.3);
    expect(errors).toEqual([]);
    await p.close();
  }, 90000);
});
