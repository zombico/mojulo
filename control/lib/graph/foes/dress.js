/**
 * A PERSON'S DRESS: a person foe dressed as one of a crew, in the hero door's own words. A dress names a FACTION of the
 * comic hero pack's grunts (cosmos/packs/comic-hero/grunts.js: private military, corporate security, a cult, a street
 * gang …), so a soldier is a contractor in a plate carrier and a helmet, never the egocube's roll in plain clothes:
 *
 *   skin: { people: 'human', facets?: { pole? }, dress: { faction, kind?, colourway?, body? } }
 *     faction    a grunt style (GRUNT_STYLE_IDS)
 *     kind       one of its kinds (the rifleman, the sentry, the breacher …); absent, rolled from its weights
 *     colourway  the crew's colours (one of its colourways); absent, its first. A bestiary dressed alike shares them
 *     body       tiered (the default) | realistic: the body the hero door draws it on
 *
 *   readDress(d, at)                        → the dress read (throws teaching the words)
 *   DRESS_BODIES                            the bodies a dress is drawn on
 *   lookOfDress(body, tradition)            → the pack's look the grunt is ordered in: the realistic body's, else the
 *                                             anime stop for an anime game and the western stop for any other
 *   dressOrders(skin, { seed, tradition, title })  → { grunt, mint } the hero door's order for it: `mint` the layered hero's
 *                                             args (mint_solid { kind: 'layered', via: 'hero', title, spec })
 *
 * Only a person is dressed: a people of another lineage wears its own roll. The pack's western stop bakes its hero in the
 * pack's own golden light; a foe stands in its world's light, so that cube is left off. Pure and deterministic.
 */
import { GRUNT_STYLES, GRUNT_STYLE_IDS, gruntOrders } from '../cosmos/packs/comic-hero/grunts.js';

export const DRESS_BODIES = Object.freeze(['tiered', 'realistic']);
const DRESS_KEYS = ['faction', 'kind', 'colourway', 'body'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function readDress(d, at = 'foe: .skin.dress') {
  if (!isObj(d)) throw new Error(`${at} is { faction, kind?, colourway?, body? } (factions: ${GRUNT_STYLE_IDS.join(', ')})`);
  for (const k of Object.keys(d)) if (!DRESS_KEYS.includes(k)) throw new Error(`${at}.${k} is not a dress setting (${DRESS_KEYS.join(', ')})`);
  const S = GRUNT_STYLES[d.faction];
  if (!S) throw new Error(`${at}.faction: no faction '${d.faction}' (${GRUNT_STYLE_IDS.join(', ')})`);
  if (d.kind !== undefined && !S.kinds[d.kind]) throw new Error(`${at}.kind: the ${S.name.toLowerCase()} has no '${d.kind}' (${Object.keys(S.kinds).join(', ')})`);
  if (d.colourway !== undefined && !S.colourways[d.colourway]) throw new Error(`${at}.colourway: the ${S.name.toLowerCase()} wears ${Object.keys(S.colourways).join(', ')}`);
  if (d.body !== undefined && !DRESS_BODIES.includes(d.body)) throw new Error(`${at}.body is ${DRESS_BODIES.join(' | ')}`);
  return { faction: d.faction, ...(d.kind !== undefined ? { kind: d.kind } : {}), ...(d.colourway !== undefined ? { colourway: d.colourway } : {}), ...(d.body !== undefined ? { body: d.body } : {}) };
}

export const lookOfDress = (body, tradition) => (body === 'realistic' ? 'realistic-night' : tradition === 'anime' ? 'anime-day' : 'dcau-golden');

export function dressOrders(skin, { seed = 1, tradition = null, title = null } = {}) {
  const D = readDress(skin.dress);
  const O = gruntOrders(D.faction, lookOfDress(D.body, tradition), { seed, index: 0, ...(D.kind ? { kind: D.kind } : {}), ...(D.colourway ? { colourway: D.colourway } : {}), ...(skin.facets?.pole ? { pole: skin.facets.pole } : {}) });
  const { geocube: _cube, ...spec } = O.mint.args.spec;
  return { grunt: O.grunt, mint: { ...O.mint.args, ...(title ? { title } : {}), spec } };
}
