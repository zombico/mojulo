# Ring plans: worked plans for the layered kind's plan door

A ring plan is the compact authoring form of a `layered` solid: a joint table, segments along the
joints with ring radii, chains, claws by address, a head worn at a shift, dials / rig / clips as data.
`expandPlan` (`control/lib/graph/polygonizer/station-loft-plan.js`) turns it into the recipe
deterministically; `mint_solid { kind: 'layered', via: 'plan', spec: { plan } }` stores both.

- `quadruped.plan.json`: a bare hound-sized quadruped (a spine segment between rump and withers, neck,
  head, a three-joint tail, four legs of three segments each, two ears as claw-shaped spikes), three
  dials, no rig. The form the `creature-from-plan` catalyst hands a worker, filled in.
- `horse.plan.mjs` / `horse.plan.json`: THE HORSE, a light riding horse 1.6 m at the withers, built with the
  creature-from-plan loop (thesis: a barrel on four straight columns, single hooves, a long deep wedge of a head carried
  down from the poll, the arched crested neck rising at about fifty degrees). Lofts along the midline for the barrel
  (`ring12`), the neck, the crest (the mane as a carved mass) and the head, each `frame: 'keep'` so a near-level ring
  never turns over; a hanging tail chain; upper arm, forearm, cannon, pastern and hoof forward, thigh, gaskin, cannon,
  pastern and hoof behind (the upper limbs start inside the body); two ears. No dials or rig yet. The form is core
  (`control/lib/graph/polygonizer/horse-form.js`, `horsePlan({ scale, palette })`: the statue maker's equestrian statues
  ride it); this file re-exports it and `node docs/examples/ring-plans/horse.plan.mjs` rewrites the JSON, which
  `horse-form.test.js` pins byte for byte.
- `sphinx.plan.mjs` / `sphinx.plan.json`: THE SPHINX, built the same way (thesis: a lion lying on its belly, the forelegs
  stretched far forward, the hind legs folded at its sides, the tail along the right flank; a king's head in the nemes
  with the uraeus, no beard; the small head of Giza on a long low body). Its body is drawn in the Great Sphinx's own
  metres (73 m long, 20 m to the head) and scaled so the head, the hero's landmark head (`humanoidHead`, no hair) worn as
  an `include`, is life-size; the nemes is lofted round the head's measured bounds (a cap, two flaring wings, two lappets,
  the queue). Core as `control/lib/graph/polygonizer/sphinx-form.js` (`sphinxPlan({ preset, scale, palette })`); a
  historic city's statue entry names it as `form: 'sphinx'` (Giza's `gz-sphinx:0`); `sphinx-form.test.js` pins the JSON.
- `criosphinx.plan.json` (written by `sphinx.plan.mjs`): Amun's ram-headed sphinx of Karnak's avenue, 5 m long on the
  avenue stand-ins' record: a chunkier lion, a ram's head (domed skull, sloping nose, horns coiled round the ears, ears
  drooping out), the headcloth over the shoulders with its lappets, a close-wrapped king between the paws.
  `criosphinxPlan({ scale, palette })` in `sphinx-form.js`; a city entry names it as `form: 'criosphinx'`.
- `bull.plan.mjs` / `bull.plan.json`: THE BULL, Sumer's life-size copper guardian (thesis: a deep barrel on short
  columns, cloven hooves, the hump over the shoulders, the head forward at shoulder height, the horns out and up).
  Core as `control/lib/graph/polygonizer/bull-form.js` (`bullPlan({ scale, palette })`); `form: 'bull'`.
