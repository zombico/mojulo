/**
 * RESERVE — a pool of power: what it is, what empties it, how it comes back, and which of the runtime's own gauges
 * carries it. The second table of the lorecube's JOIN. The runtime has several gauges, each built for one job and none
 * knowing the others (an arsenal's MP, the vayo meter, the sprint's stamina, the guard's, the actions page's resource,
 * a party member's MP); a lore says ONE reserve ("an inner energy that drains as it is used"). This is the map between
 * them: nothing here changes a gauge, it says which gauge can carry which reserve, and what no gauge can.
 *
 *   SPENDS        what can empty a reserve, in the words a lore uses, each the runtime thing it is
 *   REFILLS       how it comes back      EMPTIES   what happens at none
 *   CARRIERS      the runtime's gauges as rows: the key that sets one, the module that runs it, what it can spend on,
 *                 how it refills, what empty does, whose it is (`scope`), its numbers and their range. A new gauge is
 *                 a row; a gauge that learns a new spend gains a word in its row
 *
 * MADE IN PASSES (passes.js), a reserve's ladder four rungs:
 *   premise    a name and what empties it: a raw-new pass's, and where it stops
 *   flow       how it refills and what happens at empty
 *   measured   its numbers: a cap, a start, a refill rate, a gain on a hit, a cost a spend
 *   carried    the gauge (or gauges) chosen to carry it
 *
 *   newReserve({ name, spent })              a RAW-NEW pass: the premise alone; more offered with it is refused, teaching
 *   intensifyReserve(R, { refill?, empty?, numbers?, carriers? }) → { reserve, open }
 *                                            an INTENSIFICATION: rungs added in order, the ones below never touched
 *   readReserve(v)                           a stored reserve at any depth: read, or throws, teaching
 *   RESERVE                                  the part (passes.js): for depthOf, openOf and checkPass
 *   carriersOf(R) → { carriers: [{ id, key, scope, carries: [spend], lacks: [words], fits }], uncarried: [{ spend, says }],
 *                     split?: says }
 *       each gauge against the reserve: the spends it carries, what of the reserve's flow it cannot do (`lacks`), and
 *       whether it carries it whole (`fits`); the spends NO gauge carries, each with the smallest change that would
 *       (`uncarried`); and, when its spends land on gauges that do not share a meter, `split`: one reserve in the lore,
 *       two bars on the screen
 *   reserveLaws(R) → [{ law, ok, value }]    spent (something empties it), returns (it refills, or says it never
 *                                            does), every-spend-carried, one-meter. Advice, as every law here
 *
 * Pure and deterministic. Nothing reads this yet: it lays no byte on any page.
 */
import { definePart } from './passes.js';

const fail = (m) => new Error(`lorecube: reserve${m}`);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const words = (o) => Object.keys(o).join(', ');

/** What can empty a reserve. */
export const SPENDS = Object.freeze({
  special: 'a special move of the weapon in hand (the modifier held, a face pressed)',
  move: 'a move that carries the body: a dash, an air dash, a jump on its own air',
  sustain: 'something held: a flight, a jetpack, a sprint',
  dodge: 'a dodge',
  guard: 'a blow met on the guard',
  power: 'a power fired by what happens (a cue)',
  skill: 'a party member\'s skill in a turn-based fight',
  imbue: 'poured into an ordinary attack: the same swing, landing harder or as an element',
});
/** How it comes back. */
export const REFILLS = Object.freeze({
  time: 'by itself, so much a second',
  hit: 'by landing a blow',
  rest: 'by resting: an inn, a camp',
  item: 'by an item',
  never: 'it does not: what is spent is gone',
});
/** What happens at none. */
export const EMPTIES = Object.freeze({
  refused: 'the press does nothing',
  ends: 'what was held lets go',
  winded: 'locked: nothing spends it again until it has recovered',
  break: 'the body is staggered open',
});

/** The runtime's gauges. `scope`: whose it is today (world: one a game, on every body that plays; hero: the one hero;
 *  member: each party member its own). `numbers`: what sets it, as the key says them. */
