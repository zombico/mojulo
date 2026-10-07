/**
 * OBJECT LAWS — what makes a game object worth looking at, written so a build can be measured against them (the hero's
 * way: measure the mesh, read the measures against bands, advise per measure; never refuse). They sit beside the
 * sixth-gen laws (../../era/laws.js) and read the same frame: detail is judged at the era's 640×448, at the distance the
 * player meets the thing.
 *
 * One dial drives them: INTEREST, how much the thing matters to the moment. Filler is quiet so the thing that matters
 * can be loud; a rank sets how many silhouette segments it must show, whether 33/66 holds, and whether it may carry
 * the accent.
 *
 * Colour is not an object's concern. An object is built in VALUES only (greys) on named surface groups, and a tone
 * (../../era/tone.js) says what colours those values become — one object, any look, the way a theme dresses a site.
 */

export const OBJECT_LAWS = Object.freeze({
  'inverse-interest': 'The more interesting a thing is, the more distinct its silhouette segments; filler stays one quiet shape.',
  'thirty-three': '33/66: the main mass is the 66, the primary detail the 33, and the 33 is big enough to read at play distance (one interesting thing per eye spot).',
  'emboss-fill': 'Emboss or shade in: the 66 that is not the primary detail is never flat; it carries texture or contrast in value.',
  'values-only': 'Black and white: an object is built in values on its surface groups; colour is the tone\'s, from a separate concern.',
  'detail-holds-band': 'The primary detail and the main mass land in different value bands under any tone\'s hard steps, so the 33 survives a three-value look.',
  'accent-is-use': 'The accent marks what you can use: status and interaction take the reserved accent group, and nothing else does.',
  'juxtaposition': 'Things in a run (a row across, a stack up) draw the eye, and the size of the run says how much the moment needs them. A placement law: an object declares how it runs, the level places the run.',
});

// The surface groups an object's faces carry. A tone maps each to a ramp; `obj:status` is the accent a tone keeps.
export const OBJECT_GROUPS = Object.freeze(['obj:body', 'obj:fill', 'obj:detail', 'obj:status']);

// Interest ranks, quietest first. `segments` is the band of distinct silhouette segments the rank must show (inverse
// interest: filler at most one notch, a focus at least three); `third` whether 33/66 is read; `accent` whether it may
// carry `obj:status`; `distance` the metres the player usually meets it at (the frame reads it from there); `run` how
// many of it a run should hold before the run itself says "this matters".
export const INTEREST = Object.freeze({
  filler: { rank: 0, segments: [0, 1], third: false, accent: false, distance: 6, run: [5, 9] },
  prop: { rank: 1, segments: [1, 3], third: true, accent: false, distance: 4, run: [3, 5] },
  interactable: { rank: 2, segments: [2, 6], third: true, accent: true, distance: 3, run: [2, 3] },
  focus: { rank: 3, segments: [3, 9], third: true, accent: true, distance: 4, run: [1, 1] },
});

// The frame the era reads detail at (../../era/sixth-gen.js frame) and the camera that frames it.
export const FRAME = Object.freeze({ width: 640, height: 448, fovDeg: 60 });
// The eye spot: the least span, in frame pixels at play distance, the primary detail must cover to read as a thing.
export const EYE_SPOT_PX = 12;
// The least area, in frame pixels, a notch in the silhouette must have to count as a segment break.
export const NOTCH_PX = 12;
// 33/66: the primary detail's span over the object's, along the object's own longest axis in the view it faces.
export const THIRD_BAND = Object.freeze([0.22, 0.45]);
// emboss: the least value step between the fill's darkest and lightest, so the 66 is never one flat grey.
export const EMBOSS_STEP = 0.08;
// the hard steps the detail must hold a band apart under (the tone presets' `steps`)
export const TONE_STEPS = Object.freeze([3, 4, 5]);

/** The metres one frame pixel covers at a distance (vertical FOV over the frame height). */
export const metresPerPixel = (distance) => (2 * distance * Math.tan((FRAME.fovDeg * Math.PI) / 360)) / FRAME.height;
