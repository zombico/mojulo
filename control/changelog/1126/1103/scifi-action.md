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
- **Backpacks** (`mecha-shelf/mecha-backpacks.js`, `mecha-backpack-parts.js`; `backpack`, `weapons`): the giant arm
  pack's functional cousin. A frame's back is fitted for a job, with no heavy arms. A backpack card names:
  - its frame in the power pack's place, and its mounts each side, each a traverse ring and an elevation cradle on
    rotary drives;
  - the payloads they take, and a spare magazine racked each side;
  - a service tail;
  - the parts it asks the frame to carry heavier (a sku for a sku);
  - its mass on the class's, and its laws.

  A frame offers the backpacks it takes (`backpacks`); the field walker takes the weapons backpack and the functional
  ones below.
  - **The weapons backpack:** the power pack sits under a magazine bay, with a pylon each side out to a weapon mount
    beside the rider. Its payloads (`MECHA_WEAPONS`, generic and invented) are a rotary machine gun with its
    ammunition box and feed chute, and a launch rail under a five-round rocket pod. The pod is the launcher's magazine
    and is swapped whole. The gun takes the right mount and the launcher the left by default; `weapons: { r, l }`
    swaps them.
  - **The service tail, a scorpion's:** a yaw drum on the bay's top, two armoured segments and a gripping head with
    its own camera, each joint an electric rotary drive. It stays tucked down the bay's back, folded against it, until a magazine is to be switched.
    It is solved by its own inverse kinematics (`mecha-ik.js tailAt`): yawed toward a service point, its root segment
    raised past the line to it, the outer segment bent back down, the head straight down onto the magazine's lug.
    Its service points (`TAIL_POSES`): each weapon's magazine (reload), each spare in its rack (fetch), and the drop
    behind, where a spent magazine is let fall. Swapping a magazine from behind is the sequence of stances:
    reload, drop, fetch, reload.
  - **New stances:** the tail's service stances, and `brace` (crouched, a foot set back) to fire from.
  - **New laws** (`mecha-laws.js`):
    - `tailTorque`: the tail's hardest-worked drive holding the tail and a magazine still at every service point.
    - `recoil`: a payload's sustained recoil at muzzle height against the frame's weight on its lever to its heels,
      braced. Standing, the gun would push it over; braced, it holds.
    - `backblast`: the rockets' backblast behind the breech, clear of the rider.
    - `fireClear`: each payload's line of fire at either end of its traverse, clear of the rider.
    - The clearance law now keeps the tail and the payloads out of the rider's space.

  Carrying it, the field walker stands on heavy-duty hip roll rams, and its laden step's band starts lower. Every law
  holds, with the open cabin or the armoured one.
- **Functional backpacks and roles** (`mecha-backpacks.js`, `mecha-backpack-parts.js`; `backpack`, `weapons`, `role`):
  - **Functional payloads** on the same mounts, each with a magazine the tail hot-swaps and a spare racked:
    - a sensor mast: three telescoping tubes, an electro-optical ball, a radar panel, and a battery cassette;
    - a four-drone launcher: a cassette of cells raked up toward ahead, a folded rotor drone behind each door;
    - a smoke discharger: two rows of cups, raked up and fanned out;
    - a four-cell anti-air launcher, its pod the magazine;
    - a cargo carrier: a tray, posts and a rail round a strapped supply crate, the crate the magazine, handed down to
      the drop behind by the tail;
    - a recovery winch: its drum of cable between cheeks, its motor, a fairlead ahead and a hook; the cable reel is
      the magazine.

    A payload that fires nothing (`fires: false`: the mast, the carrier, the winch) has no line of fire, and the
    `fireClear` law skips it. The weapons backpacks also take the smoke discharger.
  - **Backpacks on the weapons backpack's frame**, each offered by the field walker: reconnaissance (a sensor mast and
    drones), logistics (cargo carriers, a winch) and air defence (anti-air missiles, a sensor mast, a rotary gun).
    A backpack whose weight rides behind leans the frame (`lean`): it stands with its hips carried ahead of its feet,
    its centre of mass over them, as one leans under a heavy pack.
  - **Roles** (`MECHA_ROLES`; `role`), as the civilian worker's tasks are its site's: a loadout each, a backpack, its
    payloads by mount and the cabin it asks. They are assault, escort, fire support, reconnaissance, screening, air
    defence, resupply, recovery and bombardment. A frame takes a role whose backpack it offers, or whose payloads its
    own backpack takes: the rover walker is fitted for assault or escort by rearming its heavy weapons backpack, and
    the siege walker is fitted for bombardment as built. The operator's own `backpack`, `weapons` and `cabin` override
    the role's. A role a frame cannot carry is refused, naming what it takes.
  - Every role holds every law on every frame that takes it.
