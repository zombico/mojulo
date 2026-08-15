---
{
  "id": "assemble-parts",
  "name": "Assemble finished parts into one model",
  "summary": "Compose several workbench parts into a single worldspace.",
  "when": "\"assemble these parts\", \"put the wheels and the chassis together into one model\", \"combine the pieces into one object\", \"something complicated built from pieces\", \"join the parts into a whole\", \"build a complex machine/object segment by segment\", \"model an espresso machine / bicycle / typewriter piece by piece\"",
  "entry": "mint_solid",
  "form": "object"
}
---
→ `mint_solid({ kind: 'assembler', spec })` — the ring above kind `workbench` (assembler makes a chariot; workbench makes chariot parts). Forge each part with `mint_solid` kind `workbench` first, then compose them by literal placement into one worldspace. Working from a dreamed/concept image of a complex object → the segment-first loop in `get_catalyst({ id: 'reconstruct-from-dream' })`. (Contrast: ONE object from revolution primitives → kind `workbench`; a vehicle-family instance → `mint_solid` kind `vehicle`.) Read the manual first via `get_solid_vocab({ id: 'assembler' })`. Full family → `get_creative_toolset({ form: 'object' })`.
