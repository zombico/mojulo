/**
 * A GAME'S TREES (a world's `trees`): what the hero grows into as it plays, two trees on one grammar.
 *
 *   the SKILL TREE on MOVEMENT (`movement`)   each node a way the hero moves (movement.js MOVE_SKILLS: a second jump, a
 *                    third, a higher jump, a glide, a faster run, a longer dash, an air dash more), a patch to its rule
 *   the TECH TREE on SPELLS AND ATTACKS (`techs`)   each node a string it strikes or a spell it casts for MP (techs.js
 *                    TECHS: a thrust, a cleave forked off its own string, a launcher, a plunge; a burst, a dashing cut,
 *                    a spiral), added to its moveset and held shut until learned
 *
 *   trees: {
 *     points?:  { boss?, power?, key?, prize? }   what each thing held gives to spend (absent: a point a boss felled),
 *                                                 one purse for both trees
 *     souls?:   { minion?, elite?, per }          what each foe's fall gives by its rank, a point for every `per` of
 *                                                 them: the purse filled by the fight as well as by what is found
 *     movement?: { name?, nodes: [NODE] },   techs?: { name?, nodes: [NODE] } }
 *   NODE = { id?, move | tech, name?, requires?: [<node id>], cost?, found? }
 *     move / tech   its row (the node's id where it gives none)
 *     requires      the nodes learned before it, in its own tree: its edges
 *     cost          the points it takes (0: learned from the start, where nothing is required of it)
 *     found         a power's id (the map's `powers`): learned as the power is found, never bought (a relic's move: the
 *                   second leap's double jump is the movement tree's root)
 *
 *   TREE_IDS, TREE_LAWS, POINTS_BY
 *   readTrees(v)                → the trees read ({ points, trees: [{ id, name, nodes: [{ id, row, name, requires, cost,
 *                                 found? }] }] }), or throws, teaching
 *   treeLaws(R, { powers?, earnable? }) → [{ id, holds, says }]   rooted (each tree has a node it starts from: found or
 *                                 free), no-cycle, reachable (every requirement a node of its tree), costs-rise (no node
 *                                 cheaper than what it is bought after), found-known (each `found` a power the map
 *                                 holds), within-means (every node's way to it bought with the points the level gives)
 *   lowerTrees(R, { rule, combos?, powers? }) → { spec, moveset? }   the runtime's (worlds/controllable/trees.js): each
 *                                 node with its patch (a move's, made from `rule`) or its strings (a tech's, added to
 *                                 `combos`, the hero's own manifest), a found node the token its power gives; `moveset`
 *                                 the hero's own with the techs' strings in it, each held shut (`gated`)
 *   nodeStates(spec, learned, points) → [{ id, tree, name, about, cost, state, requires }]   learned | available |
 *                                 found (waits for its power) | locked: what the skill-tree screen draws (mana-ui's `tree`)
 *
 * Pure.
 */
import { MOVE_SKILLS, moveSkillPatch } from './movement.js';
import { TECHS, techCombos } from './techs.js';
import { lowerCombos } from '../combos.js';

export const TREE_IDS = Object.freeze(['movement', 'techs']);
export const TREE_LAWS = Object.freeze(['rooted', 'no-cycle', 'reachable', 'costs-rise', 'found-known', 'within-means']);
/** what a thing held gives to spend: the held gates' tokens by their kind (worlds/controllable/held-gates.js) */
export const POINTS_BY = Object.freeze({ boss: 'boss:', power: 'gate:', key: 'key:', prize: 'prize:' });
const ID = /^[a-z][a-z0-9-]{0,31}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (m) => { throw new Error(`trees: ${m}`); };
const ROW = { movement: ['move', MOVE_SKILLS, 'a way to move'], techs: ['tech', TECHS, 'an attack or a spell'] };

