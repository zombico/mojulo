---
{
  "id": "stroke",
  "name": "Draw on a creature or hero to change it (an outline, a line on the skin, a brush)",
  "summary": "A drawn line on a layered solid becomes a recipe op: a closed outline solves the shape dials, a contour grows a ridge strip, a brush pushes the skin — each with the residual the grammar could not hold, shown where it was drawn.",
  "when": "\"here is the outline I want\", \"make it slimmer, like this outline of it\", \"I drew a line where the brow should be\", \"push the cheek out here\", \"trace it and match the shape\", \"I think in sketches, not dials\", \"how much of my drawing did it reach\", \"let me draw on the model\"",
  "entry": "update_sketch",
  "form": "object"
}
---
→ on an existing `layered` sketch: `update_sketch({ ref, patch: [{ op: 'set', path: '/strokes/-', value: { id, view, intent, points } }, { op: 'solve', from: '/strokes/<id>' }] })`. The stroke is view-space points in a named azimuth (`frontal`, `three-quarter`, `lateral`, …) with pressure; `intent` picks the op: `silhouette` → a dial solve (the whole solid's outline in that view; `dials: [...]` narrows), `contour` → a ridge strip along the line (`height`; `mirror: true` on the stroke twins it), `brush` → a `brush` dial (`amp`, `radius`; turn it down at `/dials/stroke.<id>`). Every solve leaves `solved` on the stroke: IoU, the RESIDUAL share and box, the dials that hit a bound — say them back as where the grammar ran short. `measure_solid` re-reads them. To let the person draw: `channels: { strokes: true }` and open the World page `/api/sketches/<ref>/world?draw=<view>`; it hands back the patch. Manual: `get_solid_vocab({ id: 'layered' })` (Drawing on it). No layered solid yet → the `creature` or `hero` card first. Full family → `get_creative_toolset({ form: 'object' })`.
