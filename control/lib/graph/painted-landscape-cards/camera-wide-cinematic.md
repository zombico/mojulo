---
{
  "id": "wide-cinematic",
  "family": "camera",
  "aliases": ["panoramic", "wide", "letterbox", "establishing-wide"],
  "intent": "panoramic wide-angle establishing — VPs far apart, deeper room, gentler verticality",
  "camera": {
    "vanishingPoints": {
      "left":  [-600, 280],
      "right": [1560, 280]
    },
    "verticalAxis": [0, -1]
  },
  "roomBasis": {
    "xRange":      [-24, 24],
    "yRange":      [-32, 8],
    "frontLeft":   [120, 540],
    "depthReach":  0.55,
    "verticalUnit": 18
  }
}
---

# Wide Cinematic

VPs spread wide for a panoramic letterbox feel, deeper world bounds
(x ∈ [-24, 24], y ∈ [-32, 8]) for a more expansive scene. Reduced
`verticalUnit` keeps z displacement modest so the scene reads horizontal
rather than mountainous. Pairs naturally with cinematic splatches
(`velvet-cinema`, `harvest-gold`, `mist-coastal`) under `painterly`.
