/**
 * SHOVELS & BUCKETS: THE SOLVER. Difficulty in a work sim is three families of levers (capacity, output, demand: card.js
 * LEVERS) and nothing else, so tuning one is a search over them toward a target the designer names: a preset (beginner,
 * intermediate, advanced) or a challenge number from 0 to 1 between them. A target is a SHAPE of demand (how even the
 * orders come, the rushes, how complex the mix, how patient) and BANDS of what a session measures:
 *
 *   pressure   the crew's busy fraction: how much of the time the hands are wanted
 *   miss       orders lost ÷ orders closed: how often the player falls short
 *   juggle     stations running alone at once, on average: the multitasking asked for (advised, no lever moves it)
 *   slack      how much of its patience a served order had left: the room to recover
 *
 * The search, in order, each move recorded with its lever, family and reason:
 *   1. the demand's shape is set from the target (cadence, rush, the mix by labour, patience as a multiple of the mix's
 *      critical path: a beginner's order waits three times as long as it takes to make)
 *   2. the rate is solved for the pressure band's middle (orders: demand.every by bisection from the closed form's
 *      estimate; a backlog: its size), measured on the simulator over several seeds
 *   3. the miss band is met: too many lost → a slot at a station that is full (capacity), else more patience (demand),
 *      or for a backlog a better tool at the busiest shovel (output); too few → less patience, or more regrowth
 *   4. 2 and 3 again until both hold or the rounds run out: then the closest is returned, said, never refused
 *
 * THE PLAYER. Difficulty is measured against someone: a target names its player as the crew's foresight (sim.js), a
 * beginner's a newcomer who answers open orders only (0), an advanced's an expert who makes ahead what is coming (1).
 * It is not a lever (it is who plays), so it is set on the card, never a move.
 *
 * Machine gate only: the solver measures challenge. Whether it is fun at that challenge is the eyes gate's (someone plays).
 *
 *   PRESETS                    the three targets
 *   targetOf(name | number)    → the target (a number interpolates the presets)
 *   measure(card, seeds)       → the simulator's readout averaged over seeds
 *   solve(card, target?, { seeds?, rounds? }) → { id, target, card, moves, metrics, analysis, holds, verdict, says }
 *
 * Deterministic: the simulator's seeds, the card's own order.
 */
import { readCard } from './card.js';
import { analyze } from './analyze.js';
import { simulate } from './sim.js';

export const PRESETS = Object.freeze({
  beginner: {
    challenge: 0, foresight: 0, cadence: 'steady', rush: null, patience: 3, mix: 'simple',
    bands: { pressure: [0.45, 0.65], miss: [0, 0.05], juggle: [0, 1], slack: [0.4, 1] },
    says: 'measured against a newcomer (answers open orders only): orders on an even beat, the simpler half of the menu, three times the time to make each, hands busy about half the time, almost nothing lost',
  },
  intermediate: {
    challenge: 0.5, foresight: 0.5, cadence: 'random', rush: { period: 90, length: 20, factor: 1.5 }, patience: 2, mix: 'most',
    bands: { pressure: [0.65, 0.82], miss: [0.03, 0.15], juggle: [0, 2], slack: [0.2, 1] },
    says: 'measured against a player who makes some ahead: orders when they come, a mild rush now and then, all but the hardest dish, twice the time to make each, hands mostly busy, a few lost',
  },
  advanced: {
    challenge: 1, foresight: 1, cadence: 'random', rush: { period: 60, length: 20, factor: 2 }, patience: 1.4, mix: 'all',
    bands: { pressure: [0.82, 0.97], miss: [0.08, 0.25], juggle: [0, 3], slack: [0, 1] },
    says: 'measured against an expert who makes ahead what is coming: the whole menu, rushes at twice the rate, little more time than it takes to make each, hands nearly always busy',
  },
});
const ORDER = ['beginner', 'intermediate', 'advanced'];
const lerp = (a, b, f) => a + (b - a) * f;

