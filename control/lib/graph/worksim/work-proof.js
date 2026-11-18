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
 *   proveWork(params, { player?, spawn?, speed? (4 m/s), path?, cooks? }) → { won, served, missed, burned, score, goal, seconds, sim, says, cooks? }
 *     path(from, to) → [{ at, speed? }]: the way between two places when it is not straight (a room's climb: to the
 *     ladder, down it at its own speed, on to the place); absent, straight there at `speed`
 *     cooks: [{ spawn?, reach?(at) → bool }]: SEVERAL COOKS, the level seated (the mechanic's ctx.seats), cook 1 the
 *     pilot and cook n the seat-n body `<player>-<n>`. Each works the same policy with its own hands, at the places its
 *     reach allows (absent: every place), never on a slot another cook is bound for; a made thing it holds that nothing
 *     it can reach takes goes on the PASS (its shelf's put pad, when it can reach that), and is taken up from the other
 *     side. The readout adds each cook's `{ n, presses, put, took, served, outside }` (outside: presses at a place out
 *     of its reach, always 0) and `passed`: what went across a shelf from one cook to another
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

export function proveWork(params = {}, { player = 'hero', spawn = [0, 0, 0], speed = 4, path = null, cooks = null } = {}) {
  const raw = params.card === undefined ? SCENARIOS.kitchen : typeof params.card === 'string' ? SCENARIOS[params.card] : params.card;
  const crew = Array.isArray(cooks) && cooks.length ? cooks.slice(0, 4) : [{ spawn }];
  const seats = crew.length > 1 ? crew.slice(1).map((_, k) => `${player}-${k + 2}`) : null;
  const ctx = { player, spawn, ...(seats ? { seats } : {}) };
  const C = readCard(raw), meta = lowerWork(params, { i: 0, ...ctx }).work;
  const c = composeMechanics([{ kind: 'work', ...params }], { ...ctx, fall: 'none' });
  if (c.errors?.length) throw new Error(c.errors.join('; '));
  const ev = c.events, s = B.createBusState(ev, ev.entities), V = s.vars;
  const W = 'w0', I = `__${W}`, dt = 1 / TPS, L = meta.layout, hands = meta.hands;
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
  const shelfOf = (i) => (L.shelves[i] ? V[`held:${W}-shelf-${i}:${i}`] ?? 0 : 0);
  const pad = (i, k) => shelfPads(L.shelves[i], meta.heading)[k];

  // THE COOKS: cook 1 the pilot (the bag, `use-…`), cook n the seat-n body (`hands<n>`, `s<n>:use-…`)
  const cookOf = (k, d) => {
    const n = k + 1, id = n === 1 ? player : `${player}-${n}`, holder = n === 1 ? 'bag' : `hands${n}`;
    return { n, id, pos: (d.spawn ?? spawn).slice(), task: null, reach: typeof d.reach === 'function' ? d.reach : () => true, carry: n === 1 ? `${W}:carry` : `${W}:carry:${n}`, bag: (i) => V[`held:${holder}:${i}`] ?? 0, press: (use) => (n === 1 ? `use-${use}` : `s${n}:use-${use}`), log: { n, presses: 0, put: 0, took: 0, served: 0, outside: 0 } };
  };
  const all = crew.map((d, k) => cookOf(k, d));
  const heldAll = (i) => all.reduce((t, x) => t + x.bag(i), 0);
  const passed = {};

  function choose(K) {
    const bag = K.bag, pos = K.pos, can = (at) => K.reach(at);
    const legsTo = (at) => (path ? path(pos, at) : [{ at }]);
    const far = (at) => { let p0 = pos, t = 0; for (const g of legsTo(at)) { t += Math.hypot(g.at[0] - p0[0], g.at[1] - p0[1], g.at[2] - p0[2]) / (g.speed ?? speed); p0 = g.at; } return t; };
    // (a slot another cook is bound for is theirs)
    const bound = new Set(all.filter((x) => x !== K && x.task).map((x) => x.task.use));
    const mine = slots.filter((x) => can(x.at) && !bound.has(x.use));
    const stock = (i) => bag(i) + shelfOf(i);
    const go = (at, use, stay) => ({ at, use, ...(stay ? { stay } : {}) });
    const room = hands - V[K.carry];
    // the hands kept free for what runs alone and will want taking off
    const owed = mine.filter((x) => x.st.wait && (phase(x) === 3 || phase(x) === 4)).reduce((t, x) => t + x.st.batch, 0);
    const done = mine.filter((x) => phase(x) === 4);
    const urgent = done.filter((x) => x.st.hold !== Infinity).sort((a, b) => (a.st.hold - V[`${a.P}:h`]) - (b.st.hold - V[`${b.P}:h`]));
    const wanted = new Set(open().flatMap((o) => Object.keys(o.wants)));
    const cap = (i) => (C.items[i].store === Infinity ? 4 : C.items[i].store);
    // make room at a shelf: something held that has a shelf with space, what no order wants first
    const shelve = () => {
      const held = Object.keys(L.shelves).filter((i) => bag(i) >= 1 && shelfOf(i) < cap(i) && can(pad(i, 0))).sort((a, b) => wanted.has(a) - wanted.has(b));
      return held.length ? go(pad(held[0], 0), `${W}-shelf-${held[0]}-put`) : null;
    };
    const rescue = urgent.find((x) => x.st.hold - V[`${x.P}:h`] <= far(x.at) + 3);
    if (rescue) return rescue.st.batch <= room ? go(rescue.at, rescue.use) : shelve();
    // THE PASS: a made thing held that nothing this cook can reach takes (no station it can stand at, not the hand-in) goes
    // on its shelf from this side, for a cook on the other to take up
    const usable = (i) => mine.some((x) => x.st.takes[i]) || (can(L.serve) && C.demand.orders.some((o) => o.wants[i]));
    const across = made.find((i) => bag(i) >= 1 && !usable(i) && L.shelves[i] && shelfOf(i) < cap(i) && can(pad(i, 0)));
    if (across) return go(pad(across, 0), `${W}-shelf-${across}-put`);
    const fits = can(L.serve) && open().find((o) => Object.entries(o.wants).every(([i, n]) => bag(i) >= n));
    if (fits) return go(L.serve, `${W}-serve`);
    // an order the shelves can complete: take what it lacks
    for (const o of open()) {
      if (!Object.entries(o.wants).every(([i, n]) => stock(i) >= n)) continue;
      const lack = Object.entries(o.wants).find(([i, n]) => bag(i) < n);
      if (lack && room >= 1 && can(pad(lack[0], 1))) return go(pad(lack[0], 1), `${W}-shelf-${lack[0]}-take`);
    }
    const take = done.find((x) => x.st.batch <= room);
    if (take) return go(take.at, take.use);
    if (done.length) { const sh = shelve(); if (sh) return sh; }
    const left = mine.find((x) => phase(x) === 1);
    if (left) return go(left.at, left.use, left);
    // short of: the open orders' wants, less the stock (every cook's hands and the shelves) and what the stations hold or
    // are making, through the preferred route
    const want = {};
    for (const o of open()) for (const [i, n] of Object.entries(o.wants)) want[i] = (want[i] ?? 0) + n;
    const short = {};
    for (const i of made) {
      const pipe = slots.filter((x) => x.st.item === i && phase(x) >= 1).reduce((t, x) => t + x.st.batch, 0);
      short[i] = Math.max(0, (want[i] ?? 0) - heldAll(i) - shelfOf(i) - pipe);
      if (!short[i]) continue;
      const st = C.stations[C.producer[i]], runs = Math.ceil(short[i] / st.batch);
      for (const [j, k] of Object.entries(st.takes)) if (!isRaw(C, j)) want[j] = (want[j] ?? 0) + runs * k;
    }
    const free = room - owed;
    const cands = mine.filter((x) => phase(x) === 0 && short[x.st.item])
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
      const from = isRaw(C, i) ? L.crates[i] : pad(i, 1);
      if (!can(from)) continue;
      return isRaw(C, i) ? go(L.crates[i], `${W}-crate-${i}`) : go(pad(i, 1), `${W}-shelf-${i}-take`);
    }
    // a run the hands alone block: shelve what is held, what that run does not take first
    return hands_ ? shelve() : null;
  }

  // a cook along its legs, each at its own speed (a climb's, else the walker's), the last stopping short at the place
  const walk = (K) => {
    const task = K.task;
    let budget = dt;
    while (budget > 0 && task.legs.length) {
      const g = task.legs[0], last = task.legs.length === 1, v = g.speed ?? speed;
      const gap = Math.hypot(g.at[0] - K.pos[0], g.at[1] - K.pos[1], g.at[2] - K.pos[2]), stop = last ? 0.3 : 0;
      if (gap <= stop + 1e-9) { if (last) break; task.legs.shift(); continue; }
      const m = Math.min(gap - stop, v * budget);
      K.pos = K.pos.map((x, k) => x + ((g.at[k] - x) / gap) * m);
      budget -= m / v;
      if (!last && m >= gap - 1e-9) task.legs.shift();
    }
  };
  // what a press did, by the cook who pressed it: put down or took up a shelf's item, served (the pass is read off them)
  const said = (K, use, before) => {
    const put = /-shelf-(.+)-put$/.exec(use), get = /-shelf-(.+)-take$/.exec(use);
    if (put && shelfOf(put[1]) > before.shelf) { K.log.put++; (passed[put[1]] ??= { put: {}, took: {} }).put[K.n] = (passed[put[1]].put[K.n] ?? 0) + 1; }
    if (get && shelfOf(get[1]) < before.shelf) { K.log.took++; (passed[get[1]] ??= { put: {}, took: {} }).took[K.n] = (passed[get[1]].took[K.n] ?? 0) + 1; }
    if (use === `${W}-serve` && V[`${W}:served`] > before.served) K.log.served += V[`${W}:served`] - before.served;
  };
  const placeOf = (K) => K.task.at;

  const end = Math.ceil(C.session / dt) + 4;
  let f = 0, prev;
  for (; f < end; f++) {
    pump(B.tickTimers(s, dt));
    if (s.log.some((r) => r.type === 'work:won' || r.type === 'work:lost')) break;
    for (const K of all) {
      if (!K.task) { K.task = choose(K); if (K.task) K.task.legs = (path ? path(K.pos, K.task.at) : [{ at: K.task.at }]); }
      if (K.task) walk(K);
    }
    // every cook's zone facts at once, the page's order: the bodies, then the bus
    const z = B.deriveZoneEvents(all.map((K) => ({ id: K.id, position: K.pos })), prev, ev.sources);
    prev = z.prev; pump(z.events);
    for (const K of all) {
      const task = K.task;
      if (!task) continue;
      const d = Math.hypot(task.at[0] - K.pos[0], task.at[1] - K.pos[1], task.at[2] - K.pos[2]);
      if (d > 0.3 + 1e-6) continue;
      if (!task.pressed) {
        if (!K.reach(placeOf(K))) K.log.outside++;
        const sh = /-shelf-(.+)-(put|take)$/.exec(task.use), before = { shelf: sh ? shelfOf(sh[1]) : 0, served: V[`${W}:served`] };
        pump([{ type: K.press(task.use) }]); K.log.presses++; task.pressed = true;
        said(K, task.use, before);
        if (!task.stay || phase(task.stay) !== 2) K.task = null;
      } else if (phase(task.stay) !== 2) K.task = null;
    }
  }
  const won = s.log.some((r) => r.type === 'work:won');
  // the simulator on the same card and orders, one crew member (the level's one walker), the bag its only shelf
  const solo = { ...raw, crew: { ...(raw.crew ?? {}), workers: 1 } };
  const sim = simulate(solo, { seed: params.seed ?? 1 });
  const out = { won, served: V[`${W}:served`], missed: V[`${W}:missed`], burned: V[`${W}:burned`], score: V[`${W}:score`], goal: meta.goal, seconds: Math.round(f * dt), arrivals: meta.arrivals };
  // across the pass: an item put down by one cook and taken up by another, the lesser of the two counts
  const across = Object.fromEntries(Object.entries(passed).map(([i, x]) => {
    const n = all.reduce((t, a) => t + all.reduce((u, b) => u + (a !== b ? Math.min(x.put[a.n] ?? 0, x.took[b.n] ?? 0) : 0), 0), 0);
    return [i, n];
  }).filter(([, n]) => n > 0));
  return {
    ...out, sim: { served: sim.served, missed: sim.missed, burned: sim.burned },
    says: `${won ? 'won' : 'lost'}: ${out.served} of ${out.arrivals} served (goal ${out.goal}), ${out.missed} lost, ${out.burned} burned; the simulator, one hand: ${sim.served} served, ${sim.missed} lost`,
    ...(seats ? { cooks: all.map((K) => K.log), passed: across } : {}),
  };
}
