/** anime-bodies.js — BODY CODENAMES (the anime frame's bodies, `animeBody`): each a DYAD, one base worn two ways. Its
 * SIMPLIFIED form is a body tune (the door's tune words, a ratio each to the cast's own) laid over the anime frame in
 * place of the head style's body (anime-styles.js: a style names a head and the body it came with); its MUSCULAR form
 * is a muscle card (musculature/cards.js) worn over that same base by the hero's `muscleShirt`. So the two always relate:
 * the shirt adds muscle to the body the simplified form drew, never to another.
 *
 * A codename names a body, not a head: any anime head wears any body of its pole, the style's head size kept (a body's
 * tune names every body word but `head`). Toji and Mizuki are the base, the grown martial hero's (Z-Fighter's body, so a
 * Z-Fighter hero reads as it did); Satoru and Maki the slim; Armstrong and Kale the hulking. SHONEN HIGH is the lead's
 * lean body, the anime frame's default (Shonen High's own, either pole, its tune read from the style so the two never
 * part), named so a game can put it under any head; its muscular form wears the base card, as the default body does.
 *
 * The door stores the word beside a RESOLVED stamp (`animeBodyResolved`), so a later retune here never moves a stored
 * row until its word is set again. Pure data and resolvers; no dice.
 *
 * THE HEAD'S FIT. Each body has a HOME head, the style it was drawn under (Toji's Z-Fighter's, Satoru's Shonen High's),
 * and a head worn from another style is scaled toward the home head's size, half the way (FIT_ALPHA): the body keeps
 * the proportion it was drawn to, the style keeps half its own (a School-Kid Hero head is still the big one). A style's
 * head size is one number against Shonen High's per pole (HEAD_SIZE: measured, the ratio of two heads' widths is the
 * same on every body to half a percent, so it is the style's own), held to the measure by its test. The fit is stamped
 * with the style it was fitted for (`fit: { style, head, neck }`): the neck's girth follows the fitted head half the
 * way (NECK_BETA), so the join reads as one; a stamp without one (a row minted before) fits nothing, without a `neck`
 * fits the head alone.
 *
 * UNDER ANOTHER HEAD (fighter wiring): the same body on the lofted hero under the landmark or the realistic head, its
 * tune laid under the hero's own and its muscular form the same card, the head sized by its own proportions (the stamp's
 * fit null). */
import { resolveTune } from './hero-form.js';
import { ANIME_STYLES, ANIME_STYLE_DEFAULT } from './anime-styles.js';

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
  toji: Object.freeze({ home: 'z-fighter', pole: 'male', note: 'the base: a grown martial hero, tall and heavy, the neck short and thick', tune: TOJI, card: 'toji' }),
  mizuki: Object.freeze({ home: 'z-fighter', pole: 'female', note: 'the base\'s female: a grown martial heroine, strong and full', tune: MIZUKI, card: 'mizuki' }),
  satoru: Object.freeze({ home: 'shonen-high', pole: 'male', note: 'slim: a tall, long-limbed swimmer\'s V, a broad shoulder over a narrow waist', tune: SATORU, card: 'satoru' }),
  maki: Object.freeze({ home: 'shonen-high', pole: 'female', note: 'slim: an athlete, a square shoulder, a held waist, full thighs and calves', tune: MAKI, card: 'maki' }),
  armstrong: Object.freeze({ home: 'z-fighter', pole: 'male', note: 'hulking: a strongman-bodybuilder\'s mass, the neck buried in the yoke, the arms and the legs massive', tune: ARMSTRONG, card: 'armstrong' }),
  kale: Object.freeze({ home: 'z-fighter', pole: 'female', note: 'hulking: a powerhouse, broad in the shoulder and the hip, the arms and the legs massive', tune: KALE, card: 'kale' }),
  // (either pole: its tune by the hero's)
  'shonen-high': Object.freeze({ home: 'shonen-high', pole: null, note: 'the lead\'s lean body, the anime frame\'s default: long in the leg, a V on the male, slim on the female', tune: Object.freeze({ male: ANIME_STYLES['shonen-high'].male.tune, female: ANIME_STYLES['shonen-high'].female.tune }), card: 'saikyo' }),
});
export const ANIME_BODY_NAMES = Object.freeze(Object.keys(ANIME_BODIES));

