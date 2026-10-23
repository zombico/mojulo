/**
 * The microscopic law table — what moves molecules and cells around, and what turns one kind into another, one
 * row each. Bounded by its laws: overdamped Brownian motion (inertia vanishes within nanoseconds at this scale),
 * drift, membranes, and reactions in a well-mixed volume. A new law is a row here (and its step in kernel.js).
 *
 *   row = {
 *     id, words, summary, assumption,   as the classical table (the solver never reads the words)
 *     params: { name: { dim, vector?, default?, required?, perSpecies?, list? } },
 *     example,                           a smallest model that exercises it (the card's worked example; the deep sweep's case)
 *   }
 *
 * Sources for the numbers a row leans on: Stokes–Einstein (D = kT / 6πηr); the Einstein relation (drift v = F·D / kT);
 * the partially permeable boundary of Brownian dynamics (a crossing is let through with probability P·√(πΔt / D),
 * Erban & Chapman 2007, Phys. Biol. 4:16); Gillespie's stochastic simulation algorithm for reactions in a well-mixed
 * volume (Gillespie 1977, J. Phys. Chem. 81:2340).
 */

export const AVOGADRO = 6.02214076e23;   // per mol (exact, SI 2019)
export const BOLTZMANN = 1.380649e-23;   // J/K (exact, SI 2019)
export const WATER_37C = 0.6913e-3;      // Pa·s, water at 37 °C (CRC Handbook)
export const BODY_TEMPERATURE = 310.15;  // K

export const MICROSCOPIC_LAWS = [
  {
    id: 'brownian',
    words: ['diffusion', 'brownian motion', 'random walk', 'spreading', 'jiggling', 'thermal motion'],
    params: {},
    summary: 'Brownian motion: every molecule takes random steps, spreading with diffusion coefficient D (its own, or Stokes–Einstein\'s kT / 6πηr from its radius, the temperature and the medium\'s viscosity).',
    assumption: 'Overdamped: a molecule\'s inertia is gone within nanoseconds, so it moves by random steps alone; the medium is a uniform fluid.',
    example: {
      box: { size: ['20 µm', '20 µm', '20 µm'] },
      species: [{ id: 'bead', radius: '0.5 µm', count: 120, where: 'center' }],
      laws: [{ law: 'brownian' }], duration: '20 s',
    },
  },
  {
    id: 'drift',
    words: ['flow', 'current', 'force', 'electrophoresis', 'sedimentation', 'chemotaxis'],
    params: { velocity: { dim: 'velocity', vector: true }, force: { dim: 'force', vector: true } },
    summary: 'A steady drift on top of the random steps: a flow carrying molecules at `velocity`, or a `force` on each (gravity, a field), which moves it at v = F·D / kT.',
    assumption: 'The drift is uniform and steady; at this scale a force sets a speed, not an acceleration.',
    example: {
      box: { size: ['40 µm', '20 µm', '20 µm'], walls: 'periodic' },
      species: [{ id: 'bead', radius: '0.5 µm', count: 120, where: 'center' }],
      laws: [{ law: 'brownian' }, { law: 'drift', velocity: ['1 µm/s', 0, 0] }], duration: '10 s',
    },
  },
  {
    id: 'membrane',
    words: ['membrane', 'osmosis', 'semipermeable', 'cell wall', 'barrier', 'channel', 'leak'],
    params: { axis: { dim: 'axis', default: 'x' }, at: { dim: 'length' }, permeability: { dim: 'velocity', perSpecies: true } },
    summary: 'A membrane across the box (a plane on `axis` at `at`, default the middle) that each species crosses with its own permeability P; a species it does not list cannot cross.',
    assumption: 'The membrane is a flat, infinitely thin sheet; crossing is a probability per hit set by P (no channels, pumps or binding).',
    example: {
      box: { size: ['20 µm', '10 µm', '10 µm'] },
      species: [{ id: 'water', radius: '0.14 nm', count: 150, where: 'left' }, { id: 'sugar', radius: '0.5 nm', count: 150, where: 'left' }],
      laws: [{ law: 'brownian' }, { law: 'membrane', permeability: { water: '100 µm/s' } }], duration: '0.3 s',
    },
  },
  {
    id: 'reaction',
    words: ['reaction', 'binding', 'enzyme', 'kinetics', 'equilibrium', 'catalysis', 'decay', 'dimer'],
    params: { from: { dim: 'species', list: true, required: true }, to: { dim: 'species', list: true, required: true }, rate: { dim: 'rate', required: true }, reverse: { dim: 'rate' } },
    summary: 'A reaction by mass action: `from` (one or two species) becomes `to` (one to three) at `rate` (per second for one reactant, per molar per second for two), with an optional `reverse` rate. Events are drawn exactly by Gillespie\'s algorithm.',
    assumption: 'The volume is well mixed: a reaction\'s odds depend on how many molecules there are, not on where they are (the well-mixed gate checks it).',
    example: {
      box: { size: ['1 µm', '1 µm', '1 µm'] },
      species: [{ id: 'A', radius: '2 nm', count: 120 }, { id: 'B', radius: '2 nm', count: 0 }],
      laws: [{ law: 'brownian' }, { law: 'reaction', from: ['A'], to: ['B'], rate: '2 /s', reverse: '1 /s' }], duration: '3 s',
    },
  },
];

export const MICROSCOPIC_LAW = Object.fromEntries(MICROSCOPIC_LAWS.map((r) => [r.id, r]));
