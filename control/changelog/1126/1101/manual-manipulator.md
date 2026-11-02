### The manual manipulator: arms that hit targets, hands that grasp by role

The realistic hero's arms and hands, solved from targets rather than picked from a pose library. This lands the
studies, the arm's and the hand's servos, the arm solver with the body joining in and its target drill, the wider hand
and the hand solver. Still to come: the arm and the hand moving as one, and the words a person asks for them by; until
then none of it is reachable from the hero door (the scripts under `control/scripts/spikes/manipulator/` drive it).

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
  guard: error, elbows, the punch line, time). The baseline: today's thumb curls in a fixed arc 29–46 mm in front of
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
- **Space boxer, the arm** (`lib/graph/polygonizer/hero-reach.js`): a target is reached by bringing a surface of the
  hand (knuckles, the back of the fist, the palm heel, the knife edge, the fingertips) to it, facing along its approach,
  the arm held to its servos. The solve keeps hero-grip's way (the hand placed first, the arm solved to serve it) and
  adds the hand's roll, its aim and the force line (the wrist as its surface wants it, so a fist lands with the forearm
  behind it). Each strike tries a straight, a hook and an uppercut and keeps the cheapest, so a near target is hooked
  or uppercut and a far one punched straight without being told. From the guard, against today's arm solver on the
  same targets: every target within reach landed within a millimetre (today's within 5 mm for about four in five,
  missing by up to 8 cm), the forearm a median 5–9° off the line of the strike (today's 22–67°); but about twice as slow
  cold.
- **The body joins in** when the arm cannot land a target, a rung at a time and only as far as it must: the shoulders'
  girdle turns, then the trunk turns, leans and bows, then the hips turn and the weight shifts over the feet (held
  inside them) with the knees bending, then the striking side's foot steps toward the target. Targets a tenth past the
  arm's reach now land within 2 mm (they fell 5–8 cm short); a target past what a step can bring in is reported as
  missed, not stretched to.
- **The target drill** (`targetDrill`; `scripts/spikes/manipulator/drill.mjs`): seeded targets around the shoulder, each
  struck and recovered to the guard, timed by the servos' speeds, and checked on the clip as played (the contact, the
  facing, the servos, how close the hand keeps to its drive, the balance). A straight drives along its line; a hook and
  an uppercut along an arc that meets the target along its approach, the trunk coiling into it; a step lifts the foot
  and sets it down. `--page` writes a review page that plays the drill's skeleton with the targets and their drives
  drawn.
- **The wider hand** (the rig's `fingers<S>`): a digit may be given as an object, each joint by its own angle (the
  knuckle, the middle joint and the last, a middle joint alone bringing the last at two thirds), each finger spread
  away from the middle, and the thumb turned across the palm and in toward it on a second axis. A number or a word is
  the curl it always was, to the bit, and nothing is added to the rig, so every hero minted before is unchanged. With
  it the thumb meets every fingertip, the middle's included, which the one-curl thumb could not reach.
- **The hand's servos** (`hero-servo.js` `handRead`): each finger joint's angle, its spread and the thumb's read off the
  posed hand in its own frame, held to adult norms (estimates marked); every hand word lies within them.
- **Octopus boxer, the hand** (`lib/graph/polygonizer/hero-digits.js`): each digit reaches a point with its pad or tip,
  or closes onto an object knuckle first, then the middle joint, then the last, each until it touches, the hand's
  servos held throughout. A haft laid in the palm is held round its own size: on hafts from 12 to 40 mm every phalanx
  ends on the surface, and a thinner haft closes the hand further. Hand shapes are compositions of those goals: crane
  beak, tiger claw, sword fingers, leopard fist, phoenix eye, vertical palm, pinch, OK, fist, grip and point (plain
  aliases resolve). Each solves into the rig's own finger channel, so it plays and exports as any hand word does. The
  existing hand words' thumbs turn out to run through the curled fingers; the solved fist keeps its thumb clear.
- **Fixed in the studies:** the arm envelope now stands in the guard (it stood at rest), the servo audit plays swings
  with the elbows-down roll and reads the wrist as anatomy.
