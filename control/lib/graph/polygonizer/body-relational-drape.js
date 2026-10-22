/**
 * BODY-RELATIONAL DRAPE — LOOSE cloth that hangs on the realistic body, where every garment before it is fitted: the
 * martial artist's WIDE TROUSERS (wide from the hip, falling past the knee, bunched over a gathered cuff at the ankle,
 * a sash at the waist).
 *
 *   the base    the trousers' own rings (body-relational-garment.js `fieldGarment`: the seat, the legs, their handover),
 *               so the drape keeps their stations and slots, and with them the skin's bind and correctives
 *   the FALL    down each leg (the thigh's rings, then the shank's), each slot's radius off its ring's middle the
 *               larger of its own (and the `slack`, eased in below the seat so the legs leave it without a step) and
 *               the ring above's let down by `taper` per metre: the cloth falls from the widest it passes, released
 *               slowly, as cloth hanging from the hip does
 *   the MIDLINE the inner side held `margin` off the body's middle plane, so the two legs never cross
 *   the FOLDS   vertical: a ripple round each ring (`folds` of them, `fold` deep), deeper toward the hem
 *   ONE LEG     the thigh's cloth and the shank's made one tube (`<id>_leg<R|L>`: the thigh's rings down to where the
 *               shank's begin, then the shank's, taken round at the thigh's slots), each point keeping its own weights,
 *               so no edge crosses the knee
 *   the HEM     a BLOUSE (the cloth bunched `blouse` out over `blouseLen`) above a gathered CUFF (`cuffLen` at the ankle,
 *               the skin's ease again), a wrapped band round it (`Cuff`)
 *   the SASH    a wide band round the waist (`Sash`), a knot at the front and two tails hanging over the trousers
 *
 *   loosePants(recipe, R, build, map, spec, { id }) → { parts, tones }   (parts `<id>_<segment>` the trousers,
 *               `<id>Cuff_<shank>`, `<id>Sash_pelvis`, `<id>Knot`, `<id>Tail<R|L>`)
 *   LOOSE_GARMENTS  the words: `martialPants` (gathered at the ankle), `wideTrousers` (`hem: 'fall'`: open, falling past the
 *                   ankle onto the foot to `floor` over the ground)
 *
 * The construction is the tailor's (body-relational-tailor.js); this file the trousers' choice of it. The drape is the
 * REST shape, carried by the leg's bones as the skin is (no cloth simulation). Pure; deterministic.
 */
import { fieldGarment, FIELD_GARMENTS } from './body-relational-garment.js';
import { drapeRun, oneTube, fallToFloor, bandAt, sashOn } from './body-relational-tailor.js';

export const LOOSE_GARMENTS = Object.freeze({
  martialPants: Object.freeze({ slack: 0.03, taper: 0.045, margin: 0.004, folds: 8, fold: 0.008, blouse: 0.02, blouseLen: 0.16, cuffLen: 0.045, cuffEase: 0.005, sash: true, cuff: true }),
  // (open at the hem, falling past the ankle onto the foot and to the floor)
  wideTrousers: Object.freeze({ slack: 0.03, taper: 0.03, margin: 0.004, folds: 9, fold: 0.009, hem: 'fall', floor: 0.012, sash: true, cuff: false }),
});
/** the colours of the groups the drape adds, for a palette that names none */
export const LOOSE_TONES = Object.freeze({ Sash: '#24407a', Cuff: '#24407a' });

/** The wide trousers (see the head of this file). */
export function loosePants(recipe, R, build, map, spec = 'martialPants', { id = 'martialPants', group = 'Bottom' } = {}) {
  const F = { ...(typeof spec === 'string' ? LOOSE_GARMENTS[spec] : spec) };
  const { parts } = fieldGarment(recipe, R, build, map, { id, ...FIELD_GARMENTS.trousers, limit: {}, group });
  for (const S of ['R', 'L']) {
    const thigh = parts[`${id}_thigh${S}`], shank = parts[`${id}_shank${S}`];
    if (!thigh || !shank) continue;
    drapeRun([thigh, shank], S === 'R' ? 1 : -1, F);
    parts[`${id}_leg${S}`] = F.hem === 'fall' ? fallToFloor(oneTube(thigh, shank), recipe, S, F) : oneTube(thigh, shank);
    delete parts[`${id}_thigh${S}`]; delete parts[`${id}_shank${S}`];
  }
  const out = { ...parts };
  if (F.cuff) for (const S of ['R', 'L']) {
    const P = parts[`${id}_leg${S}`]; if (!P) continue;
    const band = bandAt(P, P.stations.length - 1, { width: F.cuffLen * 0.8, lift: 0.003 }); if (band) out[`${id}Cuff_leg${S}`] = { ...band, group: 'Cuff' };
  }
  if (F.sash && parts[`${id}_pelvis`]) Object.assign(out, sashOn(parts[`${id}_pelvis`], parts, id));
  return { parts: out, tones: LOOSE_TONES };
}







