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
 *   rotunda    stepped-circle storeys (square blocks riding a circle) curving in to a ribbed disc
 *   needle     a three-way hexagram plan flaring to a thin point: a beacon, a mast, a dark tower
 *
 * `aspect` is the body's height over its base width. Palettes are hex strings by part.
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
  rotunda: {
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
});

export const PRESET_IDS = Object.freeze([...Object.keys(PRESETS), 'auto']);

/** What `auto` rolls among, each a whole preset before its dials are jittered (read.js). */
export const AUTO_POOL = Object.freeze(Object.keys(PRESETS));
