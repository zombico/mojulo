/**
 * construction-shelf/con-archetypes — the whole machines of the construction shelf: the vehicles that dig, push, load,
 * haul and lift on a site, each a layout of the shelf's parts in layers (a carrier, an upper, a front and the tool at
 * its end). A registry row names its machine here by its `construction` handle (vehicle-registry/roster.js).
 *
 * A machine:
 *   label, physics    what it is called; its class (roads/vehicles.js), whose numbers its carrier is built to
 *   palette           its colours (con-common.js CON_PALETTES)
 *   joints            { name: { kind, ram?, linkage? } } (con-chain.js): a ram-driven joint's range is its ram's
 *   layout            [{ id, sku, on?, joint?, ram?, link?, pair? }] (con-chain.js): the root first, each body after its
 *                     parent, then the struts
 *   poses             its named poses: each joint a SHARE of its range (0 its lower end, 1 its upper), or `ground` (the
 *                     joint solved so the named point touches the ground), or degrees for a slew
 *   tip               the point the envelope is measured to ('bucket.tip')
 *   laws              its bands (con-laws.js), from published figures for the class
 *
 * Pure data. A machine's layout is a compatibility promise over what is minted; a new machine goes at the end.
 */
import { CON_ODM } from './con-odm.js';

/**
 * The carriers the door may put under a machine for its own (the carrier swap): the parts of the kinds it drops
 * taken off, its parts put on at the machine's hardpoints, its class the swapped machine's. Only a swap a machine
 * lists (`carriers`) is offered.
 */
export const CON_CARRIERS = Object.freeze({
  tracks: Object.freeze({ label: 'on rubber tracks', drops: Object.freeze(['con-wheel']), adds: Object.freeze([Object.freeze({ id: 'tracks', sku: 'crawler-ctl', on: 'chassis.tracks' })]), makes: Object.freeze({ skidSteer: 'compactTrackLoader' }) }),
  // (the crawler taken from under an excavator's upper, a wheeled chassis on twin tyres in its place)
  wheels: Object.freeze({
    label: 'on wheels', drops: Object.freeze(['con-undercarriage']),
    adds: Object.freeze([{ id: 'under', sku: 'chassis-wex19' }, ...['F', 'R'].flatMap((e) => ['ro', 'ri', 'lo', 'li'].map((w) => ({ id: `wheel${e}${w.toUpperCase()}`, sku: 'wheel-wex', on: `under.wheel${e}.${w}` })))].map(Object.freeze)),
    makes: Object.freeze({ crawlerExcavator: 'wheeledExcavator' }),
  }),
});
/** A machine with another carrier under it: its layout less the dropped kinds, the carrier's parts where the first of
 *  them stood (its bodies before what sits on them). */
export function withCarrier(base, carrier, over = {}) {
  const C = CON_CARRIERS[carrier];
  if (!C) throw new Error(`Unknown construction carrier '${carrier}'; expected one of: ${Object.keys(CON_CARRIERS).join(', ')}`);
  const dropped = (e) => C.drops.includes(CON_ODM[e.sku]?.kind);
  const first = base.layout.findIndex(dropped);
  const layout = base.layout.filter((e) => !dropped(e));
  const at = base.layout.slice(0, first).filter((e) => !dropped(e)).length;
  const bom = { ...base.bom };
  for (const k of C.drops) delete bom[k];
  for (const e of C.adds) bom[CON_ODM[e.sku].kind] = (bom[CON_ODM[e.sku].kind] ?? 0) + 1;
  return Object.freeze({ ...base, ...over, layout: Object.freeze([...layout.slice(0, at), ...C.adds, ...layout.slice(at)]), bom: Object.freeze(bom), carrier });
}

/**
 * The mounts a machine's tool hangs on, and the tools each takes (the tool swap): a tool's part number is its stem and
 * the machine's size (`bucket-dig-ex20`, `breaker-mini`). A machine says its mount (`mount: { family, size }`).
 */
export const CON_MOUNTS = Object.freeze({
  excavator: Object.freeze({ label: 'an excavator\'s pins (its bucket\'s and its link\'s)', tools: Object.freeze({ bucket: 'bucket-dig', ditch: 'ditch', breaker: 'breaker', grapple: 'grapple', auger: 'auger' }) }),
  skid: Object.freeze({ label: 'a skid steer\'s plate', tools: Object.freeze({ bucket: 'bucket-gp', forks: 'forks', auger: 'auger-plate', sweeper: 'sweeper' }) }),
});
/** The part number of a tool on a machine's mount, or throws naming what the mount takes. */
export function toolSku(arch, tool) {
  const M = arch.mount && CON_MOUNTS[arch.mount.family];
  if (!M) throw new Error(`construction ${arch.label}: its tool is its own (it takes no other)`);
  const stem = M.tools[tool];
  if (!stem) throw new Error(`construction ${arch.label}: its mount is ${M.label}, which takes ${Object.keys(M.tools).join(', ')} (not '${tool}')`);
  return `${stem}-${arch.mount.size}`;
}

