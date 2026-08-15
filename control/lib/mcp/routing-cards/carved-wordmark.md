---
{
  "id": "carved-wordmark",
  "name": "Carve a 3D wordmark, logo, or badge",
  "summary": "A carved, metalified 3D solid from any vector outline.",
  "when": "\"chrome text\", \"extruded logo\", \"beveled icon\", \"metalify this shape\", \"a 3D badge of our wordmark\"",
  "entry": "mint_solid",
  "form": "object"
}
---
→ `mint_solid({ kind: 'carved-solid', spec })`. Persists as a sketch (kind `carved-solid`) at `/sketches/<ref>`. (Contrast: an everyday object at literal scale → `mint_solid` kind `workbench`; a single convex solid spinning live → kind `solid-turntable`.) Read the manual first via `get_solid_vocab({ id: 'carved-solid' })`. Full family → `get_creative_toolset({ form: 'object' })`.
