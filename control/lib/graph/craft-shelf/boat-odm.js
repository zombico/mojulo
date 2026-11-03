/**
 * boat-odm — the craft shelf's boat parts, rows as every shelf part is (craft-odm.js's head says what a row holds), merged
 * into CRAFT_ODM. A boat is assembled as a craft is: its hull at the origin, its drive on the hull's transom, its fittings
 * on the hull's points. A new boat part is a row first.
 *
 * Kinds (BOAT_KINDS):
 *   boat-hull      the hull, drawn from its LINES the way a lines plan draws one (boat-parts.js `hullLines`): along its
 *                  length s (0 the transom … 1 the stem) the keel's height, the sheer's height and half-breadth, the
 *                  chine's height and half-breadth, so the bottom's deadrise and the sides' flare follow from them, every
 *                  height in metres above the keel's lowest point and every breadth from the centreline. An outer skin
 *                  and an inner liner lofted as a U-shaped wall; a plane clips the liner into a deck (`deck`) and the
 *                  skin and liner into a raked transom (`transom`: its height is the sheer's at s = 0, its rake from the
 *                  vertical, its thickness the motor board's). Benches that fit the hull they sit in (`benches`: their
 *                  place along it, their depth, their top), ribs across its floor, strakes along its bottom, the
 *                  gunwale rails, the keel strip, the fittings. Points (hull frame, +y the bow, the keel's lowest point
 *                  at z = 0, amidships at y = 0): `motor` (the transom's top at its aft face, on the centreline),
 *                  `tank` (where a fuel tank stands on the floor), a seat's top (`seatAft`, `seatMid`, `seatBow`).
 *                  Its displacement is worked out from its own sections (boat-parts.js `hullVolume`), so a boat floats
 *                  at the waterline its weight sets
 *   boat-outboard  an outboard motor: the clamp bracket over the transom (raked as a transom is), the swivel bracket and
 *                  its tilt tube, the cowl over the powerhead, the midsection down to the anti-ventilation plate (the
 *                  `shaft` below the clamp: 15 in short, 20 in long), the gearcase's torpedo and skeg, the propeller
 *                  (its blades, diameter, pitch and hand), the tiller and its twist grip. It tilts about the tilt tube
 *                  (`pose.tilt`, 0 down … 1 tilted up), steers about the swivel (`pose.yaw`, −1 … 1), its propeller
 *                  turns (`pose.prop`, degrees) and its tiller folds up (the craft's `fold`, `fold.angle` its travel).
 *                  Points: `mount` (the clamp's top on the transom's aft face), `prop` (the hub), `plate` (the
 *                  anti-ventilation plate under the leg)
 *   boat-tank      a portable fuel tank: a moulded body, its handle, its cap, its gauge and its fitting
 *   boat-console   a console standing on a hull's point on its sole (boat-helm.js): its body, windscreen, grab rail,
 *                  dash (a screen, gauges, a compass), helm (`helm`: where on the dash, its reach and rake, the wheel's
 *                  diameter) and the throttle's binnacle. Points: `mount` (the middle of its foot), `wheel`
 *   boat-seat      a seat on the sole: a cooler and its cushion. Points: `mount`, `seat` (its cushion's top)
 *   boat-mount     a weapon on its mount (boat-mil.js): a pedestal `post` high from a deck or sole point, a generic medium
 *                  machine gun on its cradle, its ammunition can; it trains (`pose.train`) and elevates (`pose.elevate`),
 *                  modelled, never fired. A layout's `yaw` sets where it points at rest (an aft gun's 180). Points: `mount`,
 *                  `grip` (where its gunner's hands are)
 *   boat-jet       a waterjet drive (boat-mil.js) on a hull's `jetPair` point (the hull's `jets: { spacing, z }`): its
 *                  nozzle steers (`pose.yaw`), its reverse bucket drops (`pose.reverse`), a pair mirrored and steering
 *                  together. Its mass its engine's too, inside the hull. Points: `mount`, `nozzle`
 *   boat-cabin     a cabin on the sole (boat-mil.js): an armoured `pilothouse`, faceted, its front raked to its windows
 *                  (`shoulder`, `lean`, `rake`, `front`), its gun `ring` and `mast` on its roof. Points: `mount`,
 *                  `roofGun` (where a mount stands on its ring)
 *   boat-ramp      a bow ramp (boat-mil.js) on a ramp bow's `ramp` point, hinged across its foot: it lowers (`pose.ramp`).
 *                  Points: `mount`, `toe`
 *   boat-shaft     an inboard drive's running gear (boat-mil.js) on a hull's `shaftPair` point (`shafts: { spacing, at }`):
 *                  its shaft, strut, propeller (`pose.prop`) and rudder (`pose.yaw`), a pair mirrored. Its mass its
 *                  engine's too. Points: `mount`, `prop`
 *   boat-arch      a radar arch on the sole across the cockpit (boat-mil.js): A-framed legs, the crossbar, the radar's
 *                  dome, an all-round light, a light bar, whip antennas. Points: `mount`, `top`
 *   (a warship's parts are boat-ship.js's, on the kinds above: `boat-cabin`'s `superstructure` (stepped tiers, the
 *                  bridge on the top one; points on a tier's roof), `funnel` and `hangar`; `boat-arch`'s `pyramid` mast;
 *                  `boat-mount`'s `turret`, `ciws` and `vls`, modelled, never fired; a `boat-shaft`'s `scale`, its running
 *                  gear grown to a ship's)
 *   boat-deck      a carrier's flight deck laid over a hull's deck point (boat-carrier.js): its plan overhanging the hull,
 *                  its gallery under it, the angled deck's markings, catapults and their deflectors (`pose.deflector`),
 *                  arresting wires, deck-edge lifts (`pose.lift`) before the hangar's openings, sponsons under its edge,
 *                  parking spots (vehicle-registry/carry.js `flightDeck` says which aircraft park there). Points:
 *                  `mount`, `island`, `sponson_<k>`, `spot_<k>`
 *   boat-top       a top over the helm standing on the console's point (boat-helm.js): its legs (`legs`: their feet's
 *                  places beside the console, their tops' and lean), its hardtop (`height` over the sole, `over` its front
 *                  and back, `thickness`), its front `brace`, `rods` rod holders. Points: `mount`
 *
 * Hull families: 'round' (a submarine's body of revolution, its casing, sail, stern planes and screw: boat-sub.js's head says
 * what it carries) and 'vee' (a chine between the bottom and the side: a V-bottom by its deadrise, a flat bottom when the
 * chine is at the keel's height). Its bow: 'stem' (it comes to a stem) or 'square' (a jon boat's: the bottom's rocker
 * meets a small transom at the bow, its rail across it). A hull may also carry a `sole` (a floor laid flat across the
 * bottom at its height, the liner clipped to it), a `collar` (a RIB's tube round the sheer: its radius, how far it sits
 * out and up of the sheer, its rise at the bow, its cones aft of the transom, a lifeline along its top; no gunwale rails
 * then) and `tint` (the liner's colour role: 'chrome' bare metal, 'paint' a moulded hull); a moulded deck's `cap` (the
 * gunwale's cap, its width: the liner's top pulled inboard), `points` (named points on the sole at fractions of its
 * length, where a console or a seat stands), a `stripe` along the topsides; fittings `bowRail` (stanchions and a rail
 * round the bow), `navLights` (the sidelights on the bow, the all-round light aft), `rodHolders` (at fractions of its
 * length; `navLights.pole: false` when the all-round light is on a top); a cuddy's `trunk` (its cabin top on the
 * foredeck: from, to, inset from the sheer, height, `ports` along its sides, a `hatch`), its `companionway` (the cabin's
 * door in the deck's aft bulkhead) and a `windscreen` that fits the hull (across the boat at `at`, its wings along the
 * gunwales to `to`, a `walk`-through in its middle); a point may be `[s, x]`, x to starboard; a bench may carry a
 * `cushion`; fittings `rails` (guard rails along a weather deck: stanchions every `step`, two lifelines) and `rafts`
 * (life-raft canisters on their cradles, `[s, x]` each), `helipad` (a flight deck's markings: from, to, `circle`); a point may be `[s, x, 'deck']`, on the deck; `motors: { spacing }` gives twin outboards a `motorPair`
 * point, a layout entry paired across the boat on it (the port motor its mirror, steering with it, its propeller
 * counter-rotating); a `ramp` bow (a square bow left open above its sole, for a `boat-ramp`), an `aftDeck` (`{ to, z }`:
 * the liner raised to a deck over an engine room aft of `to`; a point `[s, x, 'aft']` on it), a well deck's `cargo`
 * (`{ from, to, width }`: its area on the sole, a `cargo` point at its middle: vehicle-registry/carry.js says what fits)
 * and `shafts` (a second, inboard pair: `shafts.inner`, its `shaftPairInner` point). Outboard families: 'tiller' (steered by its own tiller) and 'remote' (steered and shifted from a helm: its
 * rigging into the boat, a steering ram along its tilt tube, bolted through the transom), its brackets, leg and gearcase
 * drawn at `leg` of the 20 hp class's size, its pan `cowl.lift` over the clamp, its cowl's colour role `tint.cowl`. Sized to a public class, every name generic: a class, never a product.
 */

