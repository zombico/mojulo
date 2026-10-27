import { describe, it, expect } from 'vitest';
import { linesFor, speakerOf, LINE_BOOK } from './lines.js';
import { folkOfTown } from './folk.js';

const lot = (use, s) => ({ use, route: 'lane', side: 'left', s, band: [2, 3] });
const town = (lots, folk = { domicile: 'D of F (P + C2)' }) => folkOfTown({ seed: 8, heartbeat: 'village', lots }, { folk });
const F = town([lot('dwelling', 1), lot('shop', 8)]);
const book = () => Object.values(LINE_BOOK).flatMap((b) => Object.values(b).flatMap((x) => (Array.isArray(x) ? x : Object.values(x).flat())));

describe('folk lines: chitchat from the book, never the plot', () => {
  it('says a greeting, a word on their work, perhaps one more, and a farewell, every line from the book', () => {
    const all = new Set(book());
    for (const p of F.people) {
      const { lines } = linesFor(p, F);
      expect(lines.length).toBeGreaterThanOrEqual(3);
      expect(lines.length).toBeLessThanOrEqual(4);
      for (const l of lines) expect(all.has(l)).toBe(true);
    }
  });

  it('is the same person saying the same things, and another\'s lines never move theirs', () => {
    const p = F.people[0];
    expect(linesFor(p, F)).toEqual(linesFor(p, town([lot('dwelling', 1), lot('shop', 8)])));
    const more = town([lot('dwelling', 1), lot('shop', 8), lot('dwelling', 15)]);
    expect(linesFor(more.people[0], { ...more, needs: F.needs })).toEqual(linesFor(p, F));
  });

  it('keeps a child to a child\'s talk, nothing of the house or the town', () => {
    const child = F.people.find((p) => p.sheet.facets.age === 'child');
    expect(speakerOf(child)).toBe('Child');
    const { lines } = linesFor(child, F);
    expect(lines.length).toBe(3);
    expect(LINE_BOOK.greeting.child).toContain(lines[0]);
    expect(LINE_BOOK.work.child).toContain(lines[1]);
  });

  it('says a need first-hand when it is theirs and second-hand when it is not', () => {
    const lone = town([lot('shop', 1)], { domicile: 'D + 0' });
    const keeper = lone.people.find((p) => p.role === 'keeper');
    const said = (p, k) => linesFor(p, lone).lines.some((l) => LINE_BOOK.need.supplier[k].includes(l));
    // the keeper alone, its house said or its need: a few seeds show both
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => folkOfTown({ seed, heartbeat: 'village', lots: [lot('shop', 1), lot('dwelling', 9)] }, { folk: { domicile: 'D + 0' } }));
    expect(seeds.some((T) => T.people.some((p) => p.role === 'keeper' && linesFor(p, T).lines.some((l) => LINE_BOOK.need.supplier.own.includes(l))))).toBe(true);
    expect(seeds.some((T) => T.people.some((p) => p.role === 'townie' && linesFor(p, T).lines.some((l) => LINE_BOOK.need.supplier.about.includes(l))))).toBe(true);
    for (const T of seeds) for (const p of T.people.filter((x) => x.role !== 'keeper')) expect(linesFor(p, T).lines.some((l) => LINE_BOOK.need.supplier.own.includes(l))).toBe(false);
    expect(said(keeper, 'about')).toBe(false);
  });

  it('says the operator\'s words in place of the book\'s, by a person\'s path or by their role', () => {
    const keeper = F.people.find((p) => p.role === 'keeper'), villager = F.people.find((p) => p.role === 'townie');
    expect(linesFor(keeper, F, { say: { keeper: 'Welcome to the shop.' } })).toEqual({ speaker: 'Keeper', lines: ['Welcome to the shop.'], said: true });
    expect(linesFor(villager, F, { say: { keeper: 'x', [villager.path]: ['One.', 'Two.'] } }).lines).toEqual(['One.', 'Two.']);
  });

  it('names one met in every town, and has them say the family likeness', () => {
    const T = folkOfTown({ seed: 8, lots: [lot('shop', 1)] }, { folk: { recurring: { joy: { role: 'keeper', name: 'Nurse Joy' } } } });
    const joy = T.people.find((p) => p.recurring === 'joy'), { speaker, lines } = linesFor(joy, T);
    expect(speaker).toBe('Nurse Joy');
    expect(lines.some((l) => LINE_BOOK.recurring.includes(l))).toBe(true);
  });
});

