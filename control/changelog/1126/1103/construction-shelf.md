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
