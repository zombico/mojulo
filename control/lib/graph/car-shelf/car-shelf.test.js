import { describe, it, expect } from 'vitest';
import {
  CAR_CARDS, CAR_CARD_IDS, BODY_STYLES, CAR_LANGUAGES, CAR_TRIMS, composeCar, readCarSpec, readParts, readPaint, compileCar,
  carClass, PART_WORDS,
} from './index.js';
import { VEHICLES as PHYSICS } from '../roads/vehicles.js';
import { VEHICLES, handlesOf, rowOfHandle } from '../vehicle-registry/roster.js';
import { buildsOf, buildOf, upscaleOf } from '../vehicle-registry/builds.js';
import { rideOf } from '../vehicle-registry/ride.js';
import { readParked, withParked } from '../vehicle-registry/parked.js';
import { loftInstanceFaces, loftFigure } from '../car-designer/race-families.js';

// one card a procedure, chosen in code from the library by what it carries
const cardWhere = (pred) => CAR_CARD_IDS.find((id) => pred(composeCar(id)));
const OPEN = cardWhere((d) => d.style.open);
const BOOT = cardWhere((d) => d.style.tail === 'boot' && !d.style.open);
const LIFTGATE = cardWhere((d) => d.style.tail === 'liftgate' && d.parts.spare);
const CHROME = cardWhere((d) => d.parts.bumpers === 'chrome');
const parts = (c) => new Set(Object.values(c.form).flat().map((f) => f.part));
const compiled = new Map();
const compile = (id) => { if (!compiled.has(id)) compiled.set(id, compileCar(id, { form: true })); return compiled.get(id); };

describe('a composition is read and solved at its class\'s numbers', () => {
  it('a card resolves to its class\'s frame; the trim\'s wheels and ride on it', () => {
    const id = cardWhere((d) => d.parts.wheelScale > 0 && d.parts.ride !== 0), d = composeCar(id), v = PHYSICS[d.class];
    expect(d.frame).toMatchObject({ L: v.L, W: v.W, H: v.H, wb: v.wheelbase, track: v.track, r0: v.wheelRadius });
    expect(d.frame.r).toBeCloseTo(v.wheelRadius * (1 + d.parts.wheelScale), 4);
    expect(d.frame.lift).toBe(d.parts.ride);
  });
  it('a slot is the language\'s, unless the trim names it, unless the card does, unless the spec does', () => {
    const id = cardWhere((d) => CAR_CARDS[d.preset].trim !== 'base');
    const C = CAR_CARDS[id], T = CAR_TRIMS[C.trim].parts, L = CAR_LANGUAGES[C.language];
    const slot = ['lamps', 'grille', 'wheel', 'bumpers'].find((k) => !(k in T) && !(k in C.parts));
    expect(composeCar(id).parts[slot]).toBe(L[slot]);
    const tSlot = Object.keys(T).find((k) => !(k in C.parts) && typeof T[k] === 'string' && T[k] !== 'auto');
    if (tSlot) expect(composeCar(id).parts[tSlot]).toBe(T[tSlot]);
    const word = PART_WORDS.lamps.find((w) => w !== composeCar(id).parts.lamps);
    expect(composeCar({ preset: id, parts: { lamps: word } }).parts.lamps).toBe(word);
  });
  it('a spoiler asked for as it suits: a lip on a boot, a roof spoiler over a tailgate; a spare only on an upright tailgate', () => {
    expect(composeCar({ preset: BOOT, parts: { spoiler: 'auto' } }).parts.spoiler).toBe('lip');
    expect(composeCar({ preset: LIFTGATE, parts: { spoiler: 'auto' } }).parts.spoiler).toBe('roof');
    expect(composeCar({ preset: BOOT, parts: { spare: true } }).parts.spare).toBe(false);
  });
  it('an open body\'s roof is open (or a soft top up); a closed body\'s never is', () => {
    expect(composeCar({ preset: OPEN, parts: { roof: 'solid' } }).parts.roof).toBe('open');
    expect(composeCar({ preset: OPEN, parts: { roof: 'soft' } }).parts.roof).toBe('soft');
    expect(composeCar({ preset: BOOT, parts: { roof: 'open' } }).laws.find((l) => l.id === 'roof-fits-body').pass).toBe(false);
  });
  it('a composition with no card names its class, body and language', () => {
    const d = composeCar({ class: 'cityCar', body: 'wagon', language: 'wedge', seed: 4 });
    expect(d).toMatchObject({ preset: null, class: 'cityCar', body: 'wagon', language: 'wedge', trim: 'base' });
    expect(() => composeCar({ class: 'cityCar', body: 'wagon' })).toThrow(/names its class, body and language/);
  });
  it('refuses what it does not know, naming what it does', () => {
    expect(() => readCarSpec({ preset: 'nope' })).toThrow(/preset is one of/);
    expect(() => readCarSpec({ preset: BOOT, colour: 'red' })).toThrow(/'colour' is not one of/);
    expect(() => readCarSpec({ class: 'bus', body: 'sedan', language: 'current' })).toThrow(/no car class/);
    expect(() => readParts({ lamps: 'square' })).toThrow(/lamps is one of/);
    expect(() => readParts({ ride: 1 })).toThrow(/ride is a number/);
    expect(() => readParts({ rails: 'yes' })).toThrow(/rails is true or false/);
    expect(() => composeCar({ preset: BOOT, body: 'saucer' })).toThrow(/body 'saucer' is one of/);
  });
  it('a car class is a four-wheeled road class of a car\'s size: the cars, never a bus, a bike or a site machine', () => {
    expect(carClass('midsize')).toBe(true);
    for (const k of ['bus', 'streetBike', 'crawlerExcavator', 'kart']) expect(carClass(k), k).toBe(false);
  });
});

