/**
 * A MASCOT AS A PILOT: what a game needs of a mascot on foot, read off its stored plan (mascot-form.js `plan.mascot`,
 * its clips and its rig). The mascot keeps its own size; the game's movement (its speed, its jump, the step it climbs)
 * is the game's, as a cartoon hops many times its own height. What follows the body:
 *
 *   clips    the runtime's states from its own clips (playscape/player.js playerStates): forward the run, turn the walk,
 *            idle the idle, the jump's squat and leap
 *   stride   the ground one cycle of the run covers at the game's speed: the gait's travel (mascot-gait.js), lengthened
 *            so the cycle never plays faster than MAX_CYCLES a second (past that its feet skate, as a cartoon's do)
 *   capsule  its height, its head's half-width (the widest part of a mascot is its head), no wider than half its height
 *   camera   the follow camera framed on it: a person's distances times its height over a person's (never under
 *            CAMERA_MIN of them), looking at its head; a first-person eye at its eyes
 *   egg      the hit egg round it (a body a shot or a blow finds)
 *
 *   isMascotPlan(plan)                  → a stored plan a mascot was minted from
 *   mascotPilot(plan, { speed })        → { height, clips, rule, camera, eye, egg, gaits }
 *
 * Pure.
 */
import { mascotGaits } from './mascot-gait.js';

const r3 = (x) => Math.round(x * 1000) / 1000 + 0;
export const PERSON_HEIGHT = 1.7;
export const MAX_CYCLES = 4;
export const CAMERA_MIN = 0.45;
/** a person's follow camera (playscape/player.js): what a mascot's is scaled from */
const FOLLOW = Object.freeze({ dist: 5.5, height: 2.4, lookH: 1.1, lead: 1.5 });

export const isMascotPlan = (plan) => !!(plan && typeof plan === 'object' && plan.mascot && typeof plan.mascot === 'object' && plan.clips?.run);

export function mascotPilot(plan, { speed = 4 } = {}) {
  if (!isMascotPlan(plan)) throw new Error('mascot pilot: the plan is not a mascot\'s (make one with create_character { as: \'mascot\' })');
  const M = plan.mascot, h = M.height, gaits = mascotGaits(plan, M.energy);
  const has = (c) => !!plan.clips[c];
  const clips = { forward: 'run', idle: 'idle', turn: 'walk', strafe: 'run', ...(has('leap') ? { leap: 'leap', boost: 'leap' } : {}), ...(has('squat') ? { squat: 'squat' } : {}) };
  const stride = r3(Math.max(gaits.run.travel, speed / MAX_CYCLES));
  const s = Math.max(CAMERA_MIN, h / PERSON_HEIGHT);
  return {
    height: h, clips, gaits,
    rule: { stride, collideRadius: r3(Math.min(h / 2, Math.max(0.12, M.headR))), collideHeight: r3(h) },
    camera: { dist: r3(FOLLOW.dist * s), height: r3(FOLLOW.height * s), lookH: r3(Math.max(0.25, h - M.headR)), lead: r3(FOLLOW.lead * s) },
    eye: r3(h - M.headR),
    egg: { a: r3(M.headR * 1.05), c: r3(h / 2), cz: r3(h / 2) },
  };
}
