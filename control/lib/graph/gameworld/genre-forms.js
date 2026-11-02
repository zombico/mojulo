/**
 * THE GENRE'S FORM — what the sentence door (compose.js) lays for a genre it reads, in the book. A genre whose kernel
 * the book carries as a level form has its levels laid in that form (a flight sim's courses are airspaces); a genre
 * that is another door's medium is handed to that door, nothing laid; a genre the registry cannot make yet (the cosmos
 * dry run's verdict), or one the book cannot lay from a sentence yet (PENDING), is refused with what it waits on, nothing
 * laid in its place. The genres the book lays in its own walks and buildings are laid as they were.
 *
 *   GENRE_FORMS[id]         → { form, name, level(i, n) → the level's form keys } the book level form a genre's levels take
 *   HAND_OFFS[id]           → { door, why } the door that makes a genre that is not a book of levels
 *   refusalOf(id, others)   → null | { verdict, waits, others } why a read genre is not laid (hand-offs are said apart)
 *   PENDING[id], pendingOf(id) → what a genre the book cannot lay from a sentence yet waits on (refused, nothing laid)
 *
 * Forms wait on what they need beside them: a race's ride (the vehicle registry's front door) before racing's roadway
 * is laid; a hero by default before a runner's lanes and a city's swing.
 * Pure: the door probes (door-probes.js) read what the run makes of it.
 */
import { dryRun } from '../cosmos/cosmos.js';
import { genreCube, GENRES } from './intent.js';

/** The book level forms the sentence door lays a genre's levels in. */
export const GENRE_FORMS = Object.freeze({
  // the flight genres: an airspace a level (skyscape/airspace.js): a runway, a gate course, the genre's craft
  'flight-sim': Object.freeze({ form: 'airspace', name: 'Course', level: () => ({ airspace: { map: { craft: 'trainer' }, course: true } }) }),
  'air-combat': Object.freeze({ form: 'airspace', name: 'Sortie', level: () => ({ airspace: { map: { craft: 'jet' }, course: true } }) }),
  'space-shooter': Object.freeze({ form: 'airspace', name: 'Sector', level: () => ({ airspace: { map: { craft: 'fighter' }, space: { asteroids: 'field' }, course: true } }) }),
});

/** The genres that are another door's medium: said, never laid as levels. */
export const HAND_OFFS = Object.freeze({
  'match-3-saga': Object.freeze({ door: "create_pixelizer_game({ reducer: 'stone-saga' })", why: 'a match-3 saga is a board of swaps on a map of levels, which the pixelizer plays; it is not a walked world' }),
});

/** What a read genre the book cannot lay from a sentence yet waits on: refused, nothing laid in its place, until its
 * form lands. (The genres laid in the book's own walks and buildings are laid as they were: a dungeon crawler, a
 * collectathon, a top-down adventure, a metroidvania, survival horror, a story; stealth's guards, a co-op platformer's
 * side camera and seats, a party's battles, each played once the world has a hero.) */
export const WAITS = Object.freeze({
  ride: 'a ride the book drives (the hero as a vehicle, on a roadway level with a race goal)',
  weapon: 'the hero\'s weapon (a strike or a gun from what it carries)',
  form: 'its kernel as a book level (today it plays as one level alone)',
  hero: 'a hero by default, and its level form laid for it (a runner\'s lanes, a city to swing through)',
});
export const PENDING = Object.freeze({
  racing: 'ride', 'kart-racer': 'ride',
  shooter: 'weapon', 'arena-shooter': 'weapon', 'arena-brawler': 'weapon', 'co-op-brawler': 'weapon',
  'tower-defense': 'form', rts: 'form', tactics: 'form', farming: 'form', rhythm: 'form', roguelike: 'form', 'block-puzzle': 'form',
  'pixel-puzzle': 'form', 'versus-fighter': 'form', 'athletics-meet': 'form', 'net-game': 'form', 'turn-sport': 'form', 'team-goal-game': 'form',
  'endless-runner': 'hero', 'city-stalker': 'hero',
});
// the one level a pending genre plays alone today (quick.js QUICK_GOALS, the one-level door), said beside its refusal
const ONE_LEVEL = Object.freeze({
  racing: 'race', 'kart-racer': 'race', shooter: 'shoot', 'arena-shooter': 'deathmatch', 'tower-defense': 'defend', rts: 'conquer',
  farming: 'farm', rhythm: 'rhythm', 'block-puzzle': 'puzzle', 'versus-fighter': 'fight', 'athletics-meet': 'meet', 'net-game': 'contest',
  'turn-sport': 'contest', 'team-goal-game': 'contest', 'endless-runner': 'runner',
});

/** Why a read genre is not laid from a sentence yet (PENDING): { waits, one? } (`one`: the quick goal that plays one
 * level of it alone), or null. */
export const pendingOf = (id) => (PENDING[id] ? { waits: WAITS[PENDING[id]], ...(ONE_LEVEL[id] ? { one: ONE_LEVEL[id] } : {}) } : null);

const code = (x) => `${x.facet}.${x.setting}=${x.value}`;

/** Why a read genre is not laid: the registry's verdict for its cube (cosmos dryRun) when it is blocked or has gaps,
 * with what it waits on and the makeable genres the same words point at; null when it is makeable. */
export function refusalOf(id, others = []) {
  const cube = genreCube(id);
  if (!cube) return null;
  const R = dryRun(cube);
  if (R.verdict === 'makeable') return null;
  const alt = others.filter((g) => g !== id && GENRES[g] && genreCube(g) && dryRun(genreCube(g)).verdict === 'makeable');
  return { verdict: R.verdict, waits: [...R.blocked, ...R.gaps].map(code), others: alt };
}
