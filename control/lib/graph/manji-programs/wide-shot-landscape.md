---
{
  "id": "wide-shot-landscape",
  "label": "Wide-shot landscape",
  "family": "camera-shot",
  "aliases": ["wide shot", "wide angle shot", "establishing wide", "establishing shot", "far framing", "long shot", "open landscape shot", "scenery shot"],
  "intents": ["establishing", "depth-staging", "environmental-context"],
  "topology": {
    "cameraVector": "wide-low-foreground",
    "staging": "foreground-midground-background",
    "reach": "far-horizon"
  },
  "reasoningUse": [
    "open the scene by showing the full environment before zooming in",
    "place a subject against a deep horizon for scale and orientation",
    "establish geography or terrain that subsequent shots will sit inside",
    "give the viewer a sense of distance and scope — the 'where' before the 'what'"
  ],
  "boundaryContract": {
    "slots": ["horizon-anchor", "sky-anchor", "foreground", "midground", "background", "left-frame", "right-frame"],
    "collisionGroups": ["ground-plane", "horizon-band", "frame-edges"],
    "depthBands": ["foreground", "midground", "background"]
  },
  "manjiProgram": {
    "spine": {
      "bar1": { "axis": "N-S", "tails": { "N": "open", "S": "open" }, "lengthScale": 0.4 },
      "bar2": { "axis": "E-W", "tails": { "W": "closed", "E": "closed" }, "lengthScale": 0.3 },
      "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.3 }
    },
    "slots": [
      { "id": "horizon-anchor", "position": { "x":   0, "y": -28, "z":  0   } },
      { "id": "sky-anchor",     "position": { "x":   0, "y": -28, "z":  5   } },
      { "id": "foreground",     "position": { "x":   0, "y":   5, "z":  0   } },
      { "id": "midground",      "position": { "x":   0, "y": -10, "z":  0   } },
      { "id": "background",     "position": { "x":   0, "y": -22, "z":  0   } },
      { "id": "left-frame",     "position": { "x": -16, "y": -10, "z":  0   } },
      { "id": "right-frame",    "position": { "x":  16, "y": -10, "z":  0   } }
    ]
  }
}
---

# Wide-shot landscape

The default scope — the **establishing shot**. A deep ground plane runs
from a near-camera foreground to a far horizon, with framing edges left
and right and an empty sky above. This is the camera's first move when
a scene needs to communicate *where* it is before it commits to *what*
or *who*. The slots are arranged so a subject can be dropped at any
depth band (foreground for intimacy, midground for staging, background
for distance) without re-authoring the camera.

## Use when

Reach for `wide-shot-landscape` when the illustration's first job is
context, not character. Specific intents:

- **Opening / establishing** — the first frame of a sequence, where the
  viewer needs to orient before figures arrive. Drop a small subject at
  `midground` and let the deep horizon do the emotional work.
- **Scale-against-environment** — a figure or object that should feel
  small against geography. Drop the subject at `foreground` and let the
  empty `background` and `horizon-anchor` carry the contrast.
- **Geography as subject** — when the terrain itself (mountains, plains,
  coast) is the point. Use the depth bands to stage near-mid-far hills,
  with subjects optional.
- **Orientation for a sequence** — a wide shot that the next shots will
  cut INTO. The `left-frame` / `right-frame` slots can hold off-screen
  cue objects (a sign, a tree, a road) that subsequent close-ups reuse.

When the focus is a single figure with no environmental load,
[[medium-shot-figure]] frames tighter. When the emotion lives in
expression, [[close-up-face]] is the right move. When a pair of figures
are talking, [[over-the-shoulder-two-figure]] gets the relationship.

## Slot semantics

- **horizon-anchor** — the deepest point on the ground plane, where land
  meets sky. Place a distant landmark (mountain, far building, lone
  tree) here for a focal terminus. Most-receded slot; subjects placed
  here will read as tiny.
- **sky-anchor** — the matching deep point above the horizon (z=5).
  Used for a sun, moon, distant cloud, or weather mark. Leaving it
  empty reads as clear sky.
- **foreground** — the near-camera ground (y=5, in front of origin). Use
  for a near subject, large rock, water edge, or a figure intended to
  feel close. Anything placed here dominates the scale.
- **midground** — the working subject band (y=-10). Default home for the
  scene's main subject. Tall objects here read as roughly waist-high in
  the projected frame.
- **background** — the receded subject band (y=-22). For a subject that
  should read as "out there" but not at the horizon — a building, a
  village, a herd of animals.
- **left-frame**, **right-frame** — wide flanks at midground depth (±16
  on x). Use for off-axis framing elements (a tree edge, a cliff face,
  a building corner) that bracket the central depth recession.

## Composition example

### Lone figure against deep horizon

```json
{
  "programRef": "wide-shot-landscape",
  "children": [
    { "slot": "midground", "node": { "programRef": "standing-figure-canonical" } },
    { "slot": "horizon-anchor", "node": { "inlineProgram": {
        "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.5 },
        "bar2": { "axis": "E-W", "tails": { "W": "closed", "E": "closed" }, "lengthScale": 0.5 },
        "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "open", "Nadir": "closed" }, "lengthScale": 1.5 }
    } } }
  ]
}
```

A figure at midground reads against a tall mark at the horizon — the
classic "small subject against vast land" composition. The figure's
canonical height makes the horizon mark read as distant-and-tall (a
mountain, a tower) by contrast.

### Three-depth recession with bracketing trees

```json
{
  "programRef": "wide-shot-landscape",
  "children": [
    { "slot": "foreground",   "node": { "programRef": "standing-figure-canonical" } },
    { "slot": "midground",    "node": { "programRef": "standing-figure-canonical" } },
    { "slot": "background",   "node": { "programRef": "standing-figure-canonical" } },
    { "slot": "left-frame",   "node": { "programRef": "standing-figure-canonical" } },
    { "slot": "right-frame",  "node": { "programRef": "standing-figure-canonical" } }
  ]
}
```

Five figures, each at a different depth or frame edge. Reads as a
populated landscape with no single focal point — useful when the
*scene* matters more than any one subject.

## Provenance and influences

The geometry is canonical landscape painting / cinematography vocabulary
— a deep ground plane with horizon-and-sky termini, foreground-midground-
background bands borrowed from the European landscape tradition (Claude
Lorrain, Friedrich, the Hudson River School), then domesticated into
cinema's "establishing shot" convention.

The composition rewards leaving slots **empty**. A wide shot with one
subject at midground and nothing else is the standard cinematic open;
filling every slot reads more as a Bruegel-ish populated landscape, which
is a different intent.

## Stays bespoke when

- The camera is at a non-default height — a low-camera wide ("worm's
  eye landscape") or a high-camera wide ("aerial"). The slot z-values
  here assume an eye-level camera; non-eye-level views need their own
  card.
- The horizon is **not flat** (a tilted landscape, a curved coast, an
  alien planet's curve). The card hard-codes a flat horizon-band; tilts
  need bespoke geometry.
- The "wide" is really **interior wide** (a large hall seen from one
  end). The depth bands here assume open ground; for interiors use
  [[cathedral-nave-deep-perspective]] or a sibling architectural card.
- The scene's emotional load is **vertical** (deep canyon, towering
  mountain) rather than horizontal. The wide-shot's framing is
  landscape-oriented; vertical compositions want a portrait-frame card.
