---
{
  "id": "fluted-column",
  "label": "Fluted column (Doric)",
  "family": "lathed-architecture",
  "aliases": ["doric column", "greek column", "fluted pillar", "chiseled column", "classical column", "stone column", "carved pillar", "ionic shaft"],
  "intents": ["lathed-form", "column", "architecture", "chisel", "flute", "vertical-support", "classical"],
  "topology": {
    "primitive": "lathe",
    "shape": "tapered-cylinder",
    "axis": "vertical",
    "harmonics": "24-fold-inward"
  },
  "reasoningUse": [
    "a classical Greek-style fluted column with subtle entasis — slightly wider in the middle, narrower at the top — and 24 vertical flutes carved into the shaft",
    "use when an architectural scene needs a classical column as a vertical support element — temple porticos, peristyles, colonnades",
    "the canonical chisel-via-harmonics archetype; for plain pillars use a structure-manji with role='pillar', for plain cylinders override harmonics to []"
  ],
  "boundaryContract": {
    "slots": ["top", "base"],
    "axis": "top → base",
    "harmonics": "n=24 inward fluting"
  },
  "manjiProgram": {
    "children": [
      {
        "kind": "lathe",
        "axisFrom": "self/slot/top",
        "axisTo": "self/slot/base",
        "profile": [
          { "t": 0.00, "radius": 0.42 },
          { "t": 0.35, "radius": 0.47 },
          { "t": 0.65, "radius": 0.49 },
          { "t": 1.00, "radius": 0.52 }
        ],
        "harmonics": [
          { "n": 24, "amplitude": -0.025 }
        ],
        "crossSections": 16,
        "samples": 96,
        "style": { "stroke": "#6a5f4d", "width": 0.45 }
      }
    ]
  }
}
---

# Fluted column (Doric)

A classical Greek-style column: tapered cylinder profile with subtle
entasis (the middle is very slightly wider than a straight cone would
be, by ~0.05 world units), and 24 inward flutes carved by an n=24
harmonic with negative amplitude. The flutes run vertically along the
column from top to base.

This card demonstrates the **chisel-via-harmonics** pattern: where
profile shapes the silhouette (the column's tapered cylinder), the
harmonics carve the surface (24 grooves). Negative-amplitude harmonics
cut inward — the classical concave flutes. Positive-amplitude
harmonics would reed outward, producing convex bumps instead.

## Use when

Reach for `fluted-column` when an architectural scene needs a vertical
support element with classical Greek/Roman character. Specific
intents:

- **Peristyles and porticos** — temple fronts, palace facades.
- **Colonnades** — use with `replicate.offsets` along an x-axis to
  produce a row of columns. With `scaleStep: 0.95` the columns subtly
  taper down the row, giving perspectival rhythm without needing per-
  column overrides.
- **Interior architecture** — basilica naves, atrium peristyles, side
  aisles in cathedrals.
- **Symbolic singletons** — a lone classical column as a memorial,
  ruin, or composition anchor.

When the column should be smooth (no flutes), override `harmonics: []`
at the bind site. When the column should be Ionic (volute capital),
that's a follow-up `fluted-column-ionic` card.

## Slot contract

Two slots on the host: `top` and `base`. Lathe sweeps top → base.
Use `pathBindings` to alias.

## Composition example

A row of three columns along an x-axis:

```json
{
  "tree": {
    "id": "world",
    "spine": { "bar1": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.4 } },
    "anchor": { "x": 0, "y": 0, "z": 0 },
    "slots": [
      { "id": "top",  "position": { "x": 0, "y": 0, "z": 5 } },
      { "id": "base", "position": { "x": 0, "y": 0, "z": 0 } }
    ],
    "children": [
      { "slot": "base", "node": {
        "replicate": { "offsets": [
          { "x": -4, "y": 0, "z": 0 },
          { "x":  0, "y": 0, "z": 0 },
          { "x":  4, "y": 0, "z": 0 }
        ] },
        "scaleStep": 1.0,
        "node": { "programRef": "fluted-column" }
      } }
    ]
  }
}
```

## Parameter tuning

- **Number of flutes** — override `params.harmonics[0].n`. Classical
  Doric is 20 flutes; classical Ionic is 24. The card defaults to 24.
- **Flute depth** — override `harmonics[0].amplitude`. -0.025 reads as
  subtle classical fluting; -0.05 or deeper reads as aggressive
  chiseling.
- **Taper** — adjust the radius values in the profile. The card's
  defaults (0.42 at top → 0.52 at base) read as restrained classical
  proportions.
- **Entasis bulge** — the t=0.35 / t=0.65 control points are where
  the swell occurs. Adjust their radii relative to the top/base for
  more or less classical entasis.

## Provenance and influences

The Doric order's column is the proto-typical classical column. Its
defining features — fluted shaft, subtle entasis, columnar
proportions — are precisely what the lathe primitive's profile +
harmonics + axis grammar expresses. See
[lathe-primitive.plan.md](../../../../lite-template/integration/0605/lathe-primitive.plan.md)
for the substrate.

## Stays bespoke when

- The column has a **distinctive capital** (Ionic volutes, Corinthian
  acanthus, Composite). Capitals are not rotationally-symmetric;
  they're separate ornaments that ride on top of the shaft. Future
  capital cards would pair with this column at the `top` slot.
- The column is **carved with figures** (caryatids, telamons). Figural
  columns aren't lathed forms; they're structure-manji with figure
  roles.
- The shaft has **horizontal bands** (drum-stacked stone). The substrate
  could express this via profile control points with sudden radius
  jumps, but the visual is approximate without proper banding marks.
