---
{
  "id": "standing-figure-canonical",
  "label": "Standing figure (canonical upright)",
  "family": "figure-posture",
  "aliases": ["standing figure", "upright figure", "person standing", "standing pose", "standing person", "frontal figure", "default human pose", "figure-attention", "soldier-at-attention", "erect figure"],
  "intents": ["figure", "posture", "standing", "human", "person", "body", "anatomy", "attention", "erect", "upright", "figure-staging", "pose-foundation"],
  "topology": {
    "primitive": "three-lathe-with-volumized-limbs",
    "masses": ["head", "torso", "pelvis"],
    "limbs": 11,
    "landmarks": 23
  },
  "reasoningUse": [
    "a single human figure standing erect — arms straight at the sides, legs straight, feet planted",
    "the canonical posture card and the substrate's figure baseline; reach for it when a scene needs a person whose pose carries no specific narrative weight",
    "the foundation other posture cards mutate from — orans (arms raised), walking (asymmetric stride), praying-bowed (curved spine), seated, kneeling, reclining, contrapposto"
  ],
  "boundaryContract": {
    "slots": [
      "head-crown", "head-base", "neck-base", "torso-top", "torso-base", "pelvis-top", "pelvis-floor",
      "shoulder-l", "shoulder-r", "elbow-l", "elbow-r", "wrist-l", "wrist-r",
      "hip-l", "hip-r", "knee-l", "knee-r", "ankle-l", "ankle-r", "heel-l", "heel-r", "toe-l", "toe-r"
    ],
    "convention": "Z up, Y forward, -X = figure's left. Pose normalized to height 1 — host applies scale + anchor."
  },
  "manjiProgram": {
    "spine": {
      "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.3 }
    },
    "slots": [
      { "id": "head-crown",   "position": { "x":  0.00, "y":  0.00, "z": 1.00 } },
      { "id": "head-base",    "position": { "x":  0.00, "y":  0.00, "z": 0.86 } },
      { "id": "neck-base",    "position": { "x":  0.00, "y":  0.00, "z": 0.82 } },
      { "id": "torso-top",    "position": { "x":  0.00, "y":  0.00, "z": 0.78 } },
      { "id": "torso-base",   "position": { "x":  0.00, "y":  0.00, "z": 0.55 } },
      { "id": "pelvis-top",   "position": { "x":  0.00, "y":  0.00, "z": 0.55 } },
      { "id": "pelvis-floor", "position": { "x":  0.00, "y":  0.00, "z": 0.45 } },
      { "id": "shoulder-l",   "position": { "x": -0.18, "y":  0.00, "z": 0.78 } },
      { "id": "shoulder-r",   "position": { "x":  0.18, "y":  0.00, "z": 0.78 } },
      { "id": "elbow-l",      "position": { "x": -0.18, "y":  0.00, "z": 0.60 } },
      { "id": "elbow-r",      "position": { "x":  0.18, "y":  0.00, "z": 0.60 } },
      { "id": "wrist-l",      "position": { "x": -0.18, "y":  0.00, "z": 0.45 } },
      { "id": "wrist-r",      "position": { "x":  0.18, "y":  0.00, "z": 0.45 } },
      { "id": "hip-l",        "position": { "x": -0.09, "y":  0.00, "z": 0.47 } },
      { "id": "hip-r",        "position": { "x":  0.09, "y":  0.00, "z": 0.47 } },
      { "id": "knee-l",       "position": { "x": -0.09, "y":  0.00, "z": 0.25 } },
      { "id": "knee-r",       "position": { "x":  0.09, "y":  0.00, "z": 0.25 } },
      { "id": "ankle-l",      "position": { "x": -0.09, "y":  0.00, "z": 0.02 } },
      { "id": "ankle-r",      "position": { "x":  0.09, "y":  0.00, "z": 0.02 } },
      { "id": "heel-l",       "position": { "x": -0.09, "y": -0.03, "z": 0.00 } },
      { "id": "heel-r",       "position": { "x":  0.09, "y": -0.03, "z": 0.00 } },
      { "id": "toe-l",        "position": { "x": -0.09, "y":  0.08, "z": 0.00 } },
      { "id": "toe-r",        "position": { "x":  0.09, "y":  0.08, "z": 0.00 } }
    ],
    "children": [
      { "kind": "lathe", "axisFrom": "self/slot/head-crown", "axisTo": "self/slot/head-base",
        "profile": [{ "t": 0.00, "radius": 0.04 }, { "t": 0.30, "radius": 0.075 }, { "t": 0.55, "radius": 0.07 }, { "t": 0.85, "radius": 0.045 }, { "t": 1.00, "radius": 0.03 }],
        "crossSections": 20, "samples": 32,
        "style": { "stroke": "#3d2a1c", "width": 0.5 } },
      { "kind": "lathe", "axisFrom": "self/slot/torso-top", "axisTo": "self/slot/torso-base",
        "profile": [{ "t": 0.00, "radius": 0.13 }, { "t": 0.25, "radius": 0.12 }, { "t": 0.55, "radius": 0.10 }, { "t": 0.85, "radius": 0.085 }, { "t": 1.00, "radius": 0.08 }],
        "crossSections": 24, "samples": 36,
        "style": { "stroke": "#4f3928", "width": 0.5 } },
      { "kind": "lathe", "axisFrom": "self/slot/pelvis-top", "axisTo": "self/slot/pelvis-floor",
        "profile": [{ "t": 0.00, "radius": 0.08 }, { "t": 0.35, "radius": 0.11 }, { "t": 0.65, "radius": 0.10 }, { "t": 1.00, "radius": 0.07 }],
        "crossSections": 22, "samples": 32,
        "style": { "stroke": "#5a4030", "width": 0.5 } },
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

# Standing figure (canonical upright)

The **default body**. An upright human figure standing at attention —
arms straight at the sides, legs straight, feet planted with heel back
and toe forward. Head, torso, pelvis realized as three lathes; eleven
limb segments (neck, upper-arms × 2, forearms × 2, upper-legs × 2,
lower-legs × 2, feet × 2) as volumized line-betweens (tube cross-section)
between the 23 landmark slots.

This card is the substrate's figure baseline — the neutral pose every
other posture card mutates from. Variants:

- [[contrapposto-figure-canonical]] — classical S-curve weight shift
- [[seated-figure-formal]] — knees forward, ankles at floor
- [[kneeling-figure-supplicant]] — pelvis lowered, knees on ground
- [[reclining-figure-classical]] — figure rotated 90° horizontal
- [[figure-orans]] — arms raised in supplication
- [[figure-walking]] — asymmetric mid-stride
- [[figure-praying-bowed]] — torso tilted forward at the waist

## Use when

- **Generic figure placement.** A scene wants a person standing somewhere
  and the posture isn't strongly characterized — a guard, a worshipper at
  rest, a bystander, a portrait subject. The pose carries no narrative
  weight; it just needs to read as human.
- **Architectural staffage.** A figure beside a column, an altar, or a
  doorway, anchored to communicate proportions.
- **Crowds via replicate.** Three or four invocations via
  `replicate.offsets` make a row of standing figures — a council, a
  congregation, an honor guard.
- **Baseline for posture variants.** Author a posture card by starting
  from this card's landmark positions and translating only the slots
  the pose changes.

## Slot semantics

The card exposes 23 landmark slots that posture variants inherit. Each
slot is a named anatomical point in normalized figure-height space (head
crown at z=1, ankles near z=0). The substrate applies host scale and
anchor; downstream adornment cards bind to the slot names.

- **Spine masses (7 slots)**: `head-crown` and `head-base` bound the head
  lathe. `torso-top` (≈ sternum) and `torso-base` (≈ navel) bound the
  torso lathe. `pelvis-top` and `pelvis-floor` bound the pelvis lathe.
  `neck-base` sits between `head-base` and `torso-top` so the neck
  connection lands cleanly.
- **Arm landmarks (6 slots)**: `shoulder-{l,r}` at the top of each arm,
  `elbow-{l,r}` mid-arm, `wrist-{l,r}` at the hand. Vertically aligned
  for the standing pose.
- **Leg landmarks (6 slots)**: `hip-{l,r}` at the pelvis floor,
  `knee-{l,r}` mid-leg, `ankle-{l,r}` at the foot.
- **Foot landmarks (4 slots)**: `heel-{l,r}` behind the ankle (in -Y),
  `toe-{l,r}` ahead of the ankle (in +Y).

## Composition examples

A figure standing beside a chalice on an altar:

```json
{
  "tree": {
    "id": "world",
    "spine": { "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.4 } },
    "slots": [
      { "id": "figure-pad", "position": { "x": -1.5, "y": 0, "z": 0 } },
      { "id": "altar-pad",  "position": { "x":  1.5, "y": 0, "z": 0 } }
    ],
    "children": [
      { "slot": "figure-pad", "node": { "programRef": "standing-figure-canonical", "scale": 4 } },
      { "slot": "altar-pad",  "node": { "programRef": "chalice", "scale": 1.4 } }
    ]
  }
}
```

A row of three figures using `replicate.offsets`:

```json
{
  "children": [{
    "replicate": { "offsets": [{ "x": -2, "y": 0, "z": 0 }, { "x": 0, "y": 0, "z": 0 }, { "x": 2, "y": 0, "z": 0 }] },
    "node": { "programRef": "standing-figure-canonical", "scale": 4 }
  }]
}
```

A standing figure adorned with halo + cape (saint with mantle):

```json
{
  "tree": {
    "children": [
      { "slot": "figure-pad", "node": {
        "id": "saint",
        "programRef": "standing-figure-canonical", "scale": 4,
        "children": [
          { "slot": "head-crown",  "node": { "programRef": "figure-halo" } },
          { "slot": "shoulder-l",  "node": { "programRef": "figure-cape" } }
        ]
      }}
    ]
  }
}
```

## Provenance and influences

The arms-at-sides standing pose is the classical *contrapposto*'s
opposite — weight-bearing without weight-shift, the canonical
Greco-Roman *kouros* stance. This card is the substrate's baseline
because every other figure posture is more readable as a *mutation*
of it.

## Stays bespoke when

- The pose carries strong narrative weight (mid-gesture, mid-fall,
  mid-action) — those need bespoke landmark positions, not this neutral
  baseline.
- The figure needs **clothing**, **armor**, or **drapery** beyond what a
  cape/sash adornment card provides.
- The figure needs **hands** with individual fingers, or **facial
  features**. The substrate's resolution stops at landmark slots.
- The figure is **not human** — quadrupeds, winged creatures, or
  asymmetric bodies need their own landmark vocabularies.
