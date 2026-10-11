import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../vegetation/grow.js';
import { rollCube, nudgeCube, sweep } from './sweep.js';
import { capabilityRegistry } from './registry.js';
import { EFFORT_WEIGHT } from './packages.js';
import { validateCube, dryRun } from './cosmos.js';
import { FIXTURES } from './fixtures.js';

describe('rollCube', () => {
  it('rolls valid cubes, and the same seed rolls the same cube', () => {
    const a = mulberry32(7), b = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      const cube = rollCube(a);
      expect(() => validateCube(cube)).not.toThrow();
      expect(rollCube(b)).toEqual(cube);
    }
  });
  it('sets nothing at density 0 and every setting at density 1 on the flat roll', () => {
    expect(rollCube(mulberry32(1), 0)).toEqual({});
    const full = rollCube(mulberry32(1), 1, 'flat');
    expect(Object.keys(full)).toEqual(['reality', 'space', 'power', 'soul', 'mind', 'time']);
    const reg = capabilityRegistry();
    for (const [f, spec] of Object.entries(full)) expect(Object.keys(spec), f).toEqual(Object.keys(reg[f]));
    expect(() => rollCube(mulberry32(1), 0.2, 'loaded')).toThrow(/roll is fair \| flat/);
  });
  it('gives every facet about the same settings on the fair roll, whatever its size', () => {
    const count = (roll) => {
      const rand = mulberry32(5), n = {};
      for (let i = 0; i < 2000; i++) for (const [f, spec] of Object.entries(rollCube(rand, 0.2, roll))) n[f] = (n[f] || 0) + Object.keys(spec).length;
      return n;
    };
    const fair = count('fair'), flat = count('flat');
    // flat: Mind (the most settings) is set far more than Time (the fewest); fair: within a fifth of each other
    expect(flat.mind / flat.time).toBeGreaterThan(1.4);
    expect(fair.mind / fair.time).toBeGreaterThan(0.8);
    expect(fair.mind / fair.time).toBeLessThan(1.2);
  });
});

describe('nudgeCube', () => {
  it('changes one or two settings of a valid cube, and keeps it valid', () => {
    const rand = mulberry32(2), base = FIXTURES.find((f) => f.id === 'jrpg').cube;
    for (let i = 0; i < 50; i++) {
      const c = nudgeCube(rand, base);
      expect(() => validateCube(c)).not.toThrow();
      let changed = 0;
      for (const f of new Set([...Object.keys(base), ...Object.keys(c)])) {
        for (const s of new Set([...Object.keys(base[f] || {}), ...Object.keys(c[f] || {})])) if (JSON.stringify(base[f]?.[s]) !== JSON.stringify(c[f]?.[s])) changed++;
      }
      expect(changed).toBeLessThanOrEqual(2);
    }
    expect(base.time.advance).toBe('quests');
  });
});

