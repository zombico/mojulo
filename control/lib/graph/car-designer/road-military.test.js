// The field's vehicles: the hull kit's solids (a plate flat to its edge and round at it, a tube's radial normals, a weld
// and its ripple, a bolt's flats), and a military class compiled at its class's true numbers, every face a material, its
// normals worked out, within its budget, the same twice; read through the registry by the word people say, driven as a
// realistic ride, and the classes whose bodies wait refused with what they need; the slab (armour cut by its outlines,
// its edges chamfered) and the carrier built of it; the missile launcher, its missile stowed for the road or standing on
// its table. One class per concept, chosen in code.
import { describe, it, expect } from 'vitest';
import { plate, tube, bend, bolts, weld, flatNormals, slab } from './mil-hull.js';
import { MILITARY_CLASSES, MIL_MATERIALS, militaryAxles, militaryBody, KITS, launcherWords } from './road-military.js';
import { milWheel } from './mil-wheel.js';
import { FITTINGS, fit } from './mil-fittings.js';
import { CAMO, CAMO_IDS } from './livery-cut.js';
import { skyMood } from './form-light.js';
import { groundOf } from './mil-wear.js';
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
    // (a working vehicle's wear by default: its mud and chips cut in; kept, it is the hull kit's own count)
    expect(all.reduce((s, f) => s + f.corners.length - 2, 0)).toBeLessThan(45000);
    expect(Object.values(field({ form: true, wear: 'pristine' }).form).flat().reduce((s, f) => s + f.corners.length - 2, 0)).toBeLessThan(25000);
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

describe('a field vehicle in its livery', () => {
  // (kept, so the livery is seen alone: the wear dusts the rims and cuts mud into the paint)
  const camo = CAMO_IDS.find((k) => !CAMO[k].cell), plain = field({ form: true, wear: 'pristine' }), painted = field({ form: true, livery: camo, wear: 'pristine' });
  const all = Object.values(field({ form: true, livery: camo }).form).flat();
  it('its camo cut into the hull and its fittings alike, its rims in the base, its stencils on; its size unchanged', () => {
    const colours = new Set(CAMO[camo].colours);
    const hullBands = new Set(painted.form.root.filter((f) => f.material === 'milPaint' && !f.fitting).map((f) => f.albedo));
    expect([...hullBands].filter((c) => colours.has(c)).length).toBe(CAMO[camo].colours.length);
    expect(painted.form.root.some((f) => f.fitting && f.fitting !== 'mark' && colours.has(f.albedo) && f.albedo !== CAMO[camo].colours[0])).toBe(true);
    const rims = Object.entries(painted.form).filter(([b]) => b !== 'root').flatMap(([, fs]) => fs).filter((f) => f.part.startsWith('rim.') && f.material === 'milPaint');
    expect(new Set(rims.map((f) => f.albedo))).toEqual(new Set([CAMO[camo].colours[0]]));
    expect(painted.form.root.filter((f) => f.part === 'mark').length).toBeGreaterThan(0);
    expect(plain.form.root.some((f) => f.part === 'mark')).toBe(false);
    expect(painted.census).toEqual(plain.census);
  });
  it('within a hero vehicle\'s budget, every face lit', () => {
    expect(all.reduce((s, f) => s + f.corners.length - 2, 0)).toBeLessThan(55000);
    for (const f of all) expect(f.cornerNormals.every(unitLen)).toBe(true);
  });
});

