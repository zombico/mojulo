import { describe, it, expect } from 'vitest';

import { composeCandidates, unlockedSince } from './compose.js';
import { capabilityRegistry } from './registry.js';
import { sweep } from './sweep.js';

// What to build together, over the sweep's own rolls: it must count the same worlds the sweep does.
describe('composeCandidates', () => {
  const opts = { n: 300, seed: 7 };
  const c = composeCandidates(opts), s = sweep(opts);

  it('is seeded: the same arguments give the same report', () => {
    expect(composeCandidates(opts)).toEqual(c);
  });

  it('every world short of makeable waits on exactly one recipe; the recipes count what the sweep counts', () => {
    expect(c.recipes.reduce((n, r) => n + r.worlds, 0)).toBe(s.verdicts.gaps + s.verdicts.blocked);
    for (const r of c.recipes) expect([...r.packages].sort()).toEqual(r.packages);
  });

  it('a one-package recipe is the worlds that package makes on its own, as the sweep ranks them', () => {
    const made = Object.fromEntries(s.unlock.packages.map((p) => [p.id, p.makeable]));
    for (const r of c.recipes.filter((x) => x.packages.length === 1)) expect(made[r.packages[0]]).toBeGreaterThanOrEqual(r.worlds);
  });

  it('a pair splits its worlds into made by one alone and made only together; synergy comes from two-package recipes', () => {
    for (const p of c.pairs) expect(p.alone + p.synergy).toBe(p.worlds);
    const twoOf = (a, b) => c.recipes.some((r) => r.packages.includes(a) && r.packages.includes(b));
    for (const p of c.pairs.filter((x) => x.synergy)) expect(twoOf(p.a, p.b)).toBe(true);
    const ranked = c.pairs.map((p) => p.synergy);
    expect(ranked).toEqual([...ranked].sort((a, b) => b - a));
  });
});

// What the values built since a day made: the same rolls, the counterfactual run backwards.
describe('unlockedSince', () => {
  const opts = { n: 300, seed: 7 };
  const reg = capabilityRegistry();
  const dated = Object.entries(reg).flatMap(([f, settings]) => Object.entries(settings).flatMap(([s, { values }]) => Object.entries(values).filter(([, row]) => row.since).map(([v, row]) => ({ key: `${f}.${s}=${v}`, row }))));
  const days = dated.map((d) => d.row.since).sort(), first = days[0], last = days.at(-1);
  const u = unlockedSince({ since: first, ...opts });

  it('only a built value says the day it was built, and the registry dates some', () => {
    expect(dated.length).toBeGreaterThan(0);
    for (const d of dated) { expect(d.row.status, d.key).toBe('built'); expect(d.row.since, d.key).toMatch(/^\d{4}-\d{2}-\d{2}$/); }
  });

  it('is seeded, and counts the worlds the sweep counts', () => {
    expect(unlockedSince({ since: first, ...opts })).toEqual(u);
    expect(u.made.now).toBe(sweep(opts).verdicts.makeable);
    expect(u.made.before).toBeLessThanOrEqual(u.made.now);
  });

  it('reports every value built since the day and no other; a later day keeps fewer', () => {
    expect(u.values.map((v) => v.key).sort()).toEqual(dated.map((d) => d.key).sort());
    const late = unlockedSince({ since: last, ...opts });
    expect(late.values.map((v) => v.key).sort()).toEqual(dated.filter((d) => d.row.since === last).map((d) => d.key).sort());
    expect(late.made.before).toBeGreaterThanOrEqual(u.made.before);
    expect(() => unlockedSince({ since: 'lately' })).toThrow(/since is a day/);
  });

  it('splits the worlds that hold a value into made and waiting, the waiting ones on packages still to build', () => {
    for (const v of u.values) {
      expect(v.made + v.waits, v.key).toBe(v.holds);
      for (const o of v.on) { expect(o.worlds, v.key).toBeLessThanOrEqual(v.waits); expect(u.names[o.id], o.id).toBeTruthy(); }
      if (v.waits) expect(v.on.length, v.key).toBeGreaterThan(0);
    }
    // a world made by them holds one at least: the makeable worlds that fall without them are those that hold any
    expect(u.made.now - u.made.before).toBeLessThanOrEqual(u.values.reduce((n, v) => n + v.made, 0));
    for (const p of u.pairs) { expect(p.made).toBeLessThanOrEqual(p.holds); expect(p.a < p.b).toBe(true); }
  });
});
