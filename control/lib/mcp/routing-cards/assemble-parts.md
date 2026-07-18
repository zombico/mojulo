---
{
  "id": "assemble-parts",
  "name": "Assemble finished parts into one model",
  "summary": "Compose several workbench parts into a single worldspace.",
  "when": "\"assemble these parts\", \"put the wheels and the chassis together into one model\", \"combine the pieces into one object\", \"something complicated built from pieces\", \"join the parts into a whole\"",
  "entry": "create_assembler",
  "form": "object"
}
---
→ `create_assembler` — the ring above `create_workbench` (assembler makes a chariot; workbench makes chariot parts). Forge each part with `create_workbench` first, then compose them by literal placement into one worldspace. (Contrast: ONE object from revolution primitives → `create_workbench`; a vehicle-family instance → `preview_vehicle_instance`.) Full family → `get_creative_toolset({ form: 'object' })`.
