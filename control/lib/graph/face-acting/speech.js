/**
 * speech — the MOUTH SPEAKING, as a capture of a line records it: a line of text (or timed phonemes) becomes per-frame
 * curves of the FACS units speech moves (facs.js: the jaw, the lips parted, puckered, funnelled, the lower lip under the
 * teeth, pressed shut, spread), to be laid over a performance's face (perform.js), which keeps the brows, the eyes and,
 * as far as the lips allow, the mouth's corners.
 *
 *   • THE WORDS → PHONEMES (`phonemesOf`): English by rule (a short list of the words the rules get wrong, then letter
 *     patterns: the digraphs, the vowel teams, the silent e, the r-controlled vowels) into ARPAbet, a content word's first
 *     vowel stressed, a function word's none. Imperfect by design: the mouth shows VISEMES, not phonemes, and the rules
 *     keep what a viewer reads (the closures, the f's lip, the rounding, the open vowels). Phonemes given (ARPAbet, or
 *     the IPA a speech engine phonemizes into) are taken as they are, timed when timed: the audio's own timeline.
 *   • THE VISEMES (`VISEMES`): the fifteen of the industry's lip-sync set (sil, PP, FF, TH, DD, kk, CH, SS, nn, RR, aa,
 *     E, ih, oh, ou), each a target on the units with a DOMINANCE per unit: how hard the segment holds that unit against
 *     its neighbours (a closure must close; a vowel's jaw gives way).
 *   • THE TIMING: each phoneme's duration by its class at a speaking rate (a stressed vowel longest, a reduced one
 *     shortest; about five syllables a second), a pause at a comma and a longer one at a sentence's end.
 *   • COARTICULATION (Cohen and Massaro's dominance model): each unit's curve is the dominance-weighed mean of the
 *     segments' targets, each segment's dominance falling off with the time from its centre (anticipation reaching
 *     further ahead than carry-over: the lips round for an oo before the consonant ahead of it), so the mouth moves
 *     through the line and never snaps from shape to shape. A bilabial is then shut whatever its neighbours (the lips
 *     meet for every m, b and p: the one thing lip-sync is judged on).
 *   • ARTICULATION (JALI's jaw and lip dials): `articulation` scales the jaw and the lips together (0.6 mumbled, 1
 *     plain, 1.4 enunciated); `jaw` and `lips` each apart; an EMPHASIZED word (`*word*`) is spoken longer and wider, and
 *     marked in the events for the brows' baton (perform.js).
 *
 * Pure and deterministic: no dice. → { fps, seconds, frames, curves: { AUxx: [] }, events: { phonemes, words } }.
 */

export const SPEECH_FPS = 60;
/** the units speech moves (facs.js): the jaw, the lips parted, puckered, funnelled, the lower lip under the teeth,
 * pressed, spread, the upper lip lifted off the teeth */
export const SPEECH_UNITS = Object.freeze(['AU26', 'AU25', 'AU18', 'AU22', 'AU28B', 'AU24', 'AU20', 'AU10']);

/** the visemes: each its targets on the units (0 … 1) and its dominance per unit (`hold`: a unit it names is held at
 * `hold`, one it does not at `free`: what the neighbours decide); `sil` the mouth at rest */
