---
{
  "id": "quantum-buildup",
  "name": "Quantum buildup — one particle at a time",
  "family": "science",
  "entry": "create_view",
  "summary": "A ready-to-mint preset: the double-slit kind in 'particles' mode — individual quantum hits accumulating one by one into the interference fringes no single particle explains.",
  "when": "show that single particles interfere with themselves; the double slit one electron at a time; wave-particle duality demonstration; the quantum measurement classic"
}
---

The deepest version of the double-slit experiment, as a preset: not the wave
picture, but PARTICLES — single quanta arriving one at a time as individual
hits on the screen, each landing somewhere apparently random, the interference
fringes emerging only from the accumulation. The single most famous
demonstration that each particle interferes with itself.

## Recipe

```json
{
  "kind": "double-slit",
  "params": { "scenario": "particles" },
  "title": "Quantum buildup — one particle at a time"
}
```

Pass the `kind` and `params` above to the study-object mint. Teaching
sequence: mint the wave picture first (`{ "scenario": "double" }`), then this
— same slits, same fringes, utterly different ontology. The underlying kind's
full manual is its own card (`id: 'double-slit'`).
