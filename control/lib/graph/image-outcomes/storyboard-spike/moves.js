/**
 * Storyboard move vocabulary — closed, like cameras.js and poses.js (the
 * I2 lesson: a freeform "camera pans" string is read as vibes; a closed
 * entry carries BOTH an instruction phrase and deterministic arrow
 * geometry).
 *
 * Two vocabularies:
 *   - CAMERA_MOVES  — how the (virtual) camera moves through the shot.
 *   - SUBJECT_MOVES — how a staged figure moves within the frame.
 *
 * Division of labor (the overlay-re-imposes-truth rule applied to motion):
 * the instruction phrase teaches the model COMPOSITION consequences only
 * (lead room, headroom) — the model never paints arrows or motion lines;
 * the arrow geometry is drawn by the BOARD compositor as a deterministic
 * SVG overlay on top of the finished frame.
 *
 * Arrow emitters return SVG fragments in frame coordinates ({width,
 * height} of the frame viewBox). Pure functions, no dice.
 */

export const CAMERA_MOVES = {
  static: {
    phrase: 'locked-off static camera — composition holds for the full shot',
    arrows: () => [],
  },
  'pan-left': {
    phrase: 'camera pans LEFT across the scene — compose with lead room opening on the left edge',
    arrows: ({ width, height }) => [edgeArrow(width * 0.88, height * 0.5, width * 0.62, height * 0.5)],
  },
  'pan-right': {
    phrase: 'camera pans RIGHT across the scene — compose with lead room opening on the right edge',
    arrows: ({ width, height }) => [edgeArrow(width * 0.12, height * 0.5, width * 0.38, height * 0.5)],
  },
  'tilt-up': {
    phrase: 'camera tilts UP — compose with the subject low and headroom to travel into',
    arrows: ({ width, height }) => [edgeArrow(width * 0.5, height * 0.82, width * 0.5, height * 0.55)],
  },
  'tilt-down': {
    phrase: 'camera tilts DOWN — compose with the reveal below the starting frame',
    arrows: ({ width, height }) => [edgeArrow(width * 0.5, height * 0.18, width * 0.5, height * 0.45)],
  },
  'push-in': {
    phrase: 'camera pushes IN toward the subject — compose wide enough that the push has somewhere to land',
    arrows: ({ width, height }) => cornerArrows({ width, height }, 'in'),
  },
  'pull-back': {
    phrase: 'camera pulls BACK from the subject — compose the subject large; the pull reveals context',
    arrows: ({ width, height }) => cornerArrows({ width, height }, 'out'),
  },
  'track-left': {
    phrase: 'camera tracks LEFT with the action — hold the subject in frame while the background streams right',
    arrows: ({ width, height }) => [edgeArrow(width * 0.84, height * 0.86, width * 0.58, height * 0.86), edgeArrow(width * 0.42, height * 0.86, width * 0.16, height * 0.86)],
  },
  'track-right': {
    phrase: 'camera tracks RIGHT with the action — hold the subject in frame while the background streams left',
    arrows: ({ width, height }) => [edgeArrow(width * 0.16, height * 0.86, width * 0.42, height * 0.86), edgeArrow(width * 0.58, height * 0.86, width * 0.84, height * 0.86)],
  },
};

export const SUBJECT_MOVES = {
  'enter-left': { phrase: 'enters frame from the LEFT edge', dx: 1, dy: 0 },
  'enter-right': { phrase: 'enters frame from the RIGHT edge', dx: -1, dy: 0 },
  'exit-left': { phrase: 'exits frame LEFT', dx: -1, dy: 0 },
  'exit-right': { phrase: 'exits frame RIGHT', dx: 1, dy: 0 },
  'cross-left': { phrase: 'crosses the frame RIGHT-to-LEFT', dx: -1, dy: 0 },
  'cross-right': { phrase: 'crosses the frame LEFT-to-RIGHT', dx: 1, dy: 0 },
  'toward-camera': { phrase: 'moves TOWARD camera, growing in frame', dx: 0, dy: 1 },
  'away-from-camera': { phrase: 'moves AWAY from camera, shrinking upstage', dx: 0, dy: -1 },
};

export const CAMERA_MOVE_KINDS = Object.keys(CAMERA_MOVES);
export const SUBJECT_MOVE_KINDS = Object.keys(SUBJECT_MOVES);

export function isCameraMove(kind) {
  return Object.prototype.hasOwnProperty.call(CAMERA_MOVES, kind);
}

export function isSubjectMove(kind) {
  return Object.prototype.hasOwnProperty.call(SUBJECT_MOVES, kind);
}

export function cameraMovePhrase(kind) {
  const entry = CAMERA_MOVES[kind];
  if (!entry) throw new Error(`unknown camera move: ${kind} (one of: ${CAMERA_MOVE_KINDS.join(', ')})`);
  return entry.phrase;
}

export function subjectMovePhrase(kind) {
  const entry = SUBJECT_MOVES[kind];
  if (!entry) throw new Error(`unknown subject move: ${kind} (one of: ${SUBJECT_MOVE_KINDS.join(', ')})`);
  return entry.phrase;
}

// ── arrow geometry (board-overlay SVG fragments) ──

const ARROW_STYLE = 'stroke="#f8fafc" stroke-width="10" fill="none" marker-end="url(#board-arrow)" opacity="0.92"';

function edgeArrow(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${ARROW_STYLE}/>`;
}

function cornerArrows({ width, height }, direction) {
  const inset = 0.14;
  const reach = 0.12;
  return [
    [inset, inset, inset + reach, inset + reach],
    [1 - inset, inset, 1 - inset - reach, inset + reach],
    [inset, 1 - inset, inset + reach, 1 - inset - reach],
    [1 - inset, 1 - inset, 1 - inset - reach, 1 - inset - reach],
  ].map(([ax, ay, bx, by]) => {
    const [x1, y1, x2, y2] = direction === 'in' ? [ax, ay, bx, by] : [bx, by, ax, ay];
    return edgeArrow(x1 * width, y1 * height, x2 * width, y2 * height);
  });
}

/** Arrow marker def — include once per board SVG/overlay. */
export const ARROW_MARKER_DEF = '<marker id="board-arrow" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 1 1 L 11 6 L 1 11 z" fill="#f8fafc"/></marker>';

/**
 * Subject-move arrow at a figure's staged position: a short arrow anchored
 * at the figure's mid-torso, pointing along the move's direction.
 */
export function subjectArrow(move, figure, { width, height }) {
  const entry = SUBJECT_MOVES[move];
  if (!entry) throw new Error(`unknown subject move: ${move}`);
  const len = Math.min(width, height) * 0.22;
  const x2 = figure.x + entry.dx * len;
  // toward-camera points down-frame (growing), away points up-frame.
  const y2 = figure.y + entry.dy * len * 0.7;
  return edgeArrow(figure.x, figure.y, x2, y2);
}

/** All arrows for one shot (camera move + per-figure subject moves). */
export function shotArrows(shot, frame) {
  const arrows = [];
  if (shot.cameraMove && shot.cameraMove !== 'static') {
    arrows.push(...CAMERA_MOVES[shot.cameraMove].arrows(frame));
  }
  for (const f of shot.figures) {
    if (f.move) arrows.push(subjectArrow(f.move, f, frame));
  }
  return arrows;
}