export const VISEMES = Object.freeze({
  sil: { t: {}, hold: 1, free: 1 },
  PP: { t: { AU24: 0.45 }, hold: 6, free: 0.25, close: true },
  FF: { t: { AU28B: 0.9, AU26: 0.05, AU10: 0.25 }, hold: 4, free: 0.3 },
  TH: { t: { AU26: 0.12, AU25: 0.5 }, hold: 1.2, free: 0.3 },
  DD: { t: { AU26: 0.1, AU25: 0.45 }, hold: 1, free: 0.3 },
  kk: { t: { AU26: 0.2, AU25: 0.4 }, hold: 0.8, free: 0.3 },
  CH: { t: { AU22: 0.7, AU26: 0.08, AU25: 0.45 }, hold: 2, free: 0.3 },
  SS: { t: { AU26: 0.04, AU25: 0.5, AU20: 0.3 }, hold: 2, free: 0.3 },
  nn: { t: { AU26: 0.12, AU25: 0.4 }, hold: 0.8, free: 0.3 },
  RR: { t: { AU18: 0.4, AU22: 0.35, AU26: 0.12, AU25: 0.3 }, hold: 1.2, free: 0.4 },
  aa: { t: { AU26: 0.5, AU25: 0.6 }, hold: 1, free: 0.5 },
  E: { t: { AU26: 0.32, AU25: 0.6, AU20: 0.3 }, hold: 1, free: 0.5 },
  ih: { t: { AU26: 0.16, AU25: 0.6, AU20: 0.5 }, hold: 1, free: 0.5 },
  oh: { t: { AU26: 0.36, AU22: 0.6, AU18: 0.25, AU25: 0.5 }, hold: 1.4, free: 0.5 },
  ou: { t: { AU18: 0.85, AU22: 0.2, AU26: 0.1, AU25: 0.3 }, hold: 1.6, free: 0.5 },
});
/** ARPAbet → its class (the timing) and viseme (a diphthong two, its glide second) */
export const PHONEMES = Object.freeze({
  AA: ['vowel', 'aa'], AE: ['vowel', 'aa'], AH: ['vowel', 'aa'], AO: ['vowel', 'oh'], AW: ['diphthong', 'aa', 'ou'], AY: ['diphthong', 'aa', 'ih'],
  EH: ['vowel', 'E'], ER: ['vowel', 'RR'], EY: ['diphthong', 'E', 'ih'], IH: ['vowel', 'ih'], IY: ['vowel', 'ih'], OW: ['diphthong', 'oh', 'ou'],
  OY: ['diphthong', 'oh', 'ih'], UH: ['vowel', 'ou'], UW: ['vowel', 'ou'],
  B: ['stop', 'PP'], P: ['stop', 'PP'], M: ['nasal', 'PP'], F: ['fricative', 'FF'], V: ['fricative', 'FF'], TH: ['fricative', 'TH'], DH: ['fricative', 'TH'],
  T: ['stop', 'DD'], D: ['stop', 'DD'], K: ['stop', 'kk'], G: ['stop', 'kk'], NG: ['nasal', 'kk'], HH: ['aspirate', null],
  CH: ['affricate', 'CH'], JH: ['affricate', 'CH'], SH: ['fricative', 'CH'], ZH: ['fricative', 'CH'], S: ['fricative', 'SS'], Z: ['fricative', 'SS'],
  N: ['nasal', 'nn'], L: ['liquid', 'nn'], R: ['liquid', 'RR'], W: ['glide', 'ou'], Y: ['glide', 'ih'],
});
/** a class's duration at rate 1 (s); a stressed vowel's ×, a reduced (unstressed) vowel's × and its targets'; the pauses */
export const TIMING = Object.freeze({
  vowel: 0.1, diphthong: 0.15, stop: 0.07, fricative: 0.085, affricate: 0.1, nasal: 0.065, liquid: 0.06, glide: 0.055, aspirate: 0.05,
  stressed: 1.3, reduced: 0.65, reducedOpen: 0.65, emphasis: 1.35, comma: 0.22, stop_: 0.42, lead: 0.12, tail: 0.18,
});
/** the dominance's fall with the time from a segment's centre (s): ahead (anticipation) and behind (carry-over) */
export const COARTIC = Object.freeze({ ahead: 0.09, behind: 0.065, rest: 0.02 });

