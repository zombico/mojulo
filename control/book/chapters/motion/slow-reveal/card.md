---
{
  "id": "slow-reveal",
  "name": "Slow reveal (turntable shot)",
  "entry": "forge_motion",
  "summary": "A compressed SHOT recipe — camera language + timing only, subject slot open: a full 360° turntable at 48 frames / 12 fps (four seconds), the museum-display pace that lets a form be read before it repeats.",
  "when": "spin my model slowly; a gallery / museum turntable; a calm 360 of a subject; show a solid from every side; the standard reveal shot for a finished piece"
}
---

A COMPRESSED motion recipe: it carries the camera language and the timing,
and deliberately not the subject — motion is relative to whatever scene or
subject you point it at, so the `subject` field is a slot you fill
(`sketch_ref` of any stored manji-tree subject, or an inline `manji_tree`
manifest). The subject's own `worldFraming` stays the base shot; this recipe
only says HOW the camera moves over it.

The shot itself: one full revolution in 48 frames at 12 fps — four seconds
per loop. Slower than the default, deliberately: it is the pace at which a
silhouette, then a profile, then the far side can each be READ before the
loop repeats. Renders a self-contained flipbook SVG + GIF; add
`export: 'mp4'` for a downloadable H.264.

Tune the timing relative to your subject's complexity: a simple solid can
take 32 frames; a dense scene earns 64. For a world-scale subject (a city, a
terrain) use the motion `world` family instead — same compressed idea, its
own card.

## Recipe

See `recipe.json` beside this card — the `shot` block travels as-is; fill
the `subject` slot with yours.

Pass `subject` and `shot` to the motion forge. The full camera-language
manual is the motion `camera` card.