// (the skid steer, the compact track loader's base: written once, read twice)
const SKID_STEER = Object.freeze({
  label: 'skid steer loader',
  classOf: 'skid steer 3.3 t',
  physics: 'skidSteer',
  palette: 'siteYellow',
  joints: Object.freeze({
    lift: Object.freeze({ kind: 'hinge', ram: 'liftRam', near: 0 }),
    tool: Object.freeze({ kind: 'hinge', ram: 'tiltRam', near: 0 }),
  }),
  layout: Object.freeze([
    { id: 'chassis', sku: 'chassis-ss33' },
    { id: 'cab', sku: 'cab-ss', on: 'chassis.cab' },
    { id: 'wheelFR', sku: 'wheel-skid-12', on: 'chassis.wheelF.r' },
    { id: 'wheelFL', sku: 'wheel-skid-12', on: 'chassis.wheelF.l' },
    { id: 'wheelRR', sku: 'wheel-skid-12', on: 'chassis.wheelR.r' },
    { id: 'wheelRL', sku: 'wheel-skid-12', on: 'chassis.wheelR.l' },
    { id: 'arms', sku: 'arms-radial-ss33', on: 'chassis.armPivot', joint: 'lift' },
    { id: 'bucket', sku: 'bucket-gp-ss18', on: 'arms.tip', joint: 'tool' },
    { id: 'liftRam', sku: 'ram-lift-ss33', ram: ['chassis.liftRam', 'arms.ramEye'], pair: true },
    { id: 'tiltRam', sku: 'ram-tilt-ss33', ram: ['arms.tiltRam', 'bucket.link'], pair: true },
  ].map(Object.freeze)),
  tip: 'bucket.edge',
  carriers: Object.freeze(['tracks']),
  mount: Object.freeze({ family: 'skid', size: 'ss18' }),
  poses: Object.freeze({
    rest: Object.freeze({ tool: 0.55, lift: 'ground' }),
    carry: Object.freeze({ lift: 0.12, tool: 0.95 }),
    travel: Object.freeze({ lift: 0.12, tool: 0.95 }),
    transport: Object.freeze({ tool: 0.55, lift: 'ground' }),
    dump: Object.freeze({ lift: 1, tool: 0 }),
  }),
  laws: Object.freeze({
    arcs: { lift: [60, 85], tool: [100, 140] },
    measure: {
      hingePin: { point: 'arms.tip', over: ['lift'], take: 'max', band: [2.9, 3.3], says: 'its attachment\'s hinge pin at the top of its lift' },
      dumpClearance: { point: 'bucket.edge', at: { lift: 1, tool: 0 }, take: 'max', band: [2.0, 2.6], says: 'its cutting edge\'s height at full lift, the bucket dumped' },
    },
    mass: 0.1, transport: { W: 1.95, H: 2.2 },
  }),
  bom: Object.freeze({ 'con-chassis': 1, 'con-cab': 1, 'con-wheel': 4, 'con-arms': 1, 'con-bucket': 1, 'con-ram': 4 }),
});

