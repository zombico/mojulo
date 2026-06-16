---
{
  "id": "figure-orb",
  "label": "Figure orb (rasengan in the right hand)",
  "family": "figure-adornment",
  "aliases": ["hand-orb", "spell-orb", "rasengan-hand", "energy-ball-held", "palm-vortex", "held-spin"],
  "intents": ["orb", "spell", "energy", "ball", "rasengan", "hand", "power", "adornment", "wrist"],
  "topology": {
    "primitive": "wave-manji",
    "shape": "spiral-disc",
    "anchor": "wrist-r"
  },
  "reasoningUse": [
    "an orb of focused spin held in a figure's right hand, rendered as a rasengan wave-manji anchored at the figure's wrist-r landmark",
    "use when a figure carries or wields a focused energy — a spellcaster mid-cast, a saint with sacred fire, a mage with a contained vortex",
    "figure-adornment sibling of figure-halo; the second slot in the adornment grammar (wrist-r) tests that asymmetric landmarks anchor wave-manji as cleanly as symmetric ones"
  ],
  "boundaryContract": {
    "slots": ["wrist-r"],
    "convention": "Container preset — the orb's wave-manji singularity references `self/slot/wrist-r`, resolved against the enclosing figure card. Use `pathBindings` to mount on a different wrist or a non-figure host."
  },
  "manjiProgram": {
    "children": [
      {
        "kind": "wave-manji",
        "singularity": "self/slot/wrist-r",
        "script": "rasengan",
        "bending": 1.1,
        "plane": { "x": 0, "y": 1, "z": 0 },
        "params": { "initialRadius": 0.05, "maxRadius": 0.32, "phaseStep": 0.5, "passes": 22 },
        "samples": 56,
        "style": { "stroke": "#cf5e2a", "width": 0.6 }
      }
    ]
  }
}
---

# Figure orb (rasengan in the right hand)

A spiral disc of contained energy at a figure's right wrist, rendered as
a rasengan wave-manji whose singularity is anchored at the figure's
`wrist-r` landmark. The rasengan script winds radius outward across N
passes while rotating phase, producing the canonical contained-vortex
read — a focused orb whose center holds.

This card is the second figure-adornment, after `figure-halo`. Where the
halo tests anchoring at a *symmetric* (centerline) landmark, the orb
tests anchoring at an *asymmetric* (one-sided) landmark — the substrate
treats them identically because both are just slot positions resolved
through `host/slot/<id>` endpoint paths. The composition story is
substrate-uniform.

## Use when

- **Spellcaster figures.** A wizard, sorcerer, mage, or any figure
  mid-cast whose pose is "containing power in the hand." Pairs well
  with `standing-figure-canonical` (rooted stance) or `figure-praying-bowed`
  (focused intent).
- **Sacred-fire iconography.** A saint or deity carrying a contained
  flame, lamp-vortex, or charged sphere as their iconographic attribute.
- **Action mid-frame.** A figure whose narrative weight is in the
  *power* they're about to release. The rasengan's outward expansion
  hints at incipient discharge.

## Slot contract

One slot on the host: `wrist-r`. Mount as a slot-bound child on a figure
card's `wrist-r` slot:

```json
{
  "slot": "figure-anchor",
  "node": {
    "id": "mage",
    "programRef": "standing-figure-canonical",
    "scale": 4,
    "children": [
      { "slot": "wrist-r", "node": { "programRef": "figure-orb" } }
    ]
  }
}
```

To mount on the left wrist instead, alias the path:

```json
{ "slot": "wrist-l", "node": { "programRef": "figure-orb",
  "pathBindings": { "self/slot/wrist-r": "host/slot/wrist-l" } } }
```

## Composition examples

A mage figure casting:

```json
{
  "tree": {
    "id": "world",
    "spine": { "bar3": { "axis": "Zenith-Nadir", "tails": { "Zenith": "closed", "Nadir": "closed" }, "lengthScale": 0.4 } },
    "slots": [{ "id": "casting-pad", "position": { "x": 0, "y": 0, "z": 0 } }],
    "children": [
      { "slot": "casting-pad", "node": {
        "id": "mage", "programRef": "standing-figure-canonical", "scale": 4,
        "children": [
          { "slot": "wrist-r", "node": { "programRef": "figure-orb" } }
        ]
      }}
    ]
  }
}
```

## Provenance and influences

The held-orb iconography appears across many traditions: Christian *globus
cruciger* held by saints and emperors, Japanese onmyōji vortex-balls,
Hindu *cintamani* wish-fulfilling gems held by Bodhisattvas, and the
modern manga/anime *rasengan* spin-ball that this card directly names.
The two-stage rasengan script (initial-radius → max-radius, phase rotates
per pass) is the substrate's canonical contained-spin archetype — see
`tight-vortex` for the volumetric / golden-spin variant.

## Stays bespoke when

- The orb should be **passing between hands** or trailing motion blur —
  that's a per-frame composition, not a single static orb.
- The orb is **larger than the figure's hand can plausibly hold** —
  scale the rasengan's `maxRadius` parameter on the host scene's own
  wave-manji rather than via this card.
- The energy is **dispersing outward** rather than contained — use a
  stochastic cloud archetype instead of rasengan.
