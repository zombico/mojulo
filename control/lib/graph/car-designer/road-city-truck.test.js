// The city's working trucks (road-city-truck.js over city-truck-kit.js): each body at its class's true numbers; its
// body by its word on the same cab (a deck, a wing body, a box, a reefer, a dump tub, a crane); what its words do (wings
// lifted about the ridge, a tub tipped about its tail, shutters rolled up on its crates, a rear door rolled up, a tilt
// over a deck); its tyres a road's, kept clean; read through the registry by the words people say, its realistic build
// live.
import { describe, it, expect } from 'vitest';
import { CITY_TRUCK_CLASSES, CITY_TRUCK_LIVERY, cityTruckAxles, cityTruckWords } from './road-city-truck.js';
import { MILITARY_CLASSES } from './road-military.js';
import { compileRealistic } from './realistic.js';
import { rollVehicleSheet } from './sheet.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { resolveVehicle, rowOfHandle } from '../vehicle-registry/roster.js';
import { buildOf } from '../vehicle-registry/builds.js';

const CLASSES = Object.keys(CITY_TRUCK_CLASSES);
const of = (kind) => CLASSES.find((c) => CITY_TRUCK_CLASSES[c] === kind);
const compiled = (cls, brief) => compileRealistic(rollVehicleSheet({ facets: { pole: 'realistic', class: cls }, seed: 3, ...(brief ? { brief } : {}) }), { form: true });
const parts = (c) => new Set(c.form.root.map((f) => f.part));
const pts = (c, re) => c.form.root.filter((f) => re.test(f.part)).flatMap((f) => f.corners);
const top = (c, re) => Math.max(...pts(c, re).map((p) => p[2]));

describe('the city\'s working trucks compiled at their classes\' numbers', () => {
  it('each the hull kit\'s, at its class\'s length, width, height, wheelbase and wheel', () => {
    for (const cls of CLASSES) {
      expect(MILITARY_CLASSES[cls], cls).toBe(CITY_TRUCK_CLASSES[cls]);
      const c = compiled(cls);
      for (const k of ['L', 'W', 'H', 'wheelbase', 'wheelRadius']) {
        expect(c.census.against[k], `${cls} ${k}`).toBeGreaterThan(0.985);
        expect(c.census.against[k], `${cls} ${k}`).toBeLessThan(1.012);
      }
      const [yf, yr] = cityTruckAxles(cls);
      expect(yf - yr).toBeCloseTo(PHYSICS[cls].wheelbase, 6);
    }
  });
});

describe('a body by its word on the same cab', () => {
  const cab = (c) => JSON.stringify(c.form.root.filter((f) => /^(cab|grille|bumper|headlamp)(\.|$)/.test(f.part)));
  it('a 2-ton cab-over\'s deck, wing body, box, reefer, dump tub or crane, its cab left as it was', () => {
    const cls = of('light'), deck = compiled(cls);
    expect(parts(deck).has('dropside') && parts(deck).has('guard.post')).toBe(true);
    for (const [word, part] of [['wing', 'wing'], ['box', 'box'], ['reefer', 'reefer'], ['dump', 'tub'], ['crane', 'crane']]) {
      const c = compiled(cls, word);
      expect(parts(c).has(part), word).toBe(true);
      expect(parts(deck).has(part), word).toBe(false);
      expect(cab(c), word).toBe(cab(deck));
    }
    expect(cityTruckWords(['a', 'truck'])).toEqual({ body: null, open: false, tipped: false, covered: false });
  });
});

describe('what its words do', () => {
  it('a wing body lifts its wings about its ridge, its load seen; shut, the wings are its sides', () => {
    const cls = of('wide'), shut = compiled(cls), open = compiled(cls, 'open');
    const out = (c) => Math.max(...pts(c, /^wing$/).map((p) => Math.abs(p[0])));
    expect(out(shut)).toBeLessThanOrEqual(PHYSICS[cls].W / 2 + 0.001);
    expect(top(open, /^wing$/)).toBeGreaterThan(top(shut, /^wing$/) + 0.8);
    expect(parts(open).has('cartons') && !parts(shut).has('cartons')).toBe(true);
  });
  it('a dump tub tips about its tail, its front raised', () => {
    const cls = of('medium'), flat = compiled(cls, 'dump'), up = compiled(cls, 'dump tipping');
    expect(top(up, /^tub$/)).toBeGreaterThan(top(flat, /^tub$/) + 2);
    expect(Math.min(...pts(up, /^tub$/).map((p) => p[2]))).toBeGreaterThan(0.2);
  });
  it('a beverage truck rolls its shutters up on its crates; a cube van its rear door; a mini carrier\'s tilt', () => {
    const bev = of('beverage');
    expect(parts(compiled(bev)).has('shutter') && !parts(compiled(bev)).has('crate')).toBe(true);
    const d = compiled(bev, 'delivering');
    expect(parts(d).has('crate') && !parts(d).has('shutter')).toBe(true);
    expect(parts(compiled(of('cube'), 'unloading')).has('doorway')).toBe(true);
    expect(parts(compiled(of('mini'), 'canvas')).has('tarp')).toBe(true);
  });
});

describe('a city truck\'s look and its registry', () => {
  it('its cab\'s plain livery; road tyres; the same twice', () => {
    const cls = of('beverage'), c = compiled(cls), all = Object.values(c.form).flat();
    expect(c.form.root.filter((f) => f.part === 'cab').every((f) => f.albedo === CITY_TRUCK_LIVERY.beverage.colours[0])).toBe(true);
    expect(all.some((f) => f.part === 'tyre.lug')).toBe(false);
    expect(JSON.stringify(compiled(cls).form)).toBe(JSON.stringify(c.form));
  });
  it('by the words people say, each its row, its realistic build live', () => {
    for (const [word, id] of [['wing truck', 'wing-truck'], ['2 ton truck', 'city-cabover'], ['midsize truck', 'medium-truck'], ['beverage truck', 'beverage-truck'], ['cube van', 'cube-van'], ['goods carrier', 'mini-goods']]) expect(resolveVehicle(word).id, word).toBe(id);
    for (const cls of CLASSES) expect(buildOf(rowOfHandle('physics', cls), 'realistic', { use: 'driven' }).build, cls).toMatchObject({ via: 'loft', key: cls, status: 'live' });
  });
});
