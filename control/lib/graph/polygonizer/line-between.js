/**
 * line-between — sine/cosine curves between two named manji points.
 *
 * A second primitive family on the polygonizer substrate, sibling to the
 * structural manji-tree. Where the tree gives the model cardinal anchor
 * points + slot grammar, line-between draws 1px curves BETWEEN any two
 * of those points using one piece of math (a sine wave over the
 * segment) parameterized continuously by the model.
 *
 * The same primitive draws:
 *   - a hung cable (gravity-derived sag, wavelengths=0.5)
 *   - a basketball arc (negative sag opposing gravity, wavelengths=0.5)
 *   - a vibrating string (multi-wavelength, plane override)
 *   - a taut wire (sag=0)
 *
 * No closed vocabulary of named physics; the model fills in numbers
 * based on what it knows the line is FOR.
 *
 * See the spike at line-between.spike.gen.test.js for end-to-end render
 * scenes and the design write-up that motivated this module.
 */

/**
 * Endpoint path grammar — two flavors, both rooted on a node's authored
 * `id`:
 *
 *   "<node-id>/slot/<slot-id>"
 *   "<node-id>/bar/<axis>/<point-name>"
 *
 * axis ∈ { 'N-S', 'E-W', 'Zenith-Nadir' }
 * point-name ∈ { 'center', 'negEnd', 'posEnd', 'negTip', 'posTip' }
 *
 * Node ids are authored on tree nodes the model wants to reference.
 * Slot ids are the same names the manji-tree children bind to.
 *
 * Ambient `self` reference — when a leaf mark is authored inside the
 * tree, paths starting with `self/` resolve against the nearest enclosing
 * manji node's id. The resolver substitutes `self` for the `selfId`
 * passed at resolution time (captured by the walker per leaf). This is
 * what makes shelf cards portable: a `calm-water` card authoring
 * `corners: ['self/slot/NW', ...]` becomes drop-in-callable against any
 * host that provides those slot names.
 *
 * `buildEndpointResolver` indexes a walker's emitted node list once by id
 * and returns a resolver function that answers paths with world XYZ.
 * Throws (with a path-naming-aware message) on unresolvable paths.
 */
export function buildEndpointResolver(emittedNodes) {
  const byId = new Map();
  for (const node of emittedNodes) {
    if (node && node.id) byId.set(node.id, node);
  }
  return function resolveEndpoint(pathStr, selfId) {
    if (typeof pathStr !== 'string' || !pathStr.includes('/')) {
      throw new Error(
        `endpoint path must be a string like '<node-id>/slot/<slot-id>' or '<node-id>/bar/<axis>/<point-name>'; got: ${JSON.stringify(pathStr)}`,
      );
    }
    const parts = pathStr.split('/');
    let nodeId = parts[0];
    if (nodeId === 'self') {
      if (!selfId) {
        throw new Error(
          `endpoint path '${pathStr}': 'self' has no enclosing manji node in scope (leaf authored above any manji, or root has no id)`,
        );
      }
      nodeId = selfId;
    }
    const node = byId.get(nodeId);
    if (!node) {
      const available = [...byId.keys()].join(', ') || '<none>';
      throw new Error(
        `endpoint path '${pathStr}': unknown node id '${nodeId}' (have: ${available})`,
      );
    }
    const kind = parts[1];
    if (kind === 'slot') {
      const slotId = parts[2];
      const slot = node.slots?.find((s) => s.id === slotId);
      if (!slot) {
        const available = (node.slots || []).map((s) => s.id).join(', ') || '<none>';
        throw new Error(
          `endpoint path '${pathStr}': slot '${slotId}' not on node '${nodeId}' (have: ${available})`,
        );
      }
      return slot.worldPosition;
    }
    if (kind === 'bar') {
      const axis = parts[2];
      const pointName = parts[3];
      const bar = node.spineManji?.bars?.find((b) => b.axis === axis);
      if (!bar) {
        const available = (node.spineManji?.bars || []).map((b) => b.axis).join(', ') || '<none>';
        throw new Error(
          `endpoint path '${pathStr}': bar '${axis}' not on node '${nodeId}' (have: ${available})`,
        );
      }
      const point = bar.points?.[pointName];
      if (!point) {
        throw new Error(
          `endpoint path '${pathStr}': point '${pointName}' not on bar '${axis}' (have: center, negEnd, posEnd, negTip, posTip)`,
        );
      }
      return point;
    }
    throw new Error(
      `endpoint path '${pathStr}': second segment must be 'slot' or 'bar', got '${kind}'`,
    );
  };
}

