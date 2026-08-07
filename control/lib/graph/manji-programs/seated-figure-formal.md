---
{
  "id": "seated-figure-formal",
  "label": "Seated figure (formal upright)",
  "family": "figure-posture",
  "aliases": ["seated figure", "sitting figure", "person sitting", "seated pose", "enthroned figure", "formal sit", "throne pose", "presidential portrait pose"],
  "intents": ["figure", "posture", "sitting", "seated", "formal-portrait", "throne-posture", "enthroned"],
  "topology": {
    "primitive": "three-lathe-with-volumized-limbs",
    "masses": ["head", "torso", "pelvis"],
    "limbs": 11,
    "landmarks": 23
  },
  "reasoningUse": [
    "an upright figure seated formally — torso vertical, knees forward at hip height, ankles dropping straight down to the floor, hands resting on the lap",
    "the throne pose — enthroned monarch, presidential portrait, formal sitter",
    "use when a figure is seated in a dignified upright posture rather than standing; the seat (chair, throne, bench) is the caller's responsibility"
  ],
  "boundaryContract": {
    "slots": [
      "head-crown", "head-base", "neck-base", "torso-top", "torso-base", "pelvis-top", "pelvis-floor",
      "shoulder-l", "shoulder-r", "elbow-l", "elbow-r", "wrist-l", "wrist-r",
      "hip-l", "hip-r", "knee-l", "knee-r", "ankle-l", "ankle-r", "heel-l", "heel-r", "toe-l", "toe-r"
    ],
    "convention": "Z up, Y forward, -X = figure's left. Pose normalized to height 1 — host applies scale + anchor. Pelvis-floor sits at z=0.45 (the seat height) and knees project forward at hip level."
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
      { "id": "elbow-l",      "position": { "x": -0.18, "y":  0.06, "z": 0.62 } },
      { "id": "elbow-r",      "position": { "x":  0.18, "y":  0.06, "z": 0.62 } },
      { "id": "wrist-l",      "position": { "x": -0.08, "y":  0.22, "z": 0.50 } },
      { "id": "wrist-r",      "position": { "x":  0.08, "y":  0.22, "z": 0.50 } },
      { "id": "hip-l",        "position": { "x": -0.09, "y":  0.00, "z": 0.47 } },
      { "id": "hip-r",        "position": { "x":  0.09, "y":  0.00, "z": 0.47 } },
      { "id": "knee-l",       "position": { "x": -0.09, "y":  0.38, "z": 0.46 } },
      { "id": "knee-r",       "position": { "x":  0.09, "y":  0.38, "z": 0.46 } },
      { "id": "ankle-l",      "position": { "x": -0.09, "y":  0.40, "z": 0.02 } },
      { "id": "ankle-r",      "position": { "x":  0.09, "y":  0.40, "z": 0.02 } },
      { "id": "heel-l",       "position": { "x": -0.09, "y":  0.37, "z": 0.00 } },
      { "id": "heel-r",       "position": { "x":  0.09, "y":  0.37, "z": 0.00 } },
      { "id": "toe-l",        "position": { "x": -0.09, "y":  0.50, "z": 0.00 } },
      { "id": "toe-r",        "position": { "x":  0.09, "y":  0.50, "z": 0.00 } }
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

# Seated figure (formal upright)

A figure seated in a dignified upright posture — torso vertical, knees
projecting forward at hip height, lower legs dropping straight down to
the floor, hands resting on the lap. The pose communicates *enthronement*
or *formal sitting* rather than relaxed slouch.

This is `standing-figure-canonical` with three landmark deltas:
- knees and ankles translated forward (+y) so the upper leg goes
  forward instead of downward
- ankles dropped straight below knees so the lower leg is vertical
- elbows bent forward and wrists pulled in to the lap

Every other landmark — head, torso, pelvis, shoulders, hips — sits at
the standing-canonical position. The torso lathe and head lathe render
exactly as they would standing.

The seat itself (chair, throne, bench) is the caller's responsibility.
The pelvis-floor at z=0.45 marks where the figure expects to be supported.

## Use when

- **Enthroned figures.** A monarch, judge, deity, official, or any
  figure whose seated dignity carries authority.
- **Formal portraits.** Presidential, papal, ceremonial — a sitter
  facing the camera with hands resting visibly on the lap.
- **Pedagogical / scribal figures.** A teacher seated before students,
  a scribe at a desk, a saint with manuscript on lap.

When the figure is **kneeling** rather than sitting, use
[[kneeling-figure-supplicant]]. When **reclining**, use
[[reclining-figure-classical]]. When **standing**, return to
[[standing-figure-canonical]].

## Composition examples

A monarch on a throne:

```json
{
  "tree": {
    "id": "world",
    "spine": { "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.4 } },
    "slots": [{ "id": "throne-seat", "position": { "x": 0, "y": 0, "z": 0 } }],
    "children": [
      { "slot": "throne-seat", "node": { "programRef": "seated-figure-formal", "scale": 4 } }
    ]
  }
}
```

A bowed petitioner before a seated judge:

```json
{
  "children": [
    { "slot": "throne",     "node": { "programRef": "seated-figure-formal",      "scale": 4 } },
    { "slot": "petitioner", "node": { "programRef": "kneeling-figure-supplicant", "scale": 4 } }
  ]
}
```

## Provenance and influences

The formal upright seated pose appears in every iconographic
tradition's authority imagery — Pharaonic statuary, Buddhist
Bodhisattva enthronements, Byzantine *Pantocrator* mosaics, Renaissance
papal portraiture, modern presidential portraits. The cross-cultural
convergence on knees-forward / hands-on-lap / torso-upright captures
"dignified sitting" minimally.

## Stays bespoke when

- The figure is **slouching** or **relaxed sitting** — needs different
  torso angle and shoulder height.
- The figure sits **cross-legged** (lotus, half-lotus, seiza) — the leg
  landmarks fold inward rather than projecting forward; that's a
  different family.
- The figure is **side-saddle** or **at-table** — asymmetric seated
  positions need bespoke landmark layouts.
