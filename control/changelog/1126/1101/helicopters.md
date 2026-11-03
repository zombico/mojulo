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
- **The cockpit, a part of its own** (`craft-shelf/cockpit-parts.js`, the shelf's new kind `craft-cockpit`, the
  operator having seen the bubble empty). Drawn by default wherever a craft's glass lets one see in, sized by its row
  and seated on a hull point at the cabin's floor.
  - **Layouts:** `side` (side by side: one panel across, a centre console between) or `tandem` (down the centreline, the
    rear seat raised, a panel before each).
  - **Its pieces:**
    - the floor;
    - the panel's coaming and glare shield, with its displays (`glass`) or its dials (`dials`) facing aft;
    - each seat's base, its cushion a seat's height off the floor, its raked back, its headrest, its harness (shoulder
      straps and a lap belt);
    - each seat's controls: a helicopter's cyclic between the knees and its collective by the left hand (`heli`), a
      stick, or a yoke on its column, and its pedals;
    - a bench behind (`bench`).
  - **On the light helicopter:** two seats, a glass panel, helicopter controls, a three-seat bench. Its tub was lowered
    so the sill sits at elbow height and the bubble comes down to it.
  - **An open hull** (a fuselage's `open: { from, to, sill, wall }`, the operator having seen the fuselage's egg take
    the cabin's room).
    - Over its span the hull is an open tub: its walls an outer skin and an inner one a `wall` in from it, joined at
      their rim at the sill.
    - Its nose is closed ahead of it, its cabin closed from its bulkhead aft.
    - The same stations, the same skin outside; its seams pass the open span by.

    Absent, a fuselage is lofted as it always was, one closed skin. The light helicopter's tub is open under its bubble,
    so its cockpit stands inside it.
  - **Held** (`heli.test.js`):
    - side by side: each seat's pieces and controls, the panel, console and bench;
    - tandem: the rear seat raised and aft, a panel before each, a stick or a yoke when asked;
    - in the helicopter: inside its cabin, under its bubble, no skin across it over its seats (the closed egg had 42
      faces there);
    - a hull without the word one closed skin, one with it a nose, a tub and a hull.

    The shelf's char test pins its builder path.
  - **Seen** (machine gate only; the eyes gate is open): through the bubble from the front, the side and above.
- **The airframes** (`craft-shelf/heli-odm.js`, `heli-parts.js`, `heli-archetypes.js`), three helicopters beside the light
  one, each in a military palette (`heliMilitary`) until the looks dress them:
  - **A medium twin utility helicopter** (`utilityHeli`):
    - its cockpit's tub open under its glazing, two seats side by side with a glass panel and helicopter controls;
    - the cabin's slab-sided box with its sliding doors' frames and its windows;
    - the boom rising aft to a tall tail pylon carrying a four-blade tail rotor, a stabilator low on the boom;
    - a twin-engine roof cowling, a four-blade 16.4 m rotor;
    - main wheels under the cabin and a tail wheel under the boom.
  - **An armoured tandem attack helicopter** (`attackHeli`):
    - a faceted hull of chamfered slabs, narrow under its two seats, wide at its engines;
    - a flat-paned canopy stepping up over the rear seat, its cockpit tandem (the rear seat raised, each with its panel and
      controls);
    - a nose sensor turret, a chin gun;
    - stub wings drooping outboard, a pylon at each station, a rocket pod inboard and a missile rack outboard each side;
    - a twin cowling, a four-blade rotor, a tail pylon and its tail rotor, wheels.

    Its weapons are modelled, never fired.
  - **A heavy tandem-rotor transport** (`tandemHeli`):
    - a long box hull, its rounded nose glazed over its flight deck (two seats side by side), windows down the hold, its
      tail sweeping up over its ramp;
    - fuel sponsons down its sides carrying four wheels;
    - a rotor pylon over the flight deck and a taller one at the tail with an engine each side of it;
    - two three-blade 18.3 m rotors, the aft one the forward one's mirror, so they turn against each other and their
      torques cancel.

    Its blades are meshed, never meeting as they turn, and the aft disc is above the forward one.
  - **New words:**
    - a faceted fuselage may be `open` (its U cut from its polygon at the sill, a corner meeting a corner down its length
      so its panels stay flat);
    - a fuselage's `ramp: { from, to, w }` (a rear ramp's hinge, sides and lip on the aft underside);
    - a `heli-cowl` of family `pylon` (a tandem's rotor pylon, `pods` its engines);
    - the shelf's new kind `heli-kit`, each mounted on its top: a rocket pod (`rockets`), a missile rack (`rack`) and a
      chin gun (`chin`);
    - a nose sensor turret (the drones' EO/IR ball at a helicopter's size).

    Absent, none adds a byte.
  - **On the roster:** `utility helicopter` (medevac, assault, troop helicopter), `attack helicopter` (helicopter gunship,
    attack chopper) and `tandem-rotor helicopter` (heavy lift, twin rotor, cargo helicopter), each before the `helicopter`
    concept row.
  - **Held** (`heli.test.js`):
    - each helicopter level on its gear, its rotors well clear above it, within its budget (80k triangles);
    - each cockpit inside its hull under its glass, its hull open over its seats;
    - each found by its words;
    - the attack helicopter's tandem seats under flat panes, its kit hung under its stub wings, its gun under its nose;
    - the tandem's rotors turning against each other, the aft disc higher, their blades more than a chord apart seen
      from above over a blade's spacing of turn (a tandem with both rotors one hand fails it);
    - its ramp, and a hull without one has none;
    - a faceted tub's corners lining up down its length;
    - the kit's parts, each hanging below its mount.

    The shelf's char test pins the twin cowling, the rotor pylon and the kit's builder paths and the attack and tandem
    helicopters whole; no other pin moved. The deep sweep assembles each at its figures (a parked rotor's envelope: its
    blades at rest, inside the disc they sweep).
  - **Seen** (machine gate only; the eyes gate is open): each from three quarters, the side and the front, each cockpit
    close up through its glass, the tandem from behind and above.
- **Finished and turning:**
  - **One cockpit, never two:** made, a hull no longer fits a fighter's cockpit under its canopy where its layout seats a
    cockpit of its own. Every helicopter had grown the fighter's beside its own; a fighter keeps its.
  - **The light helicopter's fin shortened** (1.05 m to 0.8 m): its rotor's drooped blades passed 0.43 m over it, now
    0.68 m.
  - **Held** (`heli.test.js`):
    - made, each helicopter's hull with no second cockpit;
    - every rotor a bone at its hub in its figure, the tandem's two turning against each other;
    - made, in camo and battered, within its budget ×1.6;
    - each main rotor's blades more than 0.6 m over its tail's parts as it turns.
- **The looks and their kit** (`craft-shelf/heli-looks.js`; `look` on `assembleCraft` and `craftForm`): one airframe,
  civilian or military by the card it wears, as a drone's is. A look is read in its craft's family, a helicopter's cards
  or a drone's, and another family's word throws naming its own.
  - **The cards:**
    - `civil`: gloss white and blue, a searchlight;
    - `medevac`: gloss red over white, a searchlight, a rescue hoist over the door, floats on skids;
    - `police`: gloss dark blue and white, a camera ball under the nose, a searchlight;
    - `military`: matte drab (a camo cuts into it), its lights dark, door guns, wire cutters above and below the nose,
      flare dispensers, a low-visibility number.

    A civilian card strips the airframe's own weapons and keeps their pylons; a military card keeps them. Each card is
    its palette, its material slots (the civilian cards' clear-coated gloss), its lights, its kit and its livery.
  - **Kit at stations:** a hull names where kit hangs (`kitAt`: searchlight, hoist, camera, door gun, cutters, flares,
    floats), and a card hangs its kit only where its hull names the station. Each kit is its family's row nearest the
    size the card asks for (a police camera the drones' large EO/IR ball). The audit counts what a card hangs and strips.
    Absent a look, none hangs.
  - **The kit** (`heli-kit`, modelled, weapons never fired):
    - a door gun on its pintle;
    - a toothed wire cutter;
    - a flare dispenser with its cartridges in rows;
    - a searchlight on its yoke;
    - a rescue hoist with its drum, cable and hook;
    - an emergency float pack for a light helicopter's skids.
  - **Also:** the form now reads each item's part from what was built in its slot, so a swap's or a look's part is read
    as itself, not as the layout's stock part.
  - **Held** (`heli.test.js`):
    - under every card, the same airframe (its hull, rotors, tail and gear the stock parts), its kit at its stations, a
      pair on both sides, its audit clean;
    - kit only where a hull names its station, none without a look;
    - a civilian card stripping the weapons and keeping their pylons;
    - a kit's row the nearest in size;
    - civilian gloss against military matte;
    - a look read in its family;
    - every card within the budget made, in camo and battered;
    - the kit's parts.

    The shelf's char test pins the kit's builder paths. The attack and tandem helicopters are re-pinned for their hulls'
    stations (hardpoints only); no other pin moved.
  - **Seen** (machine gate only; the eyes gate is open): the utility in all four cards, the light helicopter as an air
    ambulance and a police helicopter, the attack and tandem helicopters military, the kit close up.
  - **Left for phase 4:** a civilian's registration and stripe (the hull's marks are military only so far).
- **The field's language** (`craft-shelf/heli-made.js`, the APC's and the tank's finish on a helicopter):
  - **Sliding doors on their rails** (a fuselage's `slide: true`): rails above and below each door, the door slid aft by
    `pose.door` (0 shut … 1 open) over its travel, the opening dark where it was, a `door` joint on the hull.
  - **Made, absent without the word:**
    - an armoured hull's plates (a fuselage's `armour: [[s0, s1, zf0, zf1], …]`), each side standing off the skin, ends
      chamfered, bolts in rows along their tops and feet. A civilian look's hull goes without them (a card's `armour`);
    - a step under each door and a grab handle beside it (`grabs: true`);
    - the rotor head's bolt ring and a cuff round each blade's root;
    - the tail hub's bolts;
    - the cowling's access panels' hinge lines and their latches.

    All are fittings: a skin's seams pass them by, a camo cuts into them.
  - **Antennas:** blades on the helicopters' booms and bellies.
  - **Marks:** a civilian look's registration (generic: three figures, a dash, four; never a real register's format)
    where the cabin runs into its boom, sized to the boom there and inked against the paint, and `stripe`, a band of the
    look's trim along each side. A civil craft's hull gets no military side or fin number. Its gloss paint takes marks.
  - **Wear:** a helicopter's exhausts soot its cowling's tail and the top of its boom, fading aft, over the fade and
    grime it already had.
  - **Held** (`heli.test.js`):
    - a sliding door shut by default and slid by its travel when open, its rails each side, its opening dark, a hull
      without the word none of it;
    - made, an armoured hull's plates and bolts as fittings, a civilian look's hull without them, none unmade;
    - steps and grab handles each side of each door;
    - the rotor head's, tail hub's and cowling's made pieces, none unmade;
    - a civilian look's registration aft of its stripe, no band without `stripe`;
    - battered, the boom's top aft of the exhaust darker than the roof ahead, pristine none.

    The attack and tandem helicopters are re-pinned (antennas, the tandem's rails); no other pin moved.
  - **Seen** (machine gate only; the eyes gate is open): the utility military, made, battered in camo, its door open with
    its gun in it; the attack helicopter made and used, its plates and bolts; the utility civil and the light police
    helicopter with their registrations and stripes.
  - **Not done:** the cabin's benches. An open door shows a dark opening, not a seen cabin: the hull is one skin round
    its cabin, and opening its side is a hull of another kind.