export const BOAT_KINDS = Object.freeze({
  'boat-hull': 'a boat\'s hull: drawn from its lines, its skin and liner, its transom, deck, benches and fittings',
  'boat-outboard': 'an outboard motor on a boat\'s transom: its cowl, its leg, its propeller and its tiller',
  'boat-tank': 'a boat\'s portable fuel tank',
  'boat-console': 'a boat\'s console: its windscreen, grab rail, helm, dash and throttle',
  'boat-seat': 'a seat on a boat\'s sole: a cooler seat, a leaning post',
  'boat-top': 'a top over a boat\'s helm: a T-top, its legs, hardtop, rod holders and lights',
  'boat-mount': 'a weapon on its mount on a boat\'s deck or sole: a machine gun, a naval gun, launch cells (modelled, never fired)',
  'boat-arch': 'a radar arch over a boat\'s cockpit, a davit, a ship\'s pyramid mast with its radar arrays',
  'boat-jet': 'a waterjet drive through a boat\'s transom: its pump, its steering nozzle, its reverse bucket',
  'boat-cabin': 'a cabin on a boat\'s deck: an armoured pilothouse, a bridge, a ship\'s superstructure, funnel and hangar',
  'boat-ramp': 'a landing craft\'s bow ramp, hinged across its foot: it lowers onto a beach',
  'boat-shaft': 'an inboard drive\'s running gear under a boat: its shaft, strut, propeller and rudder',
  'boat-deck': 'a carrier\'s flight deck over its hull: its angled deck, catapults, wires, lifts and sponsons',
});

