/**
 * A RUN'S WRITE, REBASED — a run reads the world once and writes back what it changed (its record, a hero's base pinned
 * and the approval kept with it), while another chapter may have been written in between (a department's page, the
 * creator's verdict). The run's changes are laid onto the world as it is stored now, never the world as the run read
 * it, so a page written during a run is kept.
 *
 *   rebase(stored, base, mine) → stored, with every change from base to mine laid on it
 *
 * Three-way, by path. Where mine is as base was, the stored value stands; where mine changed it, mine's value is
 * written; an object is followed key by key, so the run's change to one page never carries the rest of its stale copy.
 * A key mine removed is removed. When nothing was stored in between (stored is base), the answer is mine as it is, its
 * keys in its own order: a run alone writes what it always wrote.
 *
 * Pure: the same three worlds give the same world.
 */

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function rebase(stored, base, mine) {
  if (same(stored, base) || !isObj(stored) || !isObj(base) || !isObj(mine)) return same(mine, base) ? stored : mine;
  if (same(mine, base)) return stored;
  const out = { ...stored };
  for (const k of new Set([...Object.keys(base), ...Object.keys(mine)])) {
    if (!Object.hasOwn(mine, k)) { delete out[k]; continue; }
    const v = rebase(stored[k], base[k], mine[k]);
    if (v === undefined) delete out[k];
    else out[k] = v;
  }
  return out;
}
