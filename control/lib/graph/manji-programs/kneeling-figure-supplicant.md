---
{
  "id": "kneeling-figure-supplicant",
  "label": "Kneeling figure (supplicant)",
  "family": "figure-posture",
  "aliases": ["kneeling figure", "supplicant", "kneeling person", "prayer kneel", "petitioner", "kneel pose", "humility pose"],
  "intents": ["figure", "posture", "kneeling", "supplicant", "petition", "prayer-kneel", "humility", "reverence", "submission"],
  "topology": {
    "primitive": "three-lathe-with-volumized-limbs",
    "masses": ["head", "torso", "pelvis"],
    "limbs": 11,
    "landmarks": 23
  },
  "reasoningUse": [
    "a figure kneeling on the floor — knees on the ground in front, shins flat back along the floor, torso upright above the pelvis, hands joined in prayer at the chest",
    "use when a figure is in supplication, petition, or formal reverence before another figure or sacred object",
    "the canonical supplicant; pairs naturally with a seated authority figure (judge, monarch, deity) above"
  ],
  "boundaryContract": {
    "slots": [
      "head-crown", "head-base", "neck-base", "torso-top", "torso-base", "pelvis-top", "pelvis-floor",
      "shoulder-l", "shoulder-r", "elbow-l", "elbow-r", "wrist-l", "wrist-r",
      "hip-l", "hip-r", "knee-l", "knee-r", "ankle-l", "ankle-r", "heel-l", "heel-r", "toe-l", "toe-r"
    ],
    "convention": "Z up, Y forward, -X = figure's left. Pose normalized to height 1 standing-equivalent — host applies scale + anchor. Kneeling reduces the figure's effective height to ~0.85; the shins lie back along the ground in -Y."
  },
  "manjiProgram": {
    "spine": {
      "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.3 }
    },
    "slots": [
      { "id": "head-crown",   "position": { "x":  0.00, "y":  0.00, "z": 0.85 } },
      { "id": "head-base",    "position": { "x":  0.00, "y":  0.00, "z": 0.71 } },
      { "id": "neck-base",    "position": { "x":  0.00, "y":  0.00, "z": 0.67 } },
      { "id": "torso-top",    "position": { "x":  0.00, "y":  0.00, "z": 0.63 } },
      { "id": "torso-base",   "position": { "x":  0.00, "y":  0.00, "z": 0.40 } },
      { "id": "pelvis-top",   "position": { "x":  0.00, "y":  0.00, "z": 0.40 } },
      { "id": "pelvis-floor", "position": { "x":  0.00, "y":  0.00, "z": 0.30 } },
      { "id": "shoulder-l",   "position": { "x": -0.18, "y":  0.00, "z": 0.63 } },
      { "id": "shoulder-r",   "position": { "x":  0.18, "y":  0.00, "z": 0.63 } },
      { "id": "elbow-l",      "position": { "x": -0.14, "y":  0.12, "z": 0.50 } },
      { "id": "elbow-r",      "position": { "x":  0.14, "y":  0.12, "z": 0.50 } },
      { "id": "wrist-l",      "position": { "x": -0.04, "y":  0.18, "z": 0.53 } },
      { "id": "wrist-r",      "position": { "x":  0.04, "y":  0.18, "z": 0.53 } },
      { "id": "hip-l",        "position": { "x": -0.09, "y":  0.00, "z": 0.32 } },
      { "id": "hip-r",        "position": { "x":  0.09, "y":  0.00, "z": 0.32 } },
      { "id": "knee-l",       "position": { "x": -0.09, "y":  0.06, "z": 0.00 } },
      { "id": "knee-r",       "position": { "x":  0.09, "y":  0.06, "z": 0.00 } },
      { "id": "ankle-l",      "position": { "x": -0.09, "y": -0.16, "z": 0.00 } },
      { "id": "ankle-r",      "position": { "x":  0.09, "y": -0.16, "z": 0.00 } },
      { "id": "heel-l",       "position": { "x": -0.09, "y": -0.14, "z": 0.03 } },
      { "id": "heel-r",       "position": { "x":  0.09, "y": -0.14, "z": 0.03 } },
      { "id": "toe-l",        "position": { "x": -0.09, "y": -0.24, "z": 0.00 } },
      { "id": "toe-r",        "position": { "x":  0.09, "y": -0.24, "z": 0.00 } }
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
      { "kind": "connection", "from": "self/slot/elbow-l", "to": "self/slot/wrist-l",
        "modes": [{ "amplitude": 0.012, "cycles": 0.5 }], "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.04 }, { "t": 0.5, "r": 0.038 }, { "t": 1, "r": 0.035 }], "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 } },
      { "kind": "connection", "from": "self/slot/elbow-r", "to": "self/slot/wrist-r",
        "modes": [{ "amplitude": 0.012, "cycles": 0.5 }], "crossSection": "tube",
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

# Kneeling figure (supplicant)

A figure kneeling on the floor in formal supplication — knees on the
ground in front (z=0), shins lying flat back along the ground in -Y,
torso held upright above the pelvis, hands brought together in prayer at
the chest. The pose communicates *humility* and *petition* before an
authority — a worshipper, a knight before a monarch, a saint before a
deity.

This is `standing-figure-canonical` with the lower-body chain
restructured: the pelvis drops to z=0.30 (the figure is now ~85% of
standing height), the knees come to the ground in front, and the shins
fold back along the floor. The torso-spine + head chain stays vertical
above the pelvis. Hands clasp at the chest as in `figure-praying-bowed`
but at the higher torso position.

## Use when

- **Supplication scenes.** A petitioner before a monarch, a knight
  swearing fealty, a worshipper before an altar. Pairs naturally with
  [[seated-figure-formal]] above (the authority).
- **Devotional iconography.** A saint or holy figure in prayer before a
  shrine or sacred object. Pairs with [[figure-halo]] for canonized
  figures.
- **Pleading or submission.** A defeated figure surrendering, a child
  asking forgiveness, a vassal pledging service.

When the figure is **bowed forward without kneeling** (standing
bow), use [[figure-praying-bowed]]. When **standing erect** in prayer
with arms raised, use [[figure-orans]]. When **seated** in dignified
authority above the supplicant, use [[seated-figure-formal]].

## Composition examples

A supplicant before an enthroned monarch:

```json
{
  "tree": {
    "id": "world",
    "spine": { "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.4 } },
    "slots": [
      { "id": "throne-pos",    "position": { "x":  0, "y": 0, "z": 0 } },
      { "id": "supplicant-pos","position": { "x":  0, "y": 2, "z": 0 } }
    ],
    "children": [
      { "slot": "throne-pos",     "node": { "programRef": "seated-figure-formal",      "scale": 4 } },
      { "slot": "supplicant-pos", "node": { "programRef": "kneeling-figure-supplicant","scale": 4 } }
    ]
  }
}
```

A row of kneeling worshippers before an altar:

```json
{
  "children": [{
    "replicate": { "offsets": [{ "x": -2, "y": 0, "z": 0 }, { "x": 0, "y": 0, "z": 0 }, { "x": 2, "y": 0, "z": 0 }] },
    "node": { "programRef": "kneeling-figure-supplicant", "scale": 3 }
  }]
}
```

## Provenance and influences

The kneeling supplication pose is one of the most universal across
iconographic traditions — Christian saints in *adoration*, Hindu devotees
in *praṇāma*, Buddhist *gongyo*, Islamic *sujud*, feudal *fealty*
ceremonies. The shared semantic is *lowering oneself before what one
acknowledges as higher*. This card captures the *upright-on-knees* variant
(buttocks elevated above heels); for full prostration (forehead to ground)
a separate `figure-prostrate` card is deferred.

## Stays bespoke when

- The figure is **prostrate** (forehead/chest to ground) — that's a
  full prostration, not this upright-kneel.
- The figure is **kneeling on one knee** rather than both — heroic /
  vow-taking poses where one knee is raised. That's a different family.
- The kneeling is **seiza** (Japanese formal sit on heels with buttocks
  touching) — the pelvis drops lower and the shins fold under the
  buttocks. That's a separate cultural-specific card.
- The figure is **kneeling sideways** (presented to camera at an angle).
  This card is bilaterally symmetric and frontal.
