// A machine ridden astride in the page (an e2e suite: a real browser, skipped when none is installed): a motocross
// bike and a box trike, each driven through the page's own step on its class's drive rule, their bones read back. The
// bike leans INTO its turn by the rule's own lean (tan λ = v² κ / g), its front turned about the steering axis with the
// wheel, the rear wheel leaning with the machine and never steering; the box trike does not lean in, its inner front
// wheel lifts in a hard turn about the edge it would tip over. Riderless here (the rider is the root's faces and leans
// with it: the e2e quick game rides one); the bones are what is read.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cycleRideFigure } from './cycle-figure.js';
import { CYCLE_ARCHETYPES } from './cycle-archetypes.js';
import { vehicleRule, wheelLayout, VEHICLES } from '../roads/vehicles.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { resolveChromium, launchChromium, CHROMIUM_WEBGL_ARGS } from '../scene/chromium.js';

// one machine per way of standing, chosen in code: two wheels in line, and the quickest on three (a turn fast enough to
// near what tips it: a pedalled box trike never goes that fast, and never lifts)
const layoutOf = (k) => wheelLayout(VEHICLES[CYCLE_ARCHETYPES[k].physics]);
const inline = Object.keys(CYCLE_ARCHETYPES).find((k) => layoutOf(k) === 'inline' && CYCLE_ARCHETYPES[k].layout.some((e) => e.id === 'fork'));
const pull = (k) => VEHICLES[CYCLE_ARCHETYPES[k].physics].power / VEHICLES[CYCLE_ARCHETYPES[k].physics].mass;
const three = Object.keys(CYCLE_ARCHETYPES).filter((k) => ['sidecar', 'delta', 'tadpole'].includes(layoutOf(k))).sort((a, b) => pull(b) - pull(a))[0];

let exe = null, browser = null;
const shots = {};
const drive = async (archetype) => {
  const fig = await cycleRideFigure({ archetype, ride: true });
  const html = emitThreeWorld({ faces: [{ corners: [[-300, -300, 0], [300, -300, 0], [300, 300, 0], [-300, 300, 0]], fill: '#8fb36a' }], cameras: [{ name: 'c', worldFraming: { cameraPosition: [-6, -6, 4], lookAt: [0, 0, 0.5], horizontalFov: 60, pictureCenter: [560, 390] } }], viewBox: { width: 640, height: 448 }, title: 'ride', metersPerUnit: 1,
    entities: [{ id: 'bike', pilotable: true, rule: vehicleRule(CYCLE_ARCHETYPES[archetype].physics), body: { type: 'figure-rig', figure: 'm' }, transform: { pos: [0, 0, 0], heading: 0 } }], figures: { m: fig }, pilot: 'bike', fx: { states: { none: 'pulse' } }, inline: true, hud: false });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__mojCtrl && window.__mojCtrl.bodies && window.__mojCtrl.bodies.bike, { timeout: 20000 });
  const out = await page.evaluate(() => {
    const C = window.__mojCtrl, e = C.world.entities.find((x) => x.id === 'bike'), rig = C.bodies.bike.userData.rigFig;
    const read = () => Object.fromEntries(rig.fig.bones.map((b, i) => [b.id, Array.from(rig.boneMeshes[i].matrix.elements)]));
    const run = (n, input) => { for (let i = 0; i < n; i++) C.step(1 / 60, input); return { steer: e.steerAngle || 0, lean: e.lean ?? null, speed: e.speed || 0, bones: read() }; };
    return { rest: run(1, { forward: 0, turn: 0 }), launch: run(150, { forward: 1, turn: 0 }), turn: run(50, { forward: 1, turn: 1 }) };
  });
  await page.close();
  return { ...out, fig, errors };
};

beforeAll(async () => {
  try { exe = await resolveChromium({ allowFetch: false }); } catch { return; }
  browser = await launchChromium({ executablePath: exe, headless: true, args: CHROMIUM_WEBGL_ARGS });
  shots.inline = await drive(inline);
  shots.three = await drive(three);
}, 120000);
afterAll(async () => { if (browser) await browser.close().catch(() => {}); });

const yaw = (m) => Math.atan2(m[1], m[0]), roll = (m) => Math.asin(Math.max(-1, Math.min(1, m[2])));
// where a bone's rest head is drawn (the matrix applied to it): a wheel's hub
const at = (m, h) => [0, 1, 2].map((k) => m[k] * h[0] + m[4 + k] * h[1] + m[8 + k] * h[2] + m[12 + k]);

describe('a machine ridden in the page', () => {
  it('two wheels in line lean INTO the turn by the rule\'s own lean, the front turned about the steering axis', () => {
    if (!exe) return;   // (no browser on this host: the figure's live spec is the node suite's)
    const { rest, turn, fig, errors } = shots.inline;
    expect(errors).toEqual([]);
    expect(Math.abs(roll(rest.bones.root))).toBeLessThan(1e-3);
    expect(Math.abs(turn.steer)).toBeGreaterThan(0.02);
    expect(Math.sign(turn.lean)).toBe(Math.sign(turn.steer));
    // (the drawn lean toward the inside: a positive steer turns left, and the machine's top goes left)
    expect(Math.sign(roll(turn.bones.root))).toBe(Math.sign(turn.steer));
    expect(Math.abs(roll(turn.bones.root))).toBeGreaterThan(0.1);
    // the front, wheel and all, turns into the turn past the machine; the rear wheel leans with it and never steers
    expect(Math.sign(yaw(turn.bones.front) - yaw(turn.bones.root))).toBe(Math.sign(turn.steer));
    expect(Math.abs(roll(turn.bones.wheelR) - roll(turn.bones.root))).toBeLessThan(0.02);
    // the front wheel's hub stays on its fork: it orbits the head as the front turns (never left standing in place)
    const hubF = at(turn.bones.wheelF, fig.bones.find((b) => b.id === 'wheelF').head), base = at(turn.bones.front, fig.bones.find((b) => b.id === 'wheelF').head);
    expect(Math.hypot(hubF[0] - base[0], hubF[1] - base[1], hubF[2] - base[2])).toBeLessThan(0.02);
  });

  it('a three-wheeler does not lean in: its inner wheel lifts in a hard turn, about the edge it would tip over', () => {
    if (!exe) return;
    const { launch, turn, fig, errors } = shots.three;
    expect(errors).toEqual([]);
    expect(fig.live.lift).toBeTruthy();
    expect(Math.abs(turn.steer)).toBeGreaterThan(0.02);
    expect(turn.lean).toBe(null);
    // the body rolls toward the outside of the turn
    expect(Math.sign(roll(turn.bones.root))).toBe(-Math.sign(turn.steer));
    // the inner wheel of the two side by side (the left in a left turn) off the ground, the outer one on it
    const side = fig.bones.filter((b) => b.id.startsWith('wheel') && Math.abs(b.head[0]) > 0.1).sort((a, b) => a.head[0] - b.head[0]);
    const [inner, outer] = (turn.steer > 0 ? [side[0], side[side.length - 1]] : [side[side.length - 1], side[0]]).map((b) => b.id);
    const head = (id) => fig.bones.find((b) => b.id === id).head;
    // (read against the straight on the throttle: the squat pitches both alike)
    expect(at(turn.bones[inner], head(inner))[2] - at(launch.bones[inner], head(inner))[2]).toBeGreaterThan(0.03);
    expect(Math.abs(at(turn.bones[outer], head(outer))[2] - at(launch.bones[outer], head(outer))[2])).toBeLessThan(0.03);
  });
});
