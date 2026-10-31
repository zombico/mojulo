/**
 * fidelity — what of a read a host plays: the FACE or the BODY. A talking face is drawn only where the game reads in the
 * `gen-7` era (era/eras.js: the form render, a level's geocube's era, which a hero in it takes) and the speaker is a
 * realistic hero (`form: 'realistic'`, its relational head: the one skin whose lips the face's takes move). Anywhere else
 * the same read gives its audio, its captions and the body's gestures (read.js `body`). Every host asks here, so the
 * rule is one rule: a game moved to gen-7 gains its faces without a read changed.
 *
 *   speakerFidelity(game, speaker) → 'face' | 'body'
 *     game: { era } (a level's, or a read's: 'gen-6' when absent, era/eras.js DEFAULT_ERA)
 *     speaker: a hero record ({ form, head })
 */
import { DEFAULT_ERA } from '../era/eras.js';

/** the era a talking face needs, and the speaker's form */
export const FACE_ERA = 'gen-7';

export function speakerFidelity(game, speaker) {
  const era = game?.era ?? DEFAULT_ERA, realistic = speaker?.form === 'realistic' && (speaker.head ?? 'relational') === 'relational';
  return era === FACE_ERA && realistic ? 'face' : 'body';
}
