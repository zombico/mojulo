/**
 * fabricator — what a physical part has to DO, said once, resolved per need to the parts and cuts that do it.
 *
 * The cluster idea: a fabrication problem is a closed set of jobs (fasten, hinge, spin, seal, mount …), and most of
 * them are already solved by standard parts that the global supply chain stocks everywhere. A design that pulls a 608
 * bearing, four heat-set inserts and an O-ring off the shelf is cheaper, stronger and more repeatable than one that
 * mints all three. So the fabricator tries the shelf first and designs from scratch last.
 *
 * Three layers, the shape of the fauna behavior resolver (../fauna/behavior/):
 *  - FUNCTIONS: the plain words for what a part does, one line each;
 *  - STRATEGIES: one way to do a function, as parts taken by a ROUTE (buy it, fit its standard interface into your
 *    part, print the standard part, or mint from scratch), and what it takes: the CAPABILITIES of the need
 *    (./capabilities.js, measured from its numbers) and the intent TAGS it wants or refuses (./tags.js);
 *  - the RESOLVER: a function's strategies are tried in order, most specific first. A strategy qualifies when its
 *    needs and tags hold, its parts come in a stock size, and every part's PROVENANCE permits its route
 *    (./provenance.js); the first that qualifies wins. The last needs nothing and mints, so every need resolves, and
 *    `why` says what decided it and `refused` what was passed over.
 *
 * Read-time data only: nothing here builds geometry or reaches a plan. A resolution names hardware codes
 * (../construction/hardware.js) and `mj_*` calls (../scad/mech-lib.js) the existing builders already carry out.
 */
import { boltLength } from '../construction/hardware.js';
import { CAPABILITIES, capabilitiesOf } from './capabilities.js';
import { TAGS, tagsOf } from './tags.js';
import { INVENTORY } from './inventory.js';
import { PROVENANCE, ROUTES, permits, noticesOf } from './provenance.js';
import { BEARINGS, ISO_SIZES, NEMA } from './mech-tables.js';

export { CAPABILITIES, capabilitiesOf, TAGS, tagsOf, INVENTORY, PROVENANCE, ROUTES, permits };

/** The function words. */
export const FUNCTIONS = Object.freeze({
  fasten:   'hold two parts together so they come apart again',
  thread:   'give the work a durable machine thread',
  locate:   'put one part in the same place every time',
  hinge:    'turn a lid or door about a fixed edge',
  slide:    'guide a part along a straight line',
  spin:     'carry a turning shaft',
  drive:    'make it move under power',
  transmit: 'carry motion from one shaft to another',
  retain:   'keep a part on its shaft, and turning with it',
  seal:     'keep water and dust out of a joint',
  catch:    'hold something shut until a hand opens it',
  mount:    'fix the part to a standard host',
  enclose:  'box something in',
  store:    'hold loose things in order',
  frame:    'carry the loads as a skeleton',
});

// ── sizing: every number comes from an existing table ──

const SIZE_BY_LOAD = { light: 'M3', medium: 'M5', heavy: 'M8' };
const sizeOf = ({ need, caps }) => need.size || SIZE_BY_LOAD[caps.load];
const gripOf = ({ need }) => need.grip ?? 10;
const dOf = (size) => ISO_SIZES[size]?.d ?? +String(size).slice(1);

/** A bolt code that passes the grip: through to a nut, or into a thread `engage` deep. */
function bolt(style, ctx, { nut = true, engage = 0 } = {}) {
  const size = sizeOf(ctx);
  const { length } = boltLength(size, gripOf(ctx) + engage, { nut, washers: nut ? 2 : 0, proud: nut ? 2 : 0 });
  return `${size}x${length}-${style}`;
}
const woodInsertSize = (ctx) => ({ M8: 'M8', M10: 'M10' }[sizeOf(ctx)] || 'M6');
const heatsetSize = (ctx) => (ISO_SIZES[sizeOf(ctx)]?.heatset > 0 ? sizeOf(ctx) : null);

/** The ball bearing on the shaft ⌀ (or linear bushing for the rod): the slimmest for a light load, else the heaviest. */
function bearingFor(d, linear, load = 'light') {
  const fits = Object.values(BEARINGS).filter((b) => b.linear === linear && Math.abs(b.bore - d) < 0.01);
  const sign = load === 'light' ? 1 : -1;
  return fits.sort((a, b) => sign * (a.od - b.od) || sign * (a.width - b.width))[0]?.code ?? null;
}
const nemaFor = ({ need, caps }) => (NEMA[need.motor] ? need.motor : { light: 14, medium: 17, heavy: 23 }[caps.load]);
const moduleFor = ({ need, caps }) => need.module ?? { light: 1, medium: 1.5, heavy: 2 }[caps.load];
const oringCs = (d) => (d <= 20 ? 1.78 : d <= 60 ? 2.62 : 3.53);
const SLIDES = [250, 300, 350, 400, 450, 500, 550];
const pinD = ({ caps }) => ({ light: 3, medium: 4, heavy: 6 }[caps.load]);

