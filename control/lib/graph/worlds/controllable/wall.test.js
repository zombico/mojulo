// THE WALL (wall.js, the city stalker): any collider box's side is a face a platform body with `wall` holds, crawls,
// rounds the corners of and mantles off onto its roof, and jumps or launches from. Each law on a few boxes, not a city.
import { describe, it, expect } from 'vitest';
import { createWorld, stepWorld } from '../controllable-world.js';

// the ground under a point: the highest box top at or below it, else the street at 0
const groundOf = (boxes) => ({ ground: (p) => boxes.reduce((g, b) => (p[0] >= b.min[0] && p[0] <= b.max[0] && p[1] >= b.min[1] && p[1] <= b.max[1] && b.max[2] <= p[2] + 1e-6 ? Math.max(g, b.max[2]) : g), 0) });
const hero = (rule = {}, pos = [0, 0, 0], heading = 0) => ({ id: 'hero', pilotable: true, rule: { type: 'platform', collideRadius: 0.35, collideHeight: 1.7, wall: true, ...rule }, transform: { pos, heading } });
const world = (boxes, h = hero()) => ({ w: createWorld({ entities: [h], colliders: boxes }), G: groundOf(boxes) });
const run = ({ w, G }, input, steps, dt = 1 / 60) => { for (let i = 0; i < steps; i++) stepWorld(w, typeof input === 'function' ? input(i) : input, dt, G); return w.byId.hero; };
// held forward until the body is up and over onto the roof, then let go of the keys
const climbOut = (W, most = 60 * 12) => { const h = W.w.byId.hero; for (let i = 0; i < most && !(h.walled && h.walled.end === 'top'); i++) run(W, { forward: 1 }, 1); return h; };
// a tower east of the hero: its west face at x = 2, 20 m tall
const TOWER = { min: [2, -5, 0], max: [8, 5, 20] };

