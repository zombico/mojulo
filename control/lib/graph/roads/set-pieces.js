/**
 * THE TRACK'S SET PIECES — what fills a trackscape's slots (trackscape.js), written as scapeshift BLOCKS
 * (era/blocks.js: primitives on rails, numbers as expressions, the eye spot gating every part at its ring, the laws), so
 * a set piece is data an agent can read, change and write more of. Two sets, one per kind of racing:
 *
 *   gt     a circuit's furniture: braking boards, hoardings, grandstands, a start gantry, the advert bridge, a control
 *          tower, a billboard, a grove, a light tower
 *   kart   a kart track's: striped bumpers, chevron boards, a bleacher with flags, an arch, a castle tower, giant
 *          mushrooms, a castle for the landmark
 *
 * and what stands beyond the venue (surrounds.js): a house, a chapel, a silo, a farm shed, a tower block.
 *
 * A slot's beat (and a focus's form) picks the piece (SETS); the piece is sized so its least span reads where the slot
 * needs it (the slot's `span`), turned to face the road (or to span it), and built at the ring its read distance is.
 * Its faces are values on surface groups; `paintPiece` colours them in the track's kit (track-kit.js): concrete, steel,
 * tyre and the kit's paint, timber, stone and foliage, drawn by the kit's pole like the track.
 *
 *   TRACK_BLOCKS                             the library (blocks as data)
 *   SETS                                     beat → piece, per set
 *   pieceFor(slot, set, { nth, toward, heading, block? }) → { block, params, yaw, at } (a slot's piece, sized and
 *                                            turned; `block` names one in place of the set's)
 *   buildPiece(piece, { seed })              → the block built (era/blocks.js buildBlock) at its slot
 *   paintPiece(faces, K, { voxel? })         → World faces in the kit (four corners at most; `voxel` the cube's size on the
 *                                            voxel pole, for a far thing)
 *
 * Pure, deterministic.
 */
import { buildBlock } from '../era/blocks.js';
import { STRUCTURE_RINGS } from '../era/out-structures.js';
import { voxelize, voxelFaces, voxelSizeFor } from './voxel-look.js';
import { shadeFaces } from './shaded-look.js';

