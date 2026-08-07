/**
 * Pose vocabulary — closed stick-pose entries (image-outcomes.plan.md I2).
 *
 * The spike proved a simple pose silhouette is enough to steer the painted
 * beat — no protoform figure rig needed in the control layer. Each entry is
 * pure data: four limb segments as offsets from the figure anchor (in units
 * of the figure scale; head/torso/hip are shared), plus a one-line beat
 * phrasing rendered into worker instructions. `poseFigure` is the single
 * emitter that turns an entry into scaffold SVG.
 *
 * Anchor semantics: (x, y) is the figure's mid-torso; the head sits at
 * y − 78s, feet reach ~y + 104s. Limbs are single segments by design —
 * silhouette steering, not anatomy.
 */

// [x1, y1, x2, y2] offsets, scaled by figure scale. arms then legs.
export const POSE_VOCAB = {
  stand: {
    phrase: 'standing upright, weight even, arms relaxed',
    limbs: [[-3, -42, -56, 18], [3, -42, 56, 18], [-20, 22, -28, 104], [20, 22, 28, 104]],
  },
  reach: {
    phrase: 'reaching upward/outward with the leading arm, body extended',
    limbs: [[-4, -42, -58, -78], [4, -42, 78, -96], [-20, 22, -44, 96], [20, 22, 26, 102]],
  },
  crouch: {
    phrase: 'crouched low, arms braced wide, legs folded under',
    limbs: [[-4, -40, -62, -4], [4, -40, 66, -8], [-18, 22, -74, 70], [18, 22, 70, 68]],
  },
  point: {
    phrase: 'pointing decisively with one extended arm, gaze following it',
    limbs: [[-3, -42, -38, 12], [4, -46, 84, -46], [-20, 22, -28, 104], [20, 22, 28, 104]],
  },
  wave: {
    phrase: 'one arm raised in a wave/hail, the other relaxed',
    limbs: [[-3, -42, -50, 14], [4, -46, 46, -100], [-20, 22, -28, 104], [20, 22, 28, 104]],
  },
  run: {
    phrase: 'mid-stride run, arms pumping opposite the legs',
    limbs: [[-4, -42, -54, -14], [4, -42, 58, 8], [-20, 22, -76, 66], [20, 22, 52, 100]],
  },
  walk: {
    phrase: 'walking, easy gait, one foot forward',
    limbs: [[-3, -42, -40, 6], [3, -42, 42, 4], [-20, 22, -46, 100], [20, 22, 40, 102]],
  },
  sit: {
    phrase: 'seated, thighs forward, hands resting near the knees',
    limbs: [[-3, -42, -34, 30], [3, -42, 38, 28], [-18, 22, -54, 44], [18, 22, 58, 46]],
  },
  kneel: {
    phrase: 'kneeling on one knee, braced and grounded',
    limbs: [[-3, -42, -40, 20], [3, -42, 48, 4], [-18, 22, -30, 96], [18, 22, 64, 60]],
  },
  fall: {
    phrase: 'falling/thrown, limbs flung, weight off balance',
    limbs: [[-4, -46, -70, -60], [4, -40, 62, -30], [-18, 22, -66, 84], [18, 22, 34, 100]],
  },
  brace: {
    phrase: 'braced for impact, arms shielding, stance wide',
    limbs: [[-4, -42, -34, -66], [4, -42, 34, -64], [-20, 22, -56, 96], [20, 22, 56, 96]],
  },
  embrace: {
    phrase: 'arms wrapped forward around a companion or object',
    limbs: [[-4, -42, 42, -12], [4, -42, 46, -20], [-20, 22, -28, 104], [20, 22, 28, 104]],
  },
};

export const POSE_KINDS = Object.keys(POSE_VOCAB);

export function isPoseKind(pose) {
  return Object.prototype.hasOwnProperty.call(POSE_VOCAB, pose);
}

export function poseEntry(pose) {
  const entry = POSE_VOCAB[pose];
  if (!entry) throw new Error(`unknown pose: ${pose} (one of: ${POSE_KINDS.join(', ')})`);
  return { pose, ...entry };
}

export function posePhrase(pose) {
  return poseEntry(pose).phrase;
}

function line(x1, y1, x2, y2, color, width) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
}

export function poseFigure({ x, y, scale = 1, pose = 'stand', color = '#f59e0b' }) {
  const { limbs } = poseEntry(pose);
  const s = scale;
  const head = `<circle cx="${x}" cy="${y - 78 * s}" r="${18 * s}" fill="none" stroke="${color}" stroke-width="${5 * s}"/>`;
  const torso = line(x, y - 58 * s, x, y + 18 * s, color, 6 * s);
  const hip = line(x - 24 * s, y + 22 * s, x + 24 * s, y + 22 * s, color, 5 * s);
  const limbSvg = limbs
    .map(([x1, y1, x2, y2]) => line(x + x1 * s, y + y1 * s, x + x2 * s, y + y2 * s, color, 5 * s))
    .join('');
  return `<g opacity="0.95">${head}${torso}${hip}${limbSvg}</g>`;
}
