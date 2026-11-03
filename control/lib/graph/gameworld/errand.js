/**
 * THE ERRAND in a world (a design_game world's `errands`): sent out across a map world with a list, home to its giver with
 * the goods. The list is a tree: an item may stand on others (`needs`: spent where it is had), and each is had in its
 * level by a trade (a source or a shop), or as a bounty's proof (`from: { foe }`: a foe's fall). Its cargo has a state
 * (fragile, perishable: game/errand-mechanics.js `cargo`), carried in the bag from level to level. The giver's level takes
 * it (`deliver`) and pays the `reward`.
 *
 *   errands: [{ id, giver: '<level>', reward?: [{ item, n? }],
 *     list: [{ item, at: '<level>', count?: 1, min?, needs?: ['<item>'], from?: { foe: '<bestiary id>' },
 *              cargo?: { fragile?: true, perishable?: <seconds a unit> } }] }]
 *   needs    the list's items spent where this one is had, each its whole `count` (3 coin for the eggs)
 *   min      how much must reach the giver (the count, by default): a fragile cargo's margin is count − min
 *   from     a bounty: the item is the proof the foe's fall drops; its level must field that foe (`foes`)
 *   what the giver asks for is the list's roots: the items nothing on the list needs
 *
 * Refused (malformed): an unknown key, level or item; an item twice; a need on no list; a cycle; a bounty whose level
 * fields no such foe; a world that is not a map (`topology: 'interconnected'`), since an errand goes out and comes back.
 * Advised (laws, never refusing), each { law, holds, says }:
 *   solvable    an order exists from the world's start: each leg's level reached (through the links, a keyed link once its
 *               key is held) with its needs in the bag, and the giver reached at the end
 *   varied      no two legs in a row in the same level: the errand crosses the world, it is not one shop's shelf
 *   survivable  a fragile or perishable cargo carries a margin (count above min) to lose on the way
 *
 *   ERRAND_LAWS
 *   readErrands(spec, G)          → [{ id, giver, reward, list, roots, order, laws }]   G: the world read so far (its
 *                                   levels, ids, links, start, topology, foes)
 *   errandLegs(errands, level)    → the mechanics a level's last stage lays for them, without places yet:
 *                                   [{ kind: 'trade' | 'bounty' | 'deliver', … }], plus each cargo (on every level)
 *   layErrand(legs, spots)        → the legs with a place each (`spots`: free beats, in order), and the bag
 *
 * Pure, no dice.
 */
import { readLevelFoes } from './foes.js';

export const ERRAND_LAWS = Object.freeze({
  solvable: 'Solvable: from the start, each leg is reached with what it needs in the bag, and the giver after the last.',
  varied: 'Varied: no two legs in a row in the same level; an errand crosses the world.',
  survivable: 'Survivable: a fragile or perishable cargo carries a margin to lose on the way.',
});
const KEYS = ['id', 'giver', 'reward', 'list'];
const NODE_KEYS = ['item', 'at', 'count', 'min', 'needs', 'from', 'cargo'];
const WORD = /^[a-z][a-z0-9-]{0,31}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const posInt = (v) => Number.isInteger(v) && v >= 1;

