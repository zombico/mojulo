/**
 * dub — a scene DUBBED TO PICTURE: the picture keeps the original's clock, its blocking, its body and its face's
 * acting; only the mouth is re-solved, each dubbed line's recording spoken where its line is. A dub never re-times a
 * scene (a retime, a scene re-blocked per locale, is later).
 *
 *   dubbedRead(A, turns, dub) → the actor's read with each dubbed line's speaking beats given over to the dub: the first
 *     beat that speaks within the line's span says the dub's recording (its mouth from its phonemes), the others say
 *     nothing (one recording speaks the whole line); a line the dub leaves out keeps the original's
 *   dubTake(locale) → the face take's name for a locale ('dub-fr', 'dub-pt-BR'): the GLB's `face:<take>`, never
 *     beginning `face:scene` (actors.py binds the first action its face's name begins)
 *   dubAdvice(turns, dub) → [{ id: 'dub-over', line, by, says, try }]: a dub line that runs past the next line's start
 *     (it is laid where its line is and plays whole: what it overlaps is said)
 *
 * Pure and deterministic.
 */
const r3 = (v) => Math.round(v * 1000) / 1000;

/** the face take a locale's dub plays as */
export const dubTake = (locale) => `dub-${locale}`;

/** the bound recording as a beat says it */
const sayOf = (D) => ({ text: D.text, recording: D.recording, seconds: D.seconds, ...(D.timing ? { timing: D.timing } : {}), ...(D.phonemes ? { phonemes: D.phonemes } : {}), ...(D.words ? { words: D.words } : {}), ...(D.envelope ? { envelope: D.envelope } : {}) });

/** The actor's read, its dubbed lines' mouths the dub's (see the header) */
export function dubbedRead(A, turns, dub) {
  const spans = turns.map((T, k) => ({ T, D: dub?.[k + 1] ?? dub?.[String(k + 1)] })).filter(({ D }) => D);
  const first = new Set();
  const beats = A.read.beats.map((b) => {
    if (b.say === undefined) return b;
    const hit = spans.find(({ T }) => b.at >= T.at - 1e-6 && b.at < T.at + T.hold - 1e-6);
    if (!hit) return b;
    const { say: _s, ...rest } = b;
    if (first.has(hit.T)) return rest;
    first.add(hit.T);
    return { ...rest, at: r3(hit.T.at), say: sayOf(hit.D) };
  });
  return { ...A.read, beats };
}

/** A dub's lines that run past the next line's start */
export function dubAdvice(turns, dub, locale) {
  const out = [];
  turns.forEach((T, k) => {
    const D = dub?.[k + 1] ?? dub?.[String(k + 1)], next = turns[k + 1];
    if (!D || !next) return;
    const by = r3(T.at + D.seconds - next.at);
    if (by > 0.05) out.push({ id: 'dub-over', locale, line: k + 1, by, says: `the ${locale} dub of line ${k + 1} runs ${by} s into line ${k + 2}`, try: `record it shorter, or open the gap after line ${k + 1} ("${T.who.charAt(0).toUpperCase() + T.who.slice(1)} waits ${Math.ceil(by * 10) / 10} seconds.")` });
  });
  return out;
}
