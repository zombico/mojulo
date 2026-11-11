/**
 * A WALL'S RHYTHM (the rule and its solver; no kit lays its bays by it yet, so no law is counted for it): along one wall its segments (bays) are of at least two kinds, and their
 * order is neither a run nor a beat. Two rules, each on what stands side by side:
 *
 *   no run of three    at most two neighbouring segments look alike (AAA fails; AA is a pair, and a pair is allowed)
 *   no repeated pair   a pair of segments is never followed by the same pair (ABAB fails: it is AB, AB; ABBA does not)
 *
 * So AAAA becomes ABBA or BAAB; three segments may be ABA, BAB, AAB, ABB, BAA, BBA; five may be AABAA or BBABB, never
 * ABABA. A wall of one segment has no rhythm to keep. The rule is a default: a recipe may name a wall's order itself.
 *
 *   rhythmFaults(seq) → [{ at, fault: 'run' | 'beat' | 'one-kind' }] (empty: the order keeps the rule); `seq` a string
 *     or an array of kinds
 *   wallRhythms(n, kinds = 2) → every order of n segments in `kinds` kinds that keeps the rule (as strings, A, B, …),
 *     mirrored ones first: a wall read from its middle is the same both ways, which is how a wall is built
 *   wallRhythm(n, { kinds = 2, pick = 0 }) → one of them (by `pick`, a seeded dice's number 0..1), or null where n < 2
 *
 * Pure: no dice of its own.
 */
const LETTERS = 'ABCDEFGH';

export function rhythmFaults(seq) {
  const s = Array.isArray(seq) ? seq : [...String(seq)], out = [];
  if (s.length < 2) return out;
  if (new Set(s).size < 2) out.push({ at: 0, fault: 'one-kind' });
  for (let i = 0; i + 2 < s.length; i++) if (s[i] === s[i + 1] && s[i + 1] === s[i + 2]) out.push({ at: i, fault: 'run' });
  for (let i = 0; i + 3 < s.length; i++) if (s[i] !== s[i + 1] && s[i] === s[i + 2] && s[i + 1] === s[i + 3]) out.push({ at: i, fault: 'beat' });
  return out;
}

export function wallRhythms(n, kinds = 2) {
  if (!(n >= 2) || !(kinds >= 2)) return [];
  const K = Math.min(kinds, LETTERS.length), out = [];
  const grow = (s) => {
    if (s.length === n) { if (new Set(s).size >= 2) out.push(s); return; }
    for (let k = 0; k < K; k++) {
      const c = LETTERS[k], t = s + c, L = t.length;
      if (L >= 3 && t[L - 1] === t[L - 2] && t[L - 2] === t[L - 3]) continue;
      if (L >= 4 && t[L - 1] !== t[L - 2] && t[L - 1] === t[L - 3] && t[L - 2] === t[L - 4]) continue;
      grow(t);
    }
  };
  grow('');
  const mirrored = (s) => s === [...s].reverse().join('');
  return [...out.filter(mirrored), ...out.filter((s) => !mirrored(s))];
}

export function wallRhythm(n, { kinds = 2, pick = 0 } = {}) {
  const all = wallRhythms(n, kinds);
  if (!all.length) return null;
  // (a mirrored order where the length has one: a wall is built from its middle)
  const sym = all.filter((s) => s === [...s].reverse().join('')), from = sym.length ? sym : all;
  return from[Math.min(from.length - 1, Math.floor(Math.max(0, Math.min(0.999999, pick)) * from.length))];
}
