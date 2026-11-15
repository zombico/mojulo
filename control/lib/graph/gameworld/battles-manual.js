/**
 * A MONSTER MANUAL ON THE BATTLES PAGE — the first lore part a game is laid from. A manual (lorecube/manual.js: a
 * setting's creatures, each an element and a role) is written on a gameworld's battles (`battles.manual`), at whatever
 * depth it has, and the party battles field it: its creatures are the foes, their elements the skills they use, and
 * the packs met along the way follow from their roles and levels. The page's own words still win (`foes`, `skills`,
 * `packs`, `boss`): a manual is a floor, as every derivation of the book is.
 *
 * A part is an ORDER the chapter can run: what the producer placed says what it is and how deep it has been taken; the
 * rungs still open are derived here (the polarity gives the affinities, the roles the levels), said as derived, and
 * deepened by the battles chapter's author one pass at a time (intensifyManual).
 *
 *   manualOrder(M)   → { name?, rung, open: [<rung still derived>], creatures: n, lacks }   what the part is, for a readout
 *   manualBattles(M) → { foes, skills, packs, boss?, order }   what the battles page takes from it:
 *     foes, skills   the party RPG's own words (lowerManual), the open rungs derived
 *     packs          the ladder: the creatures short of a boss in the order they are met (by level, then as written),
 *                    each a pack: a grunt a pair, a harrier beside the grunt met before it, an elite between two of it
 *     boss           the boss's pack, alone (the last, where there are several: the others are packs of the ladder)
 *
 * Pure. A malformed manual throws as the lorecube says it (readManual), where it was written.
 */
import { readManual, intensifyManual, lowerManual, MANUAL } from '../lorecube/manual.js';
import { rungOf } from '../lorecube/passes.js';

/** The manual numbered: the rungs it lacks derived, the ones it holds kept. */
function numbered(M) {
  let V = readManual(M);
  const open = [];
  if (!V.affinity) { V = intensifyManual(V, { affinity: true }).manual; open.push('affinity'); }
  if (!V.levels) { V = intensifyManual(V, { levels: true }).manual; open.push('levels'); }
  return { V, open };
}

export function manualOrder(M) {
  const R = readManual(M), { open } = numbered(M);
  return { ...(R.name ? { name: R.name } : {}), rung: rungOf(MANUAL, R), open, creatures: R.creatures.length };
}

export function manualBattles(M) {
  const { V, open } = numbered(M), L = lowerManual(V);
  const met = V.creatures.map((c, i) => ({ ...c, level: V.levels[c.id], i })).sort((a, b) => a.level - b.level || a.i - b.i);
  const bosses = met.filter((c) => c.role === 'boss'), boss = bosses.at(-1) ?? null;
  const packs = [];
  let grunt = null;
  for (const c of met) {
    if (c === boss) continue;
    if (c.role === 'grunt') { packs.push([c.id, c.id]); grunt = c.id; }
    else if (c.role === 'elite') packs.push(grunt ? [grunt, c.id, grunt] : [c.id]);
    else packs.push(grunt ? [c.id, grunt] : [c.id]);
  }
  return { foes: L.foes, skills: L.skills, ...(packs.length ? { packs } : {}), ...(boss ? { boss: [boss.id] } : {}), order: { ...manualOrder(M), lacks: L.lacks } };
}
