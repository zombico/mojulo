---
{
  "id": "vortex-singularity",
  "label": "Vortex singularity (field-coupled tight golden spin)",
  "family": "wave-spin",
  "aliases": ["field-coupled vortex", "self-contained vortex", "position-dependent bending", "scene-coupled spin", "intensified core", "field-driven rasengan", "spatially-variable spin", "physics-coupled tusk"],
  "intents": ["spin", "rotation", "field-coupled", "position-dependent", "self-contained-physics", "scene-coupling", "volumetric"],
  "topology": {
    "primitive": "wave-manji",
    "shape": "spiral",
    "axes": 2,
    "rotation": "golden",
    "coupling": "field-borne"
  },
  "reasoningUse": [
    "a tusk wave-manji whose bending intensity is borne by a card-declared radial field — the singularity reads its own contained-spin physics from the field, no host configuration needed",
    "use when a scene needs field-coupled physics demonstrated in one drop-in card; or as a template for further field-borne archetypes",
    "the canonical example of a SHELF CARD that declares its own physics field — the substrate's cross-primitive coupling made self-contained and discoverable"
  ],
  "boundaryContract": {
    "slots": ["center"],
    "fields": ["vortex-zone"],
    "coupling": "self-declared"
  },
  "manjiProgram": {
    "fields": {
      "vortex-zone": {
        "kind": "radial",
        "center": "self/slot/center",
        "innerRadius": 0.5,
        "innerValue": 2.0,
        "outerRadius": 8.0,
        "outerValue": 0.3
      }
    },
    "children": [
      {
        "kind": "wave-manji",
        "singularity": "self/slot/center",
        "script": "tusk",
        "bending": { "field": "vortex-zone" },
        "density": 18,
        "params": { "initialRadius": 0.2 },
        "style": { "stroke": "#a60", "width": 0.7 }
      }
    ]
  }
}
---

# Vortex singularity (field-coupled tight golden spin)

A tusk wave-manji whose `bending` is read from a card-declared radial
field also centered at `self/slot/center`. The card is **self-contained**
— invoking it via `{ programRef: 'vortex-singularity' }` in any host
that provides a `center` slot produces a contained, intense golden
spin with NO host-level field declaration required.

This card is the first member of a new family: shelf cards that ship
their own physics fields alongside the primitives that consume them.
The substrate's cross-primitive coupling machinery (from
[cross-primitive-fields.plan.md](../../../../lite-template/integration/0605/cross-primitive-fields.plan.md))
is no longer host-only — it lives on the shelf and is discoverable by
intent.

## Use when

Reach for `vortex-singularity` when the scene needs a single
field-coupled tusk that reads as a contained, intense vortex without
the host having to declare physics. Specific intents:

- **Demonstrations of field coupling** — when the scene's job is to
  show that mojulo's substrate supports position-dependent physics.
- **Drop-in vortex cores** — a center anchor for a scene that wants
  the visual signature of "intense rotation contained by its own
  pull" without authoring a field at the manifest level.
- **Template for further field-borne archetypes** — copy this card,
  swap `tusk` for `helix` or `rasengan-sphere`, adjust the field's
  inner/outer values, and you've shipped another self-contained
  field-coupled card.

When the host wants explicit control over the field's parameters
(say, to tune the well's radius or values), the host can declare a
field with id `vortex-zone` at the manifest level — host declarations
override card-declared fields, so the same card invocation cooperates
with host customization without re-authoring.

## Slot contract

One slot on the host: `center`. The card's radial field centers itself
at `self/slot/center`, which the walker substitutes to the host's
`center` slot position at inline-time.

## Field contract

The card declares one internal field:

- **`vortex-zone`** — radial, centered at `self/slot/center`, with
  `innerValue = 2.0` (tight, contained) within `innerRadius = 0.5`
  and `outerValue = 0.3` (loose, dispersing) past `outerRadius = 8.0`.
  The tusk's `bending` reads from this field at the singularity
  position, which IS the field's center — so the tusk sees `innerValue`
  and renders as a tightly-contained golden spin.

A host that wants to soften or sharpen the well can declare its own
`vortex-zone` field at the manifest level; the host's wins.

## Composition example

```json
{
  "tree": {
    "id": "world",
    "spine": { "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.3 } },
    "anchor": { "x": 0, "y": 0, "z": 0 },
    "slots": [{ "id": "center", "position": { "x": 0, "y": 0, "z": 0 } }],
    "children": [
      { "slot": "center", "node": { "programRef": "vortex-singularity" } }
    ]
  }
}
```

No `fields` block in the host manifest. No `physics` block needed.
The card brings its own physics; the host just provides a slot.

## Provenance and influences

This is the substrate's first demonstration of the
**self-contained-coupling pattern** — a shelf card that ships with
its own field declarations, so the field-borne behavior is discoverable
through semantic search and reusable as a drop-in. See
[cross-primitive-fields.plan.md](../../../../lite-template/integration/0605/cross-primitive-fields.plan.md)
for the substrate, and
[shelf-cards-declare-fields.plan.md](../../../../lite-template/integration/0605/shelf-cards-declare-fields.plan.md)
for the shelf-layer surface this card rides on. Conceptually it
operationalizes
[waveform-physics-design.md](../polygonizer/waveform-physics-design.md)
§6 ("Scene coupling") for the case where the "scene" is brought in by
the card itself rather than provided by the host.

## Stays bespoke when

- The field needs **multiple coupled parameters** (e.g., bending AND
  the wave-manji's pitch both reading from spatial fields). v1 cards
  declare one or two fields; richer cross-couplings are authored
  bespoke until a pattern emerges.
- The field's geometry should be **non-radial** (e.g., elliptical,
  layered, multi-center). Add another field kind to the substrate
  rather than reshape the card.
- The host wants to **override only part** of the field (e.g., keep
  innerRadius but change innerValue). Host-wins precedence operates at
  the whole-declaration level for v1; partial-override is a follow-up.
