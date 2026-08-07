---
{
  "id": "reclining-figure-classical",
  "label": "Reclining figure (classical, weight on elbow)",
  "family": "figure-posture",
  "aliases": ["reclining figure", "lying figure", "reposed figure", "odalisque", "classical recline", "sleeping figure", "recumbent figure", "triclinium pose"],
  "intents": ["figure", "posture", "reclining", "lying", "horizontal", "repose", "classical-recline", "odalisque", "triclinium"],
  "topology": {
    "primitive": "three-lathe-with-volumized-limbs",
    "masses": ["head", "torso", "pelvis"],
    "limbs": 11,
    "landmarks": 23
  },
  "reasoningUse": [
    "a figure lying horizontally on its left side, head propped on the left elbow, right arm draped over the hip, legs slightly bent and stacked",
    "the classical reclining pose — odalisque, sleeping Ariadne, Roman triclinium diner, river-god personification, hellenistic mythological recline",
    "the substrate's first horizontal-figure card; landmark layout runs the body axis along -Y → +Y instead of +Z → 0 as in standing postures"
  ],
  "boundaryContract": {
    "slots": [
      "head-crown", "head-base", "neck-base", "torso-top", "torso-base", "pelvis-top", "pelvis-floor",
      "shoulder-l", "shoulder-r", "elbow-l", "elbow-r", "wrist-l", "wrist-r",
      "hip-l", "hip-r", "knee-l", "knee-r", "ankle-l", "ankle-r", "heel-l", "heel-r", "toe-l", "toe-r"
    ],
    "convention": "Z up, Y forward, -X = figure's left. The figure lies on its LEFT side along the Y axis — head at -Y (propped up by left elbow), feet at +Y. Left-side landmarks sit at low Z (on the ground); right-side landmarks at higher Z (figure's right side faces up)."
  },
  "manjiProgram": {
    "spine": {
      "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.3 }
    },
    "slots": [
      { "id": "head-crown",   "position": { "x":  0.00, "y": -0.50, "z": 0.28 } },
      { "id": "head-base",    "position": { "x":  0.00, "y": -0.40, "z": 0.22 } },
      { "id": "neck-base",    "position": { "x":  0.00, "y": -0.35, "z": 0.18 } },
      { "id": "torso-top",    "position": { "x":  0.00, "y": -0.28, "z": 0.14 } },
      { "id": "torso-base",   "position": { "x":  0.00, "y": -0.04, "z": 0.10 } },
      { "id": "pelvis-top",   "position": { "x":  0.00, "y": -0.04, "z": 0.10 } },
      { "id": "pelvis-floor", "position": { "x":  0.00, "y":  0.10, "z": 0.10 } },
      { "id": "shoulder-l",   "position": { "x": -0.04, "y": -0.28, "z": 0.04 } },
      { "id": "shoulder-r",   "position": { "x":  0.04, "y": -0.28, "z": 0.22 } },
      { "id": "elbow-l",      "position": { "x": -0.04, "y": -0.42, "z": 0.04 } },
      { "id": "elbow-r",      "position": { "x":  0.06, "y": -0.10, "z": 0.18 } },
      { "id": "wrist-l",      "position": { "x": -0.08, "y": -0.45, "z": 0.22 } },
      { "id": "wrist-r",      "position": { "x":  0.10, "y":  0.06, "z": 0.12 } },
      { "id": "hip-l",        "position": { "x": -0.04, "y": -0.05, "z": 0.04 } },
      { "id": "hip-r",        "position": { "x":  0.04, "y": -0.05, "z": 0.22 } },
      { "id": "knee-l",       "position": { "x": -0.04, "y":  0.20, "z": 0.04 } },
      { "id": "knee-r",       "position": { "x":  0.04, "y":  0.16, "z": 0.14 } },
      { "id": "ankle-l",      "position": { "x": -0.04, "y":  0.42, "z": 0.04 } },
      { "id": "ankle-r",      "position": { "x":  0.04, "y":  0.36, "z": 0.08 } },
      { "id": "heel-l",       "position": { "x": -0.04, "y":  0.45, "z": 0.02 } },
      { "id": "heel-r",       "position": { "x":  0.04, "y":  0.40, "z": 0.06 } },
      { "id": "toe-l",        "position": { "x": -0.04, "y":  0.52, "z": 0.08 } },
      { "id": "toe-r",        "position": { "x":  0.04, "y":  0.46, "z": 0.12 } }
    ],
    "children": [
      { "kind": "lathe", "axisFrom": "self/slot/head-crown", "axisTo": "self/slot/head-base",
        "profile": [{ "t": 0.00, "radius": 0.04 }, { "t": 0.30, "radius": 0.075 }, { "t": 0.55, "radius": 0.07 }, { "t": 0.85, "radius": 0.045 }, { "t": 1.00, "radius": 0.03 }],
        "crossSections": 20, "samples": 32, "style": { "stroke": "#3d2a1c", "width": 0.5 } },
      { "kind": "lathe", "axisFrom": "self/slot/torso-top", "axisTo": "self/slot/torso-base",
        "profile": [{ "t": 0.00, "radius": 0.13 }, { "t": 0.25, "radius": 0.12 }, { "t": 0.55, "radius": 0.10 }, { "t": 0.85, "radius": 0.085 }, { "t": 1.00, "radius": 0.08 }],
        "crossSections": 24, "samples": 36, "style": { "stroke": "#4f3928", "width": 0.5 } },
      { "kind": "lathe", "axisFrom": "self/slot/pelvis-top", "axisTo": "self/slot/pelvis-floor",
        "profile": [{ "t": 0.00, "radius": 0.08 }, { "t": 0.35, "radius": 0.11 }, { "t": 0.65, "radius": 0.10 }, { "t": 1.00, "radius": 0.07 }],
        "crossSections": 22, "samples": 32, "style": { "stroke": "#5a4030", "width": 0.5 } },
      { "kind": "connection", "from": "self/slot/head-base", "to": "self/slot/neck-base", "sag": 0, "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.05 }, { "t": 1, "r": 0.045 }], "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 } },
      { "kind": "connection", "from": "self/slot/shoulder-l", "to": "self/slot/elbow-l", "sag": 0, "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.055 }, { "t": 0.5, "r": 0.05 }, { "t": 1, "r": 0.04 }], "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 } },
      { "kind": "connection", "from": "self/slot/shoulder-r", "to": "self/slot/elbow-r", "sag": 0, "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.055 }, { "t": 0.5, "r": 0.05 }, { "t": 1, "r": 0.04 }], "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 } },
      { "kind": "connection", "from": "self/slot/elbow-l", "to": "self/slot/wrist-l", "sag": 0, "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.04 }, { "t": 0.5, "r": 0.038 }, { "t": 1, "r": 0.035 }], "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 } },
      { "kind": "connection", "from": "self/slot/elbow-r", "to": "self/slot/wrist-r", "sag": 0, "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.04 }, { "t": 0.5, "r": 0.038 }, { "t": 1, "r": 0.035 }], "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 } },
      { "kind": "connection", "from": "self/slot/hip-l", "to": "self/slot/knee-l", "sag": 0, "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.075 }, { "t": 0.5, "r": 0.065 }, { "t": 1, "r": 0.055 }], "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 } },
      { "kind": "connection", "from": "self/slot/hip-r", "to": "self/slot/knee-r", "sag": 0, "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.075 }, { "t": 0.5, "r": 0.065 }, { "t": 1, "r": 0.055 }], "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 } },
      { "kind": "connection", "from": "self/slot/knee-l", "to": "self/slot/ankle-l", "sag": 0, "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.055 }, { "t": 0.4, "r": 0.06 }, { "t": 1, "r": 0.035 }], "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 } },
      { "kind": "connection", "from": "self/slot/knee-r", "to": "self/slot/ankle-r", "sag": 0, "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.055 }, { "t": 0.4, "r": 0.06 }, { "t": 1, "r": 0.035 }], "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 } },
      { "kind": "connection", "from": "self/slot/heel-l", "to": "self/slot/toe-l", "sag": 0, "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.035 }, { "t": 0.6, "r": 0.04 }, { "t": 1, "r": 0.025 }], "ringSamples": 8,
        "style": { "fill": "#a08070", "stroke": "#3d2a1c", "width": 0.4 } },
      { "kind": "connection", "from": "self/slot/heel-r", "to": "self/slot/toe-r", "sag": 0, "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.035 }, { "t": 0.6, "r": 0.04 }, { "t": 1, "r": 0.025 }], "ringSamples": 8,
        "style": { "fill": "#a08070", "stroke": "#3d2a1c", "width": 0.4 } }
    ]
  }
}
---

