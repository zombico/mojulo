---
{ "id": "lettering-carriers", "name": "depiction.lettering.carriers — speech, thought, narration, bubble letters", "summary": "speech/thought/narration carriers above panel/world reasoning; lower to ordinary rect/polygon/circle/text marks", "when": "speech bubbles, thought bubbles, shout balloons, narration boxes, or graphic-design handwritten bubble lettering on top of a panel scene", "tier": "render-primitive", "marks": [], "phase": "p1" }
---

Use `depiction.lettering.carriers` for speech bubbles, thought bubbles,
shout balloons, and narration blocks. Lettering carriers sit above
panel/world/constellation reasoning; visible carriers lower to ordinary
`rect`/`polygon`/`circle`/`text` marks.

## Shape

```
depiction.lettering.carriers = [{
  kind: "speech"|"thought"|"shout"|"narration"|"handwrittenBubbleLetters",
  anchor?, panel?,
  tail?: { toRole? },
  ...
}]
```

## Tail rule

Speech tails point toward a figure head anchor when known. Narration blocks
do not need tails.

## Handwritten bubble letters

Use `depiction.lettering.carriers` kind `"handwrittenBubbleLetters"` for
graphic-design lettering. **This is glyph construction, not font text:**
letters lower to polygon-locked glyph bodies using a deterministic
angle/curvature profile. Optional 3D/extrude effects lower to additional
offset polygons.

**Do not emit marks** `kind: "bubbleLetters"`, `"handwrittenBubbleLetters"`,
or `"glyph"`. These are lettering carriers, not renderer primitives.

## Composes with

- `panel-depiction-recipes` — sunday-comic, manga-high-eye-control, etc.,
  carry their own lettering conventions.
- Cover recipes (display.overlay:true) keep lettering above the underlying
  scene marks.
