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
 *              same: the verb is what the work is, said in its colour
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
 *     tickets?: ticket slots at the hand-in, reach? (1.1): how far from a place its E works, bases? (true): the places'
 *     own markers (false: a room that draws them as blocks), show? (false): the work drawn where it happens, in pips (a
 *     station's work filling, its wait filling, its hold going out toward the burn; a pip a unit on a shelf), and what
 *     is in hand on the HUD, a counter an item that stands only while one is held, rail? (false): the open orders along
 *     the top of the screen, each its order's colour, what it wants and a bar of the patience it has left (in place of the
 *     toast that says an order came), counters? (false): a counter stands
 *     under each place (a level's, quick.js workCast), each place's marker a small cap on its top }
 *
 * SEATS (ctx.seats, a level with seats: the bodies seats 2 … take): every verb a hand does is lowered once a seat. Seat 1
 * is the pilot as above; seat n's hands are the holder `hands<n>`, its carry `w<i>:carry:<n>`, its zones `s<n>:use-…`
 * watching its body (each a `seatUse`, never the pilot's reach), its press `s<n>:use-<place>` (the page's seat reach,
 * scene/channels/interact-channel.js seatReachScript). The stations, shelves, tickets and clock are one, shared: a shelf
 * is the PASS, what one cook puts down another takes up. A slot remembers who works it (`<slot>:by`): walking off pauses
 * only that cook's work, and what a run with no wait makes comes into that cook's hands. No seats: what it always was.
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
import { lowerMove, heldVar, itemKey, NOWHERE } from '../playscape/ui/items.js';
import { SEATS } from '../controls/seats-kernel.js';

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
// the colours of the work: shovel work warm (active), bucket work cool (passive), what runs alone a third hue, the hold
// going toward the burn red, what is kept gold; the places' own neutral
export const WORK_COLORS = Object.freeze({ shovel: '#e4875f', bucket: '#5fa3c7', wait: '#a98fd6', hold: '#e8604c', stock: '#e9b949', busy: '#f0a020', ready: '#5cc46a', crate: '#c9a978', shelf: '#a99f90', serve: '#f6f2ea' });
const COLOR = WORK_COLORS;
const TICKETS = ['#e05a5a', '#5a9be0', '#e0c25a', '#a05ae0', '#5ae0b4', '#e07f5a'];
// (seated: each seat's corner of the screen, its own state there in its colour; seat 1's is the bottom left, as it was)
// (the top's middle is the order rail's, the shared state in one place: work's `rail`)
export const SEAT_CORNERS = Object.freeze([null, 'bottom-left', 'bottom-right', 'top-right', 'bottom']);
const CORNER = SEAT_CORNERS;

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
  // `reach`: how far from a place its E works (a counter's side, not its middle); `bases: false`, the places' own markers
  // left out (a room that draws them as blocks), the busy, ready and ticket markers kept, raised over a counter
  const reach = p.reach === undefined ? 1.1 : p.reach, bases = p.bases !== false, lift = bases ? 0 : 0.6, show = p.show === true;
  if (p.show !== undefined && typeof p.show !== 'boolean') fail('show is true (the work drawn where it happens, in pips) or false');
  const rail = p.rail === true;
  if (p.rail !== undefined && typeof p.rail !== 'boolean') fail('rail is true (the open orders along the top of the screen, each its patience going) or false');
  if (!(Number.isFinite(reach) && reach >= 0.5 && reach <= 3)) fail('reach is how far from a place its E works, 0.5 to 3 m');
  // THE HANDS (docs/local-multiplayer-principles.md): one a seat. Seat 1 is the pilot: its zones `use-<place>` watch it,
  // its press is the page's `use-<place>`, its holder the bag. A level with seats (ctx.seats: the bodies seats 2 … take,
  // the level's seats.bodies) gives each its own: zones `s<n>:use-<place>` watching its body (a `seatUse`, never the
  // pilot's reach), its press `s<n>:use-<place>`, its holder `hands<n>`, its carry `w<i>:carry:<n>`. Every verb a hand
  // does is lowered once a hand, each hand's own events suffixed `:<n>` when seated; with one hand there is no suffix
  // and the reactions are the ones a single cook always had, in the same order
  const seated = Array.isArray(ctx.seats) && ctx.seats.length > 0;
  const HANDS = [
    { n: 1, bag: BAG, carry, ent: ctx.player, sfx: seated ? ':1' : '', use: (id) => `use-${id}` },
    ...(seated ? ctx.seats.slice(0, 3).map((ent, k) => ({ n: k + 2, bag: `hands${k + 2}`, carry: v(`carry:${k + 2}`), ent, sfx: `:${k + 2}`, use: (id) => `s${k + 2}:use-${id}` })) : []),
  ];
  for (const H of HANDS.slice(1)) F.vars[H.carry] = 0;
  const zoneOf = (H, id) => (H.n === 1 ? `use-${id}` : `s${H.n}:use-${id}`);
  const zone = (id, at, prompt, radius = reach) => {
    for (const H of HANDS) F.sources.push(H.n === 1 ? { type: 'zone', zone: `use-${id}`, at: at.slice(), radius, planar: true, watch: ctx.player, use: id, prompt } : { type: 'zone', zone: zoneOf(H, id), at: at.slice(), radius, planar: true, watch: H.ent, seat: H.n, seatUse: id, hands: H.bag, prompt });
  };
  // `counters: true`: the level stands a counter under each place (quick.js workCast), so a place's own marker sits on
  // its top as a dome in its colour, never wider than the counter
  const counters = p.counters === true;
  if (p.counters !== undefined && typeof p.counters !== 'boolean') fail('counters is true (a counter stands under each place: its marker a cap on top) or false');
  const mark = (id, at, color, dz = 0, on = true, radius = 0.45) => {
    if (dz === 0 && !bases) return;
    const cap = dz === 0 && counters;
    F.entities.push({ id, type: 'work', on, position: [at[0], at[1], r3(at[2] + (cap ? 0.85 : 0.5 + dz + lift))], radius: cap ? Math.min(radius, 0.28) : radius, color });
  };
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
  // (seated: each other seat's hands in its own corner, in its colour: no seat's state is anonymous or another's)
  for (const H of HANDS.slice(1)) F.hud.push({ var: H.carry, label: `${SEATS.SEAT_LABELS[H.n - 1]} hands`, as: 'bar', max: hands, slot: CORNER[H.n], color: SEATS.SEAT_COLORS[H.n - 1] });
  toast('work:won', `${goal} served: the shift is done`, { ttl: 3 });
  toast('work:lost', `the bell: ${goal} were wanted`, { ttl: 3 });
  toast('work:full', 'hands full');

  // crates: a raw item a press, while the hands have room
  const raws = [...new Set(Object.values(C.stations).flatMap((st) => Object.keys(st.takes)).filter((i) => isRaw(C, i)))];
  for (const item of raws) {
    const id = `${W}-crate-${item}`, at = crateAt(item);
    zone(id, at, `take ${words(item)}`);
    mark(`${id}-box`, at, COLOR.crate, 0, true, 0.55);
    for (const H of HANDS) {
      const take = `${I}:take:${item}${H.sfx}`;
      R({ on: H.use(id), if: { var: H.carry, lte: hands - 1 }, do: 'emit', type: take });
      R({ on: H.use(id), if: { var: H.carry, gt: hands - 1 }, do: 'emit', type: 'work:full' });
      const { ok } = lowerMove({ item, n: 1, from: NOWHERE, to: H.bag, on: take }, F);
      R({ on: ok, do: 'inc', var: H.carry, by: 1 });
      R({ on: ok, do: 'emit', type: 'work:took', item });
      toast(ok, `took ${words(item)}`, { ttl: 0.8 });
    }
  }

  // SHOWING THE WORK (`show: true`): the process drawn where it happens, in pips. Over each station slot a row of five:
  // they fill as it is worked (its verb's colour), fill again as it runs alone (the wait's), and when it is done they
  // stand full in the hold's colour and go out one by one toward the burn. Over each shelf, a pip a unit it holds. Each a
  // marker the bus toggles at a fifth of the way (a watch on the slot's own clock); absent, nothing of it is laid
  const PIPS = 5;
  const pipRow = (base, at, n, color, dz) => Array.from({ length: n }, (_, q) => {
    const pid = `${base}-${q + 1}`;
    // (a little toward the screen's bottom, -y: in front of the counter's top as the overhead view sees it)
    F.entities.push({ id: pid, type: 'work-pip', on: false, position: [r3(at[0] + (q - (n - 1) / 2) * 0.26), r3(at[1] - 0.35), r3(at[2] + dz)], radius: 0.11, color });
    return pid;
  });
  const off = (on, ids) => { for (const t of ids) R({ on, do: 'toggle', target: t, to: false }); };
  const fill = (v, of, ids, wtype) => ids.forEach((t, q) => {
    F.watches.push({ type: `${wtype}:${q + 1}`, when: { var: v, gte: r3((of * (q + 1)) / PIPS) } });
    R({ on: `${wtype}:${q + 1}`, do: 'toggle', target: t, to: true });
  });
  function showSlot({ id, P, Pp, Pw, Ph, st, work, at, taken }) {
    const dz = bases ? 1.4 : 1.45;
    const W5 = pipRow(`${id}-pip-work`, at, PIPS, COLOR[st.verb], dz);
    const C5 = st.wait ? pipRow(`${id}-pip-wait`, at, PIPS, COLOR.wait, dz) : [];
    const H5 = st.wait && st.hold !== Infinity ? pipRow(`${id}-pip-hold`, at, PIPS, COLOR.hold, dz) : [];
    const all = [...W5, ...C5, ...H5];
    off(`${P}:start`, all);
    fill(Pp, work, W5, `${P}:pw`);
    if (st.wait) {
      off(`${P}:cook`, W5);
      fill(Pw, st.wait, C5, `${P}:pc`);
      off(`${P}:ready`, C5);
      if (H5.length) {
        for (const t of H5) R({ on: `${P}:ready`, do: 'toggle', target: t, to: true });
        // the hold going: the last pip out first, at each fifth of it
        H5.slice().reverse().forEach((t, q) => {
          F.watches.push({ type: `${P}:ph:${q + 1}`, when: { var: Ph, gte: r3((st.hold * (q + 1)) / PIPS) } });
          R({ on: `${P}:ph:${q + 1}`, if: { var: P, eq: 4 }, do: 'toggle', target: t, to: false });
        });
        off(`${P}:burn`, H5);
      }
    } else {
      for (const H of HANDS) off(`moved:${P}:hand${H.sfx}:${itemKey(st.item)}`, W5);
      off(`${P}:leave`, W5);
    }
    for (const t of taken) off(t, all);
  }
  function showShelf(id, at, item, cap) {
    const n = Math.min(cap, 6), here = heldVar(id, item);
    const ids = Array.from({ length: n }, (_, q) => {
      const pid = `${id}-pip-${q + 1}`;
      F.entities.push({ id: pid, type: 'work-pip', on: false, position: [r3(at[0] + (q - (n - 1) / 2) * 0.2), at[1], r3(at[2] + (bases ? 1.35 : 1.4))], radius: 0.075, color: COLOR.stock });
      F.watches.push({ type: `${id}:has:${q + 1}`, when: { var: here, gte: q + 1 } }, { type: `${id}:lacks:${q + 1}`, when: { var: here, lt: q + 1 } });
      R({ on: `${id}:has:${q + 1}`, do: 'toggle', target: pid, to: true });
      R({ on: `${id}:lacks:${q + 1}`, do: 'toggle', target: pid, to: false });
      return pid;
    });
    return ids;
  }

  // IN HAND (shown): what the bag holds, a readout an item that stands only while one is held (its ui-<id> gate)
  if (show) {
    const carried = [...new Set([...Object.values(C.stations).flatMap((st) => Object.keys(st.takes)), ...Object.values(C.stations).map((st) => st.item)])];
    for (const H of HANDS) for (const item of carried) {
      // (seat 1's as it always was; seated, each other seat's in its own corner, said as its own)
      const key = itemKey(item), sfx = H.n === 1 ? '' : `-${H.n}`, hid = `${W}-held-${key}${sfx}`, gate = `ui-${hid}`, mine = heldVar(H.bag, key);
      F.vars[mine] ??= 0;
      F.vars[gate] = 0;
      F.hud.push(H.n === 1 ? { id: hid, var: mine, label: words(key), as: 'counter', slot: 'bottom-left' } : { id: hid, var: mine, label: `${SEATS.SEAT_LABELS[H.n - 1]} ${words(key)}`, as: 'counter', slot: CORNER[H.n], color: SEATS.SEAT_COLORS[H.n - 1] });
      F.watches.push({ type: `${I}:holds:${key}${sfx}`, when: { var: mine, gte: 1 } }, { type: `${I}:empty:${key}${sfx}`, when: { var: mine, lt: 1 } });
      R({ on: `${I}:holds:${key}${sfx}`, do: 'set', var: gate, to: 1 });
      R({ on: `${I}:empty:${key}${sfx}`, do: 'set', var: gate, to: 0 });
    }
  }

  // shelves (bucket work: storage): two pads side by side, one that puts one down (while the shelf has room), one that
  // takes one (while the hands have room): a bag of several things needs to say which
  const kept = Object.keys(L.shelves);
  for (const item of kept) {
    const id = `${W}-shelf-${item}`, at = shelfAt(item), cap = C.items[item].store === Infinity ? SHELF : C.items[item].store, here = heldVar(id, item);
    const [pin, pout] = shelfPads(at, heading);
    for (const H of HANDS) F.vars[heldVar(H.bag, item)] ??= 0;
    zone(`${id}-put`, pin, `put down ${words(item)}`, Math.min(0.6, reach));   // (how many it holds its pips show)
    zone(`${id}-take`, pout, `take ${words(item)}`, Math.min(0.6, reach));
    mark(`${id}-board`, at, COLOR.shelf, 0, true, 0.5);
    if (show) showShelf(id, at, item, cap);
    // (with seats, the shelf is the pass: what one cook puts down another takes up)
    for (const H of HANDS) {
      const mine = heldVar(H.bag, item), putH = `${I}:put:${item}${H.sfx}`, getH = `${I}:get:${item}${H.sfx}`;
      R({ on: H.use(`${id}-put`), if: { var: mine, gte: 1 }, do: 'emit', type: putH });
      R({ on: H.use(`${id}-take`), do: 'emit', type: getH });
      chain(F.reactions, putH, [{ var: here, lte: cap - 1 }], `${I}:putting:${item}${H.sfx}`, null);
      const put = lowerMove({ item, n: 1, from: H.bag, to: id, on: `${I}:putting:${item}${H.sfx}` }, F);
      R({ on: put.ok, do: 'inc', var: H.carry, by: -1, min: 0 });
      toast(put.ok, `put down the ${words(item)}`, { ttl: 0.8 });
      R({ on: putH, if: { var: here, gte: cap }, do: 'emit', type: `${I}:shelf-full:${item}` });
      if (H.n === 1) toast(`${I}:shelf-full:${item}`, `the ${words(item)} shelf is full`);
      R({ on: getH, if: { var: H.carry, gt: hands - 1 }, do: 'emit', type: 'work:full' });
      chain(F.reactions, getH, [{ var: here, gte: 1 }, { var: H.carry, lte: hands - 1 }], `${I}:getting:${item}${H.sfx}`, null);
      const get = lowerMove({ item, n: 1, from: id, to: H.bag, on: `${I}:getting:${item}${H.sfx}` }, F);
      R({ on: get.ok, do: 'inc', var: H.carry, by: 1 });
      toast(get.ok, `took the ${words(item)} off the shelf`, { ttl: 0.8 });
    }
  }

  // stations: each slot its own phase (0 free, 1 left mid-work, 2 worked, 3 running alone, 4 done on the station)
  for (const [sid, st] of Object.entries(C.stations)) {
    const work = Math.max(STEP, st.work), takesN = Object.values(st.takes).reduce((t, n) => t + n, 0);
    slotsAt(sid).forEach((at, k) => {
      const id = `${W}-${sid}-${k}`, use = `use-${id}`, P = `${I}:${sid}:${k}`, Pp = `${P}:p`, Pw = `${P}:w`, Ph = `${P}:h`;
      const busy = `${id}-busy`, ready = `${id}-ready`;
      Object.assign(F.vars, { [P]: 0, [Pp]: 0, [Pw]: 0, [Ph]: 0 });
      // (seated: which seat works the slot, so walking off pauses its own work and a run's make comes to its hands)
      const by = `${P}:by`;
      if (seated) F.vars[by] = 0;
      // (the verb is said by the station's colour, not its prompt)
      zone(id, at, `${words(sid)}: ${Object.keys(st.takes).length ? `${pieces(st.takes)} → ` : ''}${st.batch > 1 ? `${st.batch} ` : ''}${words(st.item)}`);
      mark(`${id}-base`, at, COLOR[st.verb], 0, true, 0.6);
      // (with the work shown, the pips say busy and ready: the two markers are not laid)
      if (!show) { mark(busy, at, COLOR.busy, 0.8, false, 0.25); mark(ready, at, COLOR.ready, 0.8, false, 0.3); }
      // E: take what is done, start (its takes in the bag), or resume
      for (const H of HANDS) {
        const useH = H.use(id);
        R({ on: useH, if: { var: P, eq: 4 }, do: 'emit', type: `${P}:collect${H.sfx}` });
        R({ on: useH, if: { var: P, eq: 0 }, do: 'emit', type: `${P}:try${H.sfx}` });
        R({ on: useH, if: { var: P, eq: 1 }, do: 'emit', type: `${P}:resume${H.sfx}` });
        chain(F.reactions, `${P}:try${H.sfx}`, Object.entries(st.takes).map(([i, n]) => ({ var: heldVar(H.bag, i), gte: n })), `${P}:start${H.sfx}`, `${P}:short`);
        for (const i of Object.keys(st.takes)) F.vars[heldVar(H.bag, i)] ??= 0;
      }
      toast(`${P}:short`, `the ${words(sid)} needs ${pieces(st.takes)}`, { ttl: 1.6 });
      // a hand's start spends its takes from its own hands, then (seated) starts the slot as one
      for (const H of HANDS) {
        const startH = `${P}:start${H.sfx}`;
        for (const [i, n] of Object.entries(st.takes)) lowerMove({ item: i, n, from: H.bag, to: NOWHERE, on: startH }, F);
        if (takesN) R({ on: startH, do: 'inc', var: H.carry, by: -takesN, min: 0 });
        if (seated) { R({ on: startH, do: 'set', var: by, to: H.n }); R({ on: startH, do: 'emit', type: `${P}:start` }); }
      }
      R({ on: `${P}:start`, do: 'set', var: Pp, to: 0 });
      R({ on: `${P}:start`, do: 'set', var: P, to: 2 });
      R({ on: `${P}:start`, do: 'toggle', target: busy, to: true });
      for (const H of HANDS) {
        R({ on: `${P}:resume${H.sfx}`, do: 'set', var: P, to: 2 });
        if (seated) R({ on: `${P}:resume${H.sfx}`, do: 'set', var: by, to: H.n });
      }
      // the work is done standing there: walk off and it waits, its progress kept (seated: only its own worker's walking off)
      for (const H of HANDS) {
        if (!seated) { R({ on: 'exit', match: { zone: use, entity: ctx.player }, if: { var: P, eq: 2 }, do: 'set', var: P, to: 1 }); continue; }
        R({ on: 'exit', match: { zone: zoneOf(H, id), entity: H.ent }, if: { var: P, eq: 2 }, do: 'emit', type: `${P}:off${H.sfx}` });
        R({ on: `${P}:off${H.sfx}`, if: { var: by, eq: H.n }, do: 'set', var: P, to: 1 });
      }
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
        // made in the hands of the one who worked it (seated: the slot's worker)
        R({ on: `${P}:worked`, if: { var: P, eq: 2 }, do: 'emit', type: `${P}:made` });
        for (const H of HANDS) {
          const madeH = seated ? `${P}:made${H.sfx}` : `${P}:made`;
          if (seated) R({ on: `${P}:made`, if: { var: by, eq: H.n }, do: 'emit', type: madeH });
          R({ on: madeH, if: { var: H.carry, lte: hands - st.batch }, do: 'emit', type: `${P}:hand${H.sfx}` });
          R({ on: madeH, if: { var: H.carry, gt: hands - st.batch }, do: 'emit', type: `${P}:leave` });
        }
        R({ on: `${P}:leave`, do: 'set', var: P, to: 4 });
        R({ on: `${P}:leave`, do: 'toggle', target: busy, to: false });
        R({ on: `${P}:leave`, do: 'toggle', target: ready, to: true });
        toast(`${P}:leave`, `hands full: the ${words(st.item)} waits on the ${words(sid)}`);
        for (const H of HANDS) {
          const { ok } = lowerMove({ item: st.item, n: st.batch, from: NOWHERE, to: H.bag, on: `${P}:hand${H.sfx}` }, F);
          R({ on: ok, do: 'inc', var: H.carry, by: st.batch });
          R({ on: ok, do: 'set', var: P, to: 0 });
          R({ on: ok, do: 'toggle', target: busy, to: false });
          R({ on: ok, do: 'emit', type: 'work:made', item: st.item });
          toast(ok, `${words(st.item)} made`, { ttl: 0.8 });
        }
      }
      // E on what is done: into the hands, while they have room (any cook's)
      const taken = HANDS.map((H) => {
        R({ on: `${P}:collect${H.sfx}`, if: { var: H.carry, lte: hands - st.batch }, do: 'emit', type: `${P}:take${H.sfx}` });
        R({ on: `${P}:collect${H.sfx}`, if: { var: H.carry, gt: hands - st.batch }, do: 'emit', type: 'work:full' });
        const { ok } = lowerMove({ item: st.item, n: st.batch, from: NOWHERE, to: H.bag, on: `${P}:take${H.sfx}` }, F);
        R({ on: ok, do: 'inc', var: H.carry, by: st.batch });
        R({ on: ok, do: 'set', var: P, to: 0 });
        R({ on: ok, do: 'toggle', target: ready, to: false });
        R({ on: ok, do: 'emit', type: 'work:took', item: st.item });
        toast(ok, `took the ${words(st.item)}`, { ttl: 0.8 });
        return ok;
      });
      if (show) showSlot({ id, P, Pp, Pw, Ph, at, st, work, taken });
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
      // (the tickets as markers at the hand-in; with the rail up, the rail is the ticket and none is laid)
      const tk = `${W}-ticket-${j}-${k}`;
      if (!rail) mark(tk, [r3(serveAt[0] + (j - (tickets - 1) / 2) * 0.7), serveAt[1], serveAt[2]], TICKETS[k % TICKETS.length], 1.2, false, 0.22);
      if (!rail) R({ on: `${I}:fill:${j}`, match: { kind: String(k + 1) }, do: 'toggle', target: tk, to: true });
      R({ on: `${I}:fill:${j}`, match: { kind: String(k + 1) }, do: 'emit', type: `${I}:ordered:${k}` });
      if (!rail) { R({ on: `${I}:walk:${j}`, do: 'toggle', target: tk, to: false }); R({ on: `${I}:done:${j}:${k}`, do: 'toggle', target: tk, to: false }); }
    });
    // THE ORDER RAIL (`rail: true`): the ticket along the top of the screen while it is open, in its order's colour, what
    // it wants said, its bar the patience it has left (the shared state shown in one place, for every cook)
    if (rail) {
      const keeps = `${I}:r:${j}`;
      F.vars[keeps] = 0;
      R({ on: `${I}:fill:${j}`, do: 'set', var: keeps, to: patience });
      R({ on: tick, if: { var: o, gte: 1 }, do: 'inc', var: keeps, by: -STEP, min: 0 });
      kinds.forEach((K, k) => {
        const rid = `${W}-order-${j}-${k}`, gate = `ui-${rid}`;
        F.vars[gate] = 0;
        F.hud.push({ id: rid, var: keeps, label: `${K.name}: ${pieces(K.wants)}`, as: 'bar', max: patience, slot: 'top', color: TICKETS[k % TICKETS.length] });
        R({ on: `${I}:fill:${j}`, match: { kind: String(k + 1) }, do: 'set', var: gate, to: 1 });
        R({ on: `${I}:walk:${j}`, do: 'set', var: gate, to: 0 });
        R({ on: `${I}:done:${j}:${k}`, do: 'set', var: gate, to: 0 });
      });
    }
  }
  // (with the rail up, an order is seen arriving on it: no toast besides)
  if (!rail) kinds.forEach((K, k) => toast(`${I}:ordered:${k}`, `order: ${K.name} (${pieces(K.wants)})`, { ttl: 1.6 }));
  R({ on: `${I}:turned`, do: 'inc', var: missed, by: 1 });
  R({ on: `${I}:turned`, do: 'emit', type: 'work:walked' });
  toast('work:walked', 'an order walked out');

  // the hand-in: every ticket asked at once, each whose wants are all in the bag a candidate; the first candidate takes
  // the lock and is served, one order a press. A press that served none is said on the next tick
  const hid = `${W}-serve`, lock = `${I}:lock`, asked = `${I}:asked`;
  Object.assign(F.vars, { [lock]: 1, [asked]: 0 });
  zone(hid, serveAt, 'hand in an order');
  mark(`${hid}-counter`, serveAt, COLOR.serve, 0, true, 0.7);
  for (const H of HANDS) {
    R({ on: H.use(hid), do: 'set', var: lock, to: 0 });
    R({ on: H.use(hid), do: 'set', var: asked, to: 1 });
  }
  for (let j = 0; j < tickets; j++) {
    const o = `${I}:o:${j}`, age = `${I}:a:${j}`;
    kinds.forEach((K, k) => {
      const ask = `${I}:sv:${j}:${k}`, cand = `${I}:cand:${j}:${k}`, done = `${I}:done:${j}:${k}`, n = Object.values(K.wants).reduce((t, x) => t + x, 0);
      // each hand asks with what it holds; the one whose hands fill the order takes the lock (seated: then tears it as one)
      for (const H of HANDS) {
        const askH = `${ask}${H.sfx}`, candH = `${cand}${H.sfx}`, doneH = `${done}${H.sfx}`;
        R({ on: H.use(hid), if: { var: o, eq: k + 1 }, do: 'emit', type: askH });
        chain(F.reactions, askH, Object.entries(K.wants).map(([i, x]) => ({ var: heldVar(H.bag, i), gte: x })), candH, null);
        for (const i of Object.keys(K.wants)) F.vars[heldVar(H.bag, i)] ??= 0;
        R({ on: candH, if: { var: lock, eq: 0 }, do: 'emit', type: doneH });
        R({ on: candH, if: { var: lock, eq: 0 }, do: 'set', var: lock, to: 1 });
        // the wants leave the hands (each guarded by the chain above, so taken directly), the ticket is torn
        for (const [i, x] of Object.entries(K.wants)) R({ on: doneH, do: 'inc', var: heldVar(H.bag, i), by: -x, min: 0 });
        R({ on: doneH, do: 'inc', var: H.carry, by: -n, min: 0 });
        if (seated) R({ on: doneH, do: 'emit', type: done });
      }
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
    work: { card: C.id, goal, hands, tickets, heading, arrivals: arrivals.length, layout: { stations: Object.fromEntries(Object.keys(C.stations).map((s) => [s, slotsAt(s)])), crates: Object.fromEntries(raws.map((i) => [i, crateAt(i)])), shelves: Object.fromEntries(kept.map((i) => [i, shelfAt(i)])), serve: serveAt }, ...(seated ? { seats: HANDS.map((H) => ({ n: H.n, body: H.ent, hands: H.bag, carry: H.carry })) } : {}) },
  };
}
