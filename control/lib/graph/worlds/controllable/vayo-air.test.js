import { describe, it, expect } from 'vitest';
import { composeLive, emissionSource } from './compose.js';
import { blockMatter } from '../../rupa/matter.js';

const CW = composeLive();
const A = CW.vayoAir;
const block = (id, min, max, matter) => ({ id, min, max, hp: 1, ...blockMatter({ min, max }, matter) });
const world = (breakables, { air = true, rupa = {} } = {}) => CW.createWorld({ entities: [], breakables, rupa, ...(air ? { vayoAir: true } : {}) });
const step = (w, n = 1) => { for (let i = 0; i < n; i++) CW.stepWorld(w, {}, 1 / 60, { ground: () => 0 }); return w; };
const get = (w, id) => w.breakables.find((b) => b.id === id);
let seq = 0;
const burst = (w, pos, radius) => { (w.bursts || (w.bursts = [])).push({ seq: seq++, pos, t: w.time, radius }); };
const light = (w, id) => { const b = get(w, id); CW.heatBlock(w, id, b.rupa.heatCap * 400); return b; };
// a pine crate 40 cm across, its foot at x (a campfire's size of fire: its limit about 37 m/s)
const crate = (id, x, y = 0) => block(id, [x, y, 0], [x + 0.4, y + 0.4, 0.4], 'pine');
// a grenade: a kilogram, its fireball 4 m
const GRENADE = 4;

describe('vayo-air: the law', () => {
  it('a blast\'s wind falls with the scaled distance, and a bigger charge carries it farther', () => {
    const u = [2, 5, 10, 20].map((d) => A.blastWind(1, d));
    for (let i = 1; i < u.length; i++) expect(u[i]).toBeLessThan(u[i - 1]);
    // a kilogram's: hundreds of m/s close in, a strong wind at 20 m (Kinney–Graham, Rankine–Hugoniot)
    expect(u[0]).toBeGreaterThan(200); expect(u[3]).toBeGreaterThan(5); expect(u[3]).toBeLessThan(20);
    // cube-root scaling: eight times the charge has the same wind at twice the distance
    expect(A.blastWind(8, 10)).toBeCloseTo(A.blastWind(1, 5), 6);
    expect(A.blastWind(0, 5)).toBe(0);
  });

  it('a bigger flame takes more air to strip: a gale puts out a torch, not a campfire', () => {
    const candle = A.blowout(0.012), torch = A.blowout(0.07), campfire = A.blowout(0.55);
    expect(candle).toBeCloseTo(3, 6);
    expect(candle).toBeLessThan(torch); expect(torch).toBeLessThan(campfire);
    expect(torch).toBeLessThan(25); expect(campfire).toBeGreaterThan(25);   // a 25 m/s gale
  });

  it('three zones: fanned under half the limit (the bellows\' law), straining to it', () => {
    expect(A.fanOf(0, 40)).toBe(1);
    expect(A.fanOf(10, 40)).toBeCloseTo(1.7, 6);
    expect(A.fanOf(30, 40)).toBe(A.fanOf(20, 40));   // no more feeding past half the limit
    expect(A.strainOf(10, 40)).toBe(0);
    expect(A.strainOf(30, 40)).toBeCloseTo(0.5, 6);
    expect(A.strainOf(50, 40)).toBe(1);
  });

  it('inside a burst\'s fireball no air is reckoned (its heat\'s), and a wall between shelters a fire', () => {
    const w = world([]);
    const g = { at: [0, 0, 0.5], kg: 1, r: 2 };
    expect(A.peakAt(w, g, [1.5, 0, 0.5])).toBe(0);
    const open = A.peakAt(w, g, [6, 0, 0.5]);
    expect(open).toBeCloseTo(A.blastWind(1, 6), 6);
    w.colliders = [{ min: [3, -2, 0], max: [3.4, 2, 3] }];
    expect(A.peakAt(w, g, [6, 0, 0.5])).toBeCloseTo(open * A.SHADOW, 6);
  });
});

