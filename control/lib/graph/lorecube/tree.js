/**
 * THE SKILL TREE — a school's techniques, from the first it teaches to its mastery: what each does, the order they are
 * come by, what each costs. A vertical slice of the lorecube, and the first that touches levelling: it lowers to the
 * party RPG's own words (playscape/rpg: a class's `skills` and the `skills` they name), read back by that game's own
 * reader.
 *
 *   DOES            what a technique does, in a lore's words, each the RPG skill it becomes at depth 0 (its target, its
 *                   power, its cost): a bolt, a storm, a blade, a ward, a surge, a mend, a hex, a drain of an edge
 *   A technique is come by in one of the RPG's two ways: LEARNED at a class rank (`at`), or BOUGHT on the tree with the
 *   class's points, after the techniques it `requires`.
 *
 * MADE IN PASSES (passes.js), a tree's ladder three rungs:
 *   premise     the school: an id, its element, its techniques (each an id and what it does): a raw-new pass's
 *   ordered     how each is come by: `at` a rank, or `requires` others (the tree's edges)
 *   costed      what each costs: its MP, and for a bought one its points
 *
 *   newTree({ id, name?, element, techniques: [{ id, does, name?, status? }] })   a RAW-NEW pass: the premise alone
 *   intensifyTree(T, { order?: { <technique>: { at } | { requires: [...] } }, costs?: true | { <technique>: { mp?, points? } } })
 *       → { tree, open }   an INTENSIFICATION, rungs in order. `costs: true` lays them by depth; an object lays the
 *       author's over those
 *   readTree(v)                  a stored tree at any depth: read, or throws, teaching
 *   TREE                         the part (passes.js)
 *   depthsOf(T) → { <technique>: n }   how far down each stands: a learned one its rank less one, a bought one a step
 *                   under the deepest it requires (a bought one requiring nothing stands under the first rank)
 *   treeLaws(T) → [{ law, ok, value }]   rooted (something is learned at rank 1), no-cycle, reachable (every bought
 *       technique's requirements end at one that is learned or needs nothing), costs-rise (a technique costs no less
 *       than what it requires), within-reach (the ranks a class has, playscape/rpg RPG_RULES cp). Advice
 *   lowerTree(T) → { classes: { <id>: { name, skills: [entry] } }, skills: { <id>: skill } }   the party RPG's words
 *       (needs the costed rung): each technique a skill of the school's element, stronger and dearer the deeper it
 *       stands; the class's entries learned by rank or bought with its points
 *
 * Pure and deterministic.
 */
import { definePart } from './passes.js';
import { rootOf, elementHandles } from './polarity.js';
import { RPG_STATUSES, RPG_RULES } from '../playscape/rpg/rpg.js';

const fail = (m) => new Error(`lorecube: tree${m}`);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** What a technique does. `skill`: the RPG skill at depth 0 (its element laid on where `elemental`); `mp` its base cost. */
export const DOES = Object.freeze({
  bolt: { reads: 'the element on one foe', elemental: true, mp: 3, skill: { target: 'foe', power: 6, stat: 'mag', scale: 0.8 } },
  storm: { reads: 'the element on every foe', elemental: true, mp: 8, skill: { target: 'foes', power: 6, stat: 'mag', scale: 0.7 } },
  blade: { reads: 'a blow that carries the element', elemental: true, mp: 4, skill: { target: 'foe', power: 4, stat: 'atk', scale: 1.3 } },
  ward: { reads: 'an ally\'s defence rises', mp: 3, skill: { target: 'ally', buff: { stat: 'def', pct: 0.5, rounds: 4 } } },
  surge: { reads: 'the party\'s attack rises', mp: 4, skill: { target: 'allies', buff: { stat: 'atk', pct: 0.25, rounds: 3 } } },
  mend: { reads: 'an ally\'s wounds close', mp: 3, skill: { target: 'ally', power: 10, stat: 'mag', scale: 1.1, heal: true } },
  hex: { reads: 'a foe is afflicted', mp: 3, skill: { target: 'foe' }, status: true },
  sap: { reads: 'a foe\'s defence falls', mp: 2, skill: { target: 'foe', buff: { stat: 'def', pct: -0.4, rounds: 3 } } },
});
export const DOES_IDS = Object.freeze(Object.keys(DOES));
/** How much stronger, and how much dearer, a technique is for each step down the tree. */
export const DEPTH = Object.freeze({ power: 0.5, mp: 0.6 });
/** The ranks a class has to learn at (the RPG's class-point thresholds). */
export const MAX_RANK = RPG_RULES.cp.length;

