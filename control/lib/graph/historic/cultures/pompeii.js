/**
 * Pompeii (Campania, read on a summer morning of 79 CE — ../record/pompeii.js) as a composition of shared
 * patterns (../patterns.js). The western half of the town on its lava spur: the forum and the old town round it,
 * the theatre quarter, the Stabian Baths, Via dell'Abbondanza to Via Stabiana, the Porta Marina climb. What the
 * record settles for the scene:
 *  - the town mid-repair after the earthquake of 62: each monument's slot carries the record's `state`;
 *  - painted stucco over tufa, limestone and concrete; marble a veneer on a few buildings, much of it stripped;
 *  - low red tile roofs; lava streets between kerbed pavements.
 * Colours from the style card's estimated palette (../style/pompeii.js). Laid out by ../layouts/pompeii.js ('lava-spur').
 */
import { POMPEII_ASSETS } from '../assets/pompeii.js';
import { POMPEII_STYLE } from '../style/pompeii.js';

const S = POMPEII_STYLE.palette;

export const POMPEII = {
  label: 'Pompeii, 79 CE',
  years: [62, 79],
  layout: 'lava-spur',
  palette: {
    ground: '#a99b7c',             // the spur's beaten earth and ash soil
    lane: S.lava, street: S.lava,  // lava paving
    kerb: S.tufa,                  // the pavements' kerbstones
    walk: '#9d917a',               // the pavements' beaten surface
    court: '#c9bea4', paving: '#cdc3ab',
    field: ['#7d8a46', '#8a9150', '#9a9a5c', '#6f7d40'],   // vines and gardens on the plain
    cliff: '#5e564c',              // the lava rock of the bluff
    plain: '#9f9677',
    stucco: S.stucco, plaster: '#e2d3b2', socle: S.red, red: S.red, yellow: S.yellow, black: S.black,
    tufa: S.tufa, limestone: S.limestone, lava: S.lava, travertine: '#d8cdb4', marble: '#ece9e2',
    rock: S.tufa,                  // the theatre's seats
    lardos: S.tufa,                // statue bases
    tile: S.tile, door: '#3b2a1e', shop: '#2f2620', timber: '#6e5238', bronze: '#7d6a45', linen: '#e6dcc4',
    triglyph: '#3d4f74', olive: '#6f7a4c', water: '#5f8a96',
    mosaic: '#e9e4d8',             // the white tesserae of a black-and-white floor
    haze: '#a9b6c0', hazeFar: '#bccad2',
    vesuvius: '#d4dcdf',           // the mountain 8 km off, most of its colour lost to the summer haze
  },
  skins: {
    kinds: {
      cliff: 'bedrock', 'terrace-wall': 'drystone',
      'acropolis-wall': 'isodomic', tower: 'isodomic', gate: 'isodomic', podium: 'isodomic', analemma: 'isodomic', skene: 'isodomic',
      house: 'lime-plaster', 'hall-wall': 'lime-plaster', cella: 'lime-plaster', 'portico-wall': 'lime-plaster', 'court-wall': 'lime-plaster',
    },
    // the houses with shops on the main streets carry the election notices on their fronts
    assets: { 'pp-shop-house': { house: 'dipinti' } },
  },
  patterns: ['podium-temple', 'forum', 'classical-order', 'tile-roof', 'colonnade', 'peristyle', 'atrium-house', 'courtyard-house', 'taberna', 'blank-wall', 'kerbed-street', 'theatre', 'arch', 'towered-wall', 'statue-base', 'street-fountain', 'mosaic-floor', 'painted-notice', 'altar'],
  // the site, metres: the spur's top is z = 0, the plain below it at −`spur` (drawn: the record has no bluff height)
  site: { spur: 18 },
  house: { size: [12, 24], gap: 0.3 },
  lanes: { block: [12, 14] },
  street: { walk: 1.6, kerb: 0.35 },
  // the forum's statues: equestrian bases down the west side, the ones that still carry a statue (record: forum-statue-bases)
  // which of them carried a statue in 79 is unknown (the statues were probably stored after 62): two drawn standing, conjecture
  forum: { equestrian: { bases: 8, standing: [1, 5] } },
  trees: { max: 160 },
  assets: POMPEII_ASSETS,
};
