/**
 * screenplay — a scene's SCRIPT as people write one: who speaks and what, how they say it, and what they do between.
 * Plain text, a line a beat; the persona's read markup inside a spoken line (persona/read.js: `*stress*`, `[pause]`,
 * `[pause 1.5]`, `(aside)`).
 *
 *   MARA: You kept the *key*.                a LINE: the speaker's name in capitals, a colon, the words
 *   JON (worried): I kept everything.        a PARENTHETICAL before the colon: the line's face, an emotion
 *                                            (face-acting/emotions.js), else a note on the line
 *   Mara crosses to the window.              DIRECTIONS (a line with no cue): an actor `crosses to` (or `walks to`,
 *   Jon turns to Mara.                       `moves to`) a mark; `turns to` an actor or a mark; `looks at` an actor or
 *   Mara looks at the door.                  a mark (till the next line); `waits` (a beat, or `waits 2 seconds`)
 *   Mara waits.
 *   Slow motion.                             TIME (shoot/time.js, the screen's clock, never the scene's): `slow
 *   Real time.                               motion` (at a speed: `slow motion 0.1`) until `real time` (or `normal
 *   Freeze 2 seconds.                        speed`, or the scene's end); `freeze` (or `hold`) the moment, a beat or
 *                                            its seconds
 *   The rain does not stop.                  anything else is a NOTE: kept, read by nothing
 *
 *   parseScreenplay(script, { cast, marks }) → [{ kind: 'line', who, text, face?, note? } | { kind: 'cross' | 'turn' |
 *     'look', who, to } | { kind: 'wait', who, seconds } | { kind: 'slow', speed } | { kind: 'real' } |
 *     { kind: 'hold', seconds } | { kind: 'note', text }] (names lower case, as the cast keys)
 *
 * A name not in the cast, or a mark not in the set, is refused by name. Pure.
 */
import { EMOTION_NAMES } from '../face-acting/emotions.js';

/** how long a `waits` holds when it says no time (s); slow motion's speed, and a freeze's screen seconds, unsaid */
export const WAIT = 1, SLOW = 0.25, HOLD = 1;
const CUE = /^([A-Z][A-Z0-9 _'-]*?)\s*(?:\(([^)]*)\))?\s*:\s*(.+)$/;
const DIRECTIONS = [
  ['cross', /^(\S+)\s+(?:crosses|walks|moves|goes)\s+(?:back\s+)?(?:over\s+)?to\s+(?:the\s+)?(\S+?)\.?$/i],
  ['turn', /^(\S+)\s+turns\s+(?:back\s+)?to(?:ward|wards)?\s+(?:the\s+)?(\S+?)\.?$/i],
  ['look', /^(\S+)\s+looks\s+(?:at|to|toward|towards)\s+(?:the\s+)?(\S+?)\.?$/i],
  ['wait', /^(\S+)\s+waits(?:\s+([\d.]+)\s*(?:s|sec|secs|seconds?))?\.?$/i],
];
const TIME = [
  ['slow', /^(?:in\s+)?slow(?:\s+|-)?mo(?:tion)?(?:\s+(?:at\s+)?(\d*\.?\d+)(?:\s*x)?)?\.?$/i],
  ['real', /^(?:back\s+to\s+|in\s+)?(?:real\s+time|normal\s+speed|full\s+speed)\.?$/i],
  ['hold', /^(?:the\s+moment\s+)?(?:freezes?|holds?)(?:\s+(?:for\s+)?([\d.]+)\s*(?:s|sec|secs|seconds?))?\.?$/i],
];

/** The script's beats (see the header) */
export function parseScreenplay(script, { cast = {}, marks = {} } = {}) {
  if (typeof script !== 'string' || !script.trim()) throw new Error('screenplay: the script is text (NAME: a line, a direction, or a note, a line each)');
  const names = Object.keys(cast), who = (w, at) => {
    const k = w.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!names.includes(k)) throw new Error(`screenplay: ${at}: '${w}' is not in the cast (${names.join(', ')})`);
    return k;
  };
  const target = (w, at) => {
    const k = w.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (names.includes(k)) return { actor: k };
    if (Object.hasOwn(marks, k)) return { mark: k };
    throw new Error(`screenplay: ${at}: '${w}' is neither in the cast (${names.join(', ')}) nor a mark (${Object.keys(marks).join(', ') || 'none'})`);
  };
  const beats = [];
  script.split('\n').map((l) => l.trim()).filter(Boolean).forEach((line, i) => {
    const at = `line ${i + 1}`, cue = CUE.exec(line);
    if (cue) {
      const p = cue[2]?.trim().toLowerCase(), face = p && EMOTION_NAMES.includes(p) ? p : undefined;
      beats.push({ kind: 'line', who: who(cue[1], at), text: cue[3].trim(), ...(face ? { face } : {}), ...(p && !face ? { note: cue[2].trim() } : {}) });
      return;
    }
    for (const [kind, re] of TIME) {
      const m = re.exec(line);
      if (!m) continue;
      if (kind === 'slow') { const v = m[1] ? Number(m[1]) : SLOW; if (!(v > 0 && v < 1)) throw new Error(`screenplay: ${at}: slow motion runs under 1 (a fraction of real time), not ${m[1]}`); beats.push({ kind, speed: v }); }
      else if (kind === 'real') beats.push({ kind });
      else beats.push({ kind, seconds: m[1] ? Number(m[1]) : HOLD });
      return;
    }
    for (const [kind, re] of DIRECTIONS) {
      const m = re.exec(line);
      if (!m || !names.includes(m[1].toLowerCase())) continue;
      const w = who(m[1], at);
      if (kind === 'wait') beats.push({ kind, who: w, seconds: m[2] ? Number(m[2]) : WAIT });
      else {
        const to = target(m[2], at);
        if (kind === 'cross' && !to.mark) throw new Error(`screenplay: ${at}: ${w} crosses to a mark, not to '${m[2]}' (marks: ${Object.keys(marks).join(', ') || 'none'})`);
        beats.push({ kind, who: w, to });
      }
      return;
    }
    beats.push({ kind: 'note', text: line });
  });
  if (!beats.some((b) => b.kind === 'line')) throw new Error('screenplay: the script has no line to speak (NAME: the words)');
  return beats;
}
