---
{
  "id": "moonlit-water",
  "label": "Moonlit water",
  "family": "surface-water",
  "aliases": ["night water", "moonlit lake", "silver water", "dark bay", "nocturne water", "reflective water"],
  "intents": ["surface", "water", "night", "moonlight", "atmospheric-context", "reflection"],
  "topology": {
    "primitive": "wave-field",
    "shape": "horizontal-quad",
    "energy": "low",
    "palette": "dark-blue-silver"
  },
  "reasoningUse": [
    "a dark blue low-energy water surface with silver stroke for nocturne scenes",
    "use around cloisters, lakes, islands, or object studies when calm-water is too daylit",
    "the atmospheric water sibling to calm-water"
  ],
  "boundaryContract": {
    "corners": ["NW", "NE", "SE", "SW"],
    "convention": "Container preset — the water reads self/slot/NW|NE|SE|SW on the enclosing host."
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
          { "amplitude": 0.12, "cycles": { "u": 1.2, "v": 0.8 }, "phase": 0.3 },
          { "amplitude": 0.04, "cycles": { "u": 5.0, "v": 2.0 }, "phase": 1.4 }
        ],
        "samples": { "u": 24, "v": 14 },
        "style": { "stroke": "#8ca6bd", "width": 0.6, "opacity": 0.74 }
      }
    ]
  }
}
---

# Moonlit water

A calm nocturne water card: darker and quieter than `calm-water`, with
a cool silver-blue stroke. It is meant for atmospheric staging around
objects and architecture before the figure layer is introduced.

## Use when

- **Night courtyards or cloisters** have a reflecting pool.
- **Object studies** need a dark water base or moonlit altar basin.
- **Landscape scenes** should read as a nocturne rather than daylit bay.

## Slot contract

Four host slots: `NW`, `NE`, `SE`, `SW`.

## Stays bespoke when

- The water needs actual reflected object silhouettes.
- The scene has rough surf or storm water; use `choppy-sea` instead.
