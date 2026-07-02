/**
 * create_painted_landscape — closed-vocabulary landscape minter.
 *
 * The model picks one named glyph per family (heartbeat, splatch, optional
 * structure-glyph) plus an optional seed string and light override; the
 * substrate resolves glyph → recipe, samples wave parameters within the
 * heartbeat's declared ranges, derives a balanced 4-stop palette from the
 * splatch's three seed colors, lays out structures via the structure-glyph's
 * seeded layout, and renders the scene back-to-front as a flat-Lambert,
 * borderless SVG.
 *
 * Persists with `manifest.kind === 'painted-landscape'`. The SVG route
 * dispatches on that discriminator to render via
 * `renderPaintedLandscapeToSvg`. No new persistence layer — painted
 * landscapes ride the sketch artifact system like manji-trees do.
 *
 * Token economy: ~30 tokens of authoring covers what would otherwise be
 * ~14K tokens of raw SVG or ~250 tokens of fully-specified manifest.
 * See `glyph-driven-landscape.spike.gen.test.js` for the measurement.
 */

import { registerTool } from '@/lib/mcp/server';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { SketchFolderRepository } from '@/lib/db/repositories/sketch-folders';
import {
  validatePaintedLandscape,
  heartbeatIds,
  splatchIds,
  structureGlyphIds,
  cameraIds,
  sceneIds,
  skyIds,
  computeSceneCompletion,
  HEARTBEATS,
  SPLATCHES,
  STRUCTURE_GLYPHS,
  CAMERAS,
  SCENES,
  SKIES,
  RENDER_STYLES,
} from '@/lib/graph/polygonizer/painted-landscape.js';

export function mintPaintedLandscape({
  title,
  heartbeat,
  splatch,
  structures,
  scene,
  seed,
  light,
  paletteOverrides,
  heartbeatOverrides,
  renderStyle,
  camera,
  sky,
  forest,
  ref,
  folderRef,
} = {}) {
  if (!title || typeof title !== 'string') {
    throw new Error('`title` is required (string)');
  }
  if (ref !== undefined) {
    if (typeof ref !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(ref)) {
      throw new Error('`ref` must be 1-64 chars of [A-Za-z0-9_-] if provided');
    }
  }
  if (folderRef !== undefined && folderRef !== null) {
    if (typeof folderRef !== 'string' || !folderRef) {
      throw new Error('`folderRef` must be a non-empty string or null if provided');
    }
    const folder = SketchFolderRepository.getByRef(folderRef);
    if (!folder) {
      throw new Error(`Folder '${folderRef}' not found`);
    }
  }

  const manifest = {
    kind: 'painted-landscape',
    heartbeat,
    splatch,
    ...(structures !== undefined && structures !== null ? { structures } : {}),
    ...(scene !== undefined && scene !== null ? { scene } : {}),
    ...(seed !== undefined && seed !== null ? { seed } : {}),
    ...(light !== undefined && light !== null ? { light } : {}),
    ...(paletteOverrides !== undefined && paletteOverrides !== null ? { paletteOverrides } : {}),
    ...(heartbeatOverrides !== undefined && heartbeatOverrides !== null ? { heartbeatOverrides } : {}),
    ...(renderStyle !== undefined && renderStyle !== null ? { renderStyle } : {}),
    ...(camera !== undefined && camera !== null ? { camera } : {}),
    ...(sky !== undefined && sky !== null ? { sky } : {}),
    ...(forest !== undefined && forest !== null ? { forest } : {}),
    ...(title ? { title } : {}),
  };

  const errors = validatePaintedLandscape(manifest);
  if (errors.length) {
    throw new Error(`Invalid painted-landscape manifest:\n - ${errors.join('\n - ')}`);
  }

  let sketch;
  try {
    sketch = SketchRepository.create({ title, manifest, ref, folderRef: folderRef ?? null });
  } catch (err) {
    if (err && /UNIQUE constraint failed/.test(err.message || '')) {
      throw new Error(`A sketch with ref '${ref}' already exists`);
    }
    throw err;
  }

  const enc = encodeURIComponent(sketch.ref);
  return {
    ok: true,
    ref: sketch.ref,
    url: `/sketches/${enc}`,
    svgUrl: `/api/sketches/${enc}/svg?inline=1`,
    worldUrl: `/api/sketches/${enc}/world`,                        // live three.js polygon world
    raymarchUrl: `/api/sketches/${enc}/world?render=raymarch`,     // per-pixel raymarch (terrain/water/sky)
    ...(scene ? { completion: computeSceneCompletion(scene) } : {}),
  };
}

