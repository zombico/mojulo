/**
 * THE CONTEST'S RESULTS, HANDED ON — what a sport's level ended with, rebuilt from its OUTCOME for the screen that
 * follows the broadcast's results board (mana-ui's `match-results` idiom). The arena posts its stats compact
 * (`stats.contest`: { <row>: { <side, seat or lane>: n } }); the words, units and leanings are the contest's
 * (contest-stats.js STAT_ROWS), so the screen after the coverage says what the coverage said: the same rows, the same
 * formatting, the same lead, and no judgement of its own.
 *
 *   contestResults(envelope, { kind?, names?, you? }) → { outcome, scores, columns, rows } | null
 *     envelope  the level's OUTCOME envelope ({ result, stats: { contest, court? } })
 *     kind      the stats' kind (STAT_ROWS: match, team, strokes, pins, race, jump, bases, runs); read off the rows when
 *               left out (the one kind that holds every row the outcome carries)
 *     names     a name for each side, seat or lane, in order (the broadcast's names: the recipe's, else P1, CPU …)
 *     you       which side is the player's (0): its score row is marked
 *   outcome     Won | Lost (the envelope's result, said as a match says it)
 *   scores      [{ name, value, side, self }]: the kind's first row (points, goals, strokes, time …), best first
 *   columns     [{ key: 'words' }, { key: 'c0', label: <name>, align: 'right' }, …]
 *   rows        [{ words, c0, c1 …, lead: 'c<n>' | null }]: each row the outcome carries, its one best value leading
 *
 * Pure, on the contest's own tables: it runs in Node and inlines into a page alike. Absent stats ⇒ null (the screen
 * shows the result alone).
 */
import { STAT_ROWS, statFormat } from './contest-stats.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The stats' kind: the one STAT_ROWS kind that holds every row the outcome carries. */
export function resultsKind(compact) {
  const ids = Object.keys(compact || {});
  if (!ids.length) return null;
  return Object.keys(STAT_ROWS).find((k) => ids.every((id) => STAT_ROWS[k].some((r) => r.id === id))) ?? null;
}

/** A level's outcome as the results screen reads it. */
export function contestResults(envelope, { kind = null, names = [], you = 0 } = {}) {
  const compact = isObj(envelope) && isObj(envelope.stats) && isObj(envelope.stats.contest) ? envelope.stats.contest : null;
  const K = kind ?? resultsKind(compact);
  if (!compact || !K || !STAT_ROWS[K]) return null;
  const table = STAT_ROWS[K].filter((r) => isObj(compact[r.id]));
  if (!table.length) return null;
  const ids = Object.keys(compact[table[0].id]);
  const nameOf = (i) => names[i] ?? ids[i];
  const columns = [{ key: 'words', label: '' }, ...ids.map((id, i) => ({ key: `c${i}`, label: nameOf(i), align: 'right' }))];
  const rows = table.map((r) => {
    const vals = ids.map((id) => compact[r.id][id] ?? null), nums = vals.filter((x) => typeof x === 'number');
    const best = nums.length ? (r.better === 'low' ? Math.min(...nums) : Math.max(...nums)) : null;
    // one best value leads; a tie, or nothing yet, leads nothing (contest-stats statPanel's rule)
    const lead = nums.length > 1 && nums.filter((x) => x === best).length === 1 && nums.some((x) => x !== 0) ? `c${vals.indexOf(best)}` : null;
    return { words: r.words, ...Object.fromEntries(vals.map((x, i) => [`c${i}`, statFormat(r, x)])), lead };
  });
  const head = table[0], order = ids.map((id, i) => ({ i, v: compact[head.id][id] ?? null }));
  order.sort((a, b) => (a.v === null) - (b.v === null) || (head.better === 'low' ? a.v - b.v : b.v - a.v) || a.i - b.i);
  const scores = order.map(({ i, v }) => ({ name: nameOf(i), value: statFormat(head, v), side: i, self: i === you }));
  return { outcome: envelope.result === 'success' ? 'Won' : 'Lost', scores, columns, rows };
}
