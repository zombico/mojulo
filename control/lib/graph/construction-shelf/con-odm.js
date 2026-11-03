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
});
