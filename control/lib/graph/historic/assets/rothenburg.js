/**
 * Rothenburg ob der Tauber's kit (../cultures/rothenburg.js), c. 1500. Its houses are not drawn here: they are
 * spoken from the inventory (../inventory/): the Franconian timber-framed house (`fachwerk`) as a dwelling and as a
 * shop, the council families' stone house (`steinhaus`) on the main streets. Its church is the landmark library's
 * Gothic church (../inventory/ `landmarkAsset`). What is the town's own, built here from the kit's parts: the ring wall
 * with its roofed walk, its towers and gate towers under steep roofs, the town hall and its tower, the market
 * fountain and the wells.
 *
 * Every asset builds in its own frame (./kit.js): footprint [0, W] × [0, D] metres, its front toward −y (out of the
 * town for the wall, onto the square for the hall). Colours from the card's palette. The sizes are the general
 * accounts', not a measured plan (../record/rothenburg.js).
 */
import { scaleHex } from '../../polygonizer/vexar.js';
import { merlons, doorway } from './kit.js';
import { inventoryKit, landmarkAsset } from '../inventory/index.js';

/** A steep four-sided roof (a pyramid on a square, a hipped ridge on a long one) over a rect from z, `rise` high. */
const spire = ({ x, y, w, d }, z, rise, tint, eave = 0.4) => {
  const ridge = Math.max(0, (Math.max(w, d) - Math.min(w, d)) / 2), top = w >= d ? { x: x + w / 2 - ridge, y: y + d / 2 - 0.05, w: 2 * ridge + 0.1, d: 0.1 } : { x: x + w / 2 - 0.05, y: y + d / 2 - ridge, w: 0.1, d: 2 * ridge + 0.1 };
  return { kind: 'roof', solid: 'frustum', x: x - eave, y: y - eave, w: w + 2 * eave, d: d + 2 * eave, z0: z, z1: z + rise, top, tint, underside: true };
};
/** A gable roof along x over a rect: two slopes to a ridge at `rise`, its two gable ends. */
const gable = ({ x, y, w, d }, z, rise, roof, end, eave = 0.4) => [
  { kind: 'roof', solid: 'wedge', x: x - eave, y: y - eave, w: w + 2 * eave, d: d / 2 + eave, z0: z, z1: z + rise, rise: 'y+', tint: roof },
  { kind: 'roof', solid: 'wedge', x: x - eave, y: y + d / 2, w: w + 2 * eave, d: d / 2 + eave, z0: z, z1: z + rise, rise: 'y-', tint: roof },
  ...[x, x + w].map((gx, i) => ({ kind: 'gable', solid: 'panel', pts: [[gx, y, z], [gx, y + d, z], [gx, y + d / 2, z + rise]], out: [i ? 1 : -1, 0, 0], tint: end, x: gx, y, w: 0, d, z0: z, z1: z + rise })),
];
/** A row of dark lights along the front, `n` of them, at a storey's sill. */
const lights = (W, z, h, n, tint, w = 1) => Array.from({ length: n }, (_, i) => ({ kind: 'window', x: ((i + 0.5) * W) / n - w / 2, y: -0.12, w, d: 0.14, z0: z, z1: z + h, tint }));

