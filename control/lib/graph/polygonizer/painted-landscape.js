/**
 * Painted-landscape primitive — heartbeat × splatch × structure-glyph.
 *
 * Closed-vocabulary landscape renderer. The model picks named glyphs:
 *
 *   - HEARTBEATS:        wave-recipe with parameter ranges + default light
 *   - SPLATCHES:         three seed colours + algorithmic palette derivation
 *   - STRUCTURE_GLYPHS:  scatter recipe (item list + seeded layout)
 *
 * The renderer resolves glyph → concrete recipe (with seeded within-recipe
 * variation), derives a balanced 4-stop palette from the splatch's three
 * seeds via HSL luminance sort + interpolation, computes analytic Lambert
 * shading per terrain cell and per structure face, depth-sorts the whole
 * polygon list back-to-front, and emits an SVG.
 *
 * The substrate move from the prior spike: every numeric parameter the
 * model used to author (wave amplitudes, hex stops, footprint coordinates)
 * is now absorbed into glyph lookup + seeded sampling. The model's surface
 * collapses to `{heartbeat, splatch, structures?, seed?, light?}`.
 *
 * Renders via `renderPaintedLandscapeToSvg(manifest)`; the sketch route
 * dispatches on `manifest.kind === 'painted-landscape'` to land here.
 *
 * Math provenance:
 *   - Wave value/slope at (u,v): `Σ amp·sin(2π(cu·u + cv·v) + φ)`, analytic
 *     derivatives in both axes.
 *   - Surface normal of a height field: `normalize(-∂z/∂x, -∂z/∂y, 1)`.
 *   - Lambert: `ambient + gain · max(0, n·L)`.
 *   - Palette stops: luminance-sorted seeds → 4-stop ramp by Rec.709
 *     luminance ordering, linear-RGB interpolation for intermediate stops.
 *
 * Spikes that built this:
 *   field-coupled-wedges.spike.gen.test.js     — option-1 value coupling
 *   field-coupled-wedges-lambert.spike.gen.test.js   — option-2 slope-Lambert
 *   field-coupled-wedges-step3.spike.gen.test.js     — lateral subdivision
 *   field-coupled-wedges-step4.spike.gen.test.js     — elevated mesh
 *   field-coupled-wedges-structures.spike.gen.test.js — block primitives
 *   glyph-driven-landscape.spike.gen.test.js   — closed-vocabulary surface
 */

import { projectTwoPoint } from './pure-mandala.js';
import { buildFieldResolver, validateFields } from './fields.js';
import {
  HEARTBEATS as LOADED_HEARTBEATS,
  SPLATCHES as LOADED_SPLATCHES,
  CAMERAS as LOADED_CAMERAS,
  SCENES as LOADED_SCENES,
  SCATTER_KIND_IDS,
  SCENE_BAND_IDS,
  SCENE_BAND_RANGES,
} from '../painted-landscape-cards/loader.js';

// ─── Quad + Lambert constants ──────────────────────────────────────────
const AMBIENT = 0.22;
const LAMBERT_GAIN = 0.78;
const X_MIN = -12;
const X_MAX = 12;
const Y_NEAR = 6;
const Y_FAR = -24;
const Y_SPAN = Y_NEAR - Y_FAR;
const DUDX = 1 / (X_MAX - X_MIN);
const DVDY = -1 / Y_SPAN;

// ─── HEARTBEATS + SPLATCHES — loaded from card files ───────────────────
// Both registries come from `painted-landscape-cards/loader.js`, which
// scans `painted-landscape-cards/*.md` for markdown files with JSON
// frontmatter, validates each card against its family schema, and
// exposes frozen registries keyed by card id.
//
// Adding a heartbeat or splatch is a content edit (drop a new .md file
// in the cards directory). The validation rules — closed enum, range
// authoring discipline, hex format on splatch seeds — are enforced at
// load time so bad cards fail at startup, not at first render.
export const HEARTBEATS = LOADED_HEARTBEATS;
export const SPLATCHES = LOADED_SPLATCHES;
export const CAMERAS = LOADED_CAMERAS;
export const SCENES = LOADED_SCENES;
export { SCATTER_KIND_IDS, SCENE_BAND_IDS };

// ─── STRUCTURE GLYPHS table ────────────────────────────────────────────
// Each glyph's `layout(rng)` returns a list of sites in (u, v) parameter
// space + per-site kind/width/height. The render layer converts (u, v)
// to world (x, y), samples the heartbeat's wave to find z_base, and
// builds box faces sitting on the elevated surface.
export const STRUCTURE_GLYPHS = Object.freeze({
  'monument-row': Object.freeze({
    intent: 'three obelisks along the depth axis',
    layout(rng) {
      const sites = [];
      const baseV = 0.20 + rng() * 0.15;
      for (let k = 0; k < 3; k += 1) {
        const v = baseV + k * 0.27 + (rng() - 0.5) * 0.04;
        const u = 0.5 + (rng() - 0.5) * 0.15;
        sites.push({
          u,
          v,
          kind: 'obelisk',
          width: 1.0 + rng() * 0.3,
          height: 3.5 + rng() * 1.0,
        });
      }
      return sites;
    },
  }),
  'village-cluster': Object.freeze({
    intent: 'a few buildings + one obelisk clustered around a centroid',
    layout(rng) {
      const cu = 0.4 + rng() * 0.2;
      const cv = 0.55 + rng() * 0.15;
      const sites = [];
      sites.push({ u: cu + (rng() - 0.5) * 0.12, v: cv + (rng() - 0.5) * 0.12, kind: 'box', width: 2.5, height: 1.7 + rng() * 0.4 });
      sites.push({ u: cu + (rng() - 0.5) * 0.18, v: cv + (rng() - 0.5) * 0.18, kind: 'box', width: 2.0, height: 1.3 + rng() * 0.4 });
      sites.push({ u: cu + (rng() - 0.5) * 0.20, v: cv + (rng() - 0.5) * 0.20, kind: 'box', width: 1.6, height: 1.1 + rng() * 0.3 });
      sites.push({ u: cu + (rng() - 0.5) * 0.10, v: cv + (rng() - 0.5) * 0.10, kind: 'obelisk', width: 1.0, height: 3.2 + rng() * 0.6 });
      return sites;
    },
  }),
  'scattered-totems': Object.freeze({
    intent: 'small obelisks scattered loosely across the field',
    layout(rng) {
      const sites = [];
      const n = 4 + Math.floor(rng() * 2);
      for (let k = 0; k < n; k += 1) {
        sites.push({
          u: 0.18 + rng() * 0.64,
          v: 0.20 + rng() * 0.60,
          kind: 'obelisk',
          width: 0.8 + rng() * 0.4,
          height: 2.5 + rng() * 1.5,
        });
      }
      return sites;
    },
  }),
});

export function heartbeatIds() { return Object.keys(HEARTBEATS); }
export function splatchIds() { return Object.keys(SPLATCHES); }
export function structureGlyphIds() { return Object.keys(STRUCTURE_GLYPHS); }
export function cameraIds() { return Object.keys(CAMERAS); }
export function sceneIds() { return Object.keys(SCENES); }

// ─── Validation (mint-time errors, not render-time) ────────────────────

