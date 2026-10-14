// The live racer in the page (an e2e suite: a real browser, skipped when none is installed): one racer driven through
// the page's own step, throttle, a hard turn, the brake; its bones read back. The front wheels yaw with the steer and
// the rear ones never; the body squats on the throttle, leans OUT of the turn and dives on the brake; the steering
// wheel turns with the steer; at rest it is the bake's rest pose.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { rollEgocube } from '../egocube/egocube.js';
import { racerFromSheet, solveRacer } from './racer.js';
import { vehicleRule } from '../roads/vehicles.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

let exe = null, browser = null, shots = null;
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
});
