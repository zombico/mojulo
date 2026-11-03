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
  tracks: Object.freeze({ label: 'on rubber tracks', drops: Object.freeze(['con-wheel']), adds: Object.freeze([Object.freeze({ id: 'tracks', sku: 'crawler-ctl', on: 'chassis.tracks' })]) }),
});
/** A machine with another carrier under it: its layout less the dropped kinds, plus the carrier's parts. */
export function withCarrier(base, carrier, over = {}) {
  const C = CON_CARRIERS[carrier];
  if (!C) throw new Error(`Unknown construction carrier '${carrier}'; expected one of: ${Object.keys(CON_CARRIERS).join(', ')}`);
  const layout = base.layout.filter((e) => !C.drops.includes(CON_ODM[e.sku]?.kind));
  const at = layout.findIndex((e) => e.ram || e.link || e.joint);
  const bom = { ...base.bom };
  for (const k of C.drops) delete bom[k];
  for (const e of C.adds) bom[CON_ODM[e.sku].kind] = (bom[CON_ODM[e.sku].kind] ?? 0) + 1;
  return Object.freeze({ ...base, ...over, layout: Object.freeze([...layout.slice(0, at), ...C.adds, ...layout.slice(at)]), bom: Object.freeze(bom), carrier });
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

export const CON_ARCHETYPES = Object.freeze({
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