export function targetOf(t = 'intermediate') {
  if (typeof t === 'string') {
    if (!PRESETS[t]) throw new Error(`worksim target is a preset (${ORDER.join(', ')}) or a challenge from 0 to 1`);
    return { name: t, ...PRESETS[t] };
  }
  if (!(Number.isFinite(t) && t >= 0 && t <= 1)) throw new Error('worksim challenge is a number from 0 (beginner) to 1 (advanced)');
  const [a, b] = t <= 0.5 ? [PRESETS.beginner, PRESETS.intermediate] : [PRESETS.intermediate, PRESETS.advanced];
  const f = t <= 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  const band = (k) => [lerp(a.bands[k][0], b.bands[k][0], f), lerp(a.bands[k][1], b.bands[k][1], f)].map((v) => Math.round(v * 1000) / 1000);
  const ra = a.rush ?? { period: b.rush.period, length: b.rush.length, factor: 1 };
  const rush = { period: Math.round(lerp(ra.period, b.rush.period, f)), length: Math.round(lerp(ra.length, b.rush.length, f)), factor: Math.round(lerp(ra.factor, b.rush.factor, f) * 100) / 100 };
  return {
    name: `challenge ${t}`, challenge: t, foresight: Math.round(lerp(a.foresight, b.foresight, f) * 100) / 100, cadence: t < 0.25 ? 'steady' : 'random', rush: rush.factor > 1 ? rush : null,
    patience: Math.round(lerp(a.patience, b.patience, f) * 100) / 100, mix: t < 1 / 3 ? 'simple' : t < 2 / 3 ? 'most' : 'all',
    bands: { pressure: band('pressure'), miss: band('miss'), juggle: band('juggle'), slack: band('slack') },
    says: `between ${t <= 0.5 ? 'beginner and intermediate' : 'intermediate and advanced'}`,
  };
}

export function measure(card, seeds = [1, 2, 3]) {
  const runs = seeds.map((seed) => simulate(card, { seed }));
  const avg = (f) => Math.round(runs.reduce((t, r) => t + f(r), 0) / runs.length * 1000) / 1000;
  const stations = {};
  for (const k of Object.keys(runs[0].stations)) stations[k] = avg((r) => r.stations[k]);
  return {
    seeds, pressure: avg((r) => r.pressure), miss: avg((r) => r.missRate), slack: avg((r) => r.slack),
    juggle: avg((r) => r.juggle.mean), jugglePeak: Math.max(...runs.map((r) => r.juggle.peak)),
    served: avg((r) => r.served), missed: avg((r) => r.missed), burned: avg((r) => r.burned), spoiled: avg((r) => r.spoiled + r.overflow),
    shovelShare: avg((r) => r.shovelShare), perMinute: avg((r) => r.perMinute), stations,
  };
}

const inBand = (v, [lo, hi], tol = 0) => v >= lo - tol && v <= hi + tol;
const clone = (v) => JSON.parse(JSON.stringify(v));

