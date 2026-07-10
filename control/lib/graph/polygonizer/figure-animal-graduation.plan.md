# figure-animal → sketch: the asset-library graduation

Status: **PLAN (not started).** The animal kit (`figure-animal-*.js`, `figure-animal-antler.js`,
the `fluff` register) and the `ZOO_BUILDS` recipes are built and render correctly — but ONLY the
spike/unit tests reach them (they write study sheets to `lite-template/integration/*/spike-output/`).
Nothing mints, persists, or serves an animal as an asset. This plan graduates the animal renderer
onto the sketch surface the SAME way [create_figure](../../mcp/tools/figure.js) graduated the
protoform. It is the "how does this get depicted / folded into the asset library" path.

Prereqs read: [zoo-mammals.plan.md](./zoo-mammals.plan.md) (the recipes + the kit), and the sketch
kind-dispatch in [stored-sketch-svg.js](../sketch/stored-sketch-svg.js).

## What an "asset" is here (the target shape)

An asset in mojulo is a **persisted sketch**: a row in the `sketches` table holding a tiny manifest
(`{ kind, …dials }`), rendered on demand — a deterministic recipe, never a stored raster. Four
things make a `kind` a first-class library asset, and `figure` has all four (this is the checklist):

1. an **MCP tool** that validates input and persists the manifest — [create_figure](../../mcp/tools/figure.js)
   → `kind: 'figure'`, returns `{ ok, ref, url, svgUrl, gifUrl? }`;
2. a **kind-dispatch branch** in [stored-sketch-svg.js](../sketch/stored-sketch-svg.js) mapping the
   `kind` to a renderer (`kind === 'figure'` → `renderFigureToSvg`);