const ARCHETYPES = Object.freeze({
  // a 20 t crawler excavator: the crawler, the upper on its ring, the mono boom, the stick, the bucket on its linkage
  crawlerExcavator: Object.freeze({
    label: 'crawler excavator',
    classOf: 'excavator 20 t',
    physics: 'crawlerExcavator',
    palette: 'siteYellow',
    joints: Object.freeze({
      slew: Object.freeze({ kind: 'slew' }),
      boom: Object.freeze({ kind: 'hinge', ram: 'boomRam', near: 10 }),
      stick: Object.freeze({ kind: 'hinge', ram: 'stickRam', near: -100 }),
      tool: Object.freeze({ kind: 'hinge', ram: 'toolRam', near: -50, linkage: Object.freeze({ ground: 'stick.link', coupler: 'bucket.link', a: 'dogbone', b: 'hlink', side: 1 }) }),
    }),
    layout: Object.freeze([
      { id: 'under', sku: 'crawler-ex20' },
      { id: 'ring', sku: 'slew-ex20', on: 'under.slew' },
      { id: 'house', sku: 'house-ex20', on: 'ring.top', joint: 'slew' },
      { id: 'cab', sku: 'cab-ex', on: 'house.cab' },
      { id: 'cw', sku: 'cw-ex20', on: 'house.counterweight' },
      { id: 'boom', sku: 'boom-mono-57', on: 'house.boomFoot', joint: 'boom' },
      { id: 'stick', sku: 'stick-29', on: 'boom.tip', joint: 'stick' },
      { id: 'bucket', sku: 'bucket-dig-ex20', on: 'stick.tip', joint: 'tool' },
      { id: 'dogbone', sku: 'link-dogbone-ex20', link: ['stick.link', '@tool'], pair: true },
      { id: 'hlink', sku: 'link-h-ex20', link: ['@tool', 'bucket.link'] },
      { id: 'boomRam', sku: 'ram-boom-ex20', ram: ['house.boomRam', 'boom.ramEye'], pair: true },
      { id: 'stickRam', sku: 'ram-stick-ex20', ram: ['boom.stickRam', 'stick.ramEye'] },
      { id: 'toolRam', sku: 'ram-bucket-ex20', ram: ['stick.toolRam', '@tool'] },
    ].map(Object.freeze)),
    tip: 'bucket.tip',
    mount: Object.freeze({ family: 'excavator', size: 'ex20' }),
    carriers: Object.freeze(['wheels']),
    poses: Object.freeze({
      // parked: the stick plumb, the bucket curled back and set down on the ground before the tracks
      rest: Object.freeze({ slew: 0, stick: 0.55, tool: 0.1, boom: 'ground' }),
      // travelling: the stick folded in, the bucket curled up under the boom, clear of the ground
      travel: Object.freeze({ slew: 0, boom: 0.6, stick: 0.04, tool: 0.03 }),
      // shipped on a trailer: the stick folded in, the bucket curled, the boom lowered until the bucket rests
      transport: Object.freeze({ slew: 0, stick: 0, tool: 0.03, boom: 'ground' }),
      // digging: the teeth at grade, well out
      dig: Object.freeze({ slew: 0, stick: 0.7, tool: 0.55, boom: 'ground' }),
      // dumping over a truck's side: the boom up, the stick half out, the bucket open
      dump: Object.freeze({ slew: 0, boom: 0.85, stick: 0.45, tool: 1 }),
      // at full reach along the ground
      reach: Object.freeze({ slew: 0, stick: 1, tool: 0.72, boom: 'ground' }),
      // swung to its side
      slewed: Object.freeze({ slew: 90, boom: 0.5, stick: 0.5, tool: 0.4 }),
    }),
    laws: Object.freeze({
      reach: [9.3, 10.6], depth: [6.1, 7.2], dumpHeight: [6.0, 7.5], cutHeight: [8.8, 10.4],
      arcs: { boom: [85, 125], stick: [95, 145], tool: [140, 200] },
      tail: [2.6, 3.0], groundPressure: [35, 60], lift: [2.5, 6], mass: 0.1, transport: { W: 3.0, H: 3.2 },
    }),
    bom: Object.freeze({ 'con-undercarriage': 1, 'con-slew': 1, 'con-house': 1, 'con-cab': 1, 'con-counterweight': 1, 'con-boom': 1, 'con-stick': 1, 'con-bucket': 1, 'con-link': 3, 'con-ram': 4 }),
  }),
  // a 20 t crawler dozer: its hull fixed on its tracks, the semi-U blade on its push arms about the trunnions, raised by
  // its two lift rams from the towers by the hood, the ripper at its tail
  bulldozer: Object.freeze({
    label: 'bulldozer',
    classOf: 'dozer 20 t',
    physics: 'crawlerDozer',
    palette: 'siteYellow',
    joints: Object.freeze({
      blade: Object.freeze({ kind: 'hinge', ram: 'liftRam', near: 0 }),
      ripper: Object.freeze({ kind: 'hinge', ram: 'ripRam', near: 0 }),
    }),
    layout: Object.freeze([
      { id: 'under', sku: 'crawler-dz20' },
      { id: 'hull', sku: 'hull-dz20', on: 'under.ground' },
      { id: 'cab', sku: 'cab-dz', on: 'hull.cab' },
      { id: 'blade', sku: 'blade-su-dz20', on: 'under.trunnion', joint: 'blade' },
      { id: 'ripper', sku: 'ripper-dz20', on: 'hull.ripper', joint: 'ripper' },
      { id: 'liftRam', sku: 'ram-lift-dz20', ram: ['hull.liftRam', 'blade.ramEye'], pair: true },
      { id: 'ripRam', sku: 'ram-rip-dz20', ram: ['hull.ripRam', 'ripper.ramEye'] },
    ].map(Object.freeze)),
    tip: 'blade.edge',
    poses: Object.freeze({
      // parked: the blade set down on the ground, the ripper up
      rest: Object.freeze({ blade: 'ground', ripper: 0 }),
      // travelling: the blade carried a hand's height up, the ripper up
      travel: Object.freeze({ blade: 0.55, ripper: 0 }),
      transport: Object.freeze({ blade: 'ground', ripper: 0 }),
      // dozing: the blade cutting below the grade
      doze: Object.freeze({ blade: 0.15, ripper: 0 }),
      // ripping: the blade up, the shank in the ground
      rip: Object.freeze({ blade: 0.7, ripper: 1 }),
      // the blade at the top of its lift
      lift: Object.freeze({ blade: 1, ripper: 0 }),
    }),
    laws: Object.freeze({
      arcs: { blade: [20, 40], ripper: [45, 100] },
      measure: {
        bladeLift: { point: 'blade.edge', over: ['blade'], take: 'max', band: [1.0, 1.35], says: 'its blade\'s cutting edge at the top of its lift' },
        bladeDrop: { point: 'blade.edge', over: ['blade'], take: 'depth', band: [0.35, 0.65], says: 'its blade\'s cutting edge below the grade at the bottom of its stroke' },
        ripDepth: { point: 'ripper.tip', over: ['ripper'], take: 'depth', band: [0.45, 0.9], says: 'its ripper\'s tooth below the ground' },
        ripClear: { point: 'ripper.tip', over: ['ripper'], take: 'max', band: [0.35, 0.9], says: 'its ripper\'s tooth raised clear of the ground' },
      },
      groundPressure: [50, 80], mass: 0.1, transport: { W: 3.5, H: 3.3 },
    }),
    bom: Object.freeze({ 'con-undercarriage': 1, 'con-house': 1, 'con-cab': 1, 'con-blade': 1, 'con-ripper': 1, 'con-ram': 3 }),
  }),
  // a 15 t wheel loader: its front frame turned on the rear's hitch by its steer rams, the lift arms on the front's
  // towers, the bucket on the arms' tip tilted through its Z-bar (the bellcrank on the cross tube, the tilt link)
  wheelLoader: Object.freeze({
    label: 'wheel loader',
    classOf: 'wheel loader 15 t',
    physics: 'wheelLoader',
    palette: 'siteYellow',
    joints: Object.freeze({
      steer: Object.freeze({ kind: 'slew', ram: 'steerRam', near: 0 }),
      lift: Object.freeze({ kind: 'hinge', ram: 'liftRam', near: 0 }),
      tool: Object.freeze({ kind: 'hinge', ram: 'tiltRam', near: 0, linkage: Object.freeze({ kind: 'rocker', link: 'tiltLink', lower: 'crank.lower', coupler: 'bucket.link', side: -1 }) }),
    }),
    layout: Object.freeze([
      { id: 'rear', sku: 'frame-rear-wl15' },
      { id: 'cab', sku: 'cab-wl', on: 'rear.cab' },
      { id: 'wheelRR', sku: 'wheel-otr-235', on: 'rear.wheel.r' },
      { id: 'wheelRL', sku: 'wheel-otr-235', on: 'rear.wheel.l' },
      { id: 'front', sku: 'frame-front-wl15', on: 'rear.hitch', joint: 'steer' },
      { id: 'wheelFR', sku: 'wheel-otr-235', on: 'front.wheel.r' },
      { id: 'wheelFL', sku: 'wheel-otr-235', on: 'front.wheel.l' },
      { id: 'arms', sku: 'arms-zbar-wl15', on: 'front.armPivot', joint: 'lift' },
      { id: 'bucket', sku: 'bucket-gp-wl15', on: 'arms.tip', joint: 'tool' },
      { id: 'crank', sku: 'crank-zbar-wl15', on: 'arms.crank', rocker: 'tool' },
      { id: 'tiltLink', sku: 'link-tilt-wl15', link: ['crank.lower', 'bucket.link'] },
      { id: 'liftRam', sku: 'ram-lift-wl15', ram: ['front.liftRam', 'arms.ramEye'], pair: true },
      { id: 'tiltRam', sku: 'ram-tilt-wl15', ram: ['arms.tiltRam', 'crank.upper'] },
      { id: 'steerRam', sku: 'ram-steer-wl15', ram: ['rear.steerRam', 'front.steerEye'], pair: true },
    ].map(Object.freeze)),
    tip: 'bucket.edge',
    poses: Object.freeze({
      // parked: the bucket set flat on the ground, the frames straight
      rest: Object.freeze({ steer: 0.5, tool: 0.45, lift: 'ground' }),
      // carrying a load: the arms low, the bucket rolled back
      carry: Object.freeze({ steer: 0.5, lift: 0.18, tool: 0.95 }),
      travel: Object.freeze({ steer: 0.5, lift: 0.18, tool: 0.95 }),
      transport: Object.freeze({ steer: 0.5, tool: 0.45, lift: 'ground' }),
      // at the top of its lift, the bucket dumped
      dump: Object.freeze({ steer: 0.5, lift: 1, tool: 0 }),
      // turning: the frames bent at the hitch
      turned: Object.freeze({ steer: 0.95, lift: 0.18, tool: 0.95 }),
    }),
    laws: Object.freeze({
      arcs: { steer: [70, 90], lift: [55, 85], tool: [80, 140] },
      measure: {
        hingePin: { point: 'arms.tip', over: ['lift'], take: 'max', band: [3.7, 4.2], says: 'its bucket\'s hinge pin at the top of its lift' },
        dumpClearance: { point: 'bucket.edge', at: { lift: 1, tool: 0 }, take: 'max', band: [2.6, 3.2], says: 'its cutting edge\'s height at full lift, the bucket dumped' },
      },
      mass: 0.1, transport: { W: 3.0, H: 3.5 },
    }),
    bom: Object.freeze({ 'con-chassis': 2, 'con-cab': 1, 'con-wheel': 4, 'con-arms': 1, 'con-crank': 1, 'con-bucket': 1, 'con-link': 1, 'con-ram': 5 }),
  }),
  // a 3.3 t skid steer: its chassis on four wheels, its radial lift arms on the towers at its back, its bucket tilted
  // by two rams from the arms' cross member
  skidSteer: SKID_STEER,
  // a 4.3 t compact track loader: the skid steer on rubber tracks (the carrier swap), its own class
  // a 2.5 t counterbalance forklift: its mast tilted on the front axle by two rams, its inner stage and its carriage
  // each lifting half as far again (a duplex mast: the carriage rises twice its stage), its forks on the carriage
  forklift: Object.freeze({
    label: 'forklift',
    classOf: 'forklift 2.5 t',
    physics: 'forklift',
    palette: 'siteYellow',
    joints: Object.freeze({
      tilt: Object.freeze({ kind: 'hinge', ram: 'tiltRam', near: 0 }),
      lift: Object.freeze({ kind: 'slide', axis: Object.freeze([0, 0, 1]) }),
    }),
    layout: Object.freeze([
      { id: 'chassis', sku: 'chassis-fl25' },
      { id: 'wheelFR', sku: 'wheel-fl-front', on: 'chassis.wheelF.r' },
      { id: 'wheelFL', sku: 'wheel-fl-front', on: 'chassis.wheelF.l' },
      { id: 'wheelRR', sku: 'wheel-fl-rear', on: 'chassis.wheelR.r' },
      { id: 'wheelRL', sku: 'wheel-fl-rear', on: 'chassis.wheelR.l' },
      { id: 'mast', sku: 'mast-outer-33', on: 'chassis.mastFoot', joint: 'tilt' },
      { id: 'inner', sku: 'mast-inner-33', on: 'mast.stage', joint: 'lift', scale: 0.5 },
      { id: 'carriage', sku: 'carriage-fl25', on: 'inner.stage', joint: 'lift', scale: 0.5 },
      { id: 'tiltRam', sku: 'ram-tilt-fl25', ram: ['chassis.tiltRam', 'mast.tiltEye'], pair: true },
    ].map(Object.freeze)),
    tip: 'carriage.tip',
    poses: Object.freeze({
      rest: Object.freeze({ tilt: 0.375, lift: 0 }),
      carry: Object.freeze({ tilt: 1, lift: 0.05 }),
      travel: Object.freeze({ tilt: 1, lift: 0.05 }),
      transport: Object.freeze({ tilt: 0.375, lift: 0 }),
      raised: Object.freeze({ tilt: 0.375, lift: 1 }),
    }),
    laws: Object.freeze({
      arcs: { tilt: [12, 20], lift: [3.0, 3.6] },
      measure: {
        liftHeight: { point: 'carriage.tip', over: ['lift'], take: 'max', band: [3.1, 3.6], says: 'its forks\' height at the top of its lift' },
      },
      mass: 0.1, transport: { W: 1.2, H: 2.2 },
    }),
    bom: Object.freeze({ 'con-chassis': 1, 'con-wheel': 4, 'con-mast': 2, 'con-carriage': 1, 'con-ram': 2 }),
  }),
  // a telehandler, 4 t to 14 m: its boom hinged at the chassis's back and raised by its ram, its two inner sections
  // sliding out a half each of the extension, its fork carriage on the tip tilted by its ram (held level by the pose)
  telehandler: Object.freeze({
    label: 'telehandler',
    classOf: 'telehandler 4 t',
    physics: 'telehandler',
    palette: 'siteYellow',
    joints: Object.freeze({
      boom: Object.freeze({ kind: 'hinge', ram: 'liftRam', near: 20 }),
      extend: Object.freeze({ kind: 'slide' }),
      tool: Object.freeze({ kind: 'hinge', ram: 'tiltRam', near: 0 }),
    }),
    layout: Object.freeze([
      { id: 'chassis', sku: 'chassis-th' },
      { id: 'cab', sku: 'cab-th', on: 'chassis.cab' },
      { id: 'wheelFR', sku: 'wheel-th', on: 'chassis.wheelF.r' },
      { id: 'wheelFL', sku: 'wheel-th', on: 'chassis.wheelF.l' },
      { id: 'wheelRR', sku: 'wheel-th', on: 'chassis.wheelR.r' },
      { id: 'wheelRL', sku: 'wheel-th', on: 'chassis.wheelR.l' },
      { id: 'outer', sku: 'boom-th-outer', on: 'chassis.pivot', joint: 'boom' },
      { id: 'mid', sku: 'boom-th-mid', on: 'outer.seat', joint: 'extend', scale: 0.5 },
      { id: 'inner', sku: 'boom-th-inner', on: 'mid.seat', joint: 'extend', scale: 0.5 },
      { id: 'carriage', sku: 'carriage-th', on: 'inner.head', joint: 'tool' },
      { id: 'liftRam', sku: 'ram-lift-th', ram: ['chassis.liftRam', 'outer.ramEye'] },
      { id: 'tiltRam', sku: 'ram-tilt-th', ram: ['inner.tiltRam', 'carriage.tiltEye'] },
    ].map(Object.freeze)),
    tip: 'carriage.tip',
    poses: Object.freeze({
      rest: Object.freeze({ extend: 0, tool: 'level', boom: 'ground' }),
      travel: Object.freeze({ boom: 0.12, extend: 0, tool: 'level' }),
      transport: Object.freeze({ extend: 0, tool: 'level', boom: 'ground' }),
      reach: Object.freeze({ boom: 0.3, extend: 1, tool: 'level' }),
      high: Object.freeze({ boom: 1, extend: 1, tool: 'level' }),
    }),
    laws: Object.freeze({
      arcs: { boom: [65, 80], extend: [6.5, 7.5], tool: [100, 160] },
      measure: {
        liftHeight: { point: 'carriage.mount', over: ['boom', 'extend'], take: 'max', band: [13, 15], says: 'its carriage\'s pin at the top of its boom, all out' },
      },
      mass: 0.1, transport: { W: 2.5, H: 2.6 },
    }),
    bom: Object.freeze({ 'con-chassis': 1, 'con-cab': 1, 'con-wheel': 4, 'con-section': 3, 'con-carriage': 1, 'con-ram': 2 }),
  }),
  // a 2.7 t mini excavator: the 20 t front at 0.44 its size, on a swing post turned left and right on its kingpin by
  // its swing ram; its tail inside its tracks; a backfill blade on its tracks raised by its rams
  miniExcavator: Object.freeze({
    label: 'mini excavator',
    classOf: 'mini excavator 2.7 t',
    physics: 'miniExcavator',
    palette: 'siteYellow',
    joints: Object.freeze({
      slew: Object.freeze({ kind: 'slew' }),
      swing: Object.freeze({ kind: 'slew', ram: 'swingRam', near: 0 }),
      boom: Object.freeze({ kind: 'hinge', ram: 'boomRam', near: 10 }),
      stick: Object.freeze({ kind: 'hinge', ram: 'stickRam', near: -100 }),
      tool: Object.freeze({ kind: 'hinge', ram: 'toolRam', near: -50, linkage: Object.freeze({ ground: 'stick.link', coupler: 'bucket.link', a: 'dogbone', b: 'hlink', side: 1 }) }),
      blade: Object.freeze({ kind: 'hinge', ram: 'bladeRam', near: 0 }),
    }),
    layout: Object.freeze([
      { id: 'under', sku: 'crawler-mini27' },
      { id: 'ring', sku: 'slew-mini', on: 'under.slew' },
      { id: 'house', sku: 'house-mini27', on: 'ring.top', joint: 'slew' },
      { id: 'cab', sku: 'canopy-mini', on: 'house.cab' },
      { id: 'cw', sku: 'cw-mini27', on: 'house.counterweight' },
      { id: 'post', sku: 'post-mini27', on: 'house.post', joint: 'swing' },
      { id: 'boom', sku: 'boom-mono-25', on: 'post.boomFoot', joint: 'boom' },
      { id: 'stick', sku: 'stick-13', on: 'boom.tip', joint: 'stick' },
      { id: 'bucket', sku: 'bucket-dig-mini', on: 'stick.tip', joint: 'tool' },
      { id: 'blade', sku: 'blade-mini27', on: 'under.trunnion', joint: 'blade' },
      { id: 'dogbone', sku: 'link-dogbone-mini', link: ['stick.link', '@tool'], pair: true },
      { id: 'hlink', sku: 'link-h-mini', link: ['@tool', 'bucket.link'] },
      { id: 'boomRam', sku: 'ram-boom-mini', ram: ['post.boomRam', 'boom.ramEye.r'] },
      { id: 'stickRam', sku: 'ram-stick-mini', ram: ['boom.stickRam', 'stick.ramEye'] },
      { id: 'toolRam', sku: 'ram-bucket-mini', ram: ['stick.toolRam', '@tool'] },
      { id: 'swingRam', sku: 'ram-swing-mini', ram: ['house.swingRam', 'post.swingEye'] },
      { id: 'bladeRam', sku: 'ram-blade-mini', ram: ['under.bladeRam', 'blade.ramEye'], pair: true },
    ].map(Object.freeze)),
    tip: 'bucket.tip',
    mount: Object.freeze({ family: 'excavator', size: 'mini' }),
    poses: Object.freeze({
      rest: Object.freeze({ slew: 0, swing: 0.4, stick: 0.55, tool: 0.1, blade: 0.47, boom: 'ground' }),
      travel: Object.freeze({ slew: 0, swing: 0.4, boom: 0.6, stick: 0.04, tool: 0.03, blade: 0.9 }),
      transport: Object.freeze({ slew: 0, swing: 0.4, stick: 0, tool: 0.03, blade: 0.47, boom: 'ground' }),
      dig: Object.freeze({ slew: 0, swing: 0.4, stick: 0.7, tool: 0.55, blade: 0.6, boom: 'ground' }),
      dump: Object.freeze({ slew: 0, swing: 0.4, boom: 0.85, stick: 0.45, tool: 1, blade: 0.6 }),
      offset: Object.freeze({ slew: 0, swing: 1, boom: 0.5, stick: 0.5, tool: 0.4, blade: 0.6 }),
    }),
    laws: Object.freeze({
      arcs: { swing: [100, 140], boom: [85, 125], stick: [95, 145], tool: [140, 200], blade: [40, 65] },
      reach: [4.3, 5.2], depth: [2.4, 3.1], dumpHeight: [2.6, 3.5], cutHeight: [3.9, 4.9],
      tail: [0.6, 0.8], groundPressure: [20, 35], lift: { band: [0.4, 1.2], radius: 2.5, height: 1.0 }, mass: 0.1, transport: { W: 1.6, H: 2.5 },
      measure: {
        bladeLift: { point: 'blade.edge', over: ['blade'], take: 'max', band: [0.3, 0.5], says: 'its blade\'s edge at the top of its lift' },
        bladeDrop: { point: 'blade.edge', over: ['blade'], take: 'depth', band: [0.25, 0.45], says: 'its blade\'s edge below the grade' },
      },
    }),
    bom: Object.freeze({ 'con-undercarriage': 1, 'con-slew': 1, 'con-house': 1, 'con-cab': 1, 'con-counterweight': 1, 'con-post': 1, 'con-boom': 1, 'con-stick': 1, 'con-bucket': 1, 'con-blade': 1, 'con-link': 3, 'con-ram': 6 }),
  }),
  // an 8.5 t backhoe loader: its loader on the arms ahead; its backhoe aft on the swing frame turned on the kingpost by
  // two swing rams (the 20 t front at 0.6 its size); its stabiliser legs swung down at the rear corners
  backhoeLoader: Object.freeze({
    label: 'backhoe loader',
    classOf: 'backhoe loader 8.5 t',
    physics: 'backhoeLoader',
    palette: 'siteYellow',
    joints: Object.freeze({
      lift: Object.freeze({ kind: 'hinge', ram: 'liftRam', near: 0 }),
      tilt: Object.freeze({ kind: 'hinge', ram: 'tiltRam', near: 0 }),
      swing: Object.freeze({ kind: 'slew', ram: 'swingRam', zero: 180, near: 0 }),
      boom: Object.freeze({ kind: 'hinge', ram: 'boomRam', near: 10 }),
      stick: Object.freeze({ kind: 'hinge', ram: 'stickRam', near: -100 }),
      tool: Object.freeze({ kind: 'hinge', ram: 'toolRam', near: -50, linkage: Object.freeze({ ground: 'stick.link', coupler: 'bucket.link', a: 'dogbone', b: 'hlink', side: 1 }) }),
      stab: Object.freeze({ kind: 'hinge', axis: Object.freeze([0, 1, 0]), ram: 'stabRamR', near: 0 }),
    }),
    layout: Object.freeze([
      { id: 'chassis', sku: 'chassis-bh85' },
      { id: 'cab', sku: 'cab-bh', on: 'chassis.cab' },
      { id: 'wheelFR', sku: 'wheel-bh-front', on: 'chassis.wheelF.r' },
      { id: 'wheelFL', sku: 'wheel-bh-front', on: 'chassis.wheelF.l' },
      { id: 'wheelRR', sku: 'wheel-bh-rear', on: 'chassis.wheelR.r' },
      { id: 'wheelRL', sku: 'wheel-bh-rear', on: 'chassis.wheelR.l' },
      { id: 'arms', sku: 'arms-bh85', on: 'chassis.armPivot', joint: 'lift' },
      { id: 'scoop', sku: 'bucket-gp-bh', on: 'arms.tip', joint: 'tilt' },
      { id: 'stabR', sku: 'leg-bh-r', on: 'chassis.stab.r', joint: 'stab' },
      { id: 'stabL', sku: 'leg-bh-l', on: 'chassis.stab.l', joint: 'stab', scale: -1 },
      { id: 'frame', sku: 'frame-bh85', on: 'chassis.post', joint: 'swing' },
      { id: 'boom', sku: 'boom-bh', on: 'frame.boomFoot', joint: 'boom' },
      { id: 'stick', sku: 'stick-bh', on: 'boom.tip', joint: 'stick' },
      { id: 'bucket', sku: 'bucket-dig-bh', on: 'stick.tip', joint: 'tool' },
      { id: 'dogbone', sku: 'link-dogbone-bh', link: ['stick.link', '@tool'], pair: true },
      { id: 'hlink', sku: 'link-h-bh', link: ['@tool', 'bucket.link'] },
      { id: 'liftRam', sku: 'ram-lift-bh', ram: ['chassis.liftRam', 'arms.ramEye'], pair: true },
      { id: 'tiltRam', sku: 'ram-tilt-bh', ram: ['arms.tiltRam', 'scoop.link'], pair: true },
      { id: 'swingRam', sku: 'ram-swing-bh', ram: ['chassis.swingRam', 'frame.swingEye'], pair: true },
      { id: 'boomRam', sku: 'ram-boom-bh', ram: ['frame.boomRam', 'boom.ramEye.r'] },
      { id: 'stickRam', sku: 'ram-stick-bh', ram: ['boom.stickRam', 'stick.ramEye'] },
      { id: 'toolRam', sku: 'ram-bucket-bh', ram: ['stick.toolRam', '@tool'] },
      { id: 'stabRamR', sku: 'ram-stab-bh', ram: ['chassis.stabRam.r', 'stabR.ramEye'] },
      { id: 'stabRamL', sku: 'ram-stab-bh', ram: ['chassis.stabRam.l', 'stabL.ramEye'] },
    ].map(Object.freeze)),
    tip: 'bucket.tip',
    mount: Object.freeze({ family: 'excavator', size: 'bh' }),
    poses: Object.freeze({
      // parked: the loader's bucket set down, the backhoe folded and its bucket on the ground, the legs up
      rest: Object.freeze({ tilt: 0.55, lift: 'ground', swing: 0.5, stick: 0.05, tool: 0.03, boom: 'ground', stab: 0 }),
      // on the road: the backhoe folded high over its kingpost, the loader carried low, the legs up
      travel: Object.freeze({ tilt: 0.95, lift: 0.15, swing: 0.5, boom: 1, stick: 0, tool: 0.05, stab: 0 }),
      transport: Object.freeze({ tilt: 0.95, lift: 0.15, swing: 0.5, boom: 0.8, stick: 0, tool: 0.05, stab: 0 }),
      // digging over its back: the legs down, the loader's bucket on the ground, the teeth at grade
      dig: Object.freeze({ tilt: 0.55, lift: 'ground', swing: 0.5, stick: 0.7, tool: 0.55, boom: 'ground', stab: 'ground' }),
      // loading ahead: the backhoe folded, the loader at the top of its lift, its bucket dumped
      load: Object.freeze({ tilt: 0, lift: 1, swing: 0.5, boom: 1, stick: 0, tool: 0.05, stab: 0 }),
      // the backhoe swung to its side
      swung: Object.freeze({ tilt: 0.55, lift: 'ground', swing: 0.9, boom: 0.6, stick: 0.5, tool: 0.4, stab: 'ground' }),
    }),
    laws: Object.freeze({
      from: 'frame.pin',
      arcs: { lift: [55, 75], tilt: [110, 140], swing: [170, 190], boom: [85, 125], stick: [95, 145], tool: [140, 200], stab: [130, 160] },
      reach: [5.4, 6.3], depth: [4.0, 5.0], dumpHeight: [3.0, 4.3], cutHeight: [4.8, 6.5],
      measure: {
        hingePin: { point: 'arms.tip', over: ['lift'], take: 'max', band: [3.2, 3.6], says: 'its loader\'s hinge pin at the top of its lift' },
        dumpClearance: { point: 'scoop.edge', at: { lift: 1, tilt: 0 }, take: 'max', band: [2.4, 3.0], says: 'its loader\'s cutting edge at full lift, dumped' },
      },
      mass: 0.1, transport: { W: 2.4, H: 4.0 },
    }),
    bom: Object.freeze({ 'con-chassis': 1, 'con-cab': 1, 'con-wheel': 4, 'con-arms': 1, 'con-bucket': 2, 'con-leg': 2, 'con-post': 1, 'con-boom': 1, 'con-stick': 1, 'con-link': 3, 'con-ram': 11 }),
  }),
  compactTrackLoader: withCarrier(SKID_STEER, 'tracks', {
    label: 'compact track loader', classOf: 'compact track loader 4.3 t', physics: 'compactTrackLoader',
    laws: Object.freeze({ ...SKID_STEER.laws, groundPressure: [25, 45], transport: { W: 2.0, H: 2.2 } }),
  }),
});

