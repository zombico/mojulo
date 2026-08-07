---
{
  "id": "top-down-survey",
  "family": "camera",
  "aliases": ["isometric", "top-down", "overhead", "map-view"],
  "intent": "near-orthographic overhead view — VPs far apart, low verticality, map / topo feel",
  "camera": {
    "vanishingPoints": {
      "left":  [-1500, 245],
      "right": [2500, 245]
    },
    "verticalAxis": [0, -1]
  },
  "roomBasis": {
    "xRange":      [-22, 22],
    "yRange":      [-30, 12],
    "frontLeft":   [200, 470],
    "depthReach":  0.30,
    "verticalUnit": 10
  }
}
---

# Top-Down Survey

VPs pushed VERY far apart (-1500 / +2500) so the perspective approaches
isometric / orthographic. Lower `depthReach` reduces depth foreshortening
and low `verticalUnit` flattens z displacement. The result reads as a
topographic / map / survey view rather than a scene. Pairs strongly
with `topographic` renderStyle and chart-themed splatches (`chart-
primary`, `vector-cyan`) for a true cartographic feel.
