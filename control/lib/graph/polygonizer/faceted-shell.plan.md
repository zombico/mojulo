# faceted-shell — polyhedra, semantic face selection, face operations

Status: **landed** (2026-08-29). A, B and C are built, wired and tested; §7 unchanged; §8 done.

Origin: a codex review of a Blender-authored object (a truncated-icosahedron shell whose faces
carry inset panels, coloured modules, and ports on face normals) that mojulo cannot currently
express. The review proposed seven affordances; four already exist in some form (see §7). This
plan covers the three that do not, which are really one gap:

> The workbench vocabulary is **lathes / extrudes / sweeps / drapes / reliefs** — surfaces of
> revolution and prisms swept along axes. There is no way to author a solid whose identity is its
> **topology**, and no vocabulary for addressing or operating on a face once you have one.

Three modules, in dependency order. Each is independently shippable and independently useful.

| | module | depends on | value alone |
|---|---|---|---|
| A | `face-select.js` — semantic face selection | nothing | makes **every existing** face list addressable |
| B | `shell-faces.js` — parametric polyhedra monomer | nothing | new authorable solids |
| C | `face-ops.js` — inset / extrude / recolor / port over a selection | A + B | panel-module language |

As built: [face-select.js](face-select.js) (35 tests), [shell-faces.js](shell-faces.js) (72 tests), [face-ops.js](face-ops.js) (38 tests), plus the workbench seams in [worlds/workbench.js](../worlds/workbench.js), the mint path in [mcp/tools/workbench.js](../../mcp/tools/workbench.js), and the `shells` section of [solid-vocab/workbench.md](../solid-vocab/workbench.md).

**Thesis: the substrate is already face-list-shaped, so this is authoring vocabulary, not an
engine change.** No renderer is touched. Every face these modules emit is the same record every
other monomer emits, and rides the existing material / AO / GI-bake / export paths unchanged.

---

## 0. The one primitive everything sits on