describe('the paint', () => {
  it('a colour by its name or a hex, a seed\'s pick from the language\'s palette, the same twice', () => {
    expect(readPaint('crimson').body).toBe('#9e1b1f');
    expect(readPaint('#123456').body).toBe('#123456');
    expect(readPaint(undefined, { palette: 'cute', seed: 7 })).toEqual(readPaint(undefined, { palette: 'cute', seed: 7 }));
    expect(() => readPaint('mauve-ish')).toThrow(/a paint is a hex/);
  });
  it('a scheme lays a second colour, the palette\'s contrast when unnamed', () => {
    const p = readPaint({ colour: 'obsidian', scheme: 'roof' }, { palette: 'current' });
    expect(p.second).toBeTruthy();
    expect(p.second).not.toBe(p.body);
    expect(readPaint('obsidian').second).toBeNull();
  });
});

describe('the body compiled', () => {
  it('stands at its class\'s numbers: length, width, height, wheelbase, track and wheels', () => {
    const c = compile(BOOT), a = c.census.against;
    for (const k of ['L', 'W', 'H']) { expect(a[k], k).toBeGreaterThan(0.97); expect(a[k], k).toBeLessThan(1.02); }
    expect(a.wheelbase).toBeCloseTo(1, 3);
    expect(c.census.wheelRadius).toBeCloseTo(c.design.frame.r, 2);
    expect(c.figure.bones.map((b) => b.id)).toEqual(['root', 'wheelFL', 'wheelFR', 'wheelRL', 'wheelRR']);
  });
  it('every face a material, an albedo and a unit normal; the glass framed and pillared, the panels cut', () => {
    const c = compile(BOOT), all = Object.values(c.form).flat(), mats = Object.keys(c.figure.form.materials);
    for (const f of all) {
      expect(mats, f.part).toContain(f.material);
      expect(f.albedo, f.part).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Math.hypot(...f.outNormal)).toBeCloseTo(1, 5);
    }
    const P = parts(c);
    for (const p of ['glass', 'glass.frame', 'pillar', 'seam', 'door.handle', 'mirror', 'plate', 'headlamp', 'taillamp', 'tyre']) expect(P.has(p), p).toBe(true);
  });
  it('the same composition draws the same bytes; another seed another paint; without the form render no form', () => {
    expect(JSON.stringify(compileCar(BOOT, { form: true }).form)).toBe(JSON.stringify(compile(BOOT).form));
    const plain = compileCar(BOOT);
    expect(plain.form).toBeUndefined();
    expect(plain.figure.form).toBeUndefined();
    const id = cardWhere((d) => CAR_CARDS[d.preset].paint === undefined) ?? BOOT;
    expect(composeCar({ preset: id, seed: 1, paint: undefined }).paint).toEqual(composeCar({ preset: id, seed: 1 }).paint);
  });
  it('an open body: a tub with its seats, a framed screen, no roof', () => {
    const c = compile(OPEN), P = parts(c);
    for (const p of ['seat', 'interior', 'screen.frame', 'steering', 'dash']) expect(P.has(p), p).toBe(true);
    expect(P.has('roof')).toBe(false);
    expect(Object.values(c.form).flat().filter((f) => f.part === 'interior').every((f) => f.material === 'interior')).toBe(true);
  });
  it('chrome bumpers stand proud inside the class\'s length; an upright tailgate carries its spare inside it too', () => {
    for (const id of [CHROME, LIFTGATE]) {
      const c = compile(id);
      expect(c.census.against.L, id).toBeLessThan(1.02);
      expect(c.census.against.L, id).toBeGreaterThan(0.97);
    }
    expect(Object.values(compile(CHROME).form).flat().some((f) => f.part === 'bumper' && f.material === 'chrome')).toBe(true);
    expect(parts(compile(LIFTGATE)).has('spare.tyre') || [...parts(compile(LIFTGATE))].some((p) => p.startsWith('spare'))).toBe(true);
  });
  it('a part asked for is drawn, one not asked adds nothing', () => {
    const base = { class: 'compact', body: 'hatchback', language: 'current', seed: 2 };
    const without = parts(compileCar(base, { form: true }));
    const withAll = parts(compileCar({ ...base, parts: { rails: true, spoiler: 'roof', exhaust: 'twin', fogs: true, stripes: 'twin', strip: 'black', flares: true } }, { form: true }));
    for (const p of ['rail', 'spoiler', 'exhaust', 'foglamp', 'stripe', 'strip', 'flare']) { expect(without.has(p), p).toBe(false); expect(withAll.has(p), p).toBe(true); }
  });
  it('a whitewall is a white band on the outer wall', () => {
    const c = compileCar({ preset: BOOT, parts: { tyre: 'whitewall' } }, { form: true }), w = c.form.wheelFL;
    expect(w.some((f) => f.part === 'sidewall.white')).toBe(true);
  });
});

