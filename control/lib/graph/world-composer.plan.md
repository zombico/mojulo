# world-composer

A single operator-facing MCP tool — `compose_world` — that builds a renderable world by
choosing a **base** (a geometry generator: city, dungeon, station, floorplan…) and a
**theme** (a context/asset/material/style overlay), then minting through the existing
recipe → render pipeline. The point is to let one operator produce *many different
contexts and assets* from the same primitives, and to make the context vocabulary
**extensible** to fantasy / sci-fi locales without touching the geometry generators.

Audience: the operator, via their host MCP agent (Claude Code / Codex). No new UI, no
end-user surface, localhost-only. Consistent with the single-user golden rules.

## The problem it solves

Today every world kind is its own closed-vocabulary `create_*` tool
(`create_fractal_city`, `create_transportation_hub`, `create_manji_tree`, …), and the
theming knobs that actually produce variety are **buried inside each preset and hardcoded
to the real world**:

- `fractal-city`: `locale` is one of 13 real regions; `LANDMARK_FOOTPRINT` is 27 real
  monuments; religious placement is weighted by real-world geography; building shapes are
  a fixed real-city set.
- materials live in `surface-textures.js` as fixed families (marble, oak, terracotta…).
- lighting/sky/moonlight are preset constants in `scene-css3d.js`.
- style enums (wall/floor/roof/facade/tunnel) are per-generator constants.

So "make a Martian colony" or "make a dwarven hold" is impossible without forking a
generator. The richness exists; it's just not addressable as a *theme*, and it's welded
to Earth.

## The core move: WHAT vs THEME

Split a world into two orthogonal axes:

- **base** — the geometry generator. *What is the shape of this place?* Reuses existing
  planners unchanged: `fractal-city`, `transportation-hub`, `subway-station`, `dungeon`,
  and (phase 3) the internal-only kinds `floorplan` / `room` / `restaurant` / `planetary`.
- **theme** — the overlay that answers *where/when/of-what is this place made?* It binds
  abstract **slots** (roles) to concrete assets, materials, palettes, lighting, and style
  enums. `locale` stops meaning "geographic region" and starts meaning "world flavor":
  `earth-temperate`, `mars-colony`, `dwarven-hold`, `cyberpunk-megacity`, …

A theme is data, not code branches. Generators reference *roles*; themes resolve roles to
values. This is the same discipline as the golden rule "no paradigm-specific branches
downstream of config composition" — applied to world flavor.

## Model

```
compose_world({
  base:  'city' | 'dungeon' | 'station' | 'floorplan' | …,   // geometry generator
  theme: 'earth-temperate' | 'mars-colony' | 'dwarven-hold' | …,  // registry key
  seed:  <int>,                                              // determinism
  overrides: {                                               // per-call knob escape hatch
    elements?, density?, depth?, landmark?, materials?, lighting?, style?, …
  },
  title?, ref?, folder_ref?
})
  → resolveTheme(theme) ⊕ overrides
  → { kind, ...concreteKnobs }            // a manifest existing assemblers understand
  → mintSketch(...)                        // existing path; stores tiny recipe
  → /sketches/<ref>  (renders deterministically on view)
```

The stored manifest stays a **tiny recipe** (`base + theme + seed + overrides`), so the
recipe → render-on-view model is preserved and output is deterministic.

### Slot vocabulary (the role layer)

The abstract slots a theme can bind. Grouped to match the four variety axes the operator
named (biome/locale, materials, assets, architectural style):

```
CONTEXT   atmosphere   → sky / lighting / moonlight preset, time-of-day, tint
          ground       → base terrain material + color (street, soil, rock, regolith)
          profile      → density/scale character (metropolis | town | outpost | warren)

MATERIAL  wall         → texture family for primary vertical surfaces
          roof         → texture family for tops
          accent       → trim / detail material
          (each → a surface-textures family key, or a theme-defined runtime family)

ASSET     monument     → "landmark" role: which hero forms can anchor a region
          ritual       → "religious/civic" role: which special structures appear
          dwelling     → building/house shape catalog
          props        → element toggles + prop catalog (vehicles, flora, people, …)
          (each ASSET role resolves to EITHER a built-in catalog key OR a fabricator
           recipe — see "The asset factory" below — so a theme can ship its own objects)

STYLE     wallStyle / floorStyle / ceilingStyle / facadeStyle / roofStyle / tunnelStyle
          relief       → golden | rolling | (theme-defined)
          palette      → the color ramps used to recolor neutral/tintable assets
```

### Theme pack shape

