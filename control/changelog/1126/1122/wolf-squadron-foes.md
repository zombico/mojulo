### Wolf Squadron's foes: real ships in its waves, a sci-fi ground force on the moon

An arcade stage's fighters were red boxes. They now fly ships, and a ground stage has a ground force to shoot down.

- **Its fighters fly ships off the craft shelf** (`gameworld/flight-goal.js`, as a Rebel Storm sortie's foes do: a rigged
  craft, flying, gear up). A design's wave names its ship (`craft`: a dagger or arrowhead interceptor, a faceted raider, a
  twin-panel, tri-wing or bent-panel fighter, `campaign/stage.js` `FOE_CRAFT`). Absent, it flies its formation's: a line
  the dagger interceptor, a vee the arrowhead, an echelon the faceted raider, a swarm the twin-panel. The holo table
  stands each wave as its own ship's miniature.
- **The ground force** (`groundforce/`, a new library). A sci-fi army's units as cards of a few big chamfered shapes
  (the workbots' primitives, now shared as `WORKBOT_PRIMITIVES`), in a military register of their own:
  - composite grey armour, graphite running gear and guns, one foe-red stripe;
  - a red sensor slit and a drive's glow, lit;
  - drawn 2.5 times life so they read from a fighter going past.

  There are three units:
  - **the gun emplacement:** an armoured dome on a dug-in ring, twin long barrels;
  - **the hover tank:** a sloped wedge on four glowing pads, a flat turret with twin barrels;
  - **the personnel walker:** an enclosed cab on two backward-kneed legs, a red visor, twin chin guns.

  A page stands one by a figures-map `unit: { kind }`; absent, nothing changes.
- **Laid by the rail** (`skyscape/rail-stage.js`, a plan's `ground`). Each group is placed from its mark on, a unit every
  1.1 s of the way, on alternate sides across the box, never on its line. Each stands on what is there (the ground, or
  a roof in a colony) and faces back up the way. Cast as static minds that turn to the craft and fire up at it in short
  bursts while it is in reach.
- **A stage's ground groups** (`campaign/stage.js` `ground`: `{ id, name, kind, count, at }`, a ground route's only).
  Each is read with its faults said, shown before launch (the `every-wave-shown` law reads them), scored by kind (a gun
  emplacement 150, a hover tank 200, a walker 150, into the medals' shares) and stood on the holo table where its units
  are. The build list and the orders say them.
- **The Canyon run's ground force:**
  - gun emplacements on the flats;
  - hover tanks at the colony's edge;
  - walkers in its streets;
  - more guns down the canyon.

  Its briefing shows each. The flight proof's attentive pilot wins it with 38% of its shield; a still one loses.
