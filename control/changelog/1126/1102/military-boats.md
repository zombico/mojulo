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
- **Boats in the military surface** (the form render: `craft-form.js` over `air-surface.js`, the aircraft's own marks and
  wear told for a boat):
  - **Look cards** (`craft-shelf/boat-looks.js`, read by the drones' `lookCard`): `naval` (a new `navalHaze` palette,
    its lights darkened, a low-visibility number and an emblem) and `pleasure` (the boat's own colours, its lights lit,
    a registration). Any boat wears either; its hull, drive and fittings stay as they are. A covert look darkens a
    hull's sidelights and all-round light and an arch's lights.
  - **Marks** on a boat's outermost skin (its topsides, or a RIB's collar over them): a military number on both bows
    and an emblem amidships, a tone on its paint read across the water; or a civil registration on both bows against
    its paint, generic, never a real register's format.
  - **Wear:** streaks run down a boat's sides, salt-pale on a dark paint and grime on a pale one; chips at its bow;
    the sun's fade and repainted patches as an aircraft's. Asked for nothing, a boat is laid nothing.
  - **Review:** `scripts/render-boats.mjs --form [--look naval|pleasure] [--livery …] [--wear …]` draws the form render.
  - Held: a card dresses any boat (the naval one haze grey and darkened, the pleasure one its own and lit); the naval
    number on both bows on the collar's tube, the pleasure registration against the paint; wear down the sides and
    chips at the bow; nothing laid when nothing is asked. The aircraft's and drones' marks and wear are unchanged.
