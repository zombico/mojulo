import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '@/lib/graph/worlds/controllable-world';

// BOOST INERTIA (maneuvers.js, opt-in `boostInertia` seconds on the rule). Ground boost is a
// kinematic position write, so cutting the thrust used to snap to walk speed the next frame.
// With inertia the suit SKIDS along the last boost vector — boost speed decaying linearly to
// zero over the window — playing the TRANSPOSED boost pose (slide left = boost_right, slide
// forward = boost_back: the counter-thrust braking read, on clips every rig already carries).
// A melee press mid-skid kills the slide on the spot (swings are always planted); the R22
// boost-cancel melee spawns no skid at all; dodge/tackle/fresh-boost swallow it. Absent the
// param → byte-identical. Space mode is untouched (it coasts on real Newtonian momentum).

const DT = 1 / 60;
const FLAT = { ground: () => 0 };
const run = (state, input, steps) => { for (let i = 0; i < steps; i++) stepWorld(state, input, DT, FLAT); return state; };
const mk = (over = {}) => createWorld({
  entities: [{ id: 'p', rule: { type: 'platform', eye: 0, speed: 6, boostSpeed: 15, boostInertia: 0.5, ...over }, transform: { pos: [0, 0, 0], heading: 0 } }],
});
// closed-form skid distance: per frame p += DT/dur, step = boostSpeed·(1−p)·DT while p < 1
const skidDist = (boostSpeed, dur) => {
  const n = Math.round(dur / DT);
  let d = 0;
  for (let k = 1; k < n; k++) d += boostSpeed * (1 - k / n) * DT;
  return d;
};

describe('boost inertia — the skid', () => {
  it('releasing F slides the suit along the boost vector, decaying to zero over the window', () => {
    const w = mk();
    run(w, { boost: 1 }, 60);                       // 1s of forward dash (heading 0 → +X)
    const p = w.byId.p;
    const x0 = p.transform.pos[0];
    run(w, {}, 1);                                  // the release frame latches the slide
    expect(p.inertiaT).not.toBeNull();
    run(w, {}, 40);                                 // ride the whole half-second window out
    expect(p.inertiaT == null).toBe(true);          // expired
    expect(p.transform.pos[0] - x0).toBeCloseTo(skidDist(15, 0.5), 1);   // ~3.6u of skid, not a snap
    const xEnd = p.transform.pos[0];
    run(w, {}, 30);                                 // no input after expiry → parked
    expect(p.transform.pos[0]).toBeCloseTo(xEnd, 5);
  });

  it('each skid frame covers less ground than the last (decay, not constant carry)', () => {
    const w = mk();
    run(w, { boost: 1 }, 30);
    const p = w.byId.p;
    const step = () => { const x = p.transform.pos[0]; run(w, {}, 1); return p.transform.pos[0] - x; };
    const d1 = step(), d2 = step(), d3 = step();
    expect(d1).toBeGreaterThan(d2);
    expect(d2).toBeGreaterThan(d3);
    expect(d1).toBeLessThan(15 * DT + 1e-6);        // never faster than the dash itself
  });

  it('the gauge sputtering empty mid-dash (F still held) skids the same way', () => {
    const w = mk({ boostMax: 0.5 });                // half a second of thrust, then the lock
    run(w, { boost: 1 }, 40);                       // gauge dies around frame 30 with F held
    const p = w.byId.p;
    expect(p.boostLock).toBe(true);
    expect(p.inertiaT).not.toBeNull();              // the sputter-out slide is live
  });

  it('pressing F again mid-skid swallows the slide and dashes fresh', () => {
    const w = mk();
    run(w, { boost: 1 }, 30);
    run(w, {}, 5);                                  // 5 frames into the skid
    const p = w.byId.p;
    expect(p.inertiaT).not.toBeNull();
    run(w, { boost: 1 }, 2);
    expect(p.inertiaT == null).toBe(true);
    expect(p.locomotion).toBe('boost');
  });
});

