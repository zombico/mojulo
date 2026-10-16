/**
 * THE SETTING: what a game says about the people in it, read once and handed to every roll made for it, so each game
 * gets its best shot at characters drawn in its own look (docs/egocube.md, The setting). It loads the dice; it never
 * decides a facet the operator asked for, and a roll with no setting is the roll it always was, byte for byte.
 *
 *   {
 *     tradition?: 'anime' | 'western',   a RULE: the body's head, proportions and light (gameworld/characters.js
 *                                        TRADITIONS); a mascot's style. How a body is DRAWN: a fighter's own
 *                                        tradition (versus-traditions.js: boxing, karate …) is how it strikes
 *     era?:       'myth' | 'rustic' | 'modern' | 'future',   leans the roles an era has people for
 *     genre?:     a quick game's goal (gameworld/quick.js QUICK_GOALS): leans who stands in it, and how far toward a mascot
 *     ramps?:     [{ name, stops: [hex] }]   the world's colour ramps: the clothes are dressed from them
 *     lean?:      { person?: { <facet>: { <value>: × } }, mascot?: { … } }   the creator's own leans, over the tables'
 *   }
 *
 *   readSetting(s)                 throws on an unknown word, naming the known ones → s
 *   leanOf(setting, tuning)        the multipliers per facet and value, the era's, the genre's and the creator's in turn
 *   leanPriors(priors, lean)       the priors with each named value's weight multiplied (an unnamed value keeps its own)
 *   mascotWeight(setting)          how far the game leans toward a mascot, 0 … 1 (absent: 0, a person)
 *   tuningOf(setting, seed, path)  'person' | 'mascot', thrown on its own die at that weight
 *
 * A lean is a multiplier, never a verdict: a value leaned to 0 is one the setting has no people for (a child in a
 * firefight), and is still the operator's to ask for. Every table is a first reading, to be calibrated at the eyes gate.
 */
import { mulberry32 } from '../vegetation/grow.js';

export const TRADITION_IDS = Object.freeze(['anime', 'western']);
export const SETTING_KEYS = Object.freeze(['tradition', 'era', 'genre', 'ramps', 'lean']);

/** Eras: what kind of world the people live in: who it has people for, and (a modern or future one) what they wear and carry
 * (outfit.js ERA_GEAR and ERA_LOOKS, the quick figures' firearms in cast-setting.js QUICK_FIGURES). */
export const ERAS = Object.freeze({
  myth:   { reads: 'a world of myth: swords, spells and familiars', person: {} },
  rustic: { reads: 'a rustic world: work, weather and village life; a little magic at most',
    person: { role: { 'non-combatant': 2, caster: 0.5, controller: 0.5 } } },
  modern: { reads: 'the modern world: no spells, no familiars',
    person: { role: { caster: 0.15, controller: 0.15 } } },
  future: { reads: 'a future: machines where a myth has magic',
    person: { role: { caster: 0.3, controller: 0.6 } } },
});

/**
 * Genres, by a quick game's goal: `mascot` how far it leans toward a mascot (0 a person, 1 a mascot); `person` and
 * `mascot` leans on each tuning's facets. A goal with no row leans nothing and rolls a person.
 */
