/**
 * con-odm — the construction shelf's inventory: one row per part, a part number (its sku) the layouts name.
 *
 * A row:
 *   kind     CON_KINDS: what it is, which builder draws it (con-parts.js)
 *   label    what it is called; aliases the words people say for it (findConPart)
 *   classOf  the machine size it is made for (an excavator's 20 t)
 *   dims     its numbers (metres; a ram's closed pin-to-pin length and its stroke, its bore and its rod)
 *   mass     kg; the laws place it where it is built
 *   build    { family, … } the builder's own words
 *
 * Generic parts of generic machines: no maker's part number, model or name. Pure data.
 */

export const CON_KINDS = Object.freeze({
  'con-undercarriage': 'the carrier on the ground: a crawler\'s frames, its rollers, its idlers and sprockets, its track',
  'con-slew': 'the slewing ring: the bearing and its gear the upper turns on',
  'con-house': 'the upper\'s frame and its covers: the deck, the engine and its hood, the tank, the boom\'s foot',
  'con-cab': 'the operator\'s cab: its frame, its glass, its door, its seat',
  'con-counterweight': 'the counterweight at the upper\'s tail',
  'con-boom': 'the boom: the first body of the front, on its foot pin',
  'con-stick': 'the stick (the dipper arm): the boom\'s child, the tool on its tip',
  'con-bucket': 'a digging bucket, its teeth, its ears and pins',
  'con-link': 'a linkage\'s link: a dogbone, an H-link',
  'con-ram': 'a hydraulic ram: its barrel and its rod, each a body aimed at the other\'s pin',
  'con-blade': 'a dozer\'s blade on its push arms: the moldboard, its end bits and cutting edge, about the trunnions',
  'con-ripper': 'a ripper at the tail: its beam on its pin, its shank and its tooth',
  'con-wheel': 'a site tyre on its rim: its casing, its lugs',
  'con-chassis': 'a wheeled machine\'s frame: a loader\'s rear and front halves, a skid steer\'s chassis',
  'con-arms': 'a loader\'s lift arms: the two arms, their cross tube, the pins of what they lift and tilt',
  'con-crank': 'a Z-bar\'s bellcrank: its pin on the arms\' cross tube, its upper pin (the tilt ram\'s), its lower (the tilt link\'s)',
});

const R = (kind, label, classOf, dims, mass, build, aliases = []) => Object.freeze({ kind, label, classOf, aliases, dims: Object.freeze(dims), mass, build: Object.freeze(build) });

