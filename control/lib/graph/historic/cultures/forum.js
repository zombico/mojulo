/**
 * The Forum Romanum (Rome, read on a summer day of 79 CE — ../record/forum.js): a close-scale study beside the Pompeii
 * town, one civic space at walking scale where the detail is in the buildings. Its parts are the orders
 * (../assets/orders.js) standing as instances; its buildings ../assets/forum.js; laid out by ../layouts/forum.js
 * ('forum') at measured positions, not generated. Colours from the style card (../style/forum.js).
 */
import { FORUM_STYLE } from '../style/forum.js';
import { FORUM_READ_AT, FORUM_RECORD, FORUM_SOURCES } from '../record/forum.js';

const S = FORUM_STYLE.palette;

export const FORUM = {
  label: 'Forum Romanum, 79 CE',
  years: [64, 79],
  readAt: FORUM_READ_AT,         // a summer day of 79 CE, Titus's first weeks (../record/forum.js)
  period: 'Early Imperial (Flavian)',
  place: 'Rome, the Forum Romanum',
  region: 'italy',
  // history (../lineage.js): the orders from the Greek world; Pompeii is the same moment in a country town
  draws: [
    { from: 'lindos', kind: 'inherits', parts: ['patterns'], note: 'the Hellenistic orders and the colonnade' },
    { from: 'pompeii', kind: 'contemporary', parts: ['skins', 'patterns', 'record', 'dress'], note: 'the same summer of 79 CE, in a Campanian town; its people dressed as Pompeii\'s' },
  ],
  aliases: ['roman forum', 'imperial rome', 'senate house', 'curia', 'temple of saturn', 'vestal'],   // what people call it (search)
  soundtrack: 'roman',                // its period music (../soundtrack.js), opt-in on a world: audio.soundtrack 'default'
  record: { id: 'forum', entries: FORUM_RECORD, sources: FORUM_SOURCES },   // the encyclopedia entry's basis
  layout: 'forum',
  palette: {
    ground: '#b9ad92',             // the beaten ground behind the buildings
    square: S.travertine, street: S.selce, court: '#cbbf9f',
    luna: S.luna, travertine: S.travertine, peperino: S.peperino, tufa: S.tufa, selce: S.selce,
    stucco: '#e6dccb', brick: S.brick, tile: S.tile, bronze: S.bronze, gilt: S.gilt, minium: S.minium,
    tympanum: '#d9d2c4',          // the pediment's field, a shade under the marble round it (the paint unknown)
    door: '#3b2a1e', shop: '#2f2620', rock: '#8c8068', slope: '#7f8a5a', haze: '#a9b6c0',
    fig: '#5f6e3a', timber: '#6e5238', black: '#2a2826', sky: '#cfdde6',   // sky: a window's light seen from inside
    giallo: S.giallo, pavonazzetto: '#d9cfd6', africano: S.africano,   // the captives' coloured marbles (record: aemilia-captives)
  },
  skins: {
    kinds: {
      podium: 'isodomic', cella: 'isodomic', 'hall-wall': 'isodomic', 'tabularium-wall': 'isodomic', rostra: 'isodomic',
      'gallery-back': 'isodomic', clerestory: 'isodomic', 'shop-wall': 'isodomic',
    },
  },
  patterns: ['podium-temple', 'forum', 'classical-order', 'tile-roof', 'colonnade', 'arch', 'statue-base', 'basilica', 'round-temple', 'rostra'],
  site: { frame: { w: 270, d: 150 } },
};
