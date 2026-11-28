// Seats on the World page (an e2e suite: a real browser, skipped when none is installed): two pads
// sit down by pushing a stick, the first is seat 1 and drives the world's pilot, the second drives its own body; each reads
// only its own pad. The strip names who is in. Four pads take four seats in the order they press, each its own colour.
// A world without seats emits no seats code at all.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { emitThreeWorld } from '../../scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../../chromium.js';
import { composeMechanics } from '../../../game/mechanics.js';

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

  it('a seat\'s chip carries its body\'s hp as a bar, and follows it', async () => {
    if (!browser) return;
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent(world({ bodies: ['p2'] }).replace('<head>', '<head>' + PADS), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world && window.__mojSeats, { timeout: 20000 });
    const settle = () => page.evaluate(() => new Promise((r) => { let n = 6; const f = () => (--n ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }));
    // pad 0 sits first (seat 1), then pad 1 (seat 2), its body given hp
    await page.evaluate(() => { window.__pads[0].axes[1] = -1; });
    await settle();
    await page.evaluate(() => { const e = window.__mojCtrl.world.byId.p2; e.hpMax = 10; e.body.hp = 10; window.__pads[0].axes[1] = 0; window.__pads[1].axes[1] = -1; });
    await settle();
    expect(await page.evaluate(() => window.__mojSeats().seats.map((s) => s.n))).toEqual([1, 2]);
    // the bar's fill: the last inner span of seat 2's chip
    const fill = () => page.evaluate(() => { const chips = [...document.querySelectorAll('span')].filter((c) => /^P2/.test(c.textContent)); const f = chips[0] && chips[0].querySelector('span > span > span'); return f ? f.style.width : null; });
    expect(await fill()).toBe('100%');
    await page.evaluate(() => { window.__mojCtrl.world.byId.p2.body.hp = 4; });
    await settle();
    expect(await fill()).toBe('40%');
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

  // A WORK SHIFT, SEATED: seat 2 stands at the fish crate and presses its own use (the pad's west face): the fish comes
  // into seat 2's hands, never the pilot's; the plate over its head names the place. A seated world with no shift
  // carries none of the seat reach
  it('a seat\'s own use press works the shift with its own hands', async () => {
    const card = { id: 'bench', stations: { chop: { verb: 'shovel', takes: { fish: 1 }, gives: { cut: 1 }, work: 2 } }, demand: { every: 30, patience: 60, orders: [{ name: 'cut', wants: { cut: 1 } }] }, session: 120 };
    const at = { crates: { fish: [-2, 0, 0] }, stations: { chop: [12, 6, 0] }, serve: [12, -6, 0] };
    const events = composeMechanics([{ kind: 'work', card, at }], { player: 'p1', spawn: [0, 0, 0], fall: 'none', seats: ['p2'] }).events;
    const html = emitThreeWorld({ faces: [floor], entities: [hero('p1', 0), hero('p2', -2)], camera: { rule: 'side', target: 'p1' }, seats: { bodies: ['p2'] }, events, inline: true });
    expect(html).toMatch(/__stepSeatReach/);
    expect(world({ bodies: ['p2'] })).not.toMatch(/__stepSeatReach|__mojSeatUses/);
    if (!browser) return;
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent(html.replace('<head>', '<head>' + PADS), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world && window.__mojSeats && window.__mojBus, { timeout: 20000 });
    const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
    const tap = async (i, b) => {
      await page.evaluate(([i, b]) => { window.__pads[i].buttons[b] = { pressed: true, value: 1 }; }, [i, b]);
      await frames();
      await page.evaluate(([i, b]) => { window.__pads[i].buttons[b] = { pressed: false, value: 0 }; }, [i, b]);
      await frames();
    };
    await tap(0, 0);   // pad 0 sits down: seat 1, the pilot
    await tap(1, 0);   // pad 1: seat 2, its body p2 at the crate
    const held = () => page.evaluate(() => { const v = window.__mojBus.state.vars; return [v['held:bag:fish'] ?? 0, v['held:hands2:fish'] ?? 0]; });
    expect(await held()).toEqual([0, 0]);   // sitting down is not a use
    expect(await page.evaluate(() => document.body.innerText)).toMatch(/take fish/);
    await tap(1, 2);   // seat 2's use: the west face
    expect(await held()).toEqual([0, 1]);
    expect(errors).toEqual([]);
    await page.close();
  }, 60000);

  it('a contest of presses: each seat\'s fresh A counted on the bus, the most the winner at the horn', async () => {
    const events = composeMechanics([{ kind: 'mash', seconds: 3 }], { player: 'p1', spawn: [0, 0, 0], fall: 'none', seats: ['p2'] }).events;
    const html = emitThreeWorld({ faces: [floor], entities: [hero('p1', 0), hero('p2', -2)], camera: { rule: 'side', target: 'p1' }, seats: { bodies: ['p2'] }, events, inline: true });
    expect(html).toMatch(/__mojPresses = true/);
    expect(world({ bodies: ['p2'] })).not.toMatch(/__mojPresses = true/);
    if (!browser) return;
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent(html.replace('<head>', '<head>' + PADS), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world && window.__mojSeats && window.__mojBus, { timeout: 20000 });
    const frames = (n) => page.evaluate((n) => new Promise((r) => { const f = () => (--n ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }), n);
    const tap = async (i) => { await page.evaluate((i) => { window.__pads[i].buttons[0] = { pressed: true, value: 1 }; }, i); await frames(3); await page.evaluate((i) => { window.__pads[i].buttons[0] = { pressed: false, value: 0 }; }, i); await frames(3); };
    await tap(0); await tap(1);                               // each sits down (the press that seats it is no jump)
    const v = () => page.evaluate(() => { const x = window.__mojBus.state.vars; return [x['presses:1'], x['presses:2'], x.__mash_winner_0]; });
    const [a0, b0] = await v();
    for (let k = 0; k < 3; k++) await tap(0);
    for (let k = 0; k < 6; k++) await tap(1);
    const [a1, b1] = await v();
    expect([a1 - a0, b1 - b0]).toEqual([3, 6]);
    await page.waitForFunction(() => window.__mojBus.state.vars.__mash_open_0 === 0, { timeout: 10000 });
    expect((await v())[2]).toBe(2);
    expect(errors).toEqual([]);
    await page.close();
  }, 60000);

  it('a gunner seat: seat 2\'s right stick slews the car\'s turret, seat 1\'s stick drives it', async () => {
    const car = { id: 'car', pilotable: true, rule: { type: 'drive', topSpeed: 20, eye: 0 }, body: { type: 'mesh', shape: 'box', size: [2, 4, 1.4] }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 },
      turret: { mount: { at: [0, 0, 1.6], look: 0.1, stabilized: true, traverse: { rate: 140, accel: 700 }, elevation: { rate: 60, accel: 300, min: -6, max: 30 } }, gun: { barrel: 1.3 } },
      weapon: { fireClass: 'sight', auto: true, cooldown: 0.15, magazine: 40, reload: 2.5, damage: 1, range: 40 } };
    const html = emitThreeWorld({ faces: [floor], entities: [car], camera: { rule: 'follow', target: 'car', dist: 11, height: 4.5 }, seats: { bodies: [], crew: { 2: { body: 'car', as: 'gunner' } } }, inline: true });
    if (!browser) return;
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent(html.replace('<head>', '<head>' + PADS), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world && window.__mojSeats, { timeout: 20000 });
    const frames = (n) => page.evaluate((n) => new Promise((r) => { const f = () => (--n ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }), n);
    const tap = async (i) => { await page.evaluate((i) => { window.__pads[i].buttons[0] = { pressed: true, value: 1 }; }, i); await frames(3); await page.evaluate((i) => { window.__pads[i].buttons[0] = { pressed: false, value: 0 }; }, i); await frames(3); };
    await tap(0); await tap(1);
    expect(await page.evaluate(() => window.__mojSeats().seats.map((s) => s.n))).toEqual([1, 2]);
    const st = () => page.evaluate(() => { const c = window.__mojCtrl.world.byId.car; return { yaw: c.turret.yaw ?? 0, x: c.transform.pos[0], y: c.transform.pos[1] }; });
    const a = await st();
    await page.evaluate(() => { window.__pads[1].axes[2] = 1; });   // seat 2's right stick, hard over
    await frames(30);
    await page.evaluate(() => { window.__pads[1].axes[2] = 0; });
    const b = await st();
    expect(Math.abs(b.yaw - a.yaw)).toBeGreaterThan(10);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(0.2);     // the car never moved for it
    await page.evaluate(() => { window.__pads[0].axes[1] = -1; });  // seat 1's stick: the throttle
    await frames(40);
    const c = await st();
    expect(Math.hypot(c.x - b.x, c.y - b.y)).toBeGreaterThan(0.5);
    expect(errors).toEqual([]);
    await page.close();
  }, 60000);

  it('a split screen: two pads, two views, each its own eye on its own body', async () => {
    const eyeHero = (id, x, col) => ({ ...hero(id, x), rule: { type: 'platform', eye: 1.6, speed: 6, turnMode: 'look' }, body: { type: 'mesh', shape: 'box', size: [0.6, 0.6, 1.6], color: col } });
    const html = emitThreeWorld({ faces: [floor], entities: [eyeHero('p1', 0, '#e5483b'), eyeHero('p2', 6, '#3b7be5')], camera: { rule: 'eye', target: 'p1', height: 1.6, hideTarget: true }, seats: { bodies: ['p2'], frame: 'split' }, inline: true });
    expect(html).toMatch(/__splitViews/);
    expect(world({ bodies: ['p2'] })).not.toMatch(/__splitViews/);
    if (!browser) return;
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.setContent(html.replace('<head>', '<head>' + PADS), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.world && window.__mojSeats && window.__mojSplit, { timeout: 20000 });
    const frames = (n) => page.evaluate((n) => new Promise((r) => { const f = () => (--n ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }), n);
    const tap = async (i) => { await page.evaluate((i) => { window.__pads[i].buttons[0] = { pressed: true, value: 1 }; }, i); await frames(3); await page.evaluate((i) => { window.__pads[i].buttons[0] = { pressed: false, value: 0 }; }, i); await frames(3); };
    expect((await page.evaluate(() => window.__mojSplit())).views).toBeLessThan(2);   // nobody, or one seat: the one view
    await tap(0); await tap(1);
    await frames(6);
    expect(await page.evaluate(() => window.__mojSplit())).toEqual({ views: 2, cams: [2] });
    // seat 2's eye where its body stands, at its eye's height, looking its way
    const eye = await page.evaluate(() => { const w = window.__mojCtrl.world, c = w.seatCams[2], b = w.byId.p2; return [c.transform.pos[0] - b.transform.pos[0], c.transform.pos[2] - b.transform.pos[2], c.transform.heading - b.transform.heading]; });
    expect(eye[0]).toBeCloseTo(0, 6); expect(eye[1]).toBeCloseTo(1.6, 6); expect(eye[2]).toBeCloseTo(0, 6);
    // seat 2's right stick turns its own body, and its view with it; seat 1's stays
    const h0 = await page.evaluate(() => [window.__mojCtrl.world.byId.p1.transform.heading, window.__mojCtrl.world.byId.p2.transform.heading]);
    await page.evaluate(() => { window.__pads[1].axes[2] = 1; }); await frames(20); await page.evaluate(() => { window.__pads[1].axes[2] = 0; });
    const h1 = await page.evaluate(() => [window.__mojCtrl.world.byId.p1.transform.heading, window.__mojCtrl.world.byId.p2.transform.heading]);
    expect(Math.abs(h1[1] - h0[1])).toBeGreaterThan(0.2);
    expect(h1[0]).toBeCloseTo(h0[0], 6);
    expect(errors).toEqual([]);
    await page.close();
  }, 60000);
});