# Reclining figure (classical, weight on elbow)

A figure reposed horizontally, lying on its left side with the head
propped up on the left forearm — the canonical hellenistic / classical
*recumbent* pose used for sleeping deities, banquet diners, allegorical
river-gods, and *odalisque* portraits. The body axis runs along Y (head
at -Y, feet at +Y); the figure rests with its left side on the ground (-X
landmarks at low Z) and right side facing up (+X landmarks at higher Z).

This card breaks the standing-figure convention where all landmarks
stack along the vertical Z axis. The 23-landmark vocabulary still
applies — the slot ids are the same, the lathes still anchor between
crown/base pairs — but the *spatial reading* is horizontal. The torso
lathe's axis runs from `torso-top` (-Y end, near the head) to
`torso-base` (+Y end, near the legs), so the surface of revolution
sweeps a horizontal cylinder that reads as the lying torso. Same
machinery, rotated 90°.

## Use when

- **Classical mythological recline.** A sleeping deity, a river-god,
  a nereid, a Bacchic figure, a Sleeping Ariadne, a Reclining Maja.
- **Banquet / triclinium scenes.** Roman dinner-couch poses where the
  diners recline on their left elbow while eating. Pair with a couch
  primitive or a wave-field tablecloth.
- **Death / sleep imagery.** A figure lying on a bier, a tomb effigy,
  a sleeping infant in a cradle (at smaller scale).

