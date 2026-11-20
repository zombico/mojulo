/**
 * coat-poses.js — THE POSED COAT's clips (an open coat's `posed`: body-relational-jacket.js ventBack). DMC3's compromise for
 * a long open coat on a body that fights: no cloth is simulated, the coat's two skirt halves hang on hinges at the hip
 * (each side's front, side and back, carried by the pelvis), and every clip sets them by its FAMILY:
 *
 *   stand    open over the thighs, the fronts turning back from the hips (an idle, a gesture, a rest)
 *   gait     the coat behind the hips, its fronts swept round past the sides so the legs stride through (a walk, a stop)
 *   run      streaming back behind the legs, lifted off them (a jog, a sprint)
 *   action   open at the back from the hip, the halves hung behind and beside the legs (a strike, a swing, a guard, a hit)
 *   flare    flared, each back half swung out and up (a jump, a spin, a slam, a fall)
 *
 * A clip's family is read from its name and its own tags (a move's `move`, a gait's table); what it cannot place is
 * action, the coat that never catches a kick. The set rides the pose's `flow` (station-loft-rig.js: a riding joint moved
 * from its rest in the frame of the bone carrying it), so a turn of the hips carries it; the clip blends between families
 * as the page blends the clips. A recipe without `coatPoses` gets its clips back untouched.
 */
import { layeredClip } from './station-loft-rig.js';

/** the clips that are a stand (the coat at rest) and a gait (behind the hips), by name; anything else is action */
const STAND = /^(idle|gesture|wave|stand|breath|rest|sit|kneel|look|talk|pose)/i;
const RUN = /^(jog|sprint|run|dash)(?!Stop)/i;
const GAIT = /^(walk|jog|sprint|run|strafe|carry|sneak|creep|back(step|pedal)|turn)/i;
/** the family of a clip by its name and its function's own tags */
export function coatFamily(name, fn = null) {
  if (fn?.move || fn?.act) return /(slam|spin|jump)/i.test(String(name)) || /(^|_)air|Air/.test(String(name)) ? 'flare' : 'action';
  const n = String(name).replace(/^(hero|mv)_/, '');
  if (/^(jump|land|fall|spin|slam|knock|vault|climb|flip|launch|air|dive|whirl)/i.test(n) || /(slam|spin|jump)/i.test(String(name)) || /(^|_)air|Air/.test(n)) return 'flare';
  if (/^(ready|guard|aim|swing|strike|slash|thrust|kick|punch|dodge|roll|hit|hurt|block|parry)/i.test(n)) return 'action';
  if (RUN.test(n) && !/Stop$/.test(n)) return 'run';
  if (GAIT.test(n)) return 'gait';
  if (STAND.test(n)) return 'stand';
  return 'action';
}

/** each clip given its family's set of the coat's hinges (on `flow`, over any the clip carries); `R` the rig its keyposes
 * are on. → the clips, a function each where it was set */
export function posedCoatClips(clips, poses, R) {
  if (!poses || !clips) return clips;
  const out = {};
  for (const [name, clip] of Object.entries(clips)) {
    const fn = typeof clip === 'function' ? clip : Array.isArray(clip) ? layeredClip(clip, R) : null;
    const set = fn ? poses[coatFamily(name, fn)] : null;
    if (!set) { out[name] = clip; continue; }
    const posed = (phase) => { const p = fn(phase); return { ...p, flow: { ...(p.flow || {}), ...set } }; };
    out[name] = Object.assign(posed, fn);
  }
  return out;
}
