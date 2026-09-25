# Hero head: a human head as data on the detail core

The [head-detail](../head-detail/README.md) example proved the detail operators on a dragon and a bear.
This is a **human** head on the same core, written as HEAD DATA only: a cranium lofted from the occiput to
the upper lip (its last bands converge in width and keep their height, so the face stands nearly vertical
and its normals face forward), a jaw hinged under it, skin maps by landmark, the eye / brow / nostril /
nasolabial-fold / cheek-web regions, ears and a nose as ornaments, and HAIR as detail grown from the
skull. It is the head the `create-hero` loop puts on the [hero form](../ring-plans/README.md).

- `head.mjs`: `heroHead({ hair, eye, palette })` → the head object `build` / `bakeLayered` take; `HAIR`
  (three styles as data: `cap`, a helmet of square tufts over the crown; `bangs`, tufts on the forehead
  band leaning down over the brow; `tail`, a sweep from the nape curling down the back); `EXPRESSIONS`
  (`neutral`, `smile`, `determined`, `surprised`, the same control words the dragon and the bear take);
  `bakeHero(opts, expression)` → the INCLUDE a ring plan wears (`bakeLayered` at one expression, the
  `jawOpen` hinge live, plus `joints.jawHinge` / `joints.jawTip` for the rig, in head metres from the atlas).
  Run it to write `baked.json` (the neutral head with the cap).
- `test-head.mjs`: closure in every expression and style, determinism, the one-sided rule, the baked pin,
  the core-names-no-anatomy rule.
- Renders: `node ../head-detail/render.mjs ../hero-head/head.mjs` writes the expression sheet to the
  gitignored spike tree. Never here.

Where the face lives in this grammar: the cranium is a loft along `+y`, so the face is its front bands,
not a separate plane. The eye sits at address `[4.9, 2.0]` (the band between the cheekbone station and the
face station, on the `eye` slot), the brow strip runs along the stations above it, the nose is a midline
sweep at a `symmetricFrameAt`, the mouth is the seam between the cranium's lip band and the jaw's gum band
with the cheek web closing its corners. Appeal is in the numbers: eye size (`regions.eye.R`) and spacing
(the `eye` slot's `x` at the face stations), the brow's height and taper, the lip colour bands.

Worn by a body: `heroPlan({ head: bakeHero() })` in `../ring-plans/hero.plan.mjs` includes the baked parts
at the plan's `headBase`, binds the cranium to the `head` bone and the jaw to a `jaw` bone with a `jaw`
chain, and splices `jawOpen` into the dials.
