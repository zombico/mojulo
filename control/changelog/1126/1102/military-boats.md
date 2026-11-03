### Military boats: watercraft for the military register

In progress. Military boats from the boat kit on the craft shelf, in the field's military roles and its surface, so a
game's military side has boats beside its jeeps, trucks, armour and drones:
- a combat RHIB with twin outboards, a coxswain console, jockey seats, a radar arch and pintle-mounted guns;
- boats in the military surface: hull numbers, emblems, wear, a look card;
- a riverine patrol boat on waterjets;
- a landing craft whose well deck carries a field vehicle.

Every weapon is modelled, never fired.

- **The combat RHIB** (`combatRhib`): a 7.5 m deep-V moulded hull in a near-black collar, dark naval grey, in a new
  `raider` boat role; the registry's `combat-rhib` row in the field's `scout` role, crewed and fought from, parked.
  - **Twin outboards** (the hull's `motors.spacing`, a `motorPair` point a layout entry pairs across the boat): two
    150 hp remotes, the port one the starboard one's mirror, steering with it, their propellers counter-rotating.
  - **`boat-mount`** (`craft-shelf/boat-mil.js`): a pintle-mounted generic medium machine gun on a deck point or a
    sole's pedestal: its receiver, feed cover, barrel in its jacket, flash hider, sight, carry handle, spade grips, its
    ammunition can and belt. It trains (`pose.train`) and elevates (`pose.elevate`) as joints, a layout's `yaw` trains
    it at rest (the aft gun's aft); modelled, never fired.
  - **`boat-arch`**: a radar arch on the sole: A-framed legs, a crossbar, the radar's dome, an all-round light, a light
    bar, whip antennas.
  - **`boat-seat`'s `jockey`**: four straddle seats behind a coxswain console. A point may stand on the deck
    (`[s, x, 'deck']`): the bow gun's.
  - Its sole is self-bailing, above its loaded waterline. It floats 2872 kg (ten aboard) at a 48 cm draft, its collar
    carrying its share. Its guns stand inside the arch's legs, and its motors tilted up clear of them.
- **Held** (`boat.test.js`): the pair mirrored, steering together and counter-rotating; the guns on their points,
  trained where the layout points them and posed by their joints; the arch on the sole inside the cockpit, the guns
  and tilted motors inside its legs; the row in the field's roles. The new builder paths (the jockey seat, the pintle
  gun, the radar arch) are pinned, and no existing pin moved.
