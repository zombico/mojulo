// THE METRO'S HIGHWAYS: its expressways elevated over its arterials and along its shore (a lakeshore expressway, a
// crosstown, two cross highways flying over it and joining the shore's), held to their grade and clear of the ground,
// drawn as decks on piers, the street's tall kit cleared from under them, driven by the metro's traffic.
import { describe, it, expect } from 'vitest';
import { designGeocity } from './design.js';
import { readGeocity } from './metro.js';
import { highwaysOf, highwayLaws, deckAt, deckWidth, HIGHWAY } from './highways.js';
import { assembleGeocityScene } from './scene.js';

const d = designGeocity({ evoke: 'neighbourhood' }, { seed: 2 }), H = d.highways;
const role = (r) => H.filter((h) => h.role === r);

describe('the metro\'s highways, planned', () => {
  it('runs four by default: one along its shore (over its waterfront\'s boulevard, waterfront.js), a crosstown over the arterial farthest from it, two cross highways over its outermost arterials the other way', () => {
    expect(H).toHaveLength(4);
    const [shore] = role('shore'), [cross0, cross1] = role('cross'), [town] = role('crosstown');
    expect(shore.boulevard).toBe(true);
    expect(shore.at).toBeLessThan(d.land.rect[1]);
    // (over the water where its shore is not reclaimed)
    expect(designGeocity({ evoke: 'neighbourhood', waterfront: false }, { seed: 2 }).highways.find((h) => h.role === 'shore').water).toBe(true);
    const ew = d.lines.filter((l) => l.axis === 'ew' && l.rank !== 'spine');
    expect(town.along).toBe(ew.slice().sort((p, q) => q.at - p.at)[0].id);
    const ns = d.lines.filter((l) => l.axis === 'ns' && l.rank !== 'spine').map((l) => l.at);
    expect([cross0.at, cross1.at].sort((p, q) => p - q)).toEqual([Math.min(...ns), Math.max(...ns)]);
    for (const h of [cross0, cross1]) { expect(h.joins).toEqual([shore.id]); expect(h.over).toEqual([town.id]); }
  });

  it('holds each to its grade, clear of the ground under it, a flyover clear of the deck it crosses, its join at the shore\'s level', () => {
    for (const l of highwayLaws(d, H)) expect(l.ok, l.value).toBe(true);
    const [shore] = role('shore'), [town] = role('crosstown');
    for (const h of role('cross')) {
      expect(deckAt(h, town.at) - HIGHWAY.depth - deckAt(town, h.at)).toBeGreaterThanOrEqual(HIGHWAY.clear);
      expect(Math.abs(deckAt(h, h.lo) - deckAt(shore, h.at))).toBeLessThan(0.5);
    }
  });

  it('stands its piers in its arterial\'s kerb lanes and never in a crossing', () => {
    for (const h of H.filter((x) => x.role !== 'shore')) {
      const l = d.lines.find((x) => x.id === h.along), kerb = l.bands.filter((b) => b.kind === 'parking').map((b) => (b.from + b.to) / 2);
      for (const p of h.piers) {
        expect(p.cols).toEqual(kerb);
        for (const o of d.lines.filter((x) => x.axis !== l.axis)) expect(Math.abs(p.u - o.at)).toBeGreaterThan(o.half);
      }
    }
    expect(deckWidth(3)).toBeCloseTo(2 * (3 * HIGHWAY.lane + 2 * HIGHWAY.shoulder) + HIGHWAY.median, 6);
  });

  it('runs none where its recipe says `highways: false`, those it names where it says, and refuses a line it has not', () => {
    expect(designGeocity({ evoke: 'neighbourhood', highways: false }, { seed: 2 }).highways).toBeUndefined();
    const one = designGeocity({ evoke: 'neighbourhood', highways: { along: ['ew-1'] } }, { seed: 2 }).highways;
    expect(one.map((h) => h.along)).toEqual(['ew-1']);
    expect(() => highwaysOf({ ...d, metro: { ...d.metro, highways: { count: 1, lanes: 3, height: 10, along: ['ns-99'] } } })).toThrow(/not an arterial/);
    expect(() => readGeocity({ highways: { count: 9 } })).toThrow(/highways is false or/);
  });
});

describe('the metro\'s highways, built', () => {
  const p = assembleGeocityScene({ kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, geocity: { evoke: 'neighbourhood' } });
  it('lays each deck on its piers, driven by its traffic, the street\'s lamps and trees cleared from under it', () => {
    expect(p.geocity.highways.map((h) => h.role)).toEqual(H.map((h) => h.role));
    const deck = p.faces.filter((f) => f.group === 'geocity:highway');
    expect(deck.length).toBeGreaterThan(H.reduce((a, h) => a + h.stations.length / 2 - 1, 0) - 1);
    // (a column a walker's box where the evocation masses its neighbourhoods; none out past them)
    const piers = p.colliders.filter((c) => c.of.endsWith(':pier')), massed = d.regions.filter((r) => d.evoked.regions.includes(r.id));
    expect(piers.length).toBeLessThanOrEqual(H.reduce((a, h) => a + h.piers.reduce((b, q) => b + q.cols.length, 0), 0));
    for (const c of piers) expect(massed.some((r) => c.min[0] >= r.rect[0] - 2 && c.max[0] <= r.rect[2] + 2 && c.min[1] >= r.rect[1] - 2 && c.max[1] <= r.rect[3] + 2)).toBe(true);
    expect(p.flow.lanes.filter((L) => H.some((h) => h.id === L.line)).length).toBe(H.reduce((a, h) => a + 2 * h.lanes, 0));
    // (no street lamp under a deck lower than it)
    const town = role('crosstown')[0];
    const lamps = p.repeats.filter((r) => r.group === 'geocity:lamp').flatMap((r) => r.transforms);
    const under = lamps.filter((t) => Math.abs(t.pos[1] - town.at) < town.w / 2 && t.pos[0] > town.lo && t.pos[0] < town.hi && t.pos[2] < deckAt(town, t.pos[0]) - 1);
    expect(under).toHaveLength(0);
    for (const id of ['highway-grade', 'highway-clear', 'faces']) expect(p.geocity.laws.find((l) => l.law === id).ok).toBe(true);
  });
});
