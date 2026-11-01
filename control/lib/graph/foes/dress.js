/**
 * A PERSON'S DRESS: a person foe dressed as one of a crew, in the hero door's own words. A dress names a FACTION of the
 * comic hero pack's grunts (cosmos/packs/comic-hero/grunts.js: private military, corporate security, a cult, a street
 * gang …), so a soldier is a contractor in a plate carrier and a helmet, never the egocube's roll in plain clothes:
 *
 *   skin: { people: 'human', facets?: { pole? }, dress: { faction, kind?, colourway?, body?, rail?, muscle? } }
 *     faction    a grunt style (GRUNT_STYLE_IDS)
 *     kind       one of its kinds (the rifleman, the sentry, the breacher …); absent, rolled from its weights
 *     colourway  the crew's colours (one of its colourways); absent, its first. A bestiary dressed alike shares them
 *     body       tiered (the default) | realistic: the body the hero door draws it on
 *     rail       the body its game puts in its henchmen (gameworld/game-bodies.js: comic, realistic, muscular, mascot):
 *                the henchman's words over the grunt's, in the game's tradition: on the anime frame its codename (the
 *                hulking for a comic or a fighting game's), the realistic body for a realistic or a fighting game drawn
 *                western (`body` follows it), a mascot's chibi or lowpoly frame; drawn in ink, the crew's own builds
 *     muscle     true (the rail's definition) | 0 … 1: the muscle shirt on an anime henchman; absent, none
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
import { gameBody, GAME_BODY_NAMES } from '../gameworld/game-bodies.js';

export const DRESS_BODIES = Object.freeze(['tiered', 'realistic']);
const DRESS_KEYS = ['faction', 'kind', 'colourway', 'body', 'rail', 'muscle'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function readDress(d, at = 'foe: .skin.dress') {
  if (!isObj(d)) throw new Error(`${at} is { faction, kind?, colourway?, body? } (factions: ${GRUNT_STYLE_IDS.join(', ')})`);
  for (const k of Object.keys(d)) if (!DRESS_KEYS.includes(k)) throw new Error(`${at}.${k} is not a dress setting (${DRESS_KEYS.join(', ')})`);
  const S = GRUNT_STYLES[d.faction];
  if (!S) throw new Error(`${at}.faction: no faction '${d.faction}' (${GRUNT_STYLE_IDS.join(', ')})`);
  if (d.kind !== undefined && !S.kinds[d.kind]) throw new Error(`${at}.kind: the ${S.name.toLowerCase()} has no '${d.kind}' (${Object.keys(S.kinds).join(', ')})`);
  if (d.colourway !== undefined && !S.colourways[d.colourway]) throw new Error(`${at}.colourway: the ${S.name.toLowerCase()} wears ${Object.keys(S.colourways).join(', ')}`);
  if (d.body !== undefined && !DRESS_BODIES.includes(d.body)) throw new Error(`${at}.body is ${DRESS_BODIES.join(' | ')}`);
  if (d.rail !== undefined && !GAME_BODY_NAMES.includes(d.rail)) throw new Error(`${at}.rail is the body its game puts in its henchmen: ${GAME_BODY_NAMES.join(' | ')}`);
  if (d.muscle !== undefined && typeof d.muscle !== 'boolean' && !(typeof d.muscle === 'number' && d.muscle >= 0 && d.muscle <= 1)) throw new Error(`${at}.muscle is true (the rail's definition), false, or a definition 0 to 1`);
  if (d.muscle !== undefined && d.rail === undefined) throw new Error(`${at}.muscle rides a rail (dress.rail)`);
  return { faction: d.faction, ...(d.kind !== undefined ? { kind: d.kind } : {}), ...(d.colourway !== undefined ? { colourway: d.colourway } : {}), ...(d.body !== undefined ? { body: d.body } : {}), ...(d.rail !== undefined ? { rail: d.rail } : {}), ...(d.muscle !== undefined ? { muscle: d.muscle } : {}) };
}

export const lookOfDress = (body, tradition) => (body === 'realistic' ? 'realistic-night' : tradition === 'anime' ? 'anime-day' : 'dcau-golden');

export function dressOrders(skin, { seed = 1, tradition = null, title = null } = {}) {
  const D = readDress(skin.dress);
  // (a rail's henchman drawn on the realistic body draws the grunt on it: the pack's realistic look)
  const realistic = D.body ?? (D.rail && gameBody(D.rail, 'henchman', { tradition }).spec.form === 'realistic' ? 'realistic' : undefined);
  const O = gruntOrders(D.faction, lookOfDress(realistic, tradition), { seed, index: 0, ...(D.kind ? { kind: D.kind } : {}), ...(D.colourway ? { colourway: D.colourway } : {}), ...(skin.facets?.pole ? { pole: skin.facets.pole } : {}) });
  const { geocube: _cube, ...rolled } = O.mint.args.spec;
  const spec = D.rail ? henchmanOn(rolled, D, tradition) : rolled;
  return { grunt: O.grunt, mint: { ...O.mint.args, ...(title ? { title } : {}), spec } };
}

/** The rail's henchman over a rolled grunt (game-bodies.js gameBody, its pole the grunt's): its anime codename on the
 * anime frame, the realistic body's physique, a mascot's frame; drawn in ink, the crew's own builds stand (the kinds are
 * already its heavies and its lean ones). The muscle shirt only where the dress asks. */
export function henchmanOn(spec, D, tradition) {
  const pole = typeof spec.cast === 'string' ? spec.cast : spec.cast?.pole ?? 'male';
  const B = gameBody(D.rail, 'henchman', { tradition, pole, ...(D.muscle !== undefined ? { muscle: D.muscle } : {}) }), W = B.spec, out = { ...spec };
  if (W.animeBody && spec.head === 'anime') { out.animeBody = W.animeBody; if (W.muscleShirt) out.muscleShirt = W.muscleShirt; }
  if (W.form === 'realistic' && spec.form === 'realistic' && W.physique) out.physique = W.physique;
  if (B.style === 'mascot' || B.style === 'lowpoly') { if (W.cast) out.cast = W.cast; if (W.register) out.register = W.register; }
  return out;
}