export function validatePaintedLandscape(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') {
    errors.push('manifest must be an object');
    return errors;
  }
  if (manifest.kind !== 'painted-landscape') {
    errors.push(`manifest.kind must be 'painted-landscape' (got ${JSON.stringify(manifest.kind)})`);
  }
  const hasElevation = manifest.elevation !== undefined && manifest.elevation !== null;
  if (!hasElevation) {
    if (!manifest.heartbeat || typeof manifest.heartbeat !== 'string') {
      errors.push('heartbeat is required (string) unless an `elevation` field block is provided');
    } else if (!HEARTBEATS[manifest.heartbeat]) {
      errors.push(`unknown heartbeat '${manifest.heartbeat}' (available: ${heartbeatIds().join(', ')})`);
    }
  } else if (manifest.heartbeat !== undefined && manifest.heartbeat !== null) {
    // heartbeat is ignored in elevation mode, but if present must be valid.
    if (typeof manifest.heartbeat !== 'string' || !HEARTBEATS[manifest.heartbeat]) {
      errors.push(`unknown heartbeat '${manifest.heartbeat}' (available: ${heartbeatIds().join(', ')})`);
    }
  }
  if (hasElevation) {
    errors.push(...validateElevationSpec(manifest.elevation));
  }
  if (!manifest.splatch || typeof manifest.splatch !== 'string') {
    errors.push('splatch is required (string)');
  } else if (!SPLATCHES[manifest.splatch]) {
    errors.push(`unknown splatch '${manifest.splatch}' (available: ${splatchIds().join(', ')})`);
  }
  if (manifest.structures !== undefined && manifest.structures !== null) {
    if (typeof manifest.structures !== 'string') {
      errors.push('structures must be a string (structure-glyph id) or omitted');
    } else if (!STRUCTURE_GLYPHS[manifest.structures]) {
      errors.push(`unknown structure glyph '${manifest.structures}' (available: ${structureGlyphIds().join(', ')})`);
    }
  }
  if (manifest.scene !== undefined && manifest.scene !== null) {
    if (typeof manifest.scene !== 'string') {
      errors.push('scene must be a string (scene-glyph id) or omitted');
    } else if (!SCENES[manifest.scene]) {
      errors.push(`unknown scene '${manifest.scene}' (available: ${sceneIds().join(', ')})`);
    }
  }
  if (manifest.seed !== undefined && manifest.seed !== null) {
    if (typeof manifest.seed !== 'string' || !manifest.seed.length) {
      errors.push('seed must be a non-empty string when provided');
    }
  }
  if (manifest.light !== undefined && manifest.light !== null) {
    const L = manifest.light;
    const finiteNum = (v) => typeof v === 'number' && Number.isFinite(v);
    if (typeof L !== 'object' || !finiteNum(L.x) || !finiteNum(L.y) || !finiteNum(L.z)) {
      errors.push('light must be { x, y, z } finite numbers when provided');
    }
  }
  if (manifest.paletteOverrides !== undefined && manifest.paletteOverrides !== null) {
    errors.push(...validatePaletteOverrides(manifest.paletteOverrides));
  }
  if (manifest.heartbeatOverrides !== undefined && manifest.heartbeatOverrides !== null) {
    errors.push(...validateHeartbeatOverrides(manifest.heartbeatOverrides, manifest.heartbeat));
  }
  if (manifest.renderStyle !== undefined && manifest.renderStyle !== null) {
    if (!RENDER_STYLES.includes(manifest.renderStyle)) {
      errors.push(`renderStyle must be one of: ${RENDER_STYLES.join(', ')} (got ${JSON.stringify(manifest.renderStyle)})`);
    }
  }
  if (manifest.camera !== undefined && manifest.camera !== null) {
    if (typeof manifest.camera !== 'string') {
      errors.push('camera must be a string (camera-glyph id) or omitted');
    } else if (!CAMERAS[manifest.camera]) {
      errors.push(`unknown camera '${manifest.camera}' (available: ${cameraIds().join(', ')})`);
    }
  }
  if (manifest.sky !== undefined && manifest.sky !== null) {
    const s = manifest.sky;
    if (typeof s !== 'boolean' && (typeof s !== 'object' || Array.isArray(s))) {
      errors.push('sky must be a boolean or { hazeStrength?, clouds? } object (sky is on by default; pass false to disable)');
    } else if (typeof s === 'object') {
      if (s.hazeStrength !== undefined
        && (typeof s.hazeStrength !== 'number' || !Number.isFinite(s.hazeStrength) || s.hazeStrength < 0)) {
        errors.push('sky.hazeStrength must be a non-negative finite number when provided');
      }
      if (s.clouds !== undefined && s.clouds !== null) {
        const cl = s.clouds;
        if (typeof cl === 'number') {
          if (!Number.isFinite(cl) || cl < 0) errors.push('sky.clouds (coverage) must be a number >= 0 (0–1)');
        } else if (typeof cl === 'object' && !Array.isArray(cl)) {
          if (cl.coverage !== undefined && (typeof cl.coverage !== 'number' || !Number.isFinite(cl.coverage) || cl.coverage < 0)) {
            errors.push('sky.clouds.coverage must be a number >= 0 (0–1)');
          }
          if (cl.softness !== undefined && (typeof cl.softness !== 'number' || !Number.isFinite(cl.softness) || cl.softness <= 0)) {
            errors.push('sky.clouds.softness must be a positive number when provided');
          }
        } else {
          errors.push('sky.clouds must be a coverage number or { coverage, softness?, seed? } object');
        }
      }
    }
  }
  return errors;
}

// Validate the optional `elevation` block — a composed field that drives
// the terrain instead of a heartbeat. `{ fields, field, waterLevel?,
// samples? }`. The fields object is validated by the shared fields.js
// validator; `field` must name one of them.
function validateElevationSpec(el) {
  const errors = [];
  if (typeof el !== 'object' || Array.isArray(el)) {
    errors.push('elevation must be an object { fields, field, waterLevel?, samples? }');
    return errors;
  }
  if (typeof el.fields !== 'object' || !el.fields || Array.isArray(el.fields)) {
    errors.push('elevation.fields must be an object keyed by field id');
  } else {
    errors.push(...validateFields(el.fields, []).map((e) => `elevation.${e}`));
    if (typeof el.field !== 'string' || !el.field) {
      errors.push('elevation.field must be a non-empty field id string');
    } else if (!Object.hasOwn(el.fields, el.field)) {
      errors.push(`elevation.field '${el.field}' not found in elevation.fields`);
    }
  }
  if (el.waterLevel !== undefined && el.waterLevel !== null && !Number.isFinite(el.waterLevel)) {
    errors.push('elevation.waterLevel must be a finite number when provided');
  }
  if (el.samples !== undefined && el.samples !== null) {
    const intOk = (v) => typeof v === 'number' && Number.isInteger(v) && v >= 2;
    if (typeof el.samples !== 'object' || !intOk(el.samples.u) || !intOk(el.samples.v)) {
      errors.push('elevation.samples must be { u, v } integers >= 2');
    }
  }
  return errors;
}

// Closed enum of polygon-render styles. Affects how cells are stroked +
// filled; geometry and Lambert math are identical across styles.
export const RENDER_STYLES = Object.freeze([
  'painterly',   // default — stroke=fill (no visible borders), pure Lambert blocks
  'topographic', // Lambert fill WITH dark cell borders — vector-map / topo-chart feel
  'wireframe',   // no fill, Lambert-colored strokes — pure cell-edge silhouette
]);

function validateHeartbeatOverrides(ho, heartbeatName) {
  const errors = [];
  if (typeof ho !== 'object' || Array.isArray(ho)) {
    errors.push('heartbeatOverrides must be an object');
    return errors;
  }
  const recipe = HEARTBEATS[heartbeatName];
  const engine = recipe ? (recipe.engine || 'sine-stack') : 'sine-stack';
  const recipeWaveCount = (recipe && recipe.waves) ? recipe.waves.length : 0;
  if (ho.waves !== undefined && ho.waves !== null) {
    if (!Array.isArray(ho.waves)) {
      errors.push('heartbeatOverrides.waves must be an array of per-component scale objects');
    } else {
      if (recipe && engine !== 'sine-stack') {
        errors.push(
          `heartbeatOverrides.waves: heartbeat '${heartbeatName}' uses engine '${engine}'; wave overrides only apply to sine-stack heartbeats`,
        );
      } else if (recipe && ho.waves.length > recipeWaveCount) {
        errors.push(
          `heartbeatOverrides.waves: heartbeat '${heartbeatName}' has ${recipeWaveCount} components but overrides specify ${ho.waves.length}`,
        );
      }
      for (let i = 0; i < ho.waves.length; i += 1) {
        const w = ho.waves[i];
        if (w == null) continue;
        if (typeof w !== 'object' || Array.isArray(w)) {
          errors.push(`heartbeatOverrides.waves[${i}]: must be an object (or null to skip)`);
          continue;
        }
        for (const key of ['ampScale', 'cuScale', 'cvScale']) {
          if (w[key] !== undefined && w[key] !== null) {
            if (typeof w[key] !== 'number' || !Number.isFinite(w[key]) || w[key] <= 0) {
              errors.push(`heartbeatOverrides.waves[${i}].${key} must be a positive finite number`);
            }
          }
        }
        for (const key of Object.keys(w)) {
          if (!['ampScale', 'cuScale', 'cvScale'].includes(key)) {
            errors.push(
              `heartbeatOverrides.waves[${i}]: unknown key '${key}' (available: ampScale, cuScale, cvScale)`,
            );
          }
        }
      }
    }
  }
  if (ho.samples !== undefined && ho.samples !== null) {
    if (typeof ho.samples !== 'object' || Array.isArray(ho.samples)) {
      errors.push('heartbeatOverrides.samples must be { u: integer >= 2, v: integer >= 2 }');
    } else {
      const intCheck = (v) => typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 2;
      if (!intCheck(ho.samples.u)) {
        errors.push('heartbeatOverrides.samples.u must be an integer >= 2');
      }
      if (!intCheck(ho.samples.v)) {
        errors.push('heartbeatOverrides.samples.v must be an integer >= 2');
      }
    }
  }
  return errors;
}