export async function createPaintedLandscapeHandler(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('create_painted_landscape requires { title, heartbeat, splatch }');
  }
  const {
    title,
    heartbeat,
    splatch,
    structures,
    scene,
    seed,
    light,
    paletteOverrides,
    heartbeatOverrides,
    renderStyle,
    camera,
    sky,
    forest,
    ref,
    folder_ref: folderRef,
  } = input;
  return mintPaintedLandscape({
    title, heartbeat, splatch, structures, scene, seed, light,
    paletteOverrides, heartbeatOverrides, renderStyle, camera, sky, forest, ref, folderRef,
  });
}

function heartbeatCatalogue() {
  return Object.entries(HEARTBEATS)
    .map(([id, recipe]) => {
      const engine = recipe.engine || 'sine-stack';
      return `  • ${id} [${engine}] — ${recipe.intent} (aliases: ${recipe.aliases.join(', ')})`;
    })
    .join('\n');
}
function splatchCatalogue() {
  return Object.entries(SPLATCHES)
    .map(([id, s]) => `  • ${id} — ${s.intent} (seeds: ${s.seeds.join(', ')})`)
    .join('\n');
}
function structureCatalogue() {
  return Object.entries(STRUCTURE_GLYPHS)
    .map(([id, g]) => `  • ${id} — ${g.intent}`)
    .join('\n');
}
function cameraCatalogue() {
  return Object.entries(CAMERAS)
    .map(([id, c]) => `  • ${id} — ${c.intent} (aliases: ${c.aliases.join(', ')})`)
    .join('\n');
}
function skyCatalogue() {
  return Object.entries(SKIES)
    .map(([id, s]) => `  • ${id} — ${s.intent} (aliases: ${s.aliases.join(', ')})`)
    .join('\n');
}
function sceneCatalogue() {
  return Object.entries(SCENES)
    .map(([id, s]) => {
      const total = ['near', 'mid', 'far'].reduce(
        (sum, band) => sum + (s.fill[band] || []).reduce((t, e) => t + e.count, 0), 0,
      );
      const affinity = [
        s.affinity?.heartbeats?.length ? `heartbeats: ${s.affinity.heartbeats.join('/')}` : '',
        s.affinity?.splatches?.length ? `splatches: ${s.affinity.splatches.join('/')}` : '',
      ].filter(Boolean).join('; ');
      return `  • ${id} — ${s.intent} (${total} fill items${affinity ? `; affinity ${affinity}` : ''})`;
    })
    .join('\n');
}

