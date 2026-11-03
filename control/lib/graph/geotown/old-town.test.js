import { describe, it, expect } from 'vitest';
import { designGeotown } from './design.js';
import { PATTERNS, PATTERN_IDS, DEFAULT_PATTERN } from './pattern.js';
import { STYLE_STARTERS } from '../era/arch-style.js';

// the old town (pattern.js old-town): a European old town's core, the suburb's where it does not differ
describe('the old town', () => {
  it('is a pattern of its own beside the suburb, which stays the default, in a style of its own', () => {
    expect(PATTERN_IDS).toEqual(['bay-and-gable', 'old-town']);
    expect(DEFAULT_PATTERN).toBe('bay-and-gable');
    expect(STYLE_STARTERS[PATTERNS['old-town'].style]).toBeTruthy();
  });

  it('holds every law at a segment and a neighbourhood: terraces built to the walk, party wall to party wall', () => {
    for (const spec of [{ segment: 'main-street' }, { evoke: 'neighbourhood', neighbourhood: 'old-centre' }]) {
      const T = designGeotown({ pattern: 'old-town', streetscape: 'old-centre', ...spec }, { seed: 3 });
      expect(T.laws.filter((l) => !l.ok).map((l) => l.law), JSON.stringify(spec)).toEqual([]);
    }
    const P = PATTERNS['old-town'];
    expect(P.setback).toEqual([0, 0]);
    expect(P.house.side).toEqual([0, 0]);
  });

  it('lights its streets by lanterns on posts, no poles and no wires; the suburb keeps its own', () => {
    const lights = (g) => designGeotown(g, { seed: 3 }).traffic.lights.map((l) => l.kind);
    expect(new Set(lights({ pattern: 'old-town', streetscape: 'old-centre', segment: 'main-street' }))).toEqual(new Set(['lantern']));
    expect(lights({ segment: 'main-street' })).not.toContain('lantern');
  });
});
