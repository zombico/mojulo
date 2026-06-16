---
{
  "id": "surface-skin-water-shimmer",
  "label": "Surface skin: water shimmer",
  "family": "surface-skin",
  "aliases": ["water shimmer", "rippling skin", "silver water skin", "water highlight layer", "reflective ripples"],
  "intents": ["surface-skin", "water", "shimmer", "reflection", "layered-wave-field"],
  "topology": {
    "primitive": "wave-field",
    "shape": "horizontal-quad",
    "layers": 3,
    "placement": "surface-overlay"
  },
  "reasoningUse": [
    "a layered water skin for adding shimmer over a structural surface plane",
    "use when calm or moonlit water needs visible highlights without changing the host geometry",
    "keeps the same four-corner contract as the base surface cards"
  ],
  "boundaryContract": {
    "corners": ["NW", "NE", "SE", "SW"],
    "convention": "Container preset — all skin layers read self/slot/NW|NE|SE|SW on the enclosing surface host."
  },
  "manjiProgram": {
    "children": [
      {
        "kind": "wave-field",
        "corners": ["self/slot/NW", "self/slot/NE", "self/slot/SE", "self/slot/SW"],
        "waves": [
          { "amplitude": 0.08, "cycles": { "u": 1.2, "v": 0.7 }, "phase": 0.1 }
        ],
        "samples": { "u": 20, "v": 10 },
        "style": { "role": "base", "flavor": "water", "width": 0.45, "opacity": 0.42 }
      },
      {
        "kind": "wave-field",
        "corners": ["self/slot/NW", "self/slot/NE", "self/slot/SE", "self/slot/SW"],
        "waves": [
          { "amplitude": 0.035, "cycles": { "u": 6.0, "v": 1.6 }, "phase": 1.4 }
        ],
        "samples": { "u": 28, "v": 8 },
        "style": { "role": "mid", "flavor": "water", "width": 0.35, "opacity": 0.62, "dasharray": "2 5" }
      },
      {
        "kind": "wave-field",
        "corners": ["self/slot/NW", "self/slot/NE", "self/slot/SE", "self/slot/SW"],
        "waves": [
          { "amplitude": 0.018, "cycles": { "u": 10.0, "v": 2.2 }, "phase": 2.2 }
        ],
        "samples": { "u": 30, "v": 6 },
        "style": { "role": "highlight", "flavor": "water", "width": 0.28, "opacity": 0.5, "dasharray": "1 7" }
      }
    ]
  }
}
---

# Surface skin: water shimmer

Layered water treatment for a four-corner host plane. It adds a darker
structural ripple layer plus two broken highlight layers, giving water a
surface read without asking the host to become a different object.
