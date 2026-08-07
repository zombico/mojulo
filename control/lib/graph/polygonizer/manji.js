/**
 * Manji-manipulator — vector-space layout primitive.
 *
 * Kernel: two 3-dot/4-segment bars sharing a fixed center dot. Bars rotate
 * independently around the center; each tail pivots at its end-dot joint;
 * interior segments stay colinear with the bar's main axis. The center
 * never moves under any manipulation.
 *
 * No rendering. No marks. No SVG. Pure vector-space math:
 * positions, angles, lengths, bounding boxes, containment.
 *
 * See [lite-template/integration/0604/manji-manipulator.plan.md] for the
 * design rationale and the borg-cube spike test that motivates this module.
 */

export const SEGMENT_LENGTH = 1;
// Distance from center dot to end-dot, equal to one SEGMENT_LENGTH. The bar
// has FOUR equal-length segments (left tail | left interior | right interior
// | right tail), with dots between them. Positions from center along the
// bar's local axis: 0 (center), ±SEGMENT_LENGTH (end-dots),
// ±2·SEGMENT_LENGTH (tail tips). End-to-end bar length = 4·SEGMENT_LENGTH.
// The equal-segment invariant is what makes 4×4 = 16-square fractal tiling
// work cleanly: each quadrant of a parent manji holds a child manji at half
// scale.
export const BAR_HALF_LENGTH = 1;
export const ANGLE_QUANTUM_DEG = 45;
export const ALLOWED_ANGLES_DEG = [-180, -135, -90, -45, 0, 45, 90, 135, 180];