// THE WORDS THE RULES GET WRONG (ARPAbet, the stressed vowel marked 1, a reduced one 0) — the commonest English words
// whose spelling misleads, and the function words, spoken unstressed
const LEXICON = Object.freeze(Object.fromEntries(`a:AH0|the:DH AH0|of:AH0 V|to:T UW0|and:AH0 N D|in:IH0 N|is:IH0 Z|it:IH0 T|you:Y UW0|that:DH AE0 T
he:HH IY0|was:W AH0 Z|for:F AO0 R|on:AA0 N|are:AA0 R|as:AE0 Z|with:W IH0 DH|his:HH IH0 Z|they:DH EY0|i:AY0|at:AE0 T|be:B IY0
this:DH IH0 S|have:HH AE1 V|from:F R AH0 M|or:AO0 R|one:W AH1 N|had:HH AE0 D|by:B AY0|word:W ER1 D|but:B AH0 T|not:N AA0 T
what:W AH1 T|all:AO1 L|were:W ER0|we:W IY0|when:W EH0 N|your:Y AO0 R|can:K AE0 N|said:S EH1 D|there:DH EH0 R|use:Y UW1 Z
an:AE0 N|each:IY1 CH|which:W IH0 CH|she:SH IY0|do:D UW0|how:HH AW1|their:DH EH0 R|if:IH0 F|will:W IH0 L|up:AH1 P|other:AH1 DH ER0
about:AH0 B AW1 T|out:AW1 T|many:M EH1 N IY0|then:DH EH0 N|them:DH EH0 M|these:DH IY0 Z|so:S OW0|some:S AH1 M|her:HH ER0
would:W UH0 D|make:M EY1 K|like:L AY1 K|him:HH IH0 M|into:IH0 N T UW0|time:T AY1 M|has:HH AE0 Z|look:L UH1 K|two:T UW1
more:M AO1 R|write:R AY1 T|go:G OW1|see:S IY1|no:N OW1|way:W EY1|could:K UH0 D|people:P IY1 P AH0 L|my:M AY0|than:DH AE0 N
first:F ER1 S T|been:B IH0 N|who:HH UW1|its:IH0 T S|now:N AW1|find:F AY1 N D|long:L AO1 NG|down:D AW1 N|day:D EY1|did:D IH0 D
get:G EH1 T|come:K AH1 M|made:M EY1 D|may:M EY0|part:P AA1 R T|over:OW1 V ER0|new:N UW1|know:N OW1|water:W AO1 T ER0
give:G IH1 V|girl:G ER1 L|done:D AH1 N|gone:G AO1 N|love:L AH1 V|move:M UW1 V|above:AH0 B AH1 V|money:M AH1 N IY0|mother:M AH1 DH ER0
father:F AA1 DH ER0|brother:B R AH1 DH ER0|nothing:N AH1 TH IH0 NG|something:S AH1 M TH IH0 NG|again:AH0 G EH1 N|any:EH1 N IY0
because:B IH0 K AH1 Z|does:D AH0 Z|says:S EH1 Z|friend:F R EH1 N D|eye:AY1|eyes:AY1 Z|heart:HH AA1 R T|great:G R EY1 T|sure:SH UH1 R
should:SH UH0 D|whole:HH OW1 L|once:W AH1 N S|only:OW1 N L IY0|very:V EH1 R IY0|every:EH1 V R IY0|always:AO1 L W EY0 Z|young:Y AH1 NG
where:W EH1 R|here:HH IY1 R|our:AW1 ER0|hour:AW1 ER0|lose:L UW1 Z|whose:HH UW1 Z|women:W IH1 M AH0 N|woman:W UH1 M AH0 N|me:M IY0
us:AH0 S|am:AE0 M|yes:Y EH1 S|hello:HH AH0 L OW1|okay:OW1 K EY1|ok:OW1 K EY1|just:JH AH1 S T|really:R IH1 L IY0|think:TH IH1 NG K
thought:TH AO1 T|though:DH OW0|through:TH R UW1|enough:IH0 N AH1 F|laugh:L AE1 F|tough:T AH1 F|world:W ER1 L D|work:W ER1 K
put:P UH1 T|full:F UH1 L|pull:P UH1 L|push:P UH1 SH|good:G UH1 D|book:B UH1 K|blood:B L AH1 D|door:D AO1 R|floor:F L AO1 R
child:CH AY1 L D|wild:W AY1 L D|mind:M AY1 N D|kind:K AY1 N D|both:B OW1 TH|most:M OW1 S T|old:OW1 L D|told:T OW1 L D|cold:K OW1 L D
live:L IH1 V|island:AY1 L AH0 N D|answer:AE1 N S ER0|listen:L IH1 S AH0 N|often:AO1 F AH0 N|half:HH AE1 F|talk:T AO1 K|walk:W AO1 K
could've:K UH1 D AH0 V|don't:D OW1 N T|won't:W OW1 N T|can't:K AE1 N T|i'm:AY1 M|it's:IH0 T S|that's:DH AE1 T S|i'll:AY1 L|you're:Y UH0 R
we're:W IH0 R|they're:DH EH0 R|i've:AY1 V|isn't:IH1 Z AH0 N T|didn't:D IH1 D AH0 N T|doesn't:D AH1 Z AH0 N T|let's:L EH1 T S`
  .split(/[|\n]/).map((e) => e.trim().split(':')).filter((e) => e.length === 2).map(([w, p]) => [w, p.split(' ')])));
const FUNCTION = new Set(Object.entries(LEXICON).filter(([, p]) => !p.some((x) => /1$/.test(x))).map(([w]) => w));
const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

