// Driving primitives D5 laws: vehicles bound by physics, through the drive rule itself (headless, the page's engine).
// Every class held to the reference sheet's bands (0–100, stopping on dry, wet and snow, a loaded truck's merge);
// grip caps launch, braking and cornering; the ground under the tyres and the weather scale it; a car flies off a lip
// as far as ballistics says, and lands losing what its angle costs; arcade differs from sim only by its preset.
import { describe, it, expect } from 'vitest';
import { VEHICLES, vehicleRule, envelope, launchShare, CONDITIONS } from './vehicles.js';
import { ramp, rampReach, lipSpeedBand } from './ramps.js';
import { buildAlignment } from './alignment.js';
import { crestFlightSpeed } from './classes.js';
import { planTrack } from './track.js';
import { trackContract, trackSurface } from './contract.js';
import { driveSurfaceTable, surfaceAt } from './surface.js';
import { SURFACES } from './surfaces.js';
import { composeLive } from '../worlds/controllable/compose.js';
import { goalMechanics, raceCast } from '../gameworld/quick.js';
import { composeMechanics } from '../game/mechanics.js';
import { simLevel } from '../game/level-sim.js';

const E = composeLive(), DT = 1 / 60, KMH = 3.6;
const car = (rule, { v0 = 0, pos = [0, 0, 0], heading = 0 } = {}) => {
  const w = E.createWorld({ entities: [{ id: 'c', pilotable: true, rule, body: { type: 'none' }, transform: { pos: [...pos], heading } }] });
  w.byId.c.speed = v0;
  return w;
};
const flat = () => 0;
const step = (w, input, hooks = { ground: flat }) => E.stepWorld(w, input, DT, hooks);
const to = (id, kmh, opts = {}) => { const w = car(vehicleRule(id, opts)); let t = 0; while (w.byId.c.speed < kmh / KMH && t < 300) { step(w, { forward: 1 }); t += DT; } return t; };
const stop = (id, conditions = 'dry', hooks) => { const w = car(vehicleRule(id, { conditions }), { v0: 100 / KMH }); let n = 0; while (w.byId.c.speed > 0.01 && n < 3600) { step(w, { forward: -1 }, hooks); n++; } return w.byId.c.transform.pos[0]; };

describe('every class, held to the reference sheet', () => {
  it('0–100 km/h in its band (economy 8.5–10.5 s, SUV 7–9, a loaded truck 40–70; the rest from published figures)', () => {
    const bands = { compact: [8.5, 10.5], midsize: [7.5, 9.5], crossover: [7, 9], pickup: [6, 8], sports: [3.8, 5], rally: [4, 5.5], dirtBike: [3.5, 5.5], buggy: [4.5, 7], trophyTruck: [4, 6.5], tractorTrailerLoaded: [40, 70], straightTruck: [30, 55] };
    for (const [id, [lo, hi]] of Object.entries(bands)) { const t = to(id, 100); expect(t, id).toBeGreaterThan(lo); expect(t, id).toBeLessThan(hi); }
    expect(to('bus', 80)).toBeLessThan(30);
  });
  it('stops from 100 km/h as v²/2μg says: a car 41–48 m dry, 60–100 wet, 130–200 in snow; a truck about half again', () => {
    for (const id of ['compact', 'midsize', 'crossover']) {
      const d = { dry: stop(id), wet: stop(id, 'wet'), snow: stop(id, 'snow') };
      expect(d.dry, id).toBeGreaterThan(41); expect(d.dry, id).toBeLessThan(48);
      expect(d.wet, id).toBeGreaterThan(60); expect(d.wet, id).toBeLessThan(100);
      expect(d.snow, id).toBeGreaterThan(130); expect(d.snow, id).toBeLessThan(200);
      // the trace and the formula agree (the rule's own grip and brakes, nothing stated)
      const v = VEHICLES[id], a = v.grip * 9.81 * v.brakeEff;
      expect(d.dry / ((100 / KMH) ** 2 / (2 * a)), id).toBeCloseTo(1, 1);
    }
    const ratio = stop('tractorTrailerLoaded') / stop('midsize');
    expect(ratio).toBeGreaterThan(1.3); expect(ratio).toBeLessThan(1.9);
  });
  it('a loaded tractor-trailer does not reach merge speed on a 365 m acceleration lane (from 50 km/h)', () => {
    const w = car(vehicleRule('tractorTrailerLoaded'), { v0: 50 / KMH });
    while (w.byId.c.transform.pos[0] < 365) step(w, { forward: 1 });
    expect(w.byId.c.speed * KMH).toBeLessThan(85);
    expect(w.byId.c.speed * KMH).toBeGreaterThan(60);
  });
  it('reaches the top speed its power and drag make (or its governor), as the envelope solves it', () => {
    for (const id of Object.keys(VEHICLES)) {
      const w = car(vehicleRule(id));
      for (let t = 0; t < 240; t += DT) step(w, { forward: 1 });
      expect(w.byId.c.speed / envelope(id).top, id).toBeGreaterThan(0.97);
      expect(w.byId.c.speed, id).toBeLessThanOrEqual(envelope(id).top * 1.001);
    }
  });
  it('says which tip before they slide: the ATV and the trucks, not the cars', () => {
    for (const id of ['atv', 'straightTruck', 'tractorTrailer', 'tractorTrailerLoaded']) expect(envelope(id).rollsBeforeSliding, id).toBe(true);
    for (const id of ['compact', 'midsize', 'sports', 'rally', 'kart']) expect(envelope(id).rollsBeforeSliding, id).toBe(false);
    expect(envelope('dirtBike')).toMatchObject({ leans: true });
  });
});

