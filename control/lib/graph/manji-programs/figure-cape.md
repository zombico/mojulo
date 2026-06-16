---
{
  "id": "figure-cape",
  "label": "Figure cape (wave-field hung from shoulders to ankles)",
  "family": "figure-adornment",
  "aliases": ["cape", "cloak", "robe", "mantle", "drapery", "back-cape", "figure-drape"],
  "intents": ["cape", "cloak", "drape", "robe", "cloth", "garment", "mantle", "adornment", "back"],
  "topology": {
    "primitive": "wave-field",
    "shape": "vertical-quad",
    "corners": ["shoulder-l", "shoulder-r", "ankle-r", "ankle-l"]
  },
  "reasoningUse": [
    "a cape or cloak hung behind a figure, rendered as a wave-field whose four corners are the figure's shoulder-l, shoulder-r, ankle-r, ankle-l landmarks — a vertical cloth quad with low-amplitude waves giving fold rhythm",
    "use when a figure needs visible drapery — a royal, a saint with mantle, a wizard with cloak, an ascetic with shawl",
    "the third figure-adornment card; pairs cleanly with figure-halo (saintly figure with mantle) or figure-orb (mage with cloak)"
  ],
  "boundaryContract": {
    "slots": ["shoulder-l", "shoulder-r", "ankle-l", "ankle-r"],
    "convention": "Container preset — the cape's wave-field corners reference the figure's shoulder and ankle landmarks via `self/slot/<id>` paths. Corner order is CCW from (u=0,v=0): shoulder-l, shoulder-r, ankle-r, ankle-l. Displacement is gravity-perpendicular = horizontal, so the vertical cloth ripples outward in low-amplitude folds."
  },
  "manjiProgram": {
    "children": [
      {
        "kind": "wave-field",
        "corners": [
          "self/slot/shoulder-l",
          "self/slot/shoulder-r",
          "self/slot/ankle-r",
          "self/slot/ankle-l"
        ],
        "waves": [
          { "amplitude": 0.04, "cycles": { "u": 2.0, "v": 1.0 }, "phase": 0 },
          { "amplitude": 0.02, "cycles": { "u": 5.0, "v": 1.5 }, "phase": 0.7 }
        ],
        "samples": { "u": 18, "v": 22 },
        "style": { "stroke": "#5a3a4a", "width": 0.5 }
      }
    ]
  }
}
---

# Figure cape (wave-field hung from shoulders to ankles)

A cape behind a figure, rendered as a wave-field whose four corners are
the figure's shoulder and ankle landmarks. Two superposed wave components
(a long fold + a finer ripple) give the cloth visible drape rhythm without
the visual noise of a high-energy garment. The displacement direction
defaults to gravity-perpendicular, which for a vertical cloth quad means
horizontal ripple — the cape sways outward in low-amplitude folds.

This card is the third figure-adornment, after `figure-halo` and
`figure-orb`. Where those used wave-manji (closed singularity-anchored
loops), this uses wave-field (open displacement surface over a 4-corner
quad). The substrate handles both identically through the same
`host/slot/<id>` endpoint grammar — composition is uniform across
primitive families.

## Use when

- **Saintly figures.** A figure with mantle — Christian saint with
  cope, Buddhist monk with robe, Hindu deva with shawl. Pairs naturally
  with `figure-halo` for full iconographic staging.
- **Royalty / ceremonial.** A monarch, judge, official, or other
  rank-bearing figure whose drapery signals office.
- **Magical / weathered figures.** A wizard with cloak, an ascetic
  with shawl, a wanderer with travel-cloak. Pairs naturally with
  `figure-orb` for the spellcaster reading.

## Slot contract

Four slots on the host: `shoulder-l`, `shoulder-r`, `ankle-l`, `ankle-r`.
Mount the cape as a top-level child of the figure scene; the cape isn't
slot-bound to one landmark — its corners read from four landmark slots
directly. Best authored as a sibling under the figure's invoking node:

```json
{
  "slot": "figure-anchor",
  "node": {
    "id": "monarch",
    "programRef": "standing-figure-canonical",
    "scale": 4,
    "children": [
      { "slot": "shoulder-l", "node": { "programRef": "figure-cape" } }
    ]
  }
}
```

Mounting on `shoulder-l` is conventional but the cape geometry doesn't
depend on that specific slot — the slot binding is just where the cape
card *lives* in the tree (its enclosing-manji scope). All four cape
corners are resolved through `self/slot/...` paths independently.

If the host's landmark names differ, alias each corner explicitly:

```json
{ "slot": "shoulder-l", "node": { "programRef": "figure-cape",
  "pathBindings": {
    "self/slot/shoulder-l": "host/slot/cape-NW",
    "self/slot/shoulder-r": "host/slot/cape-NE",
    "self/slot/ankle-r":    "host/slot/cape-SE",
    "self/slot/ankle-l":    "host/slot/cape-SW"
  } } }
```

## Composition examples

A bowed praying figure with a mantle:

```json
{
  "tree": {
    "id": "world",
    "spine": { "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.4 } },
    "slots": [{ "id": "chapel-center", "position": { "x": 0, "y": 0, "z": 0 } }],
    "children": [
      { "slot": "chapel-center", "node": {
        "id": "monk", "programRef": "figure-praying-bowed", "scale": 4,
        "children": [
          { "slot": "head-crown", "node": { "programRef": "figure-halo" } },
          { "slot": "shoulder-l", "node": { "programRef": "figure-cape" } }
        ]
      }}
    ]
  }
}
```

## Provenance and influences

The cape-as-wave-field is the substrate's first cloth primitive. Real
cloth simulation is iterative; the substrate is a deterministic sampler,
so we approximate drape with low-amplitude two-mode wave components
authored as a static recipe. The visible result is "cloth-like" without
needing relaxation. The wave decomposition (one long fold + one
capillary) follows the same oceanographic-simplification logic
`calm-water` uses — two components is enough to read.

## Stays bespoke when

- The cape **wraps around the body** rather than hanging straight back.
  Wave-field is a single quad; wrapping needs multiple wave-fields or
  a different primitive.
- The cape has **trim, embroidery, or visible texture** beyond the
  wave displacement. Surface ornament is out of the substrate's
  resolution at this layer.
- The garment has **discrete folds** at sharp angles (a pleated robe,
  for instance). The wave-field's continuous displacement reads as
  soft drape; angular folds need explicit polygon composition.
- The cape is **lifted by wind** in an asymmetric direction — wave-field
  displacement is one direction (default = gravity-perpendicular).
  Wind-lifted drapery would override `displacement` with a wind vector.