export const CARRIERS = Object.freeze({
  'arsenal-mp': {
    reads: 'the MP the specials draw on', key: 'arsenal.mp { max, regen, onHit }', lowers: 'lib/graph/gameworld/combos.js', runs: 'lib/graph/worlds/controllable/combat-melee.js',
    spends: ['special'], refills: ['time', 'hit'], empty: ['refused'], scope: 'world', meter: 'mp',
    numbers: { cap: 'max (1 to 1000)', regen: 'regen a second (0 to 100)', onHit: 'onHit a blow (0 to 100)', cost: 'a move\'s mp (0 to 200)' },
  },
  'vayo-meter': {
    reads: 'the meter the vayo moves fly on', key: 'a power\'s move (vayo-*), tuned by the feel card: rule.vayo { regen, dash.cost, flight.drain }', lowers: 'lib/graph/gameworld/feel/lower.js', runs: 'lib/graph/worlds/controllable/vayo-move.js',
    spends: ['move', 'sustain'], refills: ['time'], empty: ['refused', 'ends'], scope: 'hero', meter: 'vayo',
    numbers: { cap: 'always 1 (a share, 0 to 1)', regen: 'regen a second', cost: 'a dash\'s cost, a flight\'s drain a second' },
  },
  'sprint-stamina': {
    reads: 'the stamina a sprint and a dodge run on', key: 'feel: a card\'s stamina { seconds, refill, winded, dodge }', lowers: 'lib/graph/gameworld/feel/lower.js', runs: 'lib/graph/worlds/controllable/rules-platform.js',
    spends: ['sustain', 'dodge'], refills: ['time'], empty: ['winded'], scope: 'hero', meter: 'stamina',
    numbers: { cap: 'seconds of sprint', regen: 'refill, and a slower refill when winded', cost: 'a dodge\'s seconds of it' },
  },
  'guard-stamina': {
    reads: 'the stamina a guard holds blows with', key: 'feel: a card\'s guard.stamina { max, cost, regen, break }', lowers: 'lib/graph/gameworld/feel/lower.js', runs: 'lib/graph/worlds/controllable/combat-melee.js',
    spends: ['guard'], refills: ['time'], empty: ['break'], scope: 'hero', meter: 'guard',
    numbers: { cap: 'max', regen: 'regen', cost: 'cost a blow met' },
  },
  'stat-resource': {
    reads: 'the resource the hero\'s powers spend', key: 'characters.hero.actions.system.resource, numbered by mechanics.powers.<id>.spends', lowers: 'lib/graph/gameworld/mechanics.js', runs: 'lib/graph/playscape/stats/stats.js',
    spends: ['power'], refills: ['never'], empty: ['refused'], scope: 'hero', meter: 'resource',
    numbers: { cap: '100 x the scale\'s cost', cost: 'a power\'s spends (10 x the scale x its stage, or its own)' },
  },
  'party-mp': {
    reads: 'a party member\'s MP', key: 'play.rpg: a class\'s mp, a skill\'s mp', lowers: 'lib/graph/playscape/rpg/rpg.js', runs: 'lib/graph/playscape/rpg/kernel.js',
    spends: ['skill'], refills: ['rest', 'item'], empty: ['refused'], scope: 'member', meter: 'party-mp',
    numbers: { cap: 'the class\'s mp, grown a level', cost: 'a skill\'s mp' },
  },
});
export const CARRIER_IDS = Object.freeze(Object.keys(CARRIERS));

/** A spend no gauge carries: the smallest change that would let one. */
const UNCARRIED = Object.freeze({
  imbue: 'no gauge pours into an ordinary attack: the modifier only picks another move. The smallest change is in the melee runtime, where a strike\'s numbers are stamped: a moveset\'s imbue (an MP cost, and what it adds to the blow) read while the modifier is held; arsenal-mp then carries it',
});

const NUMBER_KEYS = ['cap', 'start', 'regen', 'onHit', 'costs'];
const KEYS = ['name', 'spent', 'refill', 'empty', 'numbers', 'carriers'];
const pos = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const nonneg = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const listOf = (v, table, at, what) => {
  if (!Array.isArray(v) || !v.length) throw fail(`${at} is a list of ${what}: ${words(table)}`);
  for (const w of v) if (!Object.prototype.hasOwnProperty.call(table, w)) throw fail(`${at} '${w}' is not ${what} (${words(table)})`);
  if (new Set(v).size !== v.length) throw fail(`${at} says one twice`);
  return [...v];
};

