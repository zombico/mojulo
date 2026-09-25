# Humanoid: the hero form with a landmark head

The human starter of the `create-hero` loop: the [hero form](../ring-plans/README.md) (a ring plan on the
vajra rest skeleton, streamlined: thigh lofts from the hip crest carry the pelvis, a V torso, calf and forearm
swells) with a `male` / `female` preset (the female 85 % of his height, the yoke 15 % and the hips 20 %
narrower than her first cut, a narrower neck, head and calves, a bust), the BODY CONTROLS, and a planar
LANDMARK HEAD whose nose is a narrow wedge standing forward of the face and whose cheek plane runs from the
cheekbone at the eye row down to the mouth, the eyes in an orbit under the brow. Hair, palette,
expression and register are independent of the proportions. Begun as an outside spike on the hero form and
reconciled into it: the body lives in the hero form now, the head here.

- `humanoid.plan.mjs`: `humanoidPlan({ preset, body, face, register, girth, headScale, palette, hair,
  expression })` → a ring plan: `heroPlan({ cast: preset, body, head: humanoidHead(…) })`. A thin wrapper; every
  number lives in the hero form (`HERO_CASTS`, `BODY_DEFAULTS`) or the head.
- `head.mjs`: `humanoidHead(…)`: a head as ONE designed surface. The cranium's rings are horizontal landmark
  rows read off the figure's own skull landmarks (`figure-head.js` `headLandmarks`: stomion, subnasale, nose
  tip and bridge, the eye line, glabella, frontal, crown) under the `DIMORPH` male / female head pole and the
  figure's head knobs (`browRidge`, `jawWidth`, `chinPoint`, `noseSize`, `cheekbone`, `eyeSize`, …), so the
  forehead, eye plane, nose wedge and chin are one surface with the cheeks on it. The skull / jaw boundary
  follows the mandibular angle up to the condyles: the jaw hinges by the ear (`jaw/tip` is the condyle) and
  the chin drops under the cheeks, never a horizontal puppet cut. Eyes (almond, iris, pupil, lid), brows,
  ears, nostrils and the mouth are closed lofts pinned to that surface by address; hair is one continuous
  mass whose perimeter follows the skull by address (`crop`, `swept`, `bob`, `none`). Expressions
  (`neutral`, `smile`, `determined`, `surprised`) displace the connected flesh (cheek and brow weights) and
  the accents, baked per cast; `jawOpen` stays a live dial. Four registers set the planes and the eye sides.
  `scale` scales carriers, pin-local detail and jaw anchors together.
- `render.mjs`: the review sheets (front / three-quarter / side / back / head / wave / walk per preset, the
  expressions, 64 px silhouettes, a male–female pair) into the gitignored spike tree. Never here.
- `test-humanoid.mjs`: both presets in every register close at rest and at every dial extreme; the jaw hinges
  by the ear and the chin drops; both eyes read in the exposure ledger; the chin clears the collar; hair,
  expression and face knobs never move a joint; unknown presets, hair and body controls refuse.

Two heads exist for the hero: this landmark head (a designed planar surface, expressions baked, the read the
reference sheets asked for) and [hero-head](../hero-head/README.md) (data on the species-free detail core:
live expression controls through skin maps, the eye region with lids and a surround, grown hair tiles). A plan
wears either through `head:`.
