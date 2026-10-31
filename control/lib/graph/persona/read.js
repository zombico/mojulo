/**
 * read — a SCRIPT read in a delivery register (delivery.js): plain text into what a persona's face, voice and body play,
 * on one clock. The read is what the hosts take (a game's screen, a scene's line): the face's takes where the face is
 * drawn, the body's gestures and the captions everywhere (fidelity.js).
 *
 *   THE SCRIPT (`parseScript`): plain text. A blank line starts a PARAGRAPH (a new story, a new breath and a look);
 *   a sentence is a LINE (the mouth's unit, the captions' too); `*word*` stresses a word; `[pause]` or `[pause 1.5]`
 *   holds a silence (the register's, or so many seconds); `(…)` is an ASIDE, read in its own gaze. Nothing else is markup.
 *
 *   THE READ (`readScript`): each line given the register's stresses (names, numbers, `per` a line, the script's own
 *   marks first), spoken at its rate and articulation (speech.js, to time it), laid end to end with its gaps → { register,
 *   seconds, lines: [{ text, at, end, para, aside?, words: [{ w, t, dur, emph? }] }], beats (perform.js: a take's), body:
 *   [{ t, gesture, cause }], voice }. The same script and register: the same read, byte for byte (no dice: the face's
 *   own seed makes its blinks, `takeOf`).
 *
 * Pure and deterministic.
 */
import { speak } from '../face-acting/speech.js';
import { perform } from '../face-acting/perform.js';
import { deliveryOf } from './delivery.js';

