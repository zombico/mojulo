/**
 * front-stage — the START SCREEN's stage: the front's `stage`, a visual artifact laid out by a front card
 * (playscape/ui/front-cards/) from the game's own subjects. The shell page is the game's launcher: it opens before any
 * of the engine loads, so the stage is pictures of the subjects (a still at the card's pose, made graphic by a
 * treatment) or, in the high-end mode, the same subjects live in one small canvas loaded after the pictures. Never a
 * level, a world or a set.
 *
 *   front.stage: {
 *     composition: '<front card id>',          the layout (hero-pose, …)
 *     subjects?:   ['<role>' | '<sketch ref>', …]   what stands in the card's slots, in order: a role (hero, ally, foe,
 *                                              ride, prop) is the game's own, found when the game is resolved; a ref
 *                                              is that sketch. Absent: each slot takes the game's first subject of
 *                                              one of its roles (gameworld/front-stage.js frontSubjects)
 *     mode?:       'still' | '3d'               still (the default): pictures, no WebGL on the start screen; 3d: the
 *                                              pictures first, the live subjects over them once loaded
 *     treatment?:  '<treatment>'                how a picture is made graphic (STAGE_TREATMENTS); the theme's, else
 *                                              a cut-out
 *   }
 *
 *   STAGE_KEYS · STAGE_MODES · STAGE_TREATMENTS
 *   readFrontStage(stage, { where }) → errors[] (teaching); shape and card only (a role or a ref resolves later)
 *
 * Pure but for the cards it reads.
 */
import { FRONT_CARDS, FRONT_CARD_IDS, SUBJECT_ROLES } from '../playscape/ui/front-cards/loader.js';

export const STAGE_KEYS = Object.freeze(['composition', 'subjects', 'mode', 'treatment']);
export const STAGE_MODES = Object.freeze(['still', '3d']);
// a picture made graphic: the alpha with a rim in the accent; the theme's ink and accent; a dot screen; an inked edge;
// a few flat tones; the shape alone, filled
export const STAGE_TREATMENTS = Object.freeze(['cutout', 'duotone', 'halftone', 'ink', 'posterize', 'silhouette']);
const REF = /^[A-Za-z0-9_-]{1,64}$/;
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function readFrontStage(stage, { where = 'front.stage' } = {}) {
  const errors = [];
  if (!isObj(stage)) return [`${where} is { composition, subjects?, mode?, treatment? }: the start screen laid out from the game's own subjects`];
  for (const k of Object.keys(stage)) if (!STAGE_KEYS.includes(k)) errors.push(`${where}.${k}: not part of a stage (${STAGE_KEYS.join(', ')})`);
  const card = FRONT_CARDS[stage.composition];
  if (!card) errors.push(`${where}.composition is a front card: ${FRONT_CARD_IDS.join(', ')}`);
  if (stage.subjects !== undefined) {
    const S = stage.subjects;
    if (!Array.isArray(S) || !S.length || !S.every((s) => typeof s === 'string' && REF.test(s))) errors.push(`${where}.subjects is a list of roles (${SUBJECT_ROLES.join(', ')}) or sketch refs`);
    else if (card && S.length > card.slots.length) errors.push(`${where}.subjects: ${card.id} stands ${card.slots.length} subject${card.slots.length > 1 ? 's' : ''}`);
    else if (card) S.forEach((s, i) => {
      if (SUBJECT_ROLES.includes(s) && !card.slots[i].roles.includes(s)) errors.push(`${where}.subjects[${i}]: ${card.id}'s slot ${i + 1} stands a ${card.slots[i].roles.join(' or ')}, not a ${s}`);
    });
  }
  if (stage.mode !== undefined && !STAGE_MODES.includes(stage.mode)) errors.push(`${where}.mode is one of: ${STAGE_MODES.join(', ')} (still: pictures only; 3d: the live subjects over them)`);
  if (stage.treatment !== undefined && !STAGE_TREATMENTS.includes(stage.treatment)) errors.push(`${where}.treatment is one of: ${STAGE_TREATMENTS.join(', ')}`);
  return errors;
}
