import { describe, it, expect } from 'vitest';
import { sfxSound } from './resolve.js';
import { SOUNDS, SOUND_IDS } from './roster.js';
import { STYLES, STYLE_NAMES } from './styles.js';
import { SETS } from './sets.js';
import { SFX_PALETTES } from '../beats/sfx-palettes.js';

// one case per path a voice is found by, each chosen from the shelf in code
// (a palette row may have voices of its own too, the mouth's: its palette answers in a palette style, not a stand-in)
const voicedRow = SOUND_IDS.find((id) => SOUNDS[id].voices && SOUNDS[id].family && !SOUNDS[id].palette);
const ownStyle = Object.keys(SOUNDS[voicedRow].voices)[0];
const paletteRow = SOUND_IDS.find((id) => SOUNDS[id].palette);
const paletteStyle = STYLE_NAMES.find((s) => STYLES[s].palette);
const fallbackStyle = STYLE_NAMES.find((s) => STYLES[s].fallback);
const orphan = SOUND_IDS.find((id) => SOUNDS[id].voices && SOUNDS[id].family === null);
const channelRow = SOUND_IDS.find((id) => SOUNDS[id].channel);

describe('sfxSound: a sound by its word, in a style', () => {
  it('a row\'s own voice in its style comes from its set', () => {
    const set = SOUNDS[voicedRow].voices[ownStyle];
    expect(sfxSound(voicedRow, { style: ownStyle })).toEqual({ id: voicedRow, style: ownStyle, from: `set:${set}`, gestures: SETS[set].cues[voicedRow] });
  });

  it('a palette row in a palette style is the palette\'s own cue', () => {
    expect(sfxSound(paletteRow, { style: paletteStyle })).toEqual({ id: paletteRow, style: paletteStyle, from: `palette:${paletteStyle}`, gestures: SFX_PALETTES[paletteStyle][paletteRow] });
  });

  it('a voiced row in a style it has no voice in stands in as its family', () => {
    const fam = SOUNDS[voicedRow].family;
    expect(sfxSound(voicedRow, { style: paletteStyle })).toEqual({ id: voicedRow, style: paletteStyle, from: `palette:${paletteStyle}`, gestures: SFX_PALETTES[paletteStyle][fam], family: fam });
  });

  it('a row with no voice in a style takes the style\'s fallback', () => {
    const fb = STYLES[fallbackStyle].fallback;
    expect(sfxSound(paletteRow, { style: fallbackStyle })).toEqual({ id: paletteRow, style: fb, from: `palette:${fb}`, gestures: SFX_PALETTES[fb][paletteRow] });
  });

  it('a row with no family is unvoiced where it has no voice; a code-synthesized row names its channel, and its voice', () => {
    expect(sfxSound(orphan, { style: paletteStyle })).toBeNull();
    expect(sfxSound(channelRow, { style: paletteStyle })).toEqual({ id: channelRow, channel: SOUNDS[channelRow].channel });
    expect(sfxSound(channelRow)).toMatchObject({ id: channelRow, channel: SOUNDS[channelRow].channel, style: 'realistic' });
  });

  it('the default style is realistic; an unknown word is null; an unknown style throws', () => {
    expect(sfxSound(voicedRow)).toEqual(sfxSound(voicedRow, { style: 'realistic' }));
    expect(sfxSound('no such sound')).toBeNull();
    expect(() => sfxSound(voicedRow, { style: 'baroque' })).toThrow(/one of/);
  });

  it('law: every cue row answers in every style, but a family-less row in a style it has no voice in', () => {
    const silent = [];
    for (const id of SOUND_IDS.filter((i) => !SOUNDS[i].channel)) for (const style of STYLE_NAMES) {
      const own = SOUNDS[id].voices?.[style] || (SOUNDS[id].voices?.[STYLES[style].fallback]);
      const s = sfxSound(id, { style });
      if (!s && (SOUNDS[id].family || own)) silent.push(`${id}@${style}`);
      if (s) expect((Array.isArray(s.gestures) && s.gestures.length > 0) || (s.sustain && s.sustain.layers.length > 0)).toBe(true);
    }
    expect(silent).toEqual([]);
  });
});
