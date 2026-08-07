/**
 * beats-song-lyrics.js — L5 authoring layer for the singing primitive (beats-song).
 *
 * Pure text transforms: English lyric syllables → katakana, sung through the
 * Japanese Kokoro voice (the Hatsune-Miku technique). No audio, no IO, no ONNX —
 * this is the RECIPE half of a song; the DSP note engine (the formant source)
 * lives beside it and is a replaceable capability rung. Extracted verbatim in
 * behaviour from the throwaway sing spikes (spike-sing.mjs, spike-sing-baked.mjs,
 * spike-carol-elong.mjs), which proved the pipeline end-to-end. See
 * beats-song.plan.md.
 *
 * Why katakana-English: only the Japanese voice's vowels elongate cleanly. Probed
 * empirically — English orthography caps voiced length ~0.6s AND corrupts the
 * vowel (way→waaay shifts vowel quality), while Japanese long vowels via misaki
 * are near-linear with no ceiling through 2.2s. So the JA voice is the singer for
 * ALL languages, reached through katakana; the resulting "Engrish" accent is
 * ON-aesthetic for a deliberately synthetic vocaloid. See the plan's
 * "Multilingual finding (decisive)".
 *
 * The pipeline: transliterate → applyReplacers → elongateKata. `authorSyllable`
 * composes them; `authorScore` runs a whole [syllable, note, beats] score.
 */

// ── 1. TRANSLITERATE ────────────────────────────────────────────────────────
// Curated per-syllable katakana (guarantees clean diction on known words); a
// rough per-letter rule fallback covers anything not listed. Real automatic
// EN→katakana is a bigger NLP job — "table + rules" is the practical shape every
// transliterator uses. The tables are DATA so a song recipe can extend them.
export const DEFAULT_OVERRIDES = {
  twin: 'トゥイン', kle: 'カ', lit: 'リ', tle: 'タ', star: 'スター',
  how: 'ハオ', i: 'アイ', won: 'ワン', der: 'ダー', what: 'ワット', you: 'ユー', are: 'アー',
  up: 'アブ', a: 'ア', bove: 'バヴ', the: 'ザ', world: 'ワールド', so: 'ソー', high: 'ハイ',
  like: 'ライク', dia: 'ダイヤ', mond: 'モンド', in: 'イン', sky: 'スカイ',
  // tuned by ear: kle/tle → single カ/タ ("twing-ka", "lit-ta", ン auto-nasalizes to "ng");
  // how → ハオ ("hao" diphthong, not "how-a"); up → アブ ("ab", no trailing stop-vowel).
};

// Per-letter fallback for syllables not in the override table.
export const TRANSLIT_RULE = {
  a: 'ア', e: 'エ', i: 'イ', o: 'オ', u: 'ウ',
  b: 'ブ', d: 'ド', f: 'フ', g: 'グ', h: 'ハ', k: 'ク', l: 'ル', m: 'ム', n: 'ン',
  p: 'プ', r: 'ル', s: 'ス', t: 'ト', v: 'ヴ', w: 'ワ', y: 'ヤ', z: 'ズ',
};

/** Rough per-letter transliteration of an unlisted syllable (fallback only). */
export function ruleTransliterate(syl) {
  let out = '';
  for (const ch of String(syl).toLowerCase()) out += TRANSLIT_RULE[ch] || '';
  return out || 'ア';
}

// REPLACERS — ordered post-transliteration polish (loanword normalization). Can't
// escape Japanese phonotactics (no bare consonant clusters — a leading ス stays,
// though Kokoro devoices it toward "s'ta"), but trims the worst Engrish: crisper
// diction AND fewer moras → tighter timing. Each entry is [from(str|RegExp), to],
// applied in order. Tuned by ear over several spike rounds — this is the knob.
export const DEFAULT_REPLACERS = [
  [/ヴ/g, 'ブ'],                  // v → b   (bove: バヴ → バブ)
  ['スター', 'スタ'],             // star:  starru → "sta"  (drop the trailing drag)
  ['ハイー', 'ハイ'],             // high:  hiighu → "hai"  (kill over-hold before re-elongation)
  ['スカイ', 'スカイ'],           // sky:   already ~"skai"; leave (leading ス devoices)
  [/ッ?[トクプ]$/g, 'ッ'],         // clip final voiceless stop-epenthesis → one sokuon (what ワット→ワッ, up アップ→アッ, like ライク→ライッ)
];

