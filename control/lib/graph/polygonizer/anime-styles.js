/** anime-styles.js — STYLE POLES: a family of faces for a kind of game, so the games made from the anime head need not
 * share one face. A style sits between the head's base (its design base and, under hero laws 19, its form) and the
 * character: the child's face, a look, the operator's own words and genki compose on top of it (anime-looks.js
 * composeAnime), so a Shonen High rival and a Shonen High heroine are both Shonen High.
 *
 * A style names, per design base, its face (the studio's controls), its sculpt (the graphic face's words) and its body
 * tune, all as the door's own words, and its FEATURE BANDS: a style is a canon of its own, so a styled hero is advised
 * against its style's bands (each one it names in place of the base's), never against the base it departs from.
 *
 * The door stores the word beside a RESOLVED stamp (`animeStyleResolved`, as a look's `lookResolved`): a later re-tuning
 * of a style here never moves a stored row until its word is set again. Pure data and resolvers; no dice.
 */
import { resolveAnimeFace } from './anime-head.js';
import { resolveAnimeSculpt } from './anime-sculpt.js';
import { resolveTune } from './hero-form.js';

/** the bodies of a style: a high-schooler's, a smaller head on a longer, skinnier frame, the neck slim under the jaw
 * (relative to the anime proportions the head wears) */
const LEAN_LONG = Object.freeze({ head: 0.94, stature: 1.03, legs: 1.03, neck: 1.04, neckGirth: 0.82, shoulders: 0.96, depth: 0.92, waist: 0.93, upperArm: 0.88, forearm: 0.9, thigh: 0.88, calf: 0.9 });

export const ANIME_STYLES = Object.freeze({
  // SHONEN HIGH, after Bleach and JJK: teen to early-20s leads, lean and long faces; cool, aura, hype. The face longer
  // and narrower, the cheeks flat, the chin a narrow V set forward; the eyes smaller in the face, a hard upper lid
  // angled up to its tail, small irises and pupils; thin brows set low and angled (the female's straight, not arched);
  // in profile, the brow's ridge forward over the eye and the bridge rising from between the brows nearly straight to
  // the tip (after Yuji's), the male's jaw prominent and wider to a corner set low and angled, not turned under, the line
  // from it climbing behind the jaw to under his ear (set back) and on into the back of the skull with no ledge to the
  // nape, his chin forward; the body
  // a high-schooler's, skinnier, its neck slim under the jaw, with a smaller head
  'shonen-high': Object.freeze({
    note: 'Bleach and JJK: teen to early-20s leads, lean and long faces, hard angled eyes under low straight brows; cool, aura, hype',
    male: Object.freeze({
      face: Object.freeze({ width: 0.94, lower: 1.08, cheekVolume: 0.88, lowerCheekVolume: 0.86, chin: 0.9, chinProjection: 1.11, jaw: 1.12, jawAngle: 0.9, browDepth: 1.3, eyeHeight: 0.93, eyeWidth: 0.98, iris: 0.95, tilt: 0.04, nose: 1.05 }),
      sculpt: Object.freeze({ lidWeight: 1.15, lidAngle: 8, lidTail: 1.2, browThick: 0.95, browGap: 0.55, browAngle: 9, pupil: 0.85, fissureHeight: 0.96, bridgeRoot: 0.06, jawHollow: -0.01, napeLift: 0.15, earBack: 0.04 }),
      tune: Object.freeze({ ...LEAN_LONG }),
      bands: Object.freeze({ eyeWidth: [0.17, 0.21], lid: [0.3, 0.45], mouthWidth: [0.25, 0.34], browGap: [0.3, 0.75] }),
    }),
    female: Object.freeze({
      face: Object.freeze({ width: 0.95, lower: 1.06, cheekVolume: 0.9, lowerCheekVolume: 0.88, chin: 0.86, chinProjection: 1.04, browDepth: 1.15, eyeHeight: 0.82, eyeWidth: 0.97, iris: 0.88, tilt: 0.05, nose: 1.05 }),
      sculpt: Object.freeze({ lidWeight: 1.2, lidCover: 1.25, lidAngle: 10, lidTail: 1.15, browThick: 0.75, browGap: 0.5, browAngle: 12, browArch: -0.03, pupil: 0.8, fissureHeight: 0.9, bridgeRoot: 0.04 }),
      tune: Object.freeze({ ...LEAN_LONG, head: 0.95, stature: 1.02, hips: 0.95 }),
      bands: Object.freeze({ eyeWidth: [0.19, 0.24], fissure: [0.45, 0.7], browThick: [0.11, 0.2], browGap: [0.3, 0.7], lid: [0.18, 0.3] }),
    }),
  }),
});
export const ANIME_STYLE_NAMES = Object.freeze(Object.keys(ANIME_STYLES));

/** Error strings (empty = valid): a style is one of ANIME_STYLE_NAMES */
export function validateAnimeStyle(spec, label = 'animeStyle') {
  if (spec === undefined || spec === null) return [];
  return typeof spec === 'string' && ANIME_STYLES[spec] ? [] : [`${label}: one of ${ANIME_STYLE_NAMES.join(', ')} (a family of anime faces for a kind of game; ${ANIME_STYLE_NAMES.map((n) => `${n}: ${ANIME_STYLES[n].note}`).join('; ')})`];
}
/** The stamp the door stores beside the word: each design base's face, sculpt and tune resolved, and its bands */
export function resolveAnimeStyle(word) {
  const S = ANIME_STYLES[word]; if (!S) throw new Error(validateAnimeStyle(word)[0]);
  const pole = (P) => {
    const { from: _f, ...face } = resolveAnimeFace([P.face]); const { from: _t, ...tune } = resolveTune([P.tune]);
    return { face, sculpt: resolveAnimeSculpt([P.sculpt]), tune, bands: structuredClone(P.bands) };
  };
  return { word, male: pole(S.male), female: pole(S.female) };
}
/** a hero's style layer for its design base (`pole`): { face, sculpt, tune, bands, word } from its stamp, or null */
export const animeStyleOf = (hero, pole) => (hero?.animeStyle && hero.animeStyleResolved?.[pole] ? { word: hero.animeStyleResolved.word, ...hero.animeStyleResolved[pole] } : null);
