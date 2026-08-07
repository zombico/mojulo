---
{
  "id": "coastal-rocks",
  "family": "scene",
  "aliases": ["coast", "shore", "rocky-shore", "headland"],
  "intent": "boulder-strewn shoreline thinning to a rocky far margin",
  "affinity": {
    "heartbeats": ["chop", "rocky-irregular", "glacial-smooth"],
    "splatches":  ["mist-coastal", "glacier-trio", "bone-trio"]
  },
  "fill": {
    "near": [
      { "kind": "boulder", "count": 6, "size": [0.9, 1.8] },
      { "kind": "tuft", "count": 6, "size": [0.4, 0.8] }
    ],
    "mid": [
      { "kind": "boulder", "count": 8, "size": [0.6, 1.2] },
      { "kind": "tuft", "count": 6, "size": [0.3, 0.6] }
    ],
    "far": [
      { "kind": "boulder", "count": 10, "size": [0.4, 0.8] }
    ]
  }
}
---

# Coastal Rocks

A rocky shoreline. Boulders dominate every band — large in the
foreground, shrinking to a fine far margin so the rocky edge reads
against the surface behind it. Sparse sea-grass tufts soften the near
and mid bands without competing with the stone.

Pairs with `chop` (water surface) or `rocky-irregular` ground under
`mist-coastal` (fog) or `glacier-trio` (cold). Overcast, low-contrast
light suits the coastal read — keep `light.z` high for flat illumination.
