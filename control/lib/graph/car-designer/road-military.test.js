// The field's vehicles: the hull kit's solids (a plate flat to its edge and round at it, a tube's radial normals, a weld
// and its ripple, a bolt's flats), and a military class compiled at its class's true numbers, every face a material, its
// normals worked out, within its budget, the same twice; read through the registry by the word people say, driven as a
// realistic ride, and the classes whose bodies wait refused with what they need. One class per concept, chosen in code.
import { describe, it, expect } from 'vitest';
import { plate, tube, bend, bolts, weld, flatNormals } from './mil-hull.js';
import { MILITARY_CLASSES, MIL_MATERIALS, militaryAxles } from './road-military.js';
import { compileRealistic } from './realistic.js';
import { rollVehicleSheet, UNBUILT } from './sheet.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { VEHICLES, resolveVehicle, rowOfHandle } from '../vehicle-registry/roster.js';
import { buildsOf, upscaleOf } from '../vehicle-registry/builds.js';
import { rideOf, rideableRows } from '../vehicle-registry/ride.js';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unitLen = (n) => Math.abs(Math.hypot(...n) - 1) < 1e-4;
const polyArea = (c) => { const n = [0, 0, 0]; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += a[1] * b[2] - a[2] * b[1]; n[1] += a[2] * b[0] - a[0] * b[2]; n[2] += a[0] * b[1] - a[1] * b[0]; } return Math.hypot(...n) / 2; };
const LOOK = { part: 'p', material: 'milPaint', albedo: '#4b5320' };
const FIELD = Object.keys(MILITARY_CLASSES)[0];
const WAITING = Object.keys(PHYSICS).filter((k) => UNBUILT[k] && rowOfHandle('physics', k) && VEHICLES[rowOfHandle('physics', k)].role !== 'racer');
const field = (opts = {}) => compileRealistic(rollVehicleSheet({ facets: { pole: 'realistic', class: FIELD }, seed: 3 }), opts);

describe('the hull kit', () => {
  const box = plate({ axis: 'y', profile: [[-0.5, 0], [0.5, 0], [0.5, 0.4], [-0.5, 0.4]], from: -1, to: 1, r: 0.05, seg: 2, look: LOOK });
  it('a plate is flat to its edge and round at it: the flat faces keep their own normal, the rounds turn through theirs', () => {
    const flats = box.filter((f) => !f.edge), rounds = box.filter((f) => f.edge);
    expect(flats.length).toBe(6);
    for (const f of flats) expect(f.cornerNormals ?? null).toBe(null);
    for (const f of rounds) {
      expect(f.cornerNormals.every(unitLen)).toBe(true);
      // (each round's corner normals lie between the faces it joins: never against its own outward normal)
      for (const n of f.cornerNormals) expect(dot(n, f.outNormal)).toBeGreaterThan(0.5);
    }
    // its area is the rounded box's: the flats less the round's bite, the quarter-cylinders and the sphere's eighths
    const r = 0.05, [a, b, c] = [1, 2, 0.4].map((d) => d - 2 * r);
    const exact = 2 * (a * b + b * c + a * c) + 2 * Math.PI * r * (a + b + c) + 4 * Math.PI * r * r;
    const got = box.reduce((s, f) => s + polyArea(f.corners), 0);
    expect(got / exact).toBeGreaterThan(0.97);
    expect(got / exact).toBeLessThan(1.001);
  });
  it('a sharp plate is its six faces; a round too big for the plate is shrunk to fit', () => {
    expect(plate({ axis: 'z', profile: [[0, 0], [1, 0], [1, 1], [0, 1]], from: 0, to: 0.1, look: LOOK })).toHaveLength(6);
    const thin = plate({ axis: 'x', profile: [[0, 0], [1, 0], [1, 0.5], [0, 0.5]], from: 0, to: 0.02, r: 0.3, look: LOOK });
    const xs = thin.flatMap((f) => f.corners.map((c) => c[0]));
    expect(Math.min(...xs)).toBeCloseTo(0, 6);
    expect(Math.max(...xs)).toBeCloseTo(0.02, 6);
  });
  it('a tube\'s normals are radial; a bend rounds its corner; a bolt has flats; a weld ripples', () => {
    const path = bend([[0, 0, 0], [0, 0, 1], [1, 0, 1]], 0.2, 4);
    expect(path.length).toBe(3 + 4);
    const t = tube(path, 0.03, { sides: 8, look: LOOK });
    for (const f of t.filter((g) => g.cornerNormals)) expect(f.cornerNormals.every(unitLen)).toBe(true);
    const b = bolts([[0, 0, 0]], [0, 0, 1], { look: LOOK });
    expect(b).toHaveLength(6 + 2);
    expect(b.every((f) => !f.cornerNormals)).toBe(true);
    const w = weld([0, 0, 0], [0.35, 0, 0], [0, 0, 1], { step: 0.035, look: LOOK });
    expect(w).toHaveLength(20);
    // (its ridge alternates between a tack's height and the run between)
    expect(new Set(w.flatMap((f) => f.corners.map((c) => c[2])).filter((z) => z > 1e-6).map((z) => z.toFixed(4))).size).toBe(2);
    expect(flatNormals(b).every((f) => f.cornerNormals.length === f.corners.length)).toBe(true);
  });
});