Theme packs live in `control/lib/graph/themes/` as JS modules (JS, not JSON, so a pack
can compute palettes and register runtime material families via the existing
`defineStoneWallFamily` / `defineRockTile` / `defineWoodPanelFamily` hooks in
`surface-textures.js`).

```
// themes/dwarven-hold.js
export default {
  id: 'dwarven-hold',
  family: 'fantasy',
  context: { atmosphere: 'torchlit-cavern', ground: 'rock-strata', profile: 'warren' },
  material: { wall: 'rock-granite', roof: 'slate', accent: 'wood-panel-mahogany' },
  asset: {
    monument: ['great-pyramid', 'stonehenge'],        // phase 1: remap existing forms…
    ritual:   { kind: 'temple', variant: 'stupa' },    // …recolored by palette
    dwelling: ['podium', 'setback'],
    props:    { cityTrees: false, streetLamps: true /* read as braziers */ },
  },
  style:   { wallStyle: 'cave', relief: 'golden', facadeStyle: 'brick' },
  palette: { primary: '#6b5a47', stone: '#4a4036', glow: '#ffb15a' },
}
```

The **identity pack** `earth-temperate` reproduces today's `fractal-city` defaults
verbatim, so existing tools and tests don't regress — it's the proof that the role layer
is lossless before we add exotic packs.

### Registry

`theme-registry.js`:

```
registerTheme(pack)        // packs self-register on import
listThemes({ family? })    // for the tool's enum + discovery
resolveTheme(id) → {       // full concrete knob set for a base
  context, material, asset, style, palette
}
```

`compose_world` does `resolveTheme(theme)`, deep-merges `overrides`, then maps the
resolved slots onto the chosen base's existing knob names (a small per-base adapter:
e.g. for `city`, `asset.monument → landmark`, `style.facadeStyle → facadeStyle`,
`context.profile → profile`, `props → elements`).

## Why this fits the existing seams

- **No assembler changes in phase 1.** Themes only remap *existing* knobs, so resolution
  produces a normal `fractal-city` / `dungeon` / `subway-station` manifest the current
  `resolveWorldScene()` dispatch already renders.
- **Lowering happens at mint.** `mintSketch()` already runs `lowerRecipeManifest()`; a
  `compose-world` recipe lowers to a concrete kind manifest there — same place recipes
  already get lowered.
- **Determinism + tiny storage preserved.** Stored recipe = `base+theme+seed+overrides`.
- **Validation reuses `validateSketchManifest()`** on the lowered manifest; the composer
  adds a thin pre-validation of `base ∈ registry`, `theme ∈ registry`.

## A world is a level: the intent/rubric axis (third axis)

base × theme is not enough. A world in operation is a **level** — a single, inhabitable
experience — not a static scene. The full model has four axes, only three of them
required:

- **geography** — the *traversal topology*: the shape of how you move through the level.
  This is what most defines the play experience, and it is NOT the same as what the level
  is made of or what you do in it. (See the next section.)
- **theme** — flavor (materials / assets / context). Orthogonal to geography: a rectilinear
  network reads as a stone crypt or a Star Wars corridor depending only on theme.
- **rubric** — *intent + emphasis*: which spatial qualities the layout optimizes,
  **weighted**. Where pathing and livability / feng-shui concerns live, mixed and
  emphasizable. Rubric lenses are geography-aware (a linear level rewards different
  qualities than an open one).
- **action** *(optional)* — the game loop (event-bus / game-idioms). Deliberately
  detachable: MGSV and Minecraft share a map axis (open expanse) but differ entirely on
  action. A level is a complete experience *without* action; action is opt-in.

("base" from earlier drafts splits into **geography** (traversal topology) + a
**construction primitive** chosen by the *angularity* knob — see below.)

### Level geography (the traversal-topology axis)

Games traverse in a few recognizable patterns. Four topologies, three already realized:

| topology | play shape | realized by |
|---|---|---|
| **network / warren** | branching, non-linear exploration | `dungeon-designer` `{chambers,tunnels}` |
| **room-graph** | connected built interiors via doors | `floorplan` / `suite-layout` |
| **open expanse** | route freedom, landmarks not rooms | `fractal-city`, `painted-landscape` |
| **linear-directional** | **start → end, mostly unidirectional progression** | **MISSING** (only the `platform` movement rule exists in `controllable-world`) |

**angularity** is the one knob orthogonal to topology: (organic ↔ rectilinear) it selects
the *construction primitive*, not the traversal shape. `dungeon-designer` already sets it
*per chamber* (`wall:'cave'|'flat'`), so a single level can hold organic caverns AND built
rooms. "cave-like" and "room-like" are two ends of one dial. Rectilinear + theme = the
sci-fi / Star-Wars corridor case.

