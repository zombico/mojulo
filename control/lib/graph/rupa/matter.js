/**
 * rupa/matter.js — what a thing is MADE OF, as the numbers that decide how it takes a blow, carries a load and gives way.
 * rupa is the internal name; the person says "destructible physics" (`destruction: 'physical'`, breakability.js).
 *
 * "Material" elsewhere is appearance (a look) or the strength sensor's table (strength/materials.js, MPa and mm, for a
 * printed or machined part). This is the same physics at the scale of a world: SI units throughout (kg/m³, Pa, J/m³).
 * Where the two tables name the same stuff (steel, oak, pine) the strength table is the source and this one converts it,
 * so there is one truth for stiffness and strength. Every value is a TYPICAL figure from handbooks, never a guarantee:
 * a recipe's numbers are a compatibility promise over minted rows, so a change here is a changelog line.
 *
 * The principles, as fields:
 *   density    kg/m³: with the volume and `fill`, the mass (what it weighs on its supports, what its debris carries)
 *   E          Young's modulus, Pa: rigidity (carried as data; the breaking reads toughness and strength)
 *   compressive Pa: what a support carries before it crushes
 *   tensile    Pa: cohesion INSIDE the stuff, what holds it together under a pull
 *   bond       Pa: cohesion BETWEEN blocks of one build (mortar, a weld, one pour); the weaker of two matters' governs
 *   strain     failure strain: below 0.05 it is brittle (it shatters, warning-free); above, ductile (it dents and tears)
 *   toughness  J/m³, the modulus of toughness: the energy one cubic metre absorbs before it fails (the area under its
 *              stress-strain curve; the elastic resilience σ²/2E for a brittle glass). A block holds toughness ×
 *              volume × fill joules: rupa's "hit points", derived, never authored
 *   fill       the solid share of a thing's box when nothing says otherwise (a crate is planks round air, a sheet-metal
 *              locker a shell): its mass and its capacity scale by it
 *   yield      Pa: the stress where it starts to FLOW and keep the shape a blow leaves (plastic). One dial across the
 *              whole table: a liquid's 0, mud's and lava's Bingham stress, dough, putty, lead, mild and armour steel.
 *              A solid with a yield is PLASTIC (isPlastic): a blow dents it, squashes it or punches through it
 *              (distortion, controllable/rupa.js) and its budget still decides whether it stands. Brittle stuff (glass,
 *              masonry, timber) has none: it breaks before it flows. Hardness, what a dent pushes against, is 3 × yield
 *              (Tabor's constraint)
 * Soils add the Mohr–Coulomb pair and what digging does to them:
 *   c          cohesion, Pa (sand 0: it slumps; clay holds a cut face)
 *   phi        friction angle, degrees (the angle of repose of a loose pile)
 *   swell      loose volume ÷ bank volume once dug (bulking)
 *   dig        J/m³: the energy a crater spends per cubic metre it throws out, calibrated so a kilogram of TNT on loam
 *              leaves a crater about a metre in radius (the cratering charts' order), the coupling folded in
 * LIQUIDS are the same principle at its end: c 0 and φ 0 (no shear strength at rest), so a heap of them goes flat, and
 * their weight becomes pressure in every direction (rupa/fluid.js). Two numbers of their own:
 *   viscosity  Pa·s: how fast it flows (water 0.001, honey 10, lava 1000): a rate, not a strength
 *   yield      Pa: the stress below which a thick liquid holds a slope (a Bingham fluid: mud, lava); 0 for water
 *
 * COLLISION adds one number:
 *   bounce     coefficient of restitution against a rigid wall (0 dead, 1 elastic). Two bodies meeting take the lower:
 *              the share of the closing energy that is NOT dissipated is bounce²
 *
 * HEAT is its own set of numbers, not derived from the rest (it is cohesion again, the bonds given way to heat, but
 * strength says nothing of it: steel is far stronger than concrete and loses half that strength by about 550 °C):
 *   melt       °C where it melts (null: it burns or crumbles first)
 *   soften     °C where it keeps half its strength (heatFactor: whole at 20 °C, half here, nothing at `melt`), so a
 *              heated support carries less and the load pass brings it down
 *   heat       specific heat, J/(kg·K): the joules one kilogram takes per degree
 *   fusion     latent heat, J/kg: the joules one kilogram takes, at `melt`, to turn liquid
 *   ignite     °C where it catches (combustible stuff only)
 *   burn       heat of combustion, J/kg (combustible only): what its fuel gives as it burns, at the char rate (CHAR_RATE,
 *              Eurocode 5's ~0.65 mm/min into each exposed face)
 *
 *   MATTER                 the table
 *   MATTER_IDS, SOIL_IDS
 *   CLASS_MATTER           a class's matter when the thing names none (breakability.js classOf): { matter, fill }
 *   resolveMatter(spec, where?) → a matter record (an id, or { is?, ...overrides } over one), checked
 *   TRANSPORT              { id: { k, emissivity } }: how heat moves through and off each matter, its own table beside
 *                          MATTER (the science worlds' heat law reads it; no game page does)
 *   isBrittle(m), isSoil(m), isLiquid(m), isGas(m), isFluid(m), isPlastic(m), isCuttable(m), LIQUID_IDS, PLASTIC_IDS
 *   a block's `porosity` (0 solid, to under 1) is the open share of it a flow can pass through (a hedge, a slatted fence,
 *   a mesh): see the runtime's blocking law; `{ matter, porosity }` sets it
 *   an edge CUTS what is plastic or fibrous (wood), not what shatters or crumbles: a cuttable block carries `kerfWork`,
 *   J/m², the work a cut costs per square metre of its face (its fracture energy, plus its flow or tensile strength
 *   over the KERF an edge opens), and `kerfHard`, Pa, what an edge must be harder than to bite (its hardness, 3 ×
 *   yield; a wood's crushing strength)
 *   a block's `joint` is how it sits on what holds it: 'mortar' (masonry's default: its cohesion binds the joint) or
 *   'dry' (everything else: it rests by its weight alone, so wind can slide or tip it); `{ matter, joint }` says otherwise
 *   cutOfMatter(m)         → the cut a breaking of it plays (destruct/cuts.js presets): glass and ice shatter, brittle
 *                            masonry blasts apart, ductile stuff chips
 *   blockMatter(box, spec) → { matter, fill, mass, joules, compressive, cohesion, heatCap, soften, stiff, bounce, frac,
 *                            shape, spread, joint, melt?,
 *                            fuse?, ignite?, fuel?, burnRate?, yield?, wall?, kerfWork?, kerfHard? } for a block (`stiff` its E × fill, Pa: a shell gives): the numbers the runtime reads (`cohesion` its
 *                            matter's bond × fill, Pa: a block's `bond` word is how it is held; `heatCap` J/K; `fuse` the
 *                            joules to melt it once at `melt`; `fuel` the joules its burning gives, `burnRate` how fast, W;
 *                            a plastic block's `yield`, Pa, and `wall`, m, the thickness a blow must pass to go through
 *                            a shell: fill × volume ÷ its surface; absent for a solid, whose thickness is its box's)
 *   meltJoules(m, mass, from?) → the joules that take `mass` kg of it from `from` °C (20) to liquid (null: it does not melt)
 *   isCombustible(m)
 */
