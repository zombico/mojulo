/**
 * Cross-primitive scalar fields.
 *
 * A field is a named, enumerable description of "a scalar that varies
 * with position." Manifests declare fields in `manifest.fields = { <id>:
 * <decl> }`; primitive parameters that accept field references
 * (`{ field: '<id>' }`) get evaluated at the primitive's natural sample
 * point (the singularity for wave-manji, the midpoint for connection,
 * etc.) and the resulting scalar feeds the script as if it had been a
 * literal constant.
 *
 * This module is the substrate piece that lets primitives stop being
 * parallel and start being coupled — the v1 commits to scalar fields
 * only (no vector / multi-channel), no graph evaluation (fields are
 * pure geometry, not references to other primitives' output), and a
 * closed enumerable kind set ({ constant, radial, gradient }).
 *
 * Design rationale + roadmap in
 * lite-template/integration/0605/cross-primitive-fields.plan.md.
 */

import { buildEndpointResolver } from './line-between.js';

export const FIELD_KINDS = Object.freeze(['constant', 'radial', 'gradient', 'wave-surface', 'noise', 'sum', 'curve-projection', 'curve-distance', 'terrain-region']);

// Field kinds whose evaluators return a 3D vector ({x,y,z}) rather
// than a scalar. Consumers must either know to handle the vector form
// directly (none today) or extract a named component via the
// `component` parameter on the field reference.
export const VECTOR_FIELD_KINDS = Object.freeze(['curve-projection']);

export function isVectorFieldKind(kind) {
  return VECTOR_FIELD_KINDS.includes(kind);
}

/**
 * Resolve a position-spec into a 3D point. Position-specs accept either
 * an endpoint path string (resolved through the same `buildEndpointResolver`
 * connections and wave-fields use) or an inline `{x,y,z}` literal.
 *
 * `selfId` is forwarded to the endpoint resolver so `self/...` paths
 * inside field declarations resolve against the enclosing manji node
 * (mirrors the leaf-mark path-resolution model). Most field
 * declarations live at the manifest top level where `self` doesn't
 * make sense — pass `null` and the resolver will throw if a `self/...`
 * path slips through.
 */
function resolvePosition(spec, resolveEndpoint, selfId, label) {
  if (typeof spec === 'string') {
    return resolveEndpoint(spec, selfId);
  }
  if (spec && Number.isFinite(spec.x) && Number.isFinite(spec.y) && Number.isFinite(spec.z)) {
    return spec;
  }
  throw new Error(`${label}: must be an endpoint path string or {x,y,z}`);
}

/**
 * Validate a `fields` declaration object against a walker's emitted
 * node list. Returns a flat array of error strings (empty when valid).
 *
 * Intended to run at mint time so bad field declarations surface as
 * 400s, not 500s at render time. Validates:
 *   - Each entry has a `kind` ∈ FIELD_KINDS.
 *   - Numeric fields are finite.
 *   - `beyond` ∈ { clamp, extrapolate }.
 *   - Endpoint-path positions resolve through the emitted-node table.
 */
