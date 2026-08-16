import { describe, expect, it } from 'vitest';

import { createWorld, stepWorld, normalizeEntity, assembleControllableScene } from './controllable-world.js';
import { composeControllable, EMISSION, EMISSION_ENGINE } from './controllable/compose.js';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// run a fixed input for N steps at fixed dt.
const run = (state, input, steps, dt = 1 / 60, hooks) => { for (let i = 0; i < steps; i++) stepWorld(state, input, dt, hooks); return state; };

describe('createWorld', () => {
  it('normalizes entities and indexes them by id', () => {
    const w = createWorld({ entities: [{ id: 'a', rule: { type: 'walk' } }, { rule: { type: 'glide' } }] });
    expect(w.entities.length).toBe(2);
    expect(w.byId.a).toBeTruthy();
    expect(w.entities[1].id).toBe('ent-1');   // fallback id
  });

  it('turns the camera sugar into an isCamera entity', () => {
    const w = createWorld({ entities: [{ id: 'hero', rule: { type: 'walk' } }], camera: { rule: 'follow', target: 'hero' } });
    expect(w.camera).toBeTruthy();
    expect(w.camera.isCamera).toBe(true);
    expect(w.camera.rule.type).toBe('follow');
    expect(w.camera.rule.target).toBe('hero');
  });

  it('defaults a missing rule/body to inert types', () => {
    const e = normalizeEntity({}, 0);
    expect(e.rule.type).toBe('static');
    expect(e.body.type).toBe('none');
    expect(e.transform.pos).toEqual([0, 0, 0]);
  });
});

describe('rule: walk (tank)', () => {
  it('W moves forward along heading; gait phase advances with distance', () => {
    const w = createWorld({ entities: [{ id: 'h', rule: { type: 'walk', speed: 6 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(w, { forward: 1 }, 60);   // 1 second
    expect(w.byId.h.transform.pos[0]).toBeCloseTo(6, 1);   // heading 0 → +X
    expect(w.byId.h.transform.pos[1]).toBeCloseTo(0, 5);
    expect(Math.abs(w.byId.h.gaitPhase)).toBeGreaterThan(0);
    expect(w.byId.h.moving).toBe(true);
  });

  it('S advances gait phase backward (cycle plays in reverse)', () => {
    const w = createWorld({ entities: [{ id: 'h', rule: { type: 'walk' }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(w, { forward: -1 }, 30);
    expect(w.byId.h.gaitPhase).toBeLessThan(0);
    expect(w.byId.h.transform.pos[0]).toBeLessThan(0);
  });

  it('A/D turn the heading', () => {
    const w = createWorld({ entities: [{ id: 'h', rule: { type: 'walk', turn: 2 }, transform: { heading: 0 } }] });
    run(w, { turn: 1 }, 60);
    expect(w.byId.h.transform.heading).toBeCloseTo(2, 1);   // 2 rad/s · 1s
  });

  it('a ground hook sets the foot height', () => {
    const w = createWorld({ entities: [{ id: 'h', rule: { type: 'walk' }, transform: { pos: [0, 0, 99] } }] });
    run(w, { forward: 1 }, 5, 1 / 60, { ground: () => 0 });
    expect(w.byId.h.transform.pos[2]).toBe(0);
  });

  it('standing still does not advance the gait', () => {
    const w = createWorld({ entities: [{ id: 'h', rule: { type: 'walk' } }] });
    run(w, {}, 30);
    expect(w.byId.h.gaitPhase).toBe(0);
    expect(w.byId.h.moving).toBe(false);
  });
});

describe('rule: glide (free flight, no gravity)', () => {
  it('accelerates forward, keeps momentum, and does not fall', () => {
    const w = createWorld({ entities: [{ id: 'd', rule: { type: 'glide' }, transform: { pos: [0, 0, 10], heading: 0 } }] });
    run(w, { forward: 1 }, 30);
    expect(w.byId.d.transform.pos[0]).toBeGreaterThan(0);   // moved forward
    expect(w.byId.d.transform.pos[2]).toBeCloseTo(10, 5);   // no gravity → altitude held
    const x1 = w.byId.d.transform.pos[0];
    run(w, {}, 10);   // release input → coasts on momentum, then damps
    expect(w.byId.d.transform.pos[0]).toBeGreaterThan(x1);
  });

  it('lift climbs; look steers heading', () => {
    const w = createWorld({ entities: [{ id: 'd', rule: { type: 'glide' }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(w, { lift: 1 }, 20);
    expect(w.byId.d.transform.pos[2]).toBeGreaterThan(0);
    const h0 = w.byId.d.transform.heading;
    run(w, { lookDX: 100 }, 5);
    expect(w.byId.d.transform.heading).not.toBeCloseTo(h0, 3);
  });

  it('respects maxSpeed', () => {
    const w = createWorld({ entities: [{ id: 'd', rule: { type: 'glide', maxSpeed: 5, accel: 100 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(w, { forward: 1 }, 120);
    const v = w.byId.d.vel;
    expect(Math.hypot(v[0], v[1], v[2])).toBeLessThanOrEqual(5 + 1e-6);
  });
});

describe('rule: platform space mode (R18 — 6DoF Newtonian float)', () => {
  const mk = (extra = {}) => createWorld({ entities: [{ id: 's', rule: {
    type: 'platform', space: true, turnMode: 'look', eye: 0,
    speed: 6, spaceAccel: 40, spaceDamping: 2, spaceMaxSpeed: 20, liftAccel: 40, ...extra,
  }, transform: { pos: [0, 0, 10], heading: 0, pitch: 0 } }] });

  it('does not fall (no gravity) and never grounds', () => {
    const w = mk();
    run(w, {}, 60);   // no input, no ground hook
    expect(w.byId.s.transform.pos[2]).toBeCloseTo(10, 5);
    expect(w.byId.s.grounded).toBe(false);
  });

  it('thrusts forward and COASTS on release (momentum drift)', () => {
    const w = mk();
    run(w, { forward: 1 }, 30);
    expect(w.byId.s.transform.pos[0]).toBeGreaterThan(0);
    expect(w.byId.s.transform.pos[2]).toBeCloseTo(10, 5);   // heading/pitch 0 → pure +x, no climb
    const x1 = w.byId.s.transform.pos[0];
    run(w, {}, 8);   // release → Newtonian coast
    expect(w.byId.s.transform.pos[0]).toBeGreaterThan(x1);
  });

  it('Space ASCENDS, X DESCENDS (jumpHeld / kneel → vertical trim)', () => {
    const up = mk();
    run(up, { jumpHeld: 1 }, 30);
    expect(up.byId.s.transform.pos[2]).toBeGreaterThan(10);
    const dn = mk();
    run(dn, { kneel: 1 }, 30);
    expect(dn.byId.s.transform.pos[2]).toBeLessThan(10);
  });

  it('flies where it looks (6DoF): forward with look-pitch climbs', () => {
    const w = mk();
    w.byId.s.transform.pitch = 0.8;   // look up
    run(w, { forward: 1 }, 30);
    expect(w.byId.s.transform.pos[2]).toBeGreaterThan(10);   // forward thrust carries a +z component
    expect(w.byId.s.transform.pos[0]).toBeGreaterThan(0);
  });

  it('respects the mode speed cap', () => {
    const w = mk({ spaceMaxSpeed: 5, spaceAccel: 200 });
    run(w, { forward: 1 }, 180);
    const v = w.byId.s.vel;
    expect(Math.hypot(v[0], v[1], v[2])).toBeLessThanOrEqual(5 + 1e-6);
  });

  it('no jump impulse in space (Space is a steady thrust, not a launch arc)', () => {
    // a ground platform LAUNCHES on jump (a big first-frame z velocity); space just thrusts up.
    const w = mk({ jumpSpeed: 100 });
    stepWorld(w, { jump: 1, jumpHeld: 1 }, 1 / 60);
    expect(w.byId.s.vel[2]).toBeLessThan(2);   // no 100-unit jump kick — only thrust accel this frame
  });

  it('sets the always-on thrust floor (idle > 0, boost = 1)', () => {
    const w = mk({ boostMax: 9 });
    run(w, {}, 5);
    expect(w.byId.s.thrust).toBeGreaterThan(0);      // always thrusting, even idle
    run(w, { boost: 1, forward: 1 }, 5);
    expect(w.byId.s.thrust).toBe(1);
  });

  it('dodge starts mid-float (grounded gate relaxed)', () => {
    const w = mk({ dodge: true });
    stepWorld(w, { boost: 1 }, 1 / 60);              // first tap opens the window
    stepWorld(w, { boost: 0 }, 1 / 60);              // release
    stepWorld(w, { boost: 1, forward: 1 }, 1 / 60);  // second tap → commit
    expect(w.byId.s.invincible).toBe(true);
    expect(w.byId.s.dodgeT).not.toBe(null);
  });

  it('SPACE is SOLID: a collider box stops the floating suit in 3D (sphere eject, rests against it)', () => {
    const box = { min: [6, -4, 4], max: [12, 4, 16] };
    const w = createWorld({ colliders: [box], entities: [{ id: 's', rule: {
      type: 'platform', space: true, turnMode: 'look', eye: 0, speed: 6,
      spaceAccel: 80, spaceDamping: 1, spaceMaxSpeed: 30, collideRadius: 1,
    }, transform: { pos: [0, 0, 10], heading: 0, pitch: 0 } }] });
    run(w, { forward: 1, boost: 1 }, 180);           // thrust straight into the box (z=10 is inside its z-span)
    const p = w.byId.s.transform.pos;
    expect(p[0]).toBeLessThan(box.min[0]);            // never tunnelled past the near face...
    expect(p[0]).toBeGreaterThan(box.min[0] - 1.5);   // ...ejected to ~near-face − radius, resting against it
    expect(w.byId.s.vel[0]).toBeLessThan(0.5);        // inward velocity killed (no jitter / push-through)
  });

  it('no colliders → space movement is byte-identical (the 3D block is opt-in)', () => {
    const a = mk();
    const b = createWorld({ colliders: [], entities: [{ id: 's', rule: {
      type: 'platform', space: true, turnMode: 'look', eye: 0, speed: 6, spaceAccel: 40, spaceDamping: 2, spaceMaxSpeed: 20, collideRadius: 1,
    }, transform: { pos: [0, 0, 10], heading: 0, pitch: 0 } }] });
    run(a, { forward: 1 }, 90); run(b, { forward: 1 }, 90);
    expect(b.byId.s.transform.pos[0]).toBeCloseTo(a.byId.s.transform.pos[0], 6);
  });
});

describe('suit-vs-suit collision (body.collide egg — suits are solid to each other)', () => {
  const mover = (pos) => ({ id: 'a', rule: { type: 'platform', space: true, turnMode: 'look', eye: 0, speed: 6, spaceAccel: 80, spaceDamping: 1, spaceMaxSpeed: 30 }, transform: { pos, heading: 0, pitch: 0 }, body: { type: 'figure-rig', collide: { a: 3, c: 5 } } });
  const still = (pos) => ({ id: 'b', rule: { type: 'clock' }, transform: { pos }, body: { type: 'figure-rig', collide: { a: 3, c: 5 } } });

  it('a moving suit cannot pass through a stationary one (egg separation, rests against it)', () => {
    const w = createWorld({ entities: [mover([0, 0, 10]), still([12, 0, 10])] });
    run(w, { forward: 1, boost: 1 }, 180);   // thrust straight at the stationary suit
    const gap = w.byId.b.transform.pos[0] - w.byId.a.transform.pos[0];
    expect(gap).toBeGreaterThan(5.7);        // held ~sum of lateral egg radii (3+3=6) apart — no overlap
    expect(w.byId.a.transform.pos[0]).toBeLessThan(w.byId.b.transform.pos[0]);   // never punched through
    expect(w.byId.b.transform.pos[0]).toBeCloseTo(12, 3);   // the immobile (ambient) suit holds; the mover ejects
    expect(w.byId.a.vel[0]).toBeLessThan(0.5);              // came to rest against it (velocity into it killed)
  });

  it('the egg is TALL: a suit stacked well above clears (vertical extent = c, not a)', () => {
    // b sits directly above a (same x/y), 11 up — beyond 2·c (10) so the eggs do NOT touch vertically…
    const w = createWorld({ entities: [mover([0, 0, 10]), still([0, 0, 21])] });
    run(w, { jumpHeld: 1 }, 40);   // a ascends toward b
    // …a rises until its egg meets b's (centers ~2·c=10 apart → a.z ~ 11), never passing through.
    expect(w.byId.a.transform.pos[2]).toBeLessThan(w.byId.b.transform.pos[2]);
    expect(w.byId.a.transform.pos[2]).toBeGreaterThan(9);   // it did climb, then was stopped short
  });

  it('no body.collide → suits are non-solid (opt-in; byte-identical)', () => {
    const w = createWorld({ entities: [
      { id: 'a', rule: { type: 'platform', space: true, turnMode: 'look', eye: 0, speed: 6, spaceAccel: 80, spaceDamping: 1, spaceMaxSpeed: 30 }, transform: { pos: [0, 0, 10], heading: 0, pitch: 0 }, body: { type: 'figure-rig' } },
      { id: 'b', rule: { type: 'clock' }, transform: { pos: [8, 0, 10] }, body: { type: 'figure-rig' } },
    ] });
    run(w, { forward: 1, boost: 1 }, 60);
    expect(w.byId.a.transform.pos[0]).toBeGreaterThan(8);   // flew straight through (no collide volume)
  });
});

describe('health-bar data (hpMax capture + damage survives a pilot switch)', () => {
  it('hpMax is captured at spawn; damage chips body.hp and holds across T (what the HUD reads)', () => {
    const w = createWorld({ pilot: 'me', entities: [
      { id: 'me', pilotable: true, ambient: { type: 'clock' }, weapon: { fireClass: 'sight', auto: true, cooldown: 0, coreAngle: 45, range: 100, damage: 30, impact: 0 }, rule: { type: 'platform', space: true, turnMode: 'look', eye: 0 }, transform: { pos: [0, 0, 10], heading: 0, pitch: 0 }, body: { type: 'figure-rig', hittable: true, radius: 2, hp: 150 } },
      { id: 'foe', pilotable: true, ambient: { type: 'clock' }, rule: { type: 'platform', space: true }, transform: { pos: [10, 0, 10] }, body: { type: 'figure-rig', hittable: true, radius: 2, hp: 200, poise: 100, staggerDur: 1 } },
    ] });
    expect(w.byId.foe.hpMax).toBe(200);          // denominator captured
    expect(w.byId.me.hpMax).toBe(150);
    run(w, { fire: 1 }, 3);                        // auto (cooldown 0) → 3 shots into the foe
    const dmg = w.byId.foe.body.hp;
    expect(dmg).toBeLessThan(200);                 // damaged
    expect(dmg).toBeGreaterThan(0);
    stepWorld(w, { swap: 1 }, 1 / 60);             // T → pilot the (damaged) foe
    expect(w.pilotId).toBe('foe');
    expect(w.byId.foe.body.hp).toBe(dmg);          // the HUD now reads the foe's REDUCED hp (carries across the switch)
  });
});

describe('rule: platform (gravity + jump)', () => {
  const FLAT = { ground: () => 0 };   // a flat floor at z=0 under everything

  it('gravity pulls a spawned-in-air body down and it rests on the surface', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0 }, transform: { pos: [0, 0, 5] } }] });
    run(w, {}, 120, 1 / 60, FLAT);   // 2s
    expect(w.byId.p.transform.pos[2]).toBeCloseTo(0, 2);   // landed on the floor
    expect(w.byId.p.vel[2]).toBeCloseTo(0, 4);             // vertical velocity zeroed
    expect(w.byId.p.grounded).toBe(true);
  });

  it('a jump leaves the ground and comes back down to it', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, jumpSpeed: 8 }, transform: { pos: [0, 0, 0] } }] });
    stepWorld(w, {}, 1 / 60, FLAT);
    expect(w.byId.p.grounded).toBe(true);
    let maxZ = 0, airborne = false;
    for (let i = 0; i < 120; i++) {
      stepWorld(w, { jump: i === 0 ? 1 : 0, jumpHeld: i < 10 ? 1 : 0 }, 1 / 60, FLAT);
      maxZ = Math.max(maxZ, w.byId.p.transform.pos[2]);
      if (!w.byId.p.grounded) airborne = true;
    }
    expect(maxZ).toBeGreaterThan(0.8);                     // clearly left the ground
    expect(airborne).toBe(true);
    expect(w.byId.p.transform.pos[2]).toBeCloseTo(0, 2);   // and landed again
    expect(w.byId.p.grounded).toBe(true);
  });

  it('variable height: holding jump rises higher than a one-frame tap', () => {
    const hop = (holdFrames) => {
      const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, jumpSpeed: 8, jumpCut: 0 }, transform: { pos: [0, 0, 0] } }] });
      stepWorld(w, {}, 1 / 60, FLAT);
      let maxZ = 0;
      for (let i = 0; i < 120; i++) {
        const held = i === 0 || (i > 0 && i <= holdFrames);
        stepWorld(w, { jump: i === 0 ? 1 : 0, jumpHeld: held ? 1 : 0 }, 1 / 60, FLAT);
        maxZ = Math.max(maxZ, w.byId.p.transform.pos[2]);
      }
      return maxZ;
    };
    expect(hop(60)).toBeGreaterThan(hop(1) + 0.3);
  });

  it('coyote time: a jump just after leaving a ledge still fires', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, coyote: 0.1 } }] });
    stepWorld(w, {}, 1 / 60, FLAT);                        // grounded
    expect(w.byId.p.grounded).toBe(true);
    const PIT = { ground: () => null };                    // walked off into open air
    for (let i = 0; i < 3; i++) stepWorld(w, {}, 1 / 60, PIT);   // ~0.05s airborne (within window)
    stepWorld(w, { jump: 1, jumpHeld: 1 }, 1 / 60, PIT);
    expect(w.byId.p.vel[2]).toBeGreaterThan(0);            // coyote jump launched despite no ground
  });

  it('mouselook (turnMode:look): A/D strafes instead of turning', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', turnMode: 'look', eye: 0, speed: 6, strafe: 1 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    const h0 = w.byId.p.transform.heading;
    run(w, { turn: 1 }, 30, 1 / 60, FLAT);                 // A/D maps to the `turn` axis
    expect(w.byId.p.transform.heading).toBeCloseTo(h0, 6); // heading unchanged — the mouse turns, not A/D
    expect(Math.abs(w.byId.p.transform.pos[1])).toBeGreaterThan(0.5);   // it strafed sideways instead
  });

  it('turn-in-place: mouse rotation with no movement steps (locomotion=turn), signed by direction', () => {
    const mk = () => createWorld({ entities: [{ id: 'p', rule: { type: 'platform', turnMode: 'look', eye: 0 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    const w = mk();
    run(w, { lookDX: 40 }, 20, 1 / 60, FLAT);              // mouse-rotate in place, no W/A/S/D
    const p = w.byId.p;
    expect(p.transform.heading).not.toBeCloseTo(0, 3);     // it turned
    expect(p.locomotion).toBe('turn');                     // and it STEPS, not idle/skate
    expect(p.moving).toBe(true);
    expect(Math.abs(p.gaitPhase)).toBeGreaterThan(0);      // the step cycle advanced
    // opposite mouse direction advances the gait the other way (mirror step)
    const wL = mk();
    run(wL, { lookDX: -40 }, 20, 1 / 60, FLAT);
    expect(Math.sign(wL.byId.p.gaitPhase)).toBe(-Math.sign(p.gaitPhase));
  });

  it('turn-in-place yields to translation: walking while steering plays the walk, not the turn step', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', turnMode: 'look', eye: 0, speed: 6 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(w, { forward: 1, lookDX: 40 }, 20, 1 / 60, FLAT);  // moving AND steering
    expect(w.byId.p.locomotion).toBe('forward');           // translation wins — no turn-step
  });

  it('tiny mouse jitter below turnStepMin does not trigger a step (stays idle)', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', turnMode: 'look', eye: 0 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(w, { lookDX: 0.5 }, 20, 1 / 60, FLAT);             // 0.5·0.0025 = 0.00125 < 0.0025 threshold
    expect(w.byId.p.moving).toBe(false);                   // no step — idle holds
  });

  it('mouselook: vertical mouse pitches the view (clamped) and does not move you vertically', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', turnMode: 'look', eye: 0 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(w, { lookDY: 50 }, 30, 1 / 60, FLAT);              // sustained look-up
    expect(w.byId.p.transform.pitch).toBeGreaterThan(0.2);            // the view pitched
    expect(w.byId.p.transform.pitch).toBeLessThanOrEqual(Math.PI / 2);   // clamped shy of straight up
    expect(w.byId.p.transform.pos[2]).toBeCloseTo(0, 2);             // looking up did NOT lift you
  });

  it('boost (F): thrusters drive forward at boostSpeed with locomotion=boost; release restores', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, speed: 6, boostSpeed: 15 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(w, { boost: 1 }, 60, 1 / 60, FLAT);   // 1s of F, no W held
    const p = w.byId.p;
    expect(p.transform.pos[0]).toBeCloseTo(15, 0);   // boostSpeed × 1s along heading
    expect(p.locomotion).toBe('boost');
    expect(p.moving).toBe(true);
    run(w, {}, 5, 1 / 60, FLAT);              // release F
    expect(p.locomotion).not.toBe('boost');
    expect(p.moving).toBe(false);
  });

  it('jumpWindup: Space squats first, then launches; airborne holds the leap pose with frozen gait', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, jumpSpeed: 8, jumpWindup: 0.2 }, transform: { pos: [0, 0, 0] } }] });
    run(w, {}, 5, 1 / 60, FLAT);                      // settle onto the ground
    const p = w.byId.p;
    stepWorld(w, { jump: 1, jumpHeld: 1 }, 1 / 60, FLAT);
    expect(p.locomotion).toBe('squat');               // anticipation crouch, not yet airborne
    expect(p.transform.pos[2]).toBeCloseTo(0, 3);
    expect(p.moving).toBe(true);
    run(w, { jumpHeld: 1 }, 13, 1 / 60, FLAT);        // ride out the 0.2s windup
    expect(p.transform.pos[2]).toBeGreaterThan(0.1);  // launched
    expect(p.locomotion).toBe('leap');                // airborne, no forward drive → leap held
    const phase = p.gaitPhase;
    run(w, {}, 5, 1 / 60, FLAT);
    expect(p.gaitPhase).toBe(phase);                  // legs do NOT cycle in the air
  });

  it('a forward jump plays the boost pose in the air', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, jumpSpeed: 8 }, transform: { pos: [0, 0, 0] } }] });
    run(w, {}, 5, 1 / 60, FLAT);
    stepWorld(w, { jump: 1, jumpHeld: 1, forward: 1 }, 1 / 60, FLAT);   // no windup → instant launch
    run(w, { forward: 1, jumpHeld: 1 }, 5, 1 / 60, FLAT);   // keep Space held (else the jump-cut shortens the hop)
    expect(w.byId.p.transform.pos[2]).toBeGreaterThan(0.1);
    expect(w.byId.p.locomotion).toBe('boost');
  });

  it('kneel (opt-in, held X): roots the entity on one knee; boost stands it up; no opt-in → inert', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, speed: 6, kneel: true }, transform: { pos: [0, 0, 0] } }] });
    run(w, {}, 5, 1 / 60, FLAT);
    run(w, { kneel: 1, forward: 1 }, 30, 1 / 60, FLAT);
    expect(w.byId.p.transform.pos[0]).toBeCloseTo(0, 3);   // rooted — W does nothing while kneeling
    expect(w.byId.p.locomotion).toBe('kneel');
    expect(w.byId.p.moving).toBe(true);
    run(w, { kneel: 1, boost: 1 }, 30, 1 / 60, FLAT);      // F takes precedence
    expect(w.byId.p.locomotion).toBe('boost');
    expect(w.byId.p.transform.pos[0]).toBeGreaterThan(5);
    const w2 = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, speed: 6 }, transform: { pos: [0, 0, 0] } }] });
    run(w2, {}, 5, 1 / 60, FLAT);
    run(w2, { kneel: 1, forward: 1 }, 30, 1 / 60, FLAT);   // without kneel:true, X is inert
    expect(w2.byId.p.transform.pos[0]).toBeGreaterThan(1);
  });

  it('strike (opt-in, left mouse): a fire press roots the unit and plays ONE swing, edge-only; no opt-in → inert', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, speed: 6, strike: 'melee', strikeDur: 0.5 }, transform: { pos: [0, 0, 0] } }] });
    run(w, {}, 5, 1 / 60, FLAT);
    run(w, { fire: 1, forward: 1 }, 3, 1 / 60, FLAT);        // press w/ W held: the forward-thrust swing starts
    expect(w.byId.p.locomotion).toBe('swing_forward');       // held WASD picks the directional swing (below)
    expect(w.byId.p.moving).toBe(true);
    run(w, { forward: 1 }, 20, 1 / 60, FLAT);                // mouse released mid-swing: it keeps playing
    expect(w.byId.p.locomotion).toBe('swing_forward');
    expect(w.byId.p.transform.pos[0]).toBeCloseTo(0, 3);     // rooted through the strike — W does nothing
    expect(w.byId.p.gaitPhase).toBeGreaterThan(0.5);         // phase is TIME-driven progress, not distance
    run(w, { forward: 1 }, 30, 1 / 60, FLAT);                // past strikeDur: control returns to the gait
    expect(w.byId.p.locomotion).toBe('forward');
    expect(w.byId.p.transform.pos[0]).toBeGreaterThan(1);
    run(w, { fire: 1 }, 60, 1 / 60, FLAT);                   // a fresh press swings again; HOLDING past the
    expect(w.byId.p.locomotion).toBe('forward');             // end does not retrigger (edge-only)
    expect(w.byId.p.moving).toBe(false);
    run(w, { fire: 1, boost: 1 }, 2, 1 / 60, FLAT);          // boost cancels/preempts the strike
    expect(w.byId.p.locomotion).toBe('boost');
    const w2 = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, speed: 6 }, transform: { pos: [0, 0, 0] } }] });
    run(w2, {}, 5, 1 / 60, FLAT);
    run(w2, { fire: 1, forward: 1 }, 30, 1 / 60, FLAT);      // without strike opt-in, fire is inert here
    expect(w2.byId.p.locomotion).toBe('forward');
    expect(w2.byId.p.transform.pos[0]).toBeGreaterThan(1);
  });

  it('directional swings: the held WASD at press time picks swing_<dir> (thrust/cuts/back cleave)', () => {
    const mk = () => createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, speed: 6, strike: 'melee', strikeDur: 0.5 }, transform: { pos: [0, 0, 0] } }] });
    const swingWith = (input) => { const w = mk(); run(w, {}, 5, 1 / 60, FLAT); run(w, { fire: 1, ...input }, 3, 1 / 60, FLAT); return w.byId.p.locomotion; };
    expect(swingWith({})).toBe('swing_neutral');             // no direction → the standing cross
    expect(swingWith({ forward: 1 })).toBe('swing_forward');  // W → thrust
    expect(swingWith({ forward: -1 })).toBe('swing_back');    // S → the great cleave (topples)
    expect(swingWith({ strafe: 1 })).toBe('swing_right');     // D → forehand cut
    expect(swingWith({ strafe: -1 })).toBe('swing_left');     // A → backhand cut
    // dominant planar axis wins when both held (forward beats a smaller strafe)
    expect(swingWith({ forward: 1, strafe: 0.3 })).toBe('swing_forward');
  });

  it('topple vs stagger: ONLY the back cleave knocks down; every other melee staggers', () => {
    const world = () => createWorld({ entities: [
      { id: 'atk', rule: { type: 'platform', eye: 0, speed: 6, strike: 'melee', strikeDur: 0.4, strikeReach: 4, strikeDamage: 10 }, transform: { pos: [0, 0, 0], heading: 0 } },
      { id: 'foe', rule: { type: 'static' }, body: { type: 'figure-rig', hittable: true, radius: 0.5, hp: 500, poise: 100, staggerDur: 1, toppleDur: 2 }, transform: { pos: [2, 0, 0] } },
    ] });
    // a NEUTRAL swing (no direction) → STAGGER
    let w = world(); run(w, {}, 5, 1 / 60, FLAT); run(w, { fire: 1 }, 24, 1 / 60, FLAT);
    expect(w.byId.foe.reactClip).toBe('stagger');
    expect(w.byId.foe.locomotion).toBe('stagger');
    // a FORWARD thrust (any non-back direction) → also STAGGER
    w = world(); run(w, {}, 5, 1 / 60, FLAT); run(w, { fire: 1, forward: 1 }, 24, 1 / 60, FLAT);
    expect(w.byId.atk.swingClip).toBe('swing_forward');
    expect(w.byId.foe.reactClip).toBe('stagger');
    // the BACK cleave (S held) → the ONLY topple
    w = world(); run(w, {}, 5, 1 / 60, FLAT); run(w, { fire: 1, forward: -1 }, 24, 1 / 60, FLAT);
    expect(w.byId.atk.swingClip).toBe('swing_back');
    expect(w.byId.foe.reactClip).toBe('topple');
    expect(w.byId.foe.locomotion).toBe('topple');
  });

  it('strikeVerbs + swingSet (the whip seams): per-verb cone aim/reach/topple, own clip set', () => {
    // the geof heat-rod shape: side sweeps aim the WHOLE cone to their side (the body
    // turns with the strike), the thrust reaches long on a narrow line, the downswing
    // (back AND neutral) claims the topple — and the slot fires its own whip_<dir>
    // clip set so the sword's swing_<dir> clips are untouched.
    const verbs = {
      left: { strikeYaw: 90, strikeCone: 45 },
      right: { strikeYaw: -90, strikeCone: 45 },
      forward: { strikeReach: 8, strikeCone: 12 },
      back: { topple: false },
      neutral: { topple: true },
    };
    const world = (foePos) => createWorld({ entities: [
      { id: 'atk', rule: { type: 'platform', eye: 0, speed: 6, strike: 'melee', strikeDur: 0.4, strikeReach: 4, strikeDamage: 10, swingSet: 'whip', strikeVerbs: verbs }, transform: { pos: [0, 0, 0], heading: 0 } },
      { id: 'foe', rule: { type: 'static' }, body: { type: 'figure-rig', hittable: true, radius: 0.5, hp: 500, poise: 100, staggerDur: 1, toppleDur: 2 }, transform: { pos: foePos } },
    ] });
    // swingSet: the strike plays the slot's own clip set
    let w = world([2, 0, 0]); run(w, {}, 5, 1 / 60, FLAT); run(w, { fire: 1, strafe: -1 }, 3, 1 / 60, FLAT);
    expect(w.byId.atk.swingClip).toBe('whip_left');
    expect(w.byId.atk.locomotion).toBe('whip_left');
    // the LEFT sweep aims 90° to the left — the foe DEAD AHEAD is missed…
    run(w, { strafe: -1 }, 24, 1 / 60, FLAT);
    expect(w.byId.foe.hits || 0).toBe(0);
    // …and a foe standing on the unit's LEFT (+y at heading 0) is struck
    w = world([0, 2, 0]); run(w, {}, 5, 1 / 60, FLAT); run(w, { fire: 1, strafe: -1 }, 27, 1 / 60, FLAT);
    expect(w.byId.foe.hits).toBe(1);
    expect(w.byId.foe.reactClip).toBe('stagger');
    // mirrored RIGHT sweep strikes the right flank (−y)
    w = world([0, -2, 0]); run(w, {}, 5, 1 / 60, FLAT); run(w, { fire: 1, strafe: 1 }, 27, 1 / 60, FLAT);
    expect(w.byId.atk.swingClip).toBe('whip_right');
    expect(w.byId.foe.hits).toBe(1);
    // the THRUST reaches past the slot default (4) out to its own 8
    w = world([7, 0, 0]); run(w, {}, 5, 1 / 60, FLAT); run(w, { fire: 1, forward: 1 }, 27, 1 / 60, FLAT);
    expect(w.byId.atk.swingClip).toBe('whip_forward');
    expect(w.byId.foe.hits).toBe(1);
    // a verb can REFUSE the back-cleave topple…
    w = world([2, 0, 0]); run(w, {}, 5, 1 / 60, FLAT); run(w, { fire: 1, forward: -1 }, 27, 1 / 60, FLAT);
    expect(w.byId.atk.swingClip).toBe('whip_back');
    expect(w.byId.foe.reactClip).toBe('stagger');
    // …and another can CLAIM it (the no-direction downswing crack)
    w = world([2, 0, 0]); run(w, {}, 5, 1 / 60, FLAT); run(w, { fire: 1 }, 27, 1 / 60, FLAT);
    expect(w.byId.atk.swingClip).toBe('whip_neutral');
    expect(w.byId.foe.reactClip).toBe('topple');
    expect(w.byId.foe.locomotion).toBe('topple');
  });

  it('per-verb swingSet (hidden heat rod): the side sweep rides the saber swing clips while forward keeps the whip set', () => {
    // the 2026-08-10 geof shape: slot swingSet 'whip', but left/right claim the standard
    // 'swing' set — the mk2 saber side cut — with the default ±50° side yaw (no strikeYaw).
    const verbs = {
      left: { swingSet: 'swing' },
      right: { swingSet: 'swing' },
      forward: { strikeReach: 8, strikeCone: 12 },
    };
    const world = (foePos) => createWorld({ entities: [
      { id: 'atk', rule: { type: 'platform', eye: 0, speed: 6, strike: 'melee', strikeDur: 0.4, strikeReach: 4, strikeDamage: 10, swingSet: 'whip', strikeVerbs: verbs }, transform: { pos: [0, 0, 0], heading: 0 } },
      { id: 'foe', rule: { type: 'static' }, body: { type: 'figure-rig', hittable: true, radius: 0.5, hp: 500, poise: 100, staggerDur: 1, toppleDur: 2 }, transform: { pos: foePos } },
    ] });
    // LEFT sweep: the saber clip, and the saber's ±50° side hitbox — a foe on the front-left
    // quarter (the saber side-cut catch) is struck
    let w = world([1.5, 1.5, 0]); run(w, {}, 5, 1 / 60, FLAT); run(w, { fire: 1, strafe: -1 }, 27, 1 / 60, FLAT);
    expect(w.byId.atk.swingClip).toBe('swing_left');
    expect(w.byId.foe.hits).toBe(1);
    // RIGHT sweep mirrors
    w = world([1.5, -1.5, 0]); run(w, {}, 5, 1 / 60, FLAT); run(w, { fire: 1, strafe: 1 }, 27, 1 / 60, FLAT);
    expect(w.byId.atk.swingClip).toBe('swing_right');
    expect(w.byId.foe.hits).toBe(1);
    // FORWARD (no per-verb set) still fires the slot's whip clip — the rope-dart thrust
    w = world([7, 0, 0]); run(w, {}, 5, 1 / 60, FLAT); run(w, { fire: 1, forward: 1 }, 27, 1 / 60, FLAT);
    expect(w.byId.atk.swingClip).toBe('whip_forward');
    expect(w.byId.foe.hits).toBe(1);
  });

  it('clash records (melee-clash-fx): a connect stamps a seq-keyed contact point on the target hull', () => {
    const world = (extra = {}) => createWorld({ entities: [
      { id: 'atk', rule: { type: 'platform', eye: 0, strikeEye: 2, speed: 6, strike: 'melee', strikeDur: 0.4, strikeReach: 4, strikeDamage: 10, ...extra }, transform: { pos: [0, 0, 0], heading: 0 } },
      { id: 'foe', rule: { type: 'static' }, body: { type: 'figure-rig', hittable: true, radius: 0.5, hp: 500, poise: 100, staggerDur: 1 }, transform: { pos: [2, 0, 0] } },
    ] });
    let w = world();
    run(w, {}, 5, 1 / 60, FLAT);
    expect(w.clashes).toEqual([]);                          // pre-swing: the pool is empty
    run(w, { fire: 1, forward: 1 }, 24, 1 / 60, FLAT);      // the forward thrust connects
    expect(w.clashes.length).toBe(1);                       // ONE record per target per swing
    const c = w.clashes[0];
    expect(c.seq).toBe(0);
    // contact point: on the foe's hull FACING the attacker (its lateral radius 0.5 back along
    // the strike line from [2,0]) at the strike plane's height (attacker eye 2) — where the
    // blade meets the armor, not the foe's feet-anchored center.
    expect(c.pos[0]).toBeCloseTo(1.5, 3);
    expect(c.pos[1]).toBeCloseTo(0, 3);
    expect(c.pos[2]).toBeCloseTo(2, 3);
    expect(c.dir[0]).toBeCloseTo(-1, 3);                    // the hull normal points back at the attacker
    expect(c.fxColor).toBe(null);                           // no strikeFx → renderer default tint
    expect(c.fxScale).toBe(null);
    // strikeFx rides the same cascade as every other strike number → the record carries the tint
    w = world({ strikeFx: { color: 0x7fe6ff, scale: 2 } });
    run(w, {}, 5, 1 / 60, FLAT); run(w, { fire: 1, forward: 1 }, 24, 1 / 60, FLAT);
    expect(w.clashes[0].fxColor).toBe(0x7fe6ff);
    expect(w.clashes[0].fxScale).toBe(2);
  });

  it('clash records: one per target per swing, trimmed after ~1s, seq stays monotonic, deterministic', () => {
    const world = () => createWorld({ entities: [
      { id: 'atk', rule: { type: 'platform', eye: 0, speed: 6, strike: 'melee', strikeDur: 0.4, strikeReach: 4, strikeDamage: 10 }, transform: { pos: [0, 0, 0], heading: 0 } },
      { id: 'foeA', rule: { type: 'static' }, body: { type: 'figure-rig', hittable: true, radius: 0.5, hp: 500, poise: 100, staggerDur: 1 }, transform: { pos: [2, 0.6, 0] } },
      { id: 'foeB', rule: { type: 'static' }, body: { type: 'figure-rig', hittable: true, radius: 0.5, hp: 500, poise: 100, staggerDur: 1 }, transform: { pos: [2, -0.6, 0] } },
    ] });
    // BOTH foes inside the cone take a clash record from the one swing (seqs 0 and 1)
    let w = world(); run(w, {}, 5, 1 / 60, FLAT); run(w, { fire: 1, forward: 1 }, 24, 1 / 60, FLAT);
    expect(w.clashes.length).toBe(2);
    expect(w.clashes.map((c) => c.seq)).toEqual([0, 1]);
    // no declared strike plane (eye 0 — the suit case) → the record sits at the target's hull
    // CENTER height (legacy sphere: its radius), never at the feet-height adjudication plane
    expect(w.clashes[0].pos[2]).toBeCloseTo(0.5, 3);
    // records live ~1s (the renderer edge-detects new seqs each frame), then trim; the seq
    // counter never rewinds — the renderer's high-water mark stays valid after a trim.
    run(w, {}, 80, 1 / 60, FLAT);
    expect(w.clashes.length).toBe(0);
    expect(w.clashSeq).toBe(2);
    // determinism: the same script replays byte-identical records (fixed input + dt → same clashes)
    const w1 = world(), w2 = world();
    run(w1, {}, 5, 1 / 60, FLAT); run(w1, { fire: 1, forward: 1 }, 20, 1 / 60, FLAT);
    run(w2, {}, 5, 1 / 60, FLAT); run(w2, { fire: 1, forward: 1 }, 20, 1 / 60, FLAT);
    expect(JSON.stringify(w1.clashes)).toBe(JSON.stringify(w2.clashes));
  });

  it('downed: a killing blow (hp→0) floors the unit permanently, held at the topple heap', () => {
    const w = createWorld({ entities: [
      { id: 'atk', rule: { type: 'platform', eye: 0, speed: 6, strike: 'melee', strikeDur: 0.4, strikeReach: 4, strikeDamage: 999 }, transform: { pos: [0, 0, 0], heading: 0 } },
      { id: 'foe', rule: { type: 'static' }, body: { type: 'figure-rig', hittable: true, radius: 0.5, hp: 50, poise: 100, staggerDur: 1 }, transform: { pos: [2, 0, 0] } },
    ] });
    run(w, {}, 5, 1 / 60, FLAT);
    run(w, { fire: 1 }, 24, 1 / 60, FLAT);
    expect(w.byId.foe.body.hp).toBe(0);
    expect(w.byId.foe.downed).toBe(true);
    expect(w.byId.foe.locomotion).toBe('topple');
    // stays down forever: many seconds later it is STILL toppled, never recovers
    run(w, {}, 600, 1 / 60, FLAT);
    expect(w.byId.foe.downed).toBe(true);
    expect(w.byId.foe.locomotion).toBe('topple');
  });

  it('getup: an ALIVE topple chains the fall → toppled punish window → getup rise → back on its feet', () => {
    const w = createWorld({ entities: [
      { id: 'atk', rule: { type: 'platform', eye: 0, speed: 6, strike: 'melee', strikeDur: 0.4, strikeReach: 4, strikeDamage: 10 }, transform: { pos: [0, 0, 0], heading: 0 } },
      { id: 'foe', rule: { type: 'static' }, body: { type: 'figure-rig', hittable: true, radius: 0.5, hp: 500, poise: 100, staggerDur: 1, toppleDur: 1, getupDur: 1 }, transform: { pos: [2, 0, 0] } },
    ] });
    run(w, {}, 5, 1 / 60, FLAT);
    run(w, { fire: 1, forward: -1 }, 20, 1 / 60, FLAT);   // BACK cleave connect → the topple FALL
    expect(w.byId.foe.reactClip).toBe('topple');
    expect(w.byId.foe.downed).toBe(false);             // alive: it will get up
    expect(w.byId.foe.invincible).toBeFalsy();          // NOT invincible during the fall
    // past the ~1s fall → it stays TOPPLED + VULNERABLE (no i-frames) for downPause (2s default)
    run(w, {}, 60, 1 / 60, FLAT);
    expect(w.byId.foe.reactClip).toBe('topple');
    expect(w.byId.foe.locomotion).toBe('topple');       // holds the felled flat frame
    expect(w.byId.foe.moving).toBe(true);               // renderer samples the topple clip, not idle
    expect(w.byId.foe.gaitPhase).toBe(1);
    expect(w.byId.foe.downPauseT).toBeGreaterThanOrEqual(0);
    expect(w.byId.foe.invincible).toBeFalsy();          // STILL vulnerable on the ground
    // not enough time yet: the 2s punish window is still toppled, not the invincible getup.
    run(w, {}, 100, 1 / 60, FLAT);
    expect(w.byId.foe.reactClip).toBe('topple');
    expect(w.byId.foe.invincible).toBeFalsy();
    // past the 2s toppled window → the getup RISE (i-frames start HERE, as the rise begins)
    run(w, {}, 30, 1 / 60, FLAT);
    expect(w.byId.foe.reactClip).toBe('getup');
    expect(w.byId.foe.locomotion).toBe('getup');
    expect(w.byId.foe.invincible).toBe(true);           // i-frames WHILE getting up
    run(w, {}, 80, 1 / 60, FLAT);                      // past the 1s rise → recovered, on its feet
    expect(w.byId.foe.staggerT).toBe(null);
    expect(w.byId.foe.invincible).toBe(false);          // i-frames off once up
    expect(w.byId.foe.locomotion).toBe('forward');     // rule resumes (static foe's default gait)
  });

  it('toppled punish window is VULNERABLE, the getup RISE is invincible: fire lands while floored but not while it rises', () => {
    const world = () => createWorld({ entities: [
      { id: 'atk', weapon: { fireClass: 'sight', auto: true, cooldown: 0, coreAngle: 40, range: 100, damage: 5, impact: 0 }, rule: { type: 'platform', eye: 0, speed: 6 }, transform: { pos: [0, 0, 0], heading: 0 } },
      { id: 'foe', rule: { type: 'static' }, body: { type: 'figure-rig', hittable: true, radius: 2, hp: 500, poise: 100, staggerDur: 1, toppleDur: 1, getupDur: 1 }, transform: { pos: [4, 0, 0] } },
    ] });
    // sanity: fire DOES land on an upright foe (drops hp)
    let w = world(); run(w, {}, 5, 1 / 60, FLAT); run(w, { fire: 1 }, 20, 1 / 60, FLAT);
    expect(w.byId.foe.body.hp).toBeLessThan(500);
    // floor it (arm the reaction directly), advance past the fall into the toppled punish window — flat + VULNERABLE
    w = world();
    run(w, {}, 5, 1 / 60, FLAT);
    w.byId.foe.reactClip = 'topple'; w.byId.foe.staggerT = 0.99; w.byId.foe.reactDur = 1; w.byId.foe.poise = 100;
    run(w, {}, 4, 1 / 60, FLAT);                        // topple fall completes → the flat punish window begins
    expect(w.byId.foe.reactClip).toBe('topple');
    expect(w.byId.foe.moving).toBe(true);
    expect(w.byId.foe.gaitPhase).toBe(1);
    expect(w.byId.foe.invincible).toBeFalsy();          // NOT invincible on the ground
    const hpFloored = w.byId.foe.body.hp;
    run(w, { fire: 1 }, 12, 1 / 60, FLAT);              // hose it WHILE it lies flat
    expect(w.byId.foe.body.hp).toBeLessThan(hpFloored); // took damage — the punish window
    // let the 2s toppled window finish and the rise begin, then fire again: the RISE is invincible
    run(w, {}, 120, 1 / 60, FLAT);                      // past the 2s toppled hold → the getup RISE
    expect(w.byId.foe.reactClip).toBe('getup');
    expect(w.byId.foe.invincible).toBe(true);
    const hpRising = w.byId.foe.body.hp;
    run(w, { fire: 1 }, 30, 1 / 60, FLAT);              // hose it while it rises
    expect(w.byId.foe.body.hp).toBe(hpRising);          // took NOTHING — i-frames held
  });

  it('toppled punish window uses a floor-level hit volume, not the standing egg', () => {
    const world = (eye) => createWorld({ entities: [
      { id: 'atk', weapon: { fireClass: 'sight', auto: true, cooldown: 0, coreAngle: 0.5, range: 100, damage: 5, impact: 0, eye }, rule: { type: 'platform', eye: 0, speed: 6 }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 } },
      { id: 'foe', rule: { type: 'static' }, body: { type: 'figure-rig', hittable: true, egg: { a: 1, c: 6 }, hp: 100, poise: 100, staggerDur: 1, toppleDur: 1, getupDur: 1 }, transform: { pos: [10, 0, 0], heading: 0 } },
    ] });
    const floorIt = (w) => {
      const foe = w.byId.foe;
      foe.reactClip = 'topple'; foe.staggerT = 1; foe.downPauseT = 0; foe.reactDur = 1;
      foe.locomotion = 'topple'; foe.gaitPhase = 1; foe.moving = true; foe.invincible = false;
    };

    let w = world(6);
    run(w, {}, 5, 1 / 60, FLAT); floorIt(w);
    run(w, { fire: 1 }, 1, 1 / 60, FLAT);
    expect(w.byId.foe.body.hp).toBe(100);                // chest-height shot no longer hits the standing egg

    w = world(1);
    run(w, {}, 5, 1 / 60, FLAT); floorIt(w);
    run(w, { fire: 1 }, 1, 1 / 60, FLAT);
    expect(w.byId.foe.body.hp).toBeLessThan(100);        // floor-height shot hits the toppled body
  });

  it('chargeMax: holding Space stops and charges; a longer hold jumps higher', () => {
    const apex = (holdSec) => {
      const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, jumpSpeed: 8, chargeMax: 4 }, transform: { pos: [0, 0, 0] } }] });
      run(w, {}, 5, 1 / 60, FLAT);
      run(w, { jumpHeld: 1, forward: 1 }, Math.round(holdSec * 60), 1 / 60, FLAT);
      expect(w.byId.p.transform.pos[0]).toBeCloseTo(0, 3);   // STOP-and-charge: W does nothing while coiling
      expect(w.byId.p.locomotion).toBe('squat');
      expect(w.byId.p.gaitPhase).toBeGreaterThan(0);         // the squat depth ramp is being driven
      let mx = 0;
      for (let i = 0; i < 200; i += 1) { stepWorld(w, {}, 1 / 60, FLAT); mx = Math.max(mx, w.byId.p.transform.pos[2]); }
      return mx;
    };
    const short = apex(0.5);
    const long = apex(2);
    expect(long).toBeGreaterThan(short * 1.5);
  });

  it('full charge auto-launches toward the held direction and the dash carries through the air', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, jumpSpeed: 8, chargeMax: 1, chargeDash: 10 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(w, {}, 5, 1 / 60, FLAT);
    run(w, { jumpHeld: 1, forward: 1 }, 70, 1 / 60, FLAT);   // hold past full charge — never released
    const p = w.byId.p;
    expect(p.transform.pos[2]).toBeGreaterThan(0.1);         // auto-launched
    const x0 = p.transform.pos[0];
    run(w, {}, 30, 1 / 60, FLAT);                            // no input at all — the dash carries
    expect(p.transform.pos[0]).toBeGreaterThan(x0 + 2);
    run(w, {}, 300, 1 / 60, FLAT);                           // land
    expect(p.transform.pos[2]).toBeCloseTo(0, 2);
    const xl = p.transform.pos[0];
    run(w, {}, 30, 1 / 60, FLAT);
    expect(p.transform.pos[0]).toBeCloseTo(xl, 3);           // carry cleared at touchdown
  });

  it('directional boost: F+S dashes backward, F+A/D dashes sideways, diagonals normalize', () => {
    const mk = () => createWorld({ entities: [{ id: 'p', rule: { type: 'platform', turnMode: 'look', eye: 0, speed: 6, boostSpeed: 20 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    // F + S → full boost speed BACKWARD, back-dash clip
    const back = mk();
    run(back, { boost: 1, forward: -1 }, 60, 1 / 60, FLAT);
    expect(back.byId.p.transform.pos[0]).toBeCloseTo(-20, 0);
    expect(back.byId.p.locomotion).toBe('boost_back');
    // F + D (mouselook folds turn into strafe) → full boost speed SIDEWAYS, the DIRECTIONAL
    // flying-kick clip (D = right → boost_right; A → boost_left), and the thrust yaw the
    // renderer vectors the backpack jets by (right dash = +π/2, left = −π/2, forward = 0)
    const side = mk();
    run(side, { boost: 1, turn: 1 }, 60, 1 / 60, FLAT);
    expect(Math.abs(side.byId.p.transform.pos[1])).toBeCloseTo(20, 0);
    expect(Math.abs(side.byId.p.transform.pos[0])).toBeCloseTo(0, 1);
    expect(side.byId.p.locomotion).toBe('boost_right');
    expect(side.byId.p.thrustYaw).toBeCloseTo(Math.PI / 2, 5);
    const sideL = mk();
    run(sideL, { boost: 1, turn: -1 }, 10, 1 / 60, FLAT);
    expect(sideL.byId.p.locomotion).toBe('boost_left');
    expect(sideL.byId.p.thrustYaw).toBeCloseTo(-Math.PI / 2, 5);
    const fwdY = mk();
    run(fwdY, { boost: 1 }, 10, 1 / 60, FLAT);
    expect(fwdY.byId.p.thrustYaw).toBeCloseTo(0, 5);
    // F + W + D → the dash speed stays boostSpeed (vector normalized)
    const diag = mk();
    run(diag, { boost: 1, forward: 1, turn: 1 }, 60, 1 / 60, FLAT);
    const d = Math.hypot(diag.byId.p.transform.pos[0], diag.byId.p.transform.pos[1]);
    expect(d).toBeCloseTo(20, 0);
  });

  it('boostSpeed defaults to 3.5× walk speed', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, speed: 6 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(w, { boost: 1 }, 60, 1 / 60, FLAT);
    expect(w.byId.p.transform.pos[0]).toBeCloseTo(21, 0);
  });

  it('tank mode: A turns left, D turns right (not inverted)', () => {
    const left = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(left, { turn: -1 }, 20, 1 / 60, FLAT);             // turn = D−A; A held → −1
    expect(left.byId.p.transform.heading).toBeGreaterThan(0);   // A → heading increases → LEFT
    const right = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(right, { turn: 1 }, 20, 1 / 60, FLAT);             // D held → +1
    expect(right.byId.p.transform.heading).toBeLessThan(0);     // D → heading decreases → RIGHT
  });

  it('is deterministic: same inputs → identical trajectory', () => {
    const trace = () => {
      const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0 }, transform: { pos: [0, 0, 3] } }] });
      const out = [];
      for (let i = 0; i < 90; i++) {
        stepWorld(w, { forward: 1, jump: i === 5 ? 1 : 0, jumpHeld: i >= 5 && i < 15 ? 1 : 0 }, 1 / 60, FLAT);
        out.push(w.byId.p.transform.pos.slice());
      }
      return out;
    };
    expect(trace()).toEqual(trace());
  });
});

