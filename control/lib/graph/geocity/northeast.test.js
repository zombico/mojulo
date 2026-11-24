// A NORTHEAST METRO (metro.js northeast): its inner city low-rise among its midrises (walk-ups, low-rises and main streets
// in the frame), its outskirts the Northeast suburb's with its garden apartments; an evocation `at` a ring standing in
// that ring's most lived-in neighbourhood. Its laws held; the lakeshore metro drawn as it was.
import { describe, it, expect } from 'vitest';
import { designGeocity } from './design.js';
import { METROS } from './metro.js';

const kinds = (d, ring) => d.regions.filter((r) => (r.builds ?? r.ring) === ring && !r.industrial).flatMap((r) => r.blocks.map((b) => b.kind));
describe('a northeast metro', () => {
  it('holds its laws; its inner city low-rise among its midrises, its outskirts with garden apartments', () => {
    const d = designGeocity({ metro: { from: 'northeast' } }, { seed: 1 });
    expect(d.laws.filter((l) => !l.ok).map((l) => l.law)).toEqual([]);
    const frame = kinds(d, 'frame'), low = frame.filter((k) => ['lowrise', 'apartments', 'main-street'].includes(k)).length;
    expect(low).toBeGreaterThan(frame.filter((k) => k === 'midrise').length * 0.5);
    expect(kinds(d, 'outskirts')).toContain('garden');
    expect(METROS.northeast.outskirts).toBe('northeast');
  });

  it('stands an evocation at a ring: the ring\'s most lived-in neighbourhood; at no ring the core\'s, as it was', () => {
    for (const ring of ['frame', 'outskirts']) {
      const d = designGeocity({ metro: { from: 'northeast' }, evoke: 'neighbourhood', at: ring }, { seed: 1 }), r = d.regions.find((x) => x.id === d.evoked.at);
      expect(r.builds ?? r.ring).toBe(ring);
      expect(d.laws.filter((l) => !l.ok).map((l) => l.law)).toEqual([]);
    }
    const plain = designGeocity({ metro: { from: 'lakeshore' }, evoke: 'neighbourhood' }, { seed: 1 }), core = designGeocity({ metro: { from: 'lakeshore' }, evoke: 'neighbourhood', at: 'core' }, { seed: 1 });
    expect(core.evoked.at).toBe(plain.evoked.at);
    expect(() => designGeocity({ metro: { from: 'lakeshore' }, evoke: 'segment', at: 'frame' }, { seed: 1 })).toThrow(/neighbourhood evocation/);
  });

  it('draws the lakeshore metro as it was: its frame\'s arterials midrises, no main street or garden asked of it', () => {
    const d = designGeocity({ metro: { from: 'lakeshore' } }, { seed: 1 });
    expect(kinds(d, 'frame').filter((k) => !['midrise', 'slab', 'construction', 'parking', 'vacant', 'park', 'geotown'].includes(k))).toEqual([]);
    expect(kinds(d, 'outskirts')).not.toContain('garden');
  });
});
