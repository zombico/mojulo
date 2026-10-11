/**
 * THE COSMOS SWEEP: which kinds of game fall out of the builder today, and which facet is the bottleneck, without
 * building one. It dry-runs the fixtures, then N cubes, and counts.
 *
 *   rollCube(rand, density?, roll?)  one cube. `fair` (the default) gives every facet the same odds of settings,
 *                                    whatever its size: density × the mean settings a facet has (0.2: about nine
 *                                    values a cube, as a fixture reads). `flat` sets each setting at odds `density`,
 *                                    so a facet with more settings shows up more. A set setting takes one value, a
 *                                    multi setting one or two
 *   nudgeCube(rand, cube)            a fixture with one or two settings changed: a game near one people ask for
 *   sweep({ n, seed, density, roll, around })
 *        → { seed, n, density, roll, around, fixtures, verdicts, godotOk, unlock: { facets, values, packages, godot } }
 *        `around`: a fixture id, or 'probes' (every non-anchor), to nudge instead of rolling blind
 *
 * The UNLOCK RANKING is a counterfactual recount over the cubes. A cube's issues are its absent, local and partial
 * values; building an issue turns it `built`. Building a value also builds what it `requires` that is not built yet,
 * transitively (its CLOSURE), so a value that needs another is never credited as if it stood alone. For each issue
 * value, and for each facet (all its values, and their closure):
 *   lifts     cubes whose verdict would step up if it were built: blocked → gaps or makeable, gaps → makeable
 *   makeable  of those, the cubes that would be makeable outright
 *   touches   cubes that hold it at all
 * Ranked by lifts. The facet rows are the "how much would building Mind or Time unlock" number.
 *
 * The PACKAGE rows price it: a package is the set of values one change fills (packages.js; a value without `pkg` is
 * its own), credited with its closure. `cost` is the effort weight of every package in that closure, `needs` names
 * the others, and `perEffort` = lifts ÷ cost. Ranked by perEffort, unsized last (a closure with any unsized package
 * is unsized): this is the build order, recomputed by every sweep.
 *
 * The GODOT rows are the same recount for the export: a cube survives it when it holds no value Godot loses. A value
 * travelling credits the cubes whose every loss it is; a setting travelling (all its values) credits the cubes whose
 * every loss is in it. Combat carries the mechanics that wait on its hits (HIT_MECHANICS): they travel with it.
 *   values, settings  { key | setting, survives, touches }, by survives
 *   ladders           per facet, its settings added one at a time, the largest gain first, the other facets' losses
 *                     kept: { [facet]: [{ setting, gain, survives }] }, `survives` counting every setting above it too
 *
 * Seeded (`mulberry32`), pure and deterministic: the same arguments give the same report, byte for byte.
 */
import { mulberry32 } from '../vegetation/grow.js';
import { FACETS } from './facets/index.js';
import { capabilityRegistry } from './registry.js';
import { dryRun } from './cosmos.js';
import { FIXTURES, fixture } from './fixtures.js';
import { PACKAGES, EFFORT_WEIGHT } from './packages.js';
import { HIT_MECHANICS } from '../scene/engine-portability.js';

const key = (i) => `${i.facet}.${i.setting}=${i.value}`;
const pick = (rand, list) => list[Math.floor(rand() * list.length)];
export const ROLLS = Object.freeze(['fair', 'flat']);

function rollSetting(rand, s) {
  const values = Object.keys(s.values);
  if (!s.multi) return pick(rand, values);
  const a = pick(rand, values), b = pick(rand, values);
  return rand() < 0.5 || a === b ? [a] : [a, b];
}

export function rollCube(rand, density = 0.2, roll = 'fair') {
  if (!ROLLS.includes(roll)) throw new Error(`cosmos: roll is ${ROLLS.join(' | ')}, not '${roll}'`);
  const reg = capabilityRegistry(), cube = {};
  const mean = FACETS.reduce((n, { id }) => n + Object.keys(reg[id]).length, 0) / FACETS.length;
  for (const { id } of FACETS) {
    const spec = {}, settings = Object.entries(reg[id]);
    const odds = roll === 'flat' ? density : Math.min(1, (density * mean) / settings.length);
    for (const [setting, s] of settings) {
      if (rand() >= odds) continue;
      spec[setting] = rollSetting(rand, s);
    }
    if (Object.keys(spec).length) cube[id] = spec;
  }
  return cube;
}