- **The rover walker** (`roverWalker`; registry row `rover-walker`, role `armour`): the field walker on four wheels,
  more heavily armed. It walks, or collapses its legs and rolls as a small armoured car.
  - **Its size:** its own legs and pelvis at 1.35 times the walker's designs (the field walker's are 1.2), with
    shanks a wheelbase long, an armoured car's wheels, and rams and drives rated up for its weight.
  - **Its hull:** its armoured cabin is its own, the open one the option (`cabin: 'open'`, lighter, its cab law off).
    Each shank carries an armour skirt outboard of its wheels, over their upper halves and the gap between, its lip
    turned in over their tread. Collapsed, the skirts are the hull's sides and fenders; walking, they are shin armour,
    short at the ankle so they clear the ground.
  - Collapsed, its legs stand plumb, their roll undone, so the wheels stand upright. Its feet are tall enough that,
    walking, on one foot with its leg rolled under it, nothing but its feet comes near the ground.
  - **Its legs:** a wheel on each knee's axis and one on each ankle's, outboard, each coaxial with its joint and on its
    own hub motor, skid-steered each side. Its shanks are longer for a four-wheeler's wheelbase, its ankle rams
    re-sized with them, and its feet taller so the ankle wheels ride clear when it walks.
  - **Its knees are rotary drives, not rams.** The field walker's knee ram bottoms out near 130°, which no backward
    knee can fold past into a collapse. A drive folds the rover's knee to 165°.
  - **Collapsed** (its `roll` stance, solved in `mecha-ik.js`): the thighs rake back toward level, and the knees fold
    until the shanks lie level, so both wheels stand on the ground. Each foot pitches, across its ankle's range, to hold
    its sole highest: folded up ahead as a fender. It is boarded collapsed, as a four-wheeler is.
  - **Armament:** it carries the heavy weapons backpack as built (`MECHA_BACKPACKS.heavyWeapons`): an autocannon right,
    its box magazine on the side and a muzzle brake, and the five-round rocket launcher left, with the service tail.
    `weapons` swaps its payloads; another backpack is refused. It fires collapsed on its wheels, its longest and lowest
    footing (its `fireStance`).
  - **New laws:**
    - `rollContact`: all four wheels on the ground;
    - `rollClearance`: what the wheels carry clear above the ground;
    - `rollStability`: the centre of mass inside the wheels;
    - `rollActuators`: the legs' rams holding it, its wheels' loads on them.

    Stability, recoil and boarding read the wheels' contacts when a stance is collapsed, and the crouch's actuator
    check skips a collapsed boarding.
  - **The dress:** the field walker's (any camo livery, its wear). A cabin is previewed alone on the frame that offers
    it, a backpack's parts on the frame that offers backpacks.
  - Every law holds as built, with the armoured cabin, and rearmed with the rotary machine gun.
