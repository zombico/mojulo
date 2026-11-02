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