describe('platform: boost gauge (drain on boost/jump/dodge, regen, empty-lock)', () => {
  const FLAT = { ground: () => 0 };
  const mk = (extra = {}) => createWorld({ entities: [{ id: 'p',
    rule: { type: 'platform', turnMode: 'look', eye: 0, speed: 6, boostSpeed: 20, boostMax: 9, ...extra },
    transform: { pos: [0, 0, 0], heading: 0 } }] });

  it('starts full at boostMax and drains 1 unit per second of continuous boost', () => {
    const w = mk();
    run(w, {}, 1, 1 / 60, FLAT);
    expect(w.byId.p.boost).toBeCloseTo(9, 5);
    run(w, { boost: 1 }, 120, 1 / 60, FLAT);          // 2s of thrust
    expect(w.byId.p.boost).toBeCloseTo(7, 1);         // ~2 drained
  });

  it('gives ~9 seconds of non-stop boost, then the gauge empties and locks thrust off', () => {
    const w = mk();
    run(w, { boost: 1 }, 60 * 9 + 5, 1 / 60, FLAT);   // hold F past 9s
    const p = w.byId.p;
    expect(p.boost).toBeLessThan(0.3);                // bottomed out
    expect(p.boostLock).toBe(true);
    const x = p.transform.pos[0];
    // HELD past empty stays LOCKED (no stutter-burst): keep holding F for 4 more seconds —
    // it must not re-engage even as the gauge crawls back, because the button never released.
    run(w, { boost: 1 }, 60 * 4, 1 / 60, FLAT);
    expect(p.boostLock).toBe(true);
    expect(p.transform.pos[0]).toBeCloseTo(x, 2);     // frozen: F produces no thrust while spent+held
    // release the button and sit out the OVERHEAT (rev3: locked until FULL, ~7.5s) → F thrusts again
    run(w, {}, 60 * 7.6, 1 / 60, FLAT);
    expect(p.boostLock).toBe(false);
    run(w, { boost: 1 }, 20, 1 / 60, FLAT);
    expect(p.transform.pos[0]).toBeGreaterThan(x + 1);
  });

  it('an OVERHEAT (drained dry) recovers to full in ~7.5 seconds when the thrusters are cold (rev3)', () => {
    const w = mk();
    run(w, { boost: 1 }, 60 * 9 + 5, 1 / 60, FLAT);   // empty it
    expect(w.byId.p.boost).toBeLessThan(0.3);
    run(w, {}, 60 * 5, 1 / 60, FLAT);                 // 5s cold — the old ~5s regen would be full
    expect(w.byId.p.boost).toBeLessThan(8);           // the overheat climb (boostMax/7.5) is not
    expect(w.byId.p.boostLock).toBe(true);
    run(w, {}, 60 * 2.7, 1 / 60, FLAT);               // ~7.7s total: full + unlocked
    expect(w.byId.p.boost).toBeCloseTo(9, 1);
    expect(w.byId.p.boostLock).toBe(false);
  });

  it('the overheat holds until FULL (rev3); a pinned boostUnlockFrac restores the old 15% hysteresis', () => {
    const w = mk();
    run(w, { boost: 1 }, 60 * 9 + 5, 1 / 60, FLAT);   // empty + lock
    expect(w.byId.p.boostLock).toBe(true);
    run(w, {}, 60 * 4, 1 / 60, FLAT);                 // ~4.8 units back (53%) — old rule long unlocked
    expect(w.byId.p.boostLock).toBe(true);            // rev3: still overheated
    run(w, {}, 60 * 4, 1 / 60, FLAT);                 // topped out
    expect(w.byId.p.boostLock).toBe(false);           // released at FULL
    // the knob: the old early-unlock hysteresis is one pin away
    const w2 = mk({ boostUnlockFrac: 0.15 });
    run(w2, { boost: 1 }, 60 * 9 + 5, 1 / 60, FLAT);
    run(w2, {}, 60 * 1.5, 1 / 60, FLAT);              // ~1.8 units (20%) ≥ 15%
    expect(w2.byId.p.boostLock).toBe(false);          // released early, as pinned
  });

  it('a jump bites jumpBoostCost from the gauge', () => {
    const w = mk({ jumpBoostCost: 0.8 });
    run(w, {}, 3, 1 / 60, FLAT);
    const before = w.byId.p.boost;
    stepWorld(w, { jump: 1, jumpHeld: 1 }, 1 / 60, FLAT);   // launch
    run(w, {}, 3, 1 / 60, FLAT);
    expect(w.byId.p.boost).toBeLessThan(before - 0.5);      // ~0.8 gone (minus tiny regen)
  });

  it('an acrobatic dodge OVERHEATS the thruster (dumps + locks); dodgeOverheat:false is cost-only; dodgeBoostCost:0 is free', () => {
    // DEFAULT: a full-gauge dodge dumps the WHOLE gauge and locks it — the overheat
    const w = mk({ dodge: true, dodgeBoostCost: 2, doubleTapWindow: 0.28 });
    run(w, {}, 3, 1 / 60, FLAT);
    stepWorld(w, { boost: 1 }, 1 / 60, FLAT);          // tap 1
    stepWorld(w, {}, 1 / 60, FLAT);
    stepWorld(w, { boost: 1 }, 1 / 60, FLAT);          // tap 2 → dodge
    expect(w.byId.p.dodgeT).not.toBeNull();
    expect(w.byId.p.boost).toBeLessThan(0.5);          // gauge DUMPED, not sipped
    expect(w.byId.p.boostLock).toBe(true);             // and locked — OVERHEAT

    // REFUSED while overheated: a dead thruster cannot vector-roll
    const wR = mk({ dodge: true, dodgeBoostCost: 2, doubleTapWindow: 0.28 });
    run(wR, { boost: 1 }, 60 * 9 + 5, 1 / 60, FLAT);   // drain + lock (overheat)
    expect(wR.byId.p.boostLock).toBe(true);
    run(wR, {}, 2, 1 / 60, FLAT);                      // brief release, still well under 15%
    stepWorld(wR, { boost: 1 }, 1 / 60, FLAT);
    stepWorld(wR, {}, 1 / 60, FLAT);
    stepWorld(wR, { boost: 1 }, 1 / 60, FLAT);         // double-tap while overheated
    expect(wR.byId.p.dodgeT == null).toBe(true);       // refused

    // MODIFIER dodgeOverheat:false — the heat sink: cost-only, NOT locked, chainable
    const w2 = mk({ dodge: true, dodgeBoostCost: 2, dodgeOverheat: false, doubleTapWindow: 0.28 });
    run(w2, {}, 3, 1 / 60, FLAT);
    const before = w2.byId.p.boost;
    stepWorld(w2, { boost: 1 }, 1 / 60, FLAT);
    stepWorld(w2, {}, 1 / 60, FLAT);
    stepWorld(w2, { boost: 1 }, 1 / 60, FLAT);
    expect(w2.byId.p.dodgeT).not.toBeNull();
    expect(w2.byId.p.boost).toBeGreaterThan(before - 3);   // only ~2 spent, gauge not dumped
    expect(w2.byId.p.boostLock).toBeFalsy();               // no overheat

    // MODIFIER dodgeBoostCost:0 — free rolls even while locked
    const w3 = mk({ dodge: true, dodgeBoostCost: 0, doubleTapWindow: 0.28 });
    run(w3, { boost: 1 }, 60 * 9 + 5, 1 / 60, FLAT);   // empty + lock
    run(w3, {}, 2, 1 / 60, FLAT);
    stepWorld(w3, { boost: 1 }, 1 / 60, FLAT);
    stepWorld(w3, {}, 1 / 60, FLAT);
    stepWorld(w3, { boost: 1 }, 1 / 60, FLAT);         // double-tap
    expect(w3.byId.p.dodgeT).not.toBeNull();           // free roll works while locked
  });

  it('changing the dash direction mid-boost bites boostTurnCost', () => {
    const w = mk({ boostTurnCost: 0.75 });
    run(w, {}, 2, 1 / 60, FLAT);
    const start = w.byId.p.boost;
    run(w, { boost: 1, forward: 1 }, 30, 1 / 60, FLAT);   // 0.5s forward dash
    const afterFwd = w.byId.p.boost;
    run(w, { boost: 1, turn: 1 }, 30, 1 / 60, FLAT);      // flip to a side dash (direction change)
    const afterTurn = w.byId.p.boost;
    const fwdDrain = start - afterFwd;        // ~0.5 (time only)
    const turnDrain = afterFwd - afterTurn;   // ~0.5 + the 0.75 turn bite
    expect(turnDrain).toBeGreaterThan(fwdDrain + 0.6);
  });

  it('without boostMax the gauge is absent: infinite boost, no drain, no lock', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, speed: 6, boostSpeed: 20 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(w, { boost: 1 }, 60 * 30, 1 / 60, FLAT);       // 30s straight
    expect(w.byId.p.boost).toBeUndefined();            // never tracked
    expect(w.byId.p.boostLock).toBeFalsy();
    expect(w.byId.p.transform.pos[0]).toBeGreaterThan(550);   // moved the whole time (~600)
  });

  it('a KNOCKDOWN no longer freezes recovery: the gauge recovers + the reload finishes through the topple/pause/getup (2026-07-30)', () => {
    const w = createWorld({ entities: [
      { id: 'p',
        weapon: { fireClass: 'sight', cooldown: 0, coreAngle: 5, range: 100, magazine: 3, reload: 1 },
        rule: { type: 'platform', turnMode: 'look', eye: 0, speed: 6, boostSpeed: 20, boostMax: 9 },
        body: { type: 'figure-rig', hittable: true, radius: 1, hp: 500, poise: 100, staggerDur: 0.5, toppleDur: 0.5, getupDur: 1 },
        transform: { pos: [0, 0, 0], heading: 0 } },
    ] });
    run(w, {}, 5, 1 / 60, FLAT);
    const p = w.byId.p;
    // OVERHEAT the gauge (drained + locked) and put a reload IN PROGRESS, then FLOOR it and hold NO
    // input through the knockdown (fall 0.5 + toppled hold 2.0 + rise 1.0). The rule is suppressed
    // the entire time — the fix is that the gauge + autoloader keep ticking anyway (they used to freeze).
    p.boost = 0.5; p.boostLock = true;
    p.weapon.ammo = 0; p.weapon.reloading = true; p.weapon.reloadT = 1;
    p.reactClip = 'topple'; p.staggerT = 0; p.reactDur = 0.5; p.poise = 100;
    const boostFloor = p.boost;
    run(w, {}, 20, 1 / 60, FLAT);                         // ~0.33s into the FALL — rule suppressed
    expect(p.staggerT).not.toBeNull();                    // still reeling
    expect(p.boost).toBeGreaterThan(boostFloor);          // …yet the gauge RECOVERED (was frozen before this fix)
    expect(p.weapon.reloadT).toBeLessThan(1);             // …and the autoloader kept counting down
    run(w, {}, 130, 1 / 60, FLAT);                        // ride through the toppled hold
    expect(p.weapon.reloading).toBe(false);               // reload FINISHED mid-knockdown (1s < 2s)
    expect(p.weapon.ammo).toBe(3);                        // magazine refilled while DOWN
    expect(p.boost).toBeGreaterThan(2);                   // gauge kept climbing at overheatRegen through the reaction
  });
});

