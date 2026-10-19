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
→ `create_view` (find a kind by intent via `semantic_search({kinds:['view_vocab']})`, read its parameter manual via `get_view_vocab`, then pass `kind` + `params`; served live at `/world`). Animated bio PROCESSES ride the same tool: DNA meiosis / conception / recombination / assortment → kind `dna-process`; the photosynthesis ⇄ respiration cycle → kind `energy-cycle`. The teacher's own setup, or a demo no kind covers → kind `classical` composes it from Newton's laws, kind `microscopic` from molecules diffusing, crossing membranes and reacting, kind `quantum` from wells, barriers, hydrogen orbitals, spin and decay (exact and sourced: prefer it to `atom` for an orbital). Read the physical time-series back out in declared real units → `measure_view`. Full family → `get_creative_toolset({ form: 'view' })`.