/** The trees read. */
export function readTrees(v) {
  if (!isObj(v)) fail('trees is { points?, movement?: { nodes }, techs?: { nodes } }');
  for (const k of Object.keys(v)) if (!['points', 'souls', ...TREE_IDS].includes(k)) fail(`${k} is not a tree's word (points, souls, ${TREE_IDS.join(', ')})`);
  if (!TREE_IDS.some((t) => v[t] !== undefined)) fail('trees holds a tree at least: movement (a skill tree on how the hero moves) or techs (a tech tree on its spells and attacks)');
  const points = v.points ?? { boss: 1 };
  if (!isObj(points) || Object.entries(points).some(([k, n]) => !POINTS_BY[k] || !(Number.isInteger(n) && n >= 0 && n <= 9))) fail(`points is { ${Object.keys(POINTS_BY).join('?, ')}? }: what each thing held gives to spend, 0 to 9`);
  let souls = null;
  if (v.souls !== undefined) {
    const S = v.souls, ok = (n) => Number.isInteger(n) && n >= 0 && n <= 99;
    if (!isObj(S) || Object.keys(S).some((k) => !['minion', 'elite', 'per'].includes(k)) || !(Number.isInteger(S.per) && S.per >= 1 && S.per <= 999) || [S.minion, S.elite].some((n) => n !== undefined && !ok(n))) fail('souls is { minion?, elite?, per }: what a foe\'s fall gives by its rank, a point for every `per` of them');
    souls = { minion: S.minion ?? 1, elite: S.elite ?? 3, per: S.per };
  }
  const ids = new Set(), trees = [];
  for (const t of TREE_IDS) {
    if (v[t] === undefined) continue;
    const T = v[t], [key, rows, what] = ROW[t];
    if (!isObj(T) || !Array.isArray(T.nodes) || !T.nodes.length) fail(`${t} is { name?, nodes: [{ ${key}, requires?, cost?, found? }] }`);
    for (const k of Object.keys(T)) if (!['name', 'nodes'].includes(k)) fail(`${t}.${k} is not a tree's word (name, nodes)`);
    const nodes = T.nodes.map((N, i) => {
      const at = `${t}.nodes[${i}]`;
      if (!isObj(N)) fail(`${at} is { ${key}, requires?, cost?, found? }`);
      for (const k of Object.keys(N)) if (!['id', key, 'name', 'requires', 'cost', 'found'].includes(k)) fail(`${at}.${k} is not a node's word (id, ${key}, name, requires, cost, found)`);
      if (!rows[N[key]]) fail(`${at}.${key} is ${what}: ${Object.keys(rows).join(', ')}`);
      const id = N.id ?? N[key];
      if (!ID.test(id)) fail(`${at}.id is a short lower-case name`);
      if (ids.has(id)) fail(`${at}: '${id}' is a node already (a node's id is its row's, or the id it says)`);
      ids.add(id);
      if (N.requires !== undefined && !(Array.isArray(N.requires) && N.requires.every((x) => typeof x === 'string'))) fail(`${at}.requires is a list of the nodes learned before it`);
      if (N.cost !== undefined && !(Number.isInteger(N.cost) && N.cost >= 0 && N.cost <= 9)) fail(`${at}.cost is the points it takes, 0 to 9`);
      if (N.found !== undefined && typeof N.found !== 'string') fail(`${at}.found is a power's id: learned as the power is found`);
      if (N.found !== undefined && N.cost) fail(`${at}: a found node is given by its power, never bought (no cost)`);
      if (N.name !== undefined && !(typeof N.name === 'string' && N.name.trim())) fail(`${at}.name is a word`);
      return { id, row: N[key], name: (N.name ?? id).trim(), requires: [...(N.requires ?? [])], cost: N.cost ?? 0, ...(N.found ? { found: N.found } : {}) };
    });
    for (const N of nodes) for (const r of N.requires) if (!nodes.some((x) => x.id === r)) fail(`${t}: ${N.id} requires '${r}', no node of its tree`);
    trees.push({ id: t, name: (T.name ?? (t === 'movement' ? 'Skills' : 'Techs')).trim(), nodes });
  }
  return { points: { ...points }, ...(souls ? { souls } : {}), trees };
}

/** Each node's cheapest way to it: its own cost and its requirements' ways, once each. */
function waysOf(nodes) {
  const by = new Map(nodes.map((n) => [n.id, n])), memo = new Map();
  const way = (id, seen = new Set()) => {
    if (memo.has(id)) return memo.get(id);
    if (seen.has(id)) return null;
    seen.add(id);
    const n = by.get(id), all = new Set([id]);
    for (const r of n.requires) { const w = way(r, new Set(seen)); if (w === null) return null; for (const x of w) all.add(x); }
    memo.set(id, all);
    return all;
  };
  return { by, way };
}

