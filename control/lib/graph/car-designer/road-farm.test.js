// The farm's machines (road-farm.js over farm-kit.js): each body at its class's true numbers; its wheels its own, axle by
// axle (a tractor's small fronts under its tall rears, a combine's big drive wheels ahead of its small steering rears),
// lugged, on cream rims; a tractor's loader holding its bucket at the reach asked, its plough raised on the road and in
// the ground at work; a combine's corn head and its auger swung out; a sprayer's booms out to their width; kept clean
// unless a wear is asked; read through the registry by the words people say, its realistic build live, parked with a
// loader's reach.
import { describe, it, expect } from 'vitest';
import { FARM_CLASSES, FARM_REACH, FARM_LIVERY, farmAxles, farmWords, loaderReach } from './road-farm.js';
import { FC } from './farm-kit.js';
import { MILITARY_CLASSES } from './road-military.js';
import { compileRealistic } from './realistic.js';
import { rollVehicleSheet } from './sheet.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { resolveVehicle, rowOfHandle } from '../vehicle-registry/roster.js';
import { buildOf } from '../vehicle-registry/builds.js';
import { readParked } from '../vehicle-registry/parked.js';

const CLASSES = Object.keys(FARM_CLASSES);
const of = (kind) => CLASSES.find((c) => FARM_CLASSES[c] === kind);
const compiled = (cls, brief, opts = {}) => compileRealistic(rollVehicleSheet({ facets: { pole: 'realistic', class: cls }, seed: 3, ...(brief ? { brief } : {}) }), { form: true, ...opts });
const parts = (c) => new Set(c.form.root.map((f) => f.part));
const pts = (c, re) => c.form.root.filter((f) => re.test(f.part)).flatMap((f) => f.corners);
const hub = (c, bone) => c.figure.bones.find((b) => b.id === bone).head;

describe('the farm\'s machines compiled at their classes\' numbers', () => {
  it('each the hull kit\'s, at its class\'s length, width and height; its wheelbase its axles\' spacing', () => {
    for (const cls of CLASSES) {
      expect(MILITARY_CLASSES[cls], cls).toBe(FARM_CLASSES[cls]);
      const c = compiled(cls);
      for (const k of ['L', 'W', 'H', 'wheelbase']) {
        expect(c.census.against[k], `${cls} ${k}`).toBeGreaterThan(0.99);
        expect(c.census.against[k], `${cls} ${k}`).toBeLessThan(1.01);
      }
      const [yf, yr] = farmAxles(cls);
      expect(yf - yr).toBeCloseTo(PHYSICS[cls].wheelbase, 6);
    }
  });
  it('its wheels its own: a tractor\'s fronts under its rears, a combine\'s the other way, each hub at its tyre\'s radius', () => {
    const t = compiled(of('tractor')), k = compiled(of('combine'));
    expect(hub(t, 'wheelFL')[2]).toBeLessThan(hub(t, 'wheelRL')[2] - 0.2);
    expect(hub(t, 'wheelRL')[2]).toBeCloseTo(PHYSICS[of('tractor')].wheelRadius, 3);
    expect(hub(k, 'wheelFL')[2]).toBeGreaterThan(hub(k, 'wheelRL')[2] + 0.2);
    // (lugged, on cream rims: its own, not its paint's)
    const wheel = Object.values(t.form).filter((fs) => fs !== t.form.root).flat();
    expect(wheel.some((f) => f.part === 'tyre.lug')).toBe(true);
    expect(wheel.some((f) => f.albedo === FC.rim)).toBe(true);
  });
});

describe('what its words do', () => {
  it('a tractor\'s loader holds its bucket at the reach asked, a number clamped to its range; its weights off', () => {
    const cls = of('tractor'), R = FARM_REACH.loader;
    expect(parts(compiled(cls)).has('loader.bucket')).toBe(false);
    const low = compiled(cls, 'loader'), high = compiled(cls, 'loader raised'), mid = compiled(cls, null, { pose: { reach: 2 } });
    const pin = (c) => Math.min(...pts(c, /^loader\.bucket$/).map((p) => p[2]));
    expect(parts(low).has('weight')).toBe(false);
    expect(pin(high)).toBeGreaterThan(pin(low) + 2);
    expect(parts(mid).has('loader.bucket')).toBe(true);
    expect(loaderReach([], { reach: 99 })).toBe(R.range[1]);
    expect(loaderReach(['raised'])).toBe(R.deployed);
  });
  it('a plough on its hitch: raised on the road, its shares at the ground ploughing', () => {
    const cls = of('tractor'), road = compiled(cls, 'plough'), work = compiled(cls, 'plough ploughing');
    const share = (c) => Math.min(...pts(c, /^plough\.share$/).map((p) => p[2]));
    expect(share(road)).toBeGreaterThan(0.3);
    expect(share(work)).toBeCloseTo(0, 2);
    expect(farmWords(['ploughing'])).toMatchObject({ plough: true, ploughing: true });
  });
  it('a combine: a corn head\'s snouts for its reel; its auger swung out past its side unloading', () => {
    const cls = of('combine'), grain = compiled(cls), corn = compiled(cls, 'corn'), out = compiled(cls, 'unloading');
    expect(parts(grain).has('reel.bat') && !parts(grain).has('snout')).toBe(true);
    expect(parts(corn).has('snout') && !parts(corn).has('reel.bat')).toBe(true);
    const reachX = (c) => Math.min(...pts(c, /^auger$/).map((p) => p[0]));
    expect(reachX(grain)).toBeGreaterThan(-2.2);
    expect(reachX(out)).toBeLessThan(-6);
  });
  it('a sprayer\'s booms folded inside its width on the road, out to their full width spraying', () => {
    const cls = of('sprayer'), w = (c) => Math.max(...pts(c, /^boom$/).map((p) => Math.abs(p[0])));
    expect(w(compiled(cls))).toBeLessThanOrEqual(PHYSICS[cls].W / 2 + 0.001);
    expect(w(compiled(cls, 'spraying'))).toBeGreaterThan(17);
  });
});

describe('a farm machine\'s look and its registry', () => {
  it('its kind\'s plain livery unless one is named; kept clean unless a wear is asked', () => {
    const cls = of('combine'), c = compiled(cls);
    expect(c.form.root.filter((f) => f.part === 'body').every((f) => f.albedo === FARM_LIVERY.combine.colours[0])).toBe(true);
    expect(compiled(cls, null, { wear: 'battered' }).form.root.length).toBeGreaterThan(c.form.root.length);
  });
  it('by the words people say, each its row, its realistic build live; a parked tractor takes a loader\'s reach', () => {
    expect(resolveVehicle('combine harvester').id).toBe('combine-harvester');
    expect(resolveVehicle('boom sprayer').id).toBe('field-sprayer');
    expect(resolveVehicle('crop spraying drone').id).toBe('crop-sprayer');
    for (const cls of CLASSES) expect(buildOf(rowOfHandle('physics', cls), 'realistic', { use: 'driven' }).build, cls).toMatchObject({ via: 'loft', key: cls, status: 'live' });
    expect(readParked([{ vehicle: 'farm tractor', at: [0, 0, 0], reach: 2.5 }])[0]).toMatchObject({ class: of('tractor'), reach: 2.5 });
    expect(() => readParked([{ vehicle: 'farm tractor', at: [0, 0, 0], reach: 9 }])).toThrow(/0 to 3.8/);
    expect(() => readParked([{ vehicle: 'combine', at: [0, 0, 0], reach: 2 }])).toThrow(/lifts nothing/);
  });
});
