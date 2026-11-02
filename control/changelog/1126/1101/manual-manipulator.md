### The manual manipulator: arms that hit targets, hands that grasp by role

In progress. The realistic hero's arms and hands, solved from targets rather than picked from a pose library.

- **Space boxer (the arm).** The shoulder, elbow, forearm and wrist as servos (a hard range, a comfortable range, a
  rest and a speed each, from published adult norms), and an exact solver that brings a chosen surface of the hand
  (knuckles, palm heel, the little-finger edge, the back of the fist, the fingertips) to a target along a straight line
  or an arc. When the arm alone cannot reach, the girdle, the trunk, the hips and then a step join in, in that order.
  First result: a seeded target drill, the hero hitting targets around it at different distances.
- **Octopus boxer (the hand).** Each finger and the thumb solved as its own small reacher from a palm treated as a box
  with named faces, with roles (the thumb opposes, the index triggers or points, the other three wrap and support), so a
  hand grips a haft around its own size and forms shapes such as a crane beak, a tiger claw or sword fingers.
- **Opt-in, byte for byte.** The hand words `relaxed`, `open`, `fist`, `point` and `grip` run exactly as before, and
  every hero and clip minted before is unchanged.
- **The studies** (`control/scripts/spikes/manipulator/`): `hand-measures.mjs` (the hand's controls, each word's bends,
  the thumb's path, opposition tip to tip) and `arm-envelope.mjs` (seeded targets through today's arm solver from the
  guard: error, elbows, the punch line, time). The baseline: today's thumb curls in a fixed arc 35–46 mm in front of
  the palm and cannot meet the middle finger; the arm reaches within about a millimetre at most distances but takes
  about 0.2 s a solve, misses some cross-body and high targets at full reach, and lands near targets with the forearm
  45–66° off the line a straight punch needs.
- **The arm's servos** (`lib/graph/polygonizer/hero-servo.js`): the shoulder read as swing and rotation off the posed
  skeleton (a plane of elevation and an elevation held to a cone that reaches differently by direction, the rotation
  external +), the girdle's turn, the elbow and the wrist each with a hard range and an ease range from adult norms
  (estimates marked), and the speeds the hero's own strikes and swings reach. `servoRead` reads a pose and
  `servoReport` a clip; advisory, nothing refuses. Read over every stance, strike, guard and swing
  (`scripts/spikes/manipulator/servo-audit.mjs`): the shoulder's rotation is the joint the clips push past its range
  most (a thrust's rear arm thrown back about 35° past it), then the forearm's turn in three sword guards; no clip
  bends an elbow past its stop.