describe('platform: boost hover (boostHover — thrust ground clearance clears low obstacles)', () => {
  const FLAT = { ground: () => 0 };
  const suit = (extra = {}, pos = [0, 0, 0]) => ({
    id: 'p',
    rule: { type: 'platform', eye: 0, speed: 6, boostSpeed: 20, boostHover: 5, collideRadius: 1, collideHeight: 24, ...extra },
    transform: { pos, heading: 0 },
  });

  it('boosting lifts to the clearance and holds it (a float, not a landing)', () => {
    const w = createWorld({ entities: [suit()] });
    run(w, { boost: 1 }, 60, 1 / 60, FLAT);            // 1s of F
    const p = w.byId.p;
    expect(p.transform.pos[2]).toBeCloseTo(5, 3);      // riding the cushion at boostHover
    expect(p.hovering).toBe(true);
    expect(p.grounded).toBe(false);
    expect(p.locomotion).toBe('boost');                // the airborne boost pose
  });

  it('an obstacle LOWER than the clearance passes underneath; a TALLER one still blocks', () => {
    const low = { min: [10, -10, 0], max: [14, 10, 3] };    // 3 tall < hover 5 → skimmed over
    const tall = { min: [10, -10, 0], max: [14, 10, 8] };   // 8 tall > hover 5 → z-bands meet
    const go = (colliders, extra) => {
      const w = createWorld({ entities: [suit(extra)], colliders });
      run(w, { boost: 1 }, 120, 1 / 60, FLAT);         // 2s of F at 20/s
      return w.byId.p.transform.pos[0];
    };
    expect(go([low], {})).toBeGreaterThan(20);         // cleared the low box
    expect(go([tall], {})).toBeLessThan(10);           // stopped at the tall one
    expect(go([low], { boostHover: 0 })).toBeLessThan(10);   // without the hover the low box blocks too
  });

  it('the skim follows terrain: the cushion rides the surface under the suit', () => {
    const STEPPED = { ground: (p) => (p[0] > 10 ? 4 : 0) };   // a 4-high shelf past x=10
    const w = createWorld({ entities: [suit()] });
    run(w, { boost: 1 }, 150, 1 / 60, STEPPED);        // boost up onto the shelf's airspace
    const p = w.byId.p;
    expect(p.transform.pos[0]).toBeGreaterThan(11);
    expect(p.transform.pos[2]).toBeCloseTo(9, 1);      // shelf 4 + hover 5
  });

  it('releasing F drops the cushion: the suit falls and lands with a real touchdown', () => {
    const w = createWorld({ entities: [suit()] });
    run(w, { boost: 1 }, 60, 1 / 60, FLAT);            // hovering at 5
    let landed = false;
    for (let i = 0; i < 90; i++) {                     // release: 1.5s is plenty for a 5-unit fall
      stepWorld(w, {}, 1 / 60, FLAT);
      if (w.byId.p.landed) landed = true;
    }
    const p = w.byId.p;
    expect(p.transform.pos[2]).toBeCloseTo(0, 3);
    expect(p.grounded).toBe(true);
    expect(landed).toBe(true);                         // the landing edge fired (the clang)
  });

  it('an empty gauge kills the hover with the thrust', () => {
    const w = createWorld({ entities: [suit({ boostMax: 0.5 })] });
    run(w, { boost: 1 }, 180, 1 / 60, FLAT);           // 3s held — gauge dies at 0.5s
    const p = w.byId.p;
    expect(p.boostLock).toBe(true);
    expect(p.transform.pos[2]).toBeCloseTo(0, 2);      // back on the ground
    expect(p.hovering).toBe(false);
  });

  it('the dodge double-tap still fires from the hover (hoverGrace keeps the ground read)', () => {
    const w = createWorld({ entities: [suit({ dodge: true })] });
    run(w, { boost: 1, forward: 1 }, 60, 1 / 60, FLAT);   // hover-boosting forward
    run(w, {}, 3, 1 / 60, FLAT);                          // release mid-air (the drop begins)
    stepWorld(w, { boost: 1, forward: 1 }, 1 / 60, FLAT); // tap 1
    stepWorld(w, { forward: 1 }, 1 / 60, FLAT);
    stepWorld(w, { boost: 1, forward: 1 }, 1 / 60, FLAT); // tap 2 — inside the window, mid-drop
    expect(w.byId.p.dodgeT).not.toBeNull();               // the roll fired despite grounded=false
  });

  it('without boostHover the boost stays a ground dash (byte-identical legacy)', () => {
    const a = createWorld({ entities: [suit({ boostHover: 0 })] });
    const b = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, speed: 6, boostSpeed: 20 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(a, { boost: 1, forward: 1 }, 90, 1 / 60, FLAT);
    run(b, { boost: 1, forward: 1 }, 90, 1 / 60, FLAT);
    expect(a.byId.p.transform.pos[2]).toBe(0);
    expect(a.byId.p.transform.pos).toEqual(b.byId.p.transform.pos);
    expect(b.byId.p.grounded).toBe(true);
  });
});

describe('rule: clock (autonomous frame playback)', () => {
  it('advances the gait phase by time with no input', () => {
    const w = createWorld({ entities: [{ id: 't', rule: { type: 'clock', rate: 2 } }] });
    run(w, {}, 60);   // 1s at rate 2 → ~2 cycles
    expect(w.byId.t.gaitPhase).toBeCloseTo(2, 1);
    expect(w.byId.t.moving).toBe(true);
  });
});

describe('rule: follow (camera slaved to a target)', () => {
  it('settles behind and above a stationary target', () => {
    const w = createWorld({ entities: [{ id: 'hero', rule: { type: 'static' }, transform: { pos: [0, 0, 0], heading: 0 } }], camera: { rule: 'follow', target: 'hero', dist: 6, height: 3, lerp: 20 } });
    run(w, {}, 120);
    const cam = w.camera.transform.pos;
    expect(cam[0]).toBeCloseTo(-6, 0);   // heading 0 → behind is −X
    expect(cam[2]).toBeCloseTo(3, 0);
    expect(w.camera.lookAt).toBeTruthy();
  });

  it('trails a walking target (stays behind it as it moves +X)', () => {
    const w = createWorld({ entities: [{ id: 'hero', rule: { type: 'walk', speed: 4 }, transform: { pos: [0, 0, 0], heading: 0 } }], camera: { rule: 'follow', target: 'hero', dist: 6, lerp: 10 } });
    run(w, { forward: 1 }, 120);
    const hero = w.byId.hero.transform.pos, cam = w.camera.transform.pos;
    expect(hero[0]).toBeGreaterThan(3);
    expect(cam[0]).toBeLessThan(hero[0]);   // camera is behind the hero
    expect(w.camera.lookAt[0]).toBeGreaterThan(hero[0]);   // looks ahead of the hero
  });

  it('reverse:true settles in FRONT of the target, looking slightly behind it (mirrored framing)', () => {
    const w = createWorld({ entities: [{ id: 'hero', rule: { type: 'static' }, transform: { pos: [0, 0, 0], heading: 0 } }], camera: { rule: 'follow', target: 'hero', dist: 6, height: 3, lead: 4, reverse: true, lerp: 20 } });
    run(w, {}, 120);
    const cam = w.camera.transform.pos;
    expect(cam[0]).toBeCloseTo(6, 0);    // heading 0 → front is +X
    expect(cam[2]).toBeCloseTo(3, 0);
    expect(w.camera.lookAt[0]).toBeLessThan(0);   // look point mirrors behind the hero
  });

  it('flipping reverse mid-run ORBITS the camera around the target (never cuts through), and back', () => {
    const w = createWorld({ entities: [{ id: 'hero', rule: { type: 'static' }, transform: { pos: [0, 0, 0], heading: 0 } }], camera: { rule: 'follow', target: 'hero', dist: 6, lerp: 20 } });
    run(w, {}, 120);
    expect(w.camera.transform.pos[0]).toBeCloseTo(-6, 0);
    w.camera.rule.reverse = true;   // exactly what the world HUD button flips
    let minR = Infinity;
    for (let k = 0; k < 300; k++) { stepWorld(w, {}, 1 / 60); const p = w.camera.transform.pos; minR = Math.min(minR, Math.hypot(p[0], p[1])); }
    expect(w.camera.transform.pos[0]).toBeCloseTo(6, 0);   // settled in front
    expect(minR).toBeGreaterThan(3);                       // swung AROUND, not through the hero
    w.camera.rule.reverse = false;
    run(w, {}, 300);
    expect(w.camera.transform.pos[0]).toBeCloseTo(-6, 0);  // and back behind
  });
});

describe('determinism', () => {
  it('two identical input runs produce byte-identical state', () => {
    const spec = { entities: [{ id: 'h', rule: { type: 'walk' }, transform: { pos: [0, 0, 0], heading: 0.3 } }], camera: { rule: 'follow', target: 'h' } };
    const inputs = [{ forward: 1 }, { forward: 1, turn: 0.5 }, { forward: 0.5 }];
    const play = () => { const w = createWorld(spec); for (let k = 0; k < 90; k++) stepWorld(w, inputs[k % inputs.length], 1 / 60); return w; };
    const a = play(), b = play();
    expect(JSON.stringify(a.entities)).toBe(JSON.stringify(b.entities));
  });
});

describe('assembleControllableScene (standalone stage)', () => {
  it('builds a default checker floor + an initial camera when none given', () => {
    const p = assembleControllableScene({});
    expect(p.faces.length).toBeGreaterThan(10);
    expect(p.cameras[0].worldFraming).toBeTruthy();
    expect(p.faces.every((f) => f.corners.length === 4)).toBe(true);
  });

  it('uses caller-supplied faces verbatim', () => {
    const faces = [{ corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], fill: '#abc' }];
    expect(assembleControllableScene({ faces }).faces).toBe(faces);
  });

  it('honors a ground spec size/cell', () => {
    const small = assembleControllableScene({ ground: { size: 8, cell: 4 } }).faces;     // 2x2
    const big = assembleControllableScene({ ground: { size: 40, cell: 4 } }).faces;      // 10x10
    expect(big.faces?.length ?? big.length).toBeGreaterThan(small.length);
  });
});

describe('single source of truth (composed builders, controllable-split.plan.md S0)', () => {
  it('every EMISSION builder is self-contained, runnable JS (browser parity)', () => {
    // The tripwire for the split: a builder that closes over an IMPORTED symbol stringifies into
    // a browser copy with a dangling reference. Re-instantiating each builder from its own source
    // (no module scope) catches that the moment it happens.
    for (const b of EMISSION) {
      // eslint-disable-next-line no-new-func
      const rebuilt = new Function(`return (${b.toString()});`)();
      expect(typeof rebuilt).toBe('function');
    }
  });

  it('the composed engine from stringified sources behaves like the module (browser parity)', () => {
    // eslint-disable-next-line no-new-func
    const builders = EMISSION.map((b) => new Function(`return (${b.toString()});`)());
    const cw = composeControllable(builders);
    const w = cw.createWorld({ entities: [{ id: 'h', rule: { type: 'walk' }, transform: { heading: 0 } }] });
    cw.stepWorld(w, { forward: 1 }, 1 / 60);
    expect(w.byId.h.transform.pos[0]).toBeGreaterThan(0);
    // same step through the module instance → identical result (no drift between the two paths)
    const w2 = createWorld({ entities: [{ id: 'h', rule: { type: 'walk' }, transform: { heading: 0 } }] });
    stepWorld(w2, { forward: 1 }, 1 / 60);
    expect(w.byId.h.transform.pos).toEqual(w2.byId.h.transform.pos);
  });
});

describe('step pipeline (controllable-split.plan.md S3) — the registered slot order', () => {
  it('the resolved pipeline order is pinned — replay determinism depends on it', () => {
    // The runner executes slots in a fixed sequence; WITHIN a slot, entries run in this exact
    // order (explicit `order` values, ties by EMISSION position). A diff here means the frame
    // sequence changed — that is a behavior change and must be a deliberate plan step.
    const cw = composeControllable(EMISSION);
    expect(cw.pipelineOrder()).toEqual({
      preSteps: ['match-over-zero', 'ai-toggle', 'pilot-swap', 'carry-snapshot'],
      entityTimers: ['weapon-and-cooldowns'],
      bodyOwners: ['dormant', 'reaction', 'clash', 'cine', 'drop'],
      entityAsserts: ['charge-cancel', 'spawn-guard'],
      suppressedTicks: ['boost-recovery'],
      entityActions: ['weapon', 'melee', 'tackle'],
      worldPasses: ['body-collisions', 'carry', 'projectiles', 'death-burst', 'match', 'tutorial'],
    });
  });

  it('the platform maneuver-phase order is pinned (S4 — the seam packs plug into)', () => {
    const cw = composeControllable(EMISSION);
    expect(cw.platformPhaseOrder()).toEqual({
      maneuver: ['dodge', 'tackle'],
      equip: ['loadout'],
      act: ['strike', 'throw'],
      dash: ['dodge-dash', 'tackle-dash', 'charge-dash-carry', 'cleave-step', 'boost-inertia'],
      claim: ['tackle', 'dodge', 'boost-inertia'],
    });
  });

  it('a pack-less compose (EMISSION_ENGINE) still runs walk + basic platform worlds (S4)', () => {
    // The engine without the mobile-suit pack: basic rules + the base platformer + combat. The
    // pack's phases are simply empty; `ai` is not a known rule; melee strike still works (it is
    // combat, not pack). This is the "pack absent → basic worlds run" gate.
    const cw = composeControllable(EMISSION_ENGINE);
    expect(cw.RULES.platform).toBeDefined();
    expect(cw.RULES.ai).toBeUndefined();          // the ai brain is pack content
    expect(cw.AI_DIFFICULTY).toBeUndefined();     // so is the difficulty table
    const w = cw.createWorld({ entities: [{ id: 'h', rule: { type: 'platform', speed: 6, jumpSpeed: 8 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    const hooks = { ground: () => 0 };
    for (let i = 0; i < 90; i++) {
      cw.stepWorld(w, { forward: 1, jump: i === 10 ? 1 : 0, jumpHeld: i >= 10 && i < 18 ? 1 : 0 }, 1 / 60, hooks);
    }
    expect(w.byId.h.transform.pos[0]).toBeGreaterThan(5);   // walked forward
    expect(w.byId.h.grounded).toBe(true);                   // jumped and landed
  });
});

describe('weapon: firing, ammo, cooldown/ROF, auto-reload', () => {
  // a static shooter at the origin aiming +X (heading 0), one hittable target ahead.
  const range = (weapon, target = { pos: [10, 0, 0], radius: 0.5 }) => createWorld({
    entities: [
      { id: 'gun', rule: { type: 'static' }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 }, weapon },
      { id: 'tgt', rule: { type: 'static' }, transform: { pos: target.pos }, body: { type: 'mesh', hittable: true, radius: target.radius } },
    ],
  });

  it('a SEMI weapon fires one round per press edge (held = a single shot)', () => {
    const w = range({ fireClass: 'sight', magazine: 8, cooldown: 0.5 });
    run(w, { fire: 1 }, 30);                       // hold for half a second
    expect(w.byId.gun.weapon.ammo).toBe(7);        // exactly one shot
    expect(w.byId.gun.lastShot.mode).toBe('core');
  });

  it('a SEMI weapon fires again after a release + the cooldown', () => {
    const w = range({ fireClass: 'sight', magazine: 8, cooldown: 0.5 });
    run(w, { fire: 1 }, 1);                         // shot 1
    run(w, { fire: 0 }, 40);                        // release + let cooldown expire
    run(w, { fire: 1 }, 1);                         // shot 2
    expect(w.byId.gun.weapon.ammo).toBe(6);
  });

  it('an AUTO weapon fires at its ROF while held', () => {
    const w = range({ fireClass: 'area', magazine: 60, rof: 10 });
    run(w, { fire: 1 }, 60);                        // hold for 1 second at 10 rounds/sec
    expect(w.byId.gun.weapon.shots).toBeGreaterThanOrEqual(9);
    expect(w.byId.gun.weapon.shots).toBeLessThanOrEqual(11);
  });

  it('auto-reloads on empty and refills after the reload time', () => {
    const w = range({ fireClass: 'area', magazine: 3, rof: 30, reload: 1 });
    run(w, { fire: 1 }, 30);                        // empty the magazine (3 rounds)
    expect(w.byId.gun.weapon.ammo).toBe(0);
    expect(w.byId.gun.weapon.reloading).toBe(true);
    run(w, { fire: 0 }, 61);                        // wait out the 1s reload
    expect(w.byId.gun.weapon.reloading).toBe(false);
    expect(w.byId.gun.weapon.ammo).toBe(3);
  });

  it('does not fire while reloading', () => {
    const w = range({ fireClass: 'area', magazine: 2, rof: 40, reload: 1 });
    run(w, { fire: 1 }, 40);                        // empties, then holding does nothing (reloading)
    expect(w.byId.gun.weapon.shots).toBe(2);        // only the magazine's worth ever left the barrel
  });
});

describe('weapon: the targeting computer (core / assist / miss)', () => {
  const shooter = (weapon, targetPos) => createWorld({
    entities: [
      { id: 'gun', rule: { type: 'static' }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 }, weapon },
      { id: 'tgt', rule: { type: 'static' }, transform: { pos: targetPos }, body: { type: 'mesh', hittable: true, radius: 0.5 } },
    ],
  });
  // a target ~4° off the +X aim axis at range 100 (between core 1.5° and assist 7°)
  const OFFSET = [100, 100 * Math.tan(4 * Math.PI / 180), 0];

  it('a centered target is a CORE hit and registers on the target', () => {
    const w = shooter({ fireClass: 'sight', magazine: 8, cooldown: 0.5 }, [10, 0, 0]);
    run(w, { fire: 1 }, 1);
    expect(w.byId.gun.lastShot.mode).toBe('core');
    expect(w.byId.tgt.hits).toBe(1);
    expect(w.byId.tgt.hitFlash).toBeGreaterThanOrEqual(0);   // stamped (−1 = never hit)
  });

  it('aiming away is a MISS (target unhit)', () => {
    const w = shooter({ fireClass: 'sight', magazine: 8, cooldown: 0.5 }, [0, 10, 0]);   // target at +Y, aim +X
    run(w, { fire: 1 }, 1);
    expect(w.byId.gun.lastShot.mode).toBe('miss');
    expect(w.byId.tgt.hits).toBe(0);
  });

  it('AREA auto-aim lands a target in the outer ring; a SIGHT weapon misses the same shot', () => {
    const area = shooter({ fireClass: 'area', magazine: 60, rof: 10, coreAngle: 1.5, assistAngle: 7 }, OFFSET);
    run(area, { fire: 1 }, 1);
    expect(area.byId.gun.lastShot.mode).toBe('assist');   // machine gun's area auto-aim catches it
    expect(area.byId.tgt.hits).toBe(1);

    const sight = shooter({ fireClass: 'sight', magazine: 8, cooldown: 0.5, coreAngle: 1.5 }, OFFSET);
    run(sight, { fire: 1 }, 1);
    expect(sight.byId.gun.lastShot.mode).toBe('miss');    // precision weapon: center it or whiff
    expect(sight.byId.tgt.hits).toBe(0);
  });
});

describe('stagger: damage numbers + poise-break -> rooted lurch -> recovery', () => {
  // rof 60 = one shot per frame; dead-center foe at +X so every shot is a core hit.
  const AUTO = { fireClass: 'area', auto: true, rof: 60, magazine: 100, coreAngle: 2, assistAngle: 2, damage: 20, impact: 40 };
  const arena = (weapon, foeBody, foeRule) => createWorld({
    entities: [
      { id: 'gun', rule: { type: 'static' }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 }, weapon },
      { id: 'foe', rule: foeRule || { type: 'clock', rate: 1 }, transform: { pos: [10, 0, 0] }, body: { type: 'mesh', hittable: true, radius: 0.5, ...foeBody } },
    ],
  });

  it('damage is just numbers: hp chips by the weapon damage per landed shot', () => {
    const w = arena(AUTO, { hp: 200, poise: 1000 });   // huge poise so it never staggers here
    run(w, { fire: 1 }, 3);
    expect(w.byId.foe.hits).toBe(3);
    expect(w.byId.foe.body.hp).toBe(140);              // 200 - 3*20
    expect(w.byId.foe.staggerT).toBeNull();            // poise never broke
  });

  it('three core hits break poise and START a stagger (rooted lurch clip)', () => {
    const w = arena(AUTO, { poise: 100, staggerDur: 1 });   // 3 * impact 40 = 120 > 100
    run(w, { fire: 1 }, 2);
    expect(w.byId.foe.staggerT).toBeNull();            // 2 hits (80) not enough
    run(w, { fire: 1 }, 1);
    expect(w.byId.foe.staggerT).not.toBeNull();        // the 3rd hit broke it
    expect(w.byId.foe.locomotion).toBe('stagger');
    expect(w.byId.foe.poise).toBe(100);                // refilled to max on the break (threshold, not a drain)
  });

  it('roots the unit: the rule is suppressed, gaitPhase follows the lurch not the clock rate', () => {
    const w = arena(AUTO, { poise: 40, staggerDur: 1 }, { type: 'clock', rate: 5 });   // one hit breaks poise 40
    run(w, { fire: 1 }, 1);
    const foe = w.byId.foe;
    expect(foe.staggerT).not.toBeNull();
    run(w, { fire: 0 }, 10);                            // 10 frames into recovery
    expect(foe.locomotion).toBe('stagger');
    expect(Math.abs(foe.gaitPhase - foe.staggerT)).toBeLessThan(1e-9);   // clock rate 5 never accreted -> rule was skipped
  });

  it('a staggered armed unit cannot fire (weapon suppressed while staggering)', () => {
    // the foe is BOTH staggerable AND armed; while staggered its own weapon must not step.
    const w = arena(AUTO, { poise: 40, staggerDur: 1 });
    w.byId.foe.weapon = normalizeEntity({ weapon: { fireClass: 'area', auto: true, rof: 60, magazine: 100, coreAngle: 90, range: 999 } }, 0).weapon;
    run(w, { fire: 1 }, 1);                             // one hit staggers the foe
    expect(w.byId.foe.staggerT).not.toBeNull();
    const before = w.byId.foe.weapon.shots;
    run(w, { fire: 1 }, 5);                             // fire held: gun keeps firing, but the staggered foe must not
    expect(w.byId.foe.weapon.shots).toBe(before);      // no shots left the staggered unit's barrel
  });

  it('recovers after staggerDur and restores its ambient locomotion', () => {
    const w = arena(AUTO, { poise: 40, staggerDur: 0.5 });
    run(w, { fire: 1 }, 1);                             // break -> stagger begins
    expect(w.byId.foe.staggerT).not.toBeNull();
    run(w, { fire: 0 }, 40);                            // 40/60 s > 0.5 staggerDur, no more fire
    expect(w.byId.foe.staggerT).toBeNull();
    expect(w.byId.foe.locomotion).toBe('forward');     // back to its ambient gait
  });

  it('poise regenerates when upright so it is a break threshold, not a health bar', () => {
    const w = arena({ ...AUTO, impact: 30 }, { poise: 100, poiseRegen: 60, staggerDur: 1 });
    run(w, { fire: 1 }, 1);                             // one 30 hit -> poise ~70
    expect(w.byId.foe.poise).toBeGreaterThan(60);
    expect(w.byId.foe.poise).toBeLessThan(75);
    run(w, { fire: 0 }, 60);                            // ~1s of regen at 60/s -> back to full
    expect(w.byId.foe.poise).toBe(100);
    expect(w.byId.foe.staggerT).toBeNull();
  });

  it('MELEE always staggers on a single connect — no poise threshold', () => {
    // a melee striker with a poise-bearing foe right in front, within reach. Poise
    // 1000 (ranged fire would never break it), no strikeImpact set — a melee CONNECT
    // must stagger it anyway on the very first swing (melee is the unconditional break).
    const FLAT = { ground: () => 0 };
    const w = createWorld({
      entities: [
        { id: 'p', rule: { type: 'platform', eye: 0, speed: 6, strike: 'melee', strikeDur: 0.9, strikeReach: 3, strikeCone: 100, strikeDamage: 25 }, transform: { pos: [0, 0, 0], heading: 0 } },
        { id: 'foe', rule: { type: 'clock' }, transform: { pos: [1.5, 0, 0] }, body: { type: 'mesh', hittable: true, radius: 0.5, hp: 200, poise: 1000, staggerDur: 1 } },
      ],
    });
    stepWorld(w, {}, 1 / 60, FLAT);                     // settle grounded
    run(w, { fire: 1 }, 1, 1 / 60, FLAT);               // one swing press
    run(w, { fire: 0 }, 40, 1 / 60, FLAT);              // let the contact window (swingT .28–.62) pass
    expect(w.byId.foe.staggerT).not.toBeNull();         // staggered despite poise 1000 — melee is unconditional
    expect(w.byId.foe.hits).toBe(1);                    // exactly one connect (once-per-target-per-swing)
    expect(w.byId.foe.body.hp).toBe(175);               // strikeDamage still chips hp (200 - 25)
  });
});

describe('weapon: projectiles (fireClass lob — grenade / bazooka; R14)', () => {
  // a static launcher at the origin aiming +X (heading 0, pitch 0), tunable target ahead.
  const launcher = (weapon, target) => createWorld({
    entities: [
      { id: 'gun', rule: { type: 'static' }, transform: { pos: [0, 0, 1], heading: 0, pitch: 0 }, weapon },
      ...(target ? [{ id: 'tgt', rule: { type: 'static' }, transform: { pos: target.pos }, body: { type: 'mesh', hittable: true, radius: target.radius ?? 1, hp: 200, poise: target.poise ?? 100, staggerDur: 1 } }] : []),
    ],
  });

  it('a lob shot SPAWNS a travelling round instead of a hitscan (no instant hit)', () => {
    const w = launcher({ fireClass: 'lob', magazine: 4, cooldown: 0.5, projectileSpeed: 40, projectileGravity: 20 }, { pos: [30, 0, 1] });
    run(w, { fire: 1 }, 1);
    expect(w.byId.gun.weapon.ammo).toBe(3);              // one round left the tube
    expect(w.projectiles.length).toBe(1);                // ...and is in flight, not resolved
    expect(w.byId.gun.lastShot.mode).toBe('launch');
    expect(w.byId.tgt.hits).toBe(0);                     // nothing hit yet — it has to fly there
  });

  it('a lob weapon can suppress its projectile smoke trail (grenade tuning)', () => {
    const w = launcher({ fireClass: 'lob', magazine: 4, smokeTrail: false, projectileSpeed: 40, projectileGravity: 20 }, null);
    run(w, { fire: 1 }, 1);
    expect(w.projectiles.length).toBe(1);
    expect(w.projectiles[0].smokeTrail).toBe(false);
  });

  it('a fast/flat round (bazooka) reaches a downrange target and staggers it on the DIRECT hit', () => {
    const w = launcher({ fireClass: 'lob', magazine: 4, cooldown: 0.5, projectileSpeed: 60, projectileGravity: 2, splashRadius: 3, projRadius: 0.6, damage: 80 }, { pos: [24, 0, 1], radius: 1 });
    run(w, { fire: 1 }, 1);
    run(w, { fire: 0 }, 40);                             // ~0.67s of flight — 60 u/s covers 24u well within
    expect(w.byId.tgt.hits).toBeGreaterThanOrEqual(1);
    expect(w.byId.tgt.staggerT).not.toBeNull();          // direct hit = unconditional poise-break
    expect(w.byId.tgt.body.hp).toBe(120);                // 200 - 80 damage
    expect(w.projectiles.length).toBe(0);                // consumed on burst
    expect(w.bursts.length).toBe(1);                     // and a burst fx record was emitted
  });

  it('R19: a flat bazooka shell CONTACTS the tall EGG at body height (not just the ground)', () => {
    // egg target: feet at z=0, egg spans 0..12 (centre z=6). A flat shell fired at body height must
    // burst on the BODY column — the regression was it sailing over the old feet-point ball (latR).
    const w = createWorld({
      entities: [
        { id: 'gun', rule: { type: 'static' }, transform: { pos: [0, 0, 6], heading: 0, pitch: 0 }, weapon: { fireClass: 'lob', magazine: 4, projectileSpeed: 60, projectileGravity: 0, splashRadius: 3, projRadius: 0.6, damage: 80 } },
        { id: 'tgt', rule: { type: 'static' }, transform: { pos: [24, 0, 0] }, body: { type: 'figure-rig', hittable: true, egg: { a: 1, c: 6 }, hp: 200, poise: 100, staggerDur: 1 } },
      ],
    });
    run(w, { fire: 1 }, 1);
    run(w, { fire: 0 }, 40);
    expect(w.byId.tgt.hits).toBeGreaterThanOrEqual(1);   // the shell reached the body column
    expect(w.byId.tgt.staggerT).not.toBeNull();          // and burst → stagger
    expect(w.byId.tgt.body.hp).toBe(120);                // 200 − 80 damage
  });

  it('the burst SPLASHES: a bystander in splashRadius staggers too', () => {
    // direct target dead-center; a second hittable just off to the side within the splash.
    const w = createWorld({
      entities: [
        { id: 'gun', rule: { type: 'static' }, transform: { pos: [0, 0, 1], heading: 0, pitch: 0 }, weapon: { fireClass: 'lob', magazine: 4, projectileSpeed: 60, projectileGravity: 2, splashRadius: 4, projRadius: 0.6, damage: 50 } },
        { id: 'direct', rule: { type: 'static' }, transform: { pos: [24, 0, 1] }, body: { type: 'mesh', hittable: true, radius: 1, hp: 200, poise: 100, staggerDur: 1 } },
        { id: 'bystander', rule: { type: 'static' }, transform: { pos: [24, 3, 1] }, body: { type: 'mesh', hittable: true, radius: 1, hp: 200, poise: 100, staggerDur: 1 } },
      ],
    });
    run(w, { fire: 1 }, 1);
    run(w, { fire: 0 }, 40);
    expect(w.byId.direct.staggerT).not.toBeNull();
    expect(w.byId.bystander.staggerT).not.toBeNull();     // caught by the splash (3u off, within 4u)
    expect(w.byId.bystander.body.hp).toBe(150);           // splash also chips hp
  });

  it('a high-arc lob (grenade) rises then falls — the round gains height before descending', () => {
    const w = launcher({ fireClass: 'lob', magazine: 4, projectileSpeed: 30, projectileGravity: 40, lobAngle: 45, fuse: 5 }, null);
    run(w, { fire: 1 }, 1);
    const z0 = w.projectiles[0].pos[2];
    run(w, { fire: 0 }, 6);                               // ~0.1s in
    expect(w.projectiles[0].pos[2]).toBeGreaterThan(z0); // climbing (lobAngle sent it up)
  });

  it('ARC-BY-AIM: with lobAngle 0 the throw follows the LOOK PITCH — aim up throws farther, aim down drops short', () => {
    // the grenade tuning (operator): launch angle = aim pitch, no fixed lob offset. Fire the same
    // round at a spread of pitches and read where it bursts on the ground — monotonic out to 45°,
    // and a downward aim drops it in close. This is the "arc adjusts the range" behavior.
    const GREN = { fireClass: 'lob', magazine: 4, projectileSpeed: 264, projectileGravity: 96, lobAngle: 0, splashRadius: 4, projRadius: 0.5, fuse: 5, muzzleOffset: { f: 5, r: 0, u: 14 } };
    const throwAt = (deg) => {
      const w = createWorld({ entities: [
        { id: 'gun', rule: { type: 'static' }, transform: { pos: [0, 0, 0], heading: 0, pitch: deg * Math.PI / 180 }, weapon: { ...GREN } },
      ] });
      run(w, { fire: 1 }, 1);
      // step until the round resolves and grab the burst THAT frame (the bursts fx list is trimmed to
      // the last ~1s, so a short throw's early burst would be gone by the time a long one lands).
      for (let i = 0; i < 320; i++) {
        run(w, { fire: 0 }, 1);
        if (w.projectiles.length === 0) return w.bursts.length ? w.bursts[w.bursts.length - 1].pos[0] : null;
      }
      return null;
    };
    const down = throwAt(-20), level = throwAt(0), up = throwAt(30), max = throwAt(45);
    expect(down).toBeGreaterThan(0);
    expect(level).toBeGreaterThan(down);                   // aiming down drops it shorter
    expect(up).toBeGreaterThan(level);                     // aiming up throws it farther
    expect(max).toBeGreaterThan(up);                       // farthest near the 45° arc
    expect(level).toBeGreaterThan(100);                    // a level throw is a real toss (~145u), not the old ~50u
  });

  it('a round that hits nothing BURSTS on the ground (z<=0)', () => {
    const w = launcher({ fireClass: 'lob', magazine: 4, projectileSpeed: 20, projectileGravity: 40, lobAngle: 30, fuse: 10 }, null);
    run(w, { fire: 1 }, 1);
    run(w, { fire: 0 }, 45);                              // ~0.75s: the arc peaks (~0.25s) and lands (~0.6s); burst still within its ~1s fx window
    expect(w.projectiles.length).toBe(0);                // fell and burst
    expect(w.bursts.length).toBe(1);
    expect(w.bursts[0].pos[2]).toBe(0);                  // burst pinned to the floor
  });

  it('the round does not burst on the OWNER at the muzzle (armTime clears it)', () => {
    // owner is the launcher itself; make it hittable so a naive contact test would self-detonate.
    const w = createWorld({
      entities: [
        { id: 'gun', rule: { type: 'static' }, transform: { pos: [0, 0, 1], heading: 0, pitch: 0 }, weapon: { fireClass: 'lob', magazine: 4, projectileSpeed: 40, projectileGravity: 2, projRadius: 0.6, armTime: 0.06 }, body: { type: 'mesh', hittable: true, radius: 2, hp: 200, poise: 100, staggerDur: 1 } },
      ],
    });
    run(w, { fire: 1 }, 1);
    expect(w.byId.gun.staggerT).toBeNull();               // did not blow up in its own hand
    expect(w.projectiles.length).toBe(1);                 // still flying
  });
});

describe('burst rifle: a 3-bolt volley under the poise threshold takes MORE than one volley to stun', () => {
  // the taisa beam-rifle tuning (impact 30, burst 3): 3 × 30 = 90 poise chip < the 100 break, so ONE
  // clean volley can NOT stagger; the SECOND crosses it. A static gun on a dead-ahead poise-100 target.
  const RIFLE = { fireClass: 'sight', auto: false, burst: 3, burstRof: 9, cooldown: 1.2, magazine: 12, coreAngle: 90, range: 999, damage: 12, impact: 30 };
  const mk = () => createWorld({
    entities: [
      { id: 'gun', rule: { type: 'static' }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 }, weapon: RIFLE },
      { id: 'foe', rule: { type: 'static' }, transform: { pos: [10, 0, 0] }, body: { type: 'mesh', hittable: true, radius: 2, hp: 9999, poise: 100, poiseRegen: 22, staggerDur: 1.35 } },
    ],
  });

  it('one full three-bolt volley lands three hits but does NOT break poise', () => {
    const w = mk();
    run(w, { fire: 1 }, 30, 1 / 60);                        // one trigger pull → 3 bolts, then held (no re-pull)
    expect(w.byId.foe.hits).toBe(3);                        // the whole burst committed and landed
    expect(w.byId.foe.staggerT).toBeNull();                // 90 < 100 → still standing
    expect(w.byId.gun.weapon.shots).toBe(3);               // exactly one volley fired (holding fire doesn't re-pull)
  });

  it('a SECOND volley (fresh pull after the cooldown) breaks poise and staggers', () => {
    const w = mk();
    run(w, { fire: 1 }, 30, 1 / 60);                        // volley 1 — no stagger
    expect(w.byId.foe.staggerT).toBeNull();
    run(w, { fire: 0 }, 80, 1 / 60);                        // release + let the 1.2s cooldown expire (poise regens some)
    run(w, { fire: 1 }, 20, 1 / 60);                        // volley 2 — fresh trigger edge
    expect(w.byId.foe.staggerT).not.toBeNull();            // the second volley crosses the threshold
  });
});

describe('no-fire-while-boosting (operator: bazooka + beam rifle hold fire mid-thrust; MG streams)', () => {
  const FLAT = { ground: () => 0 };
  // the SHOOTER runs the platform rule so holding boost arms ITS OWN e.boosting; speed/boostSpeed 0
  // keeps it planted, heading +X onto a big static target dead ahead (huge hp/poise so it never dies).
  const shooterWith = (weapon) => createWorld({
    entities: [
      { id: 'gun', rule: { type: 'platform', eye: 0, speed: 0, boostSpeed: 0 }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 }, weapon },
      { id: 'foe', rule: { type: 'static' }, transform: { pos: [10, 0, 0] }, body: { type: 'mesh', hittable: true, radius: 2, hp: 9999, poise: 9999 } },
    ],
  });
  const SIGHT = { fireClass: 'sight', auto: false, cooldown: 0.2, coreAngle: 90, range: 999, magazine: 30, damage: 10, impact: 10 };
  const LOB = { fireClass: 'lob', cooldown: 0.2, magazine: 9, range: 999, damage: 10, projectileSpeed: 60, projectileGravity: 0, eye: 1, splashRadius: 3 };
  const MG = { fireClass: 'area', auto: true, rof: 60, coreAngle: 90, range: 999, magazine: 100, damage: 4, impact: 12 };

  it('a beam rifle (semi sight) holds fire while boosting, then fires once thrust ends', () => {
    const w = shooterWith(SIGHT);
    run(w, { boost: 1 }, 1, 1 / 60, FLAT);                  // arm e.boosting
    expect(w.byId.gun.boosting).toBe(true);
    run(w, { boost: 1, fire: 1 }, 30, 1 / 60, FLAT);        // hold fire through the thrust
    expect(w.byId.gun.weapon.shots).toBe(0);               // no bolt left the barrel
    run(w, {}, 2, 1 / 60, FLAT);                            // release (end thrust + reset the trigger edge)
    run(w, { fire: 1 }, 3, 1 / 60, FLAT);                  // fresh trigger pull, grounded
    expect(w.byId.gun.weapon.shots).toBeGreaterThan(0);
  });

  it('a bazooka (lob) launches nothing while boosting, then launches once thrust ends', () => {
    const w = shooterWith(LOB);
    run(w, { boost: 1 }, 1, 1 / 60, FLAT);
    run(w, { boost: 1, fire: 1 }, 20, 1 / 60, FLAT);
    expect(w.projectiles.length).toBe(0);                  // no shell spawned mid-thrust
    run(w, {}, 2, 1 / 60, FLAT);                            // release
    run(w, { fire: 1 }, 3, 1 / 60, FLAT);                  // grounded pull → launches
    expect(w.projectiles.length).toBeGreaterThan(0);
  });

  it('an MG (auto area) KEEPS streaming while boosting (suppression fire on the move is fine)', () => {
    const w = shooterWith(MG);
    run(w, { boost: 1 }, 1, 1 / 60, FLAT);
    run(w, { boost: 1, fire: 1 }, 10, 1 / 60, FLAT);
    expect(w.byId.gun.weapon.shots).toBeGreaterThan(0);
  });

  it('boostFire:true overrides the gate (a sight weapon flagged fires while boosting)', () => {
    const w = shooterWith({ ...SIGHT, boostFire: true });
    run(w, { boost: 1 }, 1, 1 / 60, FLAT);
    run(w, { boost: 1, fire: 1 }, 10, 1 / 60, FLAT);
    expect(w.byId.gun.weapon.shots).toBeGreaterThan(0);
  });
});