export function registerPaintedLandscapeTools() {
  registerTool({
    name: 'create_painted_landscape',
    description:
      `Mint a painterly Lambert-shaded landscape by picking one named glyph per family. The substrate resolves glyph → recipe, seeded sampling picks concrete wave parameters within the heartbeat's declared ranges, the splatch's three seed colors derive a balanced 4-stop palette via luminance-sorted interpolation, and the structure-glyph's seeded layout scatters obelisks / boxes that sit on the elevated wave surface. The scene renders back-to-front, borderless, as flat-Lambert polygons (analytic surface normals from the wave's slope; per-face normals for structures). Reach for this when the user wants a landscape that reads as "painted" — receding hills, dunes, water, terraced fields — without authoring waveforms or hex stops.\n\nManifest persisted with kind \`painted-landscape\`; the existing /api/sketches/<ref>/svg route dispatches on that discriminator to render via renderPaintedLandscapeToSvg. Output is one SVG ~50-130 KB; cost is ~12-32× cheaper than wave-field-mesh smooth for comparable surfaces.\n\nClosed vocabularies (ship a new card to extend; the model never authors raw waves or hex):\n\nHeartbeats — geometry recipes; each has parameter RANGES, a default light direction, and an **engine** declared in brackets:\n\n  • \`[sine-stack]\` heartbeats produce PERIODIC structure (regular ridges, repeating swells, ribbed terraces). Reach for these when the surface should READ as periodic: terraced fields, ocean swell, corrugated forms.\n  • \`[fbm]\` heartbeats produce IRREGULAR structure via fractional Brownian motion over seeded value noise. Reach for these when the surface should READ as natural: meadows, dunes, glaciers, broken ground, anything with "bumpy throughout, scales naturally" character. fBm is the default for naturalistic terrain — pick a sine card only when periodicity is the intent.\n\nThe full catalogue:\n${heartbeatCatalogue()}\n\nSplatches — three seed colours per palette; derivation algorithm sorts by Rec.709 luminance, uses endpoints as shadow/highlight, interpolates two intermediate stops. Same splatch → same palette across all seeds (palette is independent of seed; only geometry and structure placement vary with seed):\n${splatchCatalogue()}\n\nStructure glyphs — ARCHITECTURAL scatter (box / obelisk faces), fixed count; each structure sits at z_base = waveValue at its footprint centroid, so it rides the hill it lands on. Use these for ruins / monuments / villages, NOT nature:\n${structureCatalogue()}\n\nScenes — the BIOME FILL + completion unit for NATURE landscapes. A scene card declares which natural scatter kinds (cone / canopy / boulder / tuft) belong and how many sit in each depth band (near / mid / far), plus a heartbeat+splatch affinity hint. The substrate scatters them on the wave surface, depth-scaled, with contact shadows — turning a moody-but-empty terrain swatch into a place that READS. \"Completion\" = every band's declared quota is placed; the mint result returns a per-band completion report. Reach for a scene (not a structure glyph) whenever the landscape should read as forest / meadow / coast / alpine rather than ruins. Pick a heartbeat+splatch from the scene's affinity for a coherent pairing, then front-light it:\n${sceneCatalogue()}\n\nSeeded variation: \`seed\` is any non-empty string; same \`(heartbeat, splatch, structures, seed)\` → byte-identical scene; same triple with new seed → coherent variation within the recipe's rules (wave phases shift, structure positions shift, palette + counts hold). Omit \`seed\` to use the default \`'default'\` seed.\n\nLight override: \`light: { x, y, z }\` overrides the heartbeat's defaultLight. Useful when you want one heartbeat's geometry under a different illumination (golden-hour over dunes, overhead over water). Light vector is normalized at render time. The light's ELEVATION (\`z\`) also drives the sky (see below): a high z is midday, a low z is dusk, a NEGATIVE z is night (sun below the horizon).\n\nSky (ON BY DEFAULT): every painted landscape gets a derived zenith→horizon gradient backdrop + atmospheric haze (distant terrain dissolves into the horizon; water reflects the sky). Both derive from the splatch palette + \`light.z\`, spanning the full day → dusk → twilight → night arc off that one number — no authoring. Pass \`sky: false\` for a flat background, or \`sky: { hazeStrength }\` to tune the depth fade. Wireframe renderStyle is always sky-less.\n\nClouds (opt-in via \`sky: { clouds }\`): the sky is authored top-down, like the ground. Clouds are a 2D screen-space layer (no 3D) painted behind the terrain, colored from the same sky derivation so they go white by day, warm-lit on the undersides at dusk, dark at night — automatically. Knobs:\n  • \`coverage\` (0 clear → 1 overcast) — how much sky is clouded.\n  • \`altitude\` (0–1) — DISTANCE FROM THE HORIZON, the most expressive knob: 0 = fat cumulus hugging the horizon, 1 = thin cirrus near the zenith. It sets both the band position AND the puff shape. \`high cumulus\` = high altitude (~0.7) + high \`volume\` (~1.6).\n  • \`breaks: [{ x, y, radius }]\` — clearings, the DUAL of terrain basins (a basin subtracts from the elevation field; a break subtracts from the cloud field). Normalized sky coords: x 0→1 left→right, y 0→1 horizon→zenith. Use for sun-gaps and clear patches.\n  • \`style\` — \`wisp\` (smooth sine-blob clouds) or \`grid\` (pixel-art blocks that harmonize with the faceted terrain; default). \`volume\` / \`fade\` fine-tune fullness and edge softness.\nExamples: \`sky: { clouds: 0.4 }\` (light scattered cover); \`sky: { clouds: { coverage: 0.5, altitude: 0.7, volume: 1.6, style: 'wisp' } }\` (high cumulus); \`sky: { clouds: { coverage: 0.8, altitude: 0.4, breaks: [{ x: 0.8, y: 0.3, radius: 0.22 }] } }\` (overcast with a sun-gap).\n\nAdornments (opt-in via \`sky: { sun, stars, moon }\`, sibling keys of \`clouds\`): celestial marks that share the sky band and ride the SAME day→night arc off \`light.z\` — no authoring beyond the knob. They paint BEHIND clouds, so cloud cover (or a break) occludes them — a sun behind a break reads as god-rays.\n  • \`sun\` — a warm disc + radial halo at the projected light azimuth/elevation. ON ONLY ABOVE THE HORIZON: it auto-hides once \`light.z\` goes negative. White-hot under a high sun, sunset-orange as it drops. \`{ glow, size, position }\` tune it (\`position: { x, y }\` overrides the projected spot). \`sky: { sun: true }\` or \`sky: 'golden-sun'\`.\n  • \`stars\` — faint scatter in the upper sky, denser toward the zenith, deterministic. NIGHT-GATED: a no-op by day, fades in as \`light.z\` goes negative. A density number or \`{ density, seed }\`. \`sky: 'starry-night'\`.\n  • \`moon\` — a pale disc + soft halo, high and opposite the sun's azimuth. NIGHT-GATED like stars. \`{ phase, size, position, paraselene, blend }\`; \`phase\` 1 full → 0 new carves a crescent (the dark part is not drawn — only the lit sliver shows); \`paraselene: true\` adds a moon dog (faint 22° halo ring + two mock moons); \`blend: true\` makes the moon a soft glow that dissolves into the sky instead of a sharp disc. \`sky: 'harvest-moon'\`.\nSet a NEGATIVE \`light.z\` for stars/moon to appear (the sun is below the horizon). Examples: \`sky: { sun: { glow: 1.4 } }\` (sunny, low-sun glow); \`sky: { stars: 0.8, moon: { phase: 0.4 } }\` with \`light: { x: 0.3, y: 0.3, z: -0.4 }\` (crescent-moon night).\n\nNight phenomena (also NIGHT-GATED, also sibling keys of \`clouds\`): the night-sky expansion of adornments — all require a negative \`light.z\`.\n  • \`aurora\` — undulating luminous curtains (green by default; \`hue\` shifts green↔magenta, \`intensity\` brightness + ribbon count). \`sky: { aurora: true }\` or \`{ aurora: { hue: 0.6 } }\`.\n  • \`comet\` — a nucleus + coma + a tail that points ANTI-SUNWARD (away from the now-set sun). \`{ length, size, position, direction }\`. \`sky: { comet: true }\`.\n  • \`meteors\` — streaks radiating from a radiant point; a count number or \`{ count, radiant, seed }\`. \`sky: { meteors: 18 }\`.\nExample: \`sky: { stars: 0.7, aurora: true, meteors: 20 }\` with \`light: { x: 0.3, y: 0.3, z: -0.5 }\` (full night sky show).\n\nNamed sky presets — the easiest path is \`sky: '<id>'\` (a sky-card id), the same closed-vocabulary move as splatches and cameras. The substrate fills in the cloud numbers:\n${skyCatalogue()}\n\nHeartbeat overrides (fine-grained geometry tuning): pass \`heartbeatOverrides: { waves?, samples? }\` to tune how the heartbeat realizes WITHOUT abandoning the named enum.\n  • \`waves: [{ ampScale?, cuScale?, cvScale? }, ...]\` — per-component multiplicative scales applied to the heartbeat's amplitude / cycles-u / cycles-v ranges BEFORE seeded sampling. Length must be ≤ the heartbeat's component count. Null or missing entries leave that component unscaled. Default scales are 1.0 (no change). Useful for "this heartbeat but quieter / steeper / wider-wavelength" without inventing a new heartbeat.\n  • \`samples: { u: int, v: int }\` — override the heartbeat's recommended cell density. Both axes must be integers ≥ 2. Use to push detail higher on a coarse heartbeat or coarsen a fine heartbeat for stylistic effect.\nSeeded determinism is preserved: \`(heartbeat, seed, heartbeatOverrides)\` → identical waves. Same heartbeat with different overrides → different waves at the same seed.\n\nPalette overrides (fine-grained color tuning): pass \`paletteOverrides: { stops?, positions?, gamma? }\` to tune how the splatch's derived ramp shades the scene WITHOUT abandoning the splatch.\n  • \`stops: { shadow?, base?, mid?, highlight? }\` — replace any subset of the derived stops with explicit \`#rrggbb\` hex. Useful to deepen a shadow, warm a highlight, or replace a single role without inventing a new splatch.\n  • \`positions: [0, p1, p2, 1]\` — reposition the four stops on the [0, 1] brightness ramp. Default is linear \`[0, 1/3, 2/3, 1]\`. Compressing \`p1\` toward 0 pushes "mid" tonality closer to shadows (high-contrast read); pulling \`p1\` toward \`p2\` widens the basin (more midtones in the body, narrower shadows and highlights). Must start at 0, end at 1, strictly increasing.\n  • \`gamma\` — brightness curve on the Lambert→ramp mapping. Default 1.0 (linear). \`>1\` deepens midtones (more atmospheric, contrasty); \`<1\` brightens midtones (flatter, lifted). Positive finite number.\nThe three overrides are orthogonal: \`stops\` swaps colors, \`positions\` redistributes them, \`gamma\` reshapes the brightness response. The splatch stays deterministic; overrides express "this splatch under tuned lighting." Closed-vocabulary discipline is intact — the model still names a splatch — but it can fine-tune within that name.\n\nCameras (lock the projection per scene): pass \`camera\` as the id of a camera-glyph card to bind the scene's vanishing points, room basis, vertical axis, and depth foreshortening. When omitted, the substrate's default projection is used (≈ \`medium-survey\`). Same scene under different cameras gives compositionally distinct shots — wide vs hero vs overhead — from one heartbeat+splatch+seed triple.\n${cameraCatalogue()}\n\nGuidance: pair \`top-down-survey\` with \`topographic\` renderStyle + chart-style splatches (\`chart-primary\`, \`vector-cyan\`) for true cartographic / topo-map output. Pair \`low-angle-hero\` with structure glyphs (\`monument-row\`, \`village-cluster\`) so the structures read as heroic / monumental. Pair \`wide-cinematic\` with cinematic splatches (\`velvet-cinema\`, \`harvest-gold\`, \`mist-coastal\`) under \`painterly\`.\n\nRender styles: pass \`renderStyle\` to swap how cells are stroked + filled (geometry and Lambert math are identical across styles). Default is \`painterly\`.\n  • \`painterly\` — Lambert blocks with stroke=fill (no visible borders). The cinematic / classic-landscape look. Pairs with any splatch; \`velvet-cinema\`, \`harvest-gold\`, \`mist-coastal\` are tuned for it.\n  • \`topographic\` — Lambert blocks WITH dark cell borders. The vector-map / topo-chart / textbook-chart look. Pairs with \`chart-primary\`, \`vector-cyan\`, \`bone-trio\` for chart aesthetics.\n  • \`wireframe\` — no fill, Lambert-colored strokes on the shadow-colored field. The pure-vector-display / 80s-textbook-math-cover / outrun-grid look. Pairs with \`terminal-amber\`, \`synthwave-neon\`, \`vector-cyan\` for retro-tech aesthetics.\n\nStyle is orthogonal to heartbeat and splatch — the same (heartbeat, splatch, seed) under three renderStyles gives three distinct visual registers from the same scene.\n\nOmit \`structures\` for a pure terrain render.`,
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title for the resulting sketch artifact.',
        },
        heartbeat: {
          type: 'string',
          enum: heartbeatIds(),
          description: 'Named geometry recipe. See description for the catalogue.',
        },
        splatch: {
          type: 'string',
          enum: splatchIds(),
          description: 'Named palette recipe (3 seed colors → 4-stop ramp). See description for the catalogue.',
        },
        structures: {
          type: 'string',
          enum: structureGlyphIds(),
          description: 'Optional ARCHITECTURAL scatter recipe (box / obelisk). For ruins / monuments / villages. Omit for a pure terrain render or use `scene` for nature fill.',
        },
        scene: {
          type: 'string',
          enum: sceneIds(),
          description: 'Optional BIOME fill + completion unit (cone / canopy / boulder / tuft scattered across near/mid/far depth bands until each band\'s quota is met). The way to make a NATURE landscape read as a place. The mint result returns a per-band completion report. Orthogonal to `structures`; both may be set.',
        },
        seed: {
          type: 'string',
          description: "Optional seed string for within-recipe variation. Defaults to 'default' when omitted; same seed yields the same scene.",
        },
        light: {
          type: 'object',
          additionalProperties: false,
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            z: { type: 'number' },
          },
          required: ['x', 'y', 'z'],
          description: 'Optional light direction override (world space). Defaults to the heartbeat\'s defaultLight when omitted.',
        },
        heartbeatOverrides: {
          type: 'object',
          additionalProperties: false,
          description: 'Optional fine-grained geometry tuning on top of the chosen heartbeat. All sub-fields are optional and independent. Scales are multiplicative on the heartbeat\'s parameter ranges; samples is an absolute override.',
          properties: {
            waves: {
              type: 'array',
              description: 'Per-component multiplicative scales on the heartbeat\'s amplitude / cycles-u / cycles-v ranges. Length must be ≤ the heartbeat\'s component count. Null entries skip that component.',
              items: {
                anyOf: [
                  { type: 'null' },
                  {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      ampScale: { type: 'number', exclusiveMinimum: 0, description: 'Multiplier on the component\'s amplitude range.' },
                      cuScale:  { type: 'number', exclusiveMinimum: 0, description: 'Multiplier on the component\'s u-cycles range.' },
                      cvScale:  { type: 'number', exclusiveMinimum: 0, description: 'Multiplier on the component\'s v-cycles range.' },
                    },
                  },
                ],
              },
            },
            samples: {
              type: 'object',
              additionalProperties: false,
              required: ['u', 'v'],
              properties: {
                u: { type: 'integer', minimum: 2, description: 'Cell count along the u axis (lateral).' },
                v: { type: 'integer', minimum: 2, description: 'Cell count along the v axis (depth).' },
              },
              description: 'Override the heartbeat\'s recommended cell density. Both axes must be integers ≥ 2.',
            },
          },
        },
        paletteOverrides: {
          type: 'object',
          additionalProperties: false,
          description: 'Optional fine-grained palette tuning on top of the chosen splatch. All sub-fields are optional and independent.',
          properties: {
            stops: {
              type: 'object',
              additionalProperties: false,
              description: 'Replace any subset of derived stops with explicit #rrggbb hex. Roles: shadow, base, mid, highlight.',
              properties: {
                shadow: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', description: '#rrggbb hex replacing the derived shadow stop.' },
                base: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', description: '#rrggbb hex replacing the derived base stop.' },
                mid: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', description: '#rrggbb hex replacing the derived mid stop.' },
                highlight: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$', description: '#rrggbb hex replacing the derived highlight stop.' },
              },
            },
            positions: {
              type: 'array',
              minItems: 4,
              maxItems: 4,
              items: { type: 'number', minimum: 0, maximum: 1 },
              description: 'Stop positions on the [0, 1] brightness ramp. Default is linear [0, 1/3, 2/3, 1]. Must start at 0, end at 1, strictly increasing.',
            },
            gamma: {
              type: 'number',
              exclusiveMinimum: 0,
              description: 'Brightness curve on the Lambert→ramp mapping. Default 1.0 (linear). >1 deepens midtones; <1 brightens.',
            },
          },
        },
        renderStyle: {
          type: 'string',
          enum: RENDER_STYLES,
          description: 'Optional polygon-render style. `painterly` (default) = Lambert blocks, no borders, cinematic. `topographic` = Lambert blocks with dark borders, vector-map / topo-chart feel. `wireframe` = no fill, Lambert-colored strokes on a shadow field, 80s-textbook / outrun-grid feel.',
        },
        camera: {
          type: 'string',
          enum: cameraIds(),
          description: 'Optional camera-glyph id. Locks the scene\'s vanishing points, room basis, and vertical projection per the named card. Omit to use the substrate\'s default projection (close to `medium-survey`).',
        },
        sky: {
          oneOf: [
            { type: 'string', enum: skyIds(), description: 'Named sky preset (card id) — the easiest path. See the sky catalogue in the description.' },
            { type: 'boolean' },
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                hazeStrength: { type: 'number', minimum: 0, description: 'Atmospheric-haze depth fade toward the horizon (default 0.6).' },
                clouds: {
                  oneOf: [
                    { type: 'number', minimum: 0, description: 'Shorthand for coverage 0 (clear) → 1 (overcast).' },
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        coverage: { type: 'number', minimum: 0, description: 'How much sky is clouded, 0 (clear) → 1 (overcast).' },
                        altitude: { type: 'number', minimum: 0, maximum: 1, description: 'Distance from the horizon (2D screen-vertical, NOT 3D). 0 = fat cumulus hugging the horizon; 1 = thin cirrus near the zenith. Sets BOTH band position and puff shape. For HIGH CUMULUS, pair a high altitude (~0.7) with a high volume (~1.6).' },
                        volume: { type: 'number', minimum: 0, description: 'Puffiness / size multiplier (default 1). Raise for fuller, fatter clouds.' },
                        fade: { type: 'number', minimum: 0, maximum: 1, description: 'Per-puff edge softness (default 0.5; higher = wispier).' },
                        style: { type: 'string', enum: ['wisp', 'grid'], description: '`wisp` = smooth sine-blob clouds; `grid` = pixel-art blocks that harmonize with the faceted terrain. Default `grid`.' },
                        softness: { type: 'number', minimum: 0, description: 'Coverage-threshold softness (default 0.16).' },
                        seed: { type: ['string', 'number'], description: 'Cloud-layout seed for variation.' },
                        breaks: {
                          type: 'array',
                          description: 'Clearings in the sky — the dual of terrain basins; each carves a hole in the cover (sun-gaps, clear patches).',
                          items: {
                            type: 'object',
                            additionalProperties: false,
                            required: ['x', 'y', 'radius'],
                            properties: {
                              x: { type: 'number', minimum: 0, maximum: 1, description: 'Horizontal position, 0 left → 1 right.' },
                              y: { type: 'number', minimum: 0, maximum: 1, description: 'Vertical position, 0 horizon → 1 zenith.' },
                              radius: { type: 'number', exclusiveMinimum: 0, description: 'Clearing radius (normalized 0–1).' },
                              strength: { type: 'number', minimum: 0, maximum: 1, description: 'How fully it clears, 0–1 (default 1).' },
                            },
                          },
                        },
                      },
                      description: 'Cloud tuning. `coverage` = how much; `altitude` = how high (and therefore the shape); `breaks` = where it opens; `style`/`volume`/`fade` for register.',
                    },
                  ],
                  description: 'Optional clouds (clear by default). A coverage number, or an object tuning coverage / altitude / breaks / style / volume / fade.',
                },
                sun: {
                  oneOf: [
                    { type: 'boolean' },
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        glow: { type: 'number', minimum: 0, description: 'Halo size/intensity multiplier (default 1).' },
                        size: { type: 'number', minimum: 0, description: 'Disc radius multiplier (default 1).' },
                        position: {
                          type: 'object',
                          additionalProperties: false,
                          required: ['x', 'y'],
                          description: 'Override the derived sun position (else projected from the light vector). x 0 left → 1 right; y 0 horizon → 1 zenith.',
                          properties: { x: { type: 'number', minimum: 0, maximum: 1 }, y: { type: 'number', minimum: 0, maximum: 1 } },
                        },
                      },
                    },
                  ],
                  description: 'Sun disc + warm halo at the projected light azimuth/elevation. ON ONLY ABOVE THE HORIZON — auto-hidden once `light.z` goes negative (use stars/moon for night). Rides the arc: white-hot high, sunset-orange low.',
                },
                stars: {
                  oneOf: [
                    { type: 'boolean' },
                    { type: 'number', minimum: 0, description: 'Shorthand for star density.' },
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        density: { type: 'number', minimum: 0, description: 'Star density (default 0.6).' },
                        seed: { type: ['string', 'number'], description: 'Star-scatter seed for variation.' },
                      },
                    },
                  ],
                  description: 'Faint star scatter in the upper sky. NIGHT-GATED — appears only when `light.z` is negative (the sun is down); a no-op by day.',
                },
                moon: {
                  oneOf: [
                    { type: 'boolean' },
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        phase: { type: 'number', minimum: 0, maximum: 1, description: 'Moon phase, 1 full → 0 new; intermediate values carve a crescent (default 1).' },
                        size: { type: 'number', minimum: 0, description: 'Disc radius multiplier (default 1).' },
                        paraselene: { type: 'boolean', description: 'Add a paraselene (moon dog): a faint 22° halo ring with two bright mock moons at the 3/9-o\'clock positions. Ice-crystal optics.' },
                        blend: { type: 'boolean', description: 'Render the moon as a soft radial glow that dissolves into the sky instead of a sharp disc.' },
                        position: {
                          type: 'object',
                          additionalProperties: false,
                          required: ['x', 'y'],
                          description: 'Override the moon position (else high, opposite the sun azimuth). x 0 left → 1 right; y 0 horizon → 1 zenith.',
                          properties: { x: { type: 'number', minimum: 0, maximum: 1 }, y: { type: 'number', minimum: 0, maximum: 1 } },
                        },
                      },
                    },
                  ],
                  description: 'Pale moon disc + soft halo. NIGHT-GATED — appears only when `light.z` is negative; a no-op by day. `phase` carves a crescent.',
                },
                aurora: {
                  oneOf: [
                    { type: 'boolean' },
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        intensity: { type: 'number', minimum: 0, description: 'Curtain brightness + ribbon count multiplier (default 1).' },
                        hue: { type: 'number', minimum: 0, maximum: 1, description: 'Band hue, 0 green/teal → 1 magenta/violet (default 0).' },
                        seed: { type: ['string', 'number'], description: 'Curtain-shape seed for variation.' },
                      },
                    },
                  ],
                  description: 'Aurora borealis: undulating luminous curtains in the upper sky. NIGHT-GATED — appears only when `light.z` is negative; a no-op by day.',
                },
                comet: {
                  oneOf: [
                    { type: 'boolean' },
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        length: { type: 'number', minimum: 0, description: 'Tail length multiplier (default 1).' },
                        size: { type: 'number', minimum: 0, description: 'Nucleus/coma size multiplier (default 1).' },
                        direction: { type: 'number', description: 'Tail heading in DEGREES, overriding the derived anti-sun direction (0 = right, 90 = down).' },
                        position: {
                          type: 'object',
                          additionalProperties: false,
                          required: ['x', 'y'],
                          description: 'Nucleus position. x 0 left → 1 right; y 0 horizon → 1 zenith.',
                          properties: { x: { type: 'number', minimum: 0, maximum: 1 }, y: { type: 'number', minimum: 0, maximum: 1 } },
                        },
                      },
                    },
                  ],
                  description: 'A comet: bright nucleus + coma + a tail pointing ANTI-SUNWARD. NIGHT-GATED — appears only when `light.z` is negative.',
                },
                meteors: {
                  oneOf: [
                    { type: 'boolean' },
                    { type: 'number', minimum: 0, description: 'Shorthand for meteor count.' },
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        count: { type: 'number', minimum: 0, description: 'How many streaks (default 12).' },
                        radiant: {
                          type: 'object',
                          additionalProperties: false,
                          required: ['x', 'y'],
                          description: 'The radiant point streaks emanate from. x 0 left → 1 right; y 0 horizon → 1 zenith.',
                          properties: { x: { type: 'number', minimum: 0, maximum: 1 }, y: { type: 'number', minimum: 0, maximum: 1 } },
                        },
                        seed: { type: ['string', 'number'], description: 'Meteor-scatter seed for variation.' },
                      },
                    },
                  ],
                  description: 'A meteor shower: streaks radiating from a radiant point. NIGHT-GATED — appears only when `light.z` is negative.',
                },
              },
            },
          ],
          description: 'Sky is ON BY DEFAULT — a derived zenith→horizon backdrop + atmospheric haze from the splatch palette + light elevation, spanning the full day→dusk→twilight→night arc off `light.z` (a negative z is night). Pass `false` to disable (flat background); `{ hazeStrength }` to tune the haze; `{ clouds }` to add clouds; `{ sun, stars, moon }` to add celestial adornments (sun by day, stars + moon at night — see the adornments paragraph in the description).',
        },
        forest: {
          oneOf: [
            { type: 'boolean', description: '`true` = a medium-density forest (density 0.5).' },
            { type: 'number', minimum: 0, description: 'Shorthand for density 0 (none) → 1 (dense).' },
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                density: { type: 'number', minimum: 0, description: 'How much of the ground is treed, 0 (none) → 1 (dense). The one coverage knob, thresholding the fBm density map.' },
                treeline: { type: 'number', minimum: 0, maximum: 1, description: 'Altitude ceiling (map-relative, 0 = lowest ground → 1 = highest): trees above it are culled, so the forest thins toward peaks. Omit for no treeline.' },
                size: { type: 'array', items: { type: 'number', exclusiveMinimum: 0 }, minItems: 2, maxItems: 2, description: 'World-height range [lo, hi] for trees (default [1.6, 3.2]).' },
                farThin: { type: 'number', minimum: 0, maximum: 1, description: 'Atmospheric thinning toward the far band, 0 (uniform) → 1 (strong; default 0.12).' },
                seed: { type: ['string', 'number'], description: 'Forest-layout seed for variation independent of the scene seed.' },
              },
              description: 'Forest tuning. `density` = how much; `treeline` = how high trees grow; `size` = tree heights; `farThin` = depth thinning.',
            },
          ],
          description: 'Optional generative forest layer (OFF by default), the ground-plane twin of clouds: an fBm density map over the terrain drops trees wherever it crosses `density`, each riding the heightfield. Crowns are midpoint-displaced fractal silhouettes (no leaf geometry — a ragged 1/f canopy edge), with subdivision depth budgeted by distance so dense forests stay cheap. `forest: true` for a quick stand; `{ density, treeline }` to tune cover and the snowline.',
        },
        ref: {
          type: 'string',
          description: 'Optional stable sketch ref (1-64 chars of [A-Za-z0-9_-]). If omitted, an auto-generated ref is used.',
        },
        folder_ref: {
          type: 'string',
          description: 'Optional folder ref to file the sketch under. Pass null to leave it at root.',
        },
      },
      required: ['title', 'heartbeat', 'splatch'],
    },
    handler: createPaintedLandscapeHandler,
  });
}
