// Car designer V2 laws: the realistic pole compiled. One case per procedure (a lofted car, a lift asked against a
// class's own stance, a heavy body plan with its axles, the style the sheet's words choose, the figure, the drive):
// what was drawn is the class's true numbers within 3 %, never stretched; the wheels are round and their own bones.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { rollVehicleSheet } from './sheet.js';
import { compileRealistic, realisticSpec, PROFILES, HUBS, REALISTIC_BAND, OPEN_FRAME, ERA_LANGUAGE } from './realistic.js';
import { BODY_LANGUAGES, bodyShape } from '../roads/bodywork.js';
import { CLASS_TRAITS } from './facets.js';
import { VEHICLES, vehicleRule } from '../roads/vehicles.js';
import { planTrack } from '../roads/track.js';
import { trackContract, trackSurface } from '../roads/contract.js';
import { raceCast, goalMechanics } from '../gameworld/quick.js';
import { composeMechanics } from '../game/mechanics.js';
import { simLevel } from '../game/level-sim.js';

const sheet = (facets, brief = '', seed = 3) => rollVehicleSheet({ brief, facets: { pole: 'realistic', ...facets }, seed });
const within = (x, pct = 0.03) => expect(Math.abs(x - 1)).toBeLessThanOrEqual(pct);
// one class per procedure, chosen from the catalog in code
const LOFTED = Object.keys(CLASS_TRAITS).find((k) => PROFILES[CLASS_TRAITS[k].derives.frame?.find((d) => d.startsWith('body = '))?.slice(7)]?.kind === 'car');
const MULTI_AXLE = Object.keys(CLASS_TRAITS).find((k) => CLASS_TRAITS[k].derives.frame?.includes('bodyplan = truck') && VEHICLES[k].L > 15);

describe('true to its class', () => {
  it('the cases are real classes (chosen from the catalog in code)', () => {
    expect(VEHICLES[LOFTED]).toBeTruthy();
    expect(VEHICLES[MULTI_AXLE]).toBeTruthy();
    expect(sheet({ class: LOFTED }).facets.class).toBe(LOFTED);
  });
  it('a lofted car: length, width, height, wheelbase, track and wheel radius within 3 % of its class\'s numbers', () => {
    const c = compileRealistic(sheet({ class: LOFTED }));
    for (const k of ['L', 'W', 'H', 'wheelbase', 'wheelRadius']) within(c.census.against[k]);
    expect(c.census.track).toBeCloseTo(VEHICLES[LOFTED].track, 2);
    expect(c.spec.kind).toBe('car');
  });
  it('lifts only when the stance is asked: the class\'s own stance is in its numbers; an asked lift stays in its band', () => {
    const own = Object.keys(CLASS_TRAITS).find((k) => CLASS_TRAITS[k].stance === 'raised' && !CLASS_TRAITS[k].derives.frame.some((d) => d.startsWith('bodyplan')));
    const base = compileRealistic(sheet({ class: own }));
    within(base.census.H / VEHICLES[own].H);
    const lifted = compileRealistic(sheet({ class: own, stance: 'raised' }));
    expect(lifted.spec.lift).toBeCloseTo(REALISTIC_BAND.rideHeight * VEHICLES[own].H, 3);
    within(lifted.census.against.H);
    expect(lifted.census.wheelRadius).toBeCloseTo(VEHICLES[own].wheelRadius * (1 + REALISTIC_BAND.wheelScale), 2);
    within(lifted.census.against.L); within(lifted.census.against.W);
  });
  it('a heavy body plan keeps the fleet\'s own build, every axle\'s wheels their own bones', () => {
    const c = compileRealistic(sheet({ class: MULTI_AXLE }));
    for (const k of ['L', 'W', 'H']) within(c.census.against[k]);
    const wheelBones = c.figure.bones.filter((b) => b.id !== 'root');
    expect(wheelBones.length).toBeGreaterThan(4);
    expect(new Set(wheelBones.map((b) => b.id)).size).toBe(wheelBones.length);
    expect(c.census.heavy).toBe(true);
  });
});

