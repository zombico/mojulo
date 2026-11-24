/**
 * THE SCROLL FRAME (Blaze Gunner, a scrolling shooter: the frame its stage is laid and played in). A scrolling shooter's
 * play is one PLANE, as a side map's lane is (gameworld/side-map/, docs/side-map-principles.md): every ship, round and
 * hurtbox at depth 0, so nothing in play changes size, and space stood behind it in layers at their depths, so the
 * perspective camera gives their parallax for nothing. A stage is written in SCREEN AXES, never the world's:
 *
 *   u   ALONG    the way the screen scrolls (ahead is +u: where the foes come from)
 *   v   ACROSS   square to it on the play plane
 *   d   DEPTH    off the plane toward the camera (+d the foreground, −d the layers behind)
 *
 * and a VIEW is the basis that stands those axes in the world. It is a rotation, never a reflection, so a pattern laid
 * for one view plays turned, never mirrored, in another:
 *
 *   side   left to right (Gradius's, Einhander's): along +y (the screen's right), across +z (its up), the camera on +x
 *          looking back at x 0 (the side map's own frame: its lane along +y at x 0, the camera on the +x side, so the
 *          shot light and the cel bodies read it as they read a side map), a 16:9 frame
 *   top    bottom to top (Raiden's): along +y (the screen's up), across −x (its left: the side view turned a quarter),
 *          the camera on +z looking down, a 3:4 frame
 *
 * The SHIP sets the screen, as the hero sets a side map's (side-map/screen.js): its length a share of the frame's ACROSS
 * extent (its height in the side view, its width in the top), so a small, agile ship has room to dodge through. A
 * screen is { along, across } metres at the play plane.
 *
 *   SCROLL_VIEWS                   the views: { along, across, toward, up, aspect } (unit vectors in the world)
 *   SCROLL_FRAME                   { vfov, shipShare, margin }: the lens (the side map's), the ship's share, the edge kept
 *   readScrollView(v)              → 'side' | 'top' (undefined: 'side'); throws, teaching
 *   scrollCamera(shipLength, o?)   → { view, dist, vfov, aspect, shipShare, screen: { along, across } }   o: { view?,
 *                                    shipShare?, vfov?, aspect? }
 *   cameraAt(cam, [u, v])          → { pos, lookAt, up }: the camera framing the screen centred at (u, v) on the plane
 *   toWorld(view, [u, v, d?])      → [x, y, z]
 *   toScreen(view, [x, y, z])      → [u, v, d]
 *   playBox(cam, { length?, breadth?, margin? }) → { u: [lo, hi], v: [lo, hi] }: where a ship's centre may stand, from
 *                                    the screen's centre: half the screen, less the edge kept and half the ship
 *   layerGrowth(cam, d)            → how much bigger a thing at depth d is drawn to fill the share of the frame it would
 *                                    fill on the plane ((dist − d) / dist: the side map's vista rule)
 *   layerPace(cam, d)              → how fast a layer at depth d slides across the frame, the play plane's pace being 1
 *
 * Pure: numbers in, numbers out.
 */
import { SIDE_MAP_FRAME } from '../side-map/screen.js';

const v3 = (x, y, z) => Object.freeze([x, y, z]);
export const SCROLL_VIEWS = Object.freeze({
  side: Object.freeze({ along: v3(0, 1, 0), across: v3(0, 0, 1), toward: v3(1, 0, 0), up: v3(0, 0, 1), aspect: 16 / 9 }),
  top: Object.freeze({ along: v3(0, 1, 0), across: v3(-1, 0, 0), toward: v3(0, 0, 1), up: v3(0, 1, 0), aspect: 3 / 4 }),
});
export const SCROLL_VIEW_IDS = Object.freeze(Object.keys(SCROLL_VIEWS));

/** The frame: the side map's lens, the ship's length a ninth of the frame across, a thirtieth of it kept at each edge. */
export const SCROLL_FRAME = Object.freeze({ vfov: SIDE_MAP_FRAME.vfov, shipShare: 1 / 9, margin: 1 / 30 });

