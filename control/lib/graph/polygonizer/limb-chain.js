/**
 * limb-chain — forward-kinematic chain primitive for figures.
 *
 * A leaf mark that walks along an origin world-position via a fold-vector
 * and a sequence of {length, emit, bend?, bendAxis?} segments. Each segment
 * emits a named joint as a new slot on the enclosing manji, so downstream
 * consumers (lathes, connection tubes, adornments) can reference the
 * joints via `self/slot/<emit>` exactly like a hand-authored landmark.
 *
 * Bend convention: bend > 0 rotates the working fold-vector in the
 * right-hand direction around the bend axis BEFORE drawing the segment.
 * The default axis 'binormal' = cross(fold, world_forward) gives natural
 * sagittal-plane flexion when world_forward = +Y.
 *
 * Together with an X-shaped manji (4 named slots — shoulder-l/r,
 * hip-l/r — around a torso center), limb-chains express a figure pose
 * by 4 fold-vectors + chain specs instead of 23 hand-rigged landmarks.
 */

const DEFAULT_FORWARD = Object.freeze({ x: 0, y: 1, z: 0 });
const DEG_TO_RAD = Math.PI / 180;

// Cardinal axis labels resolve to world-aligned unit vectors. Lets segment
// rotations be specified grid-natively (e.g. "rotate the bicep 30° around
// E-W") rather than as raw `[x,y,z]` numerics. Matches the substrate's
// cardinal-grammar discipline.
const CARDINAL_AXIS_VECTORS = Object.freeze({
  'N-S':           { x: 0, y: 1, z: 0 },
  'E-W':           { x: 1, y: 0, z: 0 },
  'Zenith-Nadir':  { x: 0, y: 0, z: 1 },
});

export function isCardinalAxisLabel(s) {
  return typeof s === 'string' && Object.prototype.hasOwnProperty.call(CARDINAL_AXIS_VECTORS, s);
}

/**
 * Compose a `rotation: [{axis, angle}, ...]` list into a function that
 * applies the rotations sequentially to a vector. Cardinal axis labels
 * resolve to world-aligned unit vectors; explicit `[x,y,z]` vectors are
 * normalized. Used both inside the FK chain walker and at the manji-node
 * level (the X-manji center as a rotational hub).
 *
 * Returns null if the list is empty or has no non-zero rotations — so
 * callers can short-circuit identity-rotation cases.
 */
export function composeRotation(rotationList) {
  if (!Array.isArray(rotationList) || rotationList.length === 0) return null;
  const steps = [];
  for (const rot of rotationList) {
    if (!rot || !Number.isFinite(rot.angle) || rot.angle === 0) continue;
    const axisSpec = rot.axis;
    let axis;
    if (typeof axisSpec === 'string' && CARDINAL_AXIS_VECTORS[axisSpec]) {
      axis = CARDINAL_AXIS_VECTORS[axisSpec];
    } else if (axisSpec === undefined || axisSpec === 'binormal') {
      // 'binormal' is only meaningful inside the chain walker (where it
      // depends on the running fold). At the node-rotation level it's
      // treated as world-X for stability.
      axis = { x: 1, y: 0, z: 0 };
    } else {
      axis = normalizeVec(asVec(axisSpec));
    }
    steps.push({ axis, theta: rot.angle * DEG_TO_RAD });
  }
  if (steps.length === 0) return null;
  return function applyComposedRotation(v) {
    let r = { x: v.x, y: v.y, z: v.z };
    for (const s of steps) r = rotateAroundAxis(r, s.axis, s.theta);
    return r;
  };
}

/**
 * Apply a composed rotation to a point around a pivot in the same frame.
 * If `rotationFn` is null, the point is returned unchanged.
 */
export function rotateAroundPivot(rotationFn, point, pivot) {
  if (!rotationFn) return point;
  const rel = { x: point.x - pivot.x, y: point.y - pivot.y, z: point.z - pivot.z };
  const rot = rotationFn(rel);
  return { x: rot.x + pivot.x, y: rot.y + pivot.y, z: rot.z + pivot.z };
}

/**
 * Walk a limb-chain by forward kinematics from an origin in world space.
 *
 * Returns an ordered array of `{ id, worldPosition: {x,y,z} }` joints —
 * one per segment that has an `emit` field. Caller resolves the spec's
 * `origin` endpoint path itself; this function consumes the resolved
 * world point.
 */
