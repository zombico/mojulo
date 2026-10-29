// speech: a line → the mouth's units over time, as a capture of a line records them. The concepts: words to phonemes by
// rule (the closures, the f's lip, the rounding kept), deterministic; every m, b and p shut; the lips round ahead of a
// rounded vowel; the rate and the articulation dials; phonemes given are spoken on their own timeline; refused by name.
import { describe, expect, it } from 'vitest';
import { phonemesOf, speak, speechErrors, arpabetOf, givenPhonemes, PHONEMES, VISEMES, SPEECH_UNITS } from './speech.js';

const frameAt = (T, t) => Math.round(t * T.fps);
const centres = (T, vis) => T.events.phonemes.filter((q) => q.viseme === vis).map((q) => q.t + q.dur / 2);

describe('the words', () => {
  it('read by rule into the phonemes the mouth shows, a content word stressed and a function word not', () => {
    const { phonemes, words } = phonemesOf('The *fish* shop, thank you.');
    expect(words.map((w) => w.w)).toEqual(['the', 'fish', 'shop', 'thank', 'you']);
    expect(words[1].emph).toBe(true);
    const of = (wi) => phonemes.filter((q) => q.word === wi).map((q) => q.p);
    expect(of(1)).toEqual(['F', 'IH', 'SH']); expect(of(2)).toEqual(['SH', 'AA', 'P']); expect(of(3)[0]).toBe('TH');
    expect(phonemes.filter((q) => q.word === 0 && q.stress !== null).every((q) => q.stress === 0)).toBe(true);
    expect(phonemes.find((q) => q.word === 2 && q.stress !== null).stress).toBe(1);
    // (a comma and a stop are pauses; the silent e lengthens the vowel before it)
    expect(phonemes.filter((q) => q.p === 'sil').length).toBe(2);
    expect(phonemesOf('time').phonemes.map((q) => q.p)).toEqual(['T', 'AY', 'M']);
  });
  it('takes a speech engine\'s IPA as its phonemes, and refuses what is no phoneme or no line by name', () => {
    expect(arpabetOf('ʃ')).toBe('SH'); expect(arpabetOf('AY1')).toBe('AY'); expect(arpabetOf('sil')).toBe('sil'); expect(arpabetOf('§')).toBe(null);
    expect(speechErrors('')[0]).toMatch(/say\.text/);
    expect(speechErrors({ phonemes: [{ p: '§' }] })[0]).toMatch(/phonemes\[0\]\.p/);
    expect(speechErrors({ text: 'hi', rate: 9 })[0]).toMatch(/say\.rate/);
    expect(() => speak({})).toThrow(/speak/);
  });
});

describe('the line spoken', () => {
  const LINE = 'Maybe we should move before the moon is up.';
  it('is deterministic, its units in range and continuous', () => {
    const T = speak(LINE);
    expect(speak(LINE)).toEqual(T);
    expect(Object.keys(T.curves)).toEqual([...SPEECH_UNITS]);
    for (const c of Object.values(T.curves)) {
      expect(c).toHaveLength(T.frames);
      for (let i = 0; i < c.length; i++) { expect(c[i]).toBeGreaterThanOrEqual(0); expect(c[i]).toBeLessThanOrEqual(1); if (i) expect(Math.abs(c[i] - c[i - 1])).toBeLessThan(0.35); }
    }
    // (it starts and ends with the mouth shut, the jaw home: the lips may already be pressing for a first m)
    for (const u of ['AU25', 'AU26']) { expect(T.curves[u][0]).toBeLessThan(0.05); expect(T.curves[u].at(-1)).toBeLessThan(0.05); }
    for (const c of Object.values(T.curves)) expect(c.at(-1)).toBeLessThan(0.05);
  });
  it('shuts the lips for every m, b and p, whatever the vowels about it', () => {
    const T = speak(LINE), ts = centres(T, 'PP');
    expect(ts.length).toBeGreaterThan(3);
    for (const t of ts) { expect(T.curves.AU25[frameAt(T, t)]).toBeLessThan(0.02); expect(T.curves.AU26[frameAt(T, t)]).toBeLessThan(0.05); }
    // (and opens them for the vowels between)
    expect(Math.max(...T.curves.AU25)).toBeGreaterThan(0.4); expect(Math.max(...T.curves.AU26)).toBeGreaterThan(0.2);
  });
  it('puts the lower lip under the teeth for an f, and rounds the lips ahead of a rounded vowel', () => {
    const F = speak('a fee'), tf = centres(F, 'FF')[0];
    expect(F.curves.AU28B[frameAt(F, tf)]).toBeGreaterThan(0.5);
    // (the oo of "stoop": the lips already rounding through the t before it, anticipation)
    const S = speak('a stoop'), ph = S.events.phonemes, t = ph.find((q) => q.p === 'T');
    expect(S.curves.AU18[frameAt(S, t.t + t.dur / 2)]).toBeGreaterThan(0.25);
    const s = ph.find((q) => q.p === 'S');
    expect(S.curves.AU18[frameAt(S, s.t + s.dur / 2)]).toBeLessThan(S.curves.AU18[frameAt(S, t.t + t.dur / 2)]);
  });
  it('speaks faster at a higher rate, wider enunciated and narrower mumbled', () => {
    expect(speak({ text: LINE, rate: 1.5 }).seconds).toBeLessThan(speak(LINE).seconds * 0.8);
    const jaw = (a) => Math.max(...speak({ text: LINE, articulation: a }).curves.AU26);
    expect(jaw(1.4)).toBeGreaterThan(jaw(1) * 1.3); expect(jaw(0.6)).toBeLessThan(jaw(1) * 0.7);
    // (an emphasized word is said longer)
    const w = (txt) => speak(txt).events.words.find((x) => x.w === 'now').dur;
    expect(w('go *now*')).toBeGreaterThan(w('go now') * 1.15);
  });
  it('speaks phonemes given on their own timeline (an audio\'s), each a viseme of the set', () => {
    const P = [{ p: 'HH', t: 0.2, dur: 0.06 }, { p: 'ə', t: 0.26, dur: 0.08 }, { p: 'L', t: 0.34, dur: 0.07 }, { p: 'OW1', t: 0.41, dur: 0.2 }];
    const T = speak({ phonemes: P });
    expect(T.events.phonemes.map((q) => [q.p, q.t])).toEqual([['HH', 0.2], ['AH', 0.26], ['L', 0.34], ['OW', 0.41]]);
    for (const q of Object.values(PHONEMES)) for (const v of q.slice(1)) if (v) expect(Object.hasOwn(VISEMES, v)).toBe(true);
    expect(T.curves.AU18[frameAt(T, 0.58)]).toBeGreaterThan(0.3);
  });
});