import { MATERIALS } from '../strength/materials.js';

const MPa = 1e6, GPa = 1e9;
const M = (id, o) => Object.freeze({ id, ...o });

// from the strength table: MPa → Pa, g/cm³ → kg/m³; a metal's toughness is its (yield + ultimate) / 2 × elongation
function fromStrength(key, o) {
  const s = MATERIALS[key];
  const ult = s.ultimate ?? s.strength;
  return M(o.id, {
    label: o.label, family: s.family, from: key, density: s.density * 1000, E: s.E * MPa,
    compressive: (o.compressive ?? s.strength) * MPa, tensile: (o.tensile ?? ult) * MPa, bond: (o.bond ?? ult) * MPa,
    strain: o.strain ?? s.elong / 100,
    toughness: o.toughness ?? ((s.strength + ult) / 2) * MPa * (s.elong / 100),
    fill: o.fill ?? 1,
    // where the table's strength is a yield (a ductile metal), it is this matter's yield too: one truth for both
    ...(s.basis === 'yield' ? { yield: s.strength * MPa } : {}),
  });
}

const BASE = {
  // ── masonry and stone: strong in compression, weak in tension, brittle ──
  concrete: M('concrete', { label: 'Concrete (plain)', family: 'masonry', density: 2400, E: 30 * GPa, compressive: 30 * MPa, tensile: 3 * MPa, bond: 3 * MPa, strain: 0.0035, toughness: 80e3, fill: 1 }),
  // rebar at about 1.5 % of the section carries the tension and most of the toughness (1.5 % of steel's)
  'reinforced-concrete': M('reinforced-concrete', { label: 'Reinforced concrete', family: 'masonry', density: 2500, E: 30 * GPa, compressive: 30 * MPa, tensile: 8 * MPa, bond: 8 * MPa, strain: 0.01, toughness: 1.2e6, fill: 1 }),
  brick: M('brick', { label: 'Brick (mortared)', family: 'masonry', density: 1900, E: 15 * GPa, compressive: 20 * MPa, tensile: 2 * MPa, bond: 0.3 * MPa, strain: 0.003, toughness: 30e3, fill: 1 }),
  stone: M('stone', { label: 'Granite', family: 'masonry', density: 2700, E: 50 * GPa, compressive: 150 * MPa, tensile: 10 * MPa, bond: 0.5 * MPa, strain: 0.003, toughness: 225e3, fill: 1 }),
  sandstone: M('sandstone', { label: 'Sandstone', family: 'masonry', density: 2300, E: 15 * GPa, compressive: 50 * MPa, tensile: 4 * MPa, bond: 0.3 * MPa, strain: 0.004, toughness: 100e3, fill: 1 }),
  adobe: M('adobe', { label: 'Adobe (mud brick)', family: 'masonry', density: 1700, E: 0.5 * GPa, compressive: 2 * MPa, tensile: 0.2 * MPa, bond: 0.05 * MPa, strain: 0.01, toughness: 10e3, fill: 1 }),
  ceramic: M('ceramic', { label: 'Fired clay (terracotta)', family: 'masonry', density: 1900, E: 20 * GPa, compressive: 50 * MPa, tensile: 5 * MPa, bond: 0.3 * MPa, strain: 0.001, toughness: 2e3, fill: 1 }),
  // ── glassy: elastic to the end, then shards; its toughness is its resilience σ²/2E ──
  glass: M('glass', { label: 'Glass (soda-lime)', family: 'glass', density: 2500, E: 70 * GPa, compressive: 1000 * MPa, tensile: 50 * MPa, bond: 50 * MPa, strain: 0.001, toughness: 18e3, fill: 1 }),
  ice: M('ice', { label: 'Ice', family: 'glass', density: 917, E: 9 * GPa, compressive: 5 * MPa, tensile: 1 * MPa, bond: 1 * MPa, strain: 0.002, toughness: 5e3, fill: 1 }),
  // ── metals and woods, from the strength table ──
  steel: fromStrength('s235', { id: 'steel', label: 'Mild steel (solid)' }),
  'sheet-metal': fromStrength('s235', { id: 'sheet-metal', label: 'Sheet steel (a shell round air)', fill: 0.02 }),
  brass: fromStrength('brass', { id: 'brass', label: 'Brass (half hard)' }),
  // rolled homogeneous armour: about four times mild steel's yield for half its elongation; a weld holds under the plate
  'armour-steel': M('armour-steel', { label: 'Armour steel (rolled homogeneous)', family: 'metal', density: 7850, E: 207 * GPa, compressive: 950 * MPa, tensile: 1100 * MPa, bond: 700 * MPa, strain: 0.14, toughness: 143e6, fill: 1, yield: 950 * MPa }),
  // 6061-T6 plate; its weld is weaker than the plate (the heat-affected zone)
  aluminium: M('aluminium', { label: 'Aluminium (6061-T6)', family: 'metal', density: 2700, E: 69 * GPa, compressive: 276 * MPa, tensile: 310 * MPa, bond: 200 * MPa, strain: 0.12, toughness: 35e6, fill: 1, yield: 276 * MPa }),
  lead: M('lead', { label: 'Lead (cast)', family: 'metal', density: 11340, E: 16 * GPa, compressive: 5 * MPa, tensile: 17 * MPa, bond: 17 * MPa, strain: 0.5, toughness: 5.5e6, fill: 1, yield: 5 * MPa }),
  // moulded plastic (a drum, a tote, a case): polycarbonate's numbers from the strength table, a shell round air
  plastic: fromStrength('pc', { id: 'plastic', label: 'Moulded plastic (a shell round air)', fill: 0.04 }),
  // ── pastes: solids soft enough to flow under a blow and keep the shape it leaves, far more ductile than any metal
  //    (they spread rather than tear): the cohesion dial's step between a Bingham liquid and a metal. Their yield is an
  //    impact's, the stiff end of their range (a paste creeps under far less, given time) ──
  putty: M('putty', { label: 'Modelling clay (plasticine)', family: 'paste', density: 1800, E: 1e6, compressive: 40e3, tensile: 60e3, bond: 40e3, strain: 1, toughness: 50e3, fill: 1, yield: 40e3 }),
  dough: M('dough', { label: 'Bread dough', family: 'paste', density: 1150, E: 1e5, compressive: 5e3, tensile: 15e3, bond: 5e3, strain: 3, toughness: 30e3, fill: 1, yield: 5e3 }),
  // clear wood: compressive along the grain about half its bending strength; toughness the work to maximum load in
  // bending (USDA Wood Handbook order), not the metal formula
  timber: fromStrength('oak', { id: 'timber', label: 'Oak timber', compressive: 45, tensile: 99, bond: 5, strain: 0.01, toughness: 100e3 }),
  pine: fromStrength('pine', { id: 'pine', label: 'Pine boards', compressive: 30, tensile: 59, bond: 3, strain: 0.01, toughness: 50e3 }),
  drywall: M('drywall', { label: 'Stud wall (gypsum board)', family: 'board', density: 700, E: 2 * GPa, compressive: 3 * MPa, tensile: 0.5 * MPa, bond: 0.2 * MPa, strain: 0.005, toughness: 5e3, fill: 0.1 }),
  bone: M('bone', { label: 'Bone (cortical)', family: 'bone', density: 1900, E: 17 * GPa, compressive: 170 * MPa, tensile: 130 * MPa, bond: 1 * MPa, strain: 0.02, toughness: 2e6, fill: 0.3 }),
  // ── soils: cohesion and friction (Mohr–Coulomb), the swell of a dug bank, the energy a crater spends ──
  sand: M('sand', { label: 'Dry sand', family: 'soil', density: 1600, E: 0.03 * GPa, compressive: 0.2 * MPa, tensile: 0, bond: 0, strain: 0.05, toughness: 20e3, fill: 1, c: 0, phi: 32, swell: 1.12, dig: 5e6 }),
  loam: M('loam', { label: 'Loam (topsoil)', family: 'soil', density: 1500, E: 0.02 * GPa, compressive: 0.15 * MPa, tensile: 5e3, bond: 5e3, strain: 0.08, toughness: 25e3, fill: 1, c: 5e3, phi: 28, swell: 1.25, dig: 6.7e6 }),
  clay: M('clay', { label: 'Stiff clay', family: 'soil', density: 1800, E: 0.05 * GPa, compressive: 0.3 * MPa, tensile: 12e3, bond: 12e3, strain: 0.1, toughness: 40e3, fill: 1, c: 12e3, phi: 20, swell: 1.3, dig: 10e6 }),
  gravel: M('gravel', { label: 'Gravel', family: 'soil', density: 1900, E: 0.1 * GPa, compressive: 0.4 * MPa, tensile: 0, bond: 0, strain: 0.05, toughness: 30e3, fill: 1, c: 0, phi: 38, swell: 1.12, dig: 8e6 }),
  snow: M('snow', { label: 'Packed snow', family: 'soil', density: 350, E: 0.001 * GPa, compressive: 0.05 * MPa, tensile: 1e3, bond: 1e3, strain: 0.1, toughness: 3e3, fill: 1, c: 1e3, phi: 30, swell: 1, dig: 1e6 }),
  // ── liquids: cohesion tuned to nothing that holds a shape (c 0, φ 0: no shear strength at rest, so the surface goes
  //    flat), the weight that remains is pressure in every direction; how FAST it flows is its own dial, viscosity, and
  //    a thick one holds a low heap until the slope's stress passes its yield (a Bingham fluid: mud, lava) ──
  water: M('water', { label: 'Fresh water', family: 'liquid', density: 1000, c: 0, phi: 0, viscosity: 1e-3, yield: 0 }),
  seawater: M('seawater', { label: 'Seawater', family: 'liquid', density: 1025, c: 0, phi: 0, viscosity: 1.08e-3, yield: 0 }),
  oil: M('oil', { label: 'Oil (olive)', family: 'liquid', density: 910, c: 0, phi: 0, viscosity: 0.08, yield: 0 }),
  honey: M('honey', { label: 'Honey', family: 'liquid', density: 1420, c: 0, phi: 0, viscosity: 10, yield: 0 }),
  mud: M('mud', { label: 'Mud (slurry)', family: 'liquid', density: 1600, c: 0, phi: 0, viscosity: 50, yield: 200 }),
  lava: M('lava', { label: 'Basaltic lava', family: 'liquid', density: 2600, c: 0, phi: 0, viscosity: 1000, yield: 500 }),
  // ── a gas: the same fluid law at its lightest (no shear strength, its weight pressure, its motion drag): the air the
  //    world stands in; the wind is this matter moving ──
  air: M('air', { label: 'Air (sea level, 20 °C)', family: 'gas', density: 1.204, c: 0, phi: 0, viscosity: 1.81e-5, yield: 0 }),
};