When the figure is **upright on the ground** rather than horizontal,
use [[standing-figure-canonical]] (with the host scene's anchor
placing the figure on the ground plane).

## Composition examples

A reclining figure on a couch:

```json
{
  "tree": {
    "id": "world",
    "spine": { "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.4 } },
    "slots": [{ "id": "couch-center", "position": { "x": 0, "y": 0, "z": 0 } }],
    "children": [
      { "slot": "couch-center", "node": { "programRef": "reclining-figure-classical", "scale": 4 } }
    ]
  }
}
```

A sleeping figure with a halo (sleeping saint):

```json
{
  "children": [
    { "slot": "bier-pos", "node": {
      "id": "sleeping-saint",
      "programRef": "reclining-figure-classical",
      "scale": 4,
      "children": [{ "slot": "head-crown", "node": { "programRef": "figure-halo" } }]
    }}
  ]
}
```

## Provenance and influences

The propped-on-elbow recline is one of the most iconographically stable
horizontal poses across millennia — Hellenistic Sleeping Ariadne
(Vatican), Roman *triclinium* dinner scenes, Baroque sleeping nymphs,
Goya's *La Maja*, Manet's *Olympia*, Rodin's *Sleep*. The shared
semantic is *repose with awareness preserved* — the figure isn't fully
recumbent (which would be `figure-prostrate` or `figure-sleeping-flat`),
but supported by one arm so the head and gaze remain elevated.

## Stays bespoke when

- The figure is **fully flat** (no propped arm). The propped left elbow
  is structural to this card; a flat recline needs a separate card.
- The figure is **face-down** rather than on the side. Prone postures
  are a separate family.
- The recline is **on the right side**. This card uses left-side-down
  convention; for right-side-down, mirror the host scene around the YZ
  plane.
