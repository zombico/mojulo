# Polygonizer substrate — synthesis

Status: living reference for where the polygonizer ended up after the
2026-06-04 / 06-05 substrate sprint. Supersedes the dozen integration
plan files in `lite-template/integration/0605/*.plan.md` as the
authoritative orientation. The plan files remain the source of
*historical* design rationale (why each move landed in the order it
did); this document is the source of *current* shape.

## TL;DR

The polygonizer composes illustrations from four wave-over-lattice
primitive families coupled through a declarative scalar/vector field
layer. Each primitive is callable as an in-tree leaf, validated at
mint time, projected through one shared perspective camera, and
discoverable through semantic search as a shelf card. The substrate
expresses anchor geometry (structure-manji), open and closed waves at
1D and 2D, and field-borne placement of objects on derived geometry
(terrain, curves). Most useful authoring patterns now collapse to a
small number of named field declarations + a tree of leaf invocations.

## Mental model

The substrate's design rule (from
[waveform-physics-design.md](../control/lib/graph/polygonizer/waveform-physics-design.md))
organizes every primitive along two axes:

```
       │  Open topology       │  Closed topology
───────┼──────────────────────┼─────────────────────
1D     │  line-between        │  wave-manji
2D     │  wave-field          │  lathe
```

- **Open** primitives have endpoints; modes are sines on an interval
  (Dirichlet boundary).
- **Closed** primitives wrap a singularity or axis; modes are sines
  on a circle (Fourier on a periodic domain).
- **1D vs 2D** is the parameter-space dimensionality of the form
  before it's swept into 3D world coordinates.

Sitting alongside this family is **structure-manji** — the cardinal
lattice that anchors everything else. Structure is "where things
deterministically are." Waves are "how things modulate around them."

## The four wave primitives, in their final shape

Every primitive uses the same authoring grammar: endpoint paths into a
host lattice (or `self/...` paths when invoked inside a card), inline
`{x,y,z}` corners/positions as an alternative, scene physics for
defaults, and a `style: { stroke, width }` for render. Every one can
ride as a top-level manifest array OR as a `kind: '...'` tree-leaf
child node.

### line-between (1D open)

A sine-of-sines curve between two endpoints. Sag (signed peak
displacement), wavelengths (cycle count), and an optional plane
override define the curve. Used for ropes, garlands, suspension
cables, vibrating strings, taut wires.

Sampler: [line-between.js](../control/lib/graph/polygonizer/line-between.js)
emits a 3D polyline.

### wave-field (2D open)

A height field over a 4-corner quad in 3D, sampled as a grid of
crest-line polylines. `corners` (4 endpoint paths or inline points),
`waves: [{ amplitude, cycles: { u, v }, phase? }]` (summed plane
waves), optional `displacement` direction (default = scene gravity),
optional `samples: { u, v }` (density, default 16×16).

Variant: a `heightField: '<field-id>'` parameter replaces the inline
waves sum with a scalar field's value at each base point. The visible
surface becomes the *same height function* other primitives consume
for placement (see "fields" below). When `heightField` is set, `waves`
must be empty — combine through `sum` fields at the field layer
instead.

Sampler: [wave-field.js](../control/lib/graph/polygonizer/wave-field.js).

### wave-manji (1D closed)

A printer that runs a named modulation script and emits closed loops
around a singularity until a density target is met. Six knobs on the
spec: `singularity` (endpoint or `{x,y,z}`), `bending`
(benevolent-attractor intensity, also field-borne), `plane` (loop
normal, default = gravity direction), `script` (archetype name), `seed`
(stochastic seed), `density` (pass count for density-driven scripts).

Ten archetypes ship today: `ouroboros`, `mandala`, `wind-chime`,
`rasengan`, `rasengan-sphere`, `smoke-ring`, `celtic`, `cloud`,
`tusk`, `helix`. The §5 design rule classifies them as flat
(one rotation axis: ouroboros / mandala / wind-chime / flat rasengan)
or volumetric (two independent modulation axes: rasengan-sphere /
smoke-ring / celtic / tusk / helix).

