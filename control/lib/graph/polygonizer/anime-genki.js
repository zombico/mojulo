/** anime-genki.js — GENKI: the shonen spirit on the anime hero, as one amount (`hero.genki`, 0 … 1).
 *
 * A translation, not a drawing style: what a shonen lead evokes (energy, clarity, a decisive eye–brow mark) carried into
 * the hero's own words — the body tune, the anime face and graphic face, the hair, the expression and the stand. Never a
 * line, tone or texture on the figure.
 *
 * Genki is one more LAYER over the character's own design, composed as every anime layer is (anime-looks composeAnime):
 * a table's ratio at amount s is ratio^s and multiplies the look × own value; an offset is offset × s and adds to it. So
 * genki 0 (or absent) changes nothing, and `/hero/genki 0.5` is half the way in log space. The stand is moved after it
 * resolves (`genkiStand`): its stance scaled, the chest lifted, the chin raised, every other pose word as the stand said.
 *
 * The numbers are starting points measured on character cards against front-facing shonen and shojo references: a
 * youthful shonen lead's eyes are big and near round, so the male eyes grow; the female genki face narrows the opening
 * and keeps the eye size. Pure data and resolvers; no dice.
 */
import { heroHeadPole } from './anime-looks.js';

/** the GENKI table: each value at genki 1 (ratios multiply, `*Off` entries add); `faceBy` replaces `face` on a pole */
export const GENKI = Object.freeze({
  tune: Object.freeze({ shoulders: 1.25, waist: 0.9, upperArm: 1.1, forearm: 1.2, thigh: 1.08, calf: 1.15, depth: 1.05 }),
  face: Object.freeze({ eyeHeight: 0.85, iris: 0.92 }),
  faceBy: Object.freeze({ male: Object.freeze({ eyeWidth: 1.1, eyeHeight: 1.15, iris: 1.04 }) }),
  sculpt: Object.freeze({ browThick: 1.4, browGap: 0.5, mouthWidth: 1.08 }),
  sculptOff: Object.freeze({ browAngle: 10 }),
  hair: Object.freeze({ taper: 1.3, volume: 1.12 }),
  /** the expression: the brow set (+), the mouth opened and the smile widened (ratios of the pose's own amounts) */
  expression: Object.freeze({ browOff: 0.25, open: 1.6, smile: 1.15 }),
  /** the stand: a wider planted base, the chest up, the chin up */
  stand: Object.freeze({ stance: 1.35, archOff: 0.25, pitchOff: 6 }),
});

const r6 = (v) => Math.round(v * 1e6) / 1e6;
const amountOf = (hero) => (Number.isFinite(hero?.genki) && hero.genki > 0 ? Math.min(1, hero.genki) : 0);
const pow = (table, s) => Object.fromEntries(Object.entries(table).map(([k, f]) => [k, r6(f ** s)]));

/** Error strings (empty = valid): genki is a number in [0, 1], on the anime head only. */
export function validateGenki(spec, label = 'genki') {
  if (spec.genki === undefined || spec.genki === null) return [];
  const errs = [];
  if (!(Number.isFinite(spec.genki) && spec.genki >= 0 && spec.genki <= 1)) errs.push(`${label}: a number from 0 (the character as designed) to 1 (full genki)`);
  if ((spec.head ?? 'landmark') !== 'anime') errs.push(`${label}: genki tunes the anime head and its body; set head: 'anime' (or drop genki)`);
  return errs;
}

/** The layers genki adds at the hero's amount, or null when it adds none (absent or 0): `face`, `sculpt`, `hair`,
 * `tune` entries for the composers, and the expression's own adjustment. */
export function genkiLayers(hero) {
  const s = amountOf(hero);
  if (!s) return null;
  const pole = heroHeadPole(hero);
  const sculpt = { ...pow(GENKI.sculpt, s), ...Object.fromEntries(Object.entries(GENKI.sculptOff).map(([k, d]) => [k, r6(d * s)])) };
  return { s, face: pow(GENKI.faceBy[pole] ?? GENKI.face, s), sculpt, hair: pow(GENKI.hair, s), tune: pow(GENKI.tune, s) };
}

/** The expression amounts with genki's adjustment (clamped to the channels' ranges); the amounts as given when none. */
export function genkiExpression(expression, hero) {
  const s = amountOf(hero);
  if (!s) return expression;
  const E = GENKI.expression, clamp = (lo, v) => r6(Math.max(lo, Math.min(1, v)));
  return { ...expression, brow: clamp(-1, (expression.brow ?? 0) + E.browOff * s), open: clamp(0, (expression.open ?? 0) * E.open ** s), smile: clamp(0, (expression.smile ?? 0) * E.smile ** s) };
}

/** The resolved stand with genki's adjustment: the stance scaled, the spine's arch and the head's pitch raised; the pose
 * as given when genki adds none or there is no stand. */
export function genkiStand(pose, hero) {
  const s = amountOf(hero);
  if (!s || !pose) return pose;
  const S = GENKI.stand;
  return { ...pose, stance: r6((pose.stance ?? 1) * S.stance ** s), spine: { ...(pose.spine || {}), arch: r6((pose.spine?.arch ?? 0) + S.archOff * s) }, head: { ...(pose.head || {}), pitch: r6((pose.head?.pitch ?? 0) + S.pitchOff * s) } };
}
