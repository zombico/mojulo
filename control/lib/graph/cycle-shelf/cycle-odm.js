/**
 * cycle-odm — the cycle shelf's inventory: the kinds of part a machine ridden astride is made of, and one row per part
 * number. The craft shelf's grammar (craft-shelf/craft-odm.js): a kind is a builder (cycle-parts.js), a row is a part
 * someone could order, a machine is a layout of rows (cycle-archetypes.js). A new part is a row first.
 *
 * A row:
 *   kind      one of CYCLE_KINDS (its builder)
 *   label     what it is called
 *   classOf   the machine it is made for
 *   aliases   the words people say for it (one word, one part: index.js throws on a collision)
 *   dims      metres: what it measures (a wheel's `radius` is its tyre's, where it meets the ground)
 *   mass      kg
 *   build     its builder's dials: `family` (the procedure), then the family's own
 *
 * Where a part sits is the machine's, not the part's: the chassis card (cycle-archetypes.js) places it and the solve
 * (cycle-chassis.js) says where the axles, the steering axis and the pivot are. Pure data.
 */

export const CYCLE_KINDS = Object.freeze({
  'cycle-frame': 'the frame: its head tube, its spars or cradle, the subframe and the swingarm\'s pivot',
  'cycle-fork': 'the front fork: its legs, its triple clamps and the axle, steered about the head',
  'cycle-swingarm': 'the swingarm: the rear axle\'s arms, hinged at the pivot',
  'cycle-shock': 'the rear shock: its body, its spring and its reservoir',
  'cycle-wheel': 'a wheel: its tyre, its rim, its spokes and its hub',
  'cycle-brake': 'a brake: its disc and its caliper',
  'cycle-engine': 'the engine: its cases, its cylinder and its head',
  'cycle-radiator': 'a radiator and its hose',
  'cycle-drive': 'the final drive: the sprockets and the chain',
  'cycle-exhaust': 'the exhaust: its header and its silencer',
  'cycle-tank': 'the fuel tank and its cap',
  'cycle-seat': 'the seat',
  'cycle-bars': 'the handlebar: its bar, its grips, its levers and its clamps',
  'cycle-body': 'a body panel: a fender, a number board, a shroud',
  'cycle-peg': 'a footpeg and its mount',
  'cycle-stand': 'a stand the machine is parked on',
});

const row = (kind, label, classOf, aliases, dims, mass, build) => ({ kind, label, classOf, aliases, dims, mass, build });
const MX = '450 cc motocross';

