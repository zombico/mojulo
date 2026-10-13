/**
 * THE BODY-PLAN SOLVER — a crafted thing's chassis solved from a BODY PLAN, not drawn by hand. A body plan is data: a
 * CORE mass and the PARTS it carries, each a kind the solver knows how to build, attach, rig and offer sockets on. A
 * new form is a row; nothing in the solver names a form.
 *
 *   core   { axis: 'x' | 'y' | 'z', dims: [length, width, height] (m), lift (m, its underside off the ground), front?,
 *            rear? ([w, h, dz] shares of its section at its ends), role, group, lattice? }
 *            x: a thing that goes (nose to tail along x); z: a thing that rises (base to top); y: a span (end to end)
 *   parts  [{ kind, when?, unless?, …its settings }]: limbs, tracks, wheels, skirt, pods, cabin, fin, plinth, deck,
 *            mast, piers, pedestal, barrels, sail, stack, oars (PART_KINDS says what each is); `when` names a dial the
 *            thing's words must set (a sail when it sails), `unless` the dials that leave it out (oars unless sail or steam)
 *   lead   the piece that takes the picture ('core' unless named)
 *
 * The solver builds every mass in the workbench's vocabulary (lofts, lathes, sweeps, extrudes), sections shaped by the
 * motif and rounds sized for where the world's camera meets the thing (tech-chassis.js `fitter`); RIGS it (a root joint
 * at the core, a joint at every hip and knee, every wheel, every barrel, a crown that turns); and DERIVES its sockets:
 * every block-like mass offers its top, front, rear and sides (sized by the face's area, serving what a face in that
 * direction can show), and every limb segment its outer side. Nothing is listed by hand.
 *
 *   BODY_PLANS                                   the rows, by `<kind>/<form>`
 *   PART_KINDS                                   what each part kind is
 *   solveBodyPlan(row, thing, { motif, scale, fit, fitLen, thick }) → { manifest, joints, sockets, pieces, masses,
 *                                                  lead, functions, dims }
 *
 * Pure; no dice.
 */
import { section } from './tech-chassis.js';
import { resolveMechanism, lathed, DEFAULT_SETTING } from './mech-kit.js';
export { lathed };

const r3 = (v) => Math.round(v * 1000) / 1000;
const P = (p) => ({ x: r3(p[0]), y: r3(p[1]), z: r3(p[2]) });
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const VALUE = { 'tech:body': '#9a9a9a', 'tech:frame': '#6e6e6e', 'tech:skin': '#b8b8b8', 'tech:trim': '#808080', 'tech:light': '#e6e6e6', 'tech:glass': '#262626' };

export const PART_KINDS = Object.freeze({
  limbs: 'jointed legs in pairs along the core: a hip, an upper segment out and up to a knee, a lower down to a foot',
  tracks: 'a track run down each side, the core riding on them',
  wheels: 'wheels in pairs (axles) along the core, each turning',
  skirt: 'a cushion skirt under the core, wider than it',
  pods: 'rounded pods along x (a head at the front, engines or fans at the rear), in pairs or one on the centreline',
  cabin: 'a smaller mass on the core\'s top (a house, a cab)',
  fin: 'a blade at the rear (a rudder, a tail)',
  plinth: 'a dressed base the core stands on',
  deck: 'a disc at the core\'s top',
  mast: 'a pole from the top and the beacon on it, turning (unless the thing lights: then its crown is the deck)',
  piers: 'columns down from a span\'s ends to the ground',
  pedestal: 'a ring the core turns on',
  barrels: 'barrels out of the core\'s front, each pitching',
  sail: 'a mast from the core\'s top and a sail on it',
  stack: 'a smokestack on the core\'s top: it burns to go',
  oars: 'oars down each side into the water',
  mass: 'a mass placed by data: a loft along x, tapered to its front, a glass band round it if asked (a cab, a cabin, a tank, a seat)',
  drum: 'a round mass between two points (a boiler, an engine, a stack, a lamp)',
  tube: 'a tube along points, mirrored if asked (a frame, shafts, a pole, handlebars, rods)',
  tray: 'an open bed: walls round a floor, open to the sky',
  arches: 'an arch over every wheel on the ground: the well it turns in',
  lamps: 'a pair of lamps looking forward',
  band: 'a glass sleeve round the core between two heights: a row of windows',
  rails: 'the rails it runs on, on their sleepers',
  bogies: 'a bogie under each end, turning, its wheelsets on the rails',
});

