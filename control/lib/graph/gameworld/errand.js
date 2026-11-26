/**
 * THE ERRAND in a world (a design_game world's `errands`): sent out across a map world with a list, home to its giver with
 * the goods. The list is a tree: an item may stand on others (`needs`: spent where it is had), and each is had in its
 * level by a trade (a source or a shop), or as a bounty's proof (`from: { foe }`: a foe's fall). Its cargo has a state
 * (fragile, perishable: game/errand-mechanics.js `cargo`), carried in the bag from level to level. The giver's level takes
 * it (`deliver`) and pays the `reward`.
 *
 *   errands: [{ id, giver: '<level>', reward?: [{ item, n? }],
 *     list: [{ item, at: '<level>', count?: 1, min?, needs?: ['<item>'], from?: { foe: '<bestiary id>' }, shop?: '<store card>',
 *              cargo?: { fragile?: true, perishable?: <seconds a unit> } }] }]
 *   app      the phone APP that gives it (one word: taskfu), in place of a person: the player subscribes to the app on
 *            the phone and takes its tasks there; each is a quest with its reward, paid where it ends. No one is met
 *   tags     what kind of task it is (words: ride, food, courier). A game may have SEVERAL apps (`ui.phone.apps`,
 *            gameworld/phone-ui.js), each listing the tags it carries: a tagged task is offered by every app that
 *            lists one of its tags (and by its own `app`, when it names one); by TaskFu when none does
 *   contact  who gives it (one word; unsaid, the level's one contact): the jobs of one contact share a giver, who is met
 *            once for the first and is on the PHONE after: the next is offered by a call when the one before is done
 *   offer    what its giver says as the job is taken (where a level stands its givers: a town's, a district's)
 *   repeat   true: a STANDING job (a fare, a round of deliveries). Its hand-in pays each time and never ends the level;
 *            what it asks for is had again once the bag holds none of it, as any trade restocks
 *   needs    the list's items spent where this one is had, each its whole `count` (3 coin for the eggs)
 *   min      how much must reach the giver (the count, by default): a fragile cargo's margin is count − min
 *   from     a bounty: the item is the proof the foe's fall drops; its level must field that foe (`foes`)
 *   shop     the kind of store it is had in (a seeded store card's id): where its level's town has such a shop walked
 *            into (the geotown's `shops`), the trade stands at its till; else on a spot, as any trade
 *   what the giver asks for is the list's roots: the items nothing on the list needs
 *   name     what it is called in the journal and as it starts (a mission's title)
 *   vehicle  a SHIFT (gameworld/jobsified.js SHIFTS: garbage, bus): a driving job done in one of the city's vehicles,
 *            given by the Jobsified app unless it names its own. Taken on the phone, the hero gets into one at the depot
 *            that keeps it, drives its stops in it and brings it back there to be paid. Its list may be left out: one
 *            item, the row's (bins), at the giver's level, its `count` the round's stops (the row's by default); a list
 *            given is that one item. No contact, no mission, no needs, no shop
 *   mission  a STORY MISSION (game/mission-mechanics.js): the job told as one, with ways to fail.
 *            { heat?: 1 to 5, clean?: true, time?: seconds, final?: true }
 *              heat   the stars the law gives the player as the goods are had (an alarm, a witness: law.js)
 *              clean  handed in only with no stars: lose the police first
 *              time   seconds from taking it to handing it in
 *              final  its hand-in ends the level, the game won (the story's last): the rest keep the level open
 *            Wasted or busted while it is on, or out of time, it fails: MISSION FAILED, and a few seconds after it
 *            starts again (the goods kept). A mission is never a standing job
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
 *   layErrand(legs, spots, tills?) → the legs with a place each (`spots`: free beats, in order; a trade had in a shop at
 *                                   the till of a store of its kind, `tills`: [{ id, card, at }], where the stage has
 *                                   one walked into), and the bag
 *   TILL_REACH                    how near a till a trade is made (m)
 *
 * Pure, no dice.
 */
import { readLevelFoes } from './foes.js';
import { resolveCard } from '../retail/store-cards.js';
import { SHIFTS, JOBSIFIED } from './jobsified.js';

export const ERRAND_LAWS = Object.freeze({
  solvable: 'Solvable: from the start, each leg is reached with what it needs in the bag, and the giver after the last.',
  varied: 'Varied: no two legs in a row in the same level; an errand crosses the world.',
  survivable: 'Survivable: a fragile or perishable cargo carries a margin to lose on the way.',
});
const KEYS = ['id', 'giver', 'reward', 'list', 'repeat', 'offer', 'contact', 'app', 'tags', 'mission', 'name', 'vehicle'];
const MISSION_KEYS = ['heat', 'clean', 'time', 'final'];
export const TILL_REACH = 1.6;
const NODE_KEYS = ['item', 'at', 'count', 'min', 'needs', 'from', 'cargo', 'shop'];
const WORD = /^[a-z][a-z0-9-]{0,31}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const posInt = (v) => Number.isInteger(v) && v >= 1;