export function validateFields(fields, emittedNodes) {
  const errors = [];
  if (fields === undefined || fields === null) return errors;
  if (typeof fields !== 'object' || Array.isArray(fields)) {
    errors.push('`fields` must be an object keyed by field id');
    return errors;
  }
  const resolveEndpoint = buildEndpointResolver(emittedNodes);
  for (const [id, decl] of Object.entries(fields)) {
    const here = `fields['${id}']`;
    if (!decl || typeof decl !== 'object' || Array.isArray(decl)) {
      errors.push(`${here}: must be an object declaration`);
      continue;
    }
    if (!FIELD_KINDS.includes(decl.kind)) {
      errors.push(`${here}.kind: must be one of ${FIELD_KINDS.join(', ')}; got ${JSON.stringify(decl.kind)}`);
      continue;
    }
    if (decl.kind === 'constant') {
      if (!Number.isFinite(decl.value)) {
        errors.push(`${here}.value: must be a finite number for kind='constant'`);
      }
    } else if (decl.kind === 'radial') {
      try {
        resolvePosition(decl.center, resolveEndpoint, null, `${here}.center`);
      } catch (err) {
        errors.push(err.message);
      }
      for (const key of ['innerRadius', 'innerValue', 'outerRadius', 'outerValue']) {
        if (!Number.isFinite(decl[key])) {
          errors.push(`${here}.${key}: must be a finite number for kind='radial'`);
        }
      }
      if (Number.isFinite(decl.innerRadius) && Number.isFinite(decl.outerRadius)
          && decl.outerRadius <= decl.innerRadius) {
        errors.push(`${here}: outerRadius must be greater than innerRadius`);
      }
      if (decl.beyond !== undefined && decl.beyond !== 'clamp' && decl.beyond !== 'extrapolate') {
        errors.push(`${here}.beyond: must be 'clamp' or 'extrapolate' when provided`);
      }
    } else if (decl.kind === 'gradient') {
      try {
        resolvePosition(decl.from, resolveEndpoint, null, `${here}.from`);
      } catch (err) {
        errors.push(err.message);
      }
      try {
        resolvePosition(decl.to, resolveEndpoint, null, `${here}.to`);
      } catch (err) {
        errors.push(err.message);
      }
      for (const key of ['fromValue', 'toValue']) {
        if (!Number.isFinite(decl[key])) {
          errors.push(`${here}.${key}: must be a finite number for kind='gradient'`);
        }
      }
      if (decl.beyond !== undefined && decl.beyond !== 'clamp' && decl.beyond !== 'extrapolate') {
        errors.push(`${here}.beyond: must be 'clamp' or 'extrapolate' when provided`);
      }
    } else if (decl.kind === 'wave-surface') {
      // Mirrors the wave-field primitive's authoring contract: 4 corners
      // CCW from (u=0,v=0), summed wave components, optional displacement
      // direction (default +z = world up). The compiled field evaluates
      // to "world axis projection of the surface point at the query's
      // projected (u, v)" — for the common horizontal-quad / up-z case,
      // that's the world z of the wavy terrain at (query.x, query.y).
      if (!Array.isArray(decl.corners) || decl.corners.length !== 4) {
        errors.push(`${here}.corners: must be a 4-element array of endpoint paths or {x,y,z} points (CCW from u=0,v=0)`);
      } else {
        decl.corners.forEach((c, j) => {
          try {
            resolvePosition(c, resolveEndpoint, null, `${here}.corners[${j}]`);
          } catch (err) {
            errors.push(err.message);
          }
        });
      }
      if (decl.waves !== undefined && !Array.isArray(decl.waves)) {
        errors.push(`${here}.waves: must be an array when provided`);
      } else if (Array.isArray(decl.waves)) {
        decl.waves.forEach((w, j) => {
          if (!w || typeof w !== 'object') {
            errors.push(`${here}.waves[${j}]: must be an object { amplitude, cycles, phase? }`);
            return;
          }
          if (!Number.isFinite(w.amplitude)) {
            errors.push(`${here}.waves[${j}].amplitude: must be a finite number`);
          }
          const cu = w.cycles?.u;
          const cv = w.cycles?.v;
          if (cu !== undefined && !Number.isFinite(cu)) {
            errors.push(`${here}.waves[${j}].cycles.u: must be a finite number when provided`);
          }
          if (cv !== undefined && !Number.isFinite(cv)) {
            errors.push(`${here}.waves[${j}].cycles.v: must be a finite number when provided`);
          }
          if (w.phase !== undefined && !Number.isFinite(w.phase)) {
            errors.push(`${here}.waves[${j}].phase: must be a finite number when provided`);
          }
        });
      }
      if (decl.displacement !== undefined) {
        const d = decl.displacement;
        if (!d || !Number.isFinite(d.x) || !Number.isFinite(d.y) || !Number.isFinite(d.z)) {
          errors.push(`${here}.displacement: must be a finite {x,y,z} vector when provided`);
        }
      }
    } else if (decl.kind === 'noise') {
      // Numeric params have explicit defaults so the only validation
      // is that explicit overrides are finite.
      if (decl.seed !== undefined
          && typeof decl.seed !== 'string'
          && !Number.isFinite(decl.seed)) {
        errors.push(`${here}.seed: must be a string or finite number when provided`);
      }
      for (const key of ['scale', 'amplitude', 'offset', 'persistence']) {
        if (decl[key] !== undefined && !Number.isFinite(decl[key])) {
          errors.push(`${here}.${key}: must be a finite number when provided`);
        }
      }
      if (decl.octaves !== undefined) {
        if (!Number.isInteger(decl.octaves) || decl.octaves < 1 || decl.octaves > 12) {
          errors.push(`${here}.octaves: must be an integer in [1, 12] when provided`);
        }
      }
    } else if (decl.kind === 'sum') {
      if (!Array.isArray(decl.components) || decl.components.length === 0) {
        errors.push(`${here}.components: must be a non-empty array of { field, weight? } entries`);
      } else {
        decl.components.forEach((c, j) => {
          if (!c || typeof c !== 'object') {
            errors.push(`${here}.components[${j}]: must be an object`);
            return;
          }
          if (typeof c.field !== 'string' || c.field.length === 0) {
            errors.push(`${here}.components[${j}].field: must be a non-empty string field id`);
          } else if (!Object.hasOwn(fields, c.field)) {
            const available = Object.keys(fields).filter((k) => k !== id).join(', ') || '<none>';
            errors.push(`${here}.components[${j}].field: unknown field '${c.field}' (available: ${available})`);
          }
          if (c.weight !== undefined && !Number.isFinite(c.weight)) {
            errors.push(`${here}.components[${j}].weight: must be a finite number when provided`);
          }
        });
      }
      if (decl.offset !== undefined && !Number.isFinite(decl.offset)) {
        errors.push(`${here}.offset: must be a finite number when provided`);
      }
    } else if (decl.kind === 'curve-projection') {
      if (!Array.isArray(decl.waypoints) || decl.waypoints.length < 2) {
        errors.push(`${here}.waypoints: must be an array of at least 2 {x,y,z} points`);
      } else {
        decl.waypoints.forEach((w, j) => {
          if (!w || !Number.isFinite(w.x) || !Number.isFinite(w.y) || !Number.isFinite(w.z)) {
            errors.push(`${here}.waypoints[${j}]: must be a finite {x,y,z} point`);
          }
        });
      }
    } else if (decl.kind === 'curve-distance') {
      if (!Array.isArray(decl.waypoints) || decl.waypoints.length < 2) {
        errors.push(`${here}.waypoints: must be an array of at least 2 {x,y,z} points`);
      } else {
        decl.waypoints.forEach((w, j) => {
          if (!w || !Number.isFinite(w.x) || !Number.isFinite(w.y) || !Number.isFinite(w.z)) {
            errors.push(`${here}.waypoints[${j}]: must be a finite {x,y,z} point`);
          }
        });
      }
    } else if (decl.kind === 'terrain-region') {
      // A grounded landform bump/dip carrying its own waveform. The
      // window falloff reaches 0 at `radius`, so the field is compactly
      // supported — summing regions stays continuous (no seam fold-ups).
      try {
        resolvePosition(decl.center, resolveEndpoint, null, `${here}.center`);
      } catch (err) {
        errors.push(err.message);
      }
      if (!Number.isFinite(decl.radius) || decl.radius <= 0) {
        errors.push(`${here}.radius: must be a positive finite number for kind='terrain-region'`);
      }
      if (decl.peak !== undefined && !Number.isFinite(decl.peak)) {
        errors.push(`${here}.peak: must be a finite number when provided`);
      }
      if (decl.falloff !== undefined && decl.falloff !== 'smooth' && decl.falloff !== 'linear') {
        errors.push(`${here}.falloff: must be 'smooth' or 'linear' when provided`);
      }
      if (decl.waves !== undefined && !Array.isArray(decl.waves)) {
        errors.push(`${here}.waves: must be an array when provided`);
      } else if (Array.isArray(decl.waves)) {
        decl.waves.forEach((w, j) => {
          if (!w || typeof w !== 'object') {
            errors.push(`${here}.waves[${j}]: must be an object { amplitude, cycles, phase? }`);
            return;
          }
          if (!Number.isFinite(w.amplitude)) {
            errors.push(`${here}.waves[${j}].amplitude: must be a finite number`);
          }
          if (w.cycles?.u !== undefined && !Number.isFinite(w.cycles.u)) {
            errors.push(`${here}.waves[${j}].cycles.u: must be a finite number when provided`);
          }
          if (w.cycles?.v !== undefined && !Number.isFinite(w.cycles.v)) {
            errors.push(`${here}.waves[${j}].cycles.v: must be a finite number when provided`);
          }
          if (w.phase !== undefined && !Number.isFinite(w.phase)) {
            errors.push(`${here}.waves[${j}].phase: must be a finite number when provided`);
          }
        });
      }
    }
  }
  // Cross-field cycle check for sum fields. A `sum` whose components
  // eventually point back to itself would loop forever at evaluation.
  // Run AFTER per-field shape validation so we only descend into
  // structurally-valid `sum` declarations.
  for (const [id, decl] of Object.entries(fields)) {
    if (!decl || decl.kind !== 'sum') continue;
    const cyclePath = findFieldCycle(id, fields);
    if (cyclePath) {
      errors.push(`fields['${id}']: cycle detected through sum field — ${cyclePath.join(' → ')}`);
    }
  }
  return errors;
}

