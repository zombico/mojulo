---
{
  "id": "motion-deck",
  "name": "Put info in motion — slideshow deck",
  "summary": "Ordered sketches/charts played as a paced slideshow with staged reveals.",
  "when": "\"play these charts\", \"present these charts one after another\", \"step through the slides with build-in reveals\", \"a slideshow\", \"a deck\", \"an explainer\", \"a report in motion\", \"walk through these KPIs\", \"present this visually in sequence\"",
  "entry": "forge_motion",
  "form": "motion"
}
---
→ `forge_motion` DECK family: `subject.deck` (ordered `sk_…` sketch refs and/or inline manifests, ≥2) or `subject.stash_ref` (a stash's `sketch`-typed items, in gather order) with `shot.motion:'deck'`. A slide's marks carry `reveal:{step,…}` to BUILD in sequence — graduated, paced disclosure for charts / diagrams / text. FORKS: a concept that IS a 3D object needing rotation (molecule / lattice / mechanism) → the CAMERA family; a SINGLE convex solid → `create_solid_turntable`; one animate-annotated slide (`animate:{channel:…}`) renders smooth 2D motion live. Limits: no sound; smooth motion across a multi-slide deck stays staged. Full family → `get_creative_toolset({ form: 'motion' })`.
