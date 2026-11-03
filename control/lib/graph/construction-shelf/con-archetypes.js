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
});