export function solve(card, target = 'intermediate', { seeds = [1, 2, 3], rounds = 6 } = {}) {
  const P = targetOf(target);
  readCard(card);                                  // the card as written must read before it is tuned
  const K = clone(card), moves = [];
  const set = (path, to, family, because) => {
    const keys = path.split('.'), last = keys.pop();
    let o = K; for (const k of keys) o = o[k] ??= {};
    const from = o[last];
    if (JSON.stringify(from) === JSON.stringify(to)) return;
    o[last] = to;
    moves.push({ lever: path, family, from: from ?? null, to, because });
  };
  const backlog = (K.demand.mode ?? 'orders') === 'backlog';
  // the player the session is measured against (not a lever: who plays it)
  (K.crew ??= {}).foresight = P.foresight;

  // 1. the demand's shape
  set('demand.cadence', P.cadence, 'demand', P.cadence === 'steady' ? 'an even beat a beginner can learn' : 'orders when they come');
  const session = K.session ?? 240;
  const rush = P.rush && (backlog ? K.demand.every : true) ? { ...P.rush, period: Math.min(P.rush.period, Math.round(session / 3)) } : null;
  if (rush) set('demand.rush', rush, 'demand', `for ${rush.length}s in every ${rush.period}s the orders come ${rush.factor} times as often`);
  else if (K.demand.rush) set('demand.rush', null, 'demand', 'no rushes at this challenge');
  const ranked = analyze(K).perOrder.map((o, j) => ({ j, labour: o.labour })).sort((a, b) => a.labour - b.labour || a.j - b.j);
  const n = ranked.length, keep = P.mix === 'simple' ? Math.ceil(n / 2) : P.mix === 'most' ? (n > 2 ? n - 1 : n) : n;
  if (keep < n) {
    const kept = new Set(ranked.slice(0, keep).map((r) => r.j));
    set('demand.orders', K.demand.orders.filter((_, j) => kept.has(j)), 'demand', `the ${keep} least laborious of ${n} orders (${P.mix})`);
  }
  const cp = () => analyze(K).criticalPath;
  if (!backlog) set('demand.patience', Math.ceil(cp() * P.patience), 'demand', `${P.patience} × the mix's critical path (${cp()}s)`);

  // 2. the rate for the pressure band's middle
  const mid = (P.bands.pressure[0] + P.bands.pressure[1]) / 2;
  const solveRate = () => {
    if (!backlog) {
      const est = analyze(K).everyFor(mid);
      let lo = Math.max(0.5, est / 5), hi = est * 5, best = null;
      for (let k = 0; k < 14; k++) {
        const e = Math.sqrt(lo * hi), m = measure({ ...K, demand: { ...K.demand, every: e } }, seeds);
        if (!best || Math.abs(m.pressure - mid) < Math.abs(best.m.pressure - mid)) best = { e, m };
        if (m.pressure > mid) lo = e; else hi = e;
      }
      set('demand.every', Math.round(best.e * 2) / 2, 'demand', `the pace that keeps the hands busy ${Math.round(mid * 100)}% of the time`);
    } else {
      const per = analyze(K).labour.total, workers = K.crew?.workers ?? 1;
      let lo = 1, hi = Math.max(2, Math.ceil(session * workers / per * 2)), best = null;
      while (lo <= hi) {
        const b = Math.floor((lo + hi) / 2), m = measure({ ...K, demand: { ...K.demand, backlog: b } }, seeds);
        if (!best || Math.abs(m.pressure - mid) < Math.abs(best.m.pressure - mid)) best = { b, m };
        if (m.pressure > mid) hi = b - 1; else lo = b + 1;
      }
      set('demand.backlog', best.b, 'demand', `the standing job that keeps the hands busy ${Math.round(mid * 100)}% of the session`);
    }
    return measure(K, seeds);
  };

  // 3. the miss band (orders: patience by bisection, fewer lost the longer they wait), 2 and 3 again
  const missMid = (P.bands.miss[0] + P.bands.miss[1]) / 2;
  const solvePatience = () => {
    let lo = Math.ceil(cp() * 1.05), hi = Math.max(K.demand.patience * 3, Math.ceil(cp() * 6)), best = null;
    while (lo <= hi) {
      const p = Math.floor((lo + hi) / 2), mm = measure({ ...K, demand: { ...K.demand, patience: p } }, seeds);
      if (!best || Math.abs(mm.miss - missMid) < Math.abs(best.mm.miss - missMid)) best = { p, mm };
      if (mm.miss > missMid) lo = p + 1; else hi = p - 1;
    }
    const was = K.demand.patience;
    set('demand.patience', best.p, 'demand', `${best.p > was ? 'more' : 'less'} patience, for ${Math.round(missMid * 100)}% of orders lost`);
  };
  let m = null;
  for (let r = 0; r < rounds; r++) {
    m = solveRate();
    const full = Object.entries(m.stations).sort((a, b) => b[1] - a[1])[0];
    const slotUp = (why) => { const sid = full[0]; set(`stations.${sid}.slots`, (K.stations[sid].slots ?? 1) + 1, 'capacity', why); };
    if (m.pressure < P.bands.pressure[0] - 0.03 && full && full[1] > 0.8) { slotUp(`${full[0]} is full ${Math.round(full[1] * 100)}% of the time and holds the crew back`); continue; }
    if (inBand(m.miss, P.bands.miss, 0.01)) break;
    if (m.miss > P.bands.miss[1] && full && full[1] > 0.85) { slotUp(`${full[0]} is full ${Math.round(full[1] * 100)}% of the time: orders wait on it`); continue; }
    if (!backlog) {
      solvePatience();
      m = measure(K, seeds);
      if (inBand(m.pressure, P.bands.pressure, 0.03) && inBand(m.miss, P.bands.miss, 0.01)) break;
      continue;
    }
    if (m.miss > P.bands.miss[1]) {
      const sh = Object.entries(K.stations).filter(([, s]) => s.verb === 'shovel').sort((a, b) => (m.stations[b[0]] ?? 0) - (m.stations[a[0]] ?? 0))[0];
      if (!sh) break;
      const [sid, s] = sh, item = Object.keys(s.gives)[0];
      set(`stations.${sid}.gives`, { [item]: s.gives[item] + 1 }, 'output', `${Math.round(m.miss * 100)}% of the job left: a better tool at ${sid}`);
    } else if (K.demand.every) set('demand.every', Math.max(1, Math.round(K.demand.every * 0.85)), 'demand', 'the job is cleared with room to spare: the wind adds more');
    else break;
  }
  const holds = {
    pressure: inBand(m.pressure, P.bands.pressure, 0.03), miss: inBand(m.miss, P.bands.miss, 0.01),
    juggle: inBand(m.juggle, P.bands.juggle), slack: inBand(m.slack, P.bands.slack, 0.05),
  };
  const missing = Object.entries(holds).filter(([, h]) => !h).map(([k]) => `${k} ${m[k]} outside [${P.bands[k].join(', ')}]`);
  const { everyFor, ...analysis } = analyze(K);
  return {
    id: K.id, target: { name: P.name, bands: P.bands, says: P.says }, player: { foresight: P.foresight }, card: K, moves, metrics: m, analysis, holds,
    verdict: missing.length ? 'closest' : 'tuned',
    says: missing.length ? `closest found: ${missing.join('; ')}` : `every band holds at ${P.name}`,
  };
}
