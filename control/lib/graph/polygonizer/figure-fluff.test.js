import { describe, it, expect } from 'vitest';
import { articulate } from './figure-vajra.js';
import { FLUFF_SHAPES, FLUFF_SHAPE_NAMES, FLUFF_CAP_RINGS, validateFluffs, buildFluffs, smoothMax, FLUFF_BLEND } from './figure-fluff.js';

const POS = articulate({});
const ringRadius = (rg) => rg.polyline.reduce((m, q) => Math.max(m, Math.hypot(q.x - rg.center.x, q.y - rg.center.y, q.z - rg.center.z)), 0);

describe('figure-fluff — validation (the table is CLOSED)', () => {
  it('accepts each shape at its defaults', () => {
    const specs = [
      { segment: ['hipL', 'kneeL'], shape: 'cone' },
      { segment: ['elbowR', 'wristR'], shape: 'football' },
      { node: 'headTop', shape: 'bead' },
      { segment: ['neckHub', 'navel'], shape: 'bell' },
      { segment: ['kneeL', 'ankleL'], shape: 'slab' },
    ];
    expect(validateFluffs(specs, POS)).toEqual([]);
  });

  it('rejects unknown shapes, unknown dials, and bad bindings', () => {
    expect(validateFluffs([{ segment: ['hipL', 'kneeL'], shape: 'blob' }], POS)[0]).toMatch(/shape/);
    expect(validateFluffs([{ segment: ['hipL', 'kneeL'], shape: 'cone', mouth: 0.2 }], POS)[0]).toMatch(/not a dial/);
    expect(validateFluffs([{ node: 'hipL', shape: 'cone' }], POS)[0]).toMatch(/binds a segment/);
    expect(validateFluffs([{ segment: ['hipL', 'kneeL'], shape: 'bead' }], POS)[0]).toMatch(/binds a node/);
    expect(validateFluffs([{ segment: ['hipL', 'nowhere'], shape: 'cone' }], POS)[0]).toMatch(/unknown landmark/);
    expect(validateFluffs([{ segment: ['hipL', 'hipL'], shape: 'cone' }], POS)[0]).toMatch(/must differ/);
  });

  it('clamp ranges hold (football peak/mouth)', () => {
    expect(validateFluffs([{ segment: ['elbowL', 'wristL'], shape: 'football', peak: 1.2 }], POS)[0]).toMatch(/≤ 0.95/);
    expect(validateFluffs([{ segment: ['elbowL', 'wristL'], shape: 'football', mouth: -0.1 }], POS)[0]).toMatch(/≥ 0/);
  });
});

describe('figure-fluff — profiles', () => {
  it('cone tapers linearly; taper > 1 FLARES (the boot)', () => {
    const d = { girth: 0.04, taper: 0.5 };
    expect(FLUFF_SHAPES.cone.profile(0, d)).toBeCloseTo(0.04, 6);
    expect(FLUFF_SHAPES.cone.profile(1, d)).toBeCloseTo(0.02, 6);
    const boot = { girth: 0.02, taper: 2.5 };
    expect(FLUFF_SHAPES.cone.profile(1, boot)).toBeGreaterThan(FLUFF_SHAPES.cone.profile(0, boot));
  });

  it('football bellies at `peak` and mouth truncates the span at the mouth radius', () => {
    const d = { girth: 0.034, peak: 0.42, mouth: 0 };
    expect(FLUFF_SHAPES.football.profile(0.42, d)).toBeCloseTo(0.034, 6);
    expect(FLUFF_SHAPES.football.profile(0.42, d)).toBeGreaterThan(FLUFF_SHAPES.football.profile(0.1, d));
    const cuff = { girth: 0.034, peak: 0.42, mouth: 0.5 };
    const span = FLUFF_SHAPES.football.span(cuff);
    expect(span).toBeGreaterThan(cuff.peak);
    expect(span).toBeLessThan(1);
    expect(FLUFF_SHAPES.football.profile(span, cuff)).toBeCloseTo(0.034 * 0.5, 3);   // the cuff ring
  });

  it('bell flares from girth to mouth; slab polar form is boxy', () => {
    const d = { girth: 0.02, mouth: 0.06 };
    expect(FLUFF_SHAPES.bell.profile(0, d)).toBeCloseTo(0.02, 6);
    expect(FLUFF_SHAPES.bell.profile(1, d)).toBeCloseTo(0.06, 6);
    const s = { girth: 0.03, depth: 0.015, n: 4, taper: 1 };
    expect(FLUFF_SHAPES.slab.polar(0, s)).toBeCloseTo(1, 6);                          // half-width at θ=0
    expect(FLUFF_SHAPES.slab.polar(Math.PI / 2, s)).toBeCloseTo(0.5, 6);              // depth/girth at θ=90°
    const diag = FLUFF_SHAPES.slab.polar(Math.PI / 4, s);
    const ellipse = FLUFF_SHAPES.slab.polar(Math.PI / 4, { ...s, n: 2 });
    expect(diag).toBeGreaterThan(ellipse);                                            // n>2 fills the corner
  });
});

