---
{
  "id": "gw150914",
  "name": "GW150914 — the first detection",
  "family": "science",
  "entry": "create_view",
  "summary": "A ready-to-mint preset: the gravity-wave kind tuned to the GW150914-like merger — the violent few-cycle chirp of two ~30-solar-mass black holes, amplitude raised so the merger flash reads.",
  "when": "show the first gravitational wave ever detected; the LIGO discovery; two black holes merging; what a chirp is"
}
---

The event that opened gravitational-wave astronomy, as a preset over the
substrate's spacetime-membrane kind: a GW150914-like binary (36 + 29 M☉),
fewer cycles and a violent high-amplitude merger, with the strain height
raised above default so the two-armed spiral and the merger flash carry to the
back of a classroom. The readout tracks the chirp mass and the GW frequency
sweeping up through inspiral → merger → ringdown.

## Recipe

```json
{
  "kind": "gravity-wave",
  "params": { "scenario": "merger", "amplitude": 1.4 },
  "title": "GW150914 — the first detection"
}
```

Pass the `kind` and `params` above to the study-object mint. Teaching
sequence: mint this beside `{ "scenario": "neutron-stars" }` — the same
physics at a fraction of the mass, many more cycles, far higher frequency.
The underlying kind's full manual is its own card (`id: 'gravity-wave'`).