describe('boost inertia — the transposed brake pose', () => {
  const skidClip = (boostInput) => {
    const w = mk({ turnMode: 'look' });             // free A/D strafe so sideways dashes are pure
    run(w, { boost: 1, ...boostInput }, 30);
    run(w, {}, 3);                                  // into the skid
    return w.byId.p.locomotion;
  };
  it('a forward dash skids on the boost_back clip (braking against the slide)', () => {
    expect(skidClip({})).toBe('boost_back');        // plain F defaults forward, like the engine
    expect(skidClip({ forward: 1 })).toBe('boost_back');
  });
  it('a backward dash skids on the boost clip', () => {
    expect(skidClip({ forward: -1 })).toBe('boost');
  });
  it('side dashes skid on the OPPOSITE side clip', () => {
    expect(skidClip({ strafe: 1 })).toBe('boost_left');    // slid right → thrusting left
    expect(skidClip({ strafe: -1 })).toBe('boost_right');  // slid left → thrusting right
  });
});

describe('boost inertia — cancels', () => {
  it('a melee press mid-skid kills the slide on the spot and swings planted', () => {
    const w = mk({ strike: 'melee', strikeDur: 0.5 });
    run(w, { boost: 1 }, 30);
    run(w, {}, 3);                                  // into the skid
    const p = w.byId.p;
    expect(p.inertiaT).not.toBeNull();
    run(w, { fire: 1 }, 1);                         // the strike lands on the very next frame
    expect(p.inertiaT == null).toBe(true);
    expect(p.swingT).not.toBeNull();
    expect(p.grounded).toBe(true);                  // planted — never swinging off a slide
    const x = p.transform.pos[0];
    run(w, {}, 10);                                 // mid-swing: rooted, zero residual drift
    expect(p.transform.pos[0]).toBeCloseTo(x, 5);
  });

  it('the R22 boost-cancel melee spawns NO skid (plant-and-swing keeps its grounding)', () => {
    const w = mk({ strike: 'melee', strikeDur: 0.5, strikeCooldown: 1 });
    run(w, { boost: 1 }, 30);
    const p = w.byId.p;
    run(w, { boost: 1, fire: 1 }, 1);               // melee mid-boost → the R22 cut
    expect(p.boostCut).toBe(true);
    expect(p.swingT).not.toBeNull();
    run(w, { boost: 1 }, 40);                       // F stays held through the cut — still no slide
    expect(p.inertiaT == null).toBe(true);
  });

  it('a tackle commit mid-skid takes the body (no slide under the charge)', () => {
    const w = mk({ tackle: true });
    run(w, { boost: 1 }, 30);
    run(w, {}, 3);
    const p = w.byId.p;
    expect(p.inertiaT).not.toBeNull();
    run(w, { tackle: 1 }, 2);
    expect(p.tackleT).not.toBeNull();
    expect(p.inertiaT == null).toBe(true);
  });
});

describe('boost inertia — the opt-in boundary', () => {
  it('absent boostInertia → byte-identical: no slide fields, no drift after release', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', eye: 0, speed: 6, boostSpeed: 15 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(w, { boost: 1 }, 30);
    const p = w.byId.p;
    run(w, {}, 1);
    const x = p.transform.pos[0];
    expect(p.inertiaT === undefined).toBe(true);    // the hook never touched the entity
    expect(p.inertiaPrev === undefined).toBe(true);
    run(w, {}, 30);
    expect(p.transform.pos[0]).toBeCloseTo(x, 5);   // the legacy hard stop
  });

  it('space is untouched even WITH the param (operator: the void keeps its own physics) — no slide, no brake pose, drift-through swing intact', () => {
    const w = createWorld({ entities: [{ id: 'p', rule: { type: 'platform', space: true, eye: 0, speed: 6, boostSpeed: 15, boostInertia: 0.5, strike: 'melee', strikeDur: 0.5 }, transform: { pos: [0, 0, 0], heading: 0 } }] });
    run(w, { boost: 1 }, 30);
    const p = w.byId.p;
    run(w, {}, 5);                                  // stick idle, coasting on real momentum
    expect(p.inertiaT === undefined || p.inertiaT === null).toBe(true);
    expect(p.locomotion).toBe('idle');              // the thrust ladder, not a brake pose
    const d0 = Math.hypot(p.vel[0], p.vel[1], p.vel[2]);
    expect(d0).toBeGreaterThan(3);
    run(w, { fire: 1 }, 1);                         // a coasting swing still drifts through
    expect(p.swingT).not.toBeNull();
    expect(Math.hypot(p.vel[0], p.vel[1], p.vel[2])).toBeGreaterThan(d0 * 0.8);
  });
});