export const BOAT_ODM = {
  // ===== a 14 ft aluminium V-bottom skiff ======================================================
  'hull-skiff-v14': {
    kind: 'boat-hull', realm: 'water', label: '14 ft V-bottom skiff hull', classOf: '14 ft aluminium utility skiff class (4.3 m, 25 hp)',
    aliases: ['skiff hull', 'v-bottom hull', 'aluminium skiff hull', 'utility boat hull'],
    // (its depth amidships, keel to sheer)
    dims: { length: 4.27, beam: 1.64, depth: 0.5 }, mass: 118, mount: 'keel',
    // (its plate's rating: the people it seats, the load it carries in kilograms, the power it takes in kilowatts: 25 hp)
    perf: { persons: 3, load: 340, maxPower: 18.6 },
    build: {
      family: 'vee', bow: 'stem',
      lines: {
        keel: [[0, 0], [0.55, 0], [0.76, 0.035], [0.9, 0.15], [1, 0.4]],
        sheer: [[0, 0.4], [0.3, 0.45], [0.6, 0.53], [0.85, 0.64], [1, 0.74]],
        sheerHalf: [[0, 0.7], [0.25, 0.795], [0.5, 0.815], [0.72, 0.72], [0.88, 0.47], [1, 0]],
        chine: [[0, 0.1], [0.5, 0.115], [0.78, 0.19], [0.92, 0.33], [1, 0.52]],
        chineHalf: [[0, 0.585], [0.3, 0.64], [0.55, 0.62], [0.8, 0.43], [0.93, 0.17], [1, 0]],
      },
      // the skin's and the liner's thickness (a riveted plate and its frames, drawn thick enough that a curved quad's twist never
      // brings one through the other), the side's flare
      // (its bulge between the chine and the sheer)
      skin: 0.012, liner: 0.01, flare: 0.012,
      transom: { rake: 13, thickness: 0.05 },
      deck: { from: 0.86, thickness: 0.03 },
      gunwale: 0.018, keelStrip: 0.011,
      strakes: { at: [0.45], from: 0.3, to: 0.9, radius: 0.007 },
      ribs: [0.2, 0.31, 0.6, 0.7],
      benches: [
        { name: 'seatAft', at: 0.045, depth: 0.3, top: 0.34 },
        { name: 'seatMid', at: 0.43, depth: 0.25, top: 0.36 },
        { name: 'seatBow', at: 0.72, depth: 0.24, top: 0.42 },
      ],
      fittings: { bowEye: 0.46, bowHandle: true, cleats: 0.06, oarlocks: 0.5, drain: true, transomEyes: true, pad: 0.42 },
      tank: { at: 0.16, x: 0.3, width: 0.34 },
    },
  },
  // ===== a 12 ft aluminium jon boat: flat-bottomed, square-bowed ==============================
  'hull-jon-12': {
    kind: 'boat-hull', realm: 'water', label: '12 ft jon boat hull', classOf: '12 ft aluminium jon boat class (3.7 m, 15 hp)',
    aliases: ['jon boat hull', 'john boat hull', 'flat-bottom hull', 'flat bottom hull'],
    // (its depth amidships, keel to sheer)
    dims: { length: 3.66, beam: 1.42, depth: 0.39 }, mass: 75, mount: 'keel',
    perf: { persons: 2, load: 250, maxPower: 11.2 },
    build: {
      // (flat-bottomed: its chine at its keel's height, the bottom level across; its bow a small square transom where the
      // bottom's rocker meets the sheer)
      family: 'vee', bow: 'square',
      lines: {
        keel: [[0, 0], [0.62, 0], [0.82, 0.05], [0.94, 0.15], [1, 0.25]],
        sheer: [[0, 0.38], [0.5, 0.39], [0.85, 0.43], [1, 0.47]],
        sheerHalf: [[0, 0.65], [0.4, 0.71], [0.75, 0.67], [0.92, 0.55], [1, 0.45]],
        chine: [[0, 0.005], [0.62, 0.005], [0.82, 0.055], [0.94, 0.155], [1, 0.255]],
        chineHalf: [[0, 0.52], [0.4, 0.57], [0.75, 0.52], [0.92, 0.41], [1, 0.33]],
      },
      skin: 0.012, liner: 0.01, flare: 0.006,
      transom: { rake: 13, thickness: 0.05 },
      deck: { from: 0.9, thickness: 0.03 },
      gunwale: 0.016, keelStrip: 0.01,
      // (its bottom's runners: two strakes each side, flat along the bottom)
      strakes: { at: [0.35, 0.75], from: 0.06, to: 0.86, radius: 0.007 },
      ribs: [0.27, 0.38, 0.62],
      benches: [
        { name: 'seatAft', at: 0.05, depth: 0.28, top: 0.31 },
        { name: 'seatMid', at: 0.47, depth: 0.24, top: 0.31 },
        { name: 'seatBow', at: 0.76, depth: 0.22, top: 0.34 },
      ],
      fittings: { bowEye: 0.35, cleats: 0.06, oarlocks: 0.52, drain: true, transomEyes: 0.42, pad: 0.36 },
      tank: { at: 0.17, x: 0.3, width: 0.34 },
    },
  },
  // ===== a 3.1 m rigid inflatable tender: a deep-V moulded hull in its collar ==================
  'hull-rib-31': {
    kind: 'boat-hull', realm: 'water', label: '3.1 m rigid inflatable hull', classOf: '3.1 m RIB tender class (20 hp)',
    aliases: ['rib hull', 'rigid inflatable hull', 'tender hull'],
    // (its length and beam over its collar; its hull's own length the lines' and its depth amidships keel to sheer)
    dims: { length: 2.8, beam: 1.56, depth: 0.42 }, mass: 92, mount: 'keel',
    perf: { persons: 4, load: 420, maxPower: 14.9 },
    build: {
      family: 'vee', bow: 'stem',
      lines: {
        keel: [[0, 0], [0.58, 0], [0.82, 0.07], [0.94, 0.19], [1, 0.33]],
        sheer: [[0, 0.38], [0.5, 0.42], [0.85, 0.47], [1, 0.5]],
        sheerHalf: [[0, 0.43], [0.4, 0.48], [0.72, 0.42], [0.9, 0.24], [1, 0]],
        chine: [[0, 0.15], [0.5, 0.16], [0.82, 0.24], [0.94, 0.33], [1, 0.42]],
        chineHalf: [[0, 0.37], [0.4, 0.41], [0.72, 0.33], [0.9, 0.16], [1, 0]],
      },
      // (moulded glass fibre, white inside and out; a flat sole across the V; a locker under its bow)
      tint: { liner: 'paint' },
      skin: 0.012, liner: 0.01, flare: 0,
      transom: { rake: 12, thickness: 0.05 },
      sole: 0.17, deck: { from: 0.8, thickness: 0.06 },
      keelStrip: 0.012,
      strakes: { at: [0.4, 0.75], from: 0.2, to: 0.85, radius: 0.008 },
      // (its collar: a tube round the sheer and its cones aft of the transom; trim its fabric, its rubbing strake and lifeline)
      collar: { radius: 0.21, out: 0.5, up: -0.1, rise: 0.16, aft: 0.32, nose: 0.92, lifeline: true },
      benches: [{ name: 'seatMid', at: 0.5, depth: 0.26, top: 0.47 }],
      fittings: { bowEye: 0.34, drain: true, transomEyes: 0.28, pad: 0.36 },
      tank: { at: 0.14, x: 0.18, width: 0.26 },
    },
  },
  // ===== a 17 ft moulded centre console: a deep V, a sole, a casting deck forward ===============
  'hull-cc-17': {
    kind: 'boat-hull', realm: 'water', label: '17 ft centre console hull', classOf: '17 ft centre console class (5.2 m, 90 hp)',
    aliases: ['centre console hull', 'center console hull', 'runabout hull', 'motor well hull'],
    // (its depth amidships, keel to sheer)
    dims: { length: 5.18, beam: 2.13, depth: 0.76 }, mass: 480, mount: 'keel',
    perf: { persons: 6, load: 590, maxPower: 85 },
    build: {
      family: 'vee', bow: 'stem',
      lines: {
        keel: [[0, 0], [0.5, 0], [0.74, 0.06], [0.9, 0.24], [1, 0.58]],
        sheer: [[0, 0.7], [0.4, 0.76], [0.7, 0.84], [0.9, 0.96], [1, 1.05]],
        sheerHalf: [[0, 0.93], [0.35, 1.06], [0.6, 1.05], [0.8, 0.86], [0.93, 0.5], [1, 0]],
        chine: [[0, 0.28], [0.5, 0.3], [0.75, 0.38], [0.9, 0.56], [1, 0.78]],
        chineHalf: [[0, 0.86], [0.35, 0.95], [0.6, 0.9], [0.8, 0.66], [0.93, 0.3], [1, 0]],
      },
      // (moulded glass fibre: white inside, its gunwale a wide cap; a sole across the V, a casting deck forward)
      tint: { liner: 'paint' }, cap: 0.13,
      skin: 0.014, liner: 0.012, flare: 0.03, stations: { mid: 0.025, bow: 0.012 },
      transom: { rake: 14, thickness: 0.06 },
      sole: 0.26, deck: { from: 0.8, thickness: 0.24 },
      // (its motor well: the transom notched to a 20 in shaft's height, the splashwell's floor and bulkhead forward of it)
      well: { width: 0.78, notch: 0.51, floor: 0.47, length: 0.75, top: 0.64 },
      gunwale: 0.024, keelStrip: 0,
      strakes: { at: [0.35, 0.7], from: 0.15, to: 0.88, radius: 0.012 },
      stripe: { at: 0.74, radius: 0.012, tint: 'trim' },
      points: { console: 0.5, helmSeat: 0.33, frontSeat: 0.63 },
      fittings: {
        bowEye: 0.66, cleats: 0.04, drain: true, transomEyes: 0.62, navLights: true, rodHolders: [0.1, 0.19],
        bowRail: { from: 0.83, to: 0.96, posts: 3, height: 0.42 },
      },
    },
  },
  // ===== a 19 ft cuddy cabin: a long foredeck over its cabin, a windscreen across, a motor well =====
  'hull-cuddy-19': {
    kind: 'boat-hull', realm: 'water', label: '19 ft cuddy cabin hull', classOf: '19 ft cuddy cabin class (5.8 m, 150 hp)',
    aliases: ['cuddy hull', 'cuddy cabin hull', 'cabin runabout hull'],
    // (its depth amidships, keel to sheer)
    dims: { length: 5.8, beam: 2.36, depth: 1.05 }, mass: 880, mount: 'keel',
    perf: { persons: 7, load: 680, maxPower: 130 },
    build: {
      family: 'vee', bow: 'stem',
      lines: {
        keel: [[0, 0], [0.5, 0], [0.74, 0.07], [0.9, 0.28], [1, 0.66]],
        sheer: [[0, 0.95], [0.45, 1.03], [0.7, 1.12], [0.9, 1.24], [1, 1.32]],
        sheerHalf: [[0, 1.04], [0.35, 1.18], [0.6, 1.16], [0.8, 0.96], [0.93, 0.56], [1, 0]],
        chine: [[0, 0.32], [0.5, 0.34], [0.75, 0.44], [0.9, 0.64], [1, 0.9]],
        chineHalf: [[0, 0.96], [0.35, 1.06], [0.6, 1.0], [0.8, 0.74], [0.93, 0.34], [1, 0]],
      },
      // (moulded, white inside; its foredeck flush with its sheer over the cabin from `deck.from` to the bow; a sole aft)
      tint: { liner: 'paint' }, cap: 0.12,
      skin: 0.016, liner: 0.014, flare: 0.035, stations: { mid: 0.022, bow: 0.012 },
      transom: { rake: 14, thickness: 0.06 },
      sole: 0.3, deck: { from: 0.52, thickness: 0.04 },
      well: { width: 0.82, notch: 0.645, floor: 0.6, length: 0.8, top: 0.86 },
      gunwale: 0.024, keelStrip: 0,
      strakes: { at: [0.32, 0.66], from: 0.12, to: 0.88, radius: 0.013 },
      stripe: { at: 0.7, radius: 0.014, tint: 'trim' },
      // (the cabin's top on the foredeck, its doorway below the windscreen's walk-through, the windscreen across)
      trunk: { from: 0.54, to: 0.86, inset: 0.26, height: 0.42, ports: [0.22, 0.5], portLength: 0.4, hatch: 0.62 },
      companionway: { width: 0.5 },
      windscreen: { at: 0.525, to: 0.6, height: 0.42, rake: 32, walk: 0.56 },
      benches: [{ name: 'seatAft', at: 0.145, depth: 0.46, top: 0.75, cushion: true }],
      points: { helm: [0.462, 0.56], passenger: [0.462, -0.56], helmSeat: [0.37, 0.56], passengerSeat: [0.37, -0.56] },
      fittings: {
        bowEye: 0.74, cleats: 0.04, drain: true, transomEyes: 0.7, navLights: true, rodHolders: [0.1],
        bowRail: { from: 0.8, to: 0.96, posts: 3, height: 0.4 },
      },
    },
  },
  // ===== a 7.5 m combat RHIB: a deep V in its collar, a full transom for twin outboards =========
  'hull-rhib-mil-75': {
    kind: 'boat-hull', realm: 'water', label: '7.5 m military RHIB hull', classOf: '7.5 m combat RHIB class (twin 150 hp)',
    aliases: ['military rhib hull', 'combat rib hull', 'rhib hull'],
    // (its length and beam over its collar; its hull's own length the lines', its depth amidships keel to sheer)
    dims: { length: 7.0, beam: 2.7, depth: 0.7 }, mass: 1350, mount: 'keel',
    perf: { persons: 10, load: 1000, maxPower: 230 },
    build: {
      family: 'vee', bow: 'stem',
      lines: {
        keel: [[0, 0], [0.55, 0], [0.78, 0.08], [0.92, 0.28], [1, 0.55]],
        sheer: [[0, 0.65], [0.5, 0.7], [0.8, 0.8], [1, 0.92]],
        sheerHalf: [[0, 0.88], [0.4, 0.95], [0.72, 0.84], [0.9, 0.48], [1, 0]],
        chine: [[0, 0.36], [0.5, 0.38], [0.8, 0.48], [0.93, 0.62], [1, 0.8]],
        chineHalf: [[0, 0.78], [0.4, 0.84], [0.72, 0.7], [0.9, 0.34], [1, 0]],
      },
      // (moulded; its collar's tubes in the trim, a self-bailing sole across the V above its loaded waterline, a locker
      // under its bow's deck)
      tint: { liner: 'paint' },
      skin: 0.016, liner: 0.014, flare: 0, stations: { mid: 0.022, bow: 0.012 },
      transom: { rake: 12, thickness: 0.06 },
      sole: 0.54, deck: { from: 0.78, thickness: 0.1 },
      keelStrip: 0,
      strakes: { at: [0.35, 0.7], from: 0.15, to: 0.88, radius: 0.014 },
      collar: { radius: 0.27, out: 0.5, up: -0.1, rise: 0.22, aft: 0.42, nose: 0.92, lifeline: true },
      motors: { spacing: 0.72 },
      points: {
        console: 0.52, jockeyF: [0.42, 0.3], jockeyFP: [0.42, -0.3], jockeyA: [0.33, 0.3], jockeyAP: [0.33, -0.3],
        arch: 0.13, gunAft: 0.215, gunBow: [0.84, 0, 'deck'],
      },
      fittings: { bowEye: 0.5, drain: true, transomEyes: 0.6 },
    },
  },
  // ===== a 10 m riverine patrol boat: an aluminium deep V, a full transom for its waterjets ======
  'hull-riverine-10': {
    kind: 'boat-hull', realm: 'water', label: '10 m riverine patrol hull', classOf: '10 m riverine patrol boat class (twin waterjets)',
    aliases: ['riverine hull', 'patrol boat hull', 'river patrol hull'],
    // (its depth amidships, keel to sheer)
    dims: { length: 10.0, beam: 3.15, depth: 1.3 }, mass: 5200, mount: 'keel',
    perf: { persons: 14, load: 1800, maxPower: 700 },
    build: {
      family: 'vee', bow: 'stem',
      lines: {
        keel: [[0, 0], [0.55, 0], [0.78, 0.12], [0.92, 0.42], [1, 0.95]],
        sheer: [[0, 1.25], [0.5, 1.3], [0.8, 1.42], [1, 1.6]],
        sheerHalf: [[0, 1.45], [0.4, 1.56], [0.72, 1.4], [0.9, 0.85], [1, 0]],
        chine: [[0, 0.42], [0.5, 0.45], [0.8, 0.6], [0.93, 0.85], [1, 1.15]],
        chineHalf: [[0, 1.3], [0.4, 1.38], [0.72, 1.18], [0.9, 0.6], [1, 0]],
      },
      // (welded aluminium, painted inside and out; a self-bailing sole over its waterline, a raised foredeck)
      tint: { liner: 'paint' },
      skin: 0.016, liner: 0.014, flare: 0.03, stations: { mid: 0.016, bow: 0.008 },
      transom: { rake: 4, thickness: 0.08 },
      sole: 0.82, deck: { from: 0.8, thickness: 0.22 },
      gunwale: 0.05, keelStrip: 0,
      strakes: { at: [0.33, 0.66], from: 0.15, to: 0.88, radius: 0.018 },
      stripe: { at: 0.6, radius: 0.016, tint: 'trim' },
      jets: { spacing: 1.1, z: 0.32 },
      points: { pilothouse: 0.5, gunBow: [0.86, 0, 'deck'], gunAft: 0.12 },
      fittings: { bowEye: 0.85, cleats: 0.05, transomEyes: 1.05, navLights: { pole: false } },
    },
  },
  // ===== a 22 m landing craft: a flat bottom, a ramp at its bow, a well deck, an engine room aft ==
  'hull-landing-22': {
    kind: 'boat-hull', realm: 'water', label: '22 m landing craft hull', classOf: '22 m mechanised landing craft class (twin diesels)',
    aliases: ['landing craft hull', 'lcm hull', 'ramp bow hull'],
    // (its depth amidships, keel to its wing walls' top)
    dims: { length: 22.0, beam: 6.4, depth: 2.6 }, mass: 38000, mount: 'keel',
    perf: { persons: 6, load: 54000, maxPower: 1100 },
    build: {
      // (flat-bottomed: its chine at its keel; its stern lifted over its propellers, its forefoot lifted to beach)
      family: 'vee', bow: 'ramp',
      lines: {
        keel: [[0, 0.75], [0.08, 0.55], [0.2, 0.05], [0.3, 0], [0.85, 0], [0.95, 0.25], [1, 0.55]],
        sheer: [[0, 2.6], [0.5, 2.6], [1, 2.9]],
        sheerHalf: [[0, 3.15], [0.5, 3.2], [0.9, 3.15], [1, 2.95]],
        chine: [[0, 0.77], [0.08, 0.57], [0.2, 0.07], [0.3, 0.02], [0.85, 0.02], [0.95, 0.27], [1, 0.57]],
        chineHalf: [[0, 3.0], [0.5, 3.1], [0.9, 3.0], [1, 2.75]],
      },
      // (welded steel; its wing walls thick, buoyant; the well deck the sole, the engine room under the aft deck)
      tint: { liner: 'paint' },
      skin: 0.04, liner: 0.5, flare: 0.02, stations: { mid: 0.012, bow: 0.006 },
      transom: { rake: 0, thickness: 0.15 },
      sole: 0.85, aftDeck: { to: 0.22, z: 1.85 },
      gunwale: 0.09, keelStrip: 0,
      cargo: { from: 0.25, to: 0.97, width: 4.8 },
      shafts: { spacing: 2.6, at: 0.07 },
      points: { pilothouse: [0.09, 0, 'aft'], gunAftR: [0.19, 1.9, 'aft'], gunAftL: [0.19, -1.9, 'aft'] },
      fittings: { cleats: 0.03, transomEyes: 2.2, navLights: { pole: false } },
    },
  },
  // ===== a 25 m navy patrol boat: a deep V with bow flare, a flush weather deck ===================
  'hull-patrol-25': {
    kind: 'boat-hull', realm: 'water', label: '25 m navy patrol boat hull', classOf: '25 m coastal patrol boat class (twin waterjets)',
    aliases: ['navy patrol hull', 'coastal patrol hull', 'fast patrol hull'],
    // (its depth amidships, keel to sheer)
    dims: { length: 25.0, beam: 5.6, depth: 3.0 }, mass: 52000, mount: 'keel',
    perf: { persons: 18, load: 12000, maxPower: 3400 },
    build: {
      family: 'vee', bow: 'stem',
      lines: {
        keel: [[0, 0.05], [0.55, 0], [0.78, 0.25], [0.92, 0.95], [1, 2.3]],
        sheer: [[0, 2.9], [0.5, 3.0], [0.8, 3.3], [1, 3.75]],
        sheerHalf: [[0, 2.5], [0.4, 2.8], [0.72, 2.55], [0.9, 1.5], [1, 0]],
        chine: [[0, 0.85], [0.5, 0.9], [0.8, 1.25], [0.93, 1.9], [1, 2.6]],
        chineHalf: [[0, 2.3], [0.4, 2.5], [0.72, 2.1], [0.9, 1.0], [1, 0]],
      },
      // (welded, haze grey inside and out; a flush weather deck the whole length, its stern closed by the aft deck)
      tint: { liner: 'paint' },
      skin: 0.03, liner: 0.03, flare: 0.12, stations: { mid: 0.01, bow: 0.006 },
      transom: { rake: 0, thickness: 0.15 },
      deck: { from: 0.045, thickness: 0.12 }, aftDeck: { to: 0.05, z: 2.78 },
      gunwale: 0.07, keelStrip: 0,
      strakes: { at: [0.35, 0.7], from: 0.12, to: 0.88, radius: 0.03 },
      jets: { spacing: 1.8, z: 0.55 },
      points: { bridge: [0.52, 0, 'deck'], cannon: [0.8, 0, 'deck'], seaBoat: [0.13, 0, 'deck'], davit: [0.13, 2.05, 'deck'] },
      fittings: {
        cleats: 0.03, transomEyes: 2.0,
        rails: { from: 0.05, to: 0.84, step: 0.035, height: 1.0 },
        bowRail: { from: 0.85, to: 0.97, posts: 3, height: 1.0 },
        rafts: [[0.29, 1.65], [0.29, -1.65], [0.335, 1.65], [0.335, -1.65]],
      },
    },
  },
  // ===== a destroyer's hull ===================================================================
  'hull-destroyer-150': {
    kind: 'boat-hull', realm: 'water', label: '150 m destroyer hull', classOf: '150 m guided-missile destroyer class (twin screws)',
    aliases: ['destroyer hull', 'warship hull'],
    // (its depth amidships, keel to sheer)
    dims: { length: 150, beam: 20.4, depth: 12.0 }, mass: 5800000, mount: 'keel',
    perf: { persons: 320, load: 1600000, maxPower: 75000 },
    build: {
      family: 'vee', bow: 'stem',
      lines: {
        keel: [[0, 3.6], [0.2, 1.4], [0.34, 0], [0.84, 0], [0.94, 1.4], [1, 6.0]],
        sheer: [[0, 10.8], [0.5, 12.0], [0.8, 13.4], [1, 15.6]],
        sheerHalf: [[0, 8.4], [0.28, 10.1], [0.5, 10.2], [0.72, 9.2], [0.9, 5.2], [1, 0]],
        chine: [[0, 4.4], [0.2, 3.0], [0.4, 2.4], [0.72, 2.6], [0.9, 4.2], [1, 6.8]],
        chineHalf: [[0, 8.0], [0.28, 9.3], [0.5, 9.4], [0.72, 7.9], [0.9, 3.4], [1, 0]],
      },
      // (welded, haze grey inside and out; a flush weather deck the whole length, its stern closed by the aft deck)
      tint: { liner: 'paint' },
      skin: 0.05, liner: 0.05, flare: 0.3, stations: { mid: 0.008, bow: 0.005 },
      transom: { rake: 0, thickness: 0.3 },
      deck: { from: 0.02, thickness: 0.3 }, aftDeck: { to: 0.02, z: 10.4 },
      gunwale: 0.12, keelStrip: 0,
      strakes: { at: [0.5], from: 0.3, to: 0.7, radius: 0.12 },
      shafts: { spacing: 9.0, at: 0.26 },
      // (where its upperworks, its weapons and its boats stand on the weather deck: x to starboard)
      points: {
        super: [0.5, 0, 'deck'], hangar: [0.215, 0, 'deck'], vlsAft: [0.305, 0, 'deck'], vlsFwd: [0.745, 0, 'deck'], gun: [0.83, 0, 'deck'],
        seaBoat: [0.38, 6.8, 'deck'], davit: [0.38, 8.8, 'deck'],
      },
      fittings: {
        cleats: 0.04, helipad: { from: 0.025, to: 0.16, circle: 12 },
        rails: { from: 0.02, to: 0.88, step: 0.012, height: 1.1 },
        bowRail: { from: 0.89, to: 0.98, posts: 4, height: 1.1 },
        rafts: [[0.6, 9.0], [0.6, -9.0], [0.615, 9.0], [0.615, -9.0], [0.63, 9.0], [0.63, -9.0]],
      },
    },
  },
  // ===== an aircraft carrier's hull ============================================================
  'hull-carrier-300': {
    kind: 'boat-hull', realm: 'water', label: '300 m aircraft carrier hull', classOf: '300 m fleet aircraft carrier class (four screws)',
    aliases: ['carrier hull', 'flattop hull'],
    // (its depth amidships, keel to the hangar's roof: the flight deck is laid on it)
    dims: { length: 300, beam: 40.8, depth: 25 }, mass: 57000000, mount: 'keel',
    perf: { persons: 5000, load: 18000000, maxPower: 200000 },
    build: {
      family: 'vee', bow: 'stem',
      lines: {
        keel: [[0, 8.0], [0.15, 4.0], [0.28, 0], [0.86, 0], [0.95, 2.0], [1, 10.0]],
        sheer: [[0, 25], [0.5, 25], [0.85, 25.3], [1, 26]],
        sheerHalf: [[0, 15], [0.2, 19.6], [0.5, 20.4], [0.75, 19], [0.9, 11], [1, 0]],
        chine: [[0, 9.5], [0.15, 6.0], [0.35, 2.8], [0.75, 3.0], [0.9, 5.5], [1, 11]],
        chineHalf: [[0, 14], [0.2, 18.6], [0.5, 19.4], [0.75, 17.5], [0.9, 9], [1, 0]],
      },
      // (closed to the flight deck: a hurricane bow, its sides up to the deck it carries)
      tint: { liner: 'paint' },
      skin: 0.08, liner: 0.08, flare: 0.3, stations: { mid: 0.008, bow: 0.005 },
      transom: { rake: 0, thickness: 0.4 },
      deck: { from: 0.02, thickness: 0.5 }, aftDeck: { to: 0.02, z: 24.4 },
      gunwale: 0.15, keelStrip: 0,
      strakes: { at: [0.5], from: 0.25, to: 0.8, radius: 0.2 },
      shafts: { spacing: 22, at: 0.2, inner: { spacing: 9, at: 0.24 } },
      points: { flightDeck: [0.5, 0, 'deck'] },
      fittings: {},
    },
  },
  // ===== a submarine's hull ===================================================================
  'hull-sub-attack-110': {
    kind: 'boat-hull', realm: 'water', label: '110 m attack submarine hull', classOf: '110 m nuclear attack submarine class (single screw)',
    aliases: ['submarine hull', 'pressure hull'],
    // (its diameter its beam and its depth)
    dims: { length: 110, beam: 10.4, depth: 10.4 }, mass: 5900000, mount: 'keel',
    perf: { persons: 135, maxPower: 30000 },
    build: {
      family: 'round',
      // (its radius from the stern's cone through its parallel middle to its rounded bow; its axis above its keel)
      body: { axis: 5.2, radius: [[0, 0.55], [0.03, 1.15], [0.1, 2.7], [0.2, 4.4], [0.3, 5.1], [0.36, 5.2], [0.84, 5.2], [0.92, 4.85], [0.97, 3.5], [0.995, 1.6], [1, 0]] },
      casing: { from: 0.22, to: 0.93, width: 3.4, top: 5.5, hatches: [0.3, 0.55, 0.88] },
      tubes: { at: 0.955, count: 2 },
      sail: {
        at: 0.72, chord: 10, thickness: 2.4, height: 6.2, taper: 0.9,
        planes: { at: 0.3, height: 0.62, span: 3.6, chord: 2.6, throw: 20 },
        // (its periscopes forward, its radar and its communications masts aft of them)
        masts: [{ at: 0.2, height: 4.5, radius: 0.2, head: 0.26 }, { at: 0.35, height: 4.0, radius: 0.18, head: 0.24 }, { at: 0.55, x: 0.4, height: 3.2, radius: 0.3 }, { at: 0.7, x: -0.4, height: 3.6, radius: 0.22 }],
      },
      stern: { form: '+', at: 0.11, span: 3.4, chord: 5.0, flap: 0.4, throw: 25 },
      screw: { blades: 7, diameter: 6.4, skew: 0.5, pitch: 1.0 },
    },
  },
  // ===== a 20 hp tiller outboard, short shaft ==================================================
  'outboard-20-tiller': {
    kind: 'boat-outboard', realm: 'water', label: '20 hp tiller outboard, short shaft', classOf: '20 hp four-stroke tiller outboard class',
    aliases: ['20 hp outboard', 'tiller outboard', 'outboard motor', 'outboard', 'kicker'],
    dims: { length: 1.19, width: 0.41, height: 1.18 }, mass: 46, mount: 'transom-clamp',
    // (power in kilowatts, its propeller in metres: a 9.25 in by 10 in three-blade)
    perf: { power: 14.9 },
    build: {
      family: 'tiller', shaft: 0.381, transom: 0.05, rake: 13,
      cowl: { length: 0.56, width: 0.35, height: 0.42 },
      prop: { blades: 3, diameter: 0.235, pitch: 0.254, hand: 'rh' },
      tiller: 0.62, tilt: 68, steer: 35, fold: { angle: 80 },
    },
  },
  // ===== a 9.9 hp tiller outboard, short shaft =================================================
  'outboard-10-tiller': {
    kind: 'boat-outboard', realm: 'water', label: '9.9 hp tiller outboard, short shaft', classOf: '9.9 hp four-stroke tiller outboard class',
    aliases: ['9.9 hp outboard', 'ten horse outboard', 'small outboard'],
    dims: { length: 1.08, width: 0.38, height: 1.12 }, mass: 40, mount: 'transom-clamp',
    perf: { power: 7.4 },
    build: {
      family: 'tiller', shaft: 0.381, transom: 0.05, rake: 13, leg: 0.88,
      cowl: { length: 0.5, width: 0.31, height: 0.37 },
      prop: { blades: 3, diameter: 0.229, pitch: 0.229, hand: 'rh' },
      tiller: 0.56, tilt: 68, steer: 35, fold: { angle: 80 },
    },
  },
  // ===== a 90 hp remote outboard, 25 in shaft ==================================================
  'outboard-90-remote': {
    kind: 'boat-outboard', realm: 'water', label: '90 hp remote outboard, 25 in shaft', classOf: '90 hp four-stroke remote outboard class',
    aliases: ['90 hp outboard', 'remote outboard', 'remote steer outboard'],
    dims: { length: 0.98, width: 0.6, height: 1.86 }, mass: 162, mount: 'transom-bolt',
    perf: { power: 66.2 },
    build: {
      family: 'remote', shaft: 0.635, transom: 0.06, rake: 14, leg: 1.45,
      cowl: { length: 0.8, width: 0.47, height: 0.6, lift: 0.2, pan: 1.4 },
      prop: { blades: 3, diameter: 0.356, pitch: 0.432, hand: 'rh' },
      tilt: 70, steer: 30, tint: { cowl: 'paint' },
    },
  },
  // ===== a 90 hp remote outboard, 20 in shaft: a motor well's ==================================
  'outboard-90-remote-20': {
    kind: 'boat-outboard', realm: 'water', label: '90 hp remote outboard, 20 in shaft', classOf: '90 hp four-stroke remote outboard class',
    aliases: ['90 hp outboard 20 in', 'remote outboard 20 in'],
    dims: { length: 0.98, width: 0.6, height: 1.73 }, mass: 158, mount: 'transom-bolt',
    perf: { power: 66.2 },
    build: {
      family: 'remote', shaft: 0.508, transom: 0.06, rake: 14, leg: 1.45,
      cowl: { length: 0.8, width: 0.47, height: 0.6, lift: 0.2, pan: 1.4 },
      prop: { blades: 3, diameter: 0.356, pitch: 0.432, hand: 'rh' },
      tilt: 70, steer: 30, tint: { cowl: 'paint' }, rigging: { reach: 0.38, drop: 0.05 },
    },
  },
  // ===== a 150 hp remote outboard, 25 in shaft =================================================
  'outboard-150-remote-25': {
    kind: 'boat-outboard', realm: 'water', label: '150 hp remote outboard, 25 in shaft', classOf: '150 hp four-stroke remote outboard class',
    aliases: ['150 hp outboard', 'big outboard'],
    dims: { length: 1.08, width: 0.66, height: 2.02 }, mass: 206, mount: 'transom-bolt',
    perf: { power: 110 },
    build: {
      family: 'remote', shaft: 0.635, transom: 0.06, rake: 14, leg: 1.6,
      cowl: { length: 0.9, width: 0.52, height: 0.68, lift: 0.22, pan: 1.5 },
      prop: { blades: 3, diameter: 0.37, pitch: 0.48, hand: 'rh' },
      tilt: 70, steer: 30, tint: { cowl: 'rubber' }, rigging: { reach: 0.5, drop: 0.12 },
    },
  },
  // ===== a centre console =====================================================================
  'console-cc-17': {
    kind: 'boat-console', realm: 'water', label: 'centre console with windscreen', classOf: '17 ft centre console class',
    aliases: ['center console', 'helm console', 'console'],
    dims: { width: 0.78, length: 0.66, height: 1.4 }, mass: 55, mount: 'sole',
    build: {
      family: 'moulded', height: 1.0,
      // (the dash from its front top to its back: [y, z])
      dash: [[0.2, 1.0], [-0.22, 0.86]],
      windscreen: { width: 0.62, wing: 0.12, wingAft: 0.12, height: 0.36, rake: 34 },
      rail: { height: 0.98, out: 0.05, radius: 0.0125 },
      helm: { at: 0.72, reach: 0.1, rake: 0.25, diameter: 0.36 },
      throttle: { at: -0.12, height: 0.78 },
    },
  },
  // ===== a T-top over a centre console ========================================================
  'top-t-cc-17': {
    kind: 'boat-top', realm: 'water', label: 'T-top with hardtop', classOf: '17 ft centre console class',
    aliases: ['t-top', 't top', 'hardtop', 'console top'],
    dims: { width: 1.36, length: 1.7, height: 2.5 }, mass: 48, mount: 'sole',
    build: {
      family: 'tTop', height: 2.0, thickness: 0.07, brace: 1.5, rods: 4,
      // (the hardtop from its front edge to its back edge, along the boat from the console's middle: over the helm)
      over: [0.5, -1.2],
      legs: { x: 0.52, xTop: 0.5, front: 0.28, aft: -0.34, lean: 0.12, radius: 0.024 },
    },
  },
  // ===== a split dash: the helm's and the passenger's, under a hull's windscreen ===============
  'dash-helm-19': {
    kind: 'boat-console', realm: 'water', label: 'helm dash, starboard', classOf: '19 ft cuddy cabin class',
    aliases: ['helm dash', 'helm station'],
    dims: { width: 0.66, length: 0.5, height: 0.8 }, mass: 40, mount: 'sole',
    build: {
      family: 'moulded', height: 0.66, dash: [[0.15, 0.8], [-0.2, 0.68]],
      helm: { at: 0.72, reach: 0.1, rake: 0.25, diameter: 0.36 },
      throttle: { at: -0.1, height: 0.6 },
    },
  },
  'dash-passenger-19': {
    kind: 'boat-console', realm: 'water', label: 'passenger dash, port', classOf: '19 ft cuddy cabin class',
    aliases: ['passenger dash', 'passenger console'],
    dims: { width: 0.66, length: 0.5, height: 0.8 }, mass: 34, mount: 'sole',
    build: { family: 'moulded', height: 0.66, dash: [[0.15, 0.8], [-0.2, 0.68]], screen: false, gauges: false, grab: true, glovebox: true },
  },
  // ===== a bucket seat on a pedestal ==========================================================
  'seat-bucket-pedestal': {
    kind: 'boat-seat', realm: 'water', label: 'bucket seat on a pedestal', classOf: 'helm seat class',
    aliases: ['bucket seat', 'helm seat', 'pedestal seat', 'captain seat'],
    dims: { width: 0.52, length: 0.5, height: 1.15 }, mass: 18, mount: 'sole',
    build: { family: 'bucket', seat: 0.6, back: { height: 0.5, rake: 14 } },
  },
  // ===== a coxswain's console =================================================================
  'console-rhib-mil': {
    kind: 'boat-console', realm: 'water', label: 'coxswain console', classOf: '7.5 m combat RHIB class',
    aliases: ['coxswain console', 'rhib console'],
    dims: { width: 0.86, length: 0.7, height: 1.3 }, mass: 70, mount: 'sole',
    build: {
      family: 'moulded', height: 1.0, dash: [[0.22, 1.02], [-0.24, 0.9]],
      windscreen: { width: 0.7, wing: 0.1, wingAft: 0.1, height: 0.26, rake: 30 },
      rail: { height: 1.0, out: 0.05, radius: 0.014 },
      helm: { at: 0.72, reach: 0.1, rake: 0.25, diameter: 0.38 },
      throttle: { at: -0.14, height: 0.82 },
    },
  },
  // ===== a jockey seat ========================================================================
  'seat-jockey': {
    kind: 'boat-seat', realm: 'water', label: 'jockey seat', classOf: 'RHIB crew seat class',
    aliases: ['jockey seat', 'straddle seat', 'shock seat'],
    dims: { width: 0.46, length: 0.62, height: 0.72 }, mass: 24, mount: 'sole',
    build: { family: 'jockey', saddle: 0.12 },
  },
  // ===== a pintle-mounted machine gun, on a deck and on a pedestal ==============================
  'mount-mg-deck': {
    kind: 'boat-mount', realm: 'water', label: 'machine gun on a deck pintle', classOf: 'generic medium machine gun class (modelled, never fired)',
    aliases: ['bow gun', 'deck machine gun', 'pintle gun'],
    dims: { width: 0.36, length: 1.16, height: 0.75 }, mass: 38, mount: 'deck',
    build: { family: 'pintle', post: 0.55, elevation: 30 },
  },
  'mount-mg-pedestal': {
    kind: 'boat-mount', realm: 'water', label: 'machine gun on a pedestal', classOf: 'generic medium machine gun class (modelled, never fired)',
    aliases: ['pedestal gun', 'stern gun', 'pedestal machine gun'],
    dims: { width: 0.36, length: 1.16, height: 1.2 }, mass: 44, mount: 'sole',
    build: { family: 'pintle', post: 1.0, elevation: 30 },
  },
  // ===== a radar arch =========================================================================
  'arch-radar-rhib': {
    kind: 'boat-arch', realm: 'water', label: 'radar arch', classOf: '7.5 m combat RHIB class',
    aliases: ['radar arch', 'a-frame arch', 'radar mast'],
    dims: { width: 1.62, length: 0.6, height: 2.3 }, mass: 62, mount: 'sole',
    build: { family: 'radar', height: 1.95, foot: 0.3, radius: 0.04 },
  },
  // ===== a waterjet drive =====================================================================
  'jet-waterjet-350': {
    kind: 'boat-jet', realm: 'water', label: 'waterjet drive, 350 mm', classOf: '350 mm waterjet class (its diesel inboard)',
    aliases: ['waterjet', 'water jet', 'jet drive', 'pump jet'],
    dims: { length: 0.8, width: 0.62, height: 0.62 }, mass: 1150, mount: 'transom',
    perf: { power: 330 },
    build: { family: 'jet', bowl: 0.24, length: 0.78, steer: 30 },
  },
  // ===== an armoured pilothouse ===============================================================
  'pilothouse-riverine': {
    kind: 'boat-cabin', realm: 'water', label: 'armoured pilothouse', classOf: '10 m riverine patrol boat class',
    aliases: ['pilothouse', 'wheelhouse', 'armoured cabin', 'armored pilothouse'],
    dims: { width: 2.2, length: 2.6, height: 2.2 }, mass: 1500, mount: 'sole',
    build: {
      family: 'pilothouse', height: 1.95, shoulder: 0.5, lean: 0.24, rake: 0.6, front: 0.7, mast: 1.1,
      ring: { at: 0.25, radius: 0.42, height: 0.12 },
    },
  },
  // ===== a machine gun in a tub, and one shielded on a roof's ring =============================
  'mount-mg-tub': {
    kind: 'boat-mount', realm: 'water', label: 'machine gun in an armoured tub', classOf: 'generic medium machine gun class (modelled, never fired)',
    aliases: ['gun tub', 'tub gun', 'armoured gun tub'],
    dims: { width: 1.14, length: 1.16, height: 1.2 }, mass: 260, mount: 'deck',
    build: { family: 'tub', post: 0.95, elevation: 30, tub: { radius: 0.56, height: 0.82, sides: 8 } },
  },
  'mount-mg-ring': {
    kind: 'boat-mount', realm: 'water', label: 'shielded machine gun on a ring', classOf: 'generic medium machine gun class (modelled, never fired)',
    aliases: ['ring gun', 'roof gun', 'shielded gun'],
    dims: { width: 0.6, length: 1.16, height: 0.85 }, mass: 90, mount: 'ring',
    build: { family: 'pintle', post: 0.4, elevation: 30, shield: { width: 0.6, height: 0.4 } },
  },
  // ===== a landing craft's bow ramp ===========================================================
  'ramp-landing-22': {
    kind: 'boat-ramp', realm: 'water', label: 'bow ramp', classOf: '22 m mechanised landing craft class',
    aliases: ['bow ramp', 'landing ramp', 'bow door'],
    dims: { width: 4.7, height: 2.25, length: 0.4 }, mass: 4500, mount: 'bow-foot',
    build: { family: 'ramp', thickness: 0.22, stiffeners: 4, treads: 9, drop: 104 },
  },
  // ===== an inboard drive's running gear ======================================================
  'shaft-diesel-450': {
    kind: 'boat-shaft', realm: 'water', label: 'shaft drive, 450 kW', classOf: 'twin-screw shaft drive class (its diesel inboard)',
    aliases: ['shaft drive', 'inboard drive', 'propeller shaft', 'screw'],
    dims: { length: 2.4, width: 0.95, height: 1.2 }, mass: 3200, mount: 'bottom',
    perf: { power: 450 },
    build: { family: 'shaft', rake: 9, length: 1.5, rudder: 0.85, steer: 35, prop: { blades: 4, diameter: 0.95, pitch: 1.0, hand: 'rh' } },
  },
  // ===== a landing craft's pilothouse =========================================================
  'pilothouse-landing': {
    kind: 'boat-cabin', realm: 'water', label: 'landing craft pilothouse', classOf: '22 m mechanised landing craft class',
    aliases: ['landing craft pilothouse', 'conning house'],
    dims: { width: 2.6, length: 2.8, height: 2.6 }, mass: 3200, mount: 'deck',
    build: {
      family: 'pilothouse', height: 2.3, shoulder: 0.45, lean: 0.26, rake: 0.6, front: 0.72, mast: 1.6,
      ring: { at: 0.28, radius: 0.45, height: 0.12 },
    },
  },
  // ===== a large waterjet drive ===============================================================
  'jet-waterjet-650': {
    kind: 'boat-jet', realm: 'water', label: 'waterjet drive, 650 mm', classOf: '650 mm waterjet class (its diesel inboard)',
    aliases: ['large waterjet', 'big jet drive'],
    dims: { length: 1.4, width: 1.1, height: 1.1 }, mass: 5200, mount: 'transom',
    perf: { power: 1600 },
    build: { family: 'jet', bowl: 0.42, length: 1.3, steer: 30 },
  },
  // ===== a patrol boat's bridge ===============================================================
  'bridge-patrol-25': {
    kind: 'boat-cabin', realm: 'water', label: 'deckhouse and bridge', classOf: '25 m coastal patrol boat class',
    aliases: ['bridge', 'deckhouse', 'superstructure'],
    dims: { width: 4.2, length: 8.0, height: 7.6 }, mass: 9000, mount: 'deck',
    build: {
      family: 'bridge', house: 2.3,
      bridge: { length: 4.0, width: 4.0, height: 2.1, rake: 1.0 },
      wing: { reach: 2.7 },
      mast: { height: 3.2, spread: 0.9, yard: 2.6, array: 2.4 },
    },
  },
  // ===== a naval autocannon ===================================================================
  'mount-cannon-30': {
    kind: 'boat-mount', realm: 'water', label: 'stabilised 30 mm naval gun', classOf: 'generic stabilised naval autocannon class (modelled, never fired)',
    aliases: ['naval gun', 'deck gun', 'naval autocannon', 'gun mount'],
    dims: { width: 1.5, length: 3.8, height: 1.4 }, mass: 1800, mount: 'deck',
    build: { family: 'cannon', pedestal: 0.5, barrel: 2.6, elevation: 45 },
  },
  // ===== a davit ==============================================================================
  'davit-sea-boat': {
    kind: 'boat-arch', realm: 'water', label: 'sea boat davit', classOf: 'boat davit class',
    aliases: ['davit', 'boat crane', 'deck crane'],
    dims: { width: 2.1, length: 0.6, height: 2.8 }, mass: 600, mount: 'deck',
    build: { family: 'davit', height: 2.4, reach: 1.95, drop: 1.0 },
  },
  // ===== a destroyer's running gear: the shaft drive grown to a ship's ======================
  'shaft-turbine-ship': {
    kind: 'boat-shaft', realm: 'water', label: 'ship\'s shaft and screw', classOf: 'twin-screw warship drive class (its gas turbines)',
    aliases: ['ship screw', 'ship propeller', 'warship screw'],
    dims: { length: 12.0, width: 4.75, height: 6.0 }, mass: 160000, mount: 'bottom',
    perf: { power: 37500 },
    build: { family: 'shaft', scale: 5.0, rake: 6, length: 1.5, rudder: 0.85, steer: 35, prop: { blades: 5, diameter: 0.95, pitch: 1.0, hand: 'rh' } },
  },
  // ===== a destroyer's upperworks ============================================================
  'superstructure-destroyer': {
    kind: 'boat-cabin', realm: 'water', label: 'destroyer superstructure', classOf: '150 m guided-missile destroyer class',
    aliases: ['ship superstructure', 'warship superstructure', 'upperworks'],
    dims: { width: 16.6, length: 38, height: 9.9 }, mass: 900000, mount: 'deck',
    build: {
      family: 'superstructure',
      // (tiers bow to stern from its middle, their sides leaning in; the top tier the bridge, raked to its windows)
      tiers: [
        { y: [-12, 26], width: 16.6, height: 3.6, lean: 0.9, front: { rake: 3.0, k: 0.8 } },
        { y: [-2, 24], width: 14.4, height: 3.2, lean: 0.8, front: { rake: 2.4, k: 0.75 } },
        { y: [10, 22.5], width: 12.8, height: 3.1, lean: 0.8, front: { rake: 2.2, k: 0.62 }, bridge: { panes: 7, side: 3 } },
      ],
      doors: [-8, 4, 14],
      mastAt: 14,
      points: { funnel: [0, -7, 0], ciws: [1, 4, 0] },
    },
  },
  'funnel-destroyer': {
    kind: 'boat-cabin', realm: 'water', label: 'destroyer funnel', classOf: '150 m guided-missile destroyer class',
    aliases: ['funnel', 'smokestack', 'stack'],
    dims: { width: 5.2, length: 7.0, height: 6.5 }, mass: 60000, mount: 'deck',
    build: { family: 'funnel', height: 6.0, taper: 0.8, rake: 1.2 },
  },
  'hangar-destroyer': {
    kind: 'boat-cabin', realm: 'water', label: 'helicopter hangar', classOf: '150 m guided-missile destroyer class',
    aliases: ['helicopter hangar', 'hangar'],
    dims: { width: 14.4, length: 15.0, height: 6.6 }, mass: 300000, mount: 'deck',
    build: { family: 'hangar', height: 6.6, lean: 0.8, door: { width: 9.6, height: 5.2 } },
  },
  'mast-pyramid-destroyer': {
    kind: 'boat-arch', realm: 'water', label: 'pyramid mast', classOf: '150 m guided-missile destroyer class',
    aliases: ['pyramid mast', 'enclosed mast', 'tower mast'],
    dims: { width: 7.0, length: 7.0, height: 20 }, mass: 120000, mount: 'deck',
    build: { family: 'pyramid', height: 11, widths: [7.0, 2.8], arrays: { at: 0.42, size: 3.4 }, topmast: { height: 8.5, yard: 4.4 } },
  },
  'davit-ship': {
    kind: 'boat-arch', realm: 'water', label: 'ship\'s boat davit', classOf: 'boat davit class',
    aliases: ['ship davit', 'boat davit'],
    dims: { width: 2.4, length: 0.8, height: 4.6 }, mass: 4000, mount: 'deck',
    build: { family: 'davit', height: 4.2, reach: 2.0, drop: 1.4 },
  },
  'turret-gun-127': {
    kind: 'boat-mount', realm: 'water', label: '127 mm naval gun', classOf: 'generic 127 mm naval gun class (modelled, never fired)',
    aliases: ['main gun', 'gun turret', 'naval turret'],
    dims: { width: 4.4, length: 11.5, height: 3.0 }, mass: 45000, mount: 'deck',
    build: { family: 'turret', shell: { length: 7.0, width: 4.4, height: 2.6 }, barrel: 7.6, elevation: 65 },
  },
  'mount-ciws': {
    kind: 'boat-mount', realm: 'water', label: 'close-in weapon', classOf: 'generic close-in weapon class (modelled, never fired)',
    aliases: ['close-in weapon', 'ciws', 'point defence gun'],
    dims: { width: 1.8, length: 3.0, height: 4.6 }, mass: 6200, mount: 'deck',
    build: { family: 'ciws', drum: 1.0, radome: { radius: 0.62, height: 1.9 }, barrel: 1.6, elevation: 80 },
  },
  'vls-cells-32': {
    kind: 'boat-mount', realm: 'water', label: 'vertical launch cells', classOf: 'generic vertical launch system class (modelled, never fired)',
    aliases: ['vertical launch system', 'vls', 'missile cells', 'launch cells'],
    dims: { width: 6.8, length: 3.6, height: 0.5 }, mass: 120000, mount: 'deck',
    build: { family: 'vls', cells: [4, 8], pitch: 0.8, height: 0.5 },
  },
  // ===== an aircraft carrier's flight deck =====================================================
  'deck-carrier-320': {
    kind: 'boat-deck', realm: 'water', label: 'carrier flight deck', classOf: '300 m fleet aircraft carrier class',
    aliases: ['flight deck', 'carrier deck', 'angled deck'],
    dims: { width: 92, length: 320, height: 9.2 }, mass: 14000000, mount: 'deck',
    perf: { load: 1200000 },
    build: {
      family: 'flight', thickness: 3.2, gallery: 6,
      // (its plan from the stern's starboard corner round by the bow: the island's sponson to starboard, the angled
      // deck's to port; a hull's middle at its origin)
      outline: [[22, -158], [26, -130], [27, -60], [34, -48], [34, -4], [27, 6], [27, 100], [20, 140], [12, 162],
        [-12, 162], [-16, 150], [-20, 100], [-36, 74], [-46, 54], [-46, 10], [-42, -60], [-34, -120], [-26, -158]],
      angled: { from: [-2, -156], angle: 8, length: 215, width: 24 },
      axial: [60, 158],
      catapults: [[[7, 72], [7, 152]], [[-7, 72], [-7, 152]], [[-27.43, -18.2], [-37.17, 51.1]], [[-15.55, -16.5], [-25.29, 52.8]]],
      deflector: { gap: 6, width: 12, depth: 4.5, angle: 55 },
      wires: [42, 54, 66, 78],
      lifts: [
        { x: 27, y: [20, 40], width: 15, side: 1, drop: 8 },
        { x: 27, y: [50, 70], width: 15, side: 1, drop: 8 },
        { x: 26.8, y: [-85, -65], width: 15, side: 1, drop: 8 },
        { x: -40.7, y: [-80, -60], width: 15, side: -1, drop: 8 },
      ],
      sponsons: [
        { at: [27.6, -140], width: 10, length: 10 }, { at: [-33.8, -135], width: 10, length: 10 },
        { at: [-21.8, 115], width: 10, length: 10 }, { at: [26.85, 118], width: 10, length: 10 }, { at: [29.4, -100], width: 10, length: 10 },
      ],
      island: [28, -26],
      // (where its aircraft park, wings folded: [x, y, heading], each spot its length and width)
      spots: [[18, 80, -45], [18, 96, -45], [18, 112, -45], [16, 128, -45], [17, -110, 45], [17, -126, 45]],
      spot: { length: 19, width: 12 },
    },
  },
  'island-carrier': {
    kind: 'boat-cabin', realm: 'water', label: 'carrier island', classOf: '300 m fleet aircraft carrier class',
    aliases: ['island', 'carrier island'],
    dims: { width: 12, length: 32, height: 18.6 }, mass: 2400000, mount: 'deck',
    build: {
      family: 'superstructure',
      // (narrow and tall on the deck's edge: the navigating bridge and over it the flight deck's control)
      tiers: [
        { y: [-16, 16], width: 12, height: 6.0, lean: 0.6, front: { rake: 1.5, k: 0.85 } },
        { y: [-13, 13], width: 11, height: 5.0, lean: 0.6, front: { rake: 1.5, k: 0.8 } },
        { y: [-10, 11], width: 10, height: 4.0, lean: 0.5, front: { rake: 1.6, k: 0.65 }, bridge: { panes: 5, side: 3 } },
        { y: [-8, 8], width: 9, height: 3.6, lean: 0.5, front: { rake: 1.4, k: 0.65 }, bridge: { panes: 4, side: 2 } },
      ],
      doors: [-10, 4],
      mastAt: 0,
    },
  },
  'mast-pyramid-carrier': {
    kind: 'boat-arch', realm: 'water', label: 'island mast', classOf: '300 m fleet aircraft carrier class',
    aliases: ['island mast'],
    dims: { width: 6.5, length: 6.5, height: 19.5 }, mass: 150000, mount: 'deck',
    build: { family: 'pyramid', height: 9, widths: [6.5, 2.6], arrays: { at: 0.45, size: 3.0 }, topmast: { height: 10, yard: 4.0 } },
  },
  'shaft-turbine-carrier': {
    kind: 'boat-shaft', realm: 'water', label: 'carrier\'s shaft and screw', classOf: 'four-screw carrier drive class (its turbines)',
    aliases: ['carrier screw', 'carrier propeller'],
    dims: { length: 15.6, width: 6.2, height: 7.8 }, mass: 300000, mount: 'bottom',
    perf: { power: 50000 },
    build: { family: 'shaft', scale: 6.5, rake: 4, length: 1.5, rudder: 0.85, steer: 35, prop: { blades: 5, diameter: 0.95, pitch: 1.0, hand: 'rh' } },
  },
  'vls-cells-8': {
    kind: 'boat-mount', realm: 'water', label: 'eight-cell launcher', classOf: 'generic point defence launcher class (modelled, never fired)',
    aliases: ['point defence launcher', 'eight-cell launcher', 'box launcher'],
    dims: { width: 2.0, length: 3.6, height: 1.8 }, mass: 14000, mount: 'deck',
    build: { family: 'vls', cells: [4, 2], pitch: 0.8, height: 1.8 },
  },
  // ===== a cooler seat ========================================================================
  'seat-cooler-120': {
    kind: 'boat-seat', realm: 'water', label: 'cooler seat, 120 litres', classOf: 'cooler seat class',
    aliases: ['cooler seat', 'cooler', 'ice chest seat'],
    dims: { width: 0.82, length: 0.44, height: 0.46 }, mass: 22, mount: 'sole',
    build: { family: 'cooler', cushion: 0.07 },
  },
  // ===== a portable fuel tank ==================================================================
  'tank-portable-45l': {
    kind: 'boat-tank', realm: 'water', label: 'portable fuel tank, 45 litres', classOf: '12 gallon portable tank class',
    aliases: ['fuel tank', 'portable tank', 'gas can', 'jerry tank'],
    dims: { length: 0.56, width: 0.34, height: 0.27 }, mass: 36, mount: 'floor',
    build: { family: 'moulded', color: '#b5352a' },
  },
  'tank-portable-25l': {
    kind: 'boat-tank', realm: 'water', label: 'portable fuel tank, 25 litres', classOf: '6 gallon portable tank class',
    aliases: ['small fuel tank', 'six gallon tank'],
    dims: { length: 0.46, width: 0.28, height: 0.24 }, mass: 21, mount: 'floor',
    build: { family: 'moulded', color: '#b5352a' },
  },
};

// the centre console's hull for a T-top: the same hull, its all-round light on the top instead of a pole aft
BOAT_ODM['hull-cc-17-ttop'] = {
  ...BOAT_ODM['hull-cc-17'], label: '17 ft centre console hull, for a T-top', aliases: ['t-top console hull'],
  build: { ...BOAT_ODM['hull-cc-17'].build, fittings: { ...BOAT_ODM['hull-cc-17'].build.fittings, navLights: { pole: false } } },
};
