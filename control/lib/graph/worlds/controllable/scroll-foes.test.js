// Blaze Gunner's foes, played (scroll-foes.js) on the scroll stage's runtime, their rows lowered from
// gameworld/scroll-stage/patterns.js. The concepts: a foe waits off the screen's right edge until the scroll brings it in
// and is never hit while it waits; in, it flies its path relative to the screen (straight back and out past the far
// edge, or in to its station, held, and out the way it came; a dive to the ship's height); its pattern is told before it
// is fired, never fired from off the screen or from on top of the ship; an aimed bullet heads at the ship, a ring goes
// out evenly, a wall leaves its gap in the half the ship is not in; a bullet in the hitbox costs hp and leaves the ship
// unhurt a moment, one that only grazes the drawn ship costs nothing; the ship is down at 0; a page without foes keeps
// every byte.
import { describe, it, expect } from 'vitest';
import { composeLive, emissionSource } from './compose.js';
import { scrollCamera } from '../../gameworld/scroll-stage/frame.js';
import { lowerFoes, PATTERNS, FOES } from '../../gameworld/scroll-stage/patterns.js';

const E = composeLive(), DT = 1 / 60, LEN = 12, C = scrollCamera(LEN), SA = C.screen.along, SCR = C.screen.across;
const FS = lowerFoes(Object.keys(FOES), { L: LEN, S: SCR });
// (a foe of a kind, its pattern swapped for one asked of it)
const foe = (id, kind, o = {}) => {
  const K = FS.foes[kind], pat = o.noFire ? undefined : o.pattern ? lowerPattern(o.pattern) : K.pattern ? FS.patterns[K.pattern] : undefined;
  return { id, team: 'foes', rule: { type: 'scroll-foe', enter: o.enter ?? SA / 2, v: o.v ?? 0, path: o.path ?? K.path, speed: K.speed, ...(pat ? { pattern: pat } : {}), safe: FS.safe, hue: FS.hue }, body: { type: 'none', hp: K.hp, radius: 2 }, transform: { pos: [0, 1e4, 0] } };
};
const lowerPattern = (p) => { const P = PATTERNS[p]; return { tell: P.tell, every: P.every, volleys: P.volleys || 1, gapS: P.gap_s || 0, shots: P.shots, spread: P.spread, aim: P.aim, turn: P.turn || 0, speed: P.speed * SCR, r: P.r * LEN, dmg: P.dmg, ...(P.gap !== undefined ? { gap: P.gap * LEN } : {}) }; };
const world = ({ foes = [], track = [], at = [-SA / 4, 0], hp = 10 } = {}) => E.createWorld({
  entities: [{ id: 'ship', pilotable: true, rule: { type: 'scroll-ship', size: [LEN, 4], at, hitbox: { r: FS.hitbox, at: 0 }, invuln: 1 }, body: { type: 'none', hp }, transform: { pos: [0, 0, 0] } }, ...foes],
  camera: { rule: 'scroll', target: 'ship', view: 'side', dist: C.dist, screen: [SA, SCR], track }, pilot: 'ship',
});
const step = (st, input = {}, n = 1, each) => { for (let i = 0; i < n; i++) { E.stepWorld(st, input, DT); if (each) each(st); } return st; };
const off = (st, id) => st.byId[id]._at;