export function walkLimbChain(spec, originWorld, options = {}) {
  if (!spec) throw new Error('walkLimbChain: spec required');
  const origin = ensurePoint(originWorld);
  const initialFold = normalizeVec(asVec(spec.fold));
  const segments = Array.isArray(spec.segments) ? spec.segments : [];
  const worldForward = options.worldForward || DEFAULT_FORWARD;
  const emitted = [];
  let p = origin;
  let f = initialFold;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    // Precedence:
    //   1. `direction` (explicit world-vector) — fold is overwritten
    //   2. `rotations: [{axis, angle}, ...]` — composed in order
    //   3. `bend` + `bendAxis` (legacy single-rotation) — treated as one
    //      rotation entry
    if (seg.direction !== undefined) {
      f = normalizeVec(asVec(seg.direction));
    } else {
      const rotList = collectRotations(seg);
      for (const rot of rotList) {
        if (!Number.isFinite(rot.angle) || rot.angle === 0) continue;
        const axis = resolveRotationAxis(rot.axis, f, worldForward);
        f = rotateAroundAxis(f, axis, rot.angle * DEG_TO_RAD);
      }
    }
    const len = Number.isFinite(seg.length) && seg.length > 0 ? seg.length : 0;
    p = { x: p.x + f.x * len, y: p.y + f.y * len, z: p.z + f.z * len };
    if (typeof seg.emit === 'string' && seg.emit.length > 0) {
      emitted.push({ id: seg.emit, worldPosition: { x: p.x, y: p.y, z: p.z } });
    }
  }
  return emitted;
}

function collectRotations(seg) {
  if (Array.isArray(seg.rotations) && seg.rotations.length > 0) return seg.rotations;
  if (Number.isFinite(seg.bend) && seg.bend !== 0) {
    let axis = seg.bendAxis;
    // Hinge segments default the bend axis to their declared hingeAxis
    // (or 'binormal' if none specified). This is what makes
    // `{hinge: true, bend: 90}` always flex correctly — the substrate
    // resolves the axis from the joint type, not from per-call author
    // discretion.
    if (axis === undefined && seg.hinge === true) {
      axis = seg.hingeAxis !== undefined ? seg.hingeAxis : 'binormal';
    }
    return [{ axis, angle: seg.bend }];
  }
  return [];
}

/**
 * Validate a limb-chain spec shape (without resolving its origin endpoint).
 * Returns an array of error strings (empty when valid).
 */
export function validateLimbChainSpec(spec, where) {
  const errors = [];
  if (!spec || typeof spec !== 'object') {
    errors.push(`${where}: limb-chain spec must be an object`);
    return errors;
  }
  if (typeof spec.origin !== 'string' || !spec.origin) {
    errors.push(`${where}.origin: must be a string endpoint path`);
  }
  if (spec.fold === undefined) {
    errors.push(`${where}.fold: required (unit vector for the chain's starting direction)`);
  } else {
    const f = asVec(spec.fold);
    if (!Number.isFinite(f.x) || !Number.isFinite(f.y) || !Number.isFinite(f.z)) {
      errors.push(`${where}.fold: must be [x,y,z] or {x,y,z} with finite numbers`);
    }
  }
  if (!Array.isArray(spec.segments) || spec.segments.length === 0) {
    errors.push(`${where}.segments: required (non-empty array of { length, emit, bend?, bendAxis? })`);
  } else {
    spec.segments.forEach((s, i) => {
      if (!s || typeof s !== 'object') {
        errors.push(`${where}.segments[${i}]: must be an object`);
        return;
      }
      if (!Number.isFinite(s.length) || s.length <= 0) {
        errors.push(`${where}.segments[${i}].length: must be a positive finite number`);
      }
      if (typeof s.emit !== 'string' || !s.emit) {
        errors.push(`${where}.segments[${i}].emit: must be a string slot id`);
      }
      if (s.direction !== undefined) {
        const d = asVec(s.direction);
        const m = Math.hypot(d.x, d.y, d.z);
        if (!Number.isFinite(m) || m < 1e-9) {
          errors.push(`${where}.segments[${i}].direction: must be a non-zero [x,y,z] vector if provided`);
        }
      }
      if (s.rotations !== undefined) {
        if (!Array.isArray(s.rotations)) {
          errors.push(`${where}.segments[${i}].rotations: must be an array of { axis, angle } if provided`);
        } else {
          s.rotations.forEach((r, j) => {
            if (!r || typeof r !== 'object') {
              errors.push(`${where}.segments[${i}].rotations[${j}]: must be an object { axis, angle }`);
              return;
            }
            if (!Number.isFinite(r.angle)) {
              errors.push(`${where}.segments[${i}].rotations[${j}].angle: must be a finite number (degrees)`);
            }
            if (r.axis !== undefined && !isCardinalAxisLabel(r.axis) && r.axis !== 'binormal') {
              if (typeof r.axis === 'string') {
                errors.push(`${where}.segments[${i}].rotations[${j}].axis: unknown label '${r.axis}' (must be 'N-S' | 'E-W' | 'Zenith-Nadir' | 'binormal' or a [x,y,z] vector)`);
              } else {
                const a = asVec(r.axis);
                const m = Math.hypot(a.x, a.y, a.z);
                if (!Number.isFinite(m) || m < 1e-9) {
                  errors.push(`${where}.segments[${i}].rotations[${j}].axis: must be a cardinal label, 'binormal', or a non-zero [x,y,z] vector`);
                }
              }
            }
          });
        }
      }
      if (s.bend !== undefined && !Number.isFinite(s.bend)) {
        errors.push(`${where}.segments[${i}].bend: must be a finite number (degrees) if provided`);
      }
      if (s.bendAxis !== undefined && !isCardinalAxisLabel(s.bendAxis) && s.bendAxis !== 'binormal') {
        const a = asVec(s.bendAxis);
        const m = Math.hypot(a.x, a.y, a.z);
        if (!Number.isFinite(m) || m < 1e-9) {
          errors.push(`${where}.segments[${i}].bendAxis: must be a cardinal label, 'binormal', or a non-zero vector if provided`);
        }
      }
      // Hinge constraint — elbow/knee/ankle-flex joints. 1-DOF rotation
      // around a declared axis (default 'binormal' = perpendicular to
      // running fold + world-forward, gives anatomical flexion). The
      // validator enforces that hinge segments can't be authored with
      // multi-axis rotations — that's the safety net against
      // disfiguration the substrate's joint-locking promise relies on.
      if (s.hinge !== undefined && typeof s.hinge !== 'boolean') {
        errors.push(`${where}.segments[${i}].hinge: must be a boolean if provided`);
      }
      if (s.hingeAxis !== undefined && !isCardinalAxisLabel(s.hingeAxis) && s.hingeAxis !== 'binormal') {
        if (typeof s.hingeAxis === 'string') {
          errors.push(`${where}.segments[${i}].hingeAxis: unknown label '${s.hingeAxis}' (must be 'binormal' | 'N-S' | 'E-W' | 'Zenith-Nadir' | [x,y,z])`);
        } else {
          const a = asVec(s.hingeAxis);
          const m = Math.hypot(a.x, a.y, a.z);
          if (!Number.isFinite(m) || m < 1e-9) {
            errors.push(`${where}.segments[${i}].hingeAxis: must be a non-zero [x,y,z] vector`);
          }
        }
      }
      if (s.hinge === true) {
        const hasBend = Number.isFinite(s.bend);
        const rotCount = Array.isArray(s.rotations) ? s.rotations.length : 0;
        if (hasBend && rotCount > 0) {
          errors.push(`${where}.segments[${i}]: hinge segment uses either bend OR rotations, not both`);
        }
        if (rotCount > 1) {
          errors.push(`${where}.segments[${i}]: hinge segment can have at most one rotation entry (got ${rotCount})`);
        }
        if (rotCount === 1 && s.hingeAxis !== undefined) {
          const rotAxis = s.rotations[0].axis;
          if (typeof rotAxis === 'string' && typeof s.hingeAxis === 'string' && rotAxis !== s.hingeAxis) {
            errors.push(`${where}.segments[${i}]: hinge axis is '${s.hingeAxis}' but rotations[0].axis is '${rotAxis}'`);
          }
        }
      }
    });
  }
  return errors;
}

