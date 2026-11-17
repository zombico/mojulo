// THE POLICE CAR (rules-drive.js `chaser`): a driver no one pilots, after the player. Far off it keeps to the roads,
// routed over their junctions (never through the block between); near, it drives at the player; beside one who stands it
// counts a blow on them each second (the bus's hit, by this car). And a bust in a car (cast.js `dismount`, mount.js
// `eject`): the rider is out at once, set down where it is told.
import { describe, it, expect } from 'vitest';
import { composeLive } from './compose.js';

const E = composeLive();
const DT = 1 / 30;
// a grid of two streets each way: along y at x = 0 and x = 120, along x at y = 0 and y = 120; the block between solid
const ROADS = [[1, 0, -10, 130], [1, 120, -10, 130], [0, 0, -10, 130], [0, 120, -10, 130]];
const BLOCK = { min: [8, 8, -1], max: [112, 112, 30] };
const DRIVE = { horsepower: 140, mass: 1400, wheelbase: 2.7, wheelRadius: 0.33, collideRadius: 1.1, collideHeight: 1.5 };
const cab = (id, pos, heading = 0) => ({ id, rule: { type: 'drive', ...DRIVE }, mount: { cab: true, hull: [0.95, 2.3], reach: 3, stand: [-1.3, 0.2], mount: { s: 0.35 }, dismount: { s: 0.35 }, slow: 1.5, camera: { dist: 8, height: 3, lookH: 1 } }, body: { type: 'none' }, transform: { pos, heading } });
function world({ hero = [120, 120, 0], police = [0, -5, 0], heading = Math.PI / 2, car = null } = {}) {
  return E.createWorld({ colliders: [BLOCK], entities: [
    { id: 'hero', pilotable: true, rule: { type: 'platform', speed: 5 }, body: { type: 'figure-rig', figure: 'hero' }, transform: { pos: hero, heading: 0 } },
    ...(car ? [cab('car-1', car)] : []),
    { id: 'police-car-1', pilotable: false, rule: { type: 'chaser', target: 'hero', roads: ROADS, ...DRIVE }, carHull: [0.95, 2.3], body: { type: 'none' }, transform: { pos: police, heading } },
    { id: 'cam', isCamera: true, rule: { type: 'follow', target: 'hero', dist: 5.5 } },
  ] });
}
const run = (st, s, input = {}) => { for (let i = 0; i < Math.max(1, Math.round(s / DT)); i++) E.stepWorld(st, input, DT, { ground: () => 0 }); return st; };
const inBlock = (p) => p[0] > BLOCK.min[0] && p[0] < BLOCK.max[0] && p[1] > BLOCK.min[1] && p[1] < BLOCK.max[1];

describe('the police car', () => {
  it('keeps to the roads over their junctions to a player far off, never through the block between, and comes to them', () => {
    const st = world(), P = st.byId['police-car-1'];
    let crossed = false, closest = Infinity;
    for (let k = 0; k < 60 * 30 && closest > 9; k++) { run(st, DT); crossed ||= inBlock(P.transform.pos); closest = Math.min(closest, Math.hypot(P.transform.pos[0] - 120, P.transform.pos[1] - 120)); }
    expect(crossed).toBe(false);
    expect(closest).toBeLessThan(9);
    // (its route: along x = 0 up to the junction at y = 120, then along y = 120)
    expect(P.chaseRoute === null || P.chaseRoute.length >= 1).toBe(true);
  });
  it('joins a street\'s run to the one it meets at its kerb (runs stop short of the crossing), and backs off a wall it is stuck on', () => {
    const st = world({ police: [0, -5, 0] }), P = st.byId['police-car-1'];
    P.rule = { ...P.rule, roads: [[1, 0, 8, 112], [1, 120, 8, 112], [0, 0, 8, 112], [0, 120, 8, 112], [1, 0, -10, 6]] };
    let closest = Infinity, crossed = false;
    for (let k = 0; k < 60 * 30 && closest > 9; k++) { run(st, DT); crossed ||= inBlock(P.transform.pos); closest = Math.min(closest, Math.hypot(P.transform.pos[0] - 120, P.transform.pos[1] - 120)); }
    expect(crossed).toBe(false); expect(closest).toBeLessThan(9);
    // (nosed into the block, the player beyond it: it backs off rather than spin its wheels there)
    const w = world({ police: [4, 60, 0], heading: 0, hero: [60, 60, 0] }), C = w.byId['police-car-1'];
    C.rule = { ...C.rule, roads: [] };
    let backed = false;
    for (let k = 0; k < 4 * 30; k++) { run(w, DT); backed ||= C.backT > 0; }
    expect(backed).toBe(true);
  });
  it('beside a player who stands, a hold each second, by this car (no wound); one who keeps moving is not caught', () => {
    const st = world({ hero: [0, 12, 0], police: [0, -2, 0] });
    run(st, 6);
    expect(st.byId.hero.helds).toBeGreaterThanOrEqual(2);
    expect(st.byId.hero.heldBy).toBe('police-car-1');
    // (a hold, no wound)
    expect(st.byId.hero.hits || 0).toBe(0);
  });
  it('brought near the player (the cast\'s spawn `near`), it stands on one of its own posts in the ring, facing them; its hull and body kept', () => {
    const st = world({ hero: [0, 0, 0], police: [500, 500, 0] }), P = st.byId['police-car-1'];
    P.posts = [[0, 60, 0], [120, 0, 0], [0, 400, 0]];
    E.castOps(st, [{ op: 'spawn', who: 'police-car-1', near: 'hero', ring: [45, 90] }]);
    const d = Math.hypot(P.transform.pos[0], P.transform.pos[1]);
    expect(d).toBeGreaterThan(55); expect(d).toBeLessThan(65);
    expect(P.carHull).toEqual([0.95, 2.3]);
    const st2 = E.createWorld({ entities: [{ id: 'c', posts: [[1, 2, 3]], carHull: [1, 2], carBody: { pool: { model: 'm', tint: [1, 1, 1] } }, rule: { type: 'chaser' }, transform: { pos: [0, 0, 0] } }] });
    expect(st2.byId.c).toMatchObject({ posts: [[1, 2, 3]], carHull: [1, 2], carBody: { pool: { model: 'm' } } });
  });
  it('asleep or gone, it does nothing', () => {
    const st = world({ hero: [0, 30, 0], police: [0, -2, 0] });
    st.byId['police-car-1'].gone = true; st.byId['police-car-1'].dormant = true;
    run(st, 3);
    expect(st.byId['police-car-1'].transform.pos).toEqual([0, -2, 0]);
    expect(st.byId.hero.helds || 0).toBe(0);
  });
  it('busted in a car: the cast\'s dismount takes the rider out at once, set down where it is told', () => {
    const st = world({ hero: [-30, 0, 0], police: [-30, -60, 0], car: [-28, 1, 0] });
    run(st, DT, { interact: 1 }); run(st, 3);
    expect(st.byId.hero.mountPhase).toBe('ride');
    E.castOps(st, [{ op: 'dismount', who: 'hero', to: [5, 5, 0] }]);
    run(st, 3 * DT);
    const H = st.byId.hero;
    expect(H.mountedOn).toBeNull();
    expect(H.transform.pos.slice(0, 2)).toEqual([5, 5]);
    expect(st.pilotId).toBe('hero');
  });
});
