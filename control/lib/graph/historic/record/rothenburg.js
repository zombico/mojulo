/**
 * The record behind Rothenburg ob der Tauber, a free imperial city of Franconia on a spur of the plateau above the
 * Tauber, read at c. 1500: before the fire of 1501 and the Renaissance wing of the town hall (1572–78), after the
 * parish church's long building (1311–1485). Same format and checks as ./sumer.js (../record.js).
 *
 * Its houses are the timber-framed tradition's (./timber-frame.js), reached through the card's `styles`; this record
 * holds what is the town's own: its stone, its site, its wall, its market place and the buildings round it.
 *
 * Every entry here is 'unverified': these are the standard accounts of the town, and no source was read for this pass.
 * checkRecord reports each one. Sizes are left out where no measured plan was in hand; the monuments are drawn at the
 * sizes the general accounts give and say so.
 */
import { FRANCONIAN_DRESS } from './dress-franconian.js';

const S = {
  ress59: { author: 'A. Ress', title: 'Die Kunstdenkmäler von Mittelfranken VIII: Stadt Rothenburg o. d. T.', year: 1959 },
  schnurrer97: { author: 'L. Schnurrer', title: 'Rothenburg im Mittelalter: Studien zur Geschichte einer fränkischen Reichsstadt', year: 1997 },
};
const span = (from, o = {}) => ({ from, to: null, approx: true, ...o });

const MATERIALS = [
  { id: 'shell-limestone', kind: 'material', name: 'the shell limestone (Muschelkalk) of the Tauber valley', confidence: 'unverified', attested: span(1140, { where: ['the wall, the gates and towers, the church, the stone houses, cellars and ground storeys'] }), supply: 'quarried in the valley sides below the town', role: ['wall', 'foundation', 'paving'], colour: ['#c4b89f'], disputes: ['which beds the dressed work came from, and how much sandstone was brought in for it, is not settled here'], sources: [S.ress59] },
];

const METHODS = [
  { id: 'ashlar', kind: 'method', name: 'squared stone laid in courses, for the church, the gates and the town hall', confidence: 'unverified', attested: span(1200), materials: ['shell-limestone'], sources: [S.ress59] },
  { id: 'rubble-walling', kind: 'method', name: 'rubble walling in lime mortar, for the town wall and the houses\' ground storeys', confidence: 'unverified', attested: span(1140), materials: ['shell-limestone'], sources: [S.ress59] },
];

const FORMS = [
  { id: 'spur-town', kind: 'form', name: 'the town on a spur of the plateau, the Tauber valley below it on the west and south', confidence: 'unverified', attested: span(1150, { where: ['the castle on the spur\'s tip, the town grown east from it'] }), sources: [S.schnurrer97] },
  { id: 'ring-wall', kind: 'form', name: 'the ring wall: rubble stone, towers along it, gate towers where the roads leave, the walk along its top roofed', confidence: 'unverified', attested: span(1200, { where: ['an inner ring of the 13th century; the wall pushed out in the 14th'] }), sources: [S.ress59, S.schnurrer97] },
  { id: 'market-place', kind: 'form', name: 'the market place where the main streets cross, the town hall on its side, the parish church a street away', confidence: 'unverified', attested: span(1250), sources: [S.schnurrer97] },
  { id: 'free-city', kind: 'form', name: 'a free imperial city, ruled by its council', confidence: 'unverified', attested: span(1274), sources: [S.schnurrer97] },
];

const TYPES = [
  { id: 'rathaus', kind: 'type', name: 'the Gothic town hall on the market place: a long stone hall under a steep roof, its tall tower over it', confidence: 'unverified', built: span(1250), materials: ['shell-limestone'], methods: ['ashlar'], sources: [S.ress59] },
  { id: 'st-jakob', kind: 'type', name: 'St. Jakob, the parish church: a Gothic basilica, its two towers at the east choir, a west choir over the street', confidence: 'unverified', built: span(1311), materials: ['shell-limestone'], methods: ['ashlar'], disputes: ['drawn here from the library\'s Gothic church, its towers at the entrance front, not at the choir'], sources: [S.ress59] },
  { id: 'gate-tower', kind: 'type', name: 'a gate tower over the passage through the wall, a steep roof on it', confidence: 'unverified', built: span(1250), materials: ['shell-limestone'], methods: ['rubble-walling'], sources: [S.ress59] },
  { id: 'stone-house', kind: 'type', name: 'a stone house of the council families on a main street, gable to the street', confidence: 'unverified', built: span(1300), materials: ['shell-limestone'], methods: ['ashlar'], dims: { storeys: [3, 4] }, sources: [S.ress59] },
  { id: 'market-fountain', kind: 'type', name: 'the market fountain: a stone basin and a column in the square', confidence: 'unverified', built: span(1446), materials: ['shell-limestone'], sources: [S.ress59] },
  { id: 'castle', kind: 'type', name: 'the castle on the spur\'s tip, fallen in the earthquake of 1356', confidence: 'unverified', built: span(1142, { to: 1356 }), materials: ['shell-limestone'], methods: ['rubble-walling'], sources: [S.schnurrer97] },
];

export const ROTHENBURG_RECORD = [...MATERIALS, ...METHODS, ...FORMS, ...TYPES, ...FRANCONIAN_DRESS];
export const ROTHENBURG_SOURCES = S;
/** The year the town is read at: before the fire of 1501. */
export const ROTHENBURG_READ_AT = 1500;