function findFieldCycle(startId, fields) {
  const stack = [];
  const onStack = new Set();
  function visit(id) {
    if (onStack.has(id)) {
      // Trim stack to the cycle's start.
      const cycleStart = stack.indexOf(id);
      return [...stack.slice(cycleStart), id];
    }
    const decl = fields[id];
    if (!decl || decl.kind !== 'sum') return null;
    onStack.add(id);
    stack.push(id);
    for (const c of decl.components || []) {
      if (!c || typeof c.field !== 'string') continue;
      const found = visit(c.field);
      if (found) return found;
    }
    onStack.delete(id);
    stack.pop();
    return null;
  }
  return visit(startId);
}

/**
 * Build a resolver that answers field ids with a `(position) => number`
 * evaluator function. Positions in field declarations are resolved
 * eagerly here (one pass over the emitted-node table) so per-evaluation
 * calls stay arithmetic-only.
 *
 * The returned resolver throws on unknown field ids with a clear
 * "unknown field 'foo' (available: ...)" message — same shape as the
 * slot-not-found and endpoint-path errors elsewhere in the substrate.
 */
export function buildFieldResolver(fields, emittedNodes) {
  const compiled = new Map();
  if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
    const resolveEndpoint = buildEndpointResolver(emittedNodes);
    // Compile non-`sum` fields first so they're available as
    // dependencies when sum fields compile. The validator's
    // cycle-check guarantees no sum field depends on itself
    // (directly or transitively), but sum fields CAN depend on
    // other sum fields — those resolve via the live `compiled` map.
    for (const [id, decl] of Object.entries(fields)) {
      if (decl?.kind === 'sum') continue;
      compiled.set(id, compileField(decl, resolveEndpoint));
    }
    // Now compile sum fields. The lookup function returns the
    // already-compiled evaluator for non-sum fields, or recursively
    // compiles other sum fields on demand (memoized in `compiled`).
    function lookupComponent(id) {
      if (compiled.has(id)) return compiled.get(id);
      const decl = fields[id];
      if (!decl) {
        throw new Error(`sum field references unknown field '${id}'`);
      }
      const evaluator = compileSumField(decl, lookupComponent);
      compiled.set(id, evaluator);
      return evaluator;
    }
    for (const [id, decl] of Object.entries(fields)) {
      if (decl?.kind !== 'sum') continue;
      if (compiled.has(id)) continue;
      compiled.set(id, compileSumField(decl, lookupComponent));
    }
  }
  return function resolveField(ref) {
    if (typeof ref !== 'string') {
      throw new Error(`field reference must be a string id; got: ${JSON.stringify(ref)}`);
    }
    const evaluator = compiled.get(ref);
    if (!evaluator) {
      const available = [...compiled.keys()].join(', ') || '<none>';
      throw new Error(`unknown field '${ref}' (available: ${available})`);
    }
    return evaluator;
  };
}