// HEAT, its own numbers (handbook orders): melt and soften °C, heat J/(kg·K), fusion J/kg; ignite °C and burn J/kg for
// what burns. Concrete spalls and loses half its strength near 500 °C long before it melts; steel near 550 °C; timber
// chars and burns; ice and snow melt at 0 °C; sand melts to glass.
const T = (melt, soften, heat, fusion, more = {}) => ({ melt, soften, heat, fusion, ...more });
const THERMAL = {
  concrete: T(1500, 500, 880, 4e5), 'reinforced-concrete': T(1500, 550, 880, 4e5), brick: T(1600, 900, 840, 4e5),
  stone: T(1250, 600, 790, 4e5), sandstone: T(1700, 600, 920, 4e5), adobe: T(1200, 700, 900, 4e5), ceramic: T(1600, 1000, 850, 4e5),
  glass: T(1400, 550, 840, 2e5), ice: T(0, -2, 2100, 334e3),
  steel: T(1510, 550, 490, 270e3), 'sheet-metal': T(1510, 550, 490, 270e3), 'armour-steel': T(1500, 550, 470, 270e3),
  brass: T(930, 400, 380, 168e3), aluminium: T(660, 300, 900, 397e3), lead: T(327, 150, 130, 23e3),
  // (a thermoplastic: softens near 125 °C and burns, as what burns here has no melt of its own)
  plastic: T(null, 125, 1200, 0, { ignite: 450, burn: 30e6 }),
  putty: T(70, 35, 1500, 1e5), dough: T(null, 60, 2500, 0),
  timber: T(null, 200, 1700, 0, { ignite: 300, burn: 15e6 }), pine: T(null, 200, 1700, 0, { ignite: 280, burn: 17e6 }),
  drywall: T(1450, 600, 1090, 4e5), bone: T(1670, 300, 1300, 4e5),
  sand: T(1700, 1200, 830, 4e5), loam: T(1150, 900, 1000, 4e5), clay: T(1200, 900, 920, 4e5), gravel: T(1200, 900, 840, 4e5),
  snow: T(0, -2, 2100, 334e3),
};
// BOUNCE, the coefficient of restitution against a rigid wall (handbook and drop-test orders): metals and glass ring,
// masonry thuds, soils and snow take it dead
const BOUNCE = {
  concrete: 0.2, 'reinforced-concrete': 0.2, brick: 0.2, stone: 0.3, sandstone: 0.2, adobe: 0.1, ceramic: 0.3, glass: 0.4, ice: 0.3,
  steel: 0.5, 'sheet-metal': 0.3, 'armour-steel': 0.5, brass: 0.45, aluminium: 0.4, lead: 0.05, plastic: 0.35, putty: 0.02, dough: 0, timber: 0.4, pine: 0.4, drywall: 0.1, bone: 0.4, sand: 0.05, loam: 0.05, clay: 0.03, gravel: 0.1, snow: 0.02,
  water: 0, seawater: 0, oil: 0, honey: 0, mud: 0, lava: 0, air: 0,
};
// DEBRIS, what a breaking leaves (handbook orders): `frac` the fracture energy, J/m² (the joules one square metre of new
// crack costs: glass a few, concrete ~100, wood ~10⁴, a ductile steel ~10⁵, so the same joules shatter glass and only
// split timber); `shape` how its pieces come (glass shards, masonry chunks, wood splinters, metal torn plates, soil clods);
// `spread` the Rosin–Rammler uniformity of their sizes (low: from dust to lumps; high: pieces alike). Soils add `mu`, the
// cratering exponent of their ejecta's speeds (Housen–Holsapple: dry sand 0.41, a cohesive soil 0.55). Liquids add
// `tension`, N/m: with viscosity it says whether a hit splashes or plops
const DEBRIS = {
  concrete: [100, 'chunk', 1.2], 'reinforced-concrete': [1000, 'chunk', 1.6], brick: [50, 'chunk', 1.2], stone: [150, 'chunk', 1.4],
  sandstone: [60, 'chunk', 1.2], adobe: [20, 'chunk', 1.0], ceramic: [20, 'shard', 1.3], glass: [8, 'shard', 1.6], ice: [1, 'shard', 1.4],
  steel: [2e5, 'plate', 3], 'sheet-metal': [2e5, 'plate', 3], 'armour-steel': [1e5, 'plate', 3], brass: [1e5, 'plate', 3],
  aluminium: [2e4, 'plate', 3], lead: [5e4, 'plate', 2.5], plastic: [5e3, 'plate', 2.5], putty: [20, 'clod', 1], dough: [5, 'clod', 1], timber: [1e4, 'splinter', 2.5], pine: [6e3, 'splinter', 2.5],
  drywall: [50, 'plate', 1.5], bone: [1e3, 'splinter', 2], sand: [0.1, 'clod', 1], loam: [2, 'clod', 1], clay: [10, 'clod', 1.2],
  gravel: [0.5, 'clod', 1], snow: [1, 'clod', 1],
};
const EJECTA_MU = { sand: 0.41, loam: 0.45, clay: 0.55, gravel: 0.41, snow: 0.4 };
// a soil's loose grain (m), the share of it that is fines (silt and clay, under 63 µm) and its particles' density: thrown,
// its torn-apart soil flies as grains whose size sets their drag, and the fines hang as dust
const SOIL_GRAIN = { sand: [0.0004, 0.02, 2650], loam: [0.0002, 0.4, 2650], clay: [0.0001, 0.6, 2650], gravel: [0.005, 0.05, 2650], snow: [0.001, 0, 917] };
const TENSION = { water: 0.072, seawater: 0.073, oil: 0.032, honey: 0.05, mud: 0.06, lava: 0.35 };
const debrisOf = (k) => (DEBRIS[k] ? { frac: DEBRIS[k][0], shape: DEBRIS[k][1], spread: DEBRIS[k][2] } : {});
export const MATTER = Object.freeze(Object.fromEntries(Object.entries(BASE).map(([k, m]) => [k, Object.freeze({ ...m, ...THERMAL[k], bounce: BOUNCE[k], ...debrisOf(k), ...(EJECTA_MU[k] ? { mu: EJECTA_MU[k] } : {}), ...(SOIL_GRAIN[k] ? { grain: SOIL_GRAIN[k][0], fines: SOIL_GRAIN[k][1], particle: SOIL_GRAIN[k][2] } : {}), ...(TENSION[k] ? { tension: TENSION[k] } : {}) })])));
// TRANSPORT, how heat moves through and off a matter (handbook orders, Incropera & DeWitt's appendix tables): `k` the
// thermal conductivity, W/(m·K); `emissivity` its surface's, 0 to 1 (a dull or oxidized surface, as a thing in a world
// is; a polished metal is far lower). Its own table, exported beside MATTER and never merged into its records: the game
// pages read MATTER, and a science world reads both (science-worlds/matter.js)
const TR = (k, emissivity) => Object.freeze({ k, emissivity });
export const TRANSPORT = Object.freeze({
  concrete: TR(1.4, 0.9), 'reinforced-concrete': TR(1.7, 0.9), brick: TR(0.7, 0.93), stone: TR(2.8, 0.9), sandstone: TR(1.7, 0.9),
  adobe: TR(0.6, 0.9), ceramic: TR(1.0, 0.9), glass: TR(1.0, 0.92), ice: TR(2.2, 0.97),
  steel: TR(50, 0.7), 'sheet-metal': TR(50, 0.7), 'armour-steel': TR(30, 0.7), brass: TR(110, 0.2), aluminium: TR(167, 0.1), lead: TR(35, 0.4),
  putty: TR(0.5, 0.9), dough: TR(0.4, 0.9), timber: TR(0.17, 0.9), pine: TR(0.12, 0.9), drywall: TR(0.17, 0.9), bone: TR(0.4, 0.95),
  sand: TR(0.3, 0.9), loam: TR(0.5, 0.92), clay: TR(1.0, 0.92), gravel: TR(0.7, 0.9), snow: TR(0.2, 0.98),
  water: TR(0.6, 0.96), seawater: TR(0.6, 0.96), oil: TR(0.17, 0.9), honey: TR(0.5, 0.9), mud: TR(1.0, 0.95), lava: TR(1.5, 0.95),
  air: TR(0.026, 0),
});
export const CHAR_RATE = 0.65e-3 / 60;   // m/s, the char front's speed into a face of burning wood (Eurocode 5, softwood)
export const AMBIENT = 20;              // °C
export const MATTER_IDS = Object.freeze(Object.keys(MATTER));
export const SOIL_IDS = Object.freeze(MATTER_IDS.filter((k) => MATTER[k].family === 'soil'));
export const LIQUID_IDS = Object.freeze(MATTER_IDS.filter((k) => MATTER[k].family === 'liquid'));
export const PLASTIC_IDS = Object.freeze(MATTER_IDS.filter((k) => isPlastic(MATTER[k])));

