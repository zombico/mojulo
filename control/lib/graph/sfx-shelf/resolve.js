/**
 * sfx-shelf/resolve — a sound by its word, in a style. Pure.
 *
 *   sfxSound('beam rifle', { style: 'realistic' })  → { id: 'beam-rifle-shot', style: 'realistic', from: 'set:mecha-layered', gestures }
 *   sfxSound('beam rifle', { style: 'arcade' })     → the arcade palette's `shoot` (its family), from 'palette:arcade'
 *   sfxSound('thruster')                            → { id: 'thruster-roar', channel: 'thruster', sustain, … } (its code's slot,
 *                                                     and the held voice that ports it)
 *   sfxSound('car engine')                          → { id: 'car-engine', sustain } (a held voice: a spec, not gestures)
 *   sfxSound('explosion', { dials: { size: 'huge' } }) → the explosion family's build at size huge (from 'family:explosion')
 *
 * The order a voice is looked for, the first that answers winning: the row's own voice in the style (a set's cue, or its
 * family's build at its dial preset and the caller's `dials`); the
 * palette's, when the row is a palette cue and the style a palette; its family's, in the style; then the same row in
 * the style's fallback (realistic → foley). An overlay style (`mouth`) has only its own voices: a row it does not voice
 * is its fallback's (realistic's) as that style would find it, stand-ins included. A row no step voices is null in that style (a charge-up has no arcade
 * voice yet). The gestures are the set's or the palette's own, untransposed: a game's key is its caller's business
 * (sfx-palettes.js paletteCues).
 */
import { SFX_PALETTES } from '../beats/sfx-palettes.js';
import { STYLES } from './styles.js';
import { SETS } from './sets.js';
import { SOUNDS, resolveSoundId } from './roster.js';
import { FAMILIES, familyCue } from './families.js';

function voiceOf(id, style, seen, dials) {
  const key = `${id}|${style}`;
  if (seen.has(key)) return null;
  seen.add(key);
  const row = SOUNDS[id], S = STYLES[style];
  const set = row.voices && row.voices[style];
  // an overlay style (mouth) adds voices to its fallback and is otherwise that style whole: no stand-in first
  if (!set && S.overlay) {
    const v = voiceOf(id, S.fallback, seen, dials);
    return v ? { ...v, style: v.style ?? S.fallback } : null;
  }
  if (set === 'families') {
    const built = familyCue(row.make.family, { ...row.make.dials, ...dials });
    return { from: `family:${row.make.family}`, ...(FAMILIES[row.make.family].sustain ? { sustain: built } : { gestures: built }) };
  }
  if (set) return { from: `set:${set}`, gestures: SETS[set].cues[id] };
  if (row.palette && S.palette) return { from: `palette:${style}`, gestures: SFX_PALETTES[style][row.palette] };
  if (row.family && row.family !== id) {
    const v = voiceOf(row.family, style, seen, dials);
    if (v) return { ...v, family: row.family };
  }
  if (S.fallback) {
    const v = voiceOf(id, S.fallback, seen, dials);
    if (v) return { ...v, style: v.style ?? S.fallback };
  }
  return null;
}

/**
 * The sound a word names, in a style (default `realistic`): `{ id, style, from, gestures | sustain, family? }` (a held
 * voice gives its sustain spec), with `channel` too for a sound the audio channel's own code plays, or null when the
 * word names no row or no step voices it in that style. `style` on the result is the style that answered (a fallback's when it did).
 */
export function sfxSound(word, { style = 'realistic', dials = {} } = {}) {
  if (!STYLES[style]) throw new Error(`sfx style '${style}': one of ${Object.keys(STYLES).join(', ')}`);
  const id = resolveSoundId(word);
  if (!id) return null;
  const row = SOUNDS[id];
  const v = voiceOf(id, style, new Set(), dials);
  const voice = v ? { style: v.style ?? style, from: v.from, ...(v.gestures ? { gestures: v.gestures } : { sustain: v.sustain }), ...(v.family ? { family: v.family } : {}) } : null;
  if (row.channel) return { id, channel: row.channel, ...(voice || {}) };
  return voice ? { id, ...voice } : null;
}