3. **routes** that serve it — `/sketches/<ref>` (page), `/api/sketches/<ref>/svg`, `.../png`
   (the PNG route rasterizes through the SAME `renderStoredSketchSvg`, so it is free once #2 lands);
4. a **routing-index entry** so `forward_context` sends the operator to it — the `create_figure`
   rows in `TOOL_INDEX` / `ROUTING_INDEX` inside [context.js](../../mcp/tools/context.js), plus the
   one-line comment in [server.js](../../mcp/server.js).

## Where the animals sit today (the gap, confirmed by grep)

- `renderAnimalToSvg` (in [figure-render.js](./figure-render.js)) and `ZOO_BUILDS` have **no
  non-test consumers** outside this folder — no tool, no route.
- [stored-sketch-svg.js](../sketch/stored-sketch-svg.js) dispatches `manji-tree` /
  `painted-landscape` / `carved-solid` / `figure` — there is **no `animal` branch**. A stored
  `kind:'animal'` manifest would fall through to the diagram renderer and throw.
- So the animals are exactly where `figure` was before `create_figure`: substrate proven, tool not
  graduated.

## The touchpoints (the actual diff)

1. **`create_animal` MCP tool** — new file `control/lib/mcp/tools/animal.js`, mirroring
   [figure.js](../../mcp/tools/figure.js):
   - `handler(input)` builds a manifest `{ kind: 'animal', species? | archetype?, opts?, view?,
     elev?, crop?, background?, title }`, calls `renderAnimalToSvg(manifest)` ONCE to validate
     (bad dial → 400, not a 500 at view time — the create_figure pattern), then
     `SketchRepository.create({ title, manifest, ref, folderRef })`.
   - `registerAnimalTools()` → `registerTool({ name: 'create_animal', description, inputSchema,
     handler })`; call it from the tool-registration site next to `registerFigureTools`.
   - Returns `{ ok, ref, url: '/sketches/<ref>', svgUrl: '/api/sketches/<ref>/svg?inline=1' }`.
   - **renderAnimalToSvg already accepts a manifest** (`{ archetype, opts, view, elev, crop,
     background }`) — the tool is a thin persist-and-validate shell over it, like figure's.

2. **One dispatch line** in [stored-sketch-svg.js](../sketch/stored-sketch-svg.js):
   `if (manifest.kind === 'animal') return renderAnimalToSvg(manifest);`
   The renderer is manifest-shaped, so the manifest IS the render arg. PNG comes free via
   [sketch-png.js](../sketch/sketch-png.js) (`renderStoredSketchSvg`).

3. **Routing index** — add `create_animal` rows to `TOOL_INDEX` + `ROUTING_INDEX` in
   [context.js](../../mcp/tools/context.js) and the comment list in [server.js](../../mcp/server.js).
   Keep the tool description lean per the `forward_context` golden rule (thin routing index; heavy
   orientation behind a Ring-0 drawer / vocab card, not inlined).

4. **Cleanup** — fix the stale comment at [figure-render.js](./figure-render.js) (~L381) that
   claims "the /api/sketches route dispatches kind:'animal' here." It becomes true only when #2
   lands; until then it is aspirational and misleading.

5. **(Optional) discoverability vocab card** — a `semantic_search`-retrievable card (kind e.g.
   `sketch_vocab` / a new `animal_vocab`) listing the `QUADRUPED_ARCHETYPES` (the clade skeletons)
   and the `ZOO_BUILDS` roster (the named species), pulled on demand rather than inlined in the
   tool description. Mirrors the view-vocab cards under [views/view-vocab](../views/view-vocab/).

## Design decisions to make before coding

- **Preset vs parametric surface.** Recommend BOTH: a `species` enum (a `ZOO_BUILDS` name — the
  one-shot discoverable front door: `create_animal({ species: 'buck' })`) AND `archetype` + `opts`
  (full parametric control — the escape hatch, same dials `buildAnimal` takes). `species` resolves
  to `ZOO_BUILDS[species]` then merges any `opts` on top. This is the figure lesson inverted:
  figure is pure-parametric; animals already ship a curated catalog, so expose it.
- **Validate the archetype/species — do not silently fall back.** `renderAnimalToSvg` currently
  routes an unknown `archetype` to `QUADRUPED_ARCHETYPES[name] || {}` → the generic dog default
  (flagged in the first review). At the tool boundary, an unknown `species`/`archetype` must be a
  400 with the valid list, matching create_figure's fail-loud-at-mint posture.
- **Views.** Expose `view` (named `frontal|three-quarter|lateral|left|back` or azimuth°), `elev`,
  `crop: 'head'`, `background: false` (transparent) — all already supported by `renderAnimalToSvg`.
- **Where the figure/animal boundary sits.** Keep `create_animal` a SEPARATE tool from
  `create_figure`: different dial vocabularies (armature archetypes + coat/antler/fluff vs human
  pose/proto/garment). Do not overload one tool.

## Non-goals / defer

- **3D exports** (`/api/sketches/<ref>/model.glb` · `/scene` · `/world`) — animal is SVG-only, like
  figure; those routes stay scoped to the kinds that emit 3D. No guard needed beyond not advertising
  them for `animal`.
- **Motion / gait GIFs.** `create_figure` renders walk-cycle GIFs; animals have no gait substrate
  yet (a quadruped/biped walk cycle over the armature is its own effort). Ship stills first; add
  `animate` later.
- **A curated preset gallery UI.** The `/sketches` store already lists minted assets; a featured-
  presets surface is separate polish.

## Open questions for the operator

1. **Surface:** `species` enum + `opts` escape hatch (recommended), or purely parametric like
   figure, or purely preset?
2. **Vocab card now or later?** (Affects how discoverable the roster is vs. tool-description bloat.)
3. **Featured presets:** which of the built species (camel, kangaroo, red panda, deer, buck,
   gazelle, bear/raccoon/lion + the archetypes) should be first-class in the `species` enum vs left
   to the parametric path?
4. **Motion:** is a quadruped gait GIF in scope for this graduation, or a later plan?

## Acceptance (how we know it's folded in)

`create_animal({ species: 'buck', view: 'three-quarter' })` returns a `/sketches/<ref>` URL that
renders the antlered buck as a persisted asset; it appears in the `/sketches` listing; the PNG route
serves it; `forward_context` routes "draw me a deer / an animal" to the tool. Same end-state as
`create_figure`.
