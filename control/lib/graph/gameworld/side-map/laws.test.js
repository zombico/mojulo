// The side map's laws (side-map/laws.js): the principles measured on a laid, dressed map. The concepts: a chain for each
// climb form (chosen in code from the climb table) holds every law; with no dress only the layout's are read; and each
// law loses where its principle is broken (a rest taken out, a frame rising too fast, a pit first, the teaching out of
// order, a solid outside the path, a hole in it, a map ending on a climb, a ladder off its floor, the boss's colour early,
// a place twice, bays that repeat, a thread cut, a peek of the wrong place).
import { describe, it, expect } from 'vitest';
import { sideMapLaws, SIDE_MAP_LAWS } from './laws.js';
import { layoutSideMap } from './layout.js';
import { dressSideMap } from './dress.js';
import { CLIMBS } from './zones.js';
import { reachOf } from '../feel/reach.js';
import { readFeel } from '../feel/lower.js';

const reach = reachOf(readFeel({ pole: 'galaxy-boy', takes: true }));
const chain = (climb = 'chimney', over = {}) => ({
  premise: 'into the reactor plant',
  zones: [
    { run: 'across', screens: 2, beat: 'rest' },
    { run: 'across', screens: 3, teach: 'basic' },
    { run: 'up', screens: 2, climb, rises: true },
    { run: 'across', screens: 2, beat: 'landing' },
    { run: 'down', screens: 2, drop: 'cascade' },
    { run: 'across', screens: 3, teach: 'meet', spawners: 2 },
    { run: 'down', screens: 2, drop: 'chute' },
    { room: [1, 1], teach: 'boss' },
  ],
  ...over,
});
const lay = (map) => layoutSideMap(map, { reach, stature: 1.67 });
const read = (L, D) => Object.fromEntries(sideMapLaws(L, reach, { dress: D }).map((l) => [l.id, l]));
const both = (map = chain()) => { const L = lay(map); return { L, D: dressSideMap(L, map, { seed: 3 }) }; };
const clone = (v) => JSON.parse(JSON.stringify(v));

describe('the side map\'s laws', () => {
  it('a chain for each climb form holds every law, dressed', () => {
    for (const climb of Object.keys(CLIMBS)) {
      const { L, D } = both(chain(climb)), laws = sideMapLaws(L, reach, { dress: D });
      expect(laws.map((l) => l.id)).toEqual(SIDE_MAP_LAWS);
      expect(laws.filter((l) => !l.holds).map((l) => `${climb} ${l.id}: ${l.says}`)).toEqual([]);
    }
  });
  it('with no dress only the layout\'s laws are read', () => {
    const ids = sideMapLaws(lay(chain()), reach).map((l) => l.id);
    expect(ids).toContain('swept');
    expect(ids).not.toContain('rhythm');
  });
  it('a chimney loses its rests where one is taken out; a frame that rises too fast is not outclimbed', () => {
    const { L } = both(), M = clone(L);
    const R = M.rests.filter((r) => r.zone === 2);
    M.rests = M.rests.filter((r) => !(r.zone === 2 && (r.z === R[0].z || r.z === R[1].z)));
    expect(read(M).rests).toMatchObject({ holds: false, zones: [2] });
    const F = clone(L); F.rises[0].pace *= 2;
    expect(read(F).outclimbs.holds).toBe(false);
  });
  it('stakes: a pit in the first zone, or a climb shorter than the last, loses them', () => {
    const Z = chain().zones;
    expect(read(lay({ zones: Z.slice(1) })).stakes.holds).toBe(false);
    const short = { zones: [Z[0], { run: 'up', screens: 3, climb: 'ladder' }, Z[3], { run: 'up', screens: 1, climb: 'ladder' }, { run: 'across', screens: 1, beat: 'rest' }] };
    expect(read(lay(short)).stakes).toMatchObject({ holds: false, zones: [3] });
  });
  it('the teaching out of its order is not one new thing', () => {
    const Z = chain().zones, swapped = { zones: [Z[0], Z[5], Z[1]] };
    expect(read(lay(swapped))['one-new-thing'].holds).toBe(false);
  });
  it('swept: a solid outside the camera\'s path, or a hole in it, loses it', () => {
    const { L } = both(), out = clone(L), hole = clone(L);
    out.solids.push({ s0: -100, s1: -90, z0: 0, z1: 5, zone: 0, role: 'floor' });
    expect(read(out).swept.holds).toBe(false);
    hole.solids = hole.solids.filter((r) => !(r.zone === 2 && r.role === 'wall'));
    expect(read(hole).swept.says).toMatch(/neither open nor built/);
    const hung = clone(L), o = hung.open.find((r) => r.zone === 1);
    hung.solids.push({ s0: o.s1 - 4, s1: o.s1, z0: o.z1 - 3, z1: o.z1, zone: 2, role: 'wall' });
    expect(read(hung).swept.says).toMatch(/stands in zone 1's open space/);
  });
  it('a map that ends on a climb has no light at its top; a ladder off its floor loses ladders', () => {
    expect(read(lay({ zones: [{ run: 'across', screens: 1 }, { run: 'up', screens: 1 }] }))['light-at-the-top'].holds).toBe(false);
    const L = clone(lay(chain('ladder')));
    L.ladders[0].foot[1] += 1;
    expect(read(L).ladders.holds).toBe(false);
  });
  it('the dress\'s laws lose where its principles are broken', () => {
    const { L, D } = both();
    const early = clone(D); early.zones[0].boss = 0.5;
    expect(read(L, early)['boss-colour'].holds).toBe(false);
    const twice = clone(D); twice.zones[1].place = twice.zones[0].place;
    expect(read(L, twice)['a-place-a-zone']).toMatchObject({ holds: false, zones: [1] });
    const long = chain(); long.zones[5] = { ...long.zones[5], screens: 5 };
    const B = both(long), rep = clone(B.D), run = rep.zones[5];
    expect(run.bays.length).toBeGreaterThanOrEqual(3);
    run.bays = run.bays.map(() => 'A');
    expect(read(B.L, rep).rhythm.holds).toBe(false);
    const cut = clone(D); cut.threads.splice(2, 1);
    expect(read(L, cut).threads.holds).toBe(false);
    const wrong = clone(D); wrong.zones[0].peek.family = 'padded';
    expect(read(L, wrong)['peeks-in'].holds).toBe(D.zones[1].family === 'padded');
    const flat = clone(D); flat.zones[0].void = flat.zones[0].key;
    expect(read(L, flat)['solid-over-void'].holds).toBe(false);
  });
});
