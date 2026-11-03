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