/**
 * Validate a list of connection specs against a walker's emitted nodes.
 * Returns an array of error strings (empty when valid).
 *
 * Called at mint time so bad inputs surface as 400s, not 500s at render
 * time. Endpoint resolution is the original check; volume-related fields
 * (modes, crossSection, radius) added in the figure-substrate work are
 * range-checked here too so the renderer never has to defend against
 * malformed shapes.
 */
export function validateConnections(connections, emittedNodes, physics = defaultPhysics()) {
  const errors = [];
  if (!Array.isArray(connections)) return errors;
  const resolveEndpoint = buildEndpointResolver(emittedNodes);
  connections.forEach((spec, i) => {
    if (!spec || typeof spec !== 'object') {
      errors.push(`connections[${i}]: must be an object with from/to`);
      return;
    }
    let from;
    let to;
    let endpointsResolved = true;
    for (const end of ['from', 'to']) {
      try {
        const p = resolveEndpoint(spec[end]);
        if (end === 'from') from = p; else to = p;
      } catch (err) {
        errors.push(`connections[${i}].${end}: ${err.message}`);
        endpointsResolved = false;
      }
    }
    const shapeErrors = validateVolumeSpec(spec, `connections[${i}]`);
    for (const e of shapeErrors) errors.push(e);
    if (endpointsResolved && spec.lengthMode === 'preserve' && Number.isFinite(spec.limbLength)) {
      const lengthErr = checkLengthReification(spec, from, to, physics, `connections[${i}]`);
      if (lengthErr) errors.push(lengthErr);
    }
  });
  return errors;
}

const CROSS_SECTION_KINDS = new Set(['none', 'lateral', 'tube']);
const LENGTH_MODES = new Set(['stretch', 'preserve']);
const LIMB_LENGTH_TOLERANCE = 0.05;

function checkLengthReification(spec, from, to, physics, where) {
  const arcLength = arcLengthOfLineBetween({ ...spec, from, to }, physics);
  const limbLength = spec.limbLength;
  const tol = LIMB_LENGTH_TOLERANCE * Math.max(limbLength, 1e-6);
  if (Math.abs(arcLength - limbLength) <= tol) return null;
  return (
    `${where}: lengthMode 'preserve' violated — arc length ${arcLength.toFixed(3)} ` +
    `cannot bridge limbLength ${limbLength.toFixed(3)} (tolerance ±${tol.toFixed(3)}). ` +
    `Adjust endpoint positions or modes so the wave fits, or set lengthMode:'stretch'.`
  );
}

function validateVolumeSpec(spec, where) {
  const errors = [];
  if (spec.lengthMode !== undefined) {
    if (typeof spec.lengthMode !== 'string' || !LENGTH_MODES.has(spec.lengthMode)) {
      errors.push(`${where}.lengthMode: must be one of ${[...LENGTH_MODES].map((k) => `'${k}'`).join(', ')}`);
    }
  }
  if (spec.limbLength !== undefined) {
    if (!Number.isFinite(spec.limbLength) || spec.limbLength <= 0) {
      errors.push(`${where}.limbLength: must be a positive finite number`);
    }
  }
  if (spec.lengthMode === 'preserve' && spec.limbLength === undefined) {
    errors.push(`${where}: lengthMode 'preserve' requires limbLength to be set`);
  }
  if (spec.modes !== undefined) {
    if (!Array.isArray(spec.modes)) {
      errors.push(`${where}.modes: must be an array of { amplitude, cycles, phase? } objects`);
    } else {
      spec.modes.forEach((m, j) => {
        if (!m || typeof m !== 'object') {
          errors.push(`${where}.modes[${j}]: must be an object with amplitude + cycles`);
          return;
        }
        if (!Number.isFinite(m.amplitude)) {
          errors.push(`${where}.modes[${j}].amplitude: must be a finite number`);
        }
        if (!Number.isFinite(m.cycles) || m.cycles <= 0) {
          errors.push(`${where}.modes[${j}].cycles: must be a positive number (typically a half-integer for endpoint-pinning)`);
        }
        if (m.phase !== undefined && !Number.isFinite(m.phase)) {
          errors.push(`${where}.modes[${j}].phase: must be a finite number if provided`);
        }
      });
    }
  }
  if (spec.crossSection !== undefined) {
    if (typeof spec.crossSection !== 'string' || !CROSS_SECTION_KINDS.has(spec.crossSection)) {
      errors.push(`${where}.crossSection: must be one of ${[...CROSS_SECTION_KINDS].map((k) => `'${k}'`).join(', ')}`);
    }
  }
  if (spec.radius !== undefined) {
    const r = spec.radius;
    if (typeof r === 'number') {
      if (!Number.isFinite(r) || r < 0) {
        errors.push(`${where}.radius: numeric radius must be a non-negative finite number`);
      }
    } else if (Array.isArray(r)) {
      if (r.length < 2) {
        errors.push(`${where}.radius: profile array needs at least two { t, r } control points`);
      }
      r.forEach((cp, j) => {
        if (!cp || typeof cp !== 'object') {
          errors.push(`${where}.radius[${j}]: must be an object { t, r }`);
          return;
        }
        if (!Number.isFinite(cp.t) || cp.t < 0 || cp.t > 1) {
          errors.push(`${where}.radius[${j}].t: must be a number in [0, 1]`);
        }
        if (!Number.isFinite(cp.r) || cp.r < 0) {
          errors.push(`${where}.radius[${j}].r: must be a non-negative finite number`);
        }
      });
    } else {
      errors.push(`${where}.radius: must be a number or an array of { t, r } control points`);
    }
  }
  if (spec.crossSection && spec.crossSection !== 'none' && spec.radius === undefined) {
    errors.push(`${where}: crossSection '${spec.crossSection}' requires a radius (number or { t, r } profile)`);
  }
  return errors;
}

