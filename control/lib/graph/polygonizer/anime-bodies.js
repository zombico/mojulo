/** anime-bodies.js — BODY CODENAMES (the anime frame's bodies, `animeBody`): each a DYAD, one base worn two ways. Its
 * SIMPLIFIED form is a body tune (the door's tune words, a ratio each to the cast's own) laid over the anime frame in
 * place of the head style's body (anime-styles.js: a style names a head and the body it came with); its MUSCULAR form
 * is a muscle card (musculature/cards.js) worn over that same base by the hero's `muscleShirt`. So the two always relate:
 * the shirt adds muscle to the body the simplified form drew, never to another.
 *
 * A codename names a body, not a head: any anime head wears any body of its pole, the style's head size kept (a body's
 * tune names every body word but `head`). Toji and Mizuki are the base, the grown martial hero's (Z-Fighter's body, so a
 * Z-Fighter hero reads as it did); Satoru and Maki the slim; Armstrong and Kale the hulking.
 *
 * The door stores the word beside a RESOLVED stamp (`animeBodyResolved`), so a later retune here never moves a stored
 * row until its word is set again. Pure data and resolvers; no dice. */
import { resolveTune } from './hero-form.js';

/** the base, a grown martial hero's: a tall, heavy frame, the neck short and thick into the trapezius (Z-Fighter's
 * male body, its head's size left to the style) */
const TOJI = Object.freeze({ stature: 1.05, neck: 0.92, neckGirth: 1.1, shoulders: 1.14, depth: 1.08, waist: 1.02, upperArm: 1.25, forearm: 1.18, thigh: 1.15, calf: 1.12 });
/** the base's female (Z-Fighter's female body) */
const MIZUKI = Object.freeze({ stature: 1.03, neck: 0.92, neckGirth: 0.95, shoulders: 1.03, depth: 1, waist: 0.96, upperArm: 1.02, forearm: 1.02, thigh: 1.04, calf: 1.03 });
/** the slim male, a tall, long-limbed swimmer's V: near Shonen High's size (its limbs a little fuller), set apart from
 * it by height in the legs and a broad shoulder over a narrow waist, where Shonen High's is narrow-shouldered and lanky */
const SATORU = Object.freeze({ stature: 1.06, torso: 1, legs: 1.06, neck: 1.02, neckGirth: 0.9, shoulders: 1.06, depth: 0.92, waist: 0.88, hips: 0.96, upperArm: 0.97, forearm: 0.96, thigh: 0.95, calf: 0.96 });
/** the slim female, an athlete's: near Shonen High's size, set apart from its long, narrow-waisted model's frame by a
 * squarer shoulder, a fuller thigh and calf and a waist held in rather than pinched */
const MAKI = Object.freeze({ stature: 1.05, torso: 0.97, legs: 1.05, neck: 1, neckGirth: 0.86, shoulders: 0.99, depth: 0.92, waist: 0.88, hips: 1, upperArm: 0.94, forearm: 0.94, thigh: 1, calf: 0.97 });

/** the hulking male, a strongman-bodybuilder's mass: taller and far heavier than the base, the neck buried in the yoke,
 * the shoulders and the chest's depth at their widest, the arms and the legs massive, the waist thick but under the
 * chest */
const ARMSTRONG = Object.freeze({ stature: 1.08, torso: 1.03, neck: 0.88, neckGirth: 1.26, shoulders: 1.23, depth: 1.18, waist: 1.12, hips: 1.08, upperArm: 1.42, forearm: 1.34, thigh: 1.3, calf: 1.25 });
/** the hulking female, a powerhouse's: taller and heavier than the base's, broad in the shoulder and the hip, the arms
 * and the legs massive, the waist still under the chest and the hips */
const KALE = Object.freeze({ stature: 1.07, torso: 1.02, neck: 0.9, neckGirth: 1.1, shoulders: 1.13, depth: 1.1, waist: 1.03, hips: 1.08, upperArm: 1.26, forearm: 1.2, thigh: 1.24, calf: 1.16 });

export const ANIME_BODIES = Object.freeze({
  toji: Object.freeze({ pole: 'male', note: 'the base: a grown martial hero, tall and heavy, the neck short and thick', tune: TOJI, card: 'toji' }),
  mizuki: Object.freeze({ pole: 'female', note: 'the base\'s female: a grown martial heroine, strong and full', tune: MIZUKI, card: 'mizuki' }),
  satoru: Object.freeze({ pole: 'male', note: 'slim: a tall, long-limbed swimmer\'s V, a broad shoulder over a narrow waist', tune: SATORU, card: 'satoru' }),
  maki: Object.freeze({ pole: 'female', note: 'slim: an athlete, a square shoulder, a held waist, full thighs and calves', tune: MAKI, card: 'maki' }),
  armstrong: Object.freeze({ pole: 'male', note: 'hulking: a strongman-bodybuilder\'s mass, the neck buried in the yoke, the arms and the legs massive', tune: ARMSTRONG, card: 'armstrong' }),
  kale: Object.freeze({ pole: 'female', note: 'hulking: a powerhouse, broad in the shoulder and the hip, the arms and the legs massive', tune: KALE, card: 'kale' }),
});
export const ANIME_BODY_NAMES = Object.freeze(Object.keys(ANIME_BODIES));

/** Error strings (empty = valid): a body is one of ANIME_BODY_NAMES, of the hero's pole when it has one */
export function validateAnimeBody(spec, pole = null, label = 'animeBody') {
  if (spec === undefined || spec === null) return [];
  const B = typeof spec === 'string' ? ANIME_BODIES[spec] : null;
  if (!B) return [`${label}: one of ${ANIME_BODY_NAMES.join(', ')} (a body codename, its simplified form a tune and its muscular form the muscleShirt over the same base; ${ANIME_BODY_NAMES.map((n) => `${n} (${ANIME_BODIES[n].pole}): ${ANIME_BODIES[n].note}`).join('; ')})`];
  if (pole && pole !== B.pole) return [`${label}: ${spec} is a ${B.pole} body; the ${pole}'s are ${ANIME_BODY_NAMES.filter((n) => ANIME_BODIES[n].pole === pole).join(', ')}`];
  return [];
}
/** The stamp the door stores beside the word: its pole, its tune resolved (every body word), its card's word */
export function resolveAnimeBody(word) {
  const B = ANIME_BODIES[word]; if (!B) throw new Error(validateAnimeBody(word)[0]);
  const { from: _f, head: _h, ...tune } = resolveTune([B.tune]);
  return { word, pole: B.pole, tune, card: B.card };
}
/** a hero's resolved body, or null */
export const animeBodyOf = (hero) => (hero?.animeBody && hero.animeBodyResolved?.word === hero.animeBody ? hero.animeBodyResolved : null);
