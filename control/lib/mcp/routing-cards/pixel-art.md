---
{
  "id": "pixel-art",
  "name": "Pixel-art sprite / portrait / cutscene",
  "summary": "A pixel-art character, portrait, sprite, or 16/32-bit cutscene face — PAINTED by the local image worker then quantized into the cell register, not hand-drawn cell by cell.",
  "when": "\"a pixel-art character / portrait / sprite\", \"a SNES / 16-bit / 32-bit cutscene\", \"pixelize this image\", \"a pixel-art cutscene of <someone>\", \"make a pixel sprite of X\", \"an animated pixel portrait\", \"a sprite SHEET for a 2D game\", \"a sprite atlas / walk cycle\"",
  "entry": "get_catalyst"
}
---
→ PREFER the worker over hand-authored cells (a model paint carries line
fidelity a hand grid rarely matches). PAINT the subject first — native image
gen, or `get_catalyst({ id: 'render-image-outcome-locally' })` — then QUANTIZE
the PNG into the pixel register with `lib/graph/pixelizer/quantize.js`
(`diffRasters` / `bakeActor` extract blink/mouth sub-cels for animation).
Mount the raster in a pixelizer recipe (cutscene engine: `cutscene.js`); keep
the source PNG sha + seed as provenance. Hand-authored cells are the FALLBACK
— no worker, or a tiny UI glyph. (A pixel-art REDUCER game →
`create_pixelizer_game`; a full-res comic or single AI image → the
`image-render` form.)

For a MULTI-POSE SPRITE SHEET (idle/walk/jump per direction), skip the manual
plumbing: `create_sprite_sheet` mints a director recipe whose frames become
per-frame targets on the shared image-render handoff; `bake_sprite_sheet` then
quantizes the accepted renders under one shared palette back onto the manifest
as `baked.sprites`. `project_ref` binds the sheet as a game project's graphic
art.
