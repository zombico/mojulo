/**
 * historic/ledger/building — what the ledger's rows let a builder put up: the SURFACES a wall can show (the skins
 * ../ground.js draws) and the ROOFS a building can carry, each made by the ledger rows named in `by` (`<record>/<id>`).
 * A surface or a roof is in reach at a place and year when any row that makes it is (./index.js `availableAt`), so this
 * table makes no claim of its own: the dates, places and sources are the rows'. A new skin or roof form is a row here
 * naming what makes it; one the record has nothing for waits for its record.
 */

/** Each skin of ../ground.js WALL_SKINS → the ledger rows whose material or method it shows. */
export const SURFACES = Object.freeze({
  mudbrick: { read: 'sun-dried brick in mud mortar', by: ['sumer/mudbrick-ubaid', 'sumer/mudbrick-uruk', 'sumer/riemchen', 'sumer/plano-convex', 'giza/mudbrick-ok', 'lindos/mudbrick-socle'] },
  'nile-brick': { read: 'Nile-mud brick in plain courses', by: ['egypt/mudbrick-nk', 'egypt/eg-nile-silt', 'giza/mudbrick-ok'] },
  'baked-brick': { read: 'fired brick', by: ['sumer/baked-brick', 'pompeii/fired-brick', 'forum/fired-brick'] },
  hangtu: { read: 'rammed loess in board-form lifts', by: ['qin/loess-hangtu', 'qin/rammed-earth-formwork'] },
  'mud-plaster': { read: 'mud render over brick', by: ['sumer/mud-plaster', 'egypt/mud-plaster'] },
  'gypsum-wash': { read: 'gypsum whitewash', by: ['sumer/gypsum-plaster', 'egypt/gypsum-plaster', 'giza/gypsum-mortar'] },
  'lime-plaster': { read: 'lime plaster or whitewash', by: ['sumer/lime-plaster', 'egypt/lime-plaster', 'lindos/lime-stucco', 'forum/stucco', 'pompeii/painted-plaster'] },
  sandstone: { read: 'sandstone ashlar in courses of uneven height', by: ['egypt/silsila-sandstone', 'egypt/eg-sandstone'] },
  'giza-core': { read: 'local limestone in rough courses', by: ['giza/giza-limestone'] },
  'tura-casing': { read: 'fine white limestone dressed smooth', by: ['giza/tura-limestone', 'egypt/limestone'] },
  granite: { read: 'red granite, dressed', by: ['giza/aswan-granite', 'egypt/aswan-granite', 'egypt/eg-granite'] },
  'granite-rough': { read: 'red granite left undressed', by: ['giza/aswan-granite', 'egypt/aswan-granite'] },
  bedrock: { read: 'the living rock, carved in place', by: ['giza/plateau-quarrying', 'lindos/rock-cutting'] },
  drystone: { read: 'field stones laid dry in terrace walls', by: ['lindos/terracing-analemmata'] },
  isodomic: { read: 'ashlar in courses of one height', by: ['lindos/ashlar-masonry', 'pompeii/opus-quadratum', 'forum/opus-quadratum'] },
  'poros-stucco': { read: 'soft stone under lime stucco, false joints drawn', by: ['lindos/stucco-over-poros'] },
  'painted-relief': { read: 'carved relief, painted', by: ['egypt/raised-relief', 'egypt/sunk-relief'] },
  'pylon-relief': { read: 'one colossal carved scene on a pylon', by: ['egypt/battered-pylon'] },
  'painted-bands': { read: 'painted bands on plaster or stone', by: ['egypt/plaster-and-paint'] },
  dipinti: { read: 'painted notices on a stuccoed street front', by: ['pompeii/painted-plaster'] },
  'tile-roof': { read: 'fired roof tiles in rows', by: ['qin/grey-tile', 'lindos/terracotta-tile', 'pompeii/roof-tile', 'forum/roof-tile'] },
  'acanthus-frieze': { read: 'a carved marble scroll frieze', by: ['forum/luna-marble'] },
  'doric-frieze': { read: 'triglyphs and metopes', by: ['forum/luna-marble', 'lindos/doric-order'] },
  'bronze-letters': { read: 'gilt-bronze capitals set in marble', by: ['forum/bronze'] },
  'red-letters': { read: 'capitals cut and painted red', by: ['forum/luna-marble'] },
  'figure-frieze': { read: 'a procession in high relief', by: ['forum/luna-marble'] },
  fasti: { read: 'incised lists in a moulded frame', by: ['forum/luna-marble'] },
  'curtius-relief': { read: 'a framed relief scene', by: ['forum/luna-marble'] },
});

/** The roof forms, each → the rows that build it. */
export const ROOFS = Object.freeze({
  flat: { read: 'beams under reed and mud: a flat roof to live on', by: ['sumer/flat-roof', 'egypt/flat-roof'] },
  'stone-slab': { read: 'stone slabs on architraves, lit by a clerestory', by: ['egypt/clerestory'] },
  'tile-pitched': { read: 'a pitched timber roof under fired tiles', by: ['qin/grey-tile', 'lindos/tiled-timber-roof', 'pompeii/tile-roof', 'forum/roof-tile', 'timber-frame/plain-tile'] },
  thatch: { read: 'a steep roof thatched in straw or reed', by: ['timber-frame/thatch'] },
  'brick-vault': { read: 'a mud-brick barrel vault', by: ['egypt/brick-vault'] },
  'concrete-vault': { read: 'a concrete vault or dome', by: ['pompeii/vault-and-dome', 'forum/opus-caementicium'] },
  corbel: { read: 'courses stepped in to close a roof', by: ['giza/corbelling'] },
  'reed-arch': { read: 'bundled reed arches under mats', by: ['sumer/reed'] },
});
