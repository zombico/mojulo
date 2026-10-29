---
{ "id": "geocube", "name": "A geocube — one style, the levels it makes, and domain expansion", "summary": "a geocube is a level's look as data (light, palette, register, contrast, surfaces) plus its ingredients (terrains, interiors, structures, settlements); its `domains` compose them into the levels it makes, and `domain` expands one into a stage, a specimen, a level or a game's level, always in the cube's one style", "when": "someone wants several levels in one look: a game whose levels differ in land but share a style; a cove at dusk and a crag at noon from one cube; a town, a summit shrine or a temple hall in the same art style; choosing which of a cube's levels suits a task; domain expansion", "tier": "render-primitive", "marks": [], "phase": "p1" }
---

A cube is two things: its STYLE, the same in every level it makes, and its INGREDIENTS, the places and things that
style is applied to. A DOMAIN is one level the cube makes: a composition of its ingredients. Expanding a domain lowers
it, in the cube's style. A different style is a different cube (`{ from: <preset>, …changes }`), never a domain.

## The style (never a domain's)

`light`, `colour` / `palette`, `register`, `contrast`, `grit`, `surfaces`, `era`, `target`, `materials`, `why`, `avoid`.

## The ingredients

- **Terrains** (`outside.terrains: { <name>: { reads?, base?, tiers?, island?, land?, relief?, ground?, crystals?, cliff?, water?, colour? } }`):
  a whole land each, or a few changes to the cube's own (named by `outside.terrain`, `default` unless named).
