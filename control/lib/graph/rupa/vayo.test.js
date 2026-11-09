// RUPA-VAYO (rupa/vayo.js): the air round a spot, presolved once, and each tracer's path a formula of time. The laws
// hold as shapes and scalings (the time is stretched for the eye); the same effect differs by where it goes off.
import { describe, it, expect } from 'vitest';
import { vayoEnvelope, vayoPoints } from './vayo.js';

const box = (min, max) => ({ min, max });
const spray = (flow, extra = {}) => ({ flow, count: 60, life: 2, size: 0.5, env: 'out', ...extra });
const live = (pts) => pts.filter((q) => q.w > 0);
const mean = (pts, k) => live(pts).reduce((s, q) => s + q.p[k], 0) / Math.max(1, live(pts).length);
const extent = (pts, k) => { const L = live(pts).map((q) => q.p[k]); return Math.max(...L) - Math.min(...L); };

describe('the envelope: what the spot is', () => {
  it('on open ground the sky is open and the ground is shut', () => {
    const E = vayoEnvelope([0, 0, 0], { size: 1.5 });
    const up = E.dirs.filter((x) => x.d[2] > 0.3), down = E.dirs.filter((x) => x.d[2] < -0.3);
    expect(up.every((x) => x.open === 1)).toBe(true);
    expect(Math.max(...down.map((x) => x.open))).toBeLessThan(0.1);
    expect(E.medium).toBe('air');
  });

  it('a wall shuts its side; a corridor opens two ways; a ceiling flattens the dome', () => {
    const wall = vayoEnvelope([0, 0, 0], { size: 1.5, colliders: [box([1, -10, -1], [2, 10, 10])] });
    const east = wall.dirs.filter((x) => x.d[0] > 0.6 && x.d[2] >= 0), west = wall.dirs.filter((x) => x.d[0] < -0.6 && x.d[2] > 0);
    expect(Math.max(...east.map((x) => x.open))).toBeLessThan(0.5);
    expect(east.every((x) => x.n && x.n[0] === -1)).toBe(true);   // the face it meets, to slide along
    expect(west.every((x) => x.open === 1)).toBe(true);
    const hall = vayoEnvelope([0, 0, 0], { size: 1.5, colliders: [box([-20, 1, -1], [20, 2, 4]), box([-20, -2, -1], [20, -1, 4]), box([-20, -2, 2.5], [20, 2, 3])] });
    const way = (k) => { const L = hall.dirs.filter((x) => Math.abs(x.d[k]) > 0.8 && x.d[2] > 0.05); return L.reduce((s, x) => s + x.open, 0) / L.length; };
    expect(way(0)).toBeGreaterThan(2 * way(1));
  });

  it('a spot in a pool is in water', () => {
    expect(vayoEnvelope([0, 0, -1], { pools: [box([-5, -5, -3], [5, 5, 0])] })).toMatchObject({ medium: 'water', surface: 0 });
  });
});

