---
{
  "id": "tile-grid-floor",
  "label": "Tile grid floor",
  "family": "surface-tile",
  "aliases": ["tile floor", "tiled floor", "mosaic floor", "checkerboard floor", "marble tile floor", "patterned floor"],
  "intents": ["surface", "interior-ground", "depth-staging", "patterned-floor"],
  "topology": {
    "primitive": "wave-field",
    "shape": "horizontal-quad",
    "energy": "none",
    "density": "high"
  },
  "reasoningUse": [
    "a paved floor where the tile grid itself is compositionally important",
    "regular orthogonal sampling that reads as a recognizable tile pattern under perspective",
    "use when the floor should signal civic / ceremonial / Renaissance interior, not just 'ground'"
  ],
  "boundaryContract": {
    "corners": ["NW", "NE", "SE", "SW"],
    "displacement": "gravity-perpendicular"
  },
  "manjiProgram": {
    "children": [
      {
        "kind": "wave-field",
        "corners": [
          "self/slot/NW",
          "self/slot/NE",
          "self/slot/SE",
          "self/slot/SW"
        ],
        "waves": [],
        "samples": { "u": 24, "v": 12 },
        "style": { "stroke": "#5a4d3d", "width": 0.6 }
      }
    ]
  }
}
---

# Tile grid floor

A flat horizontal surface sampled at high grid density so the iso-u /
iso-v polylines themselves read as tile boundaries under perspective.
The same primitive as `flat-floor` but with denser sampling and a
warmer stroke — the difference between "this place has a floor" and
"this place has a *tiled* floor."

## Use when

Reach for tile-grid-floor when the floor's pattern is part of the
composition rather than just a baseline. Specific intents:

- **Civic interiors** — Renaissance halls, cathedrals, courthouses,
  museums. The tile pattern receding into the back of the camera does
  significant work establishing depth and scale.
- **Ceremonial spaces** — throne rooms, ritual halls, processional
  routes. The orthogonal grid reads as deliberate, formal.
- **Marble / stone-floor portraits** — the floor occupies the lower
  third of the frame and the tile lines lead the eye toward the figure.

For unpaved or rough ground use `flat-floor` (lighter grid). For grass
or terrain use `rolling-hills` or `grass-plane`. For water use
`calm-water` or `choppy-sea`.

## Composition example

Same authoring shape as `flat-floor` but with denser samples:

```json
{
  "tree": {
    "id": "hall",
    "programRef": "school-of-athens-central-hall",
    "children": [ ... ]
  },
  "waveFields": [
    {
      "corners": [
        "hall/slot/left-aisle",
        "hall/slot/right-aisle",
        "hall/slot/back-arch-aperture",
        "hall/slot/foreground-steps"
      ],
      "waves": [],
      "samples": { "u": 24, "v": 12 },
      "style": { "stroke": "#5a4d3d", "width": 0.6 }
    }
  ]
}
```

The 24×12 sampling produces visible tile cells that recede in
perspective — the eye reads "tiled floor" because the grid density and
warm stroke color signal a paved interior.

## Provenance and influences

The floor pattern in Raphael's *School of Athens*, Vermeer's
checkerboard interiors, and a thousand Dutch genre paintings. The grid
isn't authoritatively a checkerboard until the renderer's terminal-mark
vocabulary lands alternating fills — for now the grid reads as the
geometric scaffold a checkerboard would sit on. When `brick-fill` /
`stipple` realization arrives, this card pairs with them naturally.

## Stays bespoke when

- The tile pattern is **diagonal** or **herringbone**. The wave-field
  samples on a rectilinear (u, v) grid; rotated tile patterns need
  either a different sampling parameterization or a per-cell mark
  realization.
- The floor has **irregular tile sizes** (large stones near a central
  rosette, smaller tiles around the edges). Wave-field samples
  uniformly; non-uniform tile rhythms require explicit per-cell authoring.
- Only one or two tiles should be visible (close-up, intimate shot).
  At that zoom the grid is overkill; render the tile edges as inline
  manji bars instead.
