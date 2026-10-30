/** anime-styles.js — HEAD CASTS (the style poles): the anime head sculpted as an action figure is, the relations between
 * the face's structures tuned in clay, the head first and the body after it. A cast is named for its figure's scale and
 * theme (Shonen High: high-school-sized, action-themed), never for a kind of game: every cast is lit the same way, so
 * any game can field any of them and no game type tags a face. The casts are siblings: each a layer over the head's
 * base (its design base and, under hero laws 19, its form) and under the character: the child's face, a look, the
 * operator's own words and genki compose on top of it (anime-looks.js composeAnime), so a Shonen High rival and a Shonen
 * High heroine are both Shonen High. A minted adult on the formed head wears ANIME_STYLE_DEFAULT unless it names a cast
 * (motion-stamp.js withDefaultForm); `null` is the form's bare head.
 *
 * A cast names, per design base, its face (the studio's controls), its sculpt (the graphic face's words) and its body
 * tune, all as the door's own words; the head it wears (`head`: another base's, its face and sculpt under its own, so
 * Shonen High's female wears the male's head tuned); and its FEATURE BANDS: a cast is a canon of its own, so a styled hero is advised
 * against its cast's bands (each one it names in place of the base's), never against the base it departs from.
 *
 * The door stores the word beside a RESOLVED stamp (`animeStyleResolved`, as a look's `lookResolved`): a later re-tuning
 * of a cast here never moves a stored row until its word is set again. Pure data and resolvers; no dice.
 */
import { resolveAnimeFace } from './anime-head.js';
import { resolveAnimeSculpt } from './anime-sculpt.js';
import { resolveTune } from './hero-form.js';

/** the bodies of a style: a high-schooler's, a smaller head on a longer, skinnier frame, the neck slim under the jaw
 * (relative to the anime proportions the head wears) */
const LEAN_LONG = Object.freeze({ head: 0.94, stature: 1.03, legs: 1.03, neck: 1.04, neckGirth: 0.82, shoulders: 0.96, depth: 0.92, waist: 0.93, upperArm: 0.88, forearm: 0.9, thigh: 0.88, calf: 0.9 });
/** a grown martial hero's: a small head on a tall, heavy frame, the neck short and thick into the trapezius */
const HEAVY_HERO = Object.freeze({ head: 0.88, stature: 1.05, neck: 0.92, neckGirth: 1.25, shoulders: 1.14, depth: 1.08, waist: 1.02, upperArm: 1.25, forearm: 1.18, thigh: 1.15, calf: 1.12 });
/** a schoolkid's: a big head on a short, slight frame, the neck thin */
const SCHOOL_KID = Object.freeze({ head: 1.1, stature: 0.88, legs: 0.95, torso: 0.96, neck: 0.94, neckGirth: 0.78, shoulders: 0.9, depth: 0.88, waist: 0.92, upperArm: 0.84, forearm: 0.86, thigh: 0.85, calf: 0.87 });

