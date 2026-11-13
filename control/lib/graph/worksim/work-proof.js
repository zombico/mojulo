/**
 * THE WORK PROOF (a machine gate, never the eyes'): a work level (game/work-mechanics.js) played on the bus the page
 * runs, by a walker that works the way the simulator's crew does (sim.js): it rescues what is about to burn, hands in an
 * order the bag can fill, takes off what is done, goes back to work it left, then starts the run the open orders are
 * short of, fetching its raw takes from their crates first. It walks straight between places at `speed`, presses E on
 * arriving (the page's use press), and stands at a station while it is worked. Each frame is the page's order: the
 * level's timers, the walker's zone facts, the bus, its watches.
 *
 * What it proves: the level can be won (or how far short it falls), by a player who knows the card; what the bell
 * found (served, lost, burned) beside what the simulator measures for the same card, one crew member, the same orders.
 * What it does not: the walls on a stage (the walk is straight), the hero's own speed and turning, a player who does not
 * know the card (the newcomer the simulator's foresight 0 stands for), the fun.
 *
 *   proveWork(params, { player?, spawn?, speed? (4 m/s), path? }) → { won, served, missed, burned, score, goal, seconds, sim, says }
 *     path(from, to) → [{ at, speed? }]: the way between two places when it is not straight (a room's climb: to the
 *     ladder, down it at its own speed, on to the place); absent, straight there at `speed`
 *
 * Pure: the bus is the same code the page runs; the orders are the card's roll.
 */
import { composeMechanics } from '../game/mechanics.js';
import { lowerWork, shelfPads } from '../game/work-mechanics.js';
import { buildBus } from '../worlds/event-bus.js';
import { readCard, isRaw } from './card.js';
import { simulate, runOrder, TPS } from './sim.js';
import { SCENARIOS } from './scenarios.js';

const B = buildBus();

