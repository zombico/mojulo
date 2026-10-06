---
{
  "id": "eht-shadow",
  "name": "The photon-ring shadow (EHT)",
  "family": "science",
  "entry": "create_view",
  "summary": "A ready-to-mint preset: the black-hole kind face-on in 'eht' mode — the photon ring and central shadow of the Event Horizon Telescope images, with the Doppler-bright side explained.",
  "when": "show the first picture of a black hole; the M87 image; why the ring is brighter on one side; what the black hole shadow actually is"
}
---

The Event Horizon Telescope's famous image, as a preset over the substrate's
ray-traced black-hole kind: fairly face-on, so the lensed accretion disk
closes into the PHOTON RING around the central shadow — light that orbited the
hole before escaping. One side burns brighter than the other: the disk's
inner edge moves at a good fraction of c, and relativistic Doppler beaming
boosts the approaching side. That asymmetry is in the real M87* image, and
it is how we read the disk's rotation direction off a photograph.

## Recipe

```json
{
  "kind": "black-hole",
  "params": { "scenario": "eht", "beta": 0.6 },
  "title": "The photon-ring shadow (EHT)"
}
```

Pass the `kind` and `params` above to the study-object mint. Teaching
sequence: mint this beside `{ "scenario": "interstellar" }` — the same object
near edge-on, where lensing throws the disk's far side into arcs over and
under the hole. The underlying kind's full manual is its own card
(`id: 'black-hole'`).