const combat = { child: 0 };
export const GENRES = Object.freeze({
  reach:      { weight: 0.6, mascot: { promise: { speed: 2, cheer: 2, might: 1.5 } }, person: { archetype: { explorer: 3, innocent: 1.5, hero: 1.5 }, age: { youth: 1.5 } } },
  collect:    { weight: 0.6, mascot: { promise: { cheer: 2, mischief: 2, wonder: 1.5 } }, person: { archetype: { explorer: 3, jester: 1.5 }, age: { youth: 1.5 } } },
  survive:    { weight: 0.3, mascot: { promise: { might: 2, mischief: 1.5 } }, person: { role: { frontline: 2, flanker: 2 }, archetype: { everyman: 2, hero: 1.5 } } },
  avoid:      { weight: 0.6, mascot: { promise: { speed: 2, cheer: 1.5 } }, person: { archetype: { explorer: 2, innocent: 1.5 } } },
  race:       { weight: 0.85, mascot: { promise: { speed: 4, pride: 1.5, mischief: 1.5 }, energy: { zippy: 2 } }, person: { archetype: { explorer: 2, jester: 2, hero: 1.5, outlaw: 1.5 }, age: { youth: 2, elder: 0.5 } } },
  sneak:      { weight: 0.1, mascot: { promise: { mischief: 4 }, energy: { swaying: 2 } }, person: { role: { frontline: 3, ranged: 2 }, archetype: { everyman: 3, ruler: 1.5 }, build: { heroic: 1.5, stout: 1.5, brute: 1.5 }, age: { adult: 2, seasoned: 1.5, ...combat } } },
  rhythm:     { weight: 0.6, mascot: { promise: { cheer: 4 }, energy: { bouncy: 3 } }, person: { archetype: { jester: 3, lover: 2, innocent: 2 }, role: { 'non-combatant': 4 }, age: { youth: 2 } } },
  defend:     { weight: 0.3, mascot: { promise: { might: 3, pride: 2 } }, person: { role: { frontline: 3, flanker: 2, ranged: 2 }, archetype: { outlaw: 2, everyman: 2, hero: 1.5 }, age: combat } },
  puzzle:     { weight: 0.5, mascot: { promise: { wonder: 3, comfort: 1.5 } }, person: { archetype: { sage: 3, creator: 2 }, role: { 'non-combatant': 3 } } },
  farm:       { weight: 0.35, mascot: { promise: { comfort: 3, cheer: 2 }, energy: { swaying: 2, sturdy: 1.5 } }, person: { role: { 'non-combatant': 8, support: 2 }, archetype: { caregiver: 3, everyman: 3, innocent: 2, creator: 2 }, age: { seasoned: 1.5, elder: 2 } } },
  battle:     { weight: 0.3, mascot: { promise: { might: 3, pride: 1.5 } }, person: { role: { frontline: 2, flanker: 2, caster: 2 }, archetype: { hero: 1.5, outlaw: 1.5, ruler: 1.5 }, age: combat } },
  shoot:      { weight: 0.1, mascot: { promise: { might: 3 } }, person: { role: { ranged: 4, frontline: 2, flanker: 2 }, archetype: { outlaw: 2, hero: 2, ruler: 1.5 }, age: combat } },
  deathmatch: { weight: 0.1, mascot: { promise: { might: 3, mischief: 2 } }, person: { role: { ranged: 4, flanker: 3, frontline: 2 }, archetype: { outlaw: 3, hero: 2, jester: 1.5 }, age: combat } },
  // a versus fighter (versus/): every fighter is a person on the hero door (no mascot until non-human fighters exist),
  // never a bystander or a child; the rushdown and the grappler first, the archetypes a fighting game casts
  fight:      { weight: 0, mascot: {}, person: { role: { frontline: 3, flanker: 3, ranged: 1.5, caster: 1.5, 'non-combatant': 0 }, archetype: { hero: 2, outlaw: 2, ruler: 1.5, jester: 1.5, magician: 1.5 }, build: { heroic: 1.5, brute: 1.5, lithe: 1.5 }, age: combat } },
  fly:        { weight: 0.4, mascot: { promise: { speed: 3, wonder: 2 } }, person: { archetype: { explorer: 3, hero: 2 }, role: { ranged: 2 } } },
});

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const HEX = /^#[0-9a-f]{6}$/i;

