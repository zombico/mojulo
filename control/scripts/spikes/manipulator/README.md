# The manual manipulator's studies

Baselines for the arm and the hand of the realistic hero, measured before the arm and hand solvers change anything.
They read the rig a mint makes; no kernel changes.

- `hand-measures.mjs [--cast male|female] [--json out.json]`: the hand's controls, its rest measures, each hand word's
  bends and tips, the thumb's curl as a path in the palm's frame, and whether the thumb's tip can meet each finger's.
- `arm-envelope.mjs [--cast …] [--seed 1] [--dirs 16] [--json out.json]`: seeded targets around the right shoulder from
  the `guard` stance at four shares of the arm's length, each through `reachArm`: the wrist's error, the elbow's
  direction, the search's bounds, the punch line (the forearm against the shoulder → target line), and the time.

The pictures: `/body-study male --hero '{"form":"realistic"}' --crop hand --acts '[{}, {"pose":{"fingersR":"fist"}}]'`.
