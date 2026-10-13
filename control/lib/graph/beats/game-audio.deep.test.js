// The deep tier of game audio: laws only a render can show (slow, so they live here; `test:deep:changed` runs them
// when the palettes, the club score or the kernel move). Machine gate only: whether it sounds right is the ears'.
import { describe, it, expect } from 'vitest';
import { SFX_PALETTE_NAMES, paletteCues } from './sfx-palettes.js';
import { clubScore, CLUB_MOODS, CLUB_MOOD_NAMES } from './club-score.js';
import { renderBeatsOffline } from './beats-render.js';
import { normalizeBeatsManifest } from './beats-manifest.js';
import { decodeWav, rms, peak } from './audio-measure.js';

describe('every action sound is heard', () => {
  it('every cue of every palette, in two keys, renders audible and unclipped', async () => {
    const quiet = [];
    for (const name of SFX_PALETTE_NAMES) for (const identity of [0, 3]) {
      const m = normalizeBeatsManifest({ kind: 'beats-sfx', title: name, cues: paletteCues(name, identity) });
      for (const cue of Object.keys(m.cues)) {
        const p = peak(decodeWav((await renderBeatsOffline(m, { cue, tail: 0.2 })).wav).channels[0]);
        if (!(p >= 0.05 && p <= 0.95)) quiet.push(`${name}/${identity}/${cue}: peak ${p.toFixed(3)}`);
      }
    }
    expect(quiet).toEqual([]);
  }, 600_000);
});

describe('a driving club loop breathes', () => {
  // bars 16–19 are the break (no kick), 8–15 and 20–27 the drops
  it("the break is quieter than either drop, measured", async () => {
    const mood = CLUB_MOOD_NAMES.find((m) => !CLUB_MOODS[m].soft && CLUB_MOODS[m].drums !== 'half');
    const m = normalizeBeatsManifest(clubScore(mood, { seed: 11, identity: 5 }));
    const ch = decodeWav((await renderBeatsOffline(m, {})).wav).channels[0];
    const bar = (240 / m.bpm) * 44100;
    const level = (a, z) => rms(ch, Math.floor(a * bar), Math.floor(z * bar));
    const brk = level(16.5, 19.5), dropA = level(8.5, 15.5), dropB = level(20.5, 27.5);
    expect(brk, `${mood}: break ${brk.toFixed(3)} vs drops ${dropA.toFixed(3)} / ${dropB.toFixed(3)}`).toBeLessThan(dropA * 0.8);
    expect(brk).toBeLessThan(dropB * 0.8);
  }, 900_000);
});