Geography also decides **how `movement-flow` is wired**: a network uses the flow-field /
door graph, a linear level a dominant desire-line spine, an open level a diffuse flow
field. Geography *is* the pathing topology — not a separate feature.

**The one real build:** the linear-directional generator. Its defining invariant is a
**start point and an end point with mostly-unidirectional progression** between them — a
directed spine of chambers/platforms with gates. Height changes are just one form of
*variety along that spine* (not a separate cross-topology axis), alongside width pinches,
branch-and-rejoin detours, and set-pieces. Likely reuses the dungeon chamber+tunnel kernel
under a linear layout planner, rather than a from-scratch kernel.

### What already exists (do not rebuild)

- **Circulation** is already a shared primitive: `movement-flow.js` (command cells,
  desire lines, door approaches, `flowField`). Every kernel consults it. Traversal is
  real: `scene-three.js` walk mode + `controllable-world.js` rule shelf
  (walk/glide/physics/follow/orbit/path).
- **Quality scoring** already exists *for houses*: `floorplan-flow.js` `assessFlow()`
  (feng-shui faults: through-shot, opposing-door, occluded center, wet-room-in-rest-corner,
  entry choke; classed NECESSARY/PREFERENTIAL), `floorplan-bim.js` `scoreHouse()` (5
  weighted lenses: reachability .28, egress .24, proportion .20, adjacency .13,
  daylight .15), `floorplan-glyphs.js` RELATIONSHIPS (mustTouch/nearTo/mustNotTouch +
  privacyDepth).
- **World-as-level** is already the model: `magic-world.plan.md` (sources → triggers →
  tracker → projection; "a game is the shape when deed → trigger → tracker → goal closes"),
  `event-bus.js` (rule engine), `game-idioms.js` (mixable rule composition via `compose`).

### The gap this axis closes

The weighting machinery exists but is (1) **siloed** to floorplans — city/dungeon/room get
circulation but no scoring; (2) **fixed-weight** — the lenses and weights are hardcoded, so
emphasis can't be chosen and a dungeon can't *invert* the house rubric; (3) **not exposed**
as an authorable knob.

### The move

Lift the floorplan quality stack into a kind-agnostic `world-rubric.js`:

```
rubric = {
  lenses: { flow, livability, daylight, defensibility, spectacle, challenge, serenity, … },
  // each lens is a scorer(worldModel) → 0..1 over the SHARED circulation/face model
  weights: { flow: 0.4, challenge: 0.4, daylight: 0.0, … },  // author-chosen emphasis
  faults:  { throughShot: 'reward' | 'penalize' | 'ignore', … },  // sign can flip per intent
}
```

- the composer runs candidate seeds, scores each against the **weighted** rubric, keeps the
  best — generalizing today's house-only seed selection to every base.
- a **house** rubric: `{ livability:high, daylight:high, flow:clean }`.
- a **dungeon** rubric: `{ challenge:high, defensibility:high, flow:tortuous }` — the SAME
  through-shot/occluded-center faults are flipped from penalties to rewards.
- a **temple / garden** rubric: `{ serenity:high }` — keep axial sightlines and rest
  corners that a house would break.

Rubrics compose with themes (a theme may suggest a default rubric) but stay orthogonal: a
sci-fi *city* and a fantasy *dungeon* can share the "challenge" emphasis.

### Level = the full experience

So `compose_world` ultimately yields a **level**, not just a scene:

```
level = geography (topology + angularity)                  // how you move: the traversal shape
        + theme flavor                                     // what it's made of / looks like
        + working circulation (movement-flow wired by topology)
        + a rubric-scored layout (geography-aware lenses)  // what it optimizes for
        + (optional) a closed event-bus loop (game-idioms) // what you do — detachable
```

Phase 1–2 deliver geography (existing topologies) × theme. The linear-directional
generator (Phase G) and the rubric axis (Phase R) are their own tracks; the event-bus loop
is already built and is opt-in per level.

## The asset factory (workbench / assembler / meta-fabricator)

This is how a theme produces *new* objects instead of only recoloring the real-world
catalog — the load-bearing answer for fantasy / sci-fi, which need forms (spires, domes,
mechs, hover-craft) that no Earth catalog has.

The factory and the world assemblers already share one **face currency**:
`{ corners:[[x,y,z]…], fill:'#hex', doubleSided?, normal? }`. The seam is live and in
production:

- `workbenchAssetFaces(manifest, { scale, translate })` → a baked, pre-lit face list
  (`workbench.js:77`). `room-assets.js` (couches) and `cyclist-asset.js` (bikes) already
  use it.
- every world assembler accepts `faces: extraFaces` and appends them
  (`assembleBoxCityScene(... , { faces })` in `scene-css3d.js`).
