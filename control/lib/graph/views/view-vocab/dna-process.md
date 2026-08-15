---
{
  "id": "dna-process",
  "name": "DNA process (animated)",
  "family": "bio",
  "entry": "create_view",
  "summary": "An animated DNA-biology explainer — meiosis / conception / recombination / assortment — as a live orbit World; the time-based sibling of the static `dna` kind (structure).",
  "when": "Reach for this on framing like 'animate meiosis / show fertilization / how DNA recombines / independent assortment'."
}
---

An ANIMATED DNA-biology explainer served as a live, traversable World at `/api/sketches/<ref>/world` (drag to ORBIT; the animation loops). Chromosomes are taiji-lowered lit double helices (maternal = warm, paternal = cool); motion is the world's mover channel. CLICK a chromosome for a popup. Recipe-only — the substrate stores `manifest.kind === 'dna-process'` + `process` and regenerates the scene. For the STATIC double helix use the `dna` kind instead.

## Params

Per-kind knobs go in `params`; `title` / `ref` / `folder_ref` / `scene` / `viewBox` are the shared top-level view fields.

- `process` — which process to animate (default `meiosis`):
  - `meiosis` — the whole gamete-making sequence: homologous pairs cross over into mosaics, then segregate, keeping one recombined copy of each chromosome and discarding the rest.
  - `conception` — FERTILIZATION: a maternal + paternal helix converge into a homologous pair / the diploid zygote.
  - `recombination` — CROSSING-OVER: a recombined mosaic gamete is kept while the remainder is ejected as a polar body.
  - `assortment` — INDEPENDENT ASSORTMENT: four chromosome pairs each randomly keep one copy for the gamete (up) and discard the other (down).
- `scene` — optional scene options, e.g. `{ bg: "#0a0f1c" }`.
- `viewBox` — optional render size `{ width, height }` (default 1200×760).

## Worked example

```
{ kind: 'dna-process', title: 'meiosis', params: { process: 'meiosis' } }
```