/** A stored reserve at any depth. */
export function readReserve(v) {
  if (!isObj(v)) throw fail(' is { name, spent, refill?, empty?, numbers?, carriers? }');
  for (const k of Object.keys(v)) if (!KEYS.includes(k)) throw fail(`.${k} is not part of a reserve (${KEYS.join(', ')})`);
  if (typeof v.name !== 'string' || !v.name.trim() || v.name.length > 40) throw fail('.name is what the lore calls it, in a word or two');
  const out = { name: v.name.trim(), spent: listOf(v.spent, SPENDS, '.spent', 'what empties it') };
  if (v.refill !== undefined) {
    out.refill = listOf(v.refill, REFILLS, '.refill', 'how it comes back');
    if (out.refill.includes('never') && out.refill.length > 1) throw fail('.refill is never, or the ways it comes back: not both');
  }
  if (v.empty !== undefined) out.empty = listOf(v.empty, EMPTIES, '.empty', 'what happens at none');
  if (v.numbers !== undefined) {
    const N = v.numbers;
    if (!isObj(N)) throw fail('.numbers is { cap, start?, regen?, onHit?, costs?: { <spend>: n } }');
    for (const k of Object.keys(N)) if (!NUMBER_KEYS.includes(k)) throw fail(`.numbers.${k} is not one of its numbers (${NUMBER_KEYS.join(', ')})`);
    if (!pos(N.cap)) throw fail('.numbers.cap is how much it holds, above 0');
    if (N.start !== undefined && !(nonneg(N.start) && N.start <= N.cap)) throw fail('.numbers.start is what it begins with, from 0 to its cap');
    for (const k of ['regen', 'onHit']) if (N[k] !== undefined && !nonneg(N[k])) throw fail(`.numbers.${k} is 0 or more`);
    if (N.costs !== undefined) {
      if (!isObj(N.costs)) throw fail('.numbers.costs is { <spend>: how much }');
      for (const [s, c] of Object.entries(N.costs)) {
        if (!out.spent.includes(s)) throw fail(`.numbers.costs.${s} is no spend of this reserve (${out.spent.join(', ')})`);
        if (!pos(c)) throw fail(`.numbers.costs.${s} is above 0`);
      }
    }
    out.numbers = { ...N, ...(N.costs ? { costs: { ...N.costs } } : {}) };
  }
  if (v.carriers !== undefined) out.carriers = listOf(v.carriers, CARRIERS, '.carriers', 'a gauge of the runtime');
  return out;
}

const premiseOf = (v) => (isObj(v) && typeof v.name === 'string' && Array.isArray(v.spent) ? { name: v.name, spent: v.spent } : null);
const reads = (v) => { try { return readReserve(v); } catch { return null; } };

/** A reserve as a part made in passes. */
export const RESERVE = definePart({
  id: 'reserve',
  rungs: [
    { id: 'premise', rawNew: true, holds: (v) => !!premiseOf(v) && !!reads(premiseOf(v)), view: premiseOf },
    { id: 'flow', holds: (v) => !!reads(v) && Array.isArray(v.refill) && Array.isArray(v.empty), open: (v) => ['refill', 'empty'].filter((k) => !Array.isArray(v?.[k])), view: (v) => ({ refill: v.refill, empty: v.empty }) },
    { id: 'measured', holds: (v) => isObj(v.numbers) && !!reads(v), open: (v) => (isObj(v?.numbers) ? [] : ['numbers']), view: (v) => v.numbers },
    { id: 'carried', holds: (v) => Array.isArray(v.carriers) && !!reads(v), open: (v) => (Array.isArray(v?.carriers) ? [] : ['carriers']), view: (v) => v.carriers },
  ],
});

/** A raw-new pass: a name and what empties it, and nothing under them. */
export function newReserve(v) {
  if (!isObj(v)) throw fail(' is made from { name, spent }');
  const more = Object.keys(v).filter((k) => KEYS.includes(k) && !['name', 'spent'].includes(k));
  if (more.length) throw fail(`.${more[0]} is not a raw-new pass's: it makes the premise (name, spent) and stops; ${more.join(', ')} ${more.length === 1 ? 'is' : 'are'} the next passes' (intensifyReserve)`);
  return readReserve(v);
}