/** A thing's matter by its class (breakability.js classOf) when it names none; a class not here is `brick`. */
export const CLASS_MATTER = Object.freeze({
  crate: { matter: 'pine', fill: 0.02 }, barrel: { matter: 'timber', fill: 0.03 }, chest: { matter: 'timber', fill: 0.04 }, basket: { matter: 'pine', fill: 0.01 }, amphora: { matter: 'ceramic', fill: 0.05 },
  pot: { matter: 'ceramic', fill: 0.05 }, urn: { matter: 'ceramic', fill: 0.05 }, vase: { matter: 'ceramic', fill: 0.05 }, glass: { matter: 'glass', fill: 0.05 },
  planks: { matter: 'pine', fill: 0.5 }, bones: { matter: 'bone' }, lid: { matter: 'stone', fill: 0.5 },
  bench: { matter: 'pine', fill: 0.15 }, chair: { matter: 'pine', fill: 0.1 }, rack: { matter: 'sheet-metal' },
  lockers: { matter: 'sheet-metal' }, cart: { matter: 'pine', fill: 0.15 }, door: { matter: 'timber', fill: 0.5 },
  boulder: { matter: 'stone' }, coffin: { matter: 'timber', fill: 0.1 }, wall: { matter: 'brick' },
  pilaster: { matter: 'stone' }, 'set-piece': { matter: 'concrete', fill: 0.6 }, block: { matter: 'brick' },
});

