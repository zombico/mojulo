/**
 * fractal-structure / presets — the named looks: each a few words over the plan, the rise, the crown, the echo and the
 * plinth. A structure names one and overrides any dial; `auto` rolls one from the seed (read.js).
 *
 *   spire      a curvilinear tower on an offset plan, banded by its storeys, a ribbed disc on top, half-size
 *              copies of itself climbing each face (the nagara shikhara)
 *   cluster    the spire with its copies' copies: a tower of towers, two levels deep
 *   ziggurat   square terraces stepping in, small pavilions on every terrace corner (a stepped vimana, a ziggurat)
 *   star       a sixteen-point stellate plan from four turned squares, fluted straight up, on a star-shaped platform
 *   drum       a round, ringed drum with dome shoulders and a dome
 *   turning    square storeys, each turned past the one below, deep eaves: the turning-square progression stacked
 *   beehive    stepped-circle storeys (square blocks riding a circle) curving in to a ribbed disc
 *   needle     a three-way hexagram plan flaring to a thin point: a beacon, a mast, a dark tower
 *
 * A structure made of structures (the colonnade: any structure's words stood round a plan or on a grid):
 *
 *   column     a fluted shaft on a base under a square abacus: the part the others are built from
 *   rotunda    a round drum in a ring of columns under a dome, a small copy of itself on top for a lantern (a tholos)
 *   cloister   a square ring of walls round a courtyard, a covered walk on columns inside it
 *   hall       a pillared hall: a grid of columns carrying a stepped pyramid roof (a mandapa, a hypostyle)
 *   arena      an oval bowl: seating terraces stepping out as they rise behind a storeyed wall ringed with columns
 *
 * `aspect` is the body's height over its base width; `size`, where given, the preset's own default width (a column is not a
 * tower). Palettes are hex strings by part.
 */

