---
{
  "id": "contrapposto-figure-canonical",
  "label": "Contrapposto figure (S-curve, weight on one leg)",
  "family": "figure-posture",
  "aliases": ["contrapposto", "S-curve figure", "weight-shifted figure", "classical contrapposto", "polykleitos pose", "Doryphoros stance", "shifted stance"],
  "intents": ["figure", "posture", "contrapposto", "S-curve", "weight-shift", "classical-naturalism", "hellenistic", "renaissance"],
  "topology": {
    "primitive": "three-lathe-with-volumized-limbs",
    "masses": ["head", "torso", "pelvis"],
    "limbs": 11,
    "landmarks": 23
  },
  "reasoningUse": [
    "the classical S-curve standing pose with weight on the right leg, left leg relaxed and slightly bent — hips tilt right-high / left-low, shoulders counter-tilt left-high / right-low, head leans toward the high shoulder",
    "use when a figure should read with classical naturalism rather than rigid symmetry — the canonical Greco-Roman stance from Polykleitos's Doryphoros forward, the foundation of Renaissance figural art",
    "the upgrade from standing-figure-canonical when symmetry reads as too stiff for the scene"
  ],
  "boundaryContract": {
    "slots": [
      "head-crown", "head-base", "neck-base", "torso-top", "torso-base", "pelvis-top", "pelvis-floor",
      "shoulder-l", "shoulder-r", "elbow-l", "elbow-r", "wrist-l", "wrist-r",
      "hip-l", "hip-r", "knee-l", "knee-r", "ankle-l", "ankle-r", "heel-l", "heel-r", "toe-l", "toe-r"
    ],
    "convention": "Z up, Y forward, -X = figure's left. Weight on right leg (straight, ankle aligned under torso center); left leg relaxed (knee slightly forward and lower). Hip line tilts ~5° (right higher); shoulder line counter-tilts (left higher); head leans toward the high shoulder."
  },
  "manjiProgram": {
    "spine": {
      "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.3 }
    },
    "slots": [
      { "id": "head-crown",   "position": { "x": -0.02, "y":  0.00, "z": 1.00 } },
      { "id": "head-base",    "position": { "x": -0.01, "y":  0.00, "z": 0.86 } },
      { "id": "neck-base",    "position": { "x":  0.00, "y":  0.00, "z": 0.82 } },
      { "id": "torso-top",    "position": { "x":  0.00, "y":  0.00, "z": 0.78 } },
      { "id": "torso-base",   "position": { "x":  0.02, "y":  0.00, "z": 0.55 } },
      { "id": "pelvis-top",   "position": { "x":  0.02, "y":  0.00, "z": 0.55 } },
      { "id": "pelvis-floor", "position": { "x":  0.04, "y":  0.00, "z": 0.45 } },
      { "id": "shoulder-l",   "position": { "x": -0.18, "y":  0.00, "z": 0.80 } },
      { "id": "shoulder-r",   "position": { "x":  0.18, "y":  0.00, "z": 0.76 } },
      { "id": "elbow-l",      "position": { "x": -0.18, "y":  0.00, "z": 0.62 } },
      { "id": "elbow-r",      "position": { "x":  0.18, "y":  0.00, "z": 0.58 } },
      { "id": "wrist-l",      "position": { "x": -0.18, "y":  0.00, "z": 0.47 } },
      { "id": "wrist-r",      "position": { "x":  0.18, "y":  0.00, "z": 0.43 } },
      { "id": "hip-l",        "position": { "x": -0.07, "y":  0.00, "z": 0.43 } },
      { "id": "hip-r",        "position": { "x":  0.11, "y":  0.00, "z": 0.48 } },
      { "id": "knee-l",       "position": { "x": -0.06, "y":  0.04, "z": 0.22 } },
      { "id": "knee-r",       "position": { "x":  0.09, "y":  0.00, "z": 0.25 } },
      { "id": "ankle-l",      "position": { "x": -0.04, "y":  0.06, "z": 0.02 } },
      { "id": "ankle-r",      "position": { "x":  0.05, "y":  0.00, "z": 0.02 } },
      { "id": "heel-l",       "position": { "x": -0.04, "y":  0.03, "z": 0.00 } },
      { "id": "heel-r",       "position": { "x":  0.05, "y": -0.03, "z": 0.00 } },
      { "id": "toe-l",        "position": { "x": -0.04, "y":  0.14, "z": 0.00 } },
      { "id": "toe-r",        "position": { "x":  0.05, "y":  0.08, "z": 0.00 } }
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
      { "kind": "connection", "from": "self/slot/knee-l", "to": "self/slot/ankle-l",
        "modes": [{ "amplitude": 0.008, "cycles": 0.5 }], "crossSection": "tube",
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

# Contrapposto figure (S-curve, weight on one leg)

The classical *contrapposto* stance — weight borne on the right leg
(straight, ankle aligned under the torso center), left leg relaxed and
slightly bent at the knee, hips tilted (right hip raised, left hip
dropped), shoulders counter-tilted (left shoulder raised, right shoulder
dropped), head leaning slightly toward the raised shoulder. The
asymmetries together create the canonical S-curve through the spine.

This card mutates `standing-figure-canonical` along multiple landmarks:
- Hips tilt: hip-r at z=0.48 vs hip-l at z=0.43 (~5° tilt)
- Shoulders counter-tilt: shoulder-l at z=0.80 vs shoulder-r at z=0.76
- Left leg's knee shifts forward (y=+0.04) and lower (z=0.22), left ankle
  shifts forward (y=+0.06) — the leg reads as relaxed rather than
  weight-bearing
- Right leg pulls inward and straight under the torso (ankle-r at x=0.05
  vs canonical x=0.09) so the figure's weight column is centered
- Pelvis-floor shifts slightly right (x=+0.04) — the pelvis as a whole
  follows the weight-bearing leg
- Head leans toward the raised left shoulder (head-crown at x=-0.02)

A small mode-1 displacement on the left lower-leg ribbon reads as the
relaxed-leg soft tension.

## Use when

- **Classical figural composition.** A scene that wants Greco-Roman or
  Renaissance figural naturalism — a hero, a god, a saint, an allegorical
  personification standing with weight on one leg.
- **Upgrade from standing-canonical.** When the rigid symmetry of
  [[standing-figure-canonical]] reads as too stiff for the narrative
  weight of the figure. Contrapposto suggests inhabitation, breath,
  living balance.
- **Sculpture-emulation scenes.** Free-standing figures in a peristyle,
  in a niche, on a pedestal — the contrapposto is what makes the
  figure look *sculptural* rather than diagrammatic.

When the figure is in **action** (mid-stride, gesturing dynamically),
use [[figure-walking]] or a bespoke action pose. When **strictly
symmetric authority** is the intent, return to
[[standing-figure-canonical]].

## Composition examples

A contrapposto figure on a pedestal:

```json
{
  "tree": {
    "id": "world",
    "spine": { "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.4 } },
    "slots": [{ "id": "pedestal-top", "position": { "x": 0, "y": 0, "z": 0 } }],
    "children": [
      { "slot": "pedestal-top", "node": { "programRef": "contrapposto-figure-canonical", "scale": 4 } }
    ]
  }
}
```

A hero with halo and orb:

```json
{
  "children": [{
    "slot": "hero-pad", "node": {
      "id": "hero",
      "programRef": "contrapposto-figure-canonical", "scale": 4,
      "children": [
        { "slot": "head-crown", "node": { "programRef": "figure-halo" } },
        { "slot": "wrist-r",    "node": { "programRef": "figure-orb" } }
      ]
    }
  }]
}
```

## Provenance and influences

The contrapposto stance is named for and originated in the Greek
classical canon — Polykleitos's *Doryphoros* (c. 440 BCE) is the
foundational example, codified in his (lost) treatise *Kanon*. The
hellenistic, Roman, Romanesque, Byzantine, and Renaissance figural
traditions all use contrapposto as the default standing pose for figures
with narrative weight. Michelangelo's *David*, Donatello's *David*, and
countless saintly portraits depend on the S-curve to read as alive
rather than emblematic.

The structural insight the contrapposto codifies: a body at rest is
NOT bilaterally symmetric because gravity loads one leg at a time.
Symmetric standing reads as *military* or *emblematic*; asymmetric
standing reads as *living*.

## Stays bespoke when

- The figure is **in motion** — contrapposto is a *static* asymmetric
  pose. Walking, leaping, twisting need bespoke landmark sequences.
- The pose is **mannerist exaggeration** of contrapposto (the
  figura serpentinata of Giambologna, late Michelangelo) — those
  amplifications go beyond the moderate tilt this card encodes.
- The figure is **wearing heavy drapery** that itself defines the
  silhouette — the contrapposto's body-silhouette reading is less
  visible under classical drapery, and the drape itself becomes the
  pose's primary signature.
