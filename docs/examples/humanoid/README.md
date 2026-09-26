# Humanoid: the hero form with a landmark head

The human starter of the `create-hero` loop: the [hero form](../ring-plans/README.md) (a ring plan on the
vajra rest skeleton, streamlined: thigh lofts from the hip crest carry the pelvis, a V torso, calf and forearm
swells) with a `male` / `female` preset. The female is an independent primary-mass design: relaxed narrower
shoulders, a short waist, a wider pelvic envelope around restrained hip sockets, tapered thighs, lighter calves,
an integrated chest and a slightly larger head ratio. It shares the Vajra joint grammar rather than inheriting a uniformly scaled male silhouette. The starter also carries the BODY CONTROLS and a planar
LANDMARK HEAD whose nose is a narrow wedge standing forward of the face and whose cheek plane runs from the
cheekbone at the eye row down to the mouth, the eyes in an orbit under the brow. Hair, palette,
expression and register are independent of the proportions. Begun as an outside spike on the hero form and
reconciled into it: the body lives in the hero form now, the head here.

- `humanoid.plan.mjs`: `humanoidPlan({ preset, body, face, register, girth, headScale, palette, hair,
  expression })` → a ring plan: `heroPlan({ cast: preset, body, head: humanoidHead(…) })`. The shared proportions live
  in the hero form (`HERO_CASTS`, `BODY_DEFAULTS`); this wrapper adds flatter shirt panels, a raised
  collar for a sloping yoke, and hem depth that overlaps the trouser crest.
- `head.mjs`: `humanoidHead(…)`: a head as ONE designed surface. The cranium's rings are horizontal landmark
  rows read off the figure's own skull landmarks (`figure-head.js` `headLandmarks`: stomion, subnasale, nose
  tip and bridge, the eye line, glabella, frontal, crown) under the `DIMORPH` male / female head pole and the
  figure's head knobs (`browRidge`, `jawWidth`, `chinPoint`, `noseSize`, `cheekbone`, `eyeSize`, …), so the
  forehead, eye plane, constructed nose and chin are one surface with the cheeks on it. The bridge, sidewall,
  ala and face-join edges are separate named slots: the face joins sit closest together at the root and spread
  toward the base, forming a narrow dorsal plane, downward-flaring sidewalls, an alar underside and
  a trapezoidal philtrum / upper-mouth plane below the nostrils. That is the landmark cage, still selectable
  through `HEAD_SOURCES`. The canonical heads are FITTED heads (`head-fit.mjs`, data in `female-head-fit/` and
  `male-head-fit/`). Each was fitted jointly to hand-placed landmarks on reference images (the female to front,
  three-quarter and side; the male to three-quarter and side, so his front is inferred) and then frozen. Both
  presets read the same rows and slots off their fitted surface:
  - each front slot is the surface's front-most point at a named x, each back slot its rear-most;
  - the nose and eye rows own only their face slots, and their skull slots interpolate between the neighbouring
    structural rows.

  The CHEEK is then built as four flat planes around a rounded apex (`FIT_CHEEK`, per-head `FIT_TUNING`):
  - the planes are under-eye front and side, then cheek front and side down to a fullness row;
  - the apex under the eye corner leads, and every plane is flat;
  - below the fullness row the lower side is one flat mass down to the jawline, and the jaw front is the fit's: the
    turn lands on the fitted jawline, and the chin keeps the fit's chin bottom, chin front and fold under the
    lower lip;
  - the side column bows out past the straight ramus (never wider than the cheekbones), then runs down it to the
    jaw angle, so the lower side rounds out instead of sinking; the female's jaw angle sits wider;
  - behind it, the rear column below the crest is the ramus's back edge at row height, reaching where the ear is
    worn, so the lower cheek, the jaw and the ear close as one surface (the jaw still hinges by the ear).

  The knobs deform named fitted points before sampling (`earSize`, `eyeSize`
  and `neckGirth` have no fitted counterpart). The skull / jaw boundary
  follows the mandibular angle up to the condyles: the jaw hinges by the ear (`jaw/tip` is the condyle) and
  the chin drops under the cheeks, never a horizontal puppet cut. Eyes (almond, iris, pupil, lid), brows,
  ears, nostrils and the mouth are closed lofts pinned to that surface by address; hair is one continuous
  mass whose perimeter follows the skull by address (`crop`, `swept`, `bob`, `none`). Expressions
  (`neutral`, `smile`, `determined`, `surprised`) displace the connected flesh (cheek and brow weights) and
  the accents, baked per cast; `jawOpen` stays a live dial. Four registers set the planes and the eye sides.
  `scale` scales carriers, pin-local detail and jaw anchors together.