function readOne(E, k, G) {
  const at = `errands[${k}]`, no = (m) => { throw new Error(`gameworld: ${at}${m}`); };
  if (!isObj(E)) no(' is { id, giver, reward?, list: [{ item, at, … }] }');
  for (const key of Object.keys(E)) if (!KEYS.includes(key)) no(`.${key} is not an errand setting (${KEYS.join(', ')})`);
  if (typeof E.id !== 'string' || !WORD.test(E.id)) no('.id is the errand\'s name, lower-case');
  if (!G.levels[E.giver]) no(`.giver is the level the goods are brought to (levels: ${G.ids.join(', ')})`);
  const reward = E.reward ?? [];
  if (!Array.isArray(reward) || reward.some((r) => !isObj(r) || typeof r.item !== 'string' || !WORD.test(r.item) || (r.n !== undefined && !posInt(r.n)))) no('.reward is [{ item, n? }]: what the giver pays');
  if (!Array.isArray(E.list) || !E.list.length) no('.list is [{ item, at, … }], at least one: what is fetched');
  const list = E.list.map((N, i) => {
    const w = `.list[${i}]`;
    if (!isObj(N)) no(`${w} is { item, at, count?, min?, needs?, from?, cargo? }`);
    for (const key of Object.keys(N)) if (!NODE_KEYS.includes(key)) no(`${w}.${key} is not a leg setting (${NODE_KEYS.join(', ')})`);
    if (typeof N.item !== 'string' || !WORD.test(N.item)) no(`${w}.item is one lower-case word (eggs, coin, pelt)`);
    if (!G.levels[N.at]) no(`${w}.at is the level it is had in (levels: ${G.ids.join(', ')})`);
    const count = N.count ?? 1;
    if (!posInt(count)) no(`${w}.count is how many are had, from 1`);
    const min = N.min ?? count;
    if (!posInt(min) || min > count) no(`${w}.min is how many must reach the giver, 1 to its count (${count})`);
    if (N.needs !== undefined && !(Array.isArray(N.needs) && N.needs.every((x) => typeof x === 'string'))) no(`${w}.needs is the items it is had for: ['coin']`);
    if (N.from !== undefined) {
      if (!isObj(N.from) || Object.keys(N.from).join() !== 'foe' || typeof N.from.foe !== 'string') no(`${w}.from is { foe: '<bestiary id>' }: a bounty, the proof its fall drops`);
      const LF = G.levels[N.at].foes;
      const fielded = LF === undefined ? [] : readLevelFoes(LF, G.foes, `levels.${N.at}`).from;
      if (!fielded.includes(N.from.foe)) no(`${w}.from: level '${N.at}' fields no '${N.from.foe}' (its foes: ${fielded.join(', ') || 'none'})`);
      if (N.needs?.length) no(`${w}: a bounty is had by a fall, not bought: no needs`);
    }
    if (N.cargo !== undefined) {
      const C = N.cargo;
      if (!isObj(C) || Object.keys(C).some((x) => !['fragile', 'perishable'].includes(x)) || (C.fragile !== undefined && C.fragile !== true) || (C.perishable !== undefined && !(Number.isFinite(C.perishable) && C.perishable > 0)) || (!C.fragile && !C.perishable)) no(`${w}.cargo is { fragile?: true, perishable?: <seconds a unit> }, one at least`);
    }
    return { item: N.item, at: N.at, count, min, needs: [...(N.needs ?? [])], ...(N.from ? { from: { foe: N.from.foe } } : {}), ...(N.cargo ? { cargo: { ...N.cargo } } : {}) };
  });
  const by = new Map();
  for (const N of list) { if (by.has(N.item)) no(`: '${N.item}' is on the list twice`); by.set(N.item, N); }
  for (const N of list) for (const n of N.needs) { if (!by.has(n)) no(`: '${N.item}' needs '${n}', which is on no list`); if (n === N.item) no(`: '${N.item}' needs itself`); }
  // the tree's order (needs before what needs them), refusing a cycle
  const order = [], state = new Map();
  const visit = (item, path) => {
    if (state.get(item) === 2) return;
    if (state.get(item) === 1) no(`: the needs go round (${[...path, item].join(' → ')})`);
    state.set(item, 1);
    for (const n of by.get(item).needs) visit(n, [...path, item]);
    state.set(item, 2); order.push(item);
  };
  for (const N of list) visit(N.item, []);
  const needed = new Set(list.flatMap((N) => N.needs));
  const roots = list.filter((N) => !needed.has(N.item)).map((N) => N.item);
  const read = { id: E.id, giver: E.giver, reward: reward.map((r) => ({ item: r.item, n: r.n ?? 1 })), list, roots, order };
  read.laws = errandLaws(read, G);
  return read;
}

/** The errands read and checked, each with its order and its laws. */
export function readErrands(spec, G) {
  if (spec === undefined || spec === null) return null;
  if (G.topology !== 'interconnected') throw new Error("gameworld: errands go out and come back: a map world's (topology: 'interconnected')");
  if (!Array.isArray(spec) || !spec.length) throw new Error('gameworld: errands is [{ id, giver, reward?, list }], at least one');
  const out = spec.map((E, k) => readOne(E, k, G));
  const ids = new Set();
  for (const E of out) { if (ids.has(E.id)) throw new Error(`gameworld: errands: '${E.id}' names two errands`); ids.add(E.id); }
  // one item, one place: a world's errands share the bag
  const where = new Map();
  for (const E of out) for (const N of E.list) { if (where.has(N.item)) throw new Error(`gameworld: errands: '${N.item}' is fetched by '${where.get(N.item)}' and '${E.id}': one item, one errand (the bag is shared)`); where.set(N.item, E.id); }
  return out;
}