Authoring named modulations is closed — to add a new archetype, ship a
new script file and register it in the `SCRIPTS` table.

Sampler: [wave-manji.js](../control/lib/graph/polygonizer/wave-manji.js)
+ [wave-manji-scripts/](../control/lib/graph/polygonizer/wave-manji-scripts/).

### lathe (2D closed)

A surface of revolution. An axis from `axisFrom` to `axisTo`, a 1D
`profile: [{ t, radius }]` waveform sweeping radius along the axis,
optional N-fold angular `harmonics` for chiseling/fluting/beading.
Density per cross-section + samples per ring control resolution.
Negative-amplitude harmonics carve inward (classical fluting);
positive-amplitude bulge outward.

Used for bowls, vases, columns, chalices, balusters. Combined with
`replicate.offsets` + `scaleStep` it produces tapered colonnades and
balustrades.

Sampler: [lathe.js](../control/lib/graph/polygonizer/lathe.js).

## Carve and its temporal peers

Carve is the substrate's vector-outline-to-solid path: an arbitrary
2D contour (SVG path or font-carved text) is normalized, extruded,
beveled, and shaded as a standalone `kind: 'carved-solid'` sketch.
It is not one of the four wave primitives — it is the asymmetric
outline/solid sibling that handles logos, wordmarks, icons, badges,
and other forms whose silhouette is authored directly rather than
grown from a lattice.

Two phase-driven peers sit beside it:

- **`materialize`** — presence over time: empty -> form. It consumes
  one contour set and emits a phase state for `forge_motion`. Classes:
  `hologram` (wireframe draws on, then skin solidifies), `doom`
  (a glowing scan plane prints the solid upward), and `transporter`
  (a deterministic particle cloud converges into the solid). Running
  the frames backward is dematerialization.
- **`transfigure`** — identity over time: form A -> form B. It consumes
  two contour sets and morphs the outer-ring correspondence. Classes:
  `galvatron` (de-skin to wireframe, reshape the wireframe, then
  re-skin as the destination material) and `liquid-metal` (leave the
  beveled carve renderer, plan a smooth liquid carrier with radial structure
  in vector space, and draw only the resulting waveform mass in worldspace
  as it liquefies from A to B, approximating a T1000-style morph).
  Liquid-metal is a general transfigure carrier, not a metal-only endpoint
  rule: any source and destination carved identities can pass through it.
  `forge_motion` exposes small deterministic tuning under
  `shot.params.liquid`: `carrier` (material name, `#hex`, or material object;
  default `chrome`), `blobRandomness` (`0..1`), and `highlightBias` (`-1..1`).

The division of labor is deliberate. The primitives in
[materialize.js](../control/lib/graph/polygonizer/materialize.js) and
[transfigure.js](../control/lib/graph/polygonizer/transfigure.js) are
pure geometry/state: `(contours, class, phase) -> phase-state`.
[carved-motion.js](../control/lib/graph/carved-motion.js) is the
consumer: it reuses the carved-solid camera, extrusion, bevel, and
vexar shading stack, then draws wire/skin crossfades, scan-plane clips,
or particle clouds. [forge_motion](../control/lib/mcp/tools/motion.js)
is the exposed surface because these are time arcs over an existing
subject, not still-image options on `create_carved_solid`.

The liquid-metal renderer has an extra discipline: its golden-ratio radial
rings are planning-space only. The emitted SVG worldspace surface is a
continuous clipped waveform silhouette with soft lighting bands, so helper
radials or tessellation cells cannot appear in GIF output.

Current limits are intentionally narrow: transfigure morphs one outer
contour correspondence, so shapes with materially different hole
topology can swim; effect shots use the fixed carved-solid hero
framing. Those are horizontal expansion points, not blockers for the
core presence/identity motion family.

## Structure-manji and the tree-IR

A manji-tree is a recursive composition of **cardinal manji nodes**
(spine + slots + children) terminating in **terminal marks** (line,
polygon, dot, brick-fill, hatch, stipple, wash, wisp) or **leaf marks**
(connection, wave-field, wave-manji, lathe). The walker descends the
tree, accumulating world anchors and scales, and emits a flat list
the renderer paints.

