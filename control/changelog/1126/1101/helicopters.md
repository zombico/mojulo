### Helicopters: rotorcraft on the craft shelf, military and civilian

In progress. Helicopters on the craft shelf:
- **Their rotor systems:**
  - a main rotor's head, swashplate, pitch links and drooped, handed blades, folding aft;
  - a tail rotor or a ducted fan.

  Both spin in the figure as the drones' rotors do.
- **Their cowlings, exhausts and kit.**
- **Their airframes:**
  - a light civilian helicopter;
  - a medium utility machine that is a medevac or an assault transport by its look;
  - an armoured tandem attack helicopter (its weapons modelled, never fired);
  - a heavy tandem-rotor transport.
- **The APC's language on the military hulls:** chamfered faceted armour, plates and bolt rows.
- **Civilian or military by a look card.**

- **The rotor systems and the light helicopter** (`craft-shelf/heli-odm.js`, `heli-parts.js`, `heli-archetypes.js`,
  merged into the shelf's inventory, builders and archetypes).
  - **A main rotor** (`heli-rotor`):
    - its head: the mast, the swashplate's fixed lower ring and turning upper ring, a pitch link from the upper ring to
      each blade's horn (leading it), the scissors, the hub and its cap, each blade's grip and elastomeric bearing;
    - its blades: long, cambered, washing out from root to tip, drooping toward their tips as a rotor at rest does,
      their tips swept back and banded.

    Handed; spun by `pose.rotor` about its hub. Its blades swing aft about their grips by the craft's `fold`, lying
    along the boom.
  - **A tail** (`heli-tail`):
    - a tail rotor: its gearbox out to the side, its hub, its blades turning about the craft's x, its pitch spider;
    - or a ducted fan: the shroud's walls open with its lips round both faces, its hub, its blades spaced unevenly, its
      stators, a fin's root on its top.
  - **A roof cowling** (`heli-cowl`): its intakes' grilles each side, its exhaust (or two), the transmission's fairing
    round the mast, the mast's point on top.
  - **The light single-engine helicopter** (`lightHeli`):
    - a low tub forward under a glass bubble, the cabin full height behind it with its doors, the boom tapering aft;
    - the cowling and the three-blade rotor on the cabin's roof;
    - the stabilizer with its end plates, the fin, the ventral fin;
    - the tail rotor;
    - skids.

    The shelf's own kinds (fuselage, canopy, stabilizer, fin) and the drones' skid as new rows. A palette:
    `heliCivil`. On the roster: `light helicopter` (news, police and private helicopter, light chopper).
  - **Spinning:** `spins` take a helicopter's rotors: the main rotor about its mast's top, the tail rotor about the
    craft's x. A rotorcraft's figure gets its `spin` clip, as a drone's does.
  - **Held** (`heli.test.js`):
    - the head's parts per blade;
    - the blades drooping to the rotor's radius, spun about a still hub, folded aft along the boom;
    - both tails spinning about the craft's x, the fan's shroud open;
    - a tail rotor's thrust against its main rotor's torque (a rotor turning anticlockwise from above turns its fuselage
      nose right; its tail rotor pushes the tail right);
    - the helicopter on its skids, level, its rotor clear above, at its figures;
    - its rotors' bones at their hubs;
    - within 50k triangles, the same twice, found by its words.

    The shelf's char test pins the new builder paths; no other pin moved. The deep sweep builds every part closed and
    assembles the helicopter at its figures.
  - **Seen** (machine gate only; the eyes gate is open): the helicopter from three quarters, the side and the front, its
    rotor head close up, its cabin.
