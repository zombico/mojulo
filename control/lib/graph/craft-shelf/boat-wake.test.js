// A boat underway (boat-wake.js through assembleCraft's `underway`): its numbers from its own hull at its waterline
// (Froude by its waterline length, its volume's Froude, the regime, Kelvin's angle narrowing past Fr 0.5, the
// transverse and divergent waves), its wake drawn on the water as one more item (its Kelvin crests behind the bow and
// outside the hull, its edges, its bow wave, its stern's foam, its wash, its spray and rooster tails on the plane), its
// drives the hull's own; absent, nothing drawn or read. The cases are chosen from the shelf in code.
import { describe, it, expect } from 'vitest';
import { assembleCraft, CRAFT_ARCHETYPES as A, CRAFT_ODM } from './index.js';
import { hullSection } from './boat-parts.js';
import { G, waterplane, boatWake } from './boat-wake.js';

const water = Object.keys(A).filter((k) => A[k].realm === 'water');
const hullOf = (k) => CRAFT_ODM[A[k].layout[0].sku];
// (a light boat on an outboard: it planes; a ship with its own sea boat stowed aboard and screws: it displaces; a round hull)
const PLANER = water.find((k) => A[k].layout.some((e) => CRAFT_ODM[e.sku].kind === 'boat-outboard' && e.at?.startsWith(`${A[k].layout[0].id}.`)));
const SHIP = water.find((k) => A[k].layout.some((e) => CRAFT_ODM[e.sku].kind === 'boat-shaft') && A[k].layout.some((e, i) => i > 0 && CRAFT_ODM[e.sku].kind === 'boat-hull'));
const ROUND = water.find((k) => hullOf(k).build.family === 'round');
const deg = Math.PI / 180;

describe('a boat underway: its numbers from its own hull', () => {
  const { readout } = assembleCraft(SHIP, { underway: { knots: 20 } }), U = readout.underway, HR = hullOf(SHIP);
  it('reads its waterline where its sections cross the water, and its Froude numbers by it and its volume', () => {
    const W = waterplane(HR, readout.afloat.draft, hullSection);
    expect(W.length).toBeLessThanOrEqual(HR.dims.length + 1e-9);
    expect(W.length).toBeGreaterThan(0.8 * HR.dims.length);
    expect(W.beam).toBeLessThanOrEqual(HR.dims.beam + 0.1);
    expect(U.speed).toBeCloseTo(20 * 0.514444, 2);
    expect(U.froude).toBeCloseTo(U.speed / Math.sqrt(G * W.length), 3);
    expect(U.froudeVolume).toBeCloseTo(U.speed / Math.sqrt(G * Math.cbrt(readout.afloat.volume)), 3);
    expect(U.wavelength).toBeCloseTo(2 * Math.PI * U.speed ** 2 / G, 2);
  });
  it('Kelvin\'s angle on a slow hull, narrowing as it goes faster; its divergent waves on Kelvin\'s own root', () => {
    expect(U.angle).toBeCloseTo(Math.asin(1 / 3) / deg, 2);
    expect(U.divergent.direction).toBeCloseTo(35.264, 2);
    expect(U.divergent.wavelength).toBeCloseTo(U.wavelength * (2 / 3), 1);
    const fast = [10, 20, 30].map((kn) => assembleCraft(PLANER, { underway: { knots: kn } }).readout.underway);
    for (const f of fast) {
      if (f.froude > 0.5) expect(f.angle).toBeLessThan(19.47);
      const ta = Math.tan(f.angle * deg), tt = Math.tan(f.divergent.direction * deg);
      expect(tt / (1 + 2 * tt * tt)).toBeCloseTo(ta, 3);
    }
    expect(fast[2].angle).toBeLessThan(fast[1].angle);
  });
  it('a light chined hull planes at speed, a ship displaces at its, a round hull never planes', () => {
    expect(assembleCraft(PLANER, { underway: { knots: 25 } }).readout.underway.regime).toBe('planing');
    expect(assembleCraft(PLANER, { underway: { knots: 3 } }).readout.underway.regime).toBe('displacement');
    expect(U.regime).toBe('displacement');
    const r = assembleCraft(ROUND, { underway: { knots: 40 } }).readout.underway;
    expect(r.froudeVolume).toBeGreaterThan(1);
    expect(r.regime).toBe('displacement');
  });
  it('its drives are its hull\'s own: a stowed sea boat\'s motor drives nothing; a round hull\'s screw does', () => {
    expect(U.drives.map((d) => d.kind).sort()).toEqual(A[SHIP].layout.filter((e) => e.at?.startsWith(`${A[SHIP].layout[0].id}.`) && ['boat-shaft', 'boat-jet', 'boat-outboard'].includes(CRAFT_ODM[e.sku].kind)).flatMap((e) => (e.pair ? ['shaft', 'shaft'] : ['shaft'])).sort());
    expect(assembleCraft(ROUND, { underway: { knots: 10 } }).readout.underway.drives.map((d) => d.kind)).toEqual(['screw']);
  });
  it('asks for a speed; a stopped boat is not underway', () => {
    expect(() => assembleCraft(PLANER, { underway: {} })).toThrow(/speed/);
    expect(boatWake({ row: hullOf(PLANER), draft: 0.1, volume: 0.3, speed: 0, section: hullSection })).toBe(null);
  });
});

