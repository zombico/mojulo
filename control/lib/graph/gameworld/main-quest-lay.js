/**
 * THE MAIN QUEST, LAID — the levels a quest's beats are played on, interpolated from the quest when a run reaches them.
 * Each built beat is played on a level:
 *
 *   as { level }      that level                       as { gauntlet }  that level (its arena)
 *   as { wcd }        the level its space stands in     as { qow }       the level the open world is played in
 *   as { errand }     the giver's level                 as { scene }     the level its moment is placed in
 *   as { epoch }      a tactics book's map (no level)
 *   no `as`           a level LAID from the beat: composed from its own words (the composer's reading, compose.js),
 *                     named by its goal, seeded by its id, standing the foes it fields; laid once, at the run that
 *                     reaches it, into the recipe, and the creator's from then on (edited in place, never laid again:
 *                     the beat finds its level by its id)
 *
 * A planned beat (`built: false`) is laid nothing and made nothing: it is priced (design-game-check.js). The game is
 * played in the quest's order: the beats' levels first, in the order the beats come, then the world's others.
 *
 *   questPlays(W)        → { plays: { <beat id>: level id | null }, lays: [{ beat, level, goal }], planned: [beat id],
 *                           order: [level id] }   (pure: what a run would lay, before it does)
 *   withQuestLevels(W)   → the world with the levels laid and ordered by the quest (unchanged without a quest)
 *
 * Pure and deterministic: the same quest lays the same levels.
 */
import { readMainQuest, mainQuestContext, partsOf } from './main-quest.js';
import { composeGameworld } from './compose.js';
import { fingerprint } from './review.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const seedOf = (id) => (parseInt(fingerprint({ beat: id }).slice(0, 6), 16) % 9973) + 1;
const named = (goal) => goal.charAt(0).toUpperCase() + goal.slice(1);

// the level a beat played as a structure is played on (null: none, an epoch's map, or a structure not placed on one)
function hostOf(as, W) {
  switch (as.kind) {
    case 'level': case 'gauntlet': return as.at;
    case 'wcd': return W.wcd?.spaces?.[as.at]?.level ?? null;
    case 'qow': return W.qow?.level ?? null;
    case 'errand': return (W.errands ?? []).find((e) => e?.id === as.at)?.giver ?? null;
    case 'scene': return (W.story ?? []).find((m) => m?.id === as.at)?.where?.level ?? null;
    default: return null;
  }
}

/** A level laid from a beat's words: the composer's level (its walk, its goal, its building), the book's own style kept. */
export function layBeat(beat, { foes = {} } = {}) {
  const composed = composeGameworld({ prompt: beat.goal, levels: 1, seed: seedOf(beat.id) });
  const [level] = Object.values(composed.levels);
  const fielded = beat.foes.filter((f) => f in foes);
  return { ...level, name: named(beat.goal), ...(fielded.length ? { foes: { from: fielded } } : {}) };
}

export function questPlays(W) {
  if (!isObj(W?.mainQuest)) return null;
  const C = mainQuestContext(W), Q = readMainQuest(W.mainQuest, C);
  const levels = isObj(W.levels) ? W.levels : {};
  const plays = {}, lays = [], planned = [];
  for (const A of partsOf(Q)) for (const B of A.beats) {
    if (!B.built) { planned.push(B.id); plays[B.id] = null; continue; }
    if (B.as) { plays[B.id] = hostOf(B.as, W); continue; }
    // a beat with no structure named: its own level, laid once (found by its id ever after)
    plays[B.id] = B.id;
    if (!levels[B.id]) lays.push({ beat: B.id, level: B.id, goal: B.goal });
  }
  const own = [...new Set(Object.values(plays).filter(Boolean))];
  const order = [...own, ...Object.keys(levels).filter((id) => !own.includes(id))];
  return { plays, lays, planned, order };
}

export function withQuestLevels(W) {
  const P = questPlays(W);
  if (!P) return W;
  const C = mainQuestContext(W), Q = readMainQuest(W.mainQuest, C);
  const beats = new Map(partsOf(Q).flatMap((A) => A.beats.map((B) => [B.id, B])));
  const laid = Object.fromEntries(P.lays.map((x) => [x.level, layBeat(beats.get(x.beat), { foes: C.foes })]));
  const all = { ...(isObj(W.levels) ? W.levels : {}), ...laid };
  const levels = Object.fromEntries(P.order.filter((id) => all[id]).map((id) => [id, all[id]]));
  const same = JSON.stringify(Object.keys(levels)) === JSON.stringify(Object.keys(W.levels ?? {})) && !P.lays.length;
  return same ? W : { ...W, levels };
}