export const CON_ODM = Object.freeze({
  // ── the 20 t crawler excavator ──────────────────────────────────────────────
  'crawler-ex20': R('con-undercarriage', 'crawler undercarriage, 20 t', 'excavator 20 t',
    { shoe: 0.6, pitch: 0.19, rail: 0.09, plate: 0.02, grouser: 0.025, frameW: 0.3, idler: { r: 0.33, z: 0.5 }, sprocket: { r: 0.36, z: 0.55 }, roller: { r: 0.1, n: 7 }, carrier: { r: 0.08, n: 2 }, body: { w: 1.7, l: 1.4, z0: 0.55, z1: 0.95 }, slewZ: 1.05 },
    7600, { family: 'crawler', teeth: 21 }, ['crawler', 'tracks', 'track frame', 'undercarriage']),
  'slew-ex20': R('con-slew', 'slewing ring, 20 t', 'excavator 20 t', { r: 0.62, h: 0.1 }, 450, { family: 'ring' }, ['slew ring', 'slewing bearing', 'turntable']),
  'house-ex20': R('con-house', 'excavator upper, 20 t', 'excavator 20 t',
    { w: 2.5, front: 1.25, back: -2.0, deck: 0.2, hood: 1.2, foot: [0, 0.25, 0.85], ramBase: [0.36, 0.75, 0.25] },
    4800, { family: 'excavator' }, ['upper', 'superstructure', 'upper structure', 'revolving frame']),
  'cab-ex': R('con-cab', 'excavator cab', 'excavator', { w: 1.0, l: 1.6, h: 1.65, at: [-0.72, 0.45, 0.2] }, 650, { family: 'excavator' }, ['cab', 'operator cab', 'cabin']),
  'cw-ex20': R('con-counterweight', 'counterweight, 20 t', 'excavator 20 t', { w: 2.5, h: 1.0, tail: 2.85, at: [0, -2.0, 0.2] }, 4300, { family: 'arc' }, ['counterweight', 'counter weight', 'ballast']),
  'boom-mono-57': R('con-boom', 'mono boom, 5.7 m', 'excavator 20 t',
    { chord: 5.7, knee: [2.9, 0.78], foot: { w: 0.5, h: 0.6 }, mid: { w: 0.55, h: 0.82 }, tip: { w: 0.42, h: 0.46 }, ramEye: [0.33, 2.7, 0.24], stickRam: [0, 3.35, 1.44] },
    1900, { family: 'mono' }, ['boom', 'mono boom', 'main boom']),
  'stick-29': R('con-stick', 'stick, 2.9 m', 'excavator 20 t',
    { length: 2.9, heel: [0, -0.8, 0.5], ramBase: [0, 0.32, 0.52], link: [0.22, 2.45, 0.14], root: { w: 0.42, h: 0.56 }, end: { w: 0.36, h: 0.34 } },
    950, { family: 'dipper' }, ['stick', 'dipper', 'dipper arm', 'arm']),
  'bucket-dig-ex20': R('con-bucket', 'digging bucket, 0.9 m³', 'excavator 20 t',
    { width: 1.1, capacity: 0.9, link: [0, -0.12, 0.42], teeth: 5, profile: [[-0.22, 0.32], [-0.16, -0.5], [1.22, -0.4], [1.15, 0.02], [0.88, 0.4], [0.42, 0.56], [0.02, 0.5]] },
    800, { family: 'dig' }, ['bucket', 'digging bucket', 'gp bucket']),
  'link-dogbone-ex20': R('con-link', 'dogbone link, 20 t', 'excavator 20 t', { length: 0.58, w: 0.04, h: 0.15 }, 55, { family: 'dogbone' }, ['dogbone', 'side link', 'bucket link']),
  'link-h-ex20': R('con-link', 'H-link, 20 t', 'excavator 20 t', { length: 0.62, w: 0.36, h: 0.16 }, 95, { family: 'hlink' }, ['h link', 'h-link', 'power link']),
  'ram-boom-ex20': R('con-ram', 'boom ram, 20 t', 'excavator 20 t', { bore: 0.12, rod: 0.085, closed: 1.95, stroke: 1.22 }, 240, { family: 'double' }, ['boom ram', 'boom cylinder', 'lift cylinder']),
  'ram-stick-ex20': R('con-ram', 'stick ram, 20 t', 'excavator 20 t', { bore: 0.135, rod: 0.095, closed: 2.1, stroke: 1.55 }, 300, { family: 'double' }, ['stick ram', 'arm cylinder', 'dipper cylinder', 'crowd ram']),
  'ram-bucket-ex20': R('con-ram', 'bucket ram, 20 t', 'excavator 20 t', { bore: 0.115, rod: 0.08, closed: 1.6, stroke: 1.1 }, 200, { family: 'double' }, ['bucket ram', 'bucket cylinder', 'curl ram']),
  // ── the 20 t crawler dozer ──────────────────────────────────────────────────
  'crawler-dz20': R('con-undercarriage', 'crawler undercarriage, dozer 20 t', 'dozer 20 t',
    { shoe: 0.56, pitch: 0.2, rail: 0.09, plate: 0.02, grouser: 0.06, frameW: 0.3, idler: { r: 0.33, z: 0.5 }, sprocket: { r: 0.4, z: 0.62 }, roller: { r: 0.11, n: 6 }, carrier: { r: 0.08, n: 1 }, body: { w: 1.2, l: 1.8, z0: 0.55, z1: 0.95 }, slewZ: 1.05, trunnion: [-0.15, 0.5] },
    8100, { family: 'crawler', teeth: 23, seat: false }, ['dozer tracks', 'dozer undercarriage']),
  'hull-dz20': R('con-house', 'dozer hull, 20 t', 'dozer 20 t',
    { deck: 1.05, nose: 1.95, tail: -1.85, hood: { from: 0.05, to: 1.95, w: 1.15, h: 1.0 }, cab: [0, -0.85, 1.05], liftRam: [0.62, 0.5, 2.25], ripper: [0, -2.0, 0.85], ripRam: [0, -1.55, 2.1] },
    6400, { family: 'dozer' }, ['dozer hull', 'mainframe', 'tractor']),
  'cab-dz': R('con-cab', 'dozer cab', 'dozer', { w: 1.5, l: 1.45, h: 1.85 }, 700, { family: 'excavator' }, ['dozer cab', 'rops cab']),
  'blade-su-dz20': R('con-blade', 'semi-U blade, 20 t', 'dozer 20 t',
    { width: 3.4, arm: 0.36, armZ: -0.12, back: 2.72, profile: [[3.25, -0.5], [3.08, -0.28], [2.98, 0.02], [2.97, 0.32], [3.03, 0.58], [3.16, 0.8]], ramEye: [0.62, 2.35, 0.75] },
    2900, { family: 'su' }, ['dozer blade', 'semi u blade', 'su blade', 'blade']),
  'ripper-dz20': R('con-ripper', 'single-shank ripper, 20 t', 'dozer 20 t',
    { beam: -0.75, beamZ: 0.05, beamW: 0.5, tip: [0, -0.95, -1.15], ramEye: [0, -0.55, 0.1] },
    1700, { family: 'radial' }, ['ripper', 'ripper shank', 'single shank ripper']),
  'ram-lift-dz20': R('con-ram', 'blade lift ram, 20 t', 'dozer 20 t', { bore: 0.11, rod: 0.075, closed: 1.32, stroke: 0.95 }, 150, { family: 'double' }, ['lift ram', 'blade lift cylinder']),
  'ram-rip-dz20': R('con-ram', 'ripper ram, 20 t', 'dozer 20 t', { bore: 0.16, rod: 0.1, closed: 1.1, stroke: 0.7 }, 200, { family: 'double' }, ['ripper ram', 'ripper cylinder']),
  // ── the 15 t wheel loader ───────────────────────────────────────────────────
  'frame-rear-wl15': R('con-chassis', 'wheel loader rear frame, 15 t', 'wheel loader 15 t',
    { tail: -3.15, cab: [0, -0.75, 1.15], hoodTop: 2.2, steerRam: [0.45, -0.75, 0.75] }, 7300, { family: 'loaderRear' }, ['rear frame', 'engine frame']),
  'frame-front-wl15': R('con-chassis', 'wheel loader front frame, 15 t', 'wheel loader 15 t',
    { armPivot: [0.62, 0.55, 2.15], liftRam: [0.55, 1.15, 0.5], steerEye: [0.375, 0.375, 0.75] }, 2600, { family: 'loaderFront' }, ['front frame', 'loader frame']),
  'cab-wl': R('con-cab', 'loader cab', 'wheel loader', { w: 1.3, l: 1.45, h: 1.95 }, 700, { family: 'excavator' }, ['loader cab']),
  'wheel-otr-235': R('con-wheel', 'site tyre 23.5R25', 'wheel loader 15 t', { r: 0.8, width: 0.6, rim: 0.42, lugs: 22 }, 450, { family: 'otr' }, ['loader tyre', 'otr tyre', 'site tyre']),
  'arms-zbar-wl15': R('con-arms', 'Z-bar lift arms, 15 t', 'wheel loader 15 t',
    { length: 3.2, knee: [1.7, 0.28], spread: 0.62, w: 0.12, h: 0.42, ramEye: [0.5, 0.8, 0], cross: [0, 1.75, 0.32], crank: [0, 1.788, 0.795], tiltRam: [0, 0.844, 0.348] },
    1600, { family: 'zbar' }, ['lift arms', 'loader arms', 'boom arms']),
  'crank-zbar-wl15': R('con-crank', 'bellcrank, 15 t', 'wheel loader 15 t', { upper: [0, -0.449, 0.691], lower: [0, 0.317, -0.628] }, 180, { family: 'zbar' }, ['bellcrank', 'bell crank', 'tilt lever']),
  'link-tilt-wl15': R('con-link', 'tilt link, 15 t', 'wheel loader 15 t', { length: 1.674, w: 0.12, h: 0.16 }, 90, { family: 'dogbone' }, ['tilt link', 'z bar link']),
  'bucket-gp-wl15': R('con-bucket', 'loader bucket, 2.5 m³', 'wheel loader 15 t',
    { width: 2.75, capacity: 2.5, ears: 0.62, link: [0, -0.005, 0.666], linkW: 0.12, profile: [[0.35, 1.2], [1.35, -0.17], [0.9, -0.27], [0.25, -0.25], [-0.12, -0.05], [-0.18, 0.45], [-0.1, 0.95], [0.1, 1.18]] },
    1250, { family: 'loader' }, ['loader bucket', 'general purpose bucket']),
  'ram-lift-wl15': R('con-ram', 'loader lift ram, 15 t', 'wheel loader 15 t', { bore: 0.14, rod: 0.09, closed: 1.25, stroke: 0.85 }, 210, { family: 'double' }, ['loader lift ram', 'lift arm cylinder']),
  'ram-tilt-wl15': R('con-ram', 'tilt ram, 15 t', 'wheel loader 15 t', { bore: 0.18, rod: 0.1, closed: 1.19, stroke: 0.68 }, 230, { family: 'double' }, ['tilt ram', 'tilt cylinder', 'dump cylinder']),
  'ram-steer-wl15': R('con-ram', 'steer ram, 15 t', 'wheel loader 15 t', { bore: 0.08, rod: 0.05, closed: 0.8, stroke: 0.55 }, 60, { family: 'double' }, ['steer ram', 'steering cylinder']),
  // ── the 3.3 t skid steer, and its compact track loader on rubber tracks ─────
  'chassis-ss33': R('con-chassis', 'skid steer chassis, 3.3 t', 'skid steer 3.3 t', { cab: [0, 0.05, 0.75], armPivot: [0.82, -1.0, 1.55], liftRam: [0.7, -0.9, 0.6] }, 2000, { family: 'skid' }, ['skid steer chassis', 'loader chassis']),
  'cab-ss': R('con-cab', 'skid steer cab', 'skid steer', { w: 0.95, l: 1.25, h: 1.28 }, 300, { family: 'excavator' }, ['skid steer cab', 'rops cage']),
  'wheel-skid-12': R('con-wheel', 'skid steer tyre 12-16.5', 'skid steer 3.3 t', { r: 0.41, width: 0.3, rim: 0.22, lugs: 16 }, 60, { family: 'otr' }, ['skid steer tyre']),
  'arms-radial-ss33': R('con-arms', 'radial lift arms, 3.3 t', 'skid steer 3.3 t',
    { length: 2.35, knee: [1.4, 0.5], spread: 0.82, w: 0.1, h: 0.3, ramEye: [0.72, 0.6, 0.1], cross: [0, 1.25, 0.25], tiltRams: [0.45, 1.25, 0.35] },
    350, { family: 'radial' }, ['radial lift arms', 'skid steer arms']),
  'bucket-gp-ss18': R('con-bucket', 'skid steer bucket, 1.8 m', 'skid steer 3.3 t',
    { width: 1.8, capacity: 0.45, ears: 0.8, link: [0, 0.05, 0.35], linkW: 0.45, profile: [[0.2, 0.62], [0.72, -0.12], [0.45, -0.17], [0.08, -0.16], [-0.07, -0.02], [-0.1, 0.3], [-0.06, 0.55], [0.06, 0.62]] },
    200, { family: 'skid' }, ['skid steer bucket']),
  'ram-lift-ss33': R('con-ram', 'skid steer lift ram', 'skid steer 3.3 t', { bore: 0.065, rod: 0.04, closed: 0.85, stroke: 0.6 }, 40, { family: 'double' }, ['skid steer lift ram']),
  'ram-tilt-ss33': R('con-ram', 'skid steer tilt ram', 'skid steer 3.3 t', { bore: 0.065, rod: 0.04, closed: 0.9, stroke: 0.6 }, 30, { family: 'double' }, ['skid steer tilt ram']),
  'crawler-ctl': R('con-undercarriage', 'rubber tracks, compact loader', 'compact track loader 4.3 t',
    { shoe: 0.4, pitch: 0.1, rail: 0, plate: 0.05, grouser: 0.025, frameW: 0.2, idler: { r: 0.2, z: 0.27 }, sprocket: { r: 0.24, z: 0.42 }, roller: { r: 0.08, n: 4 }, carrier: { r: 0.06, n: 0 }, body: { w: 0.6, l: 0.8, z0: 0.3, z1: 0.5 }, slewZ: 0.6 },
    1300, { family: 'rubber', teeth: 0, seat: false }, ['rubber tracks', 'compact tracks']),
});
