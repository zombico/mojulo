/**
 * THE WORK MECHANIC — a Shovels & Buckets card (worksim/card.js) played on a level: its stations, its crates, its
 * hand-in and its orders laid where the walker works them, lowered onto the bus's verbs alone (no runtime of its own).
 *
 *   crate      a raw item's source: E takes one into the bag, while the hands have room (bucket work)
 *   station    each slot of each station (a hob, a board, a field): E with its takes in the bag starts it; the work is
 *              done by STANDING there, a quarter second a tick (walk off and it pauses, its progress kept: come back
 *              and E resumes it, the degree of done the worker left it at); a station with a wait then runs alone, and
 *              what it made keeps its hold on the station before it burns; E takes it off. A station with no wait puts
 *              what it made in the hands, or leaves it on the station when they are full. A shovel and a bucket lower the
 *              same: the verb is what the work is, said in its prompt and its colour
 *   orders     the card's demand, rolled once (worksim/sim.js arrivalsOf: the orders the solver measured), each into its
 *              ticket slot at the hand-in (given when rolled; turned away if that slot still holds one), waiting its
 *              patience before it walks out; E at the hand-in serves one ticket whose wants are all in the bag
 *   shelf      a made item a station takes, or one the card stores, has a shelf (its `store`, else 4) with two pads: E on
 *              one puts one down while the shelf has room, E on the other takes one (bucket work: sorting to storage). The hands are the only other place a thing
 *              can be, so a full pair of hands with the rice about to burn is solved at a shelf
 *   the bell   at the session's end: served at least `goal` wins, else it is lost
 *
 *   { kind: 'work', card?: <a card> | '<a starter id>' (kitchen), at?: [x, y, z] (the origin it is laid around: the
 *     spawn) | { origin?, stations?: { <id>: [x,y,z] | [[x,y,z] a slot] }, crates?: { <item>: [x,y,z] }, shelves?: { <item>: [x,y,z] }, serve?: [x,y,z] },
 *     heading?: radians, hands?: how many units the bag holds (the most any one step puts in or asks of it), goal?: orders
 *     to serve by the bell (four fifths of what the simulator's one player serves), seed? (1): the roll of its orders,
 *     tickets?: ticket slots at the hand-in }
 *
 * Said on the bus: work:took, work:made, work:ready, work:burned, work:served, work:walked, work:full, work:won,
 * work:lost (the rest `__w<i>:` and the use zones `use-w<i>-…`). Vars: `w<i>:served`, `w<i>:missed`, `w<i>:burned`,
 * `w<i>:score`, `w<i>:carry`, `w<i>:left` (seconds), the bag's `held:bag:<item>` (playscape/ui/items.js).
 *
 *   lowerWork(params, ctx)       (game/mechanics.js registers it)
 *   layWork(card, origin, heading?) → { stations, crates, serve }: the default floor plan, a line kitchen
 *
 * Pure, no dice (the orders are rolled by the card's seed before the bus sees them).
 */
import { readCard, isRaw } from '../worksim/card.js';
import { arrivalsOf, simulate, TPS } from '../worksim/sim.js';
import { SCENARIOS } from '../worksim/scenarios.js';
import { lowerMove, heldVar, NOWHERE } from '../playscape/ui/items.js';

const BAG = 'bag';
const STEP = 1 / TPS;
const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const posInt = (v) => Number.isInteger(v) && v >= 1;
const words = (k) => k.replace(/-/g, ' ');
const r3 = (v) => Math.round(v * 1000) / 1000;
// a card's seconds of `far` laid as metres at a walk
const WALK = 2.5;
// what a shelf holds when the card stores no number for its item
const SHELF = 4;
const COLOR = { shovel: '#5b84b1', bucket: '#8fb15b', crate: '#b07a3a', shelf: '#8a8170', serve: '#d9d2c3', busy: '#f0a020', ready: '#5fd35f' };
const TICKETS = ['#e05a5a', '#5a9be0', '#e0c25a', '#a05ae0', '#5ae0b4', '#e07f5a'];

// one guard after another (the bus's `if` takes one predicate): `on` → … → `ok` when every guard holds; the first that
// fails emits `no` (at most one: a later guard is asked only when the earlier held)
function chain(reactions, on, guards, ok, no) {
  if (!guards.length) { reactions.push({ on, do: 'emit', type: ok }); return; }
  guards.forEach((g, k) => {
    const src = k ? `${ok}:${k}` : on, dst = k === guards.length - 1 ? ok : `${ok}:${k + 1}`;
    reactions.push({ on: src, if: g, do: 'emit', type: dst });
    if (no) reactions.push({ on: src, if: { var: g.var, lt: g.gte }, do: 'emit', type: no });
  });
}