const ID = /^[a-z][a-z0-9-]{0,31}$/;
const KEYS = ['id', 'name', 'element', 'techniques', 'order', 'costs'];

/** A stored tree at any depth. */
export function readTree(v) {
  if (!isObj(v)) throw fail(' is { id, name?, element, techniques, order?, costs? }');
  for (const k of Object.keys(v)) if (!KEYS.includes(k)) throw fail(`.${k} is not part of a tree (${KEYS.join(', ')})`);
  if (typeof v.id !== 'string' || !ID.test(v.id)) throw fail('.id is the school\'s short lower-case word: the class it becomes');
  const element = rootOf(v.element);
  if (!element) throw fail(`.element '${v.element}' is no element the character book knows`);
  const out = { id: v.id, ...(v.name !== undefined ? { name: String(v.name).trim() } : {}), element };
  if (!Array.isArray(v.techniques) || !v.techniques.length) throw fail('.techniques is a list of { id, does, name?, status? }');
  out.techniques = v.techniques.map((t, i) => {
    const at = `.techniques[${i}]`;
    if (!isObj(t)) throw fail(`${at} is { id, does, name?, status? }`);
    for (const k of Object.keys(t)) if (!['id', 'does', 'name', 'status'].includes(k)) throw fail(`${at}.${k} is not part of a technique (id, does, name, status)`);
    if (typeof t.id !== 'string' || !ID.test(t.id)) throw fail(`${at}.id is a short lower-case word`);
    if (!DOES[t.does]) throw fail(`${at}.does is what it does: ${DOES_IDS.join(', ')}`);
    if (DOES[t.does].status) { if (!RPG_STATUSES[t.status]) throw fail(`${at}.status is what a hex afflicts with: ${Object.keys(RPG_STATUSES).join(', ')}`); } else if (t.status !== undefined) throw fail(`${at}.status is a hex's alone`);
    return { id: t.id, does: t.does, ...(t.name !== undefined ? { name: String(t.name).trim() } : {}), ...(t.status ? { status: t.status } : {}) };
  });
  const ids = out.techniques.map((t) => t.id);
  if (new Set(ids).size !== ids.length) throw fail(`.techniques: two share an id (${ids.filter((x, i) => ids.indexOf(x) !== i).join(', ')})`);
  if (v.order !== undefined) {
    if (!isObj(v.order)) throw fail('.order is { <technique>: { at: rank } | { requires: [techniques] } }');
    out.order = {};
    for (const [id, o] of Object.entries(v.order)) {
      if (!ids.includes(id)) throw fail(`.order.${id} is no technique of this tree`);
      if (!isObj(o) || (o.at === undefined) === (o.requires === undefined)) throw fail(`.order.${id} is { at: rank } (learned) or { requires: [...] } (bought after them; [] for nothing)`);
      if (o.at !== undefined) { if (!Number.isInteger(o.at) || o.at < 1) throw fail(`.order.${id}.at is a class rank, 1 or more`); out.order[id] = { at: o.at }; continue; }
      if (!Array.isArray(o.requires)) throw fail(`.order.${id}.requires is a list of techniques`);
      for (const r of o.requires) { if (!ids.includes(r)) throw fail(`.order.${id}.requires '${r}' is no technique of this tree`); if (r === id) throw fail(`.order.${id} requires itself`); }
      out.order[id] = { requires: [...o.requires] };
    }
    const missing = ids.filter((id) => !out.order[id]);
    if (missing.length) throw fail(`.order says nothing of ${missing.join(', ')}: every technique is learned at a rank or bought`);
  }
  if (v.costs !== undefined) {
    if (!isObj(v.costs)) throw fail('.costs is { <technique>: { mp, points? } }');
    out.costs = {};
    for (const [id, c] of Object.entries(v.costs)) {
      if (!ids.includes(id)) throw fail(`.costs.${id} is no technique of this tree`);
      if (!isObj(c) || !Number.isInteger(c.mp) || c.mp < 0) throw fail(`.costs.${id} is { mp: a whole number, 0 or more, points? }`);
      if (c.points !== undefined && (!Number.isInteger(c.points) || c.points < 1)) throw fail(`.costs.${id}.points is a whole number of class points, 1 or more`);
      out.costs[id] = { mp: c.mp, ...(c.points !== undefined ? { points: c.points } : {}) };
    }
    const missing = ids.filter((id) => !out.costs[id]);
    if (missing.length) throw fail(`.costs says nothing of ${missing.join(', ')}`);
  }
  return out;
}

