---
{
  "id": "tight-vortex",
  "label": "Tight vortex (volumetric golden spin)",
  "family": "wave-spin",
  "aliases": ["volumetric spiral", "golden ball", "infinite rotation", "rasengan", "energy ball", "vortex", "spin sphere", "tusk", "phi vortex"],
  "intents": ["spin", "rotation", "volumetric", "golden-ratio", "non-repeating", "sphere", "3d-ball"],
  "topology": {
    "primitive": "wave-manji",
    "shape": "spiral",
    "axes": 2,
    "rotation": "golden"
  },
  "reasoningUse": [
    "a volumetric tusk: Golden Angle phase rotation plus per-pass plane precession at an irrational ratio, so no two passes share angle, radius, AND plane",
    "use when a scene needs a 3D ball of golden spin that reads volumetrically rather than as a flat spiral",
    "the printable analog of Steel Ball Run's 'infinite rotation' — every sample lands in a genuinely-new (angle, radius, plane) triple"
  ],
  "boundaryContract": {
    "slots": ["center"],
    "displacement": "two-axis"
  },
  "manjiProgram": {
    "children": [
      {
        "kind": "wave-manji",
        "singularity": "self/slot/center",
        "script": "tusk",
        "bending": 1.2,
        "density": 18,
        "params": { "initialRadius": 0.15 },
        "style": { "stroke": "#a60", "width": 0.8 }
      }
    ]
  }
}
---

# Tight vortex (volumetric golden spin)

A volumetric tusk: the Golden Angle drives per-pass phase rotation, φ
per revolution drives radial growth, and an irrational precession ratio
tilts the loop plane per pass so no two passes share angle, radius, AND
plane within the run.

This is the canonical *two-rotation-axis* archetype — the dimensionality
of the readable form is determined by how many independent rotation
axes the script exercises, and two axes is what makes the tusk read
volumetric rather than flat. See
[waveform-physics-design.md](../polygonizer/waveform-physics-design.md)
§5 ("rotation-axis count determines volumetric character").

## Use when

Reach for `tight-vortex` when the scene needs a 3D ball of spin that
holds its center and reads as a contained energy form. Specific
intents:

- **Energy concentrations** — abstract diagrams of focused power,
  vortices, the rasengan, an electron cloud's contained orbit.
- **Volumetric "golden" forms** — when the Golden Spin should read as
  a 3D body rather than as a flat ornament on a surface.
- **Iconic spin** — the form whose visual signature *is* "rotation as
  the thing that persists." The vortex's stable basin is when bending
  is around 1.0–1.5; outside that the form either collapses (too
  tight) or disperses (too loose).

When the form should read flat, use `golden-spiral`. When the goal is
N-fold symmetric repetition rather than continuous rotation, use
`mandala-six`.

## Slot contract

One slot on the host: `center`. Use `pathBindings` to alias if the
host's natural slot name differs.

## Composition example

```json
{
  "tree": {
    "id": "world",
    "spine": { "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.3 } },
    "anchor": { "x": 0, "y": 0, "z": 0 },
    "slots": [{ "id": "center", "position": { "x": 0, "y": 0, "z": 0 } }],
    "children": [
      { "slot": "center", "node": { "programRef": "tight-vortex" } }
    ]
  }
}
```

## Provenance and influences

The two-axis design rule and the "infinite rotation" framing come from
sitting with Hirohiko Araki's Spin power system in *Steel Ball Run*:
combining rotations on different axes is what makes the Spin transcend
its baseline form. The volumetric archetypes that already exist
(rasengan-sphere, smoke-ring, celtic torus knot, tusk) all share this
two-axis structure. See
[waveform-physics-design.md](../polygonizer/waveform-physics-design.md)
§§4–5.

## Stays bespoke when

- The form should read **flat** — that's `golden-spiral` (precess:
  false).
- The form needs to **disperse outward** rather than hold a tight
  center — use a stochastic cloud archetype, or weaken the bending.
- The vortex should have **N-fold symmetric structure** rather than
  monotonic rotation. Use `mandala-six` or a custom N-fold mandala.