- Face V3 (`FACE_VERSION === 3`) derives the mouth from the nose construction. The nostrils are triangular
  underside facets; alar half-width sets the mouth span and cupid peaks; a shallow M-shaped `Lip` plane sits
  above the mouth slit. `noseWidth` therefore carries the nose / philtrum / mouth relationship together.
- `render.mjs`: the review sheets (front / three-quarter / side / back / head / wave / walk per preset, the
  expressions, enlarged front / three-quarter / profile portraits, 64 px silhouettes, a male–female pair) into the gitignored spike tree. Never here.
- `render-head-fit.mjs`: each head through its fitted reference cameras. It draws the reference, the landmark
  cage, the raw fitted sampling, the built head and an overlay, hair off and on (the male's front as an inferred
  0° view), plus silhouette agreement with each fitted source. The references come from `MOJULO_FIT_REFS` and
  never enter the repo.
- `render-female-head-map.mjs`: an independent female-head design target in one shared Meru world ruler.
  Its bilateral Mandala names the axis, eye / cheek / nose-base / mouth / jaw bars and 3D points; 116 named
  polygon planes build the forehead, orbits, downward-flaring nose, philtrum, lips, cheeks, jaw, ears and
  hair. The script projects that same source through front, three-quarter and profile cameras and writes
  a combined SVG map, a labelled construction view, a complete JSON recipe and a machine audit. Its exported
  `DESIGN_CONTROLS` are the iteration surface for cranial / facial proportions, independent nose width and
  projection, eye and mouth proportions, and presentation styling. Read `female-head-principles.md` before
  changing topology or adding a view-specific correction. It is a design target for later integration,
  rather than a second runtime head implementation.
- `test-humanoid.mjs`: both presets in every register close at rest and at every dial extreme; the jaw hinges
  by the ear and the chin drops; both eyes read in the exposure ledger; the chin clears the collar; hair,
  expression and face knobs never move a joint; unknown presets, hair and body controls refuse. The
  cage-construction ratios run with the landmark cage selected. The fit gates run for both heads:
  - each head's frozen data is pinned and exactly symmetric;
  - silhouette IoU against its fitted source is above 0.88 through every fitted camera;
  - each compiled pupil lands within 5 px of the hand-marked eye centre;
  - `noseWidth` and `jawWidth` still shape them;
  - the cheek planes (the lower side included) are flat, the apex leads, the lower side bows past the straight ramus, the side column
    lies on the ramus, the jawline does not fold, and the chin rows sit at the fit's chin points;
  - the rear column behind the jaw sits at row height and reaches the ear root, and the jaw opens closed.

Two heads exist for the hero: this landmark head (a designed planar surface, expressions baked, the read the
reference sheets asked for) and [hero-head](../hero-head/README.md) (data on the species-free detail core:
live expression controls through skin maps, the eye region with lids and a surround, grown hair tiles). A plan
wears either through `head:`.

Reference refinement keeps the orbit shallow, carries the bridge forward between the eyes, gives the nose
a narrow root and dorsal plane plus an alar base wider than its attachment to the face, and raises the lower jaw edge toward the ear. `noseWidth`
changes that flare without widening the bridge. The smaller eye accents have flatter
fronts, the ear has an inner plane, and the swept cap ends in a temple point. These are recipe changes;
shared hero defaults and core kernels are unchanged. Visual acceptance remains with the operator.
