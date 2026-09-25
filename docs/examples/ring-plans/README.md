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
  register, girth, headScale, palette })` takes the figure's joints from `figure-cast.js` (`castArmature`, so a
  cast word such as `heroic` or `chibi` sets the proportions and the rig's core is the figure's own rest pose)
  and authors rings along them: pelvis and torso trunks, neck, a blank head trunk, one loft per limb bone, a
  mitten hand, a foot whose overshoot behind the ankle is the heel. `register` is the plan's `style` block, the art style for
  every ring at once (`lowpoly`, `round`, `chamfer`, `box`). Three dials (`bulk`, `stance`,
  `lean`), a rig and three clips (`idle`, `walk` in place, `wave`). Colour is a palette by group (Skin, Top,
  Bottom, Shoes). `head: bakeHero()` from `../hero-head/` wears the human head as an include (cranium on the
  `head` bone, jaw on a `jaw` bone with a `jaw` chain, `jawOpen` spliced in); without it the head is a blank
  trunk. Adornments are a later pass; the `create-hero` catalyst is its loop.
  `node docs/examples/ring-plans/hero.plan.mjs` rewrites the JSON; `test-hero.mjs` pins it byte for byte.

`node --test docs/examples/ring-plans/test-plans.mjs` expands every plan here, compiles it, and checks
closure at rest and at every dial extreme; `test-hero.mjs` adds the hero's cast, register and rig gates. Renders go to the gitignored integration tree, never here.