/** The trees' laws. */
export function treeLaws(R, { powers, earnable } = {}) {
  const out = [], law = (id, holds, says) => out.push({ id, holds: !!holds, says });
  const roots = R.trees.filter((t) => !t.nodes.some((n) => !n.requires.length)).map((t) => t.id);
  law('rooted', !roots.length, roots.length ? `${roots.join(', ')} has no node to start from` : R.trees.map((t) => `${t.id} from ${t.nodes.filter((n) => !n.requires.length).map((n) => n.id).join(', ')}`).join('; '));
  const cyc = [];
  for (const t of R.trees) { const W = waysOf(t.nodes); for (const n of t.nodes) if (W.way(n.id) === null) cyc.push(n.id); }
  law('no-cycle', !cyc.length, cyc.length ? `${cyc.join(', ')} require${cyc.length === 1 ? 's' : ''} themselves on the way` : 'no node is required on its own way');
  law('reachable', !cyc.length && !roots.length, cyc.length || roots.length ? 'nodes out of reach of any root' : 'every node is reached from a root of its tree');
  const cheap = [];
  for (const t of R.trees) for (const n of t.nodes) for (const r of n.requires) { const q = t.nodes.find((x) => x.id === r); if (n.cost && q.cost > n.cost) cheap.push(`${n.id} (${n.cost}) after ${q.id} (${q.cost})`); }
  law('costs-rise', !cheap.length, cheap.length ? `cheaper than what it is bought after: ${cheap.join('; ')}` : 'no node costs less than what it is bought after');
  if (powers) {
    const unknown = R.trees.flatMap((t) => t.nodes.filter((n) => n.found && !powers[n.found]).map((n) => `${n.id} (${n.found})`));
    law('found-known', !unknown.length, unknown.length ? `found by a power the map holds none of: ${unknown.join(', ')}` : `every found node given by a power the map holds`);
  }
  if (earnable !== undefined && !cyc.length) {
    const dear = [];
    for (const t of R.trees) { const W = waysOf(t.nodes); for (const n of t.nodes) { const c = [...W.way(n.id)].reduce((a, id) => a + W.by.get(id).cost, 0); if (c > earnable) dear.push(`${n.id} (${c})`); } }
    law('within-means', !dear.length, dear.length ? `out of the level's means (${earnable} points): ${dear.join(', ')}` : `every node bought within the ${earnable} points the level gives`);
  }
  return TREE_LAWS.map((id) => out.find((l) => l.id === id)).filter(Boolean);
}

/** The runtime's spec, and the hero's moveset with the techs' strings in it, held shut. */
export function lowerTrees(R, { rule, combos = null, powers = {} } = {}) {
  const nodes = [];
  const techIds = R.trees.find((t) => t.id === 'techs')?.nodes.map((n) => n.row) ?? [];
  if (techIds.length && !combos) fail('techs: this hero strikes no string to add the attacks and spells to (its feel gives no moveset)');
  const T = techIds.length ? techCombos(combos, techIds) : null;
  const comboOf = T ? Object.fromEntries(Object.entries(T.gated).map(([c, id]) => [id, c])) : {};
  for (const t of R.trees) for (const n of t.nodes) {
    const P = powers[n.found];
    nodes.push({ id: n.id, tree: t.id, name: n.name, about: (t.id === 'movement' ? MOVE_SKILLS : TECHS)[n.row].read, requires: [...n.requires], cost: n.cost,
      ...(n.found ? { found: P ? `gate:${P.opens}` : `power:${n.found}` } : {}),
      ...(t.id === 'movement' ? { patch: moveSkillPatch(n.row, rule) } : { combos: [comboOf[n.row]], kind: TECHS[n.row].kind }) });
  }
  const spec = { target: 'hero', points: { ...R.points }, ...(R.souls ? { souls: { ...R.souls } } : {}), trees: R.trees.map((t) => ({ id: t.id, name: t.name })), nodes };
  return { spec, ...(T ? { moveset: { ...lowerCombos(T.manifest), gated: Object.fromEntries(Object.keys(T.gated).map((c) => [c, true])) } } : {}) };
}

/** What the skill-tree screen draws: each node's state. */
export function nodeStates(spec, learned = {}, points = 0) {
  return spec.nodes.map((n) => {
    const ready = n.requires.every((r) => learned[r] != null);
    const state = learned[n.id] != null ? 'learned' : n.found ? 'found' : ready && n.cost <= points ? 'available' : 'locked';
    return { id: n.id, tree: n.tree, name: n.name, about: n.about, cost: n.cost, state, requires: [...n.requires] };
  });
}
