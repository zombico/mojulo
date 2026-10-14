import { describe, it, expect } from 'vitest';
import { rollThread, CHAPTER_WORDS, growthBetween } from './thread.js';
import { rollEgocube, bandOfYears } from './egocube.js';
import { planFromSheet } from './plan.js';
import { validateHeroSpec } from '../../mcp/tools/layered.js';

const thread = (chapters, seed = 7) => rollThread({ brief: 'hero', seed, years: 11, chapters });

describe('years', () => {
  it('set the band, and add nothing when absent', () => {
    expect([5, 12, 13, 19, 20, 39, 40, 59, 60].map(bandOfYears)).toEqual(['child', 'child', 'youth', 'youth', 'adult', 'adult', 'seasoned', 'seasoned', 'elder']);
    expect(rollEgocube({ seed: 7, years: 16 }).facets).toMatchObject({ age: 'youth', years: 16 });
    expect('years' in rollEgocube({ seed: 7 }).facets).toBe(false);
    expect(() => rollEgocube({ years: -1 })).toThrow(/years/);
  });
});

describe('rollThread', () => {
  it('holds the born facets and the swatches, and moves the age', () => {
    const t = thread([{ chapter: 'time', years: 5 }]);
    const [a, b] = t.nodes.map((n) => n.sheet);
    for (const k of ['pole', 'ancestry', 'build', 'role', 'archetype']) expect(b.facets[k], k).toBe(a.facets[k]);
    expect(b.ancestry.colours).toEqual(a.ancestry.colours);
    expect([a.facets.age, b.facets.age]).toEqual(['child', 'youth']);
    expect(t.nodes[1].changes.find((c) => c.facet === 'age')).toEqual({ facet: 'age', from: 'child', to: 'youth' });
  });
  it('grows the child into the build it was born with', () => {
    const t = thread([{ chapter: 'time', years: 5 }]);
    expect(t.nodes[0].sheet.derives.frame).toContain('cast = child');
    expect(t.nodes[1].sheet.notes.frame.some((n) => n.from === `build.${t.nodes[0].sheet.facets.build}`)).toBe(true);
    // the child is the pole's child build: a child's radii on its own pole's landmarks (a girl keeps the female head)
    expect(planFromSheet(t.nodes[0].sheet).create.spec.cast).toEqual({ pole: t.nodes[0].sheet.facets.pole, build: 'child' });
    expect(validateHeroSpec(planFromSheet(t.nodes[0].sheet).create.spec)).toEqual([]);
    expect(planFromSheet(t.nodes[1].sheet).create.spec.cast).toBe(t.nodes[0].sheet.facets.pole);
  });
  it('lowers growth as amounts: a youth its share of adult height, an adult none of it (no step stacked per chapter)', () => {
    const t = rollThread({ seed: 3, years: 11, facets: { pole: 'female' }, chapters: [{ chapter: 'time', years: 2 }, { chapter: 'time', years: 18 }] });
    const tune = (i) => planFromSheet(t.nodes[i].sheet).create.spec.tune ?? {};
    expect(t.nodes[1].sheet.growth).toMatchObject({ from: 11, years: 13, stature: 0.96 });
    expect(tune(1).stature).toBe(0.96);
    expect(tune(1).head).toBeGreaterThan(1);   // the head outgrown by the body less than the body: larger for its height
    expect(tune(2).stature).toBeUndefined();
    expect(tune(2).head).toBeUndefined();
  });
  it('carries one kept marker on every node', () => {
    const t = thread([{ chapter: 'time', years: 5 }, { chapter: 'time', years: 10 }]);
    for (const n of t.nodes) expect(n.sheet.notes.dress.filter((x) => x.from === 'thread.keep').map((x) => x.line).join()).toContain(t.keep);
  });
  it('accumulates wear and moves the arc by the chapter words', () => {
    const t = thread([{ chapter: 'time', years: 5, words: ['war'] }, { chapter: 'time', years: 10, words: ['loss'] }]);
    const scar = (n) => Boolean(n.sheet.notes.wear?.some((x) => x.from === 'chapter.war'));
    expect([scar(t.nodes[0]), scar(t.nodes[1]), scar(t.nodes[2])]).toEqual([false, true, true]);
    expect(t.nodes[2].sheet.notes.rest.some((x) => x.from === 'chapter.loss')).toBe(true);
    expect(CHAPTER_WORDS.war.m).toBeGreaterThan(0);
    expect(rollThread({ seed: 7, years: 11, chapters: [{ chapter: 'time', years: 5, words: ['dragons'] }] }).nodes[1].chapter.unread).toEqual(['dragons']);
  });
  it('is deterministic, and derives every node from the canonical one', () => {
    const one = thread([{ chapter: 'time', years: 5 }]), two = thread([{ chapter: 'time', years: 5 }, { chapter: 'time', years: 3 }]);
    expect(JSON.stringify(two.nodes[1].sheet)).toBe(JSON.stringify(one.nodes[1].sheet));
    expect(() => rollThread({ seed: 7, chapters: [] })).toThrow(/years/);
    expect(() => rollThread({ seed: 7, years: 11, chapters: [{ chapter: 'turn' }] })).toThrow(/not built/);
  });
});

describe('growth', () => {
  it('grows the body more than the head, the face down, and names puberty when the chapter spans it', () => {
    const g = growthBetween(11, 16, 'female'), lines = g.map((x) => x.line).join(' | ');
    expect(lines).toMatch(/taller by \+12%/);
    expect(lines).toMatch(/the head grows only \+3%/);
    expect(lines).toMatch(/\+9% more heads tall/);
    expect(lines).toMatch(/puberty arrives/);
    expect(g.flatMap((x) => x.derives)).toEqual(expect.arrayContaining(['tune.head +', 'face.lower +', 'face.nose +', 'tune.hips +']));
    expect(growthBetween(30, 35, 'male')).toEqual([]);
    expect(growthBetween(5, 8, 'male').some((x) => /puberty/.test(x.line))).toBe(false);
    expect(growthBetween(13, 17, 'male').find((x) => /puberty/.test(x.line)).derives).toContain('tune.shoulders +');
  });
  it('lands on the later node, first the frame, and moves the head', () => {
    const t = rollThread({ brief: 'hero', seed: 7, years: 11, chapters: [{ chapter: 'time', years: 5 }] }), b = t.nodes[1].sheet;
    expect(b.notes.frame[0].from).toBe('growth.11→16');
    expect(b.derives.structure).toContain('tune.head +');
    expect(Object.values(t.nodes[0].sheet.notes).flat().some((n) => n.from.startsWith('growth'))).toBe(false);
  });
});
