/**
 * wave-manji — closed-loop printer winding around a central singularity.
 *
 * Third primitive on the polygonizer substrate, sibling to line-between
 * (1D open) and wave-field (2D open). Wave manji are 1D *closed* —
 * loops with periodic boundary conditions, anchored to a singularity
 * point rather than to two endpoints.
 *
 * Where line-between samples a deterministic curve between two pins and
 * wave-field samples a height grid over four pins, wave-manji *prints*:
 * a script runs, modulating per-pass parameters and emitting a polyline
 * each pass, until the script declares itself done. The act of running
 * the script is the act of forming the wave.
 *
 * Six knobs on the spec:
 *   - singularity   — center of orbit (3D point; resolved by the caller)
 *   - bending       — benevolent-attractor intensity (script-tuned default)
 *   - plane         — loop's plane normal (default = scene gravity)
 *   - script        — modulation archetype name (ouroboros, mandala, ...)
 *   - seed          — deterministic input to stochastic perturbation
 *   - density       — script-dependent halt parameter
 *
 * Output: { polylines: Point3D[][] } — one or more polylines sharing the
 * singularity. The renderer projects each polyline like any other 3D
 * sample stream.
 *
 * See waveform-physics-design.md (sibling file) for the architectural
 * stance behind this primitive.
 */

import { buildEndpointResolver, defaultPhysics } from './line-between.js';
import { evaluateScalarOrFieldRef, nullFieldResolver } from './fields.js';
import { ouroboros } from './wave-manji-scripts/ouroboros.js';
import { mandala } from './wave-manji-scripts/mandala.js';
import { windChime } from './wave-manji-scripts/wind-chime.js';
import { rasengan } from './wave-manji-scripts/rasengan.js';
import { rasenganSphere } from './wave-manji-scripts/rasengan-sphere.js';
import { smokeRing } from './wave-manji-scripts/smoke-ring.js';
import { celtic } from './wave-manji-scripts/celtic.js';
import { cloud } from './wave-manji-scripts/cloud.js';
import { tusk } from './wave-manji-scripts/tusk.js';
import { helix } from './wave-manji-scripts/helix.js';

const SCRIPTS = {
  ouroboros,
  mandala,
  'wind-chime': windChime,
  rasengan,
  'rasengan-sphere': rasenganSphere,
  'smoke-ring': smokeRing,
  celtic,
  cloud,
  tusk,
  helix,
};

export function waveManjiScriptIds() {
  return Object.keys(SCRIPTS);
}

const MAX_PASSES_SAFETY = 1024;

/**
 * Validate a list of wave manji specs against a walker's emitted nodes.
 * Mirrors validateConnections / validateWaveFields. Endpoint paths in
 * `singularity` are resolved here at mint time so bad refs surface as
 * 400s, not 500s at render time.
 */
export function validateWaveManji(waveManji, emittedNodes) {
  const errors = [];
  if (!Array.isArray(waveManji)) return errors;
  const resolveEndpoint = buildEndpointResolver(emittedNodes);
  waveManji.forEach((spec, i) => {
    if (!spec || typeof spec !== 'object') {
      errors.push(`waveManji[${i}]: must be an object with singularity and script`);
      return;
    }
    if (spec.singularity === undefined || spec.singularity === null) {
      errors.push(`waveManji[${i}].singularity: required (endpoint path or {x,y,z})`);
    } else if (typeof spec.singularity === 'string') {
      try {
        resolveEndpoint(spec.singularity);
      } catch (err) {
        errors.push(`waveManji[${i}].singularity: ${err.message}`);
      }
    } else if (!isFiniteVec(spec.singularity)) {
      errors.push(`waveManji[${i}].singularity: must be an endpoint path string or {x,y,z}`);
    }
    if (typeof spec.script !== 'string' || !SCRIPTS[spec.script]) {
      errors.push(
        `waveManji[${i}].script: must be one of ${Object.keys(SCRIPTS).join(', ')}; got ${JSON.stringify(spec.script)}`,
      );
    }
    // `bending` is a scalar OR a field reference. Shape-validate the
    // alternative form here; field-id existence is checked at mint time
    // by validateWaveManjiFieldRefs (it needs the manifest's `fields`).
    if (spec.bending !== undefined && spec.bending !== null
        && !Number.isFinite(spec.bending)) {
      const b = spec.bending;
      const isFieldRef = b && typeof b === 'object' && typeof b.field === 'string';
      if (!isFieldRef) {
        errors.push(
          `waveManji[${i}].bending: must be a number or { field: '<id>' }; got ${JSON.stringify(spec.bending)}`,
        );
      }
    }
  });
  return errors;
}

/**
 * Mint-time check that every `bending: { field: '<id>' }` reference in
 * a wave-manji array points at a declared field in `manifest.fields`.
 * Run AFTER validateFields so the field declarations themselves are
 * already known-good. Returns flat error strings.
 */
export function validateWaveManjiFieldRefs(waveManji, fields) {
  const errors = [];
  if (!Array.isArray(waveManji)) return errors;
  const known = new Set(fields && typeof fields === 'object' ? Object.keys(fields) : []);
  waveManji.forEach((spec, i) => {
    const b = spec?.bending;
    if (b && typeof b === 'object' && typeof b.field === 'string') {
      if (!known.has(b.field)) {
        const available = [...known].join(', ') || '<none>';
        errors.push(
          `waveManji[${i}].bending.field: unknown field '${b.field}' (available: ${available})`,
        );
      }
    }
  });
  return errors;
}

