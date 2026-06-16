---
{
  "id": "calm-water",
  "label": "Calm water",
  "family": "surface-water",
  "aliases": ["still water", "lake surface", "calm bay", "pond", "harbor water", "gentle sea", "quiet ocean"],
  "intents": ["surface", "water", "atmospheric-context", "depth-staging"],
  "topology": {
    "primitive": "wave-field",
    "shape": "horizontal-quad",
    "energy": "low"
  },
  "reasoningUse": [
    "a still or gently rippling water surface for coastal, lake, or harbor scenes",
    "fills the area around docks, islands, boats, and waterfront architecture",
    "the gentle default; use 'choppy-sea' for higher-energy water"
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
        "waves": [
          { "amplitude": 0.18, "cycles": { "u": 1.5, "v": 1.2 }, "phase": 0 },
          { "amplitude": 0.09, "cycles": { "u": 4.5, "v": 3.5 }, "phase": 0.4 }
        ],
        "samples": { "u": 22, "v": 14 },
        "style": { "stroke": "#5a8ab8", "width": 0.6 }
      }
    ]
  }
}
---

# Calm water

A still or gently rippling water surface. Two superposed wave components
(a low-frequency swell + a finer capillary ripple) produce a recognizable
"calm water" feel without the visual noise of a high-energy sea. The
muted blue stroke (`#5a8ab8`) signals water across the retrieval and
render surfaces — the model can pick this card by intent and the SVG
reads as water immediately.

## Use when

Reach for calm-water when the scene needs water that's PRESENT but not
the dramatic subject. Specific intents:

- **Coastal scenes** — harbor, dock, marina, beach. The water sits
  around buildings, boats, or piers and gives the scene maritime context
  without dominating.
- **Lakes and ponds** — gardens, mountain reservoirs, park ponds. The
  low energy reads as a quiet body of standing water.
- **Bays and inlets** — the helicopter-island scene's water around the
  perimeter; coastal architecture's foreground.
- **Reflections** (when paired with future companion primitives for
  reflection — for now, just the water surface itself).

When the water is the dramatic subject (storm, surf, open ocean),
prefer `choppy-sea`. When the scene needs no visible water (interior),
use `flat-floor` instead.

## Composition example

Apply around the helicopter-island scene by connecting four "open water"
anchor slots beyond the coast perimeter:

```json
{
  "tree": {
    "id": "island-scene",
    "spine": { ... },
    "anchor": { "x": 0, "y": -11, "z": 0 },
    "slots": [
      { "id": "water-NW", "position": { "x": -20, "y": -22, "z": -0.3 } },
      { "id": "water-NE", "position": { "x":  20, "y": -22, "z": -0.3 } },
      { "id": "water-SE", "position": { "x":  20, "y":  10, "z": -0.3 } },
      { "id": "water-SW", "position": { "x": -20, "y":  10, "z": -0.3 } },
      ...
    ]
  },
  "waveFields": [
    {
      "corners": [
        "island-scene/slot/water-NW",
        "island-scene/slot/water-NE",
        "island-scene/slot/water-SE",
        "island-scene/slot/water-SW"
      ],
      "waves": [
        { "amplitude": 0.18, "cycles": { "u": 1.5, "v": 1.2 }, "phase": 0 },
        { "amplitude": 0.09, "cycles": { "u": 4.5, "v": 3.5 }, "phase": 0.4 }
      ],
      "samples": { "u": 22, "v": 14 },
      "style": { "stroke": "#5a8ab8", "width": 0.6 }
    }
  ]
}
```

The water quad sits at z=-0.3 (slightly below ground level so the
island reads as raised above the surface), spans wider than the island
to fill the frame, and uses the two-component wave recipe above.

## Provenance and influences

The wave decomposition (swell + capillary) is a standard
oceanographic simplification — real water has many components, but two
is enough to read as "calm." The stroke color matches the cool-blue
convention art tradition uses for mid-distance water (less saturated
than foreground water, less light than open sky). Pairs naturally
with `clear-sky-gradient` overhead for full atmospheric staging.

## Stays bespoke when

- The water has **strong directional waves** (uniform swell rolling
  toward shore). Wave-field uses isotropic (u,v) cycles; directional
  waves need a custom plane override or explicit per-component cycles
  authored inline.
- **Whitecaps and breaking surf** at the water surface. Wave-field's
  amplitude tops out as gentle undulation; for breaking waves the
  renderer's stochastic terminal vocabulary (`wash`, `stipple`) is
  the right layer.
- The water is **vertical** (waterfall) rather than horizontal. The
  displacement direction defaults to gravity-perpendicular for a
  horizontal field; vertical water needs an explicit displacement
  override and a different orientation.
