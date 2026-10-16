// equipment/firearm-shapes — the firearms' boxes, measured once and shared: the carry holds pose a body round them
// (polygonizer/hero-carry.js CARRIED) and the equipment kernel builds them as gear (equipment/firearm.js). Pure data.
//
// Boxes [lo, hi, colour] in the thing's centimetres. Generic proxies: no make or model. A pistol grip rakes back (its
// bottom behind its top: the line through the fist 72° off the bore, the bore along the hand's axis); the support hand
// on a long gun's handguard closes round it, the barrel out of its index side, its palm up-left under the gun.
export const METAL = '#3b3f45', POLY = '#26282b', WOOD = '#7a5230', CARD = '#b98d5a', LEATHER = '#6b4026', CANVAS = '#a39572', BRASS = '#a8873a', GLASS = '#f2d27a';
const rakeGrip = (y0, y1, z1, colour = POLY) => [0, 1, 2].map((i) => { const a = y0 + ((y1 - y0) * i) / 3, b = y0 + ((y1 - y0) * (i + 1)) / 3, zc = z1 + 0.33 * ((a + b) / 2 - y1); return [[-1.5, a, zc - 2.8], [1.5, b, zc + 2.8], colour]; });
const PISTOL_GRIP = (at) => ({ at, c: [0, 0.95, 0.31], a: [0, 0, 1] });
const SUPPORT_RAIL = (at, slide, alt) => ({ at, c: [0, 0, 1], a: [-0.7, 0.25, 0.55], slide, roll: [-180, 150], ...(alt ? { alt } : {}) });
/** a magazine held as a grip (the fist round it, the line through the fist up it): a support hand's fallback */
const MAG_GRIP = (at) => ({ at, c: [0, 1, 0], a: [0, 0, 1], roll: [-180, 150] });
export const HANDLE = (at) => ({ at, c: [0, 0, 1], a: [0, -1, 0] });

export const FIREARM_SHAPES = Object.freeze({
  pistol: { class: 'firearm', kg: 0.9, com: [0, -1.5, 3], sight: { y: 3.9, rear: -3.5, front: 14 }, muzzle: [0, 1.8, 15],
    boxes: [[[-1.4, 0.2, -4.5], [1.4, 3.4, 15], METAL], [[-1.5, -1.2, -3.5], [1.5, 0.4, 13], POLY], ...rakeGrip(-11.5, -1, -3.2), [[-0.5, -3.4, 2.6], [0.5, -1.2, 3.4], POLY], [[-0.8, 3.4, -4], [0.8, 4.1, -3], METAL], [[-0.4, 3.4, 13.6], [0.4, 4.1, 14.4], METAL]],
    stations: { strong: PISTOL_GRIP([0, -5.5, -4.2]), support: { at: [3.3, -6.2, -2.8], c: [0, 0.98, 0.2], a: [0, -0.2, 0.98] } } },
  carbine: { class: 'firearm', kg: 3.4, com: [0, 0.5, 2], sight: { y: 7.8, rear: -6, front: 6 }, muzzle: [0, 0.8, 58],
    boxes: [[[-1.6, -1.5, -14], [1.6, 5, 18], METAL], [[-1.8, -6.5, -45], [1.8, 4.2, -14], POLY], [[-2.3, -2.8, 18], [2.3, 4.2, 44], POLY], [[-0.8, 0, 44], [0.8, 1.6, 58], METAL], ...rakeGrip(-13, -1.5, -4.8), [[-1.3, -17, 2], [1.3, -1.5, 9], METAL], [[-1.8, 5, -6], [1.8, 9.5, 6], POLY]],
    stations: { strong: PISTOL_GRIP([0, -6.8, -6.4]), support: SUPPORT_RAIL([0, -0.5, 31], [2, 40], MAG_GRIP([0, -11, 5.5])), butt: { at: [0, -1.2, -45] }, comb: { at: [0, 4.2, -26] }, balance: HANDLE([0, 3.5, 3]) } },
  // a shotgun's stock drops below its rib (the butt's middle some 11 cm under the sight line), so the cheek finds the rib
  shotgun: { class: 'firearm', kg: 3.6, com: [0, 0, 4], sight: { y: 3.6, rear: 12, front: 61 }, muzzle: [0, 2, 62],
    boxes: [[[-1.8, -14.5, -48], [1.8, -1.5, -36], WOOD], [[-1.8, -10, -36], [1.8, 1, -24], WOOD], [[-1.8, -6, -24], [1.8, 3, -12], WOOD], [[-1.8, -2, -12], [1.8, 4.5, 14], METAL], [[-1.2, 0.8, 14], [1.2, 3.2, 62], METAL], [[-1.2, -2.2, 14], [1.2, 0.6, 50], METAL], [[-2.3, -3, 22], [2.3, 1.2, 40], WOOD], ...rakeGrip(-13, -2, -7, WOOD)],
    stations: { strong: PISTOL_GRIP([0, -7.3, -8.6]), support: SUPPORT_RAIL([0, -1.4, 31], [6, 39]), butt: { at: [0, -8, -48] }, comb: { at: [0, 1, -30] }, balance: HANDLE([0, 3, 5]) } },
  lmg: { class: 'firearm', kg: 8.5, com: [0, 0.5, 6], sight: { y: 9.5, rear: -4, front: 30 }, muzzle: [0, 1.5, 80],
    boxes: [[[-2.4, -3, -16], [2.4, 7, 24], METAL], [[-2, -7, -50], [2, 4, -16], POLY], [[-2.2, -1, 24], [2.2, 4, 62], METAL], [[-1, 0.5, 62], [1, 2.5, 80], METAL], [[-6, -16, -2], [4.5, -3, 10], METAL], [[-1.2, -3, 56], [1.2, -1, 72], METAL], [[-1, 7, -4], [1, 11, 12], METAL], ...rakeGrip(-14, -3, -9)],
    stations: { strong: PISTOL_GRIP([0, -8.5, -10.6]), support: SUPPORT_RAIL([0, -1.5, 34], [10, 58], MAG_GRIP([-0.5, -9.5, 4])), butt: { at: [0, -1.5, -50] }, comb: { at: [0, 4, -32] }, handle: HANDLE([0, 9, 4]) } },
});
