// A CAB's laws (mount.js `mount.cab`): a walker in reach of a car gets INTO it with interact (no riding clips: any
// walker), is gone from the world while it is in, and the car is the pilot on its own drive rule; interact when it is
// slow sets the walker down at its door, the pilot again, clear of a wall that stands there. The page's prompt says
// "get in" and "get out" only where a cab is; a page of horses alone is as it was.
import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';
import { mountRideScript } from '../../scene/channels/mount-ride.js';

const E = composeLive();
const DT = 1 / 30;
const car = (id, pos, heading = 0) => ({
  id, rule: { type: 'drive', horsepower: 140, mass: 1400, wheelbase: 2.7, wheelRadius: 0.33, collideRadius: 1.1, collideHeight: 1.5 },
  mount: { cab: true, reach: 3, stand: [-1.3, 0.2], mount: { s: 0.35 }, dismount: { s: 0.35 }, slow: 1.5, camera: { dist: 8, height: 3, lookH: 1 } },
  body: { type: 'figure-rig', figure: id }, transform: { pos, heading },
});
function world({ colliders } = {}) {
  return E.createWorld({ ...(colliders ? { colliders } : {}), entities: [
    { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5 }, body: { type: 'figure-rig', figure: 'hero' }, transform: { pos: [0, 0, 0], heading: 0 } },
    car('car-1', [2, 1, 0]),
    { id: 'cam', isCamera: true, rule: { type: 'follow', target: 'hero', dist: 5.5 } },
  ] });
}
const run = (st, s, input = {}) => { for (let i = 0; i < Math.max(1, Math.round(s / DT)); i++) E.stepWorld(st, input, DT, { ground: () => 0 }); return st; };
const getIn = (st) => { run(st, DT, { interact: 1 }); return run(st, 4); };

describe('a cab', () => {
  it('any walker in reach gets in: it walks to the door, is gone from the world, and the car is the pilot', () => {
    const st = world();
    run(st, DT, { interact: 1 });
    expect(st.byId.hero.mountedOn).toBe('car-1');
    expect(st.byId.hero.mountPhase).toBe('approach');
    expect(st.byId.hero.gone).toBeFalsy();
    run(st, 4);
    const p = st.byId.hero, c = st.byId['car-1'];
    expect(p.mountPhase).toBe('ride');
    expect(p.gone).toBe(true);
    expect(st.pilotId).toBe('car-1');
    expect(st.camera.rule.target).toBe('car-1');
    expect(st.camera.rule.dist).toBe(8);
    expect((st.mountEvents ?? []).map((e) => e.type)).toEqual(['mounting', 'mounted']);
    // (carried in it)
    expect(Math.hypot(p.transform.pos[0] - c.transform.pos[0], p.transform.pos[1] - c.transform.pos[1])).toBeLessThan(1e-9);
  });
  it('stands while no one drives it: the throttle its driver-to-be holds on the way to its door moves nothing', () => {
    const st = world(), c = st.byId['car-1'], at = c.transform.pos.slice();
    run(st, DT, { interact: 1, forward: 1 });
    run(st, 1, { forward: 1 });
    expect(st.byId.hero.mountPhase).toBe('approach');
    expect(c.transform.pos.slice(0, 2)).toEqual(at.slice(0, 2));
    // (and a car simply parked, no one near, the same)
    const lone = world(); lone.byId.hero.transform.pos = [40, 40, 0];
    run(lone, 2, { forward: 1 });
    expect(lone.byId['car-1'].transform.pos.slice(0, 2)).toEqual([2, 1]);
    // (in, the same throttle drives it)
    run(st, 5, { forward: 1 });
    expect(st.pilotId).toBe('car-1');
    expect(Math.hypot(c.transform.pos[0] - at[0], c.transform.pos[1] - at[1])).toBeGreaterThan(3);
  });
  it('drives on its own rule: the throttle moves it, its rider with it', () => {
    const st = getIn(world()), c = st.byId['car-1'], x0 = c.transform.pos.slice();
    run(st, 3, { forward: 1 });
    expect(Math.hypot(c.transform.pos[0] - x0[0], c.transform.pos[1] - x0[1])).toBeGreaterThan(5);
    expect(c.speed).toBeGreaterThan(3);
    expect(st.byId.hero.transform.pos[0]).toBeCloseTo(c.transform.pos[0], 9);
  });
  it('lets no one out at speed; slow, the walker is set down at its door, the pilot again, in the world', () => {
    const st = getIn(world()), c = st.byId['car-1'];
    run(st, 3, { forward: 1 });
    run(st, DT, { forward: 1, interact: 1 });
    expect(st.byId.hero.mountPhase).toBe('ride');
    // (braked to a stop, then out)
    run(st, 6, { forward: -1 }); run(st, 2);
    c.speed = 0;
    run(st, DT, { interact: 1 }); run(st, 1);
    const p = st.byId.hero;
    expect(p.mountedOn).toBeNull();
    expect(p.gone).toBe(false);
    expect(st.pilotId).toBe('hero');
    expect(st.camera.rule.target).toBe('hero');
    expect(st.camera.rule.dist).toBe(5.5);
    expect(p.rule.type).toBe('platform');
    const d = Math.hypot(p.transform.pos[0] - c.transform.pos[0], p.transform.pos[1] - c.transform.pos[1]);
    expect(d).toBeGreaterThan(1); expect(d).toBeLessThan(2);
    expect(c.riderId).toBeNull();
  });
  it('sets its rider down clear of a wall that stands at its door', () => {
    // (a wall along the car's left, where its door opens: heading 0 is +x, its left +y)
    const wall = { min: [-10, 1.6, -1], max: [20, 6, 4] };
    const st = world({ colliders: [wall] });
    getIn(st); st.byId['car-1'].speed = 0;
    run(st, DT, { interact: 1 }); run(st, 1);
    const p = st.byId.hero.transform.pos;
    expect(st.byId.hero.mountedOn).toBeNull();
    expect(p[1] > wall.min[1] && p[1] < wall.max[1] && p[0] > wall.min[0] && p[0] < wall.max[0]).toBe(false);
  });
  it('the page says get in and get out only where a cab is', () => {
    expect(mountRideScript({ cab: true })).toContain('get in');
    expect(mountRideScript({ cab: true })).toContain('get out');
    expect(mountRideScript()).not.toContain('get in');
    expect(mountRideScript()).toContain("ask = 'ride'");
  });
});

