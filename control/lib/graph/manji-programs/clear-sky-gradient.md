---
{
  "id": "clear-sky-gradient",
  "label": "Clear sky gradient",
  "family": "backdrop-sky",
  "aliases": ["clear sky", "blue sky", "open sky", "daytime sky", "sky backdrop", "atmospheric backdrop"],
  "intents": ["backdrop", "sky", "atmospheric-context", "depth-staging"],
  "topology": {
    "primitive": "wave-field",
    "shape": "vertical-quad",
    "energy": "none",
    "placement": "far-plane"
  },
  "reasoningUse": [
    "a flat clear-sky backdrop behind the scene's main subject",
    "the far-plane equivalent of flat-floor — no displacement, but in the sky position",
    "use behind landscape, coast, urban, and architectural exterior scenes"
  ],
  "boundaryContract": {
    "corners": ["NW", "NE", "SE", "SW"],
    "displacement": "none",
    "orientation": "vertical-far-plane"
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
        "samples": { "u": 12, "v": 6 },
        "style": { "stroke": "#8ba8c8", "width": 0.5 }
      }
    ]
  }
}
---

# Clear sky gradient

A flat far-plane surface oriented vertically behind the scene. No waves
— just a low-density grid that reads as the sky backdrop against which
foreground subjects compose. Cool blue stroke (`#8ba8c8`) signals
atmosphere across discovery and render.

## Use when

Reach for clear-sky-gradient whenever the scene needs a sky behind it
and that sky should be calm / clear / daylit. Specific intents:

- **Exterior architecture** — cathedrals, palaces, urban facades from
  outdoors. The sky reads as "this place is outdoors during the day"
  the way no other surface card can.
- **Landscape staging** — `wide-shot-landscape` or
  `rolling-hills`-grounded scenes get atmospheric closure when a sky
  quad sits at the back plane.
- **Coastal compositions** — paired with `calm-water` or `choppy-sea`
  to fully stage maritime scenes (sky above, water below).
- **Helicopter / aerial framings** — the helicopter-island scene reads
  more confidently as aerial with a sky band at the far plane.

When the scene is interior, no sky card is needed (the cathedral's
vault carries that role). For cloudy / stormy / nighttime atmospheres,
future `cloudy-band`, `sunset-gradient`, `night-sky-stars` cards would
ship as siblings.

## Composition example

Apply behind a coastal scene by placing the sky-quad anchors at the far
plane (high z, deep y):

```json
{
  "tree": {
    "id": "coast-scene",
    "spine": { ... },
    "slots": [
      { "id": "sky-NW", "position": { "x": -25, "y": -28, "z": 12 } },
      { "id": "sky-NE", "position": { "x":  25, "y": -28, "z": 12 } },
      { "id": "sky-SE", "position": { "x":  25, "y": -28, "z":  4 } },
      { "id": "sky-SW", "position": { "x": -25, "y": -28, "z":  4 } },
      ...
    ]
  },
  "waveFields": [
    {
      "corners": [
        "coast-scene/slot/sky-SW",
        "coast-scene/slot/sky-SE",
        "coast-scene/slot/sky-NE",
        "coast-scene/slot/sky-NW"
      ],
      "waves": [],
      "samples": { "u": 12, "v": 6 },
      "style": { "stroke": "#8ba8c8", "width": 0.5 }
    },
    {
      "corners": [ ... water corners ... ],
      "waves": [ ... calm-water recipe ... ]
    }
  ]
}
```

The sky quad sits at deep y (-28) across a vertical z range (4 to 12),
so it reads as a wall of sky at the back of the scene. Paired with
calm-water lower in the scene, the composition stages full atmospheric
context.

## Provenance and influences

The convention of a far-plane sky behind landscape compositions is
near-universal — Dutch landscape paintings, Romantic seascapes,
Renaissance altarpiece backgrounds. The flat blue stroke is the same
convention painters use for mid-distance unclouded sky (less saturated
than direct overhead, less rendered than active cloud passages).

## Stays bespoke when

- The sky has **active cloud forms** — cumulus, cirrus, storm fronts.
  Wave-field's zero-wave default is featureless; cloud rendering needs
  either inline cloud shapes (manji-trees with `wisp` terminals when
  realized) or future cloud-band cards.
- The sky should read as **night** or **dusk** — different stroke color
  needed. Future `night-sky-stars`, `sunset-gradient` cards would carry
  the right palette and (for stars) added marks.
- The composition is **interior** — no sky card needed; use the
  interior architecture's ceiling slot.
- The scene needs **atmospheric perspective** (haze, distance fade).
  Wave-field doesn't gradient by depth; for atmospheric haze the
  renderer's terminal-mark vocabulary (`wash`) is the right layer when
  realized.
