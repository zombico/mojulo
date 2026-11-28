/**
 * THE SEA PEN — a covered dock cut into a cliff's foot (an infiltration level's `ground: { pen }`): a basin a ship lies
 * moored in (ship-deck.js, held still, its water the boat water's at no speed and a calm swell), quays round it at its
 * deck's height (the floor, z 0) on its two sides and across its head, a rail along every quay's edge the free run never
 * carries a body over, rock walls and a roof, the sea gate open astern; over the head quay the dock's control room, a
 * booth on a block a guard keeps watch from; on the wide quay a gantry a lookout stands on; in the back wall the cliff
 * stair's door. Sized from its ship. Lit by sodium lamps on its walls (lit faces; their light on the quays waits on the
 * page's point lights).
 *
 *   seaPen({ ship?, night? }) → { faces, colliders, ship, shipSea, inside(x, y), marks, raised, footless, bounds }
 *     ship      a vehicle word for the boat moored in it ('supply ship')
 *   SEA_PEN     the numbers: the quays' widths, the walls' and the roof's heights, the control room's and the gantry's
 *               blocks, the rail's reach
 *   marks       named places its scenes frame and its level lays by: sea-gate, west-quay, head-quay, control-room,
 *               gantry, stair-door
 *   raised      { controlRoom, gantry }: the height a guard stands at on each
 *   footless    the groups never footing (the roof, the gate's lintel): the page's `footless`, so the ground under a
 *               body or a scene's camera is the quay, never the rock over it
 *
 * Level space (+y the ship's bow and the pen's head, metres); the ship's middle at the origin. Pure.
 */
import { shipDeck } from './ship-deck.js';

export const SEA_PEN = Object.freeze({
  west: 12, east: 6, head: 18, gap: 2.2, gate: 8, wall: 3, roof: 16, rail: 1.1, out: 2.5, sea: 0.35,
  control: Object.freeze({ w: 8, d: 6, h: 3.4, booth: 2.6 }), gantry: Object.freeze({ w: 3, d: 3, h: 4.2 }),
  colours: Object.freeze({ quay: '#4b4e50', edge: '#8a7a3a', rock: '#2a2c2e', roof: '#1d1f21', block: '#5a5f63', booth: '#3a4046', glass: '#d9b25a', lamp: '#ffb35a', door: '#5c4a2a' }),
});
const r2 = (v) => Math.round(v * 100) / 100 + 0;
const quad = (a, b, c, d, fill, group, two = true) => ({ corners: [a, b, c, d], fill, group, ...(two ? { doubleSided: true } : {}) });
function boxOf(x0, x1, y0, y1, z0, z1, fill, group) {
  return [quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], fill, group),
    quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], fill, group), quad([x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], fill, group),
    quad([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], fill, group), quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], fill, group)];
}