export function nudgeCube(rand, cube) {
  const reg = capabilityRegistry(), out = JSON.parse(JSON.stringify(cube));
  const changes = rand() < 0.5 ? 1 : 2;
  for (let i = 0; i < changes; i++) {
    const { id } = pick(rand, FACETS), [setting, s] = pick(rand, Object.entries(reg[id]));
    (out[id] ||= {})[setting] = rollSetting(rand, s);
  }
  return out;
}

const rowOf = (reg, k) => {
  const eq = k.indexOf('='), dot = k.indexOf('.');
  return reg[k.slice(0, dot)][k.slice(dot + 1, eq)].values[k.slice(eq + 1)];
};

// every value key the registry holds, and each package's members (a value without `pkg` is its own package)
function packageIndex(reg) {
  const members = {}, of = {};
  for (const [f, settings] of Object.entries(reg)) {
    for (const [s, { values }] of Object.entries(settings)) {
      for (const [v, row] of Object.entries(values)) {
        if (row.status === 'built') continue;
        const k = `${f}.${s}=${v}`, id = row.pkg || k;
        (members[id] ||= []).push(k);
        of[k] = id;
      }
    }
  }
  return { members, of };
}

// the values building `keys` builds: themselves and every prerequisite not yet built, transitively
function closure(reg, keys) {
  const out = new Set(), stack = [...keys];
  while (stack.length) {
    const k = stack.pop();
    if (out.has(k)) continue;
    out.add(k);
    for (const q of rowOf(reg, k).requires || []) if (rowOf(reg, q).status !== 'built') stack.push(q);
  }
  return out;
}

function packageMeta(reg, id) {
  if (PACKAGES[id]) return { name: PACKAGES[id].name, effort: PACKAGES[id].effort };
  return { name: id, effort: rowOf(reg, id).effort || null };
}

function rankPackages(rows) {
  for (const r of Object.values(rows)) r.perEffort = r.cost ? Math.round((100 * r.lifts) / r.cost) / 100 : null;
  return Object.values(rows)
    .filter((r) => r.touches)
    .sort((a, b) => (b.perEffort ?? -1) - (a.perEffort ?? -1) || b.lifts - a.lifts || a.id.localeCompare(b.id));
}

function rank(rows) {
  return Object.values(rows)
    .filter((r) => r.touches)
    .sort((a, b) => b.lifts - a.lifts || b.makeable - a.makeable || b.touches - a.touches || (a.key || a.facet).localeCompare(b.key || b.facet));
}

// the setting a lost value travels with: its own, or combat for a mechanic that waits on hits
const godotGroup = (x) => (x.facet === 'power' && x.setting === 'mechanics' && HIT_MECHANICS.includes(x.value) ? 'power.combat' : `${x.facet}.${x.setting}`);
const HIT_KEYS = HIT_MECHANICS.map((m) => `power.mechanics=${m}`);
const byKey = (a, b) => b.survives - a.survives || b.touches - a.touches || (a.key || a.setting).localeCompare(b.key || b.setting);