// ── the strategies ──
// `{ id, line, needs?: { <capability>: [values] }, when?: [tag], unless?: [tag], uses?: [use], kit?: [mj module],
//    principle? }`; a use is `{ part, route, code?(ctx), call?(ctx), qty? }`: an inventory row taken by a route, with
// the hardware code or library call it resolves to (null = no stock size, so the strategy does not qualify). A
// strategy with no uses mints: `kit` names the library modules a from-scratch design starts from, `principle` the
// rule it follows. The last strategy of every function is a mint with no needs and no tags.
const mint = (fn, kit = [], principle = 'size it to the load and print orientation, and check it with the rigidity sensor') =>
  ({ id: `mint-${fn}`, line: 'design it from scratch as a solid', kit, principle });

export const STRATEGIES = Object.freeze({
  fasten: [
    { id: 'printed-bolt', line: 'a printed bolt and nut on real ISO threads, for light loads with nothing bought', needs: { host: ['printed'], load: ['light'] }, when: ['print-only'],
      uses: [{ part: 'socket-bolt', route: 'print', call: (c) => `mj_bolt("M${Math.max(6, dOf(sizeOf(c)))}", ${gripOf(c) + 8})` }, { part: 'hex-nut', route: 'print', call: (c) => `mj_nut("M${Math.max(6, dOf(sizeOf(c)))}")` }] },
    { id: 'snap-fit', line: 'a cantilever hook that springs over a lip: no tools, nothing bought', needs: { host: ['printed'], load: ['light'] }, when: ['tool-free', 'print-only'],
      kit: ['mj_edge_chamfer', 'mj_fit'], principle: 'a hook whose root strain stays under 2 % at full deflection, printed with the hook along the layers' },
    { id: 'thumb-screw', line: 'a knurled thumb screw into a heat-set insert, turned by hand', needs: { host: ['printed'], load: ['light', 'medium'] }, when: ['tool-free'], unless: ['print-only'],
      uses: [{ part: 'thumb-screw', route: 'buy', code: null }, { part: 'heat-set-insert', route: 'fit', call: () => 'mj_heatset_hole("M4", 8)' }] },
    { id: 'thumb-screw-wood', line: 'a knurled thumb screw into a wood insert, turned by hand', needs: { host: ['wood'] }, when: ['tool-free'], unless: ['print-only'],
      uses: [{ part: 'thumb-screw', route: 'buy', code: null }, { part: 'wood-insert', route: 'buy', code: () => 'insert-M6' }] },
    { id: 'cam-lock', line: 'a cam in one panel pulls a bolt in the other, hidden, with dowels to locate', needs: { host: ['wood'] }, when: ['flat-pack'], unless: ['tool-free'],
      uses: [{ part: 'cam-lock', route: 'buy', code: () => 'cam-15' }, { part: 'cam-lock', route: 'buy', code: () => 'cam-bolt-15' }, { part: 'wood-dowel', route: 'buy', code: () => 'dowel-8x35', qty: 2 }] },
    { id: 'confirmat', line: 'a one-piece connector screw through face into edge', needs: { host: ['wood'] }, when: ['flat-pack'], unless: ['tool-free'],
      uses: [{ part: 'confirmat', route: 'buy', code: () => 'confirmat-7x50' }] },
    { id: 'insert-bolt', line: 'a socket bolt into a threaded insert, for a joint opened again and again', needs: { host: ['wood'], cycles: ['many'] }, unless: ['tool-free'],
      uses: [{ part: 'wood-insert', route: 'buy', code: (c) => `insert-${woodInsertSize(c)}` }, { part: 'socket-bolt', route: 'buy', code: (c) => bolt('socket', { ...c, need: { ...c.need, size: woodInsertSize(c) } }, { nut: false, engage: 12 }) }] },
    { id: 'heatset-bolt', line: 'a socket bolt into a heat-set insert, for a printed joint opened again and again', needs: { host: ['printed'], cycles: ['many'] }, unless: ['print-only', 'tool-free'],
      uses: [{ part: 'heat-set-insert', route: 'fit', call: (c) => heatsetSize(c) && `mj_heatset_hole("${heatsetSize(c)}", ${2 * dOf(sizeOf(c))})` }, { part: 'socket-bolt', route: 'buy', code: (c) => bolt('socket', c, { nut: false, engage: 2 * dOf(sizeOf(c)) }) }, { part: 'socket-bolt', route: 'fit', call: (c) => `mj_counterbore("${sizeOf(c)}", ${gripOf(c)})` }] },
    { id: 'nut-trap', line: 'a socket bolt into a nut captured in a printed hex pocket', needs: { host: ['printed'], access: ['both'] }, unless: ['print-only', 'tool-free'],
      uses: [{ part: 'socket-bolt', route: 'buy', code: (c) => bolt('socket', c) }, { part: 'hex-nut', route: 'buy', code: (c) => `nut-${sizeOf(c)}` }, { part: 'hex-nut', route: 'fit', call: (c) => `mj_nut_trap("${sizeOf(c)}")` }, { part: 'socket-bolt', route: 'fit', call: (c) => `mj_clearance_hole("${sizeOf(c)}", ${gripOf(c)})` }] },
    { id: 'tapped', line: 'a socket bolt into a thread tapped in the print, for a joint seldom opened', needs: { host: ['printed'], load: ['light'], cycles: ['few'] }, unless: ['print-only', 'tool-free'],
      uses: [{ part: 'socket-bolt', route: 'buy', code: (c) => bolt('socket', c, { nut: false, engage: 2 * dOf(sizeOf(c)) }) }, { part: 'socket-bolt', route: 'fit', call: (c) => `mj_tapped_hole("${sizeOf(c)}", ${2 * dOf(sizeOf(c))})` }] },
    { id: 'wood-screw', line: 'chipboard screws, piloted', needs: { host: ['wood'], cycles: ['few'] }, unless: ['tool-free'],
      uses: [{ part: 'wood-screw', route: 'buy', code: ({ caps }) => (caps.load === 'heavy' ? 'wood-5x50' : 'wood-4x30') }] },
    { id: 'rivet-nut', line: 'a rivet nut set from one side of the sheet, a socket bolt into it', needs: { host: ['sheet'] }, unless: ['print-only', 'tool-free'],
      uses: [{ part: 'rivet-nut', route: 'buy', code: null }, { part: 'socket-bolt', route: 'buy', code: (c) => bolt('socket', c, { nut: false, engage: dOf(sizeOf(c)) }) }] },
    { id: 'tapped-metal', line: 'a socket bolt into a thread tapped in the metal, from one side', needs: { host: ['metal', 'extrusion'] }, unless: ['print-only', 'tool-free'],
      uses: [{ part: 'socket-bolt', route: 'buy', code: (c) => bolt('socket', c, { nut: false, engage: 1.5 * dOf(sizeOf(c)) }) }, { part: 'socket-bolt', route: 'fit', call: (c) => `mj_tapped_hole("${sizeOf(c)}", ${1.5 * dOf(sizeOf(c))})` }] },
    { id: 'bolt-nut', line: 'a bolt through both parts to a lock nut, washers under each', needs: { access: ['both'] }, unless: ['print-only', 'tool-free'],
      uses: [{ part: 'hex-bolt', route: 'buy', code: (c) => bolt('hex', c) }, { part: 'nyloc-nut', route: 'buy', code: (c) => `nyloc-${sizeOf(c)}` }, { part: 'washer', route: 'buy', code: (c) => `washer-${sizeOf(c)}`, qty: 2 }] },
    mint('fasten', ['mj_boss', 'mj_rib'], 'a bespoke clamp or interlock; mint only when no stock fastener reaches'),
  ],
  thread: [
    { id: 'heat-set', line: 'a brass insert melted into a printed pilot', needs: { host: ['printed'] }, unless: ['print-only'],
      uses: [{ part: 'heat-set-insert', route: 'fit', call: (c) => heatsetSize(c) && `mj_heatset_hole("${heatsetSize(c)}", ${2 * dOf(sizeOf(c))})` }] },
    { id: 'nut-trap', line: 'a nut dropped into a printed hex pocket', needs: { host: ['printed'] }, unless: ['print-only'],
      uses: [{ part: 'hex-nut', route: 'buy', code: (c) => `nut-${sizeOf(c)}` }, { part: 'hex-nut', route: 'fit', call: (c) => `mj_nut_trap("${sizeOf(c)}")` }] },
    { id: 'printed-thread', line: 'an ISO thread printed into the part itself', needs: { host: ['printed'] },
      uses: [{ part: 'socket-bolt', route: 'fit', call: (c) => `mj_tapped_hole("${sizeOf(c)}", ${2 * dOf(sizeOf(c))})` }] },
    { id: 'wood-insert', line: 'a screw-in insert cut into the wood', needs: { host: ['wood'] },
      uses: [{ part: 'wood-insert', route: 'buy', code: () => 'insert-M6' }] },
    { id: 'tapped-metal', line: 'drilled and tapped in the metal', needs: { host: ['metal', 'extrusion'] },
      uses: [{ part: 'socket-bolt', route: 'fit', call: (c) => `mj_tapped_hole("${sizeOf(c)}", ${1.5 * dOf(sizeOf(c))})` }] },
    mint('thread', ['mj_thread', 'mj_tapped_hole']),
  ],
  locate: [
    { id: 'dowel-pin', line: 'two hardened pins pressed into one part, slip-fit holes in the other', needs: { host: ['printed', 'metal'] }, when: ['precise'], unless: ['print-only'],
      uses: [{ part: 'dowel-pin', route: 'buy', code: null, qty: 2 }, { part: 'dowel-pin', route: 'fit', call: (c) => `mj_hole(${pinD(c)}, ${3 * pinD(c)}, "press")` }, { part: 'dowel-pin', route: 'fit', call: (c) => `mj_hole(${pinD(c)}, ${3 * pinD(c)}, "slip")` }] },
    { id: 'shelf-pin', line: 'pins in a row of holes, so a shelf can be moved', needs: { host: ['wood'] }, when: ['serviceable'],
      uses: [{ part: 'shelf-pin', route: 'buy', code: () => 'shelf-pin-5', qty: 4 }] },
    { id: 'wood-dowel', line: 'fluted dowels, glued or dry', needs: { host: ['wood'] },
      uses: [{ part: 'wood-dowel', route: 'buy', code: () => 'dowel-8x35', qty: 2 }] },
    { id: 'pin-socket', line: 'a printed pin on one part into a slip-fit socket on the other', needs: { host: ['printed'] },
      kit: ['mj_hole', 'mj_fit', 'mj_fit_coupon'], principle: 'a chamfered pin with the fit taken from a printed coupon' },
    mint('locate', ['mj_hole', 'mj_fit']),
  ],
  hinge: [
    { id: 'concealed-cup', line: 'a ⌀35 cup hinge bored into the door, hidden when closed', needs: { host: ['wood'] }, when: ['hidden'],
      uses: [{ part: 'concealed-hinge', route: 'buy', code: () => 'hinge-35', qty: 2 }] },
    { id: 'butt-hinge', line: 'a pair of butt hinges screwed to the leaf and frame', needs: { host: ['wood', 'metal'] }, unless: ['print-only'],
      uses: [{ part: 'butt-hinge', route: 'buy', code: null, qty: 2 }] },
    { id: 'living-hinge', line: 'a thin printed web that flexes, one piece', needs: { host: ['printed'], load: ['light'], cycles: ['few'] }, when: ['print-only'],
      kit: ['mj_fit'], principle: 'a web 0.3–0.5 mm thick, printed flat across the layers, in polypropylene or PETG; PLA cracks' },
    { id: 'pin-knuckle', line: 'printed knuckles on a hardened pin', needs: { host: ['printed'] }, unless: ['print-only'],
      uses: [{ part: 'dowel-pin', route: 'buy', code: null }, { part: 'dowel-pin', route: 'fit', call: (c) => `mj_hole(${pinD(c)}, 20, "running")` }] },
    { id: 'bolt-pivot', line: 'a shouldered bolt through both leaves to a lock nut', needs: { host: ['metal', 'sheet', 'extrusion'] },
      uses: [{ part: 'hex-bolt', route: 'buy', code: (c) => bolt('hex', c) }, { part: 'nyloc-nut', route: 'buy', code: (c) => `nyloc-${sizeOf(c)}` }, { part: 'washer', route: 'buy', code: (c) => `washer-${sizeOf(c)}`, qty: 2 }] },
    { id: 'print-in-place', line: 'knuckles printed around a printed pin, separated by a running clearance', needs: { host: ['printed'] },
      kit: ['mj_fit'], principle: 'a 0.3 mm running gap at the pin, the axis along the bed' },
    mint('hinge'),
  ],
  slide: [
    { id: 'drawer-slide', line: 'a pair of ball-bearing slides screwed to carcass and drawer', needs: { host: ['wood'] },
      uses: [{ part: 'drawer-slide', route: 'buy', code: ({ need }) => { const L = [...SLIDES].reverse().find((s) => s <= (need.depth ?? 450)); return L ? `slide-${L}` : null; } }] },
    { id: 'wheel-carriage', line: 'a wheel plate riding the extrusion\'s slots', needs: { host: ['extrusion'] },
      uses: [{ part: 'wheel-carriage', route: 'buy', code: null }, { part: 't-slot-extrusion', route: 'buy', code: null }] },
    { id: 'linear-bushing', line: 'linear ball bushings on hardened rods', needs: { linear: ['stock'] }, unless: ['print-only'],
      uses: [{ part: 'linear-bearing', route: 'buy', code: ({ need }) => bearingFor(need.shaftD, true), qty: 2 }, { part: 'linear-rod', route: 'buy', code: null, qty: 2 }, { part: 'linear-bearing', route: 'fit', call: ({ need }) => bearingFor(need.shaftD, true) && `mj_bearing_seat("${bearingFor(need.shaftD, true)}")` }] },
    { id: 'printed-dovetail', line: 'a printed dovetail on a running fit', needs: { host: ['printed'], load: ['light'] },
      kit: ['mj_fit', 'mj_fit_coupon'], principle: 'a 60° dovetail with a running clearance taken from a coupon, printed with the rail along the layers' },
    mint('slide'),
  ],
  spin: [
    { id: 'ball-bearing', line: 'a sealed ball bearing pressed into a seat, the shaft through its bore', needs: { bearing: ['stock'] }, unless: ['print-only'],
      uses: [{ part: 'radial-bearing', route: 'buy', code: ({ need, caps }) => bearingFor(need.shaftD, false, caps.load), qty: 2 }, { part: 'radial-bearing', route: 'fit', call: ({ need, caps }) => bearingFor(need.shaftD, false, caps.load) && `mj_bearing_seat("${bearingFor(need.shaftD, false, caps.load)}")` }] },
    { id: 'printed-bushing', line: 'a printed sleeve on a running fit', needs: { load: ['light'] },
      kit: ['mj_hole', 'mj_fit'], principle: 'a sleeve at least 1.5 × the shaft ⌀ long, a running clearance, a lubricated steel shaft' },
    mint('spin', ['mj_hole', 'mj_bearing_seat']),
  ],
  drive: [
    { id: 'stepper', line: 'a stepper motor bolted to a printed or plate face', when: ['precise'], unless: ['print-only'],
      uses: [{ part: 'stepper-motor', route: 'buy', code: null }, { part: 'stepper-motor', route: 'fit', call: (c) => `mj_nema_mount(${nemaFor(c)}, 5)` }, { part: 'd-shaft', route: 'fit', call: (c) => `mj_d_bore(${NEMA[nemaFor(c)].shaft})` }] },
    { id: 'gearmotor', line: 'a micro gearmotor clamped in a printed cradle', needs: { load: ['light'] }, unless: ['print-only'],
      uses: [{ part: 'gearmotor', route: 'buy', code: null }, { part: 'd-shaft', route: 'fit', call: () => 'mj_d_bore(3)' }] },
    { id: 'stepper-heavy', line: 'a stepper motor for the load, mounted by its frame', unless: ['print-only'],
      uses: [{ part: 'stepper-motor', route: 'buy', code: null }, { part: 'stepper-motor', route: 'fit', call: (c) => `mj_nema_mount(${nemaFor(c)}, 5)` }] },
    mint('drive', [], 'a hand crank or a spring: no motor bought'),
  ],
  transmit: [
    { id: 'worm', line: 'a worm on the input driving a wheel, self-locking', needs: { axes: ['crossed'] },
      uses: [{ part: 'worm-set', route: 'print', call: (c) => `mj_worm(${moduleFor(c)}, 20, ${10 * moduleFor(c)})` }, { part: 'spur-gear', route: 'print', call: (c) => `mj_spur_gear(${moduleFor(c)}, 30, 6)` }] },
    { id: 'bevel', line: 'a bevel pair turning the motion through 90°', needs: { axes: ['intersecting'] },
      uses: [{ part: 'bevel-gear', route: 'print', call: (c) => `mj_bevel_gear(${moduleFor(c)}, 20, 6)`, qty: 2 }] },
    { id: 'rack', line: 'a pinion on the shaft driving a rack', needs: { axes: ['linear'] },
      uses: [{ part: 'spur-gear', route: 'print', call: (c) => `mj_spur_gear(${moduleFor(c)}, 16, 6)` }, { part: 'rack', route: 'print', call: (c) => `mj_rack(${moduleFor(c)}, 20, 6, 8)` }] },
    { id: 'planetary', line: 'a planetary stage on one axis', needs: { axes: ['parallel'], span: ['near'] }, when: ['high-ratio'],
      uses: [{ part: 'planetary-set', route: 'print', call: (c) => `mj_planetary(${moduleFor(c)}, 12, 18, 3, 8)` }] },
    { id: 'belt', line: 'a 2 mm pitch timing belt between printed pulleys', needs: { axes: ['parallel'] }, unless: ['print-only'],
      uses: [{ part: 'timing-pulley', route: 'print', call: () => 'mj_gt2_pulley(20)', qty: 2 }, { part: 'timing-belt', route: 'buy', code: null }] },
    { id: 'spur', line: 'a spur pair', needs: { axes: ['parallel'], span: ['near'] }, unless: ['quiet'],
      uses: [{ part: 'spur-gear', route: 'print', call: (c) => `mj_spur_gear(${moduleFor(c)}, 15, 6)` }, { part: 'spur-gear', route: 'print', call: (c) => `mj_spur_gear(${moduleFor(c)}, 30, 6)` }] },
    { id: 'herringbone', line: 'a herringbone spur pair, quieter than straight teeth', needs: { axes: ['parallel'], span: ['near'] },
      uses: [{ part: 'spur-gear', route: 'print', call: (c) => `mj_spur_gear(${moduleFor(c)}, 15, 8, herringbone = true, helix = 20)`, qty: 2 }] },
    mint('transmit', ['mj_gear2d', 'mj_gear_meshed'], 'a linkage, cam or cable when no gear or belt reaches'),
  ],
  retain: [
    { id: 'key', line: 'a parallel key in a shaft and hub keyway, for torque', needs: { load: ['heavy'], shaft: ['mid', 'large'] },
      uses: [{ part: 'parallel-key', route: 'buy', code: null }, { part: 'parallel-key', route: 'fit', call: ({ need }) => (need.shaftD <= 58 ? `mj_keyway_hub(${need.shaftD}, 10)` : null) }] },
    { id: 'circlip', line: 'a retaining ring in a shaft groove', needs: { shaft: ['mid', 'large'] }, when: ['serviceable'],
      uses: [{ part: 'circlip', route: 'buy', code: null }, { part: 'circlip', route: 'fit', call: ({ need }) => `mj_circlip_groove(${need.shaftD}, 0)` }] },
    { id: 'd-flat', line: 'a D-flat on the shaft, a D bore in the hub', needs: { shaft: ['small', 'mid'] },
      uses: [{ part: 'd-shaft', route: 'fit', call: ({ need }) => `mj_d_bore(${need.shaftD})` }] },
    { id: 'set-screw', line: 'a set screw into the shaft through the hub', needs: { shaft: ['small', 'mid', 'large'] }, unless: ['print-only'],
      uses: [{ part: 'set-screw', route: 'buy', code: null }, { part: 'heat-set-insert', route: 'fit', call: () => 'mj_heatset_hole("M3", 5)' }] },
    mint('retain', ['mj_d_bore', 'mj_circlip_groove']),
  ],
  seal: [
    { id: 'o-ring', line: 'an O-ring in a groove, squeezed a quarter', needs: { host: ['printed', 'metal'] }, unless: ['print-only'],
      uses: [{ part: 'o-ring', route: 'buy', code: null }, { part: 'o-ring', route: 'fit', call: ({ need }) => `mj_oring_groove(${need.sealD ?? 40}, ${oringCs(need.sealD ?? 40)})` }] },
    { id: 'gasket-tape', line: 'closed-cell foam tape on a flange', needs: { host: ['sheet', 'wood', 'extrusion'] },
      uses: [{ part: 'gasket-tape', route: 'buy', code: null }] },
    mint('seal', ['mj_molded_shell'], 'a labyrinth lip and a drip edge: keeps splashes out, never immersion'),
  ],
  catch: [
    { id: 'magnet', line: 'neodymium discs pressed into pockets on both faces', unless: ['print-only'],
      uses: [{ part: 'magnet-disc', route: 'buy', code: null, qty: 2 }, { part: 'magnet-disc', route: 'fit', call: () => 'mj_hole(6, 3, "press")', qty: 2 }] },
    { id: 'snap', line: 'a printed detent that clicks over a bump', needs: { host: ['printed'] }, when: ['print-only'],
      kit: ['mj_fit'], principle: 'a detent with a 30° lead and a 45° return, strain under 2 %' },
    mint('catch'),
  ],
  mount: [
    { id: 'vesa', line: 'the VESA hole square, for a display arm or wall plate', needs: { to: ['vesa'] },
      uses: [{ part: 'vesa-pattern', route: 'fit', call: ({ need }) => `mj_vesa(${need.vesa ?? 100}, 5)` }, { part: 'socket-bolt', route: 'buy', code: ({ need }) => ((need.vesa ?? 100) === 200 ? 'M6x12-socket' : 'M4x10-socket'), qty: 4 }] },
    { id: 't-slot', line: 'T-nuts in the extrusion\'s slot, socket bolts through the part', needs: { to: ['t-slot'] },
      uses: [{ part: 't-nut', route: 'buy', code: null, qty: 2 }, { part: 'socket-bolt', route: 'buy', code: () => 'M5x10-socket', qty: 2 }, { part: 'socket-bolt', route: 'fit', call: () => 'mj_counterbore("M5", 5)' }] },
    { id: 'rpi', line: 'standoffs on the board\'s published hole pattern', needs: { to: ['board'], board: ['rpi'] },
      uses: [{ part: 'board-raspberry-pi', route: 'fit', call: ({ need }) => `mj_board_standoffs("${need.board}", 5, insert = true)` }] },
    { id: 'arduino', line: 'standoffs on the board\'s published hole pattern', needs: { to: ['board'], board: ['arduino'] },
      uses: [{ part: 'board-arduino', route: 'fit', call: ({ need }) => `mj_board_standoffs("${need.board}", 5, insert = true)` }] },
    { id: 'camera', line: 'a 1/4-20 thread for a tripod or camera', needs: { to: ['camera'] },
      uses: [{ part: 'tripod-thread', route: 'buy', code: null }] },
    { id: 'action-cam-print', line: 'the three-prong mount printed into the part', needs: { to: ['action-cam'] },
      uses: [{ part: 'action-cam-mount', route: 'print', call: () => null }] },
    { id: 'action-cam-adapter', line: 'a bought three-prong adapter screwed to a 1/4-20 thread', needs: { to: ['action-cam'] },
      uses: [{ part: 'action-cam-mount', route: 'buy', code: null }, { part: 'tripod-thread', route: 'buy', code: null }] },
    { id: 'brick-adapter', line: 'a bought plate from the brick system bonded to the part', needs: { to: ['brick'] },
      uses: [{ part: 'brick-studs', route: 'buy', code: null }] },
    { id: 'skadis-accessory', line: 'a bought accessory for that pegboard, screwed to the part', needs: { to: ['pegboard'] }, when: ['hidden'],
      uses: [{ part: 'skadis-pegboard', route: 'buy', code: null }] },
    { id: 'pegboard-hooks', line: 'hooks for 1/4 in pegboard, screwed to the part', needs: { to: ['pegboard'] },
      uses: [{ part: 'pegboard', route: 'buy', code: null }, { part: 'wood-screw', route: 'buy', code: () => 'wood-3.5x16', qty: 2 }] },
    { id: 'grid', line: 'a Gridfinity base under the part', needs: { to: ['grid'] },
      uses: [{ part: 'gridfinity', route: 'print', call: () => 'mj_gridfinity_bin(1, 1, 3, magnets = true)' }] },
    { id: 'wall', line: 'angle brackets screwed to the wall and the part', needs: { to: ['wall'] },
      uses: [{ part: 'angle-bracket', route: 'buy', code: ({ caps }) => (caps.load === 'heavy' ? 'bracket-L60' : 'bracket-L40'), qty: 2 }, { part: 'wood-screw', route: 'buy', code: () => 'wood-4x30', qty: 4 }] },
    mint('mount', ['mj_clearance_hole', 'mj_boss'], 'measure the host, then a keyhole slot, clamp or bracket to it'),
  ],
  enclose: [
    { id: 'sealed-shell', line: 'a molded shell with an O-ring lid and screw bosses', when: ['waterproof'], unless: ['print-only'],
      uses: [{ part: 'o-ring', route: 'buy', code: null }, { part: 'o-ring', route: 'fit', call: ({ need }) => `mj_oring_groove(${need.sealD ?? 80}, ${oringCs(need.sealD ?? 80)})` }, { part: 'heat-set-insert', route: 'fit', call: () => 'mj_heatset_hole("M3", 6)', qty: 4 }],
      kit: ['mj_molded_shell', 'mj_boss'] },
    { id: 'board-box', line: 'the parametric box, standoffs on the board\'s holes', needs: { board: ['rpi', 'arduino'], host: ['printed'] },
      uses: [{ part: 'enclosure', route: 'print', call: ({ need }) => `mj_enclosure([${(need.inner || [90, 62, 30]).join(', ')}], board = "${need.board}")` }, { part: 'heat-set-insert', route: 'fit', call: () => 'mj_heatset_hole("M3", 6)', qty: 4 }] },
    { id: 'project-box', line: 'the parametric box with a screwed lid', needs: { host: ['printed'] },
      uses: [{ part: 'enclosure', route: 'print', call: ({ need }) => `mj_enclosure([${(need.inner || [80, 50, 30]).join(', ')}])` }] },
    { id: 'sheet-box', line: 'a folded sheet box', needs: { host: ['sheet'] },
      kit: ['mj_sheet', 'mj_sheet_flat'], principle: 'bend allowance from the material\'s K factor; flat pattern exported for the brake' },
    mint('enclose', ['mj_molded_shell', 'mj_boss', 'mj_rib']),
  ],
  store: [
    { id: 'gridfinity', line: 'Gridfinity bins on a 42 mm grid', needs: { host: ['printed'] },
      uses: [{ part: 'gridfinity', route: 'print', call: ({ need }) => `mj_gridfinity_bin(${need.ux ?? 1}, ${need.uy ?? 1}, ${need.uz ?? 3})` }] },
    { id: 'pegboard', line: 'hooks and holders on pegboard', needs: { host: ['wood'] },
      uses: [{ part: 'pegboard', route: 'buy', code: null }] },
    mint('store', ['mj_rounded_box']),
  ],
  frame: [
    { id: 't-slot-frame', line: '20-series extrusion cut to length, joined by brackets and T-nuts', needs: { host: ['extrusion'] },
      uses: [{ part: 't-slot-extrusion', route: 'buy', code: null }, { part: 't-nut', route: 'buy', code: null, qty: 8 }, { part: 'socket-bolt', route: 'buy', code: () => 'M5x10-socket', qty: 8 }] },
    { id: 'printed-ribs', line: 'a printed shell stiffened by ribs and bosses', needs: { host: ['printed'], load: ['light', 'medium'] },
      kit: ['mj_rib', 'mj_boss', 'mj_molded_shell'], principle: 'ribs 0.6 × the wall, loads along the layers, checked by the rigidity sensor' },
    { id: 'sheet-frame', line: 'folded sheet channels bolted together', needs: { host: ['sheet'] },
      kit: ['mj_sheet'], principle: 'C-channels with return flanges, bolted at the webs' },
    mint('frame', [], 'a timber or welded frame: the construction kinds own those joints'),
  ],
});

