import { describe, it, expect } from 'vitest';
import { resolvePose, resolveDir, aimSwivel, keyframeMotion, performance } from './figure-posing.js';
import { articulate, basePositions, LIMITS } from './figure-vajra.js';

const norm = (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const angleDeg = (a, b) => { a = norm(a); b = norm(b); return Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z))) * 180 / Math.PI; };
// direction of the left upper-arm bone after posing
const armLDir = (dof) => { const m = articulate(dof); return sub(m.elbowL, m.shoulderL); };

describe('figure-posing — direction vocabulary', () => {
  it('cardinal names map to body-frame unit vectors (+y fwd, +z up, +x right)', () => {
    expect(resolveDir('forward')).toEqual({ x: 0, y: 1, z: 0 });
    expect(resolveDir('up')).toEqual({ x: 0, y: 0, z: 1 });
    expect(resolveDir('right')).toEqual({ x: 1, y: 0, z: 0 });
  });
  it('outward/inward are limb-relative (away from / toward the midline)', () => {
    expect(resolveDir('outward', -1)).toEqual({ x: -1, y: 0, z: 0 }); // left limb → figure-left
    expect(resolveDir('outward', 1)).toEqual({ x: 1, y: 0, z: 0 });   // right limb → figure-right
    expect(resolveDir('inward', -1)).toEqual({ x: 1, y: 0, z: 0 });
  });
  it('a list of names is summed then normalised (a diagonal)', () => {
    const d = resolveDir(['forward', 'up']);
    expect(d.y).toBeCloseTo(Math.SQRT1_2, 5);
    expect(d.z).toBeCloseTo(Math.SQRT1_2, 5);
    expect(d.x).toBeCloseTo(0, 5);
  });
  it('throws on an unknown direction', () => {
    expect(() => resolveDir('sideways')).toThrow(/unknown direction/);
  });
});

describe('figure-posing — aim solver', () => {
  const B = basePositions();
  const restArmL = sub(B.elbowL, B.shoulderL);

  it('aiming the rest bone at itself is a (near) no-op', () => {
    const { yaw, pitch } = aimSwivel(restArmL, restArmL);
    expect(Math.hypot(yaw, pitch)).toBeLessThan(1e-6);
  });

  it('round-trips a within-cone target: the posed bone points where asked', () => {
    // 'down' and a forward-down diagonal are inside the shoulder cone → exact.
    expect(angleDeg(armLDir(resolvePose({ armL: 'down' })), resolveDir('down', -1))).toBeLessThan(0.5);
    expect(angleDeg(armLDir(resolvePose({ armL: ['forward', 'down'] })), resolveDir(['forward', 'down'], -1))).toBeLessThan(0.5);
  });

  it('never exceeds the shoulder cone — out-of-range aims clamp, not break', () => {
    // 'up' is ~180° from the hanging rest; the arm must stop at the cone, not flip.
    const m = articulate(resolvePose({ armL: 'up' }));
    const swing = angleDeg(sub(m.elbowL, m.shoulderL), restArmL);
    expect(swing).toBeLessThanOrEqual(LIMITS.shoulder + 0.5);
  });
});

describe('figure-posing — resolvePose → dof', () => {
  it('an empty spec yields an empty dof (canonical figure preserved)', () => {
    expect(resolvePose({})).toEqual({});
  });
  it('hinge words and degrees both resolve', () => {
    expect(resolvePose({ elbowL: 'half' }).elbowL).toBe(75);
    expect(resolvePose({ kneeR: 90 }).kneeR).toBe(90);
    expect(() => resolvePose({ elbowL: 'wibble' })).toThrow(/unknown bend/);
  });
  it('spine words carry the intuitive sign', () => {
    expect(resolvePose({ spine: { curl: 0.3 } }).spine.sagittal).toBeCloseTo(0.3);
    expect(resolvePose({ spine: { arch: 0.3 } }).spine.sagittal).toBeCloseTo(-0.3);
    expect(resolvePose({ spine: { sideBend: ['right', 0.4] } }).spine.lateral).toBeCloseTo(0.4);
    expect(resolvePose({ spine: { sideBend: ['left', 0.4] } }).spine.lateral).toBeCloseTo(-0.4);
    expect(resolvePose({ spine: { twist: ['left', 0.5] } }).spine.axial).toBeCloseTo(0.5);
  });
  it('raw {sagittal,lateral,axial} passes through unchanged', () => {
    expect(resolvePose({ spine: { sagittal: 0.2, axial: -0.1 } }).spine).toEqual({ sagittal: 0.2, lateral: 0, axial: -0.1 });
  });
  it('squash passes through as a deform factor', () => {
    expect(resolvePose({ squash: 0.85 }).squash).toBe(0.85);
    expect(resolvePose({}).squash).toBeUndefined();
  });
  it('weight + support pass through (stance channels)', () => {
    expect(resolvePose({ weight: 0.8 }).weight).toBe(0.8);
    expect(resolvePose({ support: 'R' }).support).toBe('R');
  });
});