describe('a field vehicle\'s wear', () => {
  const area = (fs, m) => fs.filter((f) => f.material === m).length;
  it('is a working vehicle\'s unless asked: mud and chips cut in, the sheet\'s word when a brief asks one, the operator\'s over both', () => {
    const used = Object.values(field({ form: true }).form).flat(), kept = Object.values(field({ form: true, wear: 'pristine' }).form).flat();
    expect(area(used, 'mud')).toBeGreaterThan(0);
    expect(area(kept, 'mud') + area(kept, 'worn')).toBe(0);
    const briefed = compileRealistic(rollVehicleSheet({ brief: 'beat-up', facets: { pole: 'realistic', class: FIELD }, seed: 3 }), { form: true });
    expect(area(Object.values(briefed.form).flat(), 'mud')).toBeGreaterThan(area(used, 'mud'));
    expect(MIL_MATERIALS).toHaveProperty('mud');
  });
  it('is refused on a road car, whose wear is its sheet\'s', () => {
    const road = Object.keys(PHYSICS).find((k) => !MILITARY_CLASSES[k] && !UNBUILT[k] && ['midsize', 'compact', 'pickup'].includes(k));
    expect(() => compileRealistic(rollVehicleSheet({ facets: { pole: 'realistic', class: road }, seed: 1 }), { wear: 'used' })).toThrow(/a road car's wear is its sheet's/);
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
  it('a class whose realistic body waits is named and searchable, refused as a ride, and says what it needs', () => {
    expect(WAITING.length).toBeGreaterThan(0);
    const wid = rowOfHandle('physics', WAITING[0]);
    expect(rideableRows()).not.toContain(wid);
    expect(upscaleOf(wid)).toMatchObject({ realistic: 'none' });
    expect(upscaleOf(wid).next).toMatch(/not built yet/);
    expect(() => rollVehicleSheet({ facets: { pole: 'realistic', class: WAITING[0] }, seed: 1 })).toThrow(/not built yet/);
  });
});

describe('a field vehicle in its setting', () => {
  const sky = (day, sun = null) => ({ zenith: [40, 60, 120], horizon: [230, 160, 110], day, ...(sun ? { sun: { dir: sun } } : {}) });
  const lit = (setting) => field({ form: true, setting }).figure.form;
  it('is lit by its world\'s own sky: full and warm by day, dim and cool at night, along the world\'s sun when it is up', () => {
    const day = skyMood(sky(1)), night = skyMood(sky(0.03)), up = skyMood(sky(0.6, [0.5, -0.3, 0.6])), down = skyMood(sky(0.6, [0.5, -0.3, -0.2]));
    expect(Math.max(...day.key)).toBeGreaterThan(4 * Math.max(...night.key));
    expect(night.key[2]).toBeGreaterThan(night.key[0]);
    expect(day.key[0]).toBeGreaterThanOrEqual(day.key[2]);
    expect(up.toLight).toEqual([0.5, -0.3, 0.6]);
    expect(down.toLight).toBeUndefined();
    expect(skyMood(null)).toBe(null);
    const D = lit({ sky: sky(1) }), N = lit({ sky: sky(0.03) });
    expect(N.keyIntensity).toBeLessThan(D.keyIntensity);
    expect(N.ambient).toBeLessThan(D.ambient);
    expect(D.sky).toMatchObject({ zenith: sky(1).zenith, horizon: sky(1).horizon });
    // (no world: noon, as it was)
    expect(lit(null)).toEqual(field({ form: true }).figure.form);
  });
  it('bounces its soil up from the ground, and wets its slots in the rain: glossier, the porous ones darker', () => {
    expect(lit(null).sky.ground).toEqual(groundOf('mud'));
    const dry = field({ form: true }), wet = field({ form: true, setting: { wet: true } });
    expect(wet.figure.form.materials.milPaint.roughness).toBeLessThan(dry.figure.form.materials.milPaint.roughness);
    expect(wet.figure.form.materials.mud.roughness).toBeLessThan(dry.figure.form.materials.mud.roughness);
    const lum = (h) => [1, 3, 5].reduce((s, i) => s + parseInt(h.slice(i, i + 2), 16), 0);
    const mudOf = (c) => c.form.root.find((f) => f.material === 'mud');
    expect(lum(mudOf(wet).albedo)).toBeLessThan(lum(mudOf(dry).albedo));
    expect(wet.census).toEqual(dry.census);
  });
  it('a road car keeps its noon: the world lights a field vehicle only', () => {
    const road = Object.keys(PHYSICS).find((k) => ['midsize', 'compact'].includes(k));
    const S = rollVehicleSheet({ facets: { pole: 'realistic', class: road }, seed: 1 });
    expect(JSON.stringify(compileRealistic(S, { form: true, setting: { sky: sky(0.03), wet: true } }).figure)).toBe(JSON.stringify(compileRealistic(S, { form: true }).figure));
  });
});

describe('a field vehicle on more than two axles, under a canvas', () => {
  const MULTI = Object.keys(MILITARY_CLASSES).find((k) => MILITARY_CLASSES[k] === 'cargo');
  const c = compileRealistic(rollVehicleSheet({ facets: { pole: 'realistic', class: MULTI }, seed: 3 }), { form: true, wear: 'pristine' });
  it('rolls on each axle\'s pair, its wheelbase to its rear axles\' middle, at its class\'s size', () => {
    const axles = militaryAxles(MULTI);
    expect(c.figure.bones.filter((b) => b.id.startsWith('wheel'))).toHaveLength(2 * axles.length);
    expect(c.figure.bones.map((b) => b.id)).toEqual(expect.arrayContaining(['wheelFL', 'wheelRR', 'wheel3L']));
    expect(c.figure.wheelbase).toBeCloseTo(PHYSICS[MULTI].wheelbase, 3);
    for (const k of ['L', 'W', 'H', 'wheelRadius']) { expect(c.census.against[k], k).toBeGreaterThan(0.99); expect(c.census.against[k], k).toBeLessThan(1.01); }
  });
  it('its canvas sags between its bows: its roof lower in a bay than over a bow, soft, a cloth\'s slot', () => {
    const cloth = c.form.root.filter((f) => f.material === 'canvas' && f.outNormal[2] > 0.95);
    expect(cloth.length).toBeGreaterThan(0);
    const zs = cloth.flatMap((f) => f.corners.map((p) => p[2]));
    expect(Math.max(...zs)).toBeCloseTo(PHYSICS[MULTI].H, 3);
    expect(Math.min(...zs)).toBeLessThan(PHYSICS[MULTI].H - 0.03);
    expect(cloth.some((f) => f.cornerNormals.some((n) => Math.abs(n[1]) > 0.02))).toBe(true);
  });
  it('within its budget, kept and worn, in camo', () => {
    const tris = (o) => Object.values(compileRealistic(rollVehicleSheet({ facets: { pole: 'realistic', class: MULTI }, seed: 3 }), { form: true, ...o }).form).flat().reduce((s, f) => s + f.corners.length - 2, 0);
    expect(Object.values(c.form).flat().reduce((s, f) => s + f.corners.length - 2, 0)).toBeLessThan(35000);
    expect(tris({ livery: CAMO_IDS.find((k) => !CAMO[k].cell) })).toBeLessThan(80000);
  });
  it('is driven by its registry row as a realistic ride', () => {
    const id = rowOfHandle('physics', MULTI);
    expect(rideableRows()).toContain(id);
    expect(rideOf({ ride: id })).toMatchObject({ kind: 'loft', class: MULTI });
  });
});

describe('the slab: armour cut by its outlines', () => {
  const vol = (fs) => fs.reduce((V, f) => { const c = f.corners; for (let i = 1; i + 1 < c.length; i++) { const [a, b, d] = [c[0], c[i], c[i + 1]]; V += (a[0] * (b[1] * d[2] - b[2] * d[1]) - a[1] * (b[0] * d[2] - b[2] * d[0]) + a[2] * (b[0] * d[1] - b[1] * d[0])) / 6; } return V; }, 0);
  const wedge = { front: [[-1, 0], [1, 0], [1, 1], [-1, 1]], side: [[-2, 0], [2, 0], [2, 0.5], [1, 1], [-2, 1]] };
  it('is the solid inside its outlines, closed and turned out, every face flat', () => {
    const fs = slab({ ...wedge, chamfer: 0, look: LOOK });
    expect(vol(fs)).toBeCloseTo(2 * (4 - 0.25), 6);
    for (const f of fs) { expect(unitLen(f.outNormal)).toBe(true); expect(f.cornerNormals).toBeUndefined(); }
    expect(fs.some((f) => f.outNormal[1] > 0.3 && f.outNormal[2] > 0.3)).toBe(true);
  });
  it('chamfers its sharp edges, a narrow face tagged as an edge, and leaves a shallow crease nearly whole', () => {
    const sharp = slab({ ...wedge, chamfer: 0.03, look: LOOK }), plain = slab({ ...wedge, chamfer: 0, look: LOOK });
    const edges = sharp.filter((f) => f.edge);
    expect(edges.length).toBeGreaterThan(8);
    expect(vol(sharp)).toBeLessThan(vol(plain));
    expect(vol(plain) - vol(sharp)).toBeLessThan(0.02);
    // (each chamfer narrower than the cut it takes off two faces at a right angle)
    for (const f of edges) { const span = Math.min(...[0, 1, 2].map((k) => Math.max(...f.corners.map((p) => p[k])) - Math.min(...f.corners.map((p) => p[k])))); expect(span).toBeLessThan(0.05); }
  });
  it('a face left off is not drawn, nor its edges chamfered', () => {
    const top = (t) => t.view === 'front' && t.n[2] > 0.99;
    const fs = slab({ ...wedge, chamfer: 0.03, look: (t) => (top(t) ? null : LOOK) });
    expect(fs.some((f) => f.outNormal[2] > 0.99)).toBe(false);
    expect(fs.filter((f) => f.edge && f.outNormal[2] > 0.3 && f.outNormal[1] < 0.3)).toHaveLength(0);
  });
});

describe('the armoured carrier: sloped plate on four axles', () => {
  const CARRIER = Object.keys(MILITARY_CLASSES).find((k) => MILITARY_CLASSES[k] === 'carrier');
  const roll = (o = {}) => compileRealistic(rollVehicleSheet({ facets: { pole: 'realistic', class: CARRIER }, seed: 3 }), { form: true, wear: 'pristine', ...o });
  const c = roll(), faces = Object.values(c.form).flat(), tris = (fs) => fs.reduce((s, f) => s + f.corners.length - 2, 0);
  it('rolls on four pairs, its wheelbase its first axle to its last, at its class\'s size', () => {
    const axles = militaryAxles(CARRIER);
    expect(axles).toHaveLength(4);
    expect(c.figure.bones.filter((b) => b.id.startsWith('wheel'))).toHaveLength(8);
    expect(c.figure.wheelbase).toBeCloseTo(PHYSICS[CARRIER].wheelbase, 3);
    for (const k of ['L', 'W', 'H', 'wheelRadius']) { expect(c.census.against[k], k).toBeGreaterThan(0.99); expect(c.census.against[k], k).toBeLessThan(1.01); }
  });
  it('is plate: a glacis raked back, sides raked in over the wheels, its edges chamfered', () => {
    const hull = c.form.root.filter((f) => f.part.startsWith('hull'));
    expect(hull.some((f) => f.part === 'hull.glacis' && f.outNormal[1] > 0.3 && f.outNormal[2] > 0.5)).toBe(true);
    expect(hull.some((f) => Math.abs(f.outNormal[0]) > 0.8 && f.outNormal[2] > 0.25)).toBe(true);
    expect(hull.filter((f) => f.edge).length).toBeGreaterThan(20);
  });
  it('sees out through vision blocks in their own slot, and its mount ring is empty', () => {
    expect(faces.some((f) => f.material === 'vision')).toBe(true);
    expect(MIL_MATERIALS.vision).toBeDefined();
    expect(c.figure.form.materials.vision).toBeDefined();
    const parts = new Set(faces.map((f) => f.part));
    for (const p of ['mount.ring', 'mount.well', 'ramp', 'cupola', 'hatch.driver']) expect(parts.has(p), p).toBe(true);
    expect([...parts].some((p) => /^(gun|weapon|turret)/.test(p))).toBe(false);
  });
  it('within its budget, kept, worn and in camo', () => {
    expect(tris(faces)).toBeLessThan(40000);
    expect(tris(Object.values(roll({ wear: 'used' }).form).flat())).toBeLessThan(60000);
    expect(tris(Object.values(roll({ wear: 'used', livery: CAMO_IDS.find((k) => !CAMO[k].cell) }).form).flat())).toBeLessThan(80000);
  });
  it('is driven by its registry row as a realistic ride', () => {
    const id = rowOfHandle('physics', CARRIER);
    expect(UNBUILT[CARRIER]).toBeUndefined();
    expect(rideableRows()).toContain(id);
    expect(rideOf({ ride: id })).toMatchObject({ kind: 'loft', class: CARRIER });
  });
});

describe('the missile launcher: a missile on its erector, stowed for the road or standing on its table', () => {
  const LAUNCHER = Object.keys(MILITARY_CLASSES).find((k) => MILITARY_CLASSES[k] === 'launcher'), v = PHYSICS[LAUNCHER];
  const roll = (o = {}, brief) => compileRealistic(rollVehicleSheet({ facets: { pole: 'realistic', class: LAUNCHER }, seed: 3, ...(brief ? { brief } : {}) }), { form: true, wear: 'pristine', ...o });
  const stowed = roll(), erect = roll({}, 'an erect launcher');
  const faces = (c) => Object.values(c.form).flat(), of = (c, re) => faces(c).filter((f) => re.test(f.part));
  const ext = (fs, i) => { let lo = Infinity, hi = -Infinity; for (const f of fs) for (const p of f.corners) { lo = Math.min(lo, p[i]); hi = Math.max(hi, p[i]); } return [lo, hi]; };
  const tris = (fs) => fs.reduce((t, f) => t + f.corners.length - 2, 0);
  it('rolls on four pairs at its class\'s size, measured without its load (its missile, its erector, its table)', () => {
    expect(militaryAxles(LAUNCHER)).toHaveLength(4);
    expect(stowed.figure.bones.filter((b) => b.id.startsWith('wheel'))).toHaveLength(8);
    expect(stowed.figure.wheelbase).toBeCloseTo(v.wheelbase, 3);
    for (const c of [stowed, erect]) for (const k of ['L', 'W', 'H', 'wheelRadius']) { expect(c.census.against[k], k).toBeGreaterThan(0.99); expect(c.census.against[k], k).toBeLessThan(1.01); }
  });
  it('stowed: its missile along the erector, inside the truck\'s width, its nose clear over the cab, its fins an X; the jacks up', () => {
    const m = of(stowed, /^missile/), [x0, x1] = ext(m, 0), [y0, y1] = ext(m, 1), [z0, z1] = ext(m, 2);
    expect(x1 - x0).toBeLessThan(v.W);
    expect(y1 - y0).toBeGreaterThan(13.5);
    expect(z1 - z0).toBeLessThan(3);
    const cab = of(stowed, /^cab$/), [cy0] = ext(cab, 1), [, cz1] = ext(cab, 2);
    expect(Math.min(...m.filter((f) => f.corners.every((p) => p[1] > cy0)).flatMap((f) => f.corners.map((p) => p[2])))).toBeGreaterThan(cz1);
    expect(new Set(of(stowed, /^missile\.fin/).map((f) => Math.sign(Math.round(f.outNormal[0] * 10)) * Math.sign(Math.round(f.outNormal[2] * 10)))).size).toBeGreaterThan(1);
    expect(ext(of(stowed, /^jack\.pad/), 2)[0]).toBeGreaterThan(0.4);
    expect(of(stowed, /^table\.(leg|deflector)/)).toEqual([]);
  });
  it('erect: its missile upright on its table behind the truck, the rams out, the jacks on the ground', () => {
    const m = of(erect, /^missile/), [x0, x1] = ext(m, 0), [y0, y1] = ext(m, 1), [z0, z1] = ext(m, 2);
    expect(z1 - z0).toBeGreaterThan(13.5);
    expect(Math.max(x1 - x0, y1 - y0)).toBeLessThan(3);
    expect((y0 + y1) / 2).toBeLessThan(-v.L / 2);
    const [, tz1] = ext(of(erect, /^table\.ring/), 2);
    expect(Math.abs(ext(of(erect, /^missile\.body/), 2)[0] - tz1)).toBeLessThan(0.15);
    expect(of(erect, /^table\.leg/).length).toBeGreaterThan(0);
    expect(ext(of(erect, /^jack\.pad/), 2)[0]).toBeLessThan(0.05);
    expect(ext(of(erect, /^erector\.ram/), 2)[1]).toBeGreaterThan(ext(of(stowed, /^erector\.ram/), 2)[1] + 1.5);
  });
  it('its words: erect, raised, upright stand it up; stowed or not said, it lies down', () => {
    expect(launcherWords(['erect'])).toEqual({ erect: true });
    expect(launcherWords(['an', 'upright', 'launcher'])).toEqual({ erect: true });
    expect(launcherWords(['raised', 'then', 'stowed'])).toEqual({ erect: false });
    expect(launcherWords([])).toEqual({ erect: false });
  });
  it('its missile in its own finish, which a camo leaves alone; within its budget (twice a truck\'s length)', () => {
    const camo = roll({ wear: 'used', livery: CAMO_IDS.find((k) => !CAMO[k].cell) }), body = of(camo, /^missile\.body/), cab = of(camo, /^cab$/);
    expect(new Set(body.map((f) => f.albedo)).size).toBe(1);
    expect(new Set(cab.map((f) => f.albedo)).size).toBeGreaterThan(1);
    expect(tris(faces(stowed))).toBeLessThan(35000);
    expect(tris(faces(camo))).toBeLessThan(100000);
    expect(JSON.stringify(faces(roll()))).toBe(JSON.stringify(faces(stowed)));
  });
  it('found by the words people say, the realistic body live, parked and driven', () => {
    const id = rowOfHandle('physics', LAUNCHER);
    expect(resolveVehicle('v2 launcher').id).toBe(id);
    expect(resolveVehicle('missile launcher').id).toBe(id);
    expect(VEHICLES[id].uses).toEqual(expect.arrayContaining(['parked', 'driven']));
    expect(upscaleOf(id).realistic).toBe('live');
  });
});

