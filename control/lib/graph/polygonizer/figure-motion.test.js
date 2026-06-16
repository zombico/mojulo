import { describe, it, expect } from 'vitest';
import { resolveMotion, resolvePose, gait, sprint, SPRINT_DEFAULTS } from './figure-posing.js';

const ampOf = (move, ch) => Math.max(...Array.from({ length: 40 }, (_, i) => {
  const d = move(i / 40); const [a, b] = ch.split('.'); const v = b ? d[a]?.[b] : d[a];
  return Math.abs(typeof v === 'number' ? v : 0);
}));

describe('figure-posing — resolveMotion (the motion front door)', () => {
  it("resolves 'walk' and a parameterized { walk: {…} } to the gait", () => {
    expect(typeof resolveMotion('walk')).toBe('function');
    const small = resolveMotion({ walk: { strideLength: 0.2 } });
    const big = resolveMotion({ walk: { strideLength: 0.5 } });
    expect(ampOf(big, 'hipL.pitch')).toBeGreaterThan(ampOf(small, 'hipL.pitch'));
  });

  it("resolves 'sprint'/'run' and { sprint }/{ run } to the sprint cycle", () => {
    expect(typeof resolveMotion('sprint')).toBe('function');
    expect(typeof resolveMotion('run')).toBe('function');
    expect(resolveMotion({ sprint: { lean: 0.3 } })(0.1)).toEqual(resolveMotion({ run: { lean: 0.3 } })(0.1));
  });

  it('resolves { walk } and { gait } identically (alias)', () => {
    expect(resolveMotion({ walk: { armSwing: 30 } })(0.2)).toEqual(resolveMotion({ gait: { armSwing: 30 } })(0.2));
  });

  it('resolves { keyframes } to a motion that passes through its keyposes (eased)', () => {
    const move = resolveMotion({ keyframes: [{ armR: 'up' }, { armR: 'down' }] });
    expect(typeof move).toBe('function');
    expect(move(0)).toEqual(resolvePose({ armR: 'up' }));      // phase 0 lands on the first keypose
  });

  it('keyframes accept RAW dof — the same dials the create_figure pose field uses', () => {
    const move = resolveMotion({ keyframes: [{ shR: { pitch: 40 } }, { shR: { pitch: -40 } }] });
    expect(move(0).shR.pitch).toBeCloseTo(40, 6);             // raw swivel flows through resolvePose
  });

  it('{ perform } overlays the animation principles (exaggerate pushes the poses further)', () => {
    const plain = resolveMotion({ walk: {} }, { frames: 30 });
    const bold = resolveMotion({ walk: {}, perform: { exaggerate: 2, followThrough: false } }, { frames: 30 });
    expect(ampOf(bold, 'hipL.pitch')).toBeGreaterThan(ampOf(plain, 'hipL.pitch'));
  });

  it('returns null for a non-motion spec', () => {
    expect(resolveMotion({ foo: 1 })).toBeNull();
    expect(resolveMotion(null)).toBeNull();
    expect(resolveMotion('nope')).toBeNull();
  });

  it('a function is used as-is', () => {
    const f = (p) => ({ elbowL: p });
    expect(resolveMotion(f)).toBe(f);
  });
});

describe('figure-posing — sprint (a ballistic run with a flight phase)', () => {
  const run = sprint();
  const N = 48;
  const phases = Array.from({ length: N }, (_, i) => run(i / N));

  it('has a flight phase — the body arcs up off the ground then settles back, twice a stride', () => {
    const lifts = phases.map((d) => d.lift);
    expect(Math.max(...lifts)).toBeCloseTo(SPRINT_DEFAULTS.flightLift, 2);   // peaks airborne mid-flight
    expect(Math.min(...lifts)).toBeLessThan(SPRINT_DEFAULTS.flightLift * 0.15);   // settles near the ground at contact
    const peaks = phases.filter((d, i) => d.lift > phases[(i + N - 1) % N].lift && d.lift > phases[(i + 1) % N].lift);
    expect(peaks.length).toBe(2);                                 // two flights per stride (one per leg)
  });

  it('runs ballistically (pure FK) — never engages a single-foot groundBalance commit', () => {
    // Single-foot support would snap the COM over the foot and back each step (the jump
    // bug). Staying airborne keeps it continuous. support is 'none' throughout.
    expect(new Set(phases.map((d) => d.support))).toEqual(new Set(['none']));
  });

  it('is SMOOTH — no per-frame snap in the limb drives or the lift (guards the jump bug)', () => {
    const wrapped = [...phases, run(0)];                         // close the loop
    const ch = (d, k) => (k === 'lift' ? d.lift : k === 'hipL' ? d.hipL.pitch : d.shL.pitch);
    for (const k of ['hipL', 'shL', 'lift']) {
      let maxStep = 0;
      for (let i = 1; i < wrapped.length; i++) maxStep = Math.max(maxStep, Math.abs(ch(wrapped[i], k) - ch(wrapped[i - 1], k)));
      // a continuous cycle over 48 frames moves a few degrees / a few mm per frame, never a snap
      expect(maxStep).toBeLessThan(k === 'lift' ? 0.02 : 12);
    }
  });

  it('runs with a forward lean and a held-bent arm pump that drives harder backward', () => {
    expect(run(0).spine.sagittal).toBeGreaterThan(0.2);          // strong forward lean
    expect(run(0).elbowL).toBeGreaterThan(60);                   // elbows held ~90°
    expect(Math.abs(run(0).shL.pitch)).toBeGreaterThan(Math.abs(run(0.5).shL.pitch));   // back drive > forward
  });

  it('keeps the trunk braced — a small sagittal give around the lean, not a rigid rod nor a flop', () => {
    const sag = phases.map((d) => d.spine.sagittal);
    const give = (Math.max(...sag) - Math.min(...sag)) / 2;
    expect(give).toBeGreaterThan(0.005);                         // it gives (not a rigid rod)
    expect(give).toBeLessThan(0.1);                              // …but stays braced (not a flop)
    const rigid = sprint({ spineGive: 0 });
    const rigidSag = new Set(phases.map((_, i) => rigid(i / N).spine.sagittal.toFixed(6)));
    expect(rigidSag.size).toBe(1);                              // spineGive:0 → a perfectly rigid lean
  });
});

describe('figure-posing — resolvePose raw-dof superset (the link)', () => {
  it('passes raw shoulder/hip swivels straight through', () => {
    const dof = resolvePose({ shR: { yaw: 10, pitch: 20 }, hipL: { pitch: -15 } });
    expect(dof.shR).toEqual({ yaw: 10, pitch: 20 });
    expect(dof.hipL).toEqual({ pitch: -15 });
  });

  it('passes raw head { yaw, pitch } through, but still AIMS a friendly head direction', () => {
    expect(resolvePose({ head: { yaw: 5, pitch: -3 } }).head).toEqual({ yaw: 5, pitch: -3 });
    expect(resolvePose({ head: 'down' }).head).toBeTruthy();   // friendly direction → an aimed swivel
  });

  it('still resolves the friendly word vocabulary (armR → shR)', () => {
    const dof = resolvePose({ armR: 'up', elbowR: 'half' });
    expect(dof.shR).toBeTruthy();
    expect(dof.elbowR).toBe(75);                               // 'half' bend word
  });
});
