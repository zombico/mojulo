/**
 * RACE CONTROL — the race's referee: the order, the gaps, the laps and the flags as a pure function of what the timing
 * loops saw (a car crossed timing line j at this frame), as a race's timing screens and its race director call them.
 * It never drives a car (the drive rule and the racer do) and the agent never adjudicates: race control calls every
 * place. The broadcast (broadcast/) draws its calls and its tower as television covers a race.
 *
 * SINGLE SOURCE OF TRUTH, the contest kernel's discipline (contest/contest-kernel.js): everything lives inside
 * `buildRaceControl()`, a closure referencing nothing outside itself, so a page runs the same code by emitting
 * `buildRaceControl.toString()`. Pure and seeded: no clock, no Math.random; the lights' hold is mulberry32 on the
 * state (S.r) from the race's seed, and `apply` returns a new state, so the same start and the same facts are the same
 * race to the byte. Frames are 60 Hz.
 *
 *   read(spec) → R    the race compiled; throws on what it cannot read, teaching
 *     spec: { cars: n (1..12), laps: n (1..99), lines?: n (timing lines a lap, 1..12; the last is the finish line, the
 *             lap starts on it; 1), start?: 'lights' (the five red lights, one a second, out after a held beat the dice
 *             choose) | 'rolling' (green at the first tick), grid?: [car, …] (the starting order; the cars' own),
 *             jump?: seconds (a jump start's penalty; 5), title? }
 *   start(R, seed) → S   the grid, the lights off
 *   apply(R, S, fact) → { S, calls }   a fact the timing saw, the next state and the calls it made
 *     facts:  { kind: 'tick' } (a frame) | { kind: 'go' } (the start now, whatever the lights say) |
 *             { kind: 'move', who } (a car rolled before the lights went out) |
 *             { kind: 'line', who, line } (a car crossed a timing line: only its next one counts) |
 *             { kind: 'incident', who } (off, spun, crashed: a yellow) | { kind: 'retire', who }
 *     calls:  light (n of 5 lit) · lights-out · jump-start (who, penalty) · sector (who, lap, sector, t, best:
 *             'overall' | 'personal' | null) · lap (who, lap, t, best) · fastest-lap (who, lap, t) · final-lap (the
 *             leader begins it) · overtake (who, on, place) · yellow (who) · retire (who) · finish (who, place, t, laps:
 *             a lapped car's fewer) · over (placings)
 *   order(R, S) → [who, …]   the running order: finished first by place, then the furthest round, then whoever got
 *             there first, the retired last
 *   display(R, S) → { phase, lap, laps, clock, lights, fastest, rows: [{ who, place, laps, gap, interval, last, best,
 *             finished, out, pen }] }   the timing screen (gap and interval in seconds, or { laps } a lap or more down)
 *   clock(t) → '1:23.456' · gapWords(g) → '+1.234' | '+1 LAP'   a timing screen's words
 *
 * After the leader takes the chequered flag, every other car finishes the next time it crosses the finish line (a
 * lapped car classified its laps down); the race is over when every car is home or out.
 */