function rotatePoint(point, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function translatePoint(point, dx, dy) {
  return { x: point.x + dx, y: point.y + dy };
}

function scalePoint(point, scale) {
  return { x: point.x * scale, y: point.y * scale };
}

function unitVector2D(v, eps = 1e-12) {
  const len = Math.hypot(v.x, v.y);
  if (len < eps) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

function quantizeAngle(deg) {
  return Math.round(deg / ANGLE_QUANTUM_DEG) * ANGLE_QUANTUM_DEG;
}

/**
 * Evaluate a single bar in its own local frame (center at origin, bar
 * along the x-axis when rotationDeg = 0).
 *
 *   - rotationDeg: whole-bar rotation around the center dot.
 *   - leftTailDeg: tail flex at the left end-dot. 0° = colinear extension
 *     in -x. Positive flex bends the tail toward +y, symmetric with the
 *     right tail (both tails fold to the same side under the same sign).
 *   - rightTailDeg: tail flex at the right end-dot. 0° = colinear extension
 *     in +x. Positive flex bends the tail toward +y.
 *   - lengthScale: per-bar length multiplier. All four segments within the
 *     bar scale together (equal-segments-within-bar invariant preserved).
 *     Bars within a manji can carry different lengthScales — that's the
 *     mechanism for rectangles, ellipses, and parent-child proportion
 *     binding.
 *
 * Returns an object with named points and the four segments (in draw order
 * from left tail tip to right tail tip).
 */
export function evaluateBar({ rotationDeg = 0, leftTailDeg = 0, rightTailDeg = 0, lengthScale = 1 } = {}) {
  const seg = SEGMENT_LENGTH * lengthScale;
  const halfBar = BAR_HALF_LENGTH * lengthScale;

  const center = { x: 0, y: 0 };
  const leftEnd = { x: -halfBar, y: 0 };
  const rightEnd = { x: halfBar, y: 0 };

  // Left tail outward direction is -x; we negate the angle so positive
  // flex bends toward +y (symmetric with the right tail).
  const leftTailDir = rotatePoint({ x: -1, y: 0 }, -leftTailDeg);
  const leftTip = {
    x: leftEnd.x + seg * leftTailDir.x,
    y: leftEnd.y + seg * leftTailDir.y,
  };

  const rightTailDir = rotatePoint({ x: 1, y: 0 }, rightTailDeg);
  const rightTip = {
    x: rightEnd.x + seg * rightTailDir.x,
    y: rightEnd.y + seg * rightTailDir.y,
  };

  const points = {
    center: rotatePoint(center, rotationDeg),
    leftEnd: rotatePoint(leftEnd, rotationDeg),
    rightEnd: rotatePoint(rightEnd, rotationDeg),
    leftTip: rotatePoint(leftTip, rotationDeg),
    rightTip: rotatePoint(rightTip, rotationDeg),
  };

  const segments = [
    { from: points.leftTip, to: points.leftEnd },
    { from: points.leftEnd, to: points.center },
    { from: points.center, to: points.rightEnd },
    { from: points.rightEnd, to: points.rightTip },
  ];

  return { points, segments };
}

function applyTransform(point, anchor, scale) {
  return {
    x: anchor.x + scale * point.x,
    y: anchor.y + scale * point.y,
  };
}

function transformBarEvaluation(barEval, anchor, scale) {
  const points = {};
  for (const [name, p] of Object.entries(barEval.points)) {
    points[name] = applyTransform(p, anchor, scale);
  }
  const segments = barEval.segments.map((seg) => ({
    from: applyTransform(seg.from, anchor, scale),
    to: applyTransform(seg.to, anchor, scale),
  }));
  return { points, segments };
}

/**
 * Evaluate a complete manji (two bars sharing the center dot) at a given
 * anchor and scale. Program shape:
 *
 *   {
 *     bar1: { rotationDeg, leftTailDeg, rightTailDeg },
 *     bar2: { rotationDeg, leftTailDeg, rightTailDeg },
 *   }
 *
 * Anchor defaults to origin; scale defaults to 1. Returns the four arm-tip
 * positions (the candidate child centers for recursion), the bbox, and the
 * per-bar evaluations.
 */
export function evaluateManji(program = {}, anchor = { x: 0, y: 0 }, scale = 1) {
  const bar1 = transformBarEvaluation(evaluateBar(program.bar1 || {}), anchor, scale);
  const bar2 = transformBarEvaluation(evaluateBar(program.bar2 || {}), anchor, scale);

  const armTips = [bar1.points.leftTip, bar1.points.rightTip, bar2.points.leftTip, bar2.points.rightTip];
  const allPoints = [
    ...Object.values(bar1.points),
    ...Object.values(bar2.points),
  ];

  return {
    center: { x: anchor.x, y: anchor.y },
    scale,
    bars: [bar1, bar2],
    armTips,
    bbox: bboxOf(allPoints),
  };
}

/**
 * Anchor patterns at depth-1. Each entry exposes a `placeAnchors` function
 * returning N anchor positions in vector space, given a scale and optional
 * pattern-specific parameters.
 *
 * The pattern itself is purely positional — no rotation, no folds. The
 * caller composes by evaluating one manji program per anchor.
 */
export const ANCHOR_PATTERNS = {
  '1-center': {
    description: 'Single manji at the constellation dot.',
    minAnchors: 1,
    placeAnchors: (_scale = 1, _params = {}) => [{ x: 0, y: 0 }],
  },
  '2-center-horizontal': {
    description: 'Two anchors on horizontal axis. H/U/∩/bracket family.',
    minAnchors: 2,
    placeAnchors: (scale = 1, params = {}) => {
      const gap = (params.gap ?? 6) * scale;
      return [
        { x: -gap / 2, y: 0 },
        { x: gap / 2, y: 0 },
      ];
    },
  },
  '2-center-vertical': {
    description: 'Two anchors on vertical axis. I-beam/ladder family.',
    minAnchors: 2,
    placeAnchors: (scale = 1, params = {}) => {
      const gap = (params.gap ?? 6) * scale;
      return [
        { x: 0, y: -gap / 2 },
        { x: 0, y: gap / 2 },
      ];
    },
  },
  '3-center-triangle': {
    description: 'Three anchors at triangle vertices. Pediment/tripod/trefoil family.',
    minAnchors: 3,
    placeAnchors: (scale = 1, params = {}) => {
      const radius = (params.radius ?? 4) * scale;
      const positions = [];
      for (let i = 0; i < 3; i++) {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / 3;
        positions.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
      }
      return positions;
    },
  },
  '4-center-square': {
    description: 'Four anchors at square corners. Window-frame/courtyard/four-corner family.',
    minAnchors: 4,
    placeAnchors: (scale = 1, params = {}) => {
      const half = (params.halfWidth ?? 4) * scale;
      return [
        { x: -half, y: -half },
        { x: half, y: -half },
        { x: half, y: half },
        { x: -half, y: half },
      ];
    },
  },
  '4-center-diamond': {
    description: 'Four anchors at cardinal compass points. Cross-pattée/kite family.',
    minAnchors: 4,
    placeAnchors: (scale = 1, params = {}) => {
      const radius = (params.radius ?? 4) * scale;
      return [
        { x: 0, y: -radius },
        { x: radius, y: 0 },
        { x: 0, y: radius },
        { x: -radius, y: 0 },
      ];
    },
  },
  'ring-N': {
    description: 'N anchors on a circle. Rotunda/peristyle/gazebo family.',
    minAnchors: 3,
    placeAnchors: (scale = 1, params = {}) => {
      const n = Math.max(3, Math.floor(params.n ?? 6));
      const radius = (params.radius ?? 5) * scale;
      const positions = [];
      for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * i) / n;
        positions.push({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
      }
      return positions;
    },
  },
};

export function listAnchorPatternIds() {
  return Object.keys(ANCHOR_PATTERNS);
}

/**
 * Compose an anchor pattern with a broadcast fold-program (single program
 * applied at every anchor in the pattern). Returns positions of every
 * anchor, the manji evaluation at each, and the overall bbox.
 *
 *   options:
 *     anchor       — translation applied to the whole composition (default origin)
 *     scale        — composition scale factor (applied to anchor positions AND manjis)
 *     manjiScale   — extra scale factor applied only to the manjis (default 1).
 *                    Lets you shrink the manjis relative to anchor spacing.
 *     patternParams — pattern-specific knobs ({ gap, radius, halfWidth, n, ... })
 */
export function composeAnchorPattern(patternId, program = {}, options = {}) {
  const pattern = ANCHOR_PATTERNS[patternId];
  if (!pattern) throw new Error(`unknown anchor pattern: ${patternId}`);

  const {
    anchor = { x: 0, y: 0 },
    scale = 1,
    manjiScale = 1,
    patternParams = {},
  } = options;

  const anchorPositionsLocal = pattern.placeAnchors(scale, patternParams);
  const anchors = anchorPositionsLocal.map((p) => translatePoint(p, anchor.x, anchor.y));

  const manjis = anchors.map((a) => evaluateManji(program, a, scale * manjiScale));

  const allPoints = manjis.flatMap((m) => [
    ...Object.values(m.bars[0].points),
    ...Object.values(m.bars[1].points),
  ]);

  return {
    patternId,
    anchor,
    scale,
    manjiScale,
    anchors,
    manjis,
    bbox: bboxOf(allPoints),
  };
}

/**
 * Compute the half-distance from a parent anchor to its nearest sibling.
 * That radius is the parent's child-cell allowance — a child composition
 * placed at this anchor should fit within this radius to avoid colliding
 * with other children.
 *
 * For a 1-center pattern (no siblings), falls back to a quarter of the
 * parent bbox's smaller half-extent.
 */
export function cellRadius(parent, anchorIndex) {
  if (parent.anchors.length === 1) {
    const halfW = (parent.bbox.max.x - parent.bbox.min.x) / 2;
    const halfH = (parent.bbox.max.y - parent.bbox.min.y) / 2;
    return Math.min(halfW, halfH) / 2;
  }
  const me = parent.anchors[anchorIndex];
  let minDist = Infinity;
  for (let j = 0; j < parent.anchors.length; j++) {
    if (j === anchorIndex) continue;
    const other = parent.anchors[j];
    const d = Math.hypot(me.x - other.x, me.y - other.y);
    if (d < minDist) minDist = d;
  }
  return minDist / 2;
}

/**
 * Place a child composition at every anchor of a parent composition,
 * scaled so the child's bbox half-extent fits within the parent's
 * cell radius at that anchor. Returns the parent + array of child
 * compositions, one per parent anchor.
 *
 * The child uses the same broadcast fold-program at every parent anchor
 * (rotational-symmetry default). Pass an array of programs as
 * `options.childPrograms` to vary per parent anchor (advanced).
 */
export function fractalize(parent, childPatternId, childProgram, options = {}) {
  const { childPatternParams = {}, childManjiScale = 1, childPrograms = null } = options;

  const probe = composeAnchorPattern(childPatternId, childProgram, {
    scale: 1,
    manjiScale: childManjiScale,
    patternParams: childPatternParams,
  });
  const probeHalfExtent = Math.max(
    (probe.bbox.max.x - probe.bbox.min.x) / 2,
    (probe.bbox.max.y - probe.bbox.min.y) / 2,
  );
  if (probeHalfExtent === 0) {
    throw new Error('fractalize: child probe has zero extent; cannot size');
  }

  const children = parent.anchors.map((anchor, i) => {
    const allowed = cellRadius(parent, i);
    const childScale = allowed / probeHalfExtent;
    const program = Array.isArray(childPrograms) ? (childPrograms[i] || childProgram) : childProgram;
    return composeAnchorPattern(childPatternId, program, {
      anchor,
      scale: childScale,
      manjiScale: childManjiScale,
      patternParams: childPatternParams,
    });
  });

  return { parent, children };
}

export function bboxOf(points) {
  if (!points || points.length === 0) {
    return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
}

export function boxArea(bbox) {
  const w = Math.max(0, bbox.max.x - bbox.min.x);
  const h = Math.max(0, bbox.max.y - bbox.min.y);
  return w * h;
}

export function containedIn(inner, outer, epsilon = 1e-6) {
  return (
    inner.min.x >= outer.min.x - epsilon &&
    inner.min.y >= outer.min.y - epsilon &&
    inner.max.x <= outer.max.x + epsilon &&
    inner.max.y <= outer.max.y + epsilon
  );
}

/**
 * Collect every line segment in a composition (parent or fractalized
 * result) as a flat array. Handy for SVG rendering or hashing.
 */
export function collectSegments(composition) {
  const out = [];
  const visit = (node) => {
    if (!node) return;
    if (node.manjis) {
      for (const m of node.manjis) {
        for (const bar of m.bars) {
          for (const seg of bar.segments) out.push(seg);
        }
      }
    }
    if (node.parent) visit(node.parent);
    if (node.children) for (const c of node.children) visit(c);
  };
  visit(composition);
  return out;
}

export function collectDots(composition) {
  const out = [];
  const visit = (node) => {
    if (!node) return;
    if (node.manjis) {
      for (const m of node.manjis) {
        out.push(m.center);
        for (const bar of m.bars) {
          out.push(bar.points.leftEnd, bar.points.rightEnd);
        }
      }
    }
    if (node.parent) visit(node.parent);
    if (node.children) for (const c of node.children) visit(c);
  };
  visit(composition);
  return out;
}

// ----- Derived-shape helpers --------------------------------------------
//
// A manji is a dimensional anchor: a point in space with two associated
// extents (one per bar). Specific shapes — rect, ellipse, square, circle,
// 4-cell grid — are READ STYLES over the same manji data, not separate
// primitives. These helpers expose those reads.

/**
 * Bar-extent: end-to-end length of a bar in world space (post-rotation
 * and post-composition-scale). For a canonical bar with lengthScale=L
 * and uniform composition scale S, this returns 4*L*S (4 unit segments
 * scaled by L within the bar, then S from composition).
 */
export function barExtent(manji, barIndex) {
  const bar = manji.bars[barIndex];
  if (!bar) throw new Error(`barExtent: invalid bar index ${barIndex}`);
  const a = bar.points.leftEnd;
  const b = bar.points.rightEnd;
  return Math.hypot(b.x - a.x, b.y - a.y) + 2 * tailExtent(bar);
}

function tailExtent(bar) {
  const seg = Math.hypot(
    bar.points.leftTip.x - bar.points.leftEnd.x,
    bar.points.leftTip.y - bar.points.leftEnd.y,
  );
  return seg;
}

/**
 * Inscribed rectangle: the axis-aligned bbox of the manji's four arm-tips.
 * For a canonical manji (bar1 along x, bar2 along y, no tail flex), this is
 * the natural bounding rectangle of the manji's reach.
 *
 * For tilted or flexed manjis, the result is still axis-aligned (not
 * bar-aligned) — useful as a containment region for renderers that want
 * to fit content inside the manji's reach.
 */
export function inscribedRect(manji) {
  return bboxOf(manji.armTips);
}

/**
 * Circumscribed ellipse: the axis-aligned ellipse whose semi-axes are the
 * max horizontal and max vertical reach of the manji's arm-tips from its
 * center. For a canonical manji with equal bar lengths, this is the
 * circumscribed circle.
 *
 * Returns { center, semiX, semiY }.
 */
export function circumscribedEllipse(manji) {
  let semiX = 0;
  let semiY = 0;
  for (const tip of manji.armTips) {
    const dx = Math.abs(tip.x - manji.center.x);
    const dy = Math.abs(tip.y - manji.center.y);
    if (dx > semiX) semiX = dx;
    if (dy > semiY) semiY = dy;
  }
  return { center: { ...manji.center }, semiX, semiY };
}

/**
 * Inscribed circle: the largest axis-aligned circle that fits inside the
 * manji's reach (radius = min semi-axis of the inscribed bbox).
 */
export function inscribedCircle(manji) {
  const rect = inscribedRect(manji);
  const semiX = Math.min(manji.center.x - rect.min.x, rect.max.x - manji.center.x);
  const semiY = Math.min(manji.center.y - rect.min.y, rect.max.y - manji.center.y);
  return { center: { ...manji.center }, radius: Math.min(semiX, semiY) };
}

/**
 * Anchor circle: the circle read from the first segment of a perpendicular
 * manji. The radius is the center-to-end-dot distance (the INNER segment,
 * not the arm-tip); the outer tail segments become radial handles extending
 * away from that circle. That choice is what lets two circle reads compose
 * into tapered solids — cups, cones, frustums — without a separate cone
 * primitive.
 *
 * This is intentionally a read over manji data, not a new placement
 * primitive. For canonical equal-bar manjis all four end dots agree on one
 * radius. For asymmetric/flexed programs the helper still returns the
 * average radius and exposes `isCircular`/`maxRadiusDelta` so callers can
 * decide whether to treat it as a circle or fall back to an ellipse/rect
 * read.
 *
 * 2D only. Pass output of `evaluateManji`, not `evaluateManji3D`. For a 3D
 * sibling read, build it from a chosen pair of bars on the 3D manji (the
 * triangle/cup demonstrations in the 0604 spike show how that lifts).
 */
export function anchorCircle(manji, epsilon = 1e-6) {
  const center = { ...manji.center };
  const named = [
    { direction: 'W', point: manji.bars[0].points.leftEnd, tip: manji.bars[0].points.leftTip },
    { direction: 'E', point: manji.bars[0].points.rightEnd, tip: manji.bars[0].points.rightTip },
    { direction: 'S', point: manji.bars[1].points.leftEnd, tip: manji.bars[1].points.leftTip },
    { direction: 'N', point: manji.bars[1].points.rightEnd, tip: manji.bars[1].points.rightTip },
  ];
  const radii = named.map(({ point }) => Math.hypot(point.x - center.x, point.y - center.y));
  const radius = radii.reduce((acc, r) => acc + r, 0) / Math.max(1, radii.length);
  const maxRadiusDelta = radii.reduce((max, r) => Math.max(max, Math.abs(r - radius)), 0);
  const points = Object.fromEntries(named.map(({ direction, point }) => [direction, { ...point }]));
  const radialArms = named.map(({ direction, point, tip }) => ({
    direction,
    from: { ...point },
    to: { ...tip },
  }));
  return {
    center,
    radius,
    points,
    radialArms,
    isCircular: maxRadiusDelta <= epsilon,
    maxRadiusDelta,
  };
}

/**
 * Anchor triangle: an equilateral triangle inscribed in the anchor-circle
 * read, plus three families of rays that turn the triangle into a *ray
 * controller* over the circle. The triangle is intentionally a sub-servant
 * of the parent manji: the manji stays the cardinal/perpendicular reality;
 * the triangle is a visual add-on that can sit at any rotation relative to
 * the parent because it does not claim to be reality.
 *
 * `rotationDeg = -90` points the first vertex up in ordinary math space.
 * The returned data is suitable as a base/rim surface for triangular
 * pyramids and 3-sided frustums, AND as the seed for emergent manjis
 * spawned along any of the three ray families (see `emergentManji`).
 *
 * Returned ray families (each entry carries `from`, `to`, and a unit
 * `direction` vector):
 *   - vertexRays — center → vertex (length = radius).
 *   - apothems   — center → edge midpoint (length = radius / 2 for the
 *                  equilateral case).
 *   - medians    — vertex i → midpoint of the edge opposite vertex i
 *                  (length = 3·radius / 2 for the equilateral case;
 *                  passes through the center, colinear with `-vertexRays[i]`).
 *
 * Vertex-rays and apothems together give a 6-fold star at 60° spacing.
 * The proper 6-vertices-on-the-same-circle completion is `anchorHexagon`.
 */
export function anchorTriangle(manji, options = {}) {
  const { rotationDeg = -90, epsilon = 1e-6 } = options;
  const circle = anchorCircle(manji, epsilon);
  const { center, radius } = circle;
  const vertices = [];
  for (let i = 0; i < 3; i++) {
    const theta = ((rotationDeg + i * 120) * Math.PI) / 180;
    vertices.push({
      x: center.x + radius * Math.cos(theta),
      y: center.y + radius * Math.sin(theta),
    });
  }
  const edges = vertices.map((from, i) => ({ from, to: vertices[(i + 1) % vertices.length] }));
  const edgeMidpoints = edges.map(({ from, to }) => ({
    x: (from.x + to.x) / 2,
    y: (from.y + to.y) / 2,
  }));
  const vertexRays = vertices.map((v) => ({
    from: { ...center },
    to: { ...v },
    direction: unitVector2D({ x: v.x - center.x, y: v.y - center.y }),
  }));
  const apothems = edgeMidpoints.map((m) => ({
    from: { ...center },
    to: { ...m },
    direction: unitVector2D({ x: m.x - center.x, y: m.y - center.y }),
  }));
  // medians[i] goes from vertex i to the midpoint of the edge that does NOT
  // touch vertex i. Edges are indexed (v[j] → v[j+1]); the edge opposite
  // vertex i is edges[(i+1) % 3] (between v[i+1] and v[i+2]).
  const medians = vertices.map((v, i) => {
    const m = edgeMidpoints[(i + 1) % 3];
    return {
      from: { ...v },
      to: { ...m },
      direction: unitVector2D({ x: m.x - v.x, y: m.y - v.y }),
    };
  });
  return {
    center: { ...center },
    radius,
    vertices,
    edges,
    edgeMidpoints,
    vertexRays,
    apothems,
    medians,
    isCircular: circle.isCircular,
    maxRadiusDelta: circle.maxRadiusDelta,
  };
}

/**
 * Spawn a new manji program oriented along a chosen ray of an anchor-triangle.
 *
 * The triangle is a visual sub-servant of the parent manji and need not lie
 * on the parent's cardinal lattice. The manji it generates, however, IS
 * locally cardinal — its own bar1 lies along the chosen ray, bar2 is
 * perpendicular, and the perpendicular line-pinning invariant continues
 * inside the child's frame. This is how off-axis structure enters the
 * system without breaking the manji idiom: each manji declares its own
 * cardinal frame, and the between-manji rotation is the triangle's
 * contribution.
 *
 * Options:
 *   along       — 'median' (default), 'vertexRay', or 'apothem'.
 *   index       — 0..2; which of the three rays in the chosen family.
 *   lengthScale — passed through to bar1/bar2 of the emergent program.
 *
 * Returns:
 *   {
 *     program,      // shape that evaluateManji consumes
 *     anchor,       // ray.to — where the emergent manji centers by default
 *     rotationDeg,  // bar1 orientation in degrees (informational/debug)
 *     source,       // { along, index } — provenance back to the parent triangle
 *   }
 *
 * Typical use:
 *   const emergent = emergentManji(triangle, { along: 'median', index: 0 });
 *   const childManji = evaluateManji(emergent.program, emergent.anchor, childScale);
 *
 * Callers are free to override `anchor` (e.g. center the child at the
 * triangle's centroid rather than at the ray tip) — the returned anchor is
 * the natural default, not a constraint.
 */
export function emergentManji(triangle, options = {}) {
  const { along = 'median', index = 0, lengthScale = 1 } = options;
  const families = {
    median: triangle?.medians,
    vertexRay: triangle?.vertexRays,
    apothem: triangle?.apothems,
  };
  const rays = families[along];
  if (!Array.isArray(rays)) {
    throw new Error(
      `emergentManji: unknown ray family '${along}' (expected 'median' | 'vertexRay' | 'apothem')`,
    );
  }
  const ray = rays[index];
  if (!ray) {
    throw new Error(`emergentManji: ray index ${index} out of range for family '${along}'`);
  }
  const rotationDeg = (Math.atan2(ray.direction.y, ray.direction.x) * 180) / Math.PI;
  const program = {
    bar1: { rotationDeg, lengthScale },
    bar2: { rotationDeg: rotationDeg + 90, lengthScale },
  };
  return {
    program,
    anchor: { ...ray.to },
    rotationDeg,
    source: { along, index },
  };
}

/**
 * Anchor hexagon: six vertices on the same circle as `anchorCircle`, at 60°
 * spacing. This is the natural completion of the 3-fold anchor-triangle
 * into a 6-fold hexagonal secondary lattice — the parent manji remains the
 * 4-fold cardinal primary lattice; the hexagon is the read you use when
 * you want six-spoke ray emissions from the circle or hex-tiled emergent
 * children.
 *
 * Like `anchorTriangle`, this is a read, not reality.
 *
 * Options:
 *   rotationDeg — orientation of the first vertex (default -90, top).
 */
export function anchorHexagon(manji, options = {}) {
  const { rotationDeg = -90, epsilon = 1e-6 } = options;
  const circle = anchorCircle(manji, epsilon);
  const { center, radius } = circle;
  const vertices = [];
  for (let i = 0; i < 6; i++) {
    const theta = ((rotationDeg + i * 60) * Math.PI) / 180;
    vertices.push({
      x: center.x + radius * Math.cos(theta),
      y: center.y + radius * Math.sin(theta),
    });
  }
  const edges = vertices.map((from, i) => ({ from, to: vertices[(i + 1) % vertices.length] }));
  const spokes = vertices.map((v) => ({
    from: { ...center },
    to: { ...v },
    direction: unitVector2D({ x: v.x - center.x, y: v.y - center.y }),
  }));
  return {
    center: { ...center },
    radius,
    vertices,
    edges,
    spokes,
    isCircular: circle.isCircular,
    maxRadiusDelta: circle.maxRadiusDelta,
  };
}

/**
 * Quadrants: the four cell rectangles defined by splitting the inscribed
 * rect around the manji's center. Order is math-convention:
 *   [0] NE (+x, +y), [1] NW (-x, +y), [2] SW (-x, -y), [3] SE (+x, -y).
 *
 * Use as child anchor frames when reading the manji as a SUBDIVIDER
 * rather than as a single bounded shape.
 */
export function quadrants(manji) {
  const rect = inscribedRect(manji);
  const cx = manji.center.x;
  const cy = manji.center.y;
  return [
    { min: { x: cx, y: cy }, max: { x: rect.max.x, y: rect.max.y } },
    { min: { x: rect.min.x, y: cy }, max: { x: cx, y: rect.max.y } },
    { min: { x: rect.min.x, y: rect.min.y }, max: { x: cx, y: cy } },
    { min: { x: cx, y: rect.min.y }, max: { x: rect.max.x, y: cy } },
  ];
}

// ----- Cardinality and line-pinning (manji-is-reality) ------------------
//
// The manji is the reification operator for the constellation: every bar
// is line-pinned to a cardinal axis. Bars do not rotate freely; tails do
// not fold to arbitrary angles. The kernel snaps to the constellation
// lattice so the "grid of reality" stays anchored. Organic primitives
// (blob-pla, wisp, fluid) ride ON TOP of this rigid frame; the kernel
// never bends to accommodate them.
//
// Cardinality convention (camera-relative, sun-grounded):
//   E      = facing horizon  (into the picture)
//   W      = facing eye level (out of the picture)
//   N      = picture-left
//   S      = picture-right
//   Zenith = perpendicular up   (perpendicular to base plane)
//   Nadir  = perpendicular down (perpendicular to base plane)
//
// Axis assignment (2D base-plane manji — 3D adds Zenith-Nadir as bar3):
//   bar1 is pinned to the N-S axis (picture-horizontal).
//   bar2 is pinned to the E-W axis (depth, picture-vertical-projection).
//
// Tail fold vocabulary (per tail, finite alphabet — no degrees):
//   The tail at an end-dot can extend in one of the cardinal directions
//   perpendicular to the bar's axis, OR colinear-out (continues the axis),
//   OR collapse-back (180° onto the interior segment).
//
// In 2D, an N-S bar has 4 fold targets per tail (N or S along the axis;
// E or W perpendicular). 3D adds Zenith and Nadir as perpendicular options.

export const CARDINAL_DIRECTIONS_2D = ['N', 'S', 'E', 'W'];
export const CARDINAL_DIRECTIONS_3D = ['N', 'S', 'E', 'W', 'Zenith', 'Nadir'];

export const CARDINAL_AXES = {
  'N-S': {
    rotationDeg: 0,
    ends: { negative: 'N', positive: 'S' }, // leftEnd at N, rightEnd at S
    perpendiculars2D: ['E', 'W'],
    perpendiculars3D: ['E', 'W', 'Zenith', 'Nadir'],
  },
  'E-W': {
    rotationDeg: 90,
    ends: { negative: 'W', positive: 'E' }, // leftEnd at W (picture-down), rightEnd at E (picture-up)
    perpendiculars2D: ['N', 'S'],
    perpendiculars3D: ['N', 'S', 'Zenith', 'Nadir'],
  },
  'Zenith-Nadir': {
    // No rotationDeg — this axis exists only in 3D (no 2D representation).
    // The 2D cardinalBar throws if asked for this axis; the 3D evaluator
    // (evaluateBar3D / evaluateManji3D) consumes it natively.
    rotationDeg: null,
    ends: { negative: 'Nadir', positive: 'Zenith' },
    perpendiculars2D: [],
    perpendiculars3D: ['N', 'S', 'E', 'W'],
  },
};

// Per-axis, per-perpendicular-direction → angle relative to outward tail.
// The perpendicular fold rotates 90° in the chosen direction; the choice
// of +90 vs -90 picks which of the two perpendicular cardinals.
const PERPENDICULAR_FOLD_ANGLES = {
  'N-S': { E: 90, W: -90 },
  'E-W': { N: 90, S: -90 },
};

/**
 * Resolve a (axis, end-cardinal, target-direction) triple into the tailDeg
 * value that evaluateBar consumes. Accepts the aliases 'open' (colinear
 * out, equivalent to naming the end's own cardinal) and 'closed' (180°
 * collapse, equivalent to naming the end's opposite cardinal).
 *
 * Throws on non-cardinal targets — that's the line-pinning rule enforced.
 */
export function resolveCardinalTail(axis, endCardinal, target) {
  const spec = CARDINAL_AXES[axis];
  if (!spec) throw new Error(`resolveCardinalTail: unknown axis '${axis}'`);
  if (endCardinal !== spec.ends.negative && endCardinal !== spec.ends.positive) {
    throw new Error(
      `resolveCardinalTail: end '${endCardinal}' is not on axis '${axis}' (must be '${spec.ends.negative}' or '${spec.ends.positive}')`,
    );
  }
  if (target === 'open' || target === endCardinal) return 0;
  const opposite = endCardinal === spec.ends.negative ? spec.ends.positive : spec.ends.negative;
  if (target === 'closed' || target === opposite) return 180;
  const fold = PERPENDICULAR_FOLD_ANGLES[axis]?.[target];
  if (fold === undefined) {
    throw new Error(
      `resolveCardinalTail: target '${target}' is not a valid fold for axis '${axis}' (must be one of: open, closed, ${spec.perpendiculars2D.join(', ')}, or a cardinal end of this axis)`,
    );
  }
  return fold;
}

/**
 * Build a cardinal-compliant bar program. The bar is line-pinned to one
 * cardinal axis and each tail's fold target is a cardinal direction name.
 *
 *   cardinalBar({
 *     axis: 'N-S',
 *     tails: { N: 'open', S: 'open' },  // canonical N-S bar with both ends extended
 *   })
 *
 * Or with perpendicular folds:
 *
 *   cardinalBar({
 *     axis: 'N-S',
 *     tails: { N: 'E', S: 'closed' },   // N tail folds east; S tail collapsed
 *   })
 *
 * Returns the low-level `{ rotationDeg, leftTailDeg, rightTailDeg, lengthScale }`
 * shape that evaluateBar consumes. Use this constructor in preference to
 * raw angles — it enforces line-pinning and cardinal fold semantics.
 */
export function cardinalBar({ axis, tails = {}, lengthScale = 1 } = {}) {
  const spec = CARDINAL_AXES[axis];
  if (!spec) throw new Error(`cardinalBar: unknown axis '${axis}'`);
  if (spec.rotationDeg === null) {
    throw new Error(`cardinalBar: axis '${axis}' is 3D-only; use evaluateBar3D / evaluateManji3D instead`);
  }
  const negTarget = tails[spec.ends.negative] ?? 'open';
  const posTarget = tails[spec.ends.positive] ?? 'open';
  return {
    rotationDeg: spec.rotationDeg,
    leftTailDeg: resolveCardinalTail(axis, spec.ends.negative, negTarget),
    rightTailDeg: resolveCardinalTail(axis, spec.ends.positive, posTarget),
    lengthScale,
  };
}

/**
 * Build a cardinal-compliant 2-bar manji program from cardinal specs.
 *
 *   cardinalManji({
 *     bar1: { axis: 'N-S', tails: { N: 'open', S: 'open' } },
 *     bar2: { axis: 'E-W', tails: { W: 'open', E: 'open' } },
 *   })
 *
 * The result is the program shape evaluateManji consumes.
 */
export function cardinalManji({ bar1, bar2 } = {}) {
  if (!bar1 || !bar2) throw new Error('cardinalManji: bar1 and bar2 required');
  if (bar1.axis === bar2.axis) throw new Error(`cardinalManji: bars must be perpendicular (both bars are on '${bar1.axis}')`);
  return { bar1: cardinalBar(bar1), bar2: cardinalBar(bar2) };
}

/**
 * Check whether an angle in degrees snaps to a cardinal quarter-turn
 * (0, 90, 180, 270 modulo 360). Used by the validator below.
 */
export function isCardinalAngle(deg, eps = 1e-9) {
  if (!Number.isFinite(deg)) return false;
  const normalized = ((deg % 360) + 360) % 360;
  return [0, 90, 180, 270].some((c) => Math.abs(normalized - c) < eps || Math.abs(normalized - c - 360) < eps);
}

/**
 * Validate a bar program against the cardinality+line-pinning rule.
 * Returns an array of error messages (empty when valid).
 *
 * The validator is conservative — it accepts any rotation/tail that snaps
 * to a cardinal quarter-turn. It does NOT require the program to have
 * been built via `cardinalBar`; raw `evaluateBar` programs with cardinal
 * angles pass.
 */
export function validateCardinalBar(barSpec) {
  const errors = [];
  if (!isCardinalAngle(barSpec.rotationDeg ?? 0)) {
    errors.push(`rotationDeg ${barSpec.rotationDeg} is not a cardinal angle (must snap to 0, 90, 180, or 270)`);
  }
  if (!isCardinalAngle(barSpec.leftTailDeg ?? 0)) {
    errors.push(`leftTailDeg ${barSpec.leftTailDeg} is not a cardinal angle`);
  }
  if (!isCardinalAngle(barSpec.rightTailDeg ?? 0)) {
    errors.push(`rightTailDeg ${barSpec.rightTailDeg} is not a cardinal angle`);
  }
  return errors;
}

/**
 * Validate a full manji program (bar1 + bar2) against the cardinality
 * rule. Returns an array of error messages (empty when valid).
 */
export function validateCardinalManji(program) {
  const errors = [];
  if (program?.bar1) errors.push(...validateCardinalBar(program.bar1).map((e) => `bar1: ${e}`));
  if (program?.bar2) errors.push(...validateCardinalBar(program.bar2).map((e) => `bar2: ${e}`));
  return errors;
}

// ----- 3D kernel (Zenith-Nadir as third axis) ---------------------------
//
// The cardinality + line-pinning rule extends to three dimensions without
// modification. A 3D manji has up to three bars (one per cardinal axis),
// six arm-tips at the six cardinals, and fold targets named from the same
// alphabet with two more entries (Zenith, Nadir).
//
// The 3D evaluator is cardinal-by-design — there is no rotationDeg or
// per-axis-angle representation. Each bar runs along its cardinal axis
// and each tail extends in a named cardinal direction.

export const CARDINAL_VECTORS_3D = {
  N: { x: -1, y: 0, z: 0 },
  S: { x: 1, y: 0, z: 0 },
  E: { x: 0, y: 1, z: 0 },
  W: { x: 0, y: -1, z: 0 },
  Zenith: { x: 0, y: 0, z: 1 },
  Nadir: { x: 0, y: 0, z: -1 },
};

function add3(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function scale3(v, s) { return { x: v.x * s, y: v.y * s, z: v.z * s }; }
function applyTransform3(p, anchor, scale) {
  return { x: anchor.x + scale * p.x, y: anchor.y + scale * p.y, z: anchor.z + scale * p.z };
}

/**
 * Resolve a 3D tail target (cardinal name | 'open' | 'closed') into the
 * direction vector the tail extends from its end-dot.
 */
export function resolveCardinalTail3D(axis, endCardinal, target) {
  const spec = CARDINAL_AXES[axis];
  if (!spec) throw new Error(`resolveCardinalTail3D: unknown axis '${axis}'`);
  if (endCardinal !== spec.ends.negative && endCardinal !== spec.ends.positive) {
    throw new Error(
      `resolveCardinalTail3D: end '${endCardinal}' is not on axis '${axis}' (must be '${spec.ends.negative}' or '${spec.ends.positive}')`,
    );
  }
  const opposite = endCardinal === spec.ends.negative ? spec.ends.positive : spec.ends.negative;
  if (target === 'open' || target === endCardinal) return CARDINAL_VECTORS_3D[endCardinal];
  if (target === 'closed' || target === opposite) return CARDINAL_VECTORS_3D[opposite];
  if (!spec.perpendiculars3D.includes(target)) {
    throw new Error(
      `resolveCardinalTail3D: target '${target}' is not a valid 3D fold for axis '${axis}' (must be one of: open, closed, ${spec.perpendiculars3D.join(', ')}, or a cardinal end of this axis)`,
    );
  }
  return CARDINAL_VECTORS_3D[target];
}

/**
 * Evaluate a 3D bar in its local frame (center at origin, bar along its
 * cardinal axis). The bar has 4 equal-length segments per the manji
 * invariant: tip — segment — endDot — segment — center — segment — endDot
 * — segment — tip. All four segment lengths = SEGMENT_LENGTH × lengthScale.
 *
 * Spec shape:
 *   { axis: 'N-S' | 'E-W' | 'Zenith-Nadir',
 *     tails: { [negCardinal]: target, [posCardinal]: target },
 *     lengthScale: number }
 *
 * Tail target is a cardinal direction name, or 'open' (colinear out),
 * or 'closed' (180° collapse onto interior).
 */
export function evaluateBar3D({ axis, tails = {}, lengthScale = 1 } = {}) {
  const spec = CARDINAL_AXES[axis];
  if (!spec) throw new Error(`evaluateBar3D: unknown axis '${axis}'`);
  const L = SEGMENT_LENGTH * lengthScale;
  const negEndDir = CARDINAL_VECTORS_3D[spec.ends.negative];
  const posEndDir = CARDINAL_VECTORS_3D[spec.ends.positive];

  const center = { x: 0, y: 0, z: 0 };
  const negEnd = scale3(negEndDir, L);
  const posEnd = scale3(posEndDir, L);

  const negTarget = tails[spec.ends.negative] ?? 'open';
  const posTarget = tails[spec.ends.positive] ?? 'open';

  const negTailDir = resolveCardinalTail3D(axis, spec.ends.negative, negTarget);
  const posTailDir = resolveCardinalTail3D(axis, spec.ends.positive, posTarget);

  const negTip = add3(negEnd, scale3(negTailDir, L));
  const posTip = add3(posEnd, scale3(posTailDir, L));

  return {
    axis,
    points: {
      center,
      negEnd, posEnd, negTip, posTip,
      negCardinal: spec.ends.negative,
      posCardinal: spec.ends.positive,
    },
    segments: [
      { from: negTip, to: negEnd },
      { from: negEnd, to: center },
      { from: center, to: posEnd },
      { from: posEnd, to: posTip },
    ],
  };
}

function transformBar3D(bar, anchor, scale) {
  const tr = (p) => applyTransform3(p, anchor, scale);
  return {
    axis: bar.axis,
    points: {
      center: tr(bar.points.center),
      negEnd: tr(bar.points.negEnd),
      posEnd: tr(bar.points.posEnd),
      negTip: tr(bar.points.negTip),
      posTip: tr(bar.points.posTip),
      negCardinal: bar.points.negCardinal,
      posCardinal: bar.points.posCardinal,
    },
    segments: bar.segments.map((s) => ({ from: tr(s.from), to: tr(s.to) })),
  };
}

/**
 * Evaluate a 3D manji — one to three bars sharing a center, each pinned
 * to a distinct cardinal axis. Returns center, transformed bars, the
 * concatenated armTips array, and the axis-aligned 3D bbox.
 */
export function evaluateManji3D({ bars = [] } = {}, anchor = { x: 0, y: 0, z: 0 }, scale = 1) {
  const seen = new Set();
  for (const b of bars) {
    if (seen.has(b.axis)) throw new Error(`evaluateManji3D: two bars on axis '${b.axis}'`);
    seen.add(b.axis);
  }
  const evals = bars.map((b) => transformBar3D(evaluateBar3D(b), anchor, scale));
  const armTips = evals.flatMap((e) => [e.points.negTip, e.points.posTip]);
  return {
    center: { ...anchor },
    bars: evals,
    armTips,
    bbox: bbox3DOf(armTips),
  };
}

/**
 * Convenience constructor mirroring `cardinalManji` (2D). Takes named
 * bar1/bar2/bar3 (each optional, each carrying its own axis/tails/scale)
 * and returns the program shape `evaluateManji3D` consumes.
 */
export function cardinalManji3D({ bar1, bar2, bar3 } = {}) {
  const bars = [bar1, bar2, bar3].filter(Boolean);
  if (bars.length === 0) throw new Error('cardinalManji3D: at least one bar required');
  return { bars };
}

/**
 * 3D bbox helpers. Axis-aligned. Used by inscribedCuboid and the 3D
 * containment / octant tilings.
 */
export function bbox3DOf(points) {
  if (!points || !points.length) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  }
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.z > maxZ) maxZ = p.z;
  }
  return { min: { x: minX, y: minY, z: minZ }, max: { x: maxX, y: maxY, z: maxZ } };
}

export function boxVolume(bbox3) {
  const w = Math.max(0, bbox3.max.x - bbox3.min.x);
  const h = Math.max(0, bbox3.max.y - bbox3.min.y);
  const d = Math.max(0, bbox3.max.z - bbox3.min.z);
  return w * h * d;
}

export function containedIn3D(inner, outer, eps = 1e-6) {
  return (
    inner.min.x >= outer.min.x - eps &&
    inner.min.y >= outer.min.y - eps &&
    inner.min.z >= outer.min.z - eps &&
    inner.max.x <= outer.max.x + eps &&
    inner.max.y <= outer.max.y + eps &&
    inner.max.z <= outer.max.z + eps
  );
}

/**
 * 3D bar extent: total end-to-end length of a bar in world space (4 equal
 * segments × SEGMENT_LENGTH × lengthScale = 4 × lengthScale at scale 1).
 */
export function barExtent3D(manji3D, barIndex) {
  const bar = manji3D.bars[barIndex];
  if (!bar) throw new Error(`barExtent3D: invalid bar index ${barIndex}`);
  const { negEnd, posEnd, negTip } = bar.points;
  const interior = Math.hypot(posEnd.x - negEnd.x, posEnd.y - negEnd.y, posEnd.z - negEnd.z);
  const tail = Math.hypot(negTip.x - negEnd.x, negTip.y - negEnd.y, negTip.z - negEnd.z);
  return interior + 2 * tail;
}

// ----- 3D derived-shape helpers (analogs of 2D inscribedRect etc.) ------

/**
 * Inscribed cuboid: the axis-aligned 3D bbox of the manji's 6 arm-tips.
 * For a 3D manji with equal bar lengths this is a cube; for asymmetric
 * bar lengths it's a general cuboid.
 */
export function inscribedCuboid(manji3D) {
  return bbox3DOf(manji3D.armTips);
}

/**
 * Circumscribed ellipsoid: axis-aligned ellipsoid with semi-axes equal to
 * the manji's max arm-tip distance from center along each cardinal axis.
 * For equal bar lengths this is a sphere.
 */
export function circumscribedEllipsoid(manji3D) {
  let semiX = 0, semiY = 0, semiZ = 0;
  for (const tip of manji3D.armTips) {
    const dx = Math.abs(tip.x - manji3D.center.x);
    const dy = Math.abs(tip.y - manji3D.center.y);
    const dz = Math.abs(tip.z - manji3D.center.z);
    if (dx > semiX) semiX = dx;
    if (dy > semiY) semiY = dy;
    if (dz > semiZ) semiZ = dz;
  }
  return { center: { ...manji3D.center }, semiX, semiY, semiZ };
}

/**
 * Inscribed sphere: largest axis-aligned sphere fitting inside the manji's
 * inscribed cuboid. Radius = min semi-axis of the cuboid.
 */
export function inscribedSphere(manji3D) {
  const rect = inscribedCuboid(manji3D);
  const semiX = Math.min(manji3D.center.x - rect.min.x, rect.max.x - manji3D.center.x);
  const semiY = Math.min(manji3D.center.y - rect.min.y, rect.max.y - manji3D.center.y);
  const semiZ = Math.min(manji3D.center.z - rect.min.z, rect.max.z - manji3D.center.z);
  return { center: { ...manji3D.center }, radius: Math.min(semiX, semiY, semiZ) };
}

/**
 * Octants: the 8 cell cuboids defined by splitting the inscribed cuboid
 * around the manji's center. Used as child anchor frames when reading the
 * 3D manji as a SUBDIVIDER (3D analog of `quadrants`).
 *
 * Order: 8 octants indexed by sign of (x, y, z) offset from center —
 * [+,+,+], [-,+,+], [-,-,+], [+,-,+], [+,+,-], [-,+,-], [-,-,-], [+,-,-].
 */
export function octants(manji3D) {
  const rect = inscribedCuboid(manji3D);
  const cx = manji3D.center.x;
  const cy = manji3D.center.y;
  const cz = manji3D.center.z;
  const xs = [[cx, rect.max.x], [rect.min.x, cx]];
  const ys = [[cy, rect.max.y], [rect.min.y, cy]];
  const zs = [[cz, rect.max.z], [rect.min.z, cz]];
  const out = [];
  // Order chosen to mirror 2D quadrants ordering (NE, NW, SW, SE) lifted
  // into 3D with the upper z half first, then the lower half.
  const indexPattern = [
    [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
  ];
  for (const [ix, iy, iz] of indexPattern) {
    out.push({
      min: { x: xs[ix][0], y: ys[iy][0], z: zs[iz][0] },
      max: { x: xs[ix][1], y: ys[iy][1], z: zs[iz][1] },
    });
  }
  return out;
}

/**
 * Validate a 3D manji program — every bar must be on a known cardinal
 * axis, no two bars share an axis, every tail target must be a valid
 * cardinal name for its bar's axis.
 */
export function validateCardinalManji3D(program) {
  const errors = [];
  if (!program || !Array.isArray(program.bars)) {
    errors.push('program.bars must be an array');
    return errors;
  }
  const seen = new Set();
  for (let i = 0; i < program.bars.length; i++) {
    const b = program.bars[i];
    if (!CARDINAL_AXES[b?.axis]) {
      errors.push(`bar[${i}]: unknown axis '${b?.axis}'`);
      continue;
    }
    if (seen.has(b.axis)) errors.push(`bar[${i}]: axis '${b.axis}' is already used by another bar`);
    seen.add(b.axis);
    const spec = CARDINAL_AXES[b.axis];
    for (const endCardinal of [spec.ends.negative, spec.ends.positive]) {
      const target = b.tails?.[endCardinal];
      if (target === undefined) continue;
      try {
        resolveCardinalTail3D(b.axis, endCardinal, target);
      } catch (e) {
        errors.push(`bar[${i}]: ${e.message}`);
      }
    }
  }
  return errors;
}

export function _quantizeAngleForTests(deg) {
  return quantizeAngle(deg);
}
