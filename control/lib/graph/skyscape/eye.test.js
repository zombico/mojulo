import { describe, it, expect } from 'vitest';
import { CRAFT, craftOf, pilotEye, spacingAt, eyeSpotAt, turnRadius, CHUNK_N } from './eye.js';

// one slow class and one fast, chosen from the registry by speed rather than named
const byMax = Object.keys(CRAFT).sort((a, b) => CRAFT[a].max - CRAFT[b].max);
const slow = byMax[0], fast = byMax[byMax.length - 1];

describe('the pilot\'s eye', () => {
  it('reads detail in proportion to range: the eye spot is linear in distance', () => {
    expect(eyeSpotAt(2000) / eyeSpotAt(1000)).toBeCloseTo(2, 9);
    expect(spacingAt(1000)).toBeCloseTo(eyeSpotAt(1000) / 2, 9);
  });

  it('derives the quadtree split from the frame alone, the same for every craft', () => {
    const a = pilotEye(slow).lod.split, b = pilotEye(fast).lod.split;
    expect(a).toBe(b);
    // a leaf at range D has spacing D / (split · n): that is the spacing that reads there
    expect(1000 / (a * CHUNK_N)).toBeCloseTo(spacingAt(1000), 1);
  });

  it('asks finer ground of a craft that lands than of one that only passes low', () => {
    const lands = pilotEye(fast, { lands: true }), passes = pilotEye(fast, { lands: false });
    expect(lands.lod.minSize).toBeLessThanOrEqual(passes.lod.minSize);
    expect(lands.spacing.flare).toBeLessThan(lands.spacing.lowPass);
  });

  it('asks coarser ground and wider turns of a faster craft', () => {
    const s = pilotEye(slow), f = pilotEye(fast);
    expect(f.spacing.lowPass).toBeGreaterThan(s.spacing.lowPass);
    expect(f.turn.max).toBeGreaterThan(s.turn.max);
    expect(f.lod.minSize).toBeGreaterThanOrEqual(s.lod.minSize);
  });

  it('turns on the coordinated-turn law r = v² / (g · tan bank)', () => {
    expect(turnRadius(60, 45)).toBeCloseTo(3600 / 9.81, 6);
  });

  it('takes a custom envelope over the default class, and teaches on a bad one', () => {
    expect(craftOf({ max: 120 }).max).toBe(120);
    expect(() => craftOf('zeppelin')).toThrow(/classes:/);
    expect(() => craftOf({ stall: 90, cruise: 60 })).toThrow(/stall < cruise/);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(pilotEye(fast))).toBe(JSON.stringify(pilotEye(fast)));
  });
});
