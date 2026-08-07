import { describe, expect, it } from 'vitest';

import { createWorld, stepWorld } from './controllable-world.js';

// ── the `drive` rule (drivable-vehicles.plan.md D2) ──────────────────────────────────────────────
// Headless gates: determinism (house standard) + the physics-SHAPE assertions — the numbers are
// not pinned, the RELATIONSHIPS are: more horsepower accelerates harder, more mass (same brakes)
// stops longer, the steady-state turning radius matches the bicycle model, the wheel phase is
// distance-true. Plus the D5 affordance facts every later effect layer binds against.

const DT = 1 / 60;
const flat = { ground: () => 0 };

const car = (rule = {}, pos = [0, 0, 0]) => createWorld({
  entities: [{ id: 'car', rule: { type: 'drive', horsepower: 150, mass: 1400, wheelbase: 2.8, wheelRadius: 0.33, ...rule }, transform: { pos, heading: 0 } }],
});

const run = (w, input, steps, hooks = flat) => { for (let i = 0; i < steps; i++) stepWorld(w, input, DT, hooks); return w.byId.car; };

describe('rule: drive — longitudinal model', () => {
  it('is deterministic: same inputs → identical replay (house standard)', () => {
    const script = (i) => ({ forward: i < 120 ? 1 : -1, turn: i > 60 ? -0.7 : 0 });
    const go = () => {
      const w = car();
      for (let i = 0; i < 200; i++) stepWorld(w, script(i), DT, flat);
      return w.byId.car;
    };
    const a = go(), b = go();
    expect(a.transform.pos).toEqual(b.transform.pos);
    expect(a.speed).toBe(b.speed);
    expect(a.steerAngle).toBe(b.steerAngle);
  });

  it('throttle accelerates; DOUBLE the horsepower reaches 15 u/s measurably faster', () => {
    const timeTo = (hp) => {
      const w = car({ horsepower: hp });
      for (let i = 0; i < 2000; i++) {
        stepWorld(w, { forward: 1 }, DT, flat);
        if (w.byId.car.speed >= 15) return i;
      }
      return Infinity;
    };
    const t100 = timeTo(100), t200 = timeTo(200);
    expect(t100).toBeLessThan(Infinity);
    expect(t200).toBeLessThan(t100 * 0.75);   // measurably, not marginally
  });

  it('braking fights mass: DOUBLE the mass (same brakeForce) stops from 15 u/s in a longer distance', () => {
    const stopDist = (mass) => {
      const w = car({ mass, brakeForce: 11000, topSpeed: 15, horsepower: 400 });
      run(w, { forward: 1 }, 600);                       // saturate at topSpeed
      expect(w.byId.car.speed).toBeCloseTo(15, 0);
      const x0 = w.byId.car.transform.pos[0];
      let i = 0;
      while (w.byId.car.speed > 0 && i++ < 2000) stepWorld(w, { forward: -1 }, DT, flat);
      return w.byId.car.transform.pos[0] - x0;
    };
    const light = stopDist(1000), heavy = stopDist(2000);
    expect(heavy).toBeGreaterThan(light * 1.5);
  });

  it('coasting decays: lifting off bleeds speed to a standstill (drag + rolling resistance)', () => {
    const w = car({ topSpeed: 12, horsepower: 300 });
    run(w, { forward: 1 }, 600);
    const vTop = w.byId.car.speed;
    expect(vTop).toBeGreaterThan(10);
    run(w, {}, 240);
    expect(w.byId.car.speed).toBeLessThan(vTop);         // decaying…
    run(w, {}, 6000);                                    // rolling resistance grinds it down (~75s)
    expect(w.byId.car.speed).toBe(0);                    // …to a genuine rest (deadband)
  });

  it('S at a standstill reverses, capped at reverseSpeed; W brakes the reverse roll', () => {
    const w = car({ reverseSpeed: 5 });
    run(w, { forward: -1 }, 600);
    expect(w.byId.car.speed).toBeCloseTo(-5, 1);         // reverse, capped
    expect(w.byId.car.transform.pos[0]).toBeLessThan(0); // actually rolled backward
    run(w, { forward: 1 }, 90);                          // W against reverse motion = brake first
    expect(w.byId.car.speed).toBeGreaterThan(-5);
  });
});

