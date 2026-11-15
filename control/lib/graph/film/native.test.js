import { describe, it, expect } from 'vitest';
import { NATIVE, nativeShots, castTravel, stageFaces, nativeSet, nativeUnread } from './native.js';
import { actScene } from '../actor/scene.js';
import { coverScene } from '../actor/coverage.js';
import { filmReadout, orderStamp } from './readout.js';
import { ORDER_STATES, orderReadout, filmOfOrder } from './order.js';
import { sceneStamp } from './film.js';
import { ADVICE_HOME } from './departments.js';

// the film shot in mojulo: a scene's coverage as the page's capture shoots it, and its cast's way across the page.
// The smallest scene that still cuts and walks: two parts, three lines, a cross.
const SCENE = { cast: { ada: { mark: 'a' }, jon: { mark: 'b' } }, marks: { a: [-3, 0], b: [3, 4] }, script: 'ADA: You kept the key.\nJON: I kept everything.\nAda crosses to Jon.\nADA: Then open it.' };
const S = actScene(SCENE), coverage = coverScene(S);

describe('the film shot in mojulo', () => {
  it('shoots the coverage a camera a frame, the shots tiling the scene in order', () => {
    const N = nativeShots(S, coverage, { fps: 12 });
    expect(N.frames).toBe(Math.round(S.seconds * 12));
    expect(N.specs).toHaveLength(N.frames);
    expect(N.cuts.map((c) => c.shot)).toEqual(coverage.shots.map((s) => s.name));
    expect(N.cuts.reduce((n, c) => n + c.frames, 0)).toBe(N.frames);
    expect(N.cuts.every((c, i) => !i || c.from === N.cuts[i - 1].from + N.cuts[i - 1].frames)).toBe(true);
    // (the page's clock is the scene's, in milliseconds, never running back)
    expect(N.specs[0].t).toBe(0);
    expect(N.specs.every((s, i) => !i || s.t >= N.specs[i - 1].t)).toBe(true);
    expect(N.specs.at(-1).t).toBeLessThan(S.seconds * 1000);
    for (const s of N.specs) { expect(s.pos).toHaveLength(3); expect(s.vfov).toBeGreaterThan(1); expect(s.vfov).toBeLessThan(120); }
    expect(JSON.stringify(nativeShots(S, coverage, { fps: 12 }))).toBe(JSON.stringify(N));
  });

  it('stands its cameras in the page\'s units, on the set\'s floor and its ground, at the world\'s clock', () => {
    const flat = nativeShots(S, coverage, { fps: 6 }), in2 = nativeShots(S, coverage, { fps: 6, units: 2, floor: 3, lift: () => 1, clock: 40 });
    expect(in2.specs[0].pos[0]).toBeCloseTo(flat.specs[0].pos[0] / 2, 3);
    expect(in2.specs[0].pos[2]).toBeCloseTo((flat.specs[0].pos[2] + 4) / 2, 3);
    expect(in2.specs[0].t).toBe(40000);
    // (a wider frame, the same lens: less is seen top to bottom)
    expect(nativeShots(S, coverage, { fps: 6, aspect: 2.4 }).specs[0].vfov).toBeLessThan(flat.specs[0].vfov);
  });

  it('carries an actor along its blocking: its place a key a frame, its turn unwrapped the short way', () => {
    const T = castTravel(S.actors.ada.root, { seconds: S.seconds, fps: 8 });
    expect(T).toMatchObject({ from: 0, fps: 8, scale: 1 });
    expect(T.keys).toHaveLength((Math.ceil(S.seconds * 8) + 1) * 4);
    // (she starts on her mark and ends where her cross to Jon takes her)
    const first = S.actors.ada.root[0], last = S.actors.ada.root.at(-1);
    expect([T.keys[0], T.keys[1]]).toEqual([first.x, first.y].map((v) => Math.round(v * 1e4) / 1e4));
    expect(Math.hypot(T.keys.at(-4) - last.x, T.keys.at(-3) - last.y)).toBeLessThan(1e-3);
    expect(Math.hypot(last.x - first.x, last.y - first.y)).toBeGreaterThan(1);
    for (let i = 7; i < T.keys.length; i += 4) expect(Math.abs(T.keys[i] - T.keys[i - 4])).toBeLessThan(Math.PI);
    // (on a set: its units, its floor, its ground, the clock the scene starts at)
    const on = castTravel(S.actors.ada.root, { seconds: S.seconds, fps: 8, units: 4, floor: 2, lift: () => 2, clock: 30 });
    expect(on).toMatchObject({ from: 30, scale: 0.25 });
    expect(on.keys[2]).toBe(1);
    // (a turn through north is taken the short way, not round the long one)
    const turn = castTravel([{ t: 0, x: 0, y: 0, yaw: 170 }, { t: 1, x: 0, y: 0, yaw: -170 }], { seconds: 1, fps: 4 });
    expect(Math.abs(turn.keys.at(-1) - turn.keys[3])).toBeLessThan(0.4);
  });

  it('plays a scene with no set on a bare stage, and asks a set only for what its page performs', () => {
    const [floor] = stageFaces(S), pts = Object.values(S.actors).flatMap((A) => A.root);
    for (const p of pts) { expect(p.x).toBeGreaterThan(floor.corners[0][0]); expect(p.x).toBeLessThan(floor.corners[2][0]); expect(p.y).toBeGreaterThan(floor.corners[0][1]); expect(p.y).toBeLessThan(floor.corners[2][1]); }
    const cube = { kind: 'geocube', cube: 'valley-morning' }, city = { kind: 'city' };
    expect(nativeSet(cube, { hour: 'dusk', weather: 'rain', clouds: 'storm' })).toMatchObject({ manifest: { hour: 'dusk', weather: 'rain', clouds: 'storm' }, reads: ['weather', 'hour', 'clouds'] });
    expect(nativeSet(city, { hour: 'dusk', weather: 'rain' })).toEqual({ manifest: { kind: 'city', weather: 'rain' }, reads: ['weather'] });
    // (nothing asked: the set's own recipe, itself)
    expect(nativeSet(city, {}).manifest).toBe(city);
    expect(nativeUnread({ kind: 'geocube' }, { hour: 'dusk', clouds: 'storm' })).toEqual([]);
    const said = nativeUnread({ kind: 'city' }, { hour: 'dusk', wind: 'gale', props: { car: {} } });
    expect(said).toHaveLength(1);
    expect(said[0]).toMatchObject({ id: 'native-unread' });
    for (const w of ['props', 'wind', 'hour']) expect(said[0].says).toContain(w);
    expect(ADVICE_HOME['native-unread']).toBe('render');
    expect(NATIVE.width / NATIVE.height).toBeCloseTo(16 / 9, 3);
  });

  it('is what the studio asks for after the animatic, and what an order for the film waits on', () => {
    const F = { cast: { a: {} }, scenes: [{ id: 'x', cast: { a: {} }, script: 'A: Hi.' }] }, stamp = sceneStamp(F, 'x');
    const played = { x: { plan: { S: actScene({ cast: { a: {} }, script: 'A: Hi.' }), coverage: { shots: [] }, notes: [] } } };
    const boards = { storyboard: { scenes: { x: { stamp } } }, animatic: { motion_ref: 'mo_a' } }, approvals = { x: { board: stamp } };
    const next = (made) => filmReadout(F, played, { approvals, made }).next.at(-1)?.try ?? '';
    expect(next(boards)).toMatch(/run: 'film'/);
    // (shot: the high-end film is offered, never required; a film changed since is shot again)
    const shot = { ...boards, native: { motion_ref: 'mo_n', scenes: { x: { stamp } }, cut: { stamp: orderStamp(F) } } };
    expect(next(shot)).toMatch(/run: 'blender'/);
    expect(next({ ...shot, native: { ...shot.native, cut: { stamp: 'old' } } })).toMatch(/run: 'film'/);
    expect(next({ ...shot, native: { ...shot.native, pending: ['x'] } })).toMatch(/run: 'film'/);
    // (a film already made for Blender is not asked for another)
    expect(next({ ...boards, blender: { motion_ref: 'mo_b', scenes: { x: { stamp } } } })).not.toMatch(/run: 'film'/);
    // an order for the film: an event shot in mojulo is one the client can have
    const O = filmOfOrder({ title: 't', cast: { ada: 'sk_a' }, places: {}, events: [{ id: 'e', who: ['ada'], notes: 'n', script: 'ADA: Hi.' }], deliver: 'film' });
    const row = [{ id: 'e', stamp: sceneStamp(O, 'e'), board: 'open' }], made = { storyboard: { scenes: { e: { stamp: row[0].stamp } } }, animatic: {} };
    expect(orderReadout(O, row, { made })).toMatchObject({ ready: false, waiting: ['e'] });
    expect(orderReadout(O, row, { made: { ...made, blender: { scenes: { e: { stamp: row[0].stamp } } } } }).ready).toBe(false);
    const got = orderReadout(O, row, { made: { ...made, native: { scenes: { e: { stamp: row[0].stamp } } } } });
    expect(got).toMatchObject({ ready: true, waiting: [] });
    expect(got.events[0].state).toBe('shot');
    expect(ORDER_STATES.indexOf('shot')).toBeGreaterThan(ORDER_STATES.indexOf('filmed'));
  });
});
