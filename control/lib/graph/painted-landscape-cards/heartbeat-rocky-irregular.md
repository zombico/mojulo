---
{
  "id": "rocky-irregular",
  "family": "heartbeat",
  "engine": "fbm",
  "aliases": ["rocky", "broken", "jagged", "scree"],
  "intent": "high-frequency rough terrain with many octaves — broken / rocky ground",
  "samples": { "u": 28, "v": 40 },
  "defaultLight": { "x": 0.50, "y": 0.60, "z": 0.60 },
  "fbm": {
    "octaves": [5, 7],
    "persistence": [0.55, 0.70],
    "lacunarity": [2.1, 2.6],
    "baseScale": [6.0, 9.0],
    "amplitude": [1.4, 2.0]
  }
}
---

# Rocky Irregular

High-octave fBm with strong persistence — small detail bumps accumulate
on top of larger crests, producing broken rocky ground rather than
smooth swells. Best paired with `bone-trio` for arid scree, `glacier-trio`
for icy crags, or `firelight-trio` for warm volcanic terrain.

The high persistence (each octave carries 55-70% of the previous
amplitude) and 5-7 octaves give visible detail at multiple scales — the
"bumpy throughout" property is most pronounced here.