export const CYCLE_ODM = {
  // ── the motocross machine ─────────────────────────────────────────────────
  'frame-mx-spar': row('cycle-frame', 'aluminium twin-spar frame', MX, ['motocross frame', 'twin spar frame'], { length: 1.0, width: 0.25, height: 0.75 }, 10,
    { family: 'twinSpar', spar: 0.022, rail: 0.014, sub: 0.011 }),
  'fork-usd-48': row('cycle-fork', '48 mm upside-down fork', MX, ['usd fork', 'upside down fork', 'motocross fork'], { length: 0.94, width: 0.27, travel: 0.31 }, 9.5,
    { family: 'usd', outer: 0.028, inner: 0.024, guard: true }),
  'swingarm-mx': row('cycle-swingarm', 'cast aluminium swingarm', MX, ['motocross swingarm'], { length: 0.58, width: 0.26 }, 4.2,
    { family: 'boxArm', depth: 0.05, tip: 0.034, wall: 0.026 }),
  'shock-mx': row('cycle-shock', 'linkage rear shock', MX, ['motocross shock', 'rear shock'], { length: 0.48, travel: 0.31 }, 4,
    { family: 'coilOver', body: 0.022, coil: 0.034, wire: 0.0055, turns: 9 }),
  'wheel-mx-21': row('cycle-wheel', '21-inch spoked front wheel, knobby tyre', MX, ['21 inch front wheel', 'front knobby'], { radius: 0.36, section: 0.08, rim: 0.2667 }, 7.8,
    { family: 'spoked', spokes: 36, tread: 'knobby', hub: 0.05 }),
  'wheel-mx-19': row('cycle-wheel', '19-inch spoked rear wheel, knobby tyre', MX, ['19 inch rear wheel', 'rear knobby'], { radius: 0.35, section: 0.1, rim: 0.2413 }, 9.6,
    { family: 'spoked', spokes: 36, tread: 'knobby', hub: 0.058 }),
  'brake-disc-270': row('cycle-brake', '270 mm front disc and twin-piston caliper', MX, ['front disc brake'], { radius: 0.135 }, 1.6,
    { family: 'disc', thick: 0.004, caliper: [0.04, 0.07, 0.03] }),
  'brake-disc-240': row('cycle-brake', '240 mm rear disc and single-piston caliper', MX, ['rear disc brake'], { radius: 0.12 }, 1.1,
    { family: 'disc', thick: 0.004, caliper: [0.035, 0.06, 0.028] }),
  'engine-single-450': row('cycle-engine', '450 cc liquid-cooled single', MX, ['450 single', 'motocross engine', 'four-stroke single'], { length: 0.36, width: 0.3, height: 0.5 }, 27,
    { family: 'single', bore: 0.096, tilt: 12 }),
  'radiator-mx': row('cycle-radiator', 'side radiator', MX, ['motocross radiator'], { length: 0.2, height: 0.26, thick: 0.035 }, 1.1,
    { family: 'side' }),
  'drive-chain-520': row('cycle-drive', '520 chain, 13 and 50 teeth', MX, ['520 chain', 'motocross chain'], { pitch: 0.015875 }, 1.9,
    { family: 'chain', front: 0.045, rear: 0.105 }),
  'exhaust-mx-single': row('cycle-exhaust', 'single header and silencer', MX, ['motocross exhaust', 'mx silencer'], { length: 1.2 }, 3.3,
    { family: 'header', pipe: 0.022, can: 0.05 }),
  'tank-mx': row('cycle-tank', '6 litre under-seat tank', MX, ['motocross tank'], { length: 0.3, width: 0.24, height: 0.14 }, 1.2,
    { family: 'underSeat', litres: 6.3 }),
  'seat-mx': row('cycle-seat', 'long flat seat', MX, ['motocross seat', 'flat seat'], { length: 1.1, width: 0.25 }, 1.4,
    { family: 'flat', thick: 0.085 }),
  'bars-mx': row('cycle-bars', 'tapered handlebar, 830 mm', MX, ['motocross bars', 'tapered bars'], { width: 0.83, rise: 0.09 }, 1.6,
    { family: 'mxBar', tube: 0.0115, grip: 0.016 }),
  'fender-mx-front': row('cycle-body', 'front fender', MX, ['motocross front fender'], { length: 0.8, width: 0.16 }, 0.5,
    { family: 'fender', place: 'fenderFront', thick: 0.006, skirt: 0.035 }),
  'fender-mx-rear': row('cycle-body', 'rear fender', MX, ['motocross rear fender'], { length: 0.6, width: 0.2 }, 0.6,
    { family: 'fender', place: 'fenderRear', thick: 0.006, skirt: 0.05 }),
  'plate-mx-front': row('cycle-body', 'front number plate', MX, ['front number plate', 'front number board'], { width: 0.26, height: 0.22 }, 0.3,
    { family: 'plate', place: 'plateFront', thick: 0.005, field: [0.18, 0.12] }),
  'plate-mx-side': row('cycle-body', 'side number plate', MX, ['side number plate'], { length: 0.36, height: 0.22 }, 0.3,
    { family: 'sidePanel', place: 'plateSide', thick: 0.005, tint: 'light' }),
  'shroud-mx': row('cycle-body', 'radiator shroud', MX, ['radiator shroud', 'shroud'], { length: 0.34, height: 0.32 }, 0.3,
    { family: 'sidePanel', place: 'shroud', thick: 0.005, tint: 'paint' }),
  'peg-mx': row('cycle-peg', 'cleated footpeg', MX, ['motocross footpeg', 'cleated peg'], { length: 0.12, width: 0.055 }, 0.35,
    { family: 'cleat' }),
  'stand-side-mx': row('cycle-stand', 'side stand', MX, ['kickstand', 'side stand', 'jiffy stand'], { length: 0.39 }, 0.5,
    { family: 'side', tube: 0.012 }),
};