describe('a cab\'s hull (mount.hull: a box turned with its car)', () => {
  const hulled = (id, pos, heading = 0) => { const c = car(id, pos, heading); return { ...c, mount: { ...c.mount, hull: [0.9, 2.2], stand: [-1.4, 0.2] } }; };
  const two = (other) => E.createWorld({ entities: [
    { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5, collideRadius: 0.3 }, body: { type: 'figure-rig', figure: 'hero' }, transform: { pos: [0, 2, 0], heading: 0 } },
    hulled('car-1', [0, 0, 0]), other,
    { id: 'cam', isCamera: true, rule: { type: 'follow', target: 'hero', dist: 5.5 } },
  ] });
  const overlap = (a, b) => Math.abs(a.transform.pos[0] - b.transform.pos[0]) < 4.4 - 1e-6 && Math.abs(a.transform.pos[1] - b.transform.pos[1]) < 1.8 - 1e-6;
  it('a car driven into a parked one stops against it: never inside it, its speed lost, the parked one where it stood', () => {
    const st = two(hulled('car-2', [12, 0, 0]));
    getIn(st);
    expect(st.pilotId).toBe('car-1');
    run(st, 6, { forward: 1 });
    const a = st.byId['car-1'], b = st.byId['car-2'];
    expect(b.transform.pos.slice(0, 2)).toEqual([12, 0]);
    expect(overlap(a, b)).toBe(false);
    expect(a.transform.pos[0]).toBeGreaterThan(7); expect(a.transform.pos[0]).toBeLessThanOrEqual(12 - 4.4 + 1e-6);
    expect(Math.abs(a.speed)).toBeLessThan(1);
    expect(a.bumped).toBeGreaterThan(0.2);
  });
  it('struck on its corner by a car across its way, it is pushed out the nearer side', () => {
    const st = two(hulled('car-2', [8, 0.6, 0], Math.PI / 2));
    getIn(st); run(st, 5, { forward: 1 });
    const a = st.byId['car-1'], b = st.byId['car-2'];
    // (car-2 stands across: its box 1.8 along x, 4.4 along y)
    expect(a.transform.pos[0] + 2.2).toBeLessThanOrEqual(8 - 0.9 + 0.05);
    expect(b.transform.pos.slice(0, 2)).toEqual([8, 0.6]);
  });
  it('a body on foot does not walk through a car, and one with no hull is as it was', () => {
    const st = two(hulled('car-2', [40, 40, 0]));
    // (the hero beside car-1's left side, walking at it: -y)
    st.byId.hero.transform.heading = -Math.PI / 2;
    run(st, 3, { forward: 1 });
    expect(st.byId.hero.transform.pos[1]).toBeGreaterThanOrEqual(0.9 + 0.3 - 1e-6);
    const bare = world(); bare.byId.hero.transform.pos = [2, 4, 0]; bare.byId.hero.transform.heading = -Math.PI / 2;
    run(bare, 3, { forward: 1 });
    expect(bare.byId.hero.transform.pos[1]).toBeLessThan(0);
  });
});

describe('the traffic the page hands the world (state.trafficHulls)', () => {
  const hulled = (id, pos, heading = 0) => { const c = car(id, pos, heading); return { ...c, mount: { ...c.mount, hull: [0.9, 2.2], stand: [-1.4, 0.2] } }; };
  it('holds: a car driven into one stops against it, and a body on foot does not walk through it', () => {
    const st = E.createWorld({ entities: [
      { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5, collideRadius: 0.3 }, body: { type: 'figure-rig', figure: 'hero' }, transform: { pos: [0, 2, 0], heading: 0 } },
      hulled('car-1', [0, 0, 0]),
      { id: 'cam', isCamera: true, rule: { type: 'follow', target: 'hero', dist: 5.5 } },
    ] });
    // (a van stopped across the road ahead, and one beside where the hero will be set down)
    st.trafficHulls = [{ p: [14, 0, 0], heading: 0, hull: [1, 2.6] }, { p: [40, 0, 0], heading: 0, hull: [1, 2.6] }];
    getIn(st); run(st, 6, { forward: 1 });
    const a = st.byId['car-1'];
    expect(a.transform.pos[0]).toBeGreaterThan(7);
    expect(a.transform.pos[0] + 2.2).toBeLessThanOrEqual(14 - 2.6 + 1e-6);
    expect(Math.abs(a.speed)).toBeLessThan(1);
    // (on foot, walked at it: stopped at its tail)
    a.speed = 0; run(st, 0.5); run(st, DT, { interact: 1 }); run(st, 2);
    expect(st.pilotId).toBe('hero');
    const h = st.byId.hero; h.transform.pos = [30, 0, 0]; h.transform.heading = 0;
    run(st, 3, { forward: 1 });
    expect(h.transform.pos[0]).toBeGreaterThan(33);
    expect(h.transform.pos[0]).toBeLessThanOrEqual(40 - 2.6 - 0.3 + 1e-6);
  });
});