// ── the resolver ──

const qualifies = (s, caps, tags) =>
  Object.entries(s.needs || {}).every(([k, v]) => v.includes(caps[k]))
  && (!s.when || s.when.some((t) => tags.has(t)))
  && !(s.unless || []).some((t) => tags.has(t));

/** The parts of a strategy for this need → { parts, refused: why | null }. */
function lower(s, ctx) {
  const parts = [];
  for (const u of s.uses || []) {
    const row = INVENTORY[u.part];
    if (!row) return { parts, refused: `unknown inventory row '${u.part}'` };
    const gate = permits(row, u.route);
    if (!gate.ok) return { parts, refused: gate.why };
    const code = u.code ? u.code(ctx) : null;
    const call = u.call ? u.call(ctx) : null;
    if ((u.code && !code) || (u.call && !call)) return { parts, refused: `${row.id}: no stock size for this need` };
    parts.push({ part: row.id, label: row.label, route: u.route, provenance: row.provenance, standard: row.standard || null,
      code, call, buy: u.route === 'buy' ? row.buy || null : null, qty: u.qty ?? 1 });
  }
  return { parts, refused: null };
}

const whyOf = (s, caps, tags) => {
  const bits = Object.keys(s.needs || {}).map((k) => `${k} ${caps[k]}`);
  for (const t of s.when || []) if (tags.has(t)) bits.push(t);
  return bits.length ? bits.join('; ') : (s.uses ? 'nothing more specific applies' : 'no stock strategy fits: designed from scratch');
};

