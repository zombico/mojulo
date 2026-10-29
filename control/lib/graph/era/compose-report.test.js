// The composer's report (compose-report.js) and the bake's tuner (compose-plot.js keyTuner), on a bake laid by hand: the
// tuner brings a focus to its ratio on the bake's own shares, short where a key would burn it out; the report reads each
// room's focus over its mean, a beat's at its peak, and its laws catch a dark room and a dead end lit over the way on.
import { describe, expect, it } from 'vitest';
import { keyTuner, MOODS, LIGHT_PLOT, focusReach } from './compose-plot.js';
import { composeReport, mergeReports } from './compose-report.js';

// two rooms side by side; a way in, a dead end; their foci a metre over the floor
const plan = (mood = 'drama', extra = {}) => ({
  rooms: [{ id: 'a', x0: 0, y0: 0, x1: 6, y1: 6, h: 4 }, { id: 'b', x0: 6, y0: 0, x1: 12, y1: 6, h: 4 }],
  compose: { mood, roles: [{ room: 'a', role: 'arrival', focus: [3, 5, 1] }, { room: 'b', role: 'pocket', focus: [9, 3, 1] }], ...extra },
});
// a floor tile, its corners' light given (linear grey)
const tile = (x, y, lights) => ({ corners: [[x, y, 0], [x + 1, y, 0], [x + 1, y + 1, 0], [x, y + 1, 0]], normal: [0, 0, 1], cornerLight: lights.map((v) => [v, v, v]) });
const floor = (x0, at) => { const out = []; for (let x = x0; x < x0 + 6; x++) for (let y = 0; y < 6; y++) out.push(tile(x, y, [0, 1, 2, 3].map(() => at(x + 0.5, y + 0.5)))); return out; };

describe('the bake\'s tuner', () => {
  it('scales a room\'s key so its focus holds its ratio on the bake\'s own shares', () => {
    const P = plan(), lights = [{ fixture: 'strip' }, { fixture: 'key', room: 'a' }, { fixture: 'key', room: 'b' }];
    // each floor corner: the strip everywhere, room a's key strong by its focus and fading
    const raw = floor(0, () => 0).map((f) => ({ ...f, tint: [1, 1, 1] }));
    const shares = raw.map((f) => f.corners.map((c) => [0, 0.1, 1, Math.hypot(c[0] - 3, c[1] - 5) <= 1.2 ? 1 : 0.02]));
    const tune = keyTuner(P), scale = tune({ raw, shares, keys: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], ambient: [0.05, 0.05, 0.05], lights });
    const want = MOODS.drama.ratio * LIGHT_PLOT.roles.arrival;
    expect(tune.record.a.ratio).toBeCloseTo(want, 3);
    expect(scale[1]).toBeCloseTo(tune.record.a.scale, 3);
    // (a key whose light spreads as wide as its focus cannot lift it: short)
    const flat = raw.map((f) => f.corners.map(() => [0, 0.5, 1, 0.5]));
    const T2 = keyTuner(P);
    T2({ raw, shares: flat, keys: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], ambient: [0.05, 0.05, 0.05], lights });
    expect(T2.record.a.short).toBe(true);
  });
});

describe('the report', () => {
  it('reads each room\'s focus over its mean on the bake; the way on over the dead ends; nothing dark; the palette', () => {
    const P = plan(), plot = [{ room: 'a', role: 'arrival', target: 3.2 }, { room: 'b', role: 'pocket', target: 2 }];
    const near = (fx, fy, hi, lo) => (x, y) => (Math.hypot(x - fx, y - fy) <= focusReach(P.rooms[0]) ? hi : lo);
    const faces = [...floor(0, near(3, 5, 6, 1)), ...floor(6, near(9, 3, 4, 1))];
    const R = composeReport(P, faces, { plot });
    expect(R.measured).toBe('bake');
    const a = R.rooms.find((r) => r.room === 'a');
    expect(a.ratio).toBeGreaterThan(1.2);
    expect(Object.fromEntries(R.laws.map((l) => [l.id, l.ok]))).toEqual({ focus: true, 'way-on': true, lit: true, palette: true });
    // a dark room, a dead end lit over the way on, a target the palette left: each said
    const bad = composeReport(P, [...floor(0, near(3, 5, 0.2, 0.05)), ...floor(6, () => 5)], { plot, unreached: { r3: [1, 0, 0] } });
    const ok = Object.fromEntries(bad.laws.map((l) => [l.id, l.ok]));
    expect([ok.focus, ok['way-on'], ok.lit, ok.palette]).toEqual([false, false, false, false]);
  });

  it('a beat\'s room read at its peak; storeys merged with their laws read across them; no bake, the model\'s, said so', () => {
    const P = plan('noir'), plot = [{ room: 'a', role: 'arrival', target: 6.4 }, { room: 'b', role: 'pocket', target: 4, beat: 'flicker' }];
    const faces = [...floor(0, () => 1), ...floor(6, () => 1)];
    const R = composeReport(P, faces, { plot, tuned: { b: { ratio: 3.5, scale: 2, peak: true } } });
    expect(R.rooms.find((r) => r.room === 'b')).toMatchObject({ ratio: 3.5, beat: 'flicker', at: 'peak' });
    const M = mergeReports([R, composeReport({ ...P, rooms: [{ ...P.rooms[0], id: 'c' }], compose: { ...P.compose, roles: [{ ...P.compose.roles[0], room: 'c' }] } }, floor(0, () => 1), { plot: [{ room: 'c', role: 'arrival', target: 6.4 }] })]);
    expect(M.rooms.map((r) => r.room)).toEqual(['a', 'b', 'c']);
    expect(M.laws.find((l) => l.id === 'focus').ok).toBe(false);
    const model = composeReport(P, null, { plot: [{ room: 'a', role: 'arrival', target: 6.4, ratio: 6.4 }] });
    expect([model.measured, model.laws.map((l) => l.id)]).toEqual(['model', ['focus']]);
  });
});
