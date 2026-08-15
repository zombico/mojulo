---
{
  "id": "manji-tree",
  "name": "Manji-tree / polygomer",
  "family": "creature",
  "entry": "mint_solid",
  "summary": "Author a non-humanoid CREATURE or OBJECT as a bonded part-graph — a turnable 3D polygomer / .glb. Four authoring doors (via): ir / parts / prompt / packet.",
  "when": "Reach for this on framing like 'a creature / a monster / a non-humanoid character / an animal / a 3D object as bonded parts / a turnable model of X'."
}
---

A manji-tree (a.k.a. polygomer) is a non-humanoid CREATURE or OBJECT authored as a BONDED PART-GRAPH: a root manji node carries a cardinal spine and named slots, and volumes (surfaces of revolution, wave forms, relational bonds) are pinned between those slots by explicit endpoints. It is the counterpart to the humanoid figure primitive — a figure has a fixed human skeleton; a polygomer has whatever topology you bond. The stored artifact is a tiny deterministic recipe (`manifest.kind === 'manji-tree'`), not geometry; on render the substrate walks and validates the tree against the cardinal-lattice grammar and serves a rendered SVG, and — once skinned — a turnable 3D model / `.glb`. Every bar and fold is line-pinned to a cardinal axis (N, S, E, W, Zenith, Nadir); validation is binary and throws on free angles.

There are FOUR authoring doors over the same underlying result, selected by a `via` field on the spec. They differ only in how you supply the geometry — the persisted manji-tree and the render/skin/export path downstream are identical.

## Authoring doors (via)

### via: 'ir' (default)

The deepest door: author the full manji-program IR directly — the polygonizer's manji-driven intermediate representation. You bypass the recipe-compiler entirely and hand the substrate a validated tree plus optional sibling-primitive arrays. Pass `dimensions: '2d'` (unit-space walk) or `'3d'` (every point projected through a two-point perspective camera before render; defaults to `'2d'`). Required: `title` and `tree` (the root node).

Tree node shape (one of):
- `{ programRef: 'snowflake-sixfold', anchor?, scale?, children? }` — library-backed (2D only; refs into the mandala pattern library).
- `{ inlineProgram: cardinalManjiOutput, anchor?, scale?, children? }` — raw 2D/3D manji program.
- 2D inline preset: `{ spine: { bar1, bar2 }, slotPattern: { id, params }, slotLabels, centerSlotId?, anchor?, scale?, children? }`.
- 3D inline preset: `{ spine: { bar1, bar2, bar3 }, slots: [{ id, position: { x, y, z } }], anchor?, scale?, children? }`.
- Terminal mark: `{ kind: 'line' | 'polygon' | 'dot' | 'brick-fill' | 'hatch' | 'stipple' | 'wash' | 'wisp', anchor?, scale? }`.

Child binding: `{ slot: 'arm-0', slotScale?, node: <tree node> }`. Bar spec: `{ axis: 'N-S' | 'E-W' | 'Zenith-Nadir', tails?: { [cardinal]: 'open' | 'closed' | <cardinal> }, lengthScale? }`. Endpoint paths (used by every sibling primitive below) take the form `<node-id>/slot/<slot-id>` or `<node-id>/bar/<axis>/<point-name>` (point-name ∈ {center, negEnd, posEnd, negTip, posTip}); they require authored `id` fields on the nodes you reference, and resolve at render time, so moving a manji moves everything bonded to it.

Optional camera/framing:
- `camera` (3D) — `{ vanishingPoints: { left, right }, verticalAxis }` for `projectTwoPoint`.
- `roomBasis` (3D) — `{ xRange, yRange, frontY, backY, frontLeft, frontRight, depthReach, verticalUnit, verticalDepthShrink }`.
- `viewBox` — `{ width, height }` explicit viewport (2D fits content into it; 3D mostly derives its own).
- `showSlotMarkers` (default true) — overlays markers at the root's slot positions for review; set false for a clean render.

In-tree children (3D):
- **limb-chain** — `{ kind: 'limb-chain', origin: 'self/slot/<id>', fold: [x,y,z], segments: [...] }` placed under a node's `children`. Grows a forward-kinematic joint chain from a slot, emitting a new slot at each segment tip that downstream primitives reference by `self/slot/<name>`. Each segment carries `length`, `emit` (the emitted slot id), and rotation via (in precedence) `direction: [x,y,z]`, `rotations: [{axis, angle}, ...]` (cardinal labels or `binormal` or explicit vectors, composed in order, degrees), or legacy `bend` + `bendAxis?`. A `hinge: true` (+ optional `hingeAxis`) marks a 1-DOF anatomical joint — the validator refuses backward-bending joints and rotation-axis conflicts. Author chains BEFORE any leaf mark that references their emitted slots.
- **node rotation** — any 3D node accepts `rotation: [{axis, angle}, ...]` + optional `rotationPivot`, rotating all of a node's slots (and its limb-chain children's folds/axes) as one unit in local space before the world transform. The whole-form tilt/twist/side-bend dial.

