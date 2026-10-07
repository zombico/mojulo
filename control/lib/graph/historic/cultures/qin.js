/**
 * Qin Xianyang (the Wei valley, read at c. 212 BCE — ../record/qin.js) as a composition of shared patterns
 * (../patterns.js). What the record settles for the town:
 *  - no outer city wall (none has been found): the town is its palace enclosure and its walled wards;
 *  - straight roofs of grey unglazed tile; red columns as the standard (unattested) reading;
 *  - Epang's front hall only begun, across the river; the market a Han analogue.
 * Colours from the style card's sampled palette (../style/qin.js). Laid out by ../layouts/qin.js ('wei-wards').
 */
import { QIN_ASSETS } from '../assets/qin.js';
import { QIN_STYLE } from '../style/qin.js';
import { QIN_READ_AT, QIN_RECORD, QIN_SOURCES } from '../record/qin.js';

const S = QIN_STYLE.palette, WARD = QIN_STYLE.kit.wall.ward;

export const QIN = {
  label: 'Qin Xianyang',
  years: [-350, -206],
  readAt: QIN_READ_AT,           // c. 212 BCE (../record/qin.js)
  period: 'Qin',
  place: 'Xianyang, the Wei valley',
  region: 'china',
  aliases: ['xianyang', 'qin shi huang', 'first emperor', 'warring states', 'terracotta army'],   // what people call it (search)
  soundtrack: 'qin',                // its period music (../soundtrack.js), opt-in on a world: audio.soundtrack 'default'
  record: { id: 'qin', entries: QIN_RECORD, sources: QIN_SOURCES },   // the encyclopedia entry's basis
  layout: 'wei-wards',
  palette: {
    ground: S.loess,               // the loess the town stands on
    lane: '#c3a175',               // beaten loess lanes, darker with traffic
    street: '#b89670',
    court: '#cdb089',              // a beaten-earth court
    paving: '#8f8a80',             // grey fired paving brick (record: paving-brick)
    field: [S.millet, S.wheat, '#a9a35a', '#8f9a55'],
    water: S.river, bank: '#a88c66',
    sand: '#cdb894', wetSand: '#a99a7e',  // the Wei's bars and flats
    cliff: '#c6a378',              // the bare loess of the bluff and the gullies
    haze: '#aab4b2', hazeFar: '#bfc8c8', plainFar: '#cdbb99',   // the distant hills and plain, through the air
    hangtu: S.hangtu, loess: S.loess,
    plaster: S.ochrePlaster, whitePlaster: S.whitePlaster,
    tile: S.tile, red: S.lacquerRed, black: S.lacquerBlack,
    stone: '#b8b2a4',              // the column bases
    door: '#5a2a1e',               // dark red-lacquered doors
    timber: '#6e5238', bark: '#5d4a38', thatch: '#b49a62', linen: '#e6dcc4',
    millet: S.millet, wheat: S.wheat, poplar: S.poplar,
  },
  skins: {
    kinds: {
      terrace: 'hangtu', que: 'hangtu', wall: 'hangtu', 'house-wall': 'hangtu', 'works-earth': 'hangtu',
      'hall-wall': 'lime-plaster', room: 'lime-plaster', gatehouse: 'lime-plaster', 'stall-wall': 'lime-plaster',
      roof: 'tile-roof',
    },
  },
  patterns: ['rammed-earth', 'tiled-roof', 'timber-frame', 'terrace-hall', 'pylon-gate', 'walled-ward', 'courtyard-house', 'blank-wall', 'processional-axis', 'river-front', 'market', 'bridge', 'door-emblem'],
  // scale, metres
  palace: { w: 260, d: 160, wall: { h: 6, base: 4 } },
  ward: { w: 84, d: 86, street: 6, wall: { common: { h: WARD.common, base: 2 }, elite: { h: WARD.elite, base: 3 } } },
  avenue: 20,
  river: { width: 80, sink: 2, bars: 9 },
  // the Xianyang tableland: the palaces on its lip, the wards on the plain below. The height is a guess
  // (record: xianyang-tableland); the bluff, sheer loess, runs at `edge`
  tableland: { h: 10, edge: 184 },
  house: { size: [12, 18], elite: [16, 24], gap: 0.4 },
  lanes: { block: [8, 11] },
  // the Wei on the World page: the native river look, silty and flowing east; its bed seen only at the edges
  water: { look: { kind: 'river', tint: '#8c9a78', flow: [1, 0] }, bed: '#9c8f74' },
  trees: { max: 220 },
  assets: QIN_ASSETS,
};