// ── the library ──
const status = { id: 'lamps', prim: 'lamp', role: 'beacon', r: 0.18, group: 'str:accent' };
export const TRACK_BLOCKS = Object.freeze({
  // ── gt ──
  'marker-board': { id: 'marker-board', read: 'a braking board: bars counting down to the corner on a white board on two posts', tier: 'machine', mounts: ['ground'], functions: ['signal'],
    params: { w: [1, 2.6], h: [1, 2.4], count: [1, 3, 'i'] },
    parts: [
      { id: 'posts', prim: 'box', role: 'frame', size: [0.14, 0.14, 'h + w * 0.55'], at: ['-w * 0.35', 0.1, 0], repeat: { n: 2, step: ['w * 0.7', 0, 0] }, group: 'tech:frame', value: 0.45 },
      { id: 'board', prim: 'panel', role: 'readout', size: ['w', 'w * 1.1'], t: 0.08, at: [0, 0, 'h + w * 0.55'], aim: [0, -1, 0], group: 'tech:skin', value: 0.95 },
      { id: 'bars', prim: 'panel', role: 'trim', size: ['w * 0.72', 'w * 0.14'], t: 0.02, at: [0, -0.05, 'h + w * 0.2'], aim: [0, -1, 0], repeat: { n: 'count', step: [0, 0, 'w * 0.28'] }, group: 'tech:trim', value: 0.35 },
    ], sig: ['board'], lead: 'board' },
  hoarding: { id: 'hoarding', read: 'an advertising hoarding on short legs along the fence', tier: 'machine', mounts: ['ground'], functions: ['signal'],
    params: { w: [3, 8], h: [0.8, 1.6] },
    parts: [
      { id: 'legs', prim: 'box', role: 'frame', size: [0.1, 0.1, 0.6], at: ['-w * 0.4', 0.05, 0], repeat: { n: 3, step: ['w * 0.4', 0, 0] }, group: 'tech:frame', value: 0.4 },
      { id: 'board', prim: 'panel', role: 'readout', size: ['w', 'h'], t: 0.06, at: [0, 0, '0.6 + h / 2'], aim: [0, -1, 0], group: 'tech:trim', value: 0.6 },
      { id: 'band', prim: 'panel', role: 'trim', size: ['w * 0.7', 'h * 0.3'], t: 0.02, at: ['-w * 0.08', -0.04, '0.6 + h * 0.55'], aim: [0, -1, 0], group: 'tech:skin', value: 0.95 },
    ], sig: ['board'], lead: 'board' },
  grandstand: { id: 'grandstand', read: 'a grandstand: tiers of seats stepping back under a cantilevered roof on columns', tier: 'landmark', mounts: ['ground'], functions: [],
    params: { w: [14, 56], rows: [4, 14, 'i'] },
    parts: [
      { id: 'tiers', prim: 'box', role: 'body', size: ['w', 0.95, 0.8], seams: 1.5, at: [0, 0, 0], repeat: { n: 'rows', step: [0, 0.9, 0.55] }, group: 'tech:trim', value: 0.45 },
      { id: 'plinth', prim: 'box', role: 'body', size: ['w', 'rows * 0.9', 0.4], at: [0, 'rows * 0.45 - 0.45', 0], group: 'tech:body', value: 0.55 },
      { id: 'back', prim: 'box', role: 'body', size: ['w', 0.5, 'rows * 0.55 + 3.4'], at: [0, 'rows * 0.9', 0], group: 'tech:body', value: 0.62 },
      { id: 'columns', prim: 'tube', role: 'frame', r: 0.22, from: ['-w / 2 + 1', 'rows * 0.9', 0], to: ['-w / 2 + 1', 'rows * 0.9', 'rows * 0.55 + 3.4'], repeat: { n: 'round(w / 9) + 1', step: ['(w - 2) / round(w / 9)', 0, 0] }, group: 'tech:frame', value: 0.5 },
      { id: 'roof', prim: 'panel', role: 'body', size: ['w / 2 + 0.5', 'rows * 0.9 + 2.5'], t: 0.3, at: ['-w / 4', 'rows * 0.45 - 0.2', 'rows * 0.55 + 3.6'], aim: [0, 0.18, 1], repeat: { n: 2, step: ['w / 2', 0, 0] }, group: 'tech:frame', value: 0.78 },
      { id: 'fascia', prim: 'box', role: 'trim', size: ['w + 1', 0.1, 0.9], at: [0, '-rows * 0.08 - 1.3', 'rows * 0.55 + 2.8'], group: 'tech:trim', value: 0.55 },
    ], sig: ['tiers', 'roof'], lead: 'tiers' },
  gantry: { id: 'gantry', read: 'the start gantry: a truss across the track on two legs, its lights over the grid', tier: 'installation', mounts: ['ground'], functions: ['signal'],
    params: { span: [8, 44], h: [5.5, 8] },
    parts: [
      { id: 'legs', prim: 'box', role: 'frame', size: [0.7, 0.7, 'h + 0.6'], at: ['-span / 2', 0, 0], repeat: { n: 2, step: ['span', 0, 0] }, group: 'tech:frame', value: 0.5 },
      { id: 'beam', prim: 'truss', role: 'frame', from: ['-span / 2', 0, 'h'], to: ['span / 2', 0, 'h'], w: 1.2, member: 0.1, group: 'tech:frame', value: 0.6 },
      { id: 'board', prim: 'panel', role: 'readout', size: ['span * 0.45', 1.1], t: 0.2, at: [0, -0.8, 'h - 0.1'], aim: [0, -1, 0], group: 'tech:glass', value: 0.12 },
      { ...status, id: 'lights', at: ['-span * 0.18', -0.95, 'h - 0.3'], repeat: { n: 5, step: ['span * 0.09', 0, 0] } },
      { id: 'banner', prim: 'box', role: 'trim', size: ['span * 0.9', 0.08, 0.8], at: [0, -0.7, 'h + 0.5'], group: 'tech:trim', value: 0.6 },
    ], sig: ['beam', 'board'], lead: 'beam' },
  bridge: { id: 'bridge', read: 'the advert bridge: a deck across the track on two piers, its face a hoarding', tier: 'landmark', mounts: ['ground'], functions: ['pass'],
    params: { span: [10, 50], h: [5.5, 8] },
    parts: [
      { id: 'piers', prim: 'box', role: 'pier', size: [1.4, 3, 'h'], at: ['-span / 2 - 0.7', 0, 0], repeat: { n: 2, step: ['span + 1.4', 0, 0] }, group: 'tech:body', value: 0.6 },
      { id: 'deck', prim: 'box', role: 'span', size: ['span + 2.8', 3, 1.3], at: [0, 0, 'h'], group: 'tech:body', value: 0.7 },
      { id: 'face', prim: 'box', role: 'trim', size: ['span + 2', 0.1, 1.6], at: [0, -1.55, 'h - 0.15'], group: 'tech:trim', value: 0.6 },
      { id: 'rail', prim: 'box', role: 'frame', size: ['span + 2.8', 0.12, 1], at: [0, -1.4, 'h + 1.3'], group: 'tech:frame', value: 0.5 },
    ], sig: ['deck', 'piers'], lead: 'deck' },
  tower: { id: 'tower', read: 'a control tower: a pale shaft, a band of dark glass at the top, a roof and a mast', tier: 'landmark', mounts: ['ground'], functions: ['sense'],
    params: { h: [10, 60], w: [5, 24] },
    parts: [
      { id: 'shaft', prim: 'box', role: 'body', size: ['w', 'w', 'h'], seams: 3, group: 'tech:body', value: 0.75 },
      { id: 'glass', prim: 'box', role: 'body', size: ['w * 1.25', 'w * 1.25', 'max(2.4, h * 0.12)'], at: [0, 0, 'h'], group: 'tech:glass', value: 0.12 },
      { id: 'roof', prim: 'box', role: 'body', size: ['w * 1.4', 'w * 1.4', 0.6], at: [0, 0, 'h + max(2.4, h * 0.12)'], group: 'tech:frame', value: 0.7 },
      { id: 'mast', prim: 'tube', role: 'sensor', r: 0.25, from: [0, 0, 'h + max(2.4, h * 0.12) + 0.6'], to: [0, 0, 'h * 1.3 + 4'], group: 'tech:frame', value: 0.45 },
      { id: 'band', prim: 'panel', role: 'trim', size: ['w', 'max(1.2, h * 0.05)'], t: 0.05, at: [0, '-w / 2 - 0.05', 'h * 0.85'], aim: [0, -1, 0], group: 'tech:trim', value: 0.55 },
    ], sig: ['shaft', 'glass'], lead: 'shaft' },
  billboard: { id: 'billboard', read: 'a billboard high on a lattice: one picture, big', tier: 'installation', mounts: ['ground'], functions: ['signal'],
    params: { w: [6, 30], h: [4, 14] },
    parts: [
      { id: 'legs', prim: 'truss', role: 'frame', from: ['-w * 0.3', 0.6, 0], to: ['-w * 0.3', 0.6, 'h'], w: 0.8, member: 0.08, repeat: { n: 2, step: ['w * 0.6', 0, 0] }, group: 'tech:frame', value: 0.45 },
      { id: 'board', prim: 'panel', role: 'readout', size: ['w', 'w * 0.42'], t: 0.3, at: [0, 0, 'h + w * 0.21'], aim: [0, -1, 0], group: 'tech:trim', value: 0.6 },
      { id: 'frame', prim: 'panel', role: 'trim', size: ['w * 0.6', 'w * 0.12'], t: 0.04, at: ['-w * 0.12', -0.2, 'h + w * 0.26'], aim: [0, -1, 0], group: 'tech:skin', value: 0.95 },
    ], sig: ['board'], lead: 'board' },
  tree: { id: 'tree', read: 'a tree: a trunk and two cones of crown', tier: 'machine', mounts: ['ground'], functions: [],
    params: { h: [6, 22] },
    parts: [
      { id: 'trunk', prim: 'drum', role: 'body', r: 'h * 0.035', h: 'h * 0.35', sides: 6, group: 'str:timber', value: 0.4 },
      { id: 'crown', prim: 'cone', role: 'body', r: 'h * 0.24', h: 'h * 0.55', at: [0, 0, 'h * 0.25'], sides: 7, group: 'str:motif', value: 0.45 },
      { id: 'top', prim: 'cone', role: 'body', r: 'h * 0.17', h: 'h * 0.42', at: [0, 0, 'h * 0.58'], sides: 7, group: 'str:motif', value: 0.6 },
    ], sig: ['crown'], lead: 'crown' },
  grove: { id: 'grove', read: 'a grove: a stand of tall trees, one taller', tier: 'landmark', mounts: ['ground'], functions: [],
    params: { r: [3, 12], h: [10, 26] },
    parts: [
      { id: 'hero', block: 'tree', role: 'body', params: { h: 22 } },
      { id: 'ring', block: 'tree', role: 'body', params: { h: 10 }, repeat: { n: 'round(2 + 2 * many)', around: 'r' } },
    ], sig: ['hero'], lead: 'hero' },
  'light-tower': { id: 'light-tower', read: 'a floodlight tower: a lattice mast and a bank of lamps at its head', tier: 'landmark', mounts: ['ground'], functions: ['light'],
    params: { h: [14, 40] },
    parts: [
      { id: 'mast', prim: 'truss', role: 'frame', from: [0, 0, 0], to: [0, 0, 'h'], w: 'max(0.8, h * 0.05)', member: 0.1, group: 'tech:frame', value: 0.5 },
      { id: 'head', prim: 'panel', role: 'lamp', size: ['h * 0.22', 'h * 0.12'], t: 0.3, at: [0, -0.5, 'h + h * 0.06'], aim: [0, -1, 0.3], group: 'tech:light', value: 0.95 },
    ], sig: ['mast', 'head'], lead: 'mast' },
  // ── a venue's buildings and furniture (the local areas: local-area.js) ──
  'pit-module': { id: 'pit-module', read: 'a module of the pit building: a row of garage doors under a band of dark glass, a roof overhang and a sign band', tier: 'landmark', mounts: ['ground'], functions: ['keep'],
    params: { len: [10, 50], depth: [6, 20], h: [4, 11] },
    parts: [
      { id: 'body', prim: 'box', role: 'shell', size: ['len', 'depth', 'h'], seams: 3, group: 'tech:body', value: 0.75 },
      { id: 'doors', prim: 'panel', role: 'door', size: ['min(4.4, len / round(len / 5.5) * 0.8)', 'h * 0.42'], t: 0.08, at: ['-len / 2 + len / round(len / 5.5) / 2', '-depth / 2 - 0.05', 'h * 0.21'], aim: [0, -1, 0], repeat: { n: 'round(len / 5.5)', step: ['len / round(len / 5.5)', 0, 0] }, group: 'tech:frame', value: 0.4 },
      { id: 'glass', prim: 'box', role: 'trim', size: ['len', 0.2, 'h * 0.22'], at: [0, '-depth / 2 - 0.1', 'h * 0.6'], group: 'tech:glass', value: 0.12 },
      { id: 'overhang', prim: 'box', role: 'trim', size: ['len + 0.4', 2.4, 0.35], at: [0, '-depth / 2 - 1.1', 'h'], group: 'tech:frame', value: 0.7 },
      { id: 'band', prim: 'box', role: 'trim', size: ['len * 0.9', 0.1, 0.8], at: [0, '-depth / 2 - 2.35', 'h - 0.5'], group: 'tech:trim', value: 0.55 },
    ], sig: ['body', 'doors'], lead: 'body' },
  hospitality: { id: 'hospitality', read: 'a hospitality building: a pale block, a glass storey on top, a roof terrace and a canopy over the door', tier: 'landmark', mounts: ['ground'], functions: ['keep'],
    params: { w: [10, 50], d: [8, 30], h: [4, 10] },
    parts: [
      { id: 'body', prim: 'box', role: 'shell', size: ['w', 'd', 'h'], seams: 3, group: 'tech:body', value: 0.8 },
      { id: 'glass', prim: 'box', role: 'shell', size: ['w * 0.75', 'd * 0.75', 'h * 0.45'], at: [0, 0, 'h'], group: 'tech:glass', value: 0.15 },
      { id: 'roof', prim: 'box', role: 'trim', size: ['w * 0.8', 'd * 0.8', 0.4], at: [0, 0, 'h * 1.45'], group: 'tech:frame', value: 0.7 },
      { id: 'canopy', prim: 'box', role: 'door', size: ['w * 0.3', 3, 0.3], at: [0, '-d / 2 - 1.5', 'h * 0.55'], group: 'tech:trim', value: 0.55 },
    ], sig: ['body', 'glass'], lead: 'body' },
  'lamp-post': { id: 'lamp-post', read: 'a lamp post: a pole and an arm over the road, a lamp at its end', tier: 'machine', ring: 'near', mounts: ['ground'], functions: ['light'],
    params: { h: [5, 12] },
    parts: [
      { id: 'pole', prim: 'tube', role: 'frame', r: 0.1, from: [0, 0, 0], to: [0, 0, 'h'], group: 'tech:frame', value: 0.5 },
      { id: 'arm', prim: 'tube', role: 'frame', r: 0.07, from: [0, 0, 'h'], to: [0, -1.4, 'h + 0.3'], group: 'tech:frame', value: 0.5 },
      { id: 'lamp', prim: 'box', role: 'lamp', size: [0.6, 0.3, 0.15], at: [0, -1.5, 'h + 0.15'], group: 'tech:light', value: 0.95 },
    ], sig: ['pole'], lead: 'pole' },
  'catch-fence': { id: 'catch-fence', read: 'a bay of catch fence: posts and a mesh between them', tier: 'machine', mounts: ['ground'], functions: [],
    params: { len: [2, 12], h: [2, 5] },
    parts: [
      { id: 'posts', prim: 'tube', role: 'frame', r: 0.07, from: ['-len / 2', 0, 0], to: ['-len / 2', 0, 'h'], repeat: { n: 2, step: ['len', 0, 0] }, group: 'tech:frame', value: 0.5 },
      { id: 'mesh', prim: 'panel', role: 'body', size: ['len', 'h'], t: 0.02, seams: 0.5, at: [0, 0, 'h / 2'], aim: [0, -1, 0], group: 'tech:cable', value: 0.5 },
    ], sig: ['mesh'], lead: 'mesh' },
  // ── kart ──
  bumper: { id: 'bumper', read: 'a striped bumper: a low padded wall, red and white', tier: 'machine', mounts: ['ground'], functions: [],
    params: { l: [1.6, 4], h: [0.6, 1.2] },
    parts: [
      { id: 'red', prim: 'box', role: 'body', size: ['l / 3', 0.8, 'h'], at: ['-l / 3', 0, 0], repeat: { n: 2, step: ['l * 2 / 3', 0, 0] }, group: 'tech:trim', value: 0.55 },
      { id: 'white', prim: 'box', role: 'body', size: ['l / 3', 0.8, 'h'], at: [0, 0, 0], group: 'tech:skin', value: 0.95 },
    ], sig: ['red'], lead: 'red' },
  'castle-tower': { id: 'castle-tower', read: 'a castle tower: a round keep, battlements and a pointed roof flying a pennant', tier: 'landmark', mounts: ['ground'], functions: [],
    params: { r: [2, 9], h: [6, 30] },
    sockets: { top: [0, 0, 'h'] },
    parts: [
      { id: 'drum', prim: 'drum', role: 'body', r: 'r', h: 'h', sides: 12, group: 'str:stone', value: 0.65 },
      { id: 'merlons', prim: 'box', role: 'trim', size: ['r * 0.4', 'r * 0.4', 'r * 0.35'], at: [0, 0, 'h'], repeat: { n: 8, around: 'r * 0.9' }, group: 'str:stone', value: 0.75 },
      { id: 'roof', prim: 'cone', role: 'body', r: 'r * 1.05', r2: 0, h: 'r * 2', at: [0, 0, 'h + r * 0.35'], sides: 12, group: 'tech:trim', value: 0.5 },
      { id: 'pennant', prim: 'fin', role: 'trim', l: 'r * 0.9', h: 'r * 0.5', t: 0.05, at: [0, 0, 'h + r * 2.6'], group: 'tech:trim', value: 0.75 },
      { id: 'pole', prim: 'tube', role: 'frame', r: 0.08, from: [0, 0, 'h + r * 2.3'], to: [0, 0, 'h + r * 3.1'], group: 'tech:frame', value: 0.4 },
    ], sig: ['drum', 'roof'], lead: 'drum' },
  castle: { id: 'castle', read: 'a castle: a keep and a tower at each corner, roofs pointed', tier: 'landmark', mounts: ['ground'], functions: [],
    params: { w: [14, 50], h: [10, 34] },
    parts: [
      { id: 'keep', prim: 'box', role: 'body', size: ['w * 0.6', 'w * 0.6', 'h'], group: 'str:stone', value: 0.6 },
      { id: 'tall', block: 'castle-tower', role: 'body', params: { r: 6, h: 30 } },
      { id: 'corners', block: 'castle-tower', role: 'body', params: { r: 2.4, h: 12 }, repeat: { n: 4, around: 'w * 0.42' } },
    ], sig: ['keep', 'tall'], lead: 'keep' },
  mushrooms: { id: 'mushrooms', read: 'giant mushrooms: pale stalks under wide red caps', tier: 'landmark', mounts: ['ground'], functions: [],
    params: { r: [2, 7] },
    parts: [
      { id: 'stalks', prim: 'drum', role: 'body', r: 'r * 0.2', h: 'r * 1.8', sides: 8, repeat: { n: 3, around: 'r * 1.2' }, group: 'tech:skin', value: 0.9 },
      { id: 'caps', prim: 'cone', role: 'body', r: 'r * 0.6', r2: 'r * 0.2', h: 'r * 0.45', at: [0, 0, 'r * 1.8'], sides: 10, repeat: { n: 3, around: 'r * 1.2' }, group: 'tech:trim', value: 0.55 },
      { id: 'big', prim: 'drum', role: 'body', r: 'r * 0.45', h: 'r * 3', sides: 8, group: 'tech:skin', value: 0.9 },
      { id: 'bigcap', prim: 'cone', role: 'body', r: 'r * 1.6', r2: 'r * 0.4', h: 'r', at: [0, 0, 'r * 3'], sides: 12, group: 'tech:trim', value: 0.5 },
    ], sig: ['bigcap'], lead: 'bigcap' },
  arch: { id: 'arch', read: 'an arch over the track: a hoop and a banner across its crown', tier: 'landmark', mounts: ['ground'], functions: ['pass'],
    params: { span: [8, 44] },
    parts: [
      // a semicircle from the left foot over to the right: eight chords, each bent 22.5° from the last (the first half that)
      { id: 'hoop', prim: 'arm', role: 'span', r: 'max(0.4, span * 0.03)', at: ['-span / 2 - 0.8', 0, 'max(0.4, span * 0.03) * 1.2'], segs: Array.from({ length: 8 }, () => '(span / 2 + 0.8) * 0.3902'), bend: [11.25, 22.5, 22.5, 22.5, 22.5, 22.5, 22.5, 22.5], group: 'tech:trim', value: 0.55 },
      { id: 'banner', prim: 'panel', role: 'trim', size: ['span * 0.6', 'max(1, span * 0.09)'], t: 0.1, at: [0, -0.6, 'span * 0.42'], aim: [0, -1, 0], group: 'tech:skin', value: 0.95 },
      { id: 'feet', prim: 'box', role: 'pier', size: [1.2, 1.2, 0.8], at: ['-span / 2 - 0.8', 0, 0], repeat: { n: 2, step: ['span + 1.6', 0, 0] }, group: 'tech:frame', value: 0.4 },
    ], sig: ['hoop'], lead: 'hoop' },
  bleacher: { id: 'bleacher', read: 'a bleacher: a few rows of seats on a frame, flags on poles', tier: 'landmark', mounts: ['ground'], functions: [],
    params: { w: [8, 30], rows: [3, 7, 'i'] },
    parts: [
      { id: 'tiers', prim: 'box', role: 'body', size: ['w', 0.9, 0.8], seams: 0.5, repeat: { n: 'rows', step: [0, 0.85, 0.5] }, group: 'tech:skin', value: 0.75 },
      { id: 'frame', prim: 'box', role: 'frame', size: ['w', 'rows * 0.85', 0.3], at: [0, 'rows * 0.42 - 0.4', 0], group: 'tech:frame', value: 0.4 },
      { id: 'poles', prim: 'tube', role: 'frame', r: 0.07, from: ['-w / 2', 'rows * 0.85', 0], to: ['-w / 2', 'rows * 0.85', 'rows * 0.45 + 3'], repeat: { n: 'round(w / 5) + 1', step: ['w / round(w / 5)', 0, 0] }, group: 'tech:frame', value: 0.4 },
      { id: 'flags', prim: 'fin', role: 'trim', l: 1.6, h: 1, t: 0.03, at: ['-w / 2', 'rows * 0.85', 'rows * 0.45 + 2.2'], repeat: { n: 'round(w / 5) + 1', step: ['w / round(w / 5)', 0, 0] }, group: 'tech:trim', value: 0.55 },
    ], sig: ['tiers'], lead: 'tiers' },
  // ── the surrounds (surrounds.js): what stands beyond the venue ──
  house: { id: 'house', read: 'a house: plastered walls, windows and a door under a hipped roof', tier: 'installation', mounts: ['ground'], functions: ['keep'],
    params: { w: [6, 12], h: [3, 7] },
    parts: [
      { id: 'walls', prim: 'box', role: 'shell', size: ['w', 'w * 0.8', 'h'], group: 'str:plaster', value: 0.8 },
      { id: 'roof', prim: 'cone', role: 'shell', r: 'w * 0.78', r2: 0, h: 'w * 0.36', sides: 4, yaw: 45, at: [0, 0, 'h'], group: 'tech:trim', value: 0.5 },
      { id: 'door', prim: 'panel', role: 'door', size: [1.1, 2.1], t: 0.06, at: [0, '-w * 0.4 - 0.03', 1.05], aim: [0, -1, 0], group: 'tech:glass', value: 0.3 },
      { id: 'windows', prim: 'panel', role: 'trim', size: [1.1, 1.1], t: 0.05, at: ['-w * 0.3', '-w * 0.4 - 0.03', 'h * 0.62'], aim: [0, -1, 0], repeat: { n: 2, step: ['w * 0.6', 0, 0] }, group: 'tech:glass', value: 0.3 },
    ], sig: ['walls', 'roof'], lead: 'walls' },
  chapel: { id: 'chapel', read: 'a chapel: a long nave under hipped roofs, a tower at its front and the spire over it', tier: 'landmark', mounts: ['ground'], functions: ['keep'],
    params: { w: [7, 14], h: [5, 10] },
    parts: [
      { id: 'nave', prim: 'box', role: 'shell', size: ['w', 'w * 1.8', 'h'], group: 'str:plaster', value: 0.85 },
      { id: 'roof', prim: 'cone', role: 'shell', r: 'w * 0.74', r2: 0, h: 'w * 0.4', sides: 4, yaw: 45, at: [0, '-w * 0.45', 'h'], repeat: { n: 2, step: [0, 'w * 0.9', 0] }, group: 'tech:trim', value: 0.45 },
      { id: 'tower', prim: 'box', role: 'shell', size: ['w * 0.46', 'w * 0.46', 'h * 2.1'], at: [0, '-w * 0.9 - w * 0.2', 0], group: 'str:plaster', value: 0.9 },
      { id: 'spire', prim: 'cone', role: 'shell', r: 'w * 0.36', r2: 0, h: 'w * 1.2', sides: 4, yaw: 45, at: [0, '-w * 0.9 - w * 0.2', 'h * 2.1'], group: 'tech:trim', value: 0.4 },
      { id: 'door', prim: 'panel', role: 'door', size: [1.4, 2.6], t: 0.06, at: [0, '-w * 0.9 - w * 0.43 - 0.03', 1.3], aim: [0, -1, 0], group: 'tech:glass', value: 0.3 },
    ], sig: ['nave', 'spire'], lead: 'nave' },
  silo: { id: 'silo', read: 'a silo: a tall steel drum under a low cone', tier: 'installation', mounts: ['ground'], functions: ['store'],
    params: { r: [2, 4], h: [8, 18] },
    parts: [
      { id: 'drum', prim: 'drum', role: 'store', r: 'r', h: 'h', sides: 10, group: 'tech:frame', value: 0.7 },
      { id: 'cap', prim: 'cone', role: 'trim', r: 'r * 1.05', r2: 'r * 0.15', h: 'r * 0.6', sides: 10, at: [0, 0, 'h'], group: 'tech:frame', value: 0.85 },
    ], sig: ['drum'], lead: 'drum' },
  shed: { id: 'shed', read: 'a farm shed: a long red barn under a pitched steel roof', tier: 'installation', mounts: ['ground'], functions: ['keep'],
    params: { w: [10, 18], h: [6, 10] },
    parts: [
      { id: 'walls', prim: 'box', role: 'shell', size: ['w', 'w * 0.5', 'h'], group: 'tech:trim', value: 0.45 },
      { id: 'roof', prim: 'panel', role: 'shell', size: ['w + 0.6', 'w * 0.29'], t: 0.15, at: [0, '-w * 0.125', 'h + w * 0.09'], aim: [0, -0.55, 0.84], repeat: { n: 2, step: [0, 'w * 0.25', 0] }, group: 'tech:frame', value: 0.62 },
      { id: 'gables', prim: 'box', role: 'shell', size: ['w', 'w * 0.24', 'w * 0.1'], at: [0, 0, 'h'], group: 'tech:trim', value: 0.45 },
      { id: 'doors', prim: 'panel', role: 'door', size: ['min(4, w * 0.3)', 'h * 0.75'], t: 0.06, at: [0, '-w * 0.25 - 0.03', 'h * 0.375'], aim: [0, -1, 0], group: 'tech:glass', value: 0.3 },
    ], sig: ['walls'], lead: 'walls' },
  'tower-block': { id: 'tower-block', read: 'a tower block: a tall slab banded with windows on every face, plant on its roof', tier: 'landmark', mounts: ['ground'], functions: ['keep'],
    params: { w: [14, 30], h: [24, 60] },
    parts: [
      { id: 'slab', prim: 'box', role: 'shell', size: ['w', 'w * 0.7', 'h'], group: 'str:plaster', value: 0.78 },
      { id: 'front', prim: 'panel', role: 'trim', size: ['w * 0.9', 1.6], t: 0.08, at: [0, '-w * 0.35 - 0.05', 3], aim: [0, -1, 0], repeat: { n: 'floor(h / 3.6) - 1', step: [0, 0, 3.6] }, group: 'tech:glass', value: 0.3 },
      { id: 'back', prim: 'panel', role: 'trim', size: ['w * 0.9', 1.6], t: 0.08, at: [0, 'w * 0.35 + 0.05', 3], aim: [0, 1, 0], repeat: { n: 'floor(h / 3.6) - 1', step: [0, 0, 3.6] }, group: 'tech:glass', value: 0.3 },
      { id: 'left', prim: 'panel', role: 'trim', size: ['w * 0.62', 1.6], t: 0.08, at: ['-w / 2 - 0.05', 0, 3], aim: [-1, 0, 0], repeat: { n: 'floor(h / 3.6) - 1', step: [0, 0, 3.6] }, group: 'tech:glass', value: 0.3 },
      { id: 'right', prim: 'panel', role: 'trim', size: ['w * 0.62', 1.6], t: 0.08, at: ['w / 2 + 0.05', 0, 3], aim: [1, 0, 0], repeat: { n: 'floor(h / 3.6) - 1', step: [0, 0, 3.6] }, group: 'tech:glass', value: 0.3 },
      { id: 'plant', prim: 'box', role: 'door', size: ['w * 0.4', 'w * 0.3', 3], at: [0, 0, 'h'], group: 'tech:frame', value: 0.55 },
    ], sig: ['slab'], lead: 'slab' },
});

