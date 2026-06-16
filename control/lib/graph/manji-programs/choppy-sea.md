---
{
  "id": "choppy-sea",
  "label": "Choppy sea",
  "family": "surface-water",
  "aliases": ["rough sea", "stormy ocean", "high seas", "ocean swell", "wavy water", "open ocean"],
  "intents": ["surface", "water", "atmospheric-context", "dramatic-energy"],
  "topology": {
    "primitive": "wave-field",
    "shape": "horizontal-quad",
    "energy": "high"
  },
  "reasoningUse": [
    "high-energy water for stormy, open-ocean, or maritime drama scenes",
    "fills around ships, lighthouses, cliffs, exposed coasts",
    "use when the water itself is part of the emotional load; for calm bays use 'calm-water'"
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
          { "amplitude": 0.55, "cycles": { "u": 1.2, "v": 0.9 }, "phase": 0 },
          { "amplitude": 0.28, "cycles": { "u": 3.5, "v": 2.8 }, "phase": 0.7 },
          { "amplitude": 0.12, "cycles": { "u": 8.5, "v": 6.5 }, "phase": 1.3 }
        ],
        "samples": { "u": 26, "v": 16 },
        "style": { "stroke": "#3d6a92", "width": 0.7 }
      }
    ]
  }
}
---

# Choppy sea

A high-energy water surface — three superposed wave components (large
swell + medium chop + finer capillary) produce a recognizable rough-water
field. Deeper blue stroke (`#3d6a92`) and higher samples than calm-water
read as more dramatic, more present water. The "the ocean is the subject"
case.

## Use when

Reach for choppy-sea when the water carries part of the scene's emotional
load. Specific intents:

- **Maritime drama** — ship at sea, lighthouse on a storm-lashed coast,
  fishing fleet in open water. The wave energy gives the composition
  motion even though every pixel is static.
- **Exposed open coast** — cliffs above a rough Atlantic, breakwaters,
  jetties extending into deep water.
- **Storm or pre-storm atmosphere** — the rough water signals weather
  the way `clear-sky-gradient` would NOT.
- **Scale and isolation** — a small boat against a big-amplitude wave
  field reads as a vulnerable subject in a powerful environment.

When the water should feel calm, harborside, or contemplative, prefer
`calm-water`. When the scene is interior or has no water context, use
`flat-floor` (interior) or `rolling-hills` (terrain).

## Composition example

Apply beneath a lighthouse-on-cliff scene by anchoring the four corners
beyond the cliff's footprint:

```json
{
  "tree": {
    "id": "coast",
    "spine": { ... },
    "anchor": { "x": 0, "y": -10, "z": 0 },
    "slots": [
      { "id": "lighthouse-pos", "position": { "x": 0, "y": -12, "z": 0 } },
      { "id": "open-water-NW", "position": { "x": -18, "y": -22, "z": -0.5 } },
      { "id": "open-water-NE", "position": { "x":  18, "y": -22, "z": -0.5 } },
      { "id": "open-water-SE", "position": { "x":  18, "y":   6, "z": -0.5 } },
      { "id": "open-water-SW", "position": { "x": -18, "y":   6, "z": -0.5 } }
    ],
    "children": [
      { "slot": "lighthouse-pos", "node": { "id": "lighthouse", ... } }
    ]
  },
  "waveFields": [
    {
      "corners": [
        "coast/slot/open-water-NW",
        "coast/slot/open-water-NE",
        "coast/slot/open-water-SE",
        "coast/slot/open-water-SW"
      ],
      "waves": [
        { "amplitude": 0.55, "cycles": { "u": 1.2, "v": 0.9 }, "phase": 0 },
        { "amplitude": 0.28, "cycles": { "u": 3.5, "v": 2.8 }, "phase": 0.7 },
        { "amplitude": 0.12, "cycles": { "u": 8.5, "v": 6.5 }, "phase": 1.3 }
      ],
      "samples": { "u": 26, "v": 16 },
      "style": { "stroke": "#3d6a92", "width": 0.7 }
    }
  ]
}
```

The three-component wave sum produces visible peaks, troughs, and
finer chop riding on top — the eye reads "rough water" because the
amplitude is high enough that the displacement is plainly visible at
camera distance.

## Provenance and influences

The 19th-century English marine painting tradition — Turner, the
Volunteer Marine paintings, Winslow Homer's Atlantic seascapes — uses
the same compositional pattern: a small figural element against a
large, energetic water field that carries the drama. The wave-field
primitive can't reproduce Turner's atmospheric color work but it can
provide the geometric scaffolding the color would sit on.

## Stays bespoke when

- **Individual breaking waves** with visible foam crests. Wave-field
  smoothly displaces the surface; sharp breakers / whitecaps need a
  different primitive (probably stochastic terminals at the wave peaks).
- **Translucent water showing depth** — submerged rocks, fish, sea
  floor visible through the surface. Out of scope for any current
  primitive.
- **Wakes and turbulence** behind a moving ship. Wave-field is
  scene-global; localized turbulence patches around a boat need
  per-object surfaces or inline authored fields.
- The water should read as **calm or gentle**. Use `calm-water` — the
  three-component sum here is deliberately loud.
