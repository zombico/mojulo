// The run and gun's first level seen from the side (side-map/first.js). The concepts: it is the first level's teaching
// order (basic, meet, advanced, gauntlet, boss) with the strip's missing beats between; it starts on a rest with no pit,
// climbs a rising chimney, commits down a chute and ends in a one-screen boss's room shut behind; laid for Galaxy Boy and
// dressed and painted, it holds every law; an across run carries no wall face (the wall kick is the chimney's).
import { describe, it, expect } from 'vitest';
import { firstSideMap } from './first.js';
import { readSideMap } from './zones.js';
import { layoutSideMap } from './layout.js';
import { dressSideMap } from './dress.js';
import { paintSideMap } from './paint.js';
import { sideMapLaws } from './laws.js';
import { TEACH } from '../course.js';
import { reachOf } from '../feel/reach.js';
import { readFeel } from '../feel/lower.js';

const reach = reachOf(readFeel({ pole: 'galaxy-boy', takes: true }));

describe('the run and gun\'s first level, from the side', () => {
  it('is the first level\'s teaching order, with the beats between', () => {
    const M = readSideMap(firstSideMap());
    expect(M.zones.filter((z) => z.teach).map((z) => z.teach)).toEqual(TEACH.filter((t) => ['basic', 'meet', 'advanced', 'gauntlet', 'boss'].includes(t)));
    expect(M.zones[0]).toMatchObject({ run: 'across', beat: 'rest' });
    expect(M.zones.find((z) => z.climb)).toMatchObject({ climb: 'chimney', rises: true });
    expect(M.zones.find((z) => z.drop === 'chute')).toMatchObject({ beat: 'commit' });
    expect(M.zones.at(-1)).toMatchObject({ kind: 'room', room: [1, 1], teach: 'boss' });
  });
  it('laid for Galaxy Boy, dressed and painted, it holds every law', () => {
    const map = firstSideMap(), L = layoutSideMap(map, { reach, stature: 1.67 }), D = dressSideMap(L, map, { seed: 1 }), P = paintSideMap(L, D, { seed: 1 });
    const lost = sideMapLaws(L, reach, { dress: D, paint: P }).filter((l) => !l.holds);
    expect(lost.map((l) => `${l.id}: ${l.says}`)).toEqual([]);
    expect(L.gaps.filter((g) => g.kind === 'wall')).toEqual([]);
  });
});
