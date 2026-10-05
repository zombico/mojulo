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

const S = QIN_STYLE.palette, WARD = QIN_STYLE.kit.wall.ward;

export const QIN = {
  label: 'Qin Xianyang',
  years: [-350, -206],
  layout: 'wei-wards',
  palette: {
    ground: S.loess,               // the loess the town stands on
    lane: '#c3a175',               // beaten loess lanes, darker with traffic
    street: '#b89670',
    court: '#cdb089',              // a beaten-earth court
    paving: '#8f8a80',             // grey fired paving brick (record: paving-brick)
    field: [S.millet, S.wheat, '#a9a35a', '#8f9a55'],
    water: S.river, bank: '#a88c66',
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
  river: { width: 80, sink: 2 },
  house: { size: [12, 18], elite: [16, 24], gap: 0.4 },
  lanes: { block: [8, 11] },
  trees: { max: 220 },
  assets: QIN_ASSETS,
};
