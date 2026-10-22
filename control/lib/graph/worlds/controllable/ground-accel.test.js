import { describe, expect, it } from 'vitest';
import { createWorld, stepWorld } from '@/lib/graph/worlds/controllable-world';

// GROUND ACCELERATION (rules-platform.js, opt-in `accel` / `decel` on the rule): the body carries a planar DRIVE that
// builds toward the stick at `accel` and sheds at `decel`, scaled by airControl in the air, where an unpushed body keeps
// it. A root stops it, a boost sets it, a wall takes the part into it, an owned body's drive stops. Absent `accel` → the
// direct step, byte-identical. The action lab's feel cards (scripts/spikes/action-lab) are where the numbers come from.

const DT = 1 / 60;
const FLAT = { ground: () => 0 };
const run = (w, input, n, world = FLAT) => { for (let i = 0; i < n; i++) stepWorld(w, input, DT, world); return w; };
const mk = (over = {}, world = {}) => createWorld({ ...world, entities: [{ id: 'p', rule: { type: 'platform', eye: 0, speed: 6, accel: 45, ...over }, transform: { pos: [0, 0, 0], heading: 0 } }] });
const speedOf = (e) => Math.hypot(e.drive[0], e.drive[1]);
const trace = (w, inputs) => inputs.map((inp) => { stepWorld(w, inp, DT, FLAT); const e = w.byId.p; return [...e.transform.pos, e.transform.heading, e.gaitPhase, e.locomotion, e.grounded]; });

describe('ground acceleration — the drive', () => {
  it('builds to the run on the card\'s acceleration and never passes it', () => {
    const w = mk(), e = w.byId.p, speeds = [];
    for (let i = 0; i < 40; i++) { run(w, { forward: 1 }, 1); speeds.push(speedOf(e)); }
    expect(speeds.findIndex((v) => v >= 0.9 * 6) + 1).toBe(Math.ceil((0.9 * 6) / 45 / DT));   // 8 frames
    expect(Math.max(...speeds)).toBeLessThanOrEqual(6 + 1e-9);
    expect(e.transform.pos[0]).toBeGreaterThan(0);   // heading 0 is +x
  });

  it('letting go sheds the run at the deceleration, not at once', () => {
    const w = mk({ decel: 30 }), e = w.byId.p;
    run(w, { forward: 1 }, 30);
    const x0 = e.transform.pos[0];
    run(w, {}, 1);
    expect([e.moving, e.locomotion]).toEqual([true, 'forward']);                // the gait reads the skid's step
    let frames = 1; while (speedOf(e) > 0 && frames < 100) { run(w, {}, 1); frames++; }
    expect(frames).toBe(Math.ceil(6 / 30 / DT));                                // 12 frames of skid
    let d = 0; for (let k = 1; k <= 12; k++) d += (6 - 30 * DT * k) * DT;
    expect(e.transform.pos[0] - x0).toBeCloseTo(d, 9);                          // v²/2a as the frames step it (0.55 of 0.6)
    expect(e.moving).toBe(false);
  });

  it('a stick against the run brakes at the deceleration, then builds the other way', () => {
    const w = mk({ decel: 60 }), e = w.byId.p;
    run(w, { forward: 1 }, 30);
    run(w, { forward: -1 }, 1);
    expect(e.drive[0]).toBeCloseTo(6 - 60 * DT, 9);   // the braking rate, not the building one
  });

  it('in the air an unpushed body keeps its drive; a push there is scaled by airControl', () => {
    const w = mk({ airControl: 0.5 }), e = w.byId.p;
    run(w, { forward: 1 }, 30);
    run(w, { jump: 1, jumpHeld: 1 }, 1);
    expect(e.grounded).toBe(false);
    const v = e.drive[0]; run(w, { jumpHeld: 1 }, 10);
    expect(e.grounded).toBe(false);
    expect(e.drive[0]).toBe(v);                        // momentum through the jump
    const w2 = mk({ airControl: 0.5 }), e2 = w2.byId.p;
    run(w2, { jump: 1, jumpHeld: 1 }, 1);
    run(w2, { forward: 1, jumpHeld: 1 }, 1);
    expect(e2.drive[0]).toBeCloseTo(45 * 0.5 * DT, 9);
  });

  it('a root stops it at once: the kneel', () => {
    const w = mk({ kneel: true }), e = w.byId.p;
    run(w, { forward: 1 }, 30);
    run(w, { forward: 1, kneel: 1 }, 1);
    expect(speedOf(e)).toBe(0);
  });

  it('a boost sets it to the dash, and letting go of F sheds the dash', () => {
    const w = mk({ boostSpeed: 15, decel: 50 }), e = w.byId.p;
    run(w, { boost: 1 }, 1);
    expect(e.drive[0]).toBeCloseTo(15, 9);             // the dash is instant
    run(w, {}, 1);
    expect(e.drive[0]).toBeCloseTo(15 - 50 * DT, 9);   // the release skids
  });

  it('with boostInertia the skid owns the release and the drive starts from rest', () => {
    const w = mk({ boostSpeed: 15, boostInertia: 0.5 }), e = w.byId.p;
    run(w, { boost: 1 }, 10);
    expect(speedOf(e)).toBe(0);
    run(w, {}, 1);
    expect(e.inertiaT).not.toBeNull();
  });

  it('a wall takes the part of the drive into it; the part along it stays', () => {
    const w = mk({ collideRadius: 0.4, collideHeight: 1.8, move: 'world', moveYaw: 0 }, { colliders: [{ min: [3, -50, 0], max: [5, 50, 4] }] }), e = w.byId.p;
    run(w, { forward: 1, strafe: 1 }, 80);             // diagonal into the wall at x = 3
    expect(e.transform.pos[0]).toBeLessThanOrEqual(3 - 0.4 + 1e-9);
    expect(Math.abs(e.drive[0])).toBeLessThan(1e-9);   // nothing left pushing into it
    expect(Math.abs(e.drive[1])).toBeGreaterThan(1);   // sliding along it
  });

  it('a lane holds the drive on its tangent', () => {
    const w = mk({ move: 'lane', lane: [[0, 0], [10, 0], [14, 6]] }), e = w.byId.p;
    run(w, { turn: 1 }, 150);
    const L = Math.hypot(4, 6), along = (e.drive[0] * 4 + e.drive[1] * 6) / L;
    expect(Math.abs(along - speedOf(e))).toBeLessThan(1e-9);   // round the bend, all of it along the second leg
  });

  it('a body something else owns stops driving', () => {
    const w = mk(), e = w.byId.p;
    run(w, { forward: 1 }, 30);
    e.dormant = true; run(w, {}, 1);
    expect(speedOf(e)).toBe(0);
  });

  it('absent accel the direct step runs byte for byte: no drive, the same trace as accel 0', () => {
    const inputs = [...Array(20).fill({ forward: 1 }), { forward: 1, jump: 1, jumpHeld: 1 }, ...Array(20).fill({ forward: 1, turn: 0.5, jumpHeld: 1 }), ...Array(15).fill({ boost: 1, strafe: 1 }), ...Array(10).fill({})];
    const a = mk({ accel: undefined }), b = mk({ accel: 0 });
    expect(trace(a, inputs)).toEqual(trace(b, inputs));
    expect(a.byId.p.drive).toBeUndefined();
  });
});