describe('figure-fluff — buildFluffs (proto-shaped stacks)', () => {
  it('emits tagged ring-stacks in proto world units, ordered along the segment', () => {
    const stacks = buildFluffs(POS, [{ segment: ['hipL', 'kneeL'], shape: 'cone', girth: 0.046 }]);
    expect(stacks).toHaveLength(1);
    const st = stacks[0];
    expect(st.id).toBe('fluff:hipL-kneeL');
    expect(st.rings.length).toBeGreaterThan(2);
    for (const rg of st.rings) {
      expect(rg.center).toBeDefined();
      expect(rg.polyline.length).toBeGreaterThan(8);
    }
    // world = STAND × 12: first MAIN ring at the hip, last at the knee (cap
    // rings round the ends beyond them)
    expect(st.rings[FLUFF_CAP_RINGS].center.z).toBeCloseTo(POS.hipL.z * 12, 3);
    expect(st.rings.at(-1 - FLUFF_CAP_RINGS).center.z).toBeCloseTo(POS.kneeL.z * 12, 3);
    // proximal ring girthier than the tapered distal one
    expect(ringRadius(st.rings[FLUFF_CAP_RINGS])).toBeGreaterThan(ringRadius(st.rings.at(-1 - FLUFF_CAP_RINGS)));
    // closed chunk: both cap tips are tiny relative to the body
    expect(ringRadius(st.rings[0])).toBeLessThan(ringRadius(st.rings[FLUFF_CAP_RINGS]) * 0.1);
    expect(ringRadius(st.rings.at(-1))).toBeLessThan(ringRadius(st.rings.at(-1 - FLUFF_CAP_RINGS)) * 0.5);
  });

  it('fluffs ride articulation — a bent knee moves the boot rings with it', () => {
    const bent = articulate({ kneeL: 60 });
    const [straight] = buildFluffs(POS, [{ segment: ['kneeL', 'ankleL'], shape: 'cone', girth: 0.02, taper: 2.4 }]);
    const [posed] = buildFluffs(bent, [{ segment: ['kneeL', 'ankleL'], shape: 'cone', girth: 0.02, taper: 2.4 }]);
    const d = Math.hypot(
      posed.rings.at(-1).center.x - straight.rings.at(-1).center.x,
      posed.rings.at(-1).center.y - straight.rings.at(-1).center.y,
      posed.rings.at(-1).center.z - straight.rings.at(-1).center.z,
    );
    expect(d).toBeGreaterThan(0.5);   // the ankle end swung away
  });

  it('superposition: same-segment fluffs merge into ONE stack, radius ≥ each member', () => {
    const solo = buildFluffs(POS, [{ segment: ['elbowL', 'wristL'], shape: 'football', girth: 0.03 }])[0];
    const merged = buildFluffs(POS, [
      { segment: ['elbowL', 'wristL'], shape: 'football', girth: 0.03 },
      { segment: ['elbowL', 'wristL'], shape: 'cone', girth: 0.012, taper: 1 },
    ]);
    expect(merged).toHaveLength(1);
    for (let i = 0; i < solo.rings.length; i++) {
      expect(ringRadius(merged[0].rings[i])).toBeGreaterThanOrEqual(ringRadius(solo.rings[i]) - 1e-9);
    }
  });

  it('truncated football ends at the cuff ring (open mouth), not the wrist', () => {
    const closed = buildFluffs(POS, [{ segment: ['elbowR', 'wristR'], shape: 'football', girth: 0.034, peak: 0.42 }])[0];
    const cuffed = buildFluffs(POS, [{ segment: ['elbowR', 'wristR'], shape: 'football', girth: 0.034, peak: 0.42, mouth: 0.45 }])[0];
    expect(cuffed.rings.at(-1).center.z).toBeGreaterThan(closed.rings.at(-1).center.z);   // stops short (arm hangs down)
    expect(ringRadius(cuffed.rings.at(-1))).toBeGreaterThan(0.034 * 0.45 * 12 * 0.8);     // fat open mouth, no taper to a point
  });

  it('bead binds a node; bias shifts the mass', () => {
    const [fist] = buildFluffs(POS, [{ node: 'wristL', shape: 'bead', r: 0.03, bias: { z: -0.02 } }]);
    expect(fist.id).toBe('fluff:wristL');
    const midZ = (fist.rings[0].center.z + fist.rings.at(-1).center.z) / 2;
    expect(midZ).toBeLessThan(POS.wristL.z * 12);   // dropped below the wrist
  });

  it('throws on invalid specs (mint-time posture) and honors id/hex passthrough', () => {
    expect(() => buildFluffs(POS, [{ segment: ['hipL', 'kneeL'], shape: 'blob' }])).toThrow(/shape/);
    const [st] = buildFluffs(POS, [{ segment: ['hipL', 'kneeL'], shape: 'cone', id: 'legL', hex: '#2f7fd6' }]);
    expect(st.id).toBe('legL');
    expect(st.hex).toBe('#2f7fd6');
  });

  it('smoothMax is a soft union: ≥ max, ≤ max + blend', () => {
    for (const [a, b] of [[1, 1], [1, 0.5], [0.2, 0.9]]) {
      const m = smoothMax(a, b, FLUFF_BLEND);
      expect(m).toBeGreaterThanOrEqual(Math.max(a, b) - 1e-12);
      expect(m).toBeLessThanOrEqual(Math.max(a, b) + FLUFF_BLEND);
    }
  });

  it('every shape name in the table builds without error', () => {
    for (const name of FLUFF_SHAPE_NAMES) {
      const shape = FLUFF_SHAPES[name];
      const spec = shape.binds === 'node' ? { node: 'headTop', shape: name } : { segment: ['neckHub', 'navel'], shape: name };
      expect(() => buildFluffs(POS, [spec])).not.toThrow();
    }
  });
});
