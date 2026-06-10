---
{
  "id": "meadow-wild",
  "family": "scene",
  "aliases": ["meadow", "pasture", "grassland", "wildflower"],
  "intent": "grass-tuft meadow with a few broadleaf trees and scattered stones",
  "affinity": {
    "heartbeats": ["gentle-roughness", "gentle-pulse", "breathing"],
    "splatches":  ["meadow-trio", "verdure-trio", "harvest-gold"]
  },
  "fill": {
    "near": [
      { "kind": "tuft", "count": 14, "size": [0.5, 1.0] },
      { "kind": "canopy", "count": 2, "size": [2.2, 3.2] },
      { "kind": "boulder", "count": 2, "size": [0.4, 0.8] }
    ],
    "mid": [
      { "kind": "tuft", "count": 16, "size": [0.4, 0.7] },
      { "kind": "canopy", "count": 2, "size": [1.6, 2.4] }
    ],
    "far": [
      { "kind": "tuft", "count": 10, "size": [0.3, 0.5] },
      { "kind": "canopy", "count": 3, "size": [1.0, 1.6] }
    ]
  }
}
---

# Meadow Wild

A pastoral grassland. Grass tufts carry the near and mid bands (the
ground-cover read), a handful of broadleaf canopies give vertical
anchors and scale, and a couple of foreground stones break the green.
The legibility budget is spread evenly — a viewer reads "open meadow"
from the tuft density rather than from a few hero objects.

Pairs with `gentle-roughness` or `gentle-pulse` ground under
`meadow-trio` (daylight) or `harvest-gold` (late-season). Front-light so
the canopies cast onto the grass.