- The rigged biped worked plan is `../dragon-body/seed-recipe.mjs` (it exports `plan`).
- `hero.plan.mjs` / `hero.plan.json`: the HERO FORM, a human on the vajra rest skeleton. The form itself is core
  (`control/lib/graph/polygonizer/hero-form.js`, so the `mint_solid` hero door ships in the install); this file
  re-exports it and writes the canonical JSON. `heroPlan({ cast,
  register, girth, headScale, scale, palette, head, body, tune })` takes the figure's joints from `figure-cast.js` (`castArmature`, so
  a cast word such as `heroic` or `chibi` sets the proportions and the rig's core is the figure's own rest pose;
  `HERO_CASTS` adds `male` and `female` as independent starting arrangements of those dials and masses. The
  female uses a relaxed narrower shoulder girdle, a short waist transition, a wider pelvic envelope around a restrained hip socket,
  tapered upper thighs, a lighter neck and calves, a slightly larger head ratio and a uniform `scale`)
  and authors rings along them, streamlined: a torso trunk with a V and a narrow top the neck rises from, a
  THIGH LOFT from the hip crest at the waist down past the hip to the knee (the two thighs carry the pelvis
  between them, so there is no pelvis part and the hips read as one line), a forearm and a calf with a mid
  swell, small overshoots where the trunk already covers a joint, a mitten hand, a foot whose overshoot behind
  the ankle is the heel. `register` is the plan's `style` block, the art style for
  every ring at once (`lowpoly`, `round`, `chamfer`, `box`). Three dials (`bulk`, `stance`,
  `lean`), a rig and three clips (`idle`, `walk` in place, `wave`). Colour is a palette by group (Skin, Top,
  Bottom, Shoes). `body` overrides the BODY CONTROLS (`BODY_DEFAULTS`: waist, chest, chestDepth, hip, hipDepth,
  thigh, calf, arm, neck, bust, radii in metres; each cast carries its own). `hip` controls frontal width while
  `hipDepth` can flatten or deepen the profile independently. The thigh loft's crest, hip and upper-thigh rings
  are centred inside the hip joint and cross the mirror plane, so the two thighs overlap through the middle (one
  pelvis, no groove up its front) and the crest meets the waist: the torso hem flows into the hips. The female
  default carries its chest depth in the torso envelope. `bust` remains an optional radius for two mounds lofted off the chest
  station, 0 for none: they meet the mirror plane only inside the torso, so the cleft is the gap between two
  round rings and the underside reads as a W. `scale` (or the cast's) is one uniform scale over the finished
  figure, joints, rings and worn head alike (`scalePlan`). `head:` wears a head include (`../hero-head/` `bakeHero()`,
  or `../humanoid/` `humanoidHead()`, the landmark head): cranium on the `head` bone, jaw on a `jaw` bone with a
  `jaw` chain, `jawOpen` spliced in, the head lifted if its chin would sit below the collar; without it the head
  is a blank trunk. Adornments are a later pass; the `create-hero` catalyst is its loop; `../humanoid/` is the
  starter that puts it all together.
  `tune` is proportion as PERCENTAGES OF THE CAST'S OWN BASELINE, the body proportion lab's contract: thirteen
  controls in five groups (`TUNE_GROUPS`: `stature`; `torso`, `neck`, `legs`; `shoulders`, `waist`, `hips`, `depth`;
  `head`; `upperArm`, `forearm`, `thigh`, `calf`), a move word (`HERO_MOVES`: `athletic`, `long-legs`, `full-limbs`), an
  object or a list resolved left to right with ratios composing by product (`resolveTune`). Lengths move joints only
  and keep the soles on the ground; widths and thicknesses scale rings about their own centres (the yoke and the wrist
  ring stay when an arm thickens); `head` scales the blank trunk uniformly. A unit ratio changes no bytes. `TUNE_RANGES`
  are the lab's comfortable limits: `tuneWarnings` advises past them, nothing refuses (`validateTune` refuses only an
  unknown control or a ratio that is not a positive number). Through MCP: `mint_solid({ kind: 'layered', via: 'hero',
  spec: { cast, register, tune } })`, then `update_sketch` patching `/hero/tune/<control>`; the tests are
  `control/lib/graph/polygonizer/hero-form.test.js` (the lab's checker transposed) and the hero block in
  `update-sketch.solid.test.js`.
  `node docs/examples/ring-plans/hero.plan.mjs` rewrites the JSON; `test-hero.mjs` pins it byte for byte;
  `render-tune.mjs` draws both casts × as cast / each move at front, three-quarter and profile through ONE camera per
  cast, with a measurements table (height, shoulders, hips, leg, heads tall), into the gitignored spike tree.

`node --test docs/examples/ring-plans/test-plans.mjs` expands every plan here, compiles it, and checks
closure at rest and at every dial extreme; `test-hero.mjs` adds the hero's cast, register and rig gates. Renders go to the gitignored integration tree, never here.

## An object: the flask

`flask.plan.mjs` writes `flask.plan.json`, a wicker-wrapped flask: one trunk (a glass bottle), a `body` block (woven wicker
grown as brick tiles round the belly with a seeded wobble, a ring at the lip) and an `adorn` block (a leather band at the
shoulder whose brass buckle is its signature). It is the body-detail and adornment passes on something that is not a
character, through the plain plan door: 1.2 KB of plan, 124 closed parts. An unbound part is its own bone, so every tile
passes the rigid gate. `measure_solid` reads it back with the legibility and clearance ledgers. `test-plans.mjs` closes
it with every other worked plan.

