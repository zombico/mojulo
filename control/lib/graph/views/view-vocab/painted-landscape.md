---
{
  "id": "painted-landscape",
  "name": "Painted Landscape",
  "family": "world",
  "entry": "compose_world",
  "summary": "Mint a painterly Lambert-shaded landscape by picking one named glyph per family — heartbeat (geometry), splatch (palette), optional structures/scene (scatter), camera, sky — with seeded sampling inside each glyph's declared ranges.",
  "when": "Reach for this when the user wants a landscape that reads as 'painted' — receding hills, dunes, water, terraced fields, a starry night over a meadow — without authoring waveforms or hex stops.",
  "retired_tool": "create_painted_landscape"
}
---

Mint a painterly Lambert-shaded landscape by picking one named glyph per family. The
substrate resolves glyph → recipe, seeded sampling picks concrete wave parameters within the
heartbeat's declared ranges, the splatch's three seed colors derive a balanced 4-stop palette
via luminance-sorted interpolation, and the structure-glyph's seeded layout scatters obelisks
/ boxes that sit on the elevated wave surface. Renders back-to-front, borderless, as
flat-Lambert polygons. Persists with `manifest.kind === 'painted-landscape'`; served as an
SVG by `/api/sketches/<ref>/svg`.

**Closed-vocabulary discipline** — the model never authors raw waves or hex. Every glyph is a
named card; **the catalogues are NOT in this card**: discover glyphs by intent via
`semantic_search({ kinds: ['painted_landscape'] })` (heartbeat / splatch / camera / scene /
sky families), then pass the card's `id` as the named glyph.

## Parameters

Pass these via `compose_world`'s `overrides` (deep-merged over the theme pack). `seed`,
`title`, `ref`, `folder_ref` are top-level `compose_world` params.

- `heartbeat` (string) — named geometry recipe. `[sine-stack]` cards read as periodic
  (terraces, swell, ribbed forms); `[fbm]` cards read as natural (meadows, dunes, glaciers).
  fBm is the default for naturalistic terrain.
- `splatch` (string) — named palette recipe (3 seed colors → 4-stop ramp, luminance-sorted).
  Palette is independent of seed.
- `structures` (string) — optional ARCHITECTURAL scatter glyph (box / obelisk; ruins,
  monuments, villages). Omit for pure terrain; use `scene` for nature fill.
- `scene` (string) — the BIOME FILL + completion unit for NATURE landscapes (cone / canopy /
  boulder / tuft scattered per depth band, with a heartbeat+splatch affinity hint). Reach for
  a scene (not structures) when the landscape should read as forest / meadow / coast / alpine.
- `seed` (string) — same `(heartbeat, splatch, structures, seed)` → byte-identical scene; new
  seed → coherent variation (phases and placements shift; palette and counts hold).
- `light` ({ x, y, z }) — overrides the heartbeat's default light. `z` (elevation) also drives
  the sky's full day → dusk → night arc; NEGATIVE `z` is night (enables stars / moon / aurora).
- `sky` — ON BY DEFAULT (derived zenith→horizon gradient + haze). `false` for flat background;
  a sky-card id string (`'starry-night'`, `'golden-sun'`, `'harvest-moon'`) for a preset; or an
  object with `clouds` (`coverage` / `altitude` / `breaks` / `style` / `volume` / `fade`),
  `sun`, `stars`, `moon` (`phase` / `paraselene` / `blend`), and night phenomena `aurora` /
  `comet` / `meteors` (night-gated on negative `light.z`). Adornments paint BEHIND clouds — a
  sun behind a `breaks` clearing reads as god-rays.
- `camera` (string) — camera-glyph card id locking vanishing points + foreshortening
  (`top-down-survey`, `low-angle-hero`, `wide-cinematic`; default ≈ `medium-survey`).
- `renderStyle` (string) — `painterly` (default; stroke=fill cinematic blocks) /
  `topographic` (dark cell borders; vector-map look) / `wireframe` (no fill; outrun-grid look;
  always sky-less). Orthogonal to heartbeat and splatch.
- `heartbeatOverrides` ({ waves?, samples? }) — per-component `ampScale` / `cuScale` /
  `cvScale` multipliers applied before seeded sampling, and `{ u, v }` cell-density override.
  "This heartbeat but quieter / steeper" without inventing a new heartbeat.
- `paletteOverrides` ({ stops?, positions?, gamma? }) — replace derived stops with explicit
  hex, reposition the 4 stops on the ramp, or reshape the Lambert→ramp brightness curve. The
  three are orthogonal; the splatch stays named and deterministic.
