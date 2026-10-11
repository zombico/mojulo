/**
 * The fitted bathroom (`furnishing: 'fitted'`): its fixtures at true size, placed by the rules a plumber and an
 * inspector would use, never stretched to a share of the room.
 *
 * The room is arranged in the canonical frame every arranger uses (floorplan-glyphs.js): x across, y deep, the door on
 * the front wall (y = h); the house turns the layout to the real door after. The back wall (y = 0) is the wet wall.
 *
 * The layouts, in order of preference, the first the room holds:
 *   tub       the bathtub along the left wall, its open side to the room; the water closet and a vanity along the wet
 *             wall beside it; in a wide room a double vanity, and then a shower in the far corner
 *   tub-back  the bathtub across the wet wall (a narrow room, the door on its short side); the water closet and a vanity
 *             down the left wall below it
 *   pair      the water closet and a vanity
 *   wc        the water closet alone
 * A shower needs the depth a tub does (36 in and 24 in before it), so it stands beside a tub in a big room, not in
 * place of one.
 * A mirror hangs over each basin, a towel rail on the right wall, a bath mat before the tub or shower. The layout says
 * which of a full bathroom's fixtures (a water closet, a basin, a tub or shower) the room could not hold.
 *
 * Pure: the same room, the same layout.
 */

import { FIXTURES, fixtureSize } from './fixtures.js';

const MM_FT = 304.8;
const ft = (id) => fixtureSize(id, MM_FT);
const clear = (id) => FIXTURES[id].front / MM_FT;
const GAP = 0.02;   // between fixtures, ft (the water closet's 30 in zone already holds its side clearance)

// facing: the wall a fixture's back stands on, as the kitchen run names it (room-scene-elements.js FACING_SPIN, turned
// for a local asset): the back wall 'N', the left wall 'E', the right wall 'W'
const BACK = 'N', LEFT = 'E', RIGHT = 'W';

/**
 * @param {{ w: number, h: number }} room  the interior, ft (w across, h deep, the door on the front wall)
 * @returns {Array} room elements (anchor and size as fractions of the room, heightWorld ft), with `.layout` and
 *   `.dropped` on the array
 */
export function arrangeBathroom({ w: W = 8, h: D = 6 } = {}) {
  const wc = ft('wc'), van = ft('vanity'), dvan = ft('double-vanity'), tub = ft('bathtub'), shr = ft('shower');
  const mir = ft('mirror'), rail = ft('towel-rail');
  const wcZone = FIXTURES.wc.zone / MM_FT;
  const els = [];
  const at = (id, x0, y0, xLen, yLen, facing) => els.push({
    type: `fixture-${id}`, asset: `fixture-${id}`, fixture: id,
    anchor: [(x0 + xLen / 2) / W, (y0 + yLen / 2) / D], w: xLen / W, h: yLen / D, heightWorld: ft(id).h, facing,
  });
  // the wet-wall run needs the water closet's 30 in zone and a vanity, and their clearance in front
  const runDepth = Math.max(wc.d + clear('wc'), van.d + clear('vanity'));
  const runFrom = (x) => W - x >= wcZone + GAP + van.w && D >= runDepth;
  // lay the run from x: the water closet, then a vanity (a double one when the wall has room), a mirror over each basin
  const run = (x, { roomy = false } = {}) => {
    at('wc', x + (wcZone - wc.w) / 2, 0, wc.w, wc.d, BACK);
    const vx = x + wcZone + GAP;
    const double = roomy && W - vx >= dvan.w + GAP + (roomy === 'shower' ? shr.w + GAP : 0);
    const v = double ? dvan : van;
    at(double ? 'double-vanity' : 'vanity', vx, 0, v.w, v.d, BACK);
    for (const cx of double ? [vx + v.w / 4, vx + (3 * v.w) / 4] : [vx + v.w / 2]) at('mirror', cx - mir.w / 2, 0, mir.w, mir.d, BACK);
    return vx + v.w;
  };
  const mat = (x0, y0, xLen, yLen) => els.push({ type: 'rug', asset: 'bordered-rug', anchor: [(x0 + xLen / 2) / W, (y0 + yLen / 2) / D], w: xLen / W, h: yLen / D, heightWorld: 0.04 });

  let layout = 'none', end = 0, wet = null;
  // the tub along the left wall: its length runs the room's depth, so the room is as deep as the tub is long
  const tubFits = D >= tub.w && runFrom(tub.d + GAP);
  if (tubFits) {
    layout = 'tub';
    at('bathtub', 0, 0, tub.d, tub.w, LEFT);
    end = run(tub.d + GAP, { roomy: W - (tub.d + GAP + wcZone + GAP) >= dvan.w + GAP + shr.w + GAP ? 'shower' : true });
    if (W - end >= shr.w + GAP && D >= shr.d + clear('shower')) at('shower', W - shr.w, 0, shr.w, shr.d, BACK);
    // the mat before the tub's open side, past the wet-wall run's clearance so it never lies under the water closet
    const y0 = Math.max(wc.d, van.d) + 0.3;
    wet = { x0: tub.d + GAP, y0, xLen: 2, yLen: Math.min(3, tub.w - y0) };
  } else if (W >= tub.w && D >= tub.d + GAP + wcZone + GAP + van.w && W >= Math.max(wc.d + clear('wc'), van.d + clear('vanity'))) {
    layout = 'tub-back';
    at('bathtub', 0, 0, tub.w, tub.d, BACK);
    const y = tub.d + GAP;
    at('wc', 0, y + (wcZone - wc.w) / 2, wc.d, wc.w, LEFT);
    at('vanity', 0, y + wcZone + GAP, van.d, van.w, LEFT);
    at('mirror', 0, y + wcZone + GAP + (van.w - mir.w) / 2, mir.d, mir.w, LEFT);
    end = 0;
    wet = { x0: W - 2.2, y0: tub.d + GAP, xLen: 2, yLen: Math.min(3, D - tub.d - 0.5) };
  } else if (runFrom(0)) {
    layout = 'pair';
    end = run(0);
  } else if (W >= wcZone && D >= wc.d + clear('wc')) {
    layout = 'wc';
    at('wc', (wcZone - wc.w) / 2, 0, wc.w, wc.d, BACK);
    end = wcZone;
  }
  // a towel rail on the right wall, clear of what stands on the wet wall
  const railY = Math.max(van.d, shr.d) + 0.5;
  if (layout !== 'none' && D - railY >= rail.w + 0.5 && W - end >= 0) at('towel-rail', W - rail.d, railY, rail.d, rail.w, RIGHT);
  if (wet) mat(wet.x0, wet.y0, wet.xLen, wet.yLen);
  const has = (ids) => els.some((e) => ids.includes(e.fixture));
  const dropped = [['wc', ['wc']], ['basin', ['vanity', 'double-vanity']], ['bathtub or shower', ['bathtub', 'shower']]]
    .filter(([, ids]) => !has(ids)).map(([name]) => name);
  return Object.assign(els, { layout, dropped });
}