/**
 * Scene-global physics defaults. Earth-like: gravity points down in
 * world -Z, default sag is ~12% of the segment span at unit strength.
 *
 * A manifest's `physics` field overrides any subset of these. Per-line
 * physics overrides are deliberately not supported — one Earth per scene.
 */
export function defaultPhysics() {
  return {
    gravity: { x: 0, y: 0, z: -1 },
    gravityStrength: 1,
    defaultSagFactor: 0.12,
  };
}

/**
 * Sample a sine/cosine curve in 3D between two endpoints, returning a
 * polyline (array of { x, y, z } points).
 *
 * Spec shape (all optional except from/to):
 *   {
 *     from, to,             // 3D points (resolved by the caller)
 *     sag?:         number,  // signed peak displacement in world units
 *     relativeSag?: number,  // signed peak displacement as a fraction
 *                            // of the span (cards use this so the same
 *                            // recipe produces a consistent reading at
 *                            // any endpoint distance)
 *     wavelengths?: number,  // full sine cycles across span (default 0.5)
 *     plane?:       {x,y,z}, // bulge direction override
 *     samples?:     number,  // polyline resolution (default 48)
 *   }
 *
 * Physics shape (subset of `defaultPhysics()`'s output): gravity vector,
 * gravityStrength multiplier, defaultSagFactor for auto-sag.
 *
 * Sag precedence (most specific wins):
 *   1. spec.sag         — absolute world-unit displacement (per-line override)
 *   2. spec.relativeSag — fraction of span × span (portable per-card recipe)
 *   3. physics auto-sag — span × physics.defaultSagFactor × gravityStrength
 *
 * Positive sag bulges in the displacement direction; negative sag bulges
 * opposite. Cards that want trajectory-style arcs against gravity declare
 * a negative `relativeSag` (e.g. -0.25 = peak displacement up by 25% of
 * span); cards that want catenary-style hangs declare a positive value.
 *
 * Displacement direction rule:
 *   - If spec.plane is provided, use it (normalized).
 *   - Otherwise, project gravity onto the plane perpendicular to the
 *     segment. That gives the component that physically pulls the line
 *     sideways. For a segment nearly parallel to gravity, this is
 *     near-zero — the line reads as straight (right for vertical hangers).
 *   - If the perpendicular gravity is degenerate, fall back to a stable
 *     arbitrary perpendicular so the wave still has a plane.
 */
export function sampleLineBetween(spec, physics = defaultPhysics()) {
  if (!spec || !spec.from || !spec.to) {
    throw new Error('sampleLineBetween: spec.from and spec.to are required');
  }
  const { centerline } = sampleCenterline(spec, physics);
  return centerline;
}