/** Beat (and a focus's form) → the piece, per set. A list cycles through the beat's slots. */
export const SETS = Object.freeze({
  gt: { braking: 'marker-board', rhythm: 'hoarding', pocket: ['grandstand', 'grove', 'billboard'], reveal: ['light-tower', 'grove'], span: 'bridge', gantry: 'gantry', landmark: 'tower',
    focus: { built: 'tower', natural: 'grove', crowd: 'grandstand', sign: 'billboard' } },
  kart: { braking: 'marker-board', rhythm: 'bumper', pocket: ['bleacher', 'mushrooms', 'castle-tower'], reveal: ['castle-tower', 'mushrooms'], span: 'arch', gantry: 'arch', landmark: 'castle',
    focus: { built: 'castle-tower', natural: 'mushrooms', crowd: 'bleacher', sign: 'billboard' } },
});
/** The set a track's class is dressed from. */
export const SET_OF_CLASS = Object.freeze({ kart: 'kart', circuit: 'gt', rally: 'gt', freeway: 'gt' });

// the ring a read distance is judged at (era/out-structures.js: the nearest ring's read distance)
const ringAt = (d) => Object.entries(STRUCTURE_RINGS).reduce((b, [id, R]) => (Math.abs(R.read - d) < Math.abs(STRUCTURE_RINGS[b].read - d) ? id : b), 'near');
// a slot's read distance from its span (the span is the eye spot's multiple there)
const SPAN_PER_M = 0.0309;   // eyeSpotAt(1): EYE_SPOT_PX · metresPerPixel(1)