Every monomer in `polygonizer/` lowers to the same record ([extrude-faces.js:141](extrude-faces.js#L141)
is representative):

```js
{ corners: [{x,y,z}, …], fill: '#rrggbb', doubleSided: true, outNormal: [nx,ny,nz], material?, group? }
```

`corners` is a convex polygon in world space — **not** restricted to triangles or quads, which is
why pentagon/hexagon faces need no new render support. `outNormal` is already stamped by the
existing monomers (the GI bake requires it — see
[scene/export-normals.plan.md](../scene/export-normals.plan.md)). `material` is already resolved
per-face by `resolveFaceMaterials` in [worlds/world-scene.js](../worlds/world-scene.js), so
"assign material by face group" is **already a solved problem** the moment faces can be grouped.

That is the whole reason this plan is small.

---

## A. `face-select.js` — semantic face selection

**Do this first, even if B and C never happen.** It is a pure derive over a face list with
normals, it adds no storage, and it makes every world mojulo already builds addressable — mesh
worlds, fractal cities, dungeons, edifices, workbench parts — not just a new polyhedron kind.

```js
import { selectFaces } from './face-select.js';

selectFaces(faces, { facing: '+z', within: 30 })   // → indices of up-facing faces, 30° cone
selectFaces(faces, { ring: 'equator', band: 0.15 })
selectFaces(faces, { sides: 5 })                    // every pentagon
selectFaces(faces, { sides: 5, every: 3 })
selectFaces(faces, { near: [1,0,0], count: 4 })     // 4 faces nearest a direction
selectFaces(faces, { group: 'panel' })              // by existing face.group tag
```

### Selector vocabulary (v0)

- `facing` — `'+x'|'-x'|'+y'|'-y'|'+z'|'-z'` or a literal `[x,y,z]`; `within` (degrees, default 45)
  is the acceptance cone against `outNormal`.
- `ring` — `'equator'` | `'top'` | `'bottom'`, with `band` as a fraction of the model's z-extent.
- `sides` — polygon corner count (5 → pentagons, 6 → hexagons).
- `near` — a direction plus `count`: the N faces whose centers are most aligned with it.
- `group` — an existing `face.group` string.
- `every` — decimate an already-computed selection to every Nth, in a **stable order**.
- `not` / `and` — a selector object composes: `{ sides: 6, not: { facing: '-z' } }`.

### Invariants

- **Pure.** Takes a face list, returns integer indices. Never mutates, never renders.
- **Deterministic ordering.** Selection order is the face list's own index order; `every` and
  `count` slice that order, never a sort that could vary. A recipe re-selects identically forever.
- **No normals required.** Faces missing `outNormal` fall back to a computed Newell normal so the
  selector works over legacy face lists; `sides`/`group` never need one at all.
- **Empty is not an error.** A selector matching nothing returns `[]`; the *caller* decides whether
  that is a mint refusal (face-ops: yes, advisory reporting: no).

### Where it lands

New file `polygonizer/face-select.js`, plus `face-select.test.js`. No other file changes for A
alone.

---

## B. `shell-faces.js` — the parametric polyhedron monomer

A sixth monomer kind on the workbench, following the established file and naming contract exactly:

- new `polygonizer/shell-faces.js` exporting `shellToFaces(spec, opts)` + `validateShells(shells)`
- wired into [worlds/workbench.js](../worlds/workbench.js) at its **four** existing seams:
  `lowerObjectFaces` (line ~56), `monomerManifest` (~114), `monomerIntendsClosed` (~136),
  `planWorkbench` (~293, the arrays + validators + closure-lint table)

```js
shells: [
  { solid: 'truncated_icosahedron', radius: 2.0, center: {x:0,y:0,z:2},
    tint: '#e8e6e0', material: 'brushed-hull' }
]
```

### Spec

- `solid` (required) — `tetrahedron` | `cube` | `octahedron` | `dodecahedron` | `icosahedron` |
  `truncated_icosahedron` | `geodesic`. Unknown name → refused at mint with the list (the errors-teach
  convention already used by `mint_solid`).
- `radius` (required) — circumradius, in the workbench's measured `units` (cm).
- `center` (`{x,y,z}`, default origin) — z is up, consistent with every other monomer.
- `frequency` (int, `geodesic` only, default 1) — subdivision class-I frequency.
- `orient` (`[rx,ry,rz]` degrees, optional) — so an operator can put a pentagon on top.
- `tint` / `material` — same meaning as every other monomer; `material` validated by the existing
  `validateMaterialRef`.
- `open` (selector, optional) — faces to **omit**, so a shell can be a dome or a cut-away. Uses §A.

### Generation

Exact vertex construction from golden-ratio coordinates, not subdivision-of-a-sphere: the platonics
are literal coordinate tables, the truncated icosahedron is the standard truncation of the
icosahedron, `geodesic` is class-I subdivision of the icosahedron projected to the circumsphere.
This matters — a "sphere then merge coplanar" approach gives near-coplanar faces and a wobbling
face count, which would make selection and face-ops non-deterministic.

Each emitted face carries: `corners` (ordered CCW seen from outside), `outNormal`, `fill` (the
vexar-shaded `tint`, via `makeLight` like every sibling), plus two new fields the ops layer needs:

- `group` — `'shell'` by default, so a whole shell is selectable as a unit.
- `faceId` — `'<monomerIndex>:<n>'`, **stable across re-render**, so a recipe can name a specific
  face and mean the same one forever.

`faceId` is the quiet load-bearing decision here. It is what makes "the amber module is on face 17"
a durable recipe rather than a render-order accident.

### Vocab card

[solid-vocab/workbench.md](../solid-vocab/workbench.md) gains a `shells` section beside the other
five, and the spec-shape block and "provide at least one monomer" line grow `shells?`. The card is
indexed under `source_kind='solid_vocab'`, so this is how the agent discovers the kind — the card
is not documentation, it is the interface.

---

## C. `face-ops.js` — inset, extrude, port

The panel-module language. An op takes a face list + a selector + parameters, and returns a **new**
face list. Ops compose in order, each seeing the previous one's output.

```js
shells: [
  { solid: 'truncated_icosahedron', radius: 2.0, tint: '#e8e6e0',
    ops: [
      { op: 'inset',   select: { sides: 6 }, by: 0.18 },
      { op: 'extrude', select: { group: 'inset' }, by: 0.12, material: 'brushed-steel' },
      { op: 'recolor', select: { sides: 5, every: 3 }, tint: '#39c2d7', material: 'gradient-plate' },
      { op: 'port',    select: { facing: '+z', within: 20 }, radius: 0.14, depth: 0.2 }
    ] }
]
```

### The four ops (v0)

- **`inset`** — shrink a face toward its own centroid by `by` (absolute units, or `ratio` for a
  fraction of the face's inradius). Emits the inset face tagged `group:'inset'` plus the rim quads
  connecting it to the original boundary. The original face is **replaced**, not kept.
- **`extrude`** — push a face along its `outNormal` by `by`, emitting the moved cap (tagged
  `group:'panel'`) plus the side walls. `material` / `tint` on the op apply to the cap; `sideMaterial`
  to the walls.
- **`recolor`** — set `tint` / `material` / `group` on a selection without changing geometry. Trivial,
  and it is the one that does most of the visual work, because §0 means per-face material is already
  fully supported downstream.
- **`port`** — place a cylinder on the face center along its normal (`radius`, `depth`, `sides`,
  `tint`, `material`). **Additive geometry seated on the face, not a boolean cut** — see the
  non-goal below.

`inset` + `extrude` + `recolor` is exactly the "polyhedron → classify faces → make panel modules →
shade" pipeline from the review, and `port` is "add sockets."

### Invariants

- **Pure and ordered.** Each op is `(faces, spec) => faces`. Op order is the recipe; re-running the
  same op list on the same shell gives byte-identical geometry.
- **Selection is resolved against the face list as it exists at that op's turn**, which is why
  `extrude` can select `group:'inset'` — the previous op created that group. This is the composition
  mechanism; document it prominently or it will be rediscovered painfully.
- **An empty selection is a mint refusal**, with the selector echoed back and the available groups
  and side-counts listed. A silent no-op here is the single most likely source of "why does my
  recipe render nothing" confusion.
- **Non-convex results are refused.** `inset` on a concave polygon and `by` values exceeding the
  face's inradius both produce self-intersecting geometry; both are caught in `validateShells`
  during `planWorkbench`, not at render time (matching the "a bad spec fails at mint, not at view
  time" rule the carved-solid and workbench kinds already hold).

### Explicit non-goal: booleans

`port` seats a cylinder **on** the face; it does not cut a hole through the shell. Real CSG
(boolean difference, bevel with miter resolution) is a different order of problem — it needs a
half-edge mesh representation, and the whole `polygonizer/` substrate is deliberately a *face-list
surface modeler*, not a solid modeler (see the closure-lint in `monomerIntendsClosed`: it warns
about holes rather than preventing them, because open shells are legitimate here).

**If an object genuinely needs booleans, that is the honest moment to reach for Blender** — and the
seam already exists (§7). Do not grow a CSG kernel inside `polygonizer/` to avoid that hand-off.

---

## 7. What already exists (and should not be rebuilt)

The review proposed four further affordances. They are largely built; recording this so the next
reader does not re-propose them.

- **Recipe→Blender bridge — BUILT, and deliberately narrower than proposed.**
  `export_model` (.glb/.stl, [mcp/tools/sketch-model-export.js](../../mcp/tools/sketch-model-export.js))
  → headless Blender ([scripts/blender-bake.mjs](../../../scripts/blender-bake.mjs) for hero objects,
  [scripts/bake-world-gi.mjs](../../../scripts/bake-world-gi.mjs) for worlds) → `bind_mesh_render`
  (`glbToFaces`, sha256 + provenance) → `meshRef` in any world. See
  [docs/local-blender-worker.md](../../../../docs/local-blender-worker.md).

  **The bridge bakes; it must not compile.** Blender computes lighting that mojulo's unlit runtime
  then displays as plain vertex colours at zero cost, and the baked result ships to anyone with no
  Blender. Making Blender the *geometry compiler* would mean a recipe cannot become geometry without
  Blender on the host — which contradicts both the bicycle doctrine
  ([docs/bicycles.md](../../../../docs/bicycles.md)) and the substrate's own posture (mojulo is the
  upstream that *feeds* Blender; it holds no Blender, no keys, no state). This plan exists precisely
  so that objects like the review's shell are authorable **without** that dependency.

- **Artifact families — half-built.** [`run_experiment_sweep`](../../mcp/tools/research-sweep.js) is
  exactly the mint-N-variants → bind-provenance → auto-plot loop, but it is Ring 9 research and
  hardcoded to mechanics-view dynamics. Generalizing it to sweep any solid recipe is real work with
  a research-mode blast radius; it wants its own plan, not a paragraph in this one.

- **Preview LODs — mostly built.** `export_model` (glb/stl), `solid-turntable`, `forge_motion` GIF/MP4,
  and the image-outcomes hero-render path cover the list. Only low-poly LOD is genuinely missing, and
  nothing currently needs it.

- **Visual reference capture — built, one target short.**
  [`reference_protocol` + `capture_reference`](../../mcp/tools/visual-reference.js) already take an
  image the harness can see, decompose it into a target's dials, and file it as a bindable stash
  anchor. Targets today: `scene` / `pose` / `landscape`. An `object` target — the "visual cage"
  (shell topology, panel palette, port placement, aperture ratios) — is a small addition following an
  established pattern, and it is what closes the reference→recipe loop for objects. Best done
  **after** B, since the cage's dials should be the shell spec's dials.

---

## 8. Sequencing

1. **A alone.** `face-select.js` + tests. Ships value immediately against existing worlds; zero risk.
2. **B.** `shell-faces.js` + the four workbench seams + the vocab card section + tests. At this point
   a truncated-icosahedron shell is mintable and already inherits materials, GI bake, glb/stl export,
   turntables, and assembler placement for free.
3. **C.** `face-ops.js`, starting with `recolor` + `inset` + `extrude`; `port` last. `recolor` alone,
   composed with A, gets most of the review's target look.
4. **Then** the `object` reference target (§7), whose dials should mirror the shell spec.

Do not start C before A and B are landed and tested — the op layer's whole correctness argument is
that selection is deterministic and `faceId` is stable.

## 9. Open questions

- **Does `shells` belong on the workbench, or is it its own solid kind?** The workbench is documented
  as "a measured OBJECT study at literal scale," which fits. But shells + ops is arguably a different
  authoring posture (topology-first rather than profile-first). Starting as a workbench monomer costs
  nothing and can be promoted later; starting as a new `mint_solid` kind costs a vocab card, a
  dispatch entry, and a render path. **Recommendation: monomer.**
- **Should `ops` live on the shell spec, or as a manifest-level `ops` array that can target any
  monomer?** Manifest-level is more general (inset a face of an extrude), but needs selection across
  monomer boundaries and a groups-across-monomers story. **Recommendation: shell-local in v0**, with
  the op record shaped so it can be lifted later.
- **`geodesic` face count grows as 20·f².** RESOLVED: capped at `frequency` 8 (1280 faces) as a hard
  refusal, with the card advising ≤4 for a live orbitable world — the way
  [materials/procedural-material.plan.md](../materials/procedural-material.plan.md) caps `grid`.

## 10. What the build changed

Three things the plan got wrong, all caught by writing tests and by running the card's own example
rather than trusting it. Recorded because each is a trap the next reader would hit too.

- **Faces are recovered from the vertex set, not from hand-typed index tables.** Edges come from the
  minimum pairwise distance (every solid here is edge-transitive), faces from a rotational traversal
  of the resulting polyhedral graph. A 60-vertex/32-face solid therefore has no transcription to get
  wrong, and the tests assert Euler's V − E + F = 2 against the derived result for all six named
  solids. This was going to be a table; it should not have been.

- **`radius` is the CIRCUMradius, which does not seat a shell on the grid.** An icosahedron's
  bounding box is 1.70×radius, so `center.z = radius` leaves it floating — the existing
  grid-alignment lint fires, which is correct, but the card has to say so up front. Documented in
  the `shells` section and pinned by a test.

- **A `facing` cone is the wrong idiom for "the top one".** A default-oriented truncated
  icosahedron's nearest faces to +z sit at 20.9°, so the card's original `within: 20` selected
  nothing and the mint refused. `{ near:[0,0,1], count:1 }` always returns N. And once ops have run,
  narrow by group first (`{ group:'panel', near:… }`) — a rim quad framing the top panel can sit
  angularly closer to +z than the panel itself. Both lessons are in the card.

Also worth knowing: `material` names two different registries. On a monomer spec (and on an op) it
is the polygonizer shelf in [materials.js](materials.js) — gold/steel/chrome/…/glass/neon/cel. The
`brushed-steel`/`weathered-hull` family is the separate procedural-material registry that
`resolveFaceMaterials` reads off a mesh-world FACE. The op validator refuses a name from the wrong
shelf, which is how the card's first draft got caught.
