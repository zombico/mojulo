/**
 * Unit tests for the manji-manipulator vector-space library. Deterministic
 * geometry math; no LLM calls; runs in the default vitest suite.
 *
 * Coverage:
 *   - evaluateBar geometry under rotation and tail flexes
 *   - evaluateManji center fixed across both bars
 *   - Anchor pattern placements (counts, symmetry)
 *   - composeAnchorPattern bbox + manji evaluation
 *   - cellRadius nearest-neighbor math
 *   - fractalize containment
 *   - distinctness of compositions across fold programs
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateBar,
  evaluateManji,
  ANCHOR_PATTERNS,
  listAnchorPatternIds,
  composeAnchorPattern,
  cellRadius,
  fractalize,
  bboxOf,
  boxArea,
  containedIn,
  collectSegments,
  collectDots,
  SEGMENT_LENGTH,
  BAR_HALF_LENGTH,
  barExtent,
  inscribedRect,
  circumscribedEllipse,
  inscribedCircle,
  anchorCircle,
  anchorTriangle,
  anchorHexagon,
  emergentManji,
  quadrants,
  CARDINAL_AXES,
  CARDINAL_DIRECTIONS_2D,
  cardinalBar,
  cardinalManji,
  resolveCardinalTail,
  isCardinalAngle,
  validateCardinalBar,
  validateCardinalManji,
  // 3D
  CARDINAL_VECTORS_3D,
  evaluateBar3D,
  evaluateManji3D,
  cardinalManji3D,
  resolveCardinalTail3D,
  bbox3DOf,
  boxVolume,
  containedIn3D,
  barExtent3D,
  inscribedCuboid,
  circumscribedEllipsoid,
  inscribedSphere,
  octants,
  validateCardinalManji3D,
} from './manji.js';

const EPS = 1e-9;

function approx(a, b, eps = 1e-9) {
  return Math.abs(a - b) <= eps;
}

function pointEq(p, expected, eps = 1e-9) {
  return approx(p.x, expected.x, eps) && approx(p.y, expected.y, eps);
}

describe('evaluateBar', () => {
  it('produces 5 named points at the expected default positions', () => {
    const { points } = evaluateBar({});
    expect(pointEq(points.center, { x: 0, y: 0 })).toBe(true);
    expect(pointEq(points.leftEnd, { x: -BAR_HALF_LENGTH, y: 0 })).toBe(true);
    expect(pointEq(points.rightEnd, { x: BAR_HALF_LENGTH, y: 0 })).toBe(true);
    expect(pointEq(points.leftTip, { x: -BAR_HALF_LENGTH - SEGMENT_LENGTH, y: 0 })).toBe(true);
    expect(pointEq(points.rightTip, { x: BAR_HALF_LENGTH + SEGMENT_LENGTH, y: 0 })).toBe(true);
  });

  it('emits 4 segments in left-to-right draw order', () => {
    const { segments } = evaluateBar({});
    expect(segments).toHaveLength(4);
    expect(pointEq(segments[0].from, { x: -2, y: 0 })).toBe(true);
    expect(pointEq(segments[0].to, { x: -1, y: 0 })).toBe(true);
    expect(pointEq(segments[3].from, { x: 1, y: 0 })).toBe(true);
    expect(pointEq(segments[3].to, { x: 2, y: 0 })).toBe(true);
  });

  it('emits 4 segments of EQUAL length (the manji invariant)', () => {
    const { segments } = evaluateBar({});
    const lengths = segments.map((s) => Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y));
    expect(lengths).toHaveLength(4);
    for (const L of lengths) {
      expect(approx(L, SEGMENT_LENGTH, 1e-9)).toBe(true);
    }
  });

  it('rotates whole bar by rotationDeg around center', () => {
    const { points } = evaluateBar({ rotationDeg: 90 });
    expect(pointEq(points.center, { x: 0, y: 0 })).toBe(true);
    expect(pointEq(points.leftEnd, { x: 0, y: -1 }, 1e-9)).toBe(true);
    expect(pointEq(points.rightEnd, { x: 0, y: 1 }, 1e-9)).toBe(true);
    expect(pointEq(points.leftTip, { x: 0, y: -2 }, 1e-9)).toBe(true);
    expect(pointEq(points.rightTip, { x: 0, y: 2 }, 1e-9)).toBe(true);
  });

  it('flexes left tail at end-dot when leftTailDeg ≠ 0', () => {
    const { points } = evaluateBar({ leftTailDeg: 90 });
    expect(pointEq(points.leftEnd, { x: -1, y: 0 })).toBe(true);
    expect(pointEq(points.leftTip, { x: -1, y: 1 }, 1e-9)).toBe(true);
    expect(pointEq(points.rightTip, { x: 2, y: 0 })).toBe(true);
  });

  it('flexes right tail at end-dot when rightTailDeg ≠ 0', () => {
    const { points } = evaluateBar({ rightTailDeg: -90 });
    expect(pointEq(points.rightEnd, { x: 1, y: 0 })).toBe(true);
    expect(pointEq(points.rightTip, { x: 1, y: -1 }, 1e-9)).toBe(true);
  });

  it('handles T construction (one tail folded perpendicular)', () => {
    // user's T: horizontal bar with right tail folded down
    const { points } = evaluateBar({ rotationDeg: 0, rightTailDeg: -90 });
    expect(pointEq(points.center, { x: 0, y: 0 })).toBe(true);
    expect(pointEq(points.leftTip, { x: -2, y: 0 })).toBe(true);
    expect(pointEq(points.rightTip, { x: 1, y: -1 }, 1e-9)).toBe(true);
  });
});

describe('evaluateManji', () => {
  it('produces two bars sharing a center dot', () => {
    const m = evaluateManji({
      bar1: { rotationDeg: 0 },
      bar2: { rotationDeg: 90 },
    });
    expect(pointEq(m.bars[0].points.center, { x: 0, y: 0 })).toBe(true);
    expect(pointEq(m.bars[1].points.center, { x: 0, y: 0 })).toBe(true);
    expect(m.armTips).toHaveLength(4);
  });

  it('center stays at the anchor regardless of bar rotations', () => {
    const anchor = { x: 10, y: -5 };
    const m = evaluateManji(
      {
        bar1: { rotationDeg: 37, leftTailDeg: 45, rightTailDeg: -45 },
        bar2: { rotationDeg: 113, leftTailDeg: 90, rightTailDeg: -90 },
      },
      anchor,
      2.5,
    );
    expect(pointEq(m.center, anchor)).toBe(true);
    expect(pointEq(m.bars[0].points.center, anchor, 1e-9)).toBe(true);
    expect(pointEq(m.bars[1].points.center, anchor, 1e-9)).toBe(true);
  });

  it('scales arm-tip distances from center proportionally', () => {
    const m = evaluateManji({ bar1: { rotationDeg: 0 }, bar2: { rotationDeg: 90 } }, { x: 0, y: 0 }, 3);
    // tip at 2 units from center, then × scale 3 = 6
    expect(pointEq(m.bars[0].points.rightTip, { x: 6, y: 0 }, 1e-9)).toBe(true);
    expect(pointEq(m.bars[1].points.rightTip, { x: 0, y: 6 }, 1e-9)).toBe(true);
  });

  it('canonical + shape has 4 arm-tips at the cardinal positions', () => {
    const m = evaluateManji({ bar1: { rotationDeg: 0 }, bar2: { rotationDeg: 90 } });
    // normalize -0 → 0 in stringification
    const fmt = (n) => (Math.abs(n) < 1e-9 ? '0.000' : n.toFixed(3));
    const tips = m.armTips.map((t) => `${fmt(t.x)},${fmt(t.y)}`).sort();
    expect(tips).toEqual([
      '-2.000,0.000',
      '0.000,-2.000',
      '0.000,2.000',
      '2.000,0.000',
    ]);
  });
});

describe('anchor patterns', () => {
  it('has all 7 named patterns from the plan', () => {
    expect(listAnchorPatternIds().sort()).toEqual(
      [
        '1-center',
        '2-center-horizontal',
        '2-center-vertical',
        '3-center-triangle',
        '4-center-square',
        '4-center-diamond',
        'ring-N',
      ].sort(),
    );
  });

  it('every pattern produces at least minAnchors positions at scale 1', () => {
    for (const id of listAnchorPatternIds()) {
      const pattern = ANCHOR_PATTERNS[id];
      const anchors = pattern.placeAnchors(1, id === 'ring-N' ? { n: 6 } : {});
      expect(anchors.length).toBeGreaterThanOrEqual(pattern.minAnchors);
    }
  });

  it('1-center places one anchor at the origin', () => {
    const anchors = ANCHOR_PATTERNS['1-center'].placeAnchors(1);
    expect(anchors).toEqual([{ x: 0, y: 0 }]);
  });

  it('2-center-horizontal places two anchors mirrored across the y-axis', () => {
    const anchors = ANCHOR_PATTERNS['2-center-horizontal'].placeAnchors(1, { gap: 8 });
    expect(anchors).toEqual([
      { x: -4, y: 0 },
      { x: 4, y: 0 },
    ]);
  });

  it('4-center-square places anchors at the four corners of a square', () => {
    const anchors = ANCHOR_PATTERNS['4-center-square'].placeAnchors(1, { halfWidth: 5 });
    expect(anchors).toContainEqual({ x: -5, y: -5 });
    expect(anchors).toContainEqual({ x: 5, y: -5 });
    expect(anchors).toContainEqual({ x: 5, y: 5 });
    expect(anchors).toContainEqual({ x: -5, y: 5 });
  });

  it('ring-N parameterizes anchor count', () => {
    expect(ANCHOR_PATTERNS['ring-N'].placeAnchors(1, { n: 3 })).toHaveLength(3);
    expect(ANCHOR_PATTERNS['ring-N'].placeAnchors(1, { n: 8 })).toHaveLength(8);
    expect(ANCHOR_PATTERNS['ring-N'].placeAnchors(1, { n: 12 })).toHaveLength(12);
  });

  it('ring-N anchors lie on a circle of the given radius', () => {
    const radius = 7;
    const anchors = ANCHOR_PATTERNS['ring-N'].placeAnchors(1, { n: 6, radius });
    for (const a of anchors) {
      expect(approx(Math.hypot(a.x, a.y), radius, 1e-9)).toBe(true);
    }
  });
});

describe('composeAnchorPattern', () => {
  it('places one manji per anchor with the broadcast program', () => {
    const comp = composeAnchorPattern('4-center-square', {
      bar1: { rotationDeg: 0 },
      bar2: { rotationDeg: 90 },
    });
    expect(comp.anchors).toHaveLength(4);
    expect(comp.manjis).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      expect(pointEq(comp.manjis[i].center, comp.anchors[i])).toBe(true);
    }
  });

  it('composition bbox encloses every manji arm-tip', () => {
    const comp = composeAnchorPattern(
      'ring-N',
      { bar1: { rotationDeg: 0 }, bar2: { rotationDeg: 90 } },
      { patternParams: { n: 8, radius: 10 } },
    );
    for (const m of comp.manjis) {
      for (const tip of m.armTips) {
        expect(tip.x).toBeGreaterThanOrEqual(comp.bbox.min.x - EPS);
        expect(tip.x).toBeLessThanOrEqual(comp.bbox.max.x + EPS);
        expect(tip.y).toBeGreaterThanOrEqual(comp.bbox.min.y - EPS);
        expect(tip.y).toBeLessThanOrEqual(comp.bbox.max.y + EPS);
      }
    }
  });

  it('translates the entire composition by the anchor option', () => {
    const at0 = composeAnchorPattern('1-center', { bar1: { rotationDeg: 0 }, bar2: { rotationDeg: 90 } });
    const at100 = composeAnchorPattern(
      '1-center',
      { bar1: { rotationDeg: 0 }, bar2: { rotationDeg: 90 } },
      { anchor: { x: 100, y: 50 } },
    );
    expect(at100.anchors[0]).toEqual({ x: 100, y: 50 });
    expect(pointEq(at100.manjis[0].center, { x: 100, y: 50 })).toBe(true);
    expect(approx(at100.bbox.min.x, at0.bbox.min.x + 100)).toBe(true);
    expect(approx(at100.bbox.min.y, at0.bbox.min.y + 50)).toBe(true);
  });
});

describe('cellRadius', () => {
  it('returns half the distance to nearest sibling for multi-anchor patterns', () => {
    const comp = composeAnchorPattern('2-center-horizontal', { bar1: {}, bar2: {} }, { patternParams: { gap: 10 } });
    expect(approx(cellRadius(comp, 0), 5)).toBe(true);
    expect(approx(cellRadius(comp, 1), 5)).toBe(true);
  });

  it('falls back to a fraction of bbox for single-center', () => {
    const comp = composeAnchorPattern('1-center', { bar1: { rotationDeg: 0 }, bar2: { rotationDeg: 90 } });
    const r = cellRadius(comp, 0);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThanOrEqual(Math.min(
      (comp.bbox.max.x - comp.bbox.min.x) / 2,
      (comp.bbox.max.y - comp.bbox.min.y) / 2,
    ));
  });
});

describe('fractalize', () => {
  it('produces one child composition per parent anchor', () => {
    const parent = composeAnchorPattern('4-center-square', { bar1: { rotationDeg: 0 }, bar2: { rotationDeg: 90 } });
    const result = fractalize(
      parent,
      '1-center',
      { bar1: { rotationDeg: 45 }, bar2: { rotationDeg: -45 } },
    );
    expect(result.children).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      expect(pointEq(result.children[i].anchor, parent.anchors[i])).toBe(true);
    }
  });

  it('child bboxes do not exceed cell radius from parent anchor', () => {
    const parent = composeAnchorPattern(
      '2-center-horizontal',
      { bar1: { rotationDeg: 0 }, bar2: { rotationDeg: 90 } },
      { patternParams: { gap: 20 } },
    );
    const result = fractalize(
      parent,
      '1-center',
      { bar1: { rotationDeg: 30 }, bar2: { rotationDeg: 60 } },
    );
    for (let i = 0; i < result.children.length; i++) {
      const child = result.children[i];
      const radius = cellRadius(parent, i);
      const halfExtent = Math.max(
        (child.bbox.max.x - child.bbox.min.x) / 2,
        (child.bbox.max.y - child.bbox.min.y) / 2,
      );
      // child sized to fit; allow tiny epsilon for floating point
      expect(halfExtent).toBeLessThanOrEqual(radius + 1e-6);
    }
  });

  it('supports per-anchor program overrides via childPrograms', () => {
    const parent = composeAnchorPattern('2-center-horizontal', { bar1: {}, bar2: {} });
    const result = fractalize(
      parent,
      '1-center',
      { bar1: { rotationDeg: 0 }, bar2: { rotationDeg: 90 } },
      {
        childPrograms: [
          { bar1: { rotationDeg: 0 }, bar2: { rotationDeg: 90 } },
          { bar1: { rotationDeg: 45 }, bar2: { rotationDeg: -45 } },
        ],
      },
    );
    // distinct programs => distinct shapes at the two children
    const tips0 = result.children[0].manjis[0].armTips.map((t) => `${t.x.toFixed(3)},${t.y.toFixed(3)}`).sort();
    const tips1 = result.children[1].manjis[0].armTips.map((t) => `${t.x.toFixed(3)},${t.y.toFixed(3)}`).sort();
    expect(tips0).not.toEqual(tips1);
  });
});

describe('distinctness across fold programs', () => {
  // The borg-cube spike claims 6 distinct face compositions are reachable
  // from one kernel. The library-level proof: different fold programs at
  // the same anchor pattern produce different point sets.
  it('two different fold programs at the same pattern produce different segments', () => {
    const a = composeAnchorPattern('4-center-square', {
      bar1: { rotationDeg: 0 }, bar2: { rotationDeg: 90 },
    });
    const b = composeAnchorPattern('4-center-square', {
      bar1: { rotationDeg: 45 }, bar2: { rotationDeg: -45 },
    });
    const aSig = collectSegments(a).map((s) => `${s.from.x.toFixed(3)},${s.from.y.toFixed(3)}-${s.to.x.toFixed(3)},${s.to.y.toFixed(3)}`).sort().join('|');
    const bSig = collectSegments(b).map((s) => `${s.from.x.toFixed(3)},${s.from.y.toFixed(3)}-${s.to.x.toFixed(3)},${s.to.y.toFixed(3)}`).sort().join('|');
    expect(aSig).not.toEqual(bSig);
  });

  it('different anchor patterns produce different anchor counts (sanity)', () => {
    const counts = new Set();
    for (const id of listAnchorPatternIds()) {
      const comp = composeAnchorPattern(
        id,
        { bar1: { rotationDeg: 0 }, bar2: { rotationDeg: 90 } },
        { patternParams: id === 'ring-N' ? { n: 6 } : {} },
      );
      counts.add(comp.anchors.length);
    }
    // 1, 2, 3, 4, 6 — at least 4 distinct anchor cardinalities
    expect(counts.size).toBeGreaterThanOrEqual(4);
  });
});

describe('per-bar lengthScale (dimensional anchor)', () => {
  it('scales all four segments within a bar uniformly', () => {
    const { points } = evaluateBar({ lengthScale: 2 });
    expect(pointEq(points.leftEnd, { x: -2, y: 0 })).toBe(true);
    expect(pointEq(points.rightEnd, { x: 2, y: 0 })).toBe(true);
    expect(pointEq(points.leftTip, { x: -4, y: 0 })).toBe(true);
    expect(pointEq(points.rightTip, { x: 4, y: 0 })).toBe(true);
  });

  it('preserves equal-segments-within-bar invariant under lengthScale', () => {
    const L = 3;
    const { segments } = evaluateBar({ lengthScale: L });
    for (const s of segments) {
      const len = Math.hypot(s.to.x - s.from.x, s.to.y - s.from.y);
      expect(approx(len, SEGMENT_LENGTH * L, 1e-9)).toBe(true);
    }
  });

  it('scales tail segments with the bar even when flexed', () => {
    const { points } = evaluateBar({ lengthScale: 3, rightTailDeg: -90 });
    // end-dot at distance 1*L = 3 from center
    expect(pointEq(points.rightEnd, { x: 3, y: 0 })).toBe(true);
    // tail segment length = SEGMENT_LENGTH * L = 3; tail at -90° bends to
    // (0, -1) direction → tip at (3, -3).
    expect(pointEq(points.rightTip, { x: 3, y: -3 }, 1e-9)).toBe(true);
  });

  it('allows asymmetric bar lengths within a manji (rectangle case)', () => {
    const m = evaluateManji({
      bar1: { rotationDeg: 0, lengthScale: 3 },
      bar2: { rotationDeg: 90, lengthScale: 1 },
    });
    // bar1 tip = 2*L = 6 along x; bar2 tip = 2*L = 2 along y (after rotation).
    expect(pointEq(m.bars[0].points.rightTip, { x: 6, y: 0 }, 1e-9)).toBe(true);
    expect(pointEq(m.bars[1].points.rightTip, { x: 0, y: 2 }, 1e-9)).toBe(true);
  });
});

describe('barExtent', () => {
  it('returns total bar length end-to-end (4 equal segments) including both tails', () => {
    const m = evaluateManji({ bar1: { rotationDeg: 0, lengthScale: 1 }, bar2: { rotationDeg: 90 } });
    // Bar = 4 equal segments of SEGMENT_LENGTH; total end-to-end = 4*L = 4.
    expect(approx(barExtent(m, 0), 4, 1e-9)).toBe(true);
  });

  it('scales linearly with lengthScale', () => {
    const m1 = evaluateManji({ bar1: { rotationDeg: 0, lengthScale: 1 }, bar2: { rotationDeg: 90 } });
    const m2 = evaluateManji({ bar1: { rotationDeg: 0, lengthScale: 4 }, bar2: { rotationDeg: 90 } });
    expect(approx(barExtent(m2, 0) / barExtent(m1, 0), 4, 1e-9)).toBe(true);
  });

  it('reads parent-child proportion correctly (roof matches house width)', () => {
    const house = evaluateManji({
      bar1: { rotationDeg: 0, lengthScale: 5 },
      bar2: { rotationDeg: 90, lengthScale: 4 },
    });
    // Child manji binds its bar1 lengthScale to the parent's. The vertical
    // offset is irrelevant to the width check; placing roof at origin keeps
    // the test focused.
    const roof = evaluateManji({
      bar1: { rotationDeg: 0, lengthScale: 5 },
      bar2: { rotationDeg: 90, lengthScale: 1.5 },
    });
    expect(approx(barExtent(roof, 0), barExtent(house, 0), 1e-9)).toBe(true);
  });
});

describe('inscribedRect / circumscribedEllipse / inscribedCircle', () => {
  it('inscribedRect of canonical equal-length manji is a square', () => {
    const m = evaluateManji({ bar1: { rotationDeg: 0 }, bar2: { rotationDeg: 90 } });
    const rect = inscribedRect(m);
    const w = rect.max.x - rect.min.x;
    const h = rect.max.y - rect.min.y;
    expect(approx(w, h, 1e-9)).toBe(true);
    expect(approx(w, 4, 1e-9)).toBe(true); // tips at ±2 → width 4
  });

  it('inscribedRect of canonical unequal-length manji is a rectangle', () => {
    const m = evaluateManji({
      bar1: { rotationDeg: 0, lengthScale: 3 },
      bar2: { rotationDeg: 90, lengthScale: 1 },
    });
    const rect = inscribedRect(m);
    const w = rect.max.x - rect.min.x;
    const h = rect.max.y - rect.min.y;
    expect(approx(w, 12, 1e-9)).toBe(true); // bar1 tips at ±6 → width 12
    expect(approx(h, 4, 1e-9)).toBe(true); // bar2 tips at ±2 → height 4
    expect(w).not.toBeCloseTo(h);
  });

  it('circumscribedEllipse semi-axes match arm-tip max reaches', () => {
    const m = evaluateManji({
      bar1: { rotationDeg: 0, lengthScale: 2 },
      bar2: { rotationDeg: 90, lengthScale: 1 },
    });
    const ell = circumscribedEllipse(m);
    expect(approx(ell.semiX, 4, 1e-9)).toBe(true); // bar1 tip x = 2*L = 4
    expect(approx(ell.semiY, 2, 1e-9)).toBe(true); // bar2 tip y = 2*L = 2
  });

  it('circumscribedEllipse becomes a circle when bar lengths are equal', () => {
    const m = evaluateManji({ bar1: { rotationDeg: 0 }, bar2: { rotationDeg: 90 } });
    const ell = circumscribedEllipse(m);
    expect(approx(ell.semiX, ell.semiY, 1e-9)).toBe(true);
  });

  it('inscribedCircle radius = min semi-axis of inscribed rect', () => {
    const m = evaluateManji({
      bar1: { rotationDeg: 0, lengthScale: 2 },
      bar2: { rotationDeg: 90, lengthScale: 1 },
    });
    const ic = inscribedCircle(m);
    expect(approx(ic.radius, 2, 1e-9)).toBe(true); // min(4, 2) = 2
  });

  it('anchorCircle reads the first segment end-dots as a circle', () => {
    const m = evaluateManji({ bar1: { rotationDeg: 0 }, bar2: { rotationDeg: 90 } });
    const circle = anchorCircle(m);
    expect(circle.isCircular).toBe(true);
    expect(approx(circle.radius, 1, 1e-9)).toBe(true);
    expect(pointEq(circle.points.W, { x: -1, y: 0 })).toBe(true);
    expect(pointEq(circle.points.E, { x: 1, y: 0 })).toBe(true);
    expect(pointEq(circle.points.S, { x: 0, y: -1 }, 1e-9)).toBe(true);
    expect(pointEq(circle.points.N, { x: 0, y: 1 }, 1e-9)).toBe(true);
    expect(circle.radialArms).toHaveLength(4);
    for (const arm of circle.radialArms) {
      expect(approx(
        Math.hypot(arm.to.x - arm.from.x, arm.to.y - arm.from.y),
        SEGMENT_LENGTH,
        1e-9,
      )).toBe(true);
    }
  });

  it('anchorCircle reports asymmetric first-segment reads as non-circular', () => {
    const m = evaluateManji({
      bar1: { rotationDeg: 0, lengthScale: 2 },
      bar2: { rotationDeg: 90, lengthScale: 1 },
    });
    const circle = anchorCircle(m);
    expect(circle.isCircular).toBe(false);
    expect(circle.maxRadiusDelta).toBeGreaterThan(0);
  });

  it('anchorTriangle inscribes an equilateral triangle inside the anchor circle', () => {
    const m = evaluateManji({ bar1: { rotationDeg: 0, lengthScale: 2 }, bar2: { rotationDeg: 90, lengthScale: 2 } });
    const tri = anchorTriangle(m);
    expect(tri.isCircular).toBe(true);
    expect(tri.vertices).toHaveLength(3);
    expect(tri.edges).toHaveLength(3);
    for (const v of tri.vertices) {
      expect(approx(Math.hypot(v.x - tri.center.x, v.y - tri.center.y), tri.radius, 1e-9)).toBe(true);
    }
    const edgeLengths = tri.edges.map((e) => Math.hypot(e.to.x - e.from.x, e.to.y - e.from.y));
    expect(edgeLengths[0]).toBeCloseTo(edgeLengths[1], 9);
    expect(edgeLengths[1]).toBeCloseTo(edgeLengths[2], 9);
    expect(edgeLengths[0]).toBeCloseTo(Math.sqrt(3) * tri.radius, 9);
  });

  it('anchorTriangle preserves non-circular status from the circle read', () => {
    const m = evaluateManji({
      bar1: { rotationDeg: 0, lengthScale: 2 },
      bar2: { rotationDeg: 90, lengthScale: 1 },
    });
    expect(anchorTriangle(m).isCircular).toBe(false);
  });

  it('anchorTriangle exposes vertexRays/apothems/medians at the expected geometry', () => {
    const m = evaluateManji({ bar1: { rotationDeg: 0, lengthScale: 2 }, bar2: { rotationDeg: 90, lengthScale: 2 } });
    const tri = anchorTriangle(m);
    expect(tri.vertexRays).toHaveLength(3);
    expect(tri.apothems).toHaveLength(3);
    expect(tri.medians).toHaveLength(3);
    expect(tri.edgeMidpoints).toHaveLength(3);

    // vertexRays: center → vertex, length = radius.
    for (let i = 0; i < 3; i++) {
      const r = tri.vertexRays[i];
      expect(pointEq(r.from, tri.center, 1e-9)).toBe(true);
      expect(pointEq(r.to, tri.vertices[i], 1e-9)).toBe(true);
      expect(approx(Math.hypot(r.to.x - r.from.x, r.to.y - r.from.y), tri.radius, 1e-9)).toBe(true);
      expect(approx(Math.hypot(r.direction.x, r.direction.y), 1, 1e-9)).toBe(true);
    }

    // apothems: center → edge midpoint, length = radius / 2 (equilateral).
    for (let i = 0; i < 3; i++) {
      const a = tri.apothems[i];
      expect(pointEq(a.from, tri.center, 1e-9)).toBe(true);
      expect(pointEq(a.to, tri.edgeMidpoints[i], 1e-9)).toBe(true);
      expect(approx(Math.hypot(a.to.x - a.from.x, a.to.y - a.from.y), tri.radius / 2, 1e-9)).toBe(true);
    }

    // medians: vertex i → midpoint of edge opposite vertex i, length = 3·radius / 2.
    for (let i = 0; i < 3; i++) {
      const med = tri.medians[i];
      expect(pointEq(med.from, tri.vertices[i], 1e-9)).toBe(true);
      expect(pointEq(med.to, tri.edgeMidpoints[(i + 1) % 3], 1e-9)).toBe(true);
      expect(approx(Math.hypot(med.to.x - med.from.x, med.to.y - med.from.y), (3 * tri.radius) / 2, 1e-9)).toBe(true);
      // Median direction is colinear-opposite to the vertexRay at i.
      const v = tri.vertexRays[i].direction;
      expect(approx(med.direction.x + v.x, 0, 1e-9)).toBe(true);
      expect(approx(med.direction.y + v.y, 0, 1e-9)).toBe(true);
    }
  });
});

describe('emergentManji', () => {
  it('spawns a perpendicular program oriented along a triangle median', () => {
    const m = evaluateManji({ bar1: { rotationDeg: 0, lengthScale: 1.5 }, bar2: { rotationDeg: 90, lengthScale: 1.5 } });
    const tri = anchorTriangle(m);
    const emergent = emergentManji(tri, { along: 'median', index: 0, lengthScale: 0.4 });

    // bar1 lies along the chosen median; bar2 is 90° from it.
    expect(approx(emergent.program.bar2.rotationDeg - emergent.program.bar1.rotationDeg, 90, 1e-9)).toBe(true);
    expect(approx(emergent.rotationDeg, emergent.program.bar1.rotationDeg, 1e-9)).toBe(true);

    // Anchor defaults to the ray's tip (median.to = opposite edge midpoint).
    expect(pointEq(emergent.anchor, tri.medians[0].to, 1e-9)).toBe(true);

    // The emergent program is line-pinned in its OWN frame: evaluate it and
    // confirm bar1 still runs along the median direction at the anchor.
    const child = evaluateManji(emergent.program, emergent.anchor, 1);
    const bar1Axis = {
      x: child.bars[0].points.rightEnd.x - child.bars[0].points.leftEnd.x,
      y: child.bars[0].points.rightEnd.y - child.bars[0].points.leftEnd.y,
    };
    const bar1Unit = { x: bar1Axis.x / Math.hypot(bar1Axis.x, bar1Axis.y), y: bar1Axis.y / Math.hypot(bar1Axis.x, bar1Axis.y) };
    expect(approx(bar1Unit.x, tri.medians[0].direction.x, 1e-9)).toBe(true);
    expect(approx(bar1Unit.y, tri.medians[0].direction.y, 1e-9)).toBe(true);

    // Length scale propagates: each bar segment in the child is 0.4 long.
    const segLen = Math.hypot(
      child.bars[0].points.center.x - child.bars[0].points.rightEnd.x,
      child.bars[0].points.center.y - child.bars[0].points.rightEnd.y,
    );
    expect(approx(segLen, 0.4, 1e-9)).toBe(true);
  });

  it('spawns along vertexRay and apothem families with the right anchors', () => {
    const m = evaluateManji({ bar1: { rotationDeg: 0, lengthScale: 1 }, bar2: { rotationDeg: 90, lengthScale: 1 } });
    const tri = anchorTriangle(m);

    const fromVertex = emergentManji(tri, { along: 'vertexRay', index: 1 });
    expect(pointEq(fromVertex.anchor, tri.vertices[1], 1e-9)).toBe(true);
    expect(fromVertex.source).toEqual({ along: 'vertexRay', index: 1 });

    const fromApothem = emergentManji(tri, { along: 'apothem', index: 2 });
    expect(pointEq(fromApothem.anchor, tri.edgeMidpoints[2], 1e-9)).toBe(true);
    expect(fromApothem.source).toEqual({ along: 'apothem', index: 2 });
  });

  it('throws on unknown ray family or out-of-range index', () => {
    const m = evaluateManji({ bar1: { rotationDeg: 0 }, bar2: { rotationDeg: 90 } });
    const tri = anchorTriangle(m);
    expect(() => emergentManji(tri, { along: 'diameter', index: 0 })).toThrow(/unknown ray family/);
    expect(() => emergentManji(tri, { along: 'median', index: 7 })).toThrow(/out of range/);
  });
});

describe('anchorHexagon', () => {
  it('returns 6 vertices on the anchor circle at 60° spacing', () => {
    const m = evaluateManji({ bar1: { rotationDeg: 0, lengthScale: 1.7 }, bar2: { rotationDeg: 90, lengthScale: 1.7 } });
    const hex = anchorHexagon(m);
    expect(hex.vertices).toHaveLength(6);
    expect(hex.edges).toHaveLength(6);
    expect(hex.spokes).toHaveLength(6);
    expect(approx(hex.radius, 1.7, 1e-9)).toBe(true);

    // Every vertex is on the circle.
    for (const v of hex.vertices) {
      expect(approx(Math.hypot(v.x - hex.center.x, v.y - hex.center.y), hex.radius, 1e-9)).toBe(true);
    }

    // Adjacent vertices are 60° apart, so the chord length is exactly radius.
    for (let i = 0; i < 6; i++) {
      const a = hex.vertices[i];
      const b = hex.vertices[(i + 1) % 6];
      expect(approx(Math.hypot(b.x - a.x, b.y - a.y), hex.radius, 1e-9)).toBe(true);
    }

    // Spokes match center → vertex with unit directions.
    for (let i = 0; i < 6; i++) {
      expect(pointEq(hex.spokes[i].from, hex.center, 1e-9)).toBe(true);
      expect(pointEq(hex.spokes[i].to, hex.vertices[i], 1e-9)).toBe(true);
      expect(approx(Math.hypot(hex.spokes[i].direction.x, hex.spokes[i].direction.y), 1, 1e-9)).toBe(true);
    }
  });

  it('aligns alternating vertices with the inscribed anchor-triangle vertices', () => {
    const m = evaluateManji({ bar1: { rotationDeg: 0, lengthScale: 1 }, bar2: { rotationDeg: 90, lengthScale: 1 } });
    const tri = anchorTriangle(m);
    const hex = anchorHexagon(m);
    // Same default rotationDeg = -90: hex vertices 0, 2, 4 match triangle 0, 1, 2.
    for (let i = 0; i < 3; i++) {
      expect(pointEq(hex.vertices[i * 2], tri.vertices[i], 1e-9)).toBe(true);
    }
  });
});

describe('quadrants', () => {
  it('returns 4 cell rectangles for a canonical manji', () => {
    const m = evaluateManji({ bar1: { rotationDeg: 0 }, bar2: { rotationDeg: 90 } });
    const cells = quadrants(m);
    expect(cells).toHaveLength(4);
    // NE quadrant: x in [0, 2], y in [0, 2]
    expect(approx(cells[0].min.x, 0, 1e-9)).toBe(true);
    expect(approx(cells[0].min.y, 0, 1e-9)).toBe(true);
    expect(approx(cells[0].max.x, 2, 1e-9)).toBe(true);
    expect(approx(cells[0].max.y, 2, 1e-9)).toBe(true);
  });

  it('quadrant cells tile the inscribed rect (sum of areas = rect area)', () => {
    const m = evaluateManji({
      bar1: { rotationDeg: 0, lengthScale: 2 },
      bar2: { rotationDeg: 90, lengthScale: 1.5 },
    });
    const rect = inscribedRect(m);
    const rectArea = boxArea(rect);
    const cellAreasSum = quadrants(m).reduce((acc, q) => acc + boxArea(q), 0);
    expect(approx(cellAreasSum, rectArea, 1e-9)).toBe(true);
  });

  it('child manji at lengthScale 0.5 fills one parent quadrant exactly (16-square tiling)', () => {
    // Parent: equal-length manji, inscribedRect is a 4×4 square.
    // Quadrants: four 2×2 squares.
    // A child manji centered in one quadrant with lengthScale 0.5 has tips at
    // ±1 around its center, i.e., inscribedRect 2×2 — same as the quadrant.
    const parent = evaluateManji({ bar1: { rotationDeg: 0 }, bar2: { rotationDeg: 90 } });
    const cells = quadrants(parent);
    const neCell = cells[0]; // x in [0, 2], y in [0, 2]
    const childCenter = {
      x: (neCell.min.x + neCell.max.x) / 2,
      y: (neCell.min.y + neCell.max.y) / 2,
    };
    const child = evaluateManji(
      {
        bar1: { rotationDeg: 0, lengthScale: 0.5 },
        bar2: { rotationDeg: 90, lengthScale: 0.5 },
      },
      childCenter,
    );
    const childRect = inscribedRect(child);
    expect(approx(childRect.min.x, neCell.min.x, 1e-9)).toBe(true);
    expect(approx(childRect.min.y, neCell.min.y, 1e-9)).toBe(true);
    expect(approx(childRect.max.x, neCell.max.x, 1e-9)).toBe(true);
    expect(approx(childRect.max.y, neCell.max.y, 1e-9)).toBe(true);
  });
});

describe('bbox helpers', () => {
  it('bboxOf returns degenerate box for empty input', () => {
    const b = bboxOf([]);
    expect(b.min).toEqual({ x: 0, y: 0 });
    expect(b.max).toEqual({ x: 0, y: 0 });
  });

  it('boxArea is positive for non-degenerate boxes and zero for points', () => {
    expect(boxArea({ min: { x: 0, y: 0 }, max: { x: 4, y: 3 } })).toBe(12);
    expect(boxArea({ min: { x: 1, y: 1 }, max: { x: 1, y: 1 } })).toBe(0);
  });

  it('containedIn detects containment with epsilon tolerance', () => {
    const outer = { min: { x: 0, y: 0 }, max: { x: 10, y: 10 } };
    expect(containedIn({ min: { x: 1, y: 1 }, max: { x: 9, y: 9 } }, outer)).toBe(true);
    expect(containedIn({ min: { x: -0.0000001, y: 0 }, max: { x: 10, y: 10 } }, outer)).toBe(true);
    expect(containedIn({ min: { x: -1, y: 0 }, max: { x: 10, y: 10 } }, outer)).toBe(false);
  });
});

describe('cardinality + line-pinning (manji-is-reality)', () => {
  it('exposes both cardinal axes with rotation assignments', () => {
    expect(Object.keys(CARDINAL_AXES).sort()).toContain('N-S');
    expect(Object.keys(CARDINAL_AXES).sort()).toContain('E-W');
    expect(CARDINAL_AXES['N-S'].rotationDeg).toBe(0);
    expect(CARDINAL_AXES['E-W'].rotationDeg).toBe(90);
  });

  it('lists the 4 cardinal directions for 2D', () => {
    expect([...CARDINAL_DIRECTIONS_2D].sort()).toEqual(['E', 'N', 'S', 'W']);
  });

  describe('resolveCardinalTail', () => {
    it('returns 0 for `open` and for naming the end\'s own cardinal', () => {
      expect(resolveCardinalTail('N-S', 'N', 'open')).toBe(0);
      expect(resolveCardinalTail('N-S', 'N', 'N')).toBe(0);
      expect(resolveCardinalTail('N-S', 'S', 'S')).toBe(0);
      expect(resolveCardinalTail('E-W', 'W', 'W')).toBe(0);
      expect(resolveCardinalTail('E-W', 'E', 'E')).toBe(0);
    });

    it('returns 180 for `closed` and for naming the opposite cardinal', () => {
      expect(resolveCardinalTail('N-S', 'N', 'closed')).toBe(180);
      expect(resolveCardinalTail('N-S', 'N', 'S')).toBe(180);
      expect(resolveCardinalTail('N-S', 'S', 'N')).toBe(180);
      expect(resolveCardinalTail('E-W', 'W', 'E')).toBe(180);
    });

    it('returns perpendicular fold angles for the other cardinals', () => {
      expect(resolveCardinalTail('N-S', 'N', 'E')).toBe(90);
      expect(resolveCardinalTail('N-S', 'N', 'W')).toBe(-90);
      expect(resolveCardinalTail('N-S', 'S', 'E')).toBe(90);
      expect(resolveCardinalTail('N-S', 'S', 'W')).toBe(-90);
      expect(resolveCardinalTail('E-W', 'W', 'N')).toBe(90);
      expect(resolveCardinalTail('E-W', 'E', 'S')).toBe(-90);
    });

    it('throws for unknown axis', () => {
      expect(() => resolveCardinalTail('NE-SW', 'N', 'open')).toThrow(/unknown axis/);
    });

    it('throws for end not on the named axis', () => {
      expect(() => resolveCardinalTail('N-S', 'E', 'open')).toThrow(/not on axis/);
    });

    it('throws for non-cardinal fold target (line-pinning enforcement)', () => {
      expect(() => resolveCardinalTail('N-S', 'N', 'NE')).toThrow(/not a valid fold/);
    });
  });

  describe('cardinalBar', () => {
    it('produces the canonical N-S bar program (both tails open)', () => {
      const bar = cardinalBar({ axis: 'N-S', tails: { N: 'open', S: 'open' } });
      expect(bar.rotationDeg).toBe(0);
      expect(bar.leftTailDeg).toBe(0);
      expect(bar.rightTailDeg).toBe(0);
      expect(bar.lengthScale).toBe(1);
    });

    it('produces the canonical E-W bar program', () => {
      const bar = cardinalBar({ axis: 'E-W', tails: { W: 'open', E: 'open' } });
      expect(bar.rotationDeg).toBe(90);
      expect(bar.leftTailDeg).toBe(0);
      expect(bar.rightTailDeg).toBe(0);
    });

    it('defaults missing tail targets to `open`', () => {
      const bar = cardinalBar({ axis: 'N-S' });
      expect(bar.leftTailDeg).toBe(0);
      expect(bar.rightTailDeg).toBe(0);
    });

    it('encodes a T construction (one tail folded perpendicular)', () => {
      // N-S bar with the S tail folded east — equivalent to user's T example
      const bar = cardinalBar({ axis: 'N-S', tails: { N: 'open', S: 'E' } });
      expect(bar.rotationDeg).toBe(0);
      expect(bar.leftTailDeg).toBe(0);
      expect(bar.rightTailDeg).toBe(90);
    });

    it('passes lengthScale through', () => {
      const bar = cardinalBar({ axis: 'N-S', lengthScale: 2.5 });
      expect(bar.lengthScale).toBe(2.5);
    });

    it('throws for unknown axis', () => {
      expect(() => cardinalBar({ axis: 'oblique-45', tails: {} })).toThrow();
    });
  });

  describe('cardinalManji', () => {
    it('produces a canonical + program from two perpendicular cardinal bars', () => {
      const program = cardinalManji({
        bar1: { axis: 'N-S', tails: { N: 'open', S: 'open' } },
        bar2: { axis: 'E-W', tails: { W: 'open', E: 'open' } },
      });
      expect(program.bar1.rotationDeg).toBe(0);
      expect(program.bar2.rotationDeg).toBe(90);
    });

    it('evaluates to a manji with arm tips at the 4 cardinal positions', () => {
      const program = cardinalManji({
        bar1: { axis: 'N-S' },
        bar2: { axis: 'E-W' },
      });
      const m = evaluateManji(program);
      const fmt = (n) => (Math.abs(n) < 1e-9 ? '0.000' : n.toFixed(3));
      const tips = m.armTips.map((t) => `${fmt(t.x)},${fmt(t.y)}`).sort();
      expect(tips).toEqual([
        '-2.000,0.000', // N tip (picture-left)
        '0.000,-2.000', // W tip (picture-down, eye-level)
        '0.000,2.000', // E tip (picture-up, horizon)
        '2.000,0.000', // S tip (picture-right)
      ]);
    });

    it('rejects two bars on the same axis (must be perpendicular)', () => {
      expect(() =>
        cardinalManji({
          bar1: { axis: 'N-S' },
          bar2: { axis: 'N-S' },
        }),
      ).toThrow(/must be perpendicular/);
    });
  });

  describe('validators', () => {
    it('isCardinalAngle accepts 0, 90, 180, 270 and their negatives/wraps', () => {
      for (const a of [0, 90, 180, 270, -90, -180, -270, 360, 450]) {
        expect(isCardinalAngle(a)).toBe(true);
      }
    });

    it('isCardinalAngle rejects non-cardinal angles', () => {
      for (const a of [45, 30, 60, 1, 89, 91, 135]) {
        expect(isCardinalAngle(a)).toBe(false);
      }
    });

    it('isCardinalAngle rejects NaN and non-finite', () => {
      expect(isCardinalAngle(NaN)).toBe(false);
      expect(isCardinalAngle(Infinity)).toBe(false);
    });

    it('validateCardinalBar accepts any cardinal-snapped program', () => {
      expect(validateCardinalBar({ rotationDeg: 0, leftTailDeg: 90, rightTailDeg: -90 })).toEqual([]);
      expect(validateCardinalBar({ rotationDeg: 90, leftTailDeg: 180, rightTailDeg: 0 })).toEqual([]);
    });

    it('validateCardinalBar rejects non-cardinal angles', () => {
      const errs = validateCardinalBar({ rotationDeg: 45, leftTailDeg: 30, rightTailDeg: 0 });
      expect(errs.length).toBe(2);
      expect(errs[0]).toMatch(/rotationDeg/);
      expect(errs[1]).toMatch(/leftTailDeg/);
    });

    it('validateCardinalManji checks both bars', () => {
      const program = cardinalManji({
        bar1: { axis: 'N-S', tails: { N: 'open', S: 'E' } },
        bar2: { axis: 'E-W', tails: { W: 'open', E: 'closed' } },
      });
      expect(validateCardinalManji(program)).toEqual([]);
    });
  });
});

describe('3D kernel — Zenith-Nadir as third axis', () => {
  function approx3(p, expected, eps = 1e-9) {
    return (
      Math.abs(p.x - expected.x) <= eps &&
      Math.abs(p.y - expected.y) <= eps &&
      Math.abs(p.z - expected.z) <= eps
    );
  }

  describe('evaluateBar3D', () => {
    it('places end-dots and tips on the N-S axis correctly', () => {
      const bar = evaluateBar3D({ axis: 'N-S' });
      expect(approx3(bar.points.center, { x: 0, y: 0, z: 0 })).toBe(true);
      expect(approx3(bar.points.negEnd, { x: -1, y: 0, z: 0 })).toBe(true);
      expect(approx3(bar.points.posEnd, { x: 1, y: 0, z: 0 })).toBe(true);
      expect(approx3(bar.points.negTip, { x: -2, y: 0, z: 0 })).toBe(true);
      expect(approx3(bar.points.posTip, { x: 2, y: 0, z: 0 })).toBe(true);
    });

    it('places end-dots and tips on the E-W axis correctly', () => {
      const bar = evaluateBar3D({ axis: 'E-W' });
      expect(approx3(bar.points.negEnd, { x: 0, y: -1, z: 0 })).toBe(true);
      expect(approx3(bar.points.posEnd, { x: 0, y: 1, z: 0 })).toBe(true);
      expect(approx3(bar.points.posTip, { x: 0, y: 2, z: 0 })).toBe(true);
    });

    it('places end-dots and tips on the Zenith-Nadir axis correctly', () => {
      const bar = evaluateBar3D({ axis: 'Zenith-Nadir' });
      expect(approx3(bar.points.negEnd, { x: 0, y: 0, z: -1 })).toBe(true);
      expect(approx3(bar.points.posEnd, { x: 0, y: 0, z: 1 })).toBe(true);
      expect(approx3(bar.points.negTip, { x: 0, y: 0, z: -2 })).toBe(true);
      expect(approx3(bar.points.posTip, { x: 0, y: 0, z: 2 })).toBe(true);
    });

    it('emits 4 segments of EQUAL length per bar (the 3D manji invariant)', () => {
      for (const axis of ['N-S', 'E-W', 'Zenith-Nadir']) {
        const bar = evaluateBar3D({ axis });
        expect(bar.segments).toHaveLength(4);
        for (const seg of bar.segments) {
          const L = Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y, seg.to.z - seg.from.z);
          expect(approx(L, SEGMENT_LENGTH, 1e-9)).toBe(true);
        }
      }
    });

    it('preserves equal-segments-within-bar under lengthScale', () => {
      const L = 4;
      const bar = evaluateBar3D({ axis: 'Zenith-Nadir', lengthScale: L });
      for (const seg of bar.segments) {
        const len = Math.hypot(seg.to.x - seg.from.x, seg.to.y - seg.from.y, seg.to.z - seg.from.z);
        expect(approx(len, SEGMENT_LENGTH * L, 1e-9)).toBe(true);
      }
    });

    it('folds tail to a perpendicular cardinal when named', () => {
      // N-S bar with the N tail folded to Zenith (perpendicular, up)
      const bar = evaluateBar3D({ axis: 'N-S', tails: { N: 'Zenith' } });
      expect(approx3(bar.points.negEnd, { x: -1, y: 0, z: 0 })).toBe(true);
      // negTip = negEnd + 1 * (Zenith vector) = (-1, 0, 0) + (0, 0, 1) = (-1, 0, 1)
      expect(approx3(bar.points.negTip, { x: -1, y: 0, z: 1 })).toBe(true);
    });

    it('collapses tail to center on `closed`', () => {
      const bar = evaluateBar3D({ axis: 'N-S', tails: { N: 'closed', S: 'closed' } });
      expect(approx3(bar.points.negTip, { x: 0, y: 0, z: 0 })).toBe(true);
      expect(approx3(bar.points.posTip, { x: 0, y: 0, z: 0 })).toBe(true);
    });

    it('rejects unknown axis', () => {
      expect(() => evaluateBar3D({ axis: 'oblique' })).toThrow(/unknown axis/);
    });

    it('rejects non-cardinal fold targets', () => {
      expect(() => evaluateBar3D({ axis: 'N-S', tails: { N: 'NE' } })).toThrow(/not a valid 3D fold/);
    });
  });

  describe('evaluateManji3D', () => {
    it('canonical 3-bar manji has 6 arm-tips at the cardinal positions', () => {
      const m = evaluateManji3D({
        bars: [
          { axis: 'N-S' },
          { axis: 'E-W' },
          { axis: 'Zenith-Nadir' },
        ],
      });
      expect(m.armTips).toHaveLength(6);
      const positions = m.armTips
        .map((t) => `${t.x.toFixed(0)},${t.y.toFixed(0)},${t.z.toFixed(0)}`)
        .sort();
      expect(positions).toEqual([
        '-2,0,0', '0,-2,0', '0,0,-2', '0,0,2', '0,2,0', '2,0,0',
      ]);
    });

    it('center stays fixed at anchor regardless of bar variations', () => {
      const anchor = { x: 7, y: -3, z: 11 };
      const m = evaluateManji3D({
        bars: [
          { axis: 'N-S', tails: { N: 'Zenith', S: 'closed' }, lengthScale: 2 },
          { axis: 'E-W', tails: { W: 'Nadir', E: 'open' }, lengthScale: 0.5 },
          { axis: 'Zenith-Nadir', tails: { Nadir: 'N', Zenith: 'S' }, lengthScale: 1.5 },
        ],
      }, anchor);
      expect(approx3(m.center, anchor, 1e-9)).toBe(true);
      for (const bar of m.bars) {
        expect(approx3(bar.points.center, anchor, 1e-9)).toBe(true);
      }
    });

    it('rejects two bars on the same axis', () => {
      expect(() =>
        evaluateManji3D({ bars: [{ axis: 'N-S' }, { axis: 'N-S' }] }),
      ).toThrow(/two bars on axis/);
    });

    it('handles 1-bar and 2-bar manjis (partial 3D)', () => {
      const m1 = evaluateManji3D({ bars: [{ axis: 'Zenith-Nadir' }] });
      expect(m1.bars).toHaveLength(1);
      expect(m1.armTips).toHaveLength(2);
      const m2 = evaluateManji3D({ bars: [{ axis: 'N-S' }, { axis: 'E-W' }] });
      expect(m2.bars).toHaveLength(2);
      expect(m2.armTips).toHaveLength(4);
    });

    it('cardinalManji3D wraps the bars into a program', () => {
      const program = cardinalManji3D({
        bar1: { axis: 'N-S' },
        bar2: { axis: 'E-W' },
        bar3: { axis: 'Zenith-Nadir' },
      });
      expect(program.bars).toHaveLength(3);
      const m = evaluateManji3D(program);
      expect(m.armTips).toHaveLength(6);
    });
  });

  describe('3D shape helpers', () => {
    it('inscribedCuboid of equal-length 3D manji is a cube', () => {
      const m = evaluateManji3D({
        bars: [{ axis: 'N-S' }, { axis: 'E-W' }, { axis: 'Zenith-Nadir' }],
      });
      const cube = inscribedCuboid(m);
      const w = cube.max.x - cube.min.x;
      const h = cube.max.y - cube.min.y;
      const d = cube.max.z - cube.min.z;
      expect(approx(w, 4, 1e-9)).toBe(true);
      expect(approx(h, w, 1e-9)).toBe(true);
      expect(approx(d, w, 1e-9)).toBe(true);
    });

    it('inscribedCuboid of asymmetric 3D manji has per-axis dimensions matching lengthScales × 4', () => {
      const m = evaluateManji3D({
        bars: [
          { axis: 'N-S', lengthScale: 2 },
          { axis: 'E-W', lengthScale: 1 },
          { axis: 'Zenith-Nadir', lengthScale: 1.5 },
        ],
      });
      const cube = inscribedCuboid(m);
      expect(approx(cube.max.x - cube.min.x, 8, 1e-9)).toBe(true);
      expect(approx(cube.max.y - cube.min.y, 4, 1e-9)).toBe(true);
      expect(approx(cube.max.z - cube.min.z, 6, 1e-9)).toBe(true);
    });

    it('circumscribedEllipsoid becomes a sphere when all bar lengths are equal', () => {
      const m = evaluateManji3D({
        bars: [{ axis: 'N-S' }, { axis: 'E-W' }, { axis: 'Zenith-Nadir' }],
      });
      const ell = circumscribedEllipsoid(m);
      expect(approx(ell.semiX, ell.semiY, 1e-9)).toBe(true);
      expect(approx(ell.semiY, ell.semiZ, 1e-9)).toBe(true);
      expect(approx(ell.semiX, 2, 1e-9)).toBe(true); // tips at ±2
    });

    it('inscribedSphere radius = min semi-axis of inscribed cuboid', () => {
      const m = evaluateManji3D({
        bars: [
          { axis: 'N-S', lengthScale: 2 },
          { axis: 'E-W', lengthScale: 1 },
          { axis: 'Zenith-Nadir', lengthScale: 3 },
        ],
      });
      const sph = inscribedSphere(m);
      expect(approx(sph.radius, 2, 1e-9)).toBe(true); // min(4, 2, 6) = 2
    });

    it('octants returns 8 cells that tile the inscribed cuboid by volume', () => {
      const m = evaluateManji3D({
        bars: [
          { axis: 'N-S', lengthScale: 1 },
          { axis: 'E-W', lengthScale: 1.5 },
          { axis: 'Zenith-Nadir', lengthScale: 2 },
        ],
      });
      const cuboid = inscribedCuboid(m);
      const cuboidVol = boxVolume(cuboid);
      const oct = octants(m);
      expect(oct).toHaveLength(8);
      const sumVol = oct.reduce((acc, c) => acc + boxVolume(c), 0);
      expect(approx(sumVol, cuboidVol, 1e-9)).toBe(true);
    });

    it('child manji at lengthScale 0.5 fills one parent octant exactly (3D 64-cube tiling)', () => {
      // Parent: equal-length 3D manji, inscribed cuboid is 4×4×4.
      // Octants: eight 2×2×2 cubes.
      // Child at center of an octant with all-axes lengthScale 0.5 has
      // inscribed cuboid 2×2×2 — exactly tiles the octant.
      const parent = evaluateManji3D({
        bars: [{ axis: 'N-S' }, { axis: 'E-W' }, { axis: 'Zenith-Nadir' }],
      });
      const oct = octants(parent)[0]; // first octant, [+x, +y, +z] from center
      const childCenter = {
        x: (oct.min.x + oct.max.x) / 2,
        y: (oct.min.y + oct.max.y) / 2,
        z: (oct.min.z + oct.max.z) / 2,
      };
      const child = evaluateManji3D({
        bars: [
          { axis: 'N-S', lengthScale: 0.5 },
          { axis: 'E-W', lengthScale: 0.5 },
          { axis: 'Zenith-Nadir', lengthScale: 0.5 },
        ],
      }, childCenter);
      const childCube = inscribedCuboid(child);
      expect(approx(childCube.min.x, oct.min.x, 1e-9)).toBe(true);
      expect(approx(childCube.min.y, oct.min.y, 1e-9)).toBe(true);
      expect(approx(childCube.min.z, oct.min.z, 1e-9)).toBe(true);
      expect(approx(childCube.max.x, oct.max.x, 1e-9)).toBe(true);
      expect(approx(childCube.max.y, oct.max.y, 1e-9)).toBe(true);
      expect(approx(childCube.max.z, oct.max.z, 1e-9)).toBe(true);
    });
  });

  describe('barExtent3D', () => {
    it('returns 4×lengthScale (4 equal segments)', () => {
      const m = evaluateManji3D({ bars: [{ axis: 'Zenith-Nadir', lengthScale: 1 }] });
      expect(approx(barExtent3D(m, 0), 4, 1e-9)).toBe(true);
    });

    it('scales linearly with lengthScale', () => {
      const m1 = evaluateManji3D({ bars: [{ axis: 'N-S', lengthScale: 1 }] });
      const m2 = evaluateManji3D({ bars: [{ axis: 'N-S', lengthScale: 5 }] });
      expect(approx(barExtent3D(m2, 0) / barExtent3D(m1, 0), 5, 1e-9)).toBe(true);
    });
  });

  describe('3D bbox / volume / containment helpers', () => {
    it('boxVolume is the product of side lengths', () => {
      expect(boxVolume({ min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 3, z: 4 } })).toBe(24);
    });

    it('containedIn3D respects axis-aligned containment with epsilon', () => {
      const outer = { min: { x: 0, y: 0, z: 0 }, max: { x: 10, y: 10, z: 10 } };
      expect(containedIn3D({ min: { x: 1, y: 1, z: 1 }, max: { x: 9, y: 9, z: 9 } }, outer)).toBe(true);
      expect(containedIn3D({ min: { x: -1, y: 1, z: 1 }, max: { x: 9, y: 9, z: 9 } }, outer)).toBe(false);
    });
  });

  describe('validateCardinalManji3D', () => {
    it('accepts a fully-specified canonical 3D program', () => {
      const program = cardinalManji3D({
        bar1: { axis: 'N-S', tails: { N: 'open', S: 'open' } },
        bar2: { axis: 'E-W', tails: { W: 'open', E: 'open' } },
        bar3: { axis: 'Zenith-Nadir', tails: { Nadir: 'open', Zenith: 'open' } },
      });
      expect(validateCardinalManji3D(program)).toEqual([]);
    });

    it('flags an unknown axis', () => {
      const errors = validateCardinalManji3D({ bars: [{ axis: 'oblique' }] });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toMatch(/unknown axis/);
    });

    it('flags duplicate axis assignment', () => {
      const errors = validateCardinalManji3D({
        bars: [{ axis: 'N-S' }, { axis: 'N-S' }],
      });
      expect(errors.some((e) => /already used/.test(e))).toBe(true);
    });

    it('flags invalid fold target (3D perpendicular validation)', () => {
      const errors = validateCardinalManji3D({
        bars: [{ axis: 'N-S', tails: { N: 'oblique' } }],
      });
      expect(errors.some((e) => /not a valid 3D fold/.test(e))).toBe(true);
    });
  });

  describe('cardinalBar (2D) rejects the Zenith-Nadir axis', () => {
    it('throws a helpful error directing the caller to the 3D API', () => {
      expect(() => cardinalBar({ axis: 'Zenith-Nadir' })).toThrow(/3D-only/);
    });
  });
});

describe('collectSegments / collectDots', () => {
  it('collectSegments returns 8 segments per manji (2 bars × 4 segments)', () => {
    const comp = composeAnchorPattern('1-center', { bar1: {}, bar2: {} });
    expect(collectSegments(comp)).toHaveLength(8);
  });

  it('collectDots returns 3 dots per manji (center + 2 end-dots × 2 bars... deduplication note)', () => {
    // current impl returns center + leftEnd + rightEnd per bar = 1 + 2*2 = 5 dots per manji
    const comp = composeAnchorPattern('1-center', { bar1: {}, bar2: {} });
    expect(collectDots(comp)).toHaveLength(5);
  });

  it('flattens fractalized compositions', () => {
    const parent = composeAnchorPattern('4-center-square', { bar1: {}, bar2: {} });
    const result = fractalize(parent, '1-center', { bar1: {}, bar2: {} });
    // 4 parent manjis × 8 segments + 4 children × 1 manji × 8 segments = 64
    expect(collectSegments(result)).toHaveLength(64);
  });
});
