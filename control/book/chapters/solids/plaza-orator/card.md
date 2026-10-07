---
{
  "id": "plaza-orator",
  "name": "Plaza orator",
  "entry": "mint_solid",
  "family": "figure",
  "summary": "A ready-to-mint posed figure: a man mid-speech — back arched into the gesture, one arm sweeping up and out with an open pointing hand, weight settled on one leg, head lifted toward the horizon. Tee and trousers on the grey studio.",
  "when": "a figure giving a speech; a person pointing to the horizon; a declaiming / presenting / rallying pose; a statue-like oratory stance; a figure study with an expressive raised arm"
}
---

A worked example over the figure kind: the oratory stance. The spine arches
back slightly (`sagittal: -0.15`) and twists into the gesture; the pelvis
and shoulder girdle counter-rotate so the body spirals rather than standing
flat; the raised arm drives up past horizontal (`pitch: 125`) and OUT
(`yaw: 30` — the yaw is what keeps the arm clear of the head in the
three-quarter view) with a soft elbow and a half-curled pointing hand. The
head lifts and turns toward the gesture — the address-the-crowd line.

This is a Door-1 recipe: pure params, nothing to load — and joint limits
clamp every dial, so edits can never break the form. In the default
three-quarter view the raised LEFT arm is the near-side arm; if you switch
to a `view` that faces the other way, mirror the pose onto the right-side
dials so the gesture stays on the camera side. Swap `proto.sex`, trade the
garment array for `['fittedShirt']`, or add `motion: { emote: 'point' }` to
turn the stance into a looping gesture GIF.

## Recipe

See `recipe.json` beside this card — `kind: 'figure'` with the spec above.

Pass the `kind` and `spec` to the solid mint. The full parameter manual for
the underlying kind is its own card (`id: 'figure'`).