export const isBrittle = (m) => m.strain < 0.05;
export const isSoil = (m) => m.family === 'soil';
export const isLiquid = (m) => m.family === 'liquid';
export const isGas = (m) => m.family === 'gas';
export const isFluid = (m) => isLiquid(m) || isGas(m);
export const isCombustible = (m) => Number.isFinite(m.ignite) && m.burn > 0;
/** A solid that flows before it breaks: it has a yield, and it is no fluid (a liquid's yield is its Bingham stress) and
 * no soil (ground craters, ground.js). A blow dents it, squashes it or goes through it. */
export function isPlastic(m) { return !(m.family === 'liquid' || m.family === 'gas' || m.family === 'soil') && m.yield > 0; }
/** What an edge cuts rather than breaks: plastic stuff, and wood along or across its grain. */
export const isCuttable = (m) => isPlastic(m) || m.family === 'wood';
export const KERF = 0.002;   // m: the width an edge opens as it cuts

const FIELDS = ['label', 'density', 'E', 'compressive', 'tensile', 'bond', 'strain', 'toughness', 'fill', 'c', 'phi', 'swell', 'dig', 'melt', 'soften', 'heat', 'fusion', 'ignite', 'burn', 'bounce', 'frac', 'shape', 'spread', 'mu', 'tension', 'grain', 'fines', 'particle', 'yield'];

