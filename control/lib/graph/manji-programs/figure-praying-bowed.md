---
{
  "id": "figure-praying-bowed",
  "label": "Figure bowed in prayer (hands together)",
  "family": "figure-posture",
  "aliases": ["bowing", "bowed-figure", "bowed-prayer", "hands-together-prayer", "kneeling-prayer-standing", "supplication-bowed", "figure-reverent"],
  "intents": ["figure", "posture", "prayer", "reverence", "bow", "humility", "supplication", "contemplation", "meditation", "obeisance"],
  "topology": {
    "primitive": "three-lathe-with-volumized-limbs",
    "masses": ["head", "torso", "pelvis"],
    "limbs": 11,
    "landmarks": 23,
    "asymmetry": "none — bilaterally symmetric, sagittally bent forward"
  },
  "reasoningUse": [
    "a single human figure bowed forward at the waist, head lowered, hands brought together in front of the chest in the canonical prayer posture",
    "use when a scene needs reverence rather than supplication — a worshipper at devotion, a pilgrim at a shrine, a celebrant in contemplation (orans is *receiving*; bowed is *offering*)",
    "the substrate's first sagittally-bent posture; tests that landmark forward-tilt on the upper-body chain reads as 'bowed' under the same three-lathe machinery"
  ],
  "boundaryContract": {
    "slots": [
      "head-crown", "head-base", "neck-base", "torso-top", "torso-base", "pelvis-top", "pelvis-floor",
      "shoulder-l", "shoulder-r", "elbow-l", "elbow-r", "wrist-l", "wrist-r",
      "hip-l", "hip-r", "knee-l", "knee-r", "ankle-l", "ankle-r", "heel-l", "heel-r", "toe-l", "toe-r"
    ],
    "convention": "Z up, Y forward, -X = figure's left. Pose normalized to height 1 — host applies scale + anchor. Figure bows toward +Y."
  },
  "manjiProgram": {
    "spine": {
      "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.3 }
    },
    "slots": [
      { "id": "head-crown",   "position": { "x":  0.00, "y":  0.22, "z": 0.84 } },
      { "id": "head-base",    "position": { "x":  0.00, "y":  0.18, "z": 0.72 } },
      { "id": "neck-base",    "position": { "x":  0.00, "y":  0.14, "z": 0.68 } },
      { "id": "torso-top",    "position": { "x":  0.00, "y":  0.14, "z": 0.66 } },
      { "id": "torso-base",   "position": { "x":  0.00, "y":  0.04, "z": 0.52 } },
      { "id": "pelvis-top",   "position": { "x":  0.00, "y":  0.02, "z": 0.52 } },
      { "id": "pelvis-floor", "position": { "x":  0.00, "y":  0.00, "z": 0.45 } },
      { "id": "shoulder-l",   "position": { "x": -0.17, "y":  0.14, "z": 0.66 } },
      { "id": "shoulder-r",   "position": { "x":  0.17, "y":  0.14, "z": 0.66 } },
      { "id": "elbow-l",      "position": { "x": -0.13, "y":  0.26, "z": 0.55 } },
      { "id": "elbow-r",      "position": { "x":  0.13, "y":  0.26, "z": 0.55 } },
      { "id": "wrist-l",      "position": { "x": -0.04, "y":  0.30, "z": 0.58 } },
      { "id": "wrist-r",      "position": { "x":  0.04, "y":  0.30, "z": 0.58 } },
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
      {
        "kind": "lathe",
        "axisFrom": "self/slot/head-crown",
        "axisTo":   "self/slot/head-base",
        "profile": [
          { "t": 0.00, "radius": 0.04 },
          { "t": 0.30, "radius": 0.075 },
          { "t": 0.55, "radius": 0.07 },
          { "t": 0.85, "radius": 0.045 },
          { "t": 1.00, "radius": 0.03 }
        ],
        "crossSections": 20,
        "samples": 32,
        "style": { "stroke": "#3d2a1c", "width": 0.5 }
      },
      {
        "kind": "lathe",
        "axisFrom": "self/slot/torso-top",
        "axisTo":   "self/slot/torso-base",
        "profile": [
          { "t": 0.00, "radius": 0.13 },
          { "t": 0.25, "radius": 0.12 },
          { "t": 0.55, "radius": 0.10 },
          { "t": 0.85, "radius": 0.085 },
          { "t": 1.00, "radius": 0.08 }
        ],
        "crossSections": 24,
        "samples": 36,
        "style": { "stroke": "#4f3928", "width": 0.5 }
      },
      {
        "kind": "lathe",
        "axisFrom": "self/slot/pelvis-top",
        "axisTo":   "self/slot/pelvis-floor",
        "profile": [
          { "t": 0.00, "radius": 0.08 },
          { "t": 0.35, "radius": 0.11 },
          { "t": 0.65, "radius": 0.10 },
          { "t": 1.00, "radius": 0.07 }
        ],
        "crossSections": 22,
        "samples": 32,
        "style": { "stroke": "#5a4030", "width": 0.5 }
      },
      {
        "kind": "connection",
        "from": "self/slot/head-base",
        "to":   "self/slot/neck-base",
        "sag": 0,
        "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.05 }, { "t": 1, "r": 0.045 }],
        "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 }
      },
      {
        "kind": "connection",
        "from": "self/slot/shoulder-l",
        "to":   "self/slot/elbow-l",
        "sag": 0,
        "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.055 }, { "t": 0.5, "r": 0.05 }, { "t": 1, "r": 0.04 }],
        "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 }
      },
      {
        "kind": "connection",
        "from": "self/slot/shoulder-r",
        "to":   "self/slot/elbow-r",
        "sag": 0,
        "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.055 }, { "t": 0.5, "r": 0.05 }, { "t": 1, "r": 0.04 }],
        "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 }
      },
      {
        "kind": "connection",
        "from": "self/slot/elbow-l",
        "to":   "self/slot/wrist-l",
        "modes": [{ "amplitude": 0.012, "cycles": 0.5 }],
        "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.04 }, { "t": 0.5, "r": 0.038 }, { "t": 1, "r": 0.035 }],
        "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 }
      },
      {
        "kind": "connection",
        "from": "self/slot/elbow-r",
        "to":   "self/slot/wrist-r",
        "modes": [{ "amplitude": 0.012, "cycles": 0.5 }],
        "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.04 }, { "t": 0.5, "r": 0.038 }, { "t": 1, "r": 0.035 }],
        "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 }
      },
      {
        "kind": "connection",
        "from": "self/slot/hip-l",
        "to":   "self/slot/knee-l",
        "sag": 0,
        "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.075 }, { "t": 0.5, "r": 0.065 }, { "t": 1, "r": 0.055 }],
        "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 }
      },
      {
        "kind": "connection",
        "from": "self/slot/hip-r",
        "to":   "self/slot/knee-r",
        "sag": 0,
        "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.075 }, { "t": 0.5, "r": 0.065 }, { "t": 1, "r": 0.055 }],
        "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 }
      },
      {
        "kind": "connection",
        "from": "self/slot/knee-l",
        "to":   "self/slot/ankle-l",
        "sag": 0,
        "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.055 }, { "t": 0.4, "r": 0.06 }, { "t": 1, "r": 0.035 }],
        "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 }
      },
      {
        "kind": "connection",
        "from": "self/slot/knee-r",
        "to":   "self/slot/ankle-r",
        "sag": 0,
        "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.055 }, { "t": 0.4, "r": 0.06 }, { "t": 1, "r": 0.035 }],
        "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 }
      },
      {
        "kind": "connection",
        "from": "self/slot/heel-l",
        "to":   "self/slot/toe-l",
        "sag": 0,
        "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.035 }, { "t": 0.6, "r": 0.04 }, { "t": 1, "r": 0.025 }],
        "ringSamples": 8,
        "style": { "fill": "#a08070", "stroke": "#3d2a1c", "width": 0.4 }
      },
      {
        "kind": "connection",
        "from": "self/slot/heel-r",
        "to":   "self/slot/toe-r",
        "sag": 0,
        "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.035 }, { "t": 0.6, "r": 0.04 }, { "t": 1, "r": 0.025 }],
        "ringSamples": 8,
        "style": { "fill": "#a08070", "stroke": "#3d2a1c", "width": 0.4 }
      }
    ]
  }
}
---

