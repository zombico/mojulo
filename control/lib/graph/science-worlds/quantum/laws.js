/**
 * The quantum law table — states and the rules they follow, not forces. A quantum world is one SYSTEM, and each row
 * belongs to one:
 *
 *   line     a particle on a line, ψ(x, t) under the Schrödinger equation, its potential the sum of the line's rows
 *            (an infinite well, a harmonic well, a rectangular barrier, a step); stepped by Crank–Nicolson (unitary)
 *   plane    a particle on a plane, ψ(x, y, t), meeting a wall with slits; stepped by split-step Fourier, its far
 *            field read off and detections drawn from it one at a time
 *   atom     the hydrogen atom's exact orbitals ψ_nlm, drawn as a cloud of points sampled from |ψ|²
 *   spin     a spin-½ through a chain of Stern–Gerlach magnets, each measuring along its axis
 *   decay    unstable nuclei, each decaying at a random moment with a fixed half-life
 *
 * The stance: faithful to the model, no claim about reality. The mathematics of each row is exact (normalization,
 * nodes, energy levels, the odds of an outcome); what is drawn of it is a picture (a cloud of samples, a coloured sign,
 * a beam's path). Every row carries its sources and the date it was last reviewed, and the page shows them.
 *
 *   row = { id, system, words, summary, assumption, params, example, sources, reviewed }
 */

export const HBAR = 1.054571817e-34;       // J·s (exact h / 2π, SI 2019)
export const ELECTRON_MASS = 9.1093837015e-31;   // kg (CODATA 2018)
export const BOHR = 5.29177210903e-11;     // m (CODATA 2018)
export const RYDBERG_EV = 13.605693122994;  // eV (CODATA 2018)
export const EV = 1.602176634e-19;         // J (exact)

const REVIEWED = '2026-10-19';
const GRIFFITHS = 'Griffiths & Schroeter, Introduction to Quantum Mechanics, 3rd ed. (2018)';
const CODATA = 'CODATA 2018 recommended values (NIST)';