// a 19 t wheeled excavator: the 20 t excavator's upper and front on a wheeled chassis (the carrier swap), its own class
const WHEELED = withCarrier(ARCHETYPES.crawlerExcavator, 'wheels', {
  label: 'wheeled excavator', classOf: 'wheeled excavator 19 t', physics: 'wheeledExcavator', carriers: Object.freeze([]),
  laws: Object.freeze({ ...ARCHETYPES.crawlerExcavator.laws, groundPressure: undefined, depth: [5.6, 7.0], dumpHeight: [6.2, 7.9], cutHeight: [9.0, 10.9], lift: [1.5, 5], transport: { W: 2.6, H: 3.6 } }),
});
// ── the haulers ────────────────────────────────────────────────────────────────
const twinWheels = (body, axle, sku) => ['ro', 'ri', 'lo', 'li'].map((w) => ({ id: `wheel${axle}${w.toUpperCase()}`, sku, on: `${body}.axle${axle}.${w}` }));
const singleWheels = (body, axle, sku, as = axle) => ['r', 'l'].map((w) => ({ id: `wheel${as}${w.toUpperCase()}`, sku, on: `${body}.axle${axle}.${w}` }));
const HAULERS = Object.freeze({
  // an 8x4 tipper: its chassis on two steered axles ahead and a twin-tyred tandem behind, its cab over the front axle,
  // its body tipped about its tail by a five-stage telescopic hoist behind the cab
  tipperTruck: Object.freeze({
    label: 'tipper truck',
    classOf: 'tipper 8x4',
    physics: 'tipperTruck',
    palette: 'municipalOrange',
    joints: Object.freeze({ tip: Object.freeze({ kind: 'hinge', ram: 'tipRam', near: 10 }) }),
    layout: Object.freeze([
      { id: 'chassis', sku: 'chassis-tp84' },
      { id: 'cab', sku: 'cab-truck', on: 'chassis.cab' },
      ...singleWheels('chassis', 0, 'wheel-truck'), ...singleWheels('chassis', 1, 'wheel-truck'),
      ...twinWheels('chassis', 2, 'wheel-truck'), ...twinWheels('chassis', 3, 'wheel-truck'),
      { id: 'body', sku: 'body-tp84', on: 'chassis.tip', joint: 'tip' },
      { id: 'tipRam', sku: 'ram-tip-tp84', ram: ['chassis.tipRam', 'body.ramEye'] },
    ].map(Object.freeze)),
    tip: 'body.tail',
    poses: Object.freeze({ rest: Object.freeze({ tip: 0 }), travel: Object.freeze({ tip: 0 }), transport: Object.freeze({ tip: 0 }), half: Object.freeze({ tip: 0.5 }), tipped: Object.freeze({ tip: 1 }) }),
    laws: Object.freeze({
      arcs: { tip: [45, 56] }, payload: { kg: 20000, density: 1.7, material: 'gravel', volume: [12, 20], band: [1.0, 1.5] },
      wheelbase: 0.06, mass: 0.12, massShift: -20000, transport: { W: 2.95, H: 3.4 },
    }),
    bom: Object.freeze({ 'con-chassis': 1, 'con-cab': 1, 'con-wheel': 12, 'con-body': 1, 'con-ram': 1 }),
  }),
  // an 8x4 concrete mixer: the same chassis, its drum on its pedestal and its rollers, turned about its own axis
  mixerTruck: Object.freeze({
    label: 'concrete mixer truck',
    classOf: 'mixer 8x4',
    physics: 'mixerTruck',
    palette: 'rentalWhite',
    joints: Object.freeze({ drum: Object.freeze({ kind: 'hinge', axis: Object.freeze([0, -0.97, 0.24]) }) }),
    layout: Object.freeze([
      { id: 'chassis', sku: 'chassis-mx84' },
      { id: 'cab', sku: 'cab-truck', on: 'chassis.cab' },
      ...singleWheels('chassis', 0, 'wheel-truck'), ...singleWheels('chassis', 1, 'wheel-truck'),
      ...twinWheels('chassis', 2, 'wheel-truck'), ...twinWheels('chassis', 3, 'wheel-truck'),
      { id: 'drum', sku: 'drum-mx8', on: 'chassis.drum', joint: 'drum' },
    ].map(Object.freeze)),
    tip: 'drum.mouth',
    poses: Object.freeze({ rest: Object.freeze({ drum: 0 }), travel: Object.freeze({ drum: 0 }), transport: Object.freeze({ drum: 0 }), turning: Object.freeze({ drum: 120 }) }),
    laws: Object.freeze({
      payload: { kg: 19000, density: 2.4, share: 0.58, material: 'concrete', volume: [12, 16], band: [0.95, 1.3] },
      wheelbase: 0.06, mass: 0.12, massShift: -19000, transport: { W: 2.95, H: 4.0 },
    }),
    bom: Object.freeze({ 'con-chassis': 1, 'con-cab': 1, 'con-wheel': 12, 'con-drum': 1 }),
  }),
  // a 30 t articulated dump truck: its front frame (the engine, the cab, its axle), its rear frame turned on the hitch
  // by two steer rams (its bogie's two axles), its rock body tipped by two hoist rams
  articulatedDumpTruck: Object.freeze({
    label: 'articulated dump truck',
    classOf: 'articulated dump truck 30 t',
    physics: 'articulatedDumpTruck',
    palette: 'siteYellow',
    joints: Object.freeze({
      steer: Object.freeze({ kind: 'slew', ram: 'steerRam', near: 0 }),
      tip: Object.freeze({ kind: 'hinge', ram: 'hoistRam', near: 10 }),
    }),
    layout: Object.freeze([
      { id: 'front', sku: 'adt-front30' },
      { id: 'cab', sku: 'cab-adt', on: 'front.cab' },
      ...singleWheels('front', 0, 'wheel-adt'),
      { id: 'rear', sku: 'adt-rear30', on: 'front.hitch', joint: 'steer' },
      ...singleWheels('rear', 0, 'wheel-adt', 1), ...singleWheels('rear', 1, 'wheel-adt', 2),
      { id: 'body', sku: 'body-adt30', on: 'rear.tip', joint: 'tip' },
      { id: 'steerRam', sku: 'ram-steer-adt30', ram: ['front.steerRam', 'rear.steerEye'], pair: true },
      { id: 'hoistRam', sku: 'ram-hoist-adt30', ram: ['rear.hoistRam', 'body.ramEye'], pair: true },
    ].map(Object.freeze)),
    tip: 'body.tail',
    poses: Object.freeze({ rest: Object.freeze({ steer: 0.5, tip: 0 }), travel: Object.freeze({ steer: 0.5, tip: 0 }), transport: Object.freeze({ steer: 0.5, tip: 0 }), tipped: Object.freeze({ steer: 0.5, tip: 1 }), turned: Object.freeze({ steer: 0.95, tip: 0 }) }),
    laws: Object.freeze({
      arcs: { steer: [80, 96], tip: [60, 76] }, payload: { kg: 30000, density: 1.8, material: 'rock', volume: [14, 22], band: [0.9, 1.4] },
      wheelbase: 0.08, mass: 0.12, massShift: -30000, transport: { W: 3.1, H: 3.7 },
    }),
    bom: Object.freeze({ 'con-chassis': 2, 'con-cab': 1, 'con-wheel': 6, 'con-body': 1, 'con-ram': 4 }),
  }),
  // a 100 t rigid haul truck: its frame on a single front axle and twin-tyred rear, the cab on its deck, its body (its
  // canopy over the cab) tipped by two telescopic hoists
  haulTruck: Object.freeze({
    label: 'haul truck',
    classOf: 'haul truck 100 t',
    physics: 'haulTruck',
    palette: 'siteYellow',
    joints: Object.freeze({ tip: Object.freeze({ kind: 'hinge', ram: 'hoistRam', near: 10 }) }),
    layout: Object.freeze([
      { id: 'frame', sku: 'frame-haul100' },
      { id: 'cab', sku: 'cab-haul', on: 'frame.cab' },
      ...singleWheels('frame', 0, 'wheel-haul'), ...twinWheels('frame', 1, 'wheel-haul'),
      { id: 'body', sku: 'body-haul100', on: 'frame.tip', joint: 'tip' },
      { id: 'hoistRam', sku: 'ram-hoist-haul100', ram: ['frame.hoistRam', 'body.ramEye'], pair: true },
    ].map(Object.freeze)),
    tip: 'body.tail',
    poses: Object.freeze({ rest: Object.freeze({ tip: 0 }), travel: Object.freeze({ tip: 0 }), transport: Object.freeze({ tip: 0 }), tipped: Object.freeze({ tip: 1 }) }),
    laws: Object.freeze({
      arcs: { tip: [42, 56] }, payload: { kg: 100000, density: 1.8, material: 'rock', volume: [55, 80], band: [1.0, 1.5] },
      wheelbase: 0.08, mass: 0.12, massShift: -100000, transport: { W: 6.2, H: 5.3 },
    }),
    bom: Object.freeze({ 'con-chassis': 1, 'con-cab': 1, 'con-wheel': 6, 'con-body': 1, 'con-ram': 2 }),
  }),
});

export const CON_ARCHETYPES = Object.freeze({ ...ARCHETYPES, wheeledExcavator: WHEELED, ...HAULERS });