/** A shelf's two pads, put and take, either side of it along the line. */
export function shelfPads(at, heading = 0) {
  const c = Math.cos(heading), s = Math.sin(heading);
  return [[r3(at[0] - 0.65 * c), r3(at[1] - 0.65 * s), at[2]], [r3(at[0] + 0.65 * c), r3(at[1] + 0.65 * s), at[2]]];
}

/** The default floor plan: crates along the back, the stations in a line (each slot its own place), the hand-in in front. */
export function layWork(card, origin = [0, 0, 0], heading = 0) {
  const C = card.producer ? card : readCard(card);
  const c = Math.cos(heading), s = Math.sin(heading);
  const at = (x, y) => [r3(origin[0] + x * c - y * s), r3(origin[1] + x * s + y * c), origin[2]];
  const near = Object.entries(C.stations).filter(([, st]) => !st.far), far = Object.entries(C.stations).filter(([, st]) => st.far);
  const row = (list, y) => {
    const n = list.reduce((t, [, st]) => t + st.slots, 0), out = {};
    let k = 0;
    for (const [sid, st] of list) out[sid] = Array.from({ length: st.slots }, () => { const x = (k++ - (n - 1) / 2) * 2.2; return at(x, y); });
    return out;
  };
  const raws = [...new Set(Object.values(C.stations).flatMap((st) => Object.keys(st.takes)).filter((i) => isRaw(C, i)))];
  const crates = Object.fromEntries(raws.map((item, k) => [item, at((k - (raws.length - 1) / 2) * 2.2, -4)]));
  const stations = { ...row(near, 0) };
  // a station reached by a longer way (an excavator across the site, a field out past the yard) stands that far off
  let f = 0;
  for (const [sid, st] of far) stations[sid] = Array.from({ length: st.slots }, () => at(9 + 2.2 * f++, -(2 + st.far * WALK)));
  // shelves: each made item a station takes (what waits between one step and the next), and each the card stores (a
  // finite `store`), in a row between the line and the hand-in
  const taken = new Set(Object.values(C.stations).flatMap((st) => Object.keys(st.takes)));
  const kept = Object.keys(C.items).filter((i) => !isRaw(C, i) && (taken.has(i) || C.items[i].store !== Infinity));
  const shelves = Object.fromEntries(kept.map((item, k) => [item, at((k - (kept.length - 1) / 2) * 2.2, 2.4)]));
  return { stations, crates, shelves, serve: at(0, 4.8) };
}