/**
 * A slot's piece: the set's block for its beat (a list taken in turn by `nth`), its sizing params pushed up their rails
 * until its least span reads where the slot needs it, turned to face the road (a span across it).
 */
export function pieceFor(slot, set, { nth = 0, toward = null, heading = 0, block = null } = {}) {
  const S = SETS[set];
  if (!S) throw new Error(`trackscape: no set '${set}' (${Object.keys(SETS).join(', ')})`);
  if (block && !TRACK_BLOCKS[block]) throw new Error(`trackscape: no set piece '${block}' (${Object.keys(TRACK_BLOCKS).join(', ')})`);
  let id = block ?? (slot.beat === 'focus' ? S.focus[slot.form] ?? S.focus.built : S[slot.beat]);
  if (Array.isArray(id)) id = id[nth % id.length];
  if (!id) return null;
  const B = TRACK_BLOCKS[id], across = slot.beat === 'span' || slot.beat === 'gantry';
  const read = slot.span / (slot.beat === 'rhythm' ? 1 : 3) / SPAN_PER_M, ring = ringAt(read);
  // sizing: the across of a span is the road's; otherwise every numeric param from its rail's low end, raised a step at
  // a time until the piece's least extent (width or height) covers the slot's span
  const params = {}, fixed = {};
  if (across && B.params.span) fixed.span = Math.max(B.params.span[0], Math.min(B.params.span[1], slot.across + 2));
  if (B.params.count && slot.count) fixed.count = slot.count;
  let built = null;
  for (let u = 0; u <= 1.0001; u += 0.125) {
    for (const [k, r] of Object.entries(B.params)) if (typeof r[0] === 'number' && !(k in fixed)) params[k] = r[2] === 'i' ? Math.round(r[0] + (r[1] - r[0]) * u) : r[0] + (r[1] - r[0]) * u;
    built = buildBlock(B, { params: { ...params, ...fixed }, ring, library: TRACK_BLOCKS, many: 0.5, seed: 1 });
    const sz = built.box.size, least = Math.min(Math.max(sz[0], sz[1]), sz[2]);
    if (across || least >= slot.span) break;
  }
  // facing: a piece's face looks down −y; turned so it looks at the road (or, across, its x along the road's normal)
  const yaw = across ? heading + Math.PI / 2 : toward ? Math.atan2(toward[1] - slot.at[1], toward[0] - slot.at[0]) + Math.PI / 2 : 0;
  return { block: id, params: { ...params, ...fixed }, ring, yaw, at: slot.at, size: built.box.size, beat: slot.beat };
}

