/**
 * historic/inventory/styles — the historic building languages the inventory speaks (./index.js), each an element set
 * in the era library's shape (era/out-anchor-elements.js ELEMENT_SETS) with what the ledger needs beside it:
 *   record  the tradition record it is built from (../ledger/records.js TRADITIONS): the style a card names
 *   cites   the ledger rows (`<record>/<id>`) its walls, cap, frame and house stand on; the anachronism check reads
 *           them wherever a scene builds in the style
 * Values only (a face is a value on a surface group); the culture's palette paints them. Building elements only: a
 * town's lanes, walls and furniture are the solver's, so a style names no lamp or kerb.
 */
const S = (group, value, bond = 'none') => ({ group, value, bond });

export const HISTORIC_STYLES = Object.freeze({
  fachwerk: {
    read: 'a Franconian timber-framed town house: a rubble-stone ground storey under rendered framed storeys, a steep plain-tiled gable to the street, small square lights, a round-headed door in the stone',
    record: 'timber-frame',
    cites: ['timber-frame/oak', 'timber-frame/wattle-daub', 'timber-frame/lime-render', 'timber-frame/rubble-stone', 'timber-frame/plain-tile', 'timber-frame/box-frame', 'timber-frame/infill-panels', 'timber-frame/town-house'],
    storeyH: 2.8,
    elements: {
      wall: { kind: 'wall', storeys: [S('str:stone', 0.6, 'rubble'), S('str:plaster', 0.86)] },
      roof: { kind: 'cap', form: 'gable', pitch: 55, eave: 0.35, group: 'str:tile', value: 0.48, courses: true },
      lights: { kind: 'light', form: 'rect', w: 0.9, h: 1.2, sill: 0.9, bay: 2.4, group: 'str:opening', value: 0.04 },
      door: { kind: 'door', form: 'arch', w: 1.2, h: 2.3 },
      socle: { kind: 'socle', h: 0.4, group: 'str:stone', value: 0.5 },
      sills: { kind: 'sill', h: 0.16, over: 0.06, group: 'str:timber', value: 0.3 },
      frame: { kind: 'frame', member: 0.22, group: 'str:timber', value: 0.26 },
      shutters: { kind: 'shutters', share: 0.35, group: 'str:paint', value: 0.5 },
      stack: { kind: 'chimney', w: 0.6, group: 'str:stone', value: 0.55 },
    },
    compose: { mass: { kind: 'block', w: 7, d: 11 }, storeys: 3 },
  },
});
