// Car designer V2 laws: the realistic pole compiled. One case per procedure (a lofted car, a lift asked against a
// class's own stance, a heavy body plan with its axles, the style the sheet's words choose, the figure, the drive):
// what was drawn is the class's true numbers within 3 %, never stretched; the wheels are round and their own bones.
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { rollVehicleSheet } from './sheet.js';
import { compileRealistic, realisticSpec, PROFILES, HUBS, REALISTIC_BAND, OPEN_FRAME } from './realistic.js';
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
    // round lamps are octagons on the nose and tail; a bar one quad across
    const octagons = (c) => c.faces.root.filter((f) => f.corners.length === 8 && !f.part).length;
    expect(octagons(vintage)).toBe(4);
    expect(octagons(future)).toBe(0);
    expect(realisticSpec(sheet({ class: 'sports' })).body).toBe('coupeThree');
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
    for (const w of c.faces.wheels) expect(c.figure.bones.find((b) => b.id === w.bone).head.map((v) => +v.toFixed(3))).toEqual(w.hub.map((v) => +v.toFixed(3)));
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
