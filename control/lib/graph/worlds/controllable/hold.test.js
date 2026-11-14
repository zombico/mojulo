import { describe, expect, it } from 'vitest';
import { composeLive } from './compose.js';

// A HOLD (cast.js `hold`, a belt's screen): the pilot kept between two marks along the way, the side camera's frame
// kept inside them, and the frame's depth held (side `keel`) as the hero walks toward and away from it. Absent, the
// hero walks on and the camera centres it, as it did.
const E = composeLive();
const DT = 1 / 60, hooks = { ground: () => 0 };
// the belt runs +y; the camera looks along -x (yaw π), so up the screen is -x and D runs +y
const mk = (cam = {}) => E.createWorld({
  entities: [{ id: 'h', pilotable: true, rule: { type: 'platform', eye: 0, speed: 6, move: 'world', moveYaw: Math.PI }, transform: { pos: [0, 2, 0], heading: Math.PI / 2 } }],
  camera: { rule: 'side', target: 'h', yaw: Math.PI, ...cam },
});
const run = (w, n, input = {}) => { for (let f = 0; f < n; f++) E.stepWorld(w, input, DT, hooks); return w; };
const hero = (w) => w.byId.h.transform.pos;

describe('the pilot is held between the marks', () => {
  it('it runs along the way and stops a body\'s width inside the far mark; let go, it runs on', () => {
    const w = mk();
    E.castOps(w, [{ op: 'hold', lo: 0, hi: 10 }]);
    run(w, 240, { strafe: 1 });
    expect(hero(w)[1]).toBeGreaterThan(9);
    expect(hero(w)[1]).toBeLessThan(10);
    run(w, 240, { strafe: -1 });
    expect(hero(w)[1]).toBeGreaterThan(0);
    expect(hero(w)[1]).toBeLessThan(1);
    E.castOps(w, [{ op: 'hold' }]);
    expect(w.hold).toBeNull();
    run(w, 240, { strafe: 1 });
    expect(hero(w)[1]).toBeGreaterThan(12);
  });
  it('it walks across the way freely (the hold is along it only)', () => {
    const w = mk();
    E.castOps(w, [{ op: 'hold', lo: 0, hi: 10 }]);
    run(w, 60, { forward: 1 });
    expect(hero(w)[0]).toBeLessThan(-3);                 // up the screen, away from the camera
    expect(hero(w)[1]).toBeCloseTo(2, 1);
  });
  it('absent, nothing holds it', () => { expect(hero(run(mk(), 240, { strafe: 1 }))[1]).toBeGreaterThan(20); });
});

describe('the side camera stays inside the screen', () => {
  it('its frame stops `ends` metres in from the marks while the hero walks to the edge', () => {
    const w = mk({ ends: 4 });
    E.castOps(w, [{ op: 'hold', lo: 0, hi: 20 }]);
    run(w, 120);
    expect(w.camera.lookAt[1]).toBeCloseTo(4, 2);       // the hero at 2 stands left of centre
    run(w, 400, { strafe: 1 });
    expect(hero(w)[1]).toBeGreaterThan(19);
    expect(w.camera.lookAt[1]).toBeCloseTo(16, 2);
  });
  it('a screen narrower than the frame is centred', () => {
    const w = mk({ ends: 8 });
    E.castOps(w, [{ op: 'hold', lo: 0, hi: 10 }]);
    run(w, 200);
    expect(w.camera.lookAt[1]).toBeCloseTo(5, 2);
  });
  it('keel: the frame\'s depth holds while the hero walks toward and away from the camera', () => {
    const w = mk({ keel: 0 });
    run(w, 60);
    const x0 = w.camera.transform.pos[0];
    run(w, 90, { forward: 1 });
    expect(Math.abs(hero(w)[0])).toBeGreaterThan(3);
    expect(w.camera.lookAt[0]).toBeCloseTo(0, 3);
    expect(w.camera.transform.pos[0]).toBeCloseTo(x0, 2);
    // (without it the frame follows the hero into depth)
    const v = run(mk(), 150, { forward: 1 });
    expect(Math.abs(v.camera.lookAt[0])).toBeGreaterThan(3);
  });
});