- `ground` (preset id or object) — SURFACE TEXTURES for the live `/world` mesh: terrain cells
  wear seamless procedural rock/soil tiles routed by SLOPE (steep cliff faces vs gentle
  ground), with an era-authentic world-space "dark cloud" grime layer + vertical
  weather-streaks baked into the vertex colours (soft blotches that can never repeat with the
  tile) and a deepened facet-shading curve. Presets: `sandstone` (golden desert cliffs),
  `granite` (grey alpine crags), `red-rock` (banded canyon), `meadow` (green hills, bare rock
  faces), `snow` (snowfields under cold crag cliffs).
  Object form `{ steep?, flat?, tile?, flatMin?, contrast?, cloud? }` for per-world
  tuning: any surface-texture key per slope class (family keys rotate their seed variants per
  tile-repeat region), `tile` world-units per repeat (default 3.0), `flatMin` slope threshold
  (default 0.62), `contrast` Lambert exponent (default 1.8), `cloud` grime strength 0–1
  (default 0.55). World-route (and glTF-export) only — the SVG and CSS-3D paths paint the
  baked fills. Pairs naturally with elevation-field cliffs and `rocky-irregular` fBm terrain.
- `rocks` (rock preset or object) — the scene's BOULDERS become real broken rocks instead of
  boxes: a few pooled `rock` solids (the workbench field shape: planar fractures, cleavage-aware
  chips) instanced once per boulder, so a boulder field costs a handful of meshes. Presets
  `granite`, `slate`, `marble`, `quartzite`, `basalt`; object form `{ rock, variants?: 1–8 (6),
  detail?: 0–4 (2; 0 = the exact faceted block), tone?: 'palette' (default, the painting's
  colour) | 'mineral', sink?: 0–0.6 (0.2) }`. World + glTF/USD/3MF instance them; the CSS-3D
  scene draws each as its block. Needs a `scene` with boulders (`coastal-rocks`, …).
- `erosion` (`true` or object) — LANDFORMS BY PROCESS: the terrain (heartbeat or `elevation`) is
  baked on a grid, cut by rivers along its drainage network (stream power: big rivers carve to
  base level, small gullies barely move, ridges stay ridges) and slumped to a talus angle.
  Valleys, spurs and a dendritic network appear where fBm alone gives lumps. Every layer reads
  the eroded surface — the still, the World mesh (sampled finer), structures, scatter, city.
  Object form `{ steps?: 1–300 (60), strength?: 0–2 (0.5), talus?: 10–60° (35), res?: 32–256
  (128) }`; cost grows with `res`² × `steps` (the default ≈ 0.7 s once per recipe). Pairs with
  `rocky-irregular` or an `elevation` field. The raymarch render cannot draw it and falls back to the mesh World.
