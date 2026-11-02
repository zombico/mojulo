### Boat parts: the primitives watercraft are built from, on the craft shelf

In progress. Boats join the craft shelf as new part kinds, the way the drones did, so a variety of watercraft can be
assembled from one kit: a hull drawn from its lines, its drive, its fittings, floated at the waterline its weight sets.
The first boat is a small motor skiff; bigger and different boats follow from the same parts.

- **The kinds and the first boat** (`craft-shelf/boat-odm.js`, `boat-parts.js`, `boat-archetypes.js`, merged into the
  shelf's inventory, builders and archetypes; the shelf gains the `water` realm, its finish and a `skiffGreen` palette).
  - **`boat-hull`, drawn from its lines** the way a lines plan draws one: along its length the keel's height, the
    sheer's and the chine's heights and half-breadths, so the bottom's deadrise and the sides' flare follow from them.
    - An outer skin and an inner liner, each lofted as a U-shaped wall, painted outside and bare inside.
    - A plane clips the skin and the liner into a raked transom (its thickness the motor board's), and another clips
      the liner into the bow's deck. One mechanism, so a flat-bowed or decked hull is a different line or plane.
    - Benches lofted to the liner they sit in (each fits whatever hull it is in), ribs along the floor, strakes along
      the bottom, the gunwale rails, the transom's cap and motor pad, the keel strip up the stem, and the fittings: the
      bow eye, the bow handle, the stern cleats, the oarlocks, the drain plug and the transom's eyes.
    - Its points: the transom's motor point, where a tank stands on the floor, each seat's top.
  - **`boat-outboard`**, a tiller outboard:
    - the clamp bracket, raked to the transom, and its screws, with the tilt tube (they stay with the boat);
    - the swivel bracket (it tilts);
    - the cowl and its pan, the midsection, the anti-ventilation plate, and the gearcase's strut, torpedo, skeg and
      intake grilles;
    - a three-blade propeller, each blade's section pitched to the helix its pitch draws and raked aft, handed;
    - the tiller and its twist grip, the shift lever and the starter's handle.

    It tilts about its tilt tube (`pose.tilt`), steers about its swivel (`pose.yaw`, + to starboard) and its propeller
    turns (`pose.prop`), each a joint.
  - **`boat-tank`**: a portable fuel tank, its handle, cap, gauge and fitting.
  - **The motor skiff** (`motorSkiff`): a 14 ft aluminium V-bottom utility skiff with a 20 hp tiller outboard and its tank,
    in the water's own `utility` role (a boat's role holds boats; the flying roles still pair an earth craft with its
    starship).
- **Two more small boats from the same kit**, each by a word on a hull row, not a new builder:
  - **The jon boat** (`jonBoat`): a 12 ft flat-bottomed aluminium boat, marsh tan, with a 9.9 hp tiller. A flat bottom
    is its chine at its keel's height; its square bow (`bow: 'square'`) is where the bottom's rocker meets a small transom
    at the bow, its rail across it and its keel strip ending at its foot; runners along its bottom.
  - **The RIB tender** (`ribTender`): a 3.1 m deep-V moulded hull in its collar, with a 20 hp tiller, in a new `tender`
    role. Its `collar` is one tube from the transom round the rising bow and back, its cones run aft of the transom, its
    rubbing strake and lifeline along it, with no gunwale rails; its `sole` is a floor laid flat across the V (the liner
    clipped to a plane, as the deck and transom are), its locker under the bow, white inside (`tint`).
  - **A smaller outboard** (`outboard-10-tiller`): the tiller builder at the 9.9 hp class's cowl and propeller, its leg
    and gearcase drawn at `leg` of the 20 hp class's size, on the same shaft.
  - **A collar floats too:** its tubes' sections count in the hull's displacement once they are in the water, so a loaded
    RIB settles onto its tubes.
  - The registry's `jon-boat` and `rib` rows (john boat, flat bottom boat, duck boat …; rib, rigid inflatable, inflatable
    boat, yacht tender …), their craft builds asleep.
- **Afloat by its weight** (`boat-parts.js` `hullVolume`, `hullFloat`). The hull's displacement is worked out from the
  same sections it is lofted from, so what floats is what is drawn. An assembled boat's readout says where it floats
  (`afloat`): its parts' mass and its payload, the draft that displaces them in fresh or salt water (`water`), the
  freeboard, and `waterline`, that line's height in the manifest's frame, where a level lays its water. The motor skiff
  carries 380 kg at a 15 cm draft with 25 cm of freeboard at its transom; the jon boat 311 kg at 10 cm; the RIB 319 kg
  at 24 cm, its tubes just in the water.
- **The registry:**
  - A `motor-skiff` row (skiff, motorboat, outboard boat, tinny, fishing boat …), its word taken off the rowboat row.
  - Its craft build is asleep: built and floated, and no door draws a boat yet.
  - A transformer's craft is refused a boat: it flies.
- **Review:** `node scripts/render-boats.mjs <dir> [boats] [--pose …] [--dry]` draws each boat from the side, the
  quarter, above and astern, on a sheet of water at its waterline (or `--dry`, out of it, to see its bottom).
- **Held** (`boat.test.js`; the shelf's pins and sweeps). Each concept is tested on a case chosen in code from the shelf:
  - every boat part the same twice;
  - the hull's envelope its dims, its halves mirrored, its transom raked, its benches inside it;
  - the waterline displacing its weight, deeper when heavier and shallower in salt water, swamped when overloaded;
  - the outboard's plate at the keel's height, its propeller under the water;
  - its tilt, steer and propeller each about its own axis;
  - the boat role filled by boats, the skiff by its words, its build asleep, a transformer refusing it;
  - each hull variation on the hull that carries it: a flat bottom level across, a square bow, a sole, a collar outboard
    of the sheer that floats the boat once it is in the water; a smaller outboard's slimmer leg on the same shaft.

  The shelf's three new builder paths are pinned, and no existing pin moved.