// THE LETTER RULES: [letters, phonemes, when (the rest of the word after them, its start)], longest first
const V_ = 'aeiouy', isV = (c) => c !== undefined && V_.includes(c);
const RULES = [
  ['tch', 'CH'], ['eau', 'OW'], ['igh', 'AY'], ['dge', 'JH'], ['sch', 'S K'], ['ough', 'OW'],
  ['ch', 'CH'], ['sh', 'SH'], ['th', 'TH'], ['ph', 'F'], ['wh', 'W'], ['ck', 'K'], ['ng', 'NG'], ['qu', 'K W'], ['gh', ''], ['dg', 'JH'],
  ['ee', 'IY'], ['ea', 'IY'], ['oo', 'UW'], ['ou', 'AW'], ['ow', 'OW'], ['oi', 'OY'], ['oy', 'OY'], ['ai', 'EY'], ['ay', 'EY'], ['au', 'AO'],
  ['aw', 'AO'], ['ei', 'EY'], ['ey', 'EY'], ['ue', 'UW'], ['ew', 'UW'], ['oa', 'OW'], ['ui', 'UW'],
  ['ar', 'AA R'], ['er', 'ER'], ['ir', 'ER'], ['ur', 'ER'], ['or', 'AO R'],
];
const SHORT = { a: 'AE', e: 'EH', i: 'IH', o: 'AA', u: 'AH', y: 'IH' }, LONG = { a: 'EY', e: 'IY', i: 'AY', o: 'OW', u: 'UW', y: 'AY' };
const CONS = { b: 'B', d: 'D', f: 'F', h: 'HH', j: 'JH', k: 'K', l: 'L', m: 'M', n: 'N', p: 'P', r: 'R', s: 'S', t: 'T', v: 'V', w: 'W', z: 'Z' };

