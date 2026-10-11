/**
 * THE COSMOS SWEEP: which kinds of game fall out of the builder today, and which facet is the bottleneck, without
 * building one. It dry-runs the fixtures, then N cubes rolled inside the registry's values, and counts.
 *
 *   rollCube(rand, density?)     one cube: each setting is set at odds `density` (0.2: about nine values, as a
 *                                fixture reads); a set one takes one value, a multi setting one or two
 *   sweep({ n, seed, density })  → { seed, n, density, fixtures, verdicts, godotOk, unlock: { facets, values } }
 *
 * The UNLOCK RANKING is a counterfactual recount over the rolled cubes. A cube's issues are its absent, local and
 * partial values; building an issue turns it `built`. For each issue value, and for each facet (all its values):
 *   lifts     cubes whose verdict would step up if it alone were built: blocked → gaps or makeable, gaps → makeable
 *   makeable  of those, the cubes that would be makeable outright
 *   touches   cubes that hold it at all
 * Ranked by lifts. The facet rows are the "how much would building Mind or Time unlock" number.
 *
 * Seeded (`mulberry32`), pure and deterministic: the same n and seed give the same report, byte for byte.
 */
import { mulberry32 } from '../vegetation/grow.js';
import { FACETS } from './facets/index.js';
import { capabilityRegistry } from './registry.js';
import { dryRun } from './cosmos.js';
import { FIXTURES } from './fixtures.js';

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
  const values = {}, facets = Object.fromEntries(FACETS.map(({ id }) => [id, row({ facet: id })]));
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
  }
  return { seed, n, density, fixtures, verdicts, godotOk, unlock: { facets: rank(facets), values: rank(values) } };
}
