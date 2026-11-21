/**
 * THE SCREEN AS A MEASURE (the traditional side-scroller map, docs/side-map-principles.md "The screen"): a side map's
 * runs, corners and how far ahead the player sees are counted in SCREENS, as a gap is counted in the hero's reach. What
 * a screen is in metres follows from the side camera, and the camera follows from the hero: the benchmark holds the hero
 * at about an EIGHTH of the frame's height, on a 16:9 frame, the lane's top about two thirds of the way down it.
 *
 * The side camera (worlds/controllable/rules-basic.js `side`) stands `dist` off the lane looking at the hero `lookH` over
 * its feet, through a lens of `vfov` degrees up the frame. At the hero's plane the frame is 2·dist·tan(vfov/2) tall and
 * `aspect` times that wide. The strip's own camera (era/geocube-side.js SIDE_CAMERA) is not this one and keeps its bytes:
 * these are the side map's measures.
 *
 *   SIDE_MAP_FRAME                      { aspect, vfov, heroShare, laneDown, tilt }: the benchmark
 *   screenOf({ dist, vfov?, aspect? })  → { height, width } metres a screen spans at the hero's plane
 *   heroShare(stature, camera)          → the share of the frame's height a hero of `stature` metres stands
 *   sideMapCamera(stature, frame?)      → { dist, lookH, tilt, vfov, screen: { height, width } }: the camera that holds
 *                                         the hero at the frame's share, the lane's top at its place down the frame
 *   inScreens(metres, screen, axis?)    → how many screens `metres` is, along 'width' (a run) or 'height' (a climb)
 *
 * Pure: numbers in, numbers out.
 */

/** The benchmark frame: 16:9, the side camera's own lens (era/geocube-side.js SIDE_CAMERA.vfov), the hero an eighth of the
 * frame's height, the lane's top two thirds of the way down, the camera nearly level (a little over the lane). */
export const SIDE_MAP_FRAME = Object.freeze({ aspect: 16 / 9, vfov: 32.64, heroShare: 1 / 8, laneDown: 2 / 3, tilt: 0.05 });

const DEG = Math.PI / 180;
const r3 = (v) => Math.round(v * 1000) / 1000;
const num = (v, at) => { if (!(Number.isFinite(v) && v > 0)) throw new Error(`side map: ${at} is a positive number`); return v; };

/** The metres a screen spans at the hero's plane, for a side camera `dist` metres off it. */
export function screenOf({ dist, vfov = SIDE_MAP_FRAME.vfov, aspect = SIDE_MAP_FRAME.aspect } = {}) {
  const height = 2 * num(dist, 'dist') * Math.tan((num(vfov, 'vfov') * DEG) / 2);
  return { height: r3(height), width: r3(height * num(aspect, 'aspect')) };
}

/** The share of the frame's height a hero of `stature` metres stands, under a camera. */
export const heroShare = (stature, camera) => r3(num(stature, 'stature') / screenOf(camera).height);

/**
 * The side map's camera for a hero of `stature` metres (layered.js heroStature, the run's read of its made body): far
 * enough back that the hero stands the frame's `heroShare`, looking `lookH` over the hero's feet so the lane it stands on
 * meets the frame `laneDown` of the way down (the frame's middle is (laneDown − ½) of a screen over the lane).
 */
export function sideMapCamera(stature, frame = SIDE_MAP_FRAME) {
  const F = { ...SIDE_MAP_FRAME, ...frame }, H = num(stature, 'stature') / num(F.heroShare, 'heroShare');
  const dist = H / (2 * Math.tan((F.vfov * DEG) / 2));
  return { dist: r3(dist), lookH: r3(H * (F.laneDown - 0.5)), tilt: F.tilt, vfov: F.vfov, screen: screenOf({ dist, vfov: F.vfov, aspect: F.aspect }) };
}

/** How many screens `metres` is: along the width (a run's length) or the height (a climb's). */
export const inScreens = (metres, screen, axis = 'width') => r3(metres / num(screen?.[axis], `screen.${axis}`));