- **The siege walker** (`siegeWalker`; registry row `siege-walker`, role `armour`): the rover walker's principles at
  2.5 times its size, some 33 t and 10.8 m standing.
  - **Its legs:** at 3.375 times the walker's designs; knees on rotary drives; shanks 3.6 m long, each carrying a
    third wheel between the knee's and the ankle's. Collapsed, it rolls on six, its footprint reaching far ahead of and
    behind its hips: a 3.6 m wheelbase and a 4.4 m track.
  - **Its cockpit, human-sized, rides out ahead on a keel** (`mecha-field-parts.js` `keeledPelvis`): a V-bottomed
    armoured prow off the pelvis, its deck railed, a ladder down its side. The rider's space is carried out to it, and
    the cab law holds it there. The armoured cockpit's camera is augmented by a radar dome, half a sphere on a collar, on the hull's top. A rotary
    machine gun sits on its own ring and cradle on the cockpit's side.
  - **Its siege backpack** (`MECHA_BACKPACKS.siege`): the weapons backpack's frame at 2.5 times.
    - A howitzer right: its long barrel, fume extractor, muzzle brake, recoil cylinders and breech, and its autoloader's
      six-round shell cassette (the magazine). Its recoil is what a long-recoil mechanism leaves, read with the frame
      collapsed on its wheels.
    - An eighteen-cell missile launcher left: three six-cell pods side by side, the outermost the magazine.
    - A spare of each racked.
    - **Twin scorpion tails**, one each side (`twin`). Each serves its own side's payload, spare and the drop behind,
      while the other stays tucked (`mecha-ik.js tailAt`). The tail law reads both.
  - **Its side profile, reshaped:**
    - A hull fills the gap between the backpack and the cockpit: an armoured superstructure on the keel, its sides
      sloped, its top stepping down to the cockpit, with hatches, vents and rails.
    - Its weapons are mounted lower and wider on their pylons beside the hull, which lowers its profile and its
      recoil's lever.
    - Its thighs are heavier, with overlapping front armour plates and a knee cop (`platedThigh`).
    - Its shanks are shorter, standing deeper bent as a T-rex balances, its three wheels in line along each shank, the
      front one well above the ankle.
    - Its feet are long, pushed forward of the ankle, their toes ahead on the ground for its balance.
  - **Its feet clawed, its sides a tank's:**
    - Each foot is a short, low palm on a cleated sole, a heel spur raked back behind it and two thick toes ahead
      (`clawedFoot`), their knuckles close ahead of the heel. The toes splay out in a V (`TOE_SPLAY_SW`, each toe's
      mount turned to it) for its footing. Each toe is two segments, a root and a claw, their own bodies (`mecha-toe`,
      `toe1-sw` and `toe2-sw`) on knuckle drives, with a joint line between them. Walking, the toes lie flat, their pads on the
      ground, and the sole's outline runs out to their claws. Collapsed, they clench down and under the palm's front.
    - A clenched toe hangs below the sole. Each shank's ankle is therefore cranked forward of its axis (`ankleFwd`),
      toward its front, which points straight up when it lies level: rolling, the ankle stands a crank's throw higher
      over the ground, and its clenched toes clear it. The leg's inverse kinematics solve the line from knee to ankle
      and turn the knee back by the crank's angle (`mecha-ik.js` `legGeometry`'s `e2`). If they still would not
      clear, the foot is tilted up from level, the nearer way, until they do (`foot: 'level'`, `clear`).
    - Walking, the crank brings the shin's lower end nearer the ground: its front wheel rides higher up the shin, its
      skirt stops shorter of the ankle, and its ankle ram was sized again from its length curve.
    - A sponson each side of the hull: a box of plates out from the hull's side over the hip and the top of the thigh,
      open below for the leg to swing in, its ends raked, its deck the weapons' shelf, with a belt of armour along its
      middle, a stowage bin, bolts and a lip along its foot. Collapsed, it rides over the wheels as a tank's side does.
  - **Collapsed**, each foot is laid level out ahead of its front wheels (`foot: 'level'`), crawling forward on its toes.
    Its ankle ram runs down the shin's front to a horn ahead of and above the cross. The ram was sized from its length
    curve over the ankle's working arc: a first horn put its dead centre right at the level foot.
  - Every law holds, its bands set for its class from what was measured.
