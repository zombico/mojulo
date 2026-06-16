---
{
  "id": "chalice",
  "label": "Chalice (narrow-stemmed cup)",
  "family": "lathed-vessel",
  "aliases": ["cup", "goblet", "stemware", "communion cup", "vessel", "ceremonial cup", "wine cup", "bowl on stem"],
  "intents": ["lathed-form", "vessel", "stem", "bowl", "ceremonial", "drinkware", "cup"],
  "topology": {
    "primitive": "lathe",
    "shape": "stemmed-bowl",
    "axis": "vertical",
    "profile-zones": 3
  },
  "reasoningUse": [
    "a stemmed cup or chalice — wide rounded bowl on a narrow stem, supported by a small base",
    "use when a scene needs a single ceremonial or drinking vessel as a centered object — a goblet, communion cup, or trophy cup",
    "the canonical three-zone stemmed-vessel lathe; for plain bowls without a stem see 'bowl-shallow', for tall vases see 'vase-narrow'"
  ],
  "boundaryContract": {
    "slots": ["top", "base"],
    "axis": "top → base"
  },
  "manjiProgram": {
    "children": [
      {
        "kind": "lathe",
        "axisFrom": "self/slot/top",
        "axisTo": "self/slot/base",
        "profile": [
          { "t": 0.00, "radius": 0.55 },
          { "t": 0.10, "radius": 0.60 },
          { "t": 0.25, "radius": 0.65 },
          { "t": 0.40, "radius": 0.55 },
          { "t": 0.50, "radius": 0.18 },
          { "t": 0.70, "radius": 0.12 },
          { "t": 0.85, "radius": 0.10 },
          { "t": 0.92, "radius": 0.25 },
          { "t": 1.00, "radius": 0.40 }
        ],
        "crossSections": 22,
        "samples": 36,
        "style": { "stroke": "#7a6850", "width": 0.5 }
      }
    ]
  }
}
---

# Chalice (narrow-stemmed cup)

A three-zone lathed vessel: a rounded cup at the top, a narrow stem
through the middle, and a flared foot at the base. The profile carries
the form's identity — control points define a wide bulge near the top
(the cup), a steep narrowing through the upper-middle (the neck), a
narrow constant stem through the lower-middle, and a small foot at the
base.

This is the substrate's first object-class shelf card: a lathe leaf
that ships as a named form the model can invoke by intent. Where
wave-manji archetypes are abstract spinning forms, lathed cards are
concrete classical objects.

## Use when

Reach for `chalice` when the scene needs a stemmed cup or ceremonial
vessel. Specific intents:

- **Ceremonial scenes** — altar settings, communion tables, ritual
  objects, ornament centers.
- **Tabletop arrangements** — alongside other lathed vessels (vases,
  bowls) as part of still-life compositions.
- **Trophy / award presentations** — single centered chalice as the
  focal object.
- **Architectural ornaments** — when a cathedral interior or palace
  scene needs lathed objects on altars or tables.

When a simpler bowl is needed (no stem), use `bowl-shallow` (deferred
follow-up). When a taller vase is needed (no stem narrowing), use
`vase-narrow` (deferred). When a column is needed, use `fluted-column`.

## Slot contract

Two slots on the host: `top` and `base`. The lathe sweeps from `top`
(lip of the cup) to `base` (the foot of the chalice). Use
`pathBindings` to alias if the host's natural slot names differ:

```json
{ "slot": "altar", "node": { "programRef": "chalice",
  "pathBindings": { "self/slot/top": "altar/slot/cup-top",
                    "self/slot/base": "altar/slot/cup-base" } } }
```

## Composition example

A chalice on an altar slot of a cathedral scene:

```json
{
  "tree": {
    "id": "world",
    "spine": { "bar1": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.4 } },
    "anchor": { "x": 0, "y": 0, "z": 0 },
    "slots": [
      { "id": "top",  "position": { "x": 0, "y": 0, "z": 3 } },
      { "id": "base", "position": { "x": 0, "y": 0, "z": 0 } }
    ],
    "children": [
      { "slot": "base", "node": { "programRef": "chalice" } }
    ]
  }
}
```

## Provenance and influences

The three-zone stemmed vessel is a classical form across cultures:
Western chalices, Asian stem cups, Hellenistic kraters' descendant
goblets. The substrate's profile-control-point grammar captures the
silhouette adequately for figurative rendering at this fidelity. For
specific period pieces, override the profile inline.

This is the first lathe shelf card. See
[lathe-primitive.plan.md](../../../../lite-template/integration/0605/lathe-primitive.plan.md)
for the design.

## Stays bespoke when

- The cup needs **handles** or **decorative reliefs**. The lathe
  primitive produces pure surfaces of revolution; handles and reliefs
  are radial breaks that need different primitives.
- The vessel has **inscriptions** or **figural decoration**. Same
  reason — those are not rotationally-symmetric features.
- The chalice needs an **interior cavity** rendering distinct from the
  exterior. v1 lathe renders the outer surface only.