// the Godot counterfactual over each cube's losses (a list of lost-value lists, one per cube that does not survive)
function godotUnlock(losses, survive) {
  const values = {}, settings = {};
  for (const lost of losses) {
    const keys = lost.map(key), groups = new Set(lost.map(godotGroup));
    for (const k of new Set(keys)) {
      const carried = new Set([k, ...(k.startsWith('power.combat=') ? HIT_KEYS : [])]);
      const row = (values[k] ||= { key: k, survives: 0, touches: 0 });
      row.touches++;
      if (keys.every((x) => carried.has(x))) row.survives++;
    }
    for (const g of groups) {
      const row = (settings[g] ||= { setting: g, survives: 0, touches: 0 });
      row.touches++;
      if (groups.size === 1) row.survives++;
    }
  }
  // a facet's ladder: add the setting that frees the most cubes with what is already travelling, ties by name
  const sets = losses.map((lost) => new Set(lost.map(godotGroup))), ladders = {};
  for (const facet of [...new Set(Object.keys(settings).map((g) => g.split('.')[0]))].sort()) {
    const left = Object.keys(settings).filter((g) => g.startsWith(`${facet}.`)).sort(), travelled = new Set(), ladder = [];
    let total = survive;
    while (left.length) {
      let best = null, bestGain = -1;
      for (const g of left) {
        let gain = 0;
        for (const s of sets) if (s.has(g) && [...s].every((x) => x === g || travelled.has(x))) gain++;
        if (gain > bestGain) { best = g; bestGain = gain; }
      }
      left.splice(left.indexOf(best), 1);
      travelled.add(best);
      total += bestGain;
      ladder.push({ setting: best, gain: bestGain, survives: total });
    }
    ladders[facet] = ladder;
  }
  return { values: Object.values(values).sort(byKey), settings: Object.values(settings).sort(byKey), ladders };
}

function baseCubes(around) {
  if (around == null) return null;
  if (around === 'probes') return FIXTURES.filter((f) => !f.anchor).map((f) => f.cube);
  return [fixture(around).cube];
}

export function sweep({ n = 500, seed = 1, density = 0.2, roll = 'fair', around = null } = {}) {
  const fixtures = FIXTURES.map((f) => {
    const r = dryRun(f.cube);
    return { id: f.id, name: f.name, anchor: f.anchor, verdict: r.verdict, blocked: r.blocked.map(key), gaps: r.gaps.map(key), godot: r.godot.ok };
  });

  const reg = capabilityRegistry(), { members, of } = packageIndex(reg);
  const closures = new Map();
  const closed = (id, keys) => closures.get(id) || closures.set(id, closure(reg, keys)).get(id);
  const facetKeys = (f) => Object.keys(of).filter((k) => k.startsWith(`${f}.`));

  const bases = baseCubes(around), rand = mulberry32(seed);
  const verdicts = { makeable: 0, gaps: 0, blocked: 0 };
  let godotOk = 0;
  const losses = [];
  const row = (id) => ({ ...id, lifts: 0, makeable: 0, touches: 0 });
  const values = {}, packages = {}, facets = Object.fromEntries(FACETS.map(({ id }) => [id, row({ facet: id })]));
  // would building `built` (a closure) step this verdict up, and all the way to makeable?
  const credit = (r, built, into) => {
    const covered = (x) => built.has(key(x)), issues = [...r.blocked, ...r.gaps];
    into.touches++;
    const all = issues.every(covered);
    if (all) into.makeable++;
    if (r.verdict === 'blocked' ? r.blocked.every(covered) : all) into.lifts++;
  };
  for (let i = 0; i < n; i++) {
    const r = dryRun(bases ? nudgeCube(rand, bases[i % bases.length]) : rollCube(rand, density, roll));
    verdicts[r.verdict]++;
    if (r.godot.ok) godotOk++;
    else losses.push(r.godot.lost);
    const issues = [...r.blocked, ...r.gaps];
    for (const it of issues) {
      const k = key(it);
      credit(r, closed(`value:${k}`, [k]), (values[k] ||= row({ key: k, status: it.status })));
    }
    for (const f of new Set(issues.map((x) => x.facet))) credit(r, closed(`facet:${f}`, facetKeys(f)), facets[f]);
    for (const id of new Set(issues.map((x) => of[key(x)]))) {
      const built = closed(`pkg:${id}`, members[id]);
      if (!packages[id]) {
        const needs = [...new Set([...built].map((k) => of[k]))].filter((p) => p !== id).sort();
        const sizes = [id, ...needs].map((p) => packageMeta(reg, p).effort);
        const cost = sizes.every(Boolean) ? sizes.reduce((w, e) => w + EFFORT_WEIGHT[e], 0) : null;
        packages[id] = row({ id, ...packageMeta(reg, id), needs, cost });
      }
      credit(r, built, packages[id]);
    }
  }
  return { seed, n, density, roll, around, fixtures, verdicts, godotOk, unlock: { facets: rank(facets), values: rank(values), packages: rankPackages(packages), godot: godotUnlock(losses, godotOk) } };
}
