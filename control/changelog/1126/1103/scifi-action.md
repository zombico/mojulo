### The mecha shelf: ridden walkers on real-robot principles

In progress. A new shelf, `control/lib/graph/mecha-shelf/`, for legged machines a rider sits in, built from the ground
up. It starts with the all-terrain walker, the base of its bipedal locomotion, and grows a general-purpose work frame
on it: the utility walker.

- **The all-terrain walker** (`mecha-archetypes.js` `allTerrainWalker`): a pelvis, two legs and the rider's cabin.
  - **The legs:** six joints each, like a real biped's: hip yaw, roll and pitch, the knee, and the ankle's pitch and
    roll. The knees bend backward, digitigrade like a bird's.
    - The hip ram works behind the thigh, the knee ram in front of it, and the ankle ram behind the shank to a heel
      horn, like a tendon.
    - The ankle's arc sits toward pointing down: a backward-bent leg folds its ankle further than a human's.
  - **The rider sits astride, as on a sport motorcycle.** A saddle on a spine, a tank with knee grips and a chest pad,
    pegs set back under the hips, and clip-on bars ahead and low. The rider leans onto the bars, its head tilted up to
    look ahead (the cycle shelf's new `walker` posture card).
  - **The cabin evokes a convertible.** A tub's sides round the rider, their beltline swept low beside the saddle, with
    a door seam and a sill to hold. A low framed windshield with quarter panes is raked over the dash. A roll hoop
    stands behind the saddle, and it is open above.
  - **The front is one nose.** It starts where the cabin ends, as wide as the tub and as high as the windshield's
    foot. It is drawn down and in to a narrow rounded leading edge, with flush lamp strips along its flanks.
  - **The mass:** the battery sits low in the keel between the hips, and the hydraulic power unit under the tail.
  - **Its palettes:**
    - `proving`, the default: warm white over graphite;
    - `fieldOlive`;
    - `rescueOrange`;
    - `desertSand`;
    - `arcticWhite`.
- **The utility walker** (`utilityWalker`): a general-purpose work frame on the walker's locomotion.
  - **Its operator sits at the controls** (the cycle shelf's new `operator` posture card): belted into a suspension
    work seat on a platform over the pelvis, with a rail round it at the waist. The arms are worked from a stick on
    each armrest's console, and the walker by the pedals at the feet. It is boarded by a two-rung ladder at the back,
    and the torso frame's hoop is over the head.
  - **Its legs bend at the knee forward**, as a person's do (the shelf's legs take either bend). The rams are bored up
    and the feet enlarged for its weight and its load.
  - **Its arms are for assistive strength work.** Each has a shoulder yaw drive on the torso frame, a shoulder pitch and
    an elbow on rams, a rotary wrist, and a two-fingered claw. Their poses (`rest`, `carry`, `raise`) are solved by the
    arm's own inverse kinematics: the wrist's place from the shoulder, and the claw's angle.
  - **The mass:** the battery sits low in the keel, and the power pack on the torso's back as a counterweight to the
    arms.
  - **Its stances:** the walker's, plus `carry` (a load held ahead in both claws, the forearms level) and `reach` (the
    claws raised over the head).
  - **Its laws add the arms':**
    - each arm joint's actuator holding half the carry's load;
    - `reach`: its claws' farthest ahead, level with the shoulders;
    - `lift`: its rated load at the carry, 75% of the load that first tips it or overruns an arm's actuator, as a crane
      or a loader is rated.
- **Every joint is an actuator's** (the construction shelf's chain, `construction-shelf/con-chain.js`).
  - A pitch or roll joint is driven by a hydraulic ram across it. Its range is where that ram lies within its stroke:
    derived, never stated.
  - The hip yaw and the ankle roll are rotary drives with stops and a rated torque.
  - Each ram's barrel is on the body nearer the hip, so the leg's mass stays high.
- **A stance is solved by where the feet are** (`mecha-ik.js`). The leg's inverse kinematics is closed form, with the
  ankle a cross: any foot within reach is set at any heading, sole flat. A stance names its pelvis height (or the knee
  bend that sets it), its track, the feet's places, lifts and headings, and a sway. A sway carries the centre of mass
  over one sole for a static step.
  - The named stances are `stand` (knees bent 45°, clear of the straight leg's singularity), `board` (crouched to be
    climbed into, the feet set back under the folded knees), `stride`, `lift` (on one foot, the other raised) and
    `turn`.
  - A pose may also be a stance of the operator's, or joint values.
- **The laws** (`mecha-laws.js`) are measured from the frame as built and posed:
  - each ram's arc;
  - every stance held within its joints' ranges;
  - the standing knee's bend;
  - static stability on both feet (the centre of mass's margin inside the soles' polygon);
  - the sway on one foot;
  - each actuator's share of its rating holding the frame still (a ram's force from its moment arm at the pose, against
    its push or pull at the system pressure);
  - ground pressure on one sole;
  - the step-up height and the stride reach;
  - the saddle's or the seat's height standing and crouched, and the boarding step's;
  - the tip-over (fallen on its side, it lands on its cabin and legs, never on the rider);
  - the legs' clearance from the rider's space at every stance;
  - the parts' mass against the class's, and the share of a leg's mass below the knee.
- **In the registry:**
  - `all-terrain-walker` ('riding walker', 'bipedal walker', 'walking machine'…): the role `trail`, the era `future`.
  - `utility-walker` ('work walker', 'power frame', 'walking loader'…): the role `work`, the era `future`.
  - The new handle, `mecha`, points into the shelf's archetypes.
  - Their realistic builds are at `preview` status: the studio grid only, until its gait is built.
  - The `mech` row stays the battle mech's concept.
- **The cycle shelf's riders:** a posture card may say `headUp`, degrees the head is raised besides its `gaze`
  (`cycle-shelf/cycle-rider.js`). The new cards `walker` and `operator` use it; no existing card changes.
- **On the studio grid:** `mint_solid({ kind: 'vehicle', vehicle: 'all-terrain walker', pose?, palette?, rider? })`
  draws it at a stance through the family layer's `mecha` instance (`mecha-figure.js`). `rider: true` seats the
  realistic hero astride it. The rider is solved in the pelvis's frame and carried with its sway
  (`seatRider`).
- **Review:** `scripts/render-mecha.mjs` (stances × views, `--rider`, `--palette`).
- **Held:**
  - `mecha-shelf.test.js`: each foot where its stance asks, sole flat, at its heading; every ram within its stroke at
    every stance; a shorter stroke gives a shorter arc; the knees bend backward; the legs mirror; the sway puts the
    centre of mass over the stance sole; the rider is astride; the laws hold.
  - `mecha-shelf.char.test.js`: a byte pin per builder path (a kind and its family) and on the whole walker.
  - `mecha-shelf.test.js`, the frame with arms: its knees forward; each wrist where its pose asks, its claw at the
    asked angle; a load weighed (the centre of mass moves toward it, the arms work harder); every law holds.
  - The roster's, builds' and preview door's tests.
