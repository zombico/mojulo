/**
 * A PEOPLE'S BODY: a foe skinned as a person or a non-human people (the egocube's: egocube/ancestry.js), not a species.
 * The class asks as it asks a beast (./fit.js); a people answers on two legs, without wings, at its own stature:
 *
 *   PEOPLE              'human' (a blind roll: its ancestry the seed's) and the lineages (orcish, undead, infernal,
 *                       draconic, dwarven, sylvan, feline, lupine, ursine, avian, insectoid): each a band of humanity,
 *                       on the hero door above DOOR_H (kin with ears and a tail) and below it the beast-kin's
 *                       tiered body (lib/graph/beast; egocube/plan.js beastOnTiered)
 *   readPeopleSkin(skin, at)   → { people, facets?, dress? } checked (throws teaching the words); a person's `dress`
 *                       (./dress.js) dresses it as a crew's, made through the hero door rather than the egocube's loop
 *   peopleBody(skin)    → the body ./fit.js measures: { support: 'two', wings: false, swimmer: false, size, extent,
 *                         height, scale: 1, gaits, people }; its height the build's and the age's (egocube/plan.js HEIGHT,
 *                         AGE_SCALE), the facets' when named, else the canonical adult's
 *   peopleRole(classRow)  → the egocube role its class fights in: a shot is ranged, a lob or a spray a caster's; one
 *                         that strikes when the hero cannot answer (an opportunist's mind: a stalker), lies in wait or
 *                         comes as a pack arrives from the side (flanker); a blade, a touch and a charge take the hit
 *                         (frontline)
 *   peopleRoll(skin, classRow, { seed, setting })   → the egocube roll it is made from (create_sketch { kind:
 *                         'egocube', roll }): its people as the ancestry (none for 'human'), its role, the skin's facets
 *                         over them
 *   peopleSeed(seed, id)  → a bestiary entry's own seed: the world's, moved by its id (two entries of one people are two
 *                         people)
 *
 * A class's `presence` is a beast's size: a person stands at its own height, grown only by its rank. Pure.
 */
import { LINEAGES } from '../egocube/ancestry.js';
import { HEIGHT, AGE_SCALE } from '../egocube/plan.js';
import { FACETS } from '../egocube/facets.js';
import { classOfExtent } from '../fauna/size-class.js';
import { MOVES } from './vocab.js';
import { readDress } from './dress.js';

export const PEOPLE = Object.freeze(['human', ...Object.keys(LINEAGES)]);
const SKIN_KEYS = ['people', 'facets', 'dress'];
// (the facets a skin may name: the egocube's own, its frame's build beside them)
const FACET_KEYS = [...Object.keys(FACETS).filter((k) => k !== 'frame'), 'build', 'pole'];
const r3 = (v) => Math.round(v * 1000) / 1000;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function readPeopleSkin(skin, at = 'foe: .skin') {
  if (!isObj(skin)) throw new Error(`${at} is { people, facets? }`);
  for (const k of Object.keys(skin)) if (!SKIN_KEYS.includes(k)) throw new Error(`${at} has no key '${k}' beside people (${SKIN_KEYS.join(', ')})`);
  if (!PEOPLE.includes(skin.people)) throw new Error(`${at}.people: no people '${skin.people}' (${PEOPLE.join(', ')})`);
  if (skin.facets !== undefined) {
    if (!isObj(skin.facets)) throw new Error(`${at}.facets is the egocube's words { ${FACET_KEYS.join(', ')} }`);
    if (skin.facets.ancestry !== undefined) throw new Error(`${at}.facets: the people is its ancestry (say it as people)`);
    for (const k of Object.keys(skin.facets)) if (!FACET_KEYS.includes(k)) throw new Error(`${at}.facets.${k} is not an egocube facet (${FACET_KEYS.join(', ')})`);
  }
  // (a person dressed as a crew's (./dress.js): the dress says its build, its age and its clothes; only its pole is its own)
  if (skin.dress !== undefined) {
    if (skin.people !== 'human') throw new Error(`${at}.dress: only a person is dressed (people: 'human'); a ${skin.people} wears its own roll`);
    const stray = Object.keys(skin.facets ?? {}).filter((k) => k !== 'pole');
    if (stray.length) throw new Error(`${at}.facets: a dressed person's build and age are its dress's; it names only its pole (not ${stray.join(', ')})`);
  }
  return { people: skin.people, ...(skin.facets !== undefined ? { facets: { ...skin.facets } } : {}), ...(skin.dress !== undefined ? { dress: readDress(skin.dress, `${at}.dress`) } : {}) };
}

export function peopleBody(skin) {
  const S = readPeopleSkin(skin), f = S.facets ?? {};
  const h = r3((HEIGHT[f.build] ?? HEIGHT.canonical) * (AGE_SCALE[f.age] ?? AGE_SCALE.adult));
  return { support: 'two', wings: false, swimmer: false, size: classOfExtent(h, h), extent: h, height: h, scale: 1, gaits: ['walk', 'jog', 'run'], people: S.people };
}

export function peopleRole(c) {
  const kind = c.attack.kind;
  if (kind === 'shot') return 'ranged';
  if (kind === 'lob' || kind === 'spray') return 'caster';
  if (c.mind?.aggressiveness === 'opportunist' || c.move === 'lurk' || MOVES[c.move]?.group) return 'flanker';
  return 'frontline';
}

export function peopleRoll(skin, c, { seed = 1, setting } = {}) {
  const S = readPeopleSkin(skin);
  const facets = { role: peopleRole(c), ...(S.people !== 'human' ? { ancestry: S.people } : {}), ...(S.facets ?? {}) };
  return { facets, seed, ...(setting ? { setting } : {}) };
}

export function peopleSeed(seed, id) {
  let h = 5381;
  for (const ch of String(id)) h = ((h * 33) ^ ch.charCodeAt(0)) >>> 0;
  return ((Number.isInteger(seed) ? seed : 1) * 7919 + (h % 100000)) % 2147483647;
}
