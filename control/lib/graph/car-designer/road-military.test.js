// The field's vehicles: the hull kit's solids (a plate flat to its edge and round at it, a tube's radial normals, a weld
// and its ripple, a bolt's flats), and a military class compiled at its class's true numbers, every face a material, its
// normals worked out, within its budget, the same twice; read through the registry by the word people say, driven as a
// realistic ride, and the classes whose bodies wait refused with what they need. One class per concept, chosen in code.
import { describe, it, expect } from 'vitest';
import { plate, tube, bend, bolts, weld, flatNormals } from './mil-hull.js';
import { MILITARY_CLASSES, MIL_MATERIALS, militaryAxles, militaryBody, KITS } from './road-military.js';
import { milWheel } from './mil-wheel.js';
import { FITTINGS, fit } from './mil-fittings.js';
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
  it('is the class\'s size, its wheels where the class puts them (the hull measured: its fittings hang off it)', () => {
    for (const k of ['W', 'H', 'wheelbase', 'wheelRadius']) { expect(c.census.against[k], k).toBeGreaterThan(0.99); expect(c.census.against[k], k).toBeLessThan(1.01); }
    // (its length the class's with what hangs off its ends: the hull a little short of it)
    expect(c.census.against.L).toBeGreaterThan(0.96);
    expect(c.census.against.L).toBeLessThanOrEqual(1);
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

describe('the field\'s wheel', () => {
  const r = 0.41, w = 0.3, wheel = milWheel({ hub: [0.81, 0, r], r, width: w, lugs: 20 });
  it('its tread is lugs standing proud of the crown, two rows offset and angled, a block\'s five faces each', () => {
    const lugs = wheel.filter((f) => f.part === 'tyre.lug');
    expect(lugs).toHaveLength(20 * 2 * 5);
    const rad = (p) => Math.hypot(p[1], p[2] - r);
    expect(Math.max(...lugs.flatMap((f) => f.corners.map(rad)))).toBeCloseTo(r, 3);
    expect(Math.max(...wheel.filter((f) => f.part === 'tyre').flatMap((f) => f.corners.map(rad)))).toBeLessThan(r * 0.96);
  });
  it('its rim in the paint, bolted; every face a material and its normals unit; its face along the axis asked', () => {
    const mats = new Set(wheel.map((f) => f.material));
    for (const m of ['rubber', 'milPaint', 'steel']) expect(mats.has(m), m).toBe(true);
    for (const f of wheel) expect(f.cornerNormals.every(unitLen)).toBe(true);
    // (the valve's cap looks out along the axle, +x for a right-hand wheel)
    expect(Math.max(...wheel.filter((f) => f.part === 'wheel.valve').map((f) => f.outNormal[0]))).toBeCloseTo(1, 3);
    const lying = milWheel({ hub: [0, 0, 1], r, width: w, axis: [0, 0, 1] });
    expect(Math.max(...lying.flatMap((f) => f.corners.map((p) => p[2]))) - 1).toBeGreaterThan(w / 2);
    expect(Math.min(...lying.flatMap((f) => f.corners.map((p) => p[2]))) - 1).toBeGreaterThan(-w);
  });
});

describe('the fittings: cards set on the anchors a body declares', () => {
  const ctx = { r: 0.41, tyreW: 0.3, paint: '#4b5320', seed: 1 };
  it('each card builds on the outward side of an anchor of a kind it fits, and refuses a kind it does not', () => {
    for (const [card, F] of Object.entries(FITTINGS)) {
      const A = { id: 'a', kind: F.fits[0], at: [0.2, -0.4, 0.9], out: [0, -1, 0], up: [0, 0, 1] };
      const faces = fit(A, card, ctx);
      expect(faces.length, card).toBeGreaterThan(0);
      for (const f of faces) for (const p of f.corners) expect(-(p[1] - A.at[1]), card).toBeGreaterThan(-0.025);
      const other = Object.keys(FITTINGS).flatMap((k) => FITTINGS[k].fits).find((k) => !F.fits.includes(k));
      expect(() => fit({ ...A, kind: other }, card, ctx), card).toThrow(/fits a/);
    }
  });
  it('a body\'s kit sets each card on an anchor it declares, and its dice choose among the kit', () => {
    const kind = MILITARY_CLASSES[FIELD], B = militaryBody(FIELD, { seed: 1 }), ids = new Set(B.anchors.map((a) => a.id));
    for (const [id] of KITS[kind]) expect(ids.has(id), id).toBe(true);
    const maybe = KITS[kind].find(([, , o]) => o?.maybe !== undefined)[1];
    const carries = Array.from({ length: 40 }, (_, k) => militaryBody(FIELD, { seed: k + 1 }).fittings.some((f) => f.fitting === maybe));
    expect(carries).toContain(true);
    expect(carries).toContain(false);
    expect(B.fittings.every((f) => f.fitting && f.cornerNormals)).toBe(true);
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