/** A piece built where it stands (era/blocks.js buildBlock; yaw in degrees there). */
export function buildPiece(piece, { seed = 1 } = {}) {
  return buildBlock(TRACK_BLOCKS[piece.block], { params: piece.params, ring: piece.ring, library: TRACK_BLOCKS, many: 0.5, seed, at: piece.at, yaw: (piece.yaw * 180) / Math.PI });
}

// ── paint ──
/** What each surface group is in the track's kit: a material (tiled on its pole) or a flat colour, and its ramp. */
const GROUP_PAINT = Object.freeze({
  'tech:body': { material: 'concrete' }, 'tech:skin': { material: 'concrete' }, 'str:plaster': { material: 'concrete' },
  'tech:frame': { material: 'steel' }, 'tech:cable': { material: 'tyre' },
  'tech:glass': { flat: 'rubber' }, 'tech:trim': { flat: 'paint' }, 'tech:light': { flat: 'light' }, 'str:accent': { flat: 'accent' },
  'str:stone': { material: 'stone' }, 'str:timber': { material: 'bark' }, 'str:motif': { material: 'foliage' },
});

/** Which surface group wins a cube it shares (voxel-look.js): the detail over the body it stands proud of. */
const VOXEL_PRIORITY = Object.freeze({ 'tech:glass': 3, 'tech:trim': 3, 'tech:light': 3, 'str:accent': 3, 'tech:frame': 2, 'tech:cable': 1 });

