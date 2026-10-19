---
{
  "id": "science-world",
  "name": "Compose a physics, cell-and-molecule or quantum demo from laws",
  "summary": "A simulation built from laws for a class or a question no ready-made experiment covers: Newton's laws (classical), molecules diffusing, crossing membranes and reacting (microscopic), or wells, tunnelling, orbitals, spin and decay (quantum); checked against conservation laws and the textbook answer.",
  "when": "\"a demo for my class of a ball on a spring in thick oil\", \"simulate two moons around a planet\", \"what if the pendulum started from the side\", \"a charge curling in a magnetic field\", \"Newton's cradle with three balls\", \"a block sliding down a rough ramp\", \"show diffusion of dye in water\", \"a membrane that lets water through but not sugar\", \"how an enzyme turns substrate into product\", \"an electron tunnelling through a barrier\", \"the hydrogen orbitals side by side\", \"half-life with a thousand nuclei\"",
  "entry": "create_view",
  "form": "view"
}
---
→ `create_view` with kind `classical` composes the demo from a table of laws rather than picking a ready-made experiment: `params.model` (units checked), `params.dress` (how it looks, never what it does) and `params.liberties` (what you exaggerate on purpose; the page shows them). Laws and worked examples: `get_view_vocab({ id: 'classical' })`. Molecules moving, crossing membranes and reacting → kind `microscopic`; wells, tunnelling, orbitals, spin and decay → kind `quantum` (each its own card; `quantum` supersedes `atom` for orbitals). The mint returns the solver's gates (conservation, the textbook answer, the regime): say which ran and what they saw; nobody has looked yet. Read the run back → `measure_view`. Film it (run, slowed replay, an end card saying what is real) → `forge_motion` with `shot: { motion: 'plan' }`. A ready-made kind is quicker when it already is the demo. Full family → `get_creative_toolset({ form: 'view' })`.
