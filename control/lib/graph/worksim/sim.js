/**
 * SHOVELS & BUCKETS: THE SIMULATOR. One session of a card played by a crew that works the way a competent player does,
 * stepped in quarter seconds with seeded arrivals, so the solver can measure what the closed form (analyze.js) cannot:
 * the queue at a hob, the order that walked out while the rice cooked, the pot that burned because both hands were busy.
 *
 * Each idle worker takes the first of, in order:
 *   1. a rescue      a finished output about to burn (bucket: collect)
 *   2. a hand-in     the open order due soonest whose wants are all on the shelf (bucket: serve)
 *   3. a collect     any finished output (bucket), so its station is free again
 *   4. a run         the station whose output the open orders (and the crew's prep) are short of, inputs on the shelf,
 *                    a slot free, the longest chain first (start the rice before chopping the fish)
 * FORESIGHT (crew.foresight, 0 to 1, default 1) is the player the session is measured against: at 1 the crew keeps made
 * ahead what the orders to come will want within each order's critical path (the farmer sows before the order, not
 * after); at 0 it only answers orders already open (a newcomer). A backlog is known whole, so it has none.
 * and is busy for the hop to it, the raw units fetched from their crates (bucket), and its work (the station's verb).
 * A station with a wait then runs alone: the worker is free while it does, and the slot holds until it is collected.
 *
 * The readout (one session):
 *   pressure    the crew's busy fraction (the measured ρ)
 *   missRate    orders lost (walked out, or served past their patience; a backlog's left at the end) ÷ orders closed
 *               (a backlog's regrowth stops a critical path before the bell, so the last gust is not a loss)
 *   slack       how much of its patience a served order had left, on average (1 at once, 0 at the bell)
 *   juggle      stations running alone or waiting to be collected, mean and peak: the multitasking the card asks for
 *   labour      seconds of shovel, bucket and travel the crew spent, and the shovel share
 *   burned, spoiled, overflow   outputs lost on their station, on the shelf to age, to a full shelf
 *   stations    each station's occupancy (busy slots ÷ slots)
 *
 *   simulate(card, { seed? (1) }) → the readout
 *
 * Deterministic: integer ticks (TPS a second), one seeded stream (mulberry32) for arrivals and their mix, the card's own
 * order for every tie.
 */
import { readCard, isRaw } from './card.js';
import { streamOf } from '../city/plan/dice.js';
import { pathOf } from './analyze.js';

export const TPS = 4;
const T = (s) => (s === Infinity ? Infinity : Math.round(s * TPS));
const BUSY = new Set(['work', 'wait', 'ready', 'take']);

function plan(C) {
  // items from the orders down (a product before its inputs), and each station's longest chain to a hand-in
  const post = [], seen = new Set();
  const dfs = (item) => {
    if (seen.has(item)) return; seen.add(item);
    const sid = C.producer[item];
    if (sid) for (const i of Object.keys(C.stations[sid].takes)) dfs(i);
    post.push(item);
  };
  for (const o of C.demand.orders) for (const i of Object.keys(o.wants)) dfs(i);
  for (const i of Object.keys(C.items)) dfs(i);
  const topo = post.reverse().filter((i) => !isRaw(C, i));
  const ids = Object.keys(C.stations);
  const memo = {};
  const down = (sid) => {
    if (memo[sid] !== undefined) return memo[sid];
    const item = C.stations[sid].item;
    memo[sid] = Math.max(0, ...ids.filter((t) => C.stations[t].takes[item]).map((t) => C.stations[t].work + C.stations[t].wait + down(t)));
    return memo[sid];
  };
  const crit = Object.fromEntries(ids.map((sid) => [sid, C.stations[sid].work + C.stations[sid].wait + down(sid)]));
  const byCrit = [...ids].sort((a, b) => crit[b] - crit[a] || ids.indexOf(a) - ids.indexOf(b));
  // foresight: what the orders to come will want within each one's critical path, kept made ahead (orders mode)
  const ahead = {};
  if (C.demand.mode === 'orders' && C.crew.foresight) {
    const wsum = C.demand.orders.reduce((t, o) => t + o.weight, 0);
    for (const o of C.demand.orders) {
      const expect = C.crew.foresight * (o.weight / wsum) * pathOf(C, o.wants) / C.demand.every;
      for (const [i, n] of Object.entries(o.wants)) ahead[i] = (ahead[i] ?? 0) + expect * n;
    }
    for (const i of Object.keys(ahead)) ahead[i] = Math.floor(ahead[i] + 0.5);
  }
  return { topo, byCrit, ahead };
}

