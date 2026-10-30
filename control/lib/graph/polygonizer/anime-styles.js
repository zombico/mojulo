/** anime-styles.js — STYLE POLES: a family of faces for a kind of game, so the games made from the anime head need not
 * share one face. A style sits between the head's base (its design base and, under hero laws 19, its form) and the
 * character: the child's face, a look, the operator's own words and genki compose on top of it (anime-looks.js
 * composeAnime), so a Shonen High rival and a Shonen High heroine are both Shonen High.
 *
 * A style names, per design base, its face (the studio's controls), its sculpt (the graphic face's words) and its body
 * tune, all as the door's own words; the head it wears (`head`: another base's, its face and sculpt under its own, so
 * Shonen High's female wears the male's head tuned); and its FEATURE BANDS: a style is a canon of its own, so a styled hero is advised
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
  // the tip (after Yuji's), the male's jaw prominent and wider, its edge run back from the chin nearly level to a corner
  // set low under his ear (set back) and straight up to it (sculpt `jawLine`), nothing hanging behind the chin, the face's
  // side rounded down to that edge, the line on behind the ear into the back of the skull with no ledge to the nape, his
  // chin forward (the female's the same, on his head); the body
  // a high-schooler's, skinnier, its neck slim under the jaw, with a smaller head
  'shonen-high': Object.freeze({
    note: 'Bleach and JJK: teen to early-20s leads, lean and long faces, hard angled eyes under low straight brows; cool, aura, hype',
    male: Object.freeze({
      face: Object.freeze({ width: 0.94, lower: 1.08, cheekVolume: 0.88, lowerCheekVolume: 0.96, chin: 0.72, chinProjection: 1.11, jaw: 1.12, jawAngle: 0.9, browDepth: 1.3, eyeHeight: 0.93, eyeWidth: 0.98, iris: 0.95, tilt: 0.04, nose: 1.05 }),
      sculpt: Object.freeze({ lidWeight: 1.15, lidAngle: 8, lidTail: 1.2, browThick: 0.95, browGap: 0.55, browAngle: 9, pupil: 0.85, fissureHeight: 0.96, bridgeRoot: 0.06, jawHollow: 0.01, napeLift: 0.15, earBack: 0.04, jawLine: 1 }),
      // (the male an athletic lead's: the torso shorter and the legs longer, the shoulders broader over a narrow waist, a V)
      tune: Object.freeze({ ...LEAN_LONG, head: 0.9212, torso: 0.95, legs: 1.0712, shoulders: 1.008, waist: 0.8556 }),
      bands: Object.freeze({ eyeWidth: [0.17, 0.21], lid: [0.3, 0.45], mouthWidth: [0.25, 0.34], browGap: [0.3, 0.75] }),
    }),
    // the female: the MALE's head (`head`: his skull, his profile, his jaw's line to the back of the skull, his ear), and
    // over his face and sculpt her own layer, after Nobara's figure: her head smaller than his; her features softer (her
    // brow's ridge, her bridge and her nose lighter, her jaw narrower, softer and turned under into a small pointed chin,
    // her lids and brows less angled); her face one clean line from the cheekbone down to the pointed chin, front and three-quarter, no fullness bulging at the mouth: from the front a convex arc, fuller along the jaw and narrowing into a narrow chin; her eyes a little larger than his, almond under a heavier lash
    // flicked at its tail; her brows thinner; her mouth smaller; after the figure's proportions (the eye as drawn, its lid
    // band and lashes in it: about a quarter of the face's width, one eye's width apart, two fifths of the eye line to
    // the chin), her eyes larger than his and set wider, her lower face shorter, the eye line lower in it, the nose small and short (its tip raised under
    // a root that stays), the mouth narrow and raised with it, the gap between them kept (her bands the figure's, not his); her head seated back on her neck (`seatBack`: his head
    // sits forward on her slimmer neck; back, her face stands as far before her neck as his before his). Her body and
    // her hair are her cast's own
    female: Object.freeze({
      head: 'male',
      face: Object.freeze({ lower: 0.85, eyeHeight: 1.087, eyeWidth: 1.061, spacing: 1.04, iris: 1.08, jaw: 1.012, chin: 0.689, chinProjection: 0.94, cheekVolume: 1.026, lowerCheekVolume: 0.92, browDepth: 0.85, nose: 0.69 }),
      sculpt: Object.freeze({ pronasale: 0.038, stomion: 0.06, lidWeight: 1.12, lidTail: 1.04, lidFlick: 10, lidAngle: -3, browThick: 0.65, browAngle: -3, bridgeRoot: -0.035, tipProjection: 0.52, mouthWidth: 0.6, jawHollow: 0.01, napeLift: -0.03, seatBack: 0.08 }),
      // (the female long-legged and slim: the torso shorter, the legs longer, the waist narrow, the shoulders narrower)
      tune: Object.freeze({ ...LEAN_LONG, head: 0.873, stature: 1.02, torso: 0.92, legs: 1.1021, waist: 0.8184, shoulders: 0.912, hips: 0.95 }),
      bands: Object.freeze({ browThick: [0.2, 0.45], eyeLevel: [0.41, 0.45], pronasale: [0.28, 0.34], stomion: [0.19, 0.24], noseToMouth: [0.08, 0.12], eyeWidth: [0.19, 0.24], noseProjection: [0.035, 0.07], mouthWidth: [0.17, 0.24] }),
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
  // (an entry that wears another's head, `head`: that entry's face and sculpt under its own, and its bands under its own)
  const pole = (P) => {
    const H = P.head ? S[P.head] : null;
    const { from: _f, ...face } = resolveAnimeFace([H?.face, P.face].filter(Boolean)); const { from: _t, ...tune } = resolveTune([P.tune]);
    return { ...(P.head ? { head: P.head } : {}), face, sculpt: resolveAnimeSculpt([H?.sculpt, P.sculpt].filter(Boolean)), tune, bands: structuredClone({ ...(H?.bands ?? {}), ...P.bands }) };
  };
  return { word, male: pole(S.male), female: pole(S.female) };
}
/** a hero's style layer for its design base (`pole`): { face, sculpt, tune, bands, word } from its stamp, or null */
export const animeStyleOf = (hero, pole) => (hero?.animeStyle && hero.animeStyleResolved?.[pole] ? { word: hero.animeStyleResolved.word, ...hero.animeStyleResolved[pole] } : null);