describe('boost armor (R23 — boosting halves incoming stun; a full-stun hit no longer breaks in one)', () => {
  const FLAT = { ground: () => 0 };
  // the TARGET runs the platform rule so `e.boosting` goes live when we hold boost; boostSpeed 0
  // keeps it planted in the gun's lane. A settle frame under {boost:1} arms e.boosting BEFORE the
  // shot (the adjudicators read the target's flag — a real boosting suit is already thrusting when hit).
  const BEAM = { fireClass: 'area', auto: true, rof: 60, magazine: 100, coreAngle: 2, assistAngle: 2, damage: 20, impact: 100 };
  const gunVs = (body, weapon = BEAM) => createWorld({
    entities: [
      { id: 'gun', rule: { type: 'static' }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 }, weapon },
      { id: 'foe', rule: { type: 'platform', eye: 0, speed: 0, boostSpeed: 0 }, transform: { pos: [10, 0, 0], heading: Math.PI },
        body: { type: 'mesh', hittable: true, radius: 0.5, staggerDur: 1, poiseRegen: 0, ...body } },
    ],
  });

  it('a boosting suit with boost armor SURVIVES a 100%-stun beam hit that one-shots it unarmored', () => {
    const w = gunVs({ poise: 100, boostArmor: 1 });
    run(w, { boost: 1 }, 1, 1 / 60, FLAT);                 // settle: e.boosting → true
    expect(w.byId.foe.boosting).toBe(true);
    run(w, { boost: 1, fire: 1 }, 1, 1 / 60, FLAT);        // one impact-100 hit while boosting
    expect(w.byId.foe.staggerT).toBeNull();                // halved to 50 → no break
    expect(w.byId.foe.poise).toBeCloseTo(50, 5);
    run(w, { boost: 1, fire: 1 }, 1, 1 / 60, FLAT);        // a SECOND hit → another 50 → break
    expect(w.byId.foe.staggerT).not.toBeNull();
  });

  it('the SAME suit NOT boosting eats the full stun and staggers in one (armor inert off-boost)', () => {
    const w = gunVs({ poise: 100, boostArmor: 1 });
    run(w, {}, 1, 1 / 60, FLAT);                            // grounded, not boosting
    expect(w.byId.foe.boosting).toBe(false);
    run(w, { fire: 1 }, 1, 1 / 60, FLAT);                   // one 100 hit, no armor active
    expect(w.byId.foe.staggerT).not.toBeNull();
  });

  it('no boostArmor: boosting does not help (a full-stun hit still one-shots)', () => {
    const w = gunVs({ poise: 100 });                        // no boostArmor
    run(w, { boost: 1 }, 1, 1 / 60, FLAT);
    run(w, { boost: 1, fire: 1 }, 1, 1 / 60, FLAT);
    expect(w.byId.foe.staggerT).not.toBeNull();
  });

  it('lv2 quarters the stun', () => {
    const w = gunVs({ poise: 100, boostArmor: 2 });
    run(w, { boost: 1 }, 1, 1 / 60, FLAT);
    run(w, { boost: 1, fire: 1 }, 1, 1 / 60, FLAT);
    expect(w.byId.foe.poise).toBeCloseTo(75, 5);            // 100 × 0.25 = 25 chip
    expect(w.byId.foe.staggerT).toBeNull();
  });

  it('a "build-up" weapon is halved too (MG impact 12 → 6 while boosting)', () => {
    const MG = { fireClass: 'area', auto: true, rof: 60, magazine: 100, coreAngle: 2, assistAngle: 2, damage: 4, impact: 12 };
    const w = gunVs({ poise: 100, boostArmor: 1 }, MG);
    run(w, { boost: 1 }, 1, 1 / 60, FLAT);
    run(w, { boost: 1, fire: 1 }, 1, 1 / 60, FLAT);
    expect(w.byId.foe.poise).toBeCloseTo(94, 5);            // 12 × 0.5 = 6 chip
  });

  // the BAZOOKA path: an unconditional splash stagger (no impact field) — boost armor turns the
  // 100%-stun (poiseMax) into a scaled chip.
  const boomVs = (body, damage = 20) => createWorld({
    entities: [
      { id: 'gun', rule: { type: 'static' }, transform: { pos: [0, 0, 0.6], heading: 0, pitch: 0 },
        weapon: { fireClass: 'lob', magazine: 4, cooldown: 0.5, projectileSpeed: 60, projectileGravity: 0, splashRadius: 3, projRadius: 0.6, damage } },
      { id: 'foe', rule: { type: 'platform', eye: 0, speed: 0, boostSpeed: 0 }, transform: { pos: [24, 0, 0], heading: Math.PI },
        body: { type: 'mesh', hittable: true, radius: 1.4, poiseRegen: 0, staggerDur: 1, ...body } },
    ],
  });

  it('an unconditional BAZOOKA splash becomes a survivable chip against a boosting armored suit', () => {
    const w = boomVs({ hp: 900, poise: 100, boostArmor: 1 });
    run(w, { boost: 1 }, 1, 1 / 60, FLAT);                  // boosting
    run(w, { boost: 1, fire: 1 }, 1, 1 / 60, FLAT);         // launch a shell (boost stays held)
    run(w, { boost: 1 }, 40, 1 / 60, FLAT);                 // flight → burst while still boosting
    expect(w.byId.foe.hits).toBeGreaterThanOrEqual(1);      // the shell reached + burst
    expect(w.byId.foe.staggerT).toBeNull();                 // 100 × 0.5 = 50 chip → no floor in one
    expect(w.byId.foe.poise).toBeCloseTo(50, 5);
  });

  it('the SAME bazooka floors the suit unconditionally when it is NOT boosting', () => {
    const w = boomVs({ hp: 900, poise: 100, boostArmor: 1 });
    run(w, {}, 1, 1 / 60, FLAT);
    run(w, { fire: 1 }, 1, 1 / 60, FLAT);
    run(w, {}, 40, 1 / 60, FLAT);
    expect(w.byId.foe.staggerT).not.toBeNull();             // unconditional splash break (armor off-boost)
  });

  it('a KILLING bazooka burst still floors a boosting armored suit (kill override wins)', () => {
    const w = boomVs({ hp: 40, poise: 100, boostArmor: 1 }, 90);   // 40 hp vs 90 damage → lethal
    run(w, { boost: 1 }, 1, 1 / 60, FLAT);
    run(w, { boost: 1, fire: 1 }, 1, 1 / 60, FLAT);
    run(w, { boost: 1 }, 40, 1 / 60, FLAT);
    expect(w.byId.foe.body.hp).toBe(0);
    expect(w.byId.foe.staggerT).not.toBeNull();
    expect(w.byId.foe.downed).toBe(true);                   // a kill floors regardless of boost armor
  });
});

describe('rule: follow — vertical aim (camera pitches with the target)', () => {
  const mk = (pitch, extra = {}) => createWorld({
    entities: [{ id: 'u', rule: { type: 'static' }, transform: { pos: [0, 0, 0], heading: 0, pitch } }],
    camera: { rule: 'follow', target: 'u', dist: 6, height: 3, lead: 4, lookH: 1.5, ...extra },
  });

  it('at pitch 0 the framing is the classic flat chase (unchanged)', () => {
    const w = mk(0); run(w, {}, 120);
    const c = w.camera;
    expect(c.transform.pos[0]).toBeCloseTo(-6, 1);   // behind along -X
    expect(c.transform.pos[2]).toBeCloseTo(3, 1);    // height
    expect(c.lookAt[0]).toBeCloseTo(4, 1);           // lead ahead
    expect(c.lookAt[2]).toBeCloseTo(1.5, 1);         // lookH
  });

  it('looking UP raises the look point and drops the camera', () => {
    const up = mk(0.5); run(up, {}, 120);
    const flat = mk(0); run(flat, {}, 120);
    expect(up.camera.lookAt[2]).toBeGreaterThan(flat.camera.lookAt[2] + 0.5);
    expect(up.camera.transform.pos[2]).toBeLessThan(flat.camera.transform.pos[2]);
  });

  it('looking DOWN drops the look point and raises the camera', () => {
    const down = mk(-0.5); run(down, {}, 120);
    const flat = mk(0); run(flat, {}, 120);
    expect(down.camera.lookAt[2]).toBeLessThan(flat.camera.lookAt[2] - 0.5);
    expect(down.camera.transform.pos[2]).toBeGreaterThan(flat.camera.transform.pos[2]);
  });

  it('pitchFollow:0 opts out — flat chase regardless of look pitch', () => {
    const w = mk(0.5, { pitchFollow: 0 }); run(w, {}, 120);
    expect(w.camera.lookAt[2]).toBeCloseTo(1.5, 1);
    expect(w.camera.transform.pos[2]).toBeCloseTo(3, 1);
  });
});

describe('platform: weapon cycling (rule.loadout — R cycles, digits direct-select)', () => {
  const FLAT = { ground: () => 0 };
  const LOADOUT = [
    { figure: 'rifle', name: 'LONG RIFLE', weapon: { fireClass: 'sight', magazine: 8, cooldown: 0.5 } },
    { figure: 'saber', name: 'BEAM SABER', strike: 'melee', strikeDur: 0.9 },
  ];
  const mk = () => createWorld({
    entities: [
      {
        id: 'u',
        rule: { type: 'platform', eye: 0, loadout: LOADOUT },
        transform: { pos: [0, 0, 0], heading: 0, pitch: 0 },
        body: { type: 'figure-rig', figure: 'rifle' },
      },
      { id: 'tgt', rule: { type: 'static' }, transform: { pos: [10, 0, 0] }, body: { type: 'mesh', hittable: true, radius: 0.5 } },
    ],
  });

  it('initializes on slot 0: ranged weapon live, body on the first config figure', () => {
    const w = mk();
    const u = w.byId.u;
    expect(u.loadoutIdx).toBe(0);
    expect(u.weapon).not.toBeNull();
    expect(u.weapon.fireClass).toBe('sight');
    expect(u.body.figure).toBe('rifle');
    expect(u.loadoutWeapons[1]).toBeNull();   // the melee slot carries no ranged state
  });

  it('R (cycle edge) swaps to the melee slot: body figure changes, fire routes to the swing', () => {
    const w = mk();
    run(w, {}, 3, 1 / 60, FLAT);                  // settle grounded
    stepWorld(w, { cycle: 1 }, 1 / 60, FLAT);
    const u = w.byId.u;
    expect(u.loadoutIdx).toBe(1);
    expect(u.body.figure).toBe('saber');
    expect(u.weapon).toBeNull();
    expect(u.switched).toBe(true);
    run(w, {}, 65, 1 / 60, FLAT);                 // past the ~1s switch ready-time (2026-07-28)
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);      // click acts the active weapon → melee
    expect(u.swingT).not.toBeNull();
    expect(u.locomotion).toBe('swing_neutral');
    expect(w.byId.tgt.hits).toBe(0);              // no round left any barrel
  });

  it('cycling wraps, and digits direct-select a slot', () => {
    const w = mk();
    run(w, {}, 3, 1 / 60, FLAT);
    stepWorld(w, { cycle: 1 }, 1 / 60, FLAT);     // → 1
    stepWorld(w, { cycle: 1 }, 1 / 60, FLAT);     // wraps → 0
    expect(w.byId.u.loadoutIdx).toBe(0);
    stepWorld(w, { slot: 2 }, 1 / 60, FLAT);      // direct-select slot 2 (index 1)
    expect(w.byId.u.loadoutIdx).toBe(1);
    stepWorld(w, { slot: 1 }, 1 / 60, FLAT);
    expect(w.byId.u.loadoutIdx).toBe(0);
    stepWorld(w, { slot: 5 }, 1 / 60, FLAT);      // out-of-range digit is inert
    expect(w.byId.u.loadoutIdx).toBe(0);
  });

  it('ranged ammo state persists across a switch away and back', () => {
    const w = mk();
    run(w, {}, 3, 1 / 60, FLAT);
    run(w, { fire: 1 }, 1, 1 / 60, FLAT);         // one semi shot
    expect(w.byId.u.weapon.ammo).toBe(7);
    stepWorld(w, { cycle: 1 }, 1 / 60, FLAT);     // → saber
    stepWorld(w, { cycle: 1 }, 1 / 60, FLAT);     // → rifle again
    expect(w.byId.u.weapon.ammo).toBe(7);         // same magazine, not a fresh one
  });

  it('a switch is blocked mid-swing (the swing owns the body), allowed after it ends', () => {
    const w = mk();
    run(w, {}, 3, 1 / 60, FLAT);
    stepWorld(w, { cycle: 1 }, 1 / 60, FLAT);     // → saber
    run(w, {}, 65, 1 / 60, FLAT);                 // past the switch ready-time
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);      // start the one-shot swing
    expect(w.byId.u.swingT).not.toBeNull();
    stepWorld(w, { cycle: 1 }, 1 / 60, FLAT);     // mid-swing: refused
    expect(w.byId.u.loadoutIdx).toBe(1);
    run(w, {}, 60, 1 / 60, FLAT);                 // ride out the 0.9s swing
    expect(w.byId.u.swingT).toBeNull();
    stepWorld(w, { cycle: 1 }, 1 / 60, FLAT);     // now it takes
    expect(w.byId.u.loadoutIdx).toBe(0);
  });

  it('with the ranged slot active the click fires (no swing), and rules without loadout are untouched', () => {
    const w = mk();
    run(w, {}, 3, 1 / 60, FLAT);
    run(w, { fire: 1 }, 1, 1 / 60, FLAT);
    expect(w.byId.u.weapon.shots).toBe(1);
    expect(w.byId.u.swingT == null).toBe(true);   // ranged slot: no melee one-shot
    // no-loadout world: cycle/slot inputs are inert
    const plain = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0 }, transform: { pos: [0, 0, 0] } }] });
    run(plain, { cycle: 1, slot: 2 }, 5, 1 / 60, FLAT);
    expect(plain.byId.p.loadoutIdx).toBeUndefined();
    expect(plain.byId.p.switched).toBeUndefined();
  });
});

describe('switch ready-time (2026-07-28 — a switched weapon holds fire ~1s; ranged AND melee)', () => {
  const FLAT = { ground: () => 0 };
  const LOADOUT = [
    { figure: 'rifle', name: 'RIFLE', weapon: { fireClass: 'sight', magazine: 8, cooldown: 0.3 } },
    { figure: 'mg', name: 'MG', weapon: { fireClass: 'area', auto: true, rof: 12, magazine: 40 } },
    { figure: 'saber', name: 'SABER', strike: 'melee', strikeDur: 0.5, strikeReach: 8, strikeDamage: 10 },
  ];
  const mk = (over = {}) => createWorld({
    entities: [
      { id: 'u', rule: { type: 'platform', eye: 0, loadout: LOADOUT, ...over }, transform: { pos: [0, 0, 0], heading: 0 },
        body: { type: 'figure-rig', figure: 'rifle' } },
      { id: 'tg', rule: { type: 'static' }, transform: { pos: [6, 0, 0] },
        body: { type: 'figure-rig', hittable: true, radius: 1, hp: 500, poise: 50, staggerDur: 1 } },
    ],
  });

  it('the INITIAL weapon is act-ready (no switch happened — you can open fire at spawn)', () => {
    const w = mk();
    run(w, {}, 3, 1 / 60, FLAT);
    expect(w.byId.u.readyT || 0).toBe(0);
    run(w, { fire: 1 }, 1, 1 / 60, FLAT);
    expect(w.byId.u.weapon.shots).toBe(1);        // fires immediately — the exploit is SWITCHING, not spawning
  });

  it('a ranged→ranged switch eats the trigger for ~1s, then fires (the anti-flick rule)', () => {
    const w = mk();
    run(w, {}, 3, 1 / 60, FLAT);
    stepWorld(w, { slot: 2 }, 1 / 60, FLAT);       // → MG
    expect(w.byId.u.readyT).toBeCloseTo(1, 2);
    run(w, { fire: 1 }, 30, 1 / 60, FLAT);         // hold fire for 0.5s — still inside the ready-time
    expect(w.byId.u.weapon.shots).toBe(0);         // eaten: no insta-fire on the fresh gun
    run(w, { fire: 1 }, 45, 1 / 60, FLAT);         // past 1s total
    expect(w.byId.u.weapon.shots).toBeGreaterThan(0);
  });

  it('a switch to the MELEE slot also holds the swing for ~1s', () => {
    const w = mk();
    run(w, {}, 3, 1 / 60, FLAT);
    stepWorld(w, { slot: 3 }, 1 / 60, FLAT);       // → saber
    expect(w.byId.u.readyT).toBeCloseTo(1, 2);
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);       // click during the ready-time
    expect(w.byId.u.swingT == null).toBe(true);    // eaten — no swing yet
    run(w, {}, 65, 1 / 60, FLAT);                  // wait it out
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);
    expect(w.byId.u.swingT).not.toBeNull();        // now the saber swings
  });

  it('the flick-fire EXPLOIT is closed: switch away and back re-arms the full second each time', () => {
    const w = mk();
    run(w, {}, 3, 1 / 60, FLAT);
    run(w, { fire: 1 }, 1, 1 / 60, FLAT);          // rifle shot 1 (spawn-ready)
    expect(w.byId.u.weapon.shots).toBe(1);
    stepWorld(w, { slot: 2 }, 1 / 60, FLAT);       // flick → MG
    stepWorld(w, { slot: 1 }, 1 / 60, FLAT);       // flick back → rifle (its own cooldown is long cold)
    expect(w.byId.u.readyT).toBeCloseTo(1, 2);     // re-armed by the switch, not bypassed
    run(w, { fire: 1 }, 20, 1 / 60, FLAT);         // mash the trigger — 0.33s
    expect(w.byId.u.weapon.shots).toBe(1);         // still 1: the flick bought nothing
  });

  it('the ready-time does NOT block a reload, and overlaps it (only switching arms it)', () => {
    const w = mk();
    run(w, {}, 3, 1 / 60, FLAT);
    w.byId.u.weapon.ammo = 0;                       // empty the rifle → the autoloader arms next tick
    run(w, {}, 2, 1 / 60, FLAT);
    expect(w.byId.u.weapon.reloading).toBe(true);
    stepWorld(w, { slot: 2 }, 1 / 60, FLAT);       // → MG
    stepWorld(w, { slot: 1 }, 1 / 60, FLAT);       // → rifle (still auto-reloading)
    expect(w.byId.u.weapon.reloading).toBe(true);
    expect(w.byId.u.readyT).toBeCloseTo(1, 2);     // the switch armed the ready-time…
    run(w, {}, 60, 1 / 60, FLAT);                  // …which ticks down DURING the reload (overlap, no stacking)
    expect(w.byId.u.readyT || 0).toBe(0);
  });

  it('switchReady is tunable (0 restores the old instant-switch feel)', () => {
    const w = mk({ switchReady: 0 });
    run(w, {}, 3, 1 / 60, FLAT);
    stepWorld(w, { slot: 2 }, 1 / 60, FLAT);       // → MG
    expect(w.byId.u.readyT || 0).toBe(0);
    run(w, { fire: 1 }, 2, 1 / 60, FLAT);
    expect(w.byId.u.weapon.shots).toBeGreaterThan(0);   // fires at once — no ready-time
  });

  it('a respawn clears the ready-time (a fresh life opens ready)', () => {
    const w = mk();
    run(w, {}, 3, 1 / 60, FLAT);
    stepWorld(w, { slot: 2 }, 1 / 60, FLAT);
    expect(w.byId.u.readyT).toBeGreaterThan(0.5);
    w.byId.u.readyT = 0;   // the match-layer respawn path zeroes it (asserted in the respawn clear)
    run(w, { fire: 1 }, 2, 1 / 60, FLAT);
    expect(w.byId.u.weapon.shots).toBeGreaterThan(0);
  });
});

describe('suit switcher: pilotable entities + input.swap (T transfers the pilot)', () => {
  const FLAT = { ground: () => 0 };
  const mk = (pilot) => createWorld({
    ...(pilot ? { pilot } : {}),
    entities: [
      {
        id: 'g',
        pilotable: true,
        ambient: { type: 'clock', rate: 0.5 },
        rule: { type: 'platform', eye: 0, speed: 6, loadout: [{ figure: 'g_a', weapon: { fireClass: 'sight', magazine: 8 } }, { figure: 'g_b', strike: 'melee' }] },
        transform: { pos: [0, 0, 0], heading: 0 },
        body: { type: 'figure-rig', figure: 'g_a' },
      },
      {
        id: 'z',
        pilotable: true,
        ambient: { type: 'clock', rate: 0.5 },
        rule: { type: 'platform', eye: 0, speed: 4 },
        transform: { pos: [10, 0, 0], heading: 0 },
        body: { type: 'figure-rig', figure: 'z_a' },
      },
      { id: 'rock', rule: { type: 'static' }, transform: { pos: [50, 0, 0] } },
    ],
    camera: { rule: 'follow', target: 'g' },
  });

  it('seats the initial pilot (first pilotable, or spec.pilot by name) and the rest run ambient', () => {
    const w = mk();
    expect(w.pilotId).toBe('g');
    expect(w.byId.g.rule.type).toBe('platform');
    expect(w.byId.z.rule.type).toBe('clock');
    const named = mk('z');
    expect(named.pilotId).toBe('z');
    expect(named.byId.z.rule.type).toBe('platform');
    expect(named.byId.g.rule.type).toBe('clock');
  });

  it('the unpiloted suit marches in place (clock: gait advances, no translation)', () => {
    const w = mk();
    run(w, { forward: 1 }, 30, 1 / 60, FLAT);
    expect(w.byId.g.transform.pos[0]).toBeGreaterThan(1);   // piloted suit drives
    expect(w.byId.z.transform.pos[0]).toBe(10);             // ambient suit holds position
    expect(w.byId.z.gaitPhase).toBeGreaterThan(0);          // but plays its gait
  });

  it('T swaps the pilot: rules exchange, WASD drives the other suit, the camera retargets', () => {
    const w = mk();
    run(w, {}, 3, 1 / 60, FLAT);
    stepWorld(w, { swap: 1 }, 1 / 60, FLAT);
    expect(w.pilotId).toBe('z');
    expect(w.byId.z.rule.type).toBe('platform');
    expect(w.byId.g.rule.type).toBe('clock');
    expect(w.camera.rule.target).toBe('z');
    const z0 = w.byId.z.transform.pos[0], g0 = w.byId.g.transform.pos[0];
    run(w, { forward: 1 }, 30, 1 / 60, FLAT);
    expect(w.byId.z.transform.pos[0]).toBeGreaterThan(z0 + 1);   // now the z drives
    expect(w.byId.g.transform.pos[0]).toBeCloseTo(g0, 5);        // the g stands its ground
    stepWorld(w, { swap: 1 }, 1 / 60, FLAT);                     // wraps back around
    expect(w.pilotId).toBe('g');
    expect(w.camera.rule.target).toBe('g');
  });

  it('the vacated pilot keeps its loadout state; its own weapon still fires after a return', () => {
    const w = mk();
    run(w, {}, 3, 1 / 60, FLAT);
    run(w, { fire: 1 }, 1, 1 / 60, FLAT);                 // one shot from the g
    expect(w.byId.g.weapon.ammo).toBe(7);
    stepWorld(w, { swap: 1 }, 1 / 60, FLAT);              // away to the z...
    stepWorld(w, { swap: 1 }, 1 / 60, FLAT);              // ...and back
    expect(w.byId.g.weapon.ammo).toBe(7);                 // magazine persisted
    expect(w.byId.g.loadoutIdx).toBe(0);
  });

  it('a swap is refused mid-swing / mid-dodge / while charging / airborne', () => {
    const w = mk();
    run(w, {}, 3, 1 / 60, FLAT);
    stepWorld(w, { cycle: 1 }, 1 / 60, FLAT);             // melee slot
    run(w, {}, 65, 1 / 60, FLAT);                         // past the switch ready-time (2026-07-28)
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);              // start the swing
    expect(w.byId.g.swingT).not.toBeNull();
    stepWorld(w, { swap: 1 }, 1 / 60, FLAT);
    expect(w.pilotId).toBe('g');                          // refused
    run(w, {}, 60, 1 / 60, FLAT);                         // swing ends
    stepWorld(w, { jump: 1, jumpHeld: 1 }, 1 / 60, FLAT); // airborne
    stepWorld(w, {}, 1 / 60, FLAT);
    expect(w.byId.g.grounded).toBe(false);
    stepWorld(w, { swap: 1 }, 1 / 60, FLAT);
    expect(w.pilotId).toBe('g');                          // refused in the air
    run(w, {}, 120, 1 / 60, FLAT);                        // land
    stepWorld(w, { swap: 1 }, 1 / 60, FLAT);
    expect(w.pilotId).toBe('z');                          // grounded again: takes
  });

  it('an unpiloted armed suit does not consume the global trigger (no ghost fire)', () => {
    const w = mk();
    run(w, {}, 3, 1 / 60, FLAT);
    run(w, { fire: 1 }, 1, 1 / 60, FLAT);                 // g fires once
    expect(w.byId.g.weapon.ammo).toBe(7);
    stepWorld(w, { swap: 1 }, 1 / 60, FLAT);              // pilot the z
    run(w, { fire: 1 }, 30, 1 / 60, FLAT);                // hold the trigger as the z (unarmed rule)
    expect(w.byId.g.weapon.ammo).toBe(7);                 // the vacated g never fired
  });

  it('worlds without pilotable entities ignore swap entirely', () => {
    const plain = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0 }, transform: { pos: [0, 0, 0] } }] });
    expect(plain.pilotId).toBeNull();
    run(plain, { swap: 1 }, 5, 1 / 60, FLAT);
    expect(plain.byId.p.rule.type).toBe('platform');      // untouched
  });
});

