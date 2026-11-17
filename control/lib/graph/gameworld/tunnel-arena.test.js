import { describe, it, expect } from 'vitest';
import { tunnelArena, composeArena, arenaDomain, ARENA_TRAITS, coverCount } from './tunnel-arena.js';

// The arena tunnel: words read into the layout grammar's settings, the layout assessed by the arena's laws and each
// word's measure, what fails tweaked (breaks where a line is, staggered lanes, a smaller court, wider gaps), every
// pass logged; a word the grammar cannot show named as a gap. One case per procedure: lanes, a ring, each measure.

describe('the arena tunnel', () => {
  it('a plain arena holds every law: three lanes, 44 m across, spawns for its match', () => {
    const r = tunnelArena('an arena', { seed: 1, spawns: 4 });
    expect(r.complete).toBe(true);
    expect(r.plan).toMatchObject({ half: 22, topology: 'lanes', lanes: 3, longest: 44 });
    expect(r.plan.spawns).toHaveLength(4);
    // deterministic: the same words and seed, the same arena
    expect(JSON.stringify(tunnelArena('an arena', { seed: 1, spawns: 4 }).plan)).toBe(JSON.stringify(r.plan));
  });

  it('the words change the arena, and each holds its measure and the laws', () => {
    const cases = [
      ['a tight two-lane arena', (p) => p.half === 16 && p.lanes === 2],
      ['a large ring arena with long sightlines', (p) => p.half === 28 && p.topology === 'ring'],
      ['a sparse four-lane arena', (p) => p.lanes === 4 && p.pieces.filter((q) => q.form === 'crate').length <= 6],
      // (dense: its cover is counted whole, the crates and the panels the laws grew inside its wall)
      ['a close quarters four-lane warehouse', (p) => p.lanes === 4 && coverCount(p.pieces, p.half) >= 14],
    ];
    for (const [words, shows] of cases) {
      const r = tunnelArena(words, { seed: 2, spawns: 4 });
      expect(r.complete, `${words}: ${JSON.stringify(r.passes.at(-1))}`).toBe(true);
      expect(shows(r.plan), words).toBe(true);
    }
  }, 240_000);

  it('close quarters is grown for the near band and held to its laws; the log says each pass', () => {
    const r = tunnelArena('a close quarters four-lane warehouse', { seed: 1, spawns: 4 });
    // (where the laws grew a floor whose ways did not all loop, the tweak takes the panels beside the one way and says
    // so: every change the log carries is one the tunnel names)
    for (const c of r.passes.flatMap((p) => p.changed ?? [])) expect(c).toMatch(/taken|break|staggered|many|reseed|court|gaps|tower/);
    expect(r.passes.at(-1).traits.held).toContain('close');
    expect(r.passes.at(-1).laws.failed).toEqual([]);
  }, 120_000);

  it('its floor is the arena map\'s: grown under the laws, every panel with its turned partner; a sparse one stands ungrown', () => {
    const r = tunnelArena('a three-lane arena', { seed: 2, spawns: 4 }), inner = r.plan.pieces.filter((q) => q.form === 'wall' && Math.abs(q.u) < r.plan.half - 0.5 && Math.abs(q.v) < r.plan.half - 0.5);
    expect(inner.length).toBeGreaterThan(6);
    const has = (u, v, q) => inner.some((x) => Math.abs(x.u - u) < 0.02 && Math.abs(x.v - v) < 0.02 && x.along === q.along && Math.abs(x.length - q.length) < 0.02);
    for (const q of inner) expect(has(-q.u, -q.v, q), `${q.u},${q.v}`).toBe(true);
    expect(r.built.map.held).toBeGreaterThan(r.built.map.of - 4);
    const bare = tunnelArena('a sparse four-lane arena', { seed: 2, spawns: 4 });
    expect(bare.built.map.bare).toBe(true);
    expect(bare.complete).toBe(true);
  }, 120_000);

  it('a word the grammar cannot show is a gap, named with what would close it', () => {
    const r = tunnelArena('a figure eight mirrored arena with bridges for capture the flag', { seed: 1, spawns: 4 });
    expect(r.gaps.map((g) => g.trait).sort()).toEqual(['bridges', 'ctf', 'figure-eight', 'mirror']);
    expect(r.gaps.find((g) => g.trait === 'mirror').why).toMatch(/right-hand peeks/);
    expect(r.gaps.every((g) => g.why && g.proposal)).toBe(true);
    expect([r.held, r.complete]).toEqual([true, false]);
  });

  it('a team map: two bases at the ends, one the other turned, no spawn of one in sight of the other\'s', () => {
    const r = tunnelArena('a team three-lane arena', { seed: 1, spawns: 4 });
    expect(r.complete).toBe(true);
    const { spawns, bases } = r.plan, A = bases[0].map((k) => spawns[k]), Bs = bases[1].map((k) => spawns[k]);
    expect([A.length, Bs.length]).toEqual([3, 3]);
    A.forEach((p, k) => expect(Bs[k]).toEqual([-p[0], -p[1]].map((x) => x + 0)));
    expect(A.every((p) => p[1] < -r.plan.half / 4)).toBe(true);   // A's at one end, B's at the other
    expect(r.passes.at(-1).laws.failed).toEqual([]);
    // the same base asked without the word
    expect(JSON.stringify(tunnelArena('a three-lane arena', { seed: 1, spawns: 4, teams: 2 }).plan.bases)).toBe(JSON.stringify(bases));
    expect(tunnelArena('a three-lane arena', { seed: 1, spawns: 4 }).plan.bases).toBeUndefined();
  }, 60_000);

  it('high ground: a turned pair of towers, a stair up each, a power position out of sight of every spawn', () => {
    const r = tunnelArena('a three-lane arena with towers', { seed: 1, spawns: 4 });
    expect(r.complete).toBe(true);
    const towers = r.plan.pieces.filter((q) => q.form === 'tower');
    expect(towers).toHaveLength(2);
    expect([towers[1].u, towers[1].v, ...towers[1].dir]).toEqual([-towers[0].u, -towers[0].v, ...towers[0].dir.map((x) => (x ? -x : 0))]);
    expect(r.plan.floors.map((f) => f.z)).toEqual([2.5, 2.5]);
    const laws = r.passes.at(-1).laws.failed;
    expect(laws).toEqual([]);
    // the armor on the tops
    const armor = r.plan.drops.filter((d) => d.gives === 'armor');
    expect(armor.every((d) => d.h === 2.5)).toBe(true);
    // a small arena has little room to keep a top out of sight of its spawns: it says so, tower by tower, as it moves them
    const small = tunnelArena('a small arena with towers', { seed: 1, spawns: 4 });
    // (it says so, tower by tower, whenever it has to move one; either way it ends with every law held)
    for (const c of small.passes.flatMap((p) => p.changed ?? []).filter((x) => /tower/.test(x))) expect(c).toMatch(/stood elsewhere \((spawns-unseen-from-high|power-position|floors-reached)\)/);
    expect(small.passes.at(-1).laws.failed).toEqual([]);
  }, 120_000);

  it('the grammar is half-turn symmetric whatever it is asked', () => {
    const D = arenaDomain();
    for (const set of [{}, { topology: 'ring', half: 13 }, { lanes: 4, stagger: true, many: 0.9 }, { lanes: 2, breaks: [[4, 6, 'u', 3]] }]) {
      const { pieces } = composeArena({ ...D.start(1), ...set }, 3);
      for (const q of pieces) expect(pieces.some((o) => o.form === q.form && Math.abs(o.u + q.u) < 1e-6 && Math.abs(o.v + q.v) < 1e-6), JSON.stringify(q)).toBe(true);
    }
    expect(Object.keys(ARENA_TRAITS)).toContain('long');
  }, 240_000);
});
