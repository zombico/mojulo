---
{
  "id": "exhibit",
  "name": "Make an exhibit: an animated science, space, earth, life or math study object",
  "summary": "Live explainer exhibits, asked for by hall: physics and chemistry, the sky, water and weather, cells and DNA, mathematics; for a class, a kid, a museum or an encyclopedia.",
  "when": "\"show/teach me nuclear fission\", \"the double-slit experiment\", \"what a derivative is\", \"DNA\", \"a black hole\", \"explain photosynthesis visually\", \"a museum exhibit about how a dam makes electricity\", \"an interactive for our science gallery\"",
  "entry": "create_exhibit",
  "form": "exhibit"
}
---
→ `create_exhibit({ id: '<hall>/<id>', params })`, served live at `/world`. Halls: science, space, earth, life, math, history. Find one by intent via `semantic_search({kinds:['view_vocab']})` (a hit's bare id resolves) or `get_exhibit({ hall })`; read its manual with `get_exhibit({ id })` before passing `params`. Animated bio PROCESSES: `life/dna-process` (meiosis, conception, recombination, assortment), `life/energy-cycle` (photosynthesis ⇄ respiration). The teacher's own setup, or a demo no exhibit covers, is composed from laws: `science/classical`, `science/microscopic`, `science/quantum` (exact orbitals: prefer it to `science/atom`), `science/relativistic`. Read the physical time series back in declared real units → `get_exhibit({ ref })`. A historic city at its period → `history/<culture>`. Steps a visitor clicks through, each a camera, a caption and the part it lights → `tour` (manual: `get_view_vocab({ id: 'tour' })`). Keep a tuned setup → `save_recipe`. Full family → `get_creative_toolset({ form: 'exhibit' })`.