describe('vayo-air on the physics: fanned, blown out, relit', () => {
  it('a world without it keeps every byte and every behaviour', () => {
    expect(emissionSource({ rupa: true })).not.toContain('vayo-air');
    expect(emissionSource({ rupa: true, vayoAir: true })).toContain('vayo-air');
    const run = (air) => { const w = world([crate('a', 7)], { air }); light(w, 'a'); burst(w, [0, 0.2, 0.2], GRENADE); step(w, 30); return get(w, 'a').rupa; };
    const off = run(false);
    expect(off.air).toBeUndefined();
    expect(off.burning).toBe(true);
  });

  it('a lone fire near a blast is blown out, with a wisp off its bed, and stays out', () => {
    const w = world([crate('a', 5)]);
    light(w, 'a'); step(w);
    burst(w, [0, 0.2, 0.2], GRENADE);
    step(w);
    const a = get(w, 'a');
    expect(a.rupa.burning).toBe(false);
    expect(w.rupa.hits.some((h) => h.id === 'a' && h.how === 'blowout')).toBe(true);
    expect(a.rupa.T).toBeLessThan(a.rupa.ignite);
    expect(a.rupa.air.blown).toBe(w.time - 1 / 60);
    const wisp = w.rupa.smoke.filter((s) => s.id === 'a' && s.kind === 'fire' && s.yield > 0.015);
    expect(wisp).toHaveLength(1);
    expect(wisp[0].t1).toBeGreaterThan(wisp[0].t0);
    step(w, 600);
    expect(a.rupa.burning).toBe(false);
  });

  it('one beside a fire still burning is relit by it within a couple of seconds', () => {
    // two crates side by side; a stone pillar shelters the far one from the blast, which blows out the near one; the far
    // one keeps burning and relights it
    const w = CW.createWorld({ entities: [], breakables: [crate('near', 5, 0), crate('far', 5, 0.4)], rupa: {}, vayoAir: true, colliders: [{ min: [4.5, 0.4, 0], max: [4.8, 0.8, 2] }] });
    light(w, 'near'); light(w, 'far'); step(w);
    burst(w, [0, 0.2, 0.2], GRENADE);
    step(w);
    expect(get(w, 'near').rupa.burning).toBe(false);
    expect(get(w, 'far').rupa.burning).toBe(true);
    step(w, 180);
    expect(get(w, 'near').rupa.burning).toBe(true);
    expect(w.rupa.hits.filter((h) => h.id === 'near' && h.how === 'ignite')).toHaveLength(2);
  });

  it('a fire past its limit\'s half is fanned: it burns faster for a moment, then settles back', () => {
    const w = world([crate('a', 14)]);
    const a = light(w, 'a'); step(w);
    const base = a.rupa.burnRate;
    burst(w, [0, 0.2, 0.2], GRENADE);
    step(w, 2);
    expect(a.rupa.burning).toBe(true);
    expect(a.rupa.burnRate).toBeGreaterThan(base);
    expect(a.rupa.air.strain).toBeGreaterThanOrEqual(0);
    step(w, 60 * 12);
    expect(a.rupa.burnRate / base).toBeCloseTo(1, 2);
  });

  it('inside the fireball the heat wins: what it reaches catches and is not blown out', () => {
    const w = world([crate('a', 2)]);
    burst(w, [0, 0.2, 0.2], GRENADE);
    step(w, 2);
    const a = get(w, 'a');
    expect(w.rupa.hits.some((h) => h.id === 'a' && h.how === 'blowout')).toBe(false);
    expect(a.rupa.burning || !!a.broken).toBe(true);
  });

  it('a gale past a fire\'s limit blows it out; a breeze fans it', () => {
    const gale = world([crate('a', 0)], { rupa: { wind: { speed: 60, dir: 0 } } });
    light(gale, 'a'); step(gale, 20);
    expect(gale.rupa.hits.some((h) => h.id === 'a' && h.how === 'blowout' && h.by === 'wind')).toBe(true);
    const breeze = world([crate('a', 0)], { rupa: { wind: { speed: 8, dir: 0 } } });
    const a = light(breeze, 'a'); const base = a.rupa.burnRate; step(breeze, 20);
    expect(a.rupa.burning).toBe(true);
    expect(a.rupa.burnRate).toBeGreaterThan(base);
  });

  it('the page\'s air: outward from a recent blast, gone a couple of seconds later', () => {
    const w = world([]);
    burst(w, [0, 0, 0.5], GRENADE);
    step(w);
    const u = A.gustAt(w, [8, 0, 0.5]);
    expect(u[0]).toBeGreaterThan(1); expect(Math.abs(u[1])).toBeLessThan(1e-9);
    step(w, 150);
    expect(Math.hypot(...A.gustAt(w, [8, 0, 0.5]))).toBeLessThan(0.1);
  });
});
