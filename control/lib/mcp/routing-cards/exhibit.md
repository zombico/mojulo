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
→ `create_exhibit({ id: '<hall>/<id>', params })`, served live at `/world`. Halls: science, space, earth, life, math, history. Find one with `semantic_search({kinds:['view_vocab']})` (a hit's bare id resolves) or `get_exhibit({ hall })`; read its manual, `get_exhibit({ id })`, before `params`. Bio PROCESSES: `life/dna-process` (meiosis, conception, recombination, assortment), `life/energy-cycle`. A demo no exhibit covers is composed from laws: `science/classical`, `science/microscopic`, `science/quantum` (exact orbitals: not `science/atom`), `science/relativistic`. Its time series in real units → `get_exhibit({ ref })`. A historic city → `history/<culture>`. Stops a visitor steps through (a camera, a caption, the part lit) → `tour` (manual `get_view_vocab({ id: 'tour' })`). Several made exhibits as one gallery, a kiosk too → `create_exhibit({ rooms: [refs] })`; its check → `get_exhibit({ ref, audit: true })`. Keep a setup → `save_recipe`. Full family → `get_creative_toolset({ form: 'exhibit' })`.