function validatePaletteOverrides(po) {
  const errors = [];
  if (typeof po !== 'object' || Array.isArray(po)) {
    errors.push('paletteOverrides must be an object');
    return errors;
  }
  if (po.stops !== undefined && po.stops !== null) {
    if (typeof po.stops !== 'object' || Array.isArray(po.stops)) {
      errors.push('paletteOverrides.stops must be an object');
    } else {
      const validRoles = new Set(['shadow', 'base', 'mid', 'highlight']);
      for (const [role, hex] of Object.entries(po.stops)) {
        if (!validRoles.has(role)) {
          errors.push(`paletteOverrides.stops: unknown role '${role}' (available: shadow, base, mid, highlight)`);
          continue;
        }
        if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) {
          errors.push(`paletteOverrides.stops.${role}: must be a hex string '#rrggbb' (got ${JSON.stringify(hex)})`);
        }
      }
    }
  }
  if (po.positions !== undefined && po.positions !== null) {
    if (!Array.isArray(po.positions) || po.positions.length !== 4) {
      errors.push('paletteOverrides.positions must be an array of exactly 4 numbers');
    } else {
      const ps = po.positions;
      const finite = ps.every((p) => typeof p === 'number' && Number.isFinite(p));
      if (!finite) {
        errors.push('paletteOverrides.positions must contain finite numbers');
      } else if (ps[0] !== 0 || ps[3] !== 1) {
        errors.push('paletteOverrides.positions: first stop must be 0 and last stop must be 1');
      } else if (!(ps[0] < ps[1] && ps[1] < ps[2] && ps[2] < ps[3])) {
        errors.push('paletteOverrides.positions must be strictly increasing (e.g. [0, 0.35, 0.7, 1])');
      }
    }
  }
  if (po.gamma !== undefined && po.gamma !== null) {
    if (typeof po.gamma !== 'number' || !Number.isFinite(po.gamma) || po.gamma <= 0) {
      errors.push('paletteOverrides.gamma must be a positive finite number');
    }
  }
  return errors;
}