- **The brood walker** (`broodWalker`; registry row `brood-walker`, 'bug mom', 'drone mother', role `transport`): a big
  four-legged frame that carries drones, some 30 t.
  - **Its hull** (`mecha-brood-parts.js` `hangarPelvis`): tall and round-topped, short from the side, its nose round, a
    single hangar through it with its door open each side; inside, its frames, a gantry and its print head under the
    roof (the hangar repairs drones and prints their parts), a cradle on the deck. Its cockpit is inside the nose behind
    a visor slit; the armoured cabin holds the rider's space there, and the cab law reads it.
  - **Its rear car** (`rearCar`): the hull's front profile drawn boxier, coupled behind it with a gangway as a train's
    car, its sides panelled, a door, roof hatches, its lamps.
  - **Its legs:** four, from hips low on the hull's sides (each a bracket and its web braced up the hull's flank), so
    the mechanism sits low and the hull rides up in the middle of the frame. Each is a light hip bearing and its drive,
    a hub with a horn, a hollow upright column (four corner posts framed and plated, open through), the knee's machinery
    low (a great drum, its gearbox, its motor), a short shank, and a cradle with the bay's pivot under it. Each leg's
    lift is a hydraulic ram (`ram-hip-bw`) from the hub's horn to the column's eye, beside the hull: extended, it swings
    the column down and pumps the hull up to stand; retracted, it lets the hull down to drive. The other joints are
    rotary drives. The frame reads heavy at its foot.
  - **Its feet are eggs** (`bayPod`, `eggPetal`, `eggFork`; the numbers in `mecha-egg.js`): each egg holds a drones'
    bay inside (a hollow core, open underneath and at its blunt end) with its wheels in pairs under it. Each egg's
    shell is a superellipse section, squarer than a circle, drawn along its length from a narrow end ahead to a blunt
    end behind. Its narrow end is a fixed cap, and its body's shell is closed in four quarters, its lower quarters
    arched over the wheels. Only its blunt end is cut into four petals, each hinged on the cut.
    - The leg holds the egg by a hub through its narrow end, in a fork whose bridge spans the narrow end and whose
      cheeks reach down to the hub. The fork swivels on a slewing ring under the ankle (`swivel`). A leg turned toward
      where its foot stands still sets its egg square to the frame, so its petals stand square walking and its egg lies
      along the hull driving.
    - Walking, each egg hangs from its hub, narrow end up, its body closed. Its four petals open out and down to the
      ground like a lander's feet, each a heavy plate with a rib down its spine and a pad under it; each petal opens its
      own angle so all four reach one ground. The foot's sole is the square their pads stand in, and its ground
      pressure is the pads' own area (a sole may now say its `contact`).
    - Its legs reach well out to their feet, spread fore and aft of the hips. Each leg `aim`s, turned at its hip to
      point at its foot wherever a stance sets it, an insect's coxa (`atYaw` at rest). Its turn carries its feet round
      its centre. So its hull rides low between knees raised over its hips: an M from the front.
    - Driving (its `roll` stance, `place: 'tuck'`), each egg swings down onto its wheels, narrow end ahead, its petals
      shut. A side's two eggs lie nose to tail along the hull, and the leg tucks its foot lower under its ankle than it
      stands (a tuck's `lift`).
    - Its pelvis stands 7.8 m up and drives at 5.15 m, its crouch to be boarded at 7.3 m with its feet spread.
  - **Its drones** (`mecha-drones.js`): the craft shelf's own, assembled in its military look, eight by default (the
    inspection quad), two hung from each bay's roof inside. At the `launch` stance each drops out of its egg's opened
    blunt end and hovers clear of it, ahead of it. The words `drones` (how many, up to its bays) and `drone` (which of the craft
    shelf's) choose them. New laws: `droneGround` (the drones off the ground, docked at every stance and launched) and
    `droneClear` (each clear of the frame's bodies but its own bay, and of the other drones).
  - **Its solar backpack** (`MECHA_BACKPACKS.solar`): the rear car is itself the array, built to fold origami-style
    (`mecha-solar` parts: a deck, wings, leaves). Its roof is a deck of cells; its sides are wings, each hinged at the
    deck's edge and carrying a leaf folded back on it. At its `unfold` stance the wings swing out level from the car
    and their leaves open out from them, flat; at its `deploy` stance the deck then tilts its back up, the whole array
    with it, to the sun. A backpack card may now carry no mounts and no tail (`array`), and its own stances. New law:
    `solarArea` (the cells' area, every solar part summed).
  - **The shelf on four legs:** the inverse kinematics and the laws read a frame's own legs, a biped's `r` and `l`
    (every existing frame byte for byte as before), a four-legged frame's `fr`, `fl`, `rr`, `rl`.
    - A leg may be mounted turned (`turn`, `mount`, `yawSign`), its foot's rest place its `at`, its tucked place its
      `tuck`.
    - A sway may be a set of feet.
    - On three feet each stance leg carries its share of the weight by the statics, and in the crouch the least-norm
      shares.
    - A joint a stance's flag sets is `when` (an egg swung down to drive, its petals shut, an array spread to
      `deploy`), with its rest `at`.
    - The leg's inverse kinematics solve a cranked shank (an ankle off its axis) too, and an ankle above the hip's
      roll axis (a leg folded high), its plane turned the least way; a leg that `aim`s takes its heading from where its
      foot is (`legYaw`).
  - Every law holds at every stance, with the solar backpack and with any count of drones.
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
  `--pack-task`, `--pack-tools`, `--pack-maker`, `--cabin`, `--slits`, `--backpack`, `--weapons`, `--role`, `--drones`,
  `--drone`, `--livery`, `--wear`).
- **Where the vehicles are written down:** the shelves that build vehicles (road, the mecha shelf's legged frames, the
  craft shelf's aircraft and boats, the rail shelf) are mapped file by file in `docs/vehicles.md`; the root agent notes
  keep only the registry's rule and a pointer to it.
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
  - `mecha-shelf.test.js`, the backpack: in the power pack's place with its payloads, tail and heavier parts, its mass
    on the class's; the tail's grip on every service point within its drives' stops; its torque, recoil, backblast and
    line of fire holding; its payloads swapped side for side with every law holding; what it does not take refused.
    The char pins add its builder paths and a frame carrying it whole.
  - `mecha-shelf.test.js`, the rover walker: its knees folding past a ram's reach on rotary drives; each wheel
    coaxial with its joint; walking with its wheels off the ground, rolling on all four with what they carry clear and
    steady, lower than it stands, every law holding; walking, standing or on one foot, nothing but its feet near the
    ground; its backpack's payloads swapped, another backpack refused, and a
    frame without wheels refused a roll. The char pins add its wheeled parts, its wheel and the autocannon, and the
    frame whole walking and collapsed.
  - `mecha-shelf.test.js`, the brood walker: four feet where its stance asks, each egg hung narrow end up, its hub's
    axle across the frame whatever its leg's heading, its four petals' pads on the ground spread wider than its bay; its
    hips low on the hull's sides and its lift rams longer standing than driving, every law holding; tucked to drive, its
    eggs lying along its hull, narrow end ahead, petals shut, lower than it stands, on its wheels, a side's two nose to
    tail and clear of each other; its drones launched out of their bays, clear of it, their count and kind the
    operator's, too many refused; its solar car folded stowed, its wings and leaves open unfolded, and its deck tilted
    deployed. The char pins add its parts and the frame standing, launching and driving; every earlier frame's pin is
    unchanged.
  - `mecha-shelf.test.js`, roles: a role's backpack, payloads and cabin taken, every law holding; no line of fire for
    a payload that fires nothing; the lean under a pack whose weight rides behind; the operator's payloads over the
    role's; a role a frame cannot carry refused; a backpack carried as built rearmed for a role. The preview door's
    test carries a role's word in the recipe. The char pins add the new payloads' builders.
  - `mecha-shelf.test.js`, the siege walker: six wheels, its footprint more than 2.5 times the rover's, every law
    holding; its cockpit out ahead on its keel with the rider's space, its radar dome on the hull and its side gun; each payload served
    by its own side's tail, the other stowed; its feet laid level ahead, its footprint more than 2.5 times the rover's;
    standing as a T-rex balances, its toes ahead of its ankles, nothing but its feet near the ground walking; its toes
    flat on the ground standing and clenched clear of it rolling, its sponsons over the wheels. The char
    pins add its plated thigh, its clawed foot and its toes, its keeled pelvis, its howitzer, its missile launcher,
    its spare pod, and the frame whole walking and collapsed.
  - The roster's, builds' and preview door's tests (a dressed frame's livery and wear carried in its recipe, its
    cabin, its backpack, a frame on wheels collapsed by its stance).
