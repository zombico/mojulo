/**
 * create_fractal_city — an autogenerative cityscape mint.
 *
 * Fractal-generation philosophy, end to end: the operator passes a tiny RECIPE
 * (a seed + a handful of params). The substrate stores ONLY that recipe as a
 * sketch manifest (`kind: 'fractal-city'`) — no geometry. The full city (hundreds
 * of buildings with facades, balconies, rooftop kit, roads, sidewalks, parking
 * lots, doodads) is regenerated DETERMINISTICALLY on render by
 * `/api/sketches/<ref>/scene`. Thousands of boxes from ~6 numbers; near-zero
 * tokens stored or transmitted; same seed always rebuilds the same city.
 *
 * The scene is a self-contained, dependency-free CSS preserve-3d HTML page (plays
 * anywhere an <img>/<iframe> goes). It rides the sketch artifact system exactly
 * like the other illustration mints — the discriminator is `manifest.kind`.
 *
 * Stored manifest (the whole recipe):
 *   { kind:'fractal-city', seed, anchor, depth, density, region?, viewBox?, title? }
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { planFractalCity, normalizeCivicAreas } from '@/lib/graph/city/fractal-city';
import { isLandmarkShape } from '@/lib/graph/landmarks/index.js';
import { warmScenePng } from '@/lib/graph/scene/scene-png-warm';

// Coerce the `landmark` input (single shape, array of shapes, or junk) into a stored value:
// a string for one monument, an array for a cluster, or null if nothing valid remains.
function normalizeLandmarkInput(landmark) {
  if (Array.isArray(landmark)) {
    const valid = landmark.filter(isLandmarkShape);
    return valid.length > 1 ? valid : (valid.length === 1 ? valid[0] : null);
  }
  return isLandmarkShape(landmark) ? landmark : null;
}

export function mintFractalCity({ title, seed, anchor, depth, density, baseScale, region, viewBox, time, elements, locale, landmark, civicAreas, climate, walkers, traffic, ref, folderRef } = {}) {
  const manifest = {
    kind: 'fractal-city',
    seed: Number.isFinite(+seed) ? Math.trunc(+seed) : 1,
    anchor: anchor === 'tower' || anchor === 'freeway' ? anchor : null,   // anchor manji
    depth: Number.isFinite(+depth) ? Math.max(1, Math.min(3, Math.trunc(+depth))) : 2,
    density: Number.isFinite(+density) ? Math.max(0.2, Math.min(1, +density)) : 0.6,
    ...(Number.isFinite(+baseScale) && +baseScale !== 1 ? { baseScale: Math.max(0.3, Math.min(1.5, +baseScale)) } : {}),   // object size vs. the fixed frame; <1 → more, smaller blocks ("zoom out, show more")
    ...(time === 'day' || time === 'night' ? { time } : {}),   // daylight setting (omit → neutral); render route reads manifest.time
    ...(region && typeof region === 'object' ? { region } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(elements && typeof elements === 'object' ? { elements } : {}),   // element toggles (opt-in streetcars/tram; the generator normalizes + aliases)
    ...(locale && typeof locale === 'string' ? { locale } : {}),   // regional cue — gates locale-weighted classes (e.g. one church in NA/SA/EU/PH)
    ...(climate === 'tropical' || climate === 'equatorial' ? { climate } : {}),   // species mix — tropical/equatorial swaps conifers for coconut palms among the street trees

    ...((() => { const lm = normalizeLandmarkInput(landmark); return lm ? { landmark: lm } : {}; })()),   // monument(s) as the reserved root anchor (one shape, or an array for a cluster like Toronto's CN Tower + Rogers Centre)
    ...((() => { const ca = normalizeCivicAreas(civicAreas); return ca.length ? { civicAreas: ca } : {}; })()),   // reserved districts (town-square / school / strip-mall), each given a surface-area budget before roads
    // ambient walking people on looped sidewalk/plaza rings (city/walkers.plan.md). Opt-in — omit ⇒
    // byte-identical, static-only city. `true` for defaults, or { count } to cap how many loops. Motion
    // is /world (three.js) only; the /scene CSS3D still + gallery PNG stay static.
    ...(walkers ? { walkers: walkers === true ? true
      : (typeof walkers === 'object'
        ? { ...(Number.isFinite(+walkers.count) ? { count: Math.max(1, Math.min(24, Math.trunc(+walkers.count))) } : {}) }
        : true) } : {}),
    // ambient moving traffic on the main avenues (the driver-ants). Opt-in; omit ⇒ static-only city.
    // `true` for defaults, or { side:'left'|'right' } for the driving paradigm (right-hand default).
    // Motion is /world (three.js) only; the /scene CSS3D still + gallery PNG stay static.
    ...(traffic ? { traffic: traffic === true ? true
      : (typeof traffic === 'object' && traffic.side === 'left' ? { side: 'left' } : true) } : {}),
    ...(title ? { title } : {}),
  };

  // Expand once to validate the recipe is renderable + return a stat readout (no
  // geometry is persisted — only the recipe above is stored).
  const { stats } = planFractalCity(manifest);

  let sketch;
  try {
    sketch = SketchRepository.create({
      title: title || `city ${manifest.seed}${manifest.anchor ? ' · ' + manifest.anchor : ''}`,
      manifest, ref, folderRef: folderRef ?? null,
    });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  // Pre-bake the gallery preview PNG in the background so the Maker card is a
  // warm disk-cache hit instead of a first-view headless render.
  warmScenePng(sketch);

  return {
    ok: true,
    ref: sketch.ref,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    sceneUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/scene`,
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    recipe: manifest,
    stats,
  };
}

export async function createFractalCityHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_fractal_city requires a recipe object');
  }
  const { title, seed, anchor, depth, density, baseScale, region, viewBox, time, elements, locale, landmark, civicAreas, climate, walkers, traffic, ref, folder_ref: folderRef } = input;
  return mintFractalCity({ title, seed, anchor, depth, density, baseScale, region, viewBox, time, elements, locale, landmark, civicAreas, climate, walkers, traffic, ref, folderRef });
}