describe('the laws along the flow', () => {
  it('a blast\'s front races out and holds: half its reach in under a fifth of its time (r ∝ t^⅖)', () => {
    const E = vayoEnvelope([0, 0, 0], { size: 2 }), S = spray('core', { front: 0.25, count: 120, rise: 0, roll: 0, swirl: 0 });
    const r = (t) => { const L = live(vayoPoints(S, E, t)); return Math.max(...L.map((q) => Math.hypot(q.p[0], q.p[1], q.p[2]))); };
    const end = r(0.5 * 0.95);   // just before the stall (its life × its front share)
    expect(r(0.5 * 0.18)).toBeGreaterThan(0.45 * end);
    expect(r(0.5 * 0.02)).toBeGreaterThan(0.15 * end);
    expect(end).toBeLessThanOrEqual(2.15);   // (its reach, from the spot lifted off its floor)
  });

  it('what a wall stops slides along it: nothing passes the face, and a corridor carries it far', () => {
    const E = vayoEnvelope([0, 0, 0], { size: 2, colliders: [box([1, -10, -1], [2, 10, 10])] }), S = spray('core', { count: 160, rise: 0, roll: 0, swirl: 0 });
    for (const t of [0.2, 0.5, 1]) expect(Math.max(...live(vayoPoints(S, E, t)).map((q) => q.p[0]))).toBeLessThan(1);
    const hall = vayoEnvelope([0, 0, 0.5], { size: 2, colliders: [box([-20, 0.8, -1], [20, 2, 4]), box([-20, -2, -1], [20, -0.8, 4]), box([-20, -2, 2.6], [20, 2, 3])] });
    for (const q of live(vayoPoints(spray('core', { count: 160, rise: 0, roll: 0, swirl: 0 }), hall, 0.6))) expect(Math.abs(q.p[1])).toBeLessThan(0.8);
    const pts = vayoPoints(spray('core', { count: 160, rise: 0, roll: 0, swirl: 0 }), hall, 0.6);
    expect(extent(pts, 0)).toBeGreaterThan(2 * extent(pts, 1));
  });

  it('a hot core lifts after its front stalls, less in thin air; it curls as it climbs', () => {
    const S = spray('core', { count: 120 }), at = [0, 0, 0];
    const z = (E, t) => mean(vayoPoints(S, E, t), 2);
    const air = vayoEnvelope(at, { size: 1.5 }), thin = vayoEnvelope(at, { size: 1.5, density: 0.12 });
    expect(z(air, 1.6)).toBeGreaterThan(z(air, 0.4) + 0.5);
    expect(z(thin, 1.6)).toBeLessThan(z(air, 1.6));
  });

  it('smoke climbs as a plume and leans downwind; with no wind it stands over the spot', () => {
    const S = spray('smoke', { count: 80, life: 4 });
    const still = vayoPoints(S, vayoEnvelope([0, 0, 0], { size: 1.5 }), 3), windy = vayoPoints(S, vayoEnvelope([0, 0, 0], { size: 1.5, wind: [6, 0] }), 3);
    expect(Math.abs(mean(still, 0))).toBeLessThan(0.3);
    expect(mean(windy, 0)).toBeGreaterThan(8);
    expect(Math.abs(mean(windy, 1))).toBeLessThan(0.5);
    expect(mean(still, 2)).toBeGreaterThan(mean(vayoPoints(S, vayoEnvelope([0, 0, 0], { size: 1.5 }), 1), 2));
  });

  it('a vortex turns its core faster than its outside (Lamb–Oseen), not like a plate', () => {
    const E = vayoEnvelope([0, 0, 0], { size: 2 }), S = spray('column', { count: 1, life: 100, r: 2, swirl: 1, height: 0.001 });
    // one tracer near the axis and one far out: their turn over the same time
    const angle = (r, t) => { const q = vayoPoints({ ...S, r }, E, t)[0]; return Math.atan2(q.p[1], q.p[0]); };
    const dA = (r) => { let d = angle(r, 0.6) - angle(r, 0.5); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };
    expect(dA(0.4)).toBeGreaterThan(3 * dA(4));
  });

  it('a charge draws in: every mote nearer the middle as it ages', () => {
    const E = vayoEnvelope([0, 0, 1], { size: 2 }), S = spray('inflow', { count: 30, life: 1, stagger: 0 });
    const r = (t) => live(vayoPoints(S, E, t)).map((q) => Math.hypot(q.p[0], q.p[1], q.p[2] - 1));
    const a = r(0.2), b = r(0.7);
    expect(Math.max(...b)).toBeLessThan(Math.max(...a));
  });

  it('the dust skirt runs along the ground, wider than the fireball, never under the floor', () => {
    const E = vayoEnvelope([0, 0, 0], { size: 1.5 }), pts = live(vayoPoints(spray('skirt', { count: 80 }), E, 1));
    expect(Math.max(...pts.map((q) => Math.hypot(q.p[0], q.p[1])))).toBeGreaterThan(2);
    expect(Math.min(...pts.map((q) => q.p[2]))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...pts.map((q) => q.p[2]))).toBeLessThan(1.5);
  });

  it('a streak reads its flight; the same seed gives the same frames', () => {
    const E = vayoEnvelope([0, 0, 0], { size: 1.5, wind: [2, 1] }), S = spray('embers', { glyph: 'streak', v: 8 });
    expect(live(vayoPoints(S, E, 0.1)).some((q) => Math.hypot(...q.v) > 1)).toBe(true);
    expect(JSON.stringify(vayoPoints(spray('core'), E, 0.7))).toBe(JSON.stringify(vayoPoints(spray('core'), vayoEnvelope([0, 0, 0], { size: 1.5, wind: [2, 1] }), 0.7)));
  });

  it('carries itself: both run from their own source alone', () => {
    const env = new Function(`return (${vayoEnvelope.toString()})`)(), pts = new Function(`return (${vayoPoints.toString()})`)();
    expect(pts(spray('core'), env([0, 0, 0], { size: 1 }), 0.5).length).toBe(60);
  });
});