/** The rows. Dimensions in metres at true size; the style's exaggeration and the thing's own scale multiply them. */
export const BODY_PLANS = Object.freeze({
  'vehicle/walker': { core: { axis: 'x', dims: [3.2, 2.2, 1.5], lift: 2.4, front: [0.7, 0.62, -0.08], rear: [0.88, 0.85, 0], role: 'body' },
    parts: [{ kind: 'pods', at: 'front', r: 0.56, len: 0.95, role: 'sensor', group: 'tech:skin', name: 'head' }, { kind: 'limbs', pairs: 2, spread: 0.6, out: 1.05, up: 0.55, r: 0.36, foot: 'claw' }] },
  'vehicle/tracked': { core: { axis: 'x', dims: [4.6, 2.3, 1.0], lift: 0.7, front: [0.86, 0.7, -0.05], rear: [0.94, 0.9, 0], role: 'body' },
    parts: [{ kind: 'tracks', r: 0.42, w: 0.55 }] },
  'vehicle/hover': { core: { axis: 'x', dims: [3.8, 2.0, 0.9], lift: 0.8, front: [0.7, 0.7, -0.05], rear: [0.9, 0.9, 0], role: 'body' }, lead: 'skirt',
    parts: [{ kind: 'skirt', h: 0.8, grow: 1.14 }, { kind: 'pods', at: 'rear', r: 0.34, len: 0.5, pair: true, role: 'running', name: 'fans' }] },
  'vehicle/ship': { core: { axis: 'x', dims: [16, 4.6, 2.4], lift: 0, front: [0.16, 0.9, 0.12], rear: [0.82, 0.95, 0], role: 'body' }, mounts: ['water'],
    parts: [{ kind: 'cabin', at: -0.28, dims: [0.25, 0.7, 0.9] }, { kind: 'fin', role: 'running', l: 1.6, h: 2.2, name: 'rudder' }, { kind: 'sail', when: 'sail', h: 11 }, { kind: 'stack', when: 'stack', r: 0.55, h: 3 }, { kind: 'oars', unless: ['sail', 'stack'], n: 5 }] },
  'structure/tower': { core: { axis: 'z', dims: [18, 2.4, 1.3], lift: 1.4, role: 'body' },
    parts: [{ kind: 'plinth', grow: 2.3, h: 1.4 }, { kind: 'deck', r: 2.5, h: 0.6 }, { kind: 'mast', h: 4, r: 0.32 }] },
  'structure/gate': { core: { axis: 'y', dims: [14, 3.2, 3.2], lift: 10, role: 'span', group: 'tech:skin' }, lead: 'core',
    parts: [{ kind: 'piers', w: 2.35, inset: 1.2 }] },
  // ── combined machines: what carries people and goods on wheels, on rails, on two wheels, drawn ──
  'vehicle/wheeled': { variants: [
    { name: 'truck', when: ['truck', 'cargo'],
      core: { axis: 'x', dims: [6.4, 2.3, 0.5], lift: 0.62, front: [1, 1, 0], rear: [1, 1, 0], role: 'body', section: 'riveted', group: 'tech:frame' },
      parts: [{ kind: 'wheels', at: [-0.345, -0.18, 0.33], r: 0.5, w: 0.34, under: true, steer: 'front' }, { kind: 'arches', clear: 1.1, optional: true },
        { kind: 'mass', name: 'cab', at: [2.15, 0, { top: 0 }], dims: [1.8, 2.3, 1.75], taper: [0.92, 0.94, -0.02], glass: [0.5, 0.9] },
        { kind: 'tray', name: 'bed', piece: 'core', at: [-0.95, 0, { top: 0 }], dims: [4.1, 2.3, 0.8], wall: 0.08 },
        { kind: 'lamps', at: [{ front: 0.02 }, 0.8, 0.82], r: 0.12 }] },
    { name: 'bus', when: 'bus',
      core: { axis: 'x', dims: [10.5, 2.5, 2.5], lift: 0.42, front: [0.98, 0.97, 0], rear: [0.99, 0.98, 0], role: 'body', section: 'riveted' },
      parts: [{ kind: 'wheels', at: [-0.31, 0.31], r: 0.5, w: 0.32, under: true, steer: 'front' }, { kind: 'arches', clear: 1.08, optional: true }, { kind: 'band', z: [0.48, 0.86], len: 0.97 },
        { kind: 'lamps', at: [{ front: 0 }, 0.9, 0.85], r: 0.13 }] },
    { name: 'apc', when: ['apc', 'armour'],
      core: { axis: 'x', dims: [6, 2.5, 1.4], lift: 0.72, front: [0.66, 0.78, 0.06], rear: [0.9, 0.95, 0], role: 'body', section: 'faceted' },
      parts: [{ kind: 'wheels', at: [-0.36, -0.12, 0.12, 0.36], r: 0.56, w: 0.38, under: true, steer: 'front' }, { kind: 'lamps', at: [{ front: -0.25 }, 0.8, 1.55], r: 0.1 }] },
    { name: 'car',
      core: { axis: 'x', dims: [4.4, 1.86, 0.6], lift: 0.32, front: [0.94, 0.72, -0.12], rear: [0.98, 0.9, 0.03], role: 'body' },
      parts: [{ kind: 'wheels', at: [-0.32, 0.32], r: 0.36, w: 0.25, under: true, steer: 'front' }, { kind: 'arches', clear: 1.08, optional: true },
        { kind: 'mass', name: 'cabin', at: [-0.25, 0, { top: -0.04 }], dims: [2.3, 1.7, 0.72], taper: [0.9, 0.5, -0.25], rearTaper: [0.92, 0.62, -0.19], glass: [0.22, 0.94] },
        { kind: 'lamps', at: [{ front: 0.02 }, 0.6, 0.58], r: 0.11 }] },
  ] },
  'vehicle/rail': { variants: [
    { name: 'locomotive', when: ['locomotive', 'stack'], lead: ['boiler', 'cab'],
      core: { axis: 'x', dims: [9, 2.3, 0.3], lift: 1.35, front: [1, 1, 0], rear: [1, 1, 0], role: 'body', section: 'riveted', group: 'tech:frame' },
      parts: [{ kind: 'rails', gauge: 1.435, h: 0.17, len: 1.3 },
        { kind: 'wheels', name: 'drivers', x: [-2.1, -0.4, 1.3], r: 0.8, w: 0.14, on: 'rail', gauge: 1.5 },
        { kind: 'wheels', name: 'pilot', x: [3.3], r: 0.42, w: 0.12, on: 'rail', gauge: 1.5 },
        { kind: 'drum', name: 'boiler', from: [-1.6, 0, 2.35], to: [3.6, 0, 2.35], r: 0.85, profile: [[0, 1], [0.92, 1], [0.93, 1.06], [1, 1.06]], role: 'source', group: 'tech:body' },
        { kind: 'drum', name: 'stack', from: [3.0, 0, 3.0], to: [3.0, 0, 4.25], r: 0.3, profile: [[0, 1], [0.7, 0.9], [0.85, 1.3], [1, 1.2]], role: 'source', group: 'tech:frame' },
        { kind: 'drum', name: 'dome', from: [0.9, 0, 3.0], to: [0.9, 0, 3.5], r: 0.4, profile: [[0, 1], [0.5, 0.95], [1, 0.4]], role: 'source', group: 'tech:trim' },
        { kind: 'mass', name: 'cab', at: [-3.2, 0, { top: 0 }], dims: [2.4, 2.7, 2.5], glass: [0.45, 0.85], section: 'riveted' },
        { kind: 'mass', name: 'pilot-beam', at: [4.35, 0, 0.35], dims: [0.9, 2.3, 0.9], taper: [0.12, 0.55, -0.3], section: 'faceted', role: 'frame', group: 'tech:frame' },
        { kind: 'tube', name: 'rods', path: [[-2.1, 0.95, 1.0], [1.3, 0.95, 1.0]], r: 0.06, mirror: true, role: 'running' },
        { kind: 'drum', name: 'headlamp', from: [4.05, 0, 3.0], to: [4.3, 0, 3.0], r: 0.2, profile: [[0, 0.8], [1, 1]], role: 'lamp', group: 'tech:light' }] },
    { name: 'train',
      core: { axis: 'x', dims: [13, 2.7, 2.8], lift: 1.15, front: [0.96, 0.9, 0], rear: [0.96, 0.9, 0], role: 'body', section: 'riveted' },
      parts: [{ kind: 'rails', gauge: 1.435, h: 0.17, len: 1.25 }, { kind: 'bogies', at: [-0.7, 0.7], gauge: 1.435, r: 0.46, span: 2.3 },
        { kind: 'band', z: [0.45, 0.8], len: 0.95 }, { kind: 'lamps', at: [{ front: 0 }, 0.85, 1.6], r: 0.12 }] },
  ] },
  'vehicle/drawn': { variants: [
    { name: 'chariot', when: 'chariot',
      core: { axis: 'x', dims: [1.3, 1.25, 0.3], lift: 0.55, front: [0.8, 0.9, 0], rear: [1, 1, 0], role: 'body', section: 'faceted' },
      parts: [{ kind: 'wheels', at: [-0.15], r: 0.62, w: 0.1, driven: 'muscle' },
        { kind: 'mass', name: 'guard', at: [0.5, 0, { top: 0 }], dims: [0.3, 1.25, 0.75], taper: [0.6, 1, -0.05] },
        { kind: 'tube', name: 'pole', path: [[0.6, 0, 0.62], [2.9, 0, 0.95]], r: 0.05, role: 'mount' },
        { kind: 'tube', name: 'yoke', path: [[2.9, -0.65, 1.0], [2.9, 0, 0.95], [2.9, 0.65, 1.0]], r: 0.05, role: 'mount' }] },
    { name: 'coach', when: ['coach', 'carriage'], lead: 'body',
      core: { axis: 'x', dims: [3.6, 1.7, 0.3], lift: 0.88, front: [1, 1, 0], rear: [1, 1, 0], role: 'frame', section: 'riveted', group: 'tech:frame' },
      parts: [{ kind: 'wheels', name: 'hind', at: [-0.33], r: 0.65, w: 0.1, driven: 'muscle' }, { kind: 'wheels', name: 'fore', at: [0.33], r: 0.48, w: 0.1, driven: 'muscle', steer: 0 },
        { kind: 'mass', name: 'body', at: [-0.2, 0, { top: 0 }], dims: [2.3, 1.6, 1.55], glass: [0.42, 0.82] },
        { kind: 'mass', name: 'bench', at: [1.35, 0, { top: 0.55 }], dims: [0.55, 1.4, 0.18], role: 'frame', group: 'tech:frame' },
        { kind: 'lamps', at: [1.1, 0.88, 2.05], r: 0.08 },
        { kind: 'tube', name: 'pole', path: [[1.8, 0, 0.95], [3.8, 0, 1.0]], r: 0.05, role: 'mount' }] },
    { name: 'wagon', when: ['wagon', 'caravan'], lead: 'cover',
      core: { axis: 'x', dims: [3.8, 1.6, 0.28], lift: 0.82, front: [1, 1, 0], rear: [1, 1, 0], role: 'body', section: 'riveted', group: 'tech:frame' },
      parts: [{ kind: 'wheels', name: 'hind', at: [-0.32], r: 0.62, w: 0.11, driven: 'muscle' }, { kind: 'wheels', name: 'fore', at: [0.32], r: 0.46, w: 0.11, driven: 'muscle', steer: 0 },
        { kind: 'tray', name: 'bed', at: [0, 0, { top: 0 }], dims: [3.8, 1.6, 0.5], wall: 0.06 },
        { kind: 'mass', name: 'cover', at: [-0.15, 0, { top: 0.4 }], dims: [3.1, 1.75, 1.35], section: 'arch', role: 'shell', group: 'tech:skin' },
        { kind: 'tube', name: 'pole', path: [[1.9, 0, 0.9], [3.9, 0, 1.0]], r: 0.05, role: 'mount' }] },
    { name: 'cart',
      core: { axis: 'x', dims: [2.3, 1.4, 0.22], lift: 0.62, front: [1, 1, 0], rear: [1, 1, 0], role: 'body', section: 'riveted', group: 'tech:frame' },
      parts: [{ kind: 'wheels', at: [-0.05], r: 0.66, w: 0.12, driven: 'muscle' },
        { kind: 'tray', name: 'bed', piece: 'core', at: [0, 0, { top: 0 }], dims: [2.3, 1.4, 0.5], wall: 0.06 },
        { kind: 'tube', name: 'shafts', path: [[1.1, 0.5, 0.75], [3.1, 0.5, 0.85]], r: 0.05, mirror: true, role: 'mount' }] },
  ] },
  'vehicle/cycle': { variants: [
    { name: 'motorcycle', when: 'motorcycle', lead: 'wheels',
      core: { axis: 'x', dims: [0.62, 0.32, 0.24], lift: 0.8, front: [0.7, 0.8, 0.08], rear: [0.75, 0.85, -0.06], role: 'body' },
      parts: [{ kind: 'tube', name: 'fork', path: [[0.74, 0.11, 0.32], [0.5, 0.11, 0.98]], r: 0.03, mirror: true },
        { kind: 'tube', name: 'bars', path: [[0.46, -0.4, 1.1], [0.5, 0, 1.02], [0.46, 0.4, 1.1]], r: 0.022 },
        { kind: 'wheels', inline: true, x: [-0.74, 0.74], r: 0.32, w: 0.13, prefer: ['wire'], steer: 'front', steerWith: ['fork', 'bars', 'headlamp'] },
        { kind: 'tube', name: 'frame', path: [[-0.74, 0, 0.32], [-0.4, 0, 0.5], [0.15, 0, 0.42], [0.5, 0, 0.95]], r: 0.035 },
        { kind: 'mass', name: 'engine', at: [0.02, 0, 0.3], dims: [0.52, 0.34, 0.38], section: 'faceted', role: 'source', group: 'tech:frame' },
        { kind: 'mass', name: 'seat', at: [-0.5, 0, 0.84], dims: [0.55, 0.28, 0.1], role: 'frame', group: 'tech:frame' },
        { kind: 'tube', name: 'exhaust', path: [[0.1, 0.2, 0.25], [-0.3, 0.24, 0.3], [-0.85, 0.24, 0.48]], r: 0.04, group: 'tech:trim' },
        { kind: 'drum', name: 'headlamp', from: [0.56, 0, 0.92], to: [0.68, 0, 0.92], r: 0.1, profile: [[0, 0.7], [1, 1]], role: 'lamp', group: 'tech:light' }] },
    { name: 'bicycle', lead: 'wheels',
      core: { axis: 'x', dims: [0.6, 0.05, 0.05], lift: 0.85, front: [1, 1, 0.1], rear: [1, 1, 0], role: 'body', group: 'tech:frame' },
      parts: [{ kind: 'tube', name: 'fork', path: [[0.4, 0.04, 0.92], [0.53, 0.04, 0.34]], r: 0.015, mirror: true },
        { kind: 'tube', name: 'bars', path: [[0.36, -0.26, 1.06], [0.4, 0, 1.0], [0.36, 0.26, 1.06]], r: 0.014 },
        { kind: 'tube', name: 'stem', path: [[0.39, 0, 0.84], [0.4, 0, 1.0]], r: 0.016 },
        { kind: 'wheels', inline: true, x: [-0.53, 0.53], r: 0.34, w: 0.04, driven: 'muscle', steer: 'front', steerWith: ['fork', 'bars', 'stem'] },
        { kind: 'tube', name: 'down-tube', path: [[0.38, 0, 0.86], [-0.02, 0, 0.32]], r: 0.02 },
        { kind: 'tube', name: 'seat-tube', path: [[-0.02, 0, 0.32], [-0.25, 0, 0.94]], r: 0.018 },
        { kind: 'tube', name: 'chain-stay', path: [[-0.02, 0.04, 0.32], [-0.53, 0.05, 0.34]], r: 0.012, mirror: true },
        { kind: 'tube', name: 'seat-stay', path: [[-0.23, 0.03, 0.88], [-0.53, 0.05, 0.36]], r: 0.011, mirror: true },
        { kind: 'drum', name: 'chainring', from: [-0.02, -0.07, 0.32], to: [-0.02, -0.05, 0.32], r: 0.1, role: 'running', group: 'tech:trim' },
        { kind: 'mass', name: 'seat', at: [-0.27, 0, 0.97], dims: [0.26, 0.13, 0.06], role: 'frame', group: 'tech:frame' }] },
  ] },
  'weapon/turret': { core: { axis: 'x', dims: [2.7, 2.2, 1.3], lift: 0.75, front: [0.8, 0.75, 0], rear: [0.95, 0.95, 0], role: 'mount' },
    parts: [{ kind: 'pedestal', r: 1.25, h: 0.75 }, { kind: 'barrels', r: 0.14, len: 2.6 }] },
  'weapon/cannon': { core: { axis: 'x', dims: [1.6, 0.75, 0.5], lift: 0.5, front: [0.8, 0.8, 0], rear: [0.6, 0.6, -0.1], role: 'mount', group: 'tech:frame' }, lead: 'wheels',
    parts: [{ kind: 'wheels', axles: 1, r: 0.62, w: 0.12, at: [0.05] }, { kind: 'barrels', r: 0.17, len: 2.2, raise: 0.12 }] },
});