describe('a line an engine spoke', () => {
  // (as a speech engine times it, symbol by symbol: speak.py --timings, Kokoro's IPA with its marks)
  const ENGINE = [['h', 0.1, 0.05], ['ə', 0.15, 0.07], ['l', 0.22, 0.05], ['ˈ', 0.27, 0.07], ['o', 0.34, 0.08], ['ʊ', 0.42, 0.07], [',', 0.49, 0.03], [' ', 0.52, 0.02],
    ['m', 0.54, 0.05], ['a', 0.59, 0.05], ['ɪ', 0.64, 0.03], ['.', 0.67, 0.1]].map(([p, t, dur]) => ({ p, t, dur }));
  it('reads the engine\'s symbols as written: a pair one sound, a stress mark its vowel\'s, a space folded in, a mark a pause', () => {
    const { phonemes, bad } = givenPhonemes(ENGINE);
    expect(bad).toEqual([]);
    expect(phonemes.map((q) => q.p)).toEqual(['HH', 'AH', 'L', 'OW', 'sil', 'M', 'AY', 'sil']);
    // (the stressed vowel starts at its mark and runs through its glide; the unstressed one reduced)
    const ow = phonemes[3];
    expect(ow.t).toBe(0.27); expect(ow.dur).toBeCloseTo(0.07 + 0.08 + 0.07, 6); expect(ow.stress).toBe(1); expect(phonemes[1].stress).toBe(0);
    // (the comma's space folded into the pause before it; the times kept whole: nothing lost between them)
    const end = (q) => q.t + q.dur;
    for (let i = 1; i < phonemes.length; i++) expect(phonemes[i].t).toBeCloseTo(end(phonemes[i - 1]), 6);
    // (a typo is refused by its index; an engine's own symbol it has no reading for folded into the one before)
    expect(givenPhonemes([{ p: 'AYY' }]).bad).toEqual([0]);
    expect(givenPhonemes([{ p: 'm', t: 0, dur: 0.1 }, { p: 'ʔ', t: 0.1, dur: 0.05 }]).phonemes).toEqual([{ p: 'M', t: 0, dur: 0.15, stress: null }]);
  });
  it('speaks on the recording\'s own timeline, and names the recording', () => {
    const T = speak({ phonemes: ENGINE, audio: 'line.wav' });
    // (the closure where the engine said the m, not where the rules would)
    const m = T.events.phonemes.find((q) => q.p === 'M');
    expect(m.t).toBe(0.54); expect(T.curves.AU25[Math.round((m.t + m.dur / 2) * T.fps)]).toBeLessThan(0.02);
    expect(speechErrors({ phonemes: ENGINE, audio: 'line.txt' })[0]).toMatch(/say\.audio/);
  });
});
