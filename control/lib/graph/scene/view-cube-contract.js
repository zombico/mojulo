/**
 * view-cube-contract — the parent↔world postMessage wire for camera view presets.
 *
 * The camera lives inside the /world iframe's own three.js context; nothing outside
 * can reach it (ViewportHome recorded this in phase 6, the location board in phase 8).
 * This contract is the missing protocol, kept to three messages:
 *
 *   world → parent  { moj: MSG_VIEW_READY, groups } — announced once on boot, so a parent
 *                                                     pane only draws a preset strip for
 *                                                     frames that will answer it (a CSS-3D
 *                                                     /scene frame never says ready).
 *                                                     `groups` names the frame's REAL render
 *                                                     groups — the parent may only offer
 *                                                     selection over what actually exists
 *   parent → world  { moj: MSG_VIEW, view }         — snap to a named axis reading of the
 *                                                     subject's own bounds
 *   parent → world  { moj: MSG_FOCUS, group }       — isolate one render group (dim the
 *                                                     rest); `group: null` clears
 *
 * Same `{ moj }` dialect as the game shell's level contract (level-contract.js), and the
 * same posture as its pause sidecar: presentation-only, unversioned, inert for any world
 * that never gets embedded.
 *
 * Import-light on purpose — client panes bundle it.
 */

export const MSG_VIEW = 'world-view';
export const MSG_VIEW_READY = 'world-view-ready';
export const MSG_FOCUS = 'world-focus';

/**
 * The one render group every world has: faces carrying no `group` tag collapse
 * into it. It is the whole world for most kinds, so isolating it means nothing —
 * parents drop it before offering selection.
 */
export const STATIC_GROUP = 'static';

/** The strip's order: ¾ leads because it is the best single reading. */
export const VIEW_PRESETS = ['threeQuarter', 'front', 'side', 'top'];

/**
 * Direction from the subject's centre toward the camera, world z-up. front/side
 * carry a small +z lift so a floor-hugging subject doesn't degenerate to a line;
 * top carries an epsilon -y because a view direction exactly parallel to the
 * camera's up axis makes OrbitControls' orbit basis undefined.
 */
export const VIEW_DIRS = {
  threeQuarter: [1, -1, 0.55],
  front: [0, -1, 0.12],
  side: [1, 0, 0.12],
  top: [0, -0.001, 1],
};

export function viewMessage(view) {
  return { moj: MSG_VIEW, view };
}

/** `group: null` clears the isolation. */
export function focusMessage(group) {
  return { moj: MSG_FOCUS, group: group ?? null };
}

export function isViewReadyMessage(data) {
  return Boolean(data) && data.moj === MSG_VIEW_READY;
}

/** The selectable groups a ready message carries — `static` dropped, order kept. */
export function selectableGroups(data) {
  if (!Array.isArray(data?.groups)) return [];
  return data.groups.filter((g) => typeof g === 'string' && g && g !== STATIC_GROUP);
}
