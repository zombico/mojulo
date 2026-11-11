/**
 * A WALL'S RHYTHM (era/laws.js 'wall-rhythm'; the crypt in ashlar lays its bays by it, era/crypt.js): along one wall
 * the order of its segments (bays) is neither a run nor a beat. The rule is LOCAL: two checks on what stands side by
 * side, the same on a wall of two segments as on one of ten.
 *
 *   no run of three    at most two neighbouring segments look alike (AAA fails; AA is a pair, and a pair is allowed)
 *   no repeated pair   a pair of segments is never followed by the same pair (ABAB fails: it is AB, AB; ABBA does not)
 *
 * So AAAA becomes ABBA or BAAB; three segments may be ABA, BAB, AAB, ABB, BAA, BBA; five may be AABAA or BBABB, never
 * ABABA. That a wall needs two kinds is no rule of its own: it follows from the first check once a wall has three
 * segments. A wall of one or two is solved as it stands, all A (a pair alike is allowed anywhere). The rule is a
 * default: a recipe may name a wall's order itself.
 *
 *   rhythmFaults(seq) → [{ at, fault: 'run' | 'beat' }] (empty: the order keeps the rule); `seq` a string
 *     or an array of kinds
 *   wallRhythms(n, kinds = 2) → every order of n segments in `kinds` kinds that keeps the rule (as strings, A, B, …),
 *     mirrored ones first: a wall read from its middle is the same both ways, which is how a wall is built
 *   wallOrder(n, { order?, kinds, pick }) → the wall's order resolved: the rule unasked, a recipe's intent where it
 *     states one (below)
 *   wallRhythm(n, { kinds = 2, pick = 0 }) → one of them (by `pick`, a seeded dice's number 0..1); all A for n of 1 or 2
 *
 * Pure: no dice of its own.
 */
const LETTERS = 'ABCDEFGH';

export function rhythmFaults(seq) {
  const s = Array.isArray(seq) ? seq : [...String(seq)], out = [];
  for (let i = 0; i + 2 < s.length; i++) if (s[i] === s[i + 1] && s[i + 1] === s[i + 2]) out.push({ at: i, fault: 'run' });
  for (let i = 0; i + 3 < s.length; i++) if (s[i] !== s[i + 1] && s[i] === s[i + 2] && s[i + 1] === s[i + 3]) out.push({ at: i, fault: 'beat' });
  return out;
}

export function wallRhythms(n, kinds = 2) {
  if (!(n >= 1) || !(kinds >= 1)) return [];
  const K = Math.min(kinds, LETTERS.length), out = [];
  const grow = (s) => {
    if (s.length === n) { out.push(s); return; }
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
  // (a wall of one or two segments is solved before it is asked: all A. A pair alike keeps the rule on any wall)
  if (n >= 1 && n <= 2) return 'A'.repeat(n);
  const all = wallRhythms(n, kinds);
  if (!all.length) return null;
  // (a mirrored order where the length has one: a wall is built from its middle)
  const sym = all.filter((s) => s === [...s].reverse().join('')), from = sym.length ? sym : all;
  return from[Math.min(from.length - 1, Math.floor(Math.max(0, Math.min(0.999999, pick)) * from.length))];
}

/**
 * A WALL'S ORDER, resolved: the rule by default, an intent where a recipe states one. The rhythm is what a wall reaches
 * for unasked; a wall all alike is allowed only as a choice (`order: 'same'`, or an order written out, 'AAAA'), and then
 * its one bay is to be drawn CLEAN AND REPEATABLE (`clean`: nothing in it that marks one bay from the next, so the
 * repeat reads as meant and not as a stamp).
 *   wallOrder(n, { order?, kinds = 2, pick = 0 }) → { order, by: 'rule' | 'intent', clean }
 * An order of the wrong length, or naming a kind the wall has not got, teaches.
 */
export function wallOrder(n, { order = null, kinds = 2, pick = 0 } = {}) {
  if (order === null || order === undefined) return { order: wallRhythm(n, { kinds, pick }), by: 'rule', clean: false };
  const o = order === 'same' ? 'A'.repeat(n) : String(order).toUpperCase();
  if (o.length !== n) throw new Error(`wall rhythm: the order '${order}' names ${o.length} segments and the wall has ${n}`);
  for (const c of o) if (LETTERS.indexOf(c) < 0 || LETTERS.indexOf(c) >= Math.max(1, kinds)) throw new Error(`wall rhythm: '${c}' is not one of the wall's ${kinds} kinds (${LETTERS.slice(0, kinds).split('').join(', ')})`);
  return { order: o, by: 'intent', clean: new Set(o).size === 1 && n > 2 };
}
