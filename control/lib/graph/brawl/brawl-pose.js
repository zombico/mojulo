/**
 * brawl pose — what a body of the brawl is drawn as: its pose this frame, for the fight's rig to joint (versus-rig.js
 * rigJoints) and its figure to stand in the round (versus-figure.js figurePose). A move plays its frames' poses, a body
 * reacting plays the fight's reactions (versus-react.js: a hit, a fall, down, rising, held), as a fighter does; the
 * brawl's own states have their own: the walk along and across the street, the run and the back-step, the clinch
 * (the arms reaching to hold, a knee driven up as it lands), a held body as one thrown, a body bending to pick a thing
 * up.
 *
 *   brawlPoseOf(p, F, t, rules) → a pose (the fight's pose words)
 *
 * Pure: `t` is the page's frame count (the breathing and the stride run on it).
 */
import { POSES } from '../versus/versus-library.js';
import { lerpPose } from '../versus/versus-rig.js';
import { reactionPose } from '../versus/versus-react.js';

const wave = (t, k) => (Math.sin(t * k) + 1) / 2;

export function brawlPoseOf(p, F, t = 0, rules = {}) {
  if (p.mv && F.moves[p.mv]) {
    const m = F.moves[p.mv];
    return m.frames[Math.max(1, Math.min(p.mf, m.total))].pose;
  }
  const own = F.poses ?? POSES, guard = own.guard, crouch = own.crouch;
  // (a held body reads as the fight's thrown: the held clip)
  const reacting = reactionPose(p.st === 'held' ? { ...p, st: 'thrown' } : p, rules, own);
  if (reacting) return reacting;
  switch (p.st) {
    case 'walk': {
      // the stride: along the street the chest opens to the way it walks, across it the body steps square
      const w = wave(t, 0.22), s = w * 2 - 1, along = p.wx !== 0;
      return { ...lerpPose(own.walkA ?? POSES.walkA, own.walkB ?? POSES.walkB, w), sway: s * 7, twist: (along ? 8 : 2) - s * 5, tilt: s * 3 };
    }
    // running: the stride quicker and longer, the body leaning into it; the back-step the fight's back dash
    case 'run': {
      const w = wave(t, 0.42), s = w * 2 - 1;
      const stride = lerpPose(own.walkA ?? POSES.walkA, own.walkB ?? POSES.walkB, w);
      return { ...stride, torso: (stride.torso ?? 0) + 18, sway: s * 9, twist: 10 - s * 7, tilt: s * 4 };
    }
    case 'back': return own.backdash ?? POSES.backdash;
    case 'prejump': return POSES.prejump;
    case 'air': return POSES.jump;
    case 'land': return lerpPose(crouch, guard, Math.min(1, p.sf / Math.max(1, p.landing || 4)));
    // picking a thing up: down to it and back up
    case 'pick': return lerpPose(guard, crouch, Math.sin(Math.PI * Math.min(1, p.sf / Math.max(1, rules.pick ?? 12))));
    case 'hold': {
      // the clinch: both arms reaching to hold the body in front; a knee driven up as it lands, eased back down
      const hold = { ...guard, torso: (guard.torso ?? 0) + 8, armF: [70, 70], armB: [62, 80] };
      if (p.kf > 0) {
        const k = Math.min(1, p.kf / Math.max(1, rules.kneeFrames ?? 10));
        return { ...hold, legF: [25 + 75 * k, -7 - 95 * k, 90] };
      }
      return hold;
    }
    case 'throwing': return { ...guard, torso: (guard.torso ?? 0) + 18, armF: [80, 40], armB: [80, 50] };
    default: {
      // standing: breathing about the guard
      return { ...guard, torso: (guard.torso ?? 0) + Math.sin(t * 0.08) * 2, twist: Math.sin(t * 0.05) * 2, tilt: Math.sin(t * 0.08) * 1.5 };
    }
  }
}
