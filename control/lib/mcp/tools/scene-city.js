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
import { registerTool } from '@/lib/mcp/server';
import { planFractalCity, normalizeCivicAreas } from '@/lib/graph/fractal-city';
import { isLandmarkShape } from '@/lib/graph/landmarks/index.js';
import { warmScenePng } from '@/lib/graph/scene-png-warm';

// Coerce the `landmark` input (single shape, array of shapes, or junk) into a stored value:
// a string for one monument, an array for a cluster, or null if nothing valid remains.
function normalizeLandmarkInput(landmark) {
  if (Array.isArray(landmark)) {
    const valid = landmark.filter(isLandmarkShape);
    return valid.length > 1 ? valid : (valid.length === 1 ? valid[0] : null);
  }
  return isLandmarkShape(landmark) ? landmark : null;
}

export function mintFractalCity({ title, seed, anchor, depth, density, baseScale, region, viewBox, time, elements, locale, landmark, civicAreas, climate, ref, folderRef } = {}) {
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
  const { title, seed, anchor, depth, density, baseScale, region, viewBox, time, elements, locale, landmark, civicAreas, climate, ref, folder_ref: folderRef } = input;
  return mintFractalCity({ title, seed, anchor, depth, density, baseScale, region, viewBox, time, elements, locale, landmark, civicAreas, climate, ref, folderRef });
}

