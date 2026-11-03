### The mecha shelf: ridden walkers on real-robot principles

In progress. A new shelf, `control/lib/graph/mecha-shelf/`, for legged machines a rider sits in, built from the ground
up. It starts with the all-terrain walker, the base of its bipedal locomotion, and grows a general-purpose work frame
on it: the utility walker, the heavy walker drawn larger from it, and the giant arm walker carrying a giant arm pack.

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
- **The heavy walker** (`heavyWalker`): the utility walker's frame drawn larger for heavy construction, in the site's
  yellow (the new `siteYellow` palette).
  - **Drawn larger.** Its legs, pelvis and arms are the utility walker's designs at 1.4 times their lengths. Its feet
    are at 1.6 times, for its weight on soft ground, and its power pack at 1.5, as a counterweight to the arms.
    - A part at another size is another row's design scaled whole (`dims.scale`, its `from`), as the construction
      shelf's are: its pins at k times, its mass at k³, a drive's rated torque at k⁴.
    - Its rams scale with their pins, so every joint keeps its design's arc.
  - **Its operator stays a person's size, in a closed cab:**
    - an angled shell: the windshield raked back under the roof's visor, the upper sides drawn in to the roof;
    - a falling-object roof with guard bars, on its pillars;
    - framed glass all round, the side windows' top rear corners cut on the slant, and a low window in the front
      panel to see where the feet go;
    - guard bars along the windshield's rake, against what flies off the work;
    - a door on the left, reached by a four-rung side ladder;
    - mirrors, work lamps and a beacon;
    - a harnessed work seat, the arms' sticks on its consoles, an emergency stop at the right hand, and the pedals.
  - **Its laws add `cab`:** the operator's space held inside the cab's glass and under its roof, the nearest margin.
