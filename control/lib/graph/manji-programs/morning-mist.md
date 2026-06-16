---
{
  "id": "morning-mist",
  "label": "Morning mist band",
  "family": "atmosphere-haze",
  "aliases": ["mist", "morning fog", "low haze", "soft fog", "atmospheric veil", "pale mist"],
  "intents": ["atmosphere", "mist", "haze", "depth-staging", "softness"],
  "topology": {
    "primitive": "wave-field",
    "shape": "vertical-quad",
    "energy": "low",
    "placement": "mid-to-far-plane"
  },
  "reasoningUse": [
    "a pale low-opacity mist band that softens architecture, water, or terrain",
    "use when the scene needs atmospheric perspective before adding figures or detailed material",
    "pairs with cloisters, lakes, gardens, and morning landscapes"
  ],
  "boundaryContract": {
    "corners": ["NW", "NE", "SE", "SW"],
    "convention": "Container preset — the mist wave-field reads self/slot/NW|NE|SE|SW on the enclosing scene or host plane."
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
          { "amplitude": 0.03, "cycles": { "u": 1.0, "v": 0.4 }, "phase": 0.2 },
          { "amplitude": 0.015, "cycles": { "u": 3.0, "v": 1.2 }, "phase": 1.1 }
        ],
        "samples": { "u": 16, "v": 8 },
        "style": { "stroke": "#b9c2bc", "width": 0.55, "opacity": 0.46 }
      }
    ]
  }
}
---

# Morning mist band

A soft low-opacity wave-field for atmospheric veil. It is not a cloud
object and not a floor; it is a vertical or shallow-slanted quad that
the host places between the viewer and the far scene. The two small
wave components break the grid into a drifting read without making the
mist become the subject.

## Use when

- **Cloisters and gardens** need morning air before any figure or skin
  detail is introduced.
- **Water or terrain** should feel cool, quiet, and partially veiled.
- **Architecture** needs depth softened without changing its scaffold.

## Slot contract

Four host slots: `NW`, `NE`, `SE`, `SW`. Use `pathBindings` when the
host has names such as `mist-NW` or `haze-SW`.

## Stays bespoke when

- The mist needs discrete cloud puffs or billows. Use wave-manji cloud
  or a future cloud-bank card.
- The haze must fade by depth continuously. This card is a visible band;
  true depth fade needs a renderer-side atmospheric perspective pass.
