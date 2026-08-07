---
{
  "id": "figure-orans",
  "label": "Figure in orans (arms raised in prayer)",
  "family": "figure-posture",
  "aliases": ["arms-raised", "praying-arms-up", "supplication", "hands-to-heaven", "figure-prayer-standing"],
  "intents": ["figure", "posture", "prayer", "praise", "supplication", "orans", "raised-arms", "religious", "supplicant"],
  "topology": {
    "primitive": "three-lathe-with-volumized-limbs",
    "masses": ["head", "torso", "pelvis"],
    "limbs": 11,
    "landmarks": 23,
    "asymmetry": "none — bilaterally symmetric"
  },
  "reasoningUse": [
    "a single human figure standing erect with both arms raised laterally and upward in the classical orans pose — palms forward or upward, slight elbow bend, legs straight",
    "use when a scene needs a figure in supplication, praise, or invocation — a worshipper, a saint, a celebrant with hands lifted",
    "sibling of `standing-figure-canonical` differing only in arm landmark positions; the upper-arm limbs carry a small mode-1 displacement so the lifted arms read with muscle tension rather than as bent sticks"
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
      { "id": "elbow-l",      "position": { "x": -0.38, "y":  0.00, "z": 0.92 } },
      { "id": "elbow-r",      "position": { "x":  0.38, "y":  0.00, "z": 0.92 } },
      { "id": "wrist-l",      "position": { "x": -0.46, "y":  0.00, "z": 1.10 } },
      { "id": "wrist-r",      "position": { "x":  0.46, "y":  0.00, "z": 1.10 } },
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
        "modes": [{ "amplitude": 0.025, "cycles": 0.5 }],
        "crossSection": "tube",
        "radius": [
          { "t": 0, "r": 0.055 },
          { "t": 0.5, "r": 0.055 },
          { "t": 1, "r": 0.04 }
        ],
        "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 }
      },
      {
        "kind": "connection",
        "from": "self/slot/shoulder-r",
        "to":   "self/slot/elbow-r",
        "modes": [{ "amplitude": 0.025, "cycles": 0.5 }],
        "crossSection": "tube",
        "radius": [
          { "t": 0, "r": 0.055 },
          { "t": 0.5, "r": 0.055 },
          { "t": 1, "r": 0.04 }
        ],
        "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 }
      },
      {
        "kind": "connection",
        "from": "self/slot/elbow-l",
        "to":   "self/slot/wrist-l",
        "modes": [{ "amplitude": 0.015, "cycles": 0.5 }],
        "crossSection": "tube",
        "radius": [
          { "t": 0, "r": 0.04 },
          { "t": 0.5, "r": 0.04 },
          { "t": 1, "r": 0.035 }
        ],
        "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 }
      },
      {
        "kind": "connection",
        "from": "self/slot/elbow-r",
        "to":   "self/slot/wrist-r",
        "modes": [{ "amplitude": 0.015, "cycles": 0.5 }],
        "crossSection": "tube",
        "radius": [
          { "t": 0, "r": 0.04 },
          { "t": 0.5, "r": 0.04 },
          { "t": 1, "r": 0.035 }
        ],
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

# Figure in orans (arms raised)

The classical *orans* pose — both arms lifted laterally and slightly upward,
elbows bent outward, wrists above shoulder height with palms turned forward
or upward in supplication or praise. Legs straight, weight even.

This card is `standing-figure-canonical`'s first sibling. The structural machinery is
identical — three lathes for head, torso, pelvis; eleven volumized
line-betweens for the limbs — and the differences are entirely in the
landmark positions (the arm chain rises and angles outward) and the
upper-arm limb wave parameters (a small mode-1 displacement reads as
muscle tension under the lift, rather than the arms reading as bent
sticks).

This is the first wave-parameter-expressive figure card: arms-down
(`standing-figure-canonical`) uses `sag: 0` on every limb, arms-up (`figure-orans`)
uses `modes: [{amplitude: 0.025, cycles: 0.5}]` on the upper arms and a
smaller amplitude on the forearms. The substrate's "character lives in
tunable wave parameters" thesis lands here.

## Use when

- **Worship scenes.** A worshipper invoking, praising, or supplicating in
  a sanctuary, on an altar platform, in a procession.
- **Saintly figures.** Iconography conventions where the saint's pose
  itself carries the narrative — particularly Eastern Orthodox and early
  Christian icon traditions.
- **Crowds of celebrants.** Three or four `figure-orans` via
  `replicate.offsets` makes a congregation in mid-praise.

## Slot semantics

Inherits the 23-landmark vocabulary from `standing-figure-canonical`. Only the
six arm landmarks have different positions:

- `shoulder-{l,r}` — unchanged (top of each arm)
- `elbow-{l,r}` — angled outward (`x` ≈ ±0.38) and raised (`z` ≈ 0.92,
  ~14% of figure height above the shoulder line)
- `wrist-{l,r}` — further outward (`x` ≈ ±0.46) and above the head crown
  (`z` ≈ 1.10), suggesting palms-up at the level of prayer

Head, torso, pelvis, hips, knees, ankles, heels, toes — all at the same
positions as `standing-figure-canonical`.

## Composition examples

A single orans figure as a sanctuary center:

```json
{
  "tree": {
    "id": "world",
    "spine": { "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.4 } },
    "slots": [{ "id": "sanctuary-center", "position": { "x": 0, "y": 0, "z": 0 } }],
    "children": [
      { "slot": "sanctuary-center", "node": { "programRef": "figure-orans", "scale": 4 } }
    ]
  }
}
```

A row of three worshippers via replicate:

```json
{
  "children": [{
    "replicate": { "offsets": [{ "x": -2.5, "y": 0, "z": 0 }, { "x": 0, "y": 0, "z": 0 }, { "x": 2.5, "y": 0, "z": 0 }] },
    "node": { "programRef": "figure-orans", "scale": 3 }
  }]
}
```

## Provenance and influences

The orans pose has continuous iconographic history from Greco-Roman
funerary stelae through early Christian catacomb frescoes (the *Velatio*
in Priscilla, Rome, 4th c.) into Byzantine iconography. The pose
visually communicates *receptive* rather than *active* supplication —
the figure holds itself open to what descends, rather than asking with
gesture.

## Stays bespoke when

- The figure needs **strongly characterized facial expression** (rapture,
  ecstasy, grief) — the substrate's resolution stops at landmark slots.
- The figure needs **fingers** spreading, clasping, or pointing — finger
  detail is out of scope.
- The arms need to lift **higher overhead** (palms touching above the
  crown) — that's a different gestural family (`figure-overhead-clasp`,
  deferred).
