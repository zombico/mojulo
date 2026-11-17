/**
 * A scene's coverage READ as a shoot plan is read (shoot/frame.js): the actors as the subjects its shots are about,
 * each standing where its blocking puts it and facing the way it turns, figures FIGURE tall, so the coverage's framings
 * are read in a cinematographer's words (each shot's size, headroom, place and facing) and advised as any plan is
 * (a head cut, a joint cut, a jump cut, a mover's screen direction). Beside the director's notes (notes.js), never
 * among them: the notes are about the scene, this is about the frame.
 *
 *   actorSubjects(S) → Map<'actor:<who>', subject>   (shoot/subjects.js's shape: { id, kind: 'figure', box, at(t) })
 *   sceneFrameRead(S, coverage, { aspect }) → frameRead's { aspect, shots, notes }, read in the film's frame (16:9)
 *
 * Pure and deterministic.
 */
import { FIGURE, FILM_ASPECT } from './coverage.js';
import { normalizeShoot } from '../shoot/plan.js';
import { frameRead } from '../shoot/frame.js';

const smooth = (u) => u * u * (3 - 2 * u), wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;

/** The scene's actors as subjects (see the header): an actor's yaw (0 faces +y, clockwise) as a heading from +x */
export function actorSubjects(S) {
  return new Map(Object.entries(S.actors).map(([w, A]) => [`actor:${w}`, { id: `actor:${w}`, kind: 'figure', box: { len: 0.4, wid: 0.4, hgt: FIGURE }, at: (t) => {
    const K = A.root;
    let k = 0;
    while (k + 1 < K.length && K[k + 1].t <= t) k++;
    const a = K[k], b = K[k + 1] ?? a, u = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
    const yaw = a.yaw + wrap(b.yaw - a.yaw) * smooth(u);
    return { pos: [a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, 0], heading: ((90 - yaw) * Math.PI) / 180 };
  } }]));
}

/** The coverage read (see the header) */
export function sceneFrameRead(S, coverage, { aspect = FILM_ASPECT } = {}) {
  const subjects = actorSubjects(S);
  const { plan } = normalizeShoot(coverage, { subjects });
  return plan ? frameRead(plan, { subjects, aspect }) : { aspect, shots: [], notes: [] };
}
