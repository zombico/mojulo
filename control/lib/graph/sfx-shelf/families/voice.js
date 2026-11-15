/**
 * families/voice — the voice protoform: a person's efforts (the jump's hup, a hit's grunt, a heavy hit's cry,
 * landing's oof, an attack's shout, a strain) composed for any voice from its dials, never recorded voice by voice.
 * Breathing is left out for now (the operator's call, 2026-11-12). Pure.
 *
 * A voice is a source and a filter, as a bird's is (the kernel's `syrinx`): a glottal buzz at the speaker's pitch,
 * shaped by the vocal tract's resonances (the vowel's formants), with breath through the same tract. What changes
 * from a child to a giant is a few numbers:
 *   body     the tract's length (a child's 12.5 cm to a giant's 21): every formant scales by 17 / length, and the pitch
 *   sex      a woman's tract shorter (formants ×1.14) and her pitch higher
 *   age      a young voice steadier and a little higher, an old one shakier and lower
 *   rough    the doubled period and the fry under it (a smoker's, a brute's)
 *   breathy  how much breath rides on the voice
 *
 * An effort is four layers (the realistic register's): the onset (an aspirated h, or a glottal catch), the voiced
 * vowel on its pitch contour, the chest's push (a low thump), the breath out after it; a pressed one (a cry, a strain)
 * a fifth, its hiss through the upper tract.
 */

const r3 = (v) => Math.round(v * 1000) / 1000;
const st = (hz, semis) => Math.round(hz * 2 ** (semis / 12));
// a pitch as the nearest note (a thump takes notes)
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteOf = (hz) => { const m = Math.round(69 + 12 * Math.log2(hz / 440)); return `${NOTES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`; };

// the vowels' formants, an adult male's (Hz): F1, F2, F3
const VOWEL = { a: [730, 1090, 2440], o: [570, 840, 2410], u: [300, 870, 2240], e: [530, 1840, 2480], uh: [640, 1190, 2390], i: [270, 2290, 3010] };
const TRACT = { child: 12.5, small: 15, medium: 17, large: 18.5, giant: 21 };
const PITCH = {
  male: { child: 270, small: 150, medium: 115, large: 95, giant: 75 },
  female: { child: 285, small: 235, medium: 210, large: 185, giant: 150 },
};
const AGE = { young: { f: 1.05, jitter: 0.01 }, adult: { f: 1, jitter: 0.015 }, old: { f: 0.93, jitter: 0.04 } };
const ROUGH = { smooth: { sub: 0, rattle: 0 }, rough: { sub: 0.25, rattle: 0.15 }, gravel: { sub: 0.5, rattle: 0.35 } };
const BREATHY = { clear: 0.15, breathy: 0.45 };

// an effort: its vowel (or two, the first opening into the second), its length, its pitch over its speaking pitch
// (a lift: efforts are said higher), its contour [t, semitones], its decay, its onset (h | catch), how hard the chest
// pushes, and what it presses (more doubled period, more rattle)
const EFFORTS = {
  jump: { vowel: 'uh', dur: 0.13, lift: 1.25, contour: [[0, 2], [0.3, 4], [1, -1]], decay: 4, onset: 'h', chest: 0.25 },
  hurt: { vowel: 'uh', dur: 0.18, lift: 1.35, contour: [[0, 3], [0.2, 5], [1, -4]], decay: 3, onset: 'catch', chest: 0.35, press: 0.2 },
  'hurt-heavy': { vowel: 'a', to: 'uh', dur: 0.45, lift: 1.5, contour: [[0, 5], [0.25, 7], [1, -6]], onset: 'catch', chest: 0.45, press: 0.3, release: 0.4 },
  land: { vowel: 'o', to: 'u', dur: 0.14, lift: 1.1, contour: [[0, 0], [1, -5]], decay: 5, onset: 'h', chest: 0.5 },
  attack: { vowel: 'a', dur: 0.22, lift: 1.6, contour: [[0, 4], [0.2, 6], [1, 1]], decay: 2.5, onset: 'h', chest: 0.35 },
  strain: { vowel: 'u', dur: 0.6, lift: 1.2, contour: [[0, 0], [0.5, 2], [1, 1]], onset: 'catch', chest: 0.2, press: 0.3, release: 0.3 },
};

