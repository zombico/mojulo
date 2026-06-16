---
{
  "id": "low-angle-hero",
  "family": "camera",
  "aliases": ["hero", "low-angle", "epic", "looking-up"],
  "intent": "low camera looking up — horizon high, dramatic vertical exaggeration",
  "camera": {
    "vanishingPoints": {
      "left":  [-220, 195],
      "right": [1180, 195]
    },
    "verticalAxis": [0, -1]
  },
  "roomBasis": {
    "xRange":      [-18, 18],
    "yRange":      [-28, 8],
    "frontLeft":   [210, 580],
    "depthReach":  0.46,
    "verticalUnit": 48
  }
}
---

# Low-Angle Hero

Camera sits low looking up — horizon pushed high in the frame (VPs at
y=195 instead of 245), front edge pushed even lower (y=580). The big
move is `verticalUnit: 48` (almost double the default), which dramatizes
z displacement so structures and high terrain features tower above the
camera. Use for monument cards (`monument-row`, `village-cluster`)
where you want the structures to read as heroic / monumental.
