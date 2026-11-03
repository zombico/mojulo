// The airside ground crew: each airside body compiled at its class's true numbers (stowed), its reach raising its lift,
// its belt or its platform to the height asked and no further than its range, its words; the airside's plain white and
// its fleet number unless a livery is named, a camo on a base; its tyres smooth; kept clean unless a wear is asked; within
// its budget, the same twice; read through the registry by the words people say, its realistic build live.
import { describe, it, expect } from 'vitest';
import { AIRSIDE_CLASSES, AIRSIDE_REACH, AIRSIDE_LIVERY, airsideWords, reachOf, airsideAxles } from './road-airside.js';
import { MILITARY_CLASSES } from './road-military.js';
import { CAMO_IDS, CAMO } from './livery-cut.js';
import { compileRealistic } from './realistic.js';
import { rollVehicleSheet } from './sheet.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { VEHICLES, resolveVehicle, rowOfHandle } from '../vehicle-registry/roster.js';
import { buildsOf, upscaleOf } from '../vehicle-registry/builds.js';

const CLASSES = Object.keys(AIRSIDE_CLASSES);
const compiled = (cls, opts = {}, brief) => compileRealistic(rollVehicleSheet({ facets: { pole: 'realistic', class: cls }, seed: 3, ...(brief ? { brief } : {}) }), { form: true, ...opts });
const faces = (c) => Object.values(c.form).flat();
const topOf = (c, re) => Math.max(...c.form.root.filter((f) => re.test(f.part)).flatMap((f) => f.corners.map((p) => p[2])));
// what each kind's reach is measured on: the galley's floor (its body's underside, 0.04 below), the belt's nose, the
// platform's deck
const REACHED = { catering: [/^body$/, -0.04, 'min'], beltLoader: [/^conveyor\.nose$/, 0.05], stairs: [/^platform$/, 0] };
const reached = (c, kind) => {
  const [re, off, how] = REACHED[kind], zs = c.form.root.filter((f) => re.test(f.part)).flatMap((f) => f.corners.map((p) => p[2]));
  return (how === 'min' ? Math.min(...zs) : Math.max(...zs)) - off;
};

describe('the airside ground crew compiled at their classes\' numbers', () => {
  it('each the hull kit\'s, at its class\'s length, width, height, wheelbase and wheel when stowed', () => {
    for (const cls of CLASSES) {
      expect(MILITARY_CLASSES[cls], cls).toBe(AIRSIDE_CLASSES[cls]);
      const c = compiled(cls);
      for (const k of ['L', 'W', 'H', 'wheelbase', 'wheelRadius']) {
        expect(c.census.against[k], `${cls} ${k}`).toBeGreaterThan(0.99);
        expect(c.census.against[k], `${cls} ${k}`).toBeLessThan(1.01);
      }
      expect(airsideAxles(cls)[0] - airsideAxles(cls)[1]).toBeCloseTo(PHYSICS[cls].wheelbase, 6);
    }
  });
  it('each reaches the height asked: stowed on the road, a door\'s when raised, a number clamped to its range', () => {
    for (const cls of CLASSES) {
      const kind = AIRSIDE_CLASSES[cls], R = AIRSIDE_REACH[kind];
      expect(reached(compiled(cls), kind), cls).toBeCloseTo(R.stowed, 1);
      expect(reached(compiled(cls, {}, 'raised'), kind), cls).toBeCloseTo(R.raised, 1);
      const mid = (R.range[0] + R.range[1]) / 2;
      expect(reached(compiled(cls, { pose: { reach: mid } }), kind), cls).toBeCloseTo(mid, 1);
      expect(reachOf(kind, { pose: { reach: 99 } })).toBe(R.range[1]);
      expect(reachOf(kind, { pose: { reach: -1 } })).toBe(R.range[0]);
    }
    expect(airsideWords(['docked'])).toEqual({ raised: true });
    expect(airsideWords(['a', 'truck'])).toEqual({ raised: false });
    expect(() => reachOf('tug')).toThrow(/not an airside body/);
  });
  it('the catering platform laid out over the cab only when the body clears it, its rails up then', () => {
    const lo = compiled('cateringTruck'), hi = compiled('cateringTruck', { pose: { reach: 4.2 } });
    const cabTop = topOf(lo, /^cab$/);
    expect(topOf(lo, /^platform$/)).toBeLessThan(lo.census.H);
    expect(Math.min(...hi.form.root.filter((f) => f.part === 'platform').flatMap((f) => f.corners.map((p) => p[2])))).toBeGreaterThan(cabTop);
    expect(topOf(hi, /^platform\.rail$/) - 4.2).toBeGreaterThan(0.9);
  });
});

describe('an airside vehicle\'s look', () => {
  const cls = CLASSES[0];
  it('the airside\'s white and its fleet number unless a livery is named; a camo on a base; its stripes and beacon its own', () => {
    const plain = compiled(cls), camo = CAMO_IDS.find((k) => !CAMO[k].cell), based = compiled(cls, { livery: camo });
    const paint = (c) => new Set(c.form.root.filter((f) => f.material === 'milPaint' && !/frame|scissor|ram|jack|sill|underrun|guard\.rear|lift/.test(f.part)).map((f) => f.albedo));
    expect([...paint(plain)]).toContain(AIRSIDE_LIVERY.colours[0]);
    expect(plain.form.root.filter((f) => f.part === 'mark').length).toBeGreaterThan(0);
    expect([...paint(based)].filter((c) => CAMO[camo].colours.includes(c)).length).toBeGreaterThan(1);
    for (const c of [plain, based]) {
      expect(new Set(c.form.root.filter((f) => f.part === 'hazard').map((f) => f.albedo)).size).toBe(2);
      expect(c.form.root.some((f) => f.part === 'beacon' && f.material === 'marker')).toBe(true);
    }
    expect(based.census).toEqual(plain.census);
  });
  it('its tyres smooth; kept clean unless a wear is asked; within its budget; the same twice', () => {
    const c = compiled(cls), all = faces(c);
    expect(all.some((f) => f.part === 'tyre.lug')).toBe(false);
    expect(all.some((f) => f.part === 'tyre')).toBe(true);
    expect(all.filter((f) => f.material === 'mud').length).toBe(0);
    expect(faces(compiled(cls, { wear: 'used' })).filter((f) => f.material === 'mud').length).toBeGreaterThan(0);
    for (const k of CLASSES) expect(faces(compiled(k)).reduce((s, f) => s + f.corners.length - 2, 0), k).toBeLessThan(20000);
    expect(JSON.stringify(compiled(cls).form)).toBe(JSON.stringify(c.form));
  });
});

describe('through the registry', () => {
  it('the words people say name each row, whose realistic build is live and is the hull kit\'s', () => {
    for (const cls of CLASSES) {
      const id = rowOfHandle('physics', cls);
      expect(id, cls).toBeTruthy();
      for (const w of [VEHICLES[id].label, ...VEHICLES[id].aliases]) expect(resolveVehicle(w)?.id, w).toBe(id);
      expect(buildsOf(id).find((b) => b.tier === 'realistic'), cls).toMatchObject({ via: 'loft', key: cls, status: 'live' });
      expect(upscaleOf(id).realistic).toBe('live');
      // (the old scenery net stays: the transport hub draws it)
      expect(buildsOf(id).some((b) => b.tier === 'stylised' && b.via === 'scenery')).toBe(true);
    }
  });
});