function walk(need) {
  const list = STRATEGIES[need.function];
  if (!list) throw new Error(`fabricator: unknown function '${need.function}' (one of ${Object.keys(FUNCTIONS).join(', ')})`);
  const { tags, unknown } = tagsOf(need);
  const caps = capabilitiesOf(need, tags);
  const ctx = { need, caps, tags };
  const out = [];
  const refused = [];
  for (const s of list) {
    if (!qualifies(s, caps, tags)) continue;
    const { parts, refused: no } = lower(s, ctx);
    if (no) { refused.push({ strategy: s.id, why: no }); continue; }
    out.push({ s, parts });
  }
  return { list: out, refused, caps, tags, unknown };
}

/** 'buy', 'fit', 'print' joined by '+'; a part-less strategy is a `principle` (a known from-scratch recipe) or the `mint`. */
const routeOf = (s, parts) => (parts.length ? [...new Set(parts.map((p) => p.route))].join('+') : /^mint-/.test(s.id) ? 'mint' : 'principle');

function present(need, { s, parts }, caps, tags) {
  const notices = [...new Set(parts.flatMap((p) => noticesOf(INVENTORY[p.part])))];
  return { function: need.function, strategy: s.id, line: s.line, route: routeOf(s, parts), parts, kit: s.kit || [],
    principle: s.principle || null, why: whyOf(s, caps, tags), notices };
}

