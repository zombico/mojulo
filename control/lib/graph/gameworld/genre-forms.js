/**
 * THE GENRE'S FORM — what the sentence door (compose.js) lays for a genre it reads, in the book. A genre whose kernel
 * the book carries as a level form has its levels laid in that form (a flight sim's courses are airspaces); a genre
 * that is another door's medium is handed to that door, nothing laid; a genre the registry cannot make yet (the cosmos
 * dry run's verdict) is refused with what it waits on, nothing laid in its place. Every other genre is laid as it was:
 * walks, buildings, its goals.
 *
 *   GENRE_FORMS[id]         → { form, name, level(i, n) → the level's form keys } the book level form a genre's levels take
 *   HAND_OFFS[id]           → { door, why } the door that makes a genre that is not a book of levels
 *   refusalOf(id, others)   → null | { verdict, waits, others } why a read genre is not laid (hand-offs are said apart)
 *
 * Forms wait on what they need beside them: a race's ride (the vehicle registry's front door) before racing's roadway
 * is laid; a hero (game type layers phase 2) before a runner's lanes, a stealth level's sneaking body, the seats.
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