function asVec(v) {
  if (Array.isArray(v)) return { x: Number(v[0]) || 0, y: Number(v[1]) || 0, z: Number(v[2]) || 0 };
  if (v && typeof v === 'object') return { x: Number(v.x) || 0, y: Number(v.y) || 0, z: Number(v.z) || 0 };
  return { x: 0, y: 0, z: -1 };
}

function ensurePoint(p) {
  if (!p || typeof p !== 'object') throw new Error('walkLimbChain: originWorld must be {x,y,z}');
  return { x: Number(p.x) || 0, y: Number(p.y) || 0, z: Number(p.z) || 0 };
}

function normalizeVec(v) {
  const m = Math.hypot(v.x, v.y, v.z);
  if (m < 1e-9) return { x: 0, y: 0, z: -1 };
  return { x: v.x / m, y: v.y / m, z: v.z / m };
}

function resolveRotationAxis(axisSpec, fold, worldForward) {
  if (typeof axisSpec === 'string' && CARDINAL_AXIS_VECTORS[axisSpec]) {
    return CARDINAL_AXIS_VECTORS[axisSpec];
  }
  if (axisSpec === undefined || axisSpec === 'binormal') {
    const b = crossVec(fold, worldForward);
    if (Math.hypot(b.x, b.y, b.z) < 1e-6) return { x: 1, y: 0, z: 0 };
    return normalizeVec(b);
  }
  return normalizeVec(asVec(axisSpec));
}

function crossVec(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function rotateAroundAxis(v, k, theta) {
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const kxv = crossVec(k, v);
  const kdv = k.x * v.x + k.y * v.y + k.z * v.z;
  return {
    x: v.x * cosT + kxv.x * sinT + k.x * kdv * (1 - cosT),
    y: v.y * cosT + kxv.y * sinT + k.y * kdv * (1 - cosT),
    z: v.z * cosT + kxv.z * sinT + k.z * kdv * (1 - cosT),
  };
}