export function proveWork(params = {}, { player = 'hero', spawn = [0, 0, 0], speed = 4, path = null } = {}) {
  const raw = params.card === undefined ? SCENARIOS.kitchen : typeof params.card === 'string' ? SCENARIOS[params.card] : params.card;
  const C = readCard(raw), meta = lowerWork(params, { i: 0, player, spawn }).work;
  const c = composeMechanics([{ kind: 'work', ...params }], { player, spawn, fall: 'none' });
  if (c.errors?.length) throw new Error(c.errors.join('; '));
  const ev = c.events, s = B.createBusState(ev, ev.entities), V = s.vars;
  const W = 'w0', I = `__${W}`, dt = 1 / TPS, L = meta.layout, hands = meta.hands;
  const bag = (i) => V[`held:bag:${i}`] ?? 0;
  const pump = (list) => { B.processEvents(s, list); let w = B.watchEvents(s); while (w.length) { B.processEvents(s, w); w = B.watchEvents(s); } };
  pump([]);

  const slots = Object.entries(C.stations).flatMap(([sid, st]) => L.stations[sid].map((at, k) => ({ sid, k, st, at, P: `${I}:${sid}:${k}`, use: `${W}-${sid}-${k}` })));
  const phase = (x) => V[x.P];
  // items from the orders down, as the simulator reads them
  const topo = [], seen = new Set();
  const dfs = (item) => { if (seen.has(item)) return; seen.add(item); for (const sid of C.producers[item] ?? []) for (const i of Object.keys(C.stations[sid].takes)) dfs(i); topo.push(item); };
  for (const o of C.demand.orders) for (const i of Object.keys(o.wants)) dfs(i);
  topo.reverse();
  const made = topo.filter((i) => !isRaw(C, i)), order = runOrder(C);
  const tickets = Array.from({ length: meta.tickets }, (_, j) => j);
  const open = () => tickets.map((j) => V[`${I}:o:${j}`]).filter((k) => k >= 1).map((k) => C.demand.orders[k - 1]);
  let pos = spawn.slice(), prev, task = null;
  // the way from here to a place: legs [{ at, speed? }] (a route through a climb, the room's), else straight there
  const legsTo = (at) => (path ? path(pos, at) : [{ at }]);
  const far = (at) => { let p0 = pos, t = 0; for (const g of legsTo(at)) { t += Math.hypot(g.at[0] - p0[0], g.at[1] - p0[1], g.at[2] - p0[2]) / (g.speed ?? speed); p0 = g.at; } return t; };

  const shelfOf = (i) => (L.shelves[i] ? V[`held:${W}-shelf-${i}:${i}`] ?? 0 : 0);
  const stock = (i) => bag(i) + shelfOf(i);
  const go = (at, use, stay) => ({ at, use, ...(stay ? { stay } : {}) });
  const pad = (i, k) => shelfPads(L.shelves[i], meta.heading)[k];
  const choose = () => {
    const room = hands - V[`${W}:carry`];
    // the hands kept free for what runs alone and will want taking off
    const owed = slots.filter((x) => x.st.wait && (phase(x) === 3 || phase(x) === 4)).reduce((t, x) => t + x.st.batch, 0);
    const done = slots.filter((x) => phase(x) === 4);
    const urgent = done.filter((x) => x.st.hold !== Infinity).sort((a, b) => (a.st.hold - V[`${a.P}:h`]) - (b.st.hold - V[`${b.P}:h`]));
    const wanted = new Set(open().flatMap((o) => Object.keys(o.wants)));
    // make room at a shelf: something held that has a shelf with space, what no order wants first
    const shelve = () => {
      const cap = (i) => (C.items[i].store === Infinity ? 4 : C.items[i].store);
      const held = Object.keys(L.shelves).filter((i) => bag(i) >= 1 && shelfOf(i) < cap(i)).sort((a, b) => wanted.has(a) - wanted.has(b));
      return held.length ? go(pad(held[0], 0), `${W}-shelf-${held[0]}-put`) : null;
    };
    const rescue = urgent.find((x) => x.st.hold - V[`${x.P}:h`] <= far(x.at) + 3);
    if (rescue) return rescue.st.batch <= room ? go(rescue.at, rescue.use) : shelve();
    const fits = open().find((o) => Object.entries(o.wants).every(([i, n]) => bag(i) >= n));
    if (fits) return go(L.serve, `${W}-serve`);
    // an order the shelves can complete: take what it lacks
    for (const o of open()) {
      if (!Object.entries(o.wants).every(([i, n]) => stock(i) >= n)) continue;
      const lack = Object.entries(o.wants).find(([i, n]) => bag(i) < n);
      if (lack && room >= 1) return go(pad(lack[0], 1), `${W}-shelf-${lack[0]}-take`);
    }
    const take = done.find((x) => x.st.batch <= room);
    if (take) return go(take.at, take.use);
    if (done.length) { const sh = shelve(); if (sh) return sh; }
    const left = slots.find((x) => phase(x) === 1);
    if (left) return go(left.at, left.use, left);
    // short of: the open orders' wants, less the stock and what the stations hold or are making, through the preferred route
    const want = {};
    for (const o of open()) for (const [i, n] of Object.entries(o.wants)) want[i] = (want[i] ?? 0) + n;
    const short = {};
    for (const i of made) {
      const pipe = slots.filter((x) => x.st.item === i && phase(x) >= 1).reduce((t, x) => t + x.st.batch, 0);
      short[i] = Math.max(0, (want[i] ?? 0) - stock(i) - pipe);
      if (!short[i]) continue;
      const st = C.stations[C.producer[i]], runs = Math.ceil(short[i] / st.batch);
      for (const [j, k] of Object.entries(st.takes)) if (!isRaw(C, j)) want[j] = (want[j] ?? 0) + runs * k;
    }
    const free = room - owed;
    const cands = slots.filter((x) => phase(x) === 0 && short[x.st.item])
      .sort((a, b) => order.indexOf(a.sid) - order.indexOf(b.sid) || far(a.at) - far(b.at));
    let hands_ = false;
    for (const x of cands) {
      const takes = Object.entries(x.st.takes);
      if (takes.some(([i, n]) => !isRaw(C, i) && stock(i) < n)) continue;
      // what a run with no wait makes comes into the hands: room for it once its takes are spent
      const net = (x.st.wait ? 0 : x.st.batch) - takes.reduce((t, [, n]) => t + n, 0);
      const lack = takes.filter(([i, n]) => bag(i) < n);
      if (!lack.length) { if (net <= free) return go(x.at, x.use, x); hands_ = true; continue; }
      const need = lack.reduce((t, [i, n]) => t + n - bag(i), 0);
      if (need > free) { hands_ = true; continue; }
      const [i] = lack[0];
      return isRaw(C, i) ? go(L.crates[i], `${W}-crate-${i}`) : go(pad(i, 1), `${W}-shelf-${i}-take`);
    }
    // a run the hands alone block: shelve what is held, what that run does not take first
    return hands_ ? shelve() : null;
  };

  const end = Math.ceil(C.session / dt) + 4;
  let f = 0;
  for (; f < end; f++) {
    pump(B.tickTimers(s, dt));
    if (s.log.some((r) => r.type === 'work:won' || r.type === 'work:lost')) break;
    if (!task) { task = choose(); if (task) task.legs = legsTo(task.at); }
    if (task) {
      // along the legs, each at its own speed (a climb's, else the walker's), the last stopping short at the place
      let budget = dt, d = 0;
      while (budget > 0 && task.legs.length) {
        const g = task.legs[0], last = task.legs.length === 1, v = g.speed ?? speed;
        const gap = Math.hypot(g.at[0] - pos[0], g.at[1] - pos[1], g.at[2] - pos[2]), stop = last ? 0.3 : 0;
        if (gap <= stop + 1e-9) { if (last) break; task.legs.shift(); continue; }
        const m = Math.min(gap - stop, v * budget);
        pos = pos.map((x, k) => x + ((g.at[k] - x) / gap) * m);
        budget -= m / v;
        if (!last && m >= gap - 1e-9) task.legs.shift();
      }
      d = Math.hypot(task.at[0] - pos[0], task.at[1] - pos[1], task.at[2] - pos[2]);
      const z = B.deriveZoneEvents([{ id: player, position: pos }], prev, ev.sources);
      prev = z.prev; pump(z.events);
      if (d <= 0.3 + 1e-6) {
        if (!task.pressed) { pump([{ type: `use-${task.use}` }]); task.pressed = true; if (!task.stay || phase(task.stay) !== 2) task = null; }
        else if (phase(task.stay) !== 2) task = null;
      }
    }
  }
  const won = s.log.some((r) => r.type === 'work:won');
  // the simulator on the same card and orders, one crew member (the level's one walker), the bag its only shelf
  const solo = { ...raw, crew: { ...(raw.crew ?? {}), workers: 1 } };
  const sim = simulate(solo, { seed: params.seed ?? 1 });
  const out = { won, served: V[`${W}:served`], missed: V[`${W}:missed`], burned: V[`${W}:burned`], score: V[`${W}:score`], goal: meta.goal, seconds: Math.round(f * dt), arrivals: meta.arrivals };
  return {
    ...out, sim: { served: sim.served, missed: sim.missed, burned: sim.burned },
    says: `${won ? 'won' : 'lost'}: ${out.served} of ${out.arrivals} served (goal ${out.goal}), ${out.missed} lost, ${out.burned} burned; the simulator, one hand: ${sim.served} served, ${sim.missed} lost`,
  };
}