function compileSumField(decl, lookupComponent) {
  const components = (decl.components || []).map((c) => ({
    weight: Number.isFinite(c?.weight) ? c.weight : 1,
    evaluator: lookupComponent(c.field),
  }));
  const offset = Number.isFinite(decl?.offset) ? decl.offset : 0;
  return function sumField(position) {
    let total = offset;
    for (const { weight, evaluator } of components) {
      total += weight * evaluator(position);
    }
    return total;
  };
}

// Compile a single field declaration into a `(position) => number`
// evaluator. Exposed only for the lazy-resolver use case (where
// compilation defers to per-call); the eager `buildFieldResolver` is
// the normal entry point.
function compileField(decl, resolveEndpoint) {
  if (decl.kind === 'constant') {
    const value = decl.value;
    return function constantField() { return value; };
  }
  if (decl.kind === 'radial') {
    const center = resolvePosition(decl.center, resolveEndpoint, null, 'fields.center');
    const innerR = decl.innerRadius;
    const outerR = decl.outerRadius;
    const innerV = decl.innerValue;
    const outerV = decl.outerValue;
    const beyond = decl.beyond || 'clamp';
    const denom = outerR - innerR;
    return function radialField(position) {
      const dx = position.x - center.x;
      const dy = position.y - center.y;
      const dz = position.z - center.z;
      const r = Math.hypot(dx, dy, dz);
      if (r <= innerR) return innerV;
      if (r >= outerR) {
        return beyond === 'extrapolate'
          ? outerV + ((r - outerR) / denom) * (outerV - innerV)
          : outerV;
      }
      const t = (r - innerR) / denom;
      return innerV + t * (outerV - innerV);
    };
  }
  if (decl.kind === 'gradient') {
    const from = resolvePosition(decl.from, resolveEndpoint, null, 'fields.from');
    const to = resolvePosition(decl.to, resolveEndpoint, null, 'fields.to');
    const fromV = decl.fromValue;
    const toV = decl.toValue;
    const beyond = decl.beyond || 'clamp';
    const dirX = to.x - from.x;
    const dirY = to.y - from.y;
    const dirZ = to.z - from.z;
    const lenSq = dirX * dirX + dirY * dirY + dirZ * dirZ;
    if (lenSq < 1e-24) {
      // Degenerate gradient — from === to. Return fromValue everywhere.
      return function degenerateGradient() { return fromV; };
    }
    return function gradientField(position) {
      const px = position.x - from.x;
      const py = position.y - from.y;
      const pz = position.z - from.z;
      const t = (px * dirX + py * dirY + pz * dirZ) / lenSq;
      if (t <= 0) {
        return beyond === 'extrapolate' ? fromV + t * (toV - fromV) : fromV;
      }
      if (t >= 1) {
        return beyond === 'extrapolate' ? fromV + t * (toV - fromV) : toV;
      }
      return fromV + t * (toV - fromV);
    };
  }
  if (decl.kind === 'wave-surface') {
    // Resolve the 4 corners (CCW from u=0,v=0) — same convention as the
    // wave-field primitive's bilinear interpolation. Mirrors the math
    // in sampleWaveField so a wave-surface field declaration with the
    // same corners + waves as a wave-field primitive evaluates to the
    // same height the visible surface sits at.
    const C = decl.corners.map((c, j) =>
      resolvePosition(c, resolveEndpoint, null, `fields.corners[${j}]`));
    const [C0, C1, C2, C3] = C;
    const waves = Array.isArray(decl.waves) ? decl.waves : [];
    // displacement defaults to +z (world up): the natural "this surface
    // is horizontal terrain" case. Authors with non-up displacement
    // axes override explicitly.
    const dispRaw = decl.displacement && Number.isFinite(decl.displacement.x)
      ? decl.displacement
      : { x: 0, y: 0, z: 1 };
    const dispLen = Math.hypot(dispRaw.x, dispRaw.y, dispRaw.z);
    const disp = dispLen < 1e-12
      ? { x: 0, y: 0, z: 1 }
      : { x: dispRaw.x / dispLen, y: dispRaw.y / dispLen, z: dispRaw.z / dispLen };
    // For v1 we assume the quad is axis-aligned in the xy plane. The
    // inverse bilinear interpolation reduces to a simple rescale of
    // the query (x, y) into (u, v). Non-axis-aligned quads require
    // solving a quadratic and are deferred; the projection here will
    // still produce a reasonable approximation for slightly-tilted
    // quads, but the substrate is documented as axis-aligned-v1.
    const minX = Math.min(C0.x, C1.x, C2.x, C3.x);
    const maxX = Math.max(C0.x, C1.x, C2.x, C3.x);
    const minY = Math.min(C0.y, C1.y, C2.y, C3.y);
    const maxY = Math.max(C0.y, C1.y, C2.y, C3.y);
    const spanX = maxX - minX;
    const spanY = maxY - minY;
    return function waveSurfaceField(position) {
      // Project to (u, v) ∈ [0,1]² with clamping. The corner ordering
      // means u runs along C0→C1 (low X to high X for axis-aligned) and
      // v runs along C0→C3 (low Y to high Y).
      const u = spanX < 1e-12 ? 0 : clamp01((position.x - minX) / spanX);
      const v = spanY < 1e-12 ? 0 : clamp01((position.y - minY) / spanY);
      const w0 = (1 - u) * (1 - v);
      const w1 = u * (1 - v);
      const w2 = u * v;
      const w3 = (1 - u) * v;
      const baseX = w0 * C0.x + w1 * C1.x + w2 * C2.x + w3 * C3.x;
      const baseY = w0 * C0.y + w1 * C1.y + w2 * C2.y + w3 * C3.y;
      const baseZ = w0 * C0.z + w1 * C1.z + w2 * C2.z + w3 * C3.z;
      let h = 0;
      for (const wv of waves) {
        if (!wv || typeof wv !== 'object') continue;
        const amp = Number.isFinite(wv.amplitude) ? wv.amplitude : 0;
        if (amp === 0) continue;
        const cu = Number.isFinite(wv.cycles?.u) ? wv.cycles.u : 0;
        const cv = Number.isFinite(wv.cycles?.v) ? wv.cycles.v : 0;
        const phase = Number.isFinite(wv.phase) ? wv.phase : 0;
        h += amp * Math.sin(2 * Math.PI * (cu * u + cv * v) + phase);
      }
      // Return the world projection of the displaced surface point along
      // the displacement direction. For displacement = +z and a horizontal
      // quad at z=0, this is just `0 + h` = "world z of the surface at
      // (x, y)" — exactly what landscape authoring wants.
      return baseX * disp.x + baseY * disp.y + baseZ * disp.z + h;
    };
  }
  if (decl.kind === 'noise') {
    // Value noise + octave summing (fractional Brownian motion). The
    // query position's z is ignored — noise is a 2D scalar field over
    // the xy plane, the natural shape for terrain.
    const seedHash = hashSeedNoise(decl.seed);
    const scale = Number.isFinite(decl.scale) ? decl.scale : 0.2;
    const octaves = Number.isInteger(decl.octaves) ? Math.max(1, Math.min(12, decl.octaves)) : 4;
    const persistence = Number.isFinite(decl.persistence) ? decl.persistence : 0.5;
    const amplitude = Number.isFinite(decl.amplitude) ? decl.amplitude : 1;
    const offset = Number.isFinite(decl.offset) ? decl.offset : 0;
    return function noiseField(position) {
      let total = 0;
      let amp = 1;
      let freq = 1;
      let maxAmp = 0;
      for (let o = 0; o < octaves; o += 1) {
        total += valueNoise2D(position.x * scale * freq, position.y * scale * freq, seedHash + o) * amp;
        maxAmp += amp;
        amp *= persistence;
        freq *= 2;
      }
      const normalized = maxAmp > 0 ? total / maxAmp : 0;
      return amplitude * normalized + offset;
    };
  }
  if (decl.kind === 'curve-projection') {
    // Closest-point on a piecewise-linear polyline. Pre-cache per-
    // segment direction + length squared so per-query work is O(N)
    // segment dot products.
    const waypoints = decl.waypoints.map((w) => ({ x: w.x, y: w.y, z: w.z }));
    const segments = [];
    for (let i = 0; i + 1 < waypoints.length; i += 1) {
      const a = waypoints[i];
      const b = waypoints[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const lenSq = dx * dx + dy * dy + dz * dz;
      if (lenSq < 1e-24) continue;  // skip zero-length segments
      segments.push({ a, b, dx, dy, dz, lenSq });
    }
    if (segments.length === 0) {
      // Degenerate curve — all waypoints coincide. Return the single
      // point everywhere.
      const p = waypoints[0];
      return function degenerateCurve() { return { x: p.x, y: p.y, z: p.z }; };
    }
    return function curveProjectionField(position) {
      let bestPoint = null;
      let bestDistSq = Infinity;
      for (const seg of segments) {
        const px = position.x - seg.a.x;
        const py = position.y - seg.a.y;
        const pz = position.z - seg.a.z;
        let t = (px * seg.dx + py * seg.dy + pz * seg.dz) / seg.lenSq;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
        const projX = seg.a.x + t * seg.dx;
        const projY = seg.a.y + t * seg.dy;
        const projZ = seg.a.z + t * seg.dz;
        const ddx = position.x - projX;
        const ddy = position.y - projY;
        const ddz = position.z - projZ;
        const distSq = ddx * ddx + ddy * ddy + ddz * ddz;
        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          bestPoint = { x: projX, y: projY, z: projZ };
        }
      }
      return bestPoint;
    };
  }
  if (decl.kind === 'curve-distance') {
    // Scalar distance to a piecewise-linear polyline. Mirrors the
    // curve-projection precomputation; returns sqrt of the minimum
    // squared distance instead of the projected point. World-unit
    // distance (no normalization) — operators scale via sum-field
    // weights if they want a [0, 1] band.
    const waypoints = decl.waypoints.map((w) => ({ x: w.x, y: w.y, z: w.z }));
    const segments = [];
    for (let i = 0; i + 1 < waypoints.length; i += 1) {
      const a = waypoints[i];
      const b = waypoints[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const lenSq = dx * dx + dy * dy + dz * dz;
      if (lenSq < 1e-24) continue;  // skip zero-length segments
      segments.push({ a, b, dx, dy, dz, lenSq });
    }
    if (segments.length === 0) {
      // Degenerate curve — all waypoints coincide. Return the
      // distance from query to that single point.
      const p = waypoints[0];
      return function degenerateCurveDistance(position) {
        const dx = position.x - p.x;
        const dy = position.y - p.y;
        const dz = position.z - p.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
      };
    }
    return function curveDistanceField(position) {
      let bestDistSq = Infinity;
      for (const seg of segments) {
        const px = position.x - seg.a.x;
        const py = position.y - seg.a.y;
        const pz = position.z - seg.a.z;
        let t = (px * seg.dx + py * seg.dy + pz * seg.dz) / seg.lenSq;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
        const projX = seg.a.x + t * seg.dx;
        const projY = seg.a.y + t * seg.dy;
        const projZ = seg.a.z + t * seg.dz;
        const ddx = position.x - projX;
        const ddy = position.y - projY;
        const ddz = position.z - projZ;
        const distSq = ddx * ddx + ddy * ddy + ddz * ddz;
        if (distSq < bestDistSq) bestDistSq = distSq;
      }
      return Math.sqrt(bestDistSq);
    };
  }
  if (decl.kind === 'terrain-region') {
    // Grounded landform bump/dip carrying its own waveform. The window
    // w(r) is 1 at center, 0 at `radius` (smootherstep = C1, flat at both
    // ends so the join to baseline has no crease), and the field is 0
    // beyond radius. The window scales BOTH the landform peak and the
    // waveform, so ripples die at the border exactly like the landform —
    // this is the part the linear `sum` layer cannot express on its own.
    const center = resolvePosition(decl.center, resolveEndpoint, null, 'fields.center');
    const radius = decl.radius;
    const peak = Number.isFinite(decl.peak) ? decl.peak : 0;
    const waves = Array.isArray(decl.waves) ? decl.waves : [];
    const linear = decl.falloff === 'linear';
    return function terrainRegionField(position) {
      const dx = position.x - center.x;
      const dy = position.y - center.y;
      const r = Math.hypot(dx, dy);
      if (r >= radius) return 0;
      const t = r / radius;
      const w = linear ? (1 - t) : (1 - smootherstep(t));
      const u = (dx / radius + 1) / 2;
      const v = (dy / radius + 1) / 2;
      let tex = 0;
      for (const wv of waves) {
        if (!wv || typeof wv !== 'object') continue;
        const amp = Number.isFinite(wv.amplitude) ? wv.amplitude : 0;
        if (amp === 0) continue;
        const cu = Number.isFinite(wv.cycles?.u) ? wv.cycles.u : 0;
        const cv = Number.isFinite(wv.cycles?.v) ? wv.cycles.v : 0;
        const phase = Number.isFinite(wv.phase) ? wv.phase : 0;
        tex += amp * Math.sin(2 * Math.PI * (cu * u + cv * v) + phase);
      }
      return w * (peak + tex);
    };
  }
  // sum is compiled separately via compileSumField (it needs access to
  // the other compiled evaluators).
  // Defensive: validateFields should catch this before we get here.
  return function unknown() {
    throw new Error(`unknown field kind '${decl.kind}'`);
  };
}

// Quintic smootherstep (Ken Perlin) — 6t^5 − 15t^4 + 10t^3. Zero first
// derivative at both t=0 and t=1, so a window built from it joins the
// baseline flat (no crease / fold-up at a region border).
function smootherstep(t) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * x * (x * (x * 6 - 15) + 10);
}