export function buildRaceControl() {
  const STARTS = ['lights', 'rolling'];
  const HZ = 60, LIGHTS = 5, HOLD_LEAST = 0.2, HOLD_SPREAD = 2.8;   // the lights: one a second, then a held beat

  function rnd(S) {
    S.r = (S.r + 0x6D2B79F5) >>> 0;
    let t = S.r;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  const fail = (m) => { throw new Error(`race control: ${m}`); };

  function read(spec) {
    if (!spec || typeof spec !== 'object') fail('a race is { cars, laps, lines?, start?, grid?, jump?, title? }');
    const keys = ['cars', 'laps', 'lines', 'start', 'grid', 'jump', 'title'];
    for (const k of Object.keys(spec)) if (!keys.includes(k)) fail(`has no '${k}' (${keys.join(', ')})`);
    if (!isInt(spec.cars, 1, 12)) fail('cars is 1 to 12');
    if (!isInt(spec.laps, 1, 99)) fail('laps is 1 to 99');
    const lines = spec.lines ?? 1;
    if (!isInt(lines, 1, 12)) fail('lines is 1 to 12 (the timing lines a lap, the last the finish line)');
    const start = spec.start ?? 'lights';
    if (!STARTS.includes(start)) fail(`start is ${STARTS.join(' or ')}`);
    const grid = spec.grid ?? Array.from({ length: spec.cars }, (_, i) => i);
    if (!(Array.isArray(grid) && grid.length === spec.cars && grid.every((c) => isInt(c, 0, spec.cars - 1)) && new Set(grid).size === spec.cars)) fail(`grid is every car once (0 to ${spec.cars - 1}), pole first`);
    const jump = spec.jump ?? 5;
    if (!(typeof jump === 'number' && jump >= 0 && jump <= 60)) fail('jump is 0 to 60 seconds (a jump start\'s penalty)');
    return { cars: spec.cars, laps: spec.laps, lines, start, grid: grid.slice(), jump, title: typeof spec.title === 'string' ? spec.title : null };
  }

  function start(R, seed = 1) {
    const S = { r: (seed >>> 0) || 1, f: 0, phase: 'grid', lights: 0, outAt: null, go: null, flag: null, final: false, fastest: null, best: Array(R.lines).fill(null), order: R.grid.slice(), cars: [] };
    S.hold = Math.round((HOLD_LEAST + rnd(S) * HOLD_SPREAD) * HZ);
    for (let i = 0; i < R.cars; i++) S.cars.push({ lap: 0, line: R.lines - 1, at: null, lapAt: null, secAt: null, last: null, best: null, sectors: Array(R.lines).fill(null), marks: [], passes: [], finished: null, place: null, out: false, pen: 0, jumped: false, yellow: 0 });
    return S;
  }

  // a car's progress: the lines it has crossed since the start (a lap's worth `lines`)
  const progress = (R, c) => (c.at === null ? 0 : c.lap * R.lines + (c.line === R.lines - 1 ? 0 : c.line + 1));
  function order(R, S) {
    const rank = R.grid.reduce((m, c, i) => ((m[c] = i), m), {});
    return S.cars.map((_, i) => i).sort((a, b) => {
      const A = S.cars[a], B = S.cars[b];
      if (A.out !== B.out) return A.out ? 1 : -1;
      if ((A.place !== null) !== (B.place !== null)) return A.place !== null ? -1 : 1;
      if (A.place !== null) return A.place - B.place;
      const pa = progress(R, A), pb = progress(R, B);
      if (pa !== pb) return pb - pa;
      if (A.at !== B.at) return A.at === null ? 1 : B.at === null ? -1 : A.at - B.at;
      return rank[a] - rank[b];
    });
  }

  function apply(R, S0, fact) {
    const S = clone(S0), calls = [];
    const car = (w) => (isInt(w, 0, R.cars - 1) ? S.cars[w] : null);
    const lightsOut = () => { S.phase = 'race'; S.go = S.f; S.lights = 0; calls.push({ kind: 'lights-out' }); };
    switch (fact && fact.kind) {
      case 'tick': {
        S.f += 1;
        if (S.phase !== 'grid') break;
        if (R.start === 'rolling') { lightsOut(); break; }
        // the lights: one a second from the first tick, then the held beat, then out
        const lit = Math.min(LIGHTS, Math.floor(S.f / HZ));
        if (lit > S.lights) { S.lights = lit; calls.push({ kind: 'light', n: lit }); if (lit === LIGHTS) S.outAt = S.f + S.hold; }
        if (S.outAt !== null && S.f >= S.outAt) lightsOut();
        break;
      }
      case 'go': if (S.phase === 'grid') lightsOut(); break;
      case 'move': {
        const c = car(fact.who);
        if (!c || S.phase !== 'grid' || c.jumped) break;
        c.jumped = true; c.pen += R.jump;
        calls.push({ kind: 'jump-start', who: fact.who, penalty: R.jump });
        break;
      }
      case 'incident': { const c = car(fact.who); if (c && !c.out && c.place === null && S.phase !== 'grid') { c.yellow += 1; calls.push({ kind: 'yellow', who: fact.who }); } break; }
      case 'retire': {
        const c = car(fact.who);
        if (!c || c.out || c.place !== null) break;
        c.out = true; calls.push({ kind: 'retire', who: fact.who });
        S.order = order(R, S); overIf(R, S, calls);
        break;
      }
      case 'line': {
        const c = car(fact.who);
        if (!c || c.out || c.place !== null || (S.phase !== 'race' && S.phase !== 'flag')) break;
        if (fact.line !== (c.line + 1) % R.lines) break;   // only its next line counts (a short cut, a reverse: nothing)
        const t = (S.f - S.go) / HZ, from = c.secAt ?? S.go;
        c.line = fact.line; c.at = S.f; c.secAt = S.f; c.marks.push(S.f);
        // the sector: the time from the line before; purple the best of all, green the car's own best
        const st = (S.f - from) / HZ, prevBest = c.sectors[c.line];
        const sBest = S.best[c.line] === null || st < S.best[c.line] ? 'overall' : prevBest === null || st < prevBest ? 'personal' : null;
        if (prevBest === null || st < prevBest) c.sectors[c.line] = st;
        if (sBest === 'overall') S.best[c.line] = st;
        if (R.lines > 1) calls.push({ kind: 'sector', who: fact.who, lap: c.lap + 1, sector: c.line + 1, t: st, best: sBest });
        if (c.line === R.lines - 1) {
          // a lap: its time from the last crossing of the finish line (the first from the start)
          const lt = (S.f - (c.lapAt ?? S.go)) / HZ, best = S.fastest === null || lt < S.fastest.t ? 'overall' : c.best === null || lt < c.best ? 'personal' : null;
          c.lap += 1; c.lapAt = S.f; c.last = lt;
          if (c.best === null || lt < c.best) c.best = lt;
          calls.push({ kind: 'lap', who: fact.who, lap: c.lap, t: lt, best });
          if (best === 'overall') { S.fastest = { who: fact.who, lap: c.lap, t: lt }; calls.push({ kind: 'fastest-lap', who: fact.who, lap: c.lap, t: lt }); }
          // the flag: the leader home at the full distance; every car after it home at its next crossing
          if (S.phase === 'race' && c.lap >= R.laps) { S.phase = 'flag'; S.flag = S.f; }
          if (S.phase === 'flag') {
            // (its place: the cars home on as many laps, and those still running a lap or more further on)
            c.place = 1 + S.cars.filter((x, i) => i !== fact.who && !x.out && (x.place !== null ? x.lap >= c.lap : progress(R, x) > progress(R, c))).length;
            c.finished = t + c.pen;
            calls.push({ kind: 'finish', who: fact.who, place: c.place, t: c.finished, laps: c.lap });
          } else if (c.lap === R.laps - 1 && !S.final) { S.final = true; calls.push({ kind: 'final-lap', who: fact.who, lap: R.laps }); }   // (the first car to begin it leads)
        }
        // the order: a car up a place on the line has passed the car now behind it
        const was = S.order, now = order(R, S);
        const at = now.indexOf(fact.who), before = was.indexOf(fact.who);
        if (at < before && c.place === null) calls.push({ kind: 'overtake', who: fact.who, on: now[at + 1], place: at + 1 });
        if (at < before) c.passes.push(S.f);
        S.order = now;
        overIf(R, S, calls);
        break;
      }
      default: break;
    }
    return { S, calls };
  }
  function overIf(R, S, calls) {
    if (S.phase === 'over' || !S.cars.every((c) => c.out || c.place !== null) || S.phase === 'grid') return;
    S.phase = 'over';
    // (a penalty can move a place: the placings by the race time with it, the laps down after)
    const home = S.cars.map((c, i) => ({ who: i, c })).filter((x) => !x.c.out).sort((a, b) => (b.c.lap - a.c.lap) || (a.c.finished - b.c.finished) || (a.c.place - b.c.place));
    home.forEach((x, i) => { x.c.place = i + 1; });
    calls.push({ kind: 'over', placings: home.map((x) => ({ who: x.who, place: x.c.place, t: x.c.finished, laps: x.c.lap, pen: x.c.pen })) });
  }

  function display(R, S) {
    const ord = order(R, S), lead = S.cars[ord[0]], rows = [];
    // a gap: the time between two cars at the same line, the later's last crossing against the earlier's (a lap or
    // more down when the car ahead has crossed it a lap's worth more)
    const gapOf = (a, b) => {
      if (a.at === null || b.at === null) return null;
      const pa = progress(R, a), pb = progress(R, b);
      if (pa - pb >= R.lines) return { laps: Math.floor((pa - pb) / R.lines) };
      return pb >= 1 && a.marks[pb - 1] !== undefined ? (b.at - a.marks[pb - 1]) / HZ : null;
    };
    ord.forEach((w, i) => {
      const c = S.cars[w], prev = i ? S.cars[ord[i - 1]] : null;
      rows.push({ who: w, place: i + 1, laps: c.lap, gap: i ? gapOf(lead, c) : null, interval: i ? gapOf(prev, c) : null, last: c.last, best: c.best, finished: c.finished, out: c.out, pen: c.pen });
    });
    return { phase: S.phase, lap: Math.min(R.laps, (lead ? lead.lap : 0) + (S.phase === 'grid' ? 0 : 1)), laps: R.laps, clock: S.go === null ? 0 : ((S.flag ?? S.f) - S.go) / HZ, lights: S.lights, fastest: S.fastest ? { ...S.fastest } : null, rows };
  }

  const clock = (t) => { const ms = Math.round(Math.max(0, t) * 1000), m = Math.floor(ms / 60000), s = (ms % 60000) / 1000; return `${m}:${s.toFixed(3).padStart(6, '0')}`; };
  const gapWords = (g) => (g === null || g === undefined ? '' : typeof g === 'object' ? `+${g.laps} LAP${g.laps > 1 ? 'S' : ''}` : `+${g.toFixed(3)}`);

  return { read, start, apply, order, display, clock, gapWords, HZ, LIGHTS };
}

const _race = buildRaceControl();
export const raceRead = _race.read;
export const raceStart = _race.start;
export const raceApply = _race.apply;
export const raceOrder = _race.order;
export const raceDisplay = _race.display;
export const raceClock = _race.clock;
export const raceGapWords = _race.gapWords;
