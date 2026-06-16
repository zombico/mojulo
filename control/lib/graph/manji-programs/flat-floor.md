---
{
  "id": "flat-floor",
  "label": "Flat floor (stone or concrete)",
  "family": "surface-stone",
  "aliases": ["stone floor", "concrete floor", "plaza pavement", "flat ground", "interior floor", "flat paved surface"],
  "intents": ["surface", "interior-ground", "depth-staging", "compositional-base"],
  "topology": {
    "primitive": "wave-field",
    "shape": "horizontal-quad",
    "energy": "none"
  },
  "reasoningUse": [
    "a still, level paved surface for interior or plaza scenes",
    "the default ground plane when the scene has no water, grass, or terrain",
    "use beneath cathedral, hall, courtyard, or street compositions for grounding"
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
        "waves": [],
        "samples": { "u": 14, "v": 8 },
        "style": { "stroke": "#665b4d", "width": 0.5 }
      }
    ]
  }
}
---

# Flat floor (stone or concrete)

A completely flat horizontal surface sampled as a wireframe grid. No
wave displacement — the field reads as crisp orthogonal floor lines
receding into the perspective camera. The "still ground" baseline that
any interior or plaza scene can sit on.

## Use when

Reach for this card when the scene needs a level ground plane and there
is no water, grass, terrain, or rough surface that would justify
displacement. Specific intents:

- **Interior floors** for cathedrals, halls, civic interiors, throne rooms.
  Pairs naturally with the `cathedral-nave-deep-perspective` shelf card
  by sitting under its central-nave / left-aisle / right-aisle slots.
- **Plaza or courtyard pavement** for outdoor architectural scenes
  where the eye should read "this place is grounded, walkable, civic"
  rather than "rough nature."
- **Streetscape baseline** for `multi-story-facade` or town-street
  compositions where buildings rise from a flat road plane.

When the same scene also wants tiling visible, prefer `tile-grid-floor`
(higher grid density). When the same scene wants natural rough
terrain, prefer `rolling-hills`.

## Composition example

Drop a flat floor beneath the cathedral by connecting its four-corner
boundary anchors to a wave-field declaration:

```json
{
  "tree": {
    "id": "cathedral",
    "programRef": "cathedral-nave-deep-perspective",
    "children": [
      { "slot": "left-aisle", "node": { "id": "fl-NW", ... } },
      { "slot": "right-aisle", "node": { "id": "fl-NE", ... } },
      { "slot": "apse", "node": { "id": "fl-back", ... } }
    ]
  },
  "waveFields": [
    {
      "corners": [
        "cathedral/slot/left-aisle",
        "cathedral/slot/right-aisle",
        "cathedral/slot/apse",
        "cathedral/slot/foreground-steps"
      ],
      "waves": [],
      "samples": { "u": 14, "v": 8 },
      "style": { "stroke": "#665b4d", "width": 0.5 }
    }
  ]
}
```

The four cathedral slots that define the floor quad receive the
wave-field; the rest of the scene paints on top. The floor reads as a
receding orthogonal grid because samples=14×8 with no waves gives
straight crest polylines.

## Provenance and influences

Renaissance perspective conventions — a one-point or two-point camera
looking across a tiled or paved interior. The bare gridlines mimic the
construction-lines underlay artists use before painting in surface
material. For more textural fills (cobblestone, marble veining,
parquet), the renderer's terminal-mark vocabulary is the natural next
layer (`brick-fill`, `hatch`, `stipple`) — wave-field handles the
geometric foundation.

## Stays bespoke when

- The floor is **non-rectangular** (circular plaza, irregular plan).
  The 4-corner quad assumes a quadrilateral footprint.
- The floor needs **explicit tile spacing** (alternating colors per
  cell). Use `tile-grid-floor` for visible tile density; for color
  alternation, terminal-mark realization is the right layer.
- The scene has **water that's mostly flat** but should still read as
  water (reflective sheen, etc.). Use `calm-water` with very low
  amplitude instead — its blue stroke does retrieval work the stone
  grey can't.
