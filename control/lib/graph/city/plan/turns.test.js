import { describe, it, expect } from 'vitest';
import { inferCity } from './card.js';
import { designCity } from './design.js';
import { GRAMMAR_IDS, resolveGrammar } from './grammars.js';
import { cityTraffic } from './traffic.js';
import { TRAFFIC, buildSignals, pairLanes, laneCapacity, deriveClearance, createTrafficModel, laneTurns, armTurns, stepTrafficTurning, phaseAt, carFootprint, rectsTouch } from '../../scene/channels/traffic-model.js';

// The planned city's traffic as the world path lays it (world-kinds attachCityCars), with turns armed
function cityModel(grammar, share = 0.5) {
  const d = designCity({ kind: 'city', ...inferCity({ seed: 6, grammar, board: { cols: 8, rows: 6 } }).recipe }), { carLanes, junctions } = cityTraffic(d);
  const T = { ...TRAFFIC };
  T.CLEARANCE = deriveClearance(Math.max(...junctions.map((j) => Math.max(j.wx, j.wy))), T.CAR_LEN, 1.26, T.ACCEL);
  const signals = buildSignals(junctions, 6, { w: d.frame.W, d: d.frame.D }, T), lanes = pairLanes(carLanes, signals, 1.26, T);
  const turns = laneTurns(lanes, signals, T), cars = [];
  lanes.forEach((L, li) => { const n = laneCapacity(L.total, 3, T, L.crossings); for (let k = 0; k < n; k++) cars.push({ lane: li, startFrac: ((k / n) + li * 0.19) % 1 }); });
  const withTurns = lanes.map((L, li) => ({ ...L, turns: turns[li].turns, cap: Math.max(cars.filter((c) => c.lane === li).length, turns[li].cap) }));
  const model = armTurns(createTrafficModel(lanes, cars, signals, T), withTurns, share);
  return { d, T, lanes, signals, withTurns, model, cars };
}

// one city per side of the road a grammar drives on (the near side flips with it), the first grammar of each
const BY_SIDE = Object.values(GRAMMAR_IDS.reduce((o, g) => { const side = resolveGrammar(g).traffic; o[side] ??= g; return o; }, {}));

describe('cars turn at a junction\'s near side, on their own green, and never touch', () => {
  for (const grammar of BY_SIDE) {
    it(`${grammar}: two minutes, every step`, () => {
      const w = cityModel(grammar), M = w.model, T = w.T;
      // every turn is onto a perpendicular lane that crosses the car's own inside one of its junction boxes
      for (const [li, L] of w.withTurns.entries()) for (const t of L.turns) {
        expect(w.lanes[t.to].axis).not.toBe(w.lanes[li].axis);
        const S = w.signals[t.sig];
        expect(Math.abs(w.lanes[t.to].cross - (L.axis === 'x' ? S.x : S.y))).toBeLessThanOrEqual(((L.axis === 'x' ? S.wx : S.wy) / 2) + 1e-6);
      }
      let turned = 0;
      for (let step = 1; step <= 120 * 30; step++) {
        const before = M.cars.map((c) => c.lane), t = step * T.DT;
        stepTrafficTurning(M, t);
        M.cars.forEach((c, i) => {
          if (c.lane === before[i]) return;
          turned += 1;
          // it turned in the box its old lane was green through
          const from = w.lanes[before[i]], ph = phaseAt(w.signals[w.withTurns[before[i]].turns.find((x) => x.to === c.lane).sig], t);
          expect(ph.axis === from.axis || ph.axis === null).toBe(true);
          expect(M.lanes[c.lane].cars.length).toBeLessThanOrEqual(w.withTurns[c.lane].cap);
        });
        if (step % 6) continue;
        const fps = M.cars.map((c) => carFootprint(w.lanes[c.lane], c.s, c.len, T.CAR_WID, T));
        // gathered, then held at once: an expect per pair is most of the run's time
        const touching = [];
        for (let i = 0; i < fps.length; i++) for (let j = i + 1; j < fps.length; j++) if (rectsTouch(fps[i], fps[j])) touching.push(`t ${t.toFixed(2)}: cars ${i} (lane ${M.cars[i].lane}) and ${j} (lane ${M.cars[j].lane})`);
        expect(touching).toEqual([]);
      }
      expect(turned).toBeGreaterThan(5);
      // and the city keeps moving: no lane locks (every car covers ground over the last half minute)
      const s0 = M.cars.map((c) => [c.lane, c.s]);
      stepTrafficTurning(M, 150);
      const still = M.cars.filter((c, i) => c.lane === s0[i][0] && Math.abs(c.s - s0[i][1]) < 0.5).length;
      expect(still / M.cars.length).toBeLessThan(0.15);
      process.stdout.write(`TURNS ${grammar} ${turned} turns, ${M.cars.length} cars, ${still} still\n`);
    });
  }
  it('replays: the same clock, the same cars, after a capture went back to zero', () => {
    const w = cityModel(BY_SIDE[0]), M = w.model;
    stepTrafficTurning(M, 60);
    const at60 = M.cars.map((c) => [c.lane, +c.s.toFixed(6)]);
    stepTrafficTurning(M, 5);   // backwards: restarts
    stepTrafficTurning(M, 60);
    expect(M.cars.map((c) => [c.lane, +c.s.toFixed(6)])).toEqual(at60);
  });
});