const law = (id, holds, says) => ({ law: id, holds, says });

// the levels reached from the start with what the bag holds (a keyed link once its key is held; back always open)
function reached(G, held) {
  const seen = new Set([G.start]), queue = [G.start];
  while (queue.length) {
    const at = queue.shift();
    for (const l of G.links) {
      const next = l.from === at && (!l.key || held.has(l.key)) ? l.to : l.to === at ? l.from : null;
      if (next && !seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return seen;
}

function errandLaws(E, G) {
  const out = [];
  // solvable: the legs had in order as soon as reachable with their needs held; keys found along the way open links
  const held = new Set(), got = [], left = [...E.order];
  const keysAt = G.links.filter((l) => l.key && l.keyAt);
  for (let grew = true; grew && left.length;) {
    grew = false;
    const R = reached(G, held);
    for (const k of keysAt) if (R.has(k.keyAt) && !held.has(k.key)) { held.add(k.key); grew = true; }
    for (const item of [...left]) {
      const N = E.list.find((x) => x.item === item);
      if (R.has(N.at) && N.needs.every((n) => got.includes(n))) { got.push(item); held.add(item); left.splice(left.indexOf(item), 1); grew = true; }
    }
  }
  const home = reached(G, held).has(E.giver);
  out.push(law('solvable', !left.length && home, left.length ? `${left.join(', ')} cannot be had from the start (a level out of reach, or a need never met)` : !home ? `the giver's level '${E.giver}' is out of reach with the goods` : `${got.join(' → ')} → ${E.giver}`));
  // varied: consecutive legs in different levels
  const legs = got.map((item) => E.list.find((x) => x.item === item).at), same = legs.slice(1).flatMap((lv, i) => (lv === legs[i] ? [`${got[i]} and ${got[i + 1]} both in '${lv}'`] : []));
  out.push(law('varied', !same.length, same.length ? `${same.join('; ')}: one shelf, not a crossing` : 'every leg in another level than the last'));
  // survivable: a cargo carries a margin
  const tight = E.list.filter((N) => N.cargo && N.count - N.min < 1).map((N) => `${N.item} (${N.count}, ${N.min} asked)`);
  out.push(law('survivable', !tight.length, tight.length ? `${tight.join('; ')}: a fragile or perishable cargo with nothing to lose` : E.list.some((N) => N.cargo) ? 'every cargo carries a margin' : 'no cargo to keep whole'));
  return out;
}

/** What a level's last stage lays for the world's errands: its legs (trades, bounties), the giver's hand-in, and every
 * cargo (on every level: it is inert while none is carried). Places come later (layErrand). */
export function errandLegs(errands, level) {
  if (!errands?.length) return [];
  const legs = [];
  for (const E of errands) {
    const count = (item) => E.list.find((x) => x.item === item).count;
    for (const N of E.list) {
      if (N.at !== level) continue;
      legs.push(N.from
        ? { kind: 'bounty', item: N.item, who: `foe-${N.from.foe}-*`, n: N.count }
        : { kind: 'trade', item: N.item, count: N.count, ...(N.needs.length ? { needs: N.needs.map((n) => ({ item: n, n: count(n) })) } : {}) });
    }
    if (E.giver === level) legs.push({ kind: 'deliver', id: E.id, wants: E.roots.map((r) => ({ item: r, min: E.list.find((x) => x.item === r).min })), ...(E.reward.length ? { reward: E.reward } : {}) });
  }
  for (const E of errands) for (const N of E.list) if (N.cargo) legs.push({ kind: 'cargo', item: N.item, ...N.cargo, max: N.count });
  return legs;
}

/** The legs placed: a trade and the hand-in each on a spot of its own (a free beat, in order); a bounty and a cargo stand
 * nowhere. With any, the bag (the store keeps what moves). */
export function layErrand(legs, spots) {
  if (!legs.length) return [];
  const placed = legs.filter((l) => l.kind === 'trade' || l.kind === 'deliver');
  if (placed.length > spots.length) throw new Error(`levels: an errand lays ${placed.length} places on a stage with room for ${spots.length}: spread its legs over more levels`);
  let j = 0;
  return [{ kind: 'bag', slice: 'bag' }, ...legs.map((l) => (l.kind === 'trade' || l.kind === 'deliver' ? { ...l, at: spots[j++].slice() } : l))];
}