describe('sweep', () => {
  const r = sweep({ n: 200, seed: 3 });

  it('is deterministic, byte for byte', () => {
    expect(JSON.stringify(sweep({ n: 200, seed: 3 }))).toBe(JSON.stringify(r));
    expect(JSON.stringify(sweep({ n: 200, seed: 4 }))).not.toBe(JSON.stringify(r));
  });

  it('counts every rolled cube once', () => {
    expect(r.verdicts.makeable + r.verdicts.gaps + r.verdicts.blocked).toBe(200);
    expect(r.godotOk).toBeLessThanOrEqual(200);
  });

  it('reports every fixture, with its verdict as the dry run gives it', () => {
    expect(r.fixtures.map((f) => f.id)).toEqual(FIXTURES.map((f) => f.id));
    for (const f of r.fixtures) expect(f.verdict, f.id).toBe(dryRun(FIXTURES.find((x) => x.id === f.id).cube).verdict);
  });

  it('ranks unlocks by lifts, never crediting more than it touches', () => {
    for (const rows of [r.unlock.facets, r.unlock.values]) {
      for (let i = 1; i < rows.length; i++) expect(rows[i - 1].lifts).toBeGreaterThanOrEqual(rows[i].lifts);
      for (const x of rows) {
        expect(x.makeable).toBeLessThanOrEqual(x.lifts);
        expect(x.lifts).toBeLessThanOrEqual(x.touches);
      }
    }
    for (const v of r.unlock.values) expect(['absent', 'local', 'partial']).toContain(v.status);
  });

  it('recounts the facet counterfactual by hand, prerequisites and all', () => {
    // build Mind whole, with what its values require from other facets, transitively: count the cubes it lifts
    const reg = capabilityRegistry(), needs = new Set();
    const at = (k) => { const [fs, v] = k.split('='), [f, st] = fs.split('.'); return reg[f][st].values[v]; };
    const stack = Object.values(reg.mind).flatMap(({ values }) => Object.values(values).flatMap((row) => row.requires || []));
    while (stack.length) { const q = stack.pop(); if (!needs.has(q)) { needs.add(q); stack.push(...(at(q).requires || [])); } }
    for (const q of needs) expect(q.startsWith('mind.'), q).toBe(false);
    const rand = mulberry32(3);
    let lifts = 0;
    for (let i = 0; i < 200; i++) {
      const d = dryRun(rollCube(rand));
      const rest = (list) => list.filter((x) => x.facet !== 'mind' && !needs.has(`${x.facet}.${x.setting}=${x.value}`));
      if (d.verdict === 'blocked' ? !rest(d.blocked).length : !rest(d.gaps).length && d.gaps.length) lifts++;
    }
    expect(r.unlock.facets.find((f) => f.facet === 'mind').lifts).toBe(lifts);
  });

  it('prices packages: one per change, ranked by lifts per unit of work, unsized last', () => {
    const pk = r.unlock.packages;
    const lift = pk.find((p) => p.id === 'mind-lift');
    expect(lift).toMatchObject({ name: 'Lift the arena brain into a general mind', effort: 'M' });
    expect(lift).toMatchObject({ needs: [], cost: 3 });
    expect(lift.perEffort).toBe(Math.round((100 * lift.lifts) / 3) / 100);
    const sized = pk.filter((p) => p.perEffort != null);
    for (let i = 1; i < sized.length; i++) expect(sized[i - 1].perEffort).toBeGreaterThanOrEqual(sized[i].perEffort);
    expect(pk.slice(sized.length).every((p) => p.perEffort == null)).toBe(true);
    // a package credits at least what any one of its values does
    const sight = r.unlock.values.find((v) => v.key === 'mind.perception=sight');
    if (sight) expect(lift.lifts).toBeGreaterThanOrEqual(sight.lifts);
  });

  it('builds what a value requires with it, and prices the closure', () => {
    // quests need a character who talks: the package carries talk with it, priced at both (Mind owns talk's size)
    const reg = capabilityRegistry(), talk = reg.mind.social.values.talk;
    const q = sweep({ n: 300, seed: 1, around: 'story-adventure' }).unlock.packages.find((p) => p.id === 'quests');
    expect(q).toMatchObject({ needs: ['mind.social=talk'], cost: 3 + EFFORT_WEIGHT[talk.effort] });
    // a passage ages the world between chapters, so it carries chapters with it, transitively priced
    const r2 = sweep({ n: 300, seed: 1, around: 'story-adventure' });
    const seasons = r2.unlock.packages.find((p) => p.id === 'time.passage=seasons');
    if (seasons) expect(seasons).toMatchObject({ needs: ['chapters'], cost: 1 + 3 });
  });

  it('sweeps near the probes, deterministically, and names its draw', () => {
    const a = sweep({ n: 100, seed: 2, around: 'probes' });
    expect(a).toMatchObject({ roll: 'fair', around: 'probes' });
    expect(JSON.stringify(sweep({ n: 100, seed: 2, around: 'probes' }))).toBe(JSON.stringify(a));
    expect(a.verdicts.makeable + a.verdicts.gaps + a.verdicts.blocked).toBe(100);
    expect(() => sweep({ n: 1, around: 'mmo' })).toThrow(/no fixture 'mmo'/);
  });
});
