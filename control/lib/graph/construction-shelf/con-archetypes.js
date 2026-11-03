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
  compactTrackLoader: withCarrier(SKID_STEER, 'tracks', {
    label: 'compact track loader', classOf: 'compact track loader 4.3 t', physics: 'compactTrackLoader',
    laws: Object.freeze({ ...SKID_STEER.laws, groundPressure: [25, 45], transport: { W: 2.0, H: 2.2 } }),
  }),
});
