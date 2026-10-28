// Race control on written-out crossings: the lights and a jump start, the laps and the fastest, the order and an
// overtake, the gap and a lapped car, the flag and the field home on its next crossing, a retirement, the words; the
// same facts are the same race to the byte, a state is never mutated, and the closure runs from its own source.
import { describe, it, expect } from 'vitest';
import { buildRaceControl, raceRead, raceStart, raceApply, raceDisplay, raceOrder, raceClock, raceGapWords } from './race-control.js';

// a race driven by each car's pace (frames a lap, the lines evenly spaced), the facts fed as the timing sees them
function drive(spec, pace, { seed = 7, extra = () => [], until = 20000 } = {}) {
  const R = raceRead(spec);
  let S = raceStart(R, seed);
  const calls = [], next = pace.map(() => 0);
  const step = (f) => { const o = raceApply(R, S, f); S = o.S; for (const c of o.calls) calls.push({ at: S.f, ...c }); };
  for (let i = 0; i < until && S.phase !== 'over'; i++) {
    step({ kind: 'tick' });
    for (const f of extra(S)) step(f);
    if (S.go === null) continue;
    pace.forEach((p, c) => {
      if (p === null) return;
      const want = Math.floor((S.f - S.go) / (p / R.lines));
      while (next[c] < want && S.phase !== 'over') { step({ kind: 'line', who: c, line: next[c] % R.lines }); next[c]++; }
    });
  }
  return { R, S, calls, kinds: calls.map((c) => c.kind) };
}

describe('race control', () => {
  it('reads a race and refuses teaching', () => {
    expect(raceRead({ cars: 4, laps: 3 })).toMatchObject({ lines: 1, start: 'lights', grid: [0, 1, 2, 3], jump: 5 });
    expect(() => raceRead({ cars: 0, laps: 3 })).toThrow(/cars is 1 to 12/);
    expect(() => raceRead({ cars: 2, laps: 3, grid: [0, 0] })).toThrow(/every car once/);
    expect(() => raceRead({ cars: 2, laps: 3, start: 'flag' })).toThrow(/lights or rolling/);
    expect(() => raceRead({ cars: 2, laps: 3, pits: 1 })).toThrow(/has no 'pits'/);
  });
  it('lights the five reds a second apart, then out after a held beat; a car that rolls first is penalised', () => {
    const { calls } = drive({ cars: 2, laps: 1 }, [600, 620], { extra: (S) => (S.f === 200 ? [{ kind: 'move', who: 1 }] : []) });
    const lights = calls.filter((c) => c.kind === 'light');
    expect(lights.map((c) => c.n)).toEqual([1, 2, 3, 4, 5]);
    expect(lights.map((c) => c.at)).toEqual([60, 120, 180, 240, 300]);
    const out = calls.find((c) => c.kind === 'lights-out');
    expect(out.at).toBeGreaterThan(300);
    expect(out.at).toBeLessThanOrEqual(300 + 3 * 60);
    expect(calls.filter((c) => c.kind === 'jump-start')).toEqual([{ at: 200, kind: 'jump-start', who: 1, penalty: 5 }]);
    expect(calls.find((c) => c.kind === 'over').placings.find((p) => p.who === 1).pen).toBe(5);
  });
  it('times the laps, calls the fastest and the last lap, and calls a pass on the line it was made', () => {
    // the slowest on pole, the fastest last on the grid
    const { calls, R, S } = drive({ cars: 3, laps: 3, lines: 3, grid: [2, 1, 0], start: 'rolling' }, [600, 630, 700]);
    expect(calls.filter((c) => c.kind === 'lap' && c.who === 0).map((c) => c.t)).toEqual([10, 10, 10]);
    expect(calls.filter((c) => c.kind === 'fastest-lap').map((c) => c.who)).toEqual([0]);
    expect(calls.filter((c) => c.kind === 'final-lap')).toHaveLength(1);
    expect(calls.find((c) => c.kind === 'final-lap').who).toBe(0);
    const passes = calls.filter((c) => c.kind === 'overtake');
    expect(passes.length).toBeGreaterThan(0);
    expect(passes.some((c) => c.who === 0 && c.place === 1)).toBe(true);
    expect(calls.filter((c) => c.kind === 'sector' && c.best === 'overall').length).toBeGreaterThan(0);
    expect(raceOrder(R, S)).toEqual([0, 1, 2]);
  });
  it('gives the gap at the line and a lapped car its laps; after the flag every car finishes at its next crossing', () => {
    const { calls, R, S } = drive({ cars: 3, laps: 4, start: 'rolling' }, [600, 660, 1300]);
    const fin = calls.filter((c) => c.kind === 'finish');
    // (the lapped car crosses the line before the second car does: home first, classified behind it)
    expect(fin.map((c) => c.who)).toEqual([0, 2, 1]);
    expect(fin.map((c) => [c.place, c.laps])).toEqual([[1, 4], [3, 2], [2, 4]]);
    const over = calls.find((c) => c.kind === 'over');
    expect(over.placings.map((p) => p.place)).toEqual([1, 2, 3]);
    const D = raceDisplay(R, S);
    expect(D.rows[1].gap).toBeCloseTo(4, 6);   // 60 frames a lap, four laps
    expect(D.rows[2].gap).toEqual({ laps: 2 });
    expect(raceGapWords(D.rows[1].gap)).toBe('+4.000');
    expect(raceGapWords(D.rows[2].gap)).toBe('+2 LAPS');
    expect(raceClock(83.4567)).toBe('1:23.457');
  });
  it('drops a retired car to the back and ends the race without it; a yellow for an incident', () => {
    const { calls } = drive({ cars: 3, laps: 2, start: 'rolling' }, [600, 650, null], { extra: (S) => (S.f === 100 ? [{ kind: 'incident', who: 2 }, { kind: 'retire', who: 2 }] : []) });
    expect(calls.filter((c) => c.kind === 'yellow' || c.kind === 'retire').map((c) => c.kind)).toEqual(['yellow', 'retire']);
    expect(calls.find((c) => c.kind === 'over').placings.map((p) => p.who)).toEqual([0, 1]);
  });
  it('ignores a line out of order; is the same race for the same facts; never mutates a state; runs from its own source', () => {
    const R = raceRead({ cars: 2, laps: 1, lines: 2, start: 'rolling' });
    let S = raceApply(R, raceStart(R, 1), { kind: 'tick' }).S;
    const frozen = JSON.stringify(S), skip = raceApply(R, S, { kind: 'line', who: 0, line: 1 });
    expect(skip.calls).toEqual([]);
    expect(JSON.stringify(S)).toBe(frozen);
    const a = drive({ cars: 4, laps: 2, lines: 2 }, [600, 610, 640, 700], { seed: 9 }), b = drive({ cars: 4, laps: 2, lines: 2 }, [600, 610, 640, 700], { seed: 9 });
    expect(JSON.stringify(a.calls)).toBe(JSON.stringify(b.calls));
    const own = new Function(`${buildRaceControl.toString()}; return buildRaceControl();`)();
    const R2 = own.read({ cars: 2, laps: 1 });
    expect(JSON.stringify(own.start(R2, 3))).toBe(JSON.stringify(raceStart(raceRead({ cars: 2, laps: 1 }), 3)));
  });
});