# Figure bowed in prayer

A figure bent forward at the waist in the canonical prayer-bow — head
lowered toward the chest, shoulders rounded, hands brought together in
front of the sternum, palms touching. Legs remain straight, weight even
on both feet, hips and pelvis at their resting positions. The bow lives
entirely in the upper body's forward translation.

This card distinguishes *bowed* from *raised* prayer (`figure-orans`):
orans is *receiving* — palms up, arms wide, body open. Bowed is
*offering* — palms together, body closed, attention internalized. Both
are devotional postures; they communicate different relationships to
what the figure is praying *toward*.

## Use when

- **Reverence scenes.** A devotee at a shrine, a pilgrim at a chapel,
  a celebrant in contemplation. Particularly East-Asian and South-Asian
  iconographic conventions (Buddhist, Shinto, Hindu prayer postures)
  where the bow is the canonical reverent stance.
- **Group worship.** Mixed with `figure-orans` and `standing-figure-canonical`,
  a `figure-praying-bowed` provides a quieter counterpoint — the
  congregation isn't all doing the same thing.
- **Procession exit.** A bowed figure at the end of a row of standing
  figures reads as "the closing reverence" of a ritual.

## Slot semantics

Inherits the 23-landmark vocabulary. The forward bow lives in upper-body
landmark positions:

- **Head/neck/torso-top tilt forward** (positive +y): `head-crown`,
  `head-base`, `neck-base`, `torso-top` all sit at +0.14 to +0.22 y, and
  `z` drops from baseline (head-crown at z=0.84 vs the canonical 1.00).
  The visible torso *lathe* axis therefore tilts forward as a single
  segment from `torso-top` down to `torso-base`, since the lathe is a
  surface of revolution around its axis.
- **Pelvis/hips/legs unchanged.** The bow is a hip-hinge — pelvis stays
  vertical, legs stay straight, feet stay planted.
- **Hands clasp in front** (`wrist-l` ≈ -0.04, `wrist-r` ≈ +0.04, both
  at y=0.30). The wrists are close enough to read as a clasp; arm bend
  comes from the elbow positions (`elbow-{l,r}` at y=+0.26, x=±0.13).
- **Forearm modes**: the elbow→wrist limbs carry a small mode-1
  displacement so the closed-position forearms don't read as straight
  sticks meeting at the wrists.

## Composition examples

A bowed figure at a small altar:

```json
{
  "tree": {
    "id": "world",
    "spine": { "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.4 } },
    "slots": [
      { "id": "altar-front", "position": { "x": 0, "y": -1.5, "z": 0 } },
      { "id": "altar-back",  "position": { "x": 0, "y": 0,    "z": 0 } }
    ],
    "children": [
      { "slot": "altar-front", "node": { "programRef": "figure-praying-bowed", "scale": 4 } },
      { "slot": "altar-back",  "node": { "programRef": "chalice", "scale": 1.2 } }
    ]
  }
}
```

## Provenance and influences

The hands-together prayer-bow has continuous tradition across most major
religious iconographies — Christian *orant* contemplative variants,
Buddhist *añjali mudrā*, Hindu *namaste*, Shinto *seiza* prostration —
all converge on bringing the body's bilateral channels together at the
heart and lowering the head as a single composed reverent unit. This
card captures the standing variant (knees not bent); seated and prone
variants are deferred.

## Stays bespoke when

- The figure needs **kneeling** (knees on the ground, shins flat) — that
  reduces the figure's overall height and changes the leg landmark
  chain entirely. `figure-praying-kneeling` is a separate card
  (deferred).
- The bow needs to be **deeper** (forehead toward the ground in
  prostration) — the upper body translation here is moderate; full
  prostration is `figure-prostrate` (deferred).
- The figure needs **expression of grief** vs reverence — the body's
  upper-chain landmarks would shift similarly, but the *intent*
  differs and an iconographic distinction would help the model pick.