/** A matter by id, or `{ is?, ...fields }` over one (a custom stuff: every number given, or laid over `is`). */
export function resolveMatter(spec, where = 'matter') {
  if (typeof spec === 'string') {
    const m = MATTER[spec];
    if (!m) throw new Error(`${where}: no matter '${spec}' (${MATTER_IDS.join(', ')}), or { is?, density, toughness, … }`);
    return m;
  }
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new Error(`${where} is a matter's name (${MATTER_IDS.join(', ')}) or { is?, density, toughness, … }`);
  for (const k of Object.keys(spec)) if (k !== 'is' && !FIELDS.includes(k)) throw new Error(`${where}.${k} is not part of a matter (is, ${FIELDS.join(', ')})`);
  const base = spec.is !== undefined ? resolveMatter(spec.is, `${where}.is`) : null;
  const out = { id: base ? `${base.id}+` : 'custom', family: base ? base.family : 'custom', ...(base || {}), ...spec };
  delete out.is;
  for (const k of ['density', 'toughness', 'compressive', 'strain']) if (!(Number.isFinite(out[k]) && out[k] > 0)) throw new Error(`${where}.${k} is a number above 0${base ? '' : ' (or name a matter it is, `is`)'}`);
  for (const k of ['tensile', 'bond']) if (out[k] !== undefined && !(Number.isFinite(out[k]) && out[k] >= 0)) throw new Error(`${where}.${k} is a number, 0 or more`);
  if (out.yield !== undefined && !(Number.isFinite(out.yield) && out.yield >= 0)) throw new Error(`${where}.yield is Pa, 0 or more: the stress where it starts to flow (none: it breaks first)`);
  out.tensile = out.tensile ?? 0; out.bond = out.bond ?? out.tensile; out.fill = out.fill ?? 1;
  // heat: a custom stuff with none said neither melts nor burns, and softens where concrete does
  out.melt = out.melt ?? null; out.soften = out.soften ?? 500; out.heat = out.heat ?? 900; out.fusion = out.fusion ?? 0;
  out.E = out.E ?? 10e9; out.bounce = out.bounce ?? 0.2;
  out.frac = out.frac ?? 100; out.shape = out.shape ?? 'chunk'; out.spread = out.spread ?? 1.2;
  if (!['chunk', 'shard', 'splinter', 'plate', 'clod'].includes(out.shape)) throw new Error(`${where}.shape is chunk, shard, splinter, plate or clod`);
  if (!(out.E > 0)) throw new Error(`${where}.E is Pa above 0`);
  if (!(out.bounce >= 0 && out.bounce <= 1)) throw new Error(`${where}.bounce is 0 (dead) to 1 (elastic)`);
  for (const k of ['soften', 'heat']) if (!Number.isFinite(out[k])) throw new Error(`${where}.${k} is a number`);
  if (out.melt !== null && !(Number.isFinite(out.melt) && out.melt > out.soften)) throw new Error(`${where}.melt is °C above its soften (${out.soften}), or null`);
  if ((out.ignite !== undefined) !== (out.burn !== undefined)) throw new Error(`${where}: a stuff that burns says both ignite (°C) and burn (J/kg)`);
  if (!(out.fill > 0 && out.fill <= 1)) throw new Error(`${where}.fill is the solid share of the box, above 0 and at most 1`);
  return Object.freeze(out);
}

