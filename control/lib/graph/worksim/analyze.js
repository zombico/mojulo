/**
 * SHOVELS & BUCKETS: THE CLOSED FORM. Before a minute is simulated, a card's numbers already say most of its difficulty.
 * A work sim is a network of queues: orders arrive at a rate, each costs a known amount of labour and of station time,
 * and a queue's wait blows up as its load nears one. So the readout is loads:
 *
 *   labour per order   the seconds of hands each order costs, split shovel | bucket | travel (the game's character:
 *                      a kitchen near even, a farm shovel-heavy, a chore travel-heavy)
 *   crew load          ρ = labour × arrival rate ÷ workers: the fraction of the crew's time the demand asks for
 *   station load       a station's occupancy (work, its wait, until collected) × arrival rate ÷ its slots
 *   bottleneck         the highest load: the crew (hands are short) or a station (hobs are short)
 *   critical path      the fewest seconds an order can be made in, one worker, no queue: the floor under patience
 *
 * An item with several routes (card.js) is read through its preferred, the cheapest; `routes` says each one's labour a unit.
 *
 * It ignores queueing (two orders wanting one hob), dispatch and travel order, so it reads low under pressure; the
 * simulator (sim.js) measures what it cannot. The solver (solve.js) starts from it.
 *
 *   labourOf(C, wants)   → { shovel, bucket, travel, occ: { <station>: seconds }, total }
 *   pathOf(C, wants)     → seconds: the critical path of one order
 *   analyze(card)        → { perOrder: [...], labour, rate, crew, stations, bottleneck, criticalPath, headroom, shovelShare, everyFor(ρ) }
 *
 * Pure, no dice.
 */
import { readCard, isRaw } from './card.js';

const add = (a, b) => { for (const [k, v] of Object.entries(b)) a[k] = (a[k] ?? 0) + v; return a; };

export function labourOf(C, wants) {
  const acc = { shovel: 0, bucket: 0, travel: 0, occ: {} };
  const need = (item, n) => {
    if (isRaw(C, item)) { acc.bucket += n * C.items[item].fetch; return; }
    const sid = C.producer[item], s = C.stations[sid], runs = n / s.batch, hop = C.crew.travel + s.far;
    acc[s.verb] += runs * s.work;
    acc.travel += runs * hop;
    if (s.wait) { acc.bucket += runs * s.collect; acc.travel += runs * hop; }
    add(acc.occ, { [sid]: runs * (s.work + s.wait + (s.wait ? s.collect : 0)) });
    for (const [i, k] of Object.entries(s.takes)) need(i, runs * k);
  };
  for (const [item, n] of Object.entries(wants)) need(item, n);
  acc.bucket += C.demand.serve;
  acc.travel += C.crew.travel + C.demand.far;
  acc.total = acc.shovel + acc.bucket + acc.travel;
  return acc;
}

export function pathOf(C, wants) {
  const path = (item, n) => {
    if (isRaw(C, item)) return 0;
    const s = C.stations[C.producer[item]], runs = Math.ceil(n / s.batch), hop = C.crew.travel + s.far;
    const fetch = Object.entries(s.takes).reduce((t, [i, k]) => t + (isRaw(C, i) ? k * C.items[i].fetch : 0), 0);
    const before = Math.max(0, ...Object.entries(s.takes).map(([i, k]) => path(i, runs * k)));
    const cycle = hop + fetch + s.work + s.wait + (s.wait ? hop + s.collect : 0);
    return before + Math.ceil(runs / s.slots) * cycle;
  };
  return Math.max(...Object.entries(wants).map(([i, n]) => path(i, n))) + C.crew.travel + C.demand.far + C.demand.serve;
}

/** Orders a second, averaged over the session (a rush's extra and a backlog's standing job included). */
export function rateOf(C) {
  const D = C.demand, r = D.rush ? 1 + (D.rush.factor - 1) * (D.rush.length / D.rush.period) : 1;
  const flow = D.every ? r / D.every : 0;
  return D.mode === 'backlog' ? D.backlog / C.session + flow : flow;
}

export function analyze(card) {
  const C = card.producer ? card : readCard(card);
  const wsum = C.demand.orders.reduce((t, o) => t + o.weight, 0);
  const perOrder = C.demand.orders.map((o) => {
    const l = labourOf(C, o.wants);
    return { name: o.name, share: o.weight / wsum, labour: round(l.total), shovel: round(l.shovel), bucket: round(l.bucket), travel: round(l.travel), path: round(pathOf(C, o.wants)), occ: l.occ };
  });
  const mean = (f) => perOrder.reduce((t, o) => t + o.share * f(o), 0);
  const labour = { shovel: mean((o) => o.shovel), bucket: mean((o) => o.bucket), travel: mean((o) => o.travel) };
  labour.total = labour.shovel + labour.bucket + labour.travel;
  const rate = rateOf(C);
  const crew = labour.total * rate / C.crew.workers;
  const stations = {};
  for (const [sid, s] of Object.entries(C.stations)) stations[sid] = round(mean((o) => o.occ[sid] ?? 0) * rate / s.slots);
  const top = Object.entries(stations).sort((a, b) => b[1] - a[1])[0];
  const bottleneck = top && top[1] > crew ? { at: top[0], load: top[1], kind: 'station' } : { at: 'crew', load: round(crew), kind: 'crew' };
  const criticalPath = Math.max(...perOrder.map((o) => o.path));
  return {
    perOrder: perOrder.map(({ occ, ...o }) => o),
    labour: Object.fromEntries(Object.entries(labour).map(([k, v]) => [k, round(v)])),
    shovelShare: round(labour.shovel / Math.max(1e-9, labour.shovel + labour.bucket)),
    rate: round(rate, 4), crew: round(crew), stations, bottleneck, criticalPath,
    routes: C.routes,
    headroom: C.demand.patience === null ? null : round(C.demand.patience - criticalPath),
    // the mean seconds between orders that would load the crew to ρ (orders mode; the rush's extra kept)
    everyFor: (rho) => {
      const D = C.demand, r = D.rush ? 1 + (D.rush.factor - 1) * (D.rush.length / D.rush.period) : 1;
      return labour.total * r / (C.crew.workers * rho);
    },
  };
}

function round(v, d = 3) { const f = 10 ** d; return Math.round(v * f) / f; }
