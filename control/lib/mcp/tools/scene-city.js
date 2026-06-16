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
import { planFractalCity } from '@/lib/graph/fractal-city';

export function mintFractalCity({ title, seed, anchor, depth, density, region, viewBox, time, elements, locale, ref, folderRef } = {}) {
  const manifest = {
    kind: 'fractal-city',
    seed: Number.isFinite(+seed) ? Math.trunc(+seed) : 1,
    anchor: anchor === 'tower' || anchor === 'freeway' ? anchor : null,   // anchor manji
    depth: Number.isFinite(+depth) ? Math.max(1, Math.min(3, Math.trunc(+depth))) : 2,
    density: Number.isFinite(+density) ? Math.max(0.2, Math.min(1, +density)) : 0.6,
    ...(time === 'day' || time === 'night' ? { time } : {}),   // daylight setting (omit → neutral); render route reads manifest.time
    ...(region && typeof region === 'object' ? { region } : {}),
    ...(viewBox && typeof viewBox === 'object' ? { viewBox } : {}),
    ...(elements && typeof elements === 'object' ? { elements } : {}),   // element toggles (opt-in streetcars/tram; the generator normalizes + aliases)
    ...(locale && typeof locale === 'string' ? { locale } : {}),   // regional cue — gates locale-weighted classes (e.g. one church in NA/SA/EU/PH)
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
  const { title, seed, anchor, depth, density, region, viewBox, time, elements, locale, ref, folder_ref: folderRef } = input;
  return mintFractalCity({ title, seed, anchor, depth, density, region, viewBox, time, elements, locale, ref, folderRef });
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
        time: { type: 'string', enum: ['day', 'night'], description: "Optional daylight setting: 'day' (sun + rooftop light + building shadows + day sky) or 'night' (streetlamp pools + moonlight + starry sky). Omit for a neutral flat render." },
        elements: { type: 'object', description: "Optional element toggles { name: bool }. Most city elements (buildings, roads, sidewalks, cars, streetlamps, …) are ON by default; pass `false` to drop one. STREETCARS are an opt-in exception — pass { streetcars: true } (aliases: tram / trams) to lay a tram line: a corridor boulevard runs straight down the city's longer axis with an uninterrupted double track, overhead wire, roofed boarding stops, and trams, and the rest of the city routes around its reserved strip. TOWNHOUSES are the other opt-in — pass { townhouses: true } (aliases: rowhouse / brownstone) to turn eligible residential blocks into continuous rows of attached rowhouse units (warm-masonry BROWNSTONE walk-ups with tall stoops, raised parlor doors, cheek-wall rails, and heavy cornices, or MODERN-STACKED panel/glass townhomes with flat parapets, two grade-level doors per lot, low stoops, and cantilevered box-bays). A row runs along a block's long edge; a 'full' row is double-loaded (doors + stoops on both faces). Every unit box is annotated with its structure / style / unit index for downstream consumers." },
        locale: { type: 'string', description: "Optional regional cue (e.g. 'north-america', 'south-america', 'europe', 'eastern-europe', 'russia', 'philippines', 'middle-east', 'africa', 'southeast-asia', 'east-asia', 'himalaya', 'indochina'; aliases like 'us'/'japan'/'tibet'/'thailand' normalize in) that gates locale-weighted building classes. Currently: seeds at most one 'religious place' (class:'religious') into the scene, its form chosen by locale — a CHURCH (chapel / gothic-revival basilica / Eastern-Orthodox five-dome, orthodox rising eastward), a MOSQUE (ottoman dome+four-minarets / persian pishtaq+bulbous-dome / west-african 'sahelian' mud mosque / javanese tiered-roof 'nusantara'; dominant in the Middle East, prominent in Africa / SE-Asia, rare in the West), or a BUDDHIST TEMPLE (East-Asian 'pagoda' tower / Theravada 'stupa' bell-dome / Himalayan 'tibetan' monastery; dominant across East Asia / the Himalaya / Indochina, rarer than even the mosque in the West). Omit (or any unlisted region) → none. Deterministic per seed." },
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