describe('rule: ai (R20 — fire-back: hunt the pilot, own trigger, dodge-out on recovery)', () => {
  const FLAT = { ground: () => 0 };
  // a piloted platform suit + a vacated pilotable enemy whose AMBIENT brain is the ai rule. The
  // pilot's rifle one-shots the foe's poise (impact 100 ≥ poise 50) so a single hit staggers it.
  const mk = (foePos = [40, 20, 0], aiOver = {}) => createWorld({
    pilot: 'me',
    entities: [
      {
        id: 'me', pilotable: true, ambient: { type: 'clock' },
        rule: { type: 'platform', turnMode: 'look', eye: 0, speed: 6 },
        transform: { pos: [0, 0, 0], heading: 0 },
        body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 200, poise: 100, poiseRegen: 20, staggerDur: 1 },
        weapon: { fireClass: 'sight', auto: false, cooldown: 0.2, magazine: 10, reload: 1, coreAngle: 45, range: 200, damage: 10, impact: 100, eye: 0 },
      },
      {
        id: 'foe', pilotable: true,
        ambient: { type: 'ai', speed: 12, turn: 6, standoff: 15, fireArc: 8, burst: 0.5, pause: 0.5, dodgeDur: 0.5, dodgeSpeed: 12, ...aiOver },
        rule: { type: 'platform', turnMode: 'look', eye: 0 },
        transform: { pos: foePos, heading: Math.PI / 2 },
        body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 200, poise: 50, poiseRegen: 20, staggerDur: 0.6 },
        weapon: { fireClass: 'sight', auto: false, cooldown: 0.3, magazine: 30, reload: 1, coreAngle: 10, range: 100, damage: 5, impact: 10, eye: 0 },
      },
    ],
  });

  it('the vacated foe turns toward the pilot and closes to its standoff range, then holds', () => {
    const w = mk();                                        // foe 44.7u out, standoff 15
    run(w, {}, 300, 1 / 60, FLAT);                         // 5s — plenty to close 30u at speed 12
    const p = w.byId.foe.transform.pos;
    const d = Math.hypot(p[0], p[1]);
    expect(d).toBeLessThan(16);                            // closed to the standoff...
    expect(d).toBeGreaterThan(12);                         // ...and HELD (no hugging the pilot)
    // facing: heading settled onto the target bearing
    const want = Math.atan2(-p[1], -p[0]);
    const rem = Math.abs(((want - w.byId.foe.transform.heading + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
    expect(rem).toBeLessThan(0.1);
  });

  it('the foe fires back on its OWN trigger — no player input at all — and the pilot takes hits', () => {
    const w = mk([30, 0, 0]);
    run(w, {}, 180, 1 / 60, FLAT);                         // 3s, zero global input
    expect(w.byId.foe.weapon.shots).toBeGreaterThan(0);    // it shot
    expect(w.byId.me.hits).toBeGreaterThan(0);             // it LANDED (facing + in range + clear lane)
    expect(w.byId.me.body.hp).toBeLessThan(200);
    expect(w.byId.me.weapon.ammo).toBe(10);                // the pilot's own magazine untouched
  });

  it('the global trigger never fires an AI suit (no ghost fire, kept for the ai rule too)', () => {
    const w = mk([30, 0, 0], { burst: 0 });                // burst 0 → the ai never pulls its trigger
    run(w, { fire: 1 }, 60, 1 / 60, FLAT);                 // the PLAYER holds fire for 1s
    expect(w.byId.foe.weapon.shots).toBe(0);               // the held global trigger never reached it
    expect(w.byId.foe.weapon.ammo).toBe(30);
  });

  it('vacated on a melee slot, the ai self-switches to its first trigger slot and shoots', () => {
    const w = createWorld({
      pilot: 'me',
      entities: [
        {
          id: 'me', pilotable: true, ambient: { type: 'clock' },
          rule: { type: 'platform', turnMode: 'look', eye: 0 },
          transform: { pos: [0, 0, 0], heading: 0 },
          body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 200 },
        },
        {
          id: 'foe', pilotable: true,
          ambient: { type: 'ai', speed: 6, turn: 6, standoff: 10, fireArc: 10, burst: 0.6, pause: 0.4 },
          rule: {
            type: 'platform', turnMode: 'look', eye: 0,
            loadout: [
              { name: 'AXE', strike: 'melee', strikeReach: 4, strikeDamage: 10 },
              { name: 'MG', weapon: { fireClass: 'area', auto: true, rof: 10, magazine: 40, coreAngle: 20, assistAngle: 20, range: 100, damage: 2, impact: 2, eye: 0 } },
            ],
          },
          transform: { pos: [20, 0, 0], heading: Math.PI },
          body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 200 },
        },
      ],
    });
    expect(w.byId.foe.weapon).toBeNull();                  // vacated on the melee slot
    run(w, {}, 90, 1 / 60, FLAT);
    expect(w.byId.foe.loadoutIdx).toBe(1);                 // self-switched to the MG
    expect(w.byId.foe.weapon).toBeTruthy();
    expect(w.byId.foe.weapon.shots).toBeGreaterThan(0);    // and it is shooting
  });

  it('staggered → on recovery it DODGE-ROLLS off the firing line (i-frames), then resumes the hunt', () => {
    const w = mk([40, 0, 0]);                              // dead ahead on the pilot's +x aim line
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);               // one rifle hit: impact 100 ≥ poise 50
    expect(w.byId.foe.staggerT).not.toBeNull();            // staggered
    let sawDodge = false, peakY = 0;
    for (let i = 0; i < 150; i++) {                        // stagger 0.6s + dodge 0.5s + margin
      stepWorld(w, {}, 1 / 60, FLAT);
      const foe = w.byId.foe;
      peakY = Math.min(peakY, foe.transform.pos[1]);
      if (foe.dodgeT != null) {
        sawDodge = true;
        expect(foe.invincible).toBe(true);                 // the roll carries i-frames
        expect(foe.locomotion).toBe('dodge_sideroll');
      }
    }
    const foe = w.byId.foe;
    expect(sawDodge).toBe(true);
    expect(peakY).toBeLessThan(-2.5);                      // rolled LATERALLY off the +x firing line (first side is deterministic)
    expect(foe.dodgeT).toBeNull();                         // completed clean (the hunt resumed after)
    expect(foe.invincible).toBe(false);
  });

  it('while PILOTED the ai brain is dormant — the suit never self-fires', () => {
    const w = mk([30, 0, 0]);
    run(w, {}, 3, 1 / 60, FLAT);
    stepWorld(w, { swap: 1 }, 1 / 60, FLAT);               // T into the foe
    expect(w.pilotId).toBe('foe');
    const shots0 = w.byId.foe.weapon.shots;
    run(w, {}, 90, 1 / 60, FLAT);                          // no input held
    expect(w.byId.foe.weapon.shots).toBe(shots0);          // platform rule drives; no ai trigger
  });

  it('the AI-attack switch: spec.ai "off" seats the world passive; aiToggle (G) wakes and stands it down', () => {
    const spec = {
      pilot: 'me',
      ai: 'off',
      entities: [
        {
          id: 'me', pilotable: true, ambient: { type: 'clock' },
          rule: { type: 'platform', turnMode: 'look', eye: 0 },
          transform: { pos: [0, 0, 0], heading: 0 },
          body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 200 },
        },
        {
          id: 'foe', pilotable: true,
          ambient: { type: 'ai', speed: 12, turn: 6, standoff: 10, fireArc: 10, burst: 0.6, pause: 0.4 },
          rule: { type: 'platform', turnMode: 'look', eye: 0 },
          transform: { pos: [30, 0, 0], heading: Math.PI },
          body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 200 },
          weapon: { fireClass: 'sight', auto: false, cooldown: 0.3, magazine: 30, reload: 1, coreAngle: 10, range: 100, damage: 5, impact: 10, eye: 0 },
        },
      ],
    };
    const w = createWorld(spec);
    expect(w.aiEnabled).toBe(false);
    run(w, {}, 90, 1 / 60, FLAT);                          // passive: holds where it spawned, trigger cold
    expect(w.byId.foe.transform.pos[0]).toBe(30);
    expect(w.byId.foe.weapon.shots).toBe(0);
    stepWorld(w, { aiToggle: 1 }, 1 / 60, FLAT);           // G — wake the hunt
    expect(w.aiEnabled).toBe(true);
    run(w, {}, 90, 1 / 60, FLAT);
    expect(w.byId.foe.transform.pos[0]).toBeLessThan(29);  // closing
    expect(w.byId.foe.weapon.shots).toBeGreaterThan(0);    // shooting
    const shots1 = w.byId.foe.weapon.shots;
    stepWorld(w, { aiToggle: 1 }, 1 / 60, FLAT);           // G again — stand down
    expect(w.aiEnabled).toBe(false);
    const x1 = w.byId.foe.transform.pos[0];
    run(w, {}, 90, 1 / 60, FLAT);
    expect(w.byId.foe.transform.pos[0]).toBe(x1);          // frozen where it stood
    expect(w.byId.foe.weapon.shots).toBe(shots1);          // trigger cold again
    // absent spec.ai → enabled by default (authored ai runs)
    expect(createWorld({ entities: [] }).aiEnabled).toBe(true);
  });
});

describe('ai boost (R23 — the hunter juke-boosts in bursts; boost armor is live mid-burst)', () => {
  const FLAT = { ground: () => 0 };
  const mk = (aiOver = {}, foeBody = {}) => createWorld({
    pilot: 'me',
    entities: [
      { id: 'me', pilotable: true, ambient: { type: 'clock' },
        rule: { type: 'platform', turnMode: 'look', eye: 0, speed: 6 },
        transform: { pos: [0, 0, 0], heading: 0 },
        body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 500 },
        weapon: { fireClass: 'sight', auto: false, cooldown: 0.01, magazine: 99, reload: 1, coreAngle: 60, range: 400, damage: 5, impact: 100, eye: 0 } },
      { id: 'foe', pilotable: true,
        ambient: { type: 'ai', speed: 12, turn: 8, standoff: 40, fireArc: 8, burst: 0.5, pause: 0.5,
          boost: true, boostSpeed: 40, boostBurst: 2.0, boostRest: 1.5, jukePeriod: 0.6, ...aiOver },
        rule: { type: 'platform', turnMode: 'look', eye: 0 },
        transform: { pos: [40, 0, 0], heading: Math.PI },
        body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 900, poise: 100, poiseRegen: 0, boostArmor: 1, staggerDur: 1, ...foeBody } },
    ],
  });

  it('the foe boosts in BURSTS: e.boosting toggles true mid-burst and false on the rest beat', () => {
    const w = mk();
    let sawBoost = false, sawRest = false;
    for (let i = 0; i < 60 * 4; i++) {                       // > one full cycle (burst 2.0 + rest 1.5)
      stepWorld(w, {}, 1 / 60, FLAT);
      if (w.byId.foe.boosting) sawBoost = true; else sawRest = true;
    }
    expect(sawBoost).toBe(true);
    expect(sawRest).toBe(true);
    expect(w.byId.foe.locomotion.startsWith('boost') || !w.byId.foe.boosting).toBe(true);   // a boosting frame plays a boost clip
  });

  it('mid-boost the foe SHRUGS a full-stun bolt (boost armor); on the rest beat it staggers', () => {
    const w = mk();
    let g1 = 0;
    while (!w.byId.foe.boosting && g1++ < 400) stepWorld(w, {}, 1 / 60, FLAT);
    expect(w.byId.foe.boosting).toBe(true);
    w.byId.foe.transform.pos = [40, 0, 0];                  // pull it back onto the aim line (it juked off)
    w.byId.foe.poise = 100;
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);                // one 100-impact bolt while it is boosting
    expect(w.byId.foe.staggerT).toBeNull();                // halved to 50 → survived
    expect(w.byId.foe.poise).toBeCloseTo(50, 5);
    let g2 = 0;
    while (w.byId.foe.boosting && g2++ < 400) stepWorld(w, {}, 1 / 60, FLAT);
    expect(w.byId.foe.boosting).toBe(false);
    w.byId.foe.transform.pos = [40, 0, 0];
    w.byId.foe.poise = 100;                                 // clean poise for the rest-beat hit (regen 0)
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);                // grounded → full 100 → break
    expect(w.byId.foe.staggerT).not.toBeNull();
  });

  it('boost weaves the foe AROUND (its lateral position swings well off the approach line)', () => {
    const w = mk();
    let minY = 0, maxY = 0;
    for (let i = 0; i < 60 * 5; i++) {
      stepWorld(w, {}, 1 / 60, FLAT);
      minY = Math.min(minY, w.byId.foe.transform.pos[1]);
      maxY = Math.max(maxY, w.byId.foe.transform.pos[1]);
    }
    expect(maxY - minY).toBeGreaterThan(10);               // it juked side to side, not a straight beeline
  });

  it('without r.boost the foe never boosts (legacy walk; e.boosting stays false)', () => {
    const w = mk({ boost: false });
    let everBoosted = false;
    for (let i = 0; i < 60 * 4; i++) { stepWorld(w, {}, 1 / 60, FLAT); if (w.byId.foe.boosting) everBoosted = true; }
    expect(everBoosted).toBe(false);
  });
});

describe('ai 3D space seek (R25 — the space hunter closes in 3D, not just the ground plane)', () => {
  const spaceMk = (aiOver = {}, foePos = [300, 0, 200]) => createWorld({
    pilot: 'me',
    entities: [
      { id: 'me', pilotable: true, ambient: { type: 'clock' },
        rule: { type: 'platform', space: true, eye: 0 },
        transform: { pos: [0, 0, 0], heading: 0 },
        body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 200, poise: 100 } },
      { id: 'foe', pilotable: true,
        ambient: { type: 'ai', space: true, speed: 20, turn: 6, standoff: 40, fireArc: 8, burst: 0, pause: 1, dodge: false, ...aiOver },
        rule: { type: 'platform', space: true, eye: 0 },
        transform: { pos: foePos, heading: Math.PI },
        body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 200, poise: 100 } },
    ],
  });

  it('the space foe closes the 3D gap — including ALTITUDE — down to its standoff', () => {
    const w = spaceMk();                                    // foe far AND 200u above the target
    const foe = w.byId.foe;
    const p0 = foe.transform.pos.slice();
    const d0 = Math.hypot(p0[0], p0[1], p0[2]);             // ~360 in 3D
    for (let i = 0; i < 60 * 22; i++) stepWorld(w, {}, 1 / 60);   // 22s, NO ground hook (pure void)
    const p = foe.transform.pos;
    const d1 = Math.hypot(p[0], p[1], p[2]);
    expect(d1).toBeLessThan(d0 - 120);                      // closed most of the 3D distance
    expect(Math.abs(p[2])).toBeLessThan(Math.abs(p0[2]) - 80);   // dived toward the target's altitude (z→0)
    expect(d1).toBeGreaterThan(20);                         // held a standoff, didn't ram to zero
  });

  it('the space foe FIRES once its 3D nose is on the target above/below it', () => {
    const w = spaceMk({ burst: 1.0, pause: 0.3, standoff: 200 }, [220, 0, 120]);   // within beam range, off-axis in z
    const foe = w.byId.foe;
    foe.weapon = normalizeEntity({ weapon: { fireClass: 'area', auto: true, rof: 30, magazine: 99, coreAngle: 6, assistAngle: 6, range: 600, damage: 5, eye: 0 } }, 0).weapon;
    let fired = false;
    for (let i = 0; i < 60 * 4; i++) { stepWorld(w, {}, 1 / 60); if (foe.weapon.shots > 0) { fired = true; break; } }
    expect(fired).toBe(true);                               // the 3D aim cone let it shoot the target overhead
  });

  it('space melee-seek draws the saber, closes the 3D gap (altitude too), and LANDS the swing', () => {
    // DOCTRINE FLIP (2026-08-04, operator): this test used to pin the inverse — "space seats
    // ignore stale meleeSeek" — from before the 3D charge + 3D blade contact existed. Both are
    // built now, so meleeSeek is honoured in space: the hunter flies the full vector (closing
    // z as well), switches to the blade inside commit range, and the strike connects in 3D.
    const w = createWorld({
      pilot: 'me',
      entities: [
        { id: 'me', pilotable: true, ambient: { type: 'clock' },
          rule: { type: 'platform', space: true, eye: 0 },
          transform: { pos: [12, 0, 9], heading: Math.PI },   // near, but OFF-ALTITUDE — ground melee could never reach
          body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 200, poise: 100, poiseRegen: 20, staggerDur: 0.6 } },
        { id: 'foe', pilotable: true,
          ambient: { type: 'ai', space: true, meleeSeek: true, speed: 20, turn: 20, standoff: 40, fireArc: 30, burst: 1, pause: 0.1, dodge: false },
          rule: {
            type: 'platform', space: true, eye: 0,
            loadout: [
              { name: 'MG', weapon: { fireClass: 'area', auto: true, rof: 30, magazine: 99, coreAngle: 30, assistAngle: 30, range: 120, damage: 1, eye: 0 } },
              { name: 'SABER', strike: 'melee', strikeReach: 8, strikeDamage: 20 },
            ],
          },
          transform: { pos: [0, 0, 0], heading: 0 },
          body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 200, poise: 100 } },
      ],
    });
    const foe = w.byId.foe, me = w.byId.me;
    let drewSaber = false, swung = false;
    for (let i = 0; i < 60 * 8; i++) {
      stepWorld(w, {}, 1 / 60);
      if ((foe.loadoutIdx || 0) === 1) drewSaber = true;
      if (foe.swingT != null) swung = true;
      if (me.hits > 0) break;
    }
    expect(drewSaber).toBe(true);                             // committed: switched to the melee slot
    expect(swung).toBe(true);                                 // threw the blade
    expect(me.hits).toBeGreaterThan(0);                       // and it CONNECTED across the z-offset
    expect(me.body.hp).toBeLessThan(200);                     // the strike bit
  });

  it('a GROUND ai ignores altitude — the ground clamp owns z, the seek is XY only', () => {
    const w = createWorld({
      pilot: 'me',
      entities: [
        { id: 'me', pilotable: true, ambient: { type: 'clock' }, rule: { type: 'platform', eye: 0 },
          transform: { pos: [0, 0, 0], heading: 0 }, body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 200, poise: 100 } },
        { id: 'foe', pilotable: true, ambient: { type: 'ai', speed: 20, turn: 6, standoff: 40, burst: 0, pause: 1, dodge: false },
          rule: { type: 'platform', eye: 0 }, transform: { pos: [300, 0, 200], heading: Math.PI },
          body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 200, poise: 100 } },
      ],
    });
    const foe = w.byId.foe;
    for (let i = 0; i < 60 * 12; i++) stepWorld(w, {}, 1 / 60, { ground: () => 0 });   // FLAT ground
    expect(Math.hypot(foe.transform.pos[0], foe.transform.pos[1])).toBeLessThan(60);   // closed the plane
    expect(foe.transform.pos[2]).toBeCloseTo(0, 1);                                     // ground-clamped, not altitude-seeking
  });
});

describe('weapon timers tick while not in use (R20.3 — background reload / cooldown)', () => {
  const FLAT = { ground: () => 0 };
  const mk = () => createWorld({
    entities: [
      {
        id: 'p',
        rule: {
          type: 'platform', turnMode: 'look', eye: 0,
          loadout: [
            { name: 'GUN', weapon: { fireClass: 'sight', auto: false, cooldown: 1, magazine: 2, reload: 1.5, coreAngle: 5, range: 100, damage: 0, eye: 0 } },
            { name: 'BLADE', strike: 'melee', strikeReach: 4 },
          ],
        },
        transform: { pos: [0, 0, 0], heading: 0 },
      },
    ],
  });

  it('a stowed magazine keeps reloading (empty the gun, switch to melee, come back full)', () => {
    const w = mk();
    run(w, {}, 3, 1 / 60, FLAT);
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);         // shot 1
    run(w, {}, 62, 1 / 60, FLAT);                    // the 1s cooldown passes
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);         // shot 2 → empty → reload armed
    expect(w.byId.p.weapon.ammo).toBe(0);
    expect(w.byId.p.weapon.reloading).toBe(true);
    stepWorld(w, { cycle: 1 }, 1 / 60, FLAT);        // stow it (melee slot up)
    expect(w.byId.p.weapon).toBeNull();
    run(w, {}, 95, 1 / 60, FLAT);                    // > the 1.5s reload, all of it stowed
    stepWorld(w, { cycle: 1 }, 1 / 60, FLAT);        // back to the gun
    expect(w.byId.p.weapon.reloading).toBe(false);
    expect(w.byId.p.weapon.ammo).toBe(2);            // refilled in the background
  });

  it('a stowed cooldown keeps draining (fire, stow, return past the cooldown, fire at once)', () => {
    const w = mk();
    run(w, {}, 3, 1 / 60, FLAT);
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);         // shot 1 → 1s cooldown
    expect(w.byId.p.weapon.shots).toBe(1);
    stepWorld(w, { cycle: 1 }, 1 / 60, FLAT);        // stow
    run(w, {}, 65, 1 / 60, FLAT);                    // cooldown expires while stowed
    stepWorld(w, { cycle: 1 }, 1 / 60, FLAT);        // back
    expect(w.byId.p.weapon.cooldownT).toBe(0);       // R20.3: the cooldown drained while stowed
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);
    expect(w.byId.p.weapon.shots).toBe(1);           // but the SWITCH ready-time eats the instant re-fire (2026-07-28)
    run(w, {}, 65, 1 / 60, FLAT);                    // past the ready-time
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);
    expect(w.byId.p.weapon.shots).toBe(2);           // fires with NO extra cooldown wait — the stow-drained cooldown held
  });

  it('a STAGGERED suit keeps reloading (the autoloader is machinery, not attention)', () => {
    const w = createWorld({
      entities: [
        {
          id: 'a', rule: { type: 'platform', turnMode: 'look', eye: 0 }, transform: { pos: [0, 0, 0], heading: 0 },
          body: { type: 'figure-rig', hittable: true, radius: 1, poise: 50 },
          weapon: { fireClass: 'sight', auto: false, cooldown: 0.1, magazine: 1, reload: 1, coreAngle: 45, range: 100, damage: 0, eye: 0 },
        },
        {
          id: 'b', rule: { type: 'static' }, transform: { pos: [10, 0, 0], heading: Math.PI },
          weapon: { fireClass: 'sight', auto: false, cooldown: 5, magazine: 5, reload: 1, coreAngle: 45, range: 100, damage: 0, impact: 100, eye: 0 },
        },
      ],
    });
    // one shared fire edge: a empties its 1-round mag (reload arms), b's shot breaks a's poise
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);
    expect(w.byId.a.weapon.reloading).toBe(true);
    expect(w.byId.a.staggerT).not.toBeNull();        // staggered while reloading
    run(w, {}, 63, 1 / 60, FLAT);                    // ~1.05s: reload (1s) done, stagger (1.3s) not
    expect(w.byId.a.staggerT).not.toBeNull();        // still reeling...
    expect(w.byId.a.weapon.reloading).toBe(false);   // ...but the magazine refilled anyway
    expect(w.byId.a.weapon.ammo).toBe(1);
  });
});

describe('energy weapons (V78 beam rifle heat budget)', () => {
  const shotWorld = () => createWorld({
    entities: [{
      id: 'gun',
      rule: { type: 'static' },
      transform: { pos: [0, 0, 1], heading: 0, pitch: 0 },
      weapon: {
        fireClass: 'sight', auto: false, cooldown: 0.1, magazine: 99, reload: 10,
        coreAngle: 90, range: 100, damage: 0, eye: 0,
        energyMax: 100, energyCost: 45, energyRegen: 0, energyOverheatRegen: 10, energyUnlockFrac: 1,
      },
    }],
  });

  const tap = (w) => {
    stepWorld(w, { fire: 1 }, 1 / 60);
    stepWorld(w, { fire: 0 }, 1 / 60);
    run(w, {}, 8);
  };

  it('spends energy per shot and overheat-locks when the heat budget is exhausted', () => {
    const w = shotWorld();
    const gun = w.byId.gun.weapon;
    tap(w); expect(gun.energy).toBe(55);
    tap(w); expect(gun.energy).toBe(10);
    tap(w);
    expect(gun.energy).toBeLessThan(2);                    // the helper's quiet frames start cooling immediately
    expect(gun.energyLock).toBe(true);
    const shots = gun.shots;
    tap(w);
    expect(gun.shots).toBe(shots);                         // overheated trigger is refused
  });

  it('recovers while locked and unlocks after the configured 10 second overheat refill', () => {
    const w = shotWorld();
    const gun = w.byId.gun.weapon;
    tap(w); tap(w); tap(w);
    expect(gun.energyLock).toBe(true);
    const start = gun.energy;
    run(w, {}, 60 * 5);
    expect(gun.energy).toBeCloseTo(start + 50, 0);
    expect(gun.energyLock).toBe(true);
    run(w, {}, 60 * 5);
    expect(gun.energy).toBeCloseTo(100, 1);
    expect(gun.energyLock).toBe(false);
    tap(w);
    expect(gun.shots).toBe(4);
  });

  it('passively recharges an unlocked energy weapon while stowed', () => {
    const w = createWorld({
      entities: [{
        id: 'p',
        rule: {
          type: 'platform',
          loadout: [
            { name: 'V78', weapon: { fireClass: 'sight', cooldown: 0.1, magazine: 99, energyMax: 100, energyCost: 45, energyRegen: 20, energyOverheatRegen: 10 } },
            { name: 'SABER', strike: 'melee' },
          ],
        },
        transform: { pos: [0, 0, 0], heading: 0 },
      }],
    });
    const gun = w.byId.p.weapon;
    stepWorld(w, { fire: 1 }, 1 / 60);
    expect(gun.energy).toBe(55);
    stepWorld(w, { cycle: 1 }, 1 / 60);                   // stow the rifle
    run(w, {}, 60);
    expect(gun.energy).toBeGreaterThan(75);               // cooling is world-side, not active-slot-side
    expect(gun.energy).toBeLessThan(76);
  });

  const chargeWorld = () => createWorld({
    entities: [{
      id: 'gun',
      rule: { type: 'static' },
      transform: { pos: [0, 0, 1], heading: 0, pitch: 0 },
      weapon: {
        fireClass: 'sight', auto: false, cooldown: 0.1, magazine: 99, reload: 10,
        coreAngle: 90, range: 100, damage: 0, eye: 0,
        energyMax: 100, energyCost: 45, chargedEnergyCost: 75, energyRegen: 0, energyOverheatRegen: 10,
        chargeTime: 0.5,
      },
    }],
  });

  it('starts a rifle charge on press and fires a normal shot on early release', () => {
    const w = chargeWorld();
    const gun = w.byId.gun.weapon;
    stepWorld(w, { fire: 1 }, 1 / 60);
    expect(gun.charging).toBe(true);
    expect(gun.chargeCount).toBe(1);
    expect(gun.shots).toBe(0);
    run(w, { fire: 1 }, 10);
    expect(gun.chargeReady).toBe(false);
    stepWorld(w, { fire: 0 }, 1 / 60);
    expect(gun.shots).toBe(1);
    expect(gun.energy).toBe(55);
    expect(w.byId.gun.lastShot.charged).toBe(false);
    expect(gun.charging).toBe(false);
  });

  it('fires a charged rifle blast on full-charge release and spends the charged energy cost', () => {
    const w = chargeWorld();
    const gun = w.byId.gun.weapon;
    stepWorld(w, { fire: 1 }, 1 / 60);
    run(w, { fire: 1 }, 31);
    expect(gun.chargeReady).toBe(true);
    stepWorld(w, { fire: 0 }, 1 / 60);
    expect(gun.shots).toBe(1);
    expect(gun.chargedShots).toBe(1);
    expect(gun.energy).toBe(25);
    expect(w.byId.gun.lastShot.charged).toBe(true);
  });

  it('uses a separate charged impact value so only a full V78 charge staggers', () => {
    const mk = () => createWorld({
      entities: [
        {
          id: 'gun',
          rule: { type: 'static' },
          transform: { pos: [0, 0, 1], heading: 0, pitch: 0 },
          weapon: {
            fireClass: 'sight', auto: false, cooldown: 0.1, magazine: 99,
            coreAngle: 90, range: 100, damage: 0, eye: 0,
            energyMax: 100, energyCost: 45, chargedEnergyCost: 75, energyRegen: 0,
            impact: 60, chargedImpact: 100, chargeTime: 0.5,
          },
        },
        {
          id: 'target',
          rule: { type: 'static' },
          transform: { pos: [20, 0, 1] },
          body: { type: 'mesh', hittable: true, radius: 2, hp: 100, poise: 100, poiseRegen: 0, staggerDur: 1 },
        },
      ],
    });
    const normal = mk();
    stepWorld(normal, { fire: 1 }, 1 / 60);
    run(normal, { fire: 1 }, 10);
    stepWorld(normal, { fire: 0 }, 1 / 60);
    expect(normal.byId.target.poise).toBe(40);
    expect(normal.byId.target.staggerT).toBeNull();

    const charged = mk();
    stepWorld(charged, { fire: 1 }, 1 / 60);
    run(charged, { fire: 1 }, 31);
    stepWorld(charged, { fire: 0 }, 1 / 60);
    expect(charged.byId.target.staggerT).not.toBeNull();
  });

  it('a charged bolt reaches 20% past the base range; an uncharged shot does not (mk2/taisa rifles)', () => {
    // target parked at 110 — past the plain 100 range, inside the charged 120 (default chargedRangeMul 1.2)
    const mk = (weaponOver = {}) => createWorld({
      entities: [
        {
          id: 'gun',
          rule: { type: 'static' },
          transform: { pos: [0, 0, 1], heading: 0, pitch: 0 },
          weapon: {
            fireClass: 'sight', auto: false, cooldown: 0.1, magazine: 99,
            coreAngle: 90, range: 100, damage: 10, eye: 0, chargeTime: 0.5, ...weaponOver,
          },
        },
        {
          id: 'target',
          rule: { type: 'static' },
          transform: { pos: [110, 0, 1] },
          body: { type: 'mesh', hittable: true, radius: 2, hp: 100 },
        },
      ],
    });
    const normal = mk();                                  // early release — uncharged tap
    stepWorld(normal, { fire: 1 }, 1 / 60);
    run(normal, { fire: 1 }, 10);
    stepWorld(normal, { fire: 0 }, 1 / 60);
    expect(normal.byId.gun.lastShot.mode).toBe('miss');   // 110 > 100 — out of plain reach
    expect(normal.byId.target.body.hp).toBe(100);

    const charged = mk();                                 // full hold — the charged bolt
    stepWorld(charged, { fire: 1 }, 1 / 60);
    run(charged, { fire: 1 }, 31);
    stepWorld(charged, { fire: 0 }, 1 / 60);
    expect(charged.byId.gun.lastShot.charged).toBe(true);
    expect(charged.byId.gun.lastShot.mode).toBe('core');  // 110 <= 120 — the charge carries
    expect(charged.byId.target.body.hp).toBe(90);

    const optedOut = mk({ chargedRangeMul: 1 });          // per-weapon opt-out retunes to plain range
    stepWorld(optedOut, { fire: 1 }, 1 / 60);
    run(optedOut, { fire: 1 }, 31);
    stepWorld(optedOut, { fire: 0 }, 1 / 60);
    expect(optedOut.byId.gun.lastShot.charged).toBe(true);
    expect(optedOut.byId.gun.lastShot.mode).toBe('miss');
    expect(optedOut.byId.target.body.hp).toBe(100);

    // chargedDamage (taisa stun bolt): the charged hit lands its OWN chip — 3.5 bullets' worth —
    // while the charged-range default still carries it to the 110-unit target. (The charged case
    // above, no chargedDamage, already pins the base-damage fallback.)
    const heavy = mk({ damage: 12, chargedDamage: 42 });
    stepWorld(heavy, { fire: 1 }, 1 / 60);
    run(heavy, { fire: 1 }, 31);
    stepWorld(heavy, { fire: 0 }, 1 / 60);
    expect(heavy.byId.gun.lastShot.charged).toBe(true);
    expect(heavy.byId.target.body.hp).toBe(58);           // 100 − 42, not 100 − 12
  });

  it('cancels a held rifle charge when the suit is staggered', () => {
    const w = createWorld({
      entities: [{
        id: 'gun',
        rule: { type: 'static' },
        transform: { pos: [0, 0, 1], heading: 0, pitch: 0 },
        body: { type: 'mesh', hittable: true, radius: 1, hp: 100, poise: 100, staggerDur: 1 },
        weapon: {
          fireClass: 'sight', auto: false, cooldown: 0.1, magazine: 99,
          coreAngle: 90, range: 100, energyMax: 100, energyCost: 45, chargedEnergyCost: 75,
          chargeTime: 0.5,
        },
      }],
    });
    const ent = w.byId.gun;
    stepWorld(w, { fire: 1 }, 1 / 60);
    expect(ent.weapon.charging).toBe(true);
    ent.staggerT = 0;
    ent.reactClip = 'stagger';
    ent.reactDur = 1;
    stepWorld(w, { fire: 1 }, 1 / 60);
    expect(ent.weapon.charging).toBe(false);
    stepWorld(w, { fire: 0 }, 1 / 60);
    expect(ent.weapon.shots).toBe(0);
  });
});

