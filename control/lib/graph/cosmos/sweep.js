/**
 * THE COSMOS SWEEP: which kinds of game fall out of the builder today, and which facet is the bottleneck, without
 * building one. It dry-runs the fixtures, then N cubes rolled inside the registry's values, and counts.
 *
 *   rollCube(rand, density?)     one cube: each setting is set at odds `density` (0.2: about nine values, as a
 *                                fixture reads); a set one takes one value, a multi setting one or two
 *   sweep({ n, seed, density })  → { seed, n, density, fixtures, verdicts, godotOk, unlock: { facets, values, packages } }
 *
 * The UNLOCK RANKING is a counterfactual recount over the rolled cubes. A cube's issues are its absent, local and
 * partial values; building an issue turns it `built`. For each issue value, and for each facet (all its values):
 *   lifts     cubes whose verdict would step up if it alone were built: blocked → gaps or makeable, gaps → makeable
 *   makeable  of those, the cubes that would be makeable outright
 *   touches   cubes that hold it at all
 * Ranked by lifts. The facet rows are the "how much would building Mind or Time unlock" number.
 *
 * The PACKAGE rows price it: a package is the set of values one change fills (packages.js; a value without `pkg` is
 * its own), credited the same way, with `perEffort` = lifts ÷ its effort weight. Ranked by perEffort, unsized last:
 * this is the build order, recomputed by every sweep.
 *
 * Seeded (`mulberry32`), pure and deterministic: the same n and seed give the same report, byte for byte.
 */
import { mulberry32 } from '../vegetation/grow.js';
import { FACETS } from './facets/index.js';
import { capabilityRegistry } from './registry.js';
import { dryRun } from './cosmos.js';
import { FIXTURES } from './fixtures.js';
import { PACKAGES, EFFORT_WEIGHT } from './packages.js';

const key = (i) => `${i.facet}.${i.setting}=${i.value}`;
const pick = (rand, list) => list[Math.floor(rand() * list.length)];

export function rollCube(rand, density = 0.2) {
  const reg = capabilityRegistry(), cube = {};
  for (const { id } of FACETS) {
    const spec = {};
    for (const [setting, s] of Object.entries(reg[id])) {
      if (rand() >= density) continue;
      const values = Object.keys(s.values);
      if (!s.multi) { spec[setting] = pick(rand, values); continue; }
      const a = pick(rand, values), b = pick(rand, values);
      spec[setting] = rand() < 0.5 || a === b ? [a] : [a, b];
    }
    if (Object.keys(spec).length) cube[id] = spec;
  }
  return cube;
}

// the registry row behind an issue, and the package it belongs to
function packageOf(reg, it) {
  const row = reg[it.facet][it.setting].values[it.value];
  if (row.pkg) return { id: row.pkg, name: PACKAGES[row.pkg].name, effort: PACKAGES[row.pkg].effort };
  return { id: key(it), name: key(it), effort: row.effort || null };
}

function rankPackages(rows) {
  for (const r of Object.values(rows)) r.perEffort = r.effort ? Math.round((100 * r.lifts) / EFFORT_WEIGHT[r.effort]) / 100 : null;
  return Object.values(rows)
    .filter((r) => r.touches)
    .sort((a, b) => (b.perEffort ?? -1) - (a.perEffort ?? -1) || b.lifts - a.lifts || a.id.localeCompare(b.id));
}

function rank(rows) {
  return Object.values(rows)
    .filter((r) => r.touches)
    .sort((a, b) => b.lifts - a.lifts || b.makeable - a.makeable || b.touches - a.touches || (a.key || a.facet).localeCompare(b.key || b.facet));
}

export function sweep({ n = 500, seed = 1, density = 0.2 } = {}) {
  const fixtures = FIXTURES.map((f) => {
    const r = dryRun(f.cube);
    return { id: f.id, name: f.name, anchor: f.anchor, verdict: r.verdict, blocked: r.blocked.map(key), gaps: r.gaps.map(key), godot: r.godot.ok };
  });

  const rand = mulberry32(seed);
  const verdicts = { makeable: 0, gaps: 0, blocked: 0 };
  let godotOk = 0;
  const row = (id) => ({ ...id, lifts: 0, makeable: 0, touches: 0 });
  const values = {}, packages = {}, facets = Object.fromEntries(FACETS.map(({ id }) => [id, row({ facet: id })]));
  const reg = capabilityRegistry();
  // would building every issue that `covered` admits step this verdict up, and all the way to makeable?
  const credit = (r, covered, into) => {
    const issues = [...r.blocked, ...r.gaps];
    into.touches++;
    const all = issues.every(covered);
    if (all) into.makeable++;
    if (r.verdict === 'blocked' ? r.blocked.every(covered) : all) into.lifts++;
  };
  for (let i = 0; i < n; i++) {
    const r = dryRun(rollCube(rand, density));
    verdicts[r.verdict]++;
    if (r.godot.ok) godotOk++;
    const issues = [...r.blocked, ...r.gaps];
    for (const it of issues) {
      const k = key(it);
      credit(r, (x) => key(x) === k, (values[k] ||= row({ key: k, status: it.status })));
    }
    for (const f of new Set(issues.map((x) => x.facet))) credit(r, (x) => x.facet === f, facets[f]);
    const pkgs = new Map(issues.map((x) => { const p = packageOf(reg, x); return [p.id, p]; }));
    for (const [id, p] of pkgs) credit(r, (x) => packageOf(reg, x).id === id, (packages[id] ||= row({ id, name: p.name, effort: p.effort })));
  }
  return { seed, n, density, fixtures, verdicts, godotOk, unlock: { facets: rank(facets), values: rank(values), packages: rankPackages(packages) } };
}
