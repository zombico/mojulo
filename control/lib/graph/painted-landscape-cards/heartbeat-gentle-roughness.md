---
{
  "id": "gentle-roughness",
  "family": "heartbeat",
  "engine": "fbm",
  "aliases": ["bumpy-meadow", "soft-irregular", "natural-rolling"],
  "intent": "soft irregular terrain that scales with the quad — fBm equivalent of gentle-pulse",
  "samples": { "u": 24, "v": 36 },
  "defaultLight": { "x": 0.30, "y": 0.55, "z": 0.78 },
  "fbm": {
    "octaves": [3, 4],
    "persistence": [0.40, 0.55],
    "lacunarity": [1.9, 2.3],
    "baseScale": [8.0, 12.0],
    "amplitude": [1.0, 1.6]
  }
}
---

# Gentle Roughness

Soft, omnidirectional bumpiness with no preferred direction. Three to
four fBm octaves with moderate persistence give the surface a "rolling
hills, but actually irregular" character that reads as natural terrain
rather than the periodic-ridge look of `gentle-pulse`.

Use when the user wants gentle terrain that scales naturally with the
quad size — fBm's self-similarity property means zooming in or out
preserves the bumpiness signature. Pairs naturally with `meadow-trio`,
`verdure-trio`, or `dusk-trio`.