describe('the foes', () => {
  it('wait off the screen\'s right edge until the scroll brings them in, never hit while they wait', () => {
    const st = world({ track: [{ by: [400, 0], pace: 40 }], foes: [foe('f', 'carrier', { enter: SA / 2 + 80 })] });
    step(st, {}, 30);
    expect(st.byId.f.waiting).toBe(true);
    expect(off(st, 'f')).toBeUndefined();
    step(st, {}, 60 * 2 + 30);
    expect(st.byId.f.waiting).toBe(false);
    expect(off(st, 'f')[0]).toBeLessThan(SA / 2 + 3);
  });

  it('a line crosses the screen back at its speed and leaves past the far edge', () => {
    const st = world({ foes: [foe('f', 'carrier')] });
    step(st, {}, 2);
    const u0 = off(st, 'f')[0];
    step(st, {}, 60);
    expect((u0 - off(st, 'f')[0])).toBeCloseTo(FS.foes.carrier.speed, 0);
    step(st, {}, 60 * 30);
    expect(st.byId.f.gone).toBe(true);
  });

  it('a hold comes in to its station, holds it its time, and leaves the way it came', () => {
    const P = FOES.gunpod.path, st = world({ foes: [foe('f', 'gunpod', { noFire: true })] });
    const seen = [];
    step(st, {}, 60 * (P.for + 12), (s) => { if (!s.byId.f.gone) seen.push(off(s, 'f')[0]); });
    const station = SA / 2 - P.at * SA;
    expect(Math.min(...seen)).toBeCloseTo(station, 1);
    expect(seen.filter((u) => Math.abs(u - station) < 1e-6).length / 60).toBeGreaterThanOrEqual(P.for - 0.1);
    expect(st.byId.f.gone).toBe(true);
  });

  it('a dive turns to the ship\'s height', () => {
    const st = world({ at: [-SA / 4, SCR / 4], foes: [foe('f', 'dart', { v: -SCR / 4 })] });
    step(st, {}, 90);
    expect(off(st, 'f')[1]).toBeGreaterThan(-SCR / 4 + 5);
  });

  it('tells its pattern before it fires it, never from off the screen nor on top of the ship', () => {
    const st = world({ foes: [foe('f', 'drone', { path: { kind: 'hold', at: 0.3, for: 20 } })] });
    let told = -1, fired = -1;
    step(st, {}, 60 * 4, (s) => { if (s.byId.f.tellNow > 0 && told < 0) told = s.time; if (s.foeShots.length && fired < 0) fired = s.time; });
    expect(told).toBeGreaterThan(0);
    expect(fired - told).toBeGreaterThanOrEqual(PATTERNS.aimed.tell - 2 * DT);
    const near = world({ at: [SA / 2 - 0.3 * SA - LEN, 0], foes: [foe('f', 'drone', { path: { kind: 'hold', at: 0.3, for: 20 } })] });
    step(near, {}, 60 * 4);
    expect(near.foeShots.length).toBe(0);
  });

  it('an aimed bullet heads at the ship; a ring goes out evenly; a wall leaves its gap where the ship is not', () => {
    const at = [-SA / 4, SCR / 5];
    const aimed = world({ at, foes: [foe('f', 'drone', { path: { kind: 'hold', at: 0.3, for: 20 } })] });
    step(aimed, {}, 60 * 3, (s) => s.foeShots.length && !s._first && (s._first = { ...s.foeShots[0] }));
    const b = aimed._first, sh = aimed.byId.ship.screenAt, dir = Math.atan2(sh[1] - b.v, sh[0] - b.u), go = Math.atan2(b.dv - aimed.camera.scrollVel[1], b.du - aimed.camera.scrollVel[0]);
    expect(Math.abs(go - dir)).toBeLessThan(0.15);

    const ring = world({ foes: [foe('f', 'heavy', { pattern: 'ring', path: { kind: 'hold', at: 0.3, for: 20 } })] });
    step(ring, {}, 60 * 4, (s) => s.foeShots.length && !s._ring && (s._ring = s.foeShots.map((x) => Math.atan2(x.dv, x.du))));
    expect(ring._ring.length).toBe(PATTERNS.ring.shots);
    const ang = ring._ring.map((a) => (a + 2 * Math.PI) % (2 * Math.PI)).sort((x, y) => x - y), gaps = ang.map((a, i) => (i ? a - ang[i - 1] : a + 2 * Math.PI - ang.at(-1)));
    for (const g of gaps) expect(g).toBeCloseTo((2 * Math.PI) / PATTERNS.ring.shots, 2);

    const wall = world({ at: [-SA / 4, SCR / 4], foes: [foe('f', 'layer', { path: { kind: 'hold', at: 0.12, for: 20 } })] });
    step(wall, {}, 60 * 4, (s) => s.foeShots.length && !s._wall && (s._wall = s.foeShots.map((x) => x.v - s.camera._sc[1]).sort((x, y) => x - y)));
    const vs = wall._wall, widest = vs.slice(1).map((v, i) => [v - vs[i], (v + vs[i]) / 2]).sort((x, y) => y[0] - x[0])[0];
    expect(widest[1]).toBeLessThan(0);                                       // the ship is high: the gap is low
    expect(widest[0] - 2 * (PATTERNS.wall.r * LEN)).toBeGreaterThan(2 * FS.hitbox);
  });

  it('a bullet in the hitbox costs hp and leaves the ship unhurt a moment; one that only grazes the ship drawn costs nothing', () => {
    const st = world({ hp: 5 }), sh = () => st.byId.ship.screenAt;
    step(st, {}, 2);
    st.foeShots = [{ u: sh()[0], v: sh()[1], du: 0, dv: 0, r: 0.5, dmg: 1, t: 0, hue: '#f0f' }, { u: sh()[0], v: sh()[1], du: 0, dv: 0, r: 0.5, dmg: 1, t: 0, hue: '#f0f' }];
    step(st, {}, 1);
    expect(st.byId.ship.body.hp).toBe(4);
    st.foeShots = [{ u: sh()[0] + LEN * 0.4, v: sh()[1], du: 0, dv: 0, r: 0.3, dmg: 1, t: 0, hue: '#f0f' }];
    step(st, {}, 70);
    expect(st.byId.ship.body.hp).toBe(4);
  });

  it('a fixed foe stands where it is in the world, in as the screen reaches it, and never leaves', () => {
    const st = world({ track: [{ by: [600, 0], pace: 40 }], foes: [{ ...foe('g', 'drone', { path: { kind: 'fixed' } }), rule: { ...foe('g', 'drone').rule, path: { kind: 'fixed' }, at: [SA / 2 + 120, 10], speed: 0 } }] });
    step(st, {}, 30);
    expect(st.byId.g.waiting).toBe(true);
    step(st, {}, 60 * 4);
    expect(st.byId.g.waiting).toBe(false);
    expect(off(st, 'g')[0] + st.camera._sc[0]).toBeCloseTo(SA / 2 + 120, 6);
    step(st, {}, 60 * 6);
    expect(st.byId.g.gone).toBeFalsy();
  });

  it('a hull on the play plane is terrain: the hitbox in a standing block\'s outline takes a hit and is put back out', () => {
    const st = world({ hp: 5 });
    step(st, {}, 2);
    const h = st.byId.ship.screenAt;
    st.breakables = [{ id: 'h/b', min: [-30, h[0] - 5, h[1] - 3], max: [0, h[0] + 5, h[1] + 1], broken: null }];
    step(st, {}, 1);
    expect(st.byId.ship.body.hp).toBe(4);
    step(st, {}, 1);                                                                           // (the push lands on the next frame)
    const v = st.byId.ship.screenAt[1];
    expect(v - FS.hitbox > h[1] + 1 - 1e-6 || v + FS.hitbox < h[1] - 3 + 1e-6).toBe(true);
    st.breakables[0].broken = { how: 'shot' };
    step(st, {}, 90);
    expect(st.byId.ship.body.hp).toBe(4);
  });

  it('the ship is down at 0', () => {
    const st = world({ hp: 1 }), sh = () => st.byId.ship.screenAt;
    step(st, {}, 2);
    st.foeShots = [{ u: sh()[0], v: sh()[1], du: 0, dv: 0, r: 0.5, dmg: 1, t: 0, hue: '#f0f' }];
    step(st, {}, 1);
    expect(st.byId.ship.downed).toBe(true);
  });

  it('a page without foes keeps every byte', () => {
    expect(emissionSource({ scroll: true, scrollPods: true })).not.toContain('scroll-foe');
    expect(emissionSource({ scroll: true, scrollFoes: true })).toContain('scroll-foe');
  });
});
