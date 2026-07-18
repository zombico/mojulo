/**
 * Walk-cycle pose entries — pan-cel spike. Six phases of a side-view walk,
 * travel direction +x (rightward), in the exact POSE_VOCAB limb format
 * (pan-cel-motion.plan.md: "2–4 walk/wave cycle poses added behind the same
 * closed-vocab discipline"). On promotion these merge into poses.js.
 *
 * Anchor semantics match poses.js: (x, y) mid-torso, head at y − 78s,
 * feet ~y + 104s. Limbs: [x1,y1,x2,y2] offsets × scale — arms then legs,
 * far-side limb first. Silhouette steering, not anatomy; the slight body
 * bob of a real walk is left to the painter (the phrase states the phase).
 */

import { facingTick } from './facings.js';

export const CYCLE_POSE_VOCAB = {
  'walk-contact-a': {
    phrase: 'walk cycle, contact: near leg planted forward heel-first, far leg extended back, arms counter-swung',
    limbs: [[-3, -42, 40, 4], [3, -42, -36, 8], [-20, 22, -52, 98], [20, 22, 60, 94]],
  },
  'walk-down-a': {
    phrase: 'walk cycle, down: weight settling onto the forward near leg, stride closing, arms passing the torso',
    limbs: [[-3, -42, 26, 10], [3, -42, -22, 12], [-20, 22, -30, 102], [20, 22, 44, 100]],
  },
  'walk-passing-a': {
    phrase: 'walk cycle, passing: legs nearly together, far leg lifting bent under the body, arms at the sides',
    limbs: [[-3, -42, 6, 14], [3, -42, -2, 14], [-20, 22, -4, 70], [20, 22, 14, 102]],
  },
  'walk-contact-b': {
    phrase: 'walk cycle, contact (opposite): far leg planted forward heel-first, near leg extended back, arms counter-swung',
    limbs: [[-3, -42, -36, 8], [3, -42, 40, 4], [-20, 22, 56, 94], [20, 22, -48, 98]],
  },
  'walk-down-b': {
    phrase: 'walk cycle, down (opposite): weight settling onto the forward far leg, stride closing, arms passing the torso',
    limbs: [[-3, -42, -22, 12], [3, -42, 26, 10], [-20, 22, 40, 100], [20, 22, -26, 102]],
  },
  'walk-passing-b': {
    phrase: 'walk cycle, passing (opposite): legs nearly together, near leg lifting bent under the body, arms at the sides',
    limbs: [[-3, -42, -2, 14], [3, -42, 6, 14], [-20, 22, 10, 102], [20, 22, 0, 70]],
  },
};

export const CYCLE_POSE_KINDS = Object.keys(CYCLE_POSE_VOCAB);

export function cyclePoseEntry(pose) {
  const entry = CYCLE_POSE_VOCAB[pose];
  if (!entry) throw new Error(`unknown cycle pose: ${pose} (one of: ${CYCLE_POSE_KINDS.join(', ')})`);
  return { pose, ...entry };
}

export function cyclePosePhrase(pose) {
  return cyclePoseEntry(pose).phrase;
}

function line(x1, y1, x2, y2, color, width) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
}

/**
 * Stick emitter for cycle poses — the poseFigure geometry (head, torso,
 * hip bar, four limbs) plus the facing tick, since a walk shot always has
 * a facing. strokeScale fattens every stroke (silhouette-matte rendering).
 */
export function cyclePoseFigure({ x, y, scale = 1, pose, facing = 'right', color = '#f59e0b', strokeScale = 1 }) {
  const { limbs } = cyclePoseEntry(pose);
  const s = scale;
  const k = strokeScale;
  const head = `<circle cx="${x}" cy="${y - 78 * s}" r="${18 * s}" fill="${k > 1 ? color : 'none'}" stroke="${color}" stroke-width="${5 * s * k}"/>`;
  const torso = line(x, y - 58 * s, x, y + 18 * s, color, 6 * s * k);
  const hip = line(x - 24 * s, y + 22 * s, x + 24 * s, y + 22 * s, color, 5 * s * k);
  const limbSvg = limbs
    .map(([x1, y1, x2, y2]) => line(x + x1 * s, y + y1 * s, x + x2 * s, y + y2 * s, color, 5 * s * k))
    .join('');
  const tick = k > 1 ? '' : facingTick({ x, y, scale: s, facing, color });
  return `<g opacity="${k > 1 ? 1 : 0.95}">${head}${torso}${hip}${limbSvg}${tick}</g>`;
}

/**
 * The cel's matte silhouette — the pose drawn as a fat white mass on
 * transparent, in cel-local coordinates. Rasterized + blurred it becomes
 * the feathered alpha mask that lifts a generated (opaque) cel off its
 * plate crop at composite time.
 */
export function celSilhouetteSvg({ rect, figure }) {
  const fig = cyclePoseFigure({
    x: figure.x - rect.x,
    y: figure.y - rect.y,
    scale: figure.scale,
    pose: figure.pose,
    color: '#ffffff',
    strokeScale: 3.2,
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rect.w} ${rect.h}" width="${rect.w}" height="${rect.h}">${fig}</svg>`;
}