const premiseOf = (v) => (isObj(v) ? { id: v.id, ...(v.name !== undefined ? { name: v.name } : {}), element: v.element, techniques: v.techniques } : null);
const reads = (v) => { try { return readTree(v); } catch { return null; } };

export const TREE = definePart({
  id: 'tree',
  rungs: [
    { id: 'premise', rawNew: true, holds: (v) => !!premiseOf(v) && !!reads(premiseOf(v)), view: premiseOf },
    { id: 'ordered', holds: (v) => isObj(v.order) && !!reads(v), open: () => ['order'], view: (v) => v.order },
    { id: 'costed', holds: (v) => isObj(v.costs) && !!reads(v), open: () => ['costs'], view: (v) => v.costs },
  ],
});

/** A raw-new pass: the school and what its techniques do, in no order and at no cost. */
export function newTree(v) {
  if (!isObj(v)) throw fail(' is made from { id, name?, element, techniques }');
  const more = Object.keys(v).filter((k) => ['order', 'costs'].includes(k));
  if (more.length) throw fail(`.${more[0]} is not a raw-new pass's: it says the school and its techniques and stops; ${more.join(', ')} ${more.length === 1 ? 'is' : 'are'} the next passes' (intensifyTree)`);
  return readTree(v);
}

/** How far down each technique stands; a technique in a cycle is left out (treeLaws says the cycle). */
export function depthsOf(T) {
  const V = readTree(T), O = V.order ?? {}, depth = {}, walking = new Set();
  const of = (id) => {
    if (depth[id] !== undefined) return depth[id];
    if (walking.has(id)) return null;
    const o = O[id];
    if (!o) return null;
    if (o.at !== undefined) return (depth[id] = o.at - 1);
    walking.add(id);
    const under = o.requires.map(of);
    walking.delete(id);
    if (under.some((d) => d === null)) return null;
    return (depth[id] = 1 + Math.max(0, ...under));
  };
  for (const t of V.techniques) of(t.id);
  return depth;
}

/** The costs a tree's depths give: MP dearer the deeper, a bought technique a point a step down. */
export function derivedCosts(T) {
  const V = readTree(T), D = depthsOf(V);
  return Object.fromEntries(V.techniques.filter((t) => D[t.id] !== undefined).map((t) => {
    const d = D[t.id], bought = V.order[t.id].requires !== undefined;
    return [t.id, { mp: Math.round(DOES[t.does].mp * (1 + DEPTH.mp * d)), ...(bought ? { points: d } : {}) }];
  }));
}

/** An intensification: the order, then the costs; what was there is never touched. */
export function intensifyTree(T, add = {}) {
  const base = readTree(T);
  if (!isObj(add)) throw fail(' is intensified with { order?, costs? }');
  for (const k of Object.keys(add)) {
    if (['id', 'name', 'element', 'techniques'].includes(k)) throw fail(`.${k} is its premise: an intensification adds under it and never changes it`);
    if (!KEYS.includes(k)) throw fail(`.${k} is not part of a tree (${KEYS.join(', ')})`);
    if (base[k] !== undefined) throw fail(`.${k} is already said: an intensification adds the rungs that are missing and changes none`);
  }
  let next = { ...base, ...(add.order !== undefined ? { order: add.order } : {}) };
  if (add.costs !== undefined) {
    if (!next.order) throw fail(': its costs are said before its order: how a technique is come by comes before what it costs');
    if (add.costs !== true && !isObj(add.costs)) throw fail('.costs is true (by depth) or { <technique>: { mp?, points? } }');
    const derived = derivedCosts(readTree(next));
    next = { ...next, costs: add.costs === true ? derived : { ...derived, ...Object.fromEntries(Object.entries(add.costs).map(([id, c]) => [id, { ...(derived[id] ?? {}), ...c }])) } };
  }
  const tree = readTree(next);
  return { tree, open: !tree.order ? ['order'] : !tree.costs ? ['costs'] : [] };
}