export const ANIME_STYLES = Object.freeze({
  // SHONEN HIGH, high-school-sized and action-themed (first cast after Bleach and JJK): teen to early-20s leads, lean
  // and long faces; cool, aura, hype. The face longer
  // and narrower, the cheeks flat, the chin a narrow V set forward; the eyes smaller in the face, a hard upper lid
  // angled up to its tail, small irises and pupils; thin brows set low and angled (the female's straight, not arched);
  // in profile, the brow's ridge forward over the eye and the bridge rising from between the brows nearly straight to
  // the tip (after Yuji's), the male's jaw prominent and wider, its edge run back from the chin nearly level to a corner
  // set low under his ear (set back) and straight up to it (sculpt `jawLine`), nothing hanging behind the chin, the face's
  // side rounded down to that edge, the line on behind the ear into the back of the skull with no ledge to the nape, his
  // chin forward (the female's the same, on his head); the body
  // a high-schooler's, skinnier, its neck slim under the jaw, with a smaller head
  'shonen-high': Object.freeze({
    note: 'high-school-sized, action-themed (after Bleach and JJK): teen to early-20s leads, lean and long faces, hard angled eyes under low straight brows',
    male: Object.freeze({
      face: Object.freeze({ width: 0.94, lower: 1.08, cheekVolume: 0.88, lowerCheekVolume: 0.96, chin: 0.72, chinProjection: 1.11, jaw: 1.12, jawAngle: 0.9, browDepth: 1.3, eyeHeight: 0.93, eyeWidth: 0.98, iris: 0.95, tilt: 0.04, nose: 1.05 }),
      sculpt: Object.freeze({ lidWeight: 1.15, lidAngle: 8, lidTail: 1.2, browThick: 0.95, browGap: 0.55, browAngle: 9, pupil: 0.85, fissureHeight: 0.96, bridgeRoot: 0.06, jawHollow: 0.01, napeLift: 0.15, earBack: 0.04, jawLine: 1 }),
      tune: Object.freeze({ ...LEAN_LONG }),
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
      tune: Object.freeze({ ...LEAN_LONG, head: 0.9, stature: 1.02, hips: 0.95 }),
      bands: Object.freeze({ browThick: [0.2, 0.45], eyeLevel: [0.41, 0.45], pronasale: [0.28, 0.34], stomion: [0.19, 0.24], noseToMouth: [0.08, 0.12], eyeWidth: [0.19, 0.24], noseProjection: [0.035, 0.07], mouthWidth: [0.17, 0.24] }),
    }),
  }),
  // Z-FIGHTER, grown-hero-sized and martial-arts-themed (after a maquette of Goku): an adult fighter's head, small on a
  // heavy frame. The face broad at the cheekbones over flat cheeks, the jaw square and wide to a corner level with the
  // mouth, then running in to a narrow chin set forward; the brow's ridge heavy and forward; the eyes wide and low under
  // a heavy, straight upper lid angled down to the nose, small irises; the brows thick blocks set low on the eye and
  // angled hard down to the bridge; the nose small and pointed off a raised bridge; the mouth wide and low. The female
  // (after a maquette of Android 18) wears the male's head, as Shonen High's does (her own base's left the jaw hanging
  // under the skull in profile, past what its words could close), her layer the cool grown fighter over his: his
  // features softened and narrowed, almond eyes under a level lid, the brows straight and thin, her face one convex
  // arc from under the ear to a narrow chin (the jaw fuller along its edge than the cheek, the lower cheek slim, so no
  // fullness bulges beside the mouth), the mouth small, her head seated back on her neck
  'z-fighter': Object.freeze({
    note: 'grown-hero-sized, martial-arts-themed (after a Goku maquette): a small, square-jawed head on a heavy frame, wide low eyes under thick brows angled hard to the bridge',
    male: Object.freeze({
      face: Object.freeze({ width: 1.05, lower: 1.0, cheekVolume: 0.84, lowerCheekVolume: 1.0, jaw: 1.22, jawAngle: 1.12, chin: 0.92, chinProjection: 1.08, browDepth: 1.3, eyeWidth: 1.06, eyeHeight: 0.9, iris: 0.9, tilt: 0.02, nose: 1.1 }),
      sculpt: Object.freeze({ lidWeight: 1.3, lidAngle: 10, lidTail: 1.1, browThick: 1.4, browGap: 0.4, browAngle: 12, pupil: 0.8, fissureHeight: 0.92, bridgeRoot: 0.05, mouthWidth: 1.1, stomion: -0.01, napeLift: 0.12, earBack: 0.03, jawLine: 1 }),
      tune: HEAVY_HERO,
      bands: Object.freeze({ fissure: [0.3, 0.5], lid: [0.3, 0.5], stomion: [0.15, 0.19] }),
    }),
    female: Object.freeze({
      head: 'male',
      face: Object.freeze({ width: 0.93, lower: 0.92, cheekVolume: 1.15, lowerCheekVolume: 0.9, jaw: 0.86, jawAngle: 0.92, chin: 0.76, chinProjection: 0.94, browDepth: 0.85, eyeWidth: 1.01, iris: 0.97, nose: 0.85 }),
      sculpt: Object.freeze({ lidWeight: 0.95, lidAngle: -4, lidFlick: 6, fissureHeight: 0.96, browThick: 0.6, browAngle: -8, bridgeRoot: -0.02, tipProjection: 0.85, mouthWidth: 0.8, jawHollow: 0.01, seatBack: 0.08 }),
      tune: Object.freeze({ ...HEAVY_HERO, head: 0.92, stature: 1.03, neckGirth: 0.95, shoulders: 1.03, depth: 1, waist: 0.96, upperArm: 1.02, forearm: 1.02, thigh: 1.04, calf: 1.03 }),
      bands: Object.freeze({ eyeLevel: [0.41, 0.46], stomion: [0.13, 0.18], lid: [0.3, 0.5], mouthWidth: [0.22, 0.32] }),
    }),
  }),
  // SCHOOL-KID HERO, schoolkid-sized and action-themed (after a Kishimoto-baseline figure, a twelve-year-old genin): a big
  // head on a short, slight frame. The skull round and the face a soft ELLIPSE, leaning toward Shonen High's but rounder:
  // its roundness from the outline (the head a little wide, the jaw broad, its corner high) curving in to a small pointed
  // chin, never from a pouch on the cheek (the lower cheek a little slimmer than the base's, so no chipmunk) nor a shelf
  // under the cheekbone; softer than Shonen High's (the jaw's line two thirds squared, the jaw not curved in, the
  // socket's planes shallower), its jaw closed up into the skull as his is (the underside rising from the chin to the
  // corner, then up behind the ear, the nape lifted to meet it); the eyes large and tall under a crisp upper lid lifted
  // to its tail, the irises large; the brows thin and a little angled; the nose and the mouth small. The female (after the same figure's heroine) wears the male's
  // head, as Shonen High's does: her features softer, her brow broader, her eyes a little larger, her chin as small
  'school-kid-hero': Object.freeze({
    note: 'schoolkid-sized, action-themed (after a Kishimoto-baseline genin figure): a big round head on a short, slight frame, a soft elliptical face to a small pointed chin, large crisp eyes, a small mouth',
    male: Object.freeze({
      face: Object.freeze({ width: 1.05, lower: 0.96, cheekVolume: 1.02, lowerCheekVolume: 0.93, jaw: 1.06, jawAngle: 1.12, chin: 0.66, chinHeight: 0.92, chinProjection: 1.04, browDepth: 1, eyeWidth: 1.06, eyeHeight: 1.08, iris: 1.04, tilt: 0.03, nose: 0.85 }),
      sculpt: Object.freeze({ lidWeight: 1.1, lidAngle: 6, lidTail: 1.1, browThick: 0.85, browGap: 0.8, browAngle: 6, fissureHeight: 1.05, mouthWidth: 0.88, orbit: -0.01, jawHollow: -0.01, jawLine: 0.65, napeLift: 0.12 }),
      tune: SCHOOL_KID,
      bands: Object.freeze({ eyeLevel: [0.4, 0.45], pronasale: [0.23, 0.3], stomion: [0.12, 0.17], browThick: [0.3, 0.6], mouthWidth: [0.24, 0.34] }),
    }),
    female: Object.freeze({
      head: 'male',
      face: Object.freeze({ foreheadDepth: 1.08, eyeHeight: 1.03, eyeWidth: 1.03, iris: 1.05, jaw: 0.94, chin: 0.86, cheekVolume: 1.02, browDepth: 0.85, nose: 0.85 }),
      sculpt: Object.freeze({ lidWeight: 1.1, lidFlick: 10, lidAngle: -2, browThick: 0.7, browAngle: -3, tipProjection: 0.85, mouthWidth: 0.9, seatBack: 0.04 }),
      tune: Object.freeze({ ...SCHOOL_KID, head: 1.08, stature: 0.87, hips: 0.95 }),
      bands: Object.freeze({ eyeWidth: [0.19, 0.23], browThick: [0.2, 0.45], lid: [0.3, 0.45], noseProjection: [0.06, 0.12], mouthWidth: [0.2, 0.32] }),
    }),
  }),
});
export const ANIME_STYLE_NAMES = Object.freeze(Object.keys(ANIME_STYLES));
/** the cast a minted adult on the formed head wears when it names none (motion-stamp.js withDefaultForm) */
export const ANIME_STYLE_DEFAULT = 'shonen-high';

/** Error strings (empty = valid): a style is one of ANIME_STYLE_NAMES */
export function validateAnimeStyle(spec, label = 'animeStyle') {
  if (spec === undefined || spec === null) return [];
  return typeof spec === 'string' && ANIME_STYLES[spec] ? [] : [`${label}: one of ${ANIME_STYLE_NAMES.join(', ')} (a head cast, lit like every other, for any game; ${ANIME_STYLE_NAMES.map((n) => `${n}: ${ANIME_STYLES[n].note}`).join('; ')})`];
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