/** one word (lower case letters, an apostrophe) by the rules → ARPAbet, no stress */
function letterRules(w) {
  if (LEXICON[w]) return LEXICON[w].map((p) => p.replace(/\d$/, ''));
  const s = w.replace(/'/g, ''), out = [];
  for (let i = 0; i < s.length;) {
    const c = s[i], rest = s.slice(i);
    // (the silent starts: kn, wr, gn; a final mb)
    if (i === 0 && /^(kn|gn)/.test(rest)) { out.push('N'); i += 2; continue; }
    if (i === 0 && rest.startsWith('wr')) { out.push('R'); i += 2; continue; }
    if (rest === 'mb') { out.push('M'); break; }
    if (i === 0 && rest.startsWith('gh')) { out.push('G'); i += 2; continue; }
    // (a final e: silent, but for a word of it alone; the -ed ending a d)
    if (c === 'e' && i === s.length - 1 && i > 1) break;
    if (rest === 'ed' && i > 1) { out.push('D'); break; }
    if (rest === 'es' && i > 2 && /[sxz]|ch|sh/.test(s.slice(i - 2, i))) { out.push('IH', 'Z'); break; }
    const R = RULES.find(([g]) => rest.startsWith(g));
    if (R) { if (R[1]) out.push(...R[1].split(' ')); i += R[0].length; continue; }
    if (isV(c)) {
      // (y a consonant at the start; at the end a vowel: long in a word with no other, else ee)
      if (c === 'y' && i === 0) { out.push('Y'); i++; continue; }
      if (c === 'y' && i === s.length - 1) { out.push([...s.slice(0, i)].some(isV) ? 'IY' : 'AY'); i++; continue; }
      // (the silent e lengthens the vowel before one consonant: make, theme, time, home, tune)
      const magic = !isV(s[i + 1]) && s[i + 1] !== undefined && s[i + 2] === 'e' && i + 3 === s.length;
      out.push(magic ? LONG[c] : SHORT[c]); i++; continue;
    }
    if (c === s[i + 1] && !isV(c)) { i++; continue; }   // (a doubled consonant is one)
    if (c === 'c') { out.push(/[eiy]/.test(s[i + 1] ?? '') ? 'S' : 'K'); i++; continue; }
    if (c === 'g') { out.push(/[eiy]/.test(s[i + 1] ?? '') && i + 1 < s.length - 1 ? 'JH' : 'G'); i++; continue; }
    if (c === 'x') { out.push('K', 'S'); i++; continue; }
    if (c === 's' && isV(s[i - 1]) && isV(s[i + 1]) && s[i + 1] !== 'y') { out.push('Z'); i++; continue; }
    if (CONS[c]) out.push(CONS[c]);
    i++;
  }
  return out;
}
const isVowel = (p) => /^(AA|AE|AH|AO|AW|AY|EH|ER|EY|IH|IY|OW|OY|UH|UW)$/.test(p);

/**
 * A line → its phonemes: [{ p, stress (1 stressed, 0 reduced, null a consonant), word (its index), emph }] and its
 * words [{ w, emph }], a pause between sentences or at a comma as { p: 'sil', pause: 'comma' | 'stop' }.
 */
export function phonemesOf(text) {
  const out = [], words = [];
  const toks = String(text).replace(/(\d)/g, ' $1 ').match(/\*[^*]+\*|[A-Za-z']+|\d|[,;:—–-]|[.!?]+/g) || [];
  for (const tok of toks) {
    if (/^[,;:—–-]$/.test(tok)) { out.push({ p: 'sil', pause: 'comma' }); continue; }
    if (/^[.!?]+$/.test(tok)) { out.push({ p: 'sil', pause: 'stop' }); continue; }
    const emph = tok.startsWith('*');
    for (const raw of (emph ? tok.slice(1, -1) : tok).match(/[A-Za-z']+|\d/g) || []) {
      const w = /\d/.test(raw) ? DIGITS[+raw] : raw.toLowerCase(), wi = words.push({ w, emph }) - 1;
      const lex = LEXICON[w], ps = lex ?? letterRules(w), fn = FUNCTION.has(w) && !emph;
      let first = true;
      for (const q of ps) {
        const p = q.replace(/\d$/, ''), v = isVowel(p);
        const stress = !v ? null : lex ? (/1$/.test(q) ? 1 : 0) : fn ? 0 : first ? 1 : 0;
        if (v) first = false;
        out.push({ p, stress, word: wi, emph });
      }
    }
  }
  return { phonemes: out, words };
}

/** the IPA a speech engine phonemizes into (espeak's, misaki's) → ARPAbet, for phonemes given */
const IPA = Object.freeze({ 'ɑ': 'AA', 'ɑː': 'AA', 'æ': 'AE', 'ʌ': 'AH', 'ə': 'AH', 'ɐ': 'AH', 'ɔ': 'AO', 'ɔː': 'AO', 'aʊ': 'AW', 'W': 'AW', 'aɪ': 'AY', 'I': 'AY',
  'ɛ': 'EH', 'ɝ': 'ER', 'ɚ': 'ER', 'ɜː': 'ER', 'eɪ': 'EY', 'A': 'EY', 'ɪ': 'IH', 'i': 'IY', 'iː': 'IY', 'oʊ': 'OW', 'O': 'OW', 'əʊ': 'OW', 'ɔɪ': 'OY', 'Y': 'OY',
  'ʊ': 'UH', 'u': 'UW', 'uː': 'UW', 'b': 'B', 'p': 'P', 'm': 'M', 'f': 'F', 'v': 'V', 'θ': 'TH', 'ð': 'DH', 't': 'T', 'd': 'D', 'ɾ': 'D', 'k': 'K',
  'g': 'G', 'ɡ': 'G', 'ŋ': 'NG', 'h': 'HH', 'tʃ': 'CH', 'ʧ': 'CH', 'dʒ': 'JH', 'ʤ': 'JH', 'ʃ': 'SH', 'ʒ': 'ZH', 's': 'S', 'z': 'Z', 'n': 'N', 'l': 'L',
  'ɹ': 'R', 'r': 'R', 'w': 'W', 'j': 'Y',
  // (and alone, where an engine writes a diphthong's or a vowel's letters apart: the pairs above merge first)
  'a': 'AA', 'e': 'EH', 'o': 'OW', 'ɒ': 'AA', 'ɜ': 'ER', 'ᵻ': 'IH', 'ᵊ': 'AH', 'ɘ': 'AH', 'ɫ': 'L', 'x': 'K', 'ɐː': 'AA' });
/** an engine's symbols that are no phoneme: a stress mark (its time the next phoneme's, which it stresses), a length
 * mark or a diacritic (its time the one before's), a space (the one before's), punctuation (a pause) */
const STRESS = /^[ˈˌ]$/u, AFTER = /^([ːˑʰʲʷ]|\p{M})+$/u, SPACE = /^\s+$/u, PAUSE = /^[,.;:!?—–…"“”()\[\]-]+$/u;

/**
 * Phonemes as given (ARPAbet, or an engine's IPA as it spoke them: speak.py `--timings`) → [{ p (ARPAbet | 'sil'), t?,
 * dur?, stress (1 | 0 | null) }]: an engine's two-letter sounds (aɪ, oʊ, tʃ …) one phoneme, its marks, spaces and
 * punctuation folded into their neighbours or a pause, the times kept whole. `bad`: the indices of symbols that are none
 * of these (an ASCII one: a typo; an engine's own symbol it has no reading for is folded into the one before).
 */
export function givenPhonemes(list) {
  const out = [], bad = [];
  let carry = null, stressNext = false;
  const extend = (q) => { const last = out.at(-1); if (last && last.dur !== undefined && q.dur !== undefined) last.dur = +(last.dur + q.dur).toFixed(4); };
  for (let i = 0; i < list.length; i++) {
    const q = list[i] ?? {}, sym = String(q.p ?? '');
    if (STRESS.test(sym)) { stressNext = sym === 'ˈ'; if (q.t !== undefined && !carry) carry = { t: q.t, dur: q.dur ?? 0 }; else if (carry && q.dur !== undefined) carry.dur += q.dur; continue; }
    if (AFTER.test(sym) || SPACE.test(sym)) { extend(q); continue; }
    if (PAUSE.test(sym)) { const last = out.at(-1); if (last?.p === 'sil') extend(q); else out.push({ p: 'sil', ...(q.t !== undefined ? { t: q.t } : {}), ...(q.dur !== undefined ? { dur: q.dur } : {}), stress: null }); continue; }
    // (a pair the engine wrote apart, one sound)
    const nx = list[i + 1], pair = nx && typeof nx.p === 'string' ? IPA[sym + nx.p] : undefined;
    let p = pair ?? arpabetOf(sym), dur = q.dur;
    if (pair) { if (dur !== undefined && nx.dur !== undefined) dur += nx.dur; i++; }
    if (p === null) { if (/^[A-Za-z0-9]+$/.test(sym) || !out.length) bad.push(i); else extend(q); continue; }
    let t = q.t;
    if (carry) { if (t !== undefined && dur !== undefined) { dur += t - carry.t; t = carry.t; } carry = null; }
    const v = p !== 'sil' && PHONEMES[p][0].match(/vowel|diphthong/) !== null;
    const digit = /([012])$/.exec(sym)?.[1];
    out.push({ p, ...(t !== undefined ? { t } : {}), ...(dur !== undefined ? { dur: +dur.toFixed(4) } : {}), stress: !v ? null : digit !== undefined ? (digit === '0' ? 0 : 1) : stressNext ? 1 : list.some((x) => STRESS.test(String(x?.p))) ? 0 : 1 });
    if (v) stressNext = false;
  }
  return { phonemes: out, bad };
}
/** a given phoneme's symbol → ARPAbet (stress digits dropped), or null */
export function arpabetOf(sym) {
  const s = String(sym).replace(/[ˈˌ]/g, '');
  const a = s.toUpperCase().replace(/[012]$/, '');
  if (a === 'SIL' || a === 'SP' || a === '') return 'sil';
  return PHONEMES[a] ? a : IPA[s] ?? null;
}

/** Error lines for a line to speak (empty = valid): a text, or { text, rate?, articulation?, jaw?, lips? }, or
 * { phonemes: [{ p, t?, dur? }] } (an engine's timings as written: speak.py `--timings`), and `audio?`, the line's
 * recording (its path, played with the take) */
export function speechErrors(S) {
  const s = typeof S === 'string' ? { text: S } : S;
  if (!s || typeof s !== 'object') return ['say: a line of text, or { text, rate?, articulation? }, or { phonemes: [{ p, t?, dur? }] }'];
  const errs = [];
  if (s.text === undefined && s.phonemes === undefined && s.envelope === undefined && s.audio === undefined) errs.push('say: { text } or { phonemes }, or { audio } (its recording)');
  if (s.text !== undefined && (typeof s.text !== 'string' || !/[A-Za-z0-9]/.test(s.text))) errs.push('say.text: words to speak');
  if (s.phonemes !== undefined) {
    if (!Array.isArray(s.phonemes) || !s.phonemes.length) errs.push('say.phonemes: [{ p, t?, dur? }]');
    else {
      for (const i of givenPhonemes(s.phonemes).bad) errs.push(`say.phonemes[${i}].p: an ARPAbet phoneme (${Object.keys(PHONEMES).join(' ')}) or its IPA, or 'sil'`);
      s.phonemes.forEach((q, i) => { for (const k of ['t', 'dur']) if (q?.[k] !== undefined && !(Number.isFinite(q[k]) && q[k] >= 0)) errs.push(`say.phonemes[${i}].${k}: seconds, 0 or more`); });
      if (!givenPhonemes(s.phonemes).phonemes.some((q) => q.p !== 'sil')) errs.push('say.phonemes: no phoneme to speak');
    }
  }
  // (a recording: given as `audio`, a WAV's path the door saves; kept as `recording`, its id, with its `seconds` and
  // `timing`, the timed phonemes and words or, no text, the loudness `envelope`: recordings.js bindLine)
  if (s.audio !== undefined && (typeof s.audio !== 'string' || !/\.wav$/i.test(s.audio))) errs.push('say.audio: the line\'s recording, a path to a .wav (the door saves it)');
  if (s.recording !== undefined && !/^[0-9a-f]{16}$/.test(String(s.recording))) errs.push('say.recording: a saved recording\'s id (16 hex), as the door keeps it');
  if (s.timing !== undefined && !TIMINGS.includes(s.timing)) errs.push(`say.timing: one of ${TIMINGS.join(', ')}`);
  if (s.seconds !== undefined && !(Number.isFinite(s.seconds) && s.seconds > 0)) errs.push('say.seconds: the recording\'s length, more than 0');
  if (s.words !== undefined && !(Array.isArray(s.words) && s.words.every((w) => w && typeof w.w === 'string' && Number.isFinite(w.t) && Number.isFinite(w.dur)))) errs.push('say.words: [{ w, t, dur, emph? }]');
  if (s.envelope !== undefined && !(s.envelope && Number.isFinite(s.envelope.fps) && s.envelope.fps > 0 && Array.isArray(s.envelope.v) && s.envelope.v.length && s.envelope.v.every((x) => Number.isFinite(x) && x >= 0 && x <= 1))) errs.push('say.envelope: { fps, v: [0 … 1] }, the voice\'s loudness');
  for (const [k, lo, hi] of [['rate', 0.4, 2.5], ['articulation', 0, 2], ['jaw', 0, 2], ['lips', 0, 2]]) if (s[k] !== undefined && !(Number.isFinite(s[k]) && s[k] >= lo && s[k] <= hi)) errs.push(`say.${k}: ${lo} … ${hi}`);
  return errs;
}

/** how a recorded line is timed: by its engine (its own phonemes), its text aligned to it, or its loudness alone */
export const TIMINGS = Object.freeze(['engine', 'aligned', 'loudness']);

/** A text's rule timeline (the segments and the words, from TIMING.lead): what align.js lays on a recording */
export function textTimeline(text, { rate = 1 } = {}) { const { segs, words } = segmentsOf({ text, rate }); return { segs, words }; }

/** the segments of a line: [{ p, vis, t, dur, k (a target's scale), emph, word }] in time from 0, and its words timed */
function segmentsOf(s) {
  const rate = s.rate ?? 1, segs = [];
  let t = TIMING.lead;
  if (s.phonemes) {
    // (phonemes given: timed by their own times where they carry them, else by the rules' durations; an unstressed vowel
    // reduced as the text's are)
    for (const q of givenPhonemes(s.phonemes).phonemes) {
      const p = q.p, cls = p === 'sil' ? null : PHONEMES[p][0];
      const dur = q.dur ?? (p === 'sil' ? TIMING.comma : TIMING[cls]) / rate, at = q.t ?? t;
      segs.push({ p, t: at, dur, stress: q.stress, emph: false, word: -1 }); t = at + dur;
    }
    // (the words where an aligner timed them: an emphasized one's baton)
    return { segs, words: s.words ? s.words.map((w) => ({ ...w })) : [], end: Math.max(t + TIMING.tail, s.seconds ?? 0) };
  }
  const { phonemes, words } = phonemesOf(s.text), wt = words.map(() => ({ t: Infinity, end: 0 }));
  for (const q of phonemes) {
    if (q.p === 'sil') { const d = (q.pause === 'stop' ? TIMING.stop_ : TIMING.comma) / rate; segs.push({ p: 'sil', t, dur: d, stress: null, emph: false, word: -1 }); t += d; continue; }
    const cls = PHONEMES[q.p][0];
    let dur = TIMING[cls] / rate;
    if (q.stress === 1) dur *= TIMING.stressed; else if (q.stress === 0) dur *= TIMING.reduced;
    if (q.emph && q.stress !== null) dur *= TIMING.emphasis;
    segs.push({ p: q.p, t, dur, stress: q.stress, emph: q.emph, word: q.word });
    wt[q.word].t = Math.min(wt[q.word].t, t); wt[q.word].end = t + dur; t += dur;
  }
  return { segs, words: words.map((w, i) => ({ w: w.w, t: wt[i].t, dur: wt[i].end - wt[i].t, ...(w.emph ? { emph: true } : {}) })), end: t + TIMING.tail };
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const r4 = (v) => Math.round(v * 1e4) / 1e4;

/** a recorded line with no text: the mouth opening with the voice's loudness (`envelope`), the jaw and the lips parted
 * by it at `LOUDNESS_MOUTH` of their reach, no viseme (no word is known to shape) */
export const LOUDNESS_MOUTH = Object.freeze({ AU26: 0.45, AU25: 0.6, part: 0.15 });
function byLoudness(s, fps, KJ, KL) {
  const E = s.envelope ?? { fps: 30, v: [0] }, seconds = Math.max(s.seconds ?? 0, E.v.length / E.fps), n = Math.max(1, Math.round(seconds * fps) + 1);
  const at = (t) => { const x = t * E.fps, i = Math.floor(x), f = x - i; return (E.v[Math.min(E.v.length - 1, i)] ?? 0) * (1 - f) + (E.v[Math.min(E.v.length - 1, i + 1)] ?? 0) * f; };
  const curves = Object.fromEntries(SPEECH_UNITS.map((u) => [u, new Array(n).fill(0)]));
  for (let i = 0; i < n; i++) { const e = at(i / fps); curves.AU26[i] = r4(clamp01(e * LOUDNESS_MOUTH.AU26 * KJ)); curves.AU25[i] = r4(clamp01(Math.min(1, e / LOUDNESS_MOUTH.part) * LOUDNESS_MOUTH.AU25 * KL)); }
  return { fps, seconds: r4(seconds), frames: n, curves, events: { phonemes: [], words: [] } };
}

/**
 * A line spoken: `S` a text or { text | phonemes, rate? (1), articulation? (1), jaw? (1), lips? (1) } → { fps, seconds,
 * frames, curves: { AUxx: [per frame] } (SPEECH_UNITS), events: { phonemes: [{ p, viseme, t, dur }], words: [{ w, t, dur,
 * emph? }] } }, from t = 0.
 */
export function speak(S, { fps = SPEECH_FPS } = {}) {
  const errs = speechErrors(S);
  if (errs.length) throw new Error(`speak: ${errs.join('; ')}`);
  const s = typeof S === 'string' ? { text: S } : S, A = s.articulation ?? 1, KJ = A * (s.jaw ?? 1), KL = A * (s.lips ?? 1);
  if (!s.phonemes && !s.text) return byLoudness(s, fps, KJ, KL);
  const { segs, words, end } = segmentsOf(s);
  // (each segment its viseme(s): a diphthong two halves, the glide second; a breath (hh) the next vowel's at a third)
  const keys = [];
  segs.forEach((g, i) => {
    if (g.p === 'sil') { keys.push({ c: g.t + g.dur / 2, vis: 'sil', k: 1, g }); return; }
    const [, v1, v2] = PHONEMES[g.p];
    const k = (g.stress === 0 ? TIMING.reducedOpen : 1) * (g.emph ? 1.2 : 1);
    if (v1 === null) { const nx = segs.slice(i + 1).find((x) => x.p !== 'sil' && PHONEMES[x.p][1]); keys.push({ c: g.t + g.dur / 2, vis: nx ? PHONEMES[nx.p][1] : 'sil', k: k / 3, g, weak: true }); return; }
    if (v2) { keys.push({ c: g.t + g.dur * 0.3, vis: v1, k, g }); keys.push({ c: g.t + g.dur * 0.8, vis: v2, k, g }); return; }
    keys.push({ c: g.t + g.dur / 2, vis: v1, k, g });
  });
  // (the line's start and end at rest)
  keys.unshift({ c: 0, vis: 'sil', k: 1 }); keys.push({ c: end, vis: 'sil', k: 1 });
  const n = Math.max(1, Math.round(end * fps) + 1), curves = {};
  for (const u of SPEECH_UNITS) {
    const scale = u === 'AU26' ? KJ : KL, c = new Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / fps; let num = 0, den = COARTIC.rest;
      for (const K of keys) {
        const dt = t - K.c, w = Math.exp(-Math.abs(dt) / (dt < 0 ? COARTIC.ahead : COARTIC.behind));
        if (w < 1e-4) continue;
        const V = VISEMES[K.vis], named = u in V.t, D = w * (named ? V.hold : V.free) * (K.weak ? 0.3 : 1);
        num += D * (named ? V.t[u] * K.k : 0); den += D;
      }
      c[i] = clamp01((num / den) * scale);
    }
    curves[u] = c;
  }
  // THE CLOSURES: every bilabial shut through its middle, whatever its neighbours (the jaw near shut, the lips met)
  for (const K of keys) {
    if (K.vis !== 'PP' || !K.g) continue;
    const half = Math.max(K.g.dur / 2, 0.03), edge = 0.04;
    for (let i = Math.max(0, Math.floor((K.c - half - edge) * fps)); i < n && i / fps <= K.c + half + edge; i++) {
      const d = Math.abs(i / fps - K.c), shut = d <= half ? 1 : 1 - (d - half) / edge;
      curves.AU25[i] *= 1 - shut; curves.AU26[i] = Math.min(curves.AU26[i], curves.AU26[i] * (1 - shut) + 0.02 * shut);
      curves.AU22[i] *= 1 - 0.8 * shut;
    }
  }
  return {
    fps, seconds: r4(end), frames: n,
    curves: Object.fromEntries(SPEECH_UNITS.map((u) => [u, curves[u].map(r4)])),
    events: {
      phonemes: segs.map((g) => ({ p: g.p, viseme: g.p === 'sil' ? 'sil' : PHONEMES[g.p][1] ?? 'sil', t: r4(g.t), dur: r4(g.dur) })),
      words: words.map((w) => ({ ...w, t: r4(w.t), dur: r4(w.dur) })),
    },
  };
}