- `meta-fabricator` adds parametric **family sampling** with livery/paint decoration —
  sample N varied instances from one spec (`sampleInstance` → `buildInstanceFaces` →
  same face shape). This *is* the "different assets" mechanism for vehicles/props.

So the ASSET slots resolve in three tiers:

1. **catalog key** — an existing form (`'great-pyramid'`, building shape `'setback'`).
   Cheapest; phase 1.
2. **workbench recipe** — a `{lathes, extrudes, sweeps, reliefs}` manifest the theme ships
   as a builder fn; lowered to faces and placed via `workbenchAssetFaces` + `extraFaces`.
3. **fabricator family** — a meta-fabricator family (parameter space + decoration +
   spawn policy) for *variety* (a fleet of themed vehicles, a stand of alien flora).

### Enabling work the factory needs

The factory works object-by-object today but lacks two things a composer relies on:

- **named-asset registry** — today assets are builder functions + the hardcoded
  `VEHICLE_REGISTRY`. Add a small registry (`asset-registry.js`) mapping
  `assetId → { build(params) → workbench manifest, family? }` so a theme's ASSET slot can
  name a fabricated part and the composer can resolve + place it. Mirrors how the theme
  registry resolves context/material.
- **face caching** — memoize `workbenchAssetFaces` output by `(manifest hash, scale)` so a
  city stamping the same spire 200× bakes it once. Today only the figure mesh is memoized.

## Phasing

**Phase 1 — theme layer over existing kinds (no new geometry).**
- Slot vocabulary + per-base adapters (start with `city` + `dungeon`).
- `theme-registry.js` + `earth-temperate` (identity) + one sci-fi (`mars-colony`) +
  one fantasy (`dwarven-hold`) pack — packs that *remap existing knobs and recolor*.
- `compose_world` MCP tool → resolve → lower → `mintSketch`.
- Outcome: the same primitives produce Earth, Mars, and a fantasy hold from one tool.

**Phase 2 — theme-shipped fabricated assets (the workbench/assembler axis).**
- Stand up `asset-registry.js` + `workbenchAssetFaces` caching (the two enabling pieces
  above).
- Let ASSET slots resolve to workbench recipes / fabricator families, not just catalog
  keys. The composer places resolved faces via `extraFaces` into the base scene.
- Author a starter fabricated set per exotic theme (e.g. `mars-colony`: dome habitat +
  rover family; `dwarven-hold`: carved pillar + brazier) so fantasy/scifi get genuinely
  distinct objects, not just recolors. Also extend sky/atmosphere + texture families
  tagged by theme family. Identity pack ignores all of it (no regression).

**Phase G — the linear-directional geography (the one missing topology).**
- Build the directed-spine generator: a start→end unidirectional progression of
  chambers/platforms with gates. Reuse the dungeon chamber+tunnel kernel where possible.
- Add *variety along the spine* — height changes, width pinches, branch-and-rejoin
  detours, set-pieces — as decoration of the unidirectional path, not a separate axis.
- Pair with the existing `platform` movement rule in `controllable-world` so the level is
  actually traversable as authored.

**Phase R — the rubric axis (parallel track, gated on a second base existing).**
- Extract the house quality stack (`assessFlow` + `scoreHouse` + RELATIONSHIPS) into a
  kind-agnostic `world-rubric.js` over the shared circulation/face model.
- Generalize lenses + make weights author-chosen; allow fault signs to flip per intent.
- Wire seed-selection in the composer to score against the chosen rubric for every base
  (today only houses do this).
- Ship starter rubrics: `dwelling`, `dungeon`, `sanctuary` — proving the same fault can be
  a penalty in one and a reward in another.

**Phase 3 — more bases.**
- Surface the internal-only kinds (`floorplan`, `room`, `restaurant`, `planetary`) as
  composer bases with their own slot adapters. Optionally a low-level `chambers/tunnels`
  base (generalized dungeon spec) for fully freeform composition.

## Open decisions

- **Per-base adapter location** — co-locate each adapter with its generator
  (`fractal-city.js` exports a `themeAdapter`) vs a central `world-composer.js` map.
  Leaning co-located, so adding a base keeps its theme wiring next to its knobs.
- **How `overrides` interacts with theme palettes** — overrides win (last-write), but a
  palette override should recolor downstream assets, which means palette must be applied
  *after* merge, not baked into slot values. Resolve palette last.
- **Discovery** — does `compose_world` advertise the theme list inline, or via a sibling
  `list_world_themes` tool / `forward_context` row? Leaning sibling tool, since the pack
  set will grow and packs carry descriptions worth surfacing.
```