describe('melee combo 1 + knockdown pacing (R20.4)', () => {
  const FLAT = { ground: () => 0 };
  // an attacker with a combo-1 saber slot facing a poise target standing in reach
  const mk = (combo = 1, tgOver = {}) => createWorld({
    entities: [
      {
        id: 'p',
        rule: {
          type: 'platform', turnMode: 'look', eye: 0,
          loadout: [{ name: 'SABER', strike: 'melee', strikeReach: 8, strikeDamage: 10, strikeCone: 75, ...(combo ? { combo } : {}) }],
        },
        transform: { pos: [0, 0, 0], heading: 0 },
      },
      {
        id: 'tg', transform: { pos: [5, 0, 0] }, rule: { type: 'static' },
        body: { type: 'figure-rig', hittable: true, radius: 1, hp: 500, poise: 50, staggerDur: 1.0, ...tgOver },
      },
    ],
  });

  it('a connected swing opens the window; S+click INSIDE it makes the back-cleave connect a KNOCKDOWN', () => {
    const w = mk();
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);           // swing 1
    run(w, {}, 60, 1 / 60, FLAT);                      // completes (0.9s); the connect staggered the target
    expect(w.byId.p.comboT).toBeGreaterThan(0);        // window open (the HUD reads COMBO here)
    expect(w.byId.tg.reactClip).toBe('stagger');
    stepWorld(w, { fire: 1, forward: -1 }, 1 / 60, FLAT);   // timed S+click → the combo BACK cleave
    expect(w.byId.p.swingCombo).toBe(true);
    expect(w.byId.p.swingClip).toBe('swing_back');
    expect(w.byId.p.comboT).toBe(0);                   // window spent
    run(w, {}, 30, 1 / 60, FLAT);                      // through the contact window
    expect(w.byId.tg.reactClip).toBe('topple');        // knocked down — upgrades the mid-stagger target
    expect(w.byId.tg.downed).toBe(false);
  });

  it('a timed combo click WITHOUT back held is just another stagger — only back+swing knocks down', () => {
    const w = mk();
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);
    run(w, {}, 60, 1 / 60, FLAT);
    expect(w.byId.p.comboT).toBeGreaterThan(0);
    stepWorld(w, { fire: 1, forward: 1 }, 1 / 60, FLAT);   // in the window, a NEW direction — but not the cleave
    expect(w.byId.p.swingCombo).toBe(true);
    run(w, {}, 30, 1 / 60, FLAT);
    expect(w.byId.tg.reactClip).toBe('stagger');       // no knockdown without the back input
  });

  it('a plain back cleave on a combo slot (outside the window) staggers — the knockdown is combo-gated', () => {
    const w = mk();
    stepWorld(w, { fire: 1, forward: -1 }, 1 / 60, FLAT);   // cold-open back cleave, no window
    expect(w.byId.p.swingClip).toBe('swing_back');
    expect(w.byId.p.swingCombo).toBe(false);
    run(w, {}, 30, 1 / 60, FLAT);
    expect(w.byId.tg.reactClip).toBe('stagger');       // combo slot: the cleave alone no longer floors
  });

  it('a combo-less slot keeps the R15 always-topple back cleave (the z axe)', () => {
    const w = mk(0, { staggerDur: 0.5 });
    stepWorld(w, { fire: 1, forward: -1 }, 1 / 60, FLAT);
    run(w, {}, 30, 1 / 60, FLAT);
    expect(w.byId.tg.reactClip).toBe('topple');        // no combo on the slot → the cleave floors as before
  });

  it('a LATE click (window expired) is an ordinary swing — stagger, no knockdown', () => {
    const w = mk();
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);
    run(w, {}, 60, 1 / 60, FLAT);                      // window opens at completion (0.8s)...
    run(w, {}, 60, 1 / 60, FLAT);                      // ...and expires unspent
    expect(w.byId.p.comboT).toBe(0);
    stepWorld(w, { fire: 1, forward: -1 }, 1 / 60, FLAT);   // even the back cleave, late
    expect(w.byId.p.swingCombo).toBe(false);
    run(w, {}, 30, 1 / 60, FLAT);
    expect(w.byId.tg.reactClip).toBe('stagger');       // never a topple
  });

  it('a WHIFFED opener opens the window too (combo strings need no connect); a combo-less slot never opens one', () => {
    const far = mk();
    far.byId.tg.transform.pos = [50, 0, 0];            // out of reach
    stepWorld(far, { fire: 1 }, 1 / 60, FLAT);
    run(far, {}, 60, 1 / 60, FLAT);
    expect(far.byId.p.comboT).toBeGreaterThan(0);      // the whiff still starts the string
    const plain = mk(0);                               // the z-axe shape: no combo on the slot
    stepWorld(plain, { fire: 1 }, 1 / 60, FLAT);
    run(plain, {}, 60, 1 / 60, FLAT);
    expect(plain.byId.tg.hits).toBe(1);                // the opener connected...
    expect(plain.byId.p.comboT).toBe(0);               // ...but no combo on the slot → no window
  });

  it('getupDur pins the slower rise; wakeGuard grants post-knockdown invincibility that expires', () => {
    const w = mk(0, { staggerDur: 0.5, toppleDur: 0.5, getupDur: 1.0, wakeGuard: 1 });   // combo-less slot: the cleave floors directly
    stepWorld(w, { fire: 1, forward: -1 }, 1 / 60, FLAT);   // S-held back cleave → direct topple
    expect(w.byId.p.swingClip).toBe('swing_back');
    // connect ~f16 → fall 0.5s (ends ~f46) → TOPPLED 2.0s (ends ~f166) → rise 1.0s (ends ~f226) → guard 1s (ends ~f286)
    run(w, {}, 178, 1 / 60, FLAT);                     // f179: mid-rise — the pinned 1.0s getup still hauling up
    expect(w.byId.tg.locomotion).toBe('getup');        // still hauling itself up — the +2s style pin holds
    run(w, {}, 70, 1 / 60, FLAT);                      // f249: risen, in the wake guard
    expect(w.byId.tg.staggerT).toBeNull();
    expect(w.byId.tg.invincible).toBe(true);           // the wake guard — untouchable fresh off the floor
    run(w, {}, 70, 1 / 60, FLAT);                      // f319: past the 1s guard
    expect(w.byId.tg.invincible).toBe(false);          // hittable again
  });
});

describe('melee cooldown (R20.5 — the spent fist; the combo click bypasses it)', () => {
  const FLAT = { ground: () => 0 };
  const mk = () => createWorld({
    entities: [
      {
        id: 'p',
        rule: {
          type: 'platform', turnMode: 'look', eye: 0,
          loadout: [{ name: 'SABER', strike: 'melee', strikeCooldown: 2, strikeReach: 8, strikeDamage: 10, strikeCone: 75, combo: 1 }],
        },
        transform: { pos: [0, 0, 0], heading: 0 },
      },
      {
        id: 'tg', transform: { pos: [5, 0, 0] }, rule: { type: 'static' },
        body: { type: 'figure-rig', hittable: true, radius: 1, hp: 500, poise: 50, staggerDur: 0.4 },
      },
    ],
  });

  it('after a swing the fist is spent for 2s — an early click is eaten, a late one swings', () => {
    const w = mk();
    w.byId.tg.transform.pos = [50, 0, 0];              // out of reach: a whiff — its window is open, but a
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);           // REPEAT-direction click can't ride it (string gate)
    run(w, {}, 60, 1 / 60, FLAT);                      // swing done (0.9s) → the 2s cooldown armed
    expect(w.byId.p.strikeCdT).toBeGreaterThan(1.8);
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);           // early click, same neutral direction: eaten
    expect(w.byId.p.swingT).toBeNull();
    run(w, {}, 120, 1 / 60, FLAT);                     // the cooldown expires
    expect(w.byId.p.strikeCdT).toBe(0);
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);
    expect(w.byId.p.swingT).not.toBeNull();            // swings again
  });

  it('the combo click BYPASSES the cooldown (the 0.8s window has to beat the 2s lockout)', () => {
    const w = mk();
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);           // opener CONNECTS
    run(w, {}, 60, 1 / 60, FLAT);                      // done: window open AND cooldown running
    expect(w.byId.p.comboT).toBeGreaterThan(0);
    expect(w.byId.p.strikeCdT).toBeGreaterThan(0);
    stepWorld(w, { fire: 1, forward: -1 }, 1 / 60, FLAT);   // timed S+click
    expect(w.byId.p.swingT).not.toBeNull();            // the follow-up starts despite the spent fist
    expect(w.byId.p.swingCombo).toBe(true);
    run(w, {}, 60, 1 / 60, FLAT);                      // the combo swing's end re-arms the cooldown
    expect(w.byId.p.strikeCdT).toBeGreaterThan(1.5);
  });
});

describe('combo 1 + melee enforcement (2026-07-28 — 2-hit cap, then a 2.5s cooldown; follow-up must change direction)', () => {
  const FLAT = { ground: () => 0 };
  const mk = (slot = {}, foes = [[5, 0, 0]]) => createWorld({
    entities: [
      {
        id: 'p',
        rule: {
          type: 'platform', turnMode: 'look', eye: 0,
          loadout: [{ name: 'SABER', strike: 'melee', strikeReach: 8, strikeDamage: 10, strikeCone: 75, combo: 1, ...slot }],
        },
        transform: { pos: [0, 0, 0], heading: 0 },
      },
      ...foes.map((pos, i) => ({
        id: 'tg' + i, transform: { pos }, rule: { type: 'static' },
        body: { type: 'figure-rig', hittable: true, radius: 1, hp: 500, poise: 50, staggerDur: 1.0 },
      })),
    ],
  });

  it('a WHIFFED opener opens the window; the different-direction cleave then knocks down on connect', () => {
    const w = mk({}, [[50, 0, 0]]);                          // out of reach: the opener whiffs
    stepWorld(w, { fire: 1, forward: 1 }, 1 / 60, FLAT);     // forward thrust into empty air
    run(w, {}, 60, 1 / 60, FLAT);
    expect(w.byId.p.comboT).toBeGreaterThan(0);              // the whiff still opened the string
    w.byId.tg0.transform.pos = [5, 0, 0];                    // the foe steps into reach
    stepWorld(w, { fire: 1, forward: -1 }, 1 / 60, FLAT);    // timed S+click (back ≠ forward)
    expect(w.byId.p.swingCombo).toBe(true);
    run(w, {}, 30, 1 / 60, FLAT);
    expect(w.byId.tg0.reactClip).toBe('topple');             // the knockdown no longer needs a landed opener
  });

  it('a same-direction click inside the window is NOT a combo: eaten by a live cooldown, a plain swing without one', () => {
    const cd = mk({ strikeCooldown: 2 });
    stepWorld(cd, { fire: 1, forward: 1 }, 1 / 60, FLAT);
    run(cd, {}, 60, 1 / 60, FLAT);                           // done: window open AND cooldown running
    expect(cd.byId.p.comboT).toBeGreaterThan(0);
    stepWorld(cd, { fire: 1, forward: 1 }, 1 / 60, FLAT);    // the SAME direction again
    expect(cd.byId.p.swingT).toBeNull();                     // refused — no bypass for a repeat swing
    const free = mk();                                       // no cooldown: the repeat swings...
    stepWorld(free, { fire: 1, forward: 1 }, 1 / 60, FLAT);
    run(free, {}, 60, 1 / 60, FLAT);
    expect(free.byId.p.comboT).toBeGreaterThan(0);
    stepWorld(free, { fire: 1, forward: 1 }, 1 / 60, FLAT);
    expect(free.byId.p.swingT).not.toBeNull();
    expect(free.byId.p.swingCombo).toBe(false);              // ...but as an ordinary opener, never a combo step
  });

  it('CAPS at 2: the follow-up opens NO third window and arms the enforced ~2.5s cooldown', () => {
    const w = mk({ strikeCooldown: 2 }, [[50, 0, 0]]);       // all whiffs — the cap is on COUNT, not connects
    stepWorld(w, { fire: 1, forward: 1 }, 1 / 60, FLAT);     // OPENER: forward
    run(w, {}, 60, 1 / 60, FLAT);                            // completes → the one follow-up window opens
    expect(w.byId.p.comboT).toBeGreaterThan(0);
    stepWorld(w, { fire: 1, strafe: -1 }, 1 / 60, FLAT);     // FOLLOW-UP: left ≠ forward (bypasses the spent fist)
    expect(w.byId.p.swingCombo).toBe(true);
    run(w, {}, 60, 1 / 60, FLAT);                            // the follow-up (hit 2) completes
    expect(w.byId.p.comboT).toBe(0);                         // CAP — no third window opens
    expect(w.byId.p.strikeCdT).toBeGreaterThan(2.3);         // and the ENFORCED ~2.5s lockout is armed…
    expect(w.byId.p.strikeCdMax).toBeCloseTo(2.5, 5);        // …at the full 2.5, not the base 2s
    stepWorld(w, { fire: 1, strafe: 1 }, 1 / 60, FLAT);      // a THIRD click — even a fresh direction — is refused
    expect(w.byId.p.swingT == null).toBe(true);
    run(w, {}, 60 * 2.2, 1 / 60, FLAT);                      // still spent past the BASE 2s (2.5 > 2.2)
    stepWorld(w, { fire: 1, forward: 1 }, 1 / 60, FLAT);
    expect(w.byId.p.swingT == null).toBe(true);
    run(w, {}, 60 * 0.5, 1 / 60, FLAT);                      // past 2.5s total
    stepWorld(w, { fire: 1, forward: 1 }, 1 / 60, FLAT);
    expect(w.byId.p.swingT).not.toBeNull();                  // a FRESH opener swings again (new 2-hit sequence)
    expect(w.byId.p.swingCombo).toBe(false);
  });

  it('a lone opener (window lapsed) keeps the BASE strikeCooldown, not the combo lockout', () => {
    const w = mk({ strikeCooldown: 2 }, [[50, 0, 0]]);
    stepWorld(w, { fire: 1, forward: 1 }, 1 / 60, FLAT);     // opener, no follow-up
    run(w, {}, 60, 1 / 60, FLAT);
    expect(w.byId.p.strikeCdMax).toBeCloseTo(2, 5);          // base 2s — the 2.5s only follows a combo hit
  });

  it('the follow-up honors the camera: it adjudicates on the LIVE heading at click time', () => {
    const w = mk({}, [[0, 5, 0]]);                           // the foe stands 90° LEFT of the opener facing
    stepWorld(w, { fire: 1, forward: 1 }, 1 / 60, FLAT);     // opener forward at heading 0 (+x): whiffs past it
    run(w, {}, 60, 1 / 60, FLAT);
    expect(w.byId.tg0.hits || 0).toBe(0);                    // out of the opener's cone
    expect(w.byId.p.comboT).toBeGreaterThan(0);
    stepWorld(w, { lookDX: (Math.PI / 2) / 0.0025 }, 1 / 60, FLAT);   // the mouse swings the camera onto the foe
    stepWorld(w, { fire: 1, forward: -1 }, 1 / 60, FLAT);    // the timed follow-up throws where the camera looks NOW
    expect(w.byId.p.swingCombo).toBe(true);
    run(w, {}, 30, 1 / 60, FLAT);
    expect(w.byId.tg0.hits).toBe(1);                         // the cleave lands on the new facing
    expect(w.byId.tg0.reactClip).toBe('topple');
  });
});

describe('dodge cooldown + act-breaks-invincibility (2026-07-27)', () => {
  const FLAT = { ground: () => 0 };
  // double-tap F with a direction held — the roll commit (dodgeBoostCost 0 = free rolls, so
  // these tests read the COOLDOWN alone, never the gauge/overheat economy)
  const tapTap = (w) => {
    stepWorld(w, { boost: 1, forward: 1 }, 1 / 60, FLAT);
    stepWorld(w, { forward: 1 }, 1 / 60, FLAT);
    stepWorld(w, { boost: 1, forward: 1 }, 1 / 60, FLAT);
  };

  it('gaugeless/free-roll shapes: a roll spends the dodge for the 8s wall-clock — refused inside, live after', () => {
    // no boostMax on the rule → no gauge → the wall-clock `dodgeCooldown` (default 8) is the
    // recovery; gauge-bearing overheat rules use the ALIGNED bar gate instead (next describe).
    const mkD = (over = {}) => createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, speed: 6, dodge: true, dodgeBoostCost: 0, ...over }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    const w = mkD();
    run(w, {}, 5, 1 / 60, FLAT);
    tapTap(w);
    expect(w.byId.p.dodgeT).not.toBeNull();          // roll 1 commits
    expect(w.byId.p.dodgeCdT).toBeCloseTo(8, 3);     // the 8s recovery armed at commit
    run(w, {}, 60, 1 / 60, FLAT);                    // the tumble completes (0.55s)
    expect(w.byId.p.dodgeT).toBeNull();
    tapTap(w);                                       // ~1s after the roll: refused
    expect(w.byId.p.dodgeT).toBeNull();
    run(w, {}, 60 * 8, 1 / 60, FLAT);                // the recovery drains (ticks only while not rolling)
    expect(w.byId.p.dodgeCdT).toBe(0);
    tapTap(w);
    expect(w.byId.p.dodgeT).not.toBeNull();          // rolls again
    // tunable: `dodgeCooldown` on the rule re-arms fast
    const q = mkD({ dodgeCooldown: 0.5 });
    run(q, {}, 5, 1 / 60, FLAT);
    tapTap(q);
    expect(q.byId.p.dodgeT).not.toBeNull();
    run(q, {}, 80, 1 / 60, FLAT);                    // 0.55s tumble + 0.5s recovery + margin
    tapTap(q);
    expect(q.byId.p.dodgeT).not.toBeNull();
  });

  it('firing a weapon spends the wake guard — no shooting while untouchable', () => {
    const w = createWorld({ entities: [{
      id: 'p', rule: { type: 'platform', eye: 0 }, weapon: { damage: 5, cooldown: 0.3 },
      body: { type: 'figure-rig', hittable: true, radius: 1, hp: 100, poise: 50 },
      transform: { pos: [0, 0, 0] },
    }] });
    run(w, {}, 3, 1 / 60, FLAT);
    const p = w.byId.p;
    p.wakeGuardT = 3; p.invincible = true;           // as if fresh off the floor (R20.4 wake guard)
    run(w, {}, 3, 1 / 60, FLAT);
    expect(p.invincible).toBe(true);                 // the guard asserts per frame while it runs
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);         // a round leaves
    expect(p.wakeGuardT).toBe(0);
    expect(p.invincible).toBe(false);
    run(w, {}, 10, 1 / 60, FLAT);
    expect(p.invincible).toBe(false);                // and it stays down — the guard is spent, not paused
  });

  it('a melee swing spends the wake guard too (acting is acting)', () => {
    const w = createWorld({ entities: [{
      id: 'p', rule: { type: 'platform', eye: 0, strike: 'melee', strikeDur: 0.4 },
      body: { type: 'figure-rig', hittable: true, radius: 1, hp: 100, poise: 50 },
      transform: { pos: [0, 0, 0] },
    }] });
    run(w, {}, 3, 1 / 60, FLAT);
    const p = w.byId.p;
    p.wakeGuardT = 3; p.invincible = true;
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);         // the swing opener
    expect(p.swingT).not.toBeNull();
    expect(p.wakeGuardT).toBe(0);
    expect(p.invincible).toBe(false);
  });

  it('firing mid-tumble spends the dodge i-frames — the roll finishes hittable', () => {
    const w = createWorld({ entities: [{
      id: 'p', rule: { type: 'platform', eye: 0, speed: 6, dodge: true, dodgeBoostCost: 0 },
      weapon: { damage: 5, cooldown: 0.3 },
      transform: { pos: [0, 0, 0], heading: 0 },
    }] });
    run(w, {}, 5, 1 / 60, FLAT);
    tapTap(w);
    expect(w.byId.p.dodgeT).not.toBeNull();
    run(w, {}, 2, 1 / 60, FLAT);
    expect(w.byId.p.invincible).toBe(true);          // tumbling untouchable
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);         // the trigger works mid-roll — a round leaves
    expect(w.byId.p.dodgeT).not.toBeNull();          // still tumbling...
    expect(w.byId.p.invincible).toBe(false);         // ...but hittable — the i-frames are spent
    run(w, {}, 3, 1 / 60, FLAT);
    expect(w.byId.p.invincible).toBe(false);         // the per-frame assert respects the spent flag
    run(w, {}, 40, 1 / 60, FLAT);                    // the roll ends clean
    expect(w.byId.p.dodgeT).toBeNull();
  });
});

describe('clash event (2026-07-28 — mutual melee locks the pair, invincible, then separates)', () => {
  const FLAT = { ground: () => 0 };
  // two plain platform strikers facing each other — BOTH receive the global input (neither is
  // pilotable), so one fire tick throws BOTH forward thrusts and the blades meet mid-gap.
  const mkPair = (d = 10, reach = 12) => createWorld({ entities: [
    { id: 'a', rule: { type: 'platform', eye: 0, speed: 6, strike: 'melee', strikeDur: 0.5, strikeReach: reach, strikeDamage: 25 },
      body: { type: 'figure-rig', hittable: true, radius: 1, hp: 500, poise: 50, staggerDur: 1 },
      transform: { pos: [0, 0, 0], heading: 0 } },
    { id: 'b', rule: { type: 'platform', eye: 0, speed: 6, strike: 'melee', strikeDur: 0.5, strikeReach: reach, strikeDamage: 25 },
      body: { type: 'figure-rig', hittable: true, radius: 1, hp: 500, poise: 50, staggerDur: 1 },
      transform: { pos: [d, 0, 0], heading: Math.PI } },
  ] });

  it('mutual swings CLASH: locked face-to-face at the blade gap, invincible, no damage, big spark record', () => {
    const w = mkPair();
    run(w, {}, 5, 1 / 60, FLAT);
    stepWorld(w, { fire: 1, forward: 1 }, 1 / 60, FLAT);   // ONE tick: both open the forward thrust
    const a = w.byId.a, b = w.byId.b;
    expect(a.swingT).not.toBeNull();
    expect(b.swingT).not.toBeNull();
    run(w, {}, 12, 1 / 60, FLAT);                          // into the contact window → the blades meet
    expect(a.clashT).not.toBeNull();                       // the LOCK
    expect(b.clashT).not.toBeNull();
    expect(a.invincible).toBe(true);
    expect(b.invincible).toBe(true);
    expect(a.locomotion).toBe('swing_forward');            // both hold the forward-thrust read
    expect(b.locomotion).toBe('swing_forward');
    expect(a.body.hp).toBe(500);                           // the exchange trades NO damage
    expect(b.body.hp).toBe(500);
    expect(a.staggerT).toBeNull();                         // and arms no reaction
    // face-to-face at the lock gap ((reach+reach)·0.45 = 10.8), squared up along the pair line
    const dx = b.transform.pos[0] - a.transform.pos[0];
    expect(Math.abs(dx)).toBeCloseTo(10.8, 1);
    expect(Math.cos(a.transform.heading) * Math.sign(dx)).toBeGreaterThan(0.99);
    expect(Math.cos(b.transform.heading) * Math.sign(dx)).toBeLessThan(-0.99);
    // the opening burst rode the spark seam with the BIG count
    expect(w.clashes.some((c) => c.n === 40)).toBe(true);
  });

  it('the lock ENDS: shoved apart, mortal again, and free to move', () => {
    const w = mkPair();
    run(w, {}, 5, 1 / 60, FLAT);
    stepWorld(w, { fire: 1, forward: 1 }, 1 / 60, FLAT);
    run(w, {}, 12, 1 / 60, FLAT);                          // → locked
    expect(w.byId.a.clashT).not.toBeNull();
    run(w, {}, 60, 1 / 60, FLAT);                          // the 0.9s lock runs out
    const a = w.byId.a, b = w.byId.b;
    expect(a.clashT).toBeNull();
    expect(b.clashT).toBeNull();
    expect(a.invincible).toBe(false);
    expect(b.invincible).toBe(false);
    // the shove: each backed off HALF a gap → pair distance ≈ 2× the lock gap
    const sep = Math.abs(b.transform.pos[0] - a.transform.pos[0]);
    expect(sep).toBeGreaterThan(10.8 * 1.8);
    // free to move: forward input drives BOTH again (each along its own facing — apart)
    const ax0 = a.transform.pos[0];
    run(w, { forward: 1 }, 30, 1 / 60, FLAT);
    expect(a.transform.pos[0]).not.toBeCloseTo(ax0, 1);
  });

  it('no clash against a NON-swinging target — the normal hit lands (damage + stagger)', () => {
    const w = mkPair();
    run(w, {}, 5, 1 / 60, FLAT);
    w.byId.b.rule = { type: 'static' };                    // B stands inert — only A swings
    stepWorld(w, { fire: 1, forward: 1 }, 1 / 60, FLAT);
    run(w, {}, 12, 1 / 60, FLAT);
    expect(w.byId.a.clashT == null).toBe(true);            // no lock…
    expect(w.byId.b.hits).toBe(1);                         // …a real connect instead
    expect(w.byId.b.body.hp).toBe(475);
    expect(w.byId.b.reactClip).toBe('stagger');
  });
});

describe('overheat recovery (rev3 — overheat kills boost AND dodge until the bar is FULL, ~7.5s)', () => {
  const FLAT = { ground: () => 0 };
  // the standard combat-suit shape: gauge + overheat dodge (the proving-ground/arena tuning)
  const mkG = (over = {}) => createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, speed: 6, boostMax: 9, dodge: true, dodgeBoostCost: 2, ...over }, transform: { pos: [0, 0, 0], heading: 0 } }] });
  const tapTap = (w) => {
    stepWorld(w, { boost: 1, forward: 1 }, 1 / 60, FLAT);
    stepWorld(w, { forward: 1 }, 1 / 60, FLAT);
    stepWorld(w, { boost: 1, forward: 1 }, 1 / 60, FLAT);
  };

  it('dodging stays USABLE during ordinary partial-bar recovery (the rev2 full-bar gate is gone)', () => {
    const w = mkG();
    run(w, {}, 5, 1 / 60, FLAT);
    run(w, { boost: 1, forward: 1 }, 60, 1 / 60, FLAT);   // 1s of plain thrust — bar ~8/9, unlocked
    run(w, {}, 2, 1 / 60, FLAT);                          // release F so the double-tap has a fresh edge
    expect(w.byId.p.boost).toBeLessThan(9);
    expect(w.byId.p.boostLock).toBeFalsy();
    tapTap(w);                                            // mid-recovery double-tap…
    expect(w.byId.p.dodgeT).not.toBeNull();               // …ROLLS — regular boost use never parks the dodge
  });

  it('a dodge dump OVERHEATS: boost and dodge both dead until the bar recovers FULL (~7.5s)', () => {
    const w = mkG();
    run(w, {}, 5, 1 / 60, FLAT);
    tapTap(w);
    expect(w.byId.p.dodgeT).not.toBeNull();          // roll 1: gauge dumped + overheat-locked
    expect(w.byId.p.boost).toBeLessThan(0.1);        // dumped (~0; recharge starts immediately now — no release-to-recharge)
    expect(w.byId.p.boostLock).toBe(true);
    run(w, {}, 60 * 4, 1 / 60, FLAT);                // 4s in: bar ~4.8/9, STILL locked (no 15% unlock)
    expect(w.byId.p.boostLock).toBe(true);
    const x = w.byId.p.transform.pos[0];
    run(w, { boost: 1, forward: 1 }, 20, 1 / 60, FLAT);   // F mid-overheat: thrust is dead
    expect(w.byId.p.transform.pos[0] - x).toBeLessThan(3);   // walk-speed drift only, no 20/s dash
    run(w, {}, 2, 1 / 60, FLAT);                     // release F for a fresh double-tap edge
    tapTap(w);                                       // and the roll is refused
    expect(w.byId.p.dodgeT).toBeNull();
    run(w, {}, 60 * 4, 1 / 60, FLAT);                // past the ~7.5s climb: full → unlocked
    expect(w.byId.p.boost).toBeCloseTo(9, 5);
    expect(w.byId.p.boostLock).toBe(false);
    tapTap(w);
    expect(w.byId.p.dodgeT).not.toBeNull();          // recovered = dodge ready again
  });

  it('thrusting the gauge DRY overheats the same way — locked until full, no 15% early unlock', () => {
    const w = mkG();
    run(w, { boost: 1, forward: 1 }, 60 * 9 + 10, 1 / 60, FLAT);   // drain it dry by boosting
    expect(w.byId.p.boostLock).toBe(true);
    run(w, {}, 60 * 2, 1 / 60, FLAT);                // 2s cold: ~2.4/9 (27%) — old rule unlocked at 15%
    expect(w.byId.p.boostLock).toBe(true);           // rev3: still overheated
    tapTap(w);
    expect(w.byId.p.dodgeT == null).toBe(true);      // no roll either
    run(w, {}, 60 * 6, 1 / 60, FLAT);                // full → the outage ends
    expect(w.byId.p.boostLock).toBe(false);
    tapTap(w);
    expect(w.byId.p.dodgeT).not.toBeNull();
  });

  it('boostUnlockFrac stays a knob: pinning the old 0.15 restores the early-unlock hysteresis', () => {
    const w = mkG({ boostUnlockFrac: 0.15 });
    run(w, {}, 5, 1 / 60, FLAT);
    tapTap(w);
    expect(w.byId.p.boostLock).toBe(true);
    run(w, {}, 60 * 1.5, 1 / 60, FLAT);              // ~1.8/9 (20%) ≥ 15% → unlocked early
    expect(w.byId.p.boostLock).toBe(false);
  });
});

