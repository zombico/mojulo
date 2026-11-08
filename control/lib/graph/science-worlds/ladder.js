/**
 * The LADDER of scales under a science body: from the place it stands in, down through the body, its grains, its
 * crystal cell and its atoms, to a nucleus no picture can hold. Each rung says what it is:
 *
 *   simulated   a model the solver runs and the gates examine (the place's ground made a plane law, the body)
 *   depicted    drawn at true proportions from sourced numbers, and held to them by a gate when it is drawn
 *               (`ladder-depicted`): a cubic metal's cell, its atoms where the lattice puts them
 *   explained   a cited sentence, where nothing can be drawn honestly: a grain's shape is a growth history, glass has
 *               no repeating cell, a nucleus is a hundred-thousandth of its atom
 *
 * What is too far out of scale to show in the rung above is a rung of its own, never a silent approximation: each
 * rung carries its size and its step from the one above (`step`, a power of ten), and a rung a thousand times smaller
 * than the one above says it cannot be drawn in that frame. Where the table has nothing below a matter, the last rung
 * is a GAP that says so; nothing is invented to fill it.
 *
 *   ladderOf(matter, radius)  → [rung]: the body, then what it is made of, top down
 *   placeRung({ ground, setting })  → the rung above the body when a demo stands 1:1 in a world (setting.js)
 *   rungItem(rung, owner?), ladderSection(bodies) → the honesty panel's lines for them
 *   cellAtoms(cell)           → [[x, y, z] m]: a depicted cell's atoms in its conventional cube, corners and faces
 *                               included (what a drawing of one cell shows)
 *   nearestNeighbour(cell)    → m: the lattice's closest spacing (bcc a√3/2, fcc a/√2), the source's own relation
 *   depictedGate(drawn)       → the gate a drawn cell answers: its spacings measured off the drawing equal the
 *                               lattice's, its cube edge the sourced constant
 *
 * The numbers are handbook values with their source on every rung. The body's matter is rupa's table (matter.js);
 * this table only says what that matter is made of, keyed by the same ids, and never changes rupa's numbers.
 */

import { sig, pow10 } from './page.js';

const Å = 1e-10, µm = 1e-6, mm = 1e-3, nm = 1e-9;

// the nuclear radius R = r₀·A^⅓ (Krane, Introductory Nuclear Physics, 1988, §3.1)
const R0 = 1.2e-15;
const NUCLEUS_SOURCE = 'R = r₀·A^⅓ with r₀ = 1.2 fm (Krane, Introductory Nuclear Physics, 1988, §3.1)';

// an element's atomic number, its most abundant isotope's mass number, and its covalent radius (Cordero et al., "Covalent
// radii revisited", Dalton Trans. 2008); a metal in a depicted cell takes its size from the cell instead
export const ELEMENT = {
  C: { name: 'carbon', Z: 6, A: 12, covalent: 0.76 * Å },
  O: { name: 'oxygen', Z: 8, A: 16, covalent: 0.66 * Å },
  Al: { name: 'aluminium', Z: 13, A: 27, covalent: 1.21 * Å },
  Si: { name: 'silicon', Z: 14, A: 28, covalent: 1.11 * Å },
  Ca: { name: 'calcium', Z: 20, A: 40, covalent: 1.76 * Å },
  Fe: { name: 'iron', Z: 26, A: 56, covalent: 1.32 * Å },
  Cu: { name: 'copper', Z: 29, A: 63, covalent: 1.32 * Å },
  Pb: { name: 'lead', Z: 82, A: 208, covalent: 1.46 * Å },
};
const COVALENT_SOURCE = 'twice the covalent radius (Cordero et al., Dalton Trans. 2008)';
const LATTICE_SOURCE = 'CRC Handbook of Chemistry and Physics, lattice constants of the elements (room temperature)';

// the cubic cells a drawing can hold: fractional positions of the conventional cube's atoms, and the closest spacing
const LATTICE = {
  bcc: { label: 'body-centred cubic', nn: (a) => (a * Math.sqrt(3)) / 2, at: [[0.5, 0.5, 0.5]] },
  fcc: { label: 'face-centred cubic', nn: (a) => a / Math.SQRT2, at: [[0.5, 0.5, 0], [0.5, 0.5, 1], [0.5, 0, 0.5], [0.5, 1, 0.5], [0, 0.5, 0.5], [1, 0.5, 0.5]] },
};
const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];