### Authoring grammar

```js
{
  // One of:
  spine: { bar1: { axis, tails, lengthScale }, bar2: ..., bar3: ... },
  slots: [{ id, position: { x, y, z } }],
  // OR
  programRef: 'card-id',
  pathBindings: { 'self/slot/x': 'host/slot/y' },  // optional
  // OR
  kind: 'line' | 'polygon' | 'dot' | 'connection' | 'wave-field' | 'wave-manji' | 'lathe',
  // shared:
  anchor: { x: 0, y: 0, z: 0 },
  scale: 1,
  reflect: 'N-S' | 'E-W' | 'Zenith-Nadir',  // optional
  replicate: { offsets: [...] | pattern: '...' },  // optional
  scaleStep: 0.85,  // optional per-instance modulation
  role: 'figure' | 'pillar' | 'detail' | 'arch-spine' | 'default',  // optional renderer hint
  children: [{ slot, slotScale, node }],
}
```

### Cardinal grammar discipline

Every bar is line-pinned to a cardinal axis (N-S, E-W, Zenith-Nadir).
Every fold is to a cardinal direction. No free angles. The validator
runs `validateCardinalManji3D` on every program node — bad geometry
fails at mint time, not at render.

### Replicate + reflect

`replicate` instantiates the inner `node` at each offset (literal
list, or a pattern-generated grid). With `scaleStep`, each instance
`i` gets `scaleStep^i` applied — the per-instance modulation that
turns a uniform ring into a spiral or a colonnade into a tapered row.

`reflect: '<cardinal-axis>'` mirrors the subtree across that axis.
Cardinals map to cardinals (N↔S under N-S reflection, etc.), so the
grammar discipline holds under reflection.

### Field-coupled scalars

Every scalar parameter on a structure node — `scale`, `slotScale`,
`bar.lengthScale`, `anchor.{x,y,z}` — accepts either a literal number
or `{ field: '<id>' }`. Field refs evaluate through the manifest's
field resolver at the parameter's natural sample point:

- `scale` evaluates at the node's `worldAnchor`.
- `slotScale` evaluates at the parent slot's `worldPosition`.
- `bar.lengthScale` evaluates at the node's `worldAnchor`.
- `anchor.x/y/z` evaluate at the partially-built world position
  (so `anchor.z` reads a terrain field at the child's (x, y)).

### The v1 restriction on structure scalars

Structure scalars resolve at walk time — before card-emitted fields
exist. So structure scalars can only reference *manifest-declared*
fields, not fields emitted by `programRef` cards. Wave-manji
`bending` evaluates at render time after the walker has produced the
emit list, so it CAN reference card-emitted fields. The asymmetry is
documented; both directions are noted in the mint-error messages.

Walker: [manji-program.js](../control/lib/graph/polygonizer/manji-program.js).

## The fields layer

The substrate's coupling mechanism. A field is a named, declarative
description of a scalar (or vector) over space that primitives can
read via `{ field: '<id>' }` references on their parameters.

### Field kinds

Eight kinds in the closed enumerable set, seven scalar and one vector:

| Kind | Returns | Use |
|------|---------|-----|
| `constant` | scalar | named numeric parameter operators can tune |
| `radial` | scalar | distance-from a center with inner/outer values |
| `gradient` | scalar | linear interpolation between two points |
| `wave-surface` | scalar | sum-of-plane-waves over a quad (terrain) |
| `noise` | scalar | seeded value noise with octave summing (organic) |
| `sum` | scalar | weighted sum of other fields (composition) |
| `curve-projection` | **vector** | closest point on a polyline (snap-to-curve) |
| `curve-distance` | scalar | world-unit distance from query to a polyline (fade with proximity) |

Validators are uniform: numeric finite checks, enumerable
`beyond: 'clamp' | 'extrapolate'` where it applies, endpoint-path
resolution where positions are referenced. The closed enum makes
discovery and tooling tractable; adding a new kind is a small PR
that goes through the same compiler hook.

### Sum composition

`{ kind: 'sum', components: [{ field, weight? }, ...], offset? }` —
weighted summation. Components reference other declared fields by id;
sum fields can reference other sum fields, with cycle detection at
compile time (the validator surfaces the cycle path).

### Vector fields and component extraction

A vector field returns `{x, y, z}` instead of a number. Today the
only vector kind is `curve-projection`. Scalar consumers extract one
component via the optional `component` parameter on the field ref:

```js
anchor: {
  x: { field: 'river-bank', component: 'x' },
  y: { field: 'river-bank', component: 'y' },
  z: { field: 'river-bank', component: 'z' },
}
```

When the field is scalar, `component` is ignored (the scalar IS the
result). When the field is vector and no component is specified, the
validator catches it at mint.

### What primitives consume fields

| Parameter | Eval position | Notes |
|-----------|---------------|-------|
| `waveManji[].bending` | singularity | render-time; can ref card-emitted |
| `waveFields[].heightField` | per grid sample's base point | render-time; replaces inline waves |
| `node.anchor.{x,y,z}` | partially-built world anchor | walk-time; host-declared only |
| `node.scale` | node's world anchor | walk-time; host-declared only |
| `binding.slotScale` | parent slot's world position | walk-time; host-declared only |
| `node.spine.bar*.lengthScale` | node's world anchor | walk-time; host-declared only |

Module: [fields.js](../control/lib/graph/polygonizer/fields.js).

## The vajra — 3-point relational volume

The vajra is the substrate's first **relational** primitive (a bond
among multiple points) and the first whose canonical output lives in
**wave-space** rather than pixel-space. Where waves and lathes anchor to
one point or two endpoints, a vajra binds **three** — `o-o-o`: a small
center sphere (the hub / guideline) and two larger outer spheres.

The bond is not an authored cone. It is the **iso-surface of a
relational volume field** shaped like two sideways lightbulbs with their
screw ends facing each other: each prong is a fat outer sphere (the
**bulb**, radius = the outer bead) smooth-unioned (polynomial smin, width
`blend`) with a thin constant-radius neck (the **screw**, radius = the
center bead) running inward to the hub. The two necks meet at the center.
The smin carves the concave bulb↔neck shoulder — `blend → 0` is a sharp
shoulder, higher blend rounds it. The widest mass lives at the outer
beads; the center is the thin pinch. The form is omnidirectional — the
three points may sit anywhere in 3D.

A vajra paints **no world-space surface of its own**. Its output is a
stack of **golden rings** — iso-surface cross-sections sampled by
ray-marching ⊥ to a quadratic Bézier spine through the center. That ring
stack is the wave-space face; a later skin/drape pass triangulates it
into a lit mesh, or a wrapping wave winds around the volume. This is the
fields-layer posture (define something real others consume; paint
nothing) raised to a volume.

Authored either as a top-level `vajras: [{ proximal, center, distal,
beads?, blend?, isoOffset?, extraction?, crossSections?, samples?, style?
}]` array on the manifest, or as an in-tree `{ kind: 'vajra', id, ... }`
leaf child of a manji. Validated by `validateVajras`, sampled by
`sampleVajra`, projected by `manji-svg`'s gold ring pass.

As a mandala-space citizen, a *named* in-tree vajra emits its three
bead points back as slots on its enclosing manji — `<id>-proximal`,
`<id>-center`, `<id>-distal` — so connections, adornments, or another
vajra bind to the bonded points just like limb-chain joints (and they
render under `showSlotMarkers`). It both consumes lattice anchors (the
three points accept endpoint paths) and contributes new ones.

