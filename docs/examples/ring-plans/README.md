# Ring plans: worked plans for the layered kind's plan door

A ring plan is the compact authoring form of a `layered` solid: a joint table, segments along the
joints with ring radii, chains, claws by address, a head worn at a shift, dials / rig / clips as data.
`expandPlan` (`control/lib/graph/polygonizer/station-loft-plan.js`) turns it into the recipe
deterministically; `mint_solid { kind: 'layered', via: 'plan', spec: { plan } }` stores both.

- `quadruped.plan.json`: a bare hound-sized quadruped (a spine segment between rump and withers, neck,
  head, a three-joint tail, four legs of three segments each, two ears as claw-shaped spikes), three
  dials, no rig. The form the `creature-from-plan` catalyst hands a worker, filled in.
- The rigged biped worked plan is `../dragon-body/seed-recipe.mjs` (it exports `plan`).
- `hero.plan.mjs` / `hero.plan.json`: the HERO FORM, a human on the vajra rest skeleton. `heroPlan({ cast,
  register, girth, headScale, palette, head })` takes the figure's joints from `figure-cast.js` (`castArmature`, so
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
  `node docs/examples/ring-plans/hero.plan.mjs` rewrites the JSON; `test-hero.mjs` pins it byte for byte.

`node --test docs/examples/ring-plans/test-plans.mjs` expands every plan here, compiles it, and checks
closure at rest and at every dial extreme; `test-hero.mjs` adds the hero's cast, register and rig gates. Renders go to the gitignored integration tree, never here.
