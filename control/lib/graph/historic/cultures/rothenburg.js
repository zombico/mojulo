/**
 * Rothenburg ob der Tauber (a free imperial city of Franconia, read at c. 1500 — ../record/rothenburg.js), the first
 * culture whose houses are composed from the inventory of styles and structures (../inventory/) rather than drawn:
 * it builds in the timber-framed tradition (`styles`, ../record/timber-frame.js), its houses spoken in that tradition's
 * Franconian style and its council's stone one, its parish church the landmark library's Gothic church. What the
 * record settles for the town:
 *  - the town on a spur of the plateau above the Tauber, the valley on its west;
 *  - the ring wall, its walk roofed, towers along it and gate towers where the roads leave;
 *  - the market place where the main streets cross, the Gothic town hall on it, St. Jakob a street off it;
 *  - before the fire of 1501: no Renaissance wing on the town hall yet.
 * Colours from the style card (../style/rothenburg.js). Its town is solved from its form (../form/towns.js).
 */
import { ROTHENBURG_ASSETS } from '../assets/rothenburg.js';
import { ROTHENBURG_STYLE } from '../style/rothenburg.js';
import { ROTHENBURG_READ_AT } from '../record/rothenburg.js';
import { RECORDS } from '../ledger/records.js';

const S = ROTHENBURG_STYLE.palette, W = ROTHENBURG_STYLE.kit.wall;

export const ROTHENBURG = {
  label: 'Rothenburg ob der Tauber',
  years: [1350, 1550],
  readAt: ROTHENBURG_READ_AT,       // c. 1500 (../record/rothenburg.js)
  period: 'Late medieval',
  place: 'Rothenburg ob der Tauber, Franconia',
  region: 'germany',
  aliases: ['rothenburg', 'rothenburg ob der tauber', 'medieval town', 'medieval germany', 'free imperial city', 'fachwerk', 'timber-framed town'],   // what people call it (search)
  soundtrack: 'medieval',           // its period music (../soundtrack.js), opt-in on a world: audio.soundtrack 'default'
  record: RECORDS.rothenburg,       // the encyclopedia entry's basis
  styles: ['timber-frame'],         // the building traditions it builds in (../ledger/records.js TRADITIONS)
  land: null,                       // no farm or works kit yet
  palette: {
    ground: S.grass, lane: '#8f8571', street: '#988d78', paving: '#a2988a', square: '#a69c88', court: '#9c9180',
    field: ['#a3a165', '#b9ae6c', '#869257', '#a8995b'],
    water: S.river, bank: '#7a7a5a', cliff: '#9a9178', sand: '#b3a98c',
    wall: S.wallStone, stone: S.stone, plaster: S.render, timber: S.timber, tile: S.tile, roof: S.tile,
    opening: '#231e1a', paint: '#6a4b39', accent: '#7e2f24',
    poplar: '#5e7343', bark: '#594736',
  },
  skins: { kinds: {} },
  patterns: ['towered-wall', 'timber-frame', 'market'],
  wall: { height: W.height, towerHeight: W.towerHeight, gateHeight: W.gateHeight },
  // the Tauber in its valley on the World page: a green river, flowing south
  water: { look: { kind: 'river', tint: '#6c8a7c', flow: [0, 1] }, bed: '#7d7660' },
  assets: ROTHENBURG_ASSETS,
};
