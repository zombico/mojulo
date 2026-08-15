---
{
  "id": "energy-cycle",
  "name": "Energy cycle (photosynthesis ⇄ respiration)",
  "family": "bio",
  "entry": "create_view",
  "summary": "The photosynthesis ⇄ respiration loop linking plant and animal cells — chloroplast + mitochondrion on a timed reaction cascade — as a live orbit World.",
  "when": "Reach for this on framing like 'show the energy cycle / photosynthesis and respiration / how plants and animals exchange CO₂ and O₂'."
}
---

An interactive 3D ENERGY CYCLE — the photosynthesis ⇄ respiration loop that links plant and animal cells — served as a live traversable World at `/api/sketches/<ref>/world` (drag to ORBIT). A CHLOROPLAST (green, grana stacks) runs photosynthesis (6 CO₂ + 6 H₂O + light → glucose + 6 O₂); a MITOCHONDRION (orange, crista fold) runs respiration (glucose + 6 O₂ → 6 CO₂ + 6 H₂O + ATP). Molecules (CPK ball-and-stick) flow along two arcs on a TIMED reaction cascade: a product only appears once the reaction that makes it has run, then is consumed by the next organelle (or ATP stays as delivered energy). CLICK an organelle or molecule for a popup (reaction, where it's found). Both organelles sit in a plant cell; an animal cell has only the mitochondrion — so the loop is plant↔animal. Recipe-only — the substrate stores `manifest.kind === 'energy-cycle'` and regenerates the scene.

## Params

Per-kind knobs go in `params`; `title` / `ref` / `folder_ref` / `scene` / `viewBox` are the shared top-level view fields.

- `speed` — animation speed multiplier on the reaction timeline (0.25–4; default 1; higher = faster cascade).
- `scene` — optional scene options, e.g. `{ bg: "#070b16" }`.
- `viewBox` — optional render size `{ width, height }` (default 1240×720).

## Worked example

```
{ kind: 'energy-cycle', title: 'photosynthesis ⇄ respiration', params: { speed: 1 } }
```
