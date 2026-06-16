---
{
  "id": "mandala-helix",
  "label": "Mandala helix (spiraling stack)",
  "family": "wave-helix",
  "aliases": ["spiral stack", "helical mandala", "rising mandala", "stacked spinning ring", "spiral column", "coiled ornament", "twisted column", "helix of lobes"],
  "intents": ["helix", "spiral", "stack", "rising", "rotation", "translation", "volumetric", "rotational-symmetry"],
  "topology": {
    "primitive": "wave-manji",
    "shape": "helical-stack",
    "axes": 2,
    "rotation": "n-fold-with-drift"
  },
  "reasoningUse": [
    "a stack of N-fold mandala rings climbing along an axis while slowly rotating — the printed trail spirals as it rises",
    "use when the scene needs a column-like form whose visual signature is 'spinning while ascending' — twisted column, coiled ornament, drill bit, helical staircase",
    "the canonical translation+rotation archetype; for pure in-plane symmetry without ascent use 'mandala-six', for pure ascent without symmetry use a smooth coil"
  ],
  "boundaryContract": {
    "slots": ["center"],
    "displacement": "translation-and-rotation"
  },
  "manjiProgram": {
    "children": [
      {
        "kind": "wave-manji",
        "singularity": "self/slot/center",
        "script": "helix",
        "bending": 1.0,
        "density": 36,
        "params": {
          "N": 6,
          "radius": 1.5,
          "lobeDepth": 0.4,
          "pitch": 0.25,
          "phaseStep": 0.18,
          "axis": "normal"
        },
        "style": { "stroke": "#225", "width": 0.7 }
      }
    ]
  }
}
---

# Mandala helix (spiraling stack)

A stack of six-lobed mandala rings climbing along the singularity's
plane-normal axis. Each pass moves the loop's center up by `pitch`
world units and advances the starting phase by `phaseStep` radians, so
the lobes of consecutive rings DON'T sit directly atop one another —
the trail traces a helix.

This is the canonical *translation+rotation* archetype. The two
independent per-pass modulations (one along an axis, one around it)
are what give it volumetric character — same design rule as
`tight-vortex`, but with one axis being translation instead of plane
precession. See
[waveform-physics-design.md](../polygonizer/waveform-physics-design.md)
§5 ("rotation-axis count determines volumetric character").

## Use when

Reach for `mandala-helix` when the scene needs a column-like form
whose defining property is "rising AND rotating." Specific intents:

- **Twisted columns** — Bernini-style baroque salomonic columns,
  ornamental rope-twist colonnades, helical balusters.
- **Coiled forms** — springs, coils, drill bits (with the right
  `N` / `lobeDepth` choices), helical staircases.
- **Rising ornaments** — vertical decorations whose signature is the
  spiral path, not a static silhouette.
- **DNA-like strands** — author two `mandala-helix` cards on the same
  singularity with opposite `phaseStep` signs to get a double helix
  (plus connection leaves between corresponding lobes for the rungs).

When the form should be a single flat ring, use `mandala-six`. When
the ascent should be a tight in-plane spiral with no vertical
displacement, use `golden-spiral`. When the form should read as a 3D
ball rather than a column, use `tight-vortex`.

## Slot contract

One slot on the host: `center`. The helix climbs along the
singularity's plane-normal direction by default (which the substrate
takes from the scene's gravity, so a default scene gives a vertical
helix). Pass `params.axis` as `'uHat'`, `'vHat'`, or an explicit
`{x,y,z}` unit vector to climb along a different direction.

## Parameter tuning

- **`N`** — symmetry order of the cross-section. 6 is the default and
  reads as a rosette-like helix. Set `N=0` (or `lobeDepth=0`) for a
  smooth spring/coil.
- **`pitch`** — vertical separation between consecutive rings. Large
  pitch + low density = a sparse spring; small pitch + high density =
  a dense column.
- **`phaseStep`** — per-pass phase advance. `0` stacks the lobes
  directly atop one another (no spiral). `'golden'` (the Golden Angle)
  gives a maximally-non-repeating ascent. Small positive values like
  `0.1`–`0.3` give the classic twisted-column read.
- **`bending`** — damps `pitch` the same way it damps growth in
  rasengan/tusk. Stronger bending compresses the coil toward the
  singularity; weaker bending stretches it.
- **`density`** — total passes. Combined with pitch, determines the
  helix's full length (`extent = pitch * (density - 1)`).

## Composition example

A six-lobed twisted column rising from the world origin:

```json
{
  "tree": {
    "id": "world",
    "spine": { "bar1": { "axis": "N-S", "tails": { "N": "closed", "S": "closed" }, "lengthScale": 0.3 } },
    "anchor": { "x": 0, "y": 0, "z": 0 },
    "slots": [{ "id": "center", "position": { "x": 0, "y": 0, "z": 0 } }],
    "children": [
      { "slot": "center", "node": { "programRef": "mandala-helix" } }
    ]
  }
}
```

A double-helix DNA-like form (two strands, opposite spin):

```json
{
  "tree": {
    "id": "world",
    "spine": { "bar1": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.3 } },
    "anchor": { "x": 0, "y": 0, "z": 0 },
    "slots": [{ "id": "axis", "position": { "x": 0, "y": 0, "z": 0 } }]
  },
  "waveManji": [
    { "singularity": "world/slot/axis", "script": "helix",
      "params": { "N": 0, "radius": 1.2, "pitch": 0.3, "phaseStep": 0.3 },
      "density": 24,
      "style": { "stroke": "#a22", "width": 0.8 } },
    { "singularity": "world/slot/axis", "script": "helix",
      "params": { "N": 0, "radius": 1.2, "pitch": 0.3, "phaseStep": -0.3 },
      "density": 24,
      "style": { "stroke": "#22a", "width": 0.8 } }
  ]
}
```

## Provenance and influences

The two-modulation design rule comes from
[waveform-physics-design.md](../polygonizer/waveform-physics-design.md)
§5: forms read as volumetric when two independent per-pass modulations
combine. `tight-vortex` does this with two rotation axes; the helix
does it with one rotation axis (phase) plus one translation axis
(pitch). Both escape flatness; the helix's signature is *direction* of
motion, which the pure-rotation archetypes don't have.

## Stays bespoke when

- The helix should **change its radius along its length** (tapering
  toward a tip). Helix uses a constant radius; tapers need either a
  custom inline scaling or a follow-up `helix-tapered` archetype.
- The helix should follow a **curved spine** (a helix winding around a
  toroidal core, not a straight axis). That's the spirit of
  `smoke-ring`, not this card.
- Each cross-section ring should be a **distinct closed shape** (not
  just an N-cosine lobed circle). Mix custom `harmonics` with multiple
  orders in an inline wave-manji spec; the shelf card commits to the
  single n=N harmonic for the named "mandala helix" read.