Module: [vajra.js](../control/lib/graph/polygonizer/vajra.js). The
optional `extraction: 'sweep'` mode and the underlying bent-lathe atom
(`lathe`'s `normalFrom`/`normalTo`) provide a cheap approximation; the
default `'field'` march is the primary path. Design + the still-deferred
in-tree-leaf authoring, bead-center slot emission, and field export:
[vajra-primitive.plan.md](../lite-template/integration/0608/vajra-primitive.plan.md).

### The three representation spaces

The vajra makes explicit a framing the substrate already implied: one
form has three faces. **mandala-space** is the cardinal scaffold +
addressable points; **wave-space** is the form as stacked rings (the
vajra's canonical golden-ring output); **world-space** is the rendered
pixels (the optional draped skin). A vajra is a wave-space citizen — it
generates volume there for the other two spaces to consume.

The first composed primitive built on the vajra is **figure-vajra** — the
fundamental figure shape: the empty figure skeleton as a harmonized vajra
graph (16 landmark nodes, 8 vajra edges) with anatomical ball-in-socket
joints and a clamped articulation model, manifest as the same three
faces. See [figure-vajra.md](figure-vajra.md).

The three spaces are not just a description — they imply a **pipeline**:
*form is vector (wave-space); paint is a separate, deterministic lowering
into the world grid.* Every serious primitive paints nothing — it exposes
geometry (envelope ∪ field) that a later pass consumes. The matter of that
pass (how a vector fills — a swept silhouette, loaded fibers, a draped skin)
is prototyped in the form's own **sub-space** (rBrush), then printed
deterministically to pixels, with the browser budget living in the print, not
the form. The plant macro and a unified print pass are the proof the framing
generalizes beyond the vajra. See
[wave-to-world-paint.plan.md](../lite-template/integration/0609/wave-to-world-paint.plan.md).

## The shelf card layer

Shelf cards are markdown files in
[control/lib/graph/manji-programs/](../control/lib/graph/manji-programs/)
that ship as named, semantically-discoverable building blocks.
JSON frontmatter declares the card's identity (id, label, family,
aliases, intents, reasoningUse, boundaryContract) and its payload
(`manjiProgram` for tree fragments, plus optional top-level
`waveField`, `connections`, `waveManji`).

### Two card shapes

**Spine-bearing cards** carry a `manjiProgram` with `spine` + `slots`
+ optional `children`. Invoking via `programRef` resolves them as
inline structural manjis at the calling node's position.

**Container preset cards** carry a `manjiProgram` with `children`
but no `spine` and no `slots`. The walker inlines the children at
the calling node's position, leaving the host's enclosing-manji id
in scope as `self`. The card's children typically reference
`self/slot/<id>` to bind to host slots.

### `pathBindings` for slot aliasing

A host whose slot names don't match a card's contract can attach
`pathBindings: { 'self/slot/<card-id>': 'host/slot/<host-id>' }` to
the calling node. The walker rewrites endpoint paths in the inlined
children at inline time. Exact-string matching; unbound paths fall
through unchanged.

### Card-declared fields

Cards can ship their own `fields: { <id>: <decl> }` inside their
`manjiProgram` payload. When the walker inlines a container preset,
it emits side-channel `cardField` records that the renderer + mint
validator merge with `manifest.fields`. Host fields win on overlap;
inter-card collisions throw at mint with a clear message. Card-
declared fields with `self/...` positions get substituted to the
calling node's enclosing manji at inline time.

### Semantic discovery

Cards are indexed under the `manji_program` source kind. The
`BodyComposition.manjiProgram` builder emits structured text
(aliases, family, intents, reasoningUse, slot contracts, primitive
summaries) into the embedding body, so a `semantic_search` query
matching the card's intent surfaces it for the LLM to invoke by
`programRef`.

Loader: [manji-programs/loader.js](../control/lib/graph/manji-programs/loader.js).

## The MCP authoring surface

The substrate is reached through one MCP tool: `create_manji_tree`,
exposed by [manji-trees.js](../control/lib/mcp/tools/manji-trees.js).
The tool's input schema enumerates every primitive and field kind
inline — no hidden grammar, no implicit defaults.

```js
create_manji_tree({
  title: '...',
  dimensions: '3d',
  tree: { /* root manji-tree node */ },
  fields: { /* manifest-level field declarations */ },
  waveFields: [ /* ... */ ],
  waveManji: [ /* ... */ ],
  lathes: [ /* ... */ ],
  vajras: [ /* ... */ ],
  connections: [ /* ... */ ],
  physics: { gravity, gravityStrength, defaultSagFactor },
  camera: { /* projectTwoPoint config */ },
  roomBasis: { /* projectTwoPoint config */ },
  viewBox: { width, height },
  showSlotMarkers: false,
})
```

Validation runs the appropriate combination of
`validateManjiTree3D`, `validateConnections`, `validateWaveFields`,
`validateWaveManji`, `validateLathes`, `validateFields`,
`validateStructureManjiFieldRefs`, `validateWaveManjiFieldRefs`,
`validateWaveFieldsFieldRefs`, `validateLeafMarkEndpoints`, and the
cross-card field-collision check. Bad manifests fail at mint, not at
render.

Persisted manifests serve through `/api/sketches/<ref>/svg` — the
renderer route detects `manifest.kind === 'manji-tree'` and
dispatches to [manji-svg.js](../control/lib/graph/polygonizer/manji-svg.js).

## Rendering pipeline

Single-pass projection through pure-mandala's two-point perspective
camera ([projectTwoPoint](../control/lib/graph/polygonizer/pure-mandala.js)),
followed by depth-sorted painting:

1. **Wave fields paint first** — back of the scene (terrain, water, sky).
2. **Manji-tree structure paints in depth order** — back-to-front by
   root-center `depthT`, with per-bar segment-level depth sorting.
   Role-aware overlays (figure silhouette, pillar column, detail box)
   paint under the structural bars.
3. **Lathes paint next** — surface-of-revolution objects (columns,
   vessels) between manji structure and wave-manji circulations.
4. **Wave manji paint next** — singularity-anchored circulations.
5. **Connections paint last** — top of the scene (ropes, garlands).
6. **Slot markers paint last-most** if `showSlotMarkers: true`.

Each primitive's contribution is a list of (a, b, depthT) line
segments; the renderer sorts per-primitive and emits SVG `<line>`
elements with the spec's `style.stroke` and `style.width`.

## Compositional patterns

A few authoring shapes worth knowing:

### Landscape (terrain + scatter)

```js
fields: {
  mountains: { kind: 'wave-surface', corners: [...], waves: [...] },
  bumps:     { kind: 'noise', seed: 'rocks', scale: 0.2, amplitude: 0.6 },
  elevation: { kind: 'sum', components: [{ field: 'mountains' }, { field: 'bumps' }] },
},
waveFields: [
  { corners: [...], heightField: 'elevation', samples: { u: 64, v: 64 } },
],
tree: {
  children: [{
    replicate: { offsets: [/* sparse xy grid */] },
    node: { anchor: { x: 0, y: 0, z: { field: 'elevation' } }, ... },
  }],
}
```

Visible terrain and tree placement share one field. Trees sit exactly
on the surface.

### Snap-to-curve placement

```js
fields: {
  path: { kind: 'curve-projection', waypoints: [/* 5 polyline points */] },
},
tree: {
  children: [{
    replicate: { offsets: [/* approximate positions */] },
    node: {
      anchor: {
        x: { field: 'path', component: 'x' },
        y: { field: 'path', component: 'y' },
        z: { field: 'path', component: 'z' },
      },
      ...
    },
  }],
}
```

Approximate offsets become exact placements on the polyline.

### Field-coupled vortex (object-with-physics shelf card)

```js
{ programRef: 'vortex-singularity' }
```

The card declares its own radial field anchored at `self/slot/center`
and a tusk wave-manji whose bending reads from that field. No host
configuration; one programRef invocation gets a field-coupled spin.

### Tapered colonnade

```js
{
  replicate: { offsets: [/* row of columns */] },
  scaleStep: 0.95,
  node: { programRef: 'fluted-column' },
}
```

Per-instance scale modulation gives perspectival rhythm without
per-column overrides.

### Generative composition: the plant macro

```js
plants: [{ form: 'shoot', base: { x:0, y:0, z:0 }, tip: { x:0, y:0, z:6 }, count: 13 }]
```

The first **generative composition** — distinct from frozen shelf cards.
A `plant` spec is a macro that *compiles to taiji specs at mint time*
(see [plant.js](../control/lib/graph/polygonizer/plant.js)): a spindle
taiji is a leaf/petal, a capsule taiji is a stem/tongue-leaf, placed by
two deterministic rules — golden-angle divergence + self-similar `taper`.
Seven forms (`shoot`, `frond`, `flower`, `rosette`, `tree`, `disc`, `grove`)
cover sprigs, ferns, sunflower heads, snake-plant rosettes, recursively-
branched trees/bushes (`tree`), the golden-spiral
radial packing (`disc` — seed-heads and, with `length`, pinecones), and a
landscape repeater (`grove` — many deterministically-varied trees on terrain).
A
browser-budget guard auto-lightens any plant that would exceed ~6k segments
and hard-caps the whole scene at mint, so output stays renderable. Because it
expands to the
existing `taijis` array, it needs **no renderer or walker code** — the
taiji wave-space paint pass draws it. This is the pattern to copy when a
new authoring shape is a *parametric arrangement of an existing
primitive* rather than a new geometric relation: a mint-time expander,
not a parallel render path. (The `taiji` it targets is the chirality
primitive — a handed coupling of two opposites about an axis; the
rotating partition it sweeps is what reads as leaf venation and stem
nodes.)

## Where to look for what

### Code

- Substrate: [control/lib/graph/polygonizer/](../control/lib/graph/polygonizer/)
- Shelf cards: [control/lib/graph/manji-programs/](../control/lib/graph/manji-programs/)
- MCP tool: [control/lib/mcp/tools/manji-trees.js](../control/lib/mcp/tools/manji-trees.js)
- Embeddings indexer: [control/lib/db/repositories/embeddings.js](../control/lib/db/repositories/embeddings.js)
  (search `BodyComposition.manjiProgram`)

### Spike artifacts

Visual review SVGs accumulate under
[lite-template/integration/0605/spike-output/](../lite-template/integration/0605/spike-output/),
grouped by subsystem:

- `wave-manji/` — the ten wave archetypes
- `wave-manji-fields/` — wave-manji × fields coupling
- `lathe/` — six lathe forms (cylinder → vase → bowl → chalice → fluted-column → balusters)
- `structure-unlocks/` — replicate scaleStep + field-coupled lengthScale
- `landscape/` — wave-surface field + anchor.z widening
- `landscape-noise/` — noise + sum + inline corners
- `landscape-coherent/` — heightField unifies surface + scatter
- `curve-projection/` — snap-to-curve placement
- `curve-distance/` — fade-with-distance from a path
- `wave2-cameras/` — 5 camera-shot cards (wide, medium, close-up, OTS, low-angle hero)
- `wave2-architecture/` — 5 architecture cards (peristyle, cloister, gazebo, portico, pergola)
- `wave2-postures/` — 5 body-posture cards (standing, seated, kneeling, reclining, contrapposto)

### Plans (historical rationale)

- [waveform-physics-design.md](../control/lib/graph/polygonizer/waveform-physics-design.md)
  — the wave/structure framing + named-archetype design
- [wave-and-line-in-tree.plan.md](../lite-template/integration/0605/wave-and-line-in-tree.plan.md)
  — folding open primitives into the tree-IR
- [wave-manji-as-leaf.plan.md](../lite-template/integration/0605/wave-manji-as-leaf.plan.md)
  — wave-manji becomes a tree-leaf
- [cross-primitive-fields.plan.md](../lite-template/integration/0605/cross-primitive-fields.plan.md)
  — fields as substrate-level coupling
- [shelf-cards-declare-fields.plan.md](../lite-template/integration/0605/shelf-cards-declare-fields.plan.md)
  — fields on the shelf
- [structure-manji-unlocks.plan.md](../lite-template/integration/0605/structure-manji-unlocks.plan.md)
  — wave-side discoveries ported back to structure
- [lathe-primitive.plan.md](../lite-template/integration/0605/lathe-primitive.plan.md)
  — completing the n=2 closed slot
- [landscape-substrate.plan.md](../lite-template/integration/0605/landscape-substrate.plan.md)
  — wave-surface field + anchor widening
- [landscape-followups.plan.md](../lite-template/integration/0605/landscape-followups.plan.md)
  — noise + sum + inline corners
- [wave-field-heightfield.plan.md](../lite-template/integration/0605/wave-field-heightfield.plan.md)
  — wave-field consumes a field
- [curve-projection-field.plan.md](../lite-template/integration/0605/curve-projection-field.plan.md)
  — the first vector field kind + component extraction
- [materialize-transfigure-motion.plan.md](../lite-template/integration/0611/materialize-transfigure-motion.plan.md)
  — carve's temporal peers wired into `forge_motion`

## What's still open

Honest list of substrate-level gaps:

- **Non-axis-aligned quads for `wave-surface` fields.** The inverse-
  bilinear interpolation for a tilted quad needs a quadratic solve.
  Deferred until a card needs it.
- **3D noise.** Today noise is 2D over the xy plane. Most use cases
  don't need volumetric noise; some might.
- **Perlin / simplex noise.** Value noise is the v1 shipped pick;
  gradient noise is the natural upgrade if visual quality at low
  octave counts isn't enough.
- **Bezier / spline curves for curve-projection.** Piecewise-linear
  is enough for paths and rivers; smooth curves are a follow-up.
- **Field-borne profile / harmonics on lathe.** Substrate machinery
  exists; widening the consumption sites is a small additional pass.
- **Asymmetric chiseling beyond a single outline.** `carve` now covers
  direct outline -> solid paths, including materialize/transfigure
  motion. Boolean cuts across already-composed 3D primitives are still
  a separate future step.
- **Per-invocation namespacing for card-declared fields.** Today
  invoking a field-declaring card twice in one scene throws; an
  automatic namespace based on slot path would lift the restriction.
- **Substrate library expansion.** The shelf is ~28 cards. Wave 2
  (cameras, architecture, body postures) shipped sub-waves 2.1–2.3
  for 15 cards across those three axes; the remaining gap is
  classical compositions and still-life arrangements.
- **Renderer enrichment.** Visible output is 1px polylines + role
  overlays. Paint vocabulary (`brick-fill`, `hatch`, `stipple`,
  `wash`, `wisp`) is named in the substrate but only structural bars
  consume it. Realizing those for wave primitives would significantly
  enrich the visual quality of every shelf card.

Each is small individually. None are blockers — the substrate as it
stands today is internally complete and externally callable for the
authoring patterns the design has been pointing at since the wave/
structure framing landed.

## The deeper synthesis

The wave/structure split named in the design doc was real at the
topology layer (open vs. closed, anchor vs. singularity), but as the
substrate evolved the two converged on a shared grammar:

> Lattices anchored to singularities, modulated by fields, varied by
> iteration.

Structure-manji and wave-manji are different *commitments* to
topology — they're not fundamentally different machinery. Both
anchor to named points. Both compose hierarchically. Both consume
fields. Both vary per-instance through `replicate` (positional /
scale). Both ship as shelf cards through the same loader. The
substrate's job is to keep that grammar coherent as new primitives
join the family — which today means: every new primitive should look
like the others when authored, validated, rendered, and discovered.

The fields layer is the deepest substrate move. It started as
"primitives consume declared scalars" and grew into "primitives
expose their geometry as fields others consume" (via wave-surface
and heightField). With curve-projection it crossed into vector
fields. With sum it became compositional. The substrate is now a
coupling fabric, not just a collection of marks.

For future substrate work: prefer additions that compose with the
existing grammar (new field kinds, new archetypes, new card families)
over additions that introduce parallel grammars (new top-level
manifest concepts, new authoring surfaces, special-case renderers).
The substrate's strength is its uniformity; protecting that uniformity
is the design move that keeps it tractable as it grows.
