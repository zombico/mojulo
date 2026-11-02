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
 * Hull families: 'vee' (a V-bottom: a chine between the bottom and the side; a bow that comes to a stem). Outboard
 * families: 'tiller' (steered by its own tiller). Sized to a public class, every name generic: a class, never a product.
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
  // ===== a portable fuel tank ==================================================================
  'tank-portable-45l': {
    kind: 'boat-tank', realm: 'water', label: 'portable fuel tank, 45 litres', classOf: '12 gallon portable tank class',
    aliases: ['fuel tank', 'portable tank', 'gas can', 'jerry tank'],
    dims: { length: 0.56, width: 0.34, height: 0.27 }, mass: 36, mount: 'floor',
    build: { family: 'moulded', color: '#b5352a' },
  },
};