/** A built piece's faces in the kit (track-kit.js): each group its material or flat colour, its value a stop, lit by the
 *  roadway's light (the kit's pole decides: a tile × light, or the band's stop); polygons fanned to four corners. */
export function paintPiece(faces, K, { voxel = null } = {}) {
  // the voxel look: the piece a shell of cubes on its grid, under the isekai light (voxel-look.js); `voxel` a coarser
  // grid for a far thing (the surrounds: a wood, a butte, a village)
  if (K.pole === 'voxel' && faces.length) {
    const box = { lo: [0, 1, 2].map((i) => Math.min(...faces.flatMap((f) => f.corners.map((p) => p[i])))), hi: [0, 1, 2].map((i) => Math.max(...faces.flatMap((f) => f.corners.map((p) => p[i])))) };
    const vox = voxelize(faces, { size: voxel ?? voxelSizeFor(box), colourOf: (f) => K.colourOf(GROUP_PAINT[f.group] ?? GROUP_PAINT['tech:body'], f.value ?? 0.6, !!f.tile), priorityOf: (f) => VOXEL_PRIORITY[f.group] ?? (f.tile ? -1 : 0) });   // (a seam: a mark on a body, never over it)
    return voxelFaces(vox, { light: K.light });
  }
  // the shaded look: the piece's own polygons, lit per corner the sixth generation's way (shaded-look.js)
  if (K.pole === 'shaded') return shadeFaces(faces, { colourOf: (f) => K.colourOf(GROUP_PAINT[f.group] ?? GROUP_PAINT['tech:body'], f.value ?? 0.6, !!f.tile).lit });
  const out = [];
  for (const f of faces) {
    const G = GROUP_PAINT[f.group] ?? GROUP_PAINT['tech:body'];
    const c = f.corners, n = c.length;
    const pieces = n <= 4 ? [c] : Array.from({ length: Math.ceil((n - 2) / 2) }, (_, j) => { const i = 1 + 2 * j; return i + 2 < n ? [c[0], c[i], c[i + 1], c[i + 2]] : [c[0], c[i], c[i + 1]]; });
    for (const q of pieces) out.push(K.piece(G, q, f.value ?? 0.6, f.normal, !!f.tile));
  }
  return out;
}