/** NUMBERS AS SAID: a token of digits read as a reader says it (the mouth's rules spell a digit at a time): an integer
 * (its thousands' commas), a decimal, a percent, a year (1100 to 2099, no comma), a time (7:30), a score or a range
 * (3-2: "three to two"), an ordinal (1st) */
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ORD = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' };
const under100 = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : ''));
const under1000 = (n) => (n < 100 ? under100(n) : `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${under100(n % 100)}` : ''}`);
export function numberWords(n) {
  if (n === 0) return 'zero';
  const out = [];
  for (const [v, w] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]) if (n >= v) { out.push(`${under1000(Math.floor(n / v))} ${w}`); n %= v; }
  if (n) out.push(under1000(n));
  return out.join(' ');
}
const ordinal = (words) => { const ws = words.split(' '), last = ws.pop(); return [...ws, ORD[last] ?? (last.endsWith('y') ? last.slice(0, -1) + 'ieth' : last + 'th')].join(' '); };
/** a token as it is said: its digits in words (its letters and its punctuation kept) */
export function spoken(token) {
  return token.replace(/\d[\d,]*(?:\.\d+)?(?::\d\d)?(?:st|nd|rd|th)?%?(?:-\d+)?/g, (m) => {
    let w;
    const score = /^(\d+)-(\d+)$/.exec(m), time = /^(\d{1,2}):(\d\d)$/.exec(m), ord = /^(\d+)(st|nd|rd|th)$/.exec(m);
    if (score) w = `${numberWords(+score[1])} to ${numberWords(+score[2])}`;
    else if (time) w = `${numberWords(+time[1])}${+time[2] ? ` ${+time[2] < 10 ? `oh ${ONES[+time[2]]}` : under100(+time[2])}` : " o'clock"}`;
    else if (ord) w = ordinal(numberWords(+ord[1]));
    else {
      const pct = m.endsWith('%'), core = m.replace(/%$/, ''), [int, dec] = core.split('.'), plain = int.replace(/,/g, ''), n = +plain;
      w = !int.includes(',') && !dec && plain.length === 4 && n >= 1100 && n < 2100 && n % 100 && Math.floor(n / 100) !== 20 ? `${under100(Math.floor(n / 100))} ${n % 100 < 10 ? `oh ${ONES[n % 100]}` : under100(n % 100)}`
        : numberWords(n);
      if (dec) w += ` point ${[...dec].map((d) => ONES[+d]).join(' ')}`;
      if (pct) w += ' percent';
    }
    return ` ${w} `;
  }).replace(/\s+/g, ' ').trim();
}
/** how many words the mouth's rules make of a spoken text (speech.js phonemesOf: a run of letters, or a digit) */
const speechCount = (t) => (t.replace(/\*/g, '').match(/[A-Za-z']+|\d/g) || []).length;

/** the reader's gaze targets as the face takes them (perform.js `gaze`): the lens a viewer at a screen's distance, the
 * notes on the desk, away at the play or the room */
export const READ_GAZE = Object.freeze({
  lens: Object.freeze({ yaw: 0, pitch: 0, distance: 2.5 }), notes: 'down', away: Object.freeze({ yaw: 22, pitch: -6 }),
});
/** a read's lead-in before its first word and its hold after its last (s) */
export const READ_PAD = Object.freeze({ lead: 0.5, tail: 0.8 });

/** The script's paragraphs, each its parts in order: { line: text } | { aside: text } | { pause: s | null } */
export function parseScript(script) {
  if (typeof script !== 'string' || !script.trim()) throw new Error('read: the script is text (a blank line a new paragraph; *stress*, [pause], [pause 1.5], (aside))');
  return script.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean).map((p) => {
    const parts = [];
    for (const tok of p.split(/(\[pause(?:\s+[\d.]+)?\]|\([^)]*\))/)) {
      const t = tok.trim(); if (!t) continue;
      const pause = /^\[pause(?:\s+([\d.]+))?\]$/.exec(t);
      if (pause) { parts.push({ pause: pause[1] ? Number(pause[1]) : null }); continue; }
      if (t.startsWith('(') && t.endsWith(')')) { const a = t.slice(1, -1).trim(); if (a) parts.push({ aside: a }); continue; }
      for (const s of t.split(/(?<=[.!?])\s+/)) if (s.trim()) parts.push({ line: s.trim() });
    }
    return parts;
  });
}

/** a line with the register's stresses: the script's own `*marks*` first, then numbers and names (a capitalised word
 * past the first), in order, `per` a line at most */
export function stressed(text, stress) {
  const marked = (text.match(/\*[^*]+\*/g) || []).length;
  let room = Math.max(0, (stress?.per ?? 0) - marked);
  if (!room) return text;
  // (the words outside a mark, with their places; the first word of the line is no name)
  return text.replace(/(\*[^*]+\*)|([A-Za-z0-9][\w'’.,%-]*)/g, (all, mark, word, off) => {
    if (mark || !room) return all;
    const core = word.replace(/[.,%]+$/, ''), tail = word.slice(core.length);
    const isNum = /\d/.test(core) && stress.numbers, isName = stress.names && off > 0 && /^[A-Z][a-z]/.test(core) && core !== 'I';
    if (!isNum && !isName) return all;
    room--; return `*${core}*${tail}`;
  });
}

/** The read of a script in a register (delivery.js: a name or { from, …tune }) */
export function readScript({ script, register = 'anchor' } = {}) {
  const R = deliveryOf(register), paras = parseScript(script), lines = [], beats = [], body = [];
  const gazeOf = (k) => READ_GAZE[R.gaze[k]] ?? READ_GAZE.lens, head = { ...R.head };
  let t = READ_PAD.lead;
  beats.push({ at: 0, face: R.face, state: 'attentive', gaze: gazeOf('line'), head });
  paras.forEach((parts, pi) => {
    // (a new paragraph: a breath and the register's look (its notes, the room), then back to the line's)
    if (pi > 0) { beats.push({ at: t, face: R.face, state: 'attentive', gaze: gazeOf('para'), head }); t += R.gap.para; }
    for (const part of parts) {
      if (part.pause !== undefined) { beats.push({ at: t, face: R.face, state: 'attentive', gaze: gazeOf('line'), head }); t += part.pause ?? R.gap.pause; continue; }
      const aside = part.aside !== undefined, marked = stressed(aside ? part.aside : part.line, R.stress);
      // (the script's own tokens, shown; each said as it is said (its numbers in words), and timed by the words the
      // mouth's rules make of it)
      const toks = marked.split(' ').filter(Boolean), said = toks.map(spoken), text = said.join(' ');
      const S = speak({ text, rate: R.rate, articulation: aside ? R.articulation * 0.9 : R.articulation }), SW = S.events.words;
      let k = 0;
      const words = [];
      toks.forEach((tok, i) => {
        const n = speechCount(said[i]), ws = SW.slice(k, k + n); k += n;
        if (!ws.length) return;
        const a = ws[0], b = ws.at(-1);
        words.push({ w: tok.replace(/\*/g, ''), t: r3(t + a.t), dur: r3(b.t + b.dur - a.t), ...(ws.some((w) => w.emph) ? { emph: true } : {}) });
      });
      lines.push({ text: marked.replace(/\*/g, ''), at: r3(t), end: r3(t + S.seconds), para: pi, ...(aside ? { aside: true } : {}), words });
      beats.push({ at: r3(t), face: R.face, state: 'speaking', gaze: gazeOf(aside ? 'aside' : 'line'), head, say: { text, rate: R.rate, articulation: aside ? R.articulation * 0.9 : R.articulation } });
      // (the body's: a gesture on each stressed word, one on an aside)
      if (R.body.stress) for (const w of words) if (w.emph) body.push({ t: w.t, gesture: R.body.stress, cause: 'stress' });
      if (aside && R.body.aside) body.push({ t: r3(t), gesture: R.body.aside, cause: 'aside' });
      t += S.seconds + R.gap.sentence;
    }
  });
  if (!lines.length) throw new Error('read: the script has no line to read');
  const last = lines.at(-1);
  if (R.body.close) body.push({ t: r3(Math.max(last.at, last.end - 0.3)), gesture: R.body.close, cause: 'close' });
  const seconds = r3(last.end + READ_PAD.tail);
  beats.push({ at: last.end, face: R.face, state: 'attentive', gaze: READ_GAZE.lens, head });
  return { register: R.name, seconds, lines, beats, body, voice: { ...R.voice } };
}

/** The face's take of a read (perform.js): its blinks, glances and holds by `seed` */
export function takeOf(read, { seed = 1, fps } = {}) {
  return perform({ beats: read.beats, seconds: read.seconds, seed, ...(fps ? { fps } : {}) });
}

const r3 = (v) => Math.round(v * 1000) / 1000;
