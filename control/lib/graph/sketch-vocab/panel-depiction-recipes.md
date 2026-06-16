---
{ "id": "panel-depiction-recipes", "name": "Named panel-depiction recipes (sunday-comic, manga, natgeo, time-cover, …)", "summary": "graphic-design/layout-mode recipes for multi-panel pictures and magazine covers", "when": "graphic-design layout modes for multi-panel pictures, comics, manga, magazine covers, or other recognizable panel-blocking paradigms", "tier": "recipe", "marks": [], "phase": "p1" }
---

Named panel-depiction recipes encode common graphic-design layout modes.
Use them as `depiction.panelRecipe` or `display.kind` only; **never as
`marks[].kind`**.

## Recipe ids

- `sunday-comic` — newspaper-format Sunday strip with header tier and
  variable-size panels.
- `manga-high-eye-control` — manga-style high-control panel blocking with
  reading-flow eye-line direction.
- `american-comic-widescreen-panels` — wide letterbox panels with broad
  splash anchor.
- `natgeo` — National-Geographic-style photo-essay layout with caption
  blocks.
- `monoculous` — single dominant panel with smaller inset detail panels.
- `cover-mode` — magazine cover: masthead, issue label, cover lines,
  lettering above a scene.
- `time-magazine-cover` — Time-style red border cover with subject portrait
  centered.

## Display options

- The most basic display is a full equal grid with 1px panel borders.
- Advanced displays are panel-blocking paradigms: unequal comic-page
  layouts, inset/callout panels, strips, before/after pairs, or unrelated
  panels.
- Use **eye-line** as the key layout rule.

## Transparent panels and covers

Panels may be transparent movable layout containers. Use
`panel.transparent`/`frameVisible:false` or `display.transparentPanels`
plus explicit panel `bounds/x/y/w/h` when a panel should behave like a
draggable PowerPoint-style element. It still lowers to a transparent rect,
not a new mark kind.

Cover recipes can be transparent overlays over a normal scene sketch. Use
`display.overlay:true` when the scene/background should remain ordinary
marks and the cover lowers only its transparent panel zones, frame,
masthead, issue label, cover lines, and lettering above it.

## Composes with

- `lettering-carriers` — speech bubbles, narration, handwritten bubble
  letters, all sit above panel reasoning.
- Constellation grids apply per panel **only when that panel needs local
  CCA/world reasoning**; unrelated panels may each own their own world.