// ── the rungs, as data ──

const cell = (label, lattice, a, element, what) => ({ id: 'cell', label, status: 'depicted', size: a, cell: { lattice, a, element }, what, source: LATTICE_SOURCE });
const explained = (id, label, size, what, source, why) => ({ id, label, status: 'explained', size, what, source, why });

const IRON = [
  explained('grain', 'ferrite grains', 20 * µm, 'crystals of iron about 20 µm across, each its lattice turned its own way; a crack or a dent starts at the boundaries between them',
    'ASTM E112 grain size about 8, typical of hot-rolled structural steel', 'a grain\'s shape is the history of how it grew, which no table holds'),
  cell('α-iron cell', 'bcc', 2.8665 * Å, 'Fe', 'iron atoms on a body-centred cube 2.87 Å on a side; the carbon of a mild steel (about 0.2 %) sits in a few of its gaps'),
];
const QUARTZ = explained('cell', 'quartz cell', 4.913 * Å, 'silica (SiO₂) on a trigonal cell, a = 4.913 Å and c = 5.405 Å: each silicon held by four oxygens',
  'Levien, Prewitt & Weidner, American Mineralogist 1980', 'a trigonal cell twisted on its axis cannot be shown at true proportions in one cube; it is named, not drawn');
const ICE_CELL = explained('cell', 'ice Ih cell', 4.518 * Å, 'water molecules on a hexagonal cell, a = 4.518 Å and c = 7.356 Å, each held to four neighbours by hydrogen bonds',
  'Petrenko & Whitworth, Physics of Ice, 1999', 'its hydrogens sit by the ice rules, not in one repeating place, so no single cell is the ice');
const WATER = explained('molecule', 'water molecule', 2.76 * Å, 'an oxygen and two hydrogens, each O–H bond 0.957 Å and 104.5° apart; in the ice the molecules sit 2.76 Å apart, oxygen to oxygen',
  'Hoy & Bunker, J. Mol. Spectrosc. 1979 (the molecule); Petrenko & Whitworth, Physics of Ice, 1999 (the spacing)', 'a molecule\'s electrons are a quantum state of more than one electron, which the quantum scale does not solve yet');
const CELLULOSE = explained('fibril', 'cellulose microfibrils', 3 * nm, 'the cell walls are wound of cellulose microfibrils about 3 nm wide, chains of glucose laid side by side, bound in lignin',
  'Jarvis, Phil. Trans. R. Soc. A 2018', 'a fibril is a bundle of chains whose packing is still argued over: it is named, not drawn');
const WOOD = (width, what) => explained('grain', 'wood cells', width, what, 'USDA Forest Products Laboratory, Wood Handbook (2021), ch. 2', 'a wood\'s cells grow to its season and its tree: no one drawing is the wood');
const CSH = explained('gel', 'cement gel', 5 * nm, 'the paste is calcium silicate hydrate: a gel of particles a few nanometres across with no long-range order, holding water in its pores',
  'Jennings, Cement and Concrete Research 2000', 'a gel without order has no cell to draw');
const AGGREGATE = explained('grain', 'aggregate', 20 * mm, 'stones and sand up to about 20 mm, held in a paste of hardened cement', 'a typical structural mix (EN 206, 20 mm maximum aggregate)', 'a mix is poured, not grown: where each stone lies is chance');

