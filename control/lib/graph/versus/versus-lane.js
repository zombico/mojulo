/**
 * versus lane — where a fight stands on a level: the one fact the fight asks of whatever level hosts it.
 *
 * A side-view fight runs along a straight LANE. The level says where it is, the fight does the rest:
 *
 *   { at: [x, y], heading, half, floor, back? }
 *     at       m, the lane's centre on the level's ground plan (world x, y; z up)
 *     heading  degrees, the way the lane runs (0 along +x, 90 along +y); the sim's +x is this way
 *     half     m, the lane's walls either side of its centre (the sim's walls, a body's width inside the level's)
 *     floor    m, the height the fighters stand on
 *     back     m, optional: the open room on the camera's side, measured square to the lane; the camera never stands
 *              further back than this (a walled alley's), absent the camera keeps the genre's framing
 *
 * The camera stands on the lane's RIGHT as it runs (lane-local −y), square to it, as every arena has stood it (the
 * stage's open side). So a level opens the lane's right side to the camera and turns the lane to suit.
 *
 * A stored arena carries the old words (`plane`, `half`, `floor`): its lane at heading 0, its centre at x 0 and
 * `plane` along y, read by `legacyLane`, so a row minted before keeps its place.
 *
 *   readLane(lane, where)        → the settled lane (throws naming the fault)
 *   legacyLane({ plane, half, floor })  → the lane a stored arena's words name
 *   laneOf(versus)               → the lane a world's versus block names: its `lane`, else its legacy words
 *   lanePoint(lane, s, n, z)     → [x, y, z] world metres of a lane-local point (s along, n across toward the far side,
 *                                  z above the floor)
 *   laneEnds(lane)               → the lane's two walls' points on its floor
 *
 * Pure: no clock, no dice.
 */

const r4 = (v) => Math.round(v * 1e4) / 1e4 + 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
/** the lane's bounds: a fight needs room to move, and a lane no level could hold is a typo */
export const LANE_LIMITS = Object.freeze({ half: [2.5, 20], floor: [-50, 200], back: [2, 60], at: 500 });

/** Read a lane; → { at, heading, half, floor, back? } (throws naming the fault). */
export function readLane(lane, where = 'lane') {
  if (!lane || typeof lane !== 'object' || Array.isArray(lane)) throw new Error(`versus: ${where} is { at: [x, y], heading, half, floor, back? }`);
  for (const k of Object.keys(lane)) if (!['at', 'heading', 'half', 'floor', 'back'].includes(k)) throw new Error(`versus: ${where}.${k} is not a lane's word (at, heading, half, floor, back)`);
  const { at = [0, 0], heading = 0, half, floor = 0, back } = lane;
  if (!Array.isArray(at) || at.length !== 2 || !at.every(isNum) || at.some((v) => Math.abs(v) > LANE_LIMITS.at)) throw new Error(`versus: ${where}.at is [x, y], metres on the level's plan (within ${LANE_LIMITS.at} m)`);
  if (!isNum(heading)) throw new Error(`versus: ${where}.heading is degrees, the way the lane runs (0 along +x)`);
  const [hLo, hHi] = LANE_LIMITS.half, [fLo, fHi] = LANE_LIMITS.floor, [bLo, bHi] = LANE_LIMITS.back;
  if (!isNum(half) || half < hLo || half > hHi) throw new Error(`versus: ${where}.half is the lane's walls either side of its centre, ${hLo} to ${hHi} m`);
  if (!isNum(floor) || floor < fLo || floor > fHi) throw new Error(`versus: ${where}.floor is the height the fighters stand on, ${fLo} to ${fHi} m`);
  if (back !== undefined && (!isNum(back) || back < bLo || back > bHi)) throw new Error(`versus: ${where}.back is the open room on the camera's side, ${bLo} to ${bHi} m`);
  // (a heading turned into [0, 360): the same lane however it is written)
  const h = ((heading % 360) + 360) % 360;
  return { at: [r4(at[0]), r4(at[1])], heading: r4(h), half: r4(half), floor: r4(floor), ...(back !== undefined ? { back: r4(back) } : {}) };
}

/** The lane a stored arena's words name: heading 0, its centre at x 0 and `plane` along y. */
export function legacyLane({ plane, half, floor = 0 } = {}) {
  return readLane({ at: [0, plane ?? 0], heading: 0, half: half ?? 8, floor: floor ?? 0 }, 'arena');
}

/** The lane a world's versus block names: its own `lane`, else the words a stored arena carries. */
export function laneOf(versus = {}) {
  return versus.lane ? readLane(versus.lane, 'versus.lane') : legacyLane(versus);
}

/** A lane-local point in world metres: s along the lane from its centre, n across it toward the far side (the camera
 * stands at −n), z above its floor. */
export function lanePoint(lane, s, n = 0, z = 0) {
  const t = (lane.heading * Math.PI) / 180, c = Math.cos(t), si = Math.sin(t);
  return [r4(lane.at[0] + s * c - n * si), r4(lane.at[1] + s * si + n * c), r4(lane.floor + z)];
}

/** The lane's two walls, on its floor: [[x, y, z] at −half, [x, y, z] at +half]. */
export const laneEnds = (lane) => [lanePoint(lane, -lane.half), lanePoint(lane, lane.half)];
