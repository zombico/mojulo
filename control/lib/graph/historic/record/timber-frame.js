/**
 * The record behind the timber-framed house of medieval and early-modern Europe: a TRADITION record (../ledger/
 * records.js registers it with `tradition: true`), keyed by the way of building rather than by one place. A culture
 * card that builds in it names it among its `styles`; the ledger then reaches its rows at that place's year by the
 * row's date for the place's region (`spread`: a span per region id of ../regions.js, read up the region's chain),
 * else by its general `attested` span. Same format and checks as ./sumer.js (../record.js).
 *
 * Every entry here is 'unverified': these are the standard accounts of the tradition, and no source was read for this
 * pass. checkRecord reports each one. The regional dates are the broad ones the surveys give; a town's own record (its
 * dendrochronology, its building ordinances) is where a date for one place belongs.
 */
const S = {
  gerner79: { author: 'M. Gerner', title: 'Fachwerk: Entwicklung, Gefüge, Instandsetzung', year: 1979 },
  binding77: { author: 'G. Binding, U. Mainzer and A. Wiedenau', title: 'Kleine Kunstgeschichte des deutschen Fachwerkbaus', year: 1977 },
  harris78: { author: 'R. Harris', title: 'Discovering Timber-Framed Buildings', year: 1978 },
  brunskill85: { author: 'R. W. Brunskill', title: 'Timber Building in Britain', year: 1985 },
};
const span = (from, o = {}) => ({ from, to: null, approx: true, ...o });

const MATERIALS = [
  { id: 'oak', kind: 'material', name: 'oak, hewn green and pegged', confidence: 'unverified', attested: span(1000, { where: ['across temperate Europe'] }), supply: 'felled and squared near the town, worked green; softwood where oak ran short', role: ['structure'], colour: ['#6b5139'], sources: [S.gerner79, S.brunskill85] },
  { id: 'wattle-daub', kind: 'material', name: 'wattle and daub: woven staves packed with clay, straw and dung', confidence: 'unverified', attested: span(1000, { where: ['the panels between the timbers'] }), supply: 'staves sprung into grooves in the frame, daubed both sides', role: ['wall'], colour: ['#a58f6c'], sources: [S.harris78, S.gerner79] },
  { id: 'lime-render', kind: 'material', name: 'lime plaster and limewash over the infill', confidence: 'unverified', attested: span(1100, { where: ['the panels, often the whole front'] }), supply: 'burnt limestone slaked and mixed with sand and hair; washed white or tinted', role: ['finish'], colour: ['#e6dfcc'], sources: [S.gerner79] },
  { id: 'rubble-stone', kind: 'material', name: 'rubble or roughly coursed stone for the ground storey and the cellar', confidence: 'unverified', attested: span(1000, { where: ['the ground storey of a town house, the plinth under a frame'] }), supply: 'the local stone, laid in lime mortar', role: ['wall', 'foundation'], colour: ['#9a9080'], sources: [S.binding77] },
  { id: 'plain-tile', kind: 'material', name: 'plain roof tiles hung on battens (Biberschwanz in the German lands)', confidence: 'unverified', attested: span(1200, { where: ['town roofs, replacing thatch and shingle as towns ordered it against fire'] }), supply: 'flat fired tiles with a nib, hung in overlapping courses', role: ['roof'], colour: ['#9c4a32'], spread: { germany: span(1300) }, sources: [S.binding77, S.brunskill85] },
  { id: 'thatch', kind: 'material', name: 'thatch of straw or reed', confidence: 'unverified', attested: span(500, { where: ['country roofs everywhere; town roofs until the fire ordinances'] }), supply: 'straw from the fields, reed from the water, laid in courses and sewn down', role: ['roof'], colour: ['#a38c5a'], sources: [S.brunskill85] },
];

const METHODS = [
  { id: 'box-frame', kind: 'method', name: 'the box frame: sills, posts, plates and braces jointed and pegged', confidence: 'unverified', attested: span(1100), materials: ['oak'], sources: [S.harris78, S.gerner79] },
  { id: 'storey-frame', kind: 'method', name: 'storey-by-storey framing (Stockwerkbau): each floor framed on the one below', confidence: 'unverified', attested: span(1300), materials: ['oak'], spread: { germany: span(1350) }, sources: [S.binding77] },
  { id: 'jettying', kind: 'method', name: 'jettying: each upper storey carried out over the one below, toward the street', confidence: 'unverified', attested: span(1250, { to: 1650 }), materials: ['oak'], spread: { germany: span(1300, { to: 1600 }) }, disputes: ['why it spread (floor area over a narrow plot, a stiffer floor, a dry wall below) is argued; town ordinances limited it from the 16th century'], sources: [S.harris78, S.binding77] },
  { id: 'infill-panels', kind: 'method', name: 'the panels filled with wattle and daub and rendered flush', confidence: 'unverified', attested: span(1100), materials: ['wattle-daub', 'lime-render'], sources: [S.gerner79] },
  { id: 'fire-roofs', kind: 'method', name: 'roofs of tile, not thatch or shingle, by town ordinance against fire', confidence: 'unverified', attested: span(1250), materials: ['plain-tile'], spread: { germany: span(1350) }, sources: [S.binding77] },
];

const TYPES = [
  { id: 'town-house', kind: 'type', name: 'the timber-framed town house: a stone ground storey, framed storeys over it, a steep roof, often gable to the street', confidence: 'unverified', built: span(1250), materials: ['oak', 'wattle-daub', 'lime-render', 'rubble-stone', 'plain-tile'], methods: ['box-frame', 'infill-panels'], dims: { storeys: [2, 4] }, sources: [S.binding77, S.harris78] },
  { id: 'hall-house', kind: 'type', name: 'the hall house: an open hall to the roof between storeyed ends', confidence: 'unverified', built: span(1250, { to: 1600 }), materials: ['oak', 'wattle-daub', 'thatch'], methods: ['box-frame'], dims: { storeys: [1, 2] }, sources: [S.harris78, S.brunskill85] },
];

export const TIMBER_FRAME_RECORD = [...MATERIALS, ...METHODS, ...TYPES];
export const TIMBER_FRAME_SOURCES = S;
