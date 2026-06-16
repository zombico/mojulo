/**
 * Shot-glyph implications — deterministic lowering before validation.
 *
 * When the LLM picks a canonical shot glyph from the library
 * (`school-of-athens-central-hall`, `person-eye-room-window-light`, …) it
 * doesn't need to author the glyph's consequences. The glyph card in
 * `mandala-patterns.js` already encodes the camera vector, light entry,
 * support plane, hall mandala (with axis-mundi), room concept, and the
 * shot's camera window. This module merges those library-side facts onto
 * the manifest BEFORE authorship-preview runs, so the gating checks
 * (`shot-glyph-topology`, `hall-mandala-axis-mundi`) pass automatically for
 * a known glyph reference.
 *
 * Operator-supplied fields always win — the library card is the base, the
 * manifest is the override. The function is idempotent: applying it twice
 * yields the same manifest as applying it once.
 *
 * Scope is deliberately narrow. Neo-rembrandt's `resolveShotGlyphs`
 * already lowers `scene.perspective`, `cameraPrimitive`, `meru`, and
 * `metamandala.lightSources` during expansion; we don't duplicate that
 * here because nothing pre-expansion gates on those mounts. We only fill
 * the polygonizer-side fields the authorship-preview reads from.
 */

import { resolveShotGlyph } from './mandala-patterns.js';

const POLYGONIZER_MOUNTS = ['shotGlyph', 'shotGlyphs', 'mandalaPatternLayer'];

export function applyShotGlyphImplications(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return manifest;
  const polygonizer = manifest.polygonizer;
  if (!polygonizer || typeof polygonizer !== 'object' || Array.isArray(polygonizer)) return manifest;

  const layer = polygonizer.mandalaPatternLayer && typeof polygonizer.mandalaPatternLayer === 'object'
    && !Array.isArray(polygonizer.mandalaPatternLayer)
    ? polygonizer.mandalaPatternLayer
    : {};

  // Collect every shot-glyph reference the manifest declares, anywhere it
  // can legally appear. Order matters: the first resolved glyph becomes the
  // primary and is the one whose hallMandala / cameraWindow / roomConcept
  // lift to the layer.
  const rawRefs = [
    ...asArray(layer.shotGlyphs),
    ...asArray(layer.shotGlyph),
    ...asArray(layer.standardShot),
    ...asArray(polygonizer.shotGlyphs),
    ...asArray(polygonizer.shotGlyph),
  ];

  const resolved = [];
  const seenIds = new Set();
  for (const ref of rawRefs) {
    const glyph = resolveOne(ref);
    if (!glyph) continue;
    const key = glyph.id || JSON.stringify(glyph);
    if (seenIds.has(key)) continue;
    seenIds.add(key);
    resolved.push(glyph);
  }

  if (!resolved.length) return manifest;
  const primary = resolved[0];

  const nextLayer = {
    ...layer,
    shotGlyph: primary,
    shotGlyphs: resolved,
    cameraWindow: deepMerge(primary.cameraWindow, layer.cameraWindow),
    hallMandala: deepMerge(primary.hallMandala, layer.hallMandala),
  };

  const nextPolygonizer = {
    ...polygonizer,
    shotGlyph: primary,
    shotGlyphs: resolved,
    mandalaPatternLayer: nextLayer,
    roomConcept: deepMerge(primary.roomConcept, polygonizer.roomConcept),
  };

  return { ...manifest, polygonizer: nextPolygonizer };
}

// Look up a glyph reference in the library and merge user-supplied overrides
// on top. Returns null for refs that aren't shaped like a glyph object.
function resolveOne(ref) {
  if (!ref) return null;
  const raw = typeof ref === 'string' ? { id: ref } : ref;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  // `extends`/`seed` win over `id` for the library lookup — that matches
  // `normalizeShotGlyph` in mandala-patterns.js and lets a derived glyph
  // ({ id: 'my-tabletop', extends: 'tabletop-three-quarter-key' }) inherit
  // the seed's fields while preserving its own id.
  const lookup = raw.extends || raw.seed || raw.id || raw.kind || raw.ref;
  const base = lookup ? resolveShotGlyph(lookup) : null;

  // Unknown glyph — leave the raw object as-is so the manifest still
  // describes whatever the LLM tried to declare. The authorship-preview
  // checks will then surface what's missing.
  if (!base) return raw;

  return {
    ...base,
    ...raw,
    id: raw.id && raw.extends ? raw.id : base.id,
    label: raw.label || base.label,
    family: raw.family || base.family,
    topology: { ...(base.topology || {}), ...(raw.topology || {}) },
    cameraPrimitive: deepMerge(base.cameraPrimitive, raw.cameraPrimitive),
    cameraWindow: deepMerge(base.cameraWindow, raw.cameraWindow),
    hallMandala: deepMerge(base.hallMandala, raw.hallMandala),
    roomConcept: deepMerge(base.roomConcept, raw.roomConcept),
    visionPane: deepMerge(base.visionPane, raw.visionPane),
    placementSpace: deepMerge(base.placementSpace, raw.placementSpace),
    meru: deepMerge(base.meru, raw.meru),
    scene: deepMerge(base.scene, raw.scene),
    lightSources: Array.isArray(raw.lightSources) ? raw.lightSources : base.lightSources,
    boundaryContract: deepMerge(base.boundaryContract, raw.boundaryContract),
  };
}

function deepMerge(base, override) {
  if (override === undefined || override === null) return clone(base);
  if (base === undefined || base === null) return clone(override);
  if (Array.isArray(base) || Array.isArray(override) || typeof base !== 'object' || typeof override !== 'object') {
    return clone(override);
  }
  const out = clone(base);
  for (const [key, value] of Object.entries(override)) {
    out[key] = deepMerge(out[key], value);
  }
  return out;
}

function clone(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return structuredClone(value);
}

function asArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

// Re-exported for callers that want to know which manifest fields the
// implication pass writes to (used in the slimmed planning prompt).
export const SHOT_GLYPH_IMPLICATION_FIELDS = POLYGONIZER_MOUNTS;