/** The sea pen about its ship (see the header). */
export function seaPen({ ship = 'supply ship', night = true, sky = null } = {}) {
  const S = shipDeck(ship, { speed: 0, night, ...(sky ? { sky } : {}) }), C = SEA_PEN.colours, K = SEA_PEN;
  const bx = r2(S.beam / 2 + K.gap), by0 = r2(S.y0 - K.gate), by1 = r2(S.yEnd + K.gap + 2);
  const W = r2(-bx - K.west), E = r2(bx + K.east), H = r2(by1 + K.head), seaZ = S.seaZ;
  const faces = [], colliders = [];
  // THE QUAYS: the west, the east, the head, at the floor; their faces down to the water
  const floor = (x0, x1, y0, y1, g) => { faces.push(quad([x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0], C.quay, g)); };
  floor(W, -bx, by0, by1, 'pen:quay'); floor(bx, E, by0, by1, 'pen:quay'); floor(W, E, by1, H, 'pen:quay');
  for (const [x, y0, y1] of [[-bx, by0, by1], [bx, by0, by1]]) faces.push(quad([x, y0, seaZ - 1], [x, y1, seaZ - 1], [x, y1, 0], [x, y0, 0], C.rock, 'pen:quayface'));
  faces.push(quad([-bx, by1, seaZ - 1], [bx, by1, seaZ - 1], [bx, by1, 0], [-bx, by1, 0], C.rock, 'pen:quayface'));
  // (the quay's yellow edge marked along the water, and its rail: a collider out over the water deeper than a vault crosses)
  const T = 0.15, rails = [[-bx - T, -bx, by0, by1, -bx, -bx + K.out, by0, by1], [bx, bx + T, by0, by1, bx - K.out, bx, by0, by1], [-bx, bx, by1, by1 + T, -bx, bx, by1 - K.out, by1]];
  for (const [x0, x1, y0, y1, cx0, cx1, cy0, cy1] of rails) {
    faces.push(...boxOf(x0, x1, y0, y1, 0, K.rail, C.edge, 'pen:rail'));
    colliders.push({ min: [r2(cx0), r2(cy0), 0], max: [r2(cx1), r2(cy1), K.rail], hold: false, of: 'pen:rail' });
  }
  // (the quays' ends at the sea gate: a rail across each, the gate open over the water between them)
  for (const [x0, x1] of [[W, -bx], [bx, E]]) { faces.push(...boxOf(x0, x1, by0 - T, by0, 0, K.rail, C.edge, 'pen:rail')); colliders.push({ min: [x0, r2(by0 - K.out), 0], max: [x1, by0, K.rail], hold: false, of: 'pen:rail' }); }
  // THE ROCK: the side walls, the back wall, the roof; the gate's lintel over the sea astern
  const Wt = K.wall;
  faces.push(...boxOf(W - Wt, W, by0 - 10, H + Wt, seaZ - 2, K.roof, C.rock, 'pen:rock'), ...boxOf(E, E + Wt, by0 - 10, H + Wt, seaZ - 2, K.roof, C.rock, 'pen:rock'), ...boxOf(W - Wt, E + Wt, H, H + Wt, seaZ - 2, K.roof, C.rock, 'pen:rock'));
  faces.push(quad([W - Wt, by0 - 10, K.roof], [E + Wt, by0 - 10, K.roof], [E + Wt, H + Wt, K.roof], [W - Wt, H + Wt, K.roof], C.roof, 'pen:roof'));
  faces.push(...boxOf(W, E, by0 - 10, by0 - 7, K.roof - 6, K.roof, C.rock, 'pen:lintel'));
  for (const [x0, x1, y0, y1] of [[W - 1, W, by0 - 1, H], [E, E + 1, by0 - 1, H], [W - 1, E + 1, H, H + 1]]) colliders.push({ min: [x0, y0, 0], max: [x1, y1, K.roof], hold: false, of: 'pen:rock' });
  // THE CONTROL ROOM over the head quay: a block, a booth on it, its glass to the basin lit; a guard on the block
  const Q = K.control, cy = r2(by1 + Q.d / 2 + 3), cx = 0;
  faces.push(...boxOf(cx - Q.w / 2, cx + Q.w / 2, cy - Q.d / 2, cy + Q.d / 2, 0, Q.h, C.block, 'pen:control'));
  faces.push(...boxOf(cx - Q.w / 2, cx + Q.w / 2, cy - Q.d / 2 + 0.4, cy + Q.d / 2, Q.h + Q.booth - 0.2, Q.h + Q.booth, C.booth, 'pen:booth'));
  faces.push(quad([cx - Q.w / 2, cy - Q.d / 2 + 0.4, Q.h + 1], [cx + Q.w / 2, cy - Q.d / 2 + 0.4, Q.h + 1], [cx + Q.w / 2, cy - Q.d / 2 + 0.4, Q.h + Q.booth - 0.4], [cx - Q.w / 2, cy - Q.d / 2 + 0.4, Q.h + Q.booth - 0.4], C.glass, 'pen:glass'));
  colliders.push({ min: [r2(cx - Q.w / 2), r2(cy - Q.d / 2), 0], max: [r2(cx + Q.w / 2), r2(cy + Q.d / 2), Q.h], of: 'pen:control' });
  // THE GANTRY on the west quay: a lookout's tower, its deck at its height
  const G = K.gantry, gx = r2(W + G.w / 2 + 1), gy = r2(S.y0 + 0.75 * (S.yEnd - S.y0));
  faces.push(...boxOf(gx - G.w / 2, gx + G.w / 2, gy - G.d / 2, gy + G.d / 2, 0, G.h, C.block, 'pen:gantry'));
  colliders.push({ min: [r2(gx - G.w / 2), r2(gy - G.d / 2), 0], max: [r2(gx + G.w / 2), r2(gy + G.d / 2), G.h], of: 'pen:gantry' });
  // THE CLIFF STAIR's door in the back wall, at the west corner
  const dx = r2(W + 4), dy = r2(H - 0.05);
  faces.push(quad([dx - 1, dy, 0], [dx + 1, dy, 0], [dx + 1, dy, 2.4], [dx - 1, dy, 2.4], C.door, 'pen:door'));
  // THE LAMPS: sodium boxes along the walls and over the door
  const lamps = [[W + 0.15, by0 + 10], [W + 0.15, by0 + 35], [W + 0.15, by1 - 4], [E - 0.15, by0 + 20], [E - 0.15, by1 - 4], [dx, dy - 0.15]];
  for (const [x, y] of lamps) faces.push(...boxOf(x - 0.25, x + 0.25, y - 0.12, y + 0.12, 4.6, 4.9, C.lamp, 'pen:lamp'));
  const inside = (x, y) => (x >= W + 0.4 && x <= -bx - 0.4 && y >= by0 + 0.4 && y <= by1) || (x >= bx + 0.4 && x <= E - 0.4 && y >= by0 + 0.4 && y <= by1) || (x >= W + 0.4 && x <= E - 0.4 && y > by1 && y <= H - 0.4);
  const shipSea = { at: [0, 0], heading: S.heading, speed: 0, z: S.seaZ, sea: { ...S.sea, swell: S.sea.swell.map((w) => ({ ...w, amp: Math.round(w.amp * K.sea * 1000) / 1000 })) } };
  return {
    faces, colliders, ship: S, shipSea, inside, bounds: { W, E, by0, by1, H, bx },
    marks: { 'sea-gate': [0, r2(by0 - 6), 4], 'west-quay': [r2((W - bx) / 2), 0, 1.5], 'head-quay': [r2((W + E) / 2), r2((by1 + H) / 2), 1.5], 'control-room': [cx, cy, r2(Q.h + 1.6)], gantry: [gx, gy, r2(G.h + 1.6)], 'stair-door': [dx, r2(dy - 1.2), 1.2] },
    raised: { controlRoom: Q.h, gantry: G.h },
    footless: ['pen:roof', 'pen:lintel'],
  };
}