/** A need → the first strategy that qualifies, its parts, why, what was passed over, and the notices it carries. */
export function resolve(need) {
  const { list, refused, caps, tags, unknown } = walk(need);
  return { ...present(need, list[0], caps, tags), refused, capabilities: caps, unknownTags: unknown };
}

/** Every way this need can be met, the resolver's own choice first, the from-scratch mint last. */
export function repertoire(need) {
  const { list, caps, tags } = walk(need);
  return list.map((e) => present(need, e, caps, tags));
}

// ── coverage: how much of the problem space the shelf already solves ──

const HOSTS = CAPABILITIES.host.values;
const each = (fn, partials) => partials.map((p) => ({ function: fn, ...p }));

/**
 * The probe needs: a hand-chosen spread of situations per function, each tried bare and with every tag. Coverage is
 * the share solved from the shelf (anything but a mint); the rest are the gaps a new row or strategy would fill.
 */
export const PROBES = Object.freeze([
  ...each('fasten', HOSTS.flatMap((host) => [{ host }, { host, loadN: 300 }, { host, loadN: 2000, access: 'one' }, { host, cycles: 200 }])),
  ...each('thread', HOSTS.flatMap((host) => [{ host }, { host, loadN: 2000 }])),
  ...each('locate', HOSTS.map((host) => ({ host }))),
  ...each('hinge', HOSTS.flatMap((host) => [{ host }, { host, loadN: 300 }])),
  ...each('slide', [...HOSTS.map((host) => ({ host })), { shaftD: 8 }, { shaftD: 12 }, { shaftD: 16 }, { host: 'wood', depth: 200 }]),
  ...each('spin', [3, 4, 5, 6, 8, 10, 12, 15, 17, 20, 25].flatMap((shaftD) => [{ shaftD }, { shaftD, loadN: 300 }])),
  ...each('drive', [{}, { loadN: 300 }, { loadN: 2000 }]),
  ...each('transmit', CAPABILITIES.axes.values.flatMap((axes) => [{ axes }, { axes, span: 120 }, { axes, loadN: 300 }])),
  ...each('retain', [3, 5, 8, 12, 20, 30].flatMap((shaftD) => [{ shaftD }, { shaftD, loadN: 2000 }])),
  ...each('seal', HOSTS.map((host) => ({ host }))),
  ...each('catch', HOSTS.map((host) => ({ host }))),
  ...each('mount', [...CAPABILITIES.to.values.map((to) => ({ to })), { to: 'board', board: 'rpi4' }, { to: 'board', board: 'arduino-uno' }, { to: 'board', board: 'esp32-devkit' }, { to: 'vesa', vesa: 200 }]),
  ...each('enclose', [...HOSTS.map((host) => ({ host })), { board: 'rpi5' }, { board: 'arduino-mega' }]),
  ...each('store', HOSTS.map((host) => ({ host }))),
  ...each('frame', HOSTS.flatMap((host) => [{ host }, { host, loadN: 2000 }])),
].flatMap((p) => [p, ...Object.keys(TAGS).map((t) => ({ ...p, tags: [t] }))]));

/**
 * → { total, shelf, principle, minted, byFunction: { fn: { total, shelf, principle } }, gaps: [{ function, need, why }] }:
 * `shelf` solved with inventory parts, `principle` by a known from-scratch recipe, `minted` by the bare fallback.
 */
export function coverage(probes = PROBES) {
  const byFunction = {};
  const gaps = [];
  const n = { shelf: 0, principle: 0, minted: 0 };
  for (const need of probes) {
    const r = resolve(need);
    const f = (byFunction[need.function] ||= { total: 0, shelf: 0, principle: 0 });
    f.total += 1;
    if (r.route === 'mint') { n.minted += 1; gaps.push({ function: need.function, need, why: r.why }); }
    else if (r.route === 'principle') { n.principle += 1; f.principle += 1; }
    else { n.shelf += 1; f.shelf += 1; }
  }
  return { total: probes.length, ...n, byFunction, gaps };
}
