/**
 * mecha-tools — the manipulators' ODM: what a frame's arms can carry and do, as cards over the inventory's rows, so a
 * work frame is fitted for its task rather than built for it. Pure data.
 *
 *   MECHA_TOOLS      a tool on the wrist's quick coupler (its geometry an inventory row, `sku`):
 *     task           what it does on a site
 *     holds          the load it holds as rated (kg; 0: it works, it does not hold: a breaker, an auger)
 *     circuit        what drives it: 'none', 'clamp' (a jaw's or a grapple's ram), 'hammer' (a breaker's), 'motor'
 *                    (an auger's), 'electric' (a magnet's, a vacuum pump's: the battery's, not the pump's)
 *     flow           the hydraulic flow it draws working (l/min), from the power pack's pump
 *   MECHA_ARM_KITS   an arm's build: the forearm it carries ('standard', 'long' for reach, traded for lift)
 *   MECHA_TASKS      a site's tasks: the loadout each asks, per arm ({ tool, arm? }); a loadout of the operator's own is
 *                    `tools` and `arms` (mecha-shelf/index.js composeFrame)
 *   MECHA_PACK_TASKS a giant arm pack's tasks: the loadout each asks of its two giant arms (`packTask`; the operator's own,
 *                    `packTools`)
 *
 * A frame takes them through its `mount` (mecha-archetypes.js): the tools and arm kits its wrists' couplers and its
 * elbows are sized for, its own loadout by default; a frame with a giant arm pack takes its giant arms' through its
 * `packMount`. Generic tools of a generic machine: no maker's.
 */

export const MECHA_TOOLS = Object.freeze({
  grapple: Object.freeze({ sku: 'claw-hw', label: 'grapple', task: 'grips and carries: pipe, kerb stones, timber, rubble', holds: 450, circuit: 'clamp', flow: 20 }),
  bucket: Object.freeze({ sku: 'bucket-hw', label: 'digging bucket', task: 'digs and carries soil: a trench, a footing, a pit', holds: 300, circuit: 'none', flow: 0 }),
  breaker: Object.freeze({ sku: 'breaker-hw', label: 'hydraulic breaker', task: 'breaks concrete, asphalt and rock', holds: 0, circuit: 'hammer', flow: 45 }),
  crusher: Object.freeze({ sku: 'crusher-hw', label: 'concrete crusher', task: 'crushes concrete and cuts its rebar', holds: 250, circuit: 'clamp', flow: 35 }),
  forks: Object.freeze({ sku: 'forks-hw', label: 'pallet forks', task: 'carries pallets: blocks, bricks, bagged cement', holds: 500, circuit: 'none', flow: 0 }),
  auger: Object.freeze({ sku: 'auger-hw', label: 'earth auger', task: 'drills post and pile holes', holds: 0, circuit: 'motor', flow: 50 }),
  vacuum: Object.freeze({ sku: 'vacuum-hw', label: 'vacuum lifter', task: 'lifts and sets glass, slabs and panels', holds: 300, circuit: 'electric', flow: 0 }),
  magnet: Object.freeze({ sku: 'magnet-hw', label: 'lifting magnet', task: 'lifts steel: plate, sections, scrap', holds: 400, circuit: 'electric', flow: 0 }),
  hook: Object.freeze({ sku: 'hook-hw', label: 'lifting hook', task: 'hangs a slung load from its arm', holds: 1000, circuit: 'none', flow: 0 }),
  // (a giant arm pack's tools, on its arms' larger coupler)
  giantHand: Object.freeze({ sku: 'hand-gw', label: 'giant hand', task: 'grips, carries and places what a crane would sling: beams, blocks, rubble', holds: 1500, circuit: 'clamp', flow: 40 }),
  giantGrapple: Object.freeze({ sku: 'grapple-gw', label: 'giant grapple', task: 'grips and carries logs, pipe, wreckage', holds: 1800, circuit: 'clamp', flow: 40 }),
  spreader: Object.freeze({ sku: 'spreader-gw', label: 'rescue spreader', task: 'forces apart: a fallen slab, a jammed door, wreckage over someone', holds: 800, circuit: 'clamp', flow: 60 }),
  prop: Object.freeze({ sku: 'prop-gw', label: 'shoring prop', task: 'is set under a slab or a ceiling and left to hold it up (from the ground, not the arm)', holds: 0, circuit: 'none', flow: 0 }),
  shear: Object.freeze({ sku: 'shear-gw', label: 'shear', task: 'fells and cuts: trees, steel sections, rebar', holds: 600, circuit: 'clamp', flow: 70 }),
  vibro: Object.freeze({ sku: 'vibro-gw', label: 'vibratory driver', task: 'drives piles and sheet piles by vibration', holds: 0, circuit: 'motor', flow: 110 }),
  clamshell: Object.freeze({ sku: 'clamshell-gw', label: 'clamshell grab', task: 'digs and grabs loose material: a shaft, a heap of rubble', holds: 1200, circuit: 'clamp', flow: 50 }),
  giantHook: Object.freeze({ sku: 'hook-gw', label: 'giant hook', task: 'hangs a heavy slung load from a giant arm', holds: 2500, circuit: 'none', flow: 0 }),
});
export const MECHA_TOOL_IDS = Object.freeze(Object.keys(MECHA_TOOLS));