/** Apply an ordered list of [from, to] replacers (string or RegExp `from`). */
export function applyReplacers(kata, replacers = DEFAULT_REPLACERS) {
  let out = kata;
  for (const [from, to] of replacers) {
    out = from instanceof RegExp ? out.replace(from, to) : out.split(from).join(to);
  }
  return out;
}

/**
 * English syllable → katakana. Override table first, rule fallback otherwise,
 * then the replacer polish (unless `raw`, for A/B comparison).
 */
export function transliterate(syllable, opts = {}) {
  const { overrides = DEFAULT_OVERRIDES, replacers = DEFAULT_REPLACERS, raw = false } = opts;
  const key = String(syllable).toLowerCase();
  const base = overrides[key] || ruleTransliterate(key);
  return raw ? base : applyReplacers(base, replacers);
}

// ── 2. ELONGATE (nucleus-aware) ─────────────────────────────────────────────
// katakana → its vowel kana, so a held note sustains the OPEN NUCLEUS vowel by
// repeating THAT vowel — never the chōonpu ー, which Kokoro relaxes toward a
// schwa "-yu" tail (the "stayu/hayu/skayu" artifact). Diphthongs hold the nucleus
// and keep the glide last: ハイ → ハアアアイ ("haaai", not "hayu").
export const KATA_VOWEL = {};
for (const [vowel, row] of Object.entries({
  ア: 'アカサタナハマヤラワガザダバパャァ',
  イ: 'イキシチニヒミリギジヂビピィ',
  ウ: 'ウクスツヌフムユルグズヅブプヴュゥッ',
  エ: 'エケセテネヘメレゲゼデベペェ',
  オ: 'オコソトノホモヨロゴゾドボポョォヲ',
})) for (const ch of row) KATA_VOWEL[ch] = vowel;

/** The vowel kana a katakana character resolves to (defaults to ア). */
export const vowelKana = (ch) => KATA_VOWEL[ch] || 'ア';

/**
 * Held-note elongation, nucleus-aware. Short notes (≤ `holdFloor` s) are left as
 * is; longer notes repeat the nucleus vowel ~`(durSec - base)/step` times. If the
 * syllable ends in a glide (…イ/ウ, e.g. high ハイ, sky スカイ), the nucleus is held
 * and the glide kept at the very end. Repeating the actual vowel (not ー) is what
 * fixed the schwa-tail artifact — see the plan's "Nucleus-aware elongation".
 */
export function elongateKata(kata, durSec, opts = {}) {
  const { holdFloor = 0.7, base = 0.35, step = 0.12 } = opts;
  if (durSec <= holdFloor) return kata;
  const n = Math.max(1, Math.round((durSec - base) / step));
  const stem0 = kata.replace(/ー+$/g, '');           // drop any trailing chōonpu
  const last = stem0[stem0.length - 1];
  if ((last === 'イ' || last === 'ウ') && stem0.length >= 2) {   // diphthong: hold nucleus, keep glide
    const stem = stem0.slice(0, -1);
    return stem + vowelKana(stem[stem.length - 1]).repeat(n) + last;
  }
  return stem0 + vowelKana(last).repeat(n);
}

// ── compose ─────────────────────────────────────────────────────────────────

/**
 * One syllable → the katakana string to feed the voice worker: transliterate,
 * polish, then elongate to fit a note of `durSec` seconds. The single call the
 * note engine makes per event.
 */
export function authorSyllable(syllable, durSec, opts = {}) {
  return elongateKata(transliterate(syllable, opts), durSec, opts.elongate || {});
}

/** Seconds per beat at a tempo. */
export const secondsPerBeat = (bpm) => 60 / bpm;

/**
 * Author a whole vocal score. `events` are `[syllable, note, beats]` triples (the
 * English-syllable-level score — one note = one syllable = one flowing Kokoro
 * utterance). Returns per-event `{ syllable, note, beats, durSec, kata }`, where
 * `kata` is the render instruction. The score is the recipe; the WAV is a render.
 */
export function authorScore(events, bpm, opts = {}) {
  const beat = secondsPerBeat(bpm);
  return events.map(([syllable, note, beats]) => {
    const durSec = beats * beat;
    return { syllable, note, beats, durSec, kata: authorSyllable(syllable, durSec, opts) };
  });
}