/** The cut a breaking plays: glass and ice shatter, brittle masonry blasts apart, a ductile or fibrous stuff chips. */
export function cutOfMatter(m) {
  if (m.family === 'glass') return 'shatter';
  if (isSoil(m)) return 'blast';
  if (isBrittle(m) && m.family === 'masonry') return 'blast';
  return 'chip';
}

const r3 = (x) => Math.round(x * 1e3) / 1e3 + 0;
const sig = (x) => (x === 0 ? 0 : +x.toPrecision(4));

/**
 * A block's numbers for the runtime: its matter (`spec`: an id, a custom record, or { matter, fill }), its fill, its
 * mass (kg), the joules it holds, and the compressive strength and cohesion (its side bonds' strength) it brings (Pa,
 * × fill: a shell carries less).
 */
const checkPorosity = (p, where) => { if (!(Number.isFinite(p) && p >= 0 && p < 1)) throw new Error(`${where}.porosity is the open share of the block, 0 (solid) to under 1`); return p; };
export function blockMatter(box, spec, where = 'matter') {
  const s = spec && typeof spec === 'object' && !Array.isArray(spec) && spec.matter !== undefined ? spec : { matter: spec };
  const m = resolveMatter(s.matter, where);
  if (isLiquid(m)) throw new Error(`${where}: ${m.id} is a liquid: it has no shape to be a block; pour it on the ground (rupa/fluid.js pour) or hold it in a tank`);
  if (isGas(m)) throw new Error(`${where}: ${m.id} is a gas: it has no shape to be a block; it is the medium the world stands in (a level's wind)`);
  const fill = s.fill ?? m.fill;
  if (!(fill > 0 && fill <= 1)) throw new Error(`${where}.fill is the solid share of the box, above 0 and at most 1`);
  const vol = [0, 1, 2].reduce((a, k) => a * Math.max(0, box.max[k] - box.min[k]), 1);
  const mass = m.density * vol * fill;
  const out = { matter: m.id, fill, mass: r3(mass), joules: sig(m.toughness * vol * fill), compressive: sig(m.compressive * fill), cohesion: sig(m.bond * fill), heatCap: sig(mass * m.heat), soften: m.soften, stiff: sig(m.E * fill), bounce: m.bounce,
    frac: m.frac, shape: m.shape, spread: m.spread, joint: s.joint ?? (m.family === 'masonry' ? 'mortar' : 'dry'),
    ...(s.porosity !== undefined ? { porosity: checkPorosity(s.porosity, where) } : {}) };
  if (m.melt !== null && m.melt !== undefined) Object.assign(out, { melt: m.melt, fuse: sig(mass * m.fusion) });
  if (isPlastic(m)) {
    // a shell's wall is what a blow must pass to go through it: the solid share of its box spread over its surface
    const [x, y, z] = [0, 1, 2].map((k) => Math.max(0, box.max[k] - box.min[k])), area = 2 * (x * y + y * z + x * z);
    Object.assign(out, { yield: sig(m.yield), ...(fill < 1 && area > 0 ? { wall: sig((fill * vol) / area) } : {}) });
  }
  if (isCuttable(m)) {
    const plastic = isPlastic(m), [x, y, z] = [0, 1, 2].map((k) => Math.max(0, box.max[k] - box.min[k])), area = 2 * (x * y + y * z + x * z);
    Object.assign(out, { kerfWork: sig(m.frac + (plastic ? m.yield : m.tensile) * KERF), kerfHard: sig(plastic ? 3 * m.yield : m.compressive), tensile: sig(m.tensile * fill),
      ...(fill < 1 && area > 0 && out.wall === undefined ? { wall: sig((fill * vol) / area) } : {}) });
  }
  if (isCombustible(m)) {
    // its exposed faces char inward at CHAR_RATE: the fuel it gives each second is that volume's mass × its heat of combustion
    const [x, y, z] = [0, 1, 2].map((k) => Math.max(0, box.max[k] - box.min[k])), area = 2 * (x * y + y * z + x * z);
    // a solid chars into its faces; a shell (planks round air, a crown's needles) is solid wood charring on both faces of
    // its walls, over twice its box's surface, until its fuel is gone (a crate flares in minutes, a log burns for hours)
    Object.assign(out, { ignite: m.ignite, fuel: sig(mass * m.burn), burnRate: sig(CHAR_RATE * (fill < 1 ? 2 * area : area) * m.density * m.burn) });
  }
  return out;
}

/** The joules that take `mass` kg from `from` °C to liquid: heat × mass × the rise, then the latent heat. Null: it doesn't melt. */
export function meltJoules(m, mass, from = AMBIENT) {
  if (m.melt === null || m.melt === undefined) return null;
  return mass * (m.heat * Math.max(0, m.melt - from) + m.fusion);
}