export const MECHA_ARM_KITS = Object.freeze({
  standard: Object.freeze({ label: 'standard arm', fore: 'forearm-hw' }),
  long: Object.freeze({ label: 'long-reach arm', fore: 'forearm-hw-long' }),
});

const t = (label, r, l) => Object.freeze({ label, r: Object.freeze(r), l: Object.freeze(l) });
export const MECHA_TASKS = Object.freeze({
  demolition: t('demolition: a breaker to break it, a crusher to crush and cut it', { tool: 'breaker' }, { tool: 'crusher' }),
  highReach: t('high-reach demolition: a crusher and a grapple on long arms', { tool: 'crusher', arm: 'long' }, { tool: 'grapple', arm: 'long' }),
  trenching: t('trenching: a bucket to dig, a grapple to clear', { tool: 'bucket' }, { tool: 'grapple' }),
  pipeLaying: t('pipe laying: two grapples to carry and set a pipe', { tool: 'grapple' }, { tool: 'grapple' }),
  handling: t('material handling: two pairs of forks under a pallet', { tool: 'forks' }, { tool: 'forks' }),
  glazing: t('glazing and cladding: two vacuum lifters on a panel', { tool: 'vacuum' }, { tool: 'vacuum' }),
  piling: t('piling: an auger to drill, a grapple to set the post', { tool: 'auger' }, { tool: 'grapple' }),
  steelwork: t('steelwork: a magnet to lift, a grapple to guide', { tool: 'magnet' }, { tool: 'grapple' }),
  rigging: t('rigging: a hook on a long arm, a grapple to steady the load', { tool: 'hook', arm: 'long' }, { tool: 'grapple' }),
});
export const MECHA_TASK_IDS = Object.freeze(Object.keys(MECHA_TASKS));

// (a giant arm pack's tasks: a loadout for its two giant arms, the frame's own arms as they are or as its task fits them)
export const MECHA_PACK_TASKS = Object.freeze({
  heavyLift: t('heavy lifting: two giant hands under the load', { tool: 'giantHand' }, { tool: 'giantHand' }),
  disasterResponse: t('disaster response: a giant hand to lift, a spreader to force a way', { tool: 'giantHand' }, { tool: 'spreader' }),
  shoring: t('shoring: two props set under a slab while it is made safe', { tool: 'prop' }, { tool: 'prop' }),
  forestry: t('forestry: a shear to fell, a giant grapple to carry', { tool: 'shear' }, { tool: 'giantGrapple' }),
  pileDriving: t('pile driving: a vibratory driver, a giant hand to pitch the pile', { tool: 'vibro' }, { tool: 'giantHand' }),
  debrisClearing: t('debris clearing: a clamshell to grab, a giant hand to sort', { tool: 'clamshell' }, { tool: 'giantHand' }),
  heavyRigging: t('heavy rigging: a giant hook, a giant hand to steady the load', { tool: 'giantHook' }, { tool: 'giantHand' }),
});
export const MECHA_PACK_TASK_IDS = Object.freeze(Object.keys(MECHA_PACK_TASKS));
