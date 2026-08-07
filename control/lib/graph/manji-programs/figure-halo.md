---
{
  "id": "figure-halo",
  "label": "Figure halo (mandala ring above head)",
  "family": "figure-adornment",
  "aliases": ["halo", "nimbus", "saint-halo", "ring-above-head", "head-mandala"],
  "intents": ["halo", "nimbus", "sanctity", "iconography", "saint", "divine", "adornment", "head"],
  "topology": {
    "primitive": "wave-manji",
    "shape": "n-fold-ring",
    "anchor": "head-crown"
  },
  "reasoningUse": [
    "a circular halo above a figure's head, rendered as an N-fold mandala wave-manji anchored at the figure's head-crown landmark",
    "use to mark a figure as a saint, holy person, or otherwise sanctified — the canonical iconographic halo across Christian, Buddhist, and Hindu traditions",
    "the first figure-adornment card; mounts on any figure posture card (standing-figure-canonical, figure-orans, figure-praying-bowed, figure-walking) via a child slot binding on head-crown"
  ],
  "boundaryContract": {
    "slots": ["head-crown"],
    "convention": "Container preset — the halo's wave-manji singularity references `self/slot/head-crown`, resolved against the enclosing figure card."
  },
  "manjiProgram": {
    "children": [
      {
        "kind": "wave-manji",
        "singularity": "self/slot/head-crown",
        "script": "mandala",
        "bending": 1.0,
        "plane": { "x": 0, "y": 1, "z": 0 },
        "params": { "N": 12, "radius": 0.45, "lobeDepth": 0.10 },
        "samples": 80,
        "style": { "stroke": "#b89a3a", "width": 0.7 }
      }
    ]
  }
}
---

# Figure halo (mandala ring above head)

A circular halo painted above a figure's head, rendered as an N-fold
mandala wave-manji whose singularity is anchored at the figure's
`head-crown` landmark. The 12-fold modulation reads as a softly-lobed
ring rather than a perfect circle, giving the halo a worked / iconographic
quality without bespoke vocabulary.

This card is the substrate's first figure-adornment — a *container preset*
that ships only a wave-manji child referencing `self/slot/head-crown`.
The walker inlines that child at the calling site, leaving the enclosing
figure card in scope as `self`, so the halo's singularity resolves to
whatever figure invoked it. The same card mounts on any figure posture
(`standing-figure-canonical`, `figure-orans`, `figure-praying-bowed`,
`figure-walking`) without modification.

## Use when

- **Iconographic figures.** A saint, prophet, deity, or other sanctified
  figure where the halo is the conventional marker of holiness.
- **Compositional emphasis.** A figure the scene wants the viewer's eye
  to settle on — the halo adds visual weight at the head and grounds
  the figure as the focal subject.
- **Group iconography.** A row of standing figures where one or more
  is haloed — pairs with `standing-figure-canonical` or `figure-orans` for
  altar scenes, processions, the Cosmati pavement convention.

## Slot contract

One slot on the host: `head-crown`. Mount the halo as a slot-bound child
on a figure card's `head-crown` slot:

```json
{
  "slot": "figure-anchor",
  "node": {
    "id": "saint",
    "programRef": "figure-orans",
    "scale": 4,
    "children": [
      { "slot": "head-crown", "node": { "programRef": "figure-halo" } }
    ]
  }
}
```

If the host's landmark name differs (e.g. a non-figure host using `crown`
instead of `head-crown`), attach `pathBindings`:

```json
{ "slot": "head-crown", "node": { "programRef": "figure-halo",
  "pathBindings": { "self/slot/head-crown": "host/slot/crown" } } }
```

## Composition examples

A haloed orans figure as a sanctuary center:

```json
{
  "tree": {
    "id": "world",
    "spine": { "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.4 } },
    "slots": [{ "id": "sanctuary-center", "position": { "x": 0, "y": 0, "z": 0 } }],
    "children": [
      { "slot": "sanctuary-center", "node": {
        "id": "saint", "programRef": "figure-orans", "scale": 4,
        "children": [
          { "slot": "head-crown", "node": { "programRef": "figure-halo" } }
        ]
      }}
    ]
  }
}
```

## Provenance and influences

The halo / nimbus has continuous iconographic history across Greco-Roman
solar-disc imagery, early Christian saint portraits, Byzantine icons,
Buddhist Bodhisattva mandalas, and Hindu devata imagery — every major
sacred-art tradition reached for "a circular field above the head" as
the shorthand for sanctity. This card's 12-fold lobed reading approximates
the Byzantine *cosmatesque* halo idiom; for a smooth-rim halo, override
`params.lobeDepth` to 0.

## Stays bespoke when

- The halo should be **flat-disc** rather than a ring — that's a
  polygon mark, not a wave-manji ring; mint inline.
- The figure has **multiple haloes** or radial-ray emanations behind
  the body. Multi-element divine staging needs additional adornment
  cards.
- The halo is **inscribed with text or symbols.** Inscription is out
  of the wave-manji vocabulary.
