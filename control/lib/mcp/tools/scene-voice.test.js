// Isolate to an in-memory SQLite and a scratch outcomes folder (recordings are kept there)
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const DIR = mkdtempSync(path.join(tmpdir(), 'scene-voice-'));
process.env.SQLITE_PATH = ':memory:';
process.env.MOJULO_SEMANTIC_INDEX_DISABLED = '1';
process.env.MOJULO_OUTCOMES_DIR = path.join(DIR, 'outcomes');

import { describe, it, expect } from 'vitest';
import { writeWavMono } from '@/lib/graph/beats/beats-song-dsp.js';
import { actScene } from '@/lib/graph/actor/scene.js';
import { coverScene } from '@/lib/graph/actor/coverage.js';
import { bindScreenplayVoice, voiceTrack, voiceCaptions, screenClock, VOICE_RATE } from './scene-voice.js';

// the door's side of a scene's recorded lines: WAVs bound and kept, laid on the screen clock, captioned. The WAVs are
// tones a few syllables long (a recording's timing falls back to its loudness where its words cannot be aligned).
const wav = (name, seconds, hz = 220) => {
  const sr = 16000, d = new Float32Array(Math.round(seconds * sr));
  for (let i = 0; i < d.length; i++) d[i] = 0.3 * Math.sin((2 * Math.PI * hz * i) / sr) * (Math.floor(i / (sr * 0.18)) % 2 ? 0.2 : 1);
  const at = path.join(DIR, `${name}.wav`);
  writeFileSync(at, writeWavMono(d, sr));
  return at;
};
const sp = { cast: { ana: {}, ben: {} }, script: 'ANA: Ready for this?\nBEN: Ready.\nANA: Then go.' };

describe('a screenplay\'s recordings', () => {
  it('are bound and kept by line number, a bound one taken again while it is held', () => {
    const { voice, advice } = bindScreenplayVoice({ ...sp, voice: { 1: wav('a', 1.6), 3: { audio: wav('c', 0.9), text: 'Then go.' } } });
    expect(Object.keys(voice)).toEqual(['1', '3']);
    expect(voice[1].recording).toMatch(/^[0-9a-f]{16}$/);
    expect(voice[1].seconds).toBeCloseTo(1.6, 2);
    expect(voice[1].text).toBe('Ready for this?');
    expect(advice).toEqual([]);
    expect(existsSync(path.join(DIR, 'outcomes', 'recordings', `${voice[1].recording}.wav`))).toBe(true);
    expect(bindScreenplayVoice({ ...sp, voice }).voice).toEqual(voice);
  });

  it('refuses a line the script does not have, a file that is no WAV, and a recording no longer held', () => {
    expect(() => bindScreenplayVoice({ ...sp, voice: { 4: wav('d', 1) } })).toThrow(/3 spoken lines, numbered 1 to 3/);
    expect(() => bindScreenplayVoice({ ...sp, voice: { 1: 'a.mp3' } })).toThrow(/a \.wav file's path/);
    expect(() => bindScreenplayVoice({ ...sp, voice: { 1: { recording: 'ffffffffffffffff', seconds: 1 } } })).toThrow(/not held here/);
    expect(() => bindScreenplayVoice({ ...sp, dub: { French: { 1: wav('e', 1) } } })).toThrow(/a language tag/);
  });

  it('advises a recording made for other words', () => {
    const { advice } = bindScreenplayVoice({ ...sp, voice: { 2: { audio: wav('b', 0.6), text: 'Not yet.' } } });
    expect(advice.map((a) => [a.id, a.line])).toEqual([['voice-words', 2]]);
  });
});

describe('the voice track and the captions', () => {
  const { voice, dub } = bindScreenplayVoice({ ...sp, voice: { 1: wav('t1', 1.2), 2: wav('t2', 0.5) }, dub: { fr: { 1: { audio: wav('f1', 1.4, 330), text: 'Prête ?' } } } });
  const S = actScene({ ...sp, voice }), C = coverScene(S);

  it('lays each recording where its line is, on the screen clock', () => {
    const T = voiceTrack(S, C, { voice });
    expect(T.rate).toBe(VOICE_RATE);
    expect(T.placed.map((p) => p.at)).toEqual([S.turns[0].at, S.turns[1].at]);
    const at = Math.round(S.turns[1].at * VOICE_RATE) + 100;
    expect(Math.abs(T.samples[at])).toBeGreaterThan(0);
    expect(T.seconds).toBeCloseTo(S.seconds, 1);
    expect(screenClock(S, C)(3.2)).toBe(3.2);
  });

  it('captions each line, a dub in its own words', () => {
    const cap = voiceCaptions(S, C, { dub: dub.fr });
    expect(cap.cues[0].text).toBe('ANA: Prête ?');
    expect(cap.cues[2].text).toBe('ANA: Then go.');
    expect(cap.srt).toMatch(/^1\n00:00:00,500 --> /);
  });
});
