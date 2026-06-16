---
{
  "id": "mandala-six",
  "label": "Mandala (six-fold)",
  "family": "wave-symmetry",
  "aliases": ["six-fold mandala", "hexagonal mandala", "rose window", "snowflake", "hex symmetry", "rosette", "6-fold rotational symmetry"],
  "intents": ["mandala", "symmetry", "rotational-symmetry", "ornament", "centered", "flat"],
  "topology": {
    "primitive": "wave-manji",
    "shape": "rosette",
    "axes": 1,
    "rotation": "n-fold"
  },
  "reasoningUse": [
    "a six-fold rotationally symmetric mandala with lobed harmonic content — a single closed loop carrying an n=6 cosine harmonic so six evenly-spaced lobes align across the ring",
    "use when the scene needs a centered ornament with N-fold rotational symmetry — rose windows, snowflake forms, hex rosettes",
    "the canonical N-fold symmetry archetype; for continuous rotation see 'golden-spiral' or 'tight-vortex'"
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
        "script": "mandala",
        "params": { "N": 6, "radius": 4, "lobeDepth": 0.6 },
        "style": { "stroke": "#22a", "width": 1.0 }
      }
    ]
  }
}
---

# Mandala (six-fold)

A single closed loop carrying an n=6 cosine harmonic, so the ring
carves into six evenly-spaced lobes that align across passes. The
canonical rotational-symmetry archetype: where `golden-spiral` and
`tight-vortex` are about *continuous* rotation (every angle a new
angle), `mandala-six` is about *discrete* rotational symmetry
(everything occupies one of N slots).

## Use when

Reach for `mandala-six` when the scene needs a centered ornament whose
defining property is six-fold (or N-fold, via parameter override)
rotational symmetry. Specific intents:

- **Ornamental centers** — rose windows, ceiling medallions, floor
  medallions, the central anchor of a circular composition.
- **Snowflake / crystalline forms** — six-fold is the default natural
  symmetry for ice and many minerals.
- **Architectural rosettes** — the hex grammar at the center of a
  cathedral nave's transept ceiling, the heart of a tile pattern.
- **Symbolic centeredness** — the mandala-as-meaning use case, where
  the visual reads as "balanced," "complete," "centered."

When the desired form is a *continuous* spiral, use `golden-spiral`
(flat) or `tight-vortex` (volumetric). When the symmetry order
should be different, override `params.N` at the bind site.

## Slot contract

One slot on the host: `center`. Use `pathBindings` to alias if the
host's natural slot name differs.

## Composition example

A mandala-six centered in a flat scene:

```json
{
  "tree": {
    "id": "world",
    "spine": { "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.3 } },
    "anchor": { "x": 0, "y": 0, "z": 0 },
    "slots": [{ "id": "center", "position": { "x": 0, "y": 0, "z": 0 } }],
    "children": [
      { "slot": "center", "node": { "programRef": "mandala-six" } }
    ]
  }
}
```

## Provenance and influences

The mandala archetype is the substrate's named N-fold rotational
symmetry: a single ring with the n=N cosine harmonic carving the
lobes. Six is the default because hexagonal symmetry is the
densest-packing rotational symmetry in 2D and reads as "natural" across
the widest range of contexts (snowflakes, honeycombs, rose windows,
many mandala traditions). See
[waveform-physics-design.md](../polygonizer/waveform-physics-design.md)
§5 (the "mandala" archetype).

## Stays bespoke when

- The composition needs **multiple nested rings** of differing
  symmetry orders (a 6/12/24 onion of mandalas). Author multiple
  wave-manji leaves with shared `self/slot/center` and different `N` or
  `radius` values.
- The symmetry is **broken** (a six-fold mandala with one lobe taller).
  The substrate's mandala harmonic is rigidly N-symmetric; broken
  symmetry needs a custom inline `harmonics` list with mixed orders.
- The ornament is **architectural rather than wave-borne** (every spoke
  is a manji bar, not a wave harmonic). Use a structural manji-program
  with N children instead.
