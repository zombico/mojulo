// THE HUD'S SOUNDS (docs/mana-ui.md "The UI's sounds"): a level's HUD on mana-ui heard in its look's sound set. The
// runtime emits a cue as an effect ({ sound }) on each state change it hears (a moment called: toast, a rare one: rare; a
// screen opened and closed; the cursor's move, accept and back); the level page's host (mana-hud.js) plays it with the
// beats kernel. This module says, for a look, what the page carries to do so: the set its `sounds` word names, which
// cues its `cues` word hears, the set's gestures (the recorded library's over them where it is installed), the kernel
// the set needs and the cue picker. A look whose cues are `silent`, or that names no set, is not heard: null.
import { readTheme } from '../../../mana-ui/theme.js';
import { THEME_CARDS, cardTheme } from '../../playscape/ui/theme-cards/loader.js';
import { uiSoundAudio } from '../../beats/ui-sounds.js';

/** What a level's HUD in `theme` (a preset's name, a card's, or a theme) carries to be heard: { set, cues, sounds, K, of,
 *  samples? }, or null. */
export function hudSounds(theme) {
  const t = typeof theme === 'string' && THEME_CARDS[theme] ? readTheme(cardTheme(theme)) : readTheme(theme ?? 'greybox');
  if (!t || !t.sounds || !t.cues || t.cues === 'silent') return null;
  const A = uiSoundAudio([t.sounds]);
  return { set: t.sounds, cues: t.cues, sounds: A.sets[t.sounds], K: A.source, of: A.of, ...(A.samples ? { samples: A.samples } : {}) };
}