Sibling primitive arrays (all 3D-only; each throws at mint if 2D):
- **connections** — 1D OPEN sine/cosine curves between two endpoint paths: `{ from, to, sag?, relativeSag?, wavelengths?, plane?, samples?, style? }`. `sag` (absolute) > `relativeSag` (fraction of span, portable) > physics auto-sag; positive bulges with gravity, negative against. `wavelengths` default 0.5 (single arc/catenary).
- **waveFields** — 2D height fields over a 4-corner quad, rendered as a crest-line grid: `{ corners: [4 endpoint paths CCW from (0,0)], waves?, displacement?, samples?, style? }`. `waves` is a summed set of `{ amplitude, cycles: { u, v }, phase? }` components; EMPTY `waves` = a flat quad (the "flat is still good" floor default). `displacement` overrides direction (default = gravity); `samples` grid density (default 16×16, min 2).
- **waveManji** — 1D CLOSED loops winding around a `singularity` (endpoint path or `{x,y,z}`): `{ singularity, script, bending?, plane?, params?, seed?, density?, samples?, style? }`. `script` is one of a named archetype catalog — **ouroboros, mandala, wind-chime, rasengan, rasengan-sphere, smoke-ring, celtic, cloud, tusk, helix** — each with its own `params` bag (radius/lobe/harmonic/spiral/tilt knobs; see the primitive vocabulary for per-archetype defaults). `bending` is the benevolent-attractor intensity (number, or `{ field: '<id>' }`); any `phaseStep` param accepts the literal `'golden'` (≈137.5°).
- **lathes** — surfaces of revolution (bowls, columns, chalices, ball-and-stick atoms): `{ axisFrom, axisTo, profile: [{ t, radius }], harmonics?, crossSections?, samples?, style? }`. `harmonics` add `amplitude·cos(n·θ + phase)` (n=24 negative = fluted Doric column). Default `style` draws WIREFRAME rings; `style: { fill: 'vexar', fillColor }` draws a LIT SHADED SOLID instead.
- **drapes** — hanging cloth SHEETS (cape, cloak, banner, tablecloth) over any two pinnable points: `{ anchor: [2 points], hang?, back?, drop?, flare?, hemZ?, spread?, waves?, pinToFree?, samples?, style? }`. A wave-field specialized into cloth — top edge pinned, hem flared and dropped, folds growing pin→free.
- **vajras** — the 3-point RELATIONAL bond `o-o-o` (two fat outer bulbs + thin center pinch, an iso-surface volume): `{ proximal, center, distal, beads?, blend?, isoOffset?, extraction?, crossSections?, samples?, style? }`. Omnidirectional; output is wave-space rings, no world surface of its own.
- **taijis** — the CHIRALITY primitive (rotation-symmetric handed coupling ☯): `{ yin, yang, center?, twist?, radius?, profile?, crossSections?, samples?, showEnvelope?, style? }`. Signed `twist` = handedness; a single taiji IS a double helix. `profile` ∈ `spindle` | `capsule`.
- **plants** — a generative MACRO compiling to taijis at mint (golden-angle divergence + self-similar taper): `{ form, ... }` with `form` ∈ `shoot` | `frond` | `flower` | `rosette` | `tree` | `disc` | `grove`, a `paint` mode (`silhouette` default | `fibers` | `brush` | `lines`), and a `detail` dial that auto-lightens to stay browser-renderable. Tree/disc/grove carry their own knob families (recursion depth/branches/foliage; disc packing; grove scatter).
- **fields** — named scalar fields (`{ <id>: { kind: 'constant' | 'radial' | 'gradient', ... } }`) that position-dependent parameters (currently `waveManji[].bending`) reference via `{ field: '<id>' }`.

Scene globals:
- **physics** — `{ gravity: {x,y,z} unit vector (default z-down), gravityStrength (default 1), defaultSagFactor (default 0.12) }`. One Earth per scene — override locally with per-line `sag`/`plane` and per-field `displacement`.
- **detail** — resolution dial 1–4 (default 1): raises lathe crossSections/samples weighted by part size under a face budget; hero masses gain articulation, beads stay lean, authored counts never reduce. Use 2 before skinning.

Note the whole scene is capped against a browser segment budget; a manifest too heavy to render throws at mint with an actionable fix (lower plant `detail`, thin taijis, split the scene).

### via: 'parts'