describe('the wall: a face taken hold of', () => {
  it('is held walking into it, crawled up, and mantled onto its roof', () => {
    const W = world([TOWER]);
    const h = run(W, { forward: 1 }, 40);
    expect(h.walling).toMatchObject({ ax: 0, s: -1, at: 2 });
    expect(h.locomotion).toBe('wall_crawl');
    expect(h.transform.pos[0]).toBeCloseTo(2 - 0.35, 6);
    climbOut(W);
    expect(h.walled.end).toBe('top');
    expect(h.walling).toBeNull();
    expect(h.grounded).toBe(true);
    expect(h.transform.pos[2]).toBeCloseTo(20, 3);
    expect(h.transform.pos[0]).toBeGreaterThan(2);
  });

  it('is met in the air, a jump carrying the body to it', () => {
    const W = world([TOWER], hero({ wall: { ground: false } }));
    run(W, { forward: 1 }, 30);
    expect(W.w.byId.hero.walling).toBeFalsy();
    const h = run(W, (i) => ({ forward: 1, jump: i === 0 ? 1 : 0, jumpHeld: i < 10 ? 1 : 0 }), 30);
    expect(h.walling).toBeTruthy();
    expect(h.transform.pos[2]).toBeGreaterThan(0);
  });

  it('is not a low box, a narrow one, a box marked hold: false, or any box without `wall`', () => {
    for (const box of [{ min: [2, -5, 0], max: [8, 5, 1.5] }, { min: [2, -0.3, 0], max: [2.6, 0.3, 20] }, { ...TOWER, hold: false }]) {
      expect(run(world([box]), { forward: 1 }, 60).walling, JSON.stringify(box)).toBeFalsy();
    }
    const plain = run(world([TOWER], hero({ wall: undefined })), { forward: 1 }, 60);
    expect(plain.walling).toBeUndefined();
    expect(plain.transform.pos[0]).toBeLessThanOrEqual(2 - 0.35 + 1e-6);
  });

  it('rounds an outside corner onto the next face, and climbs a face of stacked boxes as one', () => {
    const W = world([TOWER]);
    run(W, { forward: 1 }, 30);
    // D (right) along the west face, facing east, is toward -y; past y = -5 the body rounds onto the south face
    const h = run(W, { strafe: 1 }, 60 * 2.5);
    expect(h.walling).toMatchObject({ ax: 1, s: -1, at: -5 });
    expect(h.transform.heading).toBeCloseTo(Math.PI / 2, 6);
    const stack = world([{ min: [2, -5, 0], max: [8, 5, 4] }, { min: [2, -5, 4], max: [8, 5, 12] }]);
    const s = climbOut(stack);
    expect(s.grounded).toBe(true);
    expect(s.transform.pos[2]).toBeCloseTo(12, 3);
  });

  it('jumps off: a tap kicks out and up, a held charge launches further, the body turned away', () => {
    const off = (frames) => {
      const W = world([TOWER]);
      run(W, { forward: 1 }, 30);
      const h = run(W, (i) => (i < frames ? { jumpHeld: 1, jump: i === 0 ? 1 : 0 } : {}), frames + 1);
      return { end: h.walled, vz: h.vel[2], out: -h.dashVel[0], heading: h.transform.heading };
    };
    const tap = off(2), launch = off(50);
    expect(tap.end.end).toBe('jump');
    expect(launch.end.end).toBe('launch');
    expect(tap.vz).toBeGreaterThan(0);
    expect(tap.out).toBeGreaterThan(0);
    expect(launch.end.power).toBeGreaterThan(tap.end.power * 1.5);
    expect(Math.cos(tap.heading)).toBeCloseTo(-1, 6);
  });

  it('lets go at the foot, and the platform rule stands the body on the street', () => {
    const W = world([TOWER]);
    run(W, { forward: 1 }, 90);
    const h = run(W, { forward: -1 }, 60 * 3);
    expect(h.walling).toBeNull();
    expect(h.walled.end).toBe('bottom');
    expect(h.transform.pos[2]).toBeCloseTo(0, 3);
  });

  it('perches still at a roof\'s lip, and dives falling fast off it', () => {
    const W = world([TOWER]);
    climbOut(W);
    const h = run(W, {}, 30);
    expect(h.perched).toBe(true);
    expect(h.locomotion).toBe('perch');
    h.transform.pos = [-20, 0, 40]; h.vel = [0, 0, -12]; h.grounded = false;
    run(W, {}, 1);
    expect(h.locomotion).toBe('dive');
  });

  it('keeps its metre defaults in the world\'s units: a world at half scale climbs the same face in the same time', () => {
    const half = (b) => ({ min: b.min.map((v) => v / 2), max: b.max.map((v) => v / 2) });
    const big = world([TOWER], hero({}, [1.5, 0, 0])), small = world([half(TOWER)], hero({ speed: 3, collideRadius: 0.175, collideHeight: 0.85, metre: 0.5 }, [0.75, 0, 0]));
    const a = run(big, { forward: 1 }, 200), b = run(small, { forward: 1 }, 200);
    expect(b.transform.pos[2]).toBeCloseTo(a.transform.pos[2] / 2, 3);
  });

  it('is the same run for the same input', () => {
    const go = () => { const W = world([TOWER]); return JSON.stringify(run(W, (i) => ({ forward: 1, strafe: i % 90 < 45 ? 1 : -1 }), 300).transform); };
    expect(go()).toBe(go());
  });
});

describe('the wall: the rest', () => {
  it('held still on a face, the body settles onto it: its own state, leant out from the wall, until it moves or lets go', () => {
    const W = world([TOWER]);
    const h = run(W, { forward: 1 }, 90);
    expect(h.walling).toBeTruthy();
    expect(h.locomotion).toBe('wall_crawl');
    run(W, {}, 10);
    expect(h.locomotion).toBe('wall_crawl');      // (not at once: a pause in a climb is not a rest)
    expect(h.tumble ?? null).toBeNull();
    run(W, {}, 60);
    expect(h.locomotion).toBe('wall_rest');
    expect(h.moving).toBe(true);                  // (so the page plays the state's clip, not the stand)
    // leant back from a wall it faces (east: +x), about its own left (+y)
    expect(h.tumble.angle).toBeCloseTo(-0.3, 6);
    expect(h.tumble.axis[1]).toBeCloseTo(1, 6);
    expect(h.gaitPhase).toBeGreaterThanOrEqual(0);
    expect(h.gaitPhase).toBeLessThan(1);
    const z = h.transform.pos[2];
    run(W, { forward: 1 }, 2);
    expect(h.locomotion).toBe('wall_crawl');
    expect(h.tumble).toBeNull();
    expect(h.transform.pos[2]).toBeGreaterThan(z);
    // let go from a rest (a jump off the face): upright again
    run(W, {}, 60);
    expect(h.locomotion).toBe('wall_rest');
    run(W, (i) => ({ jump: i < 2 ? 1 : 0 }), 6);
    expect(h.walling).toBeNull();
    expect(h.tumble ?? null).toBeNull();
  });

  it('rest: 0 keeps the body as it was held', () => {
    const W = world([TOWER], hero({ wall: { rest: 0 } }));
    const h = run(W, { forward: 1 }, 90);
    run(W, {}, 90);
    expect(h.locomotion).toBe('wall_crawl');
    expect(h.moving).toBe(false);
    expect(h.tumble ?? null).toBeNull();
  });
});

