---
{
  "id": "pine-forest",
  "family": "scene",
  "aliases": ["forest", "conifers", "woods", "taiga"],
  "intent": "dense conifer stand thinning to a far ridgeline",
  "affinity": {
    "heartbeats": ["rocky-irregular", "gentle-roughness", "glacial-smooth"],
    "splatches":  ["verdure-trio", "meadow-trio", "glacier-trio"]
  },
  "fill": {
    "near": [
      { "kind": "cone", "count": 9, "size": [1.6, 2.8] },
      { "kind": "boulder", "count": 2, "size": [0.5, 0.9] }
    ],
    "mid": [
      { "kind": "cone", "count": 13, "size": [1.0, 1.8] }
    ],
    "far": [
      { "kind": "cone", "count": 18, "size": [0.6, 1.1] }
    ]
  }
}
---

# Pine Forest

A conifer biome. Cones cluster densely in the near band, thin through the
mid band, and scatter as a fine far ridgeline so the treeline breaks the
horizon. A couple of near boulders give foreground scale. The legibility
budget is front-loaded — a viewer reads "forest" from the dense near
stand, and the receding count sells depth.

Pairs with `rocky-irregular` or `gentle-roughness` ground under
`verdure-trio` (lush) or `glacier-trio` (subalpine). Front-light the
scene (`light.y` positive) so the cones catch the sun against shadowed
slopes.
