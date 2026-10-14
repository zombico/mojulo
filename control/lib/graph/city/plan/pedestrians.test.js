import { describe, it, expect } from 'vitest';
import { readCityPlan, inferCity } from './card.js';
import { designCity } from './design.js';
import { cityPedestrians, PEOPLE } from './pedestrians.js';
import { resolveWorldScene } from '../../worlds/world-scene.js';
import { heldWalk, phaseAt } from '../../scene/channels/traffic-model.js';
import { CITY_METERS_PER_UNIT as U } from '../fractal-city.js';

// no street trees: the walkers never read them, and growing tree variants is most of a first world's time
const recipe = (rec = {}) => ({ kind: 'city', ...inferCity({ seed: 6, grammar: 'new-york', board: { cols: 8, rows: 6 }, green: 0, people: 1, ...rec }).recipe });
const along = (path, s) => { let acc = 0; for (let i = 1; i < path.length; i++) { const a = path[i - 1], b = path[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (acc + L >= s) { const t = (s - acc) / L; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; } acc += L; } return path[0]; };
const lengthOf = (path) => path.slice(1).reduce((a, b, i) => a + Math.hypot(b[0] - path[i][0], b[1] - path[i][1]), 0);

describe('pedestrians: round their blocks, across at the signals', () => {
  it('walk the walks: every corner of a loop off the lots and off every carriageway', () => {
    const d = designCity(recipe()), W = cityPedestrians(d, [], { people: 1 });
    expect(W.length).toBeGreaterThan(10);
    expect(W.length).toBeLessThanOrEqual(PEOPLE.cap);
    for (const w of W) for (const [x, y] of w.path.map(([a, b]) => [a * U, b * U])) {
      expect(d.lots.some((l) => l.use !== 'parking' && x > l.x0 + 0.1 && x < l.x1 - 0.1 && y > l.y0 + 0.1 && y < l.y1 - 0.1)).toBe(false);
      for (const s of d.streets) for (let k = 1; k < s.pts.length; k++) {
        const a = s.pts[k - 1], b = s.pts[k], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2));
        expect(Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)).toBeGreaterThan(s.road / 2);
      }
    }
    expect(cityPedestrians(d, [], { people: 0 })).toEqual([]);
    expect(() => readCityPlan({ people: 3 })).toThrow(/people is a number from 0/);
  });
  it('cross only when the crossing is open, wait at the kerb otherwise, and keep walking', async () => {
    const { payload } = await resolveWorldScene({ ref: 'ped-test', manifest: recipe() });
    const W = payload.walkers, S = payload.signals;
    expect(W.some((w) => w.holds.length)).toBe(true);
    let crossings = 0, waits = 0;
    for (const w of W.filter((x) => x.holds.length)) {
      const total = lengthOf(w.path), H = { s0: w.startFrac * total, s: w.startFrac * total, t: 0 }, v = w.speed;
      // every hold is at a carriageway's kerb: half a road from its street's line
      for (const h of w.holds) expect(h.len).toBeGreaterThan(1);
      let prev = H.s;
      for (let t = 1 / 30; t <= 180; t += 1 / 30) {
        const s = heldWalk(w.holds, v, H, total, t, S);
        for (const h of w.holds) {
          const passed = prev <= s ? prev < h.s && h.s <= s : prev < h.s || h.s <= s;
          if (passed) { crossings += 1; const ph = phaseAt(S[h.sig], t - 1 / 30); expect(ph.axis).toBe(h.go); }
        }
        if (s === prev) waits += 1;
        prev = s;
      }
      expect(H.t).toBeGreaterThan(179);
    }
    expect(crossings).toBeGreaterThan(5);
    expect(waits).toBeGreaterThan(0);
  }, 120000);
  it('replays: the same clock, the same people', () => {
    const holds = [{ s: 3, sig: 0, go: 'x', len: 3 }], sig = [{ x: 0, y: 0, wx: 3, wy: 3, cycle: 34, offset: 0, green: 12, amber: 2, clearance: 5, major: 'x' }];
    const H = { s0: 0, s: 0, t: 0 }, at40 = heldWalk(holds, 0.4, H, 40, 40, sig);
    heldWalk(holds, 0.4, H, 40, 3, sig);
    expect(heldWalk(holds, 0.4, H, 40, 40, sig)).toBe(at40);
  });
});
