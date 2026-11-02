### Object grip, balls: a hand that holds a ball by its size, throws solved to their real release, a stick library for the ball games

The manual manipulator takes up balls. The hand closes on a ball of the ball card's own size by a grip a person names
(or the ball's own), a hero throws it in a technique timed so the ball leaves at the sport's real speed, and the
throws are baked into the stick the sports pages pose their athletes by, with the launch a sim gives the ball. Nothing
minted before moves. The eyes gate is the operator's: the throws were looked at only as stick figures in a review
page (`scripts/spikes/manipulator/throws.mjs --page`).

- **Ball grips** (`lib/graph/polygonizer/hero-ball-grip.js`): `power` (wrapped in the palm: a softball, a tennis ball),
  `fingertip` (a pitcher's: the index and the middle on top, the thumb under, the palm clear), `spread` (the fingers
  across a big ball, the palm a finger off it: a basketball, a handball, a football), `cradle` (on the open palm),
  `pinch` (thumb, index and middle pads: a golf ball, a table-tennis ball), `bowling` (the thumb and two fingers in the
  holes). Each digit closes until it touches (hero-digits), a digit the solve left in the ball is opened back onto its
  skin, and the laws read every named digit on the ball and none pressed in. `gripFor(ball)` picks a ball's own.
  Softball and handball join the ball card (`contest/ball-card.js BALLS`).
- **Throws** (`lib/graph/polygonizer/hero-throw.js`, `THROWS`): overhand (a pitch), the quarterback's pass, sidearm,
  underhand, the bowling delivery, the chest pass, the set shot, the throw-in, the toss to serve. Each is a ball, a
  grip, a stance, one or two hands, keyed phases (the body's channels and each hand's place, way and palm) and a
  release cited from the sport (speed, elevation, spin). The hand is placed by the ball and the arm solved to it
  (holdArm, now with an optional seed so each key keeps the last key's way of reaching), a place past reach is drawn in
  toward the shoulder, a free hand goes by the arm alone, and the release is keyed as a drive along the launch line,
  re-timed until the played clip lets the ball go at the technique's speed. Checks: the hands on their places, the
  grip, the wrists at every key, the speed (within a tenth), the line, the drive's wobble (held where the drive is on
  screen: longer than a frame at 60 fps), the balance, and the servos' peak speeds as a report.
- **Where the throws stand:** overhand, sidearm, bowling, the chest pass and the toss hold every law. The quarterback's
  pass, the underhand and the set shot (a wrist at a key; the pass's and the shot's drive, which wanders off its line
  where the forearm stands near upright) and the throw-in (a wrist at a key, its drive) reach their release speed and
  hold the ball, and say which laws they miss.
- **On the hero door**: motion words `throwOverhand`, `throwPass`, `throwSidearm`, `throwUnderhand`, `bowlRoll`,
  `chestPass`, `setShot`, `throwIn`, `tossServe` play a throw as a one-shot, the ball a prop of the throwing hand; the
  clip's readout names the release (when, how fast, along what line, and the library's launch for an engine to spawn
  the ball at).
- **The stick library** (`lib/graph/contest/throw-sticks.js`, baked by `node scripts/throw-sticks.mjs` into
  `throw-sticks.data.js`): `throwStick(name, u, { at, face })` gives a sports page's stick at any moment of a throw,
  the ball in the hand until it leaves; `throwRelease(name, { at, face, power, toward })` the launch a sim gives the
  ball (speed, line and spin turned with the thrower, or the low arc through a point). The sports' sims still launch
  from their own fixed points: wiring them to these is next. A deep test holds the baked file to a fresh bake.
- **The review page** (`scripts/spikes/manipulator/throws.mjs --page out.html`): every throw as a looping stick figure,
  side on and from behind, the ball held and then flown at its launch, with a scrubber.