/** A run of the ring wall: rubble stone, a breastwork on its outer face, the walk behind it under a lean-to roof. */
export const rbWall = {
  id: 'rb-wall', sheet: 'rb-wall', designed: true, patterns: ['towered-wall'],
  envelope: { w: [3, 60], d: [3, 6] },
  build({ W, D, slot }, { palette: P, culture: K }) {
    const H = K.wall.height, stone = P.wall;
    const out = [{ kind: 'city-wall', x: 0, y: 0, w: W, d: D, z0: 0, z1: H, tint: stone }];
    if (!slot.exposed) return out;
    out.push({ kind: 'parapet', x: 0, y: 0, w: W, d: 0.7, z0: H, z1: H + 1.8, tint: scaleHex(stone, 0.95) });
    // the walk's roof: from over the breastwork down toward the town, on the posts of the gallery
    out.push({ kind: 'walk-roof', solid: 'wedge', x: 0, y: 0, w: W, d: D + 1.4, z0: H + 2.4, z1: H + 3.4, rise: 'y-', tint: P.tile });
    return out;
  },
};
/** A tower in the wall: square, rubble stone, a steep tiled pyramid roof. */
export const rbTower = {
  id: 'rb-tower', sheet: 'rb-tower', designed: true, patterns: ['towered-wall'],
  envelope: { w: [5, 9], d: [5, 9] },
  build({ W, D }, { palette: P, culture: K }) {
    const H = K.wall.towerHeight;
    return [{ kind: 'wall-tower', x: 0, y: 0, w: W, d: D, z0: 0, z1: H, tint: scaleHex(P.wall, 0.97) }, ...lights(W, H - 3, 1.1, 2, P.opening, 0.5), spire({ x: 0, y: 0, w: W, d: D }, H, Math.max(W, D) * 0.9, P.tile)];
  },
};
/** A gate tower over the road's passage through the wall, the wall run on into it on both sides. */
export const rbGate = {
  id: 'rb-gate', sheet: 'rb-gate', designed: true, patterns: ['towered-wall'],
  envelope: { w: [20, 30], d: [8, 14] },
  build({ W, D }, { palette: P, culture: K }) {
    const H = K.wall.gateHeight, h = K.wall.height, tw = Math.min(11, W * 0.42), x0 = (W - tw) / 2, T = { x: x0, y: 0, w: tw, d: D };
    return [
      { kind: 'city-wall', x: 0, y: (D - 3) / 2, w: x0, d: 3, z0: 0, z1: h, tint: P.wall },
      { kind: 'city-wall', x: x0 + tw, y: (D - 3) / 2, w: W - x0 - tw, d: 3, z0: 0, z1: h, tint: P.wall },
      { kind: 'gate-tower', ...T, z0: 0, z1: H, tint: scaleHex(P.wall, 1.03) },
      doorway(x0 + tw / 2, 0, 0, 4, 4.6, P.opening),
      ...lights(W, H - 4, 1.3, 1, P.opening, 0.7).map((b) => ({ ...b, x: x0 + tw / 2 - 0.35 })),
      spire(T, H, tw * 1.1, P.tile),
    ];
  },
};
/** The town hall's long stone hall, its front on the square: pointed lights in two rows, a steep tiled roof. */
export const rbHall = {
  id: 'rb-rathaus-hall', sheet: 'rb-rathaus-hall', designed: true, patterns: [],
  envelope: { w: [24, 48], d: [12, 20] },
  build({ W, D }, { palette: P }) {
    const H = 11, n = Math.max(4, Math.round(W / 4));
    return [
      { kind: 'hall-wall', x: 0, y: 0, w: W, d: D, z0: 0, z1: H, tint: P.stone },
      doorway(W / 2, 0, 0, 2.8, 3.6, P.opening),
      ...lights(W, 1.6, 2.2, n, P.opening).filter((b) => Math.abs(b.x + 0.5 - W / 2) > 2.5),
      ...lights(W, 6.6, 2.6, n, P.opening),
      ...gable({ x: 0, y: 0, w: W, d: D }, H, (D / 2) * Math.tan((56 * Math.PI) / 180), P.tile, P.stone),
    ];
  },
};
/** The town hall's tower: a square stone shaft over the roofs, a gallery, an eight-sided top and its spire. */
export const rbHallTower = {
  id: 'rb-rathaus-tower', sheet: 'rb-rathaus-tower', designed: true, patterns: [],
  envelope: { w: [6, 10], d: [6, 10] },
  build({ W, D }, { palette: P }) {
    const H = 44, g = 1.2;
    return [
      { kind: 'tower-shaft', x: 0, y: 0, w: W, d: D, z0: 0, z1: H, tint: scaleHex(P.stone, 1.02) },
      ...[14, 24, 34].flatMap((z) => lights(W, z, 1.6, 2, P.opening, 0.6)),
      { kind: 'gallery', x: -g / 2, y: -g / 2, w: W + g, d: D + g, z0: H, z1: H + 0.5, tint: scaleHex(P.stone, 0.9) },
      ...merlons({ x: -g / 2, y: -g / 2, w: W + g, d: D + g }, H + 0.5, scaleHex(P.stone, 0.9), { pitch: 1.6, size: 0.5, height: 0.9, depth: 0.4 }),
      { kind: 'lantern', solid: 'drum', sides: 8, x: W * 0.15, y: D * 0.15, w: W * 0.7, d: D * 0.7, z0: H + 0.5, z1: H + 6, tint: P.stone },
      { kind: 'spire', solid: 'drum', sides: 8, taper: 0.04, x: W * 0.1, y: D * 0.1, w: W * 0.8, d: D * 0.8, z0: H + 6, z1: H + 16, tint: P.tile },
    ];
  },
};
/** The market fountain: an eight-sided stone basin, a column in it. */
export const rbFountain = {
  id: 'rb-fountain', sheet: 'rb-fountain', designed: true, patterns: [],
  envelope: { w: [3, 6], d: [3, 6] },
  build({ W, D }, { palette: P }) {
    const c = Math.min(W, D) * 0.16;
    return [
      { kind: 'basin', solid: 'drum', sides: 8, open: true, lip: 0.25, x: 0, y: 0, w: W, d: D, z0: 0, z1: 0.9, tint: P.stone },
      { kind: 'column', solid: 'drum', sides: 8, x: W / 2 - c, y: D / 2 - c, w: 2 * c, d: 2 * c, z0: 0, z1: 3.6, tint: scaleHex(P.stone, 1.05) },
    ];
  },
};
/** A well at a crossing: a round stone head. */
export const rbWell = {
  id: 'rb-well', sheet: 'rb-well', designed: true, patterns: [],
  envelope: { w: [2, 3], d: [2, 3] },
  build({ W, D }, { palette: P }) { return [{ kind: 'well', solid: 'drum', open: true, lip: 0.2, x: 0, y: 0, w: W, d: D, z0: 0, z1: 0.9, tint: P.stone }]; },
};

/** The kit: the inventory's houses and church beside the town's own wall, hall, tower, fountain and wells. */
export const ROTHENBURG_ASSETS = Object.freeze({
  ...inventoryKit({
    // storeys as the record's house types give them (timber-frame/town-house, rothenburg/stone-house)
    house: { style: 'fachwerk', use: 'dwelling', terrace: true, storeys: [2, 4], cites: ['timber-frame/town-house'] },
    'shop-house': { style: 'fachwerk', use: 'shop', terrace: true, storeys: [2, 4], cites: ['timber-frame/town-house'] },
    'stone-house': { style: 'steinhaus', use: 'dwelling', terrace: true, storeys: [3, 4], cites: ['rothenburg/stone-house'] },
  }),
  'st-jakob': landmarkAsset({ id: 'st-jakob', builder: 'basilica', height: 52, cites: ['rothenburg/st-jakob'], paint: (P) => ({ wall: P.stone, trim: scaleHex(P.stone, 1.06), pinnacle: scaleHex(P.stone, 1.02), roof: P.tile }) }),
  'rb-wall': rbWall, 'rb-tower': rbTower, 'rb-gate': rbGate,
  'rb-rathaus-hall': rbHall, 'rb-rathaus-tower': rbHallTower,
  'rb-fountain': rbFountain, 'rb-well': rbWell,
});
