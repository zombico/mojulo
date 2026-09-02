/**
 * Tests for the free-angle-modulation work
 * (lite-template/integration/0902/free-angle-modulation.plan.md).
 *
 * Phase 1 — continuous tail angles: the object form
 * `{ target: '<perpendicular>', angle }` generalizes the discrete tail
 * grammar along one continuum (0 ≡ open, 90 ≡ the perpendicular fold,
 * 180 ≡ closed, negative folds away). String targets stay on the exact
 * lookup path; the equivalence trio must be EXACT (not approximate) —
 * that is the compat promise's edge.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveCardinalTail,
  resolveCardinalTail3D,
  cardinalBar,
  validateCardinalBar,
  evaluateBar3D,
  cardinalManji3D,
  evaluateManji3D,
  validateCardinalManji3D,
  CARDINAL_VECTORS_3D,
} from './manji.js';
import {
  walkManjiTree,
  walkManjiTree3D,
  validateManjiTree3D,
  validateStructureManjiFieldRefs,
} from './manji-program.js';

const COS35 = Math.cos((35 * Math.PI) / 180);
const SIN35 = Math.sin((35 * Math.PI) / 180);

describe('2D continuous tail angles', () => {
  it('equivalence trio: angle 0 / 90 / 180 reproduce open / perpendicular / closed exactly', () => {
    expect(resolveCardinalTail('N-S', 'N', { target: 'E', angle: 0 }))
      .toBe(resolveCardinalTail('N-S', 'N', 'open'));
    expect(resolveCardinalTail('N-S', 'N', { target: 'E', angle: 90 }))
      .toBe(resolveCardinalTail('N-S', 'N', 'E'));
    expect(resolveCardinalTail('N-S', 'N', { target: 'E', angle: 180 }))
      .toBe(resolveCardinalTail('N-S', 'N', 'closed'));
    expect(resolveCardinalTail('E-W', 'W', { target: 'S', angle: 90 }))
      .toBe(resolveCardinalTail('E-W', 'W', 'S'));
  });

  it('intermediate angles scale the perpendicular sign', () => {
    expect(resolveCardinalTail('N-S', 'N', { target: 'E', angle: 60 })).toBe(60);
    expect(resolveCardinalTail('N-S', 'N', { target: 'W', angle: 60 })).toBe(-60);
    expect(resolveCardinalTail('E-W', 'E', { target: 'S', angle: 45 })).toBe(-45);
  });

  it('negative angle ≡ positive angle toward the opposite perpendicular', () => {
    expect(resolveCardinalTail('N-S', 'N', { target: 'E', angle: -60 }))
      .toBe(resolveCardinalTail('N-S', 'N', { target: 'W', angle: 60 }));
  });

  it('rejects non-perpendicular angled targets and out-of-range angles', () => {
    expect(() => resolveCardinalTail('N-S', 'N', { target: 'N', angle: 45 })).toThrow(/perpendicular/);
    expect(() => resolveCardinalTail('N-S', 'N', { target: 'open', angle: 45 })).toThrow(/perpendicular/);
    expect(() => resolveCardinalTail('N-S', 'N', { target: 'Zenith', angle: 45 })).toThrow(/perpendicular/);
    expect(() => resolveCardinalTail('N-S', 'N', { target: 'E', angle: 200 })).toThrow(/out of range/);
    expect(() => resolveCardinalTail('N-S', 'N', { target: 'E', angle: -180 })).toThrow(/out of range/);
    expect(() => resolveCardinalTail('N-S', 'N', { target: 'E', angle: NaN })).toThrow(/finite/);
    expect(() => resolveCardinalTail('N-S', 'N', { target: 'E' })).toThrow(/finite/);
  });

  it('cardinalBar passes angled tails through and validateCardinalBar accepts the result', () => {
    const bar = cardinalBar({ axis: 'N-S', tails: { N: { target: 'E', angle: 60 }, S: 'closed' } });
    expect(bar.leftTailDeg).toBe(60);
    expect(bar.rightTailDeg).toBe(180);
    expect(validateCardinalBar(bar)).toEqual([]);
  });

  it('validateCardinalBar still rejects non-cardinal bar ORIENTATION and non-finite tails', () => {
    expect(validateCardinalBar({ rotationDeg: 45, leftTailDeg: 0, rightTailDeg: 0 })).not.toEqual([]);
    expect(validateCardinalBar({ rotationDeg: 0, leftTailDeg: NaN, rightTailDeg: 0 })).not.toEqual([]);
  });
});

describe('3D continuous tail angles', () => {
  it('equivalence trio is EXACT (bit-for-bit the string grammar vectors)', () => {
    expect(resolveCardinalTail3D('E-W', 'E', { target: 'Zenith', angle: 0 }))
      .toEqual(resolveCardinalTail3D('E-W', 'E', 'open'));
    expect(resolveCardinalTail3D('E-W', 'E', { target: 'Zenith', angle: 90 }))
      .toEqual(resolveCardinalTail3D('E-W', 'E', 'Zenith'));
    expect(resolveCardinalTail3D('E-W', 'E', { target: 'Zenith', angle: 180 }))
      .toEqual(resolveCardinalTail3D('E-W', 'E', 'closed'));
    // exactness, not closeness: components are the literal 0/±1 lookups
    const at90 = resolveCardinalTail3D('N-S', 'S', { target: 'Nadir', angle: 90 });
    expect(Object.is(at90.z, -1)).toBe(true);
    expect(Object.is(at90.x, 0) || Object.is(at90.x, -0)).toBe(true);
  });

  it('35° fold is cos·openDir + sin·targetDir', () => {
    const dir = resolveCardinalTail3D('N-S', 'N', { target: 'Zenith', angle: 35 });
    const open = CARDINAL_VECTORS_3D.N;
    expect(dir.x).toBeCloseTo(COS35 * open.x, 12);
    expect(dir.y).toBeCloseTo(0, 12);
    expect(dir.z).toBeCloseTo(SIN35, 12);
  });

  it('negative angle ≡ positive angle toward the opposite perpendicular', () => {
    const neg = resolveCardinalTail3D('N-S', 'N', { target: 'Zenith', angle: -35 });
    const pos = resolveCardinalTail3D('N-S', 'N', { target: 'Nadir', angle: 35 });
    expect(neg.x).toBeCloseTo(pos.x, 12);
    expect(neg.y).toBeCloseTo(pos.y, 12);
    expect(neg.z).toBeCloseTo(pos.z, 12);
  });

  it('rejects non-perpendicular angled targets (addressing stays cardinal)', () => {
    expect(() => resolveCardinalTail3D('N-S', 'N', { target: 'S', angle: 45 })).toThrow(/perpendicular/);
    expect(() => resolveCardinalTail3D('Zenith-Nadir', 'Zenith', { target: 'Zenith', angle: 30 })).toThrow(/perpendicular/);
    expect(() => resolveCardinalTail3D('N-S', 'N', { target: 'E', angle: 181 })).toThrow(/out of range/);
  });

  it('evaluateBar3D places an angled tip at end + L·dir(θ)', () => {
    const bar = evaluateBar3D({ axis: 'E-W', tails: { E: { target: 'Zenith', angle: 35 } }, lengthScale: 1 });
    const { posEnd, posTip } = bar.points;
    const L = posEnd.y; // E end sits at +y = SEGMENT_LENGTH·lengthScale
    expect(posTip.y).toBeCloseTo(posEnd.y + L * COS35, 12);
    expect(posTip.z).toBeCloseTo(L * SIN35, 12);
    expect(posTip.x).toBeCloseTo(0, 12);
  });

  it('validateCardinalManji3D accepts angled tails and rejects malformed ones', () => {
    const good = cardinalManji3D({
      bar1: { axis: 'N-S', tails: { N: { target: 'E', angle: 35 } } },
      bar2: { axis: 'E-W', tails: { E: { target: 'Zenith', angle: 60 }, W: 'open' } },
    });
    expect(validateCardinalManji3D(good)).toEqual([]);
    const bad = cardinalManji3D({
      bar1: { axis: 'N-S', tails: { N: { target: 'N', angle: 35 } } },
    });
    expect(validateCardinalManji3D(bad)).not.toEqual([]);
  });
});

describe('3D bar cant (phase 2)', () => {
  const L = 1; // SEGMENT_LENGTH-relative assertions below use ratios instead

  it('cant angle 0 is exactly the uncanted bar', () => {
    const flat = evaluateBar3D({ axis: 'E-W', tails: { E: 'Zenith', W: 'open' } });
    const canted = evaluateBar3D({ axis: 'E-W', tails: { E: 'Zenith', W: 'open' }, cant: { toward: 'Zenith', angle: 0 } });
    expect(canted).toEqual(flat);
  });

  it('a 35° cant leans the bar ends into the cant plane', () => {
    const bar = evaluateBar3D({ axis: 'E-W', tails: {}, cant: { toward: 'Zenith', angle: 35 } });
    const { posEnd, negEnd } = bar.points;
    const len = Math.hypot(posEnd.x, posEnd.y, posEnd.z);
    expect(posEnd.y).toBeCloseTo(len * COS35, 12);
    expect(posEnd.z).toBeCloseTo(len * SIN35, 12);
    expect(posEnd.x).toBeCloseTo(0, 12);
    expect(negEnd.y).toBeCloseTo(-posEnd.y, 12);
    expect(negEnd.z).toBeCloseTo(-posEnd.z, 12);
  });

  it('open tails follow the canted axis (tips stay colinear)', () => {
    const bar = evaluateBar3D({ axis: 'E-W', tails: { E: 'open', W: 'open' }, cant: { toward: 'Zenith', angle: 35 } });
    const { posEnd, posTip } = bar.points;
    expect(posTip.x).toBeCloseTo(2 * posEnd.x, 12);
    expect(posTip.y).toBeCloseTo(2 * posEnd.y, 12);
    expect(posTip.z).toBeCloseTo(2 * posEnd.z, 12);
  });

  it('perpendicular folds are Gram-Schmidt re-orthogonalized against the canted axis', () => {
    // axisDir = cos35·E + sin35·Z; fold 'Zenith' in that frame is
    // −sin35·E + cos35·Z (unit, ⊥ axisDir, in the E–Z plane).
    const bar = evaluateBar3D({ axis: 'E-W', tails: { E: 'Zenith' }, cant: { toward: 'Zenith', angle: 35 } });
    const { posEnd, posTip } = bar.points;
    const seg = Math.hypot(posEnd.x, posEnd.y, posEnd.z); // = L in local units
    const foldDir = {
      x: (posTip.x - posEnd.x) / seg,
      y: (posTip.y - posEnd.y) / seg,
      z: (posTip.z - posEnd.z) / seg,
    };
    expect(foldDir.x).toBeCloseTo(0, 12);
    expect(foldDir.y).toBeCloseTo(-SIN35, 12);
    expect(foldDir.z).toBeCloseTo(COS35, 12);
    // orthonormal to the canted axis
    const axisDir = { x: 0, y: COS35, z: SIN35 };
    const dot = foldDir.x * axisDir.x + foldDir.y * axisDir.y + foldDir.z * axisDir.z;
    expect(dot).toBeCloseTo(0, 12);
  });

  it('the distinct-axis rule still keys on the NAME (canted or not)', () => {
    const program = cardinalManji3D({
      bar1: { axis: 'E-W', tails: {} },
      bar2: { axis: 'E-W', tails: {}, cant: { toward: 'Zenith', angle: 30 } },
    });
    expect(() => evaluateManji3D(program, { x: 0, y: 0, z: 0 }, 1)).toThrow(/two bars on axis/);
  });

  it('validateCardinalManji3D reports bad cants', () => {
    const badToward = cardinalManji3D({ bar1: { axis: 'E-W', tails: {}, cant: { toward: 'E', angle: 30 } } });
    expect(validateCardinalManji3D(badToward).join(' ')).toMatch(/perpendicular/);
    const badAngle = cardinalManji3D({ bar1: { axis: 'E-W', tails: {}, cant: { toward: 'Zenith', angle: 90 } } });
    expect(validateCardinalManji3D(badAngle).join(' ')).toMatch(/out of range/);
    const good = cardinalManji3D({ bar1: { axis: 'E-W', tails: { E: { target: 'Zenith', angle: 35 } }, cant: { toward: 'Zenith', angle: 12 } } });
    expect(validateCardinalManji3D(good)).toEqual([]);
  });

  it('reflect E-W of a cant toward E ≡ unreflected cant toward W', () => {
    const spec = (toward) => ({
      id: 'probe',
      anchor: { x: 0, y: 0, z: 0 },
      spine: { bar1: { axis: 'N-S', tails: { N: 'open', S: 'open' }, cant: { toward, angle: 35 } } },
      slots: [],
    });
    const reflected = walkManjiTree3D({ ...spec('E'), reflect: 'E-W' }, () => null);
    const mirrored = walkManjiTree3D(spec('W'), () => null);
    const tipsA = reflected[0].spineManji.armTips;
    const tipsB = mirrored[0].spineManji.armTips;
    tipsA.forEach((tip, i) => {
      expect(tip.x).toBeCloseTo(tipsB[i].x, 12);
      expect(tip.y).toBeCloseTo(tipsB[i].y, 12);
      expect(tip.z).toBeCloseTo(tipsB[i].z, 12);
    });
  });

  it('cant does not disturb node rotation scope (slots rotate; the spine evaluation is upstream of the hub)', () => {
    // node.rotation is the X-manji-center HUB: it rotates slot positions
    // (and limb-chain frames via nodeRotation) — it has never rotated
    // the spine bars themselves. Cant must not change that contract.
    const base = {
      id: 'probe',
      anchor: { x: 0, y: 0, z: 0 },
      spine: { bar1: { axis: 'E-W', tails: { E: 'Zenith', W: 'open' }, cant: { toward: 'Zenith', angle: 20 } } },
      slots: [{ id: 'hand', position: { x: 1, y: 0, z: 0 } }],
    };
    const plain = walkManjiTree3D(base, () => null)[0];
    const rotated = walkManjiTree3D(
      { ...base, rotation: [{ axis: 'Zenith-Nadir', angle: 90 }] },
      () => null,
    )[0];
    // spine untouched by the hub rotation, canted or not
    rotated.spineManji.armTips.forEach((tip, i) => {
      expect(tip).toEqual(plain.spineManji.armTips[i]);
    });
    // slots rotate exactly as they would without cant
    const hand = rotated.slots.find((s) => s.id === 'hand').worldPosition;
    expect(hand.x).toBeCloseTo(0, 12);
    expect(hand.y).toBeCloseTo(1, 12);
    expect(hand.z).toBeCloseTo(0, 12);
  });
});

describe('2D bar cant (phase 2)', () => {
  it('cant 0 emits no cant field (byte-compat with the pre-cant program shape)', () => {
    const bar = cardinalBar({ axis: 'N-S', tails: { N: 'open', S: 'open' } });
    expect('cant' in bar).toBe(false);
  });

  it('cant shifts rotationDeg and is carried for the validator', () => {
    const flat = cardinalBar({ axis: 'E-W', tails: { E: 'N', W: 'open' } });
    const canted = cardinalBar({ axis: 'E-W', tails: { E: 'N', W: 'open' }, cant: 12 });
    expect(canted.rotationDeg).toBe(flat.rotationDeg + 12);
    expect(canted.cant).toBe(12);
    expect(validateCardinalBar(canted)).toEqual([]);
  });

  it('undeclared free rotation is still rejected; declared cant is sanctioned', () => {
    expect(validateCardinalBar({ rotationDeg: 45, leftTailDeg: 0, rightTailDeg: 0 })).not.toEqual([]);
    expect(validateCardinalBar({ rotationDeg: 45, leftTailDeg: 0, rightTailDeg: 0, cant: 45 })).toEqual([]);
    expect(() => cardinalBar({ axis: 'N-S', cant: 90 })).toThrow(/out of range/);
  });
});

describe('field-borne angles (phase 3)', () => {
  const WIND = {
    wind: {
      kind: 'gradient',
      from: { x: 0, y: 0, z: 0 },
      to: { x: 0, y: 4, z: 0 },
      fromValue: 0,
      toValue: 40,
      beyond: 'clamp',
    },
  };

  it('a gradient field cants a replicated row progressively (wind-bent grove)', () => {
    const tree = {
      replicate: { offsets: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 2, z: 0 }, { x: 0, y: 4, z: 0 }] },
      node: {
        id: 'post',
        spine: {
          bar1: {
            axis: 'Zenith-Nadir',
            tails: { Zenith: 'open', Nadir: 'open' },
            cant: { toward: 'E', angle: { field: 'wind' } },
          },
        },
        slots: [],
      },
    };
    const emitted = walkManjiTree3D(tree, () => null, { fields: WIND });
    expect(emitted.length).toBe(3);
    // lean = y-displacement of the Zenith-end tip relative to the anchor;
    // wind grows along +y, so each post leans further than the last
    const leans = emitted.map((node) => {
      const topTip = node.spineManji.armTips.reduce((a, b) => (a.z > b.z ? a : b));
      return topTip.y - node.anchor.y;
    });
    expect(leans[0]).toBeCloseTo(0, 9); // wind 0 at y=0 — perfectly upright
    expect(leans[1]).toBeGreaterThan(leans[0]);
    expect(leans[2]).toBeGreaterThan(leans[1]);
  });

  it('a field-borne tail angle resolves at the node worldAnchor', () => {
    const at = (y) => walkManjiTree3D({
      id: 'probe',
      anchor: { x: 0, y, z: 0 },
      spine: { bar1: { axis: 'N-S', tails: { N: { target: 'Zenith', angle: { field: 'wind' } }, S: 'open' } } },
      slots: [],
    }, () => null, { fields: WIND })[0];
    const tipZ = (node) => Math.max(...node.spineManji.armTips.map((t) => t.z));
    expect(tipZ(at(0))).toBeCloseTo(0, 9);       // angle 0 → open, flat
    expect(tipZ(at(4))).toBeGreaterThan(tipZ(at(2))); // stronger fold downwind
  });

  it('validateStructureManjiFieldRefs covers cant.angle and tail angles', () => {
    const tree = {
      id: 'root',
      spine: {
        bar1: {
          axis: 'N-S',
          tails: { N: { target: 'E', angle: { field: 'missing-tail' } } },
          cant: { toward: 'E', angle: { field: 'missing-cant' } },
        },
      },
      slots: [],
    };
    const errors = validateStructureManjiFieldRefs(tree, WIND);
    expect(errors.join(' ')).toMatch(/cant\.angle.*missing-cant|missing-cant/);
    expect(errors.join(' ')).toMatch(/tails\.N\.angle.*missing-tail|missing-tail/);
    const ok = validateStructureManjiFieldRefs({
      id: 'root',
      spine: {
        bar1: {
          axis: 'N-S',
          tails: { N: { target: 'E', angle: { field: 'wind' } } },
          cant: { toward: 'E', angle: { field: 'wind' } },
        },
      },
      slots: [],
    }, WIND);
    expect(ok).toEqual([]);
  });

  it('validateCardinalManji3D tolerates field-ref angles at mint but still checks target names', () => {
    const deferred = cardinalManji3D({
      bar1: {
        axis: 'E-W',
        tails: { E: { target: 'Zenith', angle: { field: 'wind' } } },
        cant: { toward: 'Zenith', angle: { field: 'wind' } },
      },
    });
    expect(validateCardinalManji3D(deferred)).toEqual([]);
    const badName = cardinalManji3D({
      bar1: { axis: 'E-W', tails: { E: { target: 'E', angle: { field: 'wind' } } } },
    });
    expect(validateCardinalManji3D(badName).join(' ')).toMatch(/perpendicular/);
  });
});

describe('rotational replicate (phase 4)', () => {
  const RADIUS = 2;
  const spokeTree = (extra = {}) => ({
    replicate: {
      offsets: Array.from({ length: 6 }, () => ({ x: RADIUS, y: 0, z: 0 })),
      angleStep: { angle: 60 },
      ...extra.replicate,
    },
    ...extra.wrapper,
    node: {
      id: 'spoke',
      spine: { bar1: { axis: 'E-W', tails: { E: 'open', W: 'open' } } },
      slots: [{ id: 'tip', position: { x: 0, y: 1, z: 0 } }],
    },
  });

  it('six identical offsets + angleStep 60 form a hexagonal ring of anchors', () => {
    const emitted = walkManjiTree3D(spokeTree(), () => null);
    expect(emitted.length).toBe(6);
    const angles = emitted.map((n) => Math.atan2(n.anchor.y, n.anchor.x) * (180 / Math.PI));
    emitted.forEach((n, i) => {
      expect(Math.hypot(n.anchor.x, n.anchor.y)).toBeCloseTo(RADIUS, 12);
      expect(n.anchor.z).toBeCloseTo(0, 12);
      const expected = ((60 * i + 180) % 360) - 180; // normalize to (-180, 180]
      const got = ((angles[i] + 180 + 360) % 360) - 180;
      expect(got).toBeCloseTo(expected, 9);
    });
  });

  it('the spine and slots rotate rigidly with the instance', () => {
    const emitted = walkManjiTree3D(spokeTree(), () => null);
    const first = emitted[0];
    const half = emitted[3]; // 180° — the mirror spoke
    // 180° about Zenith through the group anchor (origin): (x,y) → (−x,−y)
    first.spineManji.armTips.forEach((tip, i) => {
      expect(half.spineManji.armTips[i].x).toBeCloseTo(-tip.x, 12);
      expect(half.spineManji.armTips[i].y).toBeCloseTo(-tip.y, 12);
      expect(half.spineManji.armTips[i].z).toBeCloseTo(tip.z, 12);
    });
    const tipA = first.slots[0].worldPosition;
    const tipB = half.slots[0].worldPosition;
    expect(tipB.x).toBeCloseTo(-tipA.x, 12);
    expect(tipB.y).toBeCloseTo(-tipA.y, 12);
  });

  it('composes with scaleStep (spiral: rotation + per-instance taper)', () => {
    const emitted = walkManjiTree3D(
      spokeTree({ wrapper: { scaleStep: 0.8 } }),
      () => null,
    );
    const armSpan = (n) => {
      const [a, b] = n.spineManji.armTips;
      return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    };
    const base = armSpan(emitted[0]);
    emitted.forEach((n, i) => {
      expect(armSpan(n)).toBeCloseTo(base * Math.pow(0.8, i), 9);
    });
  });

  it('composes the instance rotation into nodeRotation (limb-chain frames follow)', () => {
    const emitted = walkManjiTree3D(spokeTree(), () => null);
    const quarter = emitted[1]; // 60°
    const rotated = quarter.nodeRotation({ x: 1, y: 0, z: 0 });
    expect(rotated.x).toBeCloseTo(Math.cos(Math.PI / 3), 12);
    expect(rotated.y).toBeCloseTo(Math.sin(Math.PI / 3), 12);
  });

  it('angleStep 0 or absent leaves output identical (compat)', () => {
    const withZero = walkManjiTree3D(spokeTree({ replicate: { angleStep: { angle: 0 } } }), () => null);
    const without = walkManjiTree3D(spokeTree({ replicate: { angleStep: undefined } }), () => null);
    expect(withZero).toEqual(without);
  });

  it('validateManjiTree3D reports malformed angleStep', () => {
    const badAngle = validateManjiTree3D(spokeTree({ replicate: { angleStep: { angle: NaN } } }), () => null);
    expect(badAngle.join(' ')).toMatch(/finite angle/);
    const badAxis = validateManjiTree3D(
      spokeTree({ replicate: { angleStep: { angle: 30, axis: 'diagonal' } } }),
      () => null,
    );
    expect(badAxis.join(' ')).toMatch(/cardinal label|non-zero/);
  });

  it('2D angleStep rotates in the picture plane', () => {
    const tree = {
      replicate: {
        offsets: Array.from({ length: 4 }, () => ({ x: 3, y: 0 })),
        angleStep: { angle: 90 },
      },
      node: {
        id: 'petal',
        spine: {
          bar1: { axis: 'N-S', tails: { N: 'open', S: 'open' } },
          bar2: { axis: 'E-W', tails: { E: 'open', W: 'open' } },
        },
      },
    };
    const emitted = walkManjiTree(tree, () => null);
    expect(emitted.length).toBe(4);
    expect(emitted[0].anchor.x).toBeCloseTo(3, 12);
    expect(emitted[1].anchor.y).toBeCloseTo(3, 12);
    expect(emitted[2].anchor.x).toBeCloseTo(-3, 12);
    expect(emitted[3].anchor.y).toBeCloseTo(-3, 12);
  });
});

describe('reflection closure over angled tails', () => {
  it('reflect E-W of a +35°-toward-E fold ≡ unreflected +35°-toward-W fold', () => {
    const spec = (target) => ({
      id: 'probe',
      anchor: { x: 0, y: 0, z: 0 },
      spine: { bar1: { axis: 'N-S', tails: { N: { target, angle: 35 }, S: 'open' } } },
      slots: [],
    });
    const reflected = walkManjiTree3D({ ...spec('E'), reflect: 'E-W' }, () => null);
    const mirrored = walkManjiTree3D(spec('W'), () => null);
    const tipsA = reflected[0].spineManji.armTips;
    const tipsB = mirrored[0].spineManji.armTips;
    expect(tipsA.length).toBe(tipsB.length);
    tipsA.forEach((tip, i) => {
      expect(tip.x).toBeCloseTo(tipsB[i].x, 12);
      expect(tip.y).toBeCloseTo(tipsB[i].y, 12);
      expect(tip.z).toBeCloseTo(tipsB[i].z, 12);
    });
  });
});