export const STRUCTURE = {
  steel: IRON,
  'sheet-metal': IRON,
  'armour-steel': [
    explained('grain', 'tempered martensite', 10 * µm, 'quenched and tempered: laths of iron a fraction of a micrometre wide in former grains about 10 µm across, which the hardness comes from',
      'Krauss, Steels: Processing, Structure, and Performance, 2015', 'a lath\'s shape is the history of its quench'),
    IRON[1],
  ],
  aluminium: [
    explained('grain', 'aluminium grains', 50 * µm, 'grains tens of micrometres across; inside them, the T6 temper grows Mg₂Si precipitates a few nanometres long that pin the lattice and give its strength',
      'ASM Handbook, vol. 2 (6061 aluminium)', 'a grain\'s shape is the history of how it grew, which no table holds'),
    cell('aluminium cell', 'fcc', 4.0495 * Å, 'Al', 'aluminium atoms on a face-centred cube 4.05 Å on a side'),
  ],
  lead: [
    explained('grain', 'lead grains', 1 * mm, 'cast lead cools into coarse grains, millimetres across', 'typical of a casting cooled in its mould', 'a grain\'s shape is the history of how it grew, which no table holds'),
    cell('lead cell', 'fcc', 4.9502 * Å, 'Pb', 'lead atoms on a face-centred cube 4.95 Å on a side'),
  ],
  brass: [
    explained('grain', 'α-brass grains', 30 * µm, 'grains a few tens of micrometres across, many of them twinned by the working that hardened it', 'ASM Handbook, vol. 2 (copper alloys)', 'a grain\'s shape is the history of how it grew, which no table holds'),
    explained('cell', 'α-brass cell', 3.69 * Å, 'copper\'s face-centred cube (3.615 Å) widened to about 3.69 Å by the zinc in solution',
      'Pearson, Handbook of Lattice Spacings and Structures of Metals, 1958', 'which sites hold zinc is random, so no single cell is the brass'),
  ],
  glass: [
    explained('network', 'silica network', 2.63 * Å, 'no crystal: SiO₄ tetrahedra 2.63 Å along an edge (each Si–O bond 1.61 Å) joined at their corners in a network that never repeats, the soda and lime sitting in its holes',
      'Zachariasen, J. Am. Chem. Soc. 1932; the bond from Mozzi & Warren, J. Appl. Cryst. 1969', 'a network that never repeats has no cell: any patch drawn would be one invented arrangement'),
  ],
  ice: [
    explained('grain', 'ice crystals', 5 * mm, 'crystals millimetres to centimetres across, the bigger the slower it froze', 'Petrenko & Whitworth, Physics of Ice, 1999', 'a crystal\'s size is how the ice froze'),
    ICE_CELL, WATER,
  ],
  stone: [
    explained('grain', 'mineral crystals', 3 * mm, 'interlocking crystals of quartz, feldspar and mica, 1 to 10 mm across: granite is coarse-grained because it cooled slowly underground',
      'a phaneritic igneous rock (the IUGS classification)', 'three minerals in one rock: no single drawing is the granite'),
    QUARTZ,
  ],
  sandstone: [
    explained('grain', 'sand grains', 0.25 * mm, 'quartz sand grains, 0.06 to 2 mm, cemented where they touch', 'Wentworth, J. Geology 1922 (the sand grade)', 'where each grain lies is how the sand settled'),
    QUARTZ,
  ],
  timber: [WOOD(20 * µm, 'fibres about 20 µm wide and a millimetre long, with vessels up to 0.3 mm wide that carried the sap (the oak\'s rings show them)'), CELLULOSE],
  pine: [WOOD(30 * µm, 'tracheids, hollow cells about 30 µm wide and 3 mm long, laid along the trunk: they carried the water and they carry the load'), CELLULOSE],
  bone: [
    explained('grain', 'osteons', 200 * µm, 'cylinders about 0.2 mm across of bone laid in rings round a canal that carries its blood', 'Currey, Bones: Structure and Mechanics, 2002', 'an osteon is remodelled as the bone lives'),
    explained('crystal', 'mineral platelets', 25 * nm, 'platelets of hydroxyapatite about 50 × 25 × 3 nm, laid in collagen fibrils', 'Weiner & Wagner, Annu. Rev. Mater. Sci. 1998', 'a platelet is too thin, and its lattice too strained, to draw as one cell'),
  ],
  concrete: [AGGREGATE, CSH],
  'reinforced-concrete': [AGGREGATE, CSH],
};
// the atom each ladder ends on, and whether its size comes from the depicted cell (a metal's touching spheres)
const ATOM = {
  steel: 'Fe', 'sheet-metal': 'Fe', 'armour-steel': 'Fe', aluminium: 'Al', lead: 'Pb', brass: 'Cu',
  glass: 'Si', ice: 'O', stone: 'Si', sandstone: 'Si', sand: 'Si', gravel: 'Si', timber: 'C', pine: 'C', bone: 'Ca',
  concrete: 'Ca', 'reinforced-concrete': 'Ca', snow: 'O',
};