The approachable, conversational door: a part-graph grammar that lowers to the `'ir'` door for you — you list PARTS, the substrate generates the slots and lathes, no slot bookkeeping. This is the everyday way to author a non-humanoid 3D model. Input `{ title, parts: [...] }`, each part:

- `shape` — one of `bulb | dome | sphere | ball | bead | cone | stalk | drum | barrel | bell | disc | tube`. Use `ball` for a TRUE round ball (a round head / creature body / Kirby-style mascot); `sphere` is a slim bicone.
- `from: [x,y,z]` / `to: [x,y,z]` — the two endpoints the part is bonded between (its axis).
- `girth` (default 0.3) — max radius. `taper` (cone only, default 0.15) — tip fraction.
- `tint` — stroke colour (default `#5a6b6a`).
- `radial: { count, radius?, center? }` — rings N rotated copies around the z-axis (tentacles / legs / petals).
- `mirror: 'x' | 'y' | 'xy'` — reflects a paired copy.
- `crossSections` / `samples` — optional per-part mesh density.

Rounded forms only (no boxes yet). Also accepts `physics`, `detail` (dial 1–4; use 2 before skinning), `ref`, `folder_ref`. Returns the sketch ref/url plus a part count and a `next` hint: open the SVG, check the massing, re-mint to adjust, then hand the scaffold to the skin → export path for a turnable `.glb`.

### via: 'prompt'

The natural-language door: describe the creature/object in prose and a KEYED provider generates the polygonized manifest for you (defaults to the saved default LLM key, else a local model). Input is a `prompt` string plus a `mode`:

- `mode: 'one-trip'` (default) — a single model call emits the full manifest. Use for FLAT scenes (portraits, charts, single figures).
- `mode: 'plan-then-skin'` — a two-turn protocol: turn 1 emits a PLANNING manifest (no marks) that is gated through the authorship-preview and solved into a scaffold, then turn 2 emits marks against that solved scaffold. Failures are partitioned — planning errors don't waste mark-generation tokens, and skin errors don't invalidate the plan. Use for scenes with perspective / support / collision concerns (room interiors, architectural construction, multi-figure).

`repair: 'auto' | 'off'` spends at most one repair trip on local-validation failure (budget applies independently per turn in plan-then-skin). `mint` (default true) persists and returns the sketch url; `provider` / `model` / `apiKeyId` / `apiKey` override the credential (plaintext stays server-side — never returned). `preload` seeds prior sketches. The response surfaces `attempts`, `mode`, and for plan-then-skin `turns[]`, `phase`, `authorshipPreview`, and `scaffold`.

### via: 'packet'

The KEY-FREE door: a two-call handshake where YOU (the calling agent) are the generative model — no provider key, no local model. It is the same polygonizer discipline as `'prompt'`, handed to you as data.

1. **Omit the manifest** in the spec to get the PACKET back: `{ instructions, userPrompt, schema, classification, submit }`. Adopt `instructions`, answer `userPrompt` with ONE JSON object matching `schema`. `mode: 'one-trip'` (flat scenes) is one authoring turn; `mode: 'plan-then-skin'` (perspective / multi-figure / architectural) returns the PLANNING packet first.
2. **Include the authored manifest** in the spec (with the SAME `prompt`) to SUBMIT it. The substrate validates, applies deterministic repairs, lowers, and mints → `{ ok, sketch: { ref, url }, manifest, patchesApplied }`; on failure it returns `{ ok: false, errors, repairPrompt }` and YOU are the repair loop — fix per `repairPrompt` and resubmit. In plan-then-skin, submitting the `phase: 'planning'` manifest solves + gates the scaffold and hands back `{ scaffold, skinPacket }`; author marks per `skinPacket` and resubmit with `phase: 'skin'`. Stateless throughout; `mint: false` validates without persisting.

## Worked example

The `'parts'` door is the most approachable. A small squid-like creature — a round ball body, a domed cap, and a ring of six tapering tentacles:

```
{
  via: 'parts',
  title: 'reef drifter',
  parts: [
    { shape: 'ball',  from: [0, 0, 0],    to: [0, 0, 1.4], girth: 0.9, tint: '#6a8fb5' },
    { shape: 'dome',  from: [0, 0, 1.2],  to: [0, 0, 2.0], girth: 0.7, tint: '#5878a0' },
    { shape: 'cone',  from: [0.4, 0, 1.6], to: [0.7, 0, -1.2],
      girth: 0.18, taper: 0.1, radial: { count: 6 } }
  ]
}
```

The single `radial: { count: 6 }` cone becomes six tentacles ringed around the z-axis. Open the returned SVG to check the massing, re-mint to adjust, then follow the returned `next` hint through the skin → export path to a turnable `.glb`.
