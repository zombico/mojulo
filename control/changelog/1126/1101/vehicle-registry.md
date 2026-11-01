### Vehicle registry: one front door for every vehicle, the old tables frozen behind it

A game's vehicles came from several tables that shared no names and read nothing of the game they were in: the city's
scenery nets, the physics classes, the highway fleet, the assembled rides, the race machines, the craft shelf, the fly
goal's flight models and a civilization's crafted technology. The registry names them once, the furnishings roster's
way. There is one row per vehicle, under the words people say, and each row claims its keys in each table. The tables
still measure, so no stored recipe changes by a byte.

- **The roster** (`vehicle-registry/roster.js`):
  - **A row:** a label, the words people say, where it goes (road, offroad, rail, water, air, space), what a game asks
    it for (a closed set of roles; rows that share a role stand in for each other), the world ages it belongs to (the
    casting call's eras), how a game meets it (driven, traffic, parked, watched, crewed), and its handles.
  - **Handles** are its keys into the tables that build it. Every row falls back to the technology crafter's concept,
    so a vehicle no table builds yet (a tank, a sailing ship, a helicopter) is still named, searchable and drawn as a
    concept.
  - **Words:** `resolveVehicle` (articles dropped, hyphens as spaces, plurals read), and one word names one vehicle (the
    index throws on a collision).
  - **Search:** `findVehicles({ words, realm, role, era, use })` ranks an exact name first, then the share of the words
    found, filtered by the facets. `suggestVehicles` gives a refusal the rows a word nearly names.
  - The brand and franchise names are left out: a row is a kind of vehicle, never a product.
- **Frozen** (`roster.test.js`):
  - Every key of every legacy table is claimed by exactly one row, every net through its scenery entry or as an
    orphan, and every vehicle concept the technology crafter draws by some row.
  - A key added to a legacy table without a row fails with "a new vehicle is a registry row first".
  - The rows agree with the legacy pairings: a ride is its assembly, and a fleet loft is its physics class.
- **Builds by tier** (`vehicle-registry/builds.js`). A build is a row at a tier (toy, stylised or realistic), made by
  the builder a handle points at.
  - **Each build says how far it reaches:**
    - `live`: a game or world draws it;
    - `preview`: the studio grid shows it, no game yet;
    - `asleep`: built, reached by nothing;
    - `concept`: the crafter's block plan.
  - **Each build says the uses it serves**, so a highway fleet's traffic loft is never mistaken for a car a hero drives.
  - **`buildOf(id, tier, { use })`** gives the tier's build, else the nearest tier's, else the concept, and says why when
    it fell.
  - **`upscaleOf(id)`** says what a row needs to be drawn realistic for the use that matters most: live already, a build
    to wire in, or a body to build. This is the upscale ledger for the old vehicles.
  - **`dimsOf(id)`** reads a row's size from the table that measures it, never retyped.
- **The realistic loft on the studio grid** (`car-designer/race-families.js` `loftInstanceFaces`, the family layer's
  `loft` instance):
  - A road class's realistic loft (`car-designer/realistic.js`, until now reached only by a render script) is shown at
    its true numbers in metres: `{ loft: { class, era?, brief?, seed? } }`.
  - It is the realistic build of every car, truck and bus with a loftable class.
  - An instance without the key keeps its bytes.
- **Every door reads a vehicle word through the registry:**
  - **`mint_solid({ kind: 'vehicle', spec: { vehicle, tier? } })`:**
    - Any word the registry names is read to its row, then to the build at the tier (or its first build the grid shows,
      for a parked vehicle).
    - The stored instance is that build's own keys plus `vehicle: <id>`, the row it was asked as.
    - A legacy `type` that is not a scenery key is read the same way. A scenery key keeps its own path byte for byte,
      with the registry beside it in the readout only.
    - A row the grid cannot show yet is refused with its builds; a word the registry does not know, with the rows it
      nearly names.
    - The readout's `registry` names the row, the build, every build and its upscale.
  - **The quick game's `ride`, `vehicle`, `craft` and the transformer's `vehicle.ride` / `vehicle.craft`:**
    - They take any word the registry names, written as the table's key at the door (`gameworld/quick.js` `quickWorld`,
      and design_game's patch ops on those pointers). A world asked as `ride: 'sedan'` stores exactly what
      `ride: 'car'` stores.
    - A row with no key in that table is refused with what it needs.
    - design_game's readout says what was read (`vehicles.registry`), only when something was.
  - **Retired:**
    - The dead `registerPreviewVehicleTools`, whose description told agents to commit new vehicles to the old table.
    - The `vehicle-smooth-box-net.js` re-export shim. Its test now reads the swept net it re-exported.
- **Docs:**
  - The `vehicle` solid card leads with the registry.
  - A generated `vehicles` card (`vehicle-registry/entries.js`) lists every vehicle by realm, with its build at each
    tier, for `get_solid_vocab` and `semantic_search`.
  - A `vehicle` routing card, with a fixture row for a vehicle by name.
  - The `design-vehicle-family` catalyst starts at the registry: a new vehicle is a row first.
- **Held** (`roster.test.js`, `doors.test.js`, `preview-vehicle.test.js`). Each concept is tested on a row chosen in
  code by what it carries:
  - the contract and the freeze;
  - the words, search and refusals;
  - one row per builder for its tier, status, uses and fallback;
  - the traffic loft against a driven one;
  - the quick words written as their keys (the world byte-identical), the patch ops, the legacy key and a spec without
    a vehicle word left as the same object;
  - the door's word, legacy type, tier and race-machine reads;
  - the tier read, one case per read and the stamp (`tier-ride.test.js`);
  - the ride at each tier: an assembled ride, its row's loft at the realistic tier, a loft-only row falling, and a row
    nothing drives refused;
  - end to end (`design-game.quick.test.js`, e2e tier): a realistic ride race stamped from the juice, its loft figure
    and its rival's, the class's rule and the rig resolved, and a pickup by name; the assembled ride and the kart race
    unchanged;
  - a scenery mint;
  - a loft minted at true dimensions and drawn by the world route;
  - a legacy mint's manifest unchanged.
- **The tier read** (`vehicle-registry/tier.js` `vehicleTierOf`): the fidelity a game's vehicles are drawn at, read
  from what the game already says, the first that speaks winning:
  - the game's own word (`quick.tier`);
  - a realistic hero (the quick hero's, the book's or an adopted hero's `form: 'realistic'`);
  - the juice's written drawing (form → realistic, voxel → toy);
  - a shooter pole on the realistic side;
  - a voxel kit (→ toy);
  - a field of karts (→ toy);
  - else stylised.

  `stampedTier` gives what a new quick world is stamped with at mint, only when the read is not stylised. A world
  minted before carries no tier and drives what it always drove.
- **The realistic ride** (`vehicle-registry/ride.js` `rideOf`):
  - **Choosing the build:** a quick game's `ride` names a registry row, by its assembled ride's key (car, coupe, van)
    or by any row with a realistic loft (`ride: 'pickup'`, `'bus'`, `'box-truck'`; the door writes `'a pickup truck'`
    as `'pickup'`). The game's `tier` picks the build: the assembled ride, minted as its sketch as before, or the
    class's realistic loft.
  - **The loft in the game:** a figure the world compiles in place (`figures: { ride: { loft: { class, seed } } }`,
    `world-scene.js`, nothing to mint). It drives on its class's own physics row, which a quick `vehicle`, `tuning` and
    `conditions` still override, and is chased by a camera scaled to its length (a ride's `camera`, `levels.js`). Its
    rivals race in it.
  - **When the tier has none:** a row with no build at the tier drives the nearest and says so (a pickup has only its
    loft; a sedan has no toy build).
  - **The loft's status:** `live` in the registry, so every road row with a loftable class is drawn realistic for its
    driven use.
  - The cargo van's row is `cargo-van` (the word "van" still names it in the registry), since the ride key `van` is the
    minivan. A contract check holds that no row's id is another row's legacy ride key.
- **Seen** (machine gate only; the eyes gate is open):
  - The loft on the studio grid.
  - In headless Chrome, three trail levels, each followed from behind with no page errors: a stylised game's assembled
    car (as before), the same game at the realistic tier driving the midsize loft, and a pickup by name.
  - The lofts are at true size, and their look is plain (baked light, slab panels): the look work is not this
    wiring.
- **Not built, said:**
  - **Phase 2, search and the gaps page:** a generated `docs/vehicle-gaps.md` (realm × era, the wants ranked) and
    per-row cards.
  - **Phase 4's other half:** the fly goal's body from the craft shelf.
  - **The tier read's other inputs:** the setting's tradition and the levels' render era (gen-7). A gameworld's own
    record does not carry the era, so it is left out rather than guessed.
  - **Book worlds:** a vehicle word beside `quick` (`vehicles.tier`), with the fleet phases.
  - **Phase 5:** a civilization's technology vehicles resolved through the registry.
  - **Phase 6:** the city's traffic by tier.
  - **Phase 7:** the engines.
  - **Phase 8:** the wanted vehicles' own bodies.
  - The loft in the form render (gen-7 light), and the open frames' realistic bodies (kart, buggy, quad).