function readLean(lean, at) {
  if (!isObj(lean)) throw new Error(`setting: ${at} is { <facet>: { <value>: a weight ≥ 0 } }`);
  for (const [facet, values] of Object.entries(lean)) {
    if (!isObj(values)) throw new Error(`setting: ${at}.${facet} is { <value>: a weight ≥ 0 }`);
    for (const [val, w] of Object.entries(values)) if (typeof w !== 'number' || !(w >= 0) || !Number.isFinite(w)) throw new Error(`setting: ${at}.${facet}.${val} is a weight ≥ 0 (got ${JSON.stringify(w)})`);
  }
}

/** Read a setting and say what is wrong. → the setting */
export function readSetting(s) {
  if (!isObj(s)) throw new Error(`setting: a setting is { ${SETTING_KEYS.join(', ')} }`);
  for (const k of Object.keys(s)) if (!SETTING_KEYS.includes(k)) throw new Error(`setting: '${k}' is not a setting word (${SETTING_KEYS.join(', ')})`);
  if (s.tradition !== undefined && !TRADITION_IDS.includes(s.tradition)) throw new Error(`setting: tradition is ${TRADITION_IDS.map((t) => `'${t}'`).join(' or ')} (got ${JSON.stringify(s.tradition)})`);
  if (s.era !== undefined && !ERAS[s.era]) throw new Error(`setting: era is one of ${Object.keys(ERAS).join(', ')} (got ${JSON.stringify(s.era)})`);
  if (s.genre !== undefined && !GENRES[s.genre]) throw new Error(`setting: genre is a quick game's goal, one of ${Object.keys(GENRES).join(', ')} (got ${JSON.stringify(s.genre)})`);
  if (s.ramps !== undefined) {
    if (!Array.isArray(s.ramps) || s.ramps.some((r) => !isObj(r) || typeof r.name !== 'string' || !Array.isArray(r.stops) || !r.stops.length || r.stops.some((c) => !HEX.test(c)))) {
      throw new Error('setting: ramps are [{ name, stops: [#rrggbb, …] }] (a kit card\'s ramps)');
    }
  }
  if (s.lean !== undefined) {
    if (!isObj(s.lean)) throw new Error('setting: lean is { person?, mascot? }, each { <facet>: { <value>: a weight } }');
    for (const k of Object.keys(s.lean)) {
      if (k !== 'person' && k !== 'mascot') throw new Error(`setting: lean.${k} is not a tuning (person, mascot)`);
      readLean(s.lean[k], `lean.${k}`);
    }
  }
  return s;
}

/** The setting's multipliers for a tuning: the era's, the genre's, then the creator's own, multiplied together. */
export function leanOf(setting, tuning = 'person') {
  if (!setting) return {};
  const out = {};
  const layer = (L) => { for (const [facet, values] of Object.entries(L || {})) for (const [val, w] of Object.entries(values)) (out[facet] ||= {})[val] = (out[facet][val] ?? 1) * w; };
  if (tuning === 'person' && setting.era) layer(ERAS[setting.era].person);
  if (setting.genre) layer(GENRES[setting.genre][tuning]);
  layer(setting.lean?.[tuning]);
  return out;
}

/** A facet's priors with the lean's weights multiplied in; a value the lean does not name keeps its weight. A lean
 * that would leave no value standing is ignored (the setting has no people at all is not a roll). */
export function leanPriors(priors, lean) {
  if (!lean) return priors;
  const out = Object.fromEntries(Object.entries(priors).map(([val, w]) => [val, w * (lean[val] ?? 1)]));
  return Object.values(out).some((w) => w > 0) ? out : priors;
}

/** How far a game leans toward a mascot: its genre's weight (absent: 0, a person). */
export const mascotWeight = (setting) => (setting?.genre ? GENRES[setting.genre].weight : 0);

/** A string to a 32-bit seed (FNV-1a). */
function hashSeed(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Person or mascot, on the setting's own die (so it never moves either roller's dice). */
export function tuningOf(setting, seed = 1, path = 'hero') {
  const w = mascotWeight(setting);
  if (w <= 0) return 'person';
  return mulberry32(hashSeed(`${seed}::tuning::${path}`))() < w ? 'mascot' : 'person';
}
