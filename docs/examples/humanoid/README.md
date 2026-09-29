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
  expression, tune })` → a ring plan: `heroPlan({ cast: preset, body, tune, head: humanoidHead(…) })`. `tune` is the
  hero form's proportion tune (percentages of the preset's baseline; see `../ring-plans/README.md`); its `head` control
  scales the worn head, which is baked at the tuned scale. The shared proportions live
  in the hero form (`HERO_CASTS`, `BODY_DEFAULTS`); this wrapper adds flatter shirt panels, a raised
  collar for a sloping yoke, and hem depth that overlaps the trouser crest.
- HAIR is a library (`control/lib/graph/polygonizer/humanoid-hair.js`, the hairstyle lab's styles and controls on closed
  masses): every style is DATA over four closed constructions whose perimeters follow the skull by address (the CAP, the
  old `hairMass` generalised: hairline per slot, lifts, fringe, part groove, taper, quiff; the FALL, curtains from just
  inside the cap's border with a per-slot fall so the mass frames the face; the TAIL family: ponytail sweep, bun bell,
  winding braid; the LOCKS, one closed tapered sweep per anime lock along a root → control → tip curve, mirrored exactly
  when the asymmetry is 0). Nineteen styles in a male and a female collection, either head wears any; nineteen controls
  as ratios about the style's preset (`cap`: volume, fringe, part, fade; `fall`: length, graduation, wave; `tails`: tail,
  tie, braid; `locks`: lockWidth, taper, bend, asymmetry; `form`: corners, sideBulk, topSlope, lineup, the barber's pass
  on the male caps; `definition`: each style's signature exaggerated). On the three pinned styles the form and
  definition are relative (1 changes nothing). A control the style does not use advises, never refuses. `crop`, `swept` and `bob` at every control 1 are the bytes the
  head grew before the library (pinned in `humanoid-hair.test.js`). `hair` takes a word, `{ style, …controls }` or a
  list; the include carries the resolved `hair` and `hairMeasures`. `render-hair.mjs` draws both heads × every style at
  four views through one camera per head, with a measurements table.
- DRESS: `humanoidPlan({ detail, adorn })` puts the dragon's body-detail and adornment passes on the hero with its own
  parameters (`control/lib/graph/polygonizer/hero-dress.js`). `detail: 'clothed'`: elbows and knees refined, the jerkin's
  masses, soft sleeve folds, a quilted jerkin (front panels beside a bare placket with a toggle row, a back panel, grown
  only where the torso bone dominates), knee patches, cuffs, leg wraps. `adorn: 'ranger'`: belt, baldric, an archer's
  bracer on the left forearm, ONE pauldron on the right shoulder with a bronze boss (the focal accent), in that stacking
  order, with a suggested earth palette. Both bake into the recipe as pinned parts (they ride the dials and the rig; the
  pauldron rides the torso, the arm moves beneath it). `render-dress.mjs` draws the build-up (form → detail → adornment)
  for both casts at four views, at 128 / 256 / 512 px, mid-walk and mid-wave, and a bust, with the adornment ledger.
- `head.mjs`, `head-fit.mjs`, `humanoid.plan.mjs` are RE-EXPORTS since face-tune: the modules are core
  (`control/lib/graph/polygonizer/humanoid-head.js`, `humanoid-head-fit.js`, `humanoid-plan.js`; the frozen fits under
  `control/lib/graph/polygonizer/head-fit/{female,male}/`, byte-pinned by `humanoid-head.test.js`), so the `mint_solid`
  hero door wears this head and regenerates it from its FACE controls. The head's FACE (`FACE` in `humanoid-head.js`) is
  the face proportion lab's contract: ratios about the fit in groups (`skull`: skullWidth, faceWidth, faceLength; `brow`:
  browHeight, browRidge, foreheadSlope; `eyes`: eyeSpacing, eyeSize; `cheeks`: cheekbone, cheek; `nose`: noseWidth,
  noseSize, noseDroop; `mouth`: mouthWidth; `jaw`: jawWidth, chinProjection, chinPoint; `ears`: earSize), moves
  `broad-jaw` and `large-eyes`, composed by product through the shared `ratio-controls.js`; the seven new words are
  `KNOB_MOVES` on the fitted points (broad ones blend from the ear root to the cheekbone crest, the lab's face ↔ vault
  weight). `humanoidPlan({ face, headPreset })` takes a move, an object or a list; a figure cast wears the male head.
  `render-face.mjs` draws the FACE contact sheet (both heads × as fit / each move / both combined extremes as portraits
  through one camera per head, with a measurements table) into the gitignored spike tree.
- The ANIME HEAD is the hero's second head (`humanoidPlan({ head: 'anime' })`; at the door `head: 'anime'`):
  `control/lib/graph/polygonizer/anime-form.js` is the Anime Form Studio's construction ported bit for bit (its recipe
  contract, baselines, apertures, lash and brow ribbons, clump hair with per-clump lock edits; `anime-form.test.js`
  holds it to hashes frozen from the studio's own code), and `anime-head.js` makes it wearable: the studio's words as
  composable vocabularies, registered where the landmark head sits, every part closed and pinned to a hidden core on
  the head bone, no jaw (the mouth opens as an aperture). `render-anime.mjs` draws both design bases × bald / each
  family / each pose at four views and both hero casts wearing it, with a measurements table, into the gitignored
  spike tree.
- `render-articulation.mjs`: the anime hero as the door mints it (`toon.light`, `sculpt`, the hair bases, the neck
  form, `gesture`; the manual's hero door): a progression from a stored baseline (`--baseline <dir>`, the manifests an
  earlier `--parity` run wrote, with `--predates` naming the bake and page rules it came before) to today's default,
  the expressions, the preset stands with their readout, and on request before / after and three key directions; at
  head and bust size and at 256 / 128 px, key- and shade-side profiles, on paper and on the World's own backdrop. It
  draws the World payload's own static faces and refuses to run if its re-derivation of them drifts (coordinates,
  fills, draw layers, ink marks), with the page's draw layers (the brows through the fringe, no hair outline over hair)
  emulated per pixel; its measures carry the lit share per group and view, the hair lit at the rear ¾, and the hair's
  lit and shade tones against the backdrop in L*. `--parity` writes a lookdev-shots camera list for the World page and
  compares the capture. Into the gitignored spike tree.
  Its CARD MODE (`--spec <file.json>`) draws a CHARACTER CARD for any hero spec, `{ name, hero, toon?, palette? }`
  (`hero` takes exactly the door's fields, `HERO_FIELDS` in `layered.js`; `palette` rides the hero and `toon` the
  manifest, as the door stores them; a key starting with `$` is a comment). The spec goes through the hero door's own
  steps without a database and refuses with the door's own messages; the card is drawn from the same parity-guarded
  World payload: the head ¾ large, the head from the front, the key side and the rear ¾ 20° down (the gameplay
  camera), the head on the World backdrop, the bust, the body ¾ and front at 256 px, a silhouette and a 3-value
  render, under the spec's words and what the door read, beside the door's `hero` readout (`readout.json`). `--expr`
  adds the head ¾ at every expression word the worn head takes, `--check-lens` the head ¾ at the review sheets' lens,
  and `--sheet <config.json>` draws several specs side by side on one lens per row. Into `cast/` under the spike tree
  (`--out <dir>` elsewhere).
- `cast/`: worked characters as card specs, each with a `$note` saying who the character is and what the spec shows
  off: `heroine` in full dress (one base garment and one signature sash and bow, collars, boots with buckles, a stand
  from pose words), then `lead`, `rival`, `noble`, `mentor`, `kid`, `tough` and `tomboy` (look words and the own layer
  over them, the graphic face, the hair's form words and lock edits, expressions as a word, a list or an object, the
  character light's shade swatches, streak and ring). The words are the manual's (`control/lib/graph/solid-vocab/layered.md`,
  the Hero door). `node ../docs/examples/humanoid/render-articulation.mjs --spec ../docs/examples/humanoid/cast/<name>.json`
  from `control/` draws one.
- `head.mjs`: `humanoidHead(…)`: a head as ONE designed surface. The cranium's rings are horizontal landmark
  rows read off the figure's own skull landmarks (`figure-head.js` `headLandmarks`: stomion, subnasale, nose
  tip and bridge, the eye line, glabella, frontal, crown) under the `DIMORPH` male / female head pole and the
  figure's head knobs (`browRidge`, `jawWidth`, `chinPoint`, `noseSize`, `cheekbone`, `eyeSize`, …), so the
  forehead, eye plane, constructed nose and chin are one surface with the cheeks on it. The bridge, sidewall,
  ala and face-join edges are separate named slots: the face joins sit closest together at the root and spread
  toward the base, forming a narrow dorsal plane, downward-flaring sidewalls, an alar underside and
  a trapezoidal philtrum / upper-mouth plane below the nostrils. That is the landmark cage, still selectable
  through `HEAD_SOURCES`. The canonical heads are FITTED heads (`head-fit.mjs`, data in core under
  `head-fit/female/` and `head-fit/male/`). Each was fitted jointly to hand-placed landmarks on reference images (the female to front,
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
  cage-construction ratios run with the landmark cage selected. The fit gates run for both heads (each head's
  frozen data is pinned and exactly symmetric in core, `humanoid-head.test.js`):
  - silhouette IoU against its fitted source is above 0.88 through every fitted camera;
  - each compiled pupil lands within 5 px of the hand-marked eye centre;
  - `noseWidth` and `jawWidth` still shape them;
  - the cheek planes (the lower side included) are flat, the apex leads, the lower side bows past the straight ramus, the side column
    lies on the ramus, the jawline does not fold, and the chin rows sit at the fit's chin points;
  - the rear column behind the jaw sits at row height and reaches the ear root, and the jaw opens closed.

  Every spec in `cast/` passes the hero door without a refusal (`heroRecord`, `heroPlanOf`, `expandLayeredManifest`, the
  character light's check), and the heroine also plans (`planLayered`: the recipe and rig gates).

Two heads exist for the hero: this landmark head (a designed planar surface, expressions baked, the read the
reference sheets asked for) and [hero-head](../hero-head/README.md) (data on the species-free detail core:
live expression controls through skin maps, the eye region with lids and a surround, grown hair tiles). A plan
wears either through `head:`.

Reference refinement keeps the orbit shallow, carries the bridge forward between the eyes, gives the nose
a narrow root and dorsal plane plus an alar base wider than its attachment to the face, and raises the lower jaw edge toward the ear. `noseWidth`
changes that flare without widening the bridge. The smaller eye accents have flatter
fronts, the ear has an inner plane, and the swept cap ends in a temple point. These are recipe changes;
shared hero defaults and core kernels are unchanged. Visual acceptance remains with the operator.