export const QUANTUM_LAWS = [
  {
    id: 'well',
    system: 'line',
    words: ['particle in a box', 'infinite well', 'quantum well', 'box', 'confinement', 'standing wave'],
    params: { width: { dim: 'length', required: true }, center: { dim: 'length', default: 0 } },
    summary: 'An infinite square well of `width`: the particle cannot be outside it. Its allowed energies are n²π²ħ² / 2ma².',
    assumption: 'The walls are infinitely high and perfectly sharp (drawn as a very high step).',
    example: { system: 'line', line: { length: '4 nm' }, laws: [{ law: 'well', width: '2 nm' }], state: { superpose: [{ n: 1, weight: 1 }, { n: 2, weight: 1 }] }, duration: '20 fs' },
    sources: [GRIFFITHS + ', §2.2', CODATA], reviewed: REVIEWED,
  },
  {
    id: 'harmonic',
    system: 'line',
    words: ['harmonic oscillator', 'spring', 'vibration', 'molecular vibration', 'zero-point energy'],
    params: { energy: { dim: 'work', required: true }, center: { dim: 'length', default: 0 } },
    summary: 'A harmonic well, V = ½mω²x², named by its level spacing ħω (`energy`). Its allowed energies are (n + ½)ħω, and a displaced packet\'s centre swings back and forth like a classical mass.',
    assumption: 'The well is a perfect parabola everywhere (a real bond softens far from its bottom).',
    example: { system: 'line', line: { length: '12 nm' }, laws: [{ law: 'harmonic', energy: '0.1 eV' }], state: { packet: { at: '1 nm', width: '0.6 nm' } }, duration: '80 fs' },
    sources: [GRIFFITHS + ', §2.3', CODATA], reviewed: REVIEWED,
  },
  {
    id: 'barrier',
    system: 'line',
    words: ['tunnelling', 'tunneling', 'barrier', 'quantum tunnelling', 'scanning tunnelling', 'alpha decay'],
    params: { height: { dim: 'work', required: true }, width: { dim: 'length', required: true }, center: { dim: 'length', default: 0 } },
    summary: 'A rectangular barrier `height` high and `width` wide. A wave packet striking it partly reflects and partly tunnels through, even below the top, with the transmission the textbook formula gives for each energy.',
    assumption: 'The barrier has perfectly sharp edges and a flat top.',
    example: { system: 'line', line: { length: '100 nm', points: 2048 }, laws: [{ law: 'barrier', height: '0.2 eV', width: '0.6 nm' }], state: { packet: { at: '-10 nm', width: '2.5 nm', energy: '0.15 eV' } }, duration: '140 fs' },
    sources: [GRIFFITHS + ', §2.6 (problem 2.33)', CODATA], reviewed: REVIEWED,
  },
  {
    id: 'step',
    system: 'line',
    words: ['step', 'potential step', 'cliff', 'reflection'],
    params: { height: { dim: 'work', required: true }, at: { dim: 'length', default: 0 } },
    summary: 'A potential step of `height` from `at` onward: a packet partly reflects even when it has enough energy to climb it.',
    assumption: 'The step is perfectly sharp.',
    example: { system: 'line', line: { length: '100 nm', points: 2048 }, laws: [{ law: 'step', height: '0.1 eV', at: 0 }], state: { packet: { at: '-10 nm', width: '2.5 nm', energy: '0.2 eV' } }, duration: '130 fs' },
    sources: [GRIFFITHS + ', §2.6 (problem 2.35)', CODATA], reviewed: REVIEWED,
  },
  {
    id: 'slits',
    system: 'plane',
    words: ['double slit', 'two-slit', 'young', 'slits', 'single slit', 'diffraction', 'interference', 'which way', 'wave-particle duality', 'grating'],
    params: {
      count: { dim: 'count', default: 2 }, width: { dim: 'length', required: true }, separation: { dim: 'length', default: 0 },
      thickness: { dim: 'length', default: 'two grid cells' }, at: { dim: 'length', default: 0 }, height: { dim: 'work', default: '10 eV' },
    },
    summary: 'A wall across the plane at x = `at`, `thickness` thick and `height` high, open in `count` slits of `width` whose centres stand `separation` apart. A packet striking it passes through the slits and spreads: far off, the slits\' waves meet in bright fringes sin θ = mλ/d apart, and detections arriving one at a time build that pattern up.',
    assumption: 'The wall is a smooth potential step two grid cells wide at each edge and reflects what it stops; a slit in it is a short channel, not a thin screen, so a single slit\'s band is a little wider than λ/w predicts. The plane is two-dimensional (no motion out of it).',
    example: { system: 'plane', plane: { size: '24 nm', points: 128 }, laws: [{ law: 'slits', count: 2, width: '1 nm', separation: '4 nm', at: '-3 nm' }], state: { packet: { at: '-7 nm', width: ['1 nm', '3 nm'], energy: '2 eV' } }, duration: '13 fs', detections: 400 },
    sources: ['Feynman, Leighton & Sands, The Feynman Lectures on Physics III, ch. 1 (1965)', 'Tonomura et al., Am. J. Phys. 57, 117 (1989)', 'Hecht, Optics, 5th ed. (2017), ch. 10 (Fraunhofer diffraction)', 'Feit, Fleck & Steiger, J. Comput. Phys. 47, 412 (1982) (the split-step method)', CODATA], reviewed: REVIEWED,
  },
  {
    id: 'hydrogen',
    system: 'atom',
    words: ['orbital', 'hydrogen', 'electron cloud', 'atom', 's orbital', 'p orbital', 'd orbital', 'quantum numbers'],
    params: {},
    summary: 'The hydrogen atom: the electron\'s exact orbitals ψ_nlm (n ≥ 1, 0 ≤ l < n, |m| ≤ l), with energies −13.6 eV / n². Each is drawn as a cloud of points sampled from |ψ|², coloured by the wavefunction\'s sign.',
    assumption: 'The nucleus is fixed and pointlike; no spin, no fine structure, no relativity.',
    example: { system: 'atom', laws: [{ law: 'hydrogen' }], state: { orbitals: [{ n: 2, l: 1, m: 0 }] }, samples: 1500 },
    sources: [GRIFFITHS + ', §4.2', CODATA], reviewed: REVIEWED,
  },
  {
    id: 'stern-gerlach',
    system: 'spin',
    words: ['spin', 'stern-gerlach', 'measurement', 'superposition', 'qubit', 'collapse'],
    params: { axis: { dim: 'axis', default: 'z' }, keep: { dim: 'keep', default: 'both' } },
    summary: 'A Stern–Gerlach magnet measuring a spin-½ along `axis` (x, y, z, or an angle from z toward x): each atom comes out up or down, with odds cos²(θ/2) and sin²(θ/2), and leaves in the state it was found in. `keep` lets only one beam on.',
    assumption: 'Each measurement is ideal and instantaneous; the beams\' paths are drawn, only the outcomes and their odds are the model.',
    example: { system: 'spin', state: { along: 'x' }, laws: [{ law: 'stern-gerlach', axis: 'z', keep: 'up' }, { law: 'stern-gerlach', axis: 'x' }], atoms: 300 },
    sources: [GRIFFITHS + ', §4.4.1', 'Gerlach & Stern, Z. Phys. 9, 349 (1922)'], reviewed: REVIEWED,
  },
  {
    id: 'decay',
    system: 'decay',
    words: ['radioactive decay', 'half-life', 'decay', 'radioactivity', 'nuclear decay'],
    params: { half_life: { dim: 'time', required: true } },
    summary: 'Unstable nuclei, each decaying at a random moment: none knows when, but half are gone after each `half_life`.',
    assumption: 'Each nucleus decays independently with a constant chance per moment; the daughter is stable.',
    example: { system: 'decay', laws: [{ law: 'decay', half_life: '2 s' }], state: { nuclei: 400 }, duration: '8 s' },
    sources: ['Rutherford & Soddy, Phil. Mag. 4, 370 (1902)', 'Gamow, Z. Phys. 51, 204 (1928)'], reviewed: REVIEWED,
  },
];

export const QUANTUM_LAW = Object.fromEntries(QUANTUM_LAWS.map((r) => [r.id, r]));
export const SYSTEMS = ['line', 'plane', 'atom', 'spin', 'decay'];
