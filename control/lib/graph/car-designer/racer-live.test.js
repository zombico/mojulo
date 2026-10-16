// The live racer in the page (an e2e suite: a real browser, skipped when none is installed): one racer driven through
// the page's own step, throttle, a hard turn, the brake; its bones read back. The front wheels yaw with the steer and
// the rear ones never; the body squats on the throttle, leans OUT of the turn and dives on the brake; the steering
// wheel turns with the steer; at rest it is the bake's rest pose. And its juice: puffs at idle, the throttle's flame,
// sparks and smoke in a hard corner, a boost's flame; its status and the big effects: brake lamps, a boost's shock and
// the speed lines, impact stars and the dizzy ones, a white flash, a shield, a star's cycling colours.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { rollEgocube } from '../egocube/egocube.js';
import { racerFromSheet, solveRacer } from './racer.js';
import { vehicleRule } from '../roads/vehicles.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

let exe = null, browser = null, shots = null, juice = null;
const S = solveRacer(racerFromSheet(rollEgocube({ facets: { archetype: 'explorer' }, seed: 4 }), { seed: 4 }), { seed: 4 });
beforeAll(async () => {
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  const puppeteer = (await import(pathToFileURL(createRequire(import.meta.url).resolve('puppeteer-core')).href)).default;
  browser = await puppeteer.launch({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
  const html = emitThreeWorld({ faces: [{ corners: [[-200, -200, 0], [200, -200, 0], [200, 200, 0], [-200, 200, 0]], fill: '#8fb36a' }], cameras: [{ name: 'c', worldFraming: { cameraPosition: [-6, -6, 4], lookAt: [0, 0, 0.5], horizontalFov: 60, pictureCenter: [560, 390] } }], viewBox: { width: 640, height: 448 }, title: 'live', metersPerUnit: 1,
    entities: [{ id: 'car', pilotable: true, rule: vehicleRule('kart'), body: { type: 'figure-rig', figure: 'racer' }, transform: { pos: [0, 0, 0], heading: 0 } }], figures: { racer: S.figure }, pilot: 'car', fx: { states: { none: 'pulse' } }, inline: true, hud: false });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.bodies && window.__mojCtrl.bodies.car, { timeout: 20000 });
  shots = await page.evaluate(() => {
    const C = window.__mojCtrl, e = C.world.entities.find((x) => x.id === 'car'), rig = C.bodies.car.userData.rigFig;
    const read = () => Object.fromEntries(rig.fig.bones.map((b, i) => [b.id, Array.from(rig.boneMeshes[i].matrix.elements)]));
    const run = (n, input) => { for (let i = 0; i < n; i++) C.step(1 / 60, input); return { steer: e.steerAngle || 0, bones: read() }; };
    return { rest: run(1, { forward: 0, turn: 0 }), launch: run(45, { forward: 1, turn: 0 }), turn: run(60, { forward: 1, turn: 1 }), brake: run(20, { forward: -1, turn: 0 }) };
  });
  // the juice: idle, throttle, a hard corner, a boost (set by hand: a game's), a landing (its edge, by hand)
  const fresh = await browser.newPage();
  await fresh.setContent(html, { waitUntil: 'domcontentloaded' });
  await fresh.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.bodies && window.__mojCtrl.bodies.car, { timeout: 20000 });
  juice = await fresh.evaluate(() => {
    const C = window.__mojCtrl, e = C.world.entities.find((x) => x.id === 'car'), rj = C.bodies.car.userData.rigFig.rj;
    const run = (n, input, set = {}) => { for (let i = 0; i < n; i++) { Object.assign(e, set); C.step(1 / 60, input); } return { alive: { ...rj.alive }, flames: rj.flames.filter((f) => f.holder.visible).map((f) => f.row.id) }; };
    const idle = run(60, { forward: 0, turn: 0 }), throttle = run(30, { forward: 1, turn: 0 }), corner = run(80, { forward: 1, turn: 1 });
    const boost = run(20, { forward: 1, turn: 0 }, { boosting: true });
    run(1, { forward: 1, turn: 0 }, { boosting: false, landed: true });
    // R4: the status shaders and the big effects (a hit, a shield, a star set by hand: a game's)
    const u = (slot) => rj.slot[slot] && rj.slot[slot][0], vals = (x) => x && { add: x.uAdd.value.x + x.uAdd.value.y + x.uAdd.value.z, mix: x.uMix.value, tint: x.uTint.value.x };
    const shocks0 = rj.fired.boostShock || 0, stars0 = rj.fired.impactStars || 0, dizzy0 = rj.fired.dizzy || 0;
    run(10, { forward: 1, turn: 0 }, { landed: false, boosting: true });
    const surge = { screen: rj.screen, shocks: (rj.fired.boostShock || 0) - shocks0, streaks: rj.alive.motionLines || 0 };
    run(6, { forward: -1, turn: 0 }, { boosting: false });
    const brake = vals(u('brake'));
    e.speed = 0.3; run(2, { forward: 0, turn: 0 });
    const impact = { stars: (rj.fired.impactStars || 0) - stars0, dizzy: (rj.fired.dizzy || 0) - dizzy0, flash: vals(u('all')).mix };
    run(20, { forward: 0, turn: 0 });
    const shield = (run(5, { forward: 0, turn: 0 }, { shield: true }), rj.bubble && rj.bubble.visible);
    const star = [0, 1, 2].map(() => (run(4, { forward: 0, turn: 0 }, { shield: false, star: true }), vals(u('all')).mix));
    return { idle, throttle, corner, boost, brake, surge, impact, shield, star, rows: rj.J.rows.map((r) => r.id) };
  });
}, 60000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

const yaw = (m) => Math.atan2(m[1], m[0]), roll = (m) => Math.asin(Math.max(-1, Math.min(1, m[2]))), pitch = (m) => Math.asin(Math.max(-1, Math.min(1, m[6])));
describe('the live racer', () => {
  it('steers, squats, leans out of a turn and dives, in the page', () => {
    if (!exe) return;   // (no browser on this host: the bake's live spec is the node suite's)
    const { rest, launch, turn, brake } = shots;
    expect(Math.abs(roll(rest.bones.root)) + Math.abs(pitch(rest.bones.root))).toBeLessThan(1e-3);
    expect(pitch(launch.bones.root)).toBeGreaterThan(0.05);                       // a squat: the nose up
    expect(Math.abs(turn.steer)).toBeGreaterThan(0.05);
    expect(Math.sign(yaw(turn.bones.wheelFL))).toBe(Math.sign(turn.steer));        // the front wheels into the turn
    expect(Math.abs(yaw(turn.bones.wheelFL))).toBeGreaterThan(Math.abs(turn.steer));   // past physics
    expect(Math.abs(yaw(turn.bones.wheelRL))).toBeLessThan(1e-3);                  // the rear never steer
    expect(Math.sign(roll(turn.bones.root))).toBe(-Math.sign(turn.steer));        // the body leans OUT of the turn
    expect(Math.abs(roll(turn.bones.root))).toBeGreaterThan(0.03);
    if (turn.bones.steering) expect(Math.abs(roll(turn.bones.steering) - roll(turn.bones.root))).toBeGreaterThan(0.05);
    expect(pitch(brake.bones.root)).toBeLessThan(-0.03);                           // a dive
  });
  it('shows each state at its anchors: idle puffs, the throttle\'s flame, sparks and smoke in a hard corner, a boost\'s flame', () => {
    if (!exe) return;
    const { idle, throttle, corner, boost } = juice;
    expect(idle.alive.idlePuff).toBeGreaterThan(0);
    expect(throttle.flames).toContain('throttleFlame');
    expect(corner.alive.driftSpark).toBeGreaterThan(0);
    expect(corner.alive.skidSmoke).toBeGreaterThan(0);
    expect(boost.flames).toContain('boostFlame');
    expect(boost.flames).not.toContain('throttleFlame');
  });
  it('shows status and the big effects: brake lamps, a boost\'s shock and speed lines, impact stars and a flash, a shield, a star', () => {
    if (!exe) return;
    const { brake, surge, impact, shield, star } = juice;
    expect(brake.add).toBeGreaterThan(0.3);                 // the brake lamps glow
    expect(surge.shocks).toBe(1);                           // one shock on the boost's first frame
    expect(surge.screen).toBeGreaterThan(0.3);              // speed lines on the pilot's screen
    expect(surge.streaks).toBeGreaterThan(0);               // motion lines
    expect(impact.stars).toBe(1); expect(impact.dizzy).toBe(1);
    expect(impact.flash).toBeGreaterThan(0.2);              // the machine flashes white
    expect(shield).toBe(true);
    expect(star.every((m) => m > 0.4)).toBe(true);          // the star's colours cycling over the paint
  });
});