describe('rule: drive — bicycle steering', () => {
  it('turning radius at steady speed ≈ wheelbase / tan(steer); a longer wheelbase turns wider', () => {
    const radius = (wheelbase) => {
      const w = car({ topSpeed: 12, horsepower: 400, wheelbase });
      run(w, { forward: 1 }, 600);                       // steady 12 u/s
      run(w, { forward: 1, turn: -1 }, 120);             // settle the steer slew (A = left)
      const c = w.byId.car;
      const h0 = c.transform.heading;
      stepWorld(w, { forward: 1, turn: -1 }, DT, flat);
      const rate = (c.transform.heading - h0) / DT;      // rad/s
      return { R: c.speed / rate, expected: wheelbase / Math.tan(c.steerAngle) };
    };
    const a = radius(2.8);
    expect(a.R).toBeCloseTo(a.expected, 1);
    const b = radius(5.6);                               // the truck
    expect(b.R).toBeGreaterThan(a.R);
  });

  it('steer angle is slewed (no instant snap) and tightened as speed rises', () => {
    const w = car();
    stepWorld(w, { turn: -1 }, DT, flat);
    const s1 = w.byId.car.steerAngle;
    expect(s1).toBeGreaterThan(0);                       // A steers LEFT (heading+ convention)
    expect(s1).toBeLessThan(0.1);                        // one frame of slew, not the full angle
    run(w, { turn: -1 }, 120);
    const parked = w.byId.car.steerAngle;                // full lock at rest
    const w2 = car({ topSpeed: 25, horsepower: 400 });
    run(w2, { forward: 1 }, 900);
    run(w2, { forward: 1, turn: -1 }, 120);
    expect(w2.byId.car.steerAngle).toBeLessThan(parked); // tightened at speed
  });
});

describe('rule: drive — wheels, ground, and the D5 affordance facts', () => {
  it('wheelPhase is distance-true: phase = distance / (2π·wheelRadius), signed by direction', () => {
    const w = car({ wheelRadius: 0.4, topSpeed: 10, horsepower: 300 });
    run(w, { forward: 1 }, 600);
    const c = w.byId.car;
    expect(c.wheelPhase).toBeCloseTo(c.transform.pos[0] / (2 * Math.PI * 0.4), 5);
    expect(c.gaitPhase).toBe(c.wheelPhase);              // the roll clip's driver
  });

  it('follows terrain and descends a ledge at a clamped rate (no airborne cars)', () => {
    const w = car({ topSpeed: 10, horsepower: 300, fallRate: 4 });
    const terraced = { ground: (p) => (p[0] < 20 ? 2 : 0) };   // a 2u drop past x=20
    run(w, { forward: 1 }, 60, terraced);
    expect(w.byId.car.transform.pos[2]).toBe(2);         // seated on the terrace
    run(w, { forward: 1 }, 600, terraced);
    const c = w.byId.car;
    expect(c.transform.pos[0]).toBeGreaterThan(20);
    expect(c.transform.pos[2]).toBe(0);                  // followed the ledge down…
    // …and the descent was CLAMPED: with a slow fallRate, catch the car mid-ease past the edge
    const w2 = car({ topSpeed: 10, horsepower: 300, fallRate: 0.5 });
    const m = w2.byId.car;
    let i = 0;
    while (m.transform.pos[0] <= 21 && i++ < 2000) stepWorld(w2, { forward: 1 }, DT, terraced);
    expect(m.transform.pos[2]).toBeGreaterThan(0);       // past the edge, still easing down
    expect(m.transform.pos[2]).toBeLessThan(2);          // but no longer on the terrace
  });

  it('surfaces the affordance vocabulary: the named facts effects will bind against', () => {
    const w = car({ topSpeed: 18, horsepower: 400 });
    stepWorld(w, { forward: 1 }, DT, flat);
    const c = w.byId.car;
    expect(c.boarded).toBe(true);                        // first driven frame edge
    expect(c.locomotion).toBe('drive');
    stepWorld(w, { forward: 1 }, DT, flat);
    expect(c.boarded).toBe(false);                       // an edge, not a state
    run(w, { forward: 1 }, 600);
    expect(typeof c.speed).toBe('number');
    expect(typeof c.wheelSpin).toBe('number');
    expect(c.throttle).toBe(1);
    expect(c.braking).toBe(false);
    run(w, { forward: 1, turn: -1 }, 90);
    expect(c.skidding).toBe(true);                       // full lock at 18 u/s exceeds grip·g demand
    stepWorld(w, { forward: -1 }, DT, flat);
    expect(c.braking).toBe(true);
    expect(c.brakeStart).toBe(true);                     // the brake-light edge
  });
});