// ── the solver ──────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The variant of a row a thing takes: a row with `variants` takes the first whose `when` (a dial its words set, or its
 * variant's name; or a list of either) the thing answers, the last having no `when`. → { row, variant }
 */
export function variantOf(row, t) {
  if (!row.variants) return { row, variant: null };
  const d = t.dials ?? {}, hit = (w) => (Array.isArray(w) ? w.some(hit) : !!d[w] || t.variant === w);
  const v = row.variants.find((x) => x.when === undefined || hit(x.when));
  const { variants, ...base } = row, { when, name, ...over } = v;
  return { row: { ...base, ...over }, variant: name };
}

export function solveBodyPlan(row0, t, { motif = 'smooth', scale = 1, fit, fitLen, fitArc = fitLen, smooth = false, thick = {}, tuck = 1, setting = DEFAULT_SETTING, pxPerM = 0, drop = [] } = {}) {
  const { row, variant } = variantOf(row0, t), s = scale, m = motif, d = t.dials ?? {}, fns = t.block?.functions ?? [];
  const lofts = [], lathes = [], sweeps = [], extrudes = [], joints = [], pieces = {}, masses = [], detail = [], mechanisms = [], wheels = [];
  const ARR = { lofts, lathes, sweeps, extrudes };
  // a mechanism from the kit (mech-kit.js), dressed by the setting: its cage joins the chassis, its detail is kept for
  // the bake, its joints join the rig
  const kit = (need) => {
    const M = resolveMechanism(need, { setting, motif: m, fit, fitLen, smooth, pxPerM });
    for (const x of M.cage) { ARR[x.kind].push({ ...x.spec, group: x.group, tint: VALUE[x.group] ?? '#888888' }); pieces[x.spec.id] = { piece: x.piece, role: x.role, gear: true }; if (x.mass) masses.push({ id: x.spec.id, piece: x.piece, role: x.role, ...x.mass }); }
    detail.push(...M.detail);
    joints.push(...M.joints);
    mechanisms.push({ id: need.id, mechanism: M.mechanism, dress: M.dress, why: M.why, refused: M.refused, promoted: M.promoted, ...(need.driven ? { driven: need.driven } : {}), ...(M.lift ? { lift: M.lift } : {}) });
    return M;
  };
  const k = (id) => thick[id] ?? 1;
  // a section's points by its own outline: a squared round is longer than the circle its half-sides make
  const fitS = (mm, w, h) => { const q = section(mm, w, h, 64); let per = 0; q.forEach((a, i) => { const b = q[(i + 1) % q.length]; per += Math.hypot(b[0] - a[0], b[1] - a[1]); }); return fit(per / (2 * Math.PI)); };
  // a monomer, its piece and role, and the mass the sockets are read off (a box, or a segment a → b of radius r)
  // (a monomer marked `ground` is what the thing stands on, its rails: drawn and counted, never its silhouette)
  const mono = (arr, spec0, piece, role, group, mass) => {
    const g = group ?? 'tech:frame', { ground, ...spec } = spec0;
    arr.push({ ...lathed(spec, fit, fitLen, smooth), group: g, tint: VALUE[g] ?? '#888888' });
    pieces[spec.id] = { piece, role, ...(ground ? { ground: true } : {}) };
    if (mass) masses.push({ id: spec.id, piece, role, ...mass });
  };
  const lathe = (id, a, b, profile, fitR, piece, role, group, mass) => mono(lathes, { id, axisFrom: P(a), axisTo: P(b), profile: profile.map((p) => ({ t: p[0], radius: r3(p[1]) })), fitR }, piece, role, group, mass);
  const C = row.core, ck = k('core'), coreRole = C.role ?? 'body', coreGroup = C.group ?? 'tech:body';
  let [L, W, H] = C.dims.map((v) => v * s * ck);
  if (C.axis === 'z') { L = C.dims[0] * s * (d.tall ? 1.35 : 1); W = C.dims[1] * s * ck; H = C.dims[2] * s * ck; }
  const lift = C.lift * s, box = (lo, hi) => ({ box: { lo: lo.map(r3), hi: hi.map(r3) } });
  const dims = {};
  // a place given by data, in metres at true size (scaled): z a height above the ground, or { top: dz } over the core
  // (x may be { front: dx } or { rear: dx }: from the core's nose or tail)
  const at3 = ([x, y, z]) => [typeof x === 'object' ? (x.front !== undefined ? dims.L / 2 + x.front * s : -dims.L / 2 - (x.rear ?? 0) * s) : x * s, y * s, typeof z === 'object' ? dims.lift + dims.H + (z.top ?? 0) * s : z * s];

  // ── the core ──
  if (C.axis === 'x') {
    // a core may keep its own section whatever the motif (a carriage's flat sides): `section`, a motif's name
    const cs = C.section ?? m, zc = lift + H / 2, fr = C.front ?? [0.8, 0.8, 0], re = C.rear ?? [0.9, 0.9, 0], n = fitS(cs, W, H);
    const st = (tt, [ws, hs, dz]) => ({ t: tt, profile: { points: section(cs, W * ws, H * hs, n).map(([u, v]) => [u, r3(v + dz * H)]) } });
    mono(lofts, { id: 'core', interp: 'smooth', segments: fitArc(L / 2, (Math.max(1 - Math.min(fr[0], fr[1]), 1 - Math.min(re[0], re[1])) * Math.max(W, H)) / 8), axisFrom: P([-L / 2, 0, zc]), axisTo: P([L / 2, 0, zc]), stations: [st(0, re), { t: 0.55, profile: { points: section(cs, W, H, n) } }, st(1, fr)] }, 'core', coreRole, coreGroup, box([-L / 2, -W / 2, lift], [L / 2, W / 2, lift + H]));
    Object.assign(dims, { L, W, H, lift, zc });
  } else if (C.axis === 'y') {
    const zc = lift + H / 2, n = fitS(m === 'smooth' ? 'faceted' : m, W, H);
    mono(lofts, { id: 'core', axisFrom: P([0, -L / 2, zc]), axisTo: P([0, L / 2, zc]), stations: [{ t: 0, profile: { points: section(m === 'smooth' ? 'faceted' : m, W, H, n) } }, { t: 1, profile: { points: section(m === 'smooth' ? 'faceted' : m, W, H, n) } }] }, 'core', coreRole, coreGroup, box([-W / 2, -L / 2, lift], [W / 2, L / 2, lift + H]));
    Object.assign(dims, { L, W, H, lift, zc });
  } else {
    // a thing that rises: base width W to top width H (half-widths), from its lift to its top, solid or a lattice
    const top = L - 1.2 * s, w0 = W, w1 = H;
    if (d.lattice || C.lattice) {
      const bays = Math.max(3, Math.round((top - lift) / (3.6 * s))), legR = 0.22 * s * ck, sides = Math.max(5, fit(legR));
      const corner = (i, z) => { const a = Math.PI / 4 + (i * Math.PI) / 2, w = w0 + (w1 - w0) * ((z - lift) / (top - lift)); return [r3(Math.cos(a) * w), r3(Math.sin(a) * w), r3(z)]; };
      for (let i = 0; i < 4; i++) mono(sweeps, { id: `core-leg-${i + 1}`, path: [corner(i, lift), corner(i, top)], radius: r3(legR), sides }, 'core', 'frame', 'tech:frame');
      for (let b = 0; b < bays; b++) for (let i = 0; i < 4; i++) {
        const z0 = lift + ((top - lift) * b) / bays, z1 = lift + ((top - lift) * (b + 1)) / bays, j = (i + 1) % 4;
        mono(sweeps, { id: `core-brace-${b + 1}-${i + 1}`, path: [corner(b % 2 ? i : j, z0), corner(b % 2 ? j : i, z1)], radius: r3(legR * 0.6), sides: Math.max(4, sides - 1) }, 'core', 'frame', 'tech:frame');
      }
      masses.push({ id: 'core-leg-1', piece: 'core', role: 'frame', box: { lo: [-w0, -w0, lift].map(r3), hi: [w0, w0, top].map(r3) } });
    } else {
      const n = fit(w0);
      mono(lofts, { id: 'core', axisFrom: P([0, 0, lift]), axisTo: P([0, 0, top]), stations: [{ t: 0, profile: { points: section(m, 2 * w0, 2 * w0, n) } }, { t: 1, profile: { points: section(m, 2 * w1, 2 * w1, n) } }] }, 'core', coreRole, coreGroup, box([-w0, -w0, lift], [w0, w0, top]));
    }
    Object.assign(dims, { top, w0, w1, lift, lattice: !!(d.lattice || C.lattice) });
  }
  joints.push({ id: 'core', parent: null, pivot: C.axis === 'x' ? [0, 0, r3(dims.zc)] : [0, 0, r3(lift)], axis: [0, 0, 1], range: C.axis === 'x' ? [-12, 12] : [0, 0], pieces: [] });
  const onCore = joints[0].pieces;

  // ── the parts ──
  const lights = fns.includes('light');
  // a row's optional parts are its own 33: the solver may drop them, last first, when the thing says too much
  const optional = row.parts.filter((p) => p.optional).map((p) => p.name ?? p.kind);
  for (const p of row.parts.filter((q) => !(q.optional && drop.includes(q.name ?? q.kind)))) {
    if (p.when && !d[p.when]) continue;
    if (p.unless && p.unless.some((u) => d[u])) continue;
    if (p.kind === 'limbs') {
      const r = p.r * s * k('limbs');
      for (let i = 0; i < p.pairs; i++) for (const [sy, side] of [[-1, 'l'], [1, 'r']]) {
        const fx = p.pairs === 1 ? 0 : i === 0 ? 1 : -1, leg = `${p.pairs === 1 ? '' : i === 0 ? 'f' : 'b'}${side}`, hip = [fx * dims.L * p.spread * tuck / 2, sy * dims.W * 0.45, dims.lift + 0.25 * s];
        const knee = add(hip, [fx * 0.25 * s * tuck, sy * p.out * s * tuck, p.up * s * tuck]), ankle = add(knee, [fx * 0.1 * s * tuck, sy * 0.35 * s * tuck, -(knee[2] - 0.35 * s)]), piece = `limb-${leg}`;
        lathe(`hip-${leg}`, add(hip, [0, -sy * 0.2 * s, 0]), add(hip, [0, sy * 0.35 * s, 0]), [[0, r * 0.9], [0.5, r * 1.25], [1, r * 0.9]], r * 1.25, piece, 'joint', 'tech:frame');
        mono(lofts, { id: `upper-${leg}`, axisFrom: P(hip), axisTo: P(knee), stations: [{ t: 0, profile: { points: section(m, r * 1.6, r * 1.9, fitS(m, r * 1.6, r * 1.9)) } }, { t: 1, profile: { points: section(m, r * 1.25, r * 1.4, fitS(m, r * 1.6, r * 1.9)) } }] }, piece, 'running', 'tech:frame', { seg: [hip, knee], r, out: [0, sy, 0] });
        lathe(`knee-${leg}`, add(knee, [-0.3 * s, 0, 0]), add(knee, [0.3 * s, 0, 0]), [[0, r * 0.8], [0.5, r * 1.05], [1, r * 0.8]], r * 1.05, piece, 'joint', 'tech:frame');
        mono(lofts, { id: `lower-${leg}`, axisFrom: P(knee), axisTo: P(ankle), stations: [{ t: 0, profile: { points: section(m, r * 1.4, r * 1.6, fitS(m, r * 1.4, r * 1.6)) } }, { t: 0.7, profile: { points: section(m, r * 1.05, r * 1.15, fitS(m, r * 1.4, r * 1.6)) } }, { t: 1, profile: { points: section(m, r * 0.85, r * 0.9, fitS(m, r * 1.4, r * 1.6)) } }] }, piece, 'running', 'tech:frame', { seg: [knee, ankle], r, out: [fx || 1, 0, 0] });
        const foot = [ankle[0], ankle[1], 0], fz = 0.3 * s, feet = [`foot-${leg}`];
        mono(extrudes, { id: `foot-${leg}`, profile: { points: [[-0.3, -0.25], [0.3, -0.25], [0.38, 0], [0.3, 0.25], [-0.3, 0.25], [-0.38, 0]].map(([u, v]) => [r3(foot[0] + u * s), r3(foot[1] + v * s)]) }, axisFrom: P([0, 0, 0]), axisTo: P([0, 0, fz]) }, piece, 'running', 'tech:trim');
        if (p.foot === 'claw') for (const [j, deg] of [[1, -38], [2, 0], [3, 38]]) {
          const a = Math.atan2(sy * 0.6, fx || 0.0001) + (deg * Math.PI) / 180, dd = [Math.cos(a), Math.sin(a)], q = [-dd[1], dd[0]];
          mono(extrudes, { id: `toe-${leg}-${j}`, profile: { points: [[0.15, -0.14], [0.82, 0], [0.15, 0.14]].map(([l, w]) => [r3(foot[0] + (dd[0] * l + q[0] * w) * s), r3(foot[1] + (dd[1] * l + q[1] * w) * s)]) }, axisFrom: P([0, 0, 0]), axisTo: P([0, 0, fz * 0.75]) }, piece, 'running', 'tech:trim');
          feet.push(`toe-${leg}-${j}`);
        }
        joints.push({ id: `hip-${leg}`, parent: 'core', pivot: hip.map(r3), axis: [1, 0, 0], range: [-25, 35], pieces: [`hip-${leg}`, `upper-${leg}`] });
        joints.push({ id: `knee-${leg}`, parent: `hip-${leg}`, pivot: knee.map(r3), axis: [1, 0, 0], range: [-30, 40], pieces: [`knee-${leg}`, `lower-${leg}`, ...feet] });
      }
    } else if (p.kind === 'tracks') {
      // a track down each side (the kit's: sprocket, idler, road wheels, the belt round them), the core riding on them
      const r = p.r * s * k('tracks'), len = dims.L * 0.98;
      for (const [sy, side] of [[-1, 'l'], [1, 'r']]) {
        const yi = sy * (dims.W / 2 - p.w * s * 0.3), yo = yi + sy * p.w * s;
        kit({ mechanism: 'track', id: `track-${side}`, piece: `track-${side}`, x: [-len / 2, len / 2], y: [yi, yo], r });
        onCore.push(`track-${side}`);
      }
    } else if (p.kind === 'wheels') {
      // wheels in axles along the core: a pair to each (or one, `inline`, a cycle's), out beside the core or `under` its
      // sides in wells; the axle at `steer` turns about the vertical, carrying its wheels' spin
      // axles at `x` (metres) or `at` (shares of the core's length); on the ground, or on the rails (`on: 'rail'`)
      const r = p.r * s * k('wheels'), w = p.w * s, z0 = p.on === 'rail' ? dims.railTop ?? 0 : 0, xs = p.x ? p.x.map((v) => (v * s) / dims.L) : p.at ?? Array.from({ length: p.axles }, (_, i) => (p.axles === 1 ? 0 : -0.4 + (0.8 * i) / (p.axles - 1)));
      const sides = p.inline ? [[1, '']] : [[-1, 'l'], [1, 'r']];
      xs.forEach((fx, i) => {
        const cx = fx * dims.L, steer = p.steer !== undefined && (p.steer === i || (p.steer === 'front' && i === xs.length - 1));
        for (const [sy, side] of sides) {
          const y = p.inline ? 0 : p.gauge ? sy * (p.gauge * s) / 2 : sy * (p.under ? dims.W / 2 - w * 0.35 : dims.W / 2 + w * 0.6), id = `${p.name ?? 'wheel'}${side ? `-${side}` : ''}${xs.length > 1 ? `${side ? '' : '-'}${i + 1}` : ''}`;
          const M = kit({ mechanism: 'wheel', id, piece: p.name ?? 'wheels', centre: [cx, y, z0 + r], axle: [0, p.inline ? 1 : sy, 0], r, w, on: p.on, driven: p.driven, prefer: p.prefer });
          wheels.push({ id, x: cx, y, r, w, sy: p.inline ? 0 : sy, lift: M.lift, rail: p.on === 'rail' });
          if (steer) {
            // what turns with the wheel (a fork, a handlebar) is named by the row
            joints.push({ id: `steer-${id}`, parent: 'core', pivot: [r3(cx), r3(y), r3(z0 + r)], axis: [0, 0, 1], range: [-32, 32], pieces: (p.steerWith ?? []).flatMap((x) => [x, `${x}-2`]).filter((x) => pieces[x]) });
            for (const j of M.joints) j.parent = `steer-${id}`;
          }
        }
      });
    } else if (p.kind === 'skirt') {
      const g = p.grow * k('skirt'), n = fitS(m, dims.W * g, p.h * s);
      mono(lofts, { id: 'skirt', axisFrom: P([-dims.L * g / 2, 0, (p.h * s) / 2]), axisTo: P([dims.L * g / 2, 0, (p.h * s) / 2]), stations: [{ t: 0, profile: { points: section(m, dims.W * g, p.h * s, n) } }, { t: 1, profile: { points: section(m, dims.W * g * 0.8, p.h * s, n) } }] }, 'skirt', 'running', 'tech:frame', box([-dims.L * g / 2, -dims.W * g / 2, 0], [dims.L * g / 2, dims.W * g / 2, p.h * s]));
      onCore.push('skirt');
    } else if (p.kind === 'pods') {
      const r = p.r * s * k(p.name ?? 'pod'), len = p.len * s, front = p.at === 'front', x0 = front ? dims.L / 2 - 0.2 * s : -dims.L / 2 - len * 0.8, ys = p.pair ? [-dims.W * 0.3, dims.W * 0.3] : [0];
      ys.forEach((y, i) => { const id = `${p.name ?? 'pod'}${ys.length > 1 ? `-${i ? 'r' : 'l'}` : ''}`, z = front ? dims.zc - 0.05 * s : dims.lift + dims.H + r * 0.6;
        lathe(id, [x0, y, z], [x0 + len, y, z], front ? [[0, r * 0.9], [0.45, r], [1, r * 0.4]] : [[0, r * 0.85], [0.5, r], [1, r * 0.9]], r, p.name ?? 'pod', p.role ?? 'running', p.group ?? 'tech:frame', box([x0, y - r, z - r], [x0 + len, y + r, z + r]));
        onCore.push(id); });
    } else if (p.kind === 'cabin') {
      const [cl, cw, ch] = [p.dims[0] * dims.L * k('cabin'), p.dims[1] * dims.W, p.dims[2] * 2.4 * s * k('cabin')], cx = p.at * dims.L, z0 = dims.lift + dims.H, n = fitS(m, cw, ch);
      mono(lofts, { id: 'cabin', axisFrom: P([cx - cl / 2, 0, z0 + ch / 2]), axisTo: P([cx + cl / 2, 0, z0 + ch / 2]), stations: [{ t: 0, profile: { points: section(m, cw, ch, n) } }, { t: 1, profile: { points: section(m, cw * 0.9, ch * 0.9, n) } }] }, 'cabin', 'body', 'tech:skin', box([cx - cl / 2, -cw / 2, z0], [cx + cl / 2, cw / 2, z0 + ch]));
      onCore.push('cabin');
    } else if (p.kind === 'fin') {
      const x = -dims.L / 2, l = p.l * s, h = p.h * s;
      mono(extrudes, { id: p.name ?? 'fin', profile: { points: [[x, 0], [x - l, 0], [x, h]].map(([a, b]) => [r3(-a), r3(b)]) }, axisFrom: P([0, -0.08 * s, 0]), axisTo: P([0, 0.08 * s, 0]) }, p.name ?? 'fin', p.role ?? 'running', 'tech:frame');
      onCore.push(p.name ?? 'fin');
    } else if (p.kind === 'plinth') {
      const B = dims.w0 * p.grow, h = p.h * s, sec = m === 'smooth' ? 'faceted' : m;
      mono(lofts, { id: 'plinth', axisFrom: P([0, 0, 0]), axisTo: P([0, 0, h]), stations: [{ t: 0, profile: { points: section(sec, B, B, 8) } }, { t: 1, profile: { points: section(sec, B * 0.82, B * 0.82, 8) } }] }, 'plinth', 'mount', 'tech:trim', box([-B / 2, -B / 2, 0], [B / 2, B / 2, h]));
      onCore.push('plinth');
    } else if (p.kind === 'deck') {
      const R = p.r * s * k('deck'), z = dims.top;
      lathe('deck', [0, 0, z], [0, 0, z + p.h * s], [[0, R * 0.7], [0.35, R], [1, R * 0.95]], R, 'deck', 'frame', 'tech:skin', box([-R, -R, z], [R, R, z + p.h * s]));
      onCore.push('deck'); dims.deckTop = z + p.h * s;
    } else if (p.kind === 'mast' && !lights) {
      const z0 = dims.deckTop ?? dims.top, z1 = z0 + p.h * s, R = p.r * s;
      lathe('mast', [0, 0, z0], [0, 0, z1], [[0, R], [1, R * 0.5]], R, 'mast', 'frame', 'tech:frame');
      lathe('beacon', [0, 0, z1], [0, 0, z1 + 1.1 * s], [[0, 0.25 * s], [0.3, 0.6 * s], [0.7, 0.6 * s], [1, 0.2 * s]], 0.6 * s, 'beacon', 'beacon', 'tech:light', box([-0.6 * s, -0.6 * s, z1], [0.6 * s, 0.6 * s, z1 + 1.1 * s]));
      joints.push({ id: 'crown', parent: 'core', pivot: [0, 0, r3(z0)], axis: [0, 0, 1], range: [0, 360], pieces: ['mast', 'beacon'] });
    } else if (p.kind === 'piers') {
      const w = p.w * s * k('piers'), n = fit(w / 2), sec = m === 'smooth' ? 'faceted' : m;
      for (const [sy, side] of [[-1, 'l'], [1, 'r']]) {
        const y = sy * (dims.L / 2 - p.inset * s);
        mono(lofts, { id: `pier-${side}`, axisFrom: P([0, y, 0]), axisTo: P([0, y, dims.lift]), stations: [{ t: 0, profile: { points: section(sec, w * 1.1, w * 1.1, n) } }, { t: 1, profile: { points: section(sec, w, w, n) } }] }, `pier-${side}`, 'pier', 'tech:body', box([-w / 2, y - w / 2, 0], [w / 2, y + w / 2, dims.lift]));
        onCore.push(`pier-${side}`);
      }
    } else if (p.kind === 'pedestal') {
      const R = p.r * s, h = p.h * s;
      lathe('pedestal', [0, 0, 0], [0, 0, h], [[0, R * 1.1], [0.3, R], [1, R * 0.85]], R * 1.1, 'pedestal', 'mount', 'tech:frame', box([-R, -R, 0], [R, R, h]));
      // the pedestal stays; the core turns on it
      joints[0] = { ...joints[0], id: 'core', parent: 'pedestal', axis: [0, 0, 1], range: [0, 360] };
      joints.unshift({ id: 'pedestal', parent: null, pivot: [0, 0, 0], axis: [0, 0, 1], range: [0, 0], pieces: ['pedestal'] });
    } else if (p.kind === 'sail') {
      const x = dims.L * 0.05, z0 = dims.lift + dims.H, h = p.h * s, sw = dims.W * 1.3;
      mono(sweeps, { id: 'mast', path: [[x, 0, z0], [x, 0, z0 + h]].map((q) => q.map(r3)), radius: r3(0.16 * s), sides: Math.max(5, fit(0.16 * s)) }, 'mast', 'frame', 'tech:frame');
      mono(extrudes, { id: 'sail', profile: { points: [[-sw / 2, z0 + h * 0.25], [sw / 2, z0 + h * 0.25], [sw * 0.42, z0 + h * 0.95], [-sw * 0.42, z0 + h * 0.95]].map(([u, v]) => [r3(u), r3(v)]) }, axisFrom: P([x + 0.25 * s, 0, 0]), axisTo: P([x + 0.35 * s, 0, 0]) }, 'sail', 'running', 'tech:skin', box([x, -sw / 2, z0 + h * 0.25], [x + 0.35 * s, sw / 2, z0 + h * 0.95]));
      onCore.push('mast', 'sail');
    } else if (p.kind === 'stack') {
      const r = p.r * s, z0 = dims.lift + dims.H, x = -dims.L * 0.05;
      lathe('stack', [x, 0, z0], [x, 0, z0 + p.h * s], [[0, r], [0.85, r * 0.9], [0.92, r * 1.25], [1, r * 1.15]], r * 1.25, 'stack', 'source', 'tech:frame', box([x - r, -r, z0], [x + r, r, z0 + p.h * s]));
      onCore.push('stack');
    } else if (p.kind === 'oars') {
      for (const [sy, side] of [[-1, 'l'], [1, 'r']]) for (let i = 0; i < p.n; i++) {
        const x = -dims.L * 0.25 + i * dims.L * 0.1, a = [x, sy * dims.W / 2, dims.lift + dims.H * 0.8], b = [x - 0.6 * s, sy * (dims.W / 2 + 3.4 * s), 0];
        mono(sweeps, { id: `oar-${side}${i + 1}`, path: [a, b].map((q) => q.map(r3)), radius: r3(0.1 * s), sides: 5 }, 'oars', 'running', 'tech:frame');
      }
    } else if (p.kind === 'mass') {
      // a mass placed by data: a loft along x, its section the motif's (or its own), tapered toward its front, and a
      // glass band round it between two heights (a car's greenhouse, a cab's windows)
      const [x, y, z] = at3(p.at), [l, w, h] = p.dims.map((v) => v * s * k(p.name)), sec = p.section ?? m, n = fitS(sec, w, h), tp = p.taper ?? [1, 1, 0], zc = z + h / 2;
      const st = (tt, ws, hs, dz, grow = 1, band) => { const hh = band ? h * hs * (band[1] - band[0]) : h * hs, cz = band ? dz * h + ((band[0] + band[1] - 1) / 2) * h * hs : dz * h; return { t: tt, profile: { points: section(sec, w * ws * grow, hh, n).map(([u, v]) => [u, r3(v + cz)]) } }; };
      // tapered toward its front, and toward its rear too when it says so (`rearTaper`: a glasshouse, both screens raked)
      const rt = p.rearTaper, stations = (grow, band) => (rt ? [st(0, rt[0], rt[1], rt[2] ?? 0, grow, band), st(0.45, 1, 1, 0, grow, band), st(1, tp[0], tp[1], tp[2] ?? 0, grow, band)] : [st(0, 1, 1, 0, grow, band), st(1, tp[0], tp[1], tp[2] ?? 0, grow, band)]);
      mono(lofts, { id: p.name, axisFrom: P([x - l / 2, y, zc]), axisTo: P([x + l / 2, y, zc]), stations: stations(1) }, p.piece ?? p.name, p.role ?? 'body', p.group ?? 'tech:skin', box([x - l / 2, y - w / 2, z], [x + l / 2, y + w / 2, z + h]));
      if (p.glass) mono(lofts, { id: `${p.name}-glass`, axisFrom: P([x - l * 0.505, y, zc]), axisTo: P([x + l * 0.505, y, zc]), stations: stations(1.03, p.glass) }, p.piece ?? p.name, 'body', 'tech:glass');
      if (p.mirror) {
        mono(lofts, { id: `${p.name}-2`, axisFrom: P([x - l / 2, -y, zc]), axisTo: P([x + l / 2, -y, zc]), stations: [st(0, 1, 1, 0), st(1, tp[0], tp[1], tp[2] ?? 0)] }, p.piece ?? p.name, p.role ?? 'body', p.group ?? 'tech:skin', box([x - l / 2, -y - w / 2, z], [x + l / 2, -y + w / 2, z + h]));
      }
    } else if (p.kind === 'drum') {
      // a round mass between two points: a boiler, an engine, a tank, a lamp's body
      const a = at3(p.from), b = at3(p.to), r = p.r * s * k(p.name), prof = p.profile ?? [[0, 1], [1, 1]];
      lathe(p.name, a, b, prof.map(([tt, f]) => [tt, r * f]), r, p.piece ?? p.name, p.role ?? 'body', p.group ?? 'tech:body', box(a.map((v, i) => Math.min(v, b[i]) - (i ? r : 0)), a.map((v, i) => Math.max(v, b[i]) + (i ? r : 0))));
      if (p.mirror) lathe(`${p.name}-2`, [a[0], -a[1], a[2]], [b[0], -b[1], b[2]], prof.map(([tt, f]) => [tt, r * f]), r, p.piece ?? p.name, p.role ?? 'body', p.group ?? 'tech:body');
    } else if (p.kind === 'tube') {
      // a tube along points (a frame, shafts, a handlebar, a hoop), mirrored across the centreline when asked
      const r = p.r * s, sides = Math.max(5, fit(r)), path = p.path.map(at3);
      mono(sweeps, { id: p.name, path: path.map((q) => q.map(r3)), radius: r3(r), sides }, p.piece ?? p.name, p.role ?? 'frame', p.group ?? 'tech:frame');
      if (p.mirror) mono(sweeps, { id: `${p.name}-2`, path: path.map(([a, b, c]) => [r3(a), r3(-b), r3(c)]), radius: r3(r), sides }, p.piece ?? p.name, p.role ?? 'frame', p.group ?? 'tech:frame');
    } else if (p.kind === 'tray') {
      // an open bed: four plank walls stood round the core's top, open to the sky
      const [x, y, z] = at3(p.at), [l, w, h] = p.dims.map((v) => v * s), t2 = Math.min((p.wall ?? 0.06) * s, Math.min(l, w) / 4);
      const wall = (wid, x0, x1, y0, y1, mass) => mono(extrudes, { id: wid, profile: { points: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([u, v]) => [r3(u), r3(v)]) }, axisFrom: P([0, 0, z]), axisTo: P([0, 0, z + h]) }, p.piece ?? p.name, p.role ?? 'store', p.group ?? 'tech:skin', mass);
      wall(p.name, x - l / 2, x + l / 2, y - w / 2, y - w / 2 + t2, box([x - l / 2, y - w / 2, z], [x + l / 2, y + w / 2, z + h]));
      wall(`${p.name}-2`, x - l / 2, x + l / 2, y + w / 2 - t2, y + w / 2);
      wall(`${p.name}-3`, x - l / 2, x - l / 2 + t2, y - w / 2 + t2, y + w / 2 - t2);
      wall(`${p.name}-4`, x + l / 2 - t2, x + l / 2, y - w / 2 + t2, y + w / 2 - t2);
    } else if (p.kind === 'arches') {
      // an arch over every wheel on the ground, standing just clear of its tyre: the well it turns in
      for (const wh of wheels.filter((q) => !q.lift && q.sy)) {
        const R0 = wh.r * (p.clear ?? 1.12), R1 = R0 + (p.thick ?? 0.09) * s, q = Math.max(6, Math.round(fit(R1) / 2)), pts = [];
        for (let i = 0; i <= q; i++) { const a = (Math.PI * i) / q; pts.push([r3(-(wh.x + R1 * Math.cos(a))), r3(wh.r + R1 * Math.sin(a))]); }
        for (let i = q; i >= 0; i--) { const a = (Math.PI * i) / q; pts.push([r3(-(wh.x + R0 * Math.cos(a))), r3(wh.r + R0 * Math.sin(a))]); }
        const y0 = wh.y - wh.sy * wh.w * 0.2, y1 = wh.y + wh.sy * wh.w * 0.62;
        // counter-clockwise in the extrude's plane (u = −x, v = z)
        mono(extrudes, { id: `arch-${wh.id.replace(/^wheel-?/, '')}`, profile: { points: [...pts].reverse() }, axisFrom: P([0, Math.min(y0, y1), 0]), axisTo: P([0, Math.max(y0, y1), 0]) }, p.piece ?? 'arches', 'trim', p.group ?? 'tech:skin');
      }
    } else if (p.kind === 'lamps') {
      // a pair of lamps looking forward
      const [x, y, z] = at3(p.at), r = p.r * s;
      for (const sy of [-1, 1]) lathe(`lamp-${sy < 0 ? 'l' : 'r'}`, [x - r * 0.6, sy * y, z], [x + r * 0.15, sy * y, z], [[0, r * 0.8], [0.7, r], [1, r * 0.92]], r, 'lamps', 'lamp', 'tech:light');
    } else if (p.kind === 'band') {
      // a glass sleeve round the core between two heights (a carriage's windows)
      const [g0, g1] = p.z, n = fitS(C.section ?? m, dims.W, dims.H), gh = dims.H * (g1 - g0), gz = dims.lift + dims.H * (g0 + g1) / 2, len = dims.L * (p.len ?? 0.9);
      mono(lofts, { id: 'band', axisFrom: P([-len / 2, 0, gz]), axisTo: P([len / 2, 0, gz]), stations: [{ t: 0, profile: { points: section(C.section ?? m, dims.W * 1.02, gh, n) } }, { t: 1, profile: { points: section(C.section ?? m, dims.W * 1.02, gh, n) } }] }, 'core', 'body', 'tech:glass');
    } else if (p.kind === 'rails') {
      // the rails it runs on, on their sleepers: it is read as railed by them
      const len = dims.L * (p.len ?? 1.5), g = p.gauge * s, rh = p.h * s, rw = 0.08 * s;
      for (const sy of [-1, 1]) mono(extrudes, { ground: true, id: `rail-${sy < 0 ? 'l' : 'r'}`, profile: { points: [[-rw, 0.035 * s], [rw, 0.035 * s], [rw * 0.45, rh * 0.75], [rw * 0.7, rh * 0.8], [rw * 0.7, rh], [-rw * 0.7, rh], [-rw * 0.7, rh * 0.8], [-rw * 0.45, rh * 0.75]].map(([u, v]) => [r3(u + sy * g / 2), r3(v)]) }, axisFrom: P([-len / 2, 0, 0]), axisTo: P([len / 2, 0, 0]) }, 'rails', 'mount', 'tech:trim');
      const pitch = (p.pitch ?? 0.75) * s, ns = Math.floor(len / pitch), sl = g + 0.6 * s;
      for (let i = 0; i < ns; i++) { const x = -len / 2 + pitch * (i + 0.5); mono(extrudes, { ground: true, id: `sleeper-${i + 1}`, profile: { points: [[-sl / 2, 0], [sl / 2, 0], [sl / 2, 0.035 * s], [-sl / 2, 0.035 * s]].map(([u, v]) => [r3(u), r3(v)]) }, axisFrom: P([x - 0.11 * s, 0, 0]), axisTo: P([x + 0.11 * s, 0, 0]) }, 'rails', 'mount', 'tech:frame'); }
      dims.railTop = rh;
    } else if (p.kind === 'bogies') {
      // a bogie under each end: a frame turning about the vertical, its wheelsets on the rails (flanged, or a shoe
      // riding over the rail on its field), the body riding on the bogies
      const g = p.gauge * s, r = p.r * s * k('bogies'), w = 0.14 * s, top = dims.railTop ?? 0;
      p.at.forEach((fx, bi) => {
        const bx = fx * dims.L / 2, bid = `bogie-${bi + 1}`, sets = p.sets ?? 2, span = (p.span ?? 2.2) * s;
        const fl = span + r * 1.6, fw = g + 0.35 * s, fz = top + r * 0.7, fh = r * 0.9;
        mono(lofts, { id: bid, axisFrom: P([bx - fl / 2, 0, fz + fh / 2]), axisTo: P([bx + fl / 2, 0, fz + fh / 2]), stations: [{ t: 0, profile: { points: section('riveted', fw, fh, 8) } }, { t: 1, profile: { points: section('riveted', fw, fh, 8) } }] }, bid, 'frame', 'tech:frame', box([bx - fl / 2, -fw / 2, fz], [bx + fl / 2, fw / 2, fz + fh]));
        joints.push({ id: bid, parent: 'core', pivot: [r3(bx), 0, r3(fz + fh)], axis: [0, 0, 1], range: [-12, 12], pieces: [bid] });
        for (let i = 0; i < sets; i++) {
          const wx = bx + (sets === 1 ? 0 : -span / 2 + (span * i) / (sets - 1));
          for (const [sy, side] of [[-1, 'l'], [1, 'r']]) {
            const M = kit({ mechanism: 'wheel', on: 'rail', id: `${bid}-${side}${i + 1}`, piece: 'bogies', centre: [wx, sy * (g / 2 + w * 0.3), top + r], axle: [0, sy, 0], r, w });
            for (const j of M.joints) j.parent = bid;
            wheels.push({ id: `${bid}-${side}${i + 1}`, x: wx, y: sy * g / 2, r, w, sy, lift: M.lift, rail: true });
          }
        }
      });
    } else if (p.kind === 'barrels') {
      const nb = Math.max(1, d.barrels ?? 1), r = p.r * s * k('barrels'), len = p.len * s, z = dims.zc + (p.raise ?? 0) * len;
      for (let i = 0; i < nb; i++) {
        const y = (i - (nb - 1) / 2) * r * 2.6, id = `barrel${nb > 1 ? `-${i + 1}` : ''}`, x0 = dims.L * 0.35;
        lathe(id, [x0, y, dims.zc], [x0 + len, y, z], [[0, r * 1.35], [0.12, r], [0.9, r * 0.9], [0.94, r * 1.25], [1, r * 1.15]], r * 1.35, 'barrels', 'weapon', 'tech:frame', { seg: [[x0, y, dims.zc], [x0 + len, y, z]], r, out: [0, 0, 1] });
        joints.push({ id: `pitch${nb > 1 ? `-${i + 1}` : ''}`, parent: 'core', pivot: [r3(x0), r3(y), r3(dims.zc)], axis: [0, 1, 0], range: [-10, 35], pieces: [id] });
      }
    }
  }
  for (const id of Object.keys(pieces)) if (!joints.some((j) => j.pieces.includes(id))) onCore.push(id);
  // the functions the masses show, read off the roles they carry
  const roles = new Set(Object.values(pieces).map((x) => x.role)), functions = [];
  if (roles.has('running') && (roles.has('body'))) functions.push('move');
  if (roles.has('weapon') && (roles.has('mount') || roles.has('grip'))) functions.push('strike');
  if (roles.has('span') && roles.has('pier')) functions.push('pass');
  if (roles.has('beacon')) functions.push('signal');
  if (roles.has('sensor') && !functions.includes('move')) functions.push('sense');
  return { manifest: { kind: 'workbench', title: t.read ?? t.intent ?? 'chassis', units: 'm', lofts, lathes, sweeps, extrudes }, variant, optional, dropped: drop.filter((x) => optional.includes(x)), detail, mechanisms, joints, sockets: deriveSockets(masses, dims), pieces, masses, lead: row.lead ?? 'core', functions, dims, mounts: row.mounts ?? ['ground'] };
}