export function registerSceneCityTools() {
  registerTool({
    name: 'create_fractal_city',
    description:
      "Mint a 3D cityscape from a tiny RECIPE — the fractal-generation path. You pass a seed plus a "
      + "few knobs; the substrate stores ONLY the recipe (no geometry) and regenerates the whole city "
      + "deterministically on render, so it costs almost no tokens and the same seed always rebuilds the "
      + "same city. The result is a live, dependency-free CSS preserve-3d HTML scene served at "
      + "`/api/sketches/<ref>/scene` (open it / embed it in an <iframe>); same artifact system as the other "
      + "illustration mints (persists with `manifest.kind === 'fractal-city'`). The generator recursively "
      + "subdivides the ground into non-square blocks (a coherent street grid with sidewalks, 2-lane mains, "
      + "stoplights, crosswalks, power lines), fills each block by a composition rule (1 large / 2 medium / "
      + "1 medium + 2 small / building + lot / 4 small / single-block megatower) with parking lots in the "
      + "gaps, and skins every building with a randomized facade (glass curtainwall / punched / banded; brick "
      + "masonry with arched windows + cornices for low-rise; balconies harmonized per building program; "
      + "rooftop kit of cell towers / water tanks / satellite dishes / smoke stacks; entrances, fire escapes, "
      + "dumpsters; cylindrical and setback skyscrapers). Reach for this on framing like 'generate a city / "
      + "make a cityscape / a downtown / a 3D city block / an urban scene'.",
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title for the resulting sketch artifact.' },
        seed: { type: 'integer', description: 'Deterministic seed — the whole city is a pure function of it. Same seed → same city.' },
        anchor: { type: 'string', enum: ['tower', 'freeway'], description: "Optional dominant 'anchor manji' that anchors the scene: a big central tower, or a curved elevated freeway. Omit for an unanchored uniform field." },
        depth: { type: 'integer', minimum: 1, maximum: 3, description: 'Quadrant recursion depth (default 2). Higher → more, smaller blocks.' },
        density: { type: 'number', minimum: 0.2, maximum: 1, description: 'Building density 0.2–1 (default 0.6).' },
        baseScale: { type: 'number', minimum: 0.3, maximum: 1.5, description: "Object size vs. the fixed frame (default 1). VALUES BELOW 1 shrink every object while the camera and aspect ratio stay put, fitting proportionally MORE, smaller blocks in the same scene — a broad 'zoom out, show more'. It's a uniform similarity transform (the city is generated in an enlarged region, then scaled back down), so the harmonious relative scale of streets/buildings/props is preserved exactly; only how much city fits the frame changes. e.g. 0.6 ≈ ~2.8× the blocks at ~60% size. Above 1 zooms in (fewer, larger blocks). Deterministic per seed." },
        time: { type: 'string', enum: ['day', 'night'], description: "Optional daylight setting: 'day' (sun + rooftop light + building shadows + day sky) or 'night' (streetlamp pools + moonlight + starry sky). Omit for a neutral flat render." },
        elements: { type: 'object', description: "Optional element toggles { name: bool }. Most city elements (buildings, roads, sidewalks, cars, streetlamps, …) are ON by default; pass `false` to drop one. STREETCARS are an opt-in exception — pass { streetcars: true } (aliases: tram / trams) to lay a tram line: a corridor boulevard runs straight down the city's longer axis with an uninterrupted double track, overhead wire, roofed boarding stops, and trams, and the rest of the city routes around its reserved strip. TOWNHOUSES are the other opt-in — pass { townhouses: true } (aliases: rowhouse / brownstone / dutch-row) to turn eligible residential blocks into continuous rows of attached rowhouse units (warm-masonry BROWNSTONE walk-ups with tall stoops, raised parlor doors, cheek-wall rails, and heavy cornices; MODERN-STACKED panel/glass townhomes with flat parapets, two grade-level doors per lot, low stoops, and cantilevered box-bays; or DUTCH ROW narrow brick canal-house units with pale trim bands, tight window rhythm, and stepped/neck/bell gable rooflines). A row runs along a block's long edge; a 'full' row is double-loaded (doors + stoops on both faces). Every unit box is annotated with its structure / style / unit index for downstream consumers. CIVIC DOMES are a third opt-in — pass { civicDomes: true } (aliases: rotunda / domes / civic / capitol) to re-tag a few of the city's largest plain buildings as neoclassical domed ROTUNDAS (a columned drum + pedimented portico under a dome), each in one of three dome forms (hemispheric capitol-stone / gilded onion / turquoise bulbous). Deterministic per seed; leaves every other building untouched." },
        locale: { type: 'string', description: "Optional regional cue (e.g. 'north-america', 'south-america', 'europe', 'eastern-europe', 'russia', 'philippines', 'middle-east', 'africa', 'southeast-asia', 'east-asia', 'himalaya', 'indochina'; aliases like 'us'/'japan'/'tibet'/'thailand' plus 'dutch'/'amsterdam'/'rotterdam'/'utrecht'/'belgium' normalize in) that gates locale-weighted building classes. Currently: seeds at most one 'religious place' (class:'religious') into the scene, its form chosen by locale — a CHURCH (chapel / gothic-revival basilica / Eastern-Orthodox five-dome, orthodox rising eastward), a MOSQUE (ottoman dome+four-minarets / persian pishtaq+bulbous-dome / west-african 'sahelian' mud mosque / javanese tiered-roof 'nusantara'; dominant in the Middle East, prominent in Africa / SE-Asia, rare in the West), or a BUDDHIST TEMPLE (East-Asian 'pagoda' tower / Theravada 'stupa' bell-dome / Himalayan 'tibetan' monastery; dominant across East Asia / the Himalaya / Indochina, rarer than even the mosque in the West). European-ish locale cues also turn townhouse rows on by default and strongly bias them toward DUTCH ROW facades unless { townhouses: false } is passed. Omit (or any unlisted region) → no locale-gated class. Deterministic per seed." },
        climate: { type: 'string', enum: ['temperate', 'tropical', 'equatorial'], description: "Optional CLIMATE that gates the street-tree species mix (default 'temperate'). 'tropical' / 'equatorial' drop conifers and turn about half the trees into coconut PALMS (slender bowed trunk + a fountain crown of drooping fronds); the rest stay the broadleaf variety (cluster puffs, spreading canopy domes, weeping crowns, two-tier layered canopies, codominant 'V' trunks). 'temperate' keeps conifers and the broadleaf variety with no palms. Deterministic per seed." },
        landmark: { oneOf: [{ type: 'string', enum: ['taj', 'cn-tower', 'skytree', 'rogers-centre', 'skydome', 'colosseum', 'arena', 'great-pyramid', 'louvre-pyramid', 'petronas-towers', 'big-ben', 'stonehenge', 'chinatown-gate', 'arc-de-triomphe', 'mobile-edm-hall', 'eiffel-tower'] }, { type: 'array', items: { type: 'string', enum: ['taj', 'cn-tower', 'skytree', 'rogers-centre', 'skydome', 'colosseum', 'arena', 'great-pyramid', 'louvre-pyramid', 'petronas-towers', 'big-ben', 'stonehenge', 'chinatown-gate', 'arc-de-triomphe', 'mobile-edm-hall', 'eiffel-tower'] } }], description: "Optional named MONUMENT(s) that become the city's root anchor in place of the generic tower: the Taj Mahal ('taj'), the CN Tower ('cn-tower'), Tokyo Skytree ('skytree'), the Rogers Centre / SkyDome stadium ('rogers-centre' / 'skydome'), an open-air Roman amphitheatre ('colosseum'), a modern domed sports arena ('arena'), the Great Pyramid of Giza ('great-pyramid'), the Louvre Pyramid ('louvre-pyramid'), the Petronas Towers ('petronas-towers'), Elizabeth Tower / Big Ben ('big-ben'), Stonehenge ('stonehenge'), a Chinatown gate ('chinatown-gate'), the Arc de Triomphe ('arc-de-triomphe'), or the Mobile EDM Hall ('mobile-edm-hall'), or the Eiffel Tower ('eiffel-tower'). Pass an ARRAY for an adjacent cluster — e.g. ['rogers-centre', 'cn-tower'] for the Toronto pair. The monument(s) are sized to their real ground footprint and RESERVED on the grid before roads, so the streets route around them; the city stays organised around the cluster, which renders at recognizable silhouette fidelity in /scene and the traversable /world. Best paired with anchor:'tower'. Deterministic per seed." },
        civicAreas: { type: 'array', items: { type: 'string', enum: ['town-square', 'school', 'strip-mall', 'city-park'] }, description: "Optional list of CIVIC AREAS — landmark-like districts that take real surface area and get the SAME up-front reservation a monument gets: each is sized, RESERVED on the grid before roads, and the streets / sidewalks / power lines / trees route around it (no infrastructure runs through it). Unlike a monument they need no special silhouette — each is composed from existing city primitives. Kinds: 'town-square' (a paved civic plaza with a tree cluster, perimeter benches, and corner lamps; aliases square / plaza), 'school' (a campus: a schoolhouse building plus an open green yard with a playground; aliases campus / schoolyard), 'strip-mall' (a long low retail strip fronting a parking apron with cars; aliases retail / mall), 'city-park' (an open green space, greenery-first, that VARIES per seed — trees + shrubs scattered by a recursive fractal clump-scatter, with a pond, looping gravel trails, and a medium community-centre building each appearing probabilistically; aliases park / greenspace / commons / gardens). Each requested kind is placed at most once, into a distinct slice of the city AWAY from the centre, so it composes with a centred `landmark` and the anchor tower. A district that can't fit clear of the others is skipped (reported in stats.civicAreasSkipped). Deterministic per seed." },
        region: { type: 'object', description: 'Optional world footprint { x, y, w, d } (default a ~30×18 block).' },
        viewBox: { type: 'object', description: 'Optional render viewBox { width, height }.' },
        ref: { type: 'string', description: 'Optional stable sketch ref.' },
        folder_ref: { type: 'string', description: 'Optional sketch folder to file under.' },
      },
      required: [],
    },
    handler: createFractalCityHandler,
  });
}