/** The voice's numbers from its dials: its formant scale, its pitch, its steadiness, its roughness, its breath. */
export function voiceOf({ body = 'medium', sex = 'male', age = 'adult', rough = 'smooth', breathy = 'clear' } = {}) {
  const A = AGE[age], R = ROUGH[rough];
  return { fs: (17 / TRACT[body]) * (sex === 'female' ? 1.14 : 1), f0: PITCH[sex][body] * A.f, jitter: A.jitter, sub: R.sub, rattle: R.rattle, noise: BREATHY[breathy] };
}

const formantsOf = (vowel, to, fs, widths = [0.22, 0.25, 0.3], gains = [1, 0.6, 0.3]) => VOWEL[vowel].map((f, k) => {
  const a = Math.round(f * fs);
  return to ? { path: [[0, a], [0.35, a], [1, Math.round(VOWEL[to][k] * fs)]], width: widths[k], gain: gains[k] } : { hz: a, width: widths[k], gain: gains[k] };
});

export const voice = {
  label: 'a person\'s efforts, for any voice: a jump\'s hup, a hit\'s grunt, a heavy hit\'s cry, landing\'s oof, an attack\'s shout, a strain',
  dials: {
    effort: Object.keys(EFFORTS),
    body: Object.keys(TRACT),
    sex: ['male', 'female'],
    age: Object.keys(AGE),
    rough: Object.keys(ROUGH),
    breathy: Object.keys(BREATHY),
  },
  defaults: { effort: 'jump', body: 'medium', sex: 'male', age: 'adult', rough: 'smooth', breathy: 'clear' },
  // a bigger body is a longer tract and a lower voice: it sounds darker
  ordered: [{ dial: 'body', values: ['child', 'giant'], falls: ['centroidHz'] }],
  build(d) {
    const E = EFFORTS[d.effort], V = voiceOf(d);
    const f0 = Math.round(V.f0 * E.lift), press = E.press ?? 0;
    const pitch = E.contour.map(([t, s]) => [t, st(f0, s)]);
    const onset = E.onset === 'h'
      ? { type: 'burst', decay: 0.05, highpass: 1200, lowpass: 8000, vol: r3(0.4 + V.noise * 0.2) }
      : { type: 'burst', decay: 0.012, highpass: 1500, lowpass: 9000, vol: 0.4 };
    const voiced = {
      type: 'syrinx', at: E.onset === 'h' ? 0.03 : 0.004, dur: E.dur, pitch, formants: formantsOf(E.vowel, E.to, V.fs),
      // (a pressed cry carries more breath: the harder it presses, the more air rides on the voice)
      sub: r3(Math.min(1, V.sub + press)), jitter: V.jitter, noise: r3(V.noise + press * 0.5),
      ...(V.rattle + press > 0 ? { rattle: { rate: 38, depth: r3(Math.min(1, V.rattle + press)) } } : {}),
      attack: 0.012, ...(E.decay ? { decay: E.decay } : { release: E.release ?? 0.3 }), vol: 0.55,
    };
    const chest = { type: 'thump', from: noteOf(f0 * 0.9), to: noteOf(f0 * 0.55), decay: r3(Math.min(0.25, E.dur * 0.8)), vol: E.chest, at: voiced.at };
    // (the breath after it reaches up through the tract's upper resonances: an exhale's hiss as well as its body)
    const after = { type: 'burst', decay: r3(Math.max(0.08, E.dur * 0.5)), lowpass: 8000, highpass: 1200, vol: r3(0.2 + press * 0.3 + V.noise * 0.2), at: r3(voiced.at + E.dur * 0.7) };
    // a pressed effort's strain: breath hissing through the upper tract while the voice holds (the cry's edge)
    const strain = press ? [{ type: 'syrinx', at: voiced.at, dur: E.dur, pitch: [[0, f0], [1, f0]], buzz: 0, noise: 1,
      formants: [{ hz: Math.round(4200 * V.fs), width: 0.7, gain: 1 }], attack: 0.02, release: E.release ?? 0.3, vol: r3(0.1 + press * 0.35) }] : [];
    return [onset, voiced, chest, after, ...strain];
  },
};
