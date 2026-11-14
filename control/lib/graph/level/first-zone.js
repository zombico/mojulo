/**
 * AN ACTION QUEST'S FIRST ZONE — a planned map's journey laid in TEACHING ORDER (map-sketch.js concept), as a
 * platformer's first level lays its trails (gameworld/first-level.js): each beat teaches what a later one tests, the land
 * itself the teacher, the controls shown where they are first needed (the guide), never a list up front. (A hand-laid
 * map's rail. The sentence door's world map starts another way, the controls explained first and then an enemy trail:
 * gameworld/world-map.js.)
 *
 *   the first look   the arrival sets out facing the walk's goal on the skyline (`faces`): the place the level is about
 *   the lone foe     the first fight is one foe, in the walk's first segment, where the blow is learnt (strike)
 *   the traverse     the walk's second segment crossed: long enough to run, where the sprint is learnt on the stamina
 *   the pack         the second segment's fight, several foes, where the lock-on and the dodge are learnt
 *   the climb        the walk's last segment climbed to the goal; the segments between crossed
 *   the climax       the goal: what the journey is for
 *   the side ways    each segment off the walk a secret, for those who look
 *   graduation       `hold`: a page's ways out wait on its fights (gameworld/levels.js): the first page is left by
 *                    winning it, as a first area is left by its last lesson
 *
 *   firstZone(plan, { pitch?, foe?, pack? }) → { concept, wants }
 *     concept  the sketch's concept (readSketch takes it): { pitch?, hold: true, journey }
 *     wants    { <segment>: [{ kind: 'encounter', foes: { count, kind? }, for: '<beat id>' }] } the marks its fights need,
 *              placed by the segment's planner (segmentBriefs) on a tile of its way; the laws say when one is missing
 *              or its count is not the one taught for (beats-marked, foes-ramp, teaches-before-tests)
 * Pure: words in, a concept out.
 */
import { readPlan } from './plan.js';

export const FIRST_ZONE = Object.freeze({ pack: 3 });

const plural = (w, n) => (n === 1 ? w : /(s|x|ch|sh)$/.test(w) ? `${w}es` : /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : `${w}s`);

/** The first zone's journey on a plan (its `rows`, `route`, `key`…, as level.grid.plan writes it). */
export function firstZone(plan, { pitch, foe, pack = FIRST_ZONE.pack } = {}) {
  if (!Array.isArray(plan?.route) || plan.route.length < 2) throw new Error('level: a first zone is a walk of two segments at least (one to learn in, one to be tested in)');
  const P = readPlan(plan), R = P.route, key = plan.key ?? {}, name = (S) => key[S]?.name ?? `segment ${S}`;
  if (!(Number.isInteger(pack) && pack >= 2 && pack <= 8)) throw new Error('level: a first zone\'s pack is 2 to 8 foes (the lone foe comes first)');
  const who = typeof foe === 'string' && foe ? foe : null, word = who ?? 'foe';
  const [A, B] = R, last = R[R.length - 1], between = R.slice(2, -1);
  const journey = [
    { id: 'set-out', say: `Set out from ${name(A)}: ${name(last)} stands on the skyline`, kind: 'arrival', at: A, teach: ['look'], faces: 'climax' },
    { id: 'lone-foe', say: `A lone ${word} on the way out of ${name(A)}`, kind: 'encounter', at: A, teach: ['strike'] },
    { id: 'cross', say: `Cross ${name(B)}`, kind: 'traverse', at: B, teach: ['sprint'] },
    { id: 'pack', say: `${pack} ${plural(word, pack)} hold ${name(B)}`, kind: 'encounter', at: B, teach: ['lock', 'dodge'] },
    ...between.map((S) => ({ id: `cross-${S.toLowerCase()}`, say: `Cross ${name(S)}`, kind: 'traverse', at: S })),
    ...(last !== B ? [{ id: 'climb', say: `Climb to ${name(last)}`, kind: 'climb', at: last }] : []),
    { id: 'climax', say: `${name(last)}: what the journey is for`, kind: 'climax', at: last },
    ...Object.keys(P.segments ?? P.at).filter((S) => !R.includes(S)).map((S) => ({ id: `secret-${S.toLowerCase()}`, say: `Something hidden in ${name(S)}`, kind: 'secret', at: S })),
  ];
  const foes = (count) => ({ count, ...(who ? { kind: who } : {}) });
  const wants = { [A]: [{ kind: 'encounter', foes: foes(1), for: 'lone-foe' }] };
  (wants[B] ??= []).push({ kind: 'encounter', foes: foes(pack), for: 'pack' });
  return { concept: { ...(pitch ? { pitch } : {}), hold: true, journey }, wants };
}
