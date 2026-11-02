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
 *
 * Hull families: 'vee' (a chine between the bottom and the side: a V-bottom by its deadrise, a flat bottom when the
 * chine is at the keel's height). Its bow: 'stem' (it comes to a stem) or 'square' (a jon boat's: the bottom's rocker
 * meets a small transom at the bow, its rail across it). A hull may also carry a `sole` (a floor laid flat across the
 * bottom at its height, the liner clipped to it), a `collar` (a RIB's tube round the sheer: its radius, how far it sits
 * out and up of the sheer, its rise at the bow, its cones aft of the transom, a lifeline along its top; no gunwale rails
 * then) and `tint` (the liner's colour role: 'chrome' bare metal, 'paint' a moulded hull). Outboard families: 'tiller'
 * (steered by its own tiller), its leg drawn at `leg` of the 20 hp class's size. Sized to a public class, every name generic: a class, never a product.
 */

export const BOAT_KINDS = Object.freeze({
  'boat-hull': 'a boat\'s hull: drawn from its lines, its skin and liner, its transom, deck, benches and fittings',
  'boat-outboard': 'an outboard motor on a boat\'s transom: its cowl, its leg, its propeller and its tiller',
  'boat-tank': 'a boat\'s portable fuel tank',
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
