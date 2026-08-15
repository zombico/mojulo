---
{
  "id": "study-view",
  "name": "Mint an animated science / math / bio study object",
  "summary": "Live explainer views: physics, chemistry, astronomy, biology, mathematics.",
  "when": "\"show/teach me nuclear fission\", \"the double-slit experiment\", \"what a derivative is\", \"DNA\", \"a black hole\", \"explain photosynthesis visually\"",
  "entry": "create_view",
  "form": "view"
}
---
→ `create_view` (47 kinds; find one by intent via `semantic_search({kinds:['view_vocab']})`, read its parameter manual via `get_view_vocab`, then pass `kind` + `params`; served live at `/world`). Animated bio PROCESSES ride the same tool: DNA meiosis / conception / recombination / assortment → kind `dna-process`; the photosynthesis ⇄ respiration cycle → kind `energy-cycle`. Read the physical time-series back out in declared real units → `measure_view`. Full family → `get_creative_toolset({ form: 'view' })`.