- **The far cliff** (`outside.cliff`): the cliff its trails break into (a trail's `ground.cliff`: `{ height?, face?, bed?,
  dip?, joint?, pattern? }`), or `false`: none, the land open on both sides of every trail the cube paints (a field, a
  plain), a scene's path and a game's levels alike; a trail that names its own cliff keeps it, a terrain may name its own.
- **Water** (`outside.water: { lake?, coast?, river?, falls? }`, each `true` or its settings): cut into the land of every
  trail the cube paints (a trail's `ground.water`), drawn in the cube's `colour.water`. `lake { side?, at?, size?, depth? }`
  a basin beside the walk, a sand shore round it; `coast { beach?, depth? }` the open side falling through a beach to
  the sea, out to the horizon; `river { side?, width?, off?, depth? }` beside the walk (the far side unless named),
  falling with the land; `falls { at?, width? }` off the far cliff into a pool, the crossing's stream rising from it (a
  cube with `cliff: false` has none to fall from). `side` 'open' or 'far'; the coast takes the open side. A trail's own
  form wins, its `water: false` refuses the cube's; each body is an anchor and a water hazard, and adds a still
  (`lake`, `shore`, `river`, `falls`).
- **Dunes** (`outside.dunes: true | { height?, spacing?, wind?, repose?, supply?, sinuous? }`): the land of every
  trail the cube paints laid in wind-blown sand dunes (a trail's `ground.dunes`): a crest's metres over its trough (2.8),
  crest to crest (26), the wind's way in degrees (0 across the trail, 90 along it), the slip face's angle (32°, dry sand's
  angle of repose: a taller dune's face is longer), how much sand (0.75; low, crescents in patches), how far a crest wanders
  (0.35). The walk keeps a firm street through them; their sand is cut into the ground, no grass on it. A trail's own
  wins, its `dunes: false` refuses the cube's.
- **Caves** (a trail's `ground.caves: [{ y, depth?, width?, height?, along?, mouth?, light? }]`): cut into the far cliff of the
  cube's rock, its mouth in the cliff's foot at station `y`, `depth` metres in (10), then `along` metres behind the face
  (a gallery); `width` (8) and `height` (5) its size, `mouth` a taller entrance flaring down to it (a mouth taller than
  the rock over it opens as a cleft). Its walls are the cliff's rock and its ceiling a lid of the same rock under the
  land, worn as the meru's rock is (strata and joints near the eye); its floor the land's soil, rock at the walls' feet,
  nothing growing on it. It is lit by what it sees: the sky through its mouth, the sunlit land before it, the light its
  walls carry in and round a bend; deep in it is dark. Past its daylight it is lit by its `light`, the register that
  makes one rock a base's or a temple's: `fluorescent` (tubes along its crown, cold white; high-bay floods in a hall),
  `torch` (sconces on both walls, warm; braziers in a hall) or `bio` (glowing growth at the walls' feet and from the
  ceiling, cyan-green, faint); each lamp drawn bright and laying its light on the rock it can see, the same at any hour,
  a register scaled with the cave. Each cave is an anchor (`kind: 'cave'`: its path, size, mouth, light, lamps).
  Its walls, far end and ceiling are lined with the land's own boulders (two rows up each wall, slabs hung across the
  ceiling), its mouth the cliff's own rock. A gargantuan cave wants a taller cliff and more rock behind it:
  `ground.cliff.height` (to 40 m) and `ground.behind` (0 to 80 m of rock behind the cliff); `ground.room` (0 to 80 m)
  widens a trail's site past its far side.
- **Interiors** (`inside.interiors: { <name>: { reads?, bones?, size?, accentWall? } }`): rooms, over the cube's own
  (`inside.interior`, `room` unless named). Terrains and interiors share one set of names.
- **Structures** (`structures: { <name>: [<structure>…] }`): fractal structures (`get_view_vocab({ id: 'structures' })`),
  each standing `at: [x, y, z?]` or `on: 'summit'` (the climb's top; `at` is then an offset). Painted from the cube's
  ramps unless one names its own `palette`, lit by the cube's key at the domain's hour. They stand on a climb, never on
  a trail.
- **Settlements** (`settlements: { <name>: { town?, houses?, enter?, doors?, anchor?, style? } }`): a town plan and how
  much of its street stands (`houses` 1–12) and is walked into (`enter` 0–4), in the cube's builders' language unless
  `anchor` names another, in a `style` (its own, else `buildings.style`). A town walks on a trail.
- **Flora** (`biocube`): what grows on its land, its trees composed as silhouettes in the cube's colours
  (`get_sketch_vocab({ id: 'biocube' })`).
- **Snow** (`snow`): the cube's land under snow, its trail's stage and the far ridges. `true`, a depth (`dusting`,
  `cover`, `deep`), or `{ line?, depth?, hold?, drift?, lee? }`: `line` metres over the land's lowest ground where it
  begins (snowcapped crags; absent, the whole land), `depth` a word or metres, `hold` how level ground must be to hold
  it (0.5–0.98: steeper rock stands bare), `drift` how far the wind opens it in patches (0–1), `lee` how much longer
  the side turned from the sun holds it (0–1). The colour theorist solves its colour from the cube's sky and sun; the
  trail goes trodden snow, the grass thins under a cover and is gone under deep snow, leaves turned up carry it, and
  the walker leaves footprints. A bare season is the biocube's (`trees.season`).
- **Styles** (`style`, era/arch-style.js): what the builders build, so no two places need look alike. A starter's id
  (`STYLE_STARTERS`, e.g. `whitewashed-island`, `tudor-market`, `adobe-pueblo`, `art-deco`, `brutalist`), `{ from:
  <starter>, …changes }`, or your own: `{ read, class: 'ancient' | 'modern', language, materials, palette?, city? }`.
  `language` is an anchor or its elements on their rails (`{ from: 'timber-hall', elements: { roof: { pitch: 50 },
  quoins: null } }`: a whole element with its `kind` replaces, null drops). Openings are built where the language
  writes them: a light's `frame` (0–0.2 m), `glazing` (lattice, sash, casement, plate; arabesque a star screen,
  ornamental leading, stained glass) and `trim`; a door's `leaf` (boards, panels, glazed), `surround` (frame,
  pilasters, hood), `fanlight` (rect, arch) and `steps` (0–3); shutters' `form` (boards, louvred). `materials` a
  word per surface (plaster, stone, timber, plinth, roof; a city's punched, pier, banded, grid, road, walk), e.g.
  limewash, rubble, hand-brick, adobe, clay-tile, thatch, wire-brick, precast, concrete, glass; `palette` a colour per
  surface; `city` its grain (`paris`, `tokyo`…) and a grammar's changes. The specimen writes its
  laws back (class, cover against pitch, value order, idle surfaces): they advise, never refuse.

## The domains

```
domains: {
  'crag-path':    { reads: 'The crags in the hard clear light', structures: 'shrine' },
  'cove-dusk':    { reads: 'The cove at dusk', terrain: 'cove', hour: 'dusk' },
  'harbour-town': { reads: 'Up the street of the harbour town', terrain: 'cove', settlement: 'harbour' },
  'temple-hall':  { reads: 'Into the temple hall', interior: 'hall' },
}
```

A domain is outside (a terrain, the cube's own when none is named; `hour` 0–24 or a word on the dial; `structures`;
`settlement`) or inside (an `interior`). Each `reads` line is how the domain is chosen: write it for the task it suits.
A cube that names no domains offers one per terrain and one per interior.

## Domain expansion

`domain` is one key on the doors that take a cube:

- the `geocube` kind: `{ cube, domain }` shows the domain (its room, its land, or its street); `show: 'trail'` walks
  an outside domain's island, every way up drawn; `show: 'town'` a micro-town (a few houses of its street, or a
  hamlet's) and `show: 'city'` a micro-city (the smallest city plan, in the cube's paint and builders' language),
  each walked by a stand-in at eye height to review the architecture, seen first from a person's eye before a house
  or down a sidewalk; `show: 'path'` the way through its land (a trail stage on the cube's terrain), no town and nobody on it, walked by
  the stand-in and seen from its overlook: a place to walk, not a game (`seed`, `biocube`, `path`, `hour`, `clouds`
  as the other shows; the cube's `snow`; its own `trail` recipe: dials, ground, rocks). A scene asked in words: `words`
  ('a colorful grassy field in the daytime') read at mint into `cube`, `show: 'path'`, `hour`, `clouds`, `trail` and
  `camera` by the game's own word table (gameworld/scene-words.js: lake, beach, river, waterfall the water; dunes, erg the dunes; desert,
  alpine, coast a biome, its flora, ground and palette's character; the painted landscape's glyph words, each card's
  numbers read onto the cube, a splatch as the palette's axes, never its colours), each key written beside them kept;
  `camera` the still it is first seen from (`low`, `overhead`, `wide`, `close`); `brief` says what each word
  decided; a new scene (`show: 'path'` or `'trail'`, no seed yet) is drawn in gen-7, its cube's `era` stamped `gen-7`
  at mint (the land, its stones and grass, its trees, bamboo and bushes as form, lit by the cube's light; a blossom
  card's trees keep their painted look), `cube.era: 'gen-6'` for the painted render, a minted row keeping its own; `hour` and `clouds` set an outside's sky (the city's too: past dusk its windows lit). A gritty
  cube's street and city are painted from relief as its rock is: stone walls ashlar, plaster a lime render broken to the
  stone, roofs in courses, timber in boards; a city's walls between its windows and its sidewalks the same. `style`
  on the micro-town or micro-city builds it in that style, over the settlement's own; `path` dresses the trail its
  street lies on (as a stage's `trail` does): `surface` a ground word (earth, the dirt, by default; stone-road and
  gravel laid in the dirt; flags, setts, brick-paving, pavement, asphalt kept), and on a gritty cube's dirt `rubble` at
  its edges and `patches` (worn, damp, gravel, crown, puddle), each `false` for none;
  `show: 'hall'` its interior (its room, or an inside domain) walked as a HALL, rooms strung on a walk from the seed
  (era/in-hall.js: squeeze, reveal, landmark, pocket, rest; the kit's set piece in the landmark's room), `hall` its
  recipe (`run`, `heartbeat`, `beats`, `height`, `mouth`, `exit`), its laws on the answer;
- a `stage`: `{ geocube, domain }` alone is the whole level: an island, a street on a trail (a domain with a town), or
  a room. Your `meru`, `trail`, `rooms`, `hour` or `town` win over the domain's;
- a level: `{ geocube, domain, nodes }` paints every section, and lays a domain's street on its first trail;
- a game: `style.domain` on the world or on a level. A level on a cube that names domains and asks for none takes its
  heartbeat's, else the cube's first outside. Composed worlds lend the cube's domains to their walks, the ones the
  prompt names first.

Ask for a domain three ways: by name (`'cove-dusk'`), as a change of one (`{ from: 'cove-dusk', hour: 'night' }`), or
composed from the cube's ingredients (`{ terrain: 'cove', structures: 'shrine', hour: 'golden' }`). The answer
(`painted`, the level's `paint`, the specimen's `geocube`) says which domain it got, from whom (the level, the
heartbeat or the cube), and what the cube offered. `terrain: 'x'` is `domain: { terrain: 'x' }`.

## Choosing

Read the cube's offer (the specimen lists its domains with their `reads`) and pick the one whose line fits the level
the task needs: a climb for a summit, a street for a town, a room for an interior. Compose one when none fits, from
the cube's own ingredients. Need a land, a room or a landmark the cube lacks? Add it to the cube (a variant with
`from`), then expand.
