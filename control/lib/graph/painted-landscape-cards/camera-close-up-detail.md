---
{
  "id": "close-up-detail",
  "family": "camera",
  "aliases": ["close-up", "tight", "detail"],
  "intent": "tight composition for detail — narrower VPs, smaller world bounds, taller verticality",
  "camera": {
    "vanishingPoints": {
      "left":  [50, 220],
      "right": [950, 220]
    },
    "verticalAxis": [0, -1]
  },
  "roomBasis": {
    "xRange":      [-12, 12],
    "yRange":      [-18, 8],
    "frontLeft":   [260, 500],
    "depthReach":  0.40,
    "verticalUnit": 32
  }
}
---

# Close-Up Detail

VPs much closer together for sharper foreshortening; smaller world
bounds so the same heartbeat samples produce more visible structure per
unit screen. Higher `verticalUnit` emphasizes z displacement. Use for
near-field close inspection of a heartbeat's character (good for
showing off `rocky-irregular` or `ridge-step`).
