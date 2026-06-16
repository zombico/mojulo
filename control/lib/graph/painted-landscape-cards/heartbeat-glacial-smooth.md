---
{
  "id": "glacial-smooth",
  "family": "heartbeat",
  "engine": "fbm",
  "aliases": ["smooth", "polished", "windswept", "tundra"],
  "intent": "low-octave smooth terrain with broad features only — windswept / glaciated",
  "samples": { "u": 20, "v": 30 },
  "defaultLight": { "x": 0.20, "y": 0.40, "z": 0.90 },
  "fbm": {
    "octaves": [2, 3],
    "persistence": [0.25, 0.40],
    "lacunarity": [2.0, 2.4],
    "baseScale": [14.0, 20.0],
    "amplitude": [1.2, 1.8]
  }
}
---

# Glacial Smooth

Low-octave, low-persistence fBm with a wide base scale. The result is
broad smooth swells with very little high-frequency detail — a glaciated
or wind-polished surface, or a tundra plain. The high z-component on
default light keeps highlights mostly on broad upward faces rather than
emphasizing slope direction.

Best paired with `glacier-trio` or `bone-trio`. Demonstrates the lower
end of fBm's roughness spectrum — close to the look of a single low-
frequency sine but without the periodicity.