export function lowerWork(p, ctx) {
  const at0 = `work[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  const raw = p.card === undefined ? SCENARIOS.kitchen : typeof p.card === 'string' ? SCENARIOS[p.card] : p.card;
  if (!raw) fail(`card is a Shovels & Buckets card, or a starter: ${Object.keys(SCENARIOS).join(', ')}`);
  let C;
  try { C = readCard(raw); } catch (e) { fail(e.message); }
  // the bag holds, by default, the most any one step puts in or asks of it (a run's takes or its batch, an order's wants)
  const most = Math.max(2, ...Object.values(C.stations).flatMap((st) => [st.batch, Object.values(st.takes).reduce((t, n) => t + n, 0)]), ...C.demand.orders.map((o) => Object.values(o.wants).reduce((t, n) => t + n, 0)));
  const hands = p.hands === undefined ? most : p.hands;
  if (!posInt(hands)) fail('hands is how many units the bag holds, a whole number from 1');
  for (const st of Object.values(C.stations)) if (st.batch > hands) fail(`hands (${hands}) cannot take what one run of a station makes (${st.batch} ${st.item}): more hands, or a smaller batch`);
  const seed = p.seed === undefined ? 1 : p.seed;
  if (!Number.isInteger(seed)) fail('seed is a whole number: the roll of the orders');
  const heading = Number.isFinite(p.heading) ? p.heading : 0;
  const place = isVec(p.at) ? { origin: p.at } : p.at && typeof p.at === 'object' ? p.at : {};
  const origin = isVec(place.origin) ? place.origin : ctx.spawn.map((v, k) => (k === 1 ? v + 6 : v));
  const L = layWork(C, origin, heading);
  const slotsAt = (sid) => {
    const v = place.stations?.[sid];
    if (v === undefined) return L.stations[sid];
    const list = isVec(v) ? Array.from({ length: C.stations[sid].slots }, (_, k) => [v[0] + k * 2.2, v[1], v[2]]) : v;
    if (!Array.isArray(list) || list.length !== C.stations[sid].slots || !list.every(isVec)) fail(`at.stations.${sid} is [x, y, z], or one [x, y, z] a slot (${C.stations[sid].slots})`);
    return list;
  };
  const crateAt = (item) => { const v = place.crates?.[item] ?? L.crates[item]; if (!isVec(v)) fail(`at.crates.${item} is [x, y, z]`); return v; };
  const shelfAt = (item) => { const v = place.shelves?.[item] ?? L.shelves[item]; if (!isVec(v)) fail(`at.shelves.${item} is [x, y, z]`); return v; };
  const serveAt = place.serve ?? L.serve;
  if (!isVec(serveAt)) fail('at.serve is [x, y, z]: where the orders are handed in');

  const W = `w${ctx.i}`, I = `__${W}`, v = (k) => `${W}:${k}`;
  const carry = v('carry'), served = v('served'), missed = v('missed'), burned = v('burned'), score = v('score'), left = v('left');
  const tclock = `${I}:t`, live = `${I}:live`, tick = `${I}:tick`;
  const D = C.demand, arrivals = arrivalsOf(C, seed);
  // the goal, unless written: four fifths of what one player who knows the card serves in the session (the simulator,
  // one crew member, the same orders)
  const goal = p.goal === undefined ? Math.max(1, Math.floor(0.8 * simulate({ ...raw, crew: { ...(raw.crew ?? {}), workers: 1 } }, { seed }).served)) : p.goal;
  if (!posInt(goal)) fail('goal is how many orders must be served by the bell, from 1');
  // enough tickets that an order rarely finds its slot still taken: the orders open at once at the rush's pace
  const peak = D.every ? (D.rush ? D.rush.factor : 1) / D.every : 0;
  const tickets = p.tickets === undefined ? Math.min(12, Math.max(4, D.mode === 'backlog' ? D.backlog + Math.ceil(C.session * peak) : Math.ceil(D.patience * peak) + 2)) : p.tickets;
  if (!posInt(tickets) || tickets > 12) fail('tickets is how many orders the hand-in holds at once, 1 to 12');

  const F = { vars: { [carry]: 0, [served]: 0, [missed]: 0, [burned]: 0, [score]: 0, [left]: Math.round(C.session), [tclock]: 0, [live]: 1 }, reactions: [], hud: [], timers: [], watches: [], sources: [], entities: [] };
  const R = (r) => F.reactions.push(r), toast = (on, text, extra = {}) => F.hud.push({ on, as: 'toast', text, ttl: 1.2, ...extra });
  const zone = (id, at, prompt, radius = 1.1) => F.sources.push({ type: 'zone', zone: `use-${id}`, at: at.slice(), radius, planar: true, watch: ctx.player, use: id, prompt });
  const mark = (id, at, color, dz = 0, on = true, radius = 0.45) => F.entities.push({ id, type: 'work', on, position: [at[0], at[1], r3(at[2] + 0.5 + dz)], radius, color });
  const pieces = (m) => Object.entries(m).map(([i, n]) => `${n > 1 ? `${n} ` : ''}${words(i)}`).join(', ');

  // the clock: a quarter-second tick while the session runs, the seconds left, the bell
  F.timers.push({ every: STEP, emit: { type: tick }, while: { var: live, eq: 1 } }, { every: 1, emit: { type: `${I}:sec` }, while: { var: live, eq: 1 } });
  R({ on: tick, do: 'inc', var: tclock, by: STEP });
  R({ on: `${I}:sec`, do: 'inc', var: left, by: -1, min: 0 });
  F.watches.push({ type: `${I}:bell`, when: { var: tclock, gte: C.session } });
  R({ on: `${I}:bell`, do: 'set', var: live, to: 0 });
  R({ on: `${I}:bell`, if: { var: served, gte: goal }, do: 'emit', type: 'work:won' });
  R({ on: `${I}:bell`, if: { var: served, lt: goal }, do: 'emit', type: 'work:lost' });
  F.hud.push(
    { var: served, label: `Served (of ${goal})`, as: 'counter' }, { var: missed, label: 'Lost', as: 'counter' },
    { var: left, label: 'Time', as: 'counter' }, { var: carry, label: 'Hands', as: 'bar', max: hands },
  );
  toast('work:won', `${goal} served: the shift is done`, { ttl: 3 });
  toast('work:lost', `the bell: ${goal} were wanted`, { ttl: 3 });
  toast('work:full', 'hands full');

  // crates: a raw item a press, while the hands have room
  const raws = [...new Set(Object.values(C.stations).flatMap((st) => Object.keys(st.takes)).filter((i) => isRaw(C, i)))];
  for (const item of raws) {
    const id = `${W}-crate-${item}`, at = crateAt(item), take = `${I}:take:${item}`;
    zone(id, at, `take ${words(item)}`);
    mark(`${id}-box`, at, COLOR.crate, 0, true, 0.55);
    R({ on: `use-${id}`, if: { var: carry, lte: hands - 1 }, do: 'emit', type: take });
    R({ on: `use-${id}`, if: { var: carry, gt: hands - 1 }, do: 'emit', type: 'work:full' });
    const { ok } = lowerMove({ item, n: 1, from: NOWHERE, to: BAG, on: take }, F);
    R({ on: ok, do: 'inc', var: carry, by: 1 });
    R({ on: ok, do: 'emit', type: 'work:took', item });
    toast(ok, `took ${words(item)}`, { ttl: 0.8 });
  }

  // shelves (bucket work: storage): two pads side by side, one that puts one down (while the shelf has room), one that
  // takes one (while the hands have room): a bag of several things needs to say which
  const kept = Object.keys(L.shelves);
  for (const item of kept) {
    const id = `${W}-shelf-${item}`, at = shelfAt(item), cap = C.items[item].store === Infinity ? SHELF : C.items[item].store, here = heldVar(id, item), mine = heldVar(BAG, item);
    const [pin, pout] = shelfPads(at, heading);
    F.vars[mine] ??= 0;
    zone(`${id}-put`, pin, `put down ${words(item)} (holds ${cap})`, 0.6);
    zone(`${id}-take`, pout, `take ${words(item)}`, 0.6);
    mark(`${id}-board`, at, COLOR.shelf, 0, true, 0.5);
    R({ on: `use-${id}-put`, if: { var: mine, gte: 1 }, do: 'emit', type: `${I}:put:${item}` });
    R({ on: `use-${id}-take`, do: 'emit', type: `${I}:get:${item}` });
    chain(F.reactions, `${I}:put:${item}`, [{ var: here, lte: cap - 1 }], `${I}:putting:${item}`, null);
    const put = lowerMove({ item, n: 1, from: BAG, to: id, on: `${I}:putting:${item}` }, F);
    R({ on: put.ok, do: 'inc', var: carry, by: -1, min: 0 });
    toast(put.ok, `put down the ${words(item)}`, { ttl: 0.8 });
    R({ on: `${I}:put:${item}`, if: { var: here, gte: cap }, do: 'emit', type: `${I}:shelf-full:${item}` });
    toast(`${I}:shelf-full:${item}`, `the ${words(item)} shelf is full`);
    R({ on: `${I}:get:${item}`, if: { var: carry, gt: hands - 1 }, do: 'emit', type: 'work:full' });
    chain(F.reactions, `${I}:get:${item}`, [{ var: here, gte: 1 }, { var: carry, lte: hands - 1 }], `${I}:getting:${item}`, null);
    const get = lowerMove({ item, n: 1, from: id, to: BAG, on: `${I}:getting:${item}` }, F);
    R({ on: get.ok, do: 'inc', var: carry, by: 1 });
    toast(get.ok, `took the ${words(item)} off the shelf`, { ttl: 0.8 });
  }

  // stations: each slot its own phase (0 free, 1 left mid-work, 2 worked, 3 running alone, 4 done on the station)
  for (const [sid, st] of Object.entries(C.stations)) {
    const work = Math.max(STEP, st.work), takesN = Object.values(st.takes).reduce((t, n) => t + n, 0);
    slotsAt(sid).forEach((at, k) => {
      const id = `${W}-${sid}-${k}`, use = `use-${id}`, P = `${I}:${sid}:${k}`, Pp = `${P}:p`, Pw = `${P}:w`, Ph = `${P}:h`;
      const busy = `${id}-busy`, ready = `${id}-ready`;
      Object.assign(F.vars, { [P]: 0, [Pp]: 0, [Pw]: 0, [Ph]: 0 });
      zone(id, at, `${words(sid)}: ${Object.keys(st.takes).length ? `${pieces(st.takes)} → ` : ''}${st.batch > 1 ? `${st.batch} ` : ''}${words(st.item)} (${st.verb})`);
      mark(`${id}-base`, at, COLOR[st.verb], 0, true, 0.6);
      mark(busy, at, COLOR.busy, 0.8, false, 0.25);
      mark(ready, at, COLOR.ready, 0.8, false, 0.3);
      // E: take what is done, start (its takes in the bag), or resume
      R({ on: use, if: { var: P, eq: 4 }, do: 'emit', type: `${P}:collect` });
      R({ on: use, if: { var: P, eq: 0 }, do: 'emit', type: `${P}:try` });
      R({ on: use, if: { var: P, eq: 1 }, do: 'emit', type: `${P}:resume` });
      chain(F.reactions, `${P}:try`, Object.entries(st.takes).map(([i, n]) => ({ var: heldVar(BAG, i), gte: n })), `${P}:start`, `${P}:short`);
      for (const i of Object.keys(st.takes)) F.vars[heldVar(BAG, i)] ??= 0;
      toast(`${P}:short`, `the ${words(sid)} needs ${pieces(st.takes)}`, { ttl: 1.6 });
      for (const [i, n] of Object.entries(st.takes)) lowerMove({ item: i, n, from: BAG, to: NOWHERE, on: `${P}:start` }, F);
      if (takesN) R({ on: `${P}:start`, do: 'inc', var: carry, by: -takesN, min: 0 });
      R({ on: `${P}:start`, do: 'set', var: Pp, to: 0 });
      R({ on: `${P}:start`, do: 'set', var: P, to: 2 });
      R({ on: `${P}:start`, do: 'toggle', target: busy, to: true });
      R({ on: `${P}:resume`, do: 'set', var: P, to: 2 });
      // the work is done standing there: walk off and it waits, its progress kept
      R({ on: 'exit', match: { zone: use, entity: ctx.player }, if: { var: P, eq: 2 }, do: 'set', var: P, to: 1 });
      R({ on: tick, if: { var: P, eq: 2 }, do: 'inc', var: Pp, by: STEP });
      F.watches.push({ type: `${P}:worked`, when: { var: Pp, gte: work } });
      if (st.wait) {
        R({ on: `${P}:worked`, if: { var: P, eq: 2 }, do: 'emit', type: `${P}:cook` });
        R({ on: `${P}:cook`, do: 'set', var: Pw, to: 0 });
        R({ on: `${P}:cook`, do: 'set', var: P, to: 3 });
        R({ on: tick, if: { var: P, eq: 3 }, do: 'inc', var: Pw, by: STEP });
        F.watches.push({ type: `${P}:waited`, when: { var: Pw, gte: st.wait } });
        R({ on: `${P}:waited`, if: { var: P, eq: 3 }, do: 'emit', type: `${P}:ready` });
        R({ on: `${P}:ready`, do: 'set', var: Ph, to: 0 });
        R({ on: `${P}:ready`, do: 'set', var: P, to: 4 });
        R({ on: `${P}:ready`, do: 'toggle', target: busy, to: false });
        R({ on: `${P}:ready`, do: 'toggle', target: ready, to: true });
        R({ on: `${P}:ready`, do: 'emit', type: 'work:ready', item: st.item });
        toast(`${P}:ready`, `the ${words(st.item)} is ready`);
        if (st.hold !== Infinity) {
          R({ on: tick, if: { var: P, eq: 4 }, do: 'inc', var: Ph, by: STEP });
          F.watches.push({ type: `${P}:held`, when: { var: Ph, gte: st.hold } });
          R({ on: `${P}:held`, if: { var: P, eq: 4 }, do: 'emit', type: `${P}:burn` });
          R({ on: `${P}:burn`, do: 'set', var: P, to: 0 });
          R({ on: `${P}:burn`, do: 'inc', var: burned, by: st.batch });
          R({ on: `${P}:burn`, do: 'toggle', target: ready, to: false });
          R({ on: `${P}:burn`, do: 'emit', type: 'work:burned', item: st.item });
          toast(`${P}:burn`, `the ${words(st.item)} is lost: left too long`, { ttl: 1.6 });
        }
      } else {
        // made in the hands; full, left on the station to take later
        R({ on: `${P}:worked`, if: { var: P, eq: 2 }, do: 'emit', type: `${P}:made` });
        R({ on: `${P}:made`, if: { var: carry, lte: hands - st.batch }, do: 'emit', type: `${P}:hand` });
        R({ on: `${P}:made`, if: { var: carry, gt: hands - st.batch }, do: 'emit', type: `${P}:leave` });
        R({ on: `${P}:leave`, do: 'set', var: P, to: 4 });
        R({ on: `${P}:leave`, do: 'toggle', target: busy, to: false });
        R({ on: `${P}:leave`, do: 'toggle', target: ready, to: true });
        toast(`${P}:leave`, `hands full: the ${words(st.item)} waits on the ${words(sid)}`);
        const { ok } = lowerMove({ item: st.item, n: st.batch, from: NOWHERE, to: BAG, on: `${P}:hand` }, F);
        R({ on: ok, do: 'inc', var: carry, by: st.batch });
        R({ on: ok, do: 'set', var: P, to: 0 });
        R({ on: ok, do: 'toggle', target: busy, to: false });
        R({ on: ok, do: 'emit', type: 'work:made', item: st.item });
        toast(ok, `${words(st.item)} made`, { ttl: 0.8 });
      }
      // E on what is done: into the hands, while they have room
      R({ on: `${P}:collect`, if: { var: carry, lte: hands - st.batch }, do: 'emit', type: `${P}:take` });
      R({ on: `${P}:collect`, if: { var: carry, gt: hands - st.batch }, do: 'emit', type: 'work:full' });
      const { ok } = lowerMove({ item: st.item, n: st.batch, from: NOWHERE, to: BAG, on: `${P}:take` }, F);
      R({ on: ok, do: 'inc', var: carry, by: st.batch });
      R({ on: ok, do: 'set', var: P, to: 0 });
      R({ on: ok, do: 'toggle', target: ready, to: false });
      R({ on: ok, do: 'emit', type: 'work:took', item: st.item });
      toast(ok, `took the ${words(st.item)}`, { ttl: 0.8 });
    });
  }

  // orders: each rolled arrival given its ticket slot when rolled (the m-th the slot m mod tickets: no chain, no race),
  // turned away when that slot still holds an order; each waits its patience
  const kinds = D.orders;
  const patience = D.mode === 'backlog' ? C.session + 1 : D.patience;
  arrivals.forEach((a, m) => {
    const j = m % tickets, o = `${I}:o:${j}`;
    F.watches.push({ type: `${I}:arr:${m}`, when: { var: tclock, gte: a.at } });
    R({ on: `${I}:arr:${m}`, if: { var: o, eq: 0 }, do: 'emit', type: `${I}:fill:${j}`, kind: a.order + 1 });
    R({ on: `${I}:arr:${m}`, if: { var: o, gte: 1 }, do: 'emit', type: `${I}:turned` });
  });
  for (let j = 0; j < tickets; j++) {
    const o = `${I}:o:${j}`, age = `${I}:a:${j}`;
    Object.assign(F.vars, { [o]: 0, [age]: 0 });
    R({ on: `${I}:fill:${j}`, do: 'set', var: o, to: 'event.kind' });
    R({ on: `${I}:fill:${j}`, do: 'set', var: age, to: 0 });
    R({ on: tick, if: { var: o, gte: 1 }, do: 'inc', var: age, by: STEP });
    F.watches.push({ type: `${I}:late:${j}`, when: { var: age, gte: patience } });
    R({ on: `${I}:late:${j}`, if: { var: o, gte: 1 }, do: 'emit', type: `${I}:walk:${j}` });
    R({ on: `${I}:walk:${j}`, do: 'set', var: o, to: 0 });
    R({ on: `${I}:walk:${j}`, do: 'inc', var: missed, by: 1 });
    R({ on: `${I}:walk:${j}`, do: 'emit', type: 'work:walked' });
    kinds.forEach((K, k) => {
      const tk = `${W}-ticket-${j}-${k}`;
      mark(tk, [r3(serveAt[0] + (j - (tickets - 1) / 2) * 0.7), serveAt[1], serveAt[2]], TICKETS[k % TICKETS.length], 1.2, false, 0.22);
      R({ on: `${I}:fill:${j}`, match: { kind: String(k + 1) }, do: 'toggle', target: tk, to: true });
      R({ on: `${I}:fill:${j}`, match: { kind: String(k + 1) }, do: 'emit', type: `${I}:ordered:${k}` });
      R({ on: `${I}:walk:${j}`, do: 'toggle', target: tk, to: false });
      R({ on: `${I}:done:${j}:${k}`, do: 'toggle', target: tk, to: false });
    });
  }
  kinds.forEach((K, k) => toast(`${I}:ordered:${k}`, `order: ${K.name} (${pieces(K.wants)})`, { ttl: 1.6 }));
  R({ on: `${I}:turned`, do: 'inc', var: missed, by: 1 });
  R({ on: `${I}:turned`, do: 'emit', type: 'work:walked' });
  toast('work:walked', 'an order walked out');

  // the hand-in: every ticket asked at once, each whose wants are all in the bag a candidate; the first candidate takes
  // the lock and is served, one order a press. A press that served none is said on the next tick
  const hid = `${W}-serve`, lock = `${I}:lock`, asked = `${I}:asked`;
  Object.assign(F.vars, { [lock]: 1, [asked]: 0 });
  zone(hid, serveAt, 'hand in an order');
  mark(`${hid}-counter`, serveAt, COLOR.serve, 0, true, 0.7);
  R({ on: `use-${hid}`, do: 'set', var: lock, to: 0 });
  R({ on: `use-${hid}`, do: 'set', var: asked, to: 1 });
  for (let j = 0; j < tickets; j++) {
    const o = `${I}:o:${j}`, age = `${I}:a:${j}`;
    kinds.forEach((K, k) => {
      const ask = `${I}:sv:${j}:${k}`, cand = `${I}:cand:${j}:${k}`, done = `${I}:done:${j}:${k}`, n = Object.values(K.wants).reduce((t, x) => t + x, 0);
      R({ on: `use-${hid}`, if: { var: o, eq: k + 1 }, do: 'emit', type: ask });
      chain(F.reactions, ask, Object.entries(K.wants).map(([i, x]) => ({ var: heldVar(BAG, i), gte: x })), cand, null);
      for (const i of Object.keys(K.wants)) F.vars[heldVar(BAG, i)] ??= 0;
      R({ on: cand, if: { var: lock, eq: 0 }, do: 'emit', type: done });
      R({ on: cand, if: { var: lock, eq: 0 }, do: 'set', var: lock, to: 1 });
      // the wants leave the bag (each guarded by the chain above, so taken directly), the ticket is torn
      for (const [i, x] of Object.entries(K.wants)) R({ on: done, do: 'inc', var: heldVar(BAG, i), by: -x, min: 0 });
      R({ on: done, do: 'inc', var: carry, by: -n, min: 0 });
      // a quick hand-in tips: within half its patience
      R({ on: done, if: { var: age, lt: patience / 2 }, do: 'inc', var: score, by: 5 });
      R({ on: done, do: 'inc', var: score, by: 10 });
      R({ on: done, do: 'set', var: o, to: 0 });
      R({ on: done, do: 'inc', var: served, by: 1 });
      R({ on: done, do: 'emit', type: 'work:served', order: K.name });
      toast(done, `served: ${K.name}`, { ttl: 1.2, color: 'value' });
    });
  }
  R({ on: tick, if: { var: asked, eq: 1 }, do: 'emit', type: `${I}:check` });
  R({ on: `${I}:check`, if: { var: lock, eq: 0 }, do: 'emit', type: `${I}:nothing` });
  R({ on: `${I}:check`, do: 'set', var: asked, to: 0 });
  toast(`${I}:nothing`, 'nothing in the hands an order wants', { ttl: 1.6 });

  return {
    world: F,
    on: { 'work:won': { end: 'success' }, 'work:lost': { end: 'fail' } },
    emits: ['work:took', 'work:made', 'work:ready', 'work:burned', 'work:served', 'work:walked', 'work:full', 'work:won', 'work:lost'],
    work: { card: C.id, goal, hands, tickets, heading, arrivals: arrivals.length, layout: { stations: Object.fromEntries(Object.keys(C.stations).map((s) => [s, slotsAt(s)])), crates: Object.fromEntries(raws.map((i) => [i, crateAt(i)])), shelves: Object.fromEntries(kept.map((i) => [i, shelfAt(i)])), serve: serveAt } },
  };
}
