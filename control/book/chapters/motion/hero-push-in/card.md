---
{
  "id": "hero-push-in",
  "name": "Hero push-in (dolly shot)",
  "entry": "forge_motion",
  "summary": "A compressed SHOT recipe — camera language + timing only, subject slot open: a three-second push-in to 55% frame scale, the establishing-to-hero move that turns any subject into the shot's protagonist.",
  "when": "push in on the model; a dramatic slow zoom toward the subject; an establishing shot that ends close; make it feel cinematic; the hero-shot dolly move"
}
---

A COMPRESSED motion recipe: camera language + timing, subject left open —
fill the `subject` slot with any stored manji-tree subject (`sketch_ref`) or
an inline manifest, and the move re-frames into a fixed film frame around
it. Nothing about the subject travels with the shot; the shot is pure
grammar.

The move: a `push_in` from the subject's own base framing down to
`end_scale: 0.55` — just over half the starting distance — across 36 frames
at 12 fps, `loop: false` (a push-in that loops reads as a glitch; this one
lands and holds on the final frame). Three seconds is the pocket for the
move to register as INTENT rather than drift.

Timing is relative to the subject: for a monumental subject (a building, a
big machine) stretch to 48 frames so the approach feels earned; for a small
object 24 frames reads snappy. Swap `motion` to `dolly_zoom` with the same
`end_scale` for the vertigo variant.

## Recipe

See `recipe.json` beside this card — the `shot` block travels as-is; fill
the `subject` slot with yours.

Pass `subject` and `shot` to the motion forge. The full camera-language
manual is the motion `camera` card.
