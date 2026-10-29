// recordings: a performance's recorded lines kept as mojulo's own outcome, content-addressed, and timed by their
// engine, their text aligned to them, or their loudness. The concepts: the WAV read as written (any depth, any channels);
// the same audio one recording; a line bound three ways by what it carries; a beat's bad audio refused by its name.
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { decodeWav, saveRecording, readRecording, bindLine, bindPerformance, recordingDir } from './recordings.js';
import { alignText, voicedSpans, loudness } from './align.js';
import { speak } from './speech.js';
import { performanceErrors } from './perform.js';

/** a WAV of `parts` ([seconds, loud?] each: a tone or silence) at `rate`, 16-bit, `channels` */
function wav(parts, { rate = 16000, channels = 1, bits = 16 } = {}) {
  const n = parts.reduce((t, [s]) => t + Math.round(s * rate), 0), step = (bits / 8) * channels, data = Buffer.alloc(n * step);
  let i = 0;
  for (const [s, loud] of parts) for (let k = 0; k < Math.round(s * rate); k++, i++) {
    const v = loud ? 0.5 * Math.sin((2 * Math.PI * 220 * i) / rate) : 0;
    for (let c = 0; c < channels; c++) { const o = i * step + c * (bits / 8); if (bits === 16) data.writeInt16LE(Math.round(v * 32767), o); else data.writeFloatLE(v, o); }
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(bits === 32 ? 3 : 1, 20); h.writeUInt16LE(channels, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * step, 28); h.writeUInt16LE(step, 32); h.writeUInt16LE(bits, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}
// (a line of three phrases, spoken: the voice, a pause, the voice, a pause, the voice)
const SPOKEN = [[0.2, false], [0.6, true], [0.35, false], [0.5, true], [0.4, false], [0.7, true], [0.3, false]];

let dir, prev;
beforeAll(() => { dir = mkdtempSync(path.join(tmpdir(), 'mojulo-rec-')); prev = process.env.MOJULO_OUTCOMES_DIR; process.env.MOJULO_OUTCOMES_DIR = path.join(dir, 'outcomes'); });
afterAll(() => { if (prev === undefined) delete process.env.MOJULO_OUTCOMES_DIR; else process.env.MOJULO_OUTCOMES_DIR = prev; rmSync(dir, { recursive: true, force: true }); });
const file = (name, bytes) => { const at = path.join(dir, name); writeFileSync(at, bytes); return at; };

describe('a recording', () => {
  it('reads a WAV as written, mixed to one channel, whatever its depth', () => {
    const a = decodeWav(wav([[0.1, true]], { channels: 2 })), b = decodeWav(wav([[0.1, true]], { bits: 32 }));
    expect(a.sampleRate).toBe(16000); expect(a.channels).toBe(2); expect(a.samples.length).toBe(1600);
    expect(Math.max(...a.samples)).toBeCloseTo(0.5, 2); expect(Math.max(...b.samples)).toBeCloseTo(0.5, 4);
    expect(() => decodeWav(Buffer.from('not a wav at all'))).toThrow(/WAV/);
  });
  it('is kept by its content: the same audio one recording, held where the outcomes are', () => {
    const r = saveRecording(file('a.wav', wav(SPOKEN))), again = saveRecording(file('b.wav', wav(SPOKEN)));
    expect(r.id).toMatch(/^[0-9a-f]{16}$/); expect(again.id).toBe(r.id);
    expect(existsSync(path.join(recordingDir(), `${r.id}.wav`))).toBe(true);
    expect(readRecording(r.id).equals(wav(SPOKEN))).toBe(true); expect(readRecording('0123456789abcdef')).toBe(null);
    expect(r.seconds).toBeCloseTo(3.05, 3);
  });
});

describe('a recorded line, bound', () => {
  it('keeps the engine\'s own timings when they lie beside the audio', () => {
    const at = file('engine.wav', wav(SPOKEN));
    writeFileSync(at.replace(/\.wav$/, '.timings.json'), JSON.stringify({ phonemes: [{ p: 'h', t: 0.2, dur: 0.1 }, { p: 'aɪ', t: 0.3, dur: 0.3 }] }));
    const say = bindLine({ text: 'Hi.', audio: at });
    expect(say).toMatchObject({ timing: 'engine', recording: expect.stringMatching(/^[0-9a-f]{16}$/), phonemes: [{ p: 'h' }, { p: 'aɪ' }] });
    expect(say.audio).toBeUndefined();
  });
  it('aligns its text to it: the pauses on its silences, the words inside the voice', () => {
    const say = bindLine({ text: 'One, two. Three.', audio: file('narrated.wav', wav(SPOKEN)) }), spans = voicedSpans(decodeWav(wav(SPOKEN)).samples, 16000);
    expect(say.timing).toBe('aligned'); expect(spans).toHaveLength(3);
    const sil = say.phonemes.filter((q) => q.p === 'sil');
    expect(sil).toHaveLength(2);
    for (const [k, q] of sil.entries()) { expect(q.t).toBeCloseTo(spans[k][1], 1); expect(q.t + q.dur).toBeCloseTo(spans[k + 1][0], 1); }
    for (const [k, w] of say.words.entries()) { expect(w.t).toBeGreaterThanOrEqual(spans[k][0] - 1e-6); expect(w.t + w.dur).toBeLessThanOrEqual(spans[k][1] + 1e-6); }
    // (and the face speaks it: the mouth open in the voice, shut in its pauses)
    const T = speak(say), open = (t) => T.curves.AU25[Math.round(t * T.fps)];
    expect(open((spans[1][0] + spans[1][1]) / 2)).toBeGreaterThan(0.1);
    expect(open((spans[0][1] + spans[1][0]) / 2)).toBeLessThan(0.05);
  });
  it('opens the mouth with its loudness when no word is known', () => {
    const say = bindLine({ audio: file('hum.wav', wav(SPOKEN)) }), T = speak(say), spans = voicedSpans(decodeWav(wav(SPOKEN)).samples, 16000);
    expect(say.timing).toBe('loudness'); expect(say.envelope.fps).toBe(loudness(new Float32Array(1), 16000).fps);
    expect(T.curves.AU26[Math.round(((spans[0][0] + spans[0][1]) / 2) * T.fps)]).toBeGreaterThan(0.2);
    expect(T.curves.AU26[Math.round(0.05 * T.fps)]).toBeLessThan(0.02);
  });
  it('refuses, naming the beat, audio it cannot read; and a performance holds no path', () => {
    expect(() => bindPerformance({ perform: { line: { beats: [{ at: 0, face: 'neutral' }, { at: 1, face: 'neutral', say: { text: 'Hi.', audio: path.join(dir, 'none.wav') } }] } } })).toThrow(/^perform\.line\.beats\[1\]\.say\.audio/);
    expect(performanceErrors({ beats: [{ at: 0, face: 'neutral', say: { text: 'Hi.', audio: 'x.wav' } }] }).join()).toMatch(/saved by the door/);
    // (aligned text with no voice in it: the rules' own timeline, nothing lost)
    expect(alignText('Hi.', new Float32Array(1600), 16000).phonemes.length).toBeGreaterThan(0);
  });
});