describe('the registry names the cards and every door draws them', () => {
  it('each card is a live realistic build of its row, before the class\'s plain loft', () => {
    const id = CAR_CARD_IDS.find((k) => { const row = rowOfHandle('car', k); return (handlesOf(row).physics ?? []).length && handlesOf(row).car[0] === k; });
    const row = rowOfHandle('car', id), b = buildOf(row, 'realistic', { use: 'driven' }).build;
    expect(b).toMatchObject({ via: 'loft', key: CAR_CARDS[id].class, car: id, status: 'live' });
    expect(upscaleOf(row).realistic).toBe('live');
    expect(buildsOf(row).filter((x) => x.car).length).toBe(handlesOf(row).car.length);
  });
  it('a row\'s card is the ride a realistic game drives', () => {
    const row = Object.keys(VEHICLES).find((k) => handlesOf(k).car && !handlesOf(k).ride);
    expect(rideOf({ ride: row, tier: 'realistic' })).toMatchObject({ kind: 'loft', car: handlesOf(row).car[0] });
  });
  it('a loft names its car: drawn on the grid, its figure the world compiles; a sheet\'s words refused beside it', () => {
    const { stats } = loftInstanceFaces({ car: BOOT });
    expect(stats).toMatchObject({ car: BOOT, class: CAR_CARDS[BOOT].class });
    expect(loftFigure({ car: BOOT, seed: 2, light: 'form' }).form.materials).toHaveProperty('chrome');
    expect(() => loftInstanceFaces({ car: BOOT, brief: 'rusty' })).toThrow(/its look is the car's own/);
  });
  it('a parked car: a car row stands as its card; a row the highway fleet lofts keeps its plain loft unless it names a car', () => {
    const only = Object.keys(VEHICLES).find((k) => handlesOf(k).car && !handlesOf(k).fleet && VEHICLES[k].uses.includes('parked'));
    const old = Object.keys(VEHICLES).find((k) => handlesOf(k).car && handlesOf(k).fleet && VEHICLES[k].uses.includes('parked'));
    const [a, b, c] = readParked([{ vehicle: only, at: [0, 0, 0] }, { vehicle: old, at: [4, 0, 0] }, { vehicle: old, car: handlesOf(old).car[0], at: [8, 0, 0] }]);
    expect(a.car).toBe(handlesOf(only).car[0]);
    expect(b.car).toBeUndefined();
    expect(c.car).toBe(handlesOf(old).car[0]);
    const { manifest } = withParked({ parked: [{ vehicle: only, at: [0, 0, 0] }] });
    expect(Object.values(manifest.figures)[0].loft).toMatchObject({ car: a.car, class: a.class });
    expect(() => readParked([{ vehicle: 'bus', car: BOOT, at: [0, 0, 0] }])).toThrow(/no car the car shelf builds/);
  });
});