- `landform` (list) — CLIFFS AND MOUNTAINS, when the land needs faces and not just rolling hills. An ordered
  list of operations on the terrain, mixed in any order. Coordinates are the domain's: x −12…12, y −24 (far) … 6
  (near); heights are in the terrain's units.
  - `{ op:'peaks', height, wavelength?: 12, sharp?: 2, center?, radius? }`: ridged mountains with knife crests
    and broad valleys. `center` [x, y] and `radius` together make a massif.
  - `{ op:'strata', thickness, contrast?: 0.9, hardShare?: 0.5, dip?: 0, dipAz?: 0, tones? }`: beds. A hard bed
    stands as a cliff with a bench on top; a soft bed lies back as a slope. `dip` tilts the beds (cuestas,
    hogbacks). `tones` gives each bed a '#rrggbb' in turn (red-rock country).
  - `{ op:'scarp', path: [[x, y], …], throw, face?: 75, side?: 'left' | 'right', rough?: 0.03, taper?: 0.15 }`:
    a cliff line (escarpment, fault, sea cliff), raised on `side` walking the path, tapering to its tips.
  - `{ op:'joints', spacing, pattern?: 'blocky' | 'columnar' | 'slabby', rock?, strike?: 0, steep?: 38 }`: steep
    ground breaks into planar facets on joint sets. Blocky suits granite and sandstone, columnar suits basalt
    organ pipes, slabby suits slate. `rock` (a preset) picks the pattern.
  - `{ op:'talus', angle?: 34, retreat?: 0.3, cliff?: 52, scree?: 0–1 }`: every face sheds debris, which settles
    below it at the angle of repose. `scree` scatters power-law rock fragments on the apron; they are instanced,
    use the `rocks` preset or granite, and appear in the World only.

  With `erosion` declared, the rivers read the rock: they cut soft beds and not hard ones, and bedrock holds its
  face. Talus always settles last. Every layer reads the result. The World meshes it face-aware: cliffs get
  polygons in proportion to their height, hard beds stand proud, soft beds recess, and rock takes the palette's
  stone (or the beds' `tones`). The CSS scene keeps the plain grid. `ground` textures and farmland are not drawn
  on a landform terrain.

  Recipes:
  - escarpment: `[{ op:'scarp', path:[[-14,-6],[0,-9],[14,-7]], throw:4, side:'right' }, { op:'strata',
    thickness:0.6 }, { op:'talus', scree:0.1 }]`.
  - alpine: `[{ op:'peaks', height:8, center:[0,-12], radius:18 }, { op:'joints', rock:'granite', spacing:0.9 },
    { op:'talus' }]` with `erosion: true`.
- `extent` (number, default 1) — uniform World-mesh magnification. The terrain domain is a
  fixed quad; `extent` scales the finished mesh (and its UVs) by that factor, so the map gets
  BIGGER — a longer walk under proportionally taller relief — without re-gridding. Walk speed
  is absolute, so `extent: 1.7` ≈ a 1.7× longer crossing. World-route only.
  For a world at real scale (metres, walked at a 1.7 m eye, flown, seen whole), promote the recipe instead:
  `compose_world({ base: 'terrain', overrides: { from: { ref: '<this sketch>' } } })`; manual `get_view_vocab({ id: 'terrain' })`.
- `builds` (array) — explicit placed metal/material box STRUCTURES (launchpads, observation
  decks, towers), in terrain (domain) coords, so they ride the `extent` scale with the land.
  Each `{ x, y, w?, d?, h?, z0?, sink?, material?, tint? }` is terrain-anchored (z0 defaults to
  the ground height under its centre, minus `sink` to bed it in), extruded `h` up, and emitted
  as top+4-wall faces with ONE finish channel: either `material` (brushed-steel / brushed-hull /
  weathered-hull / gradient-plate — the texture-free vertex-colour metal look) + a `tint`
  (#rrggbb), OR `texture` (a surface-textures.js PANEL tile — `hull-plate`/`hull-plate-dark` for
  building walls, `deck-checker`/`deck-checker-warm`/`deck-tread` for floors/launchpads, the
  mobile-suit depot vocabulary) + a `tile` size (world units per repeat). `sink` beds a box into
  the ground (NEGATIVE `sink` RAISES it — elevated walkways). Compose multi-box structures by
  listing boxes: a SETBACK / 2-level building = concentric boxes, decreasing footprint +
  INCREASING height, all terrain-anchored (no baked heights needed); a walkway = a long thin
  raised (`sink: -0.25`) deck box spanning two structures. A build may instead be a RAMP:
  `slope: '+x'|'-x'|'+y'|'-y'` makes the top face incline from ground (a small lip) up to `z0+h`
  at the high edge along that axis — a walkable way up onto a raised deck. A build may also be a
  cylinder: `shape: 'cylinder'` (+ `sides`) extrudes an N-gon prism (w,d = diameters) — a landing
  circle, silo, or round tower. `rotZ` (degrees) spins any build's footprint about its centre —
  angled ring segments, chamfers, hexagonal/octagonal perimeter walkways. World-route only.
  Builds light with a lifted ambient (metal, not terrain) so backlit panel walls stay legible.

Pairing guidance: `top-down-survey` + `topographic` + chart splatches for topo-map output;
`low-angle-hero` + structure glyphs for monumental reads; `wide-cinematic` + cinematic
splatches under `painterly`.

- `clouds` (true | object) — Optional cloud deck over the terrain on the live `/world` mesh page (the same raymarch effects layer the city's `fog` and `clouds` ride). `true` is the cheap default: an `undershot` plane deck (one intersection per pixel, no march) whose band clears the terrain's tallest vertex, lit from below with the sun through the slab and faded to the horizon. `{ mode: 'full' }` spends the frame budget on the volumetric march (lit tops, shaded troughs). Tuning: `base` / `top` (world units), `coverage` 0..1 (default 0.35), `sun` [x, y, z] toward the sun, `color`, `density`, `scale` (noise frequency, smaller ⇒ bigger clouds), `drift` (0 = still), `maxDist`, `fade`. Ignored by the `?render=raymarch` backend and the stills. A bad value fails at the first render by name.
- `audio` (object) — Optional world AUDIO channel (generic across every base; resolved on the live /world path): { soundtrack?: { beatsRef: '<stored beats ref>' } or an inline beats recipe (compositions loop), sfx?: { beatsRef? | cues?, on? }, footsteps?: true|{ step, jump, land }, wind?: true|{ level, freq }, bindings? (soundtrack channel macros) }. Validated at mint — an unknown beats ref or invalid recipe REFUSES the mint rather than storing a world that fails to render. Vocabulary: get_beats_vocab({ id: 'audio-beats' }).
