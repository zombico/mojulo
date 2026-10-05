/**
 * The record behind the Sumerian works (../assets/sumer-works.js): how the town's bricks, pots,
 * blades, wheels, mats and mastic were made, and from what (the copper, flint and fired clay are the
 * farm record's). Same format and checks as ./sumer.js
 * (../record.js). It builds on the town's materials and the farm's (./sumer-farm.js), so check all
 * three together.
 *
 * Every entry here is 'unverified': these are the standard accounts, and no source was read for this
 * pass. checkRecord reports each one.
 */
import { SUMER_SOURCES as S0 } from './sumer.js';

const S = {
  ...S0,
  potts97: { author: 'D. T. Potts', title: 'Mesopotamian Civilization: The Material Foundations', year: 1997 },
  loding74: { author: 'D. Loding', title: 'A Craft Archive from Ur (PhD dissertation, University of Pennsylvania)', year: 1974 },
  nissen70: { author: 'H. J. Nissen', title: 'Grabung in den Planquadraten K/L XII in Uruk-Warka (Baghdader Mitteilungen 5): the bevelled-rim bowls', year: 1970 },
  forbes36: { author: 'R. J. Forbes', title: 'Bitumen and Petroleum in Antiquity', year: 1936 },
  muhly95: { author: 'J. D. Muhly', title: 'Mining and Metalwork in Ancient Western Asia (Civilizations of the Ancient Near East III)', year: 1995 },
  weeks03: { author: 'L. Weeks', title: 'Early Metallurgy of the Persian Gulf: Technology, Trade and the Bronze Age World', year: 2003 },
  oppenheim: { author: 'A. L. Oppenheim', title: 'The Seafaring Merchants of Ur (JAOS 74)', year: 1954 },
};

// ── materials the works add ──
const MATERIALS = [
  {
    id: 'charcoal', kind: 'material', name: 'charcoal (palm, tamarisk, poplar)', confidence: 'unverified',
    attested: { from: -4000, to: null, approx: true, where: ['southern Mesopotamian metal and kiln sites'] }, supply: 'local wood charred in earth-covered clamps',
    role: ['structure'], colour: ['#2f2b28'], notes: 'Fuel for melting and casting; kilns burned reed, brush and dung as much as wood.', sources: [S.moorey94],
  },
  {
    id: 'tin-bronze', kind: 'material', name: 'tin bronze', confidence: 'unverified',
    attested: { from: -2600, to: null, approx: true, where: ['Ur (royal cemetery)', 'Kish'] }, supply: 'copper ingots alloyed with tin brought from far to the east',
    role: ['structure', 'ornament'], colour: ['#b98a4e'],
    notes: 'Regular by the Early Dynastic III graves at Ur; before it the farm\'s copper is copper with arsenic in it, by accident or design.',
    disputes: ['The source of Sumer\'s tin is not settled (Afghanistan and Central Asia are the usual candidates).'],
    sources: [S.moorey94, S.weeks03],
  },
  {
    id: 'basalt', kind: 'material', name: 'basalt and other hard stone (querns, pivots, weights)', confidence: 'unverified',
    attested: { from: -5000, to: null, approx: true, where: ['imported to southern Mesopotamia'] }, supply: 'brought downriver from the north and from the Zagros',
    role: ['structure'], colour: ['#55534f'], notes: 'Saddle querns, door pivots, the potter\'s pivot stone, hammerstones.', sources: [S.moorey94, S.potts97],
  },
];

