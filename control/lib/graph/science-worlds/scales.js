/**
 * Where a law lives when the scale asked for it does not have it. A science world names a missing law as a GAP
 * that says which scale owns it, rather than approximating it silently: "bond formation lives in `quantum`".
 *
 * Chemistry is not a scale of its own; it goes to the scale its explanation needs. Molecules that move, collide,
 * bind and get counted are `microscopic`; why a bond forms (orbitals, shared electrons) is `quantum`; bulk matter
 * (a gas pushing a piston) is `classical`.
 *
 * The words here are law ids an agent might write, not language the solver reads: the agent writes the spec.
 */

export const OWNER = {
  classical: [
    'gravity-uniform', 'gravity-newton', 'gravity', 'spring', 'rod', 'rope', 'pendulum', 'drag-linear', 'drag-quadratic',
    'air-resistance', 'buoyancy', 'coulomb', 'lorentz', 'plane', 'ground', 'incline', 'collision', 'projectile', 'orbit',
  ],
  microscopic: [
    'diffusion', 'brownian', 'brownian-motion', 'osmosis', 'reaction', 'mass-action', 'binding', 'enzyme',
    'michaelis-menten', 'membrane', 'transport', 'transcription', 'translation', 'mitosis', 'meiosis',
    'chemotaxis', 'dissolve', 'dissolving', 'equilibrium', 'kinetics', 'random-walk', 'cell-cycle',
  ],
  quantum: [
    'orbital', 'wavefunction', 'wave-function', 'tunnelling', 'tunneling', 'superposition', 'spin', 'entanglement',
    'bond', 'bonding', 'covalent', 'photon', 'photoelectric', 'decay', 'radioactive-decay', 'uncertainty',
    'interference', 'double-slit', 'quantization', 'energy-levels', 'schrodinger', 'schrödinger', 'hydrogen',
  ],
};

// laws that are classical in spirit but not (yet) rows of the table, with what would close the gap
const NOT_YET = {
  magnus: 'spin lift on a ball: the curated `mechanics` kind\'s `flight` scenario has it today',
  rolling: 'rolling without slipping needs rotational state; bodies slide in this table',
  torque: 'rigid-body rotation is not in the table; bodies are point masses or smooth spheres',
  'rigid-body': 'rigid-body rotation is not in the table; bodies are point masses or smooth spheres',
  turbulence: 'turbulent flow is not modelled; quadratic drag is the closest row',
  fluid: 'fluid flow fields are not in the table; the curated `fluid` and `hydro` kinds show flow',
  relativity: 'relativity is outside the classical scale; the curated `black-hole` and `gravity-wave` kinds show it',
  'special-relativity': 'relativity is outside the classical scale',
  thermal: 'heat flow is not in the table yet',
  heat: 'heat flow is not in the table yet',
  // microscopic laws not yet rows (each species already evens out its own concentration across a membrane it crosses)
  osmosis: 'osmotic flow needs the solvent\'s pressure, which is not modelled; the membrane row shows each species evening out its own concentration',
  transcription: 'a process line (transcription, translation, mitosis) with sourced rates is not in the table yet',
  translation: 'a process line (transcription, translation, mitosis) with sourced rates is not in the table yet',
  mitosis: 'a process line (transcription, translation, mitosis) with sourced rates is not in the table yet',
  meiosis: 'a process line with sourced rates is not in the table yet; the curated `dna-process` kind shows meiosis',
  'cell-cycle': 'a process line with sourced rates is not in the table yet',
  chemotaxis: 'drift toward a source is not in the table yet; the drift row is a uniform push',
  enzyme: 'compose it from reaction rows: E + S ⇌ ES (rate, reverse), then ES → E + P',
  'michaelis-menten': 'compose it from reaction rows: E + S ⇌ ES (rate, reverse), then ES → E + P',
  binding: 'a reaction row with a reverse rate: A + B ⇌ AB',
  diffusion: 'the brownian row is diffusion',
  'brownian-motion': 'the brownian row',
  'random-walk': 'the brownian row',
  // quantum words that are not row ids: the row that is, or why the table has none
  orbital: 'the hydrogen row (an atom world, state.orbitals)',
  wavefunction: 'every line world solves the Schrödinger equation for ψ; the rows are its potentials',
  'wave-function': 'every line world solves the Schrödinger equation for ψ; the rows are its potentials',
  schrodinger: 'every line world solves the Schrödinger equation; the rows are its potentials',
  'schrödinger': 'every line world solves the Schrödinger equation; the rows are its potentials',
  tunnelling: 'the barrier row', tunneling: 'the barrier row',
  superposition: 'a state, not a row: state.superpose on a line, or a spin along x through a z magnet',
  spin: 'the stern-gerlach row (a spin world)',
  quantization: 'the well or harmonic row: their levels are the quantization', 'energy-levels': 'the well or harmonic row',
  'radioactive-decay': 'the decay row',
  uncertainty: 'not a row: every line world reads its spread, and a packet narrow in position spreads fastest',
  bond: 'bonds need more than one electron, which is not in the table yet; the curated `molecule` kind shows molecules',
  bonding: 'bonds need more than one electron, which is not in the table yet; the curated `molecule` kind shows molecules',
  covalent: 'bonds need more than one electron, which is not in the table yet; the curated `molecule` kind shows molecules',
  entanglement: 'two-particle states are not in the table yet',
  photon: 'light as particles is not in the table yet', photoelectric: 'the photoelectric effect is not in the table yet',
  interference: 'a two-slit plane is not in the table yet; the curated `double-slit` kind shows it',
  'double-slit': 'a two-slit plane is not in the table yet; the curated `double-slit` kind shows it',
};

/** The gap for a law id `scale` lacks: which scale owns it, or why the table has no row for it. */
export function gapFor(law, scale, known) {
  const id = String(law).toLowerCase();
  for (const [owner, words] of Object.entries(OWNER)) {
    if (owner !== scale && words.includes(id)) {
      return { law, why: `'${law}' lives in the ${owner} scale, not ${scale}`, proposal: `compose it as a ${owner} world` };
    }
  }
  if (NOT_YET[id]) return { law, why: NOT_YET[id], proposal: `the closest ${scale} rows: ${known.join(', ')}` };
  return { law, why: `'${law}' is not a ${scale} law`, proposal: `the ${scale} table has: ${known.join(', ')}` };
}