describe('a field vehicle compiled at its class\'s numbers', () => {
  const c = field({ form: true });
  const all = Object.values(c.form).flat();
  it('is the class\'s size, its wheels where the class puts them', () => {
    for (const k of ['L', 'W', 'H', 'wheelbase', 'wheelRadius']) { expect(c.census.against[k], k).toBeGreaterThan(0.99); expect(c.census.against[k], k).toBeLessThan(1.01); }
    const axles = militaryAxles(FIELD);
    expect(axles[0] - axles[1]).toBeCloseTo(PHYSICS[FIELD].wheelbase, 6);
    expect(c.rule).toMatchObject({ type: 'drive', vehicle: FIELD });
  });
  it('every face named, given a material the figure carries, and its corner normals unit', () => {
    for (const f of all) {
      expect(f.part && f.albedo).toBeTruthy();
      expect(MIL_MATERIALS).toHaveProperty(f.material);
      expect(f.cornerNormals).toHaveLength(f.corners.length);
      expect(f.cornerNormals.every(unitLen)).toBe(true);
    }
    const mats = new Set(all.map((f) => f.material));
    for (const m of ['milPaint', 'canvas', 'weld', 'steel', 'glass', 'rubber']) expect(mats.has(m), m).toBe(true);
    expect(c.figure.form.materials).toBe(MIL_MATERIALS);
    expect(all.some((f) => f.edge)).toBe(true);
  });
  it('within a game\'s budget, the same twice, and its figure without the form render the same rig baked', () => {
    expect(all.reduce((s, f) => s + f.corners.length - 2, 0)).toBeLessThan(25000);
    expect(JSON.stringify(field({ form: true }).form)).toBe(JSON.stringify(c.form));
    const baked = field();
    expect(baked.form).toBeUndefined();
    expect(baked.figure.form).toBeUndefined();
    expect(baked.figure.bones.map((b) => b.id)).toEqual(c.figure.bones.map((b) => b.id));
    expect(baked.census).toEqual(c.census);
  });
});

describe('through the registry', () => {
  const id = rowOfHandle('physics', FIELD);
  it('the word people say names its row, whose realistic build is the hull kit\'s, live, and driven as a ride', () => {
    expect(resolveVehicle(VEHICLES[id].aliases[0]).id).toBe(id);
    const real = buildsOf(id).find((b) => b.tier === 'realistic');
    expect(real).toMatchObject({ via: 'loft', key: FIELD, status: 'live' });
    expect(real.why).toMatch(/hull kit/);
    expect(upscaleOf(id).realistic).toBe('live');
    expect(rideableRows()).toContain(id);
    expect(rideOf({ ride: id, tier: 'realistic' })).toMatchObject({ kind: 'loft', class: FIELD });
  });
  it('a field class whose body waits is named and searchable, refused as a ride, and says what it needs', () => {
    expect(WAITING.length).toBeGreaterThan(0);
    const wid = rowOfHandle('physics', WAITING[0]);
    expect(rideableRows()).not.toContain(wid);
    expect(upscaleOf(wid)).toMatchObject({ realistic: 'none' });
    expect(upscaleOf(wid).next).toMatch(/not built yet/);
    expect(() => rollVehicleSheet({ facets: { pole: 'realistic', class: WAITING[0] }, seed: 1 })).toThrow(/not built yet/);
  });
});
