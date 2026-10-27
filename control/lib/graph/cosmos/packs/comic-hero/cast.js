/**
 * THE COMIC HERO PACK'S CAST: the people a comic-book world needs, each an egocube ask (egocube/egocube.js rollEgocube:
 * facets in SPEC_KEYS words, a brief, a path) so a sheet rolls from it deterministically and the sheet's channel notes
 * drive the hero door's dials (egocube/plan.js planFromSheet). The pack adds what the sheet does not decide: the SUIT the
 * member wears (suits.js), its motion `vibe` and its rest `gesture` (the door's own words). No franchise names: an
 * archetype and a role, never a character. Each member names its `pole`, so the cast is mixed at every seed (the egocube
 * rolls an unnamed pole from the seed alone, and one seed made the whole cast one sex); an order may name another.
 *
 *   CAST              [{ id, name, reads, facets, brief, suit, vibe, gesture }] (a gesture a stand word, or a list ending in
 *                     the arm's edit where the stand's values sink on this member's build: the rival's rear fist opened)
 *   castMember(id)    one, or throws naming the known ids
 */
export const CAST = Object.freeze([
  { id: 'hero', name: 'The hero', reads: 'the city\'s champion: square, sure, the symbol worn where it is seen',
    facets: { pole: 'male', archetype: 'hero', role: 'frontline', build: 'heroic', age: 'adult', motivation: 0.3, order: 0.7 },
    brief: 'the city\'s champion, square and sure, lives by a code', suit: 'classic', vibe: 'bold', gesture: 'hand-on-hip' },
  { id: 'sidekick', name: 'The sidekick', reads: 'quick and light, the joke before the punch, learning the code',
    facets: { pole: 'female', archetype: 'jester', role: 'flanker', build: 'lithe', age: 'youth', motivation: 0.25, order: 0.4 },
    brief: 'quick and light, the joke before the punch', suit: 'street', vibe: 'peppy', gesture: 'relaxed' },
  { id: 'rival', name: 'The rival', reads: 'the hero\'s shadow: the same cloth cut sharper, the symbol made a brand',
    facets: { pole: 'female', archetype: 'hero', role: 'ranged', build: 'heroic', age: 'adult', motivation: 0.85, order: 0.5 },
    brief: 'the same cloth cut sharper, proving it at range', suit: 'sleek', vibe: 'cocky', gesture: ['guard', { elbowR: 130 }] },
  { id: 'mastermind', name: 'The mastermind', reads: 'the ruler in shadow: seasoned, controlled, armoured against the world',
    facets: { pole: 'male', archetype: 'ruler', role: 'controller', build: 'canonical', age: 'seasoned', motivation: 0.9, order: 0.9 },
    brief: 'seasoned and controlled, rules from the top floor', suit: 'armored', vibe: 'menacing', gesture: 'rest' },
  { id: 'brute', name: 'The brute', reads: 'the outlaw\'s muscle: mass before method, nothing kept',
    facets: { pole: 'male', archetype: 'outlaw', role: 'frontline', build: 'brute', age: 'adult', motivation: 0.8, order: 0.2 },
    brief: 'mass before method, nothing kept', suit: 'thug', vibe: 'heavy', gesture: 'guard' },
  { id: 'thug', name: 'The thug', reads: 'an everyman gone wrong: a street coat, a job, no symbol',
    facets: { pole: 'female', archetype: 'everyman', role: 'flanker', build: 'canonical', age: 'adult', motivation: 0.7, order: 0.3 },
    brief: 'a street coat and a job, no symbol', suit: 'thug', vibe: 'loose', gesture: 'relaxed' },
]);

export function castMember(id) {
  const m = CAST.find((x) => x.id === id);
  if (!m) throw new Error(`comic-hero: no cast member '${id}' (known: ${CAST.map((x) => x.id).join(', ')})`);
  return m;
}
