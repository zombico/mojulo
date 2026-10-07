---
{
  "id": "saturn-grand-tour",
  "name": "Grand tour — the ringed planets",
  "family": "science",
  "entry": "create_view",
  "summary": "A ready-to-mint preset: the saturn kind's gallery mode — every ringed planet lined up in one raytraced scene, rings casting and catching shadows.",
  "when": "show all the ringed planets together; a grand tour of the gas giants; compare Saturn's rings with Uranus and Neptune's"
}
---

A worked example over a kind the substrate already ships: the `saturn` study
object's gallery mode, which lines up the ringed planets in a single raytraced
scene — each ring system semi-transparent, casting its shadow onto its planet
and glowing where it is backlit.

This is a Door-1 recipe: pure params, nothing to load. Mint it as-is, or use
it as the starting point and tilt the inclination.

## Recipe

```json
{
  "kind": "saturn",
  "params": { "gallery": true },
  "title": "Grand tour — the ringed planets"
}
```

Pass the `kind` and `params` above to the study-object mint. The full
parameter manual for the underlying kind is its own card (`id: 'saturn'`).