describe('figure-posing — keyframeMotion', () => {
  it('hits each keypose exactly at its phase and loops back to the first', () => {
    const A = { elbowL: 'straight' };   // 0
    const B = { elbowL: 'full' };       // 145
    const move = keyframeMotion([A, B]);          // 2 keys, loop → segs=2
    expect(move(0).elbowL ?? 0).toBeCloseTo(0);   // pose A
    expect(move(0.5).elbowL).toBeCloseTo(145);    // pose B
    expect(move(1).elbowL ?? 0).toBeCloseTo(0);   // looped back to A
  });
  it('eases between keyposes (monotonic mid-segment, within range)', () => {
    const move = keyframeMotion([{ elbowL: 0 }, { elbowL: 100 }], { loop: false });
    const mid = move(0.5).elbowL;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(100);
  });
});

describe('figure-posing — performance layers', () => {
  const F = 30;
  const move = keyframeMotion([{ elbowL: 'straight' }, { elbowL: 'full' }]); // 0 → 145 → 0

  it('follow-through makes a distal channel lag then overshoot its keyframe', () => {
    const raw = Array.from({ length: F }, (_, i) => move(i / F).elbowL || 0);
    const live = performance(move, { frames: F, followThrough: { channels: ['elbowL'], k: 0.45, c: 0.42 }, idle: null });
    const lagged = Array.from({ length: F }, (_, i) => live(i / F).elbowL || 0);
    expect(Math.max(...lagged)).toBeGreaterThan(Math.max(...raw));        // overshoots the keyed peak
    expect(lagged.indexOf(Math.max(...lagged))).toBeGreaterThanOrEqual(raw.indexOf(Math.max(...raw))); // peaks no earlier
  });

  it('idle adds a breath/sway signal to spine + head even on a still pose', () => {
    const still = () => ({});
    const live = performance(still, { frames: F, followThrough: false, idle: { breath: 0.05, sway: 0.06 } });
    const lateral = Array.from({ length: F }, (_, i) => live(i / F).spine.lateral);
    expect(Math.max(...lateral)).toBeGreaterThan(0.01);                  // sway is present
    expect(Math.min(...lateral)).toBeLessThan(-0.01);                    // and oscillates both ways
  });

  it('with no layers it is a faithful (baked) passthrough of the motion', () => {
    const live = performance(move, { frames: F, followThrough: false, idle: null });
    expect(live(0.5).elbowL).toBeCloseTo(move(0.5).elbowL, 6);
  });

  it('exaggerate pushes every pose further from neutral', () => {
    const raw = performance(move, { frames: F, followThrough: false });
    const big = performance(move, { frames: F, exaggerate: 1.2, followThrough: false });
    const peak = (m) => Math.max(...Array.from({ length: F }, (_, i) => m(i / F).elbowL || 0));
    expect(peak(big)).toBeCloseTo(peak(raw) * 1.2, 4);
  });

  it('exaggerate scales angles but NOT the squash factor (neutral 1, not 0)', () => {
    const m = keyframeMotion([{ elbowL: 50, squash: 1 }, { elbowL: 50, squash: 0.8 }], { loop: false });
    const big = performance(m, { frames: F, exaggerate: 1.5, followThrough: false });
    expect(big(0).elbowL).toBeCloseTo(75, 4);        // 50 × 1.5
    expect(big(0).squash).toBeCloseTo(1, 4);          // unchanged (not 1.5)
  });

  it('anticipation winds up: a rising channel dips below its start before the rise', () => {
    const ramp = keyframeMotion([{ spine: { curl: 0 } }, { spine: { curl: 1 } }], { loop: false });
    const wound = performance(ramp, { frames: F, anticipation: { channels: ['spine.sagittal'], amount: 0.5, lead: 3 }, followThrough: false, idle: null });
    const series = Array.from({ length: F }, (_, i) => wound(i / F).spine.sagittal);
    expect(Math.min(...series)).toBeLessThan(0);   // a counter-dip appears before the curl
  });
});
