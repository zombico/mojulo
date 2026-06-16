---
{
  "id": "surface-skin-atmospheric-veil",
  "label": "Surface skin: atmospheric veil",
  "family": "surface-skin",
  "aliases": ["atmospheric veil", "soft haze skin", "fog skin", "mist skin", "distance veil"],
  "intents": ["surface-skin", "mist", "haze", "softness", "depth-staging", "layered-wave-field"],
  "topology": {
    "primitive": "wave-field",
    "shape": "vertical-or-tilted-quad",
    "layers": 2,
    "placement": "air-overlay"
  },
  "reasoningUse": [
    "a soft veil skin for tilted or vertical atmosphere planes",
    "use when a mist or cloud plane needs a finer skin without adding discrete cloud objects",
    "keeps atmosphere as surface treatment before any figure material pass"
  ],
  "boundaryContract": {
    "corners": ["NW", "NE", "SE", "SW"],
    "convention": "Container preset — both veil layers read self/slot/NW|NE|SE|SW on the enclosing atmosphere host."
  },
  "manjiProgram": {
    "children": [
      {
        "kind": "wave-field",
        "corners": ["self/slot/NW", "self/slot/NE", "self/slot/SE", "self/slot/SW"],
        "waves": [
          { "amplitude": 0.04, "cycles": { "u": 1.5, "v": 0.4 }, "phase": 0.9 }
        ],
        "samples": { "u": 18, "v": 8 },
        "style": { "role": "mid", "flavor": "atmosphere", "width": 0.42, "opacity": 0.34 }
      },
      {
        "kind": "wave-field",
        "corners": ["self/slot/NW", "self/slot/NE", "self/slot/SE", "self/slot/SW"],
        "waves": [
          { "amplitude": 0.018, "cycles": { "u": 4.0, "v": 1.0 }, "phase": 2.0 }
        ],
        "samples": { "u": 22, "v": 6 },
        "style": { "role": "highlight", "flavor": "atmosphere", "width": 0.3, "opacity": 0.42, "dasharray": "4 6" }
      }
    ]
  }
}
---

# Surface skin: atmospheric veil

A finer veil treatment for air planes. It layers soft haze and broken
light bands on an existing tilted or vertical host plane.
