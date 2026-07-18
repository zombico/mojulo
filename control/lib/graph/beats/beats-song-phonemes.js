/**
 * beats-song-phonemes.js — katakana → mora sequence for the parametric engine.
 *
 * The enunciation layer's front half: decompose an authored katakana string into
 * moras carrying their CONSONANT and VOWEL, so the synth can articulate real
 * consonants (s/t/k/m/…) at every position, not just fake a hiss at the front.
 * Pure text, no audio. Consumes the L5 output (beats-song-lyrics.js); feeds the
 * consonant synthesis in beats-song-voice-parametric.js.
 *
 * A mora is `{ cons, vowel, coda, geminate }`:
 *   cons     — onset consonant key ('' for a bare vowel), e.g. 's','sh','t','k','n'
 *   vowel    — nucleus katakana ('ア'|'イ'|'ウ'|'エ'|'オ')
 *   coda     — trailing moraic nasal 'n' (from ン) or null
 *   geminate — true if a sokuon (ッ) precedes it (a held/closed stop)
 */

// vowel column order for the 50-on grid
const VOWELS = ['ア', 'イ', 'ウ', 'エ', 'オ'];

// consonant rows: [consonant key, the five kana a/i/u/e/o] ('〓' = irregular, set below)
const ROWS = [
  ['', 'アイウエオ'],
  ['k', 'カキクケコ'], ['g', 'ガギグゲゴ'],
  ['s', 'サ〓スセソ'], ['z', 'ザ〓ズゼゾ'],
  ['t', 'タ〓〓テト'], ['d', 'ダ〓〓デド'],
  ['n', 'ナニヌネノ'],
  ['h', 'ハヒ〓ヘホ'], ['b', 'バビブベボ'], ['p', 'パピプペポ'],
  ['m', 'マミムメモ'],
  ['y', 'ヤ〓ユ〓ヨ'],
  ['r', 'ラリルレロ'],
  ['w', 'ワ〓〓〓ヲ'],
];

// kana → { cons, vowel }
export const KANA_CV = {};
for (const [cons, kana] of ROWS) {
  for (let i = 0; i < 5; i++) {
    const ch = kana[i];
    if (ch && ch !== '〓') KANA_CV[ch] = { cons, vowel: VOWELS[i] };
  }
}
// irregular syllables (palatalized / affricate / fricative rows)
Object.assign(KANA_CV, {
  シ: { cons: 'sh', vowel: 'イ' }, ジ: { cons: 'j', vowel: 'イ' },
  チ: { cons: 'ch', vowel: 'イ' }, ツ: { cons: 'ts', vowel: 'ウ' },
  フ: { cons: 'f', vowel: 'ウ' }, ヂ: { cons: 'j', vowel: 'イ' }, ヅ: { cons: 'z', vowel: 'ウ' },
});

// small (combining) kana
const SMALL_VOWEL = { ァ: 'ア', ィ: 'イ', ゥ: 'ウ', ェ: 'エ', ォ: 'オ' };
const SMALL_YOON = { ャ: 'ア', ュ: 'ウ', ョ: 'オ' };   // palatal glide onto a/u/o

/**
 * Decompose a katakana string into an ordered mora list. Small vowels merge onto
 * the previous mora (トゥ → t+u); yōon (ャュョ) palatalize the previous consonant
 * (キャ → ky+a; standalone → y-glide); ッ marks the next mora geminate; ン becomes
 * a coda on the previous mora (or a standalone nasal); ー is dropped (elongation
 * is already expanded upstream).
 */
export function romanizeKata(kata) {
  const moras = [];
  let pendingGeminate = false;
  for (const ch of String(kata)) {
    if (ch === 'ー') continue;                      // chōonpu — no new mora
    if (ch === 'ッ') { pendingGeminate = true; continue; }
    if (ch === 'ン') {                              // moraic nasal → coda on the previous mora
      if (moras.length) moras[moras.length - 1].coda = 'n';
      else moras.push({ cons: 'n', vowel: 'ウ', coda: null, geminate: false });
      continue;
    }
    if (SMALL_VOWEL[ch]) {                          // merge onto previous (トゥ, ディ)
      if (moras.length) moras[moras.length - 1].vowel = SMALL_VOWEL[ch];
      else moras.push({ cons: '', vowel: SMALL_VOWEL[ch], coda: null, geminate: false });
      continue;
    }
    if (SMALL_YOON[ch]) {                           // palatalize previous, else y-glide
      const v = SMALL_YOON[ch];
      if (moras.length) { const prev = moras[moras.length - 1]; prev.vowel = v; prev.cons = prev.cons ? prev.cons + 'y' : 'y'; }
      else moras.push({ cons: 'y', vowel: v, coda: null, geminate: false });
      continue;
    }
    const cv = KANA_CV[ch];
    if (!cv) continue;                              // unknown glyph — skip rather than choke
    moras.push({ cons: cv.cons, vowel: cv.vowel, coda: null, geminate: pendingGeminate });
    pendingGeminate = false;
  }
  if (!moras.length) moras.push({ cons: '', vowel: 'ア', coda: null, geminate: false });
  return moras;
}
