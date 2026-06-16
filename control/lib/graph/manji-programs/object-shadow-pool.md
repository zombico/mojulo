---
{
  "id": "object-shadow-pool",
  "label": "Object shadow pool",
  "family": "surface-shadow",
  "aliases": ["contact shadow", "grounding shadow", "object shadow", "altar shadow", "soft shadow pool"],
  "intents": ["surface", "shadow", "object-grounding", "atmospheric-context", "contact"],
  "topology": {
    "primitive": "wave-field",
    "shape": "horizontal-quad",
    "energy": "low",
    "placement": "object-base"
  },
  "reasoningUse": [
    "a low wavering contact shadow for grounding objects in atmospheric scenes",
    "use under chalices, vessels, small altar objects, and architectural ornaments",
    "works as a surface stage before object skinning or material detail"
  ],
  "boundaryContract": {
    "corners": ["NW", "NE", "SE", "SW"],
    "convention": "Container preset — the shadow reads self/slot/NW|NE|SE|SW on the enclosing object-base host."
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
          { "amplitude": 0.04, "cycles": { "u": 1.2, "v": 0.4 }, "phase": 0.35 },
          { "amplitude": 0.025, "cycles": { "u": 2.8, "v": 1.1 }, "phase": 1.1 }
        ],
        "samples": { "u": 18, "v": 8 },
        "style": { "stroke": "#3d3632", "width": 0.55, "opacity": 0.38 }
      }
    ]
  }
}
---

# Object Shadow Pool

An object-grounding wave surface: thin, uneven contact lines that sit beneath an
artifact or architectural detail without becoming a literal cast shadow.
