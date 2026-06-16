---
{
  "id": "chop",
  "family": "heartbeat",
  "aliases": ["water", "sea", "choppy", "surface"],
  "intent": "multi-frequency rapid stack, water surface",
  "samples": { "u": 28, "v": 32 },
  "defaultLight": { "x": 0.20, "y": 0.20, "z": 0.95 },
  "waves": [
    { "amp": [0.4, 0.7], "cu": [1.5, 2.5], "cv": [0.3, 0.6] },
    { "amp": [0.25, 0.4], "cu": [0.3, 0.5], "cv": [2.0, 3.0] },
    { "amp": [0.12, 0.22], "cu": [3.5, 5.0], "cv": [2.5, 4.0] },
    { "amp": [0.06, 0.12], "cu": [6.0, 8.0], "cv": [4.0, 6.0] }
  ]
}
---

# Chop

A multi-frequency wave stack with rapidly-declining amplitude — the
water-surface read. Four components span swell + chop + capillary scales;
default light is nearly overhead so highlights catch crests and troughs
shadow. Best paired with `glacier-trio` for cold water, `dusk-trio` for
sunset water, or `firelight-trio` for nocturnal water with firelight.