// ─── Seeded PRNG (xmur3 → mulberry32) ──────────────────────────────────
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(seed) {
  let s = seed >>> 0;
  return function rand() {
    s = (s + 0x6D2B79F5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRng(seedStr) {
  return mulberry32(xmur3(seedStr)());
}
function pickInRange(rng, [lo, hi]) {
  return lo + (hi - lo) * rng();
}

// ─── Resolvers ─────────────────────────────────────────────────────────

/**
 * Sample concrete wave parameters from a heartbeat recipe using the seed,
 * optionally applying `heartbeatOverrides` to scale parameter ranges and
 * override sample density without leaving the heartbeat's enum.
 *
 * Output: `{ waves: [...], samples: {u,v}, defaultLight: {x,y,z} }`.
 *
 * Overrides applied BEFORE sampling so the seed selects from the scaled
 * range — keeps the property that `(name, seed, overrides)` → identical
 * waves regardless of unrelated overrides.
 */
export function resolveHeartbeat(name, seedStr, overrides = null) {
  const recipe = HEARTBEATS[name];
  if (!recipe) {
    throw new Error(`Unknown heartbeat '${name}' (available: ${heartbeatIds().join(', ')})`);
  }
  const engine = recipe.engine || 'sine-stack';
  const rng = makeRng(`${seedStr}::heartbeat::${name}`);
  const samples = overrides?.samples
    ? { u: overrides.samples.u, v: overrides.samples.v }
    : recipe.samples;
  if (engine === 'fbm') {
    // Sample each parameter from its declared range. octaves is an
    // integer range; the others are continuous. Noise seed is a stable
    // integer derived from (name, seedStr) so the fBm function gets a
    // reproducible per-call seed without sharing state with the wave RNG.
    const octavesRaw = pickInRange(rng, recipe.fbm.octaves);
    const octaves = Math.max(1, Math.round(octavesRaw));
    const persistence = pickInRange(rng, recipe.fbm.persistence);
    const lacunarity = pickInRange(rng, recipe.fbm.lacunarity);
    const baseScale = pickInRange(rng, recipe.fbm.baseScale);
    const amplitude = pickInRange(rng, recipe.fbm.amplitude);
    const noiseSeed = xmur3(`${seedStr}::noise::${name}`)();
    return {
      engine: 'fbm',
      fbm: { octaves, persistence, lacunarity, baseScale, amplitude, noiseSeed },
      samples,
      defaultLight: recipe.defaultLight,
    };
  }
  // sine-stack (default + backward-compatible shape on the return value)
  const waveOverrides = overrides?.waves;
  const waves = recipe.waves.map((w, i) => {
    const o = (waveOverrides && waveOverrides[i]) || null;
    const ampScale = o?.ampScale ?? 1;
    const cuScale = o?.cuScale ?? 1;
    const cvScale = o?.cvScale ?? 1;
    const ampRange = [w.amp[0] * ampScale, w.amp[1] * ampScale];
    const cuRange = [w.cu[0] * cuScale, w.cu[1] * cuScale];
    const cvRange = [w.cv[0] * cvScale, w.cv[1] * cvScale];
    return {
      amplitude: pickInRange(rng, ampRange),
      cycles: { u: pickInRange(rng, cuRange), v: pickInRange(rng, cvRange) },
      phase: rng() * 2 * Math.PI,
    };
  });
  return { engine: 'sine-stack', waves, samples, defaultLight: recipe.defaultLight };
}

// Default brightness positions for the four stops on the [0, 1] ramp.
// shadow at 0, then thirds, highlight at 1. Linear distribution.
const DEFAULT_POSITIONS = Object.freeze([0, 1 / 3, 2 / 3, 1]);

/**
 * Derive a balanced (shadow, base, mid, highlight) palette from a
 * splatch's three seed colors, optionally with `paletteOverrides`
 * applied.
 *
 * Algorithm:
 *   1. Convert each seed to RGB, compute Rec.709 luminance.
 *   2. Sort by luminance ascending (darkest → highlight).
 *   3. Use endpoints as shadow/highlight; interpolate two intermediates.
 *   4. Apply `paletteOverrides.stops` to swap specific stop hex values.
 *   5. Attach `positions` (default linear) and `gamma` (default 1.0)
 *      so the shader can curve and reposition the ramp.
 *
 * Without overrides: same splatch → same palette (fully deterministic).
 * With overrides: same splatch + same overrides → same palette.
 */
export function derivePalette(splatchName, overrides = null) {
  const splatch = SPLATCHES[splatchName];
  if (!splatch) {
    throw new Error(`Unknown splatch '${splatchName}' (available: ${splatchIds().join(', ')})`);
  }
  const rgbs = splatch.seeds.map(hexToRgb);
  const sorted = [...rgbs].sort((a, b) => luminance(a) - luminance(b));
  const [dark, middle, light] = sorted;
  let palette = {
    shadow: dark,
    base: lerpRgb(dark, middle, 0.55),
    mid: lerpRgb(middle, light, 0.35),
    highlight: light,
    positions: DEFAULT_POSITIONS,
    gamma: 1.0,
  };
  if (overrides && typeof overrides === 'object') {
    if (overrides.stops && typeof overrides.stops === 'object') {
      for (const role of ['shadow', 'base', 'mid', 'highlight']) {
        const hex = overrides.stops[role];
        if (typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex)) {
          palette[role] = hexToRgb(hex);
        }
      }
    }
    if (Array.isArray(overrides.positions) && overrides.positions.length === 4) {
      palette.positions = overrides.positions.slice();
    }
    if (typeof overrides.gamma === 'number' && Number.isFinite(overrides.gamma) && overrides.gamma > 0) {
      palette.gamma = overrides.gamma;
    }
  }
  return palette;
}

/**
 * Realize a structure-glyph into world-space footprints + heights. The
 * caller couples each footprint to the heartbeat's wave to find z_base.
 */
export function resolveStructures(glyphName, seedStr) {
  if (glyphName == null) return [];
  const glyph = STRUCTURE_GLYPHS[glyphName];
  if (!glyph) {
    throw new Error(`Unknown structure glyph '${glyphName}' (available: ${structureGlyphIds().join(', ')})`);
  }
  const rng = makeRng(`${seedStr}::structures::${glyphName}`);
  return glyph.layout(rng).map((site) => {
    const xc = X_MIN + (X_MAX - X_MIN) * site.u;
    const yc = Y_NEAR - Y_SPAN * site.v;
    const half = site.width / 2;
    return {
      kind: site.kind,
      x0: xc - half,
      x1: xc + half,
      y0: yc - half,
      y1: yc + half,
      height: site.height,
    };
  });
}

// ─── Scene fill (per-biome completion) ─────────────────────────────────
// World-space width-to-height aspect per scatter kind. Height comes from
// the card's `size` range; width is derived so kinds keep their read
// (firs narrow, boulders wide-and-low).
const SCATTER_ASPECT = Object.freeze({
  cone: 0.5,
  canopy: 0.8,
  boulder: 1.8,
  tuft: 1.0,
});

/**
 * Realize a scene-glyph into a flat list of scatter items in world space.
 * Each band's fill entries are stratified across the lateral (u) axis and
 * jittered in depth (v) within the band's range, seeded so
 * `(scene, seed)` → identical layout. Heights sample the entry's size
 * range; widths derive from the kind's aspect. `z_base` is read at render
 * time (the caller couples each item to the heartbeat wave), exactly like
 * structures, so items ride the hill they land on.
 */
export function resolveScene(sceneName, seedStr) {
  if (sceneName == null) return [];
  const scene = SCENES[sceneName];
  if (!scene) {
    throw new Error(`Unknown scene '${sceneName}' (available: ${sceneIds().join(', ')})`);
  }
  const items = [];
  for (const band of SCENE_BAND_IDS) {
    const [vLo, vHi] = SCENE_BAND_RANGES[band];
    const entries = scene.fill[band] || [];
    entries.forEach((entry, entryIndex) => {
      const rng = makeRng(`${seedStr}::scene::${sceneName}::${band}::${entryIndex}`);
      const aspect = SCATTER_ASPECT[entry.kind] ?? 1;
      for (let k = 0; k < entry.count; k += 1) {
        // Stratify u so a band's items spread across the width instead of
        // clumping; jitter ±40% of a cell. v is free within the band.
        const u = (k + 0.5 + (rng() - 0.5) * 0.8) / Math.max(entry.count, 1);
        const v = vLo + (vHi - vLo) * rng();
        const height = pickInRange(rng, entry.size);
        items.push({
          kind: entry.kind,
          band,
          x: X_MIN + (X_MAX - X_MIN) * Math.min(Math.max(u, 0.02), 0.98),
          y: Y_NEAR - Y_SPAN * v,
          height,
          width: height * aspect,
        });
      }
    });
  }
  return items;
}

/**
 * Completion report for a scene-glyph: per-band target vs placed counts.
 * v1 always meets quota (the layout places exactly the declared counts);
 * the value is an auditable record that the scene's legibility budget was
 * filled. Returns `{ scene, bands, total, complete }`.
 */
export function computeSceneCompletion(sceneName) {
  const scene = SCENES[sceneName];
  if (!scene) {
    throw new Error(`Unknown scene '${sceneName}' (available: ${sceneIds().join(', ')})`);
  }
  const bands = {};
  let total = 0;
  let complete = true;
  for (const band of SCENE_BAND_IDS) {
    const target = (scene.fill[band] || []).reduce((s, e) => s + e.count, 0);
    bands[band] = { target, placed: target };
    total += target;
    if (target !== bands[band].placed) complete = false;
  }
  return { scene: sceneName, bands, total, complete };
}

// ─── Color helpers ─────────────────────────────────────────────────────
function hexToRgb(hex) {
  const m = hex.replace('#', '');
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}
function srgbLin(c) {
  const u = c / 255;
  return u < 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
}
function luminance(rgb) {
  // Rec.709 coefficients on linearized sRGB.
  return 0.2126 * srgbLin(rgb[0]) + 0.7152 * srgbLin(rgb[1]) + 0.0722 * srgbLin(rgb[2]);
}
function lerpRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}
function clamp255(v) { return Math.max(0, Math.min(255, Math.round(v))); }

// ─── Sky — derived backdrop + atmospheric haze ─────────────────────────
// Sky is not geometry; it is a screen-space gradient backdrop plus a haze
// applied to the 3D scene. Both colors derive from the splatch palette and
// the light's elevation (light.z), so the sky is coherent with the scene's
// mood for free: a low sun glows the horizon warm into a dark zenith
// (dusk); an overhead sun gives a flat bright sky.
function smoothstep01(t) {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}
// Deep-night sky + the cool tint moonlit ground takes on.
const NIGHT_ZENITH = [9, 13, 28];
const NIGHT_TINT = [16, 22, 42];
function deriveSky(palette, light) {
  // `light.z` is the sun ELEVATION and may be negative — the sun below the
  // horizon is night. Three regimes blend continuously off this one number:
  //   day  ≈ 1 when the sun is up, 0 in deep night
  //   glow ≈ warm horizon band that PEAKS at the horizon and fades both as
  //          the sun climbs (less sunset) and as it sinks below (deep night)
  const sunElev = Number.isFinite(light.z) ? light.z : 0.5;
  const day = smoothstep01((sunElev + 0.25) / 0.55);
  const nearHorizon = Math.max(0, 1 - Math.abs(sunElev) / 0.45);
  const glow = nearHorizon * smoothstep01((sunElev + 0.2) / 0.25);

  // DAY palette-derived gradient (warm horizon, cool-lifted zenith).
  const zMix = 0.25 + 0.35 * (1 - Math.max(0, Math.min(1, sunElev)));
  const dz = lerpRgb(palette.highlight, palette.shadow, zMix);
  const dayZenith = [clamp255(dz[0] - 6), clamp255(dz[1] - 2), clamp255(dz[2] + 10)];
  const dh = lerpRgb(palette.highlight, [255, 255, 255], 0.1);
  const warm = 0.4 * glow;
  const dayHorizon = [clamp255(dh[0] + warm * 45), clamp255(dh[1] + warm * 12), clamp255(dh[2] - warm * 28)];

  // NIGHT gradient — deep indigo zenith; a dim horizon carrying a hint of the
  // palette shadow plus whatever faint glow remains (afterglow / moon).
  const nh = lerpRgb(palette.shadow, [40, 48, 78], 0.5);
  const nightHorizon = [clamp255(nh[0] + warm * 22), clamp255(nh[1] + warm * 16), clamp255(nh[2] + warm * 6)];

  return {
    zenith: lerpRgb(NIGHT_ZENITH, dayZenith, day),
    horizon: lerpRgb(nightHorizon, dayHorizon, day),
    day,
  };
}

// Blend an `rgb(r,g,b)` fill toward the horizon color by `amount` — the
// atmospheric haze that dissolves distant terrain into the sky (and tints
// water toward the horizon, reading as a sky reflection).
function applyHaze(fill, horizon, amount) {
  const m = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(fill);
  if (!m) return fill;
  const a = Math.max(0, Math.min(1, amount));
  const r = Number(m[1]); const g = Number(m[2]); const b = Number(m[3]);
  return `rgb(${clamp255(r + (horizon[0] - r) * a)},${clamp255(g + (horizon[1] - g) * a)},${clamp255(b + (horizon[2] - b) * a)})`;
}

// ─── Clouds — procedural fBm cover, derived from the sky ────────────────
// Clouds are not geometry: a fBm field thresholded by one `coverage` knob,
// painted into the sky band behind the terrain. Color derives from the sky
// (lit tops toward a bright tone, shaded bases toward the horizon), so they
// ride the day→night arc for free — white by day, warm-lit undersides at
// dusk, dark at night.
function normalizeClouds(clouds, sky, seed) {
  const coverage = typeof clouds === 'number' ? clouds : Number(clouds && clouds.coverage);
  if (!Number.isFinite(coverage) || coverage <= 0) return null;
  const obj = (clouds && typeof clouds === 'object') ? clouds : {};
  const softness = Number.isFinite(obj.softness) ? Math.max(obj.softness, 0.02) : 0.16;
  const seedStr = obj.seed != null ? String(obj.seed) : `${seed}::clouds`;
  const noiseSeed = xmur3(seedStr)();
  // Lit top: the horizon tone lifted toward white (bright by day, still warm
  // at dusk since the horizon already carries the glow). Shaded base: between
  // zenith and horizon, darkened — the cloud underside.
  const litTop = lerpRgb(sky.horizon, [255, 255, 255], 0.32 * sky.day + 0.08);
  const sb = lerpRgb(sky.zenith, sky.horizon, 0.6);
  const shadeBase = [clamp255(sb[0] * 0.82), clamp255(sb[1] * 0.82), clamp255(sb[2] * 0.86)];
  return {
    coverage: Math.min(coverage, 1),
    softness,
    litTop,
    shadeBase,
    fbm: { octaves: 5, persistence: 0.55, lacunarity: 2.1, baseScale: 1, amplitude: 1, noiseSeed },
  };
}

// Emit the cloud band as a grid of soft-opacity cells over the upper sky.
// The noise is sampled in a horizon-compressed space so clouds bunch and
// shrink toward the horizon (perspective), and density fades to nothing at
// the horizon line so there is no hard band.
function buildClouds(vp, cfg) {
  const horizonY = vp.vbY + vp.vbH * 0.6;
  const bandTop = vp.vbY - vp.vbH * 0.03;
  const NX = 88;
  const NY = 30;
  const cw = vp.vbW / NX;
  const chh = (horizonY - bandTop) / NY;
  if (cw <= 0 || chh <= 0) return [];
  const cycles = 7;
  const thresh = 1 - cfg.coverage;
  const denom = Math.max(1 - thresh, 1e-3);
  const rects = [];
  for (let j = 0; j < NY; j += 1) {
    const sy = bandTop + (j + 0.5) * chh;
    const h = Math.max(0, Math.min(1, (horizonY - sy) / (horizonY - bandTop)));
    const persp = 0.3 + 0.7 * h;
    for (let i = 0; i < NX; i += 1) {
      const u = (i + 0.5) / NX;
      const n = fbm2D((u * cycles) / persp, ((1 - h) * cycles * 0.5) / persp, cfg.fbm);
      const t = (n + 1) / 2; // [0,1]
      let d = smoothstep01((t - thresh) / cfg.softness);
      d *= smoothstep01(h / 0.1); // fade to nothing at the horizon
      if (d <= 0.02) continue;
      const lit = Math.max(0, Math.min(1, (t - thresh) / denom));
      const c = lerpRgb(cfg.shadeBase, cfg.litTop, lit);
      rects.push(
        `<rect x="${(vp.vbX + i * cw).toFixed(2)}" y="${(bandTop + j * chh).toFixed(2)}" width="${(cw + 0.6).toFixed(2)}" height="${(chh + 0.6).toFixed(2)}" fill="rgb(${c[0]},${c[1]},${c[2]})" fill-opacity="${(Math.min(d, 1) * 0.95).toFixed(3)}" />`,
      );
    }
  }
  return rects;
}

// Map a Lambert raw value through the 4-stop palette ramp.
// Curves the input by `palette.gamma` (>1 deepens midtones, <1 brightens),
// then finds the segment in `palette.positions` and interpolates within
// it. Default positions are linear [0, 1/3, 2/3, 1] and default gamma is
// 1.0, so the no-override path matches the original linear mapping.
function shadeFromLambert(palette, lambertRaw) {
  let t = (lambertRaw - AMBIENT) / LAMBERT_GAIN;
  t = Math.max(0, Math.min(1, t));
  const gamma = palette.gamma || 1;
  if (gamma !== 1) {
    t = Math.pow(t, gamma);
  }
  const positions = palette.positions || DEFAULT_POSITIONS;
  const stops = [palette.shadow, palette.base, palette.mid, palette.highlight];
  // Find the segment [positions[i], positions[i+1]] that contains t.
  for (let i = 0; i < 3; i += 1) {
    if (t <= positions[i + 1]) {
      const span = positions[i + 1] - positions[i];
      const frac = span > 0 ? (t - positions[i]) / span : 0;
      const c = lerpRgb(stops[i], stops[i + 1], frac);
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  const c = stops[3];
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// ─── fBm engine — value noise + fractional Brownian motion ─────────────
// Value noise with bilinear smoothstep blends; seeded per-octave so
// different octaves don't reinforce each other on grid lines.
//
// fBm(x, y) = Σ_{i=0..octaves-1} amp_i · noise(x · freq_i, y · freq_i)
//   amp_i  = persistence^i
//   freq_i = (1 / baseScale) · lacunarity^i
//
// Heights are normalized by sum-of-amplitudes so the output stays in
// roughly [-amplitude, +amplitude] regardless of octave count.
//
// Slopes are finite differences with epsilon = 0.01 world units. For
// our cell scale (~24 world units across the quad), that's well under
// the smallest wavelength even at lacunarity=2.5 and 6 octaves.
function hashCell(i, j, seed) {
  let h = seed | 0;
  h = Math.imul(h + i, 374761393) | 0;
  h = Math.imul(h + j, 668265263) | 0;
  h = (h ^ (h >>> 13)) | 0;
  h = Math.imul(h, 1274126177) | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function smoothstep(t) { return t * t * (3 - 2 * t); }
function valueNoise2D(x, y, seed) {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const v00 = hashCell(i,     j,     seed);
  const v10 = hashCell(i + 1, j,     seed);
  const v01 = hashCell(i,     j + 1, seed);
  const v11 = hashCell(i + 1, j + 1, seed);
  const sx = smoothstep(fx);
  const sy = smoothstep(fy);
  const v0 = v00 + (v10 - v00) * sx;
  const v1 = v01 + (v11 - v01) * sx;
  return (v0 + (v1 - v0) * sy) * 2 - 1; // [-1, 1]
}
function fbm2D(x, y, fbm) {
  const { octaves, persistence, lacunarity, baseScale, amplitude, noiseSeed } = fbm;
  let sum = 0;
  let amp = 1;
  let freq = 1 / baseScale;
  let normFactor = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += amp * valueNoise2D(x * freq, y * freq, noiseSeed + i * 1009);
    normFactor += amp;
    amp *= persistence;
    freq *= lacunarity;
  }
  return (sum / Math.max(normFactor, 1e-9)) * amplitude;
}
const FBM_SLOPE_EPS = 0.01;
function fbmSlope(x, y, fbm) {
  const c = fbm2D(x, y, fbm);
  return {
    dzdx: (fbm2D(x + FBM_SLOPE_EPS, y, fbm) - c) / FBM_SLOPE_EPS,
    dzdy: (fbm2D(x, y + FBM_SLOPE_EPS, fbm) - c) / FBM_SLOPE_EPS,
  };
}

// ─── Engine-aware evaluators (world coords) ────────────────────────────
// Both engines speak (x, y) world coords. The sine path converts to
// normalized (u, v) internally; the fbm path uses world coords directly
// so the noise scales naturally with the quad size.
function evalHeightAt(x, y, hb) {
  if (hb.engine === 'fbm') {
    return fbm2D(x, y, hb.fbm);
  }
  const u = (x - X_MIN) / (X_MAX - X_MIN);
  const v = (Y_NEAR - y) / Y_SPAN;
  return waveValue(u, v, hb.waves);
}
function evalLambertAt(x, y, hb, light) {
  let dzdx;
  let dzdy;
  if (hb.engine === 'fbm') {
    ({ dzdx, dzdy } = fbmSlope(x, y, hb.fbm));
  } else {
    const u = (x - X_MIN) / (X_MAX - X_MIN);
    const v = (Y_NEAR - y) / Y_SPAN;
    const { dzdu, dzdv } = waveSlope(u, v, hb.waves);
    dzdx = dzdu * DUDX;
    dzdy = dzdv * DVDY;
  }
  const n = normalize3({ x: -dzdx, y: -dzdy, z: 1 });
  return AMBIENT + LAMBERT_GAIN * Math.max(0, dot3(n, light));
}

// ─── Wave math + Lambert ───────────────────────────────────────────────
function waveValue(u, v, waves) {
  let h = 0;
  const k = 2 * Math.PI;
  for (const w of waves) {
    h += w.amplitude * Math.sin(k * (w.cycles.u * u + w.cycles.v * v) + w.phase);
  }
  return h;
}
function waveSlope(u, v, waves) {
  let dzdu = 0;
  let dzdv = 0;
  const k = 2 * Math.PI;
  for (const w of waves) {
    const c = Math.cos(k * (w.cycles.u * u + w.cycles.v * v) + w.phase);
    dzdu += w.amplitude * k * w.cycles.u * c;
    dzdv += w.amplitude * k * w.cycles.v * c;
  }
  return { dzdu, dzdv };
}
function normalize3(v) {
  const L = Math.hypot(v.x, v.y, v.z);
  return L < 1e-12 ? { x: 0, y: 0, z: 1 } : { x: v.x / L, y: v.y / L, z: v.z / L };
}
function dot3(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function waveLambert(u, v, waves, light) {
  const { dzdu, dzdv } = waveSlope(u, v, waves);
  const n = normalize3({ x: -dzdu * DUDX, y: -dzdv * DVDY, z: 1 });
  return AMBIENT + LAMBERT_GAIN * Math.max(0, dot3(n, light));
}
function flatLambert(normal, light) {
  return AMBIENT + LAMBERT_GAIN * Math.max(0, dot3(normal, light));
}

// ─── Geometry ──────────────────────────────────────────────────────────
function projectWorld(p, camera, roomBasis) {
  const [px, py, depthT] = projectTwoPoint([p.x, p.y, p.z], camera, roomBasis);
  return { x: px, y: py, depthT };
}
function uToX(u) { return X_MIN + (X_MAX - X_MIN) * u; }
function vToY(v) { return Y_NEAR - Y_SPAN * v; }

// ─── Height sampling — heartbeat OR composed elevation field ────────────
// A sampler decouples "what is the ground height/shading at (x,y)" from the
// terrain builder. The heartbeat path keeps the original analytic wave/fbm
// evaluators; the elevation-field path reads a composed `sum` field (from
// fields.js) so an authored terrain-plan renders painterly here, with
// Lambert from central-difference slopes.
function makeSampler(manifest, seed) {
  if (manifest.elevation) {
    const { fields, field } = manifest.elevation;
    const evalF = buildFieldResolver(fields, [])(field);
    const E = 0.15;
    return {
      mode: 'field',
      heightAt: (x, y) => evalF({ x, y, z: 0 }),
      lambertAt: (x, y, light) => {
        const dzdx = (evalF({ x: x + E, y, z: 0 }) - evalF({ x: x - E, y, z: 0 })) / (2 * E);
        const dzdy = (evalF({ x, y: y + E, z: 0 }) - evalF({ x, y: y - E, z: 0 })) / (2 * E);
        const n = normalize3({ x: -dzdx, y: -dzdy, z: 1 });
        return AMBIENT + LAMBERT_GAIN * Math.max(0, dot3(n, light));
      },
      waterLevel: Number.isFinite(manifest.elevation.waterLevel) ? manifest.elevation.waterLevel : undefined,
      samples: manifest.elevation.samples || { u: 80, v: 80 },
    };
  }
  const hb = resolveHeartbeat(manifest.heartbeat, seed, manifest.heartbeatOverrides);
  return {
    mode: 'heartbeat',
    hb,
    heightAt: (x, y) => evalHeightAt(x, y, hb),
    lambertAt: (x, y, light) => evalLambertAt(x, y, hb, light),
    waterLevel: undefined,
    samples: hb.samples,
    defaultLight: hb.defaultLight,
  };
}

// Water surface shading — a flat sheet at the waterline, tinted from
// shallow→deep by how far the terrain sits below it. Reads as a body of
// water filling the basins, distinct from the Lambert-shaded earth.
const WATER_SHALLOW = [120, 170, 200];
const WATER_DEEP = [20, 48, 78];
function waterShade(depth) {
  const t = Math.max(0, Math.min(1, depth / 5));
  const c = lerpRgb(WATER_SHALLOW, WATER_DEEP, t);
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function buildTerrainCells(M, N, sampler, light, palette, camera, roomBasis, haze = null) {
  const wl = sampler.waterLevel;
  const hasWater = Number.isFinite(wl);
  // The displayed surface is max(terrain, waterLevel): terrain everywhere,
  // clamped UP to the waterline inside basins. The water sheet meets land
  // exactly at the shoreline contour, so there are no seams.
  const dispZ = (x, y) => {
    const t = sampler.heightAt(x, y);
    return hasWater && t < wl ? wl : t;
  };
  const grid = [];
  for (let j = 0; j <= N; j += 1) {
    const v = j / N;
    const y = vToY(v);
    const row = [];
    for (let i = 0; i <= M; i += 1) {
      const u = i / M;
      const x = uToX(u);
      const p = projectWorld({ x, y, z: dispZ(x, y) }, camera, roomBasis);
      row.push({ screen: { x: p.x, y: p.y }, depthT: p.depthT });
    }
    grid.push(row);
  }
  const cells = [];
  for (let j = 0; j < N; j += 1) {
    for (let i = 0; i < M; i += 1) {
      const a = grid[j][i];
      const b = grid[j][i + 1];
      const c = grid[j + 1][i + 1];
      const d = grid[j + 1][i];
      const xc = uToX((i + 0.5) / M);
      const yc = vToY((j + 0.5) / N);
      const terrainC = sampler.heightAt(xc, yc);
      const isWater = hasWater && terrainC < wl;
      const cellDepth = (a.depthT + b.depthT + c.depthT + d.depthT) / 4;
      let fill = isWater
        ? waterShade(wl - terrainC)
        : shadeFromLambert(palette, sampler.lambertAt(xc, yc, light));
      // Atmospheric haze: fade toward the horizon by depth so distant ground
      // dissolves into the sky (and water near the horizon reads as a sky
      // reflection). Water hazes a touch harder for a brighter sheen.
      if (haze) {
        const k = isWater ? 1.25 : 1;
        fill = applyHaze(fill, haze.horizon, haze.strength * Math.max(0, Math.min(1, cellDepth)) * k);
        // Moonlight: at night (day < 1) cool + darken the ground toward the
        // night tint so it reads as moonlit, not flatly sunlit.
        if (haze.day < 1) {
          fill = applyHaze(fill, NIGHT_TINT, (1 - haze.day) * 0.6);
        }
      }
      cells.push({
        points: [a.screen, b.screen, c.screen, d.screen],
        avgDepth: cellDepth,
        fill,
      });
    }
  }
  return cells;
}

function buildStructureFaces(structures, hb, light, palette, camera, roomBasis) {
  const out = [];
  for (const s of structures) {
    const xc = (s.x0 + s.x1) / 2;
    const yc = (s.y0 + s.y1) / 2;
    const zBase = evalHeightAt(xc, yc, hb);
    const zTop = zBase + s.height;
    const faceSpecs = [
      // top
      {
        corners: [
          { x: s.x0, y: s.y0, z: zTop },
          { x: s.x1, y: s.y0, z: zTop },
          { x: s.x1, y: s.y1, z: zTop },
          { x: s.x0, y: s.y1, z: zTop },
        ],
        n: { x: 0, y: 0, z: 1 },
      },
      // south (camera-facing)
      {
        corners: [
          { x: s.x0, y: s.y1, z: zBase },
          { x: s.x1, y: s.y1, z: zBase },
          { x: s.x1, y: s.y1, z: zTop },
          { x: s.x0, y: s.y1, z: zTop },
        ],
        n: { x: 0, y: 1, z: 0 },
      },
      // side: west if x_center >= 0, else east (camera-visible side)
      xc >= 0
        ? {
          corners: [
            { x: s.x0, y: s.y0, z: zBase },
            { x: s.x0, y: s.y1, z: zBase },
            { x: s.x0, y: s.y1, z: zTop },
            { x: s.x0, y: s.y0, z: zTop },
          ],
          n: { x: -1, y: 0, z: 0 },
        }
        : {
          corners: [
            { x: s.x1, y: s.y0, z: zBase },
            { x: s.x1, y: s.y1, z: zBase },
            { x: s.x1, y: s.y1, z: zTop },
            { x: s.x1, y: s.y0, z: zTop },
          ],
          n: { x: 1, y: 0, z: 0 },
        },
    ];
    for (const f of faceSpecs) {
      const projected = f.corners.map((p) => projectWorld(p, camera, roomBasis));
      const bri = flatLambert(f.n, light);
      out.push({
        points: projected.map((p) => ({ x: p.x, y: p.y })),
        avgDepth: projected.reduce((sum, p) => sum + p.depthT, 0) / projected.length,
        fill: shadeFromLambert(palette, bri),
      });
    }
  }
  return out;
}

// ─── Scatter billboards ────────────────────────────────────────────────
// Each scene item projects its world base / top / half-width points
// through the same camera (so depth-scale and perspective come free) and
// assembles a screen-space silhouette plus a contact shadow that plants
// it on the ground. Foliage is directionally Lambert-shaded; the shadow
// uses the palette's shadow stop. Items depth-sort into the same polygon
// list as terrain + structures by their base point's depthT.
function buildScatter(items, heightAt, light, palette, camera, roomBasis) {
  const out = [];
  // Directional lit / dark foliage tones + a flat rock tone, derived once.
  const litFill = shadeFromLambert(palette, AMBIENT + LAMBERT_GAIN * 0.72);
  const darkFill = shadeFromLambert(palette, AMBIENT + LAMBERT_GAIN * 0.12);
  const rockFill = shadeFromLambert(palette, AMBIENT + LAMBERT_GAIN * 0.46);
  const shadowFill = `rgb(${palette.shadow[0]},${palette.shadow[1]},${palette.shadow[2]})`;
  for (const item of items) {
    const zBase = heightAt(item.x, item.y);
    const base = projectWorld({ x: item.x, y: item.y, z: zBase }, camera, roomBasis);
    const top = projectWorld({ x: item.x, y: item.y, z: zBase + item.height }, camera, roomBasis);
    const left = projectWorld({ x: item.x - item.width / 2, y: item.y, z: zBase }, camera, roomBasis);
    const right = projectWorld({ x: item.x + item.width / 2, y: item.y, z: zBase }, camera, roomBasis);
    const bx = base.x;
    const by = base.y;
    const ty = top.y;
    const sw = Math.max(Math.abs(right.x - left.x), 1);
    const rise = Math.max(by - ty, 1);
    const depthT = base.depthT;

    // Contact shadow — a flat lens under the base, painted just behind the
    // billboard (depthT + ε) so the silhouette sits on top of it.
    const shW = sw * 0.55;
    const shH = Math.max(sw * 0.12, 0.6);
    out.push({
      points: [
        { x: bx - shW, y: by },
        { x: bx - shW * 0.4, y: by - shH },
        { x: bx + shW * 0.4, y: by - shH },
        { x: bx + shW, y: by },
        { x: bx + shW * 0.4, y: by + shH },
        { x: bx - shW * 0.4, y: by + shH },
      ],
      avgDepth: depthT + 1e-3,
      fill: shadowFill,
    });

    const polys = scatterSilhouette(item.kind, { bx, by, ty, sw, rise });
    for (const poly of polys) {
      out.push({
        points: poly.points,
        avgDepth: depthT,
        fill: poly.tone === 'dark' ? darkFill
          : poly.tone === 'rock' ? rockFill
            : poly.tone === 'shadow' ? shadowFill
              : litFill,
      });
    }
  }
  return out;
}

// Screen-space silhouette for a scatter kind, anchored at base center
// (bx, by) with screen height `rise` and screen width `sw`. Returns
// `[{ points, tone }]` painted back-to-front within the billboard.
function scatterSilhouette(kind, { bx, by, ty, sw, rise }) {
  const halfW = sw / 2;
  if (kind === 'cone') {
    const trunkH = rise * 0.12;
    const trunkHalf = Math.max(sw * 0.06, 0.6);
    const apexY = ty;
    const skirtY = by - trunkH * 0.6;
    return [
      { tone: 'dark', points: [
        { x: bx - trunkHalf, y: by },
        { x: bx + trunkHalf, y: by },
        { x: bx + trunkHalf, y: by - trunkH },
        { x: bx - trunkHalf, y: by - trunkH },
      ] },
      // two-tier fir: a wider lower skirt + a narrower upper tier
      { tone: 'lit', points: [
        { x: bx - halfW, y: skirtY },
        { x: bx + halfW, y: skirtY },
        { x: bx, y: apexY + rise * 0.30 },
      ] },
      { tone: 'lit', points: [
        { x: bx - halfW * 0.66, y: skirtY - rise * 0.28 },
        { x: bx + halfW * 0.66, y: skirtY - rise * 0.28 },
        { x: bx, y: apexY },
      ] },
    ];
  }
  if (kind === 'canopy') {
    const trunkH = rise * 0.34;
    const trunkHalf = Math.max(sw * 0.08, 0.7);
    const cy = by - rise * 0.66;
    const rx = halfW;
    const ry = rise * 0.34;
    const blob = [];
    const N = 10;
    for (let i = 0; i < N; i += 1) {
      const a = (i / N) * Math.PI * 2;
      blob.push({ x: bx + Math.cos(a) * rx, y: cy - Math.sin(a) * ry });
    }
    return [
      { tone: 'dark', points: [
        { x: bx - trunkHalf, y: by },
        { x: bx + trunkHalf, y: by },
        { x: bx + trunkHalf, y: by - trunkH },
        { x: bx - trunkHalf, y: by - trunkH },
      ] },
      { tone: 'lit', points: blob },
    ];
  }
  if (kind === 'boulder') {
    const h = rise; // boulders are already short (small size range)
    return [
      { tone: 'rock', points: [
        { x: bx - halfW, y: by },
        { x: bx - halfW * 0.7, y: by - h * 0.6 },
        { x: bx - halfW * 0.2, y: by - h },
        { x: bx + halfW * 0.25, y: by - h * 0.92 },
        { x: bx + halfW * 0.75, y: by - h * 0.5 },
        { x: bx + halfW, y: by },
      ] },
    ];
  }
  // tuft — a fan of thin blades
  const blades = [];
  const N = 4;
  for (let i = 0; i < N; i += 1) {
    const f = (i / (N - 1)) - 0.5; // -0.5 .. 0.5
    const baseX = bx + f * halfW;
    const tipX = bx + f * halfW * 1.8;
    blades.push({ tone: 'lit', points: [
      { x: baseX - Math.max(sw * 0.05, 0.4), y: by },
      { x: baseX + Math.max(sw * 0.05, 0.4), y: by },
      { x: tipX, y: by - rise },
    ] });
  }
  return blades;
}

function computeViewport(polygons, padScale = 1.0) {
  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
  for (const poly of polygons) {
    for (const p of poly.points) {
      if (p.x < mnx) mnx = p.x;
      if (p.y < mny) mny = p.y;
      if (p.x > mxx) mxx = p.x;
      if (p.y > mxy) mxy = p.y;
    }
  }
  const PAD = 12 * padScale;
  return {
    vbX: Math.floor(mnx - PAD),
    vbY: Math.floor(mny - PAD),
    vbW: Math.ceil((mxx - mnx) + 2 * PAD),
    vbH: Math.ceil((mxy - mny) + 2 * PAD),
  };
}

function emitSvg(polygons, palette, viewBoxOverride, renderStyle = 'painterly', sky = null, clouds = null) {
  polygons.sort((a, b) => b.avgDepth - a.avgDepth);
  const vp = viewBoxOverride && Number.isFinite(viewBoxOverride.width)
    ? { vbX: 0, vbY: 0, vbW: viewBoxOverride.width, vbH: viewBoxOverride.height }
    : computeViewport(polygons);
  const SCALE = 9;
  // Soft background: tween toward highlight from shadow so the scene
  // sits on a non-pure-white field that flatters the palette. For
  // wireframe renders we use the shadow stop directly so the colored
  // strokes pop on a dark field.
  const bgRgb = renderStyle === 'wireframe'
    ? palette.shadow
    : lerpRgb(palette.shadow, palette.highlight, 0.92);
  const bg = `rgb(${bgRgb[0]},${bgRgb[1]},${bgRgb[2]})`;
  const shadowStroke = `rgb(${palette.shadow[0]},${palette.shadow[1]},${palette.shadow[2]})`;
  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vp.vbX} ${vp.vbY} ${vp.vbW} ${vp.vbH}" width="${vp.vbW * SCALE}" height="${vp.vbH * SCALE}">`,
  );
  // Sky backdrop: a vertical zenith→horizon gradient (when enabled and not
  // wireframe), else the flat soft field. The horizon stop sits partway down
  // so the lower band (mostly behind terrain) stays the horizon tone the
  // hazed ground fades into.
  const useSky = sky && renderStyle !== 'wireframe';
  if (useSky) {
    const z = sky.zenith; const h = sky.horizon;
    parts.push(
      `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="rgb(${z[0]},${z[1]},${z[2]})" />` +
      `<stop offset="58%" stop-color="rgb(${h[0]},${h[1]},${h[2]})" />` +
      `<stop offset="100%" stop-color="rgb(${h[0]},${h[1]},${h[2]})" />` +
      `</linearGradient></defs>`,
    );
  }
  parts.push(
    `<rect x="${vp.vbX}" y="${vp.vbY}" width="${vp.vbW}" height="${vp.vbH}" fill="${useSky ? 'url(#sky)' : bg}" />`,
  );
  // Cloud band: painted over the sky backdrop but BEFORE the terrain, so
  // it sits in the distance and near hills occlude it.
  if (useSky && clouds) {
    for (const rect of buildClouds(vp, clouds)) parts.push(rect);
  }
  for (const poly of polygons) {
    const pts = poly.points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
    let fill;
    let stroke;
    let strokeWidth;
    if (renderStyle === 'wireframe') {
      fill = 'none';
      stroke = poly.fill;
      strokeWidth = 0.45;
    } else if (renderStyle === 'topographic') {
      fill = poly.fill;
      stroke = shadowStroke;
      strokeWidth = 0.4;
    } else {
      // painterly (default)
      fill = poly.fill;
      stroke = poly.fill;
      strokeWidth = 0.3;
    }
    parts.push(
      `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`,
    );
  }
  parts.push('</svg>');
  return parts.join('\n');
}

// ─── Top-level render ─────────────────────────────────────────────────

/**
 * Render a painted-landscape manifest to SVG.
 *
 * Manifest shape:
 *   {
 *     kind: 'painted-landscape',
 *     heartbeat: string,        // HEARTBEATS key
 *     splatch:   string,        // SPLATCHES key
 *     structures?: string,      // STRUCTURE_GLYPHS key, or null/undefined
 *     seed?: string,            // any string; same string → same scene
 *     light?: { x, y, z },      // override the heartbeat's defaultLight
 *     paletteOverrides?: {       // optional fine-grained palette tuning
 *       stops?: {                 // replace any subset of stops with hex
 *         shadow?: '#rrggbb', base?: '#rrggbb',
 *         mid?: '#rrggbb', highlight?: '#rrggbb',
 *       },
 *       positions?: [0, p1, p2, 1],  // ramp positions, strictly increasing
 *       gamma?: number,              // brightness curve, >0; 1 = linear
 *     },
 *     heartbeatOverrides?: {     // optional fine-grained geometry tuning
 *       waves?: [{                // per-component scalar multipliers on
 *         ampScale?: number,      //   the heartbeat's parameter ranges
 *         cuScale?: number,       //   (applied BEFORE seeded sampling)
 *         cvScale?: number,
 *       }, ...],
 *       samples?: { u: int, v: int },  // override cell density (>= 2)
 *     },
 *     renderStyle?: 'painterly'   // default — Lambert blocks, no borders
 *                  | 'topographic'  // Lambert blocks WITH dark borders
 *                  | 'wireframe',   // no fill, Lambert-colored strokes
 *     camera?: string,           // CAMERAS card id; default = substrate's
 *                                //   default projection (≈ medium-survey)
 *     sky?: boolean | { hazeStrength? },  // sky is ON BY DEFAULT: a derived
 *                                //   zenith→horizon backdrop + atmospheric
 *                                //   haze (full day→night arc off light.z).
 *                                //   Pass `false` to disable; `{ hazeStrength }`
 *                                //   to tune the depth fade. Wireframe is
 *                                //   always sky-less.
 *     title?: string,           // metadata (passed through by the route)
 *     viewBox?: { width, height }, // optional override
 *   }
 */
export function renderPaintedLandscapeToSvg(manifest) {
  const errors = validatePaintedLandscape(manifest);
  if (errors.length) {
    throw new Error(`Invalid painted-landscape manifest:\n - ${errors.join('\n - ')}`);
  }
  const seed = manifest.seed || 'default';
  const sampler = makeSampler(manifest, seed);
  const palette = derivePalette(manifest.splatch, manifest.paletteOverrides);
  const lightVec = manifest.light || sampler.defaultLight || { x: 0.4, y: 0.6, z: 0.6 };
  const light = normalize3(lightVec);
  // Camera defaults to the substrate's built-in projection when omitted
  // (matches behavior prior to the camera-glyph landing).
  const cameraCard = manifest.camera ? CAMERAS[manifest.camera] : null;
  const camera = cameraCard ? cameraCard.camera : undefined;
  const roomBasis = cameraCard ? cameraCard.roomBasis : undefined;
  const renderStyle = manifest.renderStyle || 'painterly';
  // Sky is ON BY DEFAULT for painted landscapes — a derived zenith→horizon
  // backdrop + atmospheric haze from the splatch palette + light elevation
  // (the full day→night arc). `sky: false` opts out; `sky: { hazeStrength }`
  // tunes the depth fade. Wireframe is intentionally sky-less (pure vector).
  const skyEnabled = manifest.sky !== false && renderStyle !== 'wireframe';
  const sky = skyEnabled ? deriveSky(palette, light) : null;
  const haze = sky
    ? { horizon: sky.horizon, day: sky.day, strength: (manifest.sky && typeof manifest.sky === 'object' && Number.isFinite(manifest.sky.hazeStrength)) ? manifest.sky.hazeStrength : 0.6 }
    : null;
  // Clouds are opt-in via `sky: { clouds }` (clear sky by default).
  const cloudCfg = (sky && manifest.sky && typeof manifest.sky === 'object' && manifest.sky.clouds != null)
    ? normalizeClouds(manifest.sky.clouds, sky, seed)
    : null;
  const terrain = buildTerrainCells(sampler.samples.u, sampler.samples.v, sampler, light, palette, camera, roomBasis, haze);
  // Structures (architectural box/obelisk faces) are heartbeat-mode only.
  const structureFaces = sampler.mode === 'heartbeat'
    ? buildStructureFaces(resolveStructures(manifest.structures, seed), sampler.hb, light, palette, camera, roomBasis)
    : [];
  const sceneItems = resolveScene(manifest.scene, seed);
  const scatter = buildScatter(sceneItems, sampler.heightAt, light, palette, camera, roomBasis);
  return emitSvg([...terrain, ...structureFaces, ...scatter], palette, manifest.viewBox, renderStyle, sky, cloudCfg);
}
