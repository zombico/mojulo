---
{
  "id": "image-render",
  "name": "Direct an AI-painted image or comic",
  "summary": "An externally-painted image / comic page composed over a deterministic sketch scaffold, with a worker + audit-gate render handoff.",
  "when": "\"make a comic page / a graphic-novel panel / a manga page\", \"an AI-generated / AI-painted illustration\", \"a picture I'll render with an image model\", \"a character sheet so a character looks the same across panels\", \"lay out a page an artist / image model fills in\"",
  "entry": "create_sketch",
  "form": "image-render"
}
---
→ `create_sketch` with kind `image-outcome` (single painted image) or `sequential-art` (a comic/manga page: panels, gutters, bubbles, lettering imposed deterministically). Read the `image-outcome` / `sequential-art` sketch_vocab card first (`get_sketch_vocab`). Then the render handoff, `render_handoff({ medium: 'image', op })`: `request` parks a durable request → a worker `pull`s and `submit`s → the audit gate `accept` / `reject`; accepted renders composite into `/api/sketches/<ref>/final.png`. Recurring characters: `bind_character_sheet` so identity persists across pages. Full family → `get_creative_toolset({ form: 'image-render' })`. (Contrast: a flat diagram/chart → `create_sketch` directly; a painterly scene mojulo renders itself → `sketch_what_possible`.)
