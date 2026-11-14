### Aerospace vehicles: modern launchers and the winged orbiter

Today's launch vehicles on the craft shelf, at their classes' figures, in a realm of their own (`launch`), and named in
the vehicle registry. Each is a class, not a replica, and wears no agency's or company's markings.

- **The launch parts** (`craft-shelf/rocket-odm.js`, `rocket-parts.js`): a stage (a painted core with its interstage
  and raceway, a side core's nose; a foam tank with its intertank's ribs, its ogive and spike, its orbiter's struts; a
  stainless hull with its welds, chines, hot-staging ring, and a ship's nose and heat-shield tiles); solid boosters (their
  segments, attach rings, flared skirts and nozzles); engine clusters (one, the octagonal nine, a square of four, rings of
  thirty-three, a ship's three and three); a fairing; capsules (a crew capsule's trunk, heat shield, windows and escape
  pods; a deep-space capsule's service module, boost cover and abort tower); grid fins and flaps; folded landing legs;
  the winged orbiter (its fuselage and flight deck, double-delta wing, split rudder, manoeuvring pods, three main
  engines, body flap, tiles black under and white over, its gear).
- **Seven launchers** (`rocket-archetypes.js`): a reusable two-stage medium launcher, the same with a crew capsule, a
  three-core heavy, a stainless super-heavy booster and its ship, the winged orbiter's stack on its external tank and two
  solid boosters, the orbiter alone on its gear, and a heavy-lift crew rocket with its abort tower. Each stands on its
  tail (an archetype's `stand: 'vertical'`). Their grid fins and legs are stowed until posed out (`pose.fins`,
  `pose.legs`).
- **The registry**: a `launch` role and rows for the rocket, the crew rocket, the heavy rocket, the super heavy rocket,
  the space shuttle, the winged orbiter and the heavy-lift crew rocket. A level parks one on its tail; nothing flies one
  yet. Review: `scripts/render-rockets.mjs`.