describe('the sheet\'s words, read as style', () => {
  it('the body family picks the profile; the wheel family the hub; the lights the lamps', () => {
    const vintage = compileRealistic(sheet({ class: LOFTED, era: 'vintage' })), future = compileRealistic(sheet({ class: LOFTED, era: 'future' }));
    expect(vintage.spec.hub).toBe(HUBS.wireVintage);
    expect(vintage.spec.lamps).toBe('round');
    expect(future.spec.lamps).toBe('bar');
    expect(realisticSpec(sheet({ class: 'sports' })).body).toBe('coupeThree');
  });
  it('the era picks the body\'s language: a classic sheet the fleet\'s three-box, a modern one the road today\'s', () => {
    const classic = realisticSpec(sheet({ class: LOFTED, era: 'classic' })), modern = realisticSpec(sheet({ class: LOFTED, era: 'modern' }));
    expect(classic.language).toBeUndefined();
    expect(modern.language).toBe(ERA_LANGUAGE.modern);
    expect(BODY_LANGUAGES[modern.language]).toBeTruthy();
    // within 3 % of the class under the language too, and every face one the World draws whole (four corners at most)
    const c = compileRealistic(sheet({ class: LOFTED, era: 'modern' }));
    for (const k of ['L', 'W', 'H', 'wheelbase', 'wheelRadius']) within(c.census.against[k]);
    for (const f of [...c.faces.root, ...c.faces.wheels.flatMap((w) => w.faces)]) {
      expect(f.corners.length).toBeLessThanOrEqual(4);
      expect(f.corners.flat().every(Number.isFinite)).toBe(true);
    }
  });
  it('a stripe follows the language\'s roof, never floating over its arc', () => {
    const c = compileRealistic(sheet({ class: LOFTED, era: 'modern', livery: 'striped' })), B = bodyShape(c.spec);
    const stripes = c.faces.root.filter((f) => f.part === 'stripe');
    expect(stripes.length).toBeGreaterThan(2);
    // vehicle space: +y forward (centring moves the body under a centimetre); the stripe 12 mm over the roof there
    for (const f of stripes) for (const [, y, z] of f.corners) expect(Math.abs(z - (B.topAt((c.spec.L / 2 - y) / c.spec.L) + 0.012))).toBeLessThan(0.02);
  });
  it('the livery and the wear paint it: a second colour above the belt, stripes, numbers, a patched panel', () => {
    const parts = (facets) => new Set(compileRealistic(sheet({ class: LOFTED, ...facets })).faces.root.map((f) => f.part).filter(Boolean));
    expect(parts({ livery: 'two-tone' })).toContain('roof');
    expect(parts({ livery: 'striped' })).toContain('stripe');
    expect(parts({ livery: 'numbered' })).toContain('number');
    expect(parts({ wear: 'battered' })).toContain('patch');
    expect(parts({ livery: 'mono', wear: 'used' })).toEqual(new Set(['body']));
    // a recoloured wall carries its grime gradient in the new colour, not the template's grey
    const c = compileRealistic(sheet({ class: LOFTED }));
    for (const f of c.faces.root.filter((x) => x.part && x.cornerFills)) expect(f.cornerFills.every((h) => h !== '#e9e9e9')).toBe(true);
  });
  it('refuses what it does not build: an open frame, a racer\'s sheet', () => {
    expect(() => compileRealistic(sheet({ class: OPEN_FRAME[0] }))).toThrow(/open frame: its body is the racer's body plan/);
    expect(() => compileRealistic(rollVehicleSheet({ facets: { pole: 'racer' } }))).toThrow(/reads a realistic sheet/);
  });
});

describe('a vehicle the world can drive', () => {
  it('its figure: a root and its wheels, each wheel\'s head at its hub, the roll clip; its rule the class\'s own', () => {
    const c = compileRealistic(sheet({ class: LOFTED }));
    expect(c.figure).toMatchObject({ rig: true, model: 'vehicle', facing: '+y', clips: { roll: { k: 12 } } });
    expect(c.figure.bones.map((b) => b.id).sort()).toEqual(['root', 'wheelFL', 'wheelFR', 'wheelRL', 'wheelRR']);
    for (const w of c.faces.wheels) c.figure.bones.find((b) => b.id === w.bone).head.forEach((v, i) => expect(v).toBeCloseTo(w.hub[i], 3));
    expect(c.figure.parts.every(Boolean)).toBe(true);
    expect(c.figure.wheelbase).toBeCloseTo(c.census.wheelbase, 3);
    expect(c.rule).toEqual(vehicleRule(LOFTED));
  });
  it('is deterministic: the same sheet compiles to the same figure, byte for byte', () => {
    const h = (c) => createHash('sha256').update(JSON.stringify(c.figure)).digest('hex');
    expect(h(compileRealistic(sheet({ class: LOFTED }, 'two-tone', 5)))).toBe(h(compileRealistic(sheet({ class: LOFTED }, 'two-tone', 5))));
  });
  it('drives a roadway headless on its own rule: two of them lap the kart oval', () => {
    const c = compileRealistic(sheet({ class: LOFTED })), plan = planTrack({ form: 'circuit', course: 'kart-oval' }), T = trackContract(plan), ground = trackSurface(plan);
    const q = { goal: 'race', ride: 'car', rivals: 2, laps: 1 }, cast = raceCast(q, { roadway: T }, { ref: 'v', rule: c.rule });
    const m = composeMechanics(goalMechanics(q, { roadway: T }), { player: 'car' });
    const S = simLevel({ entities: cast.entities.map((e) => ({ ...e, body: { type: 'none' } })), events: m.events, colliders: plan.colliders }, { ground: (p) => ground(p) });
    S.run(60);
    for (const id of ['rival-1', 'rival-2']) expect(S.world.byId[id].laps, id).toBeGreaterThanOrEqual(2);
  }, 60000);
});