export const PRESETS = Object.freeze({
  spire: {
    plan: { form: 'offset', bays: 5, project: 0.1, depth: 2 },
    aspect: 2.3,
    rise: { tiers: 9, curve: 'rekha', top: 0.3, diminish: 0.95, cornice: { depth: 0.035, height: 0.12 } },
    crown: { form: 'disc', ribs: 32, size: 1.5 },
    echo: { depth: 1, scale: 0.42, where: 'faces', around: 4, rings: 2, reach: 0.5, sink: 0.45 },
    plinth: { steps: 2, height: 0.07, margin: 0.22 },
    palette: { body: '#c7a37a', band: '#b48d63', crown: '#d6bd93', plinth: '#9c8569' },
  },
  cluster: {
    plan: { form: 'offset', bays: 5, project: 0.1, depth: 2 },
    aspect: 2.4,
    rise: { tiers: 9, curve: 'rekha', top: 0.28, diminish: 0.95, cornice: { depth: 0.035, height: 0.12 } },
    crown: { form: 'disc', ribs: 32, size: 1.5 },
    echo: { depth: 2, scale: 0.44, where: 'faces', around: 4, rings: 2, reach: 0.5, sink: 0.45 },
    plinth: { steps: 3, height: 0.08, margin: 0.3 },
    palette: { body: '#c9a27c', band: '#b08a66', crown: '#dcc39a', plinth: '#9a836a' },
  },
  ziggurat: {
    plan: 'square',
    aspect: 0.9,
    rise: { tiers: 5, curve: 'cone', top: 0.36, diminish: 1, stepped: true, cornice: { depth: 0.05, height: 0.16 } },
    crown: { form: 'dome', size: 0.55 },
    echo: { depth: 1, scale: 0.13, where: 'corners', around: 4, rings: 4, reach: 0.95, sink: 0.05 },
    plinth: { steps: 1, height: 0.04, margin: 0.12 },
    palette: { body: '#b39b7d', band: '#9d8468', crown: '#c9b08c', plinth: '#8c7a64' },
  },
  star: {
    plan: { form: 'turned', sides: 4, k: 4 },
    aspect: 1.5,
    rise: { tiers: 7, curve: 'cone', power: 1.35, top: 0.3, diminish: 0.93, cornice: { depth: 0.05, height: 0.14 } },
    crown: { form: 'disc', ribs: 16, size: 1.4 },
    echo: false,
    plinth: { steps: 2, height: 0.08, margin: 0.28 },
    palette: { body: '#8e9286', band: '#7b7f74', crown: '#a3a69a', plinth: '#74766e' },
  },
  drum: {
    plan: { form: 'circle', sides: 48 },
    aspect: 0.75,
    rise: { tiers: 4, curve: 'dome', top: 0.55, diminish: 0.9, cornice: { depth: 0.04, height: 0.12 } },
    crown: { form: 'dome', size: 1 },
    echo: false,
    plinth: { steps: 1, height: 0.05, margin: 0.1 },
    palette: { body: '#b7a58e', band: '#a08c74', crown: '#c8b9a3', plinth: '#8e8070' },
  },
  turning: {
    plan: 'square',
    aspect: 1.9,
    rise: { tiers: 8, curve: 'cone', top: 0.34, diminish: 0.94, stepped: true, twist: 22.5, cornice: { depth: 0.14, height: 0.2 } },
    crown: { form: 'finial', size: 1.2 },
    echo: false,
    plinth: { steps: 2, height: 0.06, margin: 0.18 },
    palette: { body: '#a8584a', band: '#3f3a36', crown: '#c9a35a', plinth: '#7a746c' },
  },
  beehive: {
    plan: { form: 'stepped-circle', steps: 6 },
    aspect: 1.7,
    rise: { tiers: 7, curve: 'rekha', top: 0.34, diminish: 0.94, cornice: { depth: 0.04, height: 0.13 } },
    crown: { form: 'disc', ribs: 24, size: 1.4 },
    echo: { depth: 1, scale: 0.3, where: 'faces', around: 4, rings: 1, reach: 0, sink: 0.4 },
    plinth: { steps: 2, height: 0.07, margin: 0.2 },
    palette: { body: '#9f8f7f', band: '#877868', crown: '#b5a595', plinth: '#7d7166' },
  },
  needle: {
    plan: { form: 'turned', sides: 3, k: 2 },
    aspect: 3.4,
    rise: { tiers: 6, curve: 'needle', top: 0.08, diminish: 0.88, cornice: { depth: 0.06, height: 0.08 } },
    crown: { form: 'finial', size: 2.2 },
    echo: { depth: 1, scale: 0.36, where: 'corners', around: 3, rings: 1, reach: 0, sink: 0.35 },
    plinth: { steps: 1, height: 0.05, margin: 0.2 },
    palette: { body: '#3d4250', band: '#2b2f39', crown: '#9fd8e6', plinth: '#4a4d55' },
  },
  column: {
    size: 1.2,
    plan: { form: 'star', points: 20, inner: 0.94 },
    aspect: 7,
    rise: { tiers: 1, curve: 'cone', top: 0.86, cornice: false },
    crown: { form: 'slab', size: 1.45 },
    echo: false,
    plinth: { steps: 1, height: 0.3, margin: 0.32 },
    palette: { body: '#ddd5c6', band: '#cfc6b4', crown: '#d6cdbd', plinth: '#c9bfae' },
  },
  rotunda: {
    size: 14,
    plan: { form: 'circle', sides: 32 },
    aspect: 0.5,
    rise: { tiers: 1, curve: 'cone', top: 1, cornice: false },
    crown: { form: 'dome', size: 1.02 },
    echo: { depth: 1, scale: 0.2, where: 'top' },
    colonnade: { layout: 'ring', count: 20, radius: 1.3, width: 0.045, height: 0.5, roof: true },
    plinth: { steps: 3, height: 0.05, margin: 0.18 },
    palette: { body: '#d8d0c0', band: '#c9bfac', crown: '#bfb6a6', plinth: '#b8ae9c' },
  },
  cloister: {
    size: 32,
    plan: 'square',
    aspect: 0.16,
    rise: { tiers: 1, curve: 'cone', top: 1, cornice: false },
    hollow: { inner: 0.8, rake: 0 },
    crown: 'none',
    echo: false,
    colonnade: { layout: 'ring', count: 28, radius: 0.7, width: 0.016, height: 0.138, roof: true },
    plinth: { steps: 1, height: 0.012, margin: 0.03 },
    palette: { body: '#c4ab8c', band: '#a98f72', crown: '#c9b394', plinth: '#a19582' },
  },
  hall: {
    size: 18,
    plan: 'square',
    aspect: 0.32,
    rise: { tiers: 4, curve: 'cone', top: 0.2, stepped: true, cornice: { depth: 0.035, height: 0.3 } },
    crown: { form: 'disc', ribs: 16, size: 1.3 },
    echo: false,
    colonnade: { layout: 'grid', count: [5, 5], span: 0.9, width: 0.035, height: 0.3, carry: true },
    plinth: { steps: 2, height: 0.04, margin: 0.08 },
    palette: { body: '#b79b7b', band: '#9e8263', crown: '#c8ad8b', plinth: '#968671' },
  },
  arena: {
    size: 90,
    plan: { form: 'circle', sides: 48 },
    stretch: [1, 0.78],
    aspect: 0.2,
    rise: { tiers: 4, curve: 'cone', top: 1, stepped: true, cornice: { depth: 0.008, height: 0.12 } },
    hollow: { inner: 0.58, rake: 0.36 },
    crown: 'none',
    echo: false,
    colonnade: { layout: 'ring', count: 48, radius: 1.012, width: 0.012, height: 0.15, roof: false },
    plinth: { steps: 1, height: 0.008, margin: 0.03 },
    palette: { body: '#cbbb9f', band: '#b6a587', crown: '#cbbb9f', plinth: '#a89c86' },
  },
});

export const PRESET_IDS = Object.freeze([...Object.keys(PRESETS), 'auto']);

/** What `auto` rolls among, each a whole preset before its dials are jittered (read.js): the towers, not their parts. */
export const AUTO_POOL = Object.freeze(['spire', 'cluster', 'ziggurat', 'star', 'drum', 'turning', 'beehive', 'needle', 'rotunda']);