describe('boost-cancel melee (R22 — activating melee cuts the thrust and swings standing)', () => {
  const FLAT = { ground: () => 0 };
  const mk = (slot = {}, rule = {}) => createWorld({
    entities: [{
      id: 'p',
      rule: {
        type: 'platform', turnMode: 'look', eye: 0, speed: 6, boostSpeed: 20,
        loadout: [{ name: 'SABER', strike: 'melee', strikeCooldown: 2, strikeReach: 8, strikeDamage: 10, strikeCone: 75, ...slot }],
        ...rule,
      },
      transform: { pos: [0, 0, 0], heading: 0 },
    }],
  });

  it('a click mid-boost on a cooldown slot opens the swing, roots the body, and cuts the thrust', () => {
    const w = mk();
    run(w, { boost: 1, forward: 1 }, 30, 1 / 60, FLAT);      // ground dash at 20/s
    const p = w.byId.p;
    const xAt = p.transform.pos[0];
    expect(xAt).toBeGreaterThan(5);
    stepWorld(w, { boost: 1, forward: 1, fire: 1 }, 1 / 60, FLAT);
    expect(p.swingT).not.toBeNull();                         // the swing opened mid-boost
    expect(p.boostCut).toBe(true);                           // the thrust is cut
    run(w, { boost: 1, forward: 1 }, 30, 1 / 60, FLAT);      // F+W held right through the swing
    expect(p.swingT).not.toBeNull();                         // held F no longer cancels the swing it opened
    expect(p.transform.pos[0]).toBeCloseTo(xAt, 5);          // rooted, like a standing swing
  });

  it('the cancel is a cancel: F held past the swing stays dead; release + re-press dashes again', () => {
    const w = mk();
    run(w, { boost: 1, forward: 1 }, 30, 1 / 60, FLAT);
    const p = w.byId.p;
    stepWorld(w, { boost: 1, forward: 1, fire: 1 }, 1 / 60, FLAT);
    run(w, { boost: 1, forward: 1 }, 70, 1 / 60, FLAT);      // swing (0.9s) completes with F still held
    expect(p.swingT).toBeNull();
    const xAfter = p.transform.pos[0];
    run(w, { boost: 1 }, 30, 1 / 60, FLAT);                  // plain F held: the thruster stays dead (no dash)
    expect(p.transform.pos[0]).toBeCloseTo(xAfter, 5);
    run(w, {}, 2, 1 / 60, FLAT);                             // release F → the cut re-arms
    expect(p.boostCut).toBe(false);
    run(w, { boost: 1 }, 30, 1 / 60, FLAT);                  // fresh press → dashing again (plain F = forward)
    expect(p.transform.pos[0]).toBeGreaterThan(xAfter + 5);
  });

  it('no strikeCooldown on the slot → the mid-boost click is refused and the dash continues', () => {
    const w = mk({ strikeCooldown: 0 });
    run(w, { boost: 1, forward: 1 }, 30, 1 / 60, FLAT);
    const p = w.byId.p;
    const xAt = p.transform.pos[0];
    stepWorld(w, { boost: 1, forward: 1, fire: 1 }, 1 / 60, FLAT);
    expect(p.swingT == null).toBe(true);                     // no cooldown pacing it → no cancel
    expect(p.boostCut).toBeFalsy();
    run(w, { boost: 1, forward: 1 }, 10, 1 / 60, FLAT);
    expect(p.transform.pos[0]).toBeGreaterThan(xAt + 2);     // still dashing
  });

  it('a spent fist eats the mid-boost click too — no swing, no cancel', () => {
    const w = mk();
    const p = w.byId.p;
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);                 // standing whiff arms the 2s cooldown
    run(w, {}, 60, 1 / 60, FLAT);
    expect(p.strikeCdT).toBeGreaterThan(1);
    run(w, { boost: 1, forward: 1 }, 10, 1 / 60, FLAT);
    const xAt = p.transform.pos[0];
    stepWorld(w, { boost: 1, forward: 1, fire: 1 }, 1 / 60, FLAT);
    expect(p.swingT).toBeNull();                             // eaten by the cooldown
    expect(p.boostCut).toBeFalsy();
    run(w, { boost: 1, forward: 1 }, 10, 1 / 60, FLAT);
    expect(p.transform.pos[0]).toBeGreaterThan(xAt + 2);     // still dashing
  });

  it('from the hover cushion the strike PLANTS the suit — instant standing, the swing survives', () => {
    const w = mk({}, { boostHover: 5, collideRadius: 1, collideHeight: 24 });
    const p = w.byId.p;
    run(w, { boost: 1, forward: 1 }, 60, 1 / 60, FLAT);      // hover-boosting at the cushion
    expect(p.hovering).toBe(true);
    expect(p.transform.pos[2]).toBeCloseTo(5, 2);
    stepWorld(w, { boost: 1, forward: 1, fire: 1 }, 1 / 60, FLAT);
    expect(p.swingT).not.toBeNull();
    expect(p.transform.pos[2]).toBeCloseTo(0, 2);            // the cushion collapsed — planted at the ground
    expect(p.grounded).toBe(true);
    run(w, { boost: 1, forward: 1 }, 50, 1 / 60, FLAT);      // most of the swing, F still held
    expect(p.swingT).not.toBeNull();                         // ran grounded, never cancelled
    run(w, { boost: 1, forward: 1 }, 20, 1 / 60, FLAT);
    expect(p.swingT).toBeNull();                             // and completed
  });

  it('an airborne boost-jump arc still refuses the swing (no footing, no cushion)', () => {
    const w = mk({}, { jumpSpeed: 12, gravity: 30 });
    const p = w.byId.p;
    stepWorld(w, { jump: 1, jumpHeld: 1, forward: 1 }, 1 / 60, FLAT);          // launch
    run(w, { jumpHeld: 1, boost: 1, forward: 1 }, 10, 1 / 60, FLAT);           // boosting mid-arc
    expect(p.grounded).toBe(false);
    stepWorld(w, { jumpHeld: 1, boost: 1, forward: 1, fire: 1 }, 1 / 60, FLAT);
    expect(p.swingT == null).toBe(true);                     // refused in the air
  });
});

describe('projectile contact is SWEPT (R20 — a fast shell cannot tunnel through the egg)', () => {
  const FLAT = { ground: () => 0 };
  it('a shell crossing the whole egg width in one fixed step still bursts ON the target', () => {
    // speed 600 @60fps = 10u per step; the egg is 4u wide (a=2) and sits between the step's
    // sample points (x=27, samples land at 10/20/30) — a point test would fly straight through.
    const w = createWorld({
      entities: [
        {
          id: 'p', rule: { type: 'platform', eye: 0, turnMode: 'look' }, transform: { pos: [0, 0, 0], heading: 0 },
          weapon: { fireClass: 'lob', projectileSpeed: 600, projectileGravity: 0, lobAngle: 0, splashRadius: 2, projRadius: 0.3, damage: 10, eye: 5, armTime: 0, fuse: 2 },
        },
        { id: 'tg', transform: { pos: [27, 0, 0] }, body: { type: 'mesh', hittable: true, egg: { a: 2, c: 5 }, hp: 100, poise: 50 }, rule: { type: 'static' } },
      ],
    });
    stepWorld(w, { fire: 1 }, 1 / 60, FLAT);
    run(w, {}, 30, 1 / 60, FLAT);
    expect(w.byId.tg.hits).toBe(1);                        // the swept segment caught the crossing
    expect(w.byId.tg.staggerT).not.toBeNull();             // burst = unconditional poise-break
    expect(w.byId.tg.body.hp).toBe(90);
  });
});

describe('lateral blocking (world.colliders — the blocker under the skin)', () => {
  const FLAT = { ground: () => 0 };                        // flat floor at z=0
  // a suit facing +x that walks forward; a wall box straddling its path.
  const suit = (pos = [0, 0, 0]) => ({ id: 's', rule: { type: 'platform', eye: 0, speed: 6, collideRadius: 1, collideHeight: 24 }, transform: { pos, heading: 0 } });

  it('a wall STOPS the suit (footprint ejected, cannot pass through the side)', () => {
    const wall = { min: [8, -10, 0], max: [20, 10, 40] };  // tall wall from x=8
    const w = createWorld({ entities: [suit()], colliders: [wall] });
    run(w, { forward: 1 }, 180, 1 / 60, FLAT);             // 3s — would reach x≈18 unblocked
    const p = w.byId.s.transform.pos;
    expect(p[0]).toBeLessThan(7.5);                        // stopped at the near face (8) minus radius (1)
    expect(p[0]).toBeGreaterThan(6.5);
    expect(Math.abs(p[1])).toBeLessThan(0.5);              // no sideways drift
  });

  it('a RAISED slab is walked UNDER (body clears beneath it)', () => {
    const slab = { min: [-5, -10, 36], max: [5, 10, 41] };  // hangar roof: z 36..41
    const w = createWorld({ entities: [suit([-20, 0, 0])], colliders: [slab] });
    run(w, { forward: 1 }, 300, 1 / 60, FLAT);             // 5s — passes under x=0
    expect(w.byId.s.transform.pos[0]).toBeGreaterThan(8);  // sailed past the slab's far wall (x=5), no block
  });

  it('standing ON TOP is not shoved off (ground hook owns the roof; lateral gate skips)', () => {
    const box = { min: [5, -10, 0], max: [15, 10, 20] };   // a 20-tall block
    const ON = { ground: () => 20 };                       // floor raised to the box top
    const w = createWorld({ entities: [suit([0, 0, 20])], colliders: [box] });
    run(w, { forward: 1 }, 240, 1 / 60, ON);               // walk across the rooftop
    expect(w.byId.s.transform.pos[0]).toBeGreaterThan(16); // crossed the box freely on top
  });

  it('no colliders → movement is byte-identical (the seam is opt-in)', () => {
    const a = createWorld({ entities: [suit()] });
    const b = createWorld({ entities: [suit()], colliders: [] });
    run(a, { forward: 1 }, 120, 1 / 60, FLAT);
    run(b, { forward: 1 }, 120, 1 / 60, FLAT);
    expect(b.byId.s.transform.pos[0]).toBe(a.byId.s.transform.pos[0]);
  });
});

describe('shot occlusion (cover — colliders block shots, not just movement)', () => {
  // shooter at origin aiming +X; a hittable target downrange; an optional wall between them.
  const scene = (weapon, targetPos, colliders) => createWorld({
    entities: [
      { id: 'gun', rule: { type: 'static' }, transform: { pos: [0, 0, 1], heading: 0, pitch: 0 }, weapon },
      { id: 'tgt', rule: { type: 'static' }, transform: { pos: targetPos }, body: { type: 'mesh', hittable: true, radius: 1, hp: 200, poise: 100, staggerDur: 1 } },
    ],
    colliders,
  });
  const wall = { min: [10, -10, 0], max: [13, 10, 40] };   // a wall at x≈10, tall

  it('a HITSCAN shot is eaten by a wall on the sightline (no hit; tracer stops at the wall)', () => {
    const w = scene({ fireClass: 'sight', magazine: 8, cooldown: 0.5, coreAngle: 2, range: 100, damage: 20, impact: 40 }, [24, 0, 1], [wall]);
    run(w, { fire: 1 }, 1);
    expect(w.byId.gun.lastShot.mode).toBe('miss');          // blocked, not a hit
    expect(w.byId.tgt.hits).toBe(0);
    expect(w.byId.gun.lastShot.to[0]).toBeCloseTo(10, 0);   // tracer stopped at the near wall face (x≈10)
  });

  it('the SAME shot with no wall lands a core hit (the block is the only difference)', () => {
    const w = scene({ fireClass: 'sight', magazine: 8, cooldown: 0.5, coreAngle: 2, range: 100, damage: 20, impact: 40 }, [24, 0, 1], null);
    run(w, { fire: 1 }, 1);
    expect(w.byId.gun.lastShot.mode).toBe('core');
    expect(w.byId.tgt.hits).toBe(1);
  });

  it('a PROJECTILE bursts on the wall short of the target (target unhit behind cover)', () => {
    const w = scene({ fireClass: 'lob', magazine: 4, projectileSpeed: 60, projectileGravity: 2, splashRadius: 3, projRadius: 0.6, damage: 80, armTime: 0.02 }, [24, 0, 1], [wall]);
    run(w, { fire: 1 }, 1);
    run(w, { fire: 0 }, 40);
    expect(w.byId.tgt.hits).toBe(0);                        // shell detonated on the wall, not the suit
    expect(w.byId.tgt.staggerT).toBeNull();
    expect(w.bursts.length).toBe(1);                        // it DID burst — on the wall
    expect(w.bursts[0].pos[0]).toBeCloseTo(10, 0);          // at the near wall face
  });

  it('a target with a CLEAR sightline beside the wall is hittable (cover is positional)', () => {
    const tgt = [24, 20, 1];
    const heading = Math.atan2(tgt[1], tgt[0]);            // aim straight at the target
    const w = createWorld({
      entities: [
        { id: 'gun', rule: { type: 'static' }, transform: { pos: [0, 0, 1], heading, pitch: 0 }, weapon: { fireClass: 'sight', magazine: 8, cooldown: 0.5, coreAngle: 3, range: 100, damage: 20, impact: 40 } },
        { id: 'tgt', rule: { type: 'static' }, transform: { pos: tgt }, body: { type: 'mesh', hittable: true, radius: 1, hp: 200, poise: 100, staggerDur: 1 } },
      ],
      colliders: [{ min: [10, -10, 0], max: [13, 0, 40] }],  // wall entirely on the −y side of the sightline
    });
    run(w, { fire: 1 }, 1);
    expect(w.byId.gun.lastShot.mode).toBe('core');
    expect(w.byId.tgt.hits).toBe(1);
  });
});

describe('R19: the egg hitbox (aim AT the body) + boost tilt', () => {
  // shooter aims +X from height 3; the egg foe's centre sits at z=3 (feet at 0, cz=c=3).
  const eggFoe = (extra = {}) => ({ id: 'foe', rule: { type: 'static' }, transform: { pos: [10, 0, 0], heading: 0 },
    body: { type: 'figure-rig', hittable: true, egg: { a: 0.5, c: 3 }, hp: 500, poise: 100, staggerDur: 1, ...extra } });
  const rifle = { fireClass: 'sight', auto: true, cooldown: 0, rof: 60, coreAngle: 1, range: 200, damage: 5, eye: 0 };

  it('a dead-on shot HITS the narrow egg (core)', () => {
    const w = createWorld({ entities: [
      { id: 'gun', rule: { type: 'static' }, transform: { pos: [0, 0, 3], heading: 0, pitch: 0 }, weapon: rifle }, eggFoe(),
    ] });
    run(w, { fire: 1 }, 2);
    expect(w.byId.gun.lastShot.mode).toBe('core');
  });

  it('an off-axis shot MISSES the narrow egg where a fat legacy sphere would HIT (fairness)', () => {
    const yaw = Math.atan2(1.2, 10);   // ~1.2u to the side at x=10 — outside a=0.5, inside a radius-2 sphere
    const gun = { id: 'gun', rule: { type: 'static' }, transform: { pos: [0, 0, 3], heading: yaw, pitch: 0 }, weapon: rifle };
    const egg = createWorld({ entities: [gun, eggFoe()] });
    run(egg, { fire: 1 }, 2);
    expect(egg.byId.gun.lastShot.mode).toBe('miss');
    const sphere = createWorld({ entities: [gun,
      { id: 'foe', rule: { type: 'static' }, transform: { pos: [10, 0, 3] }, body: { type: 'mesh', hittable: true, radius: 2 } }] });
    run(sphere, { fire: 1 }, 2);
    expect(sphere.byId.gun.lastShot.mode).toBe('core');
  });

  it('boost TILT: a near-top shot that HITS the upright suit MISSES once it leans into boost', () => {
    const mk = () => createWorld({ entities: [
      { id: 'gun', rule: { type: 'static' }, transform: { pos: [0, 0, 0], heading: 0, pitch: Math.atan2(5.8, 10) }, weapon: rifle }, eggFoe(),
    ] });
    const upright = mk(); run(upright, { fire: 1 }, 2);
    expect(upright.byId.gun.lastShot.mode).toBe('core');       // ray grazes the upright top
    const leaning = mk();
    for (let i = 0; i < 2; i++) { leaning.byId.foe.locomotion = 'boost'; stepWorld(leaning, { fire: 1 }, 1 / 60); }
    expect(leaning.byId.gun.lastShot.mode).toBe('miss');       // the top ducks forward out of the ray
  });
});

describe('R19: destructible shields (frontal, flankable, break→stagger)', () => {
  const gun = (weapon) => ({ id: 'gun', rule: { type: 'static' }, transform: { pos: [0, 0, 0], heading: 0, pitch: 0 }, weapon });
  const foe = (heading, shield) => ({ id: 'foe', rule: { type: 'static' }, transform: { pos: [10, 0, 0], heading },
    body: { type: 'figure-rig', hittable: true, egg: { a: 0.6, c: 3 }, hp: 500, poise: 100, staggerDur: 1, shield } });
  const rifle = { fireClass: 'sight', auto: true, cooldown: 0, rof: 60, coreAngle: 1, range: 200, damage: 5, eye: 3 };

  it('a FRONTAL shield ABSORBS fire with no hp loss', () => {
    const w = createWorld({ entities: [gun(rifle), foe(Math.PI, { hp: 30, arc: 120 })] });   // foe faces the shooter → covered
    run(w, { fire: 1 }, 3);                          // 3 shots × 5 = 15 drained
    expect(w.byId.foe.shieldHp).toBe(15);
    expect(w.byId.foe.body.hp).toBe(500);            // nothing leaked through the shield
    expect(w.byId.foe.shieldBroken).toBe(false);
  });

  it('breaking the shield STAGGERS the suit (the punish window)', () => {
    const w = createWorld({ entities: [gun(rifle), foe(Math.PI, { hp: 20, arc: 120 })] });
    run(w, { fire: 1 }, 4);                          // 20 drained → break on the 4th shot
    expect(w.byId.foe.shieldBroken).toBe(true);
    expect(w.byId.foe.shieldHp).toBe(0);
    expect(w.byId.foe.reactClip).toBe('stagger');
    expect(w.byId.foe.locomotion).toBe('stagger');
    expect(w.byId.foe.staggerT).not.toBeNull();
  });

  it('a FLANK shot bypasses the shield and hits the suit normally', () => {
    const w = createWorld({ entities: [gun(rifle), foe(0, { hp: 30, arc: 120 })] });   // foe faces AWAY (+X) → shooter is behind it
    run(w, { fire: 1 }, 3);
    expect(w.byId.foe.shieldHp).toBe(30);            // shield untouched — the shots came from behind the arc
    expect(w.byId.foe.body.hp).toBeLessThan(500);    // the suit took them
  });
});

describe('match layer (arena M1 — kills credited, the fallen respawn, first to killTarget wins)', () => {
  const FLAT = { ground: () => 0 };
  // a piloted suit with an auto rifle that one-shots the foe (damage ≥ hp), and an ai foe that
  // never pulls its own trigger (burst 0) so the bout is one-sided and deterministic.
  const mk = (matchOver = {}, foePos = [30, 0, 0]) => createWorld({
    pilot: 'me',
    match: { killTarget: 2, respawnDelay: 0.5, iFrames: 0.4, ...matchOver },
    entities: [
      {
        id: 'me', pilotable: true, ambient: { type: 'clock' },
        rule: { type: 'platform', turnMode: 'look', eye: 0, speed: 6 },
        transform: { pos: [0, 0, 0], heading: 0 },
        body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 200, poise: 100, poiseRegen: 20, staggerDur: 1 },
        weapon: { fireClass: 'sight', auto: true, rof: 10, magazine: 30, reload: 1, coreAngle: 45, range: 200, damage: 100, impact: 10, eye: 0 },
      },
      {
        id: 'foe', pilotable: true,
        ambient: { type: 'ai', speed: 0, turn: 6, standoff: 60, burst: 0, pause: 1, dodge: false },
        rule: { type: 'platform', turnMode: 'look', eye: 0 },
        transform: { pos: foePos, heading: Math.PI },
        body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 100, poise: 50, poiseRegen: 20, staggerDur: 0.6 },
        weapon: { fireClass: 'sight', auto: false, cooldown: 0.3, magazine: 30, reload: 1, coreAngle: 10, range: 100, damage: 5, impact: 10, eye: 0 },
      },
    ],
  });

  it('a kill is credited to the last hitter and opens the corpse window (unhittable while down)', () => {
    const w = mk();
    expect(w.match.kills).toEqual({ me: 0, foe: 0 });      // contenders pre-seeded
    run(w, { fire: 1 }, 3, 1 / 60, FLAT);                  // one auto shot lands, damage 100 ≥ hp 100
    const foe = w.byId.foe;
    expect(foe.downed).toBe(true);
    expect(w.match.kills.me).toBe(1);
    expect(w.match.feed.at(-1)).toMatchObject({ killer: 'me', victim: 'foe' });
    expect(foe.body.hittable).toBe(false);                 // the wreck takes no further hits
    const hits = foe.hits;
    run(w, { fire: 1 }, 12, 1 / 60, FLAT);                 // keep shooting the corpse
    expect(foe.hits).toBe(hits);                           // nothing lands, nothing farms
  });

  it('a death with no hitter credits nobody (downed edge without attribution)', () => {
    const w = mk();
    const foe = w.byId.foe;
    foe.body.hp = 0; foe.downed = true;                    // an unattributed collapse
    run(w, {}, 1, 1 / 60, FLAT);
    expect(w.match.kills.me).toBe(0);
    expect(w.match.kills.foe).toBe(0);
    expect(foe.deadAt).not.toBeNull();                     // still counted as down (it will respawn)
  });

  it('the fallen respawns after respawnDelay: full hp/poise/ammo, spawn protection, farthest spawn', () => {
    const w = mk({ spawns: [[8, 0, 0], [-50, 0, 0]] });    // me sits at 0 → [-50] is farther
    run(w, { fire: 1 }, 3, 1 / 60, FLAT);
    const foe = w.byId.foe;
    foe.weapon.ammo = 3;                                   // pretend it spent its magazine this life
    expect(foe.downed).toBe(true);
    run(w, {}, 40, 1 / 60, FLAT);                          // > 0.5s — the respawn fires
    expect(foe.downed).toBe(false);
    expect(foe.body.hp).toBe(100);
    expect(foe.poise).toBe(50);
    expect(foe.body.hittable).toBe(true);
    expect(foe.weapon.ammo).toBe(30);                      // rearmed
    expect(foe.transform.pos[0]).toBeCloseTo(-50, 5);      // the farthest declared spawn
    expect(foe.invincible).toBe(true);                     // spawn protection still riding the wake guard
    const hits = foe.hits;
    run(w, { fire: 1 }, 3, 1 / 60, FLAT);                  // shots during the protection window
    expect(foe.hits).toBe(hits);
  });

  it('no declared spawns → the authored start pose is the respawn point', () => {
    const w = mk();
    run(w, { fire: 1 }, 3, 1 / 60, FLAT);
    w.byId.foe.transform.pos = [5, 5, 0];                  // the corpse slid somewhere else
    run(w, {}, 40, 1 / 60, FLAT);
    expect(w.byId.foe.transform.pos[0]).toBeCloseTo(30, 5);
    expect(w.byId.foe.transform.pos[1]).toBeCloseTo(0, 5);
  });

  it('first to killTarget ends the match: winner named, controls dead, ai down, no more respawns', () => {
    const w = mk({ iFrames: 0.05 });                       // short spawn window so the second kill lands fast
    run(w, { fire: 1 }, 3, 1 / 60, FLAT);                  // kill 1
    run(w, { fire: 1 }, 200, 1 / 60, FLAT);                // respawn at start pose (in the cone) → kill 2
    expect(w.match.kills.me).toBe(2);
    expect(w.match.over).toBe(true);
    expect(w.match.winner).toBe('me');
    expect(w.match.endedAt).toBeGreaterThan(0);
    // controls are dead: W moves nobody once the bout is decided
    const x0 = w.byId.me.transform.pos[0];
    run(w, { forward: 1 }, 60, 1 / 60, FLAT);
    expect(w.byId.me.transform.pos[0]).toBeCloseTo(x0, 5);
    // and the fallen stays fallen — the result tableau holds
    expect(w.byId.foe.downed).toBe(true);
    run(w, {}, 120, 1 / 60, FLAT);
    expect(w.byId.foe.downed).toBe(true);
  });

  it('score-screen stats accumulate at the adjudication sites: shots, on-target hits, hull damage, deaths', () => {
    const w = mk();
    expect(w.match.stats).toEqual({                        // contenders pre-seeded with zeroed rows
      me: { deaths: 0, dmg: 0, shots: 0, hits: 0 },
      foe: { deaths: 0, dmg: 0, shots: 0, hits: 0 },
    });
    run(w, { fire: 1 }, 3, 1 / 60, FLAT);                  // one landed auto shot kills the foe
    const s = w.match.stats;
    expect(s.me.shots).toBeGreaterThan(0);                 // rounds fired counted at the trigger
    expect(s.me.hits).toBeGreaterThan(0);                  // the connect counted at the hit site
    expect(s.me.hits).toBeLessThanOrEqual(s.me.shots);     // accuracy can never exceed 100%
    expect(s.me.dmg).toBe(100);                            // hull damage dealt, overkill clamped (foe hp 100)
    expect(s.foe.deaths).toBe(1);                          // the fall counted on the victim
    expect(s.me.deaths).toBe(0);
    expect(s.foe.shots).toBe(0);                           // the pacifist foe never fired
  });

  it('worlds without `match` keep death-is-final (no state.match, no respawn, corpse stays hittable)', () => {
    expect(createWorld({ entities: [] }).match).toBeNull();
    const w2 = mk();
    w2.match = null;                                       // simulate a matchless world state
    run(w2, { fire: 1 }, 3, 1 / 60, FLAT);
    const foe = w2.byId.foe;
    expect(foe.downed).toBe(true);
    run(w2, {}, 120, 1 / 60, FLAT);
    expect(foe.downed).toBe(true);                         // never respawns
    expect(foe.body.hittable).toBe(true);                  // the corpse window is match-only
  });
});

describe('spawn drop-in + fire-gated spawn guard (R24 — drop from the sky, invincible until you fire)', () => {
  const FLAT = { ground: () => 0 };
  const mk = (matchOver = {}) => createWorld({
    pilot: 'me',
    match: { killTarget: 5, respawnDelay: 0.3, ...matchOver },
    entities: [
      { id: 'me', pilotable: true, ambient: { type: 'clock' },
        rule: { type: 'platform', turnMode: 'look', eye: 0, speed: 6, boostSpeed: 30 },
        transform: { pos: [0, 0, 0], heading: 0 },
        body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 200, poise: 100, poiseRegen: 20, staggerDur: 1 },
        weapon: { fireClass: 'sight', auto: true, rof: 20, magazine: 99, reload: 1, coreAngle: 45, range: 200, damage: 10, impact: 5, eye: 0 } },
      { id: 'foe', pilotable: true,
        ambient: { type: 'ai', speed: 0, turn: 6, standoff: 60, burst: 0, pause: 1, dodge: false },
        rule: { type: 'platform', turnMode: 'look', eye: 0 },
        transform: { pos: [30, 0, 0], heading: Math.PI },
        body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 200, poise: 100, poiseRegen: 20, staggerDur: 0.6 } },   // no weapon → never fires
    ],
  });

  it('with dropHeight the contender spawns in the sky and falls to its spawn point', () => {
    const w = mk({ dropHeight: 100, dropSpeed: 60, fireGuard: true });
    const me = w.byId.me;
    expect(me.dropping).toBe(true);
    expect(me.transform.pos[2]).toBeCloseTo(100, 0);       // lifted into the sky above spawn z0
    expect(me.invincible).toBe(true);                       // spawn guard armed
    run(w, {}, 60, 1 / 60, FLAT);                           // 1s falling (60u/s)
    expect(me.transform.pos[2]).toBeGreaterThan(0);
    expect(me.transform.pos[2]).toBeLessThan(100);
    run(w, {}, 90, 1 / 60, FLAT);                           // land
    expect(me.dropping).toBe(false);
    expect(me.transform.pos[2]).toBeCloseTo(0, 4);
    expect(me.grounded).toBe(true);
  });

  it('control is SUPPRESSED mid-drop and returns the frame it lands', () => {
    const w = mk({ dropHeight: 60, dropSpeed: 30 });        // 2s drop
    const me = w.byId.me;
    run(w, { forward: 1, boost: 1 }, 30, 1 / 60, FLAT);     // holding forward WHILE falling
    expect(me.dropping).toBe(true);
    expect(me.transform.pos[0]).toBeCloseTo(0, 4);          // didn't move horizontally (rule suppressed)
    run(w, {}, 120, 1 / 60, FLAT);                          // finish the fall
    expect(me.dropping).toBe(false);
    run(w, { forward: 1 }, 20, 1 / 60, FLAT);               // now drive it
    expect(me.transform.pos[0]).toBeGreaterThan(1);         // control works after landing
  });

  it('fireGuard: the fresh suit is invincible until it FIRES, then vulnerable', () => {
    const w = mk({ fireGuard: true });                      // dropHeight 0 → no drop, pure fire-guard
    const me = w.byId.me;
    expect(me.spawnGuard).toBe(true);
    expect(me.invincible).toBe(true);
    run(w, { fire: 1 }, 2, 1 / 60, FLAT);                   // me shoots
    expect(me.spawnGuard).toBe(false);
    expect(me.invincible).toBe(false);
  });

  it('a spawn-guarded suit takes NO damage until it fires (a non-shooter stays untouchable)', () => {
    const w = mk({ fireGuard: true });
    const foe = w.byId.foe;                                 // the foe carries no weapon → never fires → guard holds
    run(w, { fire: 1 }, 40, 1 / 60, FLAT);                  // me pours fire into the dead-ahead foe
    expect(foe.spawnGuard).toBe(true);
    expect(foe.hits).toBe(0);
    expect(foe.body.hp).toBe(200);
  });

  it('space: no drop (no ground) but the fire-guard still holds and breaks on fire', () => {
    const w = createWorld({
      pilot: 'me',
      match: { killTarget: 5, fireGuard: true, dropHeight: 100, dropSpeed: 60 },
      entities: [
        { id: 'me', pilotable: true, ambient: { type: 'clock' },
          rule: { type: 'platform', space: true, turnMode: 'look', eye: 0 },
          transform: { pos: [0, 0, 50], heading: 0 },
          body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 200, poise: 100 },
          weapon: { fireClass: 'sight', auto: true, rof: 10, magazine: 30, coreAngle: 45, range: 200, damage: 5, impact: 5, eye: 0 } },
      ],
    });
    const me = w.byId.me;
    expect(me.dropping).toBe(false);                        // space → no drop
    expect(me.transform.pos[2]).toBeCloseTo(50, 5);         // not lifted
    expect(me.invincible).toBe(true);                       // fire-guard holds
    run(w, { fire: 1 }, 2, 1 / 60, FLAT);
    expect(me.spawnGuard).toBe(false);                      // firing breaks it in space too
  });

  it('a RESPAWN drops from the sky too', () => {
    const w = mk({ dropHeight: 80, dropSpeed: 40, fireGuard: true });
    const foe = w.byId.foe;
    run(w, {}, 140, 1 / 60, FLAT);                          // everyone drops in and lands
    expect(foe.dropping).toBe(false);
    foe.body.hp = 0; foe.downed = true;                     // fell (killTarget 5 → match not over)
    run(w, {}, 30, 1 / 60, FLAT);                           // > respawnDelay 0.3
    expect(foe.downed).toBe(false);
    expect(foe.dropping).toBe(true);                        // respawned back up in the sky
    expect(foe.transform.pos[2]).toBeGreaterThan(40);
    expect(foe.invincible).toBe(true);
  });

  it('the fire-guard is CAPPED — a fresh suit that never shoots loses it after ~5s (R26 anti-camp)', () => {
    const w = mk({ fireGuard: true });                      // dropHeight 0 → no drop, the cap counts from spawn
    const me = w.byId.me;
    expect(me.invincible).toBe(true);
    run(w, {}, 60 * 4, 1 / 60, FLAT);                       // 4s, never firing
    expect(me.spawnGuard).toBe(true);                       // still guarded under the 5s cap
    expect(me.invincible).toBe(true);
    run(w, {}, 60 * 2, 1 / 60, FLAT);                       // past 5s total
    expect(me.spawnGuard).toBe(false);                      // the cap expired the shield
    expect(me.invincible).toBe(false);
  });

  it('the 5s cap counts only AFTER landing — the drop does not eat the window', () => {
    const w = mk({ fireGuard: true, dropHeight: 120, dropSpeed: 60 });   // ~2s drop
    const me = w.byId.me;
    run(w, {}, 132, 1 / 60, FLAT);                          // 2.2s → landed
    expect(me.dropping).toBe(false);
    run(w, {}, 60 * 4, 1 / 60, FLAT);                       // 4s post-landing (< 5s) — the drop time didn't count
    expect(me.spawnGuard).toBe(true);
    run(w, {}, 90, 1 / 60, FLAT);                           // +1.5s → >5s post-landing
    expect(me.spawnGuard).toBe(false);                      // expired ~5s AFTER control returned, not after spawn
  });

  it('firing still breaks the shield EARLY, before the cap', () => {
    const w = mk({ fireGuard: true });
    const me = w.byId.me;
    run(w, {}, 60, 1 / 60, FLAT);                           // 1s in — well under the cap
    expect(me.spawnGuard).toBe(true);
    run(w, { fire: 1 }, 2, 1 / 60, FLAT);                   // shoot
    expect(me.spawnGuard).toBe(false);                      // broke on fire, not on the timer
    expect(me.invincible).toBe(false);
  });
});