/** Error strings (empty = valid): a body is one of ANIME_BODY_NAMES, of the hero's pole when it has one */
export function validateAnimeBody(spec, pole = null, label = 'animeBody') {
  if (spec === undefined || spec === null) return [];
  const B = typeof spec === 'string' ? ANIME_BODIES[spec] : null;
  if (!B) return [`${label}: one of ${ANIME_BODY_NAMES.join(', ')} (a body codename, its simplified form a tune and its muscular form the muscleShirt over the same base; ${ANIME_BODY_NAMES.map((n) => `${n} (${ANIME_BODIES[n].pole}): ${ANIME_BODIES[n].note}`).join('; ')})`];
  if (pole && B.pole && pole !== B.pole) return [`${label}: ${spec} is a ${B.pole} body; the ${pole}'s are ${ANIME_BODY_NAMES.filter((n) => ANIME_BODIES[n].pole === pole).join(', ')}`];
  return [];
}
/** a style's head size against Shonen High's, per pole (measured on every body: anime-bodies.test.js holds it) */
export const HEAD_SIZE = Object.freeze({
  male: Object.freeze({ 'shonen-high': 1, 'z-fighter': 1.094, 'school-kid-hero': 1.465 }),
  female: Object.freeze({ 'shonen-high': 1, 'z-fighter': 1.185, 'school-kid-hero': 1.443 }),
});
/** how far a foreign head is scaled toward the body's home head's size: half the way, in ratio */
export const FIT_ALPHA = 0.5;
/** how far the neck follows the head it carries: half the head's remaining departure from the home head's size, so a
 * bigger head stands on a thicker neck and a smaller one on a slimmer, the join reading as one */
export const NECK_BETA = 0.5;
/** The head's fit for a body worn under a style: the scale on the style's head size, 1 under the body's home style (or
 * a style or a pole the table has no size for). */
export function headFit(word, pole, style) {
  const B = ANIME_BODIES[word], P = HEAD_SIZE[pole === 'female' ? 'female' : 'male'];
  if (!B || !P[style] || !P[B.home] || style === B.home) return 1;
  return Math.round((P[B.home] / P[style]) ** FIT_ALPHA * 1e4) / 1e4;
}
/** The neck's fit under a head worn from another style: its girth followed toward the fitted head's size (NECK_BETA of
 * the head's departure that remains after headFit), 1 under the body's home style. */
export function neckFit(word, pole, style) {
  const B = ANIME_BODIES[word], P = HEAD_SIZE[pole === 'female' ? 'female' : 'male'];
  if (!B || !P[style] || !P[B.home] || style === B.home) return 1;
  return Math.round(((P[style] / P[B.home]) * headFit(word, pole, style)) ** NECK_BETA * 1e4) / 1e4;
}
/** The stamp the door stores beside the word: its pole, its tune resolved (every body word), its card's word, and the
 * head's fit for the style it is worn under (`style`, the default's when absent). A body of either pole takes the
 * hero's (`pole`, male when absent). Under a head of no anime style (`style` null: the landmark or the realistic head
 * on the same lofted body, fighter wiring) the fit is null: that head is sized by its own proportions, not a style's. */
export function resolveAnimeBody(word, pole = null, style = ANIME_STYLE_DEFAULT) {
  const B = ANIME_BODIES[word]; if (!B) throw new Error(validateAnimeBody(word)[0]);
  const { from: _f, head: _h, ...tune } = resolveTune([B.pole ? B.tune : B.tune[pole === 'female' ? 'female' : 'male']]);
  const P = B.pole ?? (pole === 'female' ? 'female' : 'male');
  return { word, pole: P, tune, card: B.card, fit: style === null ? null : { style, head: headFit(word, P, style), neck: neckFit(word, P, style) } };
}
/** the hero's pole as a body reads it: its cast word, or its build's pole */
export const animePoleOf = (hero) => { const c = hero?.cast; const p = typeof c === 'string' ? c : c?.pole; return p === 'female' ? 'female' : 'male'; };
/** does a hero's stamp stand for its word (and, for a body of either pole, its pole)? */
export const animeBodyStamped = (hero) => hero?.animeBodyResolved?.word === hero?.animeBody && (ANIME_BODIES[hero.animeBody]?.pole || hero.animeBodyResolved.pole === animePoleOf(hero))
  // (a fitted stamp stands for the style it was fitted under; a stamp without a fit, minted before, stands as it is; under
  // a head of no style, the stamp whose fit is null)
  && (hero.head !== 'anime' ? hero.animeBodyResolved.fit === null : !hero.animeBodyResolved.fit || hero.animeBodyResolved.fit.style === (hero.animeStyle ?? ANIME_STYLE_DEFAULT));
/** the anime style a body codename is fitted under: the hero's style (the default's) on the anime head, none on another */
export const animeBodyStyle = (hero) => (hero?.head === 'anime' ? hero.animeStyle ?? undefined : null);
/** a hero's resolved body, or null */
export const animeBodyOf = (hero) => (hero?.animeBody && hero.animeBodyResolved?.word === hero.animeBody ? hero.animeBodyResolved : null);
