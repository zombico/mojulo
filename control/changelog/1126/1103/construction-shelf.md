### The construction shelf: composable construction machines on the vehicle registry

In progress. The vehicle registry gains a handle, `construction`, into a new parts library for the machines that dig,
push, load, haul and lift on a site.
- **The machines:**
  - excavators (crawler, mini, wheeled);
  - the bulldozer;
  - the wheel loader;
  - the backhoe loader;
  - the skid steer and the compact track loader;
  - the telehandler and the forklift;
  - the tipper, the articulated dump truck, the haul truck and the mixer;
  - the mobile crane and the tower crane;
  - the road roller and the motor grader.
- **The structure:** each machine is layers on a shelf: a carrier, an upper, a front and a tool. The door swaps a tool
  or a carrier, and the laws read the machine as built.
- **The new capability:** a kinematic chain at assembly level. A part is placed on its parent's joint and inherits its
  angle. A hydraulic ram is solved between two bodies, and a linkage is closed as a four-bar.
- **Held:** reach, depth and dump height measured over the joints' ranges; rams within their strokes; tail swing;
  ground pressure; rated lift as a share of tipping.

- **The rows, the role and the classes** (`vehicle-registry/roster.js`, `roads/vehicles.js`,
  `construction-shelf/con-archetypes.js`):
  - **The role** `construction`: "it builds, digs, hauls or lifts on a site".
  - **The rows,** each under the words people say:
    - the excavator ('digger'), the mini excavator, the wheeled excavator;
    - the bulldozer ('dozer');
    - the wheel loader;
    - the backhoe loader ('backhoe');
    - the skid steer and the compact track loader;
    - the telehandler;
    - the tipper ('dump truck'), the mixer ('cement truck');
    - the articulated dump truck ('dumper'), the haul truck;
    - the mobile crane, the tower crane ('crane');
    - the road roller ('steamroller'), the motor grader.

    The forklift row takes its class. Each falls back to the crafter's tracked or truck concept until the shelf draws
    it. The tower crane never drives: it is parked and watched, and its size will be its own once built.
  - **Their classes,** with each machine's operator, [E]:
    - a 20 t crawler excavator, a 2.7 t mini, a 16 t wheeled one;
    - a 20 t dozer, a 15 t wheel loader, an 8.5 t backhoe loader;
    - a 3.3 t skid steer, a 4.3 t compact track loader;
    - a telehandler, a 2.5 t counterbalance forklift;
    - an 8x4 tipper and an 8x4 mixer, loaded;
    - a 30 t articulated dump truck and a 100 t rigid haul truck, loaded;
    - a five-axle all-terrain crane;
    - a 10 t tandem roller, a 17 t motor grader.

    A site machine's top speed is its published travel speed. A haul truck rolls on a haul road's resistance.
  - **How a class turns** (`STEERS`, `steerOf`): by its front wheels, its rear (the forklift), every axle (the
    telehandler, the crane), its frame bending (the loader, the dump truck, the roller, the grader), or skid (a skid
    steer, and every crawler). A word for the builders and the page; the drive rule does not read it. A skid-steered
    class is drawn and parked, as a tracked one is.
  - **The handle** `construction` → the shelf's `CON_ARCHETYPES`, empty until its first machine. The upscale ledger sends
    a site machine to the construction shelf.
  - **A site's class** says `site: true` (`siteClass`): its body is the construction shelf's. The car sheet refuses it as
    its class, naming where it is built, as it refuses a cycle's; its class dial stays the classes on axles that are not
    a site's.
  - **Held:**
    - `vehicles.test.js`: a crawler at its travel speed inside 2 s, a wheeled site machine 2.5–8 s to 20 km/h, a loaded
      tipper and mixer 35–65 s to 80, a loaded dump truck 40–80 s to 50; which tip before they slide; one class per way
      of turning.
    - `roster.test.js`: the handle's table frozen as every handle's is; a site machine's upscale.
    - `sheet.test.js`: the sheet refuses a site's class. `mil-track.test.js` reads the field's tracked classes only: a
      site's crawler is the shelf's.

    No byte pin moved.
