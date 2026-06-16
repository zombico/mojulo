---
{
  "id": "figure-walking",
  "label": "Figure mid-stride (walking)",
  "family": "figure-posture",
  "aliases": ["walking", "mid-step", "in-stride", "figure-pedestrian", "figure-walking-forward", "walker"],
  "intents": ["figure", "posture", "walking", "stride", "motion", "asymmetric", "pedestrian", "movement", "step"],
  "topology": {
    "primitive": "three-lathe-with-volumized-limbs",
    "masses": ["head", "torso", "pelvis"],
    "limbs": 11,
    "landmarks": 23,
    "asymmetry": "left leg forward + right arm forward (contralateral swing)"
  },
  "reasoningUse": [
    "a single human figure caught mid-stride, weight transferring forward — left leg planted ahead, right leg trailing behind, arms swinging contralaterally (right arm forward, left arm back)",
    "use when a scene needs implied motion — a traveler, a pedestrian, a figure crossing a space rather than standing in it",
    "the substrate's first ASYMMETRIC posture card; tests that landmark asymmetry + wave-parameter tuning (mode-3 calf flex on the trailing leg) read as motion without needing per-frame animation"
  ],
  "boundaryContract": {
    "slots": [
      "head-crown", "head-base", "neck-base", "torso-top", "torso-base", "pelvis-top", "pelvis-floor",
      "shoulder-l", "shoulder-r", "elbow-l", "elbow-r", "wrist-l", "wrist-r",
      "hip-l", "hip-r", "knee-l", "knee-r", "ankle-l", "ankle-r", "heel-l", "heel-r", "toe-l", "toe-r"
    ],
    "convention": "Z up, Y forward, -X = figure's left. Pose normalized to height 1 — host applies scale + anchor. Figure walks toward +Y."
  },
  "manjiProgram": {
    "spine": {
      "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.3 }
    },
    "slots": [
      { "id": "head-crown",   "position": { "x":  0.00, "y":  0.02, "z": 0.99 } },
      { "id": "head-base",    "position": { "x":  0.00, "y":  0.02, "z": 0.85 } },
      { "id": "neck-base",    "position": { "x":  0.00, "y":  0.01, "z": 0.81 } },
      { "id": "torso-top",    "position": { "x":  0.00, "y":  0.02, "z": 0.78 } },
      { "id": "torso-base",   "position": { "x":  0.00, "y":  0.00, "z": 0.55 } },
      { "id": "pelvis-top",   "position": { "x":  0.00, "y":  0.00, "z": 0.55 } },
      { "id": "pelvis-floor", "position": { "x":  0.00, "y":  0.00, "z": 0.45 } },
      { "id": "shoulder-l",   "position": { "x": -0.18, "y":  0.02, "z": 0.78 } },
      { "id": "shoulder-r",   "position": { "x":  0.18, "y":  0.02, "z": 0.78 } },
      { "id": "elbow-l",      "position": { "x": -0.20, "y": -0.10, "z": 0.62 } },
      { "id": "elbow-r",      "position": { "x":  0.20, "y":  0.12, "z": 0.62 } },
      { "id": "wrist-l",      "position": { "x": -0.20, "y": -0.18, "z": 0.50 } },
      { "id": "wrist-r",      "position": { "x":  0.20, "y":  0.20, "z": 0.50 } },
      { "id": "hip-l",        "position": { "x": -0.09, "y":  0.06, "z": 0.47 } },
      { "id": "hip-r",        "position": { "x":  0.09, "y": -0.04, "z": 0.47 } },
      { "id": "knee-l",       "position": { "x": -0.09, "y":  0.18, "z": 0.30 } },
      { "id": "knee-r",       "position": { "x":  0.09, "y": -0.10, "z": 0.24 } },
      { "id": "ankle-l",      "position": { "x": -0.09, "y":  0.28, "z": 0.05 } },
      { "id": "ankle-r",      "position": { "x":  0.09, "y": -0.20, "z": 0.04 } },
      { "id": "heel-l",       "position": { "x": -0.09, "y":  0.25, "z": 0.00 } },
      { "id": "heel-r",       "position": { "x":  0.09, "y": -0.23, "z": 0.00 } },
      { "id": "toe-l",        "position": { "x": -0.09, "y":  0.38, "z": 0.00 } },
      { "id": "toe-r",        "position": { "x":  0.09, "y": -0.10, "z": 0.02 } }
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
        "sag": 0,
        "crossSection": "tube",
        "radius": [{ "t": 0, "r": 0.04 }, { "t": 0.5, "r": 0.038 }, { "t": 1, "r": 0.035 }],
        "ringSamples": 10,
        "style": { "fill": "#c0a890", "stroke": "#3d2a1c", "width": 0.4 }
      },
      {
        "kind": "connection",
        "from": "self/slot/elbow-r",
        "to":   "self/slot/wrist-r",
        "sag": 0,
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
        "modes": [
          { "amplitude": 0.012, "cycles": 0.5 },
          { "amplitude": 0.008, "cycles": 1.5 }
        ],
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

# Figure mid-stride (walking)

A figure caught at the moment of forward weight-transfer — left leg
planted ahead (knee slightly bent, foot flat), right leg trailing back
(ball of foot still on the ground, heel lifted), arms in contralateral
swing (right arm forward, left arm back). The torso leans gently forward,
the head looks slightly ahead.

This card is the substrate's first *asymmetric* posture. Where
`standing-figure-canonical` and `figure-orans` are bilaterally symmetric (both
arms mirror, both legs mirror), `figure-walking` breaks symmetry across
the left-right plane: hips and shoulders rotate counter to each other,
and the trailing leg's calf carries a small two-mode wave (a mode-1 ease
plus a mode-3 ripple) so the lower limb reads as relaxed rather than as
the engaged front leg's straight-line tension.

## Use when

- **Traveler scenes.** A figure walking through a landscape, crossing
  a courtyard, approaching a doorway. Implied motion without animation.
- **Pedestrian crowds.** Multiple `figure-walking` invocations at
  staggered scale + offset give a busy street or procession.
- **Action timing.** Pairing `figure-walking` next to `standing-figure-canonical`
  makes the contrast read as "one figure passing, one figure stationed"
  without prose.

## Slot semantics

Inherits the 23-landmark vocabulary. Asymmetry across landmarks:

- **Forward landmarks** (positive y): `head-crown`, `head-base`,
  `neck-base`, `torso-top`, `shoulder-l/r` — small +y offset on the
  upper body suggests forward lean.
- **Left leg forward** (large +y at lower landmarks): `hip-l`,
  `knee-l`, `ankle-l`, `heel-l`, `toe-l` step forward into the stride.
  `knee-l` is also raised (`z` ≈ 0.30) — the knee bend at peak stride.
- **Right leg back** (negative y at lower landmarks): `hip-r`, `knee-r`,
  `ankle-r`, `heel-r`, `toe-r` trail behind. `toe-r` stays near `z=0.02`
  (ball still on the ground) while `heel-r` is at z=0 — the heel-lift
  of the push-off foot.
- **Arms swing contralaterally**: right arm forward (`elbow-r`,
  `wrist-r` at +y), left arm back (`elbow-l`, `wrist-l` at -y).

## Composition examples

A single walker crossing a courtyard:

```json
{
  "tree": {
    "id": "world",
    "spine": { "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.4 } },
    "slots": [{ "id": "courtyard-center", "position": { "x": 0, "y": 0, "z": 0 } }],
    "children": [
      { "slot": "courtyard-center", "node": { "programRef": "figure-walking", "scale": 4 } }
    ]
  }
}
```

Two walkers passing each other (mirror via offset + a manual flip later):

```json
{
  "children": [
    { "slot": "a", "node": { "programRef": "figure-walking", "scale": 3 } },
    { "slot": "b", "node": { "programRef": "figure-walking", "scale": 3 } }
  ]
}
```

## Provenance and influences

The contralateral arm swing is mechanically what humans do when walking —
swinging the opposite arm forward to the leading leg keeps the body's
angular momentum balanced. Eadweard Muybridge's 1887 *Animal Locomotion*
plates broke walking into the canonical sub-poses (heel-strike,
mid-stance, toe-off, swing); this card captures the moment just before
heel-strike on the leading foot.

## Stays bespoke when

- The figure is **running** rather than walking — running pose has both
  feet off the ground at the airborne phase, knees driven much higher,
  torso forward-pitched harder. That's `figure-running` (deferred).
- The figure is **dancing**, **leaping**, or **falling** — gestural
  asymmetries those require don't come from translating walking
  landmark deltas.
- The scene needs **multiple frames of motion** to read as animation —
  the substrate is a static sampler; produce N sketches at sampled
  moments and let the consumer compose them.