describe('the D4 composition: walk up, T to board, drive (the proving-ground replay)', () => {
  it('boards via the existing pilot swap, throttles, coasts, brakes, and arcs — deterministically', () => {
    // The plan\'s manifest shape: a walking player + a pilotable car whose pilotRule is `drive`
    // (ambient static). BOTH are pilotable — the swap machinery transfers among pilotables, so
    // "walk up, T to board" is the same T that switches suits. Zero new machinery.
    const w = createWorld({
      entities: [
        { id: 'driver', pilotable: true, rule: { type: 'walk', speed: 4, eye: 0.9 }, ambient: { type: 'static' }, transform: { pos: [0, 0, 0], heading: 0 } },
        {
          id: 'car', pilotable: true,
          rule: { type: 'drive', horsepower: 300, mass: 1450, brakeForce: 11000, wheelbase: 2.8, wheelRadius: 0.33, topSpeed: 18 },
          ambient: { type: 'static' },
          transform: { pos: [6, 0, 0], heading: 0 },
        },
      ],
      camera: { rule: 'follow', target: 'driver', dist: 9, height: 4 },
      pilot: 'driver',
    });
    const car = w.byId.car, driver = w.byId.driver;
    expect(w.pilotId).toBe('driver');

    run(w, { forward: 1 }, 60);                          // walk toward the car
    expect(driver.transform.pos[0]).toBeGreaterThan(2);
    stepWorld(w, { swap: 1 }, DT, flat);                 // T — board
    expect(w.pilotId).toBe('car');
    expect(w.camera.rule.target).toBe('car');            // the follow camera retargets with the swap
    expect(car.boarded).toBe(true);                      // the D5 edge fires on the first driven frame

    let phase = 0;                                       // integrate the expected wheel phase alongside
    const drive = (input, steps) => { for (let i = 0; i < steps; i++) { stepWorld(w, input, DT, flat); phase += car.speed * DT / (2 * Math.PI * 0.33); } };
    const d0 = driver.transform.pos.slice();
    drive({ forward: 1 }, 240);                          // throttle
    const vTop = car.speed;
    expect(vTop).toBeGreaterThan(10);                    // speed rose
    drive({}, 120);                                      // coast
    expect(car.speed).toBeLessThan(vTop);                // …and decayed
    const h0 = car.transform.heading;
    drive({ forward: 1, turn: -1 }, 120);                // steer arc (A = left)
    expect(car.transform.heading).toBeGreaterThan(h0 + 0.3);   // heading swept the arc
    let guard = 0;
    while (car.speed > 0.05 && guard++ < 600) drive({ forward: -1 }, 1);   // brake to the stop…
    drive({}, 10);                                       // …and release (held S would REVERSE — by design)
    expect(car.speed).toBe(0);
    expect(car.wheelPhase).toBeCloseTo(phase, 6);        // distance-true through the whole bout
    expect(driver.transform.pos).toEqual(d0);            // the vacated driver stood still (ambient static)
  });
});
