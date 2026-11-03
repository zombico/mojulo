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
 *
 * A frame takes them through its `mount` (mecha-archetypes.js): the tools and arm kits its wrists' couplers and its
 * elbows are sized for, its own loadout by default. Generic tools of a generic machine: no maker's.
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