/**
 * Volumized sampler — returns the centerline plus left/right edge
 * polylines and per-sample tangents + radii. Used by `crossSection:
 * 'lateral'` (ribbon between leftEdge and rightEdge) and the upcoming
 * `crossSection: 'tube'` extrusion in Phase 2. The same `spec` keys
 * `sampleLineBetween` reads are honored here; `crossSection` and
 * `radius` (number or [{t,r}] profile) are required additions.
 *
 *   {
 *     ...sampleLineBetween-spec,
 *     crossSection: 'lateral' | 'tube',
 *     radius: number | [{ t, r }],
 *   }
 *
 * Edge direction: edges offset along the same displacement direction
 * that drives the wave (gravity-perpendicular by default, or
 * spec.plane override). This means the ribbon's width lies in the
 * wave's bulge plane — a hanging limb reads as a "fat" hung tube.
 * For figure use, this gives a flat-2D-readable thickness; Phase 2's
 * tube extrusion handles real 3D silhouettes for perspective scenes.
 */
export function sampleLineBetweenVolumized(spec, physics = defaultPhysics()) {
  if (!spec || !spec.from || !spec.to) {
    throw new Error('sampleLineBetweenVolumized: spec.from and spec.to are required');
  }
  if (!spec.crossSection || spec.crossSection === 'none') {
    throw new Error("sampleLineBetweenVolumized: spec.crossSection must be 'lateral' or 'tube'");
  }
  if (spec.radius === undefined) {
    throw new Error('sampleLineBetweenVolumized: spec.radius is required when crossSection is set');
  }
  const { centerline, displacementDir, tangents, ts } = sampleCenterline(spec, physics);
  const radii = ts.map((t) => resolveRadius(t, spec.radius));
  if (spec.crossSection === 'lateral') {
    const leftEdge = centerline.map((p, i) => add3(p, scale3(displacementDir, radii[i])));
    const rightEdge = centerline.map((p, i) => add3(p, scale3(displacementDir, -radii[i])));
    return { kind: 'lateral', centerline, leftEdge, rightEdge, tangents, radii };
  }
  // tube — emit a 3D ring of K samples at each centerline station around
  // the world-tangent. The renderer projects the rings and extracts a
  // screen-space silhouette as left/right edge polylines (same shape the
  // ribbon paint path already consumes).
  const ringSamples = Math.max(6, Math.floor(Number.isFinite(spec.ringSamples) ? spec.ringSamples : 12));
  const rings = centerline.map((center, i) => {
    const T = tangents[i];
    const N = normalize3(cross3(T, pickStableReference(T)));
    const B = normalize3(cross3(T, N));
    const r = radii[i];
    const ring = [];
    for (let k = 0; k < ringSamples; k++) {
      const angle = (2 * Math.PI * k) / ringSamples;
      const offset = add3(scale3(N, Math.cos(angle) * r), scale3(B, Math.sin(angle) * r));
      ring.push(add3(center, offset));
    }
    return ring;
  });
  return { kind: 'tube', centerline, rings, tangents, radii };
}

function pickStableReference(t) {
  return Math.abs(t.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
}

/**
 * Internal: shared centerline sampler used by both `sampleLineBetween`
 * and `sampleLineBetweenVolumized`. Returns the centerline polyline plus
 * the displacement direction and per-sample tangent vectors. Tangents
 * are finite-differenced from the centerline (cheap; good enough for
 * cross-section orientation and arc-length quadrature).
 */
function sampleCenterline(spec, physics) {
  const span = len3(sub3(spec.to, spec.from));
  const samples = Math.max(8, Math.floor(Number.isFinite(spec.samples) ? spec.samples : 48));
  const modes = interpretModes(spec, span, physics);
  const displacementDir = resolveDisplacementDirection(
    spec.from,
    spec.to,
    physics.gravity || defaultPhysics().gravity,
    spec.plane,
  );

  const centerline = [];
  const ts = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const wave = evaluateModesSum(t, modes);
    const base = add3(spec.from, scale3(sub3(spec.to, spec.from), t));
    centerline.push(add3(base, scale3(displacementDir, wave)));
    ts.push(t);
  }
  const tangents = [];
  for (let i = 0; i <= samples; i++) {
    const a = centerline[Math.max(0, i - 1)];
    const b = centerline[Math.min(samples, i + 1)];
    tangents.push(normalize3(sub3(b, a)));
  }
  return { centerline, displacementDir, tangents, ts, modes, span };
}

