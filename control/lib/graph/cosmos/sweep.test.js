import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../vegetation/grow.js';
import { rollCube, nudgeCube, sweep, closure } from './sweep.js';
import { capabilityRegistry } from './registry.js';
import { EFFORT_WEIGHT } from './packages.js';
import { validateCube, dryRun } from './cosmos.js';
import { FIXTURES } from './fixtures.js';
import { MARKED_ENGINES } from '../scene/engines/registry.js';

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
    for (const e of MARKED_ENGINES) expect(r.engines[e].ok).toBeLessThanOrEqual(200);
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
    const sized = pk.filter((p) => p.perEffort != null);
    expect(sized.length).toBeGreaterThan(0);
    const weight = { S: 1, M: 3, L: 8 };
    // the cost is the package's own weight plus what it needs built first (priced once Mind sizes them)
    for (const p of sized) {
      expect(p.cost, p.id).toBeGreaterThanOrEqual(weight[p.effort]);
      expect(p.perEffort, p.id).toBe(Math.round((100 * p.lifts) / p.cost) / 100);
    }
    for (let i = 1; i < sized.length; i++) expect(sized[i - 1].perEffort).toBeGreaterThanOrEqual(sized[i].perEffort);
    expect(pk.slice(sized.length).every((p) => p.perEffort == null)).toBe(true);
    // a package credits at least what any one of its values does
    const reg = capabilityRegistry();
    for (const v of r.unlock.values) {
      const [, facet, setting, value] = v.key.match(/^([^.]+)\.([^=]+)=(.+)$/);
      const pkg = reg[facet][setting].values[value].pkg;
      if (pkg) expect(pk.find((p) => p.id === pkg).lifts, v.key).toBeGreaterThanOrEqual(v.lifts);
    }
  });

  it('builds what a value requires with it, and prices the closure', () => {
    // quests need a character who talks: an unbuilt prerequisite comes with it (both built 10-12, so a copy of the
    // registry with talk unbuilt stands in), a built one does not
    const reg = capabilityRegistry();
    expect(reg.time.advance.values.quests.requires).toEqual(['mind.social=talk']);
    expect([...closure(reg, ['time.advance=quests'])]).toEqual(['time.advance=quests']);
    const unbuilt = JSON.parse(JSON.stringify(reg));
    unbuilt.mind.social.values.talk = { status: 'partial', effort: 'M' };
    expect([...closure(unbuilt, ['time.advance=quests'])].sort()).toEqual(['mind.social=talk', 'time.advance=quests']);
    expect(EFFORT_WEIGHT.M).toBe(3);
    expect(sweep({ n: 300, seed: 1, around: 'story-adventure' }).unlock.packages.find((p) => p.id === 'quests')).toBeUndefined();
    // eras require chapters, which are built: a built prerequisite is neither needed nor priced
    expect(reg.time.passage.values.eras.requires).toEqual(['time.chapters=overlays']);
    expect(reg.time.chapters.values.overlays.status).toBe('built');
    const r2 = sweep({ n: 300, seed: 1, around: 'story-adventure' });
    const eras = r2.unlock.packages.find((p) => p.id === 'time.passage=eras');
    expect(eras).toMatchObject({ needs: [], cost: 8 });
  });

  it('sweeps near the probes, deterministically, and names its draw', () => {
    const a = sweep({ n: 100, seed: 2, around: 'probes' });
    expect(a).toMatchObject({ roll: 'fair', around: 'probes' });
    expect(JSON.stringify(sweep({ n: 100, seed: 2, around: 'probes' }))).toBe(JSON.stringify(a));
    expect(a.verdicts.makeable + a.verdicts.gaps + a.verdicts.blocked).toBe(100);
    expect(() => sweep({ n: 1, around: 'mmo' })).toThrow(/no fixture 'mmo'/);
  });

  it('recounts each engine\'s counterfactual by hand: a value, a setting, a ladder that climbs to its facet', () => {
    for (const [args, roll] of [[{ n: 200, seed: 3 }, (rand) => rollCube(rand)], [{ n: 200, seed: 3, around: 'probes' }, null]]) {
      const s = sweep(args);
      for (const e of MARKED_ENGINES) {
      const g = s.engines[e].unlock, ok = s.engines[e].ok, lost = [];
      if (roll) {
        const rand = mulberry32(3);
        for (let i = 0; i < 200; i++) { const d = dryRun(roll(rand)).engines[e]; if (!d.ok) lost.push(d.lost); }
      } else {
        const bases = FIXTURES.filter((f) => !f.anchor).map((f) => f.cube), rand = mulberry32(3);
        for (let i = 0; i < 200; i++) { const d = dryRun(nudgeCube(rand, bases[i % bases.length])).engines[e]; if (!d.ok) lost.push(d.lost); }
      }
      expect(lost.length).toBe(200 - ok);
      const key = (x) => `${x.facet}.${x.setting}=${x.value}`, set = (x) => `${x.facet}.${x.setting}`;
      // the top setting: the cubes whose every loss is in it
      const top = g.settings[0];
      expect(top.survives).toBe(lost.filter((l) => l.every((x) => set(x) === top.setting)).length);
      // the top value: the cubes that lose it and nothing else
      const v = g.values[0];
      expect(v.survives).toBe(lost.filter((l) => l.some((x) => key(x) === v.key) && l.every((x) => key(x) === v.key)).length);
      for (const row of [...g.values, ...g.settings]) expect(row.survives).toBeLessThanOrEqual(row.touches);
      for (const [facet, ladder] of Object.entries(g.ladders)) {
        expect(ladder[0].survives - ladder[0].gain).toBe(ok);
        for (let i = 1; i < ladder.length; i++) expect(ladder[i].survives).toBe(ladder[i - 1].survives + ladder[i].gain);
        // the top of a facet's ladder: every cube whose losses are all in that facet
        expect(ladder.at(-1).survives, facet).toBe(ok + lost.filter((l) => l.every((x) => x.facet === facet)).length);
      }
      }
    }
  });
});

// a `given` setting (soul's seat settings, given more than one seat) means something only inside the game that gives it
describe('given settings', () => {
  const reg = capabilityRegistry();
  const given = Object.entries(reg).flatMap(([f, ss]) => Object.entries(ss).filter(([, s]) => s.given).map(([k, s]) => [f, k, s.given]));
  const holds = (spec, g) => Object.entries(g).every(([k, vals]) => vals.includes(spec?.[k]));
  it('a roll sets one only in a game that gives it, and a nudge never leaves one without it', () => {
    expect(given.length).toBeGreaterThan(0);
    const rand = mulberry32(3), seated = FIXTURES.find((f) => f.cube.soul?.seats === 'four');
    let seen = 0;
    for (let i = 0; i < 400; i++) {
      for (const cube of [rollCube(rand, 0.6), nudgeCube(rand, seated.cube)]) {
        for (const [f, k, g] of given) if (cube[f]?.[k] !== undefined) { seen++; expect(holds(cube[f], g), `${f}.${k} in ${JSON.stringify(cube[f])}`).toBe(true); }
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});