/**
 * Print a wave manji. The spec's `singularity` must already be a 3D
 * point (the caller pre-resolves endpoint paths, mirroring how
 * sampleLineBetween receives pre-resolved `from` / `to`).
 *
 * `fieldResolver` is the manifest's field resolver (see fields.js). It
 * lets `spec.bending` accept `{ field: '<id>' }` and evaluate at the
 * singularity position. Callers that don't have a field resolver (unit
 * tests of the printer directly) can omit it; field references will
 * then throw with a clear "no fields available" message.
 *
 * Returns { polylines: Point3D[][] } — script-decided count and shape.
 */
export function printWaveManji(spec, physics = defaultPhysics(), fieldResolver = nullFieldResolver()) {
  if (!spec || typeof spec !== 'object') {
    throw new Error('printWaveManji: spec object required');
  }
  if (!isFiniteVec(spec.singularity)) {
    throw new Error('printWaveManji: spec.singularity must be {x,y,z} (resolve endpoint paths first)');
  }
  const script = SCRIPTS[spec.script];
  if (!script) {
    throw new Error(`printWaveManji: unknown script '${spec.script}'`);
  }
  const ctx = buildPrintContext(spec, physics, fieldResolver);
  const polylines = [];
  let count = 0;
  for (const polyline of script(spec, ctx)) {
    if (Array.isArray(polyline) && polyline.length > 1) polylines.push(polyline);
    if (++count >= MAX_PASSES_SAFETY) break;
  }
  return { polylines };
}

/**
 * Compose the runtime context every script sees: resolved singularity,
 * the loop's plane basis (û, v̂, normal), the bending intensity, a
 * seeded PRNG, sample count per loop, and a `traceLoop` helper that
 * emits one closed polyline given (radius, phase, harmonics, perturb).
 *
 * Scripts use traceLoop to keep their math focused on per-pass modulation
 * rather than on circle-geometry boilerplate.
 */
function buildPrintContext(spec, physics, fieldResolver) {
  const singularity = spec.singularity;
  const samples = clampInt(spec.samples, 8, 1024, 64);
  // bending widens to `{ field: '<id>' }` — when a field reference, the
  // resolver evaluates at the singularity position (mirrors the design
  // doc §6 framing: scene forcing is what the singularity sees, not
  // what each loop sample sees). The value flows into the script
  // unchanged from there.
  const bending = evaluateScalarOrFieldRef(spec.bending, fieldResolver, singularity, 1.0);
  const density = Number.isFinite(spec.density) ? spec.density : null;
  const gravity = physics?.gravity || defaultPhysics().gravity;
  const planeNormal = normalize3(
    isFiniteVec(spec.plane) ? spec.plane : gravity,
  );
  const [uHat, vHat] = perpendicularBasis(planeNormal);
  const rand = makeSeededPrng(spec.seed);
  return {
    singularity,
    samples,
    bending,
    density,
    planeNormal,
    uHat,
    vHat,
    rand,
    traceLoop({ radius, phase = 0, sweep = Math.PI * 2, harmonics = [], perturb = 0, centerOffset = null, sampleCount = samples, axes = null }) {
      const out = [];
      const center = centerOffset
        ? add3(singularity, centerOffset)
        : singularity;
      // axes override (used by smoke-ring's per-cross-section frame).
      const u = axes?.uHat || uHat;
      const v = axes?.vHat || vHat;
      const N = Math.max(8, Math.floor(sampleCount));
      for (let i = 0; i <= N; i += 1) {
        const t = i / N;
        const theta = phase + sweep * t;
        let r = radius;
        for (const h of harmonics) {
          if (!h) continue;
          const order = Number.isFinite(h.n) ? h.n : 0;
          const amp = Number.isFinite(h.amplitude) ? h.amplitude : 0;
          const ph = Number.isFinite(h.phase) ? h.phase : 0;
          if (order === 0 || amp === 0) continue;
          r += amp * Math.cos(order * theta + ph);
        }
        if (perturb !== 0) {
          // Per-sample deterministic noise; mixing rand() here keeps the
          // perturbation tied to the wave manji's identity (same seed →
          // same wiggle).
          r += (rand() - 0.5) * 2 * perturb;
        }
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        out.push({
          x: center.x + r * (cosT * u.x + sinT * v.x),
          y: center.y + r * (cosT * u.y + sinT * v.y),
          z: center.z + r * (cosT * u.z + sinT * v.z),
        });
      }
      return out;
    },
  };
}

// ─── helpers ──────────────────────────────────────────────────────────

function perpendicularBasis(normal) {
  // Pick a stable û perpendicular to the normal, then v̂ = normal × û.
  // Same trick used in line-between's resolveDisplacementDirection
  // colinear fallback — guarantees a well-defined plane for any normal.
  const n = normalize3(normal);
  const ref = Math.abs(n.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const uHat = normalize3(cross3(n, ref));
  const vHat = normalize3(cross3(n, uHat));
  return [uHat, vHat];
}

// Mulberry32 — tiny, deterministic, public-domain seeded PRNG. Returns
// a function that yields uniform [0, 1) doubles. Seed can be a number
// or a string (hashed via simple FNV).
function makeSeededPrng(seed) {
  let a = hashSeed(seed) >>> 0;
  return function rand() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed) {
  if (Number.isFinite(seed)) return Math.floor(seed) | 0;
  const str = seed == null ? 'wave-manji' : String(seed);
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}

function clampInt(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function isFiniteVec(v) {
  return v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
}

function add3(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function cross3(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
function normalize3(v) {
  const len = Math.hypot(v.x, v.y, v.z);
  if (len < 1e-12) return { x: 0, y: 0, z: 1 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}