export function simulate(card, { seed = 1 } = {}) {
  const C = card.producer ? card : readCard(card);
  const { topo, byCrit, ahead } = plan(C);
  const D = C.demand, end = T(C.session), dice = streamOf(seed, 'worksim', C.id);
  const stock = Object.fromEntries(topo.map((i) => [i, []]));
  const slots = Object.fromEntries(Object.entries(C.stations).map(([sid, s]) => [sid, Array.from({ length: s.slots }, () => ({ st: 'free', until: 0, readyAt: 0 }))]));
  const workers = Array.from({ length: C.crew.workers }, () => ({ until: 0, task: null }));
  const open = [];
  const R = { arrived: 0, served: 0, missed: 0, late: 0, burned: 0, spoiled: 0, overflow: 0, busy: 0, juggle: 0, peak: 0, slack: 0, labour: { shovel: 0, bucket: 0, travel: 0 }, occ: Object.fromEntries(Object.keys(C.stations).map((s) => [s, 0])) };
  const wsum = D.orders.reduce((t, o) => t + o.weight, 0);
  const pickOrder = () => { let u = dice() * wsum; for (const o of D.orders) { u -= o.weight; if (u < 0) return o; } return D.orders[D.orders.length - 1]; };
  const inRush = (tick) => D.rush && ((tick / TPS) % D.rush.period) < D.rush.length;
  const gap = (tick) => {
    const mean = D.every / (inRush(tick) ? D.rush.factor : 1), u = dice();
    return Math.max(1, T(D.cadence === 'steady' ? mean * (0.8 + 0.4 * u) : -Math.log(1 - u) * mean));
  };
  let seq = 0;
  const arrive = (tick) => {
    const o = pickOrder();
    open.push({ id: seq++, wants: o.wants, arrive: tick, deadline: D.mode === 'backlog' ? end : tick + T(D.patience), serving: false });
    R.arrived++;
  };
  if (D.mode === 'backlog') for (let k = 0; k < D.backlog; k++) arrive(0);
  // a backlog's regrowth stops once an order added could no longer be made by the bell (it would count as left undone)
  const last = D.mode === 'backlog' ? end - T(Math.max(...D.orders.map((o) => pathOf(C, o.wants)))) : end;
  let next = D.every ? T(D.first) : Infinity;

  const deposit = (item, n) => { for (let k = 0; k < n; k++) { if (stock[item].length < C.items[item].store) stock[item].push(t); else R.overflow++; } };
  const room = (item, n) => stock[item].length + n <= C.items[item].store;
  const hop = (s) => T(C.crew.travel + s.far);
  let t = 0;

  const choose = () => {
    // 1 + 3: finished outputs, the most urgent first
    const ready = [];
    for (const [sid, ss] of Object.entries(slots)) {
      const s = C.stations[sid];
      ss.forEach((sl, k) => { if (sl.st === 'ready' && room(s.item, s.batch)) ready.push({ sid, k, left: sl.readyAt + T(s.hold) - t }); });
    }
    ready.sort((a, b) => a.left - b.left);
    const rescue = ready.find((r) => r.left !== Infinity && r.left <= hop(C.stations[r.sid]) + T(C.stations[r.sid].collect) + T(3));
    const collect = (r) => {
      const s = C.stations[r.sid], sl = slots[r.sid][r.k];
      sl.st = 'take';
      R.labour.bucket += s.collect; R.labour.travel += C.crew.travel + s.far;
      return { kind: 'collect', sid: r.sid, k: r.k, d: hop(s) + T(s.collect) };
    };
    if (rescue) return collect(rescue);
    // 2: a hand-in, the shelf allotted by due time: an order due sooner keeps what it is short of from a later one (a
    // cabin's two frames are not taken one at a time by sheds)
    const have = Object.fromEntries(topo.map((i) => [i, stock[i].length]));
    let due = null;
    for (const o of open.filter((x) => !x.serving).sort((a, b) => a.deadline - b.deadline || a.id - b.id)) {
      if (Object.entries(o.wants).every(([i, n]) => have[i] >= n)) { due = o; break; }
      for (const [i, n] of Object.entries(o.wants)) have[i] -= Math.min(have[i], n);
    }
    if (due) {
      due.serving = true;
      for (const [i, n] of Object.entries(due.wants)) stock[i].splice(0, n);
      R.labour.bucket += D.serve; R.labour.travel += C.crew.travel + D.far;
      return { kind: 'serve', order: due, d: T(C.crew.travel + D.far + D.serve) };
    }
    if (ready.length) return collect(ready[0]);
    // 4: a run
    const want = {};
    for (const o of open) if (!o.serving) for (const [i, n] of Object.entries(o.wants)) want[i] = (want[i] ?? 0) + n;
    for (const i of topo) want[i] = (want[i] ?? 0) + C.items[i].prep + (ahead[i] ?? 0);
    const runs = {};
    for (const i of topo) {
      const sid = C.producer[i], s = C.stations[sid];
      const pipe = slots[sid].filter((sl) => BUSY.has(sl.st)).length * s.batch;
      const short = Math.max(0, want[i] - stock[i].length - pipe);
      if (!short) continue;
      runs[sid] = Math.ceil(short / s.batch);
      for (const [j, k] of Object.entries(s.takes)) if (!isRaw(C, j)) want[j] = (want[j] ?? 0) + runs[sid] * k;
    }
    for (const sid of byCrit) {
      if (!runs[sid]) continue;
      const s = C.stations[sid], k = slots[sid].findIndex((sl) => sl.st === 'free');
      if (k < 0) continue;
      if (!Object.entries(s.takes).every(([i, n]) => isRaw(C, i) || stock[i].length >= n)) continue;
      if (!s.wait && !room(s.item, s.batch * (1 + slots[sid].filter((sl) => sl.st === 'work').length))) continue;
      let fetch = 0;
      for (const [i, n] of Object.entries(s.takes)) { if (isRaw(C, i)) fetch += n * C.items[i].fetch; else stock[i].splice(0, n); }
      slots[sid][k].st = 'work';
      R.labour[s.verb] += s.work; R.labour.bucket += fetch; R.labour.travel += C.crew.travel + s.far;
      return { kind: 'run', sid, k, d: hop(s) + T(fetch) + T(s.work) };
    }
    return null;
  };

  const finish = (task) => {
    if (task.kind === 'serve') {
      const o = task.order, at = open.indexOf(o);
      open.splice(at, 1);
      if (t <= o.deadline) { R.served++; R.slack += (o.deadline - t) / Math.max(1, o.deadline - o.arrive); } else { R.missed++; R.late++; }
      return;
    }
    const s = C.stations[task.sid], sl = slots[task.sid][task.k];
    if (task.kind === 'run' && s.wait) { sl.st = 'wait'; sl.until = t + T(s.wait); return; }
    deposit(s.item, s.batch);
    sl.st = 'free';
  };

  for (t = 0; t <= end; t++) {
    for (const w of workers) if (w.task && w.until <= t) { finish(w.task); w.task = null; }
    for (const [sid, ss] of Object.entries(slots)) {
      const s = C.stations[sid];
      for (const sl of ss) {
        if (sl.st === 'wait' && sl.until <= t) { sl.st = 'ready'; sl.readyAt = t; }
        if (sl.st === 'ready' && t - sl.readyAt > T(s.hold)) { sl.st = 'free'; R.burned += s.batch; }
      }
    }
    for (const i of topo) { const sp = T(C.items[i].spoil); while (stock[i].length && stock[i][0] <= t - sp) { stock[i].shift(); R.spoiled++; } }
    while (next <= t && next <= last) { arrive(next); next += gap(next); }
    for (let k = open.length - 1; k >= 0; k--) if (!open[k].serving && open[k].deadline < t) { open.splice(k, 1); R.missed++; }
    for (const w of workers) if (!w.task) { const task = choose(); if (task) { w.task = task; w.until = t + Math.max(1, task.d); } }
    R.busy += workers.filter((w) => w.task).length;
    let j = 0;
    for (const [sid, ss] of Object.entries(slots)) {
      R.occ[sid] += ss.filter((sl) => sl.st !== 'free').length / ss.length;
      j += ss.filter((sl) => sl.st === 'wait' || sl.st === 'ready').length;
    }
    R.juggle += j; R.peak = Math.max(R.peak, j);
  }
  const pending = open.length;
  if (D.mode === 'backlog') R.missed += pending;
  const ticks = end + 1, closed = R.served + R.missed, sb = R.labour.shovel + R.labour.bucket;
  return {
    seed, arrived: R.arrived, served: R.served, missed: R.missed, late: R.late, pending: D.mode === 'backlog' ? 0 : pending,
    burned: R.burned, spoiled: R.spoiled, overflow: R.overflow,
    missRate: round(closed ? R.missed / closed : 0),
    pressure: round(R.busy / (C.crew.workers * ticks)),
    slack: round(R.served ? R.slack / R.served : 0),
    juggle: { mean: round(R.juggle / ticks), peak: R.peak },
    labour: { shovel: round(R.labour.shovel), bucket: round(R.labour.bucket), travel: round(R.labour.travel) },
    shovelShare: round(sb ? R.labour.shovel / sb : 0),
    perMinute: round(R.served / (C.session / 60)),
    stations: Object.fromEntries(Object.entries(R.occ).map(([s, v]) => [s, round(v / ticks)])),
  };
}

function round(v, d = 3) { const f = 10 ** d; return Math.round(v * f) / f; }
