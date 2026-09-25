# Ring plans: worked plans for the layered kind's plan door

A ring plan is the compact authoring form of a `layered` solid: a joint table, segments along the
joints with ring radii, chains, claws by address, a head worn at a shift, dials / rig / clips as data.
`expandPlan` (`control/lib/graph/polygonizer/station-loft-plan.js`) turns it into the recipe
deterministically; `mint_solid { kind: 'layered', via: 'plan', spec: { plan } }` stores both.

- `quadruped.plan.json`: a bare hound-sized quadruped (a spine segment between rump and withers, neck,
  head, a three-joint tail, four legs of three segments each, two ears as claw-shaped spikes), three
  dials, no rig. The form the `creature-from-plan` catalyst hands a worker, filled in.
- The rigged biped worked plan is `../dragon-body/seed-recipe.mjs` (it exports `plan`).

`node --test docs/examples/ring-plans/test-plans.mjs` expands every plan here, compiles it, and checks
closure at rest and at every dial extreme. Renders go to the gitignored integration tree, never here.