// what a face turned each way can show
export const SERVES_BY_FACE = Object.freeze({
  top: ['sense', 'signal', 'strike', 'power', 'light'], front: ['sense', 'strike', 'light', 'signal'], rear: ['power', 'store'],
  side: ['guard', 'store', 'strike'], outer: ['guard'],
});
const sizeOf = (area) => (area < 0.6 ? 'small' : area < 3 ? 'medium' : 'large');
/**
 * The sockets, derived: a block-like mass offers its top, front, rear and sides (a face under 0.15 m² offers nothing),
 * a segment its outer side at its middle. Each socket says the face it is on, its size by the face's area, and what a
 * face that way can show.
 */
export function deriveSockets(masses, dims) {
  const out = [];
  for (const M of masses) {
    if (M.seg) {
      const [a, b] = M.seg, mid = a.map((v, i) => (v + b[i]) / 2), len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      out.push({ id: `${M.id}-outer`, on: M.id, mass: M.piece, face: 'outer', at: add(mid, M.out, M.r).map(r3), normal: M.out, size: sizeOf(len * M.r * 2), extent: [r3(M.r * 2), r3(len)], serves: SERVES_BY_FACE.outer });
      continue;
    }
    const { lo, hi } = M.box, c = lo.map((v, i) => (v + hi[i]) / 2), [dx, dy, dz] = hi.map((v, i) => v - lo[i]);
    // each face: where, which way, and its extent in its own plane (across, up): what hangs there fits it
    const faces = [['top', [c[0], c[1], hi[2]], [0, 0, 1], [dy, dx]], ['front', [hi[0], c[1], c[2]], [1, 0, 0], [dy, dz]], ['rear', [lo[0], c[1], c[2]], [-1, 0, 0], [dy, dz]],
      ['side-l', [c[0], lo[1], c[2]], [0, -1, 0], [dx, dz]], ['side-r', [c[0], hi[1], c[2]], [0, 1, 0], [dx, dz]]];
    for (const [face, at, normal, ext] of faces) { const area = ext[0] * ext[1]; if (area >= 0.15) out.push({ id: `${M.id}-${face}`, on: M.id, mass: M.piece, role: M.role, face: face.startsWith('side') ? 'side' : face, at: at.map(r3), normal, size: sizeOf(area), extent: ext.map(r3), serves: SERVES_BY_FACE[face.startsWith('side') ? 'side' : face] }); }
  }
  return out;
}
