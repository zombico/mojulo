---
{
  "id": "surface-skin-stone-grain",
  "label": "Surface skin: stone grain",
  "family": "surface-skin",
  "aliases": ["stone grain", "floor grain", "weathered stone", "masonry skin", "worn stone surface"],
  "intents": ["surface-skin", "stone", "floor", "grain", "weathering", "layered-wave-field"],
  "topology": {
    "primitive": "wave-field",
    "shape": "horizontal-quad",
    "layers": 2,
    "placement": "surface-overlay"
  },
  "reasoningUse": [
    "a muted stone-grain skin for floors, plinths, courtyards, or object bases",
    "use when a flat or tiled plane needs age and surface life but not full material rendering",
    "pairs well with object-shadow-pool and architecture cards"
  ],
  "boundaryContract": {
    "corners": ["NW", "NE", "SE", "SW"],
    "convention": "Container preset — both skin layers read self/slot/NW|NE|SE|SW on the enclosing surface host."
  },
  "manjiProgram": {
    "children": [
      {
        "kind": "wave-field",
        "corners": ["self/slot/NW", "self/slot/NE", "self/slot/SE", "self/slot/SW"],
        "waves": [
          { "amplitude": 0.025, "cycles": { "u": 2.0, "v": 0.5 }, "phase": 0.6 },
          { "amplitude": 0.018, "cycles": { "u": 4.2, "v": 1.4 }, "phase": 1.7 }
        ],
        "samples": { "u": 18, "v": 10 },
        "style": { "role": "base", "flavor": "stone", "width": 0.5, "opacity": 0.44 }
      },
      {
        "kind": "wave-field",
        "corners": ["self/slot/NW", "self/slot/NE", "self/slot/SE", "self/slot/SW"],
        "waves": [
          { "amplitude": 0.012, "cycles": { "u": 7.0, "v": 2.0 }, "phase": 2.6 }
        ],
        "samples": { "u": 24, "v": 7 },
        "style": { "role": "shadow", "flavor": "stone", "width": 0.35, "opacity": 0.36, "dasharray": "3 4" }
      }
    ]
  }
}
---

# Surface skin: stone grain

A restrained stone or worn-floor treatment. It is meant to sit on a
horizontal host plane beneath architecture and objects, where it reads as
surface age instead of as a separate object.