const DEG = Math.PI / 180;
const r3 = (v) => Math.round(v * 1000) / 1000;
const no = (m) => { throw new Error(`scroll frame: ${m}`); };
const pos = (v, at) => (Number.isFinite(v) && v > 0 ? v : no(`${at} is a positive number`));

export function readScrollView(v) {
  if (v === undefined) return 'side';
  if (!SCROLL_VIEW_IDS.includes(v)) no(`view is ${SCROLL_VIEW_IDS.map((k) => `'${k}'`).join(' or ')} (side: left to right; top: bottom to top, seen from above)`);
  return v;
}

/**
 * The camera a ship of `shipLength` metres is framed by: far enough back that its length is `shipShare` of the frame's
 * across extent. The lens is vertical (up the frame): the across extent in the side view, the along in the top.
 */
export function scrollCamera(shipLength, o = {}) {
  const view = readScrollView(o.view), V = SCROLL_VIEWS[view];
  const L = pos(shipLength, 'shipLength'), share = pos(o.shipShare ?? SCROLL_FRAME.shipShare, 'shipShare');
  const vfov = pos(o.vfov ?? SCROLL_FRAME.vfov, 'vfov'), aspect = pos(o.aspect ?? V.aspect, 'aspect');
  if (share >= 1) no('shipShare is the share of the frame across the ship is long (under 1)');
  const across = L / share, height = view === 'side' ? across : across / aspect, width = height * aspect;
  const dist = height / (2 * Math.tan((vfov * DEG) / 2));
  return { view, dist: r3(dist), vfov, aspect, shipShare: share, screen: { along: r3(view === 'side' ? width : height), across: r3(across) } };
}

/** A point on the plane, or off it at depth d, in the world. */
export function toWorld(view, [u, v, d = 0]) {
  const V = SCROLL_VIEWS[readScrollView(view)], a = V.along, c = V.across, t = V.toward;
  return [a[0] * u + c[0] * v + t[0] * d, a[1] * u + c[1] * v + t[1] * d, a[2] * u + c[2] * v + t[2] * d];
}

/** A world point in screen axes (the basis is orthonormal: each axis its dot product). */
export function toScreen(view, [x, y, z]) {
  const V = SCROLL_VIEWS[readScrollView(view)], dot = (w) => w[0] * x + w[1] * y + w[2] * z;
  return [dot(V.along), dot(V.across), dot(V.toward)];
}

/** The camera framing the screen centred at (u, v): `dist` off the plane toward the viewer, looking square at it. */
export function cameraAt(cam, [u, v]) {
  const view = readScrollView(cam.view);
  return { pos: toWorld(view, [u, v, cam.dist]), lookAt: toWorld(view, [u, v, 0]), up: [...SCROLL_VIEWS[view].up] };
}

/** Where a ship's centre may stand, from the screen's centre: half the screen less the edge kept and half the ship (its
 * `length` along, its `breadth` across: its profile's height in the side view, its span in the top). */
export function playBox(cam, { length = 0, breadth = 0, margin = SCROLL_FRAME.margin } = {}) {
  const S = cam.screen, edge = margin * S.across;
  const hu = S.along / 2 - edge - length / 2, hv = S.across / 2 - edge - breadth / 2;
  if (!(hu > 0 && hv > 0)) no('the ship is too big for its screen: nothing is left to move in');
  return { u: [r3(-hu), r3(hu)], v: [r3(-hv), r3(hv)] };
}

/** How much bigger a thing at depth d (negative: behind the plane) is drawn to fill the share it would fill on the plane. */
export const layerGrowth = (cam, d) => {
  if (!(d < cam.dist)) no('a layer stands between the camera and beyond it (depth under the camera\'s distance)');
  return (cam.dist - d) / cam.dist;
};

/** How fast a layer at depth d slides across the frame as the camera scrolls, the play plane's pace 1: behind slower,
 * in front faster. */
export const layerPace = (cam, d) => 1 / layerGrowth(cam, d);