/** The laws a tree is held to: advice, never a refusal. */
export function treeLaws(T) {
  const V = readTree(T), laws = [];
  if (!V.order) return laws;
  const D = depthsOf(V), ids = V.techniques.map((t) => t.id);
  const first = ids.filter((id) => V.order[id].at === 1);
  const stuck = ids.filter((id) => D[id] === undefined);
  // a cycle: a technique that is reached again by following what it requires
  const cyclic = ids.filter((id) => { const seen = new Set(), walk = (x) => (V.order[x].requires ?? []).some((r) => r === id || (!seen.has(r) && (seen.add(r), walk(r)))); return walk(id); });
  const late = ids.filter((id) => V.order[id].at !== undefined && V.order[id].at > MAX_RANK);
  laws.push(
    { law: 'rooted', ok: first.length > 0, value: first.join(', ') || 'nothing is learned at rank 1' },
    { law: 'no-cycle', ok: cyclic.length === 0, value: cyclic.join(', ') || 'none' },
    { law: 'reachable', ok: stuck.length === 0, value: stuck.join(', ') || 'all' },
    { law: 'within-reach', ok: late.length === 0, value: late.join(', ') || `all by rank ${MAX_RANK}` },
  );
  if (V.costs) {
    const cheap = ids.flatMap((id) => (V.order[id].requires ?? []).filter((r) => V.costs[id].mp < V.costs[r].mp || (V.costs[id].points ?? 0) < (V.costs[r].points ?? 0)).map((r) => `${id} under ${r}`));
    laws.push({ law: 'costs-rise', ok: cheap.length === 0, value: cheap.join(', ') || 'rise' });
  }
  return laws;
}

const title = (s) => s.replace(/(^|-)([a-z])/g, (_, d, c) => (d ? ' ' : '') + c.toUpperCase());

/** The party RPG's words for it: the school a class, each technique a skill. */
export function lowerTree(T) {
  const V = readTree(T);
  if (!V.order || !V.costs) throw fail(` lowers once it is costed: it is at its ${!V.order ? 'premise' : 'order'} (intensifyTree)`);
  const D = depthsOf(V), el = elementHandles(V.element).rpg, skills = {}, entries = [];
  for (const t of V.techniques) {
    if (D[t.id] === undefined) throw fail(`.order.${t.id} cannot be reached (treeLaws says why): nothing to lower`);
    const K = DOES[t.does], d = D[t.id], sid = `${V.id}-${t.id}`, S = { ...K.skill };
    if (S.power) S.power = Math.round(S.power * (1 + DEPTH.power * d));
    if (K.elemental) S.element = el;
    if (K.status) S.status = { is: t.status, chance: Math.min(0.95, Math.round((0.6 + 0.1 * d) * 100) / 100), rounds: 3 };
    skills[sid] = { name: t.name ?? title(t.id), about: K.status ? `a foe may be put under ${t.status}` : K.reads.replace('the element', el), mp: V.costs[t.id].mp, ...S };
    const o = V.order[t.id];
    entries.push(o.at !== undefined ? { skill: sid, at: o.at } : { skill: sid, cost: V.costs[t.id].points ?? Math.max(1, d), ...(o.requires.length ? { requires: o.requires.map((r) => `${V.id}-${r}`) } : {}) });
  }
  return { classes: { [V.id]: { name: V.name ?? title(V.id), about: `a school of ${el}`, skills: entries } }, skills };
}
