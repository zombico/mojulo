/**
 * kitchen-run — auto wall-run packing for a KITCHEN room context.
 *
 * Given a room basis, lay the kitchen units edge-to-edge ALONG THE WALLS in an L-shape
 * (back wall + one side wall), consuming wall-length budget. Emits room elements that the
 * room-asset bridge (room-assets.js, `local` assets) renders as oriented workbench
 * polygomers — the back run faces +y, the side run faces +x, both INTO the room.
 *
 * Each emitted element is `{ type, heightManji: { basePlane: { corners:[a,b,c,d] }, heightWorld } }`
 * where the footprint corners are ordered so (b−a) is the width edge and (d−a) is the
 * depth edge aimed into the room (the `local` transform keys off this basis).
 */

const BASE_H = 0.9;      // counter height
const COUNTER_D = 0.6;   // base-cabinet depth
const UPPER_D = 0.35;    // wall-cabinet depth
const UPPER_H = 0.7;     // wall-cabinet height
const UPPER_Z = 1.45;    // wall-cabinet mount height (base z)

// footprint quads — vHat (d−a) points INTO the room
const footprintBack = (xa, xb, yWall, depth, z0) =>
  [[xa, yWall, z0], [xb, yWall, z0], [xb, yWall + depth, z0], [xa, yWall + depth, z0]];
const footprintLeft = (ya, yb, xWall, depth, z0) =>
  [[xWall, ya, z0], [xWall, yb, z0], [xWall + depth, yb, z0], [xWall + depth, ya, z0]];
const el = (type, corners, h) => ({ type, heightManji: { basePlane: { corners }, heightWorld: h } });

const rangeOf = (r, fallback) => (Array.isArray(r) && r.length === 2 ? r : fallback);

/**
 * @param {object} roomBasis  { worldExtent:{width,depth,height}, xRange?, yRange?, zRange? } (metres)
 * @param {object} opts       { gap?=0.01, uppers?=true }
 * @returns {{ elements: object[], dropped: string[] }}
 */
export function planKitchenRun(roomBasis = {}, opts = {}) {
  const ext = roomBasis.worldExtent || {};
  const [x0, x1] = rangeOf(roomBasis.xRange, [0, ext.width || 4]);
  const [y0, y1] = rangeOf(roomBasis.yRange, [0, ext.depth || 3.5]);
  const [z0] = rangeOf(roomBasis.zRange, [0, ext.height || 2.6]);
  const gap = Number.isFinite(opts.gap) ? opts.gap : 0.01;
  const uppers = opts.uppers !== false;
  const elements = [];
  const dropped = [];

  // ── back wall run (left→right from x0): corner base, sink, base, stove, fridge at the far end
  const backSeq = [
    { type: 'kitchen-counter', w: 0.8, d: COUNTER_D, h: BASE_H, upper: true },
    { type: 'kitchen-sink', w: 0.84, d: COUNTER_D, h: BASE_H, upper: true },
    { type: 'kitchen-counter', w: 0.8, d: COUNTER_D, h: BASE_H, upper: true },
    { type: 'kitchen-stove', w: 0.76, d: COUNTER_D, h: BASE_H, upper: true },
    { type: 'kitchen-fridge', w: 0.72, d: 0.7, h: 1.82, upper: false },
  ];
  let cx = x0;
  for (const u of backSeq) {
    if (cx + u.w > x1 + 1e-6) { dropped.push(`back:${u.type}`); continue; }
    elements.push(el(u.type, footprintBack(cx, cx + u.w, y0, u.d, z0), u.h));
    if (uppers && u.upper) {
      elements.push(el('kitchen-upper', footprintBack(cx, cx + u.w, y0, UPPER_D, z0 + UPPER_Z), UPPER_H));
    }
    cx += u.w + gap;
  }

  // ── left wall run (down +y), starting past the back-run depth so it clears the corner
  let cy = y0 + COUNTER_D + 0.05;
  while (cy + 0.8 <= y1 - 0.05 + 1e-6) {
    elements.push(el('kitchen-counter', footprintLeft(cy, cy + 0.8, x0, COUNTER_D, z0), BASE_H));
    if (uppers) {
      elements.push(el('kitchen-upper', footprintLeft(cy, cy + 0.8, x0, UPPER_D, z0 + UPPER_Z), UPPER_H));
    }
    cy += 0.8 + gap;
  }

  return { elements, dropped };
}