// a soil's grain is rupa's own (the grain its crater throws): one source for both
const SOIL = {
  sand: { what: 'loose quartz grains', below: [QUARTZ] },
  gravel: { what: 'loose stones, mostly quartz', below: [QUARTZ] },
  snow: { what: 'grains of ice sintered at their necks', below: [ICE_CELL, WATER] },
  loam: { what: 'sand, silt and clay with what grew in it', below: [] },
  clay: { what: 'platelets of clay minerals, packed', below: [] },
};

// ── the ladder ──

const baseId = (m) => String(m.id).replace(/\+$/, '');
const sizeText = (x) => {
  if (x >= 1) return `${sig(x, 3)} m`;
  if (x >= 1e-3) return `${sig(x * 1e3, 3)} mm`;
  if (x >= 1e-6) return `${sig(x * 1e6, 3)} µm`;
  if (x >= 1e-9) return `${sig(x * 1e9, 3)} nm`;
  if (x >= 1e-12) return `${sig(x * 1e10, 3)} Å`;
  return `${sig(x * 1e15, 3)} fm`;
};
export { sizeText };

/** The rungs under a body of `matter` with `radius` (m): the body, then what it is made of, top down. */
export function ladderOf(matter, radius) {
  const id = baseId(matter), label = matter.label ?? id;
  const rungs = [{
    id: 'body', label: 'body', status: 'simulated', size: radius > 0 ? 2 * radius : null,
    what: `a uniform sphere of ${label.toLowerCase()}: its motion run by the solver, its contacts checked by the gates`, source: `rupa's matter table (${label.toLowerCase()})`,
  }];
  const soil = SOIL[id];
  const below = soil
    ? [explained('grain', 'soil grains', matter.grain, `${soil.what}, about ${sizeText(matter.grain)} (the grain rupa's craters throw)`, `rupa's matter table (${label.toLowerCase()})`, 'where each grain lies is how the soil settled'), ...soil.below]
    : STRUCTURE[id] ?? [];
  rungs.push(...below.map((r) => ({ ...r })));
  const el = ATOM[id] ? ELEMENT[ATOM[id]] : null;
  if (el) {
    const fromCell = below.find((r) => r.status === 'depicted' && r.cell.element === ATOM[id]);
    const d = fromCell ? LATTICE[fromCell.cell.lattice].nn(fromCell.cell.a) : 2 * el.covalent;
    rungs.push({
      id: 'atom', label: `${el.name} atom`, status: 'explained', size: d,
      what: `${el.Z} electrons round a nucleus, about ${sizeText(d)} across${fromCell ? ' (the spacing of its cell, the atoms taken as touching spheres)' : ''}`,
      source: fromCell ? 'the cell above: its nearest-neighbour spacing' : COVALENT_SOURCE,
      why: `the quantum scale solves one electron (hydrogen's); an atom of ${el.Z} is named, not solved`,
    });
    const D = 2 * R0 * Math.cbrt(el.A), share = Math.round(3 * Math.log10(D / d));
    rungs.push({
      id: 'nucleus', label: `${el.name}-${el.A} nucleus`, status: 'explained', size: D,
      what: `${el.Z} protons and ${el.A - el.Z} neutrons, about ${sizeText(D)} across: nearly all the atom's mass, in about ${pow10(share)} of its volume`,
      source: NUCLEUS_SOURCE, why: 'no picture holds a nucleus and its atom at once',
    });
  } else {
    rungs.push({ id: 'gap', label: 'what lies below', status: 'explained', size: null, gap: true, what: `what ${label.toLowerCase()} is made of further down is not in the ladder yet`, source: null, why: 'nothing is drawn or said that the table cannot source' });
  }
  // each rung's step from the one above, and whether it could have been drawn in that frame
  for (let i = 1; i < rungs.length; i++) {
    const r = rungs[i], up = rungs.slice(0, i).reverse().find((u) => u.size);
    if (!r.size || !up) continue;
    const k = Math.round(Math.log10(r.size / up.size));
    r.step = { of: up.id, label: up.label, power: k, text: `${pow10(k)} of the ${up.label}` };
    if (k <= -3) r.ownRung = `under a thousandth of the ${up.label}: drawn in its frame it would vanish, so it is a rung of its own`;
  }
  return rungs;
}

