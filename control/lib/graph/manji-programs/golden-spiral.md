---
{
  "id": "golden-spiral",
  "label": "Golden spiral (flat)",
  "family": "wave-spin",
  "aliases": ["phi spiral", "golden rectangle spiral", "logarithmic spiral", "phyllotaxis spiral", "nautilus curve", "fibonacci spiral", "golden angle spiral"],
  "intents": ["spin", "rotation", "spiral", "golden-ratio", "non-repeating", "flat"],
  "topology": {
    "primitive": "wave-manji",
    "shape": "spiral",
    "axes": 1,
    "rotation": "golden"
  },
  "reasoningUse": [
    "a flat logarithmic spiral with Golden Angle phase rotation and phi-factor radius growth — the printable analog of phyllotaxis or the Golden Rectangle's spiral",
    "use when a scene needs a single in-plane spinning form that reads as a spiral without any volumetric depth",
    "the canonical 'spin without depth' archetype; for a volumetric tusk see 'tight-vortex'"
  ],
  "boundaryContract": {
    "slots": ["center"],
    "displacement": "in-plane"
  },
  "manjiProgram": {
    "children": [
      {
        "kind": "wave-manji",
        "singularity": "self/slot/center",
        "script": "tusk",
        "bending": 1.2,
        "density": 18,
        "params": { "initialRadius": 0.15, "precess": false },
        "style": { "stroke": "#a60", "width": 0.9 }
      }
    ]
  }
}
---

# Golden spiral (flat)

A flat logarithmic spiral using the Golden Angle for per-pass phase
rotation and φ-per-revolution for radial growth — the printable analog
of the Golden Rectangle's spiral and the phyllotaxis distribution
plants use to place leaves so no leaf shadows another.

This is the canonical "spin without depth" archetype: one rotation axis
(in-plane phase rotation), no plane precession, so the form sits cleanly
on the page rather than reading as a 3D ball. For the volumetric
counterpart, see `tight-vortex`.

## Use when

Reach for `golden-spiral` when the scene needs a single spiraling form
that reads as motion or growth without volumetric depth. Specific
intents:

- **Phyllotaxis-style growth** — plant arrangements, scale patterns,
  shell cross-sections, anything where the Golden Angle distribution is
  the literal subject.
- **Flat ornamentation** — corner flourishes, page anchors, mandala
  centers, anywhere a single in-plane spiral is the right grammar.
- **Diagrams of rotation** — when you want to *show* the Golden Spin
  itself: the maximally-non-repeating angular distribution made
  visible as a spiral.

When the form should read as a 3D ball, use `tight-vortex`. When you
want N-fold symmetric repetition rather than a spiral, use
`mandala-six`. When the rotation should disperse outward rather than
hold a center, use a stochastic cloud archetype.

## Slot contract

One slot on the host: `center`. Use `pathBindings` to alias if the
host's natural slot name differs:

```json
{ "slot": "fill", "node": { "programRef": "golden-spiral",
  "pathBindings": { "self/slot/center": "world/slot/anchor" } } }
```

## Composition example

```json
{
  "tree": {
    "id": "world",
    "spine": { "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.3 } },
    "anchor": { "x": 0, "y": 0, "z": 0 },
    "slots": [{ "id": "center", "position": { "x": 0, "y": 0, "z": 0 } }],
    "children": [
      { "slot": "center", "node": { "programRef": "golden-spiral" } }
    ]
  }
}
```

## Provenance and influences

Hirohiko Araki's "Spin" power system in *Steel Ball Run* names rotation
around a still center as the principle that lets a finite form
*persist without losing its character*. The Golden Angle (`2π × (1 −
1/φ)` ≈ 137.5°) is the printable analog: within finite passes no two
land in the same angular position relative to any prior, so the form
is alive at every sample because no sample is a repeat. See
[waveform-physics-design.md](../polygonizer/waveform-physics-design.md)
§4 ("The fourth quality: golden") and §5 (Tusk archetype).

## Stays bespoke when

- The spiral should read as a **3D ball or lens** — that's
  `tight-vortex`'s territory (precess: true).
- The form needs **strong directional drift** (the spiral is being
  pulled to one side). Bending is isotropic; directional drift needs a
  custom plane override or a scene-level ambient field.
- The spiral has **N-fold rotational symmetry** rather than monotonic
  rotation. Use `mandala-six` or a custom N-fold mandala instead.