function readOne(E, k, G) {
  const at = `errands[${k}]`, no = (m) => { throw new Error(`gameworld: ${at}${m}`); };
  if (!isObj(E)) no(' is { id, giver, reward?, list: [{ item, at, … }] }');
  for (const key of Object.keys(E)) if (!KEYS.includes(key)) no(`.${key} is not an errand setting (${KEYS.join(', ')})`);
  if (typeof E.id !== 'string' || !WORD.test(E.id)) no('.id is the errand\'s name, lower-case');
  if (!G.levels[E.giver]) no(`.giver is the level the goods are brought to (levels: ${G.ids.join(', ')})`);
  if (E.repeat !== undefined && E.repeat !== true) no('.repeat is true: a standing job, paid each time it is done and never ending its level');
  if (E.offer !== undefined && !(typeof E.offer === 'string' && E.offer.trim() && E.offer.length <= 160)) no('.offer is what its giver says when the job is taken, in words');
  if (E.contact !== undefined && (typeof E.contact !== 'string' || !WORD.test(E.contact))) no('.contact is who gives it, one lower-case word (fixer, dispatch): jobs of one contact share a giver, met once and on the phone after');
  if (E.app !== undefined && (typeof E.app !== 'string' || !WORD.test(E.app))) no('.app is the phone app that gives it, one lower-case word (taskfu): a task taken on the phone, with no one to meet');
  if (E.tags !== undefined && (!Array.isArray(E.tags) || !E.tags.length || E.tags.some((t) => typeof t !== 'string' || !WORD.test(t)) || new Set(E.tags).size !== E.tags.length)) no('.tags is what kind of task it is, lower-case words, each once ([\'ride\'], [\'food\', \'rush\']): every phone app that lists one of them offers it');
  if (E.tags !== undefined && E.contact !== undefined) no(' has tags, so an app gives it: it has no contact');
  if (E.app !== undefined && E.contact !== undefined) no(' is given by a contact or by an app, not both');
  if (E.name !== undefined && !(typeof E.name === 'string' && E.name.trim() && E.name.length <= 60)) no('.name is what it is called, in a few words');
  const M = E.mission;
  if (M !== undefined) {
    if (!isObj(M)) no(`.mission is { ${MISSION_KEYS.join(', ')} }: the job told as a story mission`);
    for (const k of Object.keys(M)) if (!MISSION_KEYS.includes(k)) no(`.mission.${k} is not part of a mission (${MISSION_KEYS.join(', ')})`);
    if (M.heat !== undefined && !(Number.isInteger(M.heat) && M.heat >= 1 && M.heat <= 5)) no('.mission.heat is the stars the goods bring, 1 to 5');
    if (M.time !== undefined && !(Number.isFinite(M.time) && M.time >= 10 && M.time <= 3600)) no('.mission.time is the seconds it has, 10 to 3600');
    for (const k of ['clean', 'final']) if (M[k] !== undefined && M[k] !== true) no(`.mission.${k} is true`);
    if (E.repeat) no(' is a standing job (repeat) and a mission: a mission is done once');
  }
  // (a SHIFT, jobsified.js: driven in a city vehicle, from its depot and back; its list the round's one item, its stops)
  const V = E.vehicle === undefined ? null : SHIFTS[E.vehicle];
  if (E.vehicle !== undefined) {
    if (!V) no(`.vehicle is the city vehicle a driving job is done in (${Object.keys(SHIFTS).join(', ')}): a shift from its depot and back`);
    if (E.contact !== undefined) no(' is a shift: an app gives it (Jobsified), no contact');
    if (M !== undefined) no(' is a shift and a mission: a shift is driven, not told');
    if (E.list === undefined) E = { ...E, list: [{ item: V.item, at: E.giver, count: V.stops }] };
    if (!Array.isArray(E.list) || E.list.length !== 1) no('.list is a shift\'s one item, its round: [{ item, at, count }] (count: its stops)');
    const N = E.list[0];
    if (isObj(N) && N.at !== E.giver) no('.list[0].at is the giver\'s level: a shift is driven from its depot and back');
    if (isObj(N) && (N.needs !== undefined || N.from !== undefined || N.shop !== undefined || N.cargo !== undefined || N.min !== undefined)) no('.list[0] is a shift\'s round: { item, at, count } (count its stops), no needs, bounty, shop, cargo or min');
    if (isObj(N) && N.count === undefined) E = { ...E, list: [{ ...N, count: V.stops }] };
  }
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
    // (had over a shop's counter: the kind of store, a seeded store card's; a bounty is had by a fall, at no counter)
    if (N.shop !== undefined && (typeof N.shop !== 'string' || !resolveCard(N.shop))) no(`${w}.shop is the kind of store it is had in, a seeded store card's id (pharmacy, convenience, diner)`);
    if (N.shop !== undefined && N.from !== undefined) no(`${w}: a bounty is had by a fall, at no shop's counter`);
    return { item: N.item, at: N.at, count, min, needs: [...(N.needs ?? [])], ...(N.from ? { from: { foe: N.from.foe } } : {}), ...(N.cargo ? { cargo: { ...N.cargo } } : {}), ...(N.shop !== undefined ? { shop: N.shop } : {}) };
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
  const read = { id: E.id, giver: E.giver, reward: reward.map((r) => ({ item: r.item, n: r.n ?? 1 })), list, roots, order, ...(E.name ? { name: E.name.trim() } : {}), ...(M ? { mission: { ...M } } : {}), ...(E.repeat ? { repeat: true } : {}), ...(E.offer ? { offer: E.offer.trim() } : {}), ...(E.contact ? { contact: E.contact } : {}), ...(E.app ? { app: E.app } : V ? { app: JOBSIFIED } : {}), ...(E.tags ? { tags: E.tags.slice() } : {}), ...(V ? { vehicle: E.vehicle } : {}) };
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
  // (a level with a standing job is OPEN: no job done in it ends it, a one-off's hand-in pays and the level goes on)
  // (and one with a story's missions, the last of them aside: its hand-in ends the level, the game won)
  const open = errands.some((E) => (E.repeat || (E.mission && !E.mission.final)) && E.giver === level);
  for (const E of errands) {
    // (a SHIFT, jobsified.js: one leg, its round driven from its depot and back, laid where the level lays it)
    if (E.vehicle) {
      if (E.giver === level) legs.push({ kind: 'shift', id: E.id, vehicle: E.vehicle, item: E.list[0].item, stops: E.list[0].count, ...(E.reward.length ? { reward: E.reward } : {}), ...(E.repeat ? { repeat: true } : {}), ...(E.name ? { name: E.name } : {}), ...(E.app ? { app: E.app } : {}), ...(E.tags ? { tags: E.tags } : {}) });
      continue;
    }
    const count = (item) => E.list.find((x) => x.item === item).count;
    for (const N of E.list) {
      if (N.at !== level) continue;
      legs.push(N.from
        ? { kind: 'bounty', item: N.item, who: `foe-${N.from.foe}-*`, n: N.count }
        : { kind: 'trade', job: E.id, item: N.item, count: N.count, ...(N.needs.length ? { needs: N.needs.map((n) => ({ item: n, n: count(n) })) } : {}), ...(N.shop ? { shop: N.shop } : {}) });
    }
    if (E.giver === level) legs.push({ kind: 'deliver', id: E.id, wants: E.roots.map((r) => ({ item: r, min: E.list.find((x) => x.item === r).min })), ...(E.reward.length ? { reward: E.reward } : {}), ...(E.repeat ? { repeat: true } : open && !E.mission?.final ? { open: true } : {}), ...(E.mission?.clean ? { clean: true } : {}), ...(E.offer ? { offer: E.offer } : {}), ...(E.contact ? { contact: E.contact } : {}), ...(E.app ? { app: E.app } : {}), ...(E.tags ? { tags: E.tags } : {}) });
  }
  for (const E of errands) for (const N of E.list) if (N.cargo) legs.push({ kind: 'cargo', item: N.item, ...N.cargo, max: N.count });
  return legs;
}

