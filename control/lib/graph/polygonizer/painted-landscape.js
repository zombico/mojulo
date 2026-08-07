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
  SKIES as LOADED_SKIES,
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
export const SKIES = LOADED_SKIES;
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
export function skyIds() { return Object.keys(SKIES); }

// Resolve a manifest's `sky` field into a spec the renderer consumes:
//   false            → { disabled: true }
//   '<sky-card-id>'  → the card's { hazeStrength?, clouds? }
//   { ... }          → the inline object, as-is
//   true / undefined → {} (default sky on, no clouds)
export function resolveSkySpec(sky) {
  if (sky === false) return { disabled: true };
  if (typeof sky === 'string') {
    const card = SKIES[sky];
    return card || {};
  }
  if (sky && typeof sky === 'object' && !Array.isArray(sky)) return sky;
  return {};
}

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
    if (typeof s === 'string') {
      if (!SKIES[s]) errors.push(`unknown sky '${s}' (available: ${skyIds().join(', ')})`);
    } else if (typeof s !== 'boolean' && (typeof s !== 'object' || Array.isArray(s))) {
      errors.push('sky must be a sky-card id, a boolean, or a { hazeStrength?, clouds? } object (sky is on by default; pass false to disable)');
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
          if (cl.altitude !== undefined && (typeof cl.altitude !== 'number' || !Number.isFinite(cl.altitude))) {
            errors.push('sky.clouds.altitude must be a number in [0, 1] when provided');
          }
          if (cl.breaks !== undefined && cl.breaks !== null) {
            if (!Array.isArray(cl.breaks)) {
              errors.push('sky.clouds.breaks must be an array of { x, y, radius } clearings');
            } else {
              cl.breaks.forEach((b, i) => {
                if (!b || !Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(b.radius) || b.radius <= 0) {
                  errors.push(`sky.clouds.breaks[${i}]: must be { x, y, radius } with radius > 0 (normalized 0–1)`);
                }
              });
            }
          }
        } else {
          errors.push('sky.clouds must be a coverage number or { coverage, softness?, seed? } object');
        }
      }
      if (s.sun !== undefined && s.sun !== null) {
        const sn = s.sun;
        if (typeof sn !== 'boolean' && (typeof sn !== 'object' || Array.isArray(sn))) {
          errors.push('sky.sun must be a boolean or a { glow?, size?, position? } object');
        } else if (typeof sn === 'object') {
          if (sn.glow !== undefined && (typeof sn.glow !== 'number' || !Number.isFinite(sn.glow) || sn.glow < 0)) errors.push('sky.sun.glow must be a non-negative finite number when provided');
          if (sn.size !== undefined && (typeof sn.size !== 'number' || !Number.isFinite(sn.size) || sn.size < 0)) errors.push('sky.sun.size must be a non-negative finite number when provided');
          if (sn.position !== undefined && (typeof sn.position !== 'object' || sn.position === null || !Number.isFinite(sn.position.x) || !Number.isFinite(sn.position.y))) errors.push('sky.sun.position must be { x, y } (normalized 0–1) when provided');
        }
      }
      if (s.stars !== undefined && s.stars !== null) {
        const st = s.stars;
        if (typeof st === 'number') {
          if (!Number.isFinite(st) || st < 0) errors.push('sky.stars (density) must be a number >= 0');
        } else if (typeof st !== 'boolean') {
          if (typeof st === 'object' && !Array.isArray(st)) {
            if (st.density !== undefined && (typeof st.density !== 'number' || !Number.isFinite(st.density) || st.density < 0)) errors.push('sky.stars.density must be a number >= 0 when provided');
          } else {
            errors.push('sky.stars must be a boolean, a density number, or a { density?, seed? } object');
          }
        }
      }
      if (s.moon !== undefined && s.moon !== null) {
        const mn = s.moon;
        if (typeof mn !== 'boolean' && (typeof mn !== 'object' || Array.isArray(mn))) {
          errors.push('sky.moon must be a boolean or a { phase?, size?, position? } object');
        } else if (typeof mn === 'object') {
          if (mn.phase !== undefined && (typeof mn.phase !== 'number' || !Number.isFinite(mn.phase) || mn.phase < 0 || mn.phase > 1)) errors.push('sky.moon.phase must be a number in [0, 1] when provided');
          if (mn.size !== undefined && (typeof mn.size !== 'number' || !Number.isFinite(mn.size) || mn.size < 0)) errors.push('sky.moon.size must be a non-negative finite number when provided');
          if (mn.paraselene !== undefined && typeof mn.paraselene !== 'boolean') errors.push('sky.moon.paraselene must be a boolean when provided');
          if (mn.position !== undefined && (typeof mn.position !== 'object' || mn.position === null || !Number.isFinite(mn.position.x) || !Number.isFinite(mn.position.y))) errors.push('sky.moon.position must be { x, y } (normalized 0–1) when provided');
        }
      }
      if (s.aurora !== undefined && s.aurora !== null) {
        const au = s.aurora;
        if (typeof au !== 'boolean' && (typeof au !== 'object' || Array.isArray(au))) {
          errors.push('sky.aurora must be a boolean or a { intensity?, hue?, seed? } object');
        } else if (typeof au === 'object') {
          if (au.intensity !== undefined && (typeof au.intensity !== 'number' || !Number.isFinite(au.intensity) || au.intensity < 0)) errors.push('sky.aurora.intensity must be a non-negative finite number when provided');
          if (au.hue !== undefined && (typeof au.hue !== 'number' || !Number.isFinite(au.hue) || au.hue < 0 || au.hue > 1)) errors.push('sky.aurora.hue must be a number in [0, 1] when provided');
        }
      }
      if (s.comet !== undefined && s.comet !== null) {
        const co = s.comet;
        if (typeof co !== 'boolean' && (typeof co !== 'object' || Array.isArray(co))) {
          errors.push('sky.comet must be a boolean or a { length?, size?, direction?, position? } object');
        } else if (typeof co === 'object') {
          if (co.length !== undefined && (typeof co.length !== 'number' || !Number.isFinite(co.length) || co.length < 0)) errors.push('sky.comet.length must be a non-negative finite number when provided');
          if (co.size !== undefined && (typeof co.size !== 'number' || !Number.isFinite(co.size) || co.size < 0)) errors.push('sky.comet.size must be a non-negative finite number when provided');
          if (co.direction !== undefined && (typeof co.direction !== 'number' || !Number.isFinite(co.direction))) errors.push('sky.comet.direction must be a finite number (degrees) when provided');
          if (co.position !== undefined && (typeof co.position !== 'object' || co.position === null || !Number.isFinite(co.position.x) || !Number.isFinite(co.position.y))) errors.push('sky.comet.position must be { x, y } (normalized 0–1) when provided');
        }
      }
      if (s.meteors !== undefined && s.meteors !== null) {
        const me = s.meteors;
        if (typeof me === 'number') {
          if (!Number.isFinite(me) || me < 0) errors.push('sky.meteors (count) must be a number >= 0');
        } else if (typeof me !== 'boolean') {
          if (typeof me === 'object' && !Array.isArray(me)) {
            if (me.count !== undefined && (typeof me.count !== 'number' || !Number.isFinite(me.count) || me.count < 0)) errors.push('sky.meteors.count must be a number >= 0 when provided');
            if (me.radiant !== undefined && (typeof me.radiant !== 'object' || me.radiant === null || !Number.isFinite(me.radiant.x) || !Number.isFinite(me.radiant.y))) errors.push('sky.meteors.radiant must be { x, y } (normalized 0–1) when provided');
          } else {
            errors.push('sky.meteors must be a boolean, a count number, or a { count?, radiant?, seed? } object');
          }
        }
      }
    }
  }
  if (manifest.forest !== undefined && manifest.forest !== null) {
    const f = manifest.forest;
    if (typeof f === 'number') {
      if (!Number.isFinite(f) || f < 0) errors.push('forest (density) must be a number >= 0 (0–1)');
    } else if (typeof f !== 'boolean' && (typeof f !== 'object' || Array.isArray(f))) {
      errors.push('forest must be a boolean, a density number, or a { density?, treeline?, size?, seed?, farThin? } object');
    } else if (typeof f === 'object') {
      if (f.density !== undefined && (typeof f.density !== 'number' || !Number.isFinite(f.density) || f.density < 0)) {
        errors.push('forest.density must be a number >= 0 (0–1) when provided');
      }
      if (f.treeline !== undefined && (typeof f.treeline !== 'number' || !Number.isFinite(f.treeline))) {
        errors.push('forest.treeline must be a number in [0, 1] when provided');
      }
      if (f.farThin !== undefined && (typeof f.farThin !== 'number' || !Number.isFinite(f.farThin) || f.farThin < 0)) {
        errors.push('forest.farThin must be a non-negative number when provided');
      }
      if (f.size !== undefined) {
        if (!Array.isArray(f.size) || f.size.length !== 2
          || typeof f.size[0] !== 'number' || typeof f.size[1] !== 'number'
          || !Number.isFinite(f.size[0]) || !Number.isFinite(f.size[1])
          || f.size[0] <= 0 || f.size[0] > f.size[1]) {
          errors.push('forest.size must be a positive [lo, hi] world-height range with lo <= hi');
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
// Moonlight is ONE fixed quality (cool, silvery) — unlike the sun it doesn't
// warm/cool with elevation. This is the directional highlight moon-facing
// slopes catch, kept separate from the uniform NIGHT_TINT atmosphere.
const MOON_LIGHT = [165, 178, 205];
// Sky shots want headroom, not a tight fit to the lowest waveform tip: place
// the terrain's top silhouette ~this far down the frame and leave the rest open
// sky above. The horizon is pushed DOWN so more sky shows.
const SKY_HORIZON_TARGET = 0.42;
export function deriveSky(palette, light) {
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

  // Screen-space sun position for adornments (the sun disc). Approximate and
  // camera-decoupled in v1: azimuth (light.x) maps left→right, elevation
  // (sunElev) maps horizon→zenith. A below-horizon sun is handled by the
  // adornment gate (no disc at night), so h is simply clamped to the band.
  const clampS01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  return {
    zenith: lerpRgb(NIGHT_ZENITH, dayZenith, day),
    horizon: lerpRgb(nightHorizon, dayHorizon, day),
    day,
    glow,
    sunElev,
    sunPos: { u: clampS01(0.5 + light.x * 0.5), h: clampS01(sunElev) },
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
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const thresh = 1 - Math.min(coverage, 1);
  // altitude: 0 = clouds hug the horizon, 1 = high near the zenith. Drives the
  // band's vertical center AND the puff character (low = fat cumulus, high =
  // thin wisps). null = fill the whole band uniformly (back-compat).
  const altitude = Number.isFinite(obj.altitude) ? clamp01(obj.altitude) : null;
  // breaks: clearings in the sky — the dual of terrain basins, each suppresses
  // the cloud field locally. Normalized over the sky band: x ∈ [0,1] left→right,
  // y ∈ [0,1] horizon→zenith.
  const breaks = Array.isArray(obj.breaks)
    ? obj.breaks
      .filter((b) => b && Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.radius) && b.radius > 0)
      .map((b) => ({ x: clamp01(b.x), y: clamp01(b.y), radius: Math.max(b.radius, 0.02), strength: Number.isFinite(b.strength) ? clamp01(b.strength) : 1 }))
    : [];
  return {
    coverage: Math.min(coverage, 1),
    softness,
    thresh,
    denom: Math.max(1 - thresh, 1e-3),
    litTop,
    shadeBase,
    style: obj.style === 'wisp' ? 'wisp' : 'grid', // 'grid' (pinned default) | 'wisp' (sine blobs)
    volume: Number.isFinite(obj.volume) ? Math.max(0, obj.volume) : 1,
    fade: Number.isFinite(obj.fade) ? Math.max(0, Math.min(1, obj.fade)) : 0.5,
    altitude,
    breaks,
    fbm: { octaves: 5, persistence: 0.55, lacunarity: 2.1, baseScale: 1, amplitude: 1, noiseSeed },
  };
}

// Shared cloud density at a normalized sky point: u ∈ [0,1] (left→right),
// h ∈ [0,1] (horizon→zenith band position). Combines the fBm coverage field,
// the horizon fade, the altitude window, and any break clearings. Returns the
// density d ∈ [0,1] and the raw field value t (for shading). Style-agnostic —
// both grid and wisp sample this.
function sampleCloud(u, h, persp, cfg) {
  const cycles = 7;
  const n = fbm2D((u * cycles) / persp, ((1 - h) * cycles * 0.5) / persp, cfg.fbm);
  const t = (n + 1) / 2;
  let d = smoothstep01((t - cfg.thresh) / cfg.softness);
  d *= smoothstep01(h / 0.1); // fade to nothing at the horizon
  if (cfg.altitude != null) {
    // soft vertical band centered on the altitude (distance from horizon)
    const za = (h - cfg.altitude) / 0.34;
    d *= Math.exp(-(za * za));
  }
  for (const br of cfg.breaks) {
    const dist = Math.hypot(u - br.x, h - br.y);
    d *= 1 - br.strength * (1 - smoothstep01(dist / br.radius));
  }
  return { d, t };
}

// Deterministic [0,1) hash from two ints + the cloud seed (puff jitter/phase).
function cloudHash(a, b, seed) {
  let h = (seed ^ Math.imul(a, 374761393) ^ Math.imul(b, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// EXPERIMENTAL wisp style: scatter sine-lobed soft blobs (polar sine
// silhouette + radial-gradient fade) placed by the coverage field. Renders
// smoother than the grid because each puff feathers via a vector gradient.
function buildCloudsWisp(vp, cfg) {
  const { horizonY, bandTop } = skyBand(vp);
  const NX = 30;
  const NY = 9;
  const cw = vp.vbW / NX;
  const chh = (horizonY - bandTop) / NY;
  if (cw <= 0 || chh <= 0) return [];
  const seed = cfg.fbm.noiseSeed;
  // Altitude shapes the puffs: low (near horizon) → fat, solid cumulus; high
  // (near zenith) → smaller, wispier. Distance from the horizon tells the read.
  const alt = cfg.altitude != null ? cfg.altitude : 0.5;
  const effVolume = cfg.volume * (1.25 - 0.5 * alt);
  const effFade = Math.min(1, cfg.fade + 0.35 * alt);
  const K = [2, 3, 5];
  const SAMP = 36;
  const out = [];
  let gid = 0;
  for (let j = 0; j < NY; j += 1) {
    const sy = bandTop + (j + 0.5) * chh;
    const h = Math.max(0, Math.min(1, (horizonY - sy) / (horizonY - bandTop)));
    const persp = 0.3 + 0.7 * h;
    for (let i = 0; i < NX; i += 1) {
      const u = (i + 0.5) / NX;
      const { d, t } = sampleCloud(u, h, persp, cfg);
      if (d <= 0.06) continue;
      const cx = vp.vbX + (i + 0.5) * cw + (cloudHash(i, j, seed) - 0.5) * cw * 0.8;
      const cy = sy + (cloudHash(i * 7 + 1, j * 3 + 2, seed) - 0.5) * chh * 0.8;
      const lit = Math.max(0, Math.min(1, (t - cfg.thresh) / cfg.denom));
      const R = chh * (0.9 + 1.9 * d) * (0.7 + 0.5 * h) * (0.7 + 0.5 * effVolume);
      const baseA = 0.16 * effVolume;
      const amps = [baseA, baseA * 0.7, baseA * 0.5];
      const ph = [cloudHash(i, j, seed) * 6.283, cloudHash(i + 3, j, seed) * 6.283, cloudHash(i, j + 3, seed) * 6.283];
      const pts = [];
      for (let s = 0; s < SAMP; s += 1) {
        const th = (s / SAMP) * Math.PI * 2;
        let rr = 1;
        for (let m = 0; m < K.length; m += 1) rr += amps[m] * Math.sin(K[m] * th + ph[m]);
        const px = cx + Math.cos(th) * R * 1.5 * rr;  // squashed wide
        const py = cy + Math.sin(th) * R * 0.78 * rr;
        pts.push(`${px.toFixed(2)},${py.toFixed(2)}`);
      }
      const litC = lerpRgb(cfg.shadeBase, cfg.litTop, lit);
      const baseC = cfg.shadeBase;
      const peak = Math.min(Math.min(d, 1) * effVolume * 0.7, 0.9);
      const midStop = (42 + effFade * 32).toFixed(0);
      out.push(
        `<radialGradient id="cw${gid}" cx="50%" cy="40%" r="62%">`
        + `<stop offset="0%" stop-color="rgb(${litC[0]},${litC[1]},${litC[2]})" stop-opacity="${peak.toFixed(3)}"/>`
        + `<stop offset="${midStop}%" stop-color="rgb(${baseC[0]},${baseC[1]},${baseC[2]})" stop-opacity="${(peak * 0.4).toFixed(3)}"/>`
        + `<stop offset="100%" stop-color="rgb(${baseC[0]},${baseC[1]},${baseC[2]})" stop-opacity="0"/>`
        + `</radialGradient>`
        + `<polygon points="${pts.join(' ')}" fill="url(#cw${gid})"/>`,
      );
      gid += 1;
    }
  }
  return out;
}

// Emit the cloud band as a grid of soft-opacity cells over the upper sky.
// The noise is sampled in a horizon-compressed space so clouds bunch and
// shrink toward the horizon (perspective), and density fades to nothing at
// the horizon line so there is no hard band.
function buildClouds(vp, cfg) {
  if (cfg.style === 'wisp') return buildCloudsWisp(vp, cfg);
  const { horizonY, bandTop } = skyBand(vp);
  const NX = 88;
  const NY = 30;
  const cw = vp.vbW / NX;
  const chh = (horizonY - bandTop) / NY;
  if (cw <= 0 || chh <= 0) return [];
  const rects = [];
  for (let j = 0; j < NY; j += 1) {
    const sy = bandTop + (j + 0.5) * chh;
    const h = Math.max(0, Math.min(1, (horizonY - sy) / (horizonY - bandTop)));
    const persp = 0.3 + 0.7 * h;
    for (let i = 0; i < NX; i += 1) {
      const u = (i + 0.5) / NX;
      const { d, t } = sampleCloud(u, h, persp, cfg);
      if (d <= 0.02) continue;
      const lit = Math.max(0, Math.min(1, (t - cfg.thresh) / cfg.denom));
      const c = lerpRgb(cfg.shadeBase, cfg.litTop, lit);
      rects.push(
        `<rect x="${(vp.vbX + i * cw).toFixed(2)}" y="${(bandTop + j * chh).toFixed(2)}" width="${(cw + 0.6).toFixed(2)}" height="${(chh + 0.6).toFixed(2)}" fill="rgb(${c[0]},${c[1]},${c[2]})" fill-opacity="${(Math.min(d, 1) * 0.95).toFixed(3)}" />`,
      );
    }
  }
  return rects;
}

// ─── Sky adornments — sun disc, stars, moon (opt-in, ride the same arc) ───
// Celestial marks that share the sky band with clouds. Like clouds they are
// screen-space (never geometry) and ride the day→night arc off `light.z`: the
// sun disc shows by day and is gated off below the horizon; stars and the moon
// fade in as the sun sets. All scatter is deterministic via cloudHash — no
// Date/random. They paint BEHIND clouds so cloud cover occludes them (a sun
// behind a break reads as god-rays). Authored as sibling keys of sky.clouds:
// `sky: { sun, stars, moon }`.
// The sky band: where clouds and adornments live, from the land/sky horizon up
// past the top of the frame. `vp.horizonY` is the ACTUAL terrain silhouette top
// (set by emitSvg once headroom is added); the 0.6 fallback only applies to
// callers that never set it (e.g. a fixed viewBox override).
function skyBand(vp) {
  const horizonY = Number.isFinite(vp.horizonY) ? vp.horizonY : vp.vbY + vp.vbH * 0.6;
  const bandTop = vp.vbY - vp.vbH * 0.03;
  return { horizonY, bandTop, span: horizonY - bandTop };
}
const clampSky01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Sample the backdrop gradient (zenith→horizon, flat horizon past 58%; see
// emitSvg) at a viewport y. Lets an adornment's mask match the sky EXACTLY
// behind it — so a crescent's dark limb dissolves into the backdrop instead
// of reading as an off-color disc.
function skyColorAtY(sky, vp, y) {
  const frac = vp.vbH > 0 ? (y - vp.vbY) / vp.vbH : 0;
  return lerpRgb(sky.zenith, sky.horizon, clampSky01(frac / 0.58));
}

// Sun: a warm luminary disc + radial halo at the projected sun position.
// Gated to suns at/above the horizon (no disc at night — stars/moon take over).
function normalizeSun(sun, sky) {
  if (sun === false || sun == null) return null;
  if (sky.sunElev <= -0.05) return null; // below the horizon → no disc
  const obj = (sun && typeof sun === 'object') ? sun : {};
  const pos = obj.position && Number.isFinite(obj.position.x) && Number.isFinite(obj.position.y)
    ? { u: clampSky01(obj.position.x), h: clampSky01(obj.position.y) }
    : sky.sunPos;
  return {
    glow: Number.isFinite(obj.glow) ? Math.max(0, obj.glow) : 1,
    size: Number.isFinite(obj.size) ? Math.max(0, obj.size) : 1,
    u: pos.u,
    h: pos.h,
  };
}

function buildSunDisc(vp, sky, cfg) {
  const { horizonY, span } = skyBand(vp);
  const cx = vp.vbX + cfg.u * vp.vbW;
  const cy = horizonY - cfg.h * span;
  const R = vp.vbW * 0.035 * cfg.size;
  if (R <= 0) return [];
  // Warmer toward the horizon (low sun = sunset orange), bright white high up.
  const warmth = clampSky01(1 - sky.sunElev / 0.5);
  const core = lerpRgb([255, 252, 240], [255, 208, 150], warmth * 0.75);
  const halo = lerpRgb(sky.horizon, core, 0.62);
  const haloR = R * (3.0 + 2.2 * cfg.glow);
  const discA = clampSky01(0.55 + 0.45 * sky.day);
  const haloA = clampSky01(0.35 + 0.35 * cfg.glow) * (0.4 + 0.6 * sky.day);
  return [
    `<radialGradient id="sun-halo" cx="50%" cy="50%" r="50%">`
    + `<stop offset="0%" stop-color="rgb(${core[0]},${core[1]},${core[2]})" stop-opacity="${haloA.toFixed(3)}"/>`
    + `<stop offset="32%" stop-color="rgb(${halo[0]},${halo[1]},${halo[2]})" stop-opacity="${(haloA * 0.5).toFixed(3)}"/>`
    + `<stop offset="100%" stop-color="rgb(${halo[0]},${halo[1]},${halo[2]})" stop-opacity="0"/>`
    + `</radialGradient>`,
    `<circle class="adornment-sun" cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${haloR.toFixed(2)}" fill="url(#sun-halo)"/>`,
    `<circle class="adornment-sun" cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${R.toFixed(2)}" fill="rgb(${core[0]},${core[1]},${core[2]})" fill-opacity="${discA.toFixed(3)}"/>`,
  ];
}

// Stars: night-gated scatter of faint dots in the upper sky band. Density is
// one knob; positions + per-star twinkle are deterministic (cloudHash).
function normalizeStars(stars, sky, seed) {
  if (stars === false || stars == null) return null;
  const nightFactor = 1 - sky.day;
  if (nightFactor <= 0.04) return null; // daytime → no stars
  const obj = (stars && typeof stars === 'object') ? stars : {};
  const density = typeof stars === 'number'
    ? stars
    : Number.isFinite(obj.density) ? obj.density : 0.6;
  if (!Number.isFinite(density) || density <= 0) return null;
  const seedStr = obj.seed != null ? String(obj.seed) : `${seed}::stars`;
  return { density: Math.max(0, density), nightFactor, seed: xmur3(seedStr)() };
}

function buildStars(vp, sky, cfg) {
  const { horizonY, span } = skyBand(vp);
  const N = Math.round(cfg.density * 150);
  if (N <= 0) return [];
  const out = [];
  for (let i = 0; i < N; i += 1) {
    const u = cloudHash(i, 11, cfg.seed);
    // bias upward (denser toward the zenith), keep clear of the hazy horizon
    const h = 0.22 + 0.74 * cloudHash(i, 23, cfg.seed);
    const cx = vp.vbX + u * vp.vbW;
    const cy = horizonY - h * span;
    const r = vp.vbW * (0.0012 + 0.0024 * cloudHash(i, 31, cfg.seed));
    const a = cfg.nightFactor * (0.35 + 0.6 * cloudHash(i, 41, cfg.seed));
    out.push(`<circle class="adornment-star" cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}" fill="rgb(236,240,255)" fill-opacity="${a.toFixed(3)}"/>`);
  }
  return out;
}

// Moon: night-gated pale disc + soft halo. `phase` (1 full → 0 new) carves a
// crescent by clipping a sky-colored shadow disc to the moon.
function normalizeMoon(moon, sky) {
  if (moon === false || moon == null) return null;
  const nightFactor = 1 - sky.day;
  if (nightFactor <= 0.04) return null;
  const obj = (moon && typeof moon === 'object') ? moon : {};
  const pos = obj.position && Number.isFinite(obj.position.x) && Number.isFinite(obj.position.y)
    ? { u: clampSky01(obj.position.x), h: clampSky01(obj.position.y) }
    : { u: clampSky01(1 - sky.sunPos.u), h: 0.78 };
  return {
    phase: Number.isFinite(obj.phase) ? clampSky01(obj.phase) : 1,
    size: Number.isFinite(obj.size) ? Math.max(0, obj.size) : 1,
    paraselene: !!obj.paraselene,
    blend: !!obj.blend,
    nightFactor,
    u: pos.u,
    h: pos.h,
  };
}

function buildMoon(vp, sky, cfg) {
  const { horizonY, span } = skyBand(vp);
  const cx = vp.vbX + cfg.u * vp.vbW;
  const R = vp.vbW * 0.026 * cfg.size;
  if (R <= 0) return [];
  const haloR = R * 2.6;
  // Keep the full halo below the top edge so the glow reads as a clean circle,
  // never a clipped bulge (the band's top sits above the viewport).
  const cy = Math.max(horizonY - cfg.h * span, vp.vbY + haloR);
  const moonC = [226, 229, 240];
  const halo = lerpRgb(sky.zenith, moonC, 0.4);
  const haloA = clampSky01(0.18 + 0.22 * cfg.nightFactor);
  const out = [];
  // Paraselene (moon dogs): a faint 22°-style halo RING with two bright mock
  // moons at the 3- and 9-o'clock positions. Drawn first so the moon sits over
  // it. Ice-crystal optics — pale, low-opacity, scaled by how deep the night.
  if (cfg.paraselene) {
    const ringR = R * 5.2;
    const ringC = lerpRgb(skyColorAtY(sky, vp, cy), [225, 230, 245], 0.6);
    const rc = `rgb(${ringC[0]},${ringC[1]},${ringC[2]})`;
    out.push(`<circle class="adornment-moon" cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${ringR.toFixed(2)}" fill="none" stroke="${rc}" stroke-opacity="${(0.13 * cfg.nightFactor).toFixed(3)}" stroke-width="${(R * 0.22).toFixed(2)}"/>`);
    for (const s of [-1, 1]) {
      const px = cx + s * ringR;
      const gid = s < 0 ? 'paraselene-l' : 'paraselene-r';
      out.push(
        `<radialGradient id="${gid}" cx="50%" cy="50%" r="50%">`
        + `<stop offset="0%" stop-color="${rc}" stop-opacity="${(0.55 * cfg.nightFactor).toFixed(3)}"/>`
        + `<stop offset="100%" stop-color="${rc}" stop-opacity="0"/>`
        + `</radialGradient>`
        + `<circle class="adornment-moon" cx="${px.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(R * 1.7).toFixed(2)}" fill="url(#${gid})"/>`,
      );
    }
  }
  const crescent = cfg.phase < 0.985;
  const mc = `rgb(${moonC[0]},${moonC[1]},${moonC[2]})`;
  const discA = clampSky01(0.7 + 0.3 * cfg.nightFactor);
  const dx = R * 2 * (1 - cfg.phase);   // shadow offset; 0 = full moon
  // Halo. Scaled DOWN as the moon thins (a thin crescent has almost no halo, so
  // it can't ring the invisible dark limb) and nudged toward the lit side so
  // what glow remains hugs the crescent. The lit side is −x (the shadow rides +x).
  const hA = haloA * cfg.phase;
  const hcx = cx - dx * 0.5;
  if (hA > 0.012) {
    out.push(
      `<radialGradient id="moon-halo" cx="50%" cy="50%" r="50%">`
      + `<stop offset="0%" stop-color="rgb(${halo[0]},${halo[1]},${halo[2]})" stop-opacity="${hA.toFixed(3)}"/>`
      + `<stop offset="100%" stop-color="rgb(${halo[0]},${halo[1]},${halo[2]})" stop-opacity="0"/>`
      + `</radialGradient>`,
      `<circle class="adornment-moon" cx="${hcx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${haloR.toFixed(2)}" fill="url(#moon-halo)"/>`,
    );
  }
  // Moon body. `blend` makes it a soft radial-gradient glow that dissolves into
  // the sky instead of a sharp disc; otherwise a crisp flat disc.
  const bodyR = cfg.blend ? R * 1.25 : R;
  let bodyFill; let bodyOpacity = '';
  if (cfg.blend) {
    out.push(
      `<radialGradient id="moon-body" cx="50%" cy="50%" r="50%">`
      + `<stop offset="0%" stop-color="${mc}" stop-opacity="${discA.toFixed(3)}"/>`
      + `<stop offset="52%" stop-color="${mc}" stop-opacity="${discA.toFixed(3)}"/>`
      + `<stop offset="100%" stop-color="${mc}" stop-opacity="0"/>`
      + `</radialGradient>`,
    );
    bodyFill = 'url(#moon-body)';
  } else {
    bodyFill = mc;
    bodyOpacity = ` fill-opacity="${discA.toFixed(3)}"`;
  }
  if (crescent) {
    // Mask the body to the LIT sliver only (moon disc minus the offset shadow
    // disc). The dark part is never painted, so it shows the sky/aurora behind
    // it — invisible, no dark disc, no ringing edge.
    out.push(
      `<mask id="moon-lit" maskUnits="userSpaceOnUse" x="${(cx - bodyR).toFixed(2)}" y="${(cy - bodyR).toFixed(2)}" width="${(2 * bodyR).toFixed(2)}" height="${(2 * bodyR).toFixed(2)}">`
      + `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${bodyR.toFixed(2)}" fill="white"/>`
      + `<circle cx="${(cx + dx).toFixed(2)}" cy="${cy.toFixed(2)}" r="${R.toFixed(2)}" fill="black"/>`
      + `</mask>`
      + `<circle class="adornment-moon" cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${bodyR.toFixed(2)}" fill="${bodyFill}"${bodyOpacity} mask="url(#moon-lit)"/>`,
    );
  } else {
    out.push(`<circle class="adornment-moon" cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${bodyR.toFixed(2)}" fill="${bodyFill}"${bodyOpacity}/>`);
  }
  return out;
}

// Aurora: night-gated luminous curtains — undulating vertical ribbons in the
// upper sky, brighter along their lower edge, green by default. `hue` shifts
// the band green↔magenta. Screen-space, deterministic (cloudHash phases).
function normalizeAurora(aurora, sky, seed) {
  if (aurora === false || aurora == null) return null;
  const nightFactor = 1 - sky.day;
  if (nightFactor <= 0.04) return null;
  const obj = (aurora && typeof aurora === 'object') ? aurora : {};
  return {
    intensity: Number.isFinite(obj.intensity) ? Math.max(0, obj.intensity) : 1,
    hue: Number.isFinite(obj.hue) ? clampSky01(obj.hue) : 0,
    nightFactor,
    seed: xmur3(obj.seed != null ? String(obj.seed) : `${seed}::aurora`)(),
  };
}

function buildAurora(vp, sky, cfg) {
  // Aurora = a waveform that crosses the sky (a sine band), sitting relatively
  // LOW — positioned above the ground waveform's horizon — and EMITTING its
  // radiation UPWARD: a bright sharp foot along the sine, with the glow
  // streaming up toward the zenith and fading to nothing (not a blanket draping
  // down). Up to two curtains per scene. Everything is wrapped in ONE group
  // whose opacity caps the SUMMED result — real aurora is translucent (stars
  // read through it), so the brightest overlap tops out around a third, never
  // opaque. Group opacity flattens the stack THEN scales it: "sum ≤ cap".
  const { horizonY, bandTop } = skyBand(vp);
  const skyTop = bandTop + (horizonY - bandTop) * 0.02;
  const skyH = horizonY - skyTop;
  if (skyH <= 0) return [];
  const bands = Math.min(2, Math.max(1, Math.round(1 + cfg.intensity)));  // 2 waves max per scene
  const SAMP = 44;        // horizontal samples along the sine
  const STEPS = 3;        // feather layers for the bright foot
  const inner = [];
  for (let b = 0; b < bands; b += 1) {
    // base waveform sits in the lower-mid sky so there is room to radiate up
    const baseY = skyTop + (0.5 + 0.32 * cloudHash(b, 11, cfg.seed)) * skyH;
    const amp = skyH * (0.04 + 0.08 * cloudHash(b, 12, cfg.seed));
    const k = 1 + 2 * cloudHash(b, 13, cfg.seed);             // cycles across the width
    const ph = cloudHash(b, 14, cfg.seed) * 6.283;
    const emit = skyH * (0.32 + 0.26 * cloudHash(b, 15, cfg.seed)); // how high the glow rises
    const foot = skyH * (0.02 + 0.025 * cloudHash(b, 18, cfg.seed)); // narrow bright foot
    const hb = clampSky01(cfg.hue + (cloudHash(b, 16, cfg.seed) - 0.5) * 0.22);
    const col = lerpRgb([72, 232, 150], [196, 96, 232], hb);  // green → magenta
    const fill = `rgb(${col[0]},${col[1]},${col[2]})`;
    // sine centerline + an end-taper that pinches the curtain out at the edges
    const center = [];
    for (let s = 0; s <= SAMP; s += 1) {
      const xN = s / SAMP;
      center.push({
        x: vp.vbX + xN * vp.vbW,
        y: baseY + Math.sin(k * xN * 2 * Math.PI + ph) * amp,
        edge: Math.pow(Math.sin(Math.PI * xN), 0.6), // 0 at ends → 1 mid
      });
    }
    // Upward radiation: a band from the sine foot up by `emit`, gradient bright
    // at the base → transparent at the top (emits UP toward the zenith).
    const baseEdge = center.map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`);
    const topEdge = [];
    for (let s = center.length - 1; s >= 0; s -= 1) {
      const c = center[s];
      topEdge.push(`${c.x.toFixed(2)},${(c.y - emit * c.edge).toFixed(2)}`);
    }
    inner.push(
      `<linearGradient id="aurora-emit${b}" x1="0" y1="${(baseY - amp - emit).toFixed(2)}" x2="0" y2="${(baseY + amp).toFixed(2)}" gradientUnits="userSpaceOnUse">`
      + `<stop offset="0%" stop-color="${fill}" stop-opacity="0"/>`        // top: faded out
      + `<stop offset="100%" stop-color="${fill}" stop-opacity="0.5"/>`    // base: bright
      + `</linearGradient>`
      + `<polygon class="adornment-aurora" points="${baseEdge.join(' ')} ${topEdge.join(' ')}" fill="url(#aurora-emit${b})"/>`,
    );
    // bright sharp foot on the sine base — feathered so its edge stays soft
    for (let i = 0; i < STEPS; i += 1) {
      const f = 1 - i / STEPS;
      const a = ((i + 1) / STEPS) * 0.8;
      const ft = []; const fb = [];
      for (const c of center) {
        const hw = foot * f * 0.5 * c.edge;
        ft.push(`${c.x.toFixed(2)},${(c.y - hw).toFixed(2)}`);
        fb.push(`${c.x.toFixed(2)},${(c.y + hw).toFixed(2)}`);
      }
      inner.push(`<polygon class="adornment-aurora" points="${ft.concat(fb.reverse()).join(' ')}" fill="${fill}" fill-opacity="${a.toFixed(3)}"/>`);
    }
  }
  // Cap the SUMMED opacity: ~0.33 at intensity 1 (a translucent veil), pushed
  // toward 0.5 for a strong display, scaled by how deep the night.
  const cap = Math.min(0.5, 0.33 * cfg.intensity) * cfg.nightFactor;
  return [`<g class="adornment-aurora" opacity="${cap.toFixed(3)}">${inner.join('')}</g>`];
}

// Comet: night-gated bright nucleus + coma glow + a tapered tail that points
// ANTI-SUNWARD (away from the sun, like a real ion/dust tail). `direction`
// (degrees) overrides the derived anti-sun heading.
function normalizeComet(comet, sky) {
  if (comet === false || comet == null) return null;
  const nightFactor = 1 - sky.day;
  if (nightFactor <= 0.04) return null;
  const obj = (comet && typeof comet === 'object') ? comet : {};
  const pos = obj.position && Number.isFinite(obj.position.x) && Number.isFinite(obj.position.y)
    ? { u: clampSky01(obj.position.x), h: clampSky01(obj.position.y) }
    : { u: 0.72, h: 0.82 };
  return {
    length: Number.isFinite(obj.length) ? Math.max(0, obj.length) : 1,
    size: Number.isFinite(obj.size) ? Math.max(0, obj.size) : 1,
    direction: Number.isFinite(obj.direction) ? obj.direction : null,
    nightFactor,
    u: pos.u, h: pos.h,
  };
}

function buildComet(vp, sky, cfg) {
  const { horizonY, span } = skyBand(vp);
  const cx = vp.vbX + cfg.u * vp.vbW;
  const cy = horizonY - cfg.h * span;
  const R = vp.vbW * 0.012 * cfg.size;
  if (R <= 0) return [];
  let dx; let dy;
  if (cfg.direction != null) {
    const a = (cfg.direction * Math.PI) / 180;
    dx = Math.cos(a); dy = Math.sin(a);
  } else {
    const sx = vp.vbX + sky.sunPos.u * vp.vbW;
    const sy = horizonY - sky.sunPos.h * span;
    dx = cx - sx; dy = cy - sy;
    const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
  }
  const len = vp.vbW * 0.16 * cfg.length;
  const wnd = R * 2.2;       // tail base half-width at the nucleus
  const px = -dy; const py = dx;
  const tipx = cx + dx * len; const tipy = cy + dy * len;
  const a = `${(cx + px * wnd).toFixed(2)},${(cy + py * wnd).toFixed(2)}`;
  const b = `${(cx - px * wnd).toFixed(2)},${(cy - py * wnd).toFixed(2)}`;
  const tail = `${tipx.toFixed(2)},${tipy.toFixed(2)}`;
  const headC = [235, 244, 255];
  const tailC = lerpRgb(sky.zenith, headC, 0.5);
  const aHead = clampSky01(0.5 + 0.4 * cfg.nightFactor);
  return [
    `<linearGradient id="comet-tail" x1="${cx.toFixed(2)}" y1="${cy.toFixed(2)}" x2="${tipx.toFixed(2)}" y2="${tipy.toFixed(2)}" gradientUnits="userSpaceOnUse">`
    + `<stop offset="0%" stop-color="rgb(${tailC[0]},${tailC[1]},${tailC[2]})" stop-opacity="${(0.5 * cfg.nightFactor).toFixed(3)}"/>`
    + `<stop offset="100%" stop-color="rgb(${tailC[0]},${tailC[1]},${tailC[2]})" stop-opacity="0"/>`
    + `</linearGradient>`
    + `<polygon class="adornment-comet" points="${a} ${b} ${tail}" fill="url(#comet-tail)"/>`,
    `<radialGradient id="comet-coma" cx="50%" cy="50%" r="50%">`
    + `<stop offset="0%" stop-color="rgb(${headC[0]},${headC[1]},${headC[2]})" stop-opacity="${aHead.toFixed(3)}"/>`
    + `<stop offset="100%" stop-color="rgb(${headC[0]},${headC[1]},${headC[2]})" stop-opacity="0"/>`
    + `</radialGradient>`
    + `<circle class="adornment-comet" cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${(R * 3).toFixed(2)}" fill="url(#comet-coma)"/>`,
    `<circle class="adornment-comet" cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${R.toFixed(2)}" fill="rgb(${headC[0]},${headC[1]},${headC[2]})" fill-opacity="${aHead.toFixed(3)}"/>`,
  ];
}

// Meteor shower: night-gated streaks radiating from a radiant point. Each is a
// short line, bright head → transparent tail (toward the radiant), scattered
// deterministically. `count` (or a bare number) sets how many.
function normalizeMeteors(meteors, sky, seed) {
  if (meteors === false || meteors == null) return null;
  const nightFactor = 1 - sky.day;
  if (nightFactor <= 0.04) return null;
  const obj = (meteors && typeof meteors === 'object') ? meteors : {};
  const count = typeof meteors === 'number' ? meteors : (Number.isFinite(obj.count) ? obj.count : 12);
  if (!Number.isFinite(count) || count <= 0) return null;
  const radiant = obj.radiant && Number.isFinite(obj.radiant.x) && Number.isFinite(obj.radiant.y)
    ? { u: clampSky01(obj.radiant.x), h: clampSky01(obj.radiant.y) }
    : { u: 0.5, h: 0.92 };
  return {
    count: Math.min(Math.round(count), 200),
    radiant, nightFactor,
    seed: xmur3(obj.seed != null ? String(obj.seed) : `${seed}::meteors`)(),
  };
}

function buildMeteors(vp, sky, cfg) {
  const { horizonY, span } = skyBand(vp);
  const rx = vp.vbX + cfg.radiant.u * vp.vbW;
  const ry = horizonY - cfg.radiant.h * span;
  const out = [];
  for (let i = 0; i < cfg.count; i += 1) {
    const u = cloudHash(i, 51, cfg.seed);
    const h = 0.35 + 0.6 * cloudHash(i, 53, cfg.seed);
    const hx = vp.vbX + u * vp.vbW;
    const hy = horizonY - h * span;
    let dx = hx - rx; let dy = hy - ry;
    const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
    const len = vp.vbW * (0.025 + 0.05 * cloudHash(i, 55, cfg.seed));
    const tx = hx - dx * len; const ty = hy - dy * len; // tail back toward radiant
    const a = cfg.nightFactor * (0.5 + 0.5 * cloudHash(i, 57, cfg.seed));
    out.push(
      `<linearGradient id="meteor${i}" x1="${hx.toFixed(2)}" y1="${hy.toFixed(2)}" x2="${tx.toFixed(2)}" y2="${ty.toFixed(2)}" gradientUnits="userSpaceOnUse">`
      + `<stop offset="0%" stop-color="rgb(240,246,255)" stop-opacity="${a.toFixed(3)}"/>`
      + `<stop offset="100%" stop-color="rgb(240,246,255)" stop-opacity="0"/>`
      + `</linearGradient>`
      + `<line class="adornment-meteor" x1="${hx.toFixed(2)}" y1="${hy.toFixed(2)}" x2="${tx.toFixed(2)}" y2="${ty.toFixed(2)}" stroke="url(#meteor${i})" stroke-width="${(vp.vbW * 0.0016).toFixed(2)}" stroke-linecap="round"/>`,
    );
  }
  return out;
}

// ─── Sky-adornment primitives — the registry ───────────────────────────
// Each celestial / atmospheric adornment is a PRIMITIVE: a `normalize → build`
// pair plus its paint order. The renderer is data-driven off this list — both
// the per-scene config (renderPaintedLandscapeToSvg) and the painter (emitSvg)
// iterate it, so adding a primitive is ONE entry, not edits to three sites.
//
//   normalize(skySpec[id], sky, seed) → cfg | null   (null = absent/gated off)
//   build(vp, sky, cfg)               → SVG string[]
//
// `order` is the paint sequence, far → near (smaller paints first / farther).
// All adornments paint behind the clouds and terrain. The moon's lunar lighting
// hint is a coupled terrain-shading effect derived from the moon cfg, not an
// overlay, so it lives in the shading path rather than here.
const SKY_PRIMITIVES = [
  { id: 'stars', order: 10, normalize: normalizeStars, build: buildStars },
  { id: 'comet', order: 20, normalize: normalizeComet, build: buildComet },
  { id: 'moon', order: 30, normalize: normalizeMoon, build: buildMoon },
  { id: 'sun', order: 40, normalize: normalizeSun, build: buildSunDisc },
  { id: 'aurora', order: 50, normalize: normalizeAurora, build: buildAurora },
  { id: 'meteors', order: 60, normalize: normalizeMeteors, build: buildMeteors },
].sort((a, b) => a.order - b.order);

// The adornment ids, in paint order — handy for tests and tooling.
export function skyPrimitiveIds() { return SKY_PRIMITIVES.map((p) => p.id); }

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
        // night tint so it reads as moonlit, not flatly sunlit. (Atmosphere —
        // uniform, not directional.)
        if (haze.day < 1) {
          fill = applyHaze(fill, NIGHT_TINT, (1 - haze.day) * 0.6);
          // Lunar lighting hint: ONE fixed cool quality cast from the moon's
          // direction — only slopes facing the moon catch the silver, lifting
          // them back out of the flat night tint. Land only (water reflection
          // would be a separate effect). Kept distinct from the atmosphere.
          if (haze.moon && !isWater) {
            const lunarTerm = Math.max(0, (sampler.lambertAt(xc, yc, haze.moon.dir) - AMBIENT) / LAMBERT_GAIN);
            fill = applyHaze(fill, MOON_LIGHT, haze.moon.strength * lunarTerm);
          }
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

// ─── Forest — a generative tree layer placed by a density map ──────────
// The ground-plane twin of clouds. Clouds threshold an fBm field in the sky
// band; the forest thresholds one over the ground quad and drops a tree
// wherever it crosses `density`. Each tree rides the terrain (heightAt) and,
// if `treeline` is set, is culled above that altitude — a snowline that
// falls out of the same height map for free. Crowns are NOT authored
// silhouettes: each is a distributed cluster of midpoint-displaced fractal
// blobs (no branches, no leaves — ragged 1/f clumps) layered over each other
// with drop shadows. Clump count and subdivision are budgeted by each tree's
// depthT, so a dense forest can't explode the polygon count: near trees get
// more, finer clumps; far trees collapse toward a couple of coarse ones.

// Normalize the `forest` manifest field into a render config, or null when
// disabled. Accepts `true` (density 0.5), a bare density number, or a
// `{ density, treeline?, size?, seed?, farThin? }` object. Mirrors
// normalizeClouds: one coverage-style knob drives a thresholded fBm field.
function normalizeForest(forest, seed) {
  if (forest == null || forest === false) return null;
  const density = forest === true ? 0.5
    : typeof forest === 'number' ? forest
      : Number(forest && forest.density);
  const d = Number.isFinite(density) ? Math.max(0, Math.min(1, density)) : 0.5;
  if (d <= 0) return null;
  const obj = (forest && typeof forest === 'object') ? forest : {};
  const seedStr = obj.seed != null ? String(obj.seed) : `${seed}::forest`;
  const noiseSeed = xmur3(`${seedStr}::density`)();
  const size = Array.isArray(obj.size) && obj.size.length === 2
    && Number.isFinite(obj.size[0]) && Number.isFinite(obj.size[1]) && obj.size[0] > 0 && obj.size[0] <= obj.size[1]
    ? obj.size : [1.6, 3.2];
  const treeline = Number.isFinite(obj.treeline) ? Math.max(0, Math.min(1, obj.treeline)) : null;
  const farThin = Number.isFinite(obj.farThin) ? Math.max(0, Math.min(1, obj.farThin)) : 0.12;
  return {
    seedStr,
    thresh: 1 - d,            // density 1 → keep nearly everything (cloud-coverage twin)
    sizeLo: size[0],
    sizeHi: size[1],
    treeline,
    farThin,
    // baseScale 0.22 → ~4.5-world-unit clusters across the 24-wide quad.
    fbm: { octaves: 4, persistence: 0.5, lacunarity: 2.0, baseScale: 0.22, amplitude: 1, noiseSeed },
  };
}

// A closed midpoint-displaced blob — one foliage clump. Starts from a coarse
// irregular ring (K points around an ellipse, radii jittered) and for `depth`
// passes subdivides every edge, pushing each inserted midpoint along the edge
// normal by a seeded displacement that halves each pass (a 1/f Brownian
// outline). The recursion IS the cheat — no leaf geometry, just a ragged
// clump. A mass is several of these distributed and layered (see
// buildScatterMass) rather than one silhouette, so it reads as overlapping
// volumes.
function fractalBlob(cx, cy, rx, ry, rng, depth) {
  const K = 6;
  let pts = [];
  for (let i = 0; i < K; i += 1) {
    const a = (i / K) * Math.PI * 2;
    const rr = 0.82 + 0.22 * rng();         // rounder base ring — fewer lobes
    pts.push({ x: cx + Math.cos(a) * rx * rr, y: cy - Math.sin(a) * ry * rr });
  }
  let amp = Math.min(rx, ry) * 0.38;        // gentler displacement — no stray spikes
  for (let pass = 0; pass < depth; pass += 1) {
    const out = [];
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      out.push(a);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      let nx = -(b.y - a.y);
      let ny = b.x - a.x;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len; ny /= len;
      const disp = (rng() - 0.5) * 2 * amp;
      out.push({ x: mx + nx * disp, y: my + ny * disp });
    }
    pts = out;
    amp *= 0.5;
  }
  return pts;
}

// ─── scatter-mass — the ground-population render primitive ─────────────
// The dual of clouds for the floor plane: scatter MANY small organic
// billboard masses over the terrain and draw them cheaply enough to populate
// a whole landscape. Three reusable mechanisms, none of them tree-specific —
// swap the `instance` spec and the same machine renders a boulder field, a
// crowd, a vineyard, a city of distant roofs:
//
//   1. MAP PLACEMENT — a jittered candidate grid thresholded by an fBm
//      density field (`cfg.thresh`, cloud-coverage twin). Kept points ride
//      `heightAt`; an optional map-relative `treeline` culls high ground;
//      `farThin` thins toward the horizon. Per-cell rng seeded by grid coord
//      (not kept-order) so culling one mass never reshuffles another.
//   2. DEPTH-LOD BUDGET — clump count AND blob subdivision both fall off with
//      the instance's `depthT`, so "lots of masses from far away" can't blow
//      up the polygon count: near = more, finer clumps; far = a couple coarse.
//   3. LAYERED-BLOB RENDER — each mass is a cluster of midpoint-displaced
//      fractal blobs (fractalBlob) layered back→front, each with a darker
//      drop shadow behind it, plus a contact ground shadow and an optional
//      `column` (trunk/stem) the clumps leave gaps around. Depth nudges keep
//      every part inside the instance's [depthT, depthT+1e-3] slice, so the
//      global painter's sort never tangles one mass with another.
//
// `instance` spec: { aspect, tones:{ lit, mid, shadow, column, ground },
//   drop?:{ x, y }, lod?(depthT), layout(rng, m) -> { column, clump(rng, k) } }
// where `m = { bx, by, ty, sw, rise, halfW, depthT, count, blobDepth }` and a
// clump is `{ cx, cy, rx, ry, t }` (t ∈ [0,1] base→top, drives depth order
// and the lit/mid tone split).
const defaultMassLod = (depthT) => ({
  count: Math.max(2, Math.round(2 + 4 * (1 - depthT))),
  depth: Math.max(1, Math.min(3, Math.round(3 * (1 - depthT)))),
});

function buildScatterMass(cfg, sampler, camera, roomBasis, instance) {
  const out = [];
  const { tones } = instance;
  const lodFn = instance.lod || defaultMassLod;
  const jitter = makeRng(`${cfg.seedStr}::place`);
  const NX = 26;
  const NY = 22;
  const cells = [];
  let hLo = Infinity;
  let hHi = -Infinity;
  for (let j = 0; j < NY; j += 1) {
    for (let i = 0; i < NX; i += 1) {
      const u = Math.min(Math.max((i + 0.5 + (jitter() - 0.5) * 0.9) / NX, 0), 1);
      const v = Math.min(Math.max((j + 0.5 + (jitter() - 0.5) * 0.9) / NY, 0), 1);
      const x = uToX(u);
      const y = vToY(v);
      const t = fbm2D(x, y, cfg.fbm) * 0.5 + 0.5; // ~[-1,1] → [0,1]
      const zBase = sampler.heightAt(x, y);
      if (zBase < hLo) hLo = zBase;
      if (zBase > hHi) hHi = zBase;
      cells.push({ i, j, x, y, v, t, zBase });
    }
  }
  const cutoff = cfg.treeline != null && hHi > hLo
    ? hLo + (hHi - hLo) * cfg.treeline
    : Infinity;
  for (const c of cells) {
    if (c.t < cfg.thresh + cfg.farThin * c.v) continue; // map threshold + atmospheric far-thinning
    if (c.zBase > cutoff) continue;                     // above the treeline
    // Per-cell rng (seeded by grid coords, not kept-order) so culling one
    // mass never reshuffles another's shape — keeps `(cfg, seed)` stable.
    const rng = makeRng(`${cfg.seedStr}::${c.i}::${c.j}`);
    const height = cfg.sizeLo + (cfg.sizeHi - cfg.sizeLo) * rng();
    const width = height * instance.aspect;
    const base = projectWorld({ x: c.x, y: c.y, z: c.zBase }, camera, roomBasis);
    const top = projectWorld({ x: c.x, y: c.y, z: c.zBase + height }, camera, roomBasis);
    const left = projectWorld({ x: c.x - width / 2, y: c.y, z: c.zBase }, camera, roomBasis);
    const right = projectWorld({ x: c.x + width / 2, y: c.y, z: c.zBase }, camera, roomBasis);
    const bx = base.x;
    const by = base.y;
    const ty = top.y;
    const sw = Math.max(Math.abs(right.x - left.x), 1);
    const rise = Math.max(by - ty, 1);
    const halfW = sw / 2;
    const depthT = base.depthT;
    const lod = lodFn(depthT);
    const m = { bx, by, ty, sw, rise, halfW, depthT, count: lod.count, blobDepth: lod.depth };

    // 1. Contact ground shadow (most-back of the instance's depth slice).
    const shW = sw * 0.5;
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
      fill: tones.ground,
    });

    // 2. Optional column (trunk/stem) BEHIND the clumps, so it shows through
    //    the gaps the distributed clumps leave around it.
    const { column, clump } = instance.layout(rng, m);
    if (column) {
      out.push({ points: column, avgDepth: depthT + 8e-4, fill: tones.column });
    }

    // 3. Clumps — layered fractal blobs, each with a darker drop shadow.
    const dropX = sw * (instance.drop ? instance.drop.x : 0.11);
    const dropY = rise * (instance.drop ? instance.drop.y : 0.05);
    for (let k = 0; k < m.count; k += 1) {
      const cl = clump(rng, k);
      const blob = fractalBlob(cl.cx, cl.cy, cl.rx, cl.ry, rng, m.blobDepth);
      const pieceDepth = depthT + 7e-4 * cl.t;          // higher clumps further back
      out.push({
        points: blob.map((p) => ({ x: p.x + dropX, y: p.y + dropY })),
        avgDepth: pieceDepth + 1e-4,
        fill: tones.shadow,
      });
      out.push({
        points: blob,
        avgDepth: pieceDepth,
        fill: cl.t > 0.5 ? tones.lit : tones.mid,        // sunlit crown, shaded skirt
      });
    }
  }
  return out;
}

// forest — the first scatter-mass caller. A trunk column behind a tapering
// teardrop cluster of green clumps, kept tight to the axis so none stray.
function forestInstance(palette) {
  return {
    aspect: 0.55,
    tones: {
      lit: shadeFromLambert(palette, AMBIENT + LAMBERT_GAIN * 0.78),    // sunlit upper clumps
      mid: shadeFromLambert(palette, AMBIENT + LAMBERT_GAIN * 0.56),    // lower / shaded clumps
      shadow: shadeFromLambert(palette, AMBIENT + LAMBERT_GAIN * 0.26), // clump drop shadow
      column: shadeFromLambert(palette, AMBIENT + LAMBERT_GAIN * 0.10), // trunk
      ground: `rgb(${palette.shadow[0]},${palette.shadow[1]},${palette.shadow[2]})`,
    },
    layout(rng, m) {
      const crownBase = m.by - m.rise * 0.16;
      const trunkHalf = Math.max(m.sw * 0.07, 0.7);
      const column = [
        { x: m.bx - trunkHalf, y: m.by },
        { x: m.bx + trunkHalf, y: m.by },
        { x: m.bx + trunkHalf, y: crownBase },
        { x: m.bx - trunkHalf, y: crownBase },
      ];
      const apexY = m.ty + m.rise * 0.10 * rng();
      const span = Math.max(crownBase - apexY, 1);
      const clump = (r, k) => {
        // t: 0 at the base, 1 at the apex; lightly jittered within its slot.
        const t = Math.max(0, Math.min(1, (k + 0.5 + (r() - 0.5) * 0.4) / m.count));
        const cy = crownBase - t * span;
        const widthAt = m.halfW * (1 - 0.66 * t);        // taper toward the apex
        // Keep clump centers near the trunk axis so none drift into strays.
        const cx = m.bx + (r() - 0.5) * widthAt * 0.4;
        // Radii large relative to spacing so neighboring clumps always overlap
        // into one mass (no gaps between them except where the trunk shows).
        const rx = Math.max(widthAt * (0.78 + 0.2 * r()), 1.2);
        const ry = rx * (0.84 + 0.2 * r());
        return { cx, cy, rx, ry, t };
      };
      return { column, clump };
    },
  };
}

// Realize the forest layer into depth-sorted polygons by binding the forest
// instance to the scatter-mass primitive.
function buildForest(cfg, sampler, palette, camera, roomBasis) {
  return buildScatterMass(cfg, sampler, camera, roomBasis, forestInstance(palette));
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

function emitSvg(polygons, palette, viewBoxOverride, renderStyle = 'painterly', sky = null, clouds = null, adornments = null) {
  polygons.sort((a, b) => b.avgDepth - a.avgDepth);
  const override = viewBoxOverride && Number.isFinite(viewBoxOverride.width);
  const vp = override
    ? { vbX: 0, vbY: 0, vbW: viewBoxOverride.width, vbH: viewBoxOverride.height }
    : computeViewport(polygons);
  // The terrain's top silhouette = where land meets sky (min y across polys).
  let terrainTop = Infinity;
  for (const poly of polygons) for (const p of poly.points) if (p.y < terrainTop) terrainTop = p.y;
  if (!Number.isFinite(terrainTop)) terrainTop = vp.vbY;
  // Sky shots: push the terrain DOWN by adding headroom above, so the upper
  // frame is open sky instead of fitting tight to the highest peak. The
  // silhouette lands ~SKY_HORIZON_TARGET down the frame; the gradient horizon
  // and the cloud/adornment band then anchor to that real horizon line.
  const useSky = sky && renderStyle !== 'wireframe';
  if (useSky && !override) {
    const cur = vp.vbH > 0 ? (terrainTop - vp.vbY) / vp.vbH : 0;
    if (cur < SKY_HORIZON_TARGET) {
      const headroom = Math.round((SKY_HORIZON_TARGET * vp.vbH - (terrainTop - vp.vbY)) / (1 - SKY_HORIZON_TARGET));
      vp.vbY -= headroom;
      vp.vbH += headroom;
    }
    vp.horizonY = terrainTop;
  }
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
  // wireframe), else the flat soft field. The horizon stop sits at the actual
  // land/sky line (vp.horizonY) so the warm horizon glow meets the terrain
  // silhouette, and everything below it (behind terrain) stays the horizon
  // tone the hazed ground fades into.
  if (useSky) {
    const z = sky.zenith; const h = sky.horizon;
    const hf = Number.isFinite(vp.horizonY) ? Math.max(0.2, Math.min(0.62, (vp.horizonY - vp.vbY) / vp.vbH)) : 0.58;
    parts.push(
      `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0%" stop-color="rgb(${z[0]},${z[1]},${z[2]})" />` +
      `<stop offset="${(hf * 100).toFixed(1)}%" stop-color="rgb(${h[0]},${h[1]},${h[2]})" />` +
      `<stop offset="100%" stop-color="rgb(${h[0]},${h[1]},${h[2]})" />` +
      `</linearGradient></defs>`,
    );
  }
  parts.push(
    `<rect x="${vp.vbX}" y="${vp.vbY}" width="${vp.vbW}" height="${vp.vbH}" fill="${useSky ? 'url(#sky)' : bg}" />`,
  );
  // Sky adornments, painted in registry order — far→near by real distance: the
  // truly-distant bodies first (stars, comet, then the moon and sun disc), THEN
  // the aurora (~100 km up — far closer than the moon, so it veils over it) and
  // meteors (~100 km). All sit behind the clouds (troposphere, nearest) so cloud
  // cover occludes them — a sun behind a break reads as god-rays.
  if (useSky && adornments) {
    for (const p of SKY_PRIMITIVES) {
      const cfg = adornments[p.id];
      if (cfg) for (const el of p.build(vp, sky, cfg)) parts.push(el);
    }
  }
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
  // `sky` may be a sky-card id, a boolean, or an inline object — resolve to
  // one spec the renderer consumes.
  const skySpec = resolveSkySpec(manifest.sky);
  const skyEnabled = !skySpec.disabled && renderStyle !== 'wireframe';
  const sky = skyEnabled ? deriveSky(palette, light) : null;
  const haze = sky
    ? { horizon: sky.horizon, day: sky.day, strength: Number.isFinite(skySpec.hazeStrength) ? skySpec.hazeStrength : 0.6 }
    : null;
  // Clouds are opt-in via `sky: { clouds }` / a sky card that declares them.
  const cloudCfg = (sky && skySpec.clouds != null)
    ? normalizeClouds(skySpec.clouds, sky, seed)
    : null;
  // Sky adornments are opt-in via `sky: { sun, stars, moon, ... }` (or a sky
  // card that declares them) — celestial marks gated by the same day→night arc
  // the sky rides: the sun by day, stars/moon/aurora/comet/meteors at night.
  // Built from the SKY_PRIMITIVES registry so each is keyed by its id.
  let adornments = null;
  if (sky) {
    adornments = {};
    for (const p of SKY_PRIMITIVES) adornments[p.id] = p.normalize(skySpec[p.id], sky, seed);
  }
  const anyAdornment = adornments && Object.values(adornments).some(Boolean);
  // Lunar lighting hint: when a moon is up, cast its one fixed cool quality from
  // the moon's sky position onto the ground (moon-facing slopes catch a faint
  // silver). Direction is projected from the moon's screen position (azimuth
  // from u, elevation from h); strength rides how deep the night and the phase.
  if (haze && adornments && adornments.moon) {
    const m = adornments.moon;
    haze.moon = {
      dir: normalize3({ x: (m.u - 0.5) * 1.6, y: 0.45, z: Math.max(0.3, m.h) }),
      strength: 0.16 * m.nightFactor * (0.45 + 0.55 * m.phase),
    };
  }
  const terrain = buildTerrainCells(sampler.samples.u, sampler.samples.v, sampler, light, palette, camera, roomBasis, haze);
  // Structures (architectural box/obelisk faces) are heartbeat-mode only.
  const structureFaces = sampler.mode === 'heartbeat'
    ? buildStructureFaces(resolveStructures(manifest.structures, seed), sampler.hb, light, palette, camera, roomBasis)
    : [];
  const sceneItems = resolveScene(manifest.scene, seed);
  const scatter = buildScatter(sceneItems, sampler.heightAt, light, palette, camera, roomBasis);
  // Forest is an opt-in generative layer (like clouds): a density map over
  // the ground quad drops fractal trees. Emitted as scatter-shaped polygons
  // so they depth-sort against terrain, structures, and scatter for free.
  const forestCfg = normalizeForest(manifest.forest, seed);
  const forest = forestCfg ? buildForest(forestCfg, sampler, palette, camera, roomBasis) : [];
  return emitSvg([...terrain, ...structureFaces, ...scatter, ...forest], palette, manifest.viewBox, renderStyle, sky, cloudCfg, anyAdornment ? adornments : null);
}

// ─── World mesh — the CSS-3D "second backend" ──────────────────────────
// The SVG path (above) flattens the heightfield to 2D screen polygons via
// projectWorld and throws the world z away. This keeps the geometry 3D: it
// emits the SAME sampled grid as `buildTerrainWorldMesh`-shaped world quads
// { corners:[[x,y,z]x4], fill } that scene-css3d's emitter turns into
// positioned <div>s (one matrix3d each), so the browser does projection +
// occlusion + a movable camera. Shading is identical to the SVG terrain
// (Lambert + water + day/night tint); only the haze is re-baked off world-y
// distance instead of screen depth (the screen depth doesn't exist until the
// browser projects). v1 scope: terrain mesh + water sheet — no structures,
// scatter, forest, or sky adornments yet (those return on the SVG path).
export function buildTerrainWorldMesh(manifest, { city = false, cityDensity = 0.6, bridges = [], farmland = false } = {}) {
  const errors = validatePaintedLandscape(manifest);
  if (errors.length) {
    throw new Error(`Invalid painted-landscape manifest:\n - ${errors.join('\n - ')}`);
  }
  const seed = manifest.seed || 'default';
  const sampler = makeSampler(manifest, seed);
  const palette = derivePalette(manifest.splatch, manifest.paletteOverrides);
  const lightVec = manifest.light || sampler.defaultLight || { x: 0.4, y: 0.6, z: 0.6 };
  const light = normalize3(lightVec);
  // Sky is derived (not rendered as geometry here): its zenith/horizon drive
  // the viewport's gradient backdrop, and its horizon color is the haze target.
  const skySpec = resolveSkySpec(manifest.sky);
  const sky = !skySpec.disabled ? deriveSky(palette, light) : null;
  const haze = sky
    ? { horizon: sky.horizon, day: sky.day, strength: Number.isFinite(skySpec.hazeStrength) ? skySpec.hazeStrength : 0.6 }
    : null;
  // Lunar lighting hint (camera-independent), mirrored from the SVG path so the
  // night look matches. Derived from the moon adornment when one is configured.
  if (haze && sky) {
    const moon = SKY_PRIMITIVES.find((p) => p.id === 'moon');
    const m = moon ? moon.normalize(skySpec.moon, sky, seed) : null;
    if (m) {
      haze.moon = {
        dir: normalize3({ x: (m.u - 0.5) * 1.6, y: 0.45, z: Math.max(0.3, m.h) }),
        strength: 0.16 * m.nightFactor * (0.45 + 0.55 * m.phase),
      };
    }
  }

  const wl = sampler.waterLevel;
  const hasWater = Number.isFinite(wl);
  const M = sampler.samples.u, N = sampler.samples.v;
  // sampled world grid: row j (v: near→far), col i (u: left→right). The mesh holds
  // the TRUE terrain z everywhere (the lakebed is the real depression) — water is a
  // separate translucent sheet laid at the waterline, so depth reads through it.
  const grid = [];
  for (let j = 0; j <= N; j += 1) {
    const y = vToY(j / N);
    const row = [];
    for (let i = 0; i <= M; i += 1) {
      const x = uToX(i / M);
      row.push([x, y, sampler.heightAt(x, y)]);
    }
    grid.push(row);
  }
  // rgb-string helpers for the water surface (scale value, add alpha)
  const scaleRgbStr = (s, f) => {
    const m = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(s);
    if (!m) return s;
    return `rgb(${clamp255(m[1] * f)},${clamp255(m[2] * f)},${clamp255(m[3] * f)})`;
  };
  const withAlpha = (s, a) => s.replace('rgb(', 'rgba(').replace(')', `,${a.toFixed(3)})`);
  // ── shared terrain oracles (slope + seeded hash) — used by farmland, city, bridges ──
  const cE = 0.25;
  const flatnessAt = (x, y) => {
    const dzdx = (sampler.heightAt(x + cE, y) - sampler.heightAt(x - cE, y)) / (2 * cE);
    const dzdy = (sampler.heightAt(x, y + cE) - sampler.heightAt(x, y - cE)) / (2 * cE);
    return 1 / Math.sqrt(dzdx * dzdx + dzdy * dzdy + 1); // 1 = flat, →0 = vertical
  };
  const seedNum = [...String(seed)].reduce((h, ch) => ((h * 31 + ch.charCodeAt(0)) >>> 0), 9);
  const hsh = (a, b) => {
    let h = (Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663) ^ seedNum) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    return h / 4294967296;
  };

  // ── farmland sticker: an aerial patchwork of fields on gentle, dry, lower land ──
  // A surface texture (not geometry): the ground is quantized into PARCELS, each a
  // field with a hashed crop colour + furrow direction. Cells in the SAME parcel
  // share them, so contiguous fields read as plots (not per-cell noise — the
  // "disco-ball" failure the city had). A hedgerow line is drawn on a cell edge
  // where its parcel differs from the neighbour, giving the quilt its seams.
  const PARCEL = 3.2;                                   // ≈ field size in world units
  const parcelI = (x) => Math.floor((x - X_MIN) / PARCEL);
  const parcelJ = (y) => Math.floor((Y_NEAR - y) / PARCEL);
  const FIELDS = [[122, 140, 74], [154, 170, 92], [198, 182, 112], [150, 120, 80], [168, 156, 98], [108, 130, 84]];
  const HEDGE = [58, 72, 46];
  const FARM_FLAT_MIN = 0.7;                            // fields tolerate rolling land, not cliffs
  const cellWX = (X_MAX - X_MIN) / M, cellWY = Y_SPAN / N;
  // amplitude band (skip the high peaks) computed after zMin/zMax below
  const fieldBgAt = (xc, yc, lambRaw, depthT, amp) => {
    if (flatnessAt(xc, yc) < FARM_FLAT_MIN) return null; // too steep to farm
    if (amp > 0.78) return null;                         // not up on the peaks
    const pi = parcelI(xc), pj = parcelJ(yc);
    const ph = hsh(pi * 2 + 5, pj * 2 + 11);
    if (ph > 0.82) return null;                          // some parcels stay wild (gaps in the patchwork)
    const lit = Math.max(0.34, Math.min(1, lambRaw));
    let base = FIELDS[Math.floor(hsh(pi + 3, pj + 7) * FIELDS.length) % FIELDS.length].map((c) => c * lit);
    if (haze) base = lerpRgb(base, haze.horizon, haze.strength * Math.max(0, Math.min(1, depthT)) * 0.9);
    const fStr = `rgb(${clamp255(base[0])},${clamp255(base[1])},${clamp255(base[2])})`;
    const hRgb = HEDGE.map((c) => clamp255(c * lit));
    const hStr = `rgb(${hRgb[0]},${hRgb[1]},${hRgb[2]})`;
    // furrow direction per parcel; subtle dark rows over the field colour
    const dir = ['to right', 'to bottom', '135deg'][Math.floor(hsh(pi + 1, pj + 2) * 3) % 3];
    const fur = `repeating-linear-gradient(${dir}, rgba(0,0,0,0.10) 0 1px, transparent 1px 22%)`;
    const layers = [fur];
    // hedgerows: draw on the +x / +y edges that border a different parcel
    if (parcelI(xc + cellWX) !== pi) layers.push(`linear-gradient(to right, transparent 0 86%, ${hStr} 86% 100%)`);
    if (parcelJ(yc - cellWY) !== pj) layers.push(`linear-gradient(to bottom, transparent 0 86%, ${hStr} 86% 100%)`);
    layers.push(`linear-gradient(${fStr}, ${fStr})`);   // opaque field base (bottom)
    return layers.join(',');
  };

  // z-range up front (the grid already holds every vertex z) so farmland's
  // amplitude band and the city's height scaling can both use it.
  let zMin = Infinity, zMax = -Infinity;
  for (let j = 0; j <= N; j += 1) for (let i = 0; i <= M; i += 1) {
    const z = grid[j][i][2];
    if (z < zMin) zMin = z; if (z > zMax) zMax = z;
  }
  if (!Number.isFinite(zMin)) { zMin = 0; zMax = 1; }
  const zSpan = (zMax - zMin) || 1;

  const faces = [];
  const waterFaces = [];   // translucent water sheet — appended last so it blends over the bed
  for (let j = 0; j < N; j += 1) {
    for (let i = 0; i < M; i += 1) {
      const a = grid[j][i], b = grid[j][i + 1], c = grid[j + 1][i + 1], d = grid[j + 1][i];
      const xc = uToX((i + 0.5) / M);
      const yc = vToY((j + 0.5) / N);
      const terrainC = sampler.heightAt(xc, yc);
      const isWater = hasWater && terrainC < wl;
      const depthT = Math.max(0, Math.min(1, (Y_NEAR - yc) / Y_SPAN));
      // bed/terrain: TRUE terrain shading everywhere; submerged cells darken so the
      // real lakebed reads through the translucent water laid over it.
      let fill = shadeFromLambert(palette, sampler.lambertAt(xc, yc, light));
      if (isWater) fill = scaleRgbStr(fill, 0.5);
      if (haze) {
        fill = applyHaze(fill, haze.horizon, haze.strength * depthT);
        if (haze.day < 1) {
          fill = applyHaze(fill, NIGHT_TINT, (1 - haze.day) * 0.6);
          if (haze.moon && !isWater) {
            const lunarTerm = Math.max(0, (sampler.lambertAt(xc, yc, haze.moon.dir) - AMBIENT) / LAMBERT_GAIN);
            fill = applyHaze(fill, MOON_LIGHT, haze.moon.strength * lunarTerm);
          }
        }
      }
      // farmland: paint a field patch over suitable (gentle, dry, lower) land
      let face = { corners: [a, b, c, d], fill, doubleSided: true };
      if (farmland && !isWater) {
        const amp = (terrainC - zMin) / zSpan;
        const bg = fieldBgAt(xc, yc, sampler.lambertAt(xc, yc, light), depthT, amp);
        if (bg) face = { corners: [a, b, c, d], bg, doubleSided: true };
      }
      faces.push(face);
      // water surface: a flat translucent quad at the waterline. Deeper water →
      // bluer + more opaque (the bed hides); shallows stay clear so the bed shows.
      if (isWater) {
        const depth = wl - terrainC;
        let wc = waterShade(depth);
        if (haze) wc = applyHaze(wc, haze.horizon, haze.strength * depthT * 1.25);
        const alpha = Math.min(0.92, 0.46 + depth * 0.12);
        const wq = [[a[0], a[1], wl], [b[0], b[1], wl], [c[0], c[1], wl], [d[0], d[1], wl]];
        // `water: true` tags the sheet so the three.js World renders it in a separate
        // TRANSLUCENT mesh (per-vertex alpha from the rgba fill — shallows clear, deeps
        // opaque). The CSS path already blends the rgba() fill, so it ignores the flag.
        waterFaces.push({ corners: wq, fill: withAlpha(wc, alpha), doubleSided: true, water: true });
      }
    }
  }
  faces.push(...waterFaces);

  // ── city doodads: scattered mini-buildings whose massing reads as a town ────
  // Not a surface texture — discrete extruded boxes sitting ON the terrain. A
  // slope mask keeps them on buildable (flat, dry) ground; their HEIGHT is driven
  // by the waveform amplitude under each site (taller on high ground), so the
  // skyline echoes the relief. Footprint/colour are seed-randomized. Returned as
  // box SPECS — the css3d renderer extrudes them via the same box primitive the
  // fractal-city uses (the SVG path ignores `structures`).
  // shared footprint scale for ALL placed structures (buildings + bridge piers/deck),
  // so they read at one consistent, slim size across the scene.
  const STRUCT_W = 0.3;
  const structures = [];
  if (city) {
    // Massed-stylistically: ONE tight tonal range for the whole cityscape (not
    // per-building decoration), so it reads as a single coherent mass. The colour
    // is INHERITED from the scene's splatch palette — the dark (shadow) end,
    // lightly desaturated — so the mass is harmonious with the ground rather than
    // a stark grey, while still reading darker than the lit terrain. Variation is
    // deliberately small (tight tone band, narrow buildings); the buildings are
    // narrow towers whose height rides the waveform amplitude.
    const lerp3 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
    const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
    const desat = (c, f) => { const g = (c[0] + c[1] + c[2]) / 3; return c.map((v) => v + (g - v) * f); };
    // harmonious mass tones from the palette's dark end (a touch desaturated)
    const CITY_LO = desat(palette.shadow.map((v) => v * 0.82), 0.22);
    const CITY_HI = desat(palette.base.map((v) => v * 0.8), 0.18);
    const FLAT_MIN = 0.82;          // need a fairly level pad to build on
    const GX = 30, GY = 26;         // candidate site grid
    for (let gy = 0; gy < GY; gy += 1) {
      for (let gx = 0; gx < GX; gx += 1) {
        const r1 = hsh(gx * 2 + 1, gy * 2 + 1), r2 = hsh(gx * 3 + 7, gy * 5 + 2);
        const r3 = hsh(gx + 13, gy + 29), r4 = hsh(gx * 7 + 3, gy * 2 + 9), r5 = hsh(gx * 5 + 2, gy * 7 + 1);
        const x = uToX((gx + 0.5 + (r1 - 0.5) * 0.7) / GX);
        const y = vToY((gy + 0.5 + (r2 - 0.5) * 0.7) / GY);
        const z0 = sampler.heightAt(x, y);
        if (hasWater && z0 < wl + 0.15) continue;            // dry land (+ shore buffer)
        const flat = flatnessAt(x, y);
        if (flat < FLAT_MIN) continue;                        // skip steep ground
        const keep = (flat - FLAT_MIN) / (1 - FLAT_MIN);      // flatter → denser
        if (r3 > cityDensity * (0.45 + 0.6 * keep)) continue; // cityDensity tunes coverage
        const amp = Math.max(0, Math.min(1, (z0 - zMin) / zSpan)); // waveform amplitude
        let h = 0.4 + (0.6 + 2.2 * amp) * (0.72 + 0.45 * r4);  // height rides amplitude (tighter spread)
        if (r5 < 0.05) h *= 1.5;                               // rare landmark tower (subtler)
        const w = STRUCT_W * (0.75 + 0.6 * r1), d = STRUCT_W * (0.75 + 0.6 * r2); // narrow towers
        // tight tonal band, mostly hash + a little amplitude (mass stays coherent)
        const tone = Math.max(0, Math.min(1, 0.25 + 0.35 * r3 + 0.15 * amp));
        const wallRgb = lerp3(CITY_LO, CITY_HI, tone);
        structures.push({
          x: x - w / 2, y: y - d / 2, w, d, z0, z1: z0 + h,
          wall: toHex(wallRgb),
          roof: toHex(lerp3(wallRgb, CITY_HI, 0.22)),          // roof a touch lighter (form read)
        });
      }
    }
  }

  // ── scene scatter: forest / rocks / groundcover placed on the relief ────────
  // Tree kinds (cone → conifer, canopy → broadleaf) become REAL branched taiji-plant
  // geometry via the same shape+plant box spec the fractal-city street trees ride
  // (meshed by plantBoxToFaces at assemble time, lit by the scene light). Boulders/tufts
  // stay as small massed boxes. The SVG path draws its own painterly glyphs (resolveScene
  // above) — this is the World's volumetric counterpart, ridden only by the css3d/three seam.
  if (manifest.scene) {
    const clampHex = (c) => '#' + c.map((v) => clamp255(v).toString(16).padStart(2, '0')).join('');
    for (const it of resolveScene(manifest.scene, seed)) {
      const z0 = sampler.heightAt(it.x, it.y);
      if (hasWater && z0 < wl + 0.05) continue;                 // no scatter standing in the lake
      const w = Math.max(0.2, it.width), hgt = Math.max(0.3, it.height);
      const base = { x: it.x - w / 2, y: it.y - w / 2, w, d: w, z0 };
      if (it.kind === 'cone' || it.kind === 'canopy') {
        const conifer = it.kind === 'cone';
        structures.push({
          ...base, z1: z0 + hgt, shape: conifer ? 'conifer' : 'tree',
          plant: {
            height: hgt, stemRadius: Math.max(0.04, w * 0.09), depth: 1,
            branches: conifer ? 3 : 4, foliage: conifer ? 'conifer' : 'cluster',
            clusterSize: w * (conifer ? 0.5 : 0.62), foliageTiers: 4,
          },
        });
      } else {
        // boulder / tuft → a small massed box (rock / groundcover clump), palette-toned.
        const rock = it.kind === 'boulder';
        const tone = rock ? palette.shadow : palette.base;
        structures.push({
          ...base, z1: z0 + hgt * (rock ? 0.7 : 0.5),
          wall: clampHex(tone.map((v) => v * (rock ? 0.7 : 0.85))),
          roof: clampHex(tone.map((v) => v * (rock ? 0.82 : 0.96))),
        });
      }
    }
  }

  // ── bridges: span structures the city grid can't express ───────────────────
  // A bridge connects two world points — peak-to-peak (tall valley piers read as
  // a viaduct/aqueduct) or shore-to-shore (low piers into the water read as a
  // causeway). The deck is an arched strip with per-point z (so it can't be a
  // flat ribbon), built as raw faces; piers are boxes fed through the same box
  // primitive. Endpoints come from the spec ({ from:[x,y], to:[x,y], ... }); the
  // terrain height is sampled at each so the deck seats on the relief.
  const extraFaces = [];
  if (Array.isArray(bridges) && bridges.length) {
    // Stone/deck tones inherited from the splatch palette (desaturated mid/dark),
    // so the span is harmonious with the scene rather than a stark grey.
    const desatB = (c, f) => { const g = (c[0] + c[1] + c[2]) / 3; return c.map((v) => v + (g - v) * f); };
    const DECK = desatB(palette.base.map((v) => v * 0.62), 0.3);
    const RAIL = desatB(palette.shadow.map((v) => v * 0.9), 0.25);
    const stoneRgb = desatB(palette.base.map((v) => v * 0.74), 0.32);
    const STONE = '#' + stoneRgb.map((v) => clamp255(v).toString(16).padStart(2, '0')).join('');
    const shadeRgb = (base, n) => {
      const f = flatLambert(n, light);
      return `rgb(${clamp255(base[0] * f)},${clamp255(base[1] * f)},${clamp255(base[2] * f)})`;
    };
    const quad = (c0, c1, c2, c3, base, n) => extraFaces.push({ corners: [c0, c1, c2, c3], fill: shadeRgb(base, n), doubleSided: true });
    for (const br of bridges) {
      const from = br.from || [0, 0], to = br.to || [0, 0];
      const fx = from[0], fy = from[1], tx = to[0], ty = to[1];
      const dx = tx - fx, dy = ty - fy, length = Math.hypot(dx, dy) || 1;
      const dirx = dx / length, diry = dy / length;
      const px = -diry, py = dirx;                 // in-plane perpendicular
      // dimensions inherit the shared structure footprint (STRUCT_W) so the bridge
      // reads at the same slim scale as the buildings — a smaller, longer span.
      const hw = (br.deckWidth ?? STRUCT_W * 1.5) / 2;
      const thk = br.deckThickness ?? STRUCT_W * 0.5;
      const railH = br.railHeight ?? STRUCT_W * 0.5;
      const arch = br.archHeight ?? Math.min(2.2, length * 0.08);
      const clr = br.clearance ?? 0.7;
      const zFrom = sampler.heightAt(fx, fy), zTo = sampler.heightAt(tx, ty);
      const floorZ = hasWater ? wl : -Infinity;     // deck rides above water if any
      const at = (t) => [fx + dx * t, fy + dy * t];
      const deckZ = (t) => Math.max(zFrom + (zTo - zFrom) * t, floorZ) + clr + arch * Math.sin(Math.PI * t);
      const S = Math.max(10, Math.round(length / 0.45));
      const edge = (t, s) => { const p = at(t); return [p[0] + px * hw * s, p[1] + py * hw * s, deckZ(t)]; };
      const drop = (c, dz) => [c[0], c[1], c[2] - dz];
      const raise = (c, dz) => [c[0], c[1], c[2] + dz];
      const upN = { x: 0, y: 0, z: 1 }, sideN = { x: px, y: py, z: 0 }, sideNn = { x: -px, y: -py, z: 0 };
      for (let s = 0; s < S; s += 1) {
        const t0 = s / S, t1 = (s + 1) / S;
        const l0 = edge(t0, 1), l1 = edge(t1, 1), r0 = edge(t0, -1), r1 = edge(t1, -1);
        quad(l0, r0, r1, l1, DECK, upN);                                          // deck top
        quad(drop(l0, thk), l0, l1, drop(l1, thk), DECK, sideN);                  // left fascia
        quad(r0, drop(r0, thk), drop(r1, thk), r1, DECK, sideNn);                 // right fascia
        quad(l0, raise(l0, railH), raise(l1, railH), l1, RAIL, sideN);            // left parapet
        quad(raise(r0, railH), r0, r1, raise(r1, railH), RAIL, sideNn);           // right parapet
      }
      // piers down to the terrain (or just under the waterline), where the gap warrants.
      // Slim (STRUCT_W) and frequent → a long, slender span at building scale.
      const pierEvery = br.pierEvery ?? STRUCT_W * 6, pierW = (br.pierWidth ?? STRUCT_W) / 2;
      const nP = Math.max(0, Math.floor(length / pierEvery));
      for (let k = 1; k <= nP; k += 1) {
        const t = k / (nP + 1);
        const [cx, cy] = at(t);
        const ground = sampler.heightAt(cx, cy);
        const footZ = hasWater && ground < wl ? wl - 0.4 : ground;   // into the water, or on land
        const topZ = deckZ(t) - thk;
        if (topZ - footZ < 0.5) continue;                            // deck already near ground
        structures.push({ x: cx - pierW, y: cy - pierW, w: pierW * 2, d: pierW * 2, z0: footZ, z1: topZ, wall: STONE, roof: STONE });
      }
    }
  }

  // Star density for the World's night dome (mirrors skyCss): a number is verbatim, a
  // boolean is the preset default, the card's { density } object is unwrapped, else none.
  // `day` rides along so the World can night-gate + fade the stars exactly like the SVG sky.
  const starDensity = (() => {
    const st = skySpec && skySpec.stars;
    if (st == null) return 0;
    if (typeof st === 'number') return Math.max(0, Math.min(1, st));
    if (typeof st === 'boolean') return st ? 0.55 : 0;
    if (typeof st === 'object' && Number.isFinite(st.density)) return Math.max(0, Math.min(1, st.density));
    return 0;
  })();
  // Moon adornment for the World (reuses the SVG normaliser, so phase/size/position +
  // night-gating match the still). null unless a moon is configured AND it's night.
  const moonPrim = SKY_PRIMITIVES.find((p) => p.id === 'moon');
  const moonCfg = sky && moonPrim ? moonPrim.normalize(skySpec.moon, sky, seedNum) : null;
  // Sun adornment for the World — the daytime counterpart of the moon, threaded through
  // the same normaliser so glow/size/position + horizon-gating match the still. null unless
  // a sun is configured AND it sits above the horizon (normalizeSun returns null below it).
  const sunPrim = SKY_PRIMITIVES.find((p) => p.id === 'sun');
  const sunCfg = sky && sunPrim ? sunPrim.normalize(skySpec.sun, sky, seedNum) : null;

  return {
    faces,
    structures,
    extraFaces,
    bounds: { xRange: [X_MIN, X_MAX], yRange: [Y_FAR, Y_NEAR], zRange: [zMin, zMax] },
    // the terrain light vector → the assemble layer lights the structures/plants with it (so a
    // night forest is dim, not day-lit) + the day factor for the ambient/diffuse balance.
    light: { x: light.x, y: light.y, z: light.z },
    day: sky ? sky.day : 1,
    sky: sky ? { zenith: sky.zenith, horizon: sky.horizon, day: sky.day, stars: starDensity, seed: seedNum, moon: moonCfg, sun: sunCfg } : null,
  };
}
