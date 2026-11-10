// The era marks (era-marks.js): every World page input marked in every era, closed over the page's own inputs (read
// from scene-three.js emitThreeWorld's signature); gen-6 draws them all as built (paint is its own), gen-7 names each
// surface it draws as paint.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SURFACE_INPUTS, NEUTRAL_INPUTS, FORM_INPUTS, ERA_PAGE_MARKS, MARKS, eraReading } from './era-marks.js';
import { ERA_IDS, ERAS } from './eras.js';

// the World page's inputs: emitThreeWorld's parameters (a resolved payload spreads into it)
function pageInputs() {
  const src = readFileSync(new URL('../scene/scene-three.js', import.meta.url), 'utf8');
  const sig = /export function emitThreeWorld\(\{([\s\S]*?)\}\s*=\s*\{\}\)\s*\{/.exec(src);
  if (!sig) throw new Error('era-marks.test: emitThreeWorld signature not found');
  return [...sig[1].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*=/g)].map((x) => x[1]);
}

const sorted = (a) => [...a].sort();

describe('the era marks: every page input, every era', () => {
  it('the surface, neutral and form inputs are the page\'s inputs, each once (a new input is classified here first)', () => {
    expect(sorted([...SURFACE_INPUTS, ...NEUTRAL_INPUTS, ...FORM_INPUTS])).toEqual(sorted(pageInputs()));
    expect(SURFACE_INPUTS.filter((k) => NEUTRAL_INPUTS.includes(k) || FORM_INPUTS.includes(k))).toEqual([]);
    expect(NEUTRAL_INPUTS.filter((k) => FORM_INPUTS.includes(k))).toEqual([]);
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
    // (and what it draws as material, built)
    for (const k of FORM_INPUTS) expect(g7[k], k).toMatchObject({ 'gen-7': 'built' });
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
  it('a figure under the cast rig or with a form body is the form render\'s: a bank of only those is built, one with some says which', () => {
    const fig = (extra) => ({ rig: true, parts: [], ...extra }), inputs = (p) => eraReading(p, 'gen-7').approximated;
    // (every figure painted: approximated as it always was)
    expect(inputs({ figures: { a: fig() } }).find((x) => x.input === 'figures').how).toMatch(/drawn as paint/);
    // (the hero under the rig beside a walker still paint: named)
    const mixed = inputs({ figures: { hero: fig({ cast: {} }), dummy: fig() } }).find((x) => x.input === 'figures');
    expect(mixed.how).toMatch(/^hero under the cast rig/);
    // (only bodies the renderer lights: built, not listed; in gen-6 nothing is ever listed)
    expect(inputs({ figures: { hero: fig({ cast: {} }), car: fig({ form: {} }) } }).some((x) => x.input === 'figures')).toBe(false);
    expect(eraReading({ figures: { hero: fig({ cast: {} }) } }, 'gen-6').approximated).toEqual([]);
  });
  it('a repeat whose template is baked for the form render is the form render\'s: all so is built, some says which are paint', () => {
    const face = (extra) => ({ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0]], fill: '#888888', ...extra }), inputs = (p) => eraReading(p, 'gen-7').approximated;
    const paint = { group: 'geocity:vehicle-sedan', template: [face()], transforms: [{ pos: [0, 0, 0] }] }, baked = { group: 'geocity:front-win-unit', template: [face({ cornerLight: [[1, 1, 1]] })], transforms: [{ pos: [0, 0, 0] }] };
    expect(inputs({ repeats: [paint] }).find((x) => x.input === 'repeats').how).toMatch(/drawn as paint/);
    const mixed = inputs({ repeats: [paint, baked] }).find((x) => x.input === 'repeats');
    expect(mixed.how).toMatch(/^its baked templates drawn as form; the rest \(geocity:vehicle\)/);
    expect(inputs({ repeats: [baked] }).some((x) => x.input === 'repeats')).toBe(false);
    expect(eraReading({ repeats: [paint] }, 'gen-6').approximated).toEqual([]);
  });
  it('teaches an era it does not know', () => {
    expect(() => eraReading(payload, 'gen-9')).toThrow(/not an era \(gen-6, gen-7\)/);
    expect(() => eraReading(payload, 7)).toThrow(/era is a string/);
  });
});
