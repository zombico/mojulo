/**
 * THE LAW — what answers mayhem in an open city. It is no faction (factions.js): it gives no work, has no turf and is
 * never joined. A world that has it (`law`) is watched: mayhem done in its streets raises the player's WANTED level, a
 * count of stars, and each star brings police, who chase and strike; kept clear of them and of trouble a while, a star
 * fades; taken down by them, the player is BUSTED (game/law-mechanics.js lowerWanted, laid by levels.js on a driven
 * city stage).
 *
 *   law: true | { police?, stars?, per?, calm?, busted?, fine? }
 *       police  who comes: an entry of the world's bestiary (`foes`), by its id. Unsaid, a patrol in uniform
 *               (LAW.police: the `police` grunt style's patrol, docs/foes.md), added to the bestiary as `police`
 *       stars   the most stars (1 to 5, LAW.stars)
 *       per     police a star brings (1 to 3); never more than LAW.most bodies in all
 *       calm    seconds clear of police hands and of mayhem that take a star off
 *       busted  police blows that take the player down
 *       fine    coin a bust costs, when the player holds it
 *
 *   LAW                    the words unsaid
 *   readLaw(spec, foes)    → { police, stars, per, calm, busted, fine, own } | null (`own`: the police entry is the
 *                            maker's); refuses a malformed one, teaching
 *   lawBestiary(law, foes) → the bestiary with the police in it (the maker's own untouched)
 *   lawFoeIds(law)         → the bestiary ids the law fields
 *   policeCount(law)       → how many police bodies a level stands
 * Pure, no dice.
 */
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const WORD = /^[a-z][a-z0-9-]{0,31}$/;
const KEYS = ['police', 'stars', 'per', 'calm', 'busted', 'fine'];

export const LAW = Object.freeze({
  stars: 5, per: 2, calm: 12, busted: 6, fine: 20, most: 8,
  // the patrol in uniform, a pursuer: who comes when the maker names no one
  police: Object.freeze({ class: 'pursuer', skin: Object.freeze({ people: 'human', dress: Object.freeze({ faction: 'police', kind: 'patrol', colourway: 'navy' }) }) }),
  id: 'police',
  // how its police chase: at this much of a city's run (levels.js CITY_RUN), seeing this far (m)
  chase: Object.freeze({ run: 0.92, sight: 45 }),
});

const whole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

export function readLaw(spec, foes = null) {
  if (spec === undefined || spec === null || spec === false) return null;
  const no = (m) => { throw new Error(`gameworld.law${m}`); };
  if (spec !== true && !isObj(spec)) no(' is true (the law watches the city) or { police?, stars?, per?, calm?, busted?, fine? }');
  const S = spec === true ? {} : spec;
  for (const k of Object.keys(S)) if (!KEYS.includes(k)) no(`.${k} is not a law setting (${KEYS.join(', ')})`);
  if (S.police !== undefined && (typeof S.police !== 'string' || !WORD.test(S.police))) no('.police is who comes: a bestiary id');
  if (S.police !== undefined && !(foes && Object.hasOwn(foes, S.police))) no(`.police: '${S.police}' is not in the world's bestiary (foes: ${foes ? Object.keys(foes).join(', ') : 'none written'})`);
  if (S.stars !== undefined && !whole(S.stars, 1, LAW.stars)) no(`.stars is the most stars, 1 to ${LAW.stars}`);
  if (S.per !== undefined && !whole(S.per, 1, 3)) no('.per is the police a star brings, 1 to 3');
  if (S.calm !== undefined && !(Number.isFinite(S.calm) && S.calm >= 3 && S.calm <= 120)) no('.calm is the seconds clear of trouble that take a star off, 3 to 120');
  if (S.busted !== undefined && !whole(S.busted, 1, 40)) no('.busted is the police blows that take the player down, 1 to 40');
  if (S.fine !== undefined && !whole(S.fine, 0, 100000)) no('.fine is the coin a bust costs, a whole number');
  // (the maker's own police entry, or the patrol, named apart from any foe the maker wrote)
  const own = S.police !== undefined;
  const police = own ? S.police : foes && Object.hasOwn(foes, LAW.id) ? 'police-patrol' : LAW.id;
  return { police, stars: S.stars ?? LAW.stars, per: S.per ?? LAW.per, calm: S.calm ?? LAW.calm, busted: S.busted ?? LAW.busted, fine: S.fine ?? LAW.fine, own };
}

export function lawBestiary(law, foes) {
  if (!law || law.own) return foes;
  return { ...(foes ?? {}), [law.police]: { ...LAW.police, skin: { ...LAW.police.skin, dress: { ...LAW.police.skin.dress } } } };
}

export const lawFoeIds = (law) => (law ? [law.police] : []);

export const policeCount = (law) => (law ? Math.min(LAW.most, law.stars * law.per) : 0);