describe('a boat underway: its wake on the water', () => {
  const still = assembleCraft(SHIP), moving = assembleCraft(SHIP, { underway: { knots: 20 } });
  const wake = moving.manifest.items.find((i) => i.id === 'wake'), HR = hullOf(SHIP), U = moving.readout.underway;
  it('absent, nothing of it: the same manifest and readout; asked, one item on the water, the boat unchanged', () => {
    expect(still.manifest.items.some((i) => i.id === 'wake')).toBe(false);
    expect(still.readout).not.toHaveProperty('underway');
    expect(JSON.stringify(moving.manifest.items.filter((i) => i.id !== 'wake'))).toBe(JSON.stringify(still.manifest.items));
    expect(moving.readout.measures).toEqual(still.readout.measures);
    expect(wake.at[2]).toBe(moving.readout.afloat.waterline);
    expect(JSON.stringify(assembleCraft(SHIP, { underway: { knots: 20 } }).manifest)).toBe(JSON.stringify(moving.manifest));
  });
  it('a displacing hull\'s Kelvin crests: the nth on the track n wavelengths behind its bow, none on the hull', () => {
    const crests = wake.source.sweeps.filter((s) => /^crest_\d+r$/.test(s.id));
    expect(crests.length).toBeGreaterThan(0);
    const W = waterplane(HR, moving.readout.afloat.draft, hullSection);
    for (const c of crests) {
      const n = Number(c.id.match(/\d+/)[0]), inner = c.path.reduce((a, p) => (Math.abs(p[0]) < Math.abs(a[0]) ? p : a));
      if (Math.abs(inner[0]) < 1) expect(inner[1]).toBeCloseTo(U.waterline.fore - n * U.wavelength, 0);
      for (const p of c.path) if (p[1] > W.aft) expect(Math.abs(p[0])).toBeGreaterThan(W.halfAt(p[1]));
    }
    // (its edges leave the bow's shoulders at Kelvin's angle)
    const e = wake.source.sweeps.find((s) => s.id === 'edge_r').path, [a, b] = [e[0], e.at(-1)];
    expect(Math.atan2(b[0] - a[0], a[1] - b[1]) / deg).toBeCloseTo(U.angle, 1);
    expect(wake.source.extrudes.some((x) => /^bow_wave_/.test(x.id))).toBe(true);
    expect(wake.source.extrudes.some((x) => x.id === 'stern_wake')).toBe(true);
    expect(wake.source.extrudes.filter((x) => /^wash_/.test(x.id)).length).toBe(U.drives.length);
  });
  it('a planing hull\'s: no Kelvin crests, its divergent waves along its edges, its spray, a rooster tail, no bow wave', () => {
    const P = assembleCraft(PLANER, { underway: { knots: 25 } }), w = P.manifest.items.find((i) => i.id === 'wake').source;
    expect(w.sweeps.some((s) => /^crest_/.test(s.id))).toBe(false);
    expect(w.sweeps.some((s) => /^divergent_/.test(s.id))).toBe(true);
    expect(w.lofts.filter((l) => /^spray_/.test(l.id)).length).toBe(2);
    expect(w.lofts.some((l) => /^rooster_/.test(l.id))).toBe(true);
    expect(w.extrudes.some((x) => /^bow_wave_/.test(x.id))).toBe(false);
    // (a displacing hull throws neither)
    expect(wake.source.lofts.length).toBe(0);
  });
});
