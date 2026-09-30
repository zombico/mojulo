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
 *   { kind:'fractal-city', seed, anchor, depth, density, region?, viewBox?, title?,
 *     …opt-in channels (elements / landmark / civicAreas / edifices / walkers / traffic / fog / audio),
 *     blocks? (operator parcels laid before the roads), fidelity? ('massing' | 'skyline') }
 */

import { SketchRepository } from '@/lib/db/repositories/sketches';
import { normalizeEdificeEntries, resolveCityInsets } from '@/lib/graph/worlds/city-insets';
import { planFractalCity, normalizeCivicAreas, normalizeCityBlocks, normalizeCityFidelity, canonLocale } from '@/lib/graph/city/fractal-city';
import { CITY_FLAVORS, resolveMintFlavor } from '@/lib/graph/city/city-flavors';
import { CANAL } from '@/lib/graph/city/canal-city';

// a metro mint with no region gets a downtown frame: 8 × 5 blocks at a ~27-unit pitch (≈ 0.8 × 0.5 km)
const METRO_DEFAULT_REGION = { x: 2, y: 2, w: 220, d: 140 };
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

export function mintFractalCity({ title, seed, anchor, depth, density, baseScale, region, viewBox, time, elements, locale, landmark, civicAreas, climate, walkers, traffic, fog, clouds, audio, edifices, blocks, fidelity, anchorSeat, profile, flavor, canals, ref, folderRef } = {}) {
  const metro = profile === 'metro', canal = profile === 'canal';
  // METRO FLAVOUR (city-flavors.js): resolved here, once, and written into the row: the one asked for,
  // else the landmark's own city, else a seeded roll within the locale's region, else over all. The
  // planner never rolls, so a flavour added later moves no stored city. Its locale and climate fill
  // the recipe's gaps (the locale picks the religious building, the climate the street trees).
  const seedN = Number.isFinite(+seed) ? Math.trunc(+seed) : 1;
  const flavorKey = metro ? resolveMintFlavor({ flavor, landmarks: [].concat(normalizeLandmarkInput(landmark) || []), region: canonLocale(locale), seed: seedN }) : null;
  const FLV = flavorKey ? CITY_FLAVORS[flavorKey] : null;
  const manifest = {
    kind: 'fractal-city',
    seed: Number.isFinite(+seed) ? Math.trunc(+seed) : 1,
    anchor: anchor === 'tower' || anchor === 'freeway' ? anchor : null,   // anchor manji
    // metro blocks are ~110 m, so a real downtown frame needs more tiers than the stock 1–3
    depth: Number.isFinite(+depth) ? Math.max(1, Math.min(metro ? 6 : 3, Math.trunc(+depth))) : (metro ? 4 : 2),
    // PROPORTION CLASS: 'metro' keeps the storey and brings block pitch, rights-of-way,
    // lot grain, heights and the familiar-size cues into proportion with it. Omit ⇒ not stored ⇒ the stock
    // city, byte-identical. A metro recipe with no region gets a downtown frame (≈ 0.8 × 0.5 km).
    ...(metro ? { profile: 'metro' } : {}),
    ...(flavorKey ? { flavor: flavorKey } : {}),
    // CANAL TOWN: 'canal' is a different layout (canals, quays, bridges, canal houses; city/canal-city.js),
    // stored only as 'canal', with its layout when it names one. No region ⇒ an old core and three rings.
    ...(canal ? { profile: 'canal', ...(canals && (canals.layout === 'ring' || canals.layout === 'parallel') ? { canals: { layout: canals.layout } } : {}) } : {}),
    density: Number.isFinite(+density) ? Math.max(0.2, Math.min(1, +density)) : 0.6,
    // where the root tower sits vs the main crossing: 'side' (beside it, the crossing flanks the tower)
    // or 'centre' (the original centred tower). Omit ⇒ the planner's gate: side when the region exceeds
    // the default frame, centre otherwise — see planFractalCity.
    ...(anchorSeat === 'side' || anchorSeat === 'centre' ? { anchorSeat } : {}),
    ...(Number.isFinite(+baseScale) && +baseScale !== 1 ? { baseScale: Math.max(0.3, Math.min(1.5, +baseScale)) } : {}),   // object size vs. the fixed frame; <1 → more, smaller blocks ("zoom out, show more")
    ...(time === 'day' || time === 'night' ? { time } : {}),   // daylight setting (omit → neutral); render route reads manifest.time
    ...(region && typeof region === 'object' ? { region } : metro ? { region: { ...METRO_DEFAULT_REGION } } : canal ? { region: { ...CANAL.region } } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    // element toggles (opt-in streetcars/tram; the generator normalizes + aliases). FRONTAGE and ROUNDKIT are
    // where a NEW mint's default differs from a stored row's: the planner defaults are false (every existing
    // row re-renders byte-identically), and every city minted from here on is road-aware — entrances on the
    // face that fronts a road, parking entrances on the large masses — and wears the round street kit, unless
    // the caller sets the flag false. Written into the manifest so the row itself says so.
    ...((() => {
      const STAMPS = {
        frontage: ['frontage', 'entrances', 'entrance', 'roadAware', 'road-aware', 'parking_entrances', 'parkingEntrances'],   // the planner's aliases for each flag
        roundKit: ['roundKit', 'round', 'rounded', 'roundPoles'],
      };
      let out = elements;
      for (const [flag, keys] of Object.entries(STAMPS)) {
        if (Array.isArray(out)) { if (!out.some((e) => keys.includes(e))) out = [...out, flag]; }
        else if (out && typeof out === 'object') { if (!keys.some((k) => k in out)) out = { ...out, [flag]: true }; }
        else out = { [flag]: true };
      }
      return { elements: out };
    })()),
    ...(locale && typeof locale === 'string' ? { locale } : FLV && FLV.locale ? { locale: FLV.locale } : {}),   // regional cue — gates locale-weighted classes (e.g. one church in NA/SA/EU/PH)
    ...(climate === 'tropical' || climate === 'equatorial' ? { climate } : FLV && FLV.climate ? { climate: FLV.climate } : {}),   // species mix — tropical/equatorial swaps conifers for coconut palms among the street trees

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
    // opt-in volumetric fog (effects-layer P3.5) — `true` or a tuning object; absent/invalid
    // ⇒ not stored ⇒ no fog. The fractal-city fogBoxes extractor clips it against the
    // planned blocks; renders on the live /world path only (the /scene still ignores it).
    ...(fog === true || (fog && typeof fog === 'object' && !Array.isArray(fog)) ? { fog } : {}),
    // opt-in cloud deck (fog's sibling, effects-clouds.js) — `true` for the cheap undershot plane
    // or a tuning object ({ mode: 'full' } for the volumetric march); same fogBoxes gate, /world only.
    ...(clouds === true || (clouds && typeof clouds === 'object' && !Array.isArray(clouds)) ? { clouds } : {}),
    // opt-in audio channel (beats.plan.md) — soundtrack / wind / sfx cues; /world only.
    ...(audio && typeof audio === 'object' && !Array.isArray(audio) ? { audio } : {}),
    // minted EDIFICE sketches placed in the fabric (worlds/city-insets.js): [{ ref, at?: [x, y] }] in
    // city units; the plot + a sidewalk ring is reserved before roads. Validated here — a ref that is
    // missing or not an edifice refuses the mint by name.
    ...((() => { const ed = normalizeEdificeEntries(edifices); return ed.length ? { edifices: ed } : {}; })()),
    // operator BLOCKS (fractal-city.js header): parcels laid before the roads, filled by use. Stored in
    // the canonical rect form (or the `{ map }` convenience, expanded against the region at plan time);
    // nothing valid ⇒ not stored ⇒ zero bytes. Advisory placement: stats.blocksLaid names each one.
    ...((() => { const bl = normalizeCityBlocks(blocks); return bl ? { blocks: bl } : {}; })()),
    // FIDELITY dial: 'massing' | 'skyline' prune the finished plan to its masses + planes ('full', the
    // default, is not stored). Same seed at any level is the same city, less dressing.
    ...((() => { const f = normalizeCityFidelity(fidelity); return f !== 'full' ? { fidelity: f } : {}; })()),
    ...(title ? { title } : {}),
  };

  // Expand once to validate the recipe is renderable + return a stat readout (no
  // geometry is persisted — only the recipe above is stored). Insets resolve through the DB
  // here so a bad edifice ref fails the mint, not the stored world link.
  const { stats } = planFractalCity({ ...manifest, insets: resolveCityInsets(manifest) });

  const sketch = SketchRepository.create({
      title: title || `city ${manifest.seed}${manifest.anchor ? ' · ' + manifest.anchor : ''}`,
      manifest, ref, folderRef: folderRef ?? null,
    });

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
  const { title, seed, anchor, depth, density, baseScale, region, viewBox, time, elements, locale, landmark, civicAreas, climate, walkers, traffic, fog, clouds, audio, blocks, fidelity, anchorSeat, profile, flavor, canals, ref, folder_ref: folderRef } = input;
  return mintFractalCity({ title, seed, anchor, depth, density, baseScale, region, viewBox, time, elements, locale, landmark, civicAreas, climate, walkers, traffic, fog, clouds, audio, blocks, fidelity, anchorSeat, profile, flavor, canals, ref, folderRef });
}