// ─── value-noise helpers ──────────────────────────────────────────────

// FNV-1a-ish seed hash so string and number seeds map deterministically
// to a 32-bit base. Same hash convention used by wave-manji's PRNG.
function hashSeedNoise(seed) {
  if (Number.isFinite(seed)) return Math.floor(seed) | 0;
  const str = seed == null ? 'noise' : String(seed);
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

// Hash an (integer x, integer y, seed) triple to a deterministic value
// in [-1, 1]. Avalanche enough that adjacent cells decorrelate.
function hashCell(ix, iy, seed) {
  let n = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0;
  n = (n ^ (n >>> 13)) | 0;
  n = Math.imul(n, 1274126177) | 0;
  n = (n ^ (n >>> 16)) | 0;
  // Map signed-int range to [-1, 1].
  return n / 2147483648;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise2D(x, y, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smoothstep(x - ix);
  const fy = smoothstep(y - iy);
  const v00 = hashCell(ix,     iy,     seed);
  const v10 = hashCell(ix + 1, iy,     seed);
  const v01 = hashCell(ix,     iy + 1, seed);
  const v11 = hashCell(ix + 1, iy + 1, seed);
  const top = v00 + fx * (v10 - v00);
  const bot = v01 + fx * (v11 - v01);
  return top + fy * (bot - top);
}

function clamp01(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/**
 * Evaluate a parameter that may be a scalar number, a field reference
 * (`{ field: '<id>' }`), or undefined. Returns the resolved number, or
 * `defaultValue` when input is undefined/null.
 *
 * This is the substrate's "scalar OR field" union helper. Callers reach
 * for it wherever a primitive parameter has been widened to accept a
 * field ref — e.g. wave-manji's `bending`.
 */
export function evaluateScalarOrFieldRef(value, fieldResolver, position, defaultValue) {
  if (value === undefined || value === null) return defaultValue;
  if (Number.isFinite(value)) return value;
  if (value && typeof value === 'object' && typeof value.field === 'string') {
    if (!fieldResolver) {
      throw new Error(`scalar parameter is a field reference but no resolver is available`);
    }
    const evaluator = fieldResolver(value.field);
    const result = evaluator(position);
    // Vector fields return {x,y,z}. The scalar consumer extracts one
    // component via the optional `component` parameter on the ref.
    if (result && typeof result === 'object') {
      const component = value.component;
      if (component !== 'x' && component !== 'y' && component !== 'z') {
        throw new Error(
          `field '${value.field}' returned a vector; consumer must specify { component: 'x' | 'y' | 'z' }`,
        );
      }
      const v = result[component];
      if (!Number.isFinite(v)) {
        throw new Error(`field '${value.field}'.${component} is not a finite number`);
      }
      return v;
    }
    // Scalar field — `component` (if provided) is ignored.
    return result;
  }
  throw new Error(`scalar parameter must be a number or { field: '<id>' }; got: ${JSON.stringify(value)}`);
}

// No-op field resolver — used when a primitive is evaluated outside a
// manifest context (e.g. unit tests of `printWaveManji` directly). Any
// field reference reaching this resolver throws.
export function nullFieldResolver() {
  return function noFieldsAvailable(ref) {
    throw new Error(`unknown field '${ref}' (manifest declares no fields)`);
  };
}

/**
 * Build a field resolver whose endpoint-path positions are compiled
 * LAZILY, on each evaluation call, against whatever emitted-node view
 * `getEmittedNodes()` returns at that moment. Used by the walker for
 * walk-time structure-scalar resolution: by the time a deep node's
 * scale is being evaluated, earlier ancestors have already been
 * emitted and their slot positions are queryable.
 *
 * Tradeoff vs `buildFieldResolver`: each evaluation rebuilds the
 * endpoint resolver, which is O(emitted-count). Use the eager variant
 * when the emitted-node table is fixed at resolver-build time (the
 * wave-manji post-walk path), and the lazy variant when emitted nodes
 * accumulate during the resolution (the walker's pre-walk path).
 *
 * v1 limitation: a structure scalar at depth 0 (root) whose field
 * references the root's OWN slots can't be resolved — the root isn't
 * emitted yet when its own scale is being evaluated. Workarounds:
 * pass a const field, or move the root's scale to a child level.
 */
export function buildLazyFieldResolver(fields, getEmittedNodes) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return nullFieldResolver();
  }
  function resolveField(ref) {
    if (typeof ref !== 'string') {
      throw new Error(`field reference must be a string id; got: ${JSON.stringify(ref)}`);
    }
    if (!Object.hasOwn(fields, ref)) {
      const available = Object.keys(fields).join(', ') || '<none>';
      throw new Error(`unknown field '${ref}' (available: ${available})`);
    }
    const decl = fields[ref];
    // Constants, noise, and curve-* fields need no endpoint resolver
    // — short-circuit with the eager compiler.
    if (decl.kind === 'constant' || decl.kind === 'noise' || decl.kind === 'curve-projection' || decl.kind === 'curve-distance') {
      return compileField(decl, /* unused */ null);
    }
    // Sum fields compose other fields' evaluators. Resolve each
    // component through the same lazy resolver so the dependency
    // graph stays consistent with whatever ancestor nodes have been
    // emitted at evaluation time.
    if (decl.kind === 'sum') {
      return compileSumField(decl, resolveField);
    }
    return function lazyFieldEvaluator(position) {
      const resolveEndpoint = buildEndpointResolver(getEmittedNodes());
      const evaluator = compileField(decl, resolveEndpoint);
      return evaluator(position);
    };
  }
  return resolveField;
}
