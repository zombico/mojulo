/**
 * WHAT TO BUILD TOGETHER: the hill-climb read of the sweep. The sweep prices one change at a time; a rolled world often
 * waits on several, and two changes can make worlds that neither makes alone. Over the sweep's own rolls (the same seed
 * gives the same worlds), at the level of work packages (packages.js: a value without `pkg` is its own package):
 *
 *   composeCandidates({ n, seed, density, roll, around }) → {
 *     recipes: [{ packages: [id], worlds, cost }],   // the exact packages that stand between a world and makeable, counted
 *     pairs:   [{ a, b, worlds, alone, synergy, cost }],   // worlds made by building a and b; `synergy` those neither makes alone
 *     names:   { <package id>: { name, effort } },
 *   }
 *
 * `cost` sums the effort weights (packages.js) of the packages and the unbuilt packages they need; null when one is
 * unpriced. Pure and seeded, as sweep.js is.
 *
 * WHAT WAS UNLOCKED: the same counterfactual run backwards. A hand value says the day it was built (`since`,
 * 'YYYY-MM-DD'); taking the values built since a day back out of the registry says what they made, and what the worlds
 * that hold them still wait on: the half of a combination that is not built yet, which is the next build.
 *
 *   unlockedSince({ since, n, seed, density, roll, around }) → {
 *     since, worlds,
 *     made:    { now, before },                      // makeable worlds with these values built, and without them
 *     values:  [{ key, since, holds, made, waits, on: [{ id, worlds }] }],
 *              // holds: worlds that set it · made: of those, makeable (each falls without it) · waits: the rest, and
 *              // the packages they wait on, most worlds first
 *     pairs:   [{ a, b, holds, made }],              // two of them set in one world: a combination newly sayable
 *     names:   { <package id>: { name, effort } },
 *   }
 */
import { mulberry32 } from '../vegetation/grow.js';
import { capabilityRegistry } from './registry.js';
import { dryRun } from './cosmos.js';
import { EFFORT_WEIGHT } from './packages.js';
import { rollCube, nudgeCube, key, closure, packageIndex, packageMeta, baseCubes } from './sweep.js';

export function composeCandidates({ n = 500, seed = 1, density = 0.2, roll = 'fair', around = null } = {}) {
  const reg = capabilityRegistry(), { members, of } = packageIndex(reg);
  const closed = new Map();
  // the value keys building these packages builds (their members and every unbuilt prerequisite)
  const built = (ids) => {
    const k = ids.join('|');
    if (!closed.has(k)) closed.set(k, closure(reg, ids.flatMap((id) => members[id])));
    return closed.get(k);
  };
  const costOf = (ids) => {
    const all = new Set(ids);
    for (const k of built(ids)) all.add(of[k]);
    let w = 0;
    for (const id of all) { const e = packageMeta(reg, id).effort; if (!e) return null; w += EFFORT_WEIGHT[e]; }
    return w;
  };
  const bases = baseCubes(around), rand = mulberry32(seed);
  const recipes = new Map(), pairs = new Map(), names = {};
  for (let i = 0; i < n; i++) {
    const r = dryRun(bases ? nudgeCube(rand, bases[i % bases.length]) : rollCube(rand, density, roll));
    if (r.verdict === 'makeable') continue;
    const issues = [...r.blocked, ...r.gaps].map(key);
    const ids = [...new Set(issues.map((k) => of[k]))].sort();
    for (const id of ids) names[id] ||= packageMeta(reg, id);
    const rk = ids.join('|');
    (recipes.get(rk) || recipes.set(rk, { packages: ids, worlds: 0 }).get(rk)).worlds++;
    const covers = (set) => issues.every((k) => set.has(k));
    // every pair of the world's packages: does building the two make it? would either alone?
    for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) {
      const a = ids[x], b = ids[y];
      if (!covers(built([a, b]))) continue;
      const pk = `${a}|${b}`, row = pairs.get(pk) || pairs.set(pk, { a, b, worlds: 0, alone: 0, synergy: 0 }).get(pk);
      row.worlds++;
      if (covers(built([a])) || covers(built([b]))) row.alone++; else row.synergy++;
    }
  }
  const byWorth = (x, y) => y.worlds - x.worlds || (x.cost ?? Infinity) - (y.cost ?? Infinity) || x.key.localeCompare(y.key);
  return {
    recipes: [...recipes.entries()].map(([k, r]) => ({ ...r, key: k, cost: costOf(r.packages) })).sort(byWorth).map(({ key: _, ...r }) => r),
    pairs: [...pairs.entries()].map(([k, p]) => ({ ...p, key: k, cost: costOf([p.a, p.b]) }))
      .sort((x, y) => y.synergy - x.synergy || byWorth(x, y)).map(({ key: _, ...p }) => p),
    names,
  };
}

export function unlockedSince({ since, n = 500, seed = 1, density = 0.2, roll = 'fair', around = null } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since || '')) throw new Error(`cosmos: since is a day, 'YYYY-MM-DD', not '${since}'`);
  const reg = capabilityRegistry(), { of } = packageIndex(reg);
  // the values built on or after the day, by key
  const recent = new Map();
  for (const [f, settings] of Object.entries(reg)) for (const [s, { values }] of Object.entries(settings)) for (const [v, row] of Object.entries(values)) {
    if (row.status === 'built' && row.since && row.since >= since) recent.set(`${f}.${s}=${v}`, row.since);
  }
  const bases = baseCubes(around), rand = mulberry32(seed);
  const rows = new Map([...recent].map(([k, day]) => [k, { key: k, since: day, holds: 0, made: 0, waits: 0, on: new Map() }]));
  const pairs = new Map(), names = {}, made = { now: 0, before: 0 };
  for (let i = 0; i < n; i++) {
    const r = dryRun(bases ? nudgeCube(rand, bases[i % bases.length]) : rollCube(rand, density, roll));
    const held = [];
    for (const [fid, f] of Object.entries(r.facets)) for (const x of f.rows) { const k = `${fid}.${x.setting}=${x.value}`; if (recent.has(k)) held.push(k); }
    const makeable = r.verdict === 'makeable';
    if (makeable) { made.now++; if (!held.length) made.before++; }
    const waitsOn = makeable ? [] : [...new Set([...r.blocked, ...r.gaps].map((x) => of[key(x)]))];
    for (const id of waitsOn) names[id] ||= packageMeta(reg, id);
    for (const k of held) {
      const row = rows.get(k);
      row.holds++;
      if (makeable) row.made++; else { row.waits++; for (const id of waitsOn) row.on.set(id, (row.on.get(id) || 0) + 1); }
    }
    held.sort();
    for (let x = 0; x < held.length; x++) for (let y = x + 1; y < held.length; y++) {
      const pk = `${held[x]}|${held[y]}`, p = pairs.get(pk) || pairs.set(pk, { a: held[x], b: held[y], holds: 0, made: 0 }).get(pk);
      p.holds++;
      if (makeable) p.made++;
    }
  }
  const values = [...rows.values()]
    .map((r) => ({ ...r, on: [...r.on.entries()].map(([id, worlds]) => ({ id, worlds })).sort((x, y) => y.worlds - x.worlds || x.id.localeCompare(y.id)) }))
    .sort((x, y) => y.made - x.made || y.holds - x.holds || x.key.localeCompare(y.key));
  return {
    since, worlds: n, made, values,
    pairs: [...pairs.values()].sort((x, y) => y.made - x.made || y.holds - x.holds || `${x.a}|${x.b}`.localeCompare(`${y.a}|${y.b}`)),
    names,
  };
}
