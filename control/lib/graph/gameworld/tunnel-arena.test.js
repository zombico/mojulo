import { describe, it, expect } from 'vitest';
import { tunnelArena, composeArena, arenaDomain, ARENA_TRAITS } from './tunnel-arena.js';

// The arena tunnel: words read into the layout grammar's settings, the layout assessed by the arena's laws and each
// word's measure, what fails tweaked (breaks where a line is, staggered lanes, a smaller court, wider gaps), every
// pass logged; a word the grammar cannot show named as a gap. One case per procedure: lanes, a ring, each measure.

describe('the arena tunnel', () => {
  it('a plain arena holds every law: three lanes, 36 m across, spawns for its match', () => {
    const r = tunnelArena('an arena', { seed: 1, spawns: 4 });
    expect(r.complete).toBe(true);
    expect(r.plan).toMatchObject({ half: 18, topology: 'lanes', lanes: 3, longest: 36 });
    expect(r.plan.spawns).toHaveLength(4);
    // deterministic: the same words and seed, the same arena
    expect(JSON.stringify(tunnelArena('an arena', { seed: 1, spawns: 4 }).plan)).toBe(JSON.stringify(r.plan));
  });

  it('the words change the arena, and each holds its measure and the laws', () => {
    const cases = [
      ['a tight two-lane arena', (p) => p.half === 13 && p.lanes === 2],
      ['a large ring arena with long sightlines', (p) => p.half === 24 && p.topology === 'ring'],
      ['a sparse four-lane arena', (p) => p.lanes === 4 && p.pieces.filter((q) => q.form === 'crate').length <= 6],
      ['a close quarters four-lane warehouse', (p) => p.lanes === 4 && p.pieces.filter((q) => q.form === 'crate').length >= 10],
    ];
    for (const [words, shows] of cases) {
      const r = tunnelArena(words, { seed: 2, spawns: 4 });
      expect(r.complete, `${words}: ${JSON.stringify(r.passes.at(-1))}`).toBe(true);
      expect(shows(r.plan), words).toBe(true);
    }
  }, 60_000);

  it('close quarters staggers its lanes and breaks what lines remain; the log says each pass', () => {
    const r = tunnelArena('a close quarters four-lane warehouse', { seed: 1, spawns: 4 });
    expect(r.candidate.stagger).toBe(true);
    expect(r.passes.length).toBeGreaterThan(1);
    expect(r.passes[0].changed).toContain('lanes staggered (close quarters)');
    expect(r.passes.at(-1).traits.held).toContain('close');
  }, 60_000);

  it('a word the grammar cannot show is a gap, named with what would close it', () => {
    const r = tunnelArena('a figure eight arena with towers for teams', { seed: 1, spawns: 4 });
    expect(r.gaps.map((g) => g.trait).sort()).toEqual(['figure-eight', 'floors', 'team']);
    expect(r.gaps.every((g) => g.why && g.proposal)).toBe(true);
    expect([r.held, r.complete]).toEqual([true, false]);
  });

  it('the grammar is half-turn symmetric whatever it is asked', () => {
    const D = arenaDomain();
    for (const set of [{}, { topology: 'ring', half: 13 }, { lanes: 4, stagger: true, many: 0.9 }, { lanes: 2, breaks: [[4, 6, 'u', 3]] }]) {
      const { pieces } = composeArena({ ...D.start(1), ...set }, 3);
      for (const q of pieces) expect(pieces.some((o) => o.form === q.form && Math.abs(o.u + q.u) < 1e-6 && Math.abs(o.v + q.v) < 1e-6), JSON.stringify(q)).toBe(true);
    }
    expect(Object.keys(ARENA_TRAITS)).toContain('long');
  });
});