describe('the wall: the run', () => {
  // flung at the tower's west face across it: east and north, a little up
  const flung = (rule = {}, v = [10, 9, 3]) => {
    const W = world([TOWER], hero(rule, [0.4, -3, 8], Math.atan2(v[1], v[0]))), h = W.w.byId.hero;
    h.grounded = false; h.vel = [0, 0, v[2]]; h.dashVel = [v[0], v[1]];
    return { W, h };
  };
  it('met at speed in the air, the face is run: along it and up it with what the body brought, leant out from the wall', () => {
    const { W, h } = flung();
    let ran = 0;
    for (let i = 0; i < 40 && !(h.walling && h.walling.run); i++) run(W, { forward: 1 }, 1);
    expect(h.walling).toMatchObject({ ax: 0, s: -1, at: 2 });
    expect(h.walling.run).toBeTruthy();
    const p0 = [...h.transform.pos];
    for (let i = 0; i < 20 && h.walling && h.walling.run; i++) { run(W, { forward: 1 }, 1); if (h.locomotion === 'wall_run') ran++; }
    expect(ran).toBeGreaterThan(5);
    // carried north along the face and up it, held to its plane, the body turned the way it runs and leant off the wall
    expect(h.transform.pos[1]).toBeGreaterThan(p0[1] + 1);
    expect(h.transform.pos[2]).toBeGreaterThan(p0[2]);
    expect(h.transform.pos[0]).toBeCloseTo(2 - 0.35, 6);
  });

  it('ends in a hold when forward is let go, and a jump off it keeps the run\'s speed along the face', () => {
    const A = flung();
    for (let i = 0; i < 40 && !(A.h.walling && A.h.walling.run); i++) run(A.W, { forward: 1 }, 1);
    run(A.W, {}, 3);
    expect(A.h.walling).toBeTruthy();
    expect(A.h.walling.run ?? null).toBeNull();
    expect(A.h.locomotion).toBe('wall_crawl');
    expect(A.h.tumble ?? null).toBeNull();
    const B = flung();
    for (let i = 0; i < 40 && !(B.h.walling && B.h.walling.run); i++) run(B.W, { forward: 1 }, 1);
    run(B.W, { forward: 1 }, 4);
    const along = B.h.walling.run.vta;
    run(B.W, { forward: 1, jump: 1, jumpHeld: 1 }, 2);
    run(B.W, { forward: 1 }, 1);
    expect(B.h.walling).toBeNull();
    expect(B.h.walled.end).toBe('jump');
    expect(B.h.dashVel[1]).toBeGreaterThan(along * 0.8);
    expect(B.h.dashVel[0]).toBeLessThan(0);
  });

  it('run: false, or a body that walks at the face, holds at once as before', () => {
    const { W, h } = flung({ wall: { run: false } }, [10, 0, 0]);
    for (let i = 0; i < 40 && !h.walling; i++) run(W, { forward: 1 }, 1);
    expect(h.walling).toBeTruthy();
    expect(h.walling.run).toBeUndefined();
    const S = world([TOWER]), s = run(S, { forward: 1 }, 40);
    expect(s.walling.run).toBeUndefined();
    expect(s.locomotion).toBe('wall_crawl');
  });
});