- **The manipulators' ODM** (`mecha-shelf/mecha-tools.js`, `mecha-tools-parts.js`): the heavy walker is modular, its
  arms fitted for the task rather than built for it.
  - **Its tools** go on the wrist's quick coupler (every tool carries the same coupler plate) in the claw's place. Each
    is an inventory row for its geometry and a card for its work: what it does on a site, the load it holds as rated
    (none for a breaker or an auger), what drives it, and the hydraulic flow it draws.
    - the grapple, its own;
    - a digging bucket;
    - a hydraulic breaker;
    - a concrete crusher;
    - pallet forks;
    - an earth auger;
    - a vacuum lifter;
    - a lifting magnet;
    - a lifting hook.
  - **Its arm kits:** the standard arm and a long-reach arm (a forearm a third longer on the same elbow, so its ram
    keeps its arc).
  - **Its tasks**, each a loadout per arm:
    - demolition: a breaker and a crusher;
    - high-reach demolition: a crusher and a grapple on long arms;
    - trenching: a bucket and a grapple;
    - pipe laying: two grapples;
    - material handling: two pairs of forks;
    - glazing: two vacuum lifters;
    - piling: an auger and a grapple;
    - steelwork: a magnet and a grapple;
    - rigging: a hook on a long arm and a grapple.
  - **A frame's `mount`** says the tools and arm kits it takes, and its own loadout. `composeFrame(id, { task, tools,
    arms })` fits it under its own key (the construction shelf's `composeMachine` is the model), refusing what its mount
    does not take. The laws re-read it as built: its mass, its reach to the tool's working point, its lift, its flow.
  - **Its lift is rated as a lifting machine's is** (ISO 10567's shares): the least of 75% of the load that tips it,
    87% of the load its arms' actuators hold, and what its tools hold as rated. A loadout whose tools hold nothing
    reads no lift, and a load is shared only by the arms whose tools hold. The carry is read at its stance's load, no
    more than it is rated for.
  - **A new law, `flow`:** both arms' tools working at once, their flow as a share of the power pack's pump.
  - **What the laws asked of the build:**
    - the heavy hip roll ram was bored up past its design's, for the heaviest tools' sway on one foot;
    - the heavy wrist is a heavy-duty rotary actuator, rated past its design's, so its arms' rams, not its wrist,
      set what it lifts, and a long arm trades lift for reach.
    - An arm's poses are shares of its length, the same pose on a standard arm and a long one.
  - **On the studio grid** the door takes the words beside the vehicle: `task` ('demolition'), `tools` ({ r, l }) and
    `arms` ({ r: 'long' }), and a pack's `packTask` and `packTools`. The review render takes `--task`, `--tools
    r:breaker,l:grapple`, `--arms r:long`, `--pack-task heavyLift` and `--pack-tools r:spreader,l:giantHand`.
- **The giant arm walker** (`giantArmWalker`): a frame built to carry a giant arm pack. It keeps the heavy walker's
  closed cab, its station and its modular arms.
  - **A more robust pelvis and legs:** the utility walker's designs at 1.6 times their lengths (the heavy walker's are
    1.4), its feet at 2.2 times. Its hip roll and knee rams are bored up past their design's. The laws asked for each:
    the crouch overloaded the knees, one foot overloaded the hip's roll with the heaviest pack tools on, and the sole's
    pressure was over the band before the larger feet. Its side ladder reaches lower, for the taller frame.
  - **The giant arm pack** (`gap-gw`), a backpack for work: a frame against the cab's back, its own power unit and
    cooler, a yoke across its top, and two towers up and out to the giant arms' shoulders over the cab's roof. Its pump
    feeds every arm's tools.
  - **The giant arms:** the utility walker's arm drawn twice as large, on the same factory as the frame's own (a second
    arm set, `packArms`, named under `giant`). Their shoulders are armoured blocks round the joint, the arm coming out
    from under them. Their wrists are heavy-duty rotary actuators, and their own tool is a new three-fingered giant
    hand.
  - **Its stances:** the giant arms `stow` folded (the hands ahead at the chest), `heave` a load ahead in them, and
    `hoist` them overhead.
  - **Its laws read the pack's arms as the frame's are read:** `packReach`, and `packLift` at the heave, rated the same
    way.
    - A stance's `loadOn` says which arms hold its load.
    - The flow law sums every arm's tools against the pump.
    - The clearance and tip-over laws take the giant arms with the rest.
- **The pack's tools** (on the giant arms' larger coupler, `packMount`), each with its card:
  - the giant hand, its own;
  - a giant grapple;
  - a rescue spreader;
  - a shoring prop (it holds a slab up from the ground, not from the arm: it reads no lift);
  - a shear (a felling head, a steel shear);
  - a vibratory pile driver;
  - a clamshell grab;
  - a giant hook.
- **The pack's tasks** (`MECHA_PACK_TASKS`; `packTask`, or the operator's own `packTools`):
  - heavy lifting (two giant hands);
  - disaster response (a hand and a spreader);
  - shoring (two props);
  - forestry (a shear and a grapple);
  - pile driving (a vibratory driver and a hand);
  - debris clearing (a clamshell and a hand);
  - heavy rigging (a hook and a hand).

  `composeFrame` fits the frame's arms and the pack's together under one key.
- **Giant arm packs by design house** (`mecha-shelf/mecha-gap-makers.js`, `mecha-house-parts.js`; `packMaker`): a
  house is a philosophy card, solved into its own pack and giant arms. Four generic houses, none a real maker's:
  - forge: strength first. Short, deep plated arms, armoured shoulders, hydraulics, a four-fingered hand.
  - aero: reach first. Slender tube arms, a long forearm, electric screw actuators, faired shoulders on one mast.
  - truss: service first, built like a crane. Open lattice towers and arms, a parallel gripper.
  - sealed: protection first, for hazardous sites. Every joint under bellows, closed shells, electric actuators.

  The solver, for each house:
  - proportions the arm from the card's size, forearm share and section;
  - places each ram's pins by a fixed search, so the joint turns the whole arc the arm's poses ask. The search keeps
    within the house's spread off the beam and takes the largest least moment arm;
  - sizes each actuator by statics at the heave for the house's rated load: a ram's bore at the system pressure, or a
    screw actuator's rated force;
  - dresses the parts in the house's construction and livery.

  The house's rows are solved the first time one is read. `composeFrame` swaps the pack, the giant arms' parts and
  rams, and puts the house's hand in the giant hand's place; a pack task's other tools stay as they are. The laws then
  hold the frame as built. The houses trade reach for lift, and every house passes every law at every pack task. A
  screw actuator is rated by its force both ways (`ramForce`). The pack's reach band is widened to 4.5 m for a long
  forearm with a prop.
- **The field walker** (`fieldWalker`; registry row `field-walker`, role `scout`): the all-terrain walker hardened as a
  military all-terrain transport. It carries no weapons. Its knees bend backward and its rider sits astride, as on the
  walker.
  - Its frame (`mecha-field-parts.js`) is the walker's drawn 1.2 times larger for clearance and step:
    - its thigh and shank beams carry a bolted guard plate down their outer flank;
    - its belly sits under a skid plate raked up at both ends, with four recovery points;
    - its feet are drawn at 1.5 times and cleated, the lugs never below the sole the legs are solved to;
    - its cabin is behind a brush guard, a second bar across the hoop;
    - its power pack sits in a cargo rack;
    - its saddle's boarding step hangs lower for the taller frame.
  - Against the walker it measures steadier (its standing margin 0.17 m against 0.10), presses softer ground (34 kPa
    against 46), and steps higher and farther. A new law, `belly`, reads how far its lowest carried body stands off the
    ground.
  - Its dress (`mecha-military.js`) is the military styling library's (car-designer), applied to the frame's faces as
    to a field vehicle's hull:
    - the frame is assembled unlit and its faces read back by colour;
    - its kit is fitted on anchors its parts declare: pioneer tools, an antenna, a jerry can each side, a tarp roll,
      shackles at the recovery points;
    - its number is stencilled each side;
    - a `livery` (any camo or mono) is cut into its paint, its structure a shade down;
    - its `wear` (used unless asked) cakes mud low on its legs, dust, fade and grounding;
    - it is baked under the studio's light.
  - **An optional closed armoured cabin** (`cabin: 'armoured'`; the open cabin stays the default). It is a shell of
    plates round the rider in the open cabin's place, with no glass:
    - vision slits at the rider's eye level across the glacis and at each side, each under an armoured lid hinged at
      its brow, swung up as a visor over the slot or shut flush (`slits: 'open' | 'shut'`, the part's state);
    - a camera unit on the roof's front is the main vision: a pan ring, an armoured housing, twin lenses under a hood,
      on a monitor inside before the rider's face. A small camera watches behind;
    - a door on the boarding side and a hatch in the roof; armoured lamps behind grilles; the brush guard round the
      nose as before;
    - the field kit's anchors are on its plates.

    A frame's `cabins` name what it may carry (`mecha-archetypes.js`): the closed cabin's mass is added to the class's,
    and the `cab` law holds the rider's space inside its walls. It holds every law with the rider 4 cm inside its back
    at the nearest.
  - It is olive drab by default (a new palette, `oliveDrab`, the field's olive). `livery` and `wear` are words of a
    dressed frame on the door, the figure and the render script (`--livery`, `--wear`); a frame with no dress refuses them.
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
  - `heavy-walker` ('construction walker', 'site walker', 'walking crane'…): the role `work`, the era `future`.
  - `giant-arm-walker` ('gap walker', 'four arm walker', 'heavy lift walker', 'rescue walker'…): the role `work`, the
    era `future`.
  - The new handle, `mecha`, points into the shelf's archetypes.
  - Their realistic builds are at `preview` status: the studio grid only, until its gait is built.
  - The `mech` row stays the battle mech's concept.
- **The cycle shelf's riders:** a posture card may say `headUp`, degrees the head is raised besides its `gaze`
  (`cycle-shelf/cycle-rider.js`). The new cards `walker` and `operator` use it; no existing card changes.
- **On the studio grid:** `mint_solid({ kind: 'vehicle', vehicle: 'all-terrain walker', pose?, palette?, rider? })`
  draws it at a stance through the family layer's `mecha` instance (`mecha-figure.js`). `rider: true` seats the
  realistic hero astride it. The rider is solved in the pelvis's frame and carried with its sway
  (`seatRider`).
- **Review:** `scripts/render-mecha.mjs` (stances × views, `--rider`, `--palette`, `--task`, `--tools`, `--arms`,
  `--pack-task`, `--pack-tools`, `--pack-maker`, `--cabin`, `--slits`, `--livery`, `--wear`).
- **Held:**
  - `mecha-shelf.test.js`: each foot where its stance asks, sole flat, at its heading; every ram within its stroke at
    every stance; a shorter stroke gives a shorter arc; the knees bend backward; the legs mirror; the sway puts the
    centre of mass over the stance sole; the rider is astride; the laws hold.
  - `mecha-shelf.char.test.js`: a byte pin per builder path (a kind and its family) and on the whole walker.
  - `mecha-shelf.test.js`, the frame with arms: its knees forward; each wrist where its pose asks, its claw at the
    asked angle; a load weighed (the centre of mass moves toward it, the arms work harder); every law holds.
  - `mecha-shelf.test.js`, the frame drawn larger: a scaled part's pins at k times and its mass at k³; its operator
    inside its cab; its arms' arcs its design's; every law holds.
  - `mecha-shelf.test.js`, the modular frame: a tool in its claw's place (its mass the tools' difference); a task its
    loadout, and what its mount does not take refused; its lift no higher than its tools hold, and none read when
    neither holds; its tools' flow summed against its pump's; a long arm trading lift for reach; the loadouts' laws
    hold.
  - `mecha-shelf.test.js`, the giant arm pack: its arms solved as the frame's are; a load weighed where it is held, the
    pack's lift rated apart; a pack task its loadout, a prop reading no lift, a frame with no pack refused; every arm's
    flow summed; the frame and its hardest pack task holding every law.
  - `mecha-shelf.test.js`, the design houses: each ram's joint turning its arm's whole arc, wider pins for a wider
    spread; the lift reaching the house's rating unless the frame tips first; a screw rated by its force; reach traded
    for lift by the forearm's share; the livery on the house's parts only, the operator's colours over it; the house's
    hand for the giant hand, unknown houses refused; a hydraulic and an electric house holding every law at their own
    loadout and their hardest pack task. The char pins add each house's builder path, a four-fingered hand and a
    house's frame whole.
  - `mecha-shelf.test.js`, the field walker: steadier, softer on the ground and stepping higher than the walker it
    hardens, every law holding; its cleated sole never below its solved sole; its kit's anchors where their bodies
    stand; its dress deterministic, its kit fitted, a camo cutting its paint, a harder wear caking more mud; a livery
    and a wear refused on a frame with no dress; its armoured cabin held round the rider, its mass on the class's, every
    law holding; no glass but the cameras' lenses; the lids alone moving between open and shut. The char pins add its
    hardened parts' builder paths, the armoured cabin open and shut, and its dressed faces whole.
  - The roster's, builds' and preview door's tests (a dressed frame's livery and wear carried in its recipe).