// ── methods: how things were made ──
const METHODS = [
  {
    id: 'brick-moulding', kind: 'method', name: 'brick moulding: clay and straw trodden, struck in a wooden mould, sun-dried, stacked', confidence: 'unverified',
    attested: { from: -4000, to: null, approx: true }, materials: ['mudbrick-uruk', 'palm-timber'],
    notes: 'Clay dug near water, trodden with chopped straw, thrown into an open frame mould on sanded ground, the mould lifted and the brick left; turned on edge, then stacked. The first brick-making of the year was a rite of the month of bricks.',
    sources: [S.delougaz, S.moorey94],
  },
  {
    id: 'kiln-firing', kind: 'method', name: 'firing in an updraft kiln', confidence: 'unverified',
    attested: { from: -3800, to: null, approx: true }, materials: ['baked-brick', 'fired-clay'],
    notes: 'A fire chamber below with tunnels from outside, the load set on a floor or on itself above, the heat rising through it. Baked brick took fuel the plain hardly had, and went to drains, pavements, the ziggurat\'s casing.',
    sources: [S.moorey94],
  },
  {
    id: 'wheel-throwing', kind: 'method', name: 'pottery thrown on the wheel; mass-made bowls in moulds', confidence: 'unverified',
    attested: { from: -3500, to: null, approx: true }, materials: ['fired-clay', 'basalt'],
    notes: 'The slow wheel (tournette) is older; the fast wheel appears in the Uruk period. The bevelled-rim bowl, crude and made by the million, was pressed in a mould or a hollow in the ground; it is usually read as a ration bowl.',
    disputes: ['What the bevelled-rim bowl held (rations of grain, bread moulds, salt) is argued over.'],
    sources: [S.nissen70, S.moorey94],
  },
  {
    id: 'copper-casting', kind: 'method', name: 'melting and casting copper: bowl hearth, blowpipes, crucible, open and bivalve moulds', confidence: 'unverified',
    attested: { from: -3500, to: null, approx: true }, materials: ['copper', 'charcoal', 'fired-clay', 'limestone'],
    notes: 'Ingots melted in a clay crucible in a charcoal bowl hearth, the heat raised by men blowing through reed pipes with clay tips; cast in open stone moulds or tied bivalve moulds, figures by lost wax; finished by hammering and grinding. Ur III texts name the smiths\' workshop and weigh out metal to it.',
    disputes: ['Bellows (pot bellows) are not clearly shown before the 2nd millennium; blowpipes are the safe reading for Sumer.'],
    sources: [S.moorey94, S.loding74, S.muhly95],
  },
  {
    id: 'charcoal-burning', kind: 'method', name: 'charcoal burning in earth-covered clamps', confidence: 'unverified',
    attested: { from: -4000, to: null, approx: true }, materials: ['palm-timber', 'charcoal'],
    notes: 'Wood stacked round a flue, covered in earth, lit and let to char without flame for days, then raked out.',
    sources: [S.moorey94],
  },
  {
    id: 'flint-knapping', kind: 'method', name: 'flint knapping: blades and sickle teeth', confidence: 'unverified',
    attested: { from: -5400, to: null, approx: true }, materials: ['flint'],
    notes: 'Imported flint struck into blades on an anvil stone; the blades snapped into teeth for sickles and threshing sledges, long after copper came.',
    sources: [S.moorey94],
  },
  {
    id: 'bitumen-mastic', kind: 'method', name: 'bitumen cooked with sand and straw into a mastic', confidence: 'unverified',
    attested: { from: -5000, to: null, approx: true }, materials: ['bitumen', 'reed'],
    notes: 'Raw bitumen from the seeps (Hit on the Euphrates, Iranian sources) heated in pots and tempered with sand, chalk and chopped straw; used for mortar, caulking boats, coating baskets, jars and floors.',
    sources: [S.forbes36, S.connan],
  },
  {
    id: 'reed-working', kind: 'method', name: 'reed cut, bundled, plaited and twisted', confidence: 'unverified',
    attested: { from: -5400, to: null, approx: true }, materials: ['reed'],
    notes: 'Marsh reed cut with sickles, bound in bundles for the frames of houses and boats, split and plaited into mats for roofs, floors and the layers of the ziggurat, twisted into rope.',
    sources: [S.broadbent, S.potts97],
  },
  {
    id: 'solid-wheel-joinery', kind: 'method', name: 'solid wheels of three planks, doweled and battened', confidence: 'unverified',
    attested: { from: -2900, to: null, approx: true }, materials: ['imported-timber', 'palm-timber', 'copper'],
    notes: 'Three planks edge-doweled, the round cut, battens across; copper adzes, saws and chisels, the bow drill for the dowel holes.',
    sources: [S.potts97],
  },
];

// ── workshops and places of work, as types ──
const TYPES = [
  {
    id: 'brick-kiln', kind: 'type', name: 'rectangular updraft brick kiln', confidence: 'unverified',
    built: { from: -3800, to: null, approx: true }, materials: ['mudbrick-uruk', 'baked-brick'], methods: ['kiln-firing'],
    notes: 'Fire tunnels below a chamber of green bricks set to leave flues; the shape is drawn from later and modern Iraqi kilns.', sources: [S.moorey94],
  },
  {
    id: 'potters-workshop', kind: 'type', name: 'potters\' workshop: wheel, settling tanks, kilns, wasters', confidence: 'unverified',
    built: { from: -3500, to: null, approx: true }, materials: ['fired-clay', 'reed', 'baked-brick'], methods: ['wheel-throwing', 'kiln-firing'],
    notes: 'Workshops with kilns found at the edges of towns (Uruk, Ur); the yard here is a generic arrangement, not a plan in hand.', sources: [S.moorey94],
  },
  {
    id: 'smiths-workshop', kind: 'type', name: 'coppersmiths\' workshop', confidence: 'unverified',
    built: { from: -3000, to: null, approx: true }, materials: ['mudbrick-uruk', 'copper', 'charcoal', 'limestone'], methods: ['copper-casting'],
    notes: 'The temple and palace kept their own craft workshops; the Ur III craft archive records metal issued and returned. No smithy plan is in hand; this one is a walled yard with a store room.',
    sources: [S.loding74, S.moorey94],
  },
  {
    id: 'river-landing', kind: 'type', name: 'landing for imported stone, metal and bitumen', confidence: 'unverified',
    built: { from: -3500, to: null, approx: true }, materials: ['baked-brick', 'limestone', 'basalt', 'bitumen'],
    notes: 'The plain had no stone, ore or tall timber: all came by river and, by the 3rd millennium, by sea from Dilmun and Magan to the quays of Ur.', sources: [S.oppenheim, S.potts97],
  },
];

const FORMS = [
  {
    id: 'craft-quarter', kind: 'form', name: 'works at the town\'s edge, by the water', confidence: 'unverified',
    attested: { from: -3500, to: null, approx: true },
    notes: 'Kilns and smoky crafts kept to the town\'s edge and outskirts, by the canals that brought clay, fuel and goods.', sources: [S.moorey94, S.potts97],
  },
];

export const SUMER_WORKS_RECORD = [...MATERIALS, ...METHODS, ...TYPES, ...FORMS];