- **The shelf, its chain and its first machine, the crawler excavator** (`construction-shelf/`: `con-common.js`,
  `con-odm.js`, `con-parts.js`, `con-chain.js`, `con-archetypes.js`, `con-laws.js`, `index.js`):
  - **The chain** (`con-chain.js`), the one new capability:
    - A layout entry sits `on` its parent's hardpoint, fixed or on a `joint` (a slew about the parent's +z, a hinge
      about its +x), and inherits the joint's angle. Every body is authored in its own frame, its pivot the origin, so
      a pose moves frames and never a part's geometry.
    - **A ram** is a barrel aimed from its base toward its eye and a rod aimed back, each a rigid body at its own length,
      so the rod slides in the barrel at every pose without being drawn again.
    - **A linkage** (the bucket's dogbones and H-link) is a four-bar the joint closes, its pin solved where its two
      links meet.
    - **A joint's range is its ram's:** where the ram's length lies between its closed length and its full stroke
      (derived, never stated), in the run the joint works `near`. Its ends are rounded inward.
  - **The parts of a 20 t excavator:**
    - the crawler (its track laid link by link on the military running gear's path and pins, `mil-track.js`, its
      sprockets, idlers, rollers and carriers, its frames and car body);
    - the slewing ring;
    - the upper (deck, hood, tank, the boom's foot);
    - the cab, with its glass, its lamps and its seat;
    - the counterweight, its tail an arc about the slew axis;
    - a banana mono boom, the stick and its heel, a digging bucket with its teeth;
    - the dogbones and the H-link;
    - the boom, stick and bucket rams.
  - **The machine** (`assembleMachine(archetype, { pose })`) at its named poses: rest (the bucket set down), travel,
    transport (folded for shipping), dig (the teeth at grade), dump, reach, slewed. A pose is a name, or joint values
    clamped into their ranges and said. A named pose is shares of each range, or `ground` (the joint lowered until the
    tool touches the ground).
  - **The laws, measured** (`con-laws.js`):
    - each joint's working arc;
    - the envelope swept over the ranges: reach along the ground, depth, cut height, dump height with the teeth plumb
      under the pin;
    - the counterweight's tail swing as built;
    - ground pressure;
    - the rated lift over the side at 6 m, 1.5 m up: 75% of tipping about the track's centreline, from every part's mass
      where it is built and posed (ISO 10567's share);
    - the parts' mass against the class's;
    - the bucket never entering the cab over the ranges;
    - the transport size folded (advisory).

    The 20 t machine reaches 9.56 m, digs 6.37 m, dumps at 6.94 m, cuts at 9.36 m, swings its tail at 2.85 m, stands at
    47 kPa and lifts a rated 2.8 t over the side.
  - **Found while building:**
    - The class's track gauge was a 20 t machine's too narrow (2.0 m): now 2.2 m, its width its shoes'.
    - The extruder reads an outline wound anticlockwise about its axis: a panel extruded toward −x, and a plan outline,
      now wind their own.
  - **The registry:** the excavator row claims the archetype. Its realistic build is the shelf's, asleep until a door
    draws it, parked and watched (a crawler is not driven until skid steer is built).
  - **Held:**
    - `construction-shelf.test.js`, the machine chosen in code by its linkage:
      - at every named pose each body on its parent's joint, each ram within its stroke with its rod's end on its eye,
        each link at its length;
      - each ram-driven joint's ends at its ram's closed and full lengths;
      - poses within their ranges and grounded;
      - the operator's joint clamped and said;
      - every law held;
      - a pose moving frames and never parts;
      - the slew turning the upper and never the undercarriage;
      - the words.
    - The char test pins every builder path, a ram's rod and the machine at rest.
    - The deep sweep walks every joint's range finely, and every named pose.
  - **Seen** (`scripts/render-construction.mjs`; machine gate only, the eyes gate is open): the excavator at rest, in
    travel, digging, dumping, at reach and slewed.
- **The chain grows, and the bulldozer:**
  - **The chain** (`con-chain.js`):
    - A pair of rams must both lie within their stroke: a range is where every side's does.
    - A `slide` joint moves a body along its parent's +y in metres; without a ram its range is its body's own travel.
    - A jointed entry may move a `scale` of its joint's value: a telescope's section, a mast's stage.
    - A `rocker` (a loader's bellcrank) is solved on its parent's pin from the coupler it drives.
    - A ram may be based on any body fixed to its joint's parent: the dozer's lift rams on its hull, its blade on the
      tracks' trunnions.
  - **The laws** read the excavator's envelope only on a machine with a boom, a stick and a tool. Any other front is
    held to its `measure`s: a named point swept over the joints it names, its highest or how far below the ground it
    goes.
  - **The 20 t bulldozer:**
    - the crawler, its sprocket larger and its grousers taller, its push arms' trunnions on its frames and no slew seat;
    - its hull (the mainframe, the hood narrowing to its grille, the lift rams' towers, the tank, the ripper's mount);
    - its cab;
    - a semi-U blade on its push arms (the curved moldboard, its end bits, its cutting edge);
    - a radial ripper (its beam, its shank and tooth);
    - two lift rams and the ripper's.

    At rest, travelling, dozing, ripping and at the top of its lift.
  - **Its laws:** its blade's lift (1.15 m) and its drop below the grade (0.52 m), its ripper's depth (0.67 m) and its
    clearance (0.54 m), its arcs, 61.9 kPa on its tracks, its mass, its transport size (its blade 3.4 m across).
  - The class's length takes the ripper (6.6 m). The bulldozer row claims it, asleep and undriven as the excavator is.
  - **Held:** the law tests walk one machine per procedure (a tool on a linkage, a front held to its measures). The
    char test pins the hull, the blade, the ripper and the machine; the deep sweep walks it.
- **The wheel loader, the skid steer and the compact track loader** (`con-wheeled.js`):
  - **The 15 t wheel loader:**
    - its rear frame (the engine, the hood, the counterweight, the cab's deck, its axle, the hitch) and its front frame
      (the towers, its axle), the front turned on the rear's hitch (a `slew` joint) by two steer rams, ±40°, both held
      to their stroke;
    - four site tyres on their rims, their lugs a chevron;
    - the lift arms on the towers, raised by two lift rams;
    - the bucket on the arms' tip, tilted through a Z-bar: the bellcrank (a `rocker`, solved on the cross tube's pin
      until its lower pin is the tilt link's length from the bucket's), the tilt link, the tilt ram from the arms to
      the bellcrank's upper pin.

    Its laws: its hinge pin at the top of its lift (3.94 m), its dump clearance with the bucket dumped (3.02 m), its
    arcs (the hitch 80°, the arms 64°, the bucket 120°), its mass, its tool clear of its cab, its transport size.
  - **The 3.3 t skid steer:** its chassis (the tub, the engine aft, the chain cases, the towers at its back) on four
    tyres; radial lift arms on the towers; a bucket tilted by two rams from the arms' cross member. Its hinge pin
    3.1 m, its dump clearance 2.52 m.
  - **The 4.3 t compact track loader, the carrier swap:** the skid steer on rubber tracks (`withCarrier(skidSteer,
    'tracks')`, `CON_CARRIERS`). The wheels taken off, the tracks put on at the chassis, its own class, its front
    untouched; 35 kPa on its tracks. The crawler draws a rubber belt (no rails, its lugs moulded on) in its `rubber`
    family.
  - **The laws:**
    - A measure may hold joints at a share of their ranges (`at`): the dump clearance's arms at full lift and its bucket
      dumped.
    - The tool-and-cab clearance sweeps whichever joints carry the tool, a slew or a hitch held where it rests.
  - **The registry:** the wheel-loader, skid-steer and compact-track-loader rows claim their machines, asleep; the
    skid-steered two undriven.
  - **Held:**
    - The law tests add a tool through a rocker and a machine on another carrier, chosen in code: the chain holds at
      every pose (the bellcrank on its pin, the tilt link at its length), every law, the carrier swap's front untouched
      and an unknown carrier refused.
    - The char test pins every new builder path and each machine; the deep sweep walks them all.
  - **Seen** (machine gate only, the eyes gate is open): the loader carrying, dumping and turned; the skid steer and
    the track loader carrying and dumping. The review renderer frames a tall pose by its height.
- **The forklift, the telehandler, the mini excavator and the backhoe loader** (`con-handlers.js`):
  - **The chain:**
    - A joint's ram may join any two bodies on it (a pair of stabiliser legs).
    - A slew may be turned its `zero` (a backhoe's swing frame faces aft); a hinge may turn about its own `axis` (a
      stabiliser about the machine's length); an entry's `scale` of −1 mirrors its joint (the left leg).
    - A ramless slide runs as far as its first stage runs out.
    - A pose may set several joints on the ground in turn, each lowering what it carries (its body and every body hung
      below it), from the end of its range that holds them highest.
    - A pose may hold a tool `level`: it turns back the hinges above it.
    - A value a rounding past its range's end is its end.
  - **A part at another size** (`S` in `con-odm.js`, `scaleDims`): another part's design at k times its lengths and k³
    its mass, drawn at the design's size and scaled. A chain's angles do not change with its size, so a scaled front
    keeps its arcs.
  - **A ram's allowances shrink on a short ram**, no more than a fifth of its length for its eye, its piston leaving
    5 cm at its base. No existing ram changed.
  - **The 2.5 t counterbalance forklift:**
    - its chassis (the counterweight, the overhead guard, the seat) on drive and steer tyres;
    - its mast tilted on the front axle by two rams (−6° to +10°);
    - its inner stage and its carriage each lifting half the extension, a duplex mast: the forks reach 3.31 m.
  - **The telehandler, 4 t to 14 m:**
    - its boom hinged at the chassis's back and raised by its ram (−3° to 70°);
    - its two inner sections sliding out half each of 7 m;
    - its fork carriage held level on the tip by its tilt ram;
    - its carriage pin at 13.44 m.

    The class's length is a 14 m machine's.
  - **The 2.7 t mini excavator:**
    - the 20 t front at 0.44 its size, its arcs the 20 t's;
    - on a swing post turned −50° to +75° by its swing ram;
    - its round upper, its canopy, its counterweight's tail inside its tracks (0.76 m);
    - a backfill blade on its rubber tracks.

    It reaches 4.78 m, digs 2.63 m and lifts a rated 0.4 t at 2.5 m.
  - **The 8.5 t backhoe loader:**
    - its loader's arms and bucket ahead;
    - its backhoe aft, the 20 t front at 0.62 its size on a swing frame turned ±90° by two rams, its reach read from the
      swing post (6.16 m), its depth 4.02 m;
    - its stabiliser legs folded up and swung down to the ground.
  - **The registry:** the forklift, telehandler, mini-excavator and backhoe-loader rows claim their machines, asleep.
  - **Held:**
    - The law tests add a machine with stages, one holding a tool level, one grounding several joints and one drawn at
      another size, each chosen in code: the stages each slide their share, a level tool stays level, each grounded
      joint's load touches the ground, a scaled part's hardpoints are its design's times its scale.
    - The chain test and the deep sweep read a slide's body along its axis.
    - The char test pins every new builder path and each machine.
  - **Seen** (machine gate only, the eyes gate is open): the forklift raised, the telehandler travelling and reaching,
    the mini digging and swung on its post, the backhoe digging, travelling and swung.
- **The door's swaps: a tool in the bucket's place, another carrier under the machine** (`con-tools.js`,
  `composeMachine`, `CON_MOUNTS`, `CON_CARRIERS`):
  - **The mounts:**
    - an excavator's pins (its bucket's and its link's) take a bucket, a ditching bucket, a breaker, a grapple and an
      auger;
    - a skid steer's plate takes a bucket, pallet forks, an auger and a sweeper.

    A tool's part number is its stem and the machine's size, so the excavator's tools come at the mini's and the
    backhoe's sizes too, drawn as the 20 t's at 0.44 and 0.62. Every tool of a mount hangs on its mount's pins, so it
    closes the machine's linkage and takes its rams.
  - **`assembleMachine(archetype, { tool, carrier })`**, or `composeMachine`, puts the tool on the machine's tool joint,
    or the carrier under it, under its own key (`crawlerExcavator+breaker`).
    - A carrier makes the machine it names: a skid steer on tracks the compact track loader, an excavator on wheels the
      wheeled excavator.
    - A tool the mount does not take, a carrier the machine does not list, or a machine whose tool is its own is
      refused, naming what it takes.
  - **The laws re-read the machine as built:**
    - its mass is the class's with the tool in its bucket's place;
    - its rated lift is read against tipping alone (it lifts something or nothing, and does not tip);
    - its tool's outline is swept against its cab;
    - a bucket's envelope bands are the bucket's, so another tool's envelope is read and not held to them.

    The 1.8 m ditching bucket can touch the 20 t's cab in one corner of its range: the clearance law says so.
  - **The 19 t wheeled excavator** is the 20 t excavator's upper and front on a wheeled chassis on twin tyres (the
    carrier swap, `withCarrier`; a carrier's parts set where the first part it drops stood). It reaches 9.49 m, digs
    6.06 m and lifts a rated 1.7 t over the side. Its class is 19 t. The wheeled-excavator row claims it, asleep.
  - **Held:**
    - The law tests: a tool its mount takes put in the bucket's place and nothing else changed; its laws re-read; a
      foreign tool, an unlisted carrier and a fixed tool refused; a carrier making its machine.
    - The deep sweep walks every machine and every tool on every machine whose mount takes it, over every joint's range.
    - The char test pins the tools, the wheeled chassis, the wheeled excavator and the excavator with its breaker.
    - The review renderer takes `--tool` and `--carrier`.
  - **Seen** (machine gate only, the eyes gate is open): the excavator with its breaker, its grapple and its auger;
    the skid steer with its forks and its sweeper; the wheeled excavator travelling.
- **The haulers** (`con-haulers.js`): a truck chassis of the shelf's own, its cab and its axles, carrying a body on a
  joint (a road truck's body cannot sit on a joint without changing its output, so the shelf's chassis is its own):
  - **The 8x4 tipper truck:** two steered axles and two driven on twin tyres, its body tipped on a telescopic hoist
    under its front. It tips through 50°. Its body holds 13.5 m³ struck: gravel to 1.15 times its rated 20 t. Its
    wheelbase is 5.43 m, and it is 2.89 m wide and 3.3 m high for the road.
  - **The 8x4 mixer truck:** the same chassis, its drum on its pedestal and rollers, turning freely about its tilted
    axis (a hinge with no ram and no range), its hopper and its chute at its back. Its drum holds 14 m³ gross, and the
    concrete it carries in its share of that is its rated 19 t.
  - **The 30 t articulated dump truck:** a front frame (its cab, its axle) steered at its hitch by two rams through
    90°, and a rear frame on two axles with the rock body on its two hoists. It tips through 70.8° and carries rock to
    its rated 30 t.
  - **The 100 t rigid haul truck:** its frame, its deck and stairs, its cab offset to one side, twin rear tyres, its
    body's canopy over the cab and its body on a three-stage hoist. It tips through 48.4° and holds 69.4 m³.
  - **The chain:** a telescopic ram, its stages nested between its barrel and its rod, each slid out its share of the
    extension so that each overlaps the tube outside it equally at full stroke. A ram's lengths are the chain's
    (`ramParts` moved to `con-chain.js`, unchanged for a two-stage ram). A hinge with no ram turns freely.
  - **The laws:** a body's struck volume (a drum's gross volume, turned from its profile) and its material's mass in it
    against its rated payload; the wheelbase as built against the class's; its tare, the class's loaded mass less its
    payload (`massShift`).
  - **The registry:** the tipper-truck, mixer-truck, articulated-dump-truck and haul-truck rows claim their machines,
    asleep.
  - **Held:**
    - The law tests pick, in code, a machine with a telescopic ram, one with a free hinge and one with a payload. A
      telescopic ram's tubes overlap at every named pose. A free hinge takes any turn unclamped and moves its body,
      never its parts. A payload is the weight off the class's mass.
    - The deep sweep walks the four haulers over their ranges and at every pose.
    - The char test pins the truck chassis, its cab, the three bodies, the drum, the dumper's frames, the haul
      truck's frame, the telescopic hoist and a stage of it, and the four machines. No existing pin moved.
  - **Seen** (machine gate only, the eyes gate is open): the tipper tipped, the mixer's drum turning, the dumper
    tipped and steered, the haul truck tipped.
- **The lifters** (`con-lifters.js`):
  - **The 60 t all-terrain crane:**
    - Its carrier rides on ten tyres on five axles. Its cab is at the front left. Four outrigger beams slide out of
      their boxes, the left two set turned round, and their jacks set their floats on the ground, 6.66 m apart.
    - Its superstructure turns on its slewing ring, with its operator's cab and its 8 t of counterweight slabs.
    - Its boom has five sections. One ram luffs it through 79.7°, and its four telescopes each slide a quarter of its
      33.6 m. Its head reaches 48.5 m up.
    - Its hook block hangs plumb from the head's sheaves on four falls, lowered to the ground or up to 1.2 m under
      the sheaves.
    - It carries its 60 t class's mass and folds to 2.92 m wide and 3.84 m high for the road.
  - **The tower crane, a 58 m hammerhead:**
    - A cross base and its 45 t of ballast blocks. Its mast is 1.8 m lattice sections 4 m long, built to the height
      under its hook the operator names (`assembleMachine('towerCrane', { height })`, a section at a time, 2 to 14
      sections). The default is ten, 40.4 m under its hook.
    - Its slewing unit carries its cab, its tower head and the pendants that hang its jib and its counter-jib.
    - The jib is a triangle of lattice panels: two bottom chords as the trolley's rails, and a top chord.
    - The counter-jib carries its winch, its cabinet, its walkway and its 20 t of ballast slabs.
    - The trolley runs 53.5 m along the jib, to a 57.4 m radius, its hook block plumb under it on two falls.
  - **The chain:**
    - An entry may be set turned about its parent's up (`turn`), its joint's axis turned with it: a left outrigger.
    - A body may hang plumb (`plumb`): its frame upright and facing its parent's heading, its slide along the
      machine's own down, whatever its parent turns.
    - A rope (`rope`) is drawn in lengths spread from its sheave to its hook block. A rope shorter than one length
      is drawn smaller. It counts once in the bill of materials.
    - A slide may say its travel and where it starts (`travel`, `from`): a hoist's, derived from the parts it is
      built of.
  - **The laws:**
    - **The load chart:** the crane's rated load over the side at 8, 12 and 20 m (34.1, 16.2 and 6.6 t), on the
      shortest boom that reaches each radius. It is 75% of the load that tips the crane over its floats, from every
      part's mass where it is posed. It is tipping only: a real chart's short radii are limited by the boom's
      strength, which is not modelled.
    - **The outriggers' spread.**
    - **The tower crane:**
      - its height under its hook within its mast's freestanding heights;
      - its radius;
      - its counter-jib's moment against its jib's own and half its rated 1.8 t at its tip (0.93);
      - its base's stability against that load, its upper's unbalance and a 20 m/s wind on its lattices (2.06).
    - A machine with no class to drive (the tower crane) states its class's mass.
  - **The registry:** the mobile-crane and tower-crane rows claim their machines, asleep. A machine with no class is
    parked and watched, never driven.
  - **Fixed:** the truck cab's bumper was a box of no length, its corners not numbers. It is now drawn across the cab,
    which re-pins the cab, the tipper and the mixer.
  - **Held:**
    - The law tests pick, in code, a crane with a plumb hook, one with a turned body, one built in sections and one
      held to a load chart.
      - The chain test reads each slide's axis turned or plumb, and each rope's lengths from its first point to its
        second.
      - The left outriggers reach as far as the right.
      - The hook hangs under its sheave by its hoist at every pose.
      - The rated load falls with the radius.
      - A height is built to the nearest section, held at the mast's most, and refused by a machine without sections.
    - The deep sweep walks both cranes, and the tower crane at its fewest and its most sections.
    - The char test pins the new builder paths and both cranes.
    - The review renderer takes `--height`.
  - **Seen** (machine gate only, the eyes gate is open): the all-terrain crane stowed and lifting on its outriggers;
    the tower crane at rest, lifting and with its hook on the ground; the tipper's bumper.
- **The finishers** (`con-finishers.js`):
  - **The 10 t tandem roller:**
    - Its two smooth 1.7 m drums are its wheels, each in its frame's yoke under a deck, a scraper and a sprinkler
      bar.
    - The rear frame carries the engine and the operator's platform (seat, console, wheel, canopy). The front frame
      carries the water tank.
    - The frames bend at the hitch on two rams, ±40°.
    - Its drums rest 24.9 kg/cm at the front and 30.8 kg/cm at the rear, from each part's mass where it is built.
    - Its wheelbase is 3.4 m, and it is 1.9 m wide and 3.05 m high for the road.
  - **The 17 t motor grader:**
    - Its rear frame carries the engine, the cab and two tandems.
    - Its front frame's gooseneck runs from the hitch, over the blade, to the front axle. The frames bend ±40° on two
      rams.
    - Its drawbar hangs from the ball under the nose and is lifted by two rams from the saddle.
    - Its circle turns under the drawbar.
    - Its moldboard (3.66 m) is pitched through 42° on its saddle by the tip ram and shifts 0.65 m either way along
      its rails.
    - Its blade lifts 0.38 m and cuts 0.64 m below the ground. Its wheelbase is 6.2 m, and it travels 2.52 m wide
      with its blade turned in.
  - **The chain:** a slide's `from` may lie below its zero, so a body slides both ways (the moldboard's side shift).
  - **The laws:**
    - A roller's linear load: each drum's share of the mass over its width.
    - The wheelbase reads a roller's drums as its wheels.
  - **The registry:** the road-roller and motor-grader rows claim their machines, asleep.
  - **Held:**
    - The law tests pick, in code, a machine on drums and a slide running both ways.
      - The drums' loads add up to the machine's mass.
      - The moldboard shifts its whole travel along its saddle.
    - The deep sweep walks both machines.
    - The char test pins their parts and both machines; no existing pin moved.
  - **Seen** (machine gate only, the eyes gate is open): the roller at rest and turned; the grader at rest, grading
    and travelling, from the side and above.
- **The doors, step 1: the studio grid and the level's figure** (`con-figure.js`):
  - **`mint_solid({ kind: 'vehicle', vehicle: 'excavator' })`** draws a site machine as its construction shelf
    machine, at true size on the studio grid. Beside its word:
    - `pose` poses it: a named pose (`'dump'`, `'rigged'`) or its joints' values (`{ boom: 20, slew: 90 }`).
    - `tool` puts a tool its mount takes on it (`'breaker'`).
    - `carrier` puts it on a carrier it lists (`'tracks'`).
    - `height` builds a tower crane to the height under its hook.
    - `palette` paints it.

    They are carried in its recipe (`{ construction: { archetype, pose?, tool?, carrier?, height?, palette? } }`) and
    regenerate on every read. A site's words on any other build are refused, naming whose they are.
  - **The family layer** builds a `construction` instance. **A level's figures map** takes a `construction` entry: the
    machine's rig, centred on its spot, with its footprint.
  - **The registry:** every site machine's realistic build is live for the studio grid and a level's parked vehicles.
    It is parked and watched, never driven: what one that drives needs is its ride (a skid steer's, skid steer).
  - **Held:** its words read and refused; its faces at a pose with a tool on; its figure centred, a tower crane at the
    height it is built to; the preview door minting a site machine at a pose and drawing it on the world page.
- **The doors, step 2: parked in a level** (`vehicle-registry/parked.js`):
  - A level's `parked` takes a site machine as its construction shelf machine. Beside its word:
    - `pose` (a crane's outriggers out and its floats down by its `'rigged'`);
    - `tool`;
    - `height` (a tower crane on its base, built to the height under its hook);
    - `palette`.
  - **Its box is over what it stands on at its pose:** its parts within 3 m of the ground, never a boom overhead. A
    crane rigged stands wider than one stowed, and a tower crane stands on its base. The figure is centred on that
    footprint (`conFootprint`, `conFigure`).
  - A site's words on any other vehicle are refused, naming whose they are.
  - **Held:** a crane parked stowed and rigged; a tower crane at a height; the words refused; a parked site machine
    compiled in a world at its pose, solid where it stands.
- **The doors, step 3: the cards.**
  - The vehicle vocab card (`solid-vocab/vehicle.md`) names every site machine and its words beside its word (`pose`
    by name or joint values, `tool`, `carrier`, `height`, `palette`). It also covers the `construction` family, the
    parked machine's words, and two worked examples (a breaker at work, a crane rigged).
  - The vehicle routing card says a site machine is a construction shelf machine, posed and fitted by its words.
  - The routing eval has a row for one ("an excavator with a breaker on, its boom raised" → `mint_solid`).
- **The doors, step 4: the geocity's building sites** (`geocity/scene.js`):
  - **The tower crane:** a site drawn in detail stands the construction shelf's tower crane at its corner, its jib over
    the building and its mast as many sections as clear the building's core. It is drawn within 1.5 km of the camera,
    a district's reach.
    - A site too tall for a freestanding mast keeps the massing crane, since a climbing crane is beyond the shelf.
    - The skyline's far sites keep the massing crane.
  - **The machines:** inside the hoarding, near the camera as the kit is, an excavator digging on the band beside the
    building, facing it, and a tipper waiting along its front.
  - **Lighting:** each machine is lowered under the city's own light, once per process for each light and height.
  - **`assembleMachine(…, { laws: false })`** draws a machine as scenery without reading its laws.
  - **Held:** a site drawn in detail stocked with its crane (one per site the counts name, drawn across its district)
    and its machines (near the camera only); every repeat still drawn by the near rule; the skyline none.
  - **Seen** (machine gate only, the eyes gate is open): two sites from the street corner, each crane over its rising
    building, a tipper in the hoarding, a taller core site keeping its massing crane.
