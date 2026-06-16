---
{
  "id": "storm-cloud-bank",
  "label": "Storm cloud bank",
  "family": "atmosphere-cloud",
  "aliases": ["storm clouds", "cloud bank", "dark clouds", "weather front", "thunderclouds", "overcast band"],
  "intents": ["atmosphere", "cloud", "storm", "sky", "weather", "dramatic-backdrop"],
  "topology": {
    "primitive": "wave-field",
    "shape": "vertical-quad",
    "energy": "medium",
    "placement": "sky-far-plane"
  },
  "reasoningUse": [
    "a dark turbulent sky band for weather, storm, or dramatic exterior scenes",
    "use behind architecture, water, or terrain when clear-sky-gradient is too calm",
    "the atmospheric sibling to clear-sky-gradient, with visible cloud mass rhythm"
  ],
  "boundaryContract": {
    "corners": ["NW", "NE", "SE", "SW"],
    "convention": "Container preset — the cloud bank reads self/slot/NW|NE|SE|SW on a sky/backdrop host."
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
          { "amplitude": 0.12, "cycles": { "u": 1.4, "v": 0.6 }, "phase": 0.1 },
          { "amplitude": 0.06, "cycles": { "u": 4.0, "v": 1.4 }, "phase": 0.8 }
        ],
        "samples": { "u": 18, "v": 8 },
        "style": { "stroke": "#58606a", "width": 0.75, "opacity": 0.72 }
      }
    ]
  }
}
---

# Storm cloud bank

A dark, active sky surface for atmospheric weather. It uses the same
callable wave-field grammar as `clear-sky-gradient`, but the stroke and
two wave components carry cloud mass instead of clear air.

## Use when

- **Exterior architecture** needs weather pressure behind it.
- **Water scenes** need a storm front or unsettled horizon.
- **Objects** should feel staged under heavier light before figure work.

## Slot contract

Four host slots: `NW`, `NE`, `SE`, `SW`.

## Stays bespoke when

- The clouds need individual cumulus outlines or lightning.
- The scene needs nighttime stars rather than overcast weather.