describe('grip caps what a car can do', () => {
  it('a launch shifts load rearward: a rear-driven class pushes with more than its static share, a front-driven with less; a bike lifts its front', () => {
    expect(launchShare(VEHICLES.pickup)).toBeGreaterThan(VEHICLES.pickup.share);
    expect(launchShare(VEHICLES.compact)).toBeLessThan(VEHICLES.compact.share);
    expect(launchShare(VEHICLES.rally)).toBe(1);
    const b = VEHICLES.dirtBike;
    expect(launchShare(b) * b.grip * 9.81).toBeCloseTo((9.81 * b.wheelbase * (1 - b.share)) / b.cgH, 6);
  });
  it('turning on full lock it corners no harder than μg; in the wet, less', () => {
    for (const cond of ['dry', 'wet']) {
      const rule = vehicleRule('midsize', { conditions: cond }), w = car(rule, { v0: 25 });
      let peak = 0, prev = w.byId.c.transform.heading;
      for (let k = 0; k < 120; k++) {
        step(w, { forward: 0.3, turn: -1 });
        const h = w.byId.c.transform.heading, v = w.byId.c.speed, rate = Math.abs(((h - prev + Math.PI) % (2 * Math.PI)) - Math.PI) / DT;
        peak = Math.max(peak, v * rate); prev = h;
      }
      expect(peak, cond).toBeLessThanOrEqual(rule.grip * rule.muScale * 9.81 * 1.01);
      expect(peak, cond).toBeGreaterThan(rule.grip * rule.muScale * 9.81 * 0.9);
    }
  });
});

