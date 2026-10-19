---
{
  "id": "science-world",
  "name": "Compose a physics demo from laws",
  "summary": "A physics simulation built from Newton's laws for a class or a question no ready-made experiment covers, checked against conservation laws and the textbook answer.",
  "when": "\"a demo for my class of a ball on a spring in thick oil\", \"simulate two moons around a planet\", \"what if the pendulum started from the side\", \"a charge curling in a magnetic field\", \"Newton's cradle with three balls\", \"a block sliding down a rough ramp\"",
  "entry": "create_view",
  "form": "view"
}
---
→ `create_view` with kind `classical` composes the demo from a table of laws rather than picking a ready-made experiment: `params.model` (bodies, laws, duration; units checked), `params.dress` (how it looks, never what it does) and `params.liberties` (what you exaggerate on purpose; the page shows them). Laws, units and worked examples: `get_view_vocab({ id: 'classical' })`. The mint returns the solver's gates (energy and momentum held, the textbook answer, the regime): say which ran and what they saw; nobody has looked yet. Read the run back in SI → `measure_view`. A ready-made kind is quicker when it already is the demo. Cells, molecules, orbitals and bonds are not classical: the mint names them as gaps. Full family → `get_creative_toolset({ form: 'view' })`.