/**
 * Resolve a spec's wave content into a normalized list of
 * `{ amplitude, cycles, phase }` modes. Precedence:
 *
 *   1. spec.modes (explicit Fourier list) — used as-is when provided.
 *   2. legacy sag/relativeSag/auto-sag + spec.wavelengths — translated
 *      into a single equivalent mode so the sampling path is uniform.
 *
 * Half-integer cycles preserve Dirichlet endpoint-pinning (zero at
 * t=0 and t=1). The substrate does not enforce this — authors pick
 * cycle counts that match their intent.
 */
function interpretModes(spec, span, physics) {
  if (Array.isArray(spec.modes) && spec.modes.length > 0) {
    return spec.modes.map((m) => ({
      amplitude: Number.isFinite(m.amplitude) ? m.amplitude : 0,
      cycles: Number.isFinite(m.cycles) && m.cycles > 0 ? m.cycles : 0.5,
      phase: Number.isFinite(m.phase) ? m.phase : 0,
    }));
  }
  const sagFactor = Number.isFinite(physics.defaultSagFactor) ? physics.defaultSagFactor : 0.12;
  const gravityStrength = Number.isFinite(physics.gravityStrength) ? physics.gravityStrength : 1;
  const autoSag = span * sagFactor * gravityStrength;
  let sag;
  if (Number.isFinite(spec.sag)) {
    sag = spec.sag;
  } else if (Number.isFinite(spec.relativeSag)) {
    sag = spec.relativeSag * span;
  } else {
    sag = autoSag;
  }
  const wavelengths = Number.isFinite(spec.wavelengths) ? spec.wavelengths : 0.5;
  return [{ amplitude: sag, cycles: wavelengths, phase: 0 }];
}

function evaluateModesSum(t, modes) {
  let v = 0;
  for (const m of modes) v += m.amplitude * Math.sin(t * Math.PI * m.cycles * 2 + m.phase);
  return v;
}

function resolveRadius(t, radiusSpec) {
  if (typeof radiusSpec === 'number') return Math.max(0, radiusSpec);
  if (!Array.isArray(radiusSpec) || radiusSpec.length === 0) return 0;
  const sorted = [...radiusSpec].sort((a, b) => a.t - b.t);
  if (t <= sorted[0].t) return Math.max(0, sorted[0].r);
  if (t >= sorted[sorted.length - 1].t) return Math.max(0, sorted[sorted.length - 1].r);
  for (let i = 0; i + 1 < sorted.length; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (t >= a.t && t <= b.t) {
      const u = (t - a.t) / Math.max(b.t - a.t, 1e-9);
      return Math.max(0, a.r * (1 - u) + b.r * u);
    }
  }
  return 0;
}

/**
 * Compute centerline arc length numerically via the centerline samples
 * already used by the renderer. Quadrature, not relaxation — finite
 * samples, deterministic, respects the substrate's "no iterative
 * solver" rule. Used by Phase 3's `lengthMode: 'preserve'` validator.
 */
export function arcLengthOfLineBetween(spec, physics = defaultPhysics()) {
  if (!spec || !spec.from || !spec.to) {
    throw new Error('arcLengthOfLineBetween: spec.from and spec.to are required');
  }
  const { centerline } = sampleCenterline(spec, physics);
  let length = 0;
  for (let i = 0; i + 1 < centerline.length; i++) {
    length += len3(sub3(centerline[i + 1], centerline[i]));
  }
  return length;
}

function resolveDisplacementDirection(from, to, gravity, planeOverride) {
  if (planeOverride && Number.isFinite(planeOverride.x) && Number.isFinite(planeOverride.y) && Number.isFinite(planeOverride.z)) {
    return normalize3(planeOverride);
  }
  const segDir = normalize3(sub3(to, from));
  const along = dot3(gravity, segDir);
  const perp = sub3(gravity, scale3(segDir, along));
  if (len3(perp) > 1e-6) return normalize3(perp);
  // Segment is colinear with gravity — pick a stable arbitrary
  // perpendicular so the wave still has a plane to live in.
  const ref = Math.abs(segDir.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  return normalize3(cross3(segDir, ref));
}

// ─── 3D vector helpers (internal) ─────────────────────────────────────

function add3(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function sub3(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function scale3(a, k) { return { x: a.x * k, y: a.y * k, z: a.z * k }; }
function len3(a) { return Math.hypot(a.x, a.y, a.z); }
function dot3(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross3(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
function normalize3(v) {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 1e-12) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}
