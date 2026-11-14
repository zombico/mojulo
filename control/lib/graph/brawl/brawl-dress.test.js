// THE STREET'S DRESS (brawl-dress.js): what stands along a belt beside the band. The concepts: it is laid outside the
// band, a set a screen, seeded, in the crew's colour where it is the crew's; absent it is nothing.
import { describe, it, expect } from 'vitest';
import { DRESS_PIECES, DRESS_SETS, readDress, dressPlan, dressFaces, dressSceneFaces, dressSets, dressCount } from './brawl-dress.js';
import { brawlLevel } from './brawl-levels.js';
import { readBelt } from './brawl-belt.js';

const belt = readBelt({ at: [10, 5], heading: 0, floor: 0.2, depth: [-2.5, 3], screens: [{ length: 14 }, { length: 16, gate: true }, { length: 16, gate: true }, { length: 16, boss: true }] }, 'belt');
const D = { far: [3.3, 6], wall: 6.1, near: [-6, -3.1], seed: 4, colour: '#1f4fa8' };

describe('the shelves', () => {
  it('a set draws only from the pieces, and its wall only from the wall\'s pieces', () => {
    for (const S of Object.values(DRESS_SETS)) {
      for (const k of [...Object.keys(S.far), ...Object.keys(S.near)]) { expect(DRESS_PIECES[k], k).toBeTruthy(); expect(DRESS_PIECES[k].wall, k).toBeFalsy(); }
      for (const k of Object.keys(S.wall)) expect(DRESS_PIECES[k].wall, k).toBe(true);
      // (the near side is between the camera and the fight: nothing on it stands over a body's waist)
      for (const k of Object.keys(S.near)) expect(DRESS_PIECES[k].tall, k).toBeLessThanOrEqual(1.1);
    }
  });
  it('a piece is built inside the size it says, on the ground', () => {
    // (one piece per way of building: boxes, drums, a canopy on posts, a mark on the wall)
    for (const id of ['crates', 'barrel', 'stall', 'tag']) {
      const P = DRESS_PIECES[id], F = P.build(() => 0.5, null), pts = F.flatMap((f) => f.corners);
      expect(Math.min(...pts.map((p) => p[2])), id).toBeGreaterThanOrEqual(0);
      expect(Math.max(...pts.map((p) => p[2])), id).toBeLessThanOrEqual(P.tall + 0.05);
      expect(Math.max(...pts.map((p) => Math.abs(p[0]))), id).toBeLessThanOrEqual(P.size[0] / 2 + 0.2);
      for (const f of F) expect(f.corners.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('the layout', () => {
  const plan = dressPlan(D, belt);
  it('stands outside the band: the far pieces between it and the fronts, the near ones on the camera\'s side', () => {
    expect(plan.length).toBeGreaterThan(8);
    for (const p of plan) {
      const half = DRESS_PIECES[p.piece].size[1] / 2;
      if (p.side === 'far') { expect(p.n - half).toBeGreaterThanOrEqual(belt.depth[1]); expect(p.n + half).toBeLessThanOrEqual(D.far[1] + 1e-6); }
      if (p.side === 'near') expect(p.n + half).toBeLessThanOrEqual(belt.depth[0]);
      if (p.side === 'wall') expect(p.n).toBeLessThan(D.wall);
      expect(p.s).toBeGreaterThan(0); expect(p.s).toBeLessThan(belt.length);
    }
  });
  it('a set a screen: by its place unless said, the boss\'s the crew\'s corner; a bare screen takes nothing', () => {
    expect(dressSets(belt)[3]).toBe('turf');
    expect(new Set(plan.map((p) => p.set))).toEqual(new Set(dressSets(belt)));
    const bare = dressPlan({ ...D, sets: [null, 'market', null, null] }, belt);
    for (const p of bare) { expect(p.set).toBe('market'); expect(p.s).toBeGreaterThan(belt.screens[1].from); expect(p.s).toBeLessThan(belt.screens[1].to); }
  });
  it('is seeded: the same again, another seed another street', () => {
    expect(dressPlan(D, belt)).toEqual(plan);
    expect(dressPlan({ ...D, seed: 5 }, belt)).not.toEqual(plan);
    expect(dressFaces(D, belt)).toEqual(dressFaces(D, belt));
  });
  it('the crew\'s colour is on its marks, and nowhere when the street has none', () => {
    const hexes = (d) => new Set(dressFaces(d, belt).map((f) => f.hex));
    expect(hexes(D).has('#1f4fa8')).toBe(true);
    const { colour: _c, ...plainD } = D;
    expect(hexes(plainD).has('#1f4fa8')).toBe(false);
  });
  it('its faces are the page\'s: in the world on the belt\'s floor, wound to face out, filled', () => {
    const F = dressSceneFaces(D, belt);
    expect(F.length).toBe(dressCount(D, belt).faces);
    for (const f of F.slice(0, 60)) {
      expect(f.fill).toMatch(/^#[0-9a-f]{6}$/i);
      for (const c of f.corners) expect(c[2]).toBeGreaterThanOrEqual(belt.floor - 1e-6);
      const [a, b, d] = f.corners, n = [(b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]), (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]), (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0])];
      expect(n[0] * f.outNormal[0] + n[1] * f.outNormal[1] + n[2] * f.outNormal[2]).toBeGreaterThanOrEqual(0);
    }
  });
  it('a mark stands on a building: on a front wide enough for it, at that front\'s own line; an alley is dressed as one', () => {
    const fronts = [{ from: 0, to: 20, wall: 6.1 }, { from: 22.5, to: 40, wall: 7.4 }, { from: 40, to: belt.length, wall: 6.1 }];
    const P = dressPlan({ ...D, fronts }, belt), marks = P.filter((p) => p.side === 'wall'), alley = P.filter((p) => p.side === 'alley');
    expect(marks.length).toBeGreaterThan(3);
    for (const m of marks) {
      const half = DRESS_PIECES[m.piece].size[0] / 2, F = fronts.find((f) => m.s - half >= f.from && m.s + half <= f.to);
      expect(F, `${m.piece} at ${m.s}`).toBeTruthy();
      expect(m.n).toBeLessThan(F.wall); expect(m.n).toBeGreaterThan(F.wall - 0.5);
    }
    expect(alley.length).toBeGreaterThan(0);
    for (const a of alley) { expect(a.s).toBeGreaterThan(20); expect(a.s).toBeLessThan(22.5); expect(a.n).toBeGreaterThan(7.4); }
    // (no fronts said: no alley, as before)
    expect(dressPlan(D, belt).some((p) => p.side === 'alley')).toBe(false);
  });
  it('a fault is said', () => {
    expect(() => readDress({ ...D, far: [2, 6] }, belt)).toThrow(/outside the band/);
    expect(() => readDress({ ...D, sets: ['market'] }, belt)).toThrow(/a set a screen/);
    expect(() => readDress({ ...D, colour: 'blue' }, belt)).toThrow(/#rrggbb/);
  });
});

describe('on a level', () => {
  it('a town street is dressed unless it says not, in its angle; another level carries none', () => {
    const T = brawlLevel({ kind: 'town' });
    expect(T.brawl.dress.sets).toHaveLength(T.brawl.belt.screens.length);
    expect(T.brawl.belt.angle).toBe('street');
    expect(T.brawl.dress.far[0]).toBeGreaterThanOrEqual(T.brawl.belt.depth[1]);
    expect(brawlLevel({ kind: 'town', dress: false }).brawl.dress).toBeUndefined();
    expect(brawlLevel({ kind: 'town', dress: { colour: '#b3261e', sets: ['plain', 'yard', 'market', 'turf'] } }).brawl.dress).toMatchObject({ colour: '#b3261e', sets: ['plain', 'yard', 'market', 'turf'] });
    expect(() => brawlLevel({ kind: 'town', dress: { far: [0, 9] } })).toThrow(/not its word/);
    expect(brawlLevel({ kind: 'greybox', preset: 'street' }).brawl.dress).toBeUndefined();
    // (its town's shops are its dress's fronts; its fronts rough unless it says)
    expect(T.geotown.fronts).toBe('rough');
    expect(T.brawl.dress.fronts.length).toBeGreaterThan(2);
    expect(brawlLevel({ kind: 'town', fronts: 'broken' }).geotown.fronts).toBe('broken');
  });
});
