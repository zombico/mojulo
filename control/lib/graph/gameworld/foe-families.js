/**
 * THE FOE FAMILIES — the rails whose foes are routed onto the bestiary update, one row a rail. A routed rail's foes walk
 * as their bodies do (`gait`): each made with gaits of its own and measured on the page, so it stands in an idle, walks
 * at a walk and runs at a run, its feet planted (figures/clip-travel.js), and a flier flies. A rail not here, every
 * byte as it was; a rail is routed by its row, one at a time.
 *
 *   FOE_FAMILIES             { <rail id>: { name, gait: true, cards?: { file, lead }, roles? } }: `cards` the attack cards
 *                              a role's body throws by its topology (the rank and file's, the leaders': the elite and the
 *                              boss), each a list, the first its class's blow takes; `roles` the class a role is cast as
 *                              where the casting call would pick another; `extras` its own foes beside the roles
 *                              (an id, a class, a skin, a people's `arm` from the armory, how many to a fight), met
 *                              from the second level on (on a world map, one kind to each fight past the opening, in
 *                              order); all written into the cast (foe-casting.js)
 *   familyOf(G)              → the row (with its rail's id) a gameworld's foes are cast from, or null: the rail its feel's
 *                              template is (rails.js railOfPole)
 *   FOE_GAITS                the hero door's gaits a person or a kin foe is made with: a walk and a jog, solved on its
 *                              own rig (polygonizer/hero-motion.js), as the hero's are
 *   WALK_OVER                a body walks under this share over its walk's own pace, and runs above it
 *   foeGaitOf(entry)         → { fly, brace? }: the gait words its figure is made with (a flier's flight, where its class
 *                              flies; its gathering, where its own move braces)
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
  'fable-of-artesia': Object.freeze({ name: 'the goblin band and the monsters of the wilds', gait: true,
    // the cards its cast throws (foes/attacks.js), by role and by the body's topology: the rank and file chop, the
    // leaders maul; a beast snaps, its leader mauls. A role or a body with none keeps its class's own blow
    // (each body's cards in order of choice: the first its class's blow takes; a slinger throws, a cutter chops; a
    // beast's `zone`, the card its height against the hero's calls for, foes/zones.js: a wolf snaps at the legs)
    cards: Object.freeze({
      file: Object.freeze({ person: ['chop', 'throw'], kin: ['chop', 'throw'], quadruped: 'zone', biped: 'zone', limbless: ['snap'] }),
      lead: Object.freeze({ person: ['maul'], kin: ['maul'], quadruped: 'zone', biped: 'zone' }),
    }),
    // the roles its cast fields by class where its own casting would pick another (the goblin slinger, who keeps its
    // distance and throws: the band's ranged hand)
    roles: Object.freeze({ harrier: Object.freeze({ class: 'lobber' }) }),
    // its own foes beside the band: the MONSTERS of its wilds, never its small animals. The dead risen from its ruins
    // (skeletons that cut with a blade), gloomwings over its roads (a bat grown dire and dark), a crystal behemoth that
    // charges (a rhino grown through with stone), a venom serpent lying in wait in the grass and a fire salamander that
    // hunts: each a real body grown into a monster (mutagen/oozes) or a people of the dead, its card at its zone
    extras: Object.freeze([
      Object.freeze({ id: 'skeleton', class: 'pursuer', skin: Object.freeze({ people: 'skeleton' }), arm: 'rusted-sword', count: 2 }),
      Object.freeze({ id: 'gloomwing', class: 'swooper', skin: Object.freeze({ species: 'fruitBat', ooze: Object.freeze(['dire', 'shadow']) }), count: 2 }),
      Object.freeze({ id: 'behemoth', class: 'charger', skin: Object.freeze({ species: 'rhino', ooze: Object.freeze(['dire', 'crystal']) }), count: 1 }),
      Object.freeze({ id: 'serpent', class: 'lurker', skin: Object.freeze({ species: 'snake', ooze: Object.freeze(['dire', 'venom']) }), count: 1 }),
      Object.freeze({ id: 'salamander', class: 'brute', skin: Object.freeze({ species: 'monitorLizard', ooze: Object.freeze(['fire']) }), count: 1 }),
    ]) }),
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
  // (and a BRACE where its own move gathers before it goes: a charge, a hop, worlds/controllable/foe.js)
  return { fly: !!(M?.rule?.flier || M?.needs?.includes('wings') || c?.fits?.wings === true), ...(['rush', 'hop'].includes(c?.move) ? { brace: true } : {}) };
}

export function gaitFit(figure, scale = 1) {
  const C = figure?.clips ?? {}, run = C.forward ? clipTravel(figure, C.forward) : null;
  const walk = C.walk && C.walk !== C.forward ? clipTravel(figure, C.walk) : null, s = scale > 0 ? scale : 1;
  // (its walk's own pace: the walk's stride over its cycle's seconds; under WALK_OVER of it the body walks)
  const pace = walk ? (walk * s) / Math.max(0.2, C.walk.s ?? 1) : 0;
  return { ...(run ? { stride: r4(run * s) } : {}), ...(walk ? { walkStride: r4(walk * s), walkPace: r4(WALK_OVER * pace) } : {}) };
}
