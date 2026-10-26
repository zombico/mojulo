// The era marks (era-marks.js): every World page input marked in every era, closed over the page's own inputs as the
// engine marks are; gen-6 draws them all as built (paint is its own), gen-7 names each surface it draws as paint.
import { describe, expect, it } from 'vitest';
import { SURFACE_INPUTS, NEUTRAL_INPUTS, ERA_PAGE_MARKS, eraReading } from './era-marks.js';
import { ERA_IDS, ERAS } from './eras.js';
import { pageInputs } from '../scene/engines/mark-sources.js';
import { MARKS } from '../scene/engines/marks.js';

const sorted = (a) => [...a].sort();

describe('the era marks: every page input, every era', () => {
  it('the surface and neutral inputs are the page\'s inputs, each once (a new input is classified here first)', () => {
    expect(sorted([...SURFACE_INPUTS, ...NEUTRAL_INPUTS])).toEqual(sorted(pageInputs()));
    expect(SURFACE_INPUTS.filter((k) => NEUTRAL_INPUTS.includes(k))).toEqual([]);
  });

  it('every era has a table over them, each row keyed by its own era alone', () => {
    expect(sorted(Object.keys(ERA_PAGE_MARKS))).toEqual(sorted(ERA_IDS));
    for (const era of ERA_IDS) {
      expect(sorted(Object.keys(ERA_PAGE_MARKS[era])), era).toEqual(sorted(pageInputs()));
      for (const row of Object.values(ERA_PAGE_MARKS[era])) {
        expect(MARKS).toContain(row[era]);
        for (const other of ERA_IDS.filter((e) => e !== era)) expect(row[other]).toBeUndefined();
      }
    }
  });

  it('paint draws every input as built; the form render names each surface it draws as paint', () => {
    expect(Object.values(ERA_PAGE_MARKS['gen-6']).every((r) => r['gen-6'] === 'built')).toBe(true);
    const g7 = ERA_PAGE_MARKS['gen-7'];
    for (const k of SURFACE_INPUTS) expect(g7[k], k).toMatchObject({ 'gen-7': 'approximated', how: expect.stringMatching(/paint/) });
    for (const k of NEUTRAL_INPUTS) expect(g7[k], k).toEqual({ 'gen-7': 'built', neutral: true });
    expect(ERAS['gen-6'].surface).toBe('paint');
    expect(ERAS['gen-7'].surface).toBe('form');
  });
});

describe('a payload read in an era', () => {
  const payload = { faces: [{}], liveGrass: { grid: 1 }, shadows: { actors: true }, entities: [{}], cameras: [{}], fabric: null, splats: [] };
  it('gen-7 lists the surfaces the payload carries, and only those; gen-6 lists none', () => {
    const r = eraReading(payload, 'gen-7');
    expect(r).toMatchObject({ era: 'gen-7', surface: 'form', absent: [] });
    expect(r.approximated.map((x) => x.input)).toEqual(['faces', 'liveGrass', 'shadows']);
    expect(eraReading(payload, 'gen-6')).toEqual({ era: 'gen-6', surface: 'paint', approximated: [], absent: [] });
  });
  it('teaches an era it does not know', () => {
    expect(() => eraReading(payload, 'gen-9')).toThrow(/not an era \(gen-6, gen-7\)/);
    expect(() => eraReading(payload, 7)).toThrow(/era is a string/);
  });
});