describe('ai free-for-all targeting (arena M2 — target:"all" hunts the nearest live body)', () => {
  const FLAT = { ground: () => 0 };
  const suit = (id, pos, aiOver = {}) => ({
    id, pilotable: true,
    ambient: { type: 'ai', target: 'all', speed: 0, turn: 20, standoff: 5, burst: 0.5, pause: 0.5, dodge: false, ...aiOver },
    rule: { type: 'platform', turnMode: 'look', eye: 0 },
    transform: { pos, heading: 0 },
    body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 100, poise: 50 },
    weapon: { fireClass: 'sight', auto: false, cooldown: 0.2, magazine: 30, reload: 1, coreAngle: 10, range: 200, damage: 10, impact: 5, eye: 0 },
  });

  it('an ai suit turns on its NEAREST contender, not the pilot', () => {
    // pilot far away at +y; another ai suit close at +x — 'all' must face the close one.
    const w = createWorld({
      pilot: 'me',
      entities: [
        { ...suit('me', [0, 80, 0]), ambient: { type: 'clock' } },
        suit('a', [0, 0, 0]),
        suit('b', [20, 0, 0]),
      ],
    });
    run(w, {}, 60, 1 / 60, FLAT);                          // 1s of turning at turn 20
    const h = w.byId.a.transform.heading;
    expect(Math.abs(((h + Math.PI) % (2 * Math.PI)) - Math.PI)).toBeLessThan(0.15);   // facing +x (heading ~0), not +y (π/2)
  });

  it('ai suits FIGHT EACH OTHER: both land hits with zero player input', () => {
    const w = createWorld({
      pilot: 'me',
      entities: [
        { ...suit('me', [0, 500, 0]), ambient: { type: 'clock' } },   // pilot parked out of range
        suit('a', [0, 0, 0]),
        suit('b', [30, 0, 0]),
      ],
    });
    run(w, {}, 300, 1 / 60, FLAT);                         // 5s of the duel
    expect(w.byId.a.hits + w.byId.b.hits).toBeGreaterThan(0);   // somebody landed on somebody
    expect(w.byId.me.hits).toBe(0);                        // and nobody reached for the far pilot
  });

  it('a downed contender is skipped — the brain swings to the next-nearest', () => {
    const w = createWorld({
      pilot: 'me',
      entities: [
        { ...suit('me', [0, 40, 0]), ambient: { type: 'clock' } },
        suit('a', [0, 0, 0]),
        suit('b', [10, 0, 0]),
      ],
    });
    w.byId.b.downed = true;                                // the near one is a wreck
    run(w, {}, 90, 1 / 60, FLAT);
    const h = w.byId.a.transform.heading;
    expect(Math.abs(h - Math.PI / 2)).toBeLessThan(0.15);  // faces the pilot at +y instead
  });

  it("default targeting (no `target`) still hunts the pilot — R20 behavior unchanged", () => {
    const w = createWorld({
      pilot: 'me',
      entities: [
        { ...suit('me', [0, 40, 0]), ambient: { type: 'clock' } },
        suit('a', [0, 0, 0], { target: undefined }),
        suit('b', [10, 0, 0], { target: undefined }),
      ],
    });
    run(w, {}, 90, 1 / 60, FLAT);
    const h = w.byId.a.transform.heading;
    expect(Math.abs(h - Math.PI / 2)).toBeLessThan(0.15);  // faces the pilot, ignoring the closer 'b'
  });
});

describe('match layer fault containment (a scoring error disables the layer, never the sim)', () => {
  const FLAT = { ground: () => 0 };
  it('a throwing match layer quarantines itself; the world keeps stepping', () => {
    const w = createWorld({
      match: { killTarget: 5 },
      entities: [{
        id: 'h', rule: { type: 'walk', speed: 6 }, transform: { pos: [0, 0, 0], heading: 0 },
        body: { type: 'figure-rig', hittable: true, radius: 1, hp: 100, poise: 50 },
      }],
    });
    w.match.kills = null;                                  // corrupt the layer — stepMatch would throw
    run(w, { forward: 1 }, 60, 1 / 60, FLAT);
    expect(w.match.dead).toBe(true);                       // quarantined after the first throw…
    expect(w.byId.h.transform.pos[0]).toBeCloseTo(6, 1);   // …and the sim never missed a step
  });
});

describe('death burst (R34 — a defeated unit EXPLODES: no damage, bazooka-class splash stagger)', () => {
  // gun one-shots the victim (damage ≥ hp); the victim's death blast is the thing under test.
  // Victim egg c=6 → height 12 → blast R = 12·0.47 = 5.6u centred on the egg (z 6).
  const world = (bystanderY) => createWorld({
    entities: [
      { id: 'gun', rule: { type: 'static' }, transform: { pos: [0, 0, 6], heading: 0, pitch: 0 }, weapon: { fireClass: 'sight', magazine: 4, damage: 200, impact: 0 } },
      { id: 'victim', rule: { type: 'static' }, transform: { pos: [24, 0, 0] }, body: { type: 'figure-rig', hittable: true, egg: { a: 1, c: 6 }, hp: 100, poise: 100, staggerDur: 1 } },
      { id: 'bystander', rule: { type: 'static' }, transform: { pos: [24, bystanderY, 0] }, body: { type: 'figure-rig', hittable: true, egg: { a: 1, c: 6 }, hp: 200, poise: 100, staggerDur: 1 } },
    ],
  });

  it('the kill detonates: one burst record, the nearby suit STAGGERS but takes NO damage', () => {
    const w = world(6);                                   // 6u off — inside the 6.5u blast (egg-padded)
    run(w, { fire: 1 }, 1);
    run(w, { fire: 0 }, 2);
    expect(w.byId.victim.downed).toBe(true);              // the hitscan kill latched the wreck
    expect(w.bursts.length).toBe(1);                      // the DEATH burst (a hitscan makes no burst of its own)
    expect(w.bursts[0].radius).toBeCloseTo(6.5, 1);       // 0.54 × the victim's 12u height (+15%) — bazooka-class
    expect(w.byId.bystander.staggerT).not.toBeNull();     // shoved by the blast…
    expect(w.byId.bystander.body.hp).toBe(200);           // …but NOT damaged (the rule)
    expect(w.byId.bystander.downed).toBe(false);          // and never killed by it
  });

  it('one death = one blast (the latch holds across frames)', () => {
    const w = world(6);
    run(w, { fire: 1 }, 1);
    run(w, { fire: 0 }, 120);                             // two more seconds of wreck
    expect(w.burstSeq).toBe(1);                           // never re-detonates (bursts prune; the seq is monotonic)
  });

  it('outside the blast radius nothing staggers', () => {
    const w = world(12);                                  // 12u off — beyond 5.6 + egg pad
    run(w, { fire: 1 }, 1);
    run(w, { fire: 0 }, 2);
    expect(w.byId.victim.downed).toBe(true);
    expect(w.byId.bystander.staggerT).toBeNull();
  });
});

describe('teams (target:enemy + friendly fire off + team win — arena-menu-reframe S1)', () => {
  const FLAT = { ground: () => 0 };

  it('friendly fire is OFF — a hitscan shot passes through an ally and reaches the enemy behind', () => {
    const w = createWorld({
      pilot: 'me',
      entities: [
        { id: 'me', pilotable: true, ambient: { type: 'clock' }, team: 'a',
          rule: { type: 'platform', turnMode: 'look', eye: 0 },
          transform: { pos: [0, 0, 0], heading: 0, pitch: 0 },
          body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 200 },
          weapon: { fireClass: 'sight', auto: true, cooldown: 0, coreAngle: 45, range: 200, damage: 20, impact: 0, eye: 0 } },
        // an ally DIRECTLY in the line of fire, an enemy behind it — without teams the nearer ally
        // would be `best`; with teams it is never a candidate, so the shot lands on the enemy.
        { id: 'ally', team: 'a', rule: { type: 'static' }, transform: { pos: [10, 0, 0] }, body: { type: 'mesh', hittable: true, radius: 2, hp: 200, poise: 1000 } },
        { id: 'enemy', team: 'b', rule: { type: 'static' }, transform: { pos: [20, 0, 0] }, body: { type: 'mesh', hittable: true, radius: 2, hp: 200, poise: 1000 } },
      ],
    });
    run(w, { fire: 1 }, 60, 1 / 60, FLAT);
    expect(w.byId.ally.hits).toBe(0);                     // an ally is never a hit candidate
    expect(w.byId.ally.body.hp).toBe(200);
    expect(w.byId.enemy.hits).toBeGreaterThan(0);         // the shot reaches the enemy behind it
    expect(w.byId.enemy.body.hp).toBeLessThan(200);
  });

  it('a friendly BEAM staggers the ally it passes through (no damage) yet still reaches the enemy behind', () => {
    const w = createWorld({
      pilot: 'me',
      entities: [
        { id: 'me', pilotable: true, ambient: { type: 'clock' }, team: 'a',
          rule: { type: 'platform', turnMode: 'look', eye: 0 },
          transform: { pos: [0, 0, 0], heading: 0, pitch: 0 },
          body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 300 },
          weapon: { fireClass: 'sight', auto: true, cooldown: 0, coreAngle: 45, range: 200, damage: 20, impact: 100, eye: 0 } },
        // ally in front (breakable poise), enemy behind (huge poise so it never staggers, just bleeds hp)
        { id: 'ally', team: 'a', rule: { type: 'static' }, transform: { pos: [10, 0, 0] }, body: { type: 'mesh', hittable: true, radius: 2, hp: 300, poise: 50, staggerDur: 1 } },
        { id: 'enemy', team: 'b', rule: { type: 'static' }, transform: { pos: [20, 0, 0] }, body: { type: 'mesh', hittable: true, radius: 2, hp: 300, poise: 1000, staggerDur: 1 } },
      ],
    });
    run(w, { fire: 1 }, 12, 1 / 60, FLAT);
    expect(w.byId.ally.body.hp).toBe(300);               // NO friendly damage
    expect(w.byId.ally.hits).toBe(0);                    // and no attribution
    expect(w.byId.ally.staggerT).not.toBeNull();         // but the beam ROCKED the ally
    expect(w.byId.enemy.body.hp).toBeLessThan(300);      // the beam still passed through to the enemy
  });

  it('a friendly SPLASH staggers a nearby ally without hurting them (a shell bursts beside a teammate)', () => {
    // a static launcher lifted to z=10 (a z=0 shell detonates on the implicit floor); the shell bursts on
    // the enemy, and the ally 4u away is caught in the 7u splash.
    const w = createWorld({
      entities: [
        { id: 'gun', team: 'a', rule: { type: 'static' }, transform: { pos: [0, 0, 10], heading: 0, pitch: 0 },
          weapon: { fireClass: 'lob', magazine: 4, projectileSpeed: 60, projectileGravity: 0, lobAngle: 0, splashRadius: 7, projRadius: 0.6, damage: 120, impact: 100, armTime: 0.05, fuse: 4, cooldown: 0.5, eye: 0 } },
        { id: 'enemy', team: 'b', rule: { type: 'static' }, transform: { pos: [16, 0, 10] }, body: { type: 'mesh', hittable: true, radius: 2, hp: 300, poise: 100, staggerDur: 1 } },
        { id: 'ally', team: 'a', rule: { type: 'static' }, transform: { pos: [16, 4, 10] }, body: { type: 'mesh', hittable: true, radius: 2, hp: 300, poise: 60, staggerDur: 1 } },
      ],
    });
    run(w, { fire: 1 }, 40);
    expect(w.byId.ally.body.hp).toBe(300);               // caught in the blast, took NO damage
    expect(w.byId.ally.staggerT).not.toBeNull();         // but was staggered by it
    expect(w.byId.enemy.body.hp).toBeLessThan(300);      // the enemy took the hit
  });

  it('an AI on target:enemy hunts the enemy, never the nearer ally', () => {
    const w = createWorld({
      entities: [
        { id: 'shooter', team: 'a',
          rule: { type: 'ai', speed: 12, turn: 6, standoff: 15, fireArc: 24, burst: 2, pause: 0.2, target: 'enemy' },
          transform: { pos: [0, 0, 0], heading: 0 },
          body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 300, poise: 1000 },
          weapon: { fireClass: 'sight', auto: false, cooldown: 0.1, magazine: 999, reload: 1, coreAngle: 30, range: 300, damage: 10, impact: 0, eye: 0 } },
        { id: 'ally', team: 'a', rule: { type: 'static' }, transform: { pos: [8, 0, 0] }, body: { type: 'mesh', hittable: true, radius: 2, hp: 300, poise: 1000 } },
        { id: 'enemy', team: 'b', rule: { type: 'static' }, transform: { pos: [40, -2, 0] }, body: { type: 'mesh', hittable: true, radius: 2, hp: 300, poise: 1000 } },
      ],
    });
    run(w, {}, 300, 1 / 60, FLAT);                        // 5s, zero global input
    expect(w.byId.ally.hits).toBe(0);                     // the ally is skipped as target AND as hit candidate
    expect(w.byId.enemy.hits).toBeGreaterThan(0);         // it closed on + shot the enemy
  });

  it('team win: a kill credits the killer TEAM and the first team to killTarget wins', () => {
    const w = createWorld({
      match: { killTarget: 1, respawnDelay: 999, teamNames: { a: 'BLUE', b: 'RED' } },
      entities: [
        { id: 'a1', team: 'a', rule: { type: 'static' }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', hittable: true, radius: 1, hp: 200, poise: 100, staggerDur: 1 } },
        { id: 'b1', team: 'b', rule: { type: 'static' }, transform: { pos: [10, 0, 0] }, body: { type: 'mesh', hittable: true, radius: 1, hp: 200, poise: 100, staggerDur: 1 } },
      ],
    });
    expect(w.match.teamMode).toBe(true);
    expect(w.match.teamKills).toEqual({ a: 0, b: 0 });
    w.byId.b1.downed = true; w.byId.b1.lastHitBy = 'a1';  // b1 falls to a1
    stepWorld(w, {}, 1 / 60, FLAT);
    expect(w.match.teamKills.a).toBe(1);
    expect(w.match.over).toBe(true);
    expect(w.match.winnerTeam).toBe('a');
    expect(w.match.winner).toBe('a1');                    // the finishing pilot still rides the kill-feed seam
  });

  it('no team tags → per-individual win, teamMode off (byte-identical match)', () => {
    const w = createWorld({
      match: { killTarget: 1 },
      entities: [
        { id: 'x', rule: { type: 'static' }, transform: { pos: [0, 0, 0] }, body: { type: 'mesh', hittable: true, radius: 1, hp: 100, poise: 100, staggerDur: 1 } },
        { id: 'y', rule: { type: 'static' }, transform: { pos: [5, 0, 0] }, body: { type: 'mesh', hittable: true, radius: 1, hp: 100, poise: 100, staggerDur: 1 } },
      ],
    });
    expect(w.match.teamMode).toBe(false);
    w.byId.y.downed = true; w.byId.y.lastHitBy = 'x';
    stepWorld(w, {}, 1 / 60, FLAT);
    expect(w.match.winner).toBe('x');
    expect(w.match.winnerTeam).toBe(null);
  });
});

describe('tackle-counter cinematic (the shove-down set piece — tackle-cinematic.plan.md)', () => {
  const FLAT = { ground: () => 0 };
  const mk = () => {
    const w = createWorld({
      pilot: 'me',
      camera: { rule: 'follow', target: 'me', dist: 6, height: 3, lerp: 8, transform: { pos: [-6, 0, 3] } },
      entities: [
        { id: 'me', pilotable: true, ambient: { type: 'clock' },
          rule: { type: 'platform', turnMode: 'look', eye: 0, speed: 6, tackle: true, tackleReach: 8, boostMax: 100, counterDamage: 0 },
          transform: { pos: [0, 0, 0], heading: 0 },
          body: { type: 'figure-rig', hittable: true, collide: { a: 2, c: 6 }, radius: 1.2, hp: 300, poise: 100, staggerDur: 1, getupDur: 1, toppleDur: 1 } },
        { id: 'foe', ambient: { type: 'clock' }, rule: { type: 'static' },
          transform: { pos: [6, 0, 0], heading: Math.PI },
          body: { type: 'figure-rig', hittable: true, collide: { a: 2, c: 6 }, radius: 1.2, hp: 300, poise: 100, staggerDur: 1, getupDur: 1, toppleDur: 1 } },
      ],
    });
    // put the foe MID-SWING (the counter condition) with a swing too short to reach the pilot
    w.byId.foe.swingT = 0.4;
    w.byId.foe.strikeParams = { reach: 0.1, from: 0, to: 1, cosCone: 0.99, eye: 0 };
    return w;
  };

  it('a player tackle-counter STARTS the cinematic: both invincible, camera swings to the side', () => {
    const w = mk();
    stepWorld(w, { tackle: 1 }, 1 / 60, FLAT);            // dash into the mid-swing foe → counter → cinematic
    expect(w.cinematic).not.toBeNull();
    expect([w.cinematic.a, w.cinematic.b]).toEqual(['me', 'foe']);
    expect(w.byId.me.invincible).toBe(true);
    expect(w.byId.foe.invincible).toBe(true);
    // the axis is +x, so the side camera swings off in ±y (was behind at y≈0). Ease it in for ~1s.
    run(w, { forward: 1, turn: 1 }, 60, 1 / 60, FLAT);     // held input mid-cinematic is IGNORED
    expect(w.cinematic).not.toBeNull();                   // still running
    expect(w.byId.me.invincible).toBe(true);
    expect(Math.abs(w.camera.transform.pos[1])).toBeGreaterThan(6);   // framed from the side, not behind
  });

  it('the cinematic ENDS after ~4.5s: camera + control return to the player', () => {
    const w = mk();
    stepWorld(w, { tackle: 1 }, 1 / 60, FLAT);
    expect(w.cinematic).not.toBeNull();
    run(w, {}, 300, 1 / 60, FLAT);                        // 5s — past the 4.5s cinematic
    expect(w.cinematic).toBeNull();                       // camera released (eases back to chase)
    expect(w.byId.me.invincible).toBe(false);
    // control is back: the pilot moves under input again
    const p0 = w.byId.me.transform.pos.slice();
    run(w, { forward: 1 }, 30, 1 / 60, FLAT);
    expect(w.byId.me.transform.pos[0]).not.toBe(p0[0]);
  });

  it('a NON-player tackle counter keeps the classic fling (no cinematic)', () => {
    // no pilot in the counter: an AI-vs-AI style counter never triggers the set piece
    const w = createWorld({
      entities: [
        { id: 'a', rule: { type: 'platform', eye: 0, tackle: true, tackleReach: 8, boostMax: 100 }, transform: { pos: [0, 0, 0], heading: 0 },
          body: { type: 'figure-rig', hittable: true, collide: { a: 2, c: 6 }, radius: 1.2, hp: 300, poise: 100, staggerDur: 1 } },
        { id: 'b', rule: { type: 'static' }, transform: { pos: [6, 0, 0], heading: Math.PI },
          body: { type: 'figure-rig', hittable: true, collide: { a: 2, c: 6 }, radius: 1.2, hp: 300, poise: 100, staggerDur: 1, toppleDur: 1, getupDur: 1 } },
      ],
    });
    w.byId.b.swingT = 0.4; w.byId.b.strikeParams = { reach: 0.1, from: 0, to: 1, cosCone: 0.99, eye: 0 };
    stepWorld(w, { tackle: 1 }, 1 / 60, FLAT);
    expect(w.cinematic).toBeNull();                       // no pilot → no cinematic
    expect(w.byId.b.staggerT).not.toBeNull();             // the classic topple fling still landed
  });
});

describe('rule: mover + moving-platform carry (platformer substrate)', () => {
  const mk = () => {
    const w = createWorld({ entities: [
      { id: 'plat', rule: { type: 'mover', from: [0, 0, 10], to: [10, 0, 10], period: 4 }, body: { type: 'platform', carrier: true, carryHalf: [3, 3] }, transform: { pos: [0, 0, 10] } },
      { id: 'hero', rule: { type: 'platform', speed: 0 }, transform: { pos: [0, 0, 10] } },
      { id: 'off',  rule: { type: 'platform', speed: 0 }, transform: { pos: [20, 0, 10] } },
    ] });
    // ground = the moving platform's top over its (tracking) footprint, plus static ground under 'off'.
    const ground = (pos) => {
      const p = w.byId.plat.transform.pos;
      if (Math.abs(pos[0] - p[0]) <= 3 && Math.abs(pos[1] - p[1]) <= 3) return 10;
      if (Math.abs(pos[0] - 20) <= 3 && Math.abs(pos[1]) <= 3) return 10;
      return null;
    };
    return { w, ground };
  };

  it('the mover ping-pongs between from and to along the smoothstep triangle', () => {
    const { w, ground } = mk();
    run(w, {}, 60, 1 / 60, { ground });
    const x = w.byId.plat.transform.pos[0];
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThanOrEqual(10);
  });

  it('carries a grounded rider horizontally with the platform', () => {
    const { w, ground } = mk();
    run(w, {}, 60, 1 / 60, { ground });
    const plat = w.byId.plat.transform.pos, hero = w.byId.hero.transform.pos;
    expect(plat[0]).toBeGreaterThan(0.2);                    // the platform moved +x
    expect(Math.abs(hero[0] - plat[0])).toBeLessThan(0.15);  // the rider rode along, glued to the deck
    expect(hero[2]).toBeCloseTo(10, 5);                      // still resting on top
    expect(w.byId.hero.carriedBy).toBe('plat');
  });

  it('does not carry a rider standing off the platform (walk-under / off-deck safe)', () => {
    const { w, ground } = mk();
    run(w, {}, 60, 1 / 60, { ground });
    expect(w.byId.off.transform.pos[0]).toBeCloseTo(20, 5);
    expect(w.byId.off.carriedBy == null).toBe(true);
  });

  it('is deterministic — identical steps reproduce the carried position exactly', () => {
    const a = mk(); run(a.w, {}, 90, 1 / 60, { ground: a.ground });
    const b = mk(); run(b.w, {}, 90, 1 / 60, { ground: b.ground });
    expect(a.w.byId.hero.transform.pos).toEqual(b.w.byId.hero.transform.pos);
  });

  it('a world with no carriers steps unchanged (carry is a no-op)', () => {
    const w = createWorld({ entities: [{ id: 'h', rule: { type: 'platform', speed: 6 }, transform: { pos: [0, 0, 0] } }] });
    run(w, { forward: 1 }, 30, 1 / 60, { ground: () => 0 });
    expect(w.byId.h.carriedBy == null).toBe(true);
  });
});

describe('practice mode (match.practice — nothing is destroyed, the bout never ends)', () => {
  const FLAT = { ground: () => 0 };
  // the match-layer rig: an auto rifle that one-shots the foe, the foe passive (burst 0).
  const mk = () => createWorld({
    pilot: 'me',
    match: { killTarget: 2, respawnDelay: 0.5, iFrames: 0, practice: true },
    entities: [
      {
        id: 'me', pilotable: true, ambient: { type: 'clock' },
        rule: { type: 'platform', turnMode: 'look', eye: 0, speed: 6 },
        transform: { pos: [0, 0, 0], heading: 0 },
        body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 200, poise: 100, poiseRegen: 20, staggerDur: 1 },
        weapon: { fireClass: 'sight', auto: true, rof: 10, magazine: 30, reload: 1, coreAngle: 45, range: 200, damage: 100, impact: 10, eye: 0 },
      },
      {
        id: 'foe', pilotable: true,
        ambient: { type: 'ai', speed: 0, turn: 6, standoff: 60, burst: 0, pause: 1, dodge: false },
        rule: { type: 'platform', turnMode: 'look', eye: 0 },
        transform: { pos: [30, 0, 0], heading: Math.PI },
        body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: 100, poise: 50, poiseRegen: 20, staggerDur: 0.6 },
      },
    ],
  });

  it('flags ride: match.practice true, every contender noDestroy', () => {
    const w = mk();
    expect(w.match.practice).toBe(true);
    expect(w.byId.me.noDestroy).toBe(true);
    expect(w.byId.foe.noDestroy).toBe(true);
  });

  it('a killing blow topples the foe but REFILLS its bar — never downed, no kill credited', () => {
    const w = mk();
    run(w, { fire: 1 }, 3, 1 / 60, FLAT);                  // damage 100 ≥ hp 100 — lethal in a scored bout
    const foe = w.byId.foe;
    expect(foe.downed).toBe(false);                        // not destroyed
    expect(foe.body.hp).toBe(foe.hpMax);                   // a fresh bar for the next drill
    expect(foe.staggerT).not.toBeNull();                   // the knockdown still plays (feedback)
    expect(foe.reactClip).toBe('topple');
    expect(w.match.kills.me).toBe(0);                      // kills never credit
    expect(w.match.over).toBe(false);
  });

  it('the foe stands back up and stays hittable — the drill continues past killTarget-many blows', () => {
    const w = mk();
    for (let round = 0; round < 3; round++) {              // 3 lethal exchanges > killTarget 2
      run(w, { fire: 1 }, 3, 1 / 60, FLAT);
      run(w, {}, 60 * 6, 1 / 60, FLAT);                    // fall + hold + getup + rof/poise recovery
    }
    const foe = w.byId.foe;
    expect(foe.downed).toBe(false);
    expect(foe.body.hittable).toBe(true);                  // never entered the corpse window
    expect(foe.staggerT).toBeNull();                       // back on its feet
    expect(w.match.over).toBe(false);                      // the bout never ends
    expect(w.match.winner).toBeNull();
  });

  it('a scored match is untouched: same rig without practice still downs and credits', () => {
    const w = createWorld({
      pilot: 'me',
      match: { killTarget: 2, respawnDelay: 0.5, iFrames: 0 },
      entities: JSON.parse(JSON.stringify(mk().entities.map((e) => ({
        id: e.id, pilotable: true, ambient: e.id === 'foe' ? { type: 'ai', speed: 0, turn: 6, standoff: 60, burst: 0, pause: 1, dodge: false } : { type: 'clock' },
        rule: { type: 'platform', turnMode: 'look', eye: 0, speed: 6 },
        transform: { pos: e.id === 'foe' ? [30, 0, 0] : [0, 0, 0], heading: e.id === 'foe' ? Math.PI : 0 },
        body: { type: 'figure-rig', hittable: true, radius: 1.2, hp: e.id === 'foe' ? 100 : 200, poise: 50, poiseRegen: 20, staggerDur: 0.6 },
        weapon: e.id === 'me' ? { fireClass: 'sight', auto: true, rof: 10, magazine: 30, reload: 1, coreAngle: 45, range: 200, damage: 100, impact: 10, eye: 0 } : undefined,
      })))),
    });
    expect(w.byId.foe.noDestroy).toBeUndefined();
    run(w, { fire: 1 }, 3, 1 / 60, FLAT);
    expect(w.byId.foe.downed).toBe(true);
    expect(w.match.kills.me).toBe(1);
  });
});

describe('space clash break (2026-08-04 — cross blades, roll out, reengage; no melee lock-loop)', () => {
  // two symmetric space melee-seek hunters (target:'all') a blade-length apart: both commit,
  // swing together, CLASH — the break must arm the give-up (guns for a beat) + the roll-out,
  // and after the window expires the blade comes back. Before the fix the pair re-clashed
  // forever ("stuck in melee loop", operator).
  // NOT pilotable — arena enemy seats are plain rule:'ai' entities; a pilotable flag would park
  // the non-pilot seat on its (static) ambient and the brain would never run.
  const seat = (id, x, heading) => ({
    id,
    rule: {
      type: 'ai', space: true, meleeSeek: true, target: 'all',
      speed: 20, turn: 20, standoff: 40, fireArc: 30, burst: 0, pause: 1,
      meleeGiveUp: 2, meleeTimeout: 5,
      loadout: [
        { name: 'MG', weapon: { fireClass: 'area', auto: true, rof: 30, magazine: 99, coreAngle: 30, assistAngle: 30, range: 120, damage: 1, eye: 0 } },
        { name: 'SABER', strike: 'melee', strikeDur: 0.5, strikeReach: 8, strikeDamage: 20 },
      ],
    },
    transform: { pos: [x, 0, 0], heading },
    body: { type: 'figure-rig', hittable: true, radius: 1, hp: 500, poise: 50, staggerDur: 1 },
  });
  // a fake hull 5u below the fight: the space roll must NOT glue onto it (the snap guard)
  const HULL = { ground: () => -5 };

  it('the clash breaks the loop: give-up armed, roll-out fired at ALTITUDE, guns between blades', () => {
    const w = createWorld({ entities: [seat('a', 0, 0), seat('b', 12, Math.PI)] });
    const a = w.byId.a, b = w.byId.b;
    let clashed = false, rolledOut = false, gunsAfterClash = false, bladeAgain = false, giveUpSeen = 0;
    let zDuringRoll = null;
    for (let i = 0; i < 60 * 14; i++) {
      stepWorld(w, {}, 1 / 60, HULL);
      if (a.clashT != null) clashed = true;
      if (clashed && a.clashT == null) {
        giveUpSeen = Math.max(giveUpSeen, a.meleeGiveUpT || 0);
        if (a.dodgeT != null) { rolledOut = true; zDuringRoll = a.transform.pos[2]; }
        if ((a.meleeGiveUpT || 0) > 0 && (a.loadoutIdx || 0) === 0) gunsAfterClash = true;
        if (rolledOut && (a.meleeGiveUpT || 0) <= 0 && (a.loadoutIdx || 0) === 1) { bladeAgain = true; break; }
      }
    }
    expect(clashed).toBe(true);                     // the blades met and locked
    expect(giveUpSeen).toBeGreaterThan(0);          // the break armed the give-up window (was space-gated off)
    expect(rolledOut).toBe(true);                   // the committed dash-away fired
    expect(Math.abs(zDuringRoll)).toBeLessThan(2);  // ...and held its altitude (no hull-snap to z=-5)
    expect(gunsAfterClash).toBe(true);              // disengaged to the trigger between blade exchanges
    expect(bladeAgain).toBe(true);                  // and REENGAGED the melee once the window expired
  });
});