/** The legs placed: a trade and the hand-in each on a spot of its own (a free beat, in order); a bounty and a cargo stand
 * nowhere. With any, the bag (the store keeps what moves). */
export function layErrand(legs, spots, tills = []) {
  if (!legs.length) return [];
  // (a trade had in a shop stands at the till of a store of its kind the stage has walked into, each till once; with
  // none, on a spot like any other: the shop is its dress, the trade the same)
  const free = tills.map((t) => ({ ...t })), tillOf = (l) => { const k = l.shop ? free.findIndex((t) => t.card === l.shop && !t.taken) : -1; if (k < 0) return null; free[k].taken = true; return free[k]; };
  const stood = legs.map((l) => (l.kind === 'trade' ? tillOf(l) : null));
  const placed = legs.filter((l, i) => (l.kind === 'trade' || l.kind === 'deliver') && !stood[i]);
  if (placed.length > spots.length) throw new Error(`levels: an errand lays ${placed.length} places on a stage with room for ${spots.length}: spread its legs over more levels`);
  let j = 0;
  return [{ kind: 'bag', slice: 'bag' }, ...legs.map(({ shop, ...l }, i) => (stood[i] ? { ...l, at: stood[i].at.slice(), radius: TILL_REACH, till: stood[i].id } : l.kind === 'trade' || l.kind === 'deliver' ? { ...l, at: spots[j++].slice() } : l))];
}