/** The rung above the body when a classical demo stands 1:1 in a world: the place, its ground a law or its scenery checked. */
export function placeRung({ ground, setting }) {
  return {
    id: 'place', label: 'place', status: 'simulated', size: null,
    what: ground
      ? `the world's ground under the demo is a plane law, and every path is checked against its other surfaces (${setting})`
      : `the demo stands in the world at true size; every path is checked against its surfaces, which are scenery, not laws (${setting})`,
    source: 'the world the demo stands in',
  };
}

/** A depicted cell's atoms in its conventional cube (m): the eight corners and the lattice's own sites. */
export function cellAtoms({ lattice, a }) {
  const L = LATTICE[lattice];
  if (!L) throw new Error(`science-worlds: no depicted lattice '${lattice}' (${Object.keys(LATTICE).join(', ')})`);
  return [...CORNERS, ...L.at].map((p) => p.map((c) => c * a));
}

export const nearestNeighbour = ({ lattice, a }) => LATTICE[lattice].nn(a);
export const latticeLabel = (lattice) => LATTICE[lattice].label;

/**
 * The gate a drawn cell answers. `drawn` = { cell, atoms: [[x, y, z]] scene units, edge: scene units, per: scene units
 * per metre }: the closest spacing measured off the drawing, and its cube's edge, are the source's within 1e-9.
 */
export function depictedGate({ label, cell: c, atoms, edge, per }) {
  let nn = Infinity;
  for (let i = 0; i < atoms.length; i++) for (let j = i + 1; j < atoms.length; j++) {
    nn = Math.min(nn, Math.hypot(atoms[i][0] - atoms[j][0], atoms[i][1] - atoms[j][1], atoms[i][2] - atoms[j][2]));
  }
  const want = nearestNeighbour(c), got = nn / per, a = edge / per;
  const err = Math.max(Math.abs(got - want) / want, Math.abs(a - c.a) / c.a);
  return {
    id: 'ladder-depicted', want: `the ${label} is drawn at true proportions: its cube's edge the sourced ${sizeText(c.a)} and its closest spacing the lattice's (${sizeText(want)}), to one part in a billion`,
    ok: err <= 1e-9, value: { expected: { a: sig(c.a, 6), nn: sig(want, 6) }, measured: { a: sig(a, 6), nn: sig(got, 6) } },
    detail: `measured off the drawn atoms (${latticeLabel(c.lattice)})`,
  };
}

/** One rung as the honesty panel lists it: its name and status, then its size, its step and its sentence. */
export function rungItem(r, owner) {
  const head = `${owner ? `${owner} · ` : ''}${r.label}: ${r.status}${r.size ? `, ${sizeText(r.size)}` : ''}`;
  const step = r.step ? `${r.step.power ? r.step.text : `about the size of the ${r.step.label}`}${r.ownRung ? ', its own rung' : ''}` : null;
  const tail = [step, r.what, r.why && r.status === 'explained' ? `not drawn: ${r.why}` : null, r.source ? `source: ${r.source}` : null].filter(Boolean);
  return { text: head, note: tail.join(' · ') };
}

/** The panel's ladder section for a matter readout's bodies ({ id: { ladder } }): every body's rungs, top down, owned by the body's id when there are several. */
export function ladderSection(bodies) {
  const ids = Object.keys(bodies);
  const items = ids.flatMap((id) => bodies[id].ladder.map((r) => rungItem(r, ids.length > 1 ? id : null)));
  return { head: 'The ladder (simulated · depicted · explained)', color: '#f0d28a', items };
}
