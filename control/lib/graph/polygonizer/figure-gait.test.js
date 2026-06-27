import { describe, it, expect } from 'vitest';
import { gait, WALK_DEFAULTS } from './figure-posing.js';
import { articulate, basePositions } from './figure-vajra.js';
import { groundVault } from './figure-balance.js';
import { buildProtoform } from './figure-proto.js';

const SAMPLES = 60;
const sample = (move, fn) => Array.from({ length: SAMPLES }, (_, i) => fn(move(i / SAMPLES), i / SAMPLES));

describe('figure-posing — gait (formalized walk)', () => {
  const walk = gait();

  it('balances on both feet every frame — no single-foot commit that would warp the stance', () => {
    const supports = new Set(sample(walk, (d) => d.support));
    expect([...supports]).toEqual(['both']);          // both feet anchor the balance solve throughout
  });

  it('lists weight gently toward the bearing leg, bounded by weightShift (no over-commit past the foot)', () => {
    expect(walk(0.25).weight).toBeLessThan(-0.1);                 // over the left leg at its mid-stance
    expect(walk(0.75).weight).toBeGreaterThan(0.1);              // over the right leg at its mid-stance
    const peak = Math.max(...sample(walk, (d) => Math.abs(d.weight)));
    expect(peak).toBeLessThanOrEqual(WALK_DEFAULTS.weightShift + 1e-9);   // never beyond the dial → no lurch
  });

  it('swings the legs in antiphase (left forward ⇒ right back) with the arms counter-swinging', () => {
    const d = walk(0);                                 // left leg fully forward
    expect(d.hipL.pitch).toBeGreaterThan(0);           // left thigh forward
    expect(d.hipR.pitch).toBeLessThan(0);              // right thigh back
    expect(Math.sign(d.shL.pitch)).toBe(-Math.sign(d.hipL.pitch));   // left arm opposes the left leg
  });

  it('lifts the swing foot clear of the planted foot (each leg swings in turn)', () => {
    const r = articulate(walk(0.25));                  // right leg swinging → right foot up
    expect(r.ankleR.z).toBeGreaterThan(r.ankleL.z + 0.01);
    const l = articulate(walk(0.75));                  // left leg swinging → left foot up
    expect(l.ankleL.z).toBeGreaterThan(l.ankleR.z + 0.01);
  });

  it('stride scales the hip swing amplitude', () => {
    const small = gait({ strideLength: 0.2 });
    const big = gait({ strideLength: 0.5 });
    const amp = (m) => Math.max(...sample(m, (d) => Math.abs(d.hipL.pitch)));
    expect(amp(big)).toBeGreaterThan(amp(small));
  });

  it('is cyclic — phase 0 and phase 1 coincide so the GIF tiles seamlessly', () => {
    const a = walk(0), b = walk(1);
    expect(b.hipL.pitch).toBeCloseTo(a.hipL.pitch, 6);
    expect(b.kneeR).toBeCloseTo(a.kneeR, 6);
    expect(b.spine.axial).toBeCloseTo(a.spine.axial, 6);
  });

  it('cadence packs multiple strides into one loop', () => {
    const two = gait({ cadence: 2 });
    // two strides per loop ⇒ the half-loop point matches the full single-stride loop point
    expect(two(0.5).hipL.pitch).toBeCloseTo(gait()(1).hipL.pitch, 6);
  });

  it('drives a swing amplitude set by the stride, with the knee reproducing the canonical lift', () => {
    const d = walk(0);
    const theta = Math.asin(WALK_DEFAULTS.strideLength / (2 * 0.45)) * 180 / Math.PI;   // legLen ≈ 0.45
    expect(Math.abs(d.hipL.pitch)).toBeCloseTo(theta, 0);    // hip swing follows strideLength
    expect(d.kneeL).toBeCloseTo(WALK_DEFAULTS.stanceKnee, 6);
    expect(Math.max(...sample(walk, (x) => x.kneeL))).toBeCloseTo(WALK_DEFAULTS.stanceKnee + WALK_DEFAULTS.swingLift, 0);
  });

  it('plants the stance foot (vault) and rolls the ankle heel-strike → toe-off', () => {
    const ok = sample(walk, (d) => d.plant).every((p) => p && p.L >= 0 && p.L <= 1 && p.R >= 0 && p.R <= 1);
    expect(ok).toBe(true);                                    // emits per-foot plantedness for the vault
    expect(walk(0.25).plant.L).toBeCloseTo(1, 2);            // left foot fully planted at its mid-stance
    expect(walk(0.75).plant.L).toBeLessThan(0.2);            // …and lifted (swinging) half a cycle later
    expect(walk(0).ankleL).toBeGreaterThan(0);               // dorsiflexed at heel-strike (toe up)
    expect(walk(0.5).ankleL).toBeLessThan(0);                // plantarflexed at toe-off (toe down)
    expect(gait({ vault: false })(0.25).plant).toBeUndefined();   // opt-out → no plant channel
  });

  it('rolls the toes (MTP) up over the ball at toe-off, relaxed elsewhere', () => {
    expect(walk(0.5).toeL).toBeGreaterThan(10);              // left toe-off (late stance) → toes break up
    expect(walk(0).toeL).toBeLessThan(1);                   // heel-strike → toes flat
    expect(walk(0.25).toeL).toBeLessThan(1);                // mid-stance → toes flat
  });

  // ── crossover (catwalk) ────────────────────────────────────────────────────
  it('defaults to a sagittal walk — no hip yaw, the legs stay in their hip-width lanes', () => {
    const yaw = sample(walk, (d) => Math.abs(d.hipL.yaw || 0) + Math.abs(d.hipR.yaw || 0));
    expect(Math.max(...yaw)).toBe(0);                        // cross:0 ⇒ zero adduction every frame
    expect(articulate(walk(0)).ankleL.x).toBeLessThan(-0.05);   // left foot stays on the left
  });

  it('crosses the stepping foot over the midline as it plants forward (catwalk)', () => {
    const cat = gait({ cross: 0.13 });
    // phase 0: left leg forward → it scissors across, the left foot landing PAST centre (x > 0)…
    const a = articulate(cat(0));
    expect(a.ankleL.x).toBeGreaterThan(0);                  // crossed over to the right side
    expect(a.ankleL.x).toBeGreaterThan(articulate(walk(0)).ankleL.x);   // …further in than the plain walk
    // phase .5: right leg forward → the right foot now crosses past centre (x < 0), mirror-symmetric.
    const b = articulate(cat(0.5));
    expect(b.ankleR.x).toBeLessThan(0);
    // and the crossing OPENS back out: the back/push-off leg returns to hip width, not crossed.
    expect(articulate(cat(0.5)).ankleL.x).toBeLessThan(-0.05);   // left (now the back leg) back at width
  });

  it('scales the crossover with the `cross` dial, bounded by the hip cone', () => {
    const reach = (c) => articulate(gait({ cross: c })(0)).ankleL.x;
    expect(reach(0.16)).toBeGreaterThan(reach(0.08));       // more cross ⇒ the foot reaches further across
    expect(reach(0.08)).toBeGreaterThan(reach(0));          // any cross ⇒ further in than none
  });

  // closest horizontal approach between the two ANKLES over the left-leg swing window — the
  // crossover's collision risk (the back foot maneuvering past the planted ankle).
  const closestApproach = (g) => {
    let min = Infinity;
    for (let i = 50; i <= 100; i++) {
      const dof = g(i / 100);
      const v = groundVault(articulate(dof), { plant: dof.plant });
      min = Math.min(min, Math.hypot(v.ankleL.x - v.ankleR.x, v.ankleL.y - v.ankleR.y));
    }
    return min;
  };

  it('clears the swinging back foot AROUND the planted ankle (no foot collision on a crossover)', () => {
    const collide = closestApproach(gait({ cross: 0.13, stepFlare: 0, stepRoll: 0 }));
    const clear = closestApproach(gait({ cross: 0.13 }));   // default flare + roll
    expect(collide).toBeLessThan(0.06);                     // a hard crossover overlaps the ankles
    expect(clear).toBeGreaterThan(0.12);                    // the flare/roll opens a real gap
    expect(clear).toBeGreaterThan(collide + 0.07);          // …a substantial clearance gain
  });

  // ── wrist / hand articulation (the arm-mirror of the ankle/toe) ─────────────
  const handLCentroid = (handFlex) => {
    const body = buildProtoform(basePositions(), {}, null, null, handFlex);
    let x = 0, y = 0, z = 0, n = 0;
    for (const piece of body) if (piece.id === 'handL') for (const r of piece.rings) { x += r.center.x; y += r.center.y; z += r.center.z; n++; }
    return { x: x / n, y: y / n, z: z / n };
  };
  const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

  it('articulates the hand at the WRIST — flex + finger curl move the hand (no longer a stiff paddle)', () => {
    const neutral = handLCentroid(null);
    const flexed = handLCentroid({ L: { flex: 60 }, R: {} });    // bend the hand at the wrist
    const deviated = handLCentroid({ L: { deviation: 25 }, R: {} });
    const curled = handLCentroid({ L: { curl: 80 }, R: {} });     // close the fingers toward the palm
    expect(dist3(neutral, flexed)).toBeGreaterThan(0.02);        // wrist flex visibly swings the hand
    expect(dist3(neutral, deviated)).toBeGreaterThan(0.01);      // radial/ulnar deviation moves it too
    expect(dist3(neutral, curled)).toBeGreaterThan(0.005);       // finger curl draws the fingertips in
  });

  it('relaxes the hands through the walk — a soft finger curl + the wrist giving with the arm swing', () => {
    expect(walk(0).fingersL).toBeCloseTo(WALK_DEFAULTS.handCurl, 6);   // hands carry a relaxed curl
    const flex = sample(walk, (d) => Math.abs(d.wristL.flex));
    expect(Math.max(...flex)).toBeGreaterThan(0);                      // the wrist gives across the cycle
    const stiff = gait({ handCurl: 0, wristGive: 0 });
    expect(stiff(0.3).fingersL).toBeCloseTo(0, 6);                    // opt-out → flat hands
    expect(stiff(0.3).wristL.flex).toBeCloseTo(0, 6);                 // …and a rigid wrist
  });

  it('rotates the pelvis in the transverse plane so the FORWARD leg’s hip leads (a gait determinant)', () => {
    const fwd = articulate(walk(0));                         // left leg forward
    expect(fwd.hipL.y).toBeGreaterThan(fwd.hipR.y);          // …left hip is advanced
    const fwdR = articulate(walk(0.5));                      // right leg forward
    expect(fwdR.hipR.y).toBeGreaterThan(fwdR.hipL.y);        // …right hip is advanced (mirror)
    expect(Math.abs(walk(0).pelvis)).toBeCloseTo(WALK_DEFAULTS.pelvisRot, 6);   // amplitude = the dial
    expect(gait({ pelvisRot: 0 })(0).pelvis).toBeCloseTo(0, 6);   // 0 ⇒ a rigid pelvis (opt-out)
  });

  it('counter-rotates the shoulder girdle against the pelvis (contralateral coordination)', () => {
    const m = articulate(walk(0));                          // left hip leads (left leg forward)
    expect(m.hipL.y).toBeGreaterThan(m.hipR.y);             // …left hip advanced
    expect(m.shoulderR.y).toBeGreaterThan(m.shoulderL.y);   // …RIGHT shoulder advanced (opposite) — contra
    // the girdle rotation is the mirror of the pelvic one, opposite sign at the same phase.
    expect(walk(0).shoulders).toBeCloseTo(-walk(0).pelvis * (WALK_DEFAULTS.shoulderRot / WALK_DEFAULTS.pelvisRot), 6);
    expect(gait({ shoulderRot: 0 })(0).shoulders).toBeCloseTo(0, 6);   // 0 ⇒ rigid girdle (opt-out)
  });

  it('gates the clearance on crossing — a plain sagittal walk emits no flare/roll', () => {
    const walkNS = sample(gait(), (d) => Math.abs(d.hipL.roll || 0) + Math.abs(d.hipR.roll || 0));
    expect(Math.max(...walkNS)).toBe(0);                    // cross:0 ⇒ no hip roll anywhere
    expect(gait()(0.75).hipL.yaw).toBe(0);                  // …and no abduction flare mid-swing
  });
});
