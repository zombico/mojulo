/**
 * THE FOE FAMILIES — the rails whose foes are routed onto the bestiary update, one row a rail. A routed rail's foes walk
 * as their bodies do (`gait`): each made with gaits of its own and measured on the page, so it stands in an idle, walks
 * at a walk and runs at a run, its feet planted (figures/clip-travel.js), and a flier flies. A rail not here, every
 * byte as it was; a rail is routed by its row, one at a time.
 *
 *   FOE_FAMILIES             { <rail id>: { name, gait: true } }
 *   familyOf(G)              → the row (with its rail's id) a gameworld's foes are cast from, or null: the rail its feel's
 *                              template is (rails.js railOfPole)
 *   FOE_GAITS                the hero door's gaits a person or a kin foe is made with: a walk and a jog, solved on its
 *                              own rig (polygonizer/hero-motion.js), as the hero's are
 *   WALK_OVER                a body walks under this share over its walk's own pace, and runs above it
 *   foeGaitOf(entry)         → { fly }: the gait words its figure is made with (a flier's flight, where its class flies)
 *   gaitFit(figure, scale?)  → { stride?, walkStride?, walkPace? }: a packed figure's run and walk measured off their clips
 *                              (figures/clip-travel.js) at its body's scale, the rule's words the runtime steps by
 *
 * Pure.
 */
import { railOfPole } from './rails.js';
import { FOE_CLASSES } from '../foes/index.js';
import { MOVES } from '../foes/vocab.js';
import { clipTravel } from '../figures/clip-travel.js';

const r4 = (v) => Math.round(v * 1e4) / 1e4;

export const FOE_FAMILIES = Object.freeze({
  'fable-of-artesia': Object.freeze({ name: 'the goblin band and the wilds', gait: true }),
});

export const FOE_GAITS = Object.freeze({ walk: true, jog: true });
export const WALK_OVER = 1.3;

export function familyOf(G) {
  const pole = typeof G?.feel === 'string' ? G.feel : G?.feel?.pole ?? null;
  const rail = pole ? railOfPole(pole) : null;
  return rail && FOE_FAMILIES[rail.id] ? { rail: rail.id, ...FOE_FAMILIES[rail.id] } : null;
}

/** Does this gameworld's cast walk as its bodies do? */
export const gaitRouted = (G) => !!familyOf(G)?.gait;

export function foeGaitOf(entry) {
  const c = FOE_CLASSES[entry?.class], M = c ? MOVES[c.move] : null;
  return { fly: !!(M?.rule?.flier || M?.needs?.includes('wings') || c?.fits?.wings === true) };
}

export function gaitFit(figure, scale = 1) {
  const C = figure?.clips ?? {}, run = C.forward ? clipTravel(figure, C.forward) : null;
  const walk = C.walk && C.walk !== C.forward ? clipTravel(figure, C.walk) : null, s = scale > 0 ? scale : 1;
  // (its walk's own pace: the walk's stride over its cycle's seconds; under WALK_OVER of it the body walks)
  const pace = walk ? (walk * s) / Math.max(0.2, C.walk.s ?? 1) : 0;
  return { ...(run ? { stride: r4(run * s) } : {}), ...(walk ? { walkStride: r4(walk * s), walkPace: r4(WALK_OVER * pace) } : {}) };
}