describe('the ground under the tyres', () => {
  const grass = { ground: flat, surface: () => ({ mu: SURFACES.grass.mu, roll: SURFACES.grass.roll }) };
  it('grass drags and slips: a slower top speed and a longer stop than the road; arcade forgives half of it', () => {
    const top = (rule, hooks) => { const w = car(rule); for (let t = 0; t < 120; t += DT) step(w, { forward: 1 }, hooks); return w.byId.c.speed; };
    expect(top(vehicleRule('compact'), grass)).toBeLessThan(top(vehicleRule('compact'), { ground: flat }) * 0.95);
    expect(stop('compact', 'dry', grass)).toBeGreaterThan(stop('compact') * 1.5);
    const sim = top(vehicleRule('compact'), grass), arc = top(vehicleRule('compact', { tuning: 'arcade' }), grass);
    expect(arc).toBeGreaterThan(sim);
  });
  it('a track says what each band is: road, kerb at a corner, run-off (gravel outside a circuit\'s corners), grass beyond', () => {
    const plan = planTrack({ form: 'circuit', course: 'hillside' }), T = driveSurfaceTable(plan), a = plan.alignment, X = plan.X;
    const on = (s, o) => { const p = a.at(s); return surfaceAt(T, [p.x - Math.sin(p.heading) * o, p.y + Math.cos(p.heading) * o]); };
    const corner = a.stations().find((p) => Math.abs(p.k) > 0.01), side = Math.sign(corner.k);
    expect(on(corner.s, 0)).toEqual({ mu: 1, roll: 1 });
    expect(on(corner.s, side * (X.road + 0.5))).toEqual({ mu: SURFACES.kerb.mu, roll: SURFACES.kerb.roll });
    expect(on(corner.s, -side * (X.kerb + 2))).toEqual({ mu: SURFACES.gravel.mu, roll: SURFACES.gravel.roll });
    expect(on(corner.s, side * (X.kerb + 2))).toEqual({ mu: SURFACES.grass.mu, roll: SURFACES.grass.roll });
    expect(on(corner.s, X.outer + 60)).toEqual({ mu: SURFACES.grass.mu, roll: SURFACES.grass.roll });
    expect(JSON.stringify(T).length).toBeLessThan(40000);
    expect(surfaceAt.toString()).not.toMatch(/\bimport\b|\brequire\(/);
  });
});

describe('flight', () => {
  const road = (features) => buildAlignment({ elements: [{ type: 'tangent', length: 400 }], profile: { z0: 0, pvis: [], features } });
  const run = (rule, a, v0, frames = 600) => {
    const w = car(rule, { v0, pos: [20, 0, a.at(20).z] }), hooks = { ground: (p) => a.at(p[0]).z };
    let air = false, took = null, landed = null;
    for (let k = 0; k < frames; k++) {
      step(w, { forward: 0 }, hooks);
      const e = w.byId.c;
      if (e.airborne && !air) took = { x: e.transform.pos[0], v: e.speed };
      if (!e.airborne && air) landed = { x: e.transform.pos[0], loss: e.landLoss, airTime: e.airTime };
      air = !!e.airborne;
    }
    return { took, landed };
  };
  it('a car off a kicker flies as far as ballistics says, from its lip, at its speed', () => {
    const k = ramp({ kind: 'kicker', at: 100, h: 1.2, angle: 24 }), a = road([k]);
    for (const v of [12, 18, 24]) {
      const { took, landed } = run(vehicleRule('rally'), a, v);
      expect(took.x, `v ${v}`).toBeGreaterThan(k.lip.s - 1);
      expect(took.x, `v ${v}`).toBeLessThan(k.lip.s + 1);
      const want = rampReach(k, a, took.v);
      expect(Math.abs(landed.x - want.s), `v ${v}: landed ${landed.x}, ballistics ${want.s}`).toBeLessThan(1.5);
    }
  });
  it('lands losing what its angle costs (a flat landing from a steep lip); arcade keeps most of it', () => {
    const k = ramp({ kind: 'kicker', at: 100, h: 1.2, angle: 24 }), a = road([k]);
    const sim = run(vehicleRule('rally'), a, 18).landed, arc = run(vehicleRule('rally', { tuning: 'arcade' }), a, 18).landed;
    expect(sim.loss).toBeGreaterThan(0.05);
    expect(arc.loss).toBeLessThanOrEqual(0.08 + 1e-9);
    // a tabletop landed on its slope costs little
    const t = ramp({ kind: 'tabletop', at: 100 }), b = road([t]), band = lipSpeedBand(t, b, 30);
    expect(run(vehicleRule('rally'), b, (band.lo + band.hi) / 2 + 0.3).landed.loss).toBeLessThan(sim.loss);
  });
  it('a crest flies above its flight speed and holds a car below it', () => {
    const K = 0.5, a = buildAlignment({ elements: [{ type: 'tangent', length: 400 }], profile: { z0: 0, pvis: [{ s: 150, z: 6, K }, { s: 399, z: 0 }] } });
    const vf = crestFlightSpeed(K);
    expect(run(vehicleRule('rally'), a, vf * 1.25).took).not.toBeNull();
    expect(run(vehicleRule('rally'), a, vf * 0.7).took).toBeNull();
  });
  it('a rule without `air` follows the ground down as it always did', () => {
    const k = ramp({ kind: 'kicker', at: 100, h: 1.2, angle: 24 }), a = road([k]), { air: _a, ...rule } = vehicleRule('rally');
    expect(run(rule, a, 18).took).toBeNull();
  });
});

describe('tunings and two wheels', () => {
  it('arcade and sim are one rule: they differ only by the preset\'s own keys', () => {
    for (const id of Object.keys(VEHICLES)) {
      const s = vehicleRule(id), a = vehicleRule(id, { tuning: 'arcade' });
      const diff = Object.keys({ ...s, ...a }).filter((k) => JSON.stringify(s[k]) !== JSON.stringify(a[k])).sort();
      for (const k of diff) expect(['tuning', 'grip', 'drivenShare', 'brakeEff', 'steerMax', 'landKeep', 'surfaceSoft'], `${id}.${k}`).toContain(k);
    }
    expect(Object.keys(CONDITIONS)).toEqual(['dry', 'wet', 'snow', 'ice']);
    expect(() => vehicleRule('hovercraft')).toThrow(/not one of kart/);
    expect(() => vehicleRule('kart', { tuning: 'pro' })).toThrow(/tuning 'pro'/);
  });
  it('a bike leans into its turn, tan λ = v²κ/g', () => {
    const w = car(vehicleRule('dirtBike'), { v0: 12 });
    for (let k = 0; k < 30; k++) step(w, { forward: 0.3, turn: -0.5 });
    const e = w.byId.c, kappa = Math.tan(e.steerAngle) / VEHICLES.dirtBike.wheelbase;
    expect(e.lean).toBeCloseTo(Math.atan((e.speed ** 2 * kappa) / 9.81), 6);
    expect(Math.abs(e.lean)).toBeGreaterThan(0.1);
    expect(car(vehicleRule('compact')).byId.c.lean).toBeUndefined();
  });
});

describe('rivals in rally cars race the stunt park, flying its ramps', () => {
  it('lift to land the gap and the tabletop, lap without backing off a wall', () => {
    const plan = planTrack({ form: 'circuit', course: 'stunt-park' }), T = trackContract(plan), ground = trackSurface(plan), table = driveSurfaceTable(plan);
    const ride = { ref: 'r', rule: vehicleRule('rally') }, q = { goal: 'race', ride: 'car', rivals: 2, laps: 2 };
    const cast = raceCast(q, { roadway: T }, ride), mech = composeMechanics(goalMechanics(q, { roadway: T }), { player: 'car' });
    expect(cast.entities[0].rule.ramps.map((r) => [r.lo, r.hi])).toEqual(T.ramps.filter((r) => r.band).map((r) => [r.band.lo, r.band.hi]));
    const player = { id: 'car', pilotable: true, rule: ride.rule, body: { type: 'none' }, transform: { ...cast.pilot.transform } };
    const S = simLevel({ entities: [player, ...cast.entities.map((e) => ({ ...e, body: { type: 'none' } }))], events: mech.events, colliders: plan.colliders }, { ground: (p) => ground(p), surface: (p) => surfaceAt(table, p) });
    const gap = T.ramps.find((r) => r.kind === 'gap'), lipSpeeds = [];
    let flights = 0, backs = 0, near = new Set();
    for (let k = 0; k < 30 * 150; k++) {
      S.frame(1 / 30);
      for (const id of ['rival-1', 'rival-2']) {
        const e = S.world.byId[id], d = Math.hypot(e.transform.pos[0] - gap.lip.at[0], e.transform.pos[1] - gap.lip.at[1]);
        if (d < 2 && !near.has(id)) { near.add(id); lipSpeeds.push(e.speed); } else if (d > 10) near.delete(id);
        if (e.landed) flights++;
        if (e.backT > 0) backs++;
      }
    }
    for (const id of ['rival-1', 'rival-2']) expect(S.world.byId[id].laps, id).toBeGreaterThanOrEqual(2);
    expect(flights).toBeGreaterThan(4);
    expect(lipSpeeds.length).toBeGreaterThan(1);
    for (const v of lipSpeeds) { expect(v).toBeLessThanOrEqual(gap.band.hi + 0.5); expect(v).toBeGreaterThanOrEqual(gap.band.lo - 1); }
    expect(backs).toBe(0);
  }, 60000);
});
