### Military boats: watercraft for the military register

Military boats from the boat kit on the craft shelf, in the field's military roles and its surface, so a game's military
side has boats beside its jeeps, trucks, armour and drones:
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
- **The riverine patrol boat** (`riverinePatrol`): a 10 m welded aluminium deep V in olive drab, twin waterjets, an
  armoured pilothouse, three guns, in a new `patrol` boat role; the registry's `riverine-patrol-boat` row (patrol boat,
  gunboat, river gunboat …) in the field's `patrol` role, crewed and fought from, parked.
  - **`boat-jet`** (`boat-mil.js`): a waterjet through the transom: its flange, the pump's bowl, the nozzle steering
    about the vertical (`pose.yaw`), its rams, the reverse bucket dropping over the nozzle (`pose.reverse`), joints
    both. On the hull's `jets: { spacing, z }` point, low on the transom's face, a pair mirrored and steering together.
    Its mass is its diesel's too, inside the hull.
  - **`boat-cabin`'s `pilothouse`:** faceted armour in the field vehicles' language (upright to the shoulder, leaning
    in above it, the seams along its facets), its front raked to three armoured panes, slits along its sides, a door
    each side, a searchlight, a mast with its radar, light and whips, and a gun ring on its roof whose point
    (`roofGun`) a layout stands a mount on.
  - **`boat-mount`'s `tub`:** the gun inside a faceted armour tub, its plates lapped, open aft for its gunner; a mount
    may carry a `shield` that trains with it (the roof's).
  - It floats 10.7 t at a 72 cm draft with its sole above the waterline and 54 cm of freeboard; the military surface
    (a look, marks, wear) dresses it as it does any boat.
  - Held: the jets paired, under the waterline and steering together, their buckets dropping; the pilothouse on the
    sole inside the hull and a gun on its ring; the tubs open aft. The new builder paths (the waterjet, the pilothouse,
    the tub) are pinned, and no existing pin moved.
- **The landing craft** (`landingCraft`): a 22 m flat-bottomed steel craft in grey, a bow ramp, a well deck, a raised
  aft deck with its pilothouse and two gun tubs, twin screws, in a new `landing` boat role; the registry's
  `landing-craft` row (lcm, mechanised landing craft, ramp boat …) in the field's `transport` role.
  - **Its hull's words:** a `ramp` bow (a square bow left open above its sole), an `aftDeck` (the liner raised to a deck
    over the engine room, a point `[s, x, 'aft']` on it), its well deck's `cargo` (its area on the sole and its middle's
    point), `shafts` (a `shaftPair` point under the bottom), thick buoyant wing walls (its liner's depth), its stern
    lifted over its propellers and its forefoot lifted to beach.
  - **`boat-ramp`** (`boat-mil.js`): the bow ramp hinged across its foot, its stiffeners, edge beams and treads; it
    lowers (`pose.ramp`) to a beach ahead of the bow.
  - **`boat-shaft`:** the shaft out of the bottom, its strut, a four-bladed propeller, the rudder on its stock; a pair
    mirrored, counter-rotating, its rudders steering together. Its mass its diesel's too.
  - **What it carries** (`vehicle-registry/carry.js` `wellDeck`): the registry's vehicles that stand parked, each by its
    class's own length, width and mass, that fit its well deck nose to the ramp with room round them, and how many by
    the deck's area and load: the light tank, the armoured and tracked carriers, the cargo truck, the jeep among them.
    Its `at` is the deck's middle in the craft's frame, where a level parks the vehicle (`parked.js`).
  - It floats 68.7 t (its crew and a field vehicle's load) at a 62 cm draft, its well deck above the waterline.
  - Held: the bow open above the deck and the ramp inside the opening; the ramp lowering ahead of the bow; the aft deck
    at its height; the shafts paired, under water, counter-rotating, steering together; the well deck holding the
    field's scout, transport and armour vehicles within its length, width and load, a boat without one holding none;
    the row in the field's `transport` role. The new builder paths (the ramp, the shaft) are pinned, and no existing pin
    moved.
- **The navy patrol boat** (`navalPatrol`): a 25 m coastal patrol boat in haze grey, twin large waterjets, the
  registry's `naval-patrol-boat` row (navy patrol boat, fast patrol boat, coastal patrol vessel …) in the field's
  `patrol` role. Its pieces compose what the shelf has with what a ship needs:
  - **Its hull:** a deep V with bow flare and a flush weather deck the whole length (the deck from just forward of
    the transom, the aft deck closing its stern), guard rails along both sides (the hull's `rails`: stanchions and two
    lifelines), a bow rail and four life-raft canisters on their cradles (`rafts`).
  - **`boat-cabin`'s `bridge`:** a deckhouse with its doors and portholes, the bridge on it raked to a band of five
    panes, three along each side, its wings out to the ship's side carrying a shielded machine gun each (trained
    outboard) and a sidelight, and on its roof a tripod mast with its yard, the radar's array and a dome, the masthead
    light and two whips.
  - **`boat-mount`'s `cannon`:** a stabilised 30 mm naval gun on the foredeck: its drum and turntable (it trains), its
    gun house (it elevates), the long barrel, recoil sleeve and muzzle brake, its ammunition box and its sight's head;
    modelled, never fired.
  - **Its sea boat:** the RIB tender's own hull and outboard as layout entries on its after deck, and a davit
    (`boat-arch`'s `davit`) whose hook is over it; their weight in the ship's.
  - **A stock livery:** an archetype may carry its own `livery`, worn in the form render when none and no look is asked
    for (`craft-form.js`): the patrol boat's hull number on its bows and its emblem amidships. Drones and aircraft
    carry none and are unchanged.
  - It floats 83.5 t (its crew, stores and fuel) at a 1.33 m draft with 1.58 m of freeboard.
  - Held: decked the whole length, its rails and rafts; the bridge on the deck, its wings past it to the beam, their
    guns trained outboard; the naval gun on the foredeck trained ahead, with its joints; the sea boat on the after deck
    under the davit's hook, its weight in the ship's; its number in the form render with nothing asked; its row in
    the field's `patrol` role. The new builder paths (the bridge, the naval gun, the davit) are pinned, and no existing
    pin moved.
- **The destroyer** (`destroyer`): a generic 150 m guided-missile destroyer in haze grey, twin screws, the registry's
  `destroyer` row (guided missile destroyer, surface combatant, fleet escort …) in the field's `armour` role and a new
  craft role, `escort`. Its parts are a ship's, in `craft-shelf/boat-ship.js`, reached through the kinds the shelf has:
  - **Its hull:** a long displacement hull from its lines (a raked stem, flare, a flush weather deck, its stern
    immersed), rails, a bow rail, six life-raft canisters, and a flight deck's markings aft (the hull's `helipad`: its
    centreline, edge lines and touchdown circle).
  - **`boat-cabin`'s `superstructure`, `funnel` and `hangar`:** stepped tiers bow to stern, each narrower and set on the
    one under it, their sides leaning in, the top tier raked to the bridge's band of seven panes, doors along the lowest
    tier, named points on a tier's roof; a faceted funnel raked aft with its grille and exhausts; a hangar with its
    sides leaning in and its roller door aft, facing the flight deck.
  - **`boat-arch`'s `pyramid`:** a faceted mast tapering to its platform, a flat radar array on each of its four faces on
    the face's own slope, a topmast with its yards, domes, whips, navigation radar and masthead light (covert under the
    naval look).
  - **`boat-mount`'s `turret`, `ciws` and `vls`:** a 127 mm gun in a faceted shell (it trains; its barrel elevates), two
    close-in weapons (a radome over a rotary gun, on the superstructure and the hangar's roof), and two blocks of
    vertical launch cells fore and aft; each modelled, never fired.
  - **A shaft drive's `scale`:** the shaft drive's running gear grown to a ship's (its shaft, strut, five-bladed screw and
    rudder about its mount), so the inboard drive's one builder serves a landing craft and a destroyer.
  - **Its sea boats:** a combat RHIB each side amidships with its outboard, a ship's davit outboard of each swung over it.
  - **A ship's marks:** a hull number is as tall as a fiftieth of the hull's length (half a metre at most on a boat, as
    before) and laid on the hull's side where the mark's middle is, so it reads on a ship's narrowing bow.
  - It floats 9,300 t (its crew, stores and fuel) at a 5.7 m draft, 45 m from its keel to its masthead.
  - Held: the tiers stepped and inside the deck's breadth, the bridge's panes on the top tier, the mast on it; the main
    gun forward, each weapon training and elevating; the launch cells on the deck fore and aft, every cell there; the
    hangar's door facing the flight deck, its markings between the hangar and the stern; the screws mirrored and under
    water; the sea boats a pair under their davits' hooks; its weight its waterline; its row in the field's `armour`
    role. The new builder paths (the superstructure, funnel, hangar, pyramid, turret, close-in weapon, launch cells)
    are pinned, and no existing pin moved. A part's size ceiling on the shelf is 100 m, a ship's hull's 400 m.
