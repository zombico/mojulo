# The manual manipulator's studies

Baselines for the arm and the hand of the realistic hero, measured before the arm and hand solvers change anything.
They read the rig a mint makes; no kernel changes.

- `hand-measures.mjs [--cast male|female] [--wide] [--json out.json]`: the hand's controls, its rest measures, each hand
  word's bends and tips, the thumb's curl as a path in the palm's frame, and whether the thumb's tip can meet each
  finger's; `--wide` searches the same with the wider hand's controls, held to the hand's servos.
- `arm-envelope.mjs [--cast …] [--seed 1] [--dirs 16] [--json out.json]`: seeded targets around the right shoulder from
  the `guard` stance at four shares of the arm's length, each through `reachArm`: the wrist's error, the elbow's
  direction, the search's bounds, the punch line (the forearm against the shoulder → target line), and the time.

The pictures: `/body-study male --hero '{"form":"realistic"}' --crop hand --acts '[{}, {"pose":{"fingersR":"fist"}}]'`.
- `servo-audit.mjs [--cast …] [--samples 40] [--json out.json]`: every stance, strike, guard and swing read against the
  arm's servos (`lib/graph/polygonizer/hero-servo.js`): what leaves its hard range and for how long, what leaves ease,
  and the peak speeds the strikes and the swings reach (the source of `SERVO_SPEEDS`).
- `arm-envelope.mjs --strike`: the same targets also through space boxer (`lib/graph/polygonizer/hero-reach.js`
  strikeTarget) as the knuckles' contact: its error on the whole rig, the force line, the servos past a stop, the
  approach chosen, the time.
- `drill.mjs [--cast male] [--seed 1] [--count 6] [--surfaces knuckles,palmHeel] [--bands '[0.6,1.6]'] [--az …] [--el …]
  [--page out.html] [--sheet dir] [--json out.json]`: the target drill (bands past 1 bring the body in) and its checks
  on the clip as played; `--page` the review page (the skeleton playing, the targets and drives drawn, the checks
  beside it), `--sheet` the guard and each contact frame through `/body-study`.