const RUNG_KEYS = { flow: ['refill', 'empty'], measured: ['numbers'], carried: ['carriers'] };

/** An intensification: the next rungs laid on, in order; what was there is never touched. */
export function intensifyReserve(R, add = {}) {
  const base = readReserve(R);
  if (!isObj(add)) throw fail(' is intensified with { refill?, empty?, numbers?, carriers? }');
  for (const k of Object.keys(add)) {
    if (['name', 'spent'].includes(k)) throw fail(`.${k} is its premise: an intensification adds under it and never changes it`);
    if (!KEYS.includes(k)) throw fail(`.${k} is not part of a reserve (${KEYS.join(', ')})`);
    if (base[k] !== undefined) throw fail(`.${k} is already said: an intensification adds the rungs that are missing and changes none`);
  }
  const reserve = readReserve({ ...base, ...add });
  // rungs are added in order: a number under no flow, or a gauge under no numbers, stands on nothing
  const order = ['flow', 'measured', 'carried'], held = order.map((r) => RUNG_KEYS[r].every((k) => reserve[k] !== undefined));
  const gap = held.findIndex((h, i) => !h && held.slice(i + 1).some(Boolean));
  if (gap >= 0) throw fail(`: its ${order[held.lastIndexOf(true)]} is said before its ${order[gap]} (${RUNG_KEYS[order[gap]].filter((k) => reserve[k] === undefined).join(', ')}): the rungs go in order`);
  const next = order[held.indexOf(false)];
  return { reserve, open: next ? RUNG_KEYS[next].filter((k) => reserve[k] === undefined) : [] };
}

/** Each gauge against the reserve, and what no gauge carries. */
export function carriersOf(R) {
  const V = readReserve(R);
  const carriers = CARRIER_IDS.map((id) => {
    const C = CARRIERS[id], carries = V.spent.filter((s) => C.spends.includes(s)), lacks = [];
    for (const r of V.refill ?? []) if (!C.refills.includes(r)) lacks.push(`refill ${r}`);
    for (const e of V.empty ?? []) if (!C.empty.includes(e)) lacks.push(`empty ${e}`);
    return { id, key: C.key, scope: C.scope, carries, lacks, fits: carries.length === V.spent.length && !lacks.length };
  }).filter((c) => c.carries.length).sort((a, b) => Number(b.fits) - Number(a.fits) || b.carries.length - a.carries.length || a.lacks.length - b.lacks.length || CARRIER_IDS.indexOf(a.id) - CARRIER_IDS.indexOf(b.id));
  const carried = new Set(carriers.flatMap((c) => c.carries));
  const uncarried = V.spent.filter((s) => !carried.has(s)).map((spend) => ({ spend, says: UNCARRIED[spend] ?? `no gauge of the runtime spends on ${spend} (${SPENDS[spend]})` }));
  // the fewest gauges that cover what can be carried: one meter, or a reserve split across bars
  const need = V.spent.filter((s) => carried.has(s));
  const one = carriers.find((c) => need.every((s) => c.carries.includes(s)));
  const meters = one ? [one.id] : [...new Set(need.map((s) => carriers.find((c) => c.carries.includes(s)).id))];
  return {
    carriers, uncarried,
    ...(meters.length > 1 ? { split: `one reserve in the lore, ${meters.length} gauges on the runtime that share no meter (${meters.join(', ')}): each fills and empties by itself` } : {}),
  };
}

/** The laws a reserve is held to: advice, never a refusal. */
export function reserveLaws(R) {
  const V = readReserve(R), C = carriersOf(V);
  return [
    { law: 'spent', ok: V.spent.length > 0, value: V.spent.length },
    { law: 'returns', ok: V.refill === undefined || V.refill.length > 0, value: V.refill ? V.refill.join(', ') : 'not said yet' },
    { law: 'every-spend-carried', ok: C.uncarried.length === 0, value: C.uncarried.map((u) => u.spend).join(', ') || 'all' },
    { law: 'one-meter', ok: !C.split, value: C.split ?? 'one' },
  ];
}
